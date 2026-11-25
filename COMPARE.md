# Level compare: two levels side by side

`node tools/compare.js <A> <B> [more ...] [--html out.html] [--json out.json] [--thumbs] [--no-taste]` (the user,
2026-11-25: "Level compare"). Every axis we measure, for each level, with the one ahead marked where more or less is
better; a table in the terminal and one page (`viewer/compare.html` filled in; default `local/compare/<a>_vs_<b>.html`).
`--thumbs` puts each level's picture on the page (THUMBS.md; made first where missing).

Levels: a .gdlvl, a GDLM name from the viewer's list ("GDLM 70", "candy"), or `official:N` (on the PC: needs
`local/official_NN.json` and, for difficulty, `local/difficulty/scored_NN.json`). Section-by-section comparison against
real levels of the same type is another tool: `tools/compare_sections.js` (TASTE_DATA.md).

## The rows and where they come from

| row | source | ahead |
|---|---|---|
| length, objects, presses, presses / s, modes in order, mode switches | the saved route replayed (`viewer/levels.js` or `tools/solutions.js`; no solve) | more mode switches |
| difficulty (log10 expected attempts, label, attempts), v2, timing / lapse / after-portal parts | `lib/difficulty.js` through `tools/balance.js` (DIFFICULTY.md "Balance") | none: harder is not better |
| tightest window (ms, where), windows under 60 ms | the same per-press windows | none |
| lone hard spikes | `balance.js` spikes(): a press far tighter than the ones around it (felt unfair) | fewer |
| taste 0-100, repetition R and its cost | `tools/taste.js` (TASTE_DATA.md) with the user's repetition rule | higher taste, lower R |
| pieces, distinct, repeat share, family mix by seconds | `tools/lego.js` cut + measure (LEGO.md) | more distinct, fewer repeats |
| built from verified bricks (cover) | `tools/lego_match.js` against `local/lego/pieces.json` -- only where the catalogue was mined (the PC) | more cover |

The page adds: a verdict in sentences (harder, tastier, more varied, lone hard presses), the difficulty curve of each level
over its length (running total, by share of the level), the brick family mix as bars, the most used pieces, the costliest
presses and the taste parts that move each score most.

## Results

| levels | where | time |
|---|---|---|
| GDLM 41 classic vs GDLM 43 climb (17 s and 31 s, cube) | cloud, with --thumbs | ~20 s (tests/compare.js without pictures: 10 s) |
| GDLM 70 candy night vs GDLM 72 FROSTBITE (70 s and 86 s, 5-6 modes) | cloud, with --thumbs | 149 s (43 s + 106 s: the windows of every press) |

GDLM 41 vs 43: 43 is harder (0.37 Normal vs 0.05 Easy: eight windows of 46 ms, two of them lone spikes among ~190 ms
presses) and scores lower on taste (17 vs 39), mostly from repetition (R 0.65 vs 0.38).

GDLM 70 vs 72: 72 is far harder by the current score (2.66 Insane vs 1.23 Hard), but almost all of that is the after-portal
part (2.11): by v2 (after-portal only when forced, flying by room) the two are close (0.63 vs 0.58 Normal). 72 scores higher on
taste (47 vs 21), has more distinct pieces (46% vs 32%) and a third of its seconds flying; 70 is 86% jumping. The verdict now says when v1 and v2 disagree like this.

## Open

- Main levels' bricks come from RobTop's levels: their ids are left out of the page (`id: null`), only their shapes' kind.
- No sync row yet (`tools/sync.js`, `tools/tempo.js`): presses on the beat would be the next axis.
- The viewer has no "compare" button yet: the page is made by the CLI. A viewer action that runs it on the level open
  and one picked from the list is the next step.
- Test: `node tests/compare.js`.
