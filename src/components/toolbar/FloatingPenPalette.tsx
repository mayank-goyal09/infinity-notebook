import React, { useState } from 'react';
import {
  Pen,
  Eraser,
  MousePointer,
  Square,
  Type,
  StickyNote,
  Hand,
  Sparkles,
  Sliders,
  ChevronUp,
  ChevronDown,
  Layers,
  Circle,
  Slash,
  MoveRight,
  Star,
  Triangle,
  Flame,
  Pipette,
  Check,
} from 'lucide-react';
import { PenConfig, ToolType, ShapeType } from '../../types/document';
import { DEFAULT_PENS, COLOR_PALETTE } from '../../engine/penDefaults';

interface FloatingPenPaletteProps {
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  activePen: PenConfig;
  onSelectPen: (pen: PenConfig) => void;
  eraserMode: 'stroke' | 'partial' | 'highlighter_only';
  onSelectEraserMode: (mode: 'stroke' | 'partial' | 'highlighter_only') => void;
  activeShape: ShapeType;
  onSelectShape: (shape: ShapeType) => void;
  onUpdatePenConfig: (updates: Partial<PenConfig>) => void;
  isRulerActive: boolean;
  onToggleRuler: () => void;
}

export const FloatingPenPalette: React.FC<FloatingPenPaletteProps> = ({
  activeTool,
  onSelectTool,
  activePen,
  onSelectPen,
  eraserMode,
  onSelectEraserMode,
  activeShape,
  onSelectShape,
  onUpdatePenConfig,
  isRulerActive,
  onToggleRuler,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'pens' | 'shapes' | 'eraser' | 'color' | 'tuning'>('pens');

  const handleEyedropper = async () => {
    if ('EyeDropper' in window) {
      try {
        const eyeDropper = new (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper();
        const result = await eyeDropper.open();
        if (result.sRGBHex) {
          onUpdatePenConfig({ color: result.sRGBHex });
        }
      } catch {
        // User cancelled eyedropper
      }
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center select-none">
      {/* Expanded Studio Panel */}
      {isExpanded && (
        <div className="mb-2 w-[480px] max-w-[94vw] rounded-2xl bg-white/95 dark:bg-stone-900/95 backdrop-blur-xl shadow-2xl border border-stone-200 dark:border-stone-800 p-3.5 transition-all animate-in fade-in slide-in-from-bottom-3 duration-150">
          {/* Sub-tabs header */}
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-2 mb-3">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('pens')}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                  activeTab === 'pens'
                    ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900'
                    : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                Brushes ({DEFAULT_PENS.length})
              </button>
              <button
                onClick={() => setActiveTab('color')}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                  activeTab === 'color'
                    ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900'
                    : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                Color & Swatches
              </button>
              <button
                onClick={() => setActiveTab('tuning')}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                  activeTab === 'tuning'
                    ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900'
                    : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                Nib & Dynamics
              </button>
            </div>

            {/* Live Nib Preview Dot */}
            <div className="flex items-center gap-2 pr-1">
              <div
                className="rounded-full border border-stone-300 dark:border-stone-600 transition-all"
                style={{
                  width: Math.min(32, Math.max(6, activePen.size * 1.5)),
                  height: Math.min(32, Math.max(6, activePen.size * 1.5)),
                  backgroundColor: activePen.color,
                  opacity: activePen.opacity,
                }}
              />
              <span className="text-[11px] font-mono text-stone-500">{activePen.size}px</span>
            </div>
          </div>

          {/* Tab 1: Pens & Brushes Grid */}
          {activeTab === 'pens' && (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-52 overflow-y-auto pr-1">
              {DEFAULT_PENS.map((pen, index) => {
                const isSelected = activeTool === 'pen' && activePen.type === pen.type;
                return (
                  <button
                    key={pen.id}
                    onClick={() => {
                      onSelectPen(pen);
                      onSelectTool('pen');
                    }}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 shadow-xs'
                        : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/60 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    <div
                      className="w-5 h-5 rounded-full mb-1 flex items-center justify-center"
                      style={{
                        backgroundColor: isSelected ? activePen.color : pen.color,
                        opacity: pen.opacity,
                      }}
                    >
                      {index < 9 && (
                        <span className="text-[9px] font-bold text-white drop-shadow-xs">
                          {index + 1}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-medium leading-tight truncate w-full">
                      {pen.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Tab 2: Color Palette */}
          {activeTab === 'color' && (
            <div>
              <div className="grid grid-cols-8 gap-2 mb-3">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    onClick={() => onUpdatePenConfig({ color: c })}
                    className="w-9 h-9 rounded-xl border border-stone-200 dark:border-stone-700 flex items-center justify-center shadow-xs transition-transform hover:scale-105"
                    style={{ backgroundColor: c }}
                  >
                    {activePen.color.toLowerCase() === c.toLowerCase() && (
                      <Check
                        className={`w-4 h-4 ${
                          c === '#ffffff' || c.startsWith('#fe') || c.startsWith('#86')
                            ? 'text-stone-900'
                            : 'text-white'
                        }`}
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Custom Hex and Eyedropper */}
              <div className="flex items-center gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                <input
                  type="color"
                  value={activePen.color.startsWith('#') ? activePen.color : '#09090b'}
                  onChange={(e) => onUpdatePenConfig({ color: e.target.value })}
                  className="w-8 h-8 rounded-lg cursor-pointer border-0 p-0 bg-transparent"
                />
                <input
                  type="text"
                  value={activePen.color}
                  onChange={(e) => onUpdatePenConfig({ color: e.target.value })}
                  className="text-xs font-mono px-2 py-1 rounded-md border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800 text-stone-800 dark:text-stone-200 w-24"
                />
                {'EyeDropper' in window && (
                  <button
                    onClick={handleEyedropper}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300"
                    title="Eyedropper tool"
                  >
                    <Pipette className="w-3.5 h-3.5" />
                    <span>Pick</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Nib & Dynamics */}
          {activeTab === 'tuning' && (
            <div className="space-y-3">
              {/* Nib Size Slider */}
              <div>
                <div className="flex justify-between text-xs text-stone-600 dark:text-stone-400 mb-1">
                  <span>Nib Size</span>
                  <span className="font-mono">{activePen.size} px</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="60"
                  step="0.5"
                  value={activePen.size}
                  onChange={(e) => onUpdatePenConfig({ size: parseFloat(e.target.value) })}
                  className="w-full accent-blue-600"
                />
              </div>

              {/* Opacity Slider */}
              <div>
                <div className="flex justify-between text-xs text-stone-600 dark:text-stone-400 mb-1">
                  <span>Opacity</span>
                  <span className="font-mono">{Math.round(activePen.opacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={activePen.opacity}
                  onChange={(e) => onUpdatePenConfig({ opacity: parseFloat(e.target.value) })}
                  className="w-full accent-blue-600"
                />
              </div>

              {/* Smoothing Slider */}
              <div>
                <div className="flex justify-between text-xs text-stone-600 dark:text-stone-400 mb-1">
                  <span>Stabilization (One-Euro Filter)</span>
                  <span className="font-mono">{Math.round(activePen.smoothing * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.95"
                  step="0.05"
                  value={activePen.smoothing}
                  onChange={(e) => onUpdatePenConfig({ smoothing: parseFloat(e.target.value) })}
                  className="w-full accent-blue-600"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Primary Floating Toolbar Pill */}
      <div className="flex items-center gap-1 bg-white/95 dark:bg-stone-900/95 backdrop-blur-xl px-2.5 py-1.5 rounded-2xl shadow-xl border border-stone-200 dark:border-stone-800">
        {/* Pen Tool */}
        <button
          onClick={() => {
            onSelectTool('pen');
            setIsExpanded(!isExpanded);
          }}
          className={`flex items-center gap-1.5 p-2 rounded-xl transition-all ${
            activeTool === 'pen'
              ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 shadow-sm'
              : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
          title={`${activePen.name} (Press 1-9 to switch presets, click to tune)`}
        >
          <Pen className="w-4 h-4" />
          <span
            className="w-2.5 h-2.5 rounded-full border border-white/40"
            style={{ backgroundColor: activePen.color }}
          />
        </button>

        {/* Eraser Tool */}
        <div className="relative group">
          <button
            onClick={() => onSelectTool('eraser')}
            className={`p-2 rounded-xl transition-all ${
              activeTool === 'eraser'
                ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 shadow-sm'
                : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
            title={`Eraser (${eraserMode === 'stroke' ? 'Stroke Eraser' : eraserMode === 'partial' ? 'Pixel Eraser' : 'Erase Highlighter Only'})`}
          >
            <Eraser className="w-4 h-4" />
          </button>
        </div>

        {/* Selection Tool */}
        <button
          onClick={() => onSelectTool('select')}
          className={`p-2 rounded-xl transition-all ${
            activeTool === 'select' || activeTool === 'lasso'
              ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 shadow-sm'
              : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
          title="Selection & Transform Tool (Drag rectangle or lasso)"
        >
          <MousePointer className="w-4 h-4" />
        </button>

        {/* Shapes Tool */}
        <div className="relative group">
          <button
            onClick={() => onSelectTool('shape')}
            className={`p-2 rounded-xl transition-all ${
              activeTool === 'shape'
                ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 shadow-sm'
                : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
            title="Geometry & Connectors"
          >
            {activeShape === 'rectangle' && <Square className="w-4 h-4" />}
            {activeShape === 'ellipse' && <Circle className="w-4 h-4" />}
            {activeShape === 'line' && <Slash className="w-4 h-4" />}
            {activeShape === 'arrow' && <MoveRight className="w-4 h-4" />}
            {activeShape === 'triangle' && <Triangle className="w-4 h-4" />}
            {activeShape === 'star' && <Star className="w-4 h-4" />}
          </button>

          {/* Quick Shape Picker Flyout */}
          <div className="hidden group-hover:flex absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-1 bg-white dark:bg-stone-900 rounded-xl shadow-lg border border-stone-200 dark:border-stone-800 gap-1 z-50">
            {(['rectangle', 'ellipse', 'line', 'arrow', 'triangle', 'star'] as ShapeType[]).map((st) => (
              <button
                key={st}
                onClick={() => {
                  onSelectShape(st);
                  onSelectTool('shape');
                }}
                className={`p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 ${
                  activeShape === st ? 'bg-blue-50 dark:bg-blue-950 text-blue-600' : ''
                }`}
                title={st}
              >
                {st === 'rectangle' && <Square className="w-3.5 h-3.5" />}
                {st === 'ellipse' && <Circle className="w-3.5 h-3.5" />}
                {st === 'line' && <Slash className="w-3.5 h-3.5" />}
                {st === 'arrow' && <MoveRight className="w-3.5 h-3.5" />}
                {st === 'triangle' && <Triangle className="w-3.5 h-3.5" />}
                {st === 'star' && <Star className="w-3.5 h-3.5" />}
              </button>
            ))}
          </div>
        </div>

        {/* Text Tool */}
        <button
          onClick={() => onSelectTool('text')}
          className={`p-2 rounded-xl transition-all ${
            activeTool === 'text'
              ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 shadow-sm'
              : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
          title="Rich Text & Markdown (Double-click anywhere to type)"
        >
          <Type className="w-4 h-4" />
        </button>

        {/* Sticky Note Tool */}
        <button
          onClick={() => onSelectTool('sticky')}
          className={`p-2 rounded-xl transition-all ${
            activeTool === 'sticky'
              ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 shadow-sm'
              : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
          title="Warm Sticky Note"
        >
          <StickyNote className="w-4 h-4 text-amber-500" />
        </button>

        {/* Hand Pan Tool */}
        <button
          onClick={() => onSelectTool('hand')}
          className={`p-2 rounded-xl transition-all ${
            activeTool === 'hand'
              ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 shadow-sm'
              : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
          title="Hand Navigation (Space+drag or middle mouse also pans)"
        >
          <Hand className="w-4 h-4" />
        </button>

        {/* Laser Pointer */}
        <button
          onClick={() => onSelectTool('laser')}
          className={`p-2 rounded-xl transition-all ${
            activeTool === 'laser'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40'
          }`}
          title="Laser Pointer (temporary fading trail for presentations)"
        >
          <Flame className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-5 bg-stone-200 dark:bg-stone-800 mx-0.5" />

        {/* Studio expander toggle */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1.5 rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          title="Brush Studio & Custom Presets"
        >
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};
