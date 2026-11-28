// node tools/structdesign.js list                    the structure designs and the 3D effects
// node tools/structdesign.js spec [--out specs/lab_struct_designs.json]   the gallery (then: node tools/make.js <it>)
// node tools/structdesign.js sheet                   print the connector sheet (every join a structure can have)
// interior(st, p, C, o): the inside of big structures (panels, rivets, lamps), on in dress() unless o.interior === false
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
// SLOPES (Evgeni: "you have also triangle shape ( half of the block , 2 ways )?"): a 1338 half block is a cell of kind
// br (as placed: rising to the right), bl (flipX: rising to the left), tr / tl (flipY: hanging from a ceiling); the name is
// the corner of its right angle. It joins its neighbours only along its two legs; every layer insets its slanted side
// by d too (a smaller 693 triangle), so outline, inline and base turn up the slope; glow and bevel follow the slant.
// Map letters: '/' br, '\\' bl, '7' tr, 'r' tl.
// Layers: like the single designs (base T1 zo 4, inside 5-6, inline 7, outline 8); depth and shadow behind on B1.
"use strict";
const K = require("./scenekit.js"), B = require("./blockdesigns.js");
const LW = 2.4, IW = 1.8;

// ---- the shape ----
const key = (c, r) => c + "," + r;
// slope kinds: the right angle's corner. GD flips first, then turns clockwise by rot
const ROTCW = { br: "bl", bl: "tl", tl: "tr", tr: "br" }, CHAR = { "/": "br", "\\": "bl", "7": "tr", "r": "tl" };
function slopeKind(b) { let k = (b.flipY ? "t" : "b") + (b.flipX ? "l" : "r"); for (let n = Math.round((((b.rot || 0) % 360) + 360) % 360 / 90); n > 0; n--) k = ROTCW[k]; return k; }
const kindOf = (S, c, r) => (S.kind && S.kind.get(key(c, r))) || "#";
const OPP = { N: "S", S: "N", E: "W", W: "E" };
// does cell (c, r) close its `side` with a full edge? a square always, a slope along its two legs
const presents = (S, c, r, side) => { if (!S.has(key(c, r))) return false; const k = kindOf(S, c, r);
  return k === "#" || side === (k[0] === "b" ? "S" : "N") || side === (k[1] === "r" ? "E" : "W"); };
