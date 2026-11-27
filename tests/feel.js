// node tests/feel.js -- tools/feel.js: drops faster / denser / more on the hits than breaks, every section inside the
// difficulty budget, no twin neighbours at one speed and shape, speed only where the builder has gameplay. Light, no solve.
"use strict";
const assert = require("assert");
const F = require("../tools/feel.js");
const sec = (type, heavy, t0, t1, mode) => ({ type, heavy, t0, t1, b0: Math.round(t0 * 2) + 1, b1: Math.round(t1 * 2) + 1, mode });
const S = [sec("break", 0.2, 0, 8, "cube"), sec("build", 0.45, 8, 16, "cube"), sec("drop", 0.8, 16, 24, "ship"), sec("groove", 0.6, 24, 32, "cube"),
  sec("break", 0.15, 32, 42, "ball"), sec("entry", 0.55, 42, 50, "cube"), sec("drop", 0.85, 50, 58, "wave")];
const r = F.feel(S, { tier: "Normal", speed: "1x", seed: 3, canSpeed: (m, sp) => /ship|wave|cube/.test(m) || sp === "1x" });
const f = r.sections.map(s => s.feel);
// every section inside the budget
for (const x of f) assert(x.cost >= 0.749 && x.cost <= 1.201, "cost out of budget: " + JSON.stringify(x));
// drops: faster than the base or denser than the breaks; hits chased harder
assert(f[2].speed === "2x" && f[6].speed === "2x", "heavy drops go a step faster");
assert(f[2].hitWeight > f[0].hitWeight && f[2].onHitTarget > f[4].onHitTarget, "drops are more on the beat than breaks");
assert(f[2].cps > f[0].cps && f[6].cps > f[4].cps, "drops click more than breaks");
assert(f[2].look === "intense" && f[0].look === "calm", "looks follow the feel");
// no twins: same speed, same shape and density within 10%
for (let i = 1; i < f.length; i++) assert(!(f[i].speed === f[i - 1].speed && f[i].shape === f[i - 1].shape && Math.abs(f[i].density - f[i - 1].density) < 0.1), "twin sections " + (i - 1) + "/" + i);
// a mode with no fast gameplay stays at the base
const r2 = F.feel([sec("break", 0.3, 0, 8, "cube"), sec("drop", 0.9, 8, 16, "ball")], { canSpeed: (m, sp) => m !== "ball" || sp === "1x" });
assert.strictEqual(r2.sections[1].feel.speed, "1x");
// the windows are never tightened
assert(f.every(x => x.windowMin === F.TIER.Normal.win));
// plan sections carry the feel
const ps = F.toPlanSections(r); assert(ps.length === S.length && ps[2].feel && ps[2].speed === "2x");
console.log("feel ok:", JSON.stringify(r.summary));
