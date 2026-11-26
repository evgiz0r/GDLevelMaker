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

## How a brick is made

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