// does cell (c, r) fill the area at its corner `corner` (br, bl, tr, tl)? a square, or a slope's right angle
const covers = (S, c, r, corner) => S.has(key(c, r)) && (kindOf(S, c, r) === "#" || kindOf(S, c, r) === corner);
const isSq = (S, c, r) => S.has(key(c, r)) && kindOf(S, c, r) === "#";
// blocks (centres) -> structures: cells on the blocks' own grid, joined when they share a side or a corner
function structures(blocks) {
  if (!blocks.length) return [];
  const ox = ((blocks[0].x - 15) % 30 + 30) % 30, oy = ((blocks[0].y - 15) % 30 + 30) % 30, all = new Map();
  const kinds = new Map();
  for (const b of blocks) { const c = Math.round((b.x - 15 - ox) / 30), r = Math.round((b.y - 15 - oy) / 30); all.set(key(c, r), [c, r]); if (b.id === 1338) kinds.set(key(c, r), slopeKind(b)); }
  const seen = new Set(), out = [];
  for (const [k0] of all) {
    if (seen.has(k0)) continue;
    const S = new Set(), st = [k0]; seen.add(k0);
    while (st.length) { const k = st.pop(); S.add(k); const [c, r] = all.get(k);
      for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) { const n = key(c + dc, r + dr); if (all.has(n) && !seen.has(n)) { seen.add(n); st.push(n); } } }
    S.kind = new Map([...kinds].filter(([k]) => S.has(k)));
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
    if (kindOf(S, c, r) !== "#") continue;   // slopes: tris()
    const n = presents(S, c, r + 1, "S"), s = presents(S, c, r - 1, "N"), e = presents(S, c + 1, r, "W"), w = presents(S, c - 1, r, "E");
    const X = [0, d, 30 - d, 30];
    // a corner piece: both sides and the diagonal fill the area round that corner point
    const cor = (dx, dy) => { const h = dy > 0 ? "b" : "t", v = dx > 0 ? "l" : "r";   // the corner of each neighbour that touches ours
      return covers(S, c + dx, r + dy, h + v) && covers(S, c + dx, r, (dy > 0 ? "t" : "b") + v) && covers(S, c, r + dy, h + (dx > 0 ? "r" : "l")); };
    // sub-cell (i, j): i 0 left .. 2 right, j 0 bottom .. 2 top
    const inc = [[w && s && cor(-1, -1), s, e && s && cor(1, -1)], [w, true, e], [w && n && cor(-1, 1), n, e && n && cor(1, 1)]];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++)
      if (inc[j][i] && X[i + 1] > X[i] && X[j + 1] > X[j]) R.push([c * 30 + X[i], r * 30 + X[j], c * 30 + X[i + 1], r * 30 + X[j + 1]]);
  }
  return merge(R);
}
// the slopes inset by d: one right triangle per slope cell {x, y (centre), L (leg), flipX, flipY, kind}; a leg that
// meets a neighbour is not inset (the layer runs on into the neighbour), the slanted side always is
function tris(S, d) {
  const out = [];
  for (const [c, r] of cellsOf(S)) {
    const k = kindOf(S, c, r); if (k === "#") continue;
    const H = k[0] === "b" ? "S" : "N", V = k[1] === "r" ? "E" : "W";
    const dH = presents(S, c, r + (H === "N" ? 1 : -1), OPP[H]) ? 0 : d, dV = presents(S, c + (V === "E" ? 1 : -1), r, OPP[V]) ? 0 : d;
    const L = 30 - dH - dV - d * Math.SQRT2; if (L < 0.6) continue;
    let cx = 30 - dV - L / 2, cy = dH + L / 2;   // worked out for br, then mirrored
    if (k[1] === "l") cx = 30 - cx; if (k[0] === "t") cy = 30 - cy;
    out.push({ x: c * 30 + cx, y: r * 30 + cy, L, flipX: k[1] === "l", flipY: k[0] === "t", kind: k });
  }
  // where a slant runs on past a square's corner (a ramp's slope meeting the block under the next slope), the square's
  // corner piece is out (region) but the part of it under the slant is in: a small triangle there, so no step shows
  if (d > 0) for (const [c, r] of cellsOf(S)) {
    if (kindOf(S, c, r) !== "#") continue;
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const ex = presents(S, c + sx, r, sx > 0 ? "W" : "E"), ey = presents(S, c, r + sy, sy > 0 ? "S" : "N");
      const tx = (sy > 0 ? "b" : "t") + (sx > 0 ? "l" : "r");   // the diagonal's corner that touches ours
      if (!ex || !ey || covers(S, c + sx, r + sy, tx)) continue;
      const slantX = kindOf(S, c + sx, r) !== "#" && !covers(S, c + sx, r, (sy > 0 ? "t" : "b") + (sx > 0 ? "l" : "r"));
      const slantY = kindOf(S, c, r + sy) !== "#" && !covers(S, c, r + sy, (sy > 0 ? "b" : "t") + (sx > 0 ? "r" : "l"));
      if (!slantX && !slantY) continue;
      const X = c * 30 + (sx > 0 ? 30 : 0), Y = r * 30 + (sy > 0 ? 30 : 0), L = d * (2 - Math.SQRT2), k = (sy > 0 ? "b" : "t") + (sx > 0 ? "l" : "r");
      out.push({ x: X - sx * d + sx * L / 2, y: Y - sy * d + sy * L / 2, L, flipX: k[1] === "l", flipY: k[0] === "t", kind: k });
    }
  }
  return out;
}
// the slanted sides: per slope its middle point, the inward normal, the turn of a strip along it and where it faces
function hyps(S) {
  return cellsOf(S).filter(([c, r]) => kindOf(S, c, r) !== "#").map(([c, r]) => { const k = kindOf(S, c, r);
    const nx = (k[1] === "r" ? 1 : -1) / Math.SQRT2, ny = (k[0] === "b" ? -1 : 1) / Math.SQRT2;
    return { c, r, kind: k, mx: c * 30 + 15, my: r * 30 + 15, nx, ny, rot: k === "br" || k === "tl" ? -45 : 45, up: k[0] === "b", left: k[1] === "r" }; });
}
// the open sides as strips w wide inside the edge (side: "N" "S" "E" "W"); a slope's open legs count, its slant does not (hyps)
function edges(S, side, w) {
  const R = [];
  for (const [c, r] of cellsOf(S)) {
    const x = c * 30, y = r * 30, k = kindOf(S, c, r);
    const mine = sd => k === "#" || sd === (k[0] === "b" ? "S" : "N") || sd === (k[1] === "r" ? "E" : "W");
    if (side === "N" && mine("N") && !presents(S, c, r + 1, "S")) R.push([x, y + 30 - w, x + 30, y + 30]);
    if (side === "S" && mine("S") && !presents(S, c, r - 1, "N")) R.push([x, y, x + 30, y + w]);
    if (side === "E" && mine("E") && !presents(S, c + 1, r, "W")) R.push([x + 30 - w, y, x + 30, y + 30]);
    if (side === "W" && mine("W") && !presents(S, c - 1, r, "E")) R.push([x, y, x + w, y + 30]);
  }
  return merge(R);
}
// outer and inner corners: {x, y (the corner point), dx, dy (towards the inside along x and y), inner}
function corners(S) {
  const out = [];
  for (const [c, r] of cellsOf(S)) for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    if (kindOf(S, c, r) !== "#") continue;
    const hx = presents(S, c + sx, r, sx > 0 ? "W" : "E"), hy = presents(S, c, r + sy, sy > 0 ? "S" : "N");
    const hd = covers(S, c + sx, r + sy, (sy > 0 ? "b" : "t") + (sx > 0 ? "l" : "r"));
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
  // a slope's layer: the 693 right triangle (its right angle at the bottom right as placed), mirrored like the slope
  const tri = (t, role, zo, extra = {}, dx = 0, dy = 0) => out.push(K.obj(693, X0 + t.x + dx, Y0 + t.y + dy,
    Object.assign({ ch: C[role], z: "T1", zo, s: (t.L + 0.3) / 30, flipX: t.flipX, flipY: t.flipY, groups: o.groups }, extra)));
  const fill = (d, role, zo, extra) => { region(st.S, d).forEach(q => rect(q, role, zo, extra)); tris(st.S, d).forEach(t => tri(t, role, zo, extra)); };
  // a strip along a slope's slant, from inset a to inset b
  const slant = (h, a, b, role, zo, extra = {}) => { const m = (a + b) / 2;
    out.push(K.obj(211, X0 + h.mx + h.nx * m, Y0 + h.my + h.ny * m, Object.assign({ ch: C[role], z: "T1", zo, sx: Math.max(0.1, 30 * Math.SQRT2 - 2 * b - 2 * LW) / 30, sy: (b - a) / 30, rot: h.rot, groups: o.groups }, extra))); };
  return { out, rect, tri, fill, slant, X0, Y0 };
}
// cells for a motif: the inside cells (blocks on all four sides), else every third block of a thin shape
function motifCells(S) {
  const cs = cellsOf(S).sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const inside = cs.filter(([c, r]) => isSq(S, c, r) && isSq(S, c + 1, r) && isSq(S, c - 1, r) && isSq(S, c, r + 1) && isSq(S, c, r - 1));
  if (inside.length) return inside.filter((_, i) => i % 2 === 0);
  const sq = cs.filter(([c, r]) => isSq(S, c, r));
  return sq.length < 3 ? sq.slice(0, 1) : sq.filter((_, i) => i % 3 === 1);
}
const topGlow = (st, p, C, h = 12) => {
  edges(st.S, "N", h).forEach(q => p.out.push(K.obj(1293, p.X0 + (q[0] + q[2]) / 2, p.Y0 + (q[1] + q[3]) / 2,
    { ch: C.glow, z: "T1", zo: 6, sx: (q[2] - q[0]) / 15, sy: h / 30, flipY: true })));
  // up a floor slope: the glow turned with the slant, bright side out
  for (const s of hyps(st.S)) if (s.up) p.out.push(K.obj(1293, p.X0 + s.mx + s.nx * h / 2, p.Y0 + s.my + s.ny * h / 2,
    { ch: C.glow, z: "T1", zo: 6, sx: (30 * Math.SQRT2 - h) / 15, sy: h / 30, flipY: true, rot: s.rot }));
};
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
// Evgeni 2026-11-27 (hellgate): "the 3d effect seems a bit off, like we dont have a side, but rather just the opposite and
// we see a hollow object, the 3d side should also have our theming": the back copy's dim rim read as a second outline
// floating behind, not as a side. Now the far edge carries the theme's own edge line (the line colour, as wide as the
// front's, a little dimmer), and at every corner where the side turns, the edge that joins front to back is drawn in the
// same line colour, so the side reads as a solid face of the same material
// HANGING LEGS GET NO 3D (Evgeni 2026-11-27, hellgate kit col 24: "no 3d for hanging from bottom piece"): a narrow part
// (rows 1-2 cells wide) hanging below the structure's lowest wide row is drawn flat; the body keeps its side face
// ... REVERSED as the default (Evgeni 2026-11-28, hellgate theme mark: "some blocks miss the 3d effect. its wierd if its for
// just some and not for all. but need to be careul not to show 'wrong views'"): a leg is swept like the body, so it shows only
// the faces a real block there would show (its right side; its top is under the body); st.flatLegs = the old flat legs
function bodyOf(S) {
  const rows = new Map(); for (const k of S) { const r = +k.split(",")[1]; rows.set(r, (rows.get(r) || 0) + 1); }
  const wide = [...rows].filter(([, n]) => n >= 3).map(([r]) => r); if (!wide.length) return S;
  const low = Math.min(...wide), legRows = [...rows.keys()].filter(r => r < low);
  if (!legRows.length || legRows.some(r => rows.get(r) > 2)) return S;
  const B = new Set([...S].filter(k => +k.split(",")[1] >= low)); B.kind = S.kind; return B;
}
function depth(st, p, C, d, v) {
  if (st.flatLegs) st = Object.assign({}, st, { S: bodyOf(st.S) });
  const face = { z: "B1", hsv: `0a1a${v}a0a0` }, rim = { z: "B1", hsv: "0a1a0.8a0a0" };
  // SOLID SIDE (Evgeni 2026-11-27: "3d of the block itself feels hollow, like the front side is missing"): the back copy
  // with its own full outline read as an empty frame behind. Now the side is a sweep of the body (copies at a third, two
  // thirds and the full depth, no outline of their own), and the theme's line runs only along the far top and right
  // edges, where the side ends
  for (const k of [d / 3, (2 * d) / 3, d]) {
    region(st.S, 0).forEach(q => p.rect([q[0] + k, q[1] + k, q[2] + k, q[3] + k], "base", 1, face));
    tris(st.S, 0).forEach(t => p.tri(t, "base", 1, face, k, k)); }
  // LIT SIDES (Evgeni 2026-11-27 23:48: "the 3d feels like it has the front and back, but not the sides"): the sweep alone
  // came out nearly as dark as the body, so the top and right faces read as a gap between two outlines. Now the top face is
  // lit (brighter than the body) and the right face is a mid shade, strips stacked along each edge
  // LIT IN THE ACCENT, NOT THE BODY (Evgeni 2026-11-28, hellgate: "some objects dont have the 3d", "missing 3d ... looks like
  // a hole"): the faces were the body's own colour a little brighter (fire: 92,24,22 -> ~97,25,23), so against a dark sky
  // they vanished and only the far rim line showed, floating. Now they take the palette's light accent ("inner") dimmed:
  // the top face clearly lit, the right face a darker step of it -- a warm 3D in fire, a cold one in ice. tools/facecheck.js
  // measures each face's contrast against the body and the sky behind it
  const top = { z: "B1", hsv: `0a1a${(0.55 + 0.1 * v).toFixed(2)}a0a0` }, side = { z: "B1", hsv: `0a1a${(0.3 + 0.1 * v).toFixed(2)}a0a0` };
  for (const k of [d / 3, (2 * d) / 3, d]) {
    edges(st.S, "E", d / 3 + 0.5).forEach(q => p.rect([q[0] + k, q[1] + k, q[2] + k, q[3] + k], "inner", 1, side));
    edges(st.S, "N", d / 3 + 0.5).forEach(q => p.rect([q[0] + k, q[1] + k, q[2] + k, q[3] + k], "inner", 1, top)); }
  edges(st.S, "N", LW).forEach(q => p.rect([q[0] + d, q[1] + d, q[2] + d, q[3] + d], "line", 0, rim));
  edges(st.S, "E", LW).forEach(q => p.rect([q[0] + d, q[1] + d, q[2] + d, q[3] + d], "line", 0, rim));
  for (const k of corners(st.S)) if (!k.inner && ((k.dx > 0 && k.dy < 0) || (k.dx < 0 && k.dy > 0))) {
    p.out.push(K.obj(693, p.X0 + k.x + d / 2, p.Y0 + k.y + d / 2, { ch: C.base, z: "B1", zo: 1, sx: d / 30, sy: d / 30, rot: k.dx > 0 ? 0 : 180, hsv: `0a1a${v}a0a0` }));
    // the joining edge, front corner to back corner (up-right: turned -45 degrees, GD turns clockwise)
    p.out.push(K.obj(211, p.X0 + k.x + d / 2, p.Y0 + k.y + d / 2, { ch: C.line, z: "B1", zo: 2, sx: (d * Math.SQRT2 + LW) / 30, sy: LW / 30, rot: 315, hsv: "0a1a0.8a0a0" }));
  }
}
const EFFECTS = {
  depth: { note: "the shape pushed back up-right: a darker side face with a dim rim, joined at the corners", draw(st, p, C) { depth(st, p, C, 7, 0.5); } },
  bevel: { note: "lit along the top and left edges, dark along the bottom and right, inside the outline", draw(st, p, C, w = 4) {
    edges(st.S, "N", LW + w).forEach(q => p.rect([q[0], q[1], q[2], q[3] - LW], "hi", 7, { hsv: "0a1a0.8a0a0" }));
    edges(st.S, "W", LW + w).forEach(q => p.rect([q[0] + LW, q[1], q[2], q[3]], "hi", 7, { hsv: "0a1a0.6a0a0" }));
    edges(st.S, "S", LW + w).forEach(q => p.rect([q[0], q[1] + LW, q[2], q[3]], "shadow", 7));
    edges(st.S, "E", LW + w).forEach(q => p.rect([q[0], q[1], q[2] - LW, q[3]], "shadow", 7));
    // a slant facing up is lit (more when it also faces left), one facing down is in shadow
    for (const h of hyps(st.S)) p.slant(h, LW, LW + w, h.up ? "hi" : "shadow", 7, h.up ? { hsv: h.left ? "0a1a0.8a0a0" : "0a1a0.6a0a0" } : {}); } },
  "long depth": { note: "a deep side face (twice as far back), darker: a heavy, solid look", draw(st, p, C) { depth(st, p, C, 14, 0.35); } },
  "depth + bevel": { note: "both", draw(st, p, C) { EFFECTS.depth.draw(st, p, C); EFFECTS.bevel.draw(st, p, C); } },
};
// ---- the inside of big structures ----
// Evgeni (2026-11-26, Hellgate with holders): "the big ones feel very empty inside". A design's layers sit near the
// edge (the deepest at ~15 units), so a structure 3+ blocks thick kept a flat body in the middle. INTERIOR, on by default
// in dress() for any design (o.interior: false = off), dresses the whole body of a BIG structure (one with a core: 3+
// cells whose 8 neighbours are all blocks, erode()); thin bars and small pieces stay as the design draws them:
//   panels   seams in a brick pattern (plates 3 x 2 blocks, every other row shifted by one), dark with a faint lit lip,
//            over the whole body and stopped 9 units short of an open side (inside the design's own layers); fixed to
//            the level grid, so structures side by side line up. A first try put the panels in a recessed core only:
//            that read as random dark holes in jagged shapes (slopes, steps), so the texture covers the whole body
//   rivets   a small lit dot where a vertical seam meets a horizontal one
//   lamps    a few soft lights deep inside (cells 2+ blocks from every side), one per ~5 plates: a lit slot with light
//            fading up and down from it (two 1293 gradients) on the design's glow channel
const erode = S => { const E = new Set(); for (const [c, r] of cellsOf(S)) { let ok = true;
  for (let dc = -1; dc <= 1 && ok; dc++) for (let dr = -1; dr <= 1; dr++) if (!isSq(S, c + dc, r + dr)) { ok = false; break; }
  if (ok) E.add(key(c, r)); } return E; };
