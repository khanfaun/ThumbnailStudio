import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Artboard as ArtboardType, Layer, LayerType, TextLayer, ImageLayer, TextSpan, FontFamily, FontVariant, TextStyle, ShapeType, RectangleShapeLayer, EllipseShapeLayer, PolygonShapeLayer, AnyShapeLayer, ShapeStyle, Guide, LineLayer, LineEndCapShape } from '../types';
import { initialArtboards } from '../constants';
import { staticFonts } from '../fonts';
import { useHistoryState } from './useHistoryState';
import { AUTOSAVE_KEY, loadStateFromLocalStorage } from '../utils/localStorage';
import { applyTextStyle, mergeSpans, getSpansForRange, removeRangeFromSpans, calculateTextRangePosition, calculateTextDimensions, getStyleStateForRange, getPropertyStateForRange } from '../utils/text';
import { renderArtboardToCanvas, getCanvasBlob, downloadBlob } from '../utils/canvas';
import { ExportOptions } from '../components/ExportModal';

declare var JSZip: any;

export type ViewMode = 'gallery' | 'editor';
export type AlignTo = 'selection' | 'artboard';

export interface GuideSettings {
  visible: boolean;
  locked: boolean;
  color: string;
  snapToGuides: boolean;
}

// FIX: Defined a more accurate type for reporting selection styles, allowing 'mixed' states.
export interface SelectionStyleInfo {
    fontFamily?: string | 'mixed';
    fontSize?: number | 'mixed';
    color?: string | 'mixed';
    fontWeight?: number | 'mixed';
    underline?: boolean | 'mixed';
    strikethrough?: boolean | 'mixed';
    textScript?: 'normal' | 'superscript' | 'mixed';
    textTransform?: 'none' | 'uppercase' | 'mixed';
}

export interface SelectionState {
  layerId: string;
  styles: SelectionStyleInfo;
  hasSelection: boolean;
  range?: { start: number; end: number };
}

const loadedState = loadStateFromLocalStorage();

const defaultTextStyle: TextStyle = {
  id: 'default-style-orange-title-1',
  name: 'Tiêu đề Cam',
  fontFamily: 'Roc Grotesk VN',
  fontWeight: 800,
  fontSize: 56,
  textAlign: 'center',
  color: '#F97316',
  strokes: [
    {
      id: `stroke-${Date.now()}-1`,
      color: '#FFFFFF',
      width: 3,
    }
  ]
};

const initialAppState = loadedState ? loadedState.artboards : initialArtboards;
const initialCustomFonts = loadedState ? loadedState.customFonts : [];
const initialTextStyles = loadedState ? loadedState.textStyles : [defaultTextStyle];
const initialShapeStyles = loadedState ? loadedState.shapeStyles : [];
const hasLoadedState = !!loadedState;


const generateNewDataId = (baseId: string, allLayers: Layer[]): string => {
    const existingDataIds = new Set(allLayers.map(l => l.dataId).filter(Boolean));
    
    const match = baseId.match(/^(.*?)(\d+)$/);
    let baseName = baseId;
    let counter = 1;

    if (match) {
        baseName = match[1];
        counter = parseInt(match[2], 10) + 1;
    }

    let newId = `${baseName}${counter}`;
    if (!match) {
        newId = `${baseName}${counter}`;
    }

    while (existingDataIds.has(newId)) {
        counter++;
        newId = `${baseName}${counter}`;
    }
    return newId;
};

