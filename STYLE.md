# Style in GD levels -- what it is, and how Claude writes a level with one

Measured with `node tools/style.js` on the 22 official levels (from the game install) and the
user's own levels (from their save). Raw numbers below are from that tool; rerun it to check.
Nothing from those levels is copied into this repo: only counts and generic shapes.

## 1. Findings

### Decoration vs gameplay

`play` = solids, hazards, orbs, pads, portals; `deco` = no hitbox (decoration and triggers); coins, mirror portals and the like count as play.

| level | objects | play | deco | colour triggers | sections |
|---|---:|---:|---:|---:|---:|
| Stereo Madness | 2291 | 90% | 10% | 14 | 4 |
| Polargeist | 1531 | 85% | 15% | 16 | 3 |
| xStep | 4716 | 77% | 23% | 176 | 8 |
| Clubstep | 7641 | 60% | 40% | 104 | 14 |
| Hexagon Force | 10224 | 40% | 60% | 73 | 12 |
| Theory of Everything 2 | 14400 | 29% | 71% | 489 | 18 |
| Fingerdash | 27283 | 13% | 87% | 874 | 12 |
| Dash (2.2) | 18329 | 17% | 83% | 413 | 21 |

The official levels are all 80-100 s long whatever their age; what grows is decoration. The
gameplay object count stays ~1500-3500; decoration goes from 10% to 85%. So "decorated"
mostly means: more objects that do nothing to the player.

What a bare level lacks, in the order the official levels added it:
1. **Block skins** (all levels): a platform is not a pile of id 1. Its surface squares get
   outlined edge pieces and its inside a plain fill, so a structure reads as one shape. The rule,
   learnt from levels 1-8 (`tools/decorate.js` SKIN): interior -> 5, one open side -> 2 turned
   to face it, two adjacent open sides -> 3 (corner), two opposite -> 7 (strip), three -> 6
   (cap), alone -> 1.
2. **Ground decoration** (all levels): small objects on the floor (18, 19, 20, 21) and on block
   tops (16), and hanging ones (41) under ceilings. Never on a hazard's column.
3. **Colour per section** (all levels): a background/ground colour trigger at each section
   start -- Stereo Madness has 7 bg + 7 ground changes for 4 sections. Later levels change
   colour on beats (xStep: 152 bg colour triggers).
4. **Enter effects and trails** (1.x onward): objects slide in; 4-40 per level.
5. **Pulses, moves, rotations, spawns** (2.0+): Fingerdash has 652 pulses, Dash 235 moves.
   Out of scope for now: they need music sync (sibling session) and are pure visuals.

Header choices: levels 1-14 use background 0 / ground 0; later ones pick a background and
ground art (Hexagon Force 5/5, ToE2 7/4, Dash 25/17). The colours of 2.x levels live in the
header's `kS38` list (channel 1000 = bg, 1001 = ground, 1009 = ground 2, 1002 = line, 1004 = obj).

### Structure

Sections = runs between mode or speed portals (`--detail` prints them).
- Early official levels: 3-5 long sections, cube <-> ship alternating, each 100-350 blocks
  (10-30 s). Stereo Madness: cube 267, ship 152, cube 346, ship 115.
- Later ones: 12-25 sections of 40-150 blocks (4-12 s), a new mode or speed every few seconds.
- Hazard density climbs through a level: Stereo Madness goes 4.4 -> 4.3 -> 7.7 -> 14 hazards
  per 10 blocks; Hexagon Force ends its cube parts at 25. The last section is the hardest.
- **Rests**: 6+ empty columns. Stereo Madness opens with 17 empty, has 25 rests in 879 blocks
  (one every ~35 blocks); later levels have far fewer (Clubstep 1, Deadlocked 1) -- density is
  part of a level's character.
- **Introduce then twist**: a shape first appears alone and easy, then returns combined
  (Stereo Madness: single spikes for the first 80 blocks, the first spike pair at 79, triples
  later, then spikes on platforms).

### Gameplay vocabulary (cube)

From levels 1-5 (`--detail`, "spike runs"):
- Ground spike runs: singles most common (20-41 per level), pairs next (8-13), triples rare
  (1-4): a triple is an event, not filler. Runs of 4+ are always on a platform edge or
  under an orb.
