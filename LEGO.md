# Lego -- structure research: levels as pieces

The user (2026-11-25), after drawing small patterns on the whiteboard (sketch 11-25 17:06: a wave and reverse wave with
gravity portals where the paths meet, ship slopes, gates, a swing corridor): "ship wave and swing have some similarity in
their possible structures. a path, a path with some spikes, corridors. corridors with paths. there are of course orbs and
pads and so on. do we have some kind of structure research. maybe if we just play this as some kind of sophisticated lego
as well, from existing structures (and also new). we will have more knowledge on how to do smaller constructions".

This builds on STRUCTURES.md (the hand-made, checked library: 80 pieces, mostly cube) and adds two things it had as
"open": **mining real levels for the shapes they use**, and **flying pieces built from one shared path**.

Owner: the structure-research thread (2026-11-25). Code: `tools/lego.js`, `tools/lego_page.js` + `.html`, the
`fly-path` pattern in `tools/patterns.js`, the `lego-*` entries in `tools/structures.js`. Data: `knowledge/lego.json`
(committed: families, parameters, our and the sketches' pieces), `local/lego/pieces.json` (everything, official
layouts included: never committed).

```
node tools/lego.js mine [official] [ours] [sketches] [--sketch f.json]   # cut + measure -> local/lego, knowledge/lego.json (~20 s)
node tools/lego.js families [--src official|ours|sketch]                 # the family table
node tools/lego.js variety <level.gdlvl>                                 # a level's pieces in order, repeats marked
node tools/lego.js page [--public]                                       # thumbnails page (local/lego/page[_public]/)
node tools/structures.js check lego-wave-flip ...                        # the lego library pieces, solved + gated
```

## Families

| family | modes | what a piece is | wrappers |
|---|---|---|---|
| fly | ship, wave, swing | a PATH through space | open, floor path, roof path, corridor; +spikes (hazards are 30%+ of the walls), +gates (narrowings 2+ rows below the corridor's gap), +flips (gravity) |
| jump | cube, robot, ufo | hops between floors | flat, steps (3+ floor changes), pits (the floor under the route is a hazard 30%+ of the way), low roof |
| flip | ball, spider | floor <-> roof runners | the same as jump |

Mechanics on any of them: orbs and pads by colour, portals (gravity, speed, size). A piece's **signature** is
`family / mode / wrapper / path kind / spikes / gates / gap bucket / flips / orbs+pads` (e.g. `fly / ship / corridor /
bend / spikes / gates / mid`): the unit the variety rule counts.

## How a piece is cut and measured

The level's saved route is replayed (official: local/official_NN.json; ours: tools/solutions.js; no solving). It is
cut at every mode change, then into ~2.2 s pieces (0.6 s minimum), each cut moved to the calmest tick within 0.5 s (far
from any input; grounded in the jumping modes). Per column (one block) of a piece: the route's height, the floor right
under it and the roof right over it and what they are (solid, hazard, the ground, the flying band's edge). From those:
width, seconds, presses, hold share (fly), gap (median roof - floor), turns and path kind (straight / slope / bend /
zigzag), gates, floor changes, pit share, hazards per 100 blocks, gravity flips, orbs and pads.

Sketches have no route: their path is the drawn corridor's midline (marked "midline" and drawn dashed). Moving objects
are drawn and measured where they start.

## First results (2026-11-25: 838 official pieces from 21 levels -- Dash's saved route dies at block 159 --, 751 of ours from 30, 9 from 2 sketches)

| | official | ours |
|---|---|---|
| jump / cube / flat | **2%** | **33%** |
| jump / cube / steps | 24% | 15% |
| jump / cube / pits (+flips) | 19% | 4% |
| fly / ship / corridor +spikes (+gates) | 11% | 0% |
| fly / ship / corridor, plain | 2% | 8% |
| flip / ball | 10% | 5% |
| a piece repeats a signature from the 4 before it (median per level) | **20%** | **43%** |
| distinct signatures / pieces (median per level) | 0.64 | 0.39 |

Read: our cube runs on flat ground far more than RobTop's (he climbs steps and jumps pits), our ships fly clean corridors
where his have spikes on the walls and squeezes, and we repeat the same kind of piece twice as often. That is the gap
the repetition rule in taste (tools/repeat.js) also sees, now named by piece kind.

**Variety rule (soft, from these numbers):** at most ~25% of a level's pieces repeat a signature from the 4 before
them; at least ~0.55 distinct signatures per piece; the mix should move toward the official one (fewer flat cube pieces,
spiky corridors in ship). `node tools/lego.js variety <level>` prints it. Not a score.js gate yet.

## Lego pieces: one path, three modes

`fly-path` (tools/patterns.js) builds a path given as knots (`rows`, e.g. two hills [2, 6, 2, 6, 2]) for `mode` ship,
wave or swing, wrapped as `corridor` / `floor` / `roof` / `open`, with `gap` rows of room, `spikes` (turns / floor / roof
/ both), `gates` (knots where the room narrows to `gateGap` rows) and `turns`: `click` (the player turns), `flip` (a
gravity portal at every meeting point: the same path held through -- the user's sketch) or `mix`. Wave legs are always
45 degrees with slopes on both walls; ship and swing legs are `seg` columns long.

The library has ten of them on the same two hills, so the effect of mode and wrapper can be seen one change at a time
(`node tools/structures.js check lego-...`; results in knowledge/structures.json and STRUCTURES.md's ranking):
lego-wave-corridor, -flip, -mix, -teeth; lego-ship-corridor, -spiky-gates (the official levels' most common ship piece,
which ours never had), -floor, -flip; lego-swing-corridor, -gates. Results: see "Lego results" below.

## Lego results

(filled in from the first check, below)

## Open

- Compose does not place fly pieces from the catalogue yet: ship / wave / swing sections still use ship-tunnel /
  wave-zigzag / swing-run. Next: a section's path drawn as knots (from the song: rises on builds, drops on drops), then
  wrapped per section with the variety rule picking a wrapper the level has not used lately.
- The variety rule as a score.js gate (WARN first) and in compose's picker.
- Cube pieces mined from official levels are classified, but not yet turned into parametric pieces (steps and pits are
  the official cube's bread and butter: pillarRun / pitRun in structures.js are close).
- Pieces of the user's sketches: their routes come from the drawn midline; once the layout fitter (lib/sketchfit.js)
  can fit flying sketches, use its route.
- Official pieces are shown only on the PC page (local/lego/page/index.html): RobTop's layouts stay local. The phone
  page has ours, the sketches and the official numbers.
