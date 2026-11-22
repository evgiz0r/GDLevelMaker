# GDLevelMaker -- instructions for the AI

Claude writes Geometry Dash levels from a description, checks they can be beaten, shows them
replaying with their clicks, and hands back a file the user imports into their real game.
The user plays it and tells us what was off. Read this fully first.

## The loop

1. Write a spec in `specs/NN_name.json` (grid squares, see the top of `tools/make.js`).
2. `node tools/make.js specs/NN_name.json` -> `levels/<name>.gdlvl`, solved, added to the viewer.
3. Look at it: `node tools/serve.js` and open http://localhost:8765/viewer/ (or open
   `viewer/index.html` straight from disk in a normal browser). It replays the solver's clicks
   with a click sound, the timing window of each click, and hitboxes on request.
4. With the game closed, `node tools/install.js levels/<name>.gdlvl` puts it at the top of
   My Levels (backs the save up first; refuses while GeometryDash.exe runs). The user plays it
   and reports. The user's game is plain GD 2.2 on Windows, no Geode: there is no in-game import.
5. What they report that the sim got wrong is a calibration fact: write it below.

Every level the tool makes is named `GDLM NN ...` so it is easy to find (and delete) in the
user's created-levels list.

## Files

- `lib/gd.js` -- the format: base64url + gzip layers, the record (plist) and the level string.
- `lib/objects.js` -- object ids: name, kind, hitbox. `sure:false` = from memory, unconfirmed.
- `lib/physics.js` -- cube physics + solver (fewest clicks, each in the middle of its window).
- `tools/` -- node CLIs: `make`, `check`, `roundtrip`, `index_levels`, `serve`.
- `viewer/index.html` -- the replay viewer; `viewer/levels.js` is generated, do not edit.
- `examples/` -- levels the user made in the game, for reference and as format ground truth.

All the library code runs in both node and the browser (no build step, no dependencies).
Keep it that way: one copy of the physics, used by the checker and the viewer alike.

## The format (confirmed on a real GD 2.2 export)

- A `.gdlvl` is `base64url(gzip(record))`. The record is a plist `<dict>`: `k2` name, `k3`
  description (base64url), `k4` level string (base64url(gzip)), `k45` custom song id,
  `k48` object count, `k21` 2 = local level, `kCEK` 4 = level.
- Level string: `header;obj;obj;...;`. Object = `key,value,...`: 1 id, 2 x, 3 y,
  4 flipX, 5 flipY, 6 rotation (deg), 21 colour channel, 155 (seen as 1 or 2 on every
  object; meaning unconfirmed). Header `kA4` = start speed (0 = 1x).
- One grid square = 30 units; x,y are object centres; ground top is y=0.
- `node tools/roundtrip.js examples/*.gdlvl` must print `ok` -- re-serialising a real level
  gives back the same record and the same objects.

## Physics sources

- camila314/gdp (branch 2.2): hand decompilations of GD 2.2 physics functions -- speeds, gravity,
  jump, landing snap (15), fall clamp (15), orbs, pads.
- iArtie/GD-2.2081-Decompiled: full 2.2081 decompile (some decompiler errors).
- Open-GD/OpenGD: a 2.1 reimplementation -- hitbox sizes, the 0.9 slow factor on vertical motion.
- gdsolver/gdsolver: an existing 2.2 "is it beatable" solver with measured constants; worth
  reading before reinventing anything.
Values live in `lib/physics.js` (SPEEDS) and `lib/objects.js`.

## Calibration -- checked against the user's game

How: the user says "record", "reshoot" (close the current file, start a new one) or "stop".
Run `tools/record.sh start` in the background (whole screen, 60 fps, Desktop Duplication, to
Videos/Captures/GD claude-rec <time>.mkv) and `tools/record.sh stop`. Capturing the GD window
by its title freezes on one frame (the game draws with the GPU): a whole run was lost that way.
Game Bar (Win+Alt+R) also works, at ~30 fps, but records whatever window is active -- the user
got clips of the Claude app. Best runs: practice mode with "Show Hitboxes" on. Track the lime cube by colour per frame with
real frame times (the capture is variable frame rate: read pts with ffprobe, never assume 60).
At 1080p one unit is exactly 3.375 px (a block is 101 px). GD's camera moves up and down, so
measure heights against something in the level (ground line, a ceiling), never the screen.

Confirmed:
- Cube jump: matches the recording to 1.8 px rms (0.5 unit) over a whole arc
  (`node tests/jump_video.js`). So 1x speed timing, yStart, gravity and the 240 Hz / 0.9
  stepping hold.
- Spike hitbox 6x12 centred, orb box 36x36: seen in a hitbox-on frame.
- Object 1338 is a 45-degree slope (its hitbox outline is the staircase in the recording).
- Red orb 1.38 x yStart: the user's upside-down dive in the recording bottoms out 122 units below
  the ceiling; the sim gives 124. Measured against the ceiling row's top edge per frame (the
  camera drops during the dive).
- The cube has no head bump: its outer box grazing a block's corner from the head side does
  nothing, only the 9x9 inner box kills (the same dive clips a ledge corner and carries on).
- Flipping gravity halves vertical speed (blue orb and ceiling blue pad in the recording move at
  half the decompile's velocity). The decompile's ringJump alone does not show this.

Assumed (not yet checked):
- Going 300 units above the highest object counts as a death (otherwise the solver "wins" by
  falling up into the sky). Ask the user whether GD kills you up there.
- Spider teleport searches a 9-unit strip above/below the cube.
- Dash orbs: horizontal at the orb's angle while held; the props 586/588 on them are unknown.
- "Click Between Steps" is OFF in the user's settings: presses land on a frame boundary, not any
  240 Hz step. The solver still allows any step.

## Status of the solver on "cube timings" (examples/)

Beaten: 11 presses plus a dash release, tightest window 21 ms (the blue orb). Every part of
the level is in the sim: triple spikes, blue orb + ceiling blue pad, slope, dash orb, red orb,
spider orb + pad, the upside-down red-orb dive under a hanging column.

## Not simulated yet

Ship, ball, UFO, wave, robot, spider and swing modes; mini size; mirror and dual portals;
slopes other than plain floor slopes (rotated or ceiling ones act as blocks); triggers.

## Rules

- Never commit songs (Newgrounds songs belong to their artists) or other people's levels
  without their OK. The user's own levels in `examples/` are fine.
- Not affiliated with RobTop; do not use GD's art or name the repo/tool as if it were official.
- Unknown object ids: never guess silently. Mark `sure:false`, and ask the user what the object
  is in the editor.

## Later (said, not built)

- Playing on the phone too: how to get an updated level onto the phone while away from the PC.
