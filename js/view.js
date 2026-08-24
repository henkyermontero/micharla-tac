// view.js - zoom / pan transform over the fitted board rect, plus snapping.

import { fromPitchFrac, PITCHES } from './pitch.js';

export const view = { scale: 1, tx: 0, ty: 0 };

export const MIN_SCALE = 0.5;
export const MAX_SCALE = 6;

export function resetView() {
  view.scale = 1; view.tx = 0; view.ty = 0;
}

/** Apply the current zoom / pan to a fitted board rect. */
export function applyView(base) {
  const w = base.w * view.scale;
  const h = base.h * view.scale;
  return {
    x: base.x + (base.w - w) / 2 + view.tx,
    y: base.y + (base.h - h) / 2 + view.ty,
    w, h,
  };
}

/** Zoom keeping the board point under (px, py) pinned to the cursor. */
export function zoomAt(base, px, py, factor) {
  const before = applyView(base);
  const bx = (px - before.x) / before.w;
  const by = (py - before.y) / before.h;
  view.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, view.scale * factor));
  const after = applyView(base);
  view.tx += px - (after.x + bx * after.w);
  view.ty += py - (after.y + by * after.h);
}

export function panBy(dx, dy) {
  view.tx += dx;
  view.ty += dy;
}

/** Keep at least a third of the board on screen. */
export function clampPan(base, cw, ch) {
  const r = applyView(base);
  const margin = Math.min(r.w, r.h) * 0.33;
  const maxTx = cw - margin - (r.x - view.tx);
  const minTx = margin - (r.x - view.tx) - r.w;
  const maxTy = ch - margin - (r.y - view.ty);
  const minTy = margin - (r.y - view.ty) - r.h;
  view.tx = Math.max(minTx, Math.min(maxTx, view.tx));
  view.ty = Math.max(minTy, Math.min(maxTy, view.ty));
}

/* ---------------- snapping ---------------- */

// Landmarks as fractions of the pitch (fx along the length, fy across the width).
function landmarks(pitchKey) {
  const p = PITCHES[pitchKey] || PITCHES.full;
  const L = p.L, W = p.W;
  const xs = new Set([0, 0.5, 1, 1 / 3, 2 / 3]);
  const ys = new Set([0, 0.5, 1]);
  if (p.sport.startsWith('football')) {
    const pen = p.sport === 'football' ? 16.5 : p.sport === 'football9' ? 13 : 10;
    const spot = p.sport === 'football' ? 11 : p.sport === 'football9' ? 9 : 8;
    const penW = p.sport === 'football' ? 40.32 : p.sport === 'football9' ? 29 : 24;
    const goalW = p.sport === 'football' ? 18.32 : p.sport === 'football9' ? 14 : 12;
    xs.add(pen / L); xs.add(1 - pen / L);
    xs.add(spot / L); xs.add(1 - spot / L);
    ys.add((W / 2 - penW / 2) / W); ys.add((W / 2 + penW / 2) / W);
    ys.add((W / 2 - goalW / 2) / W); ys.add((W / 2 + goalW / 2) / W);
  }
  // half spaces and wings, the lines coaches actually talk about
  [0.2, 0.35, 0.65, 0.8].forEach((v) => ys.add(v));
  return { xs: [...xs], ys: [...ys] };
}

const cache = new Map();
function boardLandmarks(pitchKey) {
  if (cache.has(pitchKey)) return cache.get(pitchKey);
  const { xs, ys } = landmarks(pitchKey);
  const out = { x: new Set(), y: new Set() };
  for (const fx of xs) for (const fy of ys) {
    const [u, v] = fromPitchFrac(pitchKey, fx, fy);
    out.x.add(Math.round(u * 1e4) / 1e4);
    out.y.add(Math.round(v * 1e4) / 1e4);
  }
  const res = { x: [...out.x].filter((n) => n > -0.3 && n < 1.3), y: [...out.y].filter((n) => n > -0.3 && n < 1.3) };
  cache.set(pitchKey, res);
  return res;
}

/**
 * Snap a board point to pitch landmarks (and the grid when it is on).
 * Returns the snapped point plus the guide lines that were hit.
 */
export function snap(x, y, opts) {
  const { pitchKey, rect, enabled, grid } = opts;
  if (!enabled) return { x, y, guides: [] };
  const tolX = 7 / rect.w;
  const tolY = 7 / rect.h;
  const marks = boardLandmarks(pitchKey);
  const guides = [];
  let sx = x, sy = y;
  let bestX = tolX, bestY = tolY;
  for (const v of marks.x) {
    const d = Math.abs(x - v);
    if (d < bestX) { bestX = d; sx = v; }
  }
  for (const v of marks.y) {
    const d = Math.abs(y - v);
    if (d < bestY) { bestY = d; sy = v; }
  }
  if (grid) {
    const step = 1 / 20;
    const gx = Math.round(x / step) * step;
    const gy = Math.round(y / step) * step;
    if (Math.abs(x - gx) < bestX) { sx = gx; bestX = Math.abs(x - gx); }
    if (Math.abs(y - gy) < bestY) { sy = gy; bestY = Math.abs(y - gy); }
  }
  if (sx !== x) guides.push({ axis: 'x', v: sx });
  if (sy !== y) guides.push({ axis: 'y', v: sy });
  return { x: sx, y: sy, guides };
}
