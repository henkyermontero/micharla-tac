// main.js - app wiring: canvas loop, tools, panels, timeline, shortcuts.

import { PITCHES } from './pitch.js';
import { FORMATIONS } from './formations.js';
import {
  state, edit, undo, redo, canUndo, canRedo, frame, addFrame, deleteFrame, duplicateFrame,
  addObject, removeObject, teamPlayers, applyFormation, setPos, newDoc, loadDoc, remapForPitch,
  library, saveToLibrary, deleteFromLibrary, autosave, restoreAutosave, clampFrame,
} from './state.js';
import { paint, boardRect, markerRadius } from './render.js';
import { attach, isDrawTool } from './interact.js';
import { play, stop, toggle, totalDuration } from './animate.js';
import { exportPNG, exportSheet, exportVideo, exportJSON, importJSON, shareLink, readShareLink } from './export.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const canvas = $('#board');
const ctx = canvas.getContext('2d');
const stage = $('#stage');
let rect = { x: 0, y: 0, w: 10, h: 10 };
let draft = null;

/* ================= tools ================= */

const TOOLS = [
  { id: 'select', key: 'V', label: 'Select and move markers', icon: '<path d="M5 3l14 8.2-6.1 1.4L10.2 19z" fill="currentColor"/>' },
  { id: 'pass', key: 'P', label: 'Pass: solid arrow', icon: '<path d="M4 19L18 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M19.6 4.5l-.7 6-4.8-1.6z" fill="currentColor"/>' },
  { id: 'run', key: 'R', label: 'Run without the ball: dashed arrow', icon: '<path d="M4 19L18 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="3.4 3"/><path d="M19.6 4.5l-.7 6-4.8-1.6z" fill="currentColor"/>' },
  { id: 'dribble', key: 'D', label: 'Dribble: wavy arrow', icon: '<path d="M3 15c2.4-4.4 4-1.2 5.6-3.4S11 6.6 13.4 9.4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M19.6 4.5l-.7 6-4.8-1.6z" fill="currentColor"/>' },
  { id: 'shot', key: 'S', label: 'Shot: thick arrow', icon: '<path d="M4 19L17 7" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/><path d="M20 4l-.9 6.6-5.3-1.8z" fill="currentColor"/>' },
  { id: 'line', key: 'L', label: 'Straight line', icon: '<path d="M4 20L20 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' },
  { id: 'pen', key: 'F', label: 'Free draw', icon: '<path d="M4 18.5l1-3.4L15.4 4.7a1.9 1.9 0 0 1 2.7 2.7L7.7 17.8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' },
  { id: 'zone', key: 'Z', label: 'Zone box', icon: '<rect x="4" y="6" width="16" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-dasharray="3.6 2.6"/>' },
  { id: 'ellipse', key: 'C', label: 'Ellipse zone', icon: '<ellipse cx="12" cy="12" rx="8.4" ry="6.2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-dasharray="3.6 2.6"/>' },
  { id: 'block', key: 'B', label: 'Block or screen', icon: '<path d="M4 19L16 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M13.8 4.6l5.6 5.6" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>' },
  { id: 'text', key: 'T', label: 'Text label', icon: '<path d="M5 6h14M12 6v13" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>' },
  { id: 'erase', key: 'E', label: 'Eraser: click a drawing or marker', icon: '<path d="M8 20h11M6.5 17.5l-2-2a1.8 1.8 0 0 1 0-2.6l8-8a1.8 1.8 0 0 1 2.6 0l4 4a1.8 1.8 0 0 1 0 2.6l-7 7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' },
];

const COLORS = ['#ffdd57', '#ffffff', '#39d98a', '#ff6b6b', '#4dabf7', '#ff922b', '#c77dff', '#111318'];

