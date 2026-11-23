# knowledge/ -- Geometry Dash knowledge base

Read this before making or judging a level. **Always read `design.md` and `critiques.md`.**
General GD knowledge, not one person's taste: levels Claude makes should be good by GD's
standards, not tuned to whoever is playtesting.

Input comes in any order (levels, critiques, terms, Demon List talk, screenshots). What the user
says is recorded verbatim in `inbox/`, then organised. Web facts carry a source link and a date.

| file | what |
|---|---|
| `inbox/YYYY-MM-DD.md` | raw dumps, verbatim, in the order they came. Nothing is ever deleted here. |
| `design.md` | what makes a level good or unfair, in general (with where each point comes from) |
| `critiques.md` | critiques of GDLM levels (ours) and what changed because of them -- **style/difficulty sessions must read** |
| `levels/<name>.md` | one level: facts (ID, creator, difficulty, source) / reception / what to learn |
| `creators/<name>.md` | creators the user mentions |
| `rating.md` | how levels get rated (Rated -> Mythic): RobTop's own tips, wiki facts, our numbers per tier |
| `players_say.md` | what players praise and complain about in level comments (paraphrased, counted) |
| `glossary.md` | GD terms as the user uses them |
| `demonlist.md` | Demon List facts (pointercrate etc.), dated and sourced |
| `eras.md` | eras and trends of GD level design |

Levels index (add a line per level file):

| level | ID | known for | file |
|---|---|---|---|
| Official 1-8 | 1-8 | the Easy -> Harder ramp, measured + wiki | `levels/official_01-08.md` |
| Official 9-22 | 9-22 | Harder -> Demon: new mechanics per level, shorter sections | `levels/official_09-22.md` |
| ~35 community levels, Easy -> Harder | various | Map Packs, Featured/Epic/Legendary/Mythic | `levels/good_low_tier.md` |
| 91 rated levels, Easy -> Harder | various | per-tier/era/speed/mode numbers + 5 broken down | `levels/low_tier_stats.md` |
| Built on blocks; new things every 2 s | - | structure, obstacle shapes, introduction order | `levels/obstacles.md` |
| Not bland | - | GDLM 41-45 vs rated Easy/Normal: kinds of thing, portals, repeats | `levels/variety.md` |
| Easy section per mode | - | lead-in, density, gaps, openings per mode | `levels/modes_low_tier.md` |
| Pattern Seeker | ? | memory, invisible, repeating, synced | `levels/pattern_seeker.md` |

Never commit level data or songs -- notes, opinions and facts about levels only.

## Hand-off: how the community-level numbers are made (keeper: the knowledge session)

    node tools/community.js list        # most-liked Featured/Epic/Legendary per tier -> local/community/list.json
    node tools/community.js fetch       # download them (tools/fetch_level.js, from GD's server)
    node tools/community.js measure     # per-tier / era / rating medians  -> levels/low_tier_stats.md
    node tools/community.js sections    # by speed and by mode              -> levels/low_tier_stats.md
    node tools/community.js modes       # easy-section anatomy per mode     -> levels/modes_low_tier.md
    node tools/community.js comments    # top 60 comments per level
    node tools/community.js themes      # theme counts                      -> players_say.md
    node tools/community.js ref         # per band and mode deciles         -> levels/tier_ref.json (read by tiercheck)

- Everything downloaded stays in `local/community/` (git-ignored, shared between worktrees). Other
  people's levels and comments are never committed: only numbers and paraphrases go into `knowledge/`.
- Each step is light (minutes), but `measure` runs one node process per level. Run it as the one
  heavy job, not next to a solver.
- Limits: static layout only (2.2 levels move their gameplay with triggers); hazard and orb
  classes come from `lib/objects.js`; the most-liked sample favours old, famous levels.
- Open: sync of these levels (only 4 of 87 songs are on this PC); why each level is good (top
  comments rarely say); 2.2 levels need trigger-aware measuring.

## Checking a GDLM level against the data: `tools/tiercheck.js`

    node tools/tiercheck.js levels/<name>.gdlvl --tier Easy     # per section: Easy+Normal-like or Hard+Harder-like, and why
    node tools/tiercheck.js official 6 --brief                  # one line: H-like share, sparse share, layout tier guess
    node tools/tiercheck.js community --brief                   # every rated 2.0-2.1 level at its own tier (in-sample check)

- It compares each section (long ones cut into ~40-block windows) with `levels/tier_ref.json`. That
  file holds the deciles of lead-in, hazard columns, hazards/10, cube gaps/runs and flying openings
  per mode, for Easy+Normal and Hard+Harder community sections. It also prints the difficulty
  session's whole-level layout guess (`lib/difficulty.js`).
- How well it works (2026-11-23):
  - Median H-like share: Easy 27%, Normal 26%, Hard 78%, Harder 65%.
  - At a 50% cut it gets the band right for 81% of the 63 levels. That is in-sample, since the
    reference is built from the same levels.
  - Spearman 0.46 with the tier, against 0.72 for the layout model, which is fitted on the same
    levels.
  - Official 1-8 give 18, 15, 28, 27, 41, 69, 58, 61%.
  - So use it to find *where* a level is off, not as a classifier. It is layout only: timing is
    DIFFICULTY.md, fairness `tools/sightread.js`.
- First finding: GDLM 41-45 read 0% H-like, with hazards in only 12-23% of their columns. Rated
  Easy/Normal levels sit around 46-49% (DIFFICULTY.md layout table). GDLM levels are emptier than
  rated Easy levels, which may be part of "bland" (GDLM 44).

## Variety (is there enough different stuff?): `tools/variety.js`

    node tools/variety.js levels/<name>.gdlvl     # one level: kinds of thing, portals, modes, speeds, repeats, quiet, presses/s
    node tools/variety.js gdlm official 1          # every GDLM level, an official one
    node tools/variety.js community                # medians per tier and era -> local/community/variety.json

Write-up and targets: `levels/variety.md`. Findings (2026-11-23):
- GDLM levels are not short of obstacles, but of variety.
- They use 1-6 kinds of thing against 15-17 in rated Easy/Normal levels.
- They have no speed changes and few portals, and in GDLM 42, 43 and 45 most chunks are repeats.

## Structure, obstacle shapes, introductions: `tools/obstacles.js`

    node tools/obstacles.js structure --gdlm --official   # per mode: block columns, hazards off the ground, hazards by a block
    node tools/obstacles.js catalogue --gdlm             # chunk sizes per mode + example pictures, one per level
    node tools/obstacles.js intro --gdlm --official      # when each kind first appears, new kinds per minute

Write-up: `levels/obstacles.md`. Findings (2026-11-23):
- Rated and official cube parts have a block in ~47% of their columns. GDLM has 13%, and 92% of
  its spikes sit on bare ground.
- Rated Easy/Normal levels bring in a new kind of thing every ~2 s. Official levels do it every
  ~4.6 s, GDLM every ~8 s.
