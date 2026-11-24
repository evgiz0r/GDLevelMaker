# GDLM 64 golden hour
Idea: the user's 'rung 5' of the beauty ladder: the look of Fall Out (knowledge/levels/modern_look.md Worked example 1, ideas only): a new scene per section changed at the portals together with the mode, one motif (drifting light motes) through every scene, frames (cloud bands, light rays, a vignette near the end), bold see-through front layers (~30-40% of deco), HSV on ~half, hazards white/grey on colourful scenes, transitions at portals; gameplay from the intended route with height changes and long sections
Story: a golden-hour day: first light, sunrise on stepped terrain, the noon drop flown and run at double speed, a mauve dusk upside down, the night drop as a wave and a run under the stars, dawn and the signature
Target: {"label":"Normal","minWindowMs":60}
- variants sunrise: v0 kept (28) over v2 16 [WARN prejumps, WARN height, WARN length, WARN ending, WARN hazards matter, FAIL reactive, WARN difficulty, WARN pacing, WARN sync, FAIL skips, WARN route, WARN taste, WARN craft], v1 10 [WARN prejumps, WARN symmetry, WARN length, WARN mode changes, WARN ending, WARN orb buffer, WARN hazards matter, FAIL reactive, WARN difficulty, WARN pacing, WARN sync, FAIL skips, WARN route, WARN taste, WARN craft]
- variants night run: v2 kept (22) over v1 16 [WARN prejumps, WARN height, WARN length, WARN mode changes, WARN ending, FAIL reactive, WARN difficulty, WARN sync, WARN mode entry, FAIL skips, WARN route, WARN taste, WARN craft], v0 10 [WARN prejumps, WARN symmetry, WARN height, WARN length, WARN mode changes, WARN ending, WARN orb buffer, WARN hazards matter, FAIL reactive, WARN difficulty, WARN pacing, WARN sync, FAIL skips, WARN taste, WARN craft]

## Round 1: not ready (2 fail, 1 warn)
- PASS beatable: sunrise: 35 presses
- WARN prejumps: noon flight: block 9 (7.6 ahead of block 3 at 18) (approximate: level with modes)
- FAIL timing: sunrise: tightest 42 ms over 35 inputs, want >= 60 -- block 111 press 42 ms
- PASS recovery: sunrise: every press >= 100 ms after landing
- FAIL skips: night run: cube portal at block 71; cube portal at block 71 not touched by the solved run: block that way past it

Repairs:
- 2 more columns before stairs at 135 (42 ms window)
- 2 more columns before s:lantern-orb at 875 (prejump (2.2 blocks ahead))
- 2 more columns before single at 942 (prejump (2.2 blocks ahead))

## Round 2: not ready (2 fail, 1 warn)
- PASS beatable: sunrise: 35 presses
- WARN prejumps: noon flight: block 9 (7.6 ahead of block 3 at 18) (approximate: level with modes)
- FAIL timing: sunrise: tightest 38 ms over 35 inputs, want >= 60 -- block 113 press 38 ms
- PASS recovery: sunrise: every press >= 100 ms after landing
- FAIL skips: night run: cube portal at block 71; cube portal at block 71 not touched by the solved run: block that way past it

Repairs:
- section sunrise rebuilt from another plan (reseed 3): 2 rounds of patching did not fix it
- section night run rebuilt from another plan (reseed 5): 2 rounds of patching did not fix it

## Round 3: not ready (1 fail, 1 warn)
- PASS beatable: sunrise: 32 presses
- WARN prejumps: noon flight: block 9 (7.6 ahead of block 3 at 18) (approximate: level with modes)
- FAIL timing: sunrise: tightest 4 ms over 32 inputs, want >= 60 -- block 104 press 38 ms; block 264 press 4 ms
- PASS recovery: sunrise: every press >= 100 ms after landing
- PASS skips: sunrise: all 4 portals and 1 orbs on the path

Repairs:
- 2 more columns before stairs at 128 (38 ms window)
- 2 more columns before s:ceiling-hop at 277 (4 ms window)

