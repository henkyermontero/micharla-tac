// main.js - app wiring: canvas loop, tools, palette, panels, timeline, shortcuts.

import { PITCHES, THEMES } from './pitch.js';
import { FORMATIONS } from './formations.js';
import { t, applyI18n, setLang, getLang, LANGS } from './i18n.js';
import {
  state, edit, undo, redo, canUndo, canRedo, frame, shapesOf, findShape, addFrame,
  deleteFrame, duplicateFrame, addObject, removeObject, removeShape, teamPlayers,
  applyFormation, mirrorTeam, setPos, newDoc, loadDoc, remapForPitch, selection,
  objectById, duplicateObject, bringForward, sendBack, setShapeScope, clearDrawings,
  library, saveToLibrary, deleteFromLibrary, duplicateInLibrary, autosave, restoreAutosave,
  clampFrame, nextNumber,
} from './state.js';
import { paint, boardRect, markerRadius } from './render.js';
import { attach, isDrawTool } from './interact.js';
import { view, applyView, resetView, zoomAt, clampPan, MIN_SCALE, MAX_SCALE } from './view.js';
import { play, stop, toggle, totalDuration } from './animate.js';
import { attachPresent } from './present.js';
import {
  exportPNG, exportSVG, exportSheet, exportVideo, exportJSON, importJSON,
  shareLink, readShareLink, thumbnail, videoFormat,
} from './export.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const canvas = $('#board');
const ctx = canvas.getContext('2d');
const stage = $('#stage');

let base = { x: 0, y: 0, w: 10, h: 10 };
let rect = base;
let draft = null;
let draftOpen = false;
let marquee = null;
let emptyDismissed = false;
let present = null;   // se crea en wire(); computeRects y render lo consultan antes

/* ================= tool + palette definitions ================= */

const TOOLS = [
  { id: 'select', key: 'V', icon: '<path d="M5 3l14 8.2-6.1 1.4L10.2 19z" fill="currentColor"/>' },
  { id: 'pass', key: 'P', icon: '<path d="M4 19L18 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M19.6 4.5l-.7 6-4.8-1.6z" fill="currentColor"/>' },
  { id: 'run', key: 'R', icon: '<path d="M4 19L18 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="3.4 3"/><path d="M19.6 4.5l-.7 6-4.8-1.6z" fill="currentColor"/>' },
  { id: 'dribble', key: 'D', icon: '<path d="M3 15c2.4-4.4 4-1.2 5.6-3.4S11 6.6 13.4 9.4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M19.6 4.5l-.7 6-4.8-1.6z" fill="currentColor"/>' },
  { id: 'shot', key: 'S', icon: '<path d="M4 19L17 7" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/><path d="M20 4l-.9 6.6-5.3-1.8z" fill="currentColor"/>' },
  { id: 'line', key: 'L', icon: '<path d="M4 20L20 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' },
  { id: 'pen', key: 'F', icon: '<path d="M4 18.5l1-3.4L15.4 4.7a1.9 1.9 0 0 1 2.7 2.7L7.7 17.8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' },
  { id: 'zone', key: 'Z', icon: '<rect x="4" y="6" width="16" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-dasharray="3.6 2.6"/>' },
  { id: 'ellipse', key: 'C', icon: '<ellipse cx="12" cy="12" rx="8.4" ry="6.2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-dasharray="3.6 2.6"/>' },
  { id: 'poly', key: 'G', icon: '<path d="M5 9l6-4 8 4-2 9-9 1z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-dasharray="3.4 2.6"/>' },
  { id: 'block', key: 'B', icon: '<path d="M4 19L16 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M13.8 4.6l5.6 5.6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>' },
  { id: 'spot', key: 'H', icon: '<circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M5 5l1.8 1.8M17.2 17.2L19 19M19 5l-1.8 1.8M6.8 17.2L5 19" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' },
  { id: 'text', key: 'T', icon: '<path d="M5 6h14M12 6v13" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>' },
  { id: 'erase', key: 'E', icon: '<path d="M8 20h11M6.5 17.5l-2-2a1.8 1.8 0 0 1 0-2.6l8-8a1.8 1.8 0 0 1 2.6 0l4 4a1.8 1.8 0 0 1 0 2.6l-7 7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' },
];

const COLORS = ['#ffdd57', '#ffffff', '#39d98a', '#ff6b6b', '#4dabf7', '#ff922b', '#c77dff', '#0b0f14'];

const GLYPHS = {
  // Balon clasico: pentagono al centro y los cinco parches del borde, la misma
  // figura que dibuja render.js en la cancha. Con radios en vez de parches se
  // leia como un volante de auto; comparado en pantalla al tamano real.
  ball: '<circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 9.05L14.81 11.09L13.73 14.39L10.27 14.39L9.19 11.09ZM17.25 6.56L16.6 8.55L14.51 8.55L13.86 6.56L15.56 5.33ZM18.8 15.31L16.71 15.31L16.06 13.32L17.75 12.09L19.45 13.32ZM10.95 19.49L10.31 17.5L12 16.27L13.69 17.5L13.05 19.49ZM4.55 13.32L6.25 12.09L7.94 13.32L7.29 15.31L5.2 15.31ZM8.44 5.33L10.14 6.56L9.49 8.55L7.4 8.55L6.75 6.56Z" fill="currentColor"/>',
  cone: '<path d="M12 5l5 13H7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M5 19h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  disc: '<ellipse cx="12" cy="13" rx="8" ry="4" fill="none" stroke="currentColor" stroke-width="1.8"/>',
  mannequin: '<circle cx="12" cy="7" r="2.6" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 19l1.4-7h5.2L16 19z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  goal: '<path d="M2.5 18.5V7.5h19v11" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M7.3 7.5v11M12 7.5v11M16.7 7.5v11M2.5 11.2h19M2.5 14.9h19" stroke="currentColor" stroke-width=".9" opacity=".5"/>',
  minigoal: '<path d="M6.5 18.5v-7h11v7" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M10.2 11.5v7M13.8 11.5v7M6.5 15h11" stroke="currentColor" stroke-width=".9" opacity=".5"/>',
  flag: '<path d="M7 20V4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M7 4l9 3.2L7 10.6z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  ladder: '<rect x="3" y="8" width="18" height="8" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 8v8M12 8v8M16 8v8" stroke="currentColor" stroke-width="1.3"/>',
  hurdle: '<path d="M6 19V8h12v11" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  referee: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 9.5h4M12 9.5V15" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  label: '<path d="M5 7h14M12 7v11" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
};

