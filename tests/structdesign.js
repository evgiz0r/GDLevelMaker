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
// every design and effect draws on the connector sheet without throwing
const L2 = D.lay(D.SHEET, 0, 2, 1), blocks = L2.cells.map(([c, r]) => ({ x: c * 30 + 15, y: r * 30 + 15 }));
const C = { base: 1, deep: 2, inner: 3, line: 4, inline: 5, glow: 6, hi: 7, shadow: 8, detail: 9, core: 10 };
for (const d of Object.keys(D.DESIGNS)) for (const e of [[], ...Object.keys(D.EFFECTS).map(x => [x])]) assert(D.dress(blocks, d, C, { effects: e }).length > 0);
console.log("structdesign: ok");
