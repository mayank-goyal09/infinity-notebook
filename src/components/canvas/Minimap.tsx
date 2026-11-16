import React, { useRef, useEffect } from 'react';
import { CameraState, PageFrame, CanvasObject } from '../../types/document';
import { ZoomIn, ZoomOut, Maximize, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

interface MinimapProps {
  camera: CameraState;
  pages: PageFrame[];
  objects: CanvasObject[];
  viewportWidth: number;
  viewportHeight: number;
  onNavigateTo: (docX: number, docY: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onZoomFitAll: () => void;
  onFitPageWidth: () => void;
}

export const Minimap: React.FC<MinimapProps> = ({
  camera,
  pages,
  objects,
  viewportWidth,
  viewportHeight,
  onNavigateTo,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onZoomFitAll,
  onFitPageWidth,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  // Scrubby Zoom for minimap zoom controls
  const scrubRef = useRef<{
    isDown: boolean;
    isScrubbing: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
  }>({
    isDown: false,
    isScrubbing: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
  });

  const startScrubbing = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    scrubRef.current = {
      isDown: true,
      isScrubbing: false,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
    };
  };

  const handleScrubMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!scrubRef.current.isDown) return;
    const dx = e.clientX - scrubRef.current.lastX;
    const dy = e.clientY - scrubRef.current.lastY;
    const totalDist = Math.hypot(e.clientX - scrubRef.current.startX, e.clientY - scrubRef.current.startY);

    if (!scrubRef.current.isScrubbing && totalDist > 4) {
      scrubRef.current.isScrubbing = true;
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    }

    if (scrubRef.current.isScrubbing) {
      scrubRef.current.lastX = e.clientX;
      scrubRef.current.lastY = e.clientY;
      const delta = dx - dy * 0.5;
      if (delta !== 0) {
        window.dispatchEvent(new CustomEvent('canvas:zoom-scrub', { detail: { deltaX: delta } }));
      }
    }
  };

  const stopScrubbing = (e?: React.PointerEvent<HTMLButtonElement>) => {
    if (e) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
    if (scrubRef.current.isScrubbing) {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    scrubRef.current.isDown = false;
    scrubRef.current.isScrubbing = false;
  };

  useEffect(() => {
    return () => {
      if (scrubRef.current.isScrubbing) {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || isCollapsed) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#18181b';
    ctx.fillRect(0, 0, w, h);

    // Compute bounding box of all pages
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const p of pages) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + p.width);
      maxY = Math.max(maxY, p.y + p.height);
    }

    if (minX === Infinity) {
      minX = 0;
      minY = 0;
      maxX = 1000;
      maxY = 1200;
    }

    const padding = 200;
    const bboxW = Math.max(800, maxX - minX + padding * 2);
    const bboxH = Math.max(800, maxY - minY + padding * 2);

    const scale = Math.min(w / bboxW, h / bboxH);
    const offsetX = (w - bboxW * scale) / 2 - (minX - padding) * scale;
    const offsetY = (h - bboxH * scale) / 2 - (minY - padding) * scale;

    // Draw Pages
    ctx.fillStyle = '#3f3f46';
    for (const p of pages) {
      ctx.fillRect(
        p.x * scale + offsetX,
        p.y * scale + offsetY,
        p.width * scale,
        p.height * scale
      );
    }

    // Draw Camera Viewport Frustum Box
    const vpDocX = (0 - camera.x) / camera.zoom;
    const vpDocY = (0 - camera.y) / camera.zoom;
    const vpDocW = viewportWidth / camera.zoom;
    const vpDocH = viewportHeight / camera.zoom;

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
    ctx.fillRect(
      vpDocX * scale + offsetX,
      vpDocY * scale + offsetY,
      vpDocW * scale,
      vpDocH * scale
    );
    ctx.strokeRect(
      vpDocX * scale + offsetX,
      vpDocY * scale + offsetY,
      vpDocW * scale,
      vpDocH * scale
    );
  }, [camera, pages, viewportWidth, viewportHeight, isCollapsed]);

  const handleMinimapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of pages) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + p.width);
      maxY = Math.max(maxY, p.y + p.height);
    }
    if (minX === Infinity) {
      minX = 0;
      minY = 0;
      maxX = 1000;
      maxY = 1200;
    }

    const padding = 200;
    const bboxW = Math.max(800, maxX - minX + padding * 2);
    const bboxH = Math.max(800, maxY - minY + padding * 2);
    const scale = Math.min(canvas.width / bboxW, canvas.height / bboxH);
    const offsetX = (canvas.width - bboxW * scale) / 2 - (minX - padding) * scale;
    const offsetY = (canvas.height - bboxH * scale) / 2 - (minY - padding) * scale;

    const targetDocX = (clickX - offsetX) / scale;
    const targetDocY = (clickY - offsetY) / scale;

    onNavigateTo(targetDocX, targetDocY);
  };

  const zoomPercent = Math.round(camera.zoom * 100);

  return (
    <div className="fixed bottom-6 right-6 z-30 flex flex-col items-end select-none">
      {/* Minimap Canvas Container */}
      {!isCollapsed && (
        <div className="mb-2 p-1 bg-stone-900/90 backdrop-blur-md rounded-xl border border-stone-800 shadow-xl overflow-hidden">
          <canvas
            ref={canvasRef}
            width={160}
            height={110}
            onClick={handleMinimapClick}
            className="cursor-crosshair rounded-lg block"
            title="Click to jump camera"
          />
        </div>
      )}

      {/* Floating Zoom Control Bar with Scrubby Zoom */}
      <div className="flex items-center gap-1 bg-white/95 dark:bg-stone-900/95 backdrop-blur-xl px-2 py-1 rounded-xl shadow-lg border border-stone-200 dark:border-stone-800">
        <button
          onClick={onZoomOut}
          onPointerDown={startScrubbing}
          onPointerMove={handleScrubMove}
          onPointerUp={stopScrubbing}
          onPointerCancel={stopScrubbing}
          className="p-1 rounded text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          title="Zoom Out (Ctrl -) • Drag to scrub zoom"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onZoomReset}
          onPointerDown={startScrubbing}
          onPointerMove={handleScrubMove}
          onPointerUp={stopScrubbing}
          onPointerCancel={stopScrubbing}
          className="px-2 py-0.5 text-xs font-mono font-medium text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded transition-colors cursor-pointer"
          title="Reset to 100% (Ctrl+1) • Drag to scrub zoom"
        >
          {zoomPercent}%
        </button>

        <button
          onClick={onZoomIn}
          onPointerDown={startScrubbing}
          onPointerMove={handleScrubMove}
          onPointerUp={stopScrubbing}
          onPointerCancel={stopScrubbing}
          className="p-1 rounded text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          title="Zoom In (Ctrl +) • Drag to scrub zoom"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        <div className="w-[1px] h-4 bg-stone-200 dark:border-stone-800 mx-0.5" />

        <button
          onClick={onZoomFitAll}
          className="p-1 rounded text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          title="Zoom to Fit All (Ctrl+3)"
        >
          <Maximize className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={onFitPageWidth}
          className="p-1 rounded text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          title="Fit Page Width (Ctrl+2)"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 rounded text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
          title={isCollapsed ? 'Show Minimap' : 'Hide Minimap'}
        >
          {isCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};
