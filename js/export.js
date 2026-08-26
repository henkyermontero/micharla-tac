// export.js - PNG, SVG, printable playbook, video, play files and share links.

import { state, loadDoc, selection } from './state.js';
import { paint, boardRect } from './render.js';
import { boxSize } from './pitch.js';
import { SvgCtx } from './svg.js';
import { t } from './i18n.js';

export const BRAND = 'MiCharla Tac';

const hostDownloads = (typeof window !== 'undefined' && window.claude && typeof window.claude.use === 'function')
  ? window.claude.use('downloads').catch(() => null)
  : Promise.resolve(null);

function anchorDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function download(blob, filename) {
  hostDownloads.then((host) => {
    if (!host) { anchorDownload(blob, filename); return; }
    host.save({ filename, data: blob }).catch((err) => {
      if (err && err.code === 'declined') return;
      anchorDownload(blob, filename);
    });
  });
}

const slug = (s) => (s || 'jugada').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'jugada';

const title = () => (state.doc.title || '').trim();
const fileBase = () => slug(title() || 'micharla-tac');

function frameSize(width) {
  const box = boxSize(state.doc.pitch);
  const pad = Math.round(width * 0.02);
  return { w: width, h: Math.round((width - pad * 2) / (box.w / box.h)) + pad * 2, pad };
}

