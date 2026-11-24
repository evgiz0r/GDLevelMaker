# GDLM 64 golden hour
Idea: the user's 'rung 5' of the beauty ladder: the look of Fall Out (knowledge/levels/modern_look.md Worked example 1, ideas only): a new scene per section changed at the portals together with the mode, one motif (drifting light motes) through every scene, frames (cloud bands, light rays, a vignette near the end), bold see-through front layers (~30-40% of deco), HSV on ~half, hazards white/grey on colourful scenes, transitions at portals; gameplay from the intended route with height changes and long sections
Story: a golden-hour day: first light, sunrise on stepped terrain, the noon drop flown and run at double speed, a mauve dusk upside down, the night drop as a wave and a run under the stars, dawn and the signature
Target: {"label":"Hard","minWindowMs":60}
- variants sunrise: v0 kept (88) over v1 88 [WARN length, WARN ending, WARN hazards matter, WARN reactive, FAIL difficulty, WARN pacing, WARN craft], v2 88 [WARN length, WARN ending, WARN hazards matter, WARN reactive, FAIL difficulty, WARN pacing, WARN craft] -- CLOSE: a taste call for the user
- variants dawn: v0 kept (100) over v1 100 [WARN length, WARN ending, FAIL difficulty, WARN pacing, WARN craft], v2 100 [WARN length, WARN ending, FAIL difficulty, WARN pacing, WARN craft] -- CLOSE: a taste call for the user

## Round 1: not ready (2 fail, 0 warn)
- PASS beatable: sunrise: 36 presses
- FAIL prejumps: night run: block 90 (2.7 ahead of block 2 at 94)
- FAIL timing: night run: tightest 29.166666666666668 ms over 11 inputs, want >= 60 (measured windows) -- block 92 tap 29.166666666666668 ms
- PASS recovery: sunrise: every press >= 100 ms after landing
- PASS skips: sunrise: all 0 portals and 0 orbs on the path

Repairs:
- 2 more columns before s:red-orb-wall at 943 (prejump (2.7 blocks ahead))

## Round 2: READY (0 fail, 0 warn)
- PASS beatable: sunrise: 36 presses
- PASS prejumps: sunrise: none
- PASS timing: sunrise: tightest 112.5 ms over 36 inputs, want >= 60 (measured windows)
- PASS recovery: sunrise: every press >= 100 ms after landing
- PASS skips: sunrise: all 0 portals and 0 orbs on the path

## Whole level (266 s to score): READY
- PASS beatable: 133 presses
- PASS prejumps: sunrise: none -- from the sections
- PASS timing: sunrise: tightest 112.5 ms over 36 inputs, want >= 60 (measured windows) -- from the sections
- PASS recovery: sunrise: every press >= 100 ms after landing -- from the sections
- WARN deco coverage: 3 stretch(es) under half the level's 25.1 deco per block -- blocks 536-552: 12.3/block; blocks 592-608: 11.1/block; blocks 600-616: 9.4/block
- WARN symmetry: 2 orb(s) off the centre of their spike row -- orb at block 504 over spikes 503-507 (centre 505.0); orb at block 603 over spikes 602-606 (centre 604.0)
- PASS jump marks: no jump marks
- PASS contrast: 92/100 sections readable (official levels: median hazard/bg 3.5-21) -- ~8.7 s: 81 deco over hazards; ~9.6 s: 71 deco over hazards; ~11.6 s: 48 deco over hazards; ~13.5 s: 59 deco over hazards
- WARN height: 10.7 floor changes per 10 s (want 12+; official 12-22)
- PASS repetition: 2% of 4-move patterns repeat within 10 s (want 5% or less)
- PASS length: 98 s (official 78-95 s; want 60+)
- PASS mode changes: 4 mode changes, 2.4 a minute (official 1.3-5.2; want 6 or fewer)
- PASS ending: 1.7 s from the last input to the end (official median 0.8 s; want 2.5 s or less)
- PASS orb buffer: every orb can be buffered
- PASS pointless jumps: no jumps over nothing
- WARN hazards matter: 7 hazard group(s) that need no action -- blocks 108-108: walked over without a jump (a gap above it is crossed on foot); blocks 146-147: walked over without a jump (a gap above it is crossed on foot); blocks 235-236: walked over without a jump (a gap above it is crossed on foot); blocks 298-299: walked over without a jump (a gap above it is crossed on foot); blocks 479-479: walked over without a jump (a gap above it is crossed on foot); blocks 492-493: walked over without a jump (a gap above it is crossed on foot); blocks 895-895: walked over without a jump (a gap above it is crossed on foot)
- WARN reactive: 7 spot(s) that need exact hops -- block 48: the jump over a hazard must also be timed around a block: its window (108 ms) is cut by a block; block 322: the jump over a hazard must also be timed around a block: its window (108 ms) is cut by a block; block 719: the jump over a hazard must also be timed around a block: its window (108 ms) is cut by a block; block 50: a spike then a step 3 blocks after it: the jump comes down right before the step (put the step right after the spike, or 6+ blocks away); block 181: a spike then a step 3 blocks after it: the jump comes down right before the step (put the step right after the spike, or 6+ blocks away); block 324: a spike then a step 3 blocks after it: the jump comes down right before the step (put the step right after the spike, or 6+ blocks away); block 947: a spike then a step 3 blocks after it: the jump comes down right before the step (put the step right after the spike, or 6+ blocks away)
- PASS player timing: tightest 96 ms over 162 inputs on the player's route, want >= 60
- PASS difficulty: Hard (1.28 = ~19 attempts), want Hard
- WARN pacing: start 38, end 15, longest busy 100, hazards first/last third 51/30 -- 100 blocks with no 6-block rest; last third calmer than the first (30 vs 51 hazards)
- PASS variety: 10 different chunks in 16, most common 19%
- PASS readability: decoration clear of hazards
- PASS colour: 160 colour triggers for 8 coloured sections
- PASS sync: 3/6 portals on a bar start, 22/133 presses centred on a beat
- PASS mode entry: mode portals over open space
- PASS skips: all 8 portals and 4 orbs on the path
- PASS fairness: no unfair spots found
- WARN route: ship 355-479: 39 presses, 20 cs within 12 of a wall; wave 749-865: 13 presses, 678 cs within 12 of a wall
- WARN objects: 4 gameplay objects with unconfirmed hitboxes (ids 141, 35)
- PASS taste: 71/100 (EN|2.2; distinctIds p0, hazPer10 p15, dsGlow p15)
- WARN craft: 2/7 craft targets -- pieces100 4 (>= 12), floorHaz 5% (>= 0.35), attached 87% (>= 0.9), backDeco 26% (<= 0.2), hazards100 14 (>= 45, <= 180)

## Kept: READY, difficulty Hard (target Hard)
