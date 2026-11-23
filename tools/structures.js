// node tools/structures.js list                      -- the library: id, mode, tags, entry/exit state
// node tools/structures.js check [id ...] [--fast]   -- build each one into a small test level, solve it, run the
//                                                      gates; results -> knowledge/structures.json (shared)
// node tools/structures.js build <id>               -- its test level -> local/structures/<id>.gdlvl (look:
//                                                      node tools/textmap.js local/structures/<id>.gdlvl)
// node tools/structures.js rank                      -- the ranked list (rules: STRUCTURES.md "Ranking")
// node tools/structures.js page [--out file.html]    -- one self-contained page: ranked list + a picture of each
//                                                      (shapes + the solved path; no GD art), for the phone
//
// Structures: short layouts, 1-3 s of play each, that a level is made of (the user, 2026-11-23: "a
// structure list of many simple layouts and maybe rank them. By layout I mean like 1-3 seconds of
// play"). Each one is a function of its args that returns spec objects ([type, col, row, extra], col 0 =
// its first column, row 0 = the first row above the ground) like tools/patterns.js, plus what it needs
// on entry and what it leaves (mode, gravity, size, speed, the row the player is on), so they chain.
// STRUCTURES.md: the format, the checks, the ranking and what is open. Shapes are generic GD
// vocabulary, nothing copied from a particular level.
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "knowledge", "structures.json");

const LIB = [];
// o: { mode, tags, tier (the designer's guess: Easy..Insane), doc, args (defaults), build(a) -> {objects,
//      width, exitRow}, needs {mode, grav, mini, speed}, leaves (defaults to needs) }
function S(id, o) {
  const needs = Object.assign({ mode: o.mode || "cube", grav: 1, mini: false, speed: "1x" }, o.needs || {});
  LIB.push(Object.assign({ id, args: {} }, o, { needs, leaves: Object.assign({}, needs, o.leaves || {}) }));
}
const range = (a, b) => Array.from({ length: Math.max(0, b - a) }, (_, i) => a + i);
const spikes = (c0, c1, row = 0) => range(c0, c1).map(c => ["spike", c, row]);
const hang = (c0, c1, row) => range(c0, c1).map(c => ["spike", c, row, { rot: 180 }]);
const blocks = (c0, c1, r0, r1) => { const o = []; for (let c = c0; c < c1; c++) for (let r = r0; r < r1; r++) o.push(["block", c, r]); return o; };

// ---------------------------------------------------------------- cube, on the ground
S("stairs-up", { tags: ["platforming", "stairs"], tier: "Easy",
  doc: "three one-block steps up, three wide each, then off the top: rhythm jumps with no hazard but the walls",
  build: () => ({ objects: [...blocks(0, 3, 0, 1), ...blocks(3, 6, 0, 2), ...blocks(6, 9, 0, 3)], width: 9 }) });
S("ledge-drop", { tags: ["platforming", "drop"], tier: "Easy",
  doc: "up two steps onto a ledge, drop off its end over a spike on the floor below",
  build: () => ({ objects: [...blocks(0, 3, 0, 1), ...blocks(3, 9, 0, 2), ...spikes(11, 12)], width: 13 }) });
S("block-hops", { tags: ["platforming", "pit"], tier: "Normal",
  // (blocks at one height 2 apart are walked across without a jump: they rise a row each, 3 apart)
  doc: "three floating blocks rising over a spike pit: jump block to block",
  build: () => ({ objects: [...spikes(0, 14), ...blocks(2, 4, 1, 2), ...blocks(7, 9, 2, 3), ...blocks(12, 14, 3, 4)], width: 15 }) });
S("triple-spike", { tags: ["spikes"], tier: "Normal",
  doc: "the classic three-spike jump, alone (the hardest plain ground jump at 1x)",
  build: () => ({ objects: spikes(0, 3), width: 3 }) });
S("spike-slab-spike", { tags: ["spikes", "platforming"], tier: "Easy",
  doc: "spike, a 1-high block to land on, spike: two jumps in a row with a rest on the block",
  build: () => ({ objects: [...spikes(0, 1), ...blocks(3, 6, 0, 1), ...spikes(8, 9)], width: 9 }) });

// ---------------------------------------------------------------- orbs and pads
S("pink-orb-pit", { tags: ["orb", "pink orb"], tier: "Easy",
  doc: "a short pit with a pink orb: a small extra hop (the pink orb is weaker than yellow)",
  build: () => ({ objects: [...spikes(1, 6), ["pink orb", 2, 2]], width: 7 }) });
S("red-pad-tower", { tags: ["pad", "red pad", "platforming"], tier: "Normal",
  doc: "a red pad throws the cube onto a 4-high tower over spikes; walk off its end",
  build: () => ({ objects: [["red pad", 0, 0], ...spikes(1, 6), ...blocks(6, 10, 0, 4)], width: 12 }) });
S("blue-orb-ceiling", { tags: ["orb", "blue orb", "gravity", "ceiling run"], tier: "Normal",
  doc: "a blue orb over a spike floor flips the cube onto a ceiling; a hanging blue orb flips it back down",
  build: () => ({ objects: [...spikes(1, 12), ...blocks(0, 13, 5, 6), ["blue orb", 2, 2], ["blue orb", 10, 3]], width: 14 }) });
S("blue-pad-ceiling", { tags: ["pad", "blue pad", "gravity", "ceiling run"], tier: "Normal",
  doc: "a blue pad sends the cube up onto a ceiling over a spike floor; a blue pad hanging from the ceiling sends it down",
  build: () => ({ objects: [["blue pad", 0, 0], ...spikes(2, 11), ...blocks(0, 12, 5, 6), ["blue pad", 10, 4, { flipY: true }]], width: 13 }) });
// a green orb flips gravity and jumps in the NEW gravity's "up" (lib/physics.js): from the floor it
// throws the cube down first, so it is met high, after a pad (a ground jump cannot reach it high enough)
S("green-orb-flip", { tags: ["orb", "green orb", "pad", "gravity", "ceiling run"], tier: "Normal",
  doc: "a yellow pad throws the cube up to a green orb (a jump that also flips gravity) onto a high ceiling; a second green orb brings it down",
  build: () => ({ objects: [["yellow pad", 0, 0], ...spikes(1, 14), ...blocks(0, 15, 8, 9), [1022, 4, 4], [1022, 11, 6]], width: 16 }) });
S("dash-orb-pit", { tags: ["orb", "dash orb"], tier: "Normal",
  doc: "a green dash orb over a long pit: hold to dash straight across, release over the landing",
  build: () => ({ objects: [...spikes(1, 11), ["green dash orb", 2, 2], ...blocks(11, 14, 0, 2)], width: 14 }) });

