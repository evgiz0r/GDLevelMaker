# ART -- drawing things in GD: pictures -> objects, and the prop library

Why: the rated community levels the user played on 2026-11-23 (Spooky Dash by Fabruuuu, ID 150941693, and
others; recording `GD claude-rec 2026-11-23_20-41-39.mkv`, never delete it) are illustrated scenes --
pumpkins, graveyard trees, creature faces, pixel forests, factory chains -- built from many small pieces in
one palette per scene. Our levels could not draw anything. This is the start of that. Owner: the art session
(2026-11-23); the showcase session builds scene levels on top of it (SHOWCASE.md, tools/scenes.js).

## Files

- `lib/pixelart.js` -- the core (node + browser): a pixel canvas (`grid`: rect, ellipse, ring, line, poly,
  stamp rows, outline, flipX), `toObjects(grid, {x, y, px, ch, z, zo, anchor, groups})` -> GD objects,
  `quantise(rgba, w, h, k)` (k-means to k colours), `downscale`.
- `tools/pixelart.js <image.png> [--at x,y] [--scale s | --width W] [--colours k] [--max-objects N]
  [--outline r,g,b] [--glow r,g,b] [--into lvl --out lvl] [--json f] [--preview f.png]` -- a picture -> objects,
  with a report of counts per colour channel. `tools/png.js`: PNG read / write in plain node.
- `lib/props.js` -- the prop library: `list()`, `put(name, x, y, opts)`, `place(name, x0, x1, opts)`,
  `header(header, colours)`, `allocator(ch0)`. API and options at the top of the file.
- `tools/props.js list | show <name> | sheet [--theme spooky] | level` -- table, text pixels, contact sheet
  (`local/props/props_<theme>.png`, art-free), the test level `levels/gdlm_prop_test.gdlvl`.
- `tools/props_sheet.py` -- draws the contact sheet (PIL).
- In a spec (tools/make.js): `"props": [{"prop": "pumpkin", "col": 30}, {"prop": "tree", "from": 40, "to": 80,
  "density": 2}]`, `"propTheme": "spooky"`, `"propsCh0": 600`. make.js puts the channels in the header and
  warns when a ground prop stands within 2 blocks of gameplay (it may read as an obstacle).
- Test: `node tests/pixelart.js` (objects redraw the picture exactly; props deco-only, under budget, < 7 blocks).

## How a picture becomes objects

1. Colours: at most k (default 6) -- each colour is one colour channel, so a scene keeps few channels.
   Transparent pixels (alpha < 128) stay empty.
