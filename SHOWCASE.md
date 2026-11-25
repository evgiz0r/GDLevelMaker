# SHOWCASE -- a decorated "scene" level built by hand, and the recipes that came out of it

Owner: the showcase session (2026-11-23). The user: "can we make some decorated level? with nicer graphics
and some animations? more of a scene". Look first; gameplay only has to be fair and simple.

The level: **GDLM 50 eclipse** (`specs/50_eclipse.json` + `tools/scenes/eclipse.js`), 37 s, Easy, cube /
ship / cube / wave / cube on Uxvellda's "Eclipse" (Newgrounds 1086693, 143 BPM, high-confidence beat grid;
the level starts at song second 40.45 = bar 24, so the song's drop at bar 32 lands on the level's bar 8).

**Names are final from the first upload** (the user: "We use the same name once uploaded, no rename";
the GD server refuses a renamed shared level -- PUBLISH.md). So a scene level gets its proper name in the
spec before it is ever pushed or uploaded, and the in-level title text matches it. This one is final:
`GDLM 50 eclipse` (title text "ECLIPSE" / "GDLM 50"). A new version of an uploaded level keeps the name.

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
- `tools/shoot.js` stalled after ~4 frames per call during this work: a browser child that never exited,
  fixed by the visuals session in d983d6a (8 frames now take ~8 s). Text 914 is now family "text" in the catalogue.

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

## v2-v4 (2026-11-25): from taste 64 to 80, every gate READY

The user: "lets do few iterations till get to like 80? gameplay and some deco improvements. some spaces are bit dead".
Measured with `node tools/taste.js score` (model of 2026-11-24: Eclipse was 64 on it, not the 69 of the older model)
and `node tools/score.js`. Each round's change and what moved:

| version | change | taste | gates |
|---|---|---|---|
| v1 (pushed before) | -- | 64 | 2 FAIL (prejumps at 29-33, roles 19/30 sections) |
| v2 | dawn climbs (stairs, ledge, step: the ending was 50 flat columns); `tools/scenes/eclipse_fill.js` per section: GD shapes of the section's theme (clouds, planets, ring segments, rays, gradients, grass, bushes, flowers, antennas), 4 own colour channels, one soft pulse a beat, two drifting groups, spins | 76 | flashes rule tripped (pulse fade-in 0.05 counts as a flash) |
| v3 | pulses swell (fade-in 0.15), denser totality, brick texture in the block bodies (decokit.blockPattern), a second shade per section (6 channels), a third drift group on the off-beats | 80 | roles still failing (22/34) |
| v3b | colour by role: path rims and ground lines in S1 / S4 cool blue / cyan against the warm glow and gold light; near skylines and S2's clouds lifted off the block bodies | 80 | roles 0/34 |
| v4 | the old prejump at 29-33 (spike under the drop off the h2 ledge: removed), a hop at 290 in the 2.7 s with no input, sub-scores below | 80 | READY, 0 FAIL, 13 WARN |

v4 sub-scores (band EN|2.2 percentile, contribution): move triggers/min 394 (p80, +0.18), hazards/10 blocks 1.5 (p15, +0.11),
motion triggers per screen 27 (p65, +0.07; was 2), colour channels per screen 12 (p65; was 6), distinct ids 118 (p45; was 33),
deco share 0.85 (p35), objects/block 17.3 (was 11.3), flashes/min 74 (was 81; the old rule miss is gone). Flow (tools/flow.js):
10.1 floor changes per 10 s (was 7.3), no flat 10 s window (was 14%), 72% on the bare floor (was 85%). Fairness: no unfair
spots; difficulty Normal (~4 attempts).

Lessons (in knowledge/checklist.md):
- The static deco measures count by x: motion and channels must be spread through the level, not set once at the start
  (Eclipse's 106 move triggers a minute were mostly locked-to-camera ones at x 3: 2 per screen in the median).
- The taste model pulls against height (heightRange -0.08, heightChanges10 -0.05: "against (static proxy)" in TASTE_DATA.md).
  Height was raised anyway (the user's rule and flow.js are the judges there); do not flatten a level to please the model.
- A warm glow behind warm rims hides the path (roles.js pathDeco): give the rims a cool hue when the light is warm.

Still open: the height gate (want 12+ changes per 10 s, 45% or less on the floor), the totality stretch (blocks 144-208) is the
sparsest by design (black sky) and stays under half the level's deco per block, block/bg contrast STARK (16 > 6.5), not seen in
the game yet.

## Open

- A soft cloud-frame recipe (round clouds in tones, no outlines) like Fall Out's.
- Particles (2065), shaders (radial blur / chromatic at the drop): not drawn by our render, so not used.
- The composer (gd-style, `tools/compose.js`) could take a "scene" per section from these recipes.
