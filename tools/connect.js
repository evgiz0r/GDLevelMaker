// node tools/connect.js spec   -- the holder gallery spec (specs/lab_holders.json; then make.js it)
// node tools/connect.js <level.gdlvl> [--route <wip.json | solution.json>] [--design layered] [--pal fire|ice] [--style chain|rope|rod|gdchain]
//                       [--out <file>] [--before <file>]
//   -> the level with its gameplay structures dressed in one structure design (tools/structdesign.js) and joined by
//      background connectors; --before writes the same without the connectors (for a side by side)
//
// CONNECTED STRUCTURES (DECOART.md "Connected structures"; Evgeni 2026-11-26: "connect structures slightly better
// visually, making a level look like an extended one and not a set of island structures"; "structures should in general
// connect, unless something else happens on the level ( bigger space, transition )").
// Measured first (tools/islands.js): RobTop's GAMEPLAY is islands too -- 5.3 solid islands a screen in cube pieces vs our
// 2-3 -- so the joining is visual, done with deco behind the play. Connectors here are deco only (gameplay unchanged):
//   holders  a floating island is held by something soft -- a rope, a chain, a thin rod (Evgeni: "something soft like
//            chain/rope/holder/soft extender [...] as if something is holding it ( from either top or bottom )"): two
//            near its ends, one in the middle of a 1-wide one; hanging up to the top of the view or a structure above
//            (a high island), or standing on them down to the ground or a structure below (a low one); not always down
//            to the ground
//   bridge   two islands at the same height at most `maxGap` blocks apart: a rope / chain across
// Never in the player's way: no connector cell where the route passes (the player's box, a block of margin), so a
// connector never reads as something to land on or hit. No joining across a "transition": a portal (mode, gravity,
// speed) between two islands, or a gap wider than maxGap ("bigger space").
// Look: thin, on B1 behind everything, in the design's line colour a bit darker, with a small fitting where it meets
// the structure: never as thick as a block, so it never reads as something to land on.
//   connectors(blocks, {pathCells, breaks, maxGap}) -> [{kind, x0, y0, x1, y1}] in level units
//   draw(conns, C, {style}) -> deco objects; STYLES rope | chain | rod | gdchain
"use strict";
const fs = require("fs"), path = require("path");
const K = require("./scenekit.js"), SD = require("./structdesign.js");
const SOLID = id => (id >= 1 && id <= 7) || id === 1338;
const PORTAL = new Set([12, 13, 47, 111, 660, 745, 1331, 1933, 10, 11, 200, 201, 202, 203, 1334, 99, 101, 286, 287]);

