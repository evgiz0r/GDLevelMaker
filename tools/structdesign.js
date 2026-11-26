// node tools/structdesign.js list                    the structure designs and the 3D effects
// node tools/structdesign.js spec [--out specs/lab_struct_designs.json]   the gallery (then: node tools/make.js <it>)
// node tools/structdesign.js sheet                   print the connector sheet (every join a structure can have)
//
// BLOCK DESIGNS ON WHOLE STRUCTURES (DECOART.md "Structure designs"; Evgeni 2026-11-26: "extending to bigger structures. i
// think in GD they make some 1 mega structure that contains all possible connectors corners and 3 in a row [...] the point
// of it is to have that second layering proper on any connection of any structure", "and ability to extend structures",
// "3d effects for the blocks").
// A single-block design (tools/blockdesigns.js) frames every block; on a row of three that is three boxes. Here a design is
// a stack of layers that follow the STRUCTURE's outline: each layer is the structure's shape inset by d units, so the
// outline, the inline and the inner base run round the outside of the whole shape, turn at its outer corners and notch
// at its inner (concave) corners; nothing is drawn where two blocks meet. A cell is cut 3 x 3 at d and 30 - d: the middle
// is always in, a side piece is in when the neighbour on that side is a block, a corner piece when both sides and the
// diagonal are; the pieces are merged into as few stretched squares (211) as possible.
//   dress(blocks, design, C, o)  -> deco objects for every structure among `blocks` ({x, y} block centres, any grid offset)
//   region(S, d)                 -> the shape inset by d as rectangles; edges(S, side) the open sides; corners(S)
//   extend(rows, w, h)           -> a structure map stretched to w x h: its repeated lines grow, corners, caps and
//                                   single features keep their size: "the ability to extend structures"
//   SHEET                        -> the connector sheet: single, row of 3, column, L, T, plus, 2x2, 3x3, ring with a hole,
//                                   U, stairs (diagonal touches), a bridge: a design that looks right on it looks right anywhere
//   EFFECTS                      -> 3D for the blocks: depth (pushed back up-right), bevel (lit top-left, dark bottom-right
//                                   inside the edge), long depth, depth + bevel
// Layers: like the single designs (base T1 zo 4, inside 5-6, inline 7, outline 8); depth and shadow behind on B1.
"use strict";
const K = require("./scenekit.js"), B = require("./blockdesigns.js");
const LW = 2.4, IW = 1.8;

