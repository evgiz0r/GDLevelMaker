# Section types: what each layout section is, so a builder can make one at any length

Evgeni, 2026-11-27, on the theme layout board's sections: "theser are decent layouts imo ( dont need save these copy by
copy, but to understand for the future how to make similar according to bears [beats], or invent new ones that are
coherent in general ( shorter, longer, as the game suggest ) today probably we dont have too long corridors due to how to
make the level but such corridors or longer sections of similar type should be able to exist".

So the sections on the board (tools/layoutsections.js, his edits in knowledge/layout_sections.json and
knowledge/layout_sections_added.json) are **examples of types**, not pieces to paste. This page writes down what makes each
type, so a builder can make a new one of any length, synced to the song, and so a new type can be added the same way.

## The rules for every type

- **A type is an idea plus a motif.** The idea is what the player does there (climb, weave, flip between floors). The motif
  is the smallest stretch that shows it: one step, one zigzag leg, one pipe. A section is the motif repeated, with
  something changed each time.
- **Length comes from the song.** A section fills its song section (tools/sections.js, tools/songplan.js): 4 to 32 bars.
  One motif takes 1 or 2 beats at the type's speed. A section has 4 to 64 motifs. A long corridor is fine (Evgeni: "such
  corridors or longer sections of similar type should be able to exist"). Today's builder (tools/brickpick.js) joins short
  bricks, so it never makes them. That is a gap in the builder, not a rule.
- **Shorter:** cut at a motif boundary, and keep the entry and the exit. **Longer:** repeat the motif, and change one or
  two of its parameters every repeat (height, gap, spacing, a hazard's place). Change more at phrase starts (every 4 or 8
  bars). Never use the same motif three times in a row. The family rule for that is in tools/repeat.js.
