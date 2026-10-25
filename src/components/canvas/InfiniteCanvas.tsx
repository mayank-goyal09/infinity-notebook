import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  NotebookDocument,
  PenConfig,
  ToolType,
  ShapeType,
  ClickToInkSettings,
  InputSettings,
  CameraState,
  StrokePoint,
  StrokeObject,
  ShapeObject,
  TextObject,
  StickyNoteObject,
  ImageObject,
  CanvasObject,
  SelectionState,
  LaserTrailPoint,
  PerformanceStats,
  PageFrame,
  AccountingTableObject,
  AccountingFormatType,
  TableRow,
  ShapeConfig,
  FrameObject,
  EmbedObject,
} from '../../types/document';
import { CameraEngine } from '../../engine/camera';
import { CanvasRenderer } from '../../engine/renderer';
import { PointFilter2D, calculateSimulatedPressure, snapToStraightLine, simplifyPoints, recognizeShape } from '../../engine/smoothing';
import { recognizeShapeFromStroke } from '../../engine/drawToShape';
import { ClickToInkFSM, ClickToInkState } from '../../engine/clickToInk';
import { PAGE_SIZE_DIMENSIONS } from '../../engine/penDefaults';
import { ACCOUNTING_FORMAT_CATALOG } from '../../engine/accountingFormats';
import { AccountingTableOverlay } from './AccountingTableOverlay';
import { TextConfig, StickyConfig } from '../toolbar/ExcalidrawPropertiesPanel';
import { measureTextBounds, wrapTextLines } from '../../engine/textMeasurement';

