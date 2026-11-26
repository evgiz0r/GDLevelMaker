# GD Work Board

Evgeni's control page, a private claude.ai artifact: https://claude.ai/artifact/VJYMwpuHPKoZ38ufXi25E2
(source: `board/page.html`; republish it with the Artifact tool to that url). He ticks and orders next tasks; Claude schedules from them.
No Start buttons. Refresh about every 10 min while he works, about hourly when not.

Data (ArtifactData, collection `board`):
- `board/state`, written by Claude only (update with if_version; bump `updated_at` on a status refresh):
  - `workstreams[]`: `{id, name, state: running|waiting|blocked|idle|done, summary, left, eta_min, eta_at?, eta_basis}`
  - `candidates[]`: `{id, title, area, eta_min, eta_basis, status: open|scheduled|running|done, note?}`
  - `mains`: `{at, note, levels[]}` -- rows from `node tools/board_mains.js --json` (on the PC; `--local <dir>` for a copy of local/)
    Each row may carry `coins: {total, got, note}` (secret coins our route collects; `got: null` = no coin route yet, from `tools/coins.js status` on the PC).
  - `physics`: `{features[{name, level 1-4, label, evidence, gap?}], missing[{name, used_by?}]}` -- kept in `board/physics.json`;
    update it with PHYSICS.md when a feature is checked or a mismatch closes
  - `levels[]`: `{name, state, status, note, link}` -- our levels in progress, each linking to the phone viewer (`viewer_url` + `#<file base>`)
  - `usage`: `{pct|null, cap_pct: 70, resets_at?, note?}` -- the user's rule (2026-11-25): don't go past 70% of his Claude usage
- `board/picks`, written by the page only, never by Claude: `{selected[ids, first = do first], ideas[{id, title, added_at}], changed_at}`
  - `played` (its own doc, board/played; state.played is the fallback): `{at, totals, note, levels[]}` -- finished levels only (done) -- every level the user finished, from their save (read only): `{id, name, creator?, kind: main|online, tier, stars?, attempts, jumps, best, practice}`. Mains from local/difficulty/user_stats.json; online from local/difficulty/user_stats_online.json (PC). Private: the board only, never committed.
- `board/picks.study`: level keys the user ticked in "Your levels" to study slowly (online ID as a string-number, `m<n>` for a main level). The page writes it with the rest of picks. Each refresh, Claude passes new keys to a PC session: fetch (tools/fetch_level.js), cut into structures (tools/lego.js), score (difficulty), at low heavy priority.

## Features (2026-11-25)

`board/state.features` (Claude writes): `{updated_at, flows: [{id, name, maturity 1-5, time, note}], ideas: [{id, title,
status: "idea" | "in progress" | "done", note}]}`. The flows mirror the README's welcome table; ideas come from
Claude and the coordinator. The page writes Evgeni's side into `board/picks`: `feat_picks` (idea ids he ticked) and
`feat_ideas` (`[{id: "fidea-...", title, added_at}]`, ideas he typed). On each refresh: a picked idea gets a thread
(through the coordinator) and its state entry goes to "in progress", then "done"; a typed idea gets a state entry.
A ticked idea with no state change shows as "picked".

## Done archive (2026-11-25)

Evgeni: finished things stayed on the board too long. Any workstream, candidate, feature idea or level whose
`state`/`status` is "done" leaves the main view 24 h after its `done_at` (ISO time; set it when you mark something
done), or at once when it has none; "archived" leaves at once. They are listed in the collapsed "Done" section at the
bottom. So: when marking an item done, write `done_at`. Levels moved to levels/archive get `state: "archived"`.

## Size limit and loading (2026-11-25)

A db document must stay under 256 KiB. `board/played` was 343 KB with one object per level and is now stored compact:
`{at, note, totals, cols: ["id","name","creator","kind","tier","stars","attempts","jumps","best","practice"], rows: [[...]]}`
(~100 KB); the page unpacks it. The page reads `played` once (not live), watches `state` and `picks` live, shows an
error with Retry after ~20 s, then falls back to re-reading every minute; the banner lists the page's permission
states and offers "Allow data access" / "Permissions" when one is off.

## Latest rated and unfinished levels (2026-11-25)

- `board/latest` (Claude writes): GD's recently rated list, compact `{at, source, cols, rows}` from
  `node tools/latest_rated.js` on the PC (gdbrowser.com, metadata only; the cloud can't reach it) ->
  `local/community/latest_rated.json`; `node tools/board_docs.js --out <dir>` builds both compact docs to write. The page's "Latest rated" section: Study ticks go to the same `picks.study`
  (key = online id), a "Not played" filter against Your levels.
- `board/played` holds every level with attempts, finished or not (col `done`), split in parts of 600 rows (~40 KB): `board/played` = head (`parts`, totals, note, cols) + first rows, `board/played_2..N` = `{part, rows}`; one 170 KB doc did not load in his app (2026-11-25), so keep parts small. state.played is gone (it was a stale 22-row copy); "Finished" /
  "Not finished" filters. Refresh: `node tools/save_stats.js` on the PC (GD writes its save when it closes, so a session's
  plays show up after GD is closed or saves).

## Menus (2026-11-26)

Every section is a collapsible menu (`<details>`), closed by default (Evgeni: "make all menus collapsible and they will be by default"); each closed header shows a count. Two bugs fixed then: the page had two functions named `isDone` (the played-row one, now `rowDone`, overwrote the archive's, so nothing ever went to Done), and database objects are read-only, so the page tags copies of the feature ideas (Features threw "Cannot read properties of undefined (reading 'replace')").

## Local board, no artifact (2026-11-26)

Evgeni: "can you give me non artifact thingy" (the artifact pane kept failing to load). The same page runs locally:
`node tools/board_local.js` -> http://localhost:8770/ (this PC only), or http://localhost:8765/board/ once
`tools/serve.js` runs a version with the mount. A shim stands in for the artifact runtime: each document is a file
`local/board/<name>.json` holding the same object ArtifactData stores (`state`, `picks`, `played`, `played_2..N`,
`latest`), polled every 15 s; the page writes only `picks`. Test: `node tests/board_local.js`.

**Every board refresh writes both**: the artifact (ArtifactData) and `local/board/<doc>.json` (same JSON). For picks,
read both `local/board/picks.json` and the artifact's `board/picks` and act on the one with the newer `changed_at`
(Evgeni may tick on either page). `local/board/` holds his save stats: never commit it.