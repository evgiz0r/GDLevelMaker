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

## Verified pieces only (the user, 2026-11-25: "lets have structures which are verified by physics and the solver")

A piece is **verified** when a route through it -- the solver's, a real clear, or the level's planned presses -- is
replayed by lib/physics.js and lives through the whole piece. The page shows only verified pieces unless "show
unverified" is ticked, and each card says ✓ verified or why not. Official and our pieces use the levels' saved routes;
library pieces (lego-*, sk*) are solved (tools/solutions.js, cached) when mined. A raw sketch is never verified: it
has no route, only the drawn corridor's midline -- its smooth rebuild is.

## The user's sketch 11-25 17:06, rebuilt smooth ("i wanted smooth play in those corridors")

The first page drew his raw strokes (spike lines as walls, a jittery midline) and ship legs were block stairs. Now:
fly-path legs are 45-degree slopes on both walls for every mode (`stairs: true` for the old block steps), and the sketch
is three library pieces with his shape and portals: `sk1706-wave` (hills [3,7,4,7,4,6,3,6,4,6], gap 5, gravity portals
at the meeting points of hills 3-5), `sk1706-ship` (valley, hill, three 4-row squeezes at different heights),
`sk1706-swing` (the same idea, rows lowered to stay under the band roof). All three beaten (250 / 313 / 196 ms
tightest windows). Knots were read by hand from the centre line between his drawn walls; a converter (sketch -> knots)
is the next step so a new drawing becomes a piece by itself.

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

## The catalogue as Evgeni browses it: clean, replayed, voted (2026-11-25)

The user, the same evening: "there are too many empty structures, and some patterns are not smooth", "many duplications like
this", then "lets have a catalog of strcutures, and i can vote up down ( doesnt mean dont use ). maybe comment. all with
clicks and physics". What changed (tools/lego.js, tools/lego_page.*, tools/serve.js):

- **Empty** pieces (no hazard, orb, pad or portal, and flat ground or open air) are flagged `empty` and hidden by default:
  official 7 of 838, ours 87 of 751, sketches 3.
- **Repeats**: each piece is a row of block columns (what is in each column, in level coordinates); two pieces of one mode
  are the same layout when, at some shift, 80% of the shorter overlaps and every overlapping column matches (so a chunk cut
  at a different phase still counts). Shown once with ×N and where else it is. **Ours repeat a lot: 90 of 751 pieces are a
  layout we already had (12%; GDLM 64 golden hour has one wave corridor 8 times), the official levels 1 of 838.** Same
  lesson as the signature repeat number, now on exact layouts.
