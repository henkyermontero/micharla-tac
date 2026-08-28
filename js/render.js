// render.js - everything that paints onto the canvas.

import { drawPitch, boxSize, THEMES, PITCHES, GOALS, fromPitchFrac } from './pitch.js';
import { state, KINDS, shapesOf, selection, frame } from './state.js';
import { FORMATIONS } from './formations.js';

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const lerp = (a, b, t) => a + (b - a) * t;

/* ---------- geometry ---------- */

export function boardRect(cw, ch, pitchKey, pad) {
  if (pad == null) pad = Math.max(12, Math.min(cw, ch) * 0.05);
  const box = boxSize(pitchKey);
  const aspect = box.w / box.h;
  let w = cw - pad * 2;
  let h = w / aspect;
  if (h > ch - pad * 2) { h = ch - pad * 2; w = h * aspect; }
  return { x: Math.round((cw - w) / 2), y: Math.round((ch - h) / 2), w: Math.round(w), h: Math.round(h) };
}

export const toPx = (r, x, y) => [r.x + x * r.w, r.y + y * r.h];
export const toBoard = (r, px, py) => [(px - r.x) / r.w, (py - r.y) / r.h];

export const pxPerMeter = (rect) => rect.w / boxSize(state.doc.pitch).w;

export function markerRadius(rect, kind = 'player', size = 1) {
  const spec = PITCHES[state.doc.pitch] || PITCHES.full;
  // Un arco mide lo que mide. No pasa por state.markerScale a proposito: subir
  // el tamano de las fichas no puede agrandar una porteria de 7.32 m.
  const goal = GOALS[kind];
  if (goal) return pxPerMeter(rect) * (goal.w / 2) * size;
  const base = pxPerMeter(rect) * spec.L * 0.021;
  return base * state.markerScale * size * (KINDS[kind] ? KINDS[kind].r : 1);
}

/**
 * Cuanto ocupa una ficha para tocarla o para dibujarle el aro de seleccion.
 * Casi siempre es su radio, pero la barrera es una fila de maniquies, no un
 * punto: sin esto solo se podria agarrar por el maniqui del medio.
 */
export function objectReach(rect, o) {
  const r = markerRadius(rect, o.kind, o.size || 1);
  if (o.kind === 'barrier') return ((barrierCount(o) - 1) / 2) * r * BARRIER_STEP + r;
  return r;
}

/* ---------- interpolation ---------- */

export function positionsAt(doc, index, t) {
  const a = doc.frames[index];
  const b = doc.frames[index + 1];
  const out = {};
  const raw = Math.max(0, Math.min(1, t));
  const e = (a && a.easing === 'linear') ? raw : easeInOut(raw);
  for (const o of doc.objects) {
    const pa = a && a.pos[o.id];
    const pb = b && b.pos[o.id];
    if (pa && pb && b) out[o.id] = { x: lerp(pa.x, pb.x, e), y: lerp(pa.y, pb.y, e) };
    else if (pa) out[o.id] = { x: pa.x, y: pa.y };
    else if (pb) out[o.id] = { x: pb.x, y: pb.y };
  }
  return out;
}

/* ---------- paths ---------- */

/** Screen-space points for a shape, expanding a bezier control point. */
export function shapePoints(rect, s) {
  const pts = s.pts.map(([x, y]) => toPx(rect, x, y));
  if (s.ctrl && pts.length === 2) {
    const c = toPx(rect, s.ctrl[0], s.ctrl[1]);
    const out = [];
    const N = 36;
    for (let i = 0; i <= N; i++) {
      const t = i / N, u = 1 - t;
      out.push([
        u * u * pts[0][0] + 2 * u * t * c[0] + t * t * pts[1][0],
        u * u * pts[0][1] + 2 * u * t * c[1] + t * t * pts[1][1],
      ]);
    }
    return out;
  }
  return pts;
}

function polyLength(p) {
  let L = 0;
  for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
  return L;
}

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
    out.push([x + nx * Math.sin((target / wave) * Math.PI * 2) * amp, y + ny * Math.sin((target / wave) * Math.PI * 2) * amp]);
  }
  smooth(ctx, out);
}

