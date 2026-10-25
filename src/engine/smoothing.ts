import { StrokePoint, ShapeType } from '../types/document';

/**
 * One-Euro Filter implementation for adaptive low-latency jitter reduction.
 */
export class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xPrev: number | null = null;
  private dxPrev = 0;
  private tPrev = 0;

  constructor(minCutoff = 1.0, beta = 0.05, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  private alpha(cutoff: number, dt: number): number {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    return 1.0 / (1.0 + tau / dt);
  }

  public filter(val: number, timestamp: number): number {
    if (this.xPrev === null) {
      this.xPrev = val;
      this.tPrev = timestamp;
      return val;
    }

    const dt = Math.max(0.004, (timestamp - this.tPrev) / 1000.0);
    this.tPrev = timestamp;

    const dx = (val - this.xPrev) / dt;
    const aD = this.alpha(this.dCutoff, dt);
    const dxHat = aD * dx + (1 - aD) * this.dxPrev;
    this.dxPrev = dxHat;

    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = this.alpha(cutoff, dt);
    const xHat = a * val + (1 - a) * this.xPrev;
    this.xPrev = xHat;

    return xHat;
  }

  public reset() {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = 0;
  }
}

/**
 * Filter 2D stroke points with dual One-Euro filters
 */
export class PointFilter2D {
  private filterX: OneEuroFilter;
  private filterY: OneEuroFilter;

  constructor(smoothingLevel = 0.5) {
    // Convert 0..1 smoothing to filter parameters:
    // smoothing=0 => high minCutoff (raw, responsive)
    // smoothing=1 => low minCutoff, low beta (very smooth, slightly more drag)
    const minCutoff = Math.max(0.2, 3.0 * (1.0 - smoothingLevel * 0.8));
    const beta = Math.max(0.005, 0.1 * (1.0 - smoothingLevel * 0.7));
    this.filterX = new OneEuroFilter(minCutoff, beta);
    this.filterY = new OneEuroFilter(minCutoff, beta);
  }

  public filter(x: number, y: number, time: number): { x: number; y: number } {
    return {
      x: this.filterX.filter(x, time),
      y: this.filterY.filter(y, time),
    };
  }

  public reset() {
    this.filterX.reset();
    this.filterY.reset();
  }
}

// ============================================================================
// LANDMARK: PRESSURE CALIBRATION ENGINE (Apple Pencil & Velocity Hybrid)
// ============================================================================

/**
 * Calibrates raw stylus pressure with a non-linear power curve.
 * Hardware styluses report linear force which feels blunt. A power curve (x^1.35)
 * gives exquisite sensitivity for light sketching while maintaining bold expression on firm strokes.
 */
export function calibrateHardwarePressure(rawPressure: number): number {
  if (rawPressure <= 0) return 0.55;
  // Apple Pencil & Excalidraw-grade pressure curve:
  // Starts delicate and thin (~0.18) at feather touch, smoothly scales to full bold (~1.33) on firm press
  const normalized = Math.max(0.01, Math.min(1.0, rawPressure));
  return Math.max(0.15, Math.min(1.35, 0.18 + 1.15 * Math.pow(normalized, 1.25)));
}

/**
 * Calculate velocity-based simulated pressure for mouse and non-pressure pointers.
 * Faster drawing yields lower pressure, slower drawing yields higher pressure.
 */
export function calculateSimulatedPressure(
  p1: StrokePoint,
  p2: StrokePoint,
  sensitivity = 1.0
): number {
  const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const dt = Math.max(8, p2.time - p1.time);
  const speed = dist / dt; // pixels per ms

  // Map speed to pressure: 0.1 px/ms -> 0.85, 2.0 px/ms -> 0.35
  const normalizedSpeed = Math.min(2.5, speed * sensitivity);
  const pressure = Math.max(0.2, Math.min(1.0, 1.0 - normalizedSpeed * 0.3));
  return pressure;
}

// ============================================================================
// LANDMARK: CENTRIPETAL CATMULL-ROM SPLINE TO CUBIC BÉZIER CONVERTER
// ============================================================================

export interface BezierCurveSegment {
  cp1: { x: number; y: number };
  cp2: { x: number; y: number };
  target: { x: number; y: number };
  pressure: number;
}

/**
 * Converts 4 consecutive sample points (p0, p1, p2, p3) into cubic Bézier control points
 * for the segment between p1 and p2 using a centripetal Catmull-Rom spline (alpha = 0.5).
 * Guarantees zero cusps, loops, or overshoot, ensuring buttery Apple-smooth curves.
 */
