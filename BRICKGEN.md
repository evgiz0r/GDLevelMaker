# Brickgen -- our own bricks, generated presses-first

Evgeni, 2026-11-26: "lets start thinking about generating our own structures too". He then said that RobTop's
structures are decent and the poor ones are **ours**, the library pieces we made by studying the main levels
(tools/structures.js shapes, the `lego-*` fly paths). So the official bricks are the **judge** of what we generate. Our
hand-made pieces get replaced whenever a generated piece beats them in the same slot.

Owner: the "Generate our own structures" thread. Code: `tools/brickgen.js`. Results: `knowledge/brickgen.json`
(committed, shapes only). Each kept brick is also a structure, `g-<mode>-<tier>-<n>`, through tools/structures.js. That
makes it a pattern (`"s:g-ship-normal-1"`), and `structures.js check` gives it the full gates, so brickpick and compose can
use it.

```
node tools/brickgen.js gen [--mode ship,wave,ball,ufo] [--tier Normal,Hard] [--n 150] [--keep 10] [--seed 1]
node tools/brickgen.js list [--mode ship]       # kept bricks, judge score, presses, cps, tightest window, kind
node tools/brickgen.js show <id>                # numbers + a text map with the planned path (o)
node tools/brickgen.js build <id>               # its test level -> local/structures/<id>.gdlvl
node tools/brickgen.js lab [--mode ship]        # specs/lab_brickgen_<mode>.json (all kept bricks of a mode in a row)
node tools/make.js specs/lab_brickgen_ship.json # -> levels/gdlm_lab_brickgen_ship.gdlvl, the viewer's "lab" tab
node tools/structures.js check g-ship-normal-1  # the full gates on one (beatable, prejumps, fairness, skips ...)
```

## Verdict on the first batch (Evgeni, 2026-11-26 20:46 UTC): "all to the garbage"

His mark on the ball lab: "0 height variance in the whole gameplay. this cant be the way, these structures are almost the
same. structures have to be just more varied, this is not it. these could be generated like from 5 lines of code. no
height variance, no orbs, no pads, no gameplay in the middle, no small movements. i call these structures - 1 structure.
this is not variance". The batch is retired: knowledge/brickgen.json carries `retired`, structures.js no longer registers
it, its entries are out of structures.json, and the lab levels moved to levels/archive/.

Why the method made it (our reading):
- **One move per mode.** Each mode had a single generator (flap, flip or hold) with scenery built around it, so every
  brick of a mode is the same idea at other sizes.
- **No mechanics.** No orbs, pads, portals or gravity changes inside a brick, so there was nothing to do between presses.
- **Flat.** Entry and exit were always at the floor, and ball platforms had 2 heights per side, so the height range was
  close to 0. His Two Moons marks (2026-11-25) said the same: "no heights change. all on 2 levels".
- **The judge rewarded sameness.** "How common the kind is" pulled every brick to the mode's one most common signature,
  and dedupe only compared bricks of the same kind. The family numbers (p10-p90) cannot tell a varied brick from a dull
  one.

Evgeni, 2026-11-26 20:48: "the whole point of different structures is different structure... if all the game play of all
20 structures is on 2 axes. then its almost the same. the patterns around the level have to be more irregular, not just
up down. that applies to all modes". So a set of bricks is judged by its spread over MANY dimensions at once: move types
and their order, the silhouette (floor and roof outline), the hazard layout around the path, mechanics (orbs, pads,
portals, gravity), the rhythm (gaps between presses), and the path's vertical shape (not only up-down zigzags). A set
whose bricks differ only in size or height is rejected.

The next method: see "Rethink" in the thread and below once agreed.

## Movement study (2026-11-26, `node tools/movestudy.js [--write]`)

Evgeni: "patterns of movement i mean". The study reads each brick's path (tools/lego.js pieces, staged from the PC's
local/lego/pieces.json; 1527 official and 872 community bricks, our 732 library pieces, the retired batch). It cuts the
path into legs at its turns (0.4-block hysteresis) and measures 11 axes per brick:
- height range and net change;
- legs per second;
- median leg height;
- how irregular the leg heights and lengths are (coefficient of variation);
- dwell (time with vertical speed under 1 block/s);
- distinct rest heights;
- grounded share;
- gravity flips;
- mechanics touched.

