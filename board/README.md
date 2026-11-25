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
