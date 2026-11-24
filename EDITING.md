# Editing, reviewing and fixing levels -- the everyday loop as tools

The user's loop today: they mark a spot in the viewer (or circle it on a screenshot), a session reads it, edits the
level by hand, re-checks it and replies. These tools do each step, on a COPY, with the checks re-run, for any level
(ours, official, community, the user's save). USE_CASES.md rows 16, 17, 4, 2. Owner: the editing session
(2026-11-23); any session may use and extend them.

| tool | use case | what it does | how long |
|---|---|---|---|
| `tools/edit.js` | 16 edit by prompt | one change at one spot -> a copy, re-solved, checks before/after, before/after picture | see "Times" |
| `tools/markedit.js` | 17 edit by mark / picture | a viewer mark or a screenshot note -> its soft-rule family -> the edit -> the family swept over every level | edit + ~1 min sweep |
| `tools/review.js` | 4 issue report | every check -> one ranked list (effect, effort, fix, auto?), a phone page | 10 s - 2 min (+ a solve if no route) |
| `tools/fix.js` | 2 fix any level | review -> the top safe fixes on a copy, each kept only if it helps -> review again | review x2 + seconds per fix |
| `tools/retarget.js` | 13 easier / harder | the hardest (or most generous) inputs first, small edits scored by the difficulty model, until the target tier | see "Times" |
| `tools/families.js` | (shared) | the table of soft-rule families: note words, effect, effort, fix, auto-fix | instant |

Tests: `node tests/editing.js` (`--quick`: no solve). Never installs or uploads; never writes the original level.

## 16. Edit by prompt: `tools/edit.js`

```
node tools/edit.js <level> --at <spot> "<change in words>" [--do '<ops>'] [--dry] [--show] [--no-shots] [--full] [--session s]
```
- **level**: a `.gdlvl`, `save:<name>`, `official:N`, a community ID (`local/community/<id>.gdlvl`), or a viewer
  link `.../viewer/#lv=<file>&t=<s>` (which also gives the spot).
- **spot** (`--at`): `b45` / `block 45` (the viewer's block = player x / 30, what its clock shows), `x=1350`,
  `t=12.3` (the route's position at that second, as the viewer's clock), `beat 32` (our levels with a song), or a
  viewer link. A height: `,r2` (row 2 above the ground) or `,y=75`.
- **words** (`--vocab` prints them): `add a yellow orb here` · `add 2 spikes 3 blocks right` · `remove this orb` ·
  `remove these spikes` · `remove spikes from b40 to b50` · `lower this block by 1` · `raise this block 2` ·
  `move this orb left by 0.5` · `extend this block 2 right` · `replace this yellow orb with a pink orb` ·
  `make this section a wave` · several joined by `then`. "this" = the nearest match within 4 blocks; "these" = its
  row (hazards, orbs on one surface, neighbours 1.5 blocks apart at most) or its structure (touching blocks). A
  block moves with what stands on it or hangs off it. Words it does not know give an error, never a guess.
- **Ops** (`--do`, JSON; what a session writes when the words don't cover it -- the Claude-side interpretation):
  `{op:"add", type, col, row, props?}` · `{op:"remove", what, group?, from?, to?, at?, exact?}` ·
  `{op:"move", what, dx, dy, group?, alone?}` · `{op:"extend", what, n, side}` · `{op:"replace", what, with}` ·
  `{op:"mode", mode}` · `{op:"centre", what:"orb"}` (over its hazard row) · `{op:"clearmark"}` (a jump mark back
  to the nearest spot clear of hazards) · `{op:"set", what, props, rot}`. `what` is a name (`yellow orb`), a class
  (`block`, `spike`, `orb`, `pad`, `portal`, `mark`, `deco`) or `id 914`; `at` (a column) overrides the spot per op.
- `--show`: the objects within 5 blocks and a text picture of the spot with the route (for writing ops by hand).

What it prints: the parsed ops (so a wrong reading shows), each change with its blocks, objects added/removed and
**how many changed away from the spot** (should be 0), the copy's path, the route (beaten?, presses, how it was
re-solved), the tightest window within 6 blocks before -> after, the checks that went away and the NEW ones, a
before/after picture (`<copy>_before_after.png`, shoot.js frames side by side) and a viewer link.

Re-solve order: the old route if it still clears (a re-plan of the human route, seconds), then `lib/incsolve.js`
(gd-incsolve's `incsolve.fromBase(oldLevel, oldEvents, newLevel)`: the route kept up to a calm point before the
change, searched from there until it is back on the old route, the rest spliced back), then a full solve (its
reason printed, e.g. "incsolve: the level header changed"). Checks: `quickChecks` = tools/rules.js (fast) + softrules.js + indicators.js on the saved
route, no solve. `--full` also runs every score.js gate (solves again).

Copies go to `local/edits/<slug>.e<N>.gdlvl` with a `.json` report (shared folder, never committed: it may be
someone else's level). To make an edit part of OUR level, carry it into the spec (the copy shows what to change),
or `--session <name>` puts the copy in the viewer's in-progress list.

## 17. Edit by mark or picture: `tools/markedit.js`

```
node tools/markedit.js list [level]                       open marks, each with its family
node tools/markedit.js <mark id> [--words "..."|--do '<ops>'] [--done] [--no-shots] [--no-sweep]
node tools/markedit.js --level <lvl> --at <spot> --note "<the user's words>"      a screenshot note
node tools/markedit.js --new-family <id> --words "kw1|kw2" --line "<checklist line>"
```
1. **Spot**: the mark's x/y (the viewer's ✎ and the phone's marks both pin one). For an annotated screenshot (the
   user circles something in the viewer or the in-app browser), read the viewer header in the picture -- `12.30 s ·
   block 45.2` -- or the page's `#lv=` link, and pass it as `--at`. The circle's height, when it matters: `,r<row>`.
2. **Family** (tools/families.js): the note's words pick the soft rule it belongs to (18 of today's notes tested in
   tests/editing.js: "arrow into the spike" -> jump marks, "very specific cube jumps" -> reactive, "triple orb ...
   cant adjust" -> fairness chain, ...).
3. **Change**: the note read as edit words if it is an instruction ("remove these spikes"); else `--words`/`--do`
   from the session; else the family's own fix for the issue its check finds within 3 blocks (a mark too close to
   a spike -> moved clear). With none, it prints the text picture and asks for words or ops.
4. **Edit** via tools/edit.js. 5. **Sweep**: the family's check over every `levels/gdlm_*.gdlvl` -> "N other spots
   in M levels", which goes in the reply to the user (their rule: every note is a soft rule, reapplied everywhere).
6. `--done` closes the mark with what changed and the sweep count.

A note no family covers is a NEW rule: `--new-family` adds it to `knowledge/families.json` (so the next note like it
is recognised) and a line under "From the user's marks" in knowledge/checklist.md. Its scored check is then
written by hand in tools/rules.js or softrules.js (the line moves to its section, the family gets its rule name).

## 4. Review: `tools/review.js`

```
node tools/review.js <level> [--top N] [--gates] [--render] [--no-fair] [--json]
```
Runs on the saved route (solved once if there is none): the route (beaten, kind), tools/rules.js with the
player-timing windows, softrules.js, indicators.js, fairness.js flags, skips.js, craft.js targets, ending / length /
mode changes as score.js's gates, readability.js's saved numbers (`--render` measures them, ~8 min), and with
`--gates` every score.js gate. One list, ranked by **effect** on the player (fairness > readability > flow > boredom
> look; a FAIL above any WARN), the cheapest **effort** first among equals (look = decoration only, local = a small
gameplay edit, redesign = a section rebuilt). Each issue: block, level time, viewer link, suggested fix, and
**auto** when fix.js can apply it. Writes `local/review/<slug>.json` and `<slug>.html` (a phone page: cards,
dark mode; publish it as an artifact to read it on the phone).

## 2. Fix any level: `tools/fix.js`

```
node tools/fix.js <level> [--top N] ["request in words"] [--at <spot>] [--dry] [--no-shots] [--session s]
```
Review -> up to N (default 5) auto fixes from the top of the list -> each applied on the running copy and **kept
only if** the level is still beaten, that issue is gone and no new issue appears (else rolled back, with why) ->
review again -> before/after picture at the first fix. A request narrows it: family words ("the arrows",
"flashy") or an effect ("fairer", "prettier"); with `--at` it is an edit applied first. Prints what is left for a
session (redesigns, look passes) with each fix in words. Works on official levels (on a local copy under
`local/review/`, never installed or published) and community levels.

Auto fixes today (tools/families.js `auto`): jump mark too close to / over a hazard -> moved back clear; orb off its
row's centre -> centred; doubled (overlapping) hazard -> one removed; a landing on a 1-block spot -> the block
extended 2 right; hazards nobody jumps -> removed; text under GD's attempt counter -> moved 8 blocks on; a mark
where no jump is needed -> removed. Add one: an `auto: issue => ops` on its family, and a golden case in the test.

## 13. Make it easier / harder: `tools/retarget.js`

```
node tools/retarget.js <level> --to <easier | harder | Easy..Insane | stars 1-10 | 0.5> [--max 8] [--spots 4] [--dry]
```
The score is lib/difficulty.js's (log10 of the attempts a player needs; tiers Easy < 0.3 < Normal < 0.8 < Hard < 1.5
< Harder < 2.5 < Insane < 4). Each round takes the `--spots` costliest inputs (easier: lowest hit chance) or the most
generous cube/robot inputs (harder: widest windows), tries small edits there (easier: a hazard row one shorter or a
block later, a step a row lower, a landing a block wider, an orb half a block either way; harder: a row one longer
or a block earlier), re-solves each without a full solve (old route, then incsolve), measures the windows within 8
blocks again, keeps the best only if the level still beats and the quick checks get no new issue, then scores the
whole level again. Portals, decoration and triggers are never touched (sync and look kept). Prints the score and tier
before -> after, each edit, a per-section curve (mode, inputs, tightest window, score) before and after, and a
before/after picture at the biggest change. `easier`/`harder` lowercase = one tier that way; `Harder` = that tier.
Open: swapping whole structures for easier/harder library entries by their difficulty tags (needs to know where a
structure sits in a built level: compose's section plan has it; a level from elsewhere does not).

## Hand-off (2026-11-24, from the local editing session to a cloud session)

**Done and on main** (all on copies, never the original; never installs or uploads):
- 16 `tools/edit.js`, 17 `tools/markedit.js`, 4 `tools/review.js`, 2 `tools/fix.js`, 13 `tools/retarget.js`, the shared
  `tools/families.js`. Usage: the sections above and each file's header (`node tools/<tool>.js` prints it).
- score.js staticRules' symmetry judges an orb pair's middle once (was: each orb of a mirrored pair flagged).
- edit.js re-solves: old route -> `lib/incsolve.js` `incsolve.fromBase` (with `inc` + `world` handed to
  `solutions.fromRun`, so only the changed stretch is re-planned) -> a full solve.

**Tests and their status** (local PC, 2026-11-24):
- `node tests/editing.js --quick`: 46/46 ok (vocabulary, 18 user notes -> families, dry edits on GDLM 61 touch only
  the right objects and never the file, retarget targets and candidates). Without `--quick` it also runs one REAL
  edit (a jump mark moved clear of its spike on GDLM 61): written, NEVER RUN yet (the PC's heavy slot was full all
  night). First thing to run in the cloud.
- `node tests/edit_replays.js --dry`: 10/10 ok. Without `--dry`: the 5 replays as real edits -- never run yet.
- Both seed `local/solutions/` from `tests/fixtures/edit_routes/` (the saved routes of GDLM 61 and the four old
  versions), so they run on a fresh checkout. The old versions come from git (`git show <commit>:levels/...`).
- Not run since the symmetry change: `node tests/style_gates.js` (solves; run it).

**The user's marks used as test cases** (tests/edit_replays.js, with spot and words; the user's own words from
knowledge/critiques.md, TASTE.md, checklist.md -- local/marks.jsonl was empty all day: the viewer's mark box was
broken until visuals fixed it on 2026-11-23 night):
| level @ commit | spot | the user's words | family | the fix the tools pick | what a session did by hand |
|---|---|---|---|---|---|
| 44 hellgate @54704b4 (round 2) | b41 | "indicator inside spike" | jump marks | clearmark: the mark 1.5 blocks back | marks kept 40 units in front (2424373) |
| 50 eclipse @d60d543 (v2) | b24.5 | "arrow into the spike" | jump marks | clearmark | softrules arrows + placement (701909b) |
| 50 eclipse @d60d543 | b42 | "too close to the spike, almost inside it" | jump marks | clearmark | same |
| 47 sunny side @cae1b05 | b750 | (symmetry) "not pretty ... not over the centre" | symmetry | centre (a pair moves as one) | orbs centred in the spec |
| 45 first flight @cae1b05 (v6) | b301.5 | "not symmetrical to their structure" | symmetry | centre | symmetric orb pit (f31e4fc) |
The other 13 notes (reactive, hazards matter, clusters, flash/contrast, stubs, ending, fairness switch / chain / mark,
height, deco coverage, player timing) are family-reading cases in tests/editing.js; their levels were already fixed,
so a replay needs the pre-fix commit (`git log -- levels/<file>`), as above.

