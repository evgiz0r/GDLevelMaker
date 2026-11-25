// node tools/difficulty_fit_v2.js [--top 10] [--json out.json]
//   Fits the difficulty v2 weights (DIFFICULTY.md "Balance": the v2 model) on stats, not on rules (the user, 2026-11-25:
//   "i dont want it to be too rule based, but rather more based on stats"; his ranking is a rough target: "its not about
//   fitting exactly, its just around").
//   Data: the main levels' presses (local/difficulty/scored_NN.json, cached by tools/difficulty.js; numbers only) and their
//   flight room + gravity / dual counts (knowledge/balance_mains_v2.json, from `tools/balance.js` on the PC).
//   Targets: Evgeni's ranking (knowledge/difficulty_rank_user.json, weight 2), the stars, his attempts per level
//   (local/difficulty/user_stats.json when there). Score = weighted mean Spearman rho.
//   Grid over SIGMA (timing spread), FLY_SPREAD (flight room), GRAV_PEN, DUAL_PEN (asymmetric = 2x, the user's order);
//   prints the best sets, the plateau (every set within 0.01 of the best), and an ablation: how much each feature adds.
//   Cheap (cached numbers, ~seconds): not a heavy job.
const fs = require("fs"), path = require("path");
const R = path.join(__dirname, "..");
const DF = require("../lib/difficulty.js");
const D = DF.DIFF;
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };

const lg = x => -Math.log10(Math.max(x, 1e-9));
const erf = x => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
const FLY = new Set(["ship", "ufo", "wave", "swing"]);
const STARS = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12, 13: 10, 14: 14, 15: 12, 16: 12, 17: 10, 18: 14, 19: 10, 20: 15, 21: 12, 22: 10 };
const NAME = { 1: "Stereo Madness", 2: "Back On Track", 3: "Polargeist", 4: "Dry Out", 5: "Base After Base", 6: "Cant Let Go", 7: "Jumper",
  8: "Time Machine", 9: "Cycles", 10: "xStep", 11: "Clutterfunk", 12: "Theory of Everything", 13: "Electroman Adventures", 14: "Clubstep",
  15: "Electrodynamix", 16: "Hexagon Force", 17: "Blast Processing", 18: "Theory of Everything 2", 19: "Geometrical Dominator",
  20: "Deadlocked", 21: "Fingerdash", 22: "Dash" };

// The flight room's min slack per second has glitches (ToE2 second 34 reads 0 in a corridor the route flies through):
// a 3-second running median within one mode stretch replaces each second's slack. Exported for balance.js to share.
function cleanFly(raw) {
  return raw.map((f, i) => {
    const same = [raw[i - 1], f, raw[i + 1]].filter(g => g && g[1] === f[1] && Math.abs(g[0] - f[0]) <= 1).map(g => g[2]).sort((a, b) => a - b);
    return [f[0], f[1], same.length === 3 ? same[1] : same.length === 2 ? (same[0] + same[1]) / 2 : f[2], f[3]];
  });
}
const flyCost = (fly, spread) => fly.reduce((s, f) => s + (f[3] / 60) * lg(erf(f[2] / 2 / (spread * Math.SQRT2))), 0);

