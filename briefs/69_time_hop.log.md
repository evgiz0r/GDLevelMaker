# GDLM 69 time hop
Idea: The whole screen switching colour on a phrase start, as if the time machine just jumped.
Story: 0-10 s intro: a short upside-down hop at 4 s: a taste of the world turning; 10-28 s build: the first jump in time: the screen turns blue; 28-34 s build: the screen flips (mirror) and turns pink; a ship at 34 s; 34-41.6 s build: the screen flips (mirror) and turns pink; a ship at 34 s; 41.6-61.4 s break: a 10 s fade to near black; 61.4-68.3 s build: a 10 s fade up from black into purple; 68.3-88.2 s drop: an instant palette switch every 3-7 s, flipped and upside-down moments between; 88.2-94.6 s finale: ship, then upside-down ship to the end
Target: {"label":"Normal","minWindowMs":60}
- variants departure: a bright teal present: v0 kept (52) over v2 16 [WARN deco coverage, WARN contrast, FAIL channels, WARN length, WARN mode changes, WARN ending, WARN difficulty, WARN mode tier, WARN energy curve, WARN sync, FAIL skips, WARN route, WARN taste, WARN craft], v1 4 [WARN deco coverage, WARN symmetry, WARN contrast, FAIL channels, WARN length, WARN mode changes, WARN ending, WARN orb buffer, WARN difficulty, WARN mode tier, WARN energy curve, WARN sync, FAIL skips, WARN route, WARN taste, WARN craft]

## Round 1: not ready (3 fail, 0 warn)
- PASS beatable: departure: a bright teal present: 7 presses
- FAIL prejumps: first era: a deep blue era: block 30 (1.7 ahead of block at 33); block 37 (1.7 ahead of block at 40)
- FAIL timing: reversal: a pink era where time runs backwards: tightest 45.83333333333333 ms over 4 inputs, want >= 60 (measured windows) -- block 14 tap 45.83333333333333 ms
- PASS recovery: departure: a bright teal present: every press >= 100 ms after landing
- FAIL skips: first era: a deep blue era: cube portal at block 136; cube portal at block 136 not touched by the solved run: block that way past it

Repairs:
- 2 more columns before s:ceiling-hop at 117 (prejump (1.7 blocks ahead))
- 2 more columns before triple at 299 (45.83333333333333 ms window)

## Round 2: not ready (3 fail, 0 warn)
- PASS beatable: departure: a bright teal present: 7 presses
- FAIL prejumps: first era: a deep blue era: block 32 (1.7 ahead of block at 35); block 39 (1.7 ahead of block at 42)
- FAIL timing: reversal: a pink era where time runs backwards: tightest 45.83333333333333 ms over 4 inputs, want >= 60 (measured windows) -- block 14 tap 45.83333333333333 ms
- PASS recovery: departure: a bright teal present: every press >= 100 ms after landing
- FAIL skips: first era: a deep blue era: cube portal at block 138; cube portal at block 138 not touched by the solved run: block that way past it

Repairs:
- section first era: a deep blue era rebuilt from another plan (reseed 3): 2 rounds of patching did not fix it
- section reversal: a pink era where time runs backwards rebuilt from another plan (reseed 3): 2 rounds of patching did not fix it

## Round 3: not ready (3 fail, 0 warn)
- PASS beatable: departure: a bright teal present: 7 presses
- FAIL prejumps: first era: a deep blue era: block 30 (1.7 ahead of block at 33); block 37 (1.7 ahead of block at 40)
- FAIL timing: reversal: a pink era where time runs backwards: tightest 45.83333333333333 ms over 4 inputs, want >= 60 (measured windows) -- block 14 tap 45.83333333333333 ms
- PASS recovery: departure: a bright teal present: every press >= 100 ms after landing
- FAIL skips: first era: a deep blue era: cube portal at block 138; cube portal at block 138; cube portal at block 197; cube portal at block 197 not touched by the solved run: block that way past it

Repairs:
- 2 more columns before s:ceiling-hop at 117 (prejump (1.7 blocks ahead))
- 2 more columns before triple at 299 (45.83333333333333 ms window)

## Round 4: not ready (3 fail, 0 warn)
- PASS beatable: departure: a bright teal present: 7 presses
- FAIL prejumps: first era: a deep blue era: block 32 (1.7 ahead of block at 35); block 39 (1.7 ahead of block at 42)
- FAIL timing: reversal: a pink era where time runs backwards: tightest 45.83333333333333 ms over 4 inputs, want >= 60 (measured windows) -- block 14 tap 45.83333333333333 ms
- PASS recovery: departure: a bright teal present: every press >= 100 ms after landing
- FAIL skips: first era: a deep blue era: cube portal at block 140; cube portal at block 140; cube portal at block 199; cube portal at block 199 not touched by the solved run: block that way past it

Repairs:
- section first era: a deep blue era rebuilt from another plan (reseed 6): 2 rounds of patching did not fix it
- section reversal: a pink era where time runs backwards rebuilt from another plan (reseed 6): 2 rounds of patching did not fix it

