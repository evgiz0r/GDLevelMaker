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

## GDLM 67 physics questions lab (2026-11-24; built by the dual/moving-objects session, NOT played yet)

`tools/lab67.js` -> specs/67_physics_questions_lab.json -> levels/gdlm_67_physics_questions_lab.gdlvl (19 stations; the two ship-entry ones added by the physics session).
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

## Landing buffer (2026-11-24)

A cube's press made in the air is kept and the cube jumps when it lands, even if the button is already up.
- Seen in the user's real run: Clutterfunk, 2026-11-24_02-45-05.mkv, level time 1.055 s. The input log has a
  tap in the air (down 1.055, up 1.167), the cube lands at 1.20 s and the video shows it jump at once, 0.45 s
  before the next logged press. Without the buffer the sim walks into the saw at x 451 (1.9%); with it the run
  goes on. The sim needs at least 37 ticks there (36: the saw; 37-1000: through).
- gdsolver's real-game plans (tests/tas_progress.js), for any length from 24 to 1000 ticks: Polargeist CLEARS
  (was 909 blocks), Dry Out 415 -> 574, Can't Let Go 303 -> 489, Jumper 210 -> 248, Time Machine 333 -> 362,
  Clutterfunk 288 -> 294; none less far once an orb or pad that takes the press also clears the buffer
  (without that, ToE 2 fell 105 -> 92). This was the old open item "a cube that walked off a ledge and presses
  shortly before landing: the game jumps, we do not".
- ONLY WHILE FALLING, NO TIME LIMIT (2026-11-24, second Clutterfunk attempt, 18.43 s of 02:45, fixed logger): a tap
  53 ticks before landing, made just after the peak of a yellow-orb arc (vy -1.6), released in the air: the game jumps
  on landing (the user clears); with 40 ticks the sim walked onto the yellow pad at 34.5 and was thrown into the
  hanging spikes (3.5%). A longer buffer for every press broke Geometrical Dominator (taps 45-63 ticks out made while
  still RISING: 7.3% -> 5.4%, 5.7% -> 2.7%) and Hexagon Force (40.6 -> 38.1 from 80 ticks). Buffering only a press
  made while falling (vy towards the ground, or 0) fits all 21 recorded attempts for any length from 40 to infinite,
  and gdsolver's 22 plans reach exactly the same blocks. Clutterfunk now dies at 3.9% (a tap that jumps the cube into
  a low hanging spike at 38.6: not understood yet; the video clock there needs a frame check).
- In the sim: lib/physics.js, cube only, the solvers' state keys carry it: a press in the air while FALLING is kept
  until landing (`LANDBUF`, Infinity); one made while still RISING is kept 40 ticks (`LANDRISE`), as before -- no
  recording shows a rising press ignored that close to landing, and the solvers' routes rely on it (gd-physics2's
  bisect: falling-only had broken Time Machine 29, Clubstep 108, Can't Let Go 727, Electroman 407). Cleared by the
  landing jump, an orb or pad, or leaving the cube. tests/mechanics.js checks a falling tap 50 ticks out (jumps) and a
  rising one 73 ticks out (does not). Every press of the original evidence (Clutterfunk 1.054 s, 36 ticks; 2.942 s,
  53 ticks) was made while falling.
  `GDLM_LANDBUF=<ticks>` makes it a countdown again for measuring, 0 = off. OPEN: the exact falling threshold (vy 0? a
  little before the peak?),
  and whether a release clears it in other modes. A clean test: tap in the air at several heights before a
  landing in a lab level.

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
