import React, {useState} from 'react';
import { Artboard, Layer, Guide } from '../types';
import TransformableObject from './TransformableObject';
import SelectionBox from './SelectionBox';
// Fix: Import SelectionState from useAppLogic where it is defined and exported.
import { SelectionState, GuideSettings } from '../hooks/useAppLogic';

interface ArtboardProps {
  artboard: Artboard;
  isActive: boolean;
  selectedLayerIds: string[];
  keyObjectLayerId: string | null;
  onSelectArtboard: () => void;
  onLayerSelection: (layerId: string, options: { isCtrl: boolean, isShift: boolean }, source: 'panel' | 'canvas') => void;
  onUpdateLayerLive: (layerId: string, updates: Partial<Layer>) => void;
  onUpdateLayersLive: (updates: { id: string; updates: Partial<Layer> }[]) => void;
  onUpdateLayerAndCommit: (layerId: string, updates: Partial<Layer>) => void;
  // FIX: Added `onUpdateArtboard` prop to allow modifying artboard-level properties like guides.
  onUpdateArtboard: (artboardId: string, updates: Partial<Artboard>) => void;
  onInteractionEnd: () => void;
  zoom: number;
  onSelectionChange: (state: SelectionState | null) => void;
  selectionState: SelectionState | null;
  guideSettings: GuideSettings;
  onDuplicateLayer: (id: string, overrides?: Partial<Layer>) => void;
  isSpacePressedRef: React.RefObject<boolean>;
}

interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface GuideLineProps {
  guide: Guide;
  zoom: number;
  settings: GuideSettings;
  onUpdate: (id: string, newPosition: number) => void;
  onDelete: (id: string) => void;
}

const GuideLine: React.FC<GuideLineProps> = ({ guide, zoom, settings, onUpdate, onDelete }) => {
    const handleMouseDown = (e: React.MouseEvent) => {
        if (settings.locked) return;
        e.preventDefault();
        e.stopPropagation();

        const startPosition = guide.position;
        const startMousePos = guide.orientation === 'horizontal' ? e.clientY : e.clientX;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const currentMousePos = guide.orientation === 'horizontal' ? moveEvent.clientY : moveEvent.clientX;
            const mouseDelta = currentMousePos - startMousePos;
            const newPosition = startPosition + (mouseDelta / zoom);
            onUpdate(guide.id, newPosition);
        };
        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };
    
    const style: React.CSSProperties = {
        backgroundColor: guide.color || settings.color,
    };
    if (guide.orientation === 'horizontal') {
        style.top = guide.position;
        style.left = -10000;
        style.right = -10000;
        style.width = 'auto';
    } else {
        style.left = guide.position;
        style.top = -10000;
        style.bottom = -10000;
        style.height = 'auto';
    }

    return (
        <div
            className={`guide-line ${guide.orientation} ${settings.locked ? 'pointer-events-none' : ''}`}
            style={style}
            onMouseDown={handleMouseDown}
        >
          {!settings.locked && (
            <div 
              className="guide-line-delete-btn"
              onClick={(e) => { e.stopPropagation(); onDelete(guide.id); }}
            >
              ×
            </div>
          )}
        </div>
    );
};


