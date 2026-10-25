import { StrokePoint, ShapeType, ShapeObject } from '../types/document';

interface RecognizedShapeResult {
  shapeType: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  startPoint?: { x: number; y: number };
  endPoint?: { x: number; y: number };
}

/**
 * Distance between two points
 */
function dist(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

/**
 * Total path length along a sequence of points
 */
function getPathLength(points: StrokePoint[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += dist(points[i - 1], points[i]);
  }
  return len;
}

/**
 * Perpendicular distance from a point to a line segment
 */
function perpendicularDistance(
  p: StrokePoint,
  lineStart: StrokePoint,
  lineEnd: StrokePoint
): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const lineLenSq = dx * dx + dy * dy;
  if (lineLenSq === 0) return dist(p, lineStart);

  const t = Math.max(0, Math.min(1, ((p.x - lineStart.x) * dx + (p.y - lineStart.y) * dy) / lineLenSq));
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

/**
 * Ramer-Douglas-Peucker curve simplification algorithm
 */
function rdpSimplify(points: StrokePoint[], epsilon: number): StrokePoint[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }

  if (maxDist > epsilon) {
    const recResults1 = rdpSimplify(points.slice(0, index + 1), epsilon);
    const recResults2 = rdpSimplify(points.slice(index), epsilon);
    return recResults1.slice(0, -1).concat(recResults2);
  } else {
    return [points[0], points[points.length - 1]];
  }
}

/**
 * Check if an end segment looks like an arrowhead (acute return stroke)
 */
function detectArrowHead(points: StrokePoint[]): { isArrow: boolean; mainEndPoint?: { x: number; y: number } } {
  if (points.length < 8) return { isArrow: false };

  // Check the last 30% of stroke
  const n = points.length;
  const endIdx = n - 1;
  const subIdx = Math.max(1, Math.floor(n * 0.7));

  // If direction reverses sharply near the end
  const vMain = { x: points[subIdx].x - points[0].x, y: points[subIdx].y - points[0].y };
  const vTip = { x: points[endIdx].x - points[subIdx].x, y: points[endIdx].y - points[subIdx].y };

  const dot = vMain.x * vTip.x + vMain.y * vTip.y;
  const mag1 = Math.hypot(vMain.x, vMain.y);
  const mag2 = Math.hypot(vTip.x, vTip.y);

  if (mag1 > 0 && mag2 > 0) {
    const cosAngle = dot / (mag1 * mag2);
    const tipRatio = mag2 / mag1;
    if (cosAngle < -0.5 && tipRatio > 0.08 && tipRatio < 0.5) {
      return { isArrow: true, mainEndPoint: { x: points[subIdx].x, y: points[subIdx].y } };
    }
  }

  return { isArrow: false };
}

type Pt = { x: number; y: number };

function resample(pts: Pt[], n: number): Pt[] {
  const total = getPathLength(pts as StrokePoint[]);
  if (total === 0) return pts;
  const step = total / (n - 1);
  const out: Pt[] = [pts[0]];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    let a = pts[i - 1];
    const b = pts[i];
    let d = dist(a, b);
    while (acc + d >= step && d > 0) {
      const t = (step - acc) / d;
      a = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      out.push(a);
      d = dist(a, b);
      acc = 0;
    }
    acc += d;
  }
  while (out.length < n) out.push(pts[pts.length - 1]);
  return out.slice(0, n);
}

function trimDwell(pts: Pt[], diag: number): Pt[] {
  const end = pts[pts.length - 1];
  let i = pts.length - 1;
  while (i > 0 && dist(pts[i], end) < diag * 0.02) i--;
  return pts.slice(0, Math.min(pts.length, i + 2));
}

function segDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return dist(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function rdp(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts;
  let maxD = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = segDist(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD <= eps) return [pts[0], pts[pts.length - 1]];
  const left = rdp(pts.slice(0, idx + 1), eps);
  const right = rdp(pts.slice(idx), eps);
  return left.slice(0, -1).concat(right);
}

// RDP for a closed ring: split at the point farthest from the start
function rdpClosed(pts: Pt[], eps: number): Pt[] {
  let k = 0, maxD = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = dist(pts[0], pts[i]);
    if (d > maxD) { maxD = d; k = i; }
  }
  const a = rdp(pts.slice(0, k + 1), eps);
  const b = rdp(pts.slice(k).concat([pts[0]]), eps);
  return a.slice(0, -1).concat(b.slice(0, -1)); // unique vertices
}

function turnAngle(prev: Pt, cur: Pt, next: Pt): number {
  const a1 = Math.atan2(cur.y - prev.y, cur.x - prev.x);
  const a2 = Math.atan2(next.y - cur.y, next.x - cur.x);
  let d = Math.abs(a2 - a1);
  if (d > Math.PI) d = 2 * Math.PI - d;
  return (d * 180) / Math.PI;
}

