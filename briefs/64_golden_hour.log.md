# GDLM 64 golden hour
Idea: the user's 'rung 5' of the beauty ladder: the look of Fall Out (knowledge/levels/modern_look.md Worked example 1, ideas only): a new scene per section changed at the portals together with the mode, one motif (drifting light motes) through every scene, frames (cloud bands, light rays, a vignette near the end), bold see-through front layers (~30-40% of deco), HSV on ~half, hazards white/grey on colourful scenes, transitions at portals; gameplay from the intended route with height changes and long sections
Story: a golden-hour day: first light, sunrise on stepped terrain, the noon drop flown and run at double speed, a mauve dusk upside down, the night drop as a wave and a run under the stars, dawn and the signature
Target: {"label":"Normal","minWindowMs":60}
- variants sunrise: v0 kept (58) over v2 22 [WARN prejumps, WARN length, WARN ending, WARN hazards matter, FAIL reactive, WARN difficulty, WARN sync, FAIL skips, WARN route, WARN taste, WARN craft], v1 0 [WARN prejumps, WARN symmetry, WARN height, WARN length, WARN mode changes, WARN ending, WARN orb buffer, WARN hazards matter, FAIL reactive, FAIL player timing, WARN difficulty, WARN sync, FAIL skips, WARN route, WARN taste]
- variants night run: v2 kept (22) over v1 16 [WARN prejumps, WARN height, WARN length, WARN mode changes, WARN ending, FAIL reactive, WARN difficulty, WARN sync, WARN mode entry, FAIL skips, WARN route, WARN taste, WARN craft], v0 10 [WARN prejumps, WARN symmetry, WARN height, WARN length, WARN mode changes, WARN ending, WARN orb buffer, FAIL reactive, WARN difficulty, WARN pacing, WARN sync, FAIL skips, WARN route, WARN taste, WARN craft]

## Round 1: not ready (4 fail, 0 warn)
- PASS beatable: sunrise: 32 presses
- FAIL prejumps: noon run: block 115 (2.3 ahead of block 3 at 119)
- FAIL timing: noon run: tightest 25 ms over 11 inputs, want >= 60 -- block 34 press 25 ms; block 115 press 54 ms; block 120 press 42 ms
- FAIL recovery: noon run: 2 press(es) right after landing (< 100 ms) -- block 115 50 ms; block 120 46 ms
- FAIL skips: night run: cube portal at block 71; cube portal at block 71 not touched by the solved run: block that way past it

Repairs:
- 2 more columns before s:stepped-pyramid at 580 (prejump (2.3 blocks ahead))
- 2 more columns before s:capped-hop at 503 (25 ms window)
- 2 more columns before s:lantern-orb at 875 (prejump (2.2 blocks ahead))
- 2 more columns before single at 942 (prejump (2.2 blocks ahead))

## Round 2: not ready (4 fail, 0 warn)
- PASS beatable: sunrise: 32 presses
- FAIL prejumps: noon run: block 115 (2.3 ahead of block 3 at 119)
- FAIL timing: noon run: tightest 25 ms over 11 inputs, want >= 60 -- block 34 press 25 ms; block 115 press 54 ms; block 120 press 42 ms
- FAIL recovery: noon run: 2 press(es) right after landing (< 100 ms) -- block 115 50 ms; block 120 46 ms
- FAIL skips: night run: cube portal at block 71; cube portal at block 71 not touched by the solved run: block that way past it

Repairs:
- section noon run rebuilt from another plan (reseed 3): 2 rounds of patching did not fix it
- section night run rebuilt from another plan (reseed 5): 2 rounds of patching did not fix it

## Round 3: not ready (3 fail, 0 warn)
- PASS beatable: sunrise: 32 presses
- FAIL prejumps: noon run: block 111 (2.3 ahead of block 3 at 115)
- FAIL timing: noon run: tightest 25 ms over 12 inputs, want >= 60 -- block 34 press 25 ms; block 111 press 54 ms; block 116 press 42 ms
- FAIL recovery: noon run: 2 press(es) right after landing (< 100 ms) -- block 111 50 ms; block 116 46 ms
- PASS skips: sunrise: all 2 portals and 1 orbs on the path