**Next, in the user's order (16, 17, 2, 13):**
1. Run the real tests above; fill "Results" and CLAUDE.md's time-table rows (they point here, no numbers yet).
2. 17: run `markedit.js` on the first real marks in local/marks.jsonl (the mark box works now; lines carry `kind`:
   unfair / awkward / ugly / unclear, which markedit uses to rank families). The cloud has no local/: the marks reach
   it only if the main session copies them into a message or a fixture.
3. 2 with 4: `review.js` then `fix.js` on GDLM 61 (dry: 8 safe fixes -- 7 jump marks too close to spikes, 1 orb off
   centre), then on 44/45/47 and an official level; check every kept fix in the picture.
4. 13: `retarget.js levels/gdlm_61_lantern_towers.gdlvl --to easier` (Normal 0.365 -> Easy); then structure swaps by
   the library's difficulty tags (knowledge/structures.json has tier, difficulty, minWindowMs per structure).

**Coordination:**
- incsolve (gd-incsolve): `incsolve.fromBase(oldLevel, oldEvents, newLevel)`; pass `inc` + `world` to fromRun (done).
- style (compose owner): compose has section variants (`reseed:<si>`, `<level>.variants/s<i>_..._v<n>.gdlvl` + .json
  with points). Told them what edit/review/fix expose; retarget's section edits could be saved in that variants shape.
