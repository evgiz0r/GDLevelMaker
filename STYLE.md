# Style in GD levels -- what it is, and how Claude writes a level with one

GDLM levels follow general GD design, not one person's taste: what makes levels good and fair
in general (see `knowledge/design.md`, sourced). Playtest remarks below are evidence about
fairness and readability, not preferences to build around. Levels are made **low tier first**
(Easy -> Normal -> Hard) only because that is what can be playtested now; hard levels are just
as wanted.

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

### Levels from one player's save (a data set, not a taste to copy)

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

### Fairness first: sight-readable (general GD design; evidence: playtests of GDLM 41 and 42)

"Not sightreadable" = you have to **prejump**: commit to a jump in the middle of nothing, while
the thing it is for is still far ahead, so you only get it right by knowing the level. Levels do
it, players call it unfair. So every press must be cued by something right in front of the cube.
`node tools/sightread.js <level>` measures it (and `make.js` prints it for every level): for each
press, the lead = how far ahead the cue still is at the latest moment the press works; more than
1.5 blocks = PREJUMP. It flags both spots the user hit in the first GDLM 41 (jumping off the top
of a staircase onto hops 2 blocks away; jumping 2.4 blocks before a yellow pad because the pad
alone did not clear its spike run) and passes the fixed version.

**Timing is a difficulty knob, not a style rule.** The tightest window sets how hard a level
is: a triple at 1x is ~46 ms, a double ~140 ms, a single ~240 ms; a spike 3 squares after a
platform edge ~54 ms, 4 squares ~150 ms. Pick the target per level from what the level is for.
Hard levels with tight triples are fine and wanted (players want hard levels). The test levels
GDLM 41/42 are kept easy (windows 60 ms+) only because the playtester tests the tools at low
tiers first (a playtest limit, see below), not because easy is a style.

**Recovery** (real-game data, GDLM 42 v3 in normal mode on the mouse, read by the difficulty
session from recording 19:45): 8 attempts, every death in the first ~14%, at the first double and
the platform after it. In the sim the first phrase made you land and jump again within 0-130 ms
(single -> double -> platform). The solver does that, a person does not, unless they hold the
button. `score.js` now has a **recovery** gate: time from landing to the next press window, at
least 150 ms for Easy, 100 ms for Normal (`minRecoveryMs` in the brief). GDLM 42 v4 spaces the
phrase so every press is 200+ ms after landing. With the gate on, GDLM 43's brief can no longer
reach Normal (its "Normal" came from those chains): the loop says so and keeps a fair Easy (0.20).

Shapes that cause prejumps: a jump that must start on a higher step to reach something far off;
a pad or orb that does not clear its hazards by itself; a hazard hidden under a floating block.

### What good low-tier levels do (34 rated community levels, `knowledge/levels/good_low_tier.md`)

- Classic (2013-14) rated levels look like official 1-8: 2-4 long sections, 1x, cube/ship, many rests.
- 1.9-2.1 Featured/Epic Easies use **4-7 modes**, a mode or speed change every **3-7 s**
  (sections 30-70 blocks), 0.5x-4x, 2-12 rests. They stay easy because each section is
  forgiving, not because they use few modes. (GDLM 44 v1 -- one idea, flat -- was called
  bland and old style for exactly this.)
- Many Easy/Normal Epics are 58-65 s. "One idea for the whole level" is also a rated design.
- Official 1-8: one new idea per level, introduced calmly; no fakes at Easy or Normal.
- 91 rated Easy-Harder levels (`knowledge/levels/low_tier_stats.md`): **Hard is the big step**
  (sections ~7 s -> 3.4 s, orbs+pads 28 -> 53 per minute, 2-4x the hazards, ~5 rests per minute);
  4-6 modes even at Easy; 3x/4x sections short (1-1.5 s) and nearly empty, 0.5x the most common
  speed and carrying the busy modes (ball, spider, robot: 15-22 hazards per 10 blocks); median
  length 66-72 s at every tier. Two rated templates for a brief:
  - **a new mode every ~7 s, one speed-up** (an Easy Epic: cube, robot, ship, UFO at 0.5x, then
    ball, robot, spider, UFO, cube, robot at 1x);
  - **long calm sections + 2-3 bursts of very short switches** (a Normal and a Hard Epic, 0.5x).
  The sim checks cube and ship best; other modes only through gdsolver's plans so far, so GDLM
  briefs stay mostly cube/ship with one or two other modes until the bot confirms them.

### Style: classic (official 1-8 feel)