- **"Not smooth" was mostly the drawing**: ramps were drawn as boxes, so 45-degree corridors (GDLM 47's wave) looked like
  stairs. Slopes now carry their corner and are drawn as triangles. Real stair walls (a wall height jump of a block or more
  between two non-slope columns, more than 1 per 10 columns) are flagged `smooth: false` and hidden by default: official
  50, ours 27, sketches 4, library 0.
- **Clicks and physics**: each piece carries its route's presses and releases ([x, y, down, seconds]) and the route with
  its time. The big view replays it at real speed (▶, 1x / 0.5x / 0.25x, ← → steps through pieces, space plays), white
  dots are presses, rings releases.
- **Votes**: 👍 / 👎 and a comment per piece. PC page: POST /lego/vote -> local/lego/votes.jsonl (and the actions feed,
  type "lego-vote"). Phone page: its database, collection `legovotes` (doc id = piece id). `node tools/lego.js votes`
  merges both (fetch the phone's first: ArtifactData list `legovotes` into local/lego/votes_phone.json), prints them and
  saves knowledge/lego_votes.json; knowledge/lego.json then carries per signature `vote: {up, down, weight, comments}`,
  weight = 1 + 0.5 x (ups - downs) within 0.25..3. **A vote is a weight, never a ban** (the user's words).
- Piece ids are now `r-` official (RobTop), `u-` ours, `s-` sketch, `l-` library + level + block (before, ours and
  official both began with `o-`).
- Default view after all this: official 782, ours 559, library 12 (`shown` in knowledge/lego.json).

## Combining: how the main levels join their pieces (2026-11-25)

The user: "do we know how to combine structures [...] i want to focus on mainlevel and then think how to invent more", "it
could be kind of a big lego in some way, if we dont want to invent on the fly", "remember we could also go higher in gd".
`node tools/lego_seams.js [--level <n>]` measures every seam of every route (official saved clears and our solver's,
replayed by our physics, so each seam is one a player got through) -> knowledge/lego_seams.json (numbers only).
Pieces are 1-3 s, intensity = presses per second + hazards per block.

| measure | official 1-22 | ours (28 levels) |
|---|---|---|
| intensity p20 / median / p80 | 2.1 / 2.8 / 3.8 | 0.6 / 1.3 / 1.8 |
| next piece harder / easier / about the same | 25% / 22% / 53% | 28% / 35% / 38% |
| after a top-20% piece: easier / harder | 42% / 6% | 53% / 6% |
| mode changes per level | 7.4 | 6.1 |
| quiet before a portal (last press -> portal), p20 / median | 0.15 / 0.37 s | 0.10 / 0.70 s |
| quiet after a portal (portal -> first press), p20 / median | 0.25 / 0.48 s | 0.29 / 0.58 s |
| a press forced within 0.25 s after the portal | 19% | 12% |
| portal entered from the ground (not mid-jump / mid-flight) | **7%** | **46%** |
| speed change at the portal | **22%** | **2%** |
| breathers (1 s+ without a press) per minute | 11 | 14 |
| next piece same family / same mode | 83% / 80% | 81% / 77% |
| next piece same signature | **16%** | **37%** |
| same mode, another kind of piece | **80%** | **52%** |
| how high: the level's top, median level | **12.9 blocks** (5 of 22 above 20) | **7.2** (none above 20) |
| level shape: hardest 3 pieces at / first piece's rank / last piece's rank | 0.54 / 0.02 / 0.17 | 0.39 / 0.11 / 0.00 |

The rules this gives (soft: a level may break one with a stated reason):

1. **Keep the pressure, vary the piece.** The official next piece is about as hard as this one half the time (53%), and
   only 22% of the time easier; but it is another kind of piece 84% of the time (same signature only 16%). Ours drop
   intensity more often and repeat the kind more than twice as often. Combine by changing the piece, not the pressure.
2. **Density first.** The official median piece has 2.8 intensity, ours 1.3: their pieces are fuller (more presses and
   hazards per second). A combination of sparse pieces is a sparse level, however well it joins.
3. **Portals are entered on the move.** 93% of official mode changes are taken mid-jump or mid-flight (a jump into the
   portal, an orb or pad launch, a ship flying in), ours 46% walking on the ground. The quiet before a portal is short
   (median 0.37 s, ours 0.70), the quiet after it about half a second (0.48 s): the player has a moment to read the new
   mode, but the flow does not stop. 19% of official portals still want a press within 0.25 s (ours fairness gate allows
   it only with a cue).
4. **A mode change is often a speed change too** (22% official, 2% ours): the seam is marked twice.
5. **Mode stretches**: cube ~10 s (p80 27), ship ~7 s, ball ~6, ufo ~4.5, wave ~4, robot ~9, spider ~4.6. Most changes
   go through cube or ship (cube<->ship 54 of 162 seams); the mode-to-mode matrix is in knowledge/lego_seams.json.
6. **Breathers** about 11 a minute, mostly NOT at mode changes (20%): the rest comes inside a stretch, not at its seam.
7. **Shape of a level**: the first piece is the easiest (rank 0.02), the hardest run sits in the middle-to-late part
   (median 0.54 of the way), the last piece is easy again (rank 0.17). Peaks are single pieces, ~40 blocks apart
   (p20 22, p80 124); after a peak the next is easier 42% of the time and harder only 6%.
8. **Go higher.** 5 of 22 main levels climb above 20 blocks (Theory of Everything 37, Clubstep 26, Hexagon Force 28,
   Geometrical Dominator 17 for half its time, Dash's rotated 116), and Hexagon Force spends 73% of its time above 10
   blocks. Ours never pass ~8. Height is free in GD: a stretch can climb and the camera follows (the user, 2026-11-25).

Not measured yet: what a seam looks like in blocks (the last 2 columns of one piece next to the first 2 of the next),
and how the official levels vary one piece into the next (same shape, a parameter changed). Next: the big-lego test,
joining main-level pieces by these rules and checking each join in our physics.

## The build pipeline Evgeni set (2026-11-25): theme -> sections -> big lego -> fill -> path -> deco

His words: "some entity designing over a theme / breaking into sections with soft differences, on the limits of strong beats
(!?) or small breaks in the song (!?) / an ultra big lego we can combine, and fill that section according to the section
beats / fill the gap with hazards if needed / thats the layout basically / then we have a defined path / then we start
decoing, first the actual objects according to the themes of the section". Where each step stands (2026-11-25):

| step | what | exists today | missing |
|---|---|---|---|
| 1 | a designer sets the theme | theme kits (`tools/themes/`, `tools/theme.js`: space, ice), the section planner (`tools/scenes.js`: per section role, place, palette, mode) | themes that also choose gameplay pieces, not only looks |
| 2 | sections with soft differences, cut at strong beats or small breaks | `tools/songmap.js` (sections, drops), `tools/hits.js` (hits per half-beat), compose briefs in beats | which cut the main levels use (strong beat vs a break in the song): to be measured on the 22 against their songs |
| 3 | fill each section from the big lego by pieces whose clicks match its beats | the catalogue (838 main-level pieces, each with its clicks, difficulty, verified route), the combining rules (LEGO.md "Combining"), the join test (`tools/lego_join.js`) | a picker: song hits of a section -> pieces whose clicks land on them, joined by the rules, checked in physics |
| 4 | fill the gaps with hazards, no secret ways | the solver's skip check, the join test's secret-way and open-seam flags | the filler itself (hazards / walls in the open space so the only way is the piece's route) |
| 5 | the layout gives a defined path | every piece carries its route; a join is solved end to end | -- |
| 6 | deco: the structural objects themed per section first, then the rest | block skins and deco (`tools/decorate.js`, `tools/scenekit.js`, themes, props), the deco study thread | per-section skins for the pieces' own blocks |

**First level through it: GDLM 44 hellgate v3 (2026-11-25, `tools/hellgate_build.js`).** Song part chosen (Infertehno 2 from
19.3 s, a local grid: SYNC.md), six sections at the song's bar / drop boundaries, cube and ball sections filled by
`tools/brickpick.js` from OUR verified structures only (44 is uploaded: no main-level bricks), ship and wave as fly-path
corridors, then the hell scene. Lessons:
- **A brick's presses in structures.json are the solver's, mid-window, and miss presses before the picture** (pic.presses
  starts 2 blocks before the brick; a brick that opens with a jump onto a block has that jump earlier). So "presses on a
  hit" before solving (58-80%) is not what the solved route does (7% within a frame of a hit). What counts is whether a
  press's WINDOW holds a hit: `tools/onbeat.js` (41% of cube windows held a strong hit, 22% a lesser one) -- and then the
  human route must press there: onbeat --write -> <level>.planned.json -> solutions.js (which had ignored a level's
  planned presses: fixed) -> 20% of presses within a frame of a hit.
- Next for the picker: score a brick by its press WINDOWS against the hits (from a solve of its test level), not by its
  mid-window presses; then nudge each placed brick a column either way where a window misses its hit.

The main levels' pieces are RobTop's: a level built from them stays on the PC (never pushed or uploaded) until we have pieces
of our own made the same way -- varied from theirs by the difficulty knobs (LEGO.md "Difficulty knobs").

## Difficulty knobs (2026-11-25)

The user: "we have difficulty of structures? [...] think what parameters they have to make harder or easier. probably dont
want to copy same structures just with small diff for difficulty". Every piece and brick now has a **difficulty** (log10
of the expected attempts to get through it in one go, from the timing window of each of its inputs: lib/windows.js +
lib/difficulty.js hitChance, the model fitted on the user's runs) and its **tightest window**. The windows of the main
levels' routes are measured once (`windowsOf` in tools/lego.js: 10-60 s a level, Geometrical Dominator 5.5 min,
Deadlocked 15.5 min in the cloud) and committed as numbers in knowledge/lego_windows/. `node tools/lego.js knobs` ->
knowledge/lego_knobs.json: per mode, each parameter's rank correlation with the difficulty and with the tightness
(minus the tightest window), and its median in the easiest and hardest quarter.

What it shows on the main levels' pieces (1-3 s):
- **The main levels are mostly gentle, with a few tight spots.** Median piece: difficulty 0.01-0.02 (a gimme), tightest
  window ~170-200 ms; the tightest tenth: 60-125 ms (ship and robot 63 ms, wave 79, ufo 88, cube 104, ball 125).
  Difficulty lives in a few pieces, which fits "peaks are single pieces, ~40 blocks apart" (Combining rule 7).
- **More inputs per second** makes every mode harder (corr 0.56-0.72); that is the plain knob, and the one that only
  makes "the same piece, busier".
- **The knobs that change the piece's kind** (what the user wants turned instead): wave -- a narrower corridor (gap
  4.7 -> 4 blocks, tightness corr -0.63) and gates (+0.49); ship -- more climb (+0.46) and more hazards per block
  (+0.43: spiky walls, not a busier path); ufo -- longer holds (+0.53); robot -- orbs and pads (+0.53); cube and robot --
  speed (+0.26 / +0.33).
- So a harder version of a brick is a different brick: a corridor that narrows into a gate, a ship stretch that climbs
  between spiky walls, an orb added to a robot jump, a speed portal -- not a spike moved by a block.

## The reverse lego: which bricks a level is built from (2026-11-25)

The user: "given a structure (in a new or old level), find a matching one. and in that way we can also try to help the
solver of the level". `node tools/lego_match.js <level | official:N> [--min 0.6] [--src official|ours|all] [--test]`:
the level as block columns (no route needed), every catalogue brick slid along it (a column votes for level columns
with the same contents, the best shifts scored by shared objects / all objects per column), the best match per
stretch kept, and the brick's clicks moved to the level's x as predicted presses. ~0.3 s a level.

Test: leave level N's own bricks out, match it against the other main levels' bricks, compare with N's real route.

| min score | real presses inside matched stretches (of all) | of those, a predicted press within 1 block | predicted presses that are real |
|---|---|---|---|
| 0.60 | Stereo Madness 64/122, Polargeist 96/144, Base After Base 99/126, Jumper 90/155, Clutterfunk 99/163; Hexagon Force 12/138, Geometrical Dominator 10/138 | 64-77% | 31-51% |
| 0.75 | SM 51, Polargeist 66, BAB 69, Jumper 65, Clutterfunk 23 | 57-88% | 28-67% |
| 0.85 | SM 25, Polargeist 22, BAB 25, Jumper 11, the rest 0-11 | 72-100% | 19-80% |

So: **RobTop reuses his cube bricks across the early levels** (half to three quarters of Stereo Madness, Polargeist, Base
After Base, Jumper is built like bricks from other levels), the later ones are their own (Hexagon Force, Geometrical
Dominator under 10%). Where a brick matches well (0.85), its clicks predict the real press within a block 72-100% of the
time: a usable hint for the solver (seed the search there first, as tools/presslib.js does from its learned picture).
Open: matching that allows a height shift (a brick placed higher), which the fly modes need; feeding the predicted
presses to the solver and measuring how much faster it gets.

## Joining and connecting: what the test says, and Evgeni's plan (2026-11-25)

Evgeni's join rules (2026-11-25, "when we combine, i guess we either need to make a small corridor with a proper portal,
or just have mode ready. need to be careful of orbdashes, as holding them can skip a lot of gameplay which is intended"):
- **Mode at the seam**: either the next brick starts in the mode the last one ends in, or the join gets a short connector
  -- a small corridor with the proper portal in it (the portal entered in the air, 0.4-0.5 s quiet around it, as the main
  levels do) -- never a portal dropped on the seam.
- **Dash orbs are a skip risk**: holding a dash orb (or releasing it late) can fly over much of the next brick. A brick with
  a dash orb near its end is joined only with a wall or ceiling that ends the dash where it is meant to end, and the join
  check holds the dash to its longest and to every later release: a route that skips the next brick's presses is a secret
  way. Not in lego_join.js yet.

`node tools/lego_join.js --grain brick [--n 40] [--seed 7] [--any]` joins two main-level bricks (with 10 blocks of A's own
level before it as the lead-in, so the player arrives in A's entry state), solves the join and checks it
(knowledge/lego_joins.json):

| 40 random brick pairs, about as hard, another kind | clear, the bricks' own way | clear by a secret way | broken |
|---|---|---|---|
| any pair, one portal at the seam (first run) | 15% | 35% | 50% (6 skipped the portal, 7 hit a block, 5 a spike) |
| with the seam contract (exit state fits entry state) and portals stacked over the height | 35% | 33% | 33% |

Same-mode joins that meet the contract: 86% clear (6 of 7). So: **joining needs a contract, a connector and a filler**:
the exit and entry must fit (or a connector makes them fit), a mode seam must be unskippable, and the open space around
a small brick must be closed or the player flies around it (a third of the joins).

Evgeni's notes for the connecting step (2026-11-25):
- **Y shift between bricks, sometimes**: a step, a slope, a drop, a pad -- to fit the next brick's entry height.
- **A portal to fit, more rarely** (the main levels change mode ~7 times a level). Each brick has its mode in and out.
- **Fluid, not cut off every small structure**: the bricks hang on one path; the floor and roof lines run on across a
  seam (the community's "connect your structures", CRAFT.md "Structuring"), so the joins are not visible as cuts.
- **Auto stretches** between sections, no clicks, with interesting movement: falls, pad chains (blue pads in a corridor),
  gravity portal ping-pong, slopes -- "doesnt have to be a spam, could be much more interesting".
  Now mined as **auto bricks** (0.8 s+ with no press where pads, portals or a 3+ block rise / fall move the player):
  220 in the main levels (~10 a level), most of them a yellow pad launch in cube (50), plain falls / rises (31 cube, 26
  ship), portal pairs; the catalogue shows them as "auto bricks". In all 30 min of main-level routes there are ~600
  press-free stretches of 0.8 s+, a third of them moved by pads or gravity portals.
  **Our own auto bricks** (AUTO.md, 2026-11-26): `tools/autobricks.js` builds 50 of them (pad launches and stairs,
  blue-pad / gravity / spider ping-pong, pad into each mode portal ...) placed by the sim and checked with zero presses,
  each with its entry / exit contract; `lego.js mine library` adds them to the catalogue as auto bricks.

Plan: the path of a section first (its height curve, from the beat and the energy), then bricks hung on it where their
entry / exit fit (the contract), connectors (y shift, portal) where they don't, auto bricks between sections, and the
filler last (close the open space, wall the portals, continue the outlines), every join checked by the solver
(clear, no secret way). Not built yet: the connectors and the filler.

## Where the catalogue lives (2026-11-25)

- PC: http://localhost:8765/lego/ (tools/serve.js builds it; votes to local/lego/votes.jsonl).
- Evgeni's PRIVATE claude.ai page: https://claude.ai/artifact/HNZF2JRKi7XkQ8SawvF4Kr, everything incl. the main-level
  bricks (his choice, 2026-11-25: "Yes, private page only"; "just the fact its not native in the app is annoying"). Build
  with `node tools/lego.js page --private` and publish local/lego/page_private/ (index.html + pieces.json) to that URL.
  Votes go to its database (`legovotes`). RobTop's layouts are on it, so it is never shared, never made public, and the
  repo and the public site still never carry them (`page --public` is the copy without them).

## The replay: icons, level colours, teleports, cut points (2026-11-25 evening)

Evgeni: "need proper icons in the replays of the structures", "colors and player icons + reverse", "something weird with
paths", and "what we could cut from start or the end, like checkpoints where we could take even smaller parts".
- Each route sample is `[x, y, t, mode, gravity, drawn rotation, grounded, mini]`. The page draws the player with
  lib/look.js `drawPlayer` (the viewer's icons of every mode, mirrored when gravity is reversed, wave pointing along its
  flight), turned by `visualRot` (moved from the viewer to lib/look.js so both use one copy).
- `P.colors`: the level's background / ground / line colours where the piece starts (header + colour triggers fired by
  then, lib/look.js timeline). Blocks are drawn as dark silhouettes on that background.
- Route samples are world positions (`GD.worldXY`), and a jump of more than 3 blocks between samples (Deadlocked,
  Fingerdash, Dash teleports: 52 pieces) breaks the line instead of drawing it across the picture.
- `P.cuts`: calm points inside a brick (button up, at least 0.2 s to the next press, cube family on the ground)
  `[x, seconds, presses before]`, drawn as dashed ✂ lines. 982 of 1337 bricks have at least one (1939 in all). A slice
  between two cuts is a smaller brick with the same route; joining one is checked like any join (not built into the
  picker yet).
- Open: the wave routes of the main levels still tap a lot in corridors (Evgeni: "thats obviously not the human path");
  that comes from lib/natural.js's wave controller (step 3b merges legs only within a 15 s budget per level).

## Variants: every brick reversed or upside down (Evgeni 2026-11-25, not built yet)

Evgeni: "all our structures can be reversed with reverse portal, so its double the options in a way (just need to be
careful of other reverse portals in the path)". A brick played backwards (the player runs -X after a reverse) is the same
brick mirrored left to right, with the same presses; our sim runs reversed gameplay as frame hd 1 (lib/physics.js "Rotated
gameplay", PHYSICS.md), so a reversed brick can be checked like any other. Likewise upside down (gravity portal): the brick
mirrored top to bottom. So each brick gives up to four variants: as is, reversed, upside down, both.
- The picker treats a variant as a choice of the same brick (votes and difficulty carry over), and checks the variant's
  join in the sim, never assumes it.
- Careful (Evgeni): another reverse in the path flips it back, so a reversed stretch needs its own reverse out and no
  stray reverse inside it; while reversed the camera and the music still run forward, and the level's x runs back over
  what was built before (no overlap with earlier bricks, the filler must keep the two apart).
- Open: the main levels' own reversed stretches (Fingerdash, Dash use turns) as a check of how RobTop does it.

## The filler: joins from the real entry state, secret ways spiked (2026-11-25 evening)

`node tools/lego_join.js --grain brick --n 40 --seed 7 --fill` (knowledge/lego_joins_filled.json; 5 min in the cloud).
Two changes to the join test:
- **No made-up lead-in.** The player starts in brick A's real entry state, taken from the main level's own route at A's
  start (`entryState`). Every "broken" join of the earlier runs died before the seam, inside the lead-in (13 of 13), so
  they measured the test, not the join.
- **The filler.** Solve; where the route leaves the bricks' own routes by more than 2.5 blocks for a block or more (a secret
  way), put a spike on each block of the way it took, and solve again (up to 6 rounds). Spikes only: blocks would give the
  cube new floors.

| 40 brick pairs (contract on, seed 7) | clean | secret way | broken |
|---|---|---|---|
| before (lead-in, no filler) | 35% | 33% | 33% |
| real entry state + filler | **93%** (37) | 0% (85 spikes placed in all) | 8% (3: spike 2, block 1) |

Same mode 7 of 7 clean, mode change 30 of 33. Open: the spikes sit where the solver went, not where a designer would put
them (they still need the look pass: rows on a floor or ceiling, not loose spikes in the air); the seam's open space is
not filled yet; the y-shift / portal connectors (Evgeni's corridor with the portal) and the dash-orb hold check are next.

## Lego hints in the solver: first measurement (2026-11-25)

Evgeni: "do we plan to somehow use the structures and the info in the solver?" `node tools/lego_solve.js official:N
[--min 0.85] [--no-full]` matches the catalogue's bricks into a level (its own bricks left out), then solves it with
tools/presslib.js `solveWithLib` and an empty library, once plain and once with `opts.hints` (inside a matched stretch
the button follows the matched brick's clicks by x; `lego_match.js hintsFor`), and with the full sweep. Results in
knowledge/lego_solve.json.

| level | matched | plain | lego hints | full sweep |
|---|---|---|---|---|
| 1 Stereo Madness, min 0.85 | 13 bricks, 19% | 52 s, 50 repairs, 45 presses | 56 s, 41 repairs, 63 presses | 110 s |
| 1 Stereo Madness, min 0.6 | 52 bricks, 72% | 53 s, 50 repairs, 45 presses | 65 s, 34 repairs, 95 presses | - |
| 2 Back On Track, min 0.85 | 20 bricks, 27% | 96 s, 57 repairs, 50 presses | 95 s, 46 repairs, 67 presses | 78 s |
| 1 Stereo Madness, min 0.6, needed-only | 52 bricks, 72% | 52 s, 50 repairs, 45 presses | 59 s, 33 repairs, 82 presses | - |
| 2 Back On Track, min 0.6, needed-only | 65 bricks, 85% | 98 s, 57 repairs, 50 presses | 107 s, 33 repairs, 82 presses | - |

"needed-only" (`hints.needed`): a hinted press is taken only when the run dies within 1 s without it (the solver thread
agreed; in flying parts it would also keep a press that widens a window under 100 ms, lib/natural.js EASY_MS -- not in
yet). It barely changes the presses: in a cube level some obstacle comes within any second, so "dies without it" is
almost always true at a brick's press x. Verdict for now: on cube levels the plain local repair is as fast, and layout
hints don't pay; worth trying again on flying stretches (where the search is costly) and with route-matched bricks
(match by layout AND the player's height on entry), not more of the same.

So far the hints cut repairs (up to 40%) but not time, and they add presses: a brick's clicks fire where the level
needs fewer (the match is by layout, not by the route). Next: take a hinted press only where the sim says it is needed
(a death within ~1 s without it), and score hints by how often the level's real presses agree (`lego_match.js --test`
precision 50-75% today). Times are one cloud run each, with another session's job running.

## The picker: a section's beats filled from the catalogue (2026-11-25 night)

`node tools/lego_pick.js --sections "cube:15,ship:10,..." (--song id | --bpm N --t0 s | --hits file.json) [--src official|ours|library] [--diff 0.03] [--seed N] --name X`
-> local/lego/picks/X.json + .gdlvl. Song first: each slot takes the brick whose presses land nearest the beats (or hits),
near the target difficulty, weighted by Evgeni's votes; then every join is checked in physics (lego_join checkFilled, next
candidate if it fails); then the whole chain is solved from the first brick's entry state with spike filler, and where it
breaks that brick is banned and the rest re-picked (up to 8 times). Not yet: energy, sections read from the song (given by hand).

First 60 s run (main-level bricks, cube 15 / ship 10 / cube 20 / wave 15, 150 bpm): 39 bricks, 64% of 113 presses within
50 ms of a beat, every join ok, whole chain clean with 0 filler spikes. Times: picking 4 min, the final solve 21 min
(25 min in all; the heavy lock had estimated 4 min from two short runs).

**Smaller bricks (same night).** Bricks are now cut wherever the presses pause for over 0.6 s, and a lone press is a
one-press brick: Evgeni saw ToE 586 as "the structure itself is like 1/10 of the window" (13 blocks, two pairs 7 blocks apart).
Main-level bricks: 883 -> 1326, mean 22 -> 12 blocks, 568 with one press. The page frames each picture on the presses and
objects (a block of space), as tall as the route.

**Evgeni's notes leave bricks out.** A brick with a 👎, or with a note and no 👍 (every note so far is a complaint: "wrong
path", "too many clicks", "too close to spikes"), is not picked; a note on a longer piece of the same level covers the
bricks under it. It comes back once its route is re-planned after the note (routeAt newer). Before picking, fetch the
phone notes (ArtifactData list legovotes -> local/lego/votes_phone.json). The first run above was made before this and
took three noted bricks (Deadlocked 926b / 920b, Blast Processing 211b): with 26 notes, 31 of 1065 main bricks are out.

**Breathers.** Bricks are placed back to back. In a ground mode (cube, ball, robot, spider), when the last brick leaves the
player on the floor or a platform and the next one starts at the same height, the picker may put 0.25-1.5 s of plain floor
first (blocks under it when it is up on a platform) if that lands the next presses on the beat. It costs a little per second,
so it is used only when it helps the beat. Tested: two pairs with a 1 s breather, one on the ground and one up on a platform
3.5 blocks high, both clear with no filler. `--no-breathers` turns them off. Auto bricks mined from the main levels (pads,
portals, big drops with no press) are the other breather: never two in a row, at most a fifth of the time. Not yet: a flying
breather (an open corridor of the right length).

## Collecting bricks as part of every level's analysis (2026-11-25 night)

Evgeni: "do we have a plan to keep collecting structures? part of each level analysys. if its fast enough, just grab". It is:
cutting one level with its route takes ~0.35 s (`node tools/lego.js mine official --level 18`: ToE2, cached windows). So
`tools/difficulty_solve.js` cuts every route it saves -- a main level's solve, resume or `--replan`, and a community level's
solve (`c<id>`) -- into bricks itself (`lego.mineLevel`; `GDLM_LEGO=0` skips it). A level whose route was re-planned gets its
bricks re-cut, so Evgeni's notes are checked against the new path (a note older than the route lets the brick back in).

Community levels (`src: "community"`, ids `c-...`): the solver's raw run is turned into a human route once (lib/natural.js,
5 min budget, else humanize), cached in local/lego/routes/c<id>.json. Other people's levels: local/, the PC page and the
private catalogue only -- left out of knowledge/lego.json's shapes and of `page --public`. Queue for the PC, low priority: `node tools/lego_collect.js [--max N] [--dry]` (fetch -> solve at low priority -> bricks, one
level at a time, log local/lego/collect.jsonl). Evgeni, same night: "start with easier levels, demos when phyisics gets
better" -- so non-demons first, the ones he beat, easiest tier first; demons later. (Earlier plan: his beaten demons first (local/difficulty/user_stats_online.json `--demons --done`, `tools/fetch_level.js`, then
`GDLM_HEAVY_PRIORITY=low node tools/difficulty_solve.js c<id>`), now after the physics improves). Our levels: `node tools/lego.js mine ours --level <name>`
after a build (not hooked into make.js yet).

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
