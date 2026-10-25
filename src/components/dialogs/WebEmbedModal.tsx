import React, { useState } from 'react';
import { X, Globe, Video, ExternalLink, Code } from 'lucide-react';
import { EmbedObject } from '../../types/document';

interface WebEmbedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertEmbed: (embed: EmbedObject) => void;
  viewportCenter: { x: number; y: number };
}

export const WebEmbedModal: React.FC<WebEmbedModalProps> = ({
  isOpen,
  onClose,
  onInsertEmbed,
  viewportCenter,
}) => {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let cleanUrl = url.trim();
    if (!cleanUrl) {
      setError('Please enter a valid URL.');
      return;
    }

    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    // Convert YouTube URLs to embed format
    let finalUrl = cleanUrl;
    let embedType: 'youtube' | 'generic' = 'generic';

    const ytMatch = cleanUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    if (ytMatch && ytMatch[1]) {
      finalUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
      embedType = 'youtube';
    }

    // Convert Vimeo URLs to embed format
    const vimeoMatch = cleanUrl.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|)(\d+)/);
    if (vimeoMatch && vimeoMatch[3]) {
      finalUrl = `https://player.vimeo.com/video/${vimeoMatch[3]}`;
      embedType = 'youtube';
    }

    let defaultTitle = title.trim();
    if (!defaultTitle) {
      try {
        const parsed = new URL(cleanUrl);
        defaultTitle = parsed.hostname.replace('www.', '');
      } catch {
        defaultTitle = 'Web Embed';
      }
    }

    const embedObj: EmbedObject = {
      id: 'embed-' + Math.random().toString(36).substring(2, 9),
      pageId: null,
      type: 'embed',
      layerId: 'layer-embeds',
      x: Math.round(viewportCenter.x - 260),
      y: Math.round(viewportCenter.y - 180),
      width: 520,
      height: 340,
      url: finalUrl,
      title: defaultTitle,
      embedType,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deviceId: 'local',
    };

    onInsertEmbed(embedObj);
    setUrl('');
    setTitle('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Code className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-stone-900 dark:text-stone-100 text-sm">
                Web Embed
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Embed websites, YouTube videos, Figma prototypes, or interactive widgets
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3.5">
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
              URL or Link
            </label>
            <div className="relative">
              <input
                type="text"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="https://youtube.com/watch?v=... or https://..."
                autoFocus
                className="w-full px-3.5 py-2.5 text-xs bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-stone-800 dark:text-stone-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
              Title (Optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Tutorial Video / Reference Page"
              className="w-full px-3.5 py-2.5 text-xs bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-stone-800 dark:text-stone-200"
            />
          </div>

          {error && (
            <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400 text-xs">
              {error}
            </div>
          )}

          <div className="p-3 bg-stone-50 dark:bg-stone-800/40 rounded-xl border border-stone-200/60 dark:border-stone-700/60 flex flex-col gap-1 text-[11px] text-stone-500 dark:text-stone-400">
            <span className="font-semibold text-stone-600 dark:text-stone-300">Supported embeds:</span>
            <span>• YouTube, Vimeo, Twitch</span>
            <span>• Figma, CodePen, Google Maps</span>
            <span>• Any embeddable website / iframe</span>
          </div>

          {/* Footer Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Embed to Canvas</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
