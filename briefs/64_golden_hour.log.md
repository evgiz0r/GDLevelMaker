# GDLM 64 golden hour
Idea: the user's 'rung 5' of the beauty ladder: the look of Fall Out (knowledge/levels/modern_look.md Worked example 1, ideas only): a new scene per section changed at the portals together with the mode, one motif (drifting light motes) through every scene, frames (cloud bands, light rays, a vignette near the end), bold see-through front layers (~30-40% of deco), HSV on ~half, hazards white/grey on colourful scenes, transitions at portals; gameplay from the intended route with height changes and long sections
Story: a golden-hour day: first light, sunrise on stepped terrain, the noon drop flown and run at double speed, a mauve dusk upside down, the night drop as a wave and a run under the stars, dawn and the signature
Target: {"label":"Hard","minWindowMs":60}
- variants sunrise: v0 kept (82) over v1 52 [FAIL prejumps, WARN contrast, WARN length, WARN ending, WARN hazards matter, WARN reactive, FAIL difficulty, WARN craft], v2 22 [FAIL timing, WARN contrast, WARN length, WARN ending, WARN hazards matter, WARN reactive, FAIL player timing, FAIL difficulty, WARN pacing, WARN craft]
- variants dawn: v0 kept (100) over v1 100 [WARN length, WARN ending, FAIL difficulty, WARN pacing, WARN craft], v2 100 [WARN length, WARN ending, FAIL difficulty, WARN pacing, WARN craft] -- CLOSE: a taste call for the user

## Round 1: not ready (2 fail, 0 warn)
- PASS beatable: sunrise: 39 presses
- FAIL prejumps: night run: block 90 (2.7 ahead of block 2 at 94)
- FAIL timing: night run: tightest 29.166666666666668 ms over 13 inputs, want >= 60 (measured windows) -- block 92 tap 29.166666666666668 ms
- PASS recovery: sunrise: every press >= 100 ms after landing
- PASS skips: sunrise: all 0 portals and 1 orbs on the path

Repairs:
- 2 more columns before s:red-orb-wall at 943 (prejump (2.7 blocks ahead))

## Round 2: READY (0 fail, 0 warn)
- PASS beatable: sunrise: 39 presses
- PASS prejumps: sunrise: none
- PASS timing: sunrise: tightest 112.5 ms over 39 inputs, want >= 60 (measured windows)
- PASS recovery: sunrise: every press >= 100 ms after landing
- PASS skips: sunrise: all 0 portals and 1 orbs on the path

## Whole level (259 s to score): READY
- PASS beatable: 114 presses
- PASS prejumps: sunrise: none -- from the sections
- PASS timing: sunrise: tightest 112.5 ms over 39 inputs, want >= 60 (measured windows) -- from the sections
- PASS recovery: sunrise: every press >= 100 ms after landing -- from the sections
- PASS deco coverage: every screen within reach of the level's 26.5 deco per block
- WARN symmetry: 2 orb(s) off the centre of their spike row -- orb at block 504 over spikes 503-507 (centre 505.0); orb at block 603 over spikes 602-606 (centre 604.0)
- PASS jump marks: no jump marks
- PASS contrast: 89/100 sections readable (official levels: median hazard/bg 3.5-21) -- ~8.7 s: 81 deco over hazards; ~9.6 s: 77 deco over hazards; ~11.6 s: 49 deco over hazards; ~13.5 s: 59 deco over hazards
- WARN height: 11.2 floor changes per 10 s (want 12+; official 12-22)
- PASS repetition: 0% of 4-move patterns repeat within 10 s (want 5% or less)
- PASS length: 98 s (official 78-95 s; want 60+)
- PASS mode changes: 4 mode changes, 2.4 a minute (official 1.3-5.2; want 6 or fewer)
- PASS ending: 1.7 s from the last input to the end (official median 0.8 s; want 2.5 s or less)
- PASS orb buffer: every orb can be buffered
- PASS pointless jumps: no jumps over nothing
- WARN hazards matter: 7 hazard group(s) that need no action -- blocks 108-108: walked over without a jump (a gap above it is crossed on foot); blocks 146-147: walked over without a jump (a gap above it is crossed on foot); blocks 164-164: walked over without a jump (a gap above it is crossed on foot); blocks 234-236: walked over without a jump (a gap above it is crossed on foot); blocks 316-317: walked over without a jump (a gap above it is crossed on foot); blocks 492-493: walked over without a jump (a gap above it is crossed on foot); blocks 895-895: walked over without a jump (a gap above it is crossed on foot)
- WARN reactive: 15 spot(s) that need exact hops -- block 48: the jump over a hazard must also be timed around a block: its window (108 ms) is cut by a block; block 164: the jump over a hazard must also be timed around a block: its window (67 ms) is cut by a block; block 184: the jump over a hazard must also be timed around a block: its window (142 ms) is cut by a block; block 189: the jump over a hazard must also be timed around a block: its window (208 ms) is cut by a block; block 194: the jump over a hazard must also be timed around a block: its window (208 ms) is cut by a block; block 229: the jump over a hazard must also be timed around a block: its window (208 ms) is cut by a block; block 236: the jump over a hazard must also be timed around a block: its window (208 ms) is cut by a block; block 243: the jump over a hazard must also be timed around a block: its window (200 ms) is cut by a block; block 328: the jump over a hazard must also be timed around a block: its window (133 ms) is cut by a block; block 333: the jump over a hazard must also be timed around a block: its window (208 ms) is cut by a block; block 338: the jump over a hazard must also be timed around a block: its window (208 ms) is cut by a block; block 719: the jump over a hazard must also be timed around a block: its window (108 ms) is cut by a block; block 979: the jump over a hazard must also be timed around a block: its window (58 ms) is cut by a block; block 50: a spike then a step 3 blocks after it: the jump comes down right before the step (put the step right after the spike, or 6+ blocks away); block 947: a spike then a step 3 blocks after it: the jump comes down right before the step (put the step right after the spike, or 6+ blocks away)
- PASS player timing: tightest 96 ms over 145 inputs on the player's route, want >= 60
- PASS difficulty: Hard (1.28 = ~19 attempts), want Hard
- WARN pacing: start 38, end 15, longest busy 100, hazards first/last third 93/35 -- 100 blocks with no 6-block rest; last third calmer than the first (35 vs 93 hazards)
- PASS variety: 10 different chunks in 15, most common 13%
- PASS readability: decoration clear of hazards
- PASS colour: 160 colour triggers for 8 coloured sections
- PASS sync: 3/6 portals on a bar start, 18/114 presses centred on a beat
- PASS mode entry: mode portals over open space
- PASS skips: all 8 portals and 6 orbs on the path
- PASS fairness: no unfair spots found
- WARN route: ship 355-479: 18 presses, 0 cs within 12 of a wall; wave 749-865: 13 presses, 678 cs within 12 of a wall
- WARN objects: 4 gameplay objects with unconfirmed hitboxes (ids 141, 35)
- PASS taste: 75/100 (EN|2.2; distinctIds p0, dsGlow p100, hazPer10 p25)
- WARN craft: 3/7 craft targets -- pieces100 5 (>= 12), floorHaz 7% (>= 0.35), backDeco 24% (<= 0.2), hazards100 18 (>= 45, <= 180)

## Kept: READY, difficulty Hard (target Hard)
