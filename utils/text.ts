import { TextSpan, TextLayer, StrokeStyle, ShadowStyle } from '../types';

/**
 * Applies a new style to a specific range within a list of text spans.
 * This function will split spans that are intersected by the selection and apply the style only to the text within the range.
 * @param spans - The initial array of text spans.
 * @param range - The selection range with `start` and `end` positions.
 * @param newStyle - An object containing the new style properties to apply.
 * @returns A new array of spans with the updated styles.
 */
export const applyTextStyle = (
  spans: TextSpan[],
  range: { start: number; end: number },
  newStyle: Partial<TextSpan>
): TextSpan[] => {
    const { start: selectionStart, end: selectionEnd } = range;
    
    // If the selection is invalid or has no length, do nothing.
    if (selectionStart >= selectionEnd) {
        return spans;
    }

    const resultingSpans: TextSpan[] = [];
    let currentIndex = 0;

    for (const span of spans) {
        const spanStart = currentIndex;
        const spanEnd = currentIndex + span.text.length;

        // --- Case 1: No intersection ---
        // The span is entirely before or after the selection.
        if (spanEnd <= selectionStart || spanStart >= selectionEnd) {
            resultingSpans.push(span);
        } 
        // --- Case 2: Intersection exists ---
        // The span is partially or fully inside the selection and needs to be split.
        else {
            // Part 1: Text in the span that is BEFORE the selection
            if (spanStart < selectionStart) {
                resultingSpans.push({
                    ...span,
                    text: span.text.substring(0, selectionStart - spanStart),
                });
            }

            // Part 2: Text in the span that is INSIDE the selection (apply new style)
            const intersectionStart = Math.max(spanStart, selectionStart);
            const intersectionEnd = Math.min(spanEnd, selectionEnd);
            const intersectedText = span.text.substring(
                intersectionStart - spanStart,
                intersectionEnd - spanStart
            );
            
            if (intersectedText.length > 0) {
                // When toggling, we might pass `undefined` to reset a style.
                // We create a clean copy of the span, apply the new style, and then remove
                // any keys that are now undefined, so they fall back to the layer's default.
                const updatedSpan = { ...span, ...newStyle, text: intersectedText };
                for (const key in updatedSpan) {
                    if (updatedSpan[key as keyof typeof updatedSpan] === undefined) {
                        delete updatedSpan[key as keyof typeof updatedSpan];
                    }
                }
                resultingSpans.push(updatedSpan);
            }

            // Part 3: Text in the span that is AFTER the selection
            if (spanEnd > selectionEnd) {
                resultingSpans.push({
                    ...span,
                    text: span.text.substring(selectionEnd - spanStart),
                });
            }
        }
        currentIndex = spanEnd;
    }
    
    return resultingSpans;
};


export const mergeSpans = (spans: TextSpan[]): TextSpan[] => {
    if (!spans.length) return [];
    const merged: TextSpan[] = [];
    let currentSpan = { ...spans[0] };

    for (let i = 1; i < spans.length; i++) {
        const nextSpan = spans[i];
        const { text: _, ...currentStyle } = currentSpan;
        const { text: __, ...nextStyle } = nextSpan;

        // Filter out undefined properties and sort for consistent comparison
        const style1 = JSON.stringify(Object.entries(currentStyle).filter(([, val]) => val !== undefined).sort());
        const style2 = JSON.stringify(Object.entries(nextStyle).filter(([, val]) => val !== undefined).sort());

        if (style1 === style2 && currentSpan.text) {
            currentSpan.text += nextSpan.text;
        } else {
            if(currentSpan.text) merged.push(currentSpan);
            currentSpan = { ...nextSpan };
        }
    }
    if(currentSpan.text) merged.push(currentSpan);
    return merged;
};

