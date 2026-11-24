# GDLM 64 golden hour
Idea: the user's 'rung 5' of the beauty ladder: the look of Fall Out (knowledge/levels/modern_look.md Worked example 1, ideas only): a new scene per section changed at the portals together with the mode, one motif (drifting light motes) through every scene, frames (cloud bands, light rays, a vignette near the end), bold see-through front layers (~30-40% of deco), HSV on ~half, hazards white/grey on colourful scenes, transitions at portals; gameplay from the intended route with height changes and long sections
Story: a golden-hour day: first light, sunrise on stepped terrain, the noon drop flown and run at double speed, a mauve dusk upside down, the night drop as a wave and a run under the stars, dawn and the signature
Target: {"label":"Hard","minWindowMs":60}
- variants sunrise: v2 kept (46) over v0 40 [FAIL prejumps, WARN symmetry, WARN height, WARN length, WARN ending, WARN orb buffer, WARN hazards matter, WARN reactive, FAIL difficulty, WARN craft], v1 34 [FAIL prejumps, WARN symmetry, WARN contrast, WARN height, WARN length, WARN ending, WARN orb buffer, WARN hazards matter, WARN reactive, FAIL difficulty, WARN craft]
- variants dawn: v0 kept (100) over v1 100 [WARN length, WARN ending, FAIL difficulty, WARN pacing, WARN craft], v2 100 [WARN length, WARN ending, FAIL difficulty, WARN pacing, WARN craft] -- CLOSE: a taste call for the user

## Round 1: not ready (2 fail, 0 warn)
- PASS beatable: sunrise: 14 presses
- FAIL prejumps: sunrise: block 32 (4.9 ahead of spike at 38); block 136 (18.5 ahead of spike at 156); block 276 (14.3 ahead of spike at 291)
- FAIL timing: night run: tightest 29.166666666666668 ms over 10 inputs, want >= 60 (measured windows) -- block 92 press 29.166666666666668 ms
- PASS recovery: sunrise: every press >= 100 ms after landing
- PASS skips: sunrise: all 0 portals and 8 orbs on the path

Repairs:
- 2 more columns before double at 60 (prejump (4.9 blocks ahead))
- 2 more columns before s:block-hops at 178 (prejump (18.5 blocks ahead))
- 2 more columns before spike-block at 313 (prejump (14.3 blocks ahead))
- 2 more columns before s:red-orb-wall at 943 (prejump (2.7 blocks ahead))

## Round 2: not ready (1 fail, 0 warn)
- PASS beatable: sunrise: 14 presses
- FAIL prejumps: sunrise: block 32 (4.9 ahead of spike at 38); block 136 (18.5 ahead of spike at 156); block 278 (14.2 ahead of spike at 293)
- PASS timing: sunrise: tightest 204.16666666666666 ms over 23 inputs, want >= 60 (measured windows)
- PASS recovery: sunrise: every press >= 100 ms after landing
- PASS skips: sunrise: all 0 portals and 8 orbs on the path

Repairs:
- section sunrise rebuilt from another plan (reseed 5): 2 rounds of patching did not fix it

## Round 3: not ready (1 fail, 0 warn)
- PASS beatable: sunrise: 15 presses
- FAIL prejumps: sunrise: block 37 (4.9 ahead of spike at 43); block 142 (18.3 ahead of spike at 161)
- PASS timing: sunrise: tightest 204.16666666666666 ms over 25 inputs, want >= 60 (measured windows)
- PASS recovery: sunrise: every press >= 100 ms after landing
- PASS skips: sunrise: all 0 portals and 7 orbs on the path

Repairs:
- 2 more columns before double at 65 (prejump (4.9 blocks ahead))
- 2 more columns before s:block-hops at 183 (prejump (18.3 blocks ahead))

## Round 4: not ready (1 fail, 0 warn)
- PASS beatable: sunrise: 15 presses
- FAIL prejumps: sunrise: block 37 (4.9 ahead of spike at 43); block 142 (18.3 ahead of spike at 161)
- PASS timing: sunrise: tightest 204.16666666666666 ms over 25 inputs, want >= 60 (measured windows)
- PASS recovery: sunrise: every press >= 100 ms after landing
- PASS skips: sunrise: all 0 portals and 7 orbs on the path

Repairs:
- section sunrise rebuilt from another plan (reseed 8): 2 rounds of patching did not fix it