function buildRail() {
  const rail = $('#rail');
  rail.innerHTML = '';
  TOOLS.forEach((t) => {
    const b = document.createElement('button');
    b.className = 'tool' + (state.tool === t.id ? ' active' : '');
    b.dataset.tool = t.id;
    b.title = `${t.label} (${t.key})`;
    b.innerHTML = `<svg viewBox="0 0 24 24">${t.icon}</svg><span class="sc">${t.key}</span>`;
    b.onclick = () => setTool(t.id);
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
    s.title = `Ink colour ${c}`;
    s.onclick = () => {
      state.color = c;
      $$('.swatch', rail).forEach((x) => x.classList.toggle('active', x.dataset.color === c));
      applySelectedColor(c);
    };
    sw.appendChild(s);
  });
  rail.appendChild(sw);

  const widths = document.createElement('div');
  widths.className = 'widths';
  [['Thin', 0.35, 2], ['Medium', 0.55, 4], ['Thick', 0.95, 6]].forEach(([label, val, px]) => {
    const b = document.createElement('button');
    b.className = 'wbtn' + (Math.abs(state.width - val) < 0.01 ? ' active' : '');
    b.title = `${label} line`;
    b.innerHTML = `<i style="height:${px}px"></i>`;
    b.onclick = () => {
      state.width = val;
      [...widths.children].forEach((c) => c.classList.toggle('active', c === b));
      const sel = state.selection;
      if (sel && sel.type === 'shape') edit(() => { const s = frame().shapes.find((x) => x.id === sel.id); if (s) s.width = val; });
      render();
    };
    widths.appendChild(b);
  });
  rail.appendChild(widths);
}

function applySelectedColor(c) {
  const sel = state.selection;
  if (!sel) return;
  if (sel.type === 'shape') {
    edit(() => { const s = frame().shapes.find((x) => x.id === sel.id); if (s) s.color = c; });
  }
  render();
}

function setTool(id) {
  state.tool = id;
  $$('.rail .tool').forEach((b) => b.classList.toggle('active', b.dataset.tool === id));
  canvas.classList.toggle('select-mode', id === 'select');
  const t = TOOLS.find((x) => x.id === id);
  if (t) hint(t.label);
  render();
}

let hintTimer = 0;
function hint(msg) {
  const el = $('#hint');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => el.classList.remove('show'), 2200);
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

/* ================= canvas ================= */

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const w = stage.clientWidth, h = stage.clientHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  rect = boardRect(w, h, state.doc.pitch);
  render();
}

function render(d) {
  if (d !== undefined) draft = d;
  paint(ctx, stage.clientWidth, stage.clientHeight, { rect, draft: draft || undefined });
  $('#frame-badge').textContent = state.playing
    ? `Playing ${state.frame + 1}/${state.doc.frames.length}`
    : `Frame ${state.frame + 1} of ${state.doc.frames.length}`;
}

const ctxRef = {
  rect: () => rect,
  render: (d) => { draft = d || null; render(); },
  onSelect: (focus) => syncSelection(focus),
  setTool,
  afterEdit: () => { refreshAll(); },
};

/* ================= panels ================= */

function buildPitchOptions() {
  const sel = $('#pitch');
  sel.innerHTML = '';
  for (const [key, p] of Object.entries(PITCHES)) {
    const o = document.createElement('option');
    o.value = key; o.textContent = p.label;
    sel.appendChild(o);
  }
  sel.value = state.doc.pitch;
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
    sel.innerHTML = '<option value="">Formation...</option>';
    Object.keys(FORMATIONS[size] || FORMATIONS[11]).forEach((name) => {
      const o = document.createElement('option');
      o.value = name; o.textContent = name;
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
    teamPlayers(team).forEach((o) => {
      const li = document.createElement('li');
      li.className = state.selection && state.selection.id === o.id ? 'sel' : '';
      li.innerHTML = `<span class="dotnum" style="background:${o.color || state.doc.teams[team].color}">${o.num || ''}</span><span>${o.name || (o.kind === 'keeper' ? 'GK' : 'Player')}</span>`;
      li.onclick = () => { state.selection = { type: 'object', id: o.id }; syncSelection(true); render(); };
      ul.appendChild(li);
    });
  });
}