- Gaps between hazards: mostly 1-6 empty columns, peaks at 3 and 6.
- Spikes sit on many rows (0-11): on top of platforms as much as on the floor.

Recurring chunks across official levels (`--patterns`):

    ^^      2 spikes: in 9 levels      ##   ceiling with hanging     ##
                                       vv   spikes over ground       vv
    ^       spike on a block           ..   spikes with 3-4 open     ..
    #                                  ..   squares: a "gate"        ..
                                       ^^   (in 3 levels each)       ..
    ^#      spikes beside a pillar                                   ^^
    ^#      (4-5 levels)

### The user's own levels

20 levels in the save (one is a copy of an official level, two are empty). Short: 4-50 s, most
under 25 s. Three groups:
- **Memory** (memory rooms, memory cube, yet another triple, puzzle room): tiny (7-111 objects),
  cube 1x, almost all gameplay, and the trick is a trigger:
  - *show then hide*: a room is visible while you approach, an **alpha trigger** (1007) at its
    door fades its group to opacity 0 in 0.2 s, you cross it from memory. A **camera zoom out**
    (1913, to 0.7) at the start lets you see further, so you see the room for longer.
  - *the same room twice*: memory rooms has two rooms with the spike and the gap in the same
    place -- the second time you know it.
  - *colour code*: memory cube shows coloured columns first (colour triggers 899 set
    channels 1-4) and later walls in those colours with different gaps.
  - *invisible triple*: a mirror portal, the bg turns red, the triple spike fades out,
    and the spikes are off-grid (x 16.9, 18.0, 19.1 squares).
- **Timing** (cube timings, bit spammy, orb adventure, quick skill check): dense hazards and
  orbs, start positions to practise, several speeds, sections of 15-60 blocks.
- **Effects / flying** (trigger road 2, flying effects, ship chal, swingus, my first rated):
  ship/swing/wave, heavy 2.2 area triggers, 40-96% decoration.

## 2. Style vocabulary (what Claude writes)

A level spec (see `tools/make.js`) can now say:

| entry | does |
|---|---|
| `"style": "classic"` | block skins + ground decoration, automatically |
| `"colours": {"bg": [r,g,b], "ground": [...]}` | start colours |
| `"art": {"bg": n, "ground": n}` | background / ground art number |
| `["pattern", name, col, row, {args}, {extra}]` | a named chunk (`node tools/patterns.js` lists them) |
| `["colour", col, {"ch": "bg", "rgb": [...], "secs": 1}]` | colour trigger |
| `["fade", col, {"group": n, "to": 0, "secs": 0.2}]` | hide (to 0) or show (to 1) a group |
| `["zoom", col, {"to": 0.7}]` | camera zoom out |
| extra `{"group": n}` / `{"ch": n}` | put an object in a group / colour channel |

Patterns: `single double triple spikes(n) spike-block block-spike-block stairs platform hops
gate pillar orb-pit pad-launch`.

### Fairness first: sight-readable (the user's rule, from playing 41 and 42)

"Not sightreadable" = you have to **prejump**: commit to a jump in the middle of nothing, while
the thing it is for is still far ahead, so you only get it right by knowing the level. Levels do
it, players call it unfair. So every press must be cued by something right in front of the cube.
`node tools/sightread.js <level>` measures it (and `make.js` prints it for every level): for each
press, the lead = how far ahead the cue still is at the latest moment the press works; more than
1.5 blocks = PREJUMP. It flags both spots the user hit in the first GDLM 41 (jumping off the top
of a staircase onto hops 2 blocks away; jumping 2.4 blocks before a yellow pad because the pad
alone did not clear its spike run) and passes the fixed version.

Shapes that cause prejumps: a jump that must start on a higher step to reach something far off;
a pad or orb that does not clear its hazards by itself; a hazard hidden under a floating block.

### Style: classic (official 1-8 feel)

1. Open with 12-15 empty squares. Close with 15+ empty squares.
2. 3-4 sections of ~50 blocks, each with its own bg/ground colour (trigger 2-4 squares before).
3. Each section adds **one** idea: spikes -> platforms/stairs -> orbs/pads/gate.
4. Within a section: introduce a shape alone, repeat it, then combine it with the last idea.
5. Mostly singles and pairs; at most one triple per section. Gaps of 3-6 squares between chunks;
   a rest of 6+ squares between sections.
