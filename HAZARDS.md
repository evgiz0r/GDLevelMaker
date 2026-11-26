# Hazards: how rated levels place and dress spikes, saws and pits

Owner: the hazards session (2026-11-26, Evgeni's "yes" to a spikes / hazards study). Code: `lib/hazards.js` (measures +
the generator), `tools/hazards.js` (CLI, score.js gate "hazards"), `tools/hazards_try.js` (the generator on a level),
`tests/hazards.js`. Numbers: `knowledge/hazards_ref.json` (medians and quartiles per group, numbers only).

Why: the generator drew plain spikes and the auto levels' hazards (a saw wherever a stray press left the path) "look
random and don't follow the path" (Evgeni on tools/autobeat.js). CRAFT.md / obstacles.md counted where spikes sit
(on blocks, in pits) but never measured them against the player's path.

## Method

`node tools/hazards.js study [--write]` (~1 min in the cloud for 160 levels). Corpus: the 21 main levels with a route (Dash
has none), 127 community levels from `local/community/` (91 rated in list.json + 36 with a solved route), our levels.
Every hazard (lib/objects.js kind "hazard": spikes, pit spikes, saws, hazard blocks) gets:

- **support**: what holds it up, from its base direction (rotation + flipY): ground, top of a block, under a block
  (hanging), side of a block, a stack (on another hazard: pit walls, spike towers), or floating (nothing within 3 units).
- **role**, from its box's distance to the player's box along the path (a route that clears):
  **threat** < 1 block (what a press is for), **guard** 1-3 blocks (frames the lane, shuts a secret way), **fill** further
  (pit floors, scenery). The path comes from the human route (knowledge/mains/routes.json) or the solver's
  (local/difficulty/), replayed on the physics commit it was solved on when today's sim no longer clears it (a git
  worktree in local/tmp/wt/): the path is the measured thing, and it is the one that cleared.
- **jump arcs**: every cube / robot air arc of 0.15 s+: does a hazard (threat or guard) sit under it, how many, where
  (fifths of the arc from take-off to landing).
- **lane**: every block along the path, the first thing above and below the player within 4 blocks: hazard, solid, open.
- **dressing**: a decoration object centred on the hazard (within 10 units), and which ids.

## Findings

Medians; "with path" counts: official 1-8: 8, 9-14: 6, 15-21: 7, community 37 (mostly 1.x-2.0 remakes and demons), rated
Easy-Normal only 1 (Promises) -- the rated tier rows without a path are static measures only.

| measure | official 1-8 | official 9-14 | official 15-21 | community | GDLM (auto labs, 44, 73) |
|---|---|---|---|---|---|
| hazards per 100 blocks | 82 | 145 | 152 | 117 | 20 |
| hazards within 3 blocks of the path, per second | 5.5 | 9.5 | 10.9 | 10.3 | 0.5 |
| role threat / guard / fill % | 20 / 38 / 44 | 17 / 42 / 38 | 16 / 46 / 36 | 16 / 43 / 38 | 0-6 / 1-22 / 78-93 (auto); 44: 43 / 40 / 17 |
| guards above / below the path % | 8 / 28 | 19 / 25 | 20 / 26 | 20 / 24 | |
| jumps with a hazard under them % | 72 | 83 | 76 | 71 | 12 |
| hazards under each jump | 2.0 | 3.4 | 4.2 | 2.9 | 0.2 |
| under a jump, by fifth of the arc % | 14 / 26 / 26 / 17 / 17 | | | 18 / 23 / 23 / 18 / 16 | |
| obstacles: threats each, gap between (s) | 2.0, 0.6 | 2.5, 0.5 | 3.2, 0.6 | 2.7, 0.5 | |
| median gap path-to-threat (units) | 20 | 20 | 17 | 18 | |
| held by ground / block top / hanging / stack / floating % | 67 / 5 / 16 / 0 / 9 | 29 / 12 / 11 / 2 / 30 | 14 / 16 / 14 / 6 / 35 | 18 / 10 / 11 / 4 / 28 | 56 / 0 / 29 / 0 / 0 |
| side-turned % | 3 | 10 | 13 | 6 | 0 |
| rows: single / 4+ (share of rows) % | 66 / 14 | 87 / 4 | 84 / 7 | 81 / 6 | |
| lane, cube: hazard below / above % of blocks | 3 / 2 | 11 / 13 | 15 / 11 | 8 / 10 | |
| lane, flying: hazard above / below % | 0.5 / 0.5 | 10 / 10 | 14 / 15 | 15 / 15 | |
| hazard kinds | 3 | 7 | 21 | 10 | 1 |
| dressed % | 2 | 15 | 68 | 48 (rated 2.2: 61) | 0 |

