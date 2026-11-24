// node tests/natural_tap.js  -- the human route's tap length (lib/natural.js tapMsFor): 75 ms by default, by the level's
// stars (easy longer, hard shorter), a per-level override, the user's own habit; and a planned cube jump gets it.
const assert = require("assert");
const { GD } = require("../tools/io.js"), N = require("../lib/natural.js");
assert.strictEqual(N.tapMsFor(), 75);
assert.deepStrictEqual([1, 2, 3, 5, 6, 7, 8, 9, 10, 12].map(st => N.tapMsFor({ stars: st })), [90, 90, 80, 80, 75, 75, 70, 70, 60, 60]);
assert.strictEqual(N.tapMsFor({ tapMs: 65, stars: 1 }), 65, "a level's own setting wins");
assert.strictEqual(N.tapMsFor({ player: "user" }), 120, "the user's habit (tools/habits.js)");
// one spike, one jump: the planned tap is as long as the level's tap where that changes nothing
const w = GD.makeWorld([{ id: 8, x: 300, y: 15 }, { id: 1, x: 900, y: 15 }]);
const r = GD.solveAny(w); assert(r.ok, "the spike is jumped");
const len = o => { const n = N.naturalPlan(w, r, w.objects, o), p = n.events.find(e => e.type === "press"), q = n.events.find(e => e.type === "release" && e.tick > p.tick); return q.tick - p.tick; };
assert.strictEqual(len({ stars: 1 }), Math.round(90 * 0.24), "1 star: 90 ms");
assert.strictEqual(len({ stars: 12 }), Math.round(60 * 0.24), "demon: 60 ms");
assert.strictEqual(len({}), Math.round(75 * 0.24), "default 75 ms");
assert.strictEqual(len({ player: "user" }), Math.round(120 * 0.24), "the user's own tap");
console.log("natural_tap: ok");