const PALETTE = [
  { id: 'home', kind: 'player', team: 'A', label: 'place.home' },
  { id: 'away', kind: 'player', team: 'B', label: 'place.away' },
  { id: 'gkA', kind: 'keeper', team: 'A', label: 'place.gkHome' },
  { id: 'gkB', kind: 'keeper', team: 'B', label: 'place.gkAway' },
  { sep: true },
  { id: 'ball', kind: 'ball', label: 'kinds.ball' },
  { id: 'cone', kind: 'cone', label: 'kinds.cone' },
  { id: 'disc', kind: 'disc', label: 'kinds.disc' },
  { id: 'mannequin', kind: 'mannequin', label: 'kinds.mannequin' },
  { id: 'goal', kind: 'goal', label: 'kinds.goal' },
  { id: 'minigoal', kind: 'minigoal', label: 'kinds.minigoal' },
  { id: 'flag', kind: 'flag', label: 'kinds.flag' },
  { id: 'referee', kind: 'referee', label: 'kinds.referee' },
  { sep: true },
  { id: 'label', kind: 'label', label: 'kinds.label', tool: 'text' },
];

const EQUIPMENT = ['ball', 'cone', 'disc', 'mannequin', 'goal', 'minigoal', 'flag', 'ladder', 'hurdle', 'referee', 'label'];

/* ================= small helpers ================= */

let statusTimer = 0;
function status(msg, sticky) {
  const el = $('#status');
  el.innerHTML = msg;
  el.classList.add('show');
  clearTimeout(statusTimer);
  if (!sticky) statusTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

let toastTimer = 0;
function toast(msg, isErr) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast' + (isErr ? ' err' : '');
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

function askText(initial = '') {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'dlg';
    dlg.innerHTML = `<h3>${t('kinds.label')}</h3>
      <input id="ask-input" value="${initial.replace(/"/g, '&quot;')}" />
      <div class="row end" style="margin-top:14px">
        <button class="btn ghost" value="cancel">${t('lib.close')}</button>
        <button class="btn primary" value="ok">OK</button>
      </div>`;
    document.body.appendChild(dlg);
    const input = $('#ask-input', dlg);
    const done = (val) => { dlg.close(); dlg.remove(); resolve(val); };
    $$('.btn', dlg).forEach((b) => {
      b.onclick = (e) => { e.preventDefault(); done(b.value === 'ok' ? input.value.trim() : null); };
    });
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); done(null); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(input.value.trim()); });
    dlg.showModal();
    input.focus();
    input.select();
  });
}

/* ================= canvas ================= */

function computeRects() {
  // Leave room for the floating token palette so the pitch never sits under it.
  // Presenting there is no palette: the phase caption takes room above and the
  // control bar below, so the pitch is centred in what is left between them.
  const ins = present?.insets();
  if (ins) {
    // Presenting, nothing else is on the screen, so the pitch runs almost to the
    // edges: the usual 5% margin is there to breathe next to the panels.
    base = boardRect(stage.clientWidth, stage.clientHeight - ins.top - ins.bottom, state.doc.pitch, 10);
    base.y += ins.top;
  } else {
    const reserve = stage.clientWidth > 860 ? 58 : 48;
    base = boardRect(stage.clientWidth, stage.clientHeight - reserve, state.doc.pitch);
  }
  rect = applyView(base);
}

let lastW = 0, lastH = 0, lastDpr = 0;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return;            // laid out in a hidden or background tab
  lastW = w; lastH = h; lastDpr = dpr;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  computeRects();
  render();
}

/**
 * Self heal: a tab that lays out while hidden, a window moved to a screen with a
 * different pixel ratio, or any resize we did not hear about leaves the canvas
 * at the wrong size and the board paints into a corner. Catch it before drawing.
 */
function ensureCanvasSize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const w = stage.clientWidth, h = stage.clientHeight;
  if (!w || !h) return false;
  if (w === lastW && h === lastH && dpr === lastDpr) return false;
  resize();
  return true;
}

function render() {
  if (ensureCanvasSize()) return;  // resize() repaints on its own
  paint(ctx, stage.clientWidth, stage.clientHeight, {
    rect, draft: draft || undefined, draftOpen, marquee,
  });
  const n = state.doc.frames.length;
  $('#frame-badge').textContent = state.playing
    ? `${t('time.playing')} ${state.frame + 1}/${n}`
    : `${t('time.frame')} ${state.frame + 1} ${t('time.of')} ${n}`;
  $('#empty-card').hidden = emptyDismissed || state.doc.objects.length > 0 || state.playing;
  present?.refresh();   // barato: solo toca el DOM si la fase o el cuadro cambiaron
}

function viewChanged() {
  rect = applyView(base);
  $('#zoom-level').textContent = Math.round(view.scale * 100) + '%';
  render();
}

const api = {
  rect: () => rect,
  base: () => base,
  render: (d, open) => { draft = d || null; draftOpen = !!open; render(); },
  marquee: (m) => { marquee = m; render(); },
  select: (focus) => refreshInspector(focus),
  setTool,
  cancelPlace: () => setPlace(null),
  viewChanged,
  status: (key) => status(t(key)),
  askText,
  afterEdit: () => refreshAll(),
};

/* ================= rail, palette, panels ================= */

