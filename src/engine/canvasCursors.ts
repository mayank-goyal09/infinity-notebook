import { ToolType } from '../types/document';

/**
 * Encodes an SVG string safely for use in CSS cursor: url(...)
 */
function toCursorDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

// 1. Sketch / Pen Cursor (Crisp angled drawing stylus with visible dual-tone outline & precision nib)
const PEN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
  <path d="M3 21l3.5-1 12.2-12.2a2.12 2.12 0 0 0 0-3l-.7-.7a2.12 2.12 0 0 0-3 0L2.8 16.3 2 22l1-1z" fill="#ffffff" stroke="#0f172a" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M14.5 4.5l3 3" stroke="#0f172a" stroke-width="1.5"/>
  <path d="M3 21l3.5-1L5.5 19l-3.5 1 1 1z" fill="#2563eb"/>
  <circle cx="2" cy="22" r="1.25" fill="#2563eb" stroke="#ffffff" stroke-width="0.5"/>
</svg>
`;

// 2. Razor / Eraser Cursor (Crisp angled eraser block with pink band and scraping edge)
const ERASER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
  <path d="M4 18L14.5 7.5a2.12 2.12 0 0 1 3 0l2 2a2.12 2.12 0 0 1 0 3L9 23H4v-5z" fill="#ffffff" stroke="#0f172a" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M13.5 8.5l3.5 3.5-3 3-3.5-3.5 3-3z" fill="#f43f5e"/>
  <path d="M4 18l5 5" stroke="#0f172a" stroke-width="1.5"/>
  <circle cx="4" cy="18" r="1.5" fill="#f43f5e" stroke="#ffffff" stroke-width="0.5"/>
</svg>
`;

// 3. Paint Bucket Cursor
const BUCKET_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
  <path d="M19 11l-8-8-8.5 8.5a2.12 2.12 0 0 0 0 3l5.5 5.5a2.12 2.12 0 0 0 3 0L19 11z" fill="#ffffff" stroke="#0f172a" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M5 13l7-7" stroke="#0f172a" stroke-width="1.5"/>
  <path d="M21 17a2 2 0 1 1-4 0c0-1.5 2-3 2-3s2 1.5 2 3z" fill="#0284c7"/>
  <circle cx="2" cy="11.5" r="1.5" fill="#0284c7" stroke="#ffffff" stroke-width="0.5"/>
</svg>
`;

// 4. Lasso Select Cursor
const LASSO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
  <path d="M7 3c-2.8 0-5 2.2-5 5 0 3.8 4.2 7.2 8.5 10.2 1.2.9 2.2 1.8 3 2.8l1.5-1.5c-.8-1-1.8-1.9-3-2.8C7.8 13.8 4 10.8 4 8c0-1.7 1.3-3 3-3s3 1.3 3 3c0 .6-.2 1.2-.5 1.7l1.7 1c.5-.8.8-1.8.8-2.7 0-2.8-2.2-5-5-5z" fill="#ffffff" stroke="#0f172a" stroke-width="1.3"/>
  <circle cx="4" cy="4" r="1.5" fill="#3b82f6" stroke="#ffffff" stroke-width="0.5"/>
</svg>
`;

// 5. Sticky Note Cursor
const STICKY_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
  <path d="M4 3h12l5 5v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill="#fef08a" stroke="#ca8a04" stroke-width="1.5"/>
  <path d="M16 3v5h5" fill="#fde047" stroke="#ca8a04" stroke-width="1.5"/>
  <circle cx="4" cy="4" r="1.5" fill="#eab308" stroke="#ffffff" stroke-width="0.5"/>
</svg>
`;

// 6. Laser Pointer Cursor
const LASER_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
  <circle cx="12" cy="12" r="8" stroke="#ffffff" stroke-width="2"/>
  <circle cx="12" cy="12" r="8" stroke="#ef4444" stroke-width="1.2" stroke-dasharray="3 2"/>
  <circle cx="12" cy="12" r="3" fill="#ef4444" stroke="#ffffff" stroke-width="0.75"/>
</svg>
`;

