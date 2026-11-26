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

- **Not checked in the real game.** Yellow / pink pad strengths are `sure: false` in lib/objects.js; spider pads and blue
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
