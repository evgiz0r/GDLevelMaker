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

## Open

- Props: the gd-art session's `tools/props.js` (props + a picture-to-GD-art converter). The plan names
  props per place; a scene script turns them into objects. Until it lands, scenekit recipes stand in.
- compose.js builds "ship", "wave", "ball", "upside" sections; UFO and robot sections from the plan
  need structures (STRUCTURES.md) placed by the brief's `use` or by hand.
- Shorter phrases at high energy, speed changes per role (Spooky Dash), and checking the planner's
  energy against what the user feels in the song.