function arrowHead(ctx, p, size, style = 'v') {
  let i = p.length - 1, j = i - 1;
  while (j > 0 && Math.hypot(p[i][0] - p[j][0], p[i][1] - p[j][1]) < 2) j--;
  const a = Math.atan2(p[i][1] - p[j][1], p[i][0] - p[j][0]);
  ctx.save();
  ctx.translate(p[i][0], p[i][1]);
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

const ARROWED = { pass: 1, run: 1, dribble: 1, shot: 1 };

export function drawShape(ctx, rect, s, opts = {}) {
  const reveal = opts.reveal == null ? 1 : opts.reveal;
  const alpha = (opts.alpha == null ? 1 : opts.alpha) * (s.opacity == null ? 1 : s.opacity);
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

  if (s.type === 'zone' || s.type === 'ellipse' || s.type === 'poly') {
    ctx.beginPath();
    if (s.type === 'poly') {
      const p = s.pts.map(([x, y]) => toPx(rect, x, y));
      p.forEach((pt, i) => (i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1])));
      if (!opts.open) ctx.closePath();
    } else {
      const a = toPx(rect, s.pts[0][0], s.pts[0][1]);
      const b = toPx(rect, s.pts[1][0], s.pts[1][1]);
      if (s.type === 'zone') ctx.rect(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]));
      else ctx.ellipse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) / 2, Math.abs(b[1] - a[1]) / 2, 0, 0, Math.PI * 2);
    }
    if (s.fill > 0 && !opts.open) {
      ctx.globalAlpha = alpha * s.fill;
      ctx.fill();
      ctx.globalAlpha = alpha;
    }
    if (s.dash !== false) ctx.setLineDash([lw * 3, lw * 2.2]);
    ctx.stroke();
    ctx.restore();
    return;
  }

  let p = shapePoints(rect, s);
  if (p.length < 2) { ctx.restore(); return; }
  p = trim(p, reveal);
  if (p.length < 2) { ctx.restore(); return; }

  ctx.shadowColor = 'rgba(0,0,0,0.32)';
  ctx.shadowBlur = lw * 1.1;
  if (s.type === 'run' || s.dash) ctx.setLineDash([lw * 2.6, lw * 2.2]);
  if (s.type === 'shot') ctx.lineWidth = lw * 1.6;

  if (s.type === 'dribble') wavy(ctx, p, lw * 1.9, lw * 7);
  else smooth(ctx, p);
  ctx.stroke();
  ctx.setLineDash([]);

  if (ARROWED[s.type] && s.arrow !== false) arrowHead(ctx, p, lw * 2.2 * (s.type === 'shot' ? 1.25 : 1));
  else if (s.type === 'block') arrowHead(ctx, p, lw * 2.4, 't');
  ctx.restore();
}

/** Spotlight: everything outside the shape is dimmed. */
function drawSpot(ctx, rect, s, canvasW, canvasH, alpha = 1) {
  const a = toPx(rect, s.pts[0][0], s.pts[0][1]);
  const b = toPx(rect, s.pts[1][0], s.pts[1][1]);
  const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
  const rx = Math.max(8, Math.abs(b[0] - a[0]) / 2), ry = Math.max(8, Math.abs(b[1] - a[1]) / 2);
  ctx.save();
  ctx.globalAlpha = alpha * (s.opacity == null ? 1 : s.opacity);
  ctx.beginPath();
  ctx.rect(0, 0, canvasW, canvasH);
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2, true);
  ctx.fillStyle = 'rgba(6,10,15,0.62)';
  ctx.fill('evenodd');
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.strokeStyle = s.color || '#ffdd57';
  ctx.lineWidth = Math.max(1.5, (s.width || 0.55) * rect.w * 0.006);
  ctx.setLineDash([10, 8]);
  ctx.stroke();
  ctx.restore();
}