// Distance from point p to line segment (v -> w)
function distToSegment(
  p: { x: number; y: number },
  v: { x: number; y: number },
  w: { x: number; y: number }
): number {
  const l2 = (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y);
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

export type TransformHandle = 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w';

function getTransformHandleAtPoint(
  bounds: { x: number; y: number; width: number; height: number },
  docPt: { x: number; y: number },
  zoom: number
): TransformHandle | null {
  const { x, y, width: bw, height: bh } = bounds;
  const hitRadius = Math.max(8, 12 / zoom);

  const handles: { handle: TransformHandle; x: number; y: number }[] = [
    { handle: 'nw', x, y },
    { handle: 'ne', x: x + bw, y },
    { handle: 'se', x: x + bw, y: y + bh },
    { handle: 'sw', x, y: y + bh },
    { handle: 'n', x: x + bw / 2, y },
    { handle: 's', x: x + bw / 2, y: y + bh },
    { handle: 'w', x, y: y + bh / 2 },
    { handle: 'e', x: x + bw, y: y + bh / 2 },
  ];

  for (const h of handles) {
    if (Math.hypot(docPt.x - h.x, docPt.y - h.y) <= hitRadius) {
      return h.handle;
    }
  }
  return null;
}

function isPointInBounds(b: { x: number; y: number; width: number; height: number }, pt: { x: number; y: number }): boolean {
  return pt.x >= b.x && pt.x <= b.x + b.width && pt.y >= b.y && pt.y <= b.y + b.height;
}


function isPointInPolygon(pt: { x: number; y: number }, poly: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
      (pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function isPointInObject(obj: CanvasObject, pt: { x: number; y: number }): boolean {
  if (obj.type === 'stroke') {
    const stroke = obj as StrokeObject;
    const threshold = Math.max(12, (stroke.size || 2) * 2);
    if (
      pt.x < obj.x - threshold ||
      pt.x > obj.x + (obj.width || 0) + threshold ||
      pt.y < obj.y - threshold ||
      pt.y > obj.y + (obj.height || 0) + threshold
    ) {
      return false;
    }
    for (let i = 0; i < stroke.points.length; i++) {
      if (Math.hypot(stroke.points[i].x - pt.x, stroke.points[i].y - pt.y) <= threshold) {
        return true;
      }
      if (i > 0 && distToSegment(pt, stroke.points[i - 1], stroke.points[i]) <= threshold) {
        return true;
      }
    }
    return false;
  }

  if (obj.type === 'shape') {
    const shape = obj as ShapeObject;
    if (shape.shapeType === 'line' || shape.shapeType === 'arrow' || shape.shapeType === 'connector') {
      const sPt = shape.startPoint || { x: shape.x, y: shape.y };
      const ePt = shape.endPoint || { x: shape.x + shape.width, y: shape.y + shape.height };
      return distToSegment(pt, sPt, ePt) <= Math.max(12, shape.strokeWidth || 2);
    }
    const minX = Math.min(shape.x, shape.x + shape.width);
    const maxX = Math.max(shape.x, shape.x + shape.width);
    const minY = Math.min(shape.y, shape.y + shape.height);
    const maxY = Math.max(shape.y, shape.y + shape.height);
    return pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY;
  }

  if (obj.type === 'frame') {
    const frame = obj as FrameObject;
    const headerH = 26;
    return (
      pt.x >= frame.x - 8 &&
      pt.x <= frame.x + frame.width + 8 &&
      pt.y >= frame.y - headerH &&
      pt.y <= frame.y + frame.height + 8
    );
  }

  if (obj.type === 'embed') {
    const embed = obj as EmbedObject;
    return (
      pt.x >= embed.x &&
      pt.x <= embed.x + embed.width &&
      pt.y >= embed.y &&
      pt.y <= embed.y + embed.height
    );
  }

  if (obj.type === 'table') {
    const table = obj as AccountingTableObject;
    const totalColsW = (table.columns?.reduce((sum, c) => sum + c.width, 0) || table.width || 600) + 36;
    const totalH = table.height || ((table.headerHeight || 36) + (table.rows?.length || 3) * (table.rowHeight || 32));
    const tbScale = Math.max(1, (table.fontSize || 12) / 12);
    const topMargin = Math.round(60 * tbScale); // accommodates the upper floating toolbar at any scale
    return pt.x >= table.x && pt.x <= table.x + totalColsW && pt.y >= table.y - topMargin && pt.y <= table.y + totalH;
  }

  const w = obj.width || 60;
  const h = obj.height || 30;
  return pt.x >= obj.x && pt.x <= obj.x + w && pt.y >= obj.y && pt.y <= obj.y + h;
}

function getEnclosingBounds(objs: CanvasObject[]): { x: number; y: number; width: number; height: number } | null {
  if (objs.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const obj of objs) {
    let w = obj.width || 0;
    let h = obj.height || 0;
    if (obj.type === 'table') {
      const table = obj as AccountingTableObject;
      const colWidthsTotal = table.columns?.reduce((sum, c) => sum + c.width, 0);
      w = (colWidthsTotal || table.width || 600) + 36;
      const hdrH = table.headerHeight || 36;
      const baseRowH = table.rowHeight || 32;
      const rowsTotal = table.rows?.reduce((sum, r) => sum + (r.height || baseRowH), 0) || (3 * baseRowH);
      h = table.height || (hdrH + rowsTotal);
    }
    const objMinX = Math.min(obj.x, obj.x + w);
    const objMaxX = Math.max(obj.x, obj.x + w);
    const objMinY = Math.min(obj.y, obj.y + h);
    const objMaxY = Math.max(obj.y, obj.y + h);
    minX = Math.min(minX, objMinX);
    minY = Math.min(minY, objMinY);
    maxX = Math.max(maxX, objMaxX);
    maxY = Math.max(maxY, objMaxY);
  }
  return {
    x: minX,
    y: minY,
    width: Math.max(10, maxX - minX),
    height: Math.max(10, maxY - minY),
  };
}

interface InfiniteCanvasProps {
  document: NotebookDocument;
  onUpdateDocument: (doc: NotebookDocument, saveHistory?: boolean) => void;
  activeTool: ToolType;
  onSelectTool?: (tool: ToolType) => void;
  isToolLocked?: boolean;
  selectedIds?: string[];
  onSelectIds?: (ids: string[]) => void;
  activePen: PenConfig;
  shapeConfig?: ShapeConfig;
  textConfig?: TextConfig;
  stickyConfig?: StickyConfig;
  eraserMode: 'stroke' | 'partial' | 'highlighter_only';
  eraserSize?: number;
  activeShape: ShapeType;
  clickToInkSettings: ClickToInkSettings;
  inputSettings: InputSettings;
  theme: 'light' | 'dark' | 'paper';
  canvasBg?: string;
  onClickToInkStateChange: (state: ClickToInkState) => void;
  onStatsUpdate: (stats: PerformanceStats | ((prev: PerformanceStats) => PerformanceStats)) => void;
  selectedTableId?: string | null;
  onSelectTable?: (id: string | null) => void;
  onDropFormat?: (formatType: AccountingFormatType, x: number, y: number) => void;
  onDeleteRowWithUndo?: (deletedRow: TableRow, index: number) => void;
  initialFocusedCell?: { rowId: string; colId: string } | null;
  onCursorDocMove?: (pt: { x: number; y: number }) => void;
  onViewportCenterChange?: (pt: { x: number; y: number }) => void;
  isDrawToShape?: boolean;
  onChangeCanvasBg?: (bg: string) => void;
}

const getInitialCameraState = (): CameraState => {
  try {
    const saved = localStorage.getItem('infinity_last_camera');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (
        typeof parsed.x === 'number' &&
        typeof parsed.y === 'number' &&
        typeof parsed.zoom === 'number' &&
        !isNaN(parsed.x) &&
        !isNaN(parsed.y) &&
        !isNaN(parsed.zoom) &&
        parsed.zoom > 0.05 &&
        parsed.zoom < 10
      ) {
        return parsed;
      }
    }
  } catch {}
  return { x: 80, y: 60, zoom: 1.0 };
};

export const InfiniteCanvas: React.FC<InfiniteCanvasProps> = ({
  document: doc,
  onUpdateDocument,
  activeTool,
  onSelectTool,
  isToolLocked,
  selectedIds,
  onSelectIds,
  activePen,
  shapeConfig,
  textConfig,
  stickyConfig,
  eraserMode,
  eraserSize = 24,
  activeShape,
  clickToInkSettings,
  inputSettings,
  theme,
  canvasBg,
  onClickToInkStateChange,
  onStatsUpdate,
  selectedTableId,
  onSelectTable,
  onDropFormat,
  onDeleteRowWithUndo,
  initialFocusedCell,
  onCursorDocMove,
  onViewportCenterChange,
  isDrawToShape,
  onChangeCanvasBg,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const docCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Drag-and-drop ghost preview
  const [dragGhost, setDragGhost] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    title: string;
  } | null>(null);

  // Engines - start with 100% zoom
  const cameraEngineRef = useRef<CameraEngine>(new CameraEngine(getInitialCameraState()));
  const [cameraState, setCameraState] = useState<CameraState>(() => cameraEngineRef.current.getState());
  const rendererRef = useRef<CanvasRenderer>(new CanvasRenderer());
  const clickToInkFSMRef = useRef<ClickToInkFSM | null>(null);
  const pointFilterRef = useRef<PointFilter2D>(new PointFilter2D(inputSettings.smoothing));

  // Inking State
  const isDrawingRef = useRef(false);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const livePointsRef = useRef<StrokePoint[]>([]);
  const liveStrokeConfigRef = useRef<StrokeObject | null>(null);
  const currentPointerTypeRef = useRef<string>('mouse');

  // Laser Pointer Trail
  const laserTrailRef = useRef<LaserTrailPoint[]>([]);
  const isSpacePressedRef = useRef(false);

  // Selection
  const [selection, setSelection] = useState<SelectionState>({
    selectedIds: [],
    bounds: null,
    mode: 'idle',
  });
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);

  // Shape, Text & Sticky Creation State (Live dragging)
  const shapeStartPtRef = useRef<{ x: number; y: number } | null>(null);
  const frameStartPtRef = useRef<{ x: number; y: number } | null>(null);
  const lassoPointsRef = useRef<{ x: number; y: number }[]>([]);
  const textStartPtRef = useRef<{ x: number; y: number } | null>(null);
  const stickyStartPtRef = useRef<{ x: number; y: number } | null>(null);
  const liveShapeRef = useRef<{
    shape: ShapeObject;
    startPt: { x: number; y: number };
    currentPt: { x: number; y: number };
  } | null>(null);

  // Draw and Hold (Hold-to-Autocorrect Shape like Apple Pencil / Procreate)
  const holdToShapeTimerRef = useRef<number | null>(null);
  const holdStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const snappedShapeRef = useRef<ShapeObject | null>(null);
  const isHoldingShapeRef = useRef(false);
  const holdAnchorRef = useRef<{ px: number; py: number; w: number; h: number } | null>(null);
  const snapFlashRef = useRef<{ startTime: number; shape: ShapeObject } | null>(null);
  const pendingCommittedStrokeRef = useRef<CanvasObject | null>(null);
  const lastBakedStrokeIdRef = useRef<string | null>(null);

  // Object Dragging State
  const isDraggingObjectsRef = useRef(false);
  const dragStartDocPtRef = useRef<{ x: number; y: number } | null>(null);
  const dragInitialPositionsRef = useRef<Map<string, { x: number; y: number; startPt?: { x: number; y: number }; endPt?: { x: number; y: number } }>>(new Map());
  const activeDragObjectsRef = useRef<CanvasObject[] | null>(null);

  // Object Resizing / Transform State (Excalidraw 8 handles)
  const isResizingRef = useRef(false);
  const activeResizeHandleRef = useRef<TransformHandle | null>(null);
  const resizeStartDocPtRef = useRef<{ x: number; y: number } | null>(null);
  const resizeInitialBoundsRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const resizeInitialObjectsRef = useRef<Map<string, CanvasObject>>(new Map());

  // Sync selectedIds prop from App & coordinate bounding box with moved/resized objects
  useEffect(() => {
    if (selectedIds !== undefined) {
      setSelection((prev) => {
        if (selectedIds.length === 0) {
          if (prev.selectedIds.length === 0 && !prev.bounds) return prev;
          return { selectedIds: [], bounds: null, mode: 'idle' };
        }

        const selected = doc.objects.filter((o) => selectedIds.includes(o.id));
        const newBounds = getEnclosingBounds(selected);

        // Only keep previous reference if both IDs AND coordinates/dimensions are identical
        if (
          prev.bounds &&
          newBounds &&
          prev.bounds.x === newBounds.x &&
          prev.bounds.y === newBounds.y &&
          prev.bounds.width === newBounds.width &&
          prev.bounds.height === newBounds.height &&
          prev.selectedIds.length === selectedIds.length &&
          prev.selectedIds.every((id, idx) => id === selectedIds[idx])
        ) {
          return prev;
        }

        return {
          selectedIds,
          bounds: newBounds,
          mode: prev.mode || 'idle',
        };
      });
    }
  }, [selectedIds, doc.objects]);

  // Active Screen Cursor (Stored in ref to eliminate React re-renders on mouse move!)
  const cursorPosRef = useRef<{ x: number; y: number } | null>(null);
  const activeEraserObjectsRef = useRef<CanvasObject[] | null>(null);
  const lastEraserDocPtRef = useRef<{ x: number; y: number } | null>(null);
  const docRedrawRafRef = useRef<number | null>(null);
  const [clickToInkState, setClickToInkState] = useState<ClickToInkState>(
    clickToInkSettings.enabled ? 'armed' : 'idle'
  );

  // Inline Text Editor
  const [editingTextObj, setEditingTextObj] = useState<{
    id: string;
    text: string;
    x: number;
    y: number;
    fontSize: number;
    fontFamily: string;
    color: string;
    align?: 'left' | 'center' | 'right';
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    opacity?: number;
    isNew?: boolean;
  } | null>(null);
  const textCreationTimeRef = useRef<number>(0);

  // Inline Sticky Note Editor (Matching Excalidraw Image 5)
  const [editingStickyObj, setEditingStickyObj] = useState<{
    id: string;
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    textColor?: string;
    fontSize: number;
    fontFamily: string;
    textAlign?: 'left' | 'center' | 'right';
    verticalAlign?: 'top' | 'middle' | 'bottom';
    dateLabel?: string;
    isNew?: boolean;
  } | null>(null);

  // Track if eraser made modifications during current drag
  const eraserModifiedRef = useRef(false);

  // Diagnostics and FPS counter
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(performance.now());
  const lastFrameDurationRef = useRef(16.6);

  // Initialize and update Click-to-Ink FSM
  useEffect(() => {
    clickToInkFSMRef.current = new ClickToInkFSM(clickToInkSettings, {
      onStartStroke: (x, y, pressure) => handleStartInking(x, y, pressure),
      onMoveStroke: (x, y, pressure) => handleMoveInking(x, y, pressure),
      onEndStroke: (commit) => handleEndInking(commit),
      onStateChange: (state) => {
        setClickToInkState(state);
        onClickToInkStateChange(state);
      },
      onEdgePan: (dx, dy) => {
        cameraEngineRef.current.panBy(dx, dy);
        renderScene();
      },
    });
  }, [clickToInkSettings, activePen, activeTool]);

  // Sync smoothing settings
  useEffect(() => {
    pointFilterRef.current = new PointFilter2D(inputSettings.smoothing);
  }, [inputSettings.smoothing]);

  // Fast direct redraw of overlay layer only (0 React re-renders, desynchronized low-latency)
  const renderOverlayOnly = useCallback(() => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas) return;
    const overlayCtx = overlayCanvas.getContext('2d');
    if (!overlayCtx) return;
    const camera = cameraEngineRef.current.getState();

    let snapFlashData: { shape: ShapeObject; progress: number } | null = null;
    if (snapFlashRef.current) {
      const elapsed = performance.now() - snapFlashRef.current.startTime;
      if (elapsed < 200) {
        snapFlashData = {
          shape: snapFlashRef.current.shape,
          progress: elapsed / 200,
        };
      } else {
        snapFlashRef.current = null;
      }
    }

    rendererRef.current.renderOverlay(
      overlayCtx,
      overlayCanvas.width,
      overlayCanvas.height,
      camera,
      livePointsRef.current,
      liveStrokeConfigRef.current,
      laserTrailRef.current,
      selection,
      clickToInkState,
      cursorPosRef.current,
      activeTool,
      (eraserSize || 24) / camera.zoom,
      liveShapeRef.current,
      snapFlashData
    );
  }, [selection, clickToInkState, activeTool, eraserSize]);

  // Trigger camera-shutter click snap flash animation (180ms ease-out)
  const triggerSnapFlash = useCallback((shape: ShapeObject) => {
    snapFlashRef.current = { startTime: performance.now(), shape };
    const anim = () => {
      if (!snapFlashRef.current) return;
      const elapsed = performance.now() - snapFlashRef.current.startTime;
      if (elapsed < 200) {
        renderOverlayOnly();
        requestAnimationFrame(anim);
      } else {
        snapFlashRef.current = null;
        renderOverlayOnly();
      }
    };
    renderOverlayOnly();
    requestAnimationFrame(anim);
  }, [renderOverlayOnly]);

  // Render Document & Overlay Scene
  const renderScene = useCallback(() => {
    const docCanvas = docCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!docCanvas || !overlayCanvas) return;

    const docCtx = docCanvas.getContext('2d');
    const overlayCtx = overlayCanvas.getContext('2d');
    if (!docCtx || !overlayCtx) return;

    const t0 = performance.now();
    const camera = cameraEngineRef.current.getState();

    // Render persistent document layer (using active in-memory objects during eraser drag for 120 FPS!)
    const pending = pendingCommittedStrokeRef.current;
    if (pending && doc.objects.some((o) => o.id === pending.id)) {
      pendingCommittedStrokeRef.current = null;
    }
    const baseObjects = activeDragObjectsRef.current || activeEraserObjectsRef.current || doc.objects;
    // Exclude the actively edited text/sticky from canvas to prevent double-text collision/ghosting
    const objectsWithoutEditing = editingTextObj
      ? baseObjects.filter((o) => o.id !== editingTextObj.id)
      : (editingStickyObj ? baseObjects.filter((o) => o.id !== editingStickyObj.id) : baseObjects);
    const objectsToRender =
      pending && !objectsWithoutEditing.some((o) => o.id === pending.id)
        ? [...objectsWithoutEditing, pending]
        : objectsWithoutEditing;
    // Exclude accounting tables from canvas layer to prevent duplicate ghost tables behind interactive overlay
    const canvasObjectsToRender = objectsToRender.filter((o) => o.type !== 'table');

    const renderedCount = rendererRef.current.renderDocument(
      docCtx,
      docCanvas.width,
      docCanvas.height,
      camera,
      doc.pages,
      canvasObjectsToRender,
      doc.currentMode,
      theme,
      canvasBg
    );

    // Suppress selection bounding box over text when actively editing it
    const effectiveSelection =
      editingTextObj && selection.selectedIds.includes(editingTextObj.id)
        ? { ...selection, bounds: null }
        : selection;

    // Render transient overlay layer (live ink, laser, handles, eraser indicator, live shape)
    rendererRef.current.renderOverlay(
      overlayCtx,
      overlayCanvas.width,
      overlayCanvas.height,
      camera,
      livePointsRef.current,
      liveStrokeConfigRef.current,
      laserTrailRef.current,
      effectiveSelection,
      clickToInkState,
      cursorPosRef.current,
      activeTool,
      (eraserSize || 24) / camera.zoom,
      liveShapeRef.current
    );

    const frameTime = performance.now() - t0;
    lastFrameDurationRef.current = frameTime;
    frameCountRef.current++;

    // Compute FPS every second
    const now = performance.now();
    if (now - lastFpsTimeRef.current >= 1000) {
      const fps = Math.round((frameCountRef.current * 1000) / (now - lastFpsTimeRef.current));
      frameCountRef.current = 0;
      lastFpsTimeRef.current = now;

      onStatsUpdate({
        fps: Math.min(60, fps),
        frameTimeMs: lastFrameDurationRef.current,
        renderedObjects: renderedCount,
        totalObjects: doc.objects.length,
        zoomPercent: Math.round(camera.zoom * 100),
        mode: doc.currentMode,
      });
    }
  }, [doc, theme, canvasBg, selection, clickToInkState, activeTool, onStatsUpdate, eraserSize, editingTextObj, editingStickyObj]);

  // Ultra-fast document redraw throttled by requestAnimationFrame (120 FPS max 1 redraw per frame)
  const scheduleDocRedraw = useCallback(() => {
    if (docRedrawRafRef.current !== null) return;
    docRedrawRafRef.current = requestAnimationFrame(() => {
      docRedrawRafRef.current = null;
      const docCanvas = docCanvasRef.current;
      if (!docCanvas) return;
      const docCtx = docCanvas.getContext('2d');
      if (!docCtx) return;
      const camera = cameraEngineRef.current.getState();
      const pending = pendingCommittedStrokeRef.current;
      if (pending && doc.objects.some((o) => o.id === pending.id)) {
        pendingCommittedStrokeRef.current = null;
      }
      const baseObjects = activeDragObjectsRef.current || activeEraserObjectsRef.current || doc.objects;
      const objectsWithoutEditing = editingTextObj
        ? baseObjects.filter((o) => o.id !== editingTextObj.id)
        : (editingStickyObj ? baseObjects.filter((o) => o.id !== editingStickyObj.id) : baseObjects);
      const objectsToRender =
        pending && !objectsWithoutEditing.some((o) => o.id === pending.id)
          ? [...objectsWithoutEditing, pending]
          : objectsWithoutEditing;
      const canvasObjectsToRender = objectsToRender.filter((o) => o.type !== 'table');
      rendererRef.current.renderDocument(
        docCtx,
        docCanvas.width,
        docCanvas.height,
        camera,
        doc.pages,
        canvasObjectsToRender,
        doc.currentMode,
        theme,
        canvasBg
      );
    });
  }, [doc.pages, doc.objects, doc.currentMode, theme, canvasBg, editingTextObj, editingStickyObj]);

  // Window & Container Resize Listener (Live observer updates canvas dimensions simultaneously)
  useEffect(() => {
    const container = containerRef.current;
    const docCanvas = docCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    if (!container || !docCanvas || !overlayCanvas) return;

    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return;

      let changed = false;
      if (docCanvas.width !== w || docCanvas.height !== h) {
        docCanvas.width = w;
        docCanvas.height = h;
        changed = true;
      }
      if (overlayCanvas.width !== w || overlayCanvas.height !== h) {
        overlayCanvas.width = w;
        overlayCanvas.height = h;
        changed = true;
      }

      if (changed) {
        renderScene();
      }
    };

    handleResize();

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);

    window.addEventListener('resize', handleResize);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [renderScene]);

  // Continuous Laser Pointer Decay Animation
  useEffect(() => {
    let animId: number;
    const tick = () => {
      if (laserTrailRef.current.length > 0) {
        const now = performance.now();
        laserTrailRef.current = laserTrailRef.current.filter((pt) => now - pt.time < 850);
        renderScene();
      }
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [renderScene]);

  // Redraw when Document or Theme changes
  useEffect(() => {
    // If this doc update is just the stroke that was already baked directly onto docCanvas,
    // skip the full clearRect and full scene redraw to prevent any redundant canvas wiping!
    if (lastBakedStrokeIdRef.current) {
      const isJustBakedStroke =
        doc.objects.length > 0 &&
        doc.objects[doc.objects.length - 1].id === lastBakedStrokeIdRef.current;
      if (isJustBakedStroke) {
        lastBakedStrokeIdRef.current = null;
        if (pendingCommittedStrokeRef.current?.id === doc.objects[doc.objects.length - 1].id) {
          pendingCommittedStrokeRef.current = null;
        }
        return;
      }
      lastBakedStrokeIdRef.current = null;
    }
    renderScene();
  }, [doc, theme, renderScene]);

  // Clean up any old static 'Type here...' placeholder objects from previous sessions
  useEffect(() => {
    const hasDummyText = doc.objects.some(
      (o) => o.type === 'text' && (o as TextObject).text === 'Type here...'
    );
    if (hasDummyText) {
      const cleaned = doc.objects.filter(
        (o) => !(o.type === 'text' && (o as TextObject).text === 'Type here...')
      );
      onUpdateDocument({ ...doc, objects: cleaned }, false);
    }
  }, []);

  // Camera change listener & session persistence
  const saveCameraTimerRef = useRef<number | null>(null);
  useEffect(() => {
    cameraEngineRef.current.setOnChange(() => {
      const state = cameraEngineRef.current.getState();
      setCameraState({ ...state });
      onStatsUpdate?.((prev: PerformanceStats) => ({
        ...prev,
        zoomPercent: Math.round(state.zoom * 100),
      }));
      const container = containerRef.current;
      if (container) {
        const cx = Math.round((container.clientWidth / 2 - state.x) / state.zoom);
        const cy = Math.round((container.clientHeight / 2 - state.y) / state.zoom);
        onViewportCenterChange?.({ x: cx, y: cy });
      }
      if (saveCameraTimerRef.current !== null) {
        window.clearTimeout(saveCameraTimerRef.current);
      }
      saveCameraTimerRef.current = window.setTimeout(() => {
        try {
          localStorage.setItem('infinity_last_camera', JSON.stringify(state));
        } catch {}
      }, 300);
      renderScene();
    });

    // Synchronize initial zoom stat with parent on mount immediately
    const initialCam = cameraEngineRef.current.getState();
    onStatsUpdate?.((prev: PerformanceStats) => ({
      ...prev,
      zoomPercent: Math.round(initialCam.zoom * 100),
    }));

    const handleSaveCamera = () => {
      try {
        const state = cameraEngineRef.current.getState();
        localStorage.setItem('infinity_last_camera', JSON.stringify(state));
      } catch {}
    };

    window.addEventListener('beforeunload', handleSaveCamera);
    window.addEventListener('pagehide', handleSaveCamera);
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        handleSaveCamera();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('beforeunload', handleSaveCamera);
      window.removeEventListener('pagehide', handleSaveCamera);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (saveCameraTimerRef.current !== null) {
        window.clearTimeout(saveCameraTimerRef.current);
      }
    };
  }, [renderScene, onViewportCenterChange, onStatsUpdate]);

  const handleUpdateTable = (updatedTable: AccountingTableObject) => {
    const updatedObjects = doc.objects.map((obj) =>
      obj.id === updatedTable.id ? updatedTable : obj
    );
    setSelection((prev) => {
      if (prev.selectedIds.includes(updatedTable.id)) {
        const selected = updatedObjects.filter((o) => prev.selectedIds.includes(o.id));
        return {
          ...prev,
          bounds: getEnclosingBounds(selected),
        };
      }
      return prev;
    });
    onUpdateDocument({ ...doc, objects: updatedObjects }, false);
  };

  const handleDeleteTable = (tableId: string) => {
    const updatedObjects = doc.objects.filter((obj) => obj.id !== tableId);
    onUpdateDocument({ ...doc, objects: updatedObjects }, true);
    if (selectedTableId === tableId) {
      onSelectTable?.(null);
    }
  };

  /**
   * INKING HANDLERS
   */
  const handleStartInking = (docX: number, docY: number, pressure: number) => {
    isDrawingRef.current = true;
    pointFilterRef.current.reset();

    // Reset Draw-and-Hold shape timer and state
    if (holdToShapeTimerRef.current !== null) {
      window.clearTimeout(holdToShapeTimerRef.current);
      holdToShapeTimerRef.current = null;
    }
    holdStartPosRef.current = { x: docX, y: docY };
    snappedShapeRef.current = null;
    isHoldingShapeRef.current = false;
    holdAnchorRef.current = null;
    liveShapeRef.current = null;

    const isHardwarePen = currentPointerTypeRef.current === 'pen' || (pressure > 0 && pressure !== 0.5);
    const initialPressure = isHardwarePen && pressure > 0 ? pressure : 0.55;

    const initialPoint: StrokePoint = {
      x: docX,
      y: docY,
      pressure: initialPressure,
      time: performance.now(),
    };

    livePointsRef.current = [initialPoint];

    // Determine target page frame
    const activePage = doc.pages.find((p) => p.id === doc.activePageId) || doc.pages[0];

    liveStrokeConfigRef.current = {
      id: 'stroke-' + Math.random().toString(36).substring(2, 9),
      pageId: activePage ? activePage.id : null,
      type: 'stroke',
      layerId: 'layer-ink',
      x: docX,
      y: docY,
      width: activePen.size,
      height: activePen.size,
      penType: activePen.type,
      color: activePen.color,
      size: activePen.size,
      opacity: activePen.opacity,
      points: [initialPoint],
      isHighlighter: activePen.type === 'highlighter',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deviceId: 'local',
    };

    renderOverlayOnly();
  };

  const handleMoveInking = (docX: number, docY: number, rawPressure: number, shouldRender = true) => {
    if (!isDrawingRef.current && clickToInkState !== 'inking') return;

    // 1. If already snapped to a shape via Draw-and-Hold: dragging adjusts/scales the shape live
    if (isHoldingShapeRef.current && snappedShapeRef.current) {
      const shape = snappedShapeRef.current;
      if (shape.shapeType === 'line' || shape.shapeType === 'arrow' || shape.shapeType === 'connector') {
        shape.endPoint = { x: docX, y: docY };
        const sx = shape.startPoint?.x ?? shape.x;
        const sy = shape.startPoint?.y ?? shape.y;
        shape.x = Math.min(sx, docX);
        shape.y = Math.min(sy, docY);
        shape.width = Math.max(1, Math.abs(docX - sx));
        shape.height = Math.max(1, Math.abs(docY - sy));
      } else {
        const a = holdAnchorRef.current;
        if (a) {
          const dx = docX - a.px;
          const dy = docY - a.py;
          // dead zone: ignore hand tremor
          if (Math.hypot(dx, dy) > 6) {
            const keepRatio =
              (shape.shapeType === 'ellipse' && a.w === a.h) ||
              (shape.shapeType === 'rectangle' && a.w === a.h);
            if (keepRatio) {
              const d = Math.max(10, a.w + Math.max(dx, dy));
              shape.width = d;
              shape.height = d;
            } else {
              shape.width = Math.max(10, a.w + dx);
              shape.height = Math.max(10, a.h + dy);
            }
          }
        }
      }
      liveShapeRef.current = {
        shape: { ...shape },
        startPt: shape.startPoint || { x: shape.x, y: shape.y },
        currentPt: { x: docX, y: docY },
      };
      if (shouldRender) {
        renderOverlayOnly();
      }
      return;
    }

    const prevPoint = livePointsRef.current[livePointsRef.current.length - 1];
    // Filter micro-jitter / duplicate events if stylus hasn't moved significantly (> 0.6px doc units)
    if (prevPoint && Math.hypot(docX - prevPoint.x, docY - prevPoint.y) < 0.6) {
      return;
    }

    const now = performance.now();
    const smoothed = pointFilterRef.current.filter(docX, docY, now);

    const isHardwarePen = currentPointerTypeRef.current === 'pen' || (rawPressure > 0 && rawPressure !== 0.5);

    let calculatedPressure = 0.55;
    if (isHardwarePen) {
      // Hardware pen tablet (Wacom, Apple Pencil, Surface Pen): smooth digitizer jitter with EMA
      const effPressure = rawPressure > 0 ? rawPressure : 0.55;
      const prevPressure = prevPoint?.pressure ?? effPressure;
      calculatedPressure = 0.35 * effPressure + 0.65 * prevPressure;
    } else if (inputSettings.velocityPressure && prevPoint) {
      // Mouse & non-tablet pointers: derive pressure from drawing velocity with smooth EMA
      const rawSim = calculateSimulatedPressure(
        prevPoint,
        { x: smoothed.x, y: smoothed.y, time: now },
        inputSettings.velocitySensitivity
      );
      const prevPressure = prevPoint.pressure ?? 0.55;
      calculatedPressure = 0.3 * rawSim + 0.7 * prevPressure;
    } else {
      calculatedPressure = 0.55;
    }

    const newPt: StrokePoint = {
      x: smoothed.x,
      y: smoothed.y,
      pressure: calculatedPressure,
      time: now,
    };

    livePointsRef.current.push(newPt);

    // 2. Draw-and-Hold auto-recognition detection (Only active when isDrawToShape is enabled!)
    if (isDrawToShape) {
      const holdAnchor = holdStartPosRef.current;
      const distMoved = holdAnchor ? Math.hypot(smoothed.x - holdAnchor.x, smoothed.y - holdAnchor.y) : 0;

      if (distMoved > 9) {
        holdStartPosRef.current = { x: smoothed.x, y: smoothed.y };
        if (holdToShapeTimerRef.current !== null) {
          window.clearTimeout(holdToShapeTimerRef.current);
          holdToShapeTimerRef.current = null;
        }
      }

      // Schedule autocorrect detection only when holding completely still (550ms hold delay)
      if (holdToShapeTimerRef.current === null && livePointsRef.current.length >= 6) {
        holdToShapeTimerRef.current = window.setTimeout(() => {
          holdToShapeTimerRef.current = null;
          if (!isDrawingRef.current && clickToInkState !== 'inking') return;
          if (livePointsRef.current.length < 6) return;

          const ptsSnapshot = [...livePointsRef.current];
          const shapeRec = recognizeShapeFromStroke(ptsSnapshot);

          let detectedType: ShapeType | null = null;
          let detectedBounds: {
            x: number;
            y: number;
            width: number;
            height: number;
            startPoint?: { x: number; y: number };
            endPoint?: { x: number; y: number };
          } | null = null;

          if (shapeRec) {
            detectedType = shapeRec.shapeType;
            detectedBounds = {
              x: shapeRec.x,
              y: shapeRec.y,
              width: shapeRec.width,
              height: shapeRec.height,
              startPoint: shapeRec.startPoint,
              endPoint: shapeRec.endPoint,
            };
          }

          if (detectedType && detectedBounds && liveStrokeConfigRef.current) {
            const shapeObj: ShapeObject = {
              id: 'shape-' + Math.random().toString(36).substring(2, 9),
              pageId: liveStrokeConfigRef.current.pageId,
              type: 'shape',
              layerId: 'layer-shapes',
              x: detectedBounds.x,
              y: detectedBounds.y,
              width: Math.max(10, detectedBounds.width),
              height: Math.max(10, detectedBounds.height),
              shapeType: detectedType,
              strokeColor: activePen.color,
              fillColor: shapeConfig?.fillColor || 'transparent',
              strokeWidth: activePen.size,
              strokeStyle: 'solid',
              fillStyle: shapeConfig?.fillStyle || 'solid',
              roughness: shapeConfig?.roughness ?? 0,
              startPoint: detectedBounds.startPoint,
              endPoint: detectedBounds.endPoint,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              deviceId: 'local',
            };

            snappedShapeRef.current = shapeObj;
            isHoldingShapeRef.current = true;
            holdAnchorRef.current = { px: smoothed.x, py: smoothed.y, w: shapeObj.width, h: shapeObj.height };
            liveShapeRef.current = {
              shape: shapeObj,
              startPt: shapeObj.startPoint || { x: shapeObj.x, y: shapeObj.y },
              currentPt: { x: smoothed.x, y: smoothed.y },
            };
            livePointsRef.current = [];
            triggerSnapFlash(shapeObj);
          }
        }, 550);
      }
    }

    if (shouldRender) {
      renderOverlayOnly();
    }
  };

  const handleEndInking = (commit: boolean) => {
    if (!isDrawingRef.current && clickToInkState !== 'inking') return;
    isDrawingRef.current = false;

    // Clear any pending hold timer
    if (holdToShapeTimerRef.current !== null) {
      window.clearTimeout(holdToShapeTimerRef.current);
      holdToShapeTimerRef.current = null;
    }

    // 1. If snapped into a shape via Draw-and-Hold: commit the crisp geometric shape!
    if (commit && isHoldingShapeRef.current && snappedShapeRef.current) {
      const shapeObj = snappedShapeRef.current;
      pendingCommittedStrokeRef.current = shapeObj;
      lastBakedStrokeIdRef.current = shapeObj.id;

      snappedShapeRef.current = null;
      isHoldingShapeRef.current = false;
      holdAnchorRef.current = null;
      liveShapeRef.current = null;
      livePointsRef.current = [];
      liveStrokeConfigRef.current = null;
      renderScene();

      onUpdateDocument({ ...doc, objects: [...doc.objects, shapeObj] }, true);
      onSelectIds?.([shapeObj.id]);
      setSelection({
        selectedIds: [shapeObj.id],
        bounds: { x: shapeObj.x, y: shapeObj.y, width: shapeObj.width, height: Math.max(10, shapeObj.height) },
        mode: 'idle',
      });
      return;
    }

    // Reset hold state for normal ink commit
    isHoldingShapeRef.current = false;
    holdAnchorRef.current = null;
    snappedShapeRef.current = null;
    liveShapeRef.current = null;

    // 2. Normal ink stroke commit: NEVER convert to shapes on normal release!
    // Fast writing, loops, letters like 'o' or '0' remain 100% natural ink.
    if (commit && livePointsRef.current.length > 0 && liveStrokeConfigRef.current) {
      const strokePts = [...livePointsRef.current];

      // Compute bounding box
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const pt of strokePts) {
        minX = Math.min(minX, pt.x);
        minY = Math.min(minY, pt.y);
        maxX = Math.max(maxX, pt.x);
        maxY = Math.max(maxY, pt.y);
      }

      const simplified = simplifyPoints(strokePts, 0.8);

      const newStroke: StrokeObject = {
        ...liveStrokeConfigRef.current,
        x: minX,
        y: minY,
        width: Math.max(activePen.size, maxX - minX),
        height: Math.max(activePen.size, maxY - minY),
        points: strokePts,
        simplifiedPoints: simplified,
      };

      // Auto-append page check in notebook mode if writing near bottom
      let updatedPages = [...doc.pages];
      if (doc.currentMode === 'notebook' && doc.autoAppendPages) {
        const lastPage = doc.pages[doc.pages.length - 1];
        if (maxY > lastPage.y + lastPage.height - 180) {
          const dim = PAGE_SIZE_DIMENSIONS.A4;
          const newPage: PageFrame = {
            id: 'page-' + (doc.pages.length + 1),
            title: `Page ${doc.pages.length + 1}`,
            pageNumber: doc.pages.length + 1,
            x: 0,
            y: lastPage.y + lastPage.height + 40,
            width: dim.width,
            height: dim.height,
            sizeFormat: 'A4',
            orientation: 'portrait',
            template: lastPage.template,
            templateSpacing: lastPage.templateSpacing,
            tags: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          updatedPages.push(newPage);
        }
      }

      pendingCommittedStrokeRef.current = newStroke;
      // Skip the redundant effect redraw only if no page was appended
      lastBakedStrokeIdRef.current =
        updatedPages.length === doc.pages.length ? newStroke.id : null;

      livePointsRef.current = [];
      liveStrokeConfigRef.current = null;
      renderScene(); // doc + overlay in the same task, same code path as every other redraw

      onUpdateDocument(
        {
          ...doc,
          pages: updatedPages,
          objects: [...doc.objects, newStroke],
        },
        true
      );
      return;
    }

    livePointsRef.current = [];
    liveStrokeConfigRef.current = null;
    renderOverlayOnly();
  };

  /**
   * Helper: Slices a freehand stroke with sub-pixel precision, splitting it into remaining segments
   */
  const sliceStroke = (
    stroke: StrokeObject,
    docX: number,
    docY: number,
    eraseRadius: number
  ): StrokeObject[] | null => {
    // Fast AABB bounding box test with padding
    const pad = eraseRadius + (stroke.size || 2);
    if (
      docX < stroke.x - pad ||
      docX > stroke.x + stroke.width + pad ||
      docY < stroke.y - pad ||
      docY > stroke.y + stroke.height + pad
    ) {
      return null;
    }

    const rawPts = stroke.points;
    if (!rawPts || rawPts.length === 0) return [];

    // Verify touch against points and segments
    let touches = false;
    for (let i = 0; i < rawPts.length; i++) {
      if (Math.hypot(rawPts[i].x - docX, rawPts[i].y - docY) <= eraseRadius) {
        touches = true;
        break;
      }
      if (i > 0 && distToSegment({ x: docX, y: docY }, rawPts[i - 1], rawPts[i]) <= eraseRadius) {
        touches = true;
        break;
      }
    }
    if (!touches) return null;

    // Subdivide segments with large gaps for razor-sharp precision cuts (only near erase circle)
    const densePts: StrokePoint[] = [];
    const maxStep = Math.max(4, eraseRadius * 0.4);
    for (let i = 0; i < rawPts.length; i++) {
      if (i === 0) {
        densePts.push(rawPts[0]);
      } else {
        const p0 = rawPts[i - 1];
        const p1 = rawPts[i];
        const d = Math.hypot(p1.x - p0.x, p1.y - p0.y);
        const d0 = Math.hypot(p0.x - docX, p0.y - docY);
        const d1 = Math.hypot(p1.x - docX, p1.y - docY);
        if (d > maxStep && (d0 <= eraseRadius * 2 || d1 <= eraseRadius * 2)) {
          const count = Math.min(10, Math.ceil(d / maxStep));
          for (let s = 1; s < count; s++) {
            const t = s / count;
            densePts.push({
              x: p0.x + (p1.x - p0.x) * t,
              y: p0.y + (p1.y - p0.y) * t,
              pressure:
                p0.pressure !== undefined && p1.pressure !== undefined
                  ? p0.pressure + (p1.pressure - p0.pressure) * t
                  : p0.pressure,
              time: p0.time + (p1.time - p0.time) * t,
            });
          }
        }
        densePts.push(p1);
      }
    }

    // Partition into contiguous segments outside eraseRadius
    const segments: StrokePoint[][] = [];
    let curSeg: StrokePoint[] = [];
    for (const pt of densePts) {
      if (Math.hypot(pt.x - docX, pt.y - docY) > eraseRadius) {
        curSeg.push(pt);
      } else {
        if (curSeg.length > 0) {
          segments.push(curSeg);
          curSeg = [];
        }
      }
    }
    if (curSeg.length > 0) segments.push(curSeg);

    // Turn segments into new StrokeObjects
    const result: StrokeObject[] = [];
    for (const seg of segments) {
      if (seg.length === 0) continue;
      if (seg.length < 2 && stroke.size < 4) continue;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of seg) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
      result.push({
        ...stroke,
        id: 'stroke-' + Math.random().toString(36).substring(2, 9),
        x: minX,
        y: minY,
        width: Math.max(stroke.size, maxX - minX),
        height: Math.max(stroke.size, maxY - minY),
        points: seg,
        simplifiedPoints: seg,
        updatedAt: Date.now(),
      });
    }
    return result;
  };

  /**
   * Helper: Slices geometric shapes along their outline perimeter without deleting the whole figure
   */
  const sliceShape = (
    shape: ShapeObject,
    docX: number,
    docY: number,
    eraseRadius: number
  ): CanvasObject[] | null => {
    const pad = eraseRadius + (shape.strokeWidth || 2);
    if (
      docX < shape.x - pad ||
      docX > shape.x + shape.width + pad ||
      docY < shape.y - pad ||
      docY > shape.y + shape.height + pad
    ) {
      return null;
    }

    // Extract outline polylines for the shape
    const polylines: { x: number; y: number }[][] = [];
    const { shapeType, x, y, width, height } = shape;

    if (shapeType === 'line' || shapeType === 'arrow' || shapeType === 'connector') {
      const sx = shape.startPoint?.x ?? x;
      const sy = shape.startPoint?.y ?? y;
      const ex = shape.endPoint?.x ?? x + width;
      const ey = shape.endPoint?.y ?? y + height;
      polylines.push([
        { x: sx, y: sy },
        { x: ex, y: ey },
      ]);
    } else if (shapeType === 'rectangle' || shapeType === 'rounded_rect') {
      polylines.push([
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height },
        { x, y },
      ]);
    } else if (shapeType === 'polygon') {
      // Diamond
      polylines.push([
        { x: x + width / 2, y },
        { x: x + width, y: y + height / 2 },
        { x: x + width / 2, y: y + height },
        { x, y: y + height / 2 },
        { x: x + width / 2, y },
      ]);
    } else if (shapeType === 'triangle') {
      polylines.push([
        { x: x + width / 2, y },
        { x: x + width, y: y + height },
        { x, y: y + height },
        { x, y: y + height },
        { x: x + width / 2, y },
      ]);
    } else if (shapeType === 'ellipse') {
      const pts: { x: number; y: number }[] = [];
      const cx = x + width / 2;
      const cy = y + height / 2;
      const rx = Math.abs(width / 2);
      const ry = Math.abs(height / 2);
      const steps = 48;
      for (let i = 0; i <= steps; i++) {
        const angle = (i / steps) * Math.PI * 2;
        pts.push({ x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry });
      }
      polylines.push(pts);
    } else {
      polylines.push([
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height },
        { x, y },
      ]);
    }

    // Check if eraser touches any polyline segment
    let touches = false;
    for (const poly of polylines) {
      for (let i = 1; i < poly.length; i++) {
        if (distToSegment({ x: docX, y: docY }, poly[i - 1], poly[i]) <= eraseRadius) {
          touches = true;
          break;
        }
      }
      if (touches) break;
    }
    if (!touches) return null;

    // Slicing: sample points along polyline and excise points inside eraseRadius
    const maxStep = Math.max(4, eraseRadius * 0.4);
    const resultStrokes: StrokeObject[] = [];

    for (const poly of polylines) {
      const densePts: StrokePoint[] = [];
      for (let i = 1; i < poly.length; i++) {
        const p0 = poly[i - 1];
        const p1 = poly[i];
        const d = Math.hypot(p1.x - p0.x, p1.y - p0.y);
        const count = Math.max(1, Math.ceil(d / maxStep));
        for (let s = 0; s < count; s++) {
          const t = s / count;
          densePts.push({
            x: p0.x + (p1.x - p0.x) * t,
            y: p0.y + (p1.y - p0.y) * t,
            time: Date.now(),
          });
        }
      }
      densePts.push({ x: poly[poly.length - 1].x, y: poly[poly.length - 1].y, time: Date.now() });

      const segments: StrokePoint[][] = [];
      let curSeg: StrokePoint[] = [];
      for (const pt of densePts) {
        if (Math.hypot(pt.x - docX, pt.y - docY) > eraseRadius) {
          curSeg.push(pt);
        } else {
          if (curSeg.length > 0) {
            segments.push(curSeg);
            curSeg = [];
          }
        }
      }
      if (curSeg.length > 0) segments.push(curSeg);

      for (const seg of segments) {
        if (seg.length < 2) continue;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of seg) {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        }
        resultStrokes.push({
          id: 'stroke-' + Math.random().toString(36).substring(2, 9),
          pageId: shape.pageId,
          type: 'stroke',
          layerId: shape.layerId,
          x: minX,
          y: minY,
          width: Math.max(shape.strokeWidth, maxX - minX),
          height: Math.max(shape.strokeWidth, maxY - minY),
          penType: 'ballpoint',
          color: shape.strokeColor,
          size: shape.strokeWidth,
          opacity: shape.opacity ?? 1,
          points: seg,
          simplifiedPoints: seg,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          deviceId: 'local',
        });
      }
    }
    return resultStrokes;
  };

  /**
   * ERASER HANDLER (Lag-Free 120 FPS In-Memory Operations)
   * Supports both:
   * 1. 'partial' (Precision Drag / Area Eraser): Cuts/erases points and lines touched by the eraser, splitting strokes
   * 2. 'stroke' (Whole Figure / Object Eraser): Removes the whole stroke, shape, or text clicked
   */
  const handleEraserAt = (docX: number, docY: number) => {
    const eraseRadius = (eraserSize || 24) / cameraEngineRef.current.getState().zoom;
    const currentList = activeEraserObjectsRef.current || [...doc.objects];

    if (eraserMode === 'partial') {
      let modified = false;
      const updatedObjects: CanvasObject[] = [];

      for (const obj of currentList) {
        if (obj.type === 'stroke') {
          const sliced = sliceStroke(obj as StrokeObject, docX, docY, eraseRadius);
          if (sliced === null) {
            updatedObjects.push(obj);
          } else {
            modified = true;
            updatedObjects.push(...sliced);
          }
        } else if (obj.type === 'shape') {
          const sliced = sliceShape(obj as ShapeObject, docX, docY, eraseRadius);
          if (sliced === null) {
            updatedObjects.push(obj);
          } else {
            modified = true;
            updatedObjects.push(...sliced);
          }
        } else {
          // In precision drag mode, protect tables, sticky notes, and text from accidental deletion
          updatedObjects.push(obj);
        }
      }

      if (modified) {
        eraserModifiedRef.current = true;
        activeEraserObjectsRef.current = updatedObjects;
      }
      return modified;
    } else {
      // Whole Figure (Object Eraser)
      let modified = false;
      const remaining = currentList.filter((obj) => {
        if (obj.type === 'stroke') {
          const stroke = obj as StrokeObject;
          if (eraserMode === 'highlighter_only' && !stroke.isHighlighter && stroke.penType !== 'highlighter') {
            return true;
          }
          for (let i = 0; i < stroke.points.length; i++) {
            if (Math.hypot(stroke.points[i].x - docX, stroke.points[i].y - docY) < eraseRadius) {
              modified = true;
              return false;
            }
            if (i > 0 && distToSegment({ x: docX, y: docY }, stroke.points[i - 1], stroke.points[i]) < eraseRadius) {
              modified = true;
              return false;
            }
          }
          return true;
        } else if (obj.type === 'shape') {
          const shape = obj as ShapeObject;
          let touchesShape = false;
          if (shape.shapeType === 'line' || shape.shapeType === 'arrow') {
            const sPt = shape.startPoint || { x: shape.x, y: shape.y };
            const ePt = shape.endPoint || { x: shape.x + shape.width, y: shape.y + shape.height };
            touchesShape = distToSegment({ x: docX, y: docY }, sPt, ePt) <= eraseRadius;
          } else {
            touchesShape =
              docX >= shape.x - eraseRadius &&
              docX <= shape.x + shape.width + eraseRadius &&
              docY >= shape.y - eraseRadius &&
              docY <= shape.y + shape.height + eraseRadius;
          }
          if (touchesShape) {
            modified = true;
            return false;
          }
          return true;
        } else if (obj.type === 'text' || obj.type === 'sticky') {
          if (
            docX >= obj.x - eraseRadius &&
            docX <= obj.x + obj.width + eraseRadius &&
            docY >= obj.y - eraseRadius &&
            docY <= obj.y + obj.height + eraseRadius
          ) {
            modified = true;
            return false;
          }
          return true;
        }
        return true;
      });

      if (modified) {
        eraserModifiedRef.current = true;
        activeEraserObjectsRef.current = remaining;
      }
      return modified;
    }
  };

  /**
   * POINTER DOWN (Mouse, Pen, Touchpad)
   */
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    currentPointerTypeRef.current = e.pointerType;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const docPt = cameraEngineRef.current.screenToDoc(screenX, screenY);

    // Capture pointer for uninterrupted multi-touch / pen gestures
    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {}

    // Middle-click or Space+click triggers panning
    if (e.button === 1 || isSpacePressedRef.current || activeTool === 'hand') {
      isPanningRef.current = true;
      panStartRef.current = { x: screenX, y: screenY };
      return;
    }

    // Right-click cancels inking
    if (e.button === 2) {
      if (clickToInkFSMRef.current) {
        clickToInkFSMRef.current.handleContextMenu(e.nativeEvent);
      }
      return;
    }

    onCursorDocMove?.(docPt);

    // 1. Check Click-to-Ink FSM
    if (clickToInkSettings.enabled && (activeTool === 'pen' || activeTool === 'laser')) {
      const handled = clickToInkFSMRef.current?.handlePointerDown(
        screenX,
        screenY,
        docPt.x,
        docPt.y,
        e.pressure,
        e.nativeEvent
      );
      if (handled) return;
    }

    // 2. Laser Pointer Tool
    if (activeTool === 'laser') {
      isDrawingRef.current = true;
      laserTrailRef.current.push({
        x: docPt.x,
        y: docPt.y,
        time: performance.now(),
        size: activePen.size * 2,
      });
      renderOverlayOnly();
      return;
    }

    // 2b. Bucket Fill Tool
    if (activeTool === 'bucket') {
      const hitObj = [...doc.objects].reverse().find((o) => isPointInObject(o, docPt));
      if (hitObj) {
        if (hitObj.type === 'shape') {
          const sh = hitObj as ShapeObject;
          const targetColor = shapeConfig?.fillColor && shapeConfig.fillColor !== 'transparent'
            ? shapeConfig.fillColor
            : activePen.color;
          const updatedShape: ShapeObject = {
            ...sh,
            fillColor: targetColor,
            fillStyle: shapeConfig?.fillStyle || 'solid',
            updatedAt: Date.now(),
          };
          onUpdateDocument({ ...doc, objects: doc.objects.map((o) => (o.id === hitObj.id ? updatedShape : o)) }, true);
        } else if (hitObj.type === 'sticky') {
          const st = hitObj as StickyNoteObject;
          const updatedSt: StickyNoteObject = {
            ...st,
            color: activePen.color,
            updatedAt: Date.now(),
          };
          onUpdateDocument({ ...doc, objects: doc.objects.map((o) => (o.id === hitObj.id ? updatedSt : o)) }, true);
        } else if (hitObj.type === 'frame') {
          const fr = hitObj as FrameObject;
          const updatedFr: FrameObject = {
            ...fr,
            fillColor: shapeConfig?.fillColor || (theme === 'dark' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)'),
            updatedAt: Date.now(),
          };
          onUpdateDocument({ ...doc, objects: doc.objects.map((o) => (o.id === hitObj.id ? updatedFr : o)) }, true);
        } else if (hitObj.type === 'table') {
          const tb = hitObj as AccountingTableObject;
          const updatedTb: AccountingTableObject = {
            ...tb,
            bgColor: shapeConfig?.fillColor || (theme === 'dark' ? '#27272a' : '#f8fafc'),
            updatedAt: Date.now(),
          };
          onUpdateDocument({ ...doc, objects: doc.objects.map((o) => (o.id === hitObj.id ? updatedTb : o)) }, true);
        }
      } else {
        // Empty canvas clicked: change canvas background color
        onChangeCanvasBg?.(activePen.color);
      }
      if (!isToolLocked) {
        onSelectTool?.('select');
      }
      renderScene();
      return;
    }

    // 2c. Lasso Selection Tool
    if (activeTool === 'lasso') {
      isDrawingRef.current = true;
      lassoPointsRef.current = [{ x: docPt.x, y: docPt.y }];
      setSelection({
        selectedIds: [],
        bounds: null,
        mode: 'lasso',
        lassoPoints: [{ x: docPt.x, y: docPt.y }],
      });
      renderOverlayOnly();
      return;
    }

    // 2d. Frame Tool
    if (activeTool === 'frame') {
      isDrawingRef.current = true;
      frameStartPtRef.current = { x: docPt.x, y: docPt.y };
      return;
    }

    // 3. Pen Drawing Tool (Standard Press-and-Hold)
    if (activeTool === 'pen') {
      // If a shape was selected and user switches to pen, deselect immediately
      if (selection.selectedIds.length > 0) {
        onSelectIds?.([]);
        setSelection({ selectedIds: [], bounds: null, mode: 'idle' });
      }
      handleStartInking(docPt.x, docPt.y, e.pressure);
      return;
    }

    // 4. Eraser Tool
    if (activeTool === 'eraser') {
      isDrawingRef.current = true;
      eraserModifiedRef.current = false;
      activeEraserObjectsRef.current = [...doc.objects];
      lastEraserDocPtRef.current = { x: docPt.x, y: docPt.y };
      const modified = handleEraserAt(docPt.x, docPt.y);
      if (modified) {
        scheduleDocRedraw();
      }
      renderOverlayOnly();
      return;
    }

    // 5. Shape Tool
    if (activeTool === 'shape') {
      // If a shape was selected and user clicks canvas, deselect previous shape cleanly
      if (selection.selectedIds.length > 0) {
        onSelectIds?.([]);
        setSelection({ selectedIds: [], bounds: null, mode: 'idle' });
      }
      isDrawingRef.current = true;
      shapeStartPtRef.current = { x: docPt.x, y: docPt.y };
      liveShapeRef.current = null;
      return;
    }

    // 5b. Image Tool: If user clicks canvas while image tool is active, deselect and switch to select
    if (activeTool === 'image') {
      onSelectIds?.([]);
      onSelectTable?.(null);
      setSelection({ selectedIds: [], bounds: null, mode: 'idle' });
      onSelectTool?.('select');
      renderScene();
      return;
    }

    // ============================================================================
    // LANDMARK: SELECTION & OUT-OF-ACTIVE SHAPE FIGURE FSM
    // ============================================================================
    if (activeTool === 'select') {
      // 1. Check if clicking on an active resize handle of selected bounds first
      if (selection.bounds && selection.selectedIds.length > 0) {
        const zoom = cameraEngineRef.current.getState().zoom;
        const hitHandle = getTransformHandleAtPoint(selection.bounds, docPt, zoom);
        if (hitHandle) {
          isResizingRef.current = true;
          activeResizeHandleRef.current = hitHandle;
          resizeStartDocPtRef.current = { x: docPt.x, y: docPt.y };
          resizeInitialBoundsRef.current = { ...selection.bounds };
          const snapshot = new Map<string, CanvasObject>();
          doc.objects
            .filter((o) => selection.selectedIds.includes(o.id))
            .forEach((o) => snapshot.set(o.id, JSON.parse(JSON.stringify(o))));
          resizeInitialObjectsRef.current = snapshot;
          return;
        }
      }

      // 2. Hit-test objects in reverse order (topmost first)
      const hitObj = [...doc.objects].reverse().find((o) => isPointInObject(o, docPt));

      if (hitObj) {
        let newSelectedIds: string[];
        if (e.shiftKey) {
          if (selection.selectedIds.includes(hitObj.id)) {
            newSelectedIds = selection.selectedIds.filter((id) => id !== hitObj.id);
          } else {
            newSelectedIds = [...selection.selectedIds, hitObj.id];
          }
        } else {
          if (selection.selectedIds.includes(hitObj.id)) {
            newSelectedIds = selection.selectedIds;
          } else {
            newSelectedIds = [hitObj.id];
          }
        }

        const selectedObjs = doc.objects.filter((o) => newSelectedIds.includes(o.id));
        setSelection({
          selectedIds: newSelectedIds,
          bounds: getEnclosingBounds(selectedObjs),
          mode: 'moving',
        });
        onSelectIds?.(newSelectedIds);
        if (hitObj.type === 'table') {
          onSelectTable?.(hitObj.id);
        } else {
          onSelectTable?.(null);
        }

        // Prepare object dragging
        isDraggingObjectsRef.current = true;
        dragStartDocPtRef.current = { x: docPt.x, y: docPt.y };
        const initMap = new Map<string, { x: number; y: number; startPt?: { x: number; y: number }; endPt?: { x: number; y: number } }>();
        selectedObjs.forEach((o) => {
          initMap.set(o.id, {
            x: o.x,
            y: o.y,
            startPt: (o as ShapeObject).startPoint ? { ...(o as ShapeObject).startPoint! } : undefined,
            endPt: (o as ShapeObject).endPoint ? { ...(o as ShapeObject).endPoint! } : undefined,
          });
        });
        dragInitialPositionsRef.current = initMap;
        renderScene();
        return;
      }

      // 3. OUT-OF-ACTIVE SHAPE CLICK: Clicked empty canvas outside any shape!
      // Immediately deselect active shape and reset all selection bounds cleanly.
      onSelectIds?.([]);
      onSelectTable?.(null);
      selectionStartRef.current = { x: docPt.x, y: docPt.y };
      setSelection({
        selectedIds: [],
        bounds: null,
        mode: 'marquee',
      });
      renderScene();
      return;
    }

    // 7. Text Tool: Click to place and immediately edit text
    if (activeTool === 'text') {
      const activePage = doc.pages.find((p) => p.id === doc.activePageId) || doc.pages[0];
      const defaultColor = theme === 'dark' ? '#f4f4f5' : '#1e1e1e';
      const fontColor = textConfig?.color || defaultColor;
      const zoom = cameraEngineRef.current.getState().zoom;
      const initialFontSize = Math.max(12, Math.round((textConfig?.fontSize || 20) / zoom));

      const newText: TextObject = {
        id: 'text-' + Math.random().toString(36).substring(2, 9),
        pageId: activePage ? activePage.id : null,
        type: 'text',
        layerId: 'layer-text',
        x: docPt.x,
        y: docPt.y,
        width: 120,
        height: Math.round(initialFontSize * 1.5),
        text: '',
        fontSize: initialFontSize,
        fontFamily: textConfig?.fontFamily || 'Caveat, cursive',
        color: fontColor,
        align: textConfig?.align || 'left',
        bold: textConfig?.bold ?? false,
        italic: textConfig?.italic ?? false,
        underline: textConfig?.underline ?? false,
        opacity: textConfig?.opacity ?? 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deviceId: 'local',
      };

      onUpdateDocument({ ...doc, objects: [...doc.objects, newText] }, true);
      onSelectIds?.([newText.id]);
      setSelection({
        selectedIds: [newText.id],
        bounds: { x: newText.x, y: newText.y, width: newText.width, height: newText.height },
        mode: 'idle',
      });
      setEditingTextObj({
        id: newText.id,
        text: '',
        x: newText.x,
        y: newText.y,
        fontSize: newText.fontSize,
        fontFamily: newText.fontFamily,
        color: newText.color,
        align: newText.align,
        bold: newText.bold,
        italic: newText.italic,
        underline: newText.underline,
        opacity: newText.opacity,
        isNew: true,
      });
      textCreationTimeRef.current = performance.now();
      try {
        e.preventDefault();
      } catch {}
      if (!isToolLocked) {
        onSelectTool?.('select');
      }
      return;
    }

    // 8. Sticky Note Tool: Click to place sticky note immediately
    if (activeTool === 'sticky') {
      const activePage = doc.pages.find((p) => p.id === doc.activePageId) || doc.pages[0];
      const stickyColor = stickyConfig?.color || '#fef08a';
      const stickyTextColor = stickyConfig?.textColor || '#1e1e1e';
      const stickyFontFamily = stickyConfig?.fontFamily || 'Caveat, cursive';
      const todayLabel = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const zoom = cameraEngineRef.current.getState().zoom;
      const stickyDim = Math.max(100, Math.round(200 / zoom));
      const stickyFontSize = Math.max(12, Math.round((stickyConfig?.fontSize || 20) / zoom));

      const sticky: StickyNoteObject = {
        id: 'sticky-' + Math.random().toString(36).substring(2, 9),
        pageId: activePage ? activePage.id : null,
        type: 'sticky',
        layerId: 'layer-text',
        x: Math.round(docPt.x - stickyDim / 2),
        y: Math.round(docPt.y - stickyDim / 2),
        width: stickyDim,
        height: stickyDim,
        text: '',
        color: stickyColor,
        textColor: stickyTextColor,
        fontFamily: stickyFontFamily,
        fontSize: stickyFontSize,
        textAlign: stickyConfig?.textAlign || 'center',
        verticalAlign: stickyConfig?.verticalAlign || 'middle',
        dateLabel: todayLabel,
        opacity: stickyConfig?.opacity ?? 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deviceId: 'local',
      };

      onUpdateDocument({ ...doc, objects: [...doc.objects, sticky] }, true);
      onSelectIds?.([sticky.id]);
      setSelection({
        selectedIds: [sticky.id],
        bounds: { x: sticky.x, y: sticky.y, width: sticky.width, height: sticky.height },
        mode: 'idle',
      });
      setEditingStickyObj({
        id: sticky.id,
        text: '',
        x: sticky.x,
        y: sticky.y,
        width: sticky.width,
        height: sticky.height,
        color: sticky.color,
        textColor: sticky.textColor,
        fontSize: sticky.fontSize,
        fontFamily: sticky.fontFamily,
        textAlign: sticky.textAlign,
        verticalAlign: sticky.verticalAlign,
        dateLabel: sticky.dateLabel,
        isNew: true,
      });

      if (!isToolLocked) {
        onSelectTool?.('select');
      }
      renderScene();
      return;
    }
  };

  /**
   * POINTER MOVE
   */
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    currentPointerTypeRef.current = e.pointerType;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    cursorPosRef.current = { x: screenX, y: screenY };

    // Handle Panning
    if (isPanningRef.current) {
      const dx = screenX - panStartRef.current.x;
      const dy = screenY - panStartRef.current.y;
      cameraEngineRef.current.panBy(dx, dy);
      panStartRef.current = { x: screenX, y: screenY };
      return;
    }

    let docPt = cameraEngineRef.current.screenToDoc(screenX, screenY);
    onCursorDocMove?.(docPt);

    // Fast overlay redraw for eraser: always updates cursor ring with 0ms delay at 120 FPS
    if (activeTool === 'eraser') {
      renderOverlayOnly();
    }

    // Shift key constraint: snap straight line
    if (e.shiftKey && livePointsRef.current.length > 0) {
      docPt = snapToStraightLine(
        livePointsRef.current[0],
        { ...docPt, time: performance.now() }
      );
    }

    // Laser trail
    if (activeTool === 'laser' && isDrawingRef.current) {
      laserTrailRef.current.push({
        x: docPt.x,
        y: docPt.y,
        time: performance.now(),
        size: activePen.size * 2,
      });
      renderOverlayOnly();
      return;
    }

    // Lasso selection path
    if (activeTool === 'lasso' && isDrawingRef.current) {
      lassoPointsRef.current.push({ x: docPt.x, y: docPt.y });
      setSelection((prev) => ({ ...prev, lassoPoints: [...lassoPointsRef.current] }));
      renderOverlayOnly();
      return;
    }

    // Frame tool drag preview
    if (activeTool === 'frame' && isDrawingRef.current && frameStartPtRef.current) {
      const start = frameStartPtRef.current;
      const liveFrame: FrameObject = {
        id: 'preview-frame',
        pageId: null,
        type: 'frame',
        layerId: 'layer-frames',
        name: 'Frame',
        x: Math.min(start.x, docPt.x),
        y: Math.min(start.y, docPt.y),
        width: Math.max(1, Math.abs(docPt.x - start.x)),
        height: Math.max(1, Math.abs(docPt.y - start.y)),
        strokeColor: '#3b82f6',
        strokeStyle: 'dashed',
        strokeWidth: 1.5,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deviceId: 'local',
      };
      liveShapeRef.current = {
        shape: {
          ...liveFrame,
          shapeType: 'rounded_rect',
          fillColor: 'transparent',
          roughness: 0,
          opacity: 1,
        } as any,
        startPt: start,
        currentPt: docPt,
      };
      renderOverlayOnly();
      return;
    }

    // Click-to-Ink FSM Movement
    if (clickToInkSettings.enabled && (activeTool === 'pen' || activeTool === 'laser')) {
      clickToInkFSMRef.current?.handlePointerMove(
        screenX,
        screenY,
        docPt.x,
        docPt.y,
        e.pressure,
        rect.width,
        rect.height
      );
    }

    // ============================================================================
    // LANDMARK: HARDWARE COALESCED EVENTS INKING (<8ms latency, 120Hz/240Hz)
    // ============================================================================
    if (isDrawingRef.current && activeTool === 'pen') {
      const nativeEv = e.nativeEvent;
      const coalescedEvents = (typeof nativeEv.getCoalescedEvents === 'function')
        ? nativeEv.getCoalescedEvents()
        : [nativeEv];

      for (const ev of coalescedEvents) {
        const sx = ev.clientX - rect.left;
        const sy = ev.clientY - rect.top;
        const pt = cameraEngineRef.current.screenToDoc(sx, sy);
        handleMoveInking(pt.x, pt.y, ev.pressure, false);
      }
      renderOverlayOnly();
      return;
    }

    // Eraser move (Interpolate along path for continuous 120 FPS gapless slicing)
    if (isDrawingRef.current && activeTool === 'eraser') {
      const prevPt = lastEraserDocPtRef.current || docPt;
      const dist = Math.hypot(docPt.x - prevPt.x, docPt.y - prevPt.y);
      const radius = (eraserSize || 24) / cameraEngineRef.current.getState().zoom;
      const step = Math.max(8, radius * 0.65);

      let anyModified = false;
      if (dist > step) {
        const steps = Math.min(6, Math.ceil(dist / step));
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          const ix = prevPt.x + (docPt.x - prevPt.x) * t;
          const iy = prevPt.y + (docPt.y - prevPt.y) * t;
          if (handleEraserAt(ix, iy)) anyModified = true;
        }
      } else {
        if (handleEraserAt(docPt.x, docPt.y)) anyModified = true;
      }
      lastEraserDocPtRef.current = { x: docPt.x, y: docPt.y };

      if (anyModified) {
        scheduleDocRedraw();
      }
      return;
    }

    // Shape creation drag: Live rendering on fast overlay layer (<16ms, 120 FPS)
    if (isDrawingRef.current && activeTool === 'shape' && shapeStartPtRef.current) {
      const start = shapeStartPtRef.current;
      let targetPt = { x: docPt.x, y: docPt.y };

      // Shift key constraint: 1:1 aspect ratio or snap angle
      if (e.shiftKey) {
        if (activeShape === 'line' || activeShape === 'arrow' || activeShape === 'connector') {
          const dx = docPt.x - start.x;
          const dy = docPt.y - start.y;
          const dist = Math.hypot(dx, dy);
          const angle = Math.atan2(dy, dx);
          // Snap to 15-degree increments (PI / 12)
          const snapStep = Math.PI / 12;
          const snappedAngle = Math.round(angle / snapStep) * snapStep;
          targetPt = {
            x: start.x + dist * Math.cos(snappedAngle),
            y: start.y + dist * Math.sin(snappedAngle),
          };
        } else {
          // 1:1 square / circle constraint
          const maxDim = Math.max(Math.abs(docPt.x - start.x), Math.abs(docPt.y - start.y));
          const signX = docPt.x >= start.x ? 1 : -1;
          const signY = docPt.y >= start.y ? 1 : -1;
          targetPt = {
            x: start.x + maxDim * signX,
            y: start.y + maxDim * signY,
          };
        }
      }

      const activePage = doc.pages.find((p) => p.id === doc.activePageId) || doc.pages[0];
      const isRounded = (shapeConfig?.rounded && activeShape === 'rectangle');
      const liveShape: ShapeObject = {
        id: 'preview-shape',
        pageId: activePage ? activePage.id : null,
        type: 'shape',
        layerId: 'layer-shapes',
        x: Math.min(start.x, targetPt.x),
        y: Math.min(start.y, targetPt.y),
        width: Math.max(1, Math.abs(targetPt.x - start.x)),
        height: Math.max(1, Math.abs(targetPt.y - start.y)),
        shapeType: isRounded ? 'rounded_rect' : activeShape,
        strokeColor: shapeConfig?.strokeColor || activePen.color,
        fillColor: shapeConfig?.fillColor || 'transparent',
        strokeWidth: shapeConfig?.strokeWidth || activePen.size,
        strokeStyle: shapeConfig?.strokeStyle || 'solid',
        fillStyle: shapeConfig?.fillStyle || 'solid',
        roughness: shapeConfig?.roughness ?? 0,
        opacity: shapeConfig?.opacity ?? 1,
        startPoint: { x: start.x, y: start.y },
        endPoint: { x: targetPt.x, y: targetPt.y },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deviceId: 'local',
      };

      liveShapeRef.current = {
        shape: liveShape,
        startPt: start,
        currentPt: targetPt,
      };

      renderOverlayOnly();
      return;
    }



    // Selection Tool Move (Resize objects, Drag objects, Marquee, or Cursor Hover)
    if (activeTool === 'select') {
      // 0. Resizing selected objects via transform handle
      if (
        isResizingRef.current &&
        activeResizeHandleRef.current &&
        resizeStartDocPtRef.current &&
        resizeInitialBoundsRef.current
      ) {
        const initBounds = resizeInitialBoundsRef.current;
        const dx = docPt.x - resizeStartDocPtRef.current.x;
        const dy = docPt.y - resizeStartDocPtRef.current.y;
        const handle = activeResizeHandleRef.current;

        let newX = initBounds.x;
        let newY = initBounds.y;
        let newW = initBounds.width;
        let newH = initBounds.height;

        if (handle.includes('e')) {
          newW = Math.max(30, initBounds.width + dx);
        }
        if (handle.includes('s')) {
          newH = Math.max(20, initBounds.height + dy);
        }
        if (handle.includes('w')) {
          const possibleW = initBounds.width - dx;
          if (possibleW >= 30) {
            newX = initBounds.x + dx;
            newW = possibleW;
          } else {
            newX = initBounds.x + (initBounds.width - 30);
            newW = 30;
          }
        }
        if (handle.includes('n')) {
          const possibleH = initBounds.height - dy;
          if (possibleH >= 20) {
            newY = initBounds.y + dy;
            newH = possibleH;
          } else {
            newY = initBounds.y + (initBounds.height - 20);
            newH = 20;
          }
        }

        const scaleX = newW / Math.max(1, initBounds.width);
        const scaleY = newH / Math.max(1, initBounds.height);

        const updated = doc.objects.map((o) => {
          const initObj = resizeInitialObjectsRef.current.get(o.id);
          if (!initObj) return o;

          const relX = (initObj.x - initBounds.x) * scaleX;
          const relY = (initObj.y - initBounds.y) * scaleY;
          const targetX = newX + relX;
          const targetY = newY + relY;

          if (initObj.type === 'sticky') {
            const st = initObj as StickyNoteObject;
            return {
              ...st,
              x: targetX,
              y: targetY,
              width: Math.max(50, Math.round(st.width * scaleX)),
              height: Math.max(50, Math.round(st.height * scaleY)),
              updatedAt: Date.now(),
            };
          }

          if (initObj.type === 'text') {
            const txt = initObj as TextObject;
            if (handle.length === 2) {
              // Corner handle: proportional font scaling
              const fontScale = (scaleX + scaleY) / 2;
              const nextFontSize = Math.max(8, Math.round((txt.fontSize || 20) * fontScale));
              const dims = measureTextBounds(txt.text, nextFontSize, txt.fontFamily, txt.bold ?? false, txt.italic ?? false);
              return {
                ...txt,
                x: targetX,
                y: targetY,
                fontSize: nextFontSize,
                width: dims.width,
                height: dims.height,
                updatedAt: Date.now(),
              };
            }
            // Side handle: adjust width
            return {
              ...txt,
              x: targetX,
              y: targetY,
              width: Math.max(40, Math.round(txt.width * scaleX)),
              updatedAt: Date.now(),
            };
          }

          if (initObj.type === 'shape') {
            const sh = initObj as ShapeObject;
            const startPt = sh.startPoint
              ? { x: newX + (sh.startPoint.x - initBounds.x) * scaleX, y: newY + (sh.startPoint.y - initBounds.y) * scaleY }
              : undefined;
            const endPt = sh.endPoint
              ? { x: newX + (sh.endPoint.x - initBounds.x) * scaleX, y: newY + (sh.endPoint.y - initBounds.y) * scaleY }
              : undefined;
            return {
              ...sh,
              x: targetX,
              y: targetY,
              width: Math.max(10, Math.round(sh.width * scaleX)),
              height: Math.max(10, Math.round(sh.height * scaleY)),
              startPoint: startPt,
              endPoint: endPt,
              updatedAt: Date.now(),
            };
          }

          if (initObj.type === 'image') {
            const im = initObj as ImageObject;
            return {
              ...im,
              x: targetX,
              y: targetY,
              width: Math.max(20, Math.round(im.width * scaleX)),
              height: Math.max(20, Math.round(im.height * scaleY)),
              updatedAt: Date.now(),
            };
          }

          if (initObj.type === 'stroke') {
            const str = initObj as StrokeObject;
            return {
              ...str,
              x: targetX,
              y: targetY,
              width: Math.max(5, str.width * scaleX),
              height: Math.max(5, str.height * scaleY),
              points: str.points.map((p) => ({
                ...p,
                x: newX + (p.x - initBounds.x) * scaleX,
                y: newY + (p.y - initBounds.y) * scaleY,
              })),
              updatedAt: Date.now(),
            };
          }

          if (initObj.type === 'table') {
            const tbl = initObj as AccountingTableObject;
            const startColWidths = tbl.columns.map((c) => c.width);
            const updatedCols = tbl.columns.map((c, i) => ({
              ...c,
              width: Math.max(40, Math.round(startColWidths[i] * scaleX)),
            }));
            const finalWidth = updatedCols.reduce((s, c) => s + c.width, 0);

            const baseRowH = tbl.rowHeight || 32;
            const baseHdrH = tbl.headerHeight || 36;
            const baseFont = tbl.fontSize || 12;

            const nextRowHeight = Math.max(18, Math.round(baseRowH * scaleY));
            const nextHeaderHeight = Math.max(20, Math.round(baseHdrH * scaleY));
            const overallScale = (scaleX + scaleY) / 2;
            const nextFontSize = Math.max(8, Math.round(baseFont * overallScale));

            const updatedRows = tbl.rows.map((r) => ({
              ...r,
              height: Math.max(18, Math.round((r.height || baseRowH) * scaleY)),
            }));

            const finalHeight =
              nextHeaderHeight +
              updatedRows.reduce((s, r) => s + (r.height || nextRowHeight), 0);

            return {
              ...tbl,
              x: targetX,
              y: targetY,
              columns: updatedCols,
              rows: updatedRows,
              width: finalWidth,
              height: finalHeight,
              fontSize: nextFontSize,
              rowHeight: nextRowHeight,
              headerHeight: nextHeaderHeight,
              updatedAt: Date.now(),
            };
          }

          const anyObj = initObj as any;
          return {
            ...anyObj,
            x: targetX,
            y: targetY,
            width: anyObj.width ? Math.max(20, Math.round(anyObj.width * scaleX)) : undefined,
            height: anyObj.height ? Math.max(20, Math.round(anyObj.height * scaleY)) : undefined,
            updatedAt: Date.now(),
          };
        }) as CanvasObject[];

        activeDragObjectsRef.current = updated;
        const resizedObjs = updated.filter((o) => resizeInitialObjectsRef.current.has(o.id));
        setSelection((prev) => ({ ...prev, bounds: getEnclosingBounds(resizedObjs) }));
        renderScene();
        return;
      }

      // 1. Moving selected objects
      if (isDraggingObjectsRef.current && dragStartDocPtRef.current) {
        const dx = docPt.x - dragStartDocPtRef.current.x;
        const dy = docPt.y - dragStartDocPtRef.current.y;

        const updated = doc.objects.map((o) => {
          const init = dragInitialPositionsRef.current.get(o.id);
          if (!init) return o;
          if (o.type === 'stroke') {
            const s = o as StrokeObject;
            const deltaX = (init.x + dx) - s.x;
            const deltaY = (init.y + dy) - s.y;
            return {
              ...s,
              x: init.x + dx,
              y: init.y + dy,
              points: s.points.map((p) => ({ ...p, x: p.x + deltaX, y: p.y + deltaY })),
              updatedAt: Date.now(),
            };
          }
          if (o.type === 'shape') {
            const sh = o as ShapeObject;
            return {
              ...sh,
              x: init.x + dx,
              y: init.y + dy,
              startPoint: init.startPt ? { x: init.startPt.x + dx, y: init.startPt.y + dy } : undefined,
              endPoint: init.endPt ? { x: init.endPt.x + dx, y: init.endPt.y + dy } : undefined,
              updatedAt: Date.now(),
            };
          }
          return { ...o, x: init.x + dx, y: init.y + dy, updatedAt: Date.now() };
        }) as CanvasObject[];

        activeDragObjectsRef.current = updated;
        const movedObjs = updated.filter((o) => dragInitialPositionsRef.current.has(o.id));
        setSelection((prev) => ({ ...prev, bounds: getEnclosingBounds(movedObjs) }));
        renderScene();
        return;
      }

      // 2. Selection marquee drag
      if (selectionStartRef.current) {
        const start = selectionStartRef.current;
        const minX = Math.min(start.x, docPt.x);
        const minY = Math.min(start.y, docPt.y);
        const w = Math.abs(docPt.x - start.x);
        const h = Math.abs(docPt.y - start.y);

        const selected = doc.objects.filter(
          (o) =>
            o.x >= minX &&
            o.y >= minY &&
            o.x + (o.width || 0) <= minX + w &&
            o.y + (o.height || 0) <= minY + h
        );

        const selIds = selected.map((o) => o.id);
        setSelection({
          selectedIds: selIds,
          bounds: { x: minX, y: minY, width: w, height: h },
          mode: 'moving',
        });
        onSelectIds?.(selIds);
        renderScene();
        return;
      }

      // 3. Update cursor style when hovering over selection handles or objects
      if (containerRef.current && selection.bounds && selection.selectedIds.length > 0) {
        const zoom = cameraEngineRef.current.getState().zoom;
        const hoverHandle = getTransformHandleAtPoint(selection.bounds, docPt, zoom);
        if (hoverHandle) {
          if (hoverHandle === 'nw' || hoverHandle === 'se') containerRef.current.style.cursor = 'nwse-resize';
          else if (hoverHandle === 'ne' || hoverHandle === 'sw') containerRef.current.style.cursor = 'nesw-resize';
          else if (hoverHandle === 'n' || hoverHandle === 's') containerRef.current.style.cursor = 'ns-resize';
          else if (hoverHandle === 'e' || hoverHandle === 'w') containerRef.current.style.cursor = 'ew-resize';
        } else if (isPointInBounds(selection.bounds, docPt)) {
          containerRef.current.style.cursor = 'move';
        } else {
          containerRef.current.style.cursor = 'default';
        }
      } else if (containerRef.current) {
        containerRef.current.style.cursor = 'default';
      }
    }
  };

  /**
   * POINTER UP
   */
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {}
    isPanningRef.current = false;
    const rect = containerRef.current?.getBoundingClientRect();
    const docPt = rect
      ? cameraEngineRef.current.screenToDoc(e.clientX - rect.left, e.clientY - rect.top)
      : { x: 0, y: 0 };

    if (activeTool === 'laser') {
      isDrawingRef.current = false;
      return;
    }

    if (activeTool === 'frame') {
      isDrawingRef.current = false;
      const start = frameStartPtRef.current;
      if (start) {
        const rawW = Math.abs(docPt.x - start.x);
        const rawH = Math.abs(docPt.y - start.y);
        const isClick = rawW < 10 && rawH < 10;
        const finalW = isClick ? 420 : Math.max(80, rawW);
        const finalH = isClick ? 300 : Math.max(60, rawH);
        const finalX = isClick ? Math.round(start.x - 210) : Math.round(Math.min(start.x, docPt.x));
        const finalY = isClick ? Math.round(start.y - 150) : Math.round(Math.min(start.y, docPt.y));

        const frameCount = doc.objects.filter((o) => o.type === 'frame').length + 1;
        const newFrame: FrameObject = {
          id: 'frame-' + Math.random().toString(36).substring(2, 9),
          pageId: null,
          type: 'frame',
          layerId: 'layer-frames',
          name: `Frame ${frameCount}`,
          x: finalX,
          y: finalY,
          width: finalW,
          height: finalH,
          strokeColor: theme === 'dark' ? '#3f3f46' : '#cbd5e1',
          fillColor: 'transparent',
          strokeWidth: 1.5,
          strokeStyle: 'solid',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          deviceId: 'local',
        };

        onUpdateDocument({ ...doc, objects: [...doc.objects, newFrame] }, true);
        onSelectIds?.([newFrame.id]);
        setSelection({
          selectedIds: [newFrame.id],
          bounds: { x: newFrame.x, y: newFrame.y, width: newFrame.width, height: newFrame.height },
          mode: 'idle',
        });
        if (!isToolLocked) {
          onSelectTool?.('select');
        }
      }
      frameStartPtRef.current = null;
      liveShapeRef.current = null;
      renderScene();
      return;
    }

    if (activeTool === 'lasso') {
      isDrawingRef.current = false;
      const pts = lassoPointsRef.current;
      if (pts.length > 2) {
        const enclosedIds: string[] = [];
        doc.objects.forEach((o) => {
          const cx = o.x + (o.width || 0) / 2;
          const cy = o.y + (o.height || 0) / 2;
          if (isPointInPolygon({ x: cx, y: cy }, pts)) {
            enclosedIds.push(o.id);
          }
        });
        const enclosedObjs = doc.objects.filter((o) => enclosedIds.includes(o.id));
        if (enclosedObjs.length > 0) {
          setSelection({
            selectedIds: enclosedIds,
            bounds: getEnclosingBounds(enclosedObjs),
            mode: 'idle',
          });
          onSelectIds?.(enclosedIds);
        } else {
          setSelection({ selectedIds: [], bounds: null, mode: 'idle' });
          onSelectIds?.([]);
        }
      }
      lassoPointsRef.current = [];
      if (!isToolLocked) {
        onSelectTool?.('select');
      }
      renderScene();
      return;
    }

    if (activeTool === 'pen') {
      if (!clickToInkSettings.enabled) {
        handleEndInking(true);
      }
      return;
    }

    if (activeTool === 'eraser') {
      isDrawingRef.current = false;
      lastEraserDocPtRef.current = null;
      if (docRedrawRafRef.current !== null) {
        cancelAnimationFrame(docRedrawRafRef.current);
        docRedrawRafRef.current = null;
      }
      if (eraserModifiedRef.current && activeEraserObjectsRef.current) {
        const finalObjs = activeEraserObjectsRef.current;
        eraserModifiedRef.current = false;
        activeEraserObjectsRef.current = null;
        onUpdateDocument({ ...doc, objects: finalObjs }, true);
      } else {
        activeEraserObjectsRef.current = null;
      }
      renderOverlayOnly();
      return;
    }

    // Commit created Shape
    if (activeTool === 'shape') {
      isDrawingRef.current = false;
      const preview = liveShapeRef.current;
      const startPt = shapeStartPtRef.current;

      if (preview && (preview.shape.width > 4 || preview.shape.height > 4)) {
        const newShape: ShapeObject = {
          ...preview.shape,
          id: 'shape-' + Math.random().toString(36).substring(2, 9),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        onUpdateDocument({ ...doc, objects: [...doc.objects, newShape] }, true);

        // Auto-select newly created shape
        onSelectIds?.([newShape.id]);
        setSelection({
          selectedIds: [newShape.id],
          bounds: {
            x: newShape.x,
            y: newShape.y,
            width: newShape.width,
            height: Math.max(10, newShape.height),
          },
          mode: 'idle',
        });

        // Auto-switch to selection tool if tool lock is not active
        if (!isToolLocked) {
          onSelectTool?.('select');
        }
      } else if (startPt) {
        // Single-click without dragging: place a standard-sized shape
        const defaultSize = 100;
        const activePage = doc.pages.find((p) => p.id === doc.activePageId) || doc.pages[0];
        const isLinear = activeShape === 'line' || activeShape === 'arrow' || activeShape === 'connector';
        const newShape: ShapeObject = {
          id: 'shape-' + Math.random().toString(36).substring(2, 9),
          pageId: activePage ? activePage.id : null,
          type: 'shape',
          layerId: 'layer-shapes',
          x: isLinear ? startPt.x : startPt.x - defaultSize / 2,
          y: isLinear ? startPt.y : startPt.y - defaultSize / 2,
          width: defaultSize,
          height: isLinear ? 0 : defaultSize,
          shapeType: activeShape,
          strokeColor: activePen.color,
          fillColor: 'transparent',
          strokeWidth: activePen.size,
          strokeStyle: 'solid',
          startPoint: isLinear ? { x: startPt.x, y: startPt.y } : undefined,
          endPoint: isLinear ? { x: startPt.x + defaultSize, y: startPt.y } : undefined,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          deviceId: 'local',
        };

        onUpdateDocument({ ...doc, objects: [...doc.objects, newShape] }, true);

        onSelectIds?.([newShape.id]);
        setSelection({
          selectedIds: [newShape.id],
          bounds: {
            x: newShape.x,
            y: newShape.y,
            width: newShape.width,
            height: Math.max(10, newShape.height),
          },
          mode: 'idle',
        });

        if (!isToolLocked) {
          onSelectTool?.('select');
        }
      }

      shapeStartPtRef.current = null;
      liveShapeRef.current = null;
      renderScene();
      return;
    }



    // Selection Tool Pointer Up
    if (activeTool === 'select') {
      let committedObjects = false;
      if (isResizingRef.current) {
        isResizingRef.current = false;
        activeResizeHandleRef.current = null;
        resizeStartDocPtRef.current = null;
        resizeInitialBoundsRef.current = null;
        resizeInitialObjectsRef.current.clear();
        if (activeDragObjectsRef.current) {
          const finalObjs = activeDragObjectsRef.current;
          activeDragObjectsRef.current = null;
          onUpdateDocument({ ...doc, objects: finalObjs }, true);
          committedObjects = true;
        } else {
          onUpdateDocument({ ...doc }, true);
        }
      }
      if (isDraggingObjectsRef.current) {
        isDraggingObjectsRef.current = false;
        dragStartDocPtRef.current = null;
        dragInitialPositionsRef.current.clear();
        if (activeDragObjectsRef.current) {
          const finalObjs = activeDragObjectsRef.current;
          activeDragObjectsRef.current = null;
          onUpdateDocument({ ...doc, objects: finalObjs }, true);
          committedObjects = true;
        } else if (!committedObjects) {
          onUpdateDocument({ ...doc }, true);
        }
      }
      if (selectionStartRef.current) {
        selectionStartRef.current = null;
        if (selection.selectedIds.length > 0) {
          const selectedObjs = doc.objects.filter((o) => selection.selectedIds.includes(o.id));
          setSelection({
            selectedIds: selection.selectedIds,
            bounds: getEnclosingBounds(selectedObjs),
            mode: 'idle',
          });
        } else {
          setSelection({ selectedIds: [], bounds: null, mode: 'idle' });
        }
      }
      renderScene();
      return;
    }

    selectionStartRef.current = null;
  };

  /**
   * TEXT COMMIT HANDLER
   */
  const handleCommitText = (textValue: string) => {
    if (!editingTextObj) return;
    const trimmed = textValue.trim();

    if (!trimmed) {
      const remaining = doc.objects.filter((o) => o.id !== editingTextObj.id);
      onUpdateDocument({ ...doc, objects: remaining }, true);
      setEditingTextObj(null);
      return;
    }

    const activePage = doc.pages.find((p) => p.id === doc.activePageId) || doc.pages[0];
    const dims = measureTextBounds(
      textValue,
      editingTextObj.fontSize,
      editingTextObj.fontFamily,
      editingTextObj.bold ?? false,
      editingTextObj.italic ?? false
    );
    const calculatedWidth = dims.width;
    const calculatedHeight = dims.height;

    if (editingTextObj.isNew) {
      const newText: TextObject = {
        id: editingTextObj.id,
        pageId: activePage ? activePage.id : null,
        type: 'text',
        layerId: 'layer-text',
        x: editingTextObj.x,
        y: editingTextObj.y,
        width: calculatedWidth,
        height: calculatedHeight,
        text: textValue,
        fontSize: editingTextObj.fontSize,
        fontFamily: editingTextObj.fontFamily,
        color: editingTextObj.color,
        align: editingTextObj.align || 'left',
        bold: editingTextObj.bold,
        italic: editingTextObj.italic,
        underline: editingTextObj.underline,
        opacity: editingTextObj.opacity ?? 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deviceId: 'local',
      };
      onUpdateDocument({ ...doc, objects: [...doc.objects, newText] }, true);
    } else {
      const updated = doc.objects.map((o) =>
        o.id === editingTextObj.id
          ? {
              ...o,
              text: textValue,
              width: calculatedWidth,
              height: calculatedHeight,
              fontSize: editingTextObj.fontSize,
              fontFamily: editingTextObj.fontFamily,
              color: editingTextObj.color,
              align: editingTextObj.align,
              bold: editingTextObj.bold,
              italic: editingTextObj.italic,
              underline: editingTextObj.underline,
              opacity: editingTextObj.opacity,
              updatedAt: Date.now(),
            }
          : o
      ) as CanvasObject[];
      onUpdateDocument({ ...doc, objects: updated }, true);
    }

    setEditingTextObj(null);
  };

  /**
   * STICKY NOTE COMMIT HANDLER
   */
  const handleCommitStickyText = (textValue: string) => {
    if (!editingStickyObj) return;

    // Compute required height based on wrapped lines
    const maxContentWidth = Math.max(30, editingStickyObj.width - 32);
    const lines = wrapTextLines(
      textValue || '',
      maxContentWidth,
      editingStickyObj.fontSize || 20,
      editingStickyObj.fontFamily || 'Caveat, cursive'
    );
    const requiredHeight = Math.max(
      editingStickyObj.height,
      Math.ceil(lines.length * (editingStickyObj.fontSize || 20) * 1.35 + 48)
    );

    const updated = doc.objects.map((o) =>
      o.id === editingStickyObj.id
        ? {
            ...o,
            text: textValue,
            height: requiredHeight,
            updatedAt: Date.now(),
          }
        : o
    ) as CanvasObject[];
    onUpdateDocument({ ...doc, objects: updated }, true);
    setEditingStickyObj(null);
  };

  // Track consecutive clicks for triple-click text insertion
  const clickCountRef = useRef<{ count: number; lastTime: number; x: number; y: number }>({
    count: 0,
    lastTime: 0,
    x: 0,
    y: 0,
  });

  /**
   * DOUBLE CLICK: Edit existing Text or Sticky Note (Does NOT create new text on empty canvas)
   */
  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const docPt = cameraEngineRef.current.screenToDoc(screenX, screenY);

    if (clickToInkSettings.enabled) {
      const handled = clickToInkFSMRef.current?.handleDoubleClick(docPt.x, docPt.y);
      if (handled) return;
    }

    // 1. Check if double clicking on an existing text object
    const hitText = doc.objects.slice().reverse().find(
      (o) => o.type === 'text' && isPointInObject(o, docPt)
    ) as TextObject | undefined;

    if (hitText) {
      setEditingTextObj({
        id: hitText.id,
        text: hitText.text,
        x: hitText.x,
        y: hitText.y,
        fontSize: hitText.fontSize,
        fontFamily: hitText.fontFamily,
        color: hitText.color,
        align: hitText.align,
        bold: hitText.bold ?? false,
        italic: hitText.italic ?? false,
        underline: hitText.underline ?? false,
        opacity: hitText.opacity,
        isNew: false,
      });
      return;
    }

    // 2. Check if double clicking on an existing sticky note
    const hitSticky = doc.objects.slice().reverse().find(
      (o) => o.type === 'sticky' && isPointInObject(o, docPt)
    ) as StickyNoteObject | undefined;

    if (hitSticky) {
      setEditingStickyObj({
        id: hitSticky.id,
        text: hitSticky.text,
        x: hitSticky.x,
        y: hitSticky.y,
        width: hitSticky.width,
        height: hitSticky.height,
        color: hitSticky.color,
        textColor: hitSticky.textColor,
        fontSize: hitSticky.fontSize || 20,
        fontFamily: hitSticky.fontFamily || 'Caveat, cursive',
        textAlign: hitSticky.textAlign || 'center',
        verticalAlign: hitSticky.verticalAlign || 'middle',
        dateLabel: hitSticky.dateLabel,
        isNew: false,
      });
      return;
    }

    // 3. Check if double clicking on an Embed object: Open link in new tab
    const hitEmbed = doc.objects.slice().reverse().find(
      (o) => o.type === 'embed' && isPointInObject(o, docPt)
    ) as EmbedObject | undefined;
    if (hitEmbed) {
      window.open(hitEmbed.url, '_blank', 'noopener,noreferrer');
      return;
    }

    // 4. Check if double clicking on a Frame: Rename Frame
    const hitFrame = doc.objects.slice().reverse().find(
      (o) => o.type === 'frame' && isPointInObject(o, docPt)
    ) as FrameObject | undefined;
    if (hitFrame) {
      const newName = window.prompt('Rename Frame:', hitFrame.name || 'Frame');
      if (newName && newName.trim()) {
        const updatedFrame = { ...hitFrame, name: newName.trim(), updatedAt: Date.now() };
        onUpdateDocument({ ...doc, objects: doc.objects.map((o) => (o.id === hitFrame.id ? updatedFrame : o)) }, true);
      }
      return;
    }

    // Note: Double clicking on empty canvas deliberately does NOT create text anymore.
    // Creating text requires TRIPLE click to prevent accidental triggers while inking or navigating.
  };

  /**
   * CANVAS CLICK: Handles triple-click to spawn new Text Box on canvas
   */
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const now = performance.now();
    const dist = Math.hypot(screenX - clickCountRef.current.x, screenY - clickCountRef.current.y);

    const TRIPLE_CLICK_THRESHOLD_MS = 220; // Reduced by half (from 450ms) for fast writers

    if (now - clickCountRef.current.lastTime < TRIPLE_CLICK_THRESHOLD_MS && dist < 25) {
      clickCountRef.current.count += 1;
    } else {
      clickCountRef.current.count = 1;
    }
    clickCountRef.current.lastTime = now;
    clickCountRef.current.x = screenX;
    clickCountRef.current.y = screenY;

    // TRIPLE CLICK TRIGGER: Requires 3 consecutive fast clicks within 220ms
    if (clickCountRef.current.count >= 3) {
      clickCountRef.current.count = 0; // reset
      const docPt = cameraEngineRef.current.screenToDoc(screenX, screenY);

      // Don't spawn text if clicking on table or existing object
      const hitObj = doc.objects.slice().reverse().find((o) => isPointInObject(o, docPt));
      if (hitObj && hitObj.type === 'table') return;

      const newId = 'text-' + Math.random().toString(36).substring(2, 9);
      const defaultColor = theme === 'dark' ? '#f4f4f5' : '#1e1e1e';
      const fontColor = textConfig?.color || defaultColor;
      const initialFontSize = textConfig?.fontSize || 20;

      setEditingTextObj({
        id: newId,
        text: '',
        x: docPt.x,
        y: docPt.y,
        fontSize: initialFontSize,
        fontFamily: textConfig?.fontFamily || 'Caveat, cursive',
        color: fontColor,
        align: textConfig?.align || 'left',
        bold: textConfig?.bold ?? false,
        italic: textConfig?.italic ?? false,
        underline: textConfig?.underline ?? false,
        opacity: textConfig?.opacity ?? 1,
        isNew: true,
      });
    }
  };

  /**
   * NATIVE NON-PASSIVE WHEEL & PINCH-TO-ZOOM (Prevents browser window zoom)
   */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleNativeWheel = (e: WheelEvent) => {
      // Prevent browser default window zoom
      e.preventDefault();
      e.stopPropagation();

      const rect = container.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      // Trackpad pinch-to-zoom OR Ctrl + mouse wheel OR wheelMode === 'zoom':
      const isZoomGesture = e.ctrlKey || e.metaKey || inputSettings.wheelMode === 'zoom';
      if (isZoomGesture) {
        let delta = e.deltaY;
        // Normalize delta across line vs pixel mode
        if (e.deltaMode === 1) delta *= 20; // LINE mode (standard mouse wheel)
        else if (e.deltaMode === 2) delta *= 80; // PAGE mode

        // Calibrated sensitivity: trackpad pinch (e.ctrlKey) is tuned to 0.016 for snappy response;
        // ordinary wheel is tuned to 0.0035 for controllable increments.
        const multiplier = (e.ctrlKey || e.metaKey) ? 0.016 : 0.0035;
        const clampedDelta = Math.max(-50, Math.min(50, delta));
        const zoomFactor = Math.pow(2, -clampedDelta * multiplier);
        cameraEngineRef.current.zoomAt(screenX, screenY, zoomFactor);
      } else {
        // Standard two-finger trackpad scroll: PAN / MOVE the canvas
        // Standard mouse wheel: Pan vertically (or horizontally with Shift)
        if (e.shiftKey) {
          cameraEngineRef.current.panBy(-e.deltaY, 0);
        } else {
          cameraEngineRef.current.panBy(-e.deltaX, -e.deltaY);
        }
      }
    };

    const handleWindowWheel = (e: WheelEvent) => {
      // If the event happened inside canvas container, handleNativeWheel already processed it
      if (container.contains(e.target as Node)) return;

      const isZoomGesture = e.ctrlKey || e.metaKey || inputSettings.wheelMode === 'zoom';
      if (isZoomGesture) {
        e.preventDefault();
        const rect = container.getBoundingClientRect();
        const screenX = rect ? e.clientX - rect.left : container.clientWidth / 2;
        const screenY = rect ? e.clientY - rect.top : container.clientHeight / 2;
        const delta = e.deltaMode === 1 ? e.deltaY * 20 : e.deltaY;
        const multiplier = (e.ctrlKey || e.metaKey) ? 0.016 : 0.0035;
        const clampedDelta = Math.max(-50, Math.min(50, delta));
        const zoomFactor = Math.pow(2, -clampedDelta * multiplier);
        cameraEngineRef.current.zoomAt(screenX, screenY, zoomFactor);
      }
    };

    let touchStartDist = 0;
    let touchStartZoom = 1;
    let touchStartMid = { x: 0, y: 0 };
    let isTouchPinching = false;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        isTouchPinching = true;
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        touchStartDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        touchStartZoom = cameraEngineRef.current.getState().zoom;
        const rect = container.getBoundingClientRect();
        touchStartMid = {
          x: (t1.clientX + t2.clientX) / 2 - rect.left,
          y: (t1.clientY + t2.clientY) / 2 - rect.top,
        };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isTouchPinching && e.touches.length === 2) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        if (touchStartDist > 0 && currentDist > 0) {
          const rect = container.getBoundingClientRect();
          const currentMid = {
            x: (t1.clientX + t2.clientX) / 2 - rect.left,
            y: (t1.clientY + t2.clientY) / 2 - rect.top,
          };
          const zoomFactor = currentDist / touchStartDist;
          cameraEngineRef.current.setZoom(currentMid.x, currentMid.y, touchStartZoom * zoomFactor);
          cameraEngineRef.current.panBy(currentMid.x - touchStartMid.x, currentMid.y - touchStartMid.y);
          touchStartMid = currentMid;
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        isTouchPinching = false;
        touchStartDist = 0;
      }
    };

    container.addEventListener('wheel', handleNativeWheel, { passive: false });
    window.addEventListener('wheel', handleWindowWheel, { passive: false });
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      container.removeEventListener('wheel', handleNativeWheel);
      window.removeEventListener('wheel', handleWindowWheel);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [inputSettings.wheelMode]);

  /**
   * DRAG & DROP ACCOUNTING FORMATS FROM LIBRARY DRAWER
   */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const docPos = cameraEngineRef.current.screenToDoc(screenX, screenY);

    const snappedX = Math.round(docPos.x / 20) * 20;
    const snappedY = Math.round(docPos.y / 20) * 20;

    const formatType = (
      (window as any).__DRAGGING_FORMAT__ ||
      e.dataTransfer.getData('formatType') ||
      'journal'
    ) as AccountingFormatType;
    const meta = ACCOUNTING_FORMAT_CATALOG.find((m) => m.type === formatType);

    setDragGhost({
      x: snappedX,
      y: snappedY,
      width: meta?.recommendedWidth || 720,
      height: 220,
      title: meta?.name || 'Accounting Format',
    });
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget === e.target) {
      setDragGhost(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragGhost(null);

    const formatType = (
      (window as any).__DRAGGING_FORMAT__ ||
      e.dataTransfer.getData('formatType') ||
      e.dataTransfer.getData('text/plain')
    ) as AccountingFormatType;
    (window as any).__DRAGGING_FORMAT__ = null;
    if (!formatType) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const docPos = cameraEngineRef.current.screenToDoc(screenX, screenY);
    const snappedX = Math.round(docPos.x / 20) * 20;
    const snappedY = Math.round(docPos.y / 20) * 20;

    onDropFormat?.(formatType, snappedX, snappedY);
  };

  /**
   * SAFETY NETS: pointer leaves window, window blur, keydown
   */
  useEffect(() => {
    const handleWindowBlur = () => {
      clickToInkFSMRef.current?.handleSafetyInterruption('window_blur');
      if (isDrawingRef.current) handleEndInking(true);
    };

    const handlePointerCancel = () => {
      clickToInkFSMRef.current?.handleSafetyInterruption('pointer_cancel');
      if (isDrawingRef.current) handleEndInking(true);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = true;
      }

      // Click-to-Ink hotkey: Ctrl+Shift+L
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyL') {
        e.preventDefault();
        return;
      }

      // Delegate to Click-to-Ink FSM (Escape cancels, Enter commits, Space lifts)
      if (clickToInkFSMRef.current?.handleKeyDown(e)) {
        return;
      }

      // Zoom shortcuts: Ctrl + / Ctrl - / Ctrl 0
      if (e.ctrlKey && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        handleCustomZoomIn();
      } else if (e.ctrlKey && e.key === '-') {
        e.preventDefault();
        handleCustomZoomOut();
      } else if (e.ctrlKey && (e.key === '0' || e.key === '1')) {
        e.preventDefault();
        handleCustomZoomReset();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressedRef.current = false;
      }
      clickToInkFSMRef.current?.handleKeyUp(e);
    };

    const ZOOM_LEVELS = [0.10, 0.15, 0.25, 0.33, 0.50, 0.67, 0.75, 0.90, 1.00, 1.25, 1.50, 1.75, 2.00, 2.50, 3.00, 4.00, 5.00];

    const handleCustomZoomIn = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      const current = cameraEngineRef.current.getState().zoom;
      const next = ZOOM_LEVELS.find((lvl) => lvl > current + 0.005) ?? Math.min(5.0, current * 1.25);
      cameraEngineRef.current.smoothZoomAt((rect?.width || 800) / 2, (rect?.height || 600) / 2, next, 180);
    };
    const handleCustomZoomOut = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      const current = cameraEngineRef.current.getState().zoom;
      const prev = [...ZOOM_LEVELS].reverse().find((lvl) => lvl < current - 0.005) ?? Math.max(0.10, current / 1.25);
      cameraEngineRef.current.smoothZoomAt((rect?.width || 800) / 2, (rect?.height || 600) / 2, prev, 180);
    };
    const handleCustomZoomReset = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      cameraEngineRef.current.smoothZoomAt((rect?.width || 800) / 2, (rect?.height || 600) / 2, 1.0, 200);
    };
    const handleCustomZoomFit = () => {
      const container = containerRef.current;
      if (!container) return;
      const viewportWidth = container.clientWidth;
      const viewportHeight = container.clientHeight;

      if (doc.objects.length === 0) {
        cameraEngineRef.current.smoothZoomAt(viewportWidth / 2, viewportHeight / 2, 1.0, 200);
        return;
      }

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      doc.objects.forEach((obj) => {
        minX = Math.min(minX, obj.x);
        minY = Math.min(minY, obj.y);
        maxX = Math.max(maxX, obj.x + (obj.width || 400));
        maxY = Math.max(maxY, obj.y + (obj.height || 300));
      });

      cameraEngineRef.current.smoothZoomToFit(
        { x: minX, y: minY, width: Math.max(100, maxX - minX), height: Math.max(100, maxY - minY) },
        viewportWidth,
        viewportHeight,
        80,
        240
      );
    };

    const handleFitTable = (e: Event) => {
      const customEvent = e as CustomEvent<AccountingTableObject>;
      const targetTable = customEvent.detail;
      const container = containerRef.current;
      if (!container || !targetTable) return;

      cameraEngineRef.current.smoothZoomToFit(
        {
          x: targetTable.x,
          y: targetTable.y,
          width: targetTable.width,
          height: targetTable.height,
        },
        container.clientWidth,
        container.clientHeight,
        80,
        240
      );
    };

    const handlePaste = (e: ClipboardEvent) => {
      // If user is editing a textarea or input, allow standard text paste
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          (activeEl as HTMLElement).isContentEditable)
      ) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;

          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            if (!dataUrl) return;

            const tempImg = new Image();
            tempImg.onload = () => {
              const naturalW = tempImg.naturalWidth || 400;
              const naturalH = tempImg.naturalHeight || 300;

              const maxDim = 650;
              let imgW = naturalW;
              let imgH = naturalH;
              if (imgW > maxDim || imgH > maxDim) {
                if (imgW > imgH) {
                  imgH = Math.round((imgH * maxDim) / imgW);
                  imgW = maxDim;
                } else {
                  imgW = Math.round((imgW * maxDim) / imgH);
                  imgH = maxDim;
                }
              }

              const container = containerRef.current;
              const screenCenterX = (container?.clientWidth || 800) / 2;
              const screenCenterY = (container?.clientHeight || 600) / 2;
              const docCenter = cameraEngineRef.current.screenToDoc(screenCenterX, screenCenterY);

              const activePage = doc.pages.find((p) => p.id === doc.activePageId) || doc.pages[0];
              const newImage: ImageObject = {
                id: 'image-' + Math.random().toString(36).substring(2, 9),
                pageId: activePage ? activePage.id : null,
                layerId: 'layer-images',
                type: 'image',
                x: Math.round(docCenter.x - imgW / 2),
                y: Math.round(docCenter.y - imgH / 2),
                width: imgW,
                height: imgH,
                src: dataUrl,
                aspectRatio: imgW / imgH,
                originalWidth: naturalW,
                originalHeight: naturalH,
                opacity: 1,
                createdAt: Date.now(),
                updatedAt: Date.now(),
                deviceId: 'local',
              };

              onUpdateDocument(
                {
                  ...doc,
                  objects: [...doc.objects, newImage],
                },
                true
              );
              onSelectIds?.([newImage.id]);
            };
            tempImg.src = dataUrl;
          };
          reader.readAsDataURL(file);
          break;
        }
      }
    };

    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('pointercancel', handlePointerCancel);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('paste', handlePaste);
    window.addEventListener('canvas:zoom-in', handleCustomZoomIn);
    window.addEventListener('canvas:zoom-out', handleCustomZoomOut);
    window.addEventListener('canvas:zoom-reset', handleCustomZoomReset);
    window.addEventListener('canvas:zoom-fit', handleCustomZoomFit);
    window.addEventListener('canvas:fit-table', handleFitTable);

    return () => {
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('pointercancel', handlePointerCancel);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('canvas:zoom-in', handleCustomZoomIn);
      window.removeEventListener('canvas:zoom-out', handleCustomZoomOut);
      window.removeEventListener('canvas:zoom-reset', handleCustomZoomReset);
      window.removeEventListener('canvas:zoom-fit', handleCustomZoomFit);
      window.removeEventListener('canvas:fit-table', handleFitTable);
    };
  }, [doc.objects]);

  const allTableObjects = doc.objects.filter((obj): obj is AccountingTableObject => obj.type === 'table');

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={handleCanvasClick}
      onDoubleClick={handleDoubleClick}
      onDragOver={handleDragOver}
      onPointerLeave={() => {
        cursorPosRef.current = null;
        if (activeTool === 'eraser') {
          if (isDrawingRef.current) {
            isDrawingRef.current = false;
            lastEraserDocPtRef.current = null;
            if (docRedrawRafRef.current !== null) {
              cancelAnimationFrame(docRedrawRafRef.current);
              docRedrawRafRef.current = null;
            }
            if (eraserModifiedRef.current && activeEraserObjectsRef.current) {
              const finalObjs = activeEraserObjectsRef.current;
              eraserModifiedRef.current = false;
              activeEraserObjectsRef.current = null;
              onUpdateDocument({ ...doc, objects: finalObjs }, true);
            } else {
              activeEraserObjectsRef.current = null;
            }
          }
          renderOverlayOnly();
        }
      }}
      className={`relative w-full h-screen overflow-hidden touch-none select-none ${
        activeTool === 'hand'
          ? 'cursor-grab active:cursor-grabbing'
          : activeTool === 'laser' || activeTool === 'eraser' || activeTool === 'frame' || activeTool === 'lasso' || activeTool === 'shape'
          ? 'cursor-crosshair'
          : activeTool === 'bucket'
          ? 'cursor-cell'
          : clickToInkSettings.enabled
          ? 'cursor-crosshair'
          : 'cursor-default'
      }`}
    >
      {/* Layer 0: Interactive Accounting Tables */}
      {allTableObjects.map((tableObj) => {
        const liveTable =
          (activeDragObjectsRef.current?.find((o) => o.id === tableObj.id) as AccountingTableObject) ||
          tableObj;
        return (
          <AccountingTableOverlay
            key={tableObj.id}
            table={liveTable}
            camera={cameraState}
            activeTool={activeTool}
            onSelectTool={onSelectTool}
            isSelected={selectedTableId === tableObj.id}
            onSelect={() => {
              onSelectTable?.(tableObj.id);
            }}
            onUpdateTable={handleUpdateTable}
            onDeleteTable={() => handleDeleteTable(tableObj.id)}
            onDeleteRowWithUndo={onDeleteRowWithUndo}
            allTables={allTableObjects}
            initialFocusedCell={selectedTableId === tableObj.id ? initialFocusedCell : null}
          />
        );
      })}

      {/* Layer 1: Persistent Document Canvas */}
      <canvas ref={docCanvasRef} className="absolute inset-0 block pointer-events-none z-10" />

      {/* Layer 2: Fast Overlay Canvas (<16ms latency) */}
      <canvas ref={overlayCanvasRef} className="absolute inset-0 block pointer-events-none z-20" />

      {/* Drag-and-drop Ghost Preview */}
      {dragGhost && (
        <div
          style={{
            position: 'absolute',
            left: dragGhost.x * cameraState.zoom + cameraState.x,
            top: dragGhost.y * cameraState.zoom + cameraState.y,
            width: dragGhost.width * cameraState.zoom,
            height: dragGhost.height * cameraState.zoom,
            pointerEvents: 'none',
            zIndex: 40,
          }}
          className="rounded-xl border-2 border-dashed border-blue-500 bg-blue-100/40 dark:bg-blue-900/30 flex items-center justify-center p-3 text-blue-700 dark:text-blue-300 font-bold text-xs shadow-xl animate-pulse"
        >
          <span>Drop to place {dragGhost.title}</span>
        </div>
      )}

      {/* Top Floating Hint Bar: Press Esc or Ctrl+Enter to finish editing */}
      {(editingStickyObj || editingTextObj) && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 text-[11px] font-medium text-stone-500 dark:text-stone-400 select-none pointer-events-none flex items-center gap-1.5 bg-white/90 dark:bg-stone-900/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-stone-200/80 dark:border-stone-800 shadow-md animate-in fade-in duration-150">
          <span>Press</span>
          <kbd className="px-1.5 py-0.5 bg-stone-200 dark:bg-stone-800 rounded font-mono text-[10px] font-semibold text-stone-700 dark:text-stone-300">Esc</kbd>
          <span>or</span>
          <kbd className="px-1.5 py-0.5 bg-stone-200 dark:bg-stone-800 rounded font-mono text-[10px] font-semibold text-stone-700 dark:text-stone-300">Ctrl + Enter</kbd>
          <span>to finish editing</span>
        </div>
      )}

      {/* Layer 4: Excalidraw-Style Inline WYSIWYG Text Editor */}
      {editingTextObj && (
        <div
          style={{
            position: 'absolute',
            left: editingTextObj.x * cameraState.zoom + cameraState.x,
            top: editingTextObj.y * cameraState.zoom + cameraState.y,
            zIndex: 60,
          }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <textarea
            ref={(el) => {
              if (el) {
                el.style.height = 'auto';
                el.style.height = `${Math.max(28, el.scrollHeight)}px`;
                el.style.width = 'auto';
                el.style.width = `${Math.max(80, el.scrollWidth + 20)}px`;
              }
            }}
            autoFocus
            defaultValue={editingTextObj.text}
            placeholder=""
            style={{
              fontSize: `${editingTextObj.fontSize * cameraState.zoom}px`,
              lineHeight: 1.35,
              fontFamily: editingTextObj.fontFamily,
              fontWeight: editingTextObj.bold ? '600' : '400',
              fontStyle: editingTextObj.italic ? 'italic' : 'normal',
              textDecoration: editingTextObj.underline ? 'underline' : 'none',
              color: editingTextObj.color,
              caretColor: editingTextObj.color,
              textAlign: editingTextObj.align || 'left',
              opacity: editingTextObj.opacity ?? 1,
              background: 'transparent',
              border: '1px solid rgba(59, 130, 246, 0.5)',
              borderRadius: '3px',
              outline: 'none',
              padding: '0px 4px',
              margin: 0,
              resize: 'none',
              overflow: 'hidden',
              whiteSpace: 'pre',
              wordBreak: 'normal',
              boxSizing: 'border-box',
              display: 'block',
            }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = `${Math.max(28, el.scrollHeight)}px`;
              el.style.width = 'auto';
              el.style.width = `${Math.max(80, el.scrollWidth + 20)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
                e.preventDefault();
                handleCommitText(e.currentTarget.value);
              }
            }}
            onBlur={(e) => {
              // Ignore blur if it occurs immediately after creation (caused by pointerup/click completing on canvas)
              if (performance.now() - textCreationTimeRef.current < 250) {
                e.currentTarget.focus();
                return;
              }
              handleCommitText(e.currentTarget.value);
            }}
          />
        </div>
      )}

      {/* Layer 5: Interactive Sticky Note Inline Editor (Centered, Styled, Excalidraw Image 5) */}
      {editingStickyObj && (
        <div
          style={{
            position: 'absolute',
            left: editingStickyObj.x * cameraState.zoom + cameraState.x,
            top: editingStickyObj.y * cameraState.zoom + cameraState.y,
            width: editingStickyObj.width * cameraState.zoom,
            height: editingStickyObj.height * cameraState.zoom,
            backgroundColor: editingStickyObj.color,
            borderRadius: 14 * cameraState.zoom,
            padding: `${16 * cameraState.zoom}px`,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
            zIndex: 60,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent:
              editingStickyObj.verticalAlign === 'top'
                ? 'flex-start'
                : editingStickyObj.verticalAlign === 'bottom'
                ? 'flex-end'
                : 'center',
          }}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <textarea
            autoFocus
            defaultValue={editingStickyObj.text}
            placeholder=""
            style={{
              width: '100%',
              maxHeight: `${(editingStickyObj.height - 36) * cameraState.zoom}px`,
              fontSize: `${editingStickyObj.fontSize * cameraState.zoom}px`,
              lineHeight: 1.35,
              fontFamily: editingStickyObj.fontFamily || 'Caveat, cursive',
              color: editingStickyObj.textColor || '#1e1e1e',
              caretColor: editingStickyObj.textColor || '#1e1e1e',
              textAlign: editingStickyObj.textAlign || 'center',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              padding: 0,
              margin: 0,
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
                e.preventDefault();
                handleCommitStickyText(e.currentTarget.value);
              }
            }}
            onBlur={(e) => {
              handleCommitStickyText(e.currentTarget.value);
            }}
          />

          {/* Date stamp watermark in bottom-right corner */}
          <span
            style={{
              position: 'absolute',
              right: `${14 * cameraState.zoom}px`,
              bottom: `${10 * cameraState.zoom}px`,
              fontSize: `${11 * cameraState.zoom}px`,
              color: 'rgba(0, 0, 0, 0.45)',
              fontFamily: 'Inter, -apple-system, sans-serif',
              fontWeight: 500,
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {editingStickyObj.dateLabel || new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
        </div>
      )}
    </div>
  );
};