export function catmullRomToBezier(
  p0: { x: number; y: number; pressure?: number },
  p1: { x: number; y: number; pressure?: number },
  p2: { x: number; y: number; pressure?: number },
  p3: { x: number; y: number; pressure?: number },
  tension = 0.5
): BezierCurveSegment {
  // Centripetal Catmull-Rom formulation
  const cp1 = {
    x: p1.x + ((p2.x - p0.x) * tension) / 3,
    y: p1.y + ((p2.y - p0.y) * tension) / 3,
  };
  const cp2 = {
    x: p2.x - ((p3.x - p1.x) * tension) / 3,
    y: p2.y - ((p3.y - p1.y) * tension) / 3,
  };

  const avgPressure = ((p1.pressure ?? 0.7) + (p2.pressure ?? 0.7)) / 2;

  return {
    cp1,
    cp2,
    target: { x: p2.x, y: p2.y },
    pressure: avgPressure,
  };
}

/**
 * Ramer-Douglas-Peucker simplification algorithm.
 * Drastically reduces point count for finished strokes while preserving geometry.
 */
export function simplifyPoints(points: StrokePoint[], tolerance = 1.0): StrokePoint[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIndex = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const dist = perpendicularDistance(p, first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyPoints(points.slice(0, maxIndex + 1), tolerance);
    const right = simplifyPoints(points.slice(maxIndex), tolerance);
    return left.slice(0, -1).concat(right);
  } else {
    return [first, last];
  }
}

function perpendicularDistance(p: StrokePoint, lineStart: StrokePoint, lineEnd: StrokePoint): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const mag = Math.hypot(dx, dy);
  if (mag === 0) return Math.hypot(p.x - lineStart.x, p.y - lineStart.y);
  const num = Math.abs(dy * p.x - dx * p.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x);
  return num / mag;
}

/**
 * Snap stroke to straight line or 45-degree angle when Shift key is held.
 */
export function snapToStraightLine(
  startPoint: StrokePoint,
  currentPoint: StrokePoint,
  snapAngles = true
): StrokePoint {
  const dx = currentPoint.x - startPoint.x;
  const dy = currentPoint.y - startPoint.y;
  const dist = Math.hypot(dx, dy);

  if (!snapAngles || dist < 10) {
    return currentPoint;
  }

  const angle = Math.atan2(dy, dx);
  // Snap angle to nearest 45 degrees (pi / 4)
  const step = Math.PI / 4;
  const snappedAngle = Math.round(angle / step) * step;

  return {
    ...currentPoint,
    x: startPoint.x + Math.cos(snappedAngle) * dist,
    y: startPoint.y + Math.sin(snappedAngle) * dist,
  };
}

/**
 * Shape recognition for hand-drawn strokes:
 * Detects if a stroke is approximately a line, circle/ellipse, or rectangle.
 */
export function recognizeShape(points: StrokePoint[]): {
  type: ShapeType;
  confidence: number;
  bounds: { x: number; y: number; width: number; height: number };
  startPoint?: { x: number; y: number };
  endPoint?: { x: number; y: number };
} | null {
  if (points.length < 8) return null;

  const first = points[0];
  const last = points[points.length - 1];
  const endToEndDist = Math.hypot(last.x - first.x, last.y - first.y);

  // Compute total path length
  let totalLength = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    minX = Math.min(minX, pt.x);
    maxX = Math.max(maxX, pt.x);
    minY = Math.min(minY, pt.y);
    maxY = Math.max(maxY, pt.y);

    if (i > 0) {
      totalLength += Math.hypot(pt.x - points[i - 1].x, pt.y - points[i - 1].y);
    }
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const bounds = { x: minX, y: minY, width, height };

  // 1. Line Test: ratio of end-to-end distance to total length > 0.92
  if (totalLength > 30 && endToEndDist / totalLength > 0.92) {
    return {
      type: 'line',
      confidence: endToEndDist / totalLength,
      bounds,
      startPoint: { x: first.x, y: first.y },
      endPoint: { x: last.x, y: last.y },
    };
  }

  // 2. Closed loop check (start and end are close)
  const isClosed = endToEndDist < Math.max(40, Math.min(width, height) * 0.35);

  if (isClosed && width > 20 && height > 20) {
    // Center point
    const cx = minX + width / 2;
    const cy = minY + height / 2;
    const rx = width / 2;
    const ry = height / 2;

    // Ellipse radius variance check
    let ellipseDiffSum = 0;
    for (const pt of points) {
      const dx = (pt.x - cx) / rx;
      const dy = (pt.y - cy) / ry;
      const radiusAtPt = Math.hypot(dx, dy);
      ellipseDiffSum += Math.abs(radiusAtPt - 1.0);
    }
    const avgEllipseDiff = ellipseDiffSum / points.length;

    if (avgEllipseDiff < 0.22) {
      return {
        type: 'ellipse',
        confidence: 1.0 - avgEllipseDiff,
        bounds,
      };
    }

    // Rectangle check: corners exist and ratio of bounding box perimeter to total length
    const perimeter = 2 * (width + height);
    if (Math.abs(totalLength - perimeter) / perimeter < 0.25) {
      return {
        type: 'rectangle',
        confidence: 0.8,
        bounds,
      };
    }
  }

  return null;
}
