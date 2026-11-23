# GDLevelMaker -- instructions for the AI

Claude writes Geometry Dash levels from a description, checks they can be beaten, shows them
replaying with their clicks, and hands back a file the user imports into their real game.
The user plays it and tells us what was off. Read this fully first.

**What the project is for:** USE_CASES.md lists every use case the user wants (prompt -> level, fix a
level, issue report, difficulty, design in chat, combine/cut, track + level...) with its status and
what is missing. Update its row when your work moves one.

## Every session builds the project, not just its own task

The user's standing rule: **no work is done only for its local goal.** Each session's job is its
task AND leaving the project's knowledge, tools and structure better for every later session --
which starts knowing nothing but what is written in this repo. Concretely, as part of the task,
not after it:

- **Findings go where the next session looks.** A measured number, a game rule, a gotcha, a
  method that worked: into the right doc (`CLAUDE.md` for how to work here; `DIFFICULTY.md`,
  `SYNC.md`, `STYLE.md` for those areas; `knowledge/` for GD knowledge and the user's critiques;
  Calibration below for physics facts). Not only in a chat reply or a commit message.
- **Scripts become tools.** Anything you ran twice, or that found a bug, goes into `tools/` (or
  `tests/` if it checks something) with a usage line at the top -- never left in a scratchpad.
- **Docs stay true.** When you find a note wrong or stale, fix it in the same change. A stale
  note is worse than none.
- **Structure is part of the work.** If something has no obvious home, make one and link it from
  here (the "Files" list) so it can be found. Keep this file the map of the project.
- **A new topic gets set up by the AI, unasked.** When work opens a topic that is more than a
  small local fix (a new game mode, a new kind of measurement, a new data source, a new workflow
  with the user), setting up its knowledge is the AI's job, not the user's: its own doc (or
  section) with what is known, the sources, how to test it and what is open; a line here pointing
  to it; and, if a session owns it, who that is. Don't wait to be asked.
- **Use what others learned, every round.** (The user, 2026-11-23: "if we gain knowledge on the fly,
  I do want sessions to use it.") A long session reads the docs once and then misses what the
  others learn. So before each new level or round: `git pull`, then re-read
  `knowledge/checklist.md`, `TASTE.md`, `STRUCTURES.md` and your own area's doc (what changed since
  your last round). A new lesson goes in as one line of the checklist in the same commit, and as a
  `make.js`/`score.js` check where possible -- code beats docs. `tools/wip.js` stamps each note
  with the checklist commit it was built against.
- **Every note from the user is a soft rule, not a spot fix.** (The user, 2026-11-23: "i obviously
  want each fix to be somewhat a soft rule. and reapplied across the level and anything in the
  future.") When the user marks one jump, orb or patch, name the family it belongs to (e.g. "a
  spike with a step right after it", "an orb off its structure's centre"), write it as one line in
  `knowledge/checklist.md`, turn it into a scored check (a warning with a threshold, or a ranking
  penalty -- soft: a level may break it with a stated reason, not silently), sweep every existing
  level and the structure library for other instances, and make `compose`/`make.js` avoid it in new
  levels. Reply with the rule and how many other spots it found, not only "fixed".
- **When stuck, study bigger, and own the level.** (The user, 2026-11-23: "if we are stuck we
  need to make bigger studies and experiments. and own our level.") When the same kind of note keeps
  coming back, or our levels stay below the official ones on a measured axis (QUALITY.md), stop
  patching: run a study (take real levels apart, measure, write the rules down -- CRAFT.md is one) or
  an experiment (several variants, measured and shown side by side), then change the generator.
  Owning a level means caring for all of it -- play, look, sync, fairness -- not only your one area.
- **Git is the source of truth: everything goes in the repo, and it gets pushed.** (The user,
  2026-11-23.) Commit and push to `main` as each piece of work lands (merge `origin/main`, run the
  quick checks, push) -- never sit on local-only commits or uncommitted work between turns. Tools,
  docs, specs, our levels, tests, measured numbers: in git. The only things that stay out are what
  must not be published: other people's levels and RobTop's data/art, songs, the user's recordings
  and save, and private details (`local/`). If something can't be pushed (a blocked permission, a
  failing check), say so in your report instead of leaving it local.
- **Hand off.** Before a long pause or when your area changes hands, write where you stopped,
  what is open and the good numbers into your area's doc.
- **Share, don't duplicate.** Results go into the shared `local/` (see below) so no session redoes
  another's work; tell the session that owns an area when you learn something about it.

## Before making or judging a level: read knowledge/

`knowledge/` is a general GD knowledge base (not the user's personal taste): `design.md` (what
makes a level good or unfair) and `critiques.md` (playtest feedback on GDLM levels) are required
reading before writing a spec; `levels/`, `glossary.md`, `demonlist.md` for the rest.
**Before a level goes to the user, go through `knowledge/checklist.md`**: every target in one page
(fairness, orbs, arrows, structure, variety, the 2.2 look, length), each with the tool that checks it.

## The loop

**One command for steps 2-3 and the wip:** `node tools/loop.js <spec | brief | level.gdlvl> [--look]
[--render] [--map] [--session <name> --note "..."]` -- stops if another session is changing that level,
prints an ETA, waits for the heavy-job slot (tools/heavy.js), runs make (or compose) -> score (every gate) -> pictures -> `wip.js put`, stops at the first
failure with the reason, and ends with READY / NOT READY, presses, tightest window, picture paths and the
wip version. It never installs or uploads. Each step's time goes to `local/timings.jsonl` (see "How long
things take" below). The tools below still work one by one.

1. Write a spec in `specs/NN_name.json` (grid squares, see the top of `tools/make.js`).
2. `node tools/make.js specs/NN_name.json` -> `levels/<name>.gdlvl`, solved, added to the viewer.
3. Look at it: `node tools/serve.js` and open http://localhost:8765/viewer/ (or open
   `viewer/index.html` straight from disk in a normal browser). It replays the solver's clicks
   with a click sound, the timing window of each click, and hitboxes on request.
   For the phone: the same viewer as the user's private Artifact (PHONE.md): pushed levels,
   every session's work in progress live, marks from the phone. Republish it when the viewer or
   the pushed levels change (`node tools/web.js --out <scratchpad>/web`, link in local/phone/url.txt).
