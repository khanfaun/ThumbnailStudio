import React from 'react';
import { FontFamily, TextLayer, TextSpan } from '../types';
import Accordion from './Accordion';

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
);

interface FontSelectorProps {
  fonts: FontFamily[];
  selectedLayer: TextLayer; // This layer is temporary, for display values only
  onStyleChange: (updates: Partial<TextSpan>) => void;
  customFonts: FontFamily[];
  onFontUpload: (file: File) => void;
  onDeleteCustomFont: (fontName: string) => void;
}

const InputField = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="w-full">
        <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
        {children}
    </div>
);

const FontSelector: React.FC<FontSelectorProps> = ({ fonts, selectedLayer, onStyleChange, customFonts, onFontUpload, onDeleteCustomFont }) => {
  const { fontFamily, fontWeight } = selectedLayer;
  const baseInputClasses = "w-full bg-slate-100 p-2 rounded-md border border-slate-200 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm";

  const currentFamily = fonts.find(f => f.name === fontFamily);

  const handleFamilyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newFamilyName = e.target.value;
    const newFamily = fonts.find(f => f.name === newFamilyName);
    
    if (newFamily && newFamily.variants.length > 0) {
      // Tìm variant gần nhất với font weight hiện tại, hoặc chọn variant đầu tiên
      const currentWeight = fontWeight || 400;
      let bestVariant = newFamily.variants[0];
      let minDiff = Math.abs(bestVariant.weight - currentWeight);

      for (let i = 1; i < newFamily.variants.length; i++) {
        const diff = Math.abs(newFamily.variants[i].weight - currentWeight);
        if (diff < minDiff) {
          minDiff = diff;
          bestVariant = newFamily.variants[i];
        }
      }
      
      onStyleChange({
        fontFamily: newFamilyName,
        fontWeight: bestVariant.weight,
      });
    }
  };

  const handleVariantChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newWeight = parseInt(e.target.value, 10);
    onStyleChange({ fontWeight: newWeight });
  };

  const handleFontUploadEvent = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        onFontUpload(file);
    }
    event.target.value = '';
  };

  return (
    <div className="space-y-3">
        <Accordion title="Quản lý Fonts Tùy Chỉnh">
            <div className="pt-2 space-y-2">
                <label htmlFor="font-upload-panel" className="w-full inline-block bg-slate-200 hover:bg-slate-300 text-slate-800 text-center font-bold py-2 px-4 rounded-md cursor-pointer transition-colors text-xs">Tải Font Lên (.otf, .ttf)</label>
                <input id="font-upload-panel" type="file" accept=".otf,.ttf,.woff,.woff2" onChange={handleFontUploadEvent} className="hidden" />
                {customFonts.length > 0 && (
                    <div className="space-y-1 pt-2 border-t border-slate-200 max-h-32 overflow-y-auto pr-1">
                        {customFonts.map(font => (
                            <div key={font.name} className="p-2 rounded-md flex justify-between items-center text-sm font-medium text-slate-700 bg-slate-50">
                                <span className="truncate pr-2">{font.name}</span>
                                <button onClick={() => onDeleteCustomFont(font.name)} className="p-1 rounded-full text-slate-400 hover:bg-red-100 hover:text-red-600" title="Xóa Font"><TrashIcon /></button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Accordion>
        <InputField label="Font Family">
            <select
              value={fontFamily || ''}
              onChange={handleFamilyChange}
              className={baseInputClasses}
            >
              {fonts.map(family => (
                <option key={family.name} value={family.name}>
                  {family.name}
                </option>
              ))}
            </select>
        </InputField>

        <InputField label="Kiểu chữ">
            <select
                value={fontWeight || 400}
                onChange={handleVariantChange}
                className={baseInputClasses}
                disabled={!currentFamily}
            >
                {currentFamily?.variants.map(variant => (
                    <option key={variant.weight} value={variant.weight}>
                        {variant.name}
                    </option>
                ))}
            </select>
        </InputField>
    </div>
  );
};

export default FontSelector;