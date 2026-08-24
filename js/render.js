// render.js - everything that paints onto the canvas.

import { drawPitch, boxSize, THEMES, PITCHES } from './pitch.js';
import { state, KINDS } from './state.js';

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const lerp = (a, b, t) => a + (b - a) * t;

/* ---------- geometry helpers ---------- */

export function boardRect(cw, ch, pitchKey, pad) {
  if (pad == null) pad = Math.max(12, Math.min(cw, ch) * 0.045);
  const box = boxSize(pitchKey);
  const aspect = box.w / box.h;
  let w = cw - pad * 2;
  let h = w / aspect;
  if (h > ch - pad * 2) { h = ch - pad * 2; w = h * aspect; }
  return { x: Math.round((cw - w) / 2), y: Math.round((ch - h) / 2), w: Math.round(w), h: Math.round(h) };
}

export const toPx = (r, x, y) => [r.x + x * r.w, r.y + y * r.h];
export const toBoard = (r, px, py) => [(px - r.x) / r.w, (py - r.y) / r.h];

export function markerRadius(rect, kind = 'player') {
  // Constant physical size: a fixed share of the pitch length, whatever the orientation.
  const spec = PITCHES[state.doc.pitch] || PITCHES.full;
  const pxPerMeter = rect.w / boxSize(state.doc.pitch).w;
  const base = pxPerMeter * spec.L * 0.021;
  return base * state.markerScale * (KINDS[kind] ? KINDS[kind].r : 1);
}

/* ---------- interpolated positions ---------- */

export function positionsAt(doc, index, t) {
  const a = doc.frames[index];
  const b = doc.frames[index + 1];
  const out = {};
  const e = ease(Math.max(0, Math.min(1, t)));
  for (const o of doc.objects) {
    const pa = a && a.pos[o.id];
    const pb = b && b.pos[o.id];
    if (pa && pb && b) out[o.id] = { x: lerp(pa.x, pb.x, e), y: lerp(pa.y, pb.y, e) };
    else if (pa) out[o.id] = { x: pa.x, y: pa.y };
    else if (pb) out[o.id] = { x: pb.x, y: pb.y };
  }
  return out;
}

/* ---------- path drawing ---------- */

function pathPoints(rect, pts) {
  return pts.map(([x, y]) => toPx(rect, x, y));
}

function polyLength(p) {
  let L = 0;
  for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  return L;
}

// Trim a polyline to a fraction of its length (used for animated reveals).
function trim(p, frac) {
  if (frac >= 1) return p;
  const total = polyLength(p);
  const target = total * Math.max(0, frac);
  if (target <= 0) return [p[0]];
  const out = [p[0]];
  let run = 0;
  for (let i = 1; i < p.length; i++) {
    const seg = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
    if (run + seg >= target) {
      const k = (target - run) / (seg || 1);
      out.push([lerp(p[i - 1][0], p[i][0], k), lerp(p[i - 1][1], p[i][1], k)]);
      return out;
    }
    run += seg;
    out.push(p[i]);
  }
  return out;
}

function smooth(ctx, p) {
  ctx.beginPath();
  if (p.length < 3) {
    ctx.moveTo(p[0][0], p[0][1]);
    ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
    return;
  }
  ctx.moveTo(p[0][0], p[0][1]);
  for (let i = 1; i < p.length - 1; i++) {
    const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2;
    ctx.quadraticCurveTo(p[i][0], p[i][1], mx, my);
  }
  ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
}

function wavy(ctx, p, amp, wave) {
  // resample along the path and offset perpendicular with a sine wave
  const total = polyLength(p);
  const steps = Math.max(8, Math.round(total / 4));
  const out = [];
  let acc = 0, seg = 1;
  let prev = p[0];
  for (let i = 0; i <= steps; i++) {
    const target = (total * i) / steps;
    while (seg < p.length && acc + Math.hypot(p[seg][0] - prev[0], p[seg][1] - prev[1]) < target) {
      acc += Math.hypot(p[seg][0] - prev[0], p[seg][1] - prev[1]);
      prev = p[seg]; seg++;
    }
    const next = p[Math.min(seg, p.length - 1)];
    const segLen = Math.hypot(next[0] - prev[0], next[1] - prev[1]) || 1;
    const k = Math.min(1, (target - acc) / segLen);
    const x = lerp(prev[0], next[0], k), y = lerp(prev[1], next[1], k);
    const nx = -(next[1] - prev[1]) / segLen, ny = (next[0] - prev[0]) / segLen;
    const off = Math.sin((target / wave) * Math.PI * 2) * amp;
    out.push([x + nx * off, y + ny * off]);
  }
  smooth(ctx, out);
}