## Round 4: not ready (1 fail, 1 warn)
- PASS beatable: sunrise: 32 presses
- WARN prejumps: noon flight: block 9 (7.6 ahead of block 3 at 18) (approximate: level with modes)
- FAIL timing: sunrise: tightest 42 ms over 32 inputs, want >= 60 -- block 106 press 42 ms
- PASS recovery: sunrise: every press >= 100 ms after landing
- PASS skips: sunrise: all 4 portals and 1 orbs on the path

Repairs:
- section sunrise rebuilt from another plan (reseed 6): 2 rounds of patching did not fix it

## Round 5: not ready (1 fail, 1 warn)
- PASS beatable: sunrise: 11 presses
- WARN prejumps: sunrise: block 71 (3.2 ahead of hazard 9 at 75); block 170 (7.5 ahead of spike at 179); block 252 (3.3 ahead of hazard 9 at 256) (approximate: level with modes)
- PASS timing: sunrise: tightest 100 ms over 56 inputs, want >= 60 (measured windows)
- PASS recovery: sunrise: every press >= 100 ms after landing
- FAIL skips: sunrise: cube portal at block 196 not touched by the solved run: block that way past it

Repairs:
- 2 more columns before s:slab-steps at 78 (prejump (3.2 blocks ahead))
- 2 more columns before s:ufo-tunnel at 196 (prejump (7.5 blocks ahead))
- 2 more columns before s:pillar-climb at 251 (prejump (3.3 blocks ahead))
- 2 more columns before s:lantern-orb at 875 (prejump (2.2 blocks ahead))
- 2 more columns before s:ball-pillars at 903 (prejump (1.9 blocks ahead))

## Round 6: not ready (1 fail, 1 warn)
- PASS beatable: sunrise: 11 presses
- WARN prejumps: sunrise: block 71 (3.2 ahead of hazard 9 at 75); block 170 (7.5 ahead of spike at 179); block 252 (3.3 ahead of hazard 9 at 256) (approximate: level with modes)
- PASS timing: sunrise: tightest 100 ms over 56 inputs, want >= 60 (measured windows)
- PASS recovery: sunrise: every press >= 100 ms after landing
- FAIL skips: sunrise: cube portal at block 196 not touched by the solved run: block that way past it

Repairs:
- section sunrise rebuilt from another plan (reseed 9): 2 rounds of patching did not fix it
- section night run rebuilt from another plan (reseed 8): 2 rounds of patching did not fix it

## Round 7: not ready (1 fail, 1 warn)
- PASS beatable: sunrise: 10 presses
- WARN prejumps: sunrise: block 13 (2.4 ahead of spike at 16) (approximate: level with modes)
- PASS timing: sunrise: tightest 100 ms over 61 inputs, want >= 60 (measured windows)
- PASS recovery: sunrise: every press >= 100 ms after landing
- FAIL skips: night run: cube portal at block 76; cube portal at block 76 not touched by the solved run: block that way past it

Repairs:
- 2 more columns before s:lantern-orb at 875 (prejump (2.2 blocks ahead))

## Round 8: not ready (1 fail, 1 warn)
- PASS beatable: sunrise: 10 presses
- WARN prejumps: sunrise: block 13 (2.4 ahead of spike at 16) (approximate: level with modes)
- PASS timing: sunrise: tightest 100 ms over 61 inputs, want >= 60 (measured windows)
- PASS recovery: sunrise: every press >= 100 ms after landing
- FAIL skips: night run: cube portal at block 76; cube portal at block 76 not touched by the solved run: block that way past it

Repairs:
- section night run rebuilt from another plan (reseed 11): 2 rounds of patching did not fix it