const getBoundingBoxOfLayers = (layers: Layer[]): BoundingBox => {
    if (layers.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
    
    const allCorners = layers.flatMap(layer => {
        const { x, y, width, height, rotation } = layer;
        const rad = rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const cx = x + width / 2;
        const cy = y + height / 2;
        const corners = [
            { x: -width / 2, y: -height / 2 },
            { x: width / 2, y: -height / 2 },
            { x: width / 2, y: height / 2 },
            { x: -width / 2, y: height / 2 },
        ];
        return corners.map(corner => ({
            x: cx + corner.x * cos - corner.y * sin,
            y: cy + corner.x * sin + corner.y * cos,
        }));
    });

    const minX = Math.min(...allCorners.map(c => c.x));
    const minY = Math.min(...allCorners.map(c => c.y));
    const maxX = Math.max(...allCorners.map(c => c.x));
    const maxY = Math.max(...allCorners.map(c => c.y));

    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
};


const ArtboardComponent: React.FC<ArtboardProps> = ({
  artboard,
  isActive,
  selectedLayerIds,
  keyObjectLayerId,
  onSelectArtboard,
  onLayerSelection,
  onUpdateLayerLive,
  onUpdateLayersLive,
  onUpdateLayerAndCommit,
  onUpdateArtboard,
  onInteractionEnd,
  zoom,
  onSelectionChange,
  selectionState,
  guideSettings,
  onDuplicateLayer,
  isSpacePressedRef,
}) => {
  const [activeSnapLines, setActiveSnapLines] = useState<{h: number[], v: number[]}>({h: [], v: []});

  const handleArtboardMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // If text is being edited and has a selection, prevent clicks on the
    // artboard background from deselecting the layer. This allows the user
    // to click away without losing their selection context.
    if (selectionState && selectionState.hasSelection) {
        return;
    }
    if (e.target === e.currentTarget) {
        onLayerSelection('', { isCtrl: false, isShift: false }, 'canvas'); // Deselect all
    }
    onSelectArtboard();
  };

  const sortedLayers = [...artboard.layers]
    .filter(l => l.visible ?? true)
    .sort((a, b) => a.zIndex - b.zIndex);
  const selectedLayers = sortedLayers.filter(l => selectedLayerIds.includes(l.id));
  const selectionBoundingBox = selectedLayerIds.length > 1 ? getBoundingBoxOfLayers(selectedLayers) : null;
  
  const handleUpdateGuide = (id: string, newPosition: number) => {
      const newGuides = artboard.guides?.map(g => g.id === id ? { ...g, position: newPosition } : g);
      // FIX: Used `onUpdateArtboard` to correctly update the `guides` property on the artboard.
      onUpdateArtboard(artboard.id, { guides: newGuides });
  };
  const handleDeleteGuide = (id: string) => {
      const newGuides = artboard.guides?.filter(g => g.id !== id);
      // FIX: Used `onUpdateArtboard` to correctly update the `guides` property on the artboard.
      onUpdateArtboard(artboard.id, { guides: newGuides });
  };


  return (
    <div
      data-artboard-id={artboard.id}
      className={`relative shadow-lg overflow-hidden cursor-default ${isActive ? 'ring-2 ring-indigo-500 ring-offset-4 ring-offset-slate-200/75' : 'ring-1 ring-slate-300'}`}
      style={{
        width: artboard.width,
        height: artboard.height,
        backgroundColor: artboard.backgroundColor,
      }}
      onMouseDown={handleArtboardMouseDown}
    >
      {guideSettings.visible && (
        <div className="absolute inset-0 pointer-events-none">
            {artboard.guides?.map(guide => (
                <GuideLine key={guide.id} guide={guide} zoom={zoom} settings={guideSettings} onUpdate={handleUpdateGuide} onDelete={handleDeleteGuide} />
            ))}
            {activeSnapLines.h.map((pos, i) => <div key={`sh-${i}`} className="snap-indicator horizontal" style={{top: pos}} />)}
            {activeSnapLines.v.map((pos, i) => <div key={`sv-${i}`} className="snap-indicator vertical" style={{left: pos}} />)}
        </div>
      )}
      {sortedLayers.map(layer => {
          const selectionStatus = keyObjectLayerId === layer.id
              ? 'key'
              : selectedLayerIds.includes(layer.id)
                  ? 'selected'
                  : 'none';

          return (
            <TransformableObject
              key={layer.id}
              layer={layer}
              selectedLayers={selectedLayers}
              selectionStatus={selectionStatus}
              showHandles={selectedLayerIds.length <= 1}
              onSelect={(e) => {
                onSelectArtboard();
                onLayerSelection(layer.id, { isCtrl: e.ctrlKey || e.metaKey, isShift: e.shiftKey }, 'canvas');
              }}
              onDeselect={() => onLayerSelection('', { isCtrl: false, isShift: false }, 'canvas')} // Deselect all
              onUpdateLive={(updates) => onUpdateLayerLive(layer.id, updates)}
              onUpdateLayersLive={onUpdateLayersLive}
              onUpdateLayerAndCommit={(updates) => onUpdateLayerAndCommit(layer.id, updates)}
              onInteractionEnd={onInteractionEnd}
              artboardBounds={{ width: artboard.width, height: artboard.height }}
              zoom={zoom}
              onSelectionChange={onSelectionChange}
              guides={artboard.guides || []}
              onSnap={setActiveSnapLines}
              guideSettings={guideSettings}
              onDuplicateLayer={onDuplicateLayer}
              isSpacePressedRef={isSpacePressedRef}
            />
          )
      })}
      {selectionBoundingBox && (
          <SelectionBox
            boundingBox={selectionBoundingBox}
            selectedLayers={selectedLayers}
            onUpdateLayersLive={onUpdateLayersLive}
            onInteractionEnd={onInteractionEnd}
            zoom={zoom}
            isSpacePressedRef={isSpacePressedRef}
          />
      )}
    </div>
  );
};

export default ArtboardComponent;