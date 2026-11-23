# From the user's drawing to a fair level

The user draws a level freehand (a picture of the gameplay, left to right) and we turn it into a GD
level that keeps what they drew and plays fair. First case: GDLM 46 sketch (2026-11-23; spec
`specs/46_sketch.json`). The user will send more drawings. Owners: the main session reads the drawing,
the polish session (POLISH.md) makes it fair.

## 1. Drawing -> spec (main session)

- List what is drawn, left to right, in the user's words ("orb over spikes, slabs over a pit, ship
  through four gates, a wave zigzag, an orb chain" -- the spec's `desc`). Keep every element; do not
  add ideas that are not drawn (decoration and colours excepted).
- Each element becomes the nearest named chunk (`node tools/patterns.js` lists them: platform,
  orb-ladder, wave-zigzag, ship-tunnel ...) or plain objects where the drawing is specific (the four
  ship gates of GDLM 46 are 2-wide block pillars with a 3-row gap, as drawn). Columns follow the
  drawing's proportions; heights are read in rows (a cube is a row).
- The song, colours ("style": "hell" ...) and a colour change at each new part, as compose.js does.
- `node tools/make.js specs/NN_sketch.json`: it must be beatable; then put it in wip.

## 2. Make it fair (polish session) -- the GDLM 46 lessons

The user played v2: "playable but gameplay meh", deaths "not really my fault". What was wrong and
the rule it gave (checked with `node tools/polish.js <level> --dry --passes none`, which prints every
input's window and how long after a mode change it closes):

| v2 problem | measured | fix (spec v3) |
|---|---|---|
| wave turns met head-on, "slope/block problems" at the exit | wave windows 71-121 ms | wave-zigzag `"flat": 2` (two level columns at every turn, ~95 ms each at 1x), `"lead": 2` |
| ship has to dive to reach the wave portal | ship release 4 ms | wave-zigzag `"low": 3`: the portal one row below the last gate's centre |
| cube forced to jump right after the wave exit | window closes 176 ms after the portal | the parts after the wave moved right (runway) |
| orb chain: "if you just click normal you fall and die, cant adjust" | 46 / 29 / 4 ms | the landing platform starts right where the spikes end (an early landing hit its wall) |
| indicators too high, one where no jump is needed, some jumps without one | -- | polish.js read pass: one per NEEDED jump, 22 units over the surface |

Targets for a Normal-Hard sketch (the main session's brief, 2026-11-23):
- no input forced within ~250 ms after a mode change (`closes ... ms after a switch` in the report);
- wave turns >= 150 ms;
- every orb required but forgiving: a normal click on each orb works (`tools/press_window.js` per orb);
- indicators only where a jump is really needed, low over the surface;
- everything else polish.js does (no window under 2 frames where a small move fixes it).

Then `node tools/polish.js levels/gdlm_NN_sketch.gdlvl --name "GDLM NN sketch"`, look at the
before/after (viewer/polish.html), `node tools/wip.js put ... --session polish`, the phone row, and
tell the main session (it installs).

## Open

- How the drawing is read (step 1) is written from the GDLM 46 spec, not from the main session's own
  notes: the main session should correct it.
- The window of an orb press is measured with the later inputs fixed in time, which is pessimistic
  for a chain where a player adjusts the next click; a "window with the next input re-timed" measure
  is not built yet.
