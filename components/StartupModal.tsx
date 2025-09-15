import React from 'react';
import { Artboard } from '../types';
import ArtboardPreview from './ArtboardPreview';
import { CloseIcon, LoadIcon } from './Icons';

interface StartupModalProps {
  isOpen: boolean;
  templates: Artboard[];
  onSelectTemplate: (template: Artboard) => void;
  onCreateBlank: () => void;
  onLoadProject: () => void;
  title?: string;
  description?: string;
  onClose?: () => void;
}

const StartupModal: React.FC<StartupModalProps> = ({ isOpen, templates, onSelectTemplate, onCreateBlank, onLoadProject, title, description, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-full max-h-[90vh] flex flex-col relative" 
        onClick={e => e.stopPropagation()}
      >
        {onClose && (
            <button onClick={onClose} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 z-10 p-2 rounded-full transition-colors">
                <CloseIcon />
            </button>
        )}
        <div className="p-6 border-b border-slate-200">
            <h1 className="text-2xl font-bold text-slate-800">{title || 'Bắt đầu dự án mới'}</h1>
            <p className="text-slate-600 mt-1">{description || 'Chọn một mẫu có sẵn hoặc bắt đầu với một artboard trống.'}</p>
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <button 
                onClick={onCreateBlank}
                className="w-full text-left p-6 rounded-lg border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
            >
                <div className="flex items-center">
                    <div className="flex-shrink-0 w-12 h-12 bg-slate-200 group-hover:bg-indigo-200 rounded-lg flex items-center justify-center text-slate-500 group-hover:text-indigo-600 transition-colors">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <div className="ml-4">
                        <h2 className="font-semibold text-lg text-slate-800">Tạo dự án trống</h2>
                        <p className="text-slate-500">Bắt đầu với một artboard trắng tinh.</p>
                    </div>
                </div>
            </button>
             <button 
                onClick={() => {
                  onLoadProject();
                  if (onClose) onClose();
                }}
                className="w-full text-left p-6 rounded-lg border-2 border-dashed border-slate-300 hover:border-green-500 hover:bg-green-50 transition-all group"
            >
                <div className="flex items-center">
                    <div className="flex-shrink-0 w-12 h-12 bg-slate-200 group-hover:bg-green-200 rounded-lg flex items-center justify-center text-slate-500 group-hover:text-green-600 transition-colors">
                        <LoadIcon />
                    </div>
                    <div className="ml-4">
                        <h2 className="font-semibold text-lg text-slate-800">Tải dự án</h2>
                        <p className="text-slate-500">Mở một file .json đã lưu trước đó.</p>
                    </div>
                </div>
            </button>
        </div>

        <div className="px-6 pb-2">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Hoặc chọn một mẫu</h3>
        </div>
        
        <div className="flex-1 p-6 pt-2 overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {templates.map(artboard => (
                    <ArtboardPreview 
                        key={artboard.id} 
                        artboard={artboard} 
                        onClick={() => onSelectTemplate(artboard)} 
                        isSelected={false}
                    />
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};

export default StartupModal;