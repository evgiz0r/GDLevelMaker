# CRAFT -- how RobTop builds and dresses a level (Jumper, xStep), as rules we can generate and check

The user (2026-11-23): "why don't we have anything at the level of gameplay variety and deco even like
Jumper or xStep". Object count is not the gap (Jumper 3.2 objects per block, xStep 5.7; GDLM 47-51
5.6-9.3). The gap is **where the objects go**. This page is the study (step 1), the rules as generator
code and checks (step 2), and the level built with them (step 3). Owner: the craft session (2026-11-23).

RobTop's levels are data in `local/official_NN.json` only; pictures in `local/shots/craft/` (never
committed). Everything here is a rule or a number, never a copied layout.

## How it was studied

- `node tools/craft.js roles official:7` -- every object gets one role: solid, hazard, play (orb/pad/
  portal), trigger, and for decoration: **fill** (a deco block inside a structure), **top** (stands on a
  solid), **hang** (under a solid), **side**, **ground** (bare floor, away from structures), **near**
  (within 2 blocks of a structure or hazard), **back** (far from everything). Per 30-block screen too.
- `node tools/craft.js map official:10 --from 240 --to 360` -- a text picture WITH the deco
  (`#` solid, `=` deco fill, `^`/`v` hazard, `o` orb/pad/portal, `t` top deco, `h` hanging, `.`/`,` loose).
- `node tools/craft.js check <level>` -- the numbers below against the official targets.
- GD-art frames: `node tools/shoot.js official:7 --at 3,8,13,22,30,40,52,62,75 --out local/shots/craft/jumper`
  (same for xStep, official:10); `local/shots/craft/step1_compare.png` puts Jumper, xStep, GDLM 51, GDLM 47
  side by side.

## Numbers (all 10 official 1.x levels vs ours)

`node tools/craft.js check` -- targets are the low end of the official range.

| | official range | Jumper | xStep | GDLM 47 | GDLM 50 | GDLM 51 | target |
|---|---|---|---|---|---|---|---|
| structure pieces / 100 blocks | 14-28 | 24 | 21 | 4 | 5 | 7 | >= 12 |
| cells per piece (median) | 1-4 | 3 | 2 | 10 | 18 | 4 | (small) |
| floor columns with a hazard | 39-69% | 69% | 56% | 10% | 12% | 27% | >= 35% |
| hazards / 100 blocks | 62-191 | 121 | 191 | 16 | 14 | 28 | >= 45 |
| undersides armed (spike/hanger) | 34-70% | 56% | 69% | 34% | 48% | 51% | >= 35% |
| tops dressed (spike/rod/orb) | 18-43% | 22% | 43% | 15% | 26% | 29% | >= 12% |
| rods + chains attached | 82-100% | 91% | 96% | - | - | - | >= 90% |
| neighbouring pillars differ in height | 39-100% (median 87%) | 90% | 89% | 0% | - | 67% | >= 70% |
| deco belonging to no structure | 0-1% | 0% | 1% | 32% | 28% | 42% | <= 20% |

