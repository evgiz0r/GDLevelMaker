# Building a level: the one process every build follows

The user (2026-11-24): "its a repeatable process, we need to make whatever needed to iterate better next time".
Every level build, whoever builds it (compose, make.js, a sync level, a themed level, an edit), follows these
steps. Nothing here is for one level or one session. When a build teaches something, change this page.

Owner of the tooling: gd-style (compose, tools/gated.js). Viewer side: gd-visuals (VIEWER.md). Measured step
times and the retro log: BUILDS.md.

## 0. The pipeline Evgeni set (2026-11-25)

Theme -> sections (soft differences, cut at strong beats or small breaks in the song) -> fill each section from the big lego
(verified pieces whose clicks match the section's beats) -> fill leftover gaps with hazards (no secret ways) = the layout and
its path -> deco, the structural objects themed per section first. What exists per step and what is missing: LEGO.md
"The build pipeline Evgeni set".

What the lego taught so far, for any builder filling a section from it (LEGO.md has the numbers):
- **Join only bricks whose seams agree** (mode, speed, gravity, y, vy, ground): with that contract 35% of joins are clean,
  without it 15%. A third of joins still leave a secret way or an open seam: every join gets the hazard filler and is
  re-checked by the solver (secret way = route more than 2.5 blocks off the bricks' own routes).
- **At a mode change, a connector, not a bare portal**: the next brick starts in the mode the last ends in, or a short
  corridor carries the proper portal (Evgeni). **Dash orbs** near a seam: hold them to the longest in the join check; a
  dash that flies over the next brick's presses is a secret way (LEGO.md "Joining and connecting").
- **Cut bricks at their ✂ cut points** (`P.cuts`: button up, 0.2 s to the next press, on the ground) to fit a section's
  beats with fewer presses; a slice keeps its route but its join is checked again.
- **Combine like the main levels**: next brick a different signature (official 16% repeat vs ours 37%), portals entered in
  the air, a speed change at a portal, 0.4-0.5 s quiet around it, and use the height (official up to 13 blocks, ours 7).
- **Don't copy a brick's flying taps blindly**: some main-level wave routes tap in corridors (18 of 60 wave bricks have
  presses under 0.1 s apart, mostly Deadlocked). Take the layout and re-plan the presses for easy timings: an extra press
  or two is fine, a run of tiny taps or a tight window is not (Evgeni; knowledge/checklist.md).

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

### Building in parts, one builder each: tools/collab.js (2026-11-24)

The user: "Each section like 10 20 seconds. Done by a different agent just connected together. Need to align the
song (speed portals may ruin if we add), location of the switch. Other than that those can be completely isolated."

- **Split** (`node tools/collab.js split <brief>`): compose's sections (in beats) are grouped into **parts of 10-20 s**
  on section boundaries (or the brief's `"parts": [[0,1],[2],...]`). Each part boundary is a seam pinned to a
  **song time** (its beat), never an x. The contract at a seam: the cube, grounded on the floor (y 15), normal
  gravity and size, at the speed the player **arrives** with (the part before ends at it). A part that runs at another
  speed switches with its own speed portal; mode portals live inside a part too (a ship section enters and leaves the
  ship itself). -> local/collab/<base>/plan.json; the viewer card shows one section per part
  with its builder and state.
- **Build** (`node tools/collab.js build <brief> <part> --by <builder>`): the part is its own small level whose time 0
  is its seam's song time (the brief's offset moved to the part's first beat, unrounded), so its beats, sync and
  speed portals are its own business and its length in blocks follows from its speeds. Composed, built, routed and
  checked alone (a few seconds of solving), -> p<i>.gdlvl + p<i>.json (its route, its exit state, its time).
  A part after the first starts with a short lead-in (`partLeadIn`, 4 blocks), not the level's 10-block calm start.
- **Join** (`node tools/collab.js join <brief>`): part i's objects move by the x the player has covered when part i
  starts (the sum of the parts before, each measured on its own speed timeline), so every seam lands on its song
  time whatever speeds a part used inside. The parts' routes join by time (tick offset = seam time x 240) and replay
  on the joined level: no solve. Checked: the state at every seam against the contract (mode, speed, gravity exact;
  y within 8; vy ~0) and the sync (the joined level's x at the seam time = the next part's start, within 6 units),
  then the joined route is saved and score.js runs once on the whole level. A failed seam or a death sends back only that part.
- **Builders**: one agent per part, given only its part (the brief's sections for it) and its two seams; it runs
  `build`, reads its checks (its own seam too: `seam` FAIL = the state it hands over at the seam time is not the
  contract), and may retry with `--seed n` (every section of the part from another plan; a ship / wave section has
  no chunks to vary). Builds take the heavy lock (2 slots now), so 4 parts build two at a time.

**The coordinator (tools/coordinator.js), before any part** -- the user (2026-11-24): "first a coordinator of the collab,
so they don't just combine ... he gives them roles, and whether he makes the picture or them is a choice". `node
tools/coordinator.js plan <brief> [--look shared|per-part]` writes briefs/<NN>.coord.json (committed): the journey, the
mood / energy curve and the difficulty curve over the parts, and per part its ROLE (intro, build, drop, calm, finale --
from the song plan: the first part is the intro, the last the finale, a part with a drop or a flight after cube is a
drop, the one before a drop builds), its density (gaps by role), its difficulty, its transitions, what it MUST do (the
title: intro only; the ending: finale only; its seams) and MUST NOT (another part's set pieces: each library structure
belongs to one part). Look ownership per level: "shared" (the coordinator's palettes, the brief's sections) or
"per-part" (each part its own style from a pool, under the coordinator's rules: path vs sky >= 3, colours blending over
1.7 s at each seam). Every `collab.js build` / `deco` applies its part's entry. `coordinator.js review <brief>` checks
each built part against its role before the join (title / ending in the wrong part, another part's set piece, a drop
thinner or an intro / calm denser than the level's middle) and names the parts to send back with the reason. The
viewer's sections bar shows each part's role. The brief's shape is meant to become gd-showcase's storyboard / vibe
sheet (tools/storyboard.js) once that exists.

**Watching a collab build: the combined track** (the user picked option A of local/collab/mockup.svg). While parts
build, the level's card in the viewer shows ONE track of the whole song: every built part at its song time (placed as
the join places it, with its route), a placeholder for each part not built yet (a flat floor for its song time at its
seam speed, with its role and contract written on it; the camera runs through). `collab.js preview <brief>` makes it,
and every part build refreshes it (light: no solve, no lock). The parts strip under the stage bar is the sections bar:
role, name, L / D / P / J pills (builder and state on hover); a click jumps to the part, a DOUBLE-click opens the part
alone (its own card, <level>_p<k>, with its builder's stages), and "◀ <level>" goes back. After the join the same card
is the joined level. Energy: score.js "energy curve" compares the level's real energy (gd-taste's storyboard measure)
with the coordinator's intended curve.

**Fixes through the model** -- the user (2026-11-24): "when we fix/reshape a level ... call such person, depending on the
size of the fix, so that the fix matches the level anyway." Every level has a MODEL next to it (tools/model.js): its
sections with role, energy (hazards per 100 blocks), look and vehicle -- the coordinator's brief when it has one, else
derived from the level (bg colour changes cut the sections, energy by rank gives the roles); `node tools/model.js
<level>` saves it as levels/<slug>.model.json. A fix is sized and checked against it (`model.js check <before> <after>`):
- **small** (a few objects at one spot): automatic -- the touched section keeps its role (a calm / intro part not much
  denser, a drop not thinner: 35%), its energy (within 60%), its look (the same colour triggers) and its vehicle;
- **medium** (a section reworked, 8+ objects or 6+ blocks, a recolour): the coordinator reviews the new section against
  its role before it lands (`coordinator.js review` for collab levels; else a session reads the model check);
- **large** (several sections, a mode / speed change, a restyle, a retarget): re-plan the model first, then build.
tools/edit.js prints it after every edit ("model: a small fix -- keeps the level's model"), so fix.js, markedit.js,
retarget.js and review.js get it too; tools/polish.js prints it for its output. Open: a level with no brief gets its
model from gd-showcase's tools/storyboard.js once it lands (richer: moments, places), not only the derived one.

**Rules the first joins taught (GDLM 65, 2026-11-24)** -- each was a failed join, each is now in the code:
- **A part's level header is dropped at the join**: a part never relies on it. The seam speed is the arrival speed and
  a faster part places its own speed portal (the first contract said "the next part's speed"; part 2 ran 2x off its
  header and the joined level never had it).
- **No portal on a part's first columns** (`portalRoom` 3): joined, the player reaches a portal's hitbox ~30 units
  before the seam; alone it starts inside it at time 0. 13 ticks of extra ship physics killed the joined route.
- **A part that ends in flight exits 4 blocks before its seam** (`exitRoom`): exiting at the section's very end left
  the cube on the portal's frame block (y 45) at the seam.
- **Every seam starts with the button up**: the join cuts each part's run-out (and a release in it), so it adds a
  release at the seam; a hold carried into the next part's ship.
- **The seam state is read 30 ticks before the seam**, before the next part's first portal can touch the player.
- **Nothing from before a part's start** joins (parts carry deco to x -300).
- **A part fails only on part gates** (beatable, prejumps, timing, recovery, skips, reactive, fairness, seam); the
  level-wide ones (difficulty, length, pacing, sync) are judged at the join.
- **Parts are placed on the joined timeline** (each part where the joined level, earlier parts' portals in, has the player
  at its song time): drift cannot add up; the gap left per seam is reported against a 6-unit budget.
- **The join re-routes a part from the state it is handed** when its own route does not carry over (solveSweep from
  30 ticks before the seam to the part's end): flight seams and small landing differences need no rebuild.
- **Seams inside a flight**: the next part's first section has `"continue": true` (same mode): no exit portal before
  the seam (the part brief carries `_continueAfter`), a mode-only contract, the next part re-routed from the real state.
- **Decoration**: `collab.js deco` per part (kit scene in each section's colours) or `collab.js scene` once over the
  joined level (a level-wide scene). Build parts with the modern block dressing on, or blocks show their raw grid skin.
- **Upside-down and flying parts exit 6 blocks before their seam**; the exit is read 30 ticks before the seam, as the join reads it.
- **Builders write only their own entry of plan.json** (re-read, change, write): two builds finish at once now. An old
  builder process still running old code rewrote the whole plan once and put the old seams back -- stop old builders
  before changing the contract.

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
  MEASURED (tools/habits.js, 2026-11-24, 3,094 presses of the user's real GD runs on the fixed logger): the user's
  taps are 120 ms at the median (p10 88, p90 161 ms), twice the ~60 ms above; presses ~0.5 s apart at the median.
  Not changed yet (the 60 ms came from the user): asked. And the user's own clears that the sim replays are saved as
  "player" routes beside the solver's (tools/replay_run.js; PHYSICS.md "Fidelity").
  Built (2026-11-24): the planned presses are read from ONE place, the level's stages index
  (local/wip/<session>/<slug>.stages/index.json, stage "layout", else "path": data.planned [{t seconds, what}],
  releases left out) or a <slug>.planned.json beside the level; `node tools/planned.js "<level name>"` lists them.
  tools/solutions.js passes them to lib/natural.js (opts.planned) from make.js, wip.js and tests/saved_routes.js:
  each press goes to the nearest planned tick inside its window, else ~40% in. GDLM 62: 1 -> 33 of 62 presses
  on a planned time.

- **Pieces (LEGO.md "How the building process uses the pieces")**: a section's layout is a row of 1-3 s pieces, each
  a kind (family / wrapper / mechanics) picked by the section's role, the official mix and the variety rule (no kind
  from the 4 before), then sized by the tier; fly sections are built path-first and wrapped. Picker not built yet.

## 3. A layout is playable the moment it exists

- The layout stage carries its full planned presses (data.planned). The viewer replays them at once (no solve),
  and the user can play it themselves. If the plan dies, that is a bug in the plan, shown at the death spot.
- The check solve comes after, only to catch secret ways (a skipped portal is wrong) and judge fairness. It
  never gates seeing or playing a level.

## 4. Stages are shown as they happen

- **Every stage carries its own working route** (data.events) once one exists: the viewer replays a stage's own route.
  compose attaches the final level's saved route to path / deco / final after replaying it on each stage's level
  (data.planned = its presses; the patterns' intents only as data.intended). GDLM 72's path stage had only the intents
  (dead at x 478) and deco / final none. Old builds: `node tools/restage.js <level> --session <name>`.
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
- Every level has a song, test labs included: recordings line the user's inputs up with the song's audio
  (tools/audiolog.ps1, replay_run.js); a level with no song falls back to the progress bar.
- Viewer first: nothing is installed or uploaded until the user has seen it there and says so.

## 6. Reverse: decompile a real level, rebuild it from its spec, diff (tools/recompile.js)

The benchmark for this whole way of building (the user, 2026-11-24: "level -> sections -> spec -> sections -> level ->
compare to original"; VIBES.md, USE_CASES 31). One command, one artifact per step, each a stage of the rebuild in the
viewer (stage bar: original > spec > plan > layout ... final > compare), so the user can stop at any step, edit, and
go on:

    node tools/recompile.js <official:N | c<id> | level.gdlvl> --name "GDLM NN name" [--spec sheet.vibe.json]
                            [--from decompile|abstract|plan|build|compare] [--to ...] [--pictures]

1. **Decompile** (level -> sections): cut at the song's sections (taste's cut, tools/compare_sections.js), each with
   its type, modes, speeds, energy (tools/energy.js), density, colours, moments (tools/storyboard.js).
   `local/recompile/<slug>/sections.json`; stage **original** (the real level with its sections on the track).
2. **Abstract** (sections -> spec): the vibe sheet in the user's layers (intent, experience curve, scenes and roles,
   motifs, rhythm; VIBES.md). The lossy step: no blocks, no positions. The machine writes one; a person's sheet
   (`--spec`) replaces it. `spec.json`, `spec.md`, `briefs/<NN>_<name>.vibe.json`; stage **spec**.
3. **Plan** (spec -> sections): tools/vibe.js makes the compose brief, tools/collab.js split pins the parts' seams to
   song time, tools/coordinator.js plan gives each part its role -- from the spec ALONE. `briefs/<NN>_<name>.json`,
   `plan.json`; stage **plan**.
4. **Build** (sections -> level): each part built alone, then joined (section 1). The level; stages layout ... final.
5. **Compare**: the original vs the spec used (what the spec dropped), the spec vs the rebuild decompiled by steps 1-2
   (what the build could not deliver), tools/vibediff.js beat by beat and taste's section comparison
   (`--pictures`: the side-by-side sheets). `compare.md`; stage **compare**.

A gap found in the spec is a missing layer or field (VIBES.md "The vibe sheet"); a gap found in the build is something
the pipeline cannot make yet (a mode compose has no section for, mirror portals, per-beat effects): both go into
VIBES.md "Results" with the level they came from.
