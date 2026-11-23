// node tools/difficulty_fit.js  -- fits SIGMA and LAPSE (lib/difficulty.js) to the player's real
// runs: every normal-mode attempt in local/runs/ (tools/runs.js --level N) on an official level
// with a cached solution, plus "cube timings" (5 attempts, recording 17-26-36). An attempt that
// died at x% passed every input before x% and failed the next one; one that got past the part the
// sim covers only says those inputs were passed. Maximum likelihood on a grid.
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
const fs = require("fs"), path = require("path");
const { GD, readGdlvl } = require("./io.js");
const DF = require("../lib/difficulty.js");
const { scoreOfficial } = require("./difficulty.js");

function load() {
  const runs = [], dir = path.join(__dirname, "..", "local", "runs"), byLevel = {};
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    if (!f.endsWith(".json")) continue;
    const r = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    if (typeof r.level === "number") (byLevel[r.level] = byLevel[r.level] || []).push(...r.runs.filter(a => a.mode === "normal").map(a => Object.assign({ device: r.device }, a)));
  }
  for (const [n, atts] of Object.entries(byLevel)) {
    const d = scoreOfficial(+n);
    if (!d) continue;
    const len = d.levelBlocks * 30 - 90, covered = d.blocks * 30;
    runs.push({ name: "official " + n, acts: d.actions.map(a => ({ ms: a.ms, x: a.x })), atts: atts.map(a => ({ endX: a.beaten ? Infinity : a.pct / 100 * len, device: a.device })), covered });
  }
  const L = readGdlvl(path.join(__dirname, "..", "examples", "cube_timings.gdlvl")), w = GD.makeWorld(L.level.objects, L.level.header);
  const ct = DF.difficulty(w, GD.solveAny(w)).actions;
  runs.push({ name: "cube timings", acts: ct.map(a => ({ ms: a.ms, x: a.x })), covered: Infinity,
    atts: [57, 15, 45, 12].map(b => ({ endX: b * 30, device: "keyboard" })).concat([{ endX: Infinity, device: "keyboard" }]) });
  return runs;
}

function loglik(runs, s, l) {
  let L = 0;
  for (const r of runs) for (const a of r.atts) {
    const passed = r.acts.filter(x => x.x < a.endX), next = r.acts.find(x => x.x >= a.endX);
    for (const x of passed) L += Math.log(DF.hitChance(x.ms, s, l));
    if (a.endX !== Infinity && a.endX <= r.covered && next) L += Math.log(1 - DF.hitChance(next.ms, s, l));
  }
  return L;
}

if (require.main === module) {
  const runs = load();
  let best = null;
  for (let s = 6; s <= 20; s += 0.5) for (let l = 0; l <= 0.03; l += 0.0005) { const v = loglik(runs, s, l); if (!best || v > best.v) best = { s, l, v }; }
  console.log(`fit on ${runs.reduce((n, r) => n + r.atts.length, 0)} attempts over ${runs.length} levels: SIGMA ${best.s} ms, LAPSE ${(best.l * 100).toFixed(2)}%`);
  for (const r of runs) {
    const P = r.acts.filter(x => x.x < r.covered).reduce((p, x) => p * DF.hitChance(x.ms, best.s, best.l), 1);
    console.log(`  ${r.name.padEnd(13)} attempts ${r.atts.length}, ${r.atts.filter(a => a.endX === Infinity).length} beaten; model: ${(1 / P).toFixed(1)} attempts expected${r.covered < Infinity ? " (for the part the sim covers)" : ""}`);
  }
}
module.exports = { load, loglik };
