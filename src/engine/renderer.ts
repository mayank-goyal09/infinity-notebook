import {
  CameraState,
  CanvasObject,
  LaserTrailPoint,
  PageFrame,
  PageTemplate,
  StrokeObject,
  StrokePoint,
  ShapeObject,
  TextObject,
  StickyNoteObject,
  ImageObject,
  SelectionState,
  AccountingTableObject,
  FrameObject,
  EmbedObject,
} from '../types/document';
import { evaluateTableBalance } from './accountingFormats';
import { wrapTextLines } from './textMeasurement';
import { catmullRomToBezier, calibrateHardwarePressure } from './smoothing';
import { getStroke } from 'perfect-freehand';

export interface ViewportRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export class CanvasRenderer {
  private imageCache = new Map<string, HTMLImageElement>();
  private patternCache = new Map<string, CanvasPattern>();

  /**
   * Helper: Cache and create Excalidraw-style hachure / cross-hatch fill patterns
   */
  private getHatchPattern(ctx: CanvasRenderingContext2D, color: string, isCross: boolean): CanvasPattern | null {
    const key = `${color}_${isCross ? 'cross' : 'hachure'}`;
    const cached = this.patternCache.get(key);
    if (cached) return cached;
    try {
      const pCanvas = document.createElement('canvas');
      pCanvas.width = 14;
      pCanvas.height = 14;
      const pctx = pCanvas.getContext('2d');
      if (!pctx) return null;
      pctx.strokeStyle = color;
      pctx.lineWidth = 1.5;
      pctx.beginPath();
      pctx.moveTo(0, 14);
      pctx.lineTo(14, 0);
      pctx.stroke();
      if (isCross) {
        pctx.beginPath();
        pctx.moveTo(0, 0);
        pctx.lineTo(14, 14);
        pctx.stroke();
      }
      const pattern = ctx.createPattern(pCanvas, 'repeat');
      if (pattern) {
        this.patternCache.set(key, pattern);
        return pattern;
      }
    } catch {
      // fallback
    }
    return null;
  }

  public getVisibleDocRect(camera: CameraState, width: number, height: number): ViewportRect {
    const margin = 100; // doc units buffer
    return {
      minX: (0 - camera.x) / camera.zoom - margin,
      minY: (0 - camera.y) / camera.zoom - margin,
      maxX: (width - camera.x) / camera.zoom + margin,
      maxY: (height - camera.y) / camera.zoom + margin,
    };
  }

  public intersects(rectA: ViewportRect, rectB: { x: number; y: number; width: number; height: number }): boolean {
    return !(
      rectB.x + rectB.width < rectA.minX ||
      rectB.x > rectA.maxX ||
      rectB.y + rectB.height < rectA.minY ||
      rectB.y > rectA.maxY
    );
  }

  /**
   * Render Document Layer (Pages, Backgrounds, Objects)
   */
  public renderDocument(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    camera: CameraState,
    pages: PageFrame[],
    objects: CanvasObject[],
    currentMode: 'notebook' | 'canvas',
    theme: 'light' | 'dark' | 'paper',
    customBgColor?: string
  ): number {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    // Clear viewport with theme canvas color
    ctx.clearRect(0, 0, width, height);

    const canvasBg =
      customBgColor || (theme === 'dark' ? '#09090b' : '#f8fafc');
    ctx.fillStyle = canvasBg;
    ctx.fillRect(0, 0, width, height);

    // Apply camera transform
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);

    const visibleRect = this.getVisibleDocRect(camera, width, height);

    // Render clean infinite spreadsheet grid lines
    this.renderInfiniteSpreadsheetGrid(ctx, visibleRect, theme);

    let renderedCount = 0;

    // 1. Draw Pages / Frames
    for (const page of pages) {
      if (this.intersects(visibleRect, page)) {
        this.renderPageBackground(ctx, page, theme, currentMode);
      }
    }

    // 2. Render Objects with Spatial Culling
    for (const obj of objects) {
      if (this.intersects(visibleRect, obj)) {
        this.renderObject(ctx, obj, camera.zoom, theme);
        renderedCount++;
      }
    }

