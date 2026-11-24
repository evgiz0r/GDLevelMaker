# GDLM 65 single builder test
Idea: the collab pipeline test (tools/collab.js, BUILDING.md 1): parts of 10-20 s pinned to song time, built alone, joined
Target: {"label":"Normal","minWindowMs":60}

## Round 1: not ready (1 fail, 6 warn)
- PASS beatable: 104 presses
- FAIL prejumps: block 141 (7.7 ahead of block at 150); block 250 (6.7 ahead of spike at 258)
- PASS timing: tightest 141.66666666666666 ms over 114 inputs, want >= 60 (measured windows)
- PASS recovery: every press >= 100 ms after landing
- PASS deco coverage: every screen within reach of the level's 2.6 deco per block
- PASS symmetry: orbs centred on their structures
- PASS jump marks: no jump marks
- PASS contrast: 100/100 sections readable (official levels: median hazard/bg 3.5-21)
- WARN height: 9.9 floor changes per 10 s (want 12+; official 12-22); height range 2 blocks per 10 s (want 3+); 46% of standing on the bare floor (want 45% or less)
- PASS repetition: 0% of 4-move patterns repeat within 10 s (want 5% or less)
- WARN length: 49 s (official 78-95 s; want 60+)
- PASS mode changes: 4 mode changes, 4.9 a minute (official 1.3-5.2; want 6 or fewer)
- PASS ending: 1.6 s from the last input to the end (official median 0.8 s; want 2.5 s or less)
- PASS orb buffer: every orb can be buffered
- PASS pointless jumps: no jumps over nothing
- PASS hazards matter: every hazard is part of the play
- PASS reactive: every landing leaves room to react
- PASS player timing: tightest 142 ms over 114 inputs on the player's route, want >= 60
- PASS difficulty: Normal (0.72 = ~5 attempts), want Normal
- WARN pacing: start 10, end 15, longest busy 92, hazards first/last third 18/12 -- 92 blocks with no 6-block rest; last third calmer than the first (12 vs 18 hazards)
- PASS variety: 4 different chunks in 6, most common 33%
- PASS readability: decoration clear of hazards
- PASS colour: 50 colour triggers for 6 coloured sections
- PASS sync: 4/6 portals on a bar start, 20/104 presses centred on a beat
- PASS lead-in: 4 mode portals with a calm lead-in
- PASS mode entry: mode portals over open space
- PASS skips: all 6 portals and 1 orbs on the path
- WARN route: ship 141-248: 64 presses; wave 340-442: 9 presses, 636 cs within 12 of a wall
- PASS objects: all hitboxes confirmed
- WARN taste: 56/100 (EN|2.2; dsChannels p0, dsMotion p15, distinctIds p0) -- under featured levels on: 2.2 budget: objects per block (8.2035, want >= 17.043)
- WARN craft: 1/6 craft targets -- pieces100 5 (>= 12), floorHaz 5% (>= 0.35), underArmed 25% (>= 0.35), backDeco 45% (<= 0.2), hazards100 10 (>= 45, <= 110)

Repairs:
- 1 more row of room in the ship-tunnel at 143 (prejump (7.7 blocks ahead))
- 2 more columns before double at 257 (prejump (6.7 blocks ahead))