function buildRail() {
  const rail = $('#rail');
  rail.innerHTML = '';
  TOOLS.forEach((tool) => {
    const b = document.createElement('button');
    b.className = 'tool' + (state.tool === tool.id ? ' active' : '');
    b.dataset.tool = tool.id;
    b.title = `${t('tools.' + tool.id)} (${tool.key})`;
    b.setAttribute('aria-label', t('tools.' + tool.id));
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${tool.icon}</svg><span class="sc">${tool.key}</span>`;
    b.onclick = () => setTool(tool.id);
    rail.appendChild(b);
  });
  const sep = document.createElement('div');
  sep.className = 'sep';
  rail.appendChild(sep);

  const sw = document.createElement('div');
  sw.className = 'swatches';
  COLORS.forEach((c) => {
    const s = document.createElement('button');
    s.className = 'swatch' + (state.color === c ? ' active' : '');
    s.style.background = c;
    s.dataset.color = c;
    s.title = `${t('tools.colour')} ${c}`;
    s.setAttribute('aria-label', `${t('tools.colour')} ${c}`);
    s.onclick = () => {
      state.color = c;
      $$('.swatch', rail).forEach((x) => x.classList.toggle('active', x.dataset.color === c));
      const shapes = selection.shapes();
      if (shapes.length) edit(() => shapes.forEach((sh) => { sh.color = c; }));
      render();
    };
    sw.appendChild(s);
  });
  rail.appendChild(sw);

  const widths = document.createElement('div');
  widths.className = 'widths';
  [['thin', 0.35, 2], ['medium', 0.55, 4], ['thick', 0.95, 6]].forEach(([key, val, px]) => {
    const b = document.createElement('button');
    b.className = 'wbtn' + (Math.abs(state.width - val) < 0.01 ? ' active' : '');
    b.title = t('tools.' + key);
    b.setAttribute('aria-label', t('tools.' + key));
    b.innerHTML = `<i style="height:${px}px"></i>`;
    b.onclick = () => {
      state.width = val;
      [...widths.children].forEach((c) => c.classList.toggle('active', c === b));
      const shapes = selection.shapes();
      if (shapes.length) edit(() => shapes.forEach((sh) => { sh.width = val; }));
      render();
    };
    widths.appendChild(b);
  });
  rail.appendChild(widths);
}

function teamColor(team) { return state.doc.teams[team].color; }

function buildPalette() {
  const wrap = $('#palette');
  wrap.innerHTML = '';
  PALETTE.forEach((item) => {
    if (item.sep) {
      const s = document.createElement('div');
      s.className = 'p-sep';
      wrap.appendChild(s);
      return;
    }
    const b = document.createElement('button');
    b.className = 'p-item';
    b.dataset.pid = item.id;
    b.title = t(item.label);
    b.setAttribute('aria-label', t(item.label));
    if (item.team) {
      const cls = 'p-token' + (item.team === 'B' ? ' away' : '') + (item.kind === 'keeper' ? ' gk' : '');
      b.innerHTML = `<span class="${cls}" style="background:${teamColor(item.team)}">${item.kind === 'keeper' ? 'P' : ''}</span>`;
    } else {
      b.innerHTML = `<svg class="p-glyph" viewBox="0 0 24 24" aria-hidden="true">${GLYPHS[item.kind] || ''}</svg>`;
    }
    b.onclick = () => {
      if (item.tool) { setTool(item.tool); return; }
      setPlace({ kind: item.kind, team: item.team || null, id: item.id, label: item.label });
    };
    wrap.appendChild(b);
  });
}

function buildEquipment() {
  const wrap = $('#equipment');
  wrap.innerHTML = '';
  EQUIPMENT.forEach((kind) => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = t('kinds.' + kind);
    b.onclick = () => {
      if (kind === 'label') { setTool('text'); return; }
      setPlace({ kind, id: kind, label: 'kinds.' + kind });
    };
    wrap.appendChild(b);
  });
}

function setTool(id) {
  state.tool = id;
  state.place = null;
  $$('.rail .tool').forEach((b) => b.classList.toggle('active', b.dataset.tool === id));
  $$('.p-item').forEach((b) => b.classList.remove('active'));
  canvas.classList.toggle('select-mode', id === 'select');
  status(t('tools.' + id));
  render();
}

function setPlace(place) {
  state.place = place;
  $$('.p-item').forEach((b) => b.classList.toggle('active', place && b.dataset.pid === place.id));
  if (place) {
    state.tool = 'place';
    $$('.rail .tool').forEach((b) => b.classList.remove('active'));
    canvas.classList.remove('select-mode');
    status(`<strong>${t('place.active')}: ${t(place.label)}</strong> - ${t('place.hint')}`, true);
  } else {
    $('#status').classList.remove('show');
    setTool('select');
  }
}

function buildSelectOptions() {
  const pitch = $('#pitch');
  pitch.innerHTML = '';
  for (const key of Object.keys(PITCHES)) {
    const o = document.createElement('option');
    o.value = key;
    o.textContent = t('pitches.' + key);
    pitch.appendChild(o);
  }
  pitch.value = state.doc.pitch;

  const theme = $('#theme');
  theme.innerHTML = '';
  for (const key of Object.keys(THEMES)) {
    const o = document.createElement('option');
    o.value = key;
    o.textContent = t('themes.' + key);
    theme.appendChild(o);
  }
  theme.value = state.doc.theme;

  const lang = $('#lang');
  lang.innerHTML = '';
  LANGS.forEach(([code, label]) => {
    const o = document.createElement('option');
    o.value = code;
    o.textContent = label;
    lang.appendChild(o);
  });
  lang.value = getLang();
}

function teamSize() {
  const sport = (PITCHES[state.doc.pitch] || PITCHES.full).sport;
  if (sport === 'futsal') return 5;
  if (sport === 'football7') return 7;
  if (sport === 'football9') return 9;
  return 11;
}

function buildFormationOptions() {
  const size = teamSize();
  $$('.formation').forEach((sel) => {
    const team = sel.dataset.team;
    sel.innerHTML = `<option value="">${t('squad.formation')}</option>`;
    Object.keys(FORMATIONS[size] || FORMATIONS[11]).forEach((name) => {
      const o = document.createElement('option');
      o.value = name;
      o.textContent = name;
      sel.appendChild(o);
    });
    const f = state.doc.teams[team].formation;
    if (f && FORMATIONS[size] && FORMATIONS[size][f]) sel.value = f;
  });
}

function refreshRosters() {
  ['A', 'B'].forEach((team) => {
    const ul = $(`[data-roster="${team}"]`);
    ul.innerHTML = '';
    $(`[data-teamdot="${team}"]`).style.background = teamColor(team);
    teamPlayers(team).forEach((o) => {
      const li = document.createElement('li');
      li.className = selection.has(o.id) ? 'sel' : '';
      li.innerHTML = `<span class="dotnum" style="background:${o.color || teamColor(team)}">${o.num || ''}</span><span>${o.name || t(o.kind === 'keeper' ? 'kinds.keeper' : 'kinds.player')}</span>`;
      li.onclick = () => { selection.set('object', o.id); refreshInspector(true); render(); };
      ul.appendChild(li);
    });
  });
}

/* ================= inspector ================= */

function refreshInspector(focus) {
  const box = $('#inspector');
  const objs = selection.objects();
  const shapes = selection.shapes();
  const total = objs.length + shapes.length;
  box.classList.toggle('on', total > 0);
  box.innerHTML = '';
  if (!total) { refreshRosters(); return; }

  const head = document.createElement('div');
  head.className = 'insp-head';
  head.innerHTML = `<span class="insp-title">${total > 1 ? `${total} ${t('sel.many')}` : t('sel.title')}</span>`;
  const del = document.createElement('button');
  del.className = 'btn tiny danger';
  del.textContent = t('sel.delete');
  del.onclick = deleteSelection;
  head.appendChild(del);
  box.appendChild(head);

  if (total === 1 && objs.length === 1) {
    const o = objs[0];
    const isToken = o.kind === 'player' || o.kind === 'keeper';
    const r1 = document.createElement('div');
    r1.className = 'insp-row';
    if (isToken) {
      const num = document.createElement('input');
      num.className = 'mini';
      num.value = o.num ?? '';
      num.maxLength = 3;
      num.setAttribute('aria-label', t('sel.number'));
      num.oninput = () => setProp(o, 'num', num.value);
      r1.appendChild(num);
    }
    const name = document.createElement('input');
    name.value = o.name ?? '';
    name.placeholder = t('sel.name');
    name.setAttribute('aria-label', t('sel.name'));
    name.oninput = () => setProp(o, 'name', name.value);
    r1.appendChild(name);
    const color = document.createElement('input');
    color.type = 'color';
    color.value = o.color || (o.team ? teamColor(o.team) : '#ffd166');
    color.setAttribute('aria-label', t('sel.color'));
    color.oninput = () => setProp(o, 'color', color.value);
    r1.appendChild(color);
    box.appendChild(r1);

    const r2 = document.createElement('div');
    r2.className = 'insp-row';
    r2.appendChild(rangeControl(t('sel.size'), 50, 200, Math.round((o.size || 1) * 100), (v) => setProp(o, 'size', v / 100)));
    r2.appendChild(rangeControl(t('sel.rotation'), 0, 350, o.rot || 0, (v) => setProp(o, 'rot', v), 10));
    box.appendChild(r2);

    const r3 = document.createElement('div');
    r3.className = 'insp-row';
    r3.append(
      iconBtn('lock', o.locked, t('sel.lock'), () => { setProp(o, 'locked', !o.locked); refreshInspector(); }),
      iconBtn('hash', o.hideNum, t('sel.hideNumber'), () => { setProp(o, 'hideNum', !o.hideNum); refreshInspector(); }),
      iconBtn('copy', false, t('sel.duplicate'), () => {
        edit(() => { const c = duplicateObject(o.id); if (c) selection.set('object', c.id); });
        refreshAll();
      }),
      iconBtn('front', false, t('sel.front'), () => { edit(() => bringForward(o.id)); refreshAll(); }),
      iconBtn('back', false, t('sel.back'), () => { edit(() => sendBack(o.id)); refreshAll(); }),
    );
    box.appendChild(r3);
    if (focus && isToken) setTimeout(() => { $('.mini', box)?.focus(); $('.mini', box)?.select(); }, 0);
    if (focus && o.kind === 'label') {
      askText(o.name).then((v) => { if (v != null) { setProp(o, 'name', v); refreshInspector(); } });
    }
  } else if (total === 1 && shapes.length === 1) {
    const s = shapes[0];
    const r1 = document.createElement('div');
    r1.className = 'insp-row';
    const color = document.createElement('input');
    color.type = 'color';
    color.value = s.color;
    color.setAttribute('aria-label', t('sel.color'));
    color.oninput = () => { s.color = color.value; render(); queueAutosave(); };
    r1.appendChild(color);
    r1.appendChild(rangeControl(t('sel.width'), 15, 160, Math.round(s.width * 100), (v) => { s.width = v / 100; render(); }));
    r1.appendChild(rangeControl(t('sel.opacity'), 15, 100, Math.round((s.opacity ?? 1) * 100), (v) => { s.opacity = v / 100; render(); }));
    box.appendChild(r1);

    const r2 = document.createElement('div');
    r2.className = 'insp-row';
    if (['zone', 'ellipse', 'poly'].includes(s.type)) {
      r2.appendChild(rangeControl(t('sel.fill'), 0, 70, Math.round((s.fill ?? 0.18) * 100), (v) => { s.fill = v / 100; render(); }));
    }
    r2.append(
      iconBtn('dash', !!s.dash, t('sel.dash'), () => { edit(() => { s.dash = !s.dash; }); refreshInspector(); render(); }),
      iconBtn('clip', s.scope === 'clip', t('frame.persist'), () => {
        edit(() => setShapeScope(s.id, s.scope === 'clip' ? 'frame' : 'clip'));
        refreshAll();
      }),
    );
    box.appendChild(r2);
  }
  refreshRosters();
}

function rangeControl(label, min, max, value, onInput, step = 1) {
  const wrap = document.createElement('label');
  wrap.className = 'field';
  wrap.style.flex = '1';
  wrap.innerHTML = `<span style="font-size:11px;color:var(--ink-dim)">${label} <b style="color:var(--ink)">${value}</b></span>`;
  const input = document.createElement('input');
  input.type = 'range';
  input.min = min; input.max = max; input.step = step; input.value = value;
  input.className = 'range-mini';
  input.setAttribute('aria-label', label);
  input.oninput = () => {
    wrap.querySelector('b').textContent = input.value;
    onInput(parseFloat(input.value));
  };
  input.onchange = () => { queueAutosave(); refreshFrames(); };
  wrap.appendChild(input);
  return wrap;
}

const MINI_ICONS = {
  lock: '<path d="M7 11V8a5 5 0 0 1 10 0v3M5.5 11h13v9h-13z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  hash: '<path d="M6 9h12M5 15h12M10 4l-2 16M16 4l-2 16" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M16 5H5v11" fill="none" stroke="currentColor" stroke-width="1.7"/>',
  front: '<path d="M12 4l7 5-7 5-7-5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M5 15l7 5 7-5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  back: '<path d="M12 20l-7-5 7-5 7 5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M19 9l-7-5-7 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>',
  dash: '<path d="M3 12h4M10 12h4M17 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  clip: '<rect x="3" y="6" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M9 6V4h12v12h-2" fill="none" stroke="currentColor" stroke-width="1.7"/>',
};

function iconBtn(icon, on, label, onClick) {
  const b = document.createElement('button');
  b.className = 'icon-mini' + (on ? ' on' : '');
  b.title = label;
  b.setAttribute('aria-label', label);
  b.setAttribute('aria-pressed', on ? 'true' : 'false');
  b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${MINI_ICONS[icon] || ''}</svg>`;
  b.onclick = onClick;
  return b;
}

function setProp(o, prop, value) {
  o[prop] = value;
  render();
  refreshRosters();
  refreshFrames();
  queueAutosave();
}

function deleteSelection() {
  const objs = selection.objects().map((o) => o.id);
  const shapes = selection.shapes().map((s) => s.id);
  if (!objs.length && !shapes.length) return;
  edit(() => {
    objs.forEach(removeObject);
    shapes.forEach(removeShape);
  });
  selection.clear();
  refreshAll();
}

/* ================= timeline ================= */

let thumbTimer = 0;
function refreshFrames() {
  clearTimeout(thumbTimer);
  thumbTimer = setTimeout(drawFrames, 90);
  $('#total').textContent = (totalDuration(state.doc) / 1000).toFixed(1) + 's';
}

function drawFrames() {
  const wrap = $('#frames');
  wrap.innerHTML = '';
  const keep = { frame: state.frame, sel: state.selection, trails: state.trails };
  state.selection = [];
  state.trails = false;
  const h = state.animateMode ? 88 : 66;
  state.doc.frames.forEach((f, i) => {
    const card = document.createElement('div');
    card.className = 'frame-card' + (i === state.frame ? ' active' : '');
    card.setAttribute('role', 'button');
    card.tabIndex = 0;
    const c = document.createElement('canvas');
    const box = boardRect(200, 132, state.doc.pitch, 2);
    const aspect = box.w / box.h;
    c.width = Math.round(h * aspect * 2);
    c.height = h * 2;
    c.style.height = h + 'px';
    c.style.width = Math.round(h * aspect) + 'px';
    state.frame = i;
    paint(c.getContext('2d'), c.width, c.height, { rect: boardRect(c.width, c.height, state.doc.pitch, 2), ghost: false });
    card.appendChild(c);
    card.insertAdjacentHTML('beforeend',
      `<span class="n">${i + 1}</span><span class="d">${((f.duration || 1000) / 1000).toFixed(1)}s</span>` +
      (f.label && state.animateMode ? `<span class="lbl">${f.label}</span>` : ''));
    if (state.doc.frames.length > 1) {
      const x = document.createElement('button');
      x.className = 'x';
      x.textContent = '×';
      x.title = t('frame.del');
      x.onclick = (ev) => { ev.stopPropagation(); edit(() => deleteFrame(i)); refreshAll(); };
      card.appendChild(x);
    }
    const go = () => gotoFrame(i);
    card.onclick = go;
    card.onkeydown = (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(); } };
    wrap.appendChild(card);
  });
  state.frame = keep.frame;
  state.selection = keep.sel;
  state.trails = keep.trails;
  const active = wrap.children[state.frame];
  if (active) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  render();
}

function gotoFrame(i) {
  stop(render);
  state.frame = Math.max(0, Math.min(i, state.doc.frames.length - 1));
  state.progress = 0;
  selection.clear();
  refreshAll();
}

/* ================= refresh ================= */

function refreshFramePane() {
  const f = frame();
  $('#dur').value = f.duration;
  $('#dur-out').textContent = (f.duration / 1000).toFixed(1) + 's';
  $('#note').value = f.note || '';
  $('#f-label').value = f.label || '';
  $('#f-easing').value = f.easing || 'ease';
}

function refreshAll() {
  $('#undo').disabled = !canUndo();
  $('#redo').disabled = !canRedo();
  refreshFrames();
  refreshFramePane();
  refreshInspector(false);
  render();
  queueAutosave();
}

let saveTimer = 0;
function queueAutosave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(autosave, 700);
}

