export type PenType =
  | 'ballpoint'
  | 'gel'
  | 'fineliner'
  | 'fountain'
  | 'calligraphy'
  | 'brush'
  | 'marker'
  | 'highlighter'
  | 'pencil'
  | 'charcoal'
  | 'airbrush'
  | 'dashed'
  | 'laser';

export interface PenConfig {
  id: string;
  name: string;
  type: PenType;
  color: string;
  size: number;
  opacity: number;
  smoothing: number; // 0 to 1
  taperStart?: number;
  taperEnd?: number;
  customNibAngle?: number; // for calligraphy, in degrees
}

export type ToolType =
  | 'pen'
  | 'eraser'
  | 'select'
  | 'lasso'
  | 'shape'
  | 'text'
  | 'sticky'
  | 'image'
  | 'hand'
  | 'laser'
  | 'ruler'
  | 'frame'
  | 'bucket'
  | 'embed';

export type ShapeType =
  | 'line'
  | 'arrow'
  | 'rectangle'
  | 'rounded_rect'
  | 'ellipse'
  | 'triangle'
  | 'polygon'
  | 'star'
  | 'curve'
  | 'connector';

export type PageTemplate =
  | 'spreadsheet'
  | 'blank'
  | 'lined'
  | 'grid'
  | 'dotted'
  | 'isometric'
  | 'cornell'
  | 'music'
  | 'todo'
  | 'custom_color';

export type PageSize = 'A4' | 'A5' | 'Letter' | 'Square' | 'Slide16_9' | 'Custom';
export type PageOrientation = 'portrait' | 'landscape';

export interface StrokePoint {
  x: number;
  y: number;
  pressure?: number; // 0 to 1
  tiltX?: number;
  tiltY?: number;
  time: number;
}

export interface BaseObject {
  id: string;
  pageId: string | null; // null if on open canvas outside any frame
  type: 'stroke' | 'shape' | 'text' | 'sticky' | 'image' | 'table' | 'frame' | 'embed';
  layerId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity?: number;
  rotation?: number;
  locked?: boolean;
  groupId?: string;
  createdAt: number;
  updatedAt: number;
  deviceId: string;
}

export interface StrokeObject extends BaseObject {
  type: 'stroke';
  penType: PenType;
  color: string;
  size: number;
  opacity: number;
  points: StrokePoint[];
  simplifiedPoints?: StrokePoint[];
  blendMode?: GlobalCompositeOperation;
  isHighlighter?: boolean;
}

export type FillStyle = 'hachure' | 'cross-hatch' | 'solid';

export interface ShapeObject extends BaseObject {
  type: 'shape';
  shapeType: ShapeType;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  strokeStyle: 'solid' | 'dashed' | 'dotted';
  fillStyle?: FillStyle;
  roughness?: number; // 0 = architect, 1 = artist, 2 = cartoonist
  arrowStart?: boolean;
  arrowEnd?: boolean;
  startPoint?: { x: number; y: number };
  endPoint?: { x: number; y: number };
  controlPoint?: { x: number; y: number };
  connectedFromId?: string;
  connectedToId?: string;
}

export interface ShapeConfig {
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  strokeStyle: 'solid' | 'dashed' | 'dotted';
  fillStyle: FillStyle;
  roughness: number;
  rounded: boolean;
  opacity: number;
}

export interface TextObject extends BaseObject {
  type: 'text';
  text: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  align?: 'left' | 'center' | 'right';
  isMathFormula?: boolean;
}

export interface StickyNoteObject extends BaseObject {
  type: 'sticky';
  text: string;
  color: string; // warm yellow, blue, peach, mint, lavender, rose
  textColor?: string;
  fontFamily: string;
  fontSize: number;
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  dateLabel?: string;
}

export interface ImageObject extends BaseObject {
  type: 'image';
  src: string; // base64 or blob URL / asset hash
  aspectRatio: number;
  originalWidth: number;
  originalHeight: number;
  crop?: { x: number; y: number; width: number; height: number };
}

export type AccountingFormatType =
  | 'journal'
  | 'ledger_t'
  | 'ledger_running'
  | 'trial_balance'
  | 'balance_sheet'
  | 'income_statement'
  | 'cash_flow'
  | 'brs'
  | 'petty_cash'
  | 'stock_register'
  | 'payroll'
  | 'ar_aging'
  | 'ap_ledger'
  | 'custom_table';

