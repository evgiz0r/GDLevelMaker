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
3. **If some main levels did not get a working route** (the line `main levels playable in the viewer` says fewer than
   22): the script prints the command that fixes them. Two cases:
   - *Dies at N%*: the sim changed since the route was saved. `node tools/mains.js run <n ...>` re-solves from a bit
     before the trouble. Minutes to an hour per level; heavy, runs one at a time. Ask the user before starting a long
     batch.
   - *No route in git*: `node tools/difficulty_solve.js all <n ...>` solves them from scratch (long: up to an hour+ each).
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
- **Keep the routes in git current:** after `tools/mains.js run` re-solves levels on the owner's PC, run
  `node tools/mains_routes.js export` and commit `knowledge/mains/routes.json`. `node tools/mains_routes.js check`
  replays them on today's sim and writes nothing.
- Test: `node tests/setup.js` (a copy of the repo with no `local/`, a fake GD folder made from our own GDLM 01).
- Timing: setup is a few seconds plus one replay per main level (not measured on the real 22 yet).