A set's **variety** is the median distance from each brick to its nearest other brick, in units of the official p10-p90
spread, over random sets of 20 (a lab's size). It also counts how many of the 11 axes the set really uses: an axis counts
when the set's own spread is at least 30% of the official one. Numbers in `knowledge/move_study.json` (no layouts).

| mode | set | nearest | axes used | legs / s | leg height | height range | flips | mechanics |
|---|---|---|---|---|---|---|---|---|
| cube | official | 0.20 | 11 | 4.0 | 2.1 | 3.3 | 0 | 1 |
| cube | ours (library) | 0.11 | 9 | 2.1 | 2.1 | 3.1 | 0 | 0 |
| ship | official | 0.13 | 9 | 2.5 | 2.0 | 2.2 | 0 | 0 |
| ship | generated (retired) | 0.12 | 8 | 1.6 | 3.5 | 5.2 | 0 | 0 |
| ball | official | 0.20 | 11 | 3.3 | 2.3 | 3.3 | 2 | 1 |
| ball | ours | 0.03 | 7 | 1.2 | 4.0 | 4.0 | 0 | 0 |
| ball | generated (retired) | 0.04 | 4 | 1.7 | 3.0 | 4.0 | 5 | 0 |
| ufo | official | 0.15 | 10 | 3.4 | 1.7 | 2.7 | 0 | 0 |
| ufo | generated (retired) | 0.12 | 2 | 3.0 | 2.2 | 3.2 | 0 | 0 |
| wave | official | 0.08 | 8 | 4.5 | 3.5 | 4.2 | 0 | 0 |
| wave | generated (retired) | 0.06 | 6 | 2.5 | 4.2 | 7.2 | 0 | 0 |

What it says:
- **The metric reproduces his verdict.** The retired ball set is 0.04 against the official 0.20 and uses 4 of 11 axes;
  the ufo set uses 2.
- **RobTop's movement is small and frequent.** It has 1.5-2x more legs per second than ours in every mode (cube 4.0 vs
  2.1, ball 3.3 vs 1.2, wave 4.5 vs 2.5), with smaller legs (ship 2.0 vs 3.5 blocks) and less total height (ship 2.2 vs
  5.2). That is his "no small movements".
- Official ball bricks flip gravity about 2 times and touch a mechanic (an orb or a pad), and both vary from brick to
  brick. Ours never touched a mechanic.
- Our hand-made library is less varied than the official one in every mode except ufo.

How the next generator uses it:
- A new set is accepted only when its variety (nearest) and axes used reach the official set's for the mode.
- Each brick's numbers must sit inside the official p10-p90 on every axis.

## Round 3: clicks first (2026-11-27, `tools/clickfirst.js`, one 6-click ball section)

Evgeni on round 2 ("slightly better", but close variants of each other; "whatever we are doing now sounds weird"):
"we will define the clicks, and build a pattern 'randomly', and close the remaining. once we have a 'patch' chosen, we
will build the hazards around it, to match the wanted timing". Then: "lets try to do a section with 6 ball clicks. we
should extract the pattern [...] and evaluate it for variance". So the order is now:
1. **The plan**: 6 clicks on an irregular rhythm (gaps 0.25-0.95 s). Each click has a kind (flip, yellow orb, blue orb)
   and a wanted window (tight / normal / loose). A long gap may also get a free move with no click (drop, pad, blue pad).
2. **The patch**: the sim walks the plan. A surface goes where the ball lands, at a drawn height, and a height is kept
   only if it brings the ball where the next click needs it: on a surface for a flip, in the air for an orb. The ledge a
   flip leaves ends just after the press (the late edge), and the surface it flies to starts just before the landing
   (the early edge), by the window wanted.
3. **Close the rest**: each click is replayed missed, 0.14 s early, 0.14 s late, and with a stray tap in a long gap. A
   spike goes where that wrong route lands, never near the plan, until the wrong route dies. Every hazard is a threat
   to a mistake; there is no filler.