4. With the game closed, `node tools/install.js levels/<name>.gdlvl` puts it at the top of
   My Levels (backs the save up first; refuses while GeometryDash.exe runs -- then queue it:
   `node tools/install_queue.js add <file> --by <who>`, the watcher installs it when GD closes). The user plays it
   and reports. The user's game is plain GD 2.2 on Windows, no Geode: there is no in-game import.
   Or the bot plays it: `node tools/bot.js levels/<name>.gdlvl` presses Space at the solver's
   click times in the real game (no mod; it syncs to each attempt's start on screen and measures
   its own lag from ground jumps). A clear confirms the sim; a death is where they disagree --
   unless the window there is under ~30 ms (the bot is good to about a frame). Ask the user
   before running it: it takes over their keyboard while GD is in front.
   STATUS (2026-11-22): NOT TRUSTED YET. First real run (GDLM 42) printed CLEARED, but the user
   saw it jump off the beat and die -- its death detection missed it and its jumps came ~36 ms
   early (default offset since moved +20 ms). Next try: run tools/record.sh during it, compare
   the video's jump times with the plan, then fix detection before believing a "CLEARED".
5. What they report that the sim got wrong is a calibration fact: write it below.

Every level the tool makes is named `GDLM NN ...` so it is easy to find (and delete) in the
user's created-levels list.

## One heavy job at a time -- in code (tools/heavy.js)

The PC has 16 GB; a solve takes ~0.8-1.5 GB. On 2026-11-23 five heavy jobs from different sessions ran
at once and the PC hung (0.2 GB free), so the rule is now a lock every heavy tool takes ITSELF on start
(`make`, `compose`, `score`, `solutions`, `wip put`, `shoot`, `levelmap`, the `difficulty*` / `fairness*` /
`tas*` solvers, `windows`, `press_window`, `stop`, `polish`, `structures`, `check`, `sightread`, ...):
- one heavy job at a time (two while more than 6 GB is free), and none starts under 1.5 GB free;
- while the user plays (GeometryDash.exe runs): one job whatever is free, and none starts under 2 GB free;
- every heavy job lowers itself to idle CPU priority at start, so the game and the desktop always win;
- the others wait and say so: `heavy: waiting for tools/make.js ... (<session>, pid, N min in, ~M min left)`;
- the slot is a file in the shared `local/locks/heavy/` (real path, all worktrees); a dead pid's slot is
  cleared, a child of a holder runs in its parent's slot. `node tools/heavy.js` shows who holds it.
- **A new heavy tool adds the line** `if (require.main === module) require("./heavy.js").claim();` after
  its header (tests/heavy.js checks the main ones). Never run heavy work outside a tool that claims it
  (`node -e` solves, scratch scripts); `GDLM_HEAVY=off` only when the user says so.