1. Open with 12-15 empty squares. Close with 15+ empty squares.
2. 3-4 sections of ~50 blocks, each with its own bg/ground colour (trigger 2-4 squares before).
3. Each section adds **one** idea: spikes -> platforms/stairs -> orbs/pads/gate.
4. Within a section: introduce a shape alone, repeat it, then combine it with the last idea.
5. Mostly singles and pairs; triples as peaks, as many as the target difficulty allows. Gaps of 3-6 squares between chunks;
   a rest of 6+ squares between sections.
6. Hardest part last. Choose the tightest window for the level (see Timing above).
7. `"style": "classic"` for skins and decoration.

### Style: memory / invisible (a general GD style: levels built on memory and hidden or repeating parts)

Playtest evidence (the first GDLM 42): fully invisible parts are "practically very hard,
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
   when a deliberately unfair level is asked for.

### Theme kits by mood: SPACE first (2026-11-24)

The user: "Somewhat black background... Bit more flying with space. Sections may give different vibe of space, bit
lighter bit darker. Bit more planets or deco. Different structures and objects. But in all trying to create a cohesive
experience." Split: gd-art builds the kit (art, palettes per section, set pieces) from the user's references in
`local/refs/space/`; the style session does the song, the vibe sheet, the brief and the gameplay.
- **Song:** Two Moons ft. Geyser (1175526, 166 BPM): the clearest beat of the local space-named songs (songmap clarity
  2.95, 4% beatless), quiet intro, drops at 12.6 / 35.8 / 105.2 s, a break at 99.4 s. Alternative: Ocean of Stars
  (537202), bigger loud/quiet contrast but nearly beatless in its quiet parts.
- **Vibe sheet / brief:** `briefs/71_two_moons.vibe.json` (dark arrival -> light space launch -> nebula -> deep climb ->
  moon rise -> the drop in front of the moon), `briefs/71_two_moons.json` (16 sections, 9 parts, 67% flying), the
  coordinator's plan `briefs/71_two_moons.coord.json`. Space look = near-black skies (luminance 0.02-0.05) in blue to violet,
  lighter or darker per section, still split by role (decokit.rolePalette; lab `--palette space`).
- **More flying:** compose now builds `"mode": "ufo"` (patterns.js `ufo-run`: floor pillars and roof hangers) and
  `"mode": "swing"` (`swing-run`: the ball's floor / roof flips with more room), next to ship, wave and ball.
- **Lab round r2:** six versions of the moon drop (105.2-121.1 s): ship corridor, ufo hops, swing flips, ship into wave,
  wave drop, cube into ship. Build them when the space kit lands (viewer first).
- Brief section beats start at the song grid's first beat (0.33 s here), not at the songmap's `bar0`: check section starts
  with `beatToTime` against the songmap's section times (GDLM 71's first try was 2 beats early).

## 2b. The loop: idea -> finished level, before a person sees it

Goal: the whole loop settled before a person looks for the first time. A person gives an
idea (a picture, a sketch, words); what they get back has already passed every gate.

1. **Brief** (`briefs/NN_name.json`, written by Claude from the idea): name, idea, story,
   difficulty target (`label` on lib/difficulty.js's scale, `minWindowMs`), style, colours, song,
   and **sections** -- `{"name", "blocks", "use": [patterns], "gaps", "args", "bg", "ground",
   "rest", "objects"}`. Full format at the top of `tools/compose.js`.
   **The name is final from the first upload** (the user, 2026-11-23: "We use the same name once
   uploaded, no rename. Thats why we need pick proper names as well"; the GD server refuses a
   renamed shared level; PUBLISH.md). So the brief's `name` is the level's real name from the
   start: `GDLM NN <words that fit what it is>` (the song, the mood, the scene -- "sunny side"),
   never a working label ("low tier", "test", "v2"). A test level that is never to be uploaded says
   so in its name ("catalogue", "test"). Uploaded so far: "GDLM 44 hellgate" (the phone slot).
   **Name and description.** The brief's `"desc"` is what players read in the game: one or two short
   sentences with a bit of fun or flavour, at most ~150 characters with the signature line (the user,
   2026-11-23; e.g. "A night city swallowed by an eclipse. Hold on at the drop! -- Made by Claude (and
   some humans)"). The brief's `"idea"` and anything for us (beats, dB, song ids, versions) go to the
   spec's `"notes"`. make.js stops a build over 180 characters (GD's limit) and warns over 150 or on
   note-like text (5-digit ids, dB, BPM, b12, v3, "beats", "sections").
   **Every GDLM level ends with the signature** (robot + human, "Made by Claude (and some humans)",
   tools/signature.js; the user approved it for all levels, 2026-11-23): make.js adds it to any spec
   named "GDLM ..." 3 blocks after its last object, plus the line in the description. Opt out only
   with `"signature": false` (spec or brief). It is deco after the end: `make.js <spec> --look` adds
   it to an existing level without a new solve (GDLM 44 v12: 126 objects, gameplay identical).
