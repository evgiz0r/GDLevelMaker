# Objects and decoration families -- what exists, what good levels use, how they combine

For composing (gd-style, `tools/decorate.js`): pick decoration from here instead of guessing ids.
Made 2026-11-23 by the visuals session (VISUALS.md). Numbers are from 119 levels: 97 rated community
levels in `local/community/` (Easy -> Harder, Featured / Epic / Legendary / Mythic, eras 1.x to 2.2) and the
22 official levels in `local/official_NN.json` (their old 1.x/2.0 data, not the 2.2 re-decorations).

## Files

- `catalogue.tsv` -- every object id with a sprite (4093): id, group, family, frame, kind, size in
  blocks, default layer, default main / detail channel, number of sprites, a looks-like note.
  `grep -P "\tdeco-scenery\t" knowledge/objects/catalogue.tsv`, or by family: `grep "\td_cloud\t"`.
  Layer / channels are "?" for 2.2-only ids (GD's own table gives the frame only).
- `usage.json` -- the counts below, per family, per tier and era, pairs, per level (numbers only).
- Pictures: `local/catalogue/<group>_NN.png` (contact sheets, 12 x 10, id + size + frame + note; main
  colour white, detail light blue, black black; the faint square in each cell's corner = one block at the
  same scale). Not committed (RobTop's art); rebuild with `node tools/catalogue.js sheets`. Or browse and
  search: `node tools/serve.js`, http://localhost:8765/viewer/catalogue.html
- Remake: `node tools/catalogue.js index`, `... usage` (after more community levels are fetched).

## Groups (contact sheets)

| group | ids | what |
|---|---|---|
| blocks | 114 | solid blocks and platforms; skins 1-7 (grid), 40 plank (slab), 62-68 block bits, 83 brick... |
| slopes | 72 | 45 / 22.5 degree slopes per skin |
| hazards | 130 | spikes (8, 39, 103 small...), saws, pits, thorns that kill |
| interactive | 57 | portals (10-13, 45-47, 99, 101, 111, 286-287, 660, 745, 747/749, 1331, 1933, 2926), orbs (36, 84, 141, 1022, 1330, 1333, 1594, 1704, 1751, 3004), pads (35, 67, 140, 1332, 3005), speed (200-203, 1334), coins / keys |
| triggers | 142 | trigger buttons and editor-only objects (not drawn in the game) |
| deco-blocks | 1204 | block fills and parts with no collision: coloured fills, outlines, 3D edges, tiles, the 2.2 `gdh` block set (2703-3091) |
| deco-spikes | 51 | ground spikes / crystals 18-21, grass 406-408 414 906, grass art 907-910, spike waves 419-420, fake spikes 191 198 199 393 1889-1892 |
| deco-shapes | 185 | circles, rings, arrows, gradients, slope fills, links, spirals, flash rings, pixel-art pieces |
| deco-scenery | 37 | clouds, chains, antennas (rods), cogwheels, wheels, pillars, skulls, bushes, lava / water tops |
| pixel | 1775 | 2.2 pixel-art tiles (`pixelart_NNN`, 2098-4399) |
| effects | 300 | fire, particles, animated water / lightning (gj_*), special |

## What good levels use (share of levels with >= 1 object of the family)

Rated community levels are mostly decoration: median **80% of objects are deco** (2.0-2.2 eras;
1.x levels 53%), **17-22 deco objects per block of length** (1.x: 2.6). The official levels' old data:
40%, 2.2 per block -- they are the sparse, classic look. Tiers barely differ (Easy 83%, Harder 78%):
decoration is not a hard-level thing, every rated level has it. Harder levels use more kinds
(median 47-51 families vs 30-31 for Easy / Normal).

| family (ids) | 2.2 | 2.0-2.1 | official | looks like |
|---|---|---|---|---|
| lightsquare (70, 76-78, 81, 91, 94, 161, 207-213, 247-275, 1820-1828) | 100% | 97% | 36% | flat coloured block fills / parts -- the base of designed blocks |
| lighttriangle (687-702, 1747-1748) | 100% | 84% | 23% | the same fills for slopes |
| d_gradient / _b / _c (503-505, 1009-1013, 1269-1274, 1291-1293) | 91% | 84-89% | 18-32% | soft gradient squares and corners: glow and shading on blocks |
| persp_outline (506-640, 902, 943-1071, 1529-1569) | 77% | 95% | 27% | 3D edges: lines and faces that make blocks look deep |
| d_small_ball (1764-1768) | 95% | 62% | 5% | small dots: particles, stars, lights |
| d_scaleFadeRing (1831-1842) | 95% | 56% | 5% | rings that pulse out (animated) |
| emptyFrame (1886-1888) | 95% | 60% | 5% | invisible helper frame (used as a target / centre) |
| d_ball (50-54, 60, 148-149, 405, 3621-3629) | 86% | 86% | 64% | shapes: circle, ring, heart, diamond, star, note... |
| d_arrow (132, 460, 494, 3630-3632) | 86% | 83% | 50% | arrows (also as "jump here" hints) |
| d_circle (236, 497, 3636-3637) | 86% | 52% | 18% | big circles / rings |
| block008_topcolor (1120-1139, 1241-1246) | 82% | 56% | 5% | coloured top edges for designed blocks |
| d_whiteBlock (916-917) | 77% | 63% | 14% | plain white block (recoloured) |
| gridLine01 / 02 (1753, 1754) | 77% / 73% | 29% / 38% | 9% | thin grid lines |
| d_cloud (48-49, 129-131) | 73% | 54% | 41% | soft clouds |
| d_ringSeg (997-1000) | 68% | 59% | 18% | ring segments (rotating rings) |
| d_grass (406-408, 414, 906) | 59% | 59% | 9% | grass tufts on block tops |
| blockOutline (69, 71-75, 90-96, 119, 160-169, 289-355...) | 41% | 76% | 32% | outline-only block shapes |
| d_spikes (18-21) | 32% | 32% | 86% | the classic ground crystals |
| chain (41), d_02/d_03_chain (106-110, 498-499) | 27% | 38% | 82% | hanging chains |
| rod (15-17) | 27% | 17% | 95% | antennas with a ball |
| d_cogwheel (85-87, 97) | 32% | 48% | 41% | gears |

## How they are combined (families found together in the same level, >= 3 objects each)

- **The designed-block kit (2.0+)**: lightsquare + persp_outline (84 of 119 levels), + d_gradient (84),
  + lighttriangle (81), + d_gradient_c (77). That is: a coloured fill, a 3D edge on the visible sides,
  a gradient for shading, the slope versions where the block slopes. Blocks you can stand on are plain
  skins with these placed over them (no collision); 92% of deco objects carry their own colour channel
  (key 21), only 7% a detail channel (key 22).
- **Lights and motion**: d_ball / d_small_ball / d_scaleFadeRing / d_ringSeg / d_flashRing with
  arrows: dots, pulsing rings and rotating segments, usually on a glowing (blending) channel.
- **The classic kit (official levels, 1.x)**: d_spikes on the ground, rods and chains on block tops and
  ceilings, clouds and cogwheels in the air, few colours. This is what GDLM's "classic" style should use.
- **Layers are used everywhere**: 71% of deco objects set a z-layer (key 24): B1-B4 for fills and
  backdrop shapes, T1-T3 for edges and lights over the gameplay; 2.2 levels add B5 and T4.

## Open

- Families are named from frame names; a few notes are guesses from the name (catalogue column
  "note"). Look at the sheet before trusting a note.
- "How combined" is presence in the same level, not placement. Next: measure placement (deco relative
  to the nearest gameplay block: on top, inside, behind, in the air) with `tools/style.js`.
- Animated deco (d_scaleFadeRing, d_ringSeg rotating) and particles need triggers to look as in the
  game; the viewer draws them still.
