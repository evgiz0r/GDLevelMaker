# Auto bricks -- stretches with no click

Evgeni (2026-11-25): "sections without clicks but with interesting patterns of pads portals slopes that create some
interesting movement"; "doesnt have to be a spam, could be much more interesting". (2026-11-26): "i want to start
developing those auto structures" -- in parallel with the section picker, to be used by it later.

Owner: the auto-bricks session (thread "Build auto (no-click) structures", 2026-11-26). Code: `tools/autostudy.js`
(the study), `tools/autobricks.js` (the builder). Results: `knowledge/auto_study.json` (numbers only),
`knowledge/autobricks.json` (our bricks: objects, contract, measures). Test: `node tests/autobricks.js` (~2 s).

## What an auto brick is

A stretch of 0.6-3 s the player crosses with NO press, where the level moves the player: pads (yellow, pink, red, blue,
spider), gravity / mode / speed portals, ledges to land on, falls. It is a LEGO brick like the others (LEGO.md), with a
contract so it can be hung between other pieces:
- `needs`: the state it is entered in -- mode, gravity, speed, size, the row the player walks on (0 = the ground),
  grounded. Every brick so far is entered walking on the ground (cube, or ball for `ball-pp-*`).
- `leaves`: the state at its exit -- mode, gravity, speed, size, row (the surface it ends on: a ledge's top, a roof's
  underside; flying modes: the height in rows), grounded, vy.
- `width` (columns), `secs`, `movers` (what moved the player, in order), `turns` (up/down reversals), `rise` (blocks of
  height used), `hazards` (spikes the fill added), `clickSafe` (share of single stray taps, one every 0.1 s, that the
  player survives), `interest` (0..1, below).

## The study: how the main levels do it (`node tools/autostudy.js`, 25 s)

Every stretch of 0.8 s+ on the 22 main levels' saved routes with no press, where something moves the player.
(2026-11-26; Dash's saved route was stale and died at block 11, so Dash is missing.)

- **About 10% of a main level is auto** (2% Jumper .. 19% Theory of Everything): 4-15 stretches a level, ~1-1.5 s each.
- Families (n, median secs, median rise in blocks, median turns, median stray-click survival):

| family | n | levels | secs | rise | turns | clickSafe | what moves the player |
|---|---|---|---|---|---|---|---|
| pad launch | 42 | 14 | 1.0 | 4.4 | 2 | 0.8 | one yellow pad |
| fall | 31 | 13 | 1.06 | 4.2 | 0 | 0.82 | walking off a ledge (13% die to a stray click) |
| portal ride | 26 | 14 | 1.09 | 4.4 | 2 | 1 | pads into a mode portal (cube, ball, ...) |
| gravity ping-pong | 26 | 10 | 1.11 | 5 | 4 | 1 | blue pads (67 of them), gravity portals |
| pad chain | 8 | 6 | 1.46 | 7.9 | 4 | 1 | 2+ yellow pads |
| gravity flip | 6 | 6 | 0.87 | 4.3 | 1 | 1 | one gravity portal |

- The richest are blue-pad corridors: Fingerdash 32 s (14 blue pads, then a spider portal, 2.5 s, 17 turns), Electroman
  25 s (11 pads of three colours), xStep 27 s (a gravity portal and 8 blue pads). They often END in a mode portal: the
  auto part is how a level changes mode.
- A stray click mostly does nothing (median clickSafe 0.8-1): in the air or on a pad a tap is harmless; the deaths are
  taps while walking on a ledge (falls).

## The builder (`node tools/autobricks.js build`, ~10 s for all 50)

A family is a SCRIPT of moves; each move is placed where the sim says the player is after the moves before it, with no
press, so every pad is touched and every ledge landed on by construction:
- `pad` -- a pad on the surface the player runs on (flipped under a roof when upside down), `gap` columns after it settles;
- `portal` -- a gravity / mode / speed portal in the player's way (`when: "rising"` waits for the rise after a pad);
- `land` -- a ledge (or a roof, upside down) where the player comes down through height h;
- `roof` -- a ceiling over the whole brick (trimmed to the exit); `walk` -- a pause.
Then hazards are filled where the player never goes (spikes on the ground under the flight, hanging spikes under a roof
over it, 2.5 blocks of room around the path), each batch kept only if the zero-press run still clears.

Families (50 variants, all 50 clear with no press on 2026-11-26): `launch` (yellow / red / pink pad onto a ledge),
`pad-stairs` (up, down, zigzag, pink staircase), `pingpong` (blue pads in a 4-6 high corridor, 3 or 5 bounces),
`grav-pingpong` (gravity portals in turn), `spider-zigzag` (spider pads), `pad-flip` (a pad up into a gravity portal onto a
roof, a blue pad back), `pad-portal` (a pad up into each mode portal: the auto mode change), `speed-launch`, `ball-pingpong`,
`drop-chain`. `node tools/autobricks.js list` lists them.

**interest** (0..1) = 0.3 movers (4 = full) + 0.25 turns (5) + 0.2 rise (1-6 blocks) + 0.15 length (0.5-2 s) + 0.1 changes
the state (mode, gravity or height). Top: `pad-stairs-down`, `pad-stairs-zigzag` (1.0), `pad-stairs-up3`,
`pad-stairs-up-pink` (0.92), `pingpong-h6-n5-g1` (0.91). Bottom: a lone pink pad, two gravity portals 2 apart (0.27).

## Rounds with Evgeni (2026-11-26)

Each round is a family in tools/autobricks.js and a lab level in levels/lab/ (wip `auto-bricks/...`):
1. **jank** (`auto_jank`): gapless gravity-portal walls (the "reverse portal wave": portals stacked over the corridor's
   height, `gwall`), blue / spider pad runs with no gap, 5.5 effects/s. Evgeni: "way too repetitive ... we dont want even
   like 2 of the same ... one corridor with poop". **Rule: never the same effect twice in a row** (`noRepeat`; measured
   as `repeats`).
