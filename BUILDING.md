# Building a level: the one process every build follows

The user (2026-11-24): "its a repeatable process, we need to make whatever needed to iterate better next time".
Every level build, whoever builds it (compose, make.js, a sync level, a themed level, an edit), follows these
steps. Nothing here is for one level or one session. When a build teaches something, change this page.

Owner of the tooling: gd-style (compose, tools/gated.js). Viewer side: gd-visuals (VIEWER.md). Measured step
times and the retro log: BUILDS.md.

## 1. Sections first, like a collab

The user: "usually it is easy to make a level in sections, where those section stops are defined... thats how
collabs are made. usually its one player doing layout, other deco and playtest. and it could be separate for
each section."

- The song plan sets the sections and their boundaries before any gameplay.
- Each boundary is a **seam contract**: mode, speed, gravity, mini/dual, the player's y and velocity, the scene
  and colours at that point. Inside a section anything may change while its seams hold.
- Each section has its own stages and status (layout -> deco -> playtest) and can be built, redone, varied or
  approved on its own, by any builder, in parallel. Joining sections only checks the seams (and the sync at the
  seam). This is also use case 8 (combine / cut).
- Seams are the incremental solver's checkpoints (lib/incsolve.js), so a changed section re-solves alone.
- Stored in briefs/<NN_name>.seams.json (committed next to the brief): `node tools/seams.js write <brief>` makes
  it, `seams.js check <brief> [level]` is the join check (y within 8 units, vy within 0.5, mode/speed/gravity/mini
  exact), `seams.js status <brief> <section> <role> <state> --by <builder>` records who builds what.

## 2. Design first: the presses come before the blocks

- A section's gameplay is built from its **planned presses** (the intended route), with each pattern's input
  timing from the intent cache (local/intent/). The timing plan (difficulty curve -> a target window per press)
  is set here; later fixes are small knob turns (spacing, gap, orb position), never a search.
- **Synced levels are beat-first**: the song's hits (kick / snare / accent) choose the presses, and the gap
  between two presses chooses a pattern whose timing fits it, placed so its press falls on its hit. If no pattern
  fits, tune the pattern's spacing, never move the press. Never slide presses with repeated whole-level solves.
  Sync is judged on the route's real presses: every press within +-1 frame of its hit, no extra presses.
- The shown and played route presses on the planned time when that clears (not at the window's end). Human route
  rules hold: short ~60 ms taps, buffered orbs, no jumps over nothing, ship in the middle.

## 3. A layout is playable the moment it exists

- The layout stage carries its full planned presses (data.planned). The viewer replays them at once (no solve),
  and the user can play it themselves. If the plan dies, that is a bug in the plan, shown at the death spot.
- The check solve comes after, only to catch secret ways (a skipped portal is wrong) and judge fairness. It
  never gates seeing or playing a level.

## 4. Stages are shown as they happen

- Every build puts its stages with tools/stages.js: song, layout (with planned presses), path, deco, final.
  Each records its seconds, shown next to its target. Targets: song in seconds, playable layout in about a
  minute.
- Alternatives being weighed (patterns, variants, song picks) go into the stage as alternatives (layout.alt[]:
  section, score, why, planned presses), so the viewer shows "considering A / B / C" and the user can pick.
- Gates: a build can wait for the user's ok after layout without holding the heavy lock (tools/gated.js: the
  layout job ends, the wait is outside the lock, then the rest queues as a new job). Redo rebuilds only the
  named section.
- Questions for the user go to the viewer as decision cards (tools/ask.js), not only to chat. Viewer actions
  reach the owning session through local/viewer_actions.jsonl.

## 5. Reuse, measure, retro

- Reuse before solving: intent cache, section score cache, solutions and incsolve, song analysis caches, the
  structure library.
- Times are measured (local/timings.jsonl by tool, level and flags); estimates quote their basis or say
  "not measured" (CLAUDE.md).
- After each build, BUILDS.md gets a retro: stage times against targets, rounds, what failed, the slowest step,
  and the change made, so the next build is faster.
- Viewer first: nothing is installed or uploaded until the user has seen it there and says so.
