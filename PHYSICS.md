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

## Objects

- Hitboxes from OpenGD's 2.1 table, overridden in `lib/objects.js`; GD 2.2's decoration list
  (`lib/objects_gd22.js`) beats it. Scale (keys 32, 128/129) grows boxes and saw radii.
- Off-grid rotations: hazards are tested by their turned box (SAT, `obbHit`); solids by the box
  around it.
- Saws: player box against the circle (GD's playerCircleCollision branch B).
- Orbs: touched at the end of either of the last two ticks; rotated orbs use turned boxes.
- Slopes: floor slopes, and ceiling slopes (flipped / half-turned) for the ship and an upside-down
  player. Quarter-turned slopes act as blocks.
- Found by plans: 143 one-way platform; 661-664, 1903-1905 slabs; slab 40 centred; 5/73/80 scenery;
  a blue pad flipped with key 5 faces down.

## Triggers

`node tools/triggers.js` over the official levels (2026-11-22): most trigger ids are looks only --
colour 29/30/899/105/221/744/915/900, pulse 1006, alpha 1007 (still collides), enter effects 22-28 /
55-59, shake 1520, animate 1585, camera 1913/1914/1916/2015/2016/2062, trail 32/33.

| trigger | id | keys | in sim | checked |
|---|---|---|---|---|
| move | 901 | 51 target, 28/29 x/y (30 = a block), 10 duration, 30 easing, 85 rate | yes, all easings | lv22: cube lands on blocks a move raises, jumps on the plan's tick |
| toggle | 1049 | 51, 56 on | yes | plans (lv19, 22) |
| spawn | 1268 | 51, 63 delay | yes | plans |
| rotate | 1346 | 51, 71 centre group, 68 deg + 69 turns, 70 lock | yes (hitboxes turn too) | fires in lv22; no plan depends on it yet |
| stop | 1616 | 51 = group of the triggers to stop | yes | none yet |
| count / instant count / pickup | 1611 / 1811 / 1817 | items | no (lv21 at 630, lv22 at 95) | - |
| scale | 2067 | 150/151 | no (lv22 from 70) | - |
| on death | 1812 | | no | - |
| follow | 1347 | | no (lv22 at 535) | - |
| collision block / trigger, area triggers | 1815/1816, 3006+ | | no (no official level uses them) | - |

Firing: x passing the trigger's x; touch-triggered (11) when the player's box meets its 30x30;
spawn-triggered (62) only from a spawn trigger. Move "lock to player" X/Y (58/59): for its duration
the group moves by the player's own motion since the trigger fired, then stays (plus any dx/dy);
UNCHECKED against the game, added 2026-11-23 for Spire (community 128630430), whose upside-down
cube rides under a roof locked to the player: its solve went from block 112.7 to 327.6 (the next
stop is another "sky" death near the ball part, not looked at). Not modelled: "move to target"
(100), the player carried sideways by a moving block, multi-trigger (87).
The viewer draws moved, turned and switched-off objects where they are at each moment (GD.posedObjects).

## Not in the sim yet (the game has it)

Modes/portals: dual (286/287), mirror. Teleport portals (747) are in, unchecked: same x, speed kept, exit height = portal y + key 54 along the portal's turned axis (54 x cos(rotation)), but straight up/down when key 55 is set (fitted on Deadlocked, 2026-11-23: its -53 degree portal at block 76.5 needs the turned offset to pass under a spike; its -46 degree portal with 55 at 360.8 lands exactly on the gravity + speed portals 224 below; whether GD also moves x is not known; smooth teleport and the 2.2 options 345+ not modelled); first used by Deadlocked at block 77, Fingerdash 205, Dash 435. Triggers: count/pickup items,
scale, follow, on death, collision blocks, area triggers, gravity trigger, time warp. Others:
keys and user coins (collectables only), start positions (levels always start at x 0), practice
checkpoints, speed portals touched mid-air at a slant, force blocks, platformer mode, dash orbs'
unknown props 586/588, spike slopes.

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

Open (2026-11-23): Deadlocked stops at block 436 in the mini ball part (three lanes; the middle one is a
row of id 1202 -- a 30x3 piece with spikes hanging under it -- that the sim calls a hazard by OpenGD's
"hitbox and not solid" rule). As a solid platform the solve gets to 456.6; no real-game plan reaches a
1202 to settle it. Waiting on the user to check 1202 in the editor (platform or hazard).