export const useAppLogic = () => {
    const [historyArtboards, setHistoryArtboards, undo, redo, resetHistoryArtboards, canUndo, canRedo] = useHistoryState<ArtboardType[]>(initialAppState);
    const [artboards, setArtboards] = useState(historyArtboards); 
    
    const [customFonts, setCustomFonts] = useState<FontFamily[]>([]);
    const [textStyles, setTextStyles] = useState<TextStyle[]>(initialTextStyles);
    const [shapeStyles, setShapeStyles] = useState<ShapeStyle[]>(initialShapeStyles || []);
    const allFonts = useMemo(() => [...staticFonts, ...customFonts], [customFonts]);
    const [guideSettings, setGuideSettings] = useState<GuideSettings>({ visible: true, locked: true, color: '#0ea5e9' /* sky-500 */, snapToGuides: true });

    const artboardsRef = useRef(artboards);
    artboardsRef.current = artboards;
  
    const isInteracting = useRef(false);
  
    const [activeArtboardId, setActiveArtboardId] = useState<string | null>(artboards.length > 0 ? artboards[0].id : null);
    const [selectedLayerIds, setSelectedLayerIds] = useState<string[]>([]);
    const [keyObjectLayerId, setKeyObjectLayerId] = useState<string | null>(null);
    const [alignTo, setAlignTo] = useState<AlignTo>('selection');
  
    const [viewMode, setViewMode] = useState<ViewMode>('gallery');
    const [isStartupModalOpen, setIsStartupModalOpen] = useState(!hasLoadedState);
    const [isChangeTemplateModalOpen, setIsChangeTemplateModalOpen] = useState(false);
    const [selectionState, setSelectionState] = useState<SelectionState | null>(null);
  
    const [showRecoveryToast, setShowRecoveryToast] = useState(!!loadedState);
  
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [artboardIdsToExport, setArtboardIdsToExport] = useState<string[]>([]);
    const [csvTemplateArtboardId, setCsvTemplateArtboardId] = useState<string | null>(initialAppState.length > 0 ? initialAppState[0].id : null);
  
    const selectionStateRef = useRef(selectionState);
    selectionStateRef.current = selectionState;
    const selectedLayerIdsRef = useRef(selectedLayerIds);
    selectedLayerIdsRef.current = selectedLayerIds;
  
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const isSpacePressedRef = useRef(false);
    const panStartRef = useRef({ x: 0, y: 0 });
    const [lastClickedLayerId, setLastClickedLayerId] = useState<string | null>(null);
    const [marqueeRect, setMarqueeRect] = useState<{x: number, y: number, width: number, height: number} | null>(null);

    useEffect(() => {
        const artboardExists = artboards.some(a => a.id === csvTemplateArtboardId);
        if ((!csvTemplateArtboardId || !artboardExists) && artboards.length > 0) {
            setCsvTemplateArtboardId(artboards[0].id);
        }
    }, [artboards, csvTemplateArtboardId]);
  
    useEffect(() => {
      try {
          const stateToSave = { artboards: historyArtboards, customFonts, textStyles, shapeStyles };
          localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(stateToSave));
      } catch (error) {
          console.error("Lỗi khi tự động lưu vào Local Storage:", error);
      }
    }, [historyArtboards, customFonts, textStyles, shapeStyles]);
  
    useEffect(() => {
      if (!isInteracting.current && !isStartupModalOpen) {
        setArtboards(historyArtboards);
      }
    }, [historyArtboards, isStartupModalOpen]);
  
    useEffect(() => {
      if (showRecoveryToast) {
          const timer = setTimeout(() => {
              setShowRecoveryToast(false);
          }, 5000);
          return () => clearTimeout(timer);
      }
    }, [showRecoveryToast]);
  
    const activeArtboard = artboards.find(a => a.id === activeArtboardId);
    const selectedLayers = activeArtboard?.layers.filter(l => selectedLayerIds.includes(l.id)) || [];
    const selectedLayer = selectedLayers.length === 1 ? selectedLayers[0] : undefined;
    
    const loadFonts = useCallback(async (fontsToLoad: FontFamily[]) => {
      for (const family of fontsToLoad) {
        for (const variant of family.variants) {
          if (variant.url) {
            try {
              const font = new FontFace(family.name, `url(${variant.url})`, {
                weight: variant.weight.toString(),
                style: variant.style,
              });
              await font.load();
              document.fonts.add(font);
            } catch (error) {
              console.error(`Lỗi tải font: ${family.name} ${variant.name}`, error);
            }
          }
        }
      }
    }, []);

    useEffect(() => {
      if (!isStartupModalOpen) {
        loadFonts(staticFonts);
      }
      if(initialCustomFonts.length > 0){
        loadFonts(initialCustomFonts).then(() => {
          setCustomFonts(initialCustomFonts);
        });
      }
    }, [loadFonts, isStartupModalOpen]);
  
    // FIX: Moved these functions higher in the hook to fix a "used before declaration" error.
    // Handlers like `handleDeleteSelectedLayers` were defined before these and caused a crash.
    const updateArtboardAndCommit = useCallback((artboardId: string, updates: Partial<ArtboardType>) => {
      const updater = (prev: ArtboardType[]) => prev.map(a => (a.id === artboardId ? { ...a, ...updates } : a));
      setHistoryArtboards(updater);
    }, [setHistoryArtboards]);
  
    const updateLayerAndCommit = useCallback((layerId: string, updates: Partial<Layer>) => {
      if (!activeArtboardId) return;
      const updater = (prev: ArtboardType[]) => prev.map(a =>
          a.id === activeArtboardId
            ? {
                ...a,
                layers: a.layers.map(l =>
                  l.id === layerId ? { ...l, ...updates } as Layer : l
                ),
              }
            : a
        );
      setHistoryArtboards(updater);
      setArtboards(updater);
    }, [activeArtboardId, setHistoryArtboards]);
  
    const updateLayersAndCommit = useCallback((layerUpdates: { id: string, updates: Partial<Layer> }[]) => {
        if (!activeArtboardId || layerUpdates.length === 0) return;
        const updater = (prevArtboards: ArtboardType[]) => prevArtboards.map(a => {
            if (a.id === activeArtboardId) {
                const updatesMap = new Map(layerUpdates.map(u => [u.id, u.updates]));
                return {
                    ...a,
                    layers: a.layers.map(l => {
                        if (updatesMap.has(l.id)) {
                            return { ...l, ...updatesMap.get(l.id) } as Layer;
                        }
                        return l;
                    }),
                };
            }
            return a;
        });
        setHistoryArtboards(updater);
        setArtboards(updater);
    }, [activeArtboardId, setHistoryArtboards]);

    useEffect(() => {
      setSelectedLayerIds([]);
      setKeyObjectLayerId(null);
      setLastClickedLayerId(null);
    }, [activeArtboardId, viewMode]);
    
    useEffect(() => {
      if (selectedLayerIds.length !== 1) {
        setSelectionState(null);
      }
    }, [selectedLayerIds]);
  
    useEffect(() => {
      if (viewMode === 'editor' && !activeArtboardId && artboards.length > 0 && !isStartupModalOpen) {
        setActiveArtboardId(artboards[0].id);
      }
    }, [viewMode, artboards, activeArtboardId, isStartupModalOpen]);
  
    const handleUndo = useCallback(() => {
      isInteracting.current = false;
      undo();
    }, [undo]);
  
    const handleRedo = useCallback(() => {
      isInteracting.current = false;
      redo();
    }, [redo]);
      const handleAddArtboard = useCallback(() => {
      const newId = `artboard-${Date.now()}`;
      const newArtboard: ArtboardType = {
        id: newId,
        name: `New Artboard ${artboardsRef.current.length + 1}`,
        width: 1080,
        height: 1080,
        backgroundColor: '#ffffff',
        layers: [],
        guides: [],
      };
      setHistoryArtboards(prev => [...prev, newArtboard]);
      setActiveArtboardId(newId);
      setViewMode('editor');
    }, [setHistoryArtboards]);

    const handleSaveProject = useCallback(() => {
        try {
          const projectData = {
              version: 2,
              artboards: artboardsRef.current,
              customFonts,
              textStyles,
              shapeStyles,
          };
          const jsonString = JSON.stringify(projectData, null, 2);
          const blob = new Blob([jsonString], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'thumbnail-studio-project.json';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch (error) {
          console.error("Lỗi khi lưu dự án:", error);
          alert("Không thể lưu dự án. Vui lòng xem console để biết chi tiết.");
        }
    }, [customFonts, textStyles, shapeStyles]);
    
    const handleResetProject = useCallback(() => {
        try {
            localStorage.removeItem(AUTOSAVE_KEY);
            resetHistoryArtboards(initialArtboards);
            setCustomFonts([]);
            setTextStyles([defaultTextStyle]);
            setShapeStyles([]);
            setViewMode('gallery');
            setActiveArtboardId(initialArtboards.length > 0 ? initialArtboards[0].id : null);
            setSelectedLayerIds([]);
            setKeyObjectLayerId(null);
            setZoom(1);
            setPan({ x: 0, y: 0 });
            setSelectionState(null);
            setShowRecoveryToast(false);
            setIsStartupModalOpen(true);
        } catch (error) {
            console.error("Lỗi khi thiết lập lại dự án:", error);
            alert("Không thể thiết lập lại dự án. Vui lòng thử xóa bộ nhớ cache của trình duyệt theo cách thủ công.");
        }
    }, [resetHistoryArtboards, setIsStartupModalOpen]);

    const handleZoomChange = useCallback((newZoomLevel: number) => {
      const container = editorContainerRef.current;
      if (!container) return;
      const newZoom = Math.max(0.1, Math.min(5, newZoomLevel));
      const { width, height } = container.getBoundingClientRect();
      const centerX = width / 2;
      const centerY = height / 2;
      const currentZoom = zoom; // Use state value at time of call
      const currentPan = pan;   // Use state value at time of call
      const worldX = (centerX - currentPan.x) / currentZoom;
      const worldY = (centerY - currentPan.y) / currentZoom;
      const newPanX = centerX - worldX * newZoom;
      const newPanY = centerY - worldY * newZoom;
      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    }, [zoom, pan]);
  
    const handleResetView = useCallback(() => {
        const artboard = artboardsRef.current.find(a => a.id === activeArtboardId);
        const container = editorContainerRef.current;
        if (!artboard || !container) return;
        
        const PADDING = 80;
        const { width: containerWidth, height: containerHeight } = container.getBoundingClientRect();
        const { width: artboardWidth, height: artboardHeight } = artboard;
        
        const scaleX = (containerWidth - PADDING) / artboardWidth;
        const scaleY = (containerHeight - PADDING) / artboardHeight;
        const newZoom = Math.min(scaleX, scaleY, 2);
        
        const newPanX = (containerWidth - artboardWidth * newZoom) / 2;
        const newPanY = (containerHeight - artboardHeight * newZoom) / 2;
  
        setZoom(newZoom);
        setPan({ x: newPanX, y: newPanY });
    }, [activeArtboardId]);
  
    const handleDeleteSelectedLayers = useCallback(() => {
        const layerIdsToDelete = selectedLayerIdsRef.current;
        if (!activeArtboardId || layerIdsToDelete.length === 0) return;
    
        const currentArtboards = artboardsRef.current;
        const currentArtboard = currentArtboards.find(a => a.id === activeArtboardId);
        if (!currentArtboard) return;
    
        const layersToKeep = currentArtboard.layers.filter(l => !layerIdsToDelete.includes(l.id));
    
        updateArtboardAndCommit(activeArtboardId, { layers: layersToKeep });
    
        setSelectedLayerIds([]);
        setKeyObjectLayerId(null);
    }, [activeArtboardId, updateArtboardAndCommit]);

    const handleMoveSelectedLayers = useCallback((dx: number, dy: number) => {
        const currentSelectedIds = selectedLayerIdsRef.current;
        if (!activeArtboardId || currentSelectedIds.length === 0) return;

        const currentArtboards = artboardsRef.current;
        const artboard = currentArtboards.find(a => a.id === activeArtboardId);
        if (!artboard) return;

        const updates = artboard.layers
            .filter(l => currentSelectedIds.includes(l.id))
            .map(l => ({
                id: l.id,
                updates: { x: l.x + dx, y: l.y + dy }
            }));
        
        if(updates.length > 0) {
            updateLayersAndCommit(updates);
        }
    }, [activeArtboardId, updateLayersAndCommit]);

    const handleDuplicateSelectedLayers = useCallback(() => {
        const artboard = artboardsRef.current.find(a => a.id === activeArtboardId);
        const layerIds = selectedLayerIdsRef.current;
        if (!artboard || layerIds.length === 0) return;
    
        const sourceLayers = layerIds.map(id => artboard.layers.find(l => l.id === id)).filter(Boolean) as Layer[];
        if (sourceLayers.length === 0) return;
    
        const allLayersForDataIdCheck = [...artboard.layers];
        const newLayerIds: string[] = [];
    
        const duplicatedLayers: Layer[] = sourceLayers.map(sourceLayer => {
            const newLayer: Layer = JSON.parse(JSON.stringify(sourceLayer));
            newLayer.id = `${sourceLayer.type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            newLayer.locked = false;
            newLayer.x += 10;
            newLayer.y += 10;
            if (sourceLayer.dataId) {
                newLayer.dataId = generateNewDataId(sourceLayer.dataId, allLayersForDataIdCheck);
                allLayersForDataIdCheck.push(newLayer); // Add for next check in same batch
            }
            newLayerIds.push(newLayer.id);
            return newLayer;
        });
        
        const updater = (prevArtboards: ArtboardType[]) => {
            return prevArtboards.map(a => {
                if (a.id !== artboard.id) return a;
    
                const combinedLayers = [...a.layers, ...duplicatedLayers];
                
                // Re-calculate all z-indices
                const sortedOriginalLayers = [...a.layers].sort((a, b) => a.zIndex - b.zIndex);
                const topMostSourceLayer = sourceLayers.sort((a, b) => b.zIndex - a.zIndex)[0];
                const insertionIndex = sortedOriginalLayers.findIndex(l => l.id === topMostSourceLayer.id) + 1;
    
                const newSortedLayers = [...sortedOriginalLayers];
                newSortedLayers.splice(insertionIndex, 0, ...duplicatedLayers);
    
                const zIndexMap = new Map<string, number>();
                newSortedLayers.forEach((l, index) => zIndexMap.set(l.id, index));

                const finalLayers = combinedLayers.map(layer => ({
                    ...layer,
                    zIndex: zIndexMap.get(layer.id) ?? layer.zIndex,
                }));
    
                return { ...a, layers: finalLayers };
            });
        };
    
        setHistoryArtboards(updater);
    
        setSelectedLayerIds(newLayerIds);
        setKeyObjectLayerId(null);
    }, [activeArtboardId, setHistoryArtboards]);

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        const activeElement = document.activeElement;
        const isEditing = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || (activeElement as HTMLElement).isContentEditable);
        
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const isCtrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

        if (e.key === 'Alt') {
            e.preventDefault();
        }
        
        if (isEditing) {
          // Allow some shortcuts even when editing, e.g., saving
          if (isCtrlOrCmd && e.key.toLowerCase() === 's') {
            e.preventDefault();
            handleSaveProject();
          }
          return;
        }
  
        if (isCtrlOrCmd && e.key === ';') {
            e.preventDefault();
            setGuideSettings(prev => ({ ...prev, visible: !prev.visible }));
        } else if (isCtrlOrCmd && e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
        } else if (isCtrlOrCmd && e.key.toLowerCase() === 'y') {
          e.preventDefault();
          handleRedo();
        } else if (isCtrlOrCmd && e.key.toLowerCase() === 'j') {
            e.preventDefault();
            handleDuplicateSelectedLayers();
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selectedLayerIdsRef.current.length > 0) {
                e.preventDefault();
                handleDeleteSelectedLayers();
            }
        } else if (isCtrlOrCmd && (e.key === '=' || e.key === '+')) {
            e.preventDefault();
            handleZoomChange(zoom + 0.2);
        } else if (isCtrlOrCmd && e.key === '-') {
            e.preventDefault();
            handleZoomChange(zoom - 0.2);
        } else if (isCtrlOrCmd && e.key.toLowerCase() === 's') {
            e.preventDefault();
            handleSaveProject();
        } else if (isCtrlOrCmd && e.key.toLowerCase() === 'o') {
            e.preventDefault();
            document.getElementById('load-project-input')?.click();
        } else if (isCtrlOrCmd && e.key.toLowerCase() === 'r') {
            e.preventDefault();
            handleResetProject();
        } else if (e.key.startsWith('Arrow')) {
            e.preventDefault();
            const moveAmount = e.shiftKey ? 10 : 1;
            let dx = 0, dy = 0;
            if (e.key === 'ArrowUp') dy = -moveAmount;
            else if (e.key === 'ArrowDown') dy = moveAmount;
            else if (e.key === 'ArrowLeft') dx = -moveAmount;
            else if (e.key === 'ArrowRight') dx = moveAmount;
            handleMoveSelectedLayers(dx, dy);
        }
      };
  
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }, [handleUndo, handleRedo, handleDeleteSelectedLayers, handleZoomChange, zoom, handleSaveProject, handleResetProject, handleMoveSelectedLayers, handleDuplicateSelectedLayers]);
  
    useEffect(() => {
      const container = editorContainerRef.current;
      if (!container || viewMode !== 'editor') return;
  
      const handleKeyDown = (e: KeyboardEvent) => {
          const activeElement = document.activeElement;
          if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || (activeElement as HTMLElement).isContentEditable)) {
              return;
          }
  
          if (e.code === 'Space' && !e.repeat) {
              if(document.activeElement === e.target) {
                e.preventDefault();
              }
              isSpacePressedRef.current = true;
              container.style.cursor = 'grab';
          }
      };
      const handleKeyUp = (e: KeyboardEvent) => {
          if (e.code === 'Space') {
              isSpacePressedRef.current = false;
              container.style.cursor = 'default';
          }
      };
      
      const handleWheel = (e: WheelEvent) => {
          if (e.ctrlKey || e.altKey) {
              e.preventDefault();
              const zoomFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1; // 10% increase or decrease
              const newZoom = Math.max(0.1, Math.min(5, zoom * zoomFactor));
              const rect = container.getBoundingClientRect();
              const mouseX = e.clientX - rect.left;
              const mouseY = e.clientY - rect.top;
              const worldX = (mouseX - pan.x) / zoom;
              const worldY = (mouseY - pan.y) / zoom;
              const newPanX = mouseX - worldX * newZoom;
              const newPanY = mouseY - worldY * newZoom;
              setZoom(newZoom);
              setPan({ x: newPanX, y: newPanY });
          }
      };
  
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      container.addEventListener('wheel', handleWheel, { passive: false });
  
      return () => {
          window.removeEventListener('keydown', handleKeyDown);
          window.removeEventListener('keyup', handleKeyUp);
          container.removeEventListener('wheel', handleWheel);
      };
    }, [zoom, pan, viewMode]);
  
    const handlePanMouseDownOnEditor = (e: React.MouseEvent) => {
      if (isSpacePressedRef.current && editorContainerRef.current) {
          editorContainerRef.current.style.cursor = 'grabbing';
          panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  
          const handlePanMouseMove = (moveEvent: MouseEvent) => {
              setPan({ x: moveEvent.clientX - panStartRef.current.x, y: moveEvent.clientY - panStartRef.current.y });
          };
          const handlePanMouseUp = () => {
              if (editorContainerRef.current) {
                  editorContainerRef.current.style.cursor = isSpacePressedRef.current ? 'grab' : 'default';
              }
              window.removeEventListener('mousemove', handlePanMouseMove);
              window.removeEventListener('mouseup', handlePanMouseUp);
          };
          
          window.addEventListener('mousemove', handlePanMouseMove);
          window.addEventListener('mouseup', handlePanMouseUp);
      } else if (e.target === e.currentTarget) {
        const containerRect = editorContainerRef.current!.getBoundingClientRect();
        const startX = e.clientX;
        const startY = e.clientY;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const currentX = moveEvent.clientX;
            const currentY = moveEvent.clientY;
            const x = Math.min(startX, currentX) - containerRect.left;
            const y = Math.min(startY, currentY) - containerRect.top;
            const width = Math.abs(startX - currentX);
            const height = Math.abs(startY - currentY);
            setMarqueeRect({ x, y, width, height });
        };

        const handleMouseUp = (upEvent: MouseEvent) => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            
            const endX = upEvent.clientX;
            const endY = upEvent.clientY;
            const finalRect = {
                x: Math.min(startX, endX) - containerRect.left,
                y: Math.min(startY, endY) - containerRect.top,
                width: Math.abs(startX - endX),
                height: Math.abs(startY - endY)
            };

            const artboard = artboardsRef.current.find(a => a.id === activeArtboardId);
            if (artboard && (finalRect.width > 5 || finalRect.height > 5)) {
                const marqueeArtboardCoords = {
                    x: (finalRect.x - pan.x) / zoom,
                    y: (finalRect.y - pan.y) / zoom,
                    width: finalRect.width / zoom,
                    height: finalRect.height / zoom,
                };
                const selectedIds = artboard.layers
                    .filter(layer => {
                        if (layer.locked || !(layer.visible ?? true)) return false;
                        const layerRect = { x: layer.x, y: layer.y, width: layer.width, height: layer.height };
                        return (
                            layerRect.x < marqueeArtboardCoords.x + marqueeArtboardCoords.width &&
                            layerRect.x + layerRect.width > marqueeArtboardCoords.x &&
                            layerRect.y < marqueeArtboardCoords.y + marqueeArtboardCoords.height &&
                            layerRect.y + layerRect.height > marqueeArtboardCoords.y
                        );
                    })
                    .map(l => l.id);
                
                if (upEvent.shiftKey || upEvent.ctrlKey || upEvent.metaKey) {
                    setSelectedLayerIds(prev => [...new Set([...prev, ...selectedIds])]);
                } else {
                    setSelectedLayerIds(selectedIds);
                }
            } else {
                setSelectedLayerIds([]);
                setKeyObjectLayerId(null);
            }
            setMarqueeRect(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
      }
    };
    
    useEffect(() => {
      if (viewMode === 'editor' && activeArtboardId) {
        // A short delay allows the UI to render and provides correct container dimensions.
        setTimeout(() => {
          handleResetView();
        }, 50);
      }
    }, [activeArtboardId, viewMode, handleResetView]);
  
    const handleLoadProject = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
  
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const text = e.target?.result as string;
            const projectData = JSON.parse(text);
            
            const loadedArtboards = projectData.artboards || (Array.isArray(projectData) ? projectData : null);
            const loadedCustomFonts = projectData.customFonts || [];
            const loadedTextStyles = projectData.textStyles || [];
            const loadedShapeStyles = projectData.shapeStyles || [];

            if (!loadedArtboards || !Array.isArray(loadedArtboards)) {
              throw new Error("Định dạng file dự án không hợp lệ. Thiếu thuộc tính 'artboards'.");
            }
            
            await loadFonts(loadedCustomFonts);
            setCustomFonts(loadedCustomFonts);
            setTextStyles(loadedTextStyles);
            setShapeStyles(loadedShapeStyles);
            resetHistoryArtboards(loadedArtboards as ArtboardType[]);
            setViewMode('gallery');
            setActiveArtboardId(loadedArtboards.length > 0 ? loadedArtboards[0].id : null);
            setSelectedLayerIds([]);
            setKeyObjectLayerId(null);
            alert('Tải dự án thành công!');
  
          } catch (error) {
            console.error("Lỗi khi tải dự án:", error);
            alert(`Không thể tải file dự án. Lỗi: ${error instanceof Error ? error.message : String(error)}`);
          } finally {
              if (event.target) event.target.value = '';
          }
        };
        reader.readAsText(file);
    };
    
    const handleFontUpload = async (file: File) => {
        const fontFamilyName = file.name.replace(/\.[^/.]+$/, "");
        if (allFonts.some(f => f.name === fontFamilyName)) {
            alert(`Font '${fontFamilyName}' đã tồn tại.`);
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const url = e.target?.result as string;
                const font = new FontFace(fontFamilyName, `url(${url})`);
                await font.load();
                document.fonts.add(font);

                const newFontFamily: FontFamily = {
                    name: fontFamilyName,
                    variants: [{ name: 'Regular', weight: 400, style: 'normal', url: url }]
                };
                setCustomFonts(prev => [...prev, newFontFamily]);
            } catch (err) {
                console.error("Lỗi tải font:", err);
                alert("Không thể tải file font này.");
            }
        };
        reader.readAsDataURL(file);
    };
    
    const handleDeleteCustomFont = (fontFamilyName: string) => {
        setCustomFonts(prev => prev.filter(f => f.name !== fontFamilyName));
    };
  
    const handleExportSelectionToggle = (artboardId: string) => {
      setArtboardIdsToExport(prev =>
          prev.includes(artboardId)
              ? prev.filter(id => id !== artboardId)
              : [...prev, artboardId]
      );
    };
  
    const handleExportSelectAll = (isChecked: boolean) => {
        setArtboardIdsToExport(isChecked ? artboards.map(a => a.id) : []);
    };
    
    const handleOpenExportModal = () => {
        if (artboardIdsToExport.length === 0) {
            setArtboardIdsToExport(artboards.map(a => a.id));
        }
        setIsExportModalOpen(true);
    };
  
    const handleStartExport = async (options: ExportOptions) => {
      const artboardsToExport = artboards.filter(a => artboardIdsToExport.includes(a.id));
      if (artboardsToExport.length === 0) return;
  
      if (artboardsToExport.length === 1) {
        const artboard = artboardsToExport[0];
        const canvas = await renderArtboardToCanvas(artboard, allFonts);
        const blob = await getCanvasBlob(canvas, options.format, options.limitSize, options.maxSizeKb);
        if (blob) {
            const filename = `${artboard.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${options.format === 'jpeg' ? 'jpg' : 'png'}`;
            downloadBlob(blob, filename);
        }
      } else {
        const zip = new JSZip();
        for (const artboard of artboardsToExport) {
            const canvas = await renderArtboardToCanvas(artboard, allFonts);
            const blob = await getCanvasBlob(canvas, options.format, options.limitSize, options.maxSizeKb);
            if (blob) {
                const filename = `${artboard.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${options.format === 'jpeg' ? 'jpg' : 'png'}`;
                zip.file(filename, blob);
            }
        }
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(zipBlob, 'artboards_export.zip');
      }
    };
  
    const updateLayerLive = useCallback((layerId: string, updates: Partial<Layer>) => {
      if (!activeArtboardId) return;
      isInteracting.current = true;
      setArtboards(prev =>
        prev.map(a =>
          a.id === activeArtboardId
            ? {
                ...a,
                layers: a.layers.map(l =>
                  l.id === layerId ? { ...l, ...updates } as Layer : l
                ),
              }
            : a
        )
      );
    }, [activeArtboardId]);
    
    const updateLayersLive = useCallback((layerUpdates: { id: string, updates: Partial<Layer> }[]) => {
        if (!activeArtboardId || layerUpdates.length === 0) return;
        isInteracting.current = true;
        setArtboards(prevArtboards => prevArtboards.map(a => {
            if (a.id === activeArtboardId) {
                const updatesMap = new Map(layerUpdates.map(u => [u.id, u.updates]));
                return {
                    ...a,
                    layers: a.layers.map(l => {
                        if (updatesMap.has(l.id)) {
                            return { ...l, ...updatesMap.get(l.id) } as Layer;
                        }
                        return l;
                    }),
                };
            }
            return a;
        }));
    }, [activeArtboardId]);
  
    const commitChanges = useCallback(() => {
      isInteracting.current = false;
      const finalLiveState = artboardsRef.current;
      
      setHistoryArtboards(currentHistoryState => {
        if (JSON.stringify(finalLiveState) !== JSON.stringify(currentHistoryState)) {
          return finalLiveState;
        }
        return currentHistoryState;
      });
    }, [setHistoryArtboards]);
    
    const handleApplyStyleToSelection = useCallback((updates: Partial<TextSpan>) => {
        if (!activeArtboardId || !selectedLayer || selectedLayer.type !== LayerType.Text) return;
    
        const updater = (prevArtboards: ArtboardType[]) => prevArtboards.map(a => {
            if (a.id !== activeArtboardId) return a;
            return {
                ...a,
                layers: a.layers.map(l => {
                    if (l.id !== selectedLayer.id || l.type !== LayerType.Text) return l;
                    const textLayer = l as TextLayer;
                    const range = selectionStateRef.current?.hasSelection
                        ? selectionStateRef.current.range
                        : { start: 0, end: textLayer.spans.reduce((sum, s) => sum + s.text.length, 0) };
                    
                    if (!range) return l;

                    const newSpans = applyTextStyle(textLayer.spans, range, updates);
                    const mergedSpans = mergeSpans(newSpans.filter(s => s.text && s.text.length > 0));
                    
                    return { 
                        ...textLayer, 
                        spans: mergedSpans.length > 0 ? mergedSpans : [{ text: '' }],
                        spansVersion: (textLayer.spansVersion || 0) + 1,
                    };
                })
            };
        });
        setHistoryArtboards(updater);
        setArtboards(updater);
    }, [activeArtboardId, selectedLayer, setHistoryArtboards]);

    const handleToggleStyle = useCallback((styleKey: keyof Omit<TextSpan, 'text'>) => {
        if (!activeArtboardId || !selectedLayer || selectedLayer.type !== LayerType.Text) return;

        const textLayer = selectedLayer as TextLayer;
        const totalLength = textLayer.spans.reduce((sum, s) => sum + s.text.length, 0);

        const range = (selectionStateRef.current?.hasSelection && selectionStateRef.current.layerId === textLayer.id)
            ? selectionStateRef.current.range!
            : { start: 0, end: totalLength };

        const currentState = getStyleStateForRange(textLayer.spans, range, styleKey);
        
        // Logic: If it's NOT uniformly true, make it true. If it IS uniformly true, unset it.
        const isUniformlyApplied = currentState === true;
        
        let updates: Partial<TextSpan> = {};

        if (styleKey === 'underline' || styleKey === 'strikethrough') {
            updates[styleKey] = !isUniformlyApplied;
        } else if (styleKey === 'textTransform') {
            updates.textTransform = isUniformlyApplied ? 'none' : 'uppercase';
        } else if (styleKey === 'textScript') {
            updates.textScript = isUniformlyApplied ? 'normal' : 'superscript';
        }

        handleApplyStyleToSelection(updates);

    }, [activeArtboardId, selectedLayer, handleApplyStyleToSelection]);

    const handleSplitTextLayer = useCallback(() => {
      if (!activeArtboard || !selectionState || !selectionState.hasSelection || !selectionState.range) {
          return;
      }
  
      const { layerId, range } = selectionState;
      const sourceLayer = activeArtboard.layers.find(l => l.id === layerId) as TextLayer;
  
      if (!sourceLayer || sourceLayer.type !== LayerType.Text) {
          return;
      }
  
      const newLayerSpans = getSpansForRange(sourceLayer.spans, range);
      const originalLayerSpans = removeRangeFromSpans(sourceLayer.spans, range);
      
      const mergedNewSpans = mergeSpans(newLayerSpans);
      const mergedOriginalSpans = mergeSpans(originalLayerSpans.filter(s => s.text));
  
      if (mergedNewSpans.length === 0) {
          return; // Nothing to split
      }
  
      // --- New Position Calculation ---
      const relativePos = calculateTextRangePosition(sourceLayer, range.start);
  
      const cx = sourceLayer.x + sourceLayer.width / 2;
      const cy = sourceLayer.y + sourceLayer.height / 2;
  
      const unrotatedNewX = sourceLayer.x + relativePos.x;
      const unrotatedNewY = sourceLayer.y + relativePos.y;
  
      const angleRad = sourceLayer.rotation * Math.PI / 180;
      const cos = Math.cos(angleRad);
      const sin = Math.sin(angleRad);
  
      const finalNewX = cx + (unrotatedNewX - cx) * cos - (unrotatedNewY - cy) * sin;
      const finalNewY = cy + (unrotatedNewX - cx) * sin + (unrotatedNewY - cy) * cos;
      // --- End New Position Calculation ---
  
      const newZIndex = Math.max(0, ...activeArtboard.layers.map(l => l.zIndex)) + 1;
      const newLayer: TextLayer = {
          ...sourceLayer,
          id: `text-${Date.now()}`,
          dataId: '',
          spans: mergedNewSpans,
          x: finalNewX,
          y: finalNewY,
          width: sourceLayer.width, // Will be auto-adjusted
          height: 50, // Will be auto-adjusted
          zIndex: newZIndex,
          locked: false,
          spansVersion: 1,
          rotation: sourceLayer.rotation, // Inherit rotation
      };
      
      setHistoryArtboards(prevArtboards => {
          return prevArtboards.map(a => {
              if (a.id !== activeArtboardId) return a;
              
              const updatedLayers = a.layers.map(l => {
                  if (l.id === sourceLayer.id) {
                      return {
                          ...l,
                          spans: mergedOriginalSpans.length > 0 ? mergedOriginalSpans : [{ text: '' }],
                          spansVersion: ((l as TextLayer).spansVersion || 0) + 1,
                      } as TextLayer;
                  }
                  return l;
              });
              updatedLayers.push(newLayer);
  
              return { ...a, layers: updatedLayers };
          });
      });
  
      setSelectedLayerIds([newLayer.id]);
      setKeyObjectLayerId(null);
      setSelectionState(null);
  
    }, [activeArtboard, selectionState, setHistoryArtboards, activeArtboardId]);
  
    const handleGenerateArtboardsFromCsv = useCallback((
        data: Record<string, string>[],
        templateArtboard: ArtboardType,
        styleMappings: Record<string, string>
    ) => {
        if (!templateArtboard) return;

        const newArtboards = data.map((row, index) => {
            const newArtboard: ArtboardType = JSON.parse(JSON.stringify(templateArtboard));
            newArtboard.id = `artboard-csv-${Date.now()}-${index}`;
            newArtboard.name = row['Name'] || `${templateArtboard.name} (Bản sao ${index + 1})`;

            const splitLayersToAdd: TextLayer[] = [];
            let newZIndex = Math.max(-1, ...newArtboard.layers.map(l => l.zIndex)) + 1;

            const columnNames = Object.keys(row);

            // First pass: update existing layers based on column data
            newArtboard.layers = newArtboard.layers.map(layer => {
                const dataId = layer.dataId;
                if (dataId && row[dataId] !== undefined) {
                    const value = row[dataId].trim();
                    const upperValue = value.toUpperCase();
                    let updatedLayer: Layer = { ...layer };

                    if (upperValue === 'TRUE') {
                        updatedLayer.visible = true;
                    } else if (upperValue === 'FALSE' || value === '') {
                        updatedLayer.visible = false;
                    } else {
                        updatedLayer.visible = true;
                        
                        if (updatedLayer.type === LayerType.Text) {
                            let textLayer = updatedLayer as TextLayer;
                            const styleId = styleMappings[dataId];

                            if (styleId) {
                                const styleToApply = textStyles.find(s => s.id === styleId);
                                if (styleToApply) {
                                    const { id, name, ...styleProps } = styleToApply;
                                    textLayer = { ...textLayer, ...styleProps };
                                    textLayer.spans = [{ text: value }];
                                }
                            } else {
                                const firstSpan = (textLayer.spans && textLayer.spans.length > 0) ? textLayer.spans[0] : { text: '' };
                                const { text, ...firstSpanStyle } = firstSpan;
                                textLayer.spans = [{ ...firstSpanStyle, text: value }];
                            }

                            textLayer.spansVersion = (textLayer.spansVersion || 0) + 1;
                            
                            const oldWidth = textLayer.width;
                            const oldHeight = textLayer.height;
                            const { width: newWidth, height: newHeight } = calculateTextDimensions(textLayer);
                            
                            const heightDifference = oldHeight - newHeight;
                            const widthDifference = oldWidth - newWidth;

                            textLayer.width = newWidth;
                            textLayer.height = newHeight;
                            
                            textLayer.y = textLayer.y + heightDifference / 2;
                            
                            switch (textLayer.textAlign) {
                                case 'right':
                                    textLayer.x = textLayer.x + widthDifference;
                                    break;
                                case 'center':
                                default:
                                    textLayer.x = textLayer.x + widthDifference / 2;
                                    break;
                                case 'left':
                                    break;
                            }
                            updatedLayer = textLayer;

                        } else if (updatedLayer.type === LayerType.Image) {
                            (updatedLayer as ImageLayer).src = value;
                        }
                    }
                    return updatedLayer;
                }
                return layer;
            });

            // Second pass: create new layers for split columns
            for (const columnName of columnNames) {
                const splitMatch = columnName.match(/^(.*)_split_(\d+)$/);
                if (splitMatch) {
                    const originalDataId = splitMatch[1];
                    const originalLayer = newArtboard.layers.find(l => l.dataId === originalDataId) as TextLayer;

                    if (originalLayer && originalLayer.type === LayerType.Text) {
                        const newLayer: TextLayer = JSON.parse(JSON.stringify(originalLayer));
                        newLayer.id = `text-split-${Date.now()}-${index}-${columnName}`;
                        newLayer.dataId = columnName;
                        newLayer.spansVersion = 1;
                        newLayer.zIndex = ++newZIndex;
                        
                        const value = row[columnName];
                        const splitColumnStyleId = styleMappings[columnName];
                        
                        if (splitColumnStyleId) {
                            const styleToApply = textStyles.find(s => s.id === splitColumnStyleId);
                            if (styleToApply) {
                                const { id, name, ...styleProps } = styleToApply;
                                Object.assign(newLayer, styleProps);
                                newLayer.spans = [{ text: value }];
                            }
                        } else {
                            // FIX: Provide a default object with a `text` property to avoid a destructuring error when `newLayer.spans` is empty.
                            const firstSpan = (newLayer.spans && newLayer.spans.length > 0) ? newLayer.spans[0] : { text: '' };
                            const { text, ...firstSpanStyle } = firstSpan;
                            newLayer.spans = [{ ...firstSpanStyle, text: value }];
                        }
                        
                        const { width: newWidth, height: newHeight } = calculateTextDimensions(newLayer);
                        newLayer.width = newWidth;
                        newLayer.height = newHeight;
                        
                        const verticalSpacing = 0;
                        newLayer.y = originalLayer.y + originalLayer.height + verticalSpacing;
                        
                        // Position new split layer based on original layer's text alignment
                        switch (originalLayer.textAlign) {
                            case 'right':
                                newLayer.x = (originalLayer.x + originalLayer.width) - newLayer.width;
                                break;
                            case 'center':
                            default:
                                newLayer.x = originalLayer.x + (originalLayer.width / 2) - (newLayer.width / 2);
                                break;
                            case 'left':
                                newLayer.x = originalLayer.x;
                                break;
                        }

                        splitLayersToAdd.push(newLayer);
                    }
                }
            }
            
            newArtboard.layers.push(...splitLayersToAdd);
            return newArtboard;
        });

        setHistoryArtboards(prev => [...prev.filter(a => a.id !== templateArtboard.id), ...newArtboards]);
        setViewMode('gallery');
    }, [setHistoryArtboards, textStyles]);
  
    const handleDeleteArtboard = (artboardId: string) => {
      setHistoryArtboards(prev => prev.filter(a => a.id !== artboardId));
      if (activeArtboardId === artboardId) {
          const remainingArtboards = artboards.filter(a => a.id !== artboardId);
          const newActiveId = remainingArtboards.length > 0 ? remainingArtboards[0].id : null;
          setActiveArtboardId(newActiveId);
          if (remainingArtboards.length <= 1) {
              setViewMode('editor');
          }
      }
    };
    
    const handleDuplicateArtboard = useCallback((artboardId: string) => {
        const sourceArtboard = artboards.find(a => a.id === artboardId);
        if (!sourceArtboard) return;

        const sourceIndex = artboards.findIndex(a => a.id === artboardId);

        const newArtboard: ArtboardType = JSON.parse(JSON.stringify(sourceArtboard));

        const baseName = sourceArtboard.name.replace(/ \(Copy( \d+)?\)$/, '');
        let copyCounter = 1;
        let newName = `${baseName} (Copy)`;
        while (artboards.some(a => a.name === newName)) {
            copyCounter++;
            newName = `${baseName} (Copy ${copyCounter})`;
        }
        newArtboard.name = newName;
        
        newArtboard.id = `artboard-${Date.now()}`;
        newArtboard.layers.forEach((layer, index) => {
            layer.id = `${layer.type.toLowerCase()}-${Date.now()}-${index}`;
        });

        const newArtboards = [...artboards];
        newArtboards.splice(sourceIndex + 1, 0, newArtboard);
        
        setHistoryArtboards(newArtboards);
        
        setActiveArtboardId(newArtboard.id);
        setViewMode('editor');
    }, [artboards, setHistoryArtboards]);
  
    const addLayer = useCallback((type: LayerType, options?: { shapeType?: ShapeType; pointCount?: number; innerRadiusRatio?: number; }) => {
        if (!activeArtboard) return;
        const newZIndex = Math.max(-1, ...activeArtboard.layers.map(l => l.zIndex)) + 1;
        let newLayer: Layer;
        
        const artboardCenterX = activeArtboard.width / 2;
        const artboardCenterY = activeArtboard.height / 2;

        const baseLayerProps = {
            id: `${type.toLowerCase()}-${Date.now()}`,
            dataId: '',
            rotation: 0,
            zIndex: newZIndex,
            locked: false,
            visible: true,
        };

        if (type === LayerType.Text) {
            const width = 300;
            const height = 60;
            newLayer = { 
                ...baseLayerProps, 
                x: artboardCenterX - width / 2, 
                y: artboardCenterY - height / 2, 
                width, 
                height, 
                type: LayerType.Text, 
                spans: [{ text: 'New Text' }], 
                fontFamily: 'Inter', 
                fontSize: 48, 
                color: '#111827', 
                fontWeight: 700, 
                textAlign: 'center', 
                spansVersion: 0 
            } as TextLayer;
        } else if (type === LayerType.Image) {
            const width = 400;
            const height = 300;
            newLayer = { 
                ...baseLayerProps, 
                x: artboardCenterX - width / 2, 
                y: artboardCenterY - height / 2, 
                width, 
                height, 
                type: LayerType.Image, 
                src: 'https://picsum.photos/400/300' 
            } as ImageLayer;
        } else if (type === LayerType.Line) {
            const width = 250;
            const strokeWidth = 3;
            newLayer = { 
                ...baseLayerProps, 
                x: artboardCenterX - width / 2, 
                y: artboardCenterY - strokeWidth / 2, 
                width, 
                height: strokeWidth, 
                type: LayerType.Line, 
                color: '#111827', 
                strokeWidth, 
                startCap: {shape: LineEndCapShape.None, size: 3}, 
                endCap: {shape: LineEndCapShape.None, size: 3}
            } as LineLayer;
        } else if (type === LayerType.Shape) {
            const width = 200;
            const height = 200;
            const baseShapeLayer = { 
                ...baseLayerProps, 
                x: artboardCenterX - width / 2, 
                y: artboardCenterY - height / 2, 
                width, 
                height, 
                type: LayerType.Shape, 
                fill: '#6366f1', 
                strokes: [] 
            };
            switch(options?.shapeType) {
                case ShapeType.Rectangle:
                    newLayer = { ...baseShapeLayer, shapeType: ShapeType.Rectangle, cornerRadius: 0 } as RectangleShapeLayer;
                    break;
                case ShapeType.Ellipse:
                    newLayer = { ...baseShapeLayer, shapeType: ShapeType.Ellipse } as EllipseShapeLayer;
                    break;
                case ShapeType.Polygon:
                    newLayer = { ...baseShapeLayer, shapeType: ShapeType.Polygon, pointCount: options?.pointCount ?? 5, innerRadiusRatio: options?.innerRadiusRatio ?? 0.5, cornerRadius: 0 } as PolygonShapeLayer;
                    break;
                default:
                    throw new Error("Invalid shape type");
            }
        } else {
            return;
        }
        
        const updatedLayers = [...activeArtboard.layers, newLayer];
        updateArtboardAndCommit(activeArtboard.id, { layers: updatedLayers });
        setSelectedLayerIds([newLayer.id]);
        setKeyObjectLayerId(null);
    }, [activeArtboard, updateArtboardAndCommit]);

    const handleCreateBlankProject = () => {
      const newId = `artboard-${Date.now()}`;
      const newArtboard: ArtboardType = {
        id: newId,
        name: 'Artboard Trống',
        width: 1080,
        height: 1080,
        backgroundColor: '#ffffff',
        layers: [],
        guides: [],
      };
      resetHistoryArtboards([newArtboard]);
      setActiveArtboardId(newId);
      setViewMode('editor');
      setIsStartupModalOpen(false);
      setTimeout(handleResetView, 50);
    };

    const handleCreateProjectFromTemplate = (template: ArtboardType) => {
      const newProjectArtboard: ArtboardType = JSON.parse(JSON.stringify(template)); // Deep copy
      newProjectArtboard.id = `artboard-${Date.now()}`;
      newProjectArtboard.layers.forEach((layer, index) => { layer.id = `${layer.type.toLowerCase()}-${Date.now()}-${index}`; });
      resetHistoryArtboards([newProjectArtboard]);
      setActiveArtboardId(newProjectArtboard.id);
      setViewMode('editor');
      setIsStartupModalOpen(false);
      setTimeout(handleResetView, 50);
    };
  
    const deleteLayer = useCallback((layerId: string) => {
      if (!activeArtboard) return;
      const updatedLayers = activeArtboard.layers.filter(l => l.id !== layerId);
      updateArtboardAndCommit(activeArtboard.id, { layers: updatedLayers });
      if (selectedLayerIds.includes(layerId)) {
        setSelectedLayerIds(prev => prev.filter(id => id !== layerId));
      }
      if (keyObjectLayerId === layerId) {
        setKeyObjectLayerId(null);
      }
    }, [activeArtboard, updateArtboardAndCommit, selectedLayerIds, keyObjectLayerId]);
    
    const handleDuplicateLayer = useCallback((layerId: string, overrides?: Partial<Layer>) => {
        const artboard = artboardsRef.current.find(a => a.id === activeArtboardId);
        if (!artboard) return;
    
        const sourceLayerForId = artboard.layers.find(l => l.id === layerId);
        if (!sourceLayerForId) return;
    
        const isAltDrag = overrides && (overrides as any).__initialX !== undefined;
        
        const newLayerId = `${sourceLayerForId.type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
        const updater = (prevArtboards: ArtboardType[]) => {
            const artboardsCopy = JSON.parse(JSON.stringify(prevArtboards));
            const targetArtboard = artboardsCopy.find((a: ArtboardType) => a.id === activeArtboardId);
            if (!targetArtboard) return prevArtboards;
    
            const sourceLayerIndex = targetArtboard.layers.findIndex((l: Layer) => l.id === layerId);
            if (sourceLayerIndex === -1) return prevArtboards;
            
            let sourceLayer = targetArtboard.layers[sourceLayerIndex];
    
            const duplicatedLayer = JSON.parse(JSON.stringify(sourceLayer));
            
            if (isAltDrag) {
                sourceLayer.x = (overrides as any).__initialX;
                sourceLayer.y = (overrides as any).__initialY;
            }
            
            duplicatedLayer.id = newLayerId;
            duplicatedLayer.locked = false;
    
            if (isAltDrag) {
                duplicatedLayer.x = overrides!.x;
                duplicatedLayer.y = overrides!.y;
            } else {
                duplicatedLayer.x += 10;
                duplicatedLayer.y += 10;
            }
    
            if (sourceLayer.dataId) {
                duplicatedLayer.dataId = generateNewDataId(sourceLayer.dataId, targetArtboard.layers);
            }
            
            const sortedLayers = [...targetArtboard.layers].sort((a, b) => a.zIndex - b.zIndex);
            const sourceVisualIndex = sortedLayers.findIndex(l => l.id === layerId);
            sortedLayers.splice(sourceVisualIndex + 1, 0, duplicatedLayer);
            
            targetArtboard.layers.push(duplicatedLayer);
    
            const zIndexMap = new Map<string, number>();
            sortedLayers.forEach((l, index) => zIndexMap.set(l.id, index));
    
            targetArtboard.layers.forEach((l: Layer) => {
                l.zIndex = zIndexMap.get(l.id) ?? l.zIndex;
            });
            
            return artboardsCopy;
        };
        
        setHistoryArtboards(updater);
        
        if (isAltDrag) {
            isInteracting.current = false;
        }

        setTimeout(() => {
            setSelectedLayerIds([newLayerId]);
            setKeyObjectLayerId(null);
        }, 0);
    
    }, [activeArtboardId, setHistoryArtboards]);

    const handleReorderLayer = useCallback((draggedLayerId: string, targetLayerId: string, position: 'before' | 'after') => {
        if (!activeArtboard) return;
    
        const sortedLayers = [...activeArtboard.layers].sort((a, b) => a.zIndex - b.zIndex);
        const draggedItem = sortedLayers.find(l => l.id === draggedLayerId);
        if (!draggedItem) return;

        const remainingLayers = sortedLayers.filter(l => l.id !== draggedLayerId);
        const targetIndex = remainingLayers.findIndex(l => l.id === targetLayerId);
        if (targetIndex === -1) return;

        const newIndex = position === 'before' ? targetIndex : targetIndex + 1;
        remainingLayers.splice(newIndex, 0, draggedItem);
        
        const finalLayers = activeArtboard.layers.map(originalLayer => {
            const newZIndex = remainingLayers.findIndex(l => l.id === originalLayer.id);
            return { ...originalLayer, zIndex: newZIndex };
        });
    
        updateArtboardAndCommit(activeArtboard.id, { layers: finalLayers });
    }, [activeArtboard, updateArtboardAndCommit]);
    
    const handleToggleLayerLock = useCallback((layerId: string) => {
      if (!activeArtboard) return;
      const layer = activeArtboard.layers.find(l => l.id === layerId);
      if (!layer) return;
  
      const isLocking = !layer.locked;
      updateLayerAndCommit(layerId, { locked: isLocking });
  
      if (isLocking && selectedLayerIds.includes(layerId)) {
        setSelectedLayerIds(prev => prev.filter(id => id !== layerId));
        if (keyObjectLayerId === layerId) {
            setKeyObjectLayerId(null);
        }
      }
    }, [activeArtboard, selectedLayerIds, keyObjectLayerId, updateLayerAndCommit]);
    
    const handleToggleLayerVisibility = useCallback((layerId: string) => {
        if (!activeArtboard) return;
        const layer = activeArtboard.layers.find(l => l.id === layerId);
        if (!layer) return;

        updateLayerAndCommit(layerId, { visible: !(layer.visible ?? true) });
    }, [activeArtboard, updateLayerAndCommit]);
    
    const handleLayerSelection = useCallback((layerId: string, options: { isCtrl: boolean, isShift: boolean }, source: 'panel' | 'canvas' = 'panel') => {
        const { isCtrl, isShift } = options;
        const artboard = artboardsRef.current.find(a => a.id === activeArtboardId);
        if (!artboard) return;

        const isToggle = isCtrl || (source === 'canvas' && isShift);
        const isRangeSelect = source === 'panel' && isShift && lastClickedLayerId && layerId !== lastClickedLayerId;

        if (isRangeSelect) {
            const sortedLayers = [...artboard.layers].sort((a, b) => b.zIndex - a.zIndex);
            const lastIndex = sortedLayers.findIndex(l => l.id === lastClickedLayerId);
            const currentIndex = sortedLayers.findIndex(l => l.id === layerId);

            if (lastIndex !== -1 && currentIndex !== -1) {
                const start = Math.min(lastIndex, currentIndex);
                const end = Math.max(lastIndex, currentIndex);
                const rangeIds = sortedLayers.slice(start, end + 1).map(l => l.id);
                
                setSelectedLayerIds(prev => [...new Set([...prev, ...rangeIds])]);
            }
        } else if (isToggle) {
            setSelectedLayerIds(prev => {
                const newSelection = prev.includes(layerId)
                    ? prev.filter(id => id !== layerId)
                    : [...prev, layerId];
                
                if (keyObjectLayerId && !newSelection.includes(keyObjectLayerId)) {
                    setKeyObjectLayerId(null);
                }
                if (newSelection.length <= 1) {
                    setKeyObjectLayerId(null);
                }
                return newSelection;
            });
        } else { // Regular click
            if (selectedLayerIdsRef.current.length > 1 && selectedLayerIdsRef.current.includes(layerId)) {
                setKeyObjectLayerId(layerId);
            } else {
                setSelectedLayerIds([layerId]);
                setKeyObjectLayerId(null);
            }
        }
        
        if (source === 'panel') {
            setLastClickedLayerId(layerId);
        } else {
            setLastClickedLayerId(null);
        }
    }, [activeArtboardId, keyObjectLayerId, lastClickedLayerId]);
  
    const handleSelectArtboardForEditing = (artboardId: string) => {
        if (artboardId === activeArtboardId) {
            setSelectedLayerIds([]);
            setKeyObjectLayerId(null);
        }
        setActiveArtboardId(artboardId);
        setViewMode('editor');
    };
    
    const handleAlign = useCallback((type: string) => {
      if (!activeArtboard || selectedLayers.length < 1) return;
  
      let targetBounds: { x: number; y: number; width: number; height: number; };
  
      const keyObject = selectedLayers.find(l => l.id === keyObjectLayerId);
  
      if (keyObject) {
          targetBounds = keyObject;
      } else {
          const effectiveAlignTo = selectedLayers.length === 1 ? 'artboard' : alignTo;
          if (effectiveAlignTo === 'artboard') {
              targetBounds = { x: 0, y: 0, width: activeArtboard.width, height: activeArtboard.height };
          } else { // alignTo === 'selection'
              const minX = Math.min(...selectedLayers.map(l => l.x));
              const minY = Math.min(...selectedLayers.map(l => l.y));
              const maxX = Math.max(...selectedLayers.map(l => l.x + l.width));
              const maxY = Math.max(...selectedLayers.map(l => l.y + l.height));
              targetBounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
          }
      }
  
      const updates = selectedLayers.map(layer => {
          if (keyObject && layer.id === keyObject.id) {
              return null;
          }
          const newUpdates: Partial<Layer> = {};
          switch(type) {
              case 'left': newUpdates.x = targetBounds.x; break;
              case 'h-center': newUpdates.x = targetBounds.x + targetBounds.width / 2 - layer.width / 2; break;
              case 'right': newUpdates.x = targetBounds.x + targetBounds.width - layer.width; break;
              case 'top': newUpdates.y = targetBounds.y; break;
              case 'v-center': newUpdates.y = targetBounds.y + targetBounds.height / 2 - layer.height / 2; break;
              case 'bottom': newUpdates.y = targetBounds.y + targetBounds.height - layer.height; break;
          }
          return { id: layer.id, updates: newUpdates };
      }).filter(u => u !== null) as { id: string, updates: Partial<Layer> }[];
      
      updateLayersAndCommit(updates.filter(u => Object.keys(u.updates).length > 0));
    }, [activeArtboard, selectedLayers, alignTo, keyObjectLayerId, updateLayersAndCommit]);
    
    const handleDistribute = useCallback((type: string) => {
        if (!activeArtboard || selectedLayers.length < 2) return;
  
        const sorted = [...selectedLayers];
        const updates: {id: string, updates: Partial<Layer>}[] = [];
  
        if (sorted.length < 3) {
            return;
        }
  
        switch (type) {
          case 'v-dist-top': {
              sorted.sort((a, b) => a.y - b.y);
              const firstY = sorted[0].y;
              const lastY = sorted[sorted.length - 1].y;
              const step = (lastY - firstY) / (sorted.length - 1);
              for (let i = 1; i < sorted.length - 1; i++) {
                  updates.push({ id: sorted[i].id, updates: { y: firstY + i * step } });
              }
              break;
          }
          case 'v-dist-center': {
              sorted.sort((a, b) => (a.y + a.height / 2) - (b.y + b.height / 2));
              const firstCenterY = sorted[0].y + sorted[0].height / 2;
              const lastCenterY = sorted[sorted.length - 1].y + sorted[sorted.length - 1].height / 2;
              const step = (lastCenterY - firstCenterY) / (sorted.length - 1);
              for (let i = 1; i < sorted.length - 1; i++) {
                  updates.push({ id: sorted[i].id, updates: { y: firstCenterY + i * step - sorted[i].height / 2 } });
              }
              break;
          }
          case 'v-dist-bottom': {
              sorted.sort((a, b) => (a.y + a.height) - (b.y + b.height));
              const firstBottom = sorted[0].y + sorted[0].height;
              const lastBottom = sorted[sorted.length - 1].y + sorted[sorted.length - 1].height;
              const step = (lastBottom - firstBottom) / (sorted.length - 1);
              for (let i = 1; i < sorted.length - 1; i++) {
                  updates.push({ id: sorted[i].id, updates: { y: firstBottom + i * step - sorted[i].height } });
              }
              break;
          }
          case 'h-dist-left': {
              sorted.sort((a, b) => a.x - b.x);
              const firstX = sorted[0].x;
              const lastX = sorted[sorted.length - 1].x;
              const step = (lastX - firstX) / (sorted.length - 1);
              for (let i = 1; i < sorted.length - 1; i++) {
                  updates.push({ id: sorted[i].id, updates: { x: firstX + i * step } });
              }
              break;
          }
          case 'h-dist-center': {
              sorted.sort((a, b) => (a.x + a.width / 2) - (b.x + b.width / 2));
              const firstCenterX = sorted[0].x + sorted[0].width / 2;
              const lastCenterX = sorted[sorted.length - 1].x + sorted[sorted.length - 1].width / 2;
              const step = (lastCenterX - firstCenterX) / (sorted.length - 1);
              for (let i = 1; i < sorted.length - 1; i++) {
                  updates.push({ id: sorted[i].id, updates: { x: firstCenterX + i * step - sorted[i].width / 2 } });
              }
              break;
          }
          case 'h-dist-right': {
              sorted.sort((a, b) => (a.x + a.width) - (b.y + b.width));
              const firstRight = sorted[0].x + sorted[0].width;
              const lastRight = sorted[sorted.length - 1].x + sorted[sorted.length - 1].width;
              const step = (lastRight - firstRight) / (sorted.length - 1);
              for (let i = 1; i < sorted.length - 1; i++) {
                  updates.push({ id: sorted[i].id, updates: { x: firstRight + i * step - sorted[i].width } });
              }
              break;
          }
        }
        if(updates.length > 0) updateLayersAndCommit(updates);
    }, [activeArtboard, selectedLayers, updateLayersAndCommit]);
    
    const handleSaveTextStyle = useCallback((name: string) => {
        if (!selectedLayer || selectedLayer.type !== LayerType.Text) return;
        const textLayer = selectedLayer as TextLayer;

        const newStyle: TextStyle = {
            id: `style-${Date.now()}`,
            name: name,
            fontFamily: textLayer.fontFamily,
            fontWeight: textLayer.fontWeight,
            fontSize: textLayer.fontSize,
            textAlign: textLayer.textAlign,
            color: textLayer.color,
            strokes: textLayer.strokes ? JSON.parse(JSON.stringify(textLayer.strokes)) : [],
            shadow: textLayer.shadow ? JSON.parse(JSON.stringify(textLayer.shadow)) : undefined,
            underline: textLayer.underline,
            strikethrough: textLayer.strikethrough,
            textScript: textLayer.textScript,
            textTransform: textLayer.textTransform,
        };

        setTextStyles(prev => [...prev, newStyle]);
    }, [selectedLayer]);

    const handleApplyTextStyle = useCallback((style: TextStyle) => {
        if (!selectedLayer || selectedLayer.type !== LayerType.Text) return;

        const textLayer = selectedLayer as TextLayer;
        const { id, name, ...styleProps } = style;
        
        const defaultToggleableStyles = {
            underline: false,
            strikethrough: false,
            textScript: 'normal' as const,
            textTransform: 'none' as const,
        };
        
        const newSpans = textLayer.spans.map(s => ({ text: s.text }));
        const mergedSpans = mergeSpans(newSpans);

        updateLayerAndCommit(selectedLayer.id, {
            ...defaultToggleableStyles,
            ...styleProps,
            spans: mergedSpans,
            spansVersion: (textLayer.spansVersion || 0) + 1
        });

    }, [selectedLayer, updateLayerAndCommit]);
    
    const handleDeleteTextStyle = useCallback((styleId: string) => {
        setTextStyles(prev => prev.filter(s => s.id !== styleId));
    }, []);
    
    const handleResetTextStyle = useCallback(() => {
        if (!selectedLayer || selectedLayer.type !== LayerType.Text) return;
        
        const textLayer = selectedLayer as TextLayer;
        
        const defaultTextStyleProps = {
            fontFamily: 'Inter',
            fontSize: 48,
            color: '#111827',
            fontWeight: 700,
            textAlign: 'center' as const,
            strokes: [],
            shadow: { enabled: false, color: '#000000', offsetX: 5, offsetY: 5, blur: 5, opacity: 100 },
            underline: false,
            strikethrough: false,
            textScript: 'normal' as const,
            textTransform: 'none' as const,
        };
        
        const newSpans = textLayer.spans.map(s => ({ text: s.text }));
        const mergedSpans = mergeSpans(newSpans);

        updateLayerAndCommit(selectedLayer.id, {
            ...defaultTextStyleProps,
            spans: mergedSpans,
            spansVersion: (textLayer.spansVersion || 0) + 1,
        });

    }, [selectedLayer, updateLayerAndCommit]);

    const handleSaveShapeStyle = useCallback((name: string) => {
        if (!selectedLayer || selectedLayer.type !== LayerType.Shape) return;
        const shapeLayer = selectedLayer as AnyShapeLayer;

        const newStyle: ShapeStyle = {
            id: `shape-style-${Date.now()}`,
            name: name,
            fill: shapeLayer.fill,
            strokes: shapeLayer.strokes ? JSON.parse(JSON.stringify(shapeLayer.strokes)) : [],
            shadow: shapeLayer.shadow ? JSON.parse(JSON.stringify(shapeLayer.shadow)) : undefined,
            cornerRadius: (shapeLayer as RectangleShapeLayer | PolygonShapeLayer).cornerRadius,
        };

        setShapeStyles(prev => [...prev, newStyle]);
    }, [selectedLayer]);

    const handleApplyShapeStyle = useCallback((style: ShapeStyle) => {
        if (!selectedLayer || selectedLayer.type !== LayerType.Shape) return;

        // FIX: Reworked style application to be type-safe for different shape types.
        // `cornerRadius` is destructured separately because it's not present on all shape types (e.g., Ellipse).
        const { id, name, cornerRadius, ...otherStyleProps } = style;
        
        // Common properties are applied first.
        const updates: Partial<AnyShapeLayer> = { ...otherStyleProps };

        // `cornerRadius` is added only if the layer type supports it and the style provides it.
        if (selectedLayer.shapeType !== ShapeType.Ellipse && cornerRadius !== undefined) {
            // A cast is needed here because `updates` is a broad union type,
            // but we've confirmed the layer type supports this property.
            (updates as Partial<RectangleShapeLayer | PolygonShapeLayer>).cornerRadius = cornerRadius;
        }

        updateLayerAndCommit(selectedLayer.id, updates);

    }, [selectedLayer, updateLayerAndCommit]);
    
    const handleDeleteShapeStyle = useCallback((styleId: string) => {
        setShapeStyles(prev => prev.filter(s => s.id !== styleId));
    }, []);

    const handleOpenChangeTemplateModal = useCallback(() => {
        if (activeArtboard) {
            setIsChangeTemplateModalOpen(true);
        } else {
            alert("Vui lòng chọn một artboard để áp dụng mẫu.");
        }
    }, [activeArtboard]);

    const handleCloseChangeTemplateModal = useCallback(() => {
        setIsChangeTemplateModalOpen(false);
    }, []);

    const handleChangeArtboardTemplate = useCallback((template: ArtboardType) => {
        if (!activeArtboardId) return;

        const newLayers = template.layers.map((layer, index) => ({
            ...JSON.parse(JSON.stringify(layer)), // Deep copy to ensure no shared references
            id: `${layer.type.toLowerCase()}-${Date.now()}-${index}` // Generate new unique ID
        }));

        updateArtboardAndCommit(activeArtboardId, {
            layers: newLayers,
            backgroundColor: template.backgroundColor,
        });
        handleCloseChangeTemplateModal();
    }, [activeArtboardId, updateArtboardAndCommit, handleCloseChangeTemplateModal]);

    const handleClearArtboardContent = useCallback(() => {
        if (!activeArtboardId) return;
        updateArtboardAndCommit(activeArtboardId, {
            layers: [],
            backgroundColor: '#ffffff'
        });
        handleCloseChangeTemplateModal();
    }, [activeArtboardId, updateArtboardAndCommit, handleCloseChangeTemplateModal]);

    const addGuide = useCallback((orientation: 'horizontal' | 'vertical', position: number) => {
        if (!activeArtboardId) return;
        const newGuide: Guide = { 
            id: `guide-${Date.now()}`, 
            orientation, 
            position,
            color: guideSettings.color 
        };
        const updater = (prev: ArtboardType[]) => prev.map(a => {
            if (a.id === activeArtboardId) {
                return { ...a, guides: [...(a.guides || []), newGuide] };
            }
            return a;
        });
        setHistoryArtboards(updater);
    }, [activeArtboardId, setHistoryArtboards, guideSettings.color]);
    
    const handleSetGuides = useCallback((guidesToAdd: { orientation: 'horizontal' | 'vertical', position: number }[], clearExisting: boolean) => {
        if (!activeArtboardId) return;

        const newGuides: Guide[] = guidesToAdd.map((g, i) => ({
            id: `guide-${Date.now()}-${i}`,
            orientation: g.orientation,
            position: g.position,
            color: guideSettings.color,
        }));

        const updater = (prev: ArtboardType[]) => prev.map(a => {
            if (a.id === activeArtboardId) {
                const existingGuides = clearExisting ? [] : (a.guides || []);
                return { ...a, guides: [...existingGuides, ...newGuides] };
            }
            return a;
        });
        setHistoryArtboards(updater);
    }, [activeArtboardId, setHistoryArtboards, guideSettings.color]);

    const handleClearGuides = useCallback(() => {
        if (!activeArtboardId) return;
        updateArtboardAndCommit(activeArtboardId, { guides: [] });
    }, [activeArtboardId, updateArtboardAndCommit]);
    
    const handleDeleteAllLayers = useCallback(() => {
        if (!activeArtboardId) return;
        updateArtboardAndCommit(activeArtboardId, { layers: [] });
        setSelectedLayerIds([]);
        setKeyObjectLayerId(null);
    }, [activeArtboardId, updateArtboardAndCommit]);

    const handleToggleAllLayersVisibility = useCallback(() => {
        const artboard = artboardsRef.current.find(a => a.id === activeArtboardId);
        if (!artboard) return;
        // If at least one layer is visible, hide all. Otherwise, show all.
        const shouldShowAll = artboard.layers.every(l => !(l.visible ?? true));
        const updatedLayers = artboard.layers.map(l => ({...l, visible: shouldShowAll}));
        updateArtboardAndCommit(activeArtboardId, { layers: updatedLayers });
    }, [activeArtboardId, updateArtboardAndCommit]);

    const handleToggleAllLayersLock = useCallback(() => {
        const artboard = artboardsRef.current.find(a => a.id === activeArtboardId);
        if (!artboard) return;
        // If at least one layer is unlocked, lock all. Otherwise, unlock all.
        const shouldLockAll = artboard.layers.some(l => !l.locked);
        const updatedLayers = artboard.layers.map(l => ({...l, locked: shouldLockAll}));
        updateArtboardAndCommit(activeArtboardId, { layers: updatedLayers });
        // Deselect all layers if we are locking them
        if (shouldLockAll) {
            setSelectedLayerIds([]);
            setKeyObjectLayerId(null);
        }
    }, [activeArtboardId, updateArtboardAndCommit]);
    
    const handleSoloLayerVisibility = useCallback((layerId: string) => {
        const artboard = artboardsRef.current.find(a => a.id === activeArtboardId);
        if (!artboard) return;
        const updatedLayers = artboard.layers.map(l => ({
            ...l,
            visible: l.id === layerId
        }));
        updateArtboardAndCommit(activeArtboardId, { layers: updatedLayers });
    }, [activeArtboardId, updateArtboardAndCommit]);

    const handleExportStyles = useCallback(() => {
        const stylesData = { textStyles, shapeStyles };
        const jsonString = JSON.stringify(stylesData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        downloadBlob(blob, 'thumbnail-studio-styles.json');
    }, [textStyles, shapeStyles]);

    const handleImportStyles = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const data = JSON.parse(text);
                const importedTextStyles = data.textStyles || [];
                const importedShapeStyles = data.shapeStyles || [];

                if (Array.isArray(importedTextStyles) && importedTextStyles.length > 0) {
                    const newTextStyles = importedTextStyles.map((style: TextStyle) => ({
                        ...style,
                        id: `style-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                    }));
                    setTextStyles(prev => [...prev, ...newTextStyles]);
                }

                if (Array.isArray(importedShapeStyles) && importedShapeStyles.length > 0) {
                    const newShapeStyles = importedShapeStyles.map((style: ShapeStyle) => ({
                        ...style,
                        id: `shape-style-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                    }));
                    setShapeStyles(prev => [...prev, ...newShapeStyles]);
                }
                
                if (importedTextStyles.length > 0 || importedShapeStyles.length > 0) {
                    alert('Nhập styles thành công!');
                } else {
                    alert('File không chứa style hợp lệ.');
                }
            } catch (error) {
                console.error("Lỗi khi nhập styles:", error);
                alert(`Không thể đọc file styles. Lỗi: ${error instanceof Error ? error.message : String(error)}`);
            } finally {
                if (event.target) event.target.value = '';
            }
        };
        reader.readAsText(file);
    }, []);

    return {
        // State
        artboards,
        activeArtboardId,
        activeArtboard,
        selectedLayerIds,
        selectedLayers,
        selectedLayer,
        isStartupModalOpen,
        isChangeTemplateModalOpen,
        keyObjectLayerId,
        alignTo,
        viewMode,
        selectionState,
        showRecoveryToast,
        isExportModalOpen,
        artboardIdsToExport,
        csvTemplateArtboardId,
        zoom,
        pan,
        canUndo,
        canRedo,
        allFonts,
        customFonts,
        textStyles,
        shapeStyles,
        guideSettings,
        marqueeRect,

        // Setters
        setActiveArtboardId,
        setSelectedLayerIds,
        setKeyObjectLayerId,
        setAlignTo,
        setViewMode,
        setSelectionState,
        setShowRecoveryToast,
        setIsExportModalOpen,
        setArtboardIdsToExport,
        setCsvTemplateArtboardId,
        setGuideSettings,

        // Refs
        editorContainerRef,
        isSpacePressedRef,

        // Handlers
        handleUndo,
        handleRedo,
        handleResetView,
        handlePanMouseDownOnEditor,
        handleZoomChange,
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
        updateLayerAndCommit,
        updateLayersAndCommit,
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
    };
};