/* ================= actions ================= */

function addPlayer(team) {
  const list = teamPlayers(team);
  const x = team === 'A' ? 0.3 : 0.7;
  edit(() => {
    const o = addObject({
      kind: list.length === 0 ? 'keeper' : 'player',
      team, num: nextNumber(team),
    }, x, 0.5 + (Math.random() - 0.5) * 0.25);
    selection.set('object', o.id);
  });
  refreshAll();
}

function playToggle() {
  toggle(render, () => { refreshFramePane(); markActiveFrame(); });
  $('#play-icon').innerHTML = state.playing
    ? '<path d="M7 5h3.4v14H7zM13.6 5H17v14h-3.4z" fill="currentColor"/>'
    : '<path d="M8 5.5l11 6.5-11 6.5z" fill="currentColor"/>';
  $('#t-play').title = state.playing ? t('time.pause') : t('time.play');
  $('#empty-card').hidden = true;
}

function markActiveFrame() {
  $$('#frames .frame-card').forEach((c, i) => c.classList.toggle('active', i === state.frame));
}

function setAnimateMode(on) {
  state.animateMode = on;
  $('#app').classList.toggle('anim', on);
  $('#mode-edit').classList.toggle('active', !on);
  $('#mode-anim').classList.toggle('active', on);
  if (on) {
    $$('.tab').forEach((x) => x.classList.toggle('active', x.dataset.tab === 'frame'));
    $$('.tabpane').forEach((p) => p.classList.toggle('active', p.dataset.pane === 'frame'));
    if (!localStorage.getItem('micharlatac.coach.anim')) {
      localStorage.setItem('micharlatac.coach.anim', '1');
      showCoach(t('coach.animate'));
    }
  }
  refreshFrames();
}