// per level: the press parts that do not depend on the fitted weights, plus counts
function load() {
  const M = JSON.parse(fs.readFileSync(path.join(R, "knowledge", "balance_mains_v2.json"), "utf8")).levels;
  const rank = JSON.parse(fs.readFileSync(path.join(R, "knowledge", "difficulty_rank_user.json"), "utf8")).rank;
  const usf = path.join(R, "local", "difficulty", "user_stats.json"), us = fs.existsSync(usf) ? JSON.parse(fs.readFileSync(usf, "utf8")) : {};
  const out = [];
  for (const m of M) {
    const f = path.join(R, "local", "difficulty", `scored_${String(m.n).padStart(2, "0")}.json`);
    if (!fs.existsSync(f)) { console.error(`no ${path.relative(R, f)}: run tools/difficulty.js on the PC`); continue; }
    const acts = JSON.parse(fs.readFileSync(f, "utf8")).actions;
    const jump = [], flyN = acts.filter(a => FLY.has(a.mode)).length;
    let fixed = 0;
    for (const a of acts) {
      fixed += lg(1 - D.LAPSE);
      if (FLY.has(a.mode)) continue;
      const opensBefore = a.afterSwitchMs !== null && a.afterSwitchMs !== undefined && a.ms > a.afterSwitchMs + 1;
      if (!(opensBefore || DF.lateOpenOf(a))) fixed += lg(DF.settleOf(a));
      jump.push(a.ms);
    }
    // the dual count splits into plain and asymmetric from the cost at the assumed 0.05 / 0.10
    const c1 = lg(1 - 0.05), c2 = lg(1 - 0.10), nAsym = Math.max(0, Math.round((m.dual - m.dualPresses * c1) / (c2 - c1)));
    out.push({ n: m.n, name: NAME[m.n], fixed, jump, nPress: acts.length, flyN, grav: m.gravPresses, dual: m.dualPresses - nAsym, asym: nAsym,
      fly: cleanFly(m.flyRaw), flyRaw: m.flyRaw, rank: rank[m.n], stars: STARS[m.n], att: us[m.n] ? us[m.n].attempts : null, v1: m.score, v2: m.v2 });
  }
  return out;
}

function scoreOf(L, w) {
  let s = L.fixed;
  if (w.timing !== false) for (const ms of L.jump) s += lg(erf(ms / 2 / (w.SIGMA * Math.SQRT2)));
  s += L.grav * lg(1 - w.GRAV) + L.dual * lg(1 - w.DUAL) + L.asym * lg(1 - Math.min(0.9, 2 * w.DUAL));
  if (w.FLY) s += flyCost(L.fly, w.FLY);
  return s;
}

function ranks(v) { const ix = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]), r = new Array(v.length);
  for (let i = 0; i < ix.length;) { let j = i; while (j + 1 < ix.length && ix[j + 1][0] === ix[i][0]) j++; for (let k = i; k <= j; k++) r[ix[k][1]] = (i + j) / 2 + 1; i = j + 1; } return r; }
function spearman(a, b) { const k = a.map((x, i) => i).filter(i => a[i] != null && b[i] != null), ra = ranks(k.map(i => a[i])), rb = ranks(k.map(i => b[i]));
  const ma = ra.reduce((s, x) => s + x, 0) / ra.length, mb = rb.reduce((s, x) => s + x, 0) / rb.length;
  let n = 0, da = 0, db = 0; for (let i = 0; i < ra.length; i++) { n += (ra[i] - ma) * (rb[i] - mb); da += (ra[i] - ma) ** 2; db += (rb[i] - mb) ** 2; } return n / Math.sqrt(da * db); }
function fit(Ls, w) {
  const s = Ls.map(L => scoreOf(L, w));
  const rr = spearman(s, Ls.map(L => L.rank)), rs = spearman(s, Ls.map(L => L.stars)), ra = spearman(s, Ls.map(L => L.att));
  return { rank: rr, stars: rs, att: isNaN(ra) ? null : ra, obj: (2 * rr + rs + (isNaN(ra) ? rs : ra)) / 4, scores: s };
}

const GRID = { SIGMA: [6, 8, 10, 13, 16, 20, 22, 25, 28, 30, 35], FLY: [3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24], GRAV: [0, 0.005, 0.01, 0.02, 0.04], DUAL: [0, 0.01, 0.02, 0.05, 0.1] };
function search(Ls) {
  const all = [];
  for (const SIGMA of GRID.SIGMA) for (const FLY of GRID.FLY) for (const GRAV of GRID.GRAV) for (const DUAL of GRID.DUAL) {
    const w = { SIGMA, FLY, GRAV, DUAL }; all.push({ w, ...fit(Ls, w) });
  }
  return all.sort((a, b) => b.obj - a.obj);
}

