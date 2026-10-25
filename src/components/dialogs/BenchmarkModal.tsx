import React from 'react';
import { X, Activity, Zap, Play, Trash2, Cpu, CheckCircle } from 'lucide-react';
import { PerformanceStats } from '../../types/document';

interface BenchmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: PerformanceStats;
  onGenerateStrokes: (count: number) => void;
  onClearBenchmarkStrokes: () => void;
}

export const BenchmarkModal: React.FC<BenchmarkModalProps> = ({
  isOpen,
  onClose,
  stats,
  onGenerateStrokes,
  onClearBenchmarkStrokes,
}) => {
  if (!isOpen) return null;

  const fpsColor =
    stats.fps >= 55 ? 'text-emerald-500' : stats.fps >= 30 ? 'text-amber-500' : 'text-rose-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none">
      <div className="w-full max-w-lg bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 dark:border-stone-800 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-500" />
            <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
              Rendering Engine & Diagnostics
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
            <div className="text-[11px] font-medium text-stone-500">Live Frame Rate</div>
            <div className={`text-2xl font-bold font-mono ${fpsColor}`}>
              {stats.fps} <span className="text-xs font-normal text-stone-400">FPS</span>
            </div>
            <div className="text-[10px] text-stone-400 mt-1">Target: 60 FPS continuous</div>
          </div>

          <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
            <div className="text-[11px] font-medium text-stone-500">Frame Budget</div>
            <div className="text-2xl font-bold font-mono text-stone-800 dark:text-stone-200">
              {stats.frameTimeMs.toFixed(1)} <span className="text-xs font-normal text-stone-400">ms</span>
            </div>
            <div className="text-[10px] text-stone-400 mt-1">&lt; 16.6 ms for 60 FPS</div>
          </div>

          <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
            <div className="text-[11px] font-medium text-stone-500">Visible Culled Objects</div>
            <div className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
              {stats.renderedObjects}{' '}
              <span className="text-xs font-normal text-stone-400">/ {stats.totalObjects}</span>
            </div>
            <div className="text-[10px] text-stone-400 mt-1">Spatial viewport culling active</div>
          </div>

          <div className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700">
            <div className="text-[11px] font-medium text-stone-500">Current Camera Scale</div>
            <div className="text-2xl font-bold font-mono text-stone-800 dark:text-stone-200">
              {stats.zoomPercent}%
            </div>
            <div className="text-[10px] text-stone-400 mt-1">Range: 2% to 6400%</div>
          </div>
        </div>

        {/* 10,000 Strokes Stress Test Generator */}
        <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700 space-y-2.5">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-500" />
            <span className="text-xs font-semibold text-stone-900 dark:text-stone-100">
              Vector Stress Test Generator
            </span>
          </div>
          <p className="text-xs text-stone-500 leading-relaxed">
            Generate thousands of randomized vector strokes across the infinite plane to verify smooth 60fps pan/zoom and spatial index efficiency.
          </p>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => onGenerateStrokes(1000)}
              className="flex-1 px-3 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center justify-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>+1,000 Strokes</span>
            </button>
            <button
              onClick={() => onGenerateStrokes(10000)}
              className="flex-1 px-3 py-2 text-xs font-medium rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors flex items-center justify-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              <span>+10,000 Benchmark</span>
            </button>
            <button
              onClick={onClearBenchmarkStrokes}
              className="p-2 rounded-lg border border-stone-300 dark:border-stone-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-500 transition-colors"
              title="Clear generated benchmark strokes"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="text-[11px] text-stone-400 flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
          <span>Dual-canvas vector pipeline with sub-16ms overlay rendering.</span>
        </div>
      </div>
    </div>
  );
};
