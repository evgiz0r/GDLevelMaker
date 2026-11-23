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
4. **The route a player picks** (`easierRoute()`, the user: "when there is a hard timing, we
   avoid it ... if the timing is easier (the orb), it should usually be the path"). Around every
   tight input (under 60 ms; cube, ball, UFO, robot, spider -- not the steering modes) it tries
   about 2300 other routes over 1.5 s before to 1.2 s after:
   - drop the input, or move it up to 600 ms;
   - add one tap anywhere (an orb the solver skipped);
   - drop it and tap once or twice in its place (a jump and an orb onto a platform).
   A route counts only if every new tap does something (a jump or an orb) and the run lands back
   on the original path within 2 s. One candidate per distinct sequence of jumps and orbs is then
   judged by its **joint chance**: every input on the stretch gets its own timing error at once
   (normal, SIGMA), none is re-planned, 200 seeded samples, the same draws for every route. It
   must beat the original by 0.02 in log10 attempts, and so must the usual windows. The joint
   chance is what stops fake routes. An early jump, then a held press that jumps again on landing,
   has a wide window for each input alone, but the landing spot hangs on the first jump, so
   together they are as tight as the jump they replace. `tests/route_choice.js` has that case, a
   real orb route over a triple spike (0.039 -> 0.007) and a lone spike that keeps its jump.
   `node tools/difficulty_route.js <n | file | community id>` shows a level with and without it.
   The report writes the chosen route into `local/official_NN.json`, so the viewer replays it.
5. **Score** = log10 of the expected attempts to beat the level in one go, -Σ log10 p
   (1.0 ≈ 10 attempts). `/min` is the same per minute of the part the sim covers.
   `practiceDeaths` = Σ (1/p - 1).

Reported beside the score:
- inputs and inputs/s;
- tight inputs (under 60 ms) and the longest streak of them;
- ship gap (free height around the ship's path);
- hiding triggers (move, alpha, toggle and spawn triggers the sim ignores: memory parts);
- `quickRecoveries`: presses whose window closes under 150 ms after a landing.
- `forcedAfterSwitch`: inputs whose window closes under 250 ms (`SETTLE`, assumed) after a mode,
  gravity or speed change; `afterSwitchMs` per input. From the physics session: in GDLM 44 the
  user died 2 of 2 at a wave entrance whose window is 92 ms. The cube lands on a block and takes
  the portal at its end, and unless the wave is held within ~13 ticks it slides off and dies. The
  window is not small; it starts at the mode change, before the player has settled.
  `node tools/press_window.js <level> --x X --y Y --hold-to X2 --to X3` (physics session) gives the
  press window from any spot.
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

## Against the official levels (physics 1503b03 with triggers, the player's route, SIGMA 13, LAPSE 0.75 %)

Solved into the shared `local/` and tagged with their physics commit (`tools/difficulty_solve.js`);
9, 10, 17, 19, 20 and 22 come from the physics session's runs. 18 of 22 are now beaten in the sim.

| # | level | rating | covers | inputs | tight | min ms | score | /min | your attempts |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Stereo Madness | Easy 1 | 100% | 119 | 0 | 63 | 0.40 | 0.29 | 353 |
| 2 | Back On Track | Easy 2 | 100% | 111 | 0 | 100 | 0.36 | 0.27 | 39 |
| 3 | Polargeist | Normal 3 | 100% | 142 | 0 | 100 | 0.46 | 0.31 | 47 |
| 4 | Dry Out | Normal 4 | 100% | 127 | 0 | 100 | 0.42 | 0.31 | 64 |
| 5 | Base After Base | Hard 5 | 100% | 126 | 0 | 67 | 0.42 | 0.30 | 58 |
| 6 | Cant Let Go | Hard 6 | 100% | 127 | 0 | 71 | 0.42 | 0.32 | 150 |
| 7 | Jumper | Harder 7 | 100% | 131 | 1 | 58 | 0.45 | 0.31 | 173 |
| 8 | Time Machine | Harder 8 | 100% | 136 | 1 | 54 | 0.46 | 0.29 | 204 |
| 9 | Cycles | Harder 9 | 100% | 108 | 0 | 63 | 0.37 | 0.28 | 127 |
| 10 | xStep | Insane 10 | 100% | 115 | 6 | 17 | 0.88 | 0.66 | 114 |
| 11 | Clutterfunk | Insane 11 | 100% | 159 | 1 | 42 | 0.58 | 0.37 | 456 |
| 12 | Theory of Everything | Insane 12 | 100% | 112 | 3 | 58 | 0.40 | 0.29 | 170 |
| 13 | Electroman Adventures | Insane 10 | 100% | 137 | 1 | 54 | 0.48 | 0.34 | 285 |
| 14 | Clubstep | Demon 14 | 100% | 161 | 5 | 33 | 0.78 | 0.55 | 1886 |
| 15 | Electrodynamix | Insane 12 | 100% | 132 | 3 | 25 | 0.73 | 0.51 | 560 |
| 16 | Hexagon Force | Insane 12 | 100% | 136 | 0 | 63 | 0.46 | 0.32 | 249 |
| 17 | Blast Processing | Harder 10 | 100% | 120 | 2 | 25 | 0.67 | 0.41 | 203 |
| 18 | Theory of Everything 2 | Demon 14 | 56% | 92 | 7 | 13 | 1.07 | 1.26 | 3258 |
| 19 | Geometrical Dominator | Harder 10 | 89% | 115 | 3 | 33 | 0.53 | 0.37 | 191 |
| 20 | Deadlocked | Demon 15 | 30% | 55 | 3 | 25 | 0.51 | 0.89 | 3951 |
| 21 | Fingerdash | Insane 12 | 5% | - | - | - | - | - | 296 |
| 22 | Dash | Harder 10 | 24% | 24 | 3 | 21 | 0.44 | 1.79 | 477 |

Fingerdash is left out: a sim bug stops it at block 55, being fixed by the physics session.

**Rank agreement over the other 21:**
- score per minute vs stars **0.70**;
- total score vs stars **0.63**;
- score per minute vs your attempts **0.64**.

Route choice (`easierRoute`, report6, 2026-11-23) changed two levels. Electroman's 8 ms UFO
tap became an extra flap 0.9 s later, which makes up for an off-time first one (1.08 -> 0.48).
Clutterfunk's 50 ms cube jump became two taps (0.60 -> 0.58). Before route choice it was 0.66 /
0.61 / 0.66. Every other tight input is ship, wave or swing steering, or had no easier route.

Stars vs your attempts is 0.73, the bar. Before the physics update, with most upper levels
partial, it was 0.59.

What it gets right:
- **The Insane and Demon levels score highest**, now over whole levels: xStep 0.88,
  Clubstep 0.78, Electrodynamix 0.73, ToE 2 1.07 (56%). Their tight inputs (under 60 ms) number
  3-7 per level, against 0-1 up to Harder.
- **It fits the player's attempts** on the levels they played (calibration above).

What it gets wrong:
- **Easy to Harder all score 0.36-0.46,** about 0.3 per minute. The layout model above separates
  them into two bands; timing does not.
- **Hexagon Force, ToE and now Electroman (Insane) score like Harder.** Route choice found easy
  routes in them, so their difficulty is elsewhere: parts the sim plays more easily than people
  do (dual, reading the UFO), surprise (Open 3) or density (Open 1).
- **Dash (24%) and Deadlocked (31%) per minute** rest on short covered fragments.

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
| Insane | 10, 11, 13, 15 | 1.4-1.7 | - | - | 8-42 ms | 2-6 | 0.4-0.8 |
| Demon | 14, 18, 20 | 1.6-1.9 | - | - | 13-33 ms | 3-7 | 0.55-1.3 |

Read it as rough guide rails, not a classifier:
- **Easy:** no window under ~60 ms, almost none under 100 ms.
- **Harder:** a few under 60 ms is fine.
- **Insane and up:** windows of 15-40 ms, several per minute, and a score of about 0.6+ per
  minute.

On the player's mouse runs: up to Harder they clear first try or in 2-5 attempts, and Insane
gets 70-90% on the first try.

## Telling Easy, Normal, Hard and Harder apart: layout

The timing score puts every tier up to Harder at about 0.3 per minute, so the tiers are told apart
by layout: `layout(w)` and `tierFromLayout()` in lib/difficulty.js. They read the level's objects
only, with no solving, so they are cheap.

`node tools/difficulty_tiers.js` measures 113 levels into `local/difficulty/layout.json`:
- official 1-22;
- the 91 rated community levels (`tools/community.js`, `local/community/`).

It then fits a linear model of the tier on 81 of them: official 1-8 and the community levels from
before 2.2. 2.2 levels move their gameplay with triggers, so their static layout is not what a
player meets.

Leave-one-out over those 81:
- Spearman **0.55**;
- exact tier **37 %**;
- **within one tier 89 %**.

Per tier, the medians:

| tier | n | lead-in after a portal (blocks) | columns with a hazard | hazards /10 blocks | orbs+pads /min | rests /min | s per section | portals /min |
|---|---|---|---|---|---|---|---|---|
| Easy | 20 | 9.6 | 49% | 9.4 | 25 | 8.7 | 6.4 | 17.3 |
| Normal | 20 | 8.7 | 46% | 7.3 | 25 | 14.4 | 9.2 | 8.6 |
| Hard | 21 | 2.3 | 79% | 21.3 | 39 | 5.0 | 5.1 | 18.4 |
| Harder | 16 | 2.8 | 78% | 18.0 | 66 | 5.0 | 4.1 | 25.4 |

**What it shows:**
- **There are two bands, not four.** Easy/Normal have room after portals (~9 blocks), hazards in
  under half the columns, and long sections. Hard/Harder start hazards at the portal (~2-3
  blocks), fill ~80% of the columns, and have twice the hazards. That is the step the model sees
  clearly.
- **Within a band the layout barely differs.** The predicted medians are Easy 2.14 vs Normal 2.31,
  and Hard 2.84 vs Harder 2.90. Harder adds orbs and pads (66 vs 39 per minute) and portals, and
  shortens sections.
- **Normal has more rests than Easy** (14 vs 9 per minute). Stars between Easy and Normal seem to
  follow length, song and taste as much as layout.
- **Not in the fit:** official 9-22 (Insane/Demon) all predict ~3. Layout alone does not see the
  upper tiers; the timing score does (xStep, Clubstep, ToE 2, Hexagon Force at 0.6-1.0 per minute).

Per section rather than per level: `node tools/tiercheck.js` (knowledge session) calls each
section, or ~40-block window, Easy/Normal-like or Hard/Harder-like per mode against deciles in
`knowledge/levels/tier_ref.json`. It prints `tierFromLayout()` beside it. In-sample Spearman
0.46 against this model's 0.72 on the same 63 levels; it is for finding which part of a level
sits in the wrong band.

**So for making levels:**
- Use the layout rows above to land in a band.
- Use the timing ladder below (windows under 100/150 ms per minute, the tightest window) to place
  the level within it.
- For Insane and up, use the timing score.

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

0. **Route choice: done for the jumping modes** (The measure, item 4). Open:
   - Steering modes (ship, wave, swing) are skipped: they never land back on the same state. Their
     window search already re-plans the steering, but that lets later inputs rescue for free.
   - A route counts only if it rejoins within 2 s. A different path that stays apart longer (an
     upper and a lower path through a whole section) is not compared yet.
   - The joint chance uses no reaction at all; within 1-2 s a player does correct a bit.
   - "Buffer slightly" (the user) is in through the 100 ms taps; where in the window a player
     aims is not modelled.

1. **Separate Easy to Harder.** They all score about 0.3 per minute. Next: put density
   (`touchesPerMin`, `switchesPerMin`, `restsPerMin`), `room` and surprise (an input that
   breaks the rhythm before it) into the score, and fit them on the player's runs and the
   community tiers.
2. **More real runs, on levels the sim covers fully.** Polargeist, Dry Out, Cant Let Go and
   Back On Track are the best. Keep mouse and keyboard apart (`--device`).
   - Loop: record → `node tools/runs.js <files> --join --level N --device mouse` →
     `node tools/difficulty_fit.js` → update SIGMA and LAPSE.
3. **Surprise: unexpected land-and-jump chains and inputs forced right after a switch.** Both
   are reported (`quickRecoveries`, `forcedAfterSwitch`), neither is in the score. The GDLM 44
   wave entrance (2 of 2 deaths) is the first case of the second kind. **Unexpected land-and-jump chains.** These were all 8 of the player's GDLM 42 deaths, but
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