// ---------------------------------------------------------------- gravity and size
S("gravity-tunnel", { tags: ["gravity", "gravity portal", "ceiling run"], tier: "Normal",
  doc: "a yellow gravity portal: the cube runs upside down under a ceiling, over two hanging spikes, and a blue portal brings it back",
  build: () => ({ objects: [["gravity down", 0, 1], ...blocks(0, 16, 5, 7), ...hang(6, 7, 4), ...hang(11, 13, 4),
    ["gravity up", 15, 3], ...blocks(15, 16, 0, 2)], width: 17 }) });
S("mini-low-roof", { tags: ["mini", "size portal"], tier: "Normal",
  doc: "a mini portal, then spikes under a low roof that only a mini jump clears; a normal-size portal after",
  needs: { mini: false },
  build: () => ({ objects: [[101, 0, 1], ...spikes(5, 6), ...blocks(3, 15, 3, 4), ...spikes(9, 11), [99, 16, 1]], width: 17 }) });
S("speed-burst", { tags: ["speed", "speed portal"], tier: "Normal",
  doc: "a 2x speed portal, three jumps at double speed, back to 1x",
  build: () => ({ objects: [["2x speed", 0, 1], ...spikes(7, 8), ...spikes(16, 18), ...spikes(25, 26), ["1x speed", 31, 1]], width: 32 }) });

// ---------------------------------------------------------------- other modes (the harness adds the portal in and out)
S("robot-long-jump", { mode: "robot", tags: ["robot", "pit"], tier: "Normal",
  doc: "the robot holds its jump to clear a 5-wide pit onto a block",
  build: () => ({ objects: [...spikes(0, 5), ...blocks(5, 8, 0, 1)], width: 9, exitRow: 2 }) });
S("ufo-pillars", { mode: "ufo", tags: ["ufo"], tier: "Normal",
  doc: "the UFO flaps over two pillars above a spike floor",
  build: () => ({ objects: [...spikes(0, 15), ...blocks(4, 5, 0, 3), ...blocks(10, 11, 0, 4)], width: 15, exitRow: 5 }) });
S("ship-gates", { mode: "ship", tags: ["ship"], tier: "Normal",
  doc: "the ship weaves through three walls: open at the top, then the bottom, then the top",
  build: () => ({ objects: [...blocks(5, 6, 0, 5), ...blocks(11, 12, 5, 10), ...blocks(17, 18, 0, 5)], width: 20, exitRow: 4 }) });
S("wave-steps", { mode: "wave", tags: ["wave"], tier: "Normal",
  doc: "the wave goes up over a floor block and down under a roof block",
  build: () => ({ objects: [...blocks(4, 8, 0, 3), ...blocks(11, 15, 7, 10)], width: 17, exitRow: 4 }) });
S("ball-flips", { mode: "ball", tags: ["ball"], tier: "Normal",
  doc: "the ball rolls between floor and roof spikes: flip to the roof, flip back",
  build: () => ({ objects: [...blocks(0, 20, 5, 8), ...spikes(4, 6), ...hang(11, 13, 4), ...spikes(17, 19)], width: 20, exitRow: 1 }) });
S("spider-zaps", { mode: "spider", tags: ["spider"], tier: "Normal",
  doc: "the spider teleports to the roof over floor spikes and back down under roof spikes",
  build: () => ({ objects: [...blocks(0, 20, 5, 9), ...spikes(4, 7), ...hang(11, 14, 4), ...spikes(17, 19)], width: 20, exitRow: 1 }) });
S("swing-wiggle", { mode: "swing", tags: ["swing"], tier: "Normal",
  doc: "the swing flips its gravity past a floor wall and a roof wall",
  build: () => ({ objects: [...blocks(5, 6, 0, 5), ...blocks(11, 12, 5, 10), ...blocks(17, 18, 0, 5)], width: 20, exitRow: 4 }) });

// ---------------------------------------------------------------- batch 2 (2026-11-23)
const slope = (c, r, down) => ["slope", c, r, down ? { flipX: true } : {}];
S("double-rhythm", { tags: ["spikes"], tier: "Easy",
  doc: "two doubles four apart: jump, land, jump -- a beat-like rhythm",
  build: () => ({ objects: [...spikes(0, 2), ...spikes(6, 8)], width: 8 }) });
S("pillar-pair", { tags: ["platforming", "pillar"], tier: "Easy",
  doc: "onto a 2-high pillar, over a spike, onto the next pillar, down",
  build: () => ({ objects: [...blocks(0, 2, 0, 1), ...blocks(2, 4, 0, 2), ...spikes(4, 6), ...blocks(6, 8, 0, 2)], width: 9 }) });
S("descend-steps", { tags: ["platforming", "stairs", "drop"], tier: "Easy",
  doc: "up onto a 3-high block, then down three steps with a spike at the foot",
  build: () => ({ objects: [...blocks(0, 2, 0, 1), ...blocks(2, 4, 0, 2), ...blocks(4, 7, 0, 3), ...blocks(7, 10, 0, 2), ...blocks(10, 13, 0, 1), ...spikes(15, 16)], width: 16 }) });
S("low-roof-hops", { tags: ["spikes", "ceiling"], tier: "Normal",
  doc: "spikes under a low roof: short jumps only, a full jump hits the roof",
  build: () => ({ objects: [...blocks(0, 14, 4, 5), ...spikes(3, 4), ...spikes(9, 11)], width: 14 }) });
S("slope-up-jump", { tags: ["slope", "platforming"], tier: "Easy",
  doc: "run up a 45-degree slope onto a 1-high ledge and jump the spike on it",
  build: () => ({ objects: [slope(0, 0), ...blocks(1, 9, 0, 1), ["spike", 5, 1]], width: 10 }) });
S("slope-down-spike", { tags: ["slope", "drop"], tier: "Easy",
  doc: "up a step, then slide down a slope and jump a spike at its foot",
  build: () => ({ objects: [...blocks(0, 4, 0, 1), slope(4, 0, true), ...spikes(7, 8)], width: 9 }) });
S("orb-pit", { tags: ["orb", "yellow orb", "pit"], tier: "Easy",
  doc: "a yellow orb at the top of the jump over a long spike pit (orbs on the arc, make.js)",
  build: () => ({ objects: [["pattern", "orb-pit", 0, 0, { n: 6 }]], width: 9 }) });
S("orb-ladder-2", { tags: ["orb", "yellow orb", "pit"], tier: "Normal",
  doc: "two yellow orbs in a row over a pit, each at the top of the arc that reaches it",
  build: () => ({ objects: [["pattern", "orb-ladder", 0, 0, { n: 2 }]], width: 12 }) });
S("pad-launch", { tags: ["pad", "yellow pad"], tier: "Easy",
  doc: "a yellow pad over three spikes",
  build: () => ({ objects: [["pattern", "pad-launch", 0, 0, { n: 3 }]], width: 6 }) });
