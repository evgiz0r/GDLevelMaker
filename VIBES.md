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

**GDLM 69 time hop: Time Machine rebuilt from a person's vibe sheet (2026-11-24).** `briefs/69_time_hop.vibe.json`
(written from the storyboard above, never from the blocks) -> 12 sections, 7 collab parts -> built -> compared
(`local/recompile/gdlm_69_time_hop/compare.md`, sheet `compare_sections/sheet_gdlm_69_time_hop.jpg`). The level
`levels/gdlm_69_time_hop.gdlvl` is NOT READY (score.js: `skips` and `fairness` fail) -- a benchmark result, not a
level for the user to play yet.

What came through (the spec carried it and the pipeline built it):
- **The look layer, exactly**: 12 palette switches in both, the same colour in every beat (teal, blue, pink, the
  black void, purple, the five era colours, blue), fades where the sheet said fade.
- **The structure on the song**: the same 5 song sections, both levels 94 s, the ship where the sheet put it
  (34 s and 88 s).

What did not, and where it was lost:

| gap | ours / Time Machine | lost in | why |
|---|---|---|---|
| hazards per block | 0.19 / 1.34 (5 of 5 sections) | the **spec** | the sheet's density is words ("sparse"), and nothing turns them into hazards per block; "sparse" for a person meant ~1 per block, the Normal-tier composer reads it as ~0.2 |
| energy curve | r 0.47 | the **spec** | the person's energies (0.85 at the ship finale) disagree with the measured ones (0.22: the finale's ship has few obstacle starts); the experience layer needs numbers taken from the song, not felt |
| modes the sheet never asked for | ufo, ball and wave in our level; 13-25 mode changes a minute where Time Machine has 0-4 | the **build** | compose's structure library drops one structure per cube section, and structures bring their own mode (ufo pillars, ball flips, wave steps); the vehicle in the sheet is not a constraint on them |
| deco pulses | 123-397 a minute, on the beat / 9-25, never on the beat | the **build** | compose's modern look pulses on the beat by default; the sheet's camera "plain" and its "never: deco that competes with the path" reach no code |
| mirror ("time runs backwards") | missing | the **build** | mirror portals are not simulated (CLAUDE.md) |
| colour channels, motion, z-layers | 2-4 / 0, 1-11 / 0, 3-5 / 2-3 | the **build** | compose dresses every level 2.2-style; a 1.x-era plain look is not a choice the sheet can make |
| parts failing their gates | part 1 failed `timing`, `reactive`, `skips` on 3 seeds | the **build** | collab builds a part in one try with no repair rounds; recompile.js fell back to compose (whole level, repair rounds), which still ended with `skips` and `fairness` failing |

So the spec format holds the look and the song structure; it lacks **numbers for difficulty and density** and
**hard constraints** (no extra modes, no deco pulses). The pipeline lacks repair rounds in collab, mirror portals and
a plain-look option. Next, in that order: the sheet's density as hazards per block (with tools/energy.js's
measured curve as the default energies), the vehicle and the motifs as constraints compose obeys, repair rounds
in collab builds.

**GDLM 70 candy night: Spooky Dash rebuilt from the machine's own spec (2026-11-24).** Steps 1-2 by the machine
(`local/recompile/gdlm_70_candy_night/spec.md`), no person in the loop; collab failed part 0 on 3 seeds (prejumps,
timing, reactive, skips) and compose built it whole; `levels/gdlm_70_candy_night.gdlvl` is NOT READY (`skips`,
`fairness`). Sheet: `local/recompile/gdlm_70_candy_night/compare_sections/sheet_gdlm_70_candy_night.jpg`.

- The machine's spec matches the original on every beat by construction (roles, energy, the mode sequence with its
  switch times, the sky colour): **what it cannot hold is the scene**. Its places are "a purple place" five times;
  the forest, the candy meadow, the town at night, the witch, the ghost and the zombie blocks are nowhere in it. A
  person's sheet carries them in `place`, `moment` and `oneImage`; the machine cannot read them from objects yet.
- The build then had nothing to dress with: 2-10 objects per block against Spooky Dash's 19-45, deco around play
  objects 0.4-1 against 4-9, colour channels 3-4 against 10-13. vibe.js's brief sets no scene script, so a place in the
  sheet changes nothing in the level yet (tools/scenes/planned.js could take it).
- The gameplay layer came through closer than in GDLM 69: hazards per block 0.06-0.29 against 0.02-0.33, obstacles
  on a beat 13-39% against 24-67%, the modes in roughly the right order (robot only as a structure in cube sections).
  Energy shape r 0.18: the rebuild is flat where Spooky Dash rises.
- Our level pulses its deco on the beat (55-89% on a beat, up to 392 a minute; Spooky Dash 13-30%, while its camera
  pulses instead) and changes mode 17-51 times a minute where Spooky Dash changes 6-17.

**Both together.** The vibe sheet holds the song structure, the look rule and (from a person) the scene; the
machine's abstraction holds gameplay numbers but loses the scene. The pipeline loses density numbers, scene, the
sheet's constraints (vehicle, never, camera) and collab parts on hard gates. Next, in order: (1) the sheet's density as
hazards and objects per block, measured energies as the default; (2) a scene from `place` (planned.js) in the brief;
(3) vehicle, never and camera as constraints compose obeys (no extra modes from structures, no beat pulses unless asked);
(4) repair rounds in collab builds; (5) the machine's abstraction naming places from the deco it sees.

## Handoff (2026-11-24): state, the five fixes, how to run it

Owner from here: **the style session** (it owns compose and collab, which the round trip builds with). The vibes
session that wrote this was archived to free memory.

