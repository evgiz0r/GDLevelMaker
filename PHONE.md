# The phone page

The user watches levels on the phone, away from the PC: the replay viewer as a private claude.ai
Artifact (only the user can open it). It shows the pushed levels, every session's work in progress
live, and takes the user's marks, which reach the sessions like the desktop viewer's marks.

Link: in `local/phone/url.txt` (shared folder; also in Claude's memory). Not in the repo.

## What is on it

- **Pushed levels**: `viewer/levels.js`, baked in when the page is built. They change only when
  the page is republished.
- **Work in progress, live**: the page's own database, collection `wip`, one row per level, the
  same shape as `tools/serve.js`'s `/wip/list` (name, session, file, level string, song, version,
  note, updated). The page re-reads it whenever a row changes, so a session's new version shows
  on the open phone without a republish. Listed first, under "in progress".
- **Marks**: ✎ mark, tap the spot, type the note (an in-page box: `prompt()` is refused inside an
  Artifact). Saved to the collection `marks`, same fields as `local/marks.jsonl` plus
  `from: "phone"`; "done"/"reopen" on the phone updates the row.
- **✏ draw (the whiteboard)**: draw.html, its worker and libs ship beside the page (tools/web.js); sketches drawn there
  go to the page's collection `sketches` (one doc per sketch, as local/sketches/<id>.json): read them with ArtifactData
  `list` on this page. DRAW.md "In the viewer". When republishing from a cloud session that has no local/beats.local.js,
  leave `beats.js` (and maps/) out of `files`: files left out keep their published copy (the PC's beat grids).
- **Songs**: none are published (they belong to their artists). "add song" plays an mp3 from the
  phone itself, in sync, remembered in that browser (IndexedDB). A file named like the game's copy
  (`StereoMadness.mp3`, `343707.mp3`) goes to every level on that song. `node tools/songs.js --phone`
  copies the songs the repo's levels use into the user's OneDrive folder `GD songs/`, which the
  phone's file picker can open.
  The picker is a real `<input type=file accept="audio/*,...">` laid invisibly over the button, so
  the tap lands on the input itself (no input clicked from code, no `capture`). Nov 23: on the
  user's Android phone (S23+) "add song" opened nothing, most likely because the page was open
  inside the Claude app, whose built-in browser may not offer a file picker. So: if neither the page
  blurs/hides nor a file arrives within 2.5 s of the tap, the page says the picker did not open and
  to open the page in Chrome (⋮ -> Open in browser), or to drop or paste the file onto the page
  (both also work). Every outcome shows a line: a file that does not decode, or a level with no
  song (the file is then not used). Playing straight from Newgrounds is not possible: the Artifact
  frame blocks media from other sites (CSP), and the asset store takes no audio.
- **Never solves on the page's thread.** A level with a saved `solution` (rows from `wip.js put`
  carry one, solved on the PC) only replays. One without (the pushed levels in `levels.js`, an
  old row) is solved in a Web Worker (`solve_worker.js`, built by web.js) while the page stays
  usable, with "solving on this phone in the background… N s" in the Level card, and stopped
  after 60 s with "not solved yet: too big to solve on the phone". The page opens on a level that
  has a saved solution. Why: on Nov 22 the page solved GDLM 45 (ship + wave, ~5 min even on the
  PC) on its own thread and the user's phone hung on opening it.
