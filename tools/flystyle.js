// node tools/flystyle.js --cases [--replan] [--level N]  -- Evgeni's route comments on main-level bricks (knowledge/lego_votes.json)
//   as planner test cases: per comment its flying stretch, saved route vs today's re-plan (PC only: the levels are local).
// node tools/flystyle.js <level | official:N> --trace <block>[-<block>] [--replan]  -- the route tick by tick there: mode, x, y,
//   vertical speed, button, grounded / sliding / on a slope, the free space (sim questions: "the wave seems sliding").
// node tools/flystyle.js <level.gdlvl | official:N | spec.json> [...] [--replan] [--cost]  -- how a level's route flies its ship / wave /
//   UFO / swing stretches: per stretch its presses, presses a second, mean leg (ms between inputs), legs under 100 ms,
//   ticks within 12 units of a wall, the tightest player window (ms; lib/difficulty.js measureWindows). --replan: the route planned again by today's lib/natural.js from the saved route
//   (or a fresh solve when there is none) and both shown side by side; --cost uses humanCost as solutions.js does.
// The user (2026-11-25, a wave corridor of 45-degree slopes): "really unnatural 'human' play, these corridors should be just
// few holds and releases. in tighter corridors we will need to fly tighter but in general we want to follow the pattern
// of the level". PHYSICS.md "The wave like a person". Nothing is saved: tools/solutions.js / difficulty_solve.js --replan do.
if (require.main === module) require("./heavy.js").claim();   // replays and planning: heavy (tools/heavy.js)
"use strict";
const fs = require("fs"), path = require("path");
const { GD, readGdlvl, unpack } = require("./io.js");
Object.assign(GD, require("../lib/natural.js"));
const DIFF = require("../lib/difficulty.js");
const FLY = { ship: 1, wave: 1, ufo: 1, swing: 1 };

function load(spec) {
  const m = /^official:(\d+)$/.exec(spec);
  let levelStr, events = null;
  if (m) {
    const SRC = process.env.GD_LEVELS || "C:/Program Files (x86)/Steam/steamapps/common/Geometry Dash/Resources/levels/";
    let j = null; try { j = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "local", `official_${m[1].padStart(2, "0")}.json`), "utf8")); events = j.solution && j.solution.events; } catch (e) {}
    // the game's own file on the PC; elsewhere (a cloud session with local/ staged) the level string saved beside the route
    try { levelStr = unpack(fs.readFileSync(path.join(SRC, m[1] + ".txt"), "utf8")); } catch (e) { if (!j || !j.level) throw e; levelStr = j.level; }
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
  const rc = GD.routeCheck(w, ev), p = GD.run(w, ev).path, out = [], sorted = ev.slice().sort((x, y) => x.tick - y.tick);
  let k = 0;
  for (let t = 0; t < p.length; t++) {
    if (!FLY[p[t].mode]) continue;
    const a = t, mode = p[t].mode; while (t < p.length && p[t].mode === mode) t++;
    const ins = ev.filter(e => e.tick >= a && e.tick < t), secs = (t - a) / 240, r = rc[k++] || {};
    const legs = ins.slice(1).map((e, i) => e.tick - ins[i].tick);
    out.push({ mode, from: +(p[a].x / 30).toFixed(1), to: +(p[t - 1].x / 30).toFixed(1), secs: +secs.toFixed(2), presses: r.presses,
      perSec: +(r.presses / Math.max(secs, 1e-9)).toFixed(2), legMs: legs.length ? Math.round(legs.reduce((x, y) => x + y, 0) / legs.length / 0.24) : null,
      short: legs.filter(d => d < 24).length, slide: p.slice(a, t).filter(q => q.mode === "wave" && q.vy === 0).length, tight: (() => { try { const m = DIFF.measureWindows(w, sorted, { range: [a, t - 1] }).map(q => q.ms).filter(v => v != null); return m.length ? Math.round(Math.min(...m)) : null; } catch (e) { return null; } })(), close: r.closeTicks, inputs: r.inputs, turns: r.turns, off: r.offPattern });
  }
  return out;
}
const line = s => `${s.mode.padEnd(5)} blocks ${String(s.from).padStart(6)}-${String(s.to).padEnd(6)} ${String(s.secs).padStart(5)} s  presses ${String(s.presses).padStart(3)} (${s.perSec}/s)  mean leg ${s.legMs ?? "-"} ms  legs<100ms ${s.short}  tightest ${s.tight ?? "-"} ms  near a wall ${s.close} ticks` + (s.mode === "wave" ? `  slides ${s.slide} ticks  inputs ${s.inputs} for ${s.turns} turns${s.off ? " OFF PATTERN" : ""}` : "");

