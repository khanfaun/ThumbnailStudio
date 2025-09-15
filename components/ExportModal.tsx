import React, { useState } from 'react';
import { Artboard } from '../types';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  artboardsToExport: Artboard[];
  onExport: (options: ExportOptions) => Promise<void>;
}

export interface ExportOptions {
  format: 'png' | 'jpeg';
  limitSize: boolean;
  maxSizeKb: number;
}

const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, artboardsToExport, onExport }) => {
  const [format, setFormat] = useState<'png' | 'jpeg'>('png');
  const [limitSize, setLimitSize] = useState(false);
  const [maxSizeKb, setMaxSizeKb] = useState(500);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleExportClick = async () => {
    setIsLoading(true);
    try {
      await onExport({ format, limitSize, maxSizeKb });
    } catch (error) {
      console.error("Export failed:", error);
      alert("An error occurred during export. Check the console for details.");
    } finally {
      setIsLoading(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-slate-800">Tùy chọn xuất ảnh</h2>
        <p className="text-sm text-slate-600">
          Bạn sắp xuất {artboardsToExport.length} artboard.
        </p>
        
        {/* Format Options */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Định dạng</label>
          <div className="flex space-x-4">
            <label className="flex items-center">
              <input type="radio" name="format" value="png" checked={format === 'png'} onChange={() => setFormat('png')} className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"/>
              <span className="ml-2 text-sm text-slate-800">PNG</span>
            </label>
            <label className="flex items-center">
              <input type="radio" name="format" value="jpeg" checked={format === 'jpeg'} onChange={() => setFormat('jpeg')} className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"/>
              <span className="ml-2 text-sm text-slate-800">JPG</span>
            </label>
          </div>
        </div>

        {/* Size Limit Options */}
        <div className="space-y-2">
          <label className="flex items-center">
            <input type="checkbox" checked={limitSize} onChange={(e) => setLimitSize(e.target.checked)} className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"/>
            <span className="ml-2 text-sm text-slate-800">Giới hạn dung lượng file (ước tính)</span>
          </label>
          {limitSize && (
            <div className="flex items-center space-x-2 pl-6">
              <input type="number" value={maxSizeKb} onChange={(e) => setMaxSizeKb(parseInt(e.target.value, 10) || 0)} className="w-24 bg-slate-100 p-2 rounded-md border border-slate-200 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm" />
              <span className="text-sm text-slate-600">KB</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4">
          <button onClick={onClose} className="py-2 px-4 rounded-md text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors">
            Hủy
          </button>
          <button onClick={handleExportClick} disabled={isLoading} className="py-2 px-4 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 transition-colors">
            {isLoading ? 'Đang xuất...' : `Xuất ${artboardsToExport.length} file`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
