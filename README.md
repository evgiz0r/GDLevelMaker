# GDLevelMaker

Geometry Dash levels written by Claude from a description, checked for being beatable by a
small physics simulation, replayed in a browser viewer with their clicks, and imported into
the real game to play.

Unofficial; not affiliated with RobTop Games.

## Try it

Needs Node 18+ (no packages).

```
node tools/make.js specs/01_one_jump.json   # build a level, check it, add it to the viewer
node tools/check.js levels/*.gdlvl          # beatable? clicks and timing windows
node tools/serve.js                         # viewer at http://localhost:8765/viewer/
```

In the viewer: space plays/pauses, R restarts, arrow keys step (shift = bigger steps),
"hitboxes" shows what really collides, and you can drop any `.gdlvl` on the page.

## Putting a level into the game

On Windows, with the game **closed**:

```
node tools/install.js levels/gdlm_01_one_jump.gdlvl
```

This writes the level into the game's save (`%LOCALAPPDATA%\GeometryDash\CCLocalLevels.dat`),
at the top of Create -> My Levels. Installing a level again replaces the copy already there
(matched by name). Each run backs the save up first to `GeometryDash\gdlm_backups\`; to undo,
close the game and copy a backup back over `CCLocalLevels.dat`. `--dry` checks without writing.

The game must be closed because it rewrites the save when it exits.

## Writing a level

Specs are short JSON files in grid squares -- see the top of `tools/make.js`.