export const getSpansForRange = (
    spans: TextSpan[],
    range: { start: number; end: number }
  ): TextSpan[] => {
    const { start: selectionStart, end: selectionEnd } = range;
    if (selectionStart >= selectionEnd) return [];
  
    const extractedSpans: TextSpan[] = [];
    let currentIndex = 0;
  
    for (const span of spans) {
      const spanStart = currentIndex;
      const spanEnd = currentIndex + span.text.length;
  
      if (spanEnd > selectionStart && spanStart < selectionEnd) {
        // There is an intersection
        const intersectionStart = Math.max(spanStart, selectionStart);
        const intersectionEnd = Math.min(spanEnd, selectionEnd);
        const intersectedText = span.text.substring(
          intersectionStart - spanStart,
          intersectionEnd - spanStart
        );
        
        if (intersectedText.length > 0) {
          extractedSpans.push({
            ...span,
            text: intersectedText,
          });
        }
      }
      currentIndex = spanEnd;
    }
    return extractedSpans;
  };

  export const getStyleStateForRange = (
      spans: TextSpan[],
      range: { start: number, end: number },
      styleKey: keyof Omit<TextSpan, 'text'>
  ): boolean | 'mixed' => {
      const spansInRange = getSpansForRange(spans, range);
      if (spansInRange.length === 0) {
          return false;
      }
      
      const firstValue = !!spansInRange[0][styleKey];
      
      // For textScript and textTransform, we check the specific value, not just truthiness
      if (styleKey === 'textScript') {
          const firstScript = spansInRange[0].textScript || 'normal';
          const allSame = spansInRange.every(s => (s.textScript || 'normal') === firstScript);
          if (!allSame) return 'mixed';
          return firstScript === 'superscript';
      }
      
      if (styleKey === 'textTransform') {
          const firstTransform = spansInRange[0].textTransform || 'none';
          const allSame = spansInRange.every(s => (s.textTransform || 'none') === firstTransform);
          if (!allSame) return 'mixed';
          return firstTransform === 'uppercase';
      }

      // For boolean styles like underline/strikethrough
      const allHaveStyle = spansInRange.every(s => s[styleKey]);
      if (allHaveStyle) {
          return true;
      }

      const someHaveStyle = spansInRange.some(s => s[styleKey]);
      if (someHaveStyle) {
          return 'mixed';
      }

      return false;
  };

  export const getPropertyStateForRange = (
    layer: TextLayer,
    range: { start: number, end: number },
    propertyKey: 'fontFamily' | 'fontSize' | 'color' | 'fontWeight'
  ): string | number | 'mixed' | undefined => {
      const spansInRange = getSpansForRange(layer.spans, range).filter(s => s.text); // Only consider spans with text
      if (spansInRange.length === 0) {
          // This can happen if the selection is only over empty space or newlines that got split into empty spans.
          // Let's find the style at the cursor start.
          let currentIndex = 0;
          for (const span of layer.spans) {
              const spanEnd = currentIndex + span.text.length;
              if (range.start >= currentIndex && range.start <= spanEnd) {
                  return span[propertyKey] ?? layer[propertyKey as keyof TextLayer] as string | number | undefined;
              }
              currentIndex = spanEnd;
          }
          return undefined; // Fallback
      }
  
      const getPropValue = (span: TextSpan) => span[propertyKey] ?? layer[propertyKey as keyof TextLayer];
  
      const firstValue = getPropValue(spansInRange[0]);
  
      for (let i = 1; i < spansInRange.length; i++) {
          if (getPropValue(spansInRange[i]) !== firstValue) {
              return 'mixed';
          }
      }
      return firstValue as string | number | undefined;
  };
  
  export const removeRangeFromSpans = (
    spans: TextSpan[],
    range: { start: number; end: number }
  ): TextSpan[] => {
    const { start: selectionStart, end: selectionEnd } = range;
    if (selectionStart >= selectionEnd) return spans;
  
    const remainingSpans: TextSpan[] = [];
    let currentIndex = 0;
  
    for (const span of spans) {
      const spanStart = currentIndex;
      const spanEnd = currentIndex + span.text.length;
  
      if (spanEnd <= selectionStart || spanStart >= selectionEnd) {
        // No intersection, keep the whole span
        remainingSpans.push(span);
      } else {
        // Intersection exists, keep the parts outside the selection
        // Part before selection
        if (spanStart < selectionStart) {
          remainingSpans.push({
            ...span,
            text: span.text.substring(0, selectionStart - spanStart),
          });
        }
        // Part after selection
        if (spanEnd > selectionEnd) {
          remainingSpans.push({
            ...span,
            text: span.text.substring(selectionEnd - spanStart),
          });
        }
      }
      currentIndex = spanEnd;
    }
    return remainingSpans;
  };

