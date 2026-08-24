// pitch.js - pitch definitions, projection helpers and all field markings.

export const PITCHES = {
  full:     { label: '11 v 11 (full)',   sport: 'football',  L: 105, W: 68,  clip: [0, 0, 105, 68],   portrait: false },
  half:     { label: '11 v 11 (half)',   sport: 'football',  L: 105, W: 68,  clip: [52.5, 0, 52.5, 68], portrait: false },
  vertical: { label: 'Full (portrait)',  sport: 'football',  L: 105, W: 68,  clip: [0, 0, 105, 68],   portrait: true },
  vhalf:    { label: 'Half (portrait)',  sport: 'football',  L: 105, W: 68,  clip: [52.5, 0, 52.5, 68], portrait: true },
  third:    { label: 'Final third',      sport: 'football',  L: 105, W: 68,  clip: [70, 0, 35, 68],   portrait: true },
  nine:     { label: '9 v 9 youth',      sport: 'football9', L: 73,  W: 46,  clip: [0, 0, 73, 46],    portrait: false },
  seven:    { label: '7 v 7 youth',      sport: 'football7', L: 60,  W: 40,  clip: [0, 0, 60, 40],    portrait: false },
  futsal:   { label: 'Futsal',           sport: 'futsal',    L: 40,  W: 20,  clip: [0, 0, 40, 20],    portrait: false },
  beach:    { label: 'Beach soccer',     sport: 'beach',     L: 37,  W: 27,  clip: [0, 0, 37, 27],    portrait: false },
  grid:     { label: 'Training grid',    sport: 'grid',      L: 60,  W: 40,  clip: [0, 0, 60, 40],    portrait: false },
  blank:    { label: 'Blank board',      sport: 'blank',     L: 60,  W: 40,  clip: [0, 0, 60, 40],    portrait: false },
};

export const THEMES = {
  grass:  { turf: '#2c7a4b', stripe: '#318653', line: 'rgba(255,255,255,0.88)', out: '#1d5334' },
  night:  { turf: '#141a22', stripe: '#171f28', line: 'rgba(150,225,190,0.55)', out: '#0d1117' },
  chalk:  { turf: '#eef1f5', stripe: '#e6eaf0', line: 'rgba(60,72,88,0.55)',    out: '#dfe4ea' },
  slate:  { turf: '#243447', stripe: '#27394d', line: 'rgba(255,255,255,0.6)',  out: '#1a2637' },
  sand:   { turf: '#d8b782', stripe: '#dcbd8b', line: 'rgba(255,255,255,0.85)', out: '#c9a56d' },
};

// Aspect ratio (w/h) of the visible board for a pitch key.
export function boxSize(key) {
  const p = PITCHES[key] || PITCHES.full;
  const [, , cw, ch] = p.clip;
  return p.portrait ? { w: ch, h: cw } : { w: cw, h: ch };
}

// Board coords (0..1 of the visible window) -> fraction of the whole pitch.
export function toPitchFrac(key, u, v) {
  const p = PITCHES[key] || PITCHES.full;
  const [cx, cy, cw, ch] = p.clip;
  const mx = p.portrait ? cx + v * cw : cx + u * cw;
  const my = p.portrait ? cy + u * ch : cy + v * ch;
  return [mx / p.L, my / p.W];
}

// Fraction of the whole pitch -> board coords of the visible window.
export function fromPitchFrac(key, fx, fy) {
  const p = PITCHES[key] || PITCHES.full;
  const [cx, cy, cw, ch] = p.clip;
  const mx = fx * p.L, my = fy * p.W;
  const u = p.portrait ? (my - cy) / ch : (mx - cx) / cw;
  const v = p.portrait ? (mx - cx) / cw : (my - cy) / ch;
  return [u, v];
}

// Build a projector: meters -> canvas pixels, for the visible clip window.
export function projector(key, rect) {
  const p = PITCHES[key] || PITCHES.full;
  const [cx, cy, cw, ch] = p.clip;
  const box = boxSize(key);
  const s = rect.w / box.w; // pixels per meter (uniform)
  const P = p.portrait
    ? (mx, my) => [rect.x + ((my - cy) / ch) * rect.w, rect.y + ((mx - cx) / cw) * rect.h]
    : (mx, my) => [rect.x + ((mx - cx) / cw) * rect.w, rect.y + ((my - cy) / ch) * rect.h];
  P.scale = s;
  P.spec = p;
  return P;
}

/* ---------- low level drawing helpers (all inputs in meters) ---------- */

