import React, { useState } from 'react';
import {
  X,
  Search,
  FileSpreadsheet,
  Plus,
  GripVertical,
} from 'lucide-react';
import {
  ACCOUNTING_FORMAT_CATALOG,
  AccountingFormatMeta,
} from '../../engine/accountingFormats';
import { AccountingFormatType } from '../../types/document';

interface ExcalidrawLibraryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertFormat: (type: AccountingFormatType) => void;
}

const CATEGORIES = [
  'All',
  'Bookkeeping',
  'Ledgers',
  'Financial Statements',
  'Reconciliation & Aging',
  'Operations & Payroll',
];

export const ExcalidrawLibraryDrawer: React.FC<ExcalidrawLibraryDrawerProps> = ({
  isOpen,
  onClose,
  onInsertFormat,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isDraggingCard, setIsDraggingCard] = useState(false);

  if (!isOpen) return null;

  const filteredFormats = ACCOUNTING_FORMAT_CATALOG.filter((f) => {
    const matchesSearch =
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === 'All' || f.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCardInsert = (type: AccountingFormatType) => {
    onInsertFormat(type);
    onClose(); // Auto-close drawer after insert
  };

  return (
    <aside
      aria-label="Accounting templates library"
      className={`fixed top-3 right-3 bottom-3 w-88 z-40 bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 flex flex-col overflow-hidden select-none transition-all duration-200 ${
        isDraggingCard ? 'opacity-40' : 'opacity-100'
      }`}
    >
      {/* Header bar */}
      <div className="p-3 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-stone-900 dark:text-stone-100">Accounting Library</h2>
            <p className="text-[10px] text-stone-500 dark:text-stone-400">Drag to canvas or click Insert</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
          title="Close Library"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search Input */}
      <div className="p-2.5 border-b border-stone-100 dark:border-stone-800">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-stone-400" />
          <input
            type="text"
            placeholder="Search formats (e.g. Journal, Ledger, Trial Balance)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/60 text-stone-900 dark:text-stone-100 placeholder-stone-400 outline-none focus:border-blue-500 font-medium"
          />
        </div>
      </div>

      {/* Category Filter Chips */}
      <div className="px-3 py-2 border-b border-stone-100 dark:border-stone-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-2 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Formats List with High Contrast and Clear Drag Affordance */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5 scrollbar-thin">
        <div className="flex items-center justify-between text-[11px] font-bold text-stone-400 uppercase tracking-wider">
          <span>Available Formats ({filteredFormats.length})</span>
          <span className="text-[10px] lowercase text-stone-400 font-normal">drag or insert</span>
        </div>

        {filteredFormats.map((item) => (
          <div
            key={item.type}
            draggable={true}
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'copy';
              e.dataTransfer.setData('text/plain', item.type);
              e.dataTransfer.setData('formatType', item.type);
              (window as any).__DRAGGING_FORMAT__ = item.type;
              setIsDraggingCard(true);
            }}
            onDragEnd={() => {
              setIsDraggingCard(false);
              (window as any).__DRAGGING_FORMAT__ = null;
            }}
            className="group p-3 rounded-xl border border-stone-200 dark:border-stone-800 hover:border-blue-500 bg-stone-50/50 hover:bg-white dark:bg-stone-800/40 dark:hover:bg-stone-800/90 transition-all cursor-grab active:cursor-grabbing flex flex-col justify-between shadow-xs hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <GripVertical className="w-3.5 h-3.5 text-stone-400 group-hover:text-blue-500 shrink-0" />
                <h3 className="font-bold text-xs text-stone-900 dark:text-stone-50 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
                  {item.name}
                </h3>
              </div>
              <span className="text-[10px] font-medium text-stone-500 dark:text-stone-400 bg-stone-200/60 dark:bg-stone-700/60 px-1.5 py-0.5 rounded shrink-0">
                {item.category}
              </span>
            </div>

            {/* High contrast description */}
            <p className="text-[11px] text-stone-600 dark:text-stone-300 line-clamp-2 mb-2.5 leading-relaxed pl-5 font-normal">
              {item.description}
            </p>

            {/* Action Bar with Prominent Insert Button */}
            <div className="flex items-center justify-between pt-2 border-t border-stone-200/60 dark:border-stone-700/60 pl-5">
              <span className="text-[10px] text-stone-400 font-mono">
                {item.recommendedWidth}px width
              </span>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCardInsert(item.type);
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] shadow-xs hover:shadow transition-colors"
                title={`Insert ${item.name} onto canvas`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Insert</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};
