import { Artboard, FontFamily, TextStyle, ShapeStyle } from '../types';

export const AUTOSAVE_KEY = 'thumbnail-studio-autosave';

export interface SavedState {
    artboards: Artboard[];
    customFonts: FontFamily[];
    textStyles: TextStyle[];
    shapeStyles?: ShapeStyle[];
}

export const loadStateFromLocalStorage = (): SavedState | null => {
    try {
        const savedStateString = localStorage.getItem(AUTOSAVE_KEY);
        if (savedStateString) {
            const parsedState = JSON.parse(savedStateString);
            // New format check
            if (parsedState.artboards && Array.isArray(parsedState.artboards)) {
                return {
                    artboards: parsedState.artboards,
                    customFonts: parsedState.customFonts || [],
                    textStyles: parsedState.textStyles || [],
                    shapeStyles: parsedState.shapeStyles || [],
                };
            }
            // Old format check for backward compatibility
            if (Array.isArray(parsedState) && (parsedState.length === 0 || parsedState[0].id)) {
                return {
                    artboards: parsedState,
                    customFonts: [],
                    textStyles: [],
                    shapeStyles: [],
                };
            }
        }
    } catch (error) {
        console.error("Lỗi khi tải trạng thái từ Local Storage:", error);
        localStorage.removeItem(AUTOSAVE_KEY);
    }
    return null;
};