const PW = 3, PH = 2, TRIM = 9, SW = 1.4;
const plate = (c, r) => { const row = Math.floor(r / PH); return Math.floor((c + (row % 2 ? 1 : 0) + 1000 * PW) / PW) + "," + row; };
// SHADE (Evgeni: "can we have small gradients in colors? or maybe some layers along the structure"), for big structures:
//   a layer      one more thin dim line following the whole outline at inset RING (inside the design's own layers)
//   a gradient   inside that line the body darkens downward, as if lit from above: a cell k cells below the top of its
//                column (the structure's surface above it) runs from SV(k) at its top to SV(k + 1) at its bottom -- a solid
//                fill of SV(k) with a 1293 gradient of SV(k + 1) over it, solid at the bottom -- so the rows join into one
//                smooth ramp, down to SVMIN
// A first try darkened by erosion levels (cells k blocks from every side): in Hellgate's jagged shapes it came out as dark
// blotches, so the ramp follows only the height below the surface.
const RING = 12, SV = k => Math.max(0.45, 1 - 0.13 * k);
function shade(st, p, C, o = {}) {
  const S = st.S, v = x => `0a1a${x.toFixed(3)}a0a0`, I = RING + 1.2;
  region(S, RING).forEach(q => p.rect(q, "line", 8, { hsv: "0a1a0.3a0a0" })); tris(S, RING).forEach(t => p.tri(t, "line", 8, { hsv: "0a1a0.3a0a0" }));
  region(S, I).forEach(q => p.rect(q, "base", 8));
  // a slope takes the ramp's shade at its height like the squares beside it (Evgeni 2026-11-27, hellgate col 122: "the
  // slopes have some different themeing than the blocks near them" -- they were the full base colour, lighter than the
  // shaded squares next to them): the mean of its cell's top and bottom value
  const kOf = (c, r) => { let k = 0; while (S.has(key(c, r + k + 1))) k++; return k; };
  tris(S, I).forEach(t => { const k = kOf(Math.floor(t.x / 30), Math.floor(t.y / 30)); p.tri(t, "base", 9, { hsv: v((SV(k) + SV(k + 1)) / 2) }); });
  for (const q of region(S, I)) {
    // split the piece into cell rows; each row's k from the column at its middle (pieces are merged along rows first)
    for (let r = Math.floor(q[1] / 30); r * 30 < q[3]; r++) {
      const y0 = Math.max(q[1], r * 30), y1 = Math.min(q[3], r * 30 + 30); if (y1 - y0 < 0.5) continue;
      // columns inside the piece with the same k share one strip
      let c = Math.floor(q[0] / 30), x = q[0];
      while (x < q[2] - 0.5) {
        const depth = cc => { let k = 0; while (S.has(key(cc, r + k + 1))) k++; return k; };
        const k = depth(c); let c2 = c; while ((c2 + 1) * 30 < q[2] && depth(c2 + 1) === k) c2++;
        const x1 = Math.min(q[2], (c2 + 1) * 30), seg = [x, y0, x1, y1];
        {
          p.rect(seg, "base", 9, { hsv: v(SV(k)) });
          p.out.push(K.obj(1293, p.X0 + (x + x1) / 2, p.Y0 + (y0 + y1) / 2, { ch: C.base, z: "T1", zo: 10, sx: (x1 - x) / 15, sy: (y1 - y0) / 30, hsv: v(SV(k + 1)), groups: o.groups }));
        }
        x = x1; c = c2 + 1;
      }
    }
  }
}
function interior(st, p, C, o = {}) {
  const S = st.S, S1 = erode(S); if (S1.size < (o.minCore || 3)) return 0;
  const n0 = p.out.length, sq = (c, r) => isSq(S, c, r);
  if (o.shade !== false) shade(st, p, C, o);
  // a seam end: runs on when the cells past it on both sides are body, else stops TRIM short of the side
  const H = [], V = [], ends = [];
  for (const [c, r] of cellsOf(S)) {
    if (!sq(c, r)) continue;
    if (sq(c, r + 1) && plate(c, r) !== plate(c, r + 1)) { const y = r * 30 + 30;
      H.push([c * 30 + (sq(c - 1, r) && sq(c - 1, r + 1) ? 0 : TRIM), y - SW / 2, c * 30 + 30 - (sq(c + 1, r) && sq(c + 1, r + 1) ? 0 : TRIM), y + SW / 2]); }
    if (sq(c + 1, r) && plate(c, r) !== plate(c + 1, r)) { const x = c * 30 + 30;
      V.push([x - SW / 2, r * 30 + (sq(c, r - 1) && sq(c + 1, r - 1) ? 0 : TRIM), x + SW / 2, r * 30 + 30 - (sq(c, r + 1) && sq(c + 1, r + 1) ? 0 : TRIM)]);
      ends.push([x, r * 30], [x, r * 30 + 30]); }
  }
  const HM = merge(H), VM = merge(V);
  HM.forEach(q => { p.rect(q, "inline", 11, { hsv: "0a1a1a0a0" }); p.rect([q[0], q[1] - 1, q[2], q[1]], "hi", 11, { hsv: "0a1a0.3a0a0" }); });
  VM.forEach(q => { p.rect(q, "inline", 11); p.rect([q[2], q[1], q[2] + 1, q[3]], "hi", 11, { hsv: "0a1a0.22a0a0" }); });
  const onH = (x, y) => HM.some(q => Math.abs(y - (q[1] + q[3]) / 2) < 0.1 && x > q[0] + 1 && x < q[2] - 1);
  const done = new Set();
  for (const [x, y] of ends) { const k = x + "," + y; if (done.has(k) || !onH(x, y)) continue; done.add(k);
    p.rect([x - 1.7, y - 1.7, x + 1.7, y + 1.7], "hi", 12, { hsv: "0a1a0.65a0a0" }); }
  // lamps: one cell per plate deep inside, every 5th plate
  const S2 = erode(S1), seen = new Map();
  for (const [c, r] of cellsOf(S2).sort((a, b) => a[0] - b[0] || a[1] - b[1])) { const pl = plate(c, r); if (!seen.has(pl)) seen.set(pl, [c, r]); }
  let i = 0;
  for (const [c, r] of seen.values()) {
    if ((i++ + (o.seed || 0)) % 5) continue;
    const cx = c * 30 + 15, cy = r * 30 + 15;
    for (const up of [true, false]) p.out.push(K.obj(1293, p.X0 + cx, p.Y0 + cy + (up ? 5 : -5), { ch: C.glow, z: "T1", zo: 12, sx: 0.6, sy: 8 / 30, flipY: !up, groups: o.groups }));
    p.rect([cx - 8, cy - 1.2, cx + 8, cy + 1.2], "core", 13);
  }
  return p.out.length - n0;
}

