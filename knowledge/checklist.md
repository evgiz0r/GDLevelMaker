# Checklist: before a GDLM level goes to the user

One page for the style, polish and difficulty sessions. Every item is a target with its number, the
tool that checks it, and where it comes from. Targets are for an **Easy/Normal** level (the tiers
the user can playtest now) unless a line says otherwise. Each line points to its source: change a
number there, then here. Last updated 2026-11-23.

**Use what others learned** (the user, 2026-11-23: "if we gain knowledge on the fly, I do want sessions
to use it"). Before each new level or round: `git pull`, then re-read this page, TASTE.md,
STRUCTURES.md and your own area's doc (`git log` since your last round shows what changed). A new
lesson goes in here as one line **in the same commit as the fix**, and where it can, it also becomes a
check in make.js / score.js, so a level cannot miss it even when nobody reads this page: code beats
docs. `tools/wip.js put` adds `[checklist <commit>]` to every wip note, so each version says which
checklist it was built against.

## Fair (the user's playtests: a death must be the player's fault)

- [ ] **`node tools/fairness.js <level>` passes** (also `tools/score.js` gate "fairness"). It
  flags (FAIL): an input forced right after a portal (into a jumping mode: the first input's window
  closes < 250 ms after it; into the wave: the button must change within 300 ms); a jump mark where
  jumping kills and no jump is needed; a sawtooth floor at a portal into a ground mode; 3+ orb taps
  under 500 ms apart; a wave input with a window under 150 ms. WARN: a blind two-step opener, a stray
  mark. Fitted on the user's labelled deaths: 12/12 unfair caught, the fair one left alone.
  (DIFFICULTY.md "Fairness")
- [ ] **No prejumps.** Every jump is cued by what is in front. `node tools/sightread.js <level>`.
  (design.md "Fairness", GDLM 41)
- [ ] **No forced input right after a mode or speed portal.** Give an empty lead-in: cube ~6 blocks,
  ship ~8, others 2-3. A flat, readable floor before the portal; never a portal on a block's end or a
  corner. `node tools/tiercheck.js <level> --tier Easy` (lead-in per section). (levels/modes_low_tier.md;
  GDLM 44 entrance, GDLM 46 wall after the wave)
- [ ] **Recovery**: never land and have to jump again within ~100 ms, unless it is a steady rhythm.
  (design.md, score.js recovery gate; GDLM 42 v3)
- [ ] **Orbs**: mostly single (~3/4). A chain of at most 2-3, ~3 blocks apart, climbing ~1 block in
  all, one orb kind, and a hazard-free surface ~1 block after the last orb. Never a chain where a
  normal click falls to death or that carries the cube toward the screen's edge.
  `node tools/obstacles.js orbchains --file <level>`. (levels/obstacles.md section 5; GDLM 46 v2)
- [ ] **A landing you can stay on**: after an orb, pad or obstacle, the cube lands on one surface across
  every early/late press; never a gap in front of a wall that needs an instant jump (a dead end).
  `node tools/polish.js <level> --dry --passes none` (two 4 ms jumps there). (critiques.md GDLM 44 v12)
- [ ] **Orbs at the natural arc**: the first orb of a chain where a normal take-off jump tops out (at the
  apex or up to 1.5 blocks after), each next orb where the previous orb's arc tops out; the take-off has
  >= 100 ms with the orbs clicked when reached; orbs on the hazard row's halves or thirds.
  `node tools/orbarc.js <level>`. (critiques.md GDLM 44 v12/v13: "unnatural and small")
- [ ] **Clean spike groups**: no overlapping or doubled hazards, no 1-2 column gap inside a group, no
  hazard within 1.5 blocks before a pad. `node tools/clusters.js <level>`. (critiques.md GDLM 44 v13)
- [ ] **Orbs where the arc already goes**, not grazed at the arc's edge. (design.md; GDLM 44 orb ladder)
- [ ] **Jump arrows only on real inputs**, ~1 block above the surface, right at the press (the hazard
  ~0.5 block ahead). Used where a jump can't be read in time (after a drop, after a portal, the first of
  a pattern), consistently, small and softer than the level. `node tools/obstacles.js indicators --file <level>`.
  (levels/obstacles.md section 4, design.md "Telegraph"; GDLM 45 v4, GDLM 46 v2)
