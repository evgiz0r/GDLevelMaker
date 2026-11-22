# What an easy section looks like, per mode

From the 63 rated 2.0-2.1 levels in `low_tier_stats.md` (static layout; 2.2 levels left out
because their gameplay moves). Sections are cut at mode and speed portals and must be 8+ blocks long.
Medians, measured 2026-11-22 by a script over `tools/style.js analyse()`.

Column meanings:
- **lead-in**: blocks from the portal to the first hazard.
- **cols with hazard**: share of the section's columns that hold any hazard.
- **gap / run**: for ground modes, the empty columns between hazard groups, and how wide a group is.
- **opening**: for flying modes, the widest vertical gap per column, in blocks. It is rough: it
  counts every solid and hazard in the column, deco-like blocks included.

### Easy+Normal (2.0-2.1)

| mode | sections | median blocks | median s | lead-in blocks | haz/10 | cols with hazard | orbs+pads/10 | ground: gap / run (cols) | fly: opening (blocks) |
|---|---|---|---|---|---|---|---|---|---|
| cube | 135 | 41 | 4.2 | 6.0 | 4.9 | 33% | 0.7 | 3 / 3 | - |
| ship | 95 | 53 | 4.2 | 8.0 | 1.5 | 12% | 0.0 | - | 7.4 |
| ufo | 52 | 54 | 4.8 | 2.0 | 7.4 | 37% | 0.0 | - | 6.3 |
| robot | 33 | 57 | 6.2 | 3.0 | 11.1 | 53% | 0.1 | 2 / 5 | - |
| wave | 30 | 42 | 3.7 | 3.0 | 6.4 | 29% | 0.0 | - | 6.0 |
| ball | 27 | 52 | 5.0 | 0.3 | 11.3 | 60% | 0.6 | 4 / 7 | - |
| spider | 11 | 35 | 4.2 | 0.0 | 18.4 | 86% | 0.6 | 3 / 16 | - |

### Hard+Harder (2.0-2.1)

| mode | sections | median blocks | median s | lead-in blocks | haz/10 | cols with hazard | orbs+pads/10 | ground: gap / run (cols) | fly: opening (blocks) |
|---|---|---|---|---|---|---|---|---|---|
| cube | 219 | 28 | 2.7 | 0.0 | 16.1 | 82% | 1.0 | 2 / 8 | - |
| ship | 121 | 22 | 1.7 | 0.0 | 18.3 | 85% | 0.0 | - | 6.2 |
| ball | 49 | 43 | 3.4 | 0.0 | 22.7 | 98% | 1.0 | 2 / 25 | - |
| wave | 49 | 21 | 1.7 | 0.0 | 10.9 | 43% | 0.0 | - | 5.0 |
| ufo | 45 | 31 | 2.4 | 0.0 | 19.4 | 86% | 0.0 | - | 6.2 |
| robot | 38 | 35 | 3.2 | 0.0 | 17.6 | 94% | 0.8 | 1 / 17 | - |
| spider | 31 | 35 | 2.8 | 0.4 | 23.4 | 91% | 0.9 | 2 / 13 | - |

## What it says

1. **The lead-in is the clearest sign of an easy section.** At Easy/Normal, a section gives you
   room after the portal before the first hazard: cube 6 blocks, ship 8, robot and wave 3, UFO 2.
   At Hard and Harder it is 0 in every mode: hazards start at the portal.
2. **Most of an easy section is empty.** Hazards sit in 12-60% of its columns, against 82-98% at Hard.
   An easy ship has hazards in only 12% of columns: it is mostly open flight.
3. **Ground modes**: an easy cube part has groups ~3 columns wide with ~3 empty columns between them.
   At Hard the groups are 8 wide with 2 between. Ball and robot are denser even when easy (53-60% of
   columns), and spider sections run along hazard-lined floors (86%).
4. **Flying modes**: easy openings are ~7 blocks for ship, ~6 for UFO and wave; Hard narrows them to
   6.2 and 5.0. The opening narrows less than the density grows: harder flying means more
   obstacles, not mainly tighter corridors.
5. **Easy sections are longer**: 35-57 blocks (4-6 s) against 21-43 (1.7-3.4 s) at Hard.

## A recipe for an Easy/Normal section (for GDLM)

- Start every new mode or speed with an empty lead-in: ~6 blocks (cube), ~8 (ship), 2-3 (others).
- Keep hazards in at most ~1/3 of the columns for cube, ship and wave, and at most ~1/2 for ball and robot.
- Cube: groups of up to 3 columns, 3+ empty columns between groups.
- Ship: a ~7-block opening, mostly open flight. Wave: ~6 blocks. UFO: ~6 blocks.
- 4-6 s per section.
- Cross-check the timing against the DIFFICULTY.md "Tier ladder".
