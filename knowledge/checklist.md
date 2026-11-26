# Checklist: before a GDLM level goes to the user

One page for the style, polish and difficulty sessions. Every item is a target with its number, the
tool that checks it, and where it comes from. Targets are for an **Easy/Normal** level (the tiers
the user can playtest now) unless a line says otherwise. Each line points to its source: change a
number there, then here. Last updated 2026-11-23.

**Use what others learned** (the user, 2026-11-23: "if we gain knowledge on the fly, I do want sessions
to use it"). Before each new level or round: `git pull`, then re-read this page, TASTE.md,
STRUCTURES.md and your own area's doc (`git log` since your last round shows what changed). A new
lesson goes in here as one line **in the same commit as the fix**, and where it can, it also becomes a
check in make.js / score.js, so a level cannot miss it even when nobody reads this page: code beats
docs. `tools/wip.js put` adds `[checklist <commit>]` to every wip note, so each version says which
checklist it was built against.

**Run the loop with one command:** `node tools/loop.js <spec | brief | level> [--look] [--render]
[--session <name> --note "..."]` (make -> every score.js gate -> pictures -> wip, stops at the first
failure, prints an ETA first and waits while the PC is busy). A level is ready for the user when it says
READY and the items below that no gate checks are gone through by eye.
**The heavy-job lock is enforced** (tools/heavy.js: two slots while the game is closed and ~3 GB are free, one while it
runs; a fast lane for jobs measured under 2 min): every solve / score / render tool waits for a
shared slot by itself and prints whom it waits for. Don't get around it with `node -e` solves or scratch
scripts, and build timing or test runs from copies in `local/tmp/`, never another session's level.

## Fair (the user's playtests: a death must be the player's fault)

- [ ] **No lone hard press among easy ones** (the user, 2026-11-25: "like jogging for 2 miles, and then having to jump
  2 meters. yes its hard ... but it feels unfair"): no jumping press under 60 ms whose neighbours within 5 s have a
  median window of 150 ms or more. FROSTBITE's triple spike at 8.2 s (46 ms among ~296 ms) is one. Check:
  `node tools/balance.js <level>` prints `SPIKE` (DIFFICULTY.md "Balance"). A hard part is a stretch, not one press.
- [ ] **Fly corridors are smooth: no one-block stair steps in a ship or wave wall** (2026-11-25: GDLM 44's ship died in the real
  game at a stepped roof's corner where our sim passed, PHYSICS.md "probe mod"). Build them with `fly-path` (45-degree slopes
  on both walls), not `ship-tunnel`; the margin our sim gives at a block corner is not to be trusted.
- [ ] **Brick joins get 3+ flat blocks, and a brick whose own check found a prejump is not used** (2026-11-25, GDLM 44 v3: 1-2 block joins made 5 prejumps and a tap 183 ms after a gravity portal). `tools/brickpick.js` enforces it; score.js "prejumps" / "fairness" check it.
- [ ] **Height carries over between sections, never resets** (Evgeni 2026-11-26: "its not that each section just 5, its
  that between sections we always reset"; "we could make a level that just goes up in y by the sections"). Each section
  starts at the height the last one ended on; fly sections exit higher (or lower) than they came in; a level may climb far
  above the floor (the game, the sim and the camera handle it; the level map shows up to 150 blocks). Hellgate v4 set each
  section's floor on its own, so every portal dropped it back down. `tools/judge.js` "flat level" (to come).
- [ ] **No unseen roof** (Evgeni 2026-11-26 on Hellgate v4's ship entry: "we fall from the top, but there is no indication of
  top. some secret ways can be like that"): when the player comes into a corridor from above, or a stretch's ceiling is off
  screen, its roof must show (a visible top edge or deco line); an open sky above a corridor reads as a way over it. Checked: `tools/judge.js` "unseen roof" (the route at its band's roof or a raised band floor with no solid there).
- [ ] **The ending is designed, not a flat walk to the signature** (same review: "design the last sign/gameplay a bit more.
  maybe some auto gameplay which is not just on the ground"): the last seconds get a set piece -- e.g. an auto (no-click)
  ride on pads / portals that climbs or flies -- leading into the signature. Checked: `tools/judge.js` "flat ending"; make.js `"outro": <seed>` builds one (AUTO.md).
- [ ] **Raised sections fit the mode's play band** (found building Hellgate v5, 2026-11-26): ship, ufo, wave, swing (10 blocks),
  ball (8) and spider (9) play in a band centred on their portal (lib/physics.js portal(); floor = portal y - band/2, snapped,
  never under 0). At ground level the band starts at 0, so pieces fit; up high a portal at floor+1 puts the band's roof only
  ~5 blocks over the floor -- a piece taller than that dies on an unseen ceiling. Put the section's floor (or a corridor's
  base) on the band's floor; the climbing comes from ground sections (a cube steps up any height).
- [ ] **Pieces don't repeat back to back**: under 44% of the route's lego pieces share a signature with one of the 4
  before (official levels median 17%, p90 44%; our older levels 53%). `node tools/lego.js variety <level>`, score.js
  "brick variety".
- [ ] **Pieces of one section are close in clicks per second** (Evgeni 2026-11-26: "pick somewhat same balance, and probably
  close cps"): a picker scores a section's pieces against the section's CPS target, not each piece alone. `tools/pieces.js`
  shows every piece's span on the level map (`levelmap.js --pieces`).
- [ ] **Room at every portal, counted at 1x and stretched with the speed** (GDLM 73, 2026-11-26, nine rounds): the first
  input 7 blocks after a ground portal (13 after a flight's exit), the last 1.5 beats before the next portal (3 for ball /
  spider), no floor step right behind a portal (a forced jump on arrival), a flight's gate open 4 rows (a wave arriving held
  rose into a 3-row gate's top), no 1x -> 3x jump in one portal. `tools/planbuild.js` does all of it; score.js "fairness".
- [ ] **Single spikes at speed need air between them** (GDLM 73): at 2x+ at least 0.65 s from one jump to the next (0.5-0.62 s
  apart made the route take off 2-3 blocks early: prejumps), a double only with 0.6 s free on both sides (else a 25 ms tap).
  planbuild / brickpick `fillGap`; score.js "prejumps", "timing".
- [ ] **Balanced sections** (Evgeni 2026-11-25 on Hellgate v4: "this whole section has 2 clicks? we need balanced sections.
  with somewhat similar cps"): every section's clicks per second near the level's own (none under about half of it,
  breathers named as breathers). A 3 s ball part with 2 clicks next to 2-click-a-second cube parts reads as a hole.
- [ ] **No big gaps between pieces** (same review, 4 marks "too big gap"): inside a section the next thing to press comes
  within about a second; a long flat run-up or an empty landing between two pieces is a gap, not a breather.
- [ ] **No corridor twice, none too long** (same review: "way too long corridor", "again same corridor", "same corridor
  x3"): a fly part is a few short ideas (gates, open stretch, a narrowing, a wall to follow), each 2-4 s; never the same
  corridor recipe twice in a level, even in another mode.
- [ ] **A long stretch gets a new idea halfway** ("bit too long without variety"): nothing runs over ~4 s with one kind
  of obstacle; the official levels add a twist (a new hazard, a height change, an orb) every few seconds.
- [ ] **Every orb has an obvious reason** ("i dont get this orb"): an orb is there to clear something you can see
  from it; an orb on a ledge with nothing to clear is noise.
- [ ] **`node tools/fairness.js <level>` passes** (also `tools/score.js` gate "fairness"). It
  flags (FAIL): an input forced right after a portal (into a jumping mode: the first input's window
  closes < 250 ms after it; into the wave: the button must change within 300 ms); a jump mark where
  jumping kills and no jump is needed; a sawtooth floor at a portal into a ground mode; 3+ orb taps
  under 500 ms apart; a wave input with a window under 150 ms. WARN: a blind two-step opener, a stray
  mark. Fitted on the user's labelled deaths: 12/12 unfair caught, the fair one left alone.
  (DIFFICULTY.md "Fairness")
- [ ] **No prejumps.** Every jump is cued by what is in front. `node tools/sightread.js <level>`.
  (design.md "Fairness", GDLM 41)
- [ ] **No forced input right after a mode or speed portal.** Give an empty lead-in: cube ~6 blocks,
  ship ~8, others 2-3. A flat, readable floor before the portal; never a portal on a block's end or a
  corner. `node tools/tiercheck.js <level> --tier Easy` (lead-in per section). A mode portal reaches the
  walking line (a cube walking there touches it; else it can walk under it and skip the mode) and stands on
  flat ground: `node tools/portalground.js <level>` (GDLM 44 round 3). (levels/modes_low_tier.md;
  GDLM 44 entrance, GDLM 46 wall after the wave)
- [ ] **Recovery**: never land and have to jump again within ~100 ms, unless it is a steady rhythm.
  (design.md, score.js recovery gate; GDLM 42 v3)
- [ ] **Reactive cube parts**: every obstacle cleared by a natural jump on reaction, with a flat
  run-up between groups (4+ columns at Easy/Normal) and landing spots wider than 1 block. Never a
  landing on a lone block that forces the next jump within 250 ms, never 3+ hops in a row each forced
  right after landing. `node tools/reactive.js <level>` (score.js gate "reactive": FAIL at Easy/Normal).
  (critiques.md GDLM 45 v6, blocks 50-75: "very specific cube jumps ... instead of being able to react")
- [ ] **No dead air**: no input gap longer than the level's own rhythm (max 2 s, 2.5x its median gap between
  presses) and no empty screen -- no hazard, orb, pad or structure in view for 1+ s (official levels: 1 in ten).
  A calm is short and deliberate, with deco, and accepted in the brief. `tools/deadair.js`, score.js "dead air";
  craftlevel fills a short section with its own chunks. (the user on GDLM 61 v3, 38-46 s: "very big breaks with nothing")
- [ ] **The song offset sits on a beat** when the builder counts beat 1 from the level start: a hair past one makes every `"bN"` a beat late (GDLM 44 v5-v6). make.js prints `!! offset ... past a beat`; SYNC.md "bN".
- [ ] **Presses follow the song's beat**: the human route has about as many inputs per beat as the official levels
  (0.53-0.87 over the level, 0.50+ in its busy phrases; a calm phrase may be sparse). `tools/tempo.js`, score.js "tempo".
  (the user on GDLM 44 hellgate v6: "the cps is very small, compared to beat of the song")
  And at least the median Easy brick's clicks per second (1.82; rated levels' bricks 1.8-2.15 at every tier,
  knowledge/brick_tiers.json from `tools/brickstats.js --write`): score.js "tempo" warns below it. Evgeni 2026-11-26: "i want
  levels not to be so sparse, the beats are decently quick". Sweep: GDLM 70-73 pass (2.0-2.5), most of 41-69 are under.
- [ ] **No near-empty stretch inside the level**: the calmest 10% of 4 s windows keep 0.5+ clicks/s, no 2.5 s+ stretch without a
  press, under 20% of its bricks clickless, its bricks' median clicks/s within 85% of the target tier's. `tools/density.js`,
  score.js "density" (the whole-level number above can pass while one stretch is empty).
- [ ] **Density without timing**: arm the pieces the route never touches -- spike tips under hanging columns
  (3+ rows over the higher pillar beside them) and spike-tipped 1-wide pillars mid-pit, a row under the lower
  landing; never a spike on a top the route lands on. Checked: windows unchanged (CRAFT.md "Density").
- [ ] **Pillar hops are tapped, not held**: at Easy/Normal, pillar tops 3-4 wide; a rise is a plain
  step with no pit (any pit cuts its window with the next face: 208 ms over 1 column), a drop crosses a
  3-column pit, +1 per extra row (2-column ones were walked across); floating steps go down, not up. Jumper's 1-2-wide pillars are a Harder rhythm that only works as a held bounce. Generated
  by tools/structures.js pillarRun; checked by the reactive and hazards-matter gates. (the user on GDLM 61
  v1, blocks 15-60: "these clicks very unnatural ... the timings seem reallllly awkward"; CRAFT.md)
- [ ] **Windows on the player's route, not only the solver's**: every jump of the natural replay (what
  the viewer and the game show) timed on its own up to the next input; none under the tier's floor.
  score.js gate "player timing". (GDLM 47 v2: the timing gate said 113 ms on the solver's route, the
  player's route had a 4 ms jump at block 67: a spike, then a block 3 later, landing between them)
- [ ] **A jump over a spike needs no timing around a block**: no press whose window is cut short
  (< 250 ms) or split by a block, ceiling step or slope rather than by the hazard (a lip right after
  the spike, a step where the jump comes down). No step 2 to ~5 blocks after a spike (at 1x; where
  its jump comes down: GDLM 47 ~29.3 s): the step right after the spike (one jump lands on it) or
  farther. Same check and gate ("reactive"). Patterns: spike-block `at 1, w 3` and block-spike-block
  `w1 2, w2 2` at Easy/Normal. (critiques.md GDLM 45 v6 ~21.5 s)
- [ ] **Cue a jump onto planks over spikes**: a plank row straight over a spike row, reached by a jump
  from flat ground with no cue, killed the user 7 times (GDLM 60). Give it a cue (a mark, a step, a
  visible landing) or room. (PHYSICS.md "GDLM 60 physics lab")
- [ ] **A dash ends in open space**, or where it must end is telegraphed: a solid post right after a dash
  orb's run killed the user 5 times holding the dash into it (GDLM 60). (structures: dash-orb-pit)
- [ ] **Orbs can be buffered**: a press held a little before an orb fires it on first contact; an orb only a
  precise mid-orb click takes is a warning. **No jumps over nothing**: stairs and step-downs are walked off.
  score.js gates "orb buffer" / "pointless jumps" (lib/natural.js; the user via physics, 2026-11-24)
- [ ] **Every hazard matters**: none walked over without a jump (slabs at one height 2 apart over
  spikes are crossed on foot: the spikes are pointless and leave a "do I jump?" doubt). Make it a real
  jump (gap 3+, or rising slabs) or keep the spikes out of the way. score.js gate "hazards matter".
  (critiques.md GDLM 47 ~18.7 s)
- [ ] **Symmetry = good**: an orb sits over the centre of its spike row (within half a block), pairs
  mirror each other. If the timing wants it off-centre, change the structure (the row, the landing),
  not the look. make.js centres orb-pit orbs itself; score.js gate "symmetry". (GDLM 45 v6 ~28.4 s)
- [ ] **A flying mode's exit portal is framed on all sides**: a roof AND a wall up to the band's top,
  so no route flies over it. The skips gate also runs the player's route. (TASTE.md; GDLM 51)
- [ ] **Calm after a flying exit**: ~10 blocks with nothing to jump after the cube lands (compose does it
  since 79635eb). A pattern change that moves the exit later moves the next hazard into a prejump: GDLM 50 v3's
  spike 7 blocks after the wave landing (score.js "prejumps", block 283). (TASTE.md; GDLM 50 v3)
- [ ] **Open with a plain jump**: the first obstacle has no orb or pad in it; the first orb comes after a few plain jumps (official 1-21: first hazard at block 10-21, first orb at block 12-264). GDLM 52 v2, the user's first real play: 4 of 11 attempts died at 1.4 s on its opening pink-orb pit over four spikes. `node tools/softrules.js` "opener" (3 levels: 46, 52, 68); tools/planlevel.js opens orb-free.
- [ ] **Orbs**: mostly single (~3/4). A chain of at most 2-3, ~3 blocks apart, climbing ~1 block in
  all, one orb kind, and a hazard-free surface ~1 block after the last orb. Never a chain where a
  normal click falls to death or that carries the cube toward the screen's edge.
  `node tools/obstacles.js orbchains --file <level>`. (levels/obstacles.md section 5; GDLM 46 v2)
- [ ] **A landing you can stay on**: after an orb, pad or obstacle, the cube lands on one surface across
  every early/late press; never a gap in front of a wall that needs an instant jump (a dead end).
  `node tools/polish.js <level> --dry --passes none` (two 4 ms jumps there). (critiques.md GDLM 44 v12)
- [ ] **Orbs at the natural arc**: the first orb of a chain where a normal take-off jump tops out (at the
  apex or up to 1.5 blocks after), each next orb where the previous orb's arc tops out; the take-off has
  >= 100 ms with the orbs clicked when reached; orbs on the hazard row's halves or thirds.
  `node tools/orbarc.js <level>`. (critiques.md GDLM 44 v12/v13: "unnatural and small")
- [ ] **Clean spike groups**: no overlapping or doubled hazards, no 1-2 column gap inside a group, no
  hazard within 1.5 blocks before a pad. `node tools/clusters.js <level>`. (critiques.md GDLM 44 v13)
- [ ] **Orbs where the arc already goes**, not grazed at the arc's edge. (design.md; GDLM 44 orb ladder)
- [ ] **Jump arrows only on real inputs**, ~1 block above the surface, right at the press (the hazard
  ~0.5 block ahead). Used where a jump can't be read in time (after a drop, after a portal, the first of
  a pattern), consistently, small and softer than the level. `node tools/obstacles.js indicators --file <level>`.
  (levels/obstacles.md section 4, design.md "Telegraph"; GDLM 45 v4, GDLM 46 v2)
- [ ] **The shown route is the human route** (the default; route.kind "human", or "limit" with why): no skips, no unneeded press, taps not holds outside ship/wave (a tap ~60 ms, like a real one; family: "human taps"), orbs buffered, no jumps over nothing, flying the safe line. `node tests/saved_routes.js --all` (PHYSICS.md "How the route is chosen").
- [ ] **No timing harder than the level's tier** (the user, 2026-11-25, on the main levels: "wherever a timing is too hard for the level, its probably not the path"): every press of the shown route has a window of at least the tier floor -- 40 ms Easy..Harder, 30 Insane, 20 Demon; under it, the route is probably not the intended one, so re-search there. `node tools/tight.js [n] --fix` for the main levels (tools/mains.js runs it after each job); DIFFICULTY.md "Too tight for the level".
- [ ] **The shown route clicks where a human would**: early in a wide window (~40% in), never at its
  last safe frame -- the replay, the arrows and the level map all follow it. `node tools/windows.js <level>`
  ("pressed N% in"; lib/natural.js step 4). (the user on GDLM 45's ball: "i would prefer to click way earlier")
- [ ] **No dash-orb skips** (Evgeni 2026-11-25: "holding them can skip a lot of gameplay which is intended"): a dash orb held
  to its longest, or released at any later tick, must not fly over the intended presses that follow; a wall or ceiling ends
  the dash where it is meant to. Checked per join in the lego plan (LEGO.md); not a score.js gate yet.
- [ ] **The human route flies on easy timings, not on fewest presses** (Evgeni 2026-11-25: "its better to get an extra
  click or two than having a terrible timing ... mostly in the flying sections (wave ship ufo swing). we can have a tas doing
  little clicks but human route should avoid bad timings at the cost of an easy timing"; and on a jittery wave brick: "thats
  obviously not the human path"). So: an extra press or two is fine when it widens the windows; a run of tiny taps is not
  (3+ presses under 0.1 s apart in one brick, or close taps where a window is under 60 ms). By that rule 4 of the main levels' 218 flying bricks fail (18 of 60 wave
  bricks have some close taps, Deadlocked 13), from lib/natural.js's corridor steering; the solver thread re-plans them. A brick's
  layout may be reused, its flying taps are re-planned (LEGO.md "The replay"). **Slide where you can** (Evgeni: "many places
  wave avoids ground but probably in many of them we can slide on it avoiding the clicks in the middle"): a wave (or ship)
  riding a flat floor or ceiling instead of zigzagging over it saves presses; leave before the block's end (the wave dies
  sliding off a corner, CLAUDE.md calibration) and never into a rising slope. In the planner (lib/natural.js fly, EASY_MS 100):
  a flying line never wins on fewer presses when its tightest window is under 100 ms and tighter than the old one, and a line
  with up to 2 more presses wins when it widens a window under 100 ms by half. `node tools/flystyle.js <level>`: tightest
  window per stretch (PHYSICS.md "The wave like a person"). The wave slides on flat floors and roofs instead of hovering above
  them with corrections (Evgeni: "we can slide on it avoiding the clicks in the middle"); a slide is not a near-wall tick.
- [ ] **Wave**: zigzag turns wider than ~100 ms apart; no head-on slopes at a portal exit; the exit
  portal over a flat floor, level stretches at the turns (patterns.js wave-zigzag `flat`, `leadGap`).
  (design.md; GDLM 44/46 real-game deaths)
- [ ] **The wave route follows the corridor's pattern**: one input per leg of the corridor (hold up one slope, let go down
  the next), tight lines only where the gap asks for them; no small corrections (re-presses under 150 ms) beyond the
  corridor's turns + 2. score.js route gate WARNs "off the pattern"; `node tools/flystyle.js <level>` per stretch.
  (the user, 2026-11-25: "these corridors should be just few holds and releases"; PHYSICS.md "The wave like a person")
- [ ] **Jump off an edge before its last tick**: a cube / UFO / robot route does not press with its centre already past
  the block's end (reads as sliding off the cliff). lib/natural.js `edgeJumps` moves such presses earlier; `GD.edgePresses`
  lists them. (the user on ToE2 brick 237, 2026-11-25: "some wierd ufo jumps on the clif, he slides?! it shouldnt")
- [ ] **Jump marks clear of hazards**: a mark shows the take-off, its centre >= ~1 block in front of the
  hazard's hitbox, never on or touching one. Placed by decorate.js jumpIndicators (INDICATOR.clear);
  `node tools/indicators.js <level> [--fix]`. (the user, hellgate round 2: "indicator inside spike")
- [ ] **Jump arrows a block in front of the hazard, low, never over it**, and no two under 2 blocks
  apart: `node tools/softrules.js <level>`, score.js gates "arrows" and "jump marks". (GDLM 50 v2: "arrow
  into the spike", "too close to the spike, almost inside it")
- [ ] **Corridor mouths flush**: no notch or hanger where a roof or floor meets a slope or a portal
  (softrules "stubs"; GDLM 50 v2's wave entrance: "this entrance is wrong in its shape").
- [ ] **Jump marks sit low**: about 1 block over the surface (make.js lifts them 30 units), and none
  where no jump is needed (placed from the natural replay's real jumps only). (GDLM 45 v5, the user)
- [ ] **Invisible parts**: ghosted (faint), fully hidden only for a chunk already seen. No fakes at
  Easy/Normal. (design.md, STYLE.md; GDLM 42; official_01-08.md)
- [ ] **Even difficulty**: no late spike. Timing per tier: DIFFICULTY.md "Tier ladder" (Easy: no window
  under ~60 ms, almost none under 100 ms). (players_say.md: a late spike makes a rating feel wrong)

## Not bland (rated Easy/Normal 2.0-2.1 medians)

- [ ] **Hazards follow the path** (Evgeni 2026-11-26 on the auto levels' saws: "random, not following the path"): of the
  level's hazards 8-40% threats (within a block of the route), 25%+ guards (1-3 blocks: the lane's frame, shuts secret
  ways), at most 60% fill; half or more of the jumps over something; 2+ hazards near the path a second (official
  17 / 45 / 38%, 71-83% of jumps). Check: score.js gate "hazards" (`node tools/hazards.js level <lvl>`); place them with
  lib/hazards.js `hazardsAlongPath`. HAZARDS.md.

- [ ] **The background never reads as solid** (the user's Two Moons mark, 2026-11-25: "solid background is confusing"). Back
  shapes must not look like blocks you can land on: no block-like squares with lit rims behind the play, lower value and
  contrast than the path's bodies, softer or no outlines, a different hue or some transparency. `tools/roles.js` (pathDeco).
- [ ] **Play blocks are a material, not a flat fill** (the user, 2026-11-26: "The blocks are still very timid. No effects. No
- [ ] **Block design in layers** (Evgeni, 2026-11-26, with 8 tutorials): outline + inline, a 2-3 colour base with low-opacity texture, details small = high contrast, glow sparingly (top light, bottom dark, black lines in front of glow), 3D lines all one direction and darker. DECOART.md "Block design". Check: `tools/blockart.js` (by eye for now).
- [ ] **Not only flat shapes** (Evgeni, 2026-11-26: "bland compared to real levels"): rated 2.2 levels put ~22% of deco in front (T2+), ~11 big set pieces a screen, gradients / soft glow, particles, fades (alpha ~190/min), camera moves and shaders, and a new scene per section. Check: `node tools/modern_look.js <level>` + `node tools/decocomp.js <level>` vs DECOART.md "Why it still looks bland". Add them with `tools/decofx.js`.
- [ ] **Block dressing follows the real blocks** (Evgeni, 2026-11-26: "not exactly coherent in the corners"): beat-synced blocks sit off the 30 grid, so dressing is drawn from each block's x, y (never `c * 30`); inlines turn at inner corners, outlines meet, inline one z-order under the outline. DECOART.md round 5b; `node tests/decofx.js`.
  good texture. All single filled color"). Lit open tops, darker with depth, a surface texture (facets), a feature with light
  (glowing seams on the beat), an edge and a shadow. `tools/blockart.js` (decoart.js --blocks); DECOART.md "Blocks".
- [ ] **A section's backdrop is one composed picture** (focal light at a third, values light far -> dark near, nothing in
  it reads as gameplay): DECOART.md, `tools/decoart.js`.
- [ ] **The play stays visible: deco never hides the path or a hazard** (the user, 2026-11-25: RobTop's levels are amazing
  for "the visible play"; "if you dont see a spike the timing is obviously harder"). No deco in front of the lane the player
  can be in, none behind a hazard in its value or hue (it must stand out), the richest art at the lane's edges, quiet behind
  the hazards. `node tools/lane.js <level>` (clutter = 0), `tools/roles.js` (pathDeco, hazards), `tools/readability.js --gate`.
- [ ] **Motion and colour on every screen, not only at the start** (Eclipse v2-v4, 2026-11-25): one calm pulse a beat, a drift and a
  spin per section, 10+ colour channels a screen; triggers placed along x, since the measures (decostudy, taste) count by x.
  `node tools/taste.js score <level>` (dsMotion, dsChannels). Warm light behind the path: cool rims (`tools/roles.js`).
- [ ] **Not repetitive** (the user, 2026-11-25: "way too repetitive, in the gameplay and structures"): no mini-structure
  over ~4 times, no zigzag / tunnel of identical legs, corridors change height. `node tools/repeat.js <level> --top 3`
  (R; taste.js "repetition (user rule)").
- [ ] **Orb spacing**: 6+ blocks between two orb structures (gd-polish, hellgate v7: s:red-orb-wall right after
  s:green-orb-flip prejumped; s:orb-ladder-2 there made a 3-orb chain under 500 ms). compose enforces it; the prejumps and
  chains gates catch the rest.
- [ ] **Few triple spikes** (the user, 2026-11-24: "lets do less triple spikes for now"): at most one per ~15 s, never two
  within 4 s; singles, doubles, pits, pillars and orbs carry the jumps. `tools/triples.js` (sweep: `--all`), score.js
  "triples" (WARN); compose turns a second triple in a section, or one within 4 chunks of the last, into a double
  (`"triples": "allow"` in a brief = off). A triple = exactly 3 full spikes in a row (4+ is a pit). Sweep 2026-11-24: 4 of 29 levels over it (GDLM 43: 11 triples in 31 s,
  47: 10, 64 v5 and 69: back to back), 39 triples in all; 6 of 81 library structures hold one (triple-spike, robot-triple,
  spider-zaps, spider-steps, pad-launch, red-orb-wall).
  A 1x triple's window is 45.8 ms in the sim (11 ticks): a brief with triples and minWindowMs 50 fails "timing" on
  every reseed (GDLM 72 round 1: 8 compose rounds, 21 min, all on it). Harder with triples: minWindowMs 45.

- [ ] **Long enough, with long sections**: 60 s or more (official 78-95 s) and at most ~6 mode changes a
  minute (official 1.3-5.2; ours were 7-17: short snippets). score.js gates "length" and "mode changes";
  compose notes it from the brief. (QUALITY.md, TASTE_DATA.md)
- [ ] **Height changes and no repeats** in the jumping modes: 10+ floor changes per 10 s, a 3+ block
  range in every 10 s, no flat 10 s, at most ~45% of standing on the bare floor, at most 5% of 4-move
  patterns repeated within 10 s (official medians: 13.6, 7 blocks, 0, 28%, 0%). `node tools/flow.js
  <level>`; score.js gates "height" / "repetition". (STRUCTURES.md; the user on GDLM 47's upside part)
- [ ] **No structure 3 times, corridors that move** (the user on GDLM 71, 2026-11-25, 12 marks: "x6 of the same mini
  structure", "should be 2 max", "with ball/spider/wave there should be different corridors (where top and bottom not
  same height)"): in every flying corridor the floor and roof change heights apart, obstacles vary, and no stretch
  repeats back to back more than twice. compose.js gives every ship / wave / ufo / ball / swing / spider corridor a
  `vary` seed (tools/patterns.js: segments with their own floor / roof and motif; `"vary": false` in a brief or section =
  the old periodic shapes). Measure: `node tools/repeat.js <level>` (loop, motif, corridor, R). Two flying modes back to
  back switch directly (no cube portal and run between them; `"directSwitch": false` = off), and a cube section whose
  next chunk does not fit ends with a single instead of an empty run.

- [ ] **Built on blocks**: a block, slab or slope in ~45-50% of the cube columns; most spikes on
  ledges, steps, pit edges and under overhangs, not lone on the floor. `node tools/obstacles.js structure --file <level>`.
  (levels/obstacles.md section 1; GDLM 41-45 had 13%)
- [ ] **Readable climbs**: every climb (3+ rising landings) has a press moment the player can find on each step: steady
  spacing between the jumps (within 1.5x), a landing of 0.3 s+ on the ground (4+ blocks at 1x), the next step on screen
  when the press comes (the camera lifts only 0.38 blocks per block above 2), no window under 120 ms. `node tools/climbs.js
  <level> | --all | --library`, score.js "climbs". The stairs pattern now makes 4-wide steps. (The user, 2026-11-24, on
  GDLM 68's ladder: "those cube ladders are way too bad to play. its almost luck based if i can find where to click".
  Flagged then: all 5 climbs of GDLM 68 (3-wide steps; station 1's top two steps off screen), 1-3 in each Golden Hour,
  41, 66.)
  Calibrated on the user's GDLM 68 run (recording 2026-11-24 19-47-52, gd-physics): climb 1 (9 steps, 6 short landings, the
  next landing hidden) took 5 of 6 deaths, nobody past step 3, the sim agreeing; its route was one HELD press bouncing up,
  the player taps. So score.js "climbs" FAILs a climb with 3+ short landings, or short landings and a hidden next one.
- [ ] **No stale stretch**: the longest time with no mode / speed / gravity / size change (a blue or green orb or pad
  counts) stays under 35 s at Easy / Normal, 25 Hard, 18 Harder, 15 Insane+ (official levels 1-6: 28-46 s; the later
  ones mostly 4-15 s). compose adds a cued gravity structure (blue pad, gravity portal pair, ceiling run) to cube sections
  of 10+ s at Normal and up. score.js "stale stretch". (The user, 2026-11-24: "a bit more upside down ... almost
  everything is very stale". Over it then: the Golden Hour versions, 34 s of sunrise at Hard.)
- [ ] **Modes for the tier**: a level's modes, speeds, sizes, orbs and pads fit its difficulty the way the official levels
  bring them in (DIFFICULTY.md "Mode order": Easy = cube, ship, yellow / blue pads; Normal adds gravity flips and yellow
  orbs; Hard pink pads; Harder ball, pink / blue orbs; Insane mini, UFO, wave, 2x...). score.js "mode tier" WARNs a
  feature more than a tier above. (The user, 2026-11-24: mode difficulty follows its appearance in the main levels.)
- [ ] **Structures from the library**: compose.js puts a ranked structure (STRUCTURES.md) in every
  plain 1x cube section by default; a hand-made spec names them as `"s:<id>"`. Mechanics our levels
  never had rank first. `node tools/structures.js rank`. **Only ready ones, and ready includes the check in
  context** (a spike before, an orb pit after, 2 columns each: `check --context`): a piece that passes alone
  can make orb chains or jumps timed around a block beside its neighbours (GDLM 64 v2/v3). compose leaves out
  a not-ready `s:` piece even when a brief names it by hand.
- [ ] **Structuring** (CRAFT.md "Structuring"): outlines varied (not plain rectangles), structures joined to each other, not only
  square shapes, the theme in the gameplay shapes, no long orb strings as the only mechanic. Not checked by a tool yet.
- [ ] **No piece kind on repeat**: at most ~25% of the level's 2 s pieces repeat a signature from the 4 before
  (official median 20%, ours 43%); few flat-cube pieces (official 2%, ours 33%). `node tools/lego.js variety <level>` (LEGO.md)
- **No layout twice** (Evgeni, 2026-11-25: "many duplications like this"): the same block-for-block chunk again is a repeat
  even at another phase; ours had 90 of 751 pieces (12%) vs official 1 of 838. `node tools/lego.js mine ours` flags `dupOf`
  (LEGO.md "The catalogue as Evgeni browses it"). Pieces he voted on: `node tools/lego.js votes` (a weight, not a ban).
- **Combining like the main levels** (LEGO.md "Combining", `node tools/lego_seams.js`): the next piece another kind but about
  as hard (official: same signature 16%, ours 37%); portals entered on the move, not walking in (official 93%, ours 54%),
  ~0.4 s quiet before and ~0.5 s after; some portals change speed too; use height (5 of 22 main levels climb past 20 blocks,
  ours never pass 8).
- [ ] **Variety**: ~15 kinds of gameplay thing; 4-5 modes and 2-3 speeds; a portal every ~2-3 s;
  ~25 orbs and pads per minute; at least ~90% of the chunks new. `node tools/variety.js <level>`.
  (levels/variety.md)
- [ ] **Pace of new things**: something new every 2-5 s in the first half; yellow pad and orb by ~10 s,
  a second mode by ~15-20 s. Show each new thing once or twice, calmly, then move on.
  `node tools/obstacles.js intro --file <level>`. (levels/obstacles.md section 3)
- [ ] **Sections read as Easy/Normal**, with no "off" or "sparse" ones. `node tools/tiercheck.js <level> --tier Easy`.
  (levels/modes_low_tier.md, tier_ref.json)
- [ ] **Ultra-synced levels sync the INPUTS, not the obstacles**: build them beat-first (`tools/hitbuild.js`):
  the planned taps alone, each on a real hit (tools/hits.js), must clear the level in the sim. Sliding
  obstacles until a window covers the beat left 11% of presses on a hit (GDLM 62 v2: "there is no sync").
- [ ] **Every ship press has something at the ship's height right in front of it** (a pillar it must rise over,
  or for a press that only stops a fall, a roof coming down past the dip), within 3 blocks of the latest
  moment it works. A tunnel floor far below or a step 5+ blocks on is a prejump. `score.js` gate `prejumps`;
  built in by `tools/hitbuild.js` (SYNC.md section 8).
- [ ] **The level answers the song's impacts, and has no dead stretch in a heavy part** (the user on GDLM 44, 2026-11-25:
  "in 53-54 there are big drums like we are entering new section, but in the level its nothing"; "2 seconds of nothing"):
  every impact of strength >= 0.5 gets a section start, portal or speed change within 1 beat, heavier parts may speed up,
  and 1.5 s with nothing to do sits only where the music is quiet. `node tools/impacts.js --level <level>` (SYNC.md 9).
- [ ] **Sync loosely**: portals, speed changes and the drop on the music's moments; most clicks free.
  `node tools/sync.js`. (SYNC.md "How much to sync")

- [ ] **Taste from data** (308 rated / unrated community levels, within tier and era, effort taken out):
  featured levels have **fewer hazards per block** (delta -0.25; epic+ vs featured -0.33) and **longer
  sections** (fewer mode / speed swaps per minute, -0.28), and a fuller look -- above all **motion on every
  screen** (move / rotate / pulse triggers on deco, +0.32 with effort out).
  Against real sections of the same type (`tools/compare_sections.js`): we over-sync -- deco pulses on the beat 57% vs
  31% (luck ~30%), portals on bar lines 100% vs 33% -- and under-animate (motion triggers per screen 10 vs 45). `node tools/taste.js score
  <level>`; score.js gate "taste". Most of the user's spot rules come out "unclear" in level-wide data
  (not weaker for it). (TASTE_DATA.md)
- [ ] **Crafted like RobTop's** (the user: "nothing at the level of ... Jumper or xStep"): many small
  pieces (>= 12 per 100 blocks) over a floor that is a hazard >= 35% of the columns, neighbouring pillars
  of different heights, rods and chains attached to pieces, <= 20% loose deco. `node tools/craft.js check
  <level>` (score.js gate "craft"); generate with `"craft": true` and the craft structures. (CRAFT.md)

- [ ] **Auto stretches** (AUTO.md; the main levels spend ~10% of their length with no press, 4-15 stretches of ~1-1.5 s,
  often ending in a mode portal): a level has some, each clears with NO press, and a stray tap there does not kill
  (clickSafe >= 0.8 in `knowledge/autobricks.json`). Pick them from `tools/autobricks.js`.
- [ ] **Auto parts are planned from the beat** (Evgeni 2026-11-26: "plan our change of movement ( pad/portal ) , according to
  the beat"): each change of movement fires on a beat, in motifs (AAAA, BBBB, a mix), and every trigger moves the player.
  `tools/autobeat.js` builds this way and measures `onBeat` (aim 0.9+). On the song's NOTES, not only beats (Evgeni: "we hit
  like 1/6 of the notes"): `notesHit` aim 0.5+, every note in loud parts; speed portals follow the music's `speedPlan`.
  The same music keeps the same auto vibe: each band of notes (low / mid / top) has its own kind for a batch, rerolled at
  the song's transitions; the song's hits are staircase steps; the ground under an auto stretch varies.

## Looks like 2.2, not 1.0 (levels/modern_look.md)

- [ ] **No white deco by accident** (the user, 2026-11-24, after GDLM 67 in the real game: "our deco being pure white within the game is still expected?"): every deco object's colour channel -- its key 21/22, or its default (channel 1 for 211 / 693) -- is defined in the header or by a colour trigger before it; otherwise GD draws it WHITE. `node tools/channels.js <level>`, score.js gate "channels" (FAIL).
- [ ] **Colour by role** (the user, 2026-11-24: "clear contrasts between the different things (ground, spikes, deco). Sometimes the path is very unclear with similar shades of black, grey, brown"): sky and deco may be busy and mid-tone, but the path reads as a mass (a block's dark body stands off the sky, or its rim does in an empty sky), hazards keep their own hue and value, and no deco touching the path or a hazard sits in its value and hue family. `node tools/roles.js <level> --shots 3` (score.js gate "roles", FAIL at 10% of sections; officials 0-5%); palettes from `decokit.rolePalette(hue)`. ART.md "Colour by role".
- [ ] **Readable colours, not mush** (the user, 2026-11-24: "sometimes its not clear and its all mooshy"): judge by
  BRIGHTNESS, not hue -- hazards and blocks stand out from the background at every moment (luminance ratio hazard/bg
  >= 1.6, block/bg >= 1.15 with an edge; aim for 3+ like most official sections) but not STARK (median block/bg
  over 6.5, black blocks on a bright sky everywhere: rated 2.2 levels sit at 1.35-6.2; `decokit.midTone(hue)` gives a
  mid-tone palette with clear hazards), the floor shows (ground/bg >= 1.1 or a bright
  ground line), a spike and its block are one colour or clearly different in brightness (never two hues at one value),
  no glow/deco in front of hazards. Colour triggers included. `node tools/contrast.js <level>` (score.js gate
  "contrast"); palette rule in ART.md "Colour readability".

- [ ] **Budget**: ~10-50 objects per block. Fall Out, the user's own example, has 13; the levels the
  user played have a median 46. GDLM was at 1. `node tools/modern_look.js <level>`.
- [ ] **Layers**: ~40-60% behind the play (B5-B1), ~15-40% in front (T2-T4: glow, dots, particles,
  see-through set pieces), never a solid fill over the play.
- [ ] **Colours that must show from the first frame live in the header**, not only in colour triggers:
  the editor runs no triggers (the signature looked pale in the phone editor). Channels 988-999 are the
  signature's. (VISUALS.md "Signature")
- [ ] **Colour**: every deco object on a colour channel, ~30-60 channels with a third blending, HSV on
  ~40-50% of objects.
- [ ] **A theme with one motif through the level, and a new scene per section**: palette, frame and
  background change with the mode. Mode changes and look changes go together.
- [ ] **Motion**: moves, fades and particles (~100-150 each per minute). The camera changes at
  sections. Shaders only at transitions and drops. Per screen by energy (gd-taste's section comparison, 2026-11-24:
  rated 2.2 median 48 a screen, ~1700 pulse/move/rotate a minute; ours 10 and 406): drops ~45, grooves ~25, calm ~12,
  pulses mostly off the beat. `decokit.motion(x0, x1, {beat, spb, energy, pulse, bob, sway})`; decostudy.js measures.
- [ ] **Shape of the level**: a dense opening, quiet 1-2 s transitions, the biggest effects at the
  drops. A title at the start and credits at the end. Don't copy any one level's art.
- [ ] **The title clears GD's "Attempt N" counter**: it shows ~5 rows up from the start to ~6 blocks
  ahead (more with 3 digits); the title starts after block 12. make.js warns on any text there.
  (GDLM 47, the user; measured on recording 2026-11-23_02-51-50.mkv)
- [ ] **No empty patches**: every screen-wide stretch has at least half the level's own deco per
  block (open cube stretches get a dim back row and dots from the modern pass). score.js gate
  "deco coverage". (GDLM 45 v6 ~24.7 s: "some places are very empty in deco")
- [ ] **Calm, not flashy**: pulses on bars or rarer, toward a tint of the deco's own colour, never
  white, never on gameplay edges; one dim sky flash at most. (TASTE.md; hellgate, eclipse v2)
- [ ] **Deco never looks like gameplay**: no thick rings (236 at scale 0.5+) that read as orbs, no
  ball or square shapes (51, 148) next to the path. (TASTE.md; GDLM 51)
- [ ] **Deco above ~225 units (7.5 rows) is not seen in a cube part**: put what should be seen lower.
  (TASTE.md; GDLM 51's eyes at y 235)
- [ ] **Readable, measured**: hazard contrast against what is behind it >= 3 in every frame (median
  >= 4.5), at most 4% of a frame as bright as the hazards, no flashing (< 0.5 per second, no frame-to-
  frame brightness jump over 0.12). `node tools/readability.js <level> --gate` (renders, ~8 min).
  GDLM 44 v13: contrast 1.05-1.48 ("waaaay too flashy ... hard to tell what kills you"); round 2: 4.7-6.
- [ ] **Readable**: hazards stand out (white, grey or their own colour against the scene); no deco
  that looks like an orb, pad or hazard: fires only far back, small and dim. Hazards keep their contrast
  on the drop's brightest frame (one sky flash, not two). Behind a portal a dark disc, never a lit one.
  `node tools/shoot.js` the drop. (design.md; players_say.md: saws taken for orbs; POLISH.md hellgate)
- [ ] **Three values, never mooshy**: per section the sky, the path (ground + block fills) and the scenery behind
  it sit at clearly different brightness: sky vs path and sky vs blocks >= 3 (luminance contrast ratio), sky vs
  spikes >= 4. Far scenery sits BETWEEN sky and path, never as dark as the path (a silhouette as dark as the floor
  reads as floor). A dark night sky cannot separate from a dark floor: lift the sky to a mid blue (GDLM 64: night
  sky/floor 1.2 -> 3.2 with sky 82,86,184 over floor 8,8,24). (The user, 2026-11-24: "your color choices sometimes
  are bad according to background/path/spikes ... its all mooshy".) gd-art's contrast check codes it.

- [ ] **A generator change does not silently change other levels**: before pushing a change to
  patterns.js / structures.js / compose.js / decorate.js / make.js, `node tests/generator_impact.js` lists
  every level whose gameplay would change when rebuilt; tell each owner, or keep the old shape with a
  pattern option in that spec (e.g. orb-pit `"asym": true`). (GDLM 50 eclipse, changed by a wave fix
  made for hellgate)

- [ ] **Every build puts its stages** (song, layout, path, deco, final) for the viewer: compose and make.js do it by
  themselves (tools/stages.js, visuals); a hand-made build that skips them shows only its end. (the user, 2026-11-24)

## Name, description, signature (the user, 2026-11-23)

- [ ] **The name is final from the first upload**: the GD server refuses a renamed shared level, so the
  name is `GDLM NN <words that fit the level>` from the start, never a working label. (PUBLISH.md, STYLE.md 2b)
- [ ] **The description is for players**: one or two short sentences with some flavour, ending with
  " -- Made by Claude (and some humans)", ~150 characters at most. Notes (beats, dB, song ids,
  versions) go in the spec's `"notes"`. make.js stops over 180 and warns over 150 or on note-like text.
- [ ] **The level ends right after the last input**: the sign ~3 blocks after the last gameplay object, the
  level over ~5 blocks after the sign (make.js clips scenery and triggers past it: GD ends a level at its
  furthest object). ~1.5 s from the last input to the end; official median 0.8 s, rated community 0.9 s.
  score.js gate "ending" (WARN over 2.5 s). (the user on 45 v7: "ending still bit too long")
  A section (the lab's variants, unsigned): cut ~3 blocks after its last hazard / orb / pad / portal or input
  (tools/lab.js trimEnd), and its corridor fills the section it was given -- a wave corridor stopped at 2/3 of its
  section, ~5 s of empty run (the user, 2026-11-25: "leaves way too much space ... should end almost instantly")
- [ ] **The signature ends every GDLM level** (robot + human): make.js adds it by default; opt out
  only with `"signature": false`.
- [ ] **Every level ends with the latest end screen: the auto outro + the signature** (Evgeni, 2026-11-26: "from now-on
  everywhere, we add the latest end screen claude sign on every level we make"). make.js: `"outro": <seed>` (autobricks.js)
  then the signature; any other builder (autobeat.js, planbuild, hellgate_build, lab levels meant to be played) adds the same
  pair. BUILDING.md section 5.
- [ ] **Auto levels: no secret way** -- a press anywhere dies or is back on the auto path within 5 s (autobeat.js strays();
  saws where a press leaves it). Rapid runs (4+ notes <= 0.14 s apart) get triggers 0.07 s apart. AUTO.md round 8.
- [ ] **After a physics change, republish the phone page before a level built on it goes there** (PHONE.md): the page replays with its own copy of lib/physics.js (auto beat v8 died on the phone at 11 s, 2026-11-26).
- [ ] **An auto level is built and checked on main's newest physics before it is installed**: GDLM auto beat v4 cleared on
  the morning's physics and fell in the game at 20 s; on the evening's physics it dies there too. `git pull`, rebuild, check.
- [ ] **Auto layouts read as designed** (Evgeni on v5: "jumpy across screens", "very random", "janky within the block"): no
  teleports, height inside a camera band except at section changes, phrases echo their call, slopes as moves, the player never
  sinks into a ledge, spider moves short, every pad on a block. autobeat.js `shape` (AUTO.md round 9).
- [ ] **Nothing the player should read above the view** (the user on GDLM 72, 2026-11-25: "the sign is offscreen"): for a
  cube on the ground the game shows y -93 .. ~227 (lib/camera.js), so text and set pieces stay under ~210. The signature's
  stage floated 90 units up and put its title at y 232; now 50 (title ~192). 21 of 30 GDLM levels carry the old one until
  rebuilt (`make.js <spec> --look`).

## Ratable (rating.md)

- [ ] **60 s or more** (30 s is the minimum; RobTop's tip). GDLM 41-44 were 12-31 s.
- [ ] **Runs well**: no lag from wasted objects (RobTop: lag can block a rating or lower its tier).
- [ ] **Gameplay first**: the top complaint about Legendaries is beautiful with weak gameplay (players_say.md).
- [ ] **User coins**, if any: a real optional challenge on a harder route, never free.

## Then

- [ ] Put the level in the viewer: `node tools/wip.js put <level> --session <name> --note "..."`.
- [ ] Read the user's marks (`node tools/marks.js`), and after their playtest copy their words into
  `knowledge/critiques.md`. A new lesson goes into the right doc and onto this list.
- [ ] **Not mostly cube, and some of it upside down** (Evgeni 2026-11-26 on Hellgate v6: "why is variety so biased to cube?
  and almost no reverse if at all"): cube's share by tier as the mains measure it along their routes (2026-11-26: 69-87% in
  the easy mains, ~24-50% in the harder ones; average 57% cube, 20% ship, 9% ball, 6% ufo, 4% wave, 1-2% robot / spider /
  swing), and ~15-25% of the time upside down (mains: 17%). No mirror portals for now (Evgeni).
  The cause was the library (52 cube pieces vs 2-12 per other mode at 1x), so the fix is more verified pieces per mode
  plus a mode-share target in the picker; to come as a score.js check.
