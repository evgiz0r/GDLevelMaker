# GDLM 70 candy night
Idea: densest deco (51/block) at 56.0 s
Story: 0.05-5 s intro: speed 2x at 3.4 s; 5-8.62 s intro: speed 2x at 3.4 s; 8.62-13.7 s drop: zoom 1 at 10.9 s; 13.7-17.9 s drop: zoom 1 at 10.9 s; 17.9-24.9 s drop: zoom 1 at 10.9 s; 24.9-27.4 s drop: zoom 1 at 10.9 s; 27.4-32.62 s drop: zoom 1 at 10.9 s; 32.62-36.5 s calm: speed 3x at 41.1 s; 36.5-43.4 s calm: speed 3x at 41.1 s; 43.4-46.34 s calm: speed 3x at 41.1 s; 46.34-50 s drop: zoom 1.021 at 53.4 s; 50-53 s drop: zoom 1.021 at 53.4 s; 53-54.8 s drop: zoom 1.021 at 53.4 s; 54.8-58.3 s drop: zoom 1.021 at 53.4 s; 58.3-60.05 s drop: zoom 1.021 at 53.4 s; 60.05-70.25 s finale: densest deco (47/block) at 62 s
Target: {"label":"Normal","minWindowMs":60}
- variants intro 1: a purple place: v0 kept (0) over v1 0 [FAIL timing, WARN deco coverage, WARN contrast, FAIL channels, WARN length, FAIL reactive, FAIL player timing, WARN difficulty, WARN energy curve, WARN pacing, WARN taste, WARN craft], v2 0 [FAIL timing, WARN deco coverage, WARN contrast, FAIL channels, WARN length, WARN ending, FAIL reactive, FAIL player timing, WARN difficulty, WARN energy curve, WARN pacing, WARN taste, WARN craft] -- CLOSE: a taste call for the user
- variants finale 5: a purple place: v0 kept (0) over v1 0 [FAIL prejumps, FAIL timing, WARN contrast, FAIL channels, WARN height, WARN length, WARN mode changes, WARN ending, WARN dead air, FAIL player timing, WARN mode tier, WARN energy curve, WARN pacing, WARN sync, FAIL skips, WARN taste, WARN craft], v2 0 [FAIL prejumps, FAIL timing, WARN contrast, FAIL channels, WARN height, WARN length, WARN mode changes, WARN ending, FAIL reactive, FAIL player timing, WARN difficulty, WARN mode tier, WARN energy curve, WARN sync, FAIL skips, WARN taste, WARN craft] -- CLOSE: a taste call for the user

## Round 1: not ready (4 fail, 0 warn)
- PASS beatable: intro 1: a purple place: 5 presses
- FAIL prejumps: intro 1 (robot): a purple place: block 19 (3.0 ahead of block at 24)
- FAIL timing: intro 1: a purple place: tightest 45.83333333333333 ms over 5 inputs, want >= 60 (measured windows) -- block 17 tap 45.83333333333333 ms
- FAIL recovery: finale 5: a purple place: 1 press(es) right after landing (< 100 ms) -- block 80 79 ms
- FAIL skips: intro 1 (robot): a purple place: cube portal at block 38; cube portal at block 38 not touched by the solved run: block that way past it

Repairs:
- 2 more columns before triple at 18 (45.83333333333333 ms window)
- 2 more columns before s:robot-steps at 60 (prejump (3.0 blocks ahead))
- 2 more columns before s:robot-steps at 385 (prejump (3.5 blocks ahead))
- 2 more columns before s:robot-steps at 866 (prejump (3.5 blocks ahead))
- 2 more columns before s:robot-steps at 922 (prejump (8.5 blocks ahead))
- 2 more columns before s:robot-steps at 983 (prejump (8.2 blocks ahead))

## Round 2: not ready (4 fail, 0 warn)
- PASS beatable: intro 1: a purple place: 5 presses
- FAIL prejumps: intro 1 (robot): a purple place: block 19 (3.0 ahead of block at 24)
- FAIL timing: intro 1: a purple place: tightest 45.83333333333333 ms over 5 inputs, want >= 60 (measured windows) -- block 19 tap 45.83333333333333 ms
- FAIL recovery: finale 5: a purple place: 1 press(es) right after landing (< 100 ms) -- block 145 75 ms
- FAIL skips: intro 1 (robot): a purple place: cube portal at block 38; cube portal at block 38 not touched by the solved run: block that way past it

