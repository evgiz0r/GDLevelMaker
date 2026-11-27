# Geode: mods as ground truth from the real game

The user installed Geode (GD's mod loader) on the PC on 2026-11-25. Until then the game was plain GD on Steam (2.2091 since Steam's
2026-10-21 update -- not 2.2081 as older notes say; Geode maps the exe's PE timestamp 1792203143 to 2.2091), and everything we know about the real game came from screen recordings (tools/track.py, framecheck,
landbuf), a keyboard input logger with a clock fitted afterwards (tools/inputlog.ps1, replay_run.js), gdsolver's
published plans, and a keyboard bot nobody trusts yet (tools/bot.js). A mod runs INSIDE the game: it can read the
player's state every physics tick and press the button on an exact tick. That removes most of the guesswork.

Status (2026-11-25): the toolchain is installed and GDLM Probe v0.1.0 is built and installed in the game's geode/mods
(see "Building on this PC"); not run in the game yet. Source: `mods/gdlm-probe/`; reader: `tools/probe.js`. Every mod install and every build needs the
user's OK first. The phone's GD still has no Geode (PUBLISH.md), so this is a PC-only tool.

## What it can settle (our open questions)

| open question (doc) | today's evidence | with a logging mod |
|---|---|---|
| our cube lands 4-21 ticks late at gdsolver's spots (PHYSICS.md "Landing buffer") | plans only | the game's landing tick and y at those spots, read directly |
| ship ~0.5 unit low (Stereo Madness, Hexagon Force, xStep), Back On Track ~1 block high | plans + one video | ship y and vy per tick vs the sim's |
| pink orb 0.5-0.63 vs 0.72, green orb throw, flipped cube floor deaths | noisy video arcs | vy right after the orb, the death cause |
| ship entry speed (lab 67 stations 9-10), mini step, UFO / robot / spider / swing, dual band | unmeasured | per-tick y, vy, mode, gravity, band |
| camera (VISUALS.md "Camera", lib/camera.js) | fitted from video with a clock guess | the camera's real position per frame |
| the clock K and level start D (framecheck) | fitted from take-offs and white bars | none needed: the mod logs ticks from the attempt start |
| does a route beat the level in the game (USE_CASES 26) | bot.js by keyboard: untrusted | the mod presses on the exact tick, logs where it dies |
| the user's attempts (DIFFICULTY.md, presslib, real_stats) | input log + clock fit, deaths by % | every press tick and the death x and cause, exact |

## Existing mods (official index, geode-sdk.org/mods), checked 2026-11-25

GD target is the one the index page lists; the user's Steam game is **2.2091** (checked 2026-11-25), so a mod built
only for 2.2081 does not load: check each mod's 2.2091 build before relying on it (the rows below were read as 2.2081).

| mod | what it gives us | caveats |
|---|---|---|
| **GDShare** (HJfod) | export / import a level as a .gmd from buttons in the game (`hjfod.gdshare` 1.6.0 is built for 2.2081; needs geode.node-ids and hjfod.gmd-api, which the in-game installer pulls). We already write .gmd (`tools/export_gmd.js`), so a level gets in WHILE GD RUNS, no save editing, no install queue | the save-editing install.js stays for the phone slot (online ID kept) |
| **Eclipse Menu** (2.2081) | replay bot (GDR2 macro format), StartPos switcher, show hitboxes, noclip, speedhack, show trajectory, internal recorder | a cheat menu: safe mode while cheats are on (fine for testing). Its bot's file format must be checked before we write macros for it |
| **GDH** (2.2081) | Replay Engine v4 bot, frame stepper (also backwards), startpos switcher, hitboxes, trajectory, recorder | beta; macro format not documented on the page |
| **zBot** (2.2081) | replay bot, frame advance, speedhack | free version has a watermark; format undocumented |
| **xdBot** | replay bot with .gdr / .gdr.json macros (JSON we could write), frame stepper, trajectory | index lists GD 2.2074 only: does not load on 2.2081 |
| **Pathfinder** (camila314, the gdp author; 2.2081) | a solver inside the game: generates a macro from GD's own collision code | no robot, spider, swing, dash orbs, teleports, duals, 2.2 objects: a second opinion on cube / ship / ball / UFO / wave routes only |
| Startpos Switcher | start positions in practice | covered by Eclipse / GDH |

**Do not install mods that change gameplay**, or our sim stops describing the user's game: Click Between Frames
(presses between frames: the sim assumes "Click Between Steps" is off), Accurate Hitboxes (changes spike / saw
boxes), physics bypass / TPS changes. If the user wants one of them for their own play, the sim needs that rule too.

What "show trajectory" (Eclipse, GDH, xdBot) gives: the game's own predicted path for press / no press, drawn
in the level. A screenshot of it next to the sim's path is a quick check with no code.

## Our own mod (a probe): what it takes