1. **The role mix is a constant of good levels**: about 1 hazard in 6 is a threat, 2-3 in 6 are guards, 2 in 6 fill --
   from Stereo Madness to Fingerdash and across community levels; density grows with difficulty, the mix barely moves.
   This is the measurable form of "hazards follow the path": most hazards sit 1-3 blocks from where the player actually
   goes, framing it. Our auto levels put 78-93% of their hazards 3+ blocks away (the stray-press saws), so they read as
   random; Hellgate (44) has the opposite fault, 43% threats and few guards: every spike is a jump, nothing frames them.
2. **Almost every jump is over something** (71-83% of cube arcs), 2-4 hazards each, spread over the whole arc with the
   most in the middle three fifths: the pit runs to the take-off and landing edges, it is not one spike in the middle.
3. **Threats are passed close**: the path clears a threat by a median 17-20 units (under a block) -- spikes go where the
   arc is lowest over them, not where it is highest.
4. **Obstacles come every ~0.5-0.6 s**, 2-3 threats each, in the mains and the community alike (Easy-Normal rated: 1.4 s).
5. **Guards shut the other ways**: below the path (pit floors, spikes in the gap under an arc) a quarter of all hazards;
   above it (ceiling spikes, hanging spikes over a jump) 8% in the first mains, ~20% from Cycles on and in the
   community -- the "don't jump over everything" ceiling arrives with difficulty. In flying parts 10-15% of the lane's
   blocks have a hazard as the wall above and as many below (the rest are solid walls); the first mains' ship parts
   are open (0.5%).
6. **Support**: the first mains keep two thirds on the ground; later and community levels move them onto blocks, under
   blocks and to floating pieces (28-35%: spikes on invisible / deco holders or moved by triggers). A quarter to a third
   of every level's hazards hang (upside down). Side-turned spikes: 3-13%.
