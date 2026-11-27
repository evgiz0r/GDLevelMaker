# Builds: what each took, what broke, what to change

One entry per compose run (tools/compose.js writes the numbers; the session adds the change it made after
reading them). Targets: song 10 s, layout with its full plan 60 s, path (check solve) 15 min, final 20 min.
The stage times are also in local/timings.jsonl.

## GDLM 64 golden hour, 2026-11-24 00:37
- stages: song 0 s, layout 86 s, layout 474 s, path 1695 s, deco 1824 s, final 1824 s
- slowest step: path (1221 s); over target: layout 86 s > 60 s, layout 474 s > 60 s, path 1695 s > 900 s, deco 1824 s > 1200 s, final 1824 s > 1200 s
- result: not ready (timing, reactive), 8 round(s), variants: 2 section(s)
- change made: craft pieces out of sunrise / night run until their new shapes land (a 4 ms jump and jumps timed around a block came from the old slab-steps and pillar-climb); no automatic library picks for 64 (a UFO-orb piece tripped skips and added mode changes); intent verify allows 20 local repairs (the ship and wave plans start from another height than their cached tests) and reports where it stopped. Open: flying intents should be cached per entry height; the layout stage took 86 s (target 60), the alternatives 6.5 min, the rounds 20 min.

## GDLM 64 golden hour, 2026-11-24 01:02
- stages: song 0 s, layout 2 s, layout 285 s, path 785 s, deco 921 s, final 921 s
- slowest step: path (500 s); over target: layout 285 s > 60 s
- result: not ready (prejumps, reactive), 8 round(s), variants: 2 section(s)
- change made: both fails were the checks, not the level. (1) The noon-flight ship "prejump" came from scoring the section alone: its own solve climbs early from a standing start (5.6 blocks ahead); in the whole level every tunnel press is 0.4-0.8 blocks ahead. 8 rounds of room / reseed repairs could not fix a false flag. compose.js now judges flying presses in the whole level, not per section. (2) The reactive spot at block 200 was a plain step jump onto stairs with no hazard near; the "split window" rule now needs a hazard in play, as the user note it comes from. Still open: layout took 285 s (target 60); height 11.4/10 s; deco coverage at blocks 16-40 and 536-560; ending 3.1 s; hazards 9 per 100 blocks (craft wants 45+).

## GDLM 64 golden hour, 2026-11-24 01:49
- stages: song 0 s, layout 2 s, layout 162 s, path 719 s, deco 831 s, final 831 s
- slowest step: path (557 s); over target: layout 162 s > 60 s
- result: not ready (prejumps, reactive), 8 round(s), variants: 2 section(s)
- change made: the round-4 fixes missed their real causes, found by printing the checks. (1) The ship prejump is printed in section-local blocks: block 11 is the cube walking into the ship portal from the section's standing start, a cube press, so the flying-mode filter skipped it; presses in a section's 12-block lead-in now go to the whole level too (the seam). (2) The reactive hazard test read a spike from presses that were fine (their run dies later, past the horizon); it now counts only failing presses. tools/reactive.js on 64: clear.

## GDLM 64 golden hour, 2026-11-24 02:56
- stages: song 0 s, layout 4 s, layout 235 s, path 696 s, deco 891 s, final 891 s
- slowest step: path (461 s); over target: layout 235 s > 60 s
- result: not ready (prejumps), 8 round(s), variants: 2 section(s)
- change made: ship and reactive fixed; left: three 2x jumps 1.6-1.7 blocks ahead. sightread's limit is a reaction time, so it now scales with speed (x1.24 at 2x). Then the whole-level score on the saved route (54 s, no solve) found the wave mouth: a cube press held into the wave portal; a press whose window crosses into a flying portal is cued by the portal. Deco after: gd-art's decokit (bricks + lit trims, three-depth backdrop, tufts), scalloped cloud bands, three-value palettes, make --look (35 s): 14 -> 24 objects per block, contrast 100 (ground/sky 2.0 -> 4.5). Result: READY (0 fail, 11 warn).

