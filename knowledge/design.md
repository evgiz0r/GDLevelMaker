# What makes a GD level good -- general knowledge

Not one person's taste: what holds across good levels and what players at large call fair or
unfair. Each point says where it comes from (community consensus with a source, measured from
official levels, or a playtest remark). A single playtest remark is evidence, not a rule.

## Fairness
- **No prejumps**: a jump committed in the middle of nothing for something far ahead is not
  sight-readable; widely called unfair. (Playtest of GDLM 41/42, 2026-11-22; `tools/sightread.js`.)
- **Invisible parts need a cue**: whole blind phrases are pure memory without visuals -- unfair
  unless the level is meant to be. Show first, then hide. (Playtest of GDLM 42 v1, 2026-11-22.)
- **Recovery time**: landing and having to jump again within ~100 ms is where people die.
  (Real-game deaths, GDLM 42 v3; score.js recovery gate.)
- **Orbs where the arc already goes** (lower tiers): an orb at the top of the arc that reaches
  it is taken by a press in the middle, or by holding (buffering); an orb the arc only grazes needs
  exact timing and feels awkward. (The user on GDLM 44's orb ladder, 2026-11-23.)
- **Telegraph what can't be read in time**: a jump whose reason is out of sight or far ahead (off a
  ledge or a high step onto something past the landing, right after a portal, the first of a new
  pattern) gets a small arrow over the takeoff area, pointing at the ground: "in the area vaguely
  you have to jump" (the user). Modern levels use them there, not on every click. The mark is anything
  small and softer than the level (dimmer, muted) and never hazard-like: arrows usually, but
  circles, dots, small deco, even smileys are all used (the user). Better still,
  give room: after a drop from height h, nothing may need a jump before the cube has landed and
  seen it. (GDLM 45 v4: the user died 3 times at the same spike-block right past a 3-high stair,
  "cant tell where to jump", recording 2026-11-23 02:52; tools/decorate.js jumpIndicators,
  compose.js landing room.)

## Difficulty
- A per-level choice, not a house style. Good hard levels are wanted by players.
- **For now: start at the lower tiers** (Easy -> Normal -> Hard -> Harder, then up), not jumping
  high. Reason: the levels have to be playtested in the real game, and the harder tiers can't be
  playtested yet. A practical limit for this stage, not a taste (2026-11-22).
- Targets per tier (inputs/s, windows under 150/100 ms, tightest window): DIFFICULTY.md,
  section "Tier ladder (targets for making levels)" -- the one copy, not repeated here.
- Land-and-jump chains are fine when rhythmic (60-90 in every early official level), a wall
  when unexpected (GDLM 42) (difficulty session, measured).

## What to study
- Learn mostly from **good levels** (what makes them work), much less from bad ones (2026-11-22).

