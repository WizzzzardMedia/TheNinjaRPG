import { z } from "zod";
import { nanoid } from "nanoid";
import { eq, sql, gt, and, asc, isNull } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { errorResponse } from "../trpc";
import { fetchUser } from "./profile";
import { userData, ryoTrade } from "@/drizzle/schema";
import { secondsFromDate } from "@/utils/time";
import { RYO_FOR_REP_DAYS_FROZEN } from "@/drizzle/constants";
import type { DrizzleClient } from "@/server/db";

export const blackMarketRouter = createTRPCRouter({
  getRyoOffers: protectedProcedure
    .input(
      z.object({
        cursor: z.number().nullish(),
        limit: z.number().min(1).max(100).nullish(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const currentCursor = input?.cursor ? input.cursor : 0;
      const limit = input?.limit ? input.limit : 100;
      const skip = currentCursor * limit;
      const results = await ctx.drizzle
        .select({
          id: ryoTrade.id,
          creatorUserId: ryoTrade.creatorUserId,
          repsForSale: ryoTrade.repsForSale,
          requestedRyo: ryoTrade.requestedRyo,
          createdAt: ryoTrade.createdAt,
          ryoPerRep: ryoTrade.ryoPerRep,
          username: userData.username,
          avatar: userData.avatar,
        })
        .from(ryoTrade)
        .innerJoin(userData, eq(ryoTrade.creatorUserId, userData.userId))
        .where(isNull(ryoTrade.purchaserUserId))
        .orderBy((table) => [asc(table.ryoPerRep)])
        .limit(limit)
        .offset(skip);
      const nextCursor = results.length < limit ? null : currentCursor + 1;
      return { data: results, nextCursor };
    }),
  createOffer: protectedProcedure
    .input(z.object({ reps: z.coerce.number().min(0), ryo: z.coerce.number().min(0) }))
    .mutation(async ({ ctx, input }) => {
      // Fetch
      const user = await fetchUser(ctx.drizzle, ctx.userId);
      // Guard
      if (user.reputationPoints - 5 < input.reps) {
        return errorResponse("Not enough reputation points");
      }
      if (input.reps <= 0) return errorResponse("Reps must be greater than 0");
      if (input.ryo <= 0) return errorResponse("Ryo must be greater than 0");
      if (input.ryo < input.reps) return errorResponse("Ryo must be greater than reps");
      // Deduce reputation points first
      const result = await ctx.drizzle
        .update(userData)
        .set({ reputationPoints: sql`${userData.reputationPoints} - ${input.reps}` })
        .where(
          and(
            eq(userData.userId, ctx.userId),
            gt(userData.reputationPoints, input.reps),
          ),
        );
      if (result.rowsAffected === 0) {
        return errorResponse("Not enough reputation points");
      }
      // Add in the offer
      await ctx.drizzle.insert(ryoTrade).values({
        id: nanoid(),
        creatorUserId: ctx.userId,
        repsForSale: input.reps,
        requestedRyo: input.ryo,
        ryoPerRep: input.ryo / input.reps,
      });
      // Response
      return { success: true, message: "Offer created" };
    }),
  delistOffer: protectedProcedure
    .input(z.object({ offerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Query
      const offer = await fetchOffer(ctx.drizzle, input.offerId);
      // Guard
      if (!offer) return errorResponse("Offer not found");
      if (offer.creatorUserId !== ctx.userId) return errorResponse("Not yours");
      // Check time
      const delistSeconds = 3600 * 24 * RYO_FOR_REP_DAYS_FROZEN;
      const delistDate = secondsFromDate(delistSeconds, offer.createdAt);
      const canDelist = new Date() >= delistDate;
      if (!canDelist) return errorResponse("Offer is frozen");
      // Mutate
      await Promise.all([
        ctx.drizzle.delete(ryoTrade).where(eq(ryoTrade.id, input.offerId)),
        ctx.drizzle
          .update(userData)
          .set({
            reputationPoints: sql`${userData.reputationPoints} + ${offer.repsForSale}`,
          })
          .where(eq(userData.userId, ctx.userId)),
      ]);
      // Response
      return { success: true, message: "Offer delisted" };
    }),
  takeOffer: protectedProcedure
    .input(z.object({ offerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Query
      const [offer, user] = await Promise.all([
        fetchOffer(ctx.drizzle, input.offerId),
        fetchUser(ctx.drizzle, ctx.userId),
      ]);
      // Guard
      if (!offer) return errorResponse("Offer not found");
      if (offer.purchaserUserId) return errorResponse("Offer already taken");
      if (offer.creatorUserId === ctx.userId) return errorResponse("Your own offer");
      if (user.money < offer.requestedRyo) return errorResponse("Not enough ryo");
      // Mutate
      const result = await ctx.drizzle
        .update(userData)
        .set({
          money: sql`${userData.money} - ${offer.requestedRyo}`,
          reputationPoints: sql`${userData.reputationPoints} + ${offer.repsForSale}`,
        })
        .where(
          and(eq(userData.userId, ctx.userId), gt(userData.money, offer.requestedRyo)),
        );
      if (result.rowsAffected === 0) {
        return errorResponse("Not enough ryo");
      }
      await ctx.drizzle
        .update(ryoTrade)
        .set({ purchaserUserId: ctx.userId })
        .where(eq(ryoTrade.id, input.offerId));
      // Response
      return {
        success: true,
        message: `Bought ${offer.repsForSale} reputation points for ${offer.requestedRyo} ryo.`,
      };
    }),
});

/**
 * Fetches a ryo offer from the black market.
 *
 * @param {DrizzleClient} client - The Drizzle client used to make the query.
 * @param {string} offerId - The ID of the offer to fetch.
 */
export const fetchOffer = async (client: DrizzleClient, offerId: string) => {
  return await client.query.ryoTrade.findFirst({
    where: eq(ryoTrade.id, offerId),
  });
};