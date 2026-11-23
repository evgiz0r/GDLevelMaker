# TASTE -- what makes our levels look and play well, learned one level at a time

Owner: the showcase session (started 2026-11-23). The user: "we will iterate over creating new levels,
find new ways, gain taste." Each round makes one level (or a v2) and tries **one new approach** (a new
structure, theme, mode mix, sync idea, or way of telling a scene), then compares it side by side with
real rated levels in GD art and writes down what worked and what did not. This file accumulates; read
it before making or judging a level (with `knowledge/design.md`, `knowledge/critiques.md`,
`knowledge/checklist.md`, SHOWCASE.md for the scene recipes and STRUCTURES.md for gameplay pieces).

Every level of the loop: its final name before it is ever uploaded (names never change after upload,
PUBLISH.md), the signature at the end (make.js adds it), every gate of `tools/score.js` passed. Never
uploaded or installed by this loop: the main session does that on the user's yes.

## How a round is judged

1. **Side by side in GD art.** `node tools/shoot.js <level> --at ...` for our level and the same kind
   of moment of a rated level (official: `official:N`; community: `local/community/<id>.gdlvl`,
   never committed). Same moments: the opening, a mode change, the drop, a busy part, the end.
2. **Numbers** against rated levels: `tools/modern_look.js` (objects per block, layers, colour,
   triggers), `tools/variety.js` (kinds of thing, modes), `tools/score.js` (gates, windows).
3. **What the user says** once they play it (knowledge/critiques.md, local/real_stats.jsonl):
   that outranks everything above.

## Rules of taste so far (each with where it came from)

- **One idea carries a level.** A single motif on the screen all level (GDLM 50's eclipse, ~17
  objects) did more than thousands of scattered deco objects. (Round 0.)
- **A palette per section, switched at the portal**, is the cheapest strong effect; an instant switch
  on the drop is the moment, slow fades (3-6 s) tell time passing. (Round 0.)
- **Dress the gameplay blocks as part of the scene** (dark fill, lit edge): they stop looking like
  default blocks without extra art. (Round 0.)
- **Sparse where it matters**: the most striking section of GDLM 50 had the fewest objects. (Round 0.)
- **Never put shapes that read as hazards near the path** (crosses as stars next to an orb, art
  clouds with black outlines over a tunnel). (Round 0.)
- Our view shows ~7.5 blocks above the ground in a cube part: tall background things hide the sky.
  (Round 0.)
- **Calm, not flashy; hazards first.** The user on a modern-look level (GDLM 44 hellgate, polish's
  pass): "waaaay too flashy. the contrast between the objects is bad, hard to tell what kills you
  what not." So: pulses only on bar starts (or rarer), a soft swell towards a lighter tint of the
  same colour, never to white and never on every beat; at most one sky flash in a level, on its main
  drop, and not to white; the gameplay blocks' edges do not pulse. Hazards stay the brightest,
  most outlined things on the screen: no deco in their colour or brightness (white stars, motes,
  corona or bubbles next to white spikes). GDLM 50 v1 pulsed the block edges white on every beat
  through totality and flashed the sky white twice; v2 is calm. (Round 0/1, 2026-11-23.)
- **Shapes that read as gameplay are out**, however pretty: thick white rings (236 at scale 0.5+) as
  bubbles read as orbs; a ball shape plus a square (51, 148) read as a cup next to the path. Use thin,
  small, dim versions, behind the play. (Round 1, first render of GDLM 51.)
- **Things placed high must be under ~7 blocks** (225 units) to be seen in a cube part: GDLM 51's eyes
  in the dark at y 235 never showed. (Round 1.)
- **A route check needs the human route too**: score.js's `skips` gate follows the solver's run, which
  went through GDLM 51's last cube portal while the natural replay flew over it. Frame a flying mode's
  exit portal on all sides (a roof AND a wall up to the top of the band). (Round 1.) Done: the skips gate
  now runs the player's route as well (style, 2026-11-23), and so do "player timing", "reactive" and
  "hazards matter".
- **Symmetry = good** (the user on GDLM 45: an orb over the 2nd of 5 spikes, "it's not pretty that the
  orbs are not symmetrical to their structure"): an orb centred over its spike row, pairs mirrored; when
  the timing wants it off-centre, change the structure. make.js centres orb-pit orbs; score.js "symmetry".
- **Height changes, little repetition** (the user on GDLM 47's upside part: "all in flat area. no change
  of height really ... robtop levels do show decent change of height"): official levels change the floor
  ~13.6 times per 10 s of jumping play over a ~7-block range, ~28% of it on the bare floor, and hardly ever
  repeat a 4-move pattern within 10 s; GDLM 47 had 7.5, 3 blocks, 54%, 17%. STRUCTURES.md "Height and
  repetition"; score.js "height" / "repetition"; tools/flow.js.
- **Reactive, not memorised**: every jump cleared on reaction with room to land; no step 2-5 blocks after
  a spike, no lone landing block, no jump over a spike that must also be timed around a block (the user on
  GDLM 45 and 47). checklist.md; score.js "reactive".

## Rounds

### Round 0 -- GDLM 50 eclipse (cube / ship / cube / wave / cube, Easy, 37 s)

New approach: a scene built by hand with one fixed set piece (the sun and moon locked to the
screen) and a palette per section. Details, numbers and what did not work: SHOWCASE.md.
Gameplay was flat in the user's sense: cube on the ground, ship, wave. No gravity, orbs other than
yellow, UFO, robot, spider, swing or mini.

### Round 1 -- GDLM 51 adrift (in progress)

New approach: **a journey told by depth instead of one set piece**, and **motion that loops** (bobbing
jellyfish, swaying kelp, fish swimming past, bubbles) where GDLM 50 only moved things one way. Gameplay
made from style's ranked structures (STRUCTURES.md) to stop playing flat: UFO, upside-down cube with a
gravity portal, blue pads and green orbs, robot, mini ship, a pink pad. Song: balderdact - Adrift
(chillstep, 133 BPM): the level starts 4 bars before a drop, the song's break is the dark sea floor,
its next drop is the rise to the surface.

## Open questions (things to try in later rounds)

- Swing (the solver plans it now), spider, dual, speed changes as part of a scene.
- A level whose gameplay itself tells the story (the path goes somewhere), not only its background.
- Sync ideas: a section that plays on the song's melody, not its beat.
- Compare with what the user actually plays: their favourites' look vs ours.
