# Section types: what each layout section is, so a builder can make one at any length

Evgeni, 2026-11-27, on the theme layout board's sections: "theser are decent layouts imo ( dont need save these copy by
copy, but to understand for the future how to make similar according to bears [beats], or invent new ones that are
coherent in general ( shorter, longer, as the game suggest ) today probably we dont have too long corridors due to how to
make the level but such corridors or longer sections of similar type should be able to exist".

So the sections on the board (tools/layoutsections.js, his edits in knowledge/layout_sections.json and
knowledge/layout_sections_added.json) are **examples of types**, not pieces to paste. This page writes down what makes each
type, so a builder can make a new one of any length, synced to the song, and so a new type can be added the same way.

## The rules for every type

- **A type is an idea plus a motif.** The idea is what the player does there (climb, weave, flip between floors). The motif
  is the smallest stretch that shows it: one step, one zigzag leg, one pipe. A section is the motif repeated, with
  something changed each time.
- **Length comes from the song.** A section fills its song section (tools/sections.js, tools/songplan.js): 4 to 32 bars.
  One motif takes 1 or 2 beats at the type's speed. A section has 4 to 64 motifs. A long corridor is fine (Evgeni: "such
  corridors or longer sections of similar type should be able to exist"). Today's builder (tools/brickpick.js) joins short
  bricks, so it never makes them. That is a gap in the builder, not a rule.
- **Shorter:** cut at a motif boundary, and keep the entry and the exit. **Longer:** repeat the motif, and change one or
  two of its parameters every repeat (height, gap, spacing, a hazard's place). Change more at phrase starts (every 4 or 8
  bars). Never use the same motif three times in a row. The family rule for that is in tools/repeat.js.
