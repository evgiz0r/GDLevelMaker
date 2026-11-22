# Difficulty: what it means here and how it is measured

`lib/difficulty.js` scores a level from a solution (its inputs). `tools/difficulty.js` prints the
score for your own `.gdlvl` files, or for the official levels next to their in-game ratings and
the player's own attempts. `tools/runs.js` reads the player's real deaths from a screen recording.

```
node tools/difficulty.js levels/gdlm_05_x.gdlvl      # one level: score, then every input's window
node tools/difficulty_solve.js 7                      # cache a solution of official level 7 (ONE at a time, ~800 MB)
node tools/difficulty.js                              # all cached official levels vs ratings and your attempts
node tools/save_stats.js                              # your lifetime attempts per official level (save, read-only)
node tools/runs.js <rec.mkv> [...] --join --level 7 --device mouse   # your deaths in a recording
```

## The measure

A level is hard when you must get many inputs right in one go and some leave little room.

1. **The route a person plays.** The solver finds the fewest presses, which often means holding
   through a whole staircase (the cube jumps again on each landing). `humanize()` turns every
   cube-mode hold into one tap per jump or orb it caused. A tap keeps the button down about
   100 ms (assumed), so a press a little before landing still jumps. Each change is kept only if
   a replay gets as far. Ship and dash-orb holds stay. The viewer shows this route.
2. **Window per input.** How much earlier or later the input can come and the run still lives.
   It is measured by shifting the input and replaying. After a mistimed input the player holds
   it at least 67 ms. A short look-ahead then tries any inputs at 60 fps frame boundaries, and
   the shift is inside the window if some continuation lives 0.5 s past the next input. The
   search goes up to 200 ms each way. On cube-only levels this matches the exact solver's
   windows, or is narrower.
3. **Chance per input** = (1 - LAPSE) · erf(w/2 / (SIGMA·√2)). SIGMA is the spread of the
   player's timing error. LAPSE is the chance of fluffing an input whatever its window: a
   misread, a slip, a late reaction.
4. **Score** = log10 of the expected attempts to beat the level in one go, -Σ log10 p
   (1.0 ≈ 10 attempts). `/min` is the same per minute of the part the sim covers.
   `practiceDeaths` = Σ (1/p - 1).

