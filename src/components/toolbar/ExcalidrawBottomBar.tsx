import React from 'react';
import { Minus, Plus, Undo2, Redo2, Maximize2 } from 'lucide-react';

interface ExcalidrawBottomBarProps {
  zoomPercent: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onZoomFit?: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export const ExcalidrawBottomBar: React.FC<ExcalidrawBottomBarProps> = ({
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onZoomFit,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}) => {
  return (
    <div className="fixed bottom-3 left-3 z-50 flex items-center gap-2 select-none pointer-events-auto">
      {/* Pill 1: Zoom Controls */}
      <div className="bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border border-stone-200/80 dark:border-stone-800 rounded-xl shadow-lg p-1 flex items-center gap-0.5 text-xs">
        {/* Zoom Out */}
        <button
          onClick={onZoomOut}
          className="p-1.5 rounded-lg text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          title="Zoom out (Ctrl + -)"
          aria-label="Zoom out"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        {/* Zoom Percent: Clicking resets to 100% */}
        <button
          onClick={onResetZoom}
          className="px-2 py-1 rounded-lg text-stone-700 dark:text-stone-200 font-mono font-bold hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors min-w-[52px] text-center cursor-pointer"
          title="Reset zoom to 100% (Ctrl + 0)"
          aria-label="Reset zoom to 100%"
        >
          {zoomPercent}%
        </button>

        {/* Zoom In */}
        <button
          onClick={onZoomIn}
          className="p-1.5 rounded-lg text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          title="Zoom in (Ctrl + +)"
          aria-label="Zoom in"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>

        {onZoomFit && (
          <button
            onClick={onZoomFit}
            className="p-1.5 rounded-lg text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-800 dark:hover:text-stone-200 transition-colors cursor-pointer"
            title="Zoom to fit all objects (Shift + 1)"
            aria-label="Zoom to fit"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Pill 2: Undo / Redo */}
      <div className="bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border border-stone-200/80 dark:border-stone-800 rounded-xl shadow-lg p-1 flex items-center gap-0.5 text-xs">
        {/* Undo */}
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`p-1.5 rounded-lg transition-colors ${
            canUndo
              ? 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer'
              : 'text-stone-300 dark:text-stone-700 cursor-not-allowed'
          }`}
          title="Undo (Ctrl + Z)"
          aria-label="Undo"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>

        {/* Redo */}
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={`p-1.5 rounded-lg transition-colors ${
            canRedo
              ? 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer'
              : 'text-stone-300 dark:text-stone-700 cursor-not-allowed'
          }`}
          title="Redo (Ctrl + Y)"
          aria-label="Redo"
        >
          <Redo2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
