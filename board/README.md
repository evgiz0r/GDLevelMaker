# GD Work Board

Evgeni's control page, a private claude.ai artifact: https://claude.ai/artifact/NTEEv6GZHJpETBLbfQADFJ
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
