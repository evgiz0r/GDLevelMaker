# Physics -- what the sim does, where each number comes from, how it is checked

`lib/physics.js` (one copy, used by the solver, the checker and the viewer) and `lib/objects.js`
(object ids). CLAUDE.md's Calibration section lists the facts checked in the user's own game;
this file is the map per mode and per trigger. Last full update 2026-11-22.

## The mismatch queue (ranked, 2026-11-26; owner: the physics thread "Fix physics mismatches with the real game")

Every known place where the sim and GD 2.2091 disagree, most harm first. "Data in hand" = settled from files we already
have (probe logs, recordings, gdsolver plans, the decompile), no game needed. "Game" = needs a run in the user's GD:
batched into ONE request to the user (announce first, his go; probe playback, no physics-changing mods). Times are not
measured unless a basis is given. Work top-down; when one is settled, move it to its mode's section with its source and
re-run `tests/tas_progress.js`, `tests/mechanics.js`, `tools/mains.js status` (a main route that breaks = top priority).

| # | mismatch | harm | evidence | how to verify | needs |
|---|---|---|---|---|---|
| ~~1~~ | ~~Ship rides ~0.5 unit low~~ FIXED 2026-11-26 by the jump snap and 32-bit x ("Jump snap, foot margin, 32-bit x"): Stereo Madness and Back On Track's plans now clear; most likely the "ship offset" was the x drift and missing stair snaps putting the ship a unit off (not proven per spot) | | | | |
| ~~2~~ | ~~One-step-late jumps~~ NOT A MISMATCH: the probe logs vy before the step's gravity; fresh jumps agree exactly (39 of 39). The real one was a jump on a button held through a landing (fixed, see "Landing jump and slopes from the probe logs") | | | | |
| 3 | ~~x jumps +1 unit at a ceiling/floor jump~~ SETTLED 2026-11-26: GD's jump snap, in the sim ("Jump snap, foot margin, 32-bit x") | Clubstep step 1285; the stitch drift | probe diff | -- | -- |
| 4 | Cube lands 4-21 ticks late (2026-11-26: the Stereo Madness, Polargeist and Dry Out plans now CLEAR with the snap + 10 margin; re-check the rest) | Polargeist, Dry Out, Can't Let Go, Jumper, Time Machine, Clutterfunk plans | plans | probe log of a landing-heavy main level vs `tas_why` | data in hand, else game |
| 4b | ~~**Slopes**~~ FIXED 2026-11-26 (GDLM 52's climb matches the game to 0.05 units through the top and the launch; Fingerdash's plan 295 -> 300; see "Landing jump and slopes from the probe logs"). Still unmeasured: the launch at other speeds, from a 2:1 slope in our logs, and from ship/ball | every slope | probe log | done | done |
| 4c | Slopes in other modes and frames: a mini ship against a 22-degree slope turned 90 degrees (Bloodbath 10565740 dies at block 85.5) and an upside-down dual wave sliding on the floor into a slope, put under it below the ground (Problematic 7116121, block ~321); from the demons thread, DIFFICULTY.md "Community demons" | 2 community demons | community solves | probe log of a slope lab (ship, wave, upside down, turned) | needs the game |
| 5 | Pink orb / pink pad too strong or low (2026-11-26: ToE's first parting is NOT the orb but a flipped cube pushed onto a block, see "The user's ToE / ToE2 / Hexagon Force / Deadlocked runs") | Theory of Everything 1 and 2 (lv12 33, lv18 105), lab 60 launch 0.5-0.63 vs sim 0.72, GDLM 60 33.9% | plans + lab video | probe playback of a pink-orb/pad lab: vy on the touch step | game |
| 6 | Pink pad strength unconfirmed (`sure:false`). **Yellow pad CONFIRMED 2026-11-26**: the user's "auto play area" run (probe log, 51 cube + 18 ship pad launches) gives vy 16.000 exactly, as the sim | pink-pad auto bricks | decompile only | probe playback of `levels/lab/auto_lab.gdlvl`: vy on each pink pad's step | game (same batch as 5) |
| 7 | Ship entry speed (0.5 vs 0.25 of a falling vy) (2026-11-26: ship -> UFO is 0.25, measured; cube -> ship still open) | Dry Out +64, Can't Let Go +118 blocks in plans, but user runs say no | plans vs user runs disagree | probe playback of GDLM 67 stations 9-10 (pad-thrown ship entries, no input) | game (same batch) |
| 8 | Rotated gameplay tap timing (spider taps 2-3 ticks early) | Dash (ratchet 22 at 75) | plan | tools/tas_trace.js on lv22 at the turn | data in hand |
| 9 | Clutterfunk pad on a hanging block not reached | user's clear dies 3.5% in sim | 1 run | probe playback of the route there / tas_why lv11 | data in hand, else game |
| 10 | Teleport at 45 degrees moves less than the game (2026-11-26: a portal at -53 degrees moves the FULL key 54, Deadlocked probe log; in the sim) | lab 60 | lab video | probe playback of a teleport lab | game (same batch) |
| 11 | Upside-down cube dies hitting the ground hard | GDLM 67 green orb 3 of 4 | lab video | needs the green orb's throw first: probe log of the lab | game (same batch) |
| 12 | GDLM 52 dies in game at x 10765 | one of our levels | probe playback 2026-11-25 | `probe.js result` on its log | data in hand |
| 13 | Back On Track ship ~1 block high after a slide | plan 493 | plan | probe after 1 | after 1 |
| 14 | UFO, robot, spider, swing, green orb mid-air: never checked in the user's game | 3 main routes with 33 ms UFO gaps | gdsolver's model | probe log of any main level with them (the user's own practice runs log too) | game |

Not mismatches but missing (board "missing"): mirror portal, teleport variants 2902/2064/3022, a player carried by a moving
block (Dash), item/pickup, scale, on-death, collision/area triggers, force blocks, platformer.

## How physics is checked

| check | what it is | run |
|---|---|---|
| the user's recordings | tracked frame by frame (`tools/track.py`), real frame times | `node tests/jump_video.js`, `node tests/modes_video.js` |
| real-game plans | gdsolver's input plans that clear each official level in GD 2.2, played through the sim; where we die and the game did not, we are wrong | `node tools/tas.js [n]`, ratchet `node tests/tas_progress.js` |
| why a plan dies | killer, the last second of orbs/pads/landings, presses | `node tools/tas_why.js n` |
| is this id really a hazard/solid? | replays all plans with ids re-kinded | `node tools/tas_kind.js solid 661,662` |
| which triggers levels use | counts per id over official + example levels | `node tools/triggers.js [files]` |
| solve the rest from a state | `GD.solveFrom(w, state, {held})`: the sweep from any state, events in absolute ticks (for hand-made stretches, e.g. lib/natural.js) | - |
| the model's own rules | small worlds: teleport, pad table, move/rotate/stop, mini, one-way | `node tests/mechanics.js` |
| our own levels still solve | solver on every level | `node tools/check.js examples/*.gdlvl levels/*.gdlvl` (heavy: one at a time) |

Sources (read before reinventing): camila314/gdp (2.2 decompiled physics functions), iArtie
GD-2.2081-Decompiled, gdsolver/gdsolver (MIT; measured constants, notes in `dp/src/dp/*.hpp`),
OpenGD (2.1 hitboxes, via `tools/import_opengd.js`). Plans: copy gdsolver's `data/solution_lv*_dp.txt`
to `local/gdsolver/` (shared local folder, never committed).

A plan's tick t is our step t-1 (`tools/tas.js` shifts it). Plans reach, in blocks (2026-11-26, after the probe-log
fixes): 1-4 clear, 5: 176, 6: 490, 7: 231, 8: 363, 9: 382, 10: 320, 11: 295, 12: 33, 13: 142, 14: 30, 15: 267, 16: 141,
17: 295, 18: 123, 19: 100, 20: 32, 21: 54, 22: 75 (tests/tas_progress.js keeps them).

## Modes

| mode | constants (1x) | source | checked by |
|---|---|---|---|
| cube | jump 11.18, gravity 0.958/tick*0.9, fall clamp 15, foot margin 10 on a block top (before or after the tick's move; was a flat 15), jump snap, inner kill box 9 | gdp, gdsolver's collide.hpp, probe logs | video: whole jump arc 1.3 px rms; gravity 0.78 u/frame^2 |
| ship | hold +0.108/+0.086, release -0.069/-0.103, switch at 2g (world terms, also upside down), limits +8/-6.4 | gdsolver | video: hold +0.40, release -0.25 u/frame^2 |
| ball | tap = jump, flip (halves) x0.6; gravity 0.6x0.958 | gdsolver | video: +-0.47 u/frame^2 |
| UFO | flap to 7, gravity 0.086 / 0.129 (see UFO below) | gdsolver | plans only |
| wave | 1 unit up per unit forward (mini 2); contact half 5 (mini 3), dies on a solid with half 1.5, band clamp 10 (mini 6) | gdsolver + video | video: mini wave trail 2.00:1 |
| robot | jump 0.5x, gravity 0.9x, hover 67 ticks while held | gdsolver | plans only |
| spider | half 13.5; teleport = GD's spiderTestJumpInternal search (solids in a strip from the centre to 14.5 ahead, a landing up to 10 behind, hazards in +-4 kill, band face / ground when nothing; rests at face +- half, vy 1 the way it went, not grounded) | gdsolver step.hpp spiderTargetGd (2026-11-25; was a guessed +-4.5 strip at +-15) | plans only |
| swing | flips gravity a tick after a press, vy x0.8, gravity 0.086, limit 8 | gdsolver | plans only |

Swing and the solver (2026-11-23, style's report): the sweep's state key left out the pending flip, so a
swing pressed this tick merged with one still holding from an earlier press, and the cheaper one (no
flip) won: no swing past any wall. Fixed (key has `swingPend`); `tests/mechanics.js` builds style's
swing-wiggle (floor wall, roof wall, floor wall) and solves it in 7 presses.

Green orb (1022, sure:false): flips gravity, then vy = jump speed in the NEW gravity, so from normal
gravity it throws the cube down, away from its new floor (the roof). From gdp's ringJump and gdsolver,
not seen in the user's game yet.
| mini (portals 99/101) | half 9 (spider 8.1, wave 3); jumps, orbs, pads x0.8; on foot gravity unchanged; ship/UFO gravity and limits /0.85; mini UFO flap 6.8; mini swing gravity x1.5 | gdsolver (lv11) | video: mini cube turns 90 deg per 10 frames, falls at 0.78; plan lv11 through its mini part |

### Ball (sections from the decompile, gdsolver and the user's Clutterfunk video)
- Tap on a surface: vy = jump speed, gravity flips (halving it), then x0.6 -> 3.354 at 1x. Gravity
  0.6 x 0.958 per tick, both ways. Band 240 from its portal.
- Orbs x0.7 after the orb's own value (pink 0.77 base); pads from GD's table x0.6: yellow 9.6,
  pink 6.72, blue 3.84 (gdsolver measured lv9/lv22). Red pad 1.25 x 16 x 0.6.
- Checked: video gravity +-0.47 units/frame^2 (`tests/modes_video.js`); plans lv9 (Cycles) to 382,
  lv10 (xStep) to 167 (the pad table took lv10 from 109).
- Open: lv9 at 382 grazes a turned small spike by 0.8 unit after an upside-down roll.

### UFO
- A press flaps vy up to 7 (mini 6.8) if it is lower; gravity 0.086 while falling or slow, 0.129
  while rising faster than 2g (the ship's switch, in world terms); limits +8/-6.4 (mini /0.85).
  Pink orb 0.42, pink pad 0.4 x 16, red pad 0.6 x 16 (mini 0.98). Band 300.
- Ship and UFO read the button a tick later than other modes (gdsolver latOf; `tools/tas.js`).
- Checked: nothing in the user's footage yet (Deadlocked's 48-58 s stretch is a cube with
  gravity portals, not a UFO). Needs a recording: any UFO part with hitboxes on (Theory of
  Everything's UFO, official 12, is the earliest).

### Wave
- Moves in straight lines: up while held, down when not, 1 unit of height per unit forward (45
  degrees), mini 2 (63.4 degrees); y is moved by the line, and the stored vy (what the next mode
  inherits) is +-speed with no mini factor. Contact box half 5 (mini 3), dies when its 1.5 half box
  enters a solid, slides along solid faces, keeps 10 (mini 6) off the band's floor and roof.
- Sliding off a block's end kills: once the wave has slid on a block, the tick its centre passes
  that face's end (no block of the same face continuing under it) is a death, not a fall. Measured:
  the user's GDLM 44 runs (2026-11-23_02-51-50.mkv): the cube lands on a block, takes the wave
  portal at the block's end, the wave sinks onto the top (3 frames of flat trail), and dies on the
  frame its centre passes the corner (game x 1638-1643; sim now 1643). Two of two attempts. The
  rule's exact shape (centre vs box, does it apply on a ceiling face or a ground row) is not seen
  yet; `tests/mechanics.js` pins it. Not hit by any official plan (none slides on a block).
- Head-on into a slope kills: a wave moving into a slope face at more than 67.5 degrees to it
  (e.g. down into a rising 45-degree floor, up into a descending ceiling: 90 degrees) does not ride
  it; it dies once its 1.5 kill box is in (so grazing a V's tip lives: Blast Processing's plan,
  block 166). Glancing (45 degrees onto flat, parallel along a slope) slides. Measured: the user's
  GDLM 44 zigzag (2026-11-23_03-11-47.mkv, ~25 s): released in the corridor, the wave died on the
  rising floor slope; the sim had let it ride up the slope (its zigzag windows of ~500 ms were
  fake). The 67.5 cut is not measured (between 45: slides, and 90: dies). Slope contact for the
  wave now uses its own 5-wide box, not the cube's 15.
- Design consequence: a wave portal right at a block's end that a cube can land on is a trap --
  the habit (enter the wave without holding) slides into the corner. `tools/press_window.js`
  measured GDLM 44's entrance: press-and-hold from 8 ticks before the portal to 13 after (92 ms)
  passes; not pressing by then dies.
- Checked: the user's Deadlocked video, mini wave trail 2.00:1 in 7 frames (`tests/modes_video.js`);
  plans: Blast Processing's wave part (blocks 147-295) survives.
- Open: Deadlocked's plan dies at 32 in the mini wave on a spike turned -63 degrees, threaded with
  2-4 tick taps (gdsolver notes GD's shape for a turned spike vs the wave is not its plain turned
  box either); the full-size 1:1 slope is not yet seen in a recording.

Bands: a flying mode's portal sets floor/ceiling 300 apart (ball 240, spider 270). Entering or
leaving a flying mode halves vy. Velocities sit on a 0.001 grid.

Open: Fingerdash (lv21, 54): a black orb drops the cube at -15 beside a column of turned thorns (458) and it touches one by 1.3 units on the tick it reaches the column -- one tick earlier drop (or GD firing the orb in a different phase of the tick) clears it; the sim's own solver cannot pass there either. Ship ~0.5 unit low (Stereo Madness 328, Hexagon Force 141); a cube that walks off a ledge and
presses just before landing jumps in the game, not in the sim; Theory of Everything 1 and 2 pink-orb
sections ~30 units low; UFO, wave, robot, spider, swing want a recording of the user's own play.

## GDLM 60 physics lab: what the user's game showed (2026-11-23, first play)

The lab level (specs/60_physics_lab.json; 14 numbered, labelled stations) was played once in practice mode
with hitboxes on: GD claude-rec 2026-11-23_04-27-50.mkv, ~57368-57465 s (26 attempts, practice complete).
Contact sheets and frames: local/shots/lab60/. Read station by station from frames and tools/track.py
(lab_read.js's time->x mapping does not survive practice-mode respawns; per-station time windows were used).
- 1 letter blocks D/J/S/H (1755/1813/1829/1859): passed on attempt 1. Harmless, as the sim now says.
- 2 teleports turned 0 / 45 / 90, key 54 = 150: all three put the cube at the SAME height (cube top ~478 px
  up each time, even when entered mid-air: the exit is absolute, portal y + offset), and the game draws the
  orange exit straight above the entry for the 45-degree one, no sideways move. So the exit is the full key 54
  straight up at every angle tried. The sim's cos(angle) rule (106 at 45) is WRONG for 45. Not changed yet:
  "full offset always" once broke Deadlocked's -53-degree portal at block 76 (see the Deadlocked notes), so
  that portal needs a look first (another key? a 2902/2064 variant?), then tas_progress.
- 3 quarter-turned slopes: the cube walks up onto the step and down off it, no wall. The new rule holds.
- 4 planks 1202 over spikes: solid (attempt 7 rides them). The 7 deaths there were missed jumps onto them.
- 6 green orb from the ground: the cube rises from rest to the ceiling in ~0.27 s (90 units): a gravity flip
  whose downward push the ground blocks, as in the sim. Mid-air (the push down) still unseen.
- 7 green dash orb: a straight horizontal dash while held (the deaths: holding into the post after it).
- 5 pink orb: launch 0.5-0.63 of a ground jump's speed from arc fits (sim 0.72); noisy (px scale from the
  ground jump's arc, 3.9 px/unit, vs 3.2 from the teleports: the camera moves). Unsettled.
- 9-14 modes: the run passes them all, but the small, mostly non-lime mode icons defeat the lime tracker
  (it locked on the green progress bar until cropped). Accelerations need a tracker for the hitbox outline
  or the icon colours (open).
Unfair stations to change in v2: 4 (plank row straight over spikes, from flat ground) and 7 (a post that
punishes holding the dash).

## GDLM 67 physics questions lab (2026-11-24; built by the dual/moving-objects session, NOT played yet)

`tools/lab67.js` -> specs/67_physics_questions_lab.json -> levels/archive/gdlm_67_physics_questions_lab.gdlvl (19 stations; the two ship-entry ones added by the physics session).
One open question per station; the label says what to do, the station's note what the sim predicts. Every station has
a ruler (deco 211 squares a block apart) so heights are read against the level in the same frame, not the moving
camera. Stations whose answer is a choice never kill either way. `node tools/lab67.js --check` plays each station's
instructed input in the sim and prints the predictions below. To run: practice mode, hitboxes on, tools/record.sh
(input log + sound); read with tools/replay_run.js and tools/lab_read.js --spec specs/67_physics_questions_lab.json.

| # | station | do | sim predicts | answers |
|---|---|---|---|---|
| 1 | landing buffer EARLY | jump, tap again while rising, no more presses | dies at the 2nd spike (a rising press is kept 40 ticks) | how long a rising press is kept |
| 2 | landing buffer AT THE TOP | tap again at the peak | lives (vy 0 counts as falling: kept until landing) | where "falling" starts |
| 3 | landing buffer on the way DOWN | tap again falling | lives | the Clutterfunk rule, once more |
| 4 | orb hold | jump and HOLD into the yellow orb (roof after the apex) | dies in the pit (a held jump press does not fire the orb) | GDLM 63's open orb hold-buffer |
| 5 | pink orb | one tap, read the apex | launch 0.72 of a ground jump | GDLM 60's 0.5-0.63 vs 0.72 |
| 6 | green orb in the air | tap it at a jump's top | thrown down first, then falls up to the roof | the mid-air green orb, never seen |
| 7 | ship heights | rest on floor, hold to roof, slide on a block | y 15 / ~272 / ~118 / back to ~20 | Stereo Madness ~0.5 low, Back On Track ~1 block high |
| 8 | ship corridor | fly it naturally | (sim needs many fast presses in such corridors) | is the ship's hover/ceiling right |
| 9 | ship entry RISING | no press: a pad throws the cube up through the ship portal | vy 11.9 -> 5.8 (halved): y ~115 at the 1st ruler, ~103 at the 2nd | how much rising speed a ship keeps on entry |
| 10 | ship entry FALLING | no press: the pad's arc comes down through the ship portal | vy -8 -> -4 (halved): y ~34 at the 1st ruler; 0.25 (gdsolver's plans) would give ~56 | the rejected falling-entry factor: plans vs the user's runs |
| 11 | mini step | try to jump onto a step 56 up | cannot land (feet peak 40.7, needs 41) | the mini jump and snap (Dash 106) |
| 12-15 | UFO, robot, spider, swing | free flight beside rulers | flap 7; hover 67 ticks; teleport; flip a tick after a press | the unmeasured modes |
| 16 | touch trigger scale | walk under two invisible touch triggers | the scaled (y 1.2) one raises its block, the unscaled one not | touch box = 30 x scale (Dash fix) |
| 17 | collision trigger | watch a block drop onto another | nothing (collision blocks not modelled) | does 1815 spawn its target group |
| 18 | stop trigger | watch a rising block | stops halfway (y ~163) | stop acts on moves fired by triggers in its group |
| 19 | dual ball | two balls | band 8 blocks: player 2 at y 225 | the assumed ball dual band |

## Trigger firing point (2026-11-24)

Gameplay triggers (move, toggle, spawn...) fire when the player's CENTRE passes their x. gd-visuals saw a colour
trigger fire when the FRONT edge (x + 15) reached it (Hexagon Force's colour 1 at x 945, frames aligned by
video.level_t), and the viewer's look triggers now fire there. Front-edge firing for the sim's triggers was tried on
gdsolver's real-game plans: nothing gains and Dash falls from 81 to 40 blocks, so the centre stays (colour and
gameplay triggers may well differ in GD).

## Landing buffer (2026-11-24): GD has none -- the button's level, one tick of grace

GD's rule (lib/physics.js `LB_GD`, the default since 2026-11-24 evening): the cube jumps on landing only if the button
is down -- `m_jumpBuffered` is a LEVEL, set by pushButton and cleared by releaseButton, and the jump gate reads it twice
a tick, so a press still down on the tick before the first grounded tick jumps (one tick of grace). A press made in the
air and released before the landing does NOTHING, however close to the landing.
- Source: gdsolver's `dp/src/dp/step.hpp` (the cube's gate in updateJump is `m_jumpBuffered && m_isOnGround && !spider &&
  !dashing`, read off GD's disassembly; their rig: a cube held down bounces forever, a robot jumps once).
- The user's game, measured with no sim (`tools/landbuf.js` on GDLM 67, 18-58-15.mkv, the raw logger, K from take-offs):
  every press RELEASED in the air before a landing left the cube on the ground -- 14 / 20 / 44 ticks before the landing
  (released 2-18 ticks before it); every press HELD through the landing jumped (0-26 ticks before). In the frames: video
  78.00-78.23 s the cube sits on the ground after the press at 77.885 (released 77.932, landing ~77.942) until the next
  press at 78.20; framecheck's rows show it again at level time 1.22 s of the 76.2 attempt.
- REPLACED: the long buffer of the morning (a press while falling kept until landing, one while rising 40 ticks).
  It came from two Clutterfunk moments in 02-45-05.mkv (taps 36 and 53 ticks before landing) whose clock was a death-%
  fit -- the same kind of fit that was 0.4 s off on 18-58-15 (see "Frames: the video as the reference") -- and from
  gdsolver's plans getting further with it. The plans' gains were covering something else: each of them is a 2-tick tap
  4-21 ticks before OUR landing tick (Polargeist block 907.7: 7 ticks; Dry Out 414.5: 10; Can't Let Go 303 and 461.7:
  9 and 21; Jumper 210: 8; Time Machine 331: 6; Clutterfunk 286: 4), which GD only jumps on if the cube is already
  down, i.e. OUR CUBE LANDS 4-21 TICKS LATE (or lands somewhere else) at those spots. Open: find why -- a landing
  height, a snap, a slope or block top the sim reads differently. tools/tas.js and the lbdiff scratch in the session
  notes find the spots.
- Cost: tests/tas_progress.js back to the pre-buffer marks (3: clear -> 909, 4: 574 -> 415, 6: 489 -> 303, 7: 248 ->
  210, 8: 362 -> 333, 11: 294 -> 288). The 37 recorded attempt lines replay as before (one GDLM 60 line was already stale).
- THE LANDING TICK: a cube that landed on the ground plane last tick cannot jump this tick, so a held cube bounces every
  104 ticks, not 103. gdsolver's rig (a press at t60 held: jump t61, land t164, jump t165) and the user's held bounce
  through GDLM 67's stations 1-4 (244.2 s: hops every 104-105 ticks; the sim drifted a tick a hop and fell in the orb
  pit). framecheck: 114.13 now follows the video to 11.2 s (was 2.4 s), 244.2's height error 18.6 -> 10.0 units rms.
  Ground only: the same wait on block landings broke an official attempt line (lv21, 02-33-44 @186.7 s); gdsolver's
  plans reach the same blocks with or without it. `GDLM_LANDWAIT=0` / `=all` for measuring.
- `GDLM_LANDBUF=old` gives the long buffer back, `=<ticks>` a countdown, for measuring only. tests/mechanics.js checks:
  a tap released 14 ticks before landing does not jump; a press held through does; one released on the first grounded
  tick still does.

## Upside-down cube and the ground (2026-11-24): in the sim since 2026-11-26 (vy < -4 kills; the cut is a guess)

The robot too (2026-11-26): the auto lab v12 probe log, tick 4742, a flipped robot at vy -7.27 dies touching the ground with
no object, where the sim had it land; lib/physics.js now applies the same cut to the robot. Ball, spider, UFO: not seen.

The released ship upside down (2026-11-26, auto lab v13 probe log, tick 17297): after a gravity portal a flipped ship at
vy -1.22 pulls 0.069 a tick (0.8, the falling factor), not 0.103 (1.2): the falling threshold is mirrored upside down, as for
the UFO. **That is GD 2.2's level setting "Fix Gravity Bug"**, not a general rule: with it, PlayerObject::playerIsFallingBugged
tests -2g < vy upside down instead of 2g < vy (gdsolver dp/upd.hpp fallingBugged, PlayerObject +0x561; their mklevel.py
saw the same 0.069 vs 0.103 split between a rig with the kA31..kA45 flags and the official levels). Six logs of levels
without the flag (Evgeni's ToE2, Hexagon Force, Deadlocked runs, the auto play area; ~2000 released flipped-ship ticks,
both sizes) all pull 1.2 below 2g; the v10 / v13 lab levels carry our DEFAULT_HEADER with the flags on and pull 0.8.
So the world gets `fixGrav` from the header and only then the ship (held or released) and the UFO mirror the threshold
(`GDLM_FIXGRAV=0|1` forces it; `GDLM_SHIP_FLIP=old`, `GDLM_UFO_FLIP=old` turn the mirror off). The KEY is ASSUMED to be
kA32 (GD's level-string docs, from memory): every other kA flag our header writes would fit these logs as well. To pin it,
a lab pair of one flipped-ship station with only kA32 differing. Ungated, the mirror broke ToE2 attempts 1-2 (the sim
died at 3224 and 8401 instead of 4069 and 8403).

GDLM 67's green orb station (18-58-15.mkv) throws the cube down with gravity flipped; it then meets the flat floor head
first. The game: attempts 58.2, 98.4 and 158.3 burst on the floor (no hazard near, frames 68.45-68.70 and framecheck's
paths: 58.2 died the frame its box reached the ground line, falling ~5.4 units a frame); attempt 114.13 came down slower
(~1.5 units a frame), touched (14.7 units, tracking error ~1) and bounced up alive -- the user went on to 95.8%.
- The sim never kills it (the ground clamps a flipped cube). Two rules were tried and taken out the same evening:
  "dies on contact" (gets 114.13 wrong) and "dies when its 9x9 inner box reaches the ground" (gets the three deaths
  wrong). A speed threshold between ~1.5 and ~5.4 units a frame fits the game, but the sim's impact speeds do not
  separate the cases (158.3 and 114.13 both hit at vy -0.81 in the sim, while the game's differ): the sim's green orb
  throw is off first -- the game's cube drops ~5 units further in the first 3 frames after the orb (58.2: 59.7 vs 65.1).
  Next: calibrate the green orb's throw (a lab station: green orb from rest, ruler), then fit the threshold.
- gdsolver: "GD's ground plane blocks the player from BELOW whatever its gravity is" (an inverted mini ship held at
  99.000); no flipped-cube floor death in their notes. Their 22 plans have one flipped-cube floor touch (Dry Out block
  291.6, one tick at vy 0).

## Frames: the video as the reference (2026-11-24)

The user (via the coordinator): "we recorded everything, have the video but never compared? it must be useful for
hitboxes and realism". Two tools read a recording frame by frame (tools/track.py: the lime icon, the ground line,
`--cols` white bars; real frame times):
- `tools/framecheck.js <level> --video <mkv> --inputs <raw csv> --at <bar start>` -- one attempt against the sim:
  1. K, the input log's clock vs the video's frames (video t = log ms/1000 + K), from ground take-offs; searched only
     within the files' own start times (the log header's UTC start vs the video name's second, minus a 0.2-1.3 s capture
     lag). 18-58-15: K = 0.374 from 10/10 take-offs; 0.40 when the take-off is placed from the icon's motion (the
     first moved frame is already ~3 ticks into the jump) -- use --k 0.40 there.
  2. D, the attempt's level start vs the progress bar's start, from GEOMETRY: white bars at known level x (GDLM 67
     v2's rulers) give the icon's level x in every frame where one is in view; 76.2: D = -0.534 s from 10 sightings,
     x vs sim 1.0 unit rms. Levels without bars fall back to a height fit (weaker; Clutterfunk's lime scenery defeats
     it). Next: any static object as a marker (spikes, block edges), not only white bars.
  3. the path (height above the ground line and x, video vs sim, per second and the first parting) and the end
     (the gap from the sim's player box to the nearest hazard at the video's last frame).
- `tools/landbuf.js --video --inputs --from --to [--k]` -- every landing with a press before it: how long before, released
  or held, and whether the game jumped. No sim at all.
WHAT THIS CHANGED: replay_run.js's clock (one offset per recording, pinned on a clear, then +-60 ms per attempt, judged
by the death %) was 0.4 s off on 18-58-15 and still showed "10 of 17 agree" -- most deaths are at spots where any clock
gives the same %. A death-% fit is not a clock: before a recording's attempts are used as physics evidence, check K
from take-offs (framecheck prints it). The morning's landing buffer was built on exactly such a clock.
Open: framecheck into the pipeline for every recording (after replay_run), bars or object markers for official levels,
hitbox gaps at every death and near-miss (the "end" lines are the start), ship / wave heights where the ground is out
of view (camera fit with gd-visuals).

## Handoff: the solver session (2026-11-24, archived; the area goes to gd-physics)

The solver session (official re-solves, human routes, dual / moving objects, labs GDLM 63/67/68) stopped here:
- **Official levels after 46672ee (no landing buffer): re-solved 2026-11-25 by `tools/mains.js run`** (DIFFICULTY.md
  "Main levels kept current"): 20/22 clear again with a human route, as before the change; Deadlocked and Dash still die
  at the same spots (open physics leads below). `tools/mains.js` now keeps them current by itself after physics changes.
- **Fingerdash (21) viewer route:** its `--replan` took 42 min on 2026-11-25 (budget 10 min per plan pass); the route clears.
- **Deadlocked: BEATEN (2026-11-25).** The teleport-spike stretch at block 695 was the teleport portal's box: the user's
  hitbox-on practice video (GD claude-rec 2026-11-24_00-33-07.mkv, ~196.33 s) shows the ship come out of the 747 at
  x 20887 ~10 units further right than the sim's, clear of spike 421. 747's box is now 25 x 90 centred 12 right of the
  object (gdsolver's 25 x 90, OpenGD's +12 offset); the resume then cleared it (32 min). Its route still has 33 ms gaps
  (`humanroute.js 20`).
- **Open physics leads (not solver gaps):** Dash -- ROTATED GAMEPLAY: in the sim since 2026-11-25 (section "Rotated
  gameplay" above); the route passes the first turned stretch. gdsolver models it (dp/src/dp/frames.hpp, cli --rotgameplay; notes at
  step.hpp "lv22 t=1,745", "t=1,753", "t=1,813"): the next big physics piece for Dash. (The older note here -- a ball
  bounce off moving platforms -- was about a later stretch the sim reached only by a wrong spider landing.) Theory of
  Everything 2 -- a UFO release-press gap of 33 ms in the route (`humanroute.js 18`): an inhuman spot, so a physics
  lead if no other route exists.
- **Labs:** GDLM 67 (`tools/lab67.js`, 19 stations; the user played v2 = commit 29303a4; stations 1-3 notes now predict
  no jump for a tap released in the air; v3 built in the tool but not rebuilt / not installed). GDLM 68 camera lab
  (`tools/lab68.js`, 14 stations, ~103.5 s, 5-wide stairs after the user's "luck based" note; installed by the
  coordinator). Both: `node tools/labNN.js --check`; rulers are art's ground-colour poles (no white bars: the
  physics session reads the poles in video). GDLM 63 rebuilt with its marker on channel 1014 (channels gate ok).
  The saved routes of 67/68 want `tools/solutions.js` again on today's physics.
