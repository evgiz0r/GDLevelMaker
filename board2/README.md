# The new work board (artifact, 2026-11-28)

Evgeni: "make a new workboard" (after asking for main-level solve stats, per-section-type generation quality and join
success). A private claude.ai artifact: https://claude.ai/artifact/VLKSoUZ7dGc9mfLyzD7a15 . It does not replace the
local GD Work Board (board/README.md) or the Claude workboard (workboard/README.md); both stay as they are.

What it shows, top to bottom: four figures (mains with a clearing route, section types that solve, generated-section
clear rate, newest level's layout score), the 22 main levels as a ladder of route bars, then folding sections: Now (work
in progress / waiting on him / next / done today), Main levels, Section types, Joins between sections, Our levels (judge
report with layout parts), Your marks.

## Files

- `board2/page.html`: the page (hover + refresh snippets pasted in). Loads `data.json` from beside itself.
- `tools/board2_data.js`: builds data.json. `--local <dir>` = the PC's local/ (or a staged copy of local/mains,
  local/difficulty, local/phone/url.txt), `--stats <file>` = the stats report's JSON (rows of objects show as tables;
  `summary.clear_rate` feeds the figure; `types` and `joins` get their own sections), `--out` (default local/board2/data.json).

## Database (collections)

- `work`: one doc per item `{title, state: working | next | waiting | done, owner?, note, est_min?, basis?, at, done_at?}`.
  Any session that starts or finishes something writes it here with ArtifactData (est_min only from a measured run).
  Done items leave the view 24 h after done_at.
- `marks`: his 📍 notes, one revision doc per save `{item, label, note, at}`; newest per `item` wins. Claude marks one read
  with a new revision carrying `seen: true, reply`, fixed with `fixed: true`. `send`: `{at}` of each 📨 send; new = after it.

## Refresh

1. `node tools/board2_data.js --local <local> [--stats /mnt/project-files/stats/stats.json] --out <scratch>/data.json`
2. Republish: Artifact publish `board2/page.html`, `files: {"data.json": <out>}` (omit capabilities and icon to keep them).
3. Update `work` docs. Read `marks` for anything new.
