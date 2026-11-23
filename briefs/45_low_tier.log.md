# GDLM 45 first flight
Idea: 40 s on the song of Ragnarok (343707), Normal to Hard: sections that follow the song -- the hit at b5 starts it, a long quiet build (cube, ship, ball, upside-down cube, a wave rising into it), the drop at b69 (+10 dB) flashes in a hard cube part, then ball and a wave finale on the loud part; every section its own mode or idea and its own look, changed on its first beat
Story: v1-v4 were a 61 s Easy level on 134270 (template A from the knowledge base). The user: 'more variety, some upside down, the new modes, sections with styling changing according to the music' and then 'Ragnarok 40 seconds, with sections, Normal-Hard, somewhat matching the beat'. Look: hell, dark red embers in the build getting brighter, the drop a white flash into orange, the end back to dark.
Target: {"label":"Normal","minWindowMs":50}

## Round 1: not ready (2 fail, 4 warn)
- PASS beatable: 28 presses
- WARN prejumps: block 43 (2.6 ahead of block 6 at 47) (approximate: level with modes)
- FAIL timing: tightest 41.666666666666664 ms over 52 inputs, want >= 50 (measured windows) -- block 36 tap 45.83333333333333 ms; block 118 release 41.666666666666664 ms
- FAIL recovery: 1 press(es) right after landing (< 100 ms) -- block 389 25 ms
- WARN difficulty: Easy (0.26 = ~2 attempts), want Normal
- WARN pacing: start 20, end 85, longest busy 56, hazards first/last third 29/14 -- last third calmer than the first (14 vs 29 hazards)
- PASS variety: 6 different chunks in 11, most common 27%
- PASS readability: decoration clear of hazards
- PASS colour: 28 colour triggers for 10 coloured sections
- WARN sync: 2/10 portals on a bar start, 4/28 presses centred on a beat -- portals off the bars: put mode/speed changes on bar starts
- PASS lead-in: 10 mode portals with a calm lead-in
- PASS mode entry: mode portals over open space
- PASS skips: all 12 portals and 1 orbs on the path
- PASS objects: all hitboxes confirmed

Repairs:
- 2 more columns before block-spike-block at 46 (prejump (2.6 blocks ahead))
- 2 more columns before triple at 37 (45.83333333333333 ms window)
- 1 more row of room in the ship-tunnel at 87 (41.666666666666664 ms window)
- 1 more row of room in the wave-zigzag at 366 (jump 25 ms after landing)

## Round 2: READY (0 fail, 4 warn)
- PASS beatable: 25 presses
- WARN prejumps: block 25 (1.9 ahead of spike at 28); block 65 (3.8 ahead of spike at 70) (approximate: level with modes)
- PASS timing: tightest 83.33333333333333 ms over 50 inputs, want >= 50 (measured windows)
- PASS recovery: every press >= 100 ms after landing
- WARN difficulty: Easy (0.16 = ~1 attempts), want Normal
- WARN pacing: start 20, end 85, longest busy 56, hazards first/last third 28/14 -- last third calmer than the first (14 vs 28 hazards)
- PASS variety: 6 different chunks in 10, most common 30%
- PASS readability: decoration clear of hazards
- PASS colour: 28 colour triggers for 10 coloured sections
- WARN sync: 2/10 portals on a bar start, 4/25 presses centred on a beat -- portals off the bars: put mode/speed changes on bar starts
- PASS lead-in: 10 mode portals with a calm lead-in
- PASS mode entry: mode portals over open space
- PASS skips: all 12 portals and 1 orbs on the path
- PASS objects: all hitboxes confirmed

Repairs:
- 2 more columns before spike-block at 27 (prejump (1.9 blocks ahead))
- 2 more columns before block-spike-block at 67 (prejump (3.8 blocks ahead))

