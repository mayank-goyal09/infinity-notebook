/**
 * Infinity Notebook Embed Library
 * Standalone embeddable whiteboard & screen-inking library.
 * Works on any website with zero external dependencies.
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.InfinityNotebookEmbed = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // Catmull-Rom to Cubic Bézier converter
  function catmullRomToBezier(p0, p1, p2, p3, tension = 0.5) {
    const cp1 = {
      x: p1.x + ((p2.x - p0.x) * tension) / 3,
      y: p1.y + ((p2.y - p0.y) * tension) / 3,
    };
    const cp2 = {
      x: p2.x - ((p3.x - p1.x) * tension) / 3,
      y: p2.y - ((p3.y - p1.y) * tension) / 3,
    };
    return { cp1, cp2, target: { x: p2.x, y: p2.y } };
  }

  function calibratePressure(p) {
    if (!p || p <= 0) return 0.5;
    return Math.max(0.05, Math.min(1.0, Math.pow(p, 1.25)));
  }

  class InfinityNotebookEmbed {
    constructor(options = {}) {
      this.options = Object.assign(
        {
          container: null,
          theme: 'light', // 'light' | 'dark' | 'paper'
          showToolbar: true,
          initialColor: '#2563eb',
          initialSize: 3,
          pressureSensitivity: true,
          onUpdate: null,
        },
        options
      );

      this.container = typeof this.options.container === 'string'
        ? document.querySelector(this.options.container)
        : this.options.container;

      if (!this.container) {
        throw new Error('[InfinityNotebookEmbed] Invalid container specified.');
      }

      this.activeTool = 'pen'; // 'pen' | 'highlighter' | 'eraser' | 'shape'
      this.activeShape = 'arrow'; // 'arrow' | 'rectangle' | 'ellipse' | 'line'
      this.activeColor = this.options.initialColor;
      this.activeSize = this.options.initialSize;
      this.isDrawing = false;
      this.livePoints = [];
      this.strokes = [];
      this.redoStack = [];
      this.shapeStart = null;

      this.initDOM();
      this.initEvents();
    }

    initDOM() {
      this.container.classList.add('ine-container');
      if (this.options.theme === 'dark') this.container.classList.add('dark');
      else if (this.options.theme === 'paper') this.container.classList.add('paper');

      this.wrapper = document.createElement('div');
      this.wrapper.className = 'ine-canvas-wrapper';

      this.canvas = document.createElement('canvas');
      this.canvas.className = 'ine-canvas';
      this.wrapper.appendChild(this.canvas);
      this.container.appendChild(this.wrapper);

      this.ctx = this.canvas.getContext('2d', { desynchronized: true });

      if (this.options.showToolbar) {
        this.renderToolbar();
      }

      this.resize();
      window.addEventListener('resize', () => this.resize());
    }

    renderToolbar() {
      this.toolbar = document.createElement('div');
      this.toolbar.className = 'ine-toolbar';
      this.toolbar.innerHTML = `
        <div class="ine-btn-group">
          <button class="ine-btn active" data-tool="pen" title="Pen (Tablet Pressure)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>
          </button>
          <button class="ine-btn" data-tool="highlighter" title="Highlighter">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2l4 4-10 10H4v-4L14 2z"/><path d="M10 6l4 4"/></svg>
          </button>
          <button class="ine-btn" data-tool="eraser" title="Eraser">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 20H7L3 16c-1-1-1-2.5 0-3.5l10-10c1-1 2.5-1 3.5 0l4 4c1 1 1 2.5 0 3.5L13 17"/></svg>
          </button>
          <button class="ine-btn" data-tool="shape" title="Shapes (Arrow/Rect/Circle)">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
        </div>

        <div class="ine-divider"></div>

        <div class="ine-btn-group">
          <div class="ine-swatch active" data-color="#2563eb" style="background:#2563eb;"></div>
          <div class="ine-swatch" data-color="#dc2626" style="background:#dc2626;"></div>
          <div class="ine-swatch" data-color="#16a34a" style="background:#16a34a;"></div>
          <div class="ine-swatch" data-color="#eab308" style="background:#eab308;"></div>
          <div class="ine-swatch" data-color="#9333ea" style="background:#9333ea;"></div>
          <div class="ine-swatch" data-color="#0f172a" style="background:#0f172a;"></div>
        </div>

        <div class="ine-divider"></div>

        <div class="ine-btn-group">
          <button class="ine-btn" id="ine-undo" title="Undo">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
          </button>
          <button class="ine-btn" id="ine-clear" title="Clear">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
          </button>
          <button class="ine-btn" id="ine-export" title="Export PNG">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
        </div>
      `;
      this.container.appendChild(this.toolbar);
    }

    resize() {
      const rect = this.wrapper.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      this.ctx.scale(dpr, dpr);
      this.redraw();
    }

    redraw() {
      const rect = this.wrapper.getBoundingClientRect();
      this.ctx.clearRect(0, 0, rect.width, rect.height);
      for (const s of this.strokes) {
        this.renderStroke(s);
      }
    }

    renderStroke(s) {
      if (!s.points && !s.shapeType) return;
      this.ctx.save();

      if (s.tool === 'highlighter') {
        this.ctx.globalAlpha = 0.35;
        this.ctx.strokeStyle = s.color;
        this.ctx.fillStyle = s.color;
        this.ctx.lineWidth = s.size * 5;
        this.ctx.lineCap = 'square';
      } else {
        this.ctx.globalAlpha = 1.0;
        this.ctx.strokeStyle = s.color;
        this.ctx.fillStyle = s.color;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
      }

      if (s.tool === 'shape') {
        this.renderShape(s);
        this.ctx.restore();
        return;
      }

      const pts = s.points;
      if (pts.length === 1) {
        this.ctx.beginPath();
        this.ctx.arc(pts[0].x, pts[0].y, s.size / 2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
        return;
      }

      // Pressure-modulated Catmull-Rom spline
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = i > 0 ? pts[i - 1] : pts[i];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = i + 2 < pts.length ? pts[i + 2] : p2;

        const p1P = calibratePressure(p1.pressure);
        const p2P = calibratePressure(p2.pressure);
        const avgP = (p1P + p2P) / 2;
        const widthMult = this.options.pressureSensitivity ? 0.35 + 1.65 * avgP : 1.0;
        this.ctx.lineWidth = Math.max(0.75, s.size * widthMult);

        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        const seg = catmullRomToBezier(p0, p1, p2, p3);
        this.ctx.bezierCurveTo(seg.cp1.x, seg.cp1.y, seg.cp2.x, seg.cp2.y, seg.target.x, seg.target.y);
        this.ctx.stroke();
      }

      this.ctx.restore();
    }

    renderShape(s) {
      const { start, end, shapeType, color, size } = s;
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = size;

      if (shapeType === 'arrow') {
        this.ctx.beginPath();
        this.ctx.moveTo(start.x, start.y);
        this.ctx.lineTo(end.x, end.y);
        this.ctx.stroke();

        const angle = Math.atan2(end.y - start.y, end.x - start.x);
        const headLen = Math.max(12, size * 3.5);
        this.ctx.beginPath();
        this.ctx.moveTo(end.x, end.y);
        this.ctx.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 6), end.y - headLen * Math.sin(angle - Math.PI / 6));
        this.ctx.moveTo(end.x, end.y);
        this.ctx.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 6), end.y - headLen * Math.sin(angle + Math.PI / 6));
        this.ctx.stroke();
      } else if (shapeType === 'rectangle') {
        const x = Math.min(start.x, end.x);
        const y = Math.min(start.y, end.y);
        const w = Math.abs(end.x - start.x);
        const h = Math.abs(end.y - start.y);
        this.ctx.strokeRect(x, y, w, h);
      } else if (shapeType === 'ellipse') {
        const cx = (start.x + end.x) / 2;
        const cy = (start.y + end.y) / 2;
        const rx = Math.abs(end.x - start.x) / 2;
        const ry = Math.abs(end.y - start.y) / 2;
        this.ctx.beginPath();
        this.ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
        this.ctx.stroke();
      } else if (shapeType === 'line') {
        this.ctx.beginPath();
        this.ctx.moveTo(start.x, start.y);
        this.ctx.lineTo(end.x, end.y);
        this.ctx.stroke();
      }
    }

    initEvents() {
      const getPos = (e) => {
        const rect = this.wrapper.getBoundingClientRect();
        return {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          pressure: (e.pointerType === 'pen' || (e.pressure > 0 && e.pressure !== 0.5)) ? e.pressure : 0.5,
        };
      };

      this.canvas.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        this.isDrawing = true;
        try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}

        const pos = getPos(e);
        if (this.activeTool === 'eraser') {
          this.eraseAt(pos.x, pos.y);
          return;
        }

        if (this.activeTool === 'shape') {
          this.shapeStart = { x: pos.x, y: pos.y };
          return;
        }

        this.livePoints = [{ x: pos.x, y: pos.y, pressure: pos.pressure, time: performance.now() }];
      });

      this.canvas.addEventListener('pointermove', (e) => {
        if (!this.isDrawing) return;
        const pos = getPos(e);

        if (this.activeTool === 'eraser') {
          this.eraseAt(pos.x, pos.y);
          return;
        }

        if (this.activeTool === 'shape' && this.shapeStart) {
          this.redraw();
          this.renderShape({
            start: this.shapeStart,
            end: { x: pos.x, y: pos.y },
            shapeType: this.activeShape,
            color: this.activeColor,
            size: this.activeSize,
          });
          return;
        }

        const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [e];
        for (const ev of events) {
          const p = getPos(ev);
          this.livePoints.push({ x: p.x, y: p.y, pressure: p.pressure, time: performance.now() });
        }

        this.redraw();
        this.renderStroke({
          points: this.livePoints,
          color: this.activeColor,
          size: this.activeSize,
          tool: this.activeTool,
        });
      });

      const onUp = (e) => {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        try { this.canvas.releasePointerCapture(e.pointerId); } catch (_) {}

        if (this.activeTool === 'eraser') return;

        if (this.activeTool === 'shape' && this.shapeStart) {
          const pos = getPos(e);
          this.strokes.push({
            tool: 'shape',
            shapeType: this.activeShape,
            start: this.shapeStart,
            end: { x: pos.x, y: pos.y },
            color: this.activeColor,
            size: this.activeSize,
          });
          this.shapeStart = null;
          this.redoStack = [];
          this.redraw();
          this.triggerUpdate();
          return;
        }

        if (this.livePoints.length > 0) {
          this.strokes.push({
            tool: this.activeTool,
            points: [...this.livePoints],
            color: this.activeColor,
            size: this.activeSize,
          });
          this.livePoints = [];
          this.redoStack = [];
          this.redraw();
          this.triggerUpdate();
        }
      };

      this.canvas.addEventListener('pointerup', onUp);
      this.canvas.addEventListener('pointercancel', onUp);

      if (this.toolbar) {
        this.toolbar.querySelectorAll('[data-tool]').forEach((btn) => {
          btn.addEventListener('click', () => {
            this.toolbar.querySelectorAll('[data-tool]').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            this.activeTool = btn.dataset.tool;

            if (this.activeTool === 'shape') {
              const shapes = ['arrow', 'rectangle', 'ellipse', 'line'];
              const idx = (shapes.indexOf(this.activeShape) + 1) % shapes.length;
              this.activeShape = shapes[idx];
              btn.title = `Shape: ${this.activeShape.toUpperCase()}`;
            }
          });
        });

        this.toolbar.querySelectorAll('[data-color]').forEach((sw) => {
          sw.addEventListener('click', () => {
            this.toolbar.querySelectorAll('[data-color]').forEach((s) => s.classList.remove('active'));
            sw.classList.add('active');
            this.activeColor = sw.dataset.color;
          });
        });

        this.toolbar.querySelector('#ine-undo')?.addEventListener('click', () => this.undo());
        this.toolbar.querySelector('#ine-clear')?.addEventListener('click', () => this.clear());
        this.toolbar.querySelector('#ine-export')?.addEventListener('click', () => this.exportPNG());
      }
    }

    eraseAt(x, y) {
      const radius = this.activeSize * 3 + 12;
      const prevLen = this.strokes.length;
      this.strokes = this.strokes.filter((s) => {
        if (s.tool === 'shape') {
          return Math.hypot(s.start.x - x, s.start.y - y) > radius && Math.hypot(s.end.x - x, s.end.y - y) > radius;
        }
        for (const pt of s.points) {
          if (Math.hypot(pt.x - x, pt.y - y) <= radius) return false;
        }
        return true;
      });
      if (this.strokes.length !== prevLen) {
        this.redraw();
        this.triggerUpdate();
      }
    }

    undo() {
      if (this.strokes.length > 0) {
        this.redoStack.push(this.strokes.pop());
        this.redraw();
        this.triggerUpdate();
      }
    }

    redo() {
      if (this.redoStack.length > 0) {
        this.strokes.push(this.redoStack.pop());
        this.redraw();
        this.triggerUpdate();
      }
    }

    clear() {
      this.strokes = [];
      this.redoStack = [];
      this.redraw();
      this.triggerUpdate();
    }

    exportPNG(filename = 'notebook-export.png') {
      const link = document.createElement('a');
      link.download = filename;
      link.href = this.canvas.toDataURL('image/png');
      link.click();
    }

    toJSON() {
      return JSON.stringify(this.strokes);
    }

    loadJSON(json) {
      try {
        this.strokes = typeof json === 'string' ? JSON.parse(json) : json;
        this.redraw();
        this.triggerUpdate();
      } catch (err) {
        console.error('[InfinityNotebookEmbed] Failed to load JSON data:', err);
      }
    }

    triggerUpdate() {
      if (typeof this.options.onUpdate === 'function') {
        this.options.onUpdate(this.strokes);
      }
    }

    // Static helper: Floating 1-Click Screen Inking Widget on any website
    static initScreenWidget(options = {}) {
      const trigger = document.createElement('button');
      trigger.className = 'ine-widget-trigger';
      trigger.title = 'Click to open inking pen (Alt+P)';
      trigger.innerHTML = `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="M12 19l7-7 3 3-7 7-3-3z"/>
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
        </svg>
      `;
      document.body.appendChild(trigger);

      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:2147483645;display:none;';
      document.body.appendChild(overlay);

      const instance = new InfinityNotebookEmbed({
        container: overlay,
        theme: options.theme || 'light',
        showToolbar: true,
      });

      // Add close button to overlay toolbar
      const closeBtn = document.createElement('button');
      closeBtn.className = 'ine-btn';
      closeBtn.style.color = '#ef4444';
      closeBtn.title = 'Close inking (Esc)';
      closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      instance.toolbar.querySelector('.ine-btn-group:last-child').appendChild(closeBtn);

      let open = false;
      function toggle() {
        open = !open;
        overlay.style.display = open ? 'block' : 'none';
        trigger.style.display = open ? 'none' : 'flex';
        if (open) instance.resize();
      }

      trigger.addEventListener('click', toggle);
      closeBtn.addEventListener('click', toggle);

      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && open) toggle();
        if (e.altKey && (e.key === 'p' || e.key === 'P')) toggle();
      });

      return instance;
    }
  }

  return InfinityNotebookEmbed;
});
