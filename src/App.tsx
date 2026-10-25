import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  NotebookDocument,
  PenConfig,
  ToolType,
  ShapeType,
  PageTemplate,
  PageSize,
  PageFrame,
  ClickToInkSettings,
  InputSettings,
  AppTheme,
  PerformanceStats,
  StrokeObject,
  StrokePoint,
  AccountingTableObject,
  AccountingFormatType,
  CanvasObject,
  TableRow,
  ShapeObject,
  ShapeConfig,
  TextObject,
} from './types/document';
import { DEFAULT_PENS, PAGE_SIZE_DIMENSIONS } from './engine/penDefaults';
import { StorageService, createDefaultNotebook } from './services/storage';
import { InbFormatService } from './services/inbFormat';
import { SyncEngine, SyncStatus } from './services/syncEngine';
import { ClickToInkState } from './engine/clickToInk';
import { CanvasRenderer } from './engine/renderer';
import { createAccountingTable, recalculateTableAutoSums, ACCOUNTING_FORMAT_CATALOG } from './engine/accountingFormats';
import { measureTextBounds } from './engine/textMeasurement';

// Excalidraw UI Components
import { ExcalidrawTopBar } from './components/toolbar/ExcalidrawTopBar';
import { ExcalidrawMenu } from './components/dialogs/ExcalidrawMenu';
import { ExcalidrawPropertiesPanel, TextConfig, StickyConfig } from './components/toolbar/ExcalidrawPropertiesPanel';
import { ExcalidrawBottomBar } from './components/toolbar/ExcalidrawBottomBar';
import { ExcalidrawLibraryDrawer } from './components/sidebar/ExcalidrawLibraryDrawer';
import { InfiniteCanvas } from './components/canvas/InfiniteCanvas';
import { BookOpen, Share2 } from 'lucide-react';

// Modals
import { AddFormatModal } from './components/dialogs/AddFormatModal';
import { SettingsModal } from './components/dialogs/SettingsModal';
import { CommandPalette } from './components/dialogs/CommandPalette';
import { BenchmarkModal } from './components/dialogs/BenchmarkModal';
import { TutorialModal } from './components/dialogs/TutorialModal';
import { WebEmbedModal } from './components/dialogs/WebEmbedModal';
import { MermaidModal } from './components/dialogs/MermaidModal';

