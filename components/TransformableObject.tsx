import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Layer, LayerType, TextLayer, ImageLayer, TextSpan, AnyShapeLayer, ShapeType, Guide, LineLayer, LineEndCapShape } from '../types';
// FIX: Import `SelectionStyleInfo` to correctly type the local styles object.
import { SelectionState, SelectionStyleInfo, GuideSettings } from '../hooks/useAppLogic';
import { generateTextEffectsCss } from '../utils/text';
import { getPolygonPathD } from '../utils/shapes';
import { getStyleStateForRange, getPropertyStateForRange } from '../utils/text';

type SelectionStatus = 'none' | 'selected' | 'key';

interface TransformableObjectProps {
  layer: Layer;
  selectedLayers: Layer[];
  selectionStatus: SelectionStatus;
  showHandles: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onDeselect: () => void;
  onUpdateLive: (updates: Partial<Layer>) => void;
  onUpdateLayersLive: (updates: { id: string; updates: Partial<Layer> }[]) => void;
  onUpdateLayerAndCommit: (updates: Partial<Layer>) => void;
  onInteractionEnd: () => void;
  artboardBounds: { width: number; height: number };
  zoom: number;
  onSelectionChange: (state: SelectionState | null) => void;
  guides: Guide[];
  onSnap: (snapLines: { h: number[], v: number[] }) => void;
  guideSettings: GuideSettings;
  onDuplicateLayer: (id: string, overrides?: Partial<Layer>) => void;
  isSpacePressedRef: React.RefObject<boolean>;
}

const RESIZE_HANDLE_SIZE = 8;
const ROTATION_HANDLE_OFFSET = 20;
const SNAP_TOLERANCE = 5; // in screen pixels

const hexToRgba = (hex: string, opacity: number): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return `rgba(0, 0, 0, ${opacity / 100})`;
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
};

