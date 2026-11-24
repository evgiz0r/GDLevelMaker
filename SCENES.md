# SCENES -- planning a level as a journey of little places that change with the song

Owner: the showcase session (started 2026-11-23). The user, after playing rated illustrated levels:
each section is "a little place that changes with the song (graveyard, then factory, then forest)";
ours "change colour and mode but don't tell anything" -- "why are we so far from this kind of quality?"

The section planner turns a song's structure into that plan, before any block is placed:

```
node tools/scenes.js <song> [--from-bar B] [--bars N | --secs S] [--theme haunted|ocean|sky|meadow]
                     [--brief briefs/NN_name.json --name "GDLM NN name"] [--json]
```

It prints one row per section (bars, seconds, energy, role, place, mode, palette fade, camera, props,
effects); `--brief` writes a compose brief (tools/compose.js) whose sections are the plan's, in beats,
with modes and colours, and the whole plan under `scenePlan` for the scene script and the props
(gd-art session, `tools/props.js`, when it lands). `--json` keeps the plan in `local/plans/`.
It needs the song's analysis (`node tools/songmap.js --songs`, SYNC.md section 7).

## The rules (each one is in tools/scenes.js; change them there and here)

1. **Boundaries** = the song's own section changes (songmap: drops, breaks, changes) inside the part of
   the song the level uses, then 4-bar phrases for any stretch of 8 bars or more, no section under 2
   bars. A new place every ~4 bars (~7 s at 133 BPM). (Spooky Dash changes mode every ~5 s: see below.)
2. **Energy** 0..1 per section = 70% loudness + 30% beat clarity, ranked within the level's own range.
3. **Roles**: the first section is the intro; the song's drop, or the first loud phrase after a quieter
   one, is a **drop**; the loud phrases after it **ride** it (intense, another mode and place: four
   drops in a row read as one long one); a quieter section after a drop is a **breather**; the
   section before a drop that rises (or is mid-loud) is a **build**; the last is the **outro** unless
   the level ends on a drop (then the signature follows it); everything else is a **groove**.
4. **Places** come from a theme pack, ordered from calm to climax (`calm` 0..1): the intro takes the
   calmest, a drop the most intense, a ride the next, a breather a quiet one, a build one in between;
   never the same place twice in a row, a place used before costs extra, and the outro returns to the
   first place (the journey home). Each place has a mood, a palette (bg, ground, block fill, block
   edge, accent) and props.
5. **Modes** follow the energy (Easy/Normal): intro cube; groove cube / ball / robot / upside-down;
   build ship / UFO; drop wave / fast cube / ship; ride upside-down / ball / UFO / robot; breather slow
   cube / robot / upside-down; outro cube. Never the mode just before, and a mode the level has not
   used yet first (the user: our levels play flat).
6. **Transitions** on each section's first bar: the palette fades instantly into a drop, over a bar
   into a build, two bars into a breather and the outro, half a bar otherwise.
7. **Camera and effects**: zoom out (0.85) on a drop, in (1.1) on a breather; the level's ONE sky tint
   shift on its biggest loudness jump, towards a lighter tint of the place's bg, never white (TASTE.md:
   calm, hazards first); props move on bar starts in drops; parallax speeds up in builds; breathers
   get fewer props and slow motion.

## Theme packs (tools/scenes.js THEMES)

