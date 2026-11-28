// node tests/outside.js -- tools/outside.js finds a route flown over a corridor's ceiling, and not one flown inside it
"use strict";
const assert = require("assert"), { GD } = require("../tools/io.js"), { outside } = require("../tools/outside.js");
const objs = [];
for (let c = 10; c < 40; c++) { objs.push({ id: 1, x: c * 30 + 15, y: 15 }); objs.push({ id: 1, x: c * 30 + 15, y: 5 * 30 + 15 }); }
const L = GD.parseLevel(GD.buildLevel ? GD.buildLevel(objs) : "kA2,0;" + objs.map(o => `1,${o.id},2,${o.x},3,${o.y}`).join(";") + ";");
const path = y => Array.from({ length: 1200 }, (_, i) => ({ x: 300 + i * 1.3, y, mode: "ship" }));
const inside = outside(L.objects, L.header, [], { path: path(90) }), over = outside(L.objects, L.header, [], { path: path(300) });
assert.strictEqual(inside.stretches.length, 0, "inside the corridor: no stretch");
assert.ok(over.stretches.length >= 1 && over.stretches[0].side === "above", "over the ceiling: found");
console.log("ok outside: inside 0 stretches, over the top " + over.stretches.length + " (blocks " + over.stretches[0].block0 + "-" + over.stretches[0].block1 + ")");
// the map form: a corridor (floor row 0, roof row 5) with a route inside, and one over the roof
const { outsideMap } = require("../tools/outside.js");
const map = Array.from({ length: 9 }, (_, i) => { const r = 8 - i; return (r === 0 || r === 5 ? "#" : ".").repeat(30); });
const rin = Array.from({ length: 30 }, (_, c) => [c, 2]), rover = Array.from({ length: 30 }, (_, c) => [c, 7.5]);
assert.ok(outsideMap(map, rin) === 0, "map: inside");
assert.ok(outsideMap(map, rover) > 0.9, "map: over the roof");
console.log("ok outsideMap: inside 0, over the roof " + outsideMap(map, rover).toFixed(2));
