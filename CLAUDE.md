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

## Calibration -- what is confirmed in the user's game

The physics numbers are community reverse-engineering, not measured here. Until a line moves
from "assumed" to "confirmed", a level that is tight in the sim may be impossible in the game
or easy. Write each confirmation here with how it was checked.

Assumed (not yet checked in the game):
- 1x speed 311.58 units/s; cube jump 2.17 blocks high, 0.43 s long.
- Spike hitbox 6x12 centred; cube 30x30 outer (lands), 9x9 inner (dies on blocks).
- A triple spike at 1x has a ~48 ms window in the sim (the user's own level has one at the
  start, and they beat it, so it is possible in the game: consistent).

Confirmed:
- (none yet)

## Not simulated yet

Orbs, pads, portals, speed changes, other game modes, slopes. The viewer draws orbs and pads
and greys out unknown ids; the solver ignores them, so a level that uses them reports
"not beatable". Add one at a time, each with a test level the user plays to confirm it.

## Rules

- Never commit songs (Newgrounds songs belong to their artists) or other people's levels
  without their OK. The user's own levels in `examples/` are fine.
- Not affiliated with RobTop; do not use GD's art or name the repo/tool as if it were official.
- Unknown object ids: never guess silently. Mark `sure:false`, and ask the user what the object
  is in the editor.

## Later (said, not built)

- Playing on the phone too: how to get an updated level onto the phone while away from the PC.
