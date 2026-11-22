# Marks: the user's notes on levels, from the viewer

In the viewer (`node tools/serve.js`, http://localhost:8765/viewer/): **✎ mark** (or M), click the
spot, type what should change. `tools/serve.js` appends one JSON line to `marks.jsonl`:

    {"id", "level", "file", "t" (level seconds), "x", "y" (GD units), "note", "view", "zoom", "made"}

A later line with the same `id` updates that mark: `{"id", "done": true, "reply": "what was changed"}`.
The viewer folds them and shows the marks as yellow pins (closed ones faded, the reply under the note).
Without the server (viewer opened from disk, or the phone page) marks stay in that browser only.

Each round, Claude: `node tools/marks.js` (open marks), fixes what they say (the level's spec, or
`lib/look.js` for how the viewer draws things), then `node tools/marks.js done <id> "what changed"`.
