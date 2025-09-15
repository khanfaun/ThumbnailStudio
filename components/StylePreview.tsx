import React from 'react';
import { TextStyle, ShapeStyle } from '../types';
import { generateTextEffectsCss } from '../utils/text';

const hexToRgba = (hex: string, opacity: number): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return `rgba(0, 0, 0, ${opacity / 100})`;
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
};

interface StylePreviewProps {
  style: TextStyle | ShapeStyle;
}

const PREVIEW_WIDTH = 28;
const PREVIEW_HEIGHT = 28;

const StylePreview: React.FC<StylePreviewProps> = ({ style }) => {
  if ('fontFamily' in style) { // It's a TextStyle
    const textStyle = style as TextStyle;
    const previewStyle: React.CSSProperties = {
      fontFamily: textStyle.fontFamily,
      fontSize: '16px', // Use a fixed size for preview consistency
      fontWeight: textStyle.fontWeight,
      color: textStyle.color,
      textShadow: generateTextEffectsCss(textStyle.strokes, textStyle.shadow),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      lineHeight: 1,
    };

    return (
      <div style={previewStyle}>
        Aa
      </div>
    );
  }

  if ('fill' in style) { // It's a ShapeStyle
    const shapeStyle = style as ShapeStyle;
    const sortedStrokes = [...(shapeStyle.strokes || [])].sort((a, b) => b.width - a.width);

    // Let's assume a base shape for preview purposes
    const baseWidth = 24;
    const baseHeight = 24;
    const cornerRadius = shapeStyle.cornerRadius ?? 4;

    const maxStrokeWidth = shapeStyle.strokes?.length
        ? Math.max(0, ...shapeStyle.strokes.map(s => s.width))
        : 0;
    const strokeOffset = maxStrokeWidth / 2;

    const viewBoxX = -strokeOffset;
    const viewBoxY = -strokeOffset;
    const viewBoxWidth = baseWidth + maxStrokeWidth;
    const viewBoxHeight = baseHeight + maxStrokeWidth;
    
    const containerStyle: React.CSSProperties = {};
    if (shapeStyle.shadow && shapeStyle.shadow.enabled) {
        const shadow = shapeStyle.shadow;
        const shadowColor = hexToRgba(shadow.color, shadow.opacity ?? 100);
        containerStyle.filter = `drop-shadow(${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blur}px ${shadowColor})`;
    }

    return (
      <div style={containerStyle}>
        <svg
          width={PREVIEW_WIDTH}
          height={PREVIEW_HEIGHT}
          viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {sortedStrokes.map(stroke => (
            <rect key={stroke.id} x={0} y={0} width={baseWidth} height={baseHeight} rx={cornerRadius} ry={cornerRadius} fill="none" stroke={stroke.color} strokeWidth={stroke.width} />
          ))}
          <rect x={0} y={0} width={baseWidth} height={baseHeight} rx={cornerRadius} ry={cornerRadius} fill={shapeStyle.fill} stroke="none" />
        </svg>
      </div>
    );
  }

  return null;
};

export default StylePreview;
