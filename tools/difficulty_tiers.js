// node tools/difficulty_tiers.js [measure] [fit]   -- tells Easy / Normal / Hard / Harder apart from a
// level's layout (lib/difficulty.js layout(): lead-in after portals, share of columns with a
// hazard, hazards per 10 blocks, section length, orbs/pads and rests per minute).
//   measure: layout of official levels 1-22 and every rated community level in local/community/
//            (list.json from tools/community.js), one child process per level (2.2 levels are huge)
//            -> local/difficulty/layout.json
//   fit:     least squares of the tier (Easy 1 .. Harder 4) on standardised features, over the
//            community levels from before 2.2 (2.2 ones move their gameplay with triggers, so their
//            static layout is not what a player meets) plus official 1-8; leave-one-out ranks and
//            accuracy; prints the weights to paste into lib/difficulty.js TIER_MODEL.
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const { GD, readGdlvl, unpack } = require("./io.js");
const DF = require("../lib/difficulty.js");
const { spearman, RATED } = require("./difficulty.js");
const OFFICIAL = process.env.GD_LEVELS || "C:/Program Files (x86)/Steam/steamapps/common/Geometry Dash/Resources/levels/";
const COMM = process.env.GD_COMMUNITY || path.join(__dirname, "..", "local", "community");
const OUT = path.join(__dirname, "..", "local", "difficulty", "layout.json");
const TIER = { Easy: 1, Normal: 2, Hard: 3, Harder: 4, Insane: 5, Demon: 6 };

function one(kind, id) {
  const w = kind === "official"
    ? (L => GD.makeWorld(L.objects, L.header))(GD.parseLevel(unpack(fs.readFileSync(path.join(OFFICIAL, id + ".txt"), "utf8"))))
    : (L => GD.makeWorld(L.level.objects, L.level.header))(readGdlvl(path.join(COMM, id + ".gdlvl")));
  return DF.layout(w);
}

function measure() {
  const rows = [];
  const run = (kind, id) => JSON.parse(execFileSync(process.execPath, ["--max-old-space-size=1500", __filename, "one", kind, String(id)], { windowsHide: true, encoding: "utf8", maxBuffer: 1 << 24 }));
  for (let n = 1; n <= 22; n++) rows.push(Object.assign({ id: "official " + n, name: RATED[n][0], tier: RATED[n][1], era: "official" }, run("official", n)));
  const list = fs.existsSync(path.join(COMM, "list.json")) ? JSON.parse(fs.readFileSync(path.join(COMM, "list.json"), "utf8")) : [];
  for (const l of list) {
    if (!fs.existsSync(path.join(COMM, l.id + ".gdlvl"))) continue;
    try { rows.push(Object.assign({ id: l.id, name: l.name, tier: l.tier, era: l.era }, run("community", l.id))); }
    catch (e) { console.error("skip", l.id, l.name, String(e.message).split("\n")[0]); }
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(rows, null, 1));
  console.log(rows.length, "levels ->", OUT);
}

const FEATURES = DF.TIER_FEATURES;
function solve(A, b) { // least squares via normal equations + Gaussian elimination (small)
  const n = A[0].length, M = Array.from({ length: n }, (_, i) => Array.from({ length: n + 1 }, (_, j) => j < n ? A.reduce((s, r) => s + r[i] * r[j], 0) + (i === j && i > 0 ? 1e-3 : 0) : A.reduce((s, r, k) => s + r[i] * b[k], 0)));
  for (let i = 0; i < n; i++) {
    let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
    [M[i], M[p]] = [M[p], M[i]];
    for (let r = 0; r < n; r++) if (r !== i) { const f = M[r][i] / M[i][i]; for (let c = i; c <= n; c++) M[r][c] -= f * M[i][c]; }
  }
  return M.map((r, i) => r[n] / r[i]);
}
function fitModel(rows) {
  const X = rows.map(r => FEATURES.map(([, f]) => f(r)));
  const mean = FEATURES.map((_, j) => X.reduce((s, x) => s + x[j], 0) / X.length);
  const sd = FEATURES.map((_, j) => Math.sqrt(X.reduce((s, x) => s + (x[j] - mean[j]) ** 2, 0) / X.length) || 1);
  const A = X.map(x => [1].concat(x.map((v, j) => (v - mean[j]) / sd[j])));
  const wts = solve(A, rows.map(r => TIER[r.tier]));
  return { mean, sd, w: wts };
}
const predict = (m, r) => DF.tierFromLayout(r, m);

function fit() {
  const all = JSON.parse(fs.readFileSync(OUT, "utf8"));
  const train = all.filter(r => (r.era === "official" && TIER[r.tier] <= 4) || (r.era !== "official" && r.era !== "2.2" && TIER[r.tier] <= 4));
  // leave-one-out
  const loo = train.map((r, i) => predict(fitModel(train.filter((_, j) => j !== i)), r));
  const truth = train.map(r => TIER[r.tier]);
  const round = v => Math.max(1, Math.min(4, Math.round(v)));
  const exact = loo.filter((v, i) => round(v) === truth[i]).length, near = loo.filter((v, i) => Math.abs(round(v) - truth[i]) <= 1).length;
  console.log(`train: ${train.length} levels (official 1-8 + community before 2.2), features: ${FEATURES.map(f => f[0]).join(", ")}`);
  console.log(`leave-one-out: Spearman ${spearman(loo, truth).toFixed(2)}, exact tier ${exact}/${train.length} (${Math.round(100 * exact / train.length)}%), within one ${near}/${train.length} (${Math.round(100 * near / train.length)}%)`);
  for (const t of ["Easy", "Normal", "Hard", "Harder"]) {
    const v = loo.filter((_, i) => train[i].tier === t).sort((a, b) => a - b);
    console.log(`  ${t.padEnd(7)} n=${String(v.length).padStart(2)}  predicted median ${v[v.length >> 1].toFixed(2)}  (q1 ${v[Math.floor(v.length / 4)].toFixed(2)}, q3 ${v[Math.floor(3 * v.length / 4)].toFixed(2)})`);
  }
  for (const f of FEATURES) console.log(`  alone: ${f[0].padEnd(16)} Spearman ${spearman(train.map(f[1]), truth).toFixed(2)}`);
  const m = fitModel(train);
  console.log("\nTIER_MODEL = " + JSON.stringify({ mean: m.mean.map(v => +v.toFixed(4)), sd: m.sd.map(v => +v.toFixed(4)), w: m.w.map(v => +v.toFixed(4)) }));
  const other = all.filter(r => !train.includes(r));
  console.log("\nnot in training (2.2 community, official 9-22): predicted tier");
  for (const r of other) console.log(`  ${String(r.id).padEnd(12)} ${String(r.name).slice(0, 24).padEnd(24)} rated ${r.tier.padEnd(7)} ${r.era.padEnd(8)} -> ${predict(m, r).toFixed(2)}`);
}

if (require.main === module) {
  const [step, a, b] = process.argv.slice(2);
  if (step === "one") { process.stdout.write(JSON.stringify(one(a, b))); return; }
  if (!step || step === "measure") measure();
  if (!step || step === "fit") fit();
}
