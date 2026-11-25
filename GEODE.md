# Geode: mods as ground truth from the real game

The user installed Geode (GD's mod loader) on the PC on 2026-11-25. Until then the game was plain GD 2.2081 on
Steam, and everything we know about the real game came from screen recordings (tools/track.py, framecheck,
landbuf), a keyboard input logger with a clock fitted afterwards (tools/inputlog.ps1, replay_run.js), gdsolver's
published plans, and a keyboard bot nobody trusts yet (tools/bot.js). A mod runs INSIDE the game: it can read the
player's state every physics tick and press the button on an exact tick. That removes most of the guesswork.

Status: research only (2026-11-25). Nothing installed or built. Every mod install and every build needs the
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

GD target is the one the index page lists; the user's Steam game is 2.2081.

| mod | what it gives us | caveats |
|---|---|---|
| **GDShare** (HJfod) | export / import a level as a .gmd from buttons in the game. We already write .gmd (`tools/export_gmd.js`), so a level gets in WHILE GD RUNS, no save editing, no install queue | version on the index not checked yet; the save-editing install.js stays for the phone slot (online ID kept) |
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

## Plan (ranked)

1. **GDShare now** (no code): import our levels in the game while it runs. Check it loads on 2.2081.
2. **The probe mod, logging first**: settles the landing, ship height, orbs and camera at once, and makes every
   recording exact. Then `tools/probe.js` + the fidelity diff. Biggest payoff.
3. **The probe's playback**: our routes in the real game, tick-exact (USE_CASES 26), the main levels and every
   GDLM level before it goes to the user.
4. **Interim, no C++**: Eclipse Menu's show hitboxes / trajectory / startpos for quick looks; its replay bot to
   play a route only once we know how to write its file (GDR2: check before relying on it).
5. **Pathfinder** as a second solver for cube / ship / ball / UFO / wave, to compare routes.

Open: which mods the user installed; GDShare's 2.2081 version; GDR2's layout (does it store positions?);
the bindings' names for the tick hook on 2.2081.

Sources: https://geode-sdk.org/mods/eclipse.eclipse-menu, https://geode-sdk.org/mods/tobyadd.gdh,
https://geode-sdk.org/mods/fig.zbot, https://geode-sdk.org/mods/zilko.xdbot,
https://geode-sdk.org/mods/camila314.pathfinder, https://github.com/HJfod/GDShare-mod,
https://geode-sdk.org/mods/syzzi.click_between_frames, https://geode-sdk.org/mods/tyegurr.accurate-hitboxes,
https://docs.geode-sdk.org/getting-started (prerequisites, cpp-stuff, sdk, create-mod), https://docs.geode-sdk.org/mods/savedata