S("pink-pad-step", { tags: ["pad", "pink pad", "platforming"], tier: "Easy",
  doc: "a pink pad's small hop onto a 1-high block over a spike",
  build: () => ({ objects: [["pink pad", 0, 0], ["spike", 1, 0], ...blocks(2, 6, 0, 1)], width: 7 }) });
S("red-orb-wall", { tags: ["orb", "red orb"], tier: "Normal",
  doc: "a red orb's big jump over a 3-high wall, spikes before and after it",
  build: () => ({ objects: [...spikes(1, 3), ["red orb", 2, 2], ...blocks(5, 7, 0, 3), ...spikes(7, 10)], width: 11 }) });
S("blue-orb-bounce", { tags: ["orb", "blue orb", "gravity"], tier: "Normal",
  doc: "a blue orb flips the cube up over a spike pit; a second hanging orb flips it straight back before the roof",
  build: () => ({ objects: [...spikes(1, 12), ...blocks(0, 13, 7, 8), ["blue orb", 2, 2], ["blue orb", 8, 5]], width: 13 }) });
S("upside-hops", { tags: ["gravity", "gravity portal", "ceiling run"], tier: "Normal",
  doc: "upside down under a ceiling: jump (down) over two hanging doubles, then a blue portal back",
  build: () => ({ objects: [["gravity down", 0, 1], ...blocks(0, 18, 5, 7), ...hang(5, 7, 4), ...hang(11, 13, 4),
    ["gravity up", 17, 3], ...blocks(17, 18, 0, 2)], width: 19 }) });
S("gravity-pad-gap", { tags: ["gravity", "gravity portal", "blue pad", "pad"], tier: "Normal",
  doc: "a gravity portal over a pit throws the cube to a ceiling; a hanging blue pad drops it to the floor after",
  build: () => ({ objects: [...spikes(2, 10), ["gravity down", 3, 1], ...blocks(2, 12, 5, 6), ["blue pad", 10, 4, { flipY: true }]], width: 13 }) });
S("half-speed-triple", { tags: ["speed", "speed portal"], tier: "Easy",
  doc: "a 0.5x portal: two triples at half speed (slow, floaty), then back to 1x",
  build: () => ({ objects: [["0.5x speed", 0, 1], ...spikes(5, 7), ...spikes(12, 14), ["1x speed", 17, 1]], width: 18 }) });
S("triple-speed-run", { tags: ["speed", "speed portal"], tier: "Normal",
  doc: "a 3x portal: two singles far apart at triple speed, then back to 1x",
  build: () => ({ objects: [["3x speed", 0, 1], ...spikes(10, 11), ...spikes(24, 26), ["1x speed", 36, 1]], width: 37 }) });
S("teleport-up", { tags: ["teleport"], tier: "Normal",
  doc: "a teleport portal lifts the cube onto a high ledge over a run of spikes",
  build: () => ({ objects: [[747, 0, 1, { props: { 54: "120" } }], ...spikes(1, 9), ...blocks(1, 9, 4, 5)], width: 10 }) });
S("spider-orb-cube", { tags: ["orb", "spider orb", "gravity", "ceiling run"], tier: "Normal",
  doc: "the cube touches a spider orb and snaps to the ceiling, runs upside down, a spider pad snaps it back",
  build: () => ({ objects: [...spikes(2, 12), ...blocks(0, 14, 5, 6), ["spider orb", 2, 1], ["spider pad", 11, 4, { flipY: true }]], width: 14 }) });
S("mini-ship", { mode: "ship", tags: ["ship", "mini"], tier: "Normal",
  doc: "a mini ship through two narrow gaps",
  build: () => ({ objects: [[101, 0, 4], ...blocks(6, 7, 0, 3), ...blocks(6, 7, 6, 10), ...blocks(13, 14, 0, 4), ...blocks(13, 14, 7, 10), [99, 17, 4]], width: 18, exitRow: 4 }) });
S("ship-tunnel", { mode: "ship", tags: ["ship"], tier: "Normal",
  doc: "a ship corridor whose floor and roof rise and fall (the ship-tunnel pattern)",
  build: () => ({ objects: [["pattern", "ship-tunnel", 0, 0, { w: 20, gap: 5, waves: 1 }]], width: 20, exitRow: 4 }) });
S("ship-teeth", { mode: "ship", tags: ["ship"], tier: "Normal",
  doc: "a flat ship corridor with spike teeth alternating floor and roof",
  build: () => ({ objects: [...blocks(0, 20, 0, 1), ...blocks(0, 20, 8, 10), ["spike", 5, 1], ["spike", 10, 7, { rot: 180 }], ["spike", 15, 1]], width: 20, exitRow: 4 }) });
S("wave-zigzag", { mode: "wave", tags: ["wave"], tier: "Normal",
  doc: "the wave's 45-degree zigzag corridor, level stretches at the turns",
  build: () => ({ objects: [["pattern", "wave-zigzag", 0, 0, { seg: 3, legs: 4, gap: 5, flat: 2, lead: 3, slopes: true }]], width: 20, exitRow: 4 }) });
S("wave-gap", { mode: "wave", tags: ["wave"], tier: "Normal",
  doc: "the wave threads two gaps in walls, one low, one high",
  build: () => ({ objects: [...blocks(5, 6, 3, 10), ...blocks(12, 13, 0, 6)], width: 15, exitRow: 4 }) });
S("ball-orb", { mode: "ball", tags: ["ball", "orb", "yellow orb"], tier: "Normal",
  doc: "the ball takes a yellow orb over a floor pit (a ball's orb jump is lower)",
  build: () => ({ objects: [...blocks(0, 16, 7, 8), ...spikes(4, 9), ["yellow orb", 5, 1]], width: 16, exitRow: 1 }) });
S("ball-pillars", { mode: "ball", tags: ["ball", "platforming"], tier: "Normal",
  doc: "the ball flips between a floor pillar and a roof pillar",
  build: () => ({ objects: [...blocks(0, 18, 7, 8), ...blocks(5, 7, 0, 3), ...blocks(11, 13, 4, 7), ...spikes(15, 17)], width: 18, exitRow: 1 }) });
S("ufo-tunnel", { mode: "ufo", tags: ["ufo"], tier: "Normal",
  doc: "the UFO keeps low under a spiked roof over a spiked floor: small steady flaps",
  build: () => ({ objects: [...spikes(0, 14), ...blocks(0, 14, 6, 7), ...hang(5, 6, 5), ...hang(10, 11, 5)], width: 14, exitRow: 2 }) });