// ---- the shape ----
const key = (c, r) => c + "," + r;
// blocks (centres) -> structures: cells on the blocks' own grid, joined when they share a side or a corner
function structures(blocks) {
  if (!blocks.length) return [];
  const ox = ((blocks[0].x - 15) % 30 + 30) % 30, oy = ((blocks[0].y - 15) % 30 + 30) % 30, all = new Map();
  for (const b of blocks) { const c = Math.round((b.x - 15 - ox) / 30), r = Math.round((b.y - 15 - oy) / 30); all.set(key(c, r), [c, r]); }
  const seen = new Set(), out = [];
  for (const [k0] of all) {
    if (seen.has(k0)) continue;
    const S = new Set(), st = [k0]; seen.add(k0);
    while (st.length) { const k = st.pop(); S.add(k); const [c, r] = all.get(k);
      for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) { const n = key(c + dc, r + dr); if (all.has(n) && !seen.has(n)) { seen.add(n); st.push(n); } } }
    out.push({ S, ox, oy });
  }
  return out;
}
const has = (S, c, r) => S.has(key(c, r));
const cellsOf = S => [...S].map(k => k.split(",").map(Number));
// merge rectangles [x0, y0, x1, y1]: along rows, then along columns
function merge(R) {
  const eq = (a, b) => Math.abs(a - b) < 1e-6;
  const pass = (list, h) => {
    list.sort(h ? (a, b) => a[1] - b[1] || a[3] - b[3] || a[0] - b[0] : (a, b) => a[0] - b[0] || a[2] - b[2] || a[1] - b[1]);
    const out = [];
    for (const r of list) { const p = out[out.length - 1];
      if (p && (h ? eq(p[1], r[1]) && eq(p[3], r[3]) && eq(p[2], r[0]) : eq(p[0], r[0]) && eq(p[2], r[2]) && eq(p[3], r[1]))) { if (h) p[2] = r[2]; else p[3] = r[3]; }
      else out.push(r.slice()); }
    return out;
  };
  return pass(pass(R, true), false);
}
// the shape inset by d (0 <= d < 15), in units relative to cell (0,0)'s bottom-left corner
function region(S, d) {
  const R = [];
  for (const [c, r] of cellsOf(S)) {
    const n = has(S, c, r + 1), s = has(S, c, r - 1), e = has(S, c + 1, r), w = has(S, c - 1, r);
    const X = [0, d, 30 - d, 30];
    // sub-cell (i, j): i 0 left .. 2 right, j 0 bottom .. 2 top
    const inc = [[w && s && has(S, c - 1, r - 1), s, e && s && has(S, c + 1, r - 1)], [w, true, e], [w && n && has(S, c - 1, r + 1), n, e && n && has(S, c + 1, r + 1)]];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++)
      if (inc[j][i] && X[i + 1] > X[i] && X[j + 1] > X[j]) R.push([c * 30 + X[i], r * 30 + X[j], c * 30 + X[i + 1], r * 30 + X[j + 1]]);
  }
  return merge(R);
}
// the open sides as strips w wide inside the edge (side: "N" "S" "E" "W")
function edges(S, side, w) {
  const R = [];
  for (const [c, r] of cellsOf(S)) {
    const x = c * 30, y = r * 30;
    if (side === "N" && !has(S, c, r + 1)) R.push([x, y + 30 - w, x + 30, y + 30]);
    if (side === "S" && !has(S, c, r - 1)) R.push([x, y, x + 30, y + w]);
    if (side === "E" && !has(S, c + 1, r)) R.push([x + 30 - w, y, x + 30, y + 30]);
    if (side === "W" && !has(S, c - 1, r)) R.push([x, y, x + w, y + 30]);
  }
  return merge(R);
}
// outer and inner corners: {x, y (the corner point), dx, dy (towards the inside along x and y), inner}
function corners(S) {
  const out = [];
  for (const [c, r] of cellsOf(S)) for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const hx = has(S, c + sx, r), hy = has(S, c, r + sy), hd = has(S, c + sx, r + sy);
    const x = c * 30 + (sx > 0 ? 30 : 0), y = r * 30 + (sy > 0 ? 30 : 0);
    if (!hx && !hy) out.push({ x, y, dx: -sx, dy: -sy, inner: false });
    else if (hx && hy && !hd) out.push({ x, y, dx: sx, dy: sy, inner: true });   // a notch: the open quarter is diagonal
  }
  return out;
}

// ---- drawing ----
function painter(st, C, o = {}) {
  const out = [], X0 = st.ox, Y0 = st.oy;
  // every piece grows by a hair (0.3 units) so pieces that meet overlap: abutting squares show a seam in the game's render
  const rect = (q, role, zo, extra = {}) => out.push(K.obj(211, X0 + (q[0] + q[2]) / 2, Y0 + (q[1] + q[3]) / 2,
    Object.assign({ ch: C[role], z: "T1", zo, sx: (q[2] - q[0] + 0.3) / 30, sy: (q[3] - q[1] + 0.3) / 30, groups: o.groups }, extra)));
  const fill = (d, role, zo, extra) => region(st.S, d).forEach(q => rect(q, role, zo, extra));
  return { out, rect, fill, X0, Y0 };
}
// cells for a motif: the inside cells (blocks on all four sides), else every third block of a thin shape
function motifCells(S) {
  const cs = cellsOf(S).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const inside = cs.filter(([c, r]) => has(S, c + 1, r) && has(S, c - 1, r) && has(S, c, r + 1) && has(S, c, r - 1));
  if (inside.length) return inside.filter((_, i) => i % 2 === 0);
  return cs.length < 3 ? cs.slice(0, 1) : cs.filter((_, i) => i % 3 === 1);
}
const topGlow = (st, p, C, h = 12) => edges(st.S, "N", h).forEach(q => p.out.push(K.obj(1293, p.X0 + (q[0] + q[2]) / 2, p.Y0 + (q[1] + q[3]) / 2,
  { ch: C.glow, z: "T1", zo: 6, sx: (q[2] - q[0]) / 30 * 2 / 2, sy: h / 30, flipY: true })));