/* ---------- token glyphs ---------- */

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * El balon es el emoji de balon, dibujado como texto en el lienzo. Fred lo pidio
 * asi y es lo correcto: cualquier figura que dibujaramos a mano seria una
 * imitacion peor de algo que el sistema ya trae bien hecho, y ademas la gente ya
 * reconoce ese balon de memoria.
 *
 * Sale de la fuente de emoji del sistema, que ya esta en el dispositivo: no se
 * pide nada a la red, igual que con Inter. Se ve un poco distinto en Mac, en
 * Android y en Windows, y esta bien: en los tres es un balon de futbol.
 *
 * El multiplicador y el desplazamiento estan medidos mirando el resultado, no
 * calculados: un glifo de emoji no llena su em y no se sienta en el centro.
 */
const EMOJI_FONT = "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji','EmojiOne Color',sans-serif";

function ballGlyph(ctx, x, y, r) {
  ctx.save();
  // Blanco por si el visor no tiene fuente de emoji a color y cae al glifo
  // monocromo: mejor un balon blanco sobre el cesped que uno verde oscuro.
  ctx.fillStyle = '#ffffff';
  ctx.font = `${(r * 2.06).toFixed(2)}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('\u26BD', x, y);
  ctx.restore();
}

function coneGlyph(ctx, x, y, r, color) {
  ctx.fillStyle = color || '#ff8c1a';
  ctx.beginPath();
  ctx.moveTo(x, y - r * 1.15);
  ctx.lineTo(x + r, y + r * 0.85);
  ctx.lineTo(x - r, y + r * 0.85);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.fillRect(x - r * 1.15, y + r * 0.85, r * 2.3, r * 0.32);
}

function discGlyph(ctx, x, y, r, color) {
  ctx.fillStyle = color || '#ffd166';
  ctx.beginPath(); ctx.ellipse(x, y, r * 1.15, r * 0.62, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = Math.max(1, r * 0.12); ctx.stroke();
}

const BARRIER_STEP = 2.05;   // separacion entre maniquies, en radios
export const barrierCount = (o) => Math.max(2, Math.min(6, o.count || 4));

/**
 * La barrera: los maniquies de tiro libre puestos en fila, como se plantan en
 * el entrenamiento. Es una sola ficha, asi se coloca, se gira hacia el balon y
 * se mueve entera de una vez. El numero de maniquies se cambia en el panel.
 *
 * Cada maniqui se contragira: girar la barrera apunta la fila hacia el balon,
 * no tumba los maniquies de costado. El maniqui suelto si gira, que para eso
 * esta.
 */
function barrierGlyph(ctx, x, y, r, count, color, rot) {
  const step = r * BARRIER_STEP;
  const start = -((count - 1) / 2) * step;
  const back = ((rot || 0) * Math.PI) / -180;
  for (let i = 0; i < count; i++) {
    const fx = x + start + i * step;
    if (!back) { mannequinGlyph(ctx, fx, y, r, color); continue; }
    ctx.save();
    ctx.translate(fx, y);
    ctx.rotate(back);
    mannequinGlyph(ctx, 0, 0, r, color);
    ctx.restore();
  }
}

function mannequinGlyph(ctx, x, y, r, color) {
  ctx.fillStyle = color || '#cbd5e1';
  ctx.beginPath(); ctx.arc(x, y - r * 0.85, r * 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - r * 0.75, y + r * 1.1);
  ctx.lineTo(x - r * 0.35, y - r * 0.3);
  ctx.lineTo(x + r * 0.35, y - r * 0.3);
  ctx.lineTo(x + r * 0.75, y + r * 1.1);
  ctx.closePath(); ctx.fill();
}

function refereeGlyph(ctx, x, y, r) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#1b1f24'; ctx.fill();
  ctx.lineWidth = Math.max(1.2, r * 0.13); ctx.strokeStyle = '#ffd166'; ctx.stroke();
  ctx.fillStyle = '#ffd166';
  ctx.font = `700 ${r * 1.05}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('A', x, y + r * 0.06);
}