## Round 5: not ready (3 fail, 0 warn)
- PASS beatable: departure: a bright teal present: 7 presses
- FAIL prejumps: first era: a deep blue era: block 30 (1.7 ahead of block at 33); block 37 (1.7 ahead of block at 40); block 143 (62.0 ahead of block at 207)
- FAIL timing: reversal: a pink era where time runs backwards: tightest 45.83333333333333 ms over 4 inputs, want >= 60 (measured windows) -- block 14 tap 45.83333333333333 ms
- PASS recovery: departure: a bright teal present: every press >= 100 ms after landing
- FAIL skips: first era: a deep blue era: cube portal at block 147; cube portal at block 147 not touched by the solved run: block that way past it

Repairs:
- 2 more columns before s:ceiling-hop at 117 (prejump (1.7 blocks ahead))
- 2 more columns before triple at 299 (prejump (62.0 blocks ahead))

## Round 6: not ready (3 fail, 0 warn)
- PASS beatable: departure: a bright teal present: 7 presses
- FAIL prejumps: first era: a deep blue era: block 32 (1.7 ahead of block at 35); block 39 (1.7 ahead of block at 42); block 145 (60.0 ahead of block at 207)
- FAIL timing: reversal: a pink era where time runs backwards: tightest 45.83333333333333 ms over 4 inputs, want >= 60 (measured windows) -- block 14 tap 45.83333333333333 ms
- PASS recovery: departure: a bright teal present: every press >= 100 ms after landing
- FAIL skips: first era: a deep blue era: cube portal at block 149; cube portal at block 149 not touched by the solved run: block that way past it

Repairs:
- section first era: a deep blue era rebuilt from another plan (reseed 9): 2 rounds of patching did not fix it
- section reversal: a pink era where time runs backwards rebuilt from another plan (reseed 9): 2 rounds of patching did not fix it

## Round 7: not ready (3 fail, 0 warn)
- PASS beatable: departure: a bright teal present: 7 presses
- FAIL prejumps: first era: a deep blue era: block 28 (1.7 ahead of block at 31); block 35 (1.7 ahead of block at 38); block 162 (1.7 ahead of block at 165); block 169 (1.7 ahead of block at 172)
- FAIL timing: reversal: a pink era where time runs backwards: tightest 45.83333333333333 ms over 4 inputs, want >= 60 (measured windows) -- block 14 tap 45.83333333333333 ms
- PASS recovery: departure: a bright teal present: every press >= 100 ms after landing
- FAIL skips: first era: a deep blue era: cube portal at block 141; cube portal at block 141 not touched by the solved run: block that way past it

Repairs:
- 2 more columns before s:ceiling-hop at 115 (prejump (1.7 blocks ahead))
- 2 more columns before s:ceiling-hop at 249 (prejump (1.7 blocks ahead))
- 2 more columns before triple at 299 (45.83333333333333 ms window)

## Round 8: not ready (3 fail, 0 warn)
- PASS beatable: departure: a bright teal present: 7 presses
- FAIL prejumps: first era: a deep blue era: block 30 (1.7 ahead of block at 33); block 37 (1.7 ahead of block at 40); block 166 (1.7 ahead of block at 169); block 173 (1.7 ahead of block at 176)
- FAIL timing: reversal: a pink era where time runs backwards: tightest 45.83333333333333 ms over 4 inputs, want >= 60 (measured windows) -- block 14 tap 45.83333333333333 ms
- PASS recovery: departure: a bright teal present: every press >= 100 ms after landing
- FAIL skips: first era: a deep blue era: cube portal at block 143; cube portal at block 143 not touched by the solved run: block that way past it

Repairs:
- section first era: a deep blue era rebuilt from another plan (reseed 12): 2 rounds of patching did not fix it
- section reversal: a pink era where time runs backwards rebuilt from another plan (reseed 12): 2 rounds of patching did not fix it