- Measuring or testing runs work on copies (`local/tmp/`), never on a level another session is changing:
  `tools/loop.js` stops when another worktree has uncommitted changes to the spec or level, or another
  session put it in work in progress in the last 3 hours.

## How long things take (this PC: 16 GB, other sessions' jobs running)

The user wants to know how long a wait will be. **Before a job over ~30 s, tell the user roughly how long
it takes** (from this table, or the ETA `tools/loop.js` prints). When a run is far off (over 2x, or under
half), correct the row here in the same change. Real numbers pile up in `local/timings.jsonl` (every
`loop.js` step; any other job with `node tools/loop.js --time <step> <command>`); `node tools/loop.js
--times` prints them by level length. Wait for the heavy-job slot comes on top of all of these.

| job | how long | source |
|---|---|---|
| make, short cube level (15-20 s) | 15-30 s | loop.js, GDLM 02 / 41, 2026-11-23 |
| make `--look` (decoration only, gameplay unchanged) | ~1 s | showcase notes, GDLM 50 |
| make (= the solve), 40-100 s level with ship / wave / ball | 5-7 min | PHONE.md (GDLM 45 ~5 min), SHOWCASE.md (GDLM 50 ~7 min) |
| score.js, every gate, short cube level | 10-20 s | loop.js, GDLM 02 / 41 |
| score.js, level with modes | ~2 solves + ~1 min fairness: 10-15 min | score.js header; not timed yet |
| compose.js (brief, repair rounds) | one make + score per round | not timed yet |
| solve an official level (`difficulty_solve.js`) | minutes to an hour+ (checkpoints every 30 s) | not timed yet: use `--time solve-official` |
| render frames (`shoot.js`, 8 frames) | ~10 s; ~1 min with before/after | SHOWCASE.md, POLISH.md |
| level map (`levelmap.js`), with a saved solution | ~5 s (without one the page solves: minutes) | loop.js, GDLM 41 |
| polish report (`polish.js --dry`) | 1-3 min | POLISH.md |
| readability check | ~8 min for a 12 s level | POLISH.md |
| wip put (solution cached by make) | a few s | wip.js |
| install into the game (`install.js`, game closed) | not timed yet (publisher: `--time install`) | |
| a server upload | not timed yet (publisher: `--time upload`) | |
| git pull + push | ~10 s | 2026-11-23 |

## Shared folder, work in progress, the user's marks

Every session works in its own git worktree, but `local/` (never committed) is ONE shared folder:
- **Once per worktree, between jobs: `node tools/link_local.js`.** It merges your `local/` into the
  main checkout's (newest file wins), keeps yours as `local.before-share/`, and links `local/` to
  the shared one. From then on solved levels, beat grids, recordings notes and marks are shared --
  don't re-solve what another session already solved (check the file; one heavy job at a time).
  Stopping a long official solve to free the PC costs nothing: `tools/difficulty_solve.js` checkpoints
  every 30 s to `local/difficulty/NN.part.json` and the next run on the same physics carries on from it.
