# Physics -- what the sim does, where each number comes from, how it is checked

`lib/physics.js` (one copy, used by the solver, the checker and the viewer) and `lib/objects.js`
(object ids). CLAUDE.md's Calibration section lists the facts checked in the user's own game;
this file is the map per mode and per trigger. Last full update 2026-11-22.

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

A plan's tick t is our step t-1 (`tools/tas.js` shifts it). Plans reach, in blocks (2026-11-22):
1: 328, 2: 493, 3: 909, 4: 415, 5: 175, 6: 303, 7: 210, 8: 333, 9: 382, 10: 167, 11: 288, 12: 33,
13: 116, 14: 30, 15: 267, 16: 141, 17: 295, 18: 105, 19: 100, 20: 32, 21: 54, 22: 81.

## Modes

| mode | constants (1x) | source | checked by |
|---|---|---|---|
| cube | jump 11.18, gravity 0.958/tick*0.9, fall clamp 15, landing snap 15, inner kill box 9 | gdp | video: whole jump arc 1.3 px rms; gravity 0.78 u/frame^2 |
| ship | hold +0.108/+0.086, release -0.069/-0.103, switch at 2g (world terms, also upside down), limits +8/-6.4 | gdsolver | video: hold +0.40, release -0.25 u/frame^2 |
| ball | tap = jump, flip (halves) x0.6; gravity 0.6x0.958 | gdsolver | video: +-0.47 u/frame^2 |
| UFO | flap to 7, gravity 0.086 / 0.129 (see UFO below) | gdsolver | plans only |
| wave | 1 unit up per unit forward (mini 2); contact half 5 (mini 3), dies on a solid with half 1.5, band clamp 10 (mini 6) | gdsolver + video | video: mini wave trail 2.00:1 |
| robot | jump 0.5x, gravity 0.9x, hover 67 ticks while held | gdsolver | plans only |
| spider | half 13.5, teleports to the facing surface | gdsolver | plans only |
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

Official levels (dual portals): Hexagon Force 351.7-503.4 (cube), 640.3-709.8 (ball), 944.8-995.2 (mini
ship); Blast Processing 512.3-554.0 (wave); Deadlocked 859.2-910.9 (wave). Before this, 286/287 were
"unsupported" (a death on touch, and NOT on the no-skip list), so Hexagon Force's "beaten" and Blast
Processing's 78% went around every dual portal: secret ways. Their saved routes, replayed with dual:
Hexagon Force dies at 362.8 (player 2 on a spike), Blast Processing at 564.4. Re-solves: see below.

## Not in the sim yet (the game has it)

Modes/portals: mirror. Teleport portals (747) are in, unchecked: same x, speed kept, exit height = portal y + key 54 along the portal's turned axis (54 x cos(rotation)), but the full 54 straight up/down when key 55 is set or the portal is turned a quarter (90/-90/270: cos would make it a no-op; Deadlocked's ball part 441-561 passes only so, neither "no move" nor "x moves by 54" does -- "angle mod 90" fits the same cases) (fitted on Deadlocked, 2026-11-23: its -53 degree portal at block 76.5 needs the turned offset to pass under a spike; its -46 degree portal with 55 at 360.8 lands exactly on the gravity + speed portals 224 below; whether GD also moves x is not known; smooth teleport and the 2.2 options 345+ not modelled); first used by Deadlocked at block 77, Fingerdash 205, Dash 435. Triggers: count/pickup items,
scale, follow, on death, collision blocks, area triggers, gravity trigger, time warp. Others:
keys and user coins (collectables only), start positions (levels always start at x 0), practice
checkpoints, speed portals touched mid-air at a slant, force blocks, platformer mode, dash orbs'
unknown props 586/588, spike slopes.

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
- An **orb or pad** is "clearly meant to be taken" when the route's player box comes within 15 units of it
  (on the route's own line). The sweep already takes as many orbs as any route can, so a finished route that
  still leaves one like that is reported stuck: `why: "skipped an orb/pad"`, `skipped: "<name> at x <x>"`.
  An orb far off the line (above a corridor, a decoration orb) is not required. Optional orbs a level means
  as optional: none marked yet (a spec key "optional" on the object would be the way; not built).
- On official and rated levels a stuck like that is a **physics bug at that object**: our sim cannot take
  what the game's players take. Never report a % or "beaten" that came from a skip.
- Not yet covered: leaving the intended space without skipping anything (over a ceiling, outside a
  corridor); the sky limit (300 above the highest object) is the only guard.
- `opts.allowSkips` brings back the old ranking for debugging only. Tests: tests/mechanics.js "no-skip".
- The shared check is `GD.skipCheck(w, path, events)` (null = clean; else the stuck result).

## How the route is chosen (the natural route)

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
