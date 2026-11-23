# What rated levels are built from, and how they bring in new things

A follow-up to `variety.md`, which found that GDLM 41-45 lack variety rather than obstacles. Made by
`node tools/obstacles.js structure | catalogue | intro` (2026-11-23) over the 34 rated Easy/Normal
community levels from 2.0-2.1 (`low_tier_stats.md`), official 1-8 and GDLM 41-45. Layout only.

## 1. Structure: rated levels play on blocks, GDLM plays on the ground

`node tools/obstacles.js structure --gdlm --official` (and `--tiers Hard,Harder` for contrast).
Column meanings:
- **block cols**: share of the mode's columns that hold a block, slab or slope.
- **haz raised**: share of hazards not on the ground row (on platforms, under ceilings, or on a
  floor built of blocks).
- **haz by a block**: share of hazards with a block within 1 column and 2 rows: a spike on a
  ledge, at a pit's edge, under an overhang.

| levels | mode | block cols | haz raised | haz by a block |
|---|---|---|---|---|
| rated Easy+Normal (34) | cube | 47% | 71% | 44% |
| rated Easy+Normal | ship | 51% | 80% | 48% |
| rated Easy+Normal | ufo / robot / wave | 50-57% | 77-95% | 48-52% |
| rated Easy+Normal | ball | 73% | 70% | 54% |
| rated Hard+Harder (29) | cube | 47% | 83% | 39% |
| official 1-8 | cube | 47% | 27% | 64% |
| official 1-8 | ship | 50% | 59% | 50% |
| **GDLM 41-45** | cube | **13%** | **8%** | **17%** |

**Half the columns of every rated or official cube part hold a block, at every tier.** Spikes sit on
ledges, between platforms and at pit edges. In GDLM, 13% of the columns hold a block and 92% of the
spikes sit on the bare ground. This is likely the biggest single reason GDLM looks and plays
"bland". Jumping between platforms, up and down steps and over pits is the gameplay of a rated
cube part. GDLM's is jumping lone spikes on a flat floor.

The official levels keep their spikes on the real ground (27% raised) but next to blocks (64%).
Community levels often build their own floor of blocks, which is why their "raised" share is high.
Use "block cols" and "haz by a block" as the targets: ~45-50% and ~45-65%.

## 2. Chunks: what an obstacle looks like

`node tools/obstacles.js catalogue --gdlm`: islands of hazards, blocks, orbs and pads up to 12
columns wide (`tools/style.js chunks`). Long block structures are wider than that, so they are
not counted here; section 1 covers them.

| levels | mode | chunks | median width | median height | with a block | with an orb/pad | a single object |
|---|---|---|---|---|---|---|---|
| rated Easy+Normal | cube | 297 | 2 | 2 | 35% | 28% | 39% |
| rated Easy+Normal | ship | 165 | 1 | 1 | 35% | 2% | 52% |
| rated Easy+Normal | ball | 26 | 3 | 6 | 62% | 38% | 27% |
| GDLM 41-45 | cube | 85 | 2 | 1 | 15% | 18% | 31% |

- Rated cube obstacles are 2 tall, GDLM's 1: flat.
- Rated levels put a block in 35% of the cube obstacles against GDLM's 15%, and an orb or pad in
  28% against 18%.
- Rated levels barely share exact shapes. The most common, two hazards side by side, is in 6 of
  34 levels. Every level makes its own, so there is no fixed list of obstacles to copy. What they
  share is the ingredients: blocks, steps, overhangs, pads and orbs over spikes. The tool prints
  examples per mode, one per level (`catalogue`).

Cube examples from rated Easy/Normal levels, one per level, exactly as `catalogue --top 6` prints them (glyphs: `^` spike, `x` other
hazard, `#` block, `-` slab, `/` slope, `o` orb, `_` pad, `|` portal, `.` empty). They show what
the ingredients look like, not models to copy:

