# Tactical Board Pro

A football tactical board that runs entirely in the browser. Build a play, animate it,
export an image or a video, share it with a link. No account, no server, no cost.

Inspired by tactical-board.com, rebuilt with the parts that matter for a coach:
real animation, a printable playbook, offline use and a phone-first layout.

## Run it

```bash
cd ~/tactical-board
python3 -m http.server 8787
# open http://localhost:8787
```

Any static host works (Vercel, GitHub Pages, Netlify). There is no build step.

```bash
vercel deploy --prod     # from this folder
```

## What it does

**Pitches** 11v11 full, 11v11 half, portrait full, portrait half, final third,
9v9, 7v7, futsal, beach soccer, training grid, blank board. Five surfaces
(grass, night, whiteboard, slate, sand) with optional mowing stripes.

**Squad** Two teams with editable names, colours, numbers and player names.
Formation presets per team size: 11 (4-4-2, 4-3-3, 4-2-3-1, 3-5-2, 5-3-2 and more),
9, 7 and futsal (diamond, square, Y, pivot). Equipment: ball, cones, mannequins,
mini goals, poles, ladders, hurdles, text labels.

**Drawing** Pass (solid arrow), run (dashed), dribble (wavy), shot (thick),
line, free draw, zone box, ellipse, block/screen, text, eraser. Eight ink colours,
three thicknesses. Hold Shift while drawing for a straight line.

**Animation** Every frame is a snapshot. Move the markers, add a frame, and the
board interpolates the movement with easing. Arrows drawn on a frame are revealed
as that step plays. Per-frame transition time, playback speed, loop, onion skin,
and a movement preview that shows where each marker is heading next.

**Export**
- PNG of the current frame (2000px wide)
- Printable playbook: every frame of the play on one sheet with its notes
- WebM video of the animation, recorded by the browser itself
- `.tboard.json` play file to save and reopen
- Share link: the whole play is compressed into the URL, nothing is uploaded

**Offline** A service worker caches the app, and it installs as a PWA. It works
on the training ground with no signal.

## Keyboard

| Key | Action |
| --- | --- |
| `V` | Select and move |
| `P` `R` `D` `S` | Pass, run, dribble, shot |
| `L` `F` `Z` `C` `B` | Line, free draw, zone, ellipse, block |
| `T` `E` | Text, eraser |
| `Space` | Play or pause |
| `N` | New frame |
| `,` `.` | Previous / next frame |
| Arrows | Nudge the selection (Shift for bigger steps) |
| `Delete` | Remove the selection |
| `Shift` + drag | Move a marker on every frame at once |
| `Cmd/Ctrl` + `S` | Save to this browser |
| `Cmd/Ctrl` + `Z` | Undo (add Shift to redo) |

## How it is built

Plain ES modules, no framework, no dependencies.

| File | Responsibility |
| --- | --- |
| `js/pitch.js` | Pitch specs in metres, projection, all field markings |
| `js/state.js` | Document model, frames, undo history, storage |
| `js/render.js` | Canvas painting: markers, drawings, interpolation |
| `js/interact.js` | Pointer and touch handling, hit testing, tools |
| `js/animate.js` | Playback clock |
| `js/export.js` | PNG, playbook sheet, WebM, JSON, share links |
| `js/main.js` | UI wiring: rail, panels, timeline, shortcuts |

Positions are stored as fractions of the visible board, so switching between
landscape, portrait and half pitch keeps every marker on the same spot of
the real pitch.

## Notes

- Video export produces `.webm` (Chrome, Edge and Firefox record it natively).
  Safari can play it but does not record; use the PNG or playbook there.
- Share links carry the whole play, so very large plays are better shared as a
  `.tboard.json` file.