**Targets depend on the look** (the taste session, 308 community levels, TASTE_DATA.md "Per band"):
the hazard-floor share (>= 35%) and the loose-deco limit (<= 20%) are RobTop-1.x-look targets. Featured
Easy/Normal levels have 16-21% hazard floors, and 2.0-2.2 ones 30-52% loose deco (epic more than featured),
so a 2.2-look level (a third of its deco ids >= 1000; `--look=2.2`) is held to a 15% floor and leaves loose
deco to tools/readability.js (contrast, clutter). Hazards: >= 45 and <= 110 per 100 blocks for Easy/Normal, <= 180 for
Hard and up (the brief's difficulty label; `--tier=Hard`) -- featured Easy/Normal sit at ~75-81, featured
Hard/Harder at ~140; Jumper's 121 and xStep's 191 are Hard/Harder numbers, and spike spam marks the
plain, unrated level.

Read: **RobTop builds a level out of many small pieces** (a pillar, a hanging column, a 1x1 block, a
3-wide slab), each with hazards and deco attached, over a floor that is mostly hazard. Ours are built
from few long masses on a safe floor, with decoration floating in the background.

## The rules (soft: each is a scored check in craft.js and, from step 2, a generator)

### 1. Structure: many small pieces

- **The floor is a hazard about half the time** (39-69% of columns, even Stereo Madness 48%): a pit of
  spikes (the low black ground spikes 9/61, or rows of 8/39) between pieces. The player lives on the
  pieces: only ~28% of standing time is on the bare floor (style session, tools/flow.js).
- **Pieces, not masses**: a piece every ~4-5 blocks. Kinds, by count in Jumper / xStep:
  ground pillars (1 wide, 1-7 tall, median 3) 83 / 18; hanging columns from the top (1 wide, 2-7 tall)
  42 / 18; floating 1x1 blocks 53 / 71; floating 3-wide slabs 23 / 51; ground masses (10-17 wide) only
  5 / 6 -- the "set piece" (a symmetric stepped pyramid with fill and a rod on every step, a fortress).
- **Pillar runs climb and fall**: neighbouring pillars sit 2-3 blocks apart (gap 2: 27, gap 3: 19 of 69 in
  Jumper) and differ in height by 1-2 blocks (only 7 of 69 the same). Every jump changes height.
- **At Easy/Normal, tap-able pillars** (the user on GDLM 61 v1, blocks 15-60, 2-wide pillars 2 apart:
  "these clicks very unnatural ... the timings seem reallllly awkward"; the saved route was one long hold).
  Jumper's 1-2-wide pillars are a Harder rhythm: they work only as a held bounce. Ours: tops 3-4 wide, a
  RISE is a plain step with NO pit (over any pit the window is cut by the higher pillar's face on one side
  and the pit on the other: 208 ms over 1 column, ~100 ms over 2 -- score.js "reactive", the user's GDLM 45
  note "as if I need to time not to hit the block"), a DROP crosses a 3-column pit, +1 per extra row
  (over 2 the cube walks across without a jump and the pit means nothing). Floating steps go DOWN a row
  each for the same reason. Checked at 1x only (structures tagged "1x only"): at 2x the widths differ.
- **Hanging columns cap the jump**: a ceiling of columns from the top, their ends 2-4 blocks over the
  pillar tops, so the arc is framed above and below (Jumper's whole opening).
- **Symmetric set pieces**: stepped pyramids, a block with spikes on every side, rows of `^#^` (a 1-wide
  pillar flanked by spikes), "spike diamonds" in ship parts (`^...^` boxes of spikes). Mirrored shapes
  read as designed, not generated.

### 2. Outlines and corners

- **Every block is outlined exactly on its open sides** (skins 1-7: 1 all, 2 one edge, 3 corner, 6 end
  cap, 7 strip, 5 interior fill; ~70% exact in both levels, the rest deliberate inner lines on set
  pieces). Our make.js already does this (`decorate.js skinBlocks`); scene levels (GDLM 50/51) replaced it
  with designed blocks and lost the outline (0% exact).
- **Black fill, white glowing edge, on a saturated background**: blocks and spikes are both black with a
  white outline; the background and ground are ONE saturated hue (ground the same hue, darker). That is
  the whole contrast scheme: anything black-and-white is the playfield, everything else is colour.
- **Interior fill is a separate deco block** (id 5, no hitbox, behind): big pieces are an outline of
  solid skins around deco fill (Jumper's pyramids: 314 fill blocks).

### 3. Deco attached to structures (never loose)

- **Rods (antenna 15-17) stand on pillar tops** -- about one pillar top in five; also under hanging
  blocks, pointing down. **Chains (41) always hang something**: a hanging column, a floating block, an
  orb or a pad (xStep: 94 of 208 chains hold an orb or pad). 82-100% of rods and chains touch a piece.
- **Undersides are armed**: about half of the exposed undersides (hanging columns, floating blocks,
  ceilings) carry a spike or a chain. Ceilings alternate hanging spikes and chains (`hvhvhv`) or spikes
  and diamonds.
- **Ground deco is a band, not scattered**: pale crystal rows (18-21) in Jumper, cloud bushes (48/49) in
  xStep, along the floor between pieces, in a lighter tint of the background hue -- a frame for the
  floor, never near a real spike in its colour... (Jumper does put them next to spikes, but they are
  pale and the spikes black: colour carries the difference.)
- **Nothing floats free**: 0-1% of deco has no structure within 2 blocks (ours: 28-42%).

### 4. Colour and contrast

- One hue per section for background + ground; switched **instantly** at the section's portal or phrase
  (~every 50-70 blocks, 5-7 s), occasionally a 4-10 s slow blend. Jumper's finale cycles the hue every 2 s.
- **Pulses are hue flashes, not white**: xStep's build-up flashes the background to a lighter tint of
  the same hue and back (0.3-1 s), the flashes getting closer (every 20, 10, 5, 1 blocks) into the drop.
  Calm otherwise. Matches TASTE.md's "calm, not flashy".
- **Hazards = blocks = black + white edge**; deco in the background hue's tints; orbs, pads and portals
  are the only saturated non-background colours near the path.

### 5. Motion

- Almost none: no move or alpha triggers; enter effects (objects sliding in from the top/bottom, ids
  22-28/55-59) in a few stretches (11 in Jumper, 13 in xStep). The background colour is the moving part.

### 6. Gameplay chunks (shape vocabulary, per mode)

From the text maps; each is now (or will be) a structure in `tools/structures.js` (section "Craft"):
- **pillar hop**: 3-6 pillars 2-3 apart, heights stepping +-1/2, pit between, rods on some tops.
- **capped hop**: the same under hanging columns, chains under the columns' ends.
- **floating stepping stones**: 1x1 blocks or 3-wide slabs over a pit, rising a row each (STRUCTURES.md:
  same-height blocks 2 apart are walked across), a chain over each slab.
- **lantern orb**: an orb (or pad) hanging on a chain from the ceiling, over a pit.
- **spike pillar**: `^#^` -- a 1-wide pillar with spikes on both sides at each row; jumped over.
- **stepped pyramid**: a symmetric 7-17 wide ziggurat with fill, a rod on every step, spikes between rods.
- **armed ceiling**: a ceiling band with hanging spikes and chains alternating (ship / ball / gravity).
- **ship spike frames**: hollow boxes and diamonds of spikes in the ship's lane, floating blocks with
  spikes on 3 sides.

## Structuring: what creators call it, and what we had (2026-11-25)

In the GD community a level is made in three passes: **layout** (the gameplay, plain blocks and spikes), **structuring**
(turning those raw blocks into designed shapes: outlines, silhouettes, how pieces join and frame the path) and
**decoration** (background, glow, effects). Our stages match (layout -> path -> deco); structuring is our craft pass
(tools/craftkit.js, decorate.js skinBlocks) plus the piece shapes of STRUCTURES.md / LEGO.md. The user asked whether we
have this knowledge (a Reddit thread "Need help on structuring, any tips?"; Reddit is blocked from the cloud sessions,
so it is not read yet -- paste its text or read it on the PC).

Sources: the GJ guide (a community editor course, a-zalt.github.io/gdknowledge, GJGuide_new.pdf; lessons 1, 5, 12-14,
19), VidishGD's short "How to make good structures" (youtube.com/shorts/ePyBcmbh3L4, via the user), ludo.guide's editor
pages (mostly generic; little GD-specific).

| rule | had it? | where / check |
|---|---|---|
| Blocks outlined on their open sides, a fill behind | yes | "Outlines and corners" above; decorate.js skinBlocks, craft.js |
| Many small pieces, not masses; symmetric set pieces | yes | "Structure: many small pieces" |
| Deco attached to structures, nothing floats loose | yes | "Deco attached"; craft.js |
| Not repetitive ("the #1 tip for gameplay"); copy-pasted chunks are "frowned upon" | yes | tools/repeat.js, LEGO.md variety rule (repeats within 4 pieces) |
| A long string of orbs comes out bland | partly | fairness "orb chains" (a timing rule, not a variety one): NEW as a variety rule: no more than 2-3 orbs in a row as the only mechanic |
| Time to react at a mode change; no spam wave straight into ship | yes | fairness "switch", "mode entry", lead-in gates |
| Mode bands: ship / wave / UFO 10 blocks, spider 9, ball 8; cube / robot none | yes | lib/physics.js bands; patterns build in rows 0-9 |
| **Vary the outline: not plain rectangles** (notches, steps, overhangs, a broken edge) | **NEW** | not checked: our pieces are mostly rectangles. Check to build: share of solid pieces whose shape fills its bounding box |
| **Connect the structures together** (a pillar meets the ceiling band, a floating slab hangs from a column, floor and roof of a corridor share an outline) | **NEW** for solids (we had it for deco) | not checked: a measure of solid "islands" per screen |
| **Go beyond standard shapes**: slopes, diagonals, curves, not only squares | partly | wave/ship corridors use 45-degree slopes; cube pieces rarely do |
| **Lean into the theme in the gameplay itself** (a forest: irregular ground, branches as the platforms) | **NEW** | theme kits (ART.md "Theme kits") skin the look, not the gameplay shapes. Next: a theme's own piece shapes (branches, roots, ice shelves) as lego pieces |
| Plan the look before decorating; layout first | yes | BUILDING.md stages |
| Too many blending (glow) objects turn white; mix blending and plain colours | **NEW** | not checked (ART.md colour work; whiteframes.py catches pure white in recordings) |
| Bottom ground (G1) darker than the top ground (G2) | **NEW** | not checked |
| Moving or sideways spikes and sudden move triggers are "frowned upon"; not memory-based | yes | knowledge/design.md fairness, sight-read gate |

Next steps (owners: the art and style sessions): the two NEW checks that are cheap (plain-rectangle share, solid islands)
in craft.js, then pieces whose outline is varied and joined in the lego library.

## Generator and checks (step 2)

- **`tools/craft.js check <level>`** and score.js's **`craft` gate** (WARN when 3+ targets missed): the
  numbers above against the targets. Every rule is soft: a level may miss one with a reason.
- **`tools/craftkit.js`** -- the craft pass, spec `"craft": true` (or `{rods, underRods, chains, lanterns,
  skipCols}`) in make.js, after the block skins: rods on ~30% of ground-pillar tops (rod 16, tall pillars
  rod 15), rods pointing down under ~35% of hanging-column ends, every floating piece hung on one chain
  (<= 2 wide) or two, every orb in the air hung on a chain (the lantern). Chains stack up to row 11 or the
  solid above. Seeded, deco only.
- **make.js extra `"dy"`**: an object n units off its row centre -- the low pit spikes sit at `dy: -13`
  (id 9 at y 2, like the official floors).
- **Structures, section "craft"** in `tools/structures.js` (all ready, windows 121-304 ms): `pillar-hop`,
  `pillar-climb`, `capped-hop` (args: heights, w, gap, cap), `slab-steps`, `lantern-orb`,
  `stepped-pyramid`, `ceiling-hop` (upside down on hanging columns), `ship-weave` (spike-tipped pillars and
  hanging columns along a drifting line), `ship-lanterns` (floating spiked blocks on chains). Each over a
  pit floor; each starts from a 3-wide doorstep (a 1-wide first pillar asked for a 1.7-block prejump).
- **`tools/craftlevel.js briefs/craft_NN_<name>.json`** -- the craft composer: sections on the song's bars,
  each a list of chunks (structures, raw objects, rests), one hue per section switched on its first bar
  (ground = the hue x0.45), the mode portal at the start (a 3-portal wall after a flying part), xStep-style
  hue flashes (`"build": n` bars) into the next section, `"craft": true` and the classic skins. Writes
  `specs/NN_<name>.json` for make.js.

## The level (step 3): GDLM 61 lantern towers

`briefs/craft_61_lantern_towers.json` -> `tools/craftlevel.js` -> make.js. 72 s, Thumper (Waterflame), cube /
ship / cube with gravity / ball / cube / ship, one hue per section.
- v1: 2-wide pillars were one long held jump (the user: "reallllly awkward") -> v2 4-wide, tap-able, rises are steps.
- v2 render: did NOT look like Jumper / xStep (craft 2/8; blurred bg art and hill band hid the pit spikes).
- v3: the 1.x look (header bg 1, ground 1, middleground 0 -- craftlevel's default `art`), armed column ends.
- v4 (fef925c, 2026-11-24, the current one): the user's mark at 38.25 s "very big breaks with nothing" -> the
  composer refills a section with its own chunks instead of flat floor, and "dead air" is a score.js WARN gate
  (tools/deadair.js). 0 fail, 11 warn, 55 presses, craft 4/8 with hazards in range. Pictures (local only):
  `local/shots/craft/compare_v3.jpg`, `mark_38s.jpg` (v3 vs v4 at 38-44 s).

## Density that costs no timing (tested 2026-11-24, for the art session's dense pieces)

Jumper's density comes from spikes ON the pieces, not from pits alone. Two placements add hazards and
pieces with the player's windows unchanged (tools/structures.js check, alone):
- **Hanging spike tips**: a spike under every hanging column's end, its tip 3+ rows over the HIGHER pillar
  beside the pit (the column's end `cap` = 4 rows over it): `capped-hop-armed` (cap 4) and `capped-hop-armed5`
  (cap 5) -- 296 ms, no "hazards matter" warning, same as unarmed. Hazards 25 -> 39 per 100 blocks,
  undersides armed 40% -> 100%. Code: `pillarRun(..., capGap, capSpikes=true)`.
- **Spike-tipped pit pillars**: a 1-wide pillar in the MIDDLE of a 3-wide drop pit, a row under the lower
  landing, with a spike on top (the pillar replaces that pit column): `pillar-climb-tipped` -- 300 ms, clean.
  Adds pieces (11 -> 17 per 100 blocks) and pillar height changes (100%), not hazards (a pit spike becomes
  the top spike). Code: `pillarRun(..., tips=true)`.
- **Never a spike on a top the route lands on**: it is a new obstacle (a jump over it), not dressing. A top
  is dressed for free only when the route never touches it: the tipped pit pillar, a column end overhead.

## Handoff (2026-11-24: the craft session is archived; gd-art and gd-style take over)

Where things stand, so nobody re-derives it:
- **Numbers**: the table above (Jumper / xStep / official range vs ours) and the targets by look and tier.
  `node tools/craft.js check <level>` scores a level; `node tools/craft.js pieces <structure id...>` scores
  single structures (hazards/100, floor hazards, pieces/100, pillar height changes, armed undersides), no solve.
  Measured pieces: cube 18-45 hazards per 100 blocks, ship 124-137 (STRUCTURES.md "Dense chains").
- **Structures** (tools/structures.js, all tagged "1x only"): pillar-hop, pillar-climb, capped-hop,
  capped-hop-armed (cap 4), capped-hop-armed5, pillar-climb-tipped, slab-steps, lantern-orb, stepped-pyramid,
  ceiling-hop (fails prejumps). Last solo check (`structures.js check`): pillar-hop clean; pillar-climb,
  capped-hop, slab-steps, ceiling-hop warn "hazards matter" (one pit walked over on foot); slab-steps also
  "reactive" (208 ms cut by a block at its block 14); lantern-orb a prejump (block 9) and a 67 ms reactive cut;
  stepped-pyramid a 38 ms press (block 11). These solo warnings did not show inside GDLM 61, but fix them before
  leaning on those pieces elsewhere.
- **Composer** (tools/craftlevel.js): brief sections -> chunks; exits from fly modes are ONE portal on the last
  chunk's exitRow in a 3-row funnel (a wall of portals failed skips); ball exits on row 1; `brief.accept`
  passes through; leftover bars are refilled with the section's own chunks (`"fill": false` = off).
- **GDLM 61 open items**: four input gaps of 2.7-3.9 s at 32, 48, 55, 62 s (portal approaches, one dash-orb
  hold; dead-air warnings); 61 rebuilt from its spec on today's main WOULD CHANGE from block 21 (the
  structures merged from main differ) -- re-make and re-check before any edit, don't trust the pushed .gdlvl
  to match the spec; the user's 38.25 s mark is fixed but not closed in local/marks.jsonl (the coordinator has it).
- **Dead air sweep** (tools/deadair.js, POLISH.md): 45 input gaps and 22 empty screens over 25 GDLM levels; clean
  only 01, 42, 46. Not fixed in the other levels. The polish session owns deadair.js.
- **Spec drift found by the same sweep**: 41, 43, 44, 47, 50, 51 also change when rebuilt from their spec; 46
  sketch no longer builds (its desc is 225 chars, GD's limit ~180).

## What is open

- **The look of a craft level**: more hanging columns and armed undersides still; Easy/Normal craft targets
  (the table's are Hard/Harder numbers) are not measured.
- **Untested density -- done by gd-art (2026-11-24)**: `pit-run-twin-armed` (two hanging spike tips per pit: 70 hazards
  per 100 blocks, floor 44%, underArmed 100%) and `upside-pit-run-armed` (a spike-tipped column rising under each
  upside pit: 37/100, underArmed 31%); both pass `structures.js check --context`. CRAFT.md / craft.js / craftlevel.js are
  now gd-art's and gd-style's (handoff above).
- **ceiling-hop** fails prejumps (upside-down jumps over its roof pits, at any width tried): out of GDLM 61.
- **Craft structures at 2x**: checked at 1x only (tag "1x only"; style found capped-hop / stepped-pyramid fail at 2x).

- Not measured: how the pieces sync with the song (Jumper's piece rhythm vs its beat).
- The 2.2 look (TASTE.md, modern_look.md) and this 1.x craft are not opposed: the craft is about the
  playfield; a 2.2 level adds its scene behind it. The rule kept from both: the playfield is
  black-and-white and structural, the scene is calm colour.