// the route around blocks [b0, b1]: one line every 4 ticks
function trace(lv, ev, b0, b1) {
  const p = GD.run(lv.w, ev).path, held = new Array(p.length).fill(false), sorted = ev.slice().sort((x, y) => x.tick - y.tick);
  { let h = false, j = 0; for (let t = 0; t < p.length; t++) { while (j < sorted.length && sorted[j].tick === t) { h = sorted[j].type === "press"; j++; } held[t] = h; } }
  for (let t = 0; t < p.length; t += 4) {
    const q = p[t], bx = GD.progressX ? GD.progressX(q) / 30 : q.x / 30;
    if (bx < b0 || bx > b1) continue;
    const [lo, hi] = GD.flyFree(lv.w, q);
    console.log(`  t ${String(t).padStart(6)}  block ${bx.toFixed(2).padStart(7)}  ${q.mode.padEnd(5)} y ${q.y.toFixed(1).padStart(7)}  vy ${(+q.vy).toFixed(2).padStart(6)}  ${held[t] ? "HELD" : "    "}` +
      `${q.grounded ? " grounded" : ""}${q.waveOn ? " slid-on-block" : ""}${q.onSlope ? " on-slope" : ""}${q.grav === -1 ? " upside-down" : ""}${q.dead ? " DEAD" : ""}  free ${lo.toFixed(0)}..${hi.toFixed(0)}`);
  }
}
// Evgeni's comments on main-level bricks -> per level, the stretch each one is in (knowledge/lego_votes.json; ids r-<n>_<name>-<block>)
function cases(only) {
  let v = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "knowledge", "lego_votes.json"), "utf8"));
  v = Array.isArray(v) ? v : Object.values(v.votes || v);
  const by = new Map();
  for (const c of v) {
    const m = /^r-(\d+)_/.exec(c.id || ""); if (!m || !(c.comment || c.vote < 0)) continue;
    if (only && +m[1] !== only) continue;
    if (!by.has(+m[1])) by.set(+m[1], []); by.get(+m[1]).push(c);
  }
  return by;
}

if (require.main === module) {
  const a = process.argv.slice(2), files = a.filter((x, i) => !x.startsWith("--") && !/^--(trace|level)$/.test(a[i - 1] || ""));
  const tr = a.includes("--trace") ? a[a.indexOf("--trace") + 1].split("-").map(Number) : null;
  if (a.includes("--cases")) {
    const only = a.includes("--level") ? +a[a.indexOf("--level") + 1] : null;
    for (const [n, cs] of [...cases(only)].sort((x, y) => x[0] - y[0])) {
      let lv; try { lv = load("official:" + n); } catch (e) { console.log(`official ${n}: level not on this machine (${e.code || e.message})`); continue; }
      if (!lv.events) { console.log(`official ${n}: no saved route`); continue; }
      const before = stretches(lv.w, lv.events);
      let after = null;
      if (a.includes("--replan")) { const r = GD.naturalPlan(lv.w, { ok: true, events: lv.events }, lv.objects, { cost: a.includes("--cost") }); after = r ? stretches(lv.w, r.events) : null; }
      console.log(`== official ${n}: ${cs.length} comment(s)`);
      for (const c of cs) {
        const i = before.findIndex(s => c.x >= s.from - 3 && c.x <= s.to + 3);
        console.log(`  block ${c.x} "${c.comment || "(thumbs down)"}"  [${c.sig}]`);
        if (i < 0) { console.log("    not in a flying stretch"); continue; }
        console.log("    saved  " + line(before[i])); if (after && after[i]) console.log("    replan " + line(after[i]));
      }
    }
    process.exit(0);
  }
  if (!files.length) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).slice(0, 8).join("\n")); process.exit(1); }
  for (const f of files) {
    const lv = load(f);
    let ev = lv.events, t0 = Date.now();
    if (!ev) { const r = GD.solveAny(lv.w); if (!r.ok) { console.log(`${f}: not beaten (${r.why})`); continue; } ev = r.events; console.log(`${f}: no saved route; solved in ${((Date.now() - t0) / 1000).toFixed(1)} s`); }
    if (tr) {
      console.log(`${f}: saved route, blocks ${tr[0]}-${tr[1] ?? tr[0] + 3}`); trace(lv, ev, tr[0], tr[1] ?? tr[0] + 3);
      if (a.includes("--replan")) { const r = GD.naturalPlan(lv.w, { ok: true, events: ev }, lv.objects, {}); if (r) { console.log("re-planned:"); trace(lv, r.events, tr[0], tr[1] ?? tr[0] + 3); } }
      continue;
    }
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
    const mn = xs => { const v = xs.map(s => s.tight).filter(x => x != null); return v.length ? Math.min(...v) : "-"; }, under = xs => xs.filter(s => s.tight != null && s.tight < 100).length;
    console.log(`  total presses in flying parts ${sum(before, "presses")} -> ${sum(after, "presses")}, legs<100ms ${sum(before, "short")} -> ${sum(after, "short")}, near a wall ${sum(before, "close")} -> ${sum(after, "close")} ticks, wave slides ${sum(before, "slide")} -> ${sum(after, "slide")} ticks, off-pattern inputs ${sum(before, "off")} -> ${sum(after, "off")}, tightest window ${mn(before)} -> ${mn(after)} ms, stretches under 100 ms ${under(before)} -> ${under(after)}; finishes ${!!(n.path[n.path.length - 1].done)}, skips ${sk ? sk.skipped : "nothing"}; planned in ${(ms / 1000).toFixed(1)} s`);
  }
}
module.exports = { stretches };