Repairs:
- section intro 1: a purple place rebuilt from another plan (reseed 3): 2 rounds of patching did not fix it
- section intro 1 (robot): a purple place rebuilt from another plan (reseed 3): 2 rounds of patching did not fix it
- section drop 2 (robot): a purple place rebuilt from another plan (reseed 3): 2 rounds of patching did not fix it
- section finale 5: a purple place rebuilt from another plan (reseed 3): 2 rounds of patching did not fix it

## Round 3: not ready (3 fail, 0 warn)
- PASS beatable: intro 1: a purple place: 5 presses
- FAIL prejumps: intro 1 (robot): a purple place: block 19 (3.0 ahead of block at 24)
- FAIL timing: intro 1: a purple place: tightest 45.83333333333333 ms over 5 inputs, want >= 60 (measured windows) -- block 18 tap 45.83333333333333 ms
- PASS recovery: intro 1: a purple place: every press >= 100 ms after landing
- FAIL skips: intro 1 (robot): a purple place: cube portal at block 38; cube portal at block 38 not touched by the solved run: block that way past it

Repairs:
- 2 more columns before triple at 19 (45.83333333333333 ms window)
- 2 more columns before s:robot-steps at 60 (prejump (3.0 blocks ahead))
- 2 more columns before s:robot-steps at 385 (prejump (3.5 blocks ahead))
- 2 more columns before s:robot-steps at 877 (prejump (4.5 blocks ahead))
- 2 more columns before s:robot-steps at 935 (prejump (3.6 blocks ahead))

## Round 4: not ready (3 fail, 0 warn)
- PASS beatable: intro 1: a purple place: 5 presses
- FAIL prejumps: intro 1 (robot): a purple place: block 19 (3.0 ahead of block at 24)
- FAIL timing: intro 1: a purple place: tightest 45.83333333333333 ms over 5 inputs, want >= 60 (measured windows) -- block 20 tap 45.83333333333333 ms
- PASS recovery: intro 1: a purple place: every press >= 100 ms after landing
- FAIL skips: intro 1 (robot): a purple place: cube portal at block 38; cube portal at block 38 not touched by the solved run: block that way past it

Repairs:
- section intro 1: a purple place rebuilt from another plan (reseed 6): 2 rounds of patching did not fix it
- section intro 1 (robot): a purple place rebuilt from another plan (reseed 6): 2 rounds of patching did not fix it
- section drop 2 (robot): a purple place rebuilt from another plan (reseed 6): 2 rounds of patching did not fix it
- section finale 5: a purple place rebuilt from another plan (reseed 6): 2 rounds of patching did not fix it

## Round 5: not ready (3 fail, 0 warn)
- PASS beatable: intro 1: a purple place: 5 presses
- FAIL prejumps: intro 1 (robot): a purple place: block 19 (3.0 ahead of block at 24)
- FAIL timing: intro 1: a purple place: tightest 45.83333333333333 ms over 5 inputs, want >= 60 (measured windows) -- block 17 tap 45.83333333333333 ms
- PASS recovery: intro 1: a purple place: every press >= 100 ms after landing
- FAIL skips: intro 1 (robot): a purple place: cube portal at block 38; cube portal at block 38 not touched by the solved run: block that way past it

Repairs:
- 2 more columns before triple at 18 (45.83333333333333 ms window)
- 2 more columns before s:robot-steps at 60 (prejump (3.0 blocks ahead))
- 2 more columns before s:robot-steps at 391 (prejump (3.5 blocks ahead))
- 2 more columns before s:robot-steps at 878 (prejump (4.4 blocks ahead))
- 2 more columns before s:robot-steps at 938 (prejump (8.1 blocks ahead))

## Round 6: not ready (3 fail, 0 warn)
- PASS beatable: intro 1: a purple place: 5 presses
- FAIL prejumps: intro 1 (robot): a purple place: block 19 (3.0 ahead of block at 24)
- FAIL timing: intro 1: a purple place: tightest 45.83333333333333 ms over 5 inputs, want >= 60 (measured windows) -- block 19 tap 45.83333333333333 ms
- PASS recovery: intro 1: a purple place: every press >= 100 ms after landing
- FAIL skips: intro 1 (robot): a purple place: cube portal at block 38; cube portal at block 38 not touched by the solved run: block that way past it

