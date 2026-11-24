# Structures -- a ranked library of short layouts

The user (2026-11-23): "Lets start adding more variety. More structures. Lets consider a structure list
of many simple layouts and maybe rank them. By layout I mean like 1-3 seconds of play." Our levels were
mostly flat cube on the ground: only GDLM 45 and 47 had an upside-down part, and none used blue/green
orbs or pads, mini, robot, spider, UFO or swing.

Owner: the style session. Code: `tools/structures.js`. Results: `knowledge/structures.json` (committed,
small, shapes only). Phone page: built by `node tools/structures.js page`, published as an Artifact
(link in `local/phone/structures_url.txt`).

## What a structure is

A function of its args that returns spec objects (`[type, col, row, extra]`, col 0 = its first column,
row 0 = the first row above the ground), like a `tools/patterns.js` pattern, plus:
- `mode`, `tags` (its mechanics: "blue orb", "gravity", "ceiling run", ...), `tier` (the designer's
  guess), `doc` (one line, what the player does);
- `needs`: the state it must be entered in -- mode, gravity, mini, speed;
- `leaves`: the state at its end (defaults to `needs`), and `exitRow` (the row the path leaves on, for
  flying modes: where a level frames its exit portal).
Shapes are generic GD vocabulary, nothing copied from a particular level.

```
node tools/structures.js list                 # the library
node tools/structures.js check [id ...]       # build + solve + gates -> knowledge/structures.json
node tools/structures.js build <id>           # its test level -> local/structures/<id>.gdlvl
node tools/textmap.js local/structures/<id>.gdlvl   # look at it as text with the path
node tools/structures.js rank                 # the ranked list
node tools/structures.js page [--out f.html]  # the phone page (ranked list + pictures)
```

## How each one is checked

`check` puts it in a small test level: 8 blocks of run, the mode portal for its mode (on row 1, so the
cube walks into it), the lead-in of rated low-tier levels for that mode (cube 4, ship 8, wave/robot/UFO 4,
ball/spider 5), the structure, then for other modes a wall of cube portals (rows 1, 4, 7, so the test
does not depend on the exit height) and 10 blocks of run-out. Then every gate of `tools/score.js`
(beatable, prejumps, recovery, lead-in, mode entry, skips, fairness, objects ...) runs on it, and from
the structure's own stretch:
- **presses**, **seconds** (time from its first to its last column),
- **minWindowMs**: the tightest timing window on lib/difficulty.js's human route (one tap per jump,
  as a player does it). The solver's fewest-clicks route skips steps and reads tight where a person is
  not (stairs: 38 ms on the solver's route, 142 ms on the human one), so the level-wide `timing` and
  `difficulty` gates are left out of "ready" and this number stands for them (ready needs >= 50 ms),
- **label**: lib/difficulty.js's label (on a 1-3 s piece nearly everything reads Easy; the window is
  the better measure),
- a picture: objects and the solved path from 2 blocks before to 2 after, drawn as shapes (blocks,
  spikes, orbs and pads in their colours, portals as rings, the path coloured by mode, a dot per press).

## Ranking

Score 0-100 = **30% variety + 25% real-level use + 25% fairness margin + 20% readability**, each 0..1.
Not ready (dies, a FAIL gate, or a window under 50 ms) = 0, listed last. The weights are a choice the
user can change; the parts:
- **variety** = 1 - the share of our own GDLM levels (`levels/gdlm_*`) that use its key mechanic.
  Something we never use scores 1, plain spikes score ~0. This is the user's ask: more kinds of thing.
- **real-level use** = sqrt(share of real rated levels -- the 22 official ones and the community
  levels in `local/community/` -- that have its key mechanic at all). The sqrt keeps rare-but-real
  mechanics (spider, mini) from scoring near zero; common ones score near 1. A structure with several
  mechanics counts its rarest (a blue-orb ceiling run is as common as blue orbs, not as spikes).
  Cached in `local/structures_usage.json` (delete it to recount).
- **fairness margin** = (tightest window - 40 ms) / 160 ms, clamped to 0..1: 50 ms is the floor,
  200 ms and up is "nothing to fear".
- **readability** = 1, minus 0.5 for a prejump FAIL, 0.3 for a fairness FAIL, 0.1 for a fairness WARN,
  0.4 when the "reactive" gate flags it (exact hops: a lone landing block forcing the next jump
  within 250 ms, or 3+ forced hops in a row; the user on GDLM 45 v6), 0.15 for each press per second above 2.5. (A prejump WARN is the approximate check on levels with
  modes and is not counted.)

Known limits of the score: "fun" is not measured (only readability and variety stand in for it); usage
is "the level has the mechanic", not "the level has this shape"; a structure's tier is a guess until the
user plays it.

A structure with no press at all (a pad-only stretch) is something to watch, not to play: its score is
multiplied by 0.85.

## In context (2026-11-24)