const TransformableObject: React.FC<TransformableObjectProps> = ({
  layer,
  selectedLayers,
  selectionStatus,
  showHandles,
  onSelect,
  onDeselect,
  onUpdateLive,
  onUpdateLayersLive,
  onUpdateLayerAndCommit,
  onInteractionEnd,
  zoom,
  onSelectionChange,
  guides,
  onSnap,
  guideSettings,
  onDuplicateLayer,
  isSpacePressedRef,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const objectRef = useRef<HTMLDivElement>(null);
  const textContainerRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<any>({ type: null }); // To store interaction state
  const justResized = useRef(false);

  const { x, y, width, height, rotation, locked } = layer;
  const isSelected = selectionStatus === 'selected' || selectionStatus === 'key';

  // Stop editing when layer is deselected
  useEffect(() => {
    if (!isSelected) {
      setIsEditing(false);
    }
  }, [isSelected]);

  // Auto-adjust text layer size to fit content
  useEffect(() => {
    if (
      layer.type === LayerType.Text &&
      textContainerRef.current &&
      !interactionRef.current.type // Only run when not interacting (e.g., resizing)
    ) {
      const PADDING_V = 2; // A small buffer to avoid scrollbars or clipping
      const PADDING_H = 4; // Horizontal padding
      
      const textLayer = layer as TextLayer;
      const el = textContainerRef.current;
      const newHeight = el.scrollHeight + PADDING_V;
      const newWidth = el.scrollWidth + PADDING_H;
      
      const updates: Partial<Layer> = {};

      // Always adjust height and recenter vertically
      if (Math.abs(textLayer.height - newHeight) > 1) {
        const heightDifference = textLayer.height - newHeight;
        updates.height = newHeight;
        updates.y = textLayer.y + heightDifference / 2;
      }
      
      // Adjust width and recenter horizontally, but only if not manually resized/editing
      if (!justResized.current && !isEditing) {
        if (Math.abs(textLayer.width - newWidth) > 1) {
          const widthDifference = textLayer.width - newWidth;
          updates.width = newWidth;
          
          switch (textLayer.textAlign) {
              case 'left':
                  // Anchor is left, do nothing to x
                  break;
              case 'right':
                  // Anchor is right, update x to keep right edge stationary
                  updates.x = textLayer.x + widthDifference;
                  break;
              case 'center':
              default:
                  // Anchor is center, update x to keep center stationary
                  updates.x = textLayer.x + widthDifference / 2;
                  break;
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        onUpdateLayerAndCommit(updates);
      }
    }
  }, [
      layer.type === LayerType.Text ? layer.spansVersion : undefined,
      layer.width,
      layer.type === LayerType.Text ? layer.fontSize : undefined,
      layer.type === LayerType.Text ? layer.fontFamily : undefined,
      layer.type === LayerType.Text ? layer.fontWeight : undefined,
      layer.type === LayerType.Text ? layer.textAlign : undefined,
      layer.height, // Rerun if height is changed externally
      onUpdateLayerAndCommit,
      layer.type,
      isEditing, // Add isEditing to ensure effect runs when editing stops
      layer.x,
      layer.y,
  ]);


  // Handle Text Selection Change
  const handleSelectionChange = useCallback(() => {
      if (layer.type !== LayerType.Text || !isEditing || !textContainerRef.current) {
        onSelectionChange(null);
        return;
      }
      const textLayer = layer as TextLayer;

      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        onSelectionChange(null);
        return;
      }

      const range = selection.getRangeAt(0);
      const { startContainer, startOffset, endContainer, endOffset } = range;

      // Ensure selection is within the editable area
      if (!textContainerRef.current.contains(startContainer) || !textContainerRef.current.contains(endContainer)) {
        onSelectionChange(null);
        return;
      }

      const isCollapsed = range.collapsed;

      // --- Calculate absolute character index using TreeWalker ---
      const getCharOffset = (targetNode: Node, targetOffset: number): number => {
        let offset = 0;
        const walker = document.createTreeWalker(textContainerRef.current!, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          if (node === targetNode) {
            return offset + targetOffset;
          }
          offset += node.textContent?.length || 0;
        }
        return offset; // Fallback
      };
      
      const startIdx = getCharOffset(startContainer, startOffset);
      const endIdx = getCharOffset(endContainer, endOffset);
      const selectionRange = { start: Math.min(startIdx, endIdx), end: Math.max(startIdx, endIdx) };

      // --- Determine current style for the editor panel ---
      const styles: SelectionStyleInfo = {};
      
          // FIX: Cast the return type of `getPropertyStateForRange` to match the more specific
          // types of the `SelectionStyleInfo` interface. The function's broad return type
          // (`string | number | 'mixed'`) causes a mismatch for properties expecting only
          // a string or only a number.
          styles.fontFamily = getPropertyStateForRange(textLayer, selectionRange, 'fontFamily') as string | 'mixed' | undefined;
          styles.fontSize = getPropertyStateForRange(textLayer, selectionRange, 'fontSize') as number | 'mixed' | undefined;
          styles.color = getPropertyStateForRange(textLayer, selectionRange, 'color') as string | 'mixed' | undefined;
          styles.fontWeight = getPropertyStateForRange(textLayer, selectionRange, 'fontWeight') as number | 'mixed' | undefined;

      // Get accurate toggle states
      styles.underline = getStyleStateForRange(textLayer.spans, selectionRange, 'underline');
      styles.strikethrough = getStyleStateForRange(textLayer.spans, selectionRange, 'strikethrough');
      const textScriptResult = getStyleStateForRange(textLayer.spans, selectionRange, 'textScript');
      styles.textScript = textScriptResult === 'mixed' ? 'mixed' : textScriptResult ? 'superscript' : 'normal';
      const textTransformResult = getStyleStateForRange(textLayer.spans, selectionRange, 'textTransform');
      styles.textTransform = textTransformResult === 'mixed' ? 'mixed' : textTransformResult ? 'uppercase' : 'none';

      onSelectionChange({
        layerId: layer.id,
        styles,
        hasSelection: !isCollapsed,
        range: selectionRange,
      });

    }, [layer, isEditing, onSelectionChange]);
  
  // Add/remove selectionchange listener
  useEffect(() => {
      if (isEditing) {
          document.addEventListener('selectionchange', handleSelectionChange);
      }
      return () => {
          document.removeEventListener('selectionchange', handleSelectionChange);
      };
  }, [isEditing, handleSelectionChange]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, interactionType: string) => {
    if (locked || isEditing || isSpacePressedRef.current) return;
    
    if (interactionType.startsWith('resize-')) {
      justResized.current = true;
    }

    // Propagate the selection event up to the App component first
    onSelect(e);

    // Prevent default behavior which might cause issues, and stop propagation
    // so we don't accidentally trigger artboard-level deselect.
    e.preventDefault();
    e.stopPropagation();

    const artboardRect = objectRef.current?.closest('[data-artboard-id]')?.getBoundingClientRect();
    if (!artboardRect) return;
    
    const isGroupInteraction = selectedLayers.length > 1 && interactionType === 'move';

    interactionRef.current = {
      type: interactionType,
      startX: e.clientX,
      startY: e.clientY,
      initialX: x,
      initialY: y,
      initialWidth: width,
      initialHeight: height,
      initialRotation: rotation,
      initialLayers: (isGroupInteraction || layer.type === LayerType.Text) ? JSON.parse(JSON.stringify(selectedLayers)) : null,
      centerX: x + width / 2,
      centerY: y + height / 2,
      artboardRect: artboardRect,
      moveAxis: null,
      isDuplicating: interactionType === 'move' && e.altKey,
    };
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      const { type, startX, startY, initialX, initialY, initialWidth, initialHeight, initialLayers, centerX, centerY, artboardRect: currentArtboardRect } = interactionRef.current;
      
      const dx = (moveEvent.clientX - startX) / zoom;
      const dy = (moveEvent.clientY - startY) / zoom;

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
        
        let targetX = initialX + finalDx;
        let targetY = initialY + finalDy;
        const snapThreshold = SNAP_TOLERANCE / zoom;
        const activeSnaps = { v: [] as number[], h: [] as number[] };

        if (guideSettings.snapToGuides && guides.length > 0) {
            const layerSnapPointsX = [targetX, targetX + width / 2, targetX + width];
            const layerSnapPointsY = [targetY, targetY + height / 2, targetY + height];

            for (const guide of guides) {
                if (guide.orientation === 'vertical') {
                    for (const point of layerSnapPointsX) {
                        if (Math.abs(point - guide.position) < snapThreshold) {
                            targetX = guide.position - (point - targetX);
                            activeSnaps.v.push(guide.position);
                            break;
                        }
                    }
                } else {
                     for (const point of layerSnapPointsY) {
                        if (Math.abs(point - guide.position) < snapThreshold) {
                            targetY = guide.position - (point - targetY);
                            activeSnaps.h.push(guide.position);
                            break;
                        }
                    }
                }
            }
        }
        onSnap(activeSnaps);
        finalDx = targetX - initialX;
        finalDy = targetY - initialY;


        if (isGroupInteraction) {
            const updates = initialLayers.map((l: Layer) => ({
                id: l.id,
                updates: { x: l.x + finalDx, y: l.y + finalDy }
            }));
            onUpdateLayersLive(updates);
        } else {
            onUpdateLive({ x: initialX + finalDx, y: initialY + finalDy });
        }

      } else if (type.startsWith('resize-')) {
          const rad = (rotation * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const rotatedDx = dx * cos + dy * sin;
          const rotatedDy = -dx * sin + dy * cos;
          
          if (layer.type === LayerType.Text) {
              const textLayer = layer as TextLayer;
              const { initialWidth, initialHeight, initialX, initialY, centerX, centerY } = interactionRef.current;
              const initialLayerState = interactionRef.current.initialLayers.find((l: Layer) => l.id === layer.id) as TextLayer;

              let newWidth = initialWidth, newHeight = initialHeight;
              if (type.includes('r')) newWidth += rotatedDx;
              if (type.includes('l')) newWidth -= rotatedDx;
              if (type.includes('b')) newHeight += rotatedDy;
              if (type.includes('t')) newHeight -= rotatedDy;
              
              newWidth = Math.max(10, newWidth);
              newHeight = Math.max(10, newHeight);

              // For text, maintain aspect ratio by default.
              const ratio = initialWidth / initialHeight;
              if (isFinite(ratio) && ratio > 0) {
                  if (type.includes('l') || type.includes('r')) { // Horizontal-dominant resize
                      newHeight = newWidth / ratio;
                  } else if (type.includes('t') || type.includes('b')) { // Vertical-dominant resize
                      newWidth = newHeight * ratio;
                  } else { // Corner resize
                      if ((newWidth / newHeight) > ratio) {
                          newWidth = newHeight * ratio;
                      } else {
                          newHeight = newWidth / ratio;
                      }
                  }
              }

              const scale = (initialWidth > 0) ? newWidth / initialWidth : 1;

              if (scale > 0 && isFinite(scale)) {
                  const newBaseFontSize = Math.max(1, initialLayerState.fontSize * scale);
                  const newSpans = initialLayerState.spans.map(span => ({
                      ...span,
                      fontSize: span.fontSize ? Math.max(1, span.fontSize * scale) : undefined
                  }));

                  const finalWidth = initialWidth * scale;
                  const finalHeight = initialHeight * scale;
                  const widthChange = finalWidth - initialWidth;
                  const heightChange = finalHeight - initialHeight;

                  let cxChange = 0; let cyChange = 0;
                  if (type.includes('l')) cxChange = -widthChange / 2;
                  if (type.includes('r')) cxChange = widthChange / 2;
                  if (type.includes('t')) cyChange = -heightChange / 2;
                  if (type.includes('b')) cyChange = heightChange / 2;
                  
                  const worldCxChange = cxChange * cos - cyChange * sin;
                  const worldCyChange = cxChange * sin + cyChange * cos;
                  const newCenter = { x: centerX + worldCxChange, y: centerY + worldCyChange };

                  const finalX = newCenter.x - finalWidth / 2;
                  const finalY = newCenter.y - finalHeight / 2;
                  
                  const updates: Partial<TextLayer> = {
                      fontSize: newBaseFontSize,
                      spans: newSpans,
                      width: finalWidth,
                      height: finalHeight,
                      x: finalX,
                      y: finalY,
                  };
                  onUpdateLive(updates);
              }
          } else { // Original logic for other layer types
              const updates: Partial<Layer> = {};
              const oldCenter = { x: initialX + initialWidth / 2, y: initialY + initialHeight / 2 };
              let newWidth = initialWidth, newHeight = initialHeight;

              if (type.includes('r')) newWidth += rotatedDx;
              if (type.includes('l')) newWidth -= rotatedDx;
              if (type.includes('b')) newHeight += rotatedDy;
              if (type.includes('t')) newHeight -= rotatedDy;

              updates.width = Math.max(10, newWidth);
              updates.height = Math.max(10, newHeight);
              
              if(moveEvent.shiftKey) {
                const ratio = initialWidth / initialHeight;
                if (updates.width / updates.height > ratio) {
                    updates.width = updates.height * ratio;
                } else {
                    updates.height = updates.width / ratio;
                }
              }

              const widthChange = (updates.width ?? initialWidth) - initialWidth;
              const heightChange = (updates.height ?? initialHeight) - initialHeight;

              let cxChange = 0; let cyChange = 0;
              if (type.includes('l')) cxChange = -widthChange / 2;
              if (type.includes('r')) cxChange = widthChange / 2;
              if (type.includes('t')) cyChange = -heightChange / 2;
              if (type.includes('b')) cyChange = heightChange / 2;
              
              const worldCxChange = cxChange * cos - cyChange * sin;
              const worldCyChange = cxChange * sin + cyChange * cos;
              const newCenter = { x: oldCenter.x + worldCxChange, y: oldCenter.y + worldCyChange };

              updates.x = newCenter.x - (updates.width ?? initialWidth) / 2;
              updates.y = newCenter.y - (updates.height ?? initialHeight) / 2;
              
              onUpdateLive(updates);
          }
      } else if (type === 'rotate') {
          const screenCenterX = currentArtboardRect.left + centerX * zoom;
          const screenCenterY = currentArtboardRect.top + centerY * zoom;
          const angle = Math.atan2(moveEvent.clientY - screenCenterY, moveEvent.clientX - screenCenterX) * (180 / Math.PI);
          onUpdateLive({ rotation: angle + 90 });
      }
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
        upEvent.preventDefault();
        const { isDuplicating, initialX, initialY } = interactionRef.current;

        if (isDuplicating) {
            const { x: finalX, y: finalY } = layer;
            // Create a special overrides object for duplication.
            // The handler in useAppLogic will use this to revert the original layer's position.
            // The cast to `any` is a practical way to pass this internal info without changing the Layer type.
            const duplicationOverrides: any = { 
                x: finalX, 
                y: finalY,
                __initialX: initialX,
                __initialY: initialY
            };
            onDuplicateLayer(layer.id, duplicationOverrides);
        } else {
            onInteractionEnd(); // Normal end of interaction
        }

        interactionRef.current.type = null;
        onSnap({ h: [], v: [] });
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };
  
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (layer.type === LayerType.Text && !locked) {
      e.preventDefault();
      e.stopPropagation();
      setIsEditing(true);
      setTimeout(() => {
        if (textContainerRef.current) {
          textContainerRef.current.focus();
          // Place cursor at the click position, which is more intuitive
          // than just focusing, and avoids default selection.
          const selection = window.getSelection();
          // The document.caretRangeFromPoint is not available in all browsers (e.g. Firefox)
          // We'll fall back to just focusing if it's not available.
          if (document.caretRangeFromPoint) {
            const range = document.caretRangeFromPoint(e.clientX, e.clientY);
            if (selection && range) {
              selection.removeAllRanges();
              selection.addRange(range);
            }
          }
        }
      }, 0);
    }
  };

    const handleTextChange = () => {
        if (layer.type !== LayerType.Text || !textContainerRef.current) return;

        // A text change puts the layer back into auto-fitting mode.
        justResized.current = false;
        
        const newSpans: TextSpan[] = [];

        const getStyleFromElement = (element: HTMLElement | null): Partial<TextSpan> => {
            while (element && element !== textContainerRef.current) {
                if (element.dataset.spanIndex) {
                    const index = parseInt(element.dataset.spanIndex, 10);
                    const originalSpan = (layer as TextLayer).spans[index];
                    if (originalSpan) {
                        const { text, ...style } = originalSpan;
                        return style;
                    }
                }
                element = element.parentElement;
            }
            const textLayer = layer as TextLayer;
            return {
                fontFamily: textLayer.fontFamily,
                fontSize: textLayer.fontSize,
                color: textLayer.color,
                fontWeight: textLayer.fontWeight,
            };
        };

        const childNodes = Array.from(textContainerRef.current.childNodes);

        childNodes.forEach((node, index) => {
            const traverse = (currentNode: Node) => {
                if (currentNode.nodeType === Node.TEXT_NODE) {
                    if (currentNode.textContent) {
                        newSpans.push({ text: currentNode.textContent, ...getStyleFromElement(currentNode.parentElement) });
                    }
                } else if (currentNode.nodeType === Node.ELEMENT_NODE) {
                    const el = currentNode as HTMLElement;
                    // For Firefox/Safari, handle <br> as a newline.
                    if (el.nodeName === 'BR') {
                        newSpans.push({ text: '\n', ...getStyleFromElement(el) });
                    } else {
                        // Recurse into other elements like <span>.
                        Array.from(el.childNodes).forEach(traverse);
                    }
                }
            };

            traverse(node);

            // For Chrome, which wraps lines in <div>s, add a newline after each div except the last one.
            if (node.nodeName === 'DIV' && index < childNodes.length - 1) {
                const lastSpan = newSpans[newSpans.length - 1];
                if (lastSpan && !lastSpan.text.endsWith('\n')) {
                    lastSpan.text += '\n';
                }
            }
        });

        const mergeSpans = (spans: TextSpan[]): TextSpan[] => {
            if (!spans.length) return [];
            const merged: TextSpan[] = [];
            let currentSpan = { ...spans[0] };

            for (let i = 1; i < spans.length; i++) {
                const nextSpan = spans[i];
                const { text: _, ...currentStyle } = currentSpan;
                const { text: __, ...nextStyle } = nextSpan;
                
                const style1 = JSON.stringify(Object.entries(currentStyle).filter(([, val]) => val !== undefined).sort());
                const style2 = JSON.stringify(Object.entries(nextStyle).filter(([, val]) => val !== undefined).sort());

                if (style1 === style2) {
                    currentSpan.text += nextSpan.text;
                } else {
                    if (currentSpan.text) merged.push(currentSpan);
                    currentSpan = { ...nextSpan };
                }
            }
            if (currentSpan.text) merged.push(currentSpan);
            return merged;
        };

        const finalSpans = mergeSpans(newSpans.filter(s => s.text));
        
        const textLayer = layer as TextLayer;
        onUpdateLayerAndCommit({ 
            spans: finalSpans.length > 0 ? finalSpans : [{ text: '' }],
            spansVersion: (textLayer.spansVersion || 0) + 1,
        });
    };

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    // Always commit text changes when the user leaves the editing field.
    // This ensures the layer's state is always updated before other actions (like choosing a color) occur.
    handleTextChange();
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Buộc phím Enter hoạt động giống như Shift+Enter, chèn thẻ <br>.
      // Hàm handleTextChange sẽ phân tích chính xác thẻ <br> này thành một ký tự xuống dòng.
      document.execCommand('insertLineBreak');
    } else if (e.key === 'Escape') {
      e.preventDefault();
      // Lưu lại các thay đổi văn bản, sau đó thoát khỏi chế độ chỉnh sửa và bỏ chọn layer.
      handleTextChange();
      setIsEditing(false);
      onDeselect();
    }
  };


  const renderContent = () => {
    const mainStyle: React.CSSProperties = {};
    const filters = [];

    if (layer.glow && layer.glow.enabled) {
        const glow = layer.glow;
        const glowColor = hexToRgba(glow.color, glow.opacity ?? 100);
        filters.push(`drop-shadow(0px 0px ${glow.blur}px ${glowColor})`);
    }

    if (layer.shadow && layer.shadow.enabled) {
        const shadow = layer.shadow;
        const shadowColor = hexToRgba(shadow.color, shadow.opacity ?? 100);
        filters.push(`drop-shadow(${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blur}px ${shadowColor})`);
    }

    if (filters.length > 0) {
        mainStyle.filter = filters.join(' ');
    }

    switch (layer.type) {
      case LayerType.Image:
        return <img src={(layer as ImageLayer).src} alt="" className="w-full h-full object-cover pointer-events-none" draggable="false" style={mainStyle} />;
      case LayerType.Line: {
        const lineLayer = layer as LineLayer;
        const { color, strokeWidth, startCap, endCap } = lineLayer;
        const capSize = Math.max(startCap.size, endCap.size) * strokeWidth;
        const uniqueId = `line-markers-${layer.id}`;
        
        return (
            <svg 
                className="w-full h-full"
                style={{ ...mainStyle, overflow: 'visible' }}
            >
                <defs>
                    {startCap.shape !== LineEndCapShape.None && (
                        <marker
                            id={`${uniqueId}-start`}
                            markerWidth={startCap.size}
                            markerHeight={startCap.size}
                            refX={startCap.size}
                            refY={startCap.size / 2}
                            orient="auto"
                        >
                            {startCap.shape === LineEndCapShape.Triangle && <path d={`M${startCap.size},0 L0,${startCap.size/2} L${startCap.size},${startCap.size} Z`} fill={color} />}
                            {startCap.shape === LineEndCapShape.Square && <rect x="0" y="0" width={startCap.size} height={startCap.size} fill={color} />}
                            {startCap.shape === LineEndCapShape.Circle && <circle cx={startCap.size/2} cy={startCap.size/2} r={startCap.size/2} fill={color} />}
                        </marker>
                    )}
                    {endCap.shape !== LineEndCapShape.None && (
                        <marker
                            id={`${uniqueId}-end`}
                            markerWidth={endCap.size}
                            markerHeight={endCap.size}
                            refX={0}
                            refY={endCap.size / 2}
                            orient="auto"
                        >
                            {endCap.shape === LineEndCapShape.Triangle && <path d={`M0,0 L${endCap.size},${endCap.size/2} L0,${endCap.size} Z`} fill={color} />}
                            {endCap.shape === LineEndCapShape.Square && <rect x="0" y="0" width={endCap.size} height={endCap.size} fill={color} />}
                            {endCap.shape === LineEndCapShape.Circle && <circle cx={endCap.size/2} cy={endCap.size/2} r={endCap.size/2} fill={color} />}
                        </marker>
                    )}
                </defs>
                <line
                    x1={0}
                    y1={height / 2}
                    x2={width}
                    y2={height / 2}
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    markerStart={startCap.shape !== LineEndCapShape.None ? `url(#${uniqueId}-start)` : undefined}
                    markerEnd={endCap.shape !== LineEndCapShape.None ? `url(#${uniqueId}-end)` : undefined}
                />
            </svg>
        );
      }
      case LayerType.Shape:
        const shapeLayer = layer as AnyShapeLayer;
        const sortedStrokes = [...(shapeLayer.strokes || [])].sort((a,b) => b.width - a.width);

        const maxStrokeWidth = shapeLayer.strokes?.length
            ? Math.max(0, ...shapeLayer.strokes.map(s => s.width))
            : 0;
            
        const strokeOffset = maxStrokeWidth / 2;
        const svgWidth = shapeLayer.width + maxStrokeWidth;
        const svgHeight = shapeLayer.height + maxStrokeWidth;

        const renderShape = (props: React.SVGProps<any>) => {
            switch(shapeLayer.shapeType) {
                case ShapeType.Rectangle:
                    return <rect x={0} y={0} width={shapeLayer.width} height={shapeLayer.height} rx={shapeLayer.cornerRadius} ry={shapeLayer.cornerRadius} {...props} />;
                case ShapeType.Ellipse:
                    return <ellipse cx={shapeLayer.width/2} cy={shapeLayer.height/2} rx={shapeLayer.width/2} ry={shapeLayer.height/2} {...props} />;
                case ShapeType.Polygon:
                    const pathD = getPolygonPathD(shapeLayer.width, shapeLayer.height, shapeLayer.pointCount, shapeLayer.innerRadiusRatio, shapeLayer.cornerRadius);
                    return <path d={pathD} {...props} />;
            }
        }
        return (
            <svg 
                width={svgWidth} 
                height={svgHeight} 
                viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
                style={{
                    ...mainStyle,
                    position: 'absolute',
                    top: -strokeOffset,
                    left: -strokeOffset,
                    overflow: 'visible'
                }}
            >
                <g transform={`translate(${strokeOffset}, ${strokeOffset})`}>
                    {sortedStrokes.map(stroke => 
                        renderShape({ key: stroke.id, fill: 'none', stroke: stroke.color, strokeWidth: stroke.width })
                    )}
                    {renderShape({ fill: shapeLayer.fill, stroke: 'none' })}
                </g>
            </svg>
        );
      case LayerType.Text:
        const textLayer = layer as TextLayer;
        const textAlign = textLayer.textAlign || 'center';

        const justifyContent = {
            left: 'flex-start',
            center: 'center',
            right: 'flex-end',
        }[textAlign];

        const textAlignClass = {
            left: 'text-left',
            center: 'text-center',
            right: 'text-right',
        }[textAlign];

        const editableDivStyle: React.CSSProperties = {
          fontFamily: textLayer.fontFamily,
          fontSize: `${textLayer.fontSize}px`,
          color: textLayer.color,
          fontWeight: textLayer.fontWeight,
          lineHeight: 1.0,
          maxWidth: '100%',
          textShadow: generateTextEffectsCss(textLayer.strokes, undefined), // Shadow is handled by filter
        };
        
        return (
          <div
            className="w-full h-full flex items-center"
            style={{ justifyContent, ...mainStyle }}
            onDoubleClick={handleDoubleClick}
            onMouseDown={(e) => {
              // When editing text, if the user clicks the padding area
              // around the contentEditable, we prevent the default behavior
              // to avoid losing the text selection.
              if (isEditing && e.target === e.currentTarget) {
                e.preventDefault();
              }
            }}
          >
            <div
              key={textLayer.spansVersion || 0}
              ref={textContainerRef}
              contentEditable={isEditing}
              suppressContentEditableWarning={true}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className={`outline-none whitespace-pre-wrap break-words ${textAlignClass} ${isEditing ? 'cursor-text' : (showHandles ? 'cursor-move' : 'cursor-pointer')}`}
              style={editableDivStyle}
            >
              {textLayer.spans.map((span, index) => {
                  const textDecorations = [];
                  if (span.underline) textDecorations.push('underline');
                  if (span.strikethrough) textDecorations.push('line-through');

                  const spanStyle: React.CSSProperties = {
                      fontFamily: span.fontFamily || textLayer.fontFamily,
                      fontSize: span.fontSize ? `${span.fontSize}px` : undefined,
                      color: span.color || textLayer.color,
                      fontWeight: span.fontWeight || textLayer.fontWeight,
                      textTransform: span.textTransform || 'none',
                  };

                  if (textDecorations.length > 0) {
                      spanStyle.textDecoration = textDecorations.join(' ');
                  }

                  if (span.textScript === 'superscript') {
                      spanStyle.verticalAlign = 'super';
                      const baseSize = span.fontSize || textLayer.fontSize;
                      spanStyle.fontSize = `${baseSize * 0.75}px`;
                  } else {
                      spanStyle.verticalAlign = 'baseline';
                  }

                  return (
                    <span key={index} data-span-index={index} style={spanStyle}>
                        {span.text}
                    </span>
                  );
              })}
            </div>
          </div>
        );
      default:
        return null;
    }
  };
  
  const resizeHandles = [
      { id: 'tl', cursor: 'nwse-resize', onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => handleMouseDown(e, 'resize-tl') },
      { id: 't', cursor: 'ns-resize', onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => handleMouseDown(e, 'resize-t') },
      { id: 'tr', cursor: 'nesw-resize', onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => handleMouseDown(e, 'resize-tr') },
      { id: 'l', cursor: 'ew-resize', onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => handleMouseDown(e, 'resize-l') },
      { id: 'r', cursor: 'ew-resize', onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => handleMouseDown(e, 'resize-r') },
      { id: 'bl', cursor: 'nesw-resize', onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => handleMouseDown(e, 'resize-bl') },
      { id: 'b', cursor: 'ns-resize', onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => handleMouseDown(e, 'resize-b') },
      { id: 'br', cursor: 'nwse-resize', onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => handleMouseDown(e, 'resize-br') },
  ];
  
  const handleBorderColor = selectionStatus === 'key' ? 'border-indigo-700' : 'border-indigo-500';
  const handleBgColor = selectionStatus === 'key' ? 'bg-indigo-700' : 'bg-white';

  return (
    <div
      ref={objectRef}
      className={`absolute select-none ${!isEditing && !locked ? (showHandles || selectedLayers.length > 1 ? 'cursor-move' : 'cursor-pointer') : ''}`}
      style={{
        left: x,
        top: y,
        width,
        height,
        transform: `rotate(${rotation}deg)`,
      }}
      onMouseDown={(e) => {
        if (locked || isEditing) return;
        // The selection logic is now always handled by onSelect, which is called inside handleMouseDown.
        // We always initiate a 'move' interaction, which will be interpreted as a group move if necessary.
        handleMouseDown(e, 'move');
      }}
    >
      <div className={`relative w-full h-full ${!locked ? (selectionStatus === 'key' ? 'outline outline-4 outline-indigo-700' : selectionStatus === 'selected' ? 'outline outline-2 outline-indigo-500' : '') : ''}`}>
        {renderContent()}

        {isSelected && !locked && !isEditing && showHandles && (
          <>
              {/* Rotation Handle */}
              <div 
                  className={`absolute w-5 h-5 bg-white border-2 rounded-full shadow-md cursor-alias ${handleBorderColor}`}
                  style={{ 
                      top: `-${ROTATION_HANDLE_OFFSET + (RESIZE_HANDLE_SIZE / 2)}px`, 
                      left: `calc(50% - ${RESIZE_HANDLE_SIZE}px / 2 - 1px)`,
                      transform: `rotate(${-rotation}deg)`,
                      transformOrigin: `center ${ROTATION_HANDLE_OFFSET + RESIZE_HANDLE_SIZE}px`,
                  }}
                  onMouseDown={(e) => handleMouseDown(e, 'rotate')}
              />
              <div 
                  className={`absolute left-1/2 w-px ${selectionStatus === 'key' ? 'bg-indigo-700' : 'bg-indigo-500'}`} 
                  style={{
                    height: `${ROTATION_HANDLE_OFFSET}px`,
                    bottom: '100%',
                    transform: `rotate(${-rotation}deg)`,
                    transformOrigin: 'bottom center',
                  }}
              />
              
              {/* Resize Handles */}
              {resizeHandles.map(handle => (
                  <div 
                      key={handle.id}
                      className={`absolute w-4 h-4 border-2 rounded-full shadow-md ${handleBorderColor} ${handleBgColor}`}
                      style={{
                          cursor: handle.cursor,
                          top: handle.id.includes('t') ? `-${RESIZE_HANDLE_SIZE/2}px` : handle.id.includes('b') ? `calc(100% - ${RESIZE_HANDLE_SIZE/2}px)` : `calc(50% - ${RESIZE_HANDLE_SIZE/2}px)`,
                          left: handle.id.includes('l') ? `-${RESIZE_HANDLE_SIZE/2}px` : handle.id.includes('r') ? `calc(100% - ${RESIZE_HANDLE_SIZE/2}px)` : `calc(50% - ${RESIZE_HANDLE_SIZE/2}px)`,
                          transform: `rotate(${-rotation}deg)`
                      }}
                      onMouseDown={handle.onMouseDown}
                  />
              ))}
          </>
        )}
      </div>
    </div>
  );
};

export default TransformableObject;