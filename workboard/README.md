# The Claude workboard (artifact)

A private claude.ai artifact the user asked for on 2026-11-26 ("testing the workboards in claude"): three topics,
each collapsed at the start, and a saved comment thread on every row and on each topic.

- **Current available features**: every use case in USE_CASES.md with its status (works / parts / not yet), what exists,
  what is missing.
- **Our structures**: the structure library's numbers only, no pictures (knowledge/structures.json: mode, tier, gates,
  width, length, presses, tightest window, warnings, mode in -> out), with a summary row.
- **GD video catalog**: the recordings and clips in Videos/Captures and the renders in local/video, with length, size,
  date and the levels named in local/real_stats.jsonl.

This is separate from the GD Work Board (board/README.md), which stays a local page. The link is in
`local/workboard/url.txt`.

## Files

- `workboard/board.html`: the page. It loads `data.json` from beside itself; comments go to the artifact's `db`
  (collection `comments`: `{topic, item, label, text, at, by}`; `item` is a use case id, structure id, video id, or
  `_topic`). Capabilities: `db`, `user` (scopes `profile`, for names).
- `tools/workboard_data.js`: builds `local/workboard/data.json`. It stays local because it names the user's recordings.

## Refresh

1. `node tools/workboard_data.js` (a few seconds).
2. Republish with the Artifact tool: `url` from local/workboard/url.txt (read the artifact first), `file_path`
   `workboard/board.html`, `files` `{"data.json": "local/workboard/data.json"}`. Omit `capabilities` and `icon` so both
   carry over. Comments survive republishes.

## Reading the user's comments

ArtifactData `list`, collection `comments`, on the url above. Handle them like viewer marks: each comment on a feature,
structure or video is a note for the session that owns that area.

## Open

- Video lengths are blank for some .mkv recordings (ffprobe reads no duration from them).
- Most recordings name no level: only those with attempts in real_stats.jsonl do.
- The data is a snapshot from the last refresh, not live.
