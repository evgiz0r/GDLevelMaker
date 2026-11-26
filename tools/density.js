// node tools/density.js <level.gdlvl ...> [--tier Hard] [--json]
//
// Is a level too sparse? (Evgeni, 2026-11-26: "i want levels not to be so sparse, the beats are decently quick so that
// should be better".) The level's route (the saved solution, tools/solutions.js) is cut into lego bricks exactly as
// tools/lego.js cuts every level (one definition of a brick and its cps), then compared with the bricks of rated levels
// of the target tier (knowledge/brick_tiers.json, tools/brickstats.js: official + community levels, LEGO.md "Clicks and
// timing by tier"). Soft rule, WARN in score.js gate "density":
//   (the whole level's clicks per second against the bricks is tempo.js's gate "tempo"; this one looks inside the level)
//   - the calmest 10% of 4 s windows under 0.5 clicks/s (near-empty stretches, wherever they are), or
//   - the bricks' median clicks per second under 85% of the tier's median (a typical stretch asks for too few clicks), or
//   - the calm end (10th percentile) under 70% of the tier's (too many near-empty stretches), or
//   - over 20% of the bricks with no click at all outside planned auto sections (rated levels: 6-14%), or
//   - a stretch of 2.5 s or more with no press in a clicking mode (the longest is printed with its block).
// The tier: --tier, else the brief's target / the level's difficulty label (score.js passes it); unknown -> Hard.
// About a second a level with a saved route (no solve; a level without one says so). Test: node tests/density.js.
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const { GD, readGdlvl } = require("./io.js");
// tier references: tools/brickstats.js --write -> knowledge/brick_tiers.json (the same table tempo.js reads)
const REF = JSON.parse(fs.readFileSync(path.join(ROOT, "knowledge", "brick_tiers.json"), "utf8"));
const TPS = GD.PHYS.TPS;

const pct = (a, q) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
function tierRef(tier) { const t = String(tier || "Hard").replace(/ Demon$/, "Demon").replace(/^(Easy|Medium|Hard|Insane|Extreme) ?Demon$/i, "Demon");
  const q = REF.tiers[t] && REF.tiers[t].cps.median ? t : "Hard", T = REF.tiers[q]; return { name: q, median: T.cps.median, p10: T.cps.p10, p90: T.cps.p90, noClick: T.noClick }; }

// level: parsed level ({objects, header}); events: a route's events. -> numbers + flags
function check(level, events, tier) {
  const L = require("./lego.js"), w = GD.makeWorld(level.objects, level.header), r = GD.run(w, events), inputs = L.heldAt(events);
  const src = { src: "ours", name: "density", level, events };
  const bricks = L.cut(r, inputs, { auto: true, items: w.items }, "brick").map(([i0, i1, kind]) => {
    const P = L.measure(src, w, r, inputs, i0, i1); return { cps: P.cps != null ? P.cps : (P.s > 0 ? P.presses / P.s : 0), s: P.s, x: P.x, auto: kind === "auto" || P.presses === 0, mode: P.mode }; });
  const clicking = bricks.filter(b => !b.auto), cps = clicking.map(b => b.cps);
  // the longest stretch with no press while in a clicking mode (cube, ball, ufo, robot, spider, swing; ship and wave hold)
  const presses = []; { let h = false; for (const t of inputs.ticks || []) { const nh = inputs.held(t); if (nh && !h) presses.push(t); h = nh; } }
  const end = r.path[r.path.length - 1].tick; let gap = 0, gapAt = 0;
  { const pts = [r.path[0].tick, ...presses, end]; for (let i = 1; i < pts.length; i++) { const d = (pts[i] - pts[i - 1]) / TPS; if (d > gap) { gap = d; gapAt = pts[i - 1]; } } }
  const atState = r.path.find(q => q.tick >= gapAt) || r.path[0];
  // the whole level's clicks per second, and its calm end: 4 s windows every second (bricks alone can't show sparsity:
  // a lone press is a short brick of its own, so the empty run between bricks never counts in brick cps)
  const playS = Math.max(1e-6, (end - r.path[0].tick) / TPS), win = [];
  for (let a = r.path[0].tick; a + 4 * TPS <= end; a += TPS) win.push(presses.filter(t => t >= a && t < a + 4 * TPS).length / 4);
  const ref = tierRef(tier), out = { levelCps: presses.length / playS, calmWin: pct(win, 0.1),
    tier: ref.name, bricks: bricks.length, noClick: bricks.length ? bricks.filter(b => b.auto).length / bricks.length : 0,
    median: pct(cps, 0.5), p10: pct(cps, 0.1), p90: pct(cps, 0.9), gap, gapBlock: Math.round(GD.progressX(atState) / 30), ref, flags: [] };
  if (out.calmWin < 0.5) out.flags.push(`the calmest 10% of 4 s windows have ${out.calmWin.toFixed(2)} clicks/s: near-empty stretches`);
  if (out.median < 0.85 * ref.median) out.flags.push(`median ${out.median.toFixed(2)} clicks/s, ${ref.name} levels ${ref.median.toFixed(2)}: more presses per stretch (follow the beat)`);
  if (out.p10 < 0.7 * ref.p10) out.flags.push(`calm end ${out.p10.toFixed(2)} clicks/s, ${ref.name} levels ${ref.p10.toFixed(2)}: fewer near-empty stretches`);
  if (out.noClick > 0.2) out.flags.push(`${Math.round(100 * out.noClick)}% of the bricks have no click (rated levels 6-14%)`);
  if (gap >= 2.5) out.flags.push(`${gap.toFixed(1)} s with no press from block ${out.gapBlock}`);
  return out;
}
function checkFile(file, tier) {
  const L = readGdlvl(file), level = L.level || GD.parseLevel(L.levelStr), sol = require("./solutions.js").get(L.levelStr, true);
  if (!sol || !sol.events) return { error: "no saved route (node tools/make.js or tools/solutions.js first)" };
  return check(level, sol.events, tier);
}
module.exports = { check, checkFile, tierRef, REF };

if (require.main === module) {
  const A = process.argv.slice(2), opt = k => { const i = A.indexOf("--" + k); return i >= 0 ? A[i + 1] : null; };
  const files = A.filter((a, i) => !a.startsWith("--") && A[i - 1] !== "--tier");
  if (!files.length) { console.log(fs.readFileSync(__filename, "utf8").split("\n")[0]); process.exit(1); }
  for (const f of files) {
    const q = checkFile(f, opt("tier"));
    if (A.includes("--json")) { console.log(JSON.stringify({ file: f, ...q })); continue; }
    if (q.error) { console.log(`${f}: ${q.error}`); continue; }
    console.log(`${path.basename(f)} vs ${q.tier}: ${q.levelCps.toFixed(2)} clicks/s over the level (calmest 4 s windows ${q.calmWin.toFixed(2)}), ${q.bricks} bricks, clicks/s p10 ${q.p10.toFixed(2)} / median ${q.median.toFixed(2)} / p90 ${q.p90.toFixed(2)} ` +
      `(${q.tier}: ${q.ref.p10} / ${q.ref.median} / ${q.ref.p90}), no-click ${Math.round(100 * q.noClick)}%, longest gap ${q.gap.toFixed(1)} s at block ${q.gapBlock}`);
    console.log(q.flags.length ? q.flags.map(s => "  WARN " + s).join("\n") : "  PASS");
  }
}
