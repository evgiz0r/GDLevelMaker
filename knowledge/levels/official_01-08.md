# Official levels 1-8 (Stereo Madness -> Time Machine): the low-tier ramp

The game's own Easy -> Harder ramp, so the best model for GDLM's low tiers. Three kinds of
facts, kept apart:
- **[wiki]** = Geometry Dash Fandom wiki, *Main Levels*
  (https://geometry-dash.fandom.com/wiki/Main_Levels, read via its api.php 2026-11-22; the page is WIP).
- **[measured]** = `node tools/style.js N --detail` on the game install (2026-11-22).
- **[difficulty]** = the DIFFICULTY.md table (human route).

Songs come from GDBrowser song fields unless marked "unverified".

## Measured side by side [measured] [difficulty]

| # | level | rating | s | blocks | sections (blocks) | rests 6+ | spike runs 1/2/3/4+ | 1st cube haz/10 | inputs | min ms |
|---|---|---|---:|---:|---|---:|---|---:|---:|---:|
| 1 | Stereo Madness | Easy 1 | 85 | 879 | cube 267, ship 152, cube 346, ship 115 | 25 | 20/10/2/9 | 4.4 | 119 | 63 |
| 2 | Back On Track | Easy 2 | 80 | 834 | cube 422, ship 138, cube 275 | 19 | 38/13/3/6 | 7.5 | 111 | 100 |
| 3 | Polargeist | Normal 3 | 89 | 922 | cube 322, ship 122, cube 479 | 10 | 41/11/1/1 | 7.3 | 143 | 100 |
| 4 | Dry Out | Normal 4 | 80 | 830 | cube 566, ship 141, cube 124 | 13 | 60/26/4/4 | 6.1 | 127 | 100 |
| 5 | Base After Base | Hard 5 | 83 | 856 | cube 460, ship 140, cube 257 | 16 | 31/8/4/2 | 9.2 | 126 | 67 |
| 6 | Can't Let Go | Hard 6 | 79 | 824 | cube 480, ship 110, cube 234 | 3 | 36/5/5/8 | 10 | 127 | 71 |
| 7 | Jumper | Harder 7 | 85 | 884 | cube/ship x2 + cube (5 x 110-225) | 5 | 77/16/4/5 | 11.9 | 131 | 8* |
| 8 | Time Machine | Harder 8 | 95 | 983 | cube 355, ship 78, cube 484, ship 67 | 7 | 97/18/19/6 | 7.5 | 136 | 54 |

\* Jumper's 8 ms was the solver's route, not the level (DIFFICULTY.md).

## Per level [wiki], with songs

1. **Stereo Madness** -- Easy 1; song by ForeverBound. Introduces the cube and the ship (at the
   song's build-up). The only main level with no pads, orbs or special portals. In-game hint after
   two deaths on the first spike. Kept its rating in 1.9 when the others were lowered.
2. **Back On Track** -- Easy 2 (was Normal); DJVI. Introduces jump pads, first as help, later as
   fake pads. The wiki calls it "controversial" as the easiest level because the fake pads are hard
   for new players to learn.
3. **Polargeist** -- Normal 3 (was Hard); Step. Introduces yellow orbs, with an in-game hint.
   "Considerably harder" than Back On Track. The 3rd coin is notorious.
4. **Dry Out** -- Normal 4 (was Harder); DJVI. Introduces the gravity portal, with a calm
   upside-down part as a first taste.
5. **Base After Base** -- Hard 5 (was Harder); DJVI (unverified). Nothing new; the wiki says the
   community finds it "forgettable".
6. **Can't Let Go** -- Hard 6 (was Insane); DJVI. First pads and orbs while upside down. "Often
   considered the first major difficulty spike": tighter cube and orb timing, narrower ship.
7. **Jumper** -- Harder 7 (was Insane); song from 2005, artist unverified. Upside-down ship, more
   gravity parts. The only main level that uses the full song.
8. **Time Machine** -- Harder 8 (was Insane); Waterflame (unverified). Introduces the mirror
   portal. Frequent triples, an upside-down routine, ends under a gravity portal.

## What to learn from it (for GDLM low tiers)

- **One new thing per level**, introduced gently: pads (2), orbs (3), gravity (4), upside-down
  pads/orbs (6), mirror (8). The first appearance is calm (Dry Out's "chilled" gravity part, the
  in-game hints for orbs and the first spike). [wiki]
- **Fakes hurt at low tiers**: Back On Track's fake pads are why it is "controversial" as an Easy.
  Keep fakes out of Easy/Normal. [wiki]
- **Length doesn't grow with the tier.** Every level is 80-95 s and ~850 blocks; what grows is
  density, and rests drop. Rests go from 25 (Easy 1) to 3-7 (Hard 6 and up), and the first cube
  part goes from ~4 to ~10-12 hazards per 10 blocks. [measured]
- **Triples are rare low down**: 2-4 up to Hard 5, then 19 in Time Machine. Singles dominate
  everywhere. [measured]
- **Long, simple sections**: 2-4 sections, cube/ship alternating, ship parts of ~110-150 blocks.
  [measured]
- **The ship comes with the music**: Stereo Madness's first ship starts at the build-up. [wiki]
- **A level with nothing new gets called "forgettable"** (Base After Base): every level needs an
  idea of its own. [wiki, reporting community opinion]
- Numbers per tier for making levels: the "Tier ladder" section of DIFFICULTY.md.
- Next: `official_09-22.md` (Harder to Demon). Per-section check of a level against the community
  data: `node tools/tiercheck.js` (knowledge/README.md).