/**
 * Un arco visto desde arriba, con sus medidas reales en metros (ver GOALS en
 * pitch.js), no con el radio de la ficha: en la pizarra ocupa lo mismo que
 * ocupa en la cancha. La boca queda abierta y sin linea, con un poste marcado
 * en cada esquina, para que se lea de un vistazo hacia donde se remata.
 * Con rot 0 la boca mira a la izquierda, igual que el arco derecho del campo.
 */
function goalGlyph(ctx, x, y, rect, kind, size, color) {
  const spec = GOALS[kind] || GOALS.minigoal;
  const px = pxPerMeter(rect);
  const w = spec.w * px * size;                    // boca
  const d = Math.max(3, spec.d * px * size);       // fondo
  const x0 = x - d / 2;
  const y0 = y - w / 2;
  const post = Math.max(1.6, Math.min(w * 0.05, d * 0.34));

  // La red: un tinte y una cuadricula floja. Cuadricula y no rayas paralelas
  // porque las rayas, a este tamano, se leen como una escalera de coordinacion.
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, d, w);
  ctx.fillStyle = 'rgba(255,255,255,.13)';
  ctx.fill();
  ctx.clip();
  ctx.globalAlpha *= 0.4;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(0.5, post * 0.22);
  const cell = Math.max(4, w / 6);
  ctx.beginPath();
  for (let ny = y0 + cell; ny < y0 + w - 1; ny += cell) { ctx.moveTo(x0, ny); ctx.lineTo(x0 + d, ny); }
  for (let nx = x0 + cell; nx < x0 + d - 1; nx += cell) { ctx.moveTo(nx, y0); ctx.lineTo(nx, y0 + w); }
  ctx.stroke();
  ctx.restore();

  // los tres lados cerrados: la boca se deja abierta
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, post * 0.6);
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0 + d, y0);
  ctx.lineTo(x0 + d, y0 + w);
  ctx.lineTo(x0, y0 + w);
  ctx.stroke();

  // los postes, gordos a proposito: son lo que dice hacia donde se remata
  ctx.fillStyle = color;
  for (const ny of [y0, y0 + w]) {
    ctx.beginPath();
    ctx.arc(x0, ny, post * 1.15, 0, Math.PI * 2);
    ctx.fill();
  }
}

function flagGlyph(ctx, x, y, r, color) {
  ctx.strokeStyle = '#e9ecef'; ctx.lineWidth = Math.max(1.5, r * 0.3);
  ctx.beginPath(); ctx.moveTo(x, y + r); ctx.lineTo(x, y - r * 1.4); ctx.stroke();
  ctx.fillStyle = color || '#ffd166';
  ctx.beginPath(); ctx.moveTo(x, y - r * 1.4); ctx.lineTo(x + r * 1.2, y - r * 0.95); ctx.lineTo(x, y - r * 0.5); ctx.closePath(); ctx.fill();
}

function ladderGlyph(ctx, x, y, r, color) {
  ctx.strokeStyle = color || '#ffd166'; ctx.lineWidth = Math.max(1.5, r * 0.18);
  ctx.strokeRect(x - r * 2, y - r * 0.7, r * 4, r * 1.4);
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x - r * 2 + (i * r * 4) / 4, y - r * 0.7);
    ctx.lineTo(x - r * 2 + (i * r * 4) / 4, y + r * 0.7);
    ctx.stroke();
  }
}

function hurdleGlyph(ctx, x, y, r, color) {
  ctx.strokeStyle = color || '#f4a261'; ctx.lineWidth = Math.max(1.5, r * 0.28);
  ctx.beginPath();
  ctx.moveTo(x - r, y + r * 0.7); ctx.lineTo(x - r, y - r * 0.6);
  ctx.lineTo(x + r, y - r * 0.6); ctx.lineTo(x + r, y + r * 0.7);
  ctx.stroke();
}

