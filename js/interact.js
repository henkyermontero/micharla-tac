// interact.js - pointer handling, hit testing, tool behaviour.

import { state, frame, setPos, addShape, removeShape, removeObject, addObject, edit, snapshot, commit } from './state.js';
import { toBoard, toPx, markerRadius } from './render.js';

const DRAW_TOOLS = ['pass', 'run', 'dribble', 'shot', 'line', 'pen', 'zone', 'ellipse', 'block'];
const TWO_POINT = ['zone', 'ellipse'];

export function isDrawTool(t) { return DRAW_TOOLS.includes(t); }

function dist2seg(px, py, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  let t = len ? ((px - a[0]) * dx + (py - a[1]) * dy) / len : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a[0] + dx * t), py - (a[1] + dy * t));
}

export function hitObject(rect, bx, by) {
  const doc = state.doc;
  const f = frame();
  const order = ['ball', 'player', 'keeper', 'label', 'mannequin', 'flag', 'cone', 'minigoal', 'hurdle', 'ladder'];
  const list = doc.objects.slice().sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  for (const o of list) {
    const p = f.pos[o.id];
    if (!p) continue;
    const r = markerRadius(rect, o.kind) * (o.kind === 'label' ? 2.2 : 1.35);
    const [ox, oy] = toPx(rect, p.x, p.y);
    const [mx, my] = toPx(rect, bx, by);
    if (Math.hypot(mx - ox, my - oy) <= r) return o;
  }
  return null;
}

export function hitShape(rect, bx, by) {
  const shapes = frame().shapes;
  const tol = 10 / rect.w;
  for (let i = shapes.length - 1; i >= 0; i--) {
    const s = shapes[i];
    if (s.type === 'zone' || s.type === 'ellipse') {
      const [a, b] = s.pts;
      const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]);
      const y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
      const near = (v, e) => Math.abs(v - e) < tol * 2;
      const insideX = bx > x0 - tol && bx < x1 + tol;
      const insideY = by > y0 - tol && by < y1 + tol;
      if ((insideX && (near(by, y0) || near(by, y1))) || (insideY && (near(bx, x0) || near(bx, x1)))) return s;
      continue;
    }
    for (let k = 1; k < s.pts.length; k++) {
      const d = dist2seg(bx, by, s.pts[k - 1], s.pts[k]);
      if (d * rect.w < 10) return s;
    }
  }
  return null;
}

export function attach(canvas, ctxRef) {
  let drag = null;
  let draft = null;

  const pointer = (ev) => {
    const r = canvas.getBoundingClientRect();
    return [ev.clientX - r.left, ev.clientY - r.top];
  };

  function down(ev) {
    if (state.playing) return;
    canvas.setPointerCapture(ev.pointerId);
    const rect = ctxRef.rect();
    const [px, py] = pointer(ev);
    const [bx, by] = toBoard(rect, px, py);
    const tool = state.tool;

    if (tool === 'select') {
      const o = hitObject(rect, bx, by);
      if (o) {
        const p = frame().pos[o.id];
        snapshot();
        drag = { kind: 'object', id: o.id, dx: bx - p.x, dy: by - p.y, all: ev.shiftKey, moved: false };
        state.selection = { type: 'object', id: o.id };
        ctxRef.onSelect();
        ctxRef.render();
        return;
      }
      const s = hitShape(rect, bx, by);
      if (s) {
        snapshot();
        drag = { kind: 'shape', id: s.id, ox: bx, oy: by, moved: false };
        state.selection = { type: 'shape', id: s.id };
        ctxRef.onSelect();
        ctxRef.render();
        return;
      }
      state.selection = null;
      ctxRef.onSelect();
      ctxRef.render();
      return;
    }

    if (tool === 'erase') {
      const o = hitObject(rect, bx, by);
      if (o) { edit(() => removeObject(o.id)); ctxRef.onSelect(); ctxRef.render(); return; }
      const s = hitShape(rect, bx, by);
      if (s) { edit(() => removeShape(s.id)); ctxRef.render(); }
      return;
    }

    if (tool === 'text') {
      const txt = prompt('Text on the board:', '');
      if (txt && txt.trim()) {
        edit(() => { const o = addObject({ kind: 'label', name: txt.trim(), color: state.color }, bx, by); state.selection = { type: 'object', id: o.id }; });
        ctxRef.setTool('select');
        ctxRef.onSelect();
        ctxRef.render();
      }
      return;
    }

    if (isDrawTool(tool)) {
      draft = { type: tool, pts: [[bx, by], [bx, by]], color: state.color, width: state.width, dash: ev.altKey };
      drag = { kind: 'draw', straight: ev.shiftKey };
      ctxRef.render(draft);
    }
  }

  function move(ev) {
    if (!drag) return;
    const rect = ctxRef.rect();
    const [px, py] = pointer(ev);
    const [bx, by] = toBoard(rect, px, py);

    if (drag.kind === 'object') {
      drag.moved = true;
      const id = drag.id;
      const nx = bx - drag.dx, ny = by - drag.dy;
      if (drag.all) state.doc.frames.forEach((_, i) => setPos(id, nx, ny, i));
      else setPos(id, nx, ny);
      ctxRef.render();
      return;
    }
    if (drag.kind === 'shape') {
      drag.moved = true;
      const s = frame().shapes.find((x) => x.id === drag.id);
      if (s) {
        const dx = bx - drag.ox, dy = by - drag.oy;
        s.pts = s.pts.map(([x, y]) => [x + dx, y + dy]);
        drag.ox = bx; drag.oy = by;
      }
      ctxRef.render();
      return;
    }
    if (drag.kind === 'draw' && draft) {
      if (TWO_POINT.includes(draft.type) || drag.straight || draft.type === 'line' || draft.type === 'block') {
        draft.pts[1] = [bx, by];
      } else {
        const last = draft.pts[draft.pts.length - 1];
        if (Math.hypot(bx - last[0], by - last[1]) * rect.w > 4) draft.pts.push([bx, by]);
        else draft.pts[draft.pts.length - 1] = [bx, by];
      }
      ctxRef.render(draft);
    }
  }

  function up() {
    if (!drag) return;
    if (drag.kind === 'draw' && draft) {
      const rect = ctxRef.rect();
      const len = draft.pts.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - draft.pts[i - 1][0], p[1] - draft.pts[i - 1][1]) : 0), 0);
      if (len * rect.w > 8) {
        if (drag.straight && draft.pts.length > 2) draft.pts = [draft.pts[0], draft.pts[draft.pts.length - 1]];
        const shape = draft;
        edit(() => addShape(shape));
      }
      draft = null;
    } else if (drag.moved) {
      commit();
    }
    drag = null;
    ctxRef.render();
    ctxRef.afterEdit();
  }

  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('dblclick', (ev) => {
    const rect = ctxRef.rect();
    const [px, py] = pointer(ev);
    const [bx, by] = toBoard(rect, px, py);
    const o = hitObject(rect, bx, by);
    if (o) {
      state.selection = { type: 'object', id: o.id };
      ctxRef.onSelect(true);
    }
  });
  canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
  return { getDraft: () => draft };
}
