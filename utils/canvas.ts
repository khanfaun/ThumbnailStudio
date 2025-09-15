import { Artboard, LayerType, TextLayer, ImageLayer, TextSpan, AnyShapeLayer, ShapeType, FontFamily, LineLayer, LineEndCapShape, LineEndCap, GlowStyle } from '../types';

export const loadImage = (src: string): Promise<HTMLImageElement> => 
    new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(new Error(`Failed to load image: ${src}, Error: ${err}`));
        img.src = src;
    });

const hexToRgba = (hex: string, opacity: number): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return `rgba(0, 0, 0, ${opacity / 100})`;
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
};

const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
    if (width < 2 * radius) radius = width / 2;
    if (height < 2 * radius) radius = height / 2;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
};

const drawPolygon = (ctx: CanvasRenderingContext2D, width: number, height: number, pointCount: number, innerRadiusRatio: number, cornerRadius: number) => {
    const cx = width / 2;
    const cy = height / 2;
    const rx = width / 2;
    const ry = height / 2;
  
    const points = [];
    const angleStep = (Math.PI * 2) / (pointCount * 2);
  
    for (let i = 0; i < pointCount * 2; i++) {
      const radius = i % 2 === 0 ? 1 : innerRadiusRatio;
      const angle = i * angleStep - Math.PI / 2;
      points.push({
        x: cx + rx * radius * Math.cos(angle),
        y: cy + ry * radius * Math.sin(angle),
      });
    }

    ctx.beginPath();
    
    if (cornerRadius <= 0) {
        ctx.moveTo(points[0].x, points[0].y);
        for(let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }
    } else {
        for (let i = 0; i < points.length; i++) {
            const p0 = points[(i - 1 + points.length) % points.length];
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];

            const v1x = p0.x - p1.x;
            const v1y = p0.y - p1.y;
            const v2x = p2.x - p1.x;
            const v2y = p2.y - p1.y;

            const len1 = Math.sqrt(v1x * v1x + v1y * v1y);
            const len2 = Math.sqrt(v2x * v2x + v2y * v2y);
            
            const maxRadius = Math.min(len1, len2) / 2.2;
            const clampedRadius = Math.min(cornerRadius, maxRadius);

            const pt1 = {
                x: p1.x + (v1x / len1) * clampedRadius,
                y: p1.y + (v1y / len1) * clampedRadius
            };
            const pt2 = {
                x: p1.x + (v2x / len2) * clampedRadius,
                y: p1.y + (v2y / len2) * clampedRadius
            };

            if (i === 0) {
                ctx.moveTo(pt1.x, pt1.y);
            } else {
                ctx.lineTo(pt1.x, pt1.y);
            }
            ctx.quadraticCurveTo(p1.x, p1.y, pt2.x, pt2.y);
        }
    }
    ctx.closePath();
};


const drawShapeLayer = (ctx: CanvasRenderingContext2D, layer: AnyShapeLayer) => {
    switch(layer.shapeType) {
        case ShapeType.Rectangle:
            drawRoundedRect(ctx, 0, 0, layer.width, layer.height, layer.cornerRadius);
            break;
        case ShapeType.Ellipse:
            ctx.beginPath();
            ctx.ellipse(layer.width / 2, layer.height / 2, layer.width / 2, layer.height / 2, 0, 0, 2 * Math.PI);
            ctx.closePath();
            break;
        case ShapeType.Polygon:
            drawPolygon(ctx, layer.width, layer.height, layer.pointCount, layer.innerRadiusRatio, layer.cornerRadius);
            break;
    }
    
    // Draw strokes from back to front
    const sortedStrokes = [...(layer.strokes || [])].sort((a,b) => b.width - a.width);
    
    // Render fill first
    ctx.fillStyle = layer.fill;
    ctx.fill();

    // Render strokes without shadow
    sortedStrokes.forEach(stroke => {
        if (stroke.width > 0) {
            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = stroke.width * 2; // Stroke is centered, so double width
            ctx.stroke();
        }
    });

    // Re-fill on top to cover inner half of strokes
    ctx.fillStyle = layer.fill;
    ctx.fill();
};