export function drawObject(ctx, rect, o, p, opts = {}) {
  if (!p) return;
  const [x, y] = toPx(rect, p.x, p.y);
  const r = markerRadius(rect, o.kind, o.size || 1);
  const team = o.team ? state.doc.teams[o.team] : null;
  const color = o.color || (team ? team.color : '#ffd166');
  ctx.save();
  ctx.globalAlpha = opts.alpha == null ? 1 : opts.alpha;
  if (o.rot) { ctx.translate(x, y); ctx.rotate((o.rot * Math.PI) / 180); ctx.translate(-x, -y); }

  switch (o.kind) {
    case 'ball': ballGlyph(ctx, x, y, r); break;
    case 'cone': coneGlyph(ctx, x, y, r, o.color || '#ff8c1a'); break;
    case 'disc': discGlyph(ctx, x, y, r, o.color || '#ffd166'); break;
    case 'mannequin': mannequinGlyph(ctx, x, y, r, o.color || '#cbd5e1'); break;
    case 'barrier': barrierGlyph(ctx, x, y, r, barrierCount(o), o.color || '#cbd5e1', o.rot); break;
    case 'referee': refereeGlyph(ctx, x, y, r); break;
    case 'goal':
    case 'minigoal': goalGlyph(ctx, x, y, rect, o.kind, o.size || 1, o.color || '#ffffff'); break;
    case 'flag': flagGlyph(ctx, x, y, r, o.color || '#ffd166'); break;
    case 'ladder': ladderGlyph(ctx, x, y, r, o.color || '#ffd166'); break;
    case 'hurdle': hurdleGlyph(ctx, x, y, r, o.color || '#f4a261'); break;
    case 'label': {
      const size = r * 1.15;
      ctx.font = `600 ${size}px Inter, system-ui, sans-serif`;
      const text = o.name || 'Texto';
      const w = ctx.measureText(text).width;
      ctx.fillStyle = 'rgba(8,12,18,.66)';
      roundRect(ctx, x - w / 2 - size * 0.45, y - size * 0.8, w + size * 0.9, size * 1.6, size * 0.35);
      ctx.fill();
      ctx.fillStyle = o.color || '#fff';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, x, y + size * 0.05);
      break;
    }
    default: {
      ctx.shadowColor = 'rgba(0,0,0,.45)';
      ctx.shadowBlur = r * 0.5;
      ctx.shadowOffsetY = r * 0.16;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      ctx.lineWidth = Math.max(1.2, r * 0.13);
      ctx.strokeStyle = o.kind === 'keeper' ? '#ffef9f' : 'rgba(255,255,255,.9)';
      ctx.stroke();
      // Away tokens carry a second ring so the teams differ by shape, not only colour.
      if (o.team === 'B') {
        ctx.beginPath(); ctx.arc(x, y, r * 0.76, 0, Math.PI * 2);
        ctx.lineWidth = Math.max(1, r * 0.09);
        ctx.strokeStyle = 'rgba(255,255,255,.75)';
        ctx.stroke();
      }
      if (state.showNumbers && !o.hideNum && o.num !== '' && o.num != null) {
        ctx.fillStyle = (team && team.ink) || '#fff';
        ctx.font = `700 ${r * 1.02}px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(o.num), x, y + r * 0.06);
      }
      if (state.showNames && o.name) {
        const fs = Math.max(9, r * 0.8);
        ctx.font = `600 ${fs}px Inter, system-ui, sans-serif`;
        const w = ctx.measureText(o.name).width;
        ctx.fillStyle = 'rgba(8,12,18,.6)';
        roundRect(ctx, x - w / 2 - fs * 0.3, y + r * 1.12, w + fs * 0.6, fs * 1.35, fs * 0.35);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(o.name, x, y + r * 1.12 + fs * 0.72);
      }
      if (o.locked) {
        ctx.fillStyle = 'rgba(255,255,255,.75)';
        ctx.beginPath(); ctx.arc(x + r * 0.78, y - r * 0.78, r * 0.24, 0, Math.PI * 2); ctx.fill();
      }
    }
  }
  ctx.restore();
}

/* ---------- overlays ---------- */

function drawThirds(ctx, rect, pitchKey) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.28)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([7, 6]);
  const line = (a, b) => {
    const p1 = toPx(rect, a[0], a[1]), p2 = toPx(rect, b[0], b[1]);
    ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
  };
  for (const fx of [1 / 3, 2 / 3]) line(fromPitchFrac(pitchKey, fx, 0), fromPitchFrac(pitchKey, fx, 1));
  for (const fy of [0.21, 0.37, 0.63, 0.79]) line(fromPitchFrac(pitchKey, 0, fy), fromPitchFrac(pitchKey, 1, fy));
  ctx.restore();
}

function drawGrid(ctx, rect) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,.12)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 20; i++) {
    const x = rect.x + (rect.w * i) / 20;
    const y = rect.y + (rect.h * i) / 20;
    ctx.beginPath(); ctx.moveTo(x, rect.y); ctx.lineTo(x, rect.y + rect.h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rect.x, y); ctx.lineTo(rect.x + rect.w, y); ctx.stroke();
  }
  ctx.restore();
}

function drawTrails(ctx, rect, doc, index) {
  const a = doc.frames[index], b = doc.frames[index + 1];
  if (!a || !b) return;
  ctx.save();
  for (const o of doc.objects) {
    const pa = a.pos[o.id], pb = b.pos[o.id];
    if (!pa || !pb) continue;
    if (Math.hypot(pa.x - pb.x, pa.y - pb.y) < 0.012) continue;
    const p1 = toPx(rect, pa.x, pa.y), p2 = toPx(rect, pb.x, pb.y);
    ctx.setLineDash([4, 5]);
    ctx.lineWidth = Math.max(1.4, rect.w * 0.0035);
    ctx.strokeStyle = o.kind === 'ball' ? 'rgba(255,255,255,.75)' : (o.team ? doc.teams[o.team].color : '#ffd166');
    ctx.globalAlpha = 0.75;
    ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(p2[0], p2[1], Math.max(2, rect.w * 0.004), 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle; ctx.globalAlpha = 0.9; ctx.fill();
  }
  ctx.restore();
}

function drawOnion(ctx, rect, doc, index) {
  const prev = doc.frames[index - 1];
  if (!prev) return;
  for (const o of doc.objects) {
    const p = prev.pos[o.id];
    if (p) drawObject(ctx, rect, o, p, { alpha: 0.2 });
  }
}

function drawGhostFormation(ctx, rect) {
  const pts = FORMATIONS[11]['4-3-3'];
  ctx.save();
  ctx.globalAlpha = 0.22;
  pts.forEach(([fx, fy], i) => {
    const [u, v] = fromPitchFrac(state.doc.pitch, fx, fy);
    const [x, y] = toPx(rect, u, v);
    const r = markerRadius(rect, 'player');
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.fillStyle = '#0b0f14';
    ctx.font = `700 ${r}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), x, y + r * 0.06);
  });
  ctx.restore();
}