S("ufo-orb", { mode: "ufo", tags: ["ufo", "orb", "yellow orb"], tier: "Normal",
  doc: "the UFO takes a yellow orb up over a tall wall",
  build: () => ({ objects: [...spikes(0, 12), ["yellow orb", 4, 3], ...blocks(7, 8, 0, 6)], width: 12, exitRow: 6 }) });
S("robot-steps", { mode: "robot", tags: ["robot", "platforming", "stairs"], tier: "Normal",
  doc: "the robot climbs two 2-high steps (a held jump goes higher)",
  build: () => ({ objects: [...blocks(3, 7, 0, 2), ...blocks(7, 11, 0, 4), ...spikes(11, 13)], width: 14, exitRow: 1 }) });
S("robot-triple", { mode: "robot", tags: ["robot", "spikes"], tier: "Easy",
  doc: "the robot's short tap over a triple, then a held jump onto a 2-high block",
  build: () => ({ objects: [...spikes(2, 5), ...blocks(10, 12, 0, 2)], width: 14, exitRow: 1 }) });
S("spider-steps", { mode: "spider", tags: ["spider", "platforming"], tier: "Normal",
  doc: "the spider zaps up onto a ledge and down off it under a roof",
  build: () => ({ objects: [...blocks(0, 18, 7, 9), ...blocks(6, 12, 0, 3), ...spikes(3, 6), ...spikes(12, 15)], width: 18, exitRow: 1 }) });

// ---------------------------------------------------------------- craft (CRAFT.md: the shapes of Jumper and xStep, as
// patterns, never their coordinates). Built over a PIT -- the low floor spikes (id 9, sunk 13 units like
// the official ones) -- because the official floor is a hazard 39-69% of the time; the player lives on
// the pieces. The craft pass (tools/craftkit.js, spec "craft": true) adds the rods and chains.
const pit = (c0, c1) => range(c0, c1).map(c => [9, c, 0, { dy: -13 }]);
// pillars `w` wide, `gap` apart, with these heights (rows), a pit between them; a calm landing after
function pillarRun(heights, w, gap, capGap) {
  // the first pillar is a 3-wide doorstep (stepped onto from the floor: a 1-wide one asked for a jump
  // 1.7 blocks ahead of it, a prejump)
  const o = [], xs = heights.map((_, i) => i ? 3 + gap + (i - 1) * (w + gap) : 0);
  heights.forEach((h, i) => o.push(...blocks(xs[i], xs[i] + (i ? w : 3), 0, h)));
  const wd = i => i ? w : 3;
  for (let i = 1; i < heights.length; i++) o.push(...pit(xs[i - 1] + wd(i - 1), xs[i]));
  const end = xs[xs.length - 1] + w;
  // capGap: hanging columns over each gap, their ends capGap rows over the higher pillar beside it
  if (capGap) for (let i = 1; i < heights.length; i++) {
    const c = xs[i - 1] + wd(i - 1) + Math.floor(gap / 2), r = Math.max(heights[i - 1], heights[i]) + capGap;
    o.push(...blocks(c, c + 1, r, 12));
  }
  o.push(...pit(end, end + 2), ...blocks(end + 2, end + 5, 0, 1));
  return { objects: o, width: end + 5 };
}
S("pillar-hop", { tags: ["platforming", "pillar", "pit"], tier: "Normal",
  doc: "pillars 2 wide over a pit, each a row higher or lower than the last: every jump changes height (Jumper's opening, rebuilt)",
  args: { heights: [1, 2, 3, 2, 1], w: 2, gap: 2 },
  build: a => pillarRun(a.heights, a.w, a.gap) });
S("pillar-climb", { tags: ["platforming", "pillar", "pit"], tier: "Normal",
  doc: "a climb of pillars over a pit, up a row at each, then a drop to a low one",
  args: { heights: [1, 2, 3, 4, 2], w: 2, gap: 2 },
  build: a => pillarRun(a.heights, a.w, a.gap) });
S("capped-hop", { tags: ["platforming", "pillar", "pit", "ceiling"], tier: "Normal",
  doc: "pillars over a pit under hanging columns: the column ends sit 4 rows over the pillars, framing every arc",
  args: { heights: [1, 2, 1, 2, 3], w: 2, gap: 2, cap: 4 },
  build: a => pillarRun(a.heights, a.w, a.gap, a.cap) });
S("slab-steps", { tags: ["platforming", "pit", "floating"], tier: "Normal",
  doc: "floating 3-wide steps over a pit, a row higher each (the craft pass hangs them on chains)",
  args: { n: 3, gap: 3 },
  build: a => { const o = [...blocks(0, 3, 0, 1)]; let c = 3 + a.gap;
    o.push(...pit(3, 3 + a.gap));
    for (let i = 0; i < a.n; i++) { o.push(...blocks(c, c + 3, i + 1, i + 2), ...pit(c, c + 3 + a.gap)); c += 3 + a.gap; }
    o.push(...blocks(c, c + 3, 0, a.n)); return { objects: o, width: c + 3 }; } });
S("lantern-orb", { tags: ["orb", "yellow orb", "pit", "pillar"], tier: "Normal",
  doc: "a yellow orb hung on a chain over a pit between two pillars: jump off the first, tap the orb, land on the second",
  build: () => ({ objects: [...blocks(0, 2, 0, 2), ...pit(2, 8), ["yellow orb", 4, 4], ...blocks(8, 10, 0, 2), ...pit(10, 11), ...blocks(11, 14, 0, 1)], width: 14 }) });
S("stepped-pyramid", { tags: ["platforming", "stairs", "pit", "set piece"], tier: "Easy",
  doc: "a symmetric stepped pyramid (2-wide steps, 3 up, a top, 3 down) with spikes on the outer steps' edges: the 1.x set piece",
  build: () => { const o = [];
    for (let i = 0; i < 3; i++) { o.push(...blocks(2 * i, 16 - 2 * i, 0, i + 1)); }
    o.push(["spike", 1, 1], ["spike", 14, 1], ...pit(16, 18), ...blocks(18, 21, 0, 1)); return { objects: o, width: 21 }; } });
S("ceiling-hop", { tags: ["gravity", "gravity portal", "pillar", "ceiling run"], tier: "Normal",
  doc: "upside down: hanging columns of different lengths are the floor, a spiked roof-pit between them (Jumper's green part, as a shape)",
  build: () => { const o = [["gravity down", 0, 1], ...blocks(0, 4, 8, 12)];
    const lens = [3, 4, 3, 2]; let c = 4;
    for (const L of lens) { o.push(...range(c, c + 2).map(x => [9, x, 11, { dy: 13, rot: 180 }]), ...blocks(c + 2, c + 4, 12 - L, 12)); c += 4; }
    o.push(...range(c, c + 2).map(x => [9, x, 11, { dy: 13, rot: 180 }]), ...blocks(c + 2, c + 6, 8, 12), ["gravity up", c + 5, 6], ...blocks(c + 5, c + 8, 0, 1));
    return { objects: o, width: c + 8 }; } });

