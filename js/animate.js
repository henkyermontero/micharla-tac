// animate.js - playback clock for the frame timeline.

import { state } from './state.js';

let raf = 0, last = 0;

export function totalDuration(doc) {
  return doc.frames.slice(0, -1).reduce((a, f) => a + (f.duration || 1000), 0);
}

export function stop(render) {
  state.playing = false;
  state.progress = 0;
  cancelAnimationFrame(raf);
  raf = 0;
  if (render) render();
}

export function play(render, onFrameChange) {
  if (state.doc.frames.length < 2) return;
  if (state.frame >= state.doc.frames.length - 1) { state.frame = 0; state.progress = 0; }
  state.playing = true;
  last = performance.now();
  const tick = (now) => {
    if (!state.playing) return;
    const dt = (now - last) * state.speed;
    last = now;
    const dur = state.doc.frames[state.frame].duration || 1000;
    state.progress += dt / dur;
    while (state.progress >= 1) {
      state.progress -= 1;
      state.frame++;
      if (state.frame >= state.doc.frames.length - 1) {
        state.frame = state.doc.frames.length - 1;
        state.progress = 0;
        if (state.loop) {
          state.frame = 0;
          if (onFrameChange) onFrameChange();
          break;
        }
        state.playing = false;
        render();
        if (onFrameChange) onFrameChange();
        return;
      }
      if (onFrameChange) onFrameChange();
    }
    render();
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

export function toggle(render, onFrameChange) {
  if (state.playing) stop(render);
  else play(render, onFrameChange);
}