Toolchain on the PC, once (docs.geode-sdk.org "Getting started"): Git, CMake 3.29+, LLVM + Ninja (scoop), VS 2022
Build Tools ("Desktop development with C++" + Windows SDK, several GB), the Geode CLI (`winget install
GeodeSDK.GeodeCLI`), `geode config setup`, `geode sdk install`, `geode sdk install-binaries`. Then `geode new`,
`geode build --ninja`, and the CLI copies the .geode into the game's mods folder. Install time: not measured.
It is a build on the user's PC, so it runs through a Remote Control session with their OK.

The mod (C++, small, one file to start, kept in this repo under `mods/gdlm-probe/`):
- Hook the per-tick physics step (`GJBaseGameLayer` / `PlayLayer` update and `PlayerObject` updates; exact
  function names to read from the Geode bindings for 2.2081) and, every tick of an attempt, record: tick,
  x, y, yVel, mode, gravity flipped, on ground, mini, speed, player 2 when dual, the camera position; plus every
  button down / up with its tick, and the attempt's start, death (x, the object that killed) and end.
- Write it as JSON lines to `Mod::get()->getSaveDir()` per attempt, from a background thread or at the attempt's
  end, never inside the input path (CLAUDE.md "Never slow the user's game"); a toggle in the mod's settings, on
  only for our levels or when recording.