- **The look** (Nov 23, after the user called the phone view "so-so, bit crude"): the game look
  (lib/look.js) is on by default, and the player is drawn as in GD: an icon per mode (cube, ship
  and UFO with a small cube inside, ball, wave dart; GD's default green/cyan, shapes drawn here, no
  game art), a soft glow, the wave's solid trail, a fading streak in flying modes and after an orb
  or pad, ground particles under the cube, exhaust from the ship and UFO. The cube turns with the
  physics in the air and eases onto its side in ~0.1 s on landing (`visualRot` in the viewer; the
  physics' own `rot` snaps in one step and is left alone). Upright phones frame by width: GD's 19
  blocks across, the canvas 4:3, more sky above. These live in the shared viewer, so the PC viewer
  has them too.
- **Smooth**: the player and camera move between the 240 Hz steps at the screen's own rate, the
  camera's vertical easing no longer depends on the frame rate, the canvas is capped at 2x pixels,
  and with a song playing the replay clock follows the song's (a fifth of the gap each frame) instead of
  the song being re-seeked.
- **Level map** (Nov 23): the button shows for a level that has an art-free map, made with
  `node tools/levelmap.js <level> --shapes` (-> `local/maps/<name>_shapes.jpg`). `tools/web.js` ships
  every `gdlm_*_shapes.jpg` under `maps/` (never the GD-art maps or official levels) and opens it over
  the page (a new tab may be blocked in the Artifact frame); a tap zooms it 3x around the spot. New
  map -> rebuild and republish. Tested in the pane at 375 px: button only on 44/45, map loads, zoom.
- Not on the phone: official RobTop levels (`levels.local.js`), recordings and "compare". Links: a published page's address
  keeps only a plain `#name`, so the phone page opens the short form `#<base>--v5--t40` (LINKS.md; `tools/link.js` prints
  it), and its 🔗 open link box takes any pasted link.
- **Deco options** (2026-11-25): the "deco" button (or #deco) opens deco/index.html over the page: tools/decogallery.js
  and tools/decodemo.js frames (GD art) as 960 px JPGs, ice and fire side by side. Build: run both with --shots, then
  `node tools/deco_page.js` (-> local/phone_deco/), then tools/web.js carries it as deco/. GD art: only on this private page
  (VISUALS.md, the one exception). To add or refresh just the pictures, publish with `files` = the deco/ paths only.

## Offline snapshot: the PC viewer in one file (2026-11-24)

For the phone with no network (the user at work). `node tools/snapshot.js` (~1-2 min) writes
`local/phone/viewer_snapshot_<date>.html`; add `--no-songs` for the light one. It goes to the user ONLY by the chat's file
card: never commit, upload or publish it, because RobTop's art, the official levels and the songs are inside.
- **What's inside**: the PC viewer and its libs; every level the PC viewer lists with its saved route (levels/, the
  official ones, every session's work in progress); beat grids; the user's runs (local/attempts/) and icons; GD's art
  (the hd sheets as WebP at 2 px a unit, and only the backgrounds and grounds the levels use); every level's song as AAC
  mono at 40 kbps (`--kbps`), lowered by itself until the file fits `--max-mb` (default 29: the chat's file card takes 30 MB).
  Below 16 kbps it stops and says to use `--no-songs`.
- **Sizes (2026-11-24, 76 levels)**: 27.2 MB with songs at 25 kbps (the limit picked the bitrate; 175 s to build).
  At 57 levels and 40 kbps it was 35.2 MB, too big for the chat: 35.2 MB with songs (songs 19.3 MB, art 4.2 MB, level data 2.3 MB gzipped, all
  before base64). 9.5 MB without songs. Build time: 110 s / 72 s.
- **How**: the level data is gzipped JSON in the page, unpacked with DecompressionStream before the viewer's script runs
  (needs Chrome 80+ / Safari 16.4+). A fetch shim answers the viewer's server calls from that data. lib/art.js takes its
  images from `window.GD_ART_EMBED` as data: URLs, which tinting can read; a file:// image could not be read.
- **Tested**: `node tests/snapshot_offline.js [file] [--level <name>]` opens the file from disk in headless Edge, 375x812,
  with a phone user agent and every request sent to a dead proxy (no network). It opens a level, checks the route, the
  art and the song, plays it and catches page errors. Hexagon Force passed: the route, the art, the song decoded (90.5 s)
  and it played, with no errors. The same file served over http in the app's browser pane, at phone width: GDLM 64 v5
  played with art and song, and the runs list had the user's Hexagon Force run. The app's browser pane does not open
  file:// pages, so the from-disk check is the headless one. Headless sometimes reports the song "not decoded" while the
  PC is busy (it decodes on a real clock while the page runs on virtual time).
- **Offline, not there**: marks and other writes are accepted and dropped; nothing new is solved (every listed level
  carries its route); no community or demon-list levels; no Work panel, decision cards or live updates (it is a
  snapshot); no recordings or "compare"; the timing-window worker cannot start from file://, so windows are computed
  on the page.
- **Opening it on the phone**: Android: open the downloaded file in Chrome. iPhone: Files' preview does not run the
  page's scripts, so it has to open in a browser. Not tried on a real phone yet.

## What a session does

| when | do |
|---|---|
| after `node tools/wip.js put ...` | it prints one ArtifactData `set` (collection `wip`, `file_path` = the row it wrote in `local/phone/wip/`): run it. For a row that exists, read it first (`get`) and pass `if_version`. |
| a new database, or rows lost | `node tools/wip.js phone` writes rows for every current level; send them (one `batch` with `file_path` entries). |
| before handling marks | ArtifactData `{action: "list", collection: "marks", out_dir: "<main checkout>/local/phone"}` -- the REAL path of the shared folder (`node -e "console.log(require('fs').realpathSync('local'))"`), not the worktree's `local/` link: ArtifactData refuses paths under `.claude/`. Then `node tools/marks.js` lists them with the rest ("from the phone"). |
| closing a phone mark | `node tools/marks.js done <id> "reply"` as usual, AND ArtifactData `update` on `marks/<id>` with `{done: true, reply}` so the phone shows it closed. |
| the viewer code or pushed levels changed | `node tools/web.js --private --out <scratchpad>/web` (the user's own phone viewer is the private build: it also loads `levels.local.js`, the 22 main levels, and fetches their songs from `songs/`; both are already published next to the page and are kept when a publish leaves them out, so never list them. Without `--private` the page loses the main levels and their music. `--private` is only for that page, never a shared or public one), then publish with what `publish.json` says (`file_path`, `root`, `files`, `capabilities: {db: {}, downloads: true}`: downloads lets the ✏ board save .gdlvl / .json) and `url` from `local/phone/url.txt`. From a new conversation, `read` the artifact first. Tell the user the page changed. |

`tools/web.js` builds the page from `viewer/index.html` by exact text swaps; when the viewer
changes, a swap that no longer matches stops the build with the text to update ("viewer changed,
update tools/web.js"). Keep the phone page a build of the viewer, never a fork. The GD-art libs (`art`,
`objects_art`, `objects_frames`) are dropped once from the lib list, so the page, the solve worker and
the publish list never name them (the worker once imported them and would have failed on the phone).

## How it was tested (Nov 22 2026)

- The built page at phone width (375 px) in the browser pane, with a song: the song plays in step
  with the replay (2.74 s vs 2.67 s, within the 80 ms resync), survives a reload, no sideways scroll.
- The database round trip through the published page's store: a `wip` row written by ArtifactData;
  a mark row written, read back with `out_dir`, listed by `node tools/marks.js` as from the phone;
  both deleted again.
- The background solver (browser pane, phone width): a level without a solution shows at once,
  solves in the worker with the page's thread never blocked over 75 ms; a worker that never
  answers is stopped at 60 s with the "too big" note, the level still scrubbable.
- Add song (Nov 23, phone width): a tap at the button's centre hits the input; a click with no
  picker shows the "open in Chrome" line after 2.5 s; a dropped WAV and a pasted file go through
  the same path (a good file plays, a junk one gets "could not be played"); no sideways scroll.
- The look and smoothness (Nov 23, phone width, GDLM 44 with a test tone as its song): cube,
  ship, orb streak and wave trail checked in screenshots; draw() costs 1.0-1.1 ms a frame (2.4 ms
  worst) at 2x; at the moment a frame is drawn the picture is 3 ms from the song (median), 8 ms at most; replay speed
  0.97-1.02x frame to frame. The browser pane was hidden (about 17 fps), so 60/120 Hz on the phone
  is untested.
- Not tested by Claude: the page itself on the phone (the browser pane is not signed in to
  claude.ai). The user is the first to see the live list and save a mark from the phone.

## Solutions travel with the level

A work-in-progress row carries its solution (`solution: {ok, events, physics}`, the natural replay
of `lib/natural.js`), solved on the PC by `node tools/wip.js put` (`--no-solve` skips it). Pushed
levels carry theirs in `viewer/levels.js` (from `local/solutions/`, see `tools/solutions.js`; solve
any missing with `node tools/solutions.js --all`). `physics` = the commit of lib/physics.js /
lib/objects*.js it was solved on; older ones are stale and get solved again. The page
then only replays. Without it the phone solved the level itself: GDLM 45 (61 s with ship and wave)
takes ~5 min to solve on the PC, and the page looked hung on the phone (user, Nov 22).

## Private build: the main levels and their songs (2026-11-25)

Evgeni chose "Yes, private viewer only": his own private phone viewer (the Artifact in local/phone/url.txt,
readable by only him) also carries RobTop's 22 main levels with their saved routes and the game's own songs, so they
replay with music on the phone. `levels.local.js` (only the official entries) and `songs/<name>.mp3` (~33 MB) were
published next to the page once; `node tools/web.js --private` builds a page that loads them, and a republish keeps
them without listing them (see the table above). Rules: never commit them, never use --private for the public site,
a shared page or any other Artifact. Checked headless: 22 main levels listed, Stereo Madness loads its route and its
song decodes.

## Open

- GD's own art (VISUALS.md) is NOT on the phone page: `tools/web.js` strips `lib/art.js` and its tables,
  because RobTop's sprites must not be published. Options for later, in VISUALS.md "Phone".

- Whether the Claude app's built-in browser ever opens a file picker for an Artifact (unconfirmed;
  the user is to try Chrome). If it never does, a song could come another way: a phone-side
  upload into the page's store (the asset store takes no audio) is not possible today.

- A level whose wip row is over 250 KB never reaches the phone's `wip` (wip.js prints "too big" and sends nothing; GDLM 72 FROSTBITE: 662 KB, 2026-11-25): it shows on the phone only after it is pushed and the page is republished with web.js.
- A session forgetting the ArtifactData call leaves the phone a version behind; nothing checks it.
  A check could compare `local/wip/` versions with the rows (one `list`).
- Marks made on the desktop viewer are not shown on the phone (they live in `local/marks.jsonl`);
  sending them up would be one more ArtifactData batch.
- Pushed levels could also move into the database, so a push would need no republish.

## Hand-off

Built by the music sync session (Nov 22 2026). Files: `tools/web.js` (build), `tools/wip.js`
(`phoneRow`, `phone`), `tools/marks.js` (merges `local/phone/marks/`), `tools/songs.js --phone`.
