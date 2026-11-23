# The modern (2.2) look, in numbers: what makes a rated level look like 2.2 and not 1.0

The user (2026-11-23, after GDLM 45): "i want to get more realism, this is like 1.0 graphics. we need 2.2
stuff and more". This page measures how modern rated levels are decorated and gives a recipe per
section that a composer (gd-style, `tools/decorate.js`) can use.

Made by `node tools/modern_look.js played legendary featured gdlm --sections` (2026-11-23). Deco
families, groups and default layers come from the visuals session's catalogue
(`knowledge/objects/`, VISUALS.md).

## The levels

- **played**: the five 2.2 levels the user played on 2026-11-23 (`local/recordings.md`). The IDs
  come from the user's save: the most recently played online levels.
  - Spire (128630430, rav3nnn, Hard 5)
  - Harpuia (128657650, CHO10, Hard 5, Featured)
  - Dash Tower (128619650, Dymond16, Harder 6, Epic)
  - CHAOTIC (151677971, LuixGMD, Harder 7, Featured)
  - Sunset Aurorae (152663636, Xavionn, Hard 4, Featured)
  - The recording notes' "Surface" and "Void" are the songs of Spire (Dimrain47) and Sunset
    Aurorae (orbitron408), not separate levels.
- **legendary**: the 18 rated 2.2 Legendary levels of `low_tier_stats.md` (Easy to Harder).
- **featured**: 16 rated Featured Easy/Normal levels from 2.0-2.1, the "previous generation".
- **GDLM 41-46**: ours.

Levels are downloaded to `local/community/` only (never committed). The numbers describe the static
layout: 2.2 levels move objects with triggers, and particles and shaders only show in play.

## 1. How much

| | objects per block | objects per s | per section (p25 / median / p75 per block) | deco-blocks | deco-shapes | pixel art | effects | triggers |
|---|---|---|---|---|---|---|---|---|
| played (5) | **46** | 496 | 21 / 36 / 50 | 28% | 16% | 0-73% | 1% | 5% |
| legendary (18) | 32 | 360 | 18 / 31 / 57 | 28% | 29% | 0% | 10% | 12% |
| featured 2.0-2.1 (16) | 23 | 218 | 10 / 20 / 28 | 46% | 23% | 0% | 0% | 3% |
| **GDLM 41-46** | **1** | 6 | - | 29% | 0% | 0% | 0% | 6% |

**The gap is 20-50 times.** A modern rated level has 20-50 objects per block of length, 200-600 per
second of play. GDLM has one. The game's own 1.x levels have ~2 deco per block
(`knowledge/objects/README.md`), so "1.0 graphics" is literally right.

## 2. Layers: half the objects are behind the player