7. **Rows**: most hazard rows are single (66-87% of rows), 4+ long rows are rare (4-14%; the first mains' pit rows).
8. **Dressing**: the 1.x mains are bare (2%); from Electroman on and in community levels 45-85% of hazards carry deco,
   almost always the same few kinds (by how many levels use them): a glow behind the spike -- lit square 211 (60
   levels), gradients 1011 / 503 / 1012 / 504 (52 / 48 / 19 / 14), on the glow's own colour channel --, round glows 50 /
   1764 at saw centres, cogwheels 85-87 behind saws, low deco spikes 20 / 21 along pit rows, empty-frame 1888 (a centre
   for rotate triggers: spinning saws). In 1.x-2.1 levels hazards stay on the default channel (black with the glow
   coloured); 2.2 levels give hazards channels of their own, apart from the blocks' (Fingerdash: 3 spike channels).

## Rules (the generator follows them; score.js gate "hazards" checks them)

- **R1 role mix**: of a level's hazards, 8-40% threats, 25%+ guards, at most 60% fill (rated 11-31 / 31-57 / 19-58).
- **R2 jumps over something**: half or more of the jumps have a hazard under them, 1-4 depending on tier, spread over the
  arc, centred where it is lowest relative to the hazard.
- **R3 frame flying parts**: lane pieces (a short block with spikes on its path side) where the path comes closest to the
  wall line, not a continuous wall and not a lone saw; a leak (stray-press path) is blocked on that same line.
- **R4 density**: 2+ hazards within 3 blocks of the path per second (official 3.9-10.9).
- **R5 dress from Normal-looking levels up**: a glow behind spikes on its own channel, cogwheel or round glow behind
  saws, low deco spikes along pit rows (not built yet: decorate.js / the theme kits should take it).

## Generator: `GD.hazardsAlongPath(path, objects, opts)` (lib/hazards.js)

Input: a path (GD.run's states), the level's objects; `opts.tier` easy / normal / hard, `opts.clear` (units between the
player's box and any new hazard, default 8; blocks keep 15), `opts.leaks` (stray-press paths, as tools/autobeat.js
strays() returns), `opts.verify: {header, events}` (replay; the new piece nearest each death is dropped). Output:
`{objects, notes}` -- `{id, x, y, flipY?}` objects (spike 8, pit spike 9, block 1).

1. threats under every air arc: a spike run on the surface under the arc (upside down: hanging from the one above),
   ~50 / 80 / 100% of the arc's columns by tier, centred at the apex; skipped where the level already has a hazard under it
   or the surface is 3+ blocks down;
2. lane pieces in flying stretches on the path's contour (±2 columns) 2-3 blocks off it, at local minima of the gap or
   every 2 x spikeEvery + 4 columns, 2-3 columns wide (a lone hanging spike under one block read as a stray); the floor side
   half as often as the ceiling side (rated flying lanes: a hazard below on 1-20% of blocks, median 9);
3. leaks blocked where they leave the path by the wall distance, a run of 3 on that line, each spike held by a block on its
   far side; a leak with a hazard already on that line within 2.5 blocks counts as shut (`notes.leaksShut`) -- piling
   more spikes beside a lane piece stacked them into a triangle;
4. pit floors: low pit spikes (id 9, y 2, as the mains) under arcs that start and end 2+ blocks up.

**How it was checked**: strip a main level's own hazards and place new ones on the same path
(`node tools/hazards_try.js official:N`): the role mix comes back close to RobTop's (Polargeist threat / guard / fill
24 / 57 / 19 -> 28 / 53 / 19; Back On Track 31 / 51 / 19 -> 32 / 51 / 17; Dry Out 29 / 49 / 23 -> 29 / 43 / 28), jumps with a
hazard under 67-88% -> 60-84%. **Open**: density is about half RobTop's (2.2-2.8 vs 4-7 near the path a second;
1.2-1.9 under each jump vs 2-3): it places no ceiling guards in cube parts and no hazard stacks / pit walls yet.

On the auto beat lab level (levels/lab/auto_beat.gdlvl v8, its own hazards stripped): threat / guard / fill
6 / 2 / 93 -> 19 / 53 / 28, jumps with a hazard under 3 -> 45%, the no-press run still clears. In the viewer and the phone
page as in-progress `hazards/gdlm_auto_beat_path_hazards` (2026-11-26). Not seen by Evgeni yet.

**Round 2 (2026-11-26, the auto thread's notes on lab v9)**: the three fixes above. Auto lab rebuilt with them
(`node tools/autobeat.js --song GeometricalDominator --seed 3`): lane.fly.belowHaz 27.7 -> 19.2% (rated 0.9-19.8), 42 of
the leaks shut by a piece already there (leak spikes 74 -> 54, each now on a block), the no-press run still clears, open
leaks 15 of 1550 as before, saws 7 -> 10. Still off: guards above the path 27.5% (rated 10-23: leaks blocked above),
arcs with a hazard 41-52% (rated 60-85), density.

## Open

- Density (above), ceiling guards over cube jumps, side-turned spikes on walls, stacks.
- Dressing (R5) in the generator / decorate.js; colour channels per hazard role.
- The rated Easy-Normal tier has one level with a path: solve a few more (tools/difficulty_solve.js level <id>, low).
- Rhythm against the beat: obstacles every 0.5-0.6 s is measured; whether threats land on beats is not (lib/sync.js).
- Moving hazards (2.2 levels move them with triggers): measured where they start.
- Secret ways: the generator blocks the leaks it is given; it does not search for them itself (autobeat.js strays() does).
