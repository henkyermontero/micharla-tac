// state.js - document model, frames, history, persistence.

import { FORMATIONS, mirror, defaultNumbers } from './formations.js';
import { toPitchFrac, fromPitchFrac } from './pitch.js';

let seq = 1;
export const uid = (p = 'o') => `${p}${(seq++).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

export const KINDS = {
  player:    { r: 1.0, label: 'Player' },
  keeper:    { r: 1.0, label: 'Goalkeeper' },
  ball:      { r: 0.55, label: 'Ball' },
  cone:      { r: 0.5, label: 'Cone' },
  mannequin: { r: 0.55, label: 'Mannequin' },
  minigoal:  { r: 0.9, label: 'Mini goal' },
  flag:      { r: 0.5, label: 'Pole' },
  ladder:    { r: 0.9, label: 'Ladder' },
  hurdle:    { r: 0.6, label: 'Hurdle' },
  label:     { r: 0.8, label: 'Text' },
};

export function emptyFrame(duration = 1000) {
  return { id: uid('f'), duration, pos: {}, shapes: [], note: '' };
}

export function newDoc(pitch = 'full') {
  return {
    v: 2,
    title: 'Untitled play',
    pitch,
    theme: 'grass',
    stripes: true,
    teams: {
      A: { name: 'Home', color: '#e63946', ink: '#ffffff' },
      B: { name: 'Away', color: '#1d6fe0', ink: '#ffffff' },
    },
    objects: [],
    frames: [emptyFrame()],
  };
}

export const state = {
  doc: newDoc(),
  frame: 0,
  tool: 'select',
  color: '#ffdd57',
  width: 0.55,
  markerScale: 1,
  selection: null,      // { type:'object'|'shape', id }
  playing: false,
  progress: 0,          // 0..1 inside the current transition
  loop: true,
  speed: 1,
  onion: false,
  trails: true,
  showNumbers: true,
  showNames: true,
  recording: false,
  dirty: true,
};

/* ---------------- history ---------------- */

const past = [], future = [];
let pending = null;

export function snapshot() {
  pending = JSON.stringify(state.doc);
}

export function commit() {
  if (pending === null) return;
  if (pending !== JSON.stringify(state.doc)) {
    past.push(pending);
    if (past.length > 80) past.shift();
    future.length = 0;
  }
  pending = null;
}

export function edit(fn) {
  snapshot();
  const out = fn();
  commit();
  state.dirty = true;
  return out;
}

export function undo() {
  if (!past.length) return false;
  future.push(JSON.stringify(state.doc));
  state.doc = JSON.parse(past.pop());
  clampFrame();
  state.dirty = true;
  return true;
}

export function redo() {
  if (!future.length) return false;
  past.push(JSON.stringify(state.doc));
  state.doc = JSON.parse(future.pop());
  clampFrame();
  state.dirty = true;
  return true;
}

export const canUndo = () => past.length > 0;
export const canRedo = () => future.length > 0;

export function clampFrame() {
  state.frame = Math.max(0, Math.min(state.frame, state.doc.frames.length - 1));
  state.selection = null;
}

/* ---------------- objects ---------------- */

export function frame(i = state.frame) {
  return state.doc.frames[Math.max(0, Math.min(i, state.doc.frames.length - 1))];
}

export function posOf(obj, i = state.frame) {
  return frame(i).pos[obj.id];
}

export function setPos(id, x, y, i = state.frame) {
  const f = frame(i);
  const p = f.pos[id] || (f.pos[id] = { x, y });
  p.x = Math.max(-0.04, Math.min(1.04, x));
  p.y = Math.max(-0.06, Math.min(1.06, y));
}

// Add an object and give it a position on every frame (so it never vanishes).
export function addObject(o, x, y) {
  const obj = Object.assign({ id: uid(), kind: 'player', team: null, num: '', name: '', color: null }, o);
  state.doc.objects.push(obj);
  state.doc.frames.forEach((f) => { f.pos[obj.id] = { x, y }; });
  return obj;
}

export function removeObject(id) {
  state.doc.objects = state.doc.objects.filter((o) => o.id !== id);
  state.doc.frames.forEach((f) => { delete f.pos[id]; });
}

export function teamPlayers(team) {
  return state.doc.objects.filter((o) => o.team === team && (o.kind === 'player' || o.kind === 'keeper'));
}

/* ---------------- formations ---------------- */

export function applyFormation(team, size, name) {
  const pts = FORMATIONS[size] && FORMATIONS[size][name];
  if (!pts) return;
  // Formation points are fractions of the pitch, so they land correctly on any
  // orientation or half-pitch view.
  const coords = (team === 'A' ? pts : mirror(pts)).map(([fx, fy]) => fromPitchFrac(state.doc.pitch, fx, fy));
  const nums = defaultNumbers(size, name);
  const existing = teamPlayers(team);
  // reuse markers when the count matches so numbers and names survive
  const keep = Math.min(existing.length, coords.length);
  for (let i = keep; i < existing.length; i++) removeObject(existing[i].id);
  for (let i = 0; i < coords.length; i++) {
    const [x, y] = coords[i];
    if (i < keep) {
      const o = existing[i];
      o.kind = i === 0 ? 'keeper' : 'player';
      state.doc.frames.forEach((f) => { f.pos[o.id] = { x, y }; });
    } else {
      addObject({ kind: i === 0 ? 'keeper' : 'player', team, num: String(nums[i] ?? i + 1) }, x, y);
    }
  }
  state.doc.teams[team].formation = name;
}

/** Keep markers and drawings on the same spot of the pitch when the view changes. */
export function remapForPitch(oldKey, newKey) {
  if (oldKey === newKey) return;
  const conv = (x, y) => {
    const [fx, fy] = toPitchFrac(oldKey, x, y);
    return fromPitchFrac(newKey, fx, fy);
  };
  for (const f of state.doc.frames) {
    for (const p of Object.values(f.pos)) {
      const [x, y] = conv(p.x, p.y);
      p.x = x; p.y = y;
    }
    for (const sh of f.shapes || []) {
      sh.pts = sh.pts.map(([x, y]) => conv(x, y));
    }
  }
}

/* ---------------- frames ---------------- */

export function addFrame(afterIndex = state.frame) {
  const src = state.doc.frames[afterIndex];
  const f = emptyFrame(src ? src.duration : 1000);
  if (src) {
    for (const [id, p] of Object.entries(src.pos)) f.pos[id] = { x: p.x, y: p.y, h: p.h };
    f.shapes = JSON.parse(JSON.stringify(src.shapes || [])).map((s) => ({ ...s, id: uid('s') }));
  }
  state.doc.frames.splice(afterIndex + 1, 0, f);
  state.frame = afterIndex + 1;
  return f;
}

export function duplicateFrame(i = state.frame) { return addFrame(i); }

export function deleteFrame(i = state.frame) {
  if (state.doc.frames.length <= 1) return;
  state.doc.frames.splice(i, 1);
  clampFrame();
}

export function moveFrame(from, to) {
  if (to < 0 || to >= state.doc.frames.length) return;
  const [f] = state.doc.frames.splice(from, 1);
  state.doc.frames.splice(to, 0, f);
  state.frame = to;
}

/* ---------------- shapes ---------------- */

export function addShape(shape) {
  const s = Object.assign({ id: uid('s') }, shape);
  frame().shapes.push(s);
  return s;
}

export function removeShape(id) {
  const f = frame();
  f.shapes = f.shapes.filter((s) => s.id !== id);
}

/* ---------------- persistence ---------------- */

const LS_KEY = 'tacticalboard.library.v2';
const LS_LAST = 'tacticalboard.last.v2';

export function library() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}

export function saveToLibrary(name) {
  const list = library();
  const entry = {
    id: state.doc.id || (state.doc.id = uid('b')),
    name: name || state.doc.title || 'Untitled play',
    at: Date.now(),
    doc: JSON.parse(JSON.stringify(state.doc)),
  };
  entry.doc.title = entry.name;
  state.doc.title = entry.name;
  const i = list.findIndex((e) => e.id === entry.id);
  if (i >= 0) list[i] = entry; else list.unshift(entry);
  localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, 60)));
  return entry;
}

export function deleteFromLibrary(id) {
  localStorage.setItem(LS_KEY, JSON.stringify(library().filter((e) => e.id !== id)));
}

export function autosave() {
  try { localStorage.setItem(LS_LAST, JSON.stringify(state.doc)); } catch {}
}

export function restoreAutosave() {
  try {
    const raw = localStorage.getItem(LS_LAST);
    if (!raw) return false;
    const doc = JSON.parse(raw);
    if (!doc || !doc.frames) return false;
    state.doc = doc;
    clampFrame();
    return true;
  } catch { return false; }
}

export function loadDoc(doc) {
  state.doc = doc;
  if (!state.doc.frames || !state.doc.frames.length) state.doc.frames = [emptyFrame()];
  state.frame = 0;
  state.selection = null;
  state.dirty = true;
  past.length = 0; future.length = 0;
}
