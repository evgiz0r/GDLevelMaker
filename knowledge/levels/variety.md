# What makes an easy level not bland: GDLM 41-45 against rated levels

The user called GDLM 44 hellgate v1 "bland" (`critiques.md`). This page compares GDLM's levels
with rated community levels and the official ramp on numbers that might explain that.
Made by `node tools/variety.js official 1 ... gdlm` and `node tools/variety.js community`
(2026-11-23). It is layout only, plus presses where a solution exists. Column meanings:
- **haz cols**: share of columns with a hazard.
- **groups/s**: hazard groups per second. A group is a run of hazard columns; an empty column
  starts a new one.
- **orbs+pads**, **portals**: per minute. Portals include mode, speed, gravity, size and the rest.
- **modes**, **speeds**: how many distinct ones the level uses.
- **toolbox**: distinct kinds of gameplay thing. Hazards count by shape (spike, small spike, saw,
  block hazard...), orbs, pads and portals by name, so skins of the same spike count once.
- **unique**: share of gameplay chunks (islands up to 12 columns, `style.js chunks`) whose
  picture is not repeated earlier in the level.
- **quiet s**: the longest stretch with no hazard, in seconds.
- **presses/s**: GDLM's saved natural replay. Other levels have none here: their solved routes
  are fewest-press routes, not a player's.

## Rated community levels (medians per tier and era)

| level | s | haz cols | groups/s | orbs+pads /min | portals /min | modes | speeds | toolbox | unique | quiet s |
|---|---|---|---|---|---|---|---|---|---|---|
| Easy, 2.0-2.1 (n=17) | 66 | 43% | 0.34 | 25 | 28 | 5 | 3 | 17 | 90% | 6.3 |
| Normal, 2.0-2.1 (n=17) | 69 | 38% | 0.66 | 28 | 25 | 4 | 2 | 15 | 96% | 4.2 |
| Hard, 2.0-2.1 (n=16) | 70 | 79% | 0.58 | 54 | 36 | 5 | 4 | 22 | 94% | 3.1 |
| Harder, 2.0-2.1 (n=13) | 72 | 72% | 1.05 | 69 | 58 | 6 | 4 | 25 | 100% | 2.0 |
| Easy, 2.2 (n=7) | 100 | 4% | 0.07 | 5 | 2 | 2 | 1 | 7 | 100% | 30.5 |
| Normal, 2.2 (n=5) | 89 | 14% | 0.51 | 25 | 26 | 4 | 3 | 19 | 100% | 25.5 |

The 2.2 rows are there only to show the caveat: 2.2 levels move their gameplay with triggers, so
their static layout looks nearly empty. Use the 2.0-2.1 rows.

## Official 1-8 and GDLM

| level | s | haz cols | groups/s | orbs+pads /min | portals /min | modes | speeds | toolbox | unique | quiet s | presses/s |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 Stereo Madness | 85 | 55% | 0.48 | 0 | 3 | 2 | 1 | 6 | 85% | 6.9 | - |
| 2 Back On Track | 80 | 60% | 0.68 | 15 | 2 | 2 | 1 | 8 | 48% | 9.4 | - |
| 3 Polargeist | 89 | 64% | 0.66 | 25 | 2 | 2 | 1 | 9 | 59% | 11.8 | - |
| 4 Dry Out | 80 | 57% | 1.01 | 5 | 3 | 2 | 1 | 9 | 64% | 6.3 | - |
| 5 Base After Base | 83 | 72% | 0.55 | 9 | 4 | 2 | 1 | 9 | 70% | 1.7 | - |
| 6 Can't Let Go | 79 | 87% | 0.38 | 29 | 3 | 2 | 1 | 10 | 100% | 1.3 | - |
| 7 Jumper | 85 | 84% | 0.66 | 6 | 11 | 2 | 1 | 10 | 86% | 1.6 | - |
| 8 Time Machine | 95 | 78% | 0.84 | 25 | 12 | 2 | 1 | 11 | 73% | 1.8 | - |
| GDLM 41 classic | 17 | 15% | 0.79 | 7 | 0 | 1 | 1 | 3 | 75% | 2.7 | 0.97 |
| GDLM 42 seen then gone | 20 | 12% | 0.76 | 0 | 0 | 1 | 1 | 1 | 10% | 1.9 | 1.01 |
| GDLM 43 climb | 31 | 19% | 0.69 | 12 | 0 | 1 | 1 | 3 | 25% | 9.6 | 0.85 |
| GDLM 44 hellgate | 12 | 23% | 0.77 | 21 | 21 | 3 | 1 | 6 | 100% | 2.6 | 1.37 |
| GDLM 45 first flight | 60 | 16% | 1.03 | 6 | 10 | 3 | 1 | 6 | 28% | 6.7 | 1.62 |

GDLM 44 here is the version in `levels/` now (after the style session's changes), not the v1
the user called bland.

## What it says

1. **GDLM is not short of obstacles.** It has 0.7-1.0 hazard groups per second, more than rated
   Easy (0.34) or Normal (0.66), and 0.85-1.6 presses per second. But each group is tiny, often
   a single spike, so hazards fill only 12-23% of the columns against ~40% at Easy/Normal. Rated
   levels have fewer, wider and more varied obstacles: shaped groups and structures, not lone
   spikes.
2. **Few kinds of thing.** GDLM uses 1-6 kinds of gameplay thing; rated Easy/Normal levels use 15-17.
   Even the 1.x official levels use 6-11 (one new thing per level, `official_01-08.md`). This is
   the biggest gap.
3. **Little change over time.** GDLM 41-43 have no portals at all, and every GDLM level stays at
   one speed. Rated Easy/Normal levels use 4-5 modes and 2-3 speeds, with a portal every ~2.2-2.4 s
   (25-28 per minute). This matches `low_tier_stats.md`: modern rated levels change mode or speed
   every 3-7 s.
4. **Repeats.** In GDLM 42, 43 and 45, only 10-28% of the chunks are new: the same picture comes
   back again and again. Rated levels have 90-96% new chunks. Official 1-8 have 48-100%, so some
   repetition is fine, but not mostly repeats.
5. **Orbs and pads are rare.** GDLM has 0-21 per minute against 25-28.
6. Quiet stretches are not the problem. GDLM 43 and 45 have up to 7-10 s with no hazard, like the
   old official levels (6-12 s) and a bit more than modern Easy (4-6 s).

So "bland" fits *sameness* more than emptiness: one kind of spike, one mode, one speed, repeated.
This is a hypothesis from layout numbers. The user's playtest of a level that fixes these things
is the test.

## Targets for an Easy/Normal GDLM level (from the 2.0-2.1 medians)

- ~15 kinds of gameplay thing over the level, brought in gradually: spikes of 2-3 shapes, a saw,
  yellow/blue/pink orbs and pads, gravity portals. Introduce each one gently (`official_01-08.md`).
- 4-5 modes and 2-3 speeds, with a portal every 2-3 s on average.
- Obstacles as shaped groups 2-3 columns wide rather than lone spikes. That is about 0.35-0.65
  groups per second, with hazards in ~40% of the columns.
- ~25 orbs and pads per minute.
- At least ~90% of the chunks new: vary each repeat.
- Quiet stretches up to ~6 s.
- Per mode, the section recipe is in `modes_low_tier.md`. Check a level with
  `node tools/tiercheck.js` and `node tools/variety.js`.
