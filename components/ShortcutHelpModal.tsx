import React from 'react';
import { CloseIcon } from './Icons';

interface ShortcutHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ShortcutHelpModal: React.FC<ShortcutHelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { keys: ['Ctrl', 'S'], description: 'Lưu dự án' },
    { keys: ['Ctrl', 'O'], description: 'Tải dự án' },
    { keys: ['Ctrl', 'R'], description: 'Thiết lập lại dự án' },
    { keys: ['Ctrl', 'Z'], description: 'Hoàn tác (Undo)' },
    { keys: ['Ctrl', 'Y'], description: 'Làm lại (Redo)' },
    { keys: ['Ctrl', 'J'], description: 'Nhân bản layer đã chọn' },
    { keys: ['Ctrl', '+/-'], description: 'Phóng to / Thu nhỏ' },
    { keys: ['Alt', 'Lăn chuột'], description: 'Phóng to / Thu nhỏ (10%)' },
    { keys: ['Phím mũi tên'], description: 'Di chuyển đối tượng đã chọn' },
    { keys: ['Shift', 'Phím mũi tên'], description: 'Di chuyển đối tượng nhanh hơn (10px)' },
    { keys: ['Space', 'Kéo chuột'], description: 'Di chuyển khung nhìn (Pan)' },
    { keys: ['Alt', 'Kéo layer'], description: 'Nhân bản layer khi di chuyển' },
    { keys: ['Delete / Backspace'], description: 'Xóa đối tượng đã chọn' },
    { keys: ['Ctrl', ';'], description: 'Ẩn / Hiện đường gióng (Guides)' },
    { keys: ['Ctrl', 'Click vào layer'], description: 'Chọn/Bỏ chọn nhiều layer' },
    { keys: ['Shift', 'Click vào layer'], description: 'Chọn một dãy layer' },
  ];

  const Key = ({ children }: { children: React.ReactNode }) => (
    <kbd className="px-2 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 border border-slate-200 rounded-md">
      {children}
    </kbd>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800">Phím tắt</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2 rounded-full -mr-2 -mt-2"><CloseIcon /></button>
        </div>
        <div className="space-y-2 pt-2 border-t max-h-[60vh] overflow-y-auto pr-2">
            {shortcuts.map((shortcut, index) => (
                <div key={index} className="flex justify-between items-center py-2.5 border-b border-slate-100">
                    <p className="text-slate-700">{shortcut.description}</p>
                    <div className="flex items-center space-x-2">
                        {shortcut.keys.map((key, i) => (
                           <React.Fragment key={i}>
                             <Key>{key}</Key>
                             {i < shortcut.keys.length - 1 && <span className="text-slate-400">+</span>}
                           </React.Fragment>
                        ))}
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default ShortcutHelpModal;