function line(ctx, P, x1, y1, x2, y2) {
  const a = P(x1, y1), b = P(x2, y2);
  ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
}

function rect(ctx, P, x, y, w, h, fill) {
  const pts = [P(x, y), P(x + w, y), P(x + w, y + h), P(x, y + h)];
  ctx.beginPath();
  pts.forEach((pt, i) => (i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1])));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); } else ctx.stroke();
}

function arc(ctx, P, cx, cy, r, a0, a1, close) {
  const steps = Math.max(12, Math.round((Math.abs(a1 - a0) / (Math.PI * 2)) * 96));
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    const pt = P(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1]);
  }
  if (close) ctx.closePath();
  ctx.stroke();
}

function dot(ctx, P, x, y, rPx) {
  const pt = P(x, y);
  ctx.beginPath(); ctx.arc(pt[0], pt[1], rPx, 0, Math.PI * 2); ctx.fill();
}

/* ---------- turf ---------- */

function paintTurf(ctx, P, spec, theme, rectPx, stripes) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rectPx.x, rectPx.y, rectPx.w, rectPx.h);
  ctx.clip();
  ctx.fillStyle = theme.turf;
  ctx.fillRect(rectPx.x, rectPx.y, rectPx.w, rectPx.h);
  if (stripes) {
    const bands = 10, step = spec.L / bands;
    ctx.fillStyle = theme.stripe;
    for (let i = 0; i < bands; i += 2) {
      const a = P(i * step, 0), b = P((i + 1) * step, 0), c = P((i + 1) * step, spec.W), d = P(i * step, spec.W);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]);
      ctx.closePath(); ctx.fill();
    }
  }
  // soft vignette so markers stay readable
  const g = ctx.createLinearGradient(rectPx.x, rectPx.y, rectPx.x, rectPx.y + rectPx.h);
  g.addColorStop(0, 'rgba(0,0,0,0.10)');
  g.addColorStop(0.5, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.14)');
  ctx.fillStyle = g;
  ctx.fillRect(rectPx.x, rectPx.y, rectPx.w, rectPx.h);
  ctx.restore();
}

/* ---------- markings per sport ---------- */

function football(ctx, P, spec, opts) {
  const { L, W, pen, penW, goalA, goalAW, spot, circle, goalW, corner } = opts;
  const s = P.scale;
  rect(ctx, P, 0, 0, L, W);
  line(ctx, P, L / 2, 0, L / 2, W);
  arc(ctx, P, L / 2, W / 2, circle, 0, Math.PI * 2);
  dot(ctx, P, L / 2, W / 2, Math.max(1.5, s * 0.22));

  for (const side of [0, 1]) {
    const sign = side ? -1 : 1;
    const gx = side ? L : 0;
    const py = (W - penW) / 2;
    rect(ctx, P, side ? L - pen : 0, py, pen, penW);
    if (goalA) {
      const gy = (W - goalAW) / 2;
      rect(ctx, P, side ? L - goalA : 0, gy, goalA, goalAW);
    }
    dot(ctx, P, gx + sign * spot, W / 2, Math.max(1.5, s * 0.22));
    // penalty arc, only the part outside the box
    const cos = (pen - spot) / circle;
    if (Math.abs(cos) < 1) {
      const a = Math.acos(cos);
      const base = side ? Math.PI : 0;
      arc(ctx, P, gx + sign * spot, W / 2, circle, base - a * sign, base + a * sign);
    }
    // goal frame (drawn just outside the goal line)
    const gy0 = (W - goalW) / 2;
    ctx.save();
    ctx.globalAlpha = 0.85;
    rect(ctx, P, side ? L : -1.9, gy0, 1.9, goalW);
    ctx.restore();
    // corner arcs
    if (corner) {
      arc(ctx, P, gx, 0, corner, side ? Math.PI / 2 : 0, side ? Math.PI : Math.PI / 2);
      arc(ctx, P, gx, W, corner, side ? Math.PI : -Math.PI / 2, side ? Math.PI * 1.5 : 0);
    }
  }
}