- **Tools left:** `tools/stuck.js` (solver vs physics at a stuck spot; `--sweeps --trace`), `tools/humanroute.js`,
  `tools/shipstyle.js` (user vs route ship flying), `tools/pathpic.js` (before/after route pictures), `tools/profsum.js`,
  `lib/runcache.js`. Good numbers: `tests/runcache.js` 340 runs 7.7 s -> 0.4 s; `tests/tas_progress.js` all ok
  (21: 54.3, 22: 81.4 blocks); `tests/natural_tap.js`, `tests/mechanics.js`, `tests/heavy.js` pass; ship routes
  1.7-2.2 presses/s (the user flies 1.5-1.7/s), 0% taps under 75 ms.

## Objects

- Hitboxes from OpenGD's 2.1 table, overridden in `lib/objects.js`; GD 2.2's decoration list
  (`lib/objects_gd22.js`) beats it. Scale (keys 32, 128/129) grows boxes and saw radii.
- Off-grid rotations: hazards are tested by their turned box (SAT, `obbHit`); solids by the box
  around it.
- Saws: player box against the circle (GD's playerCircleCollision branch B).
- Orbs: touched at the end of either of the last two ticks; rotated orbs use turned boxes.
- Slopes: floor slopes, and ceiling slopes (flipped / half-turned) for the ship and an upside-down
  player. A slope turned a quarter is the slope whose square corner the turn puts where it lands
  (plain "/" has it bottom-right; turned clockwise BR -> BL -> TL -> TR), so 1338 flipped up and turned 90
  rises to the right; its turned hitbox gives the rise (a 2:1 slope turned is 1:2). Until 2026-11-23 they
  were blocks, a wall (Dash's swing part stops at 1744 turned 90, the difficulty session). UNCHECKED in
  the game: GDLM 60's station 3 walks up and down two of them (tests/mechanics.js).
- Found by plans: 143 one-way platform; 661-664, 1903-1905 slabs; slab 40 centred; 5/73/80 scenery;
  a blue pad flipped with key 5 faces down.

## Triggers

`node tools/triggers.js` over the official levels (2026-11-22): most trigger ids are looks only --
colour 29/30/899/105/221/744/915/900, pulse 1006, alpha 1007 (still collides), enter effects 22-28 /
55-59, shake 1520, animate 1585, camera 1913/1914/1916/2015/2016/2062, trail 32/33.

| trigger | id | keys | in sim | checked |
|---|---|---|---|---|
| move | 901 | 51 target, 28/29 x/y (30 = a block), 10 duration, 30 easing, 85 rate | yes, all easings | lv22: cube lands on blocks a move raises, jumps on the plan's tick |
| move to target | 901 + 100 | 71 target group (138: player 1), 395 centre group, 101 axis (1 x, 2 y) | yes (target read when it fires; 397 dynamic: no) | tests; GDLM 63 station 5 |
| move lock to player | 901 + 58/59 | 143/144 mods (not read) | yes | Spire's solve (community) |
| toggle | 1049 | 51, 56 on | yes | plans (lv19, 22) |
| spawn | 1268 | 51, 63 delay | yes | plans |
| rotate | 1346 | 51, 71 centre group, 68 deg + 69 turns, 70 lock | yes (hitboxes turn too) | fires in lv22; no plan depends on it yet |
| stop / pause / resume | 1616 | 51 = group of the triggers; 580: 0 stop, 1 pause, 2 resume (ASSUMED key; 535 control ID: no) | yes | tests; GDLM 63 station 6 |
| count / instant count / pickup | 1611 / 1811 / 1817 | items | no (lv21 at 630, lv22 at 95) | - |
| scale | 2067 | 150/151 | no (lv22 from 70) | - |
| on death | 1812 | | no | - |
| follow | 1347 | 71 followed group, 72/73 x/y mods, 10 duration | yes (ASSUMED keys) | tests; lv22's one moves no hitbox |
| multi-trigger | key 87 on any trigger | | yes: fires again each time it is spawned | tests; GDLM 63 station 7 |
| collision block / trigger, area triggers | 1815/1816, 3006+ | | no (no official level uses them) | - |

Firing: x passing the trigger's x; touch-triggered (11) when the player's box meets its 30x30;
spawn-triggered (62) only from a spawn trigger. Move "lock to player" X/Y (58/59): for its duration
the group moves by the player's own motion since the trigger fired, then stays (plus any dx/dy);
UNCHECKED against the game, added 2026-11-23 for Spire (community 128630430), whose upside-down
cube rides under a roof locked to the player: its solve went from block 112.7 to 327.6 (the next
stop is another "sky" death near the ball part, not looked at). Not modelled: the player carried
sideways by a moving block, scale (2067), follow player Y (1814), count/pickup, collision triggers,
keyframes and the 2.2 area triggers (no official level moves a hitbox with them).
The viewer draws moved, turned and switched-off objects where they are at each moment (GD.posedObjects).

## Moving objects (2026-11-23; owner: the dual/moving-objects session)

Hazards, solids, orbs, pads and portals in a group a trigger reaches are "dynamic" (w.dyn): every tick
`nearDyn` puts them where the triggers have them now (moves, rotates about a centre, follows, toggles), so
they collide at their moved places at 240 Hz. Everything else stays in the static column index.
How a trigger is live: the first firing is `s.fired[k]` (the tick it acts from); a multi-trigger (87) that is
spawned again gets `s.fired["k.n"]`, its n-th repeat, each moving the group by its own amount, so loops add
up. A repeat whose tick is still ahead waits in `s.pend` (a spawn loop with a delay cannot run away; a cap of
64 repeats per trigger). Stop freezes a firing for good; pause holds it, resume carries on, and the paused
time does not count (`s.paused`, `s.psum`). A trigger inside a group a toggle switched off does not fire when
the player passes or touches it (spawned ones: not checked). Move to target measures its distance when it
fires (`s.tgt`), from the centre object (395, or the group's first object) to group 71's object.
Follow adds the followed group's own movement since it fired, times 72/73, until its time runs out.
Added 2026-11-23 (multi-trigger, move to target, follow, pause/resume, toggled-off triggers), all from the
2.2081 decompile's save keys (EffectGameObject::getSaveString) except 580 (stop mode) and 72/73 (follow
mods), which are ASSUMED; tests/mechanics.js pins each; GDLM 63's stations are for the user's game.
Alpha (1007): looks only, an object at alpha 0 still collides (the decompile's opacity actions touch no
collision); toggle is what removes a hitbox.

Which official levels move hitboxes (`node tools/movers.js`; counts of triggers whose target group holds
hitboxes): Geometrical Dominator moves 30 (+2 locked to the player), Deadlocked 58 (+3 locked, 17 toggles,
it moves portals too), Fingerdash 107 moves and 48 rotates, Dash 67 moves, 6 rotates, 10 toggles, 13
multi-triggers, 1 move to target, 1 scale. Electroman, Clubstep and Theory of Everything 2 use none (their
2.2 versions move only decoration, if anything). The stops do not move with this: Dash stops at block 220
on a static block (groups 183/191 there move only decoration), Fingerdash at 55 on a saw no trigger moves,
Deadlocked at 695 on a static spike; the re-solves on the new physics are listed below as they finish.

Lab: GDLM 63 (specs/63_dual_movers_lab.json, made by tools/lab63.js): 1-3 dual, 4 a rising platform,
5 move to target, 6 pause/resume, 7 a multi-trigger loop, 8 a toggled-off trigger. Each station's note says
what the sim expects; 9-12 orb buffering (the physics session's question).
**Played 2026-11-24** (GD claude-rec 2026-11-24_02-13-32.mkv with the input log; physics session, tools/replay_run.js):
both normal-mode clears replay to the end in the sim with the user's own presses (one clock offset, 842 ms). A station
only CONFIRMS a rule when the user's real inputs there would have died under the other rule (attempts in
local/attempts/gdlm_63_dual_and_movers_lab.jsonl; clear 1 made no press from block 88 to 151, clear 2 jumped at 6-7):
- confirmed: 7 multi-trigger loops (clear 1, no press: fired once, the spike would sit 20 up and kill the cube on the
  floor); 8 a trigger in a toggled-off group does not fire (clear 1, no press: else the spike lands on the floor);
  3 the solo portal keeps the player that touched it (keeping player 1 leaves an upside-down cube with no roof,
  flying out of the level; the game went on normally).
- consistent but not settled by deaths: dual spawn and mirroring, the band's height (player 2's roof spike is
  survived at any roof a little higher), 2 gravity portal in dual, 4 riding a rising platform, 5 move to target
  (the user jumped there anyway), 6 pause/resume (the spike is clear paused or not). Settling these needs the
  frames: player 2's height on the roof, the spike positions (tools/track.py, the physics session's tracker).
