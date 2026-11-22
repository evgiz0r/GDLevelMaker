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
- **Songs**: none are published (they belong to their artists). "add song" plays an mp3 from the
  phone itself, in sync, remembered in that browser (IndexedDB). A file named like the game's copy
  (`StereoMadness.mp3`, `343707.mp3`) goes to every level on that song. `node tools/songs.js --phone`
  copies the songs the repo's levels use into the user's OneDrive folder `GD songs/`, which the
  phone's file picker can open. Playing straight from Newgrounds is not possible: the Artifact
  frame blocks media from other sites (CSP), and the asset store takes no audio.
- Not on the phone: official RobTop levels (`levels.local.js`), recordings and "compare", the
  `#lv=...&t=...` links (a published page's address keeps only a plain `#name`).

## What a session does

| when | do |
|---|---|
| after `node tools/wip.js put ...` | it prints one ArtifactData `set` (collection `wip`, `file_path` = the row it wrote in `local/phone/wip/`): run it. For a row that exists, read it first (`get`) and pass `if_version`. |
| a new database, or rows lost | `node tools/wip.js phone` writes rows for every current level; send them (one `batch` with `file_path` entries). |
| before handling marks | ArtifactData `{action: "list", collection: "marks", out_dir: "<main checkout>/local/phone"}` -- the REAL path of the shared folder (`node -e "console.log(require('fs').realpathSync('local'))"`), not the worktree's `local/` link: ArtifactData refuses paths under `.claude/`. Then `node tools/marks.js` lists them with the rest ("from the phone"). |
| closing a phone mark | `node tools/marks.js done <id> "reply"` as usual, AND ArtifactData `update` on `marks/<id>` with `{done: true, reply}` so the phone shows it closed. |
| the viewer code or pushed levels changed | `node tools/web.js --out <scratchpad>/web`, then publish with what `publish.json` says (`file_path`, `root`, `files`, `capabilities: {db: {}}`) and `url` from `local/phone/url.txt`. From a new conversation, `read` the artifact first. Tell the user the page changed. |

`tools/web.js` builds the page from `viewer/index.html` by exact text swaps; when the viewer
changes, a swap that no longer matches stops the build with the text to update ("viewer changed,
update tools/web.js"). Keep the phone page a build of the viewer, never a fork.

## How it was tested (Nov 22 2026)

- The built page at phone width (375 px) in the browser pane, with a song: the song plays in step
  with the replay (2.74 s vs 2.67 s, within the 80 ms resync), survives a reload, no sideways scroll.
- The database round trip through the published page's store: a `wip` row written by ArtifactData;
  a mark row written, read back with `out_dir`, listed by `node tools/marks.js` as from the phone;
  both deleted again.
- Not tested by Claude: the page itself on the phone (the browser pane is not signed in to
  claude.ai). The user is the first to see the live list and save a mark from the phone.

## Solutions travel with the level

A work-in-progress row carries its solution (`solution: {ok, events}`, the natural replay of
`lib/natural.js`), solved on the PC by `node tools/wip.js put` (`--no-solve` skips it). The page
then only replays. Without it the phone solved the level itself: GDLM 45 (61 s with ship and wave)
takes ~5 min to solve on the PC, and the page looked hung on the phone (user, Nov 22).

## Open

- A session forgetting the ArtifactData call leaves the phone a version behind; nothing checks it.
  A check could compare `local/wip/` versions with the rows (one `list`).
- Marks made on the desktop viewer are not shown on the phone (they live in `local/marks.jsonl`);
  sending them up would be one more ArtifactData batch.
- Pushed levels could also move into the database, so a push would need no republish.

## Hand-off

Built by the music sync session (Nov 22 2026). Files: `tools/web.js` (build), `tools/wip.js`
(`phoneRow`, `phone`), `tools/marks.js` (merges `local/phone/marks/`), `tools/songs.js --phone`.
