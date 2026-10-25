import React from 'react';
import {
  Lock,
  Unlock,
  Hand,
  MousePointer,
  Square,
  Diamond,
  Circle,
  MoveRight,
  Minus,
  Pen,
  Type,
  StickyNote,
  Image as ImageIcon,
  Eraser,
  Table as TableIcon,
  ChevronDown,
  Frame,
  Sparkles,
  PaintBucket,
  LassoSelect,
} from 'lucide-react';
import { ToolType, ShapeType, PenConfig } from '../../types/document';
import { ExcalidrawMoreToolsMenu } from './ExcalidrawMoreToolsMenu';

interface ExcalidrawTopBarProps {
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  activeShape: ShapeType;
  onSelectShape: (shape: ShapeType) => void;
  activePen: PenConfig;
  onSelectPen: (pen: Partial<PenConfig>) => void;
  isLocked: boolean;
  onToggleLock: () => void;
  onOpenAddFormat: () => void;
  onOpenLibrary: () => void;
  isLibraryOpen: boolean;
  onInsertImage?: () => void;
  isDrawToShape: boolean;
  onToggleDrawToShape: () => void;
  onOpenWebEmbed: () => void;
  onOpenMermaid: () => void;
}

export const ExcalidrawTopBar: React.FC<ExcalidrawTopBarProps> = ({
  activeTool,
  onSelectTool,
  activeShape,
  onSelectShape,
  activePen,
  onSelectPen,
  isLocked,
  onToggleLock,
  onOpenAddFormat,
  onOpenLibrary,
  isLibraryOpen,
  onInsertImage,
  isDrawToShape,
  onToggleDrawToShape,
  onOpenWebEmbed,
  onOpenMermaid,
}) => {
  const [isMoreToolsOpen, setIsMoreToolsOpen] = React.useState(false);

  return (
    <nav aria-label="Drawing and accounting tools" className="fixed top-3 left-1/2 -translate-x-1/2 z-40 flex items-center select-none">
      <div className="bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border border-stone-200 dark:border-stone-800 rounded-xl shadow-lg p-1 flex items-center gap-1 transition-all">
        {/* Lock tool toggle */}
        <button
          onClick={onToggleLock}
          className={`p-2 rounded-lg text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors relative group ${
            isLocked ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400' : ''
          }`}
          title="Tool Lock (keeps selected tool active after drawing)"
        >
          {isLocked ? <Lock className="w-4 h-4 text-blue-600 dark:text-blue-400" /> : <Unlock className="w-4 h-4" />}
        </button>

        <div className="w-px h-5 bg-stone-200 dark:bg-stone-800 mx-0.5" />

        {/* Hand (Pan) */}
        <button
          onClick={() => onSelectTool('hand')}
          className={`p-2 rounded-lg transition-colors relative group ${
            activeTool === 'hand'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 shadow-xs'
              : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
          title="Hand (Paning tool) — H"
        >
          <Hand className="w-4 h-4" />
          <span className="absolute bottom-0.5 right-1 text-[8px] font-mono text-stone-400 opacity-60">H</span>
        </button>

        {/* Selection (Pointer) */}
        <button
          onClick={() => onSelectTool('select')}
          className={`p-2 rounded-lg transition-colors relative group ${
            activeTool === 'select'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 shadow-xs'
              : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
          title="Selection — V or 1"
        >
          <MousePointer className="w-4 h-4" />
          <span className="absolute bottom-0.5 right-1 text-[8px] font-mono text-stone-400 opacity-60">1</span>
        </button>

        {/* Rectangle */}
        <button
          onClick={() => {
            onSelectTool('shape');
            onSelectShape('rectangle');
          }}
          className={`p-2 rounded-lg transition-colors relative group ${
            activeTool === 'shape' && activeShape === 'rectangle'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 shadow-xs'
              : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
          title="Rectangle — R or 2"
        >
          <Square className="w-4 h-4" />
          <span className="absolute bottom-0.5 right-1 text-[8px] font-mono text-stone-400 opacity-60">2</span>
        </button>

        {/* Diamond */}
        <button
          onClick={() => {
            onSelectTool('shape');
            onSelectShape('polygon');
          }}
          className={`p-2 rounded-lg transition-colors relative group ${
            activeTool === 'shape' && activeShape === 'polygon'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 shadow-xs'
              : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
          title="Diamond — D or 3"
        >
          <Diamond className="w-4 h-4" />
          <span className="absolute bottom-0.5 right-1 text-[8px] font-mono text-stone-400 opacity-60">3</span>
        </button>

        {/* Ellipse */}
        <button
          onClick={() => {
            onSelectTool('shape');
            onSelectShape('ellipse');
          }}
          className={`p-2 rounded-lg transition-colors relative group ${
            activeTool === 'shape' && activeShape === 'ellipse'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 shadow-xs'
              : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
          title="Ellipse — O or 4"
        >
          <Circle className="w-4 h-4" />
          <span className="absolute bottom-0.5 right-1 text-[8px] font-mono text-stone-400 opacity-60">4</span>
        </button>

        {/* Arrow */}
        <button
          onClick={() => {
            onSelectTool('shape');
            onSelectShape('arrow');
          }}
          className={`p-2 rounded-lg transition-colors relative group ${
            activeTool === 'shape' && activeShape === 'arrow'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 shadow-xs'
              : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
          title="Arrow — A or 5"
        >
          <MoveRight className="w-4 h-4" />
          <span className="absolute bottom-0.5 right-1 text-[8px] font-mono text-stone-400 opacity-60">5</span>
        </button>

        {/* Line */}
        <button
          onClick={() => {
            onSelectTool('shape');
            onSelectShape('line');
          }}
          className={`p-2 rounded-lg transition-colors relative group ${
            activeTool === 'shape' && activeShape === 'line'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 shadow-xs'
              : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
          title="Line — L or 6"
        >
          <Minus className="w-4 h-4" />
          <span className="absolute bottom-0.5 right-1 text-[8px] font-mono text-stone-400 opacity-60">6</span>
        </button>

        {/* Pen / Draw */}
        <button
          onClick={() => onSelectTool('pen')}
          className={`p-2 rounded-lg transition-colors relative group ${
            activeTool === 'pen'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 shadow-xs'
              : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
          title="Draw / Pen tool — P or 7"
        >
          <Pen className="w-4 h-4" />
          <span className="absolute bottom-0.5 right-1 text-[8px] font-mono text-stone-400 opacity-60">7</span>
        </button>

        {/* Text tool */}
        <button
          onClick={() => onSelectTool('text')}
          className={`p-2 rounded-lg transition-colors relative group ${
            activeTool === 'text'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 shadow-xs'
              : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
          title="Text tool (click canvas to type) — T or 8"
        >
          <Type className="w-4 h-4" />
          <span className="absolute bottom-0.5 right-1 text-[8px] font-mono text-stone-400 opacity-60">8</span>
        </button>

        {/* Sticky Note */}
        <button
          onClick={() => onSelectTool('sticky')}
          className={`p-2 rounded-lg transition-colors relative group ${
            activeTool === 'sticky'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 shadow-xs'
              : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
          title="Sticky note — S"
        >
          <StickyNote className="w-4 h-4 text-amber-500" />
          <span className="absolute bottom-0.5 right-1 text-[8px] font-mono text-stone-400 opacity-60">S</span>
        </button>

        {/* Image Upload */}
        <button
          onClick={() => {
            onSelectTool('image');
            onInsertImage?.();
          }}
          className={`p-2 rounded-lg transition-colors relative group ${
            activeTool === 'image'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 shadow-xs'
              : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
          title="Upload image from device — 9"
        >
          <ImageIcon className="w-4 h-4" />
          <span className="absolute bottom-0.5 right-1 text-[8px] font-mono text-stone-400 opacity-60">9</span>
        </button>

        {/* Eraser */}
        <button
          onClick={() => onSelectTool('eraser')}
          className={`p-2 rounded-lg transition-colors relative group ${
            activeTool === 'eraser'
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 shadow-xs'
              : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
          title="Eraser — E or 0"
        >
          <Eraser className="w-4 h-4" />
          <span className="absolute bottom-0.5 right-1 text-[8px] font-mono text-stone-400 opacity-60">0</span>
        </button>

        {/* Active extra tool indicator if selected from menu */}
        {activeTool === 'frame' && (
          <button
            onClick={() => onSelectTool('frame')}
            className="p-2 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 shadow-xs transition-colors"
            title="Frame tool active — F"
          >
            <Frame className="w-4 h-4" />
          </button>
        )}
        {activeTool === 'laser' && (
          <button
            onClick={() => onSelectTool('laser')}
            className="p-2 rounded-lg bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 shadow-xs transition-colors"
            title="Laser pointer active — K"
          >
            <Sparkles className="w-4 h-4" />
          </button>
        )}
        {activeTool === 'bucket' && (
          <button
            onClick={() => onSelectTool('bucket')}
            className="p-2 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 shadow-xs transition-colors"
            title="Bucket fill active — B"
          >
            <PaintBucket className="w-4 h-4" />
          </button>
        )}
        {activeTool === 'lasso' && (
          <button
            onClick={() => onSelectTool('lasso')}
            className="p-2 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 shadow-xs transition-colors"
            title="Lasso selection active"
          >
            <LassoSelect className="w-4 h-4" />
          </button>
        )}

        <div className="w-px h-5 bg-stone-200 dark:bg-stone-800 mx-0.5" />

        {/* More Tools Dropdown Button */}
        <div className="relative">
          <button
            onClick={() => setIsMoreToolsOpen(!isMoreToolsOpen)}
            className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
              isMoreToolsOpen || ['frame', 'laser', 'bucket', 'lasso'].includes(activeTool)
                ? 'bg-stone-200 dark:bg-stone-700 text-stone-900 dark:text-stone-100'
                : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
            title="More tools (Frame, Web Embed, Draw to shape, Laser, Bucket fill, Lasso, Mermaid)"
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-150 ${isMoreToolsOpen ? 'rotate-180' : ''}`} />
          </button>

          <ExcalidrawMoreToolsMenu
            isOpen={isMoreToolsOpen}
            onClose={() => setIsMoreToolsOpen(false)}
            activeTool={activeTool}
            onSelectTool={onSelectTool}
            isDrawToShape={isDrawToShape}
            onToggleDrawToShape={onToggleDrawToShape}
            onOpenInsertImage={() => onInsertImage?.()}
            onOpenWebEmbed={onOpenWebEmbed}
            onOpenMermaid={onOpenMermaid}
          />
        </div>

        <div className="w-px h-5 bg-stone-200 dark:bg-stone-800 mx-0.5" />

        {/* Accounting Table / Format tool */}
        <button
          onClick={onOpenAddFormat}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-700/80 font-semibold text-xs transition-colors"
          title="Add Accounting Format (Journal, Ledger, Trial Balance, etc.)"
        >
          <TableIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Accounting</span>
        </button>
      </div>
    </nav>
  );
};
