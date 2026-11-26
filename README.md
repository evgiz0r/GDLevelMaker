# GDLevelMaker

Geometry Dash levels written by Claude from a description, checked for being beatable by a
small physics simulation, replayed in a browser viewer with their clicks, and imported into
the real game to play.

**Watch the levels in your browser: https://evgiz0r.github.io/GDLevelMaker/** (our levels, replayed with their
clicks; songs and the game's art are not hosted -- pick a level's song file from your own device to hear it).

Unofficial; not affiliated with RobTop Games.

## Welcome: what it can do

Each row is a flow you can run: what goes in, what comes out, the command, how far along it is, and how long a run
takes. Maturity: **5** = used all the time and checked against the real game, **4** = works and is used, **3** = works,
first version, **2** = built but barely tried, **1** = started. Times are from measured runs (where and when in the
source column), or "not measured".

| in -> out | command | maturity | how long a run takes | source |
|---|---|---|---|---|
| a description or brief -> a level (song beats -> sections -> layout -> theme and deco), checked | `node tools/loop.js <brief>` (compose.js) | 3: levels come out beatable and gated; looks and taste still behind the main levels (QUALITY.md) | one make + score per repair round; a make is 15-30 s for a short cube level, ~2 min for 40-100 s with modes, 13 min once with no saved route | CLAUDE.md "How long things take" |
| a level -> its route (the solver's and a human-like one), timing windows; main levels also an all-coins route | `node tools/make.js <spec>`, `node tools/difficulty_solve.js <n>`, `node tools/mains.js run` | 4: 21 of 22 main levels beaten in the sim (Dash open), real-game plans and the user's recordings as checks | our levels: as make above; a main level re-planned: 5 s-42 min, re-solved from scratch: ~25 min (Hexagon Force) | DIFFICULTY.md "Main levels kept current" |
| a level -> difficulty score and a page of where it comes from (cost per press, per mode stretch) | `node tools/difficulty.js <level>`, `node tools/balance.js <level> --html out.html` | 4: 0.87 against the main levels' stars on clean routes | balance: 0.5 s on a 14 s cube level, 30 s on a 40 s level with modes | cloud, GDLM 41 / 45, 2026-11-25 |
| a level -> taste score (learned from ~330 rated levels) with repetition | `node tools/taste.js score <level>` | 3: a first model, the user's soft rules on top | under 1 s | cloud, GDLM 41 / 45, 2026-11-25 |
| levels <-> structure bricks: cut into 1-3 s pieces, or which bricks a level is built from | `node tools/lego.js mine`, `node tools/lego.js variety <level>`, `node tools/lego_match.js <level>` | 3 | mine ~20 s for all levels; variety and match under 1 s | LEGO.md; cloud, 2026-11-25 |
| two or more levels -> side by side (difficulty v1/v2 and curve, taste, modes, windows, brick mix), the one ahead per row, a page | `node tools/compare.js <A> <B> [--thumbs]` (PR #3) | 3: first version | ~20 s for two short cube levels; 149 s for GDLM 70 vs 72 with pictures | COMPARE.md, cloud 2026-11-25 |
| a level -> thumbnail of its best-looking moment (+ a 3 s gif) | `node tools/thumb.js <level> [--gif]` (PR #3) | 3: first version | 6-10 s in the cloud; PC with GD art not measured | THUMBS.md, cloud 2026-11-25 |
| a level + a route -> video with the song and an end screen (GD's look; stays local) | `node tools/video.js <level> --route` | 3 | 2.2-4.7x the level's length (Jumper, 90 s: 202-408 s) | CLAUDE.md, 2026-11-25 |
| a level -> playable in the browser with its music, on PC and phone | `node tools/serve.js`, the phone page (PHONE.md) | 4 | seconds to open | |
| a drawing or marks in the viewer -> layout edits | the viewer's ✏ draw and ✎ mark, `node tools/sketch.js <id> --fit`, `node tools/markedit.js` | 3 | an edit: 1-5 s in cube or ball, 25-65 s next to a ship stretch | EDITING.md, PHYSICS.md "Incremental solving" |
| a level -> into your GD (only with your OK) -> the real game plays it and reports cleared / died | `node tools/install.js <level>`, `node tools/probe.js play save:<name> --launch` | 3: GDLM 62 cleared first try | ~15-20 s of GD start-up per level, plus the level's length; install not measured | GEODE.md "Playback" |
| your practice attempts in GD -> one stitched start-to-end run, checked in the sim | `node tools/stitch.js [<level>] --save` | 2: built 2026-11-25 | not measured | GEODE.md "Practice -> full run" |
| your GD save -> your levels and demons with attempts and best % | `node tools/save_stats.js --demons` | 3 | not measured | DIFFICULTY.md |
| song start point and song switches mid-level | spec / brief key `"music"` (make.js) | 2: the start point works; switches heard in the viewer and video, not checked in the game yet | part of make | MUSIC.md |
| the whole project -> set up on another computer, main levels playing | `node tools/setup.js` | 3: tested on a fresh copy; the routes replay on the owner's real levels (21 of 22 clear); not yet tried on a second computer | ~15 s (replays: 14.6 s) | SETUP.md |

**Ideas that would be easy from here** (not built): a level -> a practice copy with start positions at its hard parts
(difficulty per section exists); a level + another song -> the same level re-synced to the new beats; two
levels -> one, joined at a seam that fits (the lego seam contract exists); a level -> "explain this jump" notes in the
viewer from the windows and costs already measured. USE_CASES.md lists every use case and what each still lacks.

## Set it up on your own computer

You need your own Geometry Dash (Steam, 2.2) and Node 18+. **[SETUP.md](SETUP.md)** is written so an AI agent can do
the whole setup itself: open Claude Code (or another coding agent) in this folder and say *"Read SETUP.md and set
GDLevelMaker up on this computer"*. By hand: `node tools/setup.js`, then `node tools/serve.js`. The main levels, GD's
art and songs come from your own game; nothing of RobTop's is in this repo.

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
