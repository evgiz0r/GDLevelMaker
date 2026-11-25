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
Tests: `node tests/sketch.js` (the converter), `node tests/draw_page.js [--shots dir]` (the page headless, phone and PC),
`node tests/viewer_draw.js [--shots dir]` (✏ draw inside the viewer).

## What is on the board

- **No grid.** Board units are level units (30 = a block, y up, ground at 0, the player starts at x 0). One finger draws,
  two fingers move and zoom (mouse: right-drag, wheel, Ctrl+wheel). Strokes are smoothed (Ramer-Douglas-Peucker, 1.2 px)
  and keep their exact place; "faint block guides" in ☰ only if wanted.
- **Moving through the level** (the user: "how do i navigate back and forth, same as the replay"): the seek strip across
  the top of the board is the whole level in small (bars, sections, what is drawn, deaths, the visible window, the
  playhead); tap or drag it to jump there (the song marker comes along). The song's current time is the yellow marker:
  tap or drag the ruler under the strip to put it anywhere; ▶♪ starts there, and a pause leaves it (dashed, with the time). Keys: ←/→ (Shift: bigger steps), Home = the start. **Zoom**: － / ＋ buttons,
  pinch, Ctrl+wheel, keys - / +.
- **Pens** (1-6): ground, blocks, spikes, deco (colour, width, behind / in front), I jump here (tap = a jump, drag = a
  hold), note (for Claude, never in the level).
- **Stamps** (●): orbs, pads, mode portals, gravity / size, speed, spike / saws / block / slab, and every prop of
  `lib/props.js` (tree, cloud, house, moon...). The last 6 used stay one tap away. ⬚ select: move, turn 15°, size,
  mirror, copy, delete, and change an orb / pad / portal's type.
- **sketch / level**: the strokes, or what they become as GD objects (drawn like the game, no game art).
  **deco 👁 / ⊘**: every deco (lines and props) shown or hidden, in both views.
- **♪**: the song and its beat grid. Bar lines, numbered bars, the song's section changes (▲ +10 dB = Ragnarok's drop at
  bar 18) and a loudness strip. Grids: `viewer/song_grids.js` (every song tools/beats.js measured, committed numbers, no audio: `node tools/song_grids.js`, run by tools/beats.js itself) and `viewer/draw_songs.js` (with the loudness strip, Ragnarok's song 343707 for now; add more
  from `local/beats/<key>.json` the same way) and, on the PC, every grid in `local/beats.local.js`. ▶♪ plays the song with a
  playhead at level speed (the PC serves the mp3). On the phone / in the Claude app the page cannot fetch songs (they are
  never published): pick the mp3 once in ♪, or drop the file on the board; the page keeps it in the browser (IndexedDB)
  and loads it by itself next time. ▶♪ with no song opens the ♪ panel.
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

## The layout fitter (built 2026-11-25: `lib/sketchfit.js`, the board's 🧩 layout)

The design above, first version. The user (2026-11-25): "thats one of the important skills to make such things into
layout"; and on working in parallel: while the user draws, the board does the layout; a Claude session can take the
synced sketch for the full pass; what the user fixes by hand wins.
- **Reading (tidy)**: a ground line with orbs, pads, portals, spikes or a lower ground under it is a ceiling (blocks above
  the line, 2 thick), else a floor filled down. Heights snap to whole blocks, columns to the block grid, a one-column wobble
  is smoothed; a one-block climb with no sharp rise drawn is a 45° slope, and a floor starting a block up gets a ramp in
  (freehand lines never start on the ground exactly). Spikes within 2 blocks of a floor stand on it, of a ceiling hang;
  a free flat spike line gets a block row behind it and points to the play (the nearest orb / portal / other spike line);
  slanted free lines stay turned spikes (corridor walls). Pads go onto the surface, portals stand on the floor (or hang)
  when drawn within 5 blocks of one. Jump marks keep only x. In wave and ship a mark toggles hold / release.