function showCoach(text) {
  const el = $('#coach');
  $('#coach-text').textContent = text;
  el.hidden = false;
  $('#coach-ok').onclick = () => { el.hidden = true; };
  setTimeout(() => { el.hidden = true; }, 9000);
}

/* ================= dialogs ================= */

function openExport() {
  const grid = $('#export-grid');
  const fmt = videoFormat();
  const ext = fmt ? fmt[1].toUpperCase() : '-';
  grid.innerHTML = '';
  const cards = [
    ['png', t('menu.png'), 'PNG'],
    ['svg', t('menu.svg'), 'SVG'],
    ['sheet', t('menu.sheet'), 'PNG'],
    ['video', t('menu.video'), ext],
  ];
  cards.forEach(([act, label, kind]) => {
    const b = document.createElement('button');
    b.className = 'export-card';
    b.innerHTML = `<strong>${label}</strong><small>${kind}</small>`;
    b.onclick = () => runExport(act);
    grid.appendChild(b);
  });
  $('#export-dlg').showModal();
}

async function runExport(act) {
  const size = parseInt($('#ex-size').value, 10);
  const brand = $('#ex-brand').checked;
  if (act === 'png') { exportPNG(size, brand); toast(t('toast.png')); $('#export-dlg').close(); }
  if (act === 'svg') { exportSVG(Math.min(size, 2000), brand); toast(t('toast.svg')); $('#export-dlg').close(); }
  if (act === 'sheet') { exportSheet(Math.max(1600, size)); toast(t('toast.sheet')); $('#export-dlg').close(); }
  if (act === 'video') {
    $('#export-dlg').close();
    try {
      toast(t('toast.recording'));
      await exportVideo({ width: Math.min(size, 1920), brand, onProgress: (p) => { if (p >= 1) toast(t('toast.video')); } });
    } catch (err) {
      toast(err.message === 'MediaRecorder' ? 'MediaRecorder' : err.message, true);
    }
  }
}

