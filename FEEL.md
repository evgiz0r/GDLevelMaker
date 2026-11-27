# FEEL: speed, density and beat per section

Evgeni, 2026-11-27: "lets add to the orchestration of the level ability to decide on speed/feels of the level. if there
is a drop, it might be a bit faster for example, or more beatful. not to have fully symmetrical visuals/gameplay. the song
might have breaks or big speedups, which will play according gameplay (but not too far from the desired difficulty)".

So every level built from a song gets a **feel step** between the section plan and the gameplay. It is a general
pipeline rule, not one level's tweak (BUILDING.md section 0; knowledge/checklist.md "Feel per section").

```
song -> tools/sections.js (cuts, types) -> tools/songplan.js (mode per section) -> tools/feel.js (speed, density, beat,
shape, look per section, inside a difficulty budget) -> tools/planbuild.js (bricks, corridors, portals) -> make.js
```

## What the feel decides, per section

| field | what | from |
|---|---|---|
| `speed` | the speed portal: one step up for a heavy drop, a big jump in heaviness, or where the song's own speed plan (tools/impacts.js `speedPlan`) speeds up; one step down for one long calm break a level; at most ~35% of the level off its base speed going faster | song heaviness, impacts.js |
| `density`, `cps` | clicks a second against the tier's (Easy 1.6 ... Insane 2.3): break 0.82, groove 0.97, entry 1.0, build 1.06, drop 1.18, nudged by heaviness | GDLM 44 v12's vibes Evgeni okayed |
| `hitWeight`, `onHitTarget` | how hard the presses chase the song's hits: drop 1.6 ("more beatful"), build 1.25, break 0.6 (free) | his note |
| `shape` | the inside of the section: drop `front` (the punch first), build `rise`, break `dip`, others flat unless the one before was | the mains: sections are rarely flat |
| `look` | `intense` / `normal` / `calm` -> a theme kit variant by its energy, rotated so two sections with one feel do not share a look; intense sections become pulse zones | "not fully symmetrical visuals" |
| `windowMin` | the tier's tightest window (Easy 100 ms, Normal 90, Hard 70, Harder 55): the feel never tightens it | DIFFICULTY.md ladder |
| `cost` | density x the speed's cost; held in **0.75-1.2** of the level's target | the difficulty budget |

Not symmetrical: two sections in a row with the same speed and a density within 10% are pushed apart (the mains: a
median 21% step between neighbours, only 25% within 10%), the way the song says (a denser type goes up, a calmer one
down); when the budget blocks that way, only the shape changes. A drop never turns calmer to be different, a break never
denser.

Only where there is gameplay at that speed: our verified bricks are mostly 1x (2026-11-27: cube 66 at 1x / 11 at 2x;
ball 4, ufo 3, robot 3, spider 2 at 1x and none at 2x), so a ball / ufo / robot / spider section stays at the base speed;
ship / wave / swing are fly-path corridors at any speed (a denser flight gets shorter legs between its knots).

## Commands

- `node tools/feel.js <song> [--tier Normal] [--speed 1x] [--to s]` -- the table: per section its type, mode, speed, cps,
  hit weight, shape, look, cost and why.
- `node tools/feel.js <song> --to 75 --plan briefs/NN_x.plan.json --name "GDLM NN x" --out specs/NN_x.json --theme sunny`
  -- a whole tools/planbuild.js plan (with the outro; hits from the committed song notes when local/hits has none).
- `node tools/planbuild.js briefs/NN_x.plan.json` reads `section.feel`: bricks' floor of presses = 75% of the cps target,
  `hitWeight` into brickpick, the shape as two halves (rise 0.8 / 1.2, front 1.2 / 0.85, dip 1 / 0.8), fly-path legs.
- `node tools/feelstudy.js [--rows] [--write]` -- the mains measured (-> knowledge/feel_ref.json).
- Test: `node tests/feel.js`.
- Other builders: call `require("./feel.js").feel(sections, {song, tier, speed})` and read `s.feel`; brickpick's `pick` /
  `pickSection` take `hitWeight`; `pickSection` takes `targetCps` (= feel.cps).

## What the main levels do (tools/feelstudy.js, 21 mains, 180 song sections, 2026-11-27)

Each number is relative to the level's own mean, so tiers pool:

| section type | n | clicks/s (p25 / median / p75) | faster than the level | slower | on-beat share vs level |
|---|---|---|---|---|---|
| drop | 19 | 0.94 / 1.04 / 1.16 | 11% | 11% | -0.02 |
| build | 15 | 0.84 / 1.02 / 1.12 | 7% | 13% | +0.05 |
| entry | 97 | 0.88 / 1.00 / 1.11 | 12% | 2% | 0 |
| groove | 15 | 0.76 / 0.87 / 1.00 | 0% | 7% | -0.08 |
| break | 34 | 0.85 / 1.00 / 1.10 | 0% | 15% | +0.02 |

- **Speed follows the music** where a main uses speed changes at all: heaviness vs speed r = 0.50 in the six mains with
  speed portals through the level (Electrodynamix, Hexagon Force, ToE 2, Geometrical Dominator, Deadlocked, Fingerdash);
  0.26 over all. The heaviest quarter of sections is faster in 11%, the calmest slower in 13%.
- **Density barely follows the section type** in RobTop's levels (heaviness vs clicks r = 0.16), but **neighbours always
  differ**: a median 21% step in clicks a second. RobTop's levels are not flat, they just do not tie density to the music.
- **On the beat does not rise in drops** in the mains (r = 0.05): the mains sync loosely (SYNC.md). "More beatful drops" is
  Evgeni's taste on top of RobTop's habit, so it is a soft rule here, not a measured one.
- sections.js types most main sections "entry" (97 of 180): its typing is coarse; a better typer would sharpen this.

## Results

GDLM 76 golden feel (Golden Haze 557117, 75 s, Normal; briefs/76_golden_feel.plan.json): see "GDLM 76" below once scored.

## Open

- The speed cost (2x 1.12, 3x 1.24 against 1x) is a guess: calibrate it with tools/balance.js's per-press costs on the
  mains' fast stretches.
- Density needs bricks: ball / ufo / robot / spider have 2-4 verified pieces at 1x, so their sections fall short of the
  cps target; the "Generate our own structures" work (BRICKGEN.md, sectiongen.js) is where that gets fixed. Section types
  (tools/sectiongen.js) could take `feel.cps` / `feel.speed` as their target.
- hellgate_build.js has its own `VIBE` table (break 1.7 ... drop 2.6): it could read feel.js instead.
- The upside-down cube (`cube-ud`) is planned by songplan but planbuild builds it upright.
- A check in score.js / judge.js: the realized clicks a second and on-hit share per section against the feel's targets.
