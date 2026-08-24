// state.js - document model, frames, selection, history, persistence.

import { FORMATIONS, mirror, defaultNumbers } from './formations.js';
import { toPitchFrac, fromPitchFrac } from './pitch.js';

let seq = 1;
export const uid = (p = 'o') => `${p}${(seq++).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

export const KINDS = {
  player:    { r: 1.0 },
  keeper:    { r: 1.0 },
  referee:   { r: 0.88 },
  ball:      { r: 0.55 },
  cone:      { r: 0.5 },
  disc:      { r: 0.46 },
  mannequin: { r: 0.55 },
  minigoal:  { r: 0.9 },
  flag:      { r: 0.5 },
  ladder:    { r: 0.9 },
  hurdle:    { r: 0.6 },
  label:     { r: 0.8 },
};

export const PLAYER_KINDS = ['player', 'keeper'];

export function emptyFrame(duration = 1000) {
  return { id: uid('f'), duration, easing: 'ease', label: '', note: '', pos: {}, shapes: [] };
}

export function newDoc(pitch = 'full') {
  return {
    v: 3,
    app: 'pitchlab',
    title: '',
    pitch,
    theme: 'grass',
    stripes: true,
    thirds: false,
    grid: false,
    teams: {
      A: { name: '', color: '#e63946', ink: '#ffffff' },
      B: { name: '', color: '#1d6fe0', ink: '#ffffff' },
    },
    objects: [],
    shapes: [],          // drawings shown on every frame of the clip
    frames: [emptyFrame()],
  };
}

export const state = {
  doc: newDoc(),
  frame: 0,
  tool: 'select',
  place: null,           // { kind, team, color } while the placement tool is armed
  color: '#ffdd57',
  width: 0.55,
  opacity: 1,
  fillOpacity: 0.18,
  dash: false,
  markerScale: 1,
  selection: [],         // [{ type:'object'|'shape', id }]
  snap: true,
  animateMode: false,
  playing: false,
  progress: 0,
  loop: true,
  speed: 1,
  onion: false,
  trails: true,
  showNumbers: true,
  showNames: true,
  recording: false,
  guides: [],
};

/* ---------------- history ---------------- */

const past = [], future = [];
let pending = null;

export function snapshot() { pending = JSON.stringify(state.doc); }

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
  return out;
}

export function undo() {
  if (!past.length) return false;
  future.push(JSON.stringify(state.doc));
  state.doc = JSON.parse(past.pop());
  clampFrame();
  return true;
}

export function redo() {
  if (!future.length) return false;
  past.push(JSON.stringify(state.doc));
  state.doc = JSON.parse(future.pop());
  clampFrame();
  return true;
}

export const canUndo = () => past.length > 0;
export const canRedo = () => future.length > 0;

export function clampFrame() {
  state.frame = Math.max(0, Math.min(state.frame, state.doc.frames.length - 1));
  state.selection = [];
}

/* ---------------- frames and positions ---------------- */

export function frame(i = state.frame) {
  return state.doc.frames[Math.max(0, Math.min(i, state.doc.frames.length - 1))];
}

/** Drawings visible on a frame: clip-wide ones plus that frame's own. */
export function shapesOf(i = state.frame) {
  return [...(state.doc.shapes || []), ...frame(i).shapes];
}

export function findShape(id) {
  return (state.doc.shapes || []).find((s) => s.id === id) || frame().shapes.find((s) => s.id === id);
}

export function setPos(id, x, y, i = state.frame) {
  const f = frame(i);
  const p = f.pos[id] || (f.pos[id] = { x, y });
  p.x = Math.max(-0.08, Math.min(1.08, x));
  p.y = Math.max(-0.1, Math.min(1.1, y));
  return p;
}

export function posOf(id, i = state.frame) { return frame(i).pos[id]; }

export function addObject(o, x, y) {
  const obj = Object.assign({
    id: uid(), kind: 'player', team: null, num: '', name: '', color: null,
    size: 1, rot: 0, hideNum: false, locked: false,
  }, o);
  state.doc.objects.push(obj);
  state.doc.frames.forEach((f) => { f.pos[obj.id] = { x, y }; });
  return obj;
}

export function removeObject(id) {
  state.doc.objects = state.doc.objects.filter((o) => o.id !== id);
  state.doc.frames.forEach((f) => { delete f.pos[id]; });
}

export function duplicateObject(id) {
  const o = state.doc.objects.find((x) => x.id === id);
  if (!o) return null;
  const copy = Object.assign({}, o, { id: uid() });
  state.doc.objects.push(copy);
  state.doc.frames.forEach((f) => {
    const p = f.pos[id];
    if (p) f.pos[copy.id] = { x: p.x + 0.03, y: p.y + 0.03 };
  });
  return copy;
}

export function bringForward(id) {
  const i = state.doc.objects.findIndex((o) => o.id === id);
  if (i < 0 || i === state.doc.objects.length - 1) return;
  const [o] = state.doc.objects.splice(i, 1);
  state.doc.objects.push(o);
}

export function sendBack(id) {
  const i = state.doc.objects.findIndex((o) => o.id === id);
  if (i <= 0) return;
  const [o] = state.doc.objects.splice(i, 1);
  state.doc.objects.unshift(o);
}

export function objectById(id) { return state.doc.objects.find((o) => o.id === id); }

export function teamPlayers(team) {
  return state.doc.objects.filter((o) => o.team === team && PLAYER_KINDS.includes(o.kind));
}

/* ---------------- selection ---------------- */

export const selection = {
  clear() { state.selection = []; },
  set(type, id) { state.selection = [{ type, id }]; },
  add(type, id) {
    if (!selection.has(id)) state.selection.push({ type, id });
  },
  toggle(type, id) {
    const i = state.selection.findIndex((s) => s.id === id);
    if (i >= 0) state.selection.splice(i, 1);
    else state.selection.push({ type, id });
  },
  has(id) { return state.selection.some((s) => s.id === id); },
  objects() {
    return state.selection.filter((s) => s.type === 'object').map((s) => objectById(s.id)).filter(Boolean);
  },
  shapes() {
    return state.selection.filter((s) => s.type === 'shape').map((s) => findShape(s.id)).filter(Boolean);
  },
  single() { return state.selection.length === 1 ? state.selection[0] : null; },
};

/* ---------------- formations ---------------- */

export function applyFormation(team, size, name) {
  const pts = FORMATIONS[size] && FORMATIONS[size][name];
  if (!pts) return;
  const coords = (team === 'A' ? pts : mirror(pts)).map(([fx, fy]) => fromPitchFrac(state.doc.pitch, fx, fy));
  const nums = defaultNumbers(size, name);
  const existing = teamPlayers(team);
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

/** Mirror a team across the pitch on the current frame. */
export function mirrorTeam(team) {
  const f = frame();
  for (const o of state.doc.objects) {
    if (o.team !== team) continue;
    const p = f.pos[o.id];
    if (!p) continue;
    const [fx, fy] = toPitchFrac(state.doc.pitch, p.x, p.y);
    const [x, y] = fromPitchFrac(state.doc.pitch, 1 - fx, 1 - fy);
    p.x = x; p.y = y;
  }
}

export function nextNumber(team) {
  const used = new Set(teamPlayers(team).map((o) => parseInt(o.num, 10)).filter((n) => !isNaN(n)));
  for (let n = 1; n <= 40; n++) if (!used.has(n)) return String(n);
  return '';
}

/* ---------------- frames ---------------- */

export function addFrame(afterIndex = state.frame) {
  const src = state.doc.frames[afterIndex];
  const f = emptyFrame(src ? src.duration : 1000);
  if (src) {
    f.easing = src.easing;
    for (const [id, p] of Object.entries(src.pos)) f.pos[id] = { x: p.x, y: p.y };
    f.shapes = JSON.parse(JSON.stringify(src.shapes || [])).map((s) => ({ ...s, id: uid('s') }));
  }
  state.doc.frames.splice(afterIndex + 1, 0, f);
  state.frame = afterIndex + 1;
  return f;
}

export const duplicateFrame = (i = state.frame) => addFrame(i);

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
  const s = Object.assign({
    id: uid('s'), color: state.color, width: state.width,
    opacity: state.opacity, fill: state.fillOpacity, dash: false, scope: 'frame',
  }, shape);
  if (s.scope === 'clip') (state.doc.shapes || (state.doc.shapes = [])).push(s);
  else frame().shapes.push(s);
  return s;
}

export function removeShape(id) {
  state.doc.shapes = (state.doc.shapes || []).filter((s) => s.id !== id);
  frame().shapes = frame().shapes.filter((s) => s.id !== id);
}

export function setShapeScope(id, scope) {
  const s = findShape(id);
  if (!s || s.scope === scope) return;
  removeShape(id);
  s.scope = scope;
  if (scope === 'clip') (state.doc.shapes || (state.doc.shapes = [])).push(s);
  else frame().shapes.push(s);
}

export function clearDrawings(allFrames) {
  if (allFrames) {
    state.doc.shapes = [];
    state.doc.frames.forEach((f) => { f.shapes = []; });
  } else {
    frame().shapes = [];
  }
}

/* ---------------- pitch changes ---------------- */

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
    for (const sh of f.shapes || []) remapShape(sh, conv);
  }
  for (const sh of state.doc.shapes || []) remapShape(sh, conv);
}

function remapShape(sh, conv) {
  sh.pts = sh.pts.map(([x, y]) => conv(x, y));
  if (sh.ctrl) sh.ctrl = conv(sh.ctrl[0], sh.ctrl[1]);
}

/* ---------------- persistence ---------------- */

const LS_KEY = 'pitchlab.library.v1';
const LS_LAST = 'pitchlab.last.v1';

export function library() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}

function writeLibrary(list) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, 80))); } catch {}
}

export function saveToLibrary(name, thumb) {
  const list = library();
  const entry = {
    id: state.doc.id || (state.doc.id = uid('b')),
    name: name || state.doc.title || '',
    at: Date.now(),
    thumb: thumb || null,
    doc: JSON.parse(JSON.stringify(state.doc)),
  };
  entry.doc.title = entry.name;
  state.doc.title = entry.name;
  const i = list.findIndex((e) => e.id === entry.id);
  if (i >= 0) list[i] = entry; else list.unshift(entry);
  writeLibrary(list);
  return entry;
}

export function deleteFromLibrary(id) { writeLibrary(library().filter((e) => e.id !== id)); }

export function duplicateInLibrary(id) {
  const list = library();
  const e = list.find((x) => x.id === id);
  if (!e) return;
  const copy = JSON.parse(JSON.stringify(e));
  copy.id = uid('b');
  copy.at = Date.now();
  copy.name = `${e.name} (2)`;
  copy.doc.id = copy.id;
  copy.doc.title = copy.name;
  list.unshift(copy);
  writeLibrary(list);
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
    loadDoc(doc);
    return true;
  } catch { return false; }
}

/** Load a document, filling in anything an older file did not have. */
export function loadDoc(doc) {
  state.doc = doc;
  const d = state.doc;
  if (!d.frames || !d.frames.length) d.frames = [emptyFrame()];
  if (!d.shapes) d.shapes = [];
  if (!d.teams) d.teams = newDoc().teams;
  d.objects = (d.objects || []).map((o) => Object.assign({ size: 1, rot: 0, hideNum: false, locked: false }, o));
  d.frames.forEach((f) => {
    f.shapes = f.shapes || [];
    f.easing = f.easing || 'ease';
    if (f.label === undefined) f.label = '';
  });
  state.frame = 0;
  state.selection = [];
  past.length = 0;
  future.length = 0;
}