Blocks and hazards:

          ...#....
          .......x
          ........   ...x......
          ........   ..........   ...x               ......x.
          ........   ..........   ....               ........
    |..   ###...x.   ..........   ....               ........
    ...   ..#.###.   ..........   ....               /.......
    ...   -#-/-.#.   /##....x.#   #...   /........   .#####..
    #-#   #xxxxx#.   .-.----#.#   #x-.   .####/...   ........
    x.x   ...x....   ........x.   ..x.   ||....###   .......x

With orbs or pads:

                                                    ....|..
                         xx...                      .......
    .//..                .....   ._.                .......
    .__..   ...--.....   xxxx_   ...                .......
    .....   ...--.....   .....   ...                .......
    .....   ...--.x...   .....   #./                .......
    _..._   _xx--xxxx/   .....   ...   ........._   |......
    x.x#x   .....x.x..   .#...   ./.   /########_   _^^^^^^

GDLM's most used chunks are `^^`, `^^^` and spikes under a hanging spike row (`##` / `vv` over
`^^`). Rated levels' cube parts are mostly steps, ledges and pits with hazards at their edges.

## 3. Introductions: how new kinds of thing arrive

`node tools/obstacles.js intro --gdlm --official`. A "kind" is a hazard shape, or an orb, pad or
portal by name. One caveat: many spike skins have no known shape in `lib/objects.js`, so they
count as "box".

| levels | kinds | new kinds per minute | s between new kinds | in the first quarter | last new kind at |
|---|---|---|---|---|---|
| rated Easy+Normal (34) | 17 | 13.8 | 2.0 | 48% | 85% of the level |
| official 1-8 | 9 | 6.8 | 4.6 | 50% | 77% |
| GDLM 41-45 | 3 | 6.0 | 8.3 | 33% | 66% |

When each kind first appears in rated Easy/Normal levels (median):

| kind | levels | first seen | first seen (% of level) | uses in the next 10 s |
|---|---|---|---|---|
| spike or hazard block | 34 | 2 s | 3% | many |
| saw | 30 | 4 s | 6% | 8 |
| yellow pad | 28 | 7 s | 11% | 1 |
| yellow orb | 23 | 7 s | 12% | 1 |
| ship portal | 33 | 16 s | 22% | - |
| 0.5x speed | 23 | 16 s | 28% | - |
| gravity portals | 24-27 | 17-21 s | 28-36% | 1 |
| pink pad | 23 | 20 s | 34% | 0 |
| UFO portal | 25 | 25 s | 39% | - |
| blue pad | 19 | 25 s | 36% | 3 |
| ball portal | 20 | 29 s | 50% | - |
| wave portal | 15 | 35 s | 57% | - |

**What it says:**
- Rated Easy/Normal levels bring in something new **every ~2 s**. Half the kinds arrive in the
  first quarter, and new ones keep coming until ~85% of the level. They have twice the official
  pace (one every ~4.6 s) and four times GDLM's (one every ~8 s, and only 3 kinds in all).
- **Order**: hazards and saws first, yellow pads and orbs by ~7 s, the first new mode (usually the
  ship) by ~15 s, then gravity, slow speed, pink and blue pads, then UFO, ball and wave from about
  a third of the way in.
- A new orb or pad is used **once or twice** in the next 10 s, not drilled: one example, then on to
  the next thing. The "teach, test, twist" structure (design.md) is a mode-scale pattern, not a
  per-object one.
- Calm first use (no hazard of another kind nearby) is rare for orbs and pads (0-21%). Their
  first use is over a spike, since that is what they are for. Measuring how gentle an
  introduction is would need timing (the difficulty tools), not layout.

## Targets for GDLM (Easy/Normal)

- **Build cube parts on blocks**: blocks in ~45-50% of the columns; most spikes on or next to a
  block (ledges, steps, pit edges, under overhangs), not in rows on the bare floor.
- Obstacles about 2 rows tall, with a block in ~1/3 and an orb or pad in ~1/4 of them.
- **Something new every 2-5 s for the first half**: yellow pad and orb by ~10 s, a second mode
  by ~15-20 s, gravity and a speed change by a third of the way in, ~15 kinds by the end.
- Show each new thing once or twice, then move on, while staying fair: the first use in plain
  sight, cued, no prejump (`design.md`).