2. **Compose** (`node tools/compose.js briefs/NN_name.json`, ~20-60 s for a 30 s level): fills
   each section from its patterns (a new pattern first gets room on both sides, then mixes in),
   colour per section, rests where the brief has them; writes `specs/NN_name.json` and builds it.
3. **Score** (`node tools/score.js level.gdlvl --brief briefs/NN.json`): one report, every gate:
   beatable, prejumps, timing floor, difficulty vs target, pacing, variety, readability of
   decoration, colour per section, beat sync (with a song), unconfirmed hitboxes.
4. **Repair**, in the same command: a failing gate is traced to the chunk that causes it, which
   gets 2 more columns before it, then an easier pattern. Off the difficulty target, chunks are
   made harder (or easier) a few at a time, later sections first, and a change is kept only if
   no gate breaks. Every round goes to `briefs/NN_name.log.md`: what failed, what was changed, what
   was kept or undone. If the target cannot be reached, it says why (patterns, floor, length) --
   then Claude rethinks the brief (GDLM 43: Normal was out of reach at 24 s; at 33 s it got there).
5. **Look** (Claude): viewer screenshots, and later the real game (bot replay, physics session).
6. **Hand over**: installed level + the brief + the log. The user plays and reports; what they say
   becomes a gate or a rule here.

Still to build: screenshot strips for step 5, a one-page design note for step 6.

### Sections that follow the song (GDLM 45 v5, 2026-11-23)

The user: "GD levels usually have some kind of sections, with different styling changing according
to the music". Measured on the 22 official levels (`tools/corpus.js`, no solving): **159 of 178 mode
portals (89%) have a colour trigger within 3 blocks**, against 31% for a random spot; in levels
1-8, where colour triggers are rare, 16 of 21 (76%) against 8%. So in GD a section is a mode (or
idea) and its look together: the colour changes where the portal is. With SYNC.md (portals on bar
starts and 8/16-beat phrases), the recipe compose.js now follows:

1. **Cut the song first.** `local/beats/<song>.json` has `sections` (beat index, dB change of the
   next 8 beats vs the last 8) and `loud` per beat. Move each change to the nearest 8-beat phrase
   start (bar starts are beat index = `downbeat` mod 4). Louder = a new busy section (with a
   flash), quieter = a break.
2. **One section per phrase or two**, each one mode or one cube idea, length in beats
   (`"beats": 32` in the brief), so every section, its portal and its colour start on the beat.
3. **The look per section**: `bg`, `ground`, `line` colours (fade 0.4 s on the first beat),
   `flash` (background flashes bright on the beat, then settles: for the drops, where the
   song gets louder), `deco` (share of ground decoration: 0 in breaks, fuller in busy parts). A
   colour story over the level (GDLM 45 v5, hell on Ragnarok's song: dark red embers in the quiet
   build, brighter each section, a white flash into orange on the drop, dark again at the end)
   keeps sections apart without one random colour each.
4. **Breaks are real breaks**: where the song drops back, fewer hazards (`gaps` 8-12) or an
   easy upside-down stretch, darker, no decoration.

Modes used: cube, ship, wave, ball, the cube upside down (gravity portals) -- the ones checked
against the user's own recordings (PHYSICS.md: ball gravity, wave slope, ship, gravity flip).
UFO, robot, spider and swing are in the sim but checked only by gdsolver's plans, so not yet in
generated levels.

New section kinds in compose.js: `"mode": "ball"` (`ball-run`: a roof 5 rows up, spikes
alternating floor/roof every 8-9 columns, a framed cube exit on the floor) and `"mode": "upside"`
(`ceiling` 6 rows up with a yellow gravity portal in and a framed blue one out; the section's
block/spike patterns hung from it by `mirrorUp`). Tools: `compose.js --dry` (where each section
lands, in columns and seconds, nothing solved), `--section n` (score one section alone, written
to `local/sections/`). Levels over 90 s are scored **section by section** (each section alone,
unchanged ones cached): a whole-level score of a 60 s level with modes takes ~4 min on this PC,
a cube or ball section 2-20 s, a 120-block ship corridor minutes.
Short sections work: 8 beats (~33 blocks at 1x, 145 BPM) still hold a mode with its lead-in.

## 3. The examples

- `briefs/43_climb.json` -> `levels/gdlm_43_climb.gdlvl`: the first level made by the loop.
  Brief: classic cube, ground spikes -> platforms/stairs -> orbs/pads/gate, blue -> violet -> red,
  target Normal with a 40 ms floor. First run: Normal (0.33) in 16 rounds. With the recovery gate
  (no land-and-jump-at-once), Normal is out of reach: 28 rounds, 89 s, kept Easy (0.20),
  26 presses, tightest 46 ms. Log: `briefs/43_climb.log.md`.

