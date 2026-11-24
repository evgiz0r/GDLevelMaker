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

Owner: the polish session until 2026-11-24, now gd-style (see "Handoff" below; wip folder `local/wip/polish/`). Started 2026-11-23. Drawings from the user
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

Round 3 (2026-11-24), the user on round 2: "the ending is too long where nothing happens. lets have the
ending actually ending with gameplay. with the sign still there"; on the ship entry: "not a fan of such ship
entering. the empty below makes it slightly bad. would probably prefer flat ground in such paths";
"disconnected structure" at the wave entry; "indicator inside spike".
- **Gameplay to the end**: the spec runs on from b27 to b101 (slope jump, ball run, dash-orb pit, pink-pad
  step, a ship tunnel, gravity pad gap, orb pit, a second wave, red pad, a ship tunnel with teeth, a green
  orb flip, the gate); the scene clips its scenery 6 blocks past the signature, so the level ENDS there
  (GD ends a level at its furthest object). Last gameplay 41.1 s, sign 42.2 s, end 42.3 s.
- **Flat ground under every mode portal**: a platform level with the tunnel floor before each later ship
  portal (`"portalRow": 2`), so the cube walks in -- a ground dip there forced a jump 4 blocks ahead
  (a prejump). Both wave portals on the walking line (`"portalRow": 1`): the second sat a row up, and a
  fresh solve walked UNDER it and climbed the corridor as a cube (a secret way; physics now refuses to
  save such a plan). First wave one row lower (`low` 2): its exit floor is the ground, not a 1-row step
  the wave had to hop off (a 33 ms double tap).
- **Routes are part of the level**: three planner bugs showed up only on hellgate's gates (holds
  through wave exits, wiggled wave legs, jumps over nothing after an incremental re-solve) -- physics
  fixed them (64e7de3, 6cd11dd, 109f77c); style made sightread treat presses in flight as steering.
Result: score.js READY, prejumps none, all 13 portals and 6 orbs on the path, fairness clean, player
timing 96 ms, ending 1.5 s. Round 3b (v6): the FIRST wave portal's box started 1.1 rows above the ground
just past a ledge (tools/portalground.js) -- a walking cube could pass under it; `"portalRow": 1` on that
wave-zigzag put it on the walking line. Still READY (0 fail), 96 ms, portalground / deadair / joins clean.
What made it better: every fix as a check first (joins, portalground, deadair, indicators), then the
level. What did not: re-solving and hoping -- each new route showed a different problem until the
planner was fixed.

### Round 4 (v7, 2026-11-24): the user's notes on v6

The user played v6 on the phone (slot 152848491): "Interesting. Much more pleasant gameplay for 44. And better contrast
of colors. Still the cps is very small, compared to beat of the song. And the level is pretty bland, in the deco. Not
many objects. But the vibe is bit better honestly."
Keep: fair entries, flat ground into portals, readable climbs, the contrast (path = black bodies with lit edges,
everything else dark). Change:
- **Presses vs the beat**: v6 had 0.50 inputs per beat at 145 bpm (1.20 a second, human route, ship / wave releases
  counted); the official levels 0.53-0.87 (`node tools/tempo.js official`). Thin phrases: the first wave (2 legs), the
  gate-to-slope stretch, the ball run (a flip every 9 columns) and the second wave (long legs). v7: first wave
  seg 2 / legs 4 / flat 2, a double on beat 27, the ball run a flip every 6, the second wave seg 3 / legs 6 / flat 2.
- **Deco**: v6 7.8 objects per block (real 2.2 levels 25-45) and ~10 motion triggers a screen. v7 adds gd-art's kit
  in tools/scenes/hellgate.js: decokit.blockPattern (bricks + crust trims in the blocks), two far mountain ranges,
  hills, dead trees and ruins in the ground spans (none in the caverns), rock shards in the sky, falling ash, and
  decokit.motion per span (pulses on far scenery only, in a dim ember colour, never the path or a hazard -- round 2's
  "too flashy" -- bob on shards / chains / trees, sway on chains; energy by mode, hottest after the drop): ~25 objects
  per block and ~44 motion triggers a screen from the scene alone.

More from the user for v7 (same day): "Some richer variety in the structure. A bit less repetitive paths. Bit more orbs
and reverse gameplay. Some more sync."
- **Variety**: v6 repeated the red pad + 4 spikes (b21 and b81) and the gate (j25 and j99.5). v7 keeps one of each:
  b79 is style's `s:pink-orb-pit` (+ a single on the kick at j81.5); the last gate is gone (see the result below).
- **Orbs and reverse**: b63's yellow orb pit + double -> `s:blue-orb-bounce` (blue orbs, upside down). With
  `s:gravity-pad-gap` (b58), the ball and `s:green-orb-flip` (b94) the level now flips gravity in four places. Orb
  colours: yellow, dash, pink, blue, green, red. Not done: upside-down inside a ship tunnel (ship-tunnel has no
  gravity-portal option yet).