function offscreen(width) {
  const { w, h } = frameSize(width);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

const opaque = (c) => c.getContext('2d', { alpha: false });

function stamp(ctx, w, h, withBrand) {
  const label = title();
  ctx.save();
  ctx.font = `600 ${Math.round(w * 0.018)}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,.8)';
  ctx.textBaseline = 'top';
  if (label) ctx.fillText(label, Math.round(w * 0.022), Math.round(w * 0.014));
  if (withBrand) {
    ctx.textAlign = 'right';
    ctx.globalAlpha = 0.55;
    ctx.fillText(BRAND, w - Math.round(w * 0.022), h - Math.round(w * 0.032));
  }
  ctx.restore();
}

/* ---------------- images ---------------- */

export function exportPNG(width = 2400, brand = true) {
  const c = offscreen(width);
  const ctx = opaque(c);
  const keep = state.selection;
  const trails = state.trails;
  state.selection = [];
  state.trails = false;
  paint(ctx, c.width, c.height, { rect: boardRect(c.width, c.height, state.doc.pitch, Math.round(width * 0.02)), ghost: false });
  stamp(ctx, c.width, c.height, brand);
  state.selection = keep;
  state.trails = trails;
  c.toBlob((b) => download(b, `${fileBase()}-${state.frame + 1}.png`), 'image/png');
}

export function exportSVG(width = 1600, brand = true) {
  const { w, h, pad } = frameSize(width);
  const ctx = new SvgCtx(w, h);
  const keep = state.selection;
  const trails = state.trails;
  state.selection = [];
  state.trails = false;
  paint(ctx, w, h, { rect: boardRect(w, h, state.doc.pitch, pad), ghost: false });
  stamp(ctx, w, h, brand);
  state.selection = keep;
  state.trails = trails;
  download(new Blob([ctx.toString()], { type: 'image/svg+xml' }), `${fileBase()}-${state.frame + 1}.svg`);
}

/** Every frame of the play on one printable sheet, with its phase and note. */
export function exportSheet(width = 2200) {
  const doc = state.doc;
  const nFrames = doc.frames.length;
  const cols = nFrames === 1 ? 1 : nFrames <= 4 ? 2 : 3;
  const rows = Math.ceil(nFrames / cols);
  const box = boxSize(doc.pitch);
  const gap = Math.round(width * 0.018);
  const headH = Math.round(width * 0.055);
  const cellW = Math.round((width - gap * (cols + 1)) / cols);
  const cellH = Math.round(cellW / (box.w / box.h)) + Math.round(width * 0.042);
  const c = document.createElement('canvas');
  c.width = width;
  c.height = headH + rows * (cellH + gap) + gap;
  const ctx = opaque(c);
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${Math.round(width * 0.026)}px Inter, system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText(title() || 'MiCharla Tac', gap * 1.5, headH / 2 + 4);
  ctx.font = `600 ${Math.round(width * 0.014)}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,.45)';
  ctx.textAlign = 'right';
  ctx.fillText(BRAND, width - gap * 1.5, headH / 2 + 4);
  ctx.textAlign = 'left';

  const keepFrame = state.frame, keepSel = state.selection, keepTrails = state.trails;
  state.selection = [];
  state.trails = true;
  for (let i = 0; i < nFrames; i++) {
    const cx = gap + (i % cols) * (cellW + gap);
    const cy = headH + Math.floor(i / cols) * (cellH + gap);
    state.frame = i;
    const sub = document.createElement('canvas');
    sub.width = cellW;
    sub.height = Math.round(cellW / (box.w / box.h));
    paint(opaque(sub), sub.width, sub.height, { rect: boardRect(sub.width, sub.height, doc.pitch, 2), ghost: false });
    ctx.drawImage(sub, cx, cy);
    const f = doc.frames[i];
    const label = f.label ? `${i + 1}. ${f.label}` : `${i + 1}`;
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${Math.round(width * 0.016)}px Inter, system-ui, sans-serif`;
    ctx.fillText(label, cx + 4, cy + sub.height + Math.round(width * 0.016));
    if (f.note) {
      ctx.fillStyle = 'rgba(255,255,255,.6)';
      ctx.font = `400 ${Math.round(width * 0.013)}px Inter, system-ui, sans-serif`;
      ctx.fillText(f.note.slice(0, 90), cx + 4, cy + sub.height + Math.round(width * 0.033));
    }
  }
  state.frame = keepFrame; state.selection = keepSel; state.trails = keepTrails;
  c.toBlob((b) => download(b, `${fileBase()}-guion.png`), 'image/png');
}

/* ---------------- video ---------------- */

const VIDEO_TYPES = [
  ['video/mp4;codecs=avc1.42E01E', 'mp4'],
  ['video/mp4', 'mp4'],
  ['video/webm;codecs=vp9', 'webm'],
  ['video/webm;codecs=vp8', 'webm'],
  ['video/webm', 'webm'],
];

export function videoFormat() {
  if (typeof MediaRecorder === 'undefined') return null;
  return VIDEO_TYPES.find(([type]) => MediaRecorder.isTypeSupported(type)) || null;
}

export function exportVideo({ width = 1600, fps = 30, hold = 700, brand = true, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    if (state.doc.frames.length < 2) { reject(new Error(t('toast.needFrames'))); return; }
    const fmt = videoFormat();
    if (!fmt) { reject(new Error('MediaRecorder')); return; }
    const [mimeType, ext] = fmt;
    const c = offscreen(width);
    const ctx = opaque(c);
    const rect = boardRect(c.width, c.height, state.doc.pitch, Math.round(width * 0.02));
    const stream = c.captureStream(fps);
    const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType.split(';')[0] });
      download(blob, `${fileBase()}.${ext}`);
      resolve({ blob, ext });
    };

    const frames = state.doc.frames;
    const total = frames.slice(0, -1).reduce((a, f) => a + (f.duration || 1000), 0);
    const keep = { frame: state.frame, progress: state.progress, sel: state.selection, playing: state.playing };
    state.selection = [];
    state.recording = true;

    const t0 = performance.now();
    rec.start();
    const step = () => {
      const elapsed = performance.now() - t0;
      let acc = 0, idx = frames.length - 1, prog = 0;
      if (elapsed < total) {
        for (let i = 0; i < frames.length - 1; i++) {
          const d = frames[i].duration || 1000;
          if (elapsed < acc + d) { idx = i; prog = (elapsed - acc) / d; break; }
          acc += d;
        }
      }
      paint(ctx, c.width, c.height, { rect, frameIndex: idx, progress: prog, forcePlay: true, ghost: false });
      stamp(ctx, c.width, c.height, brand);
      if (onProgress) onProgress(Math.min(1, elapsed / (total + hold)));
      if (elapsed < total + hold) requestAnimationFrame(step);
      else {
        state.recording = false;
        state.frame = keep.frame; state.progress = keep.progress;
        state.selection = keep.sel; state.playing = keep.playing;
        rec.stop();
      }
    };
    requestAnimationFrame(step);
  });
}

/* ---------------- thumbnails ---------------- */

export function thumbnail(width = 320) {
  const box = boxSize(state.doc.pitch);
  const c = document.createElement('canvas');
  c.width = width;
  c.height = Math.round(width / (box.w / box.h));
  const keep = state.selection;
  state.selection = [];
  paint(opaque(c), c.width, c.height, { rect: boardRect(c.width, c.height, state.doc.pitch, 2), ghost: false });
  state.selection = keep;
  try { return c.toDataURL('image/jpeg', 0.6); } catch { return null; }
}

/* ---------------- files ---------------- */

export function exportJSON() {
  const blob = new Blob([JSON.stringify(state.doc, null, 2)], { type: 'application/json' });
  download(blob, `${fileBase()}.micharlatac.json`);
}

export function importJSON(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const doc = JSON.parse(fr.result);
        if (!doc.frames) throw new Error('bad file');
        loadDoc(doc);
        resolve(doc);
      } catch (e) { reject(e); }
    };
    fr.onerror = reject;
    fr.readAsText(file);
  });
}

/* ---------------- share links ---------------- */

const b64url = {
  enc: (bytes) => {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  dec: (s) => {
    const b = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(b, (ch) => ch.charCodeAt(0));
  },
};

async function deflate(str) {
  if (typeof CompressionStream === 'undefined') return null;
  const cs = new CompressionStream('deflate-raw');
  const buf = await new Response(new Blob([str]).stream().pipeThrough(cs)).arrayBuffer();
  return new Uint8Array(buf);
}

async function inflate(bytes) {
  const ds = new DecompressionStream('deflate-raw');
  const buf = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();
  return new TextDecoder().decode(buf);
}

export async function shareLink() {
  const json = JSON.stringify(state.doc);
  const packed = await deflate(json);
  const payload = packed ? `z${b64url.enc(packed)}` : `r${b64url.enc(new TextEncoder().encode(json))}`;
  const base = location.origin + location.pathname.replace(/\/(index\.html)?$/, '/');
  return `${base}#/b/${payload}`;
}

export async function readShareLink() {
  const m = location.hash.match(/#\/b\/([^&?]+)/) || location.hash.match(/[#&]p=([^&]+)/);
  if (!m) return null;
  try {
    const raw = m[1];
    const bytes = b64url.dec(raw.slice(1));
    const json = raw[0] === 'z' ? await inflate(bytes) : new TextDecoder().decode(bytes);
    const doc = JSON.parse(json);
    if (!doc.frames) return null;
    loadDoc(doc);
    return doc;
  } catch { return null; }
}