- `specs/41_classic.json` -> `levels/gdlm_41_classic.gdlvl`: 3 sections (blue, purple, red),
  spikes -> stairs/hops/gate/orb -> pad/triple/platform, back to blue for the ending.
  16 presses, tightest window 63 ms, 17 s, sight-readable. v2: hops moved off the stairs, pad
  run 4 -> 3 spikes, sparser decoration. v3 (easier, for testing): no triples, wider stairs and hops.
- `specs/42_seen_then_gone.json` -> `levels/gdlm_42_seen_then_gone.gdlvl`: the phrase
  single-double-platform-double: seen, then ghosted at its door, then ghosted from afar with
  only its last double fully hidden; then the reversed phrase, seen once (red), then ghosted.
  20 presses, tightest window 129 ms, 17 s, sight-readable (v3, easier for testing: no triples, more room after
  platforms). (v1 made whole phrases invisible:
  the user found that too hard and unfair.)

The viewer draws hidden objects normally (it does not run alpha triggers), and the sim ignores
triggers -- right for the physics, since a faded object still collides in GD.

- `briefs/44_hellgate.json` + `specs/44_hellgate.json` -> `levels/gdlm_44_hellgate.gdlvl`: the
  user's first idea: "hellish, on the song of Ragnarok (343707, 145 BPM), the first 10 s".
  **v1 failed with the user**: one jump every 2 beats on flat ground, the hell only in the
  colours -- "very bland, very old style, no variety in gameplay, all same height, very weak".
  Lesson: a modern level changes something **every bar** -- height, mode, gravity, orbs -- and
  the look must come from the shapes as much as the colours. (v1 also flashed one beat early:
  make.js's b1 is the first beat, so the song's hit at 1.72 s is b5, not b4.)
  **v2**: a new idea per bar, mode changes on bar starts (as official levels do, SYNC.md): climb
  pillars -> yellow-orb ladder starting on the hit -> ship through a toothed tunnel -> wave
  zigzag -> cube drops down pillars -> red pad, a single, a toothed gate on the last beat (b25 =
  10 s). 14 inputs, tightest measured window 125 ms, sight-readable, Easy.
  New patterns for it: `climb`, `descend`, `orb-ladder`, `ship-tunnel`, `wave-zigzag`; portals by
  name in specs (`ship portal`, `wave portal`, `gravity down`, ...).

Checks learnt on the way (in `tools/sightread.js`, `tools/score.js`):
- A press that fires an orb is cued by that orb.
- Flying modes (ship, UFO, wave, swing) turn slowly: up to 3 blocks of lead is not a prejump.
- Levels with modes are solved by the sweep solver, which gives no windows: the timing gate then
  uses lib/difficulty.js's measured window of every input (press and release).
- Pillars must be wide enough (3) that one long jump cannot skip one -- the solver takes the
  fewest clicks, which is not how a person climbs.
- Ship teeth on both floor and roof need 5+ rows of tunnel, else 2 rows of air (29 ms).
- A held button re-jumps on every landing: the solver climbs pillars with one long press. Count
  jumps by takeoffs, not presses.