S("ship-weave", { mode: "ship", tags: ["ship", "pillar"], tier: "Normal",
  doc: "the ship weaves along a drifting line between spike-tipped ground pillars and hanging columns over a pit floor (Jumper's ship, as a shape)",
  args: { line: [5, 6, 5, 4, 3, 4], step: 4, open: 3 },
  build: a => { const o = [], n = a.line.length;
    a.line.forEach((c, i) => { const x = 3 + i * a.step;
      if (i % 2 === 0) { o.push(...blocks(x, x + 1, 0, c - a.open + 1), ["spike", x, c - a.open + 1]); }
      else { o.push(...blocks(x, x + 1, c + a.open, 11), ["spike", x, c + a.open - 1, { rot: 180 }]); } });
    const w = 3 + n * a.step + 3; o.push(...pit(0, w)); return { objects: o, width: w, exitRow: a.line[n - 1] }; } });
S("ship-lanterns", { mode: "ship", tags: ["ship", "floating"], tier: "Normal",
  doc: "floating blocks with a spike above and below, hung on chains (the craft pass), up and down the ship's band: pass between them (xStep's floating pieces)",
  args: { rows: [3, 7, 4, 7, 3], step: 5 },
  build: a => { const o = []; a.rows.forEach((r, i) => { const x = 3 + i * a.step; o.push(["block", x, r], ["spike", x, r + 1], ["spike", x, r - 1, { rot: 180 }]); });
    const w = 3 + a.rows.length * a.step + 3; o.push(...pit(0, w)); return { objects: o, width: w, exitRow: 5 }; } });

// ---------------------------------------------------------------- the harness: one small test level per structure
const MODE_PORTAL = { ship: "ship portal", ball: "ball portal", ufo: "ufo portal", wave: "wave portal", robot: "robot portal", spider: "spider portal", swing: "swing portal", cube: "cube portal" };
// blocks of calm run after a mode portal before the structure (the lead-in medians of rated low-tier
// levels, knowledge/levels/modes_low_tier.md: cube 6, ship 8, wave/robot 3, UFO 2; ball/spider/swing ~4)
const LEADIN = { cube: 6, ship: 8, wave: 4, robot: 4, ufo: 4, ball: 5, spider: 5, swing: 6 };
const START = 8;   // the cube runs 8 blocks before anything
function testSpec(st, args) {
  const a = Object.assign({}, st.args, args || {});
  const r = st.build(a), objs = [];
  let col = START;
  if (st.needs.mode !== "cube") { objs.push([MODE_PORTAL[st.needs.mode], col, 1]); col += 1; }
  col += st.needs.mode !== "cube" ? LEADIN[st.needs.mode] : 4;
  const s0 = col;
  for (const e of r.objects) objs.push(e[0] === "pattern" ? ["pattern", e[1], s0 + e[2], e[3], e[4]] : [e[0], s0 + e[1], e[2], e[3]]);
  let end = s0 + r.width, exitCol = null;
  if (st.leaves.mode !== "cube") {   // back to the cube 4 blocks on: a wall of cube portals (rows 1, 4, 7
    // cover rows 0-8, a block on row 9), so the test does not depend on the exit height; a level frames
    // one portal at the structure's exitRow instead
    const ex = end + 4; exitCol = ex;
    for (const rr of [1, 4, 7]) objs.push(["cube portal", ex, rr]);
    objs.push(["block", ex, 9]);
    end = ex + 1;
  }
  objs.push(["block", end + 10, 0]);   // the end of the run-out
  return { spec: { name: "structure " + st.id, speed: st.needs.speed, style: "classic", indicators: false, signature: false, objects: objs },
    s0, s1: s0 + r.width, width: r.width, exitCol };
}

// ---------------------------------------------------------------- checks
function check(st, args, opts = {}) {
  const { GD } = require("./io.js");
  Object.assign(GD, require("../lib/difficulty.js"));
  const { build } = require("./make.js"), { scoreLevel } = require("./score.js");
  const t = testSpec(st, args);
  const { level } = build(t.spec, "structure " + st.id);
  const sc = scoreLevel(level, { difficulty: { minWindowMs: 50 } }, { fairness: !opts.fast });
  const r = sc.solution, x0 = t.s0 * 30, x1 = t.s1 * 30;
  const res = { id: st.id, mode: st.needs.mode, tags: st.tags, tier: st.tier, doc: st.doc, needs: st.needs, leaves: st.leaves,
    width: t.width, ok: !!(r && r.ok), gates: Object.fromEntries(sc.gates.map(g => [g.name, g.status])), notes: {} };
  // the test's own wall of exit portals: only one of the three is touched, by design
  const sk = sc.gates.find(g => g.name === "skips");
  if (sk && sk.status !== "PASS" && t.exitCol != null && sk.value.split("; ").every(m => m.includes("cube portal at block " + t.exitCol) || m.startsWith("cube portal at block " + t.exitCol))) { sk.status = "PASS"; res.gates.skips = "PASS"; }
  for (const g of sc.gates) if (g.status !== "PASS") res.notes[g.name] = g.value + (g.note ? " -- " + g.note : "");
  const SP = GD.PHYS ? null : null;
  if (res.ok) {
    const w = GD.makeWorld(level.objects, level.header), p = GD.run(w, r.events).path;
    const inR = x => x >= x0 - 45 && x <= x1 + 30;
    const pr = r.clicks.filter(c => c.type === "press" && inR(c.x));
    res.presses = pr.length;
    // windows: lib/difficulty.js's human route (one tap per jump, as a player does it: the solver's
    // fewest-clicks route skips steps and reads tight where a person is not), else the solver's own
    const hum = sc.difficulty ? sc.difficulty.actions.map(a => ({ x: (p[a.tick] || {}).x || 0, ms: a.ms })).filter(a => inR(a.x) && a.ms > 0) : [];
    let ms = hum.length ? hum.map(a => a.ms) : pr.map(c => c.ms).filter(m => m > 0);
    res.humanInputs = hum.length;
    res.minWindowMs = ms.length ? Math.round(Math.min(...ms)) : null;
    const tin = p.findIndex(q => q.x >= x0), tout = p.findIndex(q => q.x >= x1);
    res.seconds = +(((tout < 0 ? p.length : tout) - tin) / GD.PHYS.TPS).toFixed(2);
    res.difficulty = sc.difficulty ? +sc.difficulty.logAttempts.toFixed(2) : null;
    res.label = sc.difficulty ? GD.difficultyLabel(sc.difficulty.logAttempts) : null;
    // the picture's data: objects and path from 2 blocks before to 2 after (the exit portal too)
    const xa = x0 - 60, xb = Math.max(x1 + 60, ...level.objects.filter(o => o.x > x1 && o.x < x1 + 200).map(o => o.x + 30));
    res.pic = { x0: xa, x1: xb,
      objects: level.objects.filter(o => o.x >= xa - 15 && o.x <= xb + 15).map(o => [o.id, o.x, o.y, o.rot || 0, o.flipY ? 1 : 0]),
      path: p.filter((q, i) => q.x >= xa && q.x <= xb && i % 4 === 0).map(q => [Math.round(q.x), Math.round(q.y), q.mode]),
      presses: r.clicks.filter(c => c.type === "press" && c.x >= xa && c.x <= xb).map(c => { const q = p[c.tick] || {}; return [Math.round(q.x || c.x), Math.round(q.y || 0)]; }) };
  } else res.dies = sc.gates.find(g => g.name === "beatable").value;
  return res;
}

