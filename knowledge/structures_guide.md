# Structures: how we make them and how we combine them

One page with everything we know about structures, for any session, agent or person. Evgeni, 2026-11-27: "I want all of
our knowledge of structures and how to combine to be also known externally, not just for this session".
Every line is a rule we learned from his notes or from measuring rated levels. Each line names its source and the code
that applies it. The rules are soft: a level may break one if it states its reason (CLAUDE.md, "Every note from the user
is a soft rule"). Keep this page true. When a note teaches something new about structures, add the line here in the same
change. The detailed write-ups stay in the linked docs.

## 1. What a structure is

- **A brick** is a piece 1-3 s long with 2-6 presses. It is smaller than a screen and is verified by the sim: its own
  plan clears it, there is no secret way, and its timing windows fit its tier. Ours are generated presses-first and judged
  against RobTop's official bricks. RobTop's bricks are the quality bar; our old hand-made library pieces are retired.
  Sources: LEGO.md, BRICKGEN.md, STRUCTURES.md, tools/brickgen2.js, tools/clickfirst.js.
- **Clicks first:** decide what each click is (a jump, an orb, a pad, a flip) and the window it should have. Then build
  the pattern around those clicks, close off the wrong routes with hazards, and tune the hazards to the window.
  Source: Evgeni on round 2, own-structures memory.
- **Movement varies on many axes:** leg sizes, irregular paths, dwell, rests, flips and mechanics. Up/down variants of one
  idea are not variety. Source: tools/movestudy.js, knowledge/move_study.json.
- **Built on blocks:** a block, slab or slope in about 45-50% of cube columns. Most spikes sit on ledges, steps, pit edges
  and under overhangs, not alone on the floor. Source: tools/obstacles.js structure.

## 2. Combining structures into a level

- **Sections follow the song.** Cut at the song's transitions, choose a mode per section type, and change the look only
  with a new section. Source: tools/songplan.js, tools/sections.js.
- **Start up on blocks,** never on the default ground: a ramp of about 3 rows, and the first structure begins there.
  Source: tools/startramp.js; judge.js flags a "ground start".
- **Mostly above ground, connected, little open space.** The path runs on masses that reach down to the ground, with spike
  pits between them, not across an empty floor. Source: checklist "Play up on structures".
- **Joins:** 3+ flat blocks between bricks, no prejump, and similar clicks per second and timing windows within a
  section, with some rests. Source: tools/brickpick.js, tools/lego_join.js, LEGO.md "Combining".
- **Corridor into corridor:** floor and ceiling both slope from one's exit height to the next one's entry height (45 degrees),
  so the two merge; a ceiling that has nothing after it slopes up and away, never ends as a cut wall. lib/scenejoin.js.
- **No structure 3 times.** Two times at most, and corridors that move (top and bottom not parallel).
  Source: tools/repeat.js, score.js "repetition".
- **Symmetry:** an orb sits over the centre of its spike row, and pairs mirror each other. If the timing wants it off
  centre, change the structure, not the look. Source: score.js "symmetry".
- **Not sparse:** about 2 clicks a second, balanced. Source: tools/density.js.

## 3. Structures that look connected

- **Islands are held.** A floating structure hangs from the top of the view, or stands on the ground or on the structure
  below. There are two holders near its ends, one in the middle of a narrow one, and one more in the middle from 10
  blocks wide. Holders never sit in the player's path (the route plus a block of margin).
  Source: tools/connect.js, DECOART.md "Connected structures".
- **Holder style per theme:** chain, rope, rod, or a **brick pillar.** A brick pillar is 1 block wide, or 2 under an
  island 8+ wide, with brick rows shifted by half and darker than the play blocks, so it reads as background.
- **Fillets:** a 45-degree slope fills the corner where a pillar meets a structure, **only where the structure goes on
  under it.** If there's no room, move the pillar to the side, drop that fillet, or drop both. Source: Evgeni,
  2026-11-27, hellgate col 27.
- **Fillets belong to the hanger:** they take the pillar's body, outline and brick seam, not the structure's design
  (Evgeni, 2026-11-27, hellgate col 24: "of the hanger type, not the structure"). They sit only on a full square, never on
  a cell that another pillar, fillet or block already takes. A pillar under the gameplay (standing) gets one fillet,
  toward its structure's middle; a hanging one keeps both (col 40). A narrow island (under 5 wide) gets one pillar in its
  middle, and an even-width one hangs from its exact centre line, so a peak hangs symmetrically (col 9). Pillars never go
  through a spike or saw. Source: tools/connect.js connectors / brickParts.
- **Slopes are shaded like the squares beside them** (the top-lit ramp at their height). Source: hellgate col 122,
  structdesign `shade`.
- **Ledges of grounded structures** count too: a run of 2+ cells with nothing under it stands on a pillar at its free
  end, the end away from the support. Source: hellgate col 97.
- **Structures connect** unless the level says otherwise (a bigger space, a transition, a portal). Bridges (a rope or
  chain) join two islands at the same height up to 4 blocks apart.

## 4. The look of one structure

- **One block design and one spike design per section.** Change them only with a new section vibe, and use 2-3 looks per
  level. A design theme bundles blocks, spikes, saws, holders, indicator, sky and backdrop, and can be changed on the
  fly. Source: tools/designthemes.js, tools/structdeco.js.
- **A design follows the whole shape,** slopes included: an outline, inlines and lit edges, notched at inner corners.
  Source: tools/structdesign.js.
- **3D sides are part of the structure:** the side face is the body darkened, its far edge drawn in the theme's edge line,
  and the edge joining front and back drawn at every corner where the side turns; a dim second outline alone reads as a
  hollow copy behind (Evgeni, 2026-11-27, hellgate). Source: structdesign `depth`.
- **Big bodies are not empty:** a structure 3+ blocks thick gets panels, rivets, a few lamps, a layer line and a
  top-lit gradient. Source: structdesign `interior`.
- **Long thin bars are not bland:** a bar 5+ blocks long gets plates every 3 cells, rivets and a lit vein along its
  middle. Source: structdesign `bars`.
- **Hazards are designed pieces, capped to their block:** every spike and saw carries 3+ parts, and a spike's parts stay
  inside its cell's width (glows too; spikedesign check "capped to the block", Evgeni 2026-11-27). Every spike and saw carries 3+ parts. The hellgate spike `ember` has a fanned glow,
  an inner spike and a lit core; the saw `sawforge` has a glow, cog teeth and an inner wheel. The hitbox never changes.
  Source: tools/spikedesign.js, HAZARDS.md "Dressing one hazard".
- **Contrast by role:** block body vs sky at a luminance ratio of 1.5+; the backdrop in the sky's hue, not the blocks';
  hazards clear of both. Source: tools/backdrops.js `fit` / `check`, tools/roles.js.
- **Indicators** get their own style and colour per level, away from the hazard colours. Source: tools/indstyles.js.

## 5. The layout sections

- A corridor's ceiling is its floor lifted, slope for slope, so the two would fit if pressed together (Evgeni 2026-11-27,
  wave corridor: "as if we lift the structures it connects perfectly"). tools/layoutsections.js `tunnel()` draws both from one line.