## Whole level (301 s to score): not ready
- PASS beatable: 117 presses
- FAIL prejumps: first era: a deep blue era: block 30 (1.7 ahead of block at 33); block 37 (1.7 ahead of block at 40) -- from the sections
- FAIL timing: reversal: a pink era where time runs backwards: tightest 45.83333333333333 ms over 4 inputs, want >= 60 (measured windows) -- from the sections
- PASS recovery: departure: a bright teal present: every press >= 100 ms after landing -- from the sections
- PASS deco coverage: every screen within reach of the level's 2.2 deco per block
- WARN symmetry: 3 orb(s) off the centre of their spike row -- orb at block 216 over spikes 212-223 (centre 217.5); 3 orbs (a group) at block 725 over spikes 724-737 (centre 730.5); 3 orbs (a group) at block 819 over spikes 818-831 (centre 824.5)
- PASS jump marks: no jump marks
- WARN contrast: 52/100 sections readable (official levels: median hazard/bg 3.5-21) -- ~72.2 s: hazard/bg 1.37, block/bg 1.02; ~35.6 s: block/bg 1.14; ~74.1 s: hazard/bg 1.37, block/bg 1.02; ~47.2 s: block/bg 1.05
- FAIL channels: 0 deco on undefined channels: WHITE in the game
- WARN height: 7 floor changes per 10 s (want 12+; official 12-22); 6% of 10 s windows flat; 69% of standing on the bare floor (want 45% or less)
- PASS repetition: 0% of 4-move patterns repeat within 10 s (want 5% or less)
- PASS length: 95 s (official 78-95 s; want 60+)
- WARN mode changes: 12 mode changes, 7.6 a minute (official 1.3-5.2; want 6 or fewer)
- PASS ending: 1.7 s from the last input to the end (official median 0.8 s; want 2.5 s or less)
- WARN dead air: 10 stretch(es) with nothing to do (input limit 2.0 s) -- no input 7.9-10.2 s; no input 20.8-23.6 s; no input 24.5-28.7 s; no input 31.1-33.2 s; no input 48.6-51.3 s; no input 59.7-69.5 s; no input 74.4-78.5 s; no input 83.0-88.5 s; empty screen 26.0-27.8 s; empty screen 84.0-88.0 s
- WARN orb buffer: 1 orb(s) that only a precise click takes -- block 216
- PASS pointless jumps: no jumps over nothing
- WARN hazards matter: 6 hazard group(s) that need no action -- blocks 170-170: walked over without a jump (a gap above it is crossed on foot); blocks 261-261: walked over without a jump (a gap above it is crossed on foot); blocks 340-340: walked over without a jump (a gap above it is crossed on foot); blocks 543-543: walked over without a jump (a gap above it is crossed on foot); blocks 737-737: walked over without a jump (a gap above it is crossed on foot); blocks 831-831: walked over without a jump (a gap above it is crossed on foot)
- FAIL reactive: 3 spot(s) that need exact hops -- block 454: the jump over a hazard must also be timed around a block: its window (108 ms) is split by a block; block 253: lands on a <1-block spot and must jump again within 250 ms; block 535: lands on a <1-block spot and must jump again within 250 ms
- FAIL player timing: tightest 46 ms over 129 inputs on the player's route, want >= 60 -- block 298.3 (28.72 s) press 46 ms
- WARN difficulty: Hard (0.81 = ~7 attempts), want Normal
- PASS one ending: 1 end text(s), 1 signature(s)
- PASS stale stretch: 12.1 s with no mode / speed / gravity change from block 714 (want 35 s or less for Normal)
- WARN mode tier: mode:ufo (Harder), mode:ball (Harder), mode:wave (Harder) in a Normal level -- official levels bring these in at higher ratings: keep them for harder levels, or accept with a reason
- WARN climbs: 4 climb(s), 2 hard to read -- blocks 159-167: short: 1 landing(s) under 0.3 s on the ground (2 blocks at 238 u/s) | blocks 768-776: short: 2 landing(s) under 0.3 s on the ground (2 blocks, 2 blocks at 231 u/s)
- WARN energy curve: real vs intended energy: rho 0.52 over 7 beats, 2 off by > 0.3; worst re-emergence (build) want 0.6 got 0.23 -- the level does not follow its intended energy: densify the beats that run low, calm the ones that run high (tools/energy.js <level> --sheet ...)
- WARN pacing: start 10, end 11, longest busy 40, hazards first/last third 63/55 -- last third calmer than the first (55 vs 63 hazards)
- PASS variety: 15 different chunks in 28, most common 14%
- PASS readability: decoration clear of hazards
- PASS colour: 86 colour triggers for 12 coloured sections
- WARN sync: 4/20 portals on a bar start, 20/117 presses centred on a beat -- portals off the bars: put mode/speed changes on bar starts
- PASS lead-in: 20 mode portals with a calm lead-in
- PASS mode entry: mode portals over open space
- FAIL skips: cube portal at block 228; cube portal at block 228; cube portal at block 519; cube portal at block 519; cube portal at block 635; cube portal at block 635; cube portal at block 865; cube portal at block 865 not touched by the solved run: block that way past it
- FAIL fairness: chain at block 724: 3 orb taps 371/321/325 ms windows, under 500 ms apart; chain at block 818: 3 orb taps 404/313/313 ms windows, under 500 ms apart
- WARN route: ufo 206-227: 3 presses; ship 347-434: 50 presses; wave 838-865: 3 presses, 38 cs within 12 of a wall; ship 922-975: 6 presses, 53 cs within 12 of a wall; presses not needed 204-204: 1 presses
- WARN objects: 1 gameplay objects with unconfirmed hitboxes (ids 35)
- WARN taste: 53/100 (EN|2.2; dsChannels p0, distinctIds p0, dsMotion p20) -- under featured levels on: 2.2 budget: objects per block (5.5374, want >= 17.043)
- WARN craft: 2/7 craft targets -- pieces100 5 (>= 12), floorHaz 13% (>= 0.35), pillarDelta 67% (>= 0.7), backDeco 54% (<= 0.2), hazards100 19 (>= 45, <= 110)

## Kept: not ready, difficulty Hard (target Normal)