function syncSelection(focus) {
  const box = $('#selected-box');
  const sel = state.selection;
  const o = sel && sel.type === 'object' ? state.doc.objects.find((x) => x.id === sel.id) : null;
  box.hidden = !o;
  if (o) {
    $('#sel-num').value = o.num ?? '';
    $('#sel-name').value = o.name ?? '';
    $('#sel-color').value = o.color || (o.team ? state.doc.teams[o.team].color : '#ffd166');
    $('#sel-num').disabled = o.kind === 'label';
    if (focus) {
      $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === 'squad'));
      $$('.tabpane').forEach((p) => p.classList.toggle('active', p.dataset.pane === 'squad'));
      (o.kind === 'label' ? $('#sel-name') : $('#sel-num')).focus();
      $('#panel').classList.add('open');
    }
  }
  refreshRosters();
}

function refreshFramePane() {
  const f = frame();
  $('#dur').value = f.duration;
  $('#dur-out').textContent = (f.duration / 1000).toFixed(1) + 's';
  $('#note').value = f.note || '';
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
  const keep = state.frame, keepSel = state.selection, keepTrails = state.trails;
  state.selection = null;
  state.trails = false;
  state.doc.frames.forEach((f, i) => {
    const card = document.createElement('div');
    card.className = 'frame-card' + (i === state.frame ? ' active' : '');
    const c = document.createElement('canvas');
    const h = 66, box = boardRect(200, 132, state.doc.pitch, 2);
    const aspect = box.w / box.h;
    c.width = Math.round(h * aspect * 2); c.height = h * 2;
    c.style.height = h + 'px';
    c.style.width = Math.round(h * aspect) + 'px';
    state.frame = i;
    paint(c.getContext('2d'), c.width, c.height, { rect: boardRect(c.width, c.height, state.doc.pitch, 2) });
    card.appendChild(c);
    card.insertAdjacentHTML('beforeend', `<span class="n">${i + 1}</span><span class="d">${((f.duration || 1000) / 1000).toFixed(1)}s</span>`);
    if (state.doc.frames.length > 1) {
      const x = document.createElement('button');
      x.className = 'x'; x.textContent = '×'; x.title = 'Delete frame';
      x.onclick = (ev) => { ev.stopPropagation(); edit(() => deleteFrame(i)); refreshAll(); };
      card.appendChild(x);
    }
    card.onclick = () => { stop(render); state.frame = i; state.progress = 0; state.selection = null; refreshAll(); };
    wrap.appendChild(card);
  });
  state.frame = keep; state.selection = keepSel; state.trails = keepTrails;
  const active = wrap.children[state.frame];
  if (active) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  render();
}

function refreshAll() {
  $('#undo').disabled = !canUndo();
  $('#redo').disabled = !canRedo();
  refreshFrames();
  refreshFramePane();
  refreshRosters();
  syncSelection(false);
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
  const size = teamSize();
  const list = teamPlayers(team);
  const num = String(list.length + 1);
  const x = team === 'A' ? 0.3 : 0.7;
  edit(() => {
    const o = addObject({ kind: list.length === 0 ? 'keeper' : 'player', team, num }, x, 0.5 + (Math.random() - 0.5) * 0.25);
    state.selection = { type: 'object', id: o.id };
  });
  hint(`Added ${state.doc.teams[team].name} player. Formations for ${size}-a-side are in the dropdown.`);
  refreshAll();
}

function addEquipment(kind) {
  const jitter = () => 0.5 + (Math.random() - 0.5) * 0.22;
  if (kind === 'label') { setTool('text'); hint('Click on the pitch to place the text'); return; }
  edit(() => {
    const o = addObject({ kind, color: kind === 'cone' ? '#ff8c1a' : null }, jitter(), jitter());
    state.selection = { type: 'object', id: o.id };
  });
  refreshAll();
}

function playToggle() {
  toggle(render, () => { refreshFramePane(); markActiveFrame(); });
  $('#play-icon').innerHTML = state.playing
    ? '<path d="M7 5h3.4v14H7zM13.6 5H17v14h-3.4z" fill="currentColor"/>'
    : '<path d="M8 5.5l11 6.5-11 6.5z" fill="currentColor"/>';
  $('#t-play').title = state.playing ? 'Pause (Space)' : 'Play (Space)';
}

