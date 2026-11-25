# GDLM 72 FROSTBITE
Idea: the user's FROSTBITE brief (2026-11-25): Harder (~7 stars), ~1:30, six sections each with its own identity under one icy theme; good mode variety, reverse (mirror) parts and gravity changes, consistent sync, fair but challenging timings, no frame-perfect inputs; ice theme kit (tools/themes/ice.js) for blocks, spikes and the six backgrounds
Story: S1 0-10 s frozen entrance (cube) -> ship at 10 s into the caves; S2 caverns: ship, ball, a tighter cube; S3 27.5 s frozen reversal: mirrored upside-down cube, mirrored ship, wave; S4 41.2 s (the drop) crystal rush: wave 2x, spider, fast cube; a hush on the song's silence; S5 58.4 s (second drop) frozen descent: mirrored ball, ufo, ship; S6 72 s final blizzard: cube, wave 2x, synced cube jumps onto a big frozen platform, the song breaks at 85.8 s
Target: {"label":"Harder","minWindowMs":45}
- variants frozen entrance: v0 kept (64) over v1 64 [WARN deco coverage, FAIL channels, WARN height, WARN length, WARN ending, FAIL difficulty, WARN pacing, WARN taste, WARN craft], v2 64 [WARN deco coverage, FAIL channels, WARN height, WARN length, WARN ending, FAIL difficulty, WARN pacing, WARN taste, WARN craft] -- CLOSE: a taste call for the user
- variants final jumps: v1 kept (64) over v2 64 [FAIL channels, WARN length, WARN ending, WARN reactive, FAIL difficulty, WARN pacing, WARN taste, WARN craft], v0 58 [FAIL channels, WARN length, WARN ending, WARN reactive, FAIL difficulty, WARN climbs, WARN pacing, WARN taste, WARN craft] -- CLOSE: a taste call for the user

## Round 1: READY (0 fail, 0 warn)
- PASS beatable: frozen entrance: 10 presses
- PASS prejumps: frozen entrance: none
- PASS timing: frozen entrance: tightest 45.83333333333333 ms over 10 inputs, want >= 45 (measured windows)
- PASS recovery: frozen entrance: every press >= 100 ms after landing
- PASS skips: frozen entrance: all 1 portals and 1 orbs on the path