- [ ] **The shown route clicks where a human would**: early in a wide window (~40% in), never at its
  last safe frame -- the replay, the arrows and the level map all follow it. `node tools/windows.js <level>`
  ("pressed N% in"; lib/natural.js step 4). (the user on GDLM 45's ball: "i would prefer to click way earlier")
- [ ] **Wave**: zigzag turns wider than ~100 ms apart; no head-on slopes at a portal exit; the exit
  portal over a flat floor, level stretches at the turns (patterns.js wave-zigzag `flat`, `leadGap`).
  (design.md; GDLM 44/46 real-game deaths)
- [ ] **Jump marks sit low**: about 1 block over the surface (make.js lifts them 30 units), and none
  where no jump is needed (placed from the natural replay's real jumps only). (GDLM 45 v5, the user)
- [ ] **Invisible parts**: ghosted (faint), fully hidden only for a chunk already seen. No fakes at
  Easy/Normal. (design.md, STYLE.md; GDLM 42; official_01-08.md)
- [ ] **Even difficulty**: no late spike. Timing per tier: DIFFICULTY.md "Tier ladder" (Easy: no window
  under ~60 ms, almost none under 100 ms). (players_say.md: a late spike makes a rating feel wrong)

## Not bland (rated Easy/Normal 2.0-2.1 medians)

- [ ] **Built on blocks**: a block, slab or slope in ~45-50% of the cube columns; most spikes on
  ledges, steps, pit edges and under overhangs, not lone on the floor. `node tools/obstacles.js structure --file <level>`.
  (levels/obstacles.md section 1; GDLM 41-45 had 13%)
- [ ] **Structures from the library**: compose.js puts a ranked structure (STRUCTURES.md) in every
  plain 1x cube section by default; a hand-made spec names them as `"s:<id>"`. Mechanics our levels
  never had rank first. `node tools/structures.js rank`.
- [ ] **Variety**: ~15 kinds of gameplay thing; 4-5 modes and 2-3 speeds; a portal every ~2-3 s;
  ~25 orbs and pads per minute; at least ~90% of the chunks new. `node tools/variety.js <level>`.
  (levels/variety.md)
- [ ] **Pace of new things**: something new every 2-5 s in the first half; yellow pad and orb by ~10 s,
  a second mode by ~15-20 s. Show each new thing once or twice, calmly, then move on.
  `node tools/obstacles.js intro --file <level>`. (levels/obstacles.md section 3)
- [ ] **Sections read as Easy/Normal**, with no "off" or "sparse" ones. `node tools/tiercheck.js <level> --tier Easy`.
  (levels/modes_low_tier.md, tier_ref.json)
- [ ] **Sync loosely**: portals, speed changes and the drop on the music's moments; most clicks free.
  `node tools/sync.js`. (SYNC.md "How much to sync")

## Looks like 2.2, not 1.0 (levels/modern_look.md)

- [ ] **Budget**: ~10-50 objects per block. Fall Out, the user's own example, has 13; the levels the
  user played have a median 46. GDLM was at 1. `node tools/modern_look.js <level>`.
- [ ] **Layers**: ~40-60% behind the play (B5-B1), ~15-40% in front (T2-T4: glow, dots, particles,
  see-through set pieces), never a solid fill over the play.
- [ ] **Colours that must show from the first frame live in the header**, not only in colour triggers:
  the editor runs no triggers (the signature looked pale in the phone editor). Channels 988-999 are the
  signature's. (VISUALS.md "Signature")
- [ ] **Colour**: every deco object on a colour channel, ~30-60 channels with a third blending, HSV on
  ~40-50% of objects.
- [ ] **A theme with one motif through the level, and a new scene per section**: palette, frame and
  background change with the mode. Mode changes and look changes go together.
- [ ] **Motion**: moves, fades and particles (~100-150 each per minute). The camera changes at
  sections. Shaders only at transitions and drops.
- [ ] **Shape of the level**: a dense opening, quiet 1-2 s transitions, the biggest effects at the
  drops. A title at the start and credits at the end. Don't copy any one level's art.
- [ ] **Readable, measured**: hazard contrast against what is behind it >= 3 in every frame (median
  >= 4.5), at most 4% of a frame as bright as the hazards, no flashing (< 0.5 per second, no frame-to-
  frame brightness jump over 0.12). `node tools/readability.js <level> --gate` (renders, ~8 min).
  GDLM 44 v13: contrast 1.05-1.48 ("waaaay too flashy ... hard to tell what kills you"); round 2: 4.7-6.
- [ ] **Readable**: hazards stand out (white, grey or their own colour against the scene); no deco
  that looks like an orb, pad or hazard: fires only far back, small and dim. Hazards keep their contrast
  on the drop's brightest frame (one sky flash, not two). Behind a portal a dark disc, never a lit one.
  `node tools/shoot.js` the drop. (design.md; players_say.md: saws taken for orbs; POLISH.md hellgate)

## Name, description, signature (the user, 2026-11-23)

- [ ] **The name is final from the first upload**: the GD server refuses a renamed shared level, so the
  name is `GDLM NN <words that fit the level>` from the start, never a working label. (PUBLISH.md, STYLE.md 2b)
- [ ] **The description is for players**: one or two short sentences with some flavour, ending with
  " -- Made by Claude (and some humans)", ~150 characters at most. Notes (beats, dB, song ids,
  versions) go in the spec's `"notes"`. make.js stops over 180 and warns over 150 or on note-like text.
- [ ] **The signature ends every GDLM level** (robot + human): make.js adds it by default; opt out
  only with `"signature": false`.

## Ratable (rating.md)

- [ ] **60 s or more** (30 s is the minimum; RobTop's tip). GDLM 41-44 were 12-31 s.
- [ ] **Runs well**: no lag from wasted objects (RobTop: lag can block a rating or lower its tier).
- [ ] **Gameplay first**: the top complaint about Legendaries is beautiful with weak gameplay (players_say.md).
- [ ] **User coins**, if any: a real optional challenge on a harder route, never free.

## Then

- [ ] Put the level in the viewer: `node tools/wip.js put <level> --session <name> --note "..."`.
- [ ] Read the user's marks (`node tools/marks.js`), and after their playtest copy their words into
  `knowledge/critiques.md`. A new lesson goes into the right doc and onto this list.
