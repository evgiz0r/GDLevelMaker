// node tools/difficulty_density.js [--fit] [--sigma 13] [--no-mains] [--json]   (default: the bounds check; --fit: the old fits)
//   -- does the difficulty score need density and length terms? Fits the user's attempts on the levels he beat
//   against what the sim measured, with leave-one-out:
//     base:     log10(attempts) = a + b * score                       (score = lib/difficulty.js logAttempts)
//     density:  log10(attempts) = a + b * score + c * inputs/min + d * minutes
//   Data: the main levels (local/difficulty/scored_NN.json, rescored here with the current chance model, as
//   `difficulty.js --cached`) and the community levels he beat (local/difficulty/community.jsonl, written by
//   `difficulty.js c<id>`), each with his lifetime attempts from local/difficulty/user_stats_online.json
//   (tools/save_stats.js --demons). Numbers only, from local/; nothing is written. Light (no solve).
// Built 2026-11-25 (DIFFICULTY.md "Community demons": the model scored Easy Demons like Hard mains).
const fs = require("fs"), path = require("path");
const DF = require("../lib/difficulty.js");
const OUT = path.join(__dirname, "..", "local", "difficulty");
const args = process.argv.slice(2);
const si = args.indexOf("--sigma"), sigma = si >= 0 ? +args[si + 1] : DF.DIFF.SIGMA, settle = DF.DIFF.SETTLE;
const user = JSON.parse(fs.readFileSync(path.join(OUT, "user_stats_online.json"), "utf8"));
const att = {}; for (const l of user.levels) if (l.done && l.attempts > 0) att[(l.kind === "main" ? "m" : "c") + l.id] = l;

// skip: Fingerdash (scores 0.02: route open), Deadlocked (10.69: partial/odd), levels whose routes are not trusted
const SKIP = new Set(["m21", "m20", "c7116121", "c55520"]);
const rows = [];
if (!args.includes("--no-mains")) for (let n = 1; n <= 22; n++) {
  const f = path.join(OUT, `scored_${String(n).padStart(2, "0")}.json`), k = "m" + n;
  if (!fs.existsSync(f) || !att[k] || SKIP.has(k)) continue;
  const c = JSON.parse(fs.readFileSync(f, "utf8"));
  if (!c.complete) continue;
  let la = 0;
  for (const a of c.actions) {
    const m = a.afterSwitchMs != null && a.afterSwitchMs < settle ? Math.max(0.02, a.afterSwitchMs / settle) : 1;
    la -= Math.log10(Math.max(DF.hitChance(a.ms, sigma) * m, 1e-9));
  }
  rows.push({ k, name: att[k].name, score: la, ipm: c.actions.length / c.seconds * 60, min: c.seconds / 60, y: Math.log10(att[k].attempts), att: att[k].attempts });
}
const cf = path.join(OUT, "community.jsonl"), latest = {};
if (fs.existsSync(cf)) for (const ln of fs.readFileSync(cf, "utf8").split("\n")) { if (!ln.trim()) continue; try { const r = JSON.parse(ln); if (r.route && r.inputs) latest[r.id] = r; } catch (e) {} }
for (const r of Object.values(latest)) {
  const k = "c" + r.id;
  if (!att[k] || SKIP.has(k) || r.covers !== "100%") continue;
  // the user's rule: a route that skips a portal gives no number (tools/skips.js on the cached solve)
  try { const { readGdlvl } = require("./io.js"), SK = require("./skips.js");
    const L = readGdlvl(path.join(__dirname, "..", "local", "community", r.id + ".gdlvl")), sol = JSON.parse(fs.readFileSync(path.join(OUT, k + ".json"), "utf8"));
    if (SK.realSkips(SK.skipsOf(L.level.objects, L.level.header, sol.events)).length) { if (!args.includes("--json")) console.log(`  (left out: ${r.name}, its route skips a portal)`); continue; } } catch (e) {}
  rows.push({ k, name: r.name, score: r.score, ipm: r.inputs / r.secs * 60, min: r.secs / 60, y: Math.log10(att[k].attempts), att: att[k].attempts });
}

