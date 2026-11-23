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
| the level as text | `node tools/textmap.js <level> --from C --to C` (blocks, spikes, orbs, portals, the path, presses) | seconds |
| readability | `node tools/readability.js <level> [--gate]` (hazard contrast, clutter, flashing; renders) | ~8 min for 12 s |
| orbs at the natural arc | `node tools/orbarc.js <level> [--gate]` | ~1 min |
| spike groups | `node tools/clusters.js <level ...> [--gate]` | instant |
| orb chains | `node tools/orbchain_try.js [--n 2,3] [--row 2,3] ...`: orb-chain layouts ranked by their tightest window | ~6 s a layout |
| show it to the user | `node tools/wip.js put local/polish/<slug>_polished.gdlvl --session polish --note "..."`, then the ArtifactData call it prints (phone page); tell the main session (it installs) | |
| test | `node tests/polish.js` | ~35 s |

Output stays in `local/` (never committed): the input may be the user's level. A polished level is
keeps its GDLM name **exactly** (no " polished", no "v3"): a level's name is fixed once it is uploaded
(the user, 2026-11-23: "We use the same name once uploaded, no rename"; the GD server refuses a renamed
shared level, PUBLISH.md), and a polished version is an update of the same level. Any other level gets
the working name `GDLM polished <name>`; before its first upload give it a proper final name with
`--name` (pick it with care: it stays for good).
Installing it into the save is the main session's job (GD must be closed; `tools/install.js`).
Real-game results come back from the physics session (`node tools/real_stats.js <name>`,
`local/real_stats.jsonl`: every death with a fair / unfair verdict).

## The passes, in order

