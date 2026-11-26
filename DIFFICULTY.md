# Difficulty: what it means here and how it is measured

`lib/difficulty.js` scores a level from a solution (its inputs). `tools/difficulty.js` prints the
score for your own `.gdlvl` files, or for the official levels next to their in-game ratings and
the player's own attempts. `tools/runs.js` reads the player's real deaths from a screen recording.

```
node tools/difficulty.js levels/gdlm_05_x.gdlvl      # one level: score, then every input's window
node tools/difficulty_solve.js 7                      # cache a solution of official level 7 (ONE at a time, ~800 MB)
node tools/difficulty_solve.js 7 --resume             # after a physics change: keep the saved run up to a bit before
                                                      # where the change matters, solve only the rest (minutes, not 15)
# a stopped solve carries on from its 30 s checkpoint (local/difficulty/NN.part.json); --fresh starts over
node tools/difficulty.js                              # all cached official levels vs ratings and your attempts
node tools/save_stats.js                              # your lifetime attempts per official level (save, read-only)
node tools/save_stats.js --demons                     # every level in your save (main + online): tier, done, attempts, best %; --done, --diff Insane, --list
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
5. **Settling after a portal.** An input whose window closes less than SETTLE = 300 ms after a
   portal switch gets its chance scaled by (ms from the switch to the window's end) / 300, at least
   0.02. A player's own orb flip does not count; only portals do.
   - **The evidence.** The user's attempts in the physics session's `local/real_stats.jsonl`
     (`node tools/real_stats.js`), 2026-11-23:
     - GDLM 44 v5's wave entrance: the cube lands on a block, takes the wave portal at its end and
       must hold within ~13 ticks or slide off. The window is 92 ms and closes ~54 ms after the
       portal. It passed 1 of the 5 times it was reached.
     - GDLM 46's jump after the wave exit: a 129 ms window opening ~42 ms after the switch. It
       passed 1 of 2.
     The windows alone give ~100% for both. Maximum likelihood for the ramp is 315 ms (an
     exponential, τ 245 ms, fits as well).
   - **Effect.** GDLM 44 v5 goes from 1.1 to 3.0 expected attempts (the user: 7, not beaten).
     GDLM 46 goes from 1.2 to 2.1 (beaten on attempt 7).
   - **Caveat.** My window measure flags slightly different inputs than the physics session's
     careful `tools/press_window.js`. On 44 its window closes 113 ms after the portal. On 46 it
     flags the wave entry and gives the post-wave jump a wider window, because the look-ahead
     re-plans. Seven tries on two levels; refit as real_stats grows. `opts.settle = false` turns
     it off.
6. **Score** = log10 of the expected attempts to beat the level in one go, -Σ log10 p
   (1.0 ≈ 10 attempts). `/min` is the same per minute of the part the sim covers.
   `practiceDeaths` = Σ (1/p - 1).

Reported beside the score:
- inputs and inputs/s;
- tight inputs (under 60 ms) and the longest streak of them;
- ship gap (free height around the ship's path);
- hiding triggers (move, alpha, toggle and spawn triggers the sim ignores: memory parts);
- `quickRecoveries`: presses whose window closes under 150 ms after a landing.
- `forcedAfterSwitch`: inputs whose window closes under SETTLE (300 ms) after a portal switch
  (mode, speed, gravity portal, size). These are IN the score (item 5). `afterSwitchMs` per input.
- `chainExtra`, `worstChain`: how much more the level costs if quick chains (jumping-mode inputs
  under CHAIN_GAP = 300 ms apart, assumed) are not corrected. Joint chance of the chain versus the
  product of its windows; not in the score. See Open 3.
- `room`: free height per flying mode, counting blocks AND hazards, min and median in units
  (30 = a row). The user found GDLM 44's wave "slightly too difficult" with the same windows as the
  rest. It had 2 rows of room where the ship had 5.
- `touchesPerMin` (orbs, pads, portals the path touches), `switchesPerMin` (mode, gravity or
  speed changes) and `restsPerMin` (gaps of 1.5 s or more with no input). The knowledge session's
  91 community levels (knowledge/levels/low_tier_stats.md) say Hard differs from Normal mostly by
  this kind of density, not by tighter timing.

Apart from `forcedAfterSwitch`, none of the extras are in the score yet; each rests on a level or two.

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

The same tool also writes `local/difficulty/user_stats_online.json`: every level in the save (the 22 main ones and every
online level he played, GLM_03), its tier from stars / demon type, done (normal 100 or `c_<id>` in GS_completed), attempts,
jumps, best normal and practice %, and the save's totals (GS_value 5 = demons beaten). His beaten demons with attempt
counts are calibration data for the model: `tools/fetch_level.js <id>` pulls one for measuring. Unconfirmed: that the
save's k76 demon type uses the server's numbers (3 easy, 4 medium, 0 hard, 5 insane, 6 extreme) -- check a known demon.

## Against the official levels (the player's route, SIGMA 13, LAPSE 0.75 %, SETTLE 300 ms)

**Current status of every official level: `node tools/measures.js official` (knowledge/measurements.jsonl).** It
shows solved / difficulty / taste per level with STALE where the physics, route or model changed since. As of
2026-11-24 night every row below is stale: no official level has been re-solved since 46672ee (no landing buffer),
see PHYSICS.md "Handoff: the solver session". `difficulty_solve.js` and `difficulty.js` record there by themselves.

Report7, 2026-11-23, with route choice and the settle factor. Solved into the shared `local/` and
tagged with their physics commit (`tools/difficulty_solve.js`). Rows 7, 17, 19 and 20 were re-solved
by the physics session (7, 17 on 7924db0-61f17d3; 19, 20, 22 on 119344c: wave edge rules, the
intended route, outline pieces solid, quarter-turned teleports). The rest are
on 1503b03 and may take a different route on today's sweep, which prefers routes that take every
portal and orb and keep off walls. Their `physics` stamp shows which are stale. 17 of 22 are beaten
in the sim; Fingerdash stops at 6% at a black orb where gdsolver's real-game plan stops too.

| # | level | rating | covers | inputs | tight | min ms | score | /min | your attempts |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Stereo Madness | Easy 1 | 100% | 119 | 0 | 63 | 0.40 | 0.29 | 353 |
| 2 | Back On Track | Easy 2 | 100% | 111 | 0 | 100 | 0.36 | 0.27 | 39 |
| 3 | Polargeist | Normal 3 | 100% | 142 | 0 | 100 | 0.46 | 0.31 | 47 |
| 4 | Dry Out | Normal 4 | 100% | 127 | 0 | 100 | 0.72 | 0.54 | 64 |
| 5 | Base After Base | Hard 5 | 100% | 126 | 0 | 67 | 0.42 | 0.30 | 58 |
| 6 | Cant Let Go | Hard 6 | 100% | 127 | 0 | 71 | 0.42 | 0.32 | 150 |
| 7 | Jumper | Harder 7 | 100% | 160 | 1 | 58 | 0.80 | 0.56 | 173 |
| 8 | Time Machine | Harder 8 | 100% | 136 | 1 | 54 | 0.61 | 0.39 | 204 |
| 9 | Cycles | Harder 9 | 100% | 108 | 0 | 63 | 0.63 | 0.48 | 127 |
| 10 | xStep | Insane 10 | 100% | 115 | 6 | 17 | 1.21 | 0.90 | 114 |
| 11 | Clutterfunk | Insane 11 | 100% | 159 | 1 | 42 | 0.81 | 0.52 | 456 |
| 12 | Theory of Everything | Insane 12 | 100% | 112 | 3 | 58 | 2.89 | 2.11 | 170 |
| 13 | Electroman Adventures | Insane 10 | route skips the UFO portal at block 528: no number | | | | | | 285 |
| 14 | Clubstep | Demon 14 | 100% | 161 | 5 | 33 | 2.42 | 1.70 | 1886 |
| 15 | Electrodynamix | Insane 12 | route skips 3x (664), ball (839), cube + size (898): no number | | | | | | 560 |
| 16 | Hexagon Force | Insane 12 | 100% (saved route now stops at block 563: re-solve) | 136 | 0 | 63 | 0.79 | 0.55 | 249 |
| 17 | Blast Processing | Harder 10 | 78% | 125 | 1 | 58 | 0.84 | 0.66 | 203 |
| 18 | Theory of Everything 2 | Demon 14 | route skips the 2x portal at block 501: no number | | | | | | 3258 |
| 19 | Geometrical Dominator | Harder 10 | 100% | 206 | 0 | 67 | 1.43 | 0.89 | 191 |
| 20 | Deadlocked | Demon 15 | 58% | 141 | 7 | 17 | 3.69 | 3.84 | 3951 |
| 21 | Fingerdash | Insane 12 | 5% | - | - | - | - | - | 296 |
| 22 | Dash | Harder 10 | route skips the cube + 1x portals at block 91: no number | | | | | | 477 |

Fingerdash is left out: a sim bug stops it at block 55, being fixed by the physics session.

**No secret ways (the user, 2026-11-23: "if the solver skips something, its 99% wrong").** A route that
skips a portal gets no number: on an official level it is a physics bug at that portal (listed with the
physics session). `node tools/skips.js [n]` checks every saved route: a portal counts as taken only when the
sim fired it (a box overlap is not enough: Electrodynamix's mini ship clipped a cube portal's corner by 6 units
and stayed a ship -- the user saw it in the viewer at 71 s). Not a skip: a portal that would change nothing
there, a twin with the same effect in the same column that fired, or one more than 2 blocks off the route
(decoration; physics' rule: Theory of Everything's six end portals hang 26 blocks above a floor route). Four
skip: Electroman (UFO 528), Electrodynamix (3x 664, ball 839, cube + size 898), Theory of Everything 2 (2x 501),
Dash (cube + 1x 91); physics re-solves them under the rule now in lib/physics.js. Their old rows were 0.72 /
2.26 / 1.55 / 1.80. Hexagon Force's saved route no longer finishes on today's physics (its numbers are from the
older route, kept until the re-solve).

**Rank agreement over the other 17** (`node tools/difficulty.js --cached`, from the report's cache):

| | per minute vs stars | score vs stars | per minute vs your attempts |
|---|---|---|---|
| route choice, no settle factor | 0.64 | 0.55 | 0.46 |
| **with settling after portals (in use)** | **0.85** | **0.88** | 0.47 |

(Over 21, skipping routes counted, it was 0.67 / 0.64 / 0.64 and 0.82 / 0.88 / 0.60.)

Stars vs your attempts is 0.73. Before route choice and the physics updates it was 0.66 / 0.61 /
0.66 (report6), and 0.59 before that.

Route choice (`easierRoute`, report6) changed two levels. Electroman's 8 ms UFO tap became an
extra flap 0.9 s later, which makes up for an off-time first one (1.08 -> 0.48 then). Clutterfunk's
50 ms cube jump became two taps. Every other tight input is ship, wave or swing steering, or had no
easier route.

The settle factor is what lifts the upper levels: Insane and Demon levels have many inputs right
after portals (ToE 2.89, Clubstep 2.42, Electrodynamix 2.26, Deadlocked's first 58% 3.69).

What it gets right:
- **The Insane and Demon levels score highest:** ToE 2.89, Clubstep 2.42, Electrodynamix 2.26,
  xStep 1.21, ToE 2 1.55 (52%). Most of it is tight inputs (2-7 per level against 0-1 up to
  Harder) and inputs right after portals.
- **It fits the player's attempts** on the levels they played (calibration above).

What it gets wrong:
- **Easy to Harder are still close,** 0.27-0.56 per minute. Dry Out (Normal) and Jumper (Harder)
  rise with the settle factor, the rest stay ~0.3. The layout model above separates them into two
  bands; timing does not.
- **Hexagon Force, Electroman and Clutterfunk (Insane) score like Harder** (0.5 per minute).
  Route choice found easy routes in Electroman; their difficulty may be in parts the sim plays more
  easily than people do (dual, reading the UFO), or in density (Open 1).
- **Dash (26%) and Deadlocked (58%) per minute** rest on partly covered levels.

### What windows and CPS explain (2026-11-23)

The user: "these frame windows (timings), and cps, somewhat determine the difficulty of levels". They do,
roughly. Rank agreement (Spearman) with the stars over the 17 official levels the sim covers without a skip, each measure
alone (`node tools/difficulty_parts.js`):

| measure | vs stars | vs your attempts |
|---|---|---|
| clicks per second | 0.40 | 0.50 |
| tightest window | 0.73 | 0.69 |
| share of inputs under 60 ms | 0.68 | 0.46 |
| windows alone (summed miss chance) | 0.55 | 0.49 |
| windows per minute (windows + CPS) | 0.64 | 0.46 |
| full model (+ settling after portals, route choice) | **0.88** | 0.51 |

So windows plus CPS get about two thirds of the ranking (0.64); CPS alone is weak (a busy level is
not necessarily a hard one); the tightest single window alone does better (0.73). The time to settle after a
portal adds the rest of what is measured (0.64 -> 0.88). Not in any number yet, and likely the rest: reading and memory (blind or fake
routes, first-try sight-reading), visibility (deco, camera, speed), and consistency over length (one
hard spot at 90% costs more attempts than at 10%). The user's own attempts follow the stars at 0.73.

Which windows: measureWindows in lib/difficulty.js (lenient: a moved input counts as hit when the rest of
the run can still be re-planned around it, as a player corrects). Since main 05abaf7 it is THE window for
every tool: lib/windows.js inputWindows calls it (viewer, tools/windows.js, score.js); the strict variant
(every other input fixed) is opt-in. A tap moved earlier is held until its own release (2026-11-24): a
player holds through a landing or into an orb, which fires on contact -- GDLM 50's land-and-jump taps went
from 25 ms (no early side) to 221 ms; buffered orb takes read wide. Open, from physics: a re-planned window can come out narrower than the strict
one (GDLM 60's dash-orb release, tick 3052): it should contain it.

### Human cost: which valid route a person plays (2026-11-23)

**Known flaw (2026-11-24): a cube hold through an auto-jump chain is ONE input** to humanCost, where the same
jumps tapped are one input each. So the solver's raw holds look cheaper. naturalPlan's last step ("keep the
solver's route when its cost is lower") saved GDLM 64 v2's 14 holds, up to 6.5 s each, as its "human" route.
score.js then read them as 14-27 block prejumps and a 6 s ending. Guard in lib/natural.js: the raw route can't win
with more cube holds over 0.6 s. With the guard, 64's route has 0 holds and still finishes (153 presses, 56 s
re-plan). Still open: humanCost itself should count each jump a hold rides, e.g. the landing-buffer window per
re-jump. Then the guard can go.

The user: the natural route is "the valid route with the lowest human cost". `humanCost(w, events, opts)` in
lib/difficulty.js returns `{ cost, terms, actions, complete }`, lower is better, in log10-attempts units:
`windows` (the difficulty score of exactly this route: lenient windows, settling after portals; no humanize, no
route choice -- the caller's candidates are the choice), `presses` 0.01 each, `centre` 0.02 x how far each input
sits from its window's middle (0..1), `marks` 0.05 per jump mark (its pieces within 45 units are one) with no
jump within 60 units (a jump, flap or orb firing: a held button jumps again on landing), `beat`
(opts.beats, off by default) 0.005 x seconds off the nearest beat per press. Wall clearance and mid-corridor
flying: `clearance` 0.1 per second a flying mode (ship, UFO, wave, swing) spends nearer a wall, hazard or the
band's floor/roof than the corridor forces (closer than min(12, room / 4) units, room = the free height there, so
a tight corridor is not punished for being tight); presses in a flying mode cost 0.002 (hover taps are how a
person flies). Stereo Madness's first ship (the user: "it's unnatural to wait so late and fly up"): the solver's
floor-rider costs 1.4 in clearance; the natural plan now takes the centred line in both ship parts (close to a
surface 62% -> 2%, 43% -> 0%). `pointless` 0.05 per cube jump over nothing (lib/natural.js pointlessJumps: from the
ground, lands no higher, nothing under or near the arc; the user: dropping down a staircase is the intended way). The late climb at block 399.5 has a 213 ms window, so the window term does not
see that "fake timing"; riding the floor up to the wall is what makes it, and clearance charges for that.
Physics calls it from lib/natural.js to pick among candidate routes.
Speed: measureWindows keeps an exact cache per world (an input's window depends only on the state where its
search starts, the button over the span it can see, the input and where the run ends), so a candidate that
differs in a few inputs re-measures only those. GDLM 44 (17 s, a ship part): 32 s cold, 0.15 s again, 1.9 s with
one input moved (57 s without the cache; same cost to the last digit). `opts.fast` skips the tight-input scan
(~10% cheaper here, and a needlessly tight solver timing then reads tight).
After an edit: `GD.carryWindowCache(wOld, wNew, ranges, aToB)` copies every cached window whose look-ahead span
misses the edited x ranges into the new level's cache, renaming the object / trigger indices its state holds
(aToB from the incremental solver's diffObjects). GDLM 45: a moved spike or an inserted decoration re-measures in
0.1 s instead of 38 s, every window equal to a fresh measuring (`node tests/carry_windows.js`, heavy).
Across processes: `GD.exportWindowCache(w)` -> JSON (whole keys, ~1 KB per input: GDLM 43 29 KB) and
`GD.importWindowCache(w, data)`; the incremental solver keeps the export beside a saved route (local/, not committed).
Test: `node tests/human_cost.js`. Open: the weights are set by hand; fit `centre` on where the user really
presses in a window (physics brings those from the recordings).

### Where the sim stops (2026-11-23, physics 119344c)

The three unbeaten official levels each stop on a physics gap, not on a bad route: the route up to
each stop follows the level (it takes every portal). `node tools/stop.js <level>` prints the spot, the
killing object and what the sim thinks it is; `node tools/levelmap.js <level>` draws it (red X).

| level | stop | killed by | cause | owner |
|---|---|---|---|---|
| Deadlocked | beaten since 2026-11-25 | (was: sideways spike 421 behind a teleport exit) | the teleport portal's box sits 12 right of the object (the user's hitbox-on video); fixed in lib/objects.js | - |
| Dash | 9.5%, block 75 (2026-11-25; rotated gameplay is in the sim since the same day: the solver gets through the first turned stretch to x ~3890, block 130, where a red-pad jump meets a ceiling: fixed the same day, it was GD's flip-on-head-hit modifier 2866, PHYSICS.md "Gameplay modifiers"; the real-game plan now goes on to a swing stretch at block 179. Our solver's resume after it (2.0 h, the trap retry included) passes the ceiling, the slow-motion stretch and the swing, and stops 30 ticks into the SECOND turned stretch: x 6746, a swing turned to travel up at x 6735, block 225 -- next) | the id-392 spike row under the spider's down-tap | Dash turns its gameplay 90 degrees there (rotate gameplay, id 2900): GD takes the tap in the turned frame, sideways; the sim has no turned frames, and GD's own search kills an unturned tap on that row (gdsolver, lv22 t=1,737/1,745). Before the teleport was made GD's it reached 28% by a wrong landing | physics: rotated gameplay (PHYSICS.md) |
| Fingerdash | 6%, block 55 | id 1813, nothing visible there | 1755 / 1813 / 1829 / 1859 are GD's lettered helper blocks (OpenGD type 40), imported as 30x30 hazards by the "hitbox = hazard" fallback; Fingerdash has 36, Dash 22 | physics (lib/objects.js) |

With the helper blocks left out, Fingerdash's old clicks get to 6.7% (a saw: those clicks were planned
for the old death); it needs a re-solve once physics settles what the blocks do.

## Balance: how the score is built (tools/balance.js, 2026-11-25)

The user: "i want to see how the difficulty is decided". `node tools/balance.js <level | "GDLM NN" | official:N> [...]
[--html out.html]` splits a score into its presses: each press costs -log10 p, and that cost is three parts that add up:
**slips** (-log10(1 - LAPSE), the same 0.0033 for every press), **timing** (-log10 erf(...), a narrow window) and
**after-portal** (-log10 of the SETTLE factor). It prints the costliest presses and the cost per mode stretch; `--html`
fills `viewer/balance.html` (a page per level given, tabs between them, the main levels' scores as a ladder). GDLM levels
use the saved route in viewer/levels.js (FROSTBITE: 88 s in the cloud); official levels the cached
local/difficulty/scored_NN.json (seconds). The score it adds up equals lib/difficulty.js's (it warns when not).

What it showed first (FROSTBITE 2.66 vs Electrodynamix 2.65, same model):
- **The after-portal rule decides both.** FROSTBITE = slips 0.51 + timing 0.05 + after-portal 2.11; Electrodynamix =
  0.48 + 0.04 + 2.13. Without it both are ~0.55 (Polargeist level). FROSTBITE's "spike" at 69 s (block 760) is a ship
  press with a 275 ms window: wide, but it closes 71 ms after the ship portal, so its chance is cut to 23%.
- **Part of it is a measuring artifact.** A window's late end is searched up to MAX_SHIFT (200 ms). A press whose window
  is still open there gets `afterSwitchMs` = the search limit, and the rule calls it forced. 6 of FROSTBITE's 9
  after-portal presses are 404 ms windows "closing" exactly 200 ms after the portal: 1.06 of its 2.66. Exempting
  late-open windows (`settleOf(a, settle, true)`, `D.SETTLE_LATE_OPEN`) gives FROSTBITE ~1.6, Electrodynamix 2.35, and on
  the 21 main levels Spearman vs stars 0.82 -> 0.84 but vs the user's attempts 0.87 -> 0.80. **Open, off by default**:
  the rule was fitted (SETTLE 300 ms) with the artifact in; exempting needs a refit of SETTLE on real_stats first.
- **The user's verdict (2026-11-25), and the v2 model it led to.** "The ship is very open, usually the timings there
  are almost fake. You could straight fly by tighter clicking ... the more it is open, the easier it is." "If all
  clicks are 200 ms, then its never a 7 star." "And even then, it can't spike the difficulty that much here. So some
  math is wrong." So `tools/balance.js` scores a second model, **v2**, beside the current one:
  - flying presses (ship, ufo, wave, swing) cost only the slip; the flight is scored by how open it is: per second,
    p = erf(slack / 2 / (FLY_SPREAD * sqrt2)), slack = free height around the player minus its size
    (`lib/difficulty.js flyRoom`; FLY_SIZE ship/ufo/swing 30, wave 10, mini x0.6; FLY_SPREAD 12 units, ASSUMED);
  - the after-portal cut only on a jumping press whose window opens after the portal and really closes;
  - gravity play (the user: "gravity play should be counted as increased difficulty slightly somehow"): a jumping press
    made upside down or within 1 s of a gravity flip has its chance x 0.99 (GRAV_PEN, ASSUMED; FROSTBITE: 20 presses,
    +0.09);
  - dual (the user: "some people think hexagon force is harder than the demons because the two hard duals"): a press
    made while two players are on screen has its chance x 0.95 (DUAL_PEN, ASSUMED), flying presses too; "assymetric duals
    = even more" (the two in different modes: x 0.90, DUAL_ASYM_PEN); "reverse screen = bit more difficult (not very but
    it does add as its a bit unnatural)": a press after a mirror portal (45, until 46) x 0.98 (MIRROR_PEN). All assumed,
    ordered as he said; fitted with the rest.
  FROSTBITE: v1 2.66 -> v2 0.72 (presses 0.65 incl. gravity 0.09 + flight 0.07 over 38 s of 60-unit-slack ship). On the mains, v2's
  presses alone (no flight: RobTop's levels are only on the PC) rank worse (Spearman vs stars 0.57, v1 0.83):
  Clubstep's and ToE 2's difficulty is in their corridors, so the flight part is needed before v2 replaces v1.
  NEXT: run `node tools/balance.js official:1 ... official:22 --json` on the PC (it has the levels), fit FLY_SPREAD on
  stars and the user's attempts from `flyRaw`, then decide. score.js and the board still use v1.
- **Stats first, rules only name the features** (the user, 2026-11-25: "i dont want it to be too rule based, but rather
  more based on stats. but as humans play it the feeling of difficulty does make some difference, besides the timing
  themselves"). The v2 terms (flight room, gravity, dual, asymmetric dual, mirror, after-portal) are features, not
  verdicts: their weights get FITTED, never hand-set for good. Data, in order of weight: the user's real deaths
  (real_stats, recordings), the rated community levels with stars (the taste corpus, ~330; the 91 low-tier ones), the
  mains' stars and community tier lists, his own ranking. A feature whose fitted weight is ~0 is dropped.
- **Readability is a feature too** (the user, 2026-11-25: "we didnt even get to the visuals ... robtop levels which are
  like amazing for (besides geometrical) is the visible play"): how clearly the path and its hazards can be read adds to
  difficulty beside timing (Geometrical Dominator is the main level that hides it). Feature candidates, from tools we
  have: hiding triggers on the path (`hiddenTriggers` in lib/difficulty.js), prejumps (tools/sightread.js), hazard vs
  background contrast (tools/roles.js), deco clutter in the play lane (tools/lane.js), look-ahead seconds at speed
  (`lookAhead`). NEXT: compute them per main level and fit with the rest; not in v2 yet.
- **The user's own ranking of the mains** (2026-11-25): `knowledge/difficulty_rank_user.json`, easiest first (Back On
  Track ... Dash, then Hexagon Force = Electrodynamix, then Clubstep / ToE 2 / Deadlocked, Deadlocked hardest). A rough
  target, not an exact one (the user: "its not about fitting exactly, its just around. some are debatable in the
  community. there are many such tierlists in the net"): fit to tiers (a level within ~2 places is fine), and average it
  with community tier lists when we gather some. Spearman with it -- Spearman with it -- in-game stars 0.95, his attempts 0.80, v1 0.88, v2 presses only 0.58.
- **The timing curve is too steep for ordinary jumps** (2026-11-25, Dry Out 4* vs Time Machine 8*): with SIGMA 13 ms a
  window over ~70 ms is a near-certain hit, so Time Machine's eight 83 ms jumps cost 0.004 each, like a 300 ms one, and
  the two levels differ only by press count (v2 presses 0.48 vs 0.50). Refit SIGMA (or a spread that grows with
  speed / density) together with FLY_SPREAD on the mains' stars and the user's attempts.
- **Lone spike (fairness, not score)**: a jumping press under 60 ms among neighbours (±5 s) of 150 ms median or more
  is printed as SPIKE (knowledge/checklist.md "Fair"). FROSTBITE 8.2 s (the triple spike, 46 ms among ~296 ms).
  Sweep of the 29 GDLM levels with a saved route (2026-11-25): 9 spikes in 6 levels -- GDLM 43 (24.4, 25.6 s), 45 (3.9 s),
  69 (28.7 s), 70 (1.8 s; robot 28.3 and 61.6 s, 58 ms), 72 (8.2 s). Seven of them are 46 ms cube jumps: the triple spike at
  1x (45.8 ms whatever the run-up, tools/collab.js) dropped into a calm stretch. So the family is "a 1x triple in an easy
  part"; compose / collab should not place one there. v2 on the same sweep: every GDLM level 0.0-0.9 except GDLM 62
  (1.18: its hit-timed ship corridor, flight 0.98 over 13 s).
- Also open: a press whose window starts well before the portal (the 69 s one opens ~200 ms before it) can be pressed
  before the switch; the rule still counts it as forced.

## Fairness: deaths that are not the player's fault

The user, after GDLM 46 v2: "I mostly died deaths not really my fault". The physics session
labelled the 11 deaths of that run (`local/real_stats.jsonl` field `fair`): 7 unfair, 3 borderline,
1 fair. `node tools/fairness.js <level.gdlvl>` flags the spots such deaths come from.
`tools/score.js` runs it as the gate **fairness**: FAIL blocks the hand-over, so compose, polish
and sketch all get it. It is judged on the route a person plays (`lib/natural.js`).

| family | flags | from | threshold |
|---|---|---|---|
| switch, into a jumping mode | the first input that starts after the portal has a strict window (that input moved, every other kept) closing under 250 ms after it | 46 v2 wave exit: 158 ms window closing 163 ms after, 2 deaths | SWITCH_MS 250 |
| switch, into wave/swing | the player must change the button within 300 ms of the portal or die (the latest first change, with free steering after it, that lives) | 44 v5 wave entry: 267 ms, 4 of 5 died; 44 v8: 350 ms, passed | WAVE_DEADLINE 300 |
| (ship/UFO entries) | exempt: a player holds into them from the jump that gets there; nobody died there | 44, 46: deadlines 67-467 ms, all passed | |
| mark | a jump mark (group 990) with no jump of the natural route within 60 units; FAIL if jumping at it kills, else WARN | 46 v2 mark at 825, death at 950 (WARN: the sim's perfect follow-up survives it); 44 v8 x 3000 (WARN, beaten first try) | MARK_DIST 60 |
| floor | a sawtooth: 2+ separate slopes within 5 blocks of a portal into a ground mode | 46 v2 wave exit, death at 3150; one slope down to it is fine (44 v8, 45) | FLOOR_RUNS 2, FLOOR_RANGE 150 |
| chain | 3+ orb taps in a row, each under 500 ms after the last | 46 v2 end chain (windows 300/304/113 ms), 3 deaths | CHAIN_LEN 3, CHAIN_MS 500 |
| blind (WARN) | a jump with a window under 100 ms, no mark, straight into an orb within 600 ms | 46 v2 first orb, 3 borderline deaths | BLIND_MS 100 |
| wave | a wave input with a real window under 150 ms, not part of a portal switch | the user's checklist; no death of its own yet | WAVE_MS 150 |

`node tools/fairness.js fit` checks it against every labelled death; `tests/fairness_fit.js` keeps
it so. A flag explains a death when it sits at most 11 blocks before it. Over GDLM 44 v5, 46 v2 and
44 v8 (beaten first try, so every flag on it is a false alarm):
- **unfair deaths flagged 12/12, 11 of them by a FAIL.** The 46 v2 mark death is caught only as a
  WARN. 5 of the 12 on 44 are inferred: rows the physics session called forced before the `fair`
  field existed;
- **borderline flagged 3/3** (WARN);
- **the fair death not flagged 1/1**;
- **false alarms: 2.** 46 v2's wave entry (a 167 ms deadline, passed 7 of 7) and 44 v8's stray
  mark (WARN).

On the levels now in `levels/` and `local/wip/` (2026-11-23, `local/difficulty/fairness_survey.txt`):
- **fair:** 01, 02, 41-44, 46 catalogue, 50, cube timings polished, and the wip 44 and 45;
- **levels/ GDLM 45 fails:** two cube -> wave entries with a 267 ms deadline, the same as 44 v5's
  deadly one;
- **46 sketch v2 fails** as above;
- **44 polished gets two WARNs** for stray marks.

This is in-sample: the rules were shaped on these same deaths. What is weak:
- **The wave deadline cut is thin:** 267 ms killed, 350 passed, and 46's 167 passed 7 of 7. The
  deadline does not capture what made 44 v5 deadly: the cube sat on a block that ends right after
  the portal.
- **Several measures were tried and dropped**, each failing one of the cases:
  - the lenient window (look-ahead re-plans): 329 ms on the deadly 46 exit;
  - survival with no new input: 171 ms on the safe 46 entry, 483 on the deadly exit;
  - the strict window alone: v8's wave entry closes sooner than v5's;
  - wave-turn gaps from the natural plan's controller: 33 ms taps on v8, which was beaten.
- **A stray mark is only a WARN** unless a jump at it kills outright. Whether a person can follow
  up as well as the sim can is not modelled.
- **Not measured yet:** orbs that carry the cube to the screen's top edge (46 v2 end chain).

Refit whenever `local/real_stats.jsonl` gets new labelled deaths (the physics session adds every
analysed recording): add the played version to `PLAYED` in `tools/fairness_fit.js` and run
`node tools/fairness.js fit`.

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
| Insane | 10, 11, 13, 15 | 1.4-1.7 | - | - | 17-54 ms | 1-6 | 0.34-0.66 |
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

## Community demons (2026-11-25)

Four rated Easy Demons and one Extreme Demon, fetched into `local/community/` (never committed; IDs checked on the server:
name, creator, rating). Solved with `node tools/difficulty_solve.js c<id>`, scored with `node tools/difficulty.js c<id>` (the
mains' basis: the human route, natural plan + humanCost, tap length for 10 stars), physics 21a4b06. Numbers also in
`knowledge/measurements.jsonl` (`node tools/measures.js latest community`). Modes from `node tools/portals.js`.

| level (ID, creator) | modes / specials | solved | solve | score (log10 att.) | /min | tightest | taste | rep. R |
|---|---|---|---|---|---|---|---|---|
| The Nightmare (13519, Jax) | cube ball ship, mirror, 2x | yes | 50 s | 2.47 | 1.66 | 67 ms | 43 | 0.05 |
| Demon Park (10109, M2coL) | cube ship ball, mirror | yes | 16 s | 0.83 | 0.52 | 46 ms | 40 | 0.00 |
| THE LIGHTNING ROAD (55520, timeless real) | ship cube ball, 69 mirror | yes | 62 s | 1.54 (route check open) | 1.15 | 79 ms | 44 | 0.06 |
| Problematic (7116121, Dhafin) | ship cube wave, dual, mini, 0.5-3x, toggles | yes | 5 min | 4.86 (suspect) | 5.43 | 13 ms | 55 | 0.02 |
| Bloodbath (10565740, Riot) | all but robot/spider/swing, dual, mini, 0.5-3x | no: 1.4% | - | - | - | - | 49 | 0.01 |

Mains for scale: Clubstep 3.51, Electrodynamix 2.65, ToE 2 2.35, Hexagon Force 2.09 (Deadlocked's 10.69 is an outlier).
- **The model does not see "demon" in Easy Demons.** Demon Park scores like a Hard main (0.83), Lightning Road like
  Geometrical Dominator. Only The Nightmare sits near the main demons. Easy Demons from 1.7-1.9 were made for 1.x
  players: density (Nightmare 160 inputs in 89 s) and long runs, not tight windows (median 240-310 ms). Same finding as
  "Hard = density, not tightness" above: the score needs density / length / no-rest terms before it can rank demons.
- **Problematic's 4.86 rests on three wave taps at 50% (block 321-323: 13, 17, 33 ms)**, under a 60 fps frame. An Easy
  Demon does not ask that; the score is not trusted until that spot is checked (mini wave at speed: a sim gap or a route
  the solver chose badly; `tools/press_window.js` there).
- **Lightning Road "skips" 47 portals**: stacks of 4 portals on one spot, off the route. tools/skips.js now calls a
  stack of portals of the same kind with different effects (ship + cube, normal + upside-down gravity) scenery (31 of
  them); 16 remain (4-stacks of one kind, 100-190 units off the route's y) and still block a trusted number.
- **Bloodbath blockers, in order** (a map, not a full solve):
  1. *Unsimulated feature, FIXED 2026-11-25*: the level header's start mode. Bloodbath starts as a ship (`kA2,1`); the
     sim read only `kA4` (speed), so it ran as a cube and died at block 18. Now in (PHYSICS.md "Start settings"); with it
     the plain level reaches block 85.5 like the copy below. Platinum Adventure and Blue Hell start as a ship too.
  2. With a ship portal put at the start (a copy, `local/tmp/demons/`): dies at block 85.5 (6.6%), a mini ship into a
     22-degree slope turned 90 degrees (id 311), next to a blue pad turned 119 degrees. Every state dies there (the solve
     ends in 4 s), so physics, not the search: turned slopes and the ship on slopes are unchecked (CLAUDE.md "Not
     simulated yet": spike slopes; slopes are checked only flat). 314 slopes and 123 gameplay objects turned off the
     grid in this level.
  No move / toggle / spawn triggers (only colour, pulse, alpha). So what blocks the extreme demons we have looked at
  is object geometry (turned slopes and pads, thin lines) and the header, not triggers.
- **Problematic's wave spot: a sim gap.** In the dual wave at 2x, player 2 (upside down) slides on the dual band's floor,
  meets a floor slope at block 325.9 and is seated on the slope's underside at y -5, below the ground (PHYSICS.md "Not in
  the sim yet", OPEN). The 13/17/33 ms taps at 321-323 thread into that line. Not fixed: what GD does there is unknown.

### Calibration on the user's own beaten demons (2026-11-26)

His save lists 60 beaten demons with lifetime attempts (`local/difficulty/user_stats_online.json`, tools/save_stats.js
--demons). 20 old ones (1.x-2.0, cube / ship / ball / UFO, few specials; screened with tools/portals.js) were fetched,
solved and scored as above: all 20 beaten in the sim (16 s - 57 min a solve; Platinum Adventure took 57 min), 3 routes
skip a portal (demon mixed, Super Cycles, Blue Hell: left out). `node tools/difficulty_density.js` fits his attempts
(log10) with leave-one-out:

| data | score only: rmse / Spearman | + inputs/min + minutes | inputs/min + minutes alone |
|---|---|---|---|
| 19 mains + 19 community demons | 0.39 / 0.36 | 0.40 / 0.26 | 0.41 / 0.14 |
| 19 community demons only | 0.31 / -0.14 | 0.29 / 0.24 | 0.30 / 0.11 |

- **Density and length do not fix it.** Every one of these is 1.0-1.6 min long and 83-150 inputs a minute; neither
  varies enough to explain 83 vs 1111 attempts. Within the community demons the score does not rank his attempts at all
  (Spearman -0.14): Electroman Adven v2 1111 attempts at score 1.87, Lights And Thunder 100 at 3.43, invisible clubstep
  539 at 4.02. So the missing part is not a density term.
- What it may be instead (open, in order of what to test): (1) **when he played it**: lifetime attempts mix skill growth
  in -- a demon played early in his GD life costs more (the save has no dates; the order he beat them, if a save field
  has it, would show it); (2) **long-run consistency**: with windows of 200-300 ms the per-press chance is ~1, so the
  model gives ~0 cost to the long easy stretches that still kill a real player now and then (the lapse term, fitted on
  short official levels, may be too small for 150-200 presses); (3) **reading**: these old levels have hidden / fake
  paths and bad visibility (invisible clubstep), which the timing model cannot see.
- Scores per level: local/difficulty/community.jsonl and knowledge/measurements.jsonl (`node tools/measures.js latest community`).

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
   - 2026-11-24, recording 02:33:44, 9 attempts on official levels (`node tools/real_stats.js`).
     Base After Base and xStep were cleared first try. Fingerdash was cleared on attempt 2.
     Deaths: Electroman 33.2% and 10.3%, Hexagon Force 40.4%, Geometrical Dominator 12.3% and
     13.3%, Fingerdash 53.0%. The death %s are solid (from the progress bar). No attempt replays in
     the sim yet, so don't fit SIGMA on them (physics, PHYSICS.md "Fidelity"). Use them for
     predicted vs real places only: does the model's hardest stretch sit where the user died?
     Electroman, Hexagon Force and Dash wait on re-solved routes (skips and a stale route).
3. **Surprise.** Inputs forced right after a portal are in the score (The measure, item 5); refit
   SETTLE on `local/real_stats.jsonl` as it grows (the physics session adds every analysed
   recording) and with `node tools/difficulty.js --cached --settle MS` (seconds, from the
   report's cache). **Unexpected land-and-jump chains** are reported only (`quickRecoveries`).
   **Chains with no time to correct** (`chainExtra`), from GDLM 46 v2 (real_stats, 03-50-48.mkv):
   12 attempts and 11 deaths, the user: "I mostly died deaths not really my fault".
   - The deaths: 3 at the first orb (x 345), 2 at the forced jump after the wave exit (158 ms
     window), 3 in the end orb chain ("can't adjust", windows 100-217 ms), and 3 others (a
     misleading mark, a sawtooth floor, the first spike).
   - The model says 0.33 (~2 attempts). The usual windows assume every next input re-plans
     perfectly. The joint chance with no correcting at all says 0.63 over the first 8 inputs
     alone, against the user's 4 deaths in 12 there (~0.18).
   - So correction happens, but only with time to react. The gap that still links two inputs
     decides it: 300 ms adds 0.06, 400 ms gives 0.62 over the first chain. worstChain at 300 ms
     points at the end orb chain, the right spot.
   - Next: fit CHAIN_GAP (or a correction that grows with the gap) on real_stats deaths by place,
     then put it in the score. Also from that run: orbs that carry the cube to the screen's top
     edge (not measured). These were all 8 of the player's GDLM 42 deaths, but
   rhythmic chains are fine (every early official level has 60-90). Needs a rhythm or surprise
   measure to tell them apart.
4. **Coverage.** 6 official levels are under 10% in the sim (`local/difficulty/NN.json` says
   where each stops). Each physics fix: re-run `node tools/difficulty_solve.js N --resume`, one at a time (a full solve without
   --resume now and then: a resume keeps the old route before the change).
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

## Mode order: a feature's tier is where the official levels bring it in (2026-11-24)

The user: "the difficulty of modes is usually correlated to their appearance in gd main levels". GD's main levels add
one new thing at a time as their rating climbs, so the rating of the FIRST official level (1-22) that uses a mode,
speed, size, gravity flip, dual, orb or pad is its tier. `node tools/modeorder.js` builds the table
(knowledge/mode_order.json) from the levels on this PC; `node tools/modeorder.js <level>` gives a level's tier floor.

| feature | first in | tier | in |
|---|---|---|---|
| mode:ship | 1 Stereo Madness | Easy | 22 of 22 |
| mode:cube | 1 Stereo Madness | Easy | 22 of 22 |
| pad:yellow | 2 Back On Track | Easy | 21 of 22 |
| pad:blue | 2 Back On Track | Easy | 14 of 22 |
| orb:yellow | 3 Polargeist | Normal | 20 of 22 |
| gravity flip | 4 Dry Out | Normal | 18 of 22 |
| pad:pink | 6 Can't Let Go | Hard | 12 of 22 |
| orb:pink | 8 Time Machine | Harder | 11 of 22 |
| mode:ball | 9 Cycles | Harder | 13 of 22 |
| orb:blue | 10 xStep | Insane | 13 of 22 |
| mini | 11 Clutterfunk | Insane | 11 of 22 |
| mode:ufo | 12 Theory of Everything | Harder | 10 of 22 |
| speed:2x | 15 Electrodynamix | Insane | 7 of 22 |
| speed:3x | 15 Electrodynamix | Insane | 3 of 22 |
| dual | 16 Hexagon Force | Insane | 3 of 22 |
| speed:0.5x | 16 Hexagon Force | Insane | 5 of 22 |
| mode:wave | 17 Blast Processing | Harder | 6 of 22 |
| mode:robot | 19 Geometrical Dominator | Harder | 4 of 22 |
| orb:green | 20 Deadlocked | Demon | 3 of 22 |
| orb:black | 21 Fingerdash | Insane | 1 of 22 |
| orb:green dash | 21 Fingerdash | Insane | 2 of 22 |
| pad:red | 21 Fingerdash | Insane | 2 of 22 |
| orb:pink dash | 21 Fingerdash | Insane | 2 of 22 |
| mode:spider | 21 Fingerdash | Insane | 2 of 22 |
| orb:red | 21 Fingerdash | Insane | 2 of 22 |
| mode:swing | 22 Dash | Insane | 1 of 22 |
| orb:spider | 22 Dash | Insane | 1 of 22 |

Used in:
- **the difficulty check** (tools/score.js gate "mode tier"): a feature more than one tier above the level's target is a
  WARN -- the level reads harder than its timing windows say (a newer mode is unfamiliar). Soft: a brief may accept it
  with a reason. One tier above is common (a Normal level with a ball part).
- **compose** (tools/compose.js): a NOTE when a brief puts a section mode or speed more than a tier above its difficulty.
  An Easy level keeps to cube, ship, yellow / blue pads; gravity flips and yellow orbs come at Normal, pink pads at Hard,
  ball and pink / blue orbs at Harder, mini, UFO, wave, robot, dual, 2x / 3x / 0.5x and the other orbs at Insane+.
- Not in lib/difficulty.js's fitted attempts model (it is fitted on the user's runs, no mode term yet): the tier is a
  floor next to it. Open: fit a per-mode familiarity term once the user's runs cover more modes.
Our levels by tier floor (2026-11-24): 41/43 Normal; 45, 46 sketch, 62 Harder (ball, wave); 47, 61, 63-66 Insane (2x,
0.5x, dual, blue orb); 44, 50, 51, 52, 60, 67 Demon (a green orb).

## Too tight for the level (2026-11-25)

The user: "in the main levels, wherever a timing is too hard for the level, its probably not the path". A press whose player
window is under the level's tier floor -- 40 ms Easy to Harder, 30 Insane, 20 Demon (the board's first cut) -- marks a
spot where the route is probably not the intended one. `node tools/tight.js [n ...] [--fix] [--coins]` lists them per
main level; --fix re-searches each (lib/difficulty.js easierRoute with `below: floor`: drop / move / add taps nearby that
rejoin the route, judged by windows and joint chance) and saves the route when it is easier and still takes every portal.
What stays under the floor is a physics lead or a branch further back than the local search reaches. Flagged first
(board, 2026-11-25): xStep 25 ms, Electroman Adventures 8, Hexagon Force 8, Deadlocked 17, Dash 8. tools/mains.js runs
--fix after every job. Results: local/mains/tight.json.

## Main levels kept current (tools/mains.js)

Standing rule (the user, 2026-11-24): RobTop's 22 main levels always have a current, human-like solve, and a main level
whose route fails is the **highest priority** heavy job ("If we have it failed then its highest priority").
- `node tools/mains.js status` (~10 s, no solving): each level's raw solve and human route replayed on today's sim, and
  the cheapest job that makes it current: `ok` (the human route clears, every portal taken), `replan` (the raw solve
  still clears: `difficulty_solve.js N --replan`, seconds to ~11 min -- Hexagon Force's is the long one), `resume`
  (the raw solve dies: `--resume` from a bit before the trouble, checkpointed every 30 s).
- `node tools/mains.js run [n ...]`: does them one after another, replans first, at heavy priority `urgent` (above
  high, tools/heavy.js); one runner at a time; log and history in `local/mains/`.
- **In git** (2026-11-25, the user: "why dont we put the solutions on git?"): `knowledge/mains/routes.json` holds every main
  level's human route, raw solve and coin route as press timings only (no level data; a hash of the level text and the
  physics commit per route). `mains.js export [--push]` writes it; run and replan export and push it at their end; a new
  PC replays them on its own game (tools/mains_routes.js import, SETUP.md) instead of hours of solving.
- Automatic: `tools/serve.js`'s self-update starts `mains.js run` when a pull changes the physics or route code
  (mains.js ROUTE_CODE). A session that changes physics need not do anything else.
- 2026-11-25, after the no-landing-buffer change (46672ee): 1 ok (Blast Processing), 8 replans, 13 resumes; most raw
  solves now died in the first 2-11% (they leaned on the old buffer). Measured (local/mains/history.jsonl): replans
  5-97 s (Fingerdash 42 min), resumes 29-95 s (Hexagon Force 21 min, Deadlocked 5 min): the whole batch took 84 min.
  Result: 20/22 clear with a human route (21/22 since the 747 box fix the same night: Deadlocked beaten); Deadlocked (59%) and Dash (15%) still died at their open physics leads
  (PHYSICS.md handoff), which `run` reports and leaves until physics changes. `humanroute.js` still flags 33 ms UFO
  gaps (13, 15, 18) and holds through jumps (16, 21): spots where only an inhuman way was found.
- Scoring them (`node tools/difficulty.js`, all 22): levels 1-20 took ~16 min (scored_NN.json 01:28-01:44 local), then
  Fingerdash's new route ran 60+ min without finishing and was killed (it held a heavy slot others waited on). Open:
  why scoring Fingerdash hangs (its replays fire 256 triggers; the 42 min replan points the same way). Until then score
  21 and 22 alone at low priority. The heavy lock's estimate for a full run came from one GDLM level (50 s): wrong.
