import React, { useState, useEffect } from 'react';
import {
  Search,
  BookOpen,
  LayoutGrid,
  Pen,
  Eraser,
  MousePointer,
  Download,
  Upload,
  Plus,
  Moon,
  Sun,
  Maximize,
  Sliders,
  Type,
  StickyNote,
} from 'lucide-react';

interface CommandItem {
  id: string;
  title: string;
  category: string;
  shortcut?: string;
  icon: React.ReactNode;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: CommandItem[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, commands }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = commands.filter(
    (c) =>
      c.title.toLowerCase().includes(query.toLowerCase()) ||
      c.category.toLowerCase().includes(query.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/50 backdrop-blur-xs p-4 select-none">
      <div className="w-full max-w-lg bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        {/* Search Input */}
        <div className="flex items-center px-4 py-3 border-b border-stone-200 dark:border-stone-800 gap-2.5">
          <Search className="w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="Type a command or search actions..."
            value={query}
            autoFocus
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="flex-1 text-sm bg-transparent outline-none text-stone-900 dark:text-stone-100 placeholder-stone-400"
          />
          <kbd className="text-[10px] bg-stone-100 dark:bg-stone-800 text-stone-500 px-1.5 py-0.5 rounded border border-stone-200 dark:border-stone-700">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-72 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-xs text-stone-400">No commands found</div>
          ) : (
            filtered.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => {
                  item.action();
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors ${
                  idx === selectedIndex
                    ? 'bg-blue-600 text-white'
                    : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={idx === selectedIndex ? 'text-white' : 'text-stone-400'}>
                    {item.icon}
                  </span>
                  <div className="text-left">
                    <div className="font-medium">{item.title}</div>
                    <div className={`text-[10px] ${idx === selectedIndex ? 'text-blue-100' : 'text-stone-400'}`}>
                      {item.category}
                    </div>
                  </div>
                </div>

                {item.shortcut && (
                  <kbd
                    className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                      idx === selectedIndex
                        ? 'bg-blue-700 text-white'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-500 border border-stone-200 dark:border-stone-700'
                    }`}
                  >
                    {item.shortcut}
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