- Jumping at the end of a ledge is cued by the ledge when walking off kills in the fall (pits,
  the next pillar's side). When walking off lands safely and the death comes later, it is still a
  prejump. (This now passes GDLM 41 v1's stairs-to-hops jump: a visible floating block ahead, and
  walking off crashed into it. The pad prejump there is still caught.)
- A pattern that needs no input is a dead bar: "descend" with 2-wide pits let the cube fall
  across by itself; 3-wide pits make each drop a jump.

Playtest of GDLM 44 v2 ("more patterns, not too bad of a draft"), and what changed for v3:
- **Portals sit at the corridor's entrance, centred on the path** -- the wave portal was off.
  `ship-tunnel` / `wave-zigzag` now place their own portal (`portal: true`) and a framed exit
  portal (`exit: "cube"`).
- **Block unwanted paths** (general practice: avoid "secret ways" past parts of the level). The
  solver flew the ship over the unframed exit, skipped the orbs and played the rest as a ship.
  New `skips` gate: the solved run must touch every portal (FAIL) and every orb (WARN).
- **Balance**: the wave was harder than the rest. Not by timing (its windows were 133-217 ms like
  everything else) but by room: 3 rows free (2 at the turns) against the ship's 5. Corridors now
  keep the room even at the turns; Easy = 4 rows. (Room is a difficulty measure the window model
  misses -- for the difficulty session.)
- **A big hit in the song needs a big change in the play**: v2 started an orb ladder on the hit
  and it read as "the same play". v3 switches to the ship on the hit.
- Prejumps are exact only for cube levels (exact solver). On levels with modes the check is
  approximate (later inputs fixed in time) and the gate is a WARN.

**Sync, loosely** (the user via the sync session: "too synced may sound forced"; some music is a
vibe, not beats; not everything is clicked on the beat). Official levels put portals on bar starts
and barely lean presses to the beat (SYNC.md "How much to sync"). So: mode/speed changes and big
moments on bar starts and section changes; jumps where the gameplay wants them. GDLM 44 put every
jump on a beat -- a test of the tools, not a rule. `score.js` warns on portals off the bars and on
more than 60% of presses pinned to beats.

**Jump indicators** (common in modern levels; they also show what the level intends): a small
arrow just over the area where a jump starts, pointing down at it (`tools/decorate.js`
jumpIndicators). The user's feedback on the first version (GDLM 44 v8 / 46 v2, 2026-11-23) set the
rules: "a bit too high over the ground" -> the mark's centre is 30 units over the surface (was 45; rated median 1 block, knowledge/levels/obstacles.md section 4), half a block past the press;
"the second indicator is wrong, dont need to jump there" -> marks come from the NATURAL plan (one tap
per jump, lib/natural.js), never the solver's held-button run; "no indicator in some of the jumps"
-> every real jump gets one (a filter for only the hard-to-read ones dropped 10 of 13), at least 2
blocks apart; orbs and pads are their own cue. Each mark notes why it is hard to read, if it is (far
cue, ledge, after a portal, a pattern's first use; `"indicators": {"only": true}` keeps just those).

What the mark is (the user): anything **small and softer than the level, never like a hazard** --
arrows are the usual choice, but circles, dots, any small deco, even smileys are used. Default
here: deco **460** (d_arrow_02, the classic chevron ">", from the visuals session's
knowledge/objects/catalogue.tsv) turned 90 degrees to point at the ground, scale 0.7, on white
(1011 -- its own channel 1006 is the player's colour), group 990 faded to 45% by an alpha trigger at
the start. The other arrows: 132 (long arrow), 494 (solid triangle: too spike-like). A text object
(914, "text") also works. Per spec: `"indicators": {"id": N, "rot": n, "ch": n}`. GDLM 44 v8: 5
marks (first climb jump, first jump after each mode change, far cues). Rendered in GD art (`node tools/shoot.js level --at 0.6,7.4`): small soft grey chevrons over the takeoff areas, nothing like a hazard. Not yet seen in the game itself.

**Orbs on the arc** (make.js `arcOrbs`, for `orb-ladder` and `orb-pit` on the ground; `"fixed": true`
keeps the old fixed rows): the user on GDLM 44's ladder, "very awkward; in lower difficulty levels
there should be better space to click the orb, and clicking in the middle is almost the point
(where you can mostly buffer)". Each orb now sits at the top of the arc that reaches it (the jump
before the pit, then each orb's own launch), simulated at the level's speed: the cube passes
through the orb's centre and is slowest there, so a press in the middle or a held button takes it.
The orbs after the first sit where the previous orb's arc comes back down to its height (+1/3
row): rated Easy/Normal chains stay level (~1 block of climb in all, ~3 blocks apart, a landing ~1
block after; knowledge/levels/obstacles.md section 5), and apex-to-apex climbed 2.3 rows per orb --
GDLM 46 v2's "cant adjust" triple. Now: 4.3 blocks apart, +1/3 row each (`"climb": true` keeps the
apex chain). The pit ends a column before the landing. Harder levels can still place orbs off the arc on purpose (`fixed`). An apex chain (`climb`)
climbs ~2 rows per orb, so 3 reach row 6.5: make.js notes a chain above row 7 (orb chains must not
carry the cube to the screen's edge, knowledge/design.md). Rated levels put hint arrows a median 1
block over the surface, right at the press (knowledge/levels/obstacles.md section 4): ours sit 0.8
up, at the takeoff.

**Wave turns** (GDLM 44 v7, physics 2026-11-23: a wave flying head-on into a slope dies, as in the
game): with pure 45-degree slope walls the wave flies parallel to them and every turn meets the next
leg's slope head-on, so a turn was 13-88 ms ("i still couldnt fit into the gap in 44"). `wave-zigzag`
`flat` puts level floor and roof at each peak and valley (the wave meets them at 45 degrees and
slides, so it can turn anywhere along them, ~95 ms per column), `lead` level columns at the entry,
and its exit portal covers the floor the wave slides on (in the path's middle it let only a late
release through). GDLM 44: 3 flat at the peak, 2 at the entry, gap 5 -> wave inputs 308 / 225 ms.
Rule: every wave input >= ~150 ms at Normal; compose's wave sections use flat 2 (Easy/Normal) or
1, gap 5 or 4. Check with `node tools/windows.js level --from X --to X` (moves one input with the
rest fixed: in chains -- jump, orb, orb -- it reads far too small; judge those by the solver's own
inputs or by press_window.js from a placed state).

**A long level end to end (GDLM 47 sunny side, 2026-11-23: "a happy level with happy colors, 1:40")** --
what it took, for the next one:
- Song: an upbeat chiptune with a steady grid (311087, 134 BPM, drift 5 ms); `local/songmap/` gives
  its sections by bar (drops at bars 9, 26; changes 32, 40, 50; a dip at 48). Bars = 4 beats from
  `downbeat` (here beat index 2), so a section "beats" count starts with the 2 pickup beats.
- Happy look: background art 13 (`"art": {"bg": 13}`) is flat white, so the bg colour shows as set;
  art 1 turned sunny yellow into brown. `"palette": "light"` makes block fills pastel and the
  vfxkit parallax undarkened. Sunny yellow, sky blue, mint, coral, pink, lavender, gold.
- Block terrain (`"terrain": true`): the floor steps 0-2 rows between chunks. A step up goes 5
  columns after a chunk (its jump lands ~2 past the chunk's end; at +3 it was a land-and-jump chain),
  a step down 3; then 5-6 columns on the new level before the next chunk. After a chunk that already
  ends up high (a platform) the new level continues from its end (a 3-wide pit between them meant
  drop-in-and-jump-out, 50 ms). Orb/pad chunks bring it back to the ground; ledge spikes at a step's
  foot only at Hard+. Iterate a section in seconds: `node tools/compose.js brief --section n`.
- The recovery gate measures landing -> the END of the next press's window (a window that opens on
  landing but stays open is no chain; what kills is having to press within ~100 ms of touching down).
- `pad-launch` has 3 spikes by default: the pad's arc at 1x does not clear 4, and the player had to
  jump before the pad to arrive high (a prejump).
- Speeds per section (`"speed": "0.5x"`): section lengths stay on the beats at any speed; the speed
  portal must sit on the player's path (row 1, before the section's own portal) -- at row 5 above a
  corridor the wave passed under it and a 0.5x part ran on into three more sections. At 0.5x the
  jump is shorter: spike-block left a 33 ms window; use singles and doubles there.
- After an orb or pad launch: 3 more columns (the cube comes down from high up).
- Scoring a 100 s level with modes: sections alone, moved to the level's start (solving from the
  real start walked ~80 s of empty ground per section); the sweep solver's cube windows in a whole
  level with modes are unreliable (16 ms where the exact solver gives 100+), so a sectionwise level
  takes timing / recovery / prejumps from its sections and the rest (beatable, skips, fairness,
  pacing, sync ...) from one whole-level score. Recovery counts only jumping modes (a wave sliding
  on a floor is "grounded" but does not land and jump).