- **Fitting (replay)**: a beam search over each mark's exact tick (±40 ticks, ~1.5 blocks at 1x, 14 states kept, a mark
  may be left out at a high cost). When nothing gets through: an orb by a mark goes to the path's closest pass and the mark
  with it; else a jump is added before the death; else the spike that killed is taken out (8 at most); a wall (a block)
  is never eaten: it stops there and says so. Every change is listed with its block: "~" adjusted, "✕" could not stay.
- **On the board**: 🧩 layout runs it in the Worker (draw_worker.js `kind: "fit"`), shows the fitted level with the path,
  ~ / ✕ marks over the board and a list (tap a line to go there); while on, each edit refits a moment later. 🧩 again: back
  to the drawing. The drawing itself is never changed by the fitter.
- **Measured** (the user's first real sketch, smwvbb62d, 56 pieces, 15 s at 1x): 12 rounds, ~1 s in node. It reads the
  orb/ceiling part, the spider part and the portals; stops at block 85, the stairs after the spider part (a spider cannot
  climb steps: the user had forgotten a robot portal there).
- **Open**: orbs that the timing could not use are not reported yet; holds drawn as drags in wave parts; ship
  corridors; the solver's fairness / windows on the fitted level; refit only from the edited mark (now it refits all).
- **Bands** (2026-11-25, the user: "things are off with the spider"): a ship / UFO / wave / swing / ball / spider portal sets
  GD's band (lib/physics.js BAND: 10 / 8 / 9 blocks from the portal's height). The fitter puts such a portal as high as a
  floor player still touches, so the band starts on that floor, and brings a ceiling drawn above the band down to it (the
  user's spider ceiling at 11 blocks came down 5). Robot marks try holds (1 / 15 / 30 / 45 ticks). A drawn portal the plan
  goes past costs as much as a left-out mark; one within 4 blocks of the path moves onto it.
- **In the viewer**: `node tools/sketch.js <id> --fit --wip whiteboard` puts the fitted level with its plan (`wip.js put
  --plan`) in the viewer's in-progress list and prints the ArtifactData call for the phone viewer.
- **In the viewer: ✏ draw** (built 2026-11-25; the user: "i thought we are doing the viewer and thing we draw at the same
  play ... they converge into that gd creation + lab"). The viewer's ✏ draw button (key D) opens the board as a see-through
  layer over the viewer's canvas (`draw.html?embed=1` in a frame; `window.BOARDHOST` in viewer/index.html is the bridge):
  - the board keeps its pens, stamps, marks, seek strip, ruler, song and 🧩 (on by default there); the VIEWER draws the
    level underneath with the game look, at the board's camera (MAPCAM from the board's V and canvas offset: a block lands
    on the same pixel, `tests/viewer_draw.js` checks to 1.5 px);
  - each change (or each fit) sends the level and its plan (🧩's timed marks, else the drawn marks) to the viewer as the
    level "✏ <sketch name>" (`BOARDHOST.setLevel`, planReplay: no solve);
  - ▶ on the board leaves draw mode and replays it in the viewer from where the board was; 🎮 plays it there (practice,
    deaths, the song); ✏ draw (or D) goes back to the drawing. "sketch" shows the strokes over the level, "level" only the
    level.
  - Sketches: on the PC as before (local/sketches through serve.js); on the phone the board uses the viewer page's runtime,
    so they go to the phone VIEWER's db collection `sketches` (the old whiteboard Artifact's sketches were copied there).
    A fresh empty board opens the newest drawn sketch.
  - tools/web.js ships draw.html, its worker, libs and draw_songs.js beside the viewer. If a page does not allow the frame,
    the viewer says so after 6 s; the standalone page (draw.html) still works.
  - Not yet on the sketch: the section lab, stages and 🔗 links (the sketch level is not in the level list).
- **Choices and 📌 pins** (2026-11-25): every ~ / ✕ in the 🧩 list carries one-tap choices (plain ops on the drawing,
  `SKETCHFIT.apply`: move / pin / unpin / press / delete / note / lower): "✓ take it" writes the fitter's fix into the drawing,
  "📌 keep mine" pins the piece, "+ jump before it" adds a mark, "✎ Claude fixes it" leaves a note stroke for the session. A
  pinned piece (📌 on the board; ⬚ select → 📌 pin; or moved by hand while 🧩 is on, pinned by itself) is never moved,
  lowered or taken out by the fitter: where it blocks, the fitter stops there with a ✕ (choices: a jump, unpin).
  The 🧩 list sits at the top of the board (controls only at the top, VIEWER.md).

## Status and open

- Built (first version): the board, pens, areas, stamps, props, deco toggle, sketch / level views, beats + sections +
  loudness for Ragnarok's song, song playhead, check (marks + solver), replay, play, sync to local/sketches and the
  phone's db, .gdlvl export, `tools/sketch.js`.
- Open, in order: the cell builder above (path -> spikes / ground cells -> orbs / pads -> ✕ choices); the section lab,
  stages and links on a sketch in the viewer; tracing over an existing level; flying modes (the ground pen means little
  in a ship part: corridor pens); undo across reloads; more songs in draw_songs.js; timing not measured yet.

## Songs on the phone (2026-11-25)

- Picking a song in ♪ copies its beat grid into the sketch (`sk.song.grid`: bpm, t0, bars, sections), so a saved
  sketch shows its beats on any device, with or without the mp3 and with or without the PC's grid files. Old sketches
  get it the first time they are drawn. The grid goes to the viewer with the level (BOARDHOST.setLevel).
- One song for both pages: the board looks in the viewer's song store too (IndexedDB "gdlm-songs", by file name), and a
  file picked on the board goes to the viewer (BOARDHOST.addSongFile: the phone page's add song, else kept in that store).
  So on the phone: open a sketch with a song, tap "add song" once (or pick it in ♪), and both the replay and the board's
  listen play it from then on.
- Checked headless (tests/viewer_draw.js, with local/ hidden as on the phone), and on the phone build with a real decodable
  file: "song ✓" in the viewer, "song remembered on this device" on the board. Not checked on a real phone yet.


## One-tap palette, the hazards pen, draw vs play (2026-11-25)

- The user: "i need accessible in 1 click: all game modes, upside, normal, all orbs, ground spikes, all x speed, all pads,
  mini, big". A palette row under the tools holds every one of them (modes, gravity, size, speed, orbs, pads, hazards):
  one tap picks it and the stamp tool. It wraps on a wide screen and scrolls sideways on a phone. Props stay in the stamp
  tool's list.
- The user: "When i mark spikes, i actually just mean a hazard ... spikes, ground that kills you, saws". The pen is now
  "hazards". With 🧩 layout on, once the marks clear the drawing, runs of floor / ceiling spikes take turns: spikes,
  kill-ground (id 9 at the surface + 2, as in RobTop's pits) and saws half sunk in the surface (89 per two spikes, 98 for
  one). A run keeps its new kind only if the same presses still clear it (lib/sketchfit.js varyHazards); the list says how
  many changed, and "▲ spikes only" (op set hazard=spikes) keeps a line as spikes. Pinned lines are never changed.
- Draw vs play in the viewer: the board used to sit under the last level's stages / sections / variants rows, which still
  acted on that other level. Now the sketch's level clears them (BOARDHOST.setLevel) and draw mode hides them; the board's own
  ▶ / 🎮 are gone inside the viewer, and the viewer's ▶ play / 🎮 you play leave the board and run the sketch.
  tests/viewer_draw.js checks all three; tests/sketchfit.js the hazard mix.
- No questions after each stroke (the user, 2026-11-25: "i aint going to click every time"): the fitter's changes are
  already in the level that plays, so its list is a closed badge in the corner ("🧩 ✓ plays · N auto changes"), opened by a
  tap (remembered); the per-change choices live inside it for when they are wanted. No toast after every stroke. In the
  viewer with 🧩 on, the user's strokes go faint (0.4) over the fitted level, so a moved orb or lowered ceiling shows where
  it really is instead of looking like the change did not happen.