Repairs:
- 2 more columns before s:stepped-pyramid at 576 (prejump (2.3 blocks ahead))
- 2 more columns before s:capped-hop at 503 (25 ms window)

## Round 4: not ready (3 fail, 0 warn)
- PASS beatable: sunrise: 32 presses
- FAIL prejumps: noon run: block 111 (2.3 ahead of block 3 at 115)
- FAIL timing: noon run: tightest 25 ms over 12 inputs, want >= 60 -- block 34 press 25 ms; block 111 press 54 ms; block 116 press 42 ms
- FAIL recovery: noon run: 2 press(es) right after landing (< 100 ms) -- block 111 50 ms; block 116 46 ms
- PASS skips: sunrise: all 2 portals and 1 orbs on the path

Repairs:
- section noon run rebuilt from another plan (reseed 6): 2 rounds of patching did not fix it

## Round 5: not ready (3 fail, 0 warn)
- PASS beatable: sunrise: 32 presses
- FAIL prejumps: noon run: block 111 (2.3 ahead of block 3 at 115)
- FAIL timing: noon run: tightest 25 ms over 12 inputs, want >= 60 -- block 34 press 25 ms; block 111 press 54 ms; block 116 press 42 ms
- FAIL recovery: noon run: 2 press(es) right after landing (< 100 ms) -- block 111 50 ms; block 116 46 ms
- PASS skips: sunrise: all 2 portals and 1 orbs on the path

Repairs:
- 2 more columns before s:stepped-pyramid at 576 (prejump (2.3 blocks ahead))
- 2 more columns before s:capped-hop at 503 (25 ms window)

## Round 6: not ready (3 fail, 0 warn)
- PASS beatable: sunrise: 32 presses
- FAIL prejumps: noon run: block 111 (2.3 ahead of block 3 at 115)
- FAIL timing: noon run: tightest 25 ms over 12 inputs, want >= 60 -- block 34 press 25 ms; block 111 press 54 ms; block 116 press 42 ms
- FAIL recovery: noon run: 2 press(es) right after landing (< 100 ms) -- block 111 50 ms; block 116 46 ms
- PASS skips: sunrise: all 2 portals and 1 orbs on the path

Repairs:
- section noon run rebuilt from another plan (reseed 9): 2 rounds of patching did not fix it

## Round 7: not ready (3 fail, 0 warn)
- PASS beatable: sunrise: 32 presses
- FAIL prejumps: noon run: block 108 (2.3 ahead of block 3 at 112)
- FAIL timing: noon run: tightest 25 ms over 11 inputs, want >= 60 -- block 34 press 25 ms; block 108 press 54 ms; block 113 press 42 ms
- FAIL recovery: noon run: 2 press(es) right after landing (< 100 ms) -- block 108 50 ms; block 113 46 ms
- PASS skips: sunrise: all 2 portals and 1 orbs on the path

Repairs:
- 2 more columns before s:stepped-pyramid at 573 (prejump (2.3 blocks ahead))
- 2 more columns before s:capped-hop at 503 (25 ms window)

## Round 8: not ready (3 fail, 0 warn)
- PASS beatable: sunrise: 32 presses
- FAIL prejumps: noon run: block 110 (2.3 ahead of block 3 at 114)
- FAIL timing: noon run: tightest 25 ms over 11 inputs, want >= 60 -- block 34 press 25 ms; block 110 press 54 ms; block 115 press 42 ms
- FAIL recovery: noon run: 2 press(es) right after landing (< 100 ms) -- block 110 50 ms; block 115 46 ms
- PASS skips: sunrise: all 2 portals and 1 orbs on the path

Repairs:
- section noon run rebuilt from another plan (reseed 12): 2 rounds of patching did not fix it

