# Good low-tier levels in numbers: 91 rated levels, Easy -> Harder

**Sample** (2026-11-22). For each of Easy, Normal, Hard and Harder, GDBrowser's search
(`https://gdbrowser.com/api/search/*?diff=N&type=mostliked&featured|epic|legendary`) gave the
most-liked Featured (20), Epic (10) and Legendary (5) levels. Platformers were dropped and duplicates
removed. Result: 91 levels, 63 from 2.0-2.1, 22 from 2.2, 6 from 1.x.

**Method**: `node tools/fetch_level.js` downloads each level into `local/community/` (git-ignored; the
user OK'd downloading for measuring), then `tools/style.js` measures it. Only numbers are kept here.

**Bias and limits**:
- Most-liked favours old, famous levels.
- 2.2 levels move and hide their gameplay with triggers, so their static hazard and rest counts
  are not what a player meets.
- Speeds in blocks/s: 0.5x 8.4, 1x 10.4, 2x 12.9, 3x 15.6, 4x 19.2.

## Per tier, per era, per rating (medians)

Made by `node tools/community.js measure`. Column meanings:
- **sections**: runs between mode or speed portals.
- **0.5x / 3x+**: share of levels that use that speed at all.
- **rests/min**: runs of 6+ columns with no hazard, per minute.
- **haz/10**: hazards per 10 blocks.

The "(2.0-2.1)" rows are the fairest: those levels don't move their gameplay.

| group | n | s | sections | s per section | modes | 0.5x / 3x+ | play% | rests/min | haz/10 | orbs+pads/min | move | alpha-to-0 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Easy | 25 | 66 | 10 | 6.3 | 4 | 68% / 48% | 10 | 6.4 | 6.7 | 13 | 185 | 41 |
| Normal | 23 | 74 | 10 | 7.4 | 4 | 61% / 43% | 10 | 14.3 | 5.0 | 25 | 392 | 34 |
| Hard | 24 | 72 | 18 | 4.0 | 5 | 92% / 63% | 14 | 6.7 | 17.9 | 39 | 311 | 58 |
| Harder | 19 | 72 | 21 | 3.6 | 6 | 84% / 79% | 16 | 6.3 | 17.0 | 58 | 276 | 45 |
| Easy (2.0-2.1) | 17 | 66 | 12 | 4.3 | 5 | 82% / 53% | 13 | 6.4 | 12.7 | 25 | 162 | 27 |
| Normal (2.0-2.1) | 17 | 69 | 10 | 7.4 | 4 | 76% / 35% | 12 | 14.3 | 6.1 | 28 | 270 | 24 |
| Hard (2.0-2.1) | 16 | 70 | 20 | 3.4 | 5 | 100% / 63% | 14 | 5.0 | 24.1 | 54 | 201 | 58 |
| Harder (2.0-2.1) | 13 | 72 | 24 | 3.1 | 6 | 100% / 92% | 17 | 5.4 | 18.8 | 69 | 267 | 43 |
| era 1.x | 6 | 80 | 3 | 26.8 | 2 | 17% / 0% | 67 | 15.7 | 7.3 | 16 | 0 | 0 |
| era 2.0-2.1 | 63 | 68 | 16 | 4.0 | 5 | 89% / 59% | 14 | 7.0 | 15.2 | 40 | 213 | 34 |
| era 2.2 | 22 | 89 | 14 | 6.2 | 4 | 55% / 68% | 3 | 16.3 | 2.5 | 26 | 594 | 251 |
| rating featured | 33 | 69 | 12 | 5.6 | 4 | 79% / 39% | 24 | 6.4 | 14.3 | 28 | 58 | 14 |
| rating epic | 40 | 70 | 17 | 3.8 | 5 | 85% / 68% | 12 | 7.7 | 16.9 | 53 | 335 | 56 |
| rating legendary | 18 | 89 | 13 | 6.8 | 4 | 50% / 67% | 3 | 16.4 | 2.4 | 25 | 594 | 351 |

## Sections by speed and by mode (2.0-2.1, sections of 8+ blocks)

Made by `node tools/community.js sections`.

| speed | sections | median blocks | median s | haz/10 |
|---|---|---|---|---|
| 0.5x | 272 | 45 | 5.4 | 12.5 |
| 1x | 258 | 39 | 3.7 | 15.1 |
| 2x | 222 | 32 | 2.5 | 14.8 |
| 3x | 111 | 24 | 1.5 | 6.0 |
| 4x | 72 | 18 | 0.9 | 2.5 |

| mode | sections | median blocks | haz/10 |
|---|---|---|---|
| cube | 354 | 31 | 11.1 |
| ship | 216 | 31 | 11.3 |
| ufo | 97 | 33 | 10.1 |
| wave | 79 | 22 | 9.3 |
| ball | 76 | 45 | 19.4 |
| robot | 71 | 39 | 12.4 |
| spider | 42 | 35 | 22.8 |

## Five levels section by section (idea 2)

Each row is one section: mode, speed, blocks, then hazards per 10 blocks (h) and orbs+pads (o).

- **IZnite** (Easy, Epic, 60 s):
  `ship .5x 59 h3 | cube .5x 69 h11 | ship 4x 83 h0 | robot .5x 79 h34 | ship 4x 85 h1 | cube .5x 180 h0 | cube 4x 12 | spider 2x 61 h18 o4`.
  The busy robot part is at 0.5x. The 4x parts are empty ship flights. A long empty cube stretch
  (180 blocks, ~21 s) works as a breather or a visual show.
- **Candescent** (Easy, Epic, 63 s):
  `cube, robot, ship, ufo` at 0.5x, then `ball, robot, spider, ufo, cube, robot` at 1x.
  Ten sections of 30-81 blocks (~7 s each), a new mode every section, and one speed-up at
  the halfway point. Hazards 4-19 per 10.
- **LETs GO** (Normal, Epic, 59 s): long sections (56-95 blocks) between two bursts of very short
  switches (2-12 blocks: ball, spider, robot at 17-23 s; cube 2x, 4x, 0.5x, then ship at 32-36 s).
  The bursts are the level's showpieces, probably on accents in the song (not checked).
- **OuterSpace** (Hard, Featured, 77 s): a ship part where the speed flips 2x/0.5x every ~1.2 s
  (10-16 blocks), speed used as rhythm. Then a 2x cube part with 93 orbs/pads (orb chains) and a
  long 3x ship finale (297 blocks, ~19 s, 29 hazards per 10).
- **Mind Control** (Hard, Epic, 88 s): 0.5x the whole way. Seven long sections (59-151 blocks,
  7-18 s): `cube, ufo, cube, ball, wave, cube, ufo`. Calm speed, with the difficulty in the UFO part
  (25 per 10) and in orb runs (ball 49, last ufo 36).

## What it says (for GDLM)

1. **Hard is the big step, not Normal.** In 2.0-2.1, Easy and Normal look alike, and Normal is even
   calmer in this sample. At Hard, sections halve (7 s to 3.4 s), orbs and pads double (28 to 54
   per minute), hazards go up 2-4x, and rests drop to ~5 per minute.
2. **Many modes at every tier.** A median of 4-6 modes even at Easy. Low tiers stay easy through
   each section being forgiving, not through using few modes.
3. **Speed and density trade off.** 3x and 4x sections are short (~1-1.5 s) and nearly empty (2.5-6 per
   10): a fast burst is a reward or a transition. 0.5x is the most common speed (272 sections) and
   carries the busiest modes (IZnite's robot, Mind Control).
4. **Hard modes get room.** Ball, spider and robot sections are the densest (12-23 per 10) and get
   longer sections (35-45 blocks). Wave sections are the shortest (22 blocks).
5. **Length**: 66-72 s median at every tier, just past the 60 s "Long" mark. 2.2 Legendaries run
   longer (89 s).
6. **Rating tiers** (all tiers together): Featured 24% gameplay objects and ~60 move triggers;
   Epic 12% and ~335; Legendary 3% and ~590, with ~350 hide triggers. A higher rating means more
   decoration and effects, not different gameplay numbers.
7. **Two shapes of a "modern" low-tier level**, both rated:
   - **switch-every-section** (Candescent): ~7 s per mode, one speed-up.
   - **long calm sections plus bursts** (LETs GO, Mind Control).
   Either is a better template for GDLM than one long cube part (GDLM 44 v1 "bland").

## The 91 levels

| tier | level | ID | creator | rating | ver | s | sections | modes | speeds |
|---|---|---|---|---|---|---:|---:|---:|---|
| Easy | ReTraY | 6508283 | DiMaViKuLov26 | featured | 2.1 | 58 | 18 | 5 | 0.5x/1x/2x/3x/4x |
| Easy | Sonar | 4454123 | JerkRat | featured | 2.1 | 84 | 6 | 4 | 0.5x/1x |
| Easy | Dark Paradise | 11280109 | Roli GD  | featured | 2.0 | 65 | 16 | 5 | 0.5x/1x/2x/3x |
| Easy | Promises | 26618473 | Adiale | featured | 2.0 | 64 | 9 | 5 | 0.5x/1x |
| Easy | ThE WorLd | 11630859 | x8Px | featured | 2.0 | 66 | 17 | 4 | 0.5x/1x/3x |
| Easy | Ocean Of Dreams | 21923305 | Spu7Nix | featured | 2.1 | 66 | 12 | 5 | 0.5x/1x/2x |
| Easy | Warmth | 23356701 | KFAOpitar | featured | 2.0 | 69 | 25 | 6 | 0.5x/1x |
| Easy | SUNSET | 11945914 | SEM 1 | featured | 2.0 | 59 | 5 | 4 | 1x |
| Easy | a spark of life | 13935609 | lilbin | featured | 2.0 | 66 | 6 | 4 | 0.5x/1x |
| Easy | DARKNESS | 1729 | Phenoix | featured | Pre-1.7 | 80 | 3 | 2 | 1x |
| Easy | IZnite | 32400752 | izhar | epic | 2.1 | 60 | 8 | 4 | 0.5x/2x/4x |
| Easy | Candescent | 34749502 | CastriX | epic | 2.1 | 63 | 10 | 6 | 0.5x/1x |
| Easy | boogie | 114694142 | connot | legendary | 2.2 | 54 | 14 | 6 | 0.5x/1x/4x |
| Easy | Cloudy | 78743788 | DHaner | epic | 2.1 | 40 | 10 | 4 | 1x/2x/3x |
| Easy | Nice | 65109444 | Danolex | epic | 2.2 | 61 | 32 | 7 | 0.5x/1x/2x/3x/4x |
| Easy | Geometry Dash | 67661363 | GDvesuvius | epic | 2.2 | 421 | 3 | 2 | 1x/4x |
| Easy | Wishless | 34224737 | Pawlogates | epic | 2.1 | 58 | 16 | 7 | 0.5x/1x/2x/3x/4x |
| Easy | Spacestation | 90752263 | Splinter25 | epic | 2.1 | 73 | 17 | 5 | 0.5x/1x/2x/3x |
| Easy | Serponge Look At Me | 55037478 | iISpaceDustIi | epic | 2.1 | 150 | 62 | 7 | 0.5x/1x/2x/3x/4x |
| Easy | Less than three | 59760047 | Danzmen | epic | 2.1 | 83 | 23 | 3 | 0.5x/1x/2x/3x/4x |
| Easy | Fuel | 81257107 | bli | epic | 2.1 | 111 | 1 | 1 | 1x |
| Easy | Wistful Wilds | 111694817 | Glubfuberz | legendary | 2.2 | 100 | 4 | 3 | 0.5x |
| Easy | Imagine | 127828956 | Pb207 | legendary | 2.2 | 271 | 1 | 1 | 1x |
| Easy | PUNCH | 124237602 | Bpi | legendary | 2.2 | 31 | 1 | 1 | 1x |
| Easy | Voyager One | 125994364 | Pb207 | legendary | 2.2 | 667 | 1 | 1 | 1x |
| Normal | Level Easy | 11940 | Cody | featured | Pre-1.7 | 84 | 4 | 2 | 1x |
| Normal | End Of Line | 215705 | PMK | featured | 2.0 | 74 | 8 | 4 | 1x |
| Normal | Chambers | 28255647 | SirHadoken | featured | 2.0 | 67 | 5 | 3 | 0.5x/1x |
| Normal | through time | 27319926 | Berkoo | featured | 2.0 | 60 | 5 | 3 | 0.5x |
| Normal | dorabaebasic4 | 1389451 | DORABAE | featured | 2.0 | 81 | 10 | 4 | 0.5x/1x/2x/3x |
| Normal | Spooky Light | 26949498 | Serponge | featured | 2.0 | 69 | 8 | 3 | 0.5x/1x/3x |
| Normal | LETs  RUN | 31280642 | izhar | epic | 2.1 | 58 | 15 | 6 | 0.5x/1x/2x |
| Normal | Infernal Arena | 18533341 | SUOMI | featured | 2.0 | 73 | 5 | 2 | 0.5x/1x |
| Normal | Highscore | 26248615 | Danolex | featured | 2.1 | 54 | 13 | 4 | 0.5x/1x/2x |
| Normal | LETs GO | 30468868 | izhar | epic | 2.1 | 59 | 19 | 6 | 0.5x/1x/2x/4x |
| Normal | Gear | 32338202 | GD Jose | epic | 2.1 | 78 | 11 | 4 | 0.5x/1x/3x/4x |
| Normal | Afterlife | 89521875 | nasgubb | epic | 2.1 | 114 | 3 | 2 | 1x |
| Normal | LoCuRa EnVoLvEnTe | 31944232 | izhar | epic | 2.1 | 85 | 5 | 2 | 1x |
| Normal | Under | 39113837 | Serponge | epic | 2.1 | 96 | 35 | 5 | 0.5x/1x/2x/3x/4x |
| Normal | Shine | 30225532 | KFAOpitar | epic | 2.1 | 72 | 10 | 6 | 0.5x/1x |
| Normal | Dreamy | 92555035 | DHaner | epic | 2.1 | 59 | 15 | 6 | 0.5x/1x/2x/3x |
| Normal | Hush | 34362654 | epiphani | epic | 2.1 | 59 | 8 | 4 | 1x/2x |
| Normal | Process | 32122593 | Sharks | epic | 2.1 | 61 | 13 | 5 | 0.5x |
| Normal | Breakpoint | 117863163 | aPunch | legendary | 2.2 | 76 | 1 | 1 | 1x |
| Normal | Starbladesaster | 116021302 | ElMatoSWAG | legendary | 2.2 | 150 | 26 | 6 | 1x/3x/4x |
| Normal | STEEP | 128000865 | EVILF | legendary | 2.2 | 81 | 17 | 5 | 1x/2x/3x/4x |
| Normal | point of view | 115305577 | Bpi | legendary | 2.2 | 89 | 13 | 4 | 1x/3x/4x |
| Normal | Kalpa | 135177546 | Twandash | legendary | 2.2 | 147 | 7 | 2 | 0.5x/1x/3x/4x |
| Hard | OuterSpace | 27732941 | Nicki1202 | featured | 2.1 | 77 | 18 | 4 | 0.5x/1x/2x/3x |
| Hard | Acid Factory | 28179535 | UsernameDefault | featured | 2.1 | 75 | 34 | 5 | 0.5x/1x/2x/3x |
| Hard | Amplification | 20635816 | Berkoo | featured | 2.0 | 61 | 22 | 6 | 0.5x/1x/2x/3x |
| Hard | Overture | 28200611 | Fault | featured | 2.1 | 72 | 19 | 5 | 0.5x/1x/2x/3x |
| Hard | Dreamland | 150245 | Scanbrux | featured | Pre-1.7 | 80 | 3 | 2 | 1x |
| Hard | flappy hexagon | 1642022 | Creator Cloud | featured | 1.9 | 74 | 1 | 1 | 1x |
| Hard | Phantom | 29424929 | TheRealSalad | epic | 2.1 | 120 | 38 | 7 | 0.5x/1x/2x/4x |
| Hard | Almighty | 27080757 | aArbolito | featured | 2.0 | 69 | 20 | 5 | 0.5x/1x/3x |
| Hard | Anubis | 25886024 | Adiale | featured | 2.0 | 72 | 25 | 6 | 0.5x/1x/2x |
| Hard | dorabaebasic5 | 1734354 | DORABAE | featured | 1.8 | 88 | 11 | 4 | 0.5x/1x/2x |
| Hard | Mind Control | 40638411 | Darwin | epic | 2.1 | 88 | 7 | 4 | 0.5x |
| Hard | Inscius | 33118209 | f3lixsram | epic | 2.1 | 70 | 16 | 7 | 0.5x/1x/2x/3x |
| Hard | Colorblind | 27961648 | Danolex | epic | 2.0 | 59 | 50 | 5 | 0.5x/1x/2x/3x |
| Hard | Lustre | 37188385 | G4lvatron | epic | 2.1 | 61 | 18 | 4 | 0.5x/1x/2x |
| Hard | Moonlight | 60679881 | Unzor | epic | 2.1 | 70 | 17 | 3 | 0.5x/1x/2x |
| Hard | Citrus | 36847362 | Extrox | epic | 2.1 | 65 | 10 | 5 | 0.5x/1x/2x |
| Hard | Astralium | 44793604 | Geom3zon | epic | 2.1 | 59 | 26 | 6 | 0.5x/1x/2x/3x/4x |
| Hard | Believe | 28879542 | AceVict | epic | 2.1 | 65 | 11 | 6 | 0.5x/1x/2x |
| Hard | Tenebris | 34851342 | f3lixsram | epic | 2.1 | 65 | 33 | 6 | 0.5x/1x/2x/3x/4x |
| Hard | Dead Device | 117912123 | IMOXI | legendary | 2.2 | 72 | 18 | 4 | 0.5x/1x/2x/3x/4x |
| Hard | Brave Blue | 141525782 | Glubfuberz | legendary | 2.2 | 81 | 13 | 4 | 0.5x/1x/2x/3x |
| Hard | Stardust Sanctuary | 115688378 | Glubfuberz | legendary | 2.2 | 112 | 26 | 6 | 0.5x/1x/2x/3x/4x |
| Hard | Free the Boys | 131860273 | pocke | legendary | 2.2 | 85 | 11 | 2 | 0.5x/1x/2x/3x |
| Hard | Mission S | 116177905 | Twandash | legendary | 2.2 | 124 | 36 | 5 | 0.5x/1x/2x/3x/4x |
| Harder | Shock | 28225110 | Danolex | epic | 2.1 | 61 | 41 | 4 | 0.5x/1x/2x/3x |
| Harder | First Race | 27483789 | Stamina | featured | 2.2 | 69 | 23 | 6 | 0.5x/1x/2x |
| Harder | SLAM | 43908596 | rafer | epic | 2.2 | 148 | 45 | 7 | 0.5x/1x/2x/3x/4x |
| Harder | Sunshine | 56199846 | Unzor | epic | 2.1 | 80 | 30 | 5 | 0.5x/1x/2x/3x |
| Harder | Frontline Full | 28127292 | God Of Music | featured | 2.1 | 68 | 12 | 6 | 0.5x/1x/2x/3x |
| Harder | Magmatic Sanctuary | 27448202 | RadiationV2 | featured | 2.1 | 112 | 55 | 6 | 0.5x/1x/2x/3x/4x |
| Harder | Kappaclysm | 7485599 | Glittershroom | featured | 2.1 | 78 | 17 | 5 | 0.5x/1x/2x |
| Harder | Aquarius | 29416734 | Skitten | epic | 2.1 | 94 | 30 | 7 | 0.5x/1x/2x/3x/4x |
| Harder | Flappy Ufo | 819956 | JXAN | featured | Pre-1.7 | 50 | 3 | 3 | 1x |
| Harder | Carnation | 25969464 | IlhamAulia | featured | 2.1 | 61 | 47 | 6 | 0.5x/1x/2x/3x |
| Harder | Payload | 29394058 | TheRM22 | epic | 2.1 | 64 | 13 | 7 | 0.5x/1x/2x/3x/4x |
| Harder | Schade | 37269362 | BranSilver | epic | 2.1 | 73 | 19 | 5 | 0.5x/1x/2x/3x |
| Harder | Danger Zone | 28677296 | GD Jose | epic | 2.1 | 81 | 41 | 5 | 0.5x/1x/2x/3x/4x |
| Harder | Galvanic | 42497026 | distortt | epic | 2.1 | 61 | 16 | 6 | 0.5x/1x/2x/3x |
| Harder | Massacre | 29270946 | GD Jose | epic | 2.1 | 72 | 24 | 5 | 0.5x/1x/2x/3x/4x |
| Harder | Hydra | 29066114 | Darwin | epic | 2.1 | 65 | 18 | 6 | 0.5x/1x/2x/3x |
| Harder | Dimension Break | 129492004 | AbstractDark | legendary | 2.2 | 114 | 21 | 8 | 0.5x/1x/2x/3x |
| Harder | Avarinth | 119731730 | MiraCatsy | legendary | 2.2 | 81 | 19 | 6 | 1x/2x/3x |
| Harder | Subwoofer Lullaby | 100157619 | Magpipe | legendary | 2.2 | 63 | 8 | 3 | 1x/2x |