// ---------------------------------------------------------------- ranking (STRUCTURES.md "Ranking")
// usage: the share of real rated levels (the 22 official + the community levels in local/community)
// that have the structure's key mechanic at all; variety: how rarely our own GDLM levels use it.
const BLK = [1, 2, 3, 4, 6, 7, 40, 62, 63, 64, 65, 66, 68, 69, 70, 71, 72, 74, 75, 76, 77, 78, 81, 82, 83, 90, 91, 92, 93, 94, 95, 96, 116, 117, 118, 119, 120, 121, 122, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175];
const SPK = [8, 39, 103, 9, 61, 243, 244, 363, 364, 365, 366, 367, 368, 446, 447, 667, 989, 991, 720, 1715, 1716, 1717, 1718, 1719, 1720, 1721, 1722, 1723, 1724, 1725];
const KEY = { spikes: SPK, platforming: BLK, stairs: BLK, drop: BLK, pit: SPK, pillar: BLK, ceiling: BLK, slope: [1338, 1339, 289, 291, 294, 295, 296, 297, 299, 301, 309, 311, 315, 317, 321, 323, 325, 327, 331, 333, 337, 339, 343, 345, 353, 355], "pink orb": [141], "red pad": [1332], "blue orb": [84],
  "blue pad": [67], "green orb": [1022], "dash orb": [1704, 1751], "gravity portal": [10, 11], mini: [101], speed: [200, 202, 203, 1334],
  robot: [745], ufo: [111], ship: [13], wave: [660], ball: [47], spider: [1331], swing: [1933], "yellow orb": [36], "yellow pad": [35],
  teleport: [747], "ceiling run": [10, 11, 84, 67, 1022], "spider orb": [3004], "spider pad": [3005], "red orb": [1333], "pink pad": [140],
  "size portal": [99, 101] };