2. **chambers** (`auto_chambers`): rooms of different heights, modes, mini, speed, reverse half the time -- still built
   from runs of one motif, so it fails the rule above.
3. **mix** (`auto_mix`): single effects, each different from the last two, the mode every 1-3 effects, low and tall
   rooms in turn, ledges, speed and size: 26 s, 3.5 effects/s, 32 mode changes, 0 repeats, upside down 35%.
4. **long** (`auto_long`): Evgeni: "motions can be long ... not mega spammy ... falls up, that fall a lot, and start a
   new auto path from there ... off the screen". Room between effects (gaps 0-5, plain stretches), BIG UP (the roof jumps
   to 18-28 rows, a flip, the player falls up off the screen, a floor appears a few rows under that roof and the path goes
   on up there: `ceil`, `floor`) and BIG DOWN (normal gravity, `endfloor`: the high floor ends, a fall to the ground):
   31 s, 2.3 effects/s, 24 mode changes, 1 repeat, rise 21 blocks, upside down 47%.
Measures per brick: `effects` (distinct columns touched), `rate`, `reverse` (share of time upside down), `repeats`,
`modeChanges`, `modesSeen`, `speedsSeen`, `skipped` (moves a lenient family left out because they could not be placed
or killed). A stacked portal wall goes every 2 rows from under the roof to row 1 (a mini player slipped through every 3).

## Outro: the auto ending (2026-11-26)

Evgeni: "i wanted to add some auto gameplay in the end, so its not just flat on the ground near our sign ... it could be
a signature we iterate on". `tools/autobricks.js` family `outro` (seeds 1-6, ~6.5 s, ~70 columns): walls 24 rows high
turn ANY arrival into a plain cube (cube portal, normal gravity, normal size, 1x), it lands, two pads and two mode
changes, a BIG UP (20-26 rows, off the screen) onto a high path, a 2x stretch up there, and a BIG DOWN to the ground in
front of the signature. Checked from six arrivals (cube, ship high, wave, ball mini 2x, UFO, robot on a ledge): all clear
with no press. **make.js: spec `"outro": true | <seed>`** puts it 3 columns after the last gameplay object; the
signature then goes 3 columns after the outro. Off by default (no existing level changes); lab `levels/lab/auto_outros.gdlvl`
(all six after different arrivals), wip `auto-bricks/gdlm_outro_test` (a short level with outro 2 and the signature).
Open: the saved natural route still taps a few times inside the outro (harmless: lib/natural.js does not know it is auto);
sync the big falls to the song's last bars; the outro's look (frame the high path).

Asked next: study the community auto levels Evgeni played (sync, long varied motions; study only, local), and an
**auto ending** -- a signature outro of auto gameplay into our end sign, iterated across levels.

## Beat-first (2026-11-26, round 5): `tools/autobeat.js`

Evgeni, after round 4: "its terrible ... we dont treat this as an artistic level ... we should plan our change of movement
( pad/portal ) , according to the beat ... if we place trigger by trigger, and follow the path and place the next one ...
you need to fill the gap, and play to the next. stacking some motifs ... few of these in a row, and then few of these, and
then a combination of few of these". So the whole level is now built from the SONG, not from bricks:
- **Trigger beats** from the song's grid (viewer/song_grids.js): every 2 beats, every beat while the song is loud, every 4 in
  a breakdown (its loudness sections). A big section change starts a new motif block.
- **Motifs:** phrases of 4 triggers in blocks of 3 -- AAAA, BBBB, then a mix (ABAB, AABB, ABBA, ABAC, AABA). A letter is a
  kind: yellow / pink / red / blue pad, gravity portal, fall (the ledge ends), mode portal, speed, size, teleport (747,
  UNCHECKED in GD). Each block has a mode change at least every other block and a fall where one fits.
- **Trigger by trigger:** the zero-press sim gives the player's state ON the beat tick; the trigger goes at its x, tuned by
  replays until the run changes on that very tick. A pad needs a surface: the ground, a ledge, or -- falling -- a ledge put
  under the player so it lands on the pad on the beat. A mode portal on flat ground comes with a gravity flip (alone it
  moves nothing). A trigger must MOVE the player (a row of height change before the next beat), else another kind.
- **The gap:** a player falling up gets a roof 3-9 rows up, a quarter of the time 14-26 (a big fall off the screen); one
  falling down a ledge on the way 45% of the time; a ledge it stands on runs on to the trigger after next. A kind that does
  not fit gives way to the motif's other letters, then any kind; a beat where nothing works backtracks one trigger.
- **Home:** a wall of cube / normal gravity / normal size / 1x portals, sparse ground spikes where the path never goes.
- Measures: `onBeat` (share within a frame), `meanOffMs`, `asWanted` (the motif's kind used), modes, reverse, rise.

Lab: `levels/lab/auto_beat.gdlvl` ("GDLM auto beat", Electrodynamix, seed 8): 84 s, 76 triggers all on their beat (0 ms
off), 25 mode changes through all 8 modes, upside down 50%, rise 32 blocks, clears with no press. Build: ~12 s.
`node tools/autobeat.js --song <Official> --seed N [--beats N]`; test `node tests/autobeat.js` (~2 s).
Open: Evgeni's look at it; size and speed triggers rarely pass the "moves the player" rule; teleports and spider pads
unchecked in GD; deco that frames the path; a custom song (needs a grid in song_grids.js).

### On the notes, speed from the music (2026-11-26, round 6)

Evgeni on round 5: "we are not catching all the little beats , only some very seldom ones ... it feels much more empty if
we hit like 1/6 of the notes. especially in the faster sections"; "we could put a speed portal in an auto ( and in real
levels ... ) when the music speeds up, and slowering portals when the music speeds down". Now:
- The trigger times are the song's NOTES (`knowledge/song_notes/<key>.json`, every onset with a strength, from
  tools/impacts.js; read by `musicOf`), not the beat grid: loud parts take every note, the rest at least the stronger half,
  never two closer than 0.17 s (`--min-gap`). `--beats-only` = the old beat grid.
