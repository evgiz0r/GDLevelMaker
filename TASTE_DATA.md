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

## Results (first run, 2026-11-23)

Full tables: `local/taste/report.md` (regenerate with `learn`, 2 s). Numbers below are from it.

**Corpus**: 308 community levels measured (0 failed) + 22 official. 248 used in the learning (60 dropped:
under 20 s, or trigger-built so the static measures see them as empty). By band (tier x era):
EN|1.x 7, EN|2.0 45, EN|2.2 27, HH|1.x 14, HH|2.0 43, HH|2.2 58, I|1.x 8, I|2.0 14, I|2.2 32;
in all 64 unrated, 12 rated only, 102 featured, 70 epic or better.

**What separates featured+ from the rest, within band** (Cliff's delta, 90% bootstrap interval):
effort. Move triggers / min +0.46 (0.33..0.58), triggers / min +0.35, deco share +0.34, colour
channels +0.29, pulses / min +0.27, front-layer deco +0.26, distinct ids +0.26, alpha triggers +0.25,
objects / block +0.22. And **fewer hazards**: hazards per 10 blocks -0.21 (-0.36..-0.05), floor hazards -0.18.

**With effort taken out** (the measure's within-band percentile minus what the level's effort
percentile -- objects/block, triggers/min, distinct ids -- predicts):
- still more move triggers (+0.34) and deco share (+0.23), more front-layer deco (+0.20);
- **fewer hazards per 10 blocks (-0.25, -0.42..-0.11)**, also among the mod-judged levels: epic+ vs
  featured -0.33 (-0.51..-0.19). The clearest gameplay finding: better-rated levels are less spike-dense.
- **fewer sections per minute (-0.28)** and fewer speeds (-0.18): longer sections, fewer mode/speed swaps.
- more repeated chunks (+0.22): good levels reuse their motifs (the whole level, not the user's
  "same 4 moves within 10 s", which needs the route).
- pulses, flashes, alpha and colour triggers: ~0 once effort is out. Rated levels pulse more because
  they have more of everything, not because pulsing is rewarded.

**Likes per download** correlates with nothing measured (|rho| <= 0.12 for every feature): it is a
label of popularity and age, not of what the objects look like. Not used.

**Combined model** (18 features as within-band percentiles, logistic, ridge; 5-fold held-out):
AUC 0.63 featured+ vs rest (per band 0.47-0.75), Spearman 0.46 with the rating rank (unrated ..
mythic). Modest: static measures explain part of what mods reward; mostly effort and spike density.
Officials score 49-83 (the 1.x ones ~66-75, Clubstep / Electrodynamix / Hexagon Force ~50, Dash 83).

### The user's soft rules vs the data

| rule | measure | effort-adjusted | epic+ vs featured | verdict |
|---|---|---|---|---|
| flat ground under mode portals | portalFlat | +0.05 | +0.13 (-0.04..0.31) | unclear (leans yes) |
| orbs centred over their spike row | orbCentred | -0.03 | -0.04 | unclear |
| no step 2-5 blocks after a spike | spikeStepBad | 0.00 | +0.09 | unclear |
| calm: pulses | pulsesPerMin | -0.06 | -0.09 | unclear |
| calm: flashes | flashesPerMin | -0.01 | -0.12 (-0.30..0.01) | unclear (leans yes) |
| hazards stand out (contrast) | contrastProxy | +0.06 | -0.08 | unclear (proxy is weak) |
| no empty deco patches | decoCoverage | +0.01 | -0.14 | unclear |
| clean spike groups | clusterIssues100 | +0.14 (-0.01..0.30) | 0.00 | unclear (leans yes) |
| many small structure pieces | pieces100 | -0.14 | +0.12 | unclear |
| variety: modes | modes | +0.02 | -0.01 | unclear |
| 2.2 budget: objects per block | objPerBlock | +0.22 (raw) | +0.45 (0.26..0.58) | **supported** |
| height changes, not flat | heightChanges10 | -0.10 | -0.26 | against (static proxy) |
| not all on the bare floor | groundShare | -0.12 | -0.25 | against (static proxy) |
| no repeated chunks | chunkRepeat | -0.22 | -0.11 | against (whole-level chunks) |
| deco attached, not floating | backDeco | -0.14 | -0.23 | against |

How to read it:
- "Unclear" is the usual answer, and it does **not** weaken a rule. The user's rules are about single
  spots (one orb, one portal, one step); a level-wide share barely moves with them, and rated levels
  break them as often as unrated ones. They stay soft rules from the user, with their score.js checks.
- **Supported, weight up**: a fuller look (objects per block), and from the free search: **fewer
  hazards per block** and **longer sections**. These two are new rules from data, not from a note.
- **Against, read with care**:
  - floating deco (`backDeco`): featured levels have more deco away from structures, epic+ even more:
    2.2 background art. The "attached deco" target came from RobTop's 1.x levels (CRAFT.md), which are
    right for 1.x; for a 2.2 look, background deco is normal. The user's complaint behind it was flashy
    contrast (hellgate), which this proxy does not see.
  - height (`heightChanges10`, `groundShare`): a static guess of the floor; rated levels show fewer
    changes. Do not act on it: the route measure (tools/flow.js on a solved level) is the real one, and
    the officials there are far above our levels. Open until route measures exist for the corpus.
  - chunk repeats: whole-level motif reuse is normal in good levels; the user's rule is about the same
    moves within 10 s (flow.js `repeat`), a different thing. Both can hold.

### Per band, against craft's targets (Jumper / xStep)

Medians, featured+ / the rest (unrated or rated only), static measures (craft.js numbers):

| band | n | hazards per 100 blocks | floor-hazard columns | back (floating) deco | sections / min |
|---|---|---|---|---|---|
| EN 1.x | 5/2 | 75 / 155 | 0.21 / 0.41 | 0.07 / 0.15 | 7.3 / 21.6 |
| EN 2.0-2.1 | 40/5 | 81 / 235 | 0.16 / 0.39 | 0.30 / 0.08 | 11.0 / 8.6 |
| EN 2.2 | 16/11 | 24 / 84 | 0.00 / 0.04 | 0.52 / 0.37 | 5.1 / 5.2 |
| HH 1.x | 10/4 | 147 / 30 | 0.52 / 0.11 | 0.05 / 0.57 | 3.6 / 13.5 |
| HH 2.0-2.1 | 38/5 | 140 / 128 | 0.25 / 0.14 | 0.18 / 0.10 | 16.6 / 34.1 |
| HH 2.2 | 36/22 | 75 / 75 | 0.00 / 0.08 | 0.32 / 0.27 | 9.6 / 9.5 |
| I 2.2 | 16/16 | 76 / 118 | 0.00 / 0.05 | 0.39 / 0.27 | 12.1 / 18.2 |
| official 1 / 2 / 3 / 7 / 10 | | 69 / 62 / 71 / 121 / 191 | 0.48-0.69 | 0.00-0.01 | 2.0-6.0 |

(Bands with under 5 levels on a side are noise. "Sections" = style.js sections, split at mode and speed portals.)

What this means for craft's targets (CRAFT.md, craft.js TARGETS), to settle with craft and style:
- **Hazards per block depend on tier.** Easy/Normal featured levels sit at 75-81 per 100 blocks
  (1.x and 2.0-2.1), close to Stereo Madness (69) and Polargeist (71), well under Jumper (121) and
  xStep (191), which are the hardest of the 1.x set. Unrated Easy/Normal levels have 2-3x as many
  (155-235): spike spam is the mark of the plain level. Target for EN: ~60-90, not Jumper's 121.
  HH featured: ~140 (1.x / 2.0), where Jumper and xStep fit. craft's floor `hazards100 >= 45` is fine.
- **Floor-hazard share**: featured EN levels 16-21%, the officials 48-69%. craft's `floorHaz >= 0.35`
  is an official-1.x target, above what featured community levels of the same tier do; 2.2 levels put
  almost nothing on the floor (median 0). Keep it for a "RobTop 1.x" look only.
- **Floating deco**: 1.x featured levels 5-7% (craft's <= 20% fits); 2.0-2.1 EN 30%, 2.2 32-52%, and
  epic+ more than featured. The <= 20% limit is right for a 1.x look and wrong for a 2.2 look. What the
  user objected to (hellgate) was deco competing with hazards: measure that (tools/readability.js
  contrast and clutter), not where the deco sits.

### The taste score

`knowledge/taste_model.json` (aggregates only) -> `taste(F, band)` in tools/taste.js -> score.js gate
"taste" (info; WARN only when a *supported* rule is under the featured levels' quartile). The score is
the model's probability that a level of this band is featured+, 0-100. compose and make can aim at
the band's featured medians in `targets` (p25 / median / p75 per measure). The model is retrained with
`learn` whenever the corpus grows; each user play (`taste.js user`) and later each mark becomes data.

### Per-screen deco measures from the art session (2026-11-24)

The deco study (`tools/decostudy.js`, ART.md "Deco study") measures each 20-block screen; taste.js reads its
medians as `ds*` features (from `local/decostudy/<id>.json` for the corpus, computed on the spot for a scored level).
Within-band delta, featured+ vs the rest; then with effort taken out; then epic+ vs featured:

| feature | raw | effort-adjusted (90%) | epic+ vs featured (90%) | reading |
|---|---|---|---|---|
| dsMotion (motion triggers per screen) | 0.43 | **0.32** (0.15..0.46) | **0.36** (0.22..0.53) | strongest new one: moving deco on every screen, not only the effort it costs |
| dsChannels (colour channels per screen) | 0.35 | 0.18 (0.03..0.34) | 0.16 (-0.01..0.30) | mild yes |
| dsDress (deco near play objects, per play object) | 0.24 | 0.12 (-0.06..0.25) | 0.09 | mostly effort |
| dsGlow (glow / blending share) | 0.17 | 0.14 (-0.01..0.29) | **-0.26** (-0.39..-0.10) | epic levels use LESS glow than featured ones: glow is a featured-level habit, not the top |
| dsLayers (z-layers with >= 5%) | 0.14 | -0.01 | 0.03 | nothing |
| dsPerScreen (objects per screen) | 0.22 | (an effort measure) | 0.41 | effort |

Its contrast score runs the other way (featured 45 vs other 63), so it is not a feature. The model barely moves
(held-out AUC 0.633 -> 0.639): what these see, the effort measures already saw. For a level: **put motion on every
screen** (move / rotate / pulse triggers on deco) before adding glow.

## Our GDLM levels through the taste score (2026-11-24, band EN|2.2)

`node tools/taste.js score levels/gdlm_4*.gdlvl levels/gdlm_5*.gdlvl levels/gdlm_60*.gdlvl` (full output in
local/taste/gdlm_scores.txt). The officials score 49-83; two community levels the user played are given for scale.

| level | taste | what pulls it down most |
|---|---|---|
| GDLM 41 classic | 47 | no move triggers, 14 distinct ids, deco 31 %, 0.6 objects per block |
| GDLM 42 seen then gone | 47 | the same, and 87 % repeated chunks |
| GDLM 43 climb | 47 | the same, and 71 % repeated chunks |
| GDLM 46 sketch | 44 | plain blocks, no deco |
| GDLM 60 physics lab | 53 | a test level, no look |
| GDLM 46 arrow catalogue | 57 | no triggers (all deco, no hazards) |
| GDLM 47 sunny side | 57 | 56 distinct ids, deco 52 % |
| GDLM 45 first flight | 62 | deco 49 %, little front deco, 7.6 objects per block |
| GDLM 44 hellgate | 65 | 40 distinct ids (band median far higher), 7.9 objects per block |
| GDLM 51 adrift | 67 | 33 distinct ids, height range 7 (top of the band) |
| GDLM 50 eclipse | 69 | 33 distinct ids, deco 76 % |
| Spooky Dash (community, the user stayed) | 73 | |
| NOT A MONOCHROME (community, the user left at 25 %) | 69 | |

Reading: the score tracks effort and the 2.2 look. The early cube levels (41-43) sit at the bottom, and the
decorated scene levels (50, 51) near the officials' middle. Every GDLM level is still far under featured 2.2
levels on objects per block (0.2-8 against >= 17), the one rule the data supports. The level the user left
scores almost as high as the one they stayed on: the static score does not see what made them leave (gameplay,
not look), so it is a hint, not a verdict (held-out AUC 0.63).

## The user's own plays (the "my taste" data)

`node tools/taste.js user <id> --note "..." [--finished] [--attempts N] [--liked|--disliked]` adds a level
the user played to the corpus with their verdict (field `user.plays`), fetching it if needed. Real-game
attempt rows stay in local/real_stats.jsonl (physics owns them); this is the per-level verdict.
- 2026-11-23 Spooky Dash (ID 150941693, Hard 5*, featured, 2.2): the user chose it and beat it on
  attempt 9 (1:19, 64 jumps; deaths at 18.8-47.1%, one practice run). A positive "chose and finished" row.
- 2026-11-23, seven more the user chose (all featured/epic 2.2, Hard 5 - Harder 7). Verdict "stayed" (kept
  playing to practice complete or a clear): Locked 149415501, ClockWood 150286303 (beaten), Gang Vibes
  147433579 (beaten), A level 148448631, Eden and Ash 146165333, Accelerate 140155559 (beaten).
  Verdict "left": NOT A MONOCHROME LVL 149575037 (one try, 25%). So far 7 stayed vs 1 left: too few to fit;
  each new play adds a row. Compare "left" levels with "stayed" ones on the taste measures once there are ~5.

## Open

- Route measures (above). Readability by render for a sample of 30 levels to calibrate the proxy.

- 2.2 levels built by move triggers measure as empty: a measure on the moved positions.
- The user's marks and plays as data: each mark is a labelled spot (bad) on our levels; each played
  level a row with the user's verdict. When there are ~30, fit the user's own weights next to the
  community's (the "my taste" model) and report where they differ.
