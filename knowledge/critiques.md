# Critiques of GDLM levels (the ones Claude makes)

Style, difficulty and sync sessions: read this before making a level. Newest first.
Format: date, level + version, the user's words, what it means, what was done (commit/session).

## The look of GDLM levels in general
- 2026-11-23 (via the main session): "i want to get more realism, this is like 1.0 graphics. we need 2.2
  stuff and more". Measured: GDLM has ~1 object per block against 20-50 in 2.2 rated levels, no front
  layers, no object colour channels, no HSV, almost no triggers (`levels/modern_look.md`, recipe there).
  Passed to gd-style.

## How levels are shown (the viewer and the phone page, not a level)
- 2026-11-23, after watching GDLM 45 on the phone page: "The view is soso, bit crude." About the
  replay's look, not the level's design. Passed by the main session to the sync session (owner of
  the phone page, `tools/web.js`; the look is `lib/look.js`). Not yet acted on.

## GDLM 60 physics lab (a test course, 2026-11-23; practice, 26 attempts)

Measured, not said: the deaths in the user's one practice run (local/real_stats.jsonl; PHYSICS.md "GDLM 60").
- A plank row straight over a spike row, reached by a jump from flat ground with no cue: 7 deaths.
  Give a step up or a mark, or start the planks after a gap of ground.
- A solid post right after a dash orb's run: 5 deaths, the player held the dash into it. Show where a
  dash must end (open space, or a mark), never a wall the held dash flies into.
- The user on the ending: "the last sign is also bad" -- the signature figure reads as a white blob in the
  game (frame local/shots/lab60/signature_game.png; with visuals).

## GDLM 44 hellgate
- 2026-11-23, v12 (looking at round-1 frames): the orb chain over the spike run landed in a 2-column gap
  before a 2-high block -- "landing just behind a block is annoying, it's hard to aim the previous orb ...
  if I miss my timing I just die even if I land. When I'm landing or passing an obstacle, fair play is that I
  can continue somehow, not a dead end". Measured: the two jumps in that gap had 4 ms windows (orbs 29 ms).
  Done (v13): the landing block starts right where the spikes end, 1 high, 5 long: orb taps 196 / 217 ms,
  the jump off it 254 ms; score.js READY. Rule: after an orb, a pad or any obstacle, the landing is a
  surface the player can stay on across the whole range of early/late presses -- never a gap in front of
  a wall. "The marked jump is really annoying": the chevron sat on that forced gap jump (gone with it).
- 2026-11-22, v1: called "bland" (reported by the style session; the user's exact words are not here yet).
  Likely cause per knowledge/levels/good_low_tier.md: rated low-tier levels change mode/speed every 3-7 s
  with forgiving sections; v1 did not. Style session is acting on it (STYLE.md, style branch).
  2026-11-23 numbers (`levels/variety.md`): GDLM 41-45 use 1-6 kinds of gameplay thing (rated Easy/Normal
  15-17), one speed, few portals, and mostly repeated chunks. That points at sameness more than emptiness.
  Also (`levels/obstacles.md`): GDLM's cube parts have blocks in 13% of their columns (rated/official ~47%),
  and 92% of the spikes are on the bare ground: a flat floor, where rated levels play on ledges, steps and pits.
- 2026-11-23, v5 (recording 2026-11-23_02-51-50.mkv): "i just die in the entrance" -- of the wave.
  Both runs that got there landed the cube on the block before the wave portal (the sim's solution
  stays airborne into it), entered the wave without holding, slid on the block top and died at its
  end. Two causes: the sim let a wave slide off a block's end (fixed, PHYSICS.md "Wave"), and the
  design: a wave portal at the end of a block the cube lands on punishes the natural "enter, then
  steer" with a death 50 ms in. Lesson (design.md-worthy): a mode portal should not drop the new
  mode onto a corner; leave open air (or flat floor) after it so the first input can come late.

- 2026-11-23 ~03:39: "hell still doesnt work. something with slopes is akward" -- but the save still held v5
  (wave portal by the 3-high block; v6 was written to levels/ at 03:37, after the 03:35 install). The one
  attempt (03-38-03.mkv) died at the v5 block edge again. The slope complaint fits v5's zigzag: 71-88 ms
  turns and head-on slope deaths (PHYSICS.md "Wave"). v6 not played yet.

- 2026-11-23, v8 (with GDLM 46 v2; recording 03-50-48.mkv, local/real_stats.jsonl): beaten first try. The
  user's verdict on both levels, verbatim: "its playble. not great. gameplay meh. visuals still very bad
  obviously. indicator a bit too high over the ground; the second indicator is wrong, dont need to jump
  there; no indicator in some of the jumps; the exit with the wave, some slope issues, something wrong
  about blocks there; the triple orb in the end, feels very akward, if you just click normal you fall and
  die, cant adjust. i feel i mostly died deaths not really my fault (besides first click which is fine in
  its difficulty)". Layout fixes went to style and polish (physics session).

## GDLM 46 sketch
- 2026-11-23 (03-36-54.mkv): beaten on attempt 7. Deaths: first double spike x2 (late jump), ship part,
  the wave's last V before the exit portal (head-on into the rising floor), and after the wave exit: the cube
  must jump off the 2-high block within 42-171 ms of becoming a cube or it lands below a 3-high wall it
  cannot clear (a forced input right after a mode change, like GDLM 44's entrance).
- 2026-11-23, v2 (03-50-48.mkv): 12 attempts, 10 of its 11 deaths from the layout, not the player
  (physics session). The user's words are under GDLM 44 v8 (one verdict for both). What it means:
  - Jump indicators: one sat where no jump is needed (a wrong cue kills), some jumps had none, and they
    sit too high (~1.5 blocks; the user wants ~1).
  - The wave's exit: slopes and blocks there read wrong.
  - The triple orb at the end: a normal click falls to death and there is no way to adjust. The chain
    leaves no room to correct and carries the cube toward the screen's edge.
  - Positive: the first click is "fine in its difficulty": the hard part should be the player's skill,
    not the layout's traps.

## GDLM 42 seen then gone
- 2026-11-22, v1: whole phrases invisible -> "practically very hard, tons of learning, pure memory
  without visuals -- usually not fair unless you want it unfair". Done: ghosts (opacity 0.35) by default,
  fully hidden only for one already-seen chunk (STYLE.md "memory / invisible"). v3 easier for testing.
- 2026-11-22, v3 (recording): deaths at the first double and the platform after it (land-and-jump-again
  within 0-130 ms). Done: recovery gate in score.js, v4 spaced (commit 597c209).
- 2026-11-22, key bot run: bot printed CLEARED, the user saw it jump off the beat and die (CLAUDE.md status).

## GDLM 41
- 2026-11-22: two spots needed prejumps (off a staircase onto hops 2 blocks away; 2.4 blocks before a
  yellow pad) -> "not sightreadable". Done: tools/sightread.js, fixed version. "No triples" in v3 was
  only for testing, not a rule.
