// node tests/lego.js -- the lego tools (LEGO.md): fly-path builds one path for every flying mode, its portal turns,
// and the piece cutter / classifier on small built levels (no official data needed).
"use strict";
const assert = require("assert");
const P = require("../tools/patterns.js").PATTERNS;
const L = require("../tools/lego.js");
const { GD } = require("../tools/io.js");

// one path, three modes: the same knots
for (const mode of ["wave", "ship", "swing"]) {
  const r = P["fly-path"].fn({ mode, rows: [2, 6, 2], seg: 5 });
  assert.equal(r.path[0], 2); assert.equal(Math.max(...r.path), 6); assert.equal(r.path[r.path.length - 1], 2);
  for (const o of r.objects) assert(o[2] >= 0 && o[2] <= 9, mode + ": object outside the band rows 0-9");
}
// wave legs are 45 degrees: one row per column
const wv = P["fly-path"].fn({ mode: "wave", rows: [2, 6, 2] }).path;
for (let i = 1; i < wv.length; i++) assert(Math.abs(wv[i] - wv[i - 1]) <= 1, "wave leg steeper than 45 degrees");
// flip turns: a gravity portal at each inner knot, and normal gravity at the end
const fl = P["fly-path"].fn({ mode: "wave", rows: [2, 6, 2, 6, 2], turns: "flip" }).objects.filter(o => /^gravity/.test(o[0]));
assert.equal(fl.filter(o => o[0] === "gravity down").length, fl.filter(o => o[0] === "gravity up").length, "flips leave normal gravity");
assert(fl.length >= 3);
// gates narrow the corridor
const g0 = P["fly-path"].fn({ mode: "ship", rows: [2, 6, 2], gap: 5 }).objects.length, g1 = P["fly-path"].fn({ mode: "ship", rows: [2, 6, 2], gap: 5, gates: [1], gateGap: 3 }).objects.length;
assert(g1 > g0, "a gate adds blocks");

// the cutter + classifier on a flat cube run (spikes far overhead set its length): a jump family piece, measured
{
  const objs = [], hdr = "kA2,0,kA4,1";
  for (let c = 10; c < 60; c += 12) objs.push(`1,8,2,${c * 30 + 15},3,255`);   // spikes high overhead: out of reach, they only set the level's length
  const level = GD.parseLevel(hdr + ";" + objs.join(";") + ";");
  const w = GD.makeWorld(level.objects, level.header);
  const ev = [{ tick: 300, type: "press" }, { tick: 305, type: "release" }];
  const r = GD.run(w, ev); assert(!r.dead, "the test run dies: " + r.why);
  const R = { w, r, inputs: { ticks: ev.map(e => e.tick), held: () => false } };
  const cuts = L.cut(r, R.inputs);
  assert(cuts.length >= 1);
  const p = L.measure({ src: "ours", name: "t" }, w, r, R.inputs, cuts[0][0], cuts[0][1]);
  assert.equal(p.family, "jump"); assert.equal(p.mode, "cube"); assert(p.sig.startsWith("jump / cube /"));
  assert(p.w > 10 && p.s > 0.6);
}
// repeats: the same columns at another phase are one layout; a changed column is not (the user: "many duplications")
{
  const row = ["", "S1", "S2", "S3", "S2", "S1", "", "S1", "S2", "S3", "S2", "S1", "", "S1", "S2"];
  assert(L.sameLayout(row.slice(0, 12), row.slice(6, 15).concat(["S3", "S2", "S1"])), "a repeat cut 6 columns later is the same layout");
  const other = row.slice(0, 12); other[3] = "H0";
  assert(!L.sameLayout(row.slice(0, 12), other), "a column that differs is another layout");
  assert(!L.sameLayout(["", "", "", ""], ["", "", "", ""]), "empty columns never make a repeat");
}
// votes: a weight per signature within 0.25..3, never 0 (a vote is not a ban)
{
  const w = L.sigWeights({ a: { id: "a", sig: "x", vote: -1 }, b: { id: "b", sig: "x", vote: -1 }, c: { id: "c", sig: "x", vote: -1 }, d: { id: "d", sig: "y", vote: 1, comment: "nice" } });
  assert.equal(w.x.weight, 0.25); assert.equal(w.y.weight, 1.5); assert.deepEqual(w.y.comments, ["nice"]);
}
console.log("lego ok");