- **Build it in three parts: entry, body, exit.** The entry and exit meet the joins (lib/scenejoin.js: the floor and the
  ceiling slope to the next section's heights). Give the body a peak in its middle: the denser motif, as in the wave's
  quick zigzag (Evgeni: "in the middle some different pattern like more cps").
- **Beats:** a motif starts on a beat, and the denser part sits on the song's loud bars (tools/impacts.js). Put portals,
  including gravity portals, on bar starts (SYNC.md).
- **Hazards say which way is safe.** Spikes and saws close the wrong paths. They never sit on the only path.
- **Where each mode can slide** (Evgeni 2026-11-28: "should somehow differentiate in general places where we can slide and
  where we cant (cube/robot/wave...)"; the rules are lib/physics.js's, the measured ones are in CLAUDE.md Calibration):

  | mode | slides / stands on | dies on | safe-maker |
  |---|---|---|---|
  | cube, robot | the floor side (tops; ceilings upside down), slopes up and down | its 9x9 kill box in a block: a wall, a head hit from below (a graze of the outer box is fine) | H block (1859): head hits bump |
  | ball, spider | both sides (it flips), slopes | the kill box in a block (walls) | H block (1859) for the spider |
  | ship, ufo, swing | floors and ceilings both, ceiling slopes (a ship slides one and is launched off its low end) | head-on into a wall | none needed |
  | wave | flat tops and bottoms, a slope met at a glancing angle (45 degrees onto flat) | sliding off a block's END (no block of the same face after it), flying head-on into a slope (down into a rising one: 90 degrees), its 3x3 kill box in a block | **D block (1755)**: ends and slopes slide |

  So: a wave must never be left to slide where the surface ends or turns into a slope. Joins (lib/scenejoin.js) do it by
  themselves: into or out of a wave, every floor top and ceiling bottom from 5 columns before the portal to 4 after
  (into) or from 4 columns before the join to the portal (out of) gets a "D" cell (3 rows tall in the level, invisible,
  drawn faint green on the board). Inside a wave section the plan must not slide off an end: give the surface a seam
  block (the same face goes on) or a D cell. A cube or robot section may ask for a head hit only with an H cell. The D
  and H blocks are UNCHECKED in the game (PHYSICS.md "Gameplay modifiers").
- **Gravity portals** (board pieces G 🟡 upside down and N 🔵 back, ids 11 and 10; Evgeni: "i need also reverse gravity
  portals in the layouts") turn any type upside down for a while. The mirrored motif repeats there, then an N brings
  gravity back. In a corridor, a flip mid-motif reads well. A flip right before a jump does not: no input may be forced
  right after a portal (DIFFICULTY.md "Fairness").
- **A portal sits in the middle of its corridor**, across the band the player flies or runs in, so no path goes around it
  (Evgeni 2026-11-27: "the portal should be not in the middle of the screen but in the middle of the corridors (
  everywhere )"). The solver's route must pass through every portal (tools/layoutcheck.js shows it).
- **Play over the whole height** (Evgeni 2026-11-27: "can we try 100% spread or close in all generations if possible. should
  be doable hitting the ground here and there"; "play over the whole screen is usually rewarded"; only the entrance may stay
  low). Every section touches the ground and the top at some point: a flying corridor tours from the ground to the band's
  roof (tools/sectiongen.js `tour`), cube types climb or flip to the top (opencube platform climbs, staircase flip onto a
  hanging staircase), ball / spider surfaces sit on the ground and under the bar now and then, orb landings go at any
  height. No full-length spike floor or roof: leave stretches to land or slide on ("removing the full ground spikes to allow
  it when needed. landing/sliding on either ground or roof as additional gameplay"), and a blocker line never runs where the
  play goes up there. Measured by tools/layoutcheck.js `spread.used` = rows the player visits / rows a player can be in
  (not solid or hazard all across, inside the mode's band unless the map has band movers); target near 1.
- **Taller than the band: hidden band movers** (`bandMovers`: a ship H / ufo U / wave A portal at the corridor's middle each
  time it has moved 3 rows from the band's centre; swing uses R pairs). Every portal inside a section is softly blocked on
  both sides so it can't be flown round (a spike on the floor and one on the roof in its column when the corridor is 6+
  rows; Evgeni: "if there is no room in the corridor no need to block"). Check: `node tools/layoutcheck.js <keys> --skips`.
- **Ball, ball portals and spider in tall maps climb** (Evgeni 2026-11-28: "make the height of the ball/spider ( or others
  with the same ) to be able and have increased height"; tools/sectiongen.js `climber`). Their band portal (L / P) can
  only centre the band on the player, and the floor / ceiling flips alternate up and down, so the band random-walked and
  used 5-9 of 20 rows. Now the band has a target (drawn like `tour`: from the middle, by chance, not forced); while it is
  off by 2+ rows the flip toward it steps 3-4 rows (to the band's edge if need be) and the flip back 2 (spider 1), and a
  band portal goes in only when it moves the band toward the target. Outside the band the map is solid (a player who
  skipped a band portal rolled the open ground under the raised band: 2 presses for a 17-press plan). Default heights
  unchanged. Measured (`node tools/genheight.js ball my-mwz7nxue my-mwz8kaem --seeds 1,2,3,4,5,6`, 80 cols, 20 rows,
  normal): rows visited ball 6.0 -> 9.8, spider 7.2 -> 9.3, ball portals 6.5 -> 8.5 (13/20 best); 30 rows x 120 cols up to
  21. Plans clear 80/80 (90 cols, 20 / 30 rows, easy / harder, seeds 1-10). Open: the bottom two rows are rarely visited
  (the band starts on the ground and the first target usually lies above).
- **Upside-down stretches get the mirrored obstacles**: if the floor has spike pits, the ceiling the player runs on upside
  down gets pits too (Evgeni on closer cube: "wierd assymery with the spikes on the grown on the bottom but no such on the
  top").

- **Presses first** (Evgeni 2026-11-27: "our generating solves by design and we just patch the timings and search secret
  ways with the solver? ... shape first is not great"): a type plans its clicks (gap by tier and the beat, its window as a
  late / early margin), the sim's arc of each click places the next surface (tools/sectiongen.js `cubeArc`, `ballTravel`,
  tick-stepped like lib/physics.js), and hazards go where a wrong press lands. The type returns `presses` (columns of the
  player's centre); `require("./tools/layoutcheck.js").planCheck(z)` plays exactly those taps, and `node tests/sectiongen.js`
  fails any type whose plan dies. The solver is then only the check for secret ways. Done: open cube, closer cube, staircase, orbs, spider, ball, ball portals,
  fly (holds and releases -> `shipStep` path -> the corridor fitted around it: each column edge's floor between the path's
  margins, slopes of a row a column at most, hazards only where the path clears them by 8; presses are [press, release]
  column pairs, plus the planned `path` for the board; a draw that doesn't fit the grid is drawn again a little flatter;
  the band's floor and roof count as safe surfaces, so the corridor never has to reach past them: 0 in 180 fall back to
  the old shape). **Gentle general flight** (Evgeni 2026-11-27: "the flying corridor is a bit too wavy, flying should have
  some kind of a smaller degree in the general flight"): climbs and dives capped at vy 3.2 (was 4.6), each state played
  forward to the tick it would pass the cap and ended on the last beat before it, and the corridor steps a row every 2
  columns at most (`fitCorridor` option `run`). On 64 draws (60 cols, 10 / 20 rows): mean path angle 19-21 -> 15 degrees,
  steeper than 30 degrees 20-25% -> 0%, clicks the same, height used 90 -> 81% (10 rows), 70 -> 67% (20 rows). Feathering
  at the cap (short opposite states) kept all the height but doubled the clicks: not taken. planCheck maps a plan column to a tick exactly (tick 0 = the first tick at or past
  the section's start): rounding a column to the nearest tick put presses a tick early and the ship drifted 15 units off.
  Wave (wavePlan): legs from the tier and the style (a quick middle, one ground slide, every turn on a beat when there is
  one), the exact 45-degree path, the same fitter (`fitCorridor`, which now follows the path's own centre so the tunnel
  zigzags with the flight). The gravity pair makes two turns itself (the portal stands where the wave touches it at that
  turn). It starts and ends on the ground (a wave sliding off the last floor block into the exit dies), and never rides
  an invisible band edge (that looked like flying straight in the open for 15 columns, and GD 2.2091 may hold no band for
  the wave at all): it turns a row before one. 1 in 240 falls back to the old shape; 75-81% of turns on half beats.
  Flying on the grounds (my-mwz1s7po): tried 2026-11-27 (`groundsPlan`, not registered): the side switches planned, the
  climbs and drops force the roof / floor side, spikes on the side not ridden. It clears at 56-80 x 10, but with a beat
  4 of 6: after riding a sloped roof the real ship stays pinned up there ~50 ticks past the release, which the page-side
  `shipStep` doesn't copy, so later spikes it thinks are clear are hit. Needs the ship's slope contact from
  lib/physics.js in the stepper; until then the shape-first version is in use.
  Flappy (ufo, up to the band's 10 rows): taps on the style's rhythm (quicker while climbing to a higher target, skipped
  above it), `ufoStep` as lib/physics.js, poles 1-4 wide whose gaps are fitted around the path over their columns (margin
  8, at least the tier's room); taller maps keep the shape-first version with its U portals. 1.8-2.7 taps a second,
  all taps on half beats with a bpm.
  Closer cube (2026-11-27): a press on the rhythm (or beat), its jump played in the page's own cube run (`cubeTry`:
  floor tops per column, pits, hazard boxes, the 10-unit foot margin), and the hazard under it -- 1-3 spikes or a 2-3
  wide pit -- picked and placed so the press's measured timing window (`cubeWin`, ticks early + late) is near the tier's
  (64 ticks easy -> 24 harder) and about centred. Hanging spikes come down a row between jumps (a block at f+4, the spike
  at f+3): walking passes, a jump there dies, so a stray press or a held button is caught. Taller than 10 rows the
  corridor climbs (a press lands a row up) and comes down (walk-offs), and the gravity pair is a short 12-column one late;
  the flipped span is planned upright and drawn mirrored. Measured: every plan clears (60 x 8 / 14, 90 x 20), every press
  needed, holding the button clears 1 of 8, 1.0-1.4 presses a second, 100% of presses on half beats at 140 / 175 bpm.
  Orbs (my-mwz2haf0, 2026-11-27): it already built each orb on the arc of the last; now it returns those presses (the jump
  off the start, a tap as the cube passes each orb, the jump off each landing's end), the plan flies on from where the
  cube really is (no snap to the orb's centre), and a landing whose side would catch an arc coming in is moved on. With
  beats each orb takes the tick of its arc nearest a beat, a landing's jump-off goes on a beat. Every plan clears, every
  press needed, holding clears none; on half beats 94% at 140 bpm, 63-74% at 120 / 175 (a cube orb jump lasts ~0.43 s,
  two half beats at 140, so an arc can only carry an orb onto some beats).
  A landing reversed on the ceiling is taken only when the jump off its end reaches a flip orb (Evgeni 2026-11-28: "some
  of the orb generations end on the floor death": a ceiling landing near the top bar left an arc too shallow for any orb,
  the plan ended reversed and the cube rode back into the hanging spikes; 6 of 144 plans). 192/192 and 144/144 at 140 bpm
  clear now (30-120 columns, 14-24 rows).
  Spider (my-mwz7nxue, 2026-11-27, rebuilt; the rollers-based one is gone): taps on the rhythm (or beat), each with a
  window of `win` columns (2.4 easy -> 1.0 harder) and its two surfaces built from it: the one left ends where a late tap
  walks the spider off (its box past the last block), the one teleported to starts where an early tap finds nothing above
  and flips into the band's spikes; each surface runs to the next tap, on the other side, 2-4 rows on, now and then on the
  band's floor or roof. Taller than the band: a hidden P on a long surface re-bands. Every plan clears (30-90 cols, 10 to
  30 rows), holding clears none, 67 of 70 presses needed, 1.3-2.1 taps a second, 100% on half beats at 140 / 175 bpm.
  Staircase (2026-11-27): each press a jump onto a step a row up, the step's edge placed where the press's measured window
  is near the tier's (an early press lands short and walks into the step, a late one hits its side), 1-3 chained jumps
  right off each landing, then a landing walked on the rhythm's gap; now and then a spike or a pit on a landing. At the
  top a G drops the cube onto a bar along the top and a staircase hanging from it comes down 4-6 rows (planned upright,
  drawn mirrored), an N at its end drops it to the floor; with no room for that it walks back down. Every plan clears
  (40-120 cols, 9-20 rows), every press needed, holding clears 1 of 8, 100% on half beats at 140 / 175 bpm.
  `cubeTry` now starts a run where the cube last landed: a press while still in the air is a miss, so a window's early
  edge never reaches back past the landing.
  Stair path (my-mwz1637w, 2026-11-27; Evgeni chose "B, but if possible somewhere close to the beats": keep the lattice 3
  apart, plan its presses from it): the lattice is drawn as before, but a column goes 1-2 further on only where the cube
  can't land on it with a press PD after its landing (PD 0.4 columns easy -> 0.2 harder, the window to press in; the air
  time per height change is in the code). `latticePresses` then plans one press per hop with a search over the hops in
  the page's cube run (`cubeTry` with the hop's other blocks and hazards as boxes, mirrored upside down): the presses
  that land the cube on the next way block a little inside its ends, the one nearest the beat first, then the earliest
  landings (a late landing on a 1-wide block leaves the next hop no time), undone when a later hop has none; a gravity
  turn needs no press, a 1-column gap at the same height is walked. A lattice whose presses can't all be planned (1 in
  ~12 at 200 columns) is drawn again (shorter wait, then the next seeds). Every plan clears (30-200 cols, 13-20 rows),
  holding clears none, every press needed, ~1.9 taps a second; the presses sit NEAR the beat, not on it (mean 25-40 ms
  off at 140 / 175 bpm against 43-54 for a random press), since the lattice fixes where a jump can be.
  **GD's jump snap is in the page physics now** (cubeTry with `sn`, the real sim's applySnap): landing on a block a stair
  step from the last one (90 on and 2 up, 120 on and 1 up, 150 on and 1 down, at 1x) moves the cube up to 1 unit so it
  keeps its offset; on a stair path most hops snap, and without it the cube ran 0.3 columns ahead of the press times
  after ~25 hops and a press came before its landing (the plan dies late in long sections). With `sn` a press is a
  time (column = tick * dx / 30, as planCheck plays it), and the jump's own tick moves x only (the page's arc was 2.4
  units too high). The other cube types do not use `sn` yet (their stairs are short; worth doing if long ones die late).
  Not yet: swing (the board thread's tools/swingbuild.js); fly's gravity pair (the planner flies upright only).
- **The planned path, for every presses-first type** (the board's 🎲 draws it with no solve, 2026-11-28): fly, wave
  and flappy return `path` from their planner; the cube, ball and spider types (open / closer cube, staircase, stair
  path, orbs, ball, ball portals, spider) get it from `tracePath` in `make()`: the presses played over the map in the
  page's physics (blocks, G / N, orbs Y / B / E, GD's jump snap, a rising cube landing on a top corner within 10 units),
  [column, bottom row] every 8 ticks. tests/sectiongen.js "path": it reaches the end and is within 0.25 rows of the real
  sim at most (60 columns, 13 and 20 rows).
- **A random entry height** (Evgeni 2026-11-28: "lets make the initial spot in the generation random, so that the
  entrance is not always at the same place. could be at any height (for the non starting cube)"): ctx's `entry(lo, hi)`
  draws the row a section comes in at from its own seeded stream (`o.entry` sets it), and every presses-first type starts
  there with its floor run up from the ground at column 0, so the join before it ramps to it: open / closer cube,
  staircase and stair path (below the first turn, so a climb still comes first), orbs (the start platform), ball, ball
  portals, spider (taller maps any height, in the band the join's portal sets: 3 rows under the entry; short maps 2-3),
  fly and wave (the corridor's floor at column 0, flat for its first column; the planner holds the ship on it, then lets
  it down at the corridor's slope; short maps up to row 4 so the band stays at the ground), flappy (a pillar over the
  first 3 columns, up to row 4). Over 12 seeds a 20-row map comes in at 5-10 heights (tests/sectiongen.js "entry"); every
  plan still clears (30-200 cols). Not moved: the entrance (it starts the level), swing (the board thread's), the
  shape-first fallbacks and flying on the grounds.
  Two joins changed with it: lib/scenejoin.js ends a climb 4 columns before a portal into a flying mode (ship, wave,
  ufo, swing: a cube leaving a 45-degree slope is launched up for ~3 columns and met the portal still rising: a ship
  planned from rest flew 1-3 rows off its plan; into ball / spider / robot / cube it is the plain ramp again, since the
  longer joins moved the theme gallery's layout and it stopped clearing, 2026-11-28), and tools/layoutcheck.js's planCheck now builds the join in front as a level does, the mode portal in its gated
  last column (it stood before the join, so a ball rode a tall ramp and died there). tracePath knows the ball's and the
  spider's band edges (within 0.1 rows of the sim).
- **Open idea: mixing variants inside one type** (Evgeni 2026-11-27, for later: "eventually we might want to make the
  sections of the same kind mixed (for example ball layouts could be mixed in a way). either by generator from the go or
  by some cutting. currently the sections have defined gameplay, which is also nice. if you overmix gameplay, sometimes it
  looks too random."). A soft mix: one section of a type may borrow a variant of the same type for a stretch (e.g. a ball
  section with a portal-ball part), either generated so from the start or cut and joined from two generations, but the
  section's motif stays clear and leads; a mix is the exception, not every section, and never so many changes that it
  reads as random. Not built; when it is, measure it like the rest (the motif share per section, the variety score).
- **From a beat** (Evgeni 2026-11-27: "i want to be able to generate according to a beat as well, so its not just random
  stats, should be applicable in a level ... in the long run much more efficient than solving"): `make(key, {bpm})` or
  `{beats: [seconds | {t, s}]}` (a song section's hits with strength, tools/hits.js / impacts.js). ctx() turns them into
  beat columns (a bpm grid: half beats, a bar's first beat strength 1, beats 0.7, half beats 0.35) and `onBeat(want, min)`
  moves each press the style wants to the nearest beat, a strong one counted up to half a beat nearer. The style's
  density sets how far apart the wants are, so the share of beats taken. Measured at 140 / 175 bpm: open cube, ball, ball
  portals 100% of presses on half beats; fly ~85% of press and release ends (the rest are turns the steepness cap
  forces with no beat near); every plan still clears (tests/sectiongen.js checks both).
- **A song's real hits, not only a bpm** (Evgeni 2026-11-27: "i hope we can now/later generate to clicks or around, not just
  to some bpm. so that the generation process will be able to take into account beats to some extend"): `beats` takes
  the section's real hits as {t, s}; `node tools/sectionbeats.js <song key> --from <s> [--cols N]` (and
  `songBeats(key, from, to)`) reads them from the committed knowledge/song_notes/<key>.json -- every note onset with
  strength >= 0.3, near-twins merged, impacts raised to full strength -- and `node tools/sectiongen.js show <type> --song
  <key> --from <s>` builds from them; the board's 🎲 does the same in the page. onBeat's strength bonus reaches at least 2
  columns (~0.2 s): with notes ~10 a second the nearest weak one used to win, now a strong one up to a column nearer does.
  Measured (60 cols, easy + harder, 3 seeds): Back On Track from 10 s / custom 1086693 from 40 s: open cube, closer cube,
  staircase, ball, ball portals, spider 100% of presses on a note, flappy 74-100%, wave 64-75%, fly 22-61% of hold ends,
  orbs 10-57% (sparse hits leave arcs few to take); every plan clears; the notes taken average strength 0.63-0.77 against
  0.66 for all notes in the stretch.
- **One click style per generation, a small drift inside it** (Evgeni 2026-11-27: "the click pattern/holds/cps differs
  between generations. not consistent across the whole section, some have bit more cps, some have bit less. some hold more
  some hold less"): ctx() gives `style` -- a density (x0.82-1.22) and hold factor (x0.7-1.4) per generation, and
  `pace(c)` / `holdAt(c)` drifting +-6-12% over 25-45 columns. A press planner draws ONE base gap per generation, jitters
  each click +-15% and adds a rest one click in 8; never a fresh pick from the whole range per click (that gave 2x swings
  between quarters of one section). Measured at 120 cols, normal: open cube 0.8-1.6 cps between generations, ball 1.1-2.0,
  quarters within one click of each other. Holds (fly, wave, swing) use holdAt when those types go presses-first.

## The types (the board's examples)

| type | mode | idea | motif | change it by | longer looks like |
|---|---|---|---|---|---|
| entrance | cube | up a ramp onto the level's blocks, then a first spike and a small pit | ramp + flat + one hazard | ramp height (3 rows by default, tools/startramp.js) | not used long: an entry only |
| staircase | cube | climb, then step down | a step up of 1 row, ONE JUMP wide (4 cols at 1x, 5 at 2x) | chains of 1-3 such steps, then a landing two jumps wide (spike or saw a jump in); pits, a step back; never odd widths (Evgeni 2026-11-27: "should be a proper jump otherwise its impossible to adjust or predict") | more steps, more hazards on landings |
| open cube corridor | cube | a floor with pits and nothing overhead; platforms float in the middle | a floor run + a pit (2-3 wide spikes) | pit width, a platform over the pit | the run lengths change, platforms at 2 heights |
| closer cube corridor | cube | the ceiling comes down to 4 rows over the floor and hangs spikes | a floor spike or pit + a hanging spike, out of step | the gap from floor to ceiling, a block pushed down from the ceiling | the ceiling steps up and down by 1 |
| hanging structures | cube | structures hang from the top over a floor with spike pits | one hanging mass + a pit under or between | mass width and depth, its hanging spikes | more masses at different heights, holders from the theme |
| flying corridor | ship | a floor and a ceiling that rise and fall together | a hill: slope up, flat, slope down | hill height 1-4, a saw in the gap | hills of changing height; a long ship stretch is fine |
| wave corridor | wave | a 45-degree zigzag tunnel whose ceiling is its floor lifted (tools/layoutsections.js tunnel) | one leg up + one down | leg length (slow 5-6 blocks, quick 2) | slow legs, then a quick middle, then slow again |
| flappy bird corridors | ufo | pipes from the floor and the ceiling with a 4-row gap at changing heights | one pipe pair | the gap's height, the spacing | the gap height walks up and down |
| ball corridors | ball | floors and ceilings at several heights; the ball flips from one to the next | a floor run then a ceiling run | run length, height step | more levels, a spike under each switch |
| stair path (his) | cube | a lattice of single blocks: many paths in theory, every wrong one blocked by a hazard | a column of blocks 3 apart; each hop up 2 or down 1 | which block of each column stays clear | more columns; the clear route climbs and falls |
| swing (his) | swing | round movement: a big up-and-down corridor whose sides are curves, not slopes or blocks | one wave of the path (3 rows up and down, about 18 columns) | amplitude, period, the gap | waves of changing size. Ship can use it too (Evgeni: "the swing ( and the ship in a way, can do big up and down patterns )"). Since 2026-11-28 (GDLM 78): the tall swell from 24 columns on, starting on the ground, the gap at least 5 rows, both saw chains inside the map, a saw curtain every 8 columns from the 16th and whole swells (it leaves at the height it came in; shorter than 60 columns a lower swell), so it is flown inside, never under or over (the old one was flown along the ground under its lower chain). Later the same day, after Evgeni's play ("the swing is way too hard, too tight, way much higher cps needed"): it stays inside its portal's 10-row band with no R movers, the gap 6-7 rows, swells 34-52 columns long: 1.9-2.6 presses a second, tightest 150-250 ms |

## Orb and pad sets (a mechanic any type can use)

Evgeni, 2026-11-27 (remember it, not built yet: "its a bit harder creating timings with those, but probably not that needed
at the moment"): beside blocks and hazards, a section can be built from orbs (and pads). Sets that work:
- **a set of yellow orbs**: a chain of jumps in the air;
- **a set of blue orbs**: gravity flips back and forth, a zigzag movement;
- **a set of green orbs**: forward movement, but flipping gravity each time;
- **a mix of those**: harder to time.
The click-first generator (tools/clickfirst.js: kinds O / B orbs, pads) is the closest piece; timings come from the sim.

## How to test a section

- **🎲 on the board** (Themes tab, under the sections): pick a type, a length and a difficulty, press 🎲 generate, and a fresh
  section from tools/sectiongen.js shows at once (it runs in the page). Evgeni's comment on it goes to Claude with 📨 as
  "🎲 generated <type> (seed, cols, tier)", so it can be rebuilt exactly (`node tools/sectiongen.js show <type> --seed ..
  --cols .. --tier ..`) and the generator fixed from it.

- Its layout: the board's current scene (Themes tab), with soft markers where each section starts.
- Its play: the gallery build (🔨 on a theme card, then make.js solves it). A type is right when the solver's route clears
  it with player windows and no secret way (tools/score.js gates).
- Round sides without hazards (swing) need a round piece on the board and a GD object for it. Not chosen yet. Never guess
  an id: lib/objects.js, ask him in the editor.

## Sections as templates in a level build

Evgeni, 2026-11-27: "besides the option to use the official structures lego, it will be possible to use one of such
possible sections, as a template ( not copy this exactly ), and create somewhat approriate layout for the specific beat and
difficulty needed". So a builder (tools/planbuild.js, compose) has two sources for a section: the lego (verified official
or own bricks joined on the hits, tools/brickpick.js) or a **section type from this page used as a template**: its idea and
motif, generated fresh at the song section's length, with its presses on that section's beats and its windows / cps at the
level's tier. Never the board's example pasted as drawn, and not the drawing nudged a block or two left or right either (Evgeni,
2026-11-27: "the template is not building one or two blocks right and left, but lets have a more abstrct concept that might
create it in various difficulty and length"): a type is an abstract concept -- its idea, its motif and the parameters it
can change (table above) -- and the generator builds a new layout from that concept at any length and difficulty. The generators (tools/sectiongen.js, the "Generate our own
structures" thread) take `{cols, rows, seed}` today; for this they also need the beats (press times in the section) and a
difficulty target (tier: cps and tightest window), and are checked by tools/layoutcheck.js (solves, windows, tier).

**Which type a build picks is weighted by Evgeni's rating** (2026-11-28: "ill put a scale of how good i think it is. if
something is very low it should be used very rarely"): a 0-10 slider per generator under the catalogue's 🎲 panel (db
`genrating`), copied to knowledge/gen_ratings.json by `tools/genrating.js set`; tools/typebuild.js picks a section's type among
those its mode and song kind allow by (score/10)^2 (unrated = 5; a 10 is 4x an unrated one, a 1 is 1/25), a type not used yet in
the level first. Soft: a low type is rare, never banned. The level's opening cube section stays the entrance unless he rates it 0.

## Open

- **Generators: tools/sectiongen.js** (2026-11-27). One per type, built from the concept, not from the drawing:
  `GEN[key]({cols, rows, seed, tier, bpm | beatCols})` -> `{map, mode}`; `make(key, opts)` adds name and concept.
  `tier` (easy..harder, or 0..1) moves every parameter of the type toward its hard end; `bpm` snaps motif lengths to half
  beats (the press inside a motif is not put on its beat yet). Check: `node tools/sectiongen.js check [key] --cols 30,60,120
  --tiers easy,hard` (layoutcheck.js per map); test `node tests/sectiongen.js`.
  First check (seed 1, 30 / 60 / 120 columns, easy and hard): every type solves at every length except the stair path.
  Its lattice solves on some seeds only (2 of 4), with 8-29 ms windows from the 2-up hop, and its gravity pair dies as
  placed. ~~Rule: no gravity portals in a generated stair path~~ -- a misreading: "never gravity in generating stairpath" was
  a complaint, and "still no reverse portals on generation" confirmed it. **Stair path v3:** the gravity pair is on by
  default. The way hops +1 (never more than three times running: measured, a fourth +1 from a 1-wide block lands past the
  next one), +2 or -1 back, never flat. At the top step the gravity portal stands right after the block at the player's
  height, the next step hangs 5 rows up (the flipped cube meets its underside a block later), it climbs back down on the
  undersides and the normal portal turns it back (forced at the last chance, so it ends on its feet). 1 pair in 40
  columns, 2 in 80 (more on harder: lower turn). 12 of 12 solve (40 / 80 cols, easy / harder) and 12 of 12 (30 / 60,
  normal / hard).
- **Swing:** GD holds a swing in a 10-block band set by its portal (lib/physics.js BAND), so a taller swing means filling
  the band: the corridor's middle swings edge to edge (the band edge is the far wall at a peak), waves 20-34 columns.
  12 of 12 solve. **Taller (default, 20 rows, 40+ columns):** Evgeni: "swing/ship/ufo portals in the middle of the
  gameplay recenter the screen. people put invisible ones to move further in the screens". The corridor rides a slow
  swell over the whole map with the quick waves on top (together under ~0.7 rows a column), and an `R` pair (ship portal +
  swing portal, a quarter column apart; board letter R, tools/designthemes.js sampleOf) re-sets the 10-block band around
  the player each time the swell has moved 3 rows. The pair works under both rules: the old sim rule (a same-mode portal does nothing,
  gdsolver) and today's (lib/physics.js re-centres on a same-mode portal at a new height, PHYSICS.md "same-mode portal",
  so a lone hidden W would do too). The real game decides; "GDLM lab room mover" is queued to test it. 12 of 12 solve (60 / 100 columns). In the
  game UNCHECKED: the ship tick between the two portals. If the lab shows a lone swing portal re-bands, switch R to one W.
- **Portals on joins:** a wave or fly gravity portal goes where one movement of the path ends and the next begins
  (`joinNear`: in a fly, between two sweeps at least 3 columns long when there are some), at the corridor's middle height,
  never mid-leg.
- **Ball v3** (Evgeni: "the height of the gameplay is too similar ... more balanced across the y axis, in both
  directions"; "in the jumping modes, that the average length of movement is below the half of the full length"): moves
  of 2-4 rows (mean ~2.3 in the 8-row band), the height wandering over the band, pieces in the middle and masses only at
  the band edges. Against his drawing: cps 1.09, height changes 1.10, step 0.73, heights 1.13; middle pieces many more
  than his (11x share): open, maybe hold them to the floor or the bar. 12 of 12 solve.
- **Wave v2** (Evgeni: "a bit more veriaty on the screen, again a bit more split. and we can add 1 ground slide"): legs of
  every size (1-5 rows), short flats between some, one ground slide (the floor drops to the ground and the wave slides along
  it 4-7 columns), 13 rows with hidden wave portals (board letter A) moving the 10-block band with the corridor. 12/12 solve.
- **The three newest board sections** (Evgeni: "dont have the last 3 sections in the generator"): **spider corridors**
  (the ball's surfaces in a 9-row band, the next surface right where the last ends: the spider teleports), **ball portals**
  (the ball corridor, ~45% of flips made by a G / N at a surface's end), both via `rollers()` in tools/sectiongen.js, 12/12
  each; **orb gameplay** (cube over a spike floor, orbs in sets of yellow / blue / green and mixes, easy yellow only, each
  orb on the cube's own arc computed in the generator with GD's numbers -- the page can't run the sim --, a flip orb only
  where the flipped arc has a next orb, a blue at the end if the gravity is still reversed, the end platform where the
  last arc comes down). 12/12 solve.
- **Round 5 (Evgeni's 🎲 notes):** wave: the hidden band portals are gone ("no need portals inside the wave sections if they
  reach"); fly: valleys go down to the ground now and then, the ship slides along it ("the flying should also be able and hit
  the ground/floor as part of the path"); ball portals: each portal is the way past spikes (the surface runs 3 columns on
  past it with spikes, so not flipping there dies), portal flips ~30%; orb gameplay: a landing platform after every set of
  2-4 orbs where the arc comes down, the cube runs along it and jumps off its end; `make()` returns `zoom: 0.85` for a
  section over 12 rows (the builder zooms the camera out over it). Height spread over the whole band is the aim for every
  type (layoutcheck `spread`, tools/heightspread.js, target >= 0.6).
- **Tier extreme** (Evgeni: "lets increase the cps of harder ... or add 1 more level", "the wave seems a bit too hard for
  harder, too tight"): `extreme` (1.4) goes past harder on pace only (shorter runs, more presses a second); room --
  corridor gaps -- stops at harder's (`room()` in ctx). The wave's gap is now 6 rows (easy) to 5 (harder and extreme); it was 5 to 3 (Evgeni: "still too tight gaps, need bigger gaps, even for harder").
  The tier moves the layout (narrower gaps, shorter runs) but the difficulty model still rates most hard ones Easy. So
  the knob needs a stronger hard end per type, measured against layoutcheck's label.
- **Measured against his drawings** (Evgeni 2026-11-27: "the generator is bad, i compare the cps, the variaty, height
  changes, blocks in the middle. unparable. per section we will need to understand how to build a specific generator for
  that task"): `node tools/sectionstats.js <key> --gen N` scores his drawing and N generated ones on those axes (cps; height
  changes a second, step size, distinct heights; spread of press gaps and rests, distinct piece shapes; share and count of
  pieces floating in the middle) and prints generated / his per axis. Each type gets its own generator, tuned until the
  ratios sit near 1. **Ball, v2:** surfaces on alternate sides (floor and ceiling masses, and pieces floating in the
  middle), each one starting where a late flip on the one before lands (the ball's travel time across the height step),
  short / medium / long surfaces, spikes along the ground and under the ball band's ceiling (row 7: the band holds the
  ball, so an early flip must die there). Against his drawing (8 seeds, 34 columns): cps 1.03, height changes 1.00, step
  0.92, heights 0.91, press-gap spread 0.59, rest spread 0.64, shapes 0.88, middle pieces 0.63. 16 of 16 solve (34 and 90
  columns, easy and hard). Open: rhythm spread is still lower than his, and the hard end is still rated Easy.
- **Orb and pad sets** (Evgeni 2026-11-27, not needed yet: "set of yellow, set of blue (zigzag movement), set of green
  (forward movement but reverse) and a combination of any of those"; board section my-mwz2haf0 "orb gameplay", letters Y B
  E J K). As drawn the solver skips most orbs, so this type needs its orbs placed by the sim, each one the orb you must
  take: tools/clickfirst.js's build() places orbs that way for the ball, and is the start.
- Lengths measured on rated levels per type: how long one of these runs before the level changes it.

- **No spike walls; spikes stand on something** (Evgeni 2026-11-27, on the 🎲 ball and spider sections: "just blocking like that with a wall of spike is rough, lets place proper hazards, spikes not on the ground is bad"). A route is never closed with a long row of spikes. Use proper hazards instead: spike groups of 1 to 3, saws, or blocks with spikes on them. A spike always stands on the ground or a block, or hangs from a ceiling. It never floats in the air. This holds for the generators and for hand fixes on the board.

**The mode's band (2026-11-27).** A ball, spider or flying portal sets a floor and a ceiling around the portal (lib/physics.js
BAND: ball 240 = 8 rows, spider 270 = 9, ship / ufo / wave / swing 300 = 10). Entered from the ground, nothing above
that line is reachable; the spider's flip lands on the band's roof. Every generator keeps its play inside the band; the
board draws the line on each such section. A swing "taller than the screen" needs GD 2.2's portal free mode (no band),
which the sim does not have yet (PHYSICS.md open).

**Open from the whole-height round (2026-11-27):**
- **Holding is a secret way on flat cube runs** (GDLM 76 v1 judge, "Generate a new 1-minute level" thread): entrance,
  staircase and opencube at normal tier were played as one held press for 6-7 s, since a held cube jumps every flat-run
  hazard in a row. layoutcheck counts the natural plan's taps, so it doesn't see it. Fix in the generators: a hazard right
  after a landing at another height, low ceilings over some runs, gaps the held bounce overshoots; and a hold check.
- **Spider: top and bottom aligned** (Evgeni: "that alignment decides the difficulty in a way as a timing and cps"; "the
  platforms you jump still dont overlap in possible gameplay"): DONE 2026-11-27, each piece starts before the last ends;
  the overlap (3 columns easy, ~1 harder, +-1 now and then) is the teleport window. 11 of 12 solve (easy 80 cols seed 2
  dies on an end spike: open).
- **Stair path**: runs of jumps broken softly by a rest (a 3-wide way block, the next column 5 on): chance 0 / 0 / 0.25 /
  0.6 / 0.85 after 0..4+ hops (Evgeni: "max 3 jumps in a row", "when i say max, i mean distribute so that anything more
  much lower chances ... dont want to set hard limits"). Tall maps turn lower so a flip and back fits. 19 of 20 solve
  (40-90 cols, 13 and 19 rows; 90x19 harder seed 1 fails on a saw). Still open: blockers along the top, play reaching
  rows 0-1 and the very top (spread 46-79%), looser timing (Evgeni: "allowing more timing will need blocks not snapped":
  off-grid x as a per-tile dx, the board would draw it).
- **"Max" means a soft distribution** (Evgeni 2026-11-27): wherever he says "max N" (jumps in a row, orbs in a run), make
  longer runs much less likely, not impossible.
- **Speed (0.5x / 2x / 3x)**: the generators are built for 1x (tools/sectiongen.js COLS_PER_SEC = 311.58 / 30). At
  another speed every size in columns that comes from time (gap lengths, jump spans, flip windows, ball travel, spider
  overlap, beat columns) scales by the speed ratio, and heights don't. GD's 2x is only ~1.25x faster than 1x (lib/physics.js
  SPEEDS: x per tick 0.9 * 5.77 vs 1.1 * 5.87), 3x ~1.5x, 0.5x ~0.81x; jump height stays nearly the same. Not built yet:
  a `speed` option for GEN that scales those columns.
- **Ball, spider and ball portals taller than the band** (2026-11-27, Evgeni: "spider and ball still dont generate more
  than the original height regardless if i am in height x100"): a hidden ball (L) / spider (P) portal on a surface re-bands
  around it, so the band wanders the map; the ground spikes and ceiling bar follow the band. At 80 cols x 20 rows: 10 of 12
  solve, 25-75% of the rows (a random walk: more movers or a drift toward unvisited rows is next).
- **Cube types and wave at 2x rows** (2026-11-27): closecube's corridor steps a row up or down every 8-14 columns,
  wandering the map (80x16: 88-89%, was fixed at 5 rows); opencube climbs up to (rows - 2) / 2 platforms (80x16: 73-87%);
  staircase scales by itself (80x18: 50-82%); wave over 13 rows gets hidden A portals (80x20: 79-92%). All solve.
- **Flappy taller than 10 rows, presses first** (2026-11-28, Evgeni: "try to extend the generators to use full height when
  possible"): the taps' tour now spans the whole map; where the planned path comes within 2 rows of the ufo's 10-row band
  edge a U (ufo portal in a ufo, the band set again) goes on the path itself, so the poles' gap holds it. 24/24 plans clear
  at 14, 20 and 24 rows (40 and 80 cols); the path spans 8-12 rows at 14, up to 17 at 20, up to 21 at 24 (80 cols). The old
  shape-first version is `shape: true`.
- **Out of a flying section into a gated portal** (2026-11-28, lib/scenejoin.js): a section that ends flying in the open
  (no floor or ceiling at its exit, e.g. the tall swing's saw corridor 14 rows up) gets a descent in the join from its exit
  corridor's middle to the mouth, 1.5 columns a row, with a band mover of its mode (R swing, H ship, U ufo, A wave) every 3
  rows. The theme gallery clears again with it (107 presses).
- **Secret ways and skips** (2026-11-28, Evgeni: "be careful for secret ways and skipping the structures (in wave for
  example)"): `node tools/secretways.js` solves each generated section and compares the solver's route with the plan (SKIP:
  over a quarter of its route 3+ rows off the plan, or outside the map). First sweep, 44 sections at 60 cols: one real skip,
  the spider landing on bare ground in the column between two ground spike groups and tapping up from it (5 presses for a
  9-press plan); that column now holds a half-buried saw (ball, ball portals, spider: 0 of 18 flagged after). Fly, wave and
  flappy are often flown with far fewer presses on the same path (LOOSE: the corridor roomier than the plan's rhythm).
  Tightened 2026-11-28: fly and wave gap by tier 6 / 5 / 4 rows (was 6 / 5.5 / 5): the solver now needs 9-12 presses on
  60-col harder fly (was 8) and 8-10 on harder wave (was 6-9); every plan clears (fly 144/144, wave 90/90). What did not
  work: making every fly hold / release a real turn of 1-2 rows (under the gentle-angle cap each state ends at the cap,
  so every seed drew the same zigzag), a 3-row fly gap (still half the plan's presses: a ship hovers through quick taps;
  the plan's taps at harder are feathering, so the clicks a corridor really asks for come from its turns and its gap),
  and a tighter flappy gap (the same solver counts, one plan died). Also: a wave draw whose floor slopes at column 0 is
  drawn again (it died as it came in), a tall fly plan that slides the map's top is drawn again (the roof slopes there
  caught the ship), and the closer cube steps quicker over 12 rows (mean span of the path 3.7 -> 4.3 rows).
- **A minimum length per type** (Evgeni: some need room for real play, robot and orbs).
- Height at 1.5x rows, 60 cols (easy/harder, 2 seeds): wave 93%, fly 76%, ship corridor 80%, staircase 85%, closecube 80%,
  ball 75%, spider 67%, opencube 68%, flappy 60%, orbs 55%. The cube types need their climbs scaled to the taller map.

## Ideas for more sections (not drawn yet)
Evgeni 2026-11-27 ("lets remind ourselves more idea for sections, bit tired designing for now"):
- **ship orb play**: a ship corridor with orbs in it (yellow / blue / green) that are clicked while flying.
- **pads**: some pad addition (yellow / blue pads launching the player between platforms; in cube, ball and ufo).
- **duals**: two players, one button (dual portals; lib/dual.js): mirrored or asymmetric halves.
- **dash orbs** (Evgeni 2026-11-27: "we dont use dashes yet, that also adds a hold to the gameplay other than the flying and
  robot"): dash orb stretches (green / pink dash orbs: hold to dash at the orb's angle, release to stop), a hold in a
  jumping mode. The sim has dash orbs (PHYSICS.md; the props 586 / 588 on them unknown); beware dash-orb skips.
- **wall climbs** (Evgeni 2026-11-27: "going in reverse and forward from walls (climbing a tower for example)"): bouncing
  between two walls up a tower, the gameplay going backwards and forwards (2.2 reverse: the direction / reverse portals).
- **turns of the camera and the play** ("camera movement and movement change (for example 90 degree change of gameplay)"):
  a section that pans or turns the camera, or turns the gameplay 90 degrees (rotated gameplay 2900: lib/physics.js
  `frameWorld`, PHYSICS.md "Rotated gameplay"; the "Beat Dash with rotated gameplay" thread built a first one).
- **Duals from one click pattern** (Evgeni 2026-11-27): generate two sections, top and bottom, from the same clicks, in any
  modes; then make it a real asymmetric dual by removing some hazards on one side, so the path is forced by both
  gameplays together. lib/dual.js simulates duals (lab GDLM 63).

## Never a dying piece, sub-block offsets (2026-11-28)

- `sectiongen.make()` replays every presses-first piece in real physics (node: layoutcheck planCheck inside its joins) and,
  when the plan dies, makes it again from the next seeds (up to 8, `seedUsed`); the replay is the drawn path
  (`pathFrom: "replay"`). Still dying after 8: `planOk: false`, `planDies {col, row, why}`. `verify: false` skips it (the
  browser can't replay and keeps the first piece). Evgeni: "any failing generation of physics is obviously a bug".
- `z.offsets = {"c,r": [dx, dy]}` (units; c, r the section cell from the left and the ground): the cell's objects move by
  that much (make.js extra `dx` / `dy`; designthemes `withOffsets`, used by layoutcheck and typebuild). Blocks stay on the
  grid; spikes, saws, orbs and pads may move to centre a press's window or to sit where a wrong press lands.
- Flying on the grounds (my-mwz1s7po) is presses first: its holds are replayed in lib/physics.js through the bare corridor
  and the spikes go against that real path (the old stepper drifted after sloped floors); the browser keeps the shape-first one.