## Whole level (689 s to score): not ready
- PASS beatable: 42 presses
- FAIL prejumps: noon run: block 111 (2.3 ahead of block 3 at 115) -- from the sections
- FAIL timing: noon run: tightest 25 ms over 12 inputs, want >= 60 -- from the sections
- FAIL recovery: noon run: 2 press(es) right after landing (< 100 ms) -- from the sections
- WARN deco coverage: 3 stretch(es) under half the level's 13.0 deco per block -- blocks 16-32: 5.2/block; blocks 24-40: 5.8/block; blocks 536-552: 6.3/block
- PASS symmetry: orbs centred on their structures
- PASS jump marks: no jump marks
- WARN height: 11.2 floor changes per 10 s (want 12+; official 12-22); 7% of 10 s windows flat
- PASS repetition: 0% of 4-move patterns repeat within 10 s (want 5% or less)
- PASS length: 93 s (official 78-95 s; want 60+)
- PASS mode changes: 6 mode changes, 3.9 a minute (official 1.3-5.2; want 6 or fewer)
- PASS ending: 2.4 s from the last input to the end (official median 0.8 s; want 2.5 s or less)
- PASS orb buffer: every orb can be buffered
- WARN pointless jumps: 3 jump(s) over nothing -- block 664 (off a step); block 700 (off a step); block 713 (off a step)
- WARN hazards matter: 6 hazard group(s) that need no action -- blocks 129-131: walked over without a jump (a gap above it is crossed on foot); blocks 201-201: walked over without a jump (a gap above it is crossed on foot); blocks 511-512: walked over without a jump (a gap above it is crossed on foot); blocks 530-530: walked over without a jump (a gap above it is crossed on foot); blocks 563-564: walked over without a jump (a gap above it is crossed on foot); blocks 879-879: walked over without a jump (a gap above it is crossed on foot)
- FAIL reactive: 8 spot(s) that need exact hops -- block 124: the jump over a hazard must also be timed around a block: its window (208 ms) is cut by a block; block 131: the jump over a hazard must also be timed around a block: its window (208 ms) is cut by a block; block 138: the jump over a hazard must also be timed around a block: its window (208 ms) is cut by a block; block 556: the jump over a hazard must also be timed around a block: its window (275 ms) is split by a block; block 572: the jump over a hazard must also be timed around a block: its window (292 ms) is split by a block; block 879: the jump over a hazard must also be timed around a block: its window (58 ms) is cut by a block; block 555: lands on a <1-block spot and must jump again within 250 ms; block 581: lands on a <1-block spot and must jump again within 250 ms
- PASS player timing: tightest 92 ms over 119 inputs on the player's route, want >= 60
- PASS difficulty: Normal (0.54 = ~3 attempts), want Normal
- WARN pacing: start 38, end 21, longest busy 88, hazards first/last third 77/27 -- 88 blocks with no 6-block rest; last third calmer than the first (27 vs 77 hazards)
- PASS variety: 8 different chunks in 10, most common 20%
- PASS readability: decoration clear of hazards
- PASS colour: 109 colour triggers for 8 coloured sections
- WARN sync: 3/10 portals on a bar start, 9/42 presses centred on a beat -- portals off the bars: put mode/speed changes on bar starts
- PASS lead-in: 8 mode portals with a calm lead-in
- WARN mode entry: ball at block 903 sits at a raised block's end: the new mode can start on its corner
- PASS skips: all 14 portals and 4 orbs on the path
- PASS fairness: no unfair spots found
- WARN route: ship 355-477: 16 presses; wave 749-845: 10 presses, 560 cs within 12 of a wall
- WARN objects: 1 gameplay objects with unconfirmed hitboxes (ids 35)
- WARN taste: 60/100 (EN|2.2; distinctIds p0, moveTrigPerMin p30, hazPer10 p20) -- under featured levels on: 2.2 budget: objects per block (14.8786, want >= 17.043)
- WARN craft: 2/6 craft targets -- pieces100 5 (>= 12), floorHaz 7% (>= 0.15), attached 86% (>= 0.9), hazards100 16 (>= 45, <= 110)

## Kept: not ready, difficulty Normal (target Normal)
