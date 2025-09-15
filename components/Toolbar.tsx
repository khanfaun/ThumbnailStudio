import React from 'react';
import { LayerType, ShapeType } from '../types';
import { TextIcon, ImageIcon, RectangleIcon, EllipseIcon, StarIcon, TriangleIcon, LineIcon } from './Icons';

interface ToolbarProps {
  onAddLayer: (type: LayerType, options?: { shapeType?: ShapeType; pointCount?: number; innerRadiusRatio?: number; }) => void;
}

const ToolbarButton = ({ children, title, onClick, isActive = false }: { children: React.ReactNode; title: string; onClick: (e: React.MouseEvent) => void; isActive?: boolean; }) => (
    <button
        title={title}
        onClick={onClick}
        className={`p-3 rounded-md transition-colors ${isActive ? 'bg-indigo-100 text-indigo-600' : 'text-slate-600 hover:bg-slate-100'}`}
    >
        {children}
    </button>
);

const Toolbar: React.FC<ToolbarProps> = ({ onAddLayer }) => {
  return (
    <div className="absolute top-12 left-1/2 -translate-x-1/2 z-10">
        <div className="bg-white rounded-lg shadow-md flex flex-row p-1 text-slate-700 space-x-1">
            <ToolbarButton title="Thêm Chữ (T)" onClick={() => onAddLayer(LayerType.Text)}>
                <TextIcon />
            </ToolbarButton>
            <ToolbarButton title="Thêm Ảnh (I)" onClick={() => onAddLayer(LayerType.Image)}>
                <ImageIcon />
            </ToolbarButton>
            <ToolbarButton title="Thêm Hình Chữ Nhật" onClick={() => onAddLayer(LayerType.Shape, { shapeType: ShapeType.Rectangle })}>
                <RectangleIcon />
            </ToolbarButton>
            <ToolbarButton title="Thêm Elip" onClick={() => onAddLayer(LayerType.Shape, { shapeType: ShapeType.Ellipse })}>
                <EllipseIcon />
            </ToolbarButton>
             <ToolbarButton title="Thêm Đường thẳng" onClick={() => onAddLayer(LayerType.Line)}>
                <LineIcon />
            </ToolbarButton>
            <ToolbarButton title="Thêm Tam Giác" onClick={() => onAddLayer(LayerType.Shape, { shapeType: ShapeType.Polygon, pointCount: 3, innerRadiusRatio: 0.5 })}>
                <TriangleIcon />
            </ToolbarButton>
            <ToolbarButton title="Thêm Ngôi Sao" onClick={() => onAddLayer(LayerType.Shape, { shapeType: ShapeType.Polygon, pointCount: 5, innerRadiusRatio: 0.5 })}>
                <StarIcon />
            </ToolbarButton>
        </div>
    </div>
  );
};

export default Toolbar;