const MOTIFS = {
  // above every body layer (the fills go up to zo 8)
  diamond: (k, cx, cy) => { k.put(211, cx, cy, "deep", 9, { s: 0.55, rot: 45 }); k.put(211, cx, cy, "hi", 10, { s: 0.3, rot: 45 }); },
  eye: (k, cx, cy) => B.pixels(k, cx, cy, B.DRAWN.eye, 9, 20), flame: (k, cx, cy) => B.pixels(k, cx, cy, B.DRAWN.flame, 9, 20),
  skull: (k, cx, cy) => B.pixels(k, cx, cy, B.DRAWN.skull, 9, 20), key: (k, cx, cy) => B.pixels(k, cx, cy, B.DRAWN.key, 9, 20),
};
function motifs(st, p, C, names) {
  motifCells(st.S).forEach(([c, r], i) => { const cx = p.X0 + c * 30 + 15, cy = p.Y0 + r * 30 + 15, k = B.kit(cx, cy, C);
    MOTIFS[names[i % names.length]](k, cx, cy); p.out.push(...k.out); });
}

// the designs Evgeni liked as single blocks (knowledge/design_votes.json), rebuilt to follow the structure
const DESIGNS = {
  outline: { note: "a body and a bright edge round the whole shape", draw(st, p, C) { p.fill(0, "line", 8); p.fill(LW, "base", 8); } },
  layered: { note: "outline, a dark inline under it, a glow inside the top edges", draw(st, p, C) {
    p.fill(0, "line", 4); p.fill(LW, "base", 4); topGlow(st, p, C); p.fill(6, "inline", 7); p.fill(6 + IW, "base", 7); } },
  "inner base": { note: "a second base, colours swapped, inset all round the shape", draw(st, p, C) {
    p.fill(0, "line", 4); p.fill(LW, "deep", 4); p.fill(7, "inline", 7); p.fill(7 + 1.2, "inner", 7); } },
  "nested frames": { note: "rings stepping inward, each dimmer, following every corner", draw(st, p, C) {
    p.fill(0, "line", 4); p.fill(LW, "deep", 4); p.fill(6, "line", 6, { hsv: "0a1a0.6a0a0" }); p.fill(7.6, "deep", 6);
    p.fill(11, "line", 7, { hsv: "0a1a0.35a0a0" }); p.fill(12.4, "deep", 7); } },
  "corner brackets": { note: "bright L pieces on every outer corner, small ones in the inner corners", draw(st, p, C) {
    p.fill(0, "base", 4); p.fill(5, "inline", 7); p.fill(5 + IW, "base", 7);
    for (const k of corners(st.S)) { const L = k.inner ? 6 : 9, w = 2.4;
      // outer: the L lies inside along both edges; inner (a notch): along the two edges that meet there, on their inside
      const a = k.inner ? [k.x, k.y, k.x + k.dx * L, k.y - k.dy * w] : [k.x, k.y, k.x + k.dx * L, k.y + k.dy * w];
      const b = k.inner ? [k.x, k.y, k.x - k.dx * w, k.y + k.dy * L] : [k.x, k.y, k.x + k.dx * w, k.y + k.dy * L];
      for (const q of [a, b]) p.rect([Math.min(q[0], q[2]), Math.min(q[1], q[3]), Math.max(q[0], q[2]), Math.max(q[1], q[3])], k.inner ? "hi" : "line", 8); } } },
  "inner diamond": { note: "the layered body with a turned square in the inside blocks", draw(st, p, C) {
    DESIGNS.layered.draw(st, p, C); motifs(st, p, C, ["diamond"]); } },
  drawn: { note: "the inner base with little drawings in the inside blocks: eye, flame, skull, key", draw(st, p, C) {
    p.fill(0, "line", 4); p.fill(LW, "deep", 4); motifs(st, p, C, ["eye", "flame", "skull", "key"]); } },
};
// 3D for the blocks (an effect on top of any design)
// the side face is the body darkened (the palette's shadow role nearly vanishes on a dark sky), with a dim rim on its
// outer edge so it reads as a face, not a smudge; the diagonal joins at the two outer corners are right triangles (693)
function depth(st, p, C, d, v) {
  const face = { z: "B1", hsv: `0a1a${v}a0a0` }, rim = { z: "B1", hsv: "0a1a0.45a0a0" };
  region(st.S, 0).forEach(q => p.rect([q[0] + d, q[1] + d, q[2] + d, q[3] + d], "line", 0, rim));
  region(st.S, LW * 0.6).forEach(q => p.rect([q[0] + d, q[1] + d, q[2] + d, q[3] + d], "base", 1, face));
  for (const k of corners(st.S)) if (!k.inner && ((k.dx > 0 && k.dy < 0) || (k.dx < 0 && k.dy > 0)))
    p.out.push(K.obj(693, p.X0 + k.x + d / 2, p.Y0 + k.y + d / 2, { ch: C.base, z: "B1", zo: 1, sx: d / 30, sy: d / 30, rot: k.dx > 0 ? 0 : 180, hsv: `0a1a${v}a0a0` }));
}
const EFFECTS = {
  depth: { note: "the shape pushed back up-right: a darker side face with a dim rim, joined at the corners", draw(st, p, C) { depth(st, p, C, 7, 0.5); } },
  bevel: { note: "lit along the top and left edges, dark along the bottom and right, inside the outline", draw(st, p, C, w = 4) {
    edges(st.S, "N", LW + w).forEach(q => p.rect([q[0], q[1], q[2], q[3] - LW], "hi", 7, { hsv: "0a1a0.8a0a0" }));
    edges(st.S, "W", LW + w).forEach(q => p.rect([q[0] + LW, q[1], q[2], q[3]], "hi", 7, { hsv: "0a1a0.6a0a0" }));
    edges(st.S, "S", LW + w).forEach(q => p.rect([q[0], q[1] + LW, q[2], q[3]], "shadow", 7));
    edges(st.S, "E", LW + w).forEach(q => p.rect([q[0], q[1], q[2] - LW, q[3]], "shadow", 7)); } },
  "long depth": { note: "a deep side face (twice as far back), darker: a heavy, solid look", draw(st, p, C) { depth(st, p, C, 14, 0.35); } },
  "depth + bevel": { note: "both", draw(st, p, C) { EFFECTS.depth.draw(st, p, C); EFFECTS.bevel.draw(st, p, C); } },
};
function dress(blocks, design, C, o = {}) {
  const out = [];
  for (const st of structures(blocks)) {
    const p = painter(st, C, o);
    DESIGNS[design].draw(st, p, C);
    for (const e of [].concat(o.effects || [])) EFFECTS[e].draw(st, p, C);
    out.push(...p.out);
  }
  return out;
}

