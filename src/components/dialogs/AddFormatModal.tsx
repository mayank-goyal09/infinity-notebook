import React, { useState } from 'react';
import {
  ACCOUNTING_FORMAT_CATALOG,
  AccountingFormatMeta,
} from '../../engine/accountingFormats';
import { AccountingFormatType } from '../../types/document';
import {
  X,
  Search,
  BookOpen,
  FileSpreadsheet,
  Layers,
  Scale,
  Receipt,
  Clock,
  Boxes,
  Users,
  CheckCircle,
  Plus,
} from 'lucide-react';

interface AddFormatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFormat: (formatType: AccountingFormatType) => void;
}

export const AddFormatModal: React.FC<AddFormatModalProps> = ({
  isOpen,
  onClose,
  onSelectFormat,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  if (!isOpen) return null;

  const categories = [
    'All',
    'Bookkeeping',
    'Ledgers',
    'Financial Statements',
    'Reconciliation & Aging',
    'Operations & Payroll',
    'Custom',
  ];

  const filteredFormats = ACCOUNTING_FORMAT_CATALOG.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat =
      selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Bookkeeping':
        return <BookOpen className="w-4 h-4 text-blue-500" />;
      case 'Ledgers':
        return <Layers className="w-4 h-4 text-emerald-500" />;
      case 'Financial Statements':
        return <Scale className="w-4 h-4 text-purple-500" />;
      case 'Reconciliation & Aging':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'Operations & Payroll':
        return <Users className="w-4 h-4 text-rose-500" />;
      default:
        return <FileSpreadsheet className="w-4 h-4 text-stone-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="w-[780px] max-w-[95vw] max-h-[88vh] bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50/50 dark:bg-stone-800/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 rounded-lg text-white shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">
                Add Accounting Format
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Choose a pre-built accounting template or spreadsheet schedule to insert
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Category Tabs */}
        <div className="p-3 border-b border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row gap-2.5 items-center justify-between">
          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-stone-400" />
            <input
              type="text"
              placeholder="Search formats..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 outline-none focus:border-blue-500"
            />
          </div>

          {/* Categories Pill Navigation */}
          <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900'
                    : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Format Cards Grid */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[55vh]">
          {filteredFormats.map((format) => (
            <div
              key={format.type}
              onClick={() => {
                onSelectFormat(format.type);
                onClose();
              }}
              className="group p-3.5 rounded-xl border border-stone-200 dark:border-stone-800 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md bg-stone-50/40 dark:bg-stone-800/30 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    {getCategoryIcon(format.category)}
                    <span className="text-xs font-semibold text-stone-900 dark:text-stone-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      {format.name}
                    </span>
                  </div>
                  {format.hasAutoBalance && (
                    <span className="text-[10px] font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                      Auto-Balance
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed mb-3">
                  {format.description}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-stone-100 dark:border-stone-800/60 text-[11px] text-stone-400">
                <span>Category: {format.category}</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  <Plus className="w-3 h-3" /> Insert
                </span>
              </div>
            </div>
          ))}

          {filteredFormats.length === 0 && (
            <div className="col-span-2 py-12 text-center text-stone-400 text-xs">
              No formats found matching "{searchTerm}"
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/40 flex items-center justify-between text-xs text-stone-500">
          <span>Tip: You can resize columns and edit cells directly after adding.</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 font-medium text-stone-700 dark:text-stone-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
