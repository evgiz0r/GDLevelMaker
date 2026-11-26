# Thumbnails: a level -> its best-looking moment

`node tools/thumb.js <level> [--gif] [--size 1280x720] [--cands 8] [--at s] [--shapes]` (the user, 2026-11-25:
"Level -> thumbnail"). One picture of a level at a moment that shows it well, for sharing, the work board and level
lists; `--gif` adds a 3 s loop around that moment. Used by `tools/compare.js --thumbs` (COMPARE.md).

`<level>`: a .gdlvl, a GDLM name from the viewer's list ("GDLM 70", "candy"), `official:N` (PC), `save:<name>` (PC).

## How the moment is picked

1. **Level data, every half second of the route** (the saved route: `tools/solutions.js`, else the one embedded in
   `viewer/levels.js`; no route -> a ghost at the level's speed). What the viewer's camera has in view there (19 blocks
   wide, the player at 0.36 of it, as `viewer/index.html` places it): objects drawn (35%), kinds of object (30%), play
   near the player -- hazards, orbs, pads, portals in the next 10 blocks (20%) -- and a mode other than the cube (15%), each
   against the level's own 95th percentile. The first 1.5 s and the last second are left out.
2. **The best 8 moments at least 2 s apart are rendered** in one headless run of the viewer's shoot page (as
   `tools/shoot.js`): GD's own art when the game's Resources folder is on this computer, else the viewer's game look.
3. **Each picture is scored**: colourfulness (Hasler-Suesstrunk on rg / yb), contrast (luma spread), detail (share of
   pixels with an edge to the next sampled one), minus flatness (share of the most common colour bin). Picture =
   0.4 colour + 0.25 contrast + 0.35 detail - 0.3 flat, as ranks among the candidates.
4. **Final = 0.6 picture + 0.4 data** (ranks). The winner is copied to the outputs.

Outputs in `local/thumbs/<level>/`: `thumb.png` (the pick, --size), `thumb_small.png` (480 wide), `cands/` and
`cands.jpg` (every candidate, the pick framed in yellow: check the choice at a glance), `thumb.json` (every
candidate's numbers), `thumb.gif` with --gif (from 1.2 s before to 1.8 s after the pick, 15 fps, 480 wide, 128 colours).
ffmpeg makes the small copy, the sheet and the gif; without it only thumb.png and the candidates.

**Local only when GD's art is in it** (RobTop's art): never commit a thumbnail or put one on the public site. A thumbnail
of OUR level in the game look (`--shapes`, or a computer without GD) has none of RobTop's art and may be shared.

## Results

| level | where | time | pick |
|---|---|---|---|
| GDLM 70 candy night (69 s, ship / robot / ball) | cloud, game look, 1280x720, with --gif | 9.8 s | 50.5 s, a ship corridor under a block ceiling; the sheet's ball-and-orb frames scored lower on detail |
| GDLM 41 classic (17 s, cube) | cloud, game look | 6.3 s | 6.5 s, the busiest stretch (27 objects in view vs 2-16 elsewhere) |

On the PC each run also waits for the heavy-job slot (a headless browser, ~1 GB) and draws with GD's art (slower to load).

## Open

- The detail score likes block grids: a corridor under a ceiling of outlined blocks wins over an orb jump with a trail.
  A bonus for action on screen (a press, an orb or portal hit within 0.3 s, the player in the air) would pick livelier
  moments; not measured yet.
- No check against what the user would pick: ask him to choose between 3 candidates for a few levels and fit the weights.
- A GIF of 45 frames at 480x270 is ~2 MB; fewer colours or a shorter loop if that is too big for where it goes.