## Round 2: not ready (1 fail, 6 warn)
- PASS beatable: 103 presses
- FAIL prejumps: block 141 (7.7 ahead of block at 150); block 250 (7.3 ahead of spike at 258)
- PASS timing: tightest 141.66666666666666 ms over 113 inputs, want >= 60 (measured windows)
- PASS recovery: every press >= 100 ms after landing
- PASS deco coverage: every screen within reach of the level's 2.6 deco per block
- PASS symmetry: orbs centred on their structures
- PASS jump marks: no jump marks
- PASS contrast: 100/100 sections readable (official levels: median hazard/bg 3.5-21)
- WARN height: 9.9 floor changes per 10 s (want 12+; official 12-22); height range 2 blocks per 10 s (want 3+)
- PASS repetition: 0% of 4-move patterns repeat within 10 s (want 5% or less)
- WARN length: 49 s (official 78-95 s; want 60+)
- PASS mode changes: 4 mode changes, 4.9 a minute (official 1.3-5.2; want 6 or fewer)
- PASS ending: 1.6 s from the last input to the end (official median 0.8 s; want 2.5 s or less)
- PASS orb buffer: every orb can be buffered
- PASS pointless jumps: no jumps over nothing
- PASS hazards matter: every hazard is part of the play
- PASS reactive: every landing leaves room to react
- PASS player timing: tightest 142 ms over 113 inputs on the player's route, want >= 60
- PASS difficulty: Normal (0.72 = ~5 attempts), want Normal
- WARN pacing: start 10, end 15, longest busy 92, hazards first/last third 18/12 -- 92 blocks with no 6-block rest; last third calmer than the first (12 vs 18 hazards)
- PASS variety: 4 different chunks in 6, most common 33%
- PASS readability: decoration clear of hazards
- PASS colour: 50 colour triggers for 6 coloured sections
- PASS sync: 4/6 portals on a bar start, 20/103 presses centred on a beat
- PASS lead-in: 4 mode portals with a calm lead-in
- PASS mode entry: mode portals over open space
- PASS skips: all 6 portals and 1 orbs on the path
- WARN route: ship 141-248: 63 presses; wave 340-442: 9 presses, 636 cs within 12 of a wall
- PASS objects: all hitboxes confirmed
- WARN taste: 56/100 (EN|2.2; dsChannels p0, dsMotion p15, distinctIds p0) -- under featured levels on: 2.2 budget: objects per block (7.7926, want >= 17.043)
- WARN craft: 1/6 craft targets -- pieces100 5 (>= 12), floorHaz 5% (>= 0.35), underArmed 28% (>= 0.35), backDeco 45% (<= 0.2), hazards100 10 (>= 45, <= 110)

Repairs:
- section flight rebuilt from another plan (reseed 0): 2 rounds of patching did not fix it
- section dash rebuilt from another plan (reseed 0): 2 rounds of patching did not fix it

## Round 3: not ready (1 fail, 6 warn)
- PASS beatable: 104 presses
- FAIL prejumps: block 141 (7.7 ahead of block at 150); block 250 (6.7 ahead of spike at 258)
- PASS timing: tightest 141.66666666666666 ms over 114 inputs, want >= 60 (measured windows)
- PASS recovery: every press >= 100 ms after landing
- PASS deco coverage: every screen within reach of the level's 2.6 deco per block
- PASS symmetry: orbs centred on their structures
- PASS jump marks: no jump marks
- PASS contrast: 100/100 sections readable (official levels: median hazard/bg 3.5-21)
- WARN height: 9.9 floor changes per 10 s (want 12+; official 12-22); height range 2 blocks per 10 s (want 3+); 46% of standing on the bare floor (want 45% or less)
- PASS repetition: 0% of 4-move patterns repeat within 10 s (want 5% or less)
- WARN length: 49 s (official 78-95 s; want 60+)
- PASS mode changes: 4 mode changes, 4.9 a minute (official 1.3-5.2; want 6 or fewer)
- PASS ending: 1.6 s from the last input to the end (official median 0.8 s; want 2.5 s or less)
- PASS orb buffer: every orb can be buffered
- PASS pointless jumps: no jumps over nothing
- PASS hazards matter: every hazard is part of the play
- PASS reactive: every landing leaves room to react
- PASS player timing: tightest 142 ms over 114 inputs on the player's route, want >= 60
- PASS difficulty: Normal (0.72 = ~5 attempts), want Normal
- WARN pacing: start 10, end 15, longest busy 92, hazards first/last third 18/12 -- 92 blocks with no 6-block rest; last third calmer than the first (12 vs 18 hazards)
- PASS variety: 4 different chunks in 6, most common 33%
- PASS readability: decoration clear of hazards
- PASS colour: 50 colour triggers for 6 coloured sections
- PASS sync: 4/6 portals on a bar start, 20/104 presses centred on a beat
- PASS lead-in: 4 mode portals with a calm lead-in
- PASS mode entry: mode portals over open space
- PASS skips: all 6 portals and 1 orbs on the path
- WARN route: ship 141-248: 64 presses; wave 340-442: 9 presses, 636 cs within 12 of a wall
- PASS objects: all hitboxes confirmed
- WARN taste: 56/100 (EN|2.2; dsChannels p0, dsMotion p15, distinctIds p0) -- under featured levels on: 2.2 budget: objects per block (8.2035, want >= 17.043)
- WARN craft: 1/6 craft targets -- pieces100 5 (>= 12), floorHaz 5% (>= 0.35), underArmed 25% (>= 0.35), backDeco 45% (<= 0.2), hazards100 10 (>= 45, <= 110)