**How to run it.** `node tools/recompile.js <level> --name "GDLM NN name" [--spec sheet.vibe.json] [--from
decompile|abstract|plan|build|compare] [--to step]`. `<level>` is `official:8` or a `.gdlvl`; `--spec` uses a person's
sheet instead of the machine's abstraction. Everything goes to `local/recompile/<slug>/` (sections.json, spec.json/md,
plan.json, run.log, compare.md, compare_sections/) and to the viewer as the stages original / spec / plan / ... /
compare. It takes the heavy slot per step; with the queue busy it waits (the last run sat 84 min behind high-priority
jobs before compose started). The two runs so far:
- `node tools/recompile.js official:8 --name "GDLM 69 time hop" --spec local/vibes/69_person_v2.vibe.json --from abstract`
- `node tools/recompile.js c150941693 --name "GDLM 70 candy night" --from abstract` (`--pictures` adds the compare frames)

**The five fixes (from "Results").** All are in code except 5; none has been measured yet (see below).
1. **Density as numbers, energies from the song** -- DONE (tools/vibe.js): a beat's `density` (hazards per block)
   becomes compose's gaps (`gap = max(1, round(2.5*(1/h - 1)))`) and denser patterns from 0.8 per block; a beat with no
   `energy` takes the song's loudness percentile (songmap bars); `check()` shows "~ (from the song)".
2. **A scene from `place`** -- DONE (vibe.js `scenePlan` + `pickPlace`, tools/scenes/planned.js, recompile.js `dress()`
   runs `collab.js scene` after the build). Places map to tools/scenes.js theme-pack places by synonyms, else the pack
   place with the closest sky colour; `dress: "plain"` or `lookRule` keep the plain look.
3. **Vehicle, never and camera as constraints** -- DONE: `sections[i].structureModes` (compose.js structurePicks only
   takes structures in the sheet's modes, so no stray ufo/ball/wave); `brief.pulses === false` (from `never` / camera)
   reaches make.js (`spec.modern.pulses`) and planned.js (no bar pulses); `modern: false` for plain sheets.
4. **Repair rounds in collab builds** -- DONE, TESTED 2026-11-24 (style): three bugs fixed -- a tight window now swaps the
   chunk for its easier kind at once (room before a triple left it at 45.8 ms), the swapped kind is banned from the section
   (compose tweak `ban:<si>`: compose places every unseen kind once, so the triple came back as the next chunk), and the
   spots of skips / reactive are read from the gate's note. GDLM 69 p1 now passes timing; `reactive` (3-4 spots) survives 5
   rounds of room and reseeds -- likely the terrain step-ups after landings, not the chunks blamed. Open. Was: UNTESTED (tools/collab.js `build`, `--rounds n`, default 3,
   `brief.partRounds`): compose's blame rules (dies / prejumps / tight / chains / skips / reactive -> room, columns,
   EASIER chunk, another plan after two blamed rounds) on the part, with no files written; a worse round is dropped,
   the best kept, the seam check after. First test: `node tools/collab.js build briefs/69_time_hop.json 1 --by
   recompile` -- part 1 failed `timing` (45.8 ms) and `reactive` on 3 seeds in the v2 run before this existed.
5. **The machine naming places from the deco it sees** -- NOT STARTED (recompile.js `abstract` still writes
   "a <hue> place"; tools/catalogue.js usage families or props would be the start).

**Benchmark numbers to beat** (v1, before the fixes; copies of the compare files in `local/recompile/<slug>/v1/`):

| | GDLM 69 (Time Machine, person's sheet) | GDLM 70 (Spooky Dash, machine spec) |
|---|---|---|
| hazards per block, ours / original | 0.19 / 1.34 | 0.06-0.29 / 0.02-0.33 |
| energy shape r | 0.47 | 0.18 |
| mode changes a minute, ours / original | 13-25 / 0-4 | 17-51 / 6-17 |
| deco pulses a minute | 123-397 / 9-25 | up to 392, 55-89% on a beat / 13-30% |
| objects per block | -- | 2-10 / 19-45 |
| palette switches | 12 / 12, same colours | -- |
| gates | NOT READY: skips, fairness | NOT READY: skips, fairness |

**Where the re-run stopped.** The v2 run of GDLM 69 (sheet `local/vibes/69_person_v2.vibe.json`: `dress: plain`,
per-beat density 0.5 / 0.8 / 2.1 / 1.0 / 1.4 / 1.1 / 2.0, no energies) wrote the new plan (briefs/69_time_hop*.json
are its output) and failed part 1 on 3 seeds (timing 45.8 ms, reactive: density 0.8 forces 1-3 block gaps), then was
stopped while waiting for the heavy slot to run the compose fallback. GDLM 70 was not re-run. levels/gdlm_69 and
gdlm_70 are still the v1 builds. Next: test fix 4 on part 1, then run both round trips again with `--from plan`
(69) and `--from abstract` (70) and fill a v2 column in the table above.

## Open

- Measure fixes 1-4 (the re-run above) and do fix 5.
- Step 2 of the user's idea beyond the benchmark: a person's vibe sheet for a NEW level -> recompile.js --from plan.
- The songs of the demon levels (Acheron, Tidal Wave, Moonlight, Afterlife) are not on this PC: they cannot be
  round-tripped (the cut needs the song's beat grid). Spooky Dash, Bloodbath and every official level can.
- 2.2 levels time many effects by spawn / touch trigger groups (Afterlife: 820), which storyboard.js counts but
  cannot place in time, and our viewer does not draw what they show.