export const drawTextLayer = (ctx: CanvasRenderingContext2D, layer: TextLayer) => {
    const textLayer = layer;
    ctx.textBaseline = 'middle';
    
    const textAlign = textLayer.textAlign || 'center';

    const dominantFontSize = textLayer.fontSize;
    const lineHeight = dominantFontSize * 1.0;

    const linesOfSpans: TextSpan[][] = [];
    let currentLine: TextSpan[] = [];
    textLayer.spans.forEach(span => {
        const parts = span.text.split('\n');
        parts.forEach((part, index) => {
            if (part) {
                currentLine.push({ ...span, text: part });
            }
            if (index < parts.length - 1) {
                linesOfSpans.push(currentLine);
                currentLine = [];
            }
        });
    });
    if (currentLine.length > 0) {
        linesOfSpans.push(currentLine);
    }
    
    const totalTextHeight = linesOfSpans.length * lineHeight;
    
    // Stroke and Fill Pass
    let currentY = (textLayer.height / 2) - (totalTextHeight / 2) + (lineHeight / 2);
    linesOfSpans.forEach(line => {
        let totalWidth = 0;
        line.forEach(span => {
            const font = `${span.fontWeight || textLayer.fontWeight} ${span.fontSize || textLayer.fontSize}px "${span.fontFamily || textLayer.fontFamily}"`;
            ctx.font = font;
            totalWidth += ctx.measureText(span.text).width;
        });

        let currentX;
        if (textAlign === 'left') currentX = 0;
        else if (textAlign === 'right') currentX = textLayer.width - totalWidth;
        else currentX = (textLayer.width / 2) - (totalWidth / 2);
        
        ctx.textAlign = 'left';
        
        // Draw strokes from outermost to innermost
        if (textLayer.strokes && textLayer.strokes.length > 0) {
            textLayer.strokes.slice().reverse().forEach(stroke => {
                if (stroke.width > 0) {
                    ctx.strokeStyle = stroke.color;
                    ctx.lineWidth = stroke.width * 2;
                    ctx.lineJoin = 'round';
                    
                    let strokeX = currentX;
                    line.forEach(span => {
                        const font = `${span.fontWeight || textLayer.fontWeight} ${span.fontSize || textLayer.fontSize}px "${span.fontFamily || textLayer.fontFamily}"`;
                        ctx.font = font;
                        ctx.strokeText(span.text, strokeX, currentY);
                        strokeX += ctx.measureText(span.text).width;
                    });
                }
            });
        }

        // Draw the main text fill on top
        let fillX = currentX;
        line.forEach(span => {
            const font = `${span.fontWeight || textLayer.fontWeight} ${span.fontSize || textLayer.fontSize}px "${span.fontFamily || textLayer.fontFamily}"`;
            ctx.font = font;
            ctx.fillStyle = span.color || textLayer.color;
            ctx.fillText(span.text, fillX, currentY);
            fillX += ctx.measureText(span.text).width;
        });
        
        currentY += lineHeight;
    });
};

const drawLineEndCap = (ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, cap: LineEndCap, strokeWidth: number, color: string) => {
    if (cap.shape === LineEndCapShape.None) return;

    ctx.save();
    ctx.fillStyle = color;
    ctx.translate(x, y);
    ctx.rotate(angle);

    const size = strokeWidth * cap.size;

    // All shapes are drawn pointing to the right (positive x direction) from a connection point at (0,0).
    // The rotation angle will orient them correctly.
    switch (cap.shape) {
        case LineEndCapShape.Circle:
            ctx.beginPath();
            // The circle is centered at the connection point.
            ctx.arc(0, 0, size / 2, 0, 2 * Math.PI);
            ctx.fill();
            break;
        case LineEndCapShape.Square:
            // The square is centered at the connection point.
            ctx.fillRect(-size / 2, -size / 2, size, size);
            break;
        case LineEndCapShape.Triangle:
            ctx.beginPath();
            // A right-pointing triangle with its base on the y-axis.
            // The line connects to the center of the base.
            ctx.moveTo(size, 0); // Tip
            ctx.lineTo(0, -size / 2); // Top of base
            ctx.lineTo(0, size / 2);  // Bottom of base
            ctx.closePath();
            ctx.fill();
            break;
    }
    ctx.restore();
}