Repairs:
- 1 more row of room in the ship-tunnel at 143 (prejump (7.7 blocks ahead))
- 2 more columns before double at 257 (prejump (6.7 blocks ahead))

## Round 4: not ready (1 fail, 6 warn)
- PASS beatable: 103 presses
- FAIL prejumps: block 141 (7.7 ahead of block at 150); block 250 (7.3 ahead of spike at 258)
- PASS timing: tightest 141.66666666666666 ms over 113 inputs, want >= 60 (measured windows)
- PASS recovery: every press >= 100 ms after landing
- PASS deco coverage: every screen within reach of the level's 2.6 deco per block
- PASS symmetry: orbs centred on their structures
- PASS jump marks: no jump marks
- PASS contrast: 100/100 sections readable (official levels: median hazard/bg 3.5-21)
- WARN height: 9.9 floor changes per 10 s (want 12+; official 12-22); height range 2 blocks per 10 s (want 3+)
- PASS repetition: 0% of 4-move patterns repeat within 10 s (want 5% or less)
- WARN length: 49 s (official 78-95 s; want 60+)
- PASS mode changes: 4 mode changes, 4.9 a minute (official 1.3-5.2; want 6 or fewer)
- PASS ending: 1.6 s from the last input to the end (official median 0.8 s; want 2.5 s or less)
- PASS orb buffer: every orb can be buffered
- PASS pointless jumps: no jumps over nothing
- PASS hazards matter: every hazard is part of the play
- PASS reactive: every landing leaves room to react
- PASS player timing: tightest 142 ms over 113 inputs on the player's route, want >= 60
- PASS difficulty: Normal (0.72 = ~5 attempts), want Normal
- WARN pacing: start 10, end 15, longest busy 92, hazards first/last third 18/12 -- 92 blocks with no 6-block rest; last third calmer than the first (12 vs 18 hazards)
- PASS variety: 4 different chunks in 6, most common 33%
- PASS readability: decoration clear of hazards
- PASS colour: 50 colour triggers for 6 coloured sections
- PASS sync: 4/6 portals on a bar start, 20/103 presses centred on a beat
- PASS lead-in: 4 mode portals with a calm lead-in
- PASS mode entry: mode portals over open space
- PASS skips: all 6 portals and 1 orbs on the path
- WARN route: ship 141-248: 63 presses; wave 340-442: 9 presses, 636 cs within 12 of a wall
- PASS objects: all hitboxes confirmed
- WARN taste: 56/100 (EN|2.2; dsChannels p0, dsMotion p15, distinctIds p0) -- under featured levels on: 2.2 budget: objects per block (7.7926, want >= 17.043)
- WARN craft: 1/6 craft targets -- pieces100 5 (>= 12), floorHaz 5% (>= 0.35), underArmed 28% (>= 0.35), backDeco 45% (<= 0.2), hazards100 10 (>= 45, <= 110)

Repairs:
- section flight rebuilt from another plan (reseed 0): 2 rounds of patching did not fix it
- section dash rebuilt from another plan (reseed 0): 2 rounds of patching did not fix it

