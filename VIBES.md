# VIBES -- a level imagined before any block exists

Owner: the showcase session (2026-11-24). The user: "lets think of a higher level even to construct a game. maybe
picture, story, just vibing whats gonna happen. without blocks. then this thing is turned into layout with clicks.
lets try to reverse engineer how it would look for some of the more advanced levels."

Step 1 (this file): six advanced levels taken apart and written back as the storyboard their designer would have
had in mind, then the short **vibe sheet** format that the storyboards have in common. Step 2 (not built yet):
vibe sheet -> scene plan (tools/scenes.js, SCENES.md) -> sections with seams (BUILDING.md) -> presses -> blocks.

**How it was read.** `node tools/storyboard.js <level>` (new) reads any level -- demons included, no solve --
back as a timeline: sections cut at portals with mode, speed, hazards / gameplay / deco per block, the background
colour and the effects; an intensity strip; and the "moments" (palette switches, speed changes, camera, shakes
on the beat, the densest set pieces). Thumbnails: `node tools/shoot.js local/community/<id>.gdlvl --at ...` (a
big level with no saved route now renders with the camera at the level's speed, no solve). The levels, the
numbers and the pictures stay in `local/` (other people's work, RobTop's art): `local/vibes/<id>.txt|json`,
`local/shots/vibes/<id>/`, the strips `local/shots/vibes/<id>_strip.jpg`.

## The six storyboards (and Time Machine)

Each one: the level as its designer would have pictured it before placing a block, then the numbers that show it.
Strips: `local/shots/vibes/<id>_strip.jpg` (our render, labelled with time, mode, speed, hazards per block). Limit: 2.2 levels that
show their scenery through spawn / toggle trigger groups (Afterlife entirely, Moonlight's first half) render as bare
colour in our viewer; their storyboards rest on the numbers (colours, modes, triggers) and the level's description.

### Spooky Dash (150941693, rated, 63 s, 2.2, Halloween)

- **Intent.** "A Halloween candy hunt through a haunted forest-graveyard": a cheerful trick-or-treat run, not horror.
  The sign at the start sets the game ("collect all 3 candies to get a coin").
- **The one image.** Purple forest, mint ground, every block a character (zombie block faces, pumpkins on pillars),
  a ghost and a witch on a broom drifting past.
- **Experience curve.** Low and even (0.05-0.5 hazards per block, its intensity strip never spikes); the *look* rises
  instead: 20 deco objects per block in the first half, 40-55 in the second. Difficulty stays, the party grows.
- **Scenes and roles.** Three places: the haunted forest (0-32 s: arrival at 1x with a close camera, into the
  graveyard at 2x as a robot, over the graves as a ship at 3x, a witch on a broom at 30 s) -> a static-camera set piece
  on a mint candy meadow (32-41 s, the characters lined up: the calm) -> the town at night (41-63 s: lit windows,
  the sun and the moon together, the witch again, every mode in turn at 3x, deco 40-55 per block) -> end.
- **Motifs.** A mode every ~4.5 s (5 modes, all short); the camera breathes (zoom pulses to 0.72-0.77 on bars, 60+
  zoom triggers); one palette all level (#3c0082 sky), nothing flashes.
- **Rhythm.** Speed carries the excitement: 1x for 3 s, 2x, then 3x for two thirds of the level.

### Moonlight (60679881, epic Hard, 70 s, "Blue is a chill color", sequel to Sunshine)

- **Intent.** A calm night ride under the moon; chill, not punishing. The level's one joke is a big moon with a face
  near the end.
- **Experience curve.** Hazards almost absent (0-0.5 per block, 2 in its one wave): the play is orbs, pads and
  blocks (3-11 gameplay objects per block). Energy shaped by speed: 0.5x opening ship (10 s) -> 1x wave -> 2x for the
  middle -> 0.5x again at 51.8 s (the calm after) -> 1x to the end.
- **The drop.** 36.6-50.8 s: a screen shake on every beat (14 shakes, every 1.1 s) with 2x cube / wave / ship
  switching every 2-3 s. Before it, a 2x upside cube build (27.8-36 s).
- **Look.** One navy sky all level (#0c0b30 -> #0b114d), 30-100 deco per block, everything moving (move 172,
  rotate 94 and toggle 166 triggers in the first 10 s alone): the scene animates, the colours don't. The last part
  (54-70 s) turns into a bright cyan crystal-and-ice world: the brightest frame of the level is its ending.

### Acheron (73667628, extreme demon, 66 s, top 1 in 2022)

- **Intent.** "The river of the underworld": a descent through hell's machinery, black, grey and blood red, no rest.
- **Experience curve.** Flat at the top: 2-9 hazards per block everywhere, a mode every 2.3 s (26 changes a minute),
  speed changing constantly between 0.5x and 3x. The variation is *texture*, not rest: 0.5x stretches (43-48 s, the
  slow ship and wave "on the river") are as hard as the 3x ones.
- **Moments.** 24 s a dim brown flare; 39.4 s an instant flash to grey stone; the end a mini ball at 0.5x with a joke
  caption. Pulses on every beat all level (82 in 3 s at one point: strobing).
- **Look.** Near-black backgrounds (#000-#1f1c1c), red light and gear silhouettes, 20-170 deco per block.

### Afterlife (89521875, epic Normal, 114 s, "stones crumble, memories fade, life is forever")

- **Intent.** A cinematic: what comes after death, told mostly as one long flight. Gameplay is gentle (0-0.2 hazards
  per block), the scene does the work.
- **Scenes and roles.** 0-22 s cube on foot in the dark (#020037) -> **22 s the drop**: an instant flash to pale blue
  (#8e92fd) with shakes, the cube becomes a ship -> 22-94 s one 72-second ship flight through slowly fading skies
  (5-9 s fades: dark -> lilac at 46 s -> grey at 70 s), shakes on every beat 70-93 s -> **93.6 s** a white-blue flash
  -> 94-114 s back on foot, calm, cyan to deep blue (5 s fade), no hazards at all (the outro).
- **Motifs.** One mode per act (a mode lasts 38 s on average, against 2-5 s in the others); 3318 move, 1851 pulse and
  1088 colour triggers in the flight: the world around the ship is animated throughout.
- **The one image.** The cube turning into a ship at the flash, leaving the ground for the sky.

### Bloodbath (10565740, extreme demon, 112 s, top 1 2015-2016, a collab)

- **Intent.** "Whose blood will be spilt": a gauntlet. Built by many creators, each part its own place (red machinery,
  a grey hall at 44 s, a brick castle at 77 s), joined by one rule: black and red.
- **Experience curve.** A mode every 3.4 s, speed swapping 0.5x / 1x / 2x / 3x as punctuation (37% of it at 0.5x:
  heavy, menacing slowness), hazards 1-7.6 per block. Peaks at 10-22 s (mini ship 3x), 65-70 s (mini ufo, 6.7 per
  block) and the 97-100 s ship climax (7.6 per block), then a slow mini ending.
- **Motifs.** The red pulse: the background breathing black -> red in 0.5-2 s fades from the first second
  (#d60000, #8f0000); each creator's part keeps it. Mini size as the tight-corridor feeling.

### Tidal Wave (86407629, extreme demon, 179 s, top 1 2023-2024)

- **Intent.** "Drown them": a tsunami, then the deep sea, then surfacing onto a beach. Built on speed: 57% of it at
  4x. The pictures tell it as depth: 0-75 s deep blue under water (glowing blue crystal and coral), 76-165 s the
  surface and the shore (sun, clouds, sand), the end at night.
- **Scenes and roles.** 0-36 s the wave hits: 4x, every mode, 8-15 hazards per block, deep navy (#00143f -> #002c8c)
  -> **36.5 s** an instant cut to black, 0.5x ufo, 0.25 hazards per block: under water, the eye of the storm (5 s)
  -> 41.7 s the 4x wave corridor (20 s of wave, 80-110 deco per block) -> 64-75 s 0.5x heavy sections -> **75.8 s**
  instant switch to bright blue (#3184ff): **surfacing** -- the picture opens onto a sunlit sea with clouds and a big
  sun, then sand and beach in pale yellow; it stays light to the end -> 90-128 s dual and 4x waves on the beach ->
  128-131 s the second calm (0.5x dual wave, 0.3 hazards per block) -> 131-165 s the 4x wave gauntlet -> 165-179 s
  the credits at night over the sea under the moon (0.5x mini wave, 0.9 hazards per block).
- **Motifs.** Two calm breaths (36.5 and 128 s), each a cut to 0.5x with almost nothing in it, each followed by 4x
  waves. Dense deco all through (50-110 per block); the palette changes only twice.

### Time Machine (official 8, Normal, 95 s) -- the rebuild's reference

- **Intent.** A ride through time: each phrase a new era in a new colour. **The one image:** the whole screen
  switching colour on a phrase start.
- **Experience curve.** Sparse (0.3-3 hazards per block, 1-3 deco per block: a 1.x-era level), cube most of the way,
  two ship parts (34-41 s, 88-95 s). Rises to a mirrored ship at 34 s, falls into a 10 s fade to near black (45-55 s:
  "the void"), fades up into purple (61.6 s), then hops eras every 3-7 s with instant switches (68-88 s), ship out.
- **Motifs.** Palette switches (12), mirror portals as "time runs backwards", short upside-down interludes.
- Its vibe sheet: `briefs/69_time_hop.vibe.json` (written by hand from this storyboard).

## What the six have in common

1. **Each level has one sentence of intent, and the description often says it** ("Drown them", "Blue is a chill
   color", "stones crumble, memories fade"). Everything else serves it: Tidal Wave's 4x is the tsunami, Acheron's
   black is the underworld, Afterlife's single long flight is the passage.
2. **There is always a remembered image**: Afterlife's flash where the cube becomes a ship, Tidal Wave's cut to black
   under water, Spooky Dash's characters, Time Machine's colour hop. It sits on the song's biggest moment.
3. **The experience curve is designed on three dials, not one**: difficulty (hazards per block), speed (0.5x as dread or
   calm, 3-4x as rush) and spectacle (deco per block, shakes, flashes). The best levels move them *against* each other:
   Spooky Dash keeps difficulty flat and raises spectacle; Tidal Wave cuts all three at once for its breaths; Afterlife
   keeps difficulty at zero and tells everything with spectacle.
4. **Calm is placed, short, and right before the biggest part** (Tidal Wave 36.5 s and 128 s, Moonlight 51.8 s,
   Afterlife's dark opening before the 22 s flash, Time Machine's void before the era hopping).
5. **Mode length is a style choice**: 2-5 s per mode in gameplay levels (Acheron 2.3, Bloodbath 3.4, Moonlight 4.1,
   Spooky Dash 4.5), 38 s in a cinematic (Afterlife). It is the first number a sheet should fix.
6. **The look has one rule for the whole level**: one palette (Spooky Dash, Moonlight), one colour pair breathing
   (Bloodbath's black/red), a palette per era (Time Machine), or two cuts only (Tidal Wave). Never a random palette
   per part.
7. **Motifs come back on the beat**: shakes every beat through a drop (Moonlight, Afterlife), zoom pulses on bars
   (Spooky Dash), the background pulse (Bloodbath, Acheron).

## The vibe sheet (write one in a minute or two)

A sheet is the level before any block exists, in the user's layers ("a mental model, where the level is the
implementation": intent -> experience curve -> scenes and roles -> motifs -> rhythm -> blocks and deco). The last
layer is the pipeline's job. A person writes the first five in a minute or two; the JSON form (`briefs/<NN>.vibe.json`)
is what tools/vibe.js, tools/coordinator.js and tools/recompile.js read. Example: `briefs/69_time_hop.vibe.json`.

```
INTENT          title, journey (one sentence), oneImage (the moment it is remembered by), never [...]
EXPERIENCE      feel { tier, modeStretch (s a mode lasts: 2-5 gameplay, 30+ cinematic), density }
CURVE           song { official | custom, from (s), shape [{ t, part: intro|build|drop|break|finale }] }
                and every beat's energy 0-1
SCENES & ROLES  beats [{ id, t [s, s], role intro|build|drop|calm|break|finale, energy, place, mood,
                         vehicle { mode ("cube then ship"), at, speed, why }, moment,
                         look { palette { bg }, palettes [several eras in one beat] }, transition { in: instant | fade N },
                         must [...], mustNot [...] }]   -- one per 5-20 s
MOTIFS          motifs [...]   what comes back and means something
RHYTHM          rhythm { sync: loose | portals | tight, speed }; lookRule shared | shifting | per-part | switchAtDrop;
                camera (words)
```

Written as prose it is five short paragraphs and a table: `local/recompile/<level>/spec.md` (tools/recompile.js writes
one for every spec). The storyboards above are this format filled in by hand from real levels.

## Decompile, recompile, diff (USE_CASES 31, BUILDING.md section 6)

The benchmark for the whole creation process: `node tools/recompile.js <level> --name "GDLM NN name" [--spec
sheet.vibe.json] [--from step] [--to step]`, one artifact per step, each a stage of the rebuild in the viewer:
**original** (decompile: the level cut at its song's sections, `sections.json`) -> **spec** (abstract: the vibe sheet,
`spec.json` + `spec.md`; the lossy step) -> **plan** (the compose brief, the collab split with seams on song time and
the coordinator's roles, from the spec alone) -> layout ... final (collab build and join) -> **compare** (`compare.md`:
the original vs the spec used = what the spec dropped; the spec vs the rebuild decompiled = what the build could not
deliver; tools/vibediff.js and taste's tools/compare_sections.js side by side). Stop at any step, edit its artifact
(the spec above all), go on with `--from`.

### Results

- GDLM 69 time hop (Time Machine, a person's spec): in progress -- steps 1-3 done, the build waits for the heavy slot.
- GDLM 70 candy night (Spooky Dash, the machine's spec): steps 1-2 done (`local/recompile/gdlm_70_candy_night/spec.md`).

## Open

- Step 2: turn a vibe sheet into a scene plan (`tools/scenes.js --vibe sheet.md`), then sections with seams
  (BUILDING.md), presses on the song, blocks. Not built: waits for the user to see step 1.
- The songs of these levels are not on this PC (local/songs): the song shape here is read from the level (speed
  changes, beat shakes and zoom pulses, palette switches), not heard.
- 2.2 levels time many effects by spawn / touch trigger groups (Afterlife: 820), which storyboard.js counts but
  cannot place in time; their moments come from the pictures.
