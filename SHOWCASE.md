# SHOWCASE -- a decorated "scene" level built by hand, and the recipes that came out of it

Owner: the showcase session (2026-11-23). The user: "can we make some decorated level? with nicer graphics
and some animations? more of a scene". Look first; gameplay only has to be fair and simple.

The level: **GDLM 50 eclipse** (`specs/50_eclipse.json` + `tools/scenes/eclipse.js`), 37 s, Easy, cube /
ship / cube / wave / cube on Uxvellda's "Eclipse" (Newgrounds 1086693, 143 BPM, high-confidence beat grid;
the level starts at song second 40.45 = bar 24, so the song's drop at bar 32 lands on the level's bar 8).

## The idea: one motif, five scenes

A sun and a moon stay fixed on the screen all level (one group locked to the player's x). The moon slides
over the sun through the first two sections and covers it exactly on the drop, then slides off. Every
section is its own scene with its own palette, and mode changes and scene changes are the same moment:

| bars | mode | scene | what moves |
|---|---|---|---|
| 0-4 | cube | dusk city: two skyline layers, lit windows, orange horizon glow, title "ECLIPSE" | skylines scroll slower than the level (parallax), windows twinkle on the beat, the moon closes in |
| 4-8 | ship | the sky darkens over 3 s, the city sinks away and fades, stars come out, clouds drift past | city moves down, stars fade in, corona fades in, edges pulse on bars |
| 8-12 | cube | **totality on the drop**: black sky, white corona, 12 rays and two ring segments turning, white flash, camera pulls back (zoom 0.82) | every beat pulses the block edges, every bar the corona and rings; sparks rise fast |
| 12-16 | wave | the "diamond ring": navy and gold, a sliver of sun on the right, light rays from above in front of the play | rays pulse every 2 beats, gold dust rises |
| 16-22 | cube | dawn: pink sky, the city rises again, the moon fades, credits (title, song, "made with GDLevelMaker") | city moves up, palette fades over 4 s |

Render: `node tools/shoot.js levels/gdlm_50_eclipse.gdlvl --at 0.6,9,15,22.5,29,35.5` (shoot a few frames
per call; see "Tools" below). The comparison frames of Fall Out are in `local/shots/fallout_ref/`.

## Recipes (tools/scenekit.js) -- reusable, with what they cost

All return plain objects; a level's scene script calls them (spec `"scene": "tools/scenes/<name>.js"`,
run by make.js after the gameplay is placed: `fn({objects, header, beatX, ...}) -> {objects, header}`).

| recipe | what | objects | worked? |
|---|---|---|---|
| `channels(header, defs)` | the level's own colour channels in the header, with blending | - | yes: 15 channels, 9 blending |
| `palette(x, map, secs)` | one colour trigger per channel: a new palette per section | ~15 per section | yes: the strongest single effect; the drop is an instant switch, dawn a 4 s fade |
| `skyline(x0, x1, o)` | buildings (flat fill 211, scaled per axis 128/129), stepped crowns, antennas with a light, window grid (dots 1764, blending), twinkle groups | ~6 per building | yes, once the buildings were short (far 3-6 blocks, near 1-4): 9-high towers filled the sky |
| `lockX(x, group, secs, mul)` | a move trigger locked to the player's x: mul 1 = fixed on screen, 0.85 / 0.6 = parallax layers | 1 | yes in our render (the sun, stars, frame, skylines); not checked in the game |
| `eclipse(o)` | sun disk (497), two corona rings (236), radial rays (1021), ring segments (997/998), moon disk (497) | ~17 | yes: totality is the best frame of the level. 16 rays were a mess, 12 thinner ones read |
| `horizonGlow` | wide vertical gradients (1293) along the bottom of the sky, blending | 1 per 4 blocks | yes: the warm light between buildings |
| `starfield` | dots (1764) with a few bigger ones, on B5 behind the moon | 3-6 per 100 units | yes; crosses (1765) looked like hazards next to the play, removed |
| `designBlocks(objects, x0, x1, o)` | every gameplay block gets a flat fill in front of its skin (T1), a thin lit line (1753) on each open side, a soft glow under open tops, windows inside stacks; slopes get a triangle fill (693, same flips) and a lit diagonal | ~2-3 per block | yes: neon rooftops. Slopes must count as filled cells, or every stair step inside a wave wall gets an edge |
| `motes` | small dots in front (T2), a group carried up by one move trigger per section | 2.5-4 per 100 units | yes: cheap motion everywhere |
| `lightRays` | long tilted gradients in front (T3), see-through (alpha 0.35) | 1 per 4 blocks | yes in the wave |
| `topFrame(x, o)` | a dark gradient band along the top of the screen, locked to the player | ~15 | added last; checked in our render only |
| `cloudFrame` | rows of art clouds top/bottom | many | not used in the end: art clouds have black outlines and looked heavy over a ship tunnel |
| `beatPulses`, `pulse` | pulse triggers on bar starts / beats (channel or group) | 1 per beat | yes: edges on bars, everything at the drop |
| `text` | a text object (914) | 1 | title and credits |