- **The level you are working on: `node tools/wip.js put <level.gdlvl> --session <your name>
  --note "what changed"` after every change.** It goes to `local/wip/<session>/`, and the viewer
  (`node tools/serve.js`, http://localhost:8765/viewer/) lists it under "in progress" with its
  version; the user presses ⟳ refresh to see the newest, before anything is pushed. **Then run
  the ArtifactData call it prints**, so the phone page shows it too (PHONE.md).
- **Real-game stats go to every owner, at once** (the user: "anytime we have stats about a new level
  from real game, lets send it to physics/difficulty/style and so on for analyzing"). After analysing a
  recording (the physics session owns recordings), add each attempt to `local/real_stats.jsonl` with
  `node tools/real_stats.js add '<json>'` (level, version, video, attempt, death %/x, mode, cause, whether
  the sim agrees, inputs forced right after a mode change, the window there; `node tools/real_stats.js
  [level]` lists them). Then send each level's stats straight to every session it concerns, not through
  the main one: difficulty (predicted vs real deaths), style (GDLM layout), polish (the user's own
  levels), knowledge (critiques, community levels) and the main session. x from GD's % (x = level end x
  * % / 100) is approximate; a frame-measured x says so in its cause or sim note.
- **The user's marks** (✎ in the viewer, pinned to a moment and a spot) go to `local/marks.jsonl`
  with the level's file and `session`. `node tools/marks.js` lists open ones: handle the ones with
  your session, then `node tools/marks.js done <id> "what changed"`. Marks from the phone: fetch
  them first with one ArtifactData `list` (PHONE.md); marks.js then shows them with the rest.
- **Links:** the viewer's address keeps `#lv=<file>&t=<seconds>` (🔗 copies it), so a link the
  user sends opens that level at that moment.

## Files

- `lib/gd.js` -- the format: base64url + gzip layers, the record (plist) and the level string.
- `lib/objects.js` -- object ids: name, kind, hitbox. `sure:false` = from memory, unconfirmed.
- `lib/physics.js` -- physics of every mode, triggers + solver (fewest clicks, each in the middle of its window;
  every window is replay-checked tick by tick: `solve` merges near-twin states, which once claimed ticks that die).
  PHYSICS.md: per mode and trigger, its constants, sources, checks and what is open.
- `lib/difficulty.js` -- difficulty score from a solution: the human route (one tap per jump), per-input
  timing windows, a timing-error + lapse model fitted on the user's real runs; see DIFFICULTY.md
  (also the tier ladder for making levels, and what is open). Its tools: `difficulty` (score a level,
  or all official levels vs ratings and the user's attempts), `difficulty_solve` (cache an official
  solution, one at a time; `--resume` after a physics change solves only from a bit before where it matters), `difficulty_fit` (refit on the user's runs), `difficulty_community`
  (score downloaded community levels), `runs` (the user's deaths from a recording, via the progress
  bar), `save_stats` (the user's lifetime attempts per official level, read-only from the save),
  `difficulty_parts` (how much windows and CPS alone explain the stars), `skips` (does a saved route skip a portal: then no number from it), `quality` (the scorecard: official 1-10 vs every GDLM level, QUALITY.md), `stop` (where a level's saved solution dies in the sim and what killed it), `difficulty_route` (a level with and without route choice: a player avoids a hard timing when the
  level has an easier way), **`fairness`** (deaths that are not the player's fault: forced input after
  a portal, misleading marks, sloped portal exits, orb chains with nothing to correct; fitted on the
  user's labelled deaths, `fairness fit`; tools/score.js gates on it; DIFFICULTY.md "Fairness").
- `lib/sync.js` -- music sync: level time <-> x through speed portals, beat grid <-> level beats,
  press timing windows from a solution, sync scores. See SYNC.md (also where songs come from).
- **The phone page** (PHONE.md: what is on it, what a session does after `wip.js put`, phone
  marks, how it was tested, what is open): `tools/web.js` builds it from the viewer.
- `tools/` -- node CLIs: `make`, `check`, `roundtrip`, `index_levels`, `serve`, `beats` (beat grid
  of every song on this PC, ffmpeg + JS), `sync` (how well levels follow their song's beat), `frames` (timing windows with 60 fps presses, as the user's game has them), `press_window` (which press ticks get the player through one spot, from a given position: the human window there), `windows` (every input's timing window in any mode, by moving it and replaying; the work is `lib/windows.js`, a player's window with later inputs re-planned, the one definition the viewer's button strip, score.js and difficulty share; `--strict` the old fixed-inputs rule), `real_stats` (the user's real-game attempts on our levels, local/real_stats.jsonl), `web` (the viewer as a phone page, PHONE.md), `songs` (custom songs by id into local/songs/, as GD gets them; SYNC.md section 6), `songmap` (songs' beat clarity, sections, drops, and how levels follow them; SYNC.md section 7), `hits` (a song's real hits per half-beat -- kick, snare, accent -- and `--level`: the share of a level's presses on one; SYNC.md section 8), `hitlevel` (an ultra-synced level from a list of hits: every press pinned to a kick or snare, GDLM 62), `fetch_level` (online levels by ID into local/community/, for measuring only, never committed), `community` (study rated community levels: list, fetch, measure, modes, comments; see knowledge/README.md), `tiercheck` (does each section look like rated Easy/Normal or Hard/Harder sections of its mode; `--tier Easy`), `variety` (kinds of thing, portals, modes, speeds, repeated chunks vs rated levels; knowledge/levels/variety.md), `obstacles` (block structure per mode, obstacle shapes, when new kinds come in; knowledge/levels/obstacles.md), `modern_look` (how 2.2 rated levels are decorated: objects per block, layers, colour, triggers per section; knowledge/levels/modern_look.md), `difficulty` (score vs the official ratings).
- **Structures: a ranked library of 1-3 s layouts** (STRUCTURES.md: format, how each is checked, the
  ranking rules, results, what is open; owner: the style session): `tools/structures.js` (`list`,
  `check`, `build <id>`, `rank`, `page`), results in `knowledge/structures.json`, a picture page for the
  phone (link in local/phone/structures_url.txt). Every cube-in/cube-out one is the pattern `"s:<id>"`,
  and compose.js puts one in every plain cube section by default (`"structures": false` = off).
- **Level style and the idea -> level loop** (STYLE.md: findings, style vocabulary, the loop, every
  playtest lesson, what is open): `tools/style.js` (measure style: deco share, triggers, sections,
  rests, motifs, recurring chunks) + `tools/corpus.js` (official levels and the user's save, in
  memory), `tools/patterns.js` (named gameplay chunks incl. ship tunnel / wave zigzag with their
  portals), `tools/decorate.js` (block skins, ground deco, colour / alpha / zoom triggers, jump
  indicators), `tools/compose.js` (brief with sections -> spec -> build -> score -> repair rounds; sections in beats that follow the song, each with its mode -- cube, ship, wave, ball, upside-down -- and its look, STYLE.md 2b; `--dry`, `--section n`;
  briefs in `briefs/`, a log per level), `tools/score.js` (every gate a level must pass before the
  user sees it), `tools/sightread.js` (prejumps), `tools/inputs.js` (a solution's inputs with
  modes), `lib/natural.js` (a natural replay plan: taps, no empty jumps). Test:
  `node tests/style_gates.js`.
- **Craft: how RobTop builds and dresses a level** (CRAFT.md: Jumper and xStep studied object by object;
  many small pieces over a hazard floor, deco attached to structures, black-and-white playfield on one
  hue; the numbers vs ours; owner: the craft session): `tools/craft.js` (`roles`, `map` -- a text picture
  with the deco --, `check` -- the craft targets).
- **Scene levels, decorated by hand** (SHOWCASE.md: GDLM 50 eclipse, what made it look good, numbers,
  what is unchecked in the game): `tools/scenekit.js` (recipes: own colour channels, palettes per section,
  skylines, the eclipse set piece, stars, designed blocks, motes, light rays, a top frame, lock-to-player
  parallax, beat pulses, text), a level's scene script `tools/scenes/<name>.js` (spec key `"scene"`).
  `node tools/make.js <spec> --look` rebuilds a decoration-only change in a second (keeps the solve when
  the gameplay is the same; the jump arrows are placed again from the saved route). Owner: the showcase session.
- **Taste, learned one level at a time** (TASTE.md: the taste loop's rounds -- one new approach per level,
  compared with rated levels in GD art -- and every rule of taste with the note it came from; read it
  before making or judging a level). Round 1: GDLM 51 adrift (`tools/scenes/adrift.js`: depth as the
  story, looping motion -- scenekit `bob`, `sway`, jellyfish, fish, kelp, water surface, rocks).
  **The user's notes as soft rules, swept over every level**: `node tools/softrules.js [level ...]`
  (jump arrows a block in front of hazards, corridor mouths flush, flash rate; score.js gate `arrows`).
  Owner: the showcase session.
- **The section planner: a song -> a journey of little places** (SCENES.md: the rules, theme packs,
  what a rated illustrated level does): `node tools/scenes.js <song> [--theme ...] [--brief ...]` -- per
  section its role (intro/groove/build/drop/ride/breather/outro), place, palette, mode, transition,
  camera, props; `--brief` writes a compose brief. Owner: the showcase session; props from the gd-art
  session's `tools/props.js`.
- **`tools/heavy.js` -- the one-heavy-job lock** every heavy tool takes on start (see "One heavy job at
  a time"). Test: `node tests/heavy.js`.
- **`tools/loop.js` -- the whole make/iterate loop in one command** (owner check, ETA, make/compose, score,
  shoot, levelmap, wip; logs under `local/loop/`), `--times` prints the measured time table, `--time <step>
  <cmd>` times any other job into it. Test: `node tests/loop.js`.
- `tools/solutions.js` -- solve each level ONCE on the PC (`--all` for every repo level missing one);
  the viewer and the phone replay the saved solution (natural replay, stamped with the physics
  commit; stale ones are re-solved). make.js and wip.js save one whenever they solve.
- `viewer/index.html` -- the replay viewer; `viewer/levels.js` is generated, do not edit.
- `lib/look.js` -- how a level LOOKS (viewer's "game look", on by default): header colours, colour
  899 / alpha 1007 / zoom 1913 triggers over time, block skins 1-7 outlined by their own edges,
  spikes, ground, bg, hills; the player per mode with glow, trail and particles (smoothed between
  steps, PHONE.md). Drawn to match frames of the user's play, no game art. Toggle off for
  the schematic view; "hitboxes" still overlays.
- **GD's own art in the viewer** (VISUALS.md: what is known, how it was checked against recordings,
  what is open, the rule that RobTop's art never leaves the PC): `lib/art.js` draws objects, background,
  ground and icons with the sprite sheets of the user's install, served by `tools/serve.js` at `/gdres/`
  ("GD art" button). Tables: `lib/objects_art.js` (`tools/import_art.js`, OpenGD) and
  `lib/objects_frames.js` (`tools/import_frames.js`, GD 2.2's own id -> frame table from the exe).
  Test: `node tests/art_tables.js`. **See your level as the game draws it:** `node tools/shoot.js
  <level.gdlvl | save:<name> | official:N> [--at 2,5] [--rec <video> --t0 <s>]` -> PNGs in `local/shots/`.
  **The whole level as one picture with its path:** `node tools/levelmap.js <level> [--brief briefs/NN.json]`
  -> `local/maps/<name>.jpg` (viewer: "level map").
  **Every level ends with the signature** (robot + human, "Made by Claude (and some humans)"):
  `tools/signature.js` (signature() objects, describe() for the description).
- **Deco catalogue** (knowledge/objects/README.md): `tools/catalogue.js index | sheets | usage` --
  every id with its picture on contact sheets (`local/catalogue/`, or browse `viewer/catalogue.html`),
  the searchable `knowledge/objects/catalogue.tsv`, and which deco families rated levels use together.
- Iterating on a level's look or play: the viewer's **✎ mark** (key M) saves the user's notes at a
  spot to `marks/marks.jsonl` (via `tools/serve.js`); read them with `node tools/marks.js`, close
  them with `node tools/marks.js done <id> "what changed"`. **compare** puts a frame of one of the
  user's recordings (Videos/Captures, read by ffmpeg, never copied) beside the replay;
  "save comparison" writes both as one PNG to `local/shots/`.
- **Polishing existing levels** (POLISH.md: what polish means to the user -- prettier, more synced,
  visual fixes, more gameplay, extended, fair as the floor -- the passes, results, tests, what is open;
  owner: the polish session, wip `local/wip/polish/`): `tools/polish.js <level.gdlvl>` (fair windows and
  no input forced after a mode change, loose sync, chevrons on needed jumps, the modern look with
  parallax and beat pulses); output in `local/polish/` only. Before/after in GD art: `viewer/polish.html`
  (via tools/serve.js) and shoot.js renders. Helpers: `tools/textmap.js` (a level as text with the
  path), `tools/orbchain_try.js` (forgiving orb chains). Test: `node tests/polish.js`.
- **Taste learned from real levels** (TASTE_DATA.md: the corpus of ~330 rated / unrated / official levels with
  likes and downloads, the static measures, which ones separate featured levels from the rest within a tier
  band, the verdict on each of the user's soft rules, what is open; owner: the taste session):
  `tools/taste.js` (`corpus`, `fetch`, `measure`, `learn`, `score <level>`), aggregates in
  `knowledge/taste_model.json`, score.js gate "taste". Test: `node tests/taste.js`.
- **Art: pictures and props as GD objects** (ART.md: how a picture becomes merged deco squares, the prop
  library with counts and sizes, the colour question still open in the game, what is open; owner: the art
  session): `lib/pixelart.js` (canvas + converter), `tools/pixelart.js <image.png>` (picture -> objects,
  `--max-objects`), `lib/props.js` (`put` / `place` / `list` by name: tree, pumpkin, house, robot, ...;
  spec key `"props"` in make.js), `tools/props.js sheet | level`. Test: `node tests/pixelart.js`.
- **The user's drawings -> levels** (SKETCH.md: reading a drawing into a spec, then making it fair;
  the GDLM 46 lessons).
- **Levels onto the phone** (PUBLISH.md: unlisted upload from the PC game with computer use, where
  the buttons are, GD must be windowed, the user's yes before each upload; ONE phone slot,
  ID 152848491, filled with `install.js <lvl> --slot phone`; and the test slot "Claude Lab", `--slot lab --desc "..."`, not uploaded yet; both in `local/phone_ids.json`). **Install queue** `tools/install_queue.js` (add / watch: installs the moment GD closes, reads the save back; PUBLISH.md). `tools/install.js` keeps a shared level's online ID on re-install, so
  Share again updates the same upload (`tests/install_keeps_id.js`).
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
Values live in `lib/physics.js` (SPEEDS) and `lib/objects.js`. Every other object's kind and hitbox
comes from OpenGD's object data via `tools/import_opengd.js` -> `lib/objects_extra.js` (facts only;
OpenGD is GPL, so its file is not copied in). Rule there: hitbox + not solid + not trigger = hazard,
so anything with a hitbox that is NOT a hazard (portals, coins, toggle orbs) must have its own entry
in `lib/objects.js`. Missing that once let the sim pass through Stereo Madness's pit spikes (id 9).
The rule also misfires the other way: OpenGD gives 37 block-outline / plank pieces type 0 (solid) but
leaves them out of its solids list, so the import called them hazards; `SOLID0` in lib/objects.js
fixes them (Deadlocked's 1202 ball lanes); the lettered helper blocks (type 40) were made killers the same way. Check OpenGD's type column (lib/objects_art.js) after an import.

## Calibration -- checked against the user's game

How: the user says "record", "reshoot" (close the current file, start a new one) or "stop".
Run `tools/record.sh start` in the background (whole screen, 60 fps, Desktop Duplication, to
Videos/Captures/GD claude-rec <time>.mkv) and `tools/record.sh stop`. Whole screen rather than
the GD window by title: a window capture looked "frozen" once, but the user had only tabbed out
on a paused screen -- and the file was deleted on that wrong guess, losing their run. Never
delete a recording; to check one, look at frames all through it, not just the first and last.
Game Bar (Win+Alt+R) also works, at ~30 fps, but records whatever window is active -- the user
got clips of the Claude app. Best runs: practice mode with "Show Hitboxes" on. Track the lime cube by colour per frame with
real frame times (`python tools/track.py VIDEO --from S --to S`: pts from ffprobe, never an
assumed rate; `--rows` gives ground/ceiling lines, `--sheet` a contact sheet).
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
- The wave slides along a block's top, but dies as it slides off the block's end (its centre
  passing the corner, x within ~5 units): two of two deaths in the user's GDLM 44 runs
  (2026-11-23_02-51-50.mkv, 17.6 s and 24.38 s). The sim slid off and lived until then.
- The wave dies flying head-on into a slope (down into a rising 45-degree floor): GDLM 44's zigzag,
  2026-11-23_03-11-47.mkv ~25 s. The sim had let it ride up the slope.
- Flipping gravity halves vertical speed (blue orb and ceiling blue pad in the recording move at
  half the decompile's velocity). The decompile's ringJump alone does not show this.

- Mode accelerations in the user's Clutterfunk recording (60 fps): cube +-0.78, ship hold +0.40 /
  release -0.25, ball +-0.47 units/frame^2 -- the sim gives 0.778 / 0.389 / -0.248 / 0.464
  (`node tests/modes_video.js`). So the ship's per-tick physics is right; the Stereo Madness
  ship-height mismatch lies elsewhere (a ship seated on a block keeping its fall speed would fix
  Back On Track's case, but gdsolver's model zeroes it, so that is not in). No clean UFO stretch yet.
- Vertical speed lives on a 0.001 grid (every velocity step is rounded). Took the jump-vs-video
  fit from 1.8 to 1.3 px rms.

Second ground truth: real-game input plans. gdsolver publishes, per official level, inputs that
clear it in GD 2.2 (240 Hz ticks). `node tools/tas.js [n]` plays them through our sim: where we
die and the game did not, we are wrong right there. Plans go in `local/gdsolver/` (copy from
gdsolver's `data/`, never committed). `node tests/tas_progress.js` is a ratchet of how far each
level gets -- raise its numbers when a fix gets further, never lower them. Facts found this way:
slab (40) hitbox is centred; ids 5/73/80 are scenery; every slope skin is a slope; GD 2.2's own
decoration list (`lib/objects_gd22.js`) beats OpenGD's 2.1 table; an upside-down cube that walks
off a ledge can still jump until it falls faster than 2g (GD bug). Polargeist gets to 909/925.
More facts from the plans (2026-11-22): a plan's tick t is our step t-1 (orbs at the edge of their
reach decide it); an orb touched at the end of either of the last two ticks takes a press (GD's
touched-orb list carries over a tick); hitboxes and saw radii grow with the object's scale (keys
32, 128/129); id 143 is a one-way platform (land on it, never dies); 661-664 and 1903-1905 are
slabs, not hazards; a blue pad flipped with key 5 faces down; move triggers move by 30 units a
block. Plans now reach (blocks): 9: 343, 11: 288 (mini), 13: 116, 19: 100, 22: 81 (it jumps off
blocks a move trigger raises).

Open mismatches the plans show (not understood yet, do not paper over them):
- Stereo Madness's ship hovers ~0.5 unit lower than the game's (dies on floor spikes at 328). Hexagon Force's
  ship (lv16, 141) grazes a saw by the same 0.5 unit after riding a ceiling slope.
- Theory of Everything (lv12, 34) and its sequel (lv18, 106): after a pink orb the cube is ~30 units
  too low to land on a block with a blue pad; every orb and pad value matches gdsolver's.
- Back On Track's ship ends ~1 block high after a slide (493).
- A cube that walked off a ledge and presses shortly before landing: the game jumps, we do not
  (Dry Out, Can't Let Go, Jumper, Time Machine, Polargeist's end). A 19-38 tick "landing buffer"
  would fit every case, but gdsolver's model has no such rule, so it is not in the sim.

Modes beyond cube/ship come from gdsolver's measured model and the gdp decompile, checked only
by the plans so far (xStep's ball, Blast Processing's wave): ball, UFO, wave, robot, spider,
swing. Each still wants a recording of the user's own play.

- No flying off into the sky (the user, 2026-11-23: "you cant just fly to the sky"). The sim
  counts 300 units above the highest object as a death; the exact height is not measured.

Assumed (not yet checked):
- Object keys 121 = No Touch and 134 = Passable (both make an object not collide).
- Spider teleport searches a 9-unit strip above/below the cube.
- Dash orbs: horizontal at the orb's angle while held; the props 586/588 on them are unknown.
- "Click Between Steps" is OFF in the user's settings: presses land on a frame boundary, not any
  240 Hz step. The solver still allows any step.

## Status of the solver on "cube timings" (examples/)

Beaten: 11 presses plus a dash release, tightest window 17 ms (windows replay-checked since 2026-11-23). Every part of
the level is in the sim: triple spikes, blue orb + ceiling blue pad, slope, dash orb, red orb,
spider orb + pad, the upside-down red-orb dive under a hanging column.

## Not simulated yet

Mirror and dual portals, teleport portal variants 2902/2064 and the teleport trigger 3022; follow and "move to target" triggers, and a player carried sideways by a moving
block; speed-dependent ring scaling for ball/UFO; spike slopes (any slope skin that kills is
treated as a plain slope -- unchecked).
Simulated but checked only by the plans: mini size (gdsolver's measured values), move/toggle/spawn
triggers (x-crossing, touch and spawn firing, GD's easings), ceiling slopes, turned hazard boxes.
The viewer draws moving objects where they start.

## Rules

- Levels must be sight-readable unless the user asks otherwise: no "prejumps" (a jump you must
  start while what it is for is still far ahead). `make.js` prints it; `tools/sightread.js`.
  Invisible parts: ghost (faint) by default, fully hidden only for a chunk already seen; whole
  blind phrases are "unfair" in the user's words. See STYLE.md.

- Never commit songs (Newgrounds songs belong to their artists) or other people's levels
  without their OK. The user's own levels in `examples/` are fine.
- Not affiliated with RobTop; do not use GD's art or name the repo/tool as if it were official.
- Unknown object ids: never guess silently. Mark `sure:false`, and ask the user what the object
  is in the editor.

## Later (said, not built)

- Music sync is a must (the user: levels "try to sync", some more, some less). Built: beat grids
  (`tools/beats.js`), sync scores (`tools/sync.js`), specs in beats (`"b12"`, `"j12"` in
  `tools/make.js`), beat lines in the viewer. Method, findings and limits: SYNC.md. In short:
  the official levels put portals (by their centre) on bar starts and phrases, orbs loosely on
  beats, spikes and clicks not on the beat. The user's rule: sync loosely, not forced -- sync
  portals, drops and some orbs, leave most clicks free; beatless parts (ship, wave) follow the
  song's loudness, not a grid (SYNC.md "How much to sync"; make.js notes over-sync). Not yet:
  songs with tempo changes, checking in the user's game that "on the beat" feels on the beat. Recordings have no sound: the PC has no
  loopback device (only the headset mic).
- Playing on the phone too: how to get an updated level onto the phone while away from the PC.
  Watching is built: the phone page (PHONE.md: live work in progress, marks, songs added from
  the phone). Playing it in the phone's game: unlisted uploads from the PC game, found
  on the phone by ID (PUBLISH.md; IDs in `local/phone_ids.json`); `tools/export_gmd.js` (.gmd for
  GDShare) where file import works.
- An in-game GD list of all the Claude levels (the user, 2026-11-23: "making a new gd list ingame,
  with all claude levels. Maybe later"). GD 2.2 lists hold online level IDs, so every level in it
  must be uploaded first -- which clashes with the user's rule of not putting many AI levels on the
  server yet (today only the phone slot, ID 152848491, is used). Names are final once uploaded
  (PUBLISH.md), so settle names first. Not started; no owner yet.