4. **The pattern**: `extract(path, presses)` turns any ball path into a recipe, one token per event:
   - F = flip off a surface (a click);
   - O = yellow orb, B = blue orb;
   - a = a flip with no click (blue pad);
   - g = a gravity portal in the air;
   - p = a pad bounce;
   - d = a drop off a ledge.

   Each token has its gap since the last event and the height change to where it next rests. Example from Cycles:
   `d.00-2.5 F.44+1 d.52+0.4 O.10-1 O.38-1 O.39-0.2 F.67-1`. It works on official sections
   (`node tools/clickfirst.js pattern --pieces local/lego/pieces.json`) and on ours.

   **Variance** is scored two ways:
   - inside a section (0-1): kinds of event, irregular gaps, irregular sweeps, turns, heights rested at;
   - between sections: edit distance of the kinds plus gap and height differences in order.

   The kept sections are the farthest apart.

First run, 1200 plans in 3 min 20 s:
- 26 were built and verified, and 5 were kept.
- Dropped: orb clicks with no landing that suits the next click (389), a secret way where leaving a click out still
  clears (354), blue orb (186), flip (153).
- Variance inside a section (median): ours 0.89, official 0.80 (41 official ball sections of 4-8 clicks).
- Between sections (median distance to the nearest other): ours 0.49, official 0.41.

  The official set is bigger (41), so its nearest neighbour is naturally closer. That is not a win yet.
- Window wishes met: 2-3 of 6 clicks per section, using the strict window (the click moved alone, the others kept).
- Closest official sections: Electroman Adventures, Deadlocked, xStep, Clutterfunk, at distances 0.33-0.51.
- Lab: `specs/lab_clickfirst_ball.json` -> `levels/gdlm_lab_clickfirst_ball.gdlvl`.

Corridors to the beats, with reverse gravity (2026-11-27, Evgeni: "i need also reverse gravity portals in the layouts",
corridors "shorter, longer" by the beats; the types are in knowledge/section_types.md):
- `--bpm B`: clicks fall on 1/2, 1, 1.5, 2 or 3 beats apart, any `--clicks N`. In a gap of half a beat or more, a free
  move may come first: a drop, a pad, a blue pad, or a **gravity portal in the air** (11 when the ball is the right way up,
  10 when it is upside down). `--set <name>` keeps a set apart (knowledge/clickfirst_<name>.json, ids cf-<name>-n).
- `node tools/clickfirst.js gen --set corridor --bpm 140 --clicks 10 --n 1500 --keep 4`: 1500 plans in 6.5 min, 23 built
  and verified, 4 kept. Dropped: orb landings (644), secret ways (457), blue orb (283), fragile (70).
- Variance inside (median) 0.95 vs official 0.80; between 0.60 vs 0.41. Windows as wanted: 4-5 of 10.
- Lab `levels/gdlm_lab_clickfirst_corridor.gdlvl`: 4 corridors of 10 clicks, 39 presses, beatable. make.js flags 3
  prejumps (blocks 38, 93, 329): the hazards that close wrong routes sit too close after a landing. Not fixed yet.
- Only one of the 4 kept plans has a gravity portal: most plans with one fail verification. Open: make the portal a
  fixed part of a plan (G ... N) rather than a chance.

Open:
- Yield is 2%. Orb clicks fail on the landing deadline. Secret ways come from missed clicks that roll on to a surface
  the plan uses later, where a spike can't go.
- Windows: an iteration that moves the edges until each click's window is in its band, rather than one guess.
- Gravity and mode portals inside the section (the official recipes have g often: Clutterfunk, xStep).
- Spider next: the same plan, its own moves (teleport up or down, pads, orbs).

## Round 2: move sequences (2026-11-26, `tools/brickgen2.js`, ball first)

