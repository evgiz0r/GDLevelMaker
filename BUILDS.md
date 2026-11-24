# Builds: what each took, what broke, what to change

One entry per compose run (tools/compose.js writes the numbers; the session adds the change it made after
reading them). Targets: song 10 s, layout with its full plan 60 s, path (check solve) 15 min, final 20 min.
The stage times are also in local/timings.jsonl.

## GDLM 64 golden hour, 2026-11-24 00:37
- stages: song 0 s, layout 86 s, layout 474 s, path 1695 s, deco 1824 s, final 1824 s
- slowest step: path (1221 s); over target: layout 86 s > 60 s, layout 474 s > 60 s, path 1695 s > 900 s, deco 1824 s > 1200 s, final 1824 s > 1200 s
- result: not ready (timing, reactive), 8 round(s), variants: 2 section(s)
- change made: craft pieces out of sunrise / night run until their new shapes land (a 4 ms jump and jumps timed around a block came from the old slab-steps and pillar-climb); no automatic library picks for 64 (a UFO-orb piece tripped skips and added mode changes); intent verify allows 20 local repairs (the ship and wave plans start from another height than their cached tests) and reports where it stopped. Open: flying intents should be cached per entry height; the layout stage took 86 s (target 60), the alternatives 6.5 min, the rounds 20 min.