// least squares by normal equations (tiny: up to 4 terms)
function fit(X, y, ridge = 1e-6) {
  const p = X[0].length, A = Array.from({ length: p }, () => Array(p + 1).fill(0));
  for (let i = 0; i < X.length; i++) for (let a = 0; a < p; a++) { for (let b = 0; b < p; b++) A[a][b] += X[i][a] * X[i][b]; A[a][p] += X[i][a] * y[i]; }
  for (let a = 1; a < p; a++) A[a][a] += ridge;
  for (let c = 0; c < p; c++) { let m = c; for (let r = c + 1; r < p; r++) if (Math.abs(A[r][c]) > Math.abs(A[m][c])) m = r; [A[c], A[m]] = [A[m], A[c]];
    for (let r = 0; r < p; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let j = c; j <= p; j++) A[r][j] -= f * A[c][j]; } }
  return A.map((r, i) => r[p] / r[i]);
}
const pred = (w, x) => x.reduce((s, v, i) => s + v * w[i], 0);
function rank(v) { const o = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]), r = Array(v.length); o.forEach(([, i], j) => r[i] = j); return r; }
function spearman(a, b) { const ra = rank(a), rb = rank(b), n = a.length, ma = (n - 1) / 2; let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { num += (ra[i] - ma) * (rb[i] - ma); da += (ra[i] - ma) ** 2; db += (rb[i] - ma) ** 2; } return num / Math.sqrt(da * db); }
function evaluate(feat) {
  const X = rows.map(feat), y = rows.map(r => r.y), w = fit(X, y);
  const loo = rows.map((r, i) => pred(fit(X.filter((_, j) => j !== i), y.filter((_, j) => j !== i)), X[i]));
  const rmse = Math.sqrt(loo.reduce((s, p, i) => s + (p - y[i]) ** 2, 0) / y.length);
  return { w, loo, rmse, rho: spearman(loo, y) };
}
const models = {
  "score only": r => [1, r.score],
  "score + inputs/min + minutes": r => [1, r.score, r.ipm, r.min],
  "inputs/min + minutes (no score)": r => [1, r.ipm, r.min],
};
// THE RULE (Evgeni, 2026-11-26): "i wouldnt correlate attempts directly to difficulty. could fluke somewhere. and depends
// on my skill, how much i tried" -- but very few attempts means not hard, and barely passing means not easy. So his
// attempts are a loose BOUND, not a target: the default is the bounds check below; the fits only with --fit.
if (!args.includes("--fit")) {
  const sc = rows.map(r => r.score).sort((a, b) => a - b), q = p => sc[Math.min(sc.length - 1, Math.floor(p * sc.length))];
  const q1 = q(0.25), q3 = q(0.75);
  const out = rows.filter(r => (r.att <= 5 && r.score >= q3) || (r.att >= 500 && r.score <= q1));
  if (args.includes("--json")) { console.log(JSON.stringify({ n: rows.length, q1, q3, outliers: out })); return; }
  console.log(`${rows.length} levels the user beat; score quartiles ${q1.toFixed(2)} / ${q3.toFixed(2)}`);
  console.log(`bounds: <= 5 attempts but score in the top quarter, or 500+ attempts but score in the bottom quarter`);
  for (const r of out) console.log(`  ${r.name.padEnd(26)} ${String(r.att).padStart(5)} attempts, score ${r.score.toFixed(2)} -> ${r.att <= 5 ? "scored too hard?" : "scored too easy?"}`);
  if (!out.length) console.log("  none");
  return;
}
const res = {}; for (const [k, f] of Object.entries(models)) res[k] = evaluate(f);
if (args.includes("--json")) { console.log(JSON.stringify({ n: rows.length, rows, res })); return; }
console.log(`${rows.length} levels the user beat (${rows.filter(r => r.k[0] === "m").length} mains, ${rows.filter(r => r.k[0] === "c").length} community), sigma ${sigma}`);
for (const [k, r] of Object.entries(res)) console.log(`  ${k.padEnd(32)} leave-one-out rmse ${r.rmse.toFixed(2)} (log10 attempts), Spearman ${r.rho.toFixed(2)}; weights ${r.w.map(v => v.toFixed(3)).join(" ")}`);
const best = res["score + inputs/min + minutes"];
console.log("\n  level                       attempts  score  in/min  min   predicted (score only -> with density)");
rows.forEach((r, i) => console.log(`  ${r.name.slice(0, 26).padEnd(27)} ${String(r.att).padStart(6)}  ${r.score.toFixed(2).padStart(5)}  ${r.ipm.toFixed(0).padStart(5)}  ${r.min.toFixed(1).padStart(4)}   ${Math.round(10 ** res["score only"].loo[i])} -> ${Math.round(10 ** best.loo[i])}`));
