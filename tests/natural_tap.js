// node tests/natural_tap.js  -- the human route's tap length (lib/natural.js tapMsFor): 75 ms by default, by the level's
// stars (easy longer, hard shorter), a per-level override, the user's own habit; and a planned cube jump gets it.
// Also the planner's time budget (opts.budgetMs).
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
// a time budget (opts.budgetMs): past it the optional passes are skipped, but the route returned still finishes
{ const n = N.naturalPlan(w, r, w.objects, { budgetMs: 1 }); assert(n && n.path[n.path.length - 1].done, "a spent budget still returns a finishing route"); }
// and the budget stops inside a pass too (Fingerdash's --replan ran 93 min past a 10 min budget: it was checked only
// between passes): 120 spikes, 40 ms budget -> back within about one replay of it, with a route that finishes
{ const objs = [{ id: 1, x: 120 * 300 + 900, y: 15 }]; for (let i = 0; i < 120; i++) objs.push({ id: 8, x: 300 + i * 300, y: 15 });
  const w2 = GD.makeWorld(objs), r2 = GD.solveAny(w2); assert(r2.ok, "120 spikes are jumped");
  const t0 = Date.now(), n2 = N.naturalPlan(w2, r2, w2.objects, { budgetMs: 40 }), dt = Date.now() - t0;
  assert(n2 && n2.path[n2.path.length - 1].done, "the route returned finishes");
  assert(dt < 1500, "stopped near its budget: " + dt + " ms"); }
console.log("natural_tap: ok");