- Playback: read an input file (our route's press / release ticks, the format `lib/natural.js` already gives)
  and call the game's button handler (`handleButton`) on those ticks; log the same state so a death shows where
  and why. This replaces tools/bot.js.
- Our side: `tools/probe.js` reads the logs into the shape replay_run.js / attempts.js already use, and a
  `fidelity` diff (sim vs game, per tick, first parting) -- the scoreboard PHYSICS.md "Fidelity" planned.
Effort: not measured. A first logger is ~200 lines of C++ plus the toolchain; playback is a second step.

## The probe mod as written (mods/gdlm-probe, v0.1.0, logger only)

Hooks (names checked in geode-sdk/bindings for 2.2081 and 2.2091, identical there): `GJBaseGameLayer::processCommands(float
dt, bool isHalfTick, bool isLastTick)` (one call per physics step: logs after the step), `GJBaseGameLayer::handleButton(bool
down, int button, bool isPlayer1)` (presses, with the tick they apply in), `PlayLayer::resetLevel` (an attempt starts),
`destroyPlayer` (only when it sets `m_isDead`: GD also calls it with its anti-cheat object at the start), `levelComplete`,
`onQuit`. Fields: PlayerObject `m_position`, `m_yVelocity`, `m_isShip/Bird/Ball/Dart/Robot/Spider/Swing`, `m_isUpsideDown`,
`m_isOnGround`, `m_vehicleSize`, `m_playerSpeed`; GJGameState `m_levelTime`, `m_cameraPosition`, `m_isDualMode`.
Output: one JSON-lines file per attempt in `<GD save>/geode/mods/gdlm.probe/attempts/` (line types at the top of
src/main.cpp), written on a thread when the attempt ends; nothing is written during play. Settings: log on/off, only GDLM
levels. `node tools/probe.js list | show <n> | presses <n>` reads them.
Build (on the PC): `cd mods/gdlm-probe && geode build --ninja` (installs into the game when `geode config setup` was done).
`mod.json`'s "gd" and "geode" fields must match the installed game and loader (check them on the PC before building).
Next: a full sim-vs-game diff per tick (the PHYSICS.md "Fidelity" scoreboard).

## Playback: Claude plays a level in the real game (v0.2.0, 2026-11-25)

**Rule (the user, 2026-11-25 18:40 UTC): no real-game run starts without being announced in the chat first and the user
saying go.** That covers every `probe.js play ... --launch`, a batch, and any GD launch. Say which levels, how many
launches and how long (measured: ~40-75 s per level incl. start-up); a GD window opens on the user's screen each time.
After a stopped run, check `play.json` is not left waiting in the mod's folder (the next GD start would play it).

- `node tools/probe.js play save:<GDLM name> [--attempts N] [--offset k] [--stay] [--launch]` writes
  `%LOCALAPPDATA%/GeometryDash/geode/mods/gdlm.probe/play.json` from the level's saved route (local/solutions):
  `{level, autostart, attempts, quit, offset, presses: [[tick, down, p2]]}`. `--launch` starts GD through Steam (refused
  while it runs) and waits for `play.finished.json`, then prints `result`.
- The mod reads play.json once, at the first main menu, renames it `play.taken.json` (one shot), opens the level from
  Create by name (LocalLevelManager, PlayLayer::scene), presses each route event right before the processCommands call that
  runs once n == tick + offset ticks are done (n = the log's n; our sim's event at tick t acts in the step t -> t+1, so
  offset 0 is the same convention), ignores the user's presses meanwhile, and after the attempts (or a complete) writes
  play.finished.json and exits GD without saving (`--stay`: stays open). Only levels named "GDLM...", so no progress on
  official or other people's levels. Attempt logs get `"playback":1`.
- `node tools/probe.js result [n]`: cleared or died (x, y, killer), and heights game vs sim at the same x.
- **First runs (GDLM 62 low end lullaby, 62 s, 102 presses): CLEARED in the real game twice** (offset 0 and offset 1),
  73 s each from launch to result. Smart App Control let the unsigned mod DLL load.
- **Found on the first run:** GD 2.2091's `PlayerObject::m_position` changes only every 4th processCommands (once per
  60 fps frame) and trails the step by 1-2 ticks, so the log's per-tick x/y are per-frame values; result compares at the
  same x. Heights then agree to 0.5 unit except around some jumps, where the game's jump runs one tick ahead of ours
  (offset 0: the first jump, at tick ~1240, game vy 10.532 vs sim 10.748 = one tick of gravity; with offset 1 that jump
  matches and a later one, tick ~1825, is one tick behind). So the press-to-jump delay is not a constant tick count in
  this mapping -- likely frame-phase dependent (the 4-tick frame). Open, for the physics session: log the real per-tick
  position (the player's position before the frame sync, or log at isLastTick only) and settle the press latency.
- **v0.3.0 (2026-11-25, built, NOT loaded):** logs the per-step physics position too (GameObject's `m_positionX/Y`
  doubles, as `px, py` at the end of each tick's `p`), and plays a batch: `play.json` `{"entries": [{level, attempts,
  offset, presses}, ...]}`; after each entry the mod leaves the level (onQuit -> its edit page, EditLevelLayer::init hook)
  and opens the next, one line per entry in `play.results.jsonl`, `play.finished.json` after the last. `node tools/probe.js
  play <level> <level> ... | --all-gdlm [--max-seconds s] --launch`, `result --last-batch`; `result` on a v0.3 log prints
  the x lag, the first parting step, and every jump's start game-minus-sim by the press's place in its 60 fps frame.
- **Smart App Control blocked v0.3.0's DLL** at first (Geode log: "Blocked by Windows Smart App Control (4551)"); the
  user turned Smart App Control off on 2026-11-25 (16:08 UTC), and since then every build loads.
- **v0.3.1:** a playback ignores GD's pause-on-unfocus (PlayLayer::pauseGame(true)), so it plays on while the user works in
  another window. The in-game switch to the next level (onQuit -> EditLevelLayer -> open) stalled twice after a death, so
  `probe.js play ... --launch` now runs a batch as one GD launch per level (about 15-20 s of start-up each), and stops if
  the user's own GD is running.
- **What the logs hold (2026-11-25):** `m_yVelocity` is per step; `m_position` moves once per 60 fps frame; GameObject's
  `m_positionX/Y` stay 0 on the player (the px, py fields are useless; a true per-step position is still open: try
  PlayerObject's own fields or read it inside PlayerObject::update). **Settled in v0.5.0: the node position (`getPosition()`) is per step.** Findings: PHYSICS.md "The probe mod".
- Open: levels not in the save (import a .gmd). Main levels: done in v0.5.0 (`official:N`, practice mode only; "Overnight batch 2026-11-26" below).


## Overnight batch 2026-11-26: every main level and our GDLM levels in the real game (mod v0.5.1)

The user said yes (2026-11-26, before going to sleep) to GD launching while they slept. 21 main levels (all with a saved
route; Dash has none) and the GDLM levels in the save with a saved route, one GD launch each, muted, quit without saving
(CCGameManager.dat / CCLocalLevels.dat kept their 02:42 time all night).
- **Follow-up (same day):** the jump snap is in the sim on main, with a 10-unit foot margin, 32-bit x and turned player boxes
  on turned hazards (PHYSICS.md "Jump snap, foot margin, 32-bit x"). Replaying each attempt's own presses
  (`probe.js diff`), the sim now dies on the game's death step on 14 of the 21 mains and on GDLM 44 / 64 (before: none);
  the "snap sim" column below is the PROTOTYPE's. Saved main routes are re-solved by `tools/mains.js run`.
- **Mod v0.5.0 / v0.5.1** (`mods/gdlm-probe`): a play.json entry may be `{"official": N}`: the mod opens main level N
  (GameLevelManager::getMainLevel) and plays it in **practice mode only** (togglePracticeMode before the level's first
  reset, which GD runs inside PlayLayer::init: v0.5.0 toggled after it, so attempt 1 ran unplayed in normal mode and the
  played attempt 2 could respawn at an auto checkpoint -- Back On Track from x 570. v0.5.1 fixed it; an attempt that
  starts from a checkpoint or not in practice is never played). Playback mutes FMOD's music and effects (engine only).
  **The true per-step position:** `p[8], p[9]` are now the player node's `getPosition()`, which moves every 240 Hz step:
  at log step n it equals our sim's state after step n-1 (x to 0.01). The checkCollisions hook (`cc`) never fired.
- `node tools/probe.js play --mains --launch` (or `official:N ...`), then `node tools/probe.js table [--stats]`
  (one row per playback since the batch began; `--stats` adds them to local/real_stats.jsonl with `source: "probe"`).
  Measured: 12-54 s per main level from launch to result (they all die early), ~12 min for the 21.
- **Result: every main level dies in the game, where our sim clears its route.** In 17 of 21 the first parting is a
  +1.0 x step at a landing: GD 2.2's jump snap (PHYSICS.md "The probe mod"), which our sim lacks. With the snap added
  (prototype, `GDLM_SNAP=1`, branch `probe-jump-snap`, not on main) our sim's run of the same route dies within 2-11
  units of the game's death on 8 levels (Dry Out, Base After Base, Can't Let Go, Jumper, Cycles, Theory of Everything,
  Clubstep, Hexagon Force), x stays exact much longer (Stereo Madness 17.5 s instead of 5.2 s; Polargeist, Time Machine,
  xStep, ToE, Blast Processing, Deadlocked, Fingerdash: no x gap at all before the game's death). So the saved main
  routes are sim-only until the snap is in physics and they are re-solved. The other early partings (y first: Geometrical
  Dominator at 0.8 s, Deadlocked 3.5 s, Electrodynamix 4.7 s, Back On Track / Polargeist / Time Machine 3.5-3.7 units) are
  the next calibration targets, found with `probe.js result <log>`.

| level (practice) | real game | sim today | first parting today | sim with the snap (GDLM_SNAP=1) | first parting with it |
|---|---|---|---|---|---|
| Stereo Madness | died x 5900 (18.9 s) | clears | x at x 1618 (5.2 s, dx 1.0); y at x 1797 (5.8 s, dy -0.5) | dies x 16860 | x at x 5456 (17.5 s, dx -0.8); y at x 5896 (18.9 s, dy -14.6) |
| Back On Track | died x 15531 (49.8 s) | clears | x at x 1176 (3.8 s, dx 1.0); y at x 1428 (4.6 s, dy 3.6) | dies x 11208 | x at x 8656 (27.7 s, dx -0.7); y at x 4999 (16.0 s, dy 3.5) |
| Polargeist | died x 8332 (26.7 s) | clears | x at x 1705 (5.5 s, dx 1.0); y at x 2748 (8.8 s, dy 3.6) | dies x 17837 | no x gap > 0.5; y at x 7618 (24.4 s, dy -0.5) |
| Dry Out | died x 9693 (31.1 s) | clears | x at x 1088 (3.5 s, dx 1.0); y at x 1280 (4.1 s, dy -0.5) | dies x 9696 | x at x 3293 (10.6 s, dx -0.9); y at x 3591 (11.5 s, dy 0.5) |
| Base After Base | died x 7657 (24.6 s) | clears | x at x 2410 (7.7 s, dx 1.0); y at x 2458 (7.9 s, dy -0.5) | dies x 7662 | x at x 1820 (5.8 s, dx -1.0); y at x 2278 (7.3 s, dy 0.5) |
| Cant Let Go | died x 8328 (26.7 s) | clears | x at x 641 (2.1 s, dx 1.0); y at x 800 (2.6 s, dy -0.5) | dies x 8333 | x at x 4368 (14.0 s, dx -0.9); y at x 4228 (13.6 s, dy -0.5) |
| Jumper | died x 5419 (17.4 s) | clears | x at x 734 (2.4 s, dx 1.0); y at x 897 (2.9 s, dy -0.5) | dies x 5425 | x at x 3540 (11.3 s, dx 1.1); y at x 3837 (12.3 s, dy 0.5) |
| Time Machine | died x 4525 (14.5 s) | clears | x at x 4311 (13.8 s, dx 1.1); y at x 3408 (10.9 s, dy 3.7) | dies x 10246 | no x gap > 0.5; y at x 3408 (10.9 s, dy 3.7) |
| Cycles | died x 13735 (44.1 s) | clears | x at x 1346 (4.3 s, dx 1.0); y at x 1242 (4.0 s, dy -0.5) | dies x 13738 | x at x 1346 (4.3 s, dx 1.0); y at x 1242 (4.0 s, dy -0.5) |
| xStep | died x 4709 (15.1 s) | clears | x at x 1336 (4.3 s, dx -0.7); y at x 1436 (4.6 s, dy 0.5) | dies x 5667 | no x gap > 0.5; y at x 2066 (6.6 s, dy 2.5) |
| Clutterfunk | died x 11132 (35.7 s) | clears | x at x 1497 (4.8 s, dx 1.0); y at x 2120 (6.8 s, dy 0.5) | dies x 12082 | x at x 1742 (5.6 s, dx 1.0); y at x 2128 (6.8 s, dy 0.5) |
| Theory of Everything | died x 10134 (32.5 s) | clears | x at x 9193 (29.5 s, dx 1.1); y at x 4348 (14.0 s, dy -0.5) | dies x 10137 | no x gap > 0.5; y at x 4348 (14.0 s, dy -0.5) |
| Electroman Adventures | died x 6983 (22.4 s) | clears | x at x 796 (2.6 s, dx 1.0); y at x 927 (3.0 s, dy -0.5) | dies x 3494 | x at x 2751 (8.8 s, dx -1.0); y at x 2533 (8.1 s, dy 3.5) |
| Clubstep | died x 3991 (12.8 s) | clears | x at x 1668 (5.4 s, dx 1.0); y at x 2938 (9.4 s, dy -0.5) | dies x 3993 | x at x 1358 (4.4 s, dx -1.0); y at x 2196 (7.0 s, dy -0.5) |
| Electrodynamix | died x 5064 (14.5 s) | clears | x at x 2342 (7.5 s, dx 0.6); y at x 1472 (4.7 s, dy -3.8) | dies x 12064 | x at x 2342 (7.5 s, dx 0.6); y at x 1472 (4.7 s, dy -3.8) |
| Hexagon Force | died x 4912 (14.9 s) | clears | x at x 1061 (3.4 s, dx 1.0); y at x 2307 (7.4 s, dy 0.5) | dies x 4923 | x at x 3548 (11.4 s, dx 0.7); y at x 3743 (11.9 s, dy 0.5) |
| Blast Processing | died x 4824 (15.5 s) | clears | x at x 1771 (5.7 s, dx 1.0); y at x 2528 (8.1 s, dy 0.5) | dies x 5269 | no x gap > 0.5; no y gap > 0.5 |
| Theory of Everything 2 | died x 3713 (11.7 s) | clears | x at x 3344 (10.7 s, dx 0.7); y at x 3349 (10.8 s, dy 0.9) | dies x 10288 | x at x 3344 (10.7 s, dx 0.7); y at x 3349 (10.8 s, dy 0.9) |
| Geometrical Dominator | died x 2141 (6.9 s) | clears | x at x 1233 (4.0 s, dx 1.0); y at x 257 (0.8 s, dy -1.0) | dies x 12646 | x at x 1233 (4.0 s, dx 1.0); y at x 257 (0.8 s, dy -1.0) |
| Deadlocked | died x 2451 (7.9 s) | clears | no x gap > 0.5; y at x 1096 (3.5 s, dy -2.0) | dies x 12508 | no x gap > 0.5; y at x 1096 (3.5 s, dy -2.0) |
| Fingerdash | died x 2994 (9.6 s) | clears | x at x 1522 (4.9 s, dx 1.0); y at x 2299 (7.4 s, dy -0.5) | dies x 1629 | no x gap > 0.5; no y gap > 0.5 |

Our GDLM levels in the save with a saved route (normal mode; the save's copies, which may be older than levels/ -- Hellgate is v1 there):

| level | real game | sim today | first parting today | sim with the snap | first parting with it |
|---|---|---|---|---|---|
| GDLM 72 FROSTBITE | died x 23247 (70.6 s) | clears | x at x 11148 (35.8 s, dx -0.5); y at x 8552 (27.4 s, dy 0.5) | dies x 16976 | x at x 1734 (5.6 s, dx -1.0); y at x 1859 (6.0 s, dy 0.5) |
| GDLM 44 hellgate | died x 6638 (21.3 s) | clears | x at x 402 (1.3 s, dx 1.0); y at x 1074 (3.5 s, dy -0.5) | dies x 6640 | no x gap > 0.5; y at x 1848 (5.9 s, dy -5.8) |
| GDLM 68 camera lab | died x 1371 (4.4 s) | clears | no x gap > 0.5; y at x 893 (2.9 s, dy 0.5) | dies x 19376 | x at x 995 (3.2 s, dx -1.0); y at x 893 (2.9 s, dy 0.5) |
| GDLM 64 golden hour v5 | died x 4104 (13.2 s) | clears | x at x 2293 (7.4 s, dx 1.0); y at x 3057 (9.8 s, dy -0.5) | dies x 5338 | x at x 2426 (7.8 s, dx -1.0); y at x 3051 (9.8 s, dy 0.6) |
| GDLM 52 necromancy | died x 10765 (34.6 s) | clears | no x gap > 0.5; y at x 1036 (3.3 s, dy -1.0) | dies x 15897 | x at x 6120 (19.6 s, dx -0.7); y at x 1036 (3.3 s, dy -1.0) |
| GDLM 62 low end lullaby | cleared | clears | x at x 11148 (35.8 s, dx -0.5); y at x 13428 (43.1 s, dy 0.5) | clears | x at x 11148 (35.8 s, dx -0.5); y at x 13428 (43.1 s, dy 0.5) |

- GDLM 62 clears in the game again (3 of 3 runs now). FROSTBITE shares its opening, so both part at the same ship step (x 11148, -0.5 unit): a ship-x mismatch, not the snap; FROSTBITE then dies at x 23247 on a spike, sim clears.
- The save's Hellgate dies at x 6638 as on 2026-11-25; with the snap our sim dies at 6640: the snap explains that death. Camera lab dies at 1371 (4.4 s) with no x gap: a y parting at 893 (+0.5), open. Necromancy (x 10765) parts in y at 3.3 s (-1.0), open.
- GDLM colour test has no saved route (skipped).

## Practice -> full run (v0.4.0, 2026-11-25; USE_CASES 11)

The user asked (2026-11-25): "do we have something that can make a run from a practice run from start to end?" Built:
- **The mod (v0.4.0)** logs practice checkpoints: each attempt's start line gets `lt` (the level time it starts at: > 0 when
  a practice respawn restored a checkpoint), `step`, `from` (the unique id of the checkpoint it started from, -1 = the
  level's start), `cps` and `hold` (jump button down as it began); a `cp` line when a checkpoint is stored (`id`, `lt` =
  the level time that checkpoint restores to, the player's x, y; `via` store = the PlayLayer::storeCheckpoint hook, tick =
  caught on the next tick when the hook did not fire), `cpdel` / `cpclear` when the delete key removes one / all.
- **`node tools/stitch.js [<level name>] [--level <what>] [--save] [--partial]`** walks back from the newest practice
  attempt that reached the end: its start checkpoint -> the attempt that stored it -> that one's start checkpoint ... ->
  the level's start, and joins each attempt's presses up to the next checkpoint. Ticks are absolute (attempt start =
  round(checkpoint level time x 240) + the log's n). At a seam the button is set to what the next attempt began with.
  Then our sim plays the joined run (cleared, or where it dies) and prints, at each checkpoint, the game's x against the
  sim's (how far the sim has drifted from the real run). Output `local/stitched/<level>_<ms>.json`; `--save` adds it
  to local/attempts/ (source "stitch") so the viewer shows it as a ghost and `tools/video.js <level> --run <id>` films it.
- **In the real game:** `node tools/probe.js play save:<GDLM name> --events local/stitched/<file>.json --launch` plays the
  stitched run unbroken in normal mode (GDLM levels only; announce it and get the user's go first, see "Playback").
- **First real session (Clubstep, 2026-11-25, 41 attempts, cleared in practice from 83.78 s):** v0.4.0 logged only ONE
  checkpoint: `CheckpointObject::m_uniqueID` reads 0 for every checkpoint on 2.2091, and the mod skipped a checkpoint whose
  id equalled the last one. Fixed twice: stitch.js matches checkpoints by their tick (an attempt's start level time ->
  the newest earlier attempt that ran past that tick), so v0.4.0 logs stitch as they are; mod v0.4.1 tells checkpoints
  apart by pointer and logs a checkpoint's id and `from` as its tick. Also seen: attempt #1 began in normal mode and was
  switched to practice mid-run, storing the first checkpoints -- stitch.js counts every attempt, not only practice ones.
- **Clubstep stitched (2026-11-25):** 14 of 41 attempts -> one 86.56 s run, 173 presses, two seams where the respawn let
  go of a held button (release added). Our sim dies on a saw at 24.91 s (29%); at the checkpoints the sim's x trails the
  game's by 1.5 / 3.3 / 6.2 units (9.8 / 15.8 / 21.7 s) and its height is 19 units off by 21.7 s. So the joined run is
  the user's, the gap is our physics on Clubstep (for the physics session: a real 2.2091 run to compare against, attempt
  `stitchmwwml7sr` in local/attempts/official_14.jsonl, logs in the mod's attempts folder). Open: is the x lag the drawn
  position's 1-2 tick lag or a real speed difference.
- Test: `node tests/stitch.js` (a solved level's route cut at three checkpoints with wasted attempts and junk presses
  stitches back to the route and clears; a held seam; old logs refused).
- **Not checked in the game yet** (needs v0.4.0 built + installed, then the user plays a level in practice): whether
  storeCheckpoint fires for both Z-key and auto checkpoints, whether a respawn's level time is exactly the checkpoint's
  (stitch.js warns on a mismatch or drift), and whether presses on the seam tick belong before or after it (warned as
  "+-1 tick is unsure"). Known limits: one player and the jump button (no dual / platformer), no time-warp levels.
  GD restores a checkpoint from saved state, so a stitched run may still part from the practice run where a respawn
  is not exact (rotation, moving objects): the real-game playback is the final word.

## Install into a running GD (v0.6.0, 2026-11-27; board task `mod-hot-install`)

No more closing GD to install: `node tools/install.js <level.gdlvl>` with GD running hands the level to the probe mod.
- **The inbox:** `<GD save>/geode/mods/gdlm.probe/install/<id>.req.json` = `{id, name, record, save}`, record = the level's
  plist record exactly as install.js would put it in the save (spec description + signature, length label k23). Written as
  .tmp + rename. Answer: `<id>.result.json` `{status: installed | failed, why, position, replaced, online_id, saved, song}`;
  the request becomes `<id>.taken.json`. `node tools/hotinstall.js results` lists them (and pending ones).
- **Only on menus** (CLAUDE.md "Never slow the user's game"): a CCScheduler callback once a second returns at once while a
  PlayLayer or the editor exists; it also waits during a scene transition and while the page (EditLevelLayer) of the level
  being replaced is open. A request made mid-attempt waits until the user leaves the level (install.js says "waiting in
  GD's inbox", exit 3, and the mod installs it later). No work in any per-tick hook.
- **How the level is made:** `DS_Dictionary::loadRootSubDictFromString(record)` + `GJGameLevel::createWithCoder` (what GD
  does for each k_N of its own save), type Editor. A local level with the same name is replaced at its index in
  `LocalLevelManager::m_localLevels`, keeping m_levelID / m_levelVersion / m_accountID / m_unlisted (k1/k16/k60/k79, as
  install.js's keepOnline; m_isUploaded = false, as dropping k15), so Share updates the same upload; else it is inserted at
  index 0 (top of My Levels). Only names starting "GDLM".
- **Song:** an unknown custom song's info is asked from GD's server by GD itself (`MusicDownloadManager::getSongInfo(id,
  false)`); install.js copies the mp3 from local/songs into GD's folder (a plain file). It does NOT edit CCGameManager.dat
  while GD runs (GD writes it on exit).
- **Saved at once:** `LocalLevelManager::save(false)` right after (GD's own writer, on the menu), so a crash cannot lose it and
  install.js reads the save back (same level string as the request) and reports it. Backup of the on-disk save first, as
  always.
- **Is the mod there:** the mod writes `probe.status.json` `{version, pid}` at the first main menu; install.js uses the inbox
  only when its version is >= v0.6.0 and its pid is the running GeometryDash.exe. Otherwise (mod off, older, not yet at the
  menu) the level goes to the install queue (PUBLISH.md), exit 3. `--slot` still needs GD closed.
- A closed-game install of the same name drops any older request still pending (`.dropped.json`), so a later GD start can't
  put the older version back.
- **Test:** `node tests/install_hot.js` (temp folder, a fake mod in a child process: ready check by version and pid, the
  request's record, the answer, a request left waiting, dropping, queue fallback). Throwaway level for a real test:
  `node tools/hotinstall.js testlevel` -> local/tmp/gdlm_test_install.gdlvl ("GDLM test install", 43 objects, no song).
- **First real run (v0.6.0, 2026-11-27, GD pid 38680):** status written 01:57:14, request 01:57:20, but the mod took it only
  at **02:02:12** -- one second before GD shut down (02:02:13, Geode log) -- although the user had been on menus all along (no
  attempt logs). Then it worked as designed: added at the top, `saved: true`, install.js read the save back ("same level
  data"), and GD's exit save kept it (CCLocalLevels.dat after exit: "GDLM test install" first of 33, hellgate's online ID
  152848491 untouched). So building the level, replacing/inserting and saving work; **the once-a-second check did not run on
  the menus** (a CCScheduler timer on a plain CCObject; why it fired only at the quit is not known -- v0.6.0 logged nothing
  while waiting). v0.6.1: each menu layer (MenuLayer, CreatorLayer, LevelBrowserLayer, EditLevelLayer) also schedules the
  check on itself, and probe.status.json carries `ticks`, `tick_ms`, `src` (which timer fired) and `last` (idle / waiting:
  why / installed) every 5 s, with a log line when it starts and when it waits.
- **v0.6.1 in the game (2026-11-27, pid 35008): works.** A request left in the inbox while GD was closed went in at the first
  menu (log: "install inbox running (scheduler)" and "installed" at 02:05:31, 1 s after "All mods up to date!"; replaced in
  place, saved). Then a live `node tools/install.js local/tmp/gdlm_test_install.gdlvl` with GD on the main menu: replaced,
  saved and read back in **1.2 s** for the whole command. The `src` was "scheduler" both times, so the director's timer
  does fire; v0.6.0's 5-minute wait stays unexplained (it logged nothing). If it happens again, `probe.status.json`'s `last`
  says why. Ticks counted 10 -> 13 between 02:05:43 and 02:05:54 (less than one a second; maybe the user was in a level).
- Build from a worktree: `set GEODE_BUILD_DIR=%USERPROFILE%\geode-build\gdlm-probe-<name>` before `tools\geode_build.cmd`
  (a build dir of its own; the default one is tied to the main checkout's mod folder). v0.6.0 was built so, cold.

## Building on this PC (2026-11-25)

- Installed: Geode loader **v6.0.0** in the game (`Geode.dll` 6.0.0.0, changelog), GD **2.2091**. Toolchain: CMake 4.4.4,
  Ninja 1.13.2, LLVM/clang-cl 23.1.6 (winget: 37 / 4 / 82 s), VS 2022 Build Tools + "Desktop development with C++"
  (MSVC 14.44, SDK 10.0.26100; winget, 219 s), Geode CLI (winget, 4 s).
- **Smart App Control is ON and blocks the Geode CLI** (`geode.exe` is unsigned; Code Integrity events 3033/3077). Nothing
  else was blocked (CMake, Ninja, LLVM, GD and Geode.dll run). So no `geode config/sdk/build`: the SDK was set up by hand --
  `git clone --branch v6.0.0 geode-sdk/geode C:\Users\evgbo\geode-sdk`, the release's `geode-v6.0.0-win.zip` unpacked into
  `bin/6.0.0/` (what `install-binaries` does), `GEODE_SDK` set for the user -- and the build runs with
  `-DGEODE_DISABLE_CLI_CALLS=ON`; `tools/geode_pack.js` does the CLI's packaging (zip of mod.json, about.md, `<id>.dll`).
  With CLI calls off, CMake does NOT check mod.json's "gd"/"geode" against the SDK: keep them right by hand.
- **Build:** `tools\geode_build.cmd [mod dir] [--install]` (vcvars64 + clang-cl + Ninja, build dir
  `%USERPROFILE%\geode-build\<mod>`, outside OneDrive). Cold build ~60-95 s (configure fetches the bindings, then compile);
  output `%USERPROFILE%\geode-build\gdlm-probe\gdlm.probe.geode`. `--install` copies it to the game's geode/mods and refuses
  while GeometryDash.exe runs.
  **Gotcha:** the build dir is keyed by the mod folder's NAME only, so building the same mod from another worktree fails at
  configure ("source ... does not match the source ... used to generate cache"). Build from a copy with another folder name
  (`mods\gdlm-probe-v040`: its own build dir, cold ~2 min with the 36 s configure) or from the main checkout. v0.4.0 (checkpoint
  logging) built this way with no source changes, 2026-11-25.
- **MSVC cl does not compile Geode 6.0.0's headers** (C3615 constexpr in utils/file.hpp, FileError over asp::fs::Error):
  use clang-cl. main.cpp built as written (no changes needed for 6.0.0 / bindings 2.2091).
- The SDK's CMake prints a notice for AI-agent builds: building and using the mod locally is fine; a mod mostly written by
  an AI is not accepted on the Geode Index. We don't submit it.
- Open: Smart App Control may still refuse to load our freshly built, unsigned `gdlm.probe.dll` inside GD (no reputation
  yet). If Geode says the mod failed to load, look in Event Viewer > CodeIntegrity for gdlm.probe.dll.

## Plan (ranked)

1. **GDShare now** (no code): import our levels in the game while it runs. 1.6.0 supports 2.2081 (checked 2026-11-25);
   the game is 2.2091 -- check for a 2.2091 build first.
2. **The probe mod, logging first**: settles the landing, ship height, orbs and camera at once, and makes every
   recording exact. Then `tools/probe.js` + the fidelity diff. Biggest payoff.
3. **The probe's playback** (built, v0.2.0: "Playback" above): our routes in the real game, tick-exact (USE_CASES 26), the main levels and every
   GDLM level before it goes to the user.
4. **Interim, no C++**: Eclipse Menu's show hitboxes / trajectory / startpos for quick looks; its replay bot to
   play a route only once we know how to write its file (GDR2: check before relying on it).
5. **Pathfinder** as a second solver for cube / ship / ball / UFO / wave, to compare routes.

Open: which mods the user installed; GDR2's layout (does it store positions?);
the bindings' names for the tick hook on 2.2081.

Sources: https://geode-sdk.org/mods/eclipse.eclipse-menu, https://geode-sdk.org/mods/tobyadd.gdh,
https://geode-sdk.org/mods/fig.zbot, https://geode-sdk.org/mods/zilko.xdbot,
https://geode-sdk.org/mods/camila314.pathfinder, https://github.com/HJfod/GDShare-mod,
https://geode-sdk.org/mods/syzzi.click_between_frames, https://geode-sdk.org/mods/tyegurr.accurate-hitboxes,
https://docs.geode-sdk.org/getting-started (prerequisites, cpp-stuff, sdk, create-mod), https://docs.geode-sdk.org/mods/savedata
