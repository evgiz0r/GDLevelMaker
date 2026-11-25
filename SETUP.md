# Setting GDLevelMaker up on your own computer

Written so that **an AI coding agent can do the whole setup by itself** (Claude Code, or any agent that can run
commands). A person can follow it too. If you are a human with an agent, open it in this folder and say:

> Read SETUP.md and set GDLevelMaker up on this computer, at least so the main levels play in the viewer.

You need your **own copy of Geometry Dash** (Steam, GD 2.2). Nothing of RobTop's is in this repo: the main levels,
GD's art and the main songs are read from your game folder, and anything made from them stays in `local/`, which git
ignores. What the repo does carry for the main levels is our own work: the press timings that beat them
(`knowledge/mains/routes.json`, no level data).

## For the agent: do these steps in order

Stop and tell the user at any step that fails, with the line the script printed. Every command runs from the repo root.

1. **Check Node.js.** `node --version` must be 18 or newer. If it is missing or older, ask the user to install the
   current LTS from nodejs.org (do not install it without asking). No `npm install` is needed: the project has no
   packages.
2. **Run the setup script:** `node tools/setup.js`
   - It looks for GD in Steam's usual folders and every Steam library listed in `libraryfolders.vdf` (Windows, macOS,
     Linux with Proton), and for GD's save folder. It writes what it found to `local/gd_paths.json`; every tool reads
     GD's files through `tools/gdpaths.js` after that.
   - If it prints `FAIL Geometry Dash found`: ask the user where GD is installed (in Steam: right-click Geometry
     Dash -> Manage -> Browse local files), then run `node tools/setup.js --game "<that folder>"`. On macOS pass the
     app's `Contents` folder (`.../Geometry Dash.app/Contents`). The right folder is the one with `Resources/levels/1.txt`.
   - `warn` lines are optional parts (GD's art in the viewer, songs, the save folder): report them, carry on.
   - It ends with `READY` (exit 0) or `NOT READY` (exit 1). `--json` prints the same as JSON.
3. **If some main levels did not get a working route**: the script prints the command that fixes them. Two cases:
   - *Dies at N%*: the sim changed since the route was saved. `node tools/mains.js run <n ...>` re-solves from a bit
     before the trouble. Minutes to an hour per level; heavy, runs one at a time. Ask the user before starting a long
     batch.
   - *No route in git* (a `warn` line, not a failure): our sim has not beaten that level yet (Dash, 2026-11-25), or the
     routes file is missing. `node tools/difficulty_solve.js all <n ...>` solves from scratch (long: up to an hour+ each).
   The level still shows in the viewer meanwhile: it just has no replay until it is solved.
4. **Start the viewer:** `node tools/serve.js` (leave it running), then open http://localhost:8765/viewer/ .
   - Main levels are in the level picker under "official". A link straight to one:
     `http://localhost:8765/viewer/#lv=local/official_01.json` (01 = Stereo Madness ... 22 = Dash).
   - **To verify without a person** (agents): load that link (add `?mute=1` before the `#` so it makes no sound) and
     check the info panel says `Beatable in N clicks`. If it says "Find the route", that level has no route yet
     (step 3). The page must show no script errors.
   - On a computer that is not the project owner's, start it with `node tools/serve.js 8765 --no-update` unless you
     want it to fast-forward its own checkout to `origin/main` every minute (it only does that on branch `main`
     with a clean tree).
5. **Tell the user** what works: how many main levels replay, whether GD's art and songs were found, the viewer link.

That is the whole setup. Re-running `node tools/setup.js` is safe: it keeps routes already in `local/` (`--force`
replaces them with the ones from git).

## Rebuilding local data: what a new computer has, and how long the rest takes

The owner's PC has a lot in `local/` that is not in git. A new computer starts with what git carries and rebuilds the
rest only when it needs it. Times come from measured runs on the owner's PC (16 GB) or in the cloud. "Not measured"
means nobody has timed it yet. Heavy jobs run one or two at a time (`tools/heavy.js`), so a batch adds up.

| what | on a fresh clone | rebuild with | how long | basis |
|---|---|---|---|---|
| our levels (GDLM) with their replays | in git (`levels/`, routes in `viewer/levels.js`) | nothing | 0 | |
| main levels 1-21 + their routes | levels from your game, routes from git (`knowledge/mains/routes.json`, kept current by the owner's PC) | `node tools/setup.js` | ~15 s: 21 of 22 replay to the end in 14.6 s (Fingerdash 9.9 s, the others 0.1-1.3 s) | `mains_routes.js check` on the owner's PC, 2026-11-25 |
| a main level whose route dies on today's sim | replays to the death spot | `node tools/mains.js run <n>` | replan 5-97 s; resume 29-95 s; the slow ones: Fingerdash replan 42 min, Hexagon Force resume 21 min, Deadlocked resume 5-32 min | DIFFICULTY.md "Main levels kept current", 2026-11-25 batch: 22 levels in 84 min |
| a main level with no route at all | listed, no replay | `node tools/difficulty_solve.js <n>` | one full solve: Hexagon Force 25 min (568 s search + route); all 22 from scratch: not measured, hours | PHYSICS.md "Hexagon Force: beaten" |
| Dash (22) | listed without a replay: not beaten in our sim yet (open physics, being worked on) | waits on that physics work | | DIFFICULTY.md, PHYSICS.md |
| difficulty scores of the main levels | not in git | `node tools/difficulty.js` | levels 1-20: ~16 min; Fingerdash's score hung past 60 min (open) | DIFFICULTY.md, 2026-11-25 |
| main levels' timing windows (lego) | in git (`knowledge/lego_windows/`) | nothing; re-measure only after a physics change | 0; re-measure 10-60 s a level, Geometrical Dominator 5.5 min, Deadlocked 15.5 min (35-45 min for all) | LEGO.md |
| bricks cut from levels (lego pieces) | not in git | `node tools/lego.js mine` | ~20 s (~0.3 s a level) with the windows from git | LEGO.md |
| main songs | read from your game's `Resources/` in place | nothing | 0 | |
| beat grids of the songs | in git (`viewer/song_grids.js`) | nothing | 0 | |
| custom songs our levels use | GD downloads each one the first time you play the level | or `node tools/songs.js <id>` | the tool waits 3 s between songs; the download itself is not measured | tools/songs.js |
| community levels (taste corpus, demon list) | not in git (other people's levels); the learned numbers are (`knowledge/taste_model.json`) | `node tools/taste.js fetch`, `tools/fetch_level.js`, `tools/demonlist.js` | rate-limited: 1.2-2.5 s wait per request, so ~330 levels take 10+ min of waits alone; total not measured | the tools' built-in waits |
| gdsolver's real-game plans | not in git | copy `data/` from github.com/gdsolver/gdsolver into `local/gdsolver/` | seconds | |
| the owner's recordings, attempts, marks, save stats | personal | cannot be rebuilt | | |

For the main levels the short answer: with the routes in git, a new computer plays all of them after a few seconds of
setup (Dash excepted, until the sim beats it). Without them, solving everything again would be hours of heavy jobs.
The solve rows above are only for a route that no longer replays (after a physics change the owner's PC re-solves and
re-exports by itself) or for a level git has no route for.

## Putting our levels into your game

Our levels are the `levels/gdlm_*.gdlvl` files (named "GDLM NN ..." in the game).

- **Windows, game closed:** `node tools/install.js levels/<file>.gdlvl` writes it to the top of Create -> My Levels.
  It backs up your save first (`GeometryDash/gdlm_backups/`). It refuses while GD runs, because GD rewrites the save
  when it exits. Ask the user before writing to their save.
- **Any platform, with the GDShare mod (Geode):** `node tools/export_gmd.js levels/<file>.gdlvl` makes a `.gmd` in
  `export/`; import it in GD with GDShare.
- **Online:** if the owner uploaded a level, search its ID in GD.

## Phone

The PC viewer reads GD's files from the PC. A phone viewer that loads your GD resources once and keeps them is not
built yet (PHONE.md for what the phone page does today). The public site (PAGES.md) shows only our own levels.

## What lives where

| what | where | in git? |
|---|---|---|
| main levels 1-22 (RobTop's) | your game: `Resources/levels/N.txt` | no, never |
| their routes (our press timings) | `knowledge/mains/routes.json` | yes |
| main levels + route, ready for the viewer | `local/official_NN.json` (made by setup) | no |
| GD's art, main songs | your game's `Resources/`, served by `tools/serve.js` at `/gdres/` and `/song/` | no, never |
| where your GD is | `local/gd_paths.json` (or env `GD_GAME`, `GD_LEVELS`, `GD_SAVE`) | no |

## For maintainers

- `node tools/gdpaths.js` prints where GD was found and how. A new tool that reads GD's files takes its folders from
  `require("./gdpaths.js")` (`GAME`, `LEVELS`, `SAVE`), never a hardcoded Steam path.
- **The routes in git stay current by themselves:** `tools/mains.js run` and `replan` re-export
  `knowledge/mains/routes.json` and push it (`node tools/mains.js export [--push]` by hand; `mains_routes.js export` is
  the same). `node tools/mains_routes.js check` replays them on today's sim and writes nothing. On import, a human route
  that dies falls back to the file's raw solve when that still clears (shown as kind "raw").
- Test: `node tests/setup.js` (a copy of the repo with no `local/`, a fake GD folder made from our own GDLM 01).
- Timing: setup is a few seconds plus the replays (14.6 s for the real 22 on the owner's PC, 2026-11-25: 21 clear, Dash has no route yet).
