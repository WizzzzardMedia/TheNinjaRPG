import { z } from "zod";

export const mutateCommentSchema = z
  .object({
    comment: z.string().min(4).max(1000),
    object_id: z.string(),
  })
  .strict()
  .required();

export type MutateCommentSchema = z.infer<typeof mutateCommentSchema>;

export const deleteCommentSchema = z
  .object({
    id: z.string(),
  })
  .strict()
  .required();

export type DeleteCommentSchema = z.infer<typeof deleteCommentSchema>;

export const createConversationSchema = z
  .object({
    title: z.string().min(4).max(100),
    comment: z.string().min(4).max(1000),
    users: z.array(z.string()).min(1).max(5),
  })
  .strict()
  .required();

export type CreateConversationSchema = z.infer<typeof createConversationSchema>;

export const mutateNindoContent = z
  .object({ content: z.string().min(2).max(5000) })
  .strict()
  .required();

export type MutateNindoContent = z.infer<typeof mutateNindoContent>;
