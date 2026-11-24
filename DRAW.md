# The whiteboard: drawing a level freehand

The user (2026-11-24): "i dont want to draw on a grid. more freely. and with options to add deco (and view with / without)";
"we can draw, say where we want to click, and some deco by painting, which will be turned into proper blocks"; "its not
1:1 to what to play in the game ... it has to be redone properly, or reporting the user something is off"; "we could do
all of that in the viewer as well". Owner: the whiteboard thread (2026-11-24); the drawing -> fair level rules are
SKETCH.md's.

Page: `viewer/draw.html` (PC: http://localhost:8765/viewer/draw.html, or ⚙ view -> ✏ whiteboard in the viewer; phone: the
private Artifact, link in `local/phone/draw_url.txt`). Code: `lib/sketch.js` (sketch -> level, node and browser),
`viewer/draw_worker.js` (the solver off the page's thread), `viewer/draw_songs.js` (beat grids known everywhere),
`tools/sketch.js` (a saved sketch -> .gdlvl + report, `--wip` as a layout stage), `tools/draw_web.js` (the phone build).
Tests: `node tests/sketch.js` (the converter), `node tests/draw_page.js [--shots dir]` (the page headless, phone and PC).

## What is on the board

- **No grid.** Board units are level units (30 = a block, y up, ground at 0, the player starts at x 0). One finger draws,
  two fingers move and zoom (mouse: right-drag, wheel, Ctrl+wheel). Strokes are smoothed (Ramer-Douglas-Peucker, 1.2 px)
  and keep their exact place; "faint block guides" in ☰ only if wanted.
- **Pens** (1-6): ground, blocks, spikes, deco (colour, width, behind / in front), I jump here (tap = a jump, drag = a
  hold), note (for Claude, never in the level).
- **Stamps** (●): orbs, pads, mode portals, gravity / size, speed, spike / saws / block / slab, and every prop of
  `lib/props.js` (tree, cloud, house, moon...). The last 6 used stay one tap away. ⬚ select: move, turn 15°, size,
  mirror, copy, delete, and change an orb / pad / portal's type.
- **sketch / level**: the strokes, or what they become as GD objects (drawn like the game, no game art).
  **deco 👁 / ⊘**: every deco (lines and props) shown or hidden, in both views.
- **♪**: the song and its beat grid. Bar lines, numbered bars, the song's section changes (▲ +10 dB = Ragnarok's drop at
  bar 18) and a loudness strip. Grids: `viewer/draw_songs.js` (committed numbers, Ragnarok's song 343707 for now; add more
  from `local/beats/<key>.json` the same way) and, on the PC, every grid in `local/beats.local.js`. ▶♪ plays the song with a
  playhead at level speed (the PC serves the mp3; on the phone: pick the file).
- **✓ check**: the jump marks replayed (yellow dashed path; "your jumps die here"), then the solver in a Worker (green path,
  its presses as green ticks; or "nothing gets past here"); stops after 60 s. ▶ replays it. **🎮** plays it with
  `lib/liveplay.js` (tap / space; deaths stay as red crosses until "clear death marks").
- Sketches save in the browser at once and, a moment later, where Claude reads them: `local/sketches/<id>.json` through
  `tools/serve.js` (POST /sketches, GET /sketches/list) on the PC, the Artifact's db collection `sketches` on the phone.
  Each side also loads the sketches the other has (newest copy wins). ☰: new, duplicate, rename, start speed, ⬇ .gdlvl,
  ⬇ .json, ✉ send to Claude (saves now).

## Reading strokes (lib/sketch.js)

- ground line: columns 30 wide from where the stroke starts (not on the grid); per column the climb over it picks flat
  block (top at the drawn height), 22° slope (two columns), 45° slope, or a wall; filled down to the ground. Drops are
  steps. Nothing is placed for a part drawn on the ground.
- blocks line: a block every 30 units along it (lying: top on the line; standing: centred).
- spikes line: a spike every 30 units standing on the line, turned to it (upright within 12°); next to a solid they point
  away from it (under a ceiling: hanging). "flip spikes" on a selected line turns them over.
- a ground / blocks / spikes stroke that closes on itself is an AREA: blocks fill it, spikes line its floor.
- deco line: one stretched square (211, scale keys 128 / 129) per straight piece, its colour a channel from 800 up in the
  header; props come from `lib/props.js` with their channels; key 155 is never written.
- stamps: the object at the exact spot, rotation, scale (key 32).
- jump marks: input events at the time the player reaches that x (through the speed stamps): `planEvents`.

## From the board to a level (the design, 2026-11-24, agreed in the thread before building)

The drawing is intent. The rebuild keeps the user's clicks fixed and moves blocks, never the clicks (beat-first, as
`tools/hitbuild.js` / GDLM 62):
1. path first: the jump marks replayed give the player's path at once (that is the replay while drawing);
2. cells: the board is cut at the jump marks; in each cell the drawn thing says what goes there (spike area -> spikes
   that fit under that jump's arc, ground -> blocks / slopes with the landing matched, orb -> onto the arc where the press
   takes it, pad -> where the path lands);
3. fit by replay: each piece is moved until its click sits in the middle of its timing window, replaying from the state
   saved at the cell's first mark (lib/runcache.js);
4. only what changed is rebuilt: an edit rebuilds from the mark before it; later cells are re-checked, kept while the run
   rejoins the same state;
5. in a Worker, a moment after the finger lifts; the touched cell replays as a short loop;
6. each cell shows ✓ built as drawn, ~ adjusted (an arrow from the stroke to the block, at most ~1 block / ~30 %), ✕ a
   problem with a one-tap choice ("5 spikes can't be one jump at this speed: make it 3 / add an orb / keep it, Claude
   fixes it"); a jump mark with nothing to jump is an extra press.
Then "send to Claude" -> the session's full pass (SKETCH.md, BUILDING.md: look, sync, fairness, score.js, viewer stages).

## Status and open

- Built (first version): the board, pens, areas, stamps, props, deco toggle, sketch / level views, beats + sections +
  loudness for Ragnarok's song, song playhead, check (marks + solver), replay, play, sync to local/sketches and the
  phone's db, .gdlvl export, `tools/sketch.js`.
- Open, in order: the cell builder above (path -> spikes / ground cells -> orbs / pads -> ✕ choices); the board inside the
  viewer itself (the user: "all in one place"); tracing over an existing level; flying modes (the ground pen means little
  in a ship part: corridor pens); undo across reloads; more songs in draw_songs.js; timing not measured yet.
