# How levels get rated: Rated, Featured, Epic, Legendary, Mythic

What it takes for a level to be rated, and what the higher tiers mean. Three kinds of facts, kept
apart: what RobTop's own documents say, what the community wiki records, and what our measured
sample shows.

## RobTop's own documents (read 2026-11-23)

Sources:
- *Geometry Dash Rating System*, https://robtopgames.com/files/GDRating.pdf
- the official FAQ, https://www.robtopgames.com/faq/en/answers/level/

What they say:
- **No fixed criteria.** There are "no specific guidelines" for what makes a level rate-worthy;
  it is decided case by case. The developer rates levels himself, and the tiers go "in increasing
  order of how much RobTop likes your level".
- **The tiers**: Rated, Featured, Epic, Legendary, Mythic. Creator points are 1 to 5, one per step.
  All but plain Rated show on the Featured tab. Placement on that tab is set by hand, by
  "recency, playability, optimization, and more" (FAQ).
- **The general tips** are the closest thing to criteria:
  - At least 30 s long. 60 s or more ("Long") is "the length standard for rated levels".
  - "Clear gameplay and decent visuals", while "a wide variety of styles" have been rated.
  - It must run well. Lag from too many objects can block a rating "or lead to a lower rating
    tier". Optimise: don't waste objects, use triggers smartly.
  - Follow the upload guidelines.
  - Get feedback from experienced creators and from comments. Improving on it raises the chance.
- **Sends**: Moderators can suggest ("send") levels to RobTop, and he often rates sent levels. A
  send is not required, and no particular number of sends is needed. Many moderators give
  feedback through "level request" servers.
- **Stars per face**: Auto 1, Easy 2, Normal 3, Hard 4-5, Harder 6-7, Insane 8-9, Demon 10. The
  requested stars are only a suggestion.
- **User coins** must be a real optional challenge, for example on a harder hidden route. Coins
  that are too easy, such as free ones at the end, may stay unverified.
- **After rating**, big changes, especially to difficulty, are not allowed. A level may be
  reverted and locked; updates lock 7 days after the rating (FAQ).

## The community wiki (https://geometrydash.wiki.gg/wiki/User_Levels, read 2026-11-23)

- Upload rules it reports: a level shorter than 10 s, or with fewer than 2,000 objects, "may be
  deleted", though many such levels remain.
- Firsts:
  - First Legendary: Coaster Mountain, a platformer.
  - First classic Legendary: And Ever (Easy Demon).
  - First non-Demon Legendary: Subwoofer Lullaby (Harder). In our comment study it is also the
    example of "beautiful but weak gameplay" (`players_say.md`).
  - First Mythic: The Towerverse, a platformer.
  - One level has been downgraded from Mythic to Legendary (Tears of Denial).
- Community sites describe Featured as recognition of quality and Epic, Legendary and Mythic as
  rarer steps above it. None publishes criteria per tier. These are interpretation, not official.

## What our sample shows per tier (measured, 2026-11-23)

The 91 most-liked rated Easy-Harder levels (`levels/low_tier_stats.md`), from
`tools/community.js measure` and `tools/variety.js community`. Columns are medians:
- **play%**: gameplay objects as a share of all objects.
- **move**: number of move triggers.
- **toolbox**, **unique**, **modes**, **speeds** and the per-minute columns: as in
  `levels/variety.md`.

| era, tier | n | s | play% | move | toolbox | unique | portals /min | modes | speeds | orbs+pads /min |
|---|---|---|---|---|---|---|---|---|---|---|
| 2.0-2.1, Featured | 26 | 69 | 17% | 142 | 17 | 100% | 27 | 5 | 3 | 30 |
| 2.0-2.1, Epic | 37 | 65 | 12% | 276 | 22 | 93% | 38 | 5 | 4 | 53 |
| 2.2, Legendary | 18 | 89 | 3% | 594 | 20 | 99% | 26 | 4 | 3 | 25 |

- **Higher tiers go with more decoration and effects**: gameplay drops from 17% of the objects to
  12% to 3%, and move triggers double at each step. That fits "decent visuals" and "how much
  RobTop likes it".
- Epic levels in 2.0-2.1 also have more gameplay variety than Featured ones: more kinds of thing,
  more portals, nearly twice the orbs and pads.
- Legendary's layout numbers are understated: 2.2 levels move their gameplay with triggers.
- **Players push back when gameplay loses out**: the most repeated complaint about top-tier
  levels is beautiful visuals with weak gameplay (`players_say.md`).
- Every rated level in the sample is 60 s or more (median 65-89 s), matching RobTop's tip.
- The sample is the most-liked levels, so it favours old, famous ones.

## For GDLM

- **Length**: GDLM 41-44 are 12-31 s long. That is under RobTop's 30 s minimum except GDLM 43,
  and every one is under the 60 s standard. Only GDLM 45 (60 s) is a rated-level length. The wiki
  also reports that levels under 10 s or with fewer than 2,000 objects may be deleted. Aim for 60
  s+.
- **Featured is the realistic bar**: clear gameplay first, then decent visuals, and it must run
  well. The gameplay targets are in `levels/variety.md` (the Featured row matches those targets).
- Higher tiers ask for much more visual work: decoration, move triggers, effects. Keep gameplay
  first.
- User coins, if any: a real optional challenge on a harder route, never free.
