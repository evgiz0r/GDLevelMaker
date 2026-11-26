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
