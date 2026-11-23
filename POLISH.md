# Polishing existing levels

Take a level that already exists -- one of the user's own, a GDLM level, later maybe a community one
(kept in `local/` only) -- and make it better WITHOUT redesigning it: same layout, same idea, the
smallest changes that fix what is unfair, unreadable, off the music or bare. Owner: the polish session
(wip folder `local/wip/polish/`). Started 2026-11-23 (the user's idea, CLAUDE.md "Later").

## Commands

| step | command | time |
|---|---|---|
| report only | `node tools/polish.js <level.gdlvl> --dry` | ~50 s cube timings (13 inputs) |
| polish | `node tools/polish.js <level.gdlvl>` -> `local/polish/<slug>_polished.gdlvl` + `.compare.json` | same |
| some passes only | `--passes fair,read,sync,deco` | |
| how fair | `--min-ms 34` (default: 2 frames at 60 fps) | |
| a deco arrow instead of the text "v" | `--indicator <id>[:rot]` | |
| before / after | `node tools/serve.js`, http://localhost:8765/viewer/polish.html (lists every compare file) | |
| show it to the user | `node tools/wip.js put local/polish/<slug>_polished.gdlvl --session polish --note "..."`, then the ArtifactData call it prints (phone page) | |
| test | `node tests/polish.js` | ~35 s |

Output stays in `local/` (never committed): the input may be the user's level. A polished level is
named `GDLM polished <name>` (or `<GDLM name> polished`) so it is easy to find and delete in the game.
Installing it into the save is the main session's job (GD must be closed; `tools/install.js`).

## The passes, in order

Every change is kept only if the level still clears with the edited plan, and no other input's window
within two inputs drops below min(its old window, the limit). At the end a fresh `solveAny` on the
current physics must beat the polished level, or polish.js refuses to write it.

1. **fair** -- inputs whose timing window is under `--min-ms`. Windows are measured by moving each
   input tick by tick and replaying the whole plan (like `tools/windows.js`), but a cube **tap**
   (press + release 1-3 ticks later) moves as a pair: windows.js moves the press alone, runs into its
   own release and prints 8 ms where the window is really 17-25 ms. A window that runs into the
   neighbouring input is marked `+` ("at least") and is not "fixed". Each tight input gets small moves
   of the gameplay objects near the stretch of path from the input before it to the next one:
   orbs +-0.5 / 1 block in x or y, pads and spikes +-0.5 / 1 block along their surface, portals
   +-0.5..1.5 blocks (off a block edge, away from the switch), small block groups (<= 12 blocks, with
   what sits on them) by a row or a column ("widen a gap by a row"). The input is re-centred on its new
   window; the move that widens it most (and moves least) wins; up to two moves per input.
   Also reports, per input, the time since the last mode / gravity / speed change (`ms after a switch`).
2. **sync** -- with the song's beat grid (`node tools/beats.js`): a portal within 1.5 blocks of a bar
   start, an orb within half a block of a beat, is moved onto it -- only if every nearby window stays
   (-4 ms at most). Loosely: nothing else is pinned (SYNC.md "How much to sync").
3. **read** -- `tools/sightread.js` prejumps, plus `tools/decorate.js` jumpIndicators' rule (far cue,
   ledge, first jump after a mode/gravity change), get a jump indicator where none is within 4 blocks:
   the faded text "v" (914, 45% via an alpha trigger on group 990) as compose.js uses, or `--indicator`.
   A prejump is not removed (that would be a redesign), it is marked.
4. **deco** -- only when < 30% of the objects are decoration (a decorated level is left alone):
   block skins 1-7 on plain blocks (decorate.js skinBlocks, the classic outlined set), the classic
   ground kit (crystals 18-21, rods 16 on tops) sparse and never within 3 columns of a hazard, orb or
   pad, rods off the player's path, chains (41) under hanging blocks 3+ rows up where the path is not.

The order matters: fair moves geometry, sync moves orbs/portals (using the fair plan), read and deco
add only no-collision objects, so they cannot break what came before (the final solve checks anyway).

## Results

- **cube timings** (examples/, the user's own hard cube level, 2026-11-23, v1 in wip): tightest
  window 13 -> 42 ms, median 38 -> 54, windows under 34 ms 6 -> 0 (one was under a frame: some
  attempts had no frame to press on). Moves: dash orb down a block, a spike half a block left, two
  blocks down a row, a hanging block one left, the blue orb up a block (its jump was the prejump: 29 ->
  150 ms). One red orb onto beat 13 (165 BPM). 5 indicators. Block skins, 1 crystal, 1 chain.
  Open: the user has not played it; the level is meant to be hard (its name), and 34 ms may ease it
  more than they want -- `--min-ms 17` only fixes the sub-frame ones.
- GDLM 44 hellgate: see below (filled in when its run is done).

## How it was tested

- `tests/polish.js`: tap pairing; the window of cube timings' 13 ms input; a polished level solves;
  read/deco passes add only non-colliding objects.
- Before/after looked at in viewer/polish.html (GD art): both replays on one clock.
- Not yet: the user playing a polished level in the game.

## Open

- Fair pass moves only one thing at a time and re-times only the input it fixes; a fix needing two
  inputs re-timed (an orb moved earlier shifts the landing after it) is reported "kept".
- Sync: drops and section changes (`tools/songmap.js`) are not used yet; only beats and bars.
- Deco: no glow / depth kit yet (d_gradient 503-505, persp_outline) -- needs placement rules from
  rated levels (knowledge/objects/README.md "Open": deco relative to blocks). Colours are left as the
  level has them.
- Difficulty before/after (lib/difficulty.js tier) is not in the report yet.
- Which indicator: the text "v" until gd-style / the user pick a deco arrow (GDLM 46 catalogue).
- Polishing levels from the user's save: read them like tools/install.js does, into local/ only, and
  ask the user first for each one.
