import React from 'react';

interface AccordionProps {
  title: string;
  children: React.ReactNode;
  headerContent?: React.ReactNode;
}

const Accordion: React.FC<AccordionProps> = ({ title, children, headerContent }) => {
  return (
    <div className="border-b border-slate-200">
      <div className="w-full flex justify-between items-center py-3 text-left font-bold text-sm text-slate-800">
        <span>{title}</span>
        {headerContent && <div>{headerContent}</div>}
      </div>
      <div className="pb-4">
          {children}
      </div>
    </div>
  );
};

export default Accordion;