import React from "react";
import { ChevronDoubleDownIcon } from "@heroicons/react/24/outline";

interface AccordionProps {
  title: string;
  selectedTitle: string;
  unselectedSubtitle: string;
  selectedSubtitle?: string;
  children: string | React.ReactNode;
  onClick: React.Dispatch<React.SetStateAction<string>>;
}

const Accordion: React.FC<AccordionProps> = (props) => {
  const { title, unselectedSubtitle, selectedSubtitle, children, onClick } = props;
  const active = title === props.selectedTitle;
  return (
    <div
      className={`border-b-2 px-3 py-1 ${
        active ? "" : "hover:bg-slate-50 hover:cursor-pointer"
      }`}
      onClick={() => !active && onClick(active ? "" : title)}
    >
      <div className="flex flex-row items-center">
        <div>
          <h2 className="font-bold mt-2">{title}</h2>
          <p className="italic">
            {active && selectedSubtitle ? selectedSubtitle : unselectedSubtitle}
          </p>
        </div>
        <div className="grow"></div>
        <ChevronDoubleDownIcon
          className={`h-6 w-6 hover:cursor-pointer ${
            active ? "transform rotate-90" : ""
          }`}
          onClick={() => onClick(active ? "" : title)}
        />
      </div>
      {active && children}
    </div>
  );
};

export default Accordion;
