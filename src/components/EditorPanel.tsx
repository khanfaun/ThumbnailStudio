import React from 'react';
import { Artboard, Layer, LayerType, TextLayer, ImageLayer } from '../types';
import FontLoader from './FontLoader';

interface EditorPanelProps {
  artboards: Artboard[];
  activeArtboard: Artboard | undefined;
  selectedLayer: Layer | undefined;
  onArtboardSelect: (id: string) => void;
  onLayerSelect: (id: string | null) => void;
  onUpdateArtboard: (id: string, updates: Partial<Artboard>) => void;
  onUpdateLayer: (id: string, updates: Partial<Layer>) => void;
  onAddLayer: (type: LayerType) => void;
  onDeleteLayer: (id: string) => void;
  onAddArtboard: () => void;
  onDeleteArtboard: (id: string) => void;
  onLayerZIndexChange: (layerId: string, direction: 'up' | 'down') => void;
  availableFonts: string[];
  setAvailableFonts: React.Dispatch<React.SetStateAction<string[]>>;
}

const EditorPanel: React.FC<EditorPanelProps> = ({
  artboards,
  activeArtboard,
  selectedLayer,
  onArtboardSelect,
  onLayerSelect,
  onUpdateArtboard,
  onUpdateLayer,
  onAddLayer,
  onDeleteLayer,
  onAddArtboard,
  onDeleteArtboard,
  onLayerZIndexChange,
  availableFonts,
  setAvailableFonts,
}) => {
  const handleArtboardPropChange = <K extends keyof Artboard,>(prop: K, value: Artboard[K]) => {
    if (activeArtboard) {
      onUpdateArtboard(activeArtboard.id, { [prop]: value });
    }
  };

  // FIX: Updated handleLayerPropChange to accept a Partial<Layer> object.
  // This resolves TypeScript errors where layer-specific properties (like 'text' or 'src')
  // were not assignable to 'keyof Layer', which only includes common properties.
  const handleLayerPropChange = (updates: Partial<Layer>) => {
    if (selectedLayer) {
      onUpdateLayer(selectedLayer.id, updates);
    }
  };
  
  const sortedLayers = activeArtboard ? [...activeArtboard.layers].sort((a,b) => b.zIndex - a.zIndex) : [];

  return (
    <div className="flex flex-col space-y-6 h-full text-sm">
      <div>
        <h2 className="text-lg font-bold mb-2">Artboards</h2>
        <div className="space-y-2">
            {artboards.map(a => (
                <div key={a.id} onClick={() => onArtboardSelect(a.id)}
                    className={`p-2 rounded cursor-pointer flex justify-between items-center ${activeArtboard?.id === a.id ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}>
                    <span>{a.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); onDeleteArtboard(a.id);}} className="text-red-400 hover:text-red-300">✕</button>
                </div>
            ))}
        </div>
        <button onClick={onAddArtboard} className="mt-2 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
            Thêm Artboard
        </button>
      </div>

      {activeArtboard && (
        <>
          <div className="border-t border-gray-600 pt-4">
            <h3 className="font-bold mb-2">Cài đặt Artboard</h3>
            <label className="block">Tên</label>
            <input type="text" value={activeArtboard.name} onChange={(e) => handleArtboardPropChange('name', e.target.value)} className="w-full bg-gray-700 p-1 rounded" />
            <label className="block mt-2">Màu nền</label>
            <input type="color" value={activeArtboard.backgroundColor} onChange={(e) => handleArtboardPropChange('backgroundColor', e.target.value)} className="w-full bg-gray-700 p-1 rounded" />
          </div>

          <div className="border-t border-gray-600 pt-4">
            <h3 className="font-bold mb-2">Layers</h3>
            <div className="flex space-x-2 mb-2">
              <button onClick={() => onAddLayer(LayerType.Text)} className="flex-1 bg-gray-600 hover:bg-gray-500 py-2 rounded">Thêm Chữ</button>
              <button onClick={() => onAddLayer(LayerType.Image)} className="flex-1 bg-gray-600 hover:bg-gray-500 py-2 rounded">Thêm Ảnh</button>
            </div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {sortedLayers.map(l => (
                  <div key={l.id} onClick={() => onLayerSelect(l.id)}
                      className={`p-2 rounded cursor-pointer flex justify-between items-center ${selectedLayer?.id === l.id ? 'bg-blue-800' : 'bg-gray-700 hover:bg-gray-600'}`}>
                      <span>{l.type === 'TEXT' ? (l as TextLayer).spans.map(s=>s.text).join('').substring(0, 15) : 'Hình ảnh'}</span>
                      <div className="flex items-center space-x-2">
                        <button onClick={(e)=>{e.stopPropagation(); onLayerZIndexChange(l.id, 'up')}}>▲</button>
                        <button onClick={(e)=>{e.stopPropagation(); onLayerZIndexChange(l.id, 'down')}}>▼</button>
                        <button onClick={(e) => { e.stopPropagation(); onDeleteLayer(l.id) }} className="text-red-400 hover:text-red-300">✕</button>
                      </div>
                  </div>
              ))}
            </div>
          </div>
        </>
      )}

      {selectedLayer && (
        <div className="border-t border-gray-600 pt-4 flex-1 overflow-y-auto">
          <h3 className="font-bold mb-2">Chỉnh sửa Layer</h3>
          <div className="space-y-2">
             {/* Common props */}
             <div><label>X:</label><input type="number" value={Math.round(selectedLayer.x)} onChange={(e) => handleLayerPropChange({ x: parseInt(e.target.value) })} className="w-full bg-gray-700 p-1 rounded" /></div>
             <div><label>Y:</label><input type="number" value={Math.round(selectedLayer.y)} onChange={(e) => handleLayerPropChange({ y: parseInt(e.target.value) })} className="w-full bg-gray-700 p-1 rounded" /></div>
             <div><label>Rộng:</label><input type="number" value={Math.round(selectedLayer.width)} onChange={(e) => handleLayerPropChange({ width: parseInt(e.target.value) })} className="w-full bg-gray-700 p-1 rounded" /></div>
             <div><label>Cao:</label><input type="number" value={Math.round(selectedLayer.height)} onChange={(e) => handleLayerPropChange({ height: parseInt(e.target.value) })} className="w-full bg-gray-700 p-1 rounded" /></div>
             <div><label>Xoay:</label><input type="range" min="-180" max="180" value={selectedLayer.rotation} onChange={(e) => handleLayerPropChange({ rotation: parseInt(e.target.value) })} className="w-full" /></div>
            
            {/* Text specific props */}
            {selectedLayer.type === LayerType.Text && (
              <>
                <div><label>Nội dung:</label><textarea value={(selectedLayer as TextLayer).spans.map(s => s.text).join('')} onChange={(e) => handleLayerPropChange({ spans: [{text: e.target.value}] })} className="w-full bg-gray-700 p-1 rounded" /></div>
                <div><label>Font:</label>
                  <select value={(selectedLayer as TextLayer).fontFamily} onChange={(e) => handleLayerPropChange({ fontFamily: e.target.value })} className="w-full bg-gray-700 p-1 rounded">
                    {availableFonts.map(font => <option key={font} value={font}>{font}</option>)}
                  </select>
                </div>
                <div><label>Cỡ chữ:</label><input type="number" value={(selectedLayer as TextLayer).fontSize} onChange={(e) => handleLayerPropChange({ fontSize: parseInt(e.target.value) })} className="w-full bg-gray-700 p-1 rounded" /></div>
                <div><label>Màu:</label><input type="color" value={(selectedLayer as TextLayer).color} onChange={(e) => handleLayerPropChange({ color: e.target.value })} className="w-full bg-gray-700 p-1 rounded" /></div>
                <div><label>Độ đậm:</label><input type="number" step="100" min="100" max="900" value={(selectedLayer as TextLayer).fontWeight} onChange={(e) => handleLayerPropChange({ fontWeight: parseInt(e.target.value) })} className="w-full bg-gray-700 p-1 rounded" /></div>
              </>
            )}

            {/* Image specific props */}
            {selectedLayer.type === LayerType.Image && (
              <>
                 <div><label>Nguồn ảnh (URL):</label><input type="text" value={(selectedLayer as ImageLayer).src} onChange={(e) => handleLayerPropChange({ src: e.target.value })} className="w-full bg-gray-700 p-1 rounded" /></div>
              </>
            )}
          </div>
        </div>
      )}
      <div className="border-t border-gray-600 pt-4 mt-auto">
        <FontLoader setAvailableFonts={setAvailableFonts} />
      </div>
    </div>
  );
};

export default EditorPanel;