# GDLevelMaker

Geometry Dash levels written by Claude from a description, checked for being beatable by a
small physics simulation, replayed in a browser viewer with their clicks, and imported into
the real game to play.

**Watch the levels in your browser: https://evgiz0r.github.io/GDLevelMaker/** (our levels, replayed with their
clicks; songs and the game's art are not hosted -- pick a level's song file from your own device to hear it).

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
node tools/install.js levels/archive/gdlm_01_one_jump.gdlvl
```

This writes the level into the game's save (`%LOCALAPPDATA%\GeometryDash\CCLocalLevels.dat`),
at the top of Create -> My Levels. Installing a level again replaces the copy already there
(matched by name). Each run backs the save up first to `GeometryDash\gdlm_backups\`; to undo,
close the game and copy a backup back over `CCLocalLevels.dat`. `--dry` checks without writing.

The game must be closed because it rewrites the save when it exits.

## Letting the bot play it

To check in the real game that a level is beatable, without playing it yourself:

```
node tools/bot.js levels/archive/gdlm_01_one_jump.gdlvl
```

Open the level's page in the game, run this, press Play and take your hands off. The bot watches
the screen for the start of each attempt and presses Space at the solver's click times; after a
death it tries again (`--attempts 3`). It needs nothing installed (Windows PowerShell compiles
`tools/keybot.cs` on the fly), presses only Space, and only while the game is the active window.
Normal mode only. `node tools/bot.js --probe` just checks it can see the game.

## Writing a level

Specs are short JSON files in grid squares -- see the top of `tools/make.js`.