Share of non-trigger objects per z-layer (key 24, or the id's default layer):

| | B5-B1 (behind) | T1 (the play layer) | T2-T4 (in front) |
|---|---|---|---|
| played | 42% (38-66%) | 8-48% | 17% (11-50%) |
| legendary | 59% | 7-46% | 26% |
| featured 2.0-2.1 | 70% | 8-81% | 0% (only B2, B1, T1) |
| GDLM | 37% | 53-100% | 0% |

- Modern levels use **all 9 layers**. Sunset Aurorae has 29% in B5 and 49% in T3/T4; Harpuia 36%
  in T3. The 2.0-2.1 levels use B2, B1 and T1 only.
- **Front layers (T2-T4) carry a quarter of the objects in 2.2**: light, glow, particles and
  frames over the play. That is new since 2.1. The key-24 values (B5 -5 ... T4 11) are from memory
  (sure:false) and the T1/B-split matches the catalogue defaults.

## 3. Which decoration

Two looks among the played levels:
- **Designed blocks** (Harpuia, Sunset Aurorae, Spire): built from flat fills `lightsquare` and
  `lighttriangle` (63% / 35% / 28% of objects are deco-blocks). On top go soft gradients
  (`d_gradient`, `_b`, `_c`) for shading and glow, outlines (`blockOutline`, `persp_outline`) and
  shapes (`d_circle`, `d_link_b`, `d_swirve`).
- **Pixel art** (Dash Tower, CHAOTIC): 65-73% of the objects are 2.2 pixel-art tiles (`pixelart`,
  `pixelart_base`) plus the 2.2 `gdh` block set, with gradients again for light.

The families every 2.2 level in the sample uses (median share of its deco):

| family | played | legendary | featured 2.0-2.1 | what it is (`knowledge/objects/README.md`) |
|---|---|---|---|---|
| lightsquare / lighttriangle | 5/5, 12% / 1% | 18/18, 12% / 4% | 14/16, 18% | flat coloured fills: the base of designed blocks |
| d_gradient, _b, _c | 5/5, 6-9% | 16/18, 0-2% | 13/16, 6-14% | soft gradients: shading and glow |
| particle (particle objects) | 5/5 | 18/18, 10% | 0 | 2.2 particle emitters |
| d_small_ball, d_scaleFadeRing | 3-4/5 | 18/18, 11% / 6% | rare | dots, stars, pulsing rings |
| emptyFrame | 4/5 | 17/18 | rare | invisible centre / target for triggers |
| persp_outline | 4/5 | 13/18 | 13/16, 13% | 3D edges |
| d_cloud, d_grass, d_animWave, waterfallAnim | 3-4/5 | 10-13/18 | some | scenery, animated water |
| pixelart | 3/5 (49% where used) | 9/18 | 7/16 (small) | 2.2 pixel-art tiles |

What changed from 2.0-2.1 to 2.2: particles, pulsing rings, small dots, empty frames (trigger
targets) and pixel art came in. Hand-built 3D outlines and plain block skins went out.

## 4. Colour

| | header channels | blending | opacity < 1 | copy another | channels used by objects | objects with HSV |
|---|---|---|---|---|---|---|
| played | 28-550 (median 54) | 8-167 (18) | 2-92 | 1-32 | 16-414 | 22-54% (40%) |
| legendary | median 179 | 41 | - | - | 45-497 | 43% |
| featured 2.0-2.1 | median 24 | 9 | 0-18 | 0-5 | 0-64 | 0% |
| GDLM | 10 | 3 | 0 | 0 | 0 | 0% |

- **Every object gets a colour channel.** Modern levels use dozens to hundreds of channels, about
  a third of them blending (additive glow). Copy channels tie colours together, and
  **HSV shifts on ~40% of objects** make shades of one channel. GDLM puts no object on its own
  channel.
- Background: Harpuia and Sunset Aurorae use bg 13; Spire 26, Dash Tower 57, CHAOTIC 43. Ground is
  mostly 1, 17 or 18. Many 2.2 levels hide the ground and build their own floor.

## 5. Triggers: what moves the look (per minute, median over the levels)

| per minute | played | legendary | featured 2.0-2.1 | GDLM |
|---|---|---|---|---|
| colour (colour, pulse, gradient) | 121 | 294 | 221 | ~16 |
| alpha + toggle (show/hide) | 186 | 574 | 40 | 0 |
| move + rotate + scale | 162 | 717 | 79 | 0 |
| particles (`CParticle` emitters) | 56 | 153 | 0 | 0 |
| camera (zoom, static, offset, rotate, guide, shake) | 44 | 107 | 0 | ~3 |
| spawn / logic | 25 | 80 | 0 | 0 |
| shaders (`Sh_*`: radial blur, hue, edit colour, pixelate, bulge, lens) | 14 | 44 | 0 | 0 |
| area triggers (area move / scale / tint) | 6 | 11 | 0 | 0 |

- Busiest in the played levels: move 143/min, alpha 142, pulse 109, particles 56, spawn 25,
  rotate 17. Every played level uses zoom and static camera, and 3/5 use shaders.
- Per section that is **~24 triggers per second of play** (legendary 54, featured 5).
- Spire carries `DamageSquare` (3610, a custom hit area) in every section. It is gameplay, not look.

## 6. Section by section (the played levels)

`node tools/modern_look.js played --sections`.
- **Objects per block by section**: p25 21, median 36, p75 50. Ground modes median 40, flying 23.
- **The opening is a showpiece**: the first section has a median 50 per block (Sunset Aurorae 70,
  CHAOTIC 66, Dash Tower 50).
- **Transitions are nearly empty**: Harpuia's 19-block cube link has 1 per block, its last 13
  blocks 2. A short quiet stretch makes the next part hit.
- **Drops get the effects**: Harpuia's 3x cube part (block 448) has 46 per block, all T-layer
  fills plus alpha triggers. Its wave part has 283 alpha triggers and 56 camera rotations.
  CHAOTIC's 63-76 s cube part adds shaders (bulge, pixelate). Spire's robot finale has 44 per
  block, with animated water.
- **Fast parts stay dense** (3x+: 39 per block), unlike 2.0-2.1, which emptied them (6).
- **Each section has its own set**: Spire goes gradient blocks, then outlined fills, then water and
  waterfall. Harpuia goes circles and links, then swirls, then large squares.

## Recipe for a composer (per section, Easy/Normal 2.2 look)

Budget:
- **20-50 objects per block** (aim ~35). Ground modes ~40, flying ~25, an opening and the drops
  ~50, transitions under 5. A 60 s level is 15,000-30,000 objects. Mind performance: RobTop's
  rating tips warn about lag (`rating.md`).

Layers, per section:
- **B4-B5 (~20%)**: background structures, big shapes and gradients, faint (opacity < 1 or dark
  channels).
- **B1-B3 (~25%)**: block fills behind the play blocks, outlines, shading gradients.
- **T1 (~15-45%)**: the play blocks and their trims, edges and top colours.
- **T2-T4 (~15-25%)**: glow, light rays, particles, small dots, frames in front.

Deco set:
- One family set per section, from `knowledge/objects/`. Designed-block style: `lightsquare` +
  `lighttriangle` fills, `d_gradient*` light, `blockOutline` / `persp_outline` edges, plus 1-2
  shape families (`d_circle`, `d_link_b`, `d_swirve`). Or the pixel-art style (`pixelart*`,
  `gdh`).
- Add `particle` emitters, `d_small_ball` dots and `d_scaleFadeRing` rings in front.

Colour:
- 30-60 channels, a third blending. Every deco object gets a channel. HSV variants on ~40% of
  objects to shade one palette.
- A new palette per section via colour triggers (~2 per second) and pulses on the beat
  (SYNC.md: loosely).

Motion, per minute:
- ~150 move/rotate, ~150 alpha/toggle (things appear and fade), ~50 particle emitters, a camera
  zoom or offset at each new section, 1-3 shader moments at the drops (radial blur, hue, edit colour).

Structure of the level:
- A dense opening.
- Quiet 1-2 s transitions.
- The biggest density and effects at the drops (SYNC.md / `tools/songmap.js` finds them).
- Each section a new look.

Keep in mind:
- **Gameplay first**: the top complaint about Legendaries is beautiful with weak gameplay
  (`players_say.md`).
- **Readability**: decoration must not hide hazards or look like orbs (`design.md`).
- Front layers (T2-T4) over the play should be light: glow, dots, thin lines, never solid fills.

## Open

- No in-game check yet that the key-24 layer numbers mean what is assumed here, or what key 96
  (no glow?) does.
- 2.2-only ids have no default layer in the catalogue ("T1?": up to 25% of CHAOTIC's objects).
- Particles, shaders and moving groups only show in play. Comparing frames of the user's
  recording `GD claude-rec 2026-11-23_03-23-46.mkv` with the viewer would show what the numbers
  mean on screen (visuals session's compare panel).
- `tools/style.js classify()` names 2.2 triggers (area triggers 3006+, shaders 2904+) as deco. That
  is why this tool names triggers from the catalogue instead.
