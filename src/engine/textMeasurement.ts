/**
 * Accurate text layout & dimension measurement engine.
 * Computes tight bounding boxes and word-wrapping for canvas text and sticky notes.
 */

let cachedCanvas: HTMLCanvasElement | null = null;
let cachedCtx: CanvasRenderingContext2D | null = null;

function getMeasurementContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!cachedCanvas) {
    cachedCanvas = document.createElement('canvas');
    cachedCtx = cachedCanvas.getContext('2d');
  }
  return cachedCtx;
}

const BOUNDS_CACHE_MAX = 1024;
const boundsCache = new Map<string, { width: number; height: number }>();

const WRAP_CACHE_MAX = 1024;
const wrapCache = new Map<string, string[]>();

export function clearTextMeasurementCache() {
  boundsCache.clear();
  wrapCache.clear();
}

/**
 * Adapts dark text colors to bright readable zinc in dark mode, and
 * light text colors to dark zinc in light/paper mode.
 */
export function resolveThemeTextColor(
  color: string | undefined,
  theme: 'light' | 'dark' | 'paper' = 'light'
): string {
  if (!color) {
    return theme === 'dark' ? '#f4f4f5' : '#1e1e1e';
  }
  const lower = color.trim().toLowerCase();
  if (theme === 'dark') {
    // If text color is black or very dark gray, make it light and readable
    if (
      lower === '#1e1e1e' ||
      lower === '#000000' ||
      lower === '#000' ||
      lower === '#09090b' ||
      lower === '#121212' ||
      lower === '#18181b' ||
      lower === '#27272a' ||
      lower === 'black' ||
      lower === 'rgb(0,0,0)' ||
      lower === 'rgb(0, 0, 0)' ||
      lower === 'rgb(30,30,30)' ||
      lower === 'rgb(30, 30, 30)'
    ) {
      return '#f4f4f5';
    }
  } else {
    // If text color is white or nearly white in light/paper mode, make it dark and readable
    if (
      lower === '#ffffff' ||
      lower === '#fff' ||
      lower === '#f4f4f5' ||
      lower === '#fafafa' ||
      lower === '#f8fafc' ||
      lower === 'white' ||
      lower === 'rgb(255,255,255)' ||
      lower === 'rgb(255, 255, 255)'
    ) {
      return '#1e1e1e';
    }
  }
  return color;
}

/**
 * Accurately measures the width and height of multi-line text at a given font size.
 */
export function measureTextBounds(
  text: string,
  fontSize: number,
  fontFamily: string = 'Caveat, cursive',
  bold: boolean = false,
  italic: boolean = false
): { width: number; height: number } {
  const safeText = text || '';
  const cacheKey = `${safeText}\x00${fontSize}\x00${fontFamily}\x00${bold}\x00${italic}`;
  const cached = boundsCache.get(cacheKey);
  if (cached) return cached;

  const lines = safeText.split('\n');
  const ctx = getMeasurementContext();

  let result: { width: number; height: number };

  if (ctx) {
    const fontStyle = italic ? 'italic ' : '';
    const fontWeight = bold ? '600 ' : '400 ';
    ctx.font = `${fontStyle}${fontWeight}${fontSize}px ${fontFamily}`;
    let maxLineWidth = 0;
    for (const line of lines) {
      if (!line) continue;
      const metrics = ctx.measureText(line);
      if (metrics.width > maxLineWidth) {
        maxLineWidth = metrics.width;
      }
    }
    const lineHeight = fontSize * 1.35;
    const height = Math.max(lineHeight, lines.length * lineHeight);
    result = {
      width: Math.max(40, Math.ceil(maxLineWidth + 16)),
      height: Math.max(24, Math.ceil(height + 10)),
    };
  } else {
    // Robust fallback for non-DOM environments
    const longest = lines.reduce((a, b) => (a.length > b.length ? a : b), '');
    result = {
      width: Math.max(40, Math.ceil(longest.length * fontSize * 0.65 + 16)),
      height: Math.max(24, Math.ceil(lines.length * fontSize * 1.35 + 10)),
    };
  }

  if (boundsCache.size >= BOUNDS_CACHE_MAX) {
    const first = boundsCache.keys().next().value;
    if (first !== undefined) boundsCache.delete(first);
  }
  boundsCache.set(cacheKey, result);
  return result;
}

/**
 * Wraps text into lines that fit within maxWidth using canvas measureText.
 * Uses word-level metrics caching and binary search chunking for long unbroken tokens
 * to ensure instant, zero-latency execution even for massive strings.
 */