A brick is now a chain of 2-7 **moves**, each placed by the sim where the ball really is (like autobricks.js does for
auto parts), not a rhythm with walls drawn round it afterwards:
- **flip**: a press, and a platform on the other side 3-5 rows away, starting where the ball lands;
- **drop**: the platform ends and the ball falls (no click) onto a lower one 1-3 rows down;
- **pad**: a yellow pad bounces it onto a platform a row up or 1-2 down;
- **bluepad**: a blue pad flips it with no click;
- **orb / blueorb**: a yellow or blue orb where the ball is in the air (off a ledge's end) or rolling, with its press.

Every resting height stays within 4.5 blocks (the official ball bricks span 1.8-5.4). After the moves, spikes fill the
pits on the ground, under the band ceiling, and on the platforms where the ball is far, kept only while the plan clears.
Then three gates:
1. **verify** (tools/brickgen.js): the plan clears, also entered up to 3 ticks early or late; no press means death; the
   windows are measured. If leaving out one planned press still clears, the brick has a **secret way** and is dropped.
   A stray extra tap that still clears is a looser brick, not a shortcut. It is counted (`verify.stray`), and the set
   prefers tight bricks.
2. **movement** (tools/movestudy.js describe on the sim path): the brick may be outside the official p10-p90, with a
   tenth of the spread as slack, on at most 2 of the 11 axes.
3. **the set**: it starts from the brick that is inside on the most axes. Each next brick is the candidate **farthest**
   from those already kept (max-min distance in official spreads). The solver's fewest presses are checked as each brick
   is taken.

`node tools/brickgen2.js nearest --pieces local/lego/pieces.json` names each brick's closest official brick by movement.
That is a level and a column only; the official pieces stay local.

First run (ball, 1500 candidates, 2 min 20 s):
- 20 kept, using every move: flip 23, blueorb 16, orb 10, bluepad 8, pad 4, drop 3.
- **Variety of the set: nearest 0.16 on 10 axes. The official set of 20 is 0.20 on 11.** Round 1 was 0.04 on 4.
- Closest official bricks: Theory of Everything 1 and 2, Cycles, Blast Processing, Geometrical Dominator, at distances
  0.12-0.28.
- Lab: `specs/lab_brickgen2_ball.json` -> `levels/gdlm_lab_brickgen2_ball.gdlvl`.

Still short of the official bricks:
- Fewer clicks a second (about 1 against the official 2) and more time grounded.
- Every brick gets a full row of hanging spikes under the band ceiling, which reads as one look.
- Ship, wave, ufo, cube, robot and spider are not in round 2 yet.
- `tools/rules.js` on the lab finds 15 orbs off the centre of the spike group under them (Evgeni's symmetry rule). The
  spike fill should centre the pit on the orb.

## How a brick is made (first batch, retired)

1. **Presses first.** Each brick gets a rhythm of 2-6 presses on a 0.1 s grid, about 2 clicks a second. LEGO.md measures
   that rate at every tier. The ship is steered: each hold's length is picked from 0.05-0.6 s to bring the ship nearest a
   height drawn for that leg. A free hold length mostly flew the ship into the band's roof (21 of 40 were thrown out
   that way). The wave flies 45-degree legs, so its toggle times alone set its heights, and a leg is cut short before it
   leaves rows 1.5-8. The ufo is steered like the ship: each flap's time is picked from 0.2-0.6 s after the last one. The
   ball taps on the rhythm as it is.
2. **The path is the design.** The sim plays the presses in the open mode band, from the standard structure test entry
   (`structures.js testSpec`: 8 blocks of cube, the mode portal, the lead-in).
3. **The level is built around the path.**
   - **Ship and wave:** at each column edge, the floor top and the roof face are set from the path's lowest and highest
     point near that edge, with `room` blocks of air. The profile is then smoothed so that it changes by at most one row
     per column. The floor only goes down to fix a jump and the roof only goes up, so the room never shrinks. The
     changes are built as 45-degree slopes with tools/patterns.js fly-path's orientations, which keeps the walls smooth
     (the user: "i wanted smooth play in those corridors"). From Normal up, the corridor narrows at the path's turns into
     gates: one row tighter for the ship, 0.4 row for the wave. About one corridor in five is a floor path (no roof).
     - Room per tier, in blocks on each side of the path: ship from Easy 2.2-2.6 down to Demon 1.1-1.4; wave from Easy
       1.3-1.6 down to Demon 0.6-0.8.
     - The wave's edge window is half a column, because a 45-degree leg already moves a row per column. With a window of
       a full column, every wave corridor read as "wide".
   - **Ball:** after each press the ball lands on a platform on the side it flips to. The platform is a roof face in the
     band's top 3 rows or a floor top on row 1-2. It starts where the ball lands (found by playing the presses so far)
     and ends one column after the next press. A ball that does not flip must not be caught by its side's next
     platform, so floor tops never step down and roof faces never step up from one platform of that side to the next.
     Without that rule the solver rolled through 64 of 71 bricks with fewer presses. The ball's band is 8 rows (ceilY
     240), not the ship's 10. Roof spikes placed on row 9 were outside the band, and the ball rode the band's ceiling
     under them.
   - **Ufo:** a 2-3 column ledge (a pillar from the ground) sits under each flap's low point, at the ufo's height there,
     so the ufo hops from ledge to ledge over a pit. Hanging spikes are never placed near the path. Evgeni on a ufo piece
     in the catalogue: "in rather wide areas, you can have way less of timings".
