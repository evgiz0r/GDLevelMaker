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

Levels are `.gdlvl` files in `levels/`. Import one with the same Geode mod you use to
export levels (the exported "cube timings" in `examples/` came from it), from the
Create -> My Levels screen. Each level shows up under its name, starting `GDLM`.

## Writing a level

Specs are short JSON files in grid squares -- see the top of `tools/make.js`.