const drawLineLayer = (ctx: CanvasRenderingContext2D, layer: LineLayer) => {
    const yPos = layer.height / 2;

    // Draw main line first
    ctx.beginPath();
    ctx.moveTo(0, yPos);
    ctx.lineTo(layer.width, yPos);
    
    ctx.strokeStyle = layer.color;
    ctx.lineWidth = layer.strokeWidth;
    ctx.lineCap = 'butt'; // Use 'butt' to have precise start/end points for caps.
    ctx.stroke();
    
    // Draw end caps over the line ends.
    // For start cap, rotate 180 degrees (PI radians) to point left.
    drawLineEndCap(ctx, 0, yPos, Math.PI, layer.startCap, layer.strokeWidth, layer.color);
    // For end cap, no rotation is needed to point right.
    drawLineEndCap(ctx, layer.width, yPos, 0, layer.endCap, layer.strokeWidth, layer.color);
}

export const renderArtboardToCanvas = async (artboard: Artboard, allFonts: FontFamily[]): Promise<HTMLCanvasElement> => {
      const canvas = document.createElement('canvas');
      canvas.width = artboard.width;
      canvas.height = artboard.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Could not get canvas context");
      
      const fontFaces = allFonts.flatMap(family => family.variants.map(variant => {
          if(!document.fonts.check(`${variant.weight} 16px ${family.name}`)) {
            return new FontFace(family.name, `url(${variant.url})`, { weight: String(variant.weight), style: variant.style }).load();
          }
          return Promise.resolve(null);
      }));

      await Promise.all(fontFaces.filter(Boolean));

      ctx.fillStyle = artboard.backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const sortedLayers = [...artboard.layers]
        .filter(l => l.visible ?? true)
        .sort((a, b) => a.zIndex - b.zIndex);
      
      for (const layer of sortedLayers) {
          ctx.save();
          
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
              ctx.filter = filters.join(' ');
          }

          ctx.translate(layer.x + layer.width / 2, layer.y + layer.height / 2);
          ctx.rotate((layer.rotation * Math.PI) / 180);
          ctx.translate(-(layer.x + layer.width / 2), -(layer.y + layer.height / 2));
          
          if (layer.type === LayerType.Image) {
              try {
                  const img = await loadImage((layer as ImageLayer).src);
                  ctx.drawImage(img, layer.x, layer.y, layer.width, layer.height);
              } catch (e) {
                  console.error(`Could not load image for layer ${layer.id}:`, (layer as ImageLayer).src, e);
                  ctx.fillStyle = '#cccccc';
                  ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
                  ctx.fillStyle = '#ff0000';
                  ctx.font = '20px sans-serif';
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillText('Image Error', layer.x + layer.width/2, layer.y + layer.height/2);
              }
          } else if (layer.type === LayerType.Text) {
              ctx.translate(layer.x, layer.y);
              drawTextLayer(ctx, layer as TextLayer);
          } else if (layer.type === LayerType.Shape) {
              ctx.translate(layer.x, layer.y);
              drawShapeLayer(ctx, layer as AnyShapeLayer);
          } else if (layer.type === LayerType.Line) {
              ctx.translate(layer.x, layer.y);
              drawLineLayer(ctx, layer as LineLayer);
          }
          ctx.restore();
      }
      return canvas;
  };
  
export const getCanvasBlob = (canvas: HTMLCanvasElement, format: 'png' | 'jpeg', limitSize: boolean, maxSizeKb: number): Promise<Blob | null> => {
    const mimeType = `image/${format}`;
    const targetSizeBytes = maxSizeKb * 1024;
  
    return new Promise((resolve) => {
      if (format === 'png' || !limitSize) {
        canvas.toBlob(resolve, mimeType, format === 'jpeg' ? 0.95 : undefined);
        return;
      }
      
      let low = 0.0;
      let high = 1.0;
      let bestBlob: Blob | null = null;
  
      const findBestQuality = (iterations: number) => {
        if (iterations === 0) {
          resolve(bestBlob);
          return;
        }
        
        const mid = (low + high) / 2;
        canvas.toBlob(blob => {
          if (blob) {
            if (blob.size > targetSizeBytes) {
              high = mid;
            } else {
              bestBlob = blob;
              low = mid;
            }
          }
          findBestQuality(iterations - 1);
        }, mimeType, mid);
      };
  
      findBestQuality(8); // 8 iterations for binary search
    });
};

export const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};