## Round 5: not ready (1 fail, 0 warn)
- PASS beatable: sunrise: 11 presses
- FAIL prejumps: sunrise: block 145 (18.2 ahead of spike at 164)
- PASS timing: sunrise: tightest 204.16666666666666 ms over 19 inputs, want >= 60 (measured windows)
- PASS recovery: sunrise: every press >= 100 ms after landing
- PASS skips: sunrise: all 0 portals and 4 orbs on the path

Repairs:
- 2 more columns before s:block-hops at 186 (prejump (18.2 blocks ahead))

## Round 6: not ready (1 fail, 0 warn)
- PASS beatable: sunrise: 11 presses
- FAIL prejumps: sunrise: block 146 (18.5 ahead of spike at 166)
- PASS timing: sunrise: tightest 204.16666666666666 ms over 19 inputs, want >= 60 (measured windows)
- PASS recovery: sunrise: every press >= 100 ms after landing
- PASS skips: sunrise: all 0 portals and 4 orbs on the path

Repairs:
- section sunrise rebuilt from another plan (reseed 11): 2 rounds of patching did not fix it

## Round 7: not ready (1 fail, 0 warn)
- PASS beatable: sunrise: 10 presses
- FAIL prejumps: sunrise: block 146 (18.5 ahead of spike at 166)
- PASS timing: sunrise: tightest 141.66666666666666 ms over 18 inputs, want >= 60 (measured windows)
- PASS recovery: sunrise: every press >= 100 ms after landing
- PASS skips: sunrise: all 0 portals and 4 orbs on the path

Repairs:
- 2 more columns before s:block-hops at 188 (prejump (18.5 blocks ahead))

## Round 8: not ready (1 fail, 0 warn)
- PASS beatable: sunrise: 10 presses
- FAIL prejumps: sunrise: block 146 (18.5 ahead of spike at 166)
- PASS timing: sunrise: tightest 141.66666666666666 ms over 18 inputs, want >= 60 (measured windows)
- PASS recovery: sunrise: every press >= 100 ms after landing
- PASS skips: sunrise: all 0 portals and 4 orbs on the path

Repairs:
- section sunrise rebuilt from another plan (reseed 14): 2 rounds of patching did not fix it

