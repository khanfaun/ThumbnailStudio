import React, { useState, useEffect } from 'react';
import { ChevronDownIcon } from './Icons';

interface CollapsiblePanelProps {
  title: string;
  icon: React.ReactNode;
  storageKey: string;
  children: React.ReactNode;
  headerContent?: React.ReactNode;
}

const CollapsiblePanel: React.FC<CollapsiblePanelProps> = ({ title, icon, storageKey, children, headerContent }) => {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      const item = window.localStorage.getItem(storageKey);
      // Mặc định là mở rộng (false) nếu không có giá trị
      return item ? JSON.parse(item) : false;
    } catch (error) {
      console.error(error);
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(isCollapsed));
    } catch (error) {
      console.error(error);
    }
  }, [isCollapsed, storageKey]);

  if (isCollapsed) {
    return (
        <div 
            title={title}
            onClick={() => setIsCollapsed(false)}
            className="w-12 h-12 bg-white rounded-lg shadow-md border border-slate-200 flex items-center justify-center cursor-pointer hover:bg-slate-100 text-slate-600 transition-colors"
        >
            {icon}
        </div>
    );
  }

  return (
    <div className="w-64 bg-white rounded-lg shadow-md border border-slate-200 overflow-hidden text-sm">
        <div 
            className="w-full flex justify-between items-center p-2 text-left font-bold text-slate-800 cursor-pointer hover:bg-slate-50 transition-colors"
            onClick={() => setIsCollapsed(true)}
        >
            <div className="flex items-center space-x-2">
                <div className="p-1 bg-slate-100 rounded text-slate-600">{icon}</div>
                <span>{title}</span>
            </div>
            <div className="flex items-center space-x-2">
                {headerContent && <div>{headerContent}</div>}
                <button className="p-1 rounded-full hover:bg-slate-200 text-slate-500 rotate-180 transition-transform">
                    <ChevronDownIcon />
                </button>
            </div>
        </div>
        <div className="bg-white border-t border-slate-200">
            {children}
        </div>
    </div>
  );
};

export default CollapsiblePanel;