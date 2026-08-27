// present.js - modo presentacion: la pizarra sola, a pantalla completa, para la
// cancha. Sin barras ni paneles, controles grandes para el dedo, la pantalla no
// se apaga y el lienzo no dibuja: en este modo la pizarra solo se mira.
import { state, frame } from './state.js';
import { t } from './i18n.js';

const $ = (s) => document.querySelector(s);

const IDLE_MS = 4500;   // sin tocar nada, los controles se apartan
const SWIPE_PX = 44;    // deslizar menos que esto es un toque, no un cambio de cuadro

const PLAY_ICON = '<path d="M8 5.5l11 6.5-11 6.5z" fill="currentColor"/>';
const PAUSE_ICON = '<path d="M7 5h3.4v14H7zM13.6 5H17v14h-3.4z" fill="currentColor"/>';

/**
 * host: { playToggle, gotoFrame, resize }
 * Devuelve el control que main.js cablea a los botones y al teclado.
 */
export function attachPresent(host) {
  const app = $('#app');
  const ui = $('#present-ui');
  const catcher = $('#present-catch');
  const elPhase = $('#present-phase');
  const elNote = $('#present-note');
  const elCount = $('#present-count');
  const elPlay = $('#p-play');
  const elPlayIcon = $('#p-play-icon');

  let on = false;
  let idleTimer = 0;
  let lock = null;          // WakeLockSentinel
  let down = null;          // gesto en curso sobre el lienzo
  let shown = '';           // ultimo HUD pintado, para no tocar el DOM en cada cuadro

  /* ---------- la pantalla no se apaga ---------- */

  async function lockScreen() {
    if (lock || !navigator.wakeLock) return;
    try {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } catch { lock = null; }   // sin permiso o con poca bateria: el modo funciona igual
  }
  function unlockScreen() {
    try { lock?.release(); } catch {}
    lock = null;
  }

  /* ---------- controles que se apartan solos ---------- */

  function wake() {
    ui.classList.remove('idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (on) ui.classList.add('idle'); }, IDLE_MS);
  }

  /* ---------- el cartel de fase, la nota y el contador ---------- */

  function refresh() {
    if (!on) return;
    const f = frame();
    const n = state.doc.frames.length;
    const phase = (f.label || '').trim() || `${t('time.frame')} ${state.frame + 1}`;
    const note = (f.note || '').trim();
    const count = `${state.frame + 1} / ${n}`;
    const playing = !!state.playing;
    const key = `${phase}|${note}|${count}|${playing}`;
    if (key === shown) return;
    shown = key;
    elPhase.textContent = phase;
    elNote.textContent = note;
    elNote.hidden = !note;
    elCount.textContent = count;
    elPlayIcon.innerHTML = playing ? PAUSE_ICON : PLAY_ICON;
    elPlay.title = t(playing ? 'time.pause' : 'time.play');
  }

  /**
   * Lo que el cartel de fase y la barra le quitan al campo, medido de los
   * elementos. offsetTop y offsetHeight a proposito: la barra se aparta con un
   * transform y con getBoundingClientRect el campo saltaria cada vez que lo hace.
   */
  function insets() {
    if (!on) return null;
    const head = $('#present-head');
    const bar = $('#present-bar');
    return {
      top: head.offsetTop + head.offsetHeight + 8,
      bottom: ui.offsetHeight - bar.offsetTop + 8,
    };
  }

  /* ---------- entrar y salir ---------- */

  function set(next) {
    next = !!next;
    if (next === on) return;
    on = next;
    app.classList.toggle('present', on);
    ui.hidden = !on;
    shown = '';

    if (on) {
      wake();
      lockScreen();
      // El navegador puede negar la pantalla completa (iOS no la da fuera de un
      // video). El modo no depende de ella: la app ya es position:fixed.
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      clearTimeout(idleTimer);
      ui.classList.remove('idle');
      unlockScreen();
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    }

    // El cartel primero: resize() mide su alto para saber cuanto campo le queda.
    requestAnimationFrame(() => { refresh(); host.resize(); });
  }

  /* ---------- gestos sobre el lienzo ---------- */

  catcher.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY };
    wake();
  });
  catcher.addEventListener('pointerup', (e) => {
    if (!down) return;
    const dx = e.clientX - down.x;
    const dy = e.clientY - down.y;
    down = null;
    // Deslizar horizontal cambia de cuadro. Un toque solo despierta los controles
    // y nunca mueve la jugada: en la cancha se roza la tablet sin querer. Tampoco
    // los esconde: para eso esta el reloj, y asi un toque siempre hace lo mismo.
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.4) {
      host.gotoFrame(state.frame + (dx < 0 ? 1 : -1));
      refresh();
    }
  });
  catcher.addEventListener('pointercancel', () => { down = null; });
  catcher.addEventListener('pointermove', () => { if (!down) wake(); });

  /* ---------- el navegador puede sacarnos de pantalla completa ---------- */

  document.addEventListener('fullscreenchange', () => {
    if (on && !document.fullscreenElement) set(false);
  });
  document.addEventListener('visibilitychange', () => {
    if (on && !document.hidden) lockScreen();   // el wake lock se suelta al ocultar la pestana
  });

  /**
   * Teclas mientras se presenta. Devuelve true si la tecla ya se uso, para que
   * main.js no aplique encima un atajo de edicion.
   */
  function key(e) {
    if (!on) return false;
    wake();
    if (e.metaKey || e.ctrlKey || e.altKey) return true;
    const k = e.key;
    if (k === 'Escape' || k.toLowerCase() === 'm') { e.preventDefault(); set(false); return true; }
    if (k === ' ') { e.preventDefault(); host.playToggle(); refresh(); return true; }
    if (k === 'ArrowRight' || k === '.' || k === 'PageDown') {
      e.preventDefault(); host.gotoFrame(state.frame + 1); refresh(); return true;
    }
    if (k === 'ArrowLeft' || k === ',' || k === 'PageUp') {
      e.preventDefault(); host.gotoFrame(state.frame - 1); refresh(); return true;
    }
    return true;   // presentando no se edita: el resto de las teclas se traga
  }

  return { set, toggle: () => set(!on), isOn: () => on, refresh, key, wake, insets };
}