- The song's `speedPlan` (impacts.js: speeds up on an impact, calms down) puts a speed portal on the first note of each
  change; it starts a new motif block. A song with no plan gets one from the notes' intensity per 4 beats.
- A short gap does not need a whole row of movement: a trigger counts when it turns the vertical speed.
- When the motif's kinds don't fit, a gravity flip first, mode portals and teleports last (as random fallbacks they made a
  third of all triggers); never AAAA of teleports.
- Speed: each candidate replays from a saved state a little before its note, not from the start (CK = 120 ticks, the
  trigger objects come first in the level so their indices stay): 12 s -> 2-4 s for a song.
- Measures: `notesHit` (share of the notes with s >= 0.3 that a trigger lands on, +-30 ms), `perSec`, `speedChanges`.

Lab v2 (`levels/lab/auto_beat.gdlvl`, Electrodynamix, seed 7): 85 s, 284 triggers (3.6 a second; round 5 had 76),
60% of the song's notes hit, 98% within a frame of their note, speed 1x -> 2x -> 1x -> 2x with the music, all 8 modes,
upside down 54%, rise 58 blocks, clears with no press. Open: Evgeni's look; ship gravity flips at 3+ a second make small
wiggles (on the notes but little motion); speed portals in real levels (not only autos) are the compose / picker threads'.

### Batches: the same music gets the same auto vibe (2026-11-26, round 7)

Evgeni: "usually its intresting the the same beats, music, has the same auto vibe. we can assign some specific notes ( drums ,
piano , high , low ) as different combinations of portals/speed/icon. and reroll after some seconds, on a transition in the
song starting a new batch. we should use more variations of ground - spikes, bit more staircases as a hit in the song. lets
try with a song that has bit more notes per second". Now:
- A BATCH maps each band of notes to one kind -- low (kick / bass), mid (snare / keys), top (hats / high) -- and has two
  icons (modes). A note fires its band's kind, so a repeated beat repeats its movement. A new batch rerolls all three and the
  icons at the song's transitions (impacts.js drop / entry / change, a speed-plan change), at least 6 s apart, or after 16 s
  at the next strong hit. A batch starts with a portal into its first icon. Pads, stairs and falls need a mode that lands
  (cube, ball, robot, spider, UFO); 40% of batches are FLIGHT batches (portals only) whose icon is a ship, wave or swing.
- The song's hits (impacts with strength >= 0.5) are staircase steps: `step` (the ledge ends on the note and goes on 1-2 rows
  lower, or higher under a roof), or, in the air coming down, `land on a stair` (a ledge under the player, landed on the note).
  A batch with steps puts ledges under most falls (85%) so there is something to step off.
- The ground varies every 24 columns: spike runs with gaps, every other column, a long run, small pillars with a spike.
- The busiest songs by notes a second (knowledge/song_notes, s >= 0.3): Geometrical Dominator 8.2, Dash 8.0, Back On Track
  7.9, Clutterfunk / Time Machine 7.4; Electrodynamix 6.0.

Lab v3 (`levels/lab/auto_beat.gdlvl`, Geometrical Dominator, seed 1): 101 s, 414 triggers (4.4 a second), 50% of the notes,
93% within a frame, 6 batches, 49 stair steps, all modes, speed 1x / 2x with the music, clears with no press.
Open: teleport-heavy batches look jumpy; the fly batches often fall back to gravity flips.

### Rapid runs, pads, bursts, no secret way, the ending (2026-11-26, round 8)

Evgeni on v3: "i still feel like we are missing some of the notes ... in those rapid drum/piano (if you can detect them), we
should do very rapid pattern. like very very close, it gives that jiggery effect of the song. Lets try adding more pads, yellow
red ... do we have speed of the song, in order to insert our own speed ups and slow downs? ... how to block the path, so that
the auto is the path i take (and not some secret way that i fly away) ... from now-on everywhere, we add the latest end screen
claude sign on every level we make".
- **He was right about the notes.** Measured on v3 (Geometrical Dominator, 814 notes with strength >= 0.3): 407 kept, 270
  dropped only because the next note came under 0.17 s (the old minimum gap), 123 merged into a louder note within 0.05 s, 14
  too weak. The song is 1/16 notes (101 ms) almost throughout: 81 RAPID RUNS (4+ notes each <= 0.14 s apart) hold 553 notes.
- **Rapid runs**: inside one, notes may be 0.07 s apart (`opts.rapidGap`). Each batch has a RAPID kind for them -- gravity
  flips (the player wiggles), the two icons in turn, or blue pads -- and on a landing batch every other note of a run is a
  yellow or red pad where the player comes down onto something. Accents in a run stay stair steps.
- **More yellow / red pads**: KW yellow 5 (was 3), red 4 (was 2); every landing batch has a yellow or red pad on one band;
  the fallback order starts with yellow, red. v3 had 54 yellow + red pads, v4 219.
- **The song's speed, and our own on top**: the song's speed is measured per bar (tools/impacts.js: weighted notes per beat,
  the finest grid in use, intensity) and its speedPlan follows it. On top of that, `bursts()` adds OUR OWN: one speed up for
  a long rapid run (10+ notes) and back after it, one speed down for a hole of 1.2 s+ with no note and back, at most every
  8 s, never within 3 s of the song's own speed change (`opts.bursts: false` = off). v4: 6 bursts (2x / 3x).
- **No secret way**: `strays()` presses at every 30 ticks of the zero-press run, a tap and a 0.2 s hold, and follows each for
  5 s: fine when it dies or is back in the auto run's exact state. At 1.5 s 137 of 1550 presses were not back; at 5 s 25. A
  press still off the path gets a saw (89) where it first strays 1.5 blocks off it (never within 45 units of the auto path),
  kept while the auto run clears; then checked again. v4: 8 saws, 5 of 1550 presses left, all within ~1 block of the path
  (moving alongside it, not flying away). Most presses come back by themselves: the next portal or pad is where both runs
  end up.
