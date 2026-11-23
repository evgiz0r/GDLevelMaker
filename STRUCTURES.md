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
  0.15 for each press per second above 2.5. (A prejump WARN is the approximate check on levels with
  modes and is not counted.)

Known limits of the score: "fun" is not measured (only readability and variety stand in for it); usage
is "the level has the mechanic", not "the level has this shape"; a structure's tier is a guess until the
user plays it.

A structure with no press at all (a pad-only stretch) is something to watch, not to play: its score is
multiplied by 0.85.

## In levels

`tools/patterns.js` registers every structure that starts and ends as a normal-size cube in normal
gravity at 1x as the pattern `"s:<id>"` (other modes get their portal, lead-in and exit wall added), so a
spec or a brief's `use` can name one. **compose.js adds one by default**: every plain cube section (not a
rest, no `mode`) gets one ready structure as its newest idea, best-ranked first within the brief's
difficulty label, a different one per section, preferring a mechanic the level does not have yet. Off
with `"structures": false` in the brief or a section. (Speed, mini and gravity-entry structures are not
auto-placed, and only sections at 1x get one: they were checked at 1x. A level picks the rest by hand.)

## Results (2026-11-23, 50 structures)

48 ready, 2 not: `triple-spike` (46 ms: the classic triple really is that tight at 1x; fine for Hard,
listed to show it) and `blue-orb-bounce` (a second blue orb right after the first leaves 25-33 ms; two
layouts tried). By mode: cube 32, ship 4, robot 3, UFO 3, wave 3, ball 3, spider 2. Top of the ranking:
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

## Open

- **Swing**: the sim moves the swing right (a press flips it), but `solveAny` finds no path past any
  wall, so no swing structure can be checked yet. Told the physics session (the solver is theirs).
- **Green orb**: `sure:false` in lib/objects.js. In the sim it flips gravity and jumps toward the new
  gravity's "up", so from the floor it throws the cube DOWN; the structure meets it high, after a pad.
  Check in the real game before a level leans on it.
- **Dual** portals are not simulated: no dual structures yet.
- Mining real levels for shapes (the most common 1-3 s layouts in official and community levels, by
  mode) to add what they use and to rank by "how often real levels use this shape".
- More per mode (ship, wave, ball, UFO, spider have 2-4 each) and harder tiers: everything so far reads
  Easy on lib/difficulty.js's scale (1-3 s pieces); the windows say more.
- Fake-outs (deco that looks like a path, a portal that is not taken) are not in: the fairness rules
  (knowledge/design.md) make most of them unfair at low tiers.
- Not checked in the real game yet: none of these has been played. The first level built with them
  is the test.