if (require.main === module) {
  const Ls = load(), top = +(opt("--top") || 8);
  const assumed = { SIGMA: D.SIGMA, FLY: DF.FLY_SPREAD, GRAV: 0.01, DUAL: 0.05 };
  const f0 = fit(Ls, assumed), all = search(Ls), best = all[0];
  const fmt = r => `rho rank ${r.rank.toFixed(2)}  stars ${r.stars.toFixed(2)}  attempts ${r.att == null ? "-" : r.att.toFixed(2)}  -> ${r.obj.toFixed(3)}`;
  const v1 = { rank: spearman(Ls.map(L => L.v1), Ls.map(L => L.rank)), stars: spearman(Ls.map(L => L.v1), Ls.map(L => L.stars)), att: spearman(Ls.map(L => L.v1), Ls.map(L => L.att)) };
  v1.obj = (2 * v1.rank + v1.stars + v1.att) / 4;
  console.log(`${Ls.length} main levels`);
  console.log(`v1 (today's score)        ${fmt(v1)}`);
  console.log(`v2, assumed weights       ${fmt(f0)}   ${JSON.stringify(assumed)}`);
  console.log(`v2, best fit              ${fmt(best)}   ${JSON.stringify(best.w)}`);
  console.log(`\ntop ${top}:`); for (const r of all.slice(0, top)) console.log(`  ${JSON.stringify(r.w).padEnd(48)} ${fmt(r)}`);
  const plateau = all.filter(r => r.obj >= best.obj - 0.01);
  const span = k => { const v = plateau.map(r => r.w[k]); return `${Math.min(...v)}-${Math.max(...v)}`; };
  console.log(`\nplateau (within 0.01 of the best, ${plateau.length} sets): SIGMA ${span("SIGMA")}  FLY ${span("FLY")}  GRAV ${span("GRAV")}  DUAL ${span("DUAL")}`);
  // ablation: drop one feature at a time from the best set
  console.log(`\nwhat each feature adds (best set minus the feature):`);
  for (const [k, w] of [["timing (window width)", { ...best.w, timing: false }], ["flight room", { ...best.w, FLY: 0 }], ["gravity", { ...best.w, GRAV: 0 }], ["duals", { ...best.w, DUAL: 0 }]]) {
    const r = fit(Ls, w); console.log(`  without ${k.padEnd(22)} ${fmt(r)}  (${(r.obj - best.obj >= 0 ? "+" : "") + (r.obj - best.obj).toFixed(3)})`);
  }
  // the ladder next to his ranking
  const order = Ls.map((L, i) => ({ L, s: best.scores[i] })).sort((a, b) => a.s - b.s);
  console.log(`\nladder at the best fit (easiest first)        score  his rank  stars  attempts`);
  order.forEach((o, i) => console.log(`  ${String(i + 1).padStart(2)}. ${o.L.name.padEnd(26)} ${o.s.toFixed(2).padStart(6)}  ${String(o.L.rank).padStart(8)}  ${String(o.L.stars).padStart(5)}  ${String(o.L.att == null ? "-" : o.L.att).padStart(8)}`));
  if (opt("--json")) fs.writeFileSync(opt("--json"), JSON.stringify({ assumed: { w: assumed, ...f0 }, best: { w: best.w, rank: best.rank, stars: best.stars, att: best.att, obj: best.obj },
    v1, plateau: plateau.map(r => ({ w: r.w, obj: r.obj })), levels: Ls.map((L, i) => ({ n: L.n, name: L.name, rank: L.rank, stars: L.stars, att: L.att, v1: L.v1, v2assumed: +f0.scores[i].toFixed(3), v2fit: +best.scores[i].toFixed(3),
      fly: +flyCost(L.fly, best.w.FLY).toFixed(3) })) }, null, 1));
}
module.exports = { cleanFly, flyCost, load, fit, scoreOf, spearman };