function futsal(ctx, P, spec) {
  const L = spec.L, W = spec.W, s = P.scale;
  rect(ctx, P, 0, 0, L, W);
  line(ctx, P, L / 2, 0, L / 2, W);
  arc(ctx, P, L / 2, W / 2, 3, 0, Math.PI * 2);
  dot(ctx, P, L / 2, W / 2, Math.max(1.5, s * 0.15));
  const goalW = 3, r = 6;
  for (const side of [0, 1]) {
    const gx = side ? L : 0;
    const sign = side ? -1 : 1;
    const p1 = W / 2 - goalW / 2, p2 = W / 2 + goalW / 2;
    // quarter arcs from each post, joined by a straight line
    arc(ctx, P, gx, p1, r, side ? Math.PI / 2 : Math.PI * 1.5, side ? Math.PI : Math.PI * 2);
    arc(ctx, P, gx, p2, r, side ? Math.PI : 0, side ? Math.PI * 1.5 : Math.PI / 2);
    line(ctx, P, gx + sign * r, p1, gx + sign * r, p2);
    dot(ctx, P, gx + sign * 6, W / 2, Math.max(1.5, s * 0.15));
    dot(ctx, P, gx + sign * 10, W / 2, Math.max(1.5, s * 0.15));
    ctx.save(); ctx.globalAlpha = 0.85;
    rect(ctx, P, side ? L : -1.2, W / 2 - goalW / 2, 1.2, goalW);
    ctx.restore();
    arc(ctx, P, gx, 0, 0.25, side ? Math.PI / 2 : 0, side ? Math.PI : Math.PI / 2);
    arc(ctx, P, gx, W, 0.25, side ? Math.PI : -Math.PI / 2, side ? Math.PI * 1.5 : 0);
  }
}

function beach(ctx, P, spec) {
  const L = spec.L, W = spec.W;
  ctx.save();
  ctx.setLineDash([P.scale * 0.9, P.scale * 0.7]);
  rect(ctx, P, 0, 0, L, W);
  line(ctx, P, L / 2, 0, L / 2, W);
  for (const side of [0, 1]) {
    const x = side ? L - 9 : 9;
    line(ctx, P, x, 0, x, W);
  }
  ctx.restore();
  for (const side of [0, 1]) {
    ctx.save(); ctx.globalAlpha = 0.85;
    rect(ctx, P, side ? L : -1.5, W / 2 - 2.75, 1.5, 5.5);
    ctx.restore();
  }
}

function grid(ctx, P, spec) {
  const L = spec.L, W = spec.W;
  rect(ctx, P, 0, 0, L, W);
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.setLineDash([P.scale * 0.6, P.scale * 0.6]);
  for (let x = 10; x < L; x += 10) line(ctx, P, x, 0, x, W);
  for (let y = 10; y < W; y += 10) line(ctx, P, 0, y, L, y);
  ctx.restore();
}

/**
 * Draw the pitch for `key` inside `rectPx` (already aspect-correct).
 */
export function drawPitch(ctx, key, rectPx, themeKey, stripes) {
  const spec = PITCHES[key] || PITCHES.full;
  const theme = THEMES[themeKey === 'grass' && spec.sport === 'beach' ? 'sand' : themeKey] || THEMES.grass;
  const P = projector(key, rectPx);

  paintTurf(ctx, P, spec, theme, rectPx, stripes && spec.sport !== 'beach' && spec.sport !== 'blank' && spec.sport !== 'futsal');

  ctx.save();
  ctx.beginPath();
  const bleed = P.scale * 2.4; // room for the goal frames outside the touchline
  ctx.rect(rectPx.x - bleed, rectPx.y - bleed, rectPx.w + bleed * 2, rectPx.h + bleed * 2);
  ctx.clip();
  ctx.strokeStyle = theme.line;
  ctx.fillStyle = theme.line;
  ctx.lineWidth = Math.max(1, P.scale * 0.14);
  ctx.lineJoin = 'round';

  switch (spec.sport) {
    case 'football':
      football(ctx, P, spec, { L: 105, W: 68, pen: 16.5, penW: 40.32, goalA: 5.5, goalAW: 18.32, spot: 11, circle: 9.15, goalW: 7.32, corner: 1 });
      break;
    case 'football9':
      football(ctx, P, spec, { L: 73, W: 46, pen: 13, penW: 29, goalA: 4.5, goalAW: 14, spot: 9, circle: 7, goalW: 5.5, corner: 0.8 });
      break;
    case 'football7':
      football(ctx, P, spec, { L: 60, W: 40, pen: 10, penW: 24, goalA: 0, goalAW: 0, spot: 8, circle: 6, goalW: 5, corner: 0.6 });
      break;
    case 'futsal': futsal(ctx, P, spec); break;
    case 'beach': beach(ctx, P, spec); break;
    case 'grid': grid(ctx, P, spec); break;
    default: rect(ctx, P, 0, 0, spec.L, spec.W);
  }
  ctx.restore();
  return P;
}
