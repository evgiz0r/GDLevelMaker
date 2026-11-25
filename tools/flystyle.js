// node tools/flystyle.js <level.gdlvl | official:N | spec.json> [...] [--replan] [--cost]  -- how a level's route flies its ship / wave /
//   UFO / swing stretches: per stretch its presses, presses a second, mean leg (ms between inputs), legs under 100 ms,
//   ticks within 12 units of a wall. --replan: the route planned again by today's lib/natural.js from the saved route
//   (or a fresh solve when there is none) and both shown side by side; --cost uses humanCost as solutions.js does.
// The user (2026-11-25, a wave corridor of 45-degree slopes): "really unnatural 'human' play, these corridors should be just
// few holds and releases. in tighter corridors we will need to fly tighter but in general we want to follow the pattern
// of the level". PHYSICS.md "The wave like a person". Nothing is saved: tools/solutions.js / difficulty_solve.js --replan do.
if (require.main === module) require("./heavy.js").claim();   // replays and planning: heavy (tools/heavy.js)
"use strict";
const fs = require("fs"), path = require("path");
const { GD, readGdlvl, unpack } = require("./io.js");
Object.assign(GD, require("../lib/natural.js"));
const FLY = { ship: 1, wave: 1, ufo: 1, swing: 1 };

function load(spec) {
  const m = /^official:(\d+)$/.exec(spec);
  let levelStr, events = null;
  if (m) {
    const SRC = process.env.GD_LEVELS || "C:/Program Files (x86)/Steam/steamapps/common/Geometry Dash/Resources/levels/";
    levelStr = unpack(fs.readFileSync(path.join(SRC, m[1] + ".txt"), "utf8"));
    try { const j = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "local", `official_${m[1].padStart(2, "0")}.json`), "utf8")); events = j.solution && j.solution.events; } catch (e) {}
  } else if (spec.endsWith(".json")) {   // a spec, built in memory (a lab level; nothing written)
    const log = console.log; console.log = () => {};
    try { const b = require("./make.js").build(JSON.parse(fs.readFileSync(spec, "utf8")), spec); levelStr = GD.serializeLevel(b.level); } finally { console.log = log; }
  } else {
    levelStr = readGdlvl(spec).levelStr;
    const sol = require("./solutions.js").get(levelStr, true); events = sol && sol.events;
  }
  const L = GD.parseLevel(levelStr);
  return { levelStr, objects: L.objects, w: GD.makeWorld(L.objects, L.header), events };
}
// per flying stretch of a run
function stretches(w, ev) {
  const rc = GD.routeCheck(w, ev), p = GD.run(w, ev).path, out = [];
  let k = 0;
  for (let t = 0; t < p.length; t++) {
    if (!FLY[p[t].mode]) continue;
    const a = t, mode = p[t].mode; while (t < p.length && p[t].mode === mode) t++;
    const ins = ev.filter(e => e.tick >= a && e.tick < t), secs = (t - a) / 240, r = rc[k++] || {};
    const legs = ins.slice(1).map((e, i) => e.tick - ins[i].tick);
    out.push({ mode, from: +(p[a].x / 30).toFixed(1), to: +(p[t - 1].x / 30).toFixed(1), secs: +secs.toFixed(2), presses: r.presses,
      perSec: +(r.presses / Math.max(secs, 1e-9)).toFixed(2), legMs: legs.length ? Math.round(legs.reduce((x, y) => x + y, 0) / legs.length / 0.24) : null,
      short: legs.filter(d => d < 24).length, close: r.closeTicks, inputs: r.inputs, turns: r.turns, off: r.offPattern });
  }
  return out;
}
const line = s => `${s.mode.padEnd(5)} blocks ${String(s.from).padStart(6)}-${String(s.to).padEnd(6)} ${String(s.secs).padStart(5)} s  presses ${String(s.presses).padStart(3)} (${s.perSec}/s)  mean leg ${s.legMs ?? "-"} ms  legs<100ms ${s.short}  near a wall ${s.close} ticks` + (s.mode === "wave" ? `  inputs ${s.inputs} for ${s.turns} turns${s.off ? " OFF PATTERN" : ""}` : "");

if (require.main === module) {
  const a = process.argv.slice(2), files = a.filter(x => !x.startsWith("--"));
  if (!files.length) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).slice(0, 4).join("\n")); process.exit(1); }
  for (const f of files) {
    const lv = load(f);
    let ev = lv.events, t0 = Date.now();
    if (!ev) { const r = GD.solveAny(lv.w); if (!r.ok) { console.log(`${f}: not beaten (${r.why})`); continue; } ev = r.events; console.log(`${f}: no saved route; solved in ${((Date.now() - t0) / 1000).toFixed(1)} s`); }
    const before = stretches(lv.w, ev);
    console.log(`${f}: ${before.length} flying stretches${a.includes("--replan") ? " -- saved route, then re-planned" : ""}`);
    if (!a.includes("--replan")) { for (const s of before) console.log("  " + line(s)); continue; }
    t0 = Date.now();
    const n = GD.naturalPlan(lv.w, { ok: true, events: ev }, lv.objects, { cost: a.includes("--cost") });
    const ms = Date.now() - t0;
    if (!n) { console.log("  re-plan: none"); continue; }
    const after = stretches(lv.w, n.events), sk = GD.skipCheck(lv.w, n.path, n.events);
    before.forEach((s, i) => { console.log("  before " + line(s)); if (after[i]) console.log("  after  " + line(after[i])); });
    const sum = (xs, k) => xs.reduce((x, s) => x + (s[k] || 0), 0);
    console.log(`  total presses in flying parts ${sum(before, "presses")} -> ${sum(after, "presses")}, legs<100ms ${sum(before, "short")} -> ${sum(after, "short")}, near a wall ${sum(before, "close")} -> ${sum(after, "close")} ticks, off-pattern inputs ${sum(before, "off")} -> ${sum(after, "off")}; finishes ${!!(n.path[n.path.length - 1].done)}, skips ${sk ? sk.skipped : "nothing"}; planned in ${(ms / 1000).toFixed(1)} s`);
  }
}
module.exports = { stretches };