## What made it look good (in our render)

1. **A palette per section, switched at the portal.** Same objects, new colours: the city at dusk and at
   dawn are the same recipe in two palettes. The drop's instant switch to black + white flash is the moment.
2. **One big set piece that lives on the screen.** The eclipse is ~17 objects and carries the whole level.
3. **Gameplay blocks dressed as part of the scene** (dark fill, lit edge): rooftops in the city, the
   tunnel and the wave walls without any extra art.
4. **Depth by speed**: far skyline 0.85, near 0.6, stars 0.95 / 0.8 of the player's motion.
5. **Sparse where it matters**: totality has the fewest objects of the level (~3 per block) and is the most
   striking, as Fall Out's last section.

## What did not work

- Buildings 9 blocks tall: the sky disappeared. The view shows ~7.5 blocks above the ground in a cube part.
- Art clouds (936-938) as a frame: black outlines, heavy; Fall Out's cloud frames are many overlapping
  soft round shapes in 2-3 tones, which needs its own recipe (open).
- Ray sprites 1021 at 16 rays, scaled fat: a grey starburst mess. 12 thin ones, faint before the drop.
- Crosses (1765) as stars or motes: read as hazards next to an orb.

## Numbers (final build, `node tools/modern_look.js levels/gdlm_50_eclipse.gdlvl`)

| | GDLM 50 | Fall Out | played median | GDLM 41-46 |
|---|---|---|---|---|
| objects per block | **11** (3,742 in 37 s) | 13 | 46 | 1 |
| in front (T2+) | 14% | 38% | 17% | 0% |
| behind (B5-B1) | 21% | | 42% | 37% |
| T1 (blocks and their dress) | 65% | | 8-48% | 53-100% |
| channels / blending | 25 / 11 (15 of our own) | 32 / 6 | 54 / 18 | 10 / 3 |
| objects with HSV | 25% | 52% | 40% | 0% |
| triggers per minute | pulse 188, colour 120, alpha 90, move 42, rotate 5, zoom 4 | | colour 121, alpha+toggle 186, move+rotate 162 | ~16 colour |

Per section (objects per block by where they sit; the locked layers sit at their section's start): city
8, ship 15, totality 3, wave 18, dawn 4. Triggers per section: 60 / 42 / 58 / 48 / 25. The gameplay is
~900 objects; the scene ~2,800.

Gates (`node tools/score.js`): READY, 0 fail. Tightest window 71 ms over 42 inputs, Easy (0.14). Warnings:
the solver's first jump is 2.6 blocks before the first spike (the sweep presses early; a human jumps later),
the last third is calmer than the first (the dawn and credits, on purpose), the yellow pad's hitbox is
unconfirmed. One FAIL on the way: a 42 ms tap jumping off a 2-high stair onto a double spike 4 blocks
later; 6 blocks fixed it.

## Tools made or fixed on the way

- `node tools/make.js <spec> --look`: a decoration-only rebuild in a second, keeping the last solve and
  jump marks when the gameplay is identical (the saved plan is replayed to the end to prove it). A full
  solve of this level takes ~7 minutes.
- `tools/make.js` spec key `"scene"` (a scene script) -- see the top of make.js.
- Viewer / `lib/art.js`: text objects (914) drew as the editor's "Start Pos" button in GD art; now the text.
- `tools/index_levels.js`: skips non-level json in the shared `local/` (phone_ids.json crashed it).
- `tools/shoot.js` stalled after ~4 frames in one call on this level (each frame alone takes ~3 s): shoot
  a few times per call. Reported to the visuals session.

## Unsure in the game (check in a recording)

- **Lock-to-player moves (901 keys 58 / 143)**: the sun, the stars, the top frame and the skylines depend on
  them. If the game reads 143 differently, the sun drifts off the screen.
- **A move trigger on the same group as a locked move** (the moon slides while its parent group is locked):
  our render adds both offsets.
- **Rotate about a centre group that is itself locked** (the rays turn about the sun).
- **Opacity from several groups** (stars: layer alpha x twinkle) -- not used for twinkle in the end, but
  the stars are in two groups.
- **Text 914 size**: our render uses a system font; the title may be bigger or smaller in the game.
- **Blending channels set in the header** (5_1): the sun, windows, corona, edges glow additively in our
  render.
- **Camera zoom 0.82 at the drop** and back to 1 at the wave.
- Layers B5..T4 (key 24) as in lib/art.js: unchecked in the game (modern_look.md).
- **How much of the sky the game shows**: our viewer shows ~7.5 blocks above the ground; Fall Out's frames
  show more. The sun's height (y 150) and the title (y 190) were placed for our view.

## Open

- A soft cloud-frame recipe (round clouds in tones, no outlines) like Fall Out's.
- Particles (2065), shaders (radial blur / chromatic at the drop): not drawn by our render, so not used.
- The composer (gd-style, `tools/compose.js`) could take a "scene" per section from these recipes.
