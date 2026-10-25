import React, { useState, useRef, useEffect } from 'react';
import {
  AccountingTableObject,
  TableColumn,
  TableRow,
  TableCell,
  CameraState,
  ToolType,
} from '../../types/document';
import {
  evaluateTableBalance,
  recalculateTableAutoSums,
  applyDrCrMutualExclusivity,
  extractExistingAccountNames,
  ACCOUNT_CATEGORY_LOOKUP,
} from '../../engine/accountingFormats';
import {
  Plus,
  Trash2,
  Move,
  Sigma,
  Download,
  CheckCircle2,
  AlertCircle,
  FileText,
  Printer,
  ChevronDown,
  GripVertical,
  Palette,
} from 'lucide-react';

interface AccountingTableOverlayProps {
  table: AccountingTableObject;
  camera: CameraState;
  isSelected: boolean;
  onSelect: () => void;
  onUpdateTable: (updatedTable: AccountingTableObject) => void;
  onDeleteTable: () => void;
  onDeleteRowWithUndo?: (deletedRow: TableRow, rowIndex: number) => void;
  allTables?: AccountingTableObject[];
  initialFocusedCell?: { rowId: string; colId: string } | null;
  activeTool?: ToolType;
  onSelectTool?: (tool: ToolType) => void;
}

