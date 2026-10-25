import React from 'react';
import {
  AccountingTableObject,
  TableColumn,
  TableCell,
  TableRow,
} from '../../types/document';
import {
  Sigma,
  Plus,
  Trash2,
  DollarSign,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  Download,
  Grid,
} from 'lucide-react';
import { recalculateTableAutoSums } from '../../engine/accountingFormats';

interface AccountingFormatBarProps {
  selectedTable: AccountingTableObject | null;
  onUpdateTable: (table: AccountingTableObject) => void;
  currencySymbol: string;
  onChangeCurrency: (symbol: string) => void;
  onOpenAddFormat: () => void;
}

export const AccountingFormatBar: React.FC<AccountingFormatBarProps> = ({
  selectedTable,
  onUpdateTable,
  currencySymbol,
  onChangeCurrency,
  onOpenAddFormat,
}) => {
  const currencies = [
    { symbol: '$', label: 'USD ($)' },
    { symbol: '₹', label: 'INR (₹)' },
    { symbol: '€', label: 'EUR (€)' },
    { symbol: '£', label: 'GBP (£)' },
  ];

  // Quick Add Row to selected table
  const handleAddRow = () => {
    if (!selectedTable) return;
    const newRowId = 'r-' + Math.random().toString(36).substring(2, 7);
    const newCells: Record<string, TableCell> = {};
    selectedTable.columns.forEach((col) => {
      newCells[col.id] = { value: '', align: col.align, format: col.format };
    });

    const totalRowIndex = selectedTable.rows.findIndex((r) => r.isTotal);
    let updatedRows: TableRow[];
    if (totalRowIndex !== -1) {
      updatedRows = [
        ...selectedTable.rows.slice(0, totalRowIndex),
        { id: newRowId, cells: newCells },
        ...selectedTable.rows.slice(totalRowIndex),
      ];
    } else {
      updatedRows = [...selectedTable.rows, { id: newRowId, cells: newCells }];
    }

    onUpdateTable(
      recalculateTableAutoSums({
        ...selectedTable,
        rows: updatedRows,
        height: selectedTable.height + 28,
      })
    );
  };

  // Quick Add Column to selected table
  const handleAddColumn = () => {
    if (!selectedTable) return;
    const newColId = 'col-' + Math.random().toString(36).substring(2, 7);
    const newCol: TableColumn = {
      id: newColId,
      label: `Column ${selectedTable.columns.length + 1}`,
      width: 120,
      align: 'right',
      format: 'currency',
      isAutoSum: true,
    };

    const updatedCols = [...selectedTable.columns, newCol];
    const updatedRows: TableRow[] = selectedTable.rows.map((r) => ({
      ...r,
      cells: {
        ...r.cells,
        [newColId]: { value: '', align: 'right' as const, format: 'currency' as const },
      },
    }));

    onUpdateTable(
      recalculateTableAutoSums({
        ...selectedTable,
        columns: updatedCols,
        rows: updatedRows,
        width: updatedCols.reduce((sum, c) => sum + c.width, 0),
      })
    );
  };

  // Recalculate AutoSums
  const handleAutoSum = () => {
    if (!selectedTable) return;
    onUpdateTable(recalculateTableAutoSums(selectedTable));
  };

  return (
    <div className="h-10 px-3 bg-white/95 dark:bg-stone-900/95 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between z-20 select-none shadow-xs">
      {/* Left: Add Format Button + Currency Switcher */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenAddFormat}
          className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          title="Insert an accounting format or spreadsheet template"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Format</span>
        </button>

        <div className="h-4 w-px bg-stone-300 dark:bg-stone-700 mx-1" />

        {/* Currency Switcher */}
        <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 p-0.5 rounded-lg border border-stone-200 dark:border-stone-700">
          {currencies.map((cur) => (
            <button
              key={cur.symbol}
              onClick={() => onChangeCurrency(cur.symbol)}
              className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors ${
                currencySymbol === cur.symbol
                  ? 'bg-white dark:bg-stone-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
              title={cur.label}
            >
              {cur.symbol}
            </button>
          ))}
        </div>
      </div>

      {/* Middle/Right: Selected Table Tools */}
      {selectedTable ? (
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-stone-500 dark:text-stone-400 hidden sm:inline">
            Active: <span className="text-stone-800 dark:text-stone-200 font-semibold">{selectedTable.title}</span>
          </span>

          <div className="h-4 w-px bg-stone-300 dark:bg-stone-700 mx-1 hidden sm:block" />

          {/* Table Operations */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleAddRow}
              className="flex items-center gap-1 px-2 py-1 rounded bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-medium"
              title="Add a new row to table"
            >
              <Plus className="w-3 h-3" />
              <span>Row</span>
            </button>
            <button
              onClick={handleAddColumn}
              className="flex items-center gap-1 px-2 py-1 rounded bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 text-xs font-medium"
              title="Add a new column to table"
            >
              <Plus className="w-3 h-3" />
              <span>Col</span>
            </button>
            <button
              onClick={handleAutoSum}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-blue-600 dark:text-blue-400 text-xs font-semibold"
              title="Calculate & update totals (AutoSum)"
            >
              <Sigma className="w-3.5 h-3.5" />
              <span>AutoSum</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="text-xs text-stone-400 italic">
          Click on any table or click "Add Format" to start.
        </div>
      )}
    </div>
  );
};
