# DECOART -- deco as a picture: paint the scene first, then build it from GD shapes

Why (Evgeni, 2026-11-26): "upgrading our deco, doing some iterative testing on how we can decorate more picture like, or
more esthetically, im not pleased with those tasteless decos [...] almost like video/picture generation [...] thats a big gap
in skill". Our kits (ART.md "Theme kits") place good pieces by rules -- ranges of triangles, glows, embers -- but nobody
composed a PICTURE: no focal point, no light, no value plan, the same mountains in front of the play on every screen.
Owner: the deco-art thread (2026-11-26). Read ART.md, CRAFT.md, TASTE.md first.

## The idea

A painter works thumbnail -> values -> colour -> detail, and image generators work from a picture, not from rules. So the
backdrop of a section is made as ONE picture first (a matte painting: sky, light source, clouds, far ranges, a landmark),
and only then turned into GD objects. The picture is where the taste lives; turning it into objects is a solved,
mechanical step that we can measure (how close the objects redraw the picture).

Three ways to turn a picture into a level's backdrop, all built and compared on the same stretch:

| | how | look | objects (GDLM 44, blocks 0-88) |
|---|---|---|---|
| **A fit** | a painted target picture (`tools/paintscene.js raster`) fitted with GD shapes one at a time, each the best of many random tries refined by hill climbing, its colour solved exactly (`lib/paintfit.js`, the "primitive" method) | soft, painterly | 500 shapes, 18 channels, rmse 4.5 / 255, 12 s |
| **B vector** | the same scene's items straight as shapes: sky as bands, glows as stacked see-through disks, ridges as squares + right triangles (`paintscene.js vector`) | clean, flat, designed (Dreamy-like) | 152 shapes, 30 channels, instant |
| **C image** | approach A on ANY picture: Evgeni's drawing, a photo, a generated image (`tools/decoart.js --image pic.png`) | whatever the picture is | as A |

The shapes are GD's flat pieces whose outline we know: square 211 (30 units), right triangle 693 (30 units, rising to the
right), disk 497 (50 units), each stretched with keys 128 / 129 and turned with key 6. No pixel grid (ART.md: staircase
edges read as low-res). Each shape's exact colour = a base channel (k-means over the shapes' colours, one set per opacity)
turned by the object's HSV (keys 41 / 43): any colour from ~6 channels per opacity.