export const AccountingTableOverlay: React.FC<AccountingTableOverlayProps> = ({
  table,
  camera,
  isSelected,
  onSelect,
  onUpdateTable,
  onDeleteTable,
  onDeleteRowWithUndo,
  allTables = [],
  initialFocusedCell = null,
  activeTool = 'select',
  onSelectTool,
}) => {
  const [editingCell, setEditingCell] = useState<{ rowId: string; colId: string } | null>(
    initialFocusedCell || null
  );
  const [resizingColId, setResizingColId] = useState<string | null>(null);
  const resizeStartXRef = useRef<number>(0);
  const resizeStartWidthRef = useRef<number>(0);

  // Table Dragging
  const [isDraggingTable, setIsDraggingTable] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; origX: number; origY: number } | null>(null);

  // Dropdown Menus
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showColorMenu, setShowColorMenu] = useState(false);

  // Autocomplete state
  const [autocompleteQuery, setAutocompleteQuery] = useState('');
  const [showAutocomplete, setShowAutocomplete] = useState(false);

  // Autocomplete accounts cache
  const availableAccounts = extractExistingAccountNames(allTables.length > 0 ? allTables : [table]);

  // Sync initialFocusedCell when provided
  useEffect(() => {
    if (initialFocusedCell) {
      setEditingCell(initialFocusedCell);
    }
  }, [initialFocusedCell]);

  // Transform coordinates to screen space
  const screenX = table.x * camera.zoom + camera.x;
  const screenY = table.y * camera.zoom + camera.y;
  const totalTableWidth = table.columns.reduce((s, c) => s + c.width, 0);

  const balanceInfo = evaluateTableBalance(table);

  // Column resizing handler
  const handleColResizeStart = (e: React.MouseEvent, col: TableColumn) => {
    e.stopPropagation();
    e.preventDefault();
    setResizingColId(col.id);
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = col.width;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = (moveEvent.clientX - resizeStartXRef.current) / camera.zoom;
      const newWidth = Math.max(50, Math.round(resizeStartWidthRef.current + deltaX));
      const updatedCols = table.columns.map((c) =>
        c.id === col.id ? { ...c, width: newWidth } : c
      );
      onUpdateTable({
        ...table,
        columns: updatedCols,
        width: updatedCols.reduce((sum, c) => sum + c.width, 0),
      });
    };

    const onMouseUp = () => {
      setResizingColId(null);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Table dragging handler
  const handleTableDragStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDraggingTable(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      origX: table.x,
      origY: table.y,
    };

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = (moveEvent.clientX - dragStartRef.current.mouseX) / camera.zoom;
      const dy = (moveEvent.clientY - dragStartRef.current.mouseY) / camera.zoom;
      onUpdateTable({
        ...table,
        x: Math.round(dragStartRef.current.origX + dx),
        y: Math.round(dragStartRef.current.origY + dy),
      });
    };

    const onMouseUp = () => {
      setIsDraggingTable(false);
      dragStartRef.current = null;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Whole Table Resize Handler (Bottom-right corner drag scales both columns & rows proportionally)
  const handleWholeTableResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startTotalWidth = table.columns.reduce((s, c) => s + c.width, 0);
    const startRowHeight = table.rowHeight || 32;
    const startHeaderHeight = table.headerHeight || 36;
    const startFontSize = table.fontSize || 12;
    const startTotalHeight =
      table.height ||
      startHeaderHeight +
        table.rows.reduce((s, r) => s + (r.height || startRowHeight), 0);

    const initialColWidths = table.columns.map((c) => c.width);
    const initialRowHeights = table.rows.map((r) => r.height || startRowHeight);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = (moveEvent.clientX - startClientX) / camera.zoom;
      const deltaY = (moveEvent.clientY - startClientY) / camera.zoom;

      const newTotalWidth = Math.max(300, Math.round(startTotalWidth + deltaX));
      const scaleX = newTotalWidth / Math.max(1, startTotalWidth);

      const newTotalHeight = Math.max(100, Math.round(startTotalHeight + deltaY));
      const scaleY = newTotalHeight / Math.max(1, startTotalHeight);

      // Proportional overall font scaling - Infinite scaling with no upper clamp
      const overallScale = (scaleX + scaleY) / 2;
      const newFontSize = Math.max(8, Math.round(startFontSize * overallScale));
      const newRowHeight = Math.max(18, Math.round(startRowHeight * scaleY));
      const newHeaderHeight = Math.max(20, Math.round(startHeaderHeight * scaleY));

      const updatedCols = table.columns.map((c, idx) => ({
        ...c,
        width: Math.max(40, Math.round(initialColWidths[idx] * scaleX)),
      }));

      const updatedRows = table.rows.map((r, idx) => ({
        ...r,
        height: Math.max(22, Math.min(80, Math.round(initialRowHeights[idx] * scaleY))),
      }));

      const finalWidth = updatedCols.reduce((s, c) => s + c.width, 0);
      const finalHeight =
        newHeaderHeight +
        updatedRows.reduce((s, r) => s + (r.height || newRowHeight), 0);

      onUpdateTable({
        ...table,
        columns: updatedCols,
        rows: updatedRows,
        width: finalWidth,
        height: finalHeight,
        fontSize: newFontSize,
        rowHeight: newRowHeight,
        headerHeight: newHeaderHeight,
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  // Add row directly below a specified row
  const handleAddRowBelow = (targetRowId?: string) => {
    const today = new Date().toISOString().split('T')[0];
    const newRowId = 'r-' + Math.random().toString(36).substring(2, 7);
    const newCells: Record<string, TableCell> = {};
    table.columns.forEach((col, idx) => {
      newCells[col.id] = {
        value: col.format === 'date' && idx === 0 ? today : '',
        align: col.align,
        format: col.format,
      };
    });

    const newRow: TableRow = {
      id: newRowId,
      cells: newCells,
      height: table.rowHeight || 32,
    };

    let updatedRows: TableRow[];
    if (targetRowId) {
      const idx = table.rows.findIndex((r) => r.id === targetRowId);
      if (idx !== -1) {
        updatedRows = [
          ...table.rows.slice(0, idx + 1),
          newRow,
          ...table.rows.slice(idx + 1),
        ];
      } else {
        const totalIdx = table.rows.findIndex((r) => r.isTotal);
        updatedRows =
          totalIdx !== -1
            ? [...table.rows.slice(0, totalIdx), newRow, ...table.rows.slice(totalIdx)]
            : [...table.rows, newRow];
      }
    } else {
      const totalIdx = table.rows.findIndex((r) => r.isTotal);
      updatedRows =
        totalIdx !== -1
          ? [...table.rows.slice(0, totalIdx), newRow, ...table.rows.slice(totalIdx)]
          : [...table.rows, newRow];
    }

    const currentH = table.height || ((table.headerHeight || 36) + (table.rows.length * (table.rowHeight || 32)));
    const updated = recalculateTableAutoSums({
      ...table,
      rows: updatedRows,
      height: currentH + (table.rowHeight || 32),
    });
    onUpdateTable(updated);

    // Focus the first editable column of the newly inserted row
    const firstCol = table.columns[0]?.id || 'col1';
    setEditingCell({ rowId: newRowId, colId: firstCol });
  };

  // Delete row with Undo toast
  const handleDeleteRow = (rowId: string) => {
    const rowIndex = table.rows.findIndex((r) => r.id === rowId);
    const rowToDelete = table.rows[rowIndex];
    if (!rowToDelete) return;

    const updatedRows = table.rows.filter((r) => r.id !== rowId);
    const currentH = table.height || ((table.headerHeight || 36) + (table.rows.length * (table.rowHeight || 32)));
    const updated = recalculateTableAutoSums({
      ...table,
      rows: updatedRows,
      height: Math.max(100, currentH - (rowToDelete.height || table.rowHeight || 32)),
    });
    onUpdateTable(updated);

    if (onDeleteRowWithUndo) {
      onDeleteRowWithUndo(rowToDelete, rowIndex);
    }
  };

  // Cell change handler with Debit/Credit mutual exclusivity & number cleanup
  const handleCellChange = (rowId: string, colId: string, rawVal: string) => {
    const col = table.columns.find((c) => c.id === colId);
    let val = rawVal;

    // Numeric validation for currency / numeric columns
    if (col && (col.format === 'currency' || col.isAutoSum)) {
      // Allow only numbers, decimal point, negative sign
      val = val.replace(/[^0-9.-]/g, '');
      // Only allow one decimal point
      const parts = val.split('.');
      if (parts.length > 2) {
        val = parts[0] + '.' + parts.slice(1).join('');
      }
    }

    const updatedRows = table.rows.map((row) => {
      if (row.id === rowId) {
        let updatedCells = {
          ...row.cells,
          [colId]: {
            ...(row.cells[colId] || {}),
            value: val,
          },
        };

        // Apply mutual exclusivity: Debit clears Credit, Credit clears Debit
        updatedCells = applyDrCrMutualExclusivity(table.columns, updatedCells, colId, val);

        return {
          ...row,
          cells: updatedCells,
        };
      }
      return row;
    });

    const updated = recalculateTableAutoSums({
      ...table,
      rows: updatedRows,
    });
    onUpdateTable(updated);

    // Update autocomplete query if this is an account name / description column
    if (
      colId.includes('particulars') ||
      colId.includes('title') ||
      colId.includes('desc') ||
      colId.includes('part') ||
      colId.includes('account')
    ) {
      setAutocompleteQuery(val);
      setShowAutocomplete(val.trim().length > 0);
    } else {
      setShowAutocomplete(false);
    }
  };

  // Select autocomplete option
  const handleSelectAutocomplete = (rowId: string, colId: string, accountName: string) => {
    handleCellChange(rowId, colId, accountName);
    setShowAutocomplete(false);
  };

  // Keyboard navigation between cells (Tab, Shift+Tab, Enter, Auto-new-row)
  const handleCellKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    rowIndex: number,
    colIndex: number
  ) => {
    const editableRows = table.rows.filter((r) => !r.isTotal);
    const isLastEditableRow = rowIndex === editableRows.length - 1;
    const isLastColumn = colIndex === table.columns.length - 1;

    if (e.key === 'Tab') {
      e.preventDefault();
      setShowAutocomplete(false);

      if (e.shiftKey) {
        // Shift + Tab: Move Left
        if (colIndex > 0) {
          setEditingCell({
            rowId: table.rows[rowIndex].id,
            colId: table.columns[colIndex - 1].id,
          });
        } else if (rowIndex > 0) {
          setEditingCell({
            rowId: table.rows[rowIndex - 1].id,
            colId: table.columns[table.columns.length - 1].id,
          });
        }
      } else {
        // Tab: Move Right
        if (colIndex < table.columns.length - 1) {
          setEditingCell({
            rowId: table.rows[rowIndex].id,
            colId: table.columns[colIndex + 1].id,
          });
        } else if (isLastEditableRow) {
          // Tab on last cell of last row: AUTOMATICALLY SPAWN NEW ROW!
          handleAddRowBelow(table.rows[rowIndex].id);
        } else if (rowIndex + 1 < editableRows.length) {
          setEditingCell({
            rowId: table.rows[rowIndex + 1].id,
            colId: table.columns[0].id,
          });
        }
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      setShowAutocomplete(false);

      if (isLastEditableRow) {
        // Enter on last editable row: AUTOMATICALLY SPAWN NEW ROW!
        handleAddRowBelow(table.rows[rowIndex].id);
      } else if (rowIndex + 1 < editableRows.length) {
        // Enter moves down to same column in next row
        setEditingCell({
          rowId: table.rows[rowIndex + 1].id,
          colId: table.columns[colIndex].id,
        });
      } else {
        setEditingCell(null);
      }
    } else if (e.key === 'Escape') {
      setShowAutocomplete(false);
      setEditingCell(null);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const headerLine = table.columns.map((c) => `"${c.label}"`).join(',');
    const rowLines = table.rows.map((r) =>
      table.columns.map((c) => `"${(r.cells[c.id]?.value || '').replace(/"/g, '""')}"`).join(',')
    );
    const csvContent = [headerLine, ...rowLines].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${table.title.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setShowExportMenu(false);
  };

  // Export PNG of Table
  const handleExportPNG = () => {
    const tableEl = document.getElementById(`table-container-${table.id}`);
    if (!tableEl) return;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(`
        <html>
          <head>
            <title>${table.title}</title>
            <style>
              body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #0f172a; }
              table { border-collapse: collapse; width: 100%; font-size: 13px; }
              th, td { border: 1px solid #cbd5e1; padding: 8px 12px; }
              th { background: #f8fafc; font-weight: 600; }
              .text-right { text-align: right; }
              .text-center { text-align: center; }
              .font-bold { font-weight: bold; }
              .double-line { border-bottom: 3px double #475569; }
            </style>
          </head>
          <body>
            <h2>${table.title}</h2>
            ${tableEl.innerHTML}
          </body>
        </html>
      `);
      printWin.document.close();
      printWin.print();
    }
    setShowExportMenu(false);
  };

  // Filter autocomplete suggestions with smart ranking (starts-with first)
  const q = autocompleteQuery.trim().toLowerCase();
  const startsWithMatches = availableAccounts.filter(
    (name) => name.toLowerCase().startsWith(q) && name.toLowerCase() !== q
  );
  const containsMatches = availableAccounts.filter(
    (name) => !name.toLowerCase().startsWith(q) && name.toLowerCase().includes(q) && name.toLowerCase() !== q
  );
  const filteredSuggestions = [...startsWithMatches, ...containsMatches].slice(0, 10);

  const isTransparent = table.bgColor === 'transparent';
  const tableBgColor = isTransparent ? 'transparent' : (table.bgColor || undefined);
  const tableTextColor = table.textColor || undefined;
  const baseFontSize = table.fontSize || 12;
  const baseRowHeight = table.rowHeight || 32;
  const baseHeaderHeight = table.headerHeight || 36;
  const tbScale = Math.max(1, baseFontSize / 12);
  const tbIconSize = Math.max(14, Math.round(14 * tbScale));
  const isDrawingTool = activeTool === 'pen' || activeTool === 'laser' || activeTool === 'eraser' || activeTool === 'shape' || activeTool === 'bucket' || activeTool === 'lasso';

  return (
    <div
      onPointerDown={(e) => {
        if (isDrawingTool) return;
        e.stopPropagation();
        onSelect();
      }}
      onMouseDown={(e) => {
        if (isDrawingTool) return;
        e.stopPropagation();
        onSelect();
      }}
      onClick={(e) => {
        if (isDrawingTool) return;
        e.stopPropagation();
        onSelect();
      }}
      style={{
        position: 'absolute',
        left: screenX,
        top: screenY,
        transformOrigin: '0 0',
        transform: `scale(${camera.zoom})`,
        width: totalTableWidth + 36, // extra space for per-row action column
        zIndex: 15,
        backgroundColor: tableBgColor,
        color: tableTextColor,
        pointerEvents: 'auto',
      }}
      className={`relative rounded-xl transition-shadow select-none ${
        isTransparent
          ? 'bg-transparent backdrop-blur-[1px] border border-stone-300 dark:border-stone-700'
          : !table.bgColor
          ? 'bg-white dark:bg-stone-900'
          : ''
      } ${
        isSelected
          ? 'ring-2 ring-blue-500 shadow-2xl'
          : 'hover:ring-1 hover:ring-blue-300 shadow-md'
      }`}
    >
      {/* 1. CONTEXTUAL FLOATING TOOLBAR: Attached directly above table, aligned with format width, scales proportionally */}
      {isSelected && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            transform: 'translateY(-100%)',
            marginBottom: `${Math.round(8 * tbScale)}px`,
            paddingBottom: `${Math.round(4 * tbScale)}px`,
          }}
          className="absolute top-0 left-0 flex items-center pointer-events-auto z-40 max-w-none"
        >
          <div
            style={{
              padding: `${Math.round(4 * tbScale)}px ${Math.round(10 * tbScale)}px`,
              fontSize: `${Math.round(11 * tbScale)}px`,
              borderRadius: `${Math.round(12 * tbScale)}px`,
              gap: `${Math.round(8 * tbScale)}px`,
            }}
            className="w-max min-w-full bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border border-stone-200 dark:border-stone-800 shadow-lg flex items-center justify-between"
          >
            {/* Left Cluster: Move, Title, Live Dr = Cr Balance Badge */}
            <div
              style={{ gap: `${Math.round(8 * tbScale)}px` }}
              className="flex items-center min-w-0"
            >
              {/* Drag Handle */}
              <div
                onMouseDown={handleTableDragStart}
                style={{
                  padding: `${Math.round(3 * tbScale)}px ${Math.round(6 * tbScale)}px`,
                  borderRadius: `${Math.round(4 * tbScale)}px`,
                  gap: `${Math.round(4 * tbScale)}px`,
                }}
                className="cursor-grab active:cursor-grabbing hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 flex items-center shrink-0"
                title="Drag table to reposition on canvas"
              >
                <GripVertical style={{ width: tbIconSize, height: tbIconSize }} />
                <span
                  style={{ fontSize: `${Math.round(11 * tbScale)}px` }}
                  className="font-semibold text-stone-600 dark:text-stone-300"
                >
                  Move
                </span>
              </div>

              <div
                style={{ height: `${Math.round(16 * tbScale)}px` }}
                className="w-px bg-stone-200 dark:border-stone-700 shrink-0"
              />

              {/* Editable Title */}
              <input
                type="text"
                value={table.title}
                onChange={(e) => onUpdateTable({ ...table, title: e.target.value })}
                style={{
                  fontSize: `${Math.round(12 * tbScale)}px`,
                  maxWidth: `${Math.round(280 * tbScale)}px`,
                  padding: `0 ${Math.round(4 * tbScale)}px`,
                }}
                className="font-bold text-stone-800 dark:text-stone-100 bg-transparent border-b border-transparent hover:border-stone-300 dark:hover:border-stone-700 focus:border-blue-500 outline-none truncate"
                title="Click to rename format title"
              />

              <div
                style={{ height: `${Math.round(16 * tbScale)}px` }}
                className="w-px bg-stone-200 dark:border-stone-700 shrink-0"
              />

              {/* Live Dr = Cr Balance Badge */}
              {balanceInfo && (
                <div
                  style={{
                    padding: `${Math.round(2 * tbScale)}px ${Math.round(8 * tbScale)}px`,
                    fontSize: `${Math.round(11 * tbScale)}px`,
                    borderRadius: '9999px',
                    gap: `${Math.round(4 * tbScale)}px`,
                  }}
                  className={`flex items-center shrink-0 font-semibold transition-all ${
                    balanceInfo.isBalanced
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-300 dark:border-rose-800 animate-pulse'
                  }`}
                  title={
                    balanceInfo.isBalanced
                      ? `✓ Balanced: Total Debits = Total Credits (${table.currencySymbol || '$'}${balanceInfo.debitTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`
                      : `⚠ Out of Balance by ${table.currencySymbol || '$'}${balanceInfo.difference.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Dr: ${balanceInfo.debitTotal.toFixed(2)}, Cr: ${balanceInfo.creditTotal.toFixed(2)})`
                  }
                >
                  {balanceInfo.isBalanced ? (
                    <>
                      <CheckCircle2 style={{ width: tbIconSize, height: tbIconSize }} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>Balanced Dr = Cr ({table.currencySymbol || '$'}{balanceInfo.debitTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle style={{ width: tbIconSize, height: tbIconSize }} className="text-rose-600 dark:text-rose-400 shrink-0" />
                      <span>Out of balance: Δ {table.currencySymbol || '$'}{balanceInfo.difference.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Right Cluster: Color, Export, AutoSum, Delete */}
            <div
              style={{ gap: `${Math.round(6 * tbScale)}px` }}
              className="flex items-center shrink-0"
            >
              {/* Color & Transparency Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowColorMenu(!showColorMenu)}
                  style={{
                    padding: `${Math.round(3 * tbScale)}px ${Math.round(8 * tbScale)}px`,
                    fontSize: `${Math.round(11 * tbScale)}px`,
                    borderRadius: `${Math.round(4 * tbScale)}px`,
                    gap: `${Math.round(4 * tbScale)}px`,
                  }}
                  className="flex items-center hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 font-medium"
                  title="Format background & text colors"
                >
                  <Palette style={{ width: tbIconSize, height: tbIconSize }} className="text-stone-500" />
                  <span>Color</span>
                  <ChevronDown style={{ width: Math.round(12 * tbScale), height: Math.round(12 * tbScale) }} className="text-stone-400" />
                </button>

                {showColorMenu && (
                  <div
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: `${Math.round(208 * tbScale)}px`,
                      padding: `${Math.round(10 * tbScale)}px`,
                      borderRadius: `${Math.round(12 * tbScale)}px`,
                      gap: `${Math.round(8 * tbScale)}px`,
                    }}
                    className="absolute right-0 top-full mt-1 bg-white dark:bg-stone-900 shadow-xl border border-stone-200 dark:border-stone-800 z-50 flex flex-col"
                  >
                    <div>
                      <span
                        style={{ fontSize: `${Math.round(10 * tbScale)}px` }}
                        className="font-bold text-stone-400 uppercase tracking-wider block mb-1"
                      >
                        Background Color
                      </span>
                      <div className="grid grid-cols-5 gap-1.5">
                        {/* Transparent */}
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateTable({ ...table, bgColor: 'transparent' });
                            setShowColorMenu(false);
                          }}
                          style={{
                            height: `${Math.round(24 * tbScale)}px`,
                            fontSize: `${Math.round(9 * tbScale)}px`,
                          }}
                          className={`rounded border flex items-center justify-center font-bold ${
                            table.bgColor === 'transparent'
                              ? 'ring-2 ring-blue-500 border-blue-500'
                              : 'border-stone-300 dark:border-stone-700'
                          }`}
                          title="Transparent background (Canvas lines show through)"
                        >
                          None
                        </button>

                        {/* White */}
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateTable({ ...table, bgColor: '#ffffff', textColor: table.textColor === '#ffffff' ? '#0f172a' : table.textColor });
                            setShowColorMenu(false);
                          }}
                          style={{ height: `${Math.round(24 * tbScale)}px` }}
                          className={`rounded bg-white border border-stone-300 ${
                            table.bgColor === '#ffffff' || !table.bgColor ? 'ring-2 ring-blue-500' : ''
                          }`}
                          title="Natural Clean White"
                        />

                        {/* Warm Paper / Cream */}
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateTable({ ...table, bgColor: '#fefce8', textColor: table.textColor === '#ffffff' ? '#0f172a' : table.textColor });
                            setShowColorMenu(false);
                          }}
                          style={{ height: `${Math.round(24 * tbScale)}px` }}
                          className={`rounded bg-amber-50 border border-amber-200 ${
                            table.bgColor === '#fefce8' ? 'ring-2 ring-blue-500' : ''
                          }`}
                          title="Warm Paper / Cream"
                        />

                        {/* Subtle Slate */}
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateTable({ ...table, bgColor: '#f8fafc', textColor: table.textColor === '#ffffff' ? '#0f172a' : table.textColor });
                            setShowColorMenu(false);
                          }}
                          style={{ height: `${Math.round(24 * tbScale)}px` }}
                          className={`rounded bg-slate-50 border border-slate-300 ${
                            table.bgColor === '#f8fafc' ? 'ring-2 ring-blue-500' : ''
                          }`}
                          title="Subtle Slate"
                        />

                        {/* Dark */}
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateTable({ ...table, bgColor: '#18181b', textColor: '#ffffff' });
                            setShowColorMenu(false);
                          }}
                          style={{ height: `${Math.round(24 * tbScale)}px` }}
                          className={`rounded bg-zinc-900 border border-zinc-700 ${
                            table.bgColor === '#18181b' ? 'ring-2 ring-blue-500' : ''
                          }`}
                          title="Dark Contrast"
                        />
                      </div>
                    </div>

                    <div className="border-t border-stone-100 dark:border-stone-800 pt-1.5">
                      <span
                        style={{ fontSize: `${Math.round(10 * tbScale)}px` }}
                        className="font-bold text-stone-400 uppercase tracking-wider block mb-1"
                      >
                        Text Color
                      </span>
                      <div className="grid grid-cols-4 gap-1.5">
                        {/* Black */}
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateTable({ ...table, textColor: '#0f172a' });
                            setShowColorMenu(false);
                          }}
                          style={{
                            height: `${Math.round(24 * tbScale)}px`,
                            fontSize: `${Math.round(10 * tbScale)}px`,
                          }}
                          className={`rounded bg-slate-900 text-white font-semibold flex items-center justify-center ${
                            table.textColor === '#0f172a' || !table.textColor ? 'ring-2 ring-blue-500' : ''
                          }`}
                          title="Natural Black"
                        >
                          Black
                        </button>

                        {/* Charcoal */}
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateTable({ ...table, textColor: '#475569' });
                            setShowColorMenu(false);
                          }}
                          style={{
                            height: `${Math.round(24 * tbScale)}px`,
                            fontSize: `${Math.round(10 * tbScale)}px`,
                          }}
                          className={`rounded bg-slate-600 text-white font-semibold flex items-center justify-center ${
                            table.textColor === '#475569' ? 'ring-2 ring-blue-500' : ''
                          }`}
                          title="Charcoal Gray"
                        >
                          Gray
                        </button>

                        {/* Classic Blue */}
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateTable({ ...table, textColor: '#1e40af' });
                            setShowColorMenu(false);
                          }}
                          style={{
                            height: `${Math.round(24 * tbScale)}px`,
                            fontSize: `${Math.round(10 * tbScale)}px`,
                          }}
                          className={`rounded bg-blue-700 text-white font-semibold flex items-center justify-center ${
                            table.textColor === '#1e40af' ? 'ring-2 ring-blue-500' : ''
                          }`}
                          title="Accounting Blue"
                        >
                          Blue
                        </button>

                        {/* White */}
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateTable({ ...table, textColor: '#ffffff' });
                            setShowColorMenu(false);
                          }}
                          style={{
                            height: `${Math.round(24 * tbScale)}px`,
                            fontSize: `${Math.round(10 * tbScale)}px`,
                          }}
                          className={`rounded bg-white text-stone-900 border border-stone-300 font-semibold flex items-center justify-center ${
                            table.textColor === '#ffffff' ? 'ring-2 ring-blue-500' : ''
                          }`}
                          title="White"
                        >
                          White
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Export Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  style={{
                    padding: `${Math.round(3 * tbScale)}px ${Math.round(8 * tbScale)}px`,
                    fontSize: `${Math.round(11 * tbScale)}px`,
                    borderRadius: `${Math.round(4 * tbScale)}px`,
                    gap: `${Math.round(4 * tbScale)}px`,
                  }}
                  className="flex items-center hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 font-medium"
                  title="Export options (CSV, Print/PDF)"
                >
                  <Download style={{ width: tbIconSize, height: tbIconSize }} className="text-stone-500" />
                  <span>Export</span>
                  <ChevronDown style={{ width: Math.round(12 * tbScale), height: Math.round(12 * tbScale) }} className="text-stone-400" />
                </button>

                {showExportMenu && (
                  <div
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: `${Math.round(144 * tbScale)}px`,
                      borderRadius: `${Math.round(12 * tbScale)}px`,
                    }}
                    className="absolute right-0 top-full mt-1 bg-white dark:bg-stone-900 shadow-xl border border-stone-200 dark:border-stone-800 py-1 z-50"
                  >
                    <button
                      type="button"
                      onClick={handleExportCSV}
                      style={{
                        padding: `${Math.round(6 * tbScale)}px ${Math.round(12 * tbScale)}px`,
                        fontSize: `${Math.round(11 * tbScale)}px`,
                        gap: `${Math.round(6 * tbScale)}px`,
                      }}
                      className="w-full text-left text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center"
                    >
                      <FileText style={{ width: tbIconSize, height: tbIconSize }} className="text-emerald-600 shrink-0" />
                      <span>Export CSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportPNG}
                      style={{
                        padding: `${Math.round(6 * tbScale)}px ${Math.round(12 * tbScale)}px`,
                        fontSize: `${Math.round(11 * tbScale)}px`,
                        gap: `${Math.round(6 * tbScale)}px`,
                      }}
                      className="w-full text-left text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 flex items-center"
                    >
                      <Printer style={{ width: tbIconSize, height: tbIconSize }} className="text-blue-600 shrink-0" />
                      <span>Print / PDF</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Recalculate AutoSums */}
              <button
                type="button"
                onClick={() => {
                  const updated = recalculateTableAutoSums(table);
                  onUpdateTable(updated);
                }}
                style={{
                  padding: `${Math.round(4 * tbScale)}px`,
                  borderRadius: `${Math.round(4 * tbScale)}px`,
                }}
                className="hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 shrink-0"
                title="Recalculate sums (AutoSum)"
              >
                <Sigma style={{ width: tbIconSize, height: tbIconSize }} />
              </button>

              {/* Delete Table button */}
              <button
                type="button"
                onClick={onDeleteTable}
                style={{
                  padding: `${Math.round(4 * tbScale)}px`,
                  borderRadius: `${Math.round(4 * tbScale)}px`,
                }}
                className="hover:bg-red-50 dark:hover:bg-red-950/40 text-stone-400 hover:text-red-600 transition-colors shrink-0"
                title="Delete table"
              >
                <Trash2 style={{ width: tbIconSize, height: tbIconSize }} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. SPREADSHEET TABLE GRID */}
      <div id={`table-container-${table.id}`} className="overflow-x-auto rounded-xl">
        <table className="w-full border-collapse" style={{ fontSize: `${baseFontSize}px` }}>
          {/* Header Row - Entire row is draggable with grab cursor! */}
          <thead>
            <tr
              onMouseDown={handleTableDragStart}
              style={{
                height: `${baseHeaderHeight}px`,
                backgroundColor: isTransparent
                  ? 'rgba(0, 0, 0, 0.05)'
                  : table.headerBgColor || undefined,
                color: table.headerTextColor || tableTextColor || undefined,
              }}
              className={`font-semibold border-b border-slate-300 dark:border-stone-700 cursor-grab active:cursor-grabbing ${
                isTransparent
                  ? 'bg-stone-200/40 dark:bg-stone-800/40 text-stone-900 dark:text-stone-100'
                  : !table.headerBgColor
                  ? 'bg-slate-100 dark:bg-stone-800 text-slate-800 dark:text-slate-200'
                  : ''
              }`}
            >
              {/* Row Action Header Column */}
              <th
                style={{ width: 36, height: `${baseHeaderHeight}px`, fontSize: `${Math.max(9, Math.round(baseFontSize * 0.8))}px` }}
                className="w-9 px-1 text-center text-stone-400 font-mono select-none border-r border-slate-200 dark:border-stone-700"
              >
                #
              </th>

              {table.columns.map((col) => (
                <th
                  key={col.id}
                  style={{
                    width: col.width,
                    height: `${baseHeaderHeight}px`,
                    fontSize: `${Math.max(10, Math.round(baseFontSize * 0.95))}px`,
                  }}
                  className={`relative px-2.5 select-none border-r border-slate-200 dark:border-stone-700 text-${col.align}`}
                >
                  <div className="truncate pr-2 font-bold tracking-tight">{col.label}</div>
                  {/* Column resize drag handle */}
                  <div
                    onMouseDown={(e) => handleColResizeStart(e, col)}
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-500/50"
                    title="Drag to resize column width"
                  />
                </th>
              ))}
            </tr>
          </thead>

          {/* Rows Body */}
          <tbody>
            {table.rows.map((row, rIdx) => {
              const isTotal = row.isTotal;
              const isSubtotal = row.isSubtotal;
              const isRowActive = editingCell?.rowId === row.id;
              const currentRowHeight = row.height || baseRowHeight;

              return (
                <tr
                  key={row.id}
                  className={`group relative ${
                    isTotal
                      ? 'bg-slate-50 dark:bg-stone-800/60 font-bold border-t border-slate-400 dark:border-stone-600'
                      : isSubtotal
                      ? 'bg-slate-50/50 dark:bg-stone-800/30 font-semibold border-b border-slate-200 dark:border-stone-700'
                      : 'hover:bg-blue-50/30 dark:hover:bg-stone-800/40 border-b border-slate-100 dark:border-stone-800'
                  }`}
                  style={{
                    height: `${currentRowHeight}px`,
                    ...(isTotal ? { borderBottom: '3px double #475569' } : {}),
                  }}
                >
                  {/* Per-Row Action Column: Shows row number, and on hover or focus reveals + and × buttons */}
                  <td
                    style={{ width: 36, height: `${currentRowHeight}px`, fontSize: `${Math.max(9, Math.round(baseFontSize * 0.8))}px` }}
                    className="w-9 px-1 border-r border-slate-200 dark:border-stone-800 text-center select-none bg-stone-50/50 dark:bg-stone-800/20"
                  >
                    {!isTotal ? (
                      <div className="flex items-center justify-center gap-0.5">
                        {/* Hidden row index, shows on non-hover */}
                        <span
                          className={`text-stone-400 font-mono transition-opacity ${
                            isRowActive ? 'hidden' : 'group-hover:hidden'
                          }`}
                        >
                          {rIdx + 1}
                        </span>

                        {/* Visible on hover or when cell in row is focused */}
                        <div
                          className={`items-center gap-0.5 ${
                            isRowActive ? 'flex' : 'hidden group-hover:flex'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handleAddRowBelow(row.id)}
                            className="p-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 transition-colors"
                            title="Insert account row below"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteRow(row.id)}
                            className="p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/40 text-stone-400 hover:text-red-600 transition-colors"
                            title="Delete this row"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="font-bold text-stone-500">∑</span>
                    )}
                  </td>

                  {/* Table Cells */}
                  {table.columns.map((col, cIdx) => {
                    const cell = row.cells[col.id];
                    const isCellEditing =
                      editingCell?.rowId === row.id && editingCell?.colId === col.id;

                    // Display value formatting
                    let displayVal = cell?.value || '';
                    if (
                      displayVal &&
                      (col.format === 'currency' || col.isAutoSum) &&
                      !isNaN(Number(displayVal)) &&
                      !isCellEditing
                    ) {
                      displayVal = Number(displayVal).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      });
                    }

                    const showSuggestionsHere =
                      isCellEditing &&
                      showAutocomplete &&
                      filteredSuggestions.length > 0;

                    return (
                      <td
                        key={col.id}
                        style={{
                          width: col.width,
                          height: `${currentRowHeight}px`,
                          fontSize: `${baseFontSize}px`,
                        }}
                        onClick={() => {
                          if (!isTotal) {
                            setEditingCell({ rowId: row.id, colId: col.id });
                          }
                        }}
                        className={`relative px-2 py-1 border-r border-slate-200 dark:border-stone-800 text-${
                          cell?.align || col.align
                        } ${cell?.bold || isTotal ? 'font-semibold' : ''} ${
                          cell?.italic ? 'italic text-stone-500 dark:text-stone-400' : ''
                        } ${
                          isCellEditing
                            ? 'p-0 bg-blue-50/80 dark:bg-blue-950/60 ring-2 ring-blue-500 z-20'
                            : isTotal
                            ? 'bg-slate-50/80 dark:bg-stone-800/40'
                            : 'cursor-text'
                        }`}
                      >
                        {isCellEditing ? (
                          <>
                            <input
                              type="text"
                              autoFocus
                              value={cell?.value || ''}
                              onChange={(e) => handleCellChange(row.id, col.id, e.target.value)}
                              onBlur={() => {
                                // Short delay to allow clicking suggestions
                                setTimeout(() => {
                                  setEditingCell(null);
                                  setShowAutocomplete(false);
                                }, 150);
                              }}
                              onKeyDown={(e) => handleCellKeyDown(e, rIdx, cIdx)}
                              style={{ fontSize: `${baseFontSize}px` }}
                              className={`w-full px-2 py-1 bg-transparent border-none outline-none text-${
                                cell?.align || col.align
                              } font-mono`}
                              placeholder={col.format === 'currency' ? '0.00' : ''}
                            />

                            {/* Autocomplete suggestions dropdown */}
                            {showSuggestionsHere && (
                              <div
                                onPointerDown={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                style={{
                                  fontSize: `${Math.max(12, baseFontSize)}px`,
                                  minWidth: `${Math.max(260, Math.round(col.width * 1.2))}px`,
                                }}
                                className="absolute left-0 top-full mt-1 w-max max-w-md bg-white/95 dark:bg-stone-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-stone-200 dark:border-stone-800 py-1.5 z-50 text-left max-h-60 overflow-y-auto"
                              >
                                {filteredSuggestions.map((suggestion) => {
                                  const category = ACCOUNT_CATEGORY_LOOKUP[suggestion.toLowerCase()];
                                  return (
                                    <div
                                      key={suggestion}
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        handleSelectAutocomplete(row.id, col.id, suggestion);
                                      }}
                                      className="px-3 py-1.5 text-stone-800 dark:text-stone-200 hover:bg-blue-50 dark:hover:bg-blue-950/50 cursor-pointer font-medium flex items-center justify-between gap-3 group transition-colors"
                                    >
                                      <span className="truncate">{suggestion}</span>
                                      {category && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 uppercase tracking-wider bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 group-hover:bg-blue-100 dark:group-hover:bg-blue-900 group-hover:text-blue-600 dark:group-hover:text-blue-300">
                                          {category}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        ) : (
                          <div
                            className={`truncate ${
                              cell?.doubleUnderline
                                ? 'border-b-2 border-double border-slate-700 dark:border-slate-300 pb-0.5'
                                : ''
                            }`}
                          >
                            {displayVal || <span className="opacity-0">-</span>}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 3. WHOLE-TABLE RESIZE HANDLE (Bottom-Right corner) */}
      {isSelected && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={handleWholeTableResizeStart}
          className="absolute -right-2 -bottom-2 w-5 h-5 bg-blue-600 hover:bg-blue-700 rounded-sm cursor-nwse-resize shadow-md flex items-center justify-center text-white text-[10px] font-bold z-50 select-none transition-transform hover:scale-110"
          title="Drag to resize table format in both directions"
        >
          ⤡
        </div>
      )}
    </div>
  );
};