function openLibrary() {
  const dlg = $('#lib-dlg');
  const list = $('#lib-list');
  const search = $('#lib-search');
  const paint2 = () => {
    const q = (search.value || '').toLowerCase();
    const items = library().filter((e) => !q || (e.name || '').toLowerCase().includes(q));
    list.innerHTML = items.length ? '' : `<p class="muted">${t('lib.empty')}</p>`;
    items.forEach((e) => {
      const row = document.createElement('div');
      row.className = 'lib-item';
      const when = new Date(e.at).toLocaleDateString(getLang() === 'es' ? 'es' : 'en', { day: 'numeric', month: 'short', year: 'numeric' });
      row.innerHTML =
        (e.thumb ? `<img class="thumb" src="${e.thumb}" alt="" />` : '<div class="thumb"></div>') +
        `<div class="meta"><strong>${e.name || t('welcome.title')}</strong><small>${e.doc.frames.length} ${t('lib.frames')} - ${when}</small></div>`;
      const open = document.createElement('button');
      open.className = 'btn tiny primary';
      open.textContent = t('lib.open');
      open.onclick = () => {
        loadDoc(JSON.parse(JSON.stringify(e.doc)));
        state.doc.id = e.id;
        afterLoad();
        dlg.close();
        toast(t('toast.loaded'));
      };
      const dup = document.createElement('button');
      dup.className = 'btn tiny';
      dup.textContent = t('lib.dup');
      dup.onclick = () => { duplicateInLibrary(e.id); paint2(); };
      const del = document.createElement('button');
      del.className = 'btn tiny danger';
      del.textContent = t('lib.del');
      del.onclick = () => { deleteFromLibrary(e.id); paint2(); };
      row.append(open, dup, del);
      list.appendChild(row);
    });
  };
  search.oninput = paint2;
  paint2();
  dlg.showModal();
}

function doSave() {
  saveToLibrary($('#title').value.trim(), thumbnail());
  toast(t('toast.saved'));
}

async function doShare() {
  let url;
  try { url = await shareLink(); } catch { toast(t('toast.linkFail'), true); return; }
  if (url.length > 30000) { toast(t('toast.tooBig'), true); return; }
  history.replaceState(null, '', url);
  try {
    await navigator.clipboard.writeText(url);
    toast(t('toast.linkCopied'));
  } catch { toast(t('toast.linkBar')); }
}

function afterLoad() {
  $('#title').value = state.doc.title || '';
  buildSelectOptions();
  buildFormationOptions();
  buildPalette();
  syncBoardPane();
  resetView();
  resize();
  refreshAll();
}

