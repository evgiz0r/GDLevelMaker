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
- `room`: free height per flying mode, counting blocks AND hazards, min and median in units
  (30 = a row). The user found GDLM 44's wave "slightly too difficult" with the same windows as the
  rest. It had 2 rows of room where the ship had 5.
- `touchesPerMin` (orbs, pads, portals the path touches), `switchesPerMin` (mode, gravity or
  speed changes) and `restsPerMin` (gaps of 1.5 s or more with no input). The knowledge session's
  91 community levels (knowledge/levels/low_tier_stats.md) say Hard differs from Normal mostly by
  this kind of density, not by tighter timing.

None of the extras are in the score yet; each rests on a level or two.

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

## Against the official levels (new physics, human route, widest moment, SIGMA 13, LAPSE 0.75 %)

| # | level | rating | covers | inputs | min ms | score | /min | your attempts |
|---|---|---|---|---|---|---|---|---|
| 1 | Stereo Madness | Easy 1 | 100% | 119 | 63 | 0.40 | 0.29 | 353 |
| 2 | Back On Track | Easy 2 | 100% | 111 | 100 | 0.36 | 0.27 | 39 |
| 3 | Polargeist | Normal 3 | 100% | 143 | 100 | 0.47 | 0.32 | 47 |
| 4 | Dry Out | Normal 4 | 100% | 127 | 100 | 0.42 | 0.31 | 64 |
| 5 | Base After Base | Hard 5 | 100% | 126 | 67 | 0.42 | 0.30 | 58 |
| 6 | Cant Let Go | Hard 6 | 100% | 127 | 71 | 0.42 | 0.32 | 150 |
| 7 | Jumper | Harder 7 | 100% | 131 | 58 | 0.45 | 0.31 | 173 |
| 8 | Time Machine | Harder 8 | 100% | 136 | 54 | 0.46 | 0.29 | 204 |
| 9 | Cycles | Harder 9 | 48% | 57 | 71 | 0.20 | 0.32 | 127 |
| 10 | xStep | Insane 10 | 64% | 71 | 17 | 0.83 | 0.97 | 114 |
| 12 | Theory of Everything | Insane 12 | 87% | 106 | 58 | 0.38 | 0.32 | 170 |
| 14 | Clubstep | Demon 14 | 16% | 29 | 42 | 0.15 | 0.64 | 1886 |
| 15 | Electrodynamix | Insane 12 | 24% | 33 | 100 | 0.11 | 0.30 | 560 |
| 16 | Hexagon Force | Insane 12 | 64% | 96 | 21 | 0.56 | 0.61 | 249 |
| 17 | Blast Processing | Harder 10 | 37% | 47 | 50 | 0.18 | 0.29 | 203 |
| 18 | Theory of Everything 2 | Demon 14 | 22% | 40 | 33 | 0.27 | 0.84 | 3258 |

Not listed: 11, 13 and 19-22. The sim covers under 10% of each (it dies early on things it gets
wrong). Where each stops is in `local/difficulty/NN.json`.

**Rank agreement over these 16:** score per minute vs stars **0.59**, vs your attempts 0.17. Stars
and your attempts agree with each other at 0.66, which is the bar.

What it gets right:
- **Insane and Demon stand apart.** xStep 0.97, ToE 2 0.84, Clubstep 0.64 and Hexagon Force
  0.61 per minute, against 0.27-0.32 for everything rated up to Harder. They have inputs with
  17-42 ms windows even after the widest-moment scan, and several tight ones in a minute.
- **It fits the player's attempts** on the levels they played (see the calibration above),
  including Jumper once the solver's needless 8 ms route was replaced.

What it gets wrong:
- **Easy to Harder all score about 0.3 per minute.** The official early levels are all about 120
  fair inputs at 1x, so lapses dominate and the timing term barely moves. They differ in how many
  inputs are fairly tight (100-150 ms; see the ladder below), and in reading and rhythm, which
  are not modelled.
  - `quickRecoveries` does not separate them either: every early level has 60-90 fast
    landing-to-press chains, all rhythmic. On GDLM 42 the chains were where all 8 of the
    player's deaths happened, so a chain is only hard when it is unexpected.
- **ToE (12) and Electrodynamix (12) look easy** in the covered part. ToE's hard parts are
  probably ones the sim mis-solves; Electrodynamix's sim stops at 24%.
- **Partial coverage and few runs.** The upper tiers rest on fragments. SIGMA and LAPSE rest on
  19 attempts, mostly on the mouse.

