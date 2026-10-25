import React, { useState } from 'react';
import {
  Plus,
  Copy,
  Trash2,
  Bookmark,
  ChevronRight,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  BookmarkCheck,
  Grid,
  Rows,
  Columns,
  Sparkles,
  Palette,
  FileSpreadsheet,
} from 'lucide-react';
import { PageFrame, PageTemplate, PageSize, PageOrientation } from '../../types/document';
import { PAGE_SIZE_DIMENSIONS } from '../../engine/penDefaults';

interface PageThumbnailSidebarProps {
  pages: PageFrame[];
  activePageId: string;
  onSelectPage: (pageId: string) => void;
  onAddPage: (template?: PageTemplate, size?: PageSize) => void;
  onDuplicatePage: (pageId: string) => void;
  onDeletePage: (pageId: string) => void;
  onReorderPage: (pageId: string, direction: 'up' | 'down') => void;
  onUpdatePage: (pageId: string, updates: Partial<PageFrame>) => void;
  onConvertLayout: (layoutType: 'grid' | 'row' | 'column') => void;
  currentMode: 'notebook' | 'canvas';
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const PageThumbnailSidebar: React.FC<PageThumbnailSidebarProps> = ({
  pages,
  activePageId,
  onSelectPage,
  onAddPage,
  onDuplicatePage,
  onDeletePage,
  onReorderPage,
  onUpdatePage,
  onConvertLayout,
  currentMode,
  isOpen,
  onToggleOpen,
}) => {
  const [activeTab, setActiveTab] = useState<'pages' | 'bookmarks'>('pages');
  const [editingTemplatePageId, setEditingTemplatePageId] = useState<string | null>(null);

  const displayedPages =
    activeTab === 'bookmarks' ? pages.filter((p) => p.bookmarked) : pages;

  return (
    <aside
      className={`fixed left-0 top-12 bottom-0 z-30 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border-r border-stone-200 dark:border-stone-800 transition-all duration-200 flex flex-col select-none ${
        isOpen ? 'w-64' : 'w-10'
      }`}
    >
      {/* Sidebar Header */}
      <div className="h-10 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between px-2.5">
        {isOpen ? (
          <>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('pages')}
                className={`text-xs font-semibold px-2 py-1 rounded-md transition-colors ${
                  activeTab === 'pages'
                    ? 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100'
                    : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                }`}
              >
                Pages ({pages.length})
              </button>
              <button
                onClick={() => setActiveTab('bookmarks')}
                className={`text-xs font-semibold px-2 py-1 rounded-md transition-colors ${
                  activeTab === 'bookmarks'
                    ? 'bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100'
                    : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                }`}
              >
                Bookmarks
              </button>
            </div>
            <button
              onClick={onToggleOpen}
              className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
              title="Collapse sidebar"
            >
              <ChevronDown className="w-4 h-4 -rotate-90" />
            </button>
          </>
        ) : (
          <button
            onClick={onToggleOpen}
            className="w-full h-full flex items-center justify-center text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
            title="Expand Page Strip"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <>
          {/* Actions Bar */}
          <div className="p-2 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
            <button
              onClick={() => onAddPage()}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-lg text-xs font-medium hover:opacity-90 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Page</span>
            </button>

            {/* Canvas mode layout helper */}
            {currentMode === 'canvas' && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onConvertLayout('grid')}
                  className="p-1 rounded text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
                  title="Layout frames as Grid"
                >
                  <Grid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onConvertLayout('row')}
                  className="p-1 rounded text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
                  title="Layout frames as Row"
                >
                  <Columns className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => onConvertLayout('column')}
                  className="p-1 rounded text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
                  title="Layout frames as Column"
                >
                  <Rows className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Virtualized/Scrollable Page List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {displayedPages.map((page, index) => {
              const isSelected = page.id === activePageId;
              return (
                <div
                  key={page.id}
                  onClick={() => onSelectPage(page.id)}
                  className={`group relative rounded-xl border p-2 cursor-pointer transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/20 shadow-xs'
                      : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800/50'
                  }`}
                >
                  {/* Thumbnail Box */}
                  <div className="w-full h-24 rounded-lg bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 mb-1.5 overflow-hidden flex items-center justify-center relative shadow-xs">
                    <span className="text-[10px] text-stone-400 font-mono">
                      {page.template.toUpperCase()} · {page.sizeFormat}
                    </span>

                    {/* Bookmark indicator */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdatePage(page.id, { bookmarked: !page.bookmarked });
                      }}
                      className="absolute top-1.5 right-1.5 p-1 rounded hover:bg-stone-100 dark:hover:bg-stone-800"
                    >
                      <Bookmark
                        className={`w-3.5 h-3.5 ${
                          page.bookmarked ? 'fill-amber-400 text-amber-500' : 'text-stone-400'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Page Title & Controls */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-stone-800 dark:text-stone-200 truncate max-w-[120px]">
                      {page.title || `Page ${page.pageNumber}`}
                    </span>

                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onReorderPage(page.id, 'up');
                        }}
                        disabled={index === 0}
                        className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 disabled:opacity-20"
                        title="Move Page Up"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onReorderPage(page.id, 'down');
                        }}
                        disabled={index === pages.length - 1}
                        className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 disabled:opacity-20"
                        title="Move Page Down"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTemplatePageId(
                            editingTemplatePageId === page.id ? null : page.id
                          );
                        }}
                        className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                        title="Change Template / Size"
                      >
                        <SlidersHorizontal className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDuplicatePage(page.id);
                        }}
                        className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                        title="Duplicate Page"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      {pages.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeletePage(page.id);
                          }}
                          className="p-1 rounded text-stone-400 hover:text-rose-500"
                          title="Delete Page"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Page Template & Size Popover */}
                  {editingTemplatePageId === page.id && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2 p-2 rounded-lg bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-xs space-y-2"
                    >
                      <div>
                        <span className="text-[10px] font-semibold text-stone-500">Template</span>
                        <select
                          value={page.template}
                          onChange={(e) =>
                            onUpdatePage(page.id, { template: e.target.value as PageTemplate })
                          }
                          className="w-full mt-0.5 p-1 rounded bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700"
                        >
                          <option value="blank">Blank Paper</option>
                          <option value="lined">Ruled Lines (Lined)</option>
                          <option value="grid">Grid (Graph Paper)</option>
                          <option value="dotted">Dotted (Bullet Journal)</option>
                          <option value="isometric">Isometric 3D</option>
                          <option value="cornell">Cornell Notes</option>
                          <option value="music">Music Staff</option>
                          <option value="todo">To-Do List</option>
                        </select>
                      </div>

                      <div>
                        <span className="text-[10px] font-semibold text-stone-500">Page Size</span>
                        <select
                          value={page.sizeFormat}
                          onChange={(e) => {
                            const newSize = e.target.value as PageSize;
                            const dim = PAGE_SIZE_DIMENSIONS[newSize] || PAGE_SIZE_DIMENSIONS.A4;
                            onUpdatePage(page.id, {
                              sizeFormat: newSize,
                              width: dim.width,
                              height: dim.height,
                            });
                          }}
                          className="w-full mt-0.5 p-1 rounded bg-white dark:bg-stone-900 border border-stone-300 dark:border-stone-700"
                        >
                          <option value="A4">A4 (Standard 210 x 297mm)</option>
                          <option value="A5">A5 (Compact)</option>
                          <option value="Letter">US Letter</option>
                          <option value="Square">Square</option>
                          <option value="Slide16_9">16:9 Presentation</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </aside>
  );
};
