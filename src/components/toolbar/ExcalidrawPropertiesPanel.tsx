import React, { useState, useEffect } from 'react';
import {
  ToolType,
  PenConfig,
  CanvasObject,
  StickyNoteObject,
  TextObject,
  ShapeObject,
  ShapeConfig,
} from '../../types/document';
import { DEFAULT_PENS } from '../../engine/penDefaults';
import {
  Check,
  Pen,
  PenTool,
  Feather,
  Paintbrush,
  Highlighter,
  Pencil,
  Sparkles,
  Edit2,
  Compass,
  Eraser,
  Scissors,
  Trash2,
  Type,
  Code,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ArrowDownToLine,
  ArrowDown,
  ArrowUp,
  ArrowUpToLine,
  ChevronLeft,
  ChevronRight,
  Sliders,
  StickyNote,
  Bold,
  Italic,
  Underline,
} from 'lucide-react';

export interface TextConfig {
  fontFamily: string;
  fontSize: number;
  color: string;
  align: 'left' | 'center' | 'right';
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  opacity: number;
}

export interface StickyConfig {
  color: string;
  textColor?: string;
  fontFamily?: string;
  fontSize: number;
  textAlign?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  opacity: number;
}

interface ExcalidrawPropertiesPanelProps {
  isOpen?: boolean;
  onToggle?: () => void;
  activeTool: ToolType;
  activePen: PenConfig;
  onUpdatePen: (updates: Partial<PenConfig>) => void;
  shapeConfig?: ShapeConfig;
  onUpdateShapeConfig?: (updates: Partial<ShapeConfig>) => void;
  textConfig?: TextConfig;
  onUpdateTextConfig?: (updates: Partial<TextConfig>) => void;
  stickyConfig?: StickyConfig;
  onUpdateStickyConfig?: (updates: Partial<StickyConfig>) => void;
  eraserMode?: 'stroke' | 'partial' | 'highlighter_only';
  onChangeEraserMode?: (mode: 'stroke' | 'partial') => void;
  eraserSize?: number;
  onChangeEraserSize?: (size: number) => void;
  clickToInkEnabled?: boolean;
  onToggleClickToInk?: () => void;
  onSendToBack?: () => void;
  onSendBackward?: () => void;
  onBringForward?: () => void;
  onBringToFront?: () => void;
  selectedObject?: CanvasObject | null;
  onUpdateSelectedObject?: (updates: Partial<CanvasObject>) => void;
}

function getBrushIcon(type: string) {
  switch (type) {
    case 'ballpoint':
      return <Pen className="w-4 h-4 text-blue-500" />;
    case 'gel':
      return <PenTool className="w-4 h-4 text-indigo-500" />;
    case 'fineliner':
      return <Edit2 className="w-4 h-4 text-emerald-500" />;
    case 'fountain':
      return <Feather className="w-4 h-4 text-amber-600" />;
    case 'calligraphy':
      return <PenTool className="w-4 h-4 text-rose-600 rotate-45" />;
    case 'brush':
      return <Paintbrush className="w-4 h-4 text-purple-500" />;
    case 'marker':
      return <Highlighter className="w-4 h-4 text-orange-500" />;
    case 'highlighter':
      return <Highlighter className="w-4 h-4 text-yellow-500" />;
    case 'pencil':
      return <Pencil className="w-4 h-4 text-stone-500" />;
    case 'technical':
      return <Compass className="w-4 h-4 text-cyan-600" />;
    case 'airbrush':
      return <Sparkles className="w-4 h-4 text-pink-500" />;
    default:
      return <Pen className="w-4 h-4 text-blue-500" />;
  }
}

function renderStrokePreview(pen: PenConfig, currentColor: string) {
  const isHighlighter = pen.type === 'highlighter';
  const isCalligraphy = pen.type === 'calligraphy';
  const isBrush = pen.type === 'brush';

  return (
    <div className="w-16 h-4 flex items-center justify-center bg-stone-100 dark:bg-stone-800 rounded px-1 shrink-0">
      <div
        style={{
          backgroundColor: currentColor,
          height: isHighlighter ? '10px' : isCalligraphy ? '5px' : isBrush ? '6px' : `${Math.min(10, Math.max(2, pen.size))}px`,
          width: '100%',
          opacity: pen.opacity,
          borderRadius: isHighlighter ? '1px' : '999px',
          transform: isCalligraphy ? 'skewX(-25deg)' : 'none',
        }}
      />
    </div>
  );
}

