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
- **Gravity portals** (board pieces G 🟡 upside down and N 🔵 back, ids 11 and 10; Evgeni: "i need also reverse gravity
  portals in the layouts") turn any type upside down for a while. The mirrored motif repeats there, then an N brings
  gravity back. In a corridor, a flip mid-motif reads well. A flip right before a jump does not: no input may be forced
  right after a portal (DIFFICULTY.md "Fairness").
- **A portal sits in the middle of its corridor**, across the band the player flies or runs in, so no path goes around it
  (Evgeni 2026-11-27: "the portal should be not in the middle of the screen but in the middle of the corridors (
  everywhere )"). The solver's route must pass through every portal (tools/layoutcheck.js shows it).
- **Upside-down stretches get the mirrored obstacles**: if the floor has spike pits, the ceiling the player runs on upside
  down gets pits too (Evgeni on closer cube: "wierd assymery with the spikes on the grown on the bottom but no such on the
  top").

## The types (the board's examples)

| type | mode | idea | motif | change it by | longer looks like |
|---|---|---|---|---|---|
| entrance | cube | up a ramp onto the level's blocks, then a first spike and a small pit | ramp + flat + one hazard | ramp height (3 rows by default, tools/startramp.js) | not used long: an entry only |
| staircase | cube | climb, then step down | a step up of 1 row, 4 wide | step width 3-5, a spike or saw on some landings | more steps, a flat landing every 3-4 steps |
| open cube corridor | cube | a floor with pits and nothing overhead; platforms float in the middle | a floor run + a pit (2-3 wide spikes) | pit width, a platform over the pit | the run lengths change, platforms at 2 heights |
| closer cube corridor | cube | the ceiling comes down to 4 rows over the floor and hangs spikes | a floor spike or pit + a hanging spike, out of step | the gap from floor to ceiling, a block pushed down from the ceiling | the ceiling steps up and down by 1 |
| hanging structures | cube | structures hang from the top over a floor with spike pits | one hanging mass + a pit under or between | mass width and depth, its hanging spikes | more masses at different heights, holders from the theme |
| flying corridor | ship | a floor and a ceiling that rise and fall together | a hill: slope up, flat, slope down | hill height 1-4, a saw in the gap | hills of changing height; a long ship stretch is fine |
| wave corridor | wave | a 45-degree zigzag tunnel whose ceiling is its floor lifted (tools/layoutsections.js tunnel) | one leg up + one down | leg length (slow 5-6 blocks, quick 2) | slow legs, then a quick middle, then slow again |
| flappy bird corridors | ufo | pipes from the floor and the ceiling with a 4-row gap at changing heights | one pipe pair | the gap's height, the spacing | the gap height walks up and down |
| ball corridors | ball | floors and ceilings at several heights; the ball flips from one to the next | a floor run then a ceiling run | run length, height step | more levels, a spike under each switch |
| stair path (his) | cube | a lattice of single blocks: many paths in theory, every wrong one blocked by a hazard | a column of blocks 3 apart; each hop up 2 or down 1 | which block of each column stays clear | more columns; the clear route climbs and falls |
| swing (his) | swing | round movement: a big up-and-down corridor whose sides are curves, not slopes or blocks | one wave of the path (3 rows up and down, about 18 columns) | amplitude, period, the gap | waves of changing size. Ship can use it too (Evgeni: "the swing ( and the ship in a way, can do big up and down patterns )") |

## How to test a section

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

## Open

- A section generator: type + length in beats + song section -> a section like these, its motif varied as above. Nothing
  builds one yet. tools/clickfirst.js (clicks first) and the wave's tunnel() are the closest pieces.
- Lengths measured on rated levels per type: how long one of these runs before the level changes it.