## GDLM 64 golden hour, 2026-11-24 05:11
- stages: song 0 s, layout 77 s, layout 270 s, path 858 s, deco 1066 s, final 1066 s
- slowest step: path (588 s); over target: layout 77 s > 60 s, layout 270 s > 60 s
- result: not ready (prejumps, fairness), 8 round(s), variants: 2 section(s)
- change made: v2 (denser: Hard target, gaps 2-4, structures in every cube section, gameplay through dawn, exits on bars): hazards 9 -> 19 per 100 blocks, Normal; 2 FAILs. One real: orb-ladder-2 makes 3-tap orb chains inside a level (removed; STRUCTURES.md open). The rest false: the saved human route kept the solver's holds through auto-jump chains (naturalPlan's last step preferred the raw route because humanCost counts a hold as one input) -> 14-27-block "prejumps" and a 6.1 s ending. Fixed by the difficulty session (18779c7); the layout plan now goes through naturalPlan too.

## GDLM 64 golden hour, 2026-11-24 05:44
- stages: song 0 s, layout 18 s, layout 275 s, path 754 s, deco 933 s, final 933 s
- slowest step: path (479 s); over target: layout 275 s > 60 s
- result: READY, 2 round(s), variants: 2 section(s)
- change made: v3: READY in 2 rounds, Hard reached, ending and sync now PASS, hazards 18/100. Left: 15 reactive spots (jumps over spikes timed around a block, 67-108 ms windows) at gaps 2-4 -- the next generator change. Deco after: hazard-clear rule, motion ~11/screen.

## GDLM 64 golden hour, 2026-11-24 06:10
- stages: song 0 s, layout 47 s, layout 309 s, path 809 s, deco 1003 s, final 1003 s
- slowest step: path (500 s); over target: layout 309 s > 60 s
- result: READY, 2 round(s), variants: 2 section(s)
- change made: v4 (block-hops / slab-steps / lantern-orb out): READY in 2 rounds, reactive 15 -> 7, hazards 18 -> 14 per 100 blocks (those pieces carried hazards); noon ship without the near tree line reads cleaner; noon run kept it (coverage). Kept v4 over v3: fairness first. Next: hazards back up with pieces that pass reactive in context (harness with neighbours, STRUCTURES.md open).

## GDLM 64 golden hour v5, 2026-11-24 07:15
- stages: song 0 s, layout 21 s, layout 239 s, path 745 s, deco 984 s, final 984 s
- slowest step: path (507 s); over target: layout 239 s > 60 s
- result: READY, 1 round(s), variants: 2 section(s)
- change made: v5 = the structural fix (structures checked in context, compose uses only ready ones): READY in 1 round (v3/v4 needed 2), jumps timed around a block 7 -> 5, hazards still 14/100 -- the pieces that pass in context carry fewer hazards. Density next needs denser pieces that pass in context (new library shapes) or spike floors (craft floorHaz 8% vs 35%).

## GDLM 65 single builder test, 2026-11-24 14:10
- stages: song 0 s, layout 97 s, path 846 s, deco 1091 s, final 1091 s
- slowest step: path (750 s); over target: layout 97 s > 60 s
- result: not ready (prejumps), 8 round(s)
- change made: none -- this was the single-builder baseline for the collab test below (same brief, one compose).

## GDLM 65 collab test (tools/collab.js), 2026-11-24
- what: a 51 s brief (6 sections: cube, cube, ship, 2x cube, wave, cube) split into 4 parts of 10-17 s pinned to song
  time, each part built alone by its own builder agent, joined by time; routes joined, no solve.
- final round (all fixes in): parts built 2 at a time (2 lock slots): p1 54 s, p2 19 s, p3 3 s of work (p0 4 s earlier),
  lock waits 34-86 s; join + full check 113 s (most of it fairness). Wall 236 s -> READY, every seam holds.
