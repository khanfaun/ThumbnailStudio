import React from 'react';
import { Layer, LayerType, TextLayer, ImageLayer, AnyShapeLayer, ShapeType, LineLayer } from '../types';
import { generateTextEffectsCss } from '../utils/text';
import { getPolygonPathD } from '../utils/shapes';

interface LayerPreviewProps {
  layer: Layer;
}

// Kích thước cố định cho container xem trước trong editor panel
const PREVIEW_WIDTH = 40;
const PREVIEW_HEIGHT = 32;

const LayerPreview: React.FC<LayerPreviewProps> = ({ layer }) => {
  if (layer.type === LayerType.Image) {
    const imageLayer = layer as ImageLayer;
    return (
      <img
        src={imageLayer.src}
        alt="Preview"
        className="w-full h-full object-cover"
        draggable="false"
        loading="lazy" // Tăng hiệu suất khi có nhiều layer
      />
    );
  }

  if (layer.type === LayerType.Shape) {
    const shapeLayer = layer as AnyShapeLayer;
    const sortedStrokes = [...(shapeLayer.strokes || [])].sort((a, b) => b.width - a.width);

    const maxStrokeWidth = shapeLayer.strokes?.length
        ? Math.max(0, ...shapeLayer.strokes.map(s => s.width))
        : 0;
    const strokeOffset = maxStrokeWidth / 2;

    const viewBoxX = -strokeOffset;
    const viewBoxY = -strokeOffset;
    const viewBoxWidth = shapeLayer.width + maxStrokeWidth;
    const viewBoxHeight = shapeLayer.height + maxStrokeWidth;

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
      <svg
        width={PREVIEW_WIDTH}
        height={PREVIEW_HEIGHT}
        viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {sortedStrokes.map(stroke => renderShape({ key: stroke.id, fill: 'none', stroke: stroke.color, strokeWidth: stroke.width }))}
        {renderShape({ fill: shapeLayer.fill, stroke: 'none' })}
      </svg>
    );
  }
  
  if (layer.type === LayerType.Line) {
    const lineLayer = layer as LineLayer;
     return (
        <svg
            width={PREVIEW_WIDTH}
            height={PREVIEW_HEIGHT}
            viewBox={`0 0 ${lineLayer.width} ${lineLayer.strokeWidth}`}
            preserveAspectRatio="xMidYMid meet"
        >
            <line 
                x1={0} 
                y1={lineLayer.strokeWidth/2}
                x2={lineLayer.width}
                y2={lineLayer.strokeWidth/2}
                stroke={lineLayer.color}
                strokeWidth={lineLayer.strokeWidth}
            />
        </svg>
     )
  }

  if (layer.type === LayerType.Text) {
    const textLayer = layer as TextLayer;
    
    // Co dãn nội dung của layer để vừa với hộp xem trước, bảo toàn tỷ lệ khung hình.
    const scale = Math.min(PREVIEW_WIDTH / textLayer.width, PREVIEW_HEIGHT / textLayer.height);

    // Tính toán lề để căn giữa nội dung đã co dãn trong hộp xem trước.
    const scaledWidth = textLayer.width * scale;
    const scaledHeight = textLayer.height * scale;
    const marginLeft = (PREVIEW_WIDTH - scaledWidth) / 2;
    const marginTop = (PREVIEW_HEIGHT - scaledHeight) / 2;
    
    // Style này sẽ co dãn và định vị nội dung.
    const scaledContentStyle: React.CSSProperties = {
        width: textLayer.width,
        height: textLayer.height,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        marginLeft: `${marginLeft}px`,
        marginTop: `${marginTop}px`,
    };

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

    // Style cho chính phần văn bản.
    const textContainerStyle: React.CSSProperties = {
      fontFamily: textLayer.fontFamily,
      fontSize: `${textLayer.fontSize}px`,
      color: textLayer.color,
      fontWeight: textLayer.fontWeight,
      lineHeight: 1.2,
      textShadow: generateTextEffectsCss(textLayer.strokes, textLayer.shadow),
    };

    return (
      <div style={{width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT}}>
        <div style={scaledContentStyle}>
          {/* Cấu trúc này mô phỏng layer thật */}
          <div
              className="w-full h-full flex items-center"
              style={{ justifyContent }}
          >
              <div
              className={`whitespace-pre-wrap break-words ${textAlignClass}`}
              style={textContainerStyle}
              >
              {textLayer.spans.map((span, index) => (
                  <span key={index} style={{
                      fontFamily: span.fontFamily || textLayer.fontFamily,
                      fontSize: span.fontSize ? `${span.fontSize}px` : undefined,
                      color: span.color || textLayer.color,
                      fontWeight: span.fontWeight || textLayer.fontWeight,
                  }}>
                      {span.text}
                  </span>
              ))}
              </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback cho các loại layer khác hoặc khi có lỗi
  return <div className="w-full h-full bg-slate-300" />;
};

export default LayerPreview;