## Whole level (381 s to score): not ready
- PASS beatable: 110 presses
- PASS prejumps: frozen entrance: none -- from the sections
- PASS timing: frozen entrance: tightest 45.83333333333333 ms over 10 inputs, want >= 45 (measured windows) -- from the sections
- PASS recovery: frozen entrance: every press >= 100 ms after landing -- from the sections
- WARN deco coverage: 17 stretch(es) under half the level's 8.2 deco per block -- blocks 0-16: 2.1/block; blocks 8-24: 3.9/block; blocks 64-80: 1.5/block; blocks 72-88: 3.5/block; blocks 88-104: 2.8/block; blocks 248-264: 3.2/block; blocks 256-272: 3.3/block; blocks 272-288: 3.9/block; blocks 568-584: 3.0/block; blocks 576-592: 3.8/block; blocks 592-608: 4.1/block; blocks 600-616: 2.8/block; blocks 608-624: 3.9/block; blocks 792-808: 3.7/block; blocks 896-912: 4.1/block; blocks 904-920: 4.0/block; blocks 912-928: 3.4/block
- PASS symmetry: orbs centred on their structures
- PASS jump marks: no jump marks
- WARN contrast: 96/100 sections readable (official levels: median hazard/bg 3.5-21); STARK: median block/bg 10.65 > 6.5 (rated 2.2 levels: 1.35-6.2) -- a mid-tone scene, hazards kept clear (decokit.midTone) -- ~52 s: hazard/block 1.30; ~7.7 s: 41 deco over hazards; ~50.1 s: hazard/block 1.30; ~51 s: hazard/block 1.30
- PASS roles: 0/91 sections mix a playable role with deco or the sky {} (official levels 0-5%)
- FAIL channels: 0 deco on undefined channels: WHITE in the game
- WARN height: 9.8 floor changes per 10 s (want 12+; official 12-22); 59% of standing on the bare floor (want 45% or less)
- PASS repetition: 0% of 4-move patterns repeat within 10 s (want 5% or less)
- PASS length: 86 s (official 78-95 s; want 60+)
- ACCEPT mode changes: 20 mode changes, 13.9 a minute (official 1.3-5.2; want 6 or fewer) -- accepted: the user's brief asks for 2-3 modes in each 15 s section (Cube -> Ship, Ship -> Ball -> Cube, ...)
- PASS ending: 1.7 s from the last input to the end (official median 0.8 s; want 2.5 s or less)
- WARN dead air: 3 stretch(es) with nothing to do (input limit 2.0 s) -- no input 26.1-28.3 s; no input 30.2-33.1 s; no input 61.4-63.8 s
- PASS triples: 1 triple spikes in 86 s (at most 5)
- PASS orb buffer: every orb can be buffered
- PASS pointless jumps: no jumps over nothing
- WARN hazards matter: 1 hazard group(s) that need no action -- blocks 195-195: walked over without a jump (a gap above it is crossed on foot)
- WARN reactive: 7 spot(s) that need exact hops -- block 293: the jump over a hazard must also be timed around a block: its window (108 ms) is cut by a block; block 577: the jump over a hazard must also be timed around a block: its window (167 ms) is cut by a block; block 812: the jump over a hazard must also be timed around a block: its window (108 ms) is cut by a block; block 915: lands on a 1-block spot and must jump again within 250 ms; block 579: a spike then a step 3 blocks after it: the jump comes down right before the step (put the step right after the spike, or 8+ blocks away); block 814: a spike then a step 3 blocks after it: the jump comes down right before the step (put the step right after the spike, or 6+ blocks away); block 909: a spike then a step 3 blocks after it: the jump comes down right before the step (put the step right after the spike, or 6+ blocks away)
- PASS player timing: tightest 46 ms over 153 inputs on the player's route, want >= 45
- WARN difficulty: Insane (2.77 = ~587 attempts), want Harder
- PASS one ending: 0 end text(s), 1 signature(s)
- PASS stale stretch: 8.6 s with no mode / speed / gravity change from block 108 (want 18 s or less for Harder)
- PASS mode tier: features up to Insane for Harder
- WARN climbs: 2 climb(s), 1 hard to read -- blocks 804-817: tight: 108 ms windows
- WARN pacing: start 10, end 15, longest busy 81, hazards first/last third 61/24 -- 81 blocks with no 6-block rest; last third calmer than the first (24 vs 61 hazards)
- PASS variety: 9 different chunks in 22, most common 32%
- PASS readability: decoration clear of hazards
- PASS colour: 356 colour triggers for 18 coloured sections
- WARN sync: 10/24 portals on a bar start, 21/110 presses centred on a beat -- portals off the bars: put mode/speed changes on bar starts
- PASS mode entry: mode portals over open space
- PASS skips: all 28 portals and 2 orbs on the path
- PASS fairness: no unfair spots found
- FAIL route: ship 106-195: 15 presses; ship 346-391: 8 presses; wave 401-437: 8 presses, 6 legs under 100 ms, 125 cs within 12 of a wall; wave 444-500: 6 presses, 209 cs within 12 of a wall; ufo 707-753: 7 presses, 41 cs within 12 of a wall; ship 759-790: 5 presses, 65 cs within 12 of a wall; wave 829-890: 7 presses, 268 cs within 12 of a wall -- a wave corridor that needs extra presses per leg: widen it or straighten it (tell style)
- PASS objects: all hitboxes confirmed
- WARN taste: 79/100 (EN|2.2; moveTrigPerMin p90, distinctIds p0, hazPer10 p15) -- under featured levels on: 2.2 budget: objects per block (13.6667, want >= 17.043)
- WARN craft: 2/5 craft targets -- pieces100 5 (>= 12), floorHaz 6% (>= 0.15), hazards100 11 (>= 45, <= 180)

## Kept: not ready, difficulty Insane (target Harder)