function arrowHead(ctx, p, size, style = 'v') {
  let i = p.length - 1, j = i - 1;
  while (j > 0 && Math.hypot(p[i][0] - p[j][0], p[i][1] - p[j][1]) < 2) j--;
  const a = Math.atan2(p[i][1] - p[j][1], p[i][0] - p[j][0]);
  const [x, y] = p[i];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.beginPath();
  if (style === 't') {
    ctx.moveTo(0, -size); ctx.lineTo(0, size);
    ctx.lineWidth = Math.max(2, size * 0.5);
    ctx.stroke();
  } else {
    ctx.moveTo(0, 0);
    ctx.lineTo(-size * 1.7, -size * 0.85);
    ctx.lineTo(-size * 1.25, 0);
    ctx.lineTo(-size * 1.7, size * 0.85);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function drawShape(ctx, rect, s, opts = {}) {
  const reveal = opts.reveal == null ? 1 : opts.reveal;
  const alpha = opts.alpha == null ? 1 : opts.alpha;
  if (alpha <= 0.01 || reveal <= 0) return;
  const lw = Math.max(1.4, (s.width || 0.55) * rect.w * 0.01);
  const color = s.color || '#ffdd57';
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = lw * 1.2;

  if (s.type === 'zone' || s.type === 'ellipse') {
    const [a, b] = [toPx(rect, s.pts[0][0], s.pts[0][1]), toPx(rect, s.pts[1][0], s.pts[1][1])];
    ctx.beginPath();
    if (s.type === 'zone') ctx.rect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
    else ctx.ellipse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) / 2, Math.abs(b[1] - a[1]) / 2, 0, 0, Math.PI * 2);
    ctx.globalAlpha = alpha * 0.18;
    ctx.fill();
    ctx.globalAlpha = alpha;
    if (s.dash) ctx.setLineDash([lw * 3, lw * 2.2]);
    ctx.stroke();
    ctx.restore();
    return;
  }

  let p = pathPoints(rect, s.pts);
  if (p.length < 2) { ctx.restore(); return; }
  p = trim(p, reveal);
  if (p.length < 2) { ctx.restore(); return; }

  if (s.type === 'run') ctx.setLineDash([lw * 2.6, lw * 2.2]);
  if (s.type === 'shot') ctx.lineWidth = lw * 1.6;

  if (s.type === 'dribble') wavy(ctx, p, lw * 1.9, lw * 7);
  else smooth(ctx, p);
  ctx.stroke();
  ctx.setLineDash([]);

  if (s.type === 'pass' || s.type === 'run' || s.type === 'dribble' || s.type === 'shot') {
    arrowHead(ctx, p, lw * 2.2 * (s.type === 'shot' ? 1.25 : 1));
  } else if (s.type === 'block') {
    arrowHead(ctx, p, lw * 2.4, 't');
  }
  ctx.restore();
}

/* ---------- objects ---------- */

function ballGlyph(ctx, x, y, r) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.lineWidth = Math.max(1, r * 0.16); ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.stroke();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(x + Math.cos(a) * r * 0.42, y + Math.sin(a) * r * 0.42);
  }
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function coneGlyph(ctx, x, y, r, color) {
  ctx.save();
  ctx.fillStyle = color || '#ff8c1a';
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.15);
  ctx.lineTo(x + r, y + r * 0.85);
  ctx.lineTo(x - r, y + r * 0.85);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.fillRect(x - r * 1.15, y + r * 0.85, r * 2.3, r * 0.32);
  ctx.restore();
}