export function wrapTextLines(
  text: string,
  maxWidth: number,
  fontSize: number,
  fontFamily: string = 'Caveat, cursive',
  bold: boolean = false,
  italic: boolean = false
): string[] {
  const safeText = text || '';
  if (!safeText) return [''];

  const cacheKey = `${safeText}\x00${maxWidth}\x00${fontSize}\x00${fontFamily}\x00${bold}\x00${italic}`;
  const cached = wrapCache.get(cacheKey);
  if (cached) return cached;

  const ctx = getMeasurementContext();
  if (!ctx) {
    return safeText.split('\n');
  }

  const fontStyle = italic ? 'italic ' : '';
  const fontWeight = bold ? '600 ' : '400 ';
  ctx.font = `${fontStyle}${fontWeight}${fontSize}px ${fontFamily}`;

  // Word metrics cache local to this wrap call
  const wordWidthCache = new Map<string, number>();
  const measureWord = (w: string): number => {
    let width = wordWidthCache.get(w);
    if (width === undefined) {
      width = ctx.measureText(w).width;
      wordWidthCache.set(w, width);
    }
    return width;
  };

  const spaceWidth = measureWord(' ');
  const sampleSample = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const avgCharWidth = Math.max(1, ctx.measureText(sampleSample).width / sampleSample.length);

  const rawParagraphs = safeText.split('\n');
  const wrappedLines: string[] = [];

  for (const paragraph of rawParagraphs) {
    if (!paragraph) {
      wrappedLines.push('');
      continue;
    }

    // Fast path: paragraph fits entirely on one line
    if (measureWord(paragraph) <= maxWidth) {
      wrappedLines.push(paragraph);
      continue;
    }

    const words = paragraph.split(' ');
    let currentLine = '';
    let currentLineWidth = 0;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      if (!word) {
        // Preserves multiple consecutive spaces
        if (currentLine) {
          currentLine += ' ';
          currentLineWidth += spaceWidth;
        }
        continue;
      }

      const wordWidth = measureWord(word);

      // If the word itself exceeds maxWidth (e.g. JSON strings, URLs, long unbroken words)
      if (wordWidth > maxWidth) {
        if (currentLine) {
          wrappedLines.push(currentLine);
          currentLine = '';
          currentLineWidth = 0;
        }

        // Break long unbroken word using binary search chunking
        let remaining = word;
        while (remaining.length > 0) {
          if (measureWord(remaining) <= maxWidth) {
            currentLine = remaining;
            currentLineWidth = measureWord(remaining);
            break;
          }

          let low = 1;
          let high = remaining.length;
          let bestFit = 1;

          while (low <= high) {
            const mid = (low + high) >> 1;
            const testSlice = remaining.slice(0, mid);
            if (measureWord(testSlice) <= maxWidth) {
              bestFit = mid;
              low = mid + 1;
            } else {
              high = mid - 1;
            }
          }

          wrappedLines.push(remaining.slice(0, bestFit));
          remaining = remaining.slice(bestFit);
        }
        continue;
      }

      const addedWidth = currentLine ? spaceWidth + wordWidth : wordWidth;
      if (currentLineWidth + addedWidth <= maxWidth) {
        currentLine = currentLine ? `${currentLine} ${word}` : word;
        currentLineWidth += addedWidth;
      } else {
        if (currentLine) {
          wrappedLines.push(currentLine);
        }
        currentLine = word;
        currentLineWidth = wordWidth;
      }
    }

    if (currentLine) {
      wrappedLines.push(currentLine);
    }
  }

  if (wrapCache.size >= WRAP_CACHE_MAX) {
    const first = wrapCache.keys().next().value;
    if (first !== undefined) wrapCache.delete(first);
  }
  wrapCache.set(cacheKey, wrappedLines);
  return wrappedLines;
}

/**
 * Accurately calculates dimensions and wrapped lines for text within a bounded width.
 */
export function measureWrappedTextBounds(
  text: string,
  width: number,
  fontSize: number,
  fontFamily: string = 'Caveat, cursive',
  bold: boolean = false,
  italic: boolean = false
): { width: number; height: number; lines: string[] } {
  const maxContentWidth = Math.max(30, width - 12);
  const lines = wrapTextLines(text, maxContentWidth, fontSize, fontFamily, bold, italic);
  const lineHeight = fontSize * 1.35;
  const height = Math.max(Math.round(fontSize * 1.5), Math.ceil(Math.max(1, lines.length) * lineHeight + 10));
  return { width, height, lines };
}
