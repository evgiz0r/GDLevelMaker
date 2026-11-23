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
| wave entered with the button held hits the corridor's roof (fairness gate "switch": change within 100 ms) | 100 ms | wave-zigzag `"lead": 4, "leadGap": 8` (new option: 8 rows of room in the entry columns) |
| ship portal right at the slab's end (the switch comes mid-jump) | forced, 75 ms | portal 2 columns past the slab end |
| cube forced to jump right after the wave exit: it came out over the 2-high exit frame, rolled off and hit a 1-high block (2 real deaths) | window closes 176 ms after the portal | the parts after the wave moved right, and a 1-high floor starts right after the exit frame and runs to the orb chain |
| end orb chain: "if you just click normal you fall and die, cant adjust" (3 real deaths; arc-placed orbs climbed rows 2 -> 4 -> 7, toward the screen's top) | 46 / 29 / 4 ms | 2 orbs at row 2, 3 columns apart, the landing block 2 columns after the last orb, right where the spikes end (`tools/orbchain_try.js`: 196 / 154 ms; the best 3-orb chain had 58 ms) |
| opening orb over spikes: pressed early, the cube lands short in the spikes before the block (3 real deaths) | 17 ms opener | the spike row ends 2 columns sooner and the block starts there |
| indicators too high, one where no jump is needed, some jumps without one | -- | polish.js read pass: one per NEEDED jump, 24 units over the surface (decorate.js INDICATOR.lift) |

Targets for a Normal-Hard sketch (the main session's brief, 2026-11-23):
- no input forced within ~250 ms after a mode change (`closes ... ms after a switch` in the report);
- wave turns >= 150 ms;
- every orb required but forgiving: a normal click on each orb works (`tools/press_window.js` per orb);
- indicators only where a jump is really needed, low over the surface;
- everything else polish.js does (no window under 2 frames where a small move fixes it).

Then `node tools/polish.js levels/gdlm_NN_sketch.gdlvl --name "GDLM NN sketch"`, look at the
before/after (viewer/polish.html), `node tools/wip.js put ... --session polish`, the phone row, and
tell the main session (it installs).

## Result (v3, 2026-11-23)

`local/wip/polish/gdlm_46_sketch_polished.gdlvl` ("GDLM 46 sketch"): tightest window 17 -> 42 ms,
nothing forced after a mode change (2 -> 0), the fairness gate passes (two WARNs: chevrons at blocks 9
and 21 sit ~2 blocks from the gate's route's jump; jumping there is survivable), the end chain 179 /
504+ ms, the look pass (4 scenes, 2.6 -> 6.6 objects per block, 16 beat pulses), the cube portal on
bar 29. Renders: `local/shots/s46_ba_*.png` (v2 as played on top; times differ after the wave, v3 is
longer). Not yet played by the user.

## Open

- How the drawing is read (step 1) is written from the GDLM 46 spec, not from the main session's own
  notes: the main session should correct it.
- The window of an orb press is measured with the later inputs fixed in time, which is pessimistic
  for a chain where a player adjusts the next click; a "window with the next input re-timed" measure
  is not built yet.
- Real-game deaths per level come from the physics session (`node tools/real_stats.js sketch`); they
  were the best guide for v3 -- ask for them after every playtest.
