import React, {useRef, useEffect, useState, memo} from 'react';
import { Artboard as ArtboardType, LayerType, TextLayer } from './types';
import EditorPanel from './components/EditorPanel';
import ArtboardComponent from './components/Artboard';
import ArtboardPreview from './components/ArtboardPreview';
import ExportModal from './components/ExportModal';
import StartupModal from './components/StartupModal';
import Toolbar from './components/Toolbar';
import ShortcutHelpModal from './components/ShortcutHelpModal';
import CsvDataModal from './components/CsvDataModal';
import CollapsiblePanel from './components/CollapsiblePanel';
// FIX: Import `GuideSettings` to correctly type the props for `GuideManagerModal`.
import { useAppLogic, GuideSettings } from './hooks/useAppLogic';
import ColorPicker from './components/ColorPicker';
import {
  GalleryIcon,
  ZoomInIcon,
  ZoomOutIcon,
  FitViewIcon,
  UndoIcon,
  RedoIcon,
  SaveIcon,
  LoadIcon,
  InfoIcon,
  CloseIcon,
  ResetIcon,
  TemplateIcon,
  ShortcutIcon,
  ExportStylesIcon,
  ImportStylesIcon,
  ArtboardsIcon,
  LayersIcon,
  TrashIcon,
  EyeIcon,
  EyeOffIcon,
  LockClosedIcon,
  LockOpenIcon,
  PlusIcon,
  DuplicateIcon,
  GuidesIcon,
  SnapIcon,
  AlignLeftIcon,
  AlignHCenterIcon,
  AlignRightIcon,
  AlignTopIcon,
  AlignVCenterIcon,
  AlignBottomIcon,
  DistributeVTopIcon,
  DistributeVCenterIcon,
  DistributeVBottomIcon,
  DistributeHLeftIcon,
  DistributeHCenterIcon,
  DistributeHRightIcon,
} from './components/Icons';
import { initialArtboards } from './constants';
import LayerPreview from './components/LayerPreview';


const splitCsvLines = (csvText: string): string[] => {
    const lines = []; let inQuote = false; let currentLine = '';
    for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i];
        if (char === '"') inQuote = !inQuote;
        if (char === '\n' && !inQuote) { lines.push(currentLine); currentLine = ''; }
        else { currentLine += char; }
    }
    lines.push(currentLine); return lines.filter(line => line.trim() !== '');
};

const parseCsv = (csvText: string): { headers: string[], rows: Record<string, string>[] } => {
    const lines = splitCsvLines(csvText.trim().replace(/\r/g, ''));
    if (lines.length < 1) return { headers: [], rows: [] };
    const headers = lines[0].split(',').map(h => h.trim());
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i]; if (!line.trim()) continue;
        const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        const rowObject: Record<string, string> = {};
        headers.forEach((header, index) => {
            let value = (values[index] || '').trim();
            if (value.startsWith('"') && value.endsWith('"')) value = value.substring(1, value.length - 1);
            rowObject[header] = value;
        });
        rows.push(rowObject);
    }
    return { headers, rows };
}

// --- Ruler Component ---
interface RulerProps {
  orientation: 'horizontal' | 'vertical';
  zoom: number;
  panOffset: number;
  containerSize: number;
  onGuideCreateStart: (pos: number, e: React.MouseEvent<HTMLCanvasElement>) => void;
}
const Ruler = memo<RulerProps>(({ orientation, zoom, panOffset, containerSize, onGuideCreateStart }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;

        if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.scale(dpr, dpr);
        }

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#f8fafc'; // bg-slate-50
        ctx.fillRect(0, 0, width, height);
        
        ctx.font = '10px Inter, sans-serif';
        ctx.fillStyle = '#64748b'; // text-slate-500
        ctx.strokeStyle = '#cbd5e1'; // border-slate-300

        if (orientation === 'vertical') {
            ctx.textAlign = 'right';
        } else {
            ctx.textAlign = 'left';
        }

        const intervals = [1, 5, 10, 25, 50, 100, 250, 500, 1000];
        const minGap = 50; // Minimum pixels between major ticks
        const optimalInterval = intervals.find(interval => interval * zoom > minGap) || 1000;

        const startValue = Math.floor(-panOffset / (optimalInterval * zoom)) * optimalInterval;
        
        for (let v = startValue; (v * zoom + panOffset) < (orientation === 'horizontal' ? width : height) ; v += optimalInterval) {
            const screenPos = Math.round(v * zoom + panOffset);
            
            // Major tick
            if (orientation === 'horizontal') {
                ctx.beginPath();
                ctx.moveTo(screenPos, height);
                ctx.lineTo(screenPos, height - 10);
                ctx.stroke();
                ctx.fillText(String(v), screenPos + 4, height - 12);
            } else {
                ctx.beginPath();
                ctx.moveTo(width, screenPos);
                ctx.lineTo(width - 10, screenPos);
                ctx.stroke();
                ctx.fillText(String(v), width - 4, screenPos + 10);
            }

            // Minor ticks
            const minorInterval = optimalInterval / 5;
            for(let i = 1; i < 5; i++) {
                const minorV = v + i * minorInterval;
                const minorScreenPos = Math.round(minorV * zoom + panOffset);
                if (orientation === 'horizontal') {
                    ctx.beginPath();
                    ctx.moveTo(minorScreenPos, height);
                    ctx.lineTo(minorScreenPos, height - 5);
                    ctx.stroke();
                } else {
                    ctx.beginPath();
                    ctx.moveTo(width, minorScreenPos);
                    ctx.lineTo(width - 5, minorScreenPos);
                    ctx.stroke();
                }
            }
        }
    }, [zoom, panOffset, containerSize, orientation]);

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const pos = orientation === 'horizontal' ? e.clientX - rect.left : e.clientY - rect.top;
        const artboardPos = (pos - panOffset) / zoom;
        onGuideCreateStart(artboardPos, e);
    };

    return <canvas ref={canvasRef} onMouseDown={handleMouseDown} className="w-full h-full cursor-pointer" />;
});