## Round 5: not ready (1 fail, 6 warn)
- PASS beatable: 104 presses
- FAIL prejumps: block 141 (7.7 ahead of block at 150); block 250 (6.7 ahead of spike at 258)
- PASS timing: tightest 141.66666666666666 ms over 114 inputs, want >= 60 (measured windows)
- PASS recovery: every press >= 100 ms after landing
- PASS deco coverage: every screen within reach of the level's 2.6 deco per block
- PASS symmetry: orbs centred on their structures
- PASS jump marks: no jump marks
- PASS contrast: 100/100 sections readable (official levels: median hazard/bg 3.5-21)
- WARN height: 9.9 floor changes per 10 s (want 12+; official 12-22); height range 2 blocks per 10 s (want 3+); 46% of standing on the bare floor (want 45% or less)
- PASS repetition: 0% of 4-move patterns repeat within 10 s (want 5% or less)
- WARN length: 49 s (official 78-95 s; want 60+)
- PASS mode changes: 4 mode changes, 4.9 a minute (official 1.3-5.2; want 6 or fewer)
- PASS ending: 1.6 s from the last input to the end (official median 0.8 s; want 2.5 s or less)
- PASS orb buffer: every orb can be buffered
- PASS pointless jumps: no jumps over nothing
- PASS hazards matter: every hazard is part of the play
- PASS reactive: every landing leaves room to react
- PASS player timing: tightest 142 ms over 114 inputs on the player's route, want >= 60
- PASS difficulty: Normal (0.72 = ~5 attempts), want Normal
- WARN pacing: start 10, end 15, longest busy 92, hazards first/last third 18/12 -- 92 blocks with no 6-block rest; last third calmer than the first (12 vs 18 hazards)
- PASS variety: 4 different chunks in 6, most common 33%
- PASS readability: decoration clear of hazards
- PASS colour: 50 colour triggers for 6 coloured sections
- PASS sync: 4/6 portals on a bar start, 20/104 presses centred on a beat
- PASS lead-in: 4 mode portals with a calm lead-in
- PASS mode entry: mode portals over open space
- PASS skips: all 6 portals and 1 orbs on the path
- WARN route: ship 141-248: 64 presses; wave 340-442: 9 presses, 636 cs within 12 of a wall
- PASS objects: all hitboxes confirmed
- WARN taste: 56/100 (EN|2.2; dsChannels p0, dsMotion p15, distinctIds p0) -- under featured levels on: 2.2 budget: objects per block (8.2035, want >= 17.043)
- WARN craft: 1/6 craft targets -- pieces100 5 (>= 12), floorHaz 5% (>= 0.35), underArmed 25% (>= 0.35), backDeco 45% (<= 0.2), hazards100 10 (>= 45, <= 110)

Repairs:
- 1 more row of room in the ship-tunnel at 143 (prejump (7.7 blocks ahead))
- 2 more columns before double at 257 (prejump (6.7 blocks ahead))

## Round 6: not ready (1 fail, 6 warn)
- PASS beatable: 103 presses
- FAIL prejumps: block 141 (7.7 ahead of block at 150); block 250 (7.3 ahead of spike at 258)
- PASS timing: tightest 141.66666666666666 ms over 113 inputs, want >= 60 (measured windows)
- PASS recovery: every press >= 100 ms after landing
- PASS deco coverage: every screen within reach of the level's 2.6 deco per block
- PASS symmetry: orbs centred on their structures
- PASS jump marks: no jump marks
- PASS contrast: 100/100 sections readable (official levels: median hazard/bg 3.5-21)
- WARN height: 9.9 floor changes per 10 s (want 12+; official 12-22); height range 2 blocks per 10 s (want 3+)
- PASS repetition: 0% of 4-move patterns repeat within 10 s (want 5% or less)
- WARN length: 49 s (official 78-95 s; want 60+)
- PASS mode changes: 4 mode changes, 4.9 a minute (official 1.3-5.2; want 6 or fewer)
- PASS ending: 1.6 s from the last input to the end (official median 0.8 s; want 2.5 s or less)
- PASS orb buffer: every orb can be buffered
- PASS pointless jumps: no jumps over nothing
- PASS hazards matter: every hazard is part of the play
- PASS reactive: every landing leaves room to react
- PASS player timing: tightest 142 ms over 113 inputs on the player's route, want >= 60
- PASS difficulty: Normal (0.72 = ~5 attempts), want Normal
- WARN pacing: start 10, end 15, longest busy 92, hazards first/last third 18/12 -- 92 blocks with no 6-block rest; last third calmer than the first (12 vs 18 hazards)
- PASS variety: 4 different chunks in 6, most common 33%
- PASS readability: decoration clear of hazards
- PASS colour: 50 colour triggers for 6 coloured sections
- PASS sync: 4/6 portals on a bar start, 20/103 presses centred on a beat
- PASS lead-in: 4 mode portals with a calm lead-in
- PASS mode entry: mode portals over open space
- PASS skips: all 6 portals and 1 orbs on the path
- WARN route: ship 141-248: 63 presses; wave 340-442: 9 presses, 636 cs within 12 of a wall
- PASS objects: all hitboxes confirmed
- WARN taste: 56/100 (EN|2.2; dsChannels p0, dsMotion p15, distinctIds p0) -- under featured levels on: 2.2 budget: objects per block (7.7926, want >= 17.043)
- WARN craft: 1/6 craft targets -- pieces100 5 (>= 12), floorHaz 5% (>= 0.35), underArmed 28% (>= 0.35), backDeco 45% (<= 0.2), hazards100 10 (>= 45, <= 110)

