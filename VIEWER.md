# The viewer -- the place the user steers development

The user (2026-11-24): "for the viewer to become the interaction in this development process". The PC viewer
(http://localhost:8765/viewer/, `tools/serve.js`) shows every level and every build as it is made, and every answer the
user gives there reaches the session that owns it at once. The phone page (PHONE.md) and the public site (PAGES.md)
are builds of the same page without these PC-only parts.

## What the user can do there

| Where | What | Who reads it |
|---|---|---|
| **Work** (button / key W; badge = what waits for you) | the decision cards sessions ask; every build with its stage and whether it waits for you; the PC's heavy-job queue with ETAs that say their basis ("~28 min (last run make jN, this level)") or "not measured" (tools/jobtime.js), and the last finished jobs, estimate vs actual ("off 3x" in red where it drifted). Live (5 s). | -- |
| **Decision card** (Work) | answer a session's question with one of its options or "other…" | the asking session (`tools/ask.js wait <id>`), the feed |
| **Stage bar** (a build being made: song › layout › path › deco › final) | open any stage; **✓ ok** or **redo…** with a note (the moment on screen goes with it); a gated stage shows "⏸ the build waits for you" | the builder (`tools/stages.js wait` / `waitApproval`), the feed |
| **✎ mark** (key M) | a note at a spot, with a kind (unfair / awkward / ugly / unclear / other) | marks.js, the feed |
| **Variants bar** | compare a section's variants, "pick" one | style (a variant-pick mark), the feed |
| Picker (L), level map, timing band, F counter, light | see everything at once (no UI action blocks > ~100 ms; nothing waits on a solve to be visible) | -- |
| **🎮 you play** (button / key P) | play the open level or build stage yourself in the viewer: space / ↑ / W / Enter / click / tap = the button, R restart (practice: from the last checkpoint; Shift+R from the start), P or Esc back to the replay. **practice** (on by default): checkpoints at each section start and portal. The same sim live (`lib/liveplay.js`: pressing at a route's ticks = GD.run, `tests/liveplay.js`); presses land on the next tick, a frame boundary, as in the user's game. Works with no route at all: a layout can be tried minutes after it exists. Deaths show as red ticks on the ground; an attempt with no press is neither logged nor restarted by itself | the actions feed, type **play** (`{attempt, result: died / clear, x, pct, t, why, from, practice, stage}`; where the user dies = a soft signal for difficulty) |
| **A stage's plan, replayed at once** | a stage (layout, path) or a section variant with no route but a plan (`data.events`, else `data.planned` [{t, what}]; a variant's `planned`, or the layout's `data.alt[].options[].planned`) replays its planned presses through the sim in slices: no solve, ~a second. If it dies: "▶ The plan breaks here: block N, t s: why", a red cross at the spot, and the camera goes on as a ghost after it. The stage's `data.timing` / `target` show as "build time" | -- |
| **Level map, "draw it now"** | drawn in the page offscreen, one chunk per task with progress ("12/40"); the view and controls stay usable; GD art's new tints have a 40 ms budget per draw (lib/art.js `budget()`), the rest come on the next pass. GDLM 61, first visit: 3.8 s in all, one task of 140 ms (the first), the rest under 50 ms (was 8.8 s with 13 tasks of 140-280 ms and the view taken over) | -- |

## For sessions

- **Ask the user**: `node tools/ask.js put <session> "question" "option A" "option B" ... [--level "GDLM 64 golden hour"]`
  prints the card id; `node tools/ask.js wait <id>` blocks until the answer (prints it; exit 2 on timeout).
- **Stages and gates**: `require("./stages.js").put({ session, base, name, stage, levelStr?, data?, note?, gate: true })`.
  A gated stage waits for the user: `await require("./stages.js").waitApproval(session, base, stage)` -> `{verdict: "ok" |
  "redo", note, spot: {t, x}}`, or `node tools/stages.js wait <session> <base> <stage>` (prints `ok`, or `redo<TAB>note`).
  After a redo, put the stage again (that clears the review) and wait again. No gate: approval is optional, still recorded.
- **The actions feed**: every user action is one line in `local/viewer_actions.jsonl` `{id, at, type: mark | approve |
  redo | answer | variant-pick, session, level, file, stage?, text, ...}`. The coordinator forwards them live:
  `node tools/actions.js tail --since <id>` (one short line per action, as they come; `--once` to print and stop).

## Files and tests

`lib/liveplay.js` (live play + planEvents; `node tests/liveplay.js`), POST /play (tools/serve.js), `tools/actions.js`, `tools/ask.js` (local/asks/), `tools/stages.js` (approve, waitApproval, gate), `tools/serve.js`
(POST /stages/review, GET /asks, POST /asks/answer; marks also go to the feed), viewer/index.html (Work, stage review).
Tests: `node tests/work.js` (gate -> waiting -> review -> waitApproval; card put -> list -> answer; the feed and tail),
`node tests/stages.js`, `node tests/no_dialogs.js`.
