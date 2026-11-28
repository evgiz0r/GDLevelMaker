# Visual judge: a vision model reviews contact sheets (trial 2026-11-28)

How: `node tools/shoot.js <level> --every 2 --trail --label --out <dir>` (route drawn on: 2 s behind solid yellow,
2 s ahead dashed, a pink dot per press; ~30 s for 30 frames in the cloud, look render, no GD art), then
`python3 tools/contactsheet.py <dir> <prefix>` (3x3 tiles, time stamped), then one model call with the 4 sheets
and a fixed prompt (categories: missing 3D, background hiding the path, broken joins, holes, clutter, plain
transitions, indicator direction, route skipping a structure, odd portals, short / repetitive sections).

## Trial on GDLM 78 two moons rising (the version Evgeni played), blind vs his notes

His notes a picture could show (7): the 6.5 s wrong path (ship under the corridor), dead time / short sections,
weird portal pairs, structures open top/bottom (secret ways), the stairpath's first-jump hole, indicators pointing
wrong, transitions not special.

| | Haiku 5.5 | Sonnet 5.5 |
|---|---|---|
| hits | 3 of 7: dead time (4-6, 54, 66 s), the stacked / paired portals (48, 62-64 s: his "weird dual portals"), plain transitions (16, 52-56 s) | 3 of 7: dead time (4-6, 16-18, 46-50, 54 s), unclear portals (14 s), plain / abrupt transitions (6, 24 s) |
| missed | the 6.5 s wrong path (visible in the 8 s tile), secret ways, stairpath hole, indicators | same; it looked at 6 s and called the portal pair fine |
| false or unusable | ~3 of 13: one time misread (28-30 s is the 48 s tile), ring clutter it itself says is a render artifact, the quiet ending | ~3 of 16: "nothing to do 0-4 s" (there are spike pits), "ending plain" (the quiet sign is by rule), some taste calls |
| extra, plausible | floating fragments (14, 18 s), flat block shading, low contrast on gold diamonds | rough stair join (8 s), flat top slab (10 s), backdrop competing with route (12-26 s) |
| cost per review (API) | ~7k in / ~1k out: ~$0.001 | ~$0.02-0.04 |

Neither caught any Hellgate-card kind of mark directly (no Hellgate run); both commented on 3D / shading in general.

## Verdict

Useful as a cheap WARN in tools/report.js (Haiku: dead stretches, stacked portals, plain transitions, clutter), never a gate:
it misses path bugs, indicator direction and holes -- small things at 640 px a tile. Those stay with the geometry checks
(outside.js, skippress.js, judge.js). To try next: full-res crops at each section seam and each portal (not every 2 s),
GD art renders on the PC, and asking for the path in the crop explicitly ("does the line pass inside the corridor?").
Not wired into report.js yet.