// ---- the connector sheet and extending ----
// one map per join; '#' a block, rows top first
const SHEET = [
  ["single", ["#"]], ["row of 3", ["###"]], ["column", ["#", "#", "#"]], ["L", ["#..", "#..", "###"]],
  ["T", ["###", ".#.", ".#."]], ["plus", [".#.", "###", ".#."]], ["2x2", ["##", "##"]], ["3x3", ["###", "###", "###"]],
  ["ring", ["####", "#..#", "#..#", "####"]], ["U", ["#.#", "#.#", "###"]], ["stairs", ["..#", ".##", "##."]],
  ["bridge", ["##...##", "#######", "##...##"]],
];
// stretch a map to w x h (never smaller), 9-slice style: the first and last line stay (corners, caps, ends); the inside
// lines that repeat (a ring's sides, a frame's gap) share the extra copies evenly, else the middle inside line grows.
// o.cols / o.rows name the lines to grow instead (a T grows its arms: cols [0, 2]). "The ability to extend structures".
function extend(rows, w, h, o = {}) {
  const plan = (lines, n, force) => {
    const N = lines.length, extra = Math.max(0, n - N), groups = {};
    lines.forEach((l, i) => { if (i > 0 && i < N - 1) (groups[l] = groups[l] || []).push(i); });
    const pick = force || Object.values(groups).filter(g => g.length > 1).sort((a, b) => b.length - a.length)[0] || [Math.max(0, Math.min(N - 1, Math.floor(N / 2)))];
    const count = lines.map(() => 1); for (let k = 0; k < extra; k++) count[pick[k % pick.length]]++;
    return count.flatMap((m, i) => Array(m).fill(i));
  };
  const cols = [...rows[0]].map((_, j) => rows.map(r => r[j]).join(""));
  const ci = plan(cols, w, o.cols), ri = plan(rows, h, o.rows);
  return ri.map(i => ci.map(j => rows[i][j]).join(""));
}
// lay maps left to right on a base row, `gap` columns apart -> [[col, row], ...] and each map's span
function lay(maps, c0, r0, gap = 2) {
  const cells = [], spans = []; let c = c0;
  for (const [name, rows] of maps) { const W = rows[0].length;
    rows.forEach((row, i) => [...row].forEach((ch, j) => { if (ch === "#") cells.push([c + j, r0 + rows.length - 1 - i]); }));
    spans.push({ name, c0: c, c1: c + W }); c += W + gap; }
  return { cells, spans, end: c };
}

