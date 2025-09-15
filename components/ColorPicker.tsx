import React, { useState, useRef, useCallback, useEffect } from 'react';

// --- Color Conversion Utilities ---

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

function rgbToHex(r: number, g: number, b: number): string {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s, v = max;
  const d = max - min;
  s = max === 0 ? 0 : d / max;
  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, v: v * 100 };
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  s /= 100; v /= 100;
  let r = 0, g = 0, b = 0;
  const i = Math.floor(h / 60);
  const f = h / 60 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

// --- Component ---

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (color: string) => void;
  isMixed?: boolean;
}

const primaryPalette = ['#000000', '#FFFFFF', '#FF4713', '#F6871F', '#90ADFF'];
const secondaryPalette = ['#6F2DBD', '#8EB780', '#FDE74C', '#D30C7B'];

const ColorSwatch = ({ color, value, onChange }: { color: string; value: string; onChange: (c: string) => void; }) => (
    <button
      type="button"
      onClick={() => onChange(color)}
      className={`w-6 h-6 rounded-full border transition-all ${value.toLowerCase() === color.toLowerCase() ? 'ring-2 ring-offset-1 ring-indigo-500' : 'border-slate-300 hover:border-slate-400'}`}
      style={{ backgroundColor: color }}
      aria-label={`Chọn màu ${color}`}
    />
);

const ColorPicker: React.FC<ColorPickerProps> = ({ label, value, onChange, isMixed }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hsv, setHsv] = useState({ h: 0, s: 0, v: 100 });

  const pickerRef = useRef<HTMLDivElement>(null);
  const saturationRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const isDraggingSaturation = useRef(false);
  const isDraggingHue = useRef(false);

  const hsvRef = useRef(hsv);
  hsvRef.current = hsv;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const rgb = hexToRgb(value);
    if (rgb) {
      const newHsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
      // Only update if the color has actually changed to avoid feedback loops
      if (newHsv.h !== hsv.h || newHsv.s !== hsv.s || newHsv.v !== hsv.v) {
        setHsv(newHsv);
      }
    }
  }, [value, hsv.h, hsv.s, hsv.v]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const currentOnChange = onChangeRef.current;
    
    const handleHsvChange = (newHsv: {h: number, s: number, v: number}) => {
        setHsv(newHsv); // Update local state immediately for responsiveness
        const { r, g, b } = hsvToRgb(newHsv.h, newHsv.s, newHsv.v);
        currentOnChange(rgbToHex(r, g, b));
    };

    if (isDraggingSaturation.current && saturationRef.current) {
        const rect = saturationRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
        const s = (x / rect.width) * 100;
        const v = 100 - (y / rect.height) * 100;
        handleHsvChange({ ...hsvRef.current, s, v });
    }
    if (isDraggingHue.current && hueRef.current) {
        const rect = hueRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const h = (x / rect.width) * 360;
        handleHsvChange({ ...hsvRef.current, h });
    }
  }, []);

  const handleMouseUp = useCallback(() => {
    isDraggingSaturation.current = false;
    isDraggingHue.current = false;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  useEffect(() => {
    return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
            setIsOpen(false);
        }
    };
    if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);
  
  const handleSaturationMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingSaturation.current = true;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    handleMouseMove(e.nativeEvent);
  };
  
  const handleHueMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingHue.current = true;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    handleMouseMove(e.nativeEvent);
  };

  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let inputVal = e.target.value;
      if (!inputVal.startsWith('#')) {
          inputVal = '#' + inputVal;
      }
      onChange(inputVal.toUpperCase());
  };

  return (
    <div className="w-full">
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      <div className="relative" ref={pickerRef}>
        <button
          type="button"
          onClick={() => setIsOpen(prev => !prev)}
          onMouseDown={(e) => e.preventDefault()}
          className="w-full bg-slate-100 p-2 rounded-md border border-slate-200 flex items-center justify-between text-left focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
        >
          {isMixed ? (
            <span className="text-sm text-slate-500">Nhiều màu</span>
          ) : (
            <span className="font-mono text-sm">{value}</span>
          )}
          <div
            className="w-6 h-6 rounded-md border border-slate-200 flex-shrink-0"
            style={{
              backgroundColor: isMixed ? 'transparent' : value,
              backgroundImage: isMixed
                ? 'linear-gradient(45deg, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%), linear-gradient(45deg, #ddd 25%, transparent 25%, transparent 75%, #ddd 75%)'
                : 'none',
              backgroundSize: '8px 8px',
              backgroundPosition: '0 0, 4px 4px',
            }}
          />
        </button>

        {isOpen && (
          <div
            className="absolute top-full mt-2 z-20 bg-white p-3 rounded-lg shadow-2xl border border-slate-200 w-[260px]"
            onMouseDown={(e) => e.preventDefault()}
          >
            <div className="w-full space-y-2">
              <div
                ref={saturationRef}
                onMouseDown={handleSaturationMouseDown}
                style={{ backgroundColor: `hsl(${hsv.h}, 100%, 50%)` }}
                className="relative w-full h-32 rounded-md cursor-crosshair"
              >
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, white, transparent)' }} />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, black, transparent)' }} />
                <div
                  style={{ left: `${hsv.s}%`, top: `${100 - hsv.v}%` }}
                  className="absolute w-3.5 h-3.5 -ml-[7px] -mt-[7px] rounded-full border-2 border-white shadow-md pointer-events-none ring-1 ring-black/30"
                />
              </div>

              <div
                ref={hueRef}
                onMouseDown={handleHueMouseDown}
                className="relative w-full h-3 rounded-full cursor-pointer"
                style={{ background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}
              >
                <div
                  style={{ left: `${(hsv.h / 360) * 100}%` }}
                  className="absolute w-3.5 h-3.5 top-1/2 -ml-[7px] -mt-[7px] rounded-full border-2 border-white shadow-md pointer-events-none ring-1 ring-black/30"
                />
              </div>

              <input
                type="text"
                value={value}
                onChange={handleHexInputChange}
                className="w-full bg-slate-100 p-2 rounded-md border border-slate-200 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-mono"
              />

              <div className="flex-1 flex flex-col space-y-2 pt-2">
                <div className="flex items-center space-x-2">
                  {primaryPalette.map(color => (
                    <ColorSwatch key={color} color={color} value={value} onChange={onChange} />
                  ))}
                </div>
                <div className="flex items-center space-x-2">
                  {secondaryPalette.map(color => (
                    <ColorSwatch key={color} color={color} value={value} onChange={onChange} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ColorPicker;