**Placement** (`tools/decoart.js`): the back picture (sky, sun, clouds, far ranges, the gate) on B5, locked to the player's
x at 0.9 (far: it barely drifts); the near ridge on B4 at 0.75 (parallax). The picture spans y -30..270, what a cube
part shows (~8 blocks over the ground; the first try at 420 put the sun above the view). The focal point (the sun) is put
at 68% of the screen's width half way through the stretch, from the camera's place (left edge ~260 units behind the
player, view ~570 wide at 1080p, measured on the viewer's frames). The stretch's old back-layer deco (B5 / B4 / B3) goes;
the play's own dressing stays.

## Round 1 (2026-11-26): GDLM 44 hellgate, blocks 0-88 (cube + ball), scene "hellgate"

Three copies in the viewer's in-progress list (session `deco-art`): `kit` (the fire kit as built), `fit` (A), `vector` (B).
Sheet: project files `decoart/round1_sheet.png` (art-free shapes render: kit / fit / vector rows, 1 s, 4 s, 7.5 s).
- Both pictures read as a place with a light source; the kit reads as a wall of triangles behind the play.
- B (vector) is cleaner; its glow shows rings (7 stacked disks) -- a blending channel or the soft gradient pieces (503-505,
  1011-1013) could smooth it. A (fit) is softer but muddier at 500 shapes over ~2 screens (the sun's edge breaks up).
- Lessons on the way: dark small triangles along the floor read as SPIKES (removed from the near layer); a big dark
  landmark must stay lighter than the play's black (the gate is a hazy dark red); a picture taller than the view loses its
  top (the sun).
- Not checked: the GD-art render on the PC and the real game (z order inside one layer = object order? 497's edge soft or
  hard? 30 channels fine?).

## Round 2 (2026-11-26): the mix, Evgeni's pick

`tools/decoart.js ... --variants mix`: only the sky, the sun's glow and the clouds are painted and fitted (400 shapes,
rmse 1.5, 10 s); the sun's disk, the ranges and the gate go on top as clean vector shapes (one B5 group, lock 0.9), the near
ridge as before. The first mix fitted the sun's disk too and its edge came out ragged: a focal shape with a hard edge is
vector, only soft light is fitted. In the viewer: deco-art / gdlm_44_hellgate_mix. Sheet: project files
`decoart/round2_mix.png`. Next: a picture per section of the full level (flying sections need a taller picture).

## Round 3 (2026-11-26): the blocks, `tools/blockart.js`

Evgeni on round 2: "The blocks are still very timid. No effects. No good texture. All single filled color. Very basic."
`blockart.rock(level, x0, x1, {pal})` dresses every play block of the stretch (T1, in front of the skins, deco only) and
replaces designBlocks' flat fill / edge lines / glow there: a body square per cell lit from the top and darker with depth
(value noise per cell), 1-2 turned see-through triangles per cell (a faceted rock surface), glowing veins walking down from
open tops (blending channel + soft glow, in the fire kit's seam group 532, so they flash with its beat pulses), a hot rim
and glow on open tops, dim side lines, a dark band under open bottoms, a see-through shadow down-left (B1), embers drifting
up. Palettes `lava` and `ice`. ~540 objects on blocks 0-88 (299 flat ones removed). First cut: veins too thick and many,
body as bright as the sky -> thinner veins, 30% of tops, darker body (top [92,28,26], deep after ~2 cells).
The art-free viewer now draws front-layer deco (key 24 >= T1) OVER the blocks, as the game does (it drew all deco
under them, which hid any painted block body).
Open: in GD art and in the game (does 211 on T1 cover the skin as in our render?); a facet pattern less grid-like;
slopes and spikes dressed the same way; a per-theme set (ice veins = cracks with frost).

## Block design: what GD creators teach (Evgeni's six steps, 2026-11-26)

Evgeni sent six steps with 8 tutorial videos (their auto-caption transcripts: project files
`decoart/block_design_transcripts.md`, not in git). What the videos agree on, as rules for `tools/blockart.js`:

1. **Structure first** (one tutor: "up to 50 percent of how your block is going to look"). Not plain squares: random
   rectangles, slopes, half blocks, a step up then down; keep it simple rather than exaggerated. Spikes are part of the
   structure's shape. For us the play blocks are fixed by the layout, so structure means the DRESSING's outline: extra
   non-solid pieces, cut corners, pillars in front, a cap on top -- never changing the hitboxes.
2. **Outline, then an inline.** A solid outline around the whole mass, then a second line a fixed distance inside it
   (often black), corner pieces at the corners ("don't forget about the corner pieces"). Line rule: the thinner the line,
   the more it must contrast with what is behind it.
3. **Base fill + texture.** Fill with 2-3 colours from one palette with value steps and a little hue shift (one tutor:
   base hue, +90 / -90 hue for the variants), not monochrome. Break up flat space with low-opacity patterns, bricks,
   default blocks on blending colours ("remove continuity").
4. **Details: small = high contrast, big = low contrast.** Connectors, crystals, mechanical bits; "the more the detail
   contrasts with the block design, the smaller it should be". Don't fill every cell; details fit the structure.
5. **Light sparingly.** Low-opacity blending glow on top edges, low-opacity black glow at the bottom (shadow); one
   highlight, not glow everywhere ("don't spam the glow"). Black inner outlines go IN FRONT of the glow, or not at all.
   A drop shadow from one light direction (black, ~30% opacity, never stacked twice).
6. **3D, one direction.** 3D lines from every edge in exactly the same direction, darker than the base; a dark base under
   the 3D; outlines on the 3D too.
Plus: decorate the spikes the same way (outline, inner line, glow), and particles rising from open tops.

Round 4 (2026-11-26): `blockart.layered()` (`decoart.js ... --blocks layered [--tag _layered]`) builds the blocks by these
steps: base in 3 colours by 3x2-cell patches (top row lighter), a brick texture at 20% opacity and a few big blended
diamonds at 10%, a bright outline on every open edge with a black inline 6 units inside (in front of the glow), glow
under top edges and a dark band over bottom edges, small bright bits in some inner cells, 3D up-right (8 units) behind
the block with its corner triangles and a dim rim. ~1050 objects on blocks 0-88 (~12 per cell). Sheet: project files
`decoart/round4_layered_blocks.png` (top: round 3 rock, bottom: layered). In the viewer: deco-art /
gdlm_44_hellgate_mix_layered. Open: spikes dressed the same way, cut corners / pillars in front (structure), fewer
objects (one 3D square per cell is wasteful inside a mass), the GD-art render.

Ice twin (2026-11-26, Evgeni: "give me some of the best looks of firy and icy"): `paintscene.js` scene `frozen` (night
sky, moon, aurora ribbons, moonlit snowy ranges, an ice spire landmark) and `--blocks layered-ice`, on GDLM 72 Frostbite
blocks 0-88: `decoart.js levels/archive/gdlm_72_frostbite.gdlvl --from 0 --to 88 --scene frozen --variants mix --blocks
layered-ice --tag _ice`. Viewer: deco-art / gdlm_72_frostbite_mix_ice. The best looks of each theme are listed in
`local/decoart/best.json` ({group, png, caption, level}); `tools/deco_page.js` puts them first on the phone page's deco page.

## Why it still looks bland: the fire / ice looks vs rated levels (measured 2026-11-26)

Evgeni: "it looks bland compared to real levels". `node tools/modern_look.js <level>` and `node tools/decocomp.js <level>`
on the two best looks (hellgate_mix_layered, frostbite_mix_ice), against knowledge/levels/modern_look.md and
knowledge/decocomp_ref.json (featured 2.2, median):

| | ours (fire / ice) | rated 2.2 | gap? |
|---|---|---|---|
| objects per block | 26 / 16 | 32-46 | a bit thin |
| colour channels, HSV share | 82, 38-50% | 54-179, 40-43% | fine |
| front layers (T2+) | 0% / 0.8% | 17-26% (featured22 median 22%) | **none** |
| big set pieces per screen | 0 | 11 | **none** |
| deco kinds | 85% flat squares + triangles, disks | gradients 6-9%, particles, dots + pulsing rings, 3D outlines, clouds / grass / animated water, pixel art | **one kind** |
| particles | 0 | 56-153 emitters / min | **none** |
| alpha / toggle (fade in, show, hide) | 7 / min | 186-574 / min | **almost none** |
| camera (zoom, offset, rotate, shake) | 0 | 44-107 / min | **none** |
| shaders (blur, hue, lens, glitch) | 0 | 14-44 / min | **none** |
| scene changes | one scene for the stretch | a new scene / palette / frame at each portal | **none** |

So colour and amount are near the rated levels; what is missing is everything that is not a flat shape: soft glow and
gradients, things in front of the player, set pieces, particles, fades, the camera and shaders. Next: real glow sprites
(1293, gradients), a front layer (thin see-through silhouettes), one big set piece per screen, ember / snow particles,
fade-ins at section starts, a camera zoom or shake on the drop.

## Round 5 (2026-11-26): not only flat shapes, `tools/decofx.js`

Evgeni: "yes, i want to iterate on looks" after the table above. One pass over a dressed stretch adds what the rated levels
have and we lacked (each switchable with `--fx`):
- **glow**: GD's soft glow strip 1293 (15 x 30, solid at the bottom, fading up; flipY the other way) replaces blockart's stacked
  see-through squares: one gradient inside each open block top (blockart's glowTop channel, opacity 0.75) and a halo rising
  above it (B1, blending, 0.35). Lay them edge to edge at exact widths (sx 2 = 30 units): an overlap of even 1 unit shows as
  a bright seam on a blending channel. lib/look.js now draws 1293 as a gradient, so it shows on the phone and in cloud shots.
- **front**: dark hanging silhouettes (stalactites / icicles: two flipped 693 halves) on T3 with a blended lit edge, hung from
  y 300 and kept 75 units over the play beneath them (tests/decofx.js checks 55+); a low see-through haze over the ground.
  Too high (from y 420 down to 200) and they never showed: the cube screen tops out near y 250.
- **set**: one set piece a screen on B2 (fire: a gate with a glowing core and rays; ice: a crystal cluster). Behind the lane a
  set piece must stay near the sky's value (ice: opacity 0.85, a mid blue); the first dark version fought with the cube and
  spikes, the first light one blew out.
- **motes**: embers rising / snow falling, big and few on T2, small and many on B2, each depth its own move.
- **fade**: front layer and set pieces fade in (1007); **camera**: zoom 0.85 at the first mode portal and back, a flash on the
  glow; **scene**: the glow, outline and halo turn hotter / colder at that portal.
Not yet: real particle objects (2065: their settings string is not known to us and the viewer can't draw them), camera
shake (the viewer does not model it), a new background per section.

Results: fire +441 objects (26 -> 30 per block), ice +403. Pictures: project files decoart/round5_fx.jpg and
round5_before_after.jpg. Viewer: deco-art / gdlm_44_hellgate_mix_layered_fx and gdlm_72_frostbite_mix_ice_fx.
```
node tools/decofx.js local/decoart/gdlm_44_hellgate_mix_layered.gdlvl --theme fire [--fx glow,front,set,motes,fade,camera,scene]
node tests/decofx.js
```
Lesson: run `node tools/channels.js` on every deco build. A swallowed line left the set pieces' core and rim channels
undefined, which the game would draw white.

## Round 5b (2026-11-26): corners and layers, and the Woofel video

Evgeni: "the structures are not exactly coherent in the corners, the layers are not proper on the blocks", with Woofel's
"Building with Woofel 2: block design and coloring" (https://youtu.be/Xbt003ZWuQM; notes in project files
decoart/block_design_transcripts.md, not in git).
- **The cause:** our beat-first levels put blocks off the 30-unit grid (GDLM 44: x mod 30 = 8.9, 9.4, 20.2 by structure).
  blockart snapped each block to the grid, so its dressing sat up to 11 units off the block, and two structures with
  different offsets got doubled outlines. Now every piece is drawn from the block's real centre (cells are still keyed by
  grid step for the neighbour tests). decofx's glow too. **Rule: never place dressing at `c * 30`; use the block's x, y.**
- **Corners:** at each end of an open edge the line turns (convex: shortened by the inset), runs on (straight), or meets a
  wall rising from the neighbour (concave: the inline runs 6 units on into the wall, the outline 2.4 to close the notch).
- **Layers:** the black inline sits one z-order under the bright outline (Woofel: inner outlines under the outlines), over
  the glow. One base colour per structure (connected cells) with a small value jitter, instead of 3x2 patches that showed
  as rectangles across a body; the lava "b" colour is a dark red now, not purple.
- Woofel's other points, still open for us: outline colour between primary and highlight (not pure); a second, smaller
  glow on T2 over the outlines, desaturated; 3D glow as sheared tiny glow; a secondary block design for small structures
  (same families, plainer); detail scaled to block size; an inner base with inverted colours; lighting balanced with
  shadows below.
Test: `node tests/decofx.js` (off-grid L shape: bases on the real centres, inner-corner inline, z-orders).
Pictures: project files decoart/round5b_corners.jpg.

## Lessons as rules (soft; for the generator)

- **Paint the section's picture before placing deco**: one focal point (light / landmark) at a third of the screen in the
  section's middle, values from light far to dark near, the play band against a mid value.
- **Nothing in the backdrop reads as gameplay**: no small dark triangles near the floor, no black outlines, landmarks a
  value lighter than the play's black.
- **Hard edges are vector, soft light is fitted**: a disk, a ridge, a tower drawn as exact shapes; glow, haze and
  clouds fitted (round 2).
- **Fit the picture to the view**: cube parts show ~8 blocks above the ground; flying parts need their own picture height.

## How to run

```
node tools/paintscene.js hellgate --out local/decoart/hellgate.png     # the painting and its vector version (PNG)
node tools/decoart.js levels/gdlm_44_hellgate.gdlvl --from 0 --to 88 [--shapes 500] [--image pic.png]
node tools/shoot.js local/decoart/gdlm_44_hellgate_fit.gdlvl --shapes --at 1,4,7.5   # art-free frames (cloud too)
node tools/wip.js put local/decoart/gdlm_44_hellgate_fit.gdlvl --session deco-art
node tests/paintfit.js
```
The art-free view (lib/look.js) now draws 211 / 693 / 497 / 1764 as their real shapes with scale, HSV, channel opacity and
blending, so paintings (and the kits' triangles) show on the phone page and in cloud renders too.

## Time (measured on this round, cloud container)

- fit, 500 shapes on a 441 x 120 picture (88 blocks): 12 s; a whole 740-block level, one picture per section: ~2-3 min
  (12 sections x 12 s, not measured end to end).
- vector: under a second. Art-free frames (shoot.js --shapes, 3 frames): 4 s. wip put of the 88-block copy: 1 s solve.

## Open / next

- Evgeni's pick between A / B / C (and the parts he marks).
- More scenes than "hellgate": a scene per theme (ice, space, ...) and per section role (intro, drop, breather), from
  SCENES.md's section planner; light and palette follow the song (the drop brightens the light source).
- A picture per FLYING section (taller view) and the camera's real y per section.
- Soft glows: blending channels / gradient pieces instead of stacked disks; check 497's edge in GD art.
- Fit weights: more detail at the focal point, less behind the play band (a readability weight).
- C with real pictures: Evgeni's own drawings or generated images as targets.
- Into the pipeline: theme.js / compose call decoart per section (spec "picture": {scene, approach}).

## Round 6 (2026-11-26): a small icy part, almost no gameplay -- where it stands against rated levels

Evgeni: "lets make a small part with icy deco, really like almost no gameplay. but decent amount of spikes bricks and deco,
in some coherent not too random way. and see where we compare". `tools/icypart.js` builds it as one structure repeated in
five bays of 32 columns (a one-block ice walkway, a pit with spikes ending each bay, a hanging ice mass with a row of
icicle spikes that arches up over each jump; bay 3 a double spike, bay 4 a wider pit with a lip spike), then the ice kit
(variant caves), `decoart.js --scene frozen --variants mix --blocks layered-ice` and `decofx.js --theme ice`. 17 s of play
and 5-7 taps, then the outro and the signature. Three versions (specs/74_icy_part*.json, wip deco-art/gdlm_74_icy_part*_fx):
v1 icicles high (row 6), v2 a low tunnel (row 3) everywhere, v3 the two alternating bay by bay.

| measure | v1 high | v2 low | v3 mixed | rated (featured 2.2 median / range) |
|---|---|---|---|---|
| hazards: threat / guard / fill % | 9 / 6 / 86 | 11 / 89 / 0 | 9 / 35 / 56 | 14-23 / 39-50 / 31-43 |
| guard above / below the lane % | 3 / 3 | 86 / 3 | 32 / 3 | 10-23 / 22-30 |
| hazards near the player per s | 1.2 | | 3.4 | 6-11 |
| hazards per obstacle | 1.2 | 1.3 | 1.2 | 2.2-3.3 |
| deco rhythm cv (even = low) | 0.25 | 0.27 | 0.30 | 0.94 |
| quiet / peak segments | 0.05 / 0 | 0.05 / 0 | 0.05 / 0 | 0.12 / 0.16 |
| focal (densest 4 blocks of a screen) | 0.23 | 0.23 | 0.23 | 0.35 |
| big pieces (9+ blocks^2) per screen | 0 | 0 | 0 | 11 |
| front (T2+) share | 1.8% | 1.4% | 1.6% | 22% |
| objects per block | 37 | | 41 | 32-46 |

What it says: amount and colour are at the rated levels now, and spikes in one repeated structure read as designed. Still
off: (1) the hazards: rated levels keep spikes close to the lane on both sides (guard below 22-30%: spikes beside and
under the path, a hazard floor) and 2-3 per obstacle; ours sit far (v1), or all overhead (v2); v3 is near on guard but
has no hazard floor and too few near the player. (2) the deco is spread evenly: no quiet stretches, no big moments, no
focal spot per screen (cv 0.3 vs 0.94). (3) almost nothing in front of the player, and no big set pieces by decocomp's
measure (our diamonds are 4 blocks^2 after scale). Next: a hazard floor (spike rows in the pits under the walkway, low
spikes beside its edges), one big set piece per screen with a quiet stretch after it, and a T2/T3 front frame.

Gotcha: `shoot.js` on a level with no saved route draws a ghost camera, far off the play (the first v1 frames showed the
lane at the top of the picture); `wip.js put` first (it solves and saves the route), then shoot.

ID ranges kept apart (2026-11-26): decoart 700-799 channels; blockart 900-911; block designs gallery 912-932; spike designs (tools/spikedesign.js) 933-946; decofx channels 950-957; the signature 973-989, groups 1201-1215
(set pieces 1210 + n); theme kits 80-117 channels, 450-529 groups; tools/effects.js (EFFECTS.md) channels 800-849, groups
2001-3999. A new deco tool takes a free range and adds it here.

## Block designs: single blocks with something inside (2026-11-26)

Evgeni: "and similar stuff for singular blocks" (next to the hazards thread's spike designs), and "one of the designs could
be just an interesting drawing". `tools/blockdesigns.js` is a library of 22 designs for ONE block (`node tools/blockdesigns.js
list`): outline, layered, inner base (swapped colours), inner diamond, nested frames, corner brackets, bevel, glow core,
facets, vein, dots, split, 3D, double glow, window, cross, and six drawings (snowflake and moon from shapes; flame, eye,
skull, key as small pixel maps, `pixels()`: one row a string, runs merged). Each is `draw(cx, cy, C)` with C a role ->
channel map (base, deep, inner, line, inline, glow, hi, shadow, detail, core), so any palette fits (PAL.ice, PAL.fire);
the play block stays and keeps its hitbox. Gallery: `node tools/blockdesigns.js spec` -> specs/lab_block_designs.json,
`make.js` it (scene tools/scenes/blockgallery.js): every design in fire (row 5) and ice (row 2), numbered, no click, outro
and signature. Pictures: project files decoart/block_designs_v1.jpg. Open: Evgeni's marks pick the keepers, then blockart
uses them on structures (a design per structure, a plainer one for small structures, Woofel), and the spike designs share
the roles and palettes.
Gotcha: the signature takes channels 973-989; the gallery's first fire palette at 970-979 was overwritten by it.

## Design catalogue: Evgeni votes on blocks, spikes and saws (2026-11-26)

Evgeni: "lets make a catalogue of designs blocks spikes ill comment/vote", in the structure catalogue, but light ("its a bit
heavy now"). So it is a **Designs** tab in the lego catalogue (private claude.ai page, link in memory): 22 block designs (fire
beside ice), 10 spike designs + plain, 4 saw designs, one small card each with 👍 / 👎 / 💬 on the card. The tab's code and
pictures (`designs.js`, `designs.json`, `cards/`) load only when it is opened.
- Build: `node tools/designs.js cards` (shoot.js frames of levels/gdlm_block_designs.gdlvl with each third design centred ->
  `tools/design_cards.py` crops; spikes and saws cut from the hazards thread's gallery sheet) then `node tools/designs.js page
  --out <page folder>`; `tools/lego.js page` adds the tab by itself (not on the public page: GD art in the cards).
- Votes: the page's database, collection `designvotes`. Fetch them with one ArtifactData `list` into
  `local/designs/votes_phone.json`, then `node tools/designs.js votes` -> `knowledge/design_votes.json`. Generators pick a
  design with `require("./designs.js").weight(kind, name)` (3 liked, 1 unvoted, 0.25 disliked: a weight, never a ban).
- Open: blockdesigns / spikedesign do not call weight() yet (nothing voted); wire it in once votes exist.

## Structure designs: one design on every join, 3D effects, extending (2026-11-26)

Evgeni, after voting (10 liked, vein down; "those that i voted down are meh rest are good"): "extending to bigger
structures. i think in GD they make some 1 mega structure that contains all possible connectors corners and 3 in a row
[...] to have that second layering proper on any connection of any structure", "and ability to extend structures", "3d
effects for the blocks".
- `tools/structdesign.js`: a design is a stack of layers, each the STRUCTURE's shape inset by d (a cell cut 3 x 3 at d and
  30 - d; a side piece in when that neighbour is a block, a corner piece when both sides and the diagonal are; pieces
  merged, each grown 0.3 units so merged pieces do not show a seam). So outline, inline and inner base run round the whole
  shape, turn at outer corners, notch at inner corners, and nothing is drawn where blocks meet (a row of three is one piece).
  Designs (the liked singles): outline, layered, inner base, nested frames, corner brackets (L pieces at outer corners, small
  ones in inner corners), inner diamond and drawn (motifs in the inside blocks, else every third block of a thin shape).
- 3D effects on any design: depth (the body darkened, pushed up-right on B1 with a dim rim and 693 triangles at the two
  outer corners), bevel (lit top / left, dark bottom / right inside the outline), long depth (twice as far, darker),
  depth + bevel. The palette's shadow role is invisible on a dark sky: the side face is the body with HSV value 0.5.
- The connector sheet `SHEET` (single, row of 3, column, L, T, plus, 2x2, 3x3, ring with a hole, U, stairs, bridge): the
  test card for a design; `node tools/structdesign.js sheet` prints it.
- `extend(rows, w, h, {cols, rows})`: 9-slice: first and last line stay, the repeated inside lines grow (a ring's sides, a
  frame's gap), or the lines named (a T grows its arms with cols [0, 2]).
- Gallery: `levels/gdlm_structure_designs.gdlvl` (spec `node tools/structdesign.js spec`, scene tools/scenes/structgallery.js),
  wip deco-art/gdlm_structure_designs; picture /mnt/project-files/decoart/structure_designs_v2.jpg. Test: `node tests/structdesign.js`.
- Open: wire `dress()` into make.js / the theme kits as a spec key (blocks of a level dressed per structure), the votes of
  this round, a design that varies along long runs (every Nth block), slopes.

## One look per section, and slopes (2026-11-26)

**Rule (Evgeni):** "we usually dont want to mix multiple spike or blocks near each other ( maybe one day ). but for different
sections and different vibes we surely would want to change. but probably not too much according to the director of the level".
So a level's design plan picks ONE block design (+ its 3D effect) and ONE spike design per section; it changes only where a
section's vibe changes, and the plan keeps the number of looks small (2-3 a level; going back to an earlier look is free).
Jump indicators are not part of it: one indicator style for the whole level, never in a block's or spike's colours
("stylish indicator, maybe regardless of the designs ( dont want to confuse blocks and indicators imo )").
To do when dress() is wired into make.js: the spec key carries the plan per section, and a check warns on two designs
inside one section or more looks than the plan allows.

**Slopes** (Evgeni: "you have also triangle shape ( half of the block , 2 ways )?"): tools/structdesign.js treats a 1338
half block as a cell of kind br / bl / tr / tl (the corner of its right angle: as placed, flipX, flipY, both; a turn of 90
moves it clockwise). It joins its neighbours only along its two legs. Every layer insets its slant by d (a smaller 693 under
the same flips), so outline, inline and base turn up the slope; where a slant runs on past a block's corner (a ramp of two
slopes), a small triangle fills that corner so no step shows. The glow and bevel follow the slant (lit facing up, shadow
facing down); depth shifts the triangles too. Connector sheet: slopes alone, peak, ramp up, ramp down, hill, a hanging
arch. Gallery: deco-art/gdlm_structure_designs v4. Viewer fix: the art-free look drew slopes over front-layer deco; it now
draws them with the blocks (T1+ deco covers them, as in the game).

## Indicator styles (2026-11-26)

Evgeni: "and stylish indicator, maybe regardless of the designs ( dont want to confuse blocks and indicators imo )".
`tools/indstyles.js`: 8 styles, each a few flat pieces round the mark's spot, all in the indicator group (faded soft by its
alpha trigger) on the indicator's own channel (white 1011), never in a block's or spike's colours, never shaped like a hazard.
chevron (the old one, the default), double chevron, caret (thin line v), drop (dot + fading line), halo (small dot in a faint
glow: kept small, a big round mark reads as an orb), spark (four-point star), pointer (small down triangle on a dim disk),
bracket (line v with a dot). Spec: `"indicators": {"style": "caret"}` (make.js expands every mark, --look too); a list
`[[column, style], ...]` changes it by x, "none" = no marks there. Gallery: deco-art/gdlm_indicator_styles
(`node tools/indstyles.js spec`, specs/lab_indicators.json); picture /mnt/project-files/decoart/indicator_styles.jpg.
Test: `node tests/indstyles.js`. Rule: one style for the whole level (checklist "One block design and one spike design").
No house default (Evgeni: "each level is unique, can balance colors design whatever needed"): each level's plan picks its
indicator style and colour with the rest of its look; the chevron is only what a spec without a style gets.

Found on the way (natural plan, lib/natural.js, not fixed here): with spikes 7 blocks apart on a flat run the solver holds
one press through 3 jumps (ticks 160-579) and naturalPlan keeps the hold, so empty jumps get indicators (marks at blocks 8 and
17 for spikes at 14 and 21). The hold-to-taps step finds no split that finishes. Repro: the 7-block version of
specs/lab_indicators.json (`per = 4, gap = 7` in tools/indstyles.js spec); the gallery uses 9 blocks.

Catalogue (2026-11-26, Evgeni: "i cant see in the catalogue those bigger structures"): the Designs tab now has
Structures (one wide card per design / 3D effect: the whole connector sheet with slopes, stitched from gallery frames,
scrolls sideways) and Indicators (one card per style), voted like the rest. `node tools/designs.js cards --more`
(tools/design_strips.py), then `designs.js page` and republish the catalogue with the new files.

Indicator colour (Evgeni: "indicators can also have color ingame, probably something different from the hazard spike design
of that level"): `"indicators": {"colour": "auto"}` puts the marks on their own channel 970 in a soft colour whose hue is
opposite the hazards' (their channels plus the spike-design dressing within a block of them, weighted by saturation);
white or grey hazards give a soft cyan; `[r, g, b]` sets it. On our levels: Hellgate (hazards hue 21) -> soft blue, Icy part
(hazards hue 196) -> soft orange. Open: keep it away from the block design's hue too.

## Connected structures: holders for islands (2026-11-26)

Evgeni: "connect structures slightly better visually, making a level look like an extended one and not a set of island
structures"; "structures should in general connect, unless something else happens on the level ( bigger space, transition )";
"if we have "island" structures, it is common to add something soft like chain/rope/holder/soft extender to one of his
upper/bottom layer. as if something is holding it ( from either top or bottom ) [...] usually to place those on the
edges/middle of the structures ( like 2 ropes holding a brick, or from the other side a brick floating on top of two ropes )".
2026-11-27 (GDLM 75, an auto): when the route passes an island's end, its holder slides inward to the nearest clear cell (a
wide one with no clear pair gets one in the middle); before, the island got none (21 -> 31 holders). And the "depth" effect
fails the roles gate on plain blocks (its dark extrusion merges with the black body): bevel instead (AUTO.md "GDLM 75").

Measured first (`tools/islands.js`, gameplay solids per 25-block window): RobTop's pieces have MORE islands than ours
(cube/jump pieces 5.3 a screen, 15% of solid cells floating; flip 5.0 / 32%; fly 3.9 / 0%) vs Hellgate v10 3 / 15%, Sunny
streets 2 / 0%, Icy part 3 / 67%. So the gameplay stays islands; the joining is VISUAL, in deco behind the play.

`tools/connect.js`: a floating island gets two holders near its ends (one in the middle of a 1-wide one), hanging up to the
top of the view or a structure above (a high island, row 4+) or standing on them down to the ground or a structure below;
two islands at one height 1-4 blocks apart get a rope across. Never where the route passes (`--route`, the player's box and a
block round it), never across a portal or a gap over 4 blocks. Styles: rope, chain (diamond links), rod (with end plates),
gdchain (GD's hanging chain 41: shows with GD's art only). Thin, on B1, in the design's line colour a bit darker.
Gallery: deco-art/gdlm_holders (`node tools/connect.js spec`, specs/lab_holders.json); picture decoart/holders.jpg.
Test: `node tests/connect.js`. Also `tools/seedsolve.js --out route.json` writes the route it finds (to get a level's route
without a whole make).
Hellgate with holders: wip deco-art/gdlm_44_hellgate_held (v1: 12 stand, 8 hang, 3 bridges; before: _islands).
Open: holders in make.js / the theme kits as a spec key, a check that counts islands without holders.

## The inside of big structures (2026-11-26)

Evgeni, on Hellgate with holders: "the big ones feel very empty inside". The design layers sit within ~15 units of the edge,
so a body 3+ blocks thick was one flat colour. `interior()` in tools/structdesign.js, on by default in `dress()` for every
design (`interior: false` = off), dresses the whole body of a structure that has a core (3+ cells whose 8 neighbours are
blocks): panel seams in a brick pattern (plates 3 x 2, every other row shifted), dark with a faint lit lip, stopped 9 units
short of an open side; rivets where seams meet; a lamp (a lit slot with light fading up and down) in one of ~5 plates deep
inside (2+ blocks from every side). The plates are fixed to the level grid, so structures side by side line up.
First try, dropped: the panels only in a recessed core (the body inset by 4): in jagged shapes (slopes, steps) the core
came out as random dark holes. Texture the whole body instead.
Hellgate: wip deco-art/gdlm_44_hellgate_held v2; picture decoart/hellgate_inside.jpg (left v1, right v2).
Then (Evgeni: "more decent, can we have small gradients in colors? or maybe some layers along the structure"): `shade()`,
in the same pass: one more thin dim line along the whole outline at inset 12 (a layer), and inside it a top-lit gradient --
a cell k cells below its column's surface runs from 1 - 0.13k to 1 - 0.13(k+1) of the body colour (a solid fill and a
1293 gradient over it), so rows join into one ramp, down to 0.45. A first try darkened by erosion levels (k blocks from
every side): in jagged shapes that came out as blotches. Also fixed: 1293 is 15 units wide, so the designs' top glow
covered only half of each top edge (sx was len / 30). Hellgate v5; picture decoart/hellgate_shade.jpg.
Open: steps show where the ramp meets a slope (columns under a slope start lower); other interior textures per theme (ice: cracks / facets, fire: veins), lamps rare on Hellgate (few cells are 2+ deep).

## The structure deco pass: all of it in the deco stage (2026-11-26)

Evgeni: "i want to use the deco knowledge we now gaining later during the deco stage". `tools/structdeco.js` is the one
place that applies this thread's findings; make.js runs it after the solve (deco only, the route is kept; `--look` too),
compose and planbuild turn it on by default (`"structures": false` in a brief / plan = off). Spec key `"structures"`:
`true` (layered, fire palette or ice for an ice theme, chain holders, inside on), or `{design, pal, effects, holders,
interior}`, or `{sections: [{from, design, pal, effects}], holders}` -- one look per section, a structure takes the look of
the section its left end is in (never two looks on one structure), more than 3 looks warns. Palettes take channels 912,
922, 933. Indicators stay in make.js's indicator step (`"indicators": {"style", "colour": "auto"}`).
What it applies: Structure designs (slopes, notches), 3D effects, the inside of big structures (seams, rivets, lamps, a
layer line, a top-lit gradient), holders and bridges off the route and not across portals.
Test: `node tests/structdeco.js`. CLI: `node tools/structdeco.js <level> --route <route.json> [--spec '<json>']`.
Open: a palette from a theme kit's variant (today only ice / fire, or rgb by role), indicator colour away from the block
hue too, a director that picks the per-section looks from the song's sections by itself.

## Design themes (2026-11-26)

Evgeni: "lets set up themes, where we will see the combination of blocks, and then a sample segment with some structures
spikes and saw. (and holders and indicators)"; "in the theme we might already include [...] background or a set of
backgrounds. and background deco ( stars/clouds/geometrical stricutures) maybe also few options"; "we dont always have to
pick from the set of themes we have, we should be able to change or extend on the fly as needed when making a level".
`tools/designthemes.js`: a theme = palette (blocks, spikes and saws share its roles) + structure design + 3D + spike design +
saw design + holder style + indicator style + a set of skies + named backdrop options (`tools/backdrops.js`: stars, clouds,
skyline, mountains, geometry, rings, rays, motes, horizon, rocks). Five presets: hellgate (fire), frost (ice), toxic, void,
temple (gold); palettes toxic / void / gold added to tools/blockdesigns.js PAL.
Presets, not a menu: in a spec `"structures": {"theme": "frost"}`, per section `{"from": 120, "theme": "void", "backdrop":
"b", "sky": 1}`, a theme with fields changed (`{"theme": "frost", "spikes": "glow", "pal": {"extends": "ice", "line": [..]}}`)
or a whole new one inline (every field given, no theme). The structure deco pass (tools/structdeco.js) applies all of it:
sky colour triggers at each section start (bg, ground and the middleground 1013 / 1014: left undefined the game draws lilac
hills), the backdrop, the designs, the hazards' dressing, the holders; make.js takes each section's indicator style and an
"auto" colour opposite that section's hazards (indstyles applyColour per section: channels 970, then 960-969). The pass now
runs BEFORE the indicators, so their colour sees the dressed hazards. Channels: blocks 912 / 922 / 933, hazards 943 / 950 /
957, backdrops 880 + 4 per palette (a spec's ch0 / hazCh0 / bgCh0 lists change them).
Gallery: deco-art/gdlm_design_themes (`node tools/designthemes.js spec`, specs/lab_design_themes.json, levels/
gdlm_design_themes.gdlvl): ONE scene per theme (Evgeni 2026-11-27: "i dont want 2 pictures, just 1 full scene with pieces";
"the part should have variaty ( some big structures, hanging , stuff, some slopes, connecting structures")): `SCENE` in
designthemes.js, a text map. Since Evgeni 2026-11-27 ("i want the gameplay in these themes to be mostly above ground. with
the scene having much more structures, and more connected ones. less open space. the spikes are normal. i dont see the pieces
making the theme") the cube runs UP ON masses that reach the ground (heights 1-4, slope ramps, a step up), with pits of
spikes between them, two held islands over a spike floor, ceiling masses with hanging spikes and a small saw on a corner,
spikes and a sunk saw on the tops. Ceiling rule: a ceiling's bottom stays above the jump peak there (path top + 2 rows +
the cube). Sky 0, backdrop a.
"The spikes are normal" was the picture, not the level: the art-free render drew deco behind or under the spikes and did not
know 1889 / 503 / 1011, so the inner spike designs never showed in a cloud picture. lib/look.js now draws them (FLAT) and
the viewer draws front deco above a hazard's order (T1 order > 2) after the hazards.
Bug found on the way: a scene script (tools/scenes/*) that returned `objects.concat(out)` doubled every play object (the five
gallery scenes of this thread did); scenes return only their new objects, and make.js now drops the level's own objects if
a scene returns them (with a `!!` note). Galleries built before 2026-11-27 (holders, structure designs, block designs,
indicator styles) still carry the doubled objects until rebuilt.
Catalogue: the lego catalogue's Themes tab, one strip per theme (`node tools/designs.js cards --themes`: the scene shot a
screen at a time and joined).
Contrast (Evgeni 2026-11-27: "the background and the blocks look too alike, they should have some contrast to the blocks
and hazards"): the old skies were dark versions of the blocks' own hue and the backdrops were mixed toward the block colour.
Now: each theme's skies are in another hue (40-176 degrees from the blocks), the backdrop pieces stay in the SKY's hue a few
steps lighter (`backdrops.colours`), and the pass lifts every sky (same hue, brighter) until the block body stands out at a
luminance ratio of 1.6 (`backdrops.fit`). `backdrops.check(pal, sky)`: block/sky and block/backdrop ratio >= 1.5 (or >= 1.25
with hue >= 60 apart), hazard line vs sky >= 2; the pass prints a `!! contrast` note when a section fails, tests/structdeco.js
checks every preset. Our blocks' bodies are dark, so the sky goes mid-tone (blocks read as dark masses with lit rims).
Test: `node tests/structdeco.js`. The art-free render shows the spike / saw dressing only faintly (1889, 503 ...): judge
those in GD art on the PC or in the game.
Open: a theme from a theme kit (tools/themes/*) or from the song's mood; backdrops b and c are not in the gallery (only a); the scene's seams between shots move a little when the camera rises.
