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
| 9 | Taps on the theme board and 🗑 clear did nothing in the app. A plain browser worked. (2026-11-27) | Data from `db` (`onSnapshot`, `get`) comes back **frozen**. The page edited those objects in place (`splice`, `Object.assign`), which threw. | Always keep a copy: `JSON.parse(JSON.stringify(d.data()))`. Show page errors on a status line (`addEventListener("error", ...)`), so "nothing happens" says why. tools/designs_tab.js. |
| 8 | "it just hovers with the selection and doesnt do anything" (2026-11-27) | claude.ai's **comment mode** catches every click to start a comment. He can't remove the toggle, only turn it off. | First ask whether comment mode is on. A board also takes taps on its holder div, not only on the svg (`tilesAt` in designs_tab.js). |
| 7 | A republish reset his tab and scroll ("i lose what i look at", 2026-11-27) | Every publish reloads every open view. | Keep the view in localStorage (tab, scroll, folds). Republish in batches. CLAUDE.md "Pages keep the view". |
| 6 | He wanted to reload data himself (2026-11-27) | | Every page gets ⟳ refresh + "last refreshed" + a click effect: `tools/snippets/refresh.html`. Fetch with `cache: "no-store"`. |
| 5 | 📨 send to Claude refused right after typing | claude.ai refuses `sendToClaude` within ~6 s of a key typed in the page. | The button counts the hold down (`holdSend` in designs_tab.js). |
| 4 | Typed notes, edited in place, never reached Claude | A rewrite of the same db doc didn't land reliably. | Write each save as a **new revision doc**: `mid + "-" + Date.now().toString(36)`. Readers take the newest per id by `at`. `deleted: true` removes it; `seen: true` + `reply` folds it. |
| 3 | Resolved comment threads stayed on the page | Comment threads belong to claude.ai. Claude can reply and resolve, never delete. | Keep our own marks in `db` with states open -> seen -> fixed (CLAUDE.md "Notes and marks"). |
| 2 | Buttons that did nothing (alert / confirm / prompt) | The app's frames suppress native dialogs. | Never use them. Use in-page notices. `node tests/no_dialogs.js`. |
| 1 | A page "loading forever" (2026-11-25) | One renderer threw, and nothing after it ran. | Render each section in its own try/catch, and show a small error box (board/page.html). |

## Patterns that work

- A job he starts (build, apply ...) is a button on the thing it is about. The button sends Claude a one-line request with
  `CM.sendToClaude({anchor: await CM.anchorFor(card), text})`. The ~6 s hold after typing applies to it too.
- Notes save as they are typed (revision docs). 📨 sends only what changed since the last send.

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
