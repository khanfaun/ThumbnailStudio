import React, { useRef } from 'react';
import { Layer } from '../types';

interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface SelectionBoxProps {
  boundingBox: BoundingBox;
  selectedLayers: Layer[];
  onUpdateLayersLive: (updates: { id: string, updates: Partial<Layer> }[]) => void;
  onInteractionEnd: () => void;
  zoom: number;
  isSpacePressedRef: React.RefObject<boolean>;
}

const RESIZE_HANDLE_SIZE = 8;
const ROTATION_HANDLE_OFFSET = 20;

const rotatePoint = (x: number, y: number, cx: number, cy: number, angle: number) => {
    const rad = angle * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const nx = (cos * (x - cx)) + (sin * (y - cy)) + cx;
    const ny = (cos * (y - cy)) - (sin * (x - cx)) + cy;
    return { x: nx, y: ny };
};

const SelectionBox: React.FC<SelectionBoxProps> = ({
  boundingBox,
  selectedLayers,
  onUpdateLayersLive,
  onInteractionEnd,
  zoom,
  isSpacePressedRef,
}) => {
  const interactionRef = useRef<any>({ type: null });

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, interactionType: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (isSpacePressedRef.current) return;

    const artboardRect = (e.currentTarget as HTMLElement).closest('[data-artboard-id]')?.getBoundingClientRect();
    if (!artboardRect) return;
    
    const { x, y, width, height } = boundingBox;

    interactionRef.current = {
      type: interactionType,
      startX: e.clientX,
      startY: e.clientY,
      initialBox: { ...boundingBox, rotation: 0 }, // Group rotation starts at 0
      initialLayers: JSON.parse(JSON.stringify(selectedLayers)), // Deep copy
      centerX: x + width / 2,
      centerY: y + height / 2,
      moveAxis: null,
    };
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
        moveEvent.preventDefault();
        const { type, startX, startY, initialBox, initialLayers, centerX, centerY } = interactionRef.current;
        const dx = (moveEvent.clientX - startX) / zoom;
        const dy = (moveEvent.clientY - startY) / zoom;

        let updates: { id: string, updates: Partial<Layer> }[] = [];

        if (type === 'move') {
            let finalDx = dx;
            let finalDy = dy;

            if (moveEvent.shiftKey) {
                if (!interactionRef.current.moveAxis) {
                    if (Math.abs(dx) > Math.abs(dy)) {
                        interactionRef.current.moveAxis = 'horizontal';
                    } else {
                        interactionRef.current.moveAxis = 'vertical';
                    }
                }
            } else {
                interactionRef.current.moveAxis = null;
            }

            if (interactionRef.current.moveAxis === 'horizontal') {
                finalDy = 0;
            } else if (interactionRef.current.moveAxis === 'vertical') {
                finalDx = 0;
            }

            updates = initialLayers.map((layer: Layer) => ({
                id: layer.id,
                updates: { x: layer.x + finalDx, y: layer.y + finalDy }
            }));
        } else if (type === 'rotate') {
            const angle = Math.atan2(moveEvent.clientY - (artboardRect.top + centerY * zoom), moveEvent.clientX - (artboardRect.left + centerX * zoom)) * (180 / Math.PI);
            const angleDiff = angle + 90 - initialBox.rotation;

            updates = initialLayers.map((layer: Layer) => {
                const layerCenterX = layer.x + layer.width / 2;
                const layerCenterY = layer.y + layer.height / 2;
                const rotated = rotatePoint(layerCenterX, layerCenterY, centerX, centerY, angleDiff);

                return {
                    id: layer.id,
                    updates: {
                        x: rotated.x - layer.width / 2,
                        y: rotated.y - layer.height / 2,
                        rotation: layer.rotation + angleDiff,
                    }
                };
            });
        } else if (type.startsWith('resize-')) {
            const rad = (initialBox.rotation * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);

            // Rotate mouse delta into the box's coordinate system
            const rotatedDx = dx * cos + dy * sin;
            const rotatedDy = -dx * sin + dy * cos;

            let newBoxWidth = initialBox.width;
            let newBoxHeight = initialBox.height;

            if (type.includes('r')) newBoxWidth += rotatedDx;
            if (type.includes('l')) newBoxWidth -= rotatedDx;
            if (type.includes('b')) newBoxHeight += rotatedDy;
            if (type.includes('t')) newBoxHeight -= rotatedDy;
            
            newBoxWidth = Math.max(20, newBoxWidth);
            newBoxHeight = Math.max(20, newBoxHeight);
            
            const scaleX = newBoxWidth / initialBox.width;
            const scaleY = newBoxHeight / initialBox.height;

            const widthChange = newBoxWidth - initialBox.width;
            const heightChange = newBoxHeight - initialBox.height;

            let cxChange = 0; let cyChange = 0;
            if (type.includes('l')) cxChange = -widthChange / 2;
            if (type.includes('r')) cxChange = widthChange / 2;
            if (type.includes('t')) cyChange = -heightChange / 2;
            if (type.includes('b')) cyChange = heightChange / 2;

            const worldCxChange = cxChange * cos - cyChange * sin;
            const worldCyChange = cxChange * sin + cyChange * cos;
            
            const newBoxCenterX = centerX + worldCxChange;
            const newBoxCenterY = centerY + worldCyChange;

            updates = initialLayers.map((layer: Layer) => {
                // Calculate original layer center relative to the original box center
                const relCenterX = (layer.x + layer.width / 2) - initialBox.x - initialBox.width/2;
                const relCenterY = (layer.y + layer.height / 2) - initialBox.y - initialBox.height/2;

                const newWidth = layer.width * scaleX;
                const newHeight = layer.height * scaleY;

                return {
                    id: layer.id,
                    updates: {
                        x: (newBoxCenterX + relCenterX * scaleX) - newWidth / 2,
                        y: (newBoxCenterY + relCenterY * scaleY) - newHeight / 2,
                        width: newWidth,
                        height: newHeight,
                    }
                };
            });
        }

        if (updates.length > 0) {
            onUpdateLayersLive(updates);
        }
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
        upEvent.preventDefault();
        onInteractionEnd();
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };
  
  const resizeHandles = [
      { id: 'tl', cursor: 'nwse-resize' }, { id: 't', cursor: 'ns-resize' },
      { id: 'tr', cursor: 'nesw-resize' }, { id: 'l', cursor: 'ew-resize' },
      { id: 'r', cursor: 'ew-resize' }, { id: 'bl', cursor: 'nesw-resize' },
      { id: 'b', cursor: 'ns-resize' }, { id: 'br', cursor: 'nwse-resize' },
  ];

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: boundingBox.x,
        top: boundingBox.y,
        width: boundingBox.width,
        height: boundingBox.height,
        outline: '2px solid #6366f1', // indigo-500
      }}
    >
      {/* Rotation Handle */}
      <div 
        className={`absolute w-5 h-5 bg-white border-2 border-indigo-500 rounded-full shadow-md cursor-alias pointer-events-all`}
        style={{ 
            top: `-${ROTATION_HANDLE_OFFSET + (RESIZE_HANDLE_SIZE / 2)}px`, 
            left: `calc(50% - ${RESIZE_HANDLE_SIZE}px / 2 - 1px)`,
        }}
        onMouseDown={(e) => handleMouseDown(e, 'rotate')}
      />
      <div 
          className={`absolute left-1/2 w-px bg-indigo-500`} 
          style={{ height: `${ROTATION_HANDLE_OFFSET}px`, bottom: '100%' }}
      />
      
      {/* Resize Handles */}
      {resizeHandles.map(handle => (
          <div 
              key={handle.id}
              className={`absolute w-4 h-4 bg-white border-2 border-indigo-500 rounded-full shadow-md pointer-events-all`}
              style={{
                  cursor: handle.cursor,
                  top: handle.id.includes('t') ? `-${RESIZE_HANDLE_SIZE/2}px` : handle.id.includes('b') ? `calc(100% - ${RESIZE_HANDLE_SIZE/2}px)` : `calc(50% - ${RESIZE_HANDLE_SIZE/2}px)`,
                  left: handle.id.includes('l') ? `-${RESIZE_HANDLE_SIZE/2}px` : handle.id.includes('r') ? `calc(100% - ${RESIZE_HANDLE_SIZE/2}px)` : `calc(50% - ${RESIZE_HANDLE_SIZE/2}px)`,
              }}
              onMouseDown={(e) => handleMouseDown(e, `resize-${handle.id}`)}
          />
      ))}
    </div>
  );
};

export default SelectionBox;