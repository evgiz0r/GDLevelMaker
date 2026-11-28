# Quality: GDLM levels next to the official ones

The user, 2026-11-23: "lets consider our quality compared to main levels. give ours, together with the first
10". One scorecard, every number measured: `node tools/quality.js` (rows cached in `local/quality/`, a new or
changed level is measured on its own, one heavy job at a time; `--cached` prints without measuring, `--md`
writes the tables to `local/quality/table.md`). Owner: the difficulty session. What each column means is at the
top of `tools/quality.js`. Official numbers are measured on the solver's route (cached official report), ours
on the route a person plays (lib/natural.js); flow and soft rules are style's tools/flow.js and tools/rules.js.

## Re-run 2026-11-28 (the levels in levels/ now: 44 Hellgate, 73 sunny streets, 75 held together, 77 lab)

`node tools/quality.js --md`; official = 1-10 as below. GDLM 76 night shift had no row (not picked up: open). 77 is a
physics lab and 75 an auto level, so the verdict rests on 44 and 73.

| metric | official | 44 Hellgate | 73 sunny streets | verdict |
|---|---|---|---|---|
| length | 78-95 s | 62 s | 77 s | nearly there (was 16-44 s) |
| mode changes / min | 1.3-5.2 | 9.7 | 10.9 | **still outside**: about twice the officials |
| clicks / s | 1.3-1.7 | 1.2 | 1.2 | just under |
| median window | 238-350 ms | 338 | 296 | inside (was 280-380, looser) |
| floor changes / 10 s | 11.8-21.3 | 8.1 | 4.8 | **still outside**: 73 at a third of the officials |
| height range | 3-8 blocks | 6 | 2 | 44 inside, 73 low |
| 10 s with no floor change | 0% | 0% | 15% | 44 fixed; 73 not |
| time on the bare floor | 18-51% | 10% | 26% | **fixed** (was 77-89%) |
| objects / block | 2-6 | 19 | 19 | far above: 2.2-style deco (the officials are 1.x) |
| gameplay share of objects | 59-93% | 20% | 20% | below for the same reason |
| triggers / min | 10-142 | 450 | 1837 | far above (73: deco triggers) |

**What changed since 2026-11-23:** length and bare floor are fixed, timing is in range. **Still the biggest gaps:**
1. **Too many mode changes**: ~10 a minute against 1.3-5.2 -- sections are still short mode snippets.
2. **Too few height changes**: 4.8-8.1 floor changes per 10 s against 12-21 (73 is flat: 2 blocks of range).
3. The deco counts are 3-10x the officials', which is expected for a 2.2 look (levels/modern_look.md is that reference),
   but 73's 1837 triggers a minute is worth a look.
Soft rules broken on 73: deco coverage, symmetry, clusters; on 44: deco coverage, clusters.

## Verdict per metric (2026-11-23)

Ours = GDLM 41-60, without 46 arrow catalogue (a test strip). Official = Stereo Madness to xStep (1-10 stars).

| metric | official 1-10 | ours | verdict |
|---|---|---|---|
| length | 78-95 s | 16-44 s (47: 101) | **outside**: all but 47 are under half an official level |
| modes used | 2-3 | 1-7 | inside to above (60 is a test of every mode) |
| mode changes / min | 1.3-5.2 | 0-17 | **outside** on 44, 45, 46 sketch, 50, 51, 60 (7-17): a portal every 4-9 s |
| clicks / s | 0.9-1.6 | 0.8-1.9 | inside |
| tightest window | 17-100 ms | 46-142 ms | inside (looser: 41-42 have nothing under 100) |
| median window | 204-217 ms | 142-379 ms | **outside, looser**: most of ours give 280-380 ms (more air, slower inputs) |
| difficulty score | 0.36-1.21 | 0.05-1.07 | inside, at the easy end (41, 42, 44, 60 under Stereo Madness) |
| floor changes / 10 s | 11.7-21.6 | 3.9-8.3 | **outside**: half the officials' height changes |
| height range | 3-8 blocks | 1-5 | low end |
| 10 s with no floor change | 0% | 0-40% | **outside** on 43, 45, 50, 51 |
| time on the bare floor | 23-62% | 46-89% | **outside**: most of ours stand on the floor 77-89% of the time |
| repeated 4-move patterns | 0-12% | 0-25% | inside but 42 (25%) and 47 (14%) |
| objects / block | 2-6 | 0-9 | inside; decorated ones (44, 45, 47, 50, 51) above, as 2.2 levels are |
| distinct ids | 26-58 | 5-56 | inside for the decorated ones; 41-43, 46 sketch, 60 bare |
| gameplay share of objects | 59-93% | 13-100% | decorated ones below (2.2 look; levels/modern_look.md is their reference, not 1.x) |
| triggers / min | 10-142 | 16-449 | decorated ones above (2.2 look) |
| fairness | (not run on official) | 46 sketch 3 FAIL; 45 3 WARN, 51 1 WARN | 46 sketch is the old v2 |
| soft rules | - | deco coverage (5 levels), orb symmetry (7), attempt counter (4) | to fix in style / polish |

