# Builds: what each took, what broke, what to change

One entry per compose run (tools/compose.js writes the numbers; the session adds the change it made after
reading them). Targets: song 10 s, layout with its full plan 60 s, path (check solve) 15 min, final 20 min.
The stage times are also in local/timings.jsonl.

## GDLM 64 golden hour, 2026-11-24 00:37
- stages: song 0 s, layout 86 s, layout 474 s, path 1695 s, deco 1824 s, final 1824 s
- slowest step: path (1221 s); over target: layout 86 s > 60 s, layout 474 s > 60 s, path 1695 s > 900 s, deco 1824 s > 1200 s, final 1824 s > 1200 s
- result: not ready (timing, reactive), 8 round(s), variants: 2 section(s)
- change made: craft pieces out of sunrise / night run until their new shapes land (a 4 ms jump and jumps timed around a block came from the old slab-steps and pillar-climb); no automatic library picks for 64 (a UFO-orb piece tripped skips and added mode changes); intent verify allows 20 local repairs (the ship and wave plans start from another height than their cached tests) and reports where it stopped. Open: flying intents should be cached per entry height; the layout stage took 86 s (target 60), the alternatives 6.5 min, the rounds 20 min.

## GDLM 64 golden hour, 2026-11-24 01:02
- stages: song 0 s, layout 2 s, layout 285 s, path 785 s, deco 921 s, final 921 s
- slowest step: path (500 s); over target: layout 285 s > 60 s
- result: not ready (prejumps, reactive), 8 round(s), variants: 2 section(s)
- change made: both fails were the checks, not the level. (1) The noon-flight ship "prejump" came from scoring the section alone: its own solve climbs early from a standing start (5.6 blocks ahead); in the whole level every tunnel press is 0.4-0.8 blocks ahead. 8 rounds of room / reseed repairs could not fix a false flag. compose.js now judges flying presses in the whole level, not per section. (2) The reactive spot at block 200 was a plain step jump onto stairs with no hazard near; the "split window" rule now needs a hazard in play, as the user note it comes from. Still open: layout took 285 s (target 60); height 11.4/10 s; deco coverage at blocks 16-40 and 536-560; ending 3.1 s; hazards 9 per 100 blocks (craft wants 45+).

## GDLM 64 golden hour, 2026-11-24 01:49
- stages: song 0 s, layout 2 s, layout 162 s, path 719 s, deco 831 s, final 831 s
- slowest step: path (557 s); over target: layout 162 s > 60 s
- result: not ready (prejumps, reactive), 8 round(s), variants: 2 section(s)
- change made: the round-4 fixes missed their real causes, found by printing the checks. (1) The ship prejump is printed in section-local blocks: block 11 is the cube walking into the ship portal from the section's standing start, a cube press, so the flying-mode filter skipped it; presses in a section's 12-block lead-in now go to the whole level too (the seam). (2) The reactive hazard test read a spike from presses that were fine (their run dies later, past the horizon); it now counts only failing presses. tools/reactive.js on 64: clear.

## GDLM 64 golden hour, 2026-11-24 02:56
- stages: song 0 s, layout 4 s, layout 235 s, path 696 s, deco 891 s, final 891 s
- slowest step: path (461 s); over target: layout 235 s > 60 s
- result: not ready (prejumps), 8 round(s), variants: 2 section(s)
- change made: ship and reactive fixed; left: three 2x jumps 1.6-1.7 blocks ahead. sightread's limit is a reaction time, so it now scales with speed (x1.24 at 2x). Then the whole-level score on the saved route (54 s, no solve) found the wave mouth: a cube press held into the wave portal; a press whose window crosses into a flying portal is cued by the portal. Deco after: gd-art's decokit (bricks + lit trims, three-depth backdrop, tufts), scalloped cloud bands, three-value palettes, make --look (35 s): 14 -> 24 objects per block, contrast 100 (ground/sky 2.0 -> 4.5). Result: READY (0 fail, 11 warn).