function mannequinGlyph(ctx, x, y, r, color) {
  ctx.save();
  ctx.fillStyle = color || '#c9d1d9';
  ctx.beginPath(); ctx.arc(x, y - r * 0.85, r * 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - r * 0.75, y + r * 1.1);
  ctx.lineTo(x - r * 0.35, y - r * 0.3);
  ctx.lineTo(x + r * 0.35, y - r * 0.3);
  ctx.lineTo(x + r * 0.75, y + r * 1.1);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function goalGlyph(ctx, x, y, r, color) {
  ctx.save();
  ctx.strokeStyle = color || '#ffffff';
  ctx.lineWidth = Math.max(2, r * 0.28);
  ctx.strokeRect(x - r * 1.5, y - r * 0.6, r * 3, r * 1.2);
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  for (let i = -3; i <= 3; i++) { ctx.moveTo(x + i * r * 0.5, y - r * 0.6); ctx.lineTo(x + i * r * 0.5, y + r * 0.6); }
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.stroke();
  ctx.restore();
}

function flagGlyph(ctx, x, y, r, color) {
  ctx.save();
  ctx.strokeStyle = '#e9ecef'; ctx.lineWidth = Math.max(1.5, r * 0.3);
  ctx.beginPath(); ctx.moveTo(x, y + r); ctx.lineTo(x, y - r * 1.4); ctx.stroke();
  ctx.fillStyle = color || '#ffd166';
  ctx.beginPath(); ctx.moveTo(x, y - r * 1.4); ctx.lineTo(x + r * 1.2, y - r * 0.95); ctx.lineTo(x, y - r * 0.5); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function ladderGlyph(ctx, x, y, r, color) {
  ctx.save();
  ctx.strokeStyle = color || '#ffd166'; ctx.lineWidth = Math.max(1.5, r * 0.18);
  ctx.strokeRect(x - r * 2, y - r * 0.7, r * 4, r * 1.4);
  for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x - r * 2 + (i * r * 4) / 4, y - r * 0.7); ctx.lineTo(x - r * 2 + (i * r * 4) / 4, y + r * 0.7); ctx.stroke(); }
  ctx.restore();
}

function hurdleGlyph(ctx, x, y, r, color) {
  ctx.save();
  ctx.strokeStyle = color || '#f4a261'; ctx.lineWidth = Math.max(1.5, r * 0.28);
  ctx.beginPath();
  ctx.moveTo(x - r, y + r * 0.7); ctx.lineTo(x - r, y - r * 0.6);
  ctx.lineTo(x + r, y - r * 0.6); ctx.lineTo(x + r, y + r * 0.7);
  ctx.stroke();
  ctx.restore();
}