function markActiveFrame() {
  $$('#frames .frame-card').forEach((c, i) => c.classList.toggle('active', i === state.frame));
}

function gotoFrame(i) {
  stop(render);
  state.frame = Math.max(0, Math.min(i, state.doc.frames.length - 1));
  state.progress = 0;
  state.selection = null;
  refreshAll();
}

/* ================= wiring ================= */

function wire() {
  buildRail();
  buildPitchOptions();
  buildFormationOptions();

  // topbar
  $('#title').oninput = (e) => { state.doc.title = e.target.value; queueAutosave(); };
  $('#undo').onclick = () => { if (undo()) refreshAll(); };
  $('#redo').onclick = () => { if (redo()) refreshAll(); };

  $('#btn-open').onclick = openLibrary;
  $('#btn-help').onclick = () => $('#help-dlg').showModal();
  $('#btn-panel').onclick = () => $('#panel').classList.toggle('open');

  const doSave = () => {
    saveToLibrary($('#title').value.trim() || 'Untitled play');
    toast('Saved to this browser');
  };
  const doShare = async () => {
    let url;
    try { url = await shareLink(); } catch { toast('Could not create the link', true); return; }
    if (url.length > 30000) { toast('Play too big for a link, use Export > play file', true); return; }
    history.replaceState(null, '', url);
    try {
      await navigator.clipboard.writeText(url);
      toast('Link copied to clipboard');
    } catch { toast('Link is in the address bar, copy it from there'); }
  };

  const menu = $('#menu-export');
  $('#btn-export').onclick = (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; };
  document.addEventListener('click', () => { menu.hidden = true; });
  menu.onclick = async (e) => {
    const act = e.target.dataset.act;
    if (!act) return;
    menu.hidden = true;
    if (act === 'png') { exportPNG(); toast('Image downloaded'); }
    if (act === 'sheet') { exportSheet(); toast('Playbook sheet downloaded'); }
    if (act === 'json') { exportJSON(); toast('Play file downloaded'); }
    if (act === 'import') $('#file-input').click();
    if (act === 'save') doSave();
    if (act === 'library') openLibrary();
    if (act === 'share') doShare();
    if (act === 'help') $('#help-dlg').showModal();
    if (act === 'video') {
      try {
        toast('Recording animation...');
        await exportVideo({ onProgress: (p) => { if (p >= 1) toast('Video downloaded'); } });
      } catch (err) { toast(err.message, true); }
    }
  };

  $('#file-input').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      await importJSON(f);
      $('#title').value = state.doc.title || 'Untitled play';
      buildPitchOptions(); buildFormationOptions(); syncBoardPane();
      resize(); refreshAll();
      toast('Play loaded');
    } catch (err) { toast('That file could not be read', true); }
    e.target.value = '';
  };

  $('#btn-share').onclick = doShare;
  $('#btn-save').onclick = doSave;

  // tabs
  $$('.tab').forEach((t) => {
    t.onclick = () => {
      $$('.tab').forEach((x) => x.classList.toggle('active', x === t));
      $$('.tabpane').forEach((p) => p.classList.toggle('active', p.dataset.pane === t.dataset.tab));
    };
  });

  // squad
  $$('.team-name').forEach((i) => {
    i.oninput = () => { state.doc.teams[i.dataset.team].name = i.value; queueAutosave(); };
  });
  $$('.team-color').forEach((i) => {
    i.oninput = () => { edit(() => { state.doc.teams[i.dataset.team].color = i.value; }); refreshAll(); };
  });
  $$('.formation').forEach((sel) => {
    sel.onchange = () => {
      if (!sel.value) return;
      edit(() => applyFormation(sel.dataset.team, teamSize(), sel.value));
      hint(`${state.doc.teams[sel.dataset.team].name}: ${sel.value}`);
      refreshAll();
    };
  });
  $$('[data-add-player]').forEach((b) => { b.onclick = () => addPlayer(b.dataset.addPlayer); });
  $$('#equipment .chip').forEach((b) => { b.onclick = () => addEquipment(b.dataset.kind); });

  $('#sel-num').oninput = (e) => updateSelected('num', e.target.value);
  $('#sel-name').oninput = (e) => updateSelected('name', e.target.value);
  $('#sel-color').oninput = (e) => updateSelected('color', e.target.value);
  $('#sel-delete').onclick = () => {
    if (!state.selection) return;
    edit(() => removeObject(state.selection.id));
    state.selection = null;
    refreshAll();
  };

  // frame pane
  $('#dur').oninput = (e) => {
    frame().duration = parseInt(e.target.value, 10);
    $('#dur-out').textContent = (frame().duration / 1000).toFixed(1) + 's';
    refreshFrames();
    queueAutosave();
  };
  $('#note').oninput = (e) => { frame().note = e.target.value; queueAutosave(); };
  $('#f-add').onclick = () => { edit(() => addFrame()); refreshAll(); hint('New frame added. Move the markers to build the next step.'); };
  $('#f-dup').onclick = () => { edit(() => duplicateFrame()); refreshAll(); };
  $('#f-del').onclick = () => { edit(() => deleteFrame()); refreshAll(); };
  $('#f-clear').onclick = () => { edit(() => { frame().shapes = []; }); refreshAll(); };
  $('#opt-trails').onchange = (e) => { state.trails = e.target.checked; render(); };
  $('#opt-onion').onchange = (e) => { state.onion = e.target.checked; render(); };

  // board pane
  $('#pitch').onchange = (e) => {
    edit(() => {
      const prev = state.doc.pitch;
      state.doc.pitch = e.target.value;
      remapForPitch(prev, e.target.value);
    });
    buildFormationOptions();
    resize(); refreshAll();
  };
  $('#theme').onchange = (e) => { edit(() => { state.doc.theme = e.target.value; }); refreshAll(); };
  $('#opt-stripes').onchange = (e) => { edit(() => { state.doc.stripes = e.target.checked; }); refreshAll(); };
  $('#opt-numbers').onchange = (e) => { state.showNumbers = e.target.checked; refreshFrames(); render(); };
  $('#opt-names').onchange = (e) => { state.showNames = e.target.checked; refreshFrames(); render(); };
  $('#msize').oninput = (e) => {
    state.markerScale = parseInt(e.target.value, 10) / 100;
    $('#msize-out').textContent = e.target.value + '%';
    render();
  };
  $('#b-clear-draw').onclick = () => { edit(() => state.doc.frames.forEach((f) => { f.shapes = []; })); refreshAll(); };
  $('#b-reset').onclick = () => {
    if (!confirm('Start a new empty board? Unsaved work on this board is lost.')) return;
    loadDoc(newDoc(state.doc.pitch));
    $('#title').value = state.doc.title;
    syncBoardPane(); buildFormationOptions(); resize(); refreshAll();
  };

  // timeline
  $('#t-play').onclick = playToggle;
  $('#t-prev').onclick = () => gotoFrame(state.frame - 1);
  $('#t-next').onclick = () => gotoFrame(state.frame + 1);
  $('#t-loop').onclick = () => { state.loop = !state.loop; $('#t-loop').classList.toggle('on', state.loop); };
  $('#t-loop').classList.toggle('on', state.loop);
  $('#speed').onchange = (e) => { state.speed = parseFloat(e.target.value); };
  $('#add-frame').onclick = () => { edit(() => addFrame()); refreshAll(); };

  // keyboard
  document.addEventListener('keydown', onKey);
  window.addEventListener('resize', resize);
  window.addEventListener('beforeunload', autosave);
}

