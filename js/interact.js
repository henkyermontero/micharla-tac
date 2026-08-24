// interact.js - pointer, touch and keyboard-modifier handling for the board.

import {
  state, frame, shapesOf, findShape, setPos, addShape, removeShape, removeObject,
  addObject, edit, snapshot, commit, selection, objectById, nextNumber,
} from './state.js';
import { toBoard, toPx, markerRadius, shapeHandles, shapePoints } from './render.js';
import { snap, zoomAt, panBy, clampPan, applyView, view } from './view.js';

const DRAW_TOOLS = ['pass', 'run', 'dribble', 'shot', 'line', 'pen', 'zone', 'ellipse', 'block', 'spot'];
const TWO_POINT = ['zone', 'ellipse', 'spot'];

export const isDrawTool = (t) => DRAW_TOOLS.includes(t);

function dist2seg(px, py, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  let t = len ? ((px - a[0]) * dx + (py - a[1]) * dy) / len : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a[0] + dx * t), py - (a[1] + dy * t));
}

export function hitObject(rect, bx, by) {
  const f = frame();
  const order = ['ball', 'player', 'keeper', 'referee', 'label', 'mannequin', 'flag', 'disc', 'cone', 'minigoal', 'hurdle', 'ladder'];
  const list = state.doc.objects.slice().sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  const [mx, my] = toPx(rect, bx, by);
  for (const o of list) {
    const p = f.pos[o.id];
    if (!p) continue;
    const r = markerRadius(rect, o.kind, o.size || 1) * (o.kind === 'label' ? 2.2 : 1.3);
    const [ox, oy] = toPx(rect, p.x, p.y);
    if (Math.hypot(mx - ox, my - oy) <= r) return o;
  }
  return null;
}

export function hitShape(rect, bx, by) {
  const shapes = shapesOf();
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i];
    if (s.type === 'zone' || s.type === 'ellipse' || s.type === 'spot' || s.type === 'poly') {
      const pts = s.type === 'poly' ? s.pts : (() => {
        const [a, b] = s.pts;
        return [[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]]];
      })();
      for (let k = 0; k < pts.length; k++) {
        const d = dist2seg(bx, by, pts[k], pts[(k + 1) % pts.length]);
        if (d * rect.w < 11) return s;
      }
      if (s.fill > 0.05 && pointInPoly(bx, by, pts)) return s;
      continue;
    }
    const p = shapePoints(rect, s).map(([x, y]) => toBoard(rect, x, y));
    for (let k = 1; k < p.length; k++) {
      if (dist2seg(bx, by, p[k - 1], p[k]) * rect.w < 11) return s;
    }
  }
  return null;
}

function pointInPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function hitHandle(rect, bx, by) {
  const sel = selection.shapes();
  if (sel.length !== 1) return null;
  const s = sel[0];
  const [mx, my] = toPx(rect, bx, by);
  for (const h of shapeHandles(rect, s)) {
    const [hx, hy] = toPx(rect, h.x, h.y);
    if (Math.hypot(mx - hx, my - hy) <= 10) return { shape: s, handle: h };
  }
  return null;
}

