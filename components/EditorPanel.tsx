import React, { useState, useRef, useEffect } from 'react';
import { Artboard, Layer, LayerType, TextLayer, ImageLayer, FontFamily, TextSpan, StrokeStyle, ShadowStyle, TextStyle, ShapeType, AnyShapeLayer, RectangleShapeLayer, PolygonShapeLayer, ShapeStyle, LineLayer, LineEndCapShape, LineEndCap, GlowStyle } from '../types';
import Accordion from './Accordion';
import FontSelector from './FontSelector';
import ColorPicker from './ColorPicker';
import { SelectionState, AlignTo, GuideSettings } from '../hooks/useAppLogic';
import { DuplicateIcon, SplitIcon, RevertIcon, EyeIcon, EyeOffIcon, RectangleIcon, EllipseIcon, StarIcon, TriangleIcon, TemplateIcon, UppercaseIcon, UnderlineIcon, StrikethroughIcon, SuperscriptIcon, LockClosedIcon, LockOpenIcon, ExportStylesIcon, ImportStylesIcon, TrashIcon, PlusIcon, GuidesIcon, SnapIcon, PencilIcon, EffectsIcon, CloseIcon, AlignHCenterIcon } from './Icons';
import LayerPreview from './LayerPreview';
import StylePreview from './StylePreview';

// --- ALIGNMENT & DISTRIBUTE IONS ---
// Moved to Icons.tsx

const TextAlignLeftIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 6h18M3 12h12M3 18h15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const TextAlignCenterIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 6h18M6 12h12M4.5 18h15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const TextAlignRightIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 6h18M9 12h12M6 18h15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;

// FIX: Removed local icon definitions that are now centralized in `Icons.tsx`.

interface EditorPanelProps {
  position: 'left' | 'right';
  artboards: Artboard[];
  activeArtboard: Artboard | undefined;
  selectedLayer: Layer | undefined;
  selectedLayers: Layer[];
  selectedLayerIds: string[];
  keyObjectLayerId: string | null;
  onArtboardSelect: (id: string) => void;
  onLayerSelect: (id: string, options: { isCtrl: boolean, isShift: boolean }, source?: 'panel' | 'canvas') => void;
  onUpdateArtboard: (id: string, updates: Partial<Artboard>) => void;
  onUpdateLayer: (id: string, updates: Partial<Layer>) => void;
  onAddLayer: (type: LayerType, options?: { shapeType?: ShapeType; pointCount?: number; innerRadiusRatio?: number; }) => void;
  onDeleteLayer: (id: string) => void;
  onDuplicateLayer: (id: string) => void;
  onAddArtboard: () => void;
  onDeleteArtboard: (id: string) => void;
  onDuplicateArtboard: (id: string) => void;
  onReorderLayer: (draggedId: string, targetId: string, position: 'before' | 'after') => void;
  onToggleLayerVisibility: (layerId: string) => void;
  onToggleLayerLock: (layerId: string) => void;
  fonts: FontFamily[];
  customFonts: FontFamily[];
  onFontUpload: (file: File) => void;
  onDeleteCustomFont: (fontName: string) => void;
  selectionState: SelectionState | null;
  onApplyStyleToSelection: (updates: Partial<TextSpan>) => void;
  onToggleStyle: (styleKey: keyof Omit<TextSpan, 'text'>) => void;
  alignTo: AlignTo;
  setAlignTo: (mode: AlignTo) => void;
  onAlign: (type: string) => void;
  onDistribute: (type: string) => void;
  onSplitTextLayer: () => void;
  textStyles: TextStyle[];
  onSaveTextStyle: (name: string) => void;
  onApplyTextStyle: (style: TextStyle) => void;
  onDeleteTextStyle: (id: string) => void;
  onResetTextStyle: () => void;
  shapeStyles: ShapeStyle[];
  onSaveShapeStyle: (name: string) => void;
  onApplyShapeStyle: (style: ShapeStyle) => void;
  onDeleteShapeStyle: (id: string) => void;
  onOpenGuideManager: () => void;
  guideSettings: GuideSettings;
  onSettingsChange: (settings: GuideSettings) => void;
  onClearGuides: () => void;
  onDeleteAllLayers: () => void;
  onToggleAllLayersVisibility: () => void;
  onToggleAllLayersLock: () => void;
  onSoloLayerVisibility: (layerId: string) => void;
  handleExportStyles: () => void;
  handleImportStyles: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

const InputField = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="w-full">
        <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
        {children}
    </div>
);

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64, 72, 80, 96, 100, 120, 144, 160, 192, 220, 256, 300, 350, 400, 450, 500];

