# GDLM 64 golden hour v5
Idea: the user's 'rung 5' of the beauty ladder: the look of Fall Out (knowledge/levels/modern_look.md Worked example 1, ideas only): a new scene per section changed at the portals together with the mode, one motif (drifting light motes) through every scene, frames (cloud bands, light rays, a vignette near the end), bold see-through front layers (~30-40% of deco), HSV on ~half, hazards white/grey on colourful scenes, transitions at portals; gameplay from the intended route with height changes and long sections
Story: a golden-hour day: first light, sunrise on stepped terrain, the noon drop flown and run at double speed, a mauve dusk upside down, the night drop as a wave and a run under the stars, dawn and the signature
Target: {"label":"Hard","minWindowMs":60}
- variants sunrise: v0 kept (76) over v1 70 [WARN symmetry, WARN length, WARN ending, WARN orb buffer, WARN hazards matter, WARN reactive, FAIL difficulty, WARN pacing, WARN objects, WARN craft], v2 70 [WARN symmetry, WARN height, WARN length, WARN ending, WARN hazards matter, WARN reactive, FAIL difficulty, WARN pacing, WARN objects, WARN craft]
- variants dawn: v0 kept (100) over v1 100 [WARN length, WARN ending, FAIL difficulty, WARN pacing, WARN craft], v2 100 [WARN length, WARN ending, FAIL difficulty, WARN pacing, WARN craft] -- CLOSE: a taste call for the user

## Round 1: READY (0 fail, 0 warn)
- PASS beatable: sunrise: 38 presses
- PASS prejumps: sunrise: none
- PASS timing: sunrise: tightest 112.5 ms over 38 inputs, want >= 60 (measured windows)
- PASS recovery: sunrise: every press >= 100 ms after landing
- PASS skips: sunrise: all 0 portals and 2 orbs on the path

## Whole level (280 s to score): READY
- PASS beatable: 131 presses
- PASS prejumps: sunrise: none -- from the sections
- PASS timing: sunrise: tightest 112.5 ms over 38 inputs, want >= 60 (measured windows) -- from the sections
- PASS recovery: sunrise: every press >= 100 ms after landing -- from the sections
- PASS deco coverage: every screen within reach of the level's 24.8 deco per block
- WARN symmetry: 6 orb(s) off the centre of their spike row -- orb at block 151 over spikes 150-154 (centre 152.0); orb at block 255 over spikes 254-258 (centre 256.0); orb at block 521 over spikes 520-524 (centre 522.0); orb at block 613 over spikes 612-616 (centre 614.0); orb at block 901 over spikes 900-909 (centre 904.5); orb at block 978 over spikes 977-986 (centre 981.5)
- PASS jump marks: no jump marks
- PASS contrast: 95/100 sections readable (official levels: median hazard/bg 3.5-21) -- ~7.7 s: 47 deco over hazards; ~9.6 s: 67 deco over hazards; ~27.9 s: 70 deco over hazards; ~28.9 s: 44 deco over hazards
- WARN height: 10.9 floor changes per 10 s (want 12+; official 12-22); 7% of 10 s windows flat; 47% of standing on the bare floor (want 45% or less)
- PASS repetition: 0% of 4-move patterns repeat within 10 s (want 5% or less)
- PASS length: 98 s (official 78-95 s; want 60+)
- PASS mode changes: 4 mode changes, 2.4 a minute (official 1.3-5.2; want 6 or fewer)
- PASS ending: 1.7 s from the last input to the end (official median 0.8 s; want 2.5 s or less)
- WARN orb buffer: 2 orb(s) that only a precise click takes -- block 151; block 255
- PASS pointless jumps: no jumps over nothing
- WARN hazards matter: 10 hazard group(s) that need no action -- blocks 102-103: walked over without a jump (a gap above it is crossed on foot); blocks 106-106: walked over without a jump (a gap above it is crossed on foot); blocks 135-136: walked over without a jump (a gap above it is crossed on foot); blocks 309-310: walked over without a jump (a gap above it is crossed on foot); blocks 905-909: walked over without a jump (a gap above it is crossed on foot); blocks 924-924: walked over without a jump (a gap above it is crossed on foot); blocks 982-986: walked over without a jump (a gap above it is crossed on foot); blocks 1012-1013: walked over without a jump (a gap above it is crossed on foot); blocks 1017-1017: walked over without a jump (a gap above it is crossed on foot); blocks 1023-1023: walked over without a jump (a gap above it is crossed on foot)
- WARN reactive: 5 spot(s) that need exact hops -- block 48: the jump over a hazard must also be timed around a block: its window (108 ms) is cut by a block; block 593: the jump over a hazard must also be timed around a block: its window (92 ms) is split by a block; block 719: the jump over a hazard must also be timed around a block: its window (108 ms) is cut by a block; block 223: lands on a <1-block spot and must jump again within 250 ms; block 50: a spike then a step 3 blocks after it: the jump comes down right before the step (put the step right after the spike, or 6+ blocks away)
- PASS player timing: tightest 92 ms over 160 inputs on the player's route, want >= 60
- PASS difficulty: Hard (0.84 = ~7 attempts), want Hard
- WARN pacing: start 38, end 15, longest busy 100, hazards first/last third 49/38 -- 100 blocks with no 6-block rest; last third calmer than the first (38 vs 49 hazards)
- PASS variety: 9 different chunks in 20, most common 20%
- PASS readability: decoration clear of hazards
- PASS colour: 160 colour triggers for 8 coloured sections
- PASS sync: 3/6 portals on a bar start, 20/131 presses centred on a beat
- PASS mode entry: mode portals over open space
- PASS skips: all 8 portals and 7 orbs on the path
- PASS fairness: no unfair spots found
- WARN route: ship 355-479: 39 presses, 25 cs within 12 of a wall; wave 749-865: 11 presses, 717 cs within 12 of a wall
- WARN objects: 8 gameplay objects with unconfirmed hitboxes (ids 141, 35, 140)
- PASS taste: 72/100 (EN|2.2; distinctIds p0, hazPer10 p15, dsChannels p80)
- WARN craft: 3/7 craft targets -- pieces100 4 (>= 12), floorHaz 8% (>= 0.35), backDeco 28% (<= 0.2), hazards100 14 (>= 45, <= 180)

## Kept: READY, difficulty Hard (target Hard)
