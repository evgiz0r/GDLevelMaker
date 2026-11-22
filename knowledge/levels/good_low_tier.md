# Good community levels at Easy -> Harder (candidates to study)

Not demons. Picked by signals of quality, not by anyone's taste:
- **Map Packs**: RobTop's own picks of user levels at a similar difficulty
  (https://geometry-dash.fandom.com/wiki/Map_Packs; list: https://gdbrowser.com/api/mappacks).
- **Rating tier**: Featured < Epic < Legendary < Mythic.
- **Likes**: popularity only. Old levels got huge counts just by being early.

IDs, stars, rating, song and likes come from the GDBrowser API (`https://gdbrowser.com/api/level/<id>`),
read 2026-11-22 by a research agent. **Why each one is good is NOT sourced yet**: no write-up
praising their gameplay was found. Measured below (the user OK'd downloading them for measuring, 2026-11-22). Never commit their level data.

| tier | level | ID | creator | stars | rating | song | likes | signal |
|---|---|---|---|---:|---|---|---:|---|
| Easy | ReTraY | 6508283 | DiMaViKuLov26 | 2 | Featured | Detious - Golden Haze | 9.2M | Alpha Pack, most-liked Easy |
| Easy | Sonar | 4454123 | JerkRat | 2 | Featured | Stereo Madness 2 (ForeverBound) | 6.9M | Alpha Pack |
| Easy | Dark Paradise | 11280109 | Roli GD | 2 | Featured | TheFatRat - Xenogenesis | 5.6M | Alpha Pack |
| Easy | Promises | 26618473 | Adiale | 2 | Featured | KabukiTunes - Promises | 4.6M | likes |
| Easy | IZnite | 32400752 | izhar | 2 | Epic | | 726k | Epic |
| Easy | Candescent | 34749502 | CastriX | 2 | Epic | | 672k | Epic |
| Easy | Cloudy | 78743788 | DHaner | 2 | Epic | | 434k | Epic, medium length |
| Normal | Level Easy | 11940 | Cody | 3 | Featured | Stereo Madness | 4.6M | Beginner Pack (first) |
| Normal | End Of Line | 215705 | PMK | 3 | Featured | DJ-Nate - Theory of Everything | 3.7M | Beginner Pack |
| Normal | Adrift | 9063899 | TamaN | 3 | Featured | balderdact - Adrift | 2.25M | Force Pack |
| Normal | Back on Track RM | 1244147 | ZenthicAlpha | 3 | Featured | Back on Track | 2.1M | Sapphire Pack, remake |
| Normal | LETs RUN | 31280642 | izhar | 3 | Epic | | 2.8M | Epic |
| Normal | LETs GO | 30468868 | izhar | 3 | Epic | | 2.3M | Epic |
| Normal | Gear | 32338202 | GD Jose | 3 | Epic | | 1.4M | Epic |
| Normal | Breakpoint | 117863163 | aPunch | 3 | Legendary | Stereo Madness | 144k | Legendary (2.2) |
| Normal | STEEP | 128000865 | EVILF | 3 | Legendary | | | Legendary (2.2) |
| Normal | Point of view | 115305577 | Bpi | 3 | Legendary | | | Legendary (2.2) |
| Hard | Dreamland | 150245 | Scanbrux | 4 | Featured | Back on Track | 2.7M | Beginner Pack |
| Hard | flappy hexagon | 1642022 | Creator Cloud | 4 | Featured | Waterflame - Hexagon Force | 2.7M | Sapphire Pack |
| Hard | OuterSpace | 27732941 | Nicki1202 | 5 | Featured | F-777 - Space Battle | 6.5M | most-liked Hard |
| Hard | Phantom | 29424929 | TheRealSalad | | Epic | F-777 | | Epic, XL |
| Hard | Mind Control | 40638411 | Darwin | | Epic | | 1.5M | Epic |
| Hard | Colorblind | 27961648 | Danolex | | Epic | | | Epic |
| Hard | Brave Blue | 141525782 | Glubfuberz | | Legendary | | | Legendary (2.2) |
| Hard | Stardust Sanctuary | 115688378 | Glubfuberz | | Legendary | | | Legendary (2.2) |
| Harder | Kappaclysm | 7485599 | Glittershroom | 6 | Featured | Dimrain47 - At the Speed of Light | 1.76M | Blade Pack |
| Harder | First Race | 27483789 | Stamina | 6 | Featured | Waterflame - Race Around the World | 2.8M | likes |
| Harder | Shock | 28225110 | Danolex | 6 | Epic | ColBreakz - 2011 | 2.9M | Epic |
| Harder | Sunshine | 56199846 | Unzor | 7 | Epic | | 2.25M | Epic |
| Harder | SLAM | 43908596 | rafer | 7 | Epic | | | Epic, XL |
| Harder | Eta Carnis | 126539075 | GloryEX | 6 | Mythic | | 316k | Mythic, XL |
| Harder | Tiny Tunes | 3382569 | JerkRat | | | | | Happy Pack |
| Harder | Swirl | 3012870 | | | | | | Happy Pack |
| Insane | Unity | 12057578 | TriAxis | 8 | Featured | | 2.3M | likes |

Blank cells = not reported yet; fill them in when a level gets its own file (`_template.md`).

Suggested first study set (newest and highest-rated, so closest to "good by today's standards"):
- Normal Legendary: Breakpoint, STEEP, Point of view.
- Hard Legendary: Brave Blue, Stardust Sanctuary.
- Harder Mythic: Eta Carnis.
- Classic set: the Alpha and Beginner Pack levels.


## Measured (2026-11-22)

How: `node tools/fetch_level.js <ids>` downloads each level from GD's server into `local/community/`
(git-ignored, never committed), then `node tools/style.js local/community/<id>.gdlvl --detail` measures it.
Only these numbers are kept. Columns are as in STYLE.md: play% = objects with a hitbox; sections = runs between
mode/speed portals; haz/10 = hazards per 10 blocks (whole-level average / densest section); rests = runs
of 6+ columns with no hazard; move/camera = trigger counts; alpha-to-0 = hide triggers.

| level | s | blocks | play% | sections | avg blk | modes used | speeds | haz/10 avg/max | orbs+pads | rests | spike runs 1/2/3/4+ | move | camera | alpha-to-0 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ReTraY | 58 | 606 | 13 | 18 | 34 | 5 | 0.5x/1x/2x/3x/4x | 7.8/178.7 | 0 | 25 | 0/0/0/0 | 58 | 0 | 16 |
| Sonar | 84 | 851 | 43 | 6 | 142 | 4 | 0.5x/1x | 12.7/22.8 | 12 | 9 | 0/0/0/0 | 0 | 0 | 0 |
| Dark Paradise | 65 | 612 | 16 | 16 | 38 | 5 | 0.5x/1x/2x/3x | 23.9/47.4 | 52 | 4 | 0/0/0/0 | 0 | 0 | 0 |
| Promises | 64 | 625 | 27 | 9 | 70 | 5 | 0.5x/1x | 15.2/30.6 | 32 | 12 | 0/0/0/0 | 342 | 0 | 69 |
| IZnite | 60 | 628 | 11 | 8 | 71 | 4 | 0.5x/2x/4x | 8.2/33.7 | 4 | 6 | 0/0/0/0 | 89 | 0 | 143 |
| Candescent | 63 | 597 | 14 | 10 | 60 | 6 | 0.5x/1x | 9.5/19.4 | 34 | 9 | 0/0/0/0 | 195 | 0 | 41 |
| Cloudy | 40 | 551 | 4 | 10 | 55 | 4 | 1x/2x/3x | 2.8/10.7 | 61 | 9 | 4/0/0/1 | 825 | 0 | 227 |
| Level Easy | 84 | 874 | 70 | 4 | 219 | 2 | 1x | 7.3/14.2 | 15 | 26 | 42/17/17/9 | 0 | 0 | 0 |
| End Of Line | 74 | 764 | 29 | 8 | 96 | 4 | 1x | 8.9/16.2 | 10 | 18 | 83/21/0/11 | 7 | 0 | 0 |
| Adrift | 103 | 986 | 32 | 19 | 52 | 6 | 0.5x/1x/2x | 13.5/23.9 | 2 | 13 | 4/0/0/0 | 0 | 0 | 1 |
| Back on Track RM | 80 | 830 | 63 | 3 | 277 | 2 | 1x | 7.3/8.5 | 23 | 18 | 53/15/3/4 | 0 | 0 | 1 |
| LETs  RUN | 58 | 611 | 14 | 15 | 41 | 6 | 0.5x/1x/2x | 24.1/53.2 | 36 | 2 | 0/0/0/0 | 201 | 0 | 16 |
| LETs GO | 59 | 626 | 14 | 19 | 33 | 6 | 0.5x/1x/2x/4x | 22.8/72.3 | 63 | 8 | 0/0/0/0 | 227 | 0 | 45 |
| Gear | 78 | 973 | 9 | 11 | 84 | 4 | 0.5x/1x/3x/4x | 3.4/11.1 | 37 | 54 | 0/0/0/2 | 528 | 0 | 198 |
| Breakpoint | 76 | 786 | 3 | 1 | 787 | 1 | 1x | 2.5/2.5 | 14 | 14 | 19/7/0/1 | 594 | 52 | 479 |
| STEEP | 81 | 896 | 2 | 17 | 53 | 5 | 1x/2x/3x/4x | 2.3/17.2 | 88 | 9 | 3/1/2/0 | 1018 | 115 | 2887 |
| point of view | 89 | 1121 | 3 | 13 | 86 | 4 | 1x/3x/4x | 2.4/6.3 | 37 | 26 | 0/0/0/0 | 525 | 72 | 592 |
| Dreamland | 80 | 834 | 67 | 3 | 278 | 2 | 1x | 7.0/7.5 | 46 | 13 | 42/22/3/7 | 0 | 0 | 0 |
| flappy hexagon | 74 | 773 | 41 | 1 | 774 | 1 | 1x | 24.6/24.6 | 0 | 1 | 0/0/0/0 | 0 | 0 | 0 |
| OuterSpace | 77 | 959 | 24 | 18 | 53 | 4 | 0.5x/1x/2x/3x | 17.1/32.6 | 126 | 10 | 0/0/0/0 | 520 | 0 | 21 |
| Phantom | 120 | 1187 | 14 | 38 | 31 | 7 | 0.5x/1x/2x/4x | 25.8/81.8 | 37 | 6 | 525/21/1/12 | 201 | 0 | 130 |
| Mind Control | 88 | 740 | 9 | 7 | 106 | 4 | 0.5x | 7.9/25.4 | 87 | 11 | 0/0/0/0 | 370 | 0 | 214 |
| Colorblind | 59 | 621 | 27 | 50 | 12 | 5 | 0.5x/1x/2x/3x | 24.1/70 | 61 | 5 | 9/0/0/4 | 773 | 0 | 6 |
| Brave Blue | 81 | 995 | 2 | 13 | 77 | 4 | 0.5x/1x/2x/3x | 2.3/4.2 | 43 | 38 | 17/5/0/2 | 447 | 49 | 54 |
| Stardust Sanctuary | 112 | 1442 | 2 | 26 | 56 | 6 | 0.5x/1x/2x/3x/4x | 2.1/10 | 60 | 47 | 3/0/1/0 | 536 | 102 | 183 |
| Kappaclysm | 78 | 733 | 37 | 17 | 43 | 5 | 0.5x/1x/2x | 25.8/69.3 | 82 | 7 | 10/2/2/0 | 0 | 0 | 0 |
| First Race | 69 | 754 | 14 | 23 | 33 | 6 | 0.5x/1x/2x | 15.5/46 | 61 | 10 | 17/0/0/0 | 23 | 0 | 27 |
| Shock | 61 | 587 | 10 | 41 | 14 | 4 | 0.5x/1x/2x/3x | 18.8/28.1 | 42 | 2 | 9/1/0/4 | 507 | 0 | 10 |
| Sunshine | 80 | 992 | 10 | 30 | 33 | 5 | 0.5x/1x/2x/3x | 40.4/115.1 | 168 | 5 | 1/0/0/0 | 976 | 0 | 259 |
| SLAM | 148 | 2042 | 19 | 45 | 45 | 7 | 0.5x/1x/2x/3x/4x | 22.7/90 | 121 | 8 | 2/0/0/0 | 922 | 0 | 186 |
| Eta Carnis | 122 | 1307 | 1 | 17 | 77 | 4 | 0.5x/1x/2x | 5.7/49.6 | 103 | 23 | 6/2/4/5 | 3466 | 501 | 402 |
| Tiny Tunes | 72 | 797 | 27 | 10 | 80 | 5 | 0.5x/1x/2x | 20.9/33.3 | 74 | 3 | 0/0/0/0 | 0 | 0 | 1 |
| SWIRL | 82 | 916 | 29 | 6 | 153 | 5 | 1x/2x | 23.0/32.5 | 70 | 1 | 0/0/0/0 | 0 | 0 | 1 |
| Unity | 73 | 652 | 9 | 10 | 65 | 6 | 0.5x/1x | 21.8/35 | 8 | 6 | 0/0/0/0 | 621 | 0 | 206 |

**Limits -- read before using the numbers**
- These are positions as built in the editor. 2.2 levels move and hide much of their gameplay with
  triggers (Breakpoint, STEEP, Brave Blue, Eta Carnis: hundreds to thousands of move/alpha triggers).
  For those, "haz/10" and "rests" describe the static layout, not what the player meets.
- Spike runs count only the classic spike ids standing in a row on a surface. Most newer levels use other
  hazards (saws, custom spike shapes), so 0/0/0/0 there means "not classic spikes", not "no spikes".
- Wave/ship corridors make the densest-section number huge (ReTraY 179): it counts the corridor walls.

## What the numbers say

Three generations of "good low-tier level", clearly apart:

1. **Classic (2013-14, IDs < 2M)**: Level Easy, End Of Line, Back on Track RM, Dreamland. They look
   like the official levels: 2-4 long sections (100-280 blocks), 1x only, cube/ship (End Of Line
   adds ball/robot), 60-70% gameplay objects, 13-26 rests, ~7 hazards per 10 blocks. flappy hexagon
   is a one-idea level: a single UFO section for the whole song.
2. **1.9-2.1 Featured/Epic (IDs 4M-60M)**: most of the list. 6-50 sections of 12-140 blocks
   (typically 30-70, i.e. a new mode or speed every 3-7 s), **4-7 modes even at Easy**, speeds from
   0.5x to 3-4x, 60-90% decoration, few rests (2-12), 15-25 hazards per 10 blocks. Even 2-star Epics
   (ReTraY, IZnite, Candescent, LETs RUN) switch mode every few seconds: they stay easy by making each
   section forgiving, not by using fewer modes.
3. **2.2 Legendary/Mythic (IDs > 110M)**: Breakpoint, STEEP, point of view, Brave Blue, Stardust
   Sanctuary, Eta Carnis. 97-99% decoration, gameplay set in motion by move/alpha triggers, camera
   triggers (50-500). Breakpoint keeps it to one idea: cube only, 1x, on the Stereo Madness song,
   the whole level.

Other patterns:
- **Length**: many Easy/Normal Epics sit at 58-65 s, just at the 60 s "Long" mark (RobTop's rating
  doc says 60 s+ is better). Harder ones run longer (SLAM 148 s, Eta Carnis 122 s, Phantom 120 s).
- **Speed changes are normal at every tier**: 0.5x appears in 24 of 34 levels, 2x in 25.
- **Rests drop as levels get newer**: classic 13-26, 2.0-era Epics 2-12. 2.2 Legendaries show more
  (14-47), but that is the static layout (see limits).

## What GDLM can take from it (for low tiers)

- A **classic-feel** level (official 1-8 style) is a real, still-rated kind: long sections, 1x,
  cube/ship, plenty of rests. That is what GDLM can build and check best today.
- A **modern** low-tier level means a mode/speed change every 3-7 s with each section easy. GDLM can
  only do this once the other modes are calibrated (CLAUDE.md: ball/UFO/wave/robot/spider/swing are
  checked only by the plans so far).
- **One idea for a whole level** is a valid design at any era (flappy hexagon, Breakpoint).
- 2.2-style moving gameplay needs triggers, which the sim doesn't run yet (CLAUDE.md "Not simulated yet").
