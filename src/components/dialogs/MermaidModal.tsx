import React, { useState } from 'react';
import { X, Play, Code2, Sparkles, FileText, Check } from 'lucide-react';
import { parseMermaidToCanvasObjects } from '../../engine/mermaidParser';
import { CanvasObject } from '../../types/document';

interface MermaidModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertObjects: (objects: CanvasObject[]) => void;
  viewportCenter: { x: number; y: number };
  theme: 'light' | 'dark' | 'paper';
}

const TEMPLATES = [
  {
    name: 'Flowchart (TD)',
    code: `flowchart TD
  A[Start Task] --> B{Is approved?}
  B -- Yes --> C[Implement Feature]
  B -- No --> D[Revise Requirements]
  C --> E[Test & Deploy]
  D --> A`,
  },
  {
    name: 'Process (LR)',
    code: `flowchart LR
  Idea((Idea)) --> Planning[Sprint Planning]
  Planning --> Dev[Development]
  Dev --> Review{Code Review}
  Review -- Approved --> Prod[(Production)]`,
  },
  {
    name: 'Sequence Diagram',
    code: `sequenceDiagram
  participant User
  participant Client
  participant Server
  participant Database
  User->>Client: Click Submit
  Client->>Server: POST /api/data
  Server->>Database: Query record
  Database-->>Server: Return result
  Server-->>Client: 200 OK
  Client-->>User: Show Success`,
  },
];

export const MermaidModal: React.FC<MermaidModalProps> = ({
  isOpen,
  onClose,
  onInsertObjects,
  viewportCenter,
  theme,
}) => {
  const [code, setCode] = useState(TEMPLATES[0].code);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleInsert = () => {
    try {
      setError(null);
      const objects = parseMermaidToCanvasObjects(
        code,
        viewportCenter.x,
        viewportCenter.y,
        theme
      );
      if (objects.length === 0) {
        setError('No valid nodes or diagram structures found. Check your Mermaid syntax.');
        return;
      }
      onInsertObjects(objects);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse Mermaid diagram.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Code2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">
                Mermaid to Excalidraw
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Paste or type Mermaid syntax to generate editable canvas shapes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Template Quick Picks */}
        <div className="px-5 py-2.5 bg-stone-50 dark:bg-stone-800/40 border-b border-stone-200 dark:border-stone-800 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-stone-400 font-medium shrink-0">Templates:</span>
          {TEMPLATES.map((t) => (
            <button
              key={t.name}
              onClick={() => {
                setCode(t.code);
                setError(null);
              }}
              className="px-2.5 py-1 rounded-md bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:border-indigo-400 dark:hover:border-indigo-500 font-medium transition-colors shrink-0"
            >
              {t.name}
            </button>
          ))}
        </div>

        {/* Code Editor */}
        <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-3">
          <div className="relative flex-1">
            <textarea
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (error) setError(null);
              }}
              placeholder={`flowchart TD\n  A[Start] --> B[Finish]`}
              className="w-full h-64 p-3.5 font-mono text-xs bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-stone-800 dark:text-stone-200 resize-none"
              spellCheck={false}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400 text-xs">
              {error}
            </div>
          )}

          <div className="text-[11px] text-stone-400 dark:text-stone-500 flex items-center gap-1.5">
            <span>Supports standard Mermaid: <code>flowchart TD</code>, <code>flowchart LR</code>, <code>[rect]</code>, <code>(rounded)</code>, <code>{'{diamond}'}</code>, <code>((circle))</code>, <code>sequenceDiagram</code></span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900 flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleInsert}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Insert to Canvas</span>
          </button>
        </div>
      </div>
    </div>
  );
};