Reported beside the score:
- inputs and inputs/s;
- tight inputs (under 60 ms) and the longest streak of them;
- ship gap (free height around the ship's path);
- hiding triggers (move, alpha, toggle and spawn triggers the sim ignores: memory parts);
- `quickRecoveries`: presses whose window closes under 150 ms after a landing.

## Calibration on the player's own runs

`tools/runs.js` reads GD's progress bar from a recording. It finds every normal-mode attempt and
the % where it ended, tells levels apart by how fast the % rises, and ignores other windows. It
takes about 6 s for 3 minutes of video. Runs from 2026-11-22:

| level | device | attempts | ended at |
|---|---|---|---|
| cube timings (examples/) | keyboard | 5 | ~57, 15, 45, 12 blocks; beaten |
| Base After Base | keyboard | 5 | 21.4, 19.1, 67.4, 2.9 %; beaten |
| Stereo Madness | mouse | 1 | beaten |
| Time Machine | mouse | 1 | beaten |
| Electroman Adventures | mouse | 1 | beaten |
| Jumper | mouse | 2 | 58.8 %; beaten |
| Hexagon Force | mouse | 2 | 44.6, 89.6 % |
| Blast Processing | mouse | 1 | 79.4 % |
| Geometrical Dominator | mouse | 1 | 72.0 % |
| GDLM 42 (style session) | mouse | 8 | all 7-14 %, not beaten |

`node tools/difficulty_fit.js` fits both numbers by maximum likelihood on every recorded attempt
(19 attempts on 9 levels; an attempt that died at x% passed every input before x% and failed the
next). It gives **SIGMA = 13 ms, LAPSE = 0.75 %**, which predicts cube timings 5.6 attempts
(real 5), Jumper 2.8 (2), Base After Base 2.6 (5), Stereo Madness 2.5 (1) and Time Machine 2.9 (1).

Tight inputs get the widest working moment, not the solver's. The sweep's route can be needlessly
tight: at Jumper's 76% it lands on a slab corner past a spike, an 8 ms window, while the usual
route has about 117 ms (found by the physics session). An input under 60 ms is rescanned over
±200 ms. A moment counts only if the press there jumps or uses an orb, since a press that does
nothing plus a re-press is not a route. The widest stretch that lives becomes the window.
Jumper went from 25 expected attempts to 2.4. Earlier, with no lapse term, Base After Base came out at
1 attempt: all four deaths there were where the windows are 108-400 ms. They were lapses, not
timing misses.

`tools/save_stats.js` reads the player's lifetime attempts per official level from the save
(read-only, kept in `local/`). All 22 are beaten; Clubstep took 1886 attempts, ToE 2 3258 and
Deadlocked 3951. The others took 39-560. The game writes the save only now and then, so a
session's attempts show up there late.

## Against the official levels (new physics, human route, SIGMA 10.5, LAPSE 0.65 %; before the widest-moment fix, rerun pending)

| # | level | rating | covers | inputs | min ms | score | /min | your attempts |
|---|---|---|---|---|---|---|---|---|
| 1 | Stereo Madness | Easy 1 | 100% | 119 | 63 | 0.34 | 0.24 | 353 |
| 2 | Back On Track | Easy 2 | 100% | 111 | 100 | 0.31 | 0.23 | 39 |
| 3 | Polargeist | Normal 3 | 100% | 143 | 100 | 0.40 | 0.27 | 47 |
| 4 | Dry Out | Normal 4 | 100% | 127 | 100 | 0.36 | 0.27 | 64 |
| 5 | Base After Base | Hard 5 | 100% | 126 | 67 | 0.36 | 0.26 | 58 |
| 6 | Cant Let Go | Hard 6 | 100% | 127 | 71 | 0.36 | 0.27 | 150 |
| 7 | Jumper | Harder 7 | 100% | 131 | 8 | 1.39 | 0.98 | 173 |
| 8 | Time Machine | Harder 8 | 100% | 136 | 54 | 0.39 | 0.25 | 204 |
| 9 | Cycles | Harder 9 | 48% | 57 | 71 | 0.16 | 0.26 | 127 |
| 10 | xStep | Insane 10 | 64% | 71 | 8 | 1.04 | 1.22 | 114 |
| 12 | Theory of Everything | Insane 12 | 87% | 106 | 17 | 0.56 | 0.47 | 170 |
| 14 | Clubstep | Demon 14 | 16% | 29 | 8 | 0.67 | 2.86 | 1886 |
| 15 | Electrodynamix | Insane 12 | 24% | 33 | 100 | 0.09 | 0.26 | 560 |
| 16 | Hexagon Force | Insane 12 | 64% | 96 | 21 | 0.44 | 0.48 | 249 |
| 17 | Blast Processing | Harder 10 | 37% | 47 | 50 | 0.14 | 0.23 | 203 |
| 18 | Theory of Everything 2 | Demon 14 | 22% | 40 | 13 | 0.55 | 1.69 | 3258 |

Not listed: 11, 13 and 19-22, where the sim covers under 10% (it dies early on things it gets
wrong). Where each one stops is in `local/difficulty/NN.json`.

**Rank agreement over these 16:** score per minute vs stars **0.57**, and vs your attempts 0.28.
For comparison, the stars vs your attempts agree at 0.66. Earlier, on the old physics without
the human route or lapse, it was 0.71 vs stars on 15 levels. That number was flattered by solver
routes that skipped parts.

What it gets right:
- The demons stand apart, as they do in the game: Clubstep 2.9 per minute, ToE 2 1.7, and xStep
  1.2, against about 0.25 for everything up to Harder.
- It locates hard spots. Clubstep's and xStep's 8 ms inputs are listed with their time by
  `node tools/difficulty.js x.gdlvl`.
- On the player's runs, both terms are needed and fit: timing alone for cube timings, lapses for
  long fair levels.

What it gets wrong:
- **Easy to Harder all score the same (~0.25/min).** With the human route, every early level is
  about 120 fair inputs, and the lapse term just counts inputs. What separates Stereo Madness
  from Time Machine for a person is speed, reading and rhythm, and none of that is modelled yet.
  Candidates:
  - look-ahead time (blocks on screen ÷ speed);
  - surprise (an input that breaks the beat or the pattern before it);
  - quick land-and-jump chains (`quickRecoveries`). These were where all 8 of the player's deaths
    on GDLM 42 happened. But Jumper has 81 of them, rhythmic staircases, and the player cleared it
    in 2 attempts, so a chain is only hard when it is unexpected.
- **Jumper's 8 ms inputs were the solver's route, not the level.** Fixed with the widest-moment
  scan above. The table still shows the old numbers (1.39 / 0.98).
- **Partial coverage.** 6 of 22 levels are under 10% in the sim, and many more stop at a mode or
  hazard it gets wrong, so the ranks rest on fragments of the harder levels.
- **Few runs.** SIGMA and LAPSE rest on four levels, two of them on the keyboard. Mouse and
  keyboard should get their own fits once there are enough runs.

## Viewer

The input shows under the ground like morse code: a lit bar while the button is held, a tick at
each press, a blue band for each click's window, and a HOLD/up light with how long. The player's
real deaths (from `tools/runs.js --level N`) are red ✖ marks with their %. The camera follows a
flying player inside its corridor.