function connectors(blocks, o = {}) {
  const maxGap = o.maxGap ?? 4, path = o.pathCells || new Set(), breaks = (o.breaks || []).slice().sort((a, b) => a - b);
  const sts = SD.structures(blocks);
  if (!sts.length) return [];
  const { ox, oy } = sts[0];
  const all = new Set(); for (const st of sts) for (const k of st.S) all.add(k);
  const X = c => ox + c * 30, Y = r => oy + r * 30;   // a cell's left / bottom edge in level units
  const inPath = (x, y) => path.has(Math.floor(x / 30) + "," + Math.floor(y / 30));
  const isl = sts.map(st => { const cs = [...st.S].map(k => k.split(",").map(Number));
    return { cs, c0: Math.min(...cs.map(q => q[0])), c1: Math.max(...cs.map(q => q[0])), r0: Math.min(...cs.map(q => q[1])), r1: Math.max(...cs.map(q => q[1])) }; })
    .sort((a, b) => a.c0 - b.c0);
  const ground = Math.round(-oy / 30), top = ground + (o.topRow ?? 11);   // rows: the ground's, the top of the view
  const out = [], crosses = (xa, xb) => breaks.some(b => b > xa && b < xb);
  // a vertical line at x from y0 upward (dir 1) or downward (dir -1) until a solid, the ground or the top: its far end,
  // or null when the route crosses it
  const run = (x, y0, dir) => {
    const c = Math.floor((x - ox) / 30);
    for (let r = Math.floor((y0 - oy) / 30) + (dir > 0 ? 0 : -1); ; r += dir) {
      if (dir < 0 && r < ground) return 0;
      if (dir > 0 && r > top) return Y(top + 1);
      if (all.has(c + "," + r)) return dir > 0 ? Y(r) : Y(r + 1);
      if (inPath(x, Y(r) + 15)) return null;
    }
  };
  for (const I of isl) {
    if (I.r0 <= ground || I.r1 >= top) continue;   // on the ground or into the top: held already
    // where: two holders near the ends of a wide island, one in the middle of a narrow one (Evgeni: "on the
    // edges/middle of the structures ( like 2 ropes holding a brick, or from the other side a brick floating on two ropes )")
    const w = I.c1 - I.c0 + 1, xs = w >= 2 ? [X(I.c0) + 9, X(I.c1 + 1) - 9] : [X(I.c0) + 15];
    const edge = (x, side) => { const c = Math.floor((x - ox) / 30), rs = I.cs.filter(q => q[0] === c).map(q => q[1]);
      return side > 0 ? Y(Math.max(...rs) + 1) : Y(Math.min(...rs)); };
    // from above (hanging) or below (standing): the side whose lines are all clear; above first when the island is high
    const tryDir = d => { const segs = []; for (const x of xs) { const y0 = edge(x, d), y1 = run(x, y0, d); if (y1 == null || Math.abs(y1 - y0) < 6) return null; segs.push({ kind: d > 0 ? "hang" : "stand", x0: x, x1: x, y0: Math.min(y0, y1), y1: Math.max(y0, y1) }); } return segs; };
    const high = I.r0 - ground >= 4, pick = (high ? [1, -1] : [-1, 1]).map(tryDir).find(Boolean);
    if (pick) out.push(...pick);
  }
  // a soft line between two close islands at the same height (a rope bridge), not across a portal or a wide gap
  for (let i = 0; i + 1 < isl.length; i++) {
    const A = isl[i], B = isl.slice(i + 1).find(b => b.c0 > A.c1); if (!B) continue;
    const gap = B.c0 - A.c1 - 1; if (gap < 1 || gap > maxGap || crosses(X(A.c1 + 1), X(B.c0))) continue;
    const topA = Math.max(...A.cs.filter(q => q[0] === A.c1).map(q => q[1])), topB = Math.max(...B.cs.filter(q => q[0] === B.c0).map(q => q[1]));
    if (topA !== topB) continue;
    const y = Y(topA) + 20; let ok = true; for (let c = A.c1 + 1; c < B.c0; c++) if (inPath(X(c) + 15, y)) { ok = false; break; }
    if (ok) out.push({ kind: "bridge", x0: X(A.c1 + 1), x1: X(B.c0), y0: y, y1: y });
  }
  return out;
}
// the holder's look: soft and thin, behind the play, in the structure's own colours (darker), with a small fitting where
// it meets the structure. style: rope | chain | rod | gdchain (GD's hanging chain 41, shows with GD's art only)
const STYLES = ["rope", "chain", "rod", "gdchain"];
function draw(conns, C, o = {}) {
  const style = o.style || "chain", out = [], v = o.value ?? 0.75, put = (id, x, y, p) => out.push(K.obj(id, x, y, Object.assign({ z: "B1", zo: 2 }, p)));
  const hsv = k => `0a1a${(v * k).toFixed(2)}a0a0`;
  for (const q of conns) {
    const vert = q.x0 === q.x1, len = vert ? q.y1 - q.y0 : q.x1 - q.x0, cx = (q.x0 + q.x1) / 2, cy = (q.y0 + q.y1) / 2, rot = vert ? 0 : 90;
    // the fitting at the structure: a small plate on the attached end(s)
    const ends = q.kind === "hang" ? [[q.x0, q.y0]] : q.kind === "stand" ? [[q.x0, q.y1]] : [[q.x0, q.y0], [q.x1, q.y1]];
    if (style === "rope") {
      put(211, cx, cy, { ch: C.line, sx: vert ? 0.07 : len / 30, sy: vert ? len / 30 : 0.07, hsv: hsv(0.8) });
      for (const [x, y] of ends) put(211, x, y, { ch: C.line, s: 0.2, rot: 45, hsv: hsv(1) });
    } else if (style === "chain") {
      const n = Math.max(1, Math.round(len / 9));
      for (let k = 0; k < n; k++) { const t = (k + 0.5) / n, x = vert ? q.x0 : q.x0 + len * t, y = vert ? q.y0 + len * t : q.y0;
        put(211, x, y, k % 2 ? { ch: C.line, sx: vert ? 0.06 : 0.3, sy: vert ? 0.3 : 0.06, hsv: hsv(0.7) } : { ch: C.line, s: 0.22, rot: 45, hsv: hsv(1) }); }
    } else if (style === "rod") {
      put(211, cx, cy, { ch: C.base, sx: vert ? 0.15 : len / 30, sy: vert ? len / 30 : 0.15, hsv: hsv(0.6) });
      put(211, cx, cy, { ch: C.line, sx: vert ? 0.04 : len / 30, sy: vert ? len / 30 : 0.04, hsv: hsv(0.9) });
      for (const [x, y] of ends) put(211, x, y, { ch: C.line, sx: vert ? 0.4 : 0.12, sy: vert ? 0.12 : 0.4, hsv: hsv(1) });
    } else if (style === "gdchain") {
      const L = 2.32 * 30 * 0.6, n = Math.max(1, Math.ceil(len / L));
      for (let k = 0; k < n; k++) { const t = (k + 0.5) / n; put(41, vert ? q.x0 : q.x0 + len * t, vert ? q.y0 + len * t : q.y0, { ch: C.line, s: 0.6, rot, hsv: hsv(1) }); }
    }
  }
  return out;
}
// the cells the route passes through, with a block of margin (level cells: floor(x / 30), floor(y / 30))
function routeCells(level, events) {
  const { GD } = require("./io.js"), w = GD.makeWorld(level.objects, level.header), run = GD.run(w, events), out = new Set();
  for (const s of run.path) { const [x, y] = GD.worldXY ? GD.worldXY(s) : [s.x, s.y];
    for (let dx = -45; dx <= 45; dx += 15) for (let dy = -45; dy <= 45; dy += 15) out.add(Math.floor((x + dx) / 30) + "," + Math.floor((y + dy) / 30)); }
  return out;
}

