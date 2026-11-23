# Polishing existing levels

**What polish means (the user, 2026-11-23):** "By polish i mean make it prettier. More visuals. Maybe
more gameplay. More synced. Fix visual issues. Maybe to extend if possible." So polish is a full
upgrade of a level that already exists -- one of the user's own, a GDLM level, later maybe a community
one (kept in `local/` only) -- that keeps its identity (layout, idea, colours, block look):

1. **prettier, more visuals** -- decoration up to the modern target (knowledge/levels/modern_look.md,
   knowledge/checklist.md "Looks like 2.2"): scenes per section, lit blocks, backdrops, parallax, pulses;
2. **more synced** -- portals and orbs on bars and beats, pulses on the bars, a flash at each new scene;
3. **fix visual issues** -- nothing over a hazard, nothing in front of the play, hazards readable;
4. **more gameplay** where it is thin, and **extend** it with more sections in the same style where the
   song allows (not built yet, see Open);
5. **fair, as the floor** -- the fixes below, and the knowledge checklist's fairness targets.

Owner: the polish session (wip folder `local/wip/polish/`). Started 2026-11-23. Drawings from the user
turned into levels: SKETCH.md.

## Commands

| step | command | time |
|---|---|---|
| report only | `node tools/polish.js <level.gdlvl> --dry [--passes none]` | ~1 min cube timings, ~3 min GDLM 46 |
| polish | `node tools/polish.js <level.gdlvl> [--name "..."]` -> `local/polish/<slug>_polished.gdlvl` + `.compare.json` | same |
| some passes only | `--passes fair,sync,read,look` (also `deco`: the old classic ground kit) | |
| how fair | `--min-ms 34` (default: 2 frames at 60 fps) | |
| another indicator / height | `--indicator <id>[:rot]`, `--lift 24` | |
| renders | `node tools/shoot.js <level> --at 1.5,4,7 --out local/shots/<name>` for before and after (it may not exit after writing: the PNGs are there), then `ffmpeg -i before.png -i after.png -filter_complex "[0]scale=960:-1[a];[1]scale=960:-1[b];[a][b]vstack" ba.png` | ~1 min |
| before / after live | `node tools/serve.js`, http://localhost:8765/viewer/polish.html (every compare file; GD art; numbers, changes, every window) | |
| the level as text | `node tools/levelmap.js <level> --from C --to C` (blocks, spikes, orbs, portals, the path, presses) | seconds |
| orb chains | `node tools/orbchain_try.js [--n 2,3] [--row 2,3] ...`: orb-chain layouts ranked by their tightest window | ~6 s a layout |
| show it to the user | `node tools/wip.js put local/polish/<slug>_polished.gdlvl --session polish --note "..."`, then the ArtifactData call it prints (phone page); tell the main session (it installs) | |
| test | `node tests/polish.js` | ~35 s |

Output stays in `local/` (never committed): the input may be the user's level. A polished level is
named `GDLM polished <name>` (or keeps its GDLM name) so it is easy to find and delete in the game.
Installing it into the save is the main session's job (GD must be closed; `tools/install.js`).
Real-game results come back from the physics session (`node tools/real_stats.js <name>`,
`local/real_stats.jsonl`: every death with a fair / unfair verdict).

## The passes, in order

Every change is kept only if the level still clears with the edited plan, and no other input's window
within two inputs drops below min(its old window, the limit). At the end a fresh `solveAny` on the
current physics must beat the polished level, or polish.js refuses to write it.

1. **fair** -- inputs whose timing window is under `--min-ms`, and inputs FORCED right after a mode,
   gravity or speed change (their window closes under 250 ms after it: lib/difficulty.js
   forcedAfterSwitch). Windows are measured on the natural plan (lib/natural.js, a tap per jump; the
   solver's fewest-presses plan holds through cube runs, and GDLM 44 read a "4 ms" press no player
   meets), by moving each input tick by tick and replaying the whole plan, a cube **tap** (press +
   release 1-3 ticks later) as a pair (moving the press alone runs into its own release: 8 ms where the
   window is 17-25). A window that runs into the neighbouring input is marked `+` ("at least"). Each
   unfair input gets small moves of the gameplay objects near the stretch of path from the input before
   it to the next one: orbs +-0.5 / 1 block in x or y, pads and spikes +-0.5 / 1 block along their
   surface, portals +-0.5..1.5 blocks (off a block edge, away from the switch), small block groups
   (<= 12 blocks, with what sits on them) by a row or a column. The input is re-centred on its new
   window; the move that widens it most (and moves least) wins; up to two moves per input.
