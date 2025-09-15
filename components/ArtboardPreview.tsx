import React from 'react';
import { Artboard, LayerType, TextLayer, ImageLayer, AnyShapeLayer, ShapeType, LineLayer } from '../types';
import { generateTextEffectsCss } from '../utils/text';
import { getPolygonPathD } from '../utils/shapes';

interface ArtboardPreviewProps {
  artboard: Artboard;
  onClick: () => void;
  isSelected: boolean;
  onSelectionToggle?: (id: string) => void;
}

const hexToRgba = (hex: string, opacity: number): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return `rgba(0, 0, 0, ${opacity / 100})`;
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
};

const ArtboardPreview: React.FC<ArtboardPreviewProps> = ({ artboard, onClick, isSelected, onSelectionToggle }) => {
  const PREVIEW_CONTAINER_SIZE = 250;
  const scale = Math.min(PREVIEW_CONTAINER_SIZE / artboard.width, PREVIEW_CONTAINER_SIZE / artboard.height);

  const sortedLayers = [...artboard.layers]
    .filter(l => l.visible ?? true)
    .sort((a, b) => a.zIndex - b.zIndex);

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Ngăn sự kiện click lan ra card cha
    if (onSelectionToggle) {
        onSelectionToggle(artboard.id);
    }
  };
  
  const handleLabelClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Ngăn sự kiện click lan ra card cha
    if (onSelectionToggle) {
        onSelectionToggle(artboard.id);
    }
  };

  return (
    <div
      className="relative bg-white p-3 rounded-lg shadow-sm border cursor-pointer group hover:shadow-md hover:border-indigo-400 transition-all"
      onClick={onClick}
      style={{ borderColor: isSelected ? 'rgb(99 102 241)' : 'rgb(226 232 240)' }}
    >
        {onSelectionToggle && (
            <div 
            className="absolute top-2 left-2 z-10 p-2"
            onClick={handleCheckboxClick}
            >
                <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {}} // onClick đã xử lý logic
                className="h-5 w-5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                />
            </div>
        )}
      <div
        className="relative overflow-hidden mx-auto bg-slate-200/50 rounded-md"
        style={{
          width: PREVIEW_CONTAINER_SIZE,
          height: PREVIEW_CONTAINER_SIZE,
        }}
      >
        <div
          className="shadow-inner overflow-hidden"
          style={{
            position: 'absolute',
            width: artboard.width,
            height: artboard.height,
            backgroundColor: artboard.backgroundColor,
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) scale(${scale})`,
            transformOrigin: 'center center',
          }}
        >
          {sortedLayers.map(layer => {
            const baseStyle: React.CSSProperties = {
                position: 'absolute',
                left: layer.x,
                top: layer.y,
                width: layer.width,
                height: layer.height,
                transform: `rotate(${layer.rotation}deg)`,
            };
            
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
                baseStyle.filter = filters.join(' ');
            }


            if (layer.type === LayerType.Line) {
                 const lineLayer = layer as LineLayer;
                 return (
                     <div key={lineLayer.id} style={baseStyle}>
                        <svg width={lineLayer.width} height={lineLayer.height} viewBox={`0 0 ${lineLayer.width} ${lineLayer.height}`} style={{overflow: 'visible'}}>
                             <line
                                x1={0} y1={lineLayer.height / 2}
                                x2={lineLayer.width} y2={lineLayer.height / 2}
                                stroke={lineLayer.color}
                                strokeWidth={lineLayer.strokeWidth}
                             />
                        </svg>
                     </div>
                 )
            }

            if (layer.type === LayerType.Shape) {
                const shapeLayer = layer as AnyShapeLayer;
                
                const maxStrokeWidth = shapeLayer.strokes?.length
                    ? Math.max(0, ...shapeLayer.strokes.map(s => s.width))
                    : 0;

                const strokeOffset = maxStrokeWidth / 2;
                const svgWidth = shapeLayer.width + maxStrokeWidth;
                const svgHeight = shapeLayer.height + maxStrokeWidth;

                const svgStyle: React.CSSProperties = {
                    position: 'absolute',
                    top: -strokeOffset,
                    left: -strokeOffset,
                    overflow: 'visible',
                };

                return (
                    <div key={layer.id} style={baseStyle}>
                        <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={svgStyle}>
                            {(() => {
                                const sortedStrokes = [...(shapeLayer.strokes || [])].sort((a, b) => b.width - a.width);
                                const renderShape = (props: React.SVGProps<any>) => {
                                    switch (shapeLayer.shapeType) {
                                        case ShapeType.Rectangle:
                                            return <rect x={0} y={0} width={shapeLayer.width} height={shapeLayer.height} rx={shapeLayer.cornerRadius} ry={shapeLayer.cornerRadius} {...props} />;
                                        case ShapeType.Ellipse:
                                            return <ellipse cx={shapeLayer.width / 2} cy={shapeLayer.height / 2} rx={shapeLayer.width / 2} ry={shapeLayer.height / 2} {...props} />;
                                        case ShapeType.Polygon:
                                            const pathD = getPolygonPathD(shapeLayer.width, shapeLayer.height, shapeLayer.pointCount, shapeLayer.innerRadiusRatio, shapeLayer.cornerRadius);
                                            return <path d={pathD} {...props} />;
                                    }
                                };
                                return (
                                    <g transform={`translate(${strokeOffset}, ${strokeOffset})`}>
                                        {sortedStrokes.map(stroke => renderShape({ key: stroke.id, fill: 'none', stroke: stroke.color, strokeWidth: stroke.width }))}
                                        {renderShape({ fill: shapeLayer.fill, stroke: 'none' })}
                                    </g>
                                );
                            })()}
                        </svg>
                    </div>
                );
            }

            if (layer.type === LayerType.Text) {
                const textLayer = layer as TextLayer;
                const textAlign = textLayer.textAlign || 'center';
                const justifyContent = {
                    left: 'flex-start',
                    center: 'center',
                    right: 'flex-end'
                }[textAlign];

                const styleProps: React.CSSProperties = {
                    ...baseStyle,
                    fontFamily: textLayer.fontFamily,
                    fontSize: `${textLayer.fontSize}px`,
                    color: textLayer.color,
                    fontWeight: textLayer.fontWeight,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    textAlign: textAlign as 'left' | 'center' | 'right',
                    lineHeight: 1.0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: justifyContent,
                    textShadow: generateTextEffectsCss(textLayer.strokes, undefined), // Shadow is handled by filter
                    filter: baseStyle.filter, // Apply the same filter from baseStyle
                };

                return (
                    <div
                        key={layer.id}
                        style={styleProps}
                    >
                        <div>
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
                                <span key={index} style={spanStyle}>
                                    {span.text}
                                </span>
                            );
                        })}
                        </div>
                    </div>
                )
            }
             return (
                 <div
                    key={layer.id}
                    style={baseStyle}
                    >
                    <img src={(layer as ImageLayer).src} alt="" className="w-full h-full object-cover pointer-events-none" draggable="false" />
                </div>
             );
          })}
        </div>
      </div>
      <p className="text-center font-semibold text-sm text-slate-700 mt-3 truncate">{artboard.name}</p>
    </div>
  );
};

export default ArtboardPreview;