Every change is kept only if the level still clears with the edited plan, and no other input's window
within two inputs drops below min(its old window, the limit). At the end a fresh `solveAny` on the
current physics must beat the polished level, and the fairness gate (`tools/fairness.js`, difficulty
session: families fitted on the user's labelled deaths) must give no FAIL, or polish.js refuses to
write it (`--force` overrides; WARNs go in the report).

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
   checkered grid in the GD-art render. The fill is a DARK tint of the scene colour (a bright one made
   GDLM 46's wave walls flat hot-pink masses: GD's blocks are see-through), and no soft light sits on a
   block under a slope (it drew the wave's diagonal walls as a staircase). Skipped if the level uses
   colour channels 20+.

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
- **GDLM 44 hellgate** (gd-style's v6 from wip), v1 in wip (stale, see below): cube taps after the ship 4 -> 33-54 ms (a
  yellow orb down half a block twice, a spike half a block left), the red pad half a block right
  (4 -> 379 ms), the cube portal onto bar 9. Already decorated (42%): no deco pass. (Before the look pass.)
- **GDLM 46 sketch** (the user's drawing, SKETCH.md): v3 in wip -- spec changes from the user's v2 deaths,
  then polish: tightest 17 -> 42 ms, forced 2 -> 0, fairness gate passes, 2.6 -> 6.6 objects per block.
  Details in SKETCH.md.
- GDLM 44's polished v1 is stale (gd-style's v9 came after) and both fail the fairness gate's wave
  entrance; hellgate stays gd-style's (told them about `leadGap`).

## GDLM 44 hellgate rounds (2026-11-23, ongoing)

The user: "continue iterating and making prettier, specifically hell44" -- in rounds, toward the modern
2.2 look, more synced, gameplay where it helps, every gate green, the name stays "GDLM 44 hellgate".
How: the look lives in a scene script, `tools/scenes/hellgate.js` (spec key `"scene"`; the spec's gameplay
stays gd-style's), rebuilt with `node tools/make.js specs/44_hellgate.json --look` in a second. Renders:
`node tools/shoot.js levels/gdlm_44_hellgate.gdlvl --at 0.8,2.6,4.6,6.6,8.6,10.6 --out local/shots/hg_rN`
and an ffmpeg 3x2 sheet. Each round goes to wip (`local/wip/polish/`) and its sheet to the main session.

Round 1 (look): one scene per mode, the palette switched at each portal (own channels 30-41); lava glow
along the ground (blending gradients) pulsed on bars and every beat of the drop; rock spires in two
parallax layers (thorn sprites 461-466 scaled 2-6x, locked at 0.85 / 0.6); stalactites lowered into the
ship and wave spans; embers rising (faster and sideways in the flying spans); obsidian blocks with lava
edges (scenekit designBlocks); chains and skulls in the orb span and the end; a dark top frame; the
middleground hills recoloured (channels 1013/1014 were icy blue: the worst visual bug of v12).

What made it prettier (in our render):
- the palette per section plus the lava glow: v12's flat dark red became a lit scene at once;
- obsidian blocks with lava edges: the white grid skins were the most "editor" thing on screen;
- a DARK disc behind each portal: it frames the portal and makes it pop.

What did not:
- a filled light disc (497) or a lit ring (236) behind a portal: a big orange blob that hides it;
- thorn sprites dense (one every 2-3 blocks): broken glass, not rocks; one every 5-9 blocks reads as rocks
  (still shard-like: a real rock silhouette recipe is open);
- fires (920-924) at the ground near the path: they read as hazards next to the cube. Far back (B4), small,
  dimmed only;
- a second sky flash at the drop on top of the spec's own: the sky washed out to beige and the white
  spikes were unreadable on it. Rule: hazards must keep contrast on the brightest frame of the drop.

Round 1 gameplay (the user's note on the round-1 frames, knowledge/critiques.md): the orb chain landed
in a 2-column gap before a 2-high block (two 4 ms jumps; a late orb press ran into the wall). The spec's
platform now starts where the spikes end, 1 high and 5 long (2 high failed the fairness gate at the wave
exit). Tightest window 208 ms over the human route, score.js READY (warns: v12's prejump at block 6, an
empty last third -- next round's gameplay).

Round 2 (2026-11-23), the user on round 1 in the game: "waaaay too flashy. the contrast between the
objects is bad, hard to tell what kills you what not"; on the orbs (v12): "hard to time the orb ... the
timing is unnatural and small"; on block ~85 (v13): "this looks like very bad jump".
- **Calm look**: no per-beat pulses (a soft edge swell on bars in the drop zones and at each mode change
  only), no blending glow (five blending channels washed the spikes out), the haze dim and fading up
  from the ground, deco dark and desaturated (rocks far only, no near layer, no fires, few embers
  behind), the spec's full-screen orange sky flashes made short shifts of a dark sky.
  Measured (`tools/readability.js`): hazard contrast 1.05-1.48 -> 4.7-6.0, clutter 9.2% -> 2.1%,
  flashes 0.27/s -> 0.
- **Orbs on the natural arc**: 9 spikes from b10+2, yellow orbs at b10+4 row 2 and b10+7 row 3,
  the landing platform right where the spikes end (b10+11). Take-off 54 -> 192 ms (with the orbs
  clicked on reach), orb presses 196 / 217 ms. The orbs sit 0.5-0.6 block off the spike row's exact
  thirds (an 8-spike row with them on the thirds does not solve with one press per orb): kept, stated.
- **The jump before the red pad**: the j19 single and j20.5 double were nudged into each other and
  against the pad (13 ms with later inputs fixed; 63 ms in the shared player window, lib/windows.js since main 05abaf7, which re-plans the next input -- tight either way, the user's "very bad jump"); now one single at b20, 6 blocks after the
  wave exit, 2 blocks of run before the pad.
What made it better: readability first. A dark, calm scene with white hazards reads at a glance and still
looks like hell (dim warm haze, dark rocks, lava-edged blocks). What did not: everything that pulsed.

## Soft rules from the user's notes (CLAUDE.md: each note is a rule, checked everywhere)

| family | check | sweep (2026-11-23) |
|---|---|---|
| too flashy, hazards not readable | `tools/readability.js <level> --gate`: renders each moment with and without hazards (same run), hazard contrast (WCAG) vs what is behind, bright clutter, flash rate | hellgate v13 fails (1.05), round 2 passes (4.7); the other levels: see below |
| orbs off the natural arc / off-centre | `tools/orbarc.js <level> --gate`: the free arc from the press before each orb, its apex vs the orb; the take-off window with the orbs clicked on reach (`adaptiveTakeoff`); halves / thirds of the hazard row | see below |
| jump mark on a hazard ("indicator inside spike") | `tools/indicators.js <level ...> [--fix]` = decorate.js indicatorIssues; placement: jumpIndicators keeps INDICATOR.clear (40) in front of the hazard | 13 GDLM levels: 44 v4 1 (fixed), 45 9, 47 20, 50 7, 51 6, polished cube timings 4, the rest clean |
| uneven spike clusters | `tools/clusters.js <level ...> --gate`: overlap, ragged gaps, a hazard just before a pad (static) | 13 GDLM levels: v13 3 spots (the user's), GDLM 45 1 ragged (block 63), all others clean; round 2 clean |

Windows: a jump's window should be measured with the NEXT input re-timed (a player reacts), not fixed
in time: fixed, a take-off before an orb chain read 13-21 ms in a test world where a player has 96-196
ms. tools/orbarc.js adaptiveTakeoff and style's score.js "player timing" gate do this; told visuals for
lib/windows.js (the viewer's window bars).

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
- Look: big wall masses (wave and ship corridors) read as flat fills; fills only on edge blocks may
  look better -- untested.
- Look: 3.8 objects per block (the checklist's target is 10-50; modernPass stays near 5-6 by design).
  No front-layer glow or particles yet, no shaders, colours of hazards untouched.
- Fair pass moves one thing at a time and re-times only the input it fixes.
- polish.js's own windowOf still holds later inputs fixed (pessimistic); the shared measure is now
  lib/windows.js (difficulty's re-planned measureWindows, used by the viewer, score.js and tools/windows.js):
  polish.js should switch to it so every tool gives one number.
- Sync: drops and section changes (`tools/songmap.js`) are not used yet; only beats and bars.
- Difficulty before/after (lib/difficulty.js tier) is not in the report yet.
- The viewer's GD art draws the title text object (914) as an editor "Start pos" label (visuals session).
- Polishing levels from the user's save: read them like tools/install.js does, into local/ only, and
  ask the user first for each one.
