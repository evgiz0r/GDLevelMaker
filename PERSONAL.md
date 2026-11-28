# For Evgeni vs for everyone: a proposal (not done yet)

Status: proposal, 2026-11-28. Nothing has moved; it waits on Evgeni's OK.

## The problem

The tools are general, but some of the numbers they use were fitted to one player and one taste. A person who clones
the repo gets Evgeni's judge, difficulty and taste without knowing it, and has no way to put in their own.

## What is personal today

| what | where | fitted on |
|---|---|---|
| difficulty timing model (SIGMA, LAPSE) | `lib/difficulty.js` constants | his real runs (`tools/difficulty_fit.js`) |
| difficulty v2 weights, his ranking of the mains | `knowledge/balance_mains_v2.json`, `knowledge/difficulty_rank_user.json` | his ranking + stars |
| fairness model | `tools/fairness.js fit` | his labelled deaths |
| judge notes and thresholds | `tools/judge.js`, `tools/report.js`, `knowledge/judge/` | his marks on Hellgate |
| soft rules and taste notes | `knowledge/checklist.md`, `TASTE.md`, `knowledge/critiques.md` | his notes |
| votes and ratings | `knowledge/lego_votes.json`, `design_votes.json`, `design_marks.json`, `gen_ratings.json` | his 👍/👎 and sliders |
| his save, attempts, recordings, marks | `local/` | (already local, already personal) |

General (stays as is): the format, physics and solver, the sim checks, the generators, the taste model learned from
~330 rated community levels (`knowledge/taste_model.json`), the main levels' routes, song analysis.

## Proposal

1. **A profile layer:** `knowledge/profiles/<name>/` holds everything in the table above (fitted numbers, votes,
   ratings, judge marks, his soft-rule list). `knowledge/profiles/default/` is the same set fitted on public data only
   (stars, rated levels, the main levels), with no one's votes.
2. **One switch:** `GDLM_PROFILE=evgeni` (or `local/profile.json`); the default on a fresh clone is `default`. Tools read
   these files through one helper (`tools/profile.js`, like `gdpaths.js` for GD's folders), never by a fixed path.
3. **Your own profile:** `node tools/profile.js new <name> [--from default|evgeni]` copies one to start from; the fit
   tools (`difficulty_fit`, `fairness fit`, `genrating set`, `lego.js votes`) write into the active profile.
4. **Docs say which is which:** each note in `checklist.md` gets a tag, `[general]` (a game fact, e.g. the wave dies on a
   slope's corner) or `[taste: evgeni]` (a preference, e.g. no ground start), so a cloner knows what to keep.

Cost: moving ~8 files and pointing ~10 tools at the helper; no physics or generator change. A first step that moves
nothing: the tag in step 4 and a `default` copy of the difficulty constants.