2. Pieces: every pixel is drawn by **deco square 211** (`lightsquare_01_05_color`: a plain white 1x1 square,
   decoration, no hitbox; checked in GD's sprite sheet: solid to the edge, no border) -- recoloured by its
   channel and stretched with 2.2's separate **scale X / Y (keys 128 / 129)** into a rectangle.
3. Merging, painter's order: colours are drawn bottom-up, each with its own **z order (key 25)**, on one
   **layer (key 24, default B2: behind the player)**. A colour's rectangles may run under the pixels of every
   colour drawn above it, so a pumpkin body is a few big rectangles under its face, not dozens around it. The
   paint order is searched (by area, by spread, then single moves while the count drops): an outline goes at
   the bottom as a silhouette. tests/pixelart.js redraws random pictures from the objects, pixel-exact.
4. Budget: `--max-objects N` drops colours (to 3), then halves the grid, until it fits.

Numbers: 16-53 objects per prop of 150-750 pixels; a 40x32 flat illustration with outline 57; a 48x48
smooth gradient at 8 colours 12 (k-means regions are blobby, so it merges well -- photos look posterised).
Whole prop library: 31 props, ~700 objects. Rated 2.2 levels carry 17-22 deco objects per block
(knowledge/objects/README.md), so a 4-block tree at 38 is cheap. Phones: keep a scene under a few hundred
prop objects per screen.

## The props (2026-11-23)

Contact sheet: `node tools/props.js sheet` (day colours) / `--theme spooky`. GD art: the test level through
`node tools/levelmap.js levels/gdlm_prop_test.gdlvl --scale 2 --rows 1` (local/maps/, not committed).

| prop | attach | blocks w x h | objects | colours |
|---|---|---|---|---|
| tree | ground | 3.7 x 4.7 | 38 | bark bark2 leaf leaf2 leaf3 outline |
| dead tree | ground | 4.0 x 5.0 | 53 | bark bark2 outline |
| pumpkin | ground | 2.0 x 1.7 | 31 | orange orange2 stem glow outline |
| house | ground | 4.3 x 4.7 | 46 | wall wall2 roof roof2 dark glow wood outline |
| lamp post | ground | 1.5 x 4.0 | 16 | metal metal2 light glow outline |
| fence | ground | 2.3 x 1.4 | 26 | wood bark outline |
| tombstone | ground | 1.4 x 1.7 | 16 | stone stone2 stone3 leaf3 outline |
| hanging block | hang | 1.8 x 4.9 | 15 | GD chain 110 + stone block |
| gear | bg | 2.3 x 2.3 | 6 | GD cogwheel 85 + pixel hub |
| cloud | bg | 4.7 x 2.0 | 10 | cloud cloud2 |
| moon | bg | 3.7 x 3.7 | 24 | moon moon2 |
| bush | ground | 2.4 x 1.5 | 18 | leaf leaf2 leaf3 outline |
| rock | ground | 2.1 x 1.5 | 20 | stone stone2 stone3 outline |
| robot | ground | 1.8 x 2.8 | 34 | metal metal2 light dark glow eye outline |
| human | ground | 1.6 x 2.8 | 24 | skin hair dark roof shirt trousers outline |
| ghost | bg | 1.8 x 2.2 | 33 | ghost ghost2 dark outline |
| glowing eyes | bg | 1.5 x 0.5 | 8 | eye dark |
| bat | bg | 1.6 x 0.7 | 11 | wing eye |
| crow | ground (perch) | 1.2 x 0.8 | 12 | wing dark eye orange2 |
| candle | ground | 0.7 x 1.3 | 9 | glow light moon moon2 outline |
| flower | ground | 0.9 x 1.2 | 15 | leaf leaf2 petal (seed) glow outline |
| sun | bg | 3.3 x 3.3 | 9 | glow light |
| mountains | bg (foot at y), B5 | 12 x 4.5 | 56 | mountain mountain2 snow |
| hills | bg (foot at y), B4 | 12 x 3 | 17 | leaf3 leaf |
| tower | ground | 2.7 x 6.7 | 18 | stone stone2 dark outline |
| ruin | ground | 5 x 4.3 | 29 | stone stone2 stone3 leaf3 outline |
| cloud band | bg (foot at y), B4 | 8 x 2.4 | 12 | cloud cloud2 -- tile with place(); `flipY` = a top frame hanging from y |
| rays | bg (fan top at y), B4 | 11 x 6.5 | 6 | ray -- 6 rotated stretched squares; give "ray" opacity ~0.3 in the header |
| leaf / petal | bg, T1 | 0.5 / 0.4 | 5 / 3 | orange bark / petal light -- motif particles, place() with density |
| windmill | ground | 4.7 x 5.3 | 92 | wall wall2 roof wood cloud dark outline (diagonal sails are costly: rotate GD squares instead, open) |

Colour names are shared (`NAMES` in lib/props.js), so props placed with one `allocator` share channels: a
forest of trees and bushes uses one leaf channel. Scene colour: `theme` (day, spooky, night, factory) or a
scene `palette` {bg, ground, fill, edge, accent} (the showcase planner's): outlines from edge, lights from
accent, the rest tinted half-way to fill at its own brightness -- one palette per scene, as rated levels do.
Aliases take the planner's plural names (tombstones, jack-o-lanterns, chains, ...).

`place(..., {avoid: objects, clear: 2})` keeps ground and hanging props 2 blocks off every gameplay column (background ones ignore it).

Rules the props keep: calm (no triggers inside a prop; animate a prop's `groups` from outside, on bars only,
TASTE.md); no rings or round orb-coloured shapes near the path; at most ~5 blocks high; no hitboxes. Ground
props stand behind the player on B2 -- fine in GD -- but one right next to a jump can read as an obstacle
(make.js warns).

Frames and see-through fronts (asked by the style session for a landscape level, 2026-11-24): any prop takes
`layer` ("T1".."T3" in front of the play), `scale`, `flipY`, and `channels: {name: ch}` to draw on the caller's
own channels; see-through = that channel's opacity below 1 in the header (P.header writes 1) or an alpha
trigger on the prop's `groups`. The props never use hazard colours; keep fronts off the player's path anyway.

## Colour -- UNCHECKED in the game

The signature came out pure white in the real game (GDLM 60): its 211 squares on channels 988-999, channels
in the header. Not understood yet; the visuals session's `tools/colourtest.js` (rows A-J) asks the user. Until
the answer: props set BOTH colour keys (21 main and 22 detail -- either way 211 gets its channel), use channels
600+ (opts.ch0), and the prop test level opens with four pumpkins: **A** keys 21+22 on ch 6xx (what every prop
does), **B** key 21 only, **C** key 22 only, **D** keys 21+22 on channels 40+. Which are orange in the game
decides the default (`chKeys`, `ch0`). Write the answer here.

2026-11-24, recording `GD claude-rec 2026-11-24_02-45-05.mkv` (~238 s): the user played the ONLINE GDLM 44 hellgate
(My Online Levels, "version 3") and its signature figures were pure white again -- but that upload carries the
v2 signature (figures standing on the ground, key 21 only), not v3. The colour test (rows A-J) and the prop test
(pumpkins A-D) were not played in that recording, so the question is still open.

## Open

- GD-art render of the first 18 props (local/props/props_gdart.png, from local/maps/gdlm_prop_test.jpg, 2026-11-23):
  all draw in the viewer's GD art as on the art-free sheet, but in spooky colours the bat and the glowing eyes
  are too small and dark to read (a few pixels on the dark sky), the hanging block's chain is faint, and the
  bush / rock / tombstone sink into the ground hills. Next: bat and eyes 2x, ground props on B1 or a lighter
  edge. The 5 newer props (crow, candle, flower, sun, windmill) and the A-D pumpkins are not rendered yet (the
  PC was full: re-run `node tools/solutions.js levels/gdlm_prop_test.gdlvl`, then levelmap).
- The colour answer (above); then the in-game look of the test level (sizes, z order, seams between stretched
  squares at non-integer scales).
- More props for the showcase planner's places (crow, candle, windmill, flower, sun are in): kelp / coral (or wrap
  scenekit's), witch silhouette, broken arch, stained window.
- Diagonal edges: half-cell triangles (693 lighttriangle) on staircase edges would smooth curves cheaply.
- Glow: GD's own glow / gradient pieces (1293) behind lamps and eyes, once the colour answer is in.
- Pictures from Blender (tools/blender_model.sh in the GamePlatform kit: render a model small, flat-shaded,
  then tools/pixelart.js) -- not tried yet; PIL drawings and hand-drawn rows work.
- The signature v3 is built from this library (robot + human, both colour keys, channels 976-989 via props.header, the stage 3 blocks over the path; tools/signature.js, merged 426b12b, checked by visuals on GDLM 45). Unchecked: GD art and the game.

## Claude icons (the solver's own icon set, 2026-11-24)

The user: "lets make an icon set for claude" -- in the viewer the solver plays with its own icons next to the
user's GD icons. `lib/claude_icons.js`: one original pixel icon per mode (cube 16x16 px, ship, ball, ufo, wave,
robot, spider, swing), the signature robot's face (a dark visor with two amber eyes, a cream brow plate, an
antenna light) on a terracotta body, cream plates, dark-brown outline, glow (255,150,80). Our own art: no logos,
nothing of RobTop's. `node tools/claude_icons.js sheet` -> local/props/claude_icons.png (icon size + 4x, dark and
GD-blue backgrounds); `png` -> one PNG per mode for the viewer (viewer/icons/claude/, after the user's OK);
`text <mode> [kit]`. Then the user's reference pictures (a player's icon kits; a sheet of GD-style faces): it
must read as ONE kit -- one motif on every mode, one palette, thick dark outlines, simple shapes. So
lib/claude_icons.js is now bodies with a face slot + a kit's motif: kits A visor bot, B a cream "C" mark with a
spark dot, C a happy face; `node tools/claude_icons.js kits` -> local/props/claude_kits.png (one row per kit).
Then the user's "main traits": Claude's spark -- a radial starburst of thin rays, terracotta and cream. Kits
D (cream rays on terracotta), E (terracotta rays on a cream disc), F (D with two eyes at the hub); drawn as our own
pixel rays (8, long / short; 12 smear below a 16-px slot), each body's bigger "spark slot".
`node tools/claude_icons.js kits --only spark,spark2,sparkface` -> local/props/claude_spark_kits.png. The spark
evokes Anthropic's Claude mark: fine in our viewer and levels; think before it goes on anything public as "official".
The user: "your icons are ok" -> kit D ("spark": cream rays on terracotta) chosen by the art session. Viewer files:
`node tools/claude_icons.js png --kit spark` -> viewer/icons/claude/<mode>.png (8 px a pixel, glow included, for
gd-visuals' "solver" icon). The end sign (tools/signature.js) carries the spark as a round badge above the title
(`CI.badge(24)`: 12 rays, 2 blocks, channels 973-975, ~30 objects; `badge: false` turns it off). Private levels only
for now (the spark evokes Anthropic's mark). Unchecked in the game.
STATUS (older): viewer files (for gd-visuals) and an in-level prop
version (GD objects, like the signature) come after it.

## Colour readability (the user, 2026-11-24: "sometimes its not clear and its all mooshy")

A soft rule, scored by `node tools/contrast.js <level ...> [--all] [--official] [--worst N]` (also score.js gate
"contrast", WARN under 70). Every 10 blocks, with the colours the header and colour triggers give there (time ~ x at
1x: approximate on levels with speed portals), it measures LUMINANCE contrast (WCAG ratio): hazard/bg, block/bg,
ground/bg (or the ground line), a hazard against a differently-coloured block next to it, and deco in front of hazards.
Thresholds = the official levels' 10th percentile: hazard/bg 1.6, block/bg 1.5, ground/bg 1.1 (or line/bg 3),
hazard/block 1.3 (only when their colours differ: one colour for both is normal GD, told apart by shape), 40+ deco
pieces on hazards in a section. Official medians: hazard/bg 2.1-21 (most 3.5-7), ground/bg 1.0-3.9.
Official section scores: 4-100, median ~88 (Fingerdash 4 and Dash 26: heavy colour-trigger / copy-colour effects the
approximation reads badly -- a known limit; Stereo Madness .. Hexagon Force 67-100).

GDLM sweep (2026-11-24): 47 sunny side 38 (blocks / spikes at the sky's brightness, block/bg ~1.3; a spike and its
block in two hues at one value, ~27-28 s and ~97 s), 45 first flight 74 (block/bg 1.08 at ~31 s), 44 hellgate 75
(ground at the background's brightness, ~1-3 s and ~10 s; its bright line saves part of it), 51 adrift 97 (deco over
hazards ~7.7 s); the rest 100. Pictures: local/shots/ (shoot.js at those times).

**The palette rule** (for compose / scenes / anyone picking colours):
1. Pick the background first, then put hazards and block edges at the OTHER end of brightness: dark bg -> light
   hazards (or white edges), light bg (a sunny sky) -> dark blocks and spikes. Ratio >= 3 is safe, 1.6 is the floor.
2. Hue is for mood, value is for reading: two colours one step apart in hue but equal in brightness are mush.
3. Ground: a step darker or lighter than the bg (ratio >= 1.1), or a bright ground line.
4. Colour triggers keep the rule at every moment: check the colour a trigger fades TO against what is behind then.
5. Glow and deco go behind the play (B layers) near hazards, and are dimmer than the hazards' edges.
Tool: `require("./tools/contrast.js").ratio(rgbA, rgbB)` for a quick pair check; `measure({header, objects})` for a level.

## Deco library (2026-11-24; the user: our levels look like "3 squares and poopy" next to real ones)

Targets: knowledge/levels/modern_look.md "Recipe" (20-50 objects per block, layers B4-B5 ~20% / B1-B3 ~25% / T1 /
T2-T4 15-25%, a third of channels blending, HSV on ~40%, motion per minute) and the per-screen study below.
- `tools/decokit.js` (own compositions, deco only, the caller's channels):
  `blockPattern(objects, x0, x1, {ch, top})`: running-bond bricks inside closed cells, a lit top trim (band + grass
  triangles) on open tops, ~2-4 per cell. `backdrop(x0, x1, {far, mid, near, trees})`: three depths of one-colour
  silhouettes (mountains B5, hills B4, a tree line in two sizes B3), using props' new `silhouette` option (a tree 38 -> 14 objects).
  `tufts(objects, x0, x1, {ch})`: grass in front at the ground line, 2 blocks clear of hazards / orbs / portals.
  `depthColours(sky, tint)`: far / mid / near from the sky (aerial perspective).
- `tools/decowin.js <level> --at b1,b2 [--w 24]`: a quick art-free picture of level windows (flat shapes, start
  colours, objects per block in view); no solve, not heavy. For GD art: tools/shoot.js (heavy).
- First pass on a copy of GDLM 64 golden hour (local/deco/gh_before_after.png): 13.7 -> 26.7 objects per block (pattern
  2.7, backdrop 7.8, tufts 2.5). Lessons: (1) a dark silhouette right behind the path swallows black spikes -- back
  layers paler toward the sky with distance (depthColours); (2) what reads as "squares" most is BIG FLAT RECTANGLES
  (sky / frame clouds as one stretched square each): edges need shape -- scalloped "cloud band" props, stepped
  silhouettes, gradients.

## Deco study: real levels per screen (2026-11-24, `tools/decostudy.js`, 822 levels, one 41-min run)

One screen is 20 blocks (600 units). Each level gets its median screen, and the table shows each group's median.
gd-taste's corpus is local/taste/corpus.json. The results stay in local/decostudy/ and are not committed.

| group | levels | objects/screen (per block) | layers | dress per play object | glow | channels | motion triggers/screen | contrast |
|---|---|---|---|---|---|---|---|---|
| taste featured | 192 | 372 (18.6) | 3 | 3.8 | 53% | 8 | 15 | 45 |
| legendary 2.2 | 18 | 416 (20.8) | 4 | 6.0 | 45% | 15 | 63 | 44 |
| featured 2.0-2.1 | 26 | 347 (17.4) | 3 | 3.7 | 67% | 6 | 11 | 56 |
| taste other (not featured) | 105 | 266 (13.3) | 3 | 2.2 | 33% | 4 | 6 | 63 |
| official 1-22 | 22 | 112 (5.6) | 3 | 0.5 | 1% | 0 | 2 | 93 |
| **GDLM (ours)** | 16 | **31 (1.5)** | 2 | **0.2** | **0%** | 0 | **0** | 100 |

Quartiles (p25-p75):
- taste featured: n 242-632, dress 2.0-6.2, motion p75 35;
- legendary 2.2: n 341-623, dress 3.8-16.9, motion p75 82;
- GDLM: n 7-123, dress 0.0-0.6.

What it says:
- **Density.** Featured levels carry ~12x our objects per screen, and even RobTop's own levels carry 3.6x.
  What separates featured from not featured: dress (3.8 vs 2.2), glow (53% vs 33%), channels (8 vs 4) and motion (15 vs 6).
  The overall count matters less (372 vs 266).
- **Dress is the biggest gap.** A featured level puts ~4 deco pieces within 1.5 blocks of every block or spike, a
  legendary one ~6; we put 0.2. So the play objects themselves get decorated: trims, fills, outlines, glow around them.
  A backdrop alone does not close it.
- **Glow:** about half of the objects in a featured level sit on a blending channel or come from a glow / gradient family.
  Ours: none.
- **Motion:** 15 motion triggers per screen (move, alpha, pulse, particles...), 63 in legendary 2.2. Ours: 0.
- **Layers:** a median of 3 layers holding 5% or more each. The back and front shares are small (most deco sits at
  B1-T1 around the play), so depth comes from colour more than from layer count.
- **Contrast is not what featured levels win on:** their median is 45 on tools/contrast.js, while the officials score 93
  and we score 100. The score reads only start and trigger colours (no glow, no art), so a busy level loses points.
  Keep it as a floor for OUR levels (WARN under 70), not as a taste target.

**Targets for a GDLM level (per screen, play sections):**
- n 250-600 (12-30 objects per block);
- dress at least 3 per play object;
- glow 30-50%;
- at least 6 channels, with HSV variants;
- at least 10 motion triggers;
- at least 3 layers;
- contrast at least 70 (tools/contrast.js).

Check any level with `node tools/decostudy.js <file.gdlvl>`.

**Order of work** (gd-taste's model with these measures in, TASTE_DATA.md "Per-screen deco measures", 2026-11-24):
- Motion first: put move, rotate or pulse triggers on deco on every screen. It is the strongest signal for featured
  levels, with effort taken out (+0.32), and holds for epic+ too (+0.36).
- Channels next: +0.18.
- Dress counts mostly as effort (+0.12).
- Glow helps featured over the rest (+0.14), but the best levels use LESS of it (epic+ against featured -0.26). Keep it
  moderate: 30% is the target's low end, not something to maximise.
- Layer count says nothing.
score.js's "taste" gate now includes these measures.

**Reference levels**: readable (contrast 70 or more), dressed and layered, with n 300-3000 per screen. Ids are
community levels in local/community/ (local only).

| id | name | n/screen | dress | glow | channels | motion | style |
|---|---|---|---|---|---|---|---|
| 138346597 | Hyperluminal | 1945 | 52 | 23% | 18 | 22 | very dense, detailed |
| 92555035 | Dreamy | 372 | 28 | 52% | 15 | 43 | soft glow, lots of motion |
| 149743086 | how is it october | 792 | 56 | 3% | 9 | 0 | flat-colour scenery, no glow |
| 141525782 | Brave Blue (legendary 2.2) | 383 | 17 | 31% | 20 | 34 | modern 2.2, our density range |
| 31912642 | Project Muse | 729 | 14 | 36% | 9 | 112 | motion-heavy |
| 26248615 | Highscore | 439 | 6 | 86% | 8 | 14 | glow-based (2.0-2.1 style) |

Brave Blue and Dreamy sit at our target density: compare against them first (tools/decowin.js, or
tools/shoot.js for GD art).

Open:
- deco on a moving group counts at its start x;
- glow is counted by family and blending only, not by how it looks;
- the dress radius (1.5 blocks) was not tuned.
