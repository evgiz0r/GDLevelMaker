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

All ten are beaten in the sim (`structures.js check`, 2026-11-25; gap 5 for the wave ones, 4-row gates for ship):

| piece | presses | tightest window | notes |
|---|---|---|---|
| lego-wave-corridor | 3 | 333 ms | Easy |
| lego-wave-flip | 5 on the solver's route | 283 ms | **held through, the whole two hills need ONE press** (checked by replay: hold from the climb on, every portal turns it). fairness FAIL "switch": a player who lets go at a hilltop by habit has 117-133 ms to press again. That is the piece's point and its risk: it needs a cue (the portal colour, an arrow) and is Hard for a first try |
| lego-wave-mix | 8 | 258 ms | fairness FAIL, same reason |
| lego-wave-teeth | 3 | 333 ms | Easy |
| lego-ship-corridor | 8 | 329 ms | Easy |
| lego-ship-spiky-gates | 8 | 254 ms | with 3-row gates it was 63 ms: 4 rows is the floor at 1x |
| lego-ship-floor | 3 | 267 ms | Easy |
| lego-ship-flip | 6 | 317 ms | upside-down ship between the portals |
| lego-swing-corridor | 8 | 371 ms | Easy |
| lego-swing-gates | 10 | 263 ms | Easy |

The pieces as pictures: `node tools/lego.js mine library` after `structures.js build lego-...`, then the page (source
"library"). The classifier reads ship-spiky-gates as a plain corridor (its spikes are under 30% of the wall and a 4-row
gate is not 2 rows under the 5-row gap): the thresholds came from the official pieces and are open to tuning.

## How the building process uses the pieces (plan, 2026-11-25; the user: "lets think how the building process involves the structures")

The pieces slot into BUILDING.md's stages; nothing new for the user to learn, the stages just get a vocabulary:

1. **Song -> sections** (as now): each section gets its role (intro / build / drop / breather ...), mode, length.
   New: a **piece budget** (seconds / ~2.2 s) and a **target mix** for its mode from the official levels
   (`knowledge/lego.json` "mix": e.g. cube mostly steps and pits, flat cube rare; ship mostly spiky corridors with
   gates).
2. **Layout (presses first)**: each piece slot gets a KIND (signature) and then PARAMETERS:
   - kind: from the target mix, steered by the section's role (build: narrowing gaps, more gates; drop: the level's
     newest mechanic; breather: an open path or a floor path) and by the **variety rule** (no signature from the 4
     slots before; prefer kinds the level has not used yet);
   - parameters from the tier: gap, gate rows, leg length, flat turn length (the windows in the table above are the
     calibration: e.g. ship gates under 4 rows are too tight at 1x);
   - presses land on the song's hits (beat-first, as now); a piece's knots are where its presses go;
   - seams between pieces: the exit row (fly) or floor height (jump) of one is the entry of the next, so pieces
     chain like lego studs.
   **Fly sections are built path-first**: the section's path is drawn as knots that follow the song (rise on a build,
   dip at a drop), cut into slots, and each slot gets a wrapper (open / floor / roof / corridor, +spikes, +gates, turns
   by click or by portal). A mode change on the same path (ship -> wave -> swing) keeps the path and swaps the mode,
   which is what the user's sketch shows.
   The layout stage shows the alternatives per slot as thumbnails (BUILDING.md 4, layout.alt[]) so the user can swap a
   piece for another of the same seams.
3. **Path / check**: the solve and the gates as now; a piece that fails is swapped for the next of its kind, not
   searched.
4. **Deco**: the craft pass dresses by kind (gates get a frame, pits armed undersides, flip turns a portal cue).
5. **After**: `lego.js variety <level>` (repeats <= ~25%, distinct >= ~0.55) and the mix against the official one.

**The user's sketches feed in two ways:** a sketch drawn for a section is fitted and used as is (DRAW.md); and small
patterns he draws (like 11-25 17:06) are mined into new kinds with his parameters (flip turns at meeting points,
gates, height changes), which become pieces the picker can use anywhere -- his drawings grow the library.

**Built so far:** the catalogue and its page, `fly-path` (one path, three modes, wrappers, turns), ten lego pieces,
the variety measure. **Not built yet:** the slot picker in compose (steps 1-2), parametric cube pieces from the mined
official kinds (steps and pits), the variety rule as a gate.

## Open

- Compose does not place fly pieces from the catalogue yet: ship / wave / swing sections still use ship-tunnel /
  wave-zigzag / swing-run. Next: a section's path drawn as knots (from the song: rises on builds, drops on drops), then
  wrapped per section with the variety rule picking a wrapper the level has not used lately.
- The variety rule as a score.js gate (WARN first) and in compose's picker.
- Cube pieces mined from official levels are classified, but not yet turned into parametric pieces (steps and pits are
  the official cube's bread and butter: pillarRun / pitRun in structures.js are close).
- Pieces of the user's sketches: their routes come from the drawn midline; once the layout fitter (lib/sketchfit.js)
  can fit flying sketches, use its route.
- The phone page: a private Artifact (link in project memory); republish with `node tools/lego.js page --public` and
  the Artifact tool (index.html + pieces.json).
- On the PC: http://localhost:8765/lego/ (serve.js builds it when stale, ~20 s; viewer ⚙ view -> 🧱 structures). The
  library pieces show there after `node tools/structures.js build lego-...` for each.
- Official pieces are shown only on the PC page (local/lego/page/index.html): RobTop's layouts stay local. The phone
  page has ours, the sketches and the official numbers.