**Landing room** (compose.js): after a chunk that ends h >= 2 rows up, h+1 more empty columns
before the next one, so the cube lands and sees the next hazard before it must jump. Approximate
prejump WARNs (levels with modes) now count as defects in compose's loop: v4's WARN at its stairs
was that death spot.

## 4. Checked in the real game (recording of the first 41 and 42, 2026-11-22)

- Alpha fade (1007) works: to 0 at a door, and to 0 from the level start for a copy far ahead.
  In practice mode with Show Hitboxes the hidden spikes still show their red boxes.
- Colour triggers (899) on bg work, fade time as set. Camera zoom (1913, 0.7) zooms out.
- Block skins 2-7 render as the outlined grid set, and the cube stood and landed on them.
- Deco 18-21 = icy crystal spikes (look like hazards: keep them away from real spikes);
  16 = thin antenna with a ball.

Still open:
- Opacity 0.35 ghosts (the v2 42) -- not seen in the game yet.
- Trigger key 36 on every trigger is unexplained; deco 41 not seen yet.

## 5. Open / next (hand-off)

- **User gates in compose** (visuals 52754fc, VIEWER.md): stages.put(... gate: true) + stages.waitApproval -> ok /
  redo with a note and a spot. Not wired yet: compose is one heavy job, so waiting inside it would hold the lock
  for hours. To do: "compose --until layout" (put the gated layout, save tweaks/plan, exit, free the lock), wait
  outside the lock (node tools/stages.js wait), then "compose --resume" (ok: continue; redo: rebuild that section
  from another plan using the note/spot). Questions (a song pick) go through tools/ask.js.