The theme layout is split into one short stretch per kind of play, the same for every theme: entrance, basic staircase,
open cube corridor, closer cube corridor, hanging structures, flying corridor (ship), wave corridor, flappy bird corridors
(UFO), ball corridors (structures on several heights). Each has a mode and is edited on its own on the Themes tab board.
Source: Evgeni, 2026-11-27; tools/layoutsections.js (drafts; his edits in knowledge/layout_sections.json).

## 6. From a drawing to a structure

Evgeni draws loosely ("you will align to be more symmetrical, and connected and layered and so on as needed"). Keep his
masses, heights and hanging parts, then clean them up:

1. Snap to the grid.
2. Make near-symmetric shapes symmetric.
3. Join pieces that almost touch into one structure.
4. Give floating parts holders, with fillets only where there is room.
5. Add the theme's layers, 3D, inside and bars.
6. Keep it beatable.

Read his edited theme layout back with `node tools/designs.js layout [--apply]` (fetch db collection `designdraw` into
local/designs/db first). Show his drawing beside the result. Drawings come from the catalogue's Themes tab whiteboard (db collection
`designdraw`) and the viewer's ✏ draw (DRAW.md).

## Where to look

STRUCTURES.md (library and ranking), LEGO.md (bricks and combining), BRICKGEN.md (generating), DECOART.md (the look:
designs, holders, inside, themes), HAZARDS.md (hazards and their dressing), CRAFT.md (how RobTop builds and dresses),
knowledge/checklist.md (every target, with its check).

## Section types (a level's longer stretches)

What each layout section type is (stair path, wave corridor, swing, ...) with its motif, what to vary and how it grows
longer or shorter to fit the beats, plus where gravity portals go: **knowledge/section_types.md** (Evgeni 2026-11-27: "dont
need save these copy by copy, but to understand for the future how to make similar according to beats"). The
clicks-first generator (tools/clickfirst.js, thread "Generate our own structures") builds from it.

