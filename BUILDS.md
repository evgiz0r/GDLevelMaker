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