**The three biggest gaps**
1. **Height: ours play flat.** 4-8 floor changes per 10 s against 12-22, and 77-89% of the time on the bare floor
   against 23-62% (the user on GDLM 47: "all in flat area"). The officials never have a 10 s stretch without a
   height change; four of ours do.
2. **Length.** 16-44 s against 78-95 s (rating needs 60 s+; knowledge/checklist.md "Ratable"). Only 47 is long enough.
3. **Too many portals, too loose timing.** 7-17 mode changes per minute against 1.3-5.2, with median windows of
   280-380 ms against ~210: many short mode snippets with easy inputs instead of longer sections that build up.

Not compared yet: readability / contrast (polish's local/readability covers hellgate only), GDLM 61 (new, not
measured), sight-reading (tools/sightread.js), sync. The official levels are 1.x-look: for the look columns the
reference is knowledge/levels/modern_look.md (2.2 rated levels), not this table.

## The tables

Gameplay

| level | s | modes | chg/min | CPS | min ms | med ms | score | stars |
|---|---|---|---|---|---|---|---|---|
| Stereo Madness | 85 | 2 | 2.1 | 1.3 | 63 | 217 | 0.40 | 1 |
| Back On Track | 81 | 2 | 1.5 | 1.3 | 100 | 213 | 0.36 | 2 |
| Polargeist | 89 | 2 | 1.3 | 1.6 | 100 | 213 | 0.46 | 3 |
| Dry Out | 80 | 2 | 1.5 | 1.5 | 100 | 208 | 0.72 | 4 |
| Base After Base | 83 | 2 | 1.5 | 1.5 | 67 | 217 | 0.42 | 5 |
| Cant Let Go | 80 | 2 | 1.5 | 1.5 | 71 | 208 | 0.42 | 6 |
| Jumper | 85 | 2 | 2.8 | 1.6 | 58 | 217 | 0.80 | 7 |
| Time Machine | 95 | 2 | 1.9 | 1.3 | 54 | 204 | 0.61 | 8 |
| Cycles | 78 | 3 | 3.1 | 0.9 | 63 | 204 | 0.63 | 9 |
| xStep | 80 | 3 | 5.2 | 1.0 | 17 | 204 | 1.21 | 10 |
| 41 classic | 17 | 1 | 0.0 | 1.0 | 104 | 238 | 0.05 | - |
| 42 seen then go | 20 | 1 | 0.0 | 1.0 | 142 | 238 | 0.07 | - |
| 43 climb | 31 | 1 | 0.0 | 0.8 | 46 | 142 | 0.37 | - |
| 44 hellgate | 43 | 4 | 16.9 | 0.8 | 100 | 283 | 0.17 | - |
| 45 first flight | 43 | 4 | 14.1 | 1.2 | 50 | 379 | 0.79 | - |
| 46 arrow catalo | 13 | 1 | 0.0 | 0.0 | - | - | 0.00 | - |
| 46 sketch | 16 | 3 | 11.2 | 1.9 | 129 | 279 | 0.30 | - |
| 47 sunny side | 101 | 4 | 3.6 | 1.0 | 75 | 296 | 0.89 | - |
| 50 eclipse | 40 | 4 | 9.0 | 1.0 | 79 | 296 | 1.07 | - |
| 51 adrift | 44 | 4 | 6.8 | 1.1 | 113 | 367 | 0.51 | - |
| 60 physics lab | 30 | 7 | 13.8 | 0.8 | 92 | 354 | 0.10 | - |
| *official range* | 78-95 |  | 1.3-5.2 | 0.9-1.6 | 17-100 | 204-217 | 0.36-1.21 |  |

Flow

