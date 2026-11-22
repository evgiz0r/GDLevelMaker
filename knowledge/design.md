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
