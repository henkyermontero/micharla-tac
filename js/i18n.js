// i18n.js - Spanish first, English available. t('a.b') reads a nested key.
import './legacy.js';

const DICT = {
  es: {
    brand: { name: 'MiCharla Tac', tagline: 'Pizarra táctica 11 vs 11' },
    top: {
      title: 'Título de la jugada', undo: 'Deshacer', redo: 'Rehacer',
      library: 'Mis pizarras', save: 'Guardar', menu: 'Menú', exportBtn: 'Exportar',
      share: 'Copiar enlace', help: 'Atajos y ayuda', panels: 'Paneles',
      animate: 'Modo animación', edit: 'Modo edición',
    },
    menu: {
      png: 'Imagen de este cuadro (PNG)', sheet: 'Guion imprimible (todos los cuadros)',
      video: 'Video de la animación', svg: 'Vector de este cuadro (SVG)',
      json: 'Descargar archivo de la jugada', import: 'Abrir archivo de jugada...',
      save: 'Guardar en este navegador', library: 'Mis pizarras', share: 'Copiar enlace',
      help: 'Atajos y ayuda', exportAll: 'Exportar...',
    },
    tabs: { squad: 'Plantilla', frame: 'Cuadro', board: 'Pizarra' },
    squad: {
      home: 'Local', away: 'Visitante', formation: 'Formación...', addPlayer: '+ Jugador',
      equipment: 'Material', fillTeam: 'Llenar 11', mirror: 'Espejar equipo',
      kickoff: 'Volver al saque', clearDrawings: 'Borrar dibujos',
    },
    kinds: {
      player: 'Jugador', keeper: 'Portero', ball: 'Balón', cone: 'Cono', disc: 'Plato',
      mannequin: 'Maniquí', minigoal: 'Mini arco', flag: 'Pica', ladder: 'Escalera',
      hurdle: 'Valla', referee: 'Árbitro', label: 'Texto',
    },
    sel: {
      title: 'Selección', number: 'Núm.', name: 'Nombre', color: 'Color', size: 'Tamaño',
      rotation: 'Giro', hideNumber: 'Ocultar número', lock: 'Bloquear', locked: 'Bloqueado',
      duplicate: 'Duplicar', front: 'Al frente', back: 'Al fondo', delete: 'Eliminar',
      width: 'Grosor', opacity: 'Opacidad', fill: 'Relleno', dash: 'Discontinua',
      arrow: 'Punta de flecha', many: 'elementos seleccionados', none: 'Nada seleccionado',
      hint: 'Haz clic en una ficha o dibujo para editarlo.',
    },
    frame: {
      label: 'Fase', labelPh: 'Salida, Disparador, Definición...',
      duration: 'Duración de la transición', note: 'Nota del entrenador',
      notePh: 'Qué pasa en este paso...', add: '+ Nuevo cuadro', dup: 'Duplicar',
      del: 'Eliminar', clear: 'Borrar dibujos', easing: 'Movimiento',
      easeInOut: 'Suave (entra y sale)', linear: 'Lineal',
      persist: 'Mantener el dibujo en todos los cuadros',
      assist: 'Ayudas', trails: 'Ver hacia dónde va cada ficha',
      onion: 'Papel cebolla del cuadro anterior',
      tip: 'Truco: arrastra una ficha con Shift para moverla en todos los cuadros a la vez.',
    },
    board: {
      pitch: 'Campo', surface: 'Superficie', stripes: 'Franjas de corte',
      numbers: 'Ver números', names: 'Ver nombres', markerSize: 'Tamaño de las fichas',
      thirds: 'Ver tercios y carriles', grid: 'Rejilla', snap: 'Imán a puntos del campo',
      language: 'Idioma', danger: 'Zona de riesgo', clearAll: 'Borrar todos los dibujos',
      reset: 'Pizarra nueva', resetAsk: '¿Empezar una pizarra nueva? Se pierde lo que no hayas guardado.',
    },
    themes: { grass: 'Césped', night: 'Noche', chalk: 'Pizarrón', slate: 'Gris', sand: 'Arena' },
    pitches: {
      full: '11 v 11 completo', half: '11 v 11 medio campo', vertical: 'Completo vertical',
      vhalf: 'Medio campo vertical', third: 'Último tercio', nine: '9 v 9 base',
      seven: '7 v 7 base', futsal: 'Futsal', beach: 'Fútbol playa',
      grid: 'Rejilla de entrenamiento', blank: 'Pizarra en blanco',
    },
    tools: {
      select: 'Seleccionar y mover', pass: 'Pase: flecha continua',
      run: 'Desmarque sin balón: flecha punteada', dribble: 'Conducción: flecha ondulada',
      shot: 'Remate: flecha gruesa', line: 'Línea recta', pen: 'Dibujo libre',
      zone: 'Zona rectangular', ellipse: 'Zona ovalada', poly: 'Zona libre (clic a clic)',
      block: 'Bloqueo o pantalla', spot: 'Foco de atención', text: 'Texto',
      erase: 'Borrador: toca un dibujo o una ficha', place: 'Colocar fichas',
      colour: 'Color de tinta', thin: 'Línea fina', medium: 'Línea media', thick: 'Línea gruesa',
      polyHint: 'Haz clic en cada vértice. Enter o doble clic para cerrar.',
    },
    place: {
      home: 'Jugador local', away: 'Jugador visitante', gkHome: 'Portero local',
      gkAway: 'Portero visitante', hint: 'Haz clic en el campo para colocar. Esc para salir.',
      active: 'Colocando', palette: 'Fichas rápidas',
    },
    time: {
      play: 'Reproducir', pause: 'Pausa', prev: 'Cuadro anterior', next: 'Cuadro siguiente',
      loop: 'Repetir', speed: 'Velocidad', add: '+ Cuadro', frame: 'Cuadro', of: 'de',
      playing: 'Reproduciendo', total: 'Total',
    },
    zoom: { in: 'Acercar', out: 'Alejar', fit: 'Ajustar', reset: 'Ajustar a la pantalla' },
    toast: {
      saved: 'Guardado en este navegador', linkCopied: 'Enlace copiado',
      linkBar: 'El enlace está en la barra de direcciones',
      linkFail: 'No se pudo crear el enlace', tooBig: 'La jugada es muy grande para un enlace, usa el archivo',
      png: 'Imagen descargada', sheet: 'Guion descargado', svg: 'SVG descargado',
      json: 'Archivo descargado', loaded: 'Jugada cargada', badFile: 'No se pudo leer ese archivo',
      recording: 'Grabando la animación...', video: 'Video descargado',
      needFrames: 'Agrega al menos dos cuadros para grabar', duplicated: 'Ficha duplicada',
      copied: 'Copiado', deleted: 'Eliminado',
    },
    welcome: {
      title: 'Fútbol 11 v 11: esquemas y animaciones',
      b1: 'Dibuja el esquema y descarga la imagen',
      b2: 'Anima la jugada cuadro a cuadro y exporta el video',
      b3: 'Comparte por enlace y guarda tu colección',
      start: 'Empezar en el campo', tour: 'Ver cómo funciona',
    },
    empty: {
      title: 'Pizarra vacía', body: 'Empieza con un 4-3-3 o construye desde cero.',
      apply: 'Aplicar 4-3-3', blank: 'Empezar en blanco',
    },
    coach: {
      animate: 'Mueve las fichas, agrega un cuadro y pulsa Reproducir.',
      gotIt: 'Entendido',
    },
    lib: {
      title: 'Mis pizarras', empty: 'Todavía no guardaste ninguna jugada.',
      open: 'Abrir', del: 'Borrar', frames: 'cuadros', close: 'Cerrar',
      search: 'Buscar...', dup: 'Duplicar',
    },
    help: {
      title: 'MiCharla Tac', sub: 'Todo corre en tu navegador. Nada se sube, no hace falta cuenta.',
      tools: 'Herramientas', board: 'Pizarra', how: 'Cómo funciona la animación',
      howBody: 'Cada cuadro es una foto. Mueve a los jugadores en el cuadro 1, pulsa Nuevo cuadro, muévelos otra vez y la pizarra interpola el movimiento. Las flechas que dibujas en un cuadro se van trazando mientras ese paso se reproduce.',
      ok: 'Entendido',
    },
    keys: {
      select: 'Seleccionar y mover', pass: 'Pase', run: 'Desmarque', dribble: 'Conducción',
      shot: 'Remate', lines: 'Línea, dibujo libre', zones: 'Zona, óvalo, zona libre',
      text: 'Texto, borrador', play: 'Reproducir o pausar', newFrame: 'Nuevo cuadro',
      frames: 'Cuadro anterior / siguiente', nudge: 'Mover la selección',
      del: 'Eliminar la selección', allFrames: 'Mover en todos los cuadros',
      straight: 'Línea recta', save: 'Guardar', undo: 'Deshacer (con Shift, rehacer)',
      dup: 'Duplicar', zoom: 'Acercar / alejar', pan: 'Mover la vista', esc: 'Salir del modo colocar',
    },
  },
  en: {
    brand: { name: 'MiCharla Tac', tagline: '11 v 11 tactical board' },
    top: {
      title: 'Play title', undo: 'Undo', redo: 'Redo', library: 'My boards', save: 'Save',
      menu: 'Menu', exportBtn: 'Export', share: 'Copy link', help: 'Shortcuts and help',
      panels: 'Panels', animate: 'Animation mode', edit: 'Edit mode',
    },
    menu: {
      png: 'Image of this frame (PNG)', sheet: 'Printable playbook (all frames)',
      video: 'Animation video', svg: 'Vector of this frame (SVG)',
      json: 'Download play file', import: 'Open play file...',
      save: 'Save to this browser', library: 'My boards', share: 'Copy link',
      help: 'Shortcuts and help', exportAll: 'Export...',
    },
    tabs: { squad: 'Squad', frame: 'Frame', board: 'Board' },
    squad: {
      home: 'Home', away: 'Away', formation: 'Formation...', addPlayer: '+ Player',
      equipment: 'Equipment', fillTeam: 'Fill 11', mirror: 'Mirror team',
      kickoff: 'Reset to kickoff', clearDrawings: 'Clear drawings',
    },
    kinds: {
      player: 'Player', keeper: 'Goalkeeper', ball: 'Ball', cone: 'Cone', disc: 'Disc',
      mannequin: 'Mannequin', minigoal: 'Mini goal', flag: 'Pole', ladder: 'Ladder',
      hurdle: 'Hurdle', referee: 'Referee', label: 'Text',
    },
    sel: {
      title: 'Selection', number: 'No.', name: 'Name', color: 'Colour', size: 'Size',
      rotation: 'Rotation', hideNumber: 'Hide number', lock: 'Lock', locked: 'Locked',
      duplicate: 'Duplicate', front: 'Bring forward', back: 'Send back', delete: 'Delete',
      width: 'Width', opacity: 'Opacity', fill: 'Fill', dash: 'Dashed', arrow: 'Arrowhead',
      many: 'items selected', none: 'Nothing selected',
      hint: 'Click a token or a drawing to edit it.',
    },
    frame: {
      label: 'Phase', labelPh: 'Build-up, Trigger, Finish...',
      duration: 'Transition time', note: 'Coaching note', notePh: 'What happens in this step...',
      add: '+ New frame', dup: 'Duplicate', del: 'Delete', clear: 'Clear drawings',
      easing: 'Movement', easeInOut: 'Smooth (ease in and out)', linear: 'Linear',
      persist: 'Keep the drawings on the following frames', assist: 'Assistance',
      trails: 'Show where each token is heading', onion: 'Onion skin of the previous frame',
      tip: 'Tip: drag a token with Shift to move it on every frame at once.',
    },
    board: {
      pitch: 'Pitch', surface: 'Surface', stripes: 'Mowing stripes', numbers: 'Show numbers',
      names: 'Show names', markerSize: 'Token size', thirds: 'Show thirds and channels',
      grid: 'Grid', snap: 'Snap to pitch landmarks', language: 'Language',
      danger: 'Danger zone', clearAll: 'Clear all drawings', reset: 'New board',
      resetAsk: 'Start a new board? Unsaved work is lost.',
    },
    themes: { grass: 'Grass', night: 'Night', chalk: 'Whiteboard', slate: 'Slate', sand: 'Sand' },
    pitches: {
      full: '11 v 11 full', half: '11 v 11 half', vertical: 'Full portrait',
      vhalf: 'Half portrait', third: 'Final third', nine: '9 v 9 youth', seven: '7 v 7 youth',
      futsal: 'Futsal', beach: 'Beach soccer', grid: 'Training grid', blank: 'Blank board',
    },
    tools: {
      select: 'Select and move', pass: 'Pass: solid arrow', run: 'Run without the ball: dashed arrow',
      dribble: 'Dribble: wavy arrow', shot: 'Shot: thick arrow', line: 'Straight line',
      pen: 'Free draw', zone: 'Zone box', ellipse: 'Ellipse zone', poly: 'Free zone (click to click)',
      block: 'Block or screen', spot: 'Spotlight', text: 'Text',
      erase: 'Eraser: tap a drawing or a token', place: 'Place tokens', colour: 'Ink colour', thin: 'Thin line',
      medium: 'Medium line', thick: 'Thick line',
      polyHint: 'Click each corner. Enter or double click to close.',
    },
    place: {
      home: 'Home player', away: 'Away player', gkHome: 'Home keeper', gkAway: 'Away keeper',
      hint: 'Click the pitch to place. Esc to stop.', active: 'Placing', palette: 'Quick tokens',
    },
    time: {
      play: 'Play', pause: 'Pause', prev: 'Previous frame', next: 'Next frame', loop: 'Loop',
      speed: 'Speed', add: '+ Frame', frame: 'Frame', of: 'of', playing: 'Playing', total: 'Total',
    },
    zoom: { in: 'Zoom in', out: 'Zoom out', fit: 'Fit', reset: 'Fit to screen' },
    toast: {
      saved: 'Saved to this browser', linkCopied: 'Link copied', linkBar: 'The link is in the address bar',
      linkFail: 'Could not create the link', tooBig: 'Play too big for a link, use the file export',
      png: 'Image downloaded', sheet: 'Playbook downloaded', svg: 'SVG downloaded',
      json: 'File downloaded', loaded: 'Play loaded', badFile: 'That file could not be read',
      recording: 'Recording the animation...', video: 'Video downloaded',
      needFrames: 'Add at least two frames to record', duplicated: 'Token duplicated',
      copied: 'Copied', deleted: 'Deleted',
    },
    welcome: {
      title: 'Football 11 v 11: schemes and animations',
      b1: 'Draw the scheme and download the image',
      b2: 'Animate the play frame by frame and export the video',
      b3: 'Share by link and keep your collection',
      start: 'Start on the pitch', tour: 'See how it works (60s)',
    },
    empty: {
      title: 'Empty board', body: 'Start from a 4-3-3 or build from scratch.',
      apply: 'Apply 4-3-3', blank: 'Start blank',
    },
    coach: { animate: 'Move the tokens, add a frame and press Play.', gotIt: 'Got it' },
    lib: {
      title: 'My boards', empty: 'No saved plays yet.', open: 'Open', del: 'Delete',
      frames: 'frames', close: 'Close', search: 'Search...', dup: 'Duplicate',
    },
    help: {
      title: 'MiCharla Tac', sub: 'Everything runs in your browser. Nothing is uploaded, no account needed.',
      tools: 'Tools', board: 'Board', how: 'How the animation works',
      howBody: 'Every frame is a snapshot. Move the players on frame 1, press New frame, move them again, and the board interpolates the movement. Arrows you draw on a frame are revealed as that step plays.',
      ok: 'Got it',
    },
    keys: {
      select: 'Select and move', pass: 'Pass', run: 'Run', dribble: 'Dribble', shot: 'Shot',
      lines: 'Line, free draw', zones: 'Zone, ellipse, free zone', text: 'Text, eraser',
      play: 'Play or pause', newFrame: 'New frame', frames: 'Previous / next frame',
      nudge: 'Nudge the selection', del: 'Delete the selection', allFrames: 'Move on every frame',
      straight: 'Straight line', save: 'Save', undo: 'Undo (with Shift, redo)', dup: 'Duplicate',
      zoom: 'Zoom in / out', pan: 'Pan the view', esc: 'Leave placing mode',
    },
  },
};

const LS_LANG = 'micharlatac.lang';
export const LANGS = [['es', 'Español'], ['en', 'English']];

// Spanish is the product default; the switcher remembers a different choice.
let lang = 'es';
try {
  const saved = localStorage.getItem(LS_LANG);
  if (saved && DICT[saved]) lang = saved;
} catch {}

export const getLang = () => lang;

export function setLang(next) {
  if (!DICT[next]) return;
  lang = next;
  try { localStorage.setItem(LS_LANG, next); } catch {}
  document.documentElement.lang = next;
  applyI18n();
}

export function t(path) {
  const walk = (obj) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  const v = walk(DICT[lang]);
  return v === undefined ? (walk(DICT.es) ?? path) : v;
}

/** Fill every [data-i18n] element in the document. */
export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const s = t(el.dataset.i18nTitle);
    el.title = s;
    if (!el.hasAttribute('data-keep-aria')) el.setAttribute('aria-label', s);
  });
  root.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  document.documentElement.lang = lang;
}