function syncBoardPane() {
  $('#pitch').value = state.doc.pitch;
  $('#theme').value = state.doc.theme;
  $('#opt-stripes').checked = !!state.doc.stripes;
  $('#opt-thirds').checked = !!state.doc.thirds;
  $('#opt-grid').checked = !!state.doc.grid;
  $('#opt-snap').checked = state.snap;
  $$('.team-name').forEach((i) => { i.value = state.doc.teams[i.dataset.team].name || ''; });
  $$('.team-color').forEach((i) => { i.value = state.doc.teams[i.dataset.team].color; });
  $('#title').value = state.doc.title || '';
}

/* ================= wiring ================= */

function wire() {
  present = attachPresent({ playToggle, gotoFrame, resize });

  buildRail();
  buildPalette();
  buildEquipment();
  buildSelectOptions();
  buildFormationOptions();

  $('#title').oninput = (e) => { state.doc.title = e.target.value; queueAutosave(); };
  $('#undo').onclick = () => { if (undo()) { afterHistory(); } };
  $('#redo').onclick = () => { if (redo()) { afterHistory(); } };
  $('#btn-open').onclick = openLibrary;
  $('#btn-save').onclick = doSave;
  $('#btn-share').onclick = doShare;
  $('#btn-help').onclick = () => $('#help-dlg').showModal();
  $('#btn-present').onclick = () => present.set(true);
  $('#btn-panel').onclick = () => $('#panel').classList.toggle('open');
  $('#mode-edit').onclick = () => setAnimateMode(false);
  $('#mode-anim').onclick = () => setAnimateMode(true);
  $('#lang').onchange = (e) => {
    setLang(e.target.value);
    buildRail(); buildPalette(); buildEquipment(); buildSelectOptions(); buildFormationOptions();
    refreshAll();
  };

  const menu = $('#menu');
  $('#btn-menu').onclick = (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; };
  document.addEventListener('click', () => { menu.hidden = true; });
  menu.onclick = (e) => {
    const act = e.target.dataset.act;
    if (!act) return;
    menu.hidden = true;
    if (act === 'present') present.set(true);
    if (act === 'export') openExport();
    if (act === 'json') { exportJSON(); toast(t('toast.json')); }
    if (act === 'import') $('#file-input').click();
    if (act === 'save') doSave();
    if (act === 'library') openLibrary();
    if (act === 'share') doShare();
    if (act === 'help') $('#help-dlg').showModal();
  };

  $('#file-input').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try { await importJSON(f); afterLoad(); toast(t('toast.loaded')); }
    catch { toast(t('toast.badFile'), true); }
    e.target.value = '';
  };

  $$('.tab').forEach((tab) => {
    tab.onclick = () => {
      $$('.tab').forEach((x) => x.classList.toggle('active', x === tab));
      $$('.tabpane').forEach((p) => p.classList.toggle('active', p.dataset.pane === tab.dataset.tab));
    };
  });

  $$('.team-name').forEach((i) => {
    i.oninput = () => { state.doc.teams[i.dataset.team].name = i.value; queueAutosave(); };
  });
  $$('.team-color').forEach((i) => {
    i.oninput = () => {
      edit(() => { state.doc.teams[i.dataset.team].color = i.value; });
      buildPalette();
      refreshAll();
    };
  });
  $$('.formation').forEach((sel) => {
    sel.onchange = () => {
      if (!sel.value) return;
      edit(() => applyFormation(sel.dataset.team, teamSize(), sel.value));
      refreshAll();
    };
  });
  $$('[data-add-player]').forEach((b) => { b.onclick = () => addPlayer(b.dataset.addPlayer); });
  $$('[data-mirror]').forEach((b) => {
    b.onclick = () => { edit(() => mirrorTeam(b.dataset.mirror)); refreshAll(); };
  });

  $('#dur').oninput = (e) => {
    frame().duration = parseInt(e.target.value, 10);
    $('#dur-out').textContent = (frame().duration / 1000).toFixed(1) + 's';
    refreshFrames();
    queueAutosave();
  };
  $('#note').oninput = (e) => { frame().note = e.target.value; queueAutosave(); };
  $('#f-label').oninput = (e) => { frame().label = e.target.value; refreshFrames(); queueAutosave(); };
  $('#f-easing').onchange = (e) => { edit(() => { frame().easing = e.target.value; }); };
  $('#f-add').onclick = () => { edit(() => addFrame()); refreshAll(); };
  $('#f-dup').onclick = () => { edit(() => duplicateFrame()); refreshAll(); };
  $('#f-del').onclick = () => { edit(() => deleteFrame()); refreshAll(); };
  $('#f-clear').onclick = () => { edit(() => clearDrawings(false)); refreshAll(); };
  $('#opt-trails').onchange = (e) => { state.trails = e.target.checked; render(); };
  $('#opt-onion').onchange = (e) => { state.onion = e.target.checked; render(); };

  $('#pitch').onchange = (e) => {
    edit(() => {
      const prev = state.doc.pitch;
      state.doc.pitch = e.target.value;
      remapForPitch(prev, e.target.value);
    });
    buildFormationOptions();
    resetView();
    resize();
    refreshAll();
  };
  $('#theme').onchange = (e) => { edit(() => { state.doc.theme = e.target.value; }); refreshAll(); };
  $('#opt-stripes').onchange = (e) => { edit(() => { state.doc.stripes = e.target.checked; }); refreshAll(); };
  $('#opt-thirds').onchange = (e) => { edit(() => { state.doc.thirds = e.target.checked; }); refreshAll(); };
  $('#opt-grid').onchange = (e) => { edit(() => { state.doc.grid = e.target.checked; }); refreshAll(); };
  $('#opt-snap').onchange = (e) => { state.snap = e.target.checked; };
  $('#opt-numbers').onchange = (e) => { state.showNumbers = e.target.checked; refreshFrames(); render(); };
  $('#opt-names').onchange = (e) => { state.showNames = e.target.checked; refreshFrames(); render(); };
  $('#msize').oninput = (e) => {
    state.markerScale = parseInt(e.target.value, 10) / 100;
    $('#msize-out').textContent = e.target.value + '%';
    render();
  };
  $('#b-clear-draw').onclick = () => { edit(() => clearDrawings(true)); refreshAll(); };
  $('#b-reset').onclick = () => {
    if (!confirm(t('board.resetAsk'))) return;
    loadDoc(newDoc(state.doc.pitch));
    afterLoad();
  };

  $('#t-play').onclick = playToggle;
  $('#t-prev').onclick = () => gotoFrame(state.frame - 1);
  $('#t-next').onclick = () => gotoFrame(state.frame + 1);
  // Un solo estado de repeticion, dos botones que lo muestran: el de la linea de
  // tiempo y el de la barra de presentacion.
  const syncLoop = () => {
    for (const el of [$('#t-loop'), $('#p-loop')]) {
      el.classList.toggle('on', state.loop);
      el.setAttribute('aria-pressed', state.loop ? 'true' : 'false');
    }
  };
  const toggleLoop = () => { state.loop = !state.loop; syncLoop(); };
  $('#t-loop').onclick = toggleLoop;
  $('#p-loop').onclick = toggleLoop;
  syncLoop();

  $('#p-play').onclick = () => { playToggle(); present.refresh(); };
  $('#p-prev').onclick = () => { gotoFrame(state.frame - 1); present.refresh(); };
  $('#p-next').onclick = () => { gotoFrame(state.frame + 1); present.refresh(); };
  $('#p-exit').onclick = () => present.set(false);
  $('#speed').onchange = (e) => { state.speed = parseFloat(e.target.value); };
  $('#add-frame').onclick = () => { edit(() => addFrame()); refreshAll(); };

  $('#zoom-in').onclick = () => { zoomAt(base, stage.clientWidth / 2, stage.clientHeight / 2, 1.25); viewChanged(); };
  $('#zoom-out').onclick = () => { zoomAt(base, stage.clientWidth / 2, stage.clientHeight / 2, 0.8); viewChanged(); };
  $('#zoom-level').onclick = () => { resetView(); viewChanged(); };

  $('#empty-apply').onclick = () => {
    emptyDismissed = false;
    edit(() => {
      applyFormation('A', teamSize(), Object.keys(FORMATIONS[teamSize()])[1] || Object.keys(FORMATIONS[teamSize()])[0]);
      addObject({ kind: 'ball' }, 0.5, 0.5);
    });
    refreshAll();
  };
  $('#empty-blank').onclick = () => { emptyDismissed = true; $('#empty-card').hidden = true; };

  $('#welcome-start').onclick = () => $('#welcome-dlg').close();
  $('#welcome-tour').onclick = () => { $('#welcome-dlg').close(); $('#help-dlg').showModal(); };

  document.addEventListener('keydown', onKey);
  // ResizeObserver catches layout changes a window resize event never reports:
  // a tab that was in the background while loading, panels opening, split view.
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => resize()).observe(stage);
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));
  window.addEventListener('pageshow', resize);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) resize(); });
  window.addEventListener('beforeunload', autosave);
}

