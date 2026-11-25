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
- **Smart App Control blocked v0.3.0's DLL** (Geode log 08:59:25: "Blocked by Windows Smart App Control (4551)";
  CodeIntegrity 3033/3077). v0.2.0's DLL had loaded with no event. SAC judges each new unsigned file by cloud reputation,
  so any rebuild of the mod may or may not load. We do not try to get around it (no rebuild-until-it-passes). The ways
  forward are the user's: turn Smart App Control off (Windows Security > App & browser control; Windows can only turn it
  back on with a reinstall), or sign the DLL with a trusted code-signing certificate (paid). Until then the installed
  v0.3.0 shows a load error in Geode and logs nothing.
- Open: levels not in the save (import a .gmd); official levels in practice mode only.


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
