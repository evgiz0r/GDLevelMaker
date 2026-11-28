// node tests/moments.js -- transition moments: the orchestrator plans one on a strong beat at a section change
// (tools/moments.js plan), the effects make deco-only triggers, and the judge's check finds them (and flags a flat one).
"use strict";
const assert = require("assert"), M = require("../tools/moments.js"), FX = require("../tools/effects.js");
const bars = []; for (let i = 0; i < 30; i++) bars.push({ t: i * 2, intensity: 0.3, heavy: 0.3 });
const music = { bars, impacts: [{ t: 10.1, kind: "entry", strength: 0.9 }, { t: 20, kind: "entry", strength: 0.3 }, { t: 30.2, kind: "entry", strength: 0.7 }], notes: [] };
const P = 0.5, parts = [{ i: 0, b0: 1, floor: 1 }, { i: 1, b0: 21, floor: 2 }, { i: 2, b0: 41, floor: 1 }, { i: 3, b0: 61, floor: 3 }];
const plan = M.plan({ music, from: 0, P, parts });
assert.strictEqual(plan.length, 2, "two strong changes (the 0.3 beat is too weak): " + JSON.stringify(plan));
assert.strictEqual(plan[0].t, 10.1); assert.strictEqual(plan[0].effects.length, 3, "the strongest gets the peak set");
assert(plan[1].effects.length === 2 && plan[1].effects.every(e => FX[e]), "a pair of known effects");
assert.strictEqual(M.plan({ music, P, parts: parts.map(p => p.i === 1 ? Object.assign({}, p, { moment: "none" }) : p) }).length, 1, "a section can say none");
// the effects: deco only (no hazard, no solid), triggers present
const path = []; for (let i = 0; i < 240 * 40; i++) path.push({ x: i * 311.58 / 240, y: 45 });
const c = FX.context({ path });
for (const e of ["gateShut", "riseReveal", "cameraBreath", "slabsFall"]) {
  const objs = FX[e](c, { t: 10.1, y: 45 }); assert(objs.length, e);
  assert(objs.every(o => [211, 901, 1007, 1913, 1916, 1346].includes(o.id)), e + " uses only deco squares and triggers: " + [...new Set(objs.map(o => o.id))]); }
// the check: a portal at 10 s with a moment trigger (group 991) is ok, one at 30 s without is flat
const xAt = t => t * 311.58;
const objects = [{ id: 13, x: xAt(10), y: 60, props: {} }, { id: 12, x: xAt(30.2), y: 60, props: {} }, { id: 1913, x: xAt(10.1), y: 400, props: { 57: "991" } }];
const r = M.check({ objects, path, music });
assert.deepStrictEqual(r.map(m => m.ok), [true, false], JSON.stringify(r));
console.log("moments: ok", plan.map(m => m.effects.join("+") + "@" + m.t).join(", "));
