// FIX: Removed conflicting import. This file defines these types, so importing them from another location creates naming conflicts.
export enum LayerType {
  Text = 'TEXT',
  Image = 'IMAGE',
  Shape = 'SHAPE',
  Line = 'LINE',
}

export enum ShapeType {
  Rectangle = 'RECTANGLE',
  Ellipse = 'ELLIPSE',
  Polygon = 'POLYGON',
}

export enum LineEndCapShape {
  None = 'NONE',
  Triangle = 'TRIANGLE',
  Square = 'SQUARE',
  Circle = 'CIRCLE',
}

export interface LineEndCap {
  shape: LineEndCapShape;
  size: number; // Multiplier of strokeWidth
}

export interface ShadowStyle {
  enabled: boolean;
  color: string;
  opacity: number;
  offsetX: number;
  offsetY: number;
  blur: number;
}

export interface GlowStyle {
  enabled: boolean;
  color: string;
  opacity: number;
  blur: number;
}

export interface BaseLayer {
  id: string;
  name?: string;
  dataId?: string; // Key để map với cột trong CSV
  type: LayerType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  locked: boolean;
  visible?: boolean;
  shadow?: ShadowStyle;
  glow?: GlowStyle;
}

export interface TextSpan {
  text: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  fontWeight?: number;
  underline?: boolean;
  strikethrough?: boolean;
  textScript?: 'normal' | 'superscript';
  textTransform?: 'none' | 'uppercase';
}

export interface StrokeStyle {
  id: string;
  color: string;
  width: number;
}

export interface TextLayer extends BaseLayer {
  type: LayerType.Text;
  spans: TextSpan[];
  fontFamily: string;
  fontSize: number;
  color: string;
  fontWeight: number;
  textAlign?: 'left' | 'center' | 'right';
  spansVersion?: number;
  strokes?: StrokeStyle[];
  underline?: boolean;
  strikethrough?: boolean;
  textScript?: 'normal' | 'superscript';
  textTransform?: 'none' | 'uppercase';
}

export interface ImageLayer extends BaseLayer {
  type: LayerType.Image;
  src: string;
}

export interface BaseShapeLayer extends BaseLayer {
  type: LayerType.Shape;
  shapeType: ShapeType;
  fill: string;
  strokes?: StrokeStyle[];
}

export interface RectangleShapeLayer extends BaseShapeLayer {
  shapeType: ShapeType.Rectangle;
  cornerRadius: number;
}

export interface EllipseShapeLayer extends BaseShapeLayer {
  shapeType: ShapeType.Ellipse;
  // No special properties needed
}

export interface PolygonShapeLayer extends BaseShapeLayer {
  shapeType: ShapeType.Polygon;
  pointCount: number;
  innerRadiusRatio: number; // For star shape
  cornerRadius: number;
}

export interface LineLayer extends BaseLayer {
  type: LayerType.Line;
  color: string;
  strokeWidth: number;
  startCap: LineEndCap;
  endCap: LineEndCap;
}

export type AnyShapeLayer = RectangleShapeLayer | EllipseShapeLayer | PolygonShapeLayer;

export type Layer = TextLayer | ImageLayer | AnyShapeLayer | LineLayer;

export interface Guide {
  id: string;
  orientation: 'horizontal' | 'vertical';
  position: number;
  color?: string;
}

export interface Artboard {
  id: string;
  name: string;
  width: number;
  height: number;
  backgroundColor: string;
  layers: Layer[];
  guides?: Guide[];
}

export interface TextStyle {
  id: string;
  name: string;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  textAlign?: 'left' | 'center' | 'right';
  color: string;
  strokes?: StrokeStyle[];
  shadow?: ShadowStyle;
  underline?: boolean;
  strikethrough?: boolean;
  textScript?: 'normal' | 'superscript';
  textTransform?: 'none' | 'uppercase';
}

export interface ShapeStyle {
  id: string;
  name: string;
  fill: string;
  strokes?: StrokeStyle[];
  shadow?: ShadowStyle;
  cornerRadius?: number; // Applies to Rectangle and Polygon
}

export interface FontVariant {
  name: string;
  weight: number;
  style: 'normal' | 'italic';
  url: string;
}

export interface FontFamily {
  name: string;
  variants: FontVariant[];
}