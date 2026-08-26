// legacy.js - carry storage across the two renames, before anything reads it.
//
// The app shipped as tactical-board, then PitchLab, now MiCharla Tac. Each
// rename moved the localStorage prefix, so a returning coach would open the
// board and find an empty library.
//
// This module has no imports on purpose and every module that touches
// localStorage imports it, so it is evaluated before their bodies run. That
// ordering is the whole point: i18n.js reads the saved language at module
// scope, and it used to read it before this ran, which silently reset a
// PitchLab user back to Spanish.
//
// Copies, never deletes: an old build still open in another tab keeps reading
// its own keys, and a value already written under the new name always wins.

const CHAIN = [
  ['micharlatac.library.v1', ['pitchlab.library.v1', 'tacticalboard.library.v2']],
  ['micharlatac.last.v1', ['pitchlab.last.v1', 'tacticalboard.last.v2']],
  ['micharlatac.lang', ['pitchlab.lang']],
  ['micharlatac.seen', ['pitchlab.seen']],
  ['micharlatac.coach.anim', ['pitchlab.coach.anim']],
];

try {
  for (const [to, sources] of CHAIN) {
    if (localStorage.getItem(to) !== null) continue;  // already migrated or set
    for (const from of sources) {                     // newest name first
      const v = localStorage.getItem(from);
      if (v !== null) { localStorage.setItem(to, v); break; }
    }
  }
} catch {}