export function attach(canvas, api) {
  const pointers = new Map();
  let drag = null;
  let draft = null;
  let poly = null;          // polygon in progress
  let spaceDown = false;
  let pinch = null;

  const local = (ev) => {
    const r = canvas.getBoundingClientRect();
    return [ev.clientX - r.left, ev.clientY - r.top];
  };

  const boardPoint = (ev, allowSnap = true) => {
    const rect = api.rect();
    const [px, py] = local(ev);
    let [bx, by] = toBoard(rect, px, py);
    if (allowSnap && !ev.altKey) {
      const s = snap(bx, by, { pitchKey: state.doc.pitch, rect, enabled: state.snap, grid: state.doc.grid });
      state.guides = s.guides;
      return [s.x, s.y];
    }
    state.guides = [];
    return [bx, by];
  };

  /* ---------------- placement ---------------- */

  function placeAt(bx, by) {
    const p = state.place;
    if (!p) return;
    edit(() => {
      const o = addObject({
        kind: p.kind,
        team: p.team || null,
        num: p.team && (p.kind === 'player' || p.kind === 'keeper') ? nextNumber(p.team) : '',
        color: p.color || null,
      }, bx, by);
      selection.set('object', o.id);
    });
    state.guides = [];
    api.afterEdit();
  }

  /* ---------------- gestures ---------------- */

  function down(ev) {
    if (state.playing) return;
    pointers.set(ev.pointerId, local(ev));
    canvas.setPointerCapture(ev.pointerId);

    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = {
        dist: Math.hypot(a[0] - b[0], a[1] - b[1]),
        mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
      };
      drag = null;
      draft = null;
      return;
    }

    const rect = api.rect();
    const [px, py] = local(ev);
    const middle = ev.button === 1;

    if (spaceDown || middle) {
      drag = { kind: 'pan', px, py };
      canvas.style.cursor = 'grabbing';
      return;
    }

    if (state.place) {
      const [bx, by] = boardPoint(ev);
      placeAt(bx, by);
      return;
    }

    const tool = state.tool;

    if (tool === 'poly') {
      const [bx, by] = boardPoint(ev);
      if (!poly) poly = { type: 'poly', pts: [[bx, by]], color: state.color, width: state.width, fill: state.fillOpacity, opacity: state.opacity, dash: state.dash };
      else poly.pts.push([bx, by]);
      api.render({ ...poly, pts: [...poly.pts, [bx, by]] }, true);
      api.status('tools.polyHint');
      return;
    }

    if (tool === 'select') {
      const [bxRaw, byRaw] = toBoard(rect, px, py);
      const handle = hitHandle(rect, bxRaw, byRaw);
      if (handle) {
        snapshot();
        drag = { kind: 'handle', shape: handle.shape, handle: handle.handle, moved: false };
        return;
      }
      const o = hitObject(rect, bxRaw, byRaw);
      if (o) {
        if (ev.shiftKey) selection.toggle('object', o.id);
        else if (!selection.has(o.id)) selection.set('object', o.id);
        api.select();
        const targets = selection.objects().filter((x) => !x.locked);
        if (targets.length && !o.locked) {
          snapshot();
          const f = frame();
          drag = {
            kind: 'objects',
            moved: false,
            all: ev.shiftKey && !ev.altKey && selection.objects().length === 1,
            anchor: o.id,
            start: [bxRaw, byRaw],
            items: targets.map((x) => ({ id: x.id, x: f.pos[x.id].x, y: f.pos[x.id].y })),
          };
        }
        api.render();
        return;
      }
      const s = hitShape(rect, bxRaw, byRaw);
      if (s) {
        if (ev.shiftKey) selection.toggle('shape', s.id);
        else if (!selection.has(s.id)) selection.set('shape', s.id);
        api.select();
        snapshot();
        drag = { kind: 'shape', id: s.id, ox: bxRaw, oy: byRaw, moved: false };
        api.render();
        return;
      }
      if (!ev.shiftKey) selection.clear();
      drag = { kind: 'marquee', x0: px, y0: py, x1: px, y1: py, additive: ev.shiftKey };
      api.select();
      api.render();
      return;
    }

    if (tool === 'erase') {
      const [bx, by] = toBoard(rect, px, py);
      const o = hitObject(rect, bx, by);
      if (o) { edit(() => removeObject(o.id)); selection.clear(); api.afterEdit(); return; }
      const s = hitShape(rect, bx, by);
      if (s) { edit(() => removeShape(s.id)); api.afterEdit(); }
      return;
    }

    if (tool === 'text') {
      const [bx, by] = boardPoint(ev);
      api.askText().then((txt) => {
        if (!txt) return;
        edit(() => {
          const o = addObject({ kind: 'label', name: txt, color: state.color }, bx, by);
          selection.set('object', o.id);
        });
        api.setTool('select');
        api.afterEdit();
      });
      return;
    }

    if (isDrawTool(tool)) {
      const [bx, by] = boardPoint(ev);
      draft = {
        type: tool, pts: [[bx, by], [bx, by]],
        color: state.color, width: state.width,
        opacity: state.opacity, fill: state.fillOpacity, dash: state.dash,
      };
      drag = { kind: 'draw', straight: ev.shiftKey };
      api.render(draft);
    }
  }

  function move(ev) {
    if (pointers.has(ev.pointerId)) pointers.set(ev.pointerId, local(ev));

    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const base = api.base();
      if (pinch.dist > 0) zoomAt(base, mid[0], mid[1], dist / pinch.dist);
      panBy(mid[0] - pinch.mid[0], mid[1] - pinch.mid[1]);
      clampPan(base, canvas.clientWidth, canvas.clientHeight);
      pinch = { dist, mid };
      api.viewChanged();
      return;
    }

    if (!drag) {
      if (poly) {
        const [bx, by] = boardPoint(ev);
        api.render({ ...poly, pts: [...poly.pts, [bx, by]] }, true);
      }
      return;
    }

    const rect = api.rect();
    const [px, py] = local(ev);

    if (drag.kind === 'pan') {
      panBy(px - drag.px, py - drag.py);
      drag.px = px; drag.py = py;
      clampPan(api.base(), canvas.clientWidth, canvas.clientHeight);
      api.viewChanged();
      return;
    }

    if (drag.kind === 'marquee') {
      drag.x1 = px; drag.y1 = py;
      api.render();
      api.marquee(drag);
      return;
    }

    if (drag.kind === 'objects') {
      drag.moved = true;
      const [bx, by] = boardPoint(ev);
      const dx = bx - drag.start[0], dy = by - drag.start[1];
      for (const it of drag.items) {
        const nx = it.x + dx, ny = it.y + dy;
        if (drag.all) state.doc.frames.forEach((_, i) => setPos(it.id, nx, ny, i));
        else setPos(it.id, nx, ny);
      }
      api.render();
      return;
    }

    if (drag.kind === 'shape') {
      drag.moved = true;
      const s = findShape(drag.id);
      if (s) {
        const [bx, by] = toBoard(rect, px, py);
        const dx = bx - drag.ox, dy = by - drag.oy;
        s.pts = s.pts.map(([x, y]) => [x + dx, y + dy]);
        if (s.ctrl) s.ctrl = [s.ctrl[0] + dx, s.ctrl[1] + dy];
        drag.ox = bx; drag.oy = by;
      }
      api.render();
      return;
    }

    if (drag.kind === 'handle') {
      drag.moved = true;
      const [bx, by] = boardPoint(ev);
      const s = drag.shape, h = drag.handle;
      if (h.kind === 'ctrl') s.ctrl = [bx, by];
      else if (s.type === 'zone' || s.type === 'ellipse' || s.type === 'spot') {
        const [a, b] = s.pts;
        if (h.i === 0) s.pts = [[bx, by], b];
        else if (h.i === 1) s.pts = [a, [bx, by]];
        else if (h.i === 2) s.pts = [[bx, a[1]], [b[0], by]];
        else s.pts = [[a[0], by], [bx, b[1]]];
      } else {
        s.pts[h.i] = [bx, by];
      }
      api.render();
      return;
    }

    if (drag.kind === 'draw' && draft) {
      const [bx, by] = boardPoint(ev, draft.type !== 'pen');
      // Every tool except free draw is a two point shape; curves come from the
      // control handle you pull afterwards.
      if (draft.type !== 'pen') {
        draft.pts[1] = [bx, by];
      } else {
        const last = draft.pts[draft.pts.length - 1];
        if (Math.hypot(bx - last[0], by - last[1]) * rect.w > 4) draft.pts.push([bx, by]);
        else draft.pts[draft.pts.length - 1] = [bx, by];
      }
      api.render(draft);
    }
  }

  function up(ev) {
    pointers.delete(ev.pointerId);
    if (pointers.size < 2) pinch = null;
    canvas.style.cursor = '';
    if (!drag) return;

    if (drag.kind === 'draw' && draft) {
      const rect = api.rect();
      let len = 0;
      for (let i = 1; i < draft.pts.length; i++) {
        len += Math.hypot(draft.pts[i][0] - draft.pts[i - 1][0], draft.pts[i][1] - draft.pts[i - 1][1]);
      }
      if (len * rect.w > 8) {
        if (drag.straight && draft.pts.length > 2) draft.pts = [draft.pts[0], draft.pts[draft.pts.length - 1]];
        const shape = draft;
        edit(() => {
          const s = addShape(shape);
          selection.set('shape', s.id);
        });
      }
      draft = null;
      state.guides = [];
      drag = null;
      api.afterEdit();
      return;
    }

    if (drag.kind === 'marquee') {
      const rect = api.rect();
      const [x0, y0] = toBoard(rect, Math.min(drag.x0, drag.x1), Math.min(drag.y0, drag.y1));
      const [x1, y1] = toBoard(rect, Math.max(drag.x0, drag.x1), Math.max(drag.y0, drag.y1));
      if (Math.abs(drag.x1 - drag.x0) > 4 || Math.abs(drag.y1 - drag.y0) > 4) {
        if (!drag.additive) selection.clear();
        const f = frame();
        for (const o of state.doc.objects) {
          const p = f.pos[o.id];
          if (p && p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) selection.add('object', o.id);
        }
        for (const s of shapesOf()) {
          if (s.pts.every(([x, y]) => x >= x0 && x <= x1 && y >= y0 && y <= y1)) selection.add('shape', s.id);
        }
      }
      drag = null;
      api.marquee(null);
      api.select();
      api.render();
      return;
    }

    if (drag.moved) commit();
    state.guides = [];
    drag = null;
    api.render();
    api.afterEdit();
  }

  function wheel(ev) {
    ev.preventDefault();
    const base = api.base();
    const [px, py] = local(ev);
    if (ev.ctrlKey || ev.metaKey || !ev.shiftKey) {
      const factor = Math.exp(-ev.deltaY * (ev.ctrlKey ? 0.01 : 0.0016));
      zoomAt(base, px, py, factor);
    } else {
      panBy(-ev.deltaX, -ev.deltaY);
    }
    clampPan(base, canvas.clientWidth, canvas.clientHeight);
    api.viewChanged();
  }

  function closePoly() {
    if (poly && poly.pts.length >= 3) {
      const shape = poly;
      edit(() => {
        const s = addShape(shape);
        selection.set('shape', s.id);
      });
    }
    poly = null;
    api.render(null);
    api.afterEdit();
  }

  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', wheel, { passive: false });
  canvas.addEventListener('dblclick', (ev) => {
    if (poly) { closePoly(); return; }
    const rect = api.rect();
    const [px, py] = local(ev);
    const [bx, by] = toBoard(rect, px, py);
    const o = hitObject(rect, bx, by);
    if (o) {
      selection.set('object', o.id);
      api.select(true);
    }
  });
  canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());

  window.addEventListener('keydown', (ev) => {
    if (ev.code === 'Space' && !spaceDown) {
      const tag = (ev.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      spaceDown = true;
      canvas.style.cursor = 'grab';
    }
    if (ev.key === 'Enter' && poly) closePoly();
    if (ev.key === 'Escape') {
      if (poly) { poly = null; api.render(null); }
      if (state.place) api.cancelPlace();
    }
  });
  window.addEventListener('keyup', (ev) => {
    if (ev.code === 'Space') { spaceDown = false; canvas.style.cursor = ''; }
  });

  return {
    cancelPoly() { poly = null; },
    hasPoly: () => !!poly,
  };
}
