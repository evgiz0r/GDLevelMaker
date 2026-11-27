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
  // the island's cells ride along (not enumerable: not printed) so draw() can keep a pillar's fillets on the structure
  const withCells = (q, I) => Object.defineProperty(q, "cells", { value: { set: new Set(I.cs.map(c => c.join(","))), ox, oy }, enumerable: false });
  // a vertical line at x from y0 upward (dir 1) or downward (dir -1) until a solid, the ground or the top: its far end,
  // or null when the route crosses it
  const run = (x, y0, dir) => {
    const c = Math.floor((x - ox) / 30);
    for (let r = Math.floor((y0 - oy) / 30) + (dir > 0 ? 0 : -1); ; r += dir) {
      if (dir < 0 && r < ground) return 0;
      if (dir > 0 && r > top) return Y(top + 1);
      if (all.has(c + "," + r)) return dir > 0 ? Y(r) : Y(r + 1);
      if (inPath(x, Y(r) + 15) || (o.hazCells && o.hazCells.has(Math.floor(x / 30) + "," + Math.floor((Y(r) + 15) / 30)))) return null;   // nor through a spike or saw
    }
  };
  for (const I of isl) {
    if (I.r1 >= top) continue;   // into the top: held already
    if (I.r0 <= ground) {
      // on the ground, but a ledge of it can still hang in the air (Evgeni 2026-11-27, hellgate col 97: a slab touching a
      // structure only at a corner, "no holders from the bottom ... connected on the bottom (to the structure on the left,
      // and to the bottom on the right)"): every overhang -- a run of 2+ cells with nothing under them, above the ground
      // row -- stands on a pillar at its outer end (the end away from the support), when the route leaves room
      const has = (c, r) => I.cs.some(q => q[0] === c && q[1] === r), under = new Map();
      for (const [c, r] of I.cs) if (r > ground && !has(c, r - 1) && (!under.has(c) || under.get(c) > r)) under.set(c, r);
      const cols = [...under.keys()].sort((a, b) => a - b);
      for (let i = 0; i < cols.length;) { let j = i; while (j + 1 < cols.length && cols[j + 1] === cols[j] + 1 && under.get(cols[j + 1]) === under.get(cols[i])) j++;
        const c0 = cols[i], c1 = cols[j], r = under.get(c0); i = j + 1; if (c1 - c0 + 1 < 2) continue;
        // the supported side: a neighbour column of the run that reaches lower; stand at the other end
        const lowL = I.cs.some(q => q[0] === c0 - 1 && q[1] < r), lowR = I.cs.some(q => q[0] === c1 + 1 && q[1] < r);
        const ends = lowL && !lowR ? [c1] : lowR && !lowL ? [c0] : !lowL && !lowR ? [c0, c1] : [];
        for (const c of ends) { const x = X(c) + 15, y1 = Y(r), y0 = run(x, y1, -1); if (y0 != null && y1 - y0 >= 6) out.push(withCells({ kind: "stand", x0: x, x1: x, y0, y1, w: c1 - c0 + 1 }, I)); }
      }
      continue;
    }
    // where: two holders near the ends of a wide island, one in the middle of a narrow one (Evgeni: "on the
    // edges/middle of the structures ( like 2 ropes holding a brick, or from the other side a brick floating on two ropes )")
    // o.pairFrom: the narrowest island that gets a pair (brick pillars: 5, so a pair's fillets never meet under a narrow one)
    const w = I.c1 - I.c0 + 1, pair = w >= (o.pairFrom ?? 2), xs = pair ? [X(I.c0) + 9, X(I.c1 + 1) - 9] : [X(I.c0 + Math.floor((w - 1) / 2)) + 15];
    const edge = (x, side) => { const c = Math.floor((x - ox) / 30), rs = I.cs.filter(q => q[0] === c).map(q => q[1]);
      return side > 0 ? Y(Math.max(...rs) + 1) : Y(Math.min(...rs)); };
    // from above (hanging) or below (standing): the side whose lines are all clear; above first when the island is high
    const seg = (x, d) => { const y0 = edge(x, d), y1 = run(x, y0, d); return y1 == null || Math.abs(y1 - y0) < 6 ? null : { kind: d > 0 ? "hang" : "stand", x0: x, x1: x, y0: Math.min(y0, y1), y1: Math.max(y0, y1) }; };
    // the ends first; when the route passes an end, slide inward a cell at a time to the nearest clear spot (GDLM 75,
    // 2026-11-27: an auto's path brushes most islands' ends, and they floated with no holder); a wide island whose two
    // sides find no clear pair gets one holder at the clearest middle cell
    const tryDir = d => {
      if (!pair) { const mc = I.c0 + Math.floor((w - 1) / 2);
        // an even width hangs from its exact middle, on the line between the two middle cells (Evgeni 2026-11-27, hellgate
        // col 9: "the hanging of a triangle should either be symmetrical or some other kind of hanger coming from the middle")
        if (w % 2 === 0) { const q = seg(X(I.c0) + w * 15, d); if (q) return [Object.assign(q, { centre: true })]; }
        for (let k = 0; k < w; k++) for (const c of [mc - k, mc + k + 1]) { if (c < I.c0 || c > I.c1) continue; const q = seg(X(c) + 15, d); if (q) return [q]; }
        return null; }
      const half = Math.floor((w - 1) / 2);
      let L = null, R = null;
      for (let k = 0; k <= half && !L; k++) L = seg(k ? X(I.c0 + k) + 15 : xs[0], d);
      for (let k = 0; k <= half && !R; k++) R = seg(k ? X(I.c1 - k) + 15 : xs[1], d);
      if (L && R && R.x0 - L.x0 >= 30) return [L, R];
      for (let k = 0; k <= half; k++) for (const c of [I.c0 + half - k, I.c0 + half + k + 1]) { if (c < I.c0 || c > I.c1) continue; const q = seg(X(c) + 15, d); if (q) return [q]; }
      return null;
    };
    const high = I.r0 - ground >= 4, pick = (high ? [1, -1] : [-1, 1]).map(tryDir).find(Boolean);
    // a wide island also gets one in the middle (Evgeni 2026-11-27: "holders ... on the sides (maybe some in the middle)")
    if (pick && pick.length === 2 && w >= (o.midFrom ?? 10)) { const d = pick[0].kind === "hang" ? 1 : -1, mc = I.c0 + Math.floor(w / 2);
      const q = seg(X(mc), d); if (q && Math.abs(q.x0 - pick[0].x0) >= 60 && Math.abs(q.x0 - pick[1].x0) >= 60) pick.push(q); }
    if (pick) out.push(...pick.map(q => withCells(Object.assign(q, { w }), I)));
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
const STYLES = ["rope", "chain", "rod", "gdchain", "brick"];
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
    } else if (style === "brick" && vert) {
      // BRICK (Evgeni 2026-11-27, hellgate: "large structures should have holders made of bricks on the sides (maybe some
      // in the middle), a connector of 1 or 2 blocks to the top, with a slope smoothing where structures connect"): a
      // brick pillar behind the play, 1 block wide (2 under an island 8+ wide), its bricks in rows shifted by half, an
      // outline in the line colour, darker than the play blocks so it reads as background, never as something to land
      // on. Its fillets (brickParts) are drawn here only when the caller does not dress them as part of the structure
      const g = q.brick || brickParts([q])[0], { cx, bw } = g, x0 = cx - bw / 2;
      put(211, cx, cy, { ch: C.line, sx: (bw + 3) / 30, sy: len / 30, hsv: hsv(1) });
      put(211, cx, cy, { ch: C.base, sx: bw / 30, sy: len / 30, hsv: hsv(0.9), zo: 3 });
      for (let k = 1, y = q.y0 + 15; y < q.y1 - 2; y += 15, k++) {
        put(211, cx, y, { ch: C.line, sx: bw / 30, sy: 0.05, hsv: hsv(0.55), zo: 4 });
        for (let xx = x0 + (k % 2 ? 15 : 30); xx < x0 + bw - 2; xx += 30) put(211, xx, y - 7.5, { ch: C.line, sx: 0.05, sy: 0.5, hsv: hsv(0.55), zo: 4 }); }
      // the fillets in the hanger's own look (Evgeni 2026-11-27, hellgate col 24: "the connecting slopes should be of the
      // hanger type, not the structure"): the pillar's body and outline, one brick seam across the middle
      for (const f of g.fillets) { const fl = { flipX: f.flipX, flipY: f.flipY };
        put(693, f.x, f.y, Object.assign({ ch: C.line, hsv: hsv(1), s: 1.06 }, fl));
        put(693, f.x + (f.flipX ? -0.9 : 0.9), f.y + (f.flipY ? 0.9 : -0.9), Object.assign({ ch: C.base, hsv: hsv(0.9), zo: 3, s: 0.94 }, fl));
        put(211, f.x + (f.flipX ? -7.5 : 7.5), f.y, { ch: C.line, sx: 0.5, sy: 0.05, hsv: hsv(0.55), zo: 4 }); }
    } else if (style === "gdchain") {
      const L = 2.32 * 30 * 0.6, n = Math.max(1, Math.ceil(len / L));
      for (let k = 0; k < n; k++) { const t = (k + 0.5) / n; put(41, vert ? q.x0 : q.x0 + len * t, vert ? q.y0 + len * t : q.y0, { ch: C.line, s: 0.6, rot, hsv: hsv(1) }); }
    }
  }
  return out;
}
// brick pillars' geometry for a set of connectors: per connector {cx, bw, fillets: [{x, y, flipX, flipY}]}. On the cell
// grid, so a fillet sits on whole cells. A fillet only where the structure goes on under it at the attached row
// (Evgeni 2026-11-27, hellgate col 27: "the slopes go out of the structures ... move to the side, or have the slope
// removed from that side ... or no slope at all"), never on a cell another pillar, fillet or block already takes
// (col 106: "two holding structures overlap, structures should usually not overlap in their blocks, they should somehow
// merge"). A fillet is a 45-degree slope: its right angle in the corner between pillar and structure, so as a slope cell
// it carries the structure's own design (col 43 / 52: "missing marker on the edge of the slope like the regular blocks",
// "the triangles ... no block design inside them") -- tools/structdeco.js dresses it with the structure.
function brickParts(conns, solid, squares) {
  const geo = conns.map(q => { if (q.x0 !== q.x1) return null;
    const at = q.kind === "hang" ? q.y0 : q.y1, dir = q.kind === "hang" ? 1 : -1, G = q.cells;
    const on = (x, y) => !G || G.set.has(Math.floor((x - G.ox) / 30) + "," + Math.floor((y - G.oy) / 30));
    const ya = at - dir * 15;   // the row the pillar is attached to
    let bw = (q.w || 1) >= 8 ? 60 : 30, cx = G ? (bw === 30 ? G.ox + Math.floor((q.x0 - G.ox) / 30) * 30 + 15 : G.ox + Math.round((q.x0 - G.ox) / 30) * 30) : q.x0;
    if (bw === 60 && !(on(cx - 15, ya) && on(cx + 15, ya))) { bw = 30; cx = G.ox + Math.floor((q.x0 - G.ox) / 30) * 30 + 15; }
    if (q.centre) { bw = 30; cx = q.x0; }
    return { q, cx, bw, at, dir, ya, on, fillets: [] }; });
  // the cells every pillar takes
  const used = new Set(solid || []), ck = (x, y) => Math.floor(x / 30) + "," + Math.floor(y / 30);
  for (const g of geo) if (g) for (let y = g.q.y0 + 1; y < g.q.y1; y += 30) for (let x = g.cx - g.bw / 2 + 1; x < g.cx + g.bw / 2; x += 30) used.add(ck(x, y));
  // a pillar under the gameplay (standing) gets ONE fillet, on the side toward its structure's middle (Evgeni 2026-11-27,
  // hellgate col 40: "not all connections of blocks on gameplay need slopes, just 1"); a hanging one keeps both
  const mid = g => { const G = g.q.cells; if (!G) return g.cx; let s = 0, n = 0; for (const k of G.set) { s += +k.split(",")[0]; n++; } return G.ox + (s / n) * 30 + 15; };
  for (const g of geo) if (g) for (const side of (g.q.kind === "stand" ? [mid(g) < g.cx ? -1 : 1] : [-1, 1])) {
    const x = g.cx + side * (g.bw / 2 + 15), y = g.at + g.dir * 15;
    // and only on a full square: a fillet on a slope's slant floated off it (hellgate's hanging peak)
    if (!g.on(x, g.ya) || used.has(ck(x, y)) || (squares && !squares.has(ck(x, g.ya)))) continue;
    used.add(ck(x, y)); g.fillets.push({ x, y, flipX: side > 0, flipY: g.dir < 0 });
  }
  return geo;
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
module.exports = { connectors, draw, brickParts, routeCells, STYLES, spec };
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