2. **sync** -- with the song's beat grid (`node tools/beats.js`): a portal within 1.5 blocks of a bar
   start, an orb within half a block of a beat, is moved onto it -- only if every nearby window stays
   (-4 ms at most). Loosely: nothing else is pinned (SYNC.md "How much to sync").
3. **read** -- a jump indicator (gd-style's INDICATOR in tools/decorate.js: the deco 460 chevron
   pointing down, scale 0.7, white, faded to 45%) at every NEEDED jump off a surface (the plan without
   that tap dies), `INDICATOR.lift` (24) units over the surface, none within 3 blocks of another; the
   level's old indicators (group 990) are replaced. From the user's GDLM 46 v2 notes: "too high above
   the ground", one "where no jump is needed", "some jumps have none". Prejumps are marked, not removed.
4. **look** -- only on a level under 8 objects per block. Sections are cut where the run changes mode
   or gravity (at least 15 columns, short ones merged); each gets a palette from the level's own
   background colour turned round the hue wheel (the first scene keeps the level's colours). Then
   decorate.js `modernPass` (a lit fill behind every block, a soft light on open tops, backdrop shapes
   per kind of section, a dot motif, cloud bands framing the top, the title), vfxkit.js `parallax` (two
   slow background layers per section) and `beatPulses` (a pulse on every bar start, a flash at each new
   scene). Dropped: anything in front of the play near the path, and any shape whose size reaches a
   hazard, orb or pad (a cloud band crossed cube timings' hanging spikes). The level's blocks are NOT
   reskinned: the classic outlined skins over the lit fill drew the user's glowing black blocks as a
   checkered grid in the GD-art render. Skipped if the level uses colour channels 20+.

The order matters: fair moves geometry, sync moves orbs/portals (using the fair plan), read and look
add only no-collision objects, so they cannot break what came before (the final solve checks anyway).

## Results

- **cube timings** (examples/, the user's own hard cube level), v3 in wip, 2026-11-23: tightest window
  13 -> 42 ms, median 38 -> 54, windows under 34 ms 6 -> 0 (one was under a frame). Moves: dash orb down
  a block, a spike half a block left, two blocks down a row, a hanging block one left, the blue orb up a
  block (its jump was the prejump: 29 -> 150 ms). One red orb onto beat 13 (165 BPM). 7 chevrons. Look:
  4 scenes (cube, cube, upside, cube), 1.2 -> 3.8 objects per block, 14 beat pulses. Renders:
  `local/shots/ct_ba_*.png`. Open: the level is meant to be hard (its name); 34 ms may ease it more than
  the user wants (`--min-ms 17` fixes only the sub-frame ones). Parallax's near clouds (rows 3-6) still
  drift behind the hanging spikes (vfxkit, visuals session).
- **GDLM 44 hellgate** (gd-style's v6 from wip), v1 in wip: cube taps after the ship 4 -> 33-54 ms (a
  yellow orb down half a block twice, a spike half a block left), the red pad half a block right
  (4 -> 379 ms), the cube portal onto bar 9. Already decorated (42%): no deco pass. (Before the look pass.)
- **GDLM 46 sketch** (the user's drawing, SKETCH.md): v3 -- see SKETCH.md for the spec changes from the
  user's v2 deaths; polish results there.

## How it was tested

- `tests/polish.js`: tap pairing; the window of cube timings' 13 ms input; read + deco add only
  non-colliding objects and the level still solves.
- Every polished level: a fresh solve on the current physics (polish.js refuses otherwise), GD-art
  renders before/after (shoot.js), viewer/polish.html.
- The real game: GDLM 46 v2's deaths (physics session, 03-50-48.mkv) drove the v3 fixes. Not yet: a
  polished level played by the user.

## Open

- **More gameplay / extend** (the user's points 4): not built. Extending needs new sections in the same
  style on the rest of the song (compose.js sections with the level's own chunk kinds); cube timings is
  10.6 s on a 262 s song.
- Look: 3.8 objects per block (the checklist's target is 10-50; modernPass stays near 5-6 by design).
  No front-layer glow or particles yet, no shaders, colours of hazards untouched.
- Fair pass moves one thing at a time and re-times only the input it fixes.
- Sync: drops and section changes (`tools/songmap.js`) are not used yet; only beats and bars.
- Difficulty before/after (lib/difficulty.js tier) is not in the report yet.
- The viewer's GD art draws the title text object (914) as an editor "Start pos" label (visuals session).
- Polishing levels from the user's save: read them like tools/install.js does, into local/ only, and
  ask the user first for each one.