## Whole level (327 s to score): not ready
- PASS beatable: 44 presses
- WARN prejumps: noon flight: block 9 (7.6 ahead of block 3 at 18) (approximate: level with modes) -- from the sections
- FAIL timing: sunrise: tightest 4 ms over 32 inputs, want >= 60 -- from the sections
- PASS recovery: sunrise: every press >= 100 ms after landing -- from the sections
- WARN deco coverage: 3 stretch(es) under half the level's 13.0 deco per block -- blocks 16-32: 5.2/block; blocks 24-40: 5.8/block; blocks 536-552: 6.4/block
- PASS symmetry: orbs centred on their structures
- PASS jump marks: no jump marks
- PASS height: 12.5 changes per 10 s, range 6, 36% on the floor
- PASS repetition: 0% of 4-move patterns repeat within 10 s (want 5% or less)
- PASS length: 93 s (official 78-95 s; want 60+)
- PASS mode changes: 6 mode changes, 3.9 a minute (official 1.3-5.2; want 6 or fewer)
- PASS ending: 2.4 s from the last input to the end (official median 0.8 s; want 2.5 s or less)
- PASS orb buffer: every orb can be buffered
- WARN pointless jumps: 7 jump(s) over nothing -- block 199; block 284 (off a step); block 300 (off a step); block 304 (off a step); block 664 (off a step); block 700 (off a step); block 713 (off a step)
- WARN hazards matter: 7 hazard group(s) that need no action -- blocks 78-79: walked over without a jump (a gap above it is crossed on foot); blocks 167-167: walked over without a jump (a gap above it is crossed on foot); blocks 206-206: walked over without a jump (a gap above it is crossed on foot); blocks 231-233: walked over without a jump (a gap above it is crossed on foot); blocks 294-294: walked over without a jump (a gap above it is crossed on foot); blocks 334-334: walked over without a jump (a gap above it is crossed on foot); blocks 879-879: walked over without a jump (a gap above it is crossed on foot)
- FAIL reactive: 9 spot(s) that need exact hops -- block 73: the jump over a hazard must also be timed around a block: its window (208 ms) is cut by a block; block 80: the jump over a hazard must also be timed around a block: its window (208 ms) is cut by a block; block 87: the jump over a hazard must also be timed around a block: its window (208 ms) is cut by a block; block 198: the jump over a hazard must also be timed around a block: its window (58 ms) is split by a block; block 226: the jump over a hazard must also be timed around a block: its window (208 ms) is cut by a block; block 233: the jump over a hazard must also be timed around a block: its window (200 ms) is cut by a block; block 240: the jump over a hazard must also be timed around a block: its window (208 ms) is cut by a block; block 300: the jump over a hazard must also be timed around a block: its window (325 ms) is split by a block; block 879: the jump over a hazard must also be timed around a block: its window (58 ms) is cut by a block
- PASS player timing: tightest 79 ms over 122 inputs on the player's route, want >= 60
- PASS difficulty: Normal (0.57 = ~4 attempts), want Normal
- WARN pacing: start 38, end 21, longest busy 88, hazards first/last third 86/27 -- 88 blocks with no 6-block rest; last third calmer than the first (27 vs 86 hazards)
- PASS variety: 7 different chunks in 10, most common 20%
- PASS readability: decoration clear of hazards
- PASS colour: 109 colour triggers for 8 coloured sections
- WARN sync: 3/10 portals on a bar start, 8/44 presses centred on a beat -- portals off the bars: put mode/speed changes on bar starts
- PASS lead-in: 8 mode portals with a calm lead-in
- WARN mode entry: ball at block 903 sits at a raised block's end: the new mode can start on its corner
- PASS skips: all 16 portals and 4 orbs on the path
- PASS fairness: no unfair spots found
- WARN route: ship 355-477: 16 presses; wave 749-845: 10 presses, 560 cs within 12 of a wall; presses not needed 300-304: 2 presses
- WARN objects: 2 gameplay objects with unconfirmed hitboxes (ids 35)
- WARN taste: 60/100 (EN|2.2; distinctIds p0, moveTrigPerMin p30, hazPer10 p25) -- under featured levels on: 2.2 budget: objects per block (15.0306, want >= 17.043)
- WARN craft: 2/6 craft targets -- pieces100 5 (>= 12), floorHaz 5% (>= 0.15), attached 90% (>= 0.9), hazards100 16 (>= 45, <= 110)

## Kept: not ready, difficulty Normal (target Normal)
