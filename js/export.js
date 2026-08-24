// export.js - PNG, printable sheet, WebM video, JSON files and share links.

import { state, loadDoc } from './state.js';
import { paint, boardRect } from './render.js';
import { boxSize } from './pitch.js';

// When the page runs inside a sandboxed viewer that blocks plain downloads,
// hand the file to the host instead. In a normal browser this resolves to null
// straight away and we fall back to the usual anchor download.
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

const slug = (s) => (s || 'play').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'play';

function offscreen(width) {
  const box = boxSize(state.doc.pitch);
  const pad = Math.round(width * 0.02);
  const h = Math.round((width - pad * 2) / (box.w / box.h)) + pad * 2;
  const c = document.createElement('canvas');
  c.width = width; c.height = h;
  return c;
}

// Opaque context: smaller files and no alpha channel in the recorded video.
const opaque = (c) => c.getContext('2d', { alpha: false });

export function exportPNG(width = 2000) {
  const c = offscreen(width);
  const ctx = opaque(c);
  const wasSel = state.selection; state.selection = null;
  const wasTrails = state.trails; state.trails = false;
  paint(ctx, c.width, c.height, { rect: boardRect(c.width, c.height, state.doc.pitch, Math.round(width * 0.02)) });
  stamp(ctx, c);
  state.selection = wasSel; state.trails = wasTrails;
  c.toBlob((b) => download(b, `${slug(state.doc.title)}-frame${state.frame + 1}.png`), 'image/png');
}

function stamp(ctx, c) {
  const t = state.doc.title || '';
  if (!t) return;
  ctx.save();
  ctx.font = `600 ${Math.round(c.width * 0.018)}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  ctx.textBaseline = 'top';
  ctx.fillText(t, Math.round(c.width * 0.022), Math.round(c.width * 0.014));
  ctx.restore();
}

/** Contact sheet: every frame of the play on one printable image. */
export function exportSheet(width = 2200) {
  const doc = state.doc;
  const n = doc.frames.length;
  const cols = n === 1 ? 1 : n <= 4 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  const box = boxSize(doc.pitch);
  const gap = Math.round(width * 0.018);
  const headH = Math.round(width * 0.05);
  const cellW = Math.round((width - gap * (cols + 1)) / cols);
  const cellH = Math.round(cellW / (box.w / box.h)) + Math.round(width * 0.03);
  const c = document.createElement('canvas');
  c.width = width;
  c.height = headH + rows * (cellH + gap) + gap;
  const ctx = opaque(c);
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#fff';
  ctx.font = `700 ${Math.round(width * 0.026)}px Inter, system-ui, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText(doc.title || 'Tactical play', gap * 1.5, headH / 2 + 4);

  const keepFrame = state.frame, keepSel = state.selection, keepTrails = state.trails;
  state.selection = null;
  state.trails = true;
  for (let i = 0; i < n; i++) {
    const cx = gap + (i % cols) * (cellW + gap);
    const cy = headH + Math.floor(i / cols) * (cellH + gap);
    state.frame = i;
    const sub = document.createElement('canvas');
    sub.width = cellW; sub.height = Math.round(cellW / (box.w / box.h));
    paint(sub.getContext('2d'), sub.width, sub.height, { rect: boardRect(sub.width, sub.height, doc.pitch, 2) });
    ctx.drawImage(sub, cx, cy);
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.font = `600 ${Math.round(width * 0.016)}px Inter, system-ui, sans-serif`;
    const note = doc.frames[i].note ? ` - ${doc.frames[i].note}` : '';
    ctx.fillText(`${i + 1}${note}`, cx + 4, cy + sub.height + Math.round(width * 0.015));
  }
  state.frame = keepFrame; state.selection = keepSel; state.trails = keepTrails;
  c.toBlob((b) => download(b, `${slug(doc.title)}-playbook.png`), 'image/png');
}

/** Record the animation to a WebM video file using the browser's own encoder. */
export function exportVideo({ width = 1600, fps = 30, hold = 700, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    if (state.doc.frames.length < 2) { reject(new Error('Add at least two frames to record an animation.')); return; }
    if (typeof MediaRecorder === 'undefined') { reject(new Error('This browser cannot record video. Try Chrome or Edge.')); return; }
    const c = offscreen(width);
    const ctx = opaque(c);
    const rect = boardRect(c.width, c.height, state.doc.pitch, Math.round(width * 0.02));
    const stream = c.captureStream(fps);
    const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    const mimeType = types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
    const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
    const chunks = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      download(blob, `${slug(state.doc.title)}.webm`);
      resolve(blob);
    };

    const frames = state.doc.frames;
    const total = frames.slice(0, -1).reduce((a, f) => a + (f.duration || 1000), 0);
    const keepFrame = state.frame, keepProgress = state.progress, keepSel = state.selection, keepPlaying = state.playing;
    state.selection = null;
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
      paint(ctx, c.width, c.height, { rect, frameIndex: idx, progress: prog, forcePlay: true });
      stamp(ctx, c);
      if (onProgress) onProgress(Math.min(1, elapsed / (total + hold)));
      if (elapsed < total + hold) requestAnimationFrame(step);
      else {
        state.recording = false;
        state.frame = keepFrame; state.progress = keepProgress; state.selection = keepSel; state.playing = keepPlaying;
        rec.stop();
      }
    };
    requestAnimationFrame(step);
  });
}

/* ---------- files ---------- */

export function exportJSON() {
  const blob = new Blob([JSON.stringify(state.doc, null, 2)], { type: 'application/json' });
  download(blob, `${slug(state.doc.title)}.tboard.json`);
}

export function importJSON(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const doc = JSON.parse(fr.result);
        if (!doc.frames) throw new Error('Not a tactical board file');
        loadDoc(doc);
        resolve(doc);
      } catch (e) { reject(e); }
    };
    fr.onerror = reject;
    fr.readAsText(file);
  });
}

/* ---------- share links ---------- */

const b64url = {
  enc: (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
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
  const url = `${location.origin}${location.pathname}#p=${payload}`;
  return url;
}

export async function readShareLink() {
  const m = location.hash.match(/[#&]p=([^&]+)/);
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