- **Section variants and edits** (2026-11-24): compose builds A/B/C versions of the opening, drops and finale
  (tweaks "reseed:<si>"), scores each section alone, keeps the best, saves all to
  local/wip/<session>/<level>.variants/ (index.json; the viewer shows them, visuals 0fd7643) and logs the
  winner in knowledge/variants.md; a section failing 2 repair rounds is rebuilt from another plan. The
  user's pick arrives as a "variant-pick" mark (tools/marks.js): apply it by setting that section's reseed to
  the picked key (A=0, B=1, C=2) and rebuilding. For spot changes use the edit path's tools (EDITING.md):
  tools/edit.js edit()/apply()/quickChecks(), tools/review.js, tools/fix.js, tools/families.js -- do not
  duplicate them. Section rebuilds should use lib/incsolve.js (fromBase) to cost seconds: not wired in yet.

- **Compose targets from rated-level data** (taste session, TASTE_DATA.md, knowledge/taste_model.json
  "targets"; score.js gate "taste"): Easy/Normal featured levels have ~75-81 hazards per 100 blocks (aim
  60-90; unrated 155-235, Hard/Harder featured ~140), and LONGER sections: fewer mode/speed swaps per
  minute and fewer distinct speeds rate better. GDLM 45 has 10 sections in 42 s (the user asked for
  sections on the music); 47 has 10 in 100 s. To do: compose aims hazard density at the band and merges
  short sections into longer ones (keeping the look change on the music), checked on 45 v8 / the next level.
  Floating background deco is normal in 2.0-2.2 rated levels (30-52%); craft's <=20% is a 1.x number.