export interface TableColumn {
  id: string;
  label: string;
  subLabel?: string;
  width: number; // in px
  align: 'left' | 'center' | 'right';
  format?: 'text' | 'currency' | 'number' | 'date';
  isAutoSum?: boolean;
}

export interface TableCell {
  value: string;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  format?: 'text' | 'currency' | 'number' | 'date';
  bgColor?: string;
  textColor?: string;
  doubleUnderline?: boolean;
  isTotal?: boolean;
}

export interface TableRow {
  id: string;
  cells: Record<string, TableCell>; // keyed by column id
  isHeader?: boolean;
  isTotal?: boolean;
  isSubtotal?: boolean;
  height?: number;
}

export interface AccountingTableObject extends BaseObject {
  type: 'table';
  formatType: AccountingFormatType;
  title: string;
  columns: TableColumn[];
  rows: TableRow[];
  currencySymbol?: string;
  showAutoTotals?: boolean;
  showBalancedIndicator?: boolean;
  bgColor?: string; // '#ffffff', 'transparent', '#fefce8', etc.
  textColor?: string; // '#0f172a', '#ffffff', etc.
  headerBgColor?: string;
  headerTextColor?: string;
  borderStyle?: 'grid' | 'clean' | 'ledger';
  fontSize?: number;
  rowHeight?: number;
  headerHeight?: number;
  scale?: number;
}

export interface FrameObject extends BaseObject {
  type: 'frame';
  name: string;
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
  strokeStyle?: 'solid' | 'dashed';
}

export interface EmbedObject extends BaseObject {
  type: 'embed';
  url: string;
  title: string;
  embedType?: 'youtube' | 'generic';
}

export type CanvasObject =
  | StrokeObject
  | ShapeObject
  | TextObject
  | StickyNoteObject
  | ImageObject
  | AccountingTableObject
  | FrameObject
  | EmbedObject;

export interface PageFrame {
  id: string;
  title: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  sizeFormat: PageSize;
  orientation: PageOrientation;
  template: PageTemplate;
  templateColor?: string;
  templateSpacing: number; // e.g., 24px lined/grid spacing
  bookmarked?: boolean;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface DocumentLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
}

export interface NotebookDocument {
  id: string;
  title: string;
  description: string;
  version: number;
  createdAt: number;
  updatedAt: number;
  deviceId: string;
  currentMode: 'notebook' | 'canvas';
  pages: PageFrame[];
  objects: CanvasObject[];
  layers: DocumentLayer[];
  activePageId: string;
  tags: string[];
  autoAppendPages: boolean;
}

export interface ClickToInkSettings {
  enabled: boolean;
  endTrigger: 'click' | 'double_click' | 'hold_release';
  pauseToLiftEnabled: boolean;
  pauseToLiftMs: number;
  edgeAutoPan: boolean;
  dotOnTap: boolean;
  audioTick: boolean;
  visualTick: boolean;
}

export interface InputSettings {
  smoothing: number; // 0 to 1
  lazyRope: boolean;
  lazyRopeLength: number;
  velocityPressure: boolean;
  velocitySensitivity: number; // 0.1 to 2.0
  wheelMode: 'auto' | 'zoom' | 'pan';
  touchpadMode: 'auto' | 'touchpad' | 'mouse';
  inertialPan: boolean;
}

export type AppTheme = 'light' | 'dark' | 'paper';

export interface CameraState {
  x: number;
  y: number;
  zoom: number; // 0.02 to 64.0
}

export interface SelectionState {
  selectedIds: string[];
  bounds: { x: number; y: number; width: number; height: number } | null;
  mode: 'idle' | 'moving' | 'scaling' | 'rotating' | 'lasso' | 'marquee';
  lassoPoints?: { x: number; y: number }[];
  activeHandle?: string;
}

export interface LaserTrailPoint {
  x: number;
  y: number;
  time: number;
  size: number;
}

export interface PerformanceStats {
  fps: number;
  frameTimeMs: number;
  renderedObjects: number;
  totalObjects: number;
  zoomPercent: number;
  mode: string;
}