## Tier ladder (targets for making levels)

From the official levels the sim covers fully (1-8) or in good part (10, 16, 18), on the human
route. The player cannot yet playtest above Harder, so make levels low first. Each row is what
that tier's official levels look like, per minute of play, at 1x:

| tier | official | inputs/s | windows < 150 ms per min | windows < 100 ms per min | tightest window | tight (< 60 ms) | score per min |
|---|---|---|---|---|---|---|---|
| Easy | 1, 2 | 1.4 | ~19-20 | 0-2 | 63-100 ms | 0 | ~0.28 |
| Normal | 3, 4 | 1.6 | ~21-29 | 0 | 100 ms | 0 | ~0.31 |
| Hard | 5, 6 | 1.5-1.6 | ~25-32 | 2-3 | 67-71 ms | 0 | ~0.31 |
| Harder | 7, 8 | 1.4-1.5 | ~23-28 | 2-5 | 54-58 ms | 1 | ~0.30 |
| Insane | 10, 16 | 1.4-1.7 | (partial) | (partial) | 17-21 ms | 1-6 | 0.6-1.0 |
| Demon | 14, 18 | 2.0-2.1 | (partial) | (partial) | 33-42 ms | 1-4 | 0.6-0.9 |

Read it as rough guide rails, not a classifier:
- **Easy:** no window under ~60 ms, almost none under 100 ms.
- **Harder:** a few under 60 ms is fine.
- **Insane and up:** windows of 15-40 ms, several per minute, and a score of about 0.6+ per
  minute.

On the player's mouse runs: up to Harder they clear first try or in 2-5 attempts, and Insane
gets 70-90% on the first try.

## Check on community levels

`node tools/difficulty_community.js <id>:<tier> ...` scores levels fetched by
`tools/fetch_level.js` into `local/community/` (never committed). Four classic-era ones, cube/ship
at 1x:

| level | rated | windows < 150 ms /min | < 100 ms /min | tightest | score /min |
|---|---|---|---|---|---|
| Level Easy (11940) | Normal 3 | 26.3 | 2.1 | 50 ms | 0.30 |
| Back on Track RM (1244147) | Normal 3 | 26.9 | 3.0 | 67 ms | 0.29 |
| End Of Line (215705) | Normal 3 | 13.8 | 0 | 100 ms | 0.30 |
| Dreamland (150245) | Hard 4 | 22.3 | 0 | 100 ms | 0.21 |

The Normals sit in the ladder's Normal row. Dreamland, rated Hard, is no tighter than they are,
which fits "Hard = density, not tightness".

On the first pass Dreamland's tightest input came out at 4 ms: a ship release that the
widest-moment scan skipped. Flying presses and releases are now scanned too.

## Open (hand-off)

1. **Separate Easy to Harder.** They all score about 0.3 per minute. Next: put density
   (`touchesPerMin`, `switchesPerMin`, `restsPerMin`), `room` and surprise (an input that
   breaks the rhythm before it) into the score, and fit them on the player's runs and the
   community tiers.
2. **More real runs, on levels the sim covers fully.** Polargeist, Dry Out, Cant Let Go and
   Back On Track are the best. Keep mouse and keyboard apart (`--device`).
   - Loop: record → `node tools/runs.js <files> --join --level N --device mouse` →
     `node tools/difficulty_fit.js` → update SIGMA and LAPSE.
3. **Unexpected land-and-jump chains.** These were all 8 of the player's GDLM 42 deaths, but
   rhythmic chains are fine (every early official level has 60-90). Needs a rhythm or surprise
   measure to tell them apart.
4. **Coverage.** 6 official levels are under 10% in the sim (`local/difficulty/NN.json` says
   where each stops). Each physics fix: re-run `node tools/difficulty_solve.js N`, one at a time.
5. **One copy of the window code.** `lib/sync.js` has its own (stricter) press windows; merge them.
6. **Ratings are from memory** (tools/difficulty.js RATED). Check them against the game.

Data: everything is in the shared `local/`:
- `difficulty/NN.json`: cached official solutions;
- `difficulty/report*.txt`: reports;
- `difficulty/user_stats.json`: save stats;
- `runs/*.json`: the player's attempts;
- `difficulty/community.jsonl`: community scores.

## Viewer

The input shows under the ground like morse code: a lit bar while the button is held, a tick at
each press, a blue band for each click's window, and a HOLD/up light with how long. The player's
real deaths (from `tools/runs.js --level N`) are red ✖ marks with their %. The camera follows a
flying player inside its corridor.
