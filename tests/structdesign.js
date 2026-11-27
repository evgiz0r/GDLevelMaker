// node tests/structdesign.js -- structure designs (tools/structdesign.js): layers follow the whole shape, notch at inner
// corners, nothing drawn between blocks; extend keeps corners and caps
"use strict";
const assert = require("assert"), D = require("../tools/structdesign.js");
const S = cells => new Set(cells.map(([c, r]) => c + "," + r));
// a row of three is one piece at any inset: no seams, no frame between blocks
assert.deepStrictEqual(D.region(S([[0, 0], [1, 0], [2, 0]]), 2.4), [[2.4, 2.4, 87.6, 27.6]]);
// an L inset by 5 notches at its inner corner (30, 30): the corner quarter stays out
const L = D.region(S([[0, 0], [1, 0], [0, 1]]), 5), inside = (x, y) => L.some(q => x > q[0] && x < q[2] && y > q[1] && y < q[3]);
assert(inside(20, 20) && inside(50, 15) && inside(15, 50), "L body");
assert(!inside(32, 32) && !inside(27, 45), "nothing past the inner edges");
const k = D.corners(S([[0, 0], [1, 0], [0, 1]]));
assert.strictEqual(k.filter(c => c.inner).length, 1); assert.strictEqual(k.filter(c => !c.inner).length, 5);
// a 3x3 square has 4 outer corners and its inset region is one rectangle
assert.deepStrictEqual(D.region(S([0, 1, 2].flatMap(c => [0, 1, 2].map(r => [c, r]))), 6), [[6, 6, 84, 84]]);
// extend: a ring grows its sides, a T its arms, corners and the stem keep their size
assert.deepStrictEqual(D.extend(["###", "#.#", "###"], 5, 4), ["#####", "#...#", "#...#", "#####"]);
assert.deepStrictEqual(D.extend(["###", ".#.", ".#."], 7, 4, { cols: [0, 2] }), ["#######", "...#...", "...#...", "...#..."]);
// structures: blocks that touch at a corner are one structure; apart, two
assert.strictEqual(D.structures([{ x: 15, y: 45 }, { x: 45, y: 75 }]).length, 1);
assert.strictEqual(D.structures([{ x: 15, y: 45 }, { x: 105, y: 45 }]).length, 2);
// slopes: 1338 as placed is br (rising right), flipX bl, flipY tr; a turn of 90 moves the right angle clockwise
assert.strictEqual(D.slopeKind({}), "br"); assert.strictEqual(D.slopeKind({ flipX: true }), "bl"); assert.strictEqual(D.slopeKind({ flipY: true, flipX: true }), "tl");
assert.strictEqual(D.slopeKind({ rot: 90 }), "bl");
// a slope on a block: one structure; the block's layer runs up to the slope (no inset on its top), the slope's triangle
// is inset on its slant and open right leg only, and joins the block along its bottom leg
const P = D.structures([{ x: 15, y: 15, id: 1 }, { x: 15, y: 45, id: 1338 }]);
assert.strictEqual(P.length, 1);
assert.deepStrictEqual(D.region(P[0].S, 3), [[3, 3, 27, 30]]);
const t = D.tris(P[0].S, 3)[0], L3 = 30 - 3 - 3 * Math.SQRT2;
assert(Math.abs(t.L - L3) < 1e-9 && Math.abs(t.y - (30 + L3 / 2)) < 1e-9 && Math.abs(t.x - (27 - L3 / 2)) < 1e-9, "slope inset");
// a block beside a slope's slant (left of a br) keeps its right side open; beside its leg (right of a br) it joins
const Q = D.structures([{ x: 15, y: 15, id: 1 }, { x: 45, y: 15, id: 1338 }, { x: 75, y: 15, id: 1 }])[0];
assert.strictEqual(D.edges(Q.S, "E", 2).length, 2, "open: the left block's right side and the right block's right side");
assert.strictEqual(D.hyps(Q.S)[0].up, true);
// every design and effect draws on the connector sheet without throwing
const L2 = D.lay(D.SHEET, 0, 2, 1), blocks = L2.cells.map(([c, r]) => ({ x: c * 30 + 15, y: r * 30 + 15 }));
const C = { base: 1, deep: 2, inner: 3, line: 4, inline: 5, glow: 6, hi: 7, shadow: 8, detail: 9, core: 10 };
for (const d of Object.keys(D.DESIGNS)) for (const e of [[], ...Object.keys(D.EFFECTS).map(x => [x])]) assert(D.dress(blocks, d, C, { effects: e }).length > 0);
console.log("structdesign: ok");