## GDLM 64 golden hour, 2026-11-24 05:11
- stages: song 0 s, layout 77 s, layout 270 s, path 858 s, deco 1066 s, final 1066 s
- slowest step: path (588 s); over target: layout 77 s > 60 s, layout 270 s > 60 s
- result: not ready (prejumps, fairness), 8 round(s), variants: 2 section(s)
- change made: v2 (denser: Hard target, gaps 2-4, structures in every cube section, gameplay through dawn, exits on bars): hazards 9 -> 19 per 100 blocks, Normal; 2 FAILs. One real: orb-ladder-2 makes 3-tap orb chains inside a level (removed; STRUCTURES.md open). The rest false: the saved human route kept the solver's holds through auto-jump chains (naturalPlan's last step preferred the raw route because humanCost counts a hold as one input) -> 14-27-block "prejumps" and a 6.1 s ending. Fixed by the difficulty session (18779c7); the layout plan now goes through naturalPlan too.

## GDLM 64 golden hour, 2026-11-24 05:44
- stages: song 0 s, layout 18 s, layout 275 s, path 754 s, deco 933 s, final 933 s
- slowest step: path (479 s); over target: layout 275 s > 60 s
- result: READY, 2 round(s), variants: 2 section(s)
- change made: v3: READY in 2 rounds, Hard reached, ending and sync now PASS, hazards 18/100. Left: 15 reactive spots (jumps over spikes timed around a block, 67-108 ms windows) at gaps 2-4 -- the next generator change. Deco after: hazard-clear rule, motion ~11/screen.

## GDLM 64 golden hour, 2026-11-24 06:10
- stages: song 0 s, layout 47 s, layout 309 s, path 809 s, deco 1003 s, final 1003 s
- slowest step: path (500 s); over target: layout 309 s > 60 s
- result: READY, 2 round(s), variants: 2 section(s)
- change made: v4 (block-hops / slab-steps / lantern-orb out): READY in 2 rounds, reactive 15 -> 7, hazards 18 -> 14 per 100 blocks (those pieces carried hazards); noon ship without the near tree line reads cleaner; noon run kept it (coverage). Kept v4 over v3: fairness first. Next: hazards back up with pieces that pass reactive in context (harness with neighbours, STRUCTURES.md open).

## GDLM 64 golden hour v5, 2026-11-24 07:15
- stages: song 0 s, layout 21 s, layout 239 s, path 745 s, deco 984 s, final 984 s
- slowest step: path (507 s); over target: layout 239 s > 60 s
- result: READY, 1 round(s), variants: 2 section(s)
- change made: v5 = the structural fix (structures checked in context, compose uses only ready ones): READY in 1 round (v3/v4 needed 2), jumps timed around a block 7 -> 5, hazards still 14/100 -- the pieces that pass in context carry fewer hazards. Density next needs denser pieces that pass in context (new library shapes) or spike floors (craft floorHaz 8% vs 35%).

## GDLM 65 single builder test, 2026-11-24 14:10
- stages: song 0 s, layout 97 s, path 846 s, deco 1091 s, final 1091 s
- slowest step: path (750 s); over target: layout 97 s > 60 s
- result: not ready (prejumps), 8 round(s)
- change made: none -- this was the single-builder baseline for the collab test below (same brief, one compose).

## GDLM 65 collab test (tools/collab.js), 2026-11-24
- what: a 51 s brief (6 sections: cube, cube, ship, 2x cube, wave, cube) split into 4 parts of 10-17 s pinned to song
  time, each part built alone by its own builder agent, joined by time; routes joined, no solve.
- final round (all fixes in): parts built 2 at a time (2 lock slots): p1 54 s, p2 19 s, p3 3 s of work (p0 4 s earlier),
  lock waits 34-86 s; join + full check 113 s (most of it fairness). Wall 236 s -> READY, every seam holds.