function drawGuides(ctx, rect) {
  if (!state.guides.length) return;
  ctx.save();
  ctx.strokeStyle = 'rgba(126,226,184,.85)';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  for (const g of state.guides) {
    ctx.beginPath();
    if (g.axis === 'x') {
      const x = rect.x + g.v * rect.w;
      ctx.moveTo(x, rect.y); ctx.lineTo(x, rect.y + rect.h);
    } else {
      const y = rect.y + g.v * rect.h;
      ctx.moveTo(rect.x, y); ctx.lineTo(rect.x + rect.w, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/* ---------- selection chrome ---------- */

export function shapeHandles(rect, s) {
  if (s.type === 'zone' || s.type === 'ellipse' || s.type === 'spot') {
    const a = s.pts[0], b = s.pts[1];
    return [
      { i: 0, kind: 'pt', x: a[0], y: a[1] },
      { i: 1, kind: 'pt', x: b[0], y: b[1] },
      { i: 2, kind: 'pt', x: a[0], y: b[1] },
      { i: 3, kind: 'pt', x: b[0], y: a[1] },
    ];
  }
  if (s.type === 'poly') return s.pts.map(([x, y], i) => ({ i, kind: 'pt', x, y }));
  const out = s.pts.map(([x, y], i) => ({ i, kind: 'pt', x, y }));
  if (s.pts.length === 2) {
    const c = s.ctrl || [(s.pts[0][0] + s.pts[1][0]) / 2, (s.pts[0][1] + s.pts[1][1]) / 2];
    out.push({ i: -1, kind: 'ctrl', x: c[0], y: c[1] });
  }
  return out;
}

function drawSelection(ctx, rect, pos) {
  const objs = selection.objects();
  for (const o of objs) {
    const p = pos[o.id];
    if (!p) continue;
    const [x, y] = toPx(rect, p.x, p.y);
    const r = objectReach(rect, o) * 1.55;
    ctx.save();
    ctx.strokeStyle = '#7ee2b8';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  const shapes = selection.shapes();
  for (const s of shapes) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = '#7ee2b8';
    ctx.fillStyle = '#0b0f14';
    ctx.lineWidth = 2;
    for (const h of shapeHandles(rect, s)) {
      const [hx, hy] = toPx(rect, h.x, h.y);
      ctx.beginPath();
      if (h.kind === 'ctrl') ctx.arc(hx, hy, 6, 0, Math.PI * 2);
      else ctx.rect(hx - 5, hy - 5, 10, 10);
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
}

/* ---------- main paint ---------- */

export function paint(ctx, canvasW, canvasH, opts = {}) {
  const doc = state.doc;
  const rect = opts.rect || boardRect(canvasW, canvasH, doc.pitch);
  const theme = THEMES[doc.theme] || THEMES.grass;
  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.fillStyle = opts.background || theme.out;
  ctx.fillRect(0, 0, canvasW, canvasH);

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.45)';
  ctx.shadowBlur = 24;
  ctx.fillStyle = theme.turf;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();

  drawPitch(ctx, doc.pitch, rect, doc.theme, doc.stripes);
  if (doc.thirds) drawThirds(ctx, rect, doc.pitch);
  if (doc.grid) drawGrid(ctx, rect);

  const playing = state.playing || opts.forcePlay;
  const index = opts.frameIndex == null ? state.frame : opts.frameIndex;
  const t = opts.progress == null ? state.progress : opts.progress;

  const bleed = rect.w * 0.05;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x - bleed, rect.y - bleed, rect.w + bleed * 2, rect.h + bleed * 2);
  ctx.clip();

  if (!playing) {
    if (state.onion) drawOnion(ctx, rect, doc, index);
    if (state.trails && !state.recording) drawTrails(ctx, rect, doc, index);
  }

  const shapes = shapesOf(index);
  const reveal = playing ? Math.min(1, t * 1.35) : 1;
  const fade = playing && t > 0.86 ? 1 - (t - 0.86) / 0.14 : 1;
  const spots = [];
  for (const s of shapes) {
    if (s.type === 'spot') { spots.push(s); continue; }
    drawShape(ctx, rect, s, { reveal, alpha: fade });
  }

  const pos = playing ? positionsAt(doc, index, t) : frame(index).pos;
  if (!doc.objects.length && !playing && opts.ghost !== false) drawGhostFormation(ctx, rect);

  const order = ['ladder', 'hurdle', 'goal', 'minigoal', 'disc', 'cone', 'flag', 'barrier', 'mannequin', 'label', 'referee', 'player', 'keeper', 'ball'];
  const sorted = doc.objects.slice().sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  for (const o of sorted) drawObject(ctx, rect, o, pos[o.id]);

  if (opts.draft) drawShape(ctx, rect, opts.draft, { open: opts.draftOpen });
  ctx.restore();

  for (const s of spots) drawSpot(ctx, rect, s, canvasW, canvasH, fade);

  if (!playing && !state.recording) {
    drawGuides(ctx, rect);
    drawSelection(ctx, rect, pos);
    if (opts.marquee) {
      const m = opts.marquee;
      ctx.save();
      ctx.strokeStyle = '#7ee2b8';
      ctx.fillStyle = 'rgba(126,226,184,.12)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.rect(Math.min(m.x0, m.x1), Math.min(m.y0, m.y1), Math.abs(m.x1 - m.x0), Math.abs(m.y1 - m.y0));
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }
  return rect;
}