function afterHistory() {
  buildFormationOptions();
  syncBoardPane();
  refreshAll();
}

function onKey(e) {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
  const mod = e.metaKey || e.ctrlKey;

  // Presentando no se edita. present.key() se queda con todo para que ninguna
  // tecla suelta borre una ficha delante de los jugadores.
  if (present.key(e)) return;
  // No entrar a presentar por encima de un dialogo abierto: quedaria debajo.
  if (!mod && e.key.toLowerCase() === 'm' && !document.querySelector('dialog[open]')) {
    present.set(true);
    return;
  }

  if (mod && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey ? redo() : undo()) afterHistory();
    return;
  }
  if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); doSave(); return; }
  if (mod && e.key.toLowerCase() === 'd') {
    e.preventDefault();
    const objs = selection.objects();
    if (objs.length) {
      edit(() => {
        const copies = objs.map((o) => duplicateObject(o.id)).filter(Boolean);
        state.selection = copies.map((c) => ({ type: 'object', id: c.id }));
      });
      refreshAll();
      toast(t('toast.duplicated'));
    }
    return;
  }
  if (mod) return;

  if (e.key === ' ') { e.preventDefault(); playToggle(); return; }
  if (e.key === ',') { gotoFrame(state.frame - 1); return; }
  if (e.key === '.') { gotoFrame(state.frame + 1); return; }
  if (e.key.toLowerCase() === 'n') { edit(() => addFrame()); refreshAll(); return; }
  if (e.key === 'Escape') { if (state.place) setPlace(null); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (!state.selection.length) return;
    e.preventDefault();
    deleteSelection();
    return;
  }
  if (e.key.startsWith('Arrow') && selection.objects().length) {
    e.preventDefault();
    const step = e.shiftKey ? 0.02 : 0.005;
    const dx = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
    const dy = e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0;
    edit(() => {
      for (const o of selection.objects()) {
        const p = frame().pos[o.id];
        if (p) setPos(o.id, p.x + dx, p.y + dy);
      }
    });
    render();
    queueAutosave();
    return;
  }
  const tool = TOOLS.find((x) => x.key.toLowerCase() === e.key.toLowerCase());
  if (tool) setTool(tool.id);
}

/* ================= boot ================= */

async function boot() {
  applyI18n();
  wire();
  attach(canvas, api);

  const shared = await readShareLink();
  if (!shared && !restoreAutosave()) {
    if (window.innerHeight > window.innerWidth) loadDoc(newDoc('vertical'));
    applyFormation('A', 11, '4-3-3');
    applyFormation('B', 11, '4-4-2');
    addObject({ kind: 'ball' }, 0.5, 0.5);
  }
  clampFrame();
  syncBoardPane();
  buildSelectOptions();
  buildFormationOptions();
  setTool('select');
  resize();
  refreshAll();
  viewChanged();

  if (location.hash.startsWith('#/library')) openLibrary();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  if (!localStorage.getItem('micharlatac.seen')) {
    localStorage.setItem('micharlatac.seen', '1');
    $('#welcome-dlg').showModal();
  }
}

boot();
