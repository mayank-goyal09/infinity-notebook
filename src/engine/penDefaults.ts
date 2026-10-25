import { PenConfig } from '../types/document';

export const DEFAULT_PENS: PenConfig[] = [
  {
    id: 'ballpoint',
    name: 'Ballpoint Pen',
    type: 'ballpoint',
    color: '#09090b',
    size: 2.5,
    opacity: 0.95,
    smoothing: 0.6,
  },
  {
    id: 'gel',
    name: 'Gel Pen',
    type: 'gel',
    color: '#2563eb',
    size: 3.5,
    opacity: 1.0,
    smoothing: 0.7,
  },
  {
    id: 'fineliner',
    name: 'Fineliner',
    type: 'fineliner',
    color: '#18181b',
    size: 1.5,
    opacity: 1.0,
    smoothing: 0.8,
  },
  {
    id: 'fountain',
    name: 'Fountain Pen',
    type: 'fountain',
    color: '#1e3a8a',
    size: 4.0,
    opacity: 0.95,
    smoothing: 0.65,
    taperStart: 0.4,
    taperEnd: 0.7,
  },
  {
    id: 'calligraphy',
    name: 'Calligraphy Nib',
    type: 'calligraphy',
    color: '#831843',
    size: 7.0,
    opacity: 0.95,
    smoothing: 0.5,
    customNibAngle: 40,
  },
  {
    id: 'brush',
    name: 'Brush Pen',
    type: 'brush',
    color: '#0f766e',
    size: 6.0,
    opacity: 0.9,
    smoothing: 0.75,
    taperStart: 0.8,
    taperEnd: 0.8,
  },
  {
    id: 'marker',
    name: 'Marker',
    type: 'marker',
    color: '#b91c1c',
    size: 8.0,
    opacity: 0.85,
    smoothing: 0.5,
  },
  {
    id: 'highlighter',
    name: 'Highlighter',
    type: 'highlighter',
    color: '#fef08a', // vibrant yellow
    size: 24.0,
    opacity: 0.45,
    smoothing: 0.6,
  },
  {
    id: 'pencil',
    name: 'Graphite Pencil (2B)',
    type: 'pencil',
    color: '#52525b',
    size: 2.0,
    opacity: 0.8,
    smoothing: 0.4,
  },
  {
    id: 'charcoal',
    name: 'Charcoal Stick',
    type: 'charcoal',
    color: '#27272a',
    size: 9.0,
    opacity: 0.7,
    smoothing: 0.4,
  },
  {
    id: 'airbrush',
    name: 'Airbrush / Spray',
    type: 'airbrush',
    color: '#7c3aed',
    size: 32.0,
    opacity: 0.3,
    smoothing: 0.3,
  },
  {
    id: 'dashed',
    name: 'Technical Dashed',
    type: 'dashed',
    color: '#4b5563',
    size: 2.0,
    opacity: 0.9,
    smoothing: 0.6,
  },
  {
    id: 'laser',
    name: 'Laser Pointer',
    type: 'laser',
    color: '#ef4444',
    size: 14.0,
    opacity: 0.95,
    smoothing: 0.8,
  },
];

export const COLOR_PALETTE = [
  '#09090b', // Ink Black
  '#2563eb', // Royal Blue
  '#1e3a8a', // Deep Navy
  '#dc2626', // Crimson Red
  '#16a34a', // Emerald Green
  '#d97706', // Warm Amber
  '#7c3aed', // Purple Violet
  '#db2777', // Rose Pink
  '#0f766e', // Teal Cyan
  '#fde047', // Highlighter Yellow
  '#86efac', // Highlighter Green
  '#93c5fd', // Highlighter Sky
  '#f9a8d4', // Highlighter Pink
  '#fdba74', // Highlighter Orange
  '#ffffff', // Clean White
];

export const PAGE_SIZE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  A4: { width: 794, height: 1123 }, // standard 96dpi A4 (210 x 297mm)
  A5: { width: 559, height: 794 },  // A5
  Letter: { width: 816, height: 1056 }, // US Letter (8.5 x 11in)
  Square: { width: 800, height: 800 },
  Slide16_9: { width: 1280, height: 720 },
  Custom: { width: 900, height: 1200 },
};
