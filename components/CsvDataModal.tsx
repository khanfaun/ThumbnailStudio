import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TextStyle } from '../types';
import { CloseIcon, TrashIcon, SplitIcon, UndoIcon, RedoIcon, PencilIcon } from './Icons';

interface CsvDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: { headers: string[], rows: Record<string, string>[] };
  onConfirm: (rows: Record<string, string>[], styleMappings: Record<string, string>) => void;
  textStyles: TextStyle[];
}

const TextareaCell: React.FC<{
    value: string;
    onChange: (value: string) => void;
    onSelect: (e: React.SyntheticEvent<HTMLTextAreaElement>) => void;
    onBlur: () => void;
}> = ({ value, onChange, onSelect, onBlur }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustHeight = useCallback(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, []);

    useEffect(() => {
        adjustHeight();
    }, [value, adjustHeight]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange(e.target.value);
    };

    return (
        <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onSelect={onSelect}
            onBlur={onBlur}
            className="w-full p-2 bg-transparent focus:bg-indigo-50 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none block text-sm"
            rows={1}
        />
    );
};

const LinkCell: React.FC<{
    value: string;
    onChange: (value: string) => void;
    onBlur: () => void;
}> = ({ value, onChange, onBlur }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [currentValue, setCurrentValue] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setCurrentValue(value);
    }, [value]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditing]);

    const handleConfirm = () => {
        setIsEditing(false);
        if (currentValue !== value) {
            onChange(currentValue);
            onBlur();
        }
    };

    if (isEditing) {
        return (
            <input
                ref={inputRef}
                type="text"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                onBlur={handleConfirm}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') handleConfirm();
                    if (e.key === 'Escape') {
                        setCurrentValue(value);
                        setIsEditing(false);
                    }
                }}
                className="w-full p-2 bg-indigo-50 outline-none ring-1 ring-indigo-500"
            />
        );
    }

    return (
        <div className="p-2 flex items-center justify-between group h-full cursor-text" onClick={() => setIsEditing(true)}>
            <a
                href={value.trim()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-indigo-600 hover:underline truncate"
                title={value.trim()}
            >
                Xem ảnh
            </a>
            <div className="h-4 w-4 text-slate-400 opacity-0 group-hover:opacity-100">
                <PencilIcon />
            </div>
        </div>
    );
};