Repairs:
- section intro 1: a purple place rebuilt from another plan (reseed 9): 2 rounds of patching did not fix it
- section intro 1 (robot): a purple place rebuilt from another plan (reseed 9): 2 rounds of patching did not fix it
- section drop 2 (robot): a purple place rebuilt from another plan (reseed 9): 2 rounds of patching did not fix it
- section finale 5: a purple place rebuilt from another plan (reseed 9): 2 rounds of patching did not fix it

## Round 7: not ready (3 fail, 0 warn)
- PASS beatable: intro 1: a purple place: 5 presses
- FAIL prejumps: intro 1 (robot): a purple place: block 19 (3.0 ahead of block at 24)
- FAIL timing: intro 1: a purple place: tightest 45.83333333333333 ms over 5 inputs, want >= 60 (measured windows) -- block 17 tap 45.83333333333333 ms
- PASS recovery: intro 1: a purple place: every press >= 100 ms after landing
- FAIL skips: intro 1 (robot): a purple place: cube portal at block 38; cube portal at block 38 not touched by the solved run: block that way past it

Repairs:
- 2 more columns before triple at 18 (45.83333333333333 ms window)
- 2 more columns before s:robot-steps at 60 (prejump (3.0 blocks ahead))
- 2 more columns before s:robot-steps at 385 (prejump (3.5 blocks ahead))
- 2 more columns before single at 426 (prejump (2.3 blocks ahead))
- 2 more columns before s:robot-steps at 876 (prejump (4.5 blocks ahead))
- 2 more columns before s:robot-steps at 933 (prejump (3.7 blocks ahead))
- 2 more columns before s:robot-steps at 994 (prejump (6.7 blocks ahead))

## Round 8: not ready (3 fail, 0 warn)
- PASS beatable: intro 1: a purple place: 5 presses
- FAIL prejumps: intro 1 (robot): a purple place: block 19 (3.0 ahead of block at 24)
- FAIL timing: intro 1: a purple place: tightest 45.83333333333333 ms over 5 inputs, want >= 60 (measured windows) -- block 19 tap 45.83333333333333 ms
- PASS recovery: intro 1: a purple place: every press >= 100 ms after landing
- FAIL skips: intro 1 (robot): a purple place: cube portal at block 38; cube portal at block 38 not touched by the solved run: block that way past it

Repairs:
- section intro 1: a purple place rebuilt from another plan (reseed 12): 2 rounds of patching did not fix it
- section intro 1 (robot): a purple place rebuilt from another plan (reseed 12): 2 rounds of patching did not fix it
- section drop 2 (robot): a purple place rebuilt from another plan (reseed 12): 2 rounds of patching did not fix it
- section finale 5: a purple place rebuilt from another plan (reseed 12): 2 rounds of patching did not fix it

