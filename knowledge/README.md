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
| `players_say.md` | what players praise and complain about in level comments (paraphrased, counted) |
| `glossary.md` | GD terms as the user uses them |
| `demonlist.md` | Demon List facts (pointercrate etc.), dated and sourced |
| `eras.md` | eras and trends of GD level design |

Levels index (add a line per level file):

| level | ID | known for | file |
|---|---|---|---|
| Official 1-8 | 1-8 | the Easy -> Harder ramp, measured + wiki | `levels/official_01-08.md` |
| ~35 community levels, Easy -> Harder | various | Map Packs, Featured/Epic/Legendary/Mythic | `levels/good_low_tier.md` |
| 91 rated levels, Easy -> Harder | various | per-tier/era/speed/mode numbers + 5 broken down | `levels/low_tier_stats.md` |
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

- Everything downloaded stays in `local/community/` (git-ignored, shared between worktrees). Other
  people's levels and comments are never committed: only numbers and paraphrases go into `knowledge/`.
- Each step is light (minutes), but `measure` runs one node process per level. Run it as the one
  heavy job, not next to a solver.
- Limits: static layout only (2.2 levels move their gameplay with triggers); hazard and orb
  classes come from `lib/objects.js`; the most-liked sample favours old, famous levels.
- Open: sync of these levels (only 4 of 87 songs are on this PC); why each level is good (top
  comments rarely say); 2.2 levels need trigger-aware measuring.
