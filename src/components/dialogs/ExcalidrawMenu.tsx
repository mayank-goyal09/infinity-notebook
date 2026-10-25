import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  FolderOpen,
  Download,
  Image,
  Users,
  Zap,
  Search,
  HelpCircle,
  Trash2,
  Sun,
  Moon,
  Laptop,
  Check,
  ChevronRight,
  FileSpreadsheet,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Settings,
} from 'lucide-react';

interface ExcalidrawMenuProps {
  onOpen: () => void;
  onSave: () => void;
  onExport: () => void;
  onCommandPalette: () => void;
  onHelp: () => void;
  onOpenSettings: () => void;
  onResetCanvas: () => void;
  theme: 'light' | 'dark' | 'paper';
  onChangeTheme: (theme: 'light' | 'dark' | 'paper') => void;
  canvasBg: string;
  onChangeCanvasBg: (bg: string) => void;
  onOpenAddFormat: () => void;
}

export const ExcalidrawMenu: React.FC<ExcalidrawMenuProps> = ({
  onOpen,
  onSave,
  onExport,
  onCommandPalette,
  onHelp,
  onOpenSettings,
  onResetCanvas,
  theme,
  onChangeTheme,
  canvasBg,
  onChangeCanvasBg,
  onOpenAddFormat,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const backgroundSwatches = [
    { color: '#ffffff', label: 'White' },
    { color: '#f8fafc', label: 'Slate 50' },
    { color: '#f1f5f9', label: 'Slate 100' },
    { color: '#fefce8', label: 'Warm Cream' },
    { color: '#f0fdf4', label: 'Mint Soft' },
    { color: '#18181b', label: 'Dark' },
  ];

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} className="fixed top-3 left-3 z-50 select-none">
      {/* 3-line Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-xl bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border border-stone-200 dark:border-stone-800 shadow-md flex items-center justify-center text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        title="Main Menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Excalidraw Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-12 left-0 w-72 bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 py-2 text-xs animate-in fade-in zoom-in-95 duration-100 flex flex-col">
          {/* File Operations */}
          <button
            onClick={() => {
              onOpen();
              setIsOpen(false);
            }}
            className="px-3.5 py-2 flex items-center justify-between text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <FolderOpen className="w-4 h-4 text-stone-500" />
              <span>Open</span>
            </div>
            <span className="text-[10px] text-stone-400 font-mono">Ctrl+O</span>
          </button>

          <button
            onClick={() => {
              onSave();
              setIsOpen(false);
            }}
            className="px-3.5 py-2 flex items-center justify-between text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Download className="w-4 h-4 text-stone-500" />
              <span>Save to...</span>
            </div>
          </button>

          <button
            onClick={() => {
              onExport();
              setIsOpen(false);
            }}
            className="px-3.5 py-2 flex items-center justify-between text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Image className="w-4 h-4 text-stone-500" />
              <span>Export image / document...</span>
            </div>
            <span className="text-[10px] text-stone-400 font-mono">Ctrl+Shift+E</span>
          </button>

          <button
            onClick={() => {
              onOpenAddFormat();
              setIsOpen(false);
            }}
            className="px-3.5 py-2 flex items-center justify-between text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors font-medium"
          >
            <div className="flex items-center gap-2.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Insert Accounting Format</span>
            </div>
            <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/60 px-1.5 py-0.5 rounded text-emerald-700 dark:text-emerald-300">
              New
            </span>
          </button>

          <button
            onClick={() => {
              onCommandPalette();
              setIsOpen(false);
            }}
            className="px-3.5 py-2 flex items-center justify-between text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors font-medium"
          >
            <div className="flex items-center gap-2.5">
              <Zap className="w-4 h-4 text-blue-500" />
              <span>Command palette</span>
            </div>
            <span className="text-[10px] text-blue-500 font-mono">Ctrl+/</span>
          </button>

          <button
            onClick={() => {
              onHelp();
              setIsOpen(false);
            }}
            className="px-3.5 py-2 flex items-center justify-between text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <HelpCircle className="w-4 h-4 text-stone-500" />
              <span>Help & shortcuts</span>
            </div>
            <span className="text-[10px] text-stone-400 font-mono">?</span>
          </button>

          <button
            onClick={() => {
              onOpenSettings();
              setIsOpen(false);
            }}
            className="px-3.5 py-2 flex items-center justify-between text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Settings className="w-4 h-4 text-stone-500" />
              <span>Settings (Touchpad & Preferences)</span>
            </div>
            <span className="text-[10px] text-stone-400 font-mono">Ctrl+,</span>
          </button>

          <div className="my-1.5 border-t border-stone-200 dark:border-stone-800" />

          {/* Quick Canvas Zoom Controls */}
          <div className="px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-stone-400">
            Canvas Zoom
          </div>

          <div className="px-3 py-1.5 text-[11px] text-stone-500 dark:text-stone-400 bg-stone-50 dark:bg-stone-800/60 rounded-xl mx-2.5 mb-1.5 border border-stone-200/60 dark:border-stone-700/60 flex items-center gap-1.5">
            <span>✨</span>
            <span>Pinch to zoom • Two-finger scroll to pan</span>
          </div>

          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('canvas:zoom-in'));
            }}
            className="px-3.5 py-1.5 flex items-center justify-between text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <ZoomIn className="w-4 h-4 text-stone-500" />
              <span>Zoom In</span>
            </div>
            <span className="text-[10px] text-stone-400 font-mono">Ctrl + +</span>
          </button>

          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('canvas:zoom-out'));
            }}
            className="px-3.5 py-1.5 flex items-center justify-between text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <ZoomOut className="w-4 h-4 text-stone-500" />
              <span>Zoom Out</span>
            </div>
            <span className="text-[10px] text-stone-400 font-mono">Ctrl + -</span>
          </button>

          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('canvas:zoom-reset'));
              setIsOpen(false);
            }}
            className="px-3.5 py-1.5 flex items-center justify-between text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <RotateCcw className="w-4 h-4 text-stone-500" />
              <span>Reset Zoom (100%)</span>
            </div>
            <span className="text-[10px] text-stone-400 font-mono">Ctrl + 0</span>
          </button>

          <div className="my-1.5 border-t border-stone-200 dark:border-stone-800" />

          <button
            onClick={() => {
              if (window.confirm('Are you sure you want to clear the canvas?')) {
                onResetCanvas();
              }
              setIsOpen(false);
            }}
            className="px-3.5 py-2 flex items-center justify-between text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Trash2 className="w-4 h-4 text-red-500" />
              <span>Reset the canvas</span>
            </div>
          </button>

          <div className="my-1.5 border-t border-stone-200 dark:border-stone-800" />

          {/* Theme Switcher */}
          <div className="px-3.5 py-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-stone-500 dark:text-stone-400 font-medium text-[11px]">Theme</span>
              <div className="flex items-center bg-stone-100 dark:bg-stone-800 p-0.5 rounded-lg border border-stone-200 dark:border-stone-700">
                <button
                  onClick={() => onChangeTheme('light')}
                  className={`p-1.5 rounded-md transition-colors ${
                    theme === 'light'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                  }`}
                  title="Light Theme"
                >
                  <Sun className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onChangeTheme('dark')}
                  className={`p-1.5 rounded-md transition-colors ${
                    theme === 'dark'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                  }`}
                  title="Dark Theme"
                >
                  <Moon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Canvas background swatches */}
            <span className="text-stone-500 dark:text-stone-400 font-medium text-[11px] block mb-1.5">
              Canvas background
            </span>
            <div className="flex items-center gap-1.5">
              {backgroundSwatches.map((swatch) => (
                <button
                  key={swatch.color}
                  onClick={() => onChangeCanvasBg(swatch.color)}
                  className={`w-6 h-6 rounded-md border flex items-center justify-center transition-transform hover:scale-110 ${
                    canvasBg === swatch.color
                      ? 'ring-2 ring-blue-500 border-white'
                      : 'border-stone-300 dark:border-stone-700'
                  }`}
                  style={{ backgroundColor: swatch.color }}
                  title={swatch.label}
                >
                  {canvasBg === swatch.color && (
                    <Check
                      className={`w-3 h-3 ${
                        swatch.color === '#18181b' ? 'text-white' : 'text-blue-600'
                      }`}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