// the gallery: the connector sheet once per design (ice and fire in turn), then the 3D effects, then extending
function spec() {
  const objects = ["// every structure design and 3D effect on the connector sheet; flat run, no click"], copies = [];
  let c = 12;
  const add = (label, design, effects, pal, maps) => { const L = lay(maps || SHEET, c, 2, 1);
    for (const [x, y] of L.cells) objects.push(["block", x, y]);
    copies.push({ label, design, effects, pal, c0: c, c1: L.end - 1 }); c = L.end + 5; };
  Object.keys(DESIGNS).forEach((d, i) => add(d, d, [], i % 2 ? "fire" : "ice"));
  Object.keys(EFFECTS).forEach((e, i) => add("3D: " + e, "layered", [e], i % 2 ? "ice" : "fire"));
  const T = ["###", ".#.", ".#."], R = ["####", "#..#", "#..#", "####"], P = ["#####", "#...#", "#####"];
  add("extend", "inner base", ["depth"], "ice", [["T", T], ["T 7x4", extend(T, 7, 4, { cols: [0, 2] })], ["ring", R], ["ring 8x5", extend(R, 8, 5)], ["frame", P], ["frame 11x4", extend(P, 11, 4)]]);
  return {
    name: "GDLM structure designs", desc: "Block designs that follow whole structures, 3D effects, extended structures (tools/structdesign.js).",
    notes: "Evgeni 2026-11-26: 'one mega structure that contains all possible connectors corners and 3 in a row', 'ability to extend structures', '3d effects for the blocks'; DECOART.md 'Structure designs'",
    colours: { bg: [10, 14, 30], ground: [4, 6, 14] }, scene: "tools/scenes/structgallery.js", copies, outro: 76, signature: {}, objects,
  };
}

module.exports = { DESIGNS, EFFECTS, SHEET, structures, region, edges, corners, dress, extend, lay, spec };
if (require.main === module) {
  const a = process.argv.slice(2);
  if (a[0] === "list") { for (const [n, d] of Object.entries(DESIGNS)) console.log("design  " + n.padEnd(16) + d.note); for (const [n, d] of Object.entries(EFFECTS)) console.log("3D      " + n.padEnd(16) + d.note); }
  else if (a[0] === "sheet") { const L = lay(SHEET, 0, 0, 1), H = 5; for (let r = H - 1; r >= 0; r--) { let s = ""; for (let x = 0; x < L.end; x++) s += L.cells.some(q => q[0] === x && q[1] === r) ? "#" : "."; console.log(s); } }
  else if (a[0] === "spec") { const out = a.includes("--out") ? a[a.indexOf("--out") + 1] : "specs/lab_struct_designs.json";
    require("fs").writeFileSync(out, JSON.stringify(spec(), null, 1) + "\n"); console.log("wrote " + out); }
  else console.log(require("fs").readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n"));
}
