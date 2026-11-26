// node tools/board_mains.js [--local <dir>] [--json]  -- the main-levels table for the GD Work Board
//   (local/board/state.json, field `mains`; board/README.md): per official level the rating,
//   whether the raw solve and the human route clear on today's sim (local/mains/status.json, tools/mains.js), the
//   difficulty score from the cached scored route (local/difficulty/scored_NN.json, same sum as
//   `tools/difficulty.js --cached`), inputs, tight inputs, tightest window, the user's attempts (user_stats.json),
//   and how far gdsolver's real-game plan carries our sim (tests/tas_progress.js REACHED). Light: no solving.
//   --local points at a copy of local/ (a cloud session reads the PC's files staged elsewhere).
const fs = require("fs"), path = require("path");
const DF = require("../lib/difficulty.js");
const args = process.argv.slice(2);
const li = args.indexOf("--local");
const LOCAL = li >= 0 ? args[li + 1] : path.join(__dirname, "..", "local");
const rd = f => { const p = path.join(LOCAL, f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null; };

const RATED = { 1: ["Stereo Madness", "Easy", 1], 2: ["Back On Track", "Easy", 2], 3: ["Polargeist", "Normal", 3],
  4: ["Dry Out", "Normal", 4], 5: ["Base After Base", "Hard", 5], 6: ["Can't Let Go", "Hard", 6], 7: ["Jumper", "Harder", 7],
  8: ["Time Machine", "Harder", 8], 9: ["Cycles", "Harder", 9], 10: ["xStep", "Insane", 10], 11: ["Clutterfunk", "Insane", 11],
  12: ["Theory of Everything", "Insane", 12], 13: ["Electroman Adventures", "Insane", 10], 14: ["Clubstep", "Demon", 14],
  15: ["Electrodynamix", "Insane", 12], 16: ["Hexagon Force", "Insane", 12], 17: ["Blast Processing", "Harder", 10],
  18: ["Theory of Everything 2", "Demon", 14], 19: ["Geometrical Dominator", "Harder", 10], 20: ["Deadlocked", "Demon", 15],
  21: ["Fingerdash", "Insane", 12], 22: ["Dash", "Harder", 10] };
// tests/tas_progress.js: blocks gdsolver's real-game plan carries our sim (2026-11-24 evening)
const PLAN = { 1: 328, 2: 493, 3: 909, 4: 415, 5: 175, 6: 303, 7: 210, 8: 333, 9: 382, 10: 167, 11: 288, 12: 33, 13: 116,
  14: 30, 15: 267, 16: 141, 17: 295, 18: 105, 19: 100, 20: 32, 21: 54, 22: 81 };
// spots where only an inhuman way was found (DIFFICULTY.md "Main levels kept current", humanroute.js)
const FLAGS = { 13: "33 ms UFO gap", 15: "33 ms UFO gap", 18: "33 ms UFO gap", 16: "holds through jumps", 21: "holds through jumps" };

const status = rd("mains/status.json"), user = rd("difficulty/user_stats.json") || {};
const st = {}; for (const l of (status && status.levels) || []) st[l.n] = l;
const rows = [];
for (const n of Object.keys(RATED).map(Number)) {
  const [name, face, stars] = RATED[n], s = st[n] || {}, c = rd(`difficulty/scored_${String(n).padStart(2, "0")}.json`);
  let score = null, inputs = null, tight = null, minMs = null, perMin = null, seconds = null;
  if (c) {
    let la = 0;
    for (const a of c.actions) {
      const k = a.afterSwitchMs != null && a.afterSwitchMs < DF.DIFF.SETTLE ? Math.max(0.02, a.afterSwitchMs / DF.DIFF.SETTLE) : 1;
      la -= Math.log10(Math.max(DF.hitChance(a.ms, DF.DIFF.SIGMA) * k, 1e-9));
    }
    score = +la.toFixed(2); seconds = +c.seconds.toFixed(1); perMin = +(la / Math.max(c.seconds, 1e-9) * 60).toFixed(2);
    inputs = c.actions.length; tight = c.actions.filter(a => a.ms < DF.DIFF.TIGHT).length;
    minMs = Math.round(Math.min(...c.actions.map(a => a.ms)));
  }
  const pct = r => r ? (r.done ? 100 : r.pct) : null;
  const scoreStale = !!(c && s.physics && c.physics !== s.physics);
  rows.push({ n, name, rating: `${face} ${stars}`, stars,
    solve_pct: pct(s.raw), route_pct: pct(s.view), route_kind: s.kind || null, need: s.need || null, physics: s.physics || null,
    score, per_min: perMin, inputs, tight, min_ms: minMs, scored_complete: c ? !!c.complete : null, score_stale: scoreStale,
    scored_at: c ? c.scoredAt : null, attempts: user[n] ? user[n].attempts : null,
    real_plan_block: PLAN[n], real_plan_pct: c && c.complete ? Math.min(100, Math.round(100 * PLAN[n] / c.blocks)) : null, flag: FLAGS[n] || null });
}
const out = { at: status ? status.at : null, levels: rows };
if (args.includes("--json")) console.log(JSON.stringify(out, null, 1));
else for (const r of rows) console.log(`${String(r.n).padStart(2)} ${r.name.padEnd(23)} ${r.rating.padEnd(10)} solve ${String(r.solve_pct).padStart(5)}% route ${String(r.route_pct).padStart(5)}% ` +
  `score ${r.score ?? "-"} (${r.per_min ?? "-"}/min) inputs ${r.inputs ?? "-"} tight ${r.tight ?? "-"} min ${r.min_ms ?? "-"} ms  yours ${r.attempts ?? "-"}  plan to block ${r.real_plan_block}${r.real_plan_pct != null ? " (" + r.real_plan_pct + "%)" : ""}${r.scored_complete === false ? "  (score partial)" : ""}${r.flag ? "  !" + r.flag : ""}${r.score_stale ? "  (score on older physics)" : ""}`);