4. **Hazards.** Spikes go on the flat parts of the walls, on the pit floor and on the band's roof. Each one keeps a
   tier's clearance from the path: ship 30 units at Easy down to 8 at Demon. Batches are kept only while the planned
   presses still clear, and halved on a death (as autobricks.js does). These spikes are guards along the lane and fill
   in the pits, which matches the rated mix in HAZARDS.md (~45% guard, ~38% fill).
5. **Verified.**
   - The planned presses clear the brick.
   - With no press at all, the player dies (the brick asks for input).
   - Every input has a timing window: the player's window from lib/windows.js, the same one score.js uses.
   - **No secret way** for the tap modes:
     - Leaving out one planned press must kill.
     - For the ball, one stray tap at least 0.25 s from every planned press (before the last one) must kill.
     - For ball and ufo, the solver (`GD.solve` on the test level) must need as many presses as the plan. Fewer means a
       way with fewer clicks, and the brick is left out. This check caught the first batch's best ball brick: planned 4
       presses, the solver needed 1.
   - For the wave, leaving out one press with its release (one up-leg) must kill. In the first batch 12 of 20 wave
     corridors could be slid or held through with fewer inputs. The structures check's human route flew
     `g-wave-hard-1` with 1 press where 2 were planned, which is likely Evgeni's "wave seems sliding". (`GD.solve`
     counts wave toggles, not presses, so the solver check does not work for the wave.)
   - Any secret way drops the brick. It is a hard rule, not a score penalty.
   - The ship and the ufo are allowed extra flaps in open air. That is the modes' freedom, not a secret way.
   - **Robust to where it is entered:** the whole plan shifted 1-3 ticks early or late must still clear. A level enters
     a brick at another sub-tick phase than the test does.
6. **Judged against the official bricks.** `tools/lego.js measure()` classifies the brick exactly like a piece cut from a
   real level. It gives the family, wrapper, path kind, spikes, gates, gap and the signature. The judge score (0-100) is
   built as follows:
   - **30% how common the kind is in the main levels:** the signature's share of the mode's official bricks
     (`knowledge/lego.json` families); 15% or more gets full marks.
   - **30% fit:** how far its seconds, presses, height range, hazards per 100 blocks and gap sit inside the official
     p10-p90 of that signature.
   - **20% tier:** the tightest window should be at least the tier's official p10 (`knowledge/brick_tiers.json`: 142 ms
     at Easy, 67 ms at Demon) and not far past 1.6 x its median, since a far wider window means it is too easy.
   - **20% clicks per second** near 1.4-2.8 (the wave counts toggles: 1.6-5).
   - The total is then multiplied by:
     - 0.5 when the walls are not smooth;
     - a penalty for secret ways;
     - Evgeni's catalogue votes on that kind (`lego.js sigWeights`).
7. **Distinct.** Bricks of the same kind whose column profiles are close (mean difference under 0.8 per column) count as
   one. The best `keep` of each mode and tier are kept.

Speed (cloud, 2026-11-26): ship ~1.8 s per candidate (each hold is steered with ~10 short runs); wave 0.1 s; ball 0.1 s
plus a ~1 s solve for each brick that reaches the keep stage; ufo 0.2 s. `structures.js check` on one brick: ship 29 s,
ufo 26 s, wave 11 s, ball 3 s.

## Evgeni's catalogue notes this follows (knowledge/lego_votes.json, 2026-11-25/26)