const CsvDataModal: React.FC<CsvDataModalProps> = ({ isOpen, onClose, initialData, onConfirm, textStyles }) => {
  const [history, setHistory] = useState([{ headers: initialData.headers, rows: initialData.rows }]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const currentState = history[historyIndex];
  const { headers, rows } = currentState;

  const [liveRows, setLiveRows] = useState(rows);
  
  const [styleMappings, setStyleMappings] = useState<Record<string, string>>({});
  const [selection, setSelection] = useState<{ rowIndex: number; header: string; start: number; end: number } | null>(null);
  const [splitStyleId, setSplitStyleId] = useState<string>('');
  const [splitPopover, setSplitPopover] = useState<{ top: number; left: number } | null>(null);
  
  const activeInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      const initialState = { headers: initialData.headers, rows: initialData.rows };
      setHistory([initialState]);
      setHistoryIndex(0);
      setLiveRows(initialState.rows);
      setStyleMappings({});
      setSelection(null);
      setSplitStyleId('');
      setSplitPopover(null);
    }
  }, [isOpen, initialData]);
  
  useEffect(() => {
    setLiveRows(currentState.rows);
  }, [currentState]);


  if (!isOpen) return null;
  
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const pushState = useCallback((newState: { headers: string[], rows: Record<string, string>[] }) => {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newState);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const handleUndo = () => {
    if (canUndo) setHistoryIndex(prev => prev - 1);
  };

  const handleRedo = () => {
    if (canRedo) setHistoryIndex(prev => prev + 1);
  };

  const handleLiveRowChange = (rowIndex: number, header: string, value: string) => {
    const newRows = [...liveRows];
    newRows[rowIndex][header] = value;
    setLiveRows(newRows);
  };
  
  const commitChanges = () => {
    if (JSON.stringify(liveRows) !== JSON.stringify(rows) || JSON.stringify(headers) !== JSON.stringify(currentState.headers)) {
        pushState({ headers: headers, rows: liveRows });
    }
  };


  const handleDeleteRow = (rowIndex: number) => {
    const newRows = liveRows.filter((_, index) => index !== rowIndex);
    setLiveRows(newRows);
    pushState({ headers: headers, rows: newRows });
  };
  
  const handleInputSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>, rowIndex: number, header: string) => {
    const input = e.currentTarget;
    activeInputRef.current = input;
    if (input.selectionStart !== null && input.selectionEnd !== null && input.selectionStart !== input.selectionEnd) {
      setSelection({ rowIndex, header, start: input.selectionStart, end: input.selectionEnd });

      const mirror = document.createElement('div');
      const computedStyle = getComputedStyle(input);
      
      [
        'boxSizing', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 
        'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 
        'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
        'whiteSpace', 'wordWrap', 'wordBreak'
      ].forEach(prop => {
        (mirror.style as any)[prop] = computedStyle[prop as any];
      });

      mirror.style.position = 'absolute';
      mirror.style.visibility = 'hidden';
      mirror.style.left = '-9999px';
      mirror.style.top = '0px';
      mirror.style.width = `${input.clientWidth}px`;
      mirror.style.height = 'auto';
      mirror.textContent = input.value.substring(0, input.selectionEnd);

      const span = document.createElement('span');
      span.innerHTML = '&#8203;';
      mirror.appendChild(span);
      
      document.body.appendChild(mirror);

      const inputRect = input.getBoundingClientRect();
      const mirrorRect = mirror.getBoundingClientRect();
      const spanRect = span.getBoundingClientRect();
      
      document.body.removeChild(mirror);

      const top = inputRect.top + (spanRect.top - mirrorRect.top) - input.scrollTop;
      const left = inputRect.left + (spanRect.left - mirrorRect.left) - input.scrollLeft;
      
      setSplitPopover({ top, left: left + 8 });

    } else {
      setSelection(null);
      setSplitPopover(null);
    }
  };
  
  const handleStyleChange = (header: string, styleId: string) => {
    setStyleMappings(prev => ({ ...prev, [header]: styleId }));
  };

  const handleSplitText = () => {
    if (!selection) return;
    const { rowIndex, header, start, end } = selection;

    const originalText = liveRows[rowIndex][header];
    const textToSplit = originalText.substring(start, end);
    const remainingText = originalText.substring(0, start) + originalText.substring(end);

    let splitCounter = 1;
    let newHeader = `${header}_split_${splitCounter}`;
    while (headers.includes(newHeader)) {
        splitCounter++;
        newHeader = `${header}_split_${splitCounter}`;
    }
    
    if (splitStyleId) {
      handleStyleChange(newHeader, splitStyleId);
    }
    
    const headerIndex = headers.indexOf(header);
    const newHeaders = [...headers];
    newHeaders.splice(headerIndex + 1, 0, newHeader);
    
    const newRows = liveRows.map((row, index) => {
        const newRow = { ...row };
        if (index === rowIndex) {
            newRow[header] = remainingText;
            newRow[newHeader] = textToSplit;
        } else {
            newRow[newHeader] = '';
        }
        return newRow;
    });
    
    setSelection(null);
    setSplitPopover(null);
    setLiveRows(newRows);
    pushState({ headers: newHeaders, rows: newRows });

    setTimeout(() => {
        activeInputRef.current?.focus();
    }, 0);
  };

  const handleConfirm = () => {
    onConfirm(liveRows, styleMappings);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <header className="p-4 border-b border-slate-200 flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Chỉnh sửa dữ liệu CSV</h2>
            <p className="text-sm text-slate-500">Xem lại và chỉnh sửa nội dung trước khi tạo artboard.</p>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={handleUndo} disabled={!canUndo} className="p-2 rounded-md hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors" aria-label="Undo">
              <UndoIcon />
            </button>
            <button onClick={handleRedo} disabled={!canRedo} className="p-2 rounded-md hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors" aria-label="Redo">
              <RedoIcon />
            </button>
            <div className="w-px h-6 bg-slate-200 mx-1"></div>
            <select
              value={splitStyleId}
              onChange={(e) => setSplitStyleId(e.target.value)}
              className="bg-white p-2 rounded-md border border-slate-300 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 h-full"
              aria-label="Chọn style cho văn bản tách"
            >
              <option value="">Không có style</option>
              {textStyles.map(style => (
                  <option key={style.id} value={style.id}>{style.name}</option>
              ))}
            </select>
            <button
                onClick={handleSplitText}
                disabled={!selection}
                className="flex items-center justify-center bg-slate-700 hover:bg-slate-800 text-white font-semibold py-2 px-3 rounded-md transition-colors text-sm disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
                <SplitIcon />
                <span className="ml-2">Tách văn bản đã chọn</span>
            </button>
            <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:bg-slate-100"><CloseIcon /></button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm table-fixed">
              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr>
                  <th className="p-2 border border-slate-200 font-semibold text-slate-600 text-left w-12"></th>
                  {headers.map(header => (
                    <th key={header} className="p-2 border border-slate-200 font-semibold text-slate-600 text-left min-w-[200px]">
                      <div className="flex flex-col">
                        <span className="truncate">{header}</span>
                         {!header.startsWith('@') && (
                            <select
                              value={styleMappings[header] || ''}
                              onChange={(e) => handleStyleChange(header, e.target.value)}
                              className="mt-1 w-full bg-slate-100 p-1 rounded-md border border-slate-200 text-xs font-normal"
                            >
                              <option value="">Không có style</option>
                              {textStyles.map(style => (
                                <option key={style.id} value={style.id}>{style.name}</option>
                              ))}
                            </select>
                         )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {liveRows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-slate-50">
                    <td className="p-2 border border-slate-200 text-center align-top pt-3">
                      <button onClick={() => handleDeleteRow(rowIndex)} className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-100 rounded-full">
                        <TrashIcon />
                      </button>
                    </td>
                    {headers.map(header => (
                      <td key={`${rowIndex}-${header}`} className={`border border-slate-200 ${header.startsWith('@') ? 'align-middle' : 'align-top'}`}>
                        {header.startsWith('@') ? (
                            <LinkCell
                                value={row[header] || ''}
                                onChange={(value) => handleLiveRowChange(rowIndex, header, value)}
                                onBlur={commitChanges}
                            />
                        ) : (
                            <TextareaCell
                                value={row[header] || ''}
                                onChange={(value) => handleLiveRowChange(rowIndex, header, value)}
                                onSelect={(e) => handleInputSelect(e, rowIndex, header)}
                                onBlur={() => {
                                  commitChanges();
                                  setSplitPopover(null);
                                }}
                            />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>

        <footer className="p-4 border-t border-slate-200 flex justify-end items-center space-x-3 flex-shrink-0">
          <button onClick={onClose} className="py-2 px-4 rounded-md text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors">
            Hủy
          </button>
          <button onClick={handleConfirm} className="py-2 px-4 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">
            Tạo Artboards ({liveRows.length} sản phẩm)
          </button>
        </footer>
      </div>
      {splitPopover && selection && (
          <div
              className="fixed z-[60] bg-indigo-600/75 rounded-full p-2 shadow-lg cursor-pointer"
              style={{
                  top: splitPopover.top,
                  left: splitPopover.left,
                  transform: 'translateY(-50%)',
              }}
              onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSplitText();
              }}
              title="Tách văn bản"
          >
              <div className="flex items-center text-white">
                  <SplitIcon />
              </div>
          </div>
      )}
    </div>
  );
};

export default CsvDataModal;