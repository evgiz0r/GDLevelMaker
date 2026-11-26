// node tests/density.js -- tools/density.js: a sparse route warns, a busy one passes (synthetic flat level, no solve)
"use strict";
const assert = require("assert"), D = require("../tools/density.js"), { GD } = require("../tools/io.js");
const level = { header: GD.parseLevel("kA4,0;1,1,2,15,3,-15;").header, objects: [] };
for (let x = 15; x < 6000; x += 30) level.objects.push({ id: 1, x, y: 600 });   // far above the path: only gives the level its length
const ev = gapS => { const e = []; for (let t = 60; t < 240 * 18; t += Math.round(gapS * 240)) e.push({ tick: t, type: "press" }, { tick: t + 12, type: "release" }); return e; };
const sparse = D.check(level, ev(2.2), "Hard"), busy = D.check(level, ev(0.47), "Hard");
assert(sparse.flags.length >= 1, "sparse route should warn: " + JSON.stringify(sparse));
assert(sparse.gap >= 2, "sparse gap " + sparse.gap);
assert(busy.median > sparse.median, "busy median above sparse");
assert(!busy.flags.some(f => /median/.test(f)), "busy route should not warn on median: " + busy.flags.join("; "));
assert.strictEqual(D.tierRef("Insane Demon").name, "Demon");
console.log(`density ok (sparse ${sparse.median.toFixed(2)}/s, ${sparse.flags.length} warns; busy ${busy.median.toFixed(2)}/s)`);
