import React, { useRef, useEffect } from 'react';
import {
  Image as ImageIcon,
  Frame,
  Code2,
  Shapes,
  Sparkles,
  PaintBucket,
  LassoSelect,
  Workflow,
  Check,
} from 'lucide-react';
import { ToolType } from '../../types/document';

interface ExcalidrawMoreToolsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  isDrawToShape: boolean;
  onToggleDrawToShape: () => void;
  onOpenInsertImage: () => void;
  onOpenWebEmbed: () => void;
  onOpenMermaid: () => void;
}

export const ExcalidrawMoreToolsMenu: React.FC<ExcalidrawMoreToolsMenuProps> = ({
  isOpen,
  onClose,
  activeTool,
  onSelectTool,
  isDrawToShape,
  onToggleDrawToShape,
  onOpenInsertImage,
  onOpenWebEmbed,
  onOpenMermaid,
}) => {
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className="absolute top-12 right-0 w-64 bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 py-1.5 text-xs animate-in fade-in zoom-in-95 duration-100 flex flex-col z-50 select-none"
    >
      {/* 1. Insert Image */}
      <button
        onClick={() => {
          onOpenInsertImage();
          onClose();
        }}
        className="px-3.5 py-2 flex items-center justify-between text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <ImageIcon className="w-4 h-4 text-stone-500" />
          <span>Insert image</span>
        </div>
        <span className="text-[10px] text-stone-400 font-mono">9</span>
      </button>

      {/* 2. Frame Tool */}
      <button
        onClick={() => {
          onSelectTool('frame');
          onClose();
        }}
        className={`px-3.5 py-2 flex items-center justify-between transition-colors ${
          activeTool === 'frame'
            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-medium'
            : 'text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <Frame className="w-4 h-4 text-stone-500" />
          <span>Frame tool</span>
        </div>
        <span className="text-[10px] text-stone-400 font-mono">F</span>
      </button>

      {/* 3. Web Embed */}
      <button
        onClick={() => {
          onOpenWebEmbed();
          onClose();
        }}
        className="px-3.5 py-2 flex items-center justify-between text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Code2 className="w-4 h-4 text-stone-500" />
          <span>Web Embed</span>
        </div>
      </button>

      {/* 4. Draw to shape */}
      <button
        onClick={() => {
          onToggleDrawToShape();
          onClose();
        }}
        className={`px-3.5 py-2 flex items-center justify-between transition-colors ${
          isDrawToShape
            ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-medium'
            : 'text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <Shapes className="w-4 h-4 text-stone-500" />
          <div className="flex items-center gap-1.5">
            <span>Draw to shape</span>
            {isDrawToShape && <Check className="w-3 h-3 text-indigo-500" />}
          </div>
        </div>
        <span className="text-[10px] text-stone-400 font-mono">Shift+X</span>
      </button>

      {/* 5. Laser pointer */}
      <button
        onClick={() => {
          onSelectTool('laser');
          onClose();
        }}
        className={`px-3.5 py-2 flex items-center justify-between transition-colors ${
          activeTool === 'laser'
            ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-medium'
            : 'text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-red-500" />
          <span>Laser pointer</span>
        </div>
        <span className="text-[10px] text-stone-400 font-mono">K</span>
      </button>

      {/* 6. Bucket fill */}
      <button
        onClick={() => {
          onSelectTool('bucket');
          onClose();
        }}
        className={`px-3.5 py-2 flex items-center justify-between transition-colors ${
          activeTool === 'bucket'
            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 font-medium'
            : 'text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <PaintBucket className="w-4 h-4 text-stone-500" />
          <span>Bucket fill</span>
        </div>
        <span className="text-[10px] text-stone-400 font-mono">B</span>
      </button>

      {/* 7. Lasso selection */}
      <button
        onClick={() => {
          onSelectTool('lasso');
          onClose();
        }}
        className={`px-3.5 py-2 flex items-center justify-between transition-colors ${
          activeTool === 'lasso'
            ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-medium'
            : 'text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <LassoSelect className="w-4 h-4 text-stone-500" />
          <span>Lasso selection</span>
        </div>
      </button>

      {/* Generate Section Divider */}
      <div className="my-1.5 border-t border-stone-200 dark:border-stone-800" />
      <div className="px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-400">
        Generate
      </div>

      {/* 8. Mermaid to Excalidraw */}
      <button
        onClick={() => {
          onOpenMermaid();
          onClose();
        }}
        className="px-3.5 py-2 flex items-center justify-between text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Workflow className="w-4 h-4 text-indigo-500" />
          <span>Mermaid to Excalidraw</span>
        </div>
      </button>
    </div>
  );
};
