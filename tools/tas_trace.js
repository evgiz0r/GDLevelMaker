// node tools/tas_trace.js <from>,<to> [level] [--nudge tick:+k,...] [--late mode=k,...]  -- a gdsolver real-game plan
//   (tools/tas.js) through our sim, tick by tick: frame (hd), trigger channel, frame and world position, vy, gravity,
//   mode, what happened. --nudge moves single plan events (our ticks) to test a timing; --late sets the button latency
//   per mode. Used for Dash's rotated gameplay (PHYSICS.md "Rotated gameplay").
const R = __dirname + "/../";
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
const fs = require("fs"), path = require("path");
const T = require(R + "tools/tas.js"); const { GD, unpack } = require(R + "tools/io.js");
const args = process.argv.slice(2);
const ni = args.indexOf("--nudge"); const nudge = new Map();
if (ni >= 0) { for (const p of args[ni + 1].split(",")) { const [t, k] = p.split(":"); nudge.set(+t, +k); } args.splice(ni, 2); }
const li = args.indexOf("--late"); let late = null;
if (li >= 0) { late = { ship: 1, ufo: 1 }; for (const p of args[li + 1].split(",")) { const [m, k] = p.split("="); late[m] = +k; } args.splice(li, 2); }
const [a, b] = (args[0] || "1730,1750").split(",").map(Number);
const n = +(args[1] || 22);
const SRC = require("./gdpaths.js").LEVELS;
const L = GD.parseLevel(unpack(fs.readFileSync(SRC + n + ".txt", "utf8")));
const w = GD.makeWorld(L.objects, L.header);
const ev = T.loadPlan(n).map(e => ({ tick: e.tick + (nudge.get(e.tick) || 0), type: e.type }));
const r = T.playLatent(w, ev, late);
console.log("events near:", ev.filter(e => e.tick >= a - 5 && e.tick <= b).map(e => e.tick + e.type[0]).join(" "));
for (const s of r.path) {
  if (s.tick >= a && s.tick <= b) {
    const [X, Y] = GD.worldXY(s);
    console.log(s.tick, "hd", s.hd || 0, "ch", s.ch || 0, "x", s.x.toFixed(1), "y", s.y.toFixed(2), "W", X.toFixed(1), Y.toFixed(1), "vy", s.vy.toFixed(3), "g", s.grav, s.mode, s.mini ? "mini" : "", s.grounded ? "G" : "", s.act, s.dead ? ("DEAD " + s.why) : "");
  }
}
const e = r.end, [X, Y] = GD.worldXY(e);
console.log("end tick", e.tick, "world", X.toFixed(1), Y.toFixed(1), "block", (X / 30).toFixed(1), "hd", e.hd || 0, r.why, r.killer && [r.killer.id, r.killer.x, r.killer.y]);