Repairs:
- section flight rebuilt from another plan (reseed 0): 2 rounds of patching did not fix it
- section dash rebuilt from another plan (reseed 0): 2 rounds of patching did not fix it

## Round 7: not ready (1 fail, 6 warn)
- PASS beatable: 104 presses
- FAIL prejumps: block 141 (7.7 ahead of block at 150); block 250 (6.7 ahead of spike at 258)
- PASS timing: tightest 141.66666666666666 ms over 114 inputs, want >= 60 (measured windows)
- PASS recovery: every press >= 100 ms after landing
- PASS deco coverage: every screen within reach of the level's 2.6 deco per block
- PASS symmetry: orbs centred on their structures
- PASS jump marks: no jump marks
- PASS contrast: 100/100 sections readable (official levels: median hazard/bg 3.5-21)
- WARN height: 9.9 floor changes per 10 s (want 12+; official 12-22); height range 2 blocks per 10 s (want 3+); 46% of standing on the bare floor (want 45% or less)
- PASS repetition: 0% of 4-move patterns repeat within 10 s (want 5% or less)
- WARN length: 49 s (official 78-95 s; want 60+)
- PASS mode changes: 4 mode changes, 4.9 a minute (official 1.3-5.2; want 6 or fewer)
- PASS ending: 1.6 s from the last input to the end (official median 0.8 s; want 2.5 s or less)
- PASS orb buffer: every orb can be buffered
- PASS pointless jumps: no jumps over nothing
- PASS hazards matter: every hazard is part of the play
- PASS reactive: every landing leaves room to react
- PASS player timing: tightest 142 ms over 114 inputs on the player's route, want >= 60
- PASS difficulty: Normal (0.72 = ~5 attempts), want Normal
- WARN pacing: start 10, end 15, longest busy 92, hazards first/last third 18/12 -- 92 blocks with no 6-block rest; last third calmer than the first (12 vs 18 hazards)
- PASS variety: 4 different chunks in 6, most common 33%
- PASS readability: decoration clear of hazards
- PASS colour: 50 colour triggers for 6 coloured sections
- PASS sync: 4/6 portals on a bar start, 20/104 presses centred on a beat
- PASS lead-in: 4 mode portals with a calm lead-in
- PASS mode entry: mode portals over open space
- PASS skips: all 6 portals and 1 orbs on the path
- WARN route: ship 141-248: 64 presses; wave 340-442: 9 presses, 636 cs within 12 of a wall
- PASS objects: all hitboxes confirmed
- WARN taste: 56/100 (EN|2.2; dsChannels p0, dsMotion p15, distinctIds p0) -- under featured levels on: 2.2 budget: objects per block (8.2035, want >= 17.043)
- WARN craft: 1/6 craft targets -- pieces100 5 (>= 12), floorHaz 5% (>= 0.35), underArmed 25% (>= 0.35), backDeco 45% (<= 0.2), hazards100 10 (>= 45, <= 110)

Repairs:
- 1 more row of room in the ship-tunnel at 143 (prejump (7.7 blocks ahead))
- 2 more columns before double at 257 (prejump (6.7 blocks ahead))

