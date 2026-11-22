# Difficulty: what it means here and how it is measured

`lib/difficulty.js` scores a level from a solution (its inputs). `tools/difficulty.js` prints the
score for your own `.gdlvl` files, or for the official levels next to their in-game ratings.

```
node tools/difficulty.js levels/gdlm_05_x.gdlvl      # one level: score, then every input's window
node tools/difficulty_solve.js 7                      # cache a solution of official level 7 (ONE at a time, ~800 MB)
node tools/difficulty.js                              # all cached official levels vs their ratings
```

## The measure

A level is hard when you have to get many inputs right in one go, and some of them leave very
little room. So the score is a timing model:

1. **Window per input.** How much earlier or later than the solver's moment the input can come and
   the run still lives. On cube-only levels the exact solver gives this already: the run of steps
   where the same number of presses still beats the level. For everything else (ship, and any
   level the sweep solver does) `measureWindows` shifts one input at a time by d steps and replays.
   After a mistimed input the player holds it for at least 67 ms (no superhuman correction). Then a
   short look-ahead search tries every input at 60 fps frame boundaries. If any continuation lives
   0.5 s past the next input, d is inside the window. The search goes up to 200 ms each way, so
   the widest window it reports is 400 ms.
2. **Chance per input.** A player's timing error is normal with spread `SIGMA`. Hitting a window of
   w ms has chance p = erf(w/2 / (SIGMA·√2)).
3. **Score** = log10 of the expected attempts to beat the level in one go, -Σ log10 p.
   1.0 ≈ 10 attempts, 2.0 ≈ 100. Tight inputs dominate it; many loose ones add a little; length
   adds through the number of inputs. Also reported: `practiceDeaths` = Σ (1/p - 1), the expected
   deaths to clear the level in practice mode, where each input is retried from just before it.

The tool also reports, as context next to the score:

- **inputs, inputs/s, busiest 5 s.** Clicks per second and input changes. On their own they
  measure effort, not difficulty: a ship hold is one input that can last seconds.
- **tight, streak.** Inputs under 60 ms, and the longest run of them less than 0.6 s apart
  (consistency).
- **ship gap.** The free height around the ship's path (nearest hazard above plus below), min
  and median, in units (30 = one block). Blocks do not count: the ship slides on them.
- **look-ahead.** Seconds between an obstacle coming on screen and reaching the player, at the
  speeds the inputs happen at. This assumes 420 units visible ahead, which is not measured yet.
  Reaction time is almost the same for every level at a given speed, so it is a constant, not a
  separate score.
- **hiding.** Move, alpha, toggle, spawn, rotate and follow triggers in the part played. The sim
  ignores triggers, so these are the parts a player cannot read in time, or that the sim gets
  wrong. Memory levels show up here, not in the score.

## Calibration: SIGMA = 12 ms

The user's recording `Geometry Dash 2026-11-22 17-26-36.mp4` shows "cube timings" (examples/)
beaten in **normal mode on attempt 5**. The exact solver gives its 12 inputs windows of 21-279 ms
(median 46). The score matches 5 attempts at SIGMA = 12 ms:

| SIGMA ms | 10 | 12 | 13 | 15 | 17 | 20 | 30 |
|---|---|---|---|---|---|---|---|
| expected attempts | 3 | **5** | 7 | 13 | 26 | 72 | 1764 |

12 ms is in the range of how far skilled tappers' presses stray from a beat they know. The user
made the level and had seen it, so a player new to it would be slower: first tries add learning
deaths, which this model does not have. One data point. More runs in normal mode with the attempt
counter visible would pin it down.

## Against the official levels (2026-11-22, after the object table update)

`node tools/difficulty.js`, SIGMA 12. "Covers" is how far the sim gets. Most levels stop at a mode
it does not simulate yet (ball, UFO, wave), or at a hazard it gets wrong. "/min" is the score per
minute of the part covered, so a partial level can be compared with a whole one.