export const ExcalidrawPropertiesPanel: React.FC<ExcalidrawPropertiesPanelProps> = ({
  isOpen = true,
  onToggle,
  activeTool,
  activePen,
  onUpdatePen,
  shapeConfig = {
    strokeColor: '#1e1e1e',
    fillColor: 'transparent',
    strokeWidth: 2,
    strokeStyle: 'solid',
    fillStyle: 'solid',
    roughness: 0,
    rounded: false,
    opacity: 1,
  },
  onUpdateShapeConfig,
  textConfig = {
    fontFamily: 'Caveat, cursive',
    fontSize: 20,
    color: '#1e1e1e',
    align: 'left',
    opacity: 1,
  },
  onUpdateTextConfig,
  stickyConfig = {
    color: '#fef08a',
    fontSize: 20,
    opacity: 1,
  },
  onUpdateStickyConfig,
  eraserMode = 'stroke',
  onChangeEraserMode,
  eraserSize = 24,
  onChangeEraserSize,
  clickToInkEnabled = false,
  onToggleClickToInk,
  onSendToBack,
  onSendBackward,
  onBringForward,
  onBringToFront,
  selectedObject,
  onUpdateSelectedObject,
}) => {
  const [activeTab, setActiveTab] = useState<'style' | 'brushes'>('style');
  const [hexInput, setHexInput] = useState(activePen.color);

  useEffect(() => {
    setHexInput(activePen.color);
  }, [activePen.color]);

  const selectedSticky = selectedObject?.type === 'sticky' ? (selectedObject as StickyNoteObject) : null;
  const selectedText = selectedObject?.type === 'text' ? (selectedObject as TextObject) : null;
  const selectedShape = selectedObject?.type === 'shape' ? (selectedObject as any) : null;

  const popularColors = [
    '#1e1e1e',
    '#e03131',
    '#2f9e44',
    '#1971c2',
    '#f08c00',
    '#9c36b5',
    '#ec4899',
    '#ffffff',
  ];

  const stickyColors = [
    { label: 'Yellow', value: '#fef08a' },
    { label: 'Green', value: '#bbf7d0' },
    { label: 'Blue', value: '#bae6fd' },
    { label: 'Pink', value: '#fbcfe8' },
    { label: 'Purple', value: '#e9d5ff' },
    { label: 'Orange', value: '#fed7aa' },
  ];

  const strokeWidths = [
    { label: 'S', value: 1.5 },
    { label: 'M', value: 3.5 },
    { label: 'L', value: 7.0 },
    { label: 'XL', value: 16.0 },
  ];

  const fontSizes = [
    { label: 'S', value: 16 },
    { label: 'M', value: 20 },
    { label: 'L', value: 28 },
    { label: 'XL', value: 36 },
  ];

  const handleHexChange = (val: string) => {
    setHexInput(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      if (activeTool === 'text') {
        onUpdateTextConfig?.({ color: val });
      } else {
        onUpdatePen({ color: val });
      }
    }
  };

  const [internalOpen, setInternalOpen] = useState(true);
  const isVisible = onToggle ? isOpen : internalOpen;
  const handleToggle = onToggle || (() => setInternalOpen((prev) => !prev));

  // Collapsed state: Render a sleek unhide button pinned to the left
  if (!isVisible) {
    const hasProperties =
      activeTool === 'pen' ||
      activeTool === 'shape' ||
      activeTool === 'text' ||
      activeTool === 'sticky' ||
      activeTool === 'eraser' ||
      Boolean(selectedObject);

    if (!hasProperties) return null;

    return (
      <button
        onClick={handleToggle}
        className="fixed top-16 left-3 z-30 flex items-center gap-1.5 px-3 py-2 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md rounded-xl shadow-lg border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-blue-600 dark:hover:text-blue-400 transition-all hover:scale-105 select-none text-xs font-semibold group animate-in fade-in duration-100 cursor-pointer"
        title="Show properties sidebar (Unhide)"
        aria-label="Show sidebar"
      >
        <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400 group-hover:rotate-45 transition-transform" />
        <span>Properties</span>
        <ChevronRight className="w-3.5 h-3.5 text-stone-400 group-hover:translate-x-0.5 transition-transform" />
      </button>
    );
  }

  // 1. ERASER SETTINGS PANEL
  if (activeTool === 'eraser') {
    return (
      <div className="fixed top-16 left-3 z-30 w-64 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md rounded-2xl shadow-xl border border-stone-200 dark:border-stone-800 p-3 select-none text-xs flex flex-col gap-3 animate-in fade-in duration-100">
        {/* Collapse Tab on Right Edge */}
        <button
          onClick={handleToggle}
          className="absolute -right-3 top-3 z-40 w-6 h-6 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-full shadow-md flex items-center justify-center text-stone-500 hover:text-stone-800 dark:hover:text-stone-100 hover:scale-110 transition-all cursor-pointer"
          title="Hide sidebar"
          aria-label="Hide sidebar"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-2">
          <div className="flex items-center gap-2">
            <Eraser className="w-4 h-4 text-blue-600" />
            <span className="font-bold text-stone-900 dark:text-stone-100">Eraser Options</span>
          </div>
          <button
            onClick={handleToggle}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-[11px]"
            title="Hide sidebar"
          >
            <span className="text-[10px]">Hide</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        <div>
          <span className="text-stone-500 text-[11px] font-semibold block mb-1.5">Eraser Mode</span>
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => onChangeEraserMode?.('stroke')}
              className={`flex items-center justify-between p-2 rounded-xl border text-left transition-all ${
                eraserMode === 'stroke'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold'
                  : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-500" />
                <div>
                  <div className="text-xs font-semibold">Whole Figure (Object)</div>
                  <div className="text-[10px] text-stone-400 font-normal">Removes entire shape/line on click</div>
                </div>
              </div>
              {eraserMode === 'stroke' && <Check className="w-4 h-4 text-blue-600" />}
            </button>

            <button
              onClick={() => onChangeEraserMode?.('partial')}
              className={`flex items-center justify-between p-2 rounded-xl border text-left transition-all ${
                eraserMode === 'partial'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold'
                  : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Scissors className="w-4 h-4 text-blue-500" />
                <div>
                  <div className="text-xs font-semibold">Precision Drag (Area)</div>
                  <div className="text-[10px] text-stone-400 font-normal">Slices lines and erases as you drag</div>
                </div>
              </div>
              {eraserMode === 'partial' && <Check className="w-4 h-4 text-blue-600" />}
            </button>
          </div>
        </div>

        {/* Eraser Size Controls (for Precision Drag & Area Removal) */}
        <div className="pt-2 border-t border-stone-100 dark:border-stone-800">
          <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400 mb-1.5">
            <span className="font-semibold">Eraser Size</span>
            <span className="font-mono font-bold text-stone-700 dark:text-stone-300">{eraserSize}px</span>
          </div>

          {/* Preset Buttons */}
          <div className="grid grid-cols-4 gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl mb-2">
            {[
              { label: 'S', value: 12 },
              { label: 'M', value: 24 },
              { label: 'L', value: 48 },
              { label: 'XL', value: 72 },
            ].map((preset) => (
              <button
                key={preset.label}
                onClick={() => onChangeEraserSize?.(preset.value)}
                className={`py-1 rounded-lg font-bold text-xs transition-colors ${
                  eraserSize === preset.value
                    ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
                title={`${preset.label} (${preset.value}px)`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Size Slider */}
          <input
            type="range"
            min="6"
            max="120"
            step="2"
            value={eraserSize}
            onChange={(e) => onChangeEraserSize?.(Number(e.target.value))}
            className="w-full accent-blue-600 mb-2"
          />

          {/* Visual Size Preview */}
          <div className="flex items-center justify-center p-2 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200/60 dark:border-stone-800">
            <div
              className="rounded-full border-2 border-dashed border-blue-500 bg-blue-500/10 transition-all duration-75"
              style={{
                width: `${Math.min(56, Math.max(10, eraserSize))}px`,
                height: `${Math.min(56, Math.max(10, eraserSize))}px`,
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // 2. STICKY NOTE PROPERTIES PANEL (Exact Excalidraw UI from Image 5)
  if (activeTool === 'sticky' || (activeTool === 'select' && selectedSticky)) {
    const curColor = selectedSticky?.color || stickyConfig.color || '#fef08a';
    const curTextColor = selectedSticky?.textColor || stickyConfig.textColor || '#1e1e1e';
    const curFontFamily = selectedSticky?.fontFamily || stickyConfig.fontFamily || 'Caveat, cursive';
    const curFontSize = selectedSticky?.fontSize || stickyConfig.fontSize || 20;
    const curAlign = selectedSticky?.textAlign || stickyConfig.textAlign || 'center';
    const curVAlign = selectedSticky?.verticalAlign || stickyConfig.verticalAlign || 'middle';
    const curOpacity = (selectedSticky?.opacity !== undefined ? selectedSticky.opacity : stickyConfig.opacity) ?? 1;

    const handleUpdateSticky = (updates: Partial<StickyNoteObject> & Partial<StickyConfig>) => {
      onUpdateStickyConfig?.(updates);
      if (selectedSticky) {
        onUpdateSelectedObject?.(updates);
      }
    };

    return (
      <div className="fixed top-16 left-3 z-30 w-64 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md rounded-2xl shadow-xl border border-stone-200 dark:border-stone-800 p-3.5 select-none text-xs flex flex-col gap-3 animate-in fade-in duration-100 max-h-[82vh] overflow-y-auto scrollbar-thin">
        {/* Collapse Tab on Right Edge */}
        <button
          onClick={handleToggle}
          className="absolute -right-3 top-3 z-40 w-6 h-6 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-full shadow-md flex items-center justify-center text-stone-500 hover:text-stone-800 dark:hover:text-stone-100 hover:scale-110 transition-all cursor-pointer"
          title="Hide sidebar"
          aria-label="Hide sidebar"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Header with Hide button */}
        <div className="flex items-center justify-between pb-1 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-1.5 font-bold text-stone-700 dark:text-stone-300">
            <StickyNote className="w-3.5 h-3.5 text-amber-500" />
            <span>Sticky Note</span>
          </div>
          <button
            onClick={handleToggle}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-[11px]"
            title="Hide sidebar"
          >
            <span className="text-[10px]">Hide</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 1. Text color */}
        <div>
          <span className="text-stone-500 dark:text-stone-400 text-[11px] font-semibold block mb-1.5">Text color</span>
          <div className="grid grid-cols-5 gap-1.5 mb-2">
            {['#1e1e1e', '#e03131', '#2f9e44', '#1971c2', '#f08c00'].map((color) => (
              <button
                key={color}
                onClick={() => handleUpdateSticky({ textColor: color })}
                className="w-full h-7 rounded-lg border border-stone-200 dark:border-stone-700 flex items-center justify-center transition-transform hover:scale-105"
                style={{ backgroundColor: color }}
              >
                {curTextColor.toLowerCase() === color.toLowerCase() && (
                  <Check className="w-3.5 h-3.5 text-white" />
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 bg-stone-50 dark:bg-stone-800/60 p-1.5 rounded-xl border border-stone-200 dark:border-stone-700">
            <input
              type="color"
              value={curTextColor.startsWith('#') && curTextColor.length === 7 ? curTextColor : '#1e1e1e'}
              onChange={(e) => handleUpdateSticky({ textColor: e.target.value })}
              className="w-7 h-7 rounded cursor-pointer border-none bg-transparent"
              title="Pick custom text color"
            />
            <input
              type="text"
              value={curTextColor}
              onChange={(e) => {
                const val = e.target.value;
                if (/^#[0-9A-Fa-f]{6}$/.test(val)) handleUpdateSticky({ textColor: val });
              }}
              placeholder="#1E1E1E"
              className="w-full bg-transparent border-none outline-none font-mono text-xs uppercase text-stone-800 dark:text-stone-100 font-bold"
            />
          </div>
        </div>

        {/* 2. Background */}
        <div>
          <span className="text-stone-500 dark:text-stone-400 text-[11px] font-semibold block mb-1.5">Background</span>
          <div className="grid grid-cols-6 gap-1.5">
            {[
              { label: 'Yellow', value: '#fef08a' },
              { label: 'Pink', value: '#fbcfe8' },
              { label: 'Green', value: '#bbf7d0' },
              { label: 'Blue', value: '#bae6fd' },
              { label: 'Orange', value: '#fed7aa' },
              { label: 'Gold', value: '#fde047' },
            ].map((sc) => (
              <button
                key={sc.value}
                onClick={() => handleUpdateSticky({ color: sc.value })}
                className="h-7 rounded-lg border border-black/10 flex items-center justify-center font-bold text-stone-800 transition-transform hover:scale-105 shadow-xs"
                style={{ backgroundColor: sc.value }}
                title={sc.label}
              >
                {curColor.toLowerCase() === sc.value.toLowerCase() && (
                  <Check className="w-3.5 h-3.5 text-stone-800" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Font family */}
        <div>
          <span className="text-stone-500 dark:text-stone-400 text-[11px] font-semibold block mb-1.5">Font family</span>
          <div className="grid grid-cols-4 gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
            <button
              onClick={() => handleUpdateSticky({ fontFamily: 'Caveat, cursive' })}
              className={`py-1.5 flex items-center justify-center rounded-lg font-semibold text-xs transition-colors ${
                curFontFamily.includes('Caveat')
                  ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
              title="Handwriting"
            >
              <Pen className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleUpdateSticky({ fontFamily: 'Inter, sans-serif' })}
              className={`py-1.5 flex items-center justify-center rounded-lg font-semibold text-xs transition-colors ${
                curFontFamily.includes('Inter')
                  ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
              title="Normal / Sans"
            >
              <span className="font-sans font-bold text-xs">A</span>
            </button>
            <button
              onClick={() => handleUpdateSticky({ fontFamily: 'monospace' })}
              className={`py-1.5 flex items-center justify-center rounded-lg font-semibold text-xs transition-colors ${
                curFontFamily.includes('monospace')
                  ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
              title="Code / Monospace"
            >
              <Code className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleUpdateSticky({ fontFamily: 'Georgia, serif' })}
              className={`py-1.5 flex items-center justify-center rounded-lg font-semibold text-xs transition-colors ${
                curFontFamily.includes('Georgia')
                  ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
              title="Serif"
            >
              <span className="font-serif font-bold text-xs">A</span>
            </button>
          </div>
        </div>

        {/* 4. Font size */}
        <div>
          <span className="text-stone-500 dark:text-stone-400 text-[11px] font-semibold block mb-1.5">Font size</span>
          <div className="grid grid-cols-4 gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
            {fontSizes.map((s) => (
              <button
                key={s.label}
                onClick={() => handleUpdateSticky({ fontSize: s.value })}
                className={`py-1 rounded-lg font-bold text-xs transition-colors ${
                  curFontSize === s.value
                    ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* 5. Text align */}
        <div>
          <span className="text-stone-500 dark:text-stone-400 text-[11px] font-semibold block mb-1.5">Text align</span>
          <div className="grid grid-cols-3 gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
            <button
              onClick={() => handleUpdateSticky({ textAlign: 'left' })}
              className={`py-1.5 flex items-center justify-center rounded-lg transition-colors ${
                curAlign === 'left'
                  ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
              title="Align Left"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleUpdateSticky({ textAlign: 'center' })}
              className={`py-1.5 flex items-center justify-center rounded-lg transition-colors ${
                curAlign === 'center'
                  ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
              title="Align Center"
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleUpdateSticky({ textAlign: 'right' })}
              className={`py-1.5 flex items-center justify-center rounded-lg transition-colors ${
                curAlign === 'right'
                  ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
              title="Align Right"
            >
              <AlignRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 6. Vertical align */}
        <div>
          <span className="text-stone-500 dark:text-stone-400 text-[11px] font-semibold block mb-1.5">Vertical align</span>
          <div className="grid grid-cols-3 gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
            <button
              onClick={() => handleUpdateSticky({ verticalAlign: 'top' })}
              className={`py-1.5 flex items-center justify-center rounded-lg transition-colors ${
                curVAlign === 'top'
                  ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
              title="Align Top"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 2h12v2H2z M4 6h8v3H4z" />
              </svg>
            </button>
            <button
              onClick={() => handleUpdateSticky({ verticalAlign: 'middle' })}
              className={`py-1.5 flex items-center justify-center rounded-lg transition-colors ${
                curVAlign === 'middle'
                  ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
              title="Align Middle"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 7.5h12v1H2z M4 4h8v8H4z" />
              </svg>
            </button>
            <button
              onClick={() => handleUpdateSticky({ verticalAlign: 'bottom' })}
              className={`py-1.5 flex items-center justify-center rounded-lg transition-colors ${
                curVAlign === 'bottom'
                  ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
              title="Align Bottom"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 12h12v2H2z M4 7h8v3H4z" />
              </svg>
            </button>
          </div>
        </div>

        {/* 7. Opacity */}
        <div>
          <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400 mb-1">
            <span>Opacity</span>
            <span>{Math.round(curOpacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.2"
            max="1.0"
            step="0.05"
            value={curOpacity}
            onChange={(e) => handleUpdateSticky({ opacity: Number(e.target.value) })}
            className="w-full accent-blue-600"
          />
        </div>

        {/* 8. Layers */}
        <div>
          <span className="text-stone-500 dark:text-stone-400 text-[11px] font-semibold block mb-1.5">Layers</span>
          <div className="grid grid-cols-4 gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
            <button
              onClick={onSendToBack}
              className="py-1.5 flex items-center justify-center rounded-lg text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
              title="Send to back"
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onSendBackward}
              className="py-1.5 flex items-center justify-center rounded-lg text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
              title="Send backward"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onBringForward}
              className="py-1.5 flex items-center justify-center rounded-lg text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
              title="Bring forward"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onBringToFront}
              className="py-1.5 flex items-center justify-center rounded-lg text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
              title="Bring to front"
            >
              <ArrowUpToLine className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. TEXT PROPERTIES PANEL (Exact Excalidraw UI from Image 3)
  if (activeTool === 'text' || (activeTool === 'select' && selectedText)) {
    const curColor = selectedText?.color || textConfig.color || '#1e1e1e';
    const curFontFamily = selectedText?.fontFamily || textConfig.fontFamily || 'Caveat, cursive';
    const curFontSize = selectedText?.fontSize || textConfig.fontSize || 20;
    const curAlign = selectedText?.align || textConfig.align || 'left';
    const curBold = selectedText?.bold ?? textConfig.bold ?? false;
    const curItalic = selectedText?.italic ?? textConfig.italic ?? false;
    const curUnderline = selectedText?.underline ?? textConfig.underline ?? false;
    const curOpacity = (selectedText?.opacity !== undefined ? selectedText.opacity : textConfig.opacity) ?? 1;

    const handleUpdateText = (updates: Partial<TextObject> & Partial<TextConfig>) => {
      onUpdateTextConfig?.(updates);
      if (selectedText) {
        onUpdateSelectedObject?.(updates);
      }
    };

    return (
      <div className="fixed top-16 left-3 z-30 w-64 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md rounded-2xl shadow-xl border border-stone-200 dark:border-stone-800 p-3.5 select-none text-xs flex flex-col gap-3 animate-in fade-in duration-100">
        {/* Collapse Tab on Right Edge */}
        <button
          onClick={handleToggle}
          className="absolute -right-3 top-3 z-40 w-6 h-6 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-full shadow-md flex items-center justify-center text-stone-500 hover:text-stone-800 dark:hover:text-stone-100 hover:scale-110 transition-all cursor-pointer"
          title="Hide sidebar"
          aria-label="Hide sidebar"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Header with Hide button */}
        <div className="flex items-center justify-between pb-1 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-1.5 font-bold text-stone-700 dark:text-stone-300">
            <Type className="w-3.5 h-3.5 text-blue-600" />
            <span>Text Options</span>
          </div>
          <button
            onClick={handleToggle}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-[11px]"
            title="Hide sidebar"
          >
            <span className="text-[10px]">Hide</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Stroke / Text Color */}
        <div>
          <span className="text-stone-500 dark:text-stone-400 text-[11px] font-semibold block mb-1.5">Stroke</span>
          <div className="grid grid-cols-4 gap-1.5 mb-2">
            {popularColors.map((color) => (
              <button
                key={color}
                onClick={() => handleUpdateText({ color })}
                className="w-full h-7 rounded-lg border border-stone-200 dark:border-stone-700 flex items-center justify-center transition-transform hover:scale-105 cursor-pointer"
                style={{ backgroundColor: color }}
              >
                {curColor.toLowerCase() === color.toLowerCase() && (
                  <Check
                    className={`w-3.5 h-3.5 ${
                      color === '#ffffff' || color === '#f08c00' ? 'text-black' : 'text-white'
                    }`}
                  />
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 bg-stone-50 dark:bg-stone-800/60 p-1.5 rounded-xl border border-stone-200 dark:border-stone-700">
            <input
              type="color"
              value={curColor.startsWith('#') && curColor.length === 7 ? curColor : '#1e1e1e'}
              onChange={(e) => handleUpdateText({ color: e.target.value })}
              className="w-7 h-7 rounded cursor-pointer border-none bg-transparent"
              title="Pick custom color"
            />
            <input
              type="text"
              value={curColor}
              onChange={(e) => {
                const val = e.target.value;
                if (/^#[0-9A-Fa-f]{6}$/.test(val)) handleUpdateText({ color: val });
              }}
              placeholder="#1E1E1E"
              className="w-full bg-transparent border-none outline-none font-mono text-xs uppercase text-stone-800 dark:text-stone-100 font-bold"
            />
          </div>
        </div>

        {/* Font Family (Handwriting, Normal, Code, Serif - Exactly like Excalidraw) */}
        <div>
          <span className="text-stone-500 dark:text-stone-400 text-[11px] font-semibold block mb-1.5">Font family</span>
          <div className="grid grid-cols-4 gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
            <button
              onClick={() => handleUpdateText({ fontFamily: 'Caveat, cursive' })}
              className={`py-1.5 flex items-center justify-center rounded-lg font-semibold text-xs transition-colors cursor-pointer ${
                curFontFamily.includes('Caveat')
                  ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
              title="Handwriting (Virgil)"
            >
              <Pen className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => handleUpdateText({ fontFamily: 'Inter, -apple-system, sans-serif' })}
              className={`py-1.5 flex items-center justify-center rounded-lg font-semibold text-xs transition-colors cursor-pointer ${
                curFontFamily.includes('Inter')
                  ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
              title="Normal (Helvetica)"
            >
              <span className="font-sans font-bold text-xs">A</span>
            </button>

            <button
              onClick={() => handleUpdateText({ fontFamily: "'Fira Code', 'Courier New', monospace" })}
              className={`py-1.5 flex items-center justify-center rounded-lg font-semibold text-xs transition-colors cursor-pointer ${
                curFontFamily.includes('monospace') || curFontFamily.includes('Fira Code')
                  ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
              title="Code / Monospace"
            >
              <Code className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => handleUpdateText({ fontFamily: "'Newsreader', Georgia, serif" })}
              className={`py-1.5 flex items-center justify-center rounded-lg font-semibold text-xs transition-colors cursor-pointer ${
                curFontFamily.includes('Newsreader') || curFontFamily.includes('serif')
                  ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
              title="Serif"
            >
              <span className="font-serif font-bold text-xs">A</span>
            </button>
          </div>
        </div>

        {/* Font Size (S, M, L, XL) */}
        <div>
          <span className="text-stone-500 dark:text-stone-400 text-[11px] font-semibold block mb-1.5">Font size</span>
          <div className="grid grid-cols-4 gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
            {fontSizes.map((s) => (
              <button
                key={s.label}
                onClick={() => handleUpdateText({ fontSize: s.value })}
                className={`py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                  curFontSize === s.value
                    ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Style / Formatting (Bold, Italic, Underline) - Exactly like Excalidraw */}
        <div>
          <span className="text-stone-500 dark:text-stone-400 text-[11px] font-semibold block mb-1.5">Style</span>
          <div className="grid grid-cols-3 gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
            <button
              onClick={() => handleUpdateText({ bold: !curBold })}
              className={`py-1.5 flex items-center justify-center rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                curBold
                  ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
              title="Bold"
              aria-label="Bold"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => handleUpdateText({ italic: !curItalic })}
              className={`py-1.5 flex items-center justify-center rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                curItalic
                  ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
              title="Italic"
              aria-label="Italic"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => handleUpdateText({ underline: !curUnderline })}
              className={`py-1.5 flex items-center justify-center rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                curUnderline
                  ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
              title="Underline"
              aria-label="Underline"
            >
              <Underline className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Text Align (Left, Center, Right) */}
        <div>
          <span className="text-stone-500 dark:text-stone-400 text-[11px] font-semibold block mb-1.5">Text align</span>
          <div className="grid grid-cols-3 gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
            <button
              onClick={() => handleUpdateText({ align: 'left' })}
              className={`py-1.5 flex items-center justify-center rounded-lg transition-colors ${
                curAlign === 'left'
                  ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
              title="Align Left"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => handleUpdateText({ align: 'center' })}
              className={`py-1.5 flex items-center justify-center rounded-lg transition-colors ${
                curAlign === 'center'
                  ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
              title="Align Center"
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => handleUpdateText({ align: 'right' })}
              className={`py-1.5 flex items-center justify-center rounded-lg transition-colors ${
                curAlign === 'right'
                  ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
              title="Align Right"
            >
              <AlignRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Opacity */}
        <div>
          <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400 mb-1">
            <span>Opacity</span>
            <span>{Math.round(curOpacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={curOpacity}
            onChange={(e) => handleUpdateText({ opacity: Number(e.target.value) })}
            className="w-full accent-blue-600"
          />
        </div>

        {/* Layers */}
        <div>
          <span className="text-stone-500 dark:text-stone-400 text-[11px] font-semibold block mb-1.5">Layers</span>
          <div className="grid grid-cols-4 gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
            <button
              onClick={onSendToBack}
              className="py-1.5 flex items-center justify-center rounded-lg text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
              title="Send to back"
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onSendBackward}
              className="py-1.5 flex items-center justify-center rounded-lg text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
              title="Send backward"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onBringForward}
              className="py-1.5 flex items-center justify-center rounded-lg text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
              title="Bring forward"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onBringToFront}
              className="py-1.5 flex items-center justify-center rounded-lg text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
              title="Bring to front"
            >
              <ArrowUpToLine className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 4. SHAPE PROPERTIES PANEL (Excalidraw Left Toolbar matching user reference)
  if (activeTool === 'shape' || (activeTool === 'select' && selectedShape)) {
    const curStrokeColor = selectedShape?.strokeColor || shapeConfig.strokeColor;
    const curFillColor = selectedShape?.fillColor ?? shapeConfig.fillColor;
    const curFillStyle = selectedShape?.fillStyle || shapeConfig.fillStyle || 'solid';
    const curStrokeWidth = selectedShape?.strokeWidth || shapeConfig.strokeWidth || 2;
    const curStrokeStyle = selectedShape?.strokeStyle || shapeConfig.strokeStyle || 'solid';
    const curRoughness = selectedShape?.roughness ?? shapeConfig.roughness ?? 0;
    const curRounded = selectedShape
      ? selectedShape.shapeType === 'rounded_rect'
      : shapeConfig.rounded;
    const curOpacity = selectedShape?.opacity ?? shapeConfig.opacity ?? 1;

    const handleUpdateShape = (updates: Partial<ShapeConfig>) => {
      onUpdateShapeConfig?.(updates);
      if (selectedShape) {
        const objUpdates: Partial<ShapeObject> = {};
        if (updates.strokeColor !== undefined) objUpdates.strokeColor = updates.strokeColor;
        if (updates.fillColor !== undefined) objUpdates.fillColor = updates.fillColor;
        if (updates.fillStyle !== undefined) objUpdates.fillStyle = updates.fillStyle;
        if (updates.strokeWidth !== undefined) objUpdates.strokeWidth = updates.strokeWidth;
        if (updates.strokeStyle !== undefined) objUpdates.strokeStyle = updates.strokeStyle;
        if (updates.roughness !== undefined) objUpdates.roughness = updates.roughness;
        if (updates.opacity !== undefined) objUpdates.opacity = updates.opacity;
        if (updates.rounded !== undefined) {
          if (selectedShape.shapeType === 'rectangle' || selectedShape.shapeType === 'rounded_rect') {
            objUpdates.shapeType = updates.rounded ? 'rounded_rect' : 'rectangle';
          }
        }
        onUpdateSelectedObject?.(objUpdates);
      }
    };

    const strokeColors = ['#1e1e1e', '#e03131', '#2f9e44', '#1971c2', '#f08c00'];
    const bgColors = ['transparent', '#ffc9c9', '#b2f2bb', '#a5d8ff', '#ffec99'];

    return (
      <div className="fixed top-16 left-3 z-30 w-64 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md rounded-2xl shadow-xl border border-stone-200 dark:border-stone-800 p-3 select-none text-xs flex flex-col gap-3 animate-in fade-in duration-100 max-h-[calc(100vh-80px)] overflow-y-auto scrollbar-thin">
        {/* Collapse Tab on Right Edge */}
        <button
          onClick={handleToggle}
          className="absolute -right-3 top-3 z-40 w-6 h-6 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-full shadow-md flex items-center justify-center text-stone-500 hover:text-stone-800 dark:hover:text-stone-100 hover:scale-110 transition-all cursor-pointer"
          title="Hide sidebar"
          aria-label="Hide sidebar"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Header with Hide button */}
        <div className="flex items-center justify-between pb-1 border-b border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-1.5 font-bold text-stone-700 dark:text-stone-300">
            <Sliders className="w-3.5 h-3.5 text-blue-600" />
            <span>Shape Options</span>
          </div>
          <button
            onClick={handleToggle}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-[11px]"
            title="Hide sidebar"
          >
            <span className="text-[10px]">Hide</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Stroke Section */}
        <div>
          <span className="text-stone-500 dark:text-stone-400 text-[11px] font-semibold block mb-1.5">Stroke</span>
          <div className="flex items-center gap-1.5 mb-2">
            {strokeColors.map((color) => (
              <button
                key={color}
                onClick={() => handleUpdateShape({ strokeColor: color })}
                className="w-7 h-7 rounded-lg border border-stone-200 dark:border-stone-700 flex items-center justify-center transition-transform hover:scale-105"
                style={{ backgroundColor: color }}
              >
                {curStrokeColor.toLowerCase() === color.toLowerCase() && (
                  <Check className="w-3.5 h-3.5 text-white" />
                )}
              </button>
            ))}
            {/* Custom Stroke Color Picker */}
            <label
              className="w-7 h-7 rounded-lg border border-stone-200 dark:border-stone-700 flex items-center justify-center cursor-pointer relative overflow-hidden bg-stone-100 dark:bg-stone-800 hover:scale-105 transition-transform"
              title="Custom stroke color"
            >
              <input
                type="color"
                value={curStrokeColor.startsWith('#') && curStrokeColor.length === 7 ? curStrokeColor : '#1e1e1e'}
                onChange={(e) => handleUpdateShape({ strokeColor: e.target.value })}
                className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
              />
              <div
                className="w-3.5 h-3.5 rounded-full border border-stone-300 dark:border-stone-600"
                style={{ backgroundColor: curStrokeColor }}
              />
            </label>
          </div>
        </div>

        {/* Background (Fill Color) Section */}
        <div>
          <span className="text-stone-500 dark:text-stone-400 text-[11px] font-semibold block mb-1.5">Background</span>
          <div className="flex items-center gap-1.5 mb-2">
            {bgColors.map((color) => {
              const isTransparent = color === 'transparent';
              const isSelected = isTransparent
                ? curFillColor === 'transparent' || !curFillColor
                : curFillColor.toLowerCase() === color.toLowerCase();
              return (
                <button
                  key={color}
                  onClick={() => handleUpdateShape({ fillColor: color })}
                  className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-transform hover:scale-105 relative overflow-hidden ${
                    isSelected ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-stone-200 dark:border-stone-700'
                  }`}
                  style={{ backgroundColor: isTransparent ? 'transparent' : color }}
                  title={isTransparent ? 'Transparent / None' : color}
                >
                  {isTransparent ? (
                    <div className="w-full h-[1.5px] bg-red-500 rotate-45" />
                  ) : (
                    isSelected && <Check className="w-3.5 h-3.5 text-stone-800" />
                  )}
                </button>
              );
            })}
            {/* Custom Background Color Picker */}
            <label
              className="w-7 h-7 rounded-lg border border-stone-200 dark:border-stone-700 flex items-center justify-center cursor-pointer relative overflow-hidden bg-stone-100 dark:bg-stone-800 hover:scale-105 transition-transform"
              title="Custom fill color"
            >
              <input
                type="color"
                value={curFillColor.startsWith('#') && curFillColor.length === 7 ? curFillColor : '#ffec99'}
                onChange={(e) => handleUpdateShape({ fillColor: e.target.value })}
                className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
              />
              <div
                className="w-3.5 h-3.5 rounded-full border border-stone-300 dark:border-stone-600"
                style={{ backgroundColor: curFillColor === 'transparent' ? '#ffffff' : curFillColor }}
              />
            </label>
          </div>
        </div>

        {/* Fill Style Section (Hachure, Cross-hatch, Solid) */}
        <div>
          <span className="text-stone-500 dark:text-stone-400 text-[11px] font-semibold block mb-1.5">Fill</span>
          <div className="grid grid-cols-3 gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
            <button
              onClick={() => handleUpdateShape({ fillStyle: 'hachure' })}
              className={`py-1.5 flex items-center justify-center rounded-lg transition-colors ${
                curFillStyle === 'hachure'
                  ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
              title="Hachure"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="4" y1="20" x2="20" y2="4" />
                <line x1="4" y1="12" x2="12" y2="4" />
                <line x1="12" y1="20" x2="20" y2="12" />
              </svg>
            </button>
            <button
              onClick={() => handleUpdateShape({ fillStyle: 'cross-hatch' })}
              className={`py-1.5 flex items-center justify-center rounded-lg transition-colors ${
                curFillStyle === 'cross-hatch'
                  ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
              title="Cross-hatch"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <line x1="4" y1="20" x2="20" y2="4" />
                <line x1="4" y1="12" x2="12" y2="4" />
                <line x1="12" y1="20" x2="20" y2="12" />
                <line x1="4" y1="4" x2="20" y2="20" />
                <line x1="12" y1="4" x2="20" y2="12" />
                <line x1="4" y1="12" x2="12" y2="20" />
              </svg>
            </button>
            <button
              onClick={() => handleUpdateShape({ fillStyle: 'solid' })}
              className={`py-1.5 flex items-center justify-center rounded-lg transition-colors ${
                curFillStyle === 'solid'
                  ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
              title="Solid"
            >
              <div className="w-3.5 h-3.5 rounded-xs bg-current" />
            </button>
          </div>
        </div>

        {/* Stroke Width Section */}
        <div>
          <span className="text-stone-500 dark:text-stone-400 text-[11px] font-semibold block mb-1.5">Stroke width</span>
          <div className="grid grid-cols-3 gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
            {[
              { label: 'Thin', value: 1.5, h: 'h-[1.5px]' },
              { label: 'Medium', value: 3.5, h: 'h-[3px]' },
              { label: 'Bold', value: 7.0, h: 'h-[5.5px]' },
            ].map((sw) => (
              <button
                key={sw.label}
                onClick={() => handleUpdateShape({ strokeWidth: sw.value })}
                className={`py-2 flex items-center justify-center rounded-lg transition-colors ${
                  curStrokeWidth === sw.value
                    ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
                title={sw.label}
              >
                <div className={`w-5 ${sw.h} bg-current rounded-full`} />
              </button>
            ))}
          </div>
        </div>

        {/* Stroke Style Section */}
        <div>
          <span className="text-stone-500 dark:text-stone-400 text-[11px] font-semibold block mb-1.5">Stroke style</span>
          <div className="grid grid-cols-3 gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
            <button
              onClick={() => handleUpdateShape({ strokeStyle: 'solid' })}
              className={`py-2 flex items-center justify-center rounded-lg transition-colors ${
                curStrokeStyle === 'solid'
                  ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
              title="Solid"
            >
              <div className="w-5 h-[2px] bg-current rounded-full" />
            </button>
            <button
              onClick={() => handleUpdateShape({ strokeStyle: 'dashed' })}
              className={`py-2 flex items-center justify-center rounded-lg transition-colors ${
                curStrokeStyle === 'dashed'
                  ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
              title="Dashed"
            >
              <div className="w-5 border-t-2 border-dashed border-current" />
            </button>
            <button
              onClick={() => handleUpdateShape({ strokeStyle: 'dotted' })}
              className={`py-2 flex items-center justify-center rounded-lg transition-colors ${
                curStrokeStyle === 'dotted'
                  ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
              title="Dotted"
            >
              <div className="w-5 border-t-2 border-dotted border-current" />
            </button>
          </div>
        </div>

        {/* Sloppiness Section */}
        <div>
          <span className="text-stone-500 dark:text-stone-400 text-[11px] font-semibold block mb-1.5">Sloppiness</span>
          <div className="grid grid-cols-3 gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
            {[
              { label: 'Architect', value: 0, icon: '📐' },
              { label: 'Artist', value: 1, icon: '〰️' },
              { label: 'Cartoonist', value: 2, icon: '🌀' },
            ].map((sl) => (
              <button
                key={sl.label}
                onClick={() => handleUpdateShape({ roughness: sl.value })}
                className={`py-1.5 flex items-center justify-center gap-1 rounded-lg transition-colors text-xs font-semibold ${
                  curRoughness === sl.value
                    ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
                title={sl.label}
              >
                <span>{sl.icon}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Edges Section (Sharp vs Rounded) */}
        <div>
          <span className="text-stone-500 dark:text-stone-400 text-[11px] font-semibold block mb-1.5">Edges</span>
          <div className="grid grid-cols-2 gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
            <button
              onClick={() => handleUpdateShape({ rounded: false })}
              className={`py-1.5 flex items-center justify-center rounded-lg transition-colors ${
                !curRounded
                  ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
              title="Sharp edges"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="4" width="16" height="16" rx="0" />
              </svg>
            </button>
            <button
              onClick={() => handleUpdateShape({ rounded: true })}
              className={`py-1.5 flex items-center justify-center rounded-lg transition-colors ${
                curRounded
                  ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
              title="Round edges"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="4" y="4" width="16" height="16" rx="5" />
              </svg>
            </button>
          </div>
        </div>

        {/* Opacity */}
        <div>
          <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-stone-400 mb-1">
            <span>Opacity</span>
            <span>{Math.round(curOpacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={curOpacity}
            onChange={(e) => handleUpdateShape({ opacity: Number(e.target.value) })}
            className="w-full accent-blue-600"
          />
        </div>

        {/* Layers */}
        <div>
          <span className="text-stone-500 dark:text-stone-400 text-[11px] font-semibold block mb-1.5">Layers</span>
          <div className="grid grid-cols-4 gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
            <button
              onClick={onSendToBack}
              className="py-1.5 flex items-center justify-center rounded-lg text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
              title="Send to back"
            >
              <ArrowDownToLine className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onSendBackward}
              className="py-1.5 flex items-center justify-center rounded-lg text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
              title="Send backward"
            >
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onBringForward}
              className="py-1.5 flex items-center justify-center rounded-lg text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
              title="Bring forward"
            >
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onBringToFront}
              className="py-1.5 flex items-center justify-center rounded-lg text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
              title="Bring to front"
            >
              <ArrowUpToLine className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 5. PEN PROPERTIES PANEL
  if (activeTool !== 'pen') {
    return null;
  }

  return (
    <div className="fixed top-16 left-3 z-30 w-72 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md rounded-2xl shadow-xl border border-stone-200 dark:border-stone-800 p-3 select-none text-xs flex flex-col gap-3 animate-in fade-in duration-100">
      {/* Collapse Tab on Right Edge */}
      <button
        onClick={handleToggle}
        className="absolute -right-3 top-3 z-40 w-6 h-6 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-full shadow-md flex items-center justify-center text-stone-500 hover:text-stone-800 dark:hover:text-stone-100 hover:scale-110 transition-all cursor-pointer"
        title="Hide sidebar"
        aria-label="Hide sidebar"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>

      {/* Subtabs for Pen */}
      {activeTool === 'pen' && (
        <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('style')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'style'
                  ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              Stroke & Color
            </button>
            <button
              onClick={() => setActiveTab('brushes')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'brushes'
                  ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              Brushes ({DEFAULT_PENS.length})
            </button>
          </div>
          <button
            onClick={handleToggle}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-[11px]"
            title="Hide sidebar"
          >
            <span className="text-[10px]">Hide</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Tab: Brushes list */}
      {activeTool === 'pen' && activeTab === 'brushes' ? (
        <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto pr-1 scrollbar-thin">
          <span className="text-[11px] font-semibold text-stone-500 mb-0.5">Select Brush Tip:</span>
          {DEFAULT_PENS.map((pen) => {
            const isSelected = activePen.type === pen.type;
            return (
              <button
                key={pen.id}
                onClick={() =>
                  onUpdatePen({
                    type: pen.type,
                    size: pen.size,
                    opacity: pen.opacity,
                    smoothing: pen.smoothing,
                  })
                }
                className={`flex items-center justify-between px-2.5 py-2 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold shadow-xs'
                    : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1 rounded-lg bg-stone-100 dark:bg-stone-800 shrink-0">
                    {getBrushIcon(pen.type)}
                  </div>
                  <span className="truncate text-xs">{pen.name}</span>
                </div>
                {renderStrokePreview(pen, activePen.color)}
              </button>
            );
          })}
        </div>
      ) : (
        <>
          {/* Stroke Colors Swatches */}
          <div>
            <span className="text-stone-500 text-[11px] font-semibold block mb-1.5">Preset Colors</span>
            <div className="grid grid-cols-4 gap-1.5 mb-2">
              {popularColors.map((color) => (
                <button
                  key={color}
                  onClick={() => {
                    onUpdatePen({ color });
                    setHexInput(color);
                  }}
                  className="w-full h-7 rounded-lg border border-stone-200 dark:border-stone-700 flex items-center justify-center transition-transform hover:scale-105"
                  style={{ backgroundColor: color }}
                >
                  {activePen.color.toLowerCase() === color.toLowerCase() && (
                    <Check
                      className={`w-3.5 h-3.5 ${
                        color === '#ffffff' || color === '#f08c00' ? 'text-black' : 'text-white'
                      }`}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Custom Hex Color Picker */}
            <div className="flex items-center gap-1.5 bg-stone-50 dark:bg-stone-800/60 p-1.5 rounded-xl border border-stone-200 dark:border-stone-700">
              <input
                type="color"
                value={activePen.color.startsWith('#') && activePen.color.length === 7 ? activePen.color : '#2563eb'}
                onChange={(e) => {
                  const val = e.target.value;
                  onUpdatePen({ color: val });
                  setHexInput(val);
                }}
                className="w-7 h-7 rounded cursor-pointer border-none bg-transparent"
                title="Pick custom color"
              />
              <input
                type="text"
                value={hexInput}
                onChange={(e) => handleHexChange(e.target.value)}
                placeholder="#000000"
                className="w-full bg-transparent border-none outline-none font-mono text-xs uppercase text-stone-800 dark:text-stone-100 font-bold"
              />
            </div>
          </div>

          {/* Stroke Widths */}
          <div>
            <span className="text-stone-500 text-[11px] font-semibold block mb-1.5">Stroke Width</span>
            <div className="grid grid-cols-4 gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-xl">
              {strokeWidths.map((w) => (
                <button
                  key={w.label}
                  onClick={() => onUpdatePen({ size: w.value })}
                  className={`py-1 rounded-lg font-bold text-xs transition-colors ${
                    activePen.size === w.value
                      ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          {/* Size Slider & Opacity */}
          <div>
            <div className="flex items-center justify-between text-[11px] text-stone-500 mb-1">
              <span>Size: {activePen.size}px</span>
              <span>Opacity: {Math.round(activePen.opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="1"
              max="40"
              value={activePen.size}
              onChange={(e) => onUpdatePen({ size: Number(e.target.value) })}
              className="w-full accent-blue-600 mb-2"
            />
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={activePen.opacity}
              onChange={(e) => onUpdatePen({ opacity: Number(e.target.value) })}
              className="w-full accent-blue-600"
            />
          </div>

          {/* One-Click Inking */}
          {activeTool === 'pen' && onToggleClickToInk && (
            <div className="pt-2 border-t border-stone-200/80 dark:border-stone-800">
              <button
                onClick={onToggleClickToInk}
                className={`w-full py-1.5 px-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                  clickToInkEnabled
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold'
                    : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300'
                }`}
                title="Click once to start stroke, click again to end (Ctrl+Shift+L)"
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm">∞</span>
                  <span>One-Click Inking</span>
                </div>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                    clickToInkEnabled
                      ? 'bg-blue-600 text-white'
                      : 'bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300'
                  }`}
                >
                  {clickToInkEnabled ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