## Whole level (347 s to score): not ready
- PASS beatable: 88 presses
- FAIL prejumps: intro 1 (robot): a purple place: block 19 (3.0 ahead of block at 24) -- from the sections
- FAIL timing: intro 1: a purple place: tightest 45.83333333333333 ms over 5 inputs, want >= 60 (measured windows) -- from the sections
- PASS recovery: intro 1: a purple place: every press >= 100 ms after landing -- from the sections
- PASS deco coverage: every screen within reach of the level's 2.1 deco per block
- PASS symmetry: orbs centred on their structures
- PASS jump marks: no jump marks
- PASS contrast: 100/100 sections readable (official levels: median hazard/bg 3.5-21)
- FAIL channels: 0 deco on undefined channels: WHITE in the game
- WARN height: 8.5 floor changes per 10 s (want 12+; official 12-22); 82% of standing on the bare floor (want 45% or less)
- PASS repetition: 0% of 4-move patterns repeat within 10 s (want 5% or less)
- PASS length: 70 s (official 78-95 s; want 60+)
- WARN mode changes: 18 mode changes, 15.5 a minute (official 1.3-5.2; want 6 or fewer)
- PASS ending: 1.4 s from the last input to the end (official median 0.8 s; want 2.5 s or less)
- WARN dead air: 2 stretch(es) with nothing to do (input limit 2.0 s) -- no input 6.5-9.0 s; no input 30.7-33.0 s
- PASS orb buffer: every orb can be buffered
- WARN pointless jumps: 1 jump(s) over nothing -- block 378
- PASS hazards matter: every hazard is part of the play
- FAIL reactive: 6 spot(s) that need exact hops -- block 67: lands on a <1-block spot and must jump again within 250 ms; block 268: lands on a <1-block spot and must jump again within 250 ms; block 884: lands on a <1-block spot and must jump again within 250 ms; block 942: lands on a <1-block spot and must jump again within 250 ms; block 292: a spike then a step 7 blocks after it: the jump comes down right before the step (put the step right after the spike, or 9+ blocks away); block 670: a spike then a step 5 blocks after it: the jump comes down right before the step (put the step right after the spike, or 9+ blocks away)
- FAIL player timing: tightest 46 ms over 107 inputs on the player's route, want >= 60 -- block 18.3 (1.76 s) press 46 ms; block 882.6 (61.63 s) release 58 ms
- WARN difficulty: Hard (1.46 = ~29 attempts), want Normal
- PASS one ending: 0 end text(s), 1 signature(s)
- PASS stale stretch: 10.3 s with no mode / speed / gravity change from block 463 (want 35 s or less for Normal)
- WARN mode tier: speed:2x (Insane), mode:robot (Harder), speed:3x (Insane), mode:ufo (Harder), mode:ball (Harder) in a Normal level -- official levels bring these in at higher ratings: keep them for harder levels, or accept with a reason
- WARN climbs: 4 climb(s), 2 hard to read -- blocks 295-307: tight: 63 ms windows | blocks 569-583: short: 1 landing(s) under 0.3 s on the ground (2 blocks at 387 u/s)
- WARN energy curve: real vs intended energy: rho -0.1 over 5 beats, 0 off by > 0.3; worst intro 1 (intro) want 0.61 got 0.31 -- the level does not follow its intended energy: densify the beats that run low, calm the ones that run high (tools/energy.js <level> --sheet ...)
- WARN pacing: start 10, end 16, longest busy 48, hazards first/last third 37/35 -- last third calmer than the first (35 vs 37 hazards)
- PASS variety: 10 different chunks in 55, most common 24%
- PASS readability: decoration clear of hazards
- PASS colour: 110 colour triggers for 16 coloured sections
- WARN sync: 13/34 portals on a bar start, 9/88 presses centred on a beat -- portals off the bars: put mode/speed changes on bar starts
- PASS lead-in: 30 mode portals with a calm lead-in
- PASS mode entry: mode portals over open space
- FAIL skips: cube portal at block 83; cube portal at block 83; cube portal at block 356; cube portal at block 356; cube portal at block 408; cube portal at block 408; cube portal at block 636; cube portal at block 636; cube portal at block 900; cube portal at block 900; cube portal at block 958; cube portal at block 958 not touched by the solved run: block that way past it
- FAIL fairness: switch at block 166: cube -> cube: the tap after it has a 146 ms window that closes 200 ms after the portal; switch at block 461: cube -> cube: the tap after it has a 196 ms window that closes 225 ms after the portal; switch at block 594: cube -> cube: the tap after it has a 208 ms window that closes 167 ms after the portal
- WARN route: ship 170-221: 7 presses; ufo 331-355: 3 presses, 32 cs within 12 of a wall; ufo 611-635: 2 presses, 20 cs within 12 of a wall; ship 701-755: 6 presses, 5 cs within 12 of a wall
- PASS objects: all hitboxes confirmed
- WARN taste: 56/100 (EN|2.2; dsChannels p0, distinctIds p0, dsMotion p20) -- under featured levels on: 2.2 budget: objects per block (4.5313, want >= 17.043)
- WARN craft: 2/7 craft targets -- pieces100 4 (>= 12), floorHaz 13% (>= 0.35), pillarDelta 67% (>= 0.7), backDeco 68% (<= 0.2), hazards100 15 (>= 45, <= 110)

## Kept: not ready, difficulty Hard (target Normal)
