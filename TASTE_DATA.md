# TASTE_DATA -- taste learned from real levels, good and bad

Owner: the taste session (started 2026-11-23). The user: "I want eventually for the system to study
other levels, good or bad, and improve gradually." Until now the only judge of quality was the
user's notes ("my taste so far"). This is the data side: a corpus of real levels with their quality
signals, every level measured, which measures separate well-rated from poorly-rated levels of the same
difficulty, a verdict on each of the user's soft rules, and a taste score every level gets.
TASTE.md (showcase) keeps the taste learned by making levels; this file keeps the taste learned from data.

## How to run it

```
node tools/taste.js corpus     # metadata of ~300 levels from GDBrowser -> local/taste/corpus.json
node tools/taste.js fetch      # download the missing ones (GD's server, one per 2 s) -> local/community/
node tools/taste.js measure    # static measures, one child process per level, cached -> local/taste/feat/
node tools/taste.js learn      # effects, model, rule verdicts -> local/taste/report.md, knowledge/taste_model.json
node tools/taste.js score <level.gdlvl | official:N> [--band EN|2.2]   # one level's taste score and why
node tests/taste.js            # each rule's measure on hand-built levels
```
`measure` and `score` take the heavy-job slot (tools/heavy.js). Level data stays in `local/` (never
committed); `knowledge/taste_model.json` holds only aggregates (band quantiles, weights, verdicts).
score.js reports the taste score as an info gate ("taste", WARN only when a data-supported rule fails).

## The corpus

See "Results" below for the counts. Picks per tier (Easy, Normal, Hard, Harder, Insane; lengths Medium
to XL; no platformers): featured by likes and by downloads, epic, legendary, mythic, star-rated, the
recently rated ("awarded"), and unrated ones: popular by downloads, by likes, and GD's "magic" search
(recent, obscure: the poorly-liked end). Plus the 91 levels of the community study (tools/community.js)
and the 22 official levels as a reference (not in the learning: they have no likes).

Signals per level: rating rank (0 unrated, 1 rated, 2 featured, 3 epic, 4 legendary, 5 mythic), stars,
likes, downloads, likes per download, era (1.x / 2.0-2.1 / 2.2), length.

Caveats, measured: rated-but-not-featured levels are rare (in 2.2 almost every rated level is featured;
deep pages of "most downloaded rated" have 0-2 unfeatured in 10), so "plain" is mostly unrated. Unrated
does not mean bad: many were never sent, or are too long or too hard. Likes per download is a second,
noisy label (old levels gather downloads for years).

## The measures (all static: the objects as placed, no solve)

Bands: tier (EN = Auto/Easy/Normal, HH = Hard/Harder, I = Insane) x era (old = 1.x-2.1, 2.2). Every
comparison is within a band. Levels under 20 s, or built by move triggers (static measures see them as
empty), are dropped from the learning.

- size and pace (tools/style.js): objects per block, deco share, modes, speeds, sections / min, hazards
  per 10 blocks, orbs + pads / min, rests / min, distinct ids, colour channels, triggers / min (all,
  move, colour, alpha)
- craft (tools/craft.js numbers): pieces per 100 blocks, cells per piece, floor hazards, armed undersides,
  dressed tops, attached rods, pillar height deltas, back (floating) deco share, structural deco share
- look: share of deco in front layers, with HSV, on a colour channel; pulses / min; flashes / min (a
  pulse with no fade-in to a bright colour, or a background jump > 0.2 luminance in <= 0.3 s); a contrast
  proxy (hazard colour from the header vs the median background colour; the real one is
  tools/readability.js, ~8 min a level)
- the user's rules: `portalFlat` (share of mode portals with 4 flat hazard-free columns before them, and
  3 after into a ground mode), `orbCentred` / `orbOffset` (orbs over a hazard row within half a block of
  its centre), `spikeStepBad` (floor hazard groups followed by a step 3-6 columns later; `spikeStepNear`:
  1-2 columns), `heightChanges10` / `groundShare` / `heightRange` (a static proxy of tools/flow.js: the
  highest walkable top within reach per column of the jumping modes), `decoCoverage` (30-block screens
  with at least half the level's median deco), `chunkRepeat` (style.js chunks seen before),
  `clusterIssues100` (tools/clusters.js per 100 hazards)

Not yet (need a solve per level, ~2-4 min and ~1 GB each): input windows (lib/windows.js), fairness,
difficulty score, flow on the played route, sync (needs the songs). Plan: solve the Easy/Normal part of
the corpus a few levels a night through the heavy lock, then add those columns.

## Results

(filled by the first full run; numbers from `node tools/taste.js learn`)

## Open

- Route measures (above). Readability by render for a sample of 30 levels to calibrate the proxy.
- 2.2 levels built by move triggers measure as empty: a measure on the moved positions.
- The user's marks and plays as data: each mark is a labelled spot (bad) on our levels; each played
  level a row with the user's verdict. When there are ~30, fit the user's own weights next to the
  community's (the "my taste" model) and report where they differ.