- one-builder baseline on the same brief (GDLM 65 single builder test): 1115 s (18.6 min), 8 repair rounds, NOT READY
  (2 prejumps). Not the same judge: parts are scored alone (exact cube checks), the whole level by the sweep.
- seams: join 1: 3 of 3 failed; join 2: 3 of 3; join 3: 0 of 3. Part builds: 11 runs, 4 crashed (runcache, fixed by
  physics2 f6abcdf), 4 failed their own seam (contract and exit fixes), 0 failed on gameplay after the tick fix.
- the time that went: lock waits (up to 58 and 91 min behind other sessions' long solves, before the 2 slots).
- what broke and what changed (each now in BUILDING.md 1 and the code): a part's header is dropped at the join (seam
  speed = arrival speed, a faster part brings its own portal); a portal on a part's first column is touched ~30 units
  early once joined (portalRoom 3); a flight exit at the section's end leaves the cube on the frame at the seam
  (exitRoom 4); a hold crossed a seam (release at every seam); seam state read 30 ticks before; parts' deco before
  their start dropped; plan.json written per part (2 builds at once); --seed did nothing (now reseeds sections);
  score.js moved presses to fractional ticks (rounded).
- next: a part's deco by its own builder (today the scene / modern pass runs per part, no art pieces yet); parts of
  other modes at the seam (a ship seam); the viewer's per-part stage bar; sync drift budget across many seams.

