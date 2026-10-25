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
  const lines = (text || '').split('\n');
  const ctx = getMeasurementContext();

  if (ctx) {
    const fontStyle = italic ? 'italic ' : '';
    const fontWeight = bold ? '600 ' : '400 ';
    ctx.font = `${fontStyle}${fontWeight}${fontSize}px ${fontFamily}`;
    let maxLineWidth = 0;
    for (const line of lines) {
      const metrics = ctx.measureText(line || ' ');
      if (metrics.width > maxLineWidth) {
        maxLineWidth = metrics.width;
      }
    }
    const lineHeight = fontSize * 1.35;
    const height = Math.max(lineHeight, lines.length * lineHeight);
    return {
      width: Math.max(40, Math.ceil(maxLineWidth + 16)),
      height: Math.max(24, Math.ceil(height + 10)),
    };
  }

  // Robust fallback for non-DOM environments
  const longest = lines.reduce((a, b) => (a.length > b.length ? a : b), '');
  return {
    width: Math.max(40, Math.ceil(longest.length * fontSize * 0.65 + 16)),
    height: Math.max(24, Math.ceil(lines.length * fontSize * 1.35 + 10)),
  };
}

/**
 * Wraps text into lines that fit within maxWidth using canvas measureText.
 */
export function wrapTextLines(
  text: string,
  maxWidth: number,
  fontSize: number,
  fontFamily: string = 'Caveat, cursive',
  bold: boolean = false,
  italic: boolean = false
): string[] {
  const ctx = getMeasurementContext();
  if (!ctx) {
    return (text || '').split('\n');
  }

  const fontStyle = italic ? 'italic ' : '';
  const fontWeight = bold ? '600 ' : '400 ';
  ctx.font = `${fontStyle}${fontWeight}${fontSize}px ${fontFamily}`;
  const rawParagraphs = (text || '').split('\n');
  const wrappedLines: string[] = [];

  for (const paragraph of rawParagraphs) {
    if (!paragraph.trim()) {
      wrappedLines.push('');
      continue;
    }
    const words = paragraph.split(' ');
    let currentLine = '';
    for (const word of words) {
      const wordWidth = ctx.measureText(word).width;

      // If the word itself exceeds maxWidth, break it character-by-character
      if (wordWidth > maxWidth) {
        if (currentLine) {
          wrappedLines.push(currentLine);
          currentLine = '';
        }
        let chunk = '';
        for (const char of word) {
          const testChunk = chunk + char;
          if (ctx.measureText(testChunk).width <= maxWidth) {
            chunk = testChunk;
          } else {
            if (chunk) wrappedLines.push(chunk);
            chunk = char;
          }
        }
        if (chunk) {
          currentLine = chunk;
        }
        continue;
      }

      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = ctx.measureText(testLine).width;
      if (testWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          wrappedLines.push(currentLine);
        }
        currentLine = word;
      }
    }
    if (currentLine) {
      wrappedLines.push(currentLine);
    }
  }

  return wrappedLines;
}