The notes, with what the generator does about each:

- **"path too tight to the walls" / "too close to spikes, creates unnatural timing"** (wave): there is a set room around
  the path, a clearance for every spike, and gates only where the path turns.
- **"path could fly on top, more room there"** / **"the ending of the path is wrong, it should go from the top, more room
  there"** (ship): the path is flown first, so the walls follow where the ship really goes.
- **"secret way within the structures unnatural"**: the skip, stray and solver checks above.
- **"way too close in some of the clicks creating a 'fake' timing [...] in rather wide areas, you can have way less of
  timings"** (ufo): wide room above, pull to ~0.4 s between flaps, no hanging spikes near the path.
- **"wave seems sliding, wrong"** (a narrow wave corridor got 👎, weight 0.5): every generated wave brick is that kind,
  so they score lower until he votes on ours.

## Results

**Batch 2026-11-26, Normal + Hard:** 64 kept (20 ship, 20 wave, 20 ball, 4 ufo), from 150-300 candidates per mode and
tier. The batch took ~15 min in the cloud, mostly the ship (~4 min per tier), plus ~8 min for the wave at Hard.

| mode | kinds (official count of that kind) | presses | cps | tightest window (plan) | dropped most for |
|---|---|---|---|---|---|
| ship | corridor / bend or zigzag / spikes / gates / wide (26 + 14), zigzag / spikes / mid (13) | 2-6 | 1.2-2.1 | 146-317 ms | too high for its room, cleared with no press |
| wave | corridor / zigzag / narrow (9) | 2-4 | 1.7-3.3 inputs/s | 179-321 ms | a secret way (66 + 44 of 300) |
| ball | steps / flips (14) | 3-6 | 1.4-1.8 | 300-346 ms | the solver's fewer presses |
| ufo | pits (28), flat | 4-6 | 2.0 | 229-267 ms | the ledges kill the planned path (~45%) |

- The ship's two main kinds are the main levels' most common ship pieces, and our library never had them (0 ours
  before).
- `structures.js check` beat every brick, with only the usual WARNs of a small test level. In the first batch, 3 wave
  bricks failed fairness; that was before the wave skip check.
- **Tiers barely differ yet.** Hard has narrower rooms for the flying modes, but the windows stay wide: ball Hard 300-350
  ms is the same as Normal. Tier knobs that really tighten (shorter gaps, platforms nearer, spikes nearer) are open.
- **Lab levels** (viewer, lab tab): `levels/gdlm_lab_brickgen_<mode>.gdlvl`. Each brick sits in its own copy of the test
  context (mode portal, lead-in, brick, exit portal wall, 14 blocks of cube). The bricks go in as `{ raw: true }` patterns. Without it the `s:` pattern adds its own portal, lead-in and exit wall, so every brick sat 10 columns late over the next one's frame (the first ship lab died there). Chaining bricks directly is the picker's job.

## Open

- **Cube, robot and spider** are not generated yet. Cube is the biggest library already, but it is ours, so it should be
  replaced too. It needs its own builder: jump arcs onto steps and pillars, orbs and pads mid-air, pits under the arcs.
  lib/hazards.js hazardsAlongPath already places threats under arcs.
- **The judge only sees family numbers** (p10 / median / p90 per signature, in git). A nearest-neighbour judge against
  every official brick's full shape and route needs local/lego/pieces.json from the PC. That is RobTop data, so it stays
  local, and the comparison would run on the PC.
- The score saturates: many bricks reach 100. A finer judge (above) and Evgeni's votes on the generated bricks will
  separate them.
- Gravity portals inside a brick (upside-down ship or wave, flip turns), and mini.
- **Ufo is weak:** only 2 kept per tier. About 45% die on their own ledges (a ledge placed under a flap's low point
  meets the ufo's fall earlier), and the kinds read "flat" when the ufo stays low. Needs a ledge placed by the sim as
  autobricks.js `land` does.
- Entry and exit are the test harness's (from the floor after the lead-in). In a level, seedsolve repairs the joins. An
  entry height parameter would let the picker chain fly bricks at any height.
- Speeds 2x and 3x (the picker's fast sections have almost no bricks).
- None of these has been played in the real game yet.