## Whole level (176 s to score): not ready
- PASS beatable: 55 presses
- FAIL prejumps: sunrise: block 32 (4.9 ahead of spike at 38); block 136 (18.5 ahead of spike at 156); block 278 (14.2 ahead of spike at 293) -- from the sections
- PASS timing: sunrise: tightest 204.16666666666666 ms over 23 inputs, want >= 60 (measured windows) -- from the sections
- PASS recovery: sunrise: every press >= 100 ms after landing -- from the sections
- PASS deco coverage: every screen within reach of the level's 25.6 deco per block
- WARN symmetry: 4 orb(s) off the centre of their spike row -- 3 orbs (a group) at block 211 over spikes 210-222 (centre 216.0); 3 orbs (a group) at block 324 over spikes 323-335 (centre 329.0); orb at block 504 over spikes 503-507 (centre 505.0); orb at block 603 over spikes 602-606 (centre 604.0)
- PASS jump marks: no jump marks
- PASS contrast: 91/100 sections readable (official levels: median hazard/bg 3.5-21) -- ~7.7 s: 58 deco over hazards; ~8.7 s: 45 deco over hazards; ~9.6 s: 49 deco over hazards; ~10.6 s: 52 deco over hazards
- WARN height: 9.6 floor changes per 10 s (want 12+; official 12-22); 50% of standing on the bare floor (want 45% or less)
- PASS repetition: 0% of 4-move patterns repeat within 10 s (want 5% or less)
- PASS length: 98 s (official 78-95 s; want 60+)
- PASS mode changes: 4 mode changes, 2.4 a minute (official 1.3-5.2; want 6 or fewer)
- WARN ending: 6.1 s from the last input to the end (official median 0.8 s; want 2.5 s or less)
- WARN orb buffer: 4 orb(s) that only a precise click takes -- block 329; block 333; block 605; block 947
- PASS pointless jumps: no jumps over nothing
- WARN hazards matter: 34 hazard group(s) that need no action -- blocks 45-45: walked over without a jump (a gap above it is crossed on foot); blocks 60-61: walked over without a jump (a gap above it is crossed on foot); blocks 76-76: walked over without a jump (a gap above it is crossed on foot); blocks 88-88: walked over without a jump (a gap above it is crossed on foot); blocks 93-93: walked over without a jump (a gap above it is crossed on foot); blocks 101-102: walked over without a jump (a gap above it is crossed on foot); blocks 178-180: walked over without a jump (a gap above it is crossed on foot); blocks 210-211: walked over without a jump (a gap above it is crossed on foot); blocks 227-227: walked over without a jump (a gap above it is crossed on foot); blocks 238-238: walked over without a jump (a gap above it is crossed on foot); blocks 243-243: walked over without a jump (a gap above it is crossed on foot); blocks 295-295: walked over without a jump (a gap above it is crossed on foot); blocks 315-315: walked over without a jump (a gap above it is crossed on foot); blocks 323-324: walked over without a jump (a gap above it is crossed on foot); blocks 503-504: walked over without a jump (a gap above it is crossed on foot); blocks 536-537: walked over without a jump (a gap above it is crossed on foot); blocks 542-543: walked over without a jump (a gap above it is crossed on foot); blocks 557-557: walked over without a jump (a gap above it is crossed on foot); blocks 590-591: walked over without a jump (a gap above it is crossed on foot); blocks 602-603: walked over without a jump (a gap above it is crossed on foot); blocks 616-616: walked over without a jump (a gap above it is crossed on foot); blocks 645-645: walked over without a jump (a gap above it is crossed on foot); blocks 666-666: walked over without a jump (a gap above it is crossed on foot); blocks 672-673: walked over without a jump (a gap above it is crossed on foot); blocks 683-683: walked over without a jump (a gap above it is crossed on foot); blocks 696-696: walked over without a jump (a gap above it is crossed on foot); blocks 708-709: walked over without a jump (a gap above it is crossed on foot); blocks 721-721: walked over without a jump (a gap above it is crossed on foot); blocks 901-902: walked over without a jump (a gap above it is crossed on foot); blocks 965-965: walked over without a jump (a gap above it is crossed on foot); blocks 1012-1013: walked over without a jump (a gap above it is crossed on foot); blocks 1017-1017: walked over without a jump (a gap above it is crossed on foot); blocks 1023-1023: walked over without a jump (a gap above it is crossed on foot); blocks 1029-1030: walked over without a jump (a gap above it is crossed on foot)
- WARN reactive: 6 spot(s) that need exact hops -- block 181: the jump over a hazard must also be timed around a block: its window (208 ms) is cut by a block; block 249: the jump over a hazard must also be timed around a block: its window (208 ms) is cut by a block; block 45: a spike then a step 3 blocks after it: the jump comes down right before the step (put the step right after the spike, or 6+ blocks away); block 286: a spike then a step 5 blocks after it: the jump comes down right before the step (put the step right after the spike, or 6+ blocks away); block 315: a spike then a step 3 blocks after it: the jump comes down right before the step (put the step right after the spike, or 6+ blocks away); block 947: a spike then a step 3 blocks after it: the jump comes down right before the step (put the step right after the spike, or 6+ blocks away)
- PASS player timing: tightest 125 ms over 104 inputs on the player's route, want >= 60
- WARN difficulty: Normal (0.34 = ~2 attempts), want Hard
- WARN pacing: start 38, end 15, longest busy 100, hazards first/last third 102/35 -- 100 blocks with no 6-block rest; last third calmer than the first (35 vs 102 hazards)
- PASS variety: 10 different chunks in 17, most common 24%
- PASS readability: decoration clear of hazards
- PASS colour: 160 colour triggers for 8 coloured sections
- PASS sync: 3/6 portals on a bar start, 8/55 presses centred on a beat
- PASS mode entry: mode portals over open space
- PASS skips: all 8 portals and 13 orbs on the path
- FAIL fairness: chain at block 213: 3 orb taps 208/213/213 ms windows, under 500 ms apart; chain at block 325: 3 orb taps 221/292/213 ms windows, under 500 ms apart
- WARN route: ship 355-479: 18 presses; wave 749-865: 12 presses, 295 cs within 12 of a wall
- WARN objects: 4 gameplay objects with unconfirmed hitboxes (ids 141, 35)
- PASS taste: 69/100 (EN|2.2; distinctIds p0, decoShare p75, heightRange p80)
- WARN craft: 3/7 craft targets -- pieces100 5 (>= 12), floorHaz 9% (>= 0.35), backDeco 26% (<= 0.2), hazards100 19 (>= 45, <= 180)

## Kept: not ready, difficulty Normal (target Hard)