- visuals: mark lines `{id, level, file, session, version, t, x, y, note, kind?, view, zoom, made}`; close with
  `node tools/marks.js done <id> "reply"` (markedit `--done` writes the same line); test marks go to marks.test.jsonl.
- Every child process needs `windowsHide: true` (tests/no_console_windows.js); no alert/confirm/prompt page-side.

## Times (this PC, 16 GB; plus the wait for the heavy slot)

See CLAUDE.md's table. Measured 2026-11-23: see "Results" below.

## Results and replays of today's marks

(filled in as the tools are run on the real cases; see the end of this file)

## Open

- The words: one change per clause, no "it" across clauses, no "between the orbs". A session covers the rest with
  ops; add the common ones to the vocabulary when they come up twice.
- Auto fixes for reactive's "spike then a step", ragged clusters, deco coverage (a look pass on a stretch), player
  timing (polish.js's fair pass on one input) -- today they are listed for a session.
- Jump marks are placed from the route at build time: a gameplay edit can leave a mark where no jump is now needed.
  The checks after the edit show it (fairness mark / jump marks); re-placing them is not automatic yet.
- A reviewed official level: the official route is the solver's (`limit` kind on some), so route-based issues there
  are less sure than on ours.

## Fixes through the level's model (2026-11-24)

Every edit is sized and checked against the level's model (tools/model.js; BUILDING.md 1 "Fixes through the model"):
edit.js (and so fix.js, markedit.js, retarget.js, review.js) prints "model: a <small|medium|large> fix -- keeps the
level's model" or what it breaks (a calm part made much denser, a drop thinned, a section's look or vehicle changed). A
small fix that leaves the model is reworked or treated as medium; medium goes to the coordinator's review; large means
re-planning the model first. polish.js prints the same for its output.
