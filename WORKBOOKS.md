# Workbooks: every bug and rule we learned building pages in the claude.ai app

Evgeni works in his **workbooks**: private claude.ai artifacts (the lego catalogue with its Designs and Themes tabs,
the phone viewer, the workboard, marks pages). He works there, never in an external browser (2026-11-27: "i want to work
on the workbook not externally, always"). He also asked (2026-11-27: "whatever knowledge of bugs we gain working with
workbooks we want to know always on all sessions everywhere") that every session knows them. So:

- **Read this before you build or change any workbook page.**
- **When you find a new bug or quirk, add a line here in the same commit as the fix.** Say what you saw, why it happened,
  and the fix. Where you can, also add a check (a test, or a helper every page uses).

## Known bugs and quirks (newest first)

| # | What he saw | Why | Fix / rule |
|---|---|---|---|
| 10 | A note typed after a send stayed "not sent yet" after 📨 and ⟳ (2026-11-27) | Each card's 📨 sent only that card's things, so pressing a theme card's 📨 skipped the layout notes. Drawings' sent state lived only in memory, so after a refresh they showed as new again. | One send for everything new on the page, whichever 📨 is pressed: a top 📨 "N new" beside ⟳, and ⟳ sends first (`window.rfBeforeReload` in tools/snippets/refresh.html; false = stay and show why). Save the sent state in the db too (a revision with `sentAt`). tools/designs_tab.js `sendNew`. |
| 11 | A revision Claude wrote into the db lost to his older one (2026-11-27) | The page and tools/designs.js pick the newest revision by comparing `at` as text; Claude wrote `at` as a number (Date.now()), and an ISO string always sorts after it. | Every revision doc's `at` (and `sentAt`) is an ISO string (`new Date().toISOString()`), also when Claude writes it with ArtifactData. |
| 12 | "📨 N new" kept counting things already sent or applied, and the countdown felt bugged (2026-11-27, Evgeni: "need to find something less annoying") | A sent flag on every item (drawings, notes, sections) went out of step: Claude applied a drawing, the page still called it new; plus a 6 s countdown that disabled the buttons. | One time stamp for the last send (db collection `designsend`): new = changed after it and not written by Claude (`sentAt == at`). No countdown, no disabled buttons: a refused send says "press 📨 again". ⟳ tries to send and reloads either way. |
| 9 | Taps on the theme board and 🗑 clear did nothing in the app. A plain browser worked. (2026-11-27) | Data from `db` (`onSnapshot`, `get`) comes back **frozen**. The page edited those objects in place (`splice`, `Object.assign`), which threw. | Always keep a copy: `JSON.parse(JSON.stringify(d.data()))`. Show page errors on a status line (`addEventListener("error", ...)`), so "nothing happens" says why. tools/designs_tab.js. |
| 8 | "it just hovers with the selection and doesnt do anything" (2026-11-27) | claude.ai's **comment mode** catches every click to start a comment. He can't remove the toggle, only turn it off. | First ask whether comment mode is on. A board also takes taps on its holder div, not only on the svg (`tilesAt` in designs_tab.js). |
| 7 | A republish reset his tab and scroll ("i lose what i look at", 2026-11-27) | Every publish reloads every open view. | Keep the view in localStorage (tab, scroll, folds). Republish in batches. CLAUDE.md "Pages keep the view". |
| 6 | He wanted to reload data himself (2026-11-27) | | Every page gets ⟳ refresh + "last refreshed" + a click effect: `tools/snippets/refresh.html`. Fetch with `cache: "no-store"`. |
| 5 | 📨 send to Claude refused right after typing or tapping | claude.ai refuses `sendToClaude` within ~6 s of the last key or click inside the page ("Your last key or click may not have been meant for this artifact"); a tap on a drawing board counts, the send button's own click does not seem to. | The button counts down after typing (`holdSend`), any keydown counts, and any tap counts (pointerdown), and the buttons count down; the send must come straight from his click on 📨: a send delayed by a timer (wait, then retry by itself) was refused every time (2026-11-27), so never send later by itself. |
| 4 | Typed notes, edited in place, never reached Claude | A rewrite of the same db doc didn't land reliably. | Write each save as a **new revision doc**: `mid + "-" + Date.now().toString(36)`. Readers take the newest per id by `at`. `deleted: true` removes it; `seen: true` + `reply` folds it. |
| 3 | Resolved comment threads stayed on the page | Comment threads belong to claude.ai. Claude can reply and resolve, never delete. | Keep our own marks in `db` with states open -> seen -> fixed (CLAUDE.md "Notes and marks"). |
| 2 | Buttons that did nothing (alert / confirm / prompt) | The app's frames suppress native dialogs. | Never use them. Use in-page notices. `node tests/no_dialogs.js`. |
| 1 | A page "loading forever" (2026-11-25) | One renderer threw, and nothing after it ran. | Render each section in its own try/catch, and show a small error box (board/page.html). |

## Patterns that work

- A job he starts (build, apply ...) is a button on the thing it is about. The button sends Claude a one-line request with
  `CM.sendToClaude({anchor: await CM.anchorFor(card), text})`. The ~6 s hold after typing applies to it too.
- Notes save as they are typed (revision docs). 📨 sends only what changed since the last send, for the whole page at once,
  and ⟳ refresh sends it first. Keep the sent state in the db, never only in memory.

## Limits

- A db document must stay under 256 KiB. Store compact `{cols, rows}` for big tables (board/README.md).
- From a cloud session, Claude can't open the app version of a page: it needs Evgeni's sign-in. Don't open the browser
  pane on his PC to test (he finds it annoying). So build defensively (rows 9 and 8), and when something fails, ask him
  for the status-line text or a screenshot.
- Artifacts load scripts only from the allowed CDNs. Everything else goes inline or as a published file beside the page.

## How to test a page

- Its logic in node where you can (tests/*.js).
- Its db code against frozen data: wrap test data in `Object.freeze` deeply, the way the app returns it.
- Then publish, and ask him what the status line says.

- **The app's send hold, worked around (2026-11-27).** Evgeni: "happens too much how can we workaround it". The hold (no send within about 6 s of a key or tap in the page) can't be skipped, and a send has to come from his own tap. So after a refused send, the page lights the 📨 buttons green with "tap now" once the hold is over: only the label changes, and nothing is sent by itself. The other way in always works: he writes "comments" in the chat, and Claude reads everything new from the page's db since the last `designsend` stamp. tools/designs_tab.js "READY CUE".
- **A db snapshot has `.docs` but no `.forEach` (2026-11-27).** The catalogue's last-send listener used `snap.forEach`, which threw without a word. After every reload LAST went back to its default, so notes Claude had already received counted as "new" again (Evgeni: "those 6 new, you really didnt see them?"). Use `snap.docs.map(...)`. Claude also writes `{at, by: "claude"}` to `designsend` each time it reads the queue, which counts as a send.

## Claude's answer on each thing he sent (2026-11-27)
Evgeni: "i should be able to understand whether some request already applied after i sent it ... if something is lost or
unread". The catalogue's theme layout shows one line under every section, note and generated piece: ✎ not sent yet /
📨 sent, waiting for Claude / 👀 Claude read it / ✓ applied, ❓ question, ➜ passed on (+ Claude's one-line answer).
Claude writes the answer as a doc in collection `claudestatus`: `{part: "sec:<key>" | "gen:<key>:<seed>:<cols>:<tier>" |
"play", state: applied | read | question | passed, reply, at}` (newest `at` per part wins; a later edit of his reopens it).
Every time Claude handles board items it writes these, and a `designsend` stamp `{at, by: "claude"}`.
