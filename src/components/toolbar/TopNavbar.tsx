import React, { useState } from 'react';
import {
  BookOpen,
  LayoutGrid,
  Undo2,
  Redo2,
  Maximize2,
  Minimize2,
  Settings,
  Download,
  Upload,
  Search,
  Zap,
  HelpCircle,
  Activity,
  HardDrive,
  CloudCheck,
  CloudOff,
  Check,
  FileCode,
  FileImage,
  FileText,
  FileArchive,
  MousePointerClick,
  Plus,
  FileSpreadsheet,
} from 'lucide-react';
import { NotebookDocument } from '../../types/document';
import { PWAInstallButton } from '../common/PWAInstallButton';
import { SyncStatus } from '../../services/syncEngine';

interface TopNavbarProps {
  document: NotebookDocument;
  onUpdateTitle: (newTitle: string) => void;
  onToggleMode: (mode: 'notebook' | 'canvas') => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  clickToInkEnabled: boolean;
  clickToInkState: string;
  onToggleClickToInk: () => void;
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
  onOpenSettings: () => void;
  onOpenCommandPalette: () => void;
  onOpenBenchmark: () => void;
  onOpenTutorial: () => void;
  onExport: (format: 'inb' | 'png' | 'svg' | 'markdown' | 'pdf') => void;
  onImport: () => void;
  syncStatus: SyncStatus;
  onOpenAddFormat?: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  document,
  onUpdateTitle,
  onToggleMode,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  clickToInkEnabled,
  clickToInkState,
  onToggleClickToInk,
  isFocusMode,
  onToggleFocusMode,
  onOpenSettings,
  onOpenCommandPalette,
  onOpenBenchmark,
  onOpenTutorial,
  onExport,
  onImport,
  syncStatus,
  onOpenAddFormat,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(document.title);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleTitleSubmit = () => {
    setIsEditingTitle(false);
    if (tempTitle.trim()) {
      onUpdateTitle(tempTitle.trim());
    } else {
      setTempTitle(document.title);
    }
  };

