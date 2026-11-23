# The viewer -- the place the user steers development

The user (2026-11-24): "for the viewer to become the interaction in this development process". The PC viewer
(http://localhost:8765/viewer/, `tools/serve.js`) shows every level and every build as it is made, and every answer the
user gives there reaches the session that owns it at once. The phone page (PHONE.md) and the public site (PAGES.md)
are builds of the same page without these PC-only parts.

## What the user can do there

| Where | What | Who reads it |
|---|---|---|
| **Work** (button / key W; badge = what waits for you) | the decision cards sessions ask; every build with its stage and whether it waits for you; the PC's heavy-job queue with ETAs. Live (5 s). | -- |
| **Decision card** (Work) | answer a session's question with one of its options or "other…" | the asking session (`tools/ask.js wait <id>`), the feed |
| **Stage bar** (a build being made: song › layout › path › deco › final) | open any stage; **✓ ok** or **redo…** with a note (the moment on screen goes with it); a gated stage shows "⏸ the build waits for you" | the builder (`tools/stages.js wait` / `waitApproval`), the feed |
| **✎ mark** (key M) | a note at a spot, with a kind (unfair / awkward / ugly / unclear / other) | marks.js, the feed |
| **Variants bar** | compare a section's variants, "pick" one | style (a variant-pick mark), the feed |
| Picker (L), level map, timing band, F counter, light | see everything at once (no UI action blocks > ~100 ms; nothing waits on a solve to be visible) | -- |

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

`tools/actions.js`, `tools/ask.js` (local/asks/), `tools/stages.js` (approve, waitApproval, gate), `tools/serve.js`
(POST /stages/review, GET /asks, POST /asks/answer; marks also go to the feed), viewer/index.html (Work, stage review).
Tests: `node tests/work.js` (gate -> waiting -> review -> waitApproval; card put -> list -> answer; the feed and tail),
`node tests/stages.js`, `node tests/no_dialogs.js`.