function usageTables() {
  const cache = path.join(ROOT, "local", "structures_usage.json");
  try { const c = JSON.parse(fs.readFileSync(cache, "utf8")); if (c.v === 3) return c; } catch (e) {}
  const { readGdlvl } = require("./io.js"), corpus = require("./corpus.js");
  const real = [], ours = [];
  for (let n = 1; n <= 22; n++) { try { real.push(new Set(corpus.official(n).objects.map(o => o.id))); } catch (e) {} }
  const cdir = path.join(ROOT, "local", "community");
  if (fs.existsSync(cdir)) for (const f of fs.readdirSync(cdir).filter(f => f.endsWith(".gdlvl"))) { try { real.push(new Set(readGdlvl(path.join(cdir, f)).level.objects.map(o => o.id))); } catch (e) {} }
  for (const f of fs.readdirSync(path.join(ROOT, "levels")).filter(f => /^gdlm_/.test(f))) { try { ours.push(new Set(readGdlvl(path.join(ROOT, "levels", f)).level.objects.map(o => o.id))); } catch (e) {} }
  const share = (sets, ids) => sets.length ? sets.filter(s => ids.some(i => s.has(i))).length / sets.length : 0;
  const out = { v: 3, nReal: real.length, nOurs: ours.length, real: {}, ours: {} };
  for (const [k, ids] of Object.entries(KEY)) { out.real[k] = +share(real, ids).toFixed(3); out.ours[k] = +share(ours, ids).toFixed(3); }
  fs.mkdirSync(path.dirname(cache), { recursive: true });
  fs.writeFileSync(cache, JSON.stringify(out, null, 1));
  return out;
}
function rank(results) {
  const U = usageTables();
  const keyOf = r => { const ks = [r.mode !== "cube" ? r.mode : null, ...r.tags].filter(k => k && KEY[k]); return ks.length ? ks : ["spikes"]; };
  for (const r of results) {
    const ks = keyOf(r);
    // the rarest of its mechanics decides (a blue-orb ceiling run is as common as blue orbs, not as spikes)
    const real = Math.min(...ks.map(k => U.real[k] ?? 0)), ours = Math.min(...ks.map(k => U.ours[k] ?? 0));
    // the level-wide timing / difficulty gates are the solver's route over the whole test level: the
    // structure's own window (human route, minWindowMs >= 50) stands for them here
    const g = Object.entries(r.gates || {}).filter(([k]) => k !== "timing" && k !== "difficulty").map(([, v]) => v);
    const fails = g.filter(s => s === "FAIL").length, warns = g.filter(s => s === "WARN").length;
    const fair = !r.ok ? 0 : Math.max(0, Math.min(1, ((r.minWindowMs ?? 200) - 40) / 160));
    const pps = r.ok && r.seconds ? r.presses / r.seconds : 0;
    // a prejump WARN is the approximate check on levels with modes (sweep solver): not counted
    const read = !r.ok ? 0 : Math.max(0, 1 - 0.5 * (r.gates.prejumps === "FAIL" ? 1 : 0)
      - 0.3 * (r.gates.fairness === "FAIL" ? 1 : 0) - 0.1 * (r.gates.fairness === "WARN" ? 1 : 0) - 0.1 * (r.gates.recovery === "WARN" ? 1 : 0)
      // exact hops instead of reactions (score.js "reactive", the user on GDLM 45 v6): pushed well down
      - 0.4 * (r.gates.reactive && r.gates.reactive !== "PASS" ? 1 : 0)
      - 0.15 * Math.max(0, pps - 2.5));
    const variety = 1 - ours, usage = Math.sqrt(real);
    r.rank = { variety: +variety.toFixed(2), usage: +usage.toFixed(2), fairness: +fair.toFixed(2), readability: +read.toFixed(2),
      realShare: real, oursShare: ours, keys: ks, ready: r.ok && fails === 0 && (r.minWindowMs ?? 999) >= 50, fails, warns };
    // nothing to press (a pad-only stretch): something to watch, not to play -- x 0.85
    r.score = r.rank.ready ? Math.round(100 * (0.3 * variety + 0.25 * usage + 0.25 * fair + 0.2 * read) * (r.presses === 0 ? 0.85 : 1)) : 0;
  }
  return results.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

// ---------------------------------------------------------------- pictures (shapes only: no GD art leaves the PC)
const MODE_COL = { cube: "#3c9", ship: "#f5a", ball: "#f44", ufo: "#fb3", wave: "#3bf", robot: "#ccc", spider: "#b6f", swing: "#fd3" };
function svgOf(r, GD) {
  const P = r.pic; if (!P) return "";
  const W = P.x1 - P.x0, top = Math.max(150, ...P.objects.map(o => o[2] + 45), ...P.path.map(q => q[1] + 45)), H = top + 20;
  const Y = y => (top - y).toFixed(1), X = x => (x - P.x0).toFixed(1), out = [];
  out.push(`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${r.id}">`);
  out.push(`<rect x="0" y="${Y(0)}" width="${W}" height="20" class="g"/>`);
  for (const [id, x, y, rot, fy] of P.objects) {
    const d = GD.objInfo(id), k = d.kind;
    if (k === "solid") out.push(`<rect x="${X(x - 15)}" y="${Y(y + 15)}" width="30" height="30" class="b"/>`);
    else if (k === "hazard") { const up = ((rot % 360) + 360) % 360 !== 180; out.push(`<path d="M${X(x - 13)} ${Y(up ? y - 15 : y + 15)} L${X(x)} ${Y(up ? y + 13 : y - 13)} L${X(x + 13)} ${Y(up ? y - 15 : y + 15)}Z" class="h"/>`); }
    else if (k === "orb") out.push(`<circle cx="${X(x)}" cy="${Y(y)}" r="11" fill="${d.color || "#ff0"}" class="o"/>`);
    else if (k === "pad") out.push(`<rect x="${X(x - 12)}" y="${Y(fy ? y + 15 : y - 9)}" width="24" height="6" rx="2" fill="${d.color || "#ff0"}"/>`);
    else if (["mode", "gravity", "speed", "size", "teleport"].includes(k)) out.push(`<rect x="${X(x - 8)}" y="${Y(y + 42)}" width="16" height="84" rx="8" fill="none" stroke="${d.color || "#fff"}" stroke-width="4"/>`);
    else if (k === "slope") out.push(`<path d="M${X(x - 15)} ${Y(y - 15)} L${X(x + 15)} ${Y(y + 15)} L${X(x + 15)} ${Y(y - 15)}Z" class="b"/>`);
  }
  let seg = [], last = null;
  const flush = () => { if (seg.length > 1) out.push(`<polyline points="${seg.join(" ")}" fill="none" stroke="${MODE_COL[last] || "#3c9"}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>`); };
  for (const [x, y, m] of P.path) { if (m !== last) { flush(); seg = seg.slice(-1); last = m; } seg.push(`${X(x)},${Y(y)}`); }
  flush();
  for (const [x, y] of P.presses) out.push(`<circle cx="${X(x)}" cy="${Y(y)}" r="7" class="p"/>`);
  out.push("</svg>");
  return out.join("");
}
function page(results) {
  const { GD } = require("./io.js");
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const rows = results.map((r, i) => `
<article class="card${r.rank.ready ? "" : " bad"}">
  <header><span class="n">${r.rank.ready ? i + 1 : "–"}</span><h2>${esc(r.id)}</h2><span class="sc">${r.score}</span></header>
  <div class="pic">${svgOf(r, GD) || `<p class="dies">${esc(r.dies || "not beaten")}</p>`}</div>
  <p class="doc">${esc(r.doc)}</p>
  <p class="tags"><b>${r.mode}</b>${r.tags.map(t => ` · ${esc(t)}`).join("")} · ${r.seconds ?? "?"} s · ${r.presses ?? "?"} press${r.presses === 1 ? "" : "es"} · tightest ${r.minWindowMs ?? "?"} ms · ${r.label || "?"}</p>
  <p class="bars">variety ${r.rank.variety} · real levels ${Math.round(100 * r.rank.realShare)}% · fairness ${r.rank.fairness} · readability ${r.rank.readability}</p>
  ${Object.keys(r.notes || {}).length ? `<details><summary>${r.rank.fails} fail, ${r.rank.warns} warn</summary><ul>${Object.entries(r.notes).map(([k, v]) => `<li><b>${k}</b> ${esc(v)}</li>`).join("")}</ul></details>` : ""}
</article>`).join("");
  // a page fragment (the Artifact host wraps it in its own document; browsers render it as is)
  return `<title>GDLM Structures</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Space+Grotesk:wght@600;700&family=JetBrains+Mono:wght@500&display=swap">
<style>
/* layout: one column of cards, each a picture of the layout over its numbers, best first */
:root{--bg:#f3f4f7;--card:#fff;--ink:#1b1d24;--mute:#626775;--line:#dfe2ea;--sky:#e8f0fb;--ground:#b9bfcc;--block:#3d4658;--haz:#d8324a;--acc:#1f8a5b;--warn:#b26a00;
--f-head:"Space Grotesk",system-ui,sans-serif;--f-body:Inter,system-ui,-apple-system,"Segoe UI",sans-serif;--f-mono:"JetBrains Mono",ui-monospace,Consolas,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#12141a;--card:#1b1e27;--ink:#e9ebf1;--mute:#9aa0ae;--line:#2b2f3b;--sky:#172131;--ground:#3b4150;--block:#97a3bb;--haz:#ff5a6e;--acc:#45c58a;--warn:#f0a63a;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#12141a;--card:#1b1e27;--ink:#e9ebf1;--mute:#9aa0ae;--line:#2b2f3b;--sky:#172131;--ground:#3b4150;--block:#97a3bb;--haz:#ff5a6e;--acc:#45c58a;--warn:#f0a63a;color-scheme:dark}
body{background:var(--bg);color:var(--ink);font:15px/1.5 var(--f-body);padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
main{max-width:820px;margin:0 auto;padding-block:16px 32px;display:flex;flex-direction:column;gap:12px}
h1{font:700 24px/1.2 var(--f-head);margin:8px 0 0;text-wrap:balance}.lead{color:var(--mute);margin:0;max-width:65ch}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:6px;min-width:0}
.card.bad{border-style:dashed}.card header{display:flex;align-items:baseline;gap:10px}
.card h2{font:500 15px/1.3 var(--f-mono);margin:0;flex:1;min-width:0;overflow-wrap:anywhere}
.n{font:700 14px var(--f-head);color:var(--mute);min-width:1.8em;font-variant-numeric:tabular-nums}.sc{font:700 20px var(--f-head);color:var(--acc);font-variant-numeric:tabular-nums}
.bad .sc{color:var(--warn)}
.pic{background:var(--sky);border-radius:6px;overflow:hidden}.pic svg{display:block;width:100%;height:auto;max-height:210px}
.g{fill:var(--ground)}.b{fill:var(--block)}.h{fill:var(--haz)}.o{stroke:var(--ink);stroke-opacity:.25;stroke-width:2}.p{fill:var(--card);stroke:var(--ink);stroke-width:3}
.doc{margin:0}.tags,.bars{color:var(--mute);font-size:13px;margin:0}.tags b{color:var(--ink)}.dies{padding:16px;margin:0;color:var(--haz)}
details{font-size:13px;color:var(--mute)}details ul{margin:4px 0 0;padding-left:18px}
</style>
<main>
<h1>Structures, ranked</h1>
<p class="lead">Short layouts (1 to 3 seconds of play) for GDLM levels. Each one was built into a test level, solved and put through every gate. Score = 30% variety (how rarely our levels use it) + 25% use in real levels + 25% fairness margin (tightest timing window) + 20% readability. The path is coloured by mode: green cube, pink ship, red ball, orange UFO, blue wave, grey robot, purple spider. Dots are presses. Dashed cards are not ready yet.</p>
${rows}
</main>`;
}

// ---------------------------------------------------------------- as patterns: "s:<id>" in a spec or a brief's `use`
// Every structure that starts and ends as a normal-size cube in normal gravity is placeable from a cube
// stretch: its own portals are inside it; another mode gets its portal on row 1 at col 0, the lead-in,
// and the wall of cube portals after it (as in the test). Speed: a structure that needs a speed other
// than the stretch's is not registered (a level picks those by hand). Nested patterns are expanded here.
function asPattern(st, P) {
  return a => {
    const r = st.build(Object.assign({}, st.args, a || {})), o = [];
    const flat = objs => { for (const e of objs) if (e[0] === "pattern") flat(P[e[1]].fn(e[4] || {}).objects.map(([t, c, rr, x]) => [t, c + e[2], rr + (e[3] || 0), x])); else o.push(e); };
    let off = 0;
    if (st.needs.mode !== "cube") off = 1 + LEADIN[st.needs.mode];
    const body = [];
    flat(r.objects); body.push(...o.splice(0));
    if (st.needs.mode !== "cube") o.push([MODE_PORTAL[st.needs.mode], 0, 1]);
    for (const [t, c, rr, x] of body) o.push([t, c + off, rr, x]);
    let width = off + r.width;
    if (st.leaves.mode !== "cube") { const ex = width + 4; for (const rr of [1, 4, 7]) o.push(["cube portal", ex, rr]); o.push(["block", ex, 9]); width = ex + 1; }
    return { objects: o, width };
  };
}
function register(P) {
  for (const st of LIB) {
    const n = st.needs, l = st.leaves;
    if (n.grav !== 1 || l.grav !== 1 || n.mini || l.mini || n.speed !== "1x") continue;
    P["s:" + st.id] = { doc: st.doc, fn: asPattern(st, P), structure: st.id };
  }
  return P;
}
// the ranked, ready structures (knowledge/structures.json), best first; filter by mode / max tier
const TIERS = ["Easy", "Normal", "Hard", "Harder", "Insane", "Demon"];
function ranked(opts = {}) {
  const res = rank(Object.values(load().structures)).filter(r => r.rank.ready);
  return res.filter(r => (!opts.mode || r.mode === opts.mode) && (!opts.maxTier || TIERS.indexOf(r.tier) <= TIERS.indexOf(opts.maxTier))
    && (!opts.registered || (r.needs.grav === 1 && !r.needs.mini && r.needs.speed === "1x")));
}

function load() { try { return JSON.parse(fs.readFileSync(OUT, "utf8")); } catch (e) { return { structures: {} }; } }
// one structure per line: small diffs when one is re-checked
function save(db) {
  const NL = String.fromCharCode(10);
  const body = Object.entries(db.structures).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => JSON.stringify(k) + ": " + JSON.stringify(v));
  fs.writeFileSync(OUT, '{"structures": {' + NL + body.join("," + NL) + NL + "}}" + NL);
}
function byId(id) { return LIB.find(s => s.id === id); }

module.exports = { LIB, byId, testSpec, check, rank, page, load, save, register, ranked, svgOf };

if (require.main === module) {
  const [cmd, ...rest] = process.argv.slice(2);
  const ids = rest.filter(a => !a.startsWith("--") && !/\.html$/.test(a));
  if (cmd === "list") for (const s of LIB) console.log(s.id.padEnd(20), s.needs.mode.padEnd(7), s.tier.padEnd(7), s.tags.join(", "));
  else if (cmd === "build") {
    const { GD, writeGdlvl } = require("./io.js"), { build } = require("./make.js");
    for (const id of ids) {
      const t = testSpec(byId(id)), b = build(t.spec), out = path.join(ROOT, "local", "structures", id + ".gdlvl");
      fs.mkdirSync(path.dirname(out), { recursive: true }); writeGdlvl(out, b.rec, b.level);
      console.log("->", out, `(structure from block ${t.s0} to ${t.s1})`);
    }
  }
  else if (cmd === "check") {
    const db = load(), todo = ids.length ? ids.map(byId).filter(Boolean) : LIB;
    for (const st of todo) {
      const t0 = Date.now(), r = check(st, null, { fast: rest.includes("--fast") });
      // keep the picture data out of the committed file's diff noise: still stored, it is small
      db.structures[st.id] = r;
      console.log(`${st.id.padEnd(20)} ${r.ok ? "beaten" : "DIES  "} ${r.presses ?? "-"} presses, ${r.seconds ?? "-"} s, tightest ${r.minWindowMs ?? "-"} ms, ${r.label || "-"}; ` +
        Object.entries(r.gates).filter(([, v]) => v !== "PASS").map(([k, v]) => `${k} ${v}`).join(", ") + ` (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
      save(db);
    }
  } else if (cmd === "rank") {
    const res = rank(Object.values(load().structures));
    res.forEach((r, i) => console.log(String(r.rank.ready ? i + 1 : "-").padStart(3), String(r.score).padStart(3), r.id.padEnd(20), r.mode.padEnd(7),
      `var ${r.rank.variety} use ${r.rank.usage} fair ${r.rank.fairness} read ${r.rank.readability}`, r.rank.ready ? "" : `NOT READY (${r.rank.fails} fail)`));
  } else if (cmd === "page") {
    const oi = rest.indexOf("--out"), out = oi >= 0 ? rest[oi + 1] : path.join(ROOT, "local", "structures", "structures.html");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, page(rank(Object.values(load().structures))));
    console.log("->", out);
  } else console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("// node")).join("\n"));
}