function updateSelected(prop, value) {
  const sel = state.selection;
  if (!sel || sel.type !== 'object') return;
  const o = state.doc.objects.find((x) => x.id === sel.id);
  if (!o) return;
  o[prop] = value;
  refreshRosters();
  refreshFrames();
  render();
  queueAutosave();
}

function syncBoardPane() {
  $('#pitch').value = state.doc.pitch;
  $('#theme').value = state.doc.theme;
  $('#opt-stripes').checked = !!state.doc.stripes;
  $$('.team-name').forEach((i) => { i.value = state.doc.teams[i.dataset.team].name; });
  $$('.team-color').forEach((i) => { i.value = state.doc.teams[i.dataset.team].color; });
  $('#title').value = state.doc.title || 'Untitled play';
}

function onKey(e) {
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
  const mod = e.metaKey || e.ctrlKey;

  if (mod && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    (e.shiftKey ? redo() : undo()) && refreshAll();
    return;
  }
  if (mod && e.key.toLowerCase() === 's') {
    e.preventDefault();
    saveToLibrary($('#title').value.trim() || 'Untitled play');
    toast('Saved to this browser');
    return;
  }
  if (mod) return;

  if (e.key === ' ') { e.preventDefault(); playToggle(); return; }
  if (e.key === ',') { gotoFrame(state.frame - 1); return; }
  if (e.key === '.') { gotoFrame(state.frame + 1); return; }
  if (e.key.toLowerCase() === 'n') { edit(() => addFrame()); refreshAll(); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (!state.selection) return;
    e.preventDefault();
    const sel = state.selection;
    edit(() => {
      if (sel.type === 'object') removeObject(sel.id);
      else frame().shapes = frame().shapes.filter((s) => s.id !== sel.id);
    });
    state.selection = null;
    refreshAll();
    return;
  }
  if (e.key.startsWith('Arrow') && state.selection && state.selection.type === 'object') {
    e.preventDefault();
    const step = e.shiftKey ? 0.02 : 0.005;
    const p = frame().pos[state.selection.id];
    if (!p) return;
    const dx = (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0);
    const dy = (e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0);
    edit(() => setPos(state.selection.id, p.x + dx, p.y + dy));
    render();
    return;
  }
  const tool = TOOLS.find((t) => t.key.toLowerCase() === e.key.toLowerCase());
  if (tool) setTool(tool.id);
}

