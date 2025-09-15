import React, { useState, useCallback, useEffect } from 'react';
import { Artboard as ArtboardType, Layer, LayerType, TextLayer, ImageLayer } from './types';
import EditorPanel from './components/EditorPanel';
import ArtboardComponent from './components/Artboard';
import { initialArtboards } from './constants';

const App: React.FC = () => {
  const [artboards, setArtboards] = useState<ArtboardType[]>(initialArtboards);
  const [activeArtboardId, setActiveArtboardId] = useState<string | null>(initialArtboards.length > 0 ? initialArtboards[0].id : null);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [availableFonts, setAvailableFonts] = useState<string[]>(['Inter', 'Arial', 'Verdana']);

  const activeArtboard = artboards.find(a => a.id === activeArtboardId);
  const selectedLayer = activeArtboard?.layers.find(l => l.id === selectedLayerId);

  useEffect(() => {
    // Deselect layer if artboard changes
    setSelectedLayerId(null);
  }, [activeArtboardId]);

  const updateArtboard = useCallback((artboardId: string, updates: Partial<ArtboardType>) => {
    setArtboards(prev =>
      prev.map(a => (a.id === artboardId ? { ...a, ...updates } : a))
    );
  }, []);

  const updateLayer = useCallback((layerId: string, updates: Partial<Layer>) => {
    if (!activeArtboardId) return;
    setArtboards(prev =>
      prev.map(a =>
        a.id === activeArtboardId
          ? {
              ...a,
              layers: a.layers.map(l =>
                // FIX: Add type assertion to resolve discriminated union update issue.
                // The spread operator with a discriminated union and a partial update
                // can create a type that TypeScript cannot automatically resolve.
                // Asserting as Layer tells TypeScript we guarantee the resulting object is a valid Layer.
                l.id === layerId ? ({ ...l, ...updates } as Layer) : l
              ),
            }
          : a
      )
    );
  }, [activeArtboardId]);
  
  const handleAddArtboard = () => {
    const newId = `artboard-${Date.now()}`;
    const newArtboard: ArtboardType = {
      id: newId,
      name: `Artboard mới ${artboards.length + 1}`,
      width: 1280,
      height: 720,
      backgroundColor: '#1f2937',
      layers: [],
    };
    setArtboards(prev => [...prev, newArtboard]);
    setActiveArtboardId(newId);
  };
  
  const handleDeleteArtboard = (artboardId: string) => {
    setArtboards(prev => prev.filter(a => a.id !== artboardId));
    if (activeArtboardId === artboardId) {
        setActiveArtboardId(artboards.length > 1 ? artboards.filter(a => a.id !== artboardId)[0].id : null);
    }
  };

  const addLayer = useCallback((type: LayerType) => {
    if (!activeArtboard) return;
    const newZIndex = Math.max(0, ...activeArtboard.layers.map(l => l.zIndex)) + 1;

    let newLayer: Layer;
    const baseLayer = {
      id: `${type.toLowerCase()}-${Date.now()}`,
      x: 50,
      y: 50,
      rotation: 0,
      zIndex: newZIndex,
    };

    if (type === LayerType.Text) {
      newLayer = {
        ...baseLayer,
        type: LayerType.Text,
        text: 'Văn bản mới',
        fontFamily: 'Inter',
        fontSize: 48,
        color: '#ffffff',
        fontWeight: 700,
        width: 300,
        height: 60,
      } as TextLayer;
    } else {
      newLayer = {
        ...baseLayer,
        type: LayerType.Image,
        src: 'https://picsum.photos/400/300',
        width: 400,
        height: 300,
      } as ImageLayer;
    }

    const updatedLayers = [...activeArtboard.layers, newLayer];
    updateArtboard(activeArtboard.id, { layers: updatedLayers });
    setSelectedLayerId(newLayer.id);
  }, [activeArtboard, updateArtboard]);

  const deleteLayer = useCallback((layerId: string) => {
    if (!activeArtboard) return;
    const updatedLayers = activeArtboard.layers.filter(l => l.id !== layerId);
    updateArtboard(activeArtboard.id, { layers: updatedLayers });
    if (selectedLayerId === layerId) {
      setSelectedLayerId(null);
    }
  }, [activeArtboard, updateArtboard, selectedLayerId]);
  
  const handleLayerZIndexChange = (layerId: string, direction: 'up' | 'down') => {
      if (!activeArtboard) return;

      const layers = [...activeArtboard.layers].sort((a,b) => a.zIndex - b.zIndex);
      const currentIndex = layers.findIndex(l => l.id === layerId);

      if (direction === 'up' && currentIndex < layers.length - 1) {
          [layers[currentIndex].zIndex, layers[currentIndex + 1].zIndex] = [layers[currentIndex + 1].zIndex, layers[currentIndex].zIndex];
      } else if (direction === 'down' && currentIndex > 0) {
          [layers[currentIndex].zIndex, layers[currentIndex - 1].zIndex] = [layers[currentIndex - 1].zIndex, layers[currentIndex].zIndex];
      }
      
      updateArtboard(activeArtboard.id, { layers });
  };


  return (
    <div className="flex h-screen w-screen bg-gray-900 text-gray-200">
      <aside className="w-80 h-full bg-gray-800 p-4 overflow-y-auto shadow-lg flex flex-col">
        <EditorPanel
          artboards={artboards}
          activeArtboard={activeArtboard}
          selectedLayer={selectedLayer}
          onArtboardSelect={setActiveArtboardId}
          onLayerSelect={setSelectedLayerId}
          onUpdateArtboard={updateArtboard}
          onUpdateLayer={updateLayer}
          onAddLayer={addLayer}
          onDeleteLayer={deleteLayer}
          onAddArtboard={handleAddArtboard}
          onDeleteArtboard={handleDeleteArtboard}
          onLayerZIndexChange={handleLayerZIndexChange}
          availableFonts={availableFonts}
          setAvailableFonts={setAvailableFonts}
        />
      </aside>
      <main className="flex-1 p-8 overflow-auto">
        <div className="grid grid-cols-1 gap-8">
          {artboards.map(artboard => (
            <div key={artboard.id}>
              <h2 className="text-xl font-bold mb-2">{artboard.name}</h2>
              <ArtboardComponent
                artboard={artboard}
                isActive={artboard.id === activeArtboardId}
                selectedLayerId={selectedLayerId}
                onSelectArtboard={() => setActiveArtboardId(artboard.id)}
                onSelectLayer={setSelectedLayerId}
                onUpdateLayer={updateLayer}
              />
            </div>
          ))}
          {artboards.length === 0 && (
              <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                      <p className="text-gray-400 mb-4">Chưa có artboard nào.</p>
                      <button
                          onClick={handleAddArtboard}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                      >
                          Tạo Artboard Mới
                      </button>
                  </div>
              </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
