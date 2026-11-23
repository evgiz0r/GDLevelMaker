# Official levels 9-22 (Cycles -> Dash): Harder, Insane and Demon

The rest of the official ramp, after `official_01-08.md`. For GDLM this is the "later" part (the
user can't playtest above Harder yet), but it shows how the game adds difficulty past Harder and
how its level style changed from 1.x to 2.2. Three kinds of facts, kept apart:
- **[wiki]**: Geometry Dash Fandom wiki, *Main Levels*
  (https://geometry-dash.fandom.com/wiki/Main_Levels, wikitext read via its api.php on 2026-11-23).
  The wiki's difficulty field is a template, so the ratings come from DIFFICULTY.md.
- **[measured]**: `node tools/style.js N --detail` and `node tools/tiercheck.js official N --brief`
  on the game install (2026-11-23).
- **[difficulty]**: the DIFFICULTY.md table (solver route; "covers" = how much of the level the
  sim gets through).

Song artists marked "unverified" are from memory, not the wiki.

## Measured side by side [measured] [difficulty]

| # | level | rating | ver | s | sections | modes | speeds | rests 6+ | H-like | inputs | min ms | covers |
|---|---|---|---|---:|---:|---|---|---:|---:|---:|---:|---:|
| 9 | Cycles | Harder 9 | 1.2 | 78 | 5 | cube ball ship | 1x | 6 | 44% | 108 | 63 | 100% |
| 10 | xStep | Insane 10 | 1.3 | 80 | 8 | cube ball ship | 1x | 1 | 90% | 115 | 17 | 100% |
| 11 | Clutterfunk | Insane 11 | 1.4 | 95 | 5 | cube ship ball | 1x | 11 | 61% | 158 | 42 | 100% |
| 12 | Theory of Everything | Insane 12 | 1.5 | 82 | 12 | + ufo | 1x | 9 | 67% | 112 | 58 | 100% |
| 13 | Electroman Adventures | Insane 10 | 1.6 | 84 | 12 | + ufo | 1x | 5 | 74% | 137 | 8 | 100% |
| 14 | Clubstep | Demon 14 | 1.6 | 86 | 14 | + ufo | 1x | 1 | 100% | 161 | 33 | 100% |
| 15 | Electrodynamix | Insane 12 | 1.7 | 80 | 14 | + ufo | 1x 2x 3x | 6 | 76% | 132 | 25 | 100% |
| 16 | Hexagon Force | Insane 12 | 1.8 | 87 | 12 | + ufo | 0.5x 1x 2x | 19 | 44% | 136 | 63 | 100% |
| 17 | Blast Processing | Harder 10 | 1.9 | 98 | 12 | + wave | 1x | 9 | 58% | 120† | 25† | 79% |
| 18 | Theory of Everything 2 | Demon 14 | 1.9 | 88 | 18 | + wave | 0.5x 1x 2x | 13 | 68% | 92* | 13* | 56% |
| 19 | Geometrical Dominator | Harder 10 | 2.0 | 96 | 14 | 6, + robot | 0.5x 1x 2x | 30 | 31% | 115† | 33† | 100% |
| 20 | Deadlocked | Demon 15 | 2.0 | 99 | 25 | 6 | 0.5x-3x | 4 | 75% | 55† | 25† | 37% |
| 21 | Fingerdash | Insane 12 | 2.1 | 84 | 12 | 6, + spider | 1x 2x | 5 | 95% | - | - | 5% |
| 22 | Dash | Harder 10 | 2.2 | 62 | 21 | 7, + swing | 0.5x-3x | 10 | 74% | 24* | 21* | 24% |

- **H-like**: the share of the level's blocks whose sections look like rated Hard/Harder
  community sections rather than Easy/Normal ones (`tools/tiercheck.js`, layout only). For
  comparison, official 1-4 give 15-28%, Can't Let Go 69%, Jumper 58% and Time Machine 61%.
- \* = partial (the sim stops before the end; see "covers"), so not comparable.
- † = inputs and min ms from the old route (before physics 7924db0, 2026-11-23), not re-measured.
  Under the corrected wave rules (it dies sliding off a block's end or flying head-on into a slope,
  both seen in the user's GDLM 44 deaths) the sim stops in Blast Processing at block 807.7 (79%; the
  old "beaten" route did both). It now beats Geometrical Dominator (was 89%) and reaches 37% of
  Deadlocked (was 26-31%, now taking every portal). See PHYSICS.md "Wave" and "The intended route".
- **Static layout caveat**: from 2.0 on (19-22) the levels move objects with triggers (36, 62, 177
  and 235 move triggers). Their layout numbers describe the editor's view, not the play.
- Section lengths per level, in blocks (from `style.js`):
  - Cycles: cube 303, ball 147, ship 138, cube 18, ball 203.
  - xStep: cube/ball/ship parts of 66-154 blocks, 8 sections.
  - Clutterfunk: cube 289, ship 71, ball 169, ship 143, cube 311.
  - Clubstep: one 233-block cube part, then 13 parts of 19-85 blocks.
  - Electrodynamix: 1x only for the first 79 blocks, then 2x, then 3x for the whole last third.
  - Deadlocked: 25 sections, many of 16-30 blocks.
  - Dash: 21 sections, several under 10 blocks.

## Per level [wiki]

9. **Cycles** (Harder 9, was Insane before 1.9; DJVI, unverified). Introduces the ball. Pads,
   orbs and gravity portals are used lightly. The first cube part has misleading pads and orbs and
   many triples, and the ship part flips gravity rapidly. One cube stretch needs no input at all.
10. **xStep** (Insane 10; DJVI, unverified). Introduces block designs, pulsing decoration, and the
    blue gravity pad and orb. Mode changes are "much more frequent" than before: cube, ball and
    ship get used about evenly.
11. **Clutterfunk** (Insane 11; Waterflame, unverified). Introduces saws and the size (mini)
    portal, with mini parts for every mode. The cube parts get harder and harder (mini plus many
    pads and orbs plus gravity changes), and the ship parts are "less spacious".
12. **Theory of Everything** (Insane 12; dj-Nate, unverified). Introduces the pink pad and orb,
    and the UFO, including mini UFO. The ship and UFO parts have dangerous alternate paths, with the
    right one marked by pulsing arrows.
13. **Electroman Adventures** (Insane 10; Waterflame, unverified). Introduces breakable blocks.
    Many mode changes in the middle, but "much of the actual gameplay is easier" than the levels
    before it. Before 1.7 it was rated Harder: the only level whose rating was later raised.
14. **Clubstep** (Demon 14; dj-Nate, unverified). The first official demon. Tight spaces, little
    time to react and "deceptive obstacles". Introduces fake spikes, fading spikes and fading
    blocks, often mixed so the fakes are hard to tell apart. Dangerous orbs, a lot of gravity
    flipping. Locked behind 10 secret coins.
15. **Electrodynamix** (Insane 12; dj-Nate, unverified). Introduces speed portals (2x and 3x).
    The level gets harder as it speeds up, especially ship parts in tight passages at speed. The
    first upside-down UFO part is hard straight away, "with no lower introductory difficulty". Also
    the first new background.
16. **Hexagon Force** (Insane 12; Waterflame, unverified). Introduces slopes and the dual portal.
    Dual ship is symmetric, so you can watch one icon. Dual cube and dual ball are not, so you
    must watch both, with orbs. Pulsing arrows sometimes cue the jumps. Also introduces the 1x and
    0.5x speed portals. 73% of its length is at 2x.
17. **Blast Processing** (Harder 10; Waterflame, unverified). Introduces the wave "in spacious
    sequences" and 3D decoration. Almost no gravity, size or speed portals (only 7 in total). The
    longest official level, at 102 s.
18. **Theory of Everything 2** (Demon 14; dj-Nate, unverified). Introduces fading saws, invisible
    slopes and fake slopes, so many parts need "memory and accuracy". The first mini wave. Its
    78-82% ship is "widely known as the hardest individual section of any official level". Locked
    behind 20 coins.
19. **Geometrical Dominator** (Harder 10; Waterflame, per the wiki). Introduces the robot and the
    2.0 triggers: alpha, move, pulse and toggle. Also monsters, animated thorns, water, in-game
    text, and a memory section where glowing stars show the way. That section is "widely
    considered" its hardest part. The robot is its most used mode.
20. **Deadlocked** (Demon 15; F-777, per the wiki). Introduces the green orb, teleport portals,
    keys and keyholes, the wave under gravity portals, and a "boss fight" at 64% (trigger-built
    "laser-shooting monsters"). Many players call it the hardest official level, "some calling it
    a Medium Demon". Locked behind 30 coins.
21. **Fingerdash** (Insane 12; MDK, per the wiki). Introduces the spider, drop orbs, green and
    pink dash orbs, red pads and orbs, rotating objects and lasers. A "Hold To Dash" text appears
    after a death on the first dash orb (an on-death trigger). No ball part.
22. **Dash** (Harder 10; MDK, per the wiki). Introduces the swing, the purple spider orb, a fully
    customised camera, arrow/reverse triggers (changing direction), shaders and the end trigger.
    No UFO part.

## What it says

- **Past Harder, the game adds new mechanics, not just density.** Each level brings 2-6 new
  things, against 1 per level in 1-8. The new things are mini (11), pink orbs and UFO (12), fakes
  (14), speed (15), dual (16), wave (17), invisible and fake slopes (18), robot and triggers (19),
  teleports (20), spider and dash orbs (21), swing and camera (22). [wiki]
- **Sections get shorter and modes change faster.** 1-8 have 2-5 sections of 110-480 blocks. 9-11
  still have 5-8, but from 12 on it is 12-25 sections of 20-150 blocks. The same trend shows in
  the community data (`low_tier_stats.md`: modern levels change every 3-7 s). [measured]
- **Layout alone does not see the upper tiers.** Electroman (Insane), Hexagon Force (Insane) and
  Geometrical Dominator (Harder) all look about as "Hard-like" as Time Machine, while xStep and
  Clubstep are 90-100%. The timing windows separate them (xStep 17 ms, Electroman 8 ms -- possibly the
  solver's route, like Jumper's 8 ms -- Clubstep 33 ms with 5 tight inputs; DIFFICULTY.md has the timing score). [measured] [difficulty]
- **The ratings are not monotonic in the level number.** Electroman (10) comes after ToE (12),
  Electrodynamix (12) after Clubstep (14), and Blast Processing and GD (10) after ToE 2 (14). The
  game alternates hard and easier levels, and the easier ones are where a new mode is introduced
  "spaciously" (Blast Processing's wave). [wiki]
- **Readability cues are part of the design**: pulsing arrows mark the right path (ToE,
  Hexagon Force), stars show the way through a memory part (GD), text appears after deaths
  (Fingerdash, and Stereo Madness and Polargeist earlier). [wiki]
- **Fakes and invisibility come in only at Demon** (Clubstep, ToE 2), and still with cues. That
  fits design.md "invisible parts need a cue". [wiki]
- **What gets remembered as hardest is a single section** (ToE 2's ship, Deadlocked's boss fight,
  GD's memory part). It matches the community complaint about late spikes (`players_say.md`).
  [wiki]

## For GDLM

- When GDLM goes past Harder: introduce one new mechanic per level, in a spacious first section
  (as Blast Processing does with the wave), with a cue (arrows, stars or text) where the path is
  not obvious.
- Use the timing ladder (DIFFICULTY.md) to tell Insane from Harder. Don't rely on layout density.
