// Infinity Pen - One-Click Screen Inking Engine (Manifest V3 Content Script)
(() => {
  if (window.__INFINITY_PEN_INITIALIZED__) {
    window.__INFINITY_PEN_TOGGLE__();
    return;
  }
  window.__INFINITY_PEN_INITIALIZED__ = true;

  let isVisible = false;
  let rootEl = null;
  let canvas = null;
  let ctx = null;

  // Inking State
  let activeTool = 'pen'; // 'pen' | 'highlighter' | 'eraser' | 'shape'
  let activeShape = 'arrow'; // 'rectangle' | 'ellipse' | 'arrow' | 'line'
  let activeColor = '#2563eb';
  let activeSize = 3;
  let isDrawing = false;
  let livePoints = [];
  let strokes = [];
  let redoStack = [];

  // Shape drag
  let shapeStart = null;

  // Catmull-Rom to Cubic Bezier
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

  function initOverlay() {
    rootEl = document.createElement('div');
    rootEl.id = 'infinity-pen-root';

    canvas = document.createElement('canvas');
    canvas.id = 'infinity-pen-canvas';
    rootEl.appendChild(canvas);

    // Toolbar HTML
    const toolbar = document.createElement('div');
    toolbar.id = 'infinity-pen-toolbar';
    toolbar.innerHTML = `
      <div class="ip-drag-handle" title="Drag to reposition toolbar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>
      </div>

      <div class="ip-btn-group">
        <button class="ip-btn active" data-tool="pen" title="Pen (Pressure Sensitive)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>
        </button>
        <button class="ip-btn" data-tool="highlighter" title="Highlighter">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2l4 4-10 10H4v-4L14 2z"/><path d="M10 6l4 4"/></svg>
        </button>
        <button class="ip-btn" data-tool="eraser" title="Eraser">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 20H7L3 16c-1-1-1-2.5 0-3.5l10-10c1-1 2.5-1 3.5 0l4 4c1 1 1 2.5 0 3.5L13 17"/></svg>
        </button>
        <button class="ip-btn" data-tool="shape" title="Shapes (Arrow / Rectangle / Ellipse)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </button>
      </div>

      <div class="ip-divider"></div>

      <!-- Colors -->
      <div class="ip-btn-group">
        <div class="ip-color-swatch active" data-color="#2563eb" style="background: #2563eb;" title="Blue"></div>
        <div class="ip-color-swatch" data-color="#dc2626" style="background: #dc2626;" title="Red"></div>
        <div class="ip-color-swatch" data-color="#16a34a" style="background: #16a34a;" title="Green"></div>
        <div class="ip-color-swatch" data-color="#eab308" style="background: #eab308;" title="Yellow"></div>
        <div class="ip-color-swatch" data-color="#9333ea" style="background: #9333ea;" title="Purple"></div>
        <div class="ip-color-swatch" data-color="#0f172a" style="background: #0f172a;" title="Black"></div>
        <div class="ip-color-swatch" data-color="#ffffff" style="background: #ffffff; border-color: #cbd5e1;" title="White"></div>
      </div>

      <div class="ip-divider"></div>

      <!-- Width -->
      <div class="ip-btn-group">
        <button class="ip-btn" id="ip-size-btn" title="Stroke Thickness: 3px">
          <span style="font-size: 11px; font-weight: 700;">3px</span>
        </button>
      </div>

      <div class="ip-divider"></div>

      <!-- Undo / Redo / Clear / Export / Close -->
      <div class="ip-btn-group">
        <button class="ip-btn" id="ip-undo" title="Undo (Ctrl+Z)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
        </button>
        <button class="ip-btn" id="ip-clear" title="Clear Canvas">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
        <button class="ip-btn" id="ip-download" title="Save Annotation Image">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        </button>
        <button class="ip-btn ip-close-btn" id="ip-close" title="Hide (Esc / Alt+P)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="ip-hint">Press hard with tablet stylus for bolder ink • Esc to hide</div>
    `;

    rootEl.appendChild(toolbar);
    document.body.appendChild(rootEl);

    // Setup canvas context
    ctx = canvas.getContext('2d', { desynchronized: true });
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    setupEvents(toolbar);
  }

  function resizeCanvas() {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);
    redraw();
  }

  function redraw() {
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    // Draw saved strokes
    for (const s of strokes) {
      renderStroke(ctx, s);
    }
  }

  function renderStroke(c, stroke) {
    if (!stroke.points || stroke.points.length === 0) return;
    c.save();

    if (stroke.tool === 'highlighter') {
      c.globalAlpha = 0.35;
      c.strokeStyle = stroke.color;
      c.fillStyle = stroke.color;
      c.lineCap = 'square';
      c.lineJoin = 'bevel';
      c.lineWidth = stroke.size * 5;
    } else {
      c.globalAlpha = 1.0;
      c.strokeStyle = stroke.color;
      c.fillStyle = stroke.color;
      c.lineCap = 'round';
      c.lineJoin = 'round';
    }

    if (stroke.tool === 'shape') {
      renderShape(c, stroke);
      c.restore();
      return;
    }

    const pts = stroke.points;
    if (pts.length === 1) {
      c.beginPath();
      c.arc(pts[0].x, pts[0].y, stroke.size / 2, 0, Math.PI * 2);
      c.fill();
      c.restore();
      return;
    }

    if (stroke.tool === 'highlighter') {
      c.beginPath();
      c.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        c.lineTo(pts[i].x, pts[i].y);
      }
      c.stroke();
      c.restore();
      return;
    }

    // Tablet Pressure-Sensitive Catmull-Rom Bézier spline
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = i > 0 ? pts[i - 1] : pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = i + 2 < pts.length ? pts[i + 2] : p2;

      const p1P = calibratePressure(p1.pressure);
      const p2P = calibratePressure(p2.pressure);
      const avgP = (p1P + p2P) / 2;

      // Dynamic boldness: light touch = thin (40%), hard press = bold (up to 200%)
      const widthMult = 0.35 + 1.65 * avgP;
      c.lineWidth = Math.max(0.75, stroke.size * widthMult);

      c.beginPath();
      c.moveTo(p1.x, p1.y);
      const seg = catmullRomToBezier(p0, p1, p2, p3);
      c.bezierCurveTo(seg.cp1.x, seg.cp1.y, seg.cp2.x, seg.cp2.y, seg.target.x, seg.target.y);
      c.stroke();
    }

    c.restore();
  }

  function renderShape(c, s) {
    const { start, end, shapeType, color, size } = s;
    c.strokeStyle = color;
    c.lineWidth = size;
    c.fillStyle = 'transparent';

    if (shapeType === 'arrow') {
      c.beginPath();
      c.moveTo(start.x, start.y);
      c.lineTo(end.x, end.y);
      c.stroke();

      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const headLen = Math.max(12, size * 3.5);
      c.beginPath();
      c.moveTo(end.x, end.y);
      c.lineTo(end.x - headLen * Math.cos(angle - Math.PI / 6), end.y - headLen * Math.sin(angle - Math.PI / 6));
      c.moveTo(end.x, end.y);
      c.lineTo(end.x - headLen * Math.cos(angle + Math.PI / 6), end.y - headLen * Math.sin(angle + Math.PI / 6));
      c.stroke();
    } else if (shapeType === 'rectangle') {
      const x = Math.min(start.x, end.x);
      const y = Math.min(start.y, end.y);
      const w = Math.abs(end.x - start.x);
      const h = Math.abs(end.y - start.y);
      c.strokeRect(x, y, w, h);
    } else if (shapeType === 'ellipse') {
      const cx = (start.x + end.x) / 2;
      const cy = (start.y + end.y) / 2;
      const rx = Math.abs(end.x - start.x) / 2;
      const ry = Math.abs(end.y - start.y) / 2;
      c.beginPath();
      c.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
      c.stroke();
    } else if (shapeType === 'line') {
      c.beginPath();
      c.moveTo(start.x, start.y);
      c.lineTo(end.x, end.y);
      c.stroke();
    }
  }

  function setupEvents(toolbar) {
    // Canvas pointer events (with full hardware stylus pressure & coalescing)
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      isDrawing = true;
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}

      const isStylus = e.pointerType === 'pen' || (e.pressure > 0 && e.pressure !== 0.5);
      const pressure = isStylus ? e.pressure : 0.5;

      if (activeTool === 'eraser') {
        eraseAt(e.clientX, e.clientY);
        return;
      }

      if (activeTool === 'shape') {
        shapeStart = { x: e.clientX, y: e.clientY };
        return;
      }

      livePoints = [{ x: e.clientX, y: e.clientY, pressure, time: performance.now() }];
    });

    canvas.addEventListener('pointermove', (e) => {
      if (!isDrawing) return;

      if (activeTool === 'eraser') {
        eraseAt(e.clientX, e.clientY);
        return;
      }

      if (activeTool === 'shape' && shapeStart) {
        redraw();
        renderShape(ctx, {
          start: shapeStart,
          end: { x: e.clientX, y: e.clientY },
          shapeType: activeShape,
          color: activeColor,
          size: activeSize,
        });
        return;
      }

      const events = (typeof e.getCoalescedEvents === 'function') ? e.getCoalescedEvents() : [e];
      for (const ev of events) {
        const isStylus = ev.pointerType === 'pen' || (ev.pressure > 0 && ev.pressure !== 0.5);
        const pressure = isStylus ? ev.pressure : 0.5;
        livePoints.push({ x: ev.clientX, y: ev.clientY, pressure, time: performance.now() });
      }

      // Live incremental render
      redraw();
      renderStroke(ctx, {
        points: livePoints,
        color: activeColor,
        size: activeSize,
        tool: activeTool,
      });
    });

    const onPointerUp = (e) => {
      if (!isDrawing) return;
      isDrawing = false;
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}

      if (activeTool === 'eraser') return;

      if (activeTool === 'shape' && shapeStart) {
        strokes.push({
          tool: 'shape',
          shapeType: activeShape,
          start: shapeStart,
          end: { x: e.clientX, y: e.clientY },
          color: activeColor,
          size: activeSize,
        });
        shapeStart = null;
        redoStack = [];
        redraw();
        return;
      }

      if (livePoints.length > 0) {
        strokes.push({
          tool: activeTool,
          points: [...livePoints],
          color: activeColor,
          size: activeSize,
        });
        livePoints = [];
        redoStack = [];
        redraw();
      }
    };

    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    // Eraser helper
    function eraseAt(x, y) {
      const radius = activeSize * 4 + 16;
      const initialCount = strokes.length;
      strokes = strokes.filter((s) => {
        if (s.tool === 'shape') {
          const d = Math.hypot(s.start.x - x, s.start.y - y);
          const d2 = Math.hypot(s.end.x - x, s.end.y - y);
          return d > radius && d2 > radius;
        }
        for (const pt of s.points) {
          if (Math.hypot(pt.x - x, pt.y - y) <= radius) {
            return false;
          }
        }
        return true;
      });
      if (strokes.length !== initialCount) {
        redraw();
      }
    }

    // Toolbar Tool Selection
    toolbar.querySelectorAll('[data-tool]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toolbar.querySelectorAll('[data-tool]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        activeTool = btn.dataset.tool;

        // Toggle shapes popup if clicking shape
        if (activeTool === 'shape') {
          const shapes = ['arrow', 'rectangle', 'ellipse', 'line'];
          const nextIdx = (shapes.indexOf(activeShape) + 1) % shapes.length;
          activeShape = shapes[nextIdx];
          btn.title = `Shape: ${activeShape.toUpperCase()} (Click to cycle)`;
        }
      });
    });

    // Color Swatches
    toolbar.querySelectorAll('[data-color]').forEach((swatch) => {
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        toolbar.querySelectorAll('[data-color]').forEach((s) => s.classList.remove('active'));
        swatch.classList.add('active');
        activeColor = swatch.dataset.color;
      });
    });

    // Size Switcher
    const sizeBtn = toolbar.querySelector('#ip-size-btn');
    const sizes = [2, 4, 8, 14];
    let curSizeIdx = 0;
    sizeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      curSizeIdx = (curSizeIdx + 1) % sizes.length;
      activeSize = sizes[curSizeIdx];
      sizeBtn.querySelector('span').textContent = `${activeSize}px`;
      sizeBtn.title = `Stroke Thickness: ${activeSize}px`;
    });

    // Undo
    toolbar.querySelector('#ip-undo').addEventListener('click', (e) => {
      e.stopPropagation();
      if (strokes.length > 0) {
        redoStack.push(strokes.pop());
        redraw();
      }
    });

    // Clear
    toolbar.querySelector('#ip-clear').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm('Clear all drawings on screen?')) {
        strokes = [];
        redoStack = [];
        redraw();
      }
    });

    // Download / Snapshot
    toolbar.querySelector('#ip-download').addEventListener('click', (e) => {
      e.stopPropagation();
      const link = document.createElement('a');
      link.download = `infinity-annotation-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    });

    // Close
    toolbar.querySelector('#ip-close').addEventListener('click', (e) => {
      e.stopPropagation();
      togglePen(false);
    });

    // Draggable Toolbar
    const handle = toolbar.querySelector('.ip-drag-handle');
    let isDraggingBar = false;
    let dragOffset = { x: 0, y: 0 };

    handle.addEventListener('pointerdown', (e) => {
      isDraggingBar = true;
      const rect = toolbar.getBoundingClientRect();
      dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      try { handle.setPointerCapture(e.pointerId); } catch (_) {}
    });

    window.addEventListener('pointermove', (e) => {
      if (!isDraggingBar) return;
      toolbar.style.left = `${e.clientX - dragOffset.x + toolbar.offsetWidth / 2}px`;
      toolbar.style.top = `${e.clientY - dragOffset.y}px`;
    });

    window.addEventListener('pointerup', () => {
      isDraggingBar = false;
    });

    // Keyboard shortcuts: Esc to hide, Ctrl+Z to undo
    window.addEventListener('keydown', (e) => {
      if (!isVisible) return;
      if (e.key === 'Escape') {
        togglePen(false);
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (strokes.length > 0) {
          redoStack.push(strokes.pop());
          redraw();
        }
      }
    });
  }

  function togglePen(forceState) {
    if (!rootEl) {
      initOverlay();
    }
    isVisible = typeof forceState === 'boolean' ? forceState : !isVisible;
    rootEl.style.display = isVisible ? 'block' : 'none';
    if (isVisible) {
      resizeCanvas();
    }
  }

  window.__INFINITY_PEN_TOGGLE__ = () => togglePen();

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'toggleInfinityPen') {
      togglePen();
    }
  });

  // Automatically activate when injected
  togglePen(true);
})();