// Compiled Data URI strings with calibrated hotspot coordinates
export const CURSOR_DATA_URIS = {
  pen: `url("${toCursorDataUri(PEN_SVG)}") 2 22, crosshair`,
  eraser: `url("${toCursorDataUri(ERASER_SVG)}") 4 18, cell`,
  bucket: `url("${toCursorDataUri(BUCKET_SVG)}") 2 12, cell`,
  lasso: `url("${toCursorDataUri(LASSO_SVG)}") 4 4, crosshair`,
  sticky: `url("${toCursorDataUri(STICKY_SVG)}") 4 4, crosshair`,
  laser: `url("${toCursorDataUri(LASER_SVG)}") 12 12, crosshair`,
  text: 'text',
  shape: 'crosshair',
  frame: 'crosshair',
  image: 'copy',
  ruler: 'crosshair',
  embed: 'crosshair',
  handIdle: 'grab',
  handActive: 'grabbing',
  selectDefault: 'default',
  selectMove: 'move',
};

export interface CanvasCursorContext {
  activeTool: ToolType;
  isPanning?: boolean;
  isSpacePressed?: boolean;
  hoverHandle?: string | null;
  isOverSelectedBounds?: boolean;
  isDraggingObjects?: boolean;
  isResizing?: boolean;
}

/**
 * Returns the exact CSS cursor string for the current tool and interaction context.
 * Guarantees zero leakage: non-select tools will NEVER show "move" or resize handles.
 */
export function getCanvasCursor(ctx: CanvasCursorContext): string {
  // 1. Highest Priority: Spacebar pan or Hand tool active pan
  if (ctx.isPanning || ctx.isSpacePressed) {
    return CURSOR_DATA_URIS.handActive;
  }

  // 2. Hand Tool
  if (ctx.activeTool === 'hand') {
    return CURSOR_DATA_URIS.handIdle;
  }

  // 3. Selection Tool: Contextual handles and movement
  if (ctx.activeTool === 'select') {
    if (ctx.isResizing || ctx.hoverHandle) {
      const handle = ctx.hoverHandle;
      if (handle === 'nw' || handle === 'se') return 'nwse-resize';
      if (handle === 'ne' || handle === 'sw') return 'nesw-resize';
      if (handle === 'n' || handle === 's') return 'ns-resize';
      if (handle === 'e' || handle === 'w') return 'ew-resize';
    }
    if (ctx.isDraggingObjects || ctx.isOverSelectedBounds) {
      return CURSOR_DATA_URIS.selectMove;
    }
    return CURSOR_DATA_URIS.selectDefault;
  }

  // 4. Sketch / Pen Tool
  if (ctx.activeTool === 'pen') {
    return CURSOR_DATA_URIS.pen;
  }

  // 5. Razor / Eraser Tool
  if (ctx.activeTool === 'eraser') {
    return CURSOR_DATA_URIS.eraser;
  }

  // 6. Text Tool
  if (ctx.activeTool === 'text') {
    return CURSOR_DATA_URIS.text;
  }

  // 7. Sticky Note Tool
  if (ctx.activeTool === 'sticky') {
    return CURSOR_DATA_URIS.sticky;
  }

  // 8. Shape Tools & Geometry
  if (ctx.activeTool === 'shape' || ctx.activeTool === 'frame' || ctx.activeTool === 'ruler' || ctx.activeTool === 'embed') {
    return CURSOR_DATA_URIS.shape;
  }

  // 9. Specialized Extra Tools
  if (ctx.activeTool === 'bucket') {
    return CURSOR_DATA_URIS.bucket;
  }
  if (ctx.activeTool === 'laser') {
    return CURSOR_DATA_URIS.laser;
  }
  if (ctx.activeTool === 'lasso') {
    return CURSOR_DATA_URIS.lasso;
  }
  if (ctx.activeTool === 'image') {
    return CURSOR_DATA_URIS.image;
  }

  // Default fallback
  return 'default';
}