- **Sync**: `node tools/hits.js --level` on v6: 2 of 37 presses (5%) within a frame of a hit, median 210 ms off.
  The song (343707) has almost no drum hits before bar 17 (28 s, the drop); from there kicks and snares every
  half-beat, accents at beats 83.5, 84.5, 92.5, 94.5, 109... (local/hits/343707.json). So sync goes in the
  second half; deco pulses stay off the grid (decokit.motion: one pulse group on the beat, the rest off-beat).

**v7 result (2026-11-25, five builds, ~6-10 min each):** score.js NOT READY only on "roles" (33/42 sections: the
blocks' own dark fill counts as deco against the black bodies -- v6 would fail it too, the gate came after v6).
Prejumps none, fairness clean, player timing 142 ms (v6 96), tempo 0.60 inputs per beat (v6 0.50; busy 0.50),
dead air clean, triples 0, 27 objects per block (v6 7.8), ~1100 motion triggers. WARNs: ending 2.9 s from the
last input (the run-out after the green-orb flip), presses on hits still 2% (median 134 ms off). In the viewer
as wip polish v7; too big for a phone database row (787 KB > 250 KB), so the phone page needs a republish
(tools/web.js) to show it.
What the builds taught: (1) a structure that passes alone can break in context -- b63's blue-orb bounce left the
press before the wave with nothing to jump (prejump at 278; a single at j67 fixed it), s:red-orb-wall right
after s:green-orb-flip prejumped (2.7 blocks), s:orb-ladder-2 there made a 3-orb chain under 500 ms (fairness),
at b100 and b101.5 alike; the level now ends on the green-orb flip. (2) Leave 6+ blocks between two orb
structures. Copies: local/polish/hg_v6.gdlvl, hg_v7_redorb.gdlvl.

## Soft rules from the user's notes (CLAUDE.md: each note is a rule, checked everywhere)

| family | check | sweep (2026-11-23) |
|---|---|---|
| too flashy, hazards not readable | `tools/readability.js <level> --gate`: renders each moment with and without hazards (same run), hazard contrast (WCAG) vs what is behind, bright clutter, flash rate | hellgate v13 fails (1.05), round 2 passes (4.7); the other levels: see below |
| orbs off the natural arc / off-centre | `tools/orbarc.js <level> --gate`: the free arc from the press before each orb, its apex vs the orb; the take-off window with the orbs clicked on reach (`adaptiveTakeoff`); halves / thirds of the hazard row | see below |
| jump mark on a hazard ("indicator inside spike") | `tools/indicators.js <level ...> [--fix]` = decorate.js indicatorIssues; placement: jumpIndicators keeps INDICATOR.clear (40) in front of the hazard | 13 GDLM levels: 44 v4 1 (fixed), 45 9, 47 20, 50 7, 51 6, polished cube timings 4, the rest clean |
| uneven spike clusters | `tools/clusters.js <level ...> --gate`: overlap, ragged gaps, a hazard just before a pad (static) | 13 GDLM levels: v13 3 spots (the user's), GDLM 45 1 ragged (block 63), all others clean; round 2 clean |
| disconnected structure (open step where a slope meets a roof) | `tools/joins.js <level ...> --gate`: each slope's surface ends touch a solid, the ground or the band top (static); showcase's softrules.js "stubs" calls it | 45 7, 46 sketch 2, 47 1, the rest clean; hellgate clean since round 3 |
| empty ground under a mode portal; portal above the walking line | `tools/portalground.js <level ... \| official \| community> --gate`: a pit or hazard under a non-cube mode portal, or its box a cube's height above the ground (a walking cube passes under) | GDLM: hellgate (fixed rounds 3 and 3b); every GDLM level clean since the "above" rule skips a portal the player reaches flying (46 sketch's wave portal at block 87 is entered from the ship: a false positive before); official 65% / community 51% of mode portals flagged (they jump into them: a warning, not a gate) |
| too few presses for the song's beat (the user on hellgate v6: "the cps is very small, compared to beat of the song") | `tools/tempo.js <level ... \| official> [--phrases] [--gate]`: inputs per beat of the human route (taps; ship / wave releases count), over the level and per 2-bar phrase; busy = phrases in the upper half of the level's energy (tools/energy.js). WARN under 0.52 per beat over the level (just under the officials' lowest, Stereo Madness 0.53), under 0.50 in the busy parts, or 2+ busy phrases with under 2 inputs in 8 beats. score.js gate "tempo" (WARN). Official 1-16 + 19: 0.53-0.87 per beat (median 0.62), busy 0.50-1.13; only Theory of Everything has a near-empty busy phrase (one) | 2026-11-24, 28 GDLM levels: under 0.52 per beat -- 01, 02, 41, 42, 43, 44 v6 (0.50), 60, 62 (0.39, busy 0.38), 63, 67, 68 (labs), 69 (busy 0.38); 45, 46 sketch, 47, 50, 51, 52, 61, 64, 65, 66, 70 within the officials' range |
| nothing happens (long ending, empty stretches) | `tools/deadair.js <level ...> --gate`: gaps over 3 s with no press, hazard, orb, pad, portal or corridor wall near the path; the sign over 2 s after the last gameplay; the level running past the sign | 41 1, 43 2, 46 arrow catalogue 1, 46 sketch 1, 47 8, 50 2, 51 1; 42, 44, 45 clean |
| big breaks with nothing (GDLM 61 v3, 38-46 s; widened 2026-11-24 by the craft session) | `tools/deadair.js` also flags input gaps over max(2 s, 2.5x the level's median press gap) and empty screens (nothing but floor in view for 1+ s; `official:N` measures RobTop's: 1 empty screen in ten levels); score.js gate "dead air" (WARN). The 3 s rule missed 61 because nobody ran it on 61 -- now it runs in every score. Polish's review (same day): a gap is time with the button UP (a held press -- a dash orb, a ship climb -- is play: hellgate's 2.1 s dash-orb hold was flagged), and a ground-row block counts at its edges (a step; 62's outro steps read as empty) | sweep 2026-11-24: 45 input gaps, 22 empty screens over 25 levels; clean: 01, 42, 46 sketch; most: 61 (5+3), 62 (2+4), 51 (6+1), 47 (3+2), 64 (3-5 +0-1), 67 (4+2). After the review: 14 empty screens. Polish's fixes: 51 v3 (spikes at 253, 263, 291, 360: READY, 112 ms, dead air 5 flags -> 1 -- the re-solved UFO coasts 14.8-17.6 s; the hanging spike at 253 needs no action, a candidate to remove); 44 tried (a ball flip more, a spike on j77: the ball gap went, but the full re-solve gave prejumps at 83/88/346 and 62.5 ms, and the j77 spike did not end the 30.5-32.8 s gap -- v6 kept, attempt in local/polish/hg_v7_deadair_attempt.diff); 62 planned (a cube jump on the snare opening the ball, b33, and the drop, b97; local/polish/62_deadair_proposal.diff) but loop.js's owner guard stops it (ultrasync's wip) -- for main / the user to clear; 45's 2.03 s left (at the limit); 64 to style (v8), 67 to physics2 |

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

## Handoff (2026-11-24: the polish session is archived, gd-style takes over)

**Tools the polish session wrote** (all static or one replay, seconds a level):
| tool | what | test |
|---|---|---|
| `tools/polish.js` | the passes (fair, sync, chevrons, modern look) on a copy in local/polish/ | `node tests/polish.js` |
| `tools/deadair.js` | dead stretches, input gaps (button up only), empty screens; `quiet()` is score.js's "dead air" | none yet (official:N runs are the yardstick) |
| `tools/portalground.js` | a mode portal over a pit / hazard, or above the walking line (unless arriving flying) | none yet; `official` / `community` print the reference shares |
| `tools/tempo.js` | inputs per beat of the human route vs the officials; score.js "tempo"; style's pace.js uses its exports (check, analyse, inputs, REF -- keep them stable) | `node tests/tempo.js` |
| `tools/indicators.js`, `tools/joins.js`, `tools/clusters.js`, `tools/orbarc.js`, `tools/readability.js` | the soft-rule checks in the table below | via tests/polish.js / none |
| `tools/scenes/hellgate.js` | hellgate's scene (v7: decokit density + motion) | `node tools/make.js specs/44_hellgate.json --look` |

**Open, in order:**
1. Hellgate v7 (round 4 above): built and in the viewer as wip polish; the user's verdict is open. v8 ideas:
   upside-down inside a ship tunnel (ship-tunnel needs a gravity-portal option), presses on the drop's hits
   (beats 83.5, 84.5, 92.5, 94.5: `node tools/hits.js --level`), the roles gate (contrast by role) still fails
   on hellgate's dark scheme -- fixing it means lifting the deco off the black block bodies without losing the
   contrast the user praised on v6 (the user: "better contrast of colors").
2. 62 dead air: local/polish/62_deadair_proposal.diff, blocked by loop.js's owner guard (ultrasync's wip); for
   main / the user to clear.
3. 51 adrift: the hanging spike at 253 (a candidate to remove), the UFO coast 14.8-17.6 s.
4. Levels under the tempo rule: 62, 69 (busy parts 0.38) -- their owners; the early cube levels and labs.
5. The "Open" list below (extend, polish.js on lib/windows.js, drops from songmap, difficulty before/after).

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