// BARS: a long thin structure (no core, so interior() leaves it) read as "a bland rectangle, not much happening in the
// middle" (Evgeni, 2026-11-27, hellgate's hanging slab). Every run of 5+ squares along a structure's top row gets plates
// (a seam every 3 cells on the level grid, the same as the panels, with a rivet top and bottom) and a lit vein along its
// middle, broken at each seam, with a soft glow over it. Pieces and short bars stay as the design draws them.
function bars(st, p, C, o = {}) {
  const S = st.S, n0 = p.out.length, sq = (c, r) => isSq(S, c, r);
  const rows = new Map(); for (const [c, r] of cellsOf(S)) if (sq(c, r) && !sq(c, r + 1)) (rows.get(r) || rows.set(r, []).get(r)).push(c);
  for (const [r, cs] of rows) { cs.sort((a, b) => a - b);
    for (let i = 0; i < cs.length;) { let j = i; while (j + 1 < cs.length && cs[j + 1] === cs[j] + 1) j++;
      const c0 = cs[i], c1 = cs[j]; i = j + 1; if (c1 - c0 + 1 < (o.minBar || 5)) continue;
      // the bar's whole height under this run (a 2-row slab gets its seams through both rows and the vein in the middle)
      let hgt = 1; while (hgt < 3 && [...Array(c1 - c0 + 1)].every((_, k) => sq(c0 + k, r - hgt))) hgt++;
      const y0 = (r - hgt + 1) * 30, Hh = hgt * 30, ym = y0 + Hh / 2, cuts = [];
      for (let c = c0 + 1; c <= c1; c++) if (((c % PW) + PW) % PW === 0) cuts.push(c * 30);
      for (const x of cuts) { p.rect([x - SW / 2, y0 + TRIM, x + SW / 2, y0 + Hh - TRIM], "inline", 11);
        p.rect([x + SW / 2, y0 + TRIM, x + SW / 2 + 1, y0 + Hh - TRIM], "hi", 11, { hsv: "0a1a0.22a0a0" });
        for (const y of [y0 + TRIM + 2.5, y0 + Hh - TRIM - 2.5]) for (const dx of [-4, 4]) p.rect([x + dx - 1.5, y - 1.5, x + dx + 1.5, y + 1.5], "hi", 12, { hsv: "0a1a0.65a0a0" }); }
      const xs = [c0 * 30 + TRIM + 3, ...cuts.flatMap(x => [x - 7, x + 7]), c1 * 30 + 30 - TRIM - 3];
      for (let k = 0; k + 1 < xs.length; k += 2) { const a = xs[k], b = xs[k + 1]; if (b - a < 6) continue;
        p.rect([a, ym - 1.6, b, ym + 1.6], "core", 13);
        for (const up of [true, false]) p.out.push(K.obj(1293, p.X0 + (a + b) / 2, p.Y0 + ym + (up ? 4 : -4), { ch: C.glow, z: "T1", zo: 12, sx: (b - a) / 15, sy: 7 / 30, flipY: !up, groups: o.groups })); }
    } }
  return p.out.length - n0;
}

