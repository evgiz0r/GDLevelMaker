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
| **Sections strip** (a level built in sections: the stages index's `sections`, from briefs/NN.seams.json) | one chip per section with its roles' state (L layout, D deco, P playtest: planned / built / ok / redo; hover: the builder); the section under the playhead is outlined; click one to select it and jump there, then **✓ ok / redo…** for the open stage's role and for playtest -- that section only. Seams are dashed lines with the section's name on the level | the section's builder: `tools/stages.js wait <session> <base> <stage> --section s3 [--role playtest]` / `waitApproval(..., {section, role})`; the feed (redo / approve with section + role) |
| **🎮 you play** (button / key P) | play the open level or build stage yourself in the viewer: space / ↑ / W / Enter / click / tap = the button, R restart (practice: from the last checkpoint; Shift+R from the start), P or Esc back to the replay. **practice** (on by default): checkpoints at each section start and portal. The same sim live (`lib/liveplay.js`: pressing at a route's ticks = GD.run, `tests/liveplay.js`); presses land on the next tick, a frame boundary, as in the user's game. Works with no route at all: a layout can be tried minutes after it exists. Deaths show as red ticks on the ground; an attempt with no press is neither logged nor restarted by itself | the actions feed, type **play** (`{attempt, result: died / clear, x, pct, t, why, from, practice, stage}`; where the user dies = a soft signal for difficulty) |
| **Your runs** (under the level's summary, when there are any) | the attempts at this exact version (its hash), "you play" ones 🎮 and real GD recordings 🎥, with how many cleared and where most deaths are; pick one: it replays as a **pink ghost cube** beside the route (a cross where it died), and the button band marks each of its presses against the route's -- on time (within 2 ticks, green), early / late (blue / orange, offset in ms), extra (red ×), a route press it missed (red ring; only up to where the run ended) | `tools/attempts.js` (local/attempts/<base>.jsonl: one format for both sources, `list` / `deaths`) |
| **A stage's plan, replayed at once** | a stage (layout, path) or a section variant with no route but a plan (`data.events`, else `data.planned` [{t, what}]; a variant's `planned`, or the layout's `data.alt[].options[].planned`) replays its planned presses through the sim in slices: no solve, ~a second. If it dies: "▶ The plan breaks here: block N, t s: why", a red cross at the spot, and the camera goes on as a ghost after it. The stage's `data.timing` / `target` show as "build time" | -- |
| **Level map, "draw it now"** | drawn in the page offscreen, one chunk per task with progress ("12/40"); the view and controls stay usable; GD art's new tints have a 40 ms budget per draw (lib/art.js `budget()`), the rest come on the next pass. GDLM 61, first visit: 3.8 s in all, one task of 140 ms (the first), the rest under 50 ms (was 8.8 s with 13 tasks of 140-280 ms and the view taken over) | -- |

## For sessions

- **Experiments are silent and not the user's: open the viewer with `?test=1`** (e.g. `http://localhost:8765/viewer/?test=1#lv=...`):
  no music, no click sound, no preference saved, and every mark, attempt, review and answer it sends is marked as a test
  (marks and attempts go to the `.test.jsonl` files; reviews and answers are not stored at all). `?mute=1` only silences.
  tools/headless.js adds test=1 (and `--mute-audio`) to every page it opens (shoot, levelmap, perf, readability, catalogue).
- **Sections**: put them on the index with `put({..., sections})`, `setSections(session, base, sections)` or
  `node tools/stages.js sections <session> <base> briefs/NN.seams.json`; a section's status for a role set again to a new
  state clears its old review. A section's answer: `approve(..., {verdict, note, spot, section, role})`.

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

`lib/liveplay.js` (live play with each attempt's inputs, planEvents, levelHash, comparePresses; `node tests/liveplay.js`), POST /play and GET /attempts (tools/serve.js), `tools/attempts.js`, `tools/actions.js`, `tools/ask.js` (local/asks/), `tools/stages.js` (approve, waitApproval, gate), `tools/serve.js`
(POST /stages/review, GET /asks, POST /asks/answer; marks also go to the feed), viewer/index.html (Work, stage review).
Tests: `node tests/work.js` (gate -> waiting -> review -> waitApproval; card put -> list -> answer; the feed and tail),
`node tests/stages.js`, `node tests/no_dialogs.js`.
