# Critiques of GDLM levels (the ones Claude makes)

Style, difficulty and sync sessions: read this before making a level. Newest first.
Format: date, level + version, the user's words, what it means, what was done (commit/session).

## How levels are shown (the viewer and the phone page, not a level)
- 2026-11-23, after watching GDLM 45 on the phone page: "The view is soso, bit crude." About the
  replay's look, not the level's design. Passed by the main session to the sync session (owner of
  the phone page, `tools/web.js`; the look is `lib/look.js`). Not yet acted on.

## GDLM 44 hellgate
- 2026-11-22, v1: called "bland" (reported by the style session; the user's exact words are not here yet).
  Likely cause per knowledge/levels/good_low_tier.md: rated low-tier levels change mode/speed every 3-7 s
  with forgiving sections; v1 did not. Style session is acting on it (STYLE.md, style branch).

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