- open: 9 and 11 (the user tapped at the orb instead of holding from the jump: the hold-buffer question stays; next
  lab: a roof right after the jump's apex so a second press cannot reach the orb), 12 (the press reached the orb).

## Dual (lib/dual.js, 2026-11-23; owner: the dual/moving-objects session)

Two players, one button. A level with dual portals (286 on, 287 off) steps through `GD.dualStep`; a level
without them runs exactly the old code (`w.hasDual` false). Player 1's fields stay at the top of the state
(`s.y`, `s.mode`...), player 2's are in `s.p2` (a fresh object every tick); x, tick, speed, triggers and the
band flag are shared. The viewer draws both players and the band lines.

What GD 2.2 does, read from iArtie's 2.2081 decompile (`local/src/GD-2.2081-Decompiled`, a clone for
reading only; GJBaseGameLayer `toggleDualMode`, `playerWillSwitchMode`, `flipGravity`, the DualPortal /
SoloPortal cases; PlayerObject `copyAttributes`):
| rule | source | in sim | checked |
|---|---|---|---|
| dual portal: player 2 = a copy of player 1 (place, mode, size, y speed), gravity flipped (y speed halved) | toggleDualMode -> spawnFromPlayer (body not in the decompile; copyAttributes is) | yes | tests/mechanics.js |
| same input for both; either death ends the run (`why` "player 2: ...") | update loop steps both | yes | tests |
| mode and size portals switch ONLY the player touching them | switchToFlyMode(player) / togglePlayerScale(player) | yes | tests |
| a player switching into the mode the other is in takes the other's opposite gravity (ship, cube, ball, UFO, robot, spider, swing; NO wave case in the decompile: gap or real, unknown) | playerWillSwitchMode | yes | - |
| gravity portals, blue/green orbs, gravity dash orbs, blue pads flip the other player too while both are in the same mode (they stay mirrored); ball taps, swing flips, spider teleports flip only their own | GJBaseGameLayer::flipGravity vs PlayerObject::flipGravity | yes | tests (portal) |
| solo portal: the player that touched it goes on (player 1 copies player 2 when player 2 touched it) | toggleDualMode(false) | yes | tests |
| in dual every mode has a floor and a roof | checkCollisions: `isFlyingMode = ... || m_isDualMode` | yes | - |
| band in dual: centred on the DUAL PORTAL for the whole dual part (a mode portal in dual changes only its height); height ASSUMED the larger of the two players' bands, cube/robot 300 like the ship | processCameraObject: in dual the camera object is the dual portal (m_lastActivatedPortal2); updateDualGround's body is not in the decompile | yes | centre: Hexagon Force (re-centring on a player's ship portal opened a gap over its corridor at 432; the solve flew over the spike roof and died at 499); height NOT checked |
| speed: shared (both players are at one x) | - | yes | - |
| camera: centred on the band (animateInDualGroundNew, tween 0.4 s) | decompile | viewer only | - |
Not modelled: two-player mode (level setting, separate buttons), start-in-dual (level setting), the
cube hitting the band roof head-first (treated as safe, like the ship).

Solvers: the state key has player 2's part (`GD.dualKey`); portal requirements (no-skip) count either
player's used objects and either player's distance; dual levels go to the sweep (the exact cube solver
knows one player).

Official levels (dual portals): Hexagon Force 351.7-503.4 (cube), 640.3-709.8 (mini ball), 944.8-995.2 (mini
ship); Blast Processing 512.3-554.0 (wave); Deadlocked 859.2-910.9 (wave). Before this, 286/287 were
"unsupported" (a death on touch, and NOT on the no-skip list), so Hexagon Force's "beaten" and Blast
Processing's 78% went around every dual portal: secret ways. Their saved routes, replayed with dual:
Hexagon Force dies at 362.8 (player 2 on a spike), Blast Processing at 564.4.
Re-solved with dual (2026-11-24, physics 1d59689, `difficulty_solve --resume`, checked by tools/skips.js and a replay):
- **Blast Processing: beaten** (was 78%, and that 78% went around its dual): all 18 portals taken, 0 of 46 orbs/pads
  skipped; two players from block 511.6 to 553.3 (wave dual).
- **Hexagon Force: beaten** (2026-11-24, physics 23634a9, a full solve from the start: 568 s solve, 25 min with the
  viewer's route): all 37 portals taken (11 of 75 orbs/pads untouched, none of them a skipped portal), through all
  three dual parts: 350.7-502.4 (cube, then ships), 639.5-708.9 (mini ball), 943.9-994.3 (mini ship); ends at
  block 1035.5. On 1d59689 it had stopped at 553.8 (a decoy orb, fixed by physics 36ca0ac); a `--resume` after the
  landing buffer (fee98db) died at 459.8 in the dual ships because the kept prefix was planned without the buffer,
  so after a physics change that alters cube timing, solve dual levels from the start.
- Deadlocked's wave dual (859-911) is past its current stop (695); not reached yet.

### Solver and trigger fixes from the official re-solves (2026-11-24)
- **"A portal that changes nothing" is judged at the portal's centre** in the sweep, as skipCheck judges it. Judged 15
  units past its right edge, a ball flipping gravity in Electroman's lower lane (block 804) had normal gravity there:
  its untaken normal-gravity portal passed the sweep, won, and the final skipCheck rejected the whole solve. Electroman
  is beaten since (all 21 portals). `tools/stuck.js <n> --x <units> --sweeps` found it (the real solver from the same
  start with one setting changed at a time: only `allowSkips` beat it, so the no-skip bookkeeping was the cause).
- **A touch trigger's box is 30x30 times its scale** (32, 128/129). Dash's touch spawns on its invisible platforms
  (1268 at y 195, y scale 1.1) were missed by a mini cube standing on the platform (centre 24 above; the unscaled limit
  15 + 9): the next platform never rose. With it, routes that take the mini portal get to block ~130 (they died by
  116.5). Dash's spike group 265 also uses a **collision trigger** (1815: blocks 80 = 1 and 95 = 2 collide -> spawn
  group 545, a stop on the group's drop): collision blocks/triggers are not modelled; here the platform touch spawns
  the same stop (group 540), so it matters only for timing.
- **Orbs, pads and dash orbs may be skipped** ("No secret ways" above).
- `tools/humanroute.js`: every official route's busiest second, shortest gap and holds through jumps. Ship stretches
  in Stereo Madness (358-386: 14-18 presses a second), Back On Track (459-510) and Polargeist (342-378: gaps 25-46 ms)
  clear only with inhuman input: the known ship-height mismatches (physics leads, not route bugs).

## Rotated gameplay (id 2900): IN the sim (2026-11-25, first version)

Only Dash (lv22) of the 22 main levels uses it: 20 triggers from block ~71 (before this, Dash stopped at block 75). The
rules are gdsolver's (github.com/gdsolver/gdsolver, MIT; dp/src/dp/frames.hpp, step.hpp, level_loader.hpp: GD's
disassembly and their mod's dumps on lv22), not yet our own recordings. Code: lib/physics.js "rotated gameplay";
test: `node tests/rotated.js`.
- **Frames.** GD turns the gameplay, not the world. A state is stepped in its FRAME's coordinates (s.hd: 0 = +X, 1 =
  -X "reverse", 2 = -Y, 3 = +Y), against the level turned into that frame (`frameWorld(w, hd)`, built once per frame and
  kept on the world: objects moved, mirrored (flipX toggled, rotation negated) and turned a quarter, move-trigger
  offsets and touch boxes turned too). So every rule stays "x is the travel, y is up". GD's local up is +Y for the two
  horizontal headings and +X for the two vertical ones (gdsolver: frames 1 and 3 both have up = +X), so 1 and 3 are
  mirrors, and s.grav / s.vy keep meaning GD's upside-down flag and y speed. `GD.worldXY(s)` = the world position.
- **Keys** (settled by gdsolver against GD's members): 167 = travel direction (gnddir: 1 up, 2 down, 3 left, 4 right;
  this, not the rotation, picks the frame), 166 = gravity direction (mvdir, same numbers: upside down when it points
  along the new frame's up), 169 edit velocity with 583 (velocity mod Y; 169 without 583 = 0), 584 override, 170
  channel, 171 change channel, 173 target channel, 172 channel only (switch, no turn), 115 ord.
- **The turn** (PlayerObject::rotateGameplay): the world point carries over; onto the other axis the y speed becomes
  583 x the travel speed (GD's local sign); a turn that only reverses keeps it (halved if the gravity flips); ground
  contact and the flying band end (floor = the ground again in a horizontal frame, none in a vertical one).
- **GD's trigger queue** (checkSpawnObjects): the triggers the player passes sit in per-channel buckets (170), each
  sorted once (ord, then the channel's axis from the first 2900 that switches to it), and each tick GD walks ONLY the
  active channel from its cursor, stopping at the first element not passed -- along world x, or world y while the frame
  is vertical, backwards when the channel's reverse bit (set by a switch whose travel is -X / -Y) is on. So Dash's move,
  spawn and toggle triggers inside turned stretches fire by their channel, and channel 0's wait. A level with no 2900
  and no channel keeps the old plain x walk (T.byX): nothing changes for the other levels (tests/tas_progress.js,
  `mains.js status`: 21/21 still clear). The turn applies at the start of the tick after the crossing (= GD's "after the
  move, before the button"), so a spider tap on that tick is taken in the new frame.
- **Progress.** x is not "how far" in such a level, so states carry s.d (distance travelled) and tools use
  `GD.progressX(s)` (= s.x elsewhere): the sweep's furthest state, difficulty_solve's resume points and dieX.
  Run length: `GD.maxTicksOf(w)` (3x the usual for a level that turns). The no-skip rule there counts a portal as passed
  when the player crosses it in its frame within 150 units across (skipsTurned / skipCheckTurned).
- **Trap portals** (lib/physics.js TRAPS, solveSweep's fallback): Dash's 1x speed portal at x 2745 (beside the cube
  portal) is not a requirement: at 1x the mini cube meets spikes a move trigger lowers into its lane at x ~3460, at 3x it
  passes first; gdsolver's real-game plan goes under it. When a strict sweep finds no way, it sweeps again ranking skips
  last; a route found that way names its skipped portals in `trapSkips` -- check them against a real-game plan, then
  add them to TRAPS. Cost: a sweep that fails runs twice, and the second (skips allowed) is much wider: Dash from block
  67 took 44 min in all against ~40 s for the strict one alone (2026-11-25). `noTraps: true` skips it.
- **Checked so far:** gdsolver's real-game plan (tools/tas.js 22) goes down Dash's first turned stretch and back with
  GD's own landings (world x 2143.5 after the first tap, the turn back at y 135), but only with two spider presses
  moved 3-5 ticks later (`tr22`-style nudges): our tap comes ~2-3 ticks before GD's relative to position there, while
  earlier spider taps in the same plan need today's timing (one tick later dies at block 40 on a saw). OPEN: the spider's
  input timing vs GD; tas_progress stays at 75 until it is understood.
  `node tools/tas_trace.js 1740,1790 22 --nudge 1742:3,1744:3,1906:5,1908:5` shows it.
- **Block ~127 (fixed 2026-11-25):** not the move units or the touch box -- a "flip on head hit" modifier (2866) locked
  to the player there; see "Gameplay modifiers" below. With it and the time warp at x 4535 the nudged plan goes on to
  block 179 (x 5366), where it dies in a swing stretch (swing physics, open).
  Our solver (difficulty_solve 22 --resume, 2026-11-25, 2.0 h) gets further than the plan: through that swing to the
  second turned stretch, where a swing turned to travel +Y dies on a block 30 ticks after the turn (world 6746, 266).
- **Not modelled yet:** touch-activated 2900s (none in Dash), a 2900 inside a toggled-off group, the dash orb's angle
  clamp in turned frames (gdsolver --dashframe3), the 2899 options trigger (disables P1 controls; consumed, no effect),
  moving objects' lock-to-player / move-to-target state across a turn, the camera turning with the gameplay (the viewer
  draws turned stretches in world coordinates, unturned).

## Start settings from the level header: IN the sim (2026-11-25)

GD 2.2081 LevelSettingsObject reads kA2 start mode (0 cube, 1 ship, 2 ball, 3 UFO, 4 wave, 5 robot, 6 spider, 7 swing),
kA3 mini, kA8 dual, kA11 flipped gravity; GJBaseGameLayer::setupLevelStart applies them: flip, dual (player 2 the other
way up), mini (both), then the mode with no portal. lib/physics.js startOf() / startState0(); test `node tests/start_settings.js`.
Before this only kA4 (speed) was read and every level started as a normal cube: Bloodbath (community 10565740, kA2 1)
died at block 18 as a cube. No official or GDLM level sets any of them, so no saved route changes.
- ASSUMED: the flying band of a portal-less start sits on the ground (floor 0, ceiling the mode's band); in dual it is
  the dual band at the start y. Not measured in the game.
- Not read: kA20 reverse gameplay, kA28 mirror (view only), kA2 values in platformer levels.

## Gameplay modifiers (2866, 1813) and the time warp (1935): IN the sim (2026-11-25)

From gdsolver's reading of GD's disassembly (GJBaseGameLayer::collisionCheckObjects, PlayerObject::didHitHead) and
their dumps on Dash; code in lib/physics.js, objects in lib/objects.js; `node tests/modifiers.js`.
- Touching a modifier sets a per-player counter to 2; PlayerObject::update counts it down every tick (s.fhArm, s.najArm).
- **2866 flip on head hit:** while armed, a head that reaches a solid flips gravity and the player stands on that
  ceiling (y = face - half, on the ground at once; GD: Dash t=2,748 -> 2,749). **1813 no auto jump** ("J block"): armed
  with it, that flip also drops the held button -- no jump off the ceiling until it is released (s.najHold). Fingerdash
  has 11 1813s and no 2866: nothing changes there. Dash has one of each in group 59 at (3735, 165), which a move trigger
  locks to the player for 2 s from x 3735: a red pad throws the mini cube into the ceiling at x ~3790 and it lands on
  it upside down (before this the sim killed it there: block ~127). OPEN (gdsolver): GD flips 42 ticks after arming,
  where the counter says 2 -- there is a second reader of the arm in collidedWithObjectInternal not modelled.
- **1935 time warp** (key 120 = the time scale): from the tick after the player's x passes one, the x advance, the y
  move and the velocity change of each tick shrink by that factor (a scale above 1 does nothing to them: GD speeds the
  scheduler instead). Dash: 0.2 from x 4535 to 4615 (gdsolver: dx 1.950 -> 0.390, dvy 0.215 -> 0.043). Read off the
  player's world x, in levels that have one (w.warps); not a channel-queue trigger here (Dash's sit in channel 0).

## Not in the sim yet (the game has it)

Modes/portals: mirror. Teleport portals (747) are in, unchecked: same x, speed kept, exit height = portal y + key 54 along the portal's turned axis (54 x cos(rotation)), but the full 54 straight up/down when key 55 is set or the portal is turned a quarter (90/-90/270: cos would make it a no-op; Deadlocked's ball part 441-561 passes only so, neither "no move" nor "x moves by 54" does -- "angle mod 90" fits the same cases) (fitted on Deadlocked, 2026-11-23: its -53 degree portal at block 76.5 needs the turned offset to pass under a spike; its -46 degree portal with 55 at 360.8 lands exactly on the gravity + speed portals 224 below; whether GD also moves x is not known; smooth teleport and the 2.2 options 345+ not modelled); first used by Deadlocked at block 77, Fingerdash 205, Dash 435. Triggers: count/pickup items,
scale, follow, on death, collision blocks, area triggers, gravity trigger. Others:
keys and user coins (collectables only), start positions (levels always start at x 0), practice
checkpoints, speed portals touched mid-air at a slant, force blocks, platformer mode, dash orbs'
unknown props 586/588, spike slopes.

OPEN, found by the community demon study (2026-11-25, DIFFICULTY.md "Community demons"):
- **An upside-down wave on the band floor meeting a floor slope goes UNDER the ground.** Problematic (7116121), dual
  wave at 2x, tick 6655, block 325.9: player 2 (gravity -1) slides on the dual band's floor at y 10, meets a rising
  45-degree slope (id 305, y 0..30) and the slope code seats it on the slope's underside at y -5 (onSlope, grounded):
  below the ground. The slope code takes the slope as the surface facing the player's gravity. What GD does there is
  not known (slide up the slope as a right-way-up wave does, or die head-on). Until then routes through upside-down
  waves along floor slopes are not trusted (Problematic's 13/17/33 ms wave taps at blocks 321-323 lead into it).
- **Slopes turned 90 degrees and a ship on them** are unchecked: Bloodbath (10565740) dies at block 85.5, a mini ship
  into a 22-degree slope turned 90 degrees (id 311) beside a blue pad turned 119 degrees; every state dies there.

## The probe mod: the game's own state per step (2026-11-25)

The GDLM Probe Geode mod (GEODE.md) plays our saved route inside GD 2.2091 on exact steps and logs the player every
step. `node tools/probe.js result [n]` compares a log with our sim's run of the same route. What the first logs show
(GDLM 62 low end lullaby: 2 clears, 102 presses; GDLM 44 hellgate: 2 runs, both died at x 6638 where our sim clears):
- **What is per step:** the player's `m_yVelocity` changes every step (240 Hz), the level time too. Its position
  (`m_position`) changes only once per 60 fps frame, and at a frame's first step it shows the sim's state of the step
  before; GameObject's `m_positionX/Y` doubles stay 0 on the player. So timing is read from vy, positions per frame.
- **The true per-step position (mod v0.5.0, 2026-11-26):** the player NODE's position (`getPosition()`, logged as
  `p[8], p[9]`) moves on every step. At log step n it is exactly our sim's state after step n-1 (Stereo Madness: x to
  0.01 and y to 0.001 for the first 1246 steps), and the game's y is ours + 90. The logged vy at step n is the vy before
  that step's gravity, so a jump shows vy 11.18 one step before y moves: **compare positions, not vy.** Read this way,
  the first jump of Stereo Madness (press at 348) starts on the same step in game and sim, y equal to 0.001 all through
  the arc. `probe.js result` and `probe.js table` use the node position when the log has it.
- **So "jumps start one step late" (below) was an artifact** of comparing the game's vy at step n with the sim's vy at
  step n (the game's vy is one step behind). Re-check GDLM 62 / 44 with a v0.5.0 log before using those numbers.
- **GD 2.2's jump snap (found 2026-11-26, Stereo Madness in practice mode; IN the sim since the same day, see "Jump snap, foot
  margin, 32-bit x" below):** on some landings on a
  block the game moves the player's x by exactly +1.0 in that one step (normal speed; the sim lands with no x change).
  Stereo Madness's first 3324 steps have 6 of them, all landings after a jump from one block to another 120 units
  ahead and 30 higher (steps 1247, 1352, 3053, 3146, 3235, 3324; x 1618, 1756, 3965, 4087, 4204, 4320), and nothing else
  moves x off the speed. This is `PlayerObject::checkSnapJumpToObject(GameObject*)` (local/src/GD-2.2081-Decompiled,
  src/Objects/PlayerObject.cpp ~line 278): when the player lands on an object other than the last one it snapped to, and
  the two objects are a standard jump apart (normal speed 0.9: 120 ahead / 30 up, 150 ahead / 30 down, 90 ahead / 60 up;
  other speeds have their own distances, and slow 0.7 / fast 1.1 / 1.3), x moves toward `object.x + m_snapDistance`
  (`m_snapDistance` = player x - object x at the last snap), at most `maxSnapDistance` (1 unit at 0.7 / 0.9, 2 at 1.1 /
  1.3); then the object becomes `m_objectSnappedTo`. The decompile's conditions read inverted (it snaps when NO pattern
  matches) and its x / y names are mixed up: the log says it snaps on the matching patterns.
  **Settled from the log:** `m_snapDistance` is the player's x minus the block's x at TAKE-OFF (the function runs every
  step while standing on a block and only re-measures it there). Stereo Madness, take-off offset -> landing offset before
  the snap -> after: -14.22 -> -17.38 -> -16.38; 3.09 -> -0.07 -> 0.93; -7.47 -> -10.62 -> -9.62; -5.73 -> -8.88 -> -7.88.
  So a 120-ahead / 30-up jump at normal speed lands 3.15 units behind its take-off offset and the snap moves it the
  1-unit cap forward. Landings at other offsets (120 / -30, 120 / +-68 slabs, 150 / -38, 180, 210, 300 ...) get no snap.
  Seen so far only (120, +30) at speed 0.9; the other two patterns and the other speeds are from the decompile. Open:
  which block counts when the player lands across two (GD takes the one its collision loop meets first). The data:
  `node tools/probe.js result <the Stereo Madness log>`; any v0.5.0 log has the per-step x. This is likely the "x +1.0
  in one step" the Clubstep diff found below, and the drift that kills our main-level routes in the game (see the
  2026-11-26 table in GEODE.md).
- **Press timing:** a route press made after n steps starts the jump in step n+1 in the game, as in our sim (GDLM 44's
  first press: n 104 -> vy 11.18 at step 105). Positions agree to 0.5 unit for the first 8588 steps of GDLM 62.
- **(Artifact, see above) Many jumps start one step late in the game:** GDLM 62 (offset 0): of 94 jumps, 39 start on the sim's step, 48
  one step later, 7 two or three later; the share does not depend on where the step falls in its 60 fps frame (each of
  the 4 frame steps: about half 0, half +1). GDLM 44: 15 of 25 on the sim's step. A likely reading, to check next: the
  +1 jumps are the ones made by a held button on landing (GD jumps no sooner than the step after a landing, see
  "Landing buffer"), the 0s are fresh presses. The probe log has the presses: split the jumps by "button already
  down" to settle it.
- **Clubstep, the user's first attempt from the start (2026-11-25, `node tools/probe.js diff 15`: the attempt's OWN presses
  replayed in our sim):** the sim dies 1 step and 1.1 unit after the game (game: step 2445, x 3174.4; sim: 2446, 3175.5),
  so over 10 s the sim follows the game closely. The partings, in order:
  - step 225 (0.94 s): a fresh press, the game's jump starts one step after the sim's (game vy 11.180 when the sim is
    already at 10.964). Of the 24 jumps paired: fresh presses 0 x9, +1 x8; held through a landing 0 x5, +1 x1. **So the
    one-step-late jump is NOT the held-vs-fresh split** (fresh presses are late as often as on time); open what decides it.
  - step 1121 (4.67 s): the first height gap over 0.5 unit (0.54), from such a late jump.
  - **step 1285 (5.35 s): the x parting, +1.0 unit in one step.** The cube is upside down, rises into a ceiling (game
    y 225 = our 135) and the user's press there jumps it off the ceiling (vy -11.18) -- in that same step the game moves
    x by 6.19 instead of 4 x 1.298 = 5.19 (the camera also jumps). The sim moves on at speed. x stays +1.0 after it
    (6-9 s: 0.99-1.04), +1.47 by 10 s. So the x drift the stitch thread saw (1.5, 3.3, 6.2 units at its checkpoints)
    is built of such one-unit steps at ceiling (and likely floor) jumps, not of the speed: between them x is exact.
  The practice attempts start at a checkpoint and can't be replayed in our sim from there yet (diff refuses them).
- **Heights:** the game's y is our y + 90 exactly (start: game 105, sim 15), so the death at game y 267.3 is our y 177.3.
- **GDLM 52 necromancy** (playback, 2026-11-25 18:39 UTC): dies in the game at x 10765 where the sim clears; not studied yet.
- **GDLM 44 dies in the game at x 6638, y 267** while the sim clears; the first height parting is at step 313
  (x 405: dx 1.0). Read from the level (2026-11-25, hellgate thread): x 6638 is in the SECOND SHIP (ship portal 6209,
  cube portal 7139), not the wave, 6 units before a one-block stair step of the old `ship-tunnel` corridor: at x 6644
  the roof's underside drops from y 210 to 180 (and the floor from 60 to 30). With the game's y about 90 above ours
  (confirm with `probe.js result`'s "y offset"), y 267 is ~177: the ship's top at the stepped roof's corner. It fits the
  open ship mismatch below (the game's ship rides ~0.5 unit higher than ours). Hellgate v2 replaces all three ship
  tunnels with `fly-path` slope corridors (no stair steps), so the spot is gone; the real-game re-check with the probe
  is still to run on the PC. Not yet settled: the exact ship height gap that made the corner kill.

## Jump snap, foot margin, 32-bit x (2026-11-26): IN the sim, checked step by step in the game

Four changes in `lib/physics.js`, each on by default with an off switch for comparisons (`GDLM_SNAP=0`, `GDLM_LAND=0`,
`GDLM_F32X=0`, `GDLM_OBB_PLAYER=0`). Measured on the probe mod v0.5.1 logs of the overnight batch (GEODE.md "Overnight batch
2026-11-26": 21 main levels in practice + 6 GDLM levels, per-step node position) with `node tools/probe.js diff <n>` (THIS
attempt's own presses; `probe.js result` replays today's saved route, which for Hexagon Force had been re-solved since).

| | before (all four off) | after |
|---|---|---|
| main levels: sim dies on the game's death step (within 1-6 units) | 0 of 21 (17-600 units late) | 14 of 21 (BoT, SM, Polargeist, Dry Out, BaB, CLG, Jumper, Time Machine, Cycles, ToE, Electroman, Hexagon, GD, Fingerdash); Deadlocked +17 units |
| main levels where the sim dies EARLIER than the game | -- | none |
| GDLM 44 / 64 | 7090 / 4497 (game 6638 / 4104) | 6639 / 4106, same step |
| gdsolver plans (`tests/tas_progress.js`) | SM 328, BoT 493, Polargeist 909, Dry Out 415 | all four clear; 6, 7, 8, 10, 13, 18, 21 further; 19 lower (below) |

Still parting (mostly ship / ball / wave / UFO stretches, not checked one by one): Deadlocked +17, xStep +204, Clutterfunk +86, Clubstep +354,
Electrodynamix +247, Blast Processing +255, ToE2 +48, GDLM 72 +120, GDLM 52 +361 units past the game's death.

1. **Jump snap** (`PlayerObject::checkSnapJumpToObject`, decompile PlayerObject.cpp ~278; gdsolver's port in
   dp/src/dp/collide.hpp agrees). Called for every solid block the CUBE lands on (gdsolver: not for ball, robot, spider or
   the flying modes), every step it stands there. If the block differs from the remembered one, the remembered one is a
   plain solid, and the new block sits a standard jump away (per speed: side `dx`, +30; far `dx`, -30; near `dx`, +60,
   gravity-relative; table `SNAP_PAT`), x moves toward `new block x + m_snapDistance`, at most 1 unit (2 at 2x / 3x).
   Then the block is remembered and `m_snapDistance` = player x - block x. Seen in the game: side (120, +30) many times,
   near (90, +60) at Electroman x 795; far and the other speeds only from the decompile.
   - **Which block, standing across two:** GD's box test counts touching edges, so the cube lands on EVERY block under
     it (ours set y on the first and then only touched the second: the prototype's "fits no rule" came from that).
     `GJBaseGameLayer::checkCollisions` gathers the solids section by section (100-unit x sections by the object's x,
     left to right; inside a section by uniqueID = level-string order, sorted) and collides them LAST FIRST. So the block
     remembered at take-off is the lowest section / earliest object, and on landing the highest section / latest object
     is the one compared. Stereo Madness 3195|3225 and 5325|5355 -> 5445|5475 (no snap), Dry Out 6615|6645, Clutterfunk
     4875|4905: all as in the game. Pure x order and "only the first on a fresh landing" each broke several logs.
   - **Breakable blocks (143, our "one-way block") are not type Solid**: snapping FROM one never happens (Electroman's
     column of 143s at 2685 -> 2775, a near pattern the game did not snap). `s.snapNo`.
   - GD sets the snapped x as a float (`static_cast<float>`), so the sim rounds it with F32X.
2. **Foot margin 10** (gdsolver's collide.hpp, collidedWithObjectInternal: `fVar30 = 10` for a non-platformer, 15 only
   while a platformer's size change is pending, 6 for ship / UFO / wave / swing; a foot contact when the feet before OR
   after the tick's move are within it of the top; vy must not point away). Ours was a flat 15 on the feet after the move:
   Stereo Madness's cube (x 5895, feet 14.6 under a slab at 5925) landed on it where the game kills it. `LAND`.
3. **x is a 32-bit float** like GD's CCPoint: the game's per-step x advances 1.2982 / 1.2983 / 1.2984 at normal speed,
   a float32 sum of 1.29825 matches 250 steps to 0.00005, a double drifts 0.008 in that time and 0.02 over a minute --
   Electroman's yellow orb at 2565 was missed by 0.01 on it. y is not rounded (no evidence yet). `F32X`.
4. **A turned hazard is tested against the player's box turned by its spin** (GD's hazard pass: `OBB2D::overlaps1Way` both
   ways between the object's and the player's oriented boxes; `obbHit2`). Fingerdash's route grazed a -113 degree spike
   (458 at 1645.7, 156.5) by 1 unit at a corner the spinning cube does not reach; the game passed. Fingerdash plan 54 -> 164
   with this alone.

Open: plan 19 (Geometrical Dominator) 100 -> 91: its robot tops out 1.6 units under a thin slab (id 468, block 92.5) that the
old 15 margin let it land on -- the robot jump is checked only by plans. Cycles: the sim lands an upside-down cube on a
block bottom 2 steps before the game (step 1036; both snap). The y sections (`shouldUseYSection` levels) are not modelled in
the order. Debug: `GDLM_SNAP=0` etc. above; `node tools/probe.js diff <n>` for a log, `node tools/tas.js <n>` for a plan.

## Landing jump and slopes from the probe logs (2026-11-26; the physics thread)

On top of "Jump snap, foot margin, 32-bit x" above. How to compare one step at a time: `node tools/probe_frames.js <log>
<level> steps <from> <to>` (game and sim side by side; `jumps`: every cube jump fresh / held). **Game tick n's position =
our `path[n-1]`** (positions change once a 60 fps frame); the logged vy is read before that step's gravity, so a fresh
jump's 11.180 shows one tick before our 10.964 although both start on the same step: compare POSITIONS, not vy.
- **A jump on a button held through the landing** goes the tick after the landing tick, and its first tick moves at the
  full jump speed (no gravity yet): GDLM 62 step 11750, Clubstep 1110 match to 0.001 only so. A fresh press keeps gravity
  on its first tick (39 of 39 fresh jumps exact). This replaces the "wait a tick after a ground landing" rule (EXP_LW,
  `GDLM_LANDJUMP=old` for measuring): a held cube bounces 103 ticks to its first re-jump, then 105 a hop.
- **Slopes**: the cube's foot sits on the slope at x + 15 tan(angle / 2) (6.213 on a 45-degree slope, 3.541 on a 2:1;
  gdsolver's slopes.hpp, the same as GD's line under the centre + half / cos(angle)); it rides until that point passes the
  slope's top; that tick GD holds it at the top with speed 0, and the tick after it launches like a pad (one tick of
  gravity from 0, then vy 7.405 on a 45-degree slope, 3.999 on a 2:1, at 1x; other slopes and speeds interpolated,
  UNMEASURED). GDLM 52 steps 805-837 match to 0.05 units; `GDLM_SLOPE=old` = the old corner rule. Cube and wave only (the
  launch: cube only): the wave gains in gdsolver's Fingerdash plan (295 -> 300, tried mode by mode) and in GDLM 44's wave
  log (parting 1425 -> 1545); for the ball it closed Hexagon Force's ball part (block 221), and ship / UFO / robot / spider
  change nothing in the plans, so they keep the corner rule until a probe log shows them on a slope.
- **Yellow pad** 16.000 in cube and ship (the user's "auto play area" run): `sure` in lib/objects.js.
- With the jump snap above plus these two: GDLM 62's whole 62 s playback matches the game in x and y at every frame,
  Clubstep's first attempt (2445 steps) with no parting at all, GDLM 44's runs in x to the end; the 21 main-level playback
  logs die on the same steps as without them (no level worse).
- Still parting: GDLM 52 at step 5049 (0.5 unit low on a fall, cube), GDLM 44 v1 at 1545 (wave on a slope; the sim then
  dies at 1528-1548 where the game lives: the game's wave flies up through two flipped 1338 slopes at x 1987 y 195 and
  x 2017 y 165 that the sim holds solid -- check that local/tmp/h44v1.gdlvl is really the version played, then how GD
  treats a flipped 1338). Data: the logs are in GD's save folder (`%LOCALAPPDATA%/GeometryDash/geode/mods/gdlm.probe/attempts`),
  including ~120 of the user's own attempts on community levels (Sunrise Stroll, Altaria, Brillo III, chillblain
  grace...) to check once those levels are fetched.

### The user's ToE / ToE2 / Hexagon Force / Deadlocked runs (2026-11-26, second batch)

Evgeni played the four on the PC (probe mod logging, 20 attempts; logs local only). Per-tick positions are in the log:
`p[8], p[9]` are the player's x, y on EVERY tick (p[0], p[1] change once a frame) and `p[7]` is the speed factor
(0.7 / 0.9 / 1.1 / 1.3 = 0.5x / 1x / 2x / 3x), so a speed change shows on its exact tick. What they fixed, each behind a
switch for measuring:
- **Speed portals have their own widths** (lib/objects.js): 2x 51, 3x 65 (both measured to the tick: ToE2 2575, Hexagon
  2730, Deadlocked 3393), 0.5x 31-34 (ToE2 3460; OpenGD's 35 is too wide), 1x 33 and 4x 69 from OpenGD, unmeasured. The old
  common 34x44 box changed speed 6-15 units late.
- **The orb flag outlives a release by one tick** (`RING_KEEP`, `GDLM_RING_KEEP=0` = old): Deadlocked 2669 takes a blue orb
  the tick after the button came up, with the plain box. (A turned-square test for the spinning cube fitted that orb but
  took the one at 1850 a tick early: rejected.)
- **Turned portals touch by their turned box** (`touchingP`, `GDLM_PORTAL_OBB=0`): Deadlocked 858, a cube portal at 53
  degrees. **A teleport turned -53 degrees moves the player by the full key 54** (169), not 169 cos 53 (`GDLM_TP_COS=1` =
  old): Deadlocked 1745-1749.
- **The ship under a ceiling slope** (`slopeBottom(..., gd)`, `GDLM_CEILSLOPE=old`): it slides 15 / cos(angle) under the
  line (the floor's foot rule, mirrored) with vy 0, is held level with the low end on the tick its point passes it, and the
  tick after is launched down: vy -3.729 off a 2:1 slope at 2x (Hexagon Force 3010-3079; other slopes / speeds scaled like
  the floor launch, UNMEASURED). The block that carries on from the low end does not push it down meanwhile.
- **Ship -> UFO keeps a quarter of vy** (`GDLM_FLY2FLY=old`): ToE2 3452, 2.195 -> 0.549 (GD halves leaving one flying mode
  and again entering the next). Other flying pairs UNMEASURED.

Result: Deadlocked's attempt matches the game to its death (3511 steps); both Hexagon Force attempts and ToE2's
8,400-step attempt die on the game's death step; on the 21 main playback logs Electrodynamix and Deadlocked now die on the
game's step, none got worse; the plan ratchet rose (15: 267 -> 360, 17: 300 -> 311).

Still open from these runs:
- **ToE 1309** (queue 5 was the guess; it is not the pink orb): after a blue pad the upside-down cube rises with a 30x16
  block (66, top y 70) under its head side; the game pushes it ONTO the block (y = 70 + 15, on the ground, vy 0) where the
  sim's inner box dies. The cube's bottom was 11.4 under the block top, more than the 10-unit foot margin.
- **ToE2 3929**: a UFO dies on a tiny turned spike piece (720, -35 degrees) whose 2.4x3.2 box (OpenGD) misses it by 0.7;
  the game's box is a bit bigger (world height 2.7-3.35 at that angle). One sample.
- Deadlocked 3394: the wave and 3x portals now match; the attempt's last 120 steps were not checked beyond the death step.

### The auto beat lab log (2026-11-26, no presses)

Evgeni's real-game run of `levels/lab/auto_beat.gdlvl` (auto thread; log on the PC, local\tmp\autobeat_probe\). With these
five rules the sim matches it on every tick to the game's death (3793 steps, ~30 pads, portals, slopes, mini, spider):
- **A mini cube on a slope** sits by its own half (9 + 9 tan(angle/2) over the line, `slopeTop(..., ph)`), and its launch
  off a 45-degree top is 3.086 at 1x, 0.417 of the full 7.405 (`GDLM_MINI_LAUNCH=old`; 2:1 and other speeds UNMEASURED).
- **A cube falling onto a falling slope with its foot point before the high end** lands on that end's level, is held two
  ticks (vy 0), then falls off with gravity and lands on the line (`GDLM_DESC_TOP=0`; ticks 2612-2619).
- **Over a falling slope's high end the landing margin is a block top's 10**, not 17 (`GDLM_SLOPE_END=old`): a spider
  15.7 under the end falls on and dies (tick 3786).
- **A cube on the ground taking a gravity portal keeps that tick's gravity step** (moved down by it, vy halved by the
  flip): -0.024 at the next frame, then 0.108 up (`GDLM_FLIPGND=old`; tick 2675).
- **A pad touched on the tick the cube lands on a block is taken first**: the landing never snaps it up (0.55 inside the
  block's top, then 16 up; `GDLM_PADLAND=old`; tick 3283).
The auto builder (tools/autobeat.js) places by the sim, so its builds change with these: tests/autobeat.js needs a rebuild
by the auto thread (Jumper seed 2 and round 9 fail on the new physics).

Lab v10 log (2026-11-26, `/mnt/project-files/auto_bricks/probe/`, auto thread; UFO stretch with flips, mini and pads): with
these four UFO rules the sim matches every tick to the game's spike death (881 steps):
- **(Only with "Fix Gravity Bug" on, see "Upside-down cube and the ground" below the robot note.) A flipped UFO's gravity switch is the mirror of the upright one** (0.086 while player-frame vy <= +2g, 0.129 above), not
  GD's world-frame ship rule: from rest after a UFO + gravity-up portal pair the game pulls 0.086 a tick, the old rule 0.129
  (`GDLM_UFO_FLIP=old`; ticks 345-360).
- **A UFO's yellow pad leaves no boost; its red pad keeps it** (corrected by the v11 log below): yellow 16 is 8.000 the next tick
  (mini 12.8 -> 9.412, the UFO's cap), a flipped red pad's -9.6 and a mini red pad's 12.544 keep their speed
  (`GDLM_UFO_PADCAP=old`; v10 ticks 432, 851, 388; v11 tick 851). Pink pads and ship pads not measured here.
- **A mini player that grows into the band's floor or roof stops dead** there (vy 0, not only speed into it):
  `GDLM_GROW_STOP=old`; tick 682.
- **A flipped UFO whose 9x9 kill box meets a block with its centre within 4.5 under the block's top is set on that top**
  (lifted 11.3, vy 0) and lives: `GDLM_FLY_LIFT=old`; tick 807. ONE sample (a mini UFO): which modes, sizes and faces get
  it is open.
None of the four moves the 21 main logs, Evgeni's ToE / ToE2 / Hexagon / Deadlocked runs or the tas ratchet.

Lab v11 log (2026-11-26, same folder, 1057 steps): now matches every tick to the game's death, with:
- **A UFO rides a floor slope as the cube does**: GD's foot rule with its own half (a mini UFO's centre 9 + 9 tan(22.5) over a
  45-degree line, so it starts climbing ~5 units later than the old corner rule), held a tick at the top, then launched --
  5.554 for a mini UFO at 1x on 45 degrees (0.750 of the cube's 7.405); a normal UFO's launch is UNMEASURED (the cube's is
  used). On the launch tick, and when a pad launches a UFO sitting on a block, it keeps that tick's gravity step (0.023 under
  the top) instead of the block's snap (`GDLM_UFO_SLOPE=old`, `GDLM_PADLAND=old`; ticks 736-760, 851).
- **An upside-down cube that hits the ground hard dies** (no object): a flipped mini cube at vy -13.6, tick 1057. The cut is
  vy < -4, a guess inside GDLM 67's band (~-6 dies, ~-1.7 lives; section "Upside-down cube and the ground")
  (`GDLM_FLIP_GROUND=old`).

## Fidelity: measuring the sim against the user's game (goal: "as close as possible")

The user's standing goal (2026-11-23). Plan: a scoreboard (tools/fidelity.js, not built yet) giving, per
mechanic, the error between the player tracked in each recording and the sim replaying the same inputs, plus
death agreement; fix the biggest errors first, each with a test in tests/mechanics.js; a lab level for every
mechanic with no evidence.
What exists and what blocks it (2026-11-23):
- Checked against video so far: the cube jump arc (tests/jump_video.js, 1.3 px rms), mode accelerations from
  Clutterfunk (tests/modes_video.js: cube, ship, ball), the wave's 2:1 trail, red orb depth, the GDLM 60
  stations (section above).
- Tracking the player: tools/track.py follows the lime icon. Small mode icons work only in a narrow strip
  at the player's screen column with the UI cut out: `--crop 620,120,180,900 --tol 70` at 1080p fullscreen
  (the progress bar is lime too; the on-screen Z button sits right of x 800). In a window, shift by the window.
- BLOCKER: GD's camera moves up and down with the player (cube and robot jumps, teleports), so screen y is
  not level y. Fitted screen accelerations came out at about half the real ones (cube -0.35 vs -0.78
  units/frame^2) and the teleport heights read 478 px against 588 expected. Every per-mode number needs y
  measured against something in the level (the ground line, a block row) in the same frame: track.py
  --rows gives candidate edges; following the right one through camera moves is the next piece of work.
- Inputs (USE_CASES 29, built 2026-11-24): tools/record.sh now also runs tools/inputlog.ps1, which logs the
  user's GD inputs ONLY while recording and ONLY GD's jump keys/click while GD is in front (Space, Up, W, left
  mouse; down/up, high-resolution, wall-clock) to local/inputs/. tools/replay_run.js <video> <log> <level>
  replays each normal-mode attempt (attempts from the progress bar, tools/runs.js) in the sim: the clock offset
  is the shift at which the sim dies at the video's % (or finishes); an attempt no shift explains is a physics
  mismatch for this list. Output local/replays/<video>.json and local/attempts/<base>.jsonl (viewer ghost,
  difficulty). Sound (2026-11-24, the user's pick: no install): tools/audiolog.ps1 records the PC's own sound by
  WASAPI loopback with record.sh (Videos/Captures/GD claude-audio <time>.wav + .json with the UTC start; silence
  is written while nothing plays, so the file's time is wall time; tested: a 1.5 s tone lands where it played).
  replay_run.js matches the recorded sound around each attempt with the level's song from its offset
  (loudness envelopes, 100 Hz): the music's restart pins the attempt's start to ~10 ms (a synthetic test: 2.00 s
  found for 2.00 s), then the press shift is searched +-25 ms; without sound or the song, the bar fit (+-1.5 s).
  First real run (2026-11-24, GDLM 63 dual + movers lab, GD claude-rec 2026-11-24_02-13-32.mkv with the
  minimal "<unix ms> <down|up> <key>" log, no sound; window 172,94,1600): one clock offset for the whole
  recording, 842 ms, from the clears. BOTH CLEARS REPLAY TO THE END IN THE SIM with the user's own presses:
  every station (dual, moving objects, orbs) agrees with the game on that run. The first attempt (died 38.1%)
  needs a 1.4 s shift: its bar-detected start is late (the first attempt fades in after loading), not physics.
  The 0.9% / 3.6% "deaths" are quick restarts. Orb stations: at 9 and 11 the user pressed again at the orb
  instead of holding from the jump, so "a held jump fires an orb" is still unanswered (ask for a hold next
  time); 10 (press just before, held) fired as the sim expects; 12 fired and the run went on.
  Attempts are in local/attempts/gdlm_63_dual_and_movers_lab.jsonl (viewer "Your runs", video lines).
  Dual band height, measured (frame at 88.0 s, local/shots/rec63/d88.png, window crop 172,94,1600x900): in
  dual GD draws the roof as a band at the top of the view; floor line y 826 px, roof line y 73 px = 753 px;
  a floor spike (1 block) is 76 px tall -> 9.9 blocks. The sim's dual band is 10 blocks (player 2's top at
  y 300): agrees within the measure (+-1 px on each line = +-0.03 blocks... the spike edge, ~+-2%).
  The same recording also holds GDLM 60 (2 attempts) and Blast Processing (1): identified from the frames.
  INPUT LOGGER LESSON (02:26 recording, 2026-11-24): the first tools/inputlog.ps1 did its work (a process-name
  lookup, a file write + flush) inside the low-level hook callback. Jumper, which the user cleared, replays to a
  death at 2.6% because the log has no press at the route's 2.07 s and 2.44 s jumps: the hook MISSED real
  clicks (Windows skips a hook that takes too long, and every click waits on it until then). The user, the same
  session: "a spike killed me, probably we are running something" (Clutterfunk, 92.6%). Fixed 02:34: the
  callback only queues (clock, foreground pid, key); a writer thread does the rest. Logs from 02:13-02:34 (both
  loggers' first versions) may miss presses: judge them only where they replay a clear.
  - The first attempt after a level loads: its bar shows ~0.55 s before the level moves (GDLM 63 +580 ms, BP
    +520 ms); replay_run.js allows for it (LOAD_MS). With it: GDLM 63 all agree (2 clears, a 38.1% death,
    2 restarts not judged), Blast Processing's 15.8% death agrees (sim 15.7%, a slope), GDLM 60's 48.1% agrees.
  - OPEN, a mismatch candidate: GDLM 60 at 456.6 s died 33.9% (the green-orb station) in the game; with the
    logged presses the sim dies at block 96.9 (the pink-orb station's spike) before the user's jump there, and
    no clock shift in +-1.5 s reproduces 33.9%. Either the pink-orb station plays differently (the pink orb
    was already the unsettled lab-60 measurement), or the input log has a gap (it only logs while GD is in
    front). The other GDLM 60 attempt passes the same station in both. Needs a clean pink-orb recording.
  - FIRST RECORDING ON THE FIXED LOGGER (02:33:44, 2026-11-24): 9 normal attempts on official levels, identified from
    the frames (level page + "Attempt 1"): Electroman 13.5 s 33.2%, 43.5 s 10.3%; Hexagon Force 60.6 s 40.4%; Geometrical
    Dominator 102.9 s 12.3%, 115.6 s 13.3%; Fingerdash 138.7 s 53.0%, 186.7 s CLEAR; Base After Base 306.4 s CLEAR
    (GD: 108 jumps; the log: 126 presses -- ship presses are not jumps); xStep 404.0 s CLEAR. No attempt agrees yet:
    - Base After Base: the sim dies at 62.8% (ship, a block); the presses from 2 s before it moved +54 ms -> the sim
      BEATS it. So the log is complete and the physics holds there: a clock drift or lag of ~50 ms over the run.
    - xStep: dies at 22.7% in the ship, its bottom 0.2 unit into a floor spike's top: the known "sim ship ~0.5 unit
      low" (Stereo Madness, Hexagon Force). No shift in +-300 ms gets past it. Second real-run case of it.
    - Fingerdash: dies at 51.9% ~1 s after a spider -> ship portal, flying ~8 units into small ceiling spikes (458);
      no shift gets past it. Open.
    - Electroman 1.5%, Geometrical Dominator 6-7% (robot), Hexagon Force 31.4%: deaths on saws with every whole-run
      shift in +-3 s. The user taps fast there (~70 ms taps, ~0.17 s apart). Tried and ruled out: saws as circle vs
      the player's circle (the sim dies at the next saw instead) and a 20-40 tick landing buffer (no change).
      Next: track the cube in the video over the first 2 s of Electroman (tools/track.py) against the sim's path.
    - Tool fixes from this recording: runs.js started an attempt at the first empty-bar reading, which a menu page
      or another window also gives (Base After Base "started" 31 s early): now the last frame the bar sat at its
      lowest. replay_run.js: the sound pin locked on the wrong spot for every attempt here (all died in the first
      7% pinned): the bar fit now runs too and the closer one wins; a logger restart resets the keys at its start.
  - RECORDING 02:45:05 (2026-11-24, 30 min, fixed logger; the video file ends abruptly): 48 attempts by the bar.
    Clutterfunk 18.4 s CLEAR (81 jumps) -- its replay found the LANDING BUFFER (section above): the sim died at
    1.9% on the first saw because it dropped an in-air tap the game kept; now it reaches 3.5%, where the game's
    cube uses a pad on a hanging block that the sim's does not reach (open). The video runs ~1.05 s behind its
    file name's second here (first jump tracked at 18.28 s, logged at 19.33 s). Other groups: the user's own
    online levels page, then a 6-12 s level (264-303 s, 6 deaths then a clear) right after GDLM 44's online page
    (ID 152848491) -- but the repo GDLM 44 runs 42.6 s, so not replayed; the daily "Worldwide" (360-636 s,
    deaths 37-75%, a practice clear); Bow Wow (668 s, 91.2%); 668-1406 s practice (no attempts from the bar);
    "IS" by Crenate (1406-1618 s); Sidestep (1741-1791 s). None of the community ones are on this PC.
- OUTCOMES, TWO SIDES (2026-11-24, after xStep's and Fingerdash's clears were drawn as deaths in the viewer): each
  attempt line keeps what really happened (result / pct from the video's bar; why null -- the bar does not know the
  cause) and the sim's replay (`sim: {result, pct, x, why, tick, mode}`) apart; `agree` = tools/attempts.js agreeOf
  (same result; a death within 2.5 % of the same %); a quick restart is not judged. tests/attempts_consistency.js
  checks every line, including a fresh replay on today's physics (a physics change makes old verdicts stale).
  Lines that were wrong were removed (official 2 and 3 @274.5 s: the bad attempt start; GDLM 44 from 02:45: the level
  is not identified); backup local/attempts.bak-2026-11-24. replay_run.js now filters attempts by the level's own
  length (lib/sync.js) even with --from/--to (it had put GDLM 60's and Blast Processing's attempts in GDLM 63's file).
- THE USER'S PLAY AS A ROUTE: a clear the sim replays to the end is saved as kind "player" beside the solver's
  route (local/solutions/<key>.player.json, replay_run.js). First: GDLM 63 (the clear at 430.3 s, 02:13 recording).
  Every other clear so far stops in the sim: those first divergences are the best fidelity tests we have (a known
  good input sequence): Clutterfunk 3.5% (02:45), Base After Base 62.8% (~50 ms clock), xStep 22.7% (ship),
  Fingerdash 51.9% (ship after a spider), Jumper / Cycles (02:26, old logger with gaps: not usable).
- PIPELINE DIAGNOSIS (2026-11-24, "diagnose before blaming physics"), on the fixed-logger recordings:
  - THE HOOK LOGGER STILL MISSES CLICKS. Electroman, 02:33:44 @43.5 s: the video shows two jumps 0.6 s apart over the
    two half-buried saws (x 307, 439; gdsolver's real-game plan presses there too, 0.43 s apart); the log has the first
    (44.645) and nothing until 45.573. No clock shift can replay that: the sim dies at the second saw (1.0-1.5%) for
    every start from 43.4 to 44.4. Cause: Windows skips a low-level hook that does not answer in time (the PC was
    running solver jobs). Fix: tools/inputlog_raw.ps1 (raw input, never skipped, the event's own time) runs beside
    the hook logger from now on (tools/record.sh), so the two are compared on the next recording.
  - THE VIDEO RUNS ~1 s BEHIND ITS FILE NAME's second (0.98 s at 02:33, 1.05 s at 02:45, from tracked launches vs
    logged presses), and the bar's attempt start is 0.3-1 s late (Electroman 43.25 vs 43.53; Base After Base 305.44
    vs 306.43). Both are inside replay_run's +-1.5 s search, so they do not cause the mismatches alone.
  - CLOCK DRIFT inside a run: Base After Base's launches line up -38 ms early in the first 10 s and -9 ms in the last
    15 s. replay_run.js now re-fits the presses from 2 s before a sim death within +-60 ms (100 ms in all) and reports
    "agree after drift" apart (video.drift on the line). Hexagon Force's 40.4% death agrees after a 28 ms re-fit.
  - WHICH LEVEL each attempt is: local/runs/<video>.levels.json ({"<start s>": "official:N | levels/x.gdlvl | ?"}),
    read off the frames (level page, "Attempt 1"); when it exists replay_run uses it and not the length guess (GDLM 60
    and 63 are 30 and 21 s: length alone put one's attempts in the other's file). Written for 02:13, 02:26, 02:33, 02:45.
  - THE LEVEL'S START IN THE VIDEO: video.level_t on each attempt line = bar start + shift - the video's lag behind its
    file name (clock.json video_lag_s: 0.82 s at 02:13 from two death frames, 0.98 s at 02:33, 1.05 s at 02:45, else 1.0;
    it differs per recording, so measure it on each new one: one death or clear frame is enough). video.t is the bar start, 0.3-1 s
    late: never use it for a side-by-side (Hexagon Force: bar 60.6 s, level_t 59.40 s; checked on the frames).
  - ONE CLOCK PER RECORDING: local/runs/<video>.clock.json (offset from the recording's clears), reused when one level
    is replayed alone (Blast Processing in 02:13 agreed only with GDLM 63's clock: 15.7% vs 15.8%; alone it picked a
    far shift and died at 2.0%). 02:33 has none: its bar starts are off by 0.3-1 s per attempt.
  - The attempt filter by length now keeps an attempt near the level's own length OR this recording's clears of it
    (40%): a death's implied length (secs x 100 / %) is rough where speed portals change the pace.
- THE TABLE (2026-11-24 night, physics with the landing buffer, replay_run with drift re-fit, level maps, clocks):
  | recording | level | you | sim | agree | first divergence / cause |
  | 02:13 | GDLM 63 | 38.1%, clear, clear (+2 restarts) | 39.7%, clear, clear | yes x3 | - |
  | 02:13 | GDLM 60 | 48.1% / 33.9% | 49.5% / 30.7% | yes / no | 33.9%: pink-orb station, unknown (log may have a gap) |
  | 02:13 | Blast Processing | 15.8% | 15.7% (slope) | yes | - (needs the recording's clock) |
  | 02:33 | Hexagon Force | 40.4% | 40.6% | yes (drift 28 ms) | - |
  | 02:33 | Base After Base | clear | clear | yes (drift 52 ms) | - |
  | 02:33 | Fingerdash | 53.0% / clear | 53.2% / 61.3% | yes (drift) / no | clear: block 555.6, robot launched into ceiling spikes (458). tools/passcheck.js 550-558 from the attempt's state: our physics HAS a way (presses 53.150 53.204 53.233 53.608 53.646 s), the log has 53.158 then 53.388 -- the same recording's hook logger dropped a click in Electroman, so most likely PIPELINE (a missed press); re-check with a raw-input recording |
  | 02:33 | xStep | clear | 25.3% | no | block 211, ship into a hanging spike, after 3 drift re-fits. passcheck 205-216: our physics passes only with 35 presses in 0.9 s (a jitter no human makes); the user pressed twice there (19.875, 20.554) -> most likely PHYSICS: the ship's line in that corridor (cf. the open ~0.5-unit ship offset, Stereo Madness 328) |
  | 02:33 | Electroman | 33.2% / 10.3% | 3.5% / 1.5% | no | PIPELINE: the hook logger missed a click (2nd saw jump) |
  | 02:33 | Geometrical Dominator | 12.3% / 13.3% | 7.3% / 5.7% | no | unknown (robot; path check too noisy to tell) |
  | 02:45 | Clutterfunk | clear | 3.5% | no | block 34.6: the game's cube uses a pad on a hanging block the sim's does not reach: unknown |
  | 02:26 | Jumper, Cycles, Clutterfunk | clear, clear, 92.6% | 2.6%, 2.2%, 1.9% | no | PIPELINE: first logger (missed clicks), not usable |
  | 19:34 | GDLM 52 Necromancy (showcase v2) | 11 attempts | same | 11/11 | - (raw-input logger, landing rule of 46672ee) |
  | 19:34 | GDLM 64 Golden Hour v5 | 10.7%, 12% | 3.6-4.8% | no | CLOCK unsettled (framecheck pending), not counted as physics |
  | 19:47 | GDLM 68 camera lab (28ffa9d) | 6 deaths, 2.2-43.9% | same | 6/6 (4 judged) | - (clock -687 ms; 5 deaths in climb 1, blocks 22-32) |
  | 19:47 | Hexagon Force, Dash | 8 / 7 attempts | | 1/8, 3/7 | NOT TRUSTED: per-attempt shifts scatter -637..+1683 ms with the -687 ms clock, Hexagon "beaten" 3x by the bar (practice/menu misread) -- attempt splitting, not physics; not in the fidelity count |
- PIPELINE LESSON (19:47, 2026-11-24): `replay_run --any/--from/--to` over a free-play stretch wrote candidate lines into
  every official level it tried (official_15..21 got 7-9 wrong lines each; cleaned, backups `.bak-19-47-52`). Identify
  each attempt's level from the frames first (local/runs/<video>.levels.json), then replay per level.
- SHIP ENTRY SPEED, TRIED AND REJECTED (2026-11-24): the ship stretches that need inhuman input (Stereo Madness
  358-386, Back On Track 459-510, Polargeist 342-378, xStep 211) made the entry the suspect. On gdsolver's plans: moving
  the ship +-0.5 / 1 unit at entry changes nothing for Stereo Madness (328.8 every time); the factor on LEAVING a flying
  mode changes nothing; the factor on ENTERING does: keeping 0.25 instead of 0.5 of vy when the entry is FALLING (0.5
  when rising) takes Dry Out 575 -> 639, Can't Let Go 490 -> 608, Time Machine 363 -> 378, xStep 168 -> 189, Jumper,
  Clutterfunk a little, none less far (0.1, 0.35, 0 each less good; a smaller factor on rising entries costs Back On
  Track 50 blocks). BUT the user's own runs say no: Hexagon Force's agreeing attempt (40.4 vs 40.6) dies at 15.9, xStep
  25.3 -> 20.0. Not adopted. The plans' gain probably stands in for something else at a ship entry -- tools/tas.js
  replays with GD's 2-tick button latency in ship/UFO (playLatent), the user's replays do not: check that first.
  Checked: the same ship/UFO latency applied to the user's logged runs breaks two that agree (Hexagon Force 40.6 ->
  18.9, Base After Base's clear -> 65.8): the user's logs fit best WITHOUT it (each attempt's fitted clock shift already
  takes the constant delay). So the plans and the user's runs disagree about a ship entry; the next step needs a ship
  recording with the raw-input logger (tools/inputlog_raw.ps1): GDLM 67 stations 9-10 (pad-thrown ship entries, no input:
  falling reads y ~34 at the first ruler with 0.5, ~56 with 0.25).
- PASS CHECK (tools/passcheck.js, 2026-11-24): an exhaustive held / not-held search (states merged on position, speed,
  mode, button, orbs) from an attempt's replayed state through a stretch. NO WAY where the user got through = a physics
  difference there; a way that needs presses the log lacks = a missed input or timing. Fingerdash 550-558: a way exists
  (10 min, 5.6k states at most) -> not a physics fact. xStep 205-216: a way only by 35 presses in 0.9 s -> a
  physics lead (the search takes any way; judge whether a human could press it).
  tools/inputgap.js on that xStep attempt: one extra release+press pair at any spot in the last 3 s gets at most 0.4%
  further (493 tried, none clears) -> not one missed click: the ship's path there stays a physics lead (the video: the
  real ship flies 1-2 blocks over the floor clouds; the sim's, with the same presses, bobs between y 41 and 91 and climbs
  into the hanging saws; a smaller or shifted ship box only delays the hit). passcheck --trail / --mini / --set start
  from a solver's saved route or a state you give (Dash 22, 2026-11-24: the mini route over the invisible key-135
  platforms at 106-113 exists up to 116.5, where spikes of group 265 moved by four move triggers kill it -> moving objects). Use --max 5000 (40000 ran out of time).
- PLANNER GUARDS (2026-11-24, polish on GDLM 44 hellgate): tools/solutions.js fromRun saves a natural plan only when it
  skips no portal / orb (a fresh solve's plan walked under the wave portal at block 292 that the raw route took) and, for
  an incremental or windowed re-plan, adds no jump over nothing (else the whole-level plan). lib/natural.js mergeLegs
  (after fly): a wave leg split into short presses by the controller's dead band is merged back, the stretch's other
  inputs nudged by whole frames: hellgate's first corridor 5 presses / 5 short legs / 202 ticks near a wall -> 2 / 0 / 54.
- FRAME-SNAPPED PRESSES do not help (the user's "Click Between Steps" is off, so GD may apply a press only at a
  frame start): snapping the logged presses to 60/120/144 Hz grids (every phase) makes no stuck replay go further and
  breaks Base After Base's clear (60 Hz: 12.9%). The logged times as they are fit best.
- HABITS (tools/habits.js): median tap 120 ms (p10 88, p90 161) over 3,094 presses -- the human route's tap is 60 ms.
- PATHS, not only outcomes (tools/pathcheck.js, 2026-11-24): the icon tracked in the video (track.py) against the
  sim's path under the same presses. Height against "the lowest strong edge" failed (Base After Base: errors of
  100-350 units on a run that clears in both -- the camera rises and the edge found is a block row, not the ground),
  so the robust comparison is LAUNCHES: upward onsets in the video (faster than the camera ever moves) vs the sim's
  jumps / orb and pad launches, lined up by one time shift. It reports matched launches, the timing drift over the
  run (clock), and the first launch only in the video (the game launched, the sim did not) or only in the sim.
  STATUS: NOT RELIABLE YET. Even on Base After Base, which the sim clears with the logged presses, only 75 of ~160
  launches match: colour tracking is too noisy (lime decoration; the camera). Now: only the player's column is
  tracked (0.367 of the window; 14 s instead of minutes) and the level start is searched +-0.4 s around the known
  clock (bar start + shift - the video's ~1 s lag). Next: track the icon by its shape (template match), and the
  ground / block rows from the level's own geometry at the sim's x, so heights compare too.
- Practice-mode respawns break time -> x; per-attempt segmentation by the attempt label or a jump in x.
Lab 2 (to build): the mini cube, the pink orb (clean, at ground level so the camera stays still), 45-degree
and -53-degree teleports, the swing, dual portals, and a green orb in mid-air.

## Agent co-solve (DESIGN, not built; the user's item 5, queued after buffering and unneeded jumps)

Goal: faster solves of long levels (official, community, demons) and a second check against secret ways, by
letting a cheap model (claude-haiku-5-5) read a section and say where the intended path goes.
- Sections: cut the level at mode/speed portals and every ~40 blocks; per section a text map
  (tools/textmap.js --from --to --rows, no path) plus a legend line: ~1-2 k tokens.
- Prompt -> strict JSON only: `{"waypoints": [{"x": <block>, "y": [lo, hi], "why": "orb"|"portal"|"gap"|
  "corridor"|"over"|"under", "obj": <id or null>}], "take": [object ids that must be used]}`; validated
  against the section (ids exist, x within the section), else retried once, else ignored.
- Cache: local/cosolve/<sha1 of the section's objects + prompt version>.json. A level re-solved after a
  physics change pays nothing; a changed section pays for that section only.
- Use in the solver: solveSweep gets opts.corridor(x) -> [ylo, yhi], interpolated between waypoints with a
  margin. States outside it are ranked after all states inside (never dropped, so a wrong plan can't make a
  level unsolvable), and `take` objects join the no-skip requirements. With the beam CAP, this focuses the
  search: expect fewer states per tick, measured as time per level with and without.
- Secret-way flag: the finished route's distance from the corridor; a route leaving it for more than ~1 s on a
  rated level is reported as "off the intended path at x" (a physics-bug candidate, like a skip).
- Cost report per level: sections, tokens in/out, cache hits, model time, solve time with vs without.
- Not in lib/ (no network there): a tool, tools/cosolve.js, writes the corridor file; difficulty_solve reads it.
Open: which API key and budget (the user's call); whether text maps carry enough for orb lines (test on
Polargeist and Electroman, where secret ways were found).

## No secret ways (the user's rule, 2026-11-23, firm)

"we need to stop accepting those secret ways by the solvers. especially in official levels. if the solver
skips something, its 99% wrong. and will cause trouble. and anyway not the human way."
- A route that passes a **portal** (mode, gravity, speed, size, teleport) without taking it is REJECTED in
  every solver (lib/physics.js solveSweep: dropped from the search; solveAny: an exact cube route that skips
  falls back to the ranked sweep). Portals of the same effect stacked within 30 units of x count as one: any
  of them is enough. A portal is a requirement only when some state of the search came within 60 units
  of it (2 blocks): a decorative portal far off the play (ClockWood's ball portal 22 blocks up, Spooky
  Dash's teleport at y 1605) is not, and a finished solve names such portals in `outOfReach`. One the
  search got near and never took is the "stuck" case. A portal that would change nothing for the player
  there (a ship portal while already a ship, a speed portal at that speed, gravity already that way, the
  same size) is not a requirement either.
- **Orbs, pads and dash orbs are NOT requirements** (the user, 2026-11-24: "Skipping an orb or a dash is not bad,
  sometimes they are actually fake and should be avoided. Unlike portals or whole paths which are rarely to be
  skipped."). A route that passes one untaken is valid, and the sweep no longer ranks routes by orbs taken (it only
  counts them: `skipped.orbs`), so it neither forces a route through an orb nor avoids one. `GD.skipCheck(w, path,
  events, ignore, { orbs: true })` still reports an orb/pad the route's box came within 15 units of and left (a
  level-design warning: tools/skips.js lists them as "untouched"); the decoy test (`decoy()`, Hexagon Force's yellow
  orb at block 553.7 that kills every way it is taken) only runs then. Before 2026-11-24 such an orb was a failure:
  Cant Let Go, Time Machine, Cycles, xStep, Clutterfunk and Clubstep counted unbeaten for an orb or pad alone.
- **Portals and whole paths/sections** stay hard: skipping one is a failure (above; a whole path skipped without a
  portal is not detected yet, see the last point).
- On official and rated levels a portal stuck like that is a **physics bug at that object**: our sim cannot take
  what the game's players take. Never report a % or "beaten" that came from a skip.
- Not yet covered: leaving the intended space without skipping anything (over a ceiling, outside a
  corridor); the sky limit (300 above the highest object) is the only guard.
- `opts.allowSkips` brings back the old ranking for debugging only. Tests: tests/mechanics.js "no-skip".
- The shared check is `GD.skipCheck(w, path, events)` (null = clean; else the stuck result).

## How the route is chosen (the natural route)

- HOLDS THROUGH JUMPS become taps (lib/natural.js tapsEach), now also (2026-11-24, after gd-polish found 1-8 s holds
  in routes planned after the rule): a hold running into or out of a ship / wave part keeps the button down only
  where the mode steers; a hold one firing really needs is cut to the gaps that need it (greedy); and the pass runs
  once more last (a later pass -- an orb buffered into an auto-jump chain -- had rebuilt one). Re-planned: GDLM 44
  (36 presses, none left), 45, 61 (none), 60 (2.27 s through 6 jumps -> 0.43 s through 2: tapping there kills).
- FIRST: the level's own planned inputs (tools/planned.js plannedEvents: the build's taps, 14 ticks each as
  tools/hitbuild.js taps, and its ship schedule's own releases). When they clear the level as-is and skip nothing,
  they ARE the saved route (kind "human", source "planned"; tools/solutions.js solve), with no solving. GDLM 62:
  50 presses (43 taps + 7 ship presses), clears, 1.7 s (2026-11-24). Otherwise the natural plan below.

Status of every saved route (official and GDLM: beaten?, kind, how it was made, plan stamp vs today's rules,
skips, queued): `node tools/routes.js status [--official | --gdlm]` (saved files + one replay each, no solving).

THE DEFAULT (the user, 2026-11-23: "let's by default solve with the human route, then in the limits we will
see"): every route that is saved or shown is the human route below. tools/solutions.js fromRun is the one
door every saving path goes through (make.js, wip.js, compose via make, polish, tests/saved_routes.js --fix);
official and community viewer routes take the same pass (difficulty_solve.js toViewer). Each saved route says
`kind`: "human"; "limit" when no human route finishes (the solver's raw route is kept, `why` says so);
"unbeaten" when the solver is stuck (`why`, `skipped`). tests/saved_routes.js fails a route that dies, skips,
or holds longer than needed (over 0.15 s outside ship/wave where a tap finishes).

1. **Valid first (hard rule):** a route must finish and skip nothing ("No secret ways" above).
2. **The search** (lib/physics.js solveSweep) ranks the states it keeps by: portals skipped (rejected), orbs and
   pads skipped, ticks close to walls in flying modes, then presses.
3. **The natural plan** (lib/natural.js) makes candidates from the solver's route: one tap per jump, no
   unneeded press, a flying controller's line per ship/wave/UFO/swing stretch, taps moved ~40% into their
   windows.
4. **The judge: human cost** (lib/difficulty.js humanCost, the difficulty session's: the difficulty score of
   exactly these inputs, plus presses, distance from the window middle, missed jump marks, beat; lower is
   better). With `naturalPlan(..., { cost: true })`, which tools/solutions.js uses when it saves a route,
   every choice between two valid routes (each flying stretch: the solver's line or the controller's; at the
   end: the natural route or the solver's own) keeps the lower cost. Without it (make.js and other quick
   paths) the rules of thumb decide: fewer close passes, then fewer presses.
   Cost: the first humanCost of a level is ~30 s on GDLM 44 (window measuring); measureWindows caches each
   window on the world `w` (difficulty, 48eeeac), so later candidates of the same level cost ~0.15-2 s.
   natural.js keeps one `w` per level for that reason.
5. **Orbs are taken buffered** (the user: "usually with orbs, when possible, we want to buffer"): the press
   comes 2-6 frames before the orb and is held until the orb fires on its first tick of contact (in the sim a
   press arms s.ring, kept while held; a ground jump uses it up, so a hold carried from a jump does NOT fire an
   orb -- UNCHECKED against the game, a lab station is asked of gd-physics2). natural.js bufferOrbs;
   tests/saved_routes.js warns on orbs no buffered press can take (natural.js unbufferedOrbs).
6. **Calibration (open):** tools/human_presses.js measures where the user really presses in each window
   from recordings; the difficulty session fits humanCost's `centre` weight (and the 40%) to it.

### The ship like a person, and the tap length (2026-11-24)
- The user, comparing their run with the solver's in the viewer: "the solver ship moves weirdly". `tools/shipstyle.js`
  (ship stretches only, the user's recorded runs vs the viewer route): the user flies ~1.5-1.7 presses a second, holds
  ~280 ms, lets go ~300 ms, never taps under 75 ms; the routes flew Stereo Madness, Back On Track, Polargeist and Jumper at
  5-6 presses a second, mostly taps under 75 ms (the fly controller's bang-bang steering with no dwell).
- lib/natural.js fly(): in a ship stretch the controller keeps each button state at least 40 ticks (then 28, 18, 0 if
  nothing longer finishes) and switches early only when the ship would leave the free space within 8 ticks; dead band 8.
  A ship stretch wins on smoothness (a quarter fewer presses for at most 15% more humanCost) and never takes a line over
  2.5 presses a second that adds presses to the line it replaces. After: Stereo Madness 1.7 presses/s, Back On Track 1.9,
  Polargeist 2.0, Jumper 2.2, Time Machine 0.6, Base After Base 2.2; no taps under 75 ms; all beaten; `tools/humanroute.js`
  flags none. So the "only inhuman input clears it" ship stretches were the planner, not the ship's physics.
  `tools/pathpic.js <n> --from --to --route a --route b` draws a stretch before / after (Jumper: local/shots/pathpic/).
- Tap length (outside ship/wave): the user, "60-90 ms for humans as default ... higher skill ... slightly smaller ...
  depends on the level". `tapMsFor`: 75 ms by default; by stars 1-2: 90, 3-5: 80, 6-7: 75, 8-9: 70, 10+: 60
  (difficulty_solve passes the official stars); `opts.tapMs` a level's own; `opts.player: "user"` the user's habit
  (tools/habits.js: median 120 ms). Was 14 ticks (58 ms) everywhere. tests/natural_tap.js.

### The wave like a person (2026-11-25)
- The user, on a GDLM wave corridor of 45-degree slopes: "really unnatural 'human' play, these corridors should be just
  few holds and releases. in tighter corridors we will need to fly tighter but in general we want to follow the pattern
  of the level". The solver's wave line zigzagged with small corrections inside each leg of the corridor.
- **The wave planner** (lib/natural.js waveLine, tried first in a stretch that is all wave): it looks WAVE_LOOK (150)
  units ahead and compares keeping the button, switching once, or switching twice, at any frame; each plan scores how
  far the wave strays out of the corridor's comfortable middle (the middle of the free space less WAVE_MARGIN (45) from
  each wall, so a wide corridor leaves room to hold on and a tight one asks for a tight line) plus WAVE_SWITCH (6) per
  switch. It follows the best plan and plans again at each switch and every 16 ticks, so each leg runs until the
  corridor turns. The free space now knows slopes (slopeY) and the wave's own hitbox (halfSize: 5, mini 3; was 15).
- **When its line is taken:** only where the solver's line is off the pattern (below), the new line needs no more
  presses, no more near-wall ticks in the stretch (+24) and in every flying stretch after it (+24: a new line re-solves
  the rest of the level), and at most 30% more humanCost.
- **Timing before presses** (the user, 2026-11-25: "its better to get an extra click or two than having a terrible timing
  ... mostly in the flying sections ... we can have a tas doing little clicks but human route should avoid bad timings").
  Every flying-stretch choice in fly() (wave planner, ship dwell controller, the humanCost / cleaner choice) checks the
  tightest player window of both lines (lib/difficulty.js measureWindows, as the viewer and score.js): a line whose tightest
  window is under EASY_MS (100) and over 4 ms tighter than the old one is never taken, and a line with up to 2 more presses
  is taken when the old line's tightest is under 100 ms and the new one's is at least 1.5x it (and no closer to the walls).
  Fewest presses is a tie-breaker among easy lines, never bought with a tight window. Lab: tightest 146 -> 183 ms.
- **Slide, don't hover** (the user, 2026-11-25: "many places wave avoids ground but probably in many of them we can slide on
  it avoiding the clicks in the middle"). The sim slides the wave as GD does: along a block's top or bottom face
  (physics.js `waveOn`) and the band's floor and roof, and kills it sliding off a block's end and flying head-on into a
  slope (both from the user's recordings, Calibration in CLAUDE.md). natural.js `sliding` (a wave with vertical speed 0)
  is never a near-wall tick and no stray for the wave planner, so a line that rests on a floor and lets the corridor come
  to it wins over one hovering above it with corrections. A slide off an edge shows in the planner's look-ahead as a death,
  so a slide ends with a press before the corner. Our levels, re-planned: GDLM 45 presses 18 -> 16, slides 37 -> 76 ticks;
  GDLM 64 39 -> 37, slides 45 -> 88; GDLM 47 and 52 unchanged in presses.
- **Off the pattern** (routeCheck `offPattern`, score.js route gate WARN "N inputs for M corridor turns (off the
  pattern)"): a wave stretch's inputs beyond the corridor's turns + 2 (turns: the free space's middle changing
  direction by 20+ units, sampled every 8 ticks, open air over 280 units skipped), counted only up to the number of
  quick re-presses (legs under 150 ms). Half-second legs over open hills (GDLM 52) follow their own pattern.
- **`node tools/flystyle.js <level | official:N | spec.json> [--replan] [--cost]`**: per flying stretch presses, presses
  a second, mean leg, legs under 100 ms, the tightest window, near-wall ticks, and the wave's inputs / turns / OFF PATTERN; --replan puts
  today's plan beside the saved route.
- Results (cloud, 2026-11-25): a lab of three zigzag corridors (gaps 6, 4, 3 blocks; local/tmp/wavelab.json, made with
  patterns.js wave-zigzag): off-pattern inputs 17 -> 4, legs under 100 ms 14 -> 1, presses 18 -> 13. Our wave levels'
  saved routes were already mostly on pattern by this measure: GDLM 45 off-pattern 3 -> 1, the rest unchanged by the
  planner (it is not tried where the line is on pattern). The user's corridor screenshot came from a re-plan, so the
  re-plan of the main levels with waves on the PC is the real test.
- OPEN: re-planning some of our levels from their saved routes flies worse than the saved route by near-wall ticks,
  with or without this change (GDLM 44: 0 -> 636 ticks today, 0 -> 932 before it, presses 15 -> 16 vs 22), and GDLM 68's
  re-plan skips a ship portal at x 14715 and takes ~11 min (cloud), and GDLM 71's re-plan takes over 30 min (also before
  this change: the commit before it, run side by side, was still going at 40 min).
- **Evgeni's catalogue comments are the planner's test cases** (knowledge/lego_votes.json, 26 by 2026-11-25, most on routes:
  wave too close to walls and spikes, "could slide here", too many clicks, UFO "fake" timings in wide areas, "wrong path"):
  `node tools/flystyle.js --cases [--replan] [--level N]` prints, per comment, the flying stretch it is in, saved route vs
  today's re-plan (PC only: the main levels are local). Two are sim questions, checked with `--trace <block>-<block>` (tick by
  tick: mode, y, vertical speed, button, grounded / slid-on-block / on-slope, free space): ToE2 block 237 "ufo jumps on the
  cliff, he slides?! it shouldnt" and ToE2 block 530 "wave seems sliding, wrong". What the sim does there (read from the
  code, the levels are not in the cloud): a UFO or ship that meets a block's side is neither pushed nor killed until its
  9x9 inner box enters the block, so its outer box can overlap a wall while it rises or falls past it (drawn, that looks
  like sliding up a cliff); it lands on a top only from at most FLY_SNAP (6) below. A wave slides along flat block faces
  and the band's floor / roof (calibrated on GDLM 44, see Calibration in CLAUDE.md) and along a slope it meets at a glancing
  angle. Traced (2026-11-25, `--trace`): ToE2 237 is no sim error -- the UFO stands on the cliff while any part of its
  30-unit box is on it (the cliff ends ~237.3, the box leaves it ~237.8) and the route jumps at 237.54, off the very edge,
  which reads as sliding. Planner rule from it (built 2026-11-25, lib/natural.js `edgeJumps`): a cube / UFO / robot press made
  while its centre is already past the support's end moves earlier, 4 ticks at a time up to 48, to the first tick still
  over the block that clears (later inputs shift with it). `GD.edgePresses(w, events)` lists such presses. Sweep of our
  archive levels: 3 (GDLM 51 at block 214.5, 61 at 637.5, 64 at 952.4), all a landing on the corner with the jump at
  once, so there is no earlier standing tick and the pass leaves them. ToE2 237 itself was not caught at first: the UFO
  walks 0.1 unit off the cliff and flaps in the air a few ticks later, so a UFO press within 12 ticks of walking off
  (falling, no press between) counts too. Main routes (`node tools/edge_presses.js`, saved routes on 058065f): 65 edge
  presses, Fingerdash 11, GD 7, ToE2 and Deadlocked 6. They go when the PC re-plans the mains. ToE2 530: the saved route does not slide there (one slide tick in 500-551); it flies parallel to the slope
  ~45 units above it. The re-plan slides 66 ticks in that stretch: to be judged by Evgeni in the viewer.
- Mixed flying stretches (ship -> wave -> ship, one span in fly()): the wave planner now takes the stretch's wave part
  (ToE2 895-924, 31 inputs for 9 turns, was never given to it while it asked for an all-wave stretch).
- OPEN: GDLM 44's ship at block 206 keeps the solver's line in fly() (the easier line came 121 ticks closer to the walls),
  but its tightest window still went 96 -> 79 ms in the re-plan: a pass after fly() (early / spreadPresses / mergeLegs)
  moved a press there. Those passes do not check the tightest window yet. Not the wave planner's (no wave stretch there is off
  pattern); the fly()/solveFrom re-plan of the ship stretches. Nothing is saved by flystyle; solutions.js keeps a saved
  route whose re-plan skips.

## The press library: what good players press at each structure (2026-11-24)

The user: "we should be a good player too, and that should allow us to solve better" and "how can we gain the knowledge
of the one doing the layout or somebody of that level, that knows how to play and what is expected of structures".
`tools/presslib.js` learns it from routes that clear levels, and the solver uses it as its first guess.
- **Examples:** every 60 fps frame of a clearing route (presses happen on frame boundaries in the user's game). Each is
  the player's picture (a 16 x 12 grid of 15-unit cells ahead of the player, x scaled to 1x speed, y turned with
  gravity; a cell shows its most telling object: hazard > jump mark > orb > pad > portal > block, the flying band's
  floor and roof as blocks) and state (mode, button down, on the ground, mini, vertical speed), and the label: did the
  player press (or let go) on this frame. Kept at four levels of detail: fine grid, 30-unit grid, the near 150 x 120,
  state only. A share is smoothed from the coarsest level to the finest (ALPHA 3), so a picture seen once counts a
  little and one seen 50 times nearly decides.
- **When the library presses:** the share is over `theta` and is at its peak (no higher in the next 3 frames on the
  path without a press): a player presses at the best moment, once.
- **Sources** (`--set`): `gdlm` our levels' saved human routes (local/solutions), `official` our main-level human routes,
  `gdsolver` gdsolver's real-game plans for the 22 (a plan our sim does not finish teaches up to 1 s before where it
  dies), `user` the user's attempts (local/attempts: viewer and recordings, each on the level version it was played on,
  a death teaching up to 1 s before it), `all`. RobTop's levels and anything learned from them stay in local/presslib/.
- **Held-out test** (`test`): each level is predicted by a library built from every OTHER level (all its clears left
  out together), along its own route: recall = its presses the library makes within 3 frames, precision = the
  library's presses that are one of them. Taps and flying (ship, wave) reported apart.
- **Playing by the library** (`solve`, `test --rollout`): the library drives the level frame by frame; where it dies (or
  skips a portal), a local sweep from a calm point 1 s back (then 2.5, 6) to 6 blocks past, then the library again.
  The result is a plain replay checked by GD.skipCheck: nothing in the physics changes.
- **Creator hints** (`hints`): start positions (id 31; kA2 mode, kA4 speed, kA3 mini, kA11 flipped -- sure:false, from
  memory of the format) are the creator saying "here the player is a ship at 2x": a route that is in another state there
  is probably off the intended path (`agreeStartPos`). Jump marks (our group 990) go into the picture as their own kind.
  Coins, orbs, pads, portals are counted. RobTop's main levels have no start positions; community levels do.

Results (cloud, 2026-11-24; our 11 GDLM levels solved there, 10 learned from, 1 predicted, each in turn):
| level | presses | found +-3 frames | library's extra presses | played by the library | full sweep |
|---|---|---|---|---|---|
| GDLM 02 (cube) | 11 | 9 | 0 | clears, 1 repair, 0.1 s | 0.5 s |
| GDLM 41 (cube) | 16 | 13 | 3 | clears, 2 repairs, 0.2 s | 0.5 s |
| GDLM 42 (cube) | 20 | 15 | 0 | clears, 5 repairs, 0.1 s | 0.6 s |
| GDLM 43 (cube) | 26 | 24 | 2 | clears, 4 repairs, 0.5 s | 1.1 s |
| GDLM 44 (ship, wave) | 37 | 15 | 11 | STUCK at block 426 after 9 repairs, 30 s | 63 s |
| GDLM 45 (ship, wave, ball) | 45 | 15 | 9 | clears, 9 repairs, 69 s | 77 s |
| GDLM 46 sketch | 22 | 0 | 1 | clears, 5 repairs, 31 s | 17 s |
| GDLM 47 (modes, 109 presses) | 109 | 54 | 17 | clears, 11 repairs, 77 s | 89 s |
| GDLM 50 | 42 | 18 | 12 | clears, 6 repairs, 45 s | 54 s |
| GDLM 51 | 51 | 15 | 9 | clears, 8 repairs, 90 s | 103 s |

theta 0.2, peak rule on. Over all 11: taps (cube, ball, ufo, robot, spider, swing) 47% of the presses found at 75%
precision; flying (ship, wave) 18% at 38%. A state-only library (mode, button, ground: no picture) finds 1%: the picture
is what carries it. theta 0.15 / 0.25 / 0.35 on taps: recall 55 / 40 / 34%, precision 77 / 88 / 93%.
What it says:
- Cube levels: the library's own play clears with a few repairs, 2-5x faster than the sweep. Our 5 cube levels are
  similar, so this is the easy case.
- Levels with modes: 12-16% faster on 4 of 6, slower on GDLM 46 sketch, stuck on GDLM 44. Almost all the time is the
  local searches in ship and wave parts, which the library cannot play (ship presses are steering, not answers to a
  structure). A ship part is searched once to its end (a repair bit by bit cost 132 s on GDLM 45, then 69 s).
- So the library is a first guess for tap parts. Ship and wave stay with the sweep and natural.js's flying controller.

The PC run (2026-11-24, `test --set all`: 114 of 115 clears -- gdsolver's plans, our main-level routes, the GDLM routes,
the user's attempts; Hexagon Force, Deadlocked and Dash left out while they are re-solved): taps 4380 presses, recall 26%,
precision 75% (+-3 frames); flying 1728, 8% / 52%; all 21% / 71%; the state-only baseline 0%. Best on plain cube levels
(GDLM 42 15/20, GDLM 02 9/11), worst on the later main levels (Clubstep 1/136, Theory of Everything 4/137).
Read: precision holds across sources (what it presses is right three times in four), recall falls on the dense later
levels, where the pictures are rarely seen twice in 112 other levels. Likely causes, untested: gdsolver's plans are raw
solver inputs (holds through landings, presses at a window's edge), so they teach where a press CAN go, not where a
player puts it, and they disagree with our human routes on the same level; the picture has no memory of what the player
just did (orb chains, pad-orb pairs). Next for the library: learn from human routes and the user's attempts only and
compare; add the last action to the state. The rollout test on the main levels waits for the re-solve.

Next (not built): (1) the main-level test on the PC: `node tools/presslib.js test --set all` (light, no slot), then
`test --set gdsolver --rollout` at low priority -- 22 levels and gdsolver's real-game plans are the data that matters,
our 11 are a small, alike set. (2) The library inside the sweep instead of beside it: rank the beam's states by how
well their presses agree with the library (after portals and wall-hugging), so the search tries the good player's
press first in every mode, with no repairs. A change to lib/physics.js solveSweep (gd-physics). (3) Real start
positions from community levels: solve sections from each start position separately, then join (incsolve's section
cache). (4) The viewer: the library's press share on the button strip beside the route.

## The intended route (solver ranking)

The sweep solver (solveSweep, used for every level with modes) does not just find the fewest presses:
it ranks routes by, in order, portals passed without taking them (mode, gravity, speed, size,
teleport), then orbs and pads passed unused, then presses (`opts.anyRoute` = the old fewest-presses
only; `opts.strict` = a route that skips any portal is out, to find where the intended route dies).
Why: the user on the Deadlocked level map, 2026-11-23: "The player skips the portal ... In normal
levels you usually dont skip portals". The old cached Deadlocked run skipped the cube portal at block
38 and stayed a mini wave past 40+ portals, orbs and pads. With the ranking (and the turned teleport
exits above) Deadlocked's portal-taking route reaches block 434.9 (37%; was 26-31%), dying in the
ball part on a hanging spike near the turned teleport at 441.5. Third in the ranking, before presses:
flying ticks (ship, wave, UFO, swing) spent closer to a wall than half the way to the corridor's middle (at least 12, at most 45 units; a flat 12 left Jumper's ship 12-15 units off spike rows with 150-210 of room, now 23-41, centring 0.6 -> 0.72); two tiers, very near (12) ranked first: Deadlocked's wave/ship median clearance 28 -> 47 units, ticks within 15 units 24% -> 5%, centring 0.78; Jumper 0% within 15). The wave keeps the middle 70% (not half): it only moves at 45 degrees, and holding the middle half of a flat corridor made runs of 3-frame zigzags; Deadlocked's 14-17.5 s went from 21 to 15 presses, median clearance 47 -> 41 -- a solid, hazard, slope or the
band's floor/roof ("he waves way too close to the border"); this works on unbeaten levels too, where
lib/natural.js's mid-corridor re-fly (beaten levels only, and all-or-nothing per stretch: on Deadlocked
it died inside every stretch) cannot. GDLM 44: 8 presses instead of 6.

Deadlocked's ball lanes (2026-11-23): the solve stopped at block 436 on a row of id 1202 (a 30x3 piece
with spikes hanging under it) that the sim called a hazard. Settled without the editor: OpenGD's own
object table gives 1202 GameObjectType 0 (solid: block 1 and slab 40 are 0, spikes 2, decoration 7);
only tools/import_opengd.js's fallback ("a hitbox that is not in the solids list is a hazard") made it
a hazard. 37 ids have that mismatch, all block-outline, plank and outline pieces, among them 661-664
and 1903-1905 that real-game plans had already shown solid. lib/objects.js's SOLID0 makes them all
solid (sure:false). Check for the next import: `node -e` over lib/objects_art.js (type = field 5)
vs lib/objects_extra.js lists any id whose type is 0 but kind is hazard.
The same misfire hit the editor's lettered helper blocks D 1755, J 1813, S 1829, H 1859 (OpenGD type
40, "Special" in Geode's GameObjectType enum; invisible in play): 30x30 killers in the sim, Fingerdash's
6% stop (found by the difficulty session, 2026-11-23). Now decoration (sure:false: what each letter does
to other objects is not simulated). The real-game plans for 21 and 22 die earlier and are unchanged, so
they neither confirm nor refute it. tests/art_tables.js fails if a type-0 or type-40 id kills. Every
other hazard is type 2, except 1304 (type 7, decoration in OpenGD, but GD 2.2's decoration list leaves it
out too: left a hazard, unchecked).

2026-11-24: the user's Deadlocked practice run passes this spot (GD claude-rec 2026-11-24_00-33-07.mkv, practice
complete, 30 attempts). The teleport's exit is absolute (portal y + 54, x kept; GDLM 60 station 2), so every
player reaches the corridor mouth in the same place: the game clearing it means one of the three candidates
below is wrong in the sim. Frames of that moment (hitboxes on in practice) can now settle which: open.
With that and the quarter-turned teleports, Deadlocked's solve reaches block 695.4 (59%, physics 119344c):
a ship takes a plain teleport (20887, 54 = -94) into a low corridor and its box overlaps a sideways
spike (421) at the corridor's mouth by 1.6 units. Tried and ruled out (sweeps of
2400 units from just before, scratch flags): moving the player by 54 relative to its own height (same
death); firing the teleport at the portal's centre instead of first touch (passes only by skipping 3
portals, and kills the -53 degree portal at block 76 that fits now). Also ruled out: skipping the rest of the
tick's collisions after a teleport (the death is on the next tick: at x 20862.3 the ship's box overlaps
the spike by 1.3 units in x and 4 in y). The exit at the corridor's left mouth looks intended (the
corridor runs right to two gravity portals and the next teleport at 21561). Still open, unmeasured:
the teleport's trigger width (25, sure:false; ~22 would clear it), the ship's hazard box, spike 421's
box. Wants a hitbox-on recording of this spot (Deadlocked ~58.5 s).
## Incremental solving (lib/incsolve.js, 2026-11-23; owner: the incremental-solving session)

The user: "how can we reuse the solver data between runs, cutting, splitting. 5 minutes per re-solve sounds
too much." A re-solve no longer has to start at the level's start. Everything below is exact or checked by a
replay; nothing is trusted on a guess.

**What a saved route keeps** (tools/solutions.js `put`, via `incSave`): `checkpoints` -- the exact sim state
about every second, at a calm tick when there is one (`[tick, button down going in, state]`, 3-20 KB a level);
the level itself by hash (`local/solutions/lv/<hash>.gz`, tools/inc_store.js); and its sections in the
section cache (`local/incsolve/sections/`).

**States compare exactly** (`canon`, `sameState`): every field of the state is compared (generic: a field a
later change adds, like dual's `p2`, counts at once), with object indices (`used`, trigger keys of
`fired`/`stopped`/`offDone`/`lockAt`) turned into object identity, so two versions of a level compare. Triggers
that only move decoration are left out. Equal states at one tick under one level stretch give the same future:
that is the whole basis of rejoining.

**Calm** (`calm`): grounded, not dashing, no orb flag, not on a slope, not in dual, and every trigger that acts
on something the player can touch has finished (no pending spawn delay, no move/rotate under way).

**1. Edit re-solve** (`fromBase(oldLevel, oldRoute, newLevel)`, `resolve`): diff the objects (`objKey`: all
keys), find the x range the change can touch the player in (`influence`: hitbox x range; a moved group's
reach; a trigger's x and its group's reach; decoration nobody moves: nothing; a spawn trigger, a rotate
centre or a header change: solve whole, says why). Replay the old route on the new level, check its prefix
against the checkpoints, start from the last calm tick 1 s before the change (then 3 s, then 8 s), and search
(solveSweep from that state) with `opts.goal`: the search ends the moment a state is the old route's exact
state with the same button at a tick past the change. The old rest is spliced back, the whole new route is
replayed and must finish and skip nothing (the no-skip rule stays on). Then the natural plan runs only on
that window (`naturalPlan(..., { window: [from, to] })`; its flying controller's own solveFrom also stops when
back on the route). A decoration-only edit keeps the route as it is.
Wired in: `tools/make.js` (via `tools/check.js report(file, { base })`) re-solves an existing level from its
previous build's saved route (`--full`: the old way); `tools/solutions.js fromRun` plans only the window.

**2. Section cache** (`sectionsOf`, `cacheRoute`, `useCached`, `solveWithCache`): a route is cut at calm ticks
in a plain mode (cube, robot, ball, spider) at least 2 s apart. A section is keyed by its entry state (without
x) and the objects that can touch the player in it, their x taken from the grid column the section starts in
-- so a section moved by whole blocks (cutting, joining) keeps its key. The player's phase inside a column is
not in the key, so every cached section is replayed from the real entry state before it is used.
`solveWithCache` walks a level: a cached section wherever one fits, else a search from there until a calm
state where a cached section starts (a seam). Cutting and joining levels therefore solve only the seams.

**3. Physics / planner change** (`refresh`): replay the saved route first; kept when it still finishes and
skips nothing. Else the stretch from the first checkpoint that replays differently (or where it dies or skips)
is re-solved from the calm tick before it until the run is back in a saved checkpoint state, and the old rest
replayed under the new physics must finish. tools/solutions.js `solve` does this before a full solve.

**4. Windows** (`windowsIncremental`): an input's window depends only on the run from difficulty's MAX_SHIFT
before it to its look-ahead after the next input (difficulty's own exact cache key), so an old window is kept
when the state there, the button over that span and the objects in that x range are all unchanged.

**Tests:** `node tests/incsolve.js --quick` (no search: exact states across a reordered object list,
checkpoints restore, edit ranges, decoration-only edits, a level rebuilt from its cached sections, a cut).
`node tests/incsolve.js` adds edits of GDLM 41 re-solved both ways. The study: `node tools/incsolve.js study
<level> --edits N --seed S` -- random one-spot edits (move a hazard, solid, orb or pad a block, or delete it),
incremental vs full: both beat it or neither, incremental humanCost <= full + 0.02, time of each; rows in
`local/incsolve/study.jsonl`.

**Where a full solve's time goes** (GDLM 45, 40 s, ship + wave, 2026-11-23): 268 s = the search 128 s + the
natural plan 140 s (its flying controller's 3 solveFrom calls 38 s, 6 humanCost calls 92 s -- each measures every
window of the whole route on a fresh world). So an edit re-solve must cut all three: the search (start late, stop
at the rejoin), the natural plan (window only) and humanCost (windows carried over: difficulty's
`carryWindowCache(wOld, wNew, ranges, aToB)`, 2c577f7; fromBase and solutions.fromRun call it).

**Results** (`local/incsolve/study.jsonl`; incremental vs full on the same edited level):

| level | edit | incremental | full | cost inc / full |
|---|---|---|---|---|
| GDLM 41 (cube, 17 s) | spike moved 1 block | 5.7 s (searched to the end) | 6.5 s | 0.276 / 0.311 |
| GDLM 41 | raised spike moved 1 block | 0.8 s (rejoined after 340 ticks) | 6.2 s | 0.280 / 0.276 |
| GDLM 45 (ship/wave, 40 s) | spike moved 1 block | 252 s (rejoined; old goal check: 200 s of it) | 268 s | 1.246 / 1.246, same route |
| GDLM 45, 2026-11-23 cloud, after the speed-ups below | same spike (cube, just before the ship portal) | 25 s (search 1.2 s, rejoined at the ship's end; the rest: humanCost of the new 6.5 s ship stretch) | 106 s | 1.241 / 1.246 |
| GDLM 45, same | block moved 1 block (ball part) | 4.4 s (search 0.2 s) | 121 s | 1.148 / 1.186 |
| GDLM 45, same | another block moved (ball part) | 2.1 s (search 0.2 s) | 120 s | 1.148 / 1.186 |
| GDLM 61 (cube/ship/ball, 72 s), same | block moved 1 block (cube) | 4.4 s | 124 s | 0.928 / 0.928 |
| GDLM 61, same | hazard moved 1 block up (inside the ship) | 63 s (beam 100 died in 0.2 s; full beam 53 s) | 120 s | 0.908 / 0.935 |
| GDLM 41, cut (section cache) | cut at x 2662 | 0.5 s (4 sections reused, 1 seam) | 0.7 s | 0.153 / 0.153 |
| GDLM 41, joined with itself | +5430 | 1.6 s (7 reused) | 5.4 s | 0.566 / 0.556 |
| GDLM 61, cut | cut at x 11060 | 10 s (12 reused) | 68 s | 1.624 / 1.667 |
| GDLM 61, joined with itself | +22800 | 206 s (36 reused; 4 seams, the first 10 000 ticks: the ship and ball stretches have no cut point) | 253 s | 1.858 / 1.935 |

**Speed-ups (2026-11-23, the cloud session; every solver gains, not only re-solves):**
- **State copies were 90x too slow.** On V8 (node 22) `Object.assign({}, state)` of a 20+ field state makes a
  dictionary-mode object: 5.8 us a copy and slow field reads in every step. `{ ...state }` keeps the fast shape
  (64 ns). Changed in lib/physics.js `clone`, difficulty.js `cloneS`, natural.js, windows.js, incsolve.js,
  tools/fairness.js. **Rule: never copy a sim state with Object.assign({}, s); spread it.** GDLM 41 whole solve
  (search + natural plan + humanCost) 9.0 s -> 1.6 s, the same route (hash) and cost; a cold humanCost of GDLM 45's
  ship part 31 s -> 11.5 s (with the two below).
- `near(w, x)` (lib/physics.js) builds each column span's object list once per world (`w._near`); same order.
- fireTriggers walks every fired trigger each tick for toggles only when the level has a toggle (`T.hasToggle`).
- `resolve` searches with a narrow beam first (`opts.caps`, default [100, full]): the rejoin is exact and the
  spliced route is replayed, so a narrow beam risks only a miss (then the full 6000). GDLM 45's ship edit: the
  same rejoin tick in 1.2 s instead of 113 s.
- Measured how: `node tools/incsolve.js study ...` rows; `node --cpu-prof` on a humanCost with the ship part's
  windows removed from the cache (cloneS was 45% of it before).

**Where an edit's time goes now** (GDLM 45): an edit whose effect cannot rejoin inside a flying stretch (a ship
cannot come back to the old route's exact y and vy mid-air; it rejoins where the stretch ends) re-plans the whole
stretch: the natural plan costs 4 routes with humanCost, each measuring the stretch's windows (~6 s each for 6.5 s
of ship). Fewer humanCost calls in a window re-plan (lib/natural.js, physics) or a cheaper window measure in a
flying stretch (lib/difficulty.js, difficulty) are the next cuts; asked both in this section.
A beam between 100 and 6000 does not help inside a ship corridor: on GDLM 61's ship edit 200 and 400 die, 800 finds
a route that costs 0.954 (full solve 0.935, the full beam 0.908): the sweep's ranking keeps the fewest wall-hugs
and presses, so a narrow beam loses the heights that get through. A beam that keeps the best state per height band
(solveSweep, physics) would let a narrow search work in flying stretches too.

**Open:** the rejoin search on flying stretches keeps thousands of states a tick (the goal check now compares a few
raw fields first); humanCost on a new world in a new process starts cold until the window cache is saved with the
route (asked difficulty for export/import); sections are only cut in plain modes, so a level that is all ship has
one section; the cache keys sections on whole-block moves only.

### Incremental solving -- hand-off (2026-11-24, from the local session to a cloud session)

**Done (all on main):** lib/incsolve.js (diff, influence, exact states incl. dual p2 and every trigger-keyed
field, calm points, checkpoints, `resolve`/`fromBase` edit re-solve with rejoin, `refresh` after a physics change,
section cache + `solveWithCache`, `windowsIncremental`, `carryWindows`), tools/incsolve.js (`study`, `cutjoin`,
`profile`), tools/inc_store.js (local/ files), tests/incsolve.js. Wired in: make.js -> check.js `report(file,
{ base })` re-solves an existing level from its previous build (`--full`: whole); solutions.js `fromRun` plans
only `r.inc`'s window and carries windows from `r.world`, saves checkpoints, the level, its sections and the
window cache with every route; `solve` tries `refresh` before a full solve. tools/edit.js (gd-edit) calls
`fromBase`; it was told to pass `inc` and `world` on to fromRun (not checked that it does).

**Results so far:** the table above. In short: GDLM 41 one-spot edit rejoined: 0.8 s vs 6.2 s full, cost 0.280 vs
0.276; GDLM 45 (ship/wave): same route and cost as full, but 252 s vs 268 s -- 200 s of it the rejoin search
(fixed since: the goal compares raw fields first, NOT yet re-measured) and 50 s humanCost on a cold world (fixed
since: window cache carried, NOT yet re-measured). No row yet for GDLM 61, cuts or joins (`cutjoin` never ran).

**Done 2026-11-23 (cloud):** items 1-3 of the old list: GDLM 45 and 61 re-measured, cut/join measured, tests/incsolve.js
passes (3 GDLM 41 edits within 0.02 of full). The table above has the rows. Every incremental result passed and
cost at most full + 0.01 (most cost less: the old human route is kept outside the window).

**Next, in order:**
1. Flying-stretch edits (GDLM 45's ship 25 s, GDLM 61's 63 s): fewer humanCost calls in a window re-plan
   (natural.js `fly`/`plan` cost 4 routes; ask physics), a cheaper window measure in flying modes (ask difficulty),
   a height-diverse beam in solveSweep (ask physics) so the 100-state first try works in corridors.
2. Joins of mode levels: sections are only cut in plain modes, so a join re-searches each ship/ball stretch whole
   (GDLM 61 joined: 206 s vs 253 s). Cut flying stretches too, at a state the search can re-enter (a portal exit,
   a wall-touch), or key a flying section by its entry state and replay it.
3. Widen the study: `node tools/incsolve.js study <level> --edits 3 --seed N` over every level in levels/ and
   examples/ (cube ones are seconds now; mode ones ~2 min each for the base solve, then the full solve per edit).
4. Fill the time table in CLAUDE.md as rows come in (done for what is measured).
5. Use the rejoin goal in tools/difficulty_solve.js --resume (physics' suggestion) -- agree with gd-difficulty /
   gd-physics first.

**Cloud notes:** local/ is not there, so no saved solutions, checkpoints, sections or window caches: `study` and
`cutjoin` solve the base level fully first (1-2 min for a mode level since the speed-ups) and save it as make.js
would, so the next run of either starts from it; use only the levels in git
(levels/, examples/). The heavy lock (tools/heavy.js) still applies inside the tools.

**Agreements:**
- gd-physics (owner of lib/physics.js, natural.js): hooks `solveSweep opts.goal` and `naturalPlan opts.window`
  (d68d0df), no change when unset; the no-skip rule stays on in every partial solve (skips()/reach in the sweep,
  GD.skipCheck on every spliced route); run tests/mechanics.js, saved_routes.js, tas_progress.js before pushing
  changes to them (mechanics and tas_progress pass with the hooks; saved_routes' 4 failures were stale saved
  routes, physics is refreshing them).
- gd-physics2 (triggers, dual, moving objects): all state in `s`, plain data, copy-on-write; index-keyed fields
  `used`, `p2.used`, trigger-keyed (`k` or `k.n`) `fired stopped paused psum tgt fol offDone lockAt nfire`,
  `pend` [[tick, k]], `off` by group, `tp` a position in byX. A new index field must be added to
  lib/incsolve.js `canon` (TRIG_MAPS) or states across edits compare wrong.
- gd-difficulty: window reach is 48 ticks back, max(T, nextT) + 48 + 240 ahead; `measureWindows opts.ticks`
  (7b03ee1), `carryWindowCache(wOld, wNew, ranges, aToB)` (2c577f7), `exportWindowCache` / `importWindowCache`
  (f0d483d).
- gd-style's intended-route plan: not discussed with this session; ask gd-style how its route ranking should
  apply inside a partial re-solve before changing the sweep's ranking there.