haunted (graveyard, church ruin, dark forest, haunted factory, pumpkin field), ocean (sunlit
shallows, jellyfish drift, current reef, abyss -- GDLM 51 adrift's places), sky (dusk city, cloud
layer, space, dawn -- GDLM 50 eclipse's), meadow (meadow, orchard, windmill hill, sunset lake). Generic
GD-world places, nothing copied from a particular level. Add a pack: a mood and 4-5 places with calm,
mood, palette and props.

Check: run on the two songs our hand-made scene levels used, the plan comes out close to what was
made by hand (Uxvellda's Eclipse: dawn city cube -> clouds ship -> space wave on the drop -> rides;
Adrift: graveyard intro -> drop -> rides -> a breather on the song's break -> the last drop).

## What a rated illustrated level does (Spooky Dash, 150941693, local/community, never committed)

Measured from its objects (2026-11-23): 70 s, 30,907 objects; a mode portal every ~5 s (14 in all:
cube, robot, ship, UFO, ball), speed portals 2x and 3x four times, gravity flips in four places. So its
places change faster than our 4-bar default and carry speed changes too -- the planner's phrases may
want 2-3 bars at high energy (open). Its frames: the user's recording 2026-11-23_20-41-39.

## First planned level vs Spooky Dash (GDLM 52 necromancy, 2026-11-24)

GDLM 52 necromancy (song 216300, haunted theme, 61 s): `tools/scenes.js` -> `tools/planlevel.js` ->
`tools/scenes/planned.js`, gameplay from ranked structures, props from lib/props.js. score.js READY (0 fail),
Easy, tightest window 138 ms, sight-readable, every portal on the path. Side by side with frames of the user's
Spooky Dash recording (sheets: `local/shots/necro_sheet.jpg`, `local/shots/spooky_rec_sheet.jpg`; never
committed). What the rated level does that ours does not, biggest first:

1. **The screen is full.** Spooky Dash's top half is a layer of big trees and clouds, a mid layer of hills and
   tombstones, a coloured floor. Ours is ~60% dark empty sky with small props on the floor line (8.2 objects per
   block; featured 2.2 levels >= 17, `tools/taste.js`). Wanted: a big back layer per place (tree crowns, clouds,
   factory walls) that covers the top half, behind the play.
2. **Gameplay blocks ARE the scenery.** Its blocks are stairs and pillars with yellow caps, grass and brick;
   ours are dark boxes with a lit outline (designBlocks). The craft gate says the same: tops dressed 7% (want
   12%+). Wanted: a per-place block skin (caps on tops, a texture inside) in planned.js.
3. **One palette carries the whole level; places change by their props.** Spooky Dash stays purple / teal /
   yellow all through; ours swaps the whole palette per section (purple, brown, green, teal), so it reads as
   four levels. Wanted: the theme's one palette, each place a shift of it (not a new one).
4. **Characters make the moments.** A big ghost, a monster face, a green blob: one per section, at a mode change
   or a drop. Ours has no set piece per section. Wanted: one set-piece prop per section from props.js (ghost,
   robot ...), placed at its first bar.
5. **A prop has to belong to its place.** "house" as the factory's building (x230-x322) read as a village,
   not a factory. Better none than a wrong one: the planner asks for a factory wall / chimney that props.js
   does not have yet (gd-art). Same for pipes, arches, stained window, witch silhouette (logged "no picture yet").
6. **Bright and saturated is fine when the hazards stay readable**: its spikes are white on a light-teal floor
   and still read; our calm rule (TASTE.md) is about pulses and flashes, not about a dark palette.

Gameplay: Spooky Dash changes mode every ~5 s; GDLM 52's 7 mode changes in 61 s already get style's
"mode changes" WARN (6.9 a minute, official 1.3-5.2). Taste data favours longer sections, so the planner keeps
4-bar places but should change MODE only every 2nd place.

**v2 (gaps 1-4 in `tools/scenes/planned.js`, gameplay unchanged):** gd-art's `tools/decokit.js` for three
backdrop depths (mountains, hills, a tree line, paler than the sky towards the place's edge colour), bricks and lit
top trims inside the play blocks, grass tufts that sway (motion on every screen); a cloud band over the top half; one
palette for the level (each place moves 35% from the first place's palette towards its own); a ghost per section,
bobbing; gd-art's new props for gap 5 (factory wall, pipes, broken arches, stained window, a witch against the moon).
Numbers: 8 -> 27 objects per block, taste 61 -> 72 (PASS), craft 1/7 -> 3/7, still READY, contrast 98/100 sections.
Sheets: `local/shots/necro_v2_sheet.jpg`, `local/shots/necro_v2_vs_spooky.jpg`.
Still open from the v2 pictures: the ghost set piece can sit on a flying path (wave at ~45 s) -- place it clear of
the route; the cloud band in one dark colour reads as hanging blocks (a ceiling) -- lighter, rounder, or none in
corridors; the play is still dark next to Spooky Dash's light floor and yellow caps; craft wants more small pieces
and hazards on the floor (pieces100 8, want 12+).

## Open

- Props: the gd-art session's `tools/props.js` (props + a picture-to-GD-art converter). The plan names
  props per place; a scene script turns them into objects. Until it lands, scenekit recipes stand in.
- compose.js builds "ship", "wave", "ball", "upside" sections; UFO and robot sections from the plan
  need structures (STRUCTURES.md) placed by the brief's `use` or by hand.
- Shorter phrases at high energy, speed changes per role (Spooky Dash), and checking the planner's
  energy against what the user feels in the song.