export default function App() {
  const [doc, setDoc] = useState<NotebookDocument>(() => createDefaultNotebook());
  const [history, setHistory] = useState<NotebookDocument[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Tools & Pens (with persistent session memory)
  const [activeTool, setActiveTool] = useState<ToolType>(() => {
    try {
      const saved = localStorage.getItem('inf_active_tool');
      if (saved) return saved as ToolType;
    } catch {}
    return 'pen';
  });

  const [activePen, setActivePen] = useState<PenConfig>(() => {
    try {
      const saved = localStorage.getItem('inf_active_pen');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          parsed &&
          typeof parsed === 'object' &&
          typeof parsed.type === 'string' &&
          typeof parsed.color === 'string' &&
          typeof parsed.size === 'number' &&
          !isNaN(parsed.size)
        ) {
          return parsed as PenConfig;
        }
      }
    } catch {}
    return DEFAULT_PENS[0];
  });

  const [eraserMode, setEraserMode] = useState<'stroke' | 'partial' | 'highlighter_only'>(() => {
    try {
      const saved = localStorage.getItem('inf_eraser_mode');
      if (saved === 'stroke' || saved === 'partial' || saved === 'highlighter_only') {
        return saved;
      }
    } catch {}
    return 'stroke';
  });

  const [eraserSize, setEraserSize] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('inf_eraser_size');
      if (saved) {
        const parsed = Number(saved);
        if (!isNaN(parsed) && parsed > 0 && parsed <= 200) {
          return parsed;
        }
      }
    } catch {}
    return 24;
  });

  useEffect(() => {
    try {
      localStorage.setItem('inf_active_tool', activeTool);
    } catch {}
  }, [activeTool]);

  useEffect(() => {
    try {
      localStorage.setItem('inf_active_pen', JSON.stringify(activePen));
    } catch {}
  }, [activePen]);

  useEffect(() => {
    try {
      localStorage.setItem('inf_eraser_mode', eraserMode);
    } catch {}
  }, [eraserMode]);

  useEffect(() => {
    try {
      localStorage.setItem('inf_eraser_size', String(eraserSize));
    } catch {}
  }, [eraserSize]);
  const [activeShape, setActiveShape] = useState<ShapeType>('rectangle');
  const [isToolLocked, setIsToolLocked] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isPropertiesOpen, setIsPropertiesOpen] = useState(true);
  const [canvasBg, setCanvasBg] = useState<string>('#ffffff');
  const [isDrawToShape, setIsDrawToShape] = useState(false);
  const [isWebEmbedOpen, setIsWebEmbedOpen] = useState(false);
  const [isMermaidOpen, setIsMermaidOpen] = useState(false);

  // Text & Sticky Configuration
  const [textConfig, setTextConfig] = useState<TextConfig>({
    fontFamily: 'Caveat, cursive',
    fontSize: 20,
    color: '#1e1e1e',
    align: 'left',
    bold: false,
    italic: false,
    underline: false,
    opacity: 1,
  });

  const [stickyConfig, setStickyConfig] = useState<StickyConfig>({
    color: '#fef08a',
    textColor: '#1e1e1e',
    fontFamily: 'Caveat, cursive',
    fontSize: 20,
    textAlign: 'center',
    verticalAlign: 'middle',
    opacity: 1,
  });

  // Excalidraw Shape Configuration (Stroke, Background, Fill, Width, Style, Sloppiness, Edges)
  const [shapeConfig, setShapeConfig] = useState<ShapeConfig>({
    strokeColor: '#1e1e1e',
    fillColor: 'transparent',
    strokeWidth: 2,
    strokeStyle: 'solid',
    fillStyle: 'solid',
    roughness: 0,
    rounded: false,
    opacity: 1,
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selectedObject = doc.objects.find((o) => selectedIds.includes(o.id)) || null;

  // Change active tool and cleanly clear selected objects when switching to drawing tools (pen, laser, eraser, shape, etc.)
  const handleSelectTool = (tool: ToolType) => {
    setActiveTool(tool);
    if (tool !== 'select') {
      setSelectedIds([]);
      setSelectedTableId(null);
    }
  };

  // Track exact cursor and viewport document position
  const lastDocCursorPosRef = useRef<{ x: number; y: number } | null>(null);
  const viewportCenterRef = useRef<{ x: number; y: number }>({ x: 400, y: 300 });

  // Settings with persistent localStorage
  const [clickToInkSettings, setClickToInkSettings] = useState<ClickToInkSettings>(() => {
    try {
      const saved = localStorage.getItem('inf_click_to_ink_v2');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      enabled: false,
      endTrigger: 'click',
      pauseToLiftEnabled: false,
      pauseToLiftMs: 800,
      edgeAutoPan: true,
      dotOnTap: true,
      audioTick: true,
      visualTick: true,
    };
  });

  const [inputSettings, setInputSettings] = useState<InputSettings>(() => {
    try {
      const saved = localStorage.getItem('inf_input_settings_v2');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      smoothing: 0.65,
      lazyRope: false,
      lazyRopeLength: 20,
      velocityPressure: true,
      velocitySensitivity: 1.0,
      wheelMode: 'auto',
      touchpadMode: 'auto',
      inertialPan: true,
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem('inf_click_to_ink_v2', JSON.stringify(clickToInkSettings));
    } catch {}
  }, [clickToInkSettings]);

  useEffect(() => {
    try {
      localStorage.setItem('inf_input_settings_v2', JSON.stringify(inputSettings));
    } catch {}
  }, [inputSettings]);

  const [theme, setTheme] = useState<AppTheme>('light');
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [clickToInkState, setClickToInkState] = useState<ClickToInkState>('idle');

  // Accounting Format & Table States
  const [isAddFormatOpen, setIsAddFormatOpen] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [initialFocusedCell, setInitialFocusedCell] = useState<{ rowId: string; colId: string } | null>(null);
  const [rowUndoToast, setRowUndoToast] = useState<{
    tableId: string;
    row: TableRow;
    index: number;
    title: string;
  } | null>(null);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);

  // Diagnostics and Storage (initialized from persisted camera zoom)
  const [stats, setStats] = useState<PerformanceStats>(() => {
    let initialZoom = 100;
    try {
      const saved = localStorage.getItem('infinity_last_camera');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          typeof parsed.zoom === 'number' &&
          !isNaN(parsed.zoom) &&
          parsed.zoom > 0.05 &&
          parsed.zoom < 10
        ) {
          initialZoom = Math.round(parsed.zoom * 100);
        }
      }
    } catch {}
    return {
      fps: 60,
      frameTimeMs: 16.6,
      renderedObjects: 0,
      totalObjects: 0,
      zoomPercent: initialZoom,
      mode: 'notebook',
    };
  });
  const [storageEstimate, setStorageEstimate] = useState({ usedMb: 1.2, quotaMb: 500, percent: 0.2 });

  // Sync Engine & Services
  const storageServiceRef = useRef<StorageService>(new StorageService());
  const syncEngineRef = useRef<SyncEngine>(new SyncEngine());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(syncEngineRef.current.getStatus());
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load Document from IndexedDB on startup
  useEffect(() => {
    async function initStorage() {
      try {
        const loaded = await storageServiceRef.current.loadDocument('doc-default');
        if (loaded) {
          setDoc(loaded);
          setHistory([loaded]);
          setHistoryIndex(0);
        } else {
          const defaultDoc = createDefaultNotebook();
          await storageServiceRef.current.saveDocument(defaultDoc);
          setDoc(defaultDoc);
          setHistory([defaultDoc]);
          setHistoryIndex(0);
        }

        const est = await storageServiceRef.current.getStorageEstimate();
        setStorageEstimate(est);
      } catch (err) {
        console.error('Storage initialization failed:', err);
      }
    }

    initStorage();

    syncEngineRef.current.setOnStatusChange((status) => {
      setSyncStatus(status);
    });
  }, []);

  // Sync Theme with HTML body class
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Debounced Autosave
  const autosaveTimerRef = useRef<number | null>(null);
  const saveDocumentDebounced = useCallback((documentToSave: NotebookDocument) => {
    if (autosaveTimerRef.current !== null) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(async () => {
      try {
        await storageServiceRef.current.saveDocument(documentToSave);
        syncEngineRef.current.syncDocument(documentToSave);
      } catch (err) {
        console.error('Autosave error:', err);
      }
    }, 600);
  }, []);

  // Update Document with Undo/Redo History
  const updateDocument = (newDoc: NotebookDocument, recordHistory = false) => {
    setDoc(newDoc);
    saveDocumentDebounced(newDoc);

    if (recordHistory) {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newDoc);
      if (newHistory.length > 50) newHistory.shift(); // Limit to 50 states
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  };

  // Undo / Redo Handlers
  const handleUndo = () => {
    if (historyIndex > 0) {
      const targetIndex = historyIndex - 1;
      setHistoryIndex(targetIndex);
      setDoc(history[targetIndex]);
      saveDocumentDebounced(history[targetIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const targetIndex = historyIndex + 1;
      setHistoryIndex(targetIndex);
      setDoc(history[targetIndex]);
      saveDocumentDebounced(history[targetIndex]);
    }
  };

  // Toggle Click-to-Ink
  const toggleClickToInk = () => {
    setClickToInkSettings((prev) => ({
      ...prev,
      enabled: !prev.enabled,
    }));
  };

  // Accounting Formats & Tables (Proportionally adapted to current zoom viewport)
  const handleInsertFormat = (formatType: AccountingFormatType, targetDocX?: number, targetDocY?: number) => {
    // Current zoom scale (from stats or last camera)
    const currentZoom = Math.max(0.1, (stats.zoomPercent || 100) / 100);
    // If the user is zoomed out (e.g. 15% or 36%), scale the format so it is comfortable and readable at the current zoom
    const zoomScale = currentZoom < 0.95 ? Math.min(6.0, 1 / currentZoom) : 1.0;

    const meta = ACCOUNTING_FORMAT_CATALOG.find((m) => m.type === formatType);
    const approxW = meta?.recommendedWidth || 680;
    const approxH = 260;

    let placeX = targetDocX;
    let placeY = targetDocY;

    if (placeX === undefined || placeY === undefined) {
      const existingTables = doc.objects.filter((o): o is AccountingTableObject => o.type === 'table');
      if (lastDocCursorPosRef.current) {
        placeX = Math.round(lastDocCursorPosRef.current.x - approxW / 2);
        placeY = Math.round(lastDocCursorPosRef.current.y - approxH / 2);
      } else if (existingTables.length > 0) {
        // Automatically stack cleanly below existing formats to prevent overlapping!
        const lowestTable = existingTables.reduce((prev, curr) => {
          const prevBottom = prev.y + (prev.height || 260);
          const currBottom = curr.y + (curr.height || 260);
          return currBottom > prevBottom ? curr : prev;
        });
        placeX = lowestTable.x;
        placeY = lowestTable.y + (lowestTable.height || 260) + 40;
      } else {
        const center = viewportCenterRef.current;
        placeX = Math.round(center.x - approxW / 2);
        placeY = Math.round(center.y - approxH / 2);
      }
    }

    const newTable = createAccountingTable(formatType, placeX, placeY, currencySymbol);

    const updated = {
      ...doc,
      objects: [...doc.objects, newTable],
    };
    updateDocument(updated, true);
    setSelectedTableId(newTable.id);
    setSelectedIds([newTable.id]);
    setIsLibraryOpen(false);
    setActiveTool('select');

    if (newTable.rows[0]?.id && newTable.columns[0]?.id) {
      setInitialFocusedCell({ rowId: newTable.rows[0].id, colId: newTable.columns[0].id });
    }
  };

  const handleDeleteRowWithUndo = (row: TableRow, index: number) => {
    if (!selectedTableId) return;
    setRowUndoToast({
      tableId: selectedTableId,
      row,
      index,
      title: 'Account row deleted',
    });
  };

  const handleUndoDeleteRow = () => {
    if (!rowUndoToast) return;
    const targetTable = doc.objects.find(
      (o): o is AccountingTableObject => o.id === rowUndoToast.tableId && o.type === 'table'
    );
    if (!targetTable) return;

    const rowsCopy = [...targetTable.rows];
    rowsCopy.splice(rowUndoToast.index, 0, rowUndoToast.row);

    const updatedTable = recalculateTableAutoSums({
      ...targetTable,
      rows: rowsCopy,
      height: targetTable.height + 30,
    });

    const updated = {
      ...doc,
      objects: doc.objects.map((o) => (o.id === updatedTable.id ? updatedTable : o)),
    };
    updateDocument(updated, true);
    setRowUndoToast(null);
  };

  // Auto-dismiss row deletion undo toast after 5 seconds
  useEffect(() => {
    if (rowUndoToast) {
      const timer = window.setTimeout(() => {
        setRowUndoToast(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [rowUndoToast]);

  const selectedTable =
    (doc.objects.find((o) => o.id === selectedTableId && o.type === 'table') as AccountingTableObject) || null;

  const handleUpdateSelectedTable = (updatedTable: AccountingTableObject) => {
    const updated = {
      ...doc,
      objects: doc.objects.map((o) => (o.id === updatedTable.id ? updatedTable : o)),
    };
    updateDocument(updated, true);
  };

  const handleChangeCurrency = (newSymbol: string) => {
    setCurrencySymbol(newSymbol);
    if (selectedTable) {
      const updatedCols = selectedTable.columns.map((c) => {
        if (c.format === 'currency') {
          return {
            ...c,
            label: c.label.replace(/\([$,₹,€,£]\)/, `(${newSymbol})`),
          };
        }
        return c;
      });
      handleUpdateSelectedTable({
        ...selectedTable,
        currencySymbol: newSymbol,
        columns: updatedCols,
      });
    }
  };

  // Zoom and Canvas Helpers
  const handleZoomIn = () => window.dispatchEvent(new CustomEvent('canvas:zoom-in'));
  const handleZoomOut = () => window.dispatchEvent(new CustomEvent('canvas:zoom-out'));
  const handleResetZoom = () => window.dispatchEvent(new CustomEvent('canvas:zoom-reset'));

  const handleResetCanvas = () => {
    const blankDoc = {
      ...doc,
      objects: [],
    };
    updateDocument(blankDoc, true);
    setSelectedTableId(null);
  };

  // Mode Switch (Notebook vs Canvas)
  const toggleMode = (mode: 'notebook' | 'canvas') => {
    updateDocument({ ...doc, currentMode: mode }, true);
  };

  // Page Operations
  const handleAddPage = (template: PageTemplate = 'lined', sizeFormat: PageSize = 'A4') => {
    const dim = PAGE_SIZE_DIMENSIONS[sizeFormat] || PAGE_SIZE_DIMENSIONS.A4;
    const lastPage = doc.pages[doc.pages.length - 1];

    let newX = 0;
    let newY = 0;

    if (doc.currentMode === 'notebook') {
      newY = lastPage ? lastPage.y + lastPage.height + 40 : 0;
    } else {
      // In canvas mode, place next to last page or diagonally
      newX = lastPage ? lastPage.x + lastPage.width + 60 : 0;
      newY = lastPage ? lastPage.y : 0;
    }

    const newPage: PageFrame = {
      id: 'page-' + (doc.pages.length + 1),
      title: `Page ${doc.pages.length + 1}`,
      pageNumber: doc.pages.length + 1,
      x: newX,
      y: newY,
      width: dim.width,
      height: dim.height,
      sizeFormat,
      orientation: 'portrait',
      template,
      templateSpacing: 28,
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    updateDocument(
      {
        ...doc,
        pages: [...doc.pages, newPage],
        activePageId: newPage.id,
      },
      true
    );
  };

  const handleDuplicatePage = (pageId: string) => {
    const targetPage = doc.pages.find((p) => p.id === pageId);
    if (!targetPage) return;

    const newPageId = 'page-' + (doc.pages.length + 1);
    const newPage: PageFrame = {
      ...targetPage,
      id: newPageId,
      title: `${targetPage.title} (Copy)`,
      pageNumber: doc.pages.length + 1,
      y: targetPage.y + targetPage.height + 40,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Duplicate objects on this page
    const pageObjects = doc.objects
      .filter((o) => o.pageId === pageId)
      .map((o) => ({
        ...o,
        id: o.id + '-copy',
        pageId: newPageId,
        y: o.y + (targetPage.height + 40),
      }));

    updateDocument(
      {
        ...doc,
        pages: [...doc.pages, newPage],
        objects: [...doc.objects, ...pageObjects],
        activePageId: newPageId,
      },
      true
    );
  };

  const handleDeletePage = (pageId: string) => {
    if (doc.pages.length <= 1) return;
    const filteredPages = doc.pages.filter((p) => p.id !== pageId);
    const filteredObjects = doc.objects.filter((o) => o.pageId !== pageId);
    const nextActive = filteredPages[0]?.id || '';

    updateDocument(
      {
        ...doc,
        pages: filteredPages,
        objects: filteredObjects,
        activePageId: nextActive,
      },
      true
    );
  };

  const handleReorderPage = (pageId: string, direction: 'up' | 'down') => {
    const index = doc.pages.findIndex((p) => p.id === pageId);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === doc.pages.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const pagesCopy = [...doc.pages];
    const [moved] = pagesCopy.splice(index, 1);
    pagesCopy.splice(targetIndex, 0, moved);

    // If in notebook mode, recalculate continuous vertical stacking coordinates
    if (doc.currentMode === 'notebook') {
      let currentY = 0;
      pagesCopy.forEach((p, idx) => {
        p.pageNumber = idx + 1;
        p.x = 0;
        p.y = currentY;
        currentY += p.height + 40;
      });
    }

    updateDocument({ ...doc, pages: pagesCopy }, true);
  };

  const handleUpdatePage = (pageId: string, updates: Partial<PageFrame>) => {
    const updatedPages = doc.pages.map((p) =>
      p.id === pageId ? { ...p, ...updates, updatedAt: Date.now() } : p
    );
    updateDocument({ ...doc, pages: updatedPages }, true);
  };

  // Convert Layout in Canvas Mode (Grid / Row / Column)
  const handleConvertLayout = (layoutType: 'grid' | 'row' | 'column') => {
    const pagesCopy = [...doc.pages];
    const gap = 80;

    if (layoutType === 'grid') {
      const cols = Math.ceil(Math.sqrt(pagesCopy.length));
      pagesCopy.forEach((p, idx) => {
        const row = Math.floor(idx / cols);
        const col = idx % cols;
        p.x = col * (p.width + gap);
        p.y = row * (p.height + gap);
      });
    } else if (layoutType === 'row') {
      let currentX = 0;
      pagesCopy.forEach((p) => {
        p.x = currentX;
        p.y = 0;
        currentX += p.width + gap;
      });
    } else if (layoutType === 'column') {
      let currentY = 0;
      pagesCopy.forEach((p) => {
        p.x = 0;
        p.y = currentY;
        currentY += p.height + gap;
      });
    }

    updateDocument({ ...doc, pages: pagesCopy }, true);
  };

  // Export File Formats
  const handleExport = async (format: 'inb' | 'png' | 'svg' | 'markdown' | 'pdf') => {
    if (format === 'inb') {
      const blob = await InbFormatService.exportToInb(doc);
      InbFormatService.downloadBlob(blob, `${doc.title || 'InfinityNotebook'}.inb`);
    } else if (format === 'png') {
      const renderer = new CanvasRenderer();
      const blob = await InbFormatService.exportToPng(doc, renderer, theme, 2);
      InbFormatService.downloadBlob(blob, `${doc.title || 'InfinityNotebook'}.png`);
    } else if (format === 'svg') {
      const svg = InbFormatService.exportToSvg(doc);
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      InbFormatService.downloadBlob(blob, `${doc.title || 'InfinityNotebook'}.svg`);
    } else if (format === 'markdown') {
      const md = InbFormatService.exportToMarkdown(doc);
      const blob = new Blob([md], { type: 'text/markdown' });
      InbFormatService.downloadBlob(blob, `${doc.title || 'InfinityNotebook'}.md`);
    } else if (format === 'pdf') {
      // Standard browser vector print to PDF dialog
      window.print();
    }
  };

  // Import File (.inb or Image)
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.inb') || file.name.endsWith('.zip')) {
      try {
        const importedDoc = await InbFormatService.importFromInb(file);
        updateDocument(importedDoc, true);
      } catch (err) {
        alert('Failed to parse .inb archive: ' + (err instanceof Error ? err.message : 'Unknown error'));
      }
    } else if (file.type.startsWith('image/')) {
      // Import image onto active page
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const activePage = doc.pages.find((p) => p.id === doc.activePageId) || doc.pages[0];
          const maxDim = 400;
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const w = img.width * scale;
          const h = img.height * scale;

          // Place directly at user's cursor position if available, otherwise current open viewport center
          let targetX = Math.round(viewportCenterRef.current.x - w / 2);
          let targetY = Math.round(viewportCenterRef.current.y - h / 2);
          if (lastDocCursorPosRef.current) {
            targetX = Math.round(lastDocCursorPosRef.current.x - w / 2);
            targetY = Math.round(lastDocCursorPosRef.current.y - h / 2);
          }

          const imageObj = {
            id: 'img-' + Math.random().toString(36).substring(2, 9),
            pageId: activePage ? activePage.id : null,
            type: 'image' as const,
            layerId: 'layer-images',
            x: targetX,
            y: targetY,
            width: w,
            height: h,
            src: reader.result as string,
            aspectRatio: img.width / img.height,
            originalWidth: img.width,
            originalHeight: img.height,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            deviceId: 'local',
          };

          updateDocument({ ...doc, objects: [...doc.objects, imageObj] }, true);
          setSelectedIds([imageObj.id]);
          setSelectedTableId(null);
          setActiveTool('select');
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  // Benchmark Stress Test: Generate 1,000 or 10,000 Strokes
  const handleGenerateBenchmarkStrokes = (count: number) => {
    const colors = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#09090b'];
    const newStrokes: StrokeObject[] = [];
    const activePage = doc.pages[0];
    const baseX = activePage ? activePage.x : 0;
    const baseY = activePage ? activePage.y : 0;

    for (let s = 0; s < count; s++) {
      const cx = baseX + Math.random() * (activePage?.width || 800);
      const cy = baseY + Math.random() * (activePage?.height || 1100);
      const pts: StrokePoint[] = [];
      const numPts = 6;

      for (let p = 0; p < numPts; p++) {
        pts.push({
          x: cx + (p - numPts / 2) * 8 + (Math.random() - 0.5) * 12,
          y: cy + Math.sin(p * 0.8) * 10 + (Math.random() - 0.5) * 8,
          pressure: 0.6 + Math.random() * 0.3,
          time: performance.now(),
        });
      }

      newStrokes.push({
        id: `bench-stroke-${s}`,
        pageId: activePage ? activePage.id : null,
        type: 'stroke',
        layerId: 'layer-ink',
        x: cx - 20,
        y: cy - 20,
        width: 40,
        height: 40,
        penType: 'ballpoint',
        color: colors[s % colors.length],
        size: 2.0,
        opacity: 0.85,
        points: pts,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deviceId: 'benchmark',
      });
    }

    updateDocument({ ...doc, objects: [...doc.objects, ...newStrokes] }, false);
  };

  const handleClearBenchmarkStrokes = () => {
    const cleaned = doc.objects.filter((o) => !o.id.startsWith('bench-stroke-'));
    updateDocument({ ...doc, objects: cleaned }, false);
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Toggle Click-to-Ink: Ctrl+Shift+L
      if (e.ctrlKey && e.shiftKey && e.code === 'KeyL') {
        e.preventDefault();
        toggleClickToInk();
        return;
      }

      // Toggle Left Properties Sidebar: Ctrl+\ or Alt+S
      if ((e.ctrlKey && e.key === '\\') || (e.altKey && (e.key === 's' || e.key === 'S'))) {
        e.preventDefault();
        setIsPropertiesOpen((prev) => !prev);
        return;
      }

      // Undo / Redo
      if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }
      if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Command Palette: Ctrl+K or Ctrl+/
      if (e.ctrlKey && (e.key === 'k' || e.key === 'K' || e.key === '/')) {
        e.preventDefault();
        setIsCommandPaletteOpen(true);
        return;
      }

      // Settings: Ctrl+,
      if ((e.ctrlKey || e.metaKey) && (e.key === ',' || e.code === 'Comma')) {
        e.preventDefault();
        setIsSettingsOpen(true);
        return;
      }

      // Canvas Zoom In: Ctrl + Plus / Ctrl + Equal
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+' || e.code === 'Equal' || e.code === 'NumpadAdd')) {
        e.preventDefault();
        handleZoomIn();
        return;
      }

      // Canvas Zoom Out: Ctrl + Minus
      if ((e.ctrlKey || e.metaKey) && (e.key === '-' || e.key === '_' || e.code === 'Minus' || e.code === 'NumpadSubtract')) {
        e.preventDefault();
        handleZoomOut();
        return;
      }

      // Reset Canvas Zoom: Ctrl + 0
      if ((e.ctrlKey || e.metaKey) && (e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0')) {
        e.preventDefault();
        handleResetZoom();
        return;
      }

      // Zoom to Fit: Shift + 1
      if (e.shiftKey && (e.key === '!' || e.key === '1' || e.code === 'Digit1')) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('canvas:zoom-fit'));
        return;
      }

      // Don't intercept single-key shortcuts if typing in text inputs or textareas
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      // Draw to shape toggle: Shift+X
      if (e.shiftKey && (e.key === 'x' || e.key === 'X')) {
        e.preventDefault();
        setIsDrawToShape((prev) => !prev);
        return;
      }

      // If modifier keys are held, don't trigger tool shortcuts
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const key = e.key.toLowerCase();

      // Tool and Shape Switching Shortcuts
      if (key === 'h') {
        handleSelectTool('hand');
      } else if (key === 'v' || key === '1') {
        handleSelectTool('select');
      } else if (key === 'r' || key === '2') {
        handleSelectTool('shape');
        setActiveShape('rectangle');
      } else if (key === 'd' || key === '3') {
        handleSelectTool('shape');
        setActiveShape('polygon'); // Diamond
      } else if (key === 'o' || key === '4') {
        handleSelectTool('shape');
        setActiveShape('ellipse');
      } else if (key === 'a' || key === '5') {
        handleSelectTool('shape');
        setActiveShape('arrow');
      } else if (key === 'l' || key === '6') {
        handleSelectTool('shape');
        setActiveShape('line');
      } else if (key === 'p' || key === '7') {
        handleSelectTool('pen');
      } else if (key === 't' || key === '8') {
        handleSelectTool('text');
      } else if (key === 's') {
        handleSelectTool('sticky');
      } else if (key === 'k') {
        handleSelectTool('laser');
      } else if (key === 'b') {
        handleSelectTool('bucket');
      } else if (key === 'f') {
        handleSelectTool('frame');
      } else if (key === '9') {
        if (fileInputRef.current) {
          fileInputRef.current.accept = 'image/*';
          fileInputRef.current.click();
        }
      } else if (key === 'e' || key === '0') {
        handleSelectTool('eraser');
      } else if (key === 'escape') {
        setSelectedIds([]);
        setSelectedTableId(null);
        handleSelectTool('select');
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          e.preventDefault();
          const remaining = doc.objects.filter((o) => !selectedIds.includes(o.id));
          setSelectedIds([]);
          updateDocument({ ...doc, objects: remaining }, true);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [clickToInkSettings, historyIndex, history, selectedIds, doc]);

  // Command Palette Items
  const commandItems = [
    {
      id: 'cmd-click-to-ink',
      title: 'Toggle Click-to-Ink (Hands-Free Drawing)',
      category: 'Drawing',
      shortcut: 'Ctrl+Shift+L',
      icon: <span className="font-bold">∞</span>,
      action: () => toggleClickToInk(),
    },
    {
      id: 'cmd-draw-to-shape',
      title: 'Toggle Draw to Shape (Auto-recognize shapes)',
      category: 'Drawing',
      shortcut: 'Shift+X',
      icon: <span className="font-bold">✨</span>,
      action: () => setIsDrawToShape((prev) => !prev),
    },
    {
      id: 'cmd-laser',
      title: 'Laser Pointer Tool',
      category: 'Drawing',
      shortcut: 'K',
      icon: <span className="font-bold">🪄</span>,
      action: () => handleSelectTool('laser'),
    },
    {
      id: 'cmd-bucket',
      title: 'Bucket Fill Tool',
      category: 'Drawing',
      shortcut: 'B',
      icon: <span className="font-bold">🪣</span>,
      action: () => handleSelectTool('bucket'),
    },
    {
      id: 'cmd-frame',
      title: 'Frame Tool',
      category: 'Drawing',
      shortcut: 'F',
      icon: <span className="font-bold">🖼️</span>,
      action: () => handleSelectTool('frame'),
    },
    {
      id: 'cmd-lasso',
      title: 'Lasso Selection Tool',
      category: 'Selection',
      icon: <span className="font-bold">➰</span>,
      action: () => handleSelectTool('lasso'),
    },
    {
      id: 'cmd-web-embed',
      title: 'Web Embed (YouTube, Figma, Links)',
      category: 'Insert',
      icon: <span className="font-bold">🌐</span>,
      action: () => setIsWebEmbedOpen(true),
    },
    {
      id: 'cmd-mermaid',
      title: 'Mermaid to Excalidraw (Generate Diagrams)',
      category: 'Generate',
      icon: <span className="font-bold">📊</span>,
      action: () => setIsMermaidOpen(true),
    },
    {
      id: 'cmd-settings',
      title: 'Settings (Touchpad & Mouse, Click-to-Ink & Preferences)',
      category: 'Preferences',
      shortcut: 'Ctrl+,',
      icon: <span className="font-bold">⚙️</span>,
      action: () => setIsSettingsOpen(true),
    },
    {
      id: 'cmd-notebook-mode',
      title: 'Switch to Notebook Mode (Endless Pages)',
      category: 'View Mode',
      icon: <span className="font-bold">📖</span>,
      action: () => toggleMode('notebook'),
    },
    {
      id: 'cmd-canvas-mode',
      title: 'Switch to Infinite Canvas Mode (Whiteboard)',
      category: 'View Mode',
      icon: <span className="font-bold">📐</span>,
      action: () => toggleMode('canvas'),
    },
    {
      id: 'cmd-new-page',
      title: 'Add New Page to Notebook',
      category: 'Pages',
      icon: <span className="font-bold">+</span>,
      action: () => handleAddPage(),
    },
    {
      id: 'cmd-export-inb',
      title: 'Export Infinity Archive (.inb)',
      category: 'Export',
      icon: <span className="font-bold">💾</span>,
      action: () => handleExport('inb'),
    },
    {
      id: 'cmd-export-png',
      title: 'Export High-Res PNG Image',
      category: 'Export',
      icon: <span className="font-bold">🖼️</span>,
      action: () => handleExport('png'),
    },
    {
      id: 'cmd-export-pdf',
      title: 'Export Multi-Page PDF Document',
      category: 'Export',
      icon: <span className="font-bold">📄</span>,
      action: () => handleExport('pdf'),
    },
    {
      id: 'cmd-theme-toggle',
      title: 'Switch Theme (Light / Dark / Warm Paper)',
      category: 'Appearance',
      icon: <span className="font-bold">🎨</span>,
      action: () => setTheme(theme === 'dark' ? 'paper' : theme === 'paper' ? 'light' : 'dark'),
    },
    {
      id: 'cmd-benchmark',
      title: 'Open Performance Diagnostics & 10k Stroke Benchmark',
      category: 'Diagnostics',
      icon: <span className="font-bold">⚡</span>,
      action: () => setIsBenchmarkOpen(true),
    },
    {
      id: 'cmd-tutorial',
      title: 'Show Gesture Tutorial & Quick Tour',
      category: 'Help',
      icon: <span className="font-bold">💡</span>,
      action: () => setIsTutorialOpen(true),
    },
  ];

  const handleUpdateSelectedObject = (updates: Partial<CanvasObject>) => {
    if (selectedIds.length === 0) return;
    const updated = doc.objects.map((o) => {
      if (selectedIds.includes(o.id)) {
        if (o.type === 'text') {
          const t = o as TextObject;
          const nextFontSize = (updates as Partial<TextObject>).fontSize ?? t.fontSize;
          const nextFontFamily = (updates as Partial<TextObject>).fontFamily ?? t.fontFamily;
          const nextText = (updates as Partial<TextObject>).text ?? t.text;
          const nextBold = (updates as Partial<TextObject>).bold ?? t.bold ?? false;
          const nextItalic = (updates as Partial<TextObject>).italic ?? t.italic ?? false;
          const dims = measureTextBounds(nextText, nextFontSize, nextFontFamily, nextBold, nextItalic);
          return {
            ...t,
            ...updates,
            width: dims.width,
            height: dims.height,
            updatedAt: Date.now(),
          };
        }
        return { ...o, ...updates, updatedAt: Date.now() };
      }
      return o;
    }) as CanvasObject[];
    updateDocument({ ...doc, objects: updated }, true);
  };

  const handleUpdateStickyConfig = (updates: Partial<StickyConfig>) => {
    setStickyConfig((prev) => ({ ...prev, ...updates }));
    if (selectedObject && selectedObject.type === 'sticky') {
      handleUpdateSelectedObject(updates);
    }
  };

  const handleUpdateTextConfig = (updates: Partial<TextConfig>) => {
    setTextConfig((prev) => ({ ...prev, ...updates }));
    if (selectedObject && selectedObject.type === 'text') {
      handleUpdateSelectedObject(updates);
    }
  };

  const handleUpdateShapeConfig = (updates: Partial<ShapeConfig>) => {
    setShapeConfig((prev) => ({ ...prev, ...updates }));
    if (selectedObject && selectedObject.type === 'shape') {
      const curShape = selectedObject as ShapeObject;
      const newShapeType =
        updates.rounded !== undefined
          ? updates.rounded
            ? 'rounded_rect'
            : 'rectangle'
          : curShape.shapeType;

      const updatedShape: ShapeObject = {
        ...curShape,
        strokeColor: updates.strokeColor ?? curShape.strokeColor,
        fillColor: updates.fillColor ?? curShape.fillColor,
        strokeWidth: updates.strokeWidth ?? curShape.strokeWidth,
        strokeStyle: updates.strokeStyle ?? curShape.strokeStyle,
        fillStyle: updates.fillStyle ?? curShape.fillStyle,
        roughness: updates.roughness ?? curShape.roughness,
        opacity: updates.opacity ?? curShape.opacity ?? 1,
        shapeType:
          curShape.shapeType === 'rectangle' || curShape.shapeType === 'rounded_rect'
            ? newShapeType
            : curShape.shapeType,
      };

      const updated = {
        ...doc,
        objects: doc.objects.map((o) => (o.id === updatedShape.id ? updatedShape : o)),
      };
      updateDocument(updated, true);
    }
  };

  const handleSendToBack = () => {
    if (selectedIds.length === 0 || doc.objects.length < 2) return;
    const selected = doc.objects.filter((o) => selectedIds.includes(o.id));
    const rest = doc.objects.filter((o) => !selectedIds.includes(o.id));
    updateDocument({ ...doc, objects: [...selected, ...rest] }, true);
  };

  const handleBringToFront = () => {
    if (selectedIds.length === 0 || doc.objects.length < 2) return;
    const selected = doc.objects.filter((o) => selectedIds.includes(o.id));
    const rest = doc.objects.filter((o) => !selectedIds.includes(o.id));
    updateDocument({ ...doc, objects: [...rest, ...selected] }, true);
  };

  const handleSendBackward = () => {
    if (selectedIds.length === 0 || doc.objects.length < 2) return;
    const copy = [...doc.objects];
    for (let i = 1; i < copy.length; i++) {
      if (selectedIds.includes(copy[i].id) && !selectedIds.includes(copy[i - 1].id)) {
        const temp = copy[i];
        copy[i] = copy[i - 1];
        copy[i - 1] = temp;
      }
    }
    updateDocument({ ...doc, objects: copy }, true);
  };

  const handleBringForward = () => {
    if (selectedIds.length === 0 || doc.objects.length < 2) return;
    const copy = [...doc.objects];
    for (let i = copy.length - 2; i >= 0; i--) {
      if (selectedIds.includes(copy[i].id) && !selectedIds.includes(copy[i + 1].id)) {
        const temp = copy[i];
        copy[i] = copy[i + 1];
        copy[i + 1] = temp;
      }
    }
    updateDocument({ ...doc, objects: copy }, true);
  };

  return (
    <div className="w-screen h-screen overflow-hidden flex flex-col bg-stone-100 dark:bg-stone-950 font-sans text-stone-900 dark:text-stone-100">
      {/* Hidden File Input for .inb and image import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".inb,.zip,image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* 1. Top-Left Excalidraw Hamburger Menu (≡) */}
      <ExcalidrawMenu
        onOpen={handleImportClick}
        onSave={() => handleExport('inb')}
        onExport={() => handleExport('png')}
        onCommandPalette={() => setIsCommandPaletteOpen(true)}
        onHelp={() => setIsTutorialOpen(true)}
        onResetCanvas={handleResetCanvas}
        theme={theme}
        onChangeTheme={(t) => setTheme(t)}
        canvasBg={canvasBg}
        onChangeCanvasBg={(bg) => setCanvasBg(bg)}
        onOpenAddFormat={() => setIsAddFormatOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* 2. Top-Center Floating Excalidraw Tool Dock */}
      <ExcalidrawTopBar
        activeTool={activeTool}
        onSelectTool={handleSelectTool}
        activeShape={activeShape}
        onSelectShape={(shape) => setActiveShape(shape)}
        activePen={activePen}
        onSelectPen={(penUpdates) => setActivePen((prev) => ({ ...prev, ...penUpdates }))}
        isLocked={isToolLocked}
        onToggleLock={() => setIsToolLocked(!isToolLocked)}
        onOpenAddFormat={() => setIsAddFormatOpen(true)}
        onOpenLibrary={() => setIsLibraryOpen(!isLibraryOpen)}
        isLibraryOpen={isLibraryOpen}
        onInsertImage={() => {
          if (fileInputRef.current) {
            fileInputRef.current.accept = 'image/*';
            fileInputRef.current.click();
          }
        }}
        isDrawToShape={isDrawToShape}
        onToggleDrawToShape={() => setIsDrawToShape((prev) => !prev)}
        onOpenWebEmbed={() => setIsWebEmbedOpen(true)}
        onOpenMermaid={() => setIsMermaidOpen(true)}
      />

      {/* 3. Top-Right Floating Controls (Library 📖 & Export) */}
      <div className="fixed top-3 right-3 z-40 flex items-center gap-1.5 select-none">
        <button
          onClick={() => setIsLibraryOpen(!isLibraryOpen)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold backdrop-blur-md border shadow-md transition-all ${
            isLibraryOpen
              ? 'bg-blue-600 text-white border-blue-600 shadow-blue-500/20'
              : 'bg-white/95 dark:bg-stone-900/95 text-stone-700 dark:text-stone-300 border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
          title="Open Accounting & Shape Library"
        >
          <BookOpen className="w-4 h-4" />
          <span className="hidden sm:inline">Library</span>
        </button>

        <button
          onClick={() => handleExport('png')}
          className="p-2 rounded-xl bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border border-stone-200 dark:border-stone-800 shadow-md text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          title="Export as PNG image"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>

      {/* 4. Left Properties Panel (Colors, Stroke Widths, Brushes, Eraser Mode, Text, Sticky, Shapes, One-Click Inking) */}
      <ExcalidrawPropertiesPanel
        isOpen={isPropertiesOpen}
        onToggle={() => setIsPropertiesOpen((prev) => !prev)}
        activeTool={activeTool}
        activePen={activePen}
        onUpdatePen={(updates) => setActivePen((prev) => ({ ...prev, ...updates }))}
        shapeConfig={shapeConfig}
        onUpdateShapeConfig={handleUpdateShapeConfig}
        textConfig={textConfig}
        onUpdateTextConfig={handleUpdateTextConfig}
        stickyConfig={stickyConfig}
        onUpdateStickyConfig={handleUpdateStickyConfig}
        eraserMode={eraserMode}
        onChangeEraserMode={(m) => setEraserMode(m)}
        eraserSize={eraserSize}
        onChangeEraserSize={(size) => setEraserSize(size)}
        clickToInkEnabled={clickToInkSettings.enabled}
        onToggleClickToInk={toggleClickToInk}
        onSendToBack={handleSendToBack}
        onSendBackward={handleSendBackward}
        onBringForward={handleBringForward}
        onBringToFront={handleBringToFront}
        selectedObject={selectedObject}
        onUpdateSelectedObject={handleUpdateSelectedObject}
      />

      {/* 5. Right Library & Formats Drawer */}
      <ExcalidrawLibraryDrawer
        isOpen={isLibraryOpen}
        onClose={() => setIsLibraryOpen(false)}
        onInsertFormat={handleInsertFormat}
      />

      {/* 6. Bottom-Left Zoom & Undo/Redo Dock */}
      <ExcalidrawBottomBar
        zoomPercent={stats.zoomPercent}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        onZoomFit={() => window.dispatchEvent(new CustomEvent('canvas:zoom-fit'))}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < history.length - 1}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      {/* 7. Full-Screen Infinite Canvas */}
      <div className="w-full h-full relative">
        <InfiniteCanvas
          document={doc}
          onUpdateDocument={updateDocument}
          activeTool={activeTool}
          onSelectTool={handleSelectTool}
          isToolLocked={isToolLocked}
          selectedIds={selectedIds}
          onSelectIds={(ids) => {
            setSelectedIds(ids);
            if (ids.length === 0 || !doc.objects.some((o) => ids.includes(o.id) && o.type === 'table')) {
              setSelectedTableId(null);
            }
          }}
          activePen={activePen}
          shapeConfig={shapeConfig}
          textConfig={textConfig}
          stickyConfig={stickyConfig}
          eraserMode={eraserMode}
          eraserSize={eraserSize}
          activeShape={activeShape}
          clickToInkSettings={clickToInkSettings}
          inputSettings={inputSettings}
          theme={theme}
          canvasBg={canvasBg}
          onClickToInkStateChange={(state) => setClickToInkState(state)}
          onStatsUpdate={(s) => setStats(s)}
          selectedTableId={selectedTableId}
          onSelectTable={(id) => {
            setSelectedTableId(id);
            if (id) {
              setSelectedIds([id]);
            }
          }}
          onDropFormat={(type, x, y) => handleInsertFormat(type, x, y)}
          onDeleteRowWithUndo={handleDeleteRowWithUndo}
          initialFocusedCell={initialFocusedCell}
          onCursorDocMove={(pt) => {
            lastDocCursorPosRef.current = pt;
          }}
          onViewportCenterChange={(pt) => {
            viewportCenterRef.current = pt;
          }}
          isDrawToShape={isDrawToShape}
          onChangeCanvasBg={(bg) => setCanvasBg(bg)}
        />
      </div>

      {/* Draw to Shape Active Floating Badge */}
      {isDrawToShape && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 bg-indigo-600 text-white rounded-full text-xs font-semibold shadow-lg backdrop-blur-md flex items-center gap-1.5 animate-in fade-in slide-in-from-top-2 duration-150 select-none">
          <span>✨ Draw to shape active</span>
          <span className="text-[10px] bg-indigo-700/80 px-1.5 py-0.5 rounded font-mono">Shift+X</span>
        </div>
      )}

      {/* 8. Row Deletion Undo Toast */}
      {rowUndoToast && (
        <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-50 bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 px-4 py-2.5 rounded-xl shadow-2xl border border-stone-700 dark:border-stone-300 flex items-center gap-3 text-xs animate-in slide-in-from-bottom-3 duration-150 select-none">
          <span className="font-medium">{rowUndoToast.title}</span>
          <button
            onClick={handleUndoDeleteRow}
            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-xs"
          >
            Undo
          </button>
        </div>
      )}

      {/* Modals & Dialogs */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        clickToInkSettings={clickToInkSettings}
        onUpdateClickToInkSettings={(updates) =>
          setClickToInkSettings((prev) => ({ ...prev, ...updates }))
        }
        inputSettings={inputSettings}
        onUpdateInputSettings={(updates) =>
          setInputSettings((prev) => ({ ...prev, ...updates }))
        }
        theme={theme}
        onChangeTheme={(t) => setTheme(t)}
        syncStatus={syncStatus}
        onConnectLocalFolder={() => syncEngineRef.current.connectLocalFolder()}
        onSetEncryptionPassphrase={(pass) => syncEngineRef.current.setEncryptionPassphrase(pass)}
        onCreateSnapshot={(name) => storageServiceRef.current.createSnapshot(doc, name)}
        storageEstimate={storageEstimate}
      />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        commands={commandItems}
      />

      <BenchmarkModal
        isOpen={isBenchmarkOpen}
        onClose={() => setIsBenchmarkOpen(false)}
        stats={stats}
        onGenerateStrokes={handleGenerateBenchmarkStrokes}
        onClearBenchmarkStrokes={handleClearBenchmarkStrokes}
      />

      <TutorialModal
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
      />

      <AddFormatModal
        isOpen={isAddFormatOpen}
        onClose={() => setIsAddFormatOpen(false)}
        onSelectFormat={handleInsertFormat}
      />

      {/* Web Embed Modal */}
      <WebEmbedModal
        isOpen={isWebEmbedOpen}
        onClose={() => setIsWebEmbedOpen(false)}
        onInsertEmbed={(embed) => {
          updateDocument({ ...doc, objects: [...doc.objects, embed] }, true);
          setSelectedIds([embed.id]);
          setActiveTool('select');
        }}
        viewportCenter={viewportCenterRef.current}
      />

      {/* Mermaid to Excalidraw Modal */}
      <MermaidModal
        isOpen={isMermaidOpen}
        onClose={() => setIsMermaidOpen(false)}
        onInsertObjects={(newObjs) => {
          updateDocument({ ...doc, objects: [...doc.objects, ...newObjs] }, true);
          setSelectedIds(newObjs.map((o) => o.id));
          setActiveTool('select');
        }}
        viewportCenter={viewportCenterRef.current}
        theme={theme}
      />
    </div>
  );
}