const App: React.FC = () => {
  const [ghostGuide, setGhostGuide] = useState<{ orientation: 'horizontal' | 'vertical', position: number } | null>(null);
  const ghostGuideRef = useRef<{ orientation: 'horizontal' | 'vertical', position: number } | null>(null);
  const [isGuideManagerOpen, setIsGuideManagerOpen] = useState(false);
  const editorWrapperRef = useRef<HTMLDivElement>(null);
  const [rulerSizes, setRulerSizes] = useState({ width: 0, height: 0 });
  const [isShortcutModalOpen, setIsShortcutModalOpen] = useState(false);
  const [csvData, setCsvData] = useState<{ headers: string[], rows: Record<string, string>[] } | null>(null);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  
  const [dragOverInfo, setDragOverInfo] = useState<{ id: string; position: 'top' | 'bottom' } | null>(null);
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingLayerName, setEditingLayerName] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const [editingArtboardId, setEditingArtboardId] = useState<string | null>(null);
  const [editingArtboardName, setEditingArtboardName] = useState('');
  const editArtboardInputRef = useRef<HTMLInputElement>(null);

  const {
    // State
    artboards,
    activeArtboard,
    selectedLayers,
    selectedLayer,
    viewMode,
    zoom,
    pan,
    canUndo,
    canRedo,
    showRecoveryToast,
    isExportModalOpen,
    artboardIdsToExport,
    selectionState,
    selectedLayerIds,
    keyObjectLayerId,
    alignTo,
    allFonts,
    customFonts,
    textStyles,
    shapeStyles,
    csvTemplateArtboardId,
    isStartupModalOpen,
    isChangeTemplateModalOpen,
    guideSettings,
    marqueeRect,
    
    // Setters
    setViewMode,
    setShowRecoveryToast,
    setIsExportModalOpen,
    setAlignTo,
    setSelectionState,
    setCsvTemplateArtboardId,
    setGuideSettings,

    // Refs
    editorContainerRef,
    isSpacePressedRef,

    // Handlers
    handleUndo,
    handleRedo,
    handleZoomChange,
    handleResetView,
    handlePanMouseDownOnEditor,
    handleSaveProject,
    handleLoadProject,
    handleResetProject,
    handleFontUpload,
    handleDeleteCustomFont,
    handleExportSelectionToggle,
    handleExportSelectAll,
    handleOpenExportModal,
    handleStartExport,
    updateArtboardAndCommit,
    // FIX: Add `updateLayerAndCommit` to the destructuring to resolve "Cannot find name" errors.
    updateLayerAndCommit,
    // FIX: Added `updateLayerLive` to the destructuring to make it available in the component.
    updateLayerLive,
    updateLayersLive,
    commitChanges,
    handleApplyStyleToSelection,
    handleToggleStyle,
    handleGenerateArtboardsFromCsv,
    handleAddArtboard,
    handleDeleteArtboard,
    handleDuplicateArtboard,
    addLayer,
    deleteLayer,
    handleDuplicateLayer,
    handleReorderLayer,
    handleToggleLayerVisibility,
    handleToggleLayerLock,
    handleLayerSelection,
    handleSelectArtboardForEditing,
    handleAlign,
    handleDistribute,
    handleSplitTextLayer,
    handleSaveTextStyle,
    handleApplyTextStyle,
    handleDeleteTextStyle,
    handleResetTextStyle,
    handleSaveShapeStyle,
    handleApplyShapeStyle,
    handleDeleteShapeStyle,
    handleCreateBlankProject,
    handleCreateProjectFromTemplate,
    handleOpenChangeTemplateModal,
    handleCloseChangeTemplateModal,
    handleChangeArtboardTemplate,
    handleClearArtboardContent,
    addGuide,
    handleSetGuides,
    handleClearGuides,
    handleDeleteAllLayers,
    handleToggleAllLayersVisibility,
    handleToggleAllLayersLock,
    handleSoloLayerVisibility,
    handleExportStyles,
    handleImportStyles,
  } = useAppLogic();

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
        if (entries[0]) {
            const { width, height } = entries[0].contentRect;
            setRulerSizes({ width, height });
        }
    });
    if (editorContainerRef.current) {
        observer.observe(editorContainerRef.current);
    }
    return () => observer.disconnect();
  }, []);
  
  useEffect(() => {
    if (editingLayerId && editInputRef.current) {
        editInputRef.current.focus();
        editInputRef.current.select();
    }
  }, [editingLayerId]);

  useEffect(() => {
    if (editingArtboardId && editArtboardInputRef.current) {
        editArtboardInputRef.current.focus();
        editArtboardInputRef.current.select();
    }
  }, [editingArtboardId]);

  const handleTriggerLoad = () => {
    const input = document.getElementById('load-project-input');
    input?.click();
  };

  const handleGuideCreateStart = (pos: number, e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const orientation: 'horizontal' | 'vertical' = e.currentTarget.parentElement?.classList.contains('ruler-h') ? 'horizontal' : 'vertical';

    const onMouseMove = (moveEvent: MouseEvent) => {
        if (!editorContainerRef.current) return;

        const rect = editorContainerRef.current.getBoundingClientRect();
        const newPos = orientation === 'horizontal' 
            ? (moveEvent.clientY - rect.top - pan.y) / zoom
            : (moveEvent.clientX - rect.left - pan.x) / zoom;
        
        const newGhostGuideData = { orientation, position: newPos };
        setGhostGuide(newGhostGuideData);
        ghostGuideRef.current = newGhostGuideData;
    };
    
    let hasMoved = false;
    const initialPos = pos;
    const onMouseMoveThrottled = (moveEvent: MouseEvent) => {
        if (!hasMoved) {
            const moveThreshold = 5; // pixels
            const delta = orientation === 'horizontal' ? Math.abs(moveEvent.clientY - e.clientY) : Math.abs(moveEvent.clientX - e.clientX);
            if (delta > moveThreshold) {
                hasMoved = true;
            }
        }
        if (hasMoved) {
            onMouseMove(moveEvent);
        }
    };

    const onMouseUp = () => {
        if (ghostGuideRef.current && hasMoved) {
            addGuide(ghostGuideRef.current.orientation, ghostGuideRef.current.position);
        }
        setGhostGuide(null);
        ghostGuideRef.current = null;
        window.removeEventListener('mousemove', onMouseMoveThrottled);
        window.removeEventListener('mouseup', onMouseUp);
    };
    
    window.addEventListener('mousemove', onMouseMoveThrottled);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const templateArtboard = artboards.find(a => a.id === csvTemplateArtboardId);
    if (!file || !templateArtboard) {
      if (!templateArtboard) alert("Vui lòng chọn một artboard mẫu.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target?.result as string;
            const parsedData = parseCsv(text);
            if (parsedData.rows.length === 0) { alert("Lỗi: File CSV trống hoặc không có dữ liệu."); return; }
            setCsvData(parsedData);
            setIsCsvModalOpen(true);
        } catch (error) {
            console.error("Lỗi xử lý file CSV:", error);
            alert("Đã xảy ra lỗi khi xử lý file CSV.");
        } finally { event.target.value = ''; }
    };
    reader.readAsText(file);
  };

  const handleConfirmCsvData = (editedRows: Record<string, string>[], styleMappings: Record<string, string>) => {
    const templateArtboard = artboards.find(a => a.id === csvTemplateArtboardId);
    if (templateArtboard) {
      handleGenerateArtboardsFromCsv(editedRows, templateArtboard, styleMappings);
      alert(`Đã tạo thành công ${editedRows.length} artboard mới từ artboard mẫu '${templateArtboard.name}'.`);
    }
    setIsCsvModalOpen(false);
  };
  
   const handleStartEditingName = (layer) => {
    if (layer.locked) return;
    const currentName = layer.name || 
        (layer.type === 'TEXT'
            ? layer.spans.map(s => s.text).join('').substring(0, 15) || 'Văn bản'
            : layer.type === 'IMAGE' ? 'Hình ảnh' : (layer.type === 'SHAPE' ? layer.shapeType.charAt(0) + layer.shapeType.slice(1).toLowerCase() : 'Đường thẳng'));
    setEditingLayerId(layer.id);
    setEditingLayerName(currentName);
  };

  const handleFinishEditingName = () => {
    if (editingLayerId) {
        updateLayerAndCommit(editingLayerId, { name: editingLayerName.trim() });
    }
    setEditingLayerId(null);
    setEditingLayerName('');
  };

  const handleCancelEditingName = () => {
    setEditingLayerId(null);
    setEditingLayerName('');
  };

  const handleStartEditingArtboardName = (artboard: ArtboardType) => {
    setEditingArtboardId(artboard.id);
    setEditingArtboardName(artboard.name);
  };

  const handleFinishEditingArtboardName = () => {
    if (editingArtboardId && editingArtboardName.trim()) {
        updateArtboardAndCommit(editingArtboardId, { name: editingArtboardName.trim() });
    }
    setEditingArtboardId(null);
    setEditingArtboardName('');
  };

  const handleCancelEditingArtboardName = () => {
    setEditingArtboardId(null);
    setEditingArtboardName('');
  };

  const handleDragStart = (e, layerId) => {
    setDraggedLayerId(layerId);
    e.dataTransfer.setData('text/plain', layerId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, targetLayerId) => {
      e.preventDefault();
      if (targetLayerId === draggedLayerId) {
          setDragOverInfo(null);
          return;
      }
      const rect = e.currentTarget.getBoundingClientRect();
      const middleY = rect.top + rect.height / 2;
      const position = e.clientY < middleY ? 'top' : 'bottom';
      if (dragOverInfo?.id !== targetLayerId || dragOverInfo?.position !== position) {
          setDragOverInfo({ id: targetLayerId, position });
      }
  };

  const handleDragLeave = () => {
      setDragOverInfo(null);
  };

  const handleDrop = (e, targetLayerId) => {
      e.preventDefault();
      const draggedId = e.dataTransfer.getData('text/plain');
      if (draggedId && draggedId !== targetLayerId && dragOverInfo) {
          const position = dragOverInfo.position === 'top' ? 'after' : 'before';
          handleReorderLayer(draggedId, targetLayerId, position);
      }
      setDragOverInfo(null);
      setDraggedLayerId(null);
  };

  const handleDragEnd = () => {
      setDragOverInfo(null);
      setDraggedLayerId(null);
  };

  const commonEditorProps = {
    artboards, activeArtboard, selectedLayer, selectedLayers,
    onArtboardSelect: handleSelectArtboardForEditing,
    onLayerSelect: handleLayerSelection, onUpdateArtboard: updateArtboardAndCommit,
    onUpdateLayer: updateLayerAndCommit, onAddLayer: addLayer, onDeleteLayer: deleteLayer,
    onDuplicateLayer: handleDuplicateLayer,
    onAddArtboard: handleAddArtboard, onDeleteArtboard: handleDeleteArtboard,
    onDuplicateArtboard: handleDuplicateArtboard,
    onReorderLayer: handleReorderLayer, 
    onToggleLayerVisibility: handleToggleLayerVisibility,
    onToggleLayerLock: handleToggleLayerLock,
    fonts: allFonts,
    customFonts,
    onFontUpload: handleFontUpload,
    onDeleteCustomFont: handleDeleteCustomFont,
    selectionState,
    onApplyStyleToSelection: handleApplyStyleToSelection,
    onToggleStyle: handleToggleStyle,
    selectedLayerIds, keyObjectLayerId,
    alignTo, setAlignTo, onAlign: handleAlign, onDistribute: handleDistribute,
    onSplitTextLayer: handleSplitTextLayer,
    textStyles,
    onSaveTextStyle: handleSaveTextStyle,
    onApplyTextStyle: handleApplyTextStyle,
    onDeleteTextStyle: handleDeleteTextStyle,
    onResetTextStyle: handleResetTextStyle,
    shapeStyles,
    onSaveShapeStyle: handleSaveShapeStyle,
    onApplyShapeStyle: handleApplyShapeStyle,
    onDeleteShapeStyle: handleDeleteShapeStyle,
    onOpenGuideManager: () => setIsGuideManagerOpen(true),
    guideSettings,
    onSettingsChange: setGuideSettings,
    onClearGuides: handleClearGuides,
    onDeleteAllLayers: handleDeleteAllLayers,
    onToggleAllLayersVisibility: handleToggleAllLayersVisibility,
    onToggleAllLayersLock: handleToggleAllLayersLock,
    onSoloLayerVisibility: handleSoloLayerVisibility,
    handleExportStyles,
    handleImportStyles,
  };
  
  const sortedLayers = activeArtboard ? [...activeArtboard.layers].sort((a,b) => b.zIndex - a.zIndex) : [];
  const areAllLayersHidden = activeArtboard ? activeArtboard.layers.length > 0 && activeArtboard.layers.every(l => !(l.visible ?? true)) : false;
  const areAllLayersLocked = activeArtboard ? activeArtboard.layers.length > 0 && activeArtboard.layers.every(l => l.locked) : false;
  
  const noteText = activeArtboard?.csvNote;

  const AlignButton = ({ children, onClick, title, disabled = false }: {children: React.ReactNode, onClick: () => void, title: string, disabled?: boolean}) => (
    <button
        onClick={onClick}
        title={title}
        disabled={disabled}
        className="p-1.5 rounded-md text-slate-600 hover:bg-white hover:text-indigo-600 transition-colors disabled:text-slate-300 disabled:hover:bg-transparent disabled:cursor-not-allowed"
    >
        {children}
    </button>
  );

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-100 text-slate-800 font-sans relative">
        <StartupModal
            isOpen={isStartupModalOpen}
            templates={initialArtboards}
            onSelectTemplate={handleCreateProjectFromTemplate}
            onCreateBlank={handleCreateBlankProject}
            onLoadProject={handleTriggerLoad}
        />
        {isCsvModalOpen && csvData && (
            <CsvDataModal
                isOpen={isCsvModalOpen}
                onClose={() => setIsCsvModalOpen(false)}
                initialData={csvData}
                onConfirm={handleConfirmCsvData}
                textStyles={textStyles}
            />
        )}
         <ShortcutHelpModal isOpen={isShortcutModalOpen} onClose={() => setIsShortcutModalOpen(false)} />
        {!isStartupModalOpen && <>
        <StartupModal
            isOpen={isChangeTemplateModalOpen}
            templates={initialArtboards}
            onSelectTemplate={handleChangeArtboardTemplate}
            onCreateBlank={handleClearArtboardContent}
            onClose={handleCloseChangeTemplateModal}
            title="Thay đổi mẫu Artboard"
            description="Nội dung artboard hiện tại sẽ được thay thế."
            onLoadProject={handleTriggerLoad}
        />
        <ExportModal 
            isOpen={isExportModalOpen}
            onClose={() => setIsExportModalOpen(false)}
            artboardsToExport={artboards.filter(a => artboardIdsToExport.includes(a.id))}
            onExport={handleStartExport}
        />
        {isGuideManagerOpen && activeArtboard && (
          <GuideManagerModal 
            artboard={activeArtboard}
            isOpen={isGuideManagerOpen} 
            onClose={() => setIsGuideManagerOpen(false)}
            onSetGuides={handleSetGuides}
            guideSettings={guideSettings}
            onSettingsChange={setGuideSettings}
          />
        )}
        {showRecoveryToast && (
            <div className="absolute top-4 right-4 z-50 bg-white rounded-lg shadow-lg p-4 flex items-start space-x-3 border border-slate-200">
                <div className="text-green-500 flex-shrink-0"><InfoIcon /></div>
                <div className="flex-1">
                    <p className="font-semibold text-slate-800">Khôi phục thành công!</p>
                    <p className="text-sm text-slate-600">Dữ liệu của bạn từ phiên làm việc trước đã được tải lại.</p>
                </div>
                <button onClick={() => setShowRecoveryToast(false)} className="text-slate-400 hover:text-slate-600">
                    <CloseIcon />
                </button>
            </div>
        )}
        <header className="flex-shrink-0 bg-white border-b border-slate-200 px-4 h-14 flex items-center justify-between z-20 shadow-sm">
            <div className="flex-1 flex items-center space-x-4">
                 <h1 className="text-lg font-bold text-slate-800">Thumbnail Studio</h1>
                 <div className="flex items-center space-x-1 border-l border-slate-200 pl-4">
                     <button
                        onClick={handleOpenChangeTemplateModal}
                        disabled={!activeArtboard}
                        title="Thay đổi mẫu cho Artboard hiện tại"
                        className="p-2 rounded-md hover:bg-slate-100 text-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Thay đổi mẫu"
                      >
                        <TemplateIcon />
                      </button>
                     <button onClick={handleSaveProject} title="Lưu Dự Án (Ctrl+S)" className="p-2 rounded-md hover:bg-slate-100 text-slate-600 transition-colors" aria-label="Lưu Dự Án">
                         <SaveIcon />
                     </button>
                     <input id="load-project-input" type="file" accept=".json,application/json" onChange={handleLoadProject} className="hidden" />
                     <label htmlFor="load-project-input" title="Tải Dự Án (Ctrl+O)" className="p-2 rounded-md hover:bg-slate-100 text-slate-600 cursor-pointer transition-colors" aria-label="Tải Dự Án">
                         <LoadIcon />
                     </label>
                      <div className="w-px h-6 bg-slate-200 mx-1"></div>
                     <button onClick={handleResetProject} title="Thiết lập lại (Ctrl+R)" className="p-2 rounded-md hover:bg-slate-100 text-slate-600 transition-colors" aria-label="Thiết lập lại ứng dụng">
                        <ResetIcon />
                     </button>
                     <button onClick={() => setIsShortcutModalOpen(true)} title="Phím tắt" className="p-2 rounded-md hover:bg-slate-100 text-slate-600 transition-colors" aria-label="Phím tắt">
                        <ShortcutIcon />
                     </button>
                 </div>
            </div>
             {viewMode === 'editor' && (
               <div className="flex-none flex items-center space-x-4 text-slate-600">
                  <div className="flex items-center space-x-1">
                    <button onClick={handleUndo} disabled={!canUndo} className="p-2 rounded-md hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors" aria-label="Undo">
                        <UndoIcon />
                    </button>
                    <button onClick={handleRedo} disabled={!canRedo} className="p-2 rounded-md hover:bg-slate-100 disabled:text-slate-300 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors" aria-label="Redo">
                        <RedoIcon />
                    </button>
                  </div>

                  {selectedLayers.length > 0 && <div className="w-px h-6 bg-slate-200"></div>}
                  
                  {selectedLayers.length > 0 && (
                    <div className="flex items-center space-x-0.5">
                        <AlignButton onClick={() => handleAlign('left')} title="Căn trái"><AlignLeftIcon /></AlignButton>
                        <AlignButton onClick={() => handleAlign('h-center')} title="Căn giữa ngang"><AlignHCenterIcon /></AlignButton>
                        <AlignButton onClick={() => handleAlign('right')} title="Căn phải"><AlignRightIcon /></AlignButton>
                        <div className="w-px h-5 bg-slate-300 mx-1"></div>
                        <AlignButton onClick={() => handleAlign('top')} title="Căn trên"><AlignTopIcon /></AlignButton>
                        <AlignButton onClick={() => handleAlign('v-center')} title="Căn giữa dọc"><AlignVCenterIcon /></AlignButton>
                        <AlignButton onClick={() => handleAlign('bottom')} title="Căn dưới"><AlignBottomIcon /></AlignButton>
                        
                        <div className="w-px h-5 bg-slate-300 mx-1"></div>

                        <AlignButton disabled={selectedLayers.length < 2} onClick={() => handleDistribute('h-dist-left')} title="Phân bố theo cạnh trái"><DistributeHLeftIcon /></AlignButton>
                        <AlignButton disabled={selectedLayers.length < 2} onClick={() => handleDistribute('h-dist-center')} title="Phân bố theo tâm ngang"><DistributeHCenterIcon /></AlignButton>
                        <AlignButton disabled={selectedLayers.length < 2} onClick={() => handleDistribute('h-dist-right')} title="Phân bố theo cạnh phải"><DistributeHRightIcon /></AlignButton>
                        <div className="w-px h-5 bg-slate-300 mx-1"></div>
                        <AlignButton disabled={selectedLayers.length < 2} onClick={() => handleDistribute('v-dist-top')} title="Phân bố theo cạnh trên"><DistributeVTopIcon /></AlignButton>
                        <AlignButton disabled={selectedLayers.length < 2} onClick={() => handleDistribute('v-dist-center')} title="Phân bố theo tâm dọc"><DistributeVCenterIcon /></AlignButton>
                        <AlignButton disabled={selectedLayers.length < 2} onClick={() => handleDistribute('v-dist-bottom')} title="Phân bố theo cạnh dưới"><DistributeVBottomIcon /></AlignButton>

                        {selectedLayers.length >= 2 && (
                            <div className="ml-2">
                                <select value={alignTo} onChange={(e) => setAlignTo(e.target.value as any)} className="bg-white p-2 h-full rounded-md border border-slate-300 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500">
                                    <option value="selection">Căn theo Vùng chọn</option>
                                    <option value="artboard">Căn theo Artboard</option>
                                </select>
                            </div>
                        )}
                    </div>
                  )}
              </div>
            )}
             <div className="flex-1 flex justify-end">
                {viewMode === 'editor' && (
                    <button onClick={() => setViewMode('gallery')} className="flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded-md transition-colors text-sm">
                        <GalleryIcon />
                        Quay lại Thư viện
                    </button>
                )}
            </div>
        </header>
        <div className="flex flex-1 overflow-hidden">
            {viewMode === 'gallery' ? (
                 <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
                    <div className="flex justify-between items-center mb-6">
                        <div className='flex items-center space-x-4'>
                            <h1 className="text-2xl font-bold text-slate-800">Thư viện Artboard</h1>
                            <div className="flex items-center space-x-2">
                                <input 
                                    type="checkbox" 
                                    id="select-all"
                                    className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                    checked={artboards.length > 0 && artboardIdsToExport.length === artboards.length}
                                    onChange={(e) => handleExportSelectAll(e.target.checked)}
                                />
                                <label htmlFor="select-all" className="text-sm font-medium text-slate-600">Chọn tất cả</label>
                            </div>
                            <button 
                                onClick={handleOpenExportModal} 
                                disabled={artboards.length === 0}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition-colors text-sm disabled:bg-slate-300 disabled:cursor-not-allowed"
                            >
                                Export {artboardIdsToExport.length > 0 ? `(${artboardIdsToExport.length})` : ''}
                            </button>
                        </div>
                        <div className="flex items-center space-x-4">
                             <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-slate-600">Mẫu:</span>
                                <select 
                                    value={csvTemplateArtboardId || ''} 
                                    onChange={(e) => setCsvTemplateArtboardId(e.target.value)}
                                    disabled={artboards.length === 0}
                                    className="bg-white p-2 rounded-md border border-slate-300 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                    aria-label="Chọn artboard mẫu"
                                >
                                    {artboards.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                                <label 
                                    htmlFor="csv-upload-gallery" 
                                    className={`inline-block text-center font-bold py-2 px-4 rounded-md transition-colors text-sm ${artboards.length === 0 ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white cursor-pointer'}`}
                                >
                                    Tạo từ CSV
                                </label>
                                <input 
                                    id="csv-upload-gallery" 
                                    type="file" 
                                    accept=".csv" 
                                    onChange={handleCsvUpload} 
                                    className="hidden" 
                                    disabled={artboards.length === 0}
                                />
                            </div>
                            <div className="w-px h-6 bg-slate-200"></div>
                            <button onClick={handleAddArtboard} title="Tạo Artboard Mới" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition-colors text-sm">
                               + Tạo Artboard Mới
                            </button>
                        </div>
                    </div>
                     <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                        {artboards.map(artboard => (
                            <ArtboardPreview 
                                key={artboard.id} 
                                artboard={artboard} 
                                onClick={() => handleSelectArtboardForEditing(artboard.id)} 
                                isSelected={artboardIdsToExport.includes(artboard.id)}
                                onSelectionToggle={handleExportSelectionToggle}
                            />
                        ))}
                    </div>
                    {artboards.length === 0 && (
                        <div className="col-span-full flex items-center justify-center h-full min-h-[50vh]">
                            <div className="text-center">
                                <p className="text-slate-500 mb-4">Chưa có artboard nào.</p>
                                <button onClick={handleAddArtboard} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md">
                                    Tạo Artboard Đầu Tiên
                                </button>
                            </div>
                        </div>
                    )}
                </main>
            ) : (
                <>
                    <main ref={editorWrapperRef} className="flex-1 flex flex-col overflow-hidden bg-slate-200/75 relative">
                        <div className="absolute top-1/2 -translate-y-1/2 left-12 z-10 flex flex-col space-y-2">
                            <CollapsiblePanel title="Artboards" icon={<ArtboardsIcon />} storageKey="panel-artboards-collapsed">
                                <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
                                    {artboards.map(a => {
                                        const isEditingArtboard = editingArtboardId === a.id;
                                        return (
                                        <div key={a.id} 
                                            onClick={() => !isEditingArtboard && handleSelectArtboardForEditing(a.id)}
                                            onDoubleClick={() => handleStartEditingArtboardName(a)}
                                            className={`p-2 rounded-md cursor-pointer flex justify-between items-center transition-colors text-sm font-medium ${activeArtboard?.id === a.id ? 'bg-indigo-100 text-indigo-900' : 'text-slate-700 hover:bg-slate-100'}`}>
                                            
                                            {isEditingArtboard ? (
                                                <input
                                                    ref={editArtboardInputRef}
                                                    type="text"
                                                    value={editingArtboardName}
                                                    onChange={(e) => setEditingArtboardName(e.target.value)}
                                                    onBlur={handleFinishEditingArtboardName}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleFinishEditingArtboardName();
                                                        if (e.key === 'Escape') handleCancelEditingArtboardName();
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-full bg-white p-1 -m-1 border border-indigo-500 rounded text-sm font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                />
                                            ) : (
                                                <span className="truncate pr-2">{a.name}</span>
                                            )}
                                            
                                            {!isEditingArtboard && (
                                              <div className="flex items-center space-x-0.5">
                                                  <button onClick={(e) => { e.stopPropagation(); handleDuplicateArtboard(a.id); }} className="p-1 rounded-full text-slate-400 hover:bg-indigo-100 hover:text-indigo-600" title="Nhân bản Artboard"><DuplicateIcon /></button>
                                                  <button onClick={(e) => { e.stopPropagation(); handleDeleteArtboard(a.id);}} className="p-1 rounded-full text-slate-400 hover:bg-red-100 hover:text-red-600"><TrashIcon /></button>
                                              </div>
                                            )}
                                        </div>
                                        )
                                    })}
                                </div>
                                <div className="p-2 flex items-center space-x-2">
                                    <button onClick={handleAddArtboard} className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-3 rounded-md transition-colors text-xs flex items-center justify-center">
                                        <PlusIcon /> <span className="ml-1">Thêm Artboard</span>
                                    </button>
                                </div>
                            </CollapsiblePanel>
                            {activeArtboard && (
                                <CollapsiblePanel
                                    title="Layers"
                                    icon={<LayersIcon />}
                                    storageKey="panel-layers-collapsed"
                                    headerContent={
                                        <div className="flex items-center justify-end space-x-1">
                                            <button onClick={handleToggleAllLayersVisibility} className="p-1.5 rounded-full hover:bg-slate-200 text-slate-500" title={areAllLayersHidden ? 'Hiện tất cả layer' : 'Ẩn tất cả layer'}>
                                                {areAllLayersHidden ? <EyeOffIcon /> : <EyeIcon />}
                                            </button>
                                            <button onClick={handleToggleAllLayersLock} className="p-1.5 rounded-full hover:bg-slate-200 text-slate-500" title={areAllLayersLocked ? 'Mở khóa tất cả layer' : 'Khóa tất cả layer'}>
                                                {areAllLayersLocked ? <LockClosedIcon /> : <LockOpenIcon />}
                                            </button>
                                            <button onClick={handleDeleteAllLayers} className="p-1.5 rounded-full text-slate-400 hover:bg-red-100 hover:text-red-600" title="Xóa tất cả layer">
                                                <TrashIcon />
                                            </button>
                                        </div>
                                    }
                                >
                                    <div className="space-y-1 p-2 max-h-96 overflow-y-auto">
                                    {sortedLayers.map(l => {
                                        const isEditing = editingLayerId === l.id;
                                        const layerName = l.name || (l.type === 'TEXT'
                                            ? l.spans.map(s => s.text).join('').substring(0, 15) || 'Văn bản'
                                            : l.type === 'IMAGE' ? 'Hình ảnh' : l.type === 'SHAPE' ? l.shapeType.charAt(0) + l.shapeType.slice(1).toLowerCase() : 'Đường thẳng');
                                        const isSelected = selectedLayerIds.includes(l.id);
                                        const isVisible = l.visible ?? true;
                                        return (
                                        <div 
                                            key={l.id} 
                                            onClick={(e) => !l.locked && handleLayerSelection(l.id, { isCtrl: e.ctrlKey || e.metaKey, isShift: e.shiftKey }, 'panel')}
                                            className={`relative p-2 rounded-md flex items-center transition-all duration-150 text-sm font-medium ${isSelected ? 'bg-indigo-100 text-indigo-900' : 'text-slate-700'} ${l.locked ? 'cursor-not-allowed text-slate-500' : 'cursor-pointer hover:bg-slate-100'} ${!isVisible ? 'opacity-50' : ''} ${draggedLayerId === l.id ? 'opacity-30' : ''}`}
                                            draggable={!l.locked}
                                            onDragStart={(e) => handleDragStart(e, l.id)}
                                            onDragOver={(e) => handleDragOver(e, l.id)}
                                            onDragLeave={handleDragLeave}
                                            onDrop={(e) => handleDrop(e, l.id)}
                                            onDragEnd={handleDragEnd}
                                        >
                                            {dragOverInfo?.id === l.id && dragOverInfo.position === 'top' && <div className="absolute top-0 left-2 right-2 h-1 bg-indigo-500 z-10 rounded-full" />}
                                            <div className="flex-shrink-0 w-10 h-8 mr-3 bg-slate-200 rounded-sm overflow-hidden border border-slate-300 flex items-center justify-center">
                                                <LayerPreview layer={l} />
                                            </div>
                                            <div className="flex-grow flex justify-between items-center min-w-0">
                                                {isEditing ? (
                                                    <input
                                                        ref={editInputRef}
                                                        type="text"
                                                        value={editingLayerName}
                                                        onChange={(e) => setEditingLayerName(e.target.value)}
                                                        onBlur={handleFinishEditingName}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleFinishEditingName();
                                                            if (e.key === 'Escape') handleCancelEditingName();
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="w-full bg-white p-1 -m-1 border border-indigo-500 rounded text-sm font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                    />
                                                ) : (
                                                    <span
                                                        onDoubleClick={() => handleStartEditingName(l)}
                                                        className="truncate pr-2"
                                                        title={layerName}
                                                    >
                                                        {layerName}
                                                    </span>
                                                )}
                                                <div className="flex items-center space-x-0.5 flex-shrink-0">
                                                    <button onClick={(e)=>{e.stopPropagation(); if (e.altKey) { handleSoloLayerVisibility(l.id); } else { handleToggleLayerVisibility(l.id); }}} className="p-1 rounded-full hover:bg-slate-200 text-slate-500" title={isVisible ? 'Ẩn Layer (Giữ Alt để ẩn các layer khác)' : 'Hiện Layer'}>
                                                        {isVisible ? <EyeIcon /> : <EyeOffIcon />}
                                                    </button>
                                                    <button onClick={(e)=>{e.stopPropagation(); handleDuplicateLayer(l.id)}} className="p-1 rounded-full hover:bg-slate-200 text-slate-500 disabled:text-slate-300 disabled:hover:bg-transparent" disabled={l.locked} title="Nhân bản Layer"><DuplicateIcon/></button>
                                                    <button onClick={(e)=>{e.stopPropagation(); handleToggleLayerLock(l.id)}} className="p-1 rounded-full hover:bg-slate-200 text-slate-500" title={l.locked ? 'Mở khóa Layer' : 'Khóa Layer'}>
                                                        {l.locked ? <LockClosedIcon /> : <LockOpenIcon />}
                                                    </button>
                                                    <button onClick={(e) => { e.stopPropagation(); deleteLayer(l.id) }} className="p-1 rounded-full text-slate-400 hover:bg-red-100 hover:text-red-600 disabled:text-slate-300 disabled:hover:bg-transparent" disabled={l.locked}><TrashIcon/></button>
                                                </div>
                                            </div>
                                            {dragOverInfo?.id === l.id && dragOverInfo.position === 'bottom' && <div className="absolute bottom-0 left-2 right-2 h-1 bg-indigo-500 z-10 rounded-full" />}
                                        </div>
                                        );
                                    })}
                                    </div>
                                </CollapsiblePanel>
                            )}
                        </div>
                         <Toolbar onAddLayer={addLayer} />
                         <div className="flex-shrink-0 flex">
                            <div className="w-8 h-8 bg-white border-r border-b border-slate-300 flex-shrink-0"></div>
                            <div className="flex-1 overflow-hidden relative ruler-h h-8">
                                <Ruler orientation="horizontal" zoom={zoom} panOffset={pan.x} containerSize={rulerSizes.width} onGuideCreateStart={handleGuideCreateStart} />
                            </div>
                        </div>
                        <div className="flex flex-1 overflow-hidden">
                            <div className="w-8 flex-shrink-0 overflow-hidden relative ruler-v">
                                <Ruler orientation="vertical" zoom={zoom} panOffset={pan.y} containerSize={rulerSizes.height} onGuideCreateStart={handleGuideCreateStart} />
                            </div>
                            <div 
                                ref={editorContainerRef}
                                className="flex-1 overflow-hidden relative"
                                onMouseDown={handlePanMouseDownOnEditor}
                            >
                                 <div className="absolute top-0 left-0" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'top left' }}>
                                     {activeArtboard ? (
                                        <ArtboardComponent
                                            artboard={activeArtboard}
                                            isActive={true}
                                            selectedLayerIds={selectedLayerIds}
                                            keyObjectLayerId={keyObjectLayerId}
                                            onSelectArtboard={() => {
                                                if(activeArtboard.id !== activeArtboard.id) {
                                                }
                                            }}
                                            onLayerSelection={handleLayerSelection}
                                            onUpdateLayerLive={updateLayerLive}
                                            onUpdateLayersLive={updateLayersLive}
                                            onUpdateLayerAndCommit={updateLayerAndCommit}
                                            onUpdateArtboard={updateArtboardAndCommit}
                                            onInteractionEnd={commitChanges}
                                            zoom={zoom}
                                            onSelectionChange={setSelectionState}
                                            selectionState={selectionState}
                                            guideSettings={guideSettings}
                                            onDuplicateLayer={handleDuplicateLayer}
                                            isSpacePressedRef={isSpacePressedRef}
                                        />
                                    ) : (
                                         <div className="text-center absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                                            <p className="text-slate-500 mb-4">Chọn hoặc tạo một artboard để bắt đầu.</p>
                                            <button onClick={handleAddArtboard} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md">
                                                Tạo Artboard Mới
                                            </button>
                                        </div>
                                    )}
                                 </div>
                                {ghostGuide && activeArtboard && (
                                    <div 
                                        className={`guide-line ${ghostGuide.orientation} pointer-events-none`} 
                                        style={{
                                            backgroundColor: guideSettings.color,
                                            opacity: 0.5,
                                            ...(ghostGuide.orientation === 'horizontal' 
                                                ? { top: (ghostGuide.position * zoom) + pan.y, left: 0, right: 0, height: '1px' } 
                                                : { left: (ghostGuide.position * zoom) + pan.x, top: 0, bottom: 0, width: '1px' })
                                        }}
                                    />
                                )}
                                {marqueeRect && (
                                    <div
                                        className="absolute border border-indigo-500 bg-indigo-500/20 pointer-events-none"
                                        style={{
                                            left: marqueeRect.x,
                                            top: marqueeRect.y,
                                            width: marqueeRect.width,
                                            height: marqueeRect.height,
                                        }}
                                    />
                                )}
                                 <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-md flex items-center p-1 text-slate-700 z-10">
                                    <button onClick={() => handleZoomChange(zoom - 0.2)} title="Zoom Out (Ctrl+-)" className="p-2 rounded-md hover:bg-slate-100" aria-label="Zoom Out"><ZoomOutIcon/></button>
                                    <div className="w-16 text-center text-sm font-medium">{Math.round(zoom * 100)}%</div>
                                    <button onClick={() => handleZoomChange(zoom + 0.2)} title="Zoom In (Ctrl+=)" className="p-2 rounded-md hover:bg-slate-100" aria-label="Zoom In"><ZoomInIcon/></button>
                                    <div className="w-px h-5 bg-slate-200 mx-1"></div>
                                    <button onClick={handleResetView} title="Fit View" className="p-2 rounded-md hover:bg-slate-100" aria-label="Fit View"><FitViewIcon/></button>
                                </div>
                            </div>
                        </div>
                        <div className="absolute top-12 right-4 bottom-4 z-10 flex flex-col items-end">
                           <div>
                                <EditorPanel position="right" {...commonEditorProps} />
                           </div>
                           {activeArtboard && (
                                <div className="w-80 bg-white rounded-lg shadow-md border border-slate-200 text-sm mt-auto">
                                    <div className="w-full flex justify-between items-center p-2 text-left font-bold text-slate-800 border-b border-slate-200">
                                        <div className="flex items-center space-x-2">
                                            <div className="p-1 bg-slate-100 rounded text-slate-600"><InfoIcon /></div>
                                            <span>Note</span>
                                        </div>
                                    </div>
                                    <div className="p-3 text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 m-2 rounded-md border border-slate-200 min-h-[4rem]">
                                        {noteText && noteText.trim() !== '' ? (
                                            noteText
                                        ) : (
                                            <span className="text-slate-400 italic">Không có ghi chú từ file CSV cho artboard này.</span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </main>
                </>
            )}
        </div>
        </>}
    </div>
  );
};


interface GuideManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    artboard: ArtboardType;
    onSetGuides: (guides: { orientation: 'horizontal' | 'vertical', position: number }[], clearExisting: boolean) => void;
    guideSettings: GuideSettings;
    onSettingsChange: (settings: GuideSettings) => void;
}

const GuideManagerModal: React.FC<GuideManagerModalProps> = ({ isOpen, onClose, artboard, onSetGuides, guideSettings, onSettingsChange }) => {
    const [offsets, setOffsets] = useState({ top: '', left: '', bottom: '', right: '' });
    const [clearExisting, setClearExisting] = useState(true);

    if (!isOpen) return null;

    const handleAdd = () => {
        const guidesToAdd: { orientation: 'horizontal' | 'vertical'; position: number }[] = [];
        if (offsets.top) guidesToAdd.push({ orientation: 'horizontal', position: parseFloat(offsets.top) });
        if (offsets.left) guidesToAdd.push({ orientation: 'vertical', position: parseFloat(offsets.left) });
        if (offsets.bottom) guidesToAdd.push({ orientation: 'horizontal', position: artboard.height - parseFloat(offsets.bottom) });
        if (offsets.right) guidesToAdd.push({ orientation: 'vertical', position: artboard.width - parseFloat(offsets.right) });
    
        if (guidesToAdd.length > 0 || clearExisting) {
            onSetGuides(guidesToAdd, clearExisting);
        }
        
        setOffsets({ top: '', left: '', bottom: '', right: '' });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
                <h2 className="text-xl font-bold text-slate-800">Quản lý đường gióng (Guides)</h2>
                
                <div className="space-y-3 pt-2 border-t">
                    <h3 className="text-sm font-semibold text-slate-600">Thêm đường gióng mới</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <input type="number" placeholder="Cách lề trên (px)" value={offsets.top} onChange={e => setOffsets(s => ({ ...s, top: e.target.value }))} className="w-full bg-slate-100 p-2 rounded-md border border-slate-200 text-sm" />
                        <input type="number" placeholder="Cách lề trái (px)" value={offsets.left} onChange={e => setOffsets(s => ({ ...s, left: e.target.value }))} className="w-full bg-slate-100 p-2 rounded-md border border-slate-200 text-sm" />
                        <input type="number" placeholder="Cách lề dưới (px)" value={offsets.bottom} onChange={e => setOffsets(s => ({ ...s, bottom: e.target.value }))} className="w-full bg-slate-100 p-2 rounded-md border border-slate-200 text-sm" />
                        <input type="number" placeholder="Cách lề phải (px)" value={offsets.right} onChange={e => setOffsets(s => ({ ...s, right: e.target.value }))} className="w-full bg-slate-100 p-2 rounded-md border border-slate-200 text-sm" />
                    </div>
                    <div className="flex items-center">
                        <input id="clear-guides-check" type="checkbox" checked={clearExisting} onChange={e => setClearExisting(e.target.checked)} className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300" />
                        <label htmlFor="clear-guides-check" className="ml-2 text-sm text-slate-700">Xóa các đường gióng cũ khi tạo</label>
                    </div>
                     <button onClick={handleAdd} className="w-full py-2 px-4 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 transition-colors">Tạo đường gióng</button>
                </div>

                <div className="space-y-3 pt-3 border-t">
                    <h3 className="text-sm font-semibold text-slate-600">Cài đặt chung</h3>
                    <ColorPicker label="Màu đường gióng" value={guideSettings.color} onChange={color => onSettingsChange({ ...guideSettings, color })} />
                    <div className="flex items-center">
                        <input id="lock-guides-check" type="checkbox" checked={guideSettings.locked} onChange={e => onSettingsChange({ ...guideSettings, locked: e.target.checked })} className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300" />
                        <label htmlFor="lock-guides-check" className="ml-2 text-sm text-slate-700">Khóa đường gióng (không thể di chuyển)</label>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button onClick={onClose} className="py-2 px-4 rounded-md text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors">
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
};

export default App;