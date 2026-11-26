// node tests/connect.js -- holders for island structures (tools/connect.js): two near the ends of a floating slab (one
// in the middle of a 1-wide one), hanging or standing; never where the route passes; rope bridges only between close
// islands at one height and never across a portal
"use strict";
const assert = require("assert"), C = require("../tools/connect.js");
const B = cells => cells.map(([c, r]) => ({ id: 1, x: c * 30 + 15, y: r * 30 + 15 }));
// a low 3-wide slab at row 2: stands on two holders down to the ground, near its ends
let k = C.connectors(B([[10, 2], [11, 2], [12, 2]]));
assert.deepStrictEqual(k.map(q => q.kind), ["stand", "stand"]); assert.strictEqual(k[0].y0, 0); assert.strictEqual(k[0].y1, 60);
assert(k[0].x0 < 315 && k[1].x0 > 375, "near the ends");
// a high one (row 6) hangs, up to the top of the view
k = C.connectors(B([[10, 6], [11, 6]]));
assert.deepStrictEqual(k.map(q => q.kind), ["hang", "hang"]); assert.strictEqual(k[0].y0, 210);
// a 1-wide block: one, in the middle
assert.strictEqual(C.connectors(B([[10, 2]])).length, 1);
// the route under it and above it: no holder at all
assert.strictEqual(C.connectors(B([[10, 2], [11, 2]]), { pathCells: new Set(["10,0", "11,0", "10,4", "11,4"]) }).length, 0);
// the route under it only: it hangs instead
assert.deepStrictEqual(C.connectors(B([[10, 2], [11, 2]]), { pathCells: new Set(["10,0", "11,0"]) }).map(q => q.kind), ["hang", "hang"]);
// rope bridges: same height, 3 apart yes; 6 apart, a portal between, or another height: no
const two = (g, dr = 0) => B([[0, 0], [0, 1], [1 + g, 0], [1 + g, 1 + dr]]);
assert.strictEqual(C.connectors(two(3)).filter(q => q.kind === "bridge").length, 1);
assert.strictEqual(C.connectors(two(6)).filter(q => q.kind === "bridge").length, 0);
assert.strictEqual(C.connectors(two(3), { breaks: [60] }).filter(q => q.kind === "bridge").length, 0);
assert.strictEqual(C.connectors(two(3, 1)).filter(q => q.kind === "bridge").length, 0);
// every style draws, thin and behind the play
const pal = { base: 1, line: 2 };
for (const st of C.STYLES) { const o = C.draw(C.connectors(B([[10, 2], [11, 2]])), pal, { style: st }); assert(o.length && o.every(x => x.props[24] === "3"), st); }
console.log("connect: ok");