A structure checked alone can still fail beside its neighbours. GDLM 64 v2/v3 (gaps of 2-4 columns at Hard)
showed it: `orb-ladder-2` made 3-tap orb chains with the orb pit after it (fairness FAIL), and `block-hops`,
`slab-steps`, `lantern-orb` gave 10 of 15 "jump over a hazard timed around a block" spots. So every cube-in /
cube-out structure is also built between a single spike 2 columns before it and an orb pit 2 after (the
tightest gap compose uses), and the gates a neighbour changes -- beatable, prejumps, reactive, fairness,
recovery, skips -- go to the entry's `context` (`node tools/structures.js check --context [id ...]`).
A piece that FAILs any of them there, or is not PASS on reactive, is `context.ok = false`: ranked down
(readability -0.5) and not ready. compose.js only uses ready pieces, also when a brief names one by hand
(it prints a NOTE). Results: see "Results in context" below once run.

## In levels

`tools/patterns.js` registers every structure that starts and ends as a normal-size cube in normal
gravity at 1x as the pattern `"s:<id>"` (other modes get their portal, lead-in and exit wall added), so a
spec or a brief's `use` can name one. **compose.js adds one by default**: every plain cube section (not a
rest, no `mode`) gets one ready structure as its newest idea, best-ranked first within the brief's
difficulty label, a different one per section, preferring a mechanic the level does not have yet. Off
with `"structures": false` in the brief or a section. (Speed, mini and gravity-entry structures are not
auto-placed, and only sections at 1x get one: they were checked at 1x. A level picks the rest by hand.)

## Results (2026-11-23, 51 structures)

49 ready, 2 not: `triple-spike` (46 ms: the classic triple really is that tight at 1x; fine for Hard,
listed to show it) and `blue-orb-bounce` (a second blue orb right after the first leaves 25-33 ms; two
layouts tried). By mode: cube 32, ship 4, robot 3, UFO 3, wave 3, ball 3, spider 2, swing 1. Top of the ranking:
gravity-pad-gap 95, triple-speed-run 94, ufo-orb 94, speed-burst 93, ufo-pillars 93, robot-steps 92 --
the mechanics our levels never had. Plain cube shapes (stairs, pillars, doubles) sit at 57-62: common in
real levels and fair, but we already use them everywhere. Numbers in `knowledge/structures.json`;
`node tools/structures.js rank`.

Lessons from building them:
- Floating blocks at one height 2 apart are walked across without a jump (the landing snap catches the
  next one): hops must rise a row each, or be 3+ apart.
- The solver's fewest-click route skips steps (stairs: one press for two steps, 38 ms); the human
  route's windows are the ones to judge a layout by.
