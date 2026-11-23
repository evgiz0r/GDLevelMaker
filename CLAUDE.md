# GDLevelMaker -- instructions for the AI

Claude writes Geometry Dash levels from a description, checks they can be beaten, shows them
replaying with their clicks, and hands back a file the user imports into their real game.
The user plays it and tells us what was off. Read this fully first.

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
- **Hand off.** Before a long pause or when your area changes hands, write where you stopped,
  what is open and the good numbers into your area's doc.
- **Share, don't duplicate.** Results go into the shared `local/` (see below) so no session redoes
  another's work; tell the session that owns an area when you learn something about it.

## Before making or judging a level: read knowledge/

`knowledge/` is a general GD knowledge base (not the user's personal taste): `design.md` (what
makes a level good or unfair) and `critiques.md` (playtest feedback on GDLM levels) are required
reading before writing a spec; `levels/`, `glossary.md`, `demonlist.md` for the rest.

## The loop

1. Write a spec in `specs/NN_name.json` (grid squares, see the top of `tools/make.js`).
2. `node tools/make.js specs/NN_name.json` -> `levels/<name>.gdlvl`, solved, added to the viewer.
3. Look at it: `node tools/serve.js` and open http://localhost:8765/viewer/ (or open
   `viewer/index.html` straight from disk in a normal browser). It replays the solver's clicks
   with a click sound, the timing window of each click, and hitboxes on request.
   For the phone: the same viewer as the user's private Artifact (PHONE.md): pushed levels,
   every session's work in progress live, marks from the phone. Republish it when the viewer or
   the pushed levels change (`node tools/web.js --out <scratchpad>/web`, link in local/phone/url.txt).
4. With the game closed, `node tools/install.js levels/<name>.gdlvl` puts it at the top of
   My Levels (backs the save up first; refuses while GeometryDash.exe runs). The user plays it
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

## Shared folder, work in progress, the user's marks

Every session works in its own git worktree, but `local/` (never committed) is ONE shared folder:
- **Once per worktree, between jobs: `node tools/link_local.js`.** It merges your `local/` into the
  main checkout's (newest file wins), keeps yours as `local.before-share/`, and links `local/` to
  the shared one. From then on solved levels, beat grids, recordings notes and marks are shared --
  don't re-solve what another session already solved (check the file; one heavy job at a time).
- **The level you are working on: `node tools/wip.js put <level.gdlvl> --session <your name>
  --note "what changed"` after every change.** It goes to `local/wip/<session>/`, and the viewer
  (`node tools/serve.js`, http://localhost:8765/viewer/) lists it under "in progress" with its
  version; the user presses ⟳ refresh to see the newest, before anything is pushed. **Then run
  the ArtifactData call it prints**, so the phone page shows it too (PHONE.md).
- **The user's marks** (✎ in the viewer, pinned to a moment and a spot) go to `local/marks.jsonl`
  with the level's file and `session`. `node tools/marks.js` lists open ones: handle the ones with
  your session, then `node tools/marks.js done <id> "what changed"`. Marks from the phone: fetch
  them first with one ArtifactData `list` (PHONE.md); marks.js then shows them with the rest.
- **Links:** the viewer's address keeps `#lv=<file>&t=<seconds>` (🔗 copies it), so a link the
  user sends opens that level at that moment.

## Files

- `lib/gd.js` -- the format: base64url + gzip layers, the record (plist) and the level string.
- `lib/objects.js` -- object ids: name, kind, hitbox. `sure:false` = from memory, unconfirmed.
- `lib/physics.js` -- physics of every mode, triggers + solver (fewest clicks, each in the middle of its window).
  PHYSICS.md: per mode and trigger, its constants, sources, checks and what is open.
- `lib/difficulty.js` -- difficulty score from a solution: the human route (one tap per jump), per-input
  timing windows, a timing-error + lapse model fitted on the user's real runs; see DIFFICULTY.md
  (also the tier ladder for making levels, and what is open). Its tools: `difficulty` (score a level,
  or all official levels vs ratings and the user's attempts), `difficulty_solve` (cache an official
  solution, one at a time), `difficulty_fit` (refit on the user's runs), `difficulty_community`
  (score downloaded community levels), `runs` (the user's deaths from a recording, via the progress
  bar), `save_stats` (the user's lifetime attempts per official level, read-only from the save).
- `lib/sync.js` -- music sync: level time <-> x through speed portals, beat grid <-> level beats,
  press timing windows from a solution, sync scores. See SYNC.md (also where songs come from).
- **The phone page** (PHONE.md: what is on it, what a session does after `wip.js put`, phone
  marks, how it was tested, what is open): `tools/web.js` builds it from the viewer.
- `tools/` -- node CLIs: `make`, `check`, `roundtrip`, `index_levels`, `serve`, `beats` (beat grid
  of every song on this PC, ffmpeg + JS), `sync` (how well levels follow their song's beat), `frames` (timing windows with 60 fps presses, as the user's game has them), `web` (the viewer as a phone page, PHONE.md), `songs` (custom songs by id into local/songs/, as GD gets them; SYNC.md section 6), `fetch_level` (online levels by ID into local/community/, for measuring only, never committed), `community` (study rated community levels: list, fetch, measure, modes, comments; see knowledge/README.md), `difficulty` (score vs the official ratings).
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
- `tools/solutions.js` -- solve each level ONCE on the PC (`--all` for every repo level missing one);
  the viewer and the phone replay the saved solution (natural replay, stamped with the physics
  commit; stale ones are re-solved). make.js and wip.js save one whenever they solve.
- `viewer/index.html` -- the replay viewer; `viewer/levels.js` is generated, do not edit.
- `lib/look.js` -- how a level LOOKS (viewer's "game look", on by default): header colours, colour
  899 / alpha 1007 / zoom 1913 triggers over time, block skins 1-7 outlined by their own edges,
  spikes, ground, bg, hills; the player per mode with glow, trail and particles (smoothed between
  steps, PHONE.md). Drawn to match frames of the user's play, no game art. Toggle off for
  the schematic view; "hitboxes" still overlays.
- Iterating on a level's look or play: the viewer's **✎ mark** (key M) saves the user's notes at a
  spot to `marks/marks.jsonl` (via `tools/serve.js`); read them with `node tools/marks.js`, close
  them with `node tools/marks.js done <id> "what changed"`. **compare** puts a frame of one of the
  user's recordings (Videos/Captures, read by ffmpeg, never copied) beside the replay;
  "save comparison" writes both as one PNG to `local/shots/`.
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

Beaten: 11 presses plus a dash release, tightest window 21 ms (the blue orb). Every part of
the level is in the sim: triple spikes, blue orb + ceiling blue pad, slope, dash orb, red orb,
spider orb + pad, the upside-down red-orb dive under a hanging column.

## Not simulated yet

Mirror, dual and teleport portals; slopes turned a quarter turn (walls act as blocks); rotate,
follow and "move to target"/"lock to player" triggers, and a player carried sideways by a moving
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
  the phone). Playing it in the phone's game: `tools/export_gmd.js` (.gmd for GDShare).
