// node tests/effects.js  -- the effects toolkit (tools/effects.js) and its gallery (tools/fxgallery.js): the gallery clears
// with no press, the effects leave the run exactly as it was, every effect object is deco or a trigger, groups stay on effect
// objects (and the gallery's hidden pads), pads launch on their beat. ~5 s.
"use strict";
const assert = require("assert");
const { GD } = require("../tools/io.js");
const FX = require("../tools/effects.js"), fg = require("../tools/fxgallery.js");
const b = fg.build({});
assert.ok(b.measures.clears, "the gallery dies: " + b.measures.why);
assert.ok(!b.measures.fxChangeRun, "the effects change the zero-press run");
const TRIG = new Set([901, 1007, 1346, 2067, 1049, 899, 1006, 1913]);
let fxObjs = 0;
for (const o of b.level.objects) {
  const gs = o.props && o.props[57] ? String(o.props[57]).split(".").map(Number) : [];
  const mine = gs.some(g => g >= 2001 && g <= 3999);
  if (!mine && !TRIG.has(o.id)) continue;
  fxObjs++;
  const k = GD.objInfo(o.id).kind;
  if (gs.includes(3990)) { assert.strictEqual(o.id, 35, "group 3990 is only the hidden pads"); continue; }
  assert.ok(k === "decoration" || k === "trigger" || o.id === 914, `effect object id ${o.id} is ${k}, not deco`);
}
assert.ok(fxObjs > 500, "too few effect objects: " + fxObjs);
// pads launch on the beat (within a frame)
const w = GD.makeWorld(b.level.objects, b.level.header), p = GD.run(w, []).path;
let pads = 0;
for (let i = 1; i < p.length; i++) if (p[i].vy > p[i - 1].vy + 5 && p[i - 1].grounded) {
  pads++; const beat = (i / 240 - b.g.t0) / b.g.period; assert.ok(Math.abs(beat - Math.round(beat)) * b.g.period < 0.017, "a pad off its beat at " + (i / 240).toFixed(2) + " s");
}
assert.ok(pads >= 10, "pads: " + pads);
// the falling shapes: one drop per beat, each its own group
{ const { GD: G } = require("../tools/io.js"); const w0 = G.makeWorld(b.level.objects, b.level.header), p0 = G.run(w0, []).path;
  const c = FX.context({ path: p0, grid: b.g, notes: [] }), objs = FX.fall(c, { t0: 10, t1: 14 });
  assert.ok(objs.filter(o => o.id === 901).length >= 12, "fall: too few moves"); }
// every effect documented
for (const k of Object.keys(FX.doc)) assert.strictEqual(typeof FX[k], "function", k);
console.log(`ok effects: gallery ${b.measures.secs} s, ${b.measures.triggers} triggers, ${b.measures.groups} groups, ${pads} launches on the beat, run unchanged`);