- **The ending**: every autobeat level ends with the auto outro (autobricks.js `outro`, seed = level seed % 6 + 1) and the
  signature (signature.js, header colours, description line) -- the same pair make.js gives every GDLM level. The rule is
  now in BUILDING.md and the checklist for every builder.

Lab v4 (`levels/lab/auto_beat.gdlvl`, Geometrical Dominator, seed 1): 106 s with the outro, 664 triggers (7 a second, was
4.4), 72% of the notes (was 50%), 96% within a frame, speed 1x / 2x / 3x, 120 yellow + 99 red pads, 300 flips, 8 saws, clears
with no press. Build 9 s. **v4 died in the game at ~20 s** (Evgeni: "falls down with the ship"): it was built on physics from before the same day's probe-log fixes (speed portal widths, ship -> UFO speed, ...); on today's physics the same file dies at 20.3 s in the swing. v5 = the same seed rebuilt on today's physics, clears. Lesson: rebuild (and re-check with `node -e` sim or tests) after any lib/physics.js change before installing; the heavy lock's "behind main" warning was the hint. Open: pads on short catch ledges sometimes look like they float (their ledge is cut by the next
step); the rapid flips in a ship make small wiggles; strays are checked only before the home wall.

### Evgeni on v5 in GD (2026-11-26 evening) -- what round 9 is for

"the auto is not bad ... a bit too jumpy across screens at times (in the gd camera). some inside the ground play. no slopes
at all, a slope could count as a jump in a way as it has a similar effect. the beats are somewhat ok (not perfect, still some
feel missing). it feels very random ... how to make it slightly more attractive layout even before the deco. the spike blocks
around the game seem also very random, they are not coherent and not fluid with the path - but blocking the path better is
lower priority for now. for spider portals - only to very small distance. the cameras of what you think and happens in gd dont
match exactly i think". Plan (proposed to him): shape first per phrase (a silhouette that repeats with variation), a height
band the camera can hold, slopes as a kind, spider only where floor and roof are close, hazards that follow the path's
contour, and a camera check against his own run.

