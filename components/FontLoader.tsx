import React, { useState, useCallback } from 'react';

interface FontLoaderProps {
  setAvailableFonts: React.Dispatch<React.SetStateAction<string[]>>;
}

const FontLoader: React.FC<FontLoaderProps> = ({ setAvailableFonts }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFontUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    const fontFamily = file.name.split('.')[0].replace(/[^a-zA-Z0-9]/g, '');

    try {
      const arrayBuffer = await file.arrayBuffer();
      const font = new FontFace(fontFamily, arrayBuffer);
      await font.load();
      document.fonts.add(font);
      setAvailableFonts(prev => [...new Set([...prev, fontFamily])]);
    } catch (err) {
      console.error("Lỗi tải font:", err);
      setError("Không thể tải file font này.");
    } finally {
      setLoading(false);
      // Reset input value to allow re-uploading the same file
      event.target.value = '';
    }
  }, [setAvailableFonts]);

  return (
    <div>
      <label htmlFor="font-upload" className="w-full inline-block bg-slate-200 hover:bg-slate-300 text-slate-800 text-center font-bold py-2 px-4 rounded-md cursor-pointer text-xs">
        {loading ? 'Đang tải...' : 'Tải Font (.ttf, .otf, .woff)'}
      </label>
      <input
        id="font-upload"
        type="file"
        accept=".ttf,.otf,.woff,.woff2"
        onChange={handleFontUpload}
        className="hidden"
        disabled={loading}
      />
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
};

export default FontLoader;