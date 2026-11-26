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

## Lessons as rules (soft; for the generator)

- **Paint the section's picture before placing deco**: one focal point (light / landmark) at a third of the screen in the
  section's middle, values from light far to dark near, the play band against a mid value.
- **Nothing in the backdrop reads as gameplay**: no small dark triangles near the floor, no black outlines, landmarks a
  value lighter than the play's black.
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