| level | jump s | chg/10s | range | flat | floor | repeat |
|---|---|---|---|---|---|---|
| Stereo Madness | 59 | 13.8 | 5.0 | 0% | 38% | 12% |
| Back On Track | 67 | 12.9 | 3.0 | 0% | 62% | 1% |
| Polargeist | 77 | 14.6 | 5.0 | 0% | 40% | 4% |
| Dry Out | 67 | 17.9 | 8.0 | 0% | 41% | 1% |
| Base After Base | 69 | 16.3 | 4.0 | 0% | 30% | 1% |
| Cant Let Go | 69 | 19.4 | 8.0 | 0% | 23% | 0% |
| Jumper | 64 | 21.6 | 6.0 | 0% | 28% | 0% |
| Time Machine | 81 | 12.4 | 4.0 | 0% | 24% | 1% |
| Cycles | 65 | 11.7 | 7.0 | 0% | 37% | 0% |
| xStep | 52 | 11.8 | 7.0 | 0% | 25% | 0% |
| 41 classic | 17 | 7.2 | 3.0 | 0% | 80% | 0% |
| 42 seen then go | 20 | 5.0 | 1.0 | 0% | 89% | 25% |
| 43 climb | 31 | 3.9 | 1.0 | 33% | 89% | 0% |
| 44 hellgate | 30 | 7.4 | 5.0 | 0% | 80% | 0% |
| 45 first flight | 30 | 7.3 | 5.0 | 25% | 77% | 0% |
| 46 arrow catalo | 13 | 0.0 | 0.0 | 100% | 100% | - |
| 46 sketch | 9 | 6.5 | 2.0 | 0% | 46% | 0% |
| 47 sunny side | 83 | 8.3 | 3.0 | 0% | 49% | 14% |
| 50 eclipse | 27 | 6.7 | 4.0 | 17% | 87% | 0% |
| 51 adrift | 28 | 8.1 | 4.0 | 40% | 81% | 0% |
| 60 physics lab | 24 | 4.9 | 4.0 | 0% | 85% | 0% |
| *official range* | 52-81 | 11.7-21.6 | 3.0-8.0 | 0%-0% | 23%-62% | 0%-12% |

Look and fairness

| level | obj/blk | ids | play | struct | bg | trig/min | fair |
|---|---|---|---|---|---|---|---|
| Stereo Madness | 3 | 31 | 62% | 33% | 6% | 13 | - |
| Back On Track | 2 | 26 | 66% | 28% | 6% | 11 | - |
| Polargeist | 2 | 35 | 82% | 10% | 8% | 15 | - |
| Dry Out | 2 | 30 | 83% | 11% | 6% | 31 | - |
| Base After Base | 2 | 35 | 73% | 22% | 5% | 15 | - |
| Cant Let Go | 2 | 33 | 93% | 3% | 4% | 10 | - |
| Jumper | 3 | 34 | 81% | 15% | 4% | 32 | - |
| Time Machine | 4 | 36 | 72% | 21% | 7% | 19 | - |
| Cycles | 5 | 40 | 59% | 36% | 5% | 51 | - |
| xStep | 6 | 58 | 60% | 23% | 17% | 142 | - |
| 41 classic | 1 | 14 | 74% | 25% | 1% | 22 | ok |
| 42 seen then go | 0 | 5 | 100% | 0% | 0% | 27 | ok |
| 43 climb | 0 | 13 | 75% | 21% | 4% | 16 | ok |
| 44 hellgate | 8 | 40 | 19% | 58% | 23% | 407 | ok |
| 45 first flight | 7 | 52 | 54% | 16% | 31% | 304 | ok 3W |
| 46 arrow catalo | 0 | 22 | 3% | 30% | 68% | 5 | ok |
| 46 sketch | 3 | 13 | 63% | 37% | 0% | 26 | 3 FAIL |
| 47 sunny side | 6 | 56 | 50% | 14% | 37% | 149 | ok |
| 50 eclipse | 9 | 33 | 26% | 39% | 35% | 357 | ok |
| 51 adrift | 7 | 33 | 13% | 32% | 55% | 449 | ok 1W |
| 60 physics lab | 1 | 27 | 63% | 32% | 5% | 24 | ok |
| *official range* | 2-6 | 26-58 | 59%-93% | 3%-36% | 4%-17% | 10-142 |  |

Soft rules broken (tools/rules.js --fast; official levels not swept)

- 41 classic: none
- 42 seen then go: none
- 43 climb: none
- 44 hellgate: deco coverage, symmetry
- 45 first flight: deco coverage
- 46 arrow catalo: attempt counter
- 46 sketch: symmetry
- 47 sunny side: deco coverage, symmetry
- 50 eclipse: deco coverage, symmetry, attempt counter
- 51 adrift: deco coverage, symmetry, attempt counter
- 60 physics lab: symmetry, attempt counter

* = a work-in-progress copy newer than levels/; (part) = the sim does not finish it