    ctx.restore();
    return renderedCount;
  }

  /**
   * Render continuous spreadsheet grid lines across the infinite canvas
   */
  private renderInfiniteSpreadsheetGrid(
    ctx: CanvasRenderingContext2D,
    rect: ViewportRect,
    theme: 'light' | 'dark' | 'paper'
  ) {
    const colW = 100;
    const rowH = 28;
    const gridColor =
      theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.06)';

    const startX = Math.floor(rect.minX / colW) * colW;
    const endX = Math.ceil(rect.maxX / colW) * colW;
    const startY = Math.floor(rect.minY / rowH) * rowH;
    const endY = Math.ceil(rect.maxY / rowH) * rowH;

    ctx.save();
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (let gx = startX; gx <= endX; gx += colW) {
      ctx.moveTo(gx, rect.minY);
      ctx.lineTo(gx, rect.maxY);
    }
    for (let gy = startY; gy <= endY; gy += rowH) {
      ctx.moveTo(rect.minX, gy);
      ctx.lineTo(rect.maxX, gy);
    }
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Render Page Background & Template Patterns
   */
  public renderPageBackground(
    ctx: CanvasRenderingContext2D,
    page: PageFrame,
    theme: 'light' | 'dark' | 'paper',
    mode: 'notebook' | 'canvas'
  ) {
    ctx.save();
    const { x, y, width, height, template, templateSpacing } = page;

    // Page drop shadow
    ctx.shadowColor =
      theme === 'dark' ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.08)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 6;

    // Page body background
    const pageFill =
      page.templateColor ||
      (theme === 'dark' ? '#18181b' : theme === 'paper' ? '#fcf9f2' : '#ffffff');
    ctx.fillStyle = pageFill;
    ctx.fillRect(x, y, width, height);

    // Reset shadow for page content lines
    ctx.shadowColor = 'transparent';

    // Page border
    ctx.strokeStyle =
      theme === 'dark' ? '#27272a' : theme === 'paper' ? '#e7dfd3' : '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);

    // Canvas Mode: Frame title header
    if (mode === 'canvas') {
      ctx.fillStyle = theme === 'dark' ? '#71717a' : '#94a3b8';
      ctx.font = '500 12px Inter, sans-serif';
      ctx.fillText(`${page.title || `Page ${page.pageNumber}`}`, x + 12, y - 10);
    }

    // Template patterns
    this.renderTemplatePattern(ctx, x, y, width, height, template, templateSpacing, theme);

    ctx.restore();
  }

  private renderTemplatePattern(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    template: PageTemplate,
    spacing: number,
    theme: 'light' | 'dark' | 'paper'
  ) {
    const gridColor =
      theme === 'dark'
        ? 'rgba(255, 255, 255, 0.07)'
        : theme === 'paper'
        ? 'rgba(120, 100, 80, 0.12)'
        : 'rgba(0, 0, 0, 0.08)';

    const marginColor =
      theme === 'dark' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.35)';

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip(); // clip to page boundaries

    ctx.strokeStyle = gridColor;
    ctx.fillStyle = gridColor;
    ctx.lineWidth = 0.75;

    switch (template) {
      case 'spreadsheet': {
        const colW = 75;
        const rowH = 26;
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        for (let gx = x + colW; gx < x + width; gx += colW) {
          ctx.moveTo(gx, y);
          ctx.lineTo(gx, y + height);
        }
        for (let gy = y + rowH; gy < y + height; gy += rowH) {
          ctx.moveTo(x, gy);
          ctx.lineTo(x + width, gy);
        }
        ctx.stroke();
        break;
      }

      case 'lined': {
        const topMargin = 64;
        const leftMargin = 72;
        // Red left margin rule
        ctx.strokeStyle = marginColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + leftMargin, y);
        ctx.lineTo(x + leftMargin, y + height);
        ctx.stroke();

        // Horizontal ruled lines
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 0.75;
        ctx.beginPath();
        for (let ly = y + topMargin; ly < y + height - 20; ly += spacing) {
          ctx.moveTo(x, ly);
          ctx.lineTo(x + width, ly);
        }
        ctx.stroke();
        break;
      }

      case 'grid': {
        ctx.beginPath();
        for (let gx = x + spacing; gx < x + width; gx += spacing) {
          ctx.moveTo(gx, y);
          ctx.lineTo(gx, y + height);
        }
        for (let gy = y + spacing; gy < y + height; gy += spacing) {
          ctx.moveTo(x, gy);
          ctx.lineTo(x + width, gy);
        }
        ctx.stroke();
        break;
      }

      case 'dotted': {
        const dotRadius = 0.9;
        for (let gx = x + spacing; gx < x + width; gx += spacing) {
          for (let gy = y + spacing; gy < y + height; gy += spacing) {
            ctx.beginPath();
            ctx.arc(gx, gy, dotRadius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        break;
      }

      case 'isometric': {
        // Isometric triangular grid (30-degree angles)
        const isoHeight = spacing * Math.sqrt(3);
        ctx.beginPath();
        for (let ix = x - height; ix < x + width + height; ix += spacing * 2) {
          ctx.moveTo(ix, y);
          ctx.lineTo(ix + height * 0.577, y + height);
          ctx.moveTo(ix, y);
          ctx.lineTo(ix - height * 0.577, y + height);
        }
        for (let iy = y + isoHeight; iy < y + height; iy += isoHeight) {
          ctx.moveTo(x, iy);
          ctx.lineTo(x + width, iy);
        }
        ctx.stroke();
        break;
      }

      case 'cornell': {
        const cueWidth = Math.min(220, width * 0.3);
        const summaryHeight = Math.min(160, height * 0.2);

        // Cue column vertical divider
        ctx.strokeStyle = marginColor;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x + cueWidth, y);
        ctx.lineTo(x + cueWidth, y + height - summaryHeight);
        ctx.moveTo(x, y + height - summaryHeight);
        ctx.lineTo(x + width, y + height - summaryHeight);
        ctx.stroke();

        // Horizontal lines in note section
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 0.75;
        ctx.beginPath();
        for (let ly = y + 50; ly < y + height - summaryHeight - 10; ly += spacing) {
          ctx.moveTo(x + cueWidth, ly);
          ctx.lineTo(x + width, ly);
        }
        // Horizontal lines in summary
        for (let ly = y + height - summaryHeight + 35; ly < y + height - 10; ly += spacing) {
          ctx.moveTo(x, ly);
          ctx.lineTo(x + width, ly);
        }
        ctx.stroke();
        break;
      }

      case 'music': {
        const staffSpacing = 8;
        const systemGap = 42;
        ctx.beginPath();
        for (let sy = y + 60; sy < y + height - 60; sy += 5 * staffSpacing + systemGap) {
          for (let line = 0; line < 5; line++) {
            const ly = sy + line * staffSpacing;
            ctx.moveTo(x + 40, ly);
            ctx.lineTo(x + width - 40, ly);
          }
        }
        ctx.stroke();
        break;
      }

      case 'todo': {
        ctx.beginPath();
        for (let ty = y + 60; ty < y + height - 30; ty += spacing) {
          // checkbox circle
          ctx.arc(x + 36, ty, 6, 0, Math.PI * 2);
          ctx.moveTo(x + 56, ty);
          ctx.lineTo(x + width - 36, ty);
        }
        ctx.stroke();
        break;
      }

      case 'blank':
      default:
        break;
    }

    ctx.restore();
  }

  /**
   * Render Canvas Objects (Strokes, Shapes, Text, Sticky, Image)
   */
  public renderObject(
    ctx: CanvasRenderingContext2D,
    obj: CanvasObject,
    zoom: number,
    theme: 'light' | 'dark' | 'paper'
  ) {
    switch (obj.type) {
      case 'stroke':
        this.renderStroke(ctx, obj, zoom);
        break;
      case 'shape':
        this.renderShape(ctx, obj);
        break;
      case 'text':
        this.renderText(ctx, obj);
        break;
      case 'sticky':
        this.renderStickyNote(ctx, obj);
        break;
      case 'image':
        this.renderImage(ctx, obj);
        break;
      case 'table':
        this.renderAccountingTable(ctx, obj, zoom, theme);
        break;
      case 'frame':
        this.renderFrame(ctx, obj as FrameObject, zoom, theme);
        break;
      case 'embed':
        this.renderEmbedCard(ctx, obj as EmbedObject, zoom, theme);
        break;
    }
  }

  /**
   * Render Accounting Spreadsheet Table on Canvas
   */
  public renderAccountingTable(
    ctx: CanvasRenderingContext2D,
    table: AccountingTableObject,
    _zoom: number,
    theme: 'light' | 'dark' | 'paper'
  ) {
    ctx.save();
    const { x, y, columns, rows, title, showBalancedIndicator, currencySymbol = '$' } = table;
    const isDark = theme === 'dark';

    const headerHeight = 32;
    const rowHeight = 28;
    const titleBarHeight = 32;

    const totalWidth = columns.reduce((acc, c) => acc + c.width, 0);
    const totalHeight = titleBarHeight + headerHeight + rows.length * rowHeight;

    // Table container shadow and background card
    ctx.shadowColor = isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(15, 23, 42, 0.08)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;

    const isTransparent = table.bgColor === 'transparent';
    const tableBg = table.bgColor
      ? (isTransparent ? null : table.bgColor)
      : (isDark ? '#18181b' : '#ffffff');

    if (tableBg) {
      ctx.fillStyle = tableBg;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, totalWidth, totalHeight, 6);
      } else {
        ctx.rect(x, y, totalWidth, totalHeight);
      }
      ctx.fill();
    }

    ctx.shadowColor = 'transparent'; // reset shadow

    // Outer table border
    const borderColor = isDark ? '#27272a' : '#cbd5e1';
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, totalWidth, totalHeight, 6);
    } else {
      ctx.strokeRect(x, y, totalWidth, totalHeight);
    }
    ctx.stroke();

    // 1. Title bar
    const titleBg = isTransparent
      ? 'rgba(0, 0, 0, 0.04)'
      : (table.headerBgColor || (isDark ? '#27272a' : '#f8fafc'));
    ctx.fillStyle = titleBg;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, totalWidth, titleBarHeight, [6, 6, 0, 0]);
      ctx.fill();
    } else {
      ctx.fillRect(x, y, totalWidth, titleBarHeight);
    }

    // Title text
    const defaultTextColor = table.textColor || (isDark ? '#f4f4f5' : '#0f172a');
    ctx.fillStyle = defaultTextColor;
    ctx.font = '600 13px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(title || 'Accounting Table', x + 12, y + titleBarHeight / 2);

    // Balance Indicator badge
    if (showBalancedIndicator) {
      const balance = evaluateTableBalance(table);
      if (balance) {
        ctx.font = '500 11px Inter, -apple-system, sans-serif';
        if (balance.isBalanced) {
          const badgeText = `Balanced (${currencySymbol}${balance.debitTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })})`;
          const badgeWidth = ctx.measureText(badgeText).width + 16;
          ctx.fillStyle = isDark ? 'rgba(34, 197, 94, 0.15)' : '#dcfce7';
          ctx.fillRect(x + totalWidth - badgeWidth - 10, y + 6, badgeWidth, 20);
          ctx.fillStyle = isDark ? '#4ade80' : '#15803d';
          ctx.fillText(badgeText, x + totalWidth - badgeWidth - 2, y + titleBarHeight / 2);
        } else {
          const badgeText = `Out of Balance: ${currencySymbol}${balance.difference.toFixed(2)}`;
          const badgeWidth = ctx.measureText(badgeText).width + 16;
          ctx.fillStyle = isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2';
          ctx.fillRect(x + totalWidth - badgeWidth - 10, y + 6, badgeWidth, 20);
          ctx.fillStyle = isDark ? '#f87171' : '#b91c1c';
          ctx.fillText(badgeText, x + totalWidth - badgeWidth - 2, y + titleBarHeight / 2);
        }
      }
    }

    // Divider under title bar
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + titleBarHeight);
    ctx.lineTo(x + totalWidth, y + titleBarHeight);
    ctx.stroke();

    // 2. Column Headers
    const headerY = y + titleBarHeight;
    const headerBg = isTransparent
      ? 'rgba(0, 0, 0, 0.02)'
      : (table.headerBgColor || (isDark ? '#1f2937' : '#f1f5f9'));
    ctx.fillStyle = headerBg;
    ctx.fillRect(x, headerY, totalWidth, headerHeight);

    let curX = x;
    ctx.fillStyle = table.headerTextColor || defaultTextColor;
    ctx.font = '600 12px Inter, -apple-system, sans-serif';

    columns.forEach((col, idx) => {
      let textX = curX + 8;
      if (col.align === 'center') textX = curX + col.width / 2;
      else if (col.align === 'right') textX = curX + col.width - 8;

      ctx.textAlign = col.align;
      ctx.textBaseline = 'middle';
      ctx.fillText(col.label, textX, headerY + headerHeight / 2);

      curX += col.width;

      if (idx < columns.length - 1) {
        ctx.strokeStyle = isDark ? '#374151' : '#cbd5e1';
        ctx.beginPath();
        ctx.moveTo(curX, headerY);
        ctx.lineTo(curX, headerY + headerHeight);
        ctx.stroke();
      }
    });

    // Divider under headers
    ctx.strokeStyle = isDark ? '#374151' : '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, headerY + headerHeight);
    ctx.lineTo(x + totalWidth, headerY + headerHeight);
    ctx.stroke();

    // 3. Rows
    let rowY = headerY + headerHeight;
    rows.forEach((row) => {
      const isTotal = row.isTotal;
      const isSubtotal = row.isSubtotal;

      if (isTotal) {
        ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc';
        ctx.fillRect(x, rowY, totalWidth, rowHeight);
      } else if (isSubtotal) {
        ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.02)' : '#fdfdfe';
        ctx.fillRect(x, rowY, totalWidth, rowHeight);
      }

      if (isTotal) {
        // Single top border
        ctx.strokeStyle = isDark ? '#71717a' : '#475569';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, rowY);
        ctx.lineTo(x + totalWidth, rowY);
        ctx.stroke();

        // Double bottom border (Standard Accounting Underline)
        ctx.beginPath();
        ctx.moveTo(x, rowY + rowHeight - 3);
        ctx.lineTo(x + totalWidth, rowY + rowHeight - 3);
        ctx.moveTo(x, rowY + rowHeight - 1);
        ctx.lineTo(x + totalWidth, rowY + rowHeight - 1);
        ctx.stroke();
      } else {
        ctx.strokeStyle = isDark ? '#27272a' : '#f1f5f9';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, rowY + rowHeight);
        ctx.lineTo(x + totalWidth, rowY + rowHeight);
        ctx.stroke();
      }

      let cellX = x;
      columns.forEach((col, idx) => {
        const cell = row.cells[col.id];
        if (cell) {
          ctx.fillStyle =
            cell.textColor ||
            table.textColor ||
            (isDark
              ? cell.bold
                ? '#fafafa'
                : '#d4d4d8'
              : cell.bold
              ? '#0f172a'
              : '#334155');
          const fontStyle = cell.italic ? 'italic ' : '';
          const fontWeight = cell.bold || isTotal ? '600 ' : '400 ';
          ctx.font = `${fontStyle}${fontWeight}12px Inter, -apple-system, sans-serif`;

          const align = cell.align || col.align;
          let textX = cellX + 8;
          if (align === 'center') textX = cellX + col.width / 2;
          else if (align === 'right') textX = cellX + col.width - 8;

          ctx.textAlign = align;
          ctx.textBaseline = 'middle';
          let val = cell.value || '';
          if (
            val &&
            col.format === 'currency' &&
            !val.includes(currencySymbol) &&
            !isNaN(Number(val))
          ) {
            val = Number(val).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
          }
          ctx.fillText(val, textX, rowY + rowHeight / 2);
        }

        cellX += col.width;

        if (idx < columns.length - 1) {
          ctx.strokeStyle = isDark ? '#27272a' : '#e2e8f0';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(cellX, rowY);
          ctx.lineTo(cellX, rowY + rowHeight);
          ctx.stroke();
        }
      });

      rowY += rowHeight;
    });

    ctx.restore();
  }

  // ============================================================================
  // LANDMARK: APPLE-LIKE LOW-LATENCY VECTOR STROKE RENDERER (Catmull-Rom & Bézier)
  // ============================================================================
  /**
   * Render Vector Stroke with Pen-Specific Physics, Centripetal Splines, and Calibrated Curves
   */
  public renderStroke(
    ctx: CanvasRenderingContext2D,
    stroke: StrokeObject,
    zoom: number,
    isCommitted = true
  ) {
    const { points, penType, color, size, opacity } = stroke;
    const pts = points;
    if (pts.length === 0) return;

    ctx.save();
    ctx.imageSmoothingQuality = 'high';
    ctx.globalAlpha = opacity;

    // Highlighter: use multiply blend mode so ink sits gracefully under text
    if (stroke.isHighlighter || penType === 'highlighter') {
      ctx.globalCompositeOperation = 'multiply';
    }

    ctx.strokeStyle = color;
    ctx.fillStyle = color;

    // Single dot or deliberate tap
    if (pts.length === 1) {
      const p = pts[0];
      const calPressure = calibrateHardwarePressure(p.pressure ?? 0.7);
      const dotRadius = Math.max(1, (size * calPressure) / 2);
      ctx.beginPath();
      ctx.arc(p.x, p.y, dotRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    // Calligraphy chisel nib simulation
    if (penType === 'calligraphy') {
      this.renderCalligraphyStroke(ctx, pts, size, color);
      ctx.restore();
      return;
    }

    // Pencil graphite stipple effect
    if (penType === 'pencil' || penType === 'charcoal') {
      ctx.shadowColor = color;
      ctx.shadowBlur = 0.5;
    }

    // Dashed pen
    if (penType === 'dashed') {
      ctx.setLineDash([size * 3, size * 2]);
      ctx.lineWidth = size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
      ctx.restore();
      return;
    }

    // Excalidraw-grade freehand ribbon rendering via perfect-freehand (Method A: filled polygon only, 0 chord lines)
    // Used for all standard pens, brush, fountain, marker, and highlighter (ONE filled path, no overlap darkening)
    this.renderVariableWidthStroke(ctx, pts, size, penType, isCommitted);
    ctx.restore();
  }

  /**
   * Render continuous variable-width stroke using the Excalidraw perfect-freehand algorithm:
   * 1. Streamline and smooth raw points to eliminate hand tremor and digitizer jitter
   * 2. Compute non-linear pressure width with gentle sine easing
   * 3. Apply tapered start and end caps
   * 4. Convert outline points to smooth midpoint quadratic curves and FILL ONLY (0 chord lines)
   */
  private renderVariableWidthStroke(
    ctx: CanvasRenderingContext2D,
    points: StrokePoint[],
    baseSize: number,
    penType?: string,
    isCommitted = true
  ) {
    if (points.length < 2) return;

    const isHighlighter = penType === 'highlighter';

    // Check if the stroke has genuine hardware stylus pressure variation
    const hasRealPressure = points.some(
      (p) => p.pressure !== undefined && p.pressure > 0 && Math.abs(p.pressure - 0.5) > 0.05
    );

    // Prepare input points: [x, y, pressure]
    const inputPoints: [number, number, number][] = points.map((p) => [
      p.x,
      p.y,
      p.pressure !== undefined ? calibrateHardwarePressure(p.pressure) : 0.55,
    ]);

    // Tune visual size to match Excalidraw's feel and Infinity Notebook's pen presets:
    const strokeSize = isHighlighter ? baseSize * 3.5 : Math.max(1.5, baseSize * 1.5);
    const taperLength = isHighlighter ? 0 : Math.min(strokeSize * 0.5, 4);

    const outlinePoints = getStroke(inputPoints, {
      size: strokeSize,
      thinning: isHighlighter ? 0 : 0.55,
      smoothing: 0.55,
      streamline: 0.4,
      simulatePressure: !hasRealPressure && !isHighlighter,
      easing: (t: number) => Math.sin((t * Math.PI) / 2),
      start: {
        taper: taperLength,
        cap: true,
      },
      end: {
        taper: taperLength,
        cap: true,
      },
      last: true, // Keep geometry 100% identical between live drawing and committed state
    });

    if (outlinePoints.length < 3) {
      if (outlinePoints.length === 2) {
        ctx.beginPath();
        ctx.arc(outlinePoints[0][0], outlinePoints[0][1], strokeSize / 4, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    // Convert outline points to smooth midpoint quadratic curves (Excalidraw standard)
    ctx.beginPath();
    const len = outlinePoints.length;
    const p0 = outlinePoints[0];
    const p1 = outlinePoints[1];
    ctx.moveTo((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2);

    for (let i = 1; i < len; i++) {
      const cur = outlinePoints[i];
      const next = outlinePoints[(i + 1) % len];
      ctx.quadraticCurveTo(cur[0], cur[1], (cur[0] + next[0]) / 2, (cur[1] + next[1]) / 2);
    }

    // Bridge the final segment back to start midpoint smoothly
    ctx.quadraticCurveTo(outlinePoints[0][0], outlinePoints[0][1], (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2);

    ctx.closePath();
    ctx.fill(); // Never stroke(), only fill
  }

  private renderCalligraphyStroke(
    ctx: CanvasRenderingContext2D,
    points: StrokePoint[],
    size: number,
    color: string
  ) {
    const angleRad = (40 * Math.PI) / 180;
    const dx = Math.cos(angleRad) * (size / 2);
    const dy = Math.sin(angleRad) * (size / 2);

    ctx.beginPath();
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (i === 0) {
        ctx.moveTo(p.x - dx, p.y - dy);
      } else {
        ctx.lineTo(p.x - dx, p.y - dy);
      }
    }
    for (let i = points.length - 1; i >= 0; i--) {
      const p = points[i];
      ctx.lineTo(p.x + dx, p.y + dy);
    }
    ctx.closePath();
    ctx.fill();
  }

  public renderShape(ctx: CanvasRenderingContext2D, shape: ShapeObject) {
    ctx.save();
    if (shape.opacity !== undefined) {
      ctx.globalAlpha = shape.opacity;
    }
    ctx.strokeStyle = shape.strokeColor;
    ctx.fillStyle = shape.fillColor || 'transparent';
    ctx.lineWidth = shape.strokeWidth;

    if (shape.strokeStyle === 'dashed') ctx.setLineDash([8, 6]);
    else if (shape.strokeStyle === 'dotted') ctx.setLineDash([2, 4]);

    const { x, y, width, height, shapeType } = shape;

    ctx.beginPath();
    switch (shapeType) {
      case 'rectangle':
        ctx.rect(x, y, width, height);
        break;

      case 'polygon': // Diamond / Rhombus (the shape right after square)
        ctx.moveTo(x + width / 2, y);
        ctx.lineTo(x + width, y + height / 2);
        ctx.lineTo(x + width / 2, y + height);
        ctx.lineTo(x, y + height / 2);
        ctx.closePath();
        break;

      case 'rounded_rect': {
        const radius = Math.min(16, width / 4, height / 4);
        ctx.roundRect(x, y, width, height, radius);
        break;
      }

      case 'ellipse':
        ctx.ellipse(x + width / 2, y + height / 2, Math.abs(width / 2), Math.abs(height / 2), 0, 0, Math.PI * 2);
        break;

      case 'line':
      case 'arrow':
      case 'connector': {
        const sx = shape.startPoint?.x ?? x;
        const sy = shape.startPoint?.y ?? y;
        const ex = shape.endPoint?.x ?? x + width;
        const ey = shape.endPoint?.y ?? y + height;

        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();

        // Arrow head
        if (shape.arrowEnd || shapeType === 'arrow' || shapeType === 'connector') {
          const angle = Math.atan2(ey - sy, ex - sx);
          const headLen = Math.max(12, shape.strokeWidth * 3.5);
          ctx.beginPath();
          ctx.moveTo(ex, ey);
          ctx.lineTo(ex - headLen * Math.cos(angle - Math.PI / 6), ey - headLen * Math.sin(angle - Math.PI / 6));
          ctx.moveTo(ex, ey);
          ctx.lineTo(ex - headLen * Math.cos(angle + Math.PI / 6), ey - headLen * Math.sin(angle + Math.PI / 6));
          ctx.stroke();
        }
        ctx.restore();
        return;
      }

      case 'triangle':
        ctx.moveTo(x + width / 2, y);
        ctx.lineTo(x + width, y + height);
        ctx.lineTo(x, y + height);
        ctx.closePath();
        break;

      case 'star': {
        const cx = x + width / 2;
        const cy = y + height / 2;
        const outerR = Math.min(width, height) / 2;
        const innerR = outerR * 0.45;
        const spikes = 5;
        let rot = (Math.PI / 2) * 3;
        const step = Math.PI / spikes;

        ctx.moveTo(cx, cy - outerR);
        for (let i = 0; i < spikes; i++) {
          let px = cx + Math.cos(rot) * outerR;
          let py = cy + Math.sin(rot) * outerR;
          ctx.lineTo(px, py);
          rot += step;

          px = cx + Math.cos(rot) * innerR;
          py = cy + Math.sin(rot) * innerR;
          ctx.lineTo(px, py);
          rot += step;
        }
        ctx.lineTo(cx, cy - outerR);
        ctx.closePath();
        break;
      }
    }

    if (shape.fillColor && shape.fillColor !== 'transparent') {
      if (shape.fillStyle === 'hachure' || shape.fillStyle === 'cross-hatch') {
        const pattern = this.getHatchPattern(ctx, shape.fillColor, shape.fillStyle === 'cross-hatch');
        if (pattern) {
          ctx.fillStyle = pattern;
        }
      }
      ctx.fill();
    }
    ctx.stroke();
    ctx.restore();
  }

  public renderShapeOutline(
    ctx: CanvasRenderingContext2D,
    shape: ShapeObject,
    padding = 0
  ) {
    const { x: ox, y: oy, width: ow, height: oh, shapeType } = shape;
    const x = ox - padding;
    const y = oy - padding;
    const width = ow + padding * 2;
    const height = oh + padding * 2;

    ctx.beginPath();
    switch (shapeType) {
      case 'rectangle':
        ctx.rect(x, y, width, height);
        break;
      case 'polygon':
        ctx.moveTo(x + width / 2, y);
        ctx.lineTo(x + width, y + height / 2);
        ctx.lineTo(x + width / 2, y + height);
        ctx.lineTo(x, y + height / 2);
        ctx.closePath();
        break;
      case 'rounded_rect': {
        const radius = Math.min(16, width / 4, height / 4);
        if (ctx.roundRect) ctx.roundRect(x, y, width, height, radius);
        else ctx.rect(x, y, width, height);
        break;
      }
      case 'ellipse':
        ctx.ellipse(x + width / 2, y + height / 2, Math.abs(width / 2), Math.abs(height / 2), 0, 0, Math.PI * 2);
        break;
      case 'line':
      case 'arrow':
      case 'connector': {
        const sx = shape.startPoint?.x ?? ox;
        const sy = shape.startPoint?.y ?? oy;
        const ex = shape.endPoint?.x ?? ox + ow;
        const ey = shape.endPoint?.y ?? oy + oh;
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        break;
      }
      case 'triangle':
        ctx.moveTo(x + width / 2, y);
        ctx.lineTo(x + width, y + height);
        ctx.lineTo(x, y + height);
        ctx.closePath();
        break;
      case 'star': {
        const cx = x + width / 2;
        const cy = y + height / 2;
        const outerR = Math.min(width, height) / 2;
        const innerR = outerR * 0.45;
        const spikes = 5;
        let rot = (Math.PI / 2) * 3;
        const step = Math.PI / spikes;
        ctx.moveTo(cx, cy - outerR);
        for (let i = 0; i < spikes; i++) {
          ctx.lineTo(cx + Math.cos(rot) * outerR, cy + Math.sin(rot) * outerR);
          rot += step;
          ctx.lineTo(cx + Math.cos(rot) * innerR, cy + Math.sin(rot) * innerR);
          rot += step;
        }
        ctx.closePath();
        break;
      }
    }
    ctx.stroke();
  }

  public renderText(ctx: CanvasRenderingContext2D, textObj: TextObject) {
    ctx.save();
    if (textObj.opacity !== undefined) {
      ctx.globalAlpha = textObj.opacity;
    }
    ctx.fillStyle = textObj.color;
    const fontStyle = textObj.italic ? 'italic ' : '';
    const fontWeight = textObj.bold ? '600 ' : '400 ';
    ctx.font = `${fontStyle}${fontWeight}${textObj.fontSize}px ${textObj.fontFamily || 'Inter, sans-serif'}`;
    ctx.textBaseline = 'top';

    const boxWidth = textObj.width || 240;
    const boxHeight = textObj.height || 48;
    const maxContentWidth = Math.max(30, boxWidth - 12);
    const lines = wrapTextLines(
      textObj.text || '',
      maxContentWidth,
      textObj.fontSize,
      textObj.fontFamily || 'Inter, sans-serif',
      textObj.bold ?? false,
      textObj.italic ?? false
    );
    const lineHeight = textObj.fontSize * 1.35;
    const align = textObj.align || 'left';
    ctx.textAlign = align;

    // If text is empty (just placed on canvas), draw a clean subtle placeholder box so user can see it & drag it
    if (!textObj.text || textObj.text.trim() === '') {
      ctx.save();
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.45)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(textObj.x, textObj.y, boxWidth, boxHeight);
      ctx.fillStyle = 'rgba(156, 163, 175, 0.65)';
      ctx.fillText('Type text...', textObj.x + 8, textObj.y + 8);
      ctx.restore();
      ctx.restore();
      return;
    }

    lines.forEach((line, index) => {
      let lineX = textObj.x + 4;
      if (align === 'center') lineX = textObj.x + boxWidth / 2;
      else if (align === 'right') lineX = textObj.x + boxWidth - 4;
      ctx.fillText(line, lineX, textObj.y + 4 + index * lineHeight);

      // Underline support
      if (textObj.underline && line) {
        const textMetrics = ctx.measureText(line);
        let startX = lineX;
        if (align === 'center') startX = lineX - textMetrics.width / 2;
        else if (align === 'right') startX = lineX - textMetrics.width;
        const underlineY = textObj.y + 4 + index * lineHeight + textObj.fontSize * 1.1;
        ctx.lineWidth = Math.max(1.2, textObj.fontSize / 16);
        ctx.strokeStyle = textObj.color;
        ctx.beginPath();
        ctx.moveTo(startX, underlineY);
        ctx.lineTo(startX + textMetrics.width, underlineY);
        ctx.stroke();
      }
    });

    ctx.restore();
  }

  public renderStickyNote(ctx: CanvasRenderingContext2D, note: StickyNoteObject) {
    ctx.save();
    const { x, y, width, height, color, text } = note;
    if (note.opacity !== undefined) {
      ctx.globalAlpha = note.opacity;
    }

    // Soft modern drop shadow like Excalidraw
    ctx.shadowColor = 'rgba(0, 0, 0, 0.09)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;

    // Note Body with rounded corners (14px radius)
    ctx.fillStyle = color || '#fef08a';
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 14);
    ctx.fill();

    // Reset shadow
    ctx.shadowColor = 'transparent';

    // Date watermark in bottom-right corner (e.g. "12 Oct")
    const dateStr =
      note.dateLabel ||
      new Date(note.createdAt || Date.now()).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      });
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.font = '500 11px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(dateStr, x + width - 14, y + height - 12);

    // Text content with protective boundary clipping
    const textColor = note.textColor || '#1e1e1e';
    const fontSize = note.fontSize || 20;
    const fontFamily = note.fontFamily || 'Caveat, cursive, sans-serif';
    const textAlign = note.textAlign || 'center';
    const verticalAlign = note.verticalAlign || 'middle';

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x + 8, y + 8, Math.max(10, width - 16), Math.max(10, height - 16), 10);
    ctx.clip();

    ctx.fillStyle = textColor;
    ctx.font = `${fontSize}px ${fontFamily}`;

    // Gracefully word-wrap text to fit within sticky note width (width - 32)
    const maxContentWidth = Math.max(30, width - 32);
    const lines = wrapTextLines(text || '', maxContentWidth, fontSize, fontFamily);
    const lineHeight = fontSize * 1.35;
    const totalTextHeight = lines.length * lineHeight;

    let startY = y + 16;
    if (totalTextHeight > height - 32) {
      startY = y + 14;
    } else if (verticalAlign === 'middle') {
      startY = y + Math.max(16, (height - 24 - totalTextHeight) / 2);
    } else if (verticalAlign === 'bottom') {
      startY = y + Math.max(16, height - 28 - totalTextHeight);
    }

    ctx.textAlign = textAlign;
    ctx.textBaseline = 'top';

    lines.forEach((line, i) => {
      let lineX = x + 16;
      if (textAlign === 'center') {
        lineX = x + width / 2;
      } else if (textAlign === 'right') {
        lineX = x + width - 16;
      }
      ctx.fillText(line, lineX, startY + i * lineHeight);
    });

    ctx.restore(); // Restore clipping
    ctx.restore(); // Restore outer note save
  }

  public renderImage(ctx: CanvasRenderingContext2D, imgObj: ImageObject) {
    let img = this.imageCache.get(imgObj.src);
    if (!img) {
      img = new Image();
      img.src = imgObj.src;
      this.imageCache.set(imgObj.src, img);
      img.onload = () => {
        // Redraw will pick it up on next animation frame
      };
    }

    if (img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, imgObj.x, imgObj.y, imgObj.width, imgObj.height);
    } else {
      // Placeholder while loading
      ctx.save();
      ctx.fillStyle = '#f4f4f5';
      ctx.fillRect(imgObj.x, imgObj.y, imgObj.width, imgObj.height);
      ctx.strokeStyle = '#d4d4d8';
      ctx.strokeRect(imgObj.x, imgObj.y, imgObj.width, imgObj.height);
      ctx.restore();
    }
  }

  /**
   * Render Excalidraw-style Frame container
   */
  public renderFrame(
    ctx: CanvasRenderingContext2D,
    frame: FrameObject,
    _zoom: number,
    theme: 'light' | 'dark' | 'paper'
  ) {
    ctx.save();
    const { x, y, width, height, name } = frame;
    const isDark = theme === 'dark';

    // Container border
    const stroke = frame.strokeColor || (isDark ? '#3f3f46' : '#cbd5e1');
    ctx.strokeStyle = stroke;
    ctx.lineWidth = frame.strokeWidth || 1.5;
    if (frame.strokeStyle === 'dashed') {
      ctx.setLineDash([6, 4]);
    } else {
      ctx.setLineDash([]);
    }

    if (frame.fillColor && frame.fillColor !== 'transparent') {
      ctx.fillStyle = frame.fillColor;
    } else {
      ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.01)';
    }

    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, width, height, 10);
    } else {
      ctx.rect(x, y, width, height);
    }
    ctx.fill();
    ctx.stroke();

    // Frame Header Title (Inter font, subtle header badge above frame)
    ctx.setLineDash([]);
    const titleText = name || 'Frame';
    ctx.font = '500 12px Inter, system-ui, sans-serif';
    ctx.fillStyle = isDark ? '#a1a1aa' : '#64748b';
    ctx.fillText(titleText, x + 4, y - 8);

    ctx.restore();
  }

  /**
   * Render Web Embed Card on Canvas
   */
  public renderEmbedCard(
    ctx: CanvasRenderingContext2D,
    embed: EmbedObject,
    _zoom: number,
    theme: 'light' | 'dark' | 'paper'
  ) {
    ctx.save();
    const { x, y, width, height, url, title, embedType } = embed;
    const isDark = theme === 'dark';

    // Card shadow
    ctx.shadowColor = isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(15, 23, 42, 0.08)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;

    // Card background
    ctx.fillStyle = isDark ? '#18181b' : '#ffffff';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, width, height, 12);
    } else {
      ctx.rect(x, y, width, height);
    }
    ctx.fill();

    ctx.shadowColor = 'transparent';

    // Card border
    ctx.strokeStyle = isDark ? '#27272a' : '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Header bar
    const headerHeight = 36;
    ctx.fillStyle = isDark ? '#27272a' : '#f8fafc';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, width, headerHeight, [12, 12, 0, 0]);
    } else {
      ctx.rect(x, y, width, headerHeight);
    }
    ctx.fill();

    // Header bottom border
    ctx.strokeStyle = isDark ? '#3f3f46' : '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + headerHeight);
    ctx.lineTo(x + width, y + headerHeight);
    ctx.stroke();

    // Header icon & text
    ctx.fillStyle = embedType === 'youtube' ? '#ef4444' : isDark ? '#60a5fa' : '#2563eb';
    ctx.font = '600 12px Inter, sans-serif';
    const iconLabel = embedType === 'youtube' ? '▶ YouTube' : '🌐 Embed';
    ctx.fillText(iconLabel, x + 12, y + 22);

    ctx.fillStyle = isDark ? '#f4f4f5' : '#1e1e1e';
    ctx.font = '500 12px Inter, sans-serif';
    const displayTitle = title || url;
    const truncated = displayTitle.length > 38 ? displayTitle.substring(0, 35) + '...' : displayTitle;
    ctx.fillText(truncated, x + 88, y + 22);

    // Inner preview area
    const contentY = y + headerHeight;
    const contentH = height - headerHeight;
    ctx.fillStyle = isDark ? '#09090b' : '#f1f5f9';
    ctx.fillRect(x + 2, contentY, width - 4, contentH - 2);

    // Centered URL hint & preview description
    ctx.fillStyle = isDark ? '#71717a' : '#94a3b8';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Interactive Web Embed: ' + url, x + width / 2, y + headerHeight + contentH / 2);
    ctx.fillText('Double-click to open • Drag handles to resize', x + width / 2, y + headerHeight + contentH / 2 + 20);
    ctx.textAlign = 'left';

    ctx.restore();
  }

  /**
   * Fast Overlay Layer: Live In-Progress Stroke, Laser Pointer, Marquee, Handles
   */
  public renderOverlay(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    camera: CameraState,
    livePoints: StrokePoint[],
    liveStrokeConfig: StrokeObject | null,
    laserPoints: LaserTrailPoint[],
    selection: SelectionState,
    clickToInkState: string,
    cursorPos: { x: number; y: number } | null,
    activeTool?: string,
    eraserRadius?: number,
    liveShape?: { shape: ShapeObject; startPt: { x: number; y: number }; currentPt: { x: number; y: number } } | null,
    snapFlash?: { shape: ShapeObject; progress: number } | null
  ) {
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);

    // 1. Render Live Inking Stroke (<16ms latency)
    if (liveStrokeConfig && livePoints.length > 0) {
      this.renderStroke(
        ctx,
        {
          ...liveStrokeConfig,
          points: livePoints,
        },
        camera.zoom
      );
    }

    // 2. Render Laser Pointer Fading Trail with neon glow
    if (laserPoints.length > 0) {
      const now = performance.now();
      ctx.save();
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 10;

      if (laserPoints.length > 1) {
        for (let i = 0; i < laserPoints.length - 1; i++) {
          const p1 = laserPoints[i];
          const p2 = laserPoints[i + 1];
          const age = now - p1.time;
          if (age < 900) {
            const alpha = 1.0 - age / 900;
            ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
            ctx.lineWidth = Math.max(2.5, p1.size * alpha);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      // Bright laser tip dot at head point
      const head = laserPoints[laserPoints.length - 1];
      if (now - head.time < 900) {
        ctx.fillStyle = '#ff2222';
        ctx.beginPath();
        ctx.arc(head.x, head.y, 4 / camera.zoom, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // ============================================================================
    // LANDMARK: APPLE / EXCALIDRAW STYLE SELECTION BOUNDS & CIRCULAR HANDLES
    // ============================================================================
    if (selection.bounds && selection.selectedIds.length > 0) {
      const { x, y, width: bw, height: bh } = selection.bounds;
      ctx.save();
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 1.5 / camera.zoom;
      ctx.setLineDash([4 / camera.zoom, 3 / camera.zoom]);
      ctx.strokeRect(x, y, bw, bh);

      // 8 Apple-like circular transform handles with soft shadow
      ctx.setLineDash([]);
      const handleRadius = 4.5 / camera.zoom;
      const handles = [
        { x, y }, // nw
        { x: x + bw, y }, // ne
        { x, y: y + bh }, // sw
        { x: x + bw, y: y + bh }, // se
        { x: x + bw / 2, y }, // n
        { x: x + bw / 2, y: y + bh }, // s
        { x, y: y + bh / 2 }, // w
        { x: x + bw, y: y + bh / 2 }, // e
      ];

      for (const h of handles) {
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
        ctx.shadowBlur = 4 / camera.zoom;
        ctx.shadowOffsetY = 1 / camera.zoom;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(h.x, h.y, handleRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Crisp border ring
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = 1.5 / camera.zoom;
        ctx.beginPath();
        ctx.arc(h.x, h.y, handleRadius, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3b. Render Live Shape in Progress (Real-time figure feedback during drag)
    if (liveShape && liveShape.shape) {
      ctx.save();
      this.renderShape(ctx, liveShape.shape);

      // Subtle dashed bounding guide for 2D shapes
      const { shapeType, x: sx, y: sy, width: sw, height: sh } = liveShape.shape;
      if (shapeType !== 'line' && shapeType !== 'arrow' && shapeType !== 'connector') {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.2 / camera.zoom;
        ctx.setLineDash([4 / camera.zoom, 3 / camera.zoom]);
        ctx.strokeRect(sx, sy, sw, sh);
      }
      ctx.restore();
    }

    // 3c. Camera-Shutter Click Snap Pulse Animation
    if (snapFlash && snapFlash.progress < 1) {
      const p = snapFlash.progress;
      const alpha = Math.pow(1 - p, 1.8);
      const expand = (p * 12) / camera.zoom;

      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = Math.max(2, (snapFlash.shape.strokeWidth + 3) / camera.zoom);
      ctx.globalAlpha = alpha;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 16 / camera.zoom;
      this.renderShapeOutline(ctx, snapFlash.shape, expand);
      ctx.restore();
    }

    // 4. Render Lasso Marquee Path
    if (selection.mode === 'lasso' && selection.lassoPoints && selection.lassoPoints.length > 1) {
      ctx.save();
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 1.5 / camera.zoom;
      ctx.setLineDash([4 / camera.zoom, 4 / camera.zoom]);
      ctx.beginPath();
      ctx.moveTo(selection.lassoPoints[0].x, selection.lassoPoints[0].y);
      for (let i = 1; i < selection.lassoPoints.length; i++) {
        ctx.lineTo(selection.lassoPoints[i].x, selection.lassoPoints[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    // 5. Click-to-Ink Cursor / Ink-Dot Indicator in Screen Space
    if (cursorPos && (clickToInkState === 'armed' || clickToInkState === 'inking')) {
      ctx.save();
      ctx.beginPath();
      if (clickToInkState === 'armed') {
        // Armed (Pen Up): Hollow blue circle with dot in center
        ctx.arc(cursorPos.x, cursorPos.y, 8, 0, Math.PI * 2);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cursorPos.x, cursorPos.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#38bdf8';
        ctx.fill();
      } else if (clickToInkState === 'inking') {
        // Inking (Pen Down): Solid pulsating ring showing active stroke
        ctx.arc(cursorPos.x, cursorPos.y, 11, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cursorPos.x, cursorPos.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#0284c7';
        ctx.fill();
      }
      ctx.restore();
    }

    // 6. Eraser Indicator Ring in Screen Space
    if (cursorPos && activeTool === 'eraser') {
      const radius = Math.max(4, (eraserRadius || 20) * camera.zoom);
      ctx.save();
      ctx.beginPath();
      ctx.arc(cursorPos.x, cursorPos.y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.fillStyle = 'rgba(59, 130, 246, 0.12)';
      ctx.fill();
      ctx.restore();
    }

    // 7. Live Shape Dimension Pill Badge (Excalidraw / Figma style)
    if (liveShape && liveShape.shape) {
      const { shape, startPt, currentPt } = liveShape;
      const isLinear = shape.shapeType === 'line' || shape.shapeType === 'arrow' || shape.shapeType === 'connector';
      let badgeText = '';

      if (isLinear) {
        const dx = currentPt.x - startPt.x;
        const dy = currentPt.y - startPt.y;
        const length = Math.round(Math.hypot(dx, dy));
        let angleDeg = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
        if (angleDeg < 0) angleDeg += 360;
        badgeText = `${length} px  (${angleDeg}°)`;
      } else {
        const w = Math.round(shape.width);
        const h = Math.round(shape.height);
        badgeText = `${w} × ${h} px`;
      }

      // Convert current docPt to screen coordinates for ultra-crisp badge rendering
      const screenX = currentPt.x * camera.zoom + camera.x;
      const screenY = currentPt.y * camera.zoom + camera.y;

      ctx.save();
      ctx.font = '600 11px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const textMetrics = ctx.measureText(badgeText);
      const textW = textMetrics.width;
      const pillW = textW + 16;
      const pillH = 22;

      // Position badge slightly below-right of the pointer, clamping within canvas viewport
      let pillX = screenX + 14;
      let pillY = screenY + 14;
      if (pillX + pillW > width - 10) pillX = screenX - pillW - 14;
      if (pillY + pillH > height - 10) pillY = screenY - pillH - 14;

      // Draw shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;

      // Pill background
      ctx.fillStyle = 'rgba(24, 24, 27, 0.92)';
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(pillX, pillY, pillW, pillH, 6);
      } else {
        ctx.rect(pillX, pillY, pillW, pillH);
      }
      ctx.fill();

      // Pill border
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Pill text
      ctx.fillStyle = '#f4f4f5';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, pillX + pillW / 2, pillY + pillH / 2);
      ctx.restore();
    }
  }
}