const EditorPanel: React.FC<EditorPanelProps> = (props) => {
    const { position, artboards, activeArtboard, selectedLayer, selectedLayers, onArtboardSelect, onLayerSelect, onUpdateArtboard, 
    onUpdateLayer, onAddLayer, onDeleteLayer, onDuplicateLayer, onAddArtboard, onDeleteArtboard, onDuplicateArtboard, onReorderLayer, onToggleLayerVisibility, onToggleLayerLock,
    fonts, customFonts, onFontUpload, onDeleteCustomFont, selectionState, onApplyStyleToSelection, onToggleStyle, alignTo, setAlignTo, onAlign, onDistribute,
    onSplitTextLayer, textStyles, onSaveTextStyle, onApplyTextStyle, onDeleteTextStyle, onResetTextStyle, shapeStyles, onSaveShapeStyle, onApplyShapeStyle, onDeleteShapeStyle, onOpenGuideManager, guideSettings, onSettingsChange, onClearGuides, onDeleteAllLayers, onToggleAllLayersVisibility, onToggleAllLayersLock, onSoloLayerVisibility, handleExportStyles, handleImportStyles } = props;
    
    const [activePanelKey, setActivePanelKey] = useState<string | null>(null);
    const [newStyleName, setNewStyleName] = useState('');
    const [newShapeStyleName, setNewShapeStyleName] = useState('');

  const textLayer = selectedLayer?.type === LayerType.Text ? selectedLayer as TextLayer : undefined;
  const shapeLayer = selectedLayer?.type === LayerType.Shape ? selectedLayer as AnyShapeLayer : undefined;
  const lineLayer = selectedLayer?.type === LayerType.Line ? selectedLayer as LineLayer : undefined;

  // FIX: Moved helper functions and variable declarations to the top of the component scope
  // to resolve "used before its declaration" errors within the `panelsConfig` array.
  const handleArtboardPropChange = <K extends keyof Artboard>(prop: K, value: Artboard[K]) => {
    if (activeArtboard) onUpdateArtboard(activeArtboard.id, { [prop]: value });
  };
  const handleLayerPropChange = (updates: Partial<Layer>) => {
    if (selectedLayer) onUpdateLayer(selectedLayer.id, updates);
  };
  
  const handleGlowChange = (updates: Partial<GlowStyle>) => {
      if (selectedLayer) {
          const newGlow = {
              ...(selectedLayer.glow || { enabled: false, color: '#FFFFFF', blur: 10, opacity: 80 }),
              ...updates,
          };
          handleLayerPropChange({ glow: newGlow });
      }
  };

  const handleShadowChange = (updates: Partial<ShadowStyle>) => {
      if (selectedLayer) {
          const newShadow = {
              ...(selectedLayer.shadow || { enabled: false, color: '#000000', offsetX: 5, offsetY: 5, blur: 5, opacity: 100 }),
              ...updates,
          };
          handleLayerPropChange({ shadow: newShadow });
      }
  };
  
  const handleSaveCurrentStyle = () => {
      if (!newStyleName.trim()) {
          alert("Vui lòng nhập tên cho style.");
          return;
      }
      onSaveTextStyle(newStyleName);
      setNewStyleName('');
  };

  const handleSaveCurrentShapeStyle = () => {
      if (!newShapeStyleName.trim()) {
          alert("Vui lòng nhập tên cho style.");
          return;
      }
      onSaveShapeStyle(newShapeStyleName);
      setNewShapeStyleName('');
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
            handleLayerPropChange({ src: result });
        }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };
  
  const baseInputClasses = "w-full bg-slate-100 p-2 rounded-md border border-slate-200 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm";
  
  const selectionStyle = (selectionState && selectionState.hasSelection && selectionState.layerId === selectedLayer?.id)
     ? selectionState.styles
     : {};

  const currentStyle = {
     fontFamily: selectionStyle.fontFamily ?? textLayer?.fontFamily,
     fontWeight: selectionStyle.fontWeight ?? textLayer?.fontWeight,
     fontSize: selectionStyle.fontSize ?? textLayer?.fontSize,
     color: selectionStyle.color ?? textLayer?.color,
     underline: selectionStyle.underline,
     strikethrough: selectionStyle.strikethrough,
     textScript: selectionStyle.textScript,
     textTransform: selectionStyle.textTransform,
  };

  const currentFontSize = currentStyle.fontSize;
  const finalFontSizes = [...FONT_SIZES];
  if (currentFontSize && typeof currentFontSize === 'number' && !finalFontSizes.includes(currentFontSize)) {
      finalFontSizes.push(currentFontSize);
      finalFontSizes.sort((a, b) => a - b);
  }
  
  const handleAddStroke = () => {
     if (selectedLayer && (selectedLayer.type === LayerType.Text || selectedLayer.type === LayerType.Shape)) {
         const newStroke: StrokeStyle = {
             id: `stroke-${Date.now()}`,
             color: '#FFFFFF',
             width: 5,
         };
         const updatedStrokes = [newStroke, ...(selectedLayer.strokes || [])];
         handleLayerPropChange({ strokes: updatedStrokes });
     }
  };

  const handleUpdateStroke = (id: string, updates: Partial<StrokeStyle>) => {
     if (selectedLayer && (selectedLayer.type === LayerType.Text || selectedLayer.type === LayerType.Shape) && selectedLayer.strokes) {
         const updatedStrokes = selectedLayer.strokes.map(s => s.id === id ? { ...s, ...updates } : s);
         handleLayerPropChange({ strokes: updatedStrokes });
     }
  };
  
  const handleDeleteStroke = (id: string) => {
     if (selectedLayer && (selectedLayer.type === LayerType.Text || selectedLayer.type === LayerType.Shape) && selectedLayer.strokes) {
         const updatedStrokes = selectedLayer.strokes.filter(s => s.id !== id);
         handleLayerPropChange({ strokes: updatedStrokes });
     }
  };

  const getStyleActiveState = (styleKey: keyof Omit<TextSpan, 'text'>): boolean => {
     if (selectionState && selectionState.hasSelection) {
         const state = selectionState.styles[styleKey];
         return state === true || state === 'mixed';
     }
     if (textLayer) {
         if (styleKey === 'underline' || styleKey === 'strikethrough') {
              return textLayer.spans.some(s => s[styleKey]);
         }
         if (styleKey === 'textScript') {
             return textLayer.spans.some(s => s.textScript === 'superscript');
         }
         if (styleKey === 'textTransform') {
             return textLayer.spans.some(s => s.textTransform === 'uppercase');
         }
     }
     return false;
  };

  const isUppercase = getStyleActiveState('textTransform');
  const isUnderline = getStyleActiveState('underline');
  const isStrikethrough = getStyleActiveState('strikethrough');
  const isSuperscript = getStyleActiveState('textScript');

  const StyleButton = ({ children, onClick, title, isActive }: { children: React.ReactNode, onClick: () => void, title: string, isActive: boolean }) => (
      <button 
          onClick={onClick} 
          title={title} 
          className={`p-2 rounded-md transition-colors ${isActive ? 'bg-indigo-200 text-indigo-700' : 'text-slate-600 hover:bg-slate-200'}`}
          onMouseDown={(e) => e.preventDefault()}
      >
          {children}
      </button>
  );

  const panelsConfig = [
    {
      key: 'artboard',
      title: 'Cài đặt Artboard',
      icon: <TemplateIcon />,
      condition: activeArtboard && selectedLayers.length === 0,
      content: (
          <div className="space-y-3">
              <InputField label="Tên Artboard"><input type="text" value={activeArtboard?.name} onChange={(e) => handleArtboardPropChange('name', e.target.value)} className={baseInputClasses} /></InputField>
              <div className="flex space-x-2">
                  <div className="flex-1"><InputField label="Rộng"><input type="number" value={activeArtboard?.width} onChange={(e) => handleArtboardPropChange('width', parseInt(e.target.value) || 0)} className={baseInputClasses} /></InputField></div>
                  <div className="flex-1"><InputField label="Cao"><input type="number" value={activeArtboard?.height} onChange={(e) => handleArtboardPropChange('height', parseInt(e.target.value) || 0)} className={baseInputClasses} /></InputField></div>
              </div>
              <ColorPicker label="Màu nền" value={activeArtboard?.backgroundColor || '#ffffff'} onChange={(color) => handleArtboardPropChange('backgroundColor', color)} />
          </div>
      )
    },
    {
        key: 'properties',
        title: 'Thuộc tính',
        icon: <PencilIcon />,
        condition: !!selectedLayer,
        content: selectedLayer && (
            <div className="space-y-3">
                <InputField label="Data ID (CSV Key)"><input type="text" value={selectedLayer.dataId || ''} onChange={(e) => handleLayerPropChange({ dataId: e.target.value.trim() })} className={baseInputClasses} placeholder="e.g., Name, @img" /></InputField>
                <div className="grid grid-cols-2 gap-2">
                    <InputField label="X"><input type="number" value={Math.round(selectedLayer.x)} onChange={(e) => handleLayerPropChange({ x: parseInt(e.target.value) || 0 })} className={baseInputClasses} /></InputField>
                    <InputField label="Y"><input type="number" value={Math.round(selectedLayer.y)} onChange={(e) => handleLayerPropChange({ y: parseInt(e.target.value) || 0 })} className={baseInputClasses} /></InputField>
                    <InputField label={lineLayer ? "Dài" : "Rộng"}><input type="number" value={Math.round(selectedLayer.width)} onChange={(e) => handleLayerPropChange({ width: Math.max(0, parseInt(e.target.value)) || 0 })} className={baseInputClasses} /></InputField>
                    <InputField label="Cao"><input type="number" disabled={!!lineLayer} value={Math.round(selectedLayer.height)} onChange={(e) => handleLayerPropChange({ height: Math.max(0, parseInt(e.target.value)) || 0 })} className={`${baseInputClasses} ${lineLayer ? 'disabled:bg-slate-200' : ''}`} /></InputField>
                </div>
                <InputField label={`Xoay: ${Math.round(selectedLayer.rotation)}°`}><input type="range" min="-180" max="180" value={selectedLayer.rotation} onChange={(e) => handleLayerPropChange({ rotation: parseInt(e.target.value) })} className="w-full" /></InputField>
                
                {lineLayer && (
                    <Accordion title="Thuộc tính Line">
                        <div className="pt-2 space-y-3">
                            <ColorPicker label="Màu" value={lineLayer.color} onChange={(color) => handleLayerPropChange({ color })} />
                            <InputField label="Độ dày">
                                <input type="number" value={lineLayer.strokeWidth} onChange={(e) => handleLayerPropChange({ strokeWidth: parseInt(e.target.value, 10) || 0, height: parseInt(e.target.value, 10) || 0 })} className={baseInputClasses} min="1" />
                            </InputField>
                            
                            <div className='pt-2 border-t border-slate-200'>
                                <h4 className="text-xs font-semibold text-slate-600 mb-2">Đầu mút bắt đầu</h4>
                                <div className='grid grid-cols-2 gap-2'>
                                    <InputField label="Hình dạng">
                                        <select value={lineLayer.startCap.shape} onChange={(e) => handleLayerPropChange({ startCap: { ...lineLayer.startCap, shape: e.target.value as LineEndCapShape }})} className={baseInputClasses}>
                                            <option value={LineEndCapShape.None}>Không có</option>
                                            <option value={LineEndCapShape.Triangle}>Tam giác</option>
                                            <option value={LineEndCapShape.Square}>Vuông</option>
                                            <option value={LineEndCapShape.Circle}>Tròn</option>
                                        </select>
                                    </InputField>
                                    <InputField label="Kích thước">
                                        <input type="number" value={lineLayer.startCap.size} onChange={(e) => handleLayerPropChange({ startCap: { ...lineLayer.startCap, size: parseInt(e.target.value, 10) || 0 }})} className={baseInputClasses} min="1"/>
                                    </InputField>
                                </div>
                            </div>
                              <div className='pt-2 border-t border-slate-200'>
                                <h4 className="text-xs font-semibold text-slate-600 mb-2">Đầu mút kết thúc</h4>
                                <div className='grid grid-cols-2 gap-2'>
                                    <InputField label="Hình dạng">
                                          <select value={lineLayer.endCap.shape} onChange={(e) => handleLayerPropChange({ endCap: { ...lineLayer.endCap, shape: e.target.value as LineEndCapShape }})} className={baseInputClasses}>
                                            <option value={LineEndCapShape.None}>Không có</option>
                                            <option value={LineEndCapShape.Triangle}>Tam giác</option>
                                            <option value={LineEndCapShape.Square}>Vuông</option>
                                            <option value={LineEndCapShape.Circle}>Tròn</option>
                                        </select>
                                    </InputField>
                                    <InputField label="Kích thước">
                                        <input type="number" value={lineLayer.endCap.size} onChange={(e) => handleLayerPropChange({ endCap: { ...lineLayer.endCap, size: parseInt(e.target.value, 10) || 0 }})} className={baseInputClasses} min="1" />
                                    </InputField>
                                </div>
                            </div>

                        </div>
                    </Accordion>
                )}
                
                {shapeLayer && (
                    <Accordion title="Thuộc tính Shape">
                        <div className="pt-2 space-y-3">
                            <ColorPicker label="Màu nền" value={shapeLayer.fill} onChange={(color) => handleLayerPropChange({ fill: color })} />
                            {(shapeLayer.shapeType === ShapeType.Rectangle || shapeLayer.shapeType === ShapeType.Polygon) && (
                                <InputField label="Bo góc">
                                    <div className="flex items-center space-x-2">
                                        <input type="range" min="0" max={Math.round(Math.min(shapeLayer.width, shapeLayer.height) / 2)} value={(shapeLayer as RectangleShapeLayer | PolygonShapeLayer).cornerRadius} onChange={(e) => handleLayerPropChange({ cornerRadius: parseInt(e.target.value, 10) || 0 })} className="w-full" />
                                        <input type="number" value={(shapeLayer as RectangleShapeLayer | PolygonShapeLayer).cornerRadius} onChange={(e) => handleLayerPropChange({ cornerRadius: parseInt(e.target.value, 10) || 0 })} className={`${baseInputClasses.replace('w-full', '')} w-20 p-2`} min="0" max={Math.round(Math.min(shapeLayer.width, shapeLayer.height) / 2)} />
                                    </div>
                                </InputField>
                            )}
                            {shapeLayer.shapeType === ShapeType.Polygon && (
                                <>
                                  <InputField label="Số đỉnh">
                                    <div className="flex items-center space-x-2">
                                        <input type="range" min="3" max="20" value={shapeLayer.pointCount} onChange={(e) => handleLayerPropChange({ pointCount: Math.max(3, parseInt(e.target.value, 10) || 3) })} className="w-full" />
                                        <input type="number" value={shapeLayer.pointCount} onChange={(e) => handleLayerPropChange({ pointCount: Math.max(3, parseInt(e.target.value, 10) || 3) })} className={`${baseInputClasses.replace('w-full', '')} w-20 p-2`} min="3" max="20" />
                                    </div>
                                  </InputField>
                                  <InputField label="Độ nhọn (%)">
                                      <div className="flex items-center space-x-2">
                                        <input type="range" min="10" max="100" value={Math.round(shapeLayer.innerRadiusRatio * 100)} onChange={(e) => handleLayerPropChange({ innerRadiusRatio: (parseInt(e.target.value, 10) || 10) / 100 })} className="w-full" />
                                        <input type="number" value={Math.round(shapeLayer.innerRadiusRatio * 100)} onChange={(e) => handleLayerPropChange({ innerRadiusRatio: (parseInt(e.target.value, 10) || 10) / 100 })} className={`${baseInputClasses.replace('w-full', '')} w-20 p-2`} min="10" max="100" />
                                      </div>
                                  </InputField>
                                </>
                            )}
                        </div>
                    </Accordion>
                )}
                  
                {selectedLayer.type === LayerType.Image && (
                    <>
                        <InputField label="Nguồn ảnh (URL)">
                            <input 
                                type="text" 
                                value={(selectedLayer as ImageLayer).src} 
                                onChange={(e) => handleLayerPropChange({ src: e.target.value })} 
                                className={baseInputClasses} 
                            />
                        </InputField>
                        <div className="mt-1">
                        <label htmlFor="image-upload" className="w-full text-center block bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold py-2 px-3 rounded-md cursor-pointer transition-colors text-xs">
                            Hoặc tải ảnh lên
                        </label>
                        <input 
                            id="image-upload" 
                            type="file" 
                            accept="image/*" 
                            onChange={handleImageUpload} 
                            className="hidden" 
                        />
                        </div>
                    </>
                )}
            </div>
        )
    },
    {
        key: 'text_styles',
        title: 'Text Styles',
        icon: <TemplateIcon />,
        condition: !!textLayer,
        content: (
             <div className="space-y-3">
                <div className="flex items-center space-x-1">
                    <button onClick={handleExportStyles} title="Xuất Styles" className="p-1.5 rounded-full hover:bg-slate-200 text-slate-500 transition-colors" aria-label="Xuất Styles">
                       <ExportStylesIcon />
                   </button>
                   <input id="import-styles-input-text" type="file" accept=".json,application/json" onChange={handleImportStyles} className="hidden" />
                   <label htmlFor="import-styles-input-text" title="Nhập Styles" className="p-1.5 rounded-full hover:bg-slate-200 text-slate-500 cursor-pointer transition-colors" aria-label="Nhập Styles">
                       <ImportStylesIcon />
                   </label>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto p-2 bg-slate-100 rounded-md border border-slate-200">
                {textStyles.map(style => (
                    <div key={style.id} className="p-2 rounded-md flex justify-between items-center text-sm font-medium text-slate-700 hover:bg-slate-200 bg-white group border border-slate-200/50">
                        <div className="flex items-center flex-grow min-w-0 cursor-pointer" onClick={() => onApplyTextStyle(style)}>
                            <div className="flex-shrink-0 w-8 h-8 mr-3 bg-white rounded-sm overflow-hidden border border-slate-300 flex items-center justify-center">
                                <StylePreview style={style} />
                            </div>
                            <span className="truncate pr-2">{style.name}</span>
                        </div>
                        <button onClick={() => onDeleteTextStyle(style.id)} className="flex-shrink-0 p-1 rounded-full text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600" title="Xóa Style">
                            <TrashIcon />
                        </button>
                    </div>
                ))}
                </div>
                <div className="flex space-x-2 pt-2 border-t border-slate-200">
                    <input
                        type="text"
                        placeholder="Tên style mới..."
                        value={newStyleName}
                        onChange={(e) => setNewStyleName(e.target.value)}
                        className={baseInputClasses}
                    />
                    <button onClick={handleSaveCurrentStyle} className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-3 rounded-md transition-colors text-xs">
                        Lưu
                    </button>
                      <button 
                        onClick={onResetTextStyle}
                        className="p-2 rounded-md hover:bg-slate-200 text-slate-500"
                        title="Reset định dạng"
                    >
                        <RevertIcon />
                    </button>
                </div>
            </div>
        )
    },
    {
        key: 'shape_styles',
        title: 'Shape Styles',
        icon: <TemplateIcon />,
        condition: !!shapeLayer,
        content: (
            <div className="space-y-3">
                 <div className="flex items-center space-x-1">
                    <button onClick={handleExportStyles} title="Xuất Styles" className="p-1.5 rounded-full hover:bg-slate-200 text-slate-500 transition-colors" aria-label="Xuất Styles">
                       <ExportStylesIcon />
                   </button>
                   <input id="import-styles-input-shape" type="file" accept=".json,application/json" onChange={handleImportStyles} className="hidden" />
                   <label htmlFor="import-styles-input-shape" title="Nhập Styles" className="p-1.5 rounded-full hover:bg-slate-200 text-slate-500 cursor-pointer transition-colors" aria-label="Nhập Styles">
                       <ImportStylesIcon />
                   </label>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto p-2 bg-slate-100 rounded-md border border-slate-200">
                {shapeStyles.map(style => (
                    <div key={style.id} className="p-2 rounded-md flex justify-between items-center text-sm font-medium text-slate-700 hover:bg-slate-200 bg-white group border border-slate-200/50">
                        <div className="flex items-center flex-grow min-w-0 cursor-pointer" onClick={() => onApplyShapeStyle(style)}>
                            <div className="flex-shrink-0 w-8 h-8 mr-3 bg-white rounded-sm overflow-hidden border border-slate-300 flex items-center justify-center">
                                <StylePreview style={style} />
                            </div>
                            <span className="truncate pr-2">{style.name}</span>
                        </div>
                        <button onClick={() => onDeleteShapeStyle(style.id)} className="flex-shrink-0 p-1 rounded-full text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600" title="Xóa Style">
                            <TrashIcon />
                        </button>
                    </div>
                ))}
                </div>
                <div className="flex space-x-2 pt-2 border-t border-slate-200">
                    <input
                        type="text"
                        placeholder="Tên style mới..."
                        value={newShapeStyleName}
                        onChange={(e) => setNewShapeStyleName(e.target.value)}
                        className={baseInputClasses}
                    />
                    <button onClick={handleSaveCurrentShapeStyle} className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-3 rounded-md transition-colors text-xs">
                        Lưu
                    </button>
                </div>
            </div>
        )
    },
    {
        key: 'effects',
        title: 'Hiệu ứng',
        icon: <EffectsIcon />,
        condition: !!selectedLayer,
        content: selectedLayer && (
            <div className="space-y-3">
                {/* Outer Glow Section */}
                <div className="flex items-center">
                    <input
                        type="checkbox"
                        id="enable-glow"
                        checked={selectedLayer.glow?.enabled || false}
                        onChange={(e) => handleGlowChange({ enabled: e.target.checked })}
                        className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <label htmlFor="enable-glow" className="ml-2 text-sm font-medium text-slate-700">Outer Glow</label>
                </div>
                {selectedLayer.glow?.enabled && (
                    <div className="space-y-3 pl-1 pt-2 border-t border-slate-200">
                        <InputField label="Độ mờ (Blur)">
                            <input type="range" min="0" max="100" value={selectedLayer.glow.blur} onChange={(e) => handleGlowChange({ blur: parseInt(e.target.value) || 0 })} className="w-full" />
                        </InputField>
                        <InputField label={`Độ trong suốt: ${selectedLayer.glow.opacity}%`}>
                            <input type="range" min="0" max="100" value={selectedLayer.glow.opacity} onChange={(e) => handleGlowChange({ opacity: parseInt(e.target.value) || 0 })} className="w-full" />
                        </InputField>
                        <ColorPicker
                            label="Màu tỏa sáng"
                            value={selectedLayer.glow.color}
                            onChange={(color) => handleGlowChange({ color })}
                        />
                    </div>
                )}

                {/* Drop Shadow Section */}
                <div className="flex items-center mt-3 pt-3 border-t border-slate-200/50">
                    <input
                        type="checkbox"
                        id="enable-shadow"
                        checked={selectedLayer.shadow?.enabled || false}
                        onChange={(e) => handleShadowChange({ enabled: e.target.checked })}
                        className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                    />
                    <label htmlFor="enable-shadow" className="ml-2 text-sm font-medium text-slate-700">Drop shadow</label>
                </div>
                {selectedLayer.shadow?.enabled && (
                    <div className="space-y-3 pl-1 pt-2 border-t border-slate-200">
                        <div className="grid grid-cols-2 gap-2">
                            <InputField label="Offset X">
                                <input type="number" value={selectedLayer.shadow.offsetX} onChange={(e) => handleShadowChange({ offsetX: parseInt(e.target.value) || 0 })} className={baseInputClasses} />
                            </InputField>
                            <InputField label="Offset Y">
                                <input type="number" value={selectedLayer.shadow.offsetY} onChange={(e) => handleShadowChange({ offsetY: parseInt(e.target.value) || 0 })} className={baseInputClasses} />
                            </InputField>
                        </div>
                        <InputField label="Độ mờ (Blur)">
                            <input type="range" min="0" max="100" value={selectedLayer.shadow.blur} onChange={(e) => handleShadowChange({ blur: parseInt(e.target.value) || 0 })} className="w-full" />
                        </InputField>
                        <InputField label={`Độ trong suốt: ${selectedLayer.shadow.opacity}%`}>
                            <input type="range" min="0" max="100" value={selectedLayer.shadow.opacity} onChange={(e) => handleShadowChange({ opacity: parseInt(e.target.value) || 0 })} className="w-full" />
                        </InputField>
                        <ColorPicker
                            label="Màu bóng đổ"
                            value={selectedLayer.shadow.color}
                            onChange={(color) => handleShadowChange({ color })}
                        />
                    </div>
                )}
            </div>
        )
    },
    {
        key: 'typography',
        title: 'Typography',
        icon: <UppercaseIcon />,
        condition: !!textLayer,
        content: textLayer && (
            <div className="space-y-3">
                <FontSelector 
                    fonts={fonts} 
                    selectedLayer={{
                        ...textLayer, 
                        fontFamily: typeof currentStyle.fontFamily === 'string' ? currentStyle.fontFamily : textLayer.fontFamily,
                        fontWeight: typeof currentStyle.fontWeight === 'number' ? currentStyle.fontWeight : textLayer.fontWeight,
                    }}
                    onStyleChange={onApplyStyleToSelection}
                    customFonts={customFonts}
                    onFontUpload={onFontUpload}
                    onDeleteCustomFont={onDeleteCustomFont}
                />
                <div className="grid grid-cols-4 gap-1 bg-slate-100 rounded-md p-1">
                    <StyleButton onClick={() => onToggleStyle('textTransform')} isActive={isUppercase} title="Viết hoa"><UppercaseIcon /></StyleButton>
                    <StyleButton onClick={() => onToggleStyle('underline')} isActive={isUnderline} title="Gạch chân"><UnderlineIcon /></StyleButton>
                    <StyleButton onClick={() => onToggleStyle('strikethrough')} isActive={isStrikethrough} title="Gạch ngang"><StrikethroughIcon /></StyleButton>
                    <StyleButton onClick={() => onToggleStyle('textScript')} isActive={isSuperscript} title="Chữ trên"><SuperscriptIcon /></StyleButton>
                </div>
                <div className="grid grid-cols-2 gap-2">
                <InputField label="Cỡ chữ">
                    <select 
                    value={(typeof currentStyle.fontSize === 'number' ? currentStyle.fontSize : '')} 
                    onChange={(e) => {
                        const newSize = parseInt(e.target.value, 10);
                        onApplyStyleToSelection({ fontSize: isNaN(newSize) ? undefined : newSize });
                    }} 
                    className={baseInputClasses}
                    >
                    {finalFontSizes.map(size => (
                        <option key={size} value={size}>{size}</option>
                    ))}
                    </select>
                </InputField>
                <InputField label="Căn lề">
                    <div className="grid grid-cols-3 gap-1 bg-slate-100 rounded-md p-1 h-full items-center">
                        <button onClick={() => handleLayerPropChange({ textAlign: 'left' })} title="Căn trái" className={`p-2 rounded-md transition-colors ${textLayer.textAlign === 'left' ? 'bg-indigo-200 text-indigo-700' : 'text-slate-600 hover:bg-slate-200'}`}><TextAlignLeftIcon /></button>
                        <button onClick={() => handleLayerPropChange({ textAlign: 'center' })} title="Căn giữa" className={`p-2 rounded-md transition-colors ${(!textLayer.textAlign || textLayer.textAlign === 'center') ? 'bg-indigo-200 text-indigo-700' : 'text-slate-600 hover:bg-slate-200'}`}><TextAlignCenterIcon /></button>
                        <button onClick={() => handleLayerPropChange({ textAlign: 'right' })} title="Căn phải" className={`p-2 rounded-md transition-colors ${textLayer.textAlign === 'right' ? 'bg-indigo-200 text-indigo-700' : 'text-slate-600 hover:bg-slate-200'}`}><TextAlignRightIcon /></button>
                    </div>
                </InputField>
                </div>
                {textLayer && (() => {
                let displayColor = textLayer.color;
                let isMixed = false;
                
                const hasSelection = selectionState && selectionState.hasSelection && selectionState.layerId === textLayer.id;

                if (hasSelection) {
                    const selectionColor = selectionState.styles.color;
                    if (typeof selectionColor === 'string') {
                        displayColor = selectionColor;
                        isMixed = false;
                    } else if (selectionColor === 'mixed') {
                        isMixed = true;
                        displayColor = textLayer.color;
                    } else {
                        displayColor = textLayer.color;
                        isMixed = true;
                    }
                } else {
                    const spansWithText = textLayer.spans.filter(s => s.text.length > 0);
                    if (spansWithText.length > 0) {
                        const firstColor = spansWithText[0].color || textLayer.color;
                        const allSame = spansWithText.every(s => (s.color || textLayer.color) === firstColor);
                        if (allSame) {
                            displayColor = firstColor;
                        } else {
                            isMixed = true;
                        }
                    }
                }
                
                return (
                    <ColorPicker
                        label="Màu chữ"
                        value={displayColor}
                        onChange={(color) => onApplyStyleToSelection({ color: color })}
                        isMixed={isMixed}
                    />
                );
                })()}
                {selectionState && selectionState.hasSelection && selectionState.layerId === selectedLayer?.id && (
                <div className="pt-3 border-t border-slate-200 mt-3">
                    <button 
                        onClick={onSplitTextLayer} 
                        className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-3 rounded-md transition-colors text-xs flex items-center justify-center"
                    >
                        <SplitIcon />
                        <span className="ml-2">Tách văn bản đã chọn</span>
                    </button>
                </div>
                )}
            </div>
        )
    },
    {
        key: 'strokes',
        title: textLayer ? "Viền chữ" : "Viền Shape",
        icon: <PencilIcon />,
        condition: !!textLayer || !!shapeLayer,
        content: (
             <div className="space-y-3">
                {((textLayer || shapeLayer)?.strokes || []).map((stroke, index) => (
                    <div key={stroke.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-slate-600">Viền {index + 1}</label>
                            <button onClick={() => handleDeleteStroke(stroke.id)} className="p-1 rounded-full text-slate-400 hover:bg-red-100 hover:text-red-600" title="Xóa viền">
                                <TrashIcon />
                            </button>
                        </div>
                        <InputField label="Độ dày">
                            <input type="number" value={stroke.width} onChange={(e) => handleUpdateStroke(stroke.id, { width: parseInt(e.target.value, 10) || 0 })} className={baseInputClasses} min="0" />
                        </InputField>
                        <ColorPicker label="Màu viền" value={stroke.color} onChange={(color) => handleUpdateStroke(stroke.id, { color })} />
                    </div>
                ))}
                <button onClick={handleAddStroke} className="w-full bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-2 px-3 rounded-md transition-colors text-xs flex items-center justify-center">
                    <PlusIcon /> <span className="ml-1">Thêm viền</span>
                </button>
            </div>
        )
    },
    {
      key: 'guides',
      title: 'Quản lý Guide',
      icon: <GuidesIcon />,
      condition: !!activeArtboard,
      content: (
        <div className="p-2">
            <div className="flex items-center space-x-1 bg-slate-100 rounded-md p-0.5">
                <div className="flex-grow flex items-stretch">
                    <button onClick={onOpenGuideManager} className="flex-grow hover:bg-slate-200 text-slate-700 font-semibold py-1.5 px-2 rounded-md transition-colors text-xs flex items-center justify-center">
                        Cài đặt nâng cao
                    </button>
                </div>
                <div className="flex-shrink-0 flex items-center border-l border-slate-400/50 pl-1 space-x-0.5">
                    <button
                        onClick={() => onSettingsChange({ ...guideSettings, snapToGuides: !guideSettings.snapToGuides })}
                        className={`p-1.5 rounded-md transition-colors ${guideSettings.snapToGuides ? 'bg-indigo-100 text-indigo-600' : 'text-slate-500 hover:bg-slate-200'}`}
                        title="Bật/Tắt hít vào đường gióng"
                    >
                        <SnapIcon />
                    </button>
                    <button 
                        onClick={() => onSettingsChange({ ...guideSettings, visible: !guideSettings.visible })}
                        className={`p-1.5 rounded-md transition-colors ${guideSettings.visible ? 'bg-indigo-100 text-indigo-600' : 'text-slate-500 hover:bg-slate-200'}`}
                        title={`Ẩn/Hiện Guides (Ctrl + ;)`}
                    >
                        {guideSettings.visible ? <EyeIcon /> : <EyeOffIcon />}
                    </button>
                    <button
                        onClick={() => onSettingsChange({ ...guideSettings, locked: !guideSettings.locked })}
                        className={`p-1.5 rounded-md transition-colors ${guideSettings.locked ? 'bg-indigo-100 text-indigo-600' : 'text-slate-500 hover:bg-slate-200'}`}
                        title={guideSettings.locked ? 'Mở khóa di chuyển Guides' : 'Khóa di chuyển Guides'}
                    >
                        {guideSettings.locked ? <LockClosedIcon /> : <LockOpenIcon />}
                    </button>
                    <button
                        onClick={onClearGuides}
                        className="p-1.5 rounded-md text-slate-500 hover:bg-red-100 hover:text-red-600 transition-colors"
                        title="Xóa tất cả Guides"
                    >
                        <TrashIcon />
                    </button>
                </div>
            </div>
        </div>
      )
    }
  ];

  useEffect(() => {
    const availablePanelKeys = panelsConfig.filter(p => p.condition).map(p => p.key);

    // If the currently open panel is still valid for the selection, do nothing to prevent it from resetting.
    if (activePanelKey && availablePanelKeys.includes(activePanelKey)) {
      return;
    }

    // If no panel is open, or the current one is invalid (e.g., selection changed), set a sensible default.
    if (selectedLayers.length === 0 && activeArtboard) {
      setActivePanelKey('artboard');
    } else if (selectedLayer) {
      // A single layer is selected, determine its default panel.
      if (selectedLayer.type === LayerType.Text) {
        setActivePanelKey('typography');
      } else {
        setActivePanelKey('properties');
      }
    } else {
      // No selection, or multi-selection where panels are not configured to show.
      setActivePanelKey(null);
    }
  }, [selectedLayer, selectedLayers.length, activeArtboard, activePanelKey]);

  if (position === 'left') {
    return null;
  }
  
  const availablePanels = panelsConfig.filter(p => p.condition);
  const expandedPanel = availablePanels.find(p => p.key === activePanelKey);

  if (position === 'right') {
      if (!activeArtboard) {
          return (
            <div className="w-64 bg-white p-8 rounded-lg shadow-md border border-slate-200 text-center text-slate-500 text-sm">
                Chọn một artboard để bắt đầu chỉnh sửa.
            </div>
          );
      }
      return (
        <div className="flex items-start space-x-2">
            <div className="flex flex-col space-y-2">
                {availablePanels.map(panel => (
                    <div 
                        key={panel.key}
                        title={panel.title}
                        onClick={() => setActivePanelKey(panel.key === activePanelKey ? null : panel.key)}
                        className={`w-12 h-12 bg-white rounded-lg shadow-md border flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors ${activePanelKey === panel.key ? 'text-indigo-600 border-indigo-300' : 'text-slate-600 border-slate-200'}`}
                    >
                        {panel.icon}
                    </div>
                ))}
            </div>

            {expandedPanel && (
                <div className="w-80 bg-white rounded-lg shadow-md border border-slate-200 text-sm flex flex-col max-h-[calc(100vh-18rem)]">
                    <div className="w-full flex justify-between items-center p-2 text-left font-bold text-slate-800 border-b border-slate-200 flex-shrink-0">
                        <div className="flex items-center space-x-2">
                            <div className="p-1 bg-slate-100 rounded text-slate-600">{expandedPanel.icon}</div>
                            <span>{expandedPanel.title}</span>
                        </div>
                        <button onClick={() => setActivePanelKey(null)} className="p-1.5 rounded-full hover:bg-slate-200 text-slate-500">
                            <CloseIcon />
                        </button>
                    </div>
                    <div className="bg-white p-4 space-y-3 overflow-y-auto flex-1">
                        {expandedPanel.content}
                    </div>
                </div>
            )}
        </div>
      );
  }

  return null;
};

export default EditorPanel;