// the gallery: the same islands once per holder style (deco only: the player runs on the ground under them)
const GALLERY = [[0, 2], [1, 2], [2, 2], [6, 6], [7, 6], [11, 3], [14, 4], [15, 4], [19, 4], [20, 4], [24, 5], [25, 5], [26, 5], [24, 6]];
function spec() {
  const objects = ["// holder styles for island structures: the same islands per style; flat run"], copies = [];
  let c = 14;
  for (const [i, st] of STYLES.entries()) { for (const [dc, r] of GALLERY) objects.push(["block", c + dc, r]); copies.push({ style: st, c0: c, c1: c + 27, pal: i % 2 ? "ice" : "fire" }); c += 36; }
  return { name: "GDLM holders", desc: "Island structures held by ropes, chains and rods (tools/connect.js).",
    notes: "Evgeni 2026-11-26: 'something soft like chain/rope/holder/soft extender [...] as if something is holding it'; DECOART.md 'Connected structures'",
    colours: { bg: [10, 14, 30], ground: [4, 6, 14] }, scene: "tools/scenes/holdgallery.js", copies, outro: 76, signature: {}, objects };
}
module.exports = { connectors, draw, routeCells, STYLES, spec };
if (require.main === module) {
  const a = process.argv.slice(2), opt = n => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : null; };
  if (a[0] === "spec") { fs.writeFileSync("specs/lab_holders.json", JSON.stringify(spec(), null, 1) + "\n"); console.log("wrote specs/lab_holders.json"); process.exit(0); }
  if (!a[0]) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(0); }
  const { readGdlvl, writeGdlvl } = require("./io.js"), B = require("./blockdesigns.js");
  const R = readGdlvl(a[0]), level = R.level;
  let events = null;
  if (opt("--route")) { const j = JSON.parse(fs.readFileSync(opt("--route"), "utf8")); events = (j.solution || j).events; }
  const pathCells = events ? routeCells(level, events) : new Set();
  const blocks = level.objects.filter(o => SOLID(o.id));
  const breaks = level.objects.filter(o => PORTAL.has(o.id)).map(o => o.x);
  const palName = opt("--pal") || "fire", ch0 = palName === "ice" ? 912 : 922, pal = B.channels(B.PAL[palName], ch0);
  const header = K.channels(level.header, pal.defs);
  const dressed = SD.dress(blocks, opt("--design") || "layered", pal.C);
  const conns = connectors(blocks, { pathCells, breaks });
  const tally = {}; for (const q of conns) tally[q.kind] = (tally[q.kind] || 0) + 1;
  console.log(`${blocks.length} blocks, ${SD.structures(blocks).length} structures; connectors: ${JSON.stringify(tally)}${events ? "" : " (no route given: nothing kept clear for the player!)"}`);
  const put = (file, objs) => { writeGdlvl(file, R.rec, { header, objects: level.objects.concat(objs) }); console.log("-> " + file); };
  if (opt("--before")) put(opt("--before"), dressed);
  put(opt("--out") || a[0].replace(/\.gdlvl$/, "_connected.gdlvl"), dressed.concat(draw(conns, pal.C, { style: opt("--style") || "chain" })));
}