- A green orb from the floor throws the cube down (it jumps in the new gravity's "up"): meet it high.
- Flying-mode exits: a single framed portal at a guessed row is missed by paths that pass higher or
  lower; the test uses a wall of three portals.
- The checker is slow for ship (~80 s), robot (~25-130 s) and UFO (~45 s): the sweep solver.

## Craft structures (2026-11-23, the craft session; CRAFT.md)

Nine shapes from studying Jumper and xStep (rules, not coordinates), all over pit floors of low spikes (id 9
sunk 13 units): `pillar-hop`, `pillar-climb`, `capped-hop`, `slab-steps`, `lantern-orb`, `stepped-pyramid`,
`ceiling-hop`, `ship-weave`, `ship-lanterns`. All ready (121-304 ms). Each cube one starts on a 3-wide
doorstep: a 1-wide first pillar gave a 1.7-block prejump. Dress them with the craft pass (spec `"craft":
true`, tools/craftkit.js): rods and chains attached to the pieces.

## Dense chains (2026-11-24, the art session)

GDLM 64 v5 had 14 hazards per 100 blocks, with the floor a hazard 8% of the way; the craft target is 45+ and 35%+.
Packing library pieces tighter made "timed around a block" spots, so these six are built to be dense *and* to sit next
to each other. Every one passes `check --context` (a spike 2 columns before, an orb pit 2 after), all ready:

| id | tier | hazards / 100 blocks | tightest window | args (steady spacing: set it to the song's beat) |
|---|---|---|---|---|
| spike-train | Easy | 17 | 238 ms | n 5, gap 7 |
| double-train | Normal | 29 | 142 ms | n 4, gap 8 |
| pit-run | Easy | 42 (floor a hazard ~43%) | 204 ms | n 5, w 4, pit 3 |
| pit-run-high | Normal | 38 | 246 ms | n 4, w 4, pit 3 |
| pit-spike-mix | Normal | 32 | 208 ms | n 3, w 10, pit 3 |
| spike-pit-train | Normal (tight) | 30 | 88 ms | n 3, gap 7 |

How they stay dense and fair:
- Most of the hazards are pit floor: the low id-9 spikes. A 3-wide pit costs one jump and holds 3 hazards.
- Every landing is 4+ wide, so the reactive gate's 250 ms press after landing still works.
- Each starts and ends on the floor with 2 calm columns.
- At 1x, 7 columns is 0.67 s, one beat at 90 bpm.

Watch:
- They are flat and repeat themselves. The "height" and "repetition" gates (below) want 10+ floor changes per 10 s and
  at most 5% repeated 4-move patterns. Use n 3-5 and alternate them with height pieces (pillar-hop, stairs).
- spike-pit-train's 88 ms window comes from the pit right after the spike's landing. gap 8 should loosen it, but that
  is not checked yet.

## Open

- **A structure that passes alone can fail inside a level**: `orb-ladder-2` (ok in the harness) made a fairness
  FAIL twice in GDLM 64 v2 (blocks 213, 325: 3 orb taps 208-292 ms windows under 500 ms apart -- the natural
  route takes the ladder's orbs and the pit's next orb as one chain). The harness should run each structure with a
  neighbour on each side (an orb-pit, a single) and rank on that; until then it is left out of dense briefs.
  Same in GDLM 64 v3 (gaps 2-4) for the reactive gate: block-hops 4 spots, slab-steps 3, lantern-orb 3 of 15
  ("a jump over a hazard timed around a block", 58-208 ms windows) -- each passes the harness alone.
- **Swing**: one structure (swing-wiggle). Until 49fa848 `solveAny` found no path past any
  wall (the sweep merged a pending flip away; fixed by the physics session). More swing shapes to add.
- **Green orb**: the sim (gdp decompile, gdsolver) flips gravity and jumps toward the new gravity's
  "up", throwing the cube DOWN from the floor; the user's real play of GDLM 60 shows a green orb taken
  from the ground sends the cube to the CEILING (physics, 2026-11-23). The sim and the game disagree:
  green-orb-flip (met high, after a pad) is to be re-checked once physics settles it.
- **Dual** portals are not simulated: no dual structures yet.
- Mining real levels for shapes (the most common 1-3 s layouts in official and community levels, by
  mode) to add what they use and to rank by "how often real levels use this shape".
- More per mode (ship, wave, ball, UFO, spider have 2-4 each) and harder tiers: everything so far reads
  Easy on lib/difficulty.js's scale (1-3 s pieces); the windows say more.
- Fake-outs (deco that looks like a path, a portal that is not taken) are not in: the fairness rules
  (knowledge/design.md) make most of them unfair at low tiers.
- Not checked in the real game yet: none of these has been played. The first level built with them
  is the test.

## Height and repetition (2026-11-23)

The user on GDLM 47's upside-down part: "some sections are somewhat boring. all in flat area. no change
of height really. no variety. robtop levels do show decent change of height in their play, trying not to
repeat exact gameplay for a long while". Measured with `node tools/flow.js official ours <level>` along
the route, in the jumping modes only (cube, robot, ball, spider; either gravity):

| | jumping s | floor changes / 10 s | height range / 10 s | 10 s windows flat | on the bare floor | 4-move patterns repeated within 10 s |
|---|---|---|---|---|---|---|
| official 1-8 (Easy-Harder) | 59-81 | 12.4-21.6 | 3-8 | 0 | 23-62% | 0-12% (Stereo Madness 12%) |
| official 9-22 | 6-75 | 8.1-17.6 | 0-11 | 0 (ToE 67%) | 7-54% | 0-2% |
| **official median** | 58.9 | **13.6** | **7** | **0** | **28%** | **0%** |
| GDLM 45 v6 | 30.3 | 7.9 | 5 | 25% | 81% | 0% |
| GDLM 47 v2 | 84.3 | 7.5 | 3 | 5% | 54% | 17% |

So ours change height about half as often, sit on the bare floor twice as much, and 47 repeats its moves
(its upside part: the same hanging spikes again and again). Theory of Everything is the exception (mostly
UFO and ball; its cube stretches are flat).

Targets (score.js gates "height" and "repetition", WARN for now): 10+ floor changes per 10 s of jumping
play, a height range of 3+ blocks per 10 s window, no flat 10 s window, at most 45% of standing on the bare
floor, at most 5% of 4-move patterns repeated within 10 s. compose.js's block terrain now changes height at
~4 chunks in 5 (0-3 rows), and also hangs from the ceiling in upside-down sections (0-2 rows).

Open: the structure library does not have entry/exit heights yet (every structure starts and ends on the
floor it is placed on); repetition is not steered in compose (it only avoids the same chunk twice in a row).

Next to measure: **Spooky Dash** (Fabruuuu, rated Hard, ID 150941693, local/community/150941693.gdlvl, not
committed), a modern Hard level the user beat and enjoyed (attempt 9; deaths at 27.7% twice and 40-42%
three times, local/real_stats.jsonl). Solve it once (`node tools/solutions.js local/community/150941693.gdlvl`,
heavy), then `node tools/flow.js local/community/150941693.gdlvl` and `node tools/rules.js` on it: its
height / repetition numbers next to the official ones are a target the user has played and liked.
More references the user chose and played (2026-11-23, local/community, deaths in local/real_stats.jsonl):
Locked 149415501, ClockWood 150286303 (beaten), NOT A MONOCHROME LVL 149575037 (left after one try at 25%),
Gang Vibes 147433579 (completed), "A level" 148448631, Eden and Ash 146165333, Accelerate 140155559 (beaten).
Measure them as Spooky Dash: the beaten / completed ones are the target band, the one left early a
counter-example (what made the user stop at 25%).