6. Hardest part last. Tightest window ~40-50 ms (a triple) is the ceiling for "easy classic".
7. `"style": "classic"` for skins and decoration.

### Style: memory / invisible (the user's style, Pattern Seeker feel)

The user, after playing the first GDLM 42: fully invisible parts are "practically very hard,
tons of learning, pure memory without visuals -- usually not fair unless you want it unfair".
So the default is **fair memory**: memory helps, it is never the only way to see.

1. Zoom out (0.7) at the start so phrases are seen early (confirmed in the game: ~74 px per
   block instead of 101 at 1080p).
2. Write one **phrase** (4-6 chunks, ~25 squares). Play it visible first.
3. Repeats go **ghost**, not invisible: fade the copy to opacity ~0.35 (`"to": 0.35`). You still
   see it, faintly; knowing the phrase makes it easy, not knowing it is still fair.
4. Fully hidden (`"to": 0`) only for **one chunk** the player has already seen 2-3 times in the
   same place in the phrase, with visible things right before it (its cue).
5. **Twist**: change the phrase (reverse it, move one chunk), show it once fully visible, then
   ghost it. Never ghost or hide anything that was not shown first.
6. Colour tells the player what is going on: bg dark = ghost/hidden part, red = a twist is shown.
7. Keep it short (15-30 s), cube 1x, few objects, and sight-readable (above) -- a memory level
   should test memory, not reactions to hidden prejumps.
8. "Unfair memory" (whole phrases blind, off-grid spacing like spikes 1.1 squares apart) only
   when the user asks for a deliberately unfair level.

## 3. The examples

- `specs/41_classic.json` -> `levels/gdlm_41_classic.gdlvl`: 3 sections (blue, purple, red),
  spikes -> stairs/hops/gate/orb -> pad/triple/platform, back to blue for the ending.
  15 presses, tightest window 42 ms, 17 s, sight-readable (v2: hops moved off the stairs, pad
  run 4 -> 3 spikes, sparser decoration).
- `specs/42_seen_then_gone.json` -> `levels/gdlm_42_seen_then_gone.gdlvl`: the phrase
  single-double-platform-triple: seen, then ghosted at its door, then ghosted from afar with
  only its triple fully hidden; then the reversed phrase, seen once (red), then ghosted.
  20 presses, tightest window 46 ms, 17 s, sight-readable. (v1 made whole phrases invisible:
  the user found that too hard and unfair.)

The viewer draws hidden objects normally (it does not run alpha triggers), and the sim ignores
triggers -- right for the physics, since a faded object still collides in GD.

## 4. Checked in the user's game (recording of the first 41 and 42, 2026-11-22)

- Alpha fade (1007) works: to 0 at a door, and to 0 from the level start for a copy far ahead.
  In practice mode with Show Hitboxes the hidden spikes still show their red boxes.
- Colour triggers (899) on bg work, fade time as set. Camera zoom (1913, 0.7) zooms out.
- Block skins 2-7 render as the outlined grid set, and the cube stood and landed on them.
- Deco 18-21 = icy crystal spikes (look like hazards: keep them away from real spikes);
  16 = thin antenna with a ball.

Still open:
- Opacity 0.35 ghosts (the v2 42) -- not seen in the game yet.
- Trigger key 36 on every trigger is unexplained; deco 41 not seen yet.

## How the numbers were got

    node tools/style.js all                 # one line per level
    node tools/style.js 1 --detail          # one official level: sections, rests, motifs, ids
    node tools/style.js "memory rooms" --detail
    node tools/style.js official --patterns # recurring chunks
    node tools/style.js official --json local/style.json

`tools/corpus.js` reads the install's `Resources/levels/<n>.txt` and the save
(`%LOCALAPPDATA%/GeometryDash/CCLocalLevels.dat`), in memory only. Classification is
`lib/objects.js` (which falls back to OpenGD's data in `lib/objects_extra.js`; ids in neither
have no hitbox and count as decoration). `all` reads 42 levels (well under a minute): run one such job at a time.