  return (
    <header className="h-12 border-b border-stone-200 dark:border-stone-800 bg-white/90 dark:bg-stone-900/90 backdrop-blur-md px-3 flex items-center justify-between z-30 select-none transition-all">
      {/* Left: App Branding & Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-stone-900 dark:bg-stone-100 flex items-center justify-center shadow-xs">
            <span className="text-white dark:text-stone-900 font-bold text-sm tracking-tight">∞</span>
          </div>
          {isEditingTitle ? (
            <input
              type="text"
              value={tempTitle}
              autoFocus
              onChange={(e) => setTempTitle(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTitleSubmit();
                if (e.key === 'Escape') {
                  setTempTitle(document.title);
                  setIsEditingTitle(false);
                }
              }}
              className="text-sm font-semibold px-2 py-0.5 rounded-md border border-stone-300 dark:border-stone-600 bg-stone-50 dark:bg-stone-800 outline-none w-48 text-stone-900 dark:text-stone-100"
            />
          ) : (
            <button
              onClick={() => {
                setTempTitle(document.title);
                setIsEditingTitle(true);
              }}
              className="text-sm font-semibold text-stone-800 dark:text-stone-200 hover:text-stone-900 dark:hover:text-white px-1.5 py-0.5 rounded-md hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors text-left truncate max-w-[200px]"
              title="Click to rename notebook"
            >
              {document.title}
            </button>
          )}
        </div>

        {/* Accounting Format Quick Action */}
        {onOpenAddFormat && (
          <button
            onClick={onOpenAddFormat}
            className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors ml-2"
            title="Add accounting format (Journal, Ledger, Trial Balance, etc.)"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Format</span>
          </button>
        )}

        <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 px-2.5 py-1 rounded-lg border border-stone-200 dark:border-stone-700 ml-1">
          <FileSpreadsheet className="w-3.5 h-3.5 text-blue-500" />
          <span>Accounting Canvas</span>
        </div>
      </div>

      {/* Center: Signature Click-to-Ink Status & Quick Undo/Redo */}
      <div className="flex items-center gap-2">
        {/* Click-to-Ink Toggle & Indicator */}
        <button
          onClick={onToggleClickToInk}
          className={`flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
            clickToInkEnabled
              ? clickToInkState === 'inking'
                ? 'bg-sky-500/15 border-sky-500 text-sky-600 dark:text-sky-400 ring-2 ring-sky-500/20'
                : 'bg-sky-50 dark:bg-sky-950/40 border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-300'
              : 'bg-stone-50 dark:bg-stone-800/60 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
          title="Hands-free drawing: Click once to draw, click again to finish (Ctrl+Shift+L)"
        >
          <MousePointerClick className="w-3.5 h-3.5" />
          <span>Click-to-Ink:</span>
          {clickToInkEnabled ? (
            <span className="flex items-center gap-1 font-semibold">
              <span
                className={`w-2 h-2 rounded-full ${
                  clickToInkState === 'inking'
                    ? 'bg-sky-500 animate-ping'
                    : 'bg-emerald-500'
                }`}
              />
              {clickToInkState === 'inking'
                ? 'Drawing (Pen Down)'
                : clickToInkState === 'lifted'
                ? 'Lifted (Space Held)'
                : 'Armed (Pen Up)'}
            </span>
          ) : (
            <span className="text-stone-400">Off</span>
          )}
        </button>

        {/* Undo / Redo */}
        <div className="flex items-center border-l border-stone-200 dark:border-stone-800 pl-2 ml-1">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="p-1.5 rounded-md text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="p-1.5 rounded-md text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Right: Actions, Sync, Export, Settings */}
      <div className="flex items-center gap-1.5">
        {/* Command Palette Trigger */}
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-800 rounded-md hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors mr-1"
          title="Search actions, tools and pages (Ctrl+K)"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="hidden md:inline text-[10px] bg-white dark:bg-stone-900 px-1 py-0.5 rounded border border-stone-200 dark:border-stone-700">
            Ctrl+K
          </kbd>
        </button>

        {/* Sync Status Badge */}
        <div
          className="hidden lg:flex items-center gap-1.5 px-2 py-1 text-[11px] rounded-md text-stone-500 dark:text-stone-400 bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-800"
          title={syncStatus.message}
        >
          {syncStatus.provider === 'none' ? (
            <HardDrive className="w-3.5 h-3.5 text-stone-400" />
          ) : syncStatus.state === 'synced' ? (
            <CloudCheck className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <CloudOff className="w-3.5 h-3.5 text-amber-500" />
          )}
          <span className="truncate max-w-[110px]">{syncStatus.message}</span>
        </div>

        {/* PWA Install Button */}
        <PWAInstallButton />

        {/* Benchmark & Diagnostics Button */}
        <button
          onClick={onOpenBenchmark}
          className="p-1.5 rounded-md text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          title="Performance Benchmark (10,000 Strokes Stress Test & FPS Meter)"
        >
          <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        </button>

        {/* Export Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 transition-colors"
            title="Export Document"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {showExportMenu && (
            <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white dark:bg-stone-900 shadow-xl border border-stone-200 dark:border-stone-800 py-1.5 z-50 text-xs">
              <button
                onClick={() => {
                  setShowExportMenu(false);
                  onExport('inb');
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 text-left"
              >
                <FileArchive className="w-4 h-4 text-blue-500" />
                <div>
                  <div className="font-medium">Infinity Archive (.inb)</div>
                  <div className="text-[10px] text-stone-400">Full-fidelity backup</div>
                </div>
              </button>
              <button
                onClick={() => {
                  setShowExportMenu(false);
                  onExport('pdf');
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 text-left"
              >
                <FileText className="w-4 h-4 text-rose-500" />
                <div>
                  <div className="font-medium">PDF Document</div>
                  <div className="text-[10px] text-stone-400">Multi-page print/export</div>
                </div>
              </button>
              <button
                onClick={() => {
                  setShowExportMenu(false);
                  onExport('png');
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 text-left"
              >
                <FileImage className="w-4 h-4 text-emerald-500" />
                <div>
                  <div className="font-medium">High-Res PNG</div>
                  <div className="text-[10px] text-stone-400">2x Retina image</div>
                </div>
              </button>
              <button
                onClick={() => {
                  setShowExportMenu(false);
                  onExport('svg');
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 text-left"
              >
                <FileCode className="w-4 h-4 text-amber-500" />
                <div>
                  <div className="font-medium">Scalable Vector (SVG)</div>
                  <div className="text-[10px] text-stone-400">Crisp vector paths</div>
                </div>
              </button>
              <button
                onClick={() => {
                  setShowExportMenu(false);
                  onExport('markdown');
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 text-left"
              >
                <FileText className="w-4 h-4 text-stone-500" />
                <div>
                  <div className="font-medium">Markdown (.md)</div>
                  <div className="text-[10px] text-stone-400">Text & sticky notes</div>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Import Button */}
        <button
          onClick={onImport}
          className="p-1.5 rounded-md text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          title="Import .inb archive or image"
        >
          <Upload className="w-4 h-4" />
        </button>

        {/* Quick Tutorial Help */}
        <button
          onClick={onOpenTutorial}
          className="p-1.5 rounded-md text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          title="Interactive Tutorial & Touchpad Gestures"
        >
          <HelpCircle className="w-4 h-4" />
        </button>

        {/* Focus / Fullscreen Mode */}
        <button
          onClick={onToggleFocusMode}
          className="p-1.5 rounded-md text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          title={isFocusMode ? 'Exit Focus Mode' : 'Focus Mode (hide toolbars)'}
        >
          {isFocusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded-md text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          title="Preferences & Shortcuts"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