## From creator guides (sourced, read 2026-11-22)
- **Ratability** (RobTop, https://robtopgames.com/files/GDRating.pdf): at least 30 s, 60 s+ better;
  "clear gameplay and decent visuals"; runs well. Stars per tier: Easy 2, Normal 3, Hard 4-5,
  Harder 6-7, Insane 8-9.
- **Variety** (GJGuide lesson 12, https://a-zalt.github.io/gdknowledge/assets/GJGuide_new.pdf):
  the top tip is to avoid repetitive gameplay (a jump every five seconds, long strings of orbs).
- **Reaction time** (same guide): give time to react, no sudden moves, and don't depend on
  memory: the creator knows the level, a first-time player does not. (Agrees with "show first, then hide".)
- **Sync** (same guide): gameplay sits on the beat. Fast songs get fast, mode-changing play;
  slow songs get calm play. Jumps rise with the music and falls come on quiet parts. Its example
  is Stereo Madness's ship at the build-up.
- **Teach, test, twist** (GD Creator School,
  https://www.gdcreatorschool.com/docs/guides/gameplay-2/game-design-1-level-design/):
  start simple, at most two mechanics at once in most places, grayblock (build the gameplay)
  before decorating, playtest. Sharp shapes read as danger.
- **No fakes at low tiers**: Back On Track's fake pads are why it is "controversial" as an Easy (wiki).

## From players' comments (91 rated levels, `players_say.md`)
- Strongest complaint: beautiful levels with weak gameplay. Gameplay first.
- Late difficulty spikes make a rating feel wrong. Keep it even.
- Named annoyances: random speed changes, rapid gravity flips, long mini wave, short dual parts,
  hazards that look like orbs.

## Easy sections, per mode (`levels/modes_low_tier.md`)
- Start each new mode or speed with an empty lead-in (cube ~6 blocks, ship ~8, others 2-3). Hard has none.
- Hazards in at most ~1/3 of the columns (cube/ship/wave), ~1/2 (ball/robot); cube groups of up to 3,
  with 3+ empty columns between them.
- Not much emptier than that, though: across a whole rated Easy/Normal level, hazards sit in ~46-49% of
  the columns. GDLM 41-45 have 12-23%, emptier than rated Easy (`node tools/tiercheck.js`). That may be
  part of "bland".

## Not bland (`levels/variety.md`, `node tools/variety.js`)
- Rated Easy/Normal (2.0-2.1) levels use ~15-17 kinds of gameplay thing, 4-5 modes and 2-3 speeds,
  a portal every ~2-3 s, ~25 orbs and pads per minute, and ~90%+ new chunks.
- GDLM 41-45 use 1-6 kinds, one speed and few portals, and mostly repeat chunks: sameness, not
  emptiness, is the likely "bland".

## Built on blocks (`levels/obstacles.md`)
- Rated and official cube parts have a block in ~half their columns, and ~45-65% of their hazards
  sit next to a block (ledges, steps, pits, overhangs). GDLM 41-45 have 13% and 17%: spikes on a
  flat floor.
- Rated Easy/Normal levels bring in a new kind of thing every ~2 s until ~85% of the level, each shown
  once or twice before moving on. Official 1-8 do it every ~4.6 s.

## The modern look (`levels/modern_look.md`)
- 2.2 rated levels have 20-50 objects per block (GDLM: 1), half behind the play and a quarter in
  front. Every object has a colour channel, HSV on ~40%, and ~24 triggers per second of play.
- Dense opening, quiet transitions, the biggest effects at the drops, a new look per section.
  Gameplay stays readable.

## No forced input right after a mode change (real-game deaths, physics session, 2026-11-23)
- GDLM 44: a wave portal at the end of a block (4 deaths). GDLM 46: the cube leaves the wave above a
  3-high wall and must jump within 129 ms. Both force an input right at a portal: give room after it
  (the lead-in rule in `levels/modes_low_tier.md`).
- A 45-degree wave zigzag whose turns come less than 100 ms apart kills a player who releases at
  the wrong moment, because diving head-on into a slope is a death. Keep zigzag turns wide at low
  tiers.

## Cues and orb chains (the user on GDLM 44 v8 / 46 v2, 2026-11-23; physics session)
- **A jump indicator (arrow) only on a real input.** A wrong one causes deaths, and a missing one where
  others are shown is a trap too: cue all of a kind or none.
- Indicators about one block above the surface, not 1.5 (the user). Rated levels agree: hint arrows
  sit a median 1.0 block up, right at the press (the hazard ~0.5 block ahead; GDLM 46's were 2.5
  before it). See `levels/obstacles.md` section 4.
- **An orb chain must leave the player a way to correct**: no chain where a normal click falls to death,
  and no chain that carries the cube to the screen's edge.
- **The floor right before a mode portal: flat and readable.** (See also the section below.)
- Deaths should be the player's fault: the user accepts a hard first click, not layout traps.

## Orb chains, measured (`levels/obstacles.md` section 5)
- In rated Easy/Normal levels 3/4 of the orbs stand alone; chains of 3+ are ~8% of the orb groups.
  Chains climb ~1 block in all, ~3 blocks apart, with a safe surface ~1 block after the last orb.
  GDLM 46 v2's triple climbed 4.3 blocks with no landing for 5: "cant adjust".

All the targets in one list: `checklist.md`.

## Getting rated (`rating.md`)
- RobTop has no fixed criteria. His tips: 60 s+ (30 s minimum), "clear gameplay and decent
  visuals", and good performance. Higher tiers mean he likes the level more, and in our sample
  they carry far more decoration and effects.

## Past Harder (`levels/official_09-22.md`)
- The official levels add 2-6 new mechanics per level and cut sections to 20-150 blocks. A new mode
  comes in a spacious part first (Blast Processing's wave). Fakes and invisible parts appear only at
  Demon, and even then with cues (arrows, stars, text).

## Music
- Levels follow their song; how closely varies. Official levels put portals on bar starts and
  phrases, orbs loosely on beats (SYNC.md, measured).

## Structure and decoration
- See STYLE.md (measured on official levels): introduce then twist, hardest part last, rests,
  decoration grows with the era.

## Reference levels
- The low-tier ramp: `levels/official_01-08.md` (one new idea per level; density goes up and rests down).
- Good community levels per tier, with IDs: `levels/good_low_tier.md` (why each is good is still to study).
- 91 rated levels in numbers: `levels/low_tier_stats.md`. Hard is the big step; many modes at every
  tier; fast speeds are short and empty; ball/spider/robot are the dense modes.
- Memory / invisible / repeating / synced: Pattern Seeker. Also named: Deathmoon, Clutterfunk, Deadlocked.