/* ================= library ================= */

function openLibrary() {
  const dlg = $('#lib-dlg');
  const list = $('#lib-list');
  const items = library();
  list.innerHTML = items.length ? '' : '<p class="muted">No saved plays yet. Press Save to keep one in this browser.</p>';
  items.forEach((e) => {
    const row = document.createElement('div');
    row.className = 'lib-item';
    const when = new Date(e.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    row.innerHTML = `<div class="meta"><strong>${e.name}</strong><small>${e.doc.frames.length} frame(s) - ${when}</small></div>`;
    const open = document.createElement('button');
    open.className = 'btn tiny primary'; open.textContent = 'Open';
    open.onclick = () => {
      loadDoc(JSON.parse(JSON.stringify(e.doc)));
      state.doc.id = e.id;
      syncBoardPane(); buildFormationOptions(); resize(); refreshAll();
      dlg.close();
      toast('Play loaded');
    };
    const del = document.createElement('button');
    del.className = 'btn tiny danger'; del.textContent = 'Delete';
    del.onclick = () => { deleteFromLibrary(e.id); openLibrary(); };
    row.append(open, del);
    list.appendChild(row);
  });
  dlg.showModal();
}

/* ================= boot ================= */

async function boot() {
  wire();
  attach(canvas, ctxRef);

  const shared = await readShareLink();
  if (!shared) {
    const restored = restoreAutosave();
    if (!restored) {
      // A phone held upright gets the portrait pitch: much more room for the play.
      if (window.innerHeight > window.innerWidth) loadDoc(newDoc('vertical'));
      applyFormation('A', 11, '4-3-3');
      applyFormation('B', 11, '4-4-2');
      addObject({ kind: 'ball' }, 0.5, 0.5);
      state.doc.title = 'My first play';
    }
  }
  clampFrame();
  syncBoardPane();
  buildFormationOptions();
  setTool('select');
  resize();
  refreshAll();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  if (!localStorage.getItem('tb.seen.help') && window.innerWidth > 860) {
    localStorage.setItem('tb.seen.help', '1');
    setTimeout(() => $('#help-dlg').showModal(), 400);
  }
  hint('Drag the players. Press N for a new frame, then Space to play the animation.');
}

boot();