| # | level | rating | covers | inputs | tight | min ms | score | /min |
|---|---|---|---|---|---|---|---|---|
| 1 | Stereo Madness | Easy 1 | 100% | 46 | 0 | 63 | 0.00 | 0.00 |
| 2 | Back On Track | Easy 2 | 35% | 18 | 1 | 38 | 0.05 | 0.12 |
| 3 | Polargeist | Normal 3 | 100% | 94 | 4 | 25 | 0.38 | 0.26 |
| 4 | Dry Out | Normal 4 | 100% | 69 | 0 | 121 | 0.00 | 0.00 |
| 5 | Base After Base | Hard 5 | 100% | 80 | 3 | 33 | 0.13 | 0.09 |
| 6 | Cant Let Go | Hard 6 | 23% | 27 | 2 | 38 | 0.07 | 0.21 |
| 7 | Jumper | Harder 7 | 100% | 101 | 3 | 21 | 0.37 | 0.26 |
| 8 | Time Machine | Harder 8 | 100% | 101 | 4 | 17 | 0.39 | 0.25 |
| 9 | Cycles | Harder 9 | 36% | 29 | 0 | 63 | 0.01 | 0.03 |
| 12 | Theory of Everything | Insane 12 | 26% | 29 | 1 | 38 | 0.06 | 0.16 |
| 14 | Clubstep | Demon 14 | 16% | 27 | 4 | 8 | 0.67 | 2.86 |
| 15 | Electrodynamix | Insane 12 | 24% | 25 | 3 | 21 | 0.40 | 1.12 |
| 16 | Hexagon Force | Insane 12 | 18% | 24 | 1 | 13 | 0.40 | 1.45 |
| 17 | Blast Processing | Harder 10 | 13% | 16 | 1 | 38 | 0.05 | 0.25 |
| 18 | Theory of Everything 2 | Demon 14 | 15% | 25 | 6 | 21 | 0.46 | 2.05 |

Left out: 10, 11, 13 and 19-22. The sim covers under 10% of each, dying early on something it
does not model yet, so there is nothing to score.

**Rank agreement with the stars (Spearman) over these 15: 0.71 for score per minute, 0.66 for the
score.** Inputs per second alone gets 0.28 over all 22, and the tightest window alone gets about 0.
The demons and the hard insanes (Clubstep, ToE 2, Hexagon Force, Electrodynamix) stand clearly
apart, at 1.1-2.9 per minute against 0.3 or less for everything up to Harder.

What it gets right:
- Easy and Normal score near zero, and the step up to demon is large, as it is in the game.
- It finds where a level is hard. Clubstep's first part has an 8 ms window and ToE 2's has six
  tight inputs in a row-ish (streak 3). Per-input windows are listed by
  `node tools/difficulty.js x.gdlvl`.
- On the user's own level it predicts the attempts they took, once SIGMA is fitted to that.

What it gets wrong, and why:
- **Dry Out scores 0 (rated 4), Cycles 0.01 (rated 9), Blast Processing 0.05 (rated 10).** The
  solver finds the route with the fewest presses, and it is often not the route people play. It
  holds the button through whole sections, letting the cube jump again on each landing, skips
  orbs, and rides ceilings. When such a route has wide windows, the level scores easy. The user
  flagged Cycles at 7.89 s as looking wrong, and it is one of these held routes. Scoring the route
  a person plays would need a solver that prefers clicks on orbs and beats. A "human route" option
  is not built yet.
- **Reading and memory are not in the score.** The sim ignores triggers, and hidden or moving
  parts only show up as the "hiding" count (Fingerdash 17, Dash 15, in the first few percent
  alone). Pattern Seeker-style memory levels would score as easy.
- **Ship difficulty is under-scored.** The look-ahead lets a mistimed ship input be corrected
  after 67 ms, which is generous. Ship gaps are reported (Jumper's narrowest is 37 units, about
  1.2 blocks) but are not part of the score.
- **Practice versus attempts.** The model assumes each input is independent, with no learning
  and no nerves late in a run. In practice mode the user's Clutterfunk took about 10 deaths and
  Deadlocked about 33, mostly in wave parts. The sim cannot score those parts yet, so they are
  not a check of the model.
- **SIGMA rests on one data point** (cube timings in 5 attempts). The ratings themselves are
  from memory of the game's level list.

## Where each official level stops in the sim

These stops are physics work, not difficulty work: 2 Back On Track spike at block 306, 6 Cant
Let Go spike at 204, 11 Clutterfunk block at ~100, 12 ToE spike, 13 Electroman block, 14 Clubstep
"sky", 15 Electrodynamix saw, 19 Geometrical Dominator, 20 Deadlocked, 21 Fingerdash and 22 Dash
all spike at 1-3%. The rest stop at a mode that is not simulated yet. The solutions are cached in
`local/difficulty/` and show in the viewer as "official N".

## Viewer

The viewer draws the input under the ground, like morse: a lit bar while the button is held, a
white tick at each press, and a blue band for each click's timing window. A light in the top
right shows HOLD/up and for how long. The trail turns yellow while the button is held.