## Round 8: not ready (1 fail, 6 warn)
- PASS beatable: 103 presses
- FAIL prejumps: block 141 (7.7 ahead of block at 150); block 250 (7.3 ahead of spike at 258)
- PASS timing: tightest 141.66666666666666 ms over 113 inputs, want >= 60 (measured windows)
- PASS recovery: every press >= 100 ms after landing
- PASS deco coverage: every screen within reach of the level's 2.6 deco per block
- PASS symmetry: orbs centred on their structures
- PASS jump marks: no jump marks
- PASS contrast: 100/100 sections readable (official levels: median hazard/bg 3.5-21)
- WARN height: 9.9 floor changes per 10 s (want 12+; official 12-22); height range 2 blocks per 10 s (want 3+)
- PASS repetition: 0% of 4-move patterns repeat within 10 s (want 5% or less)
- WARN length: 49 s (official 78-95 s; want 60+)
- PASS mode changes: 4 mode changes, 4.9 a minute (official 1.3-5.2; want 6 or fewer)
- PASS ending: 1.6 s from the last input to the end (official median 0.8 s; want 2.5 s or less)
- PASS orb buffer: every orb can be buffered
- PASS pointless jumps: no jumps over nothing
- PASS hazards matter: every hazard is part of the play
- PASS reactive: every landing leaves room to react
- PASS player timing: tightest 142 ms over 113 inputs on the player's route, want >= 60
- PASS difficulty: Normal (0.72 = ~5 attempts), want Normal
- WARN pacing: start 10, end 15, longest busy 92, hazards first/last third 18/12 -- 92 blocks with no 6-block rest; last third calmer than the first (12 vs 18 hazards)
- PASS variety: 4 different chunks in 6, most common 33%
- PASS readability: decoration clear of hazards
- PASS colour: 50 colour triggers for 6 coloured sections
- PASS sync: 4/6 portals on a bar start, 20/103 presses centred on a beat
- PASS lead-in: 4 mode portals with a calm lead-in
- PASS mode entry: mode portals over open space
- PASS skips: all 6 portals and 1 orbs on the path
- WARN route: ship 141-248: 63 presses; wave 340-442: 9 presses, 636 cs within 12 of a wall
- PASS objects: all hitboxes confirmed
- WARN taste: 56/100 (EN|2.2; dsChannels p0, dsMotion p15, distinctIds p0) -- under featured levels on: 2.2 budget: objects per block (7.7926, want >= 17.043)
- WARN craft: 1/6 craft targets -- pieces100 5 (>= 12), floorHaz 5% (>= 0.35), underArmed 28% (>= 0.35), backDeco 45% (<= 0.2), hazards100 10 (>= 45, <= 110)

Repairs:
- section flight rebuilt from another plan (reseed 0): 2 rounds of patching did not fix it
- section dash rebuilt from another plan (reseed 0): 2 rounds of patching did not fix it

## Whole level (50 s to score): not ready
- PASS beatable: 103 presses
- FAIL prejumps: block 141 (7.7 ahead of block at 150); block 250 (7.3 ahead of spike at 258)
- PASS timing: tightest 141.66666666666666 ms over 113 inputs, want >= 60 (measured windows)
- PASS recovery: every press >= 100 ms after landing
- PASS deco coverage: every screen within reach of the level's 2.6 deco per block
- PASS symmetry: orbs centred on their structures
- PASS jump marks: no jump marks
- PASS contrast: 100/100 sections readable (official levels: median hazard/bg 3.5-21)
- WARN height: 9.9 floor changes per 10 s (want 12+; official 12-22); height range 2 blocks per 10 s (want 3+)
- PASS repetition: 0% of 4-move patterns repeat within 10 s (want 5% or less)
- WARN length: 49 s (official 78-95 s; want 60+)
- PASS mode changes: 4 mode changes, 4.9 a minute (official 1.3-5.2; want 6 or fewer)
- PASS ending: 1.6 s from the last input to the end (official median 0.8 s; want 2.5 s or less)
- PASS orb buffer: every orb can be buffered
- PASS pointless jumps: no jumps over nothing
- PASS hazards matter: every hazard is part of the play
- PASS reactive: every landing leaves room to react
- PASS player timing: tightest 142 ms over 113 inputs on the player's route, want >= 60
- PASS difficulty: Normal (0.72 = ~5 attempts), want Normal
- WARN pacing: start 10, end 15, longest busy 92, hazards first/last third 18/12 -- 92 blocks with no 6-block rest; last third calmer than the first (12 vs 18 hazards)
- PASS variety: 4 different chunks in 6, most common 33%
- PASS readability: decoration clear of hazards
- PASS colour: 50 colour triggers for 6 coloured sections
- PASS sync: 4/6 portals on a bar start, 20/103 presses centred on a beat
- PASS lead-in: 4 mode portals with a calm lead-in
- PASS mode entry: mode portals over open space
- PASS skips: all 6 portals and 1 orbs on the path
- PASS fairness: no unfair spots found
- WARN route: ship 141-248: 63 presses; wave 340-442: 9 presses, 636 cs within 12 of a wall
- PASS objects: all hitboxes confirmed
- WARN taste: 56/100 (EN|2.2; dsChannels p0, dsMotion p15, distinctIds p0) -- under featured levels on: 2.2 budget: objects per block (7.7926, want >= 17.043)
- WARN craft: 1/6 craft targets -- pieces100 5 (>= 12), floorHaz 5% (>= 0.35), underArmed 28% (>= 0.35), backDeco 45% (<= 0.2), hazards100 10 (>= 45, <= 110)

## Kept: not ready, difficulty Normal (target Normal)