export const calculateTextRangePosition = (layer: TextLayer, rangeStart: number): { x: number, y: number } => {
    const container = document.createElement('div');
    const textContainer = document.createElement('div');

    const justifyContent = {
        left: 'flex-start',
        center: 'center',
        right: 'flex-end',
    }[layer.textAlign || 'center'];

    Object.assign(container.style, {
        width: `${layer.width}px`,
        height: `${layer.height}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: justifyContent,
    });

    Object.assign(textContainer.style, {
        fontFamily: layer.fontFamily,
        fontSize: `${layer.fontSize}px`,
        color: layer.color,
        fontWeight: String(layer.fontWeight),
        lineHeight: '1.0',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-words',
        textAlign: layer.textAlign || 'center',
        maxWidth: '100%',
        outline: 'none',
        padding: '0',
        border: '0',
    });

    let charCount = 0;
    let markerInserted = false;
    
    for (const span of layer.spans) {
        let currentText = span.text;
        
        if (!markerInserted && rangeStart >= charCount && rangeStart <= charCount + currentText.length) {
            const positionInSpan = rangeStart - charCount;
            const preText = currentText.substring(0, positionInSpan);
            const postText = currentText.substring(positionInSpan);

            if (preText) {
                const preSpanEl = document.createElement('span');
                preSpanEl.textContent = preText;
                Object.assign(preSpanEl.style, {
                    fontFamily: span.fontFamily || 'inherit',
                    fontSize: span.fontSize ? `${span.fontSize}px` : 'inherit',
                    color: span.color || 'inherit',
                    fontWeight: span.fontWeight ? String(span.fontWeight) : 'inherit',
                });
                textContainer.appendChild(preSpanEl);
            }

            const marker = document.createElement('span');
            marker.id = 'split-marker-temp';
            marker.textContent = '\u200B'; // Zero-width space for layout
            textContainer.appendChild(marker);
            markerInserted = true;
            
            currentText = postText;
        }

        if (currentText) {
            const spanEl = document.createElement('span');
            spanEl.textContent = currentText;
            Object.assign(spanEl.style, {
                fontFamily: span.fontFamily || 'inherit',
                fontSize: span.fontSize ? `${span.fontSize}px` : 'inherit',
                color: span.color || 'inherit',
                fontWeight: span.fontWeight ? String(span.fontWeight) : 'inherit',
            });
            textContainer.appendChild(spanEl);
        }
        
        charCount += span.text.length;
    }
    
    if (!markerInserted) {
        const marker = document.createElement('span');
        marker.id = 'split-marker-temp';
        marker.textContent = '\u200B';
        textContainer.appendChild(marker);
    }
    
    container.appendChild(textContainer);

    Object.assign(container.style, {
        position: 'absolute',
        left: '-9999px',
        top: '-9999px',
        visibility: 'hidden',
    });
    document.body.appendChild(container);

    const markerEl = document.getElementById('split-marker-temp')!;
    const containerRect = container.getBoundingClientRect();
    const markerRect = markerEl.getBoundingClientRect();

    const position = {
        x: markerRect.left - containerRect.left,
        y: markerRect.top - containerRect.top,
    };
    
    document.body.removeChild(container);
    
    return position;
};

const hexToRgba = (hex: string, opacity: number): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
        // Fallback for invalid hex
        return `rgba(0, 0, 0, ${opacity / 100})`;
    }
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
};

export const generateTextEffectsCss = (strokes?: StrokeStyle[], shadow?: ShadowStyle): string => {
    const effects: string[] = [];

    // CSS text-shadow applies the first shadow on top, and the last shadow at the back.
    // We want strokes to be on top of the main drop shadow.
    // Order: [innermost_stroke, ..., outermost_stroke, drop_shadow]
    const strokeShadows = (strokes || [])
        .flatMap(stroke => {
            const { width, color } = stroke;
            if (width <= 0) return [];
            
            const numSteps = 32;
            const offsets = [];
            for (let i = 0; i < numSteps; i++) {
                const angle = (i * 2 * Math.PI) / numSteps;
                const x = parseFloat((Math.cos(angle) * width).toFixed(3));
                const y = parseFloat((Math.sin(angle) * width).toFixed(3));
                offsets.push(`${x}px ${y}px 0 ${color}`);
            }
            return offsets;
        });

    effects.push(...strokeShadows);
    
    if (shadow && shadow.enabled && shadow.blur >= 0) {
        const shadowColor = hexToRgba(shadow.color, shadow.opacity ?? 100);
        effects.push(`${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blur}px ${shadowColor}`);
    }

    if (effects.length === 0) {
        return 'none';
    }

    return effects.join(', ');
};

export const calculateTextDimensions = (layer: TextLayer): { width: number; height: number } => {
    // A temporary canvas is needed for measurements.
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        // Fallback to original dimensions if canvas is not available.
        return { width: layer.width, height: layer.height };
    }

    const linesOfSpans: TextSpan[][] = [];
    let currentLine: TextSpan[] = [];

    // Split text into lines of spans based on '\n' characters.
    if (!layer.spans) return { width: layer.width, height: layer.height };
    
    layer.spans.forEach(span => {
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
    
    // Use the dominant font size of the layer to determine line height.
    const dominantFontSize = layer.fontSize;
    const lineHeight = dominantFontSize * 1.0;
    const totalHeight = linesOfSpans.length * lineHeight;

    let maxWidth = 0;
    // Measure the width of each line and find the maximum.
    linesOfSpans.forEach(line => {
        let currentLineWidth = 0;
        line.forEach(span => {
            // Construct the font string for measurement.
            const font = `${span.fontWeight || layer.fontWeight} ${span.fontSize || layer.fontSize}px "${span.fontFamily || layer.fontFamily}"`;
            ctx.font = font;
            currentLineWidth += ctx.measureText(span.text).width;
        });
        if (currentLineWidth > maxWidth) {
            maxWidth = currentLineWidth;
        }
    });

    // Add some padding, similar to the logic in TransformableObject.
    const PADDING_V = 2;
    const PADDING_H = 4;
    
    return { width: maxWidth + PADDING_H, height: totalHeight + PADDING_V };
};