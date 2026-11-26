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