## Round 3: READY (0 fail, 4 warn)
- PASS beatable: 25 presses
- WARN prejumps: block 77 (1.5 ahead of spike at 80) (approximate: level with modes)
- PASS timing: tightest 50 ms over 51 inputs, want >= 50 (measured windows)
- PASS recovery: every press >= 100 ms after landing
- WARN difficulty: Easy (0.19 = ~2 attempts), want Normal
- WARN pacing: start 20, end 85, longest busy 56, hazards first/last third 28/14 -- last third calmer than the first (14 vs 28 hazards)
- PASS variety: 6 different chunks in 10, most common 30%
- PASS readability: decoration clear of hazards
- PASS colour: 28 colour triggers for 10 coloured sections
- WARN sync: 2/10 portals on a bar start, 3/25 presses centred on a beat -- portals off the bars: put mode/speed changes on bar starts
- PASS lead-in: 10 mode portals with a calm lead-in
- PASS mode entry: mode portals over open space
- PASS skips: all 12 portals and 1 orbs on the path
- PASS objects: all hitboxes confirmed

Repairs:
- 2 more columns before double at 79 (prejump (1.5 blocks ahead))

## Round 4: READY (0 fail, 3 warn)
- PASS beatable: 24 presses
- PASS prejumps: none
- PASS timing: tightest 50 ms over 43 inputs, want >= 50 (measured windows)
- PASS recovery: every press >= 100 ms after landing
- WARN difficulty: Easy (0.16 = ~1 attempts), want Normal
- WARN pacing: start 20, end 85, longest busy 56, hazards first/last third 28/14 -- last third calmer than the first (14 vs 28 hazards)
- PASS variety: 6 different chunks in 10, most common 30%
- PASS readability: decoration clear of hazards
- PASS colour: 28 colour triggers for 10 coloured sections
- WARN sync: 2/10 portals on a bar start, 3/24 presses centred on a beat -- portals off the bars: put mode/speed changes on bar starts
- PASS lead-in: 10 mode portals with a calm lead-in
- PASS mode entry: mode portals over open space
- PASS skips: all 12 portals and 1 orbs on the path
- PASS objects: all hitboxes confirmed

Tried and kept:
- 1 row less room in the ball-run at 328 (below Normal)
- 1 column less before gate at 311 (below Normal)
- 1 column less before orb-pit at 300 (below Normal)
- 1 row less room in the wave-zigzag at 263 (below Normal)
- spike-block at 245 -> block-spike-block (below Normal)
- 1 column less before block-spike-block at 236 (below Normal)

## Round 5: READY (0 fail, 3 warn)
- PASS beatable: 26 presses
- PASS prejumps: none
- PASS timing: tightest 50 ms over 46 inputs, want >= 50 (measured windows)
- PASS recovery: every press >= 100 ms after landing
- WARN difficulty: Easy (0.17 = ~1 attempts), want Normal
- WARN pacing: start 20, end 83, longest busy 56, hazards first/last third 28/16 -- last third calmer than the first (16 vs 28 hazards)
- PASS variety: 6 different chunks in 10, most common 30%
- PASS readability: decoration clear of hazards
- PASS colour: 28 colour triggers for 10 coloured sections
- WARN sync: 2/10 portals on a bar start, 4/26 presses centred on a beat -- portals off the bars: put mode/speed changes on bar starts
- PASS lead-in: 10 mode portals with a calm lead-in
- PASS mode entry: mode portals over open space
- PASS skips: all 12 portals and 1 orbs on the path
- PASS objects: all hitboxes confirmed

Tried and kept:
- 1 column less before gate at 310 (below Normal)
- 1 column less before orb-pit at 300 (below Normal)
- 1 column less before block-spike-block at 244 (below Normal)
- 1 column less before block-spike-block at 235 (below Normal)
- spike-block at 226 -> block-spike-block (below Normal)
- double at 220 -> triple (below Normal)

## Kept: READY, difficulty Easy (target Normal)