function dress(blocks, design, C, o = {}) {
  const out = [];
  for (const st of structures(blocks)) {
    const p = painter(st, C, o);
    DESIGNS[design].draw(st, p, C);
    if (o.interior !== false && !interior(st, p, C, o)) bars(st, p, C, o);
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
  // half blocks (slopes), both ways, on the floor and hanging
  ["slopes alone", ["/.\\"]], ["peak", ["/\\", "##"]], ["ramp up", ["./##", "/###"]], ["ramp down", ["##\\.", "###\\"]],
  ["hill", ["./\\.", "/##\\"]], ["arch", ["####", "r..7"]],
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
    rows.forEach((row, i) => [...row].forEach((ch, j) => { if (ch === "#" || CHAR[ch]) cells.push([c + j, r0 + rows.length - 1 - i, CHAR[ch] || "#"]); }));
    spans.push({ name, c0: c, c1: c + W }); c += W + gap; }
  return { cells, spans, end: c };
}

// the gallery: the connector sheet once per design (ice and fire in turn), then the 3D effects, then extending
function spec() {
  const objects = ["// every structure design and 3D effect on the connector sheet; flat run, no click"], copies = [];
  let c = 12;
  const add = (label, design, effects, pal, maps) => { const L = lay(maps || SHEET, c, 2, 1);
    for (const [x, y, k] of L.cells) objects.push(k === "#" ? ["block", x, y] : ["slope", x, y, { flipX: k[1] === "l", flipY: k[0] === "t" }]);
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

module.exports = { DESIGNS, EFFECTS, SHEET, interior, bars, erode, structures, region, tris, hyps, slopeKind, edges, corners, dress, extend, lay, spec };
if (require.main === module) {
  const a = process.argv.slice(2);
  if (a[0] === "list") { for (const [n, d] of Object.entries(DESIGNS)) console.log("design  " + n.padEnd(16) + d.note); for (const [n, d] of Object.entries(EFFECTS)) console.log("3D      " + n.padEnd(16) + d.note); }
  else if (a[0] === "sheet") { const L = lay(SHEET, 0, 0, 1), H = 5; for (let r = H - 1; r >= 0; r--) { let s = ""; for (let x = 0; x < L.end; x++) { const q = L.cells.find(q => q[0] === x && q[1] === r); s += q ? (Object.keys(CHAR).find(k => CHAR[k] === q[2]) || "#") : "."; }; console.log(s); } }
  else if (a[0] === "spec") { const out = a.includes("--out") ? a[a.indexOf("--out") + 1] : "specs/lab_struct_designs.json";
    require("fs").writeFileSync(out, JSON.stringify(spec(), null, 1) + "\n"); console.log("wrote " + out); }
  else console.log(require("fs").readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n"));
}