- **Build it in three parts: entry, body, exit.** The entry and exit meet the joins (lib/scenejoin.js: the floor and the
  ceiling slope to the next section's heights). Give the body a peak in its middle: the denser motif, as in the wave's
  quick zigzag (Evgeni: "in the middle some different pattern like more cps").
- **Beats:** a motif starts on a beat, and the denser part sits on the song's loud bars (tools/impacts.js). Put portals,
  including gravity portals, on bar starts (SYNC.md).
- **Hazards say which way is safe.** Spikes and saws close the wrong paths. They never sit on the only path.
- **Gravity portals** (board pieces G 🟡 upside down and N 🔵 back, ids 11 and 10; Evgeni: "i need also reverse gravity
  portals in the layouts") turn any type upside down for a while. The mirrored motif repeats there, then an N brings
  gravity back. In a corridor, a flip mid-motif reads well. A flip right before a jump does not: no input may be forced
  right after a portal (DIFFICULTY.md "Fairness").
- **A portal sits in the middle of its corridor**, across the band the player flies or runs in, so no path goes around it
  (Evgeni 2026-11-27: "the portal should be not in the middle of the screen but in the middle of the corridors (
  everywhere )"). The solver's route must pass through every portal (tools/layoutcheck.js shows it).
- **Upside-down stretches get the mirrored obstacles**: if the floor has spike pits, the ceiling the player runs on upside
  down gets pits too (Evgeni on closer cube: "wierd assymery with the spikes on the grown on the bottom but no such on the
  top").

## The types (the board's examples)

| type | mode | idea | motif | change it by | longer looks like |
|---|---|---|---|---|---|
| entrance | cube | up a ramp onto the level's blocks, then a first spike and a small pit | ramp + flat + one hazard | ramp height (3 rows by default, tools/startramp.js) | not used long: an entry only |
| staircase | cube | climb, then step down | a step up of 1 row, 4 wide | step width 3-5, a spike or saw on some landings | more steps, a flat landing every 3-4 steps |
| open cube corridor | cube | a floor with pits and nothing overhead; platforms float in the middle | a floor run + a pit (2-3 wide spikes) | pit width, a platform over the pit | the run lengths change, platforms at 2 heights |
| closer cube corridor | cube | the ceiling comes down to 4 rows over the floor and hangs spikes | a floor spike or pit + a hanging spike, out of step | the gap from floor to ceiling, a block pushed down from the ceiling | the ceiling steps up and down by 1 |
| hanging structures | cube | structures hang from the top over a floor with spike pits | one hanging mass + a pit under or between | mass width and depth, its hanging spikes | more masses at different heights, holders from the theme |
| flying corridor | ship | a floor and a ceiling that rise and fall together | a hill: slope up, flat, slope down | hill height 1-4, a saw in the gap | hills of changing height; a long ship stretch is fine |
| wave corridor | wave | a 45-degree zigzag tunnel whose ceiling is its floor lifted (tools/layoutsections.js tunnel) | one leg up + one down | leg length (slow 5-6 blocks, quick 2) | slow legs, then a quick middle, then slow again |
| flappy bird corridors | ufo | pipes from the floor and the ceiling with a 4-row gap at changing heights | one pipe pair | the gap's height, the spacing | the gap height walks up and down |
| ball corridors | ball | floors and ceilings at several heights; the ball flips from one to the next | a floor run then a ceiling run | run length, height step | more levels, a spike under each switch |
| stair path (his) | cube | a lattice of single blocks: many paths in theory, every wrong one blocked by a hazard | a column of blocks 3 apart; each hop up 2 or down 1 | which block of each column stays clear | more columns; the clear route climbs and falls |
| swing (his) | swing | round movement: a big up-and-down corridor whose sides are curves, not slopes or blocks | one wave of the path (3 rows up and down, about 18 columns) | amplitude, period, the gap | waves of changing size. Ship can use it too (Evgeni: "the swing ( and the ship in a way, can do big up and down patterns )") |

## Orb and pad sets (a mechanic any type can use)

Evgeni, 2026-11-27 (remember it, not built yet: "its a bit harder creating timings with those, but probably not that needed
at the moment"): beside blocks and hazards, a section can be built from orbs (and pads). Sets that work:
- **a set of yellow orbs**: a chain of jumps in the air;
- **a set of blue orbs**: gravity flips back and forth, a zigzag movement;
- **a set of green orbs**: forward movement, but flipping gravity each time;
- **a mix of those**: harder to time.
The click-first generator (tools/clickfirst.js: kinds O / B orbs, pads) is the closest piece; timings come from the sim.

## How to test a section

- **🎲 on the board** (Themes tab, under the sections): pick a type, a length and a difficulty, press 🎲 generate, and a fresh
  section from tools/sectiongen.js shows at once (it runs in the page). Evgeni's comment on it goes to Claude with 📨 as
  "🎲 generated <type> (seed, cols, tier)", so it can be rebuilt exactly (`node tools/sectiongen.js show <type> --seed ..
  --cols .. --tier ..`) and the generator fixed from it.

- Its layout: the board's current scene (Themes tab), with soft markers where each section starts.
- Its play: the gallery build (🔨 on a theme card, then make.js solves it). A type is right when the solver's route clears
  it with player windows and no secret way (tools/score.js gates).
- Round sides without hazards (swing) need a round piece on the board and a GD object for it. Not chosen yet. Never guess
  an id: lib/objects.js, ask him in the editor.

## Sections as templates in a level build

Evgeni, 2026-11-27: "besides the option to use the official structures lego, it will be possible to use one of such
possible sections, as a template ( not copy this exactly ), and create somewhat approriate layout for the specific beat and
difficulty needed". So a builder (tools/planbuild.js, compose) has two sources for a section: the lego (verified official
or own bricks joined on the hits, tools/brickpick.js) or a **section type from this page used as a template**: its idea and
motif, generated fresh at the song section's length, with its presses on that section's beats and its windows / cps at the
level's tier. Never the board's example pasted as drawn, and not the drawing nudged a block or two left or right either (Evgeni,
2026-11-27: "the template is not building one or two blocks right and left, but lets have a more abstrct concept that might
create it in various difficulty and length"): a type is an abstract concept -- its idea, its motif and the parameters it
can change (table above) -- and the generator builds a new layout from that concept at any length and difficulty. The generators (tools/sectiongen.js, the "Generate our own
structures" thread) take `{cols, rows, seed}` today; for this they also need the beats (press times in the section) and a
difficulty target (tier: cps and tightest window), and are checked by tools/layoutcheck.js (solves, windows, tier).

## Open

- **Generators: tools/sectiongen.js** (2026-11-27). One per type, built from the concept, not from the drawing:
  `GEN[key]({cols, rows, seed, tier, bpm | beatCols})` -> `{map, mode}`; `make(key, opts)` adds name and concept.
  `tier` (easy..harder, or 0..1) moves every parameter of the type toward its hard end; `bpm` snaps motif lengths to half
  beats (the press inside a motif is not put on its beat yet). Check: `node tools/sectiongen.js check [key] --cols 30,60,120
  --tiers easy,hard` (layoutcheck.js per map); test `node tests/sectiongen.js`.
  First check (seed 1, 30 / 60 / 120 columns, easy and hard): every type solves at every length except the stair path.
  Its lattice solves on some seeds only (2 of 4), with 8-29 ms windows from the 2-up hop, and its gravity pair dies as
  placed. ~~Rule: no gravity portals in a generated stair path~~ -- a misreading: "never gravity in generating stairpath" was
  a complaint, and "still no reverse portals on generation" confirmed it. **Stair path v3:** the gravity pair is on by
  default. The way hops +1 (never more than three times running: measured, a fourth +1 from a 1-wide block lands past the
  next one), +2 or -1 back, never flat. At the top step the gravity portal stands right after the block at the player's
  height, the next step hangs 5 rows up (the flipped cube meets its underside a block later), it climbs back down on the
  undersides and the normal portal turns it back (forced at the last chance, so it ends on its feet). 1 pair in 40
  columns, 2 in 80 (more on harder: lower turn). 12 of 12 solve (40 / 80 cols, easy / harder) and 12 of 12 (30 / 60,
  normal / hard).
- **Swing:** GD holds a swing in a 10-block band set by its portal (lib/physics.js BAND), so a taller swing means filling
  the band: the corridor's middle swings edge to edge (the band edge is the far wall at a peak), waves 20-34 columns.
  12 of 12 solve. Taller than that ("swing can go even higher than screen") needs the portal's band off (GD 2.2's free
  mode); not simulated yet, open for the physics session.
- **Portals on joins:** a wave or fly gravity portal goes where one movement of the path ends and the next begins
  (`joinNear`: in a fly, between two sweeps at least 3 columns long when there are some), at the corridor's middle height,
  never mid-leg.
- **Ball v3** (Evgeni: "the height of the gameplay is too similar ... more balanced across the y axis, in both
  directions"; "in the jumping modes, that the average length of movement is below the half of the full length"): moves
  of 2-4 rows (mean ~2.3 in the 8-row band), the height wandering over the band, pieces in the middle and masses only at
  the band edges. Against his drawing: cps 1.09, height changes 1.10, step 0.73, heights 1.13; middle pieces many more
  than his (11x share): open, maybe hold them to the floor or the bar. 12 of 12 solve.
- **Tier extreme** (Evgeni: "lets increase the cps of harder ... or add 1 more level", "the wave seems a bit too hard for
  harder, too tight"): `extreme` (1.4) goes past harder on pace only (shorter runs, more presses a second); room --
  corridor gaps -- stops at harder's (`room()` in ctx). The wave's gap is now 6 rows (easy) to 5 (harder and extreme); it was 5 to 3 (Evgeni: "still too tight gaps, need bigger gaps, even for harder").
  The tier moves the layout (narrower gaps, shorter runs) but the difficulty model still rates most hard ones Easy. So
  the knob needs a stronger hard end per type, measured against layoutcheck's label.
- **Measured against his drawings** (Evgeni 2026-11-27: "the generator is bad, i compare the cps, the variaty, height
  changes, blocks in the middle. unparable. per section we will need to understand how to build a specific generator for
  that task"): `node tools/sectionstats.js <key> --gen N` scores his drawing and N generated ones on those axes (cps; height
  changes a second, step size, distinct heights; spread of press gaps and rests, distinct piece shapes; share and count of
  pieces floating in the middle) and prints generated / his per axis. Each type gets its own generator, tuned until the
  ratios sit near 1. **Ball, v2:** surfaces on alternate sides (floor and ceiling masses, and pieces floating in the
  middle), each one starting where a late flip on the one before lands (the ball's travel time across the height step),
  short / medium / long surfaces, spikes along the ground and under the ball band's ceiling (row 7: the band holds the
  ball, so an early flip must die there). Against his drawing (8 seeds, 34 columns): cps 1.03, height changes 1.00, step
  0.92, heights 0.91, press-gap spread 0.59, rest spread 0.64, shapes 0.88, middle pieces 0.63. 16 of 16 solve (34 and 90
  columns, easy and hard). Open: rhythm spread is still lower than his, and the hard end is still rated Easy.
- **Orb and pad sets** (Evgeni 2026-11-27, not needed yet: "set of yellow, set of blue (zigzag movement), set of green
  (forward movement but reverse) and a combination of any of those"; board section my-mwz2haf0 "orb gameplay", letters Y B
  E J K). As drawn the solver skips most orbs, so this type needs its orbs placed by the sim, each one the orb you must
  take: tools/clickfirst.js's build() places orbs that way for the ball, and is the start.
- Lengths measured on rated levels per type: how long one of these runs before the level changes it.

- **No spike walls; spikes stand on something** (Evgeni 2026-11-27, on the 🎲 ball and spider sections: "just blocking like that with a wall of spike is rough, lets place proper hazards, spikes not on the ground is bad"). A route is never closed with a long row of spikes. Use proper hazards instead: spike groups of 1 to 3, saws, or blocks with spikes on them. A spike always stands on the ground or a block, or hangs from a ceiling. It never floats in the air. This holds for the generators and for hand fixes on the board.

**The mode's band (2026-11-27).** A ball, spider or flying portal sets a floor and a ceiling around the portal (lib/physics.js
BAND: ball 240 = 8 rows, spider 270 = 9, ship / ufo / wave / swing 300 = 10). Entered from the ground, nothing above
that line is reachable; the spider's flip lands on the band's roof. Every generator keeps its play inside the band; the
board draws the line on each such section. A swing "taller than the screen" needs GD 2.2's portal free mode (no band),
which the sim does not have yet (PHYSICS.md open).

## Ideas for more sections (not drawn yet)
Evgeni 2026-11-27 ("lets remind ourselves more idea for sections, bit tired designing for now"):
- **ship orb play**: a ship corridor with orbs in it (yellow / blue / green) that are clicked while flying.
- **pads**: some pad addition (yellow / blue pads launching the player between platforms; in cube, ball and ufo).
- **duals**: two players, one button (dual portals; lib/dual.js): mirrored or asymmetric halves.
- **dash orbs** (Evgeni 2026-11-27: "we dont use dashes yet, that also adds a hold to the gameplay other than the flying and
  robot"): dash orb stretches (green / pink dash orbs: hold to dash at the orb's angle, release to stop), a hold in a
  jumping mode. The sim has dash orbs (PHYSICS.md; the props 586 / 588 on them unknown); beware dash-orb skips.
