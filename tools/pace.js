// node tools/pace.js                     -- PACE targets from real levels (Jumper, xStep, Clutterfunk, Electroman Adventures):
//                                           clicks per second, obstacles per bar, height / move changes per 10 s, mode
//                                           changes per minute -> knowledge/pace_targets.json (+ a table)
// node tools/pace.js <level.gdlvl ...>    -- the same numbers for our levels / lab variants, next to the targets
//
// The user (2026-11-24): our levels are "pretty dim. Slow, too low CPS, nothing interesting". Pace comes from REAL levels,
// not ours: the official levels' cached solved routes (local/difficulty/NN.json) for clicks, tools/energy.js for obstacle
// starts per bar (gd-taste's one definition), tools/flow.js for changes per 10 s. The section lab (tools/lab.js) builds
// toward these and reports each variant against them.
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), OUT = path.join(ROOT, "knowledge", "pace_targets.json");
const { GD, readGdlvl } = require("./io.js");
const REFS = [[7, "Jumper"], [10, "xStep"], [11, "Clutterfunk"], [13, "Electroman Adventures"]];
const TPS = 240;

function paceOf(level, events, grid) {
  const E = require("./energy.js"), F = require("./flow.js");
  const presses = (events || []).filter(e => e.type === "press");
  const w = GD.makeWorld(level.objects, level.header), run = events ? GD.run(w, events) : null;
  const secs = run ? run.path.length / TPS : null;
  const c = E.curve({ header: level.header, objects: level.objects, grid });
  const obsPerBar = c.bars.length ? c.bars.reduce((s, b) => s + b.n, 0) / c.bars.length : null;
  let changes = null; try { changes = F.measure(level, events).changesPer10s; } catch (e) {}
  const modes = level.objects.filter(o => (GD.objInfo(o.id) || {}).kind === "mode").length;
  return { secs: secs && +secs.toFixed(1), cps: secs ? +(presses.length / secs).toFixed(2) : null, obsPerBar: obsPerBar != null ? +obsPerBar.toFixed(2) : null, unit: c.unit,
    changesPer10s: changes, modeChangesPerMin: secs ? +(modes / (secs / 60)).toFixed(1) : null };
}
function targets() {
  const E = require("./energy.js"), rows = [];
  for (const [n, name] of REFS) {
    let sol = null; try { sol = JSON.parse(fs.readFileSync(path.join(ROOT, "local", "difficulty", String(n).padStart(2, "0") + ".json"), "utf8")); } catch (e) {}
    const L = E.loadLevel("official:" + n);
    rows.push(Object.assign({ level: name }, paceOf(L, sol && sol.ok ? sol.events : null, L.grid)));
  }
  const med = k => { const v = rows.map(r => r[k]).filter(x => x != null).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };
  const out = { note: "pace of real levels (tools/pace.js): official solved routes, energy.js obstacles per bar, flow.js changes per 10 s", at: new Date().toISOString(), rows,
    target: { cps: med("cps"), obsPerBar: med("obsPerBar"), changesPer10s: med("changesPer10s"), modeChangesPerMin: med("modeChangesPerMin") } };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  return out;
}
const load = () => { try { return JSON.parse(fs.readFileSync(OUT, "utf8")); } catch (e) { return targets(); } };
function ofFile(file) {
  const L = readGdlvl(file), sol = require("./solutions.js").get(L.levelStr, true), c = GD.getField(L.rec, "k45");
  const B = require("./beats.js"); let grid = null; try { grid = B.loadBeats(c && c !== "0" ? "custom_" + c : "official_" + B.OFFICIAL[+(GD.getField(L.rec, "k8") || 0)]); } catch (e) {}
  return Object.assign({ level: L.name }, paceOf(L.level, sol && sol.events, grid));
}

module.exports = { paceOf, targets, load, ofFile, REFS };

if (require.main === module) {
  const files = process.argv.slice(2), T = files.length ? load() : targets();
  const row = r => `${String(r.level).padEnd(32)} ${String(r.cps ?? "-").padStart(5)} cps  ${String(r.obsPerBar ?? "-").padStart(5)} obstacles/${r.unit || "bar"}  ${String(r.changesPer10s ?? "-").padStart(5)} changes/10 s  ${String(r.modeChangesPerMin ?? "-").padStart(4)} mode changes/min`;
  for (const r of T.rows) console.log(row(r));
  console.log(row(Object.assign({ level: "TARGET (median)" }, T.target)));
  for (const f of files) console.log(row(ofFile(f)));
}