export function drawObject(ctx, rect, o, p, opts = {}) {
  if (!p) return;
  const [x, y] = toPx(rect, p.x, p.y);
  const r = markerRadius(rect, o.kind);
  const doc = state.doc;
  const team = o.team ? doc.teams[o.team] : null;
  const color = o.color || (team ? team.color : '#ffd166');
  ctx.save();
  ctx.globalAlpha = opts.alpha == null ? 1 : opts.alpha;

  switch (o.kind) {
    case 'ball': ballGlyph(ctx, x, y, r); break;
    case 'cone': coneGlyph(ctx, x, y, r, o.color || '#ff8c1a'); break;
    case 'mannequin': mannequinGlyph(ctx, x, y, r, o.color || '#cbd5e1'); break;
    case 'minigoal': goalGlyph(ctx, x, y, r, o.color || '#ffffff'); break;
    case 'flag': flagGlyph(ctx, x, y, r, o.color || '#ffd166'); break;
    case 'ladder': ladderGlyph(ctx, x, y, r, o.color || '#ffd166'); break;
    case 'hurdle': hurdleGlyph(ctx, x, y, r, o.color || '#f4a261'); break;
    case 'label': {
      const size = r * 1.15;
      ctx.font = `600 ${size}px Inter, system-ui, sans-serif`;
      const text = o.name || 'Text';
      const w = ctx.measureText(text).width;
      ctx.fillStyle = 'rgba(8,12,18,.62)';
      roundRect(ctx, x - w / 2 - size * 0.45, y - size * 0.8, w + size * 0.9, size * 1.6, size * 0.35);
      ctx.fill();
      ctx.fillStyle = o.color || '#fff';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, x, y + size * 0.05);
      break;
    }
    default: {
      // player / keeper
      ctx.shadowColor = 'rgba(0,0,0,.45)';
      ctx.shadowBlur = r * 0.5;
      ctx.shadowOffsetY = r * 0.16;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.lineWidth = Math.max(1.2, r * 0.13);
      ctx.strokeStyle = o.kind === 'keeper' ? '#ffef9f' : 'rgba(255,255,255,.85)';
      ctx.stroke();
      if (state.showNumbers && o.num !== '' && o.num != null) {
        ctx.fillStyle = (team && team.ink) || '#fff';
        ctx.font = `700 ${r * 1.05}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(o.num), x, y + r * 0.06);
      }
      if (state.showNames && o.name) {
        const fs = Math.max(9, r * 0.82);
        ctx.font = `600 ${fs}px Inter, system-ui, sans-serif`;
        const w = ctx.measureText(o.name).width;
        ctx.fillStyle = 'rgba(8,12,18,.55)';
        roundRect(ctx, x - w / 2 - fs * 0.3, y + r * 1.12, w + fs * 0.6, fs * 1.35, fs * 0.35);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(o.name, x, y + r * 1.12 + fs * 0.72);
      }
    }
  }
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ---------- selection + guides ---------- */

function drawSelection(ctx, rect, o, p) {
  if (!p) return;
  const [x, y] = toPx(rect, p.x, p.y);
  const r = markerRadius(rect, o.kind) * 1.6;
  ctx.save();
  ctx.strokeStyle = '#7ee2b8';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function drawTrails(ctx, rect, doc, index) {
  const a = doc.frames[index], b = doc.frames[index + 1];
  if (!a || !b) return;
  ctx.save();
  ctx.globalAlpha = 0.5;
  for (const o of doc.objects) {
    const pa = a.pos[o.id], pb = b.pos[o.id];
    if (!pa || !pb) continue;
    if (Math.hypot(pa.x - pb.x, pa.y - pb.y) < 0.012) continue;
    const isBall = o.kind === 'ball';
    drawShape(ctx, rect, {
      type: isBall ? 'pass' : 'run',
      pts: [[pa.x, pa.y], [pb.x, pb.y]],
      color: isBall ? '#ffffff' : (o.team ? doc.teams[o.team].color : '#ffd166'),
      width: 0.4,
    }, { alpha: 0.55 });
  }
  ctx.restore();
}

function drawOnion(ctx, rect, doc, index) {
  const prev = doc.frames[index - 1];
  if (!prev) return;
  for (const o of doc.objects) {
    const p = prev.pos[o.id];
    if (!p) continue;
    drawObject(ctx, rect, o, p, { alpha: 0.22 });
  }
}

/* ---------- main paint ---------- */

export function paint(ctx, canvasW, canvasH, opts = {}) {
  const doc = state.doc;
  const rect = opts.rect || boardRect(canvasW, canvasH, doc.pitch);
  ctx.clearRect(0, 0, canvasW, canvasH);

  const theme = THEMES[doc.theme] || THEMES.grass;
  ctx.fillStyle = opts.background || theme.out;
  ctx.fillRect(0, 0, canvasW, canvasH);

  // board shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.45)';
  ctx.shadowBlur = 24;
  ctx.fillStyle = theme.turf;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();

  drawPitch(ctx, doc.pitch, rect, doc.theme, doc.stripes);

  const playing = state.playing || opts.forcePlay;
  const index = opts.frameIndex == null ? state.frame : opts.frameIndex;
  const t = opts.progress == null ? state.progress : opts.progress;

  if (!playing) {
    if (state.onion) drawOnion(ctx, rect, doc, index);
    if (state.trails && !state.recording) drawTrails(ctx, rect, doc, index);
  }

  // Keep markers and drawings inside the board (matters on half-pitch views).
  const bleed = rect.w * 0.05;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x - bleed, rect.y - bleed, rect.w + bleed * 2, rect.h + bleed * 2);
  ctx.clip();

  const f = doc.frames[index];
  const shapes = (f && f.shapes) || [];
  const reveal = playing ? Math.min(1, t * 1.35) : 1;
  const fade = playing && t > 0.86 ? 1 - (t - 0.86) / 0.14 : 1;
  for (const s of shapes) drawShape(ctx, rect, s, { reveal, alpha: fade });

  const pos = playing ? positionsAt(doc, index, t) : (f ? f.pos : {});
  const order = ['ladder', 'hurdle', 'minigoal', 'cone', 'flag', 'mannequin', 'label', 'player', 'keeper', 'ball'];
  const sorted = doc.objects.slice().sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  for (const o of sorted) {
    const p = pos[o.id];
    if (!p) continue;
    drawObject(ctx, rect, o, p);
  }

  if (!playing && state.selection && state.selection.type === 'object') {
    const o = doc.objects.find((x) => x.id === state.selection.id);
    if (o) drawSelection(ctx, rect, o, pos[o.id]);
  }
  if (!playing && state.selection && state.selection.type === 'shape') {
    const s = shapes.find((x) => x.id === state.selection.id);
    if (s) {
      ctx.save();
      ctx.globalAlpha = 0.9;
      drawShape(ctx, rect, { ...s, color: '#7ee2b8', width: (s.width || 0.55) * 1.7 }, { alpha: 0.35 });
      ctx.restore();
    }
  }

  if (opts.draft) drawShape(ctx, rect, opts.draft, {});
  ctx.restore();
  return rect;
}