function getCorners(ring: Pt[], diag: number): Pt[] {
  let v = rdpClosed(ring, diag * 0.04);
  // merge vertices that are too close
  let changed = true;
  while (changed && v.length > 3) {
    changed = false;
    for (let i = 0; i < v.length; i++) {
      const j = (i + 1) % v.length;
      if (dist(v[i], v[j]) < diag * 0.08) {
        v = v.filter((_, k) => k !== j);
        changed = true;
        break;
      }
    }
  }
  // keep only sharp turns
  return v.filter((p, i) =>
    turnAngle(v[(i - 1 + v.length) % v.length], p, v[(i + 1) % v.length]) > 35
  );
}

function polyArea(p: Pt[]): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    s += p[i].x * p[j].y - p[j].x * p[i].y;
  }
  return Math.abs(s) / 2;
}

export function recognizeShapeFromStroke(points: StrokePoint[]): RecognizedShapeResult | null {
  if (points.length < 8) return null;

  // Raw bbox: never from smoothed or resampled points
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const diag = Math.hypot(width, height);
  if (diag < 20) return null;

  const trimmed = trimDwell(points, diag);   // remove the 550ms hold cluster
  const startPt = trimmed[0];
  const endPt = trimmed[trimmed.length - 1];
  const pathLen = getPathLength(trimmed as StrokePoint[]);
  const chord = dist(startPt, endPt);
  if (pathLen < diag * 0.5) return null;

  const box = (shapeType: ShapeType): RecognizedShapeResult =>
    ({ shapeType, x: minX, y: minY, width, height });
  const squareOf = (shapeType: ShapeType): RecognizedShapeResult => {
    const s = (width + height) / 2;
    return { shapeType, x: cx - s / 2, y: cy - s / 2, width: s, height: s };
  };

  const closed = chord < diag * 0.3 && chord / pathLen < 0.25;

  if (closed) {
    const ring = resample(trimmed, 64);
    const areaRatio = polyArea(ring) / (width * height);

    let sum = 0, maxDev = 0;
    for (const p of ring) {
      const r = Math.hypot((p.x - cx) / (width / 2), (p.y - cy) / (height / 2));
      const d = Math.abs(r - 1);
      sum += d; maxDev = Math.max(maxDev, d);
    }
    const avgDev = sum / ring.length;
    const ar = width / height;

    // b) corner-based shape detection
    const corners = getCorners(ring, diag);

    // a) Circle / Ellipse: a smooth closed curve with no sharp corners (corners <= 2)
    // A square has 4 sharp corners, so a square NEVER matches this.
    if (corners.length <= 2 && avgDev <= 0.16 && areaRatio >= 0.62 && areaRatio <= 0.88) {
      return (ar >= 0.80 && ar <= 1.25) ? squareOf('ellipse') : box('ellipse');
    }

    if (corners.length === 3) return box('triangle');

    if (corners.length === 4) {
      const mids = [{ x: cx, y: minY }, { x: maxX, y: cy }, { x: cx, y: maxY }, { x: minX, y: cy }];
      const isDiamond = mids.every(m => corners.some(c => dist(c, m) < diag * 0.18));
      if (isDiamond && areaRatio >= 0.38 && areaRatio <= 0.64) return box('polygon');
      if (areaRatio >= 0.70) {
        return (ar >= 0.82 && ar <= 1.22) ? squareOf('rectangle') : box('rectangle');
      }
    }

    if (corners.length >= 8 && corners.length <= 10) {
      const rs = corners.map(c => dist(c, { x: cx, y: cy }));
      const mean = rs.reduce((a, b) => a + b, 0) / rs.length;
      let flips = 0;
      for (let i = 0; i < rs.length; i++) {
        if ((rs[i] > mean) !== (rs[(i + 1) % rs.length] > mean)) flips++;
      }
      if (flips >= rs.length - 1) return box('star');
    }

    return null; // not sure: leave the ink as drawn (old code forced a rectangle here)
  }

  // ---- open strokes: arrow first, then line ----
  const arrow = detectArrowHead(points);
  if (arrow.isArrow) {
    const tip = arrow.mainEndPoint || endPt;
    return {
      shapeType: 'arrow',
      x: Math.min(startPt.x, tip.x), y: Math.min(startPt.y, tip.y),
      width: Math.max(1, Math.abs(tip.x - startPt.x)),
      height: Math.max(1, Math.abs(tip.y - startPt.y)),
      startPoint: { x: startPt.x, y: startPt.y }, endPoint: { x: tip.x, y: tip.y },
    };
  }

  let maxPerp = 0;
  for (const p of trimmed) maxPerp = Math.max(maxPerp, segDist(p, startPt, endPt));
  if (chord / pathLen > 0.92 && maxPerp < chord * 0.05) {
    let a = { x: startPt.x, y: startPt.y }, b = { x: endPt.x, y: endPt.y };
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const snapped = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
    if (Math.abs(ang - snapped) < (6 * Math.PI) / 180) {   // angle-based, zoom-independent
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const hx = Math.cos(snapped) * chord / 2, hy = Math.sin(snapped) * chord / 2;
      a = { x: mx - hx, y: my - hy };
      b = { x: mx + hx, y: my + hy };
    }
    return {
      shapeType: 'line',
      x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
      width: Math.max(1, Math.abs(b.x - a.x)), height: Math.max(1, Math.abs(b.y - a.y)),
      startPoint: a, endPoint: b,
    };
  }
  return null;
}