State on 2026-11-22. What a new session should know before touching this area:
- **Natural replay** (`lib/natural.js`, the viewer's default replay): one tap per cube jump, empty
  jumps dropped, ship / wave stretches flown by a controller along the middle of the free space,
  the rest re-solved from there with `GD.solveFrom` (physics session). Every change is kept only if
  the run still finishes. The click table shows these inputs; timing windows stay the solver's
  (in `score.js`). Open: the solver's own run is still what `score.js` judges for prejumps.
- **compose.js** sections in beats, modes ship / wave / ball / upside-down, a look per section
  (section 2b "Sections that follow the song"). Not yet: beats for single chunks inside a section
  (orbs on beats), UFO/robot/spider/swing (not checked in the user's game), gravity flips inside
  ship/ball parts, the difficulty hill-climb for sectionwise levels (they are scored whole once at
  the end, not tuned toward the target).
- **Next for compose (from music sync, 2026-11-23):** `node tools/songmap.js --songs` gives each
  song's sections and drops by bar (spectral novelty) and its beatless share, cached in
  `local/songmap/<song>.json`. Official levels: mode/speed portals sit on those section changes
  (4 sigma), hazards per bar rise with the bar's loudness (16 of 22), no mode in the calm bars
  (SYNC.md section 7). So: take section starts from songmap snapped to 4-bar lines instead of
  hand-reading `local/beats` sections, and scale each section's gaps with its loudness.
- **Variety, not density (knowledge, 2026-11-23, `node tools/variety.js`, knowledge/levels/variety.md):**
  GDLM 41-45 have enough obstacles (0.7-1.0 hazard groups/s, rated Easy 0.34, Normal 0.66) but 1-6
  kinds of gameplay thing against 15-17 in rated Easy/Normal levels, one speed (rated: 2-3), 10-28%
  new chunks (rated: 90-96%), few orbs/pads (rated ~25/min), lone spikes (hazards in 12-23% of
  columns, rated ~40%; `tools/tiercheck.js` per section). For compose: speed portals on section
  changes, orb/pad chunks in every cube section, a chunk never twice in a level unless it is a
  motif, wider chunks (spike runs on blocks, not lone spikes). RobTop's tips (knowledge/rating.md):
  30 s at least, 60 s+ the rated standard.
- **Play on blocks, not the floor (knowledge, 2026-11-23, `node tools/obstacles.js structure --gdlm
  --official`, knowledge/levels/obstacles.md) -- the strongest "bland" finding:** rated Easy/Normal
  and official 1-8 have a block/slab/slope in ~47% of cube columns (GDLM 13%); 44-64% of their
  hazards sit by a block (ledges, steps, pit edges, overhangs; GDLM 17%); 92% of GDLM spikes are on
  the bare floor; rated obstacles are 2 rows tall (GDLM 1). New kinds every ~2 s up to ~85% of the
  level, ~17 kinds (GDLM: every ~8 s, 3 kinds), each used once or twice then left. Next compose
  work: cube sections built on a block terrain (raised runs, steps, pits with edges) with hazards on
  and beside it, and a new kind per few seconds (saws, pads, orbs, gravity, 0.5x speed ...).
- **Modern look (the user: GDLM looks "like 1.0 graphics", wants 2.2; knowledge/levels/modern_look.md,
  `node tools/modern_look.js`):** 2.2 levels the user played have ~46 objects per block (Legendary
  ~32, 2.0-2.1 Featured ~23, GDLM ~1); per section ~36 (ground ~40, flying ~25, opening ~50,
  transitions < 5, drops the densest), a deco set per section, all 9 layers (40-60% behind the play,
  17-26% in front: glow, dots, particles), every deco object on its own colour channel (30-550
  channels, a third blending, HSV on ~40%), ~24 triggers per second of play (move/rotate, alpha/
  toggle, colour/pulse, particles, camera). Two kits: designed blocks (lightsquare/lighttriangle
  fills, d_gradient light, blockOutline/persp_outline edges + 1-2 shape families) or pixel art; both
  with particles, d_small_ball dots, d_scaleFadeRing rings (ids: knowledge/objects/catalogue.tsv,
  check renders with `tools/shoot.js`). Never solid fills in front of the play. This is a decorate.js
  pass of its own (per section kit, layers, channels, pulses on beats), the next big piece after the
  block terrain. Known bug: `tools/style.js classify()` counts 2.2 triggers (area 3006+, shaders
  2904+) as decoration; modern_look.js uses the catalogue's kinds instead.
  A reachable target, from the modern level the user picked as an example (Fall Out, 2.2, Hard;
  "dont need to copy style and everything"; modern_look.md "Worked example 1"): 13 objects per
  block, one motif through every section, a new scene per mode change, frames of cloud bands around
  the play, bold but see-through front layers with hazards kept white/grey, HSV on half the
  objects, shaders only at transitions, a title at the start and credits at the end -- and its
  sparsest part (a black silhouette, 2 per block) is its most striking.
- **Jump indicators**: on by default in compose (chevron 460, white, 45%). Not yet seen in the game.
  GDLM 46 (arrow catalogue) is no longer needed: the visuals catalogue named the ids.
- **Art**: decoration ids have no names. Plan: a generated catalogue level (every deco id with a
  text label) the user opens and screenshots; then style deco sets (hell, classic ...).
- **GDLM 44** (Easy, 10 s, song 343707): v5 under "in progress" in the viewer, all gates pass (the
  ship tunnel's teeth now start 6 columns in: `ship-tunnel` "lead").
- **GDLM 47 sunny side v1** (`briefs/47_happy.json`, 2026-11-23; "a happy level with happy colors,
  1:40"): 102 s on Tiny Tunes (311087), 10 sections on the song's bars, block terrain, 3 speeds,
  cube / ship / upside-down / wave / ball, the modern look with bg art 13 and a light palette, the
  signature. Every gate passes including fairness; Normal (0.51), tightest window 113 ms, 54
  presses. Composing took ~4 full runs to settle the rules in section 2b's GDLM 47 notes (20-30 min
  each; sections now iterate in seconds with `--section n`). Level map: local/maps/gdlm_47_sunny_side.jpg.
  Open: sync WARN (1/10 portals on a bar start: the landing room and speed-portal offsets move portals
  off the bars -- put the offset before the bar instead), 9 chunk kinds (target ~15), not played yet.
- **GDLM 45 first flight v5** (`briefs/45_low_tier.json`, 2026-11-23): the user's "Ragnarok 40 seconds,
  with sections, Normal-Hard, somewhat matching the beat" + more variety, upside down, new modes.
  42 s on 343707, 10 sections cut on the song (quiet build to b69, the drop flashed in): cube,
  ship, ball, upside-down cube, wave, drop cube, ball, wave. All gates pass (26 presses, no
  prejumps, tightest 50 ms); level wave turns, orbs on the arc, a mark on every real jump, the
  modern pass + vfxkit (~6.5 objects per block). The model rates it Easy (0.17): every harder swap
  broke the 50 ms floor -- the difficulty there needs block terrain and denser chunks, not tighter
  timing. Took 28 min to compose (5 rounds x ~4 min) and 5 min to build. In wip and on the phone.
- The approximate prejump check (mode levels) is noisy on chains of jumps: it shifts one press
  with the later ones fixed in time. A fix: re-solve the rest with `GD.solveFrom` for each shifted
  press (exact, but costs a sweep per try).
- Prejumps are exact only on cube levels; on mode levels approximate (WARN).

Tests: `node tests/style_gates.js` (~1-2 min): the gates still agree with what the user found
(GDLM 41 v1's pad prejump flagged, 42's chains gone, 44 without skips), and an upside-down and a
ball section are beaten, cued and taken through their portals.

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