## Collab round 2, 2026-11-24: deco per part, flight seams, drift, the long song, GDLM 64 v6
- new in tools/collab.js: `deco` (a part's decorator: tools/scenes/kit.js, gd-art's kit in each section's colours;
  gameplay checked unchanged, route kept: 0 s of work per part); `scene` (one level-wide scene over the joined level,
  for Golden Hour's: 53-56 s); parts placed on the joined level's own timeline (drift 0 u at every seam, budget 6);
  the join re-routes a part from the state it is handed (solveSweep start/goal: GDLM 66 p1 re-routed in 9.2-9.6 s);
  seams inside a flight (`continue` sections, mode-only contract).
- GDLM 65 (4 parts) decorated part by part and rejoined: READY, 200 s wall.
- GDLM 64 v6 (Golden Haze, 7 parts, art's dense chains + height pieces): JOINED, READY (0 fail, 11 warn), all 7 parts
  OK, drift 0. But not better than v5: hazards still 14/100 (the chains are 1x cube pieces; ship / wave / 2x / upside
  sections stay classic), reactive 8 (v5 5), Normal ~4 attempts. And its picture shows the blocks' raw grid skin
  (white grid lines over the sun in the noon ship): v5 dressed blocks in its per-level pass; v6's parts were built
  without it and the scene's fills do not cover every block. Next: build parts with the modern block dressing on.
- GDLM 66 collab long (100 s, 7 parts incl. a ship seam): every seam holds, drift 0, re-route works -- one spot left:
  after p1's ship exit the cube falls from high and meets a spike ~2.3 blocks after landing (10 calm columns only moved
  it 2 blocks): the calm after a flight should scale with the exit height.
- what broke this round -> fixed: parts "failed" difficulty (level-wide gates now the join's); exit read at the seam's
  last tick vs the join's -30 (both -30 now); ship exits 6 blocks early; a part did not know the next part continues its
  flight (brief._continueAfter); upside parts exit 6 early; a cube press right at a flying portal read as a prejump
  (cued by the portal now); old builder processes on old code overwrote fixed parts (stopped; rule below).
- builders: lighter-model agents handed back before their builds finished (they could not wait for the notification):
  the builds ran on, but retries and deco fell to a finisher script. For mechanical part builds a script with named
  builders is as good and far cheaper; agents earn their cost when a builder has to judge and change its part.
- the time: lock waits dominate (23 min for p2/p6 of 66 while other sessions' jobs ran); work per part 0-55 s.

## GDLM 66 collab long JOINED (2026-11-24, later)
- 100 s, 7 parts (cube, ship with a seam inside it, ball, 2x, wave, upside), built and decorated part by part: JOINED,
  every seam holds, drift 0, full check READY (86 s). p1 re-routed at the join from the state handed over (9.3 s).
- the last four blockers were all in the checks, not the level, each now fixed for every level:
  - sightread on a fixed next jump: a flagged press's latest moment is now a player's (lib/windows.js, re-planned);
  - the saved-route walk crossed a mode change (a ship press walked past its exit, judged as a cube jump): stops there;
  - a press that walks alive to the next input is a free jump (pointless-jumps' business), not a prejump;
  - the join saved the joined route through fromRun, which re-planned the WHOLE level (a wave part into 27 short legs):
    now saved as it is, stamped current; the natural passes run only inside re-routed stretches.
## GDLM 69 time hop, 2026-11-24 19:33
- stages: song 0 s, layout 101 s, layout 167 s, path 677 s, deco 1048 s, final 1048 s
- slowest step: path (510 s); over target: layout 101 s > 60 s, layout 167 s > 60 s
- result: not ready (prejumps, timing, channels, reactive, player timing, skips, fairness), 8 round(s), variants: 1 section(s)
- change made: (the session fills this in)

## GDLM 70 candy night, 2026-11-24 20:10
- stages: song 0 s, layout 108 s, layout 208 s, path 793 s, deco 1173 s, final 1173 s
- slowest step: path (585 s); over target: layout 108 s > 60 s, layout 208 s > 60 s
- result: not ready (prejumps, timing, channels, reactive, player timing, skips, fairness), 8 round(s), variants: 2 section(s)
- change made: (the session fills this in)

## GDLM 72 FROSTBITE, 2026-11-25 01:08
- stages: song 0 s, layout 140 s, layout 226 s, path 848 s, deco 1252 s, final 1252 s
- slowest step: path (622 s); over target: layout 140 s > 60 s, layout 226 s > 60 s, deco 1252 s > 1200 s, final 1252 s > 1200 s
- result: not ready (timing, roles, channels, player timing, fairness), 8 round(s), variants: 2 section(s)
- change made: every round failed on a 1x triple (45.8 ms vs minWindowMs 50): Harder brief now 45 (checklist line); the ice kit's lit faces / caps / mid deco lifted off the navy body and its 0.85 checker shade (roles 17/85); hops out of the last section (25 ms); flat wave exits (sawtooth at the 2x wave -> cube)

## GDLM 72 FROSTBITE, 2026-11-25 01:31
- stages: song 0 s, layout 82 s, layout 174 s, path 745 s, deco 1174 s, final 1174 s
- slowest step: path (571 s); over target: layout 82 s > 60 s, layout 174 s > 60 s
- result: not ready (channels, route), 1 round(s), variants: 2 section(s)
- change made: round 3: spike-block after the ball was a long prejump -> plain doubles; the 1x wave failed route -> tried 2x

## GDLM 72 FROSTBITE, 2026-11-25 01:53
- stages: song 0 s, layout 18 s, layout 43 s, path 641 s, deco 1104 s, final 1104 s
- slowest step: path (598 s)
- result: not ready (channels, route), 1 round(s), variants: 2 section(s)
- change made: round 4-5: the reversal wave still failed route at 2x and with gap 5; alone (compose --section 6) it routes in 3 presses

## GDLM 72 FROSTBITE, 2026-11-25 02:13
- stages: song 0 s, layout 77 s, layout 161 s, path 633 s, deco 1066 s, final 1066 s
- slowest step: path (472 s); over target: layout 77 s > 60 s, layout 161 s > 60 s
- result: not ready (channels, route), 1 round(s), variants: 2 section(s)
- change made: round 6: mirrored the wave too (not the cause); route accepted with that reason; READY on score (Insane 2.66 by the model, want Harder)

## GDLM 72 FROSTBITE, 2026-11-25 02:32
- stages: song 0 s, layout 28 s, layout 48 s, path 607 s, deco 995 s, final 995 s
- slowest step: path (559 s)
- result: not ready (channels, route), 1 round(s), variants: 2 section(s)
- change made: round 7: same; done. Each round's 'channels' FAIL is compose's own section scoring (no kit header there); the whole-level score passes channels

## GDLM 72 FROSTBITE, 2026-11-25 02:49
- stages: song 0 s, layout 9 s, layout 21 s, path 445 s, deco 895 s, final 895 s
- slowest step: deco (450 s)
- result: not ready (channels, route), 1 round(s), variants: 2 section(s)
- change made: (the session fills this in)

## GDLM 72 FROSTBITE, 2026-11-25 03:08
- stages: song 0 s, layout 58 s, layout 123 s, path 552 s, deco 987 s, final 987 s
- slowest step: deco (435 s); over target: layout 123 s > 60 s
- result: not ready (channels, route), 1 round(s), variants: 2 section(s)
- change made: (the session fills this in)

## GDLM 72 FROSTBITE, 2026-11-25 19:36
- stages: song 0 s, layout 258 s, layout 516 s, path 1799 s, deco 1799 s, final 1799 s
- slowest step: path (1282 s); over target: layout 258 s > 60 s, layout 516 s > 60 s, path 1799 s > 900 s, deco 1799 s > 1200 s, final 1799 s > 1200 s
- result: not ready (channels), 1 round(s), variants: 2 section(s)
- change made: v2 with compose's varied corridors (vary, 7442948): repetition R 0.65 -> 0.25 (repeats 0.45 -> 0.20, near 0.27 -> 0.07, motifs 11 -> 4, loops 5 -> 3; tools/repeat.js). Stopped before score: the user paused FROSTBITE (2026-11-25, starting over from GDLM 44 hellgate); v2 kept in local/frostbite/, levels/ keeps v1

## GDLM 73 sunny streets, 2026-11-26 (tools/planbuild.js, the user's prompt "Sunny mood, buildings clouds birds. happy colors, good contrasts. rather pacy")
- song: Walking In Style (753562, G4lvatron, CC BY: may go public), 160 BPM, 76.5 s, chosen as the top match for the new sunny kit's song brief (`theme.js song sunny`); hits by tools/hits.js
- stages: song (planbuild, seconds), then make.js's layout / path / deco / final each round; make 7.5-13 min a round on this PC with other sessions' jobs (heavy slot waits up to 34 min on top: an overdue tight.js 21 --fix held a slot 90+ min, still working)
- rounds: 9 to READY (100 presses, tightest 67 ms, Normal 0.79). v1 died in the first ship (corridor knots rotated to start at 5), v2 in the ufo (2nd brick lifted out of reach), then gates one by one: fairness at 6 switches (4 blocks of room after portals), white slopes = clouds (roles), the wave falling under a raised corridor (route), 2-block joins at 2x and ball flips at gates (prejumps), a 3-row flight gate, a step behind a portal, 1x -> 3x in one portal, back-to-back 2x spikes (prejumps)
- slowest step: make (the whole-level solve every round); a section-only rebuild would have saved most of it (collab.js does that, planbuild does not yet)
- change made: every fix is in tools/planbuild.js (defaults) or brickpick (fillGap), the two rules in knowledge/checklist.md ("Room at every portal", "Single spikes at speed"); ball parts dropped from this plan (their bricks leave the ball under a roof that ends); the 3x flight became 2x


## GDLM 44 hellgate v6, 2026-11-26 (tools/hellgate_build.js, Evgeni: "iterate on hellgate, always taking the improved data and methods")

- **Plan:** 7 sections at 1x (cube, ship, cube, wave, ball, ship, cube: 6 mode changes, v5 had 11), every one filled by
  `brickpick.js pickSection` (beam search over the whole section), the height carried through each mode's band, `"outro": 2`
  + signature, the pieces' presses as `seedPresses`.
- **Times:** the seeded solve 5-6 min (v5's full solve 30 min); v6b's whole make 13 min. v6a's make took 55 min while a second
  make of the same level ran beside it (my mistake: the first was not dead when its shell was) -- check `ps` before re-running.
- **Result (v6b):** beaten, 67 presses, 1.39 clicks/s (v5 ~1.0), judge layout 7/10 (v5 3.8), taste 73 (v5 55), Hard ~7
  attempts. NOT READY: 3 prejumps, a 50 ms first tap, 2 switches (ship->cube tap 246 ms after the portal; cube->wave button
  change within 133 ms), arrows over hazards, the outro's portal wall read as skips.
- **Found:** "b<beat>" puts a column's centre on the beat, so every brick picked by beat sat half a block (48 ms) early --
  fixed for every builder (`brickpick.beatAt`). presslib's and seedsolve's repair skipped every calm point after the first (fixed).
- **Next (v7):** more run-up after portals (fairness switches), a calm first second, fly sections in 3 shorter pieces (judge:
  "long corridor" 6.6 s), denser fly / ball pieces, guards around the lane (HAZARDS.md: ours 43% threats / 40% guards / 17% fill,
  rated ~17 / 45 / 38; `lib/hazards.js hazardsAlongPath`), the 72 mirror / upside-down cube variants now in structures.json.

## GDLM 44 hellgate v7, 2026-11-26 (tools/hellgate_build.js)

- **Found:** the song offset (20.9615) sat 0.07 ms past beat 48, so make.js's beat 1 was the NEXT beat: every `"bN"` (bricks,
  gates) a beat (4.3 blocks) later than the picker counted, and the floor (placed by column) 0.3 block off the bricks. v6 had it
  too. Fixed by putting the offset on the beat; make.js now warns (`!! offset ... past a beat`, SYNC.md "bN").
- **Fixed in the builder / picker (general):** a step up between pieces is a walk-up 45-degree slope, a block clear of the last
  piece and 3 before the next (a plain step before spikes killed the solve); a piece with a portal gets a flat run-in
  (brickpick: >= 3 blocks and 0.6 s since the last press -- a spike jumped into red-orb-wall~ud's gravity portal killed it);
  red-orb-wall's library entry was stale (no notes; today: 29 ms, a prejump) -- rechecked, now filtered. The other 20 bricks
  with no notes rechecked: fine.
- **Times:** 4 builds died (4-12 min each); the good one 29 min (seeded: 18 local searches, 138 s; then hazards along the route).
- **Result:** beaten, 63 presses; judge layout 6.6 (balance 5.4, flow 6.1, variety 10, pacing 4, clarity 4, ending 10), Normal
  ~4 attempts, taste 72. Fixed vs v6b: the switches after portals at blocks 141 / 244, 2 of 3 prejumps. NOT READY (7 fails):
  a prejump at 227, a 46 ms tap at block 18 and 54 ms at 542, a short climb at 137-155, flying routes near walls, and the
  outro's portal wall read as skips + a wave->wave switch at 656 (outro 2 itself: every level with it).
- **Next:** ball section is the weak spot (pointless orb, 2 gaps of ~1.9 s, unseen roof); climbs mostly lost (slopes need
  room the 1-3 block gaps rarely give); mode share by tier and an upside-down stretch; the new piece families from the
  "Generate our own structures" thread.

## GDLM 44 hellgate v8 / v9, 2026-11-26 (Evgeni on v7: "we still start in the middle of the music; the structure are super unbalanced ... still too much cube. almost no reverse. no proper transtions ... some places just nothing for few seconds"; "the judge seems to be too nice"; "sections have to be cut by the transitions of the level")

- **v8:** the song from its first beat; pieces balanced (brickpick `window` 120 ms+, `cpsBand` 1.2-3, `winSpread`); an
  upside-down section built whole (patterns.js `ud:<id>`, a ceiling, one portal in, one out; flat pieces only -- a climbing
  piece died flipped); rests (`rest` beats); portals taken on the move (a spike before a gate out of the cube, a 2-row drop
  out of a flight); single spikes at a fixed lead, not "jN" (it slid a spike onto the next piece); no new hazards from 2
  blocks before a portal to 8 after (hazards.js `avoid`). Four builds died first (1-7 min each); the good one 7 min.
- **Judge:** checks for each of his notes (judge.js: uneven piece, too much cube, no reverse, walked portal, abrupt switch,
  no rests; report.js balance / modes / transitions / rests, the total pulled down by any weak axis): v7 6.6 -> 2.7, v8 5.5.
  v8's remaining tight spots were all at portals.
- **v9:** tools/songplan.js -- the sections cut at the song's transitions (tools/sections.js) and the mode by type; 75 s.
  Thin: the drop and ball sections (few ship / ball pieces in the library; the "Generate our own structures" thread).
- **v9 -> v10:** the uneven pieces were the JOINS, not the pieces or the hazard placer (v9 without hazardsAlong judged 1.5,
  with 1.4): pieces 0.3 s apart ran together at 4-5 clicks/s or cut a window to 42 ms. brickpick `minJoin` 0.5 s and 2-4
  block gaps: v10's tightest press 108 ms (v9 46 ms), Normal ~4 attempts (v9 Harder ~68). Judge 1.7 now for the other
  reasons: 1.08 clicks/s over the level, the quiet first 41 s (calm sections, one kind of obstacle, a UFO with 4 clicks in
  9.5 s), long flying stretches (6-8 s), unseen band roofs. The library is the limit: Evgeni calls our pieces poor and the
  first generated batch garbage (g-* left out, `exclude`).
- **v11 -> v12b (2026-11-26):** v11 opened up on blocks (tools/startramp.js, Evgeni's new default) and judged 0: 1.14
  clicks/s, ball / UFO sections ending 11-14 blocks empty (a repeated piece cost more than the empty tail). v12: brickpick
  `tailCost` 1.5, repeats cheap in ball / UFO, a click target per section type (break 1.7 .. drop 2.6): 1.42 clicks/s, the
  4-6 s dead stretches gone, judge 2.5. The ramp's top throws the cube ~3 blocks: v12 needed a 54 ms tap on the ramp, so
  the first piece starts 12 blocks in (v12b). v12b judged 0 again: the solver's human route HOLDS the button 4.5 s through
  block-hops / pillar-pair / pillar-hop (cube bunny-hops every landing), so the opening counts as one press -- cube pieces
  that can be held through are weak pieces. Still open: ball / UFO library (4 / 3 pieces), long flights, outro walked portals.
- **v13 (2026-11-27): the new pipeline, not the lego.** `node tools/typebuild.js briefs/44_hellgate.types.json --run`
  (the GDLM 76 builder: song sections + feel -> a section type each, generated fresh by tools/sectiongen.js -> joined ->
  make.js deco with the hellgate design theme, own sky per section -> report). Song from its first beat to the drop's end
  (52.8 s), 7 sections, the drop a 2x ship. 18 min. Judge 4.1 (v12b: 0): Normal ~3 attempts, tightest 142 ms, height 10,
  clarity 10, flow 10; weak: transitions 1 (walked portals at the joins: cube -> ball, ball -> ufo, cube -> ship), variety
  0, the upside-down closecube 2 clicks in 6.4 s, and 9 s of no clicks after the drop (ending 4). tools/hellgate_build.js
  (the lego builder, v3-v12b) is retired for Hellgate.