- one-builder baseline on the same brief (GDLM 65 single builder test): 1115 s (18.6 min), 8 repair rounds, NOT READY
  (2 prejumps). Not the same judge: parts are scored alone (exact cube checks), the whole level by the sweep.
- seams: join 1: 3 of 3 failed; join 2: 3 of 3; join 3: 0 of 3. Part builds: 11 runs, 4 crashed (runcache, fixed by
  physics2 f6abcdf), 4 failed their own seam (contract and exit fixes), 0 failed on gameplay after the tick fix.
- the time that went: lock waits (up to 58 and 91 min behind other sessions' long solves, before the 2 slots).
- what broke and what changed (each now in BUILDING.md 1 and the code): a part's header is dropped at the join (seam
  speed = arrival speed, a faster part brings its own portal); a portal on a part's first column is touched ~30 units
  early once joined (portalRoom 3); a flight exit at the section's end leaves the cube on the frame at the seam
  (exitRoom 4); a hold crossed a seam (release at every seam); seam state read 30 ticks before; parts' deco before
  their start dropped; plan.json written per part (2 builds at once); --seed did nothing (now reseeds sections);
  score.js moved presses to fractional ticks (rounded).
- next: a part's deco by its own builder (today the scene / modern pass runs per part, no art pieces yet); parts of
  other modes at the seam (a ship seam); the viewer's per-part stage bar; sync drift budget across many seams.

## Collab round 2, 2026-11-24: deco per part, flight seams, drift, the long song, GDLM 64 v6
- new in tools/collab.js: `deco` (a part's decorator: tools/scenes/kit.js, gd-art's kit in each section's colours;
  gameplay checked unchanged, route kept: 0 s of work per part); `scene` (one level-wide scene over the joined level,
  for Golden Hour's: 53-56 s); parts placed on the joined level's own timeline (drift 0 u at every seam, budget 6);
  the join re-routes a part from the state it is handed (solveSweep start/goal: GDLM 66 p1 re-routed in 9.2-9.6 s);
  seams inside a flight (`continue` sections, mode-only contract).
- GDLM 65 (4 parts) decorated part by part and rejoined: READY, 200 s wall.
- GDLM 64 v6 (Golden Haze, 7 parts, art's dense chains + height pieces): JOINED, READY (0 fail, 11 warn), all 7 parts
  OK, drift 0. But not better than v5: hazards still 14/100 (the chains are 1x cube pieces; ship / wave / 2x / upside
  sections stay classic), reactive 8 (v5 5), Normal ~4 attempts. And its picture shows the blocks' raw grid skin
  (white grid lines over the sun in the noon ship): v5 dressed blocks in its per-level pass; v6's parts were built
  without it and the scene's fills do not cover every block. Next: build parts with the modern block dressing on.
- GDLM 66 collab long (100 s, 7 parts incl. a ship seam): every seam holds, drift 0, re-route works -- one spot left:
  after p1's ship exit the cube falls from high and meets a spike ~2.3 blocks after landing (10 calm columns only moved
  it 2 blocks): the calm after a flight should scale with the exit height.
- what broke this round -> fixed: parts "failed" difficulty (level-wide gates now the join's); exit read at the seam's
  last tick vs the join's -30 (both -30 now); ship exits 6 blocks early; a part did not know the next part continues its
  flight (brief._continueAfter); upside parts exit 6 early; a cube press right at a flying portal read as a prejump
  (cued by the portal now); old builder processes on old code overwrote fixed parts (stopped; rule below).
- builders: lighter-model agents handed back before their builds finished (they could not wait for the notification):
  the builds ran on, but retries and deco fell to a finisher script. For mechanical part builds a script with named
  builders is as good and far cheaper; agents earn their cost when a builder has to judge and change its part.
- the time: lock waits dominate (23 min for p2/p6 of 66 while other sessions' jobs ran); work per part 0-55 s.