Round 9 built (the coordinator relayed his go; his answer on "inside the ground": "does junky movement somewhat within the
block. seems fine with hitboxes, its not terrible, just janky"), `opts.shape` (default on; `false` = round 8):
- **Echo**: phrases of 16 beats in pairs, call and response; a response note wants what the call placed on the same 16th.
  Response notes matching their call: 51% (28% before).
- **Camera band**: within a batch the path never climbs more than 14 rows over the band's floor (`opts.bandRows`); the band
  follows the path down; a new batch (a section change) may move it up, and only there may a roof sit 14-25 rows up.
  Teleports are out of the batches and the fallbacks. 1 s windows with more than 10 rows of height change: 30 -> 7; highest
  point 58 -> 23 blocks.
- **Slopes** (1338, flipped for down): on the ground a ledge ends on the note in a slope 1-2 rows up or down; in the air,
  coming down, the player lands ON a slope on the note (the level is 87% in the air: only 40 of 627 notes found the player on
  the ground). Accents are a slope or a step, half and half. 10 slopes in v6.
- **Not inside the blocks**: `clips()` -- a candidate whose path sinks more than 4 units into a ledge or roof row is refused;
  the final run's clip ticks: 32 -> 0.
- **Spider** moves at most 4 rows from where the trigger finds it.
- **Pads on something**: 11 of 190 pads hung in the air (on a slope's row, past a ledge cut later); each now gets a block.
Lab v6: 106 s, 633 triggers, 69% of notes, clears with no press, 56 saws (the hazards that follow the path are next).
**v6 in the game** (Evgeni died at 15.8 s; probe log, PC local/tmp/autobeat_probe/): game and sim agree tick for tick, x and y,
for 10.3 s through ~30 pads, portals, mode changes and ground slopes -- then a cube falling onto a RISING slope lands in the game
(vy -> 0, then 3.09) but is thrown up at once in the sim (5.77, 7.41). Air landings on slopes are off (`opts.airSlopes`) until
the physics thread has looked; v7 has ground slopes only (fewer: the player is on the ground at ~6% of notes).
The physics thread then matched the whole log (fc2c09f: the air landing was a MINI cube on a slope, slope ends, ground flips,
pad on landing; PHYSICS.md "The auto beat lab log"); normal-size air landings on slopes are still unchecked, so they stay off.
v8 = seed 3 rebuilt on that physics (v7 no longer cleared on it). The builder now also carries a ledge on past the home wall
when the final run dies sliding off its end (Jumper seed 2's wave).

## The community auto levels (2026-11-26, `node tools/autostudy.js --community`, PC run)

Evgeni's save has 12 Auto-rated levels (knowledge/auto_community.json, numbers only). Six are art / quiz / story levels with
almost no effects (useless as references). Three are real auto gameplay -- auto play area (3150), destructive auto, Amethyst
-- at 1.7-2.4 effects/s (one every 0.3-0.4 s), upside down 18-35%; all three die in our sim (70%, 19%, 6%), likely triggers or
teleports we don't model; Interstice dies at 10% in the sim though the save shows it done: a sim bug, the first one to look
at. On the beat about as often as chance. "Big falls in 0 s" of 29-31 blocks are teleports.

## Where they go

- **The lego catalogue**: `build` writes each brick's test level to `local/structures/lego-auto-<id>.gdlvl`;
  `node tools/lego.js mine library` turns them into `auto` bricks (grain brick, `sig` "auto / ...", entry / exit filled
  from the replay with no press) beside the main levels' mined auto bricks. Rerun it after `build`, then republish the
  catalogue page (LEGO.md "Where the catalogue lives").
- **The lab level** `levels/lab/auto_lab.gdlvl` ("GDLM auto lab", wip `auto-bricks/auto_lab`): every good brick in a row,
  best first, each followed by a wall of portals back to cube / normal gravity / 1x, 60 s, cleared with no press. It is for
  looking and marking in the viewer, not a level to play for fun.
- **The section picker** (lego_pick.js, brickpick.js) is NOT changed yet (the Hellgate and structure-library threads are
  reworking it). To use one: `require("./autobricks.js")`, read `knowledge/autobricks.json`, match `needs` / `leaves` to the
  pieces around the seam, and copy `objects` (`[type, col, row, {flipY, rot}]`, col 0 = the brick's first column, row 0 =
  the ground row) shifted to the slot -- the same format as a make.js spec entry.

## Open

- **Partly checked in the real game.** The yellow pad is confirmed (vy 16.000, probe log 2026-11-26); the pink pad is `sure: false` in lib/objects.js; spider pads and blue
  pads on a cube are from the decompile. The lab is the thing to try in GD (with Evgeni's go) or with the probe mod.
- Entry only from the ground at row 0, 1x (plus the speed-launch ones). Next: entries on a ledge, upside down, and in
  flying modes (a ship gliding through gravity portals, a wave flipped by portals = the "auto wave"), 2x/3x versions of
  every family, slopes (the main levels ride slopes in 1 of 145 stretches only).
- Exits upside down under a roof (`pingpong` with an odd count, `spider-zz`) need the next piece to carry the roof on.
- Mixed scripts (a pad chain that ends in a mode portal, the main levels' most common rich shape) and a generator that
  composes moves to fit a given entry / exit and a beat count (the section's slot), with the pads on the song's hits.
- Secret ways with presses (jumping over a pad) are not checked; stray taps that KILL are (`clickSafe`).
- Deco: none yet; the auto stretches in the main levels are often framed (a corridor, arrows) -- the deco step should
  frame the flight path.

## Round 10: hazards that follow the path (2026-11-26, lab v9)

Evgeni (round 9 note): "the spike blocks around the game seem also very random, they are not coherent and not fluid with the
path". The hazard study (HAZARDS.md, lib/hazards.js `hazardsAlongPath`) now places them: autobeat.js runs strays() on the bare
level, passes its leaks as `opts.leaks`, adds the result (kept only while the no-press run clears), and only then the old saw
passes for leaks still open. `opts.hazards: false` = the old sparse ground spikes. Lab v9 (Geometrical Dominator, seed 3):
472 hazards (53 under jumps, 126 lane blocks + 145 spikes, 74 leak blocks, 74 pit spikes, none dropped); leaks 79 -> 33 -> 15
of 1550 strays, saws 75 -> 7. `tools/hazards.js level`: arcs with a hazard 3% -> 45% (rated 60-85), hazards near the path
0.18 -> 2.3 a second (rated 6-11), gap between obstacles 2.0 -> 0.7 s (rated 0.5-0.6). Open: hanging spikes stacked in a
triangle where leak blocks meet a lane piece (t 12 s), lone hanging spikes under a single block, too many guards above in
flight (lane.fly.belowHaz 28 vs rated <20); 15 leaks are still open.
v10 (hazards fd0639c): leaks met by a lane piece count as shut, pieces 2-3 wide, floor side half as often: fly belowHaz
28 -> 19%, 496 hazards, 10 saws, the triangles and lone hanging spikes gone. Still off: guardAbove 27.5% (rated 10-23).
v11 (physics 6a00a0d): Evgeni died at 3% in GD on v10 -- the sim pulled a flipped UFO 1.5x too hard (PHYSICS.md "The auto beat
lab log"). Rebuilt on the fix: clears, 525 hazards, 3 saws, 23 leaks open.
v12 (physics 74a3768): Evgeni's v11 run died at 3% -- a mini UFO climbs a slope later in the game, and a flipped cube dies
landing hard (vy < -4) on a block top. Rebuilt: clears, 837 hazards (180 leak blocks), 13 saws, 37 leaks open.
v13: Evgeni's v12 run reached 16% (tick 4742, 19.8 s) and died where a flipped robot hits the ground at vy -7.3 (no
object); the sim had it land. The sim now kills a flipped robot there too, the same rule as the cube. Rebuilt: the path is
identical to v12 up to that spot (tick 4696), 1074 hazards, 9 saws, clears. Probe log in the project files (auto_bricks/probe).
v14: Evgeni's v13 run reached 68% (tick 17990, 75 s): after a gravity portal the released ship, upside down, pulled 0.069 a
tick (the 0.8 factor) where the sim used 1.2, so it rose 31 units too high into a spike row. The sim now mirrors the ship's
threshold upside down like the UFO's (GDLM_SHIP_FLIP=old = before); with it the sim matches the log to the death tick.
Rebuilt: the same path as v13 up to there, clears.

**v14 cleared in Evgeni's real game (2026-11-26)**: the first auto beat lab to pass, after five probe-log rounds (v10 flipped
UFO, v11 mini UFO slope + flipped cube ground, v12 never installed, v12 flipped robot ground, v13 flipped ship / "Fix
Gravity Bug"). Each death was a sim mismatch, never a level fault the sim saw.

### Auto beat 2: a song where the sync shows (2026-11-26)
Evgeni: "take a song that has a clearer, bit less cps beat, with clearer mixes of instruments; would make the visual sync more
apparent". `node tools/songclarity.js` ranks the officials by strong notes a second, the share on the beat / half beat and how
clearly one band leads each bar. Can't Let Go: 2.52 strong notes/s (Geometrical Dominator 3.11), 62% on the beat and 99% on half
beats (GD: 39% / 83%), lead share 0.66 (the highest; GD 0.55). Back On Track and Deadlocked have fewer notes but a looser grid.
Built: `node tools/autobeat.js --song CantLetGo --seed 3 --name "GDLM auto beat 2" --out levels/lab/auto_beat_2.gdlvl` --
90.7 s, 378 triggers, 98% on the beat, notes hit 0.67, 7 modes (swing new to the auto labs: not yet checked in the game), clears.

Auto beat 2 v1 in the game (2026-11-26): died at 34% (tick 7213). Two sim fixes from its probe log: a cube standing on the
ground keeps the launch tick's gravity step when a pad fires (0.048 down), which made it graze a yellow pad later that the sim
missed by 0.03; and a flipped player sunk more than 0.7 into the ground dies at any speed (a flipped spider on the ground took
a robot portal, the robot's taller box sank 1.07 in). With both, the sim dies on the game's tick. v2: same song and seed,
rebuilt on that physics, the same path as v1 to tick 5641, clears, and the new beat ending (tools/beatend.js).

v3 died at 16% (tick 3540): a flipped mini robot thrown down by a flipped yellow pad touched the ground at vy -1.94 and the
game killed it; the sim's cut was -4. A flipped robot now dies at any speed into the ground (PHYSICS.md). v4: rebuilt on that,
the same path as v3 to 14.5 s, clears.

### Auto beat 3: a calmer level, about a third of the triggers (2026-11-26)
Evgeni after auto beat 2 (4.2 triggers a second): "something with less beats per second, like 3 times less maybe. but not
something too repetetive, it can have some faster sections". `--rate R` (notePlan's thin()): R triggers a second on average,
shared out by bar loudness (the quietest bars ~0.3x the mean, the loudest ~3x, so the level breathes and speeds up), each bar
filled with its strongest notes with on-beat ones first, 0.3 s apart in calm bars, 0.17 s and rapid runs of up to 6 notes only
in the loudest ~15% of bars. Measured at R 1.4 (default plan -> thinned): Hexagon Force 4.57 -> 1.43 a second (88-90% of them
on a beat), Electroman 5.45 -> 1.48, Can't Let Go 4.80 -> 1.39. Electroman came out half gravity flips on every seed tried (1-12),
so Hexagon Force: seeds 1-8 compared by kind mix and modes, seed 4 has the evenest mix (yellow 39, grav 40, mode 21, 5 modes).
Built: `node tools/autobeat.js --song HexagonForce --seed 4 --rate 1.4 --name "GDLM auto beat 3" --out levels/lab/auto_beat_3.gdlvl`
-- 92.5 s, 125 triggers (1.4 a second, auto beat 2: 4.2), 95% on the beat, cube / spider / robot / ball / UFO, 0.5x-2x, clears.
Open: the gravity-flip share on some songs (Electroman ~45%: the batches pick grav as their low kind too often).

### Auto beat 4: twice the pace, more contrast, a Newgrounds song (2026-11-26)
Evgeni on auto beat 3: "bit too slow for me for now. need like twice the beats overall. Can be slower on the slow sections,
and faster in the fast sections. Lets hear some non robtop song. that has slow and fast paced sections". thin() now weights
bars 0.15 .. 4.5 (was 0.3 .. 3), treats the loudest 25% as fast (0.12 s apart, short rapid runs), keeps calm bars 0.35 s
apart, and scales every share up when the busy bars run out of notes, so the mean is reached. Songs with notes measured: the
4 custom ones (Eclipse 1086693 and Two Moons 1175526 were measured in the cloud from songs/free/ for this, `impacts.js <id>
--bpm --t0 --commit`). Plan per 8 s at rate 2.8: Golden Haze (557117, DetiousMusic) 0.5 .. 5 and back, alternating; Infertehno
2 a calm 40 s then busy; Eclipse and Two Moons flatter. So Golden Haze, cut at its section change at 102.9 s (`--beats 238`).
Built: `node tools/autobeat.js --song 557117 --seed 4 --rate 2.8 --beats 238 --name "GDLM auto beat 4" --out
levels/lab/auto_beat_4.gdlvl` -- 107 s, 248 triggers (2.5 a second placed; auto beat 3: 1.4), per 8 s from 0.5 to 4.9, all
7 modes, 0.5x-3x, gravity flips a third, clears. Placement saturates near 2.5 a second on this song (rate 3.1 gave 2.4).

### The beat ending (tools/beatend.js, 2026-11-26)
Evgeni on the old outro: "too big, way too much without anything happening and it doesnt match the beat ... something small
half screen of auto gameplay, that matches the beat ... with the sign there". From the level's end: a portal column on a beat
(any arrival -> plain cube), then 2 pad bounces: each pad fires on a beat (its x fixed by the launch tick in the sim) and each
landing is on a later beat (the landing ledge's top is the feet's height on that beat, so the cube comes down on it; the pad
and beat are picked to keep the ledges low). The cube then runs under the floating sign, which bobs on the beats, and the level
ends 5 blocks after it. Measured: launches and landings within 2 ms of the beats on Can't Let Go, 4-5 ms on Geometrical
Dominator. autobeat uses it by default (`opts.ending: "outro"` = the old one). Open: make.js and the other builders still use
the old outro; the Geometrical Dominator ending climbs to ~4 blocks (no low-ledge beat there).

The end on the last screen (2026-11-26, Evgeni: "the end screen has to include our sign, it extends bit too much so our
signature goes away"): GD ends a level at its furthest object (any kind) with the wall ~340 past it, and the camera stops with
the wall at the right edge of a ~569-unit screen, so only the last ~229 units are on the final view. The ending ran 7.5 blocks
past the sign's centre. Now nothing lies past the sign's right edge (`signature.js` `extent(col)` / `clipEnd`), in beatend,
autobeat, fxgallery and make.js (blocks too; `spec.endRun` still allows deco past it). Auto beat 2 v5.

### The beat ending: looks, and inside the song (2026-11-26)
Evgeni: "lets somehow improve the signature ... not to have the basic blocks on the bottom there (and not after the song
ends)". Two changes, both in the tools, so every autobeat level gets them:
- **No plain blocks.** The landing ledges were columns of plain blocks down to the ground. `beatEnd(..., {look})`:
  `floating` (default) = each ledge is one row floating at the beat's height, and the slab under the sign joins the last ledge;
  `ground` = no blocks at all, every bounce lands on the ground (landings ~30 ms off the beat instead of ~2 ms: the ledge
  height was what tuned them); `plain` = the old columns. `endDeco(level, be, {dress})` then dresses them (deco only):
  `floating` = the structure deco pass (tools/structdeco.js: layered design, depth, chain holders) in the fire palette +
  embers; `ice` = nested frames, bevel, ropes, snow; `ground` = motes only. Gotcha: the slabs sit off the 30-unit grid the
  structure pass assumes, so each height is dressed on the grid and moved back (one pass for all drew the design a row low).
  autobeat: `--end-look`, `--end-dress`. Demos (30 beats of Golden Haze, same level, three endings):
  `levels/lab/auto_ending_a.gdlvl` (floating, fire), `_b` (floating, ice), `_c` (ground).
- **Inside the song.** autobeat's `buildInSong` builds, and when the run's end (the sign's screen) is past the song's last
  beat minus 0.5 s, builds again with fewer beats. Auto beat 3 (Hexagon Force, whole song) had ended 3.7 s after the music;
  now 3.6 s before it. `measures.songLeft` = seconds of song left at the end.
**Superseded 2026-11-27 the same day**: Evgeni asked to cut our signature for now from actual gameplay and make it appear in like the last 5 seconds of the level not bothering the game play with whatever effects -- autobeat's default
ending is now `quiet` (no ending gameplay, the sign over the last 5 s, signature.js `overlay`); `--ending beat` gives the beat
ending below, `--ending outro` the outro, `--ending none` no sign. Demo: `levels/lab/auto_ending_quiet.gdlvl`.
Evgeni picked A ("1 for now", 2026-11-27): it stays the default, and the sign's stage is now dressed as one more slab of the
same design (deco-only blocks, never in the level; `endDeco(..., {stage: false})` = off). Open: make.js's ending is not changed yet.

### Re-checking finished auto levels (tools/autocheck.js, 2026-11-27)
`node tools/autocheck.js <level.gdlvl> ...` runs a saved auto level on today's physics: does it clear with no press, and
how many stray presses (a tap or a 0.2 s hold, every 30 ticks) find a way that neither dies nor rejoins the auto run within
5 s ("leaks", what autobeat's saws shut). Made when saws switched to GD's Fix Radius Collision (kA39, PHYSICS.md): the labs'
saws had been checked with the old rect test. Result: auto beat 1-4 and endings A-C give the SAME counts with the new rule
and with `GDLM_FIXRADIUS=0` (auto beat 30 leaks, 2: 14, 3: 9, 4: 8, endings: 8 each), so the change opened no new way.
The leaks that remain are old: presses in the last half second under the sign ("to the end", harmless) and a few
mid-level spots the builder accepted (its "leaks per pass" line). ~1 s per level.

### Sections by character (tools/sections.js, 2026-11-26)
Evgeni: "sections have to be cut by the transitions of the level". The batches were already cut at the song's transitions,
but each batch's kinds and icons were a dice roll. Now each batch is typed from the measured song (heaviness, loudness, which
band leads, the transition at its start; `node tools/sections.js <song>` prints them) and gets content by type:
drop = red pads on the low notes, yellow on the mid, blue on the top, robot / ball; break = a flight (ship, ufo) with gravity,
mini and icon portals; build = stairs, slopes and pink pads climbing; entry = the batch before goes on and the band that came in
gets a new kind; groove = the batch before goes on with one new icon. Can't Let Go: break 0-7 s, build 7-17, entry 17-24,
drop 24-31, entries to 72, break to the end. Swing is left out of flights until the game has checked it. Full songs clip
into ledges less with it (GD seed 1: 18 ticks vs 26; Can't Let Go: 0). `opts.sections: false` = the old roll.
Auto beat 2 v3 is built with it (and the beat ending).

## Visual effects for auto levels (2026-11-26)

The effects thread's toolkit (EFFECTS.md): `tools/effects.js` puts music-synced effects (lights, dancing blocks, glows along
the path, clouds and a pulsing ring locked to the player, contact flashes at pads and landings, hidden pads) on any auto
level's zero-press run: `FX.context({path, grid, notes})`, then `FX.<effect>(ctx, {t0, t1})`. Gallery: `levels/lab/fx_gallery.gdlvl`.

Checked against RobTop (2026-11-26, Evgeni asked how many sections Electrodynamix has): `node tools/sections.js Electrodynamix`
gives 9 sections, cuts at 7.6 / 22.7 / 29.8 / 37.4 / 45.4 / 53.0 / 67.6 / 73.8 s. The official level changes mode or speed at
7.6 (2x), 22.7, 29.4, 37.8, 43.6, 47.3, 52.4, 52.9 (3x), 56.6, 60.4, 64.1, 67.9, 75.5: 7 of our 8 cuts are within 0.5 s of
one of his, the 8th (73.8) is 1.7 s before his last ship. He adds ~4 s mode swaps inside the loud middle (43-68 s), which
the song typer does not cut: inside a long drop/entry section, change mode every 2 bars or so.

### The fx level: gameplay invisible, a theme per section (tools/fxlevel.js, 2026-11-26)
Evgeni: "make all gameplay invisible at the start ... then in each of the 9 sections apply some different theme (like circle
around, or appearing shapes to the beat, or something falling ...) what we need is a background", then "Fully invisible",
"hidden all the way for now. maybe appear just on the last screen with the signature", "go with the suggested picks".
`node tools/fxlevel.js [--song Electrodynamix] [--seed 1]` -> `levels/lab/fx_level.gdlvl`: the autobeat level, every
non-trigger object but the sign in one group at alpha 0 from the first tick (collision stays), back to alpha 1 on the last
screen; per section of `sections.js` one theme of `tools/effects.js` (THEMES in the tool: ring, ring + zoom + flash, clouds,
checkerboard, dancers, falling shapes (FX.fall) + hit lines, chase + flashes, fast checkerboard, screen frame + clouds), the path glow and contact
flashes everywhere so the run reads, and the background / ground channels turned to the section's colour at each cut. v1:
84 s, 3133 objects hidden, 4449 effect objects, the run identical with and without the effects, clears. v2: falling shapes (the effects thread's FX.fall) in section 6. Open: a painted backdrop per section (DECOART.md) instead of a plain colour; most triggers show only in
GD (lock to camera and scale-on-locked unchecked there).


## Auto clone: a solved level that plays itself (tools/autoclose.js, 2026-11-26)
Evgeni: "once we have a solved level, we can make an 'auto' clone. without adding anything visible, if we can. with triggers
hidden pads clicking the player". GD has no trigger that presses the button, so each press of the saved route becomes the
hidden object closest to it in effect (all in one group at alpha 0 from the first tick; alpha keeps collision):
- ball / swing press, wave and ship press AND release: a gravity portal (a released flipped wave rises like a held one; a ship
  only roughly, 0.25 vs 0.39 a tick). The icon draws flipped while upside down: visible on the ship, slight on the wave.
- spider press: a spider pad (the same teleport).
- cube / robot / UFO press: a pink (10.4 up; a cube jump is 11.18), yellow (16) or red (20) pad under the feet, on a surface or
  floating in the air (a pad fires on touch, it needs no ground when nobody sees it). A pink jump is lower and shorter, so where
  none lands (icy part's 4-block spike pit) a SECOND pad later in the same arc gives back the reach. Also tried from the
  player's spot a little before / after the press (a press that lands a jump on a ledge's edge).
- releases elsewhere are taps: ignored.
The search: per press, every object over a range of x (and the pad kinds), each run with no press from a checkpoint; it must
live to the NEXT press (the next object acts there; requiring more threw away every good one), the closest to the original
path wins, the best 8 kept for backtracking. Results: icy part v3 (25 s, cube + wave) clears (levels/lab/icy_part_v3_auto.gdlvl), 8 presses -> 6 pink pads, one
pink + pink in the air, 2 gravity portals, no backtracking, 3 s. Hellgate (82 s, cube / ball / UFO / ship / wave) first runs: to
48 s, stuck at 47.2 s where a cube jump over a spike right after a ledge needs the exact jump: every pad kind, spot and second pad dies there.
Not checked in the game: whether a hidden pad or portal still shows its flash or particles.

**Auto lab levels (2026-11-28, Evgeni: "can we make lab levels where the level presses for me").** `node tools/autoclose.js
<level> --viewer` writes `levels/gdlm_auto_<base>.gdlvl` with its zero-press run as its solution (the viewer replays it at
once); `--route <file.json>` clones from a route file (GDLM 77's probe route). New: a press that was an ORB press in any mode
(the original jumps with gravity kept) gets hidden pink / yellow / red pads under the player; a blue-orb press a portal or blue
pad; a ball press on a surface also a hidden blue pad; a ship press also pads that kick it up. Results, all with no press:
| level | presses -> objects | clone time |
|---|---|---|
| clickfirst ball | 28 -> 28 portals | 4 s |
| clickfirst corridor (ball, orbs) | 39 -> 30 portals, 8 pads, 1 blue pad | 7 s |
| brickgen2 ball | 56 -> 45 portals, 10 pads, 1 blue pad | 14 s |
| room mover | 21 -> 20 portals, 1 pad | 2 s |
| zoom out | 28 -> 28 pads | 12 s |
| Hellgate theme | 36 -> 35 pads, 2 portals | 18 s |
Open: full levels with ship stretches -- GDLM 76 stops at 19.1 s (ship), GDLM 78 at 13.7 s (ship -> wave portal entered on a
release); a ship flipped by a portal rises 0.25 a tick, held 0.39, and pads overshoot. Test: `node tests/autoclose.js`.

## GDLM 75 held together: a short auto with deco and connected structures (tools/autodeco.js, 2026-11-27)

A ~30 s auto "with some deco and connected structures" (structures held up or joined, not floating loose). One command:
`node tools/autodeco.js --song 1086693 --seed 8 --rate 2.6 --beats 58 --name "GDLM 75 held together" --session auto-held
--out levels/gdlm_75_held_together.gdlvl` (~5 s): autobeat (triggers on the song's notes, hazards along the path, beat ending,
signature) -> the structure deco pass (tools/structdeco.js) with a look per song section (tools/sections.js: drops take the
second look -- fire layered+bevel, ice nested frames+bevel at the drop) -> chain / rope holders (tools/connect.js) kept off the
zero-press path -> motes -> a dark sky in the first look's hue -> the zero-press run checked again. Stages song / layout / path /
deco / final go to the viewer as it builds.
- **Song:** Eclipse (1086693, Uxvellda, CC BY, `knowledge/free_songs.md`): break, entry, DROP, entry inside its first 27 s
  (Golden Haze's first 30 s is one calm break: 52 of 64 triggers came out gravity flips). Seeds 1-11 compared by kind mix;
  seed 8: yellow / blue / grav 10 each, red 7, mini 3, mode 4 (cube / robot / UFO), 0.5x and back, 47 triggers, 100% on the beat.
- **What the tools learned** (fixed at the source, so every level gets it):
  - score.js judged autos as clicked levels: the solver found a 9-press route through the auto, then "skips" failed on
    portals that route jumped past and tempo / density warned on clicks nobody makes. Now an auto is judged on its zero-press
    run (gate "auto"), the input gates say "not judged", and a column of one portal kind counts as one portal (autobeat's
    home wall, the beat ending's portal column).
  - The **depth** 3D effect fails tools/roles.js on plain blocks: its dark extrusion is in the black block body's value
    (pathDeco on 18 of 29 sections; bevel: 0). autodeco and beatend.js's floating ending now use bevel.
  - connect.js put holders only at an island's two exact ends: an auto's path brushes most ends, so most islands floated.
    The holders now slide inward to the nearest clear cell, else one in the middle: 21 -> 31 holders on GDLM 75.
  - autobeat leaves GD's default magenta sky; the deco palettes need a dark one (autodeco sets the first look's sky).
Open: the judge (tools/report.js) still reads an auto as a clicked level ("few clicks", presses); the opening is on the default
ground (startramp would move the auto's path); deco coverage is thin in places (score WARN); Evgeni's look.
