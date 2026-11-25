// node tools/difficulty.js [n ...] [--sigma 30]       -- scores the official levels and compares
//   with their in-game ratings. Needs their solutions in local/difficulty/ (make them with
//   `node tools/difficulty_solve.js n`, ONE AT A TIME: a solve takes ~800 MB).
// node tools/difficulty.js --cached [--sigma S] [--settle MS]  -- the same comparison from the inputs the last
//   full report cached (local/difficulty/scored_NN.json), with another chance model: seconds, not an hour
// node tools/difficulty.js some.gdlvl [...]             -- scores your own levels (solves them first).
// node tools/difficulty.js c<id> [...] [--stars 10]     -- scores a community level from its cached solve
//   (difficulty_solve.js c<id>) on the mains' basis (human route); -> local/difficulty/community.jsonl + measurements.
// Levels the sim cannot finish are scored on the part it gets through ("per minute" compares them).
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
const fs = require("fs"), path = require("path");
const { GD, unpack, readGdlvl } = require("./io.js");
const SK = require("./skips.js");
const DF = require("../lib/difficulty.js");
const SRC = process.env.GD_LEVELS || "C:/Program Files (x86)/Steam/steamapps/common/Geometry Dash/Resources/levels/";
const OUT = path.join(__dirname, "..", "local", "difficulty");

// In-game ratings of the official levels (GD 2.2): face and stars. From memory of the game's
// level list -- check against the user's game if one looks off.
const RATED = {
  1: ["Stereo Madness", "Easy", 1], 2: ["Back On Track", "Easy", 2], 3: ["Polargeist", "Normal", 3],
  4: ["Dry Out", "Normal", 4], 5: ["Base After Base", "Hard", 5], 6: ["Cant Let Go", "Hard", 6],
  7: ["Jumper", "Harder", 7], 8: ["Time Machine", "Harder", 8], 9: ["Cycles", "Harder", 9],
  10: ["xStep", "Insane", 10], 11: ["Clutterfunk", "Insane", 11], 12: ["Theory of Everything", "Insane", 12],
  13: ["Electroman Adventures", "Insane", 10], 14: ["Clubstep", "Demon", 14], 15: ["Electrodynamix", "Insane", 12],
  16: ["Hexagon Force", "Insane", 12], 17: ["Blast Processing", "Harder", 10], 18: ["Theory of Everything 2", "Demon", 14],
  19: ["Geometrical Dominator", "Harder", 10], 20: ["Deadlocked", "Demon", 15], 21: ["Fingerdash", "Insane", 12],
  22: ["Dash", "Harder", 10],
};

function spearman(a, b) {
  const rank = v => { const idx = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]); const r = new Array(v.length);
    for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2; i = j + 1; } return r; };
  const ra = rank(a), rb = rank(b), n = a.length, ma = ra.reduce((s, x) => s + x, 0) / n, mb = rb.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { num += (ra[i] - ma) * (rb[i] - mb); da += (ra[i] - ma) ** 2; db += (rb[i] - mb) ** 2; }
  return num / Math.sqrt(da * db);
}

const f1 = x => x === null || x === undefined ? "-" : x.toFixed(1);
const f0 = x => x === null || x === undefined ? "-" : x.toFixed(0);

function scoreOfficial(n, sigma) {
  const file = path.join(OUT, String(n).padStart(2, "0") + ".json");
  if (!fs.existsSync(file)) return null;
  const sol = JSON.parse(fs.readFileSync(file, "utf8"));
  const levelStr = unpack(fs.readFileSync(path.join(SRC, n + ".txt"), "utf8")), L = GD.parseLevel(levelStr);
  const w = GD.makeWorld(L.objects, L.header);
  // score the route the viewer shows: since main fd26076 that is the human route (difficulty_solve.js toViewer:
  // lib/natural.js + humanCost, PHYSICS.md "How the route is chosen"), so it is scored as it is -- no humanize,
  // no route choice of our own (humanCost already chose) -- and never written back over
  const vf = path.join(OUT, "..", `official_${String(n).padStart(2, "0")}.json`);
  const viewer = fs.existsSync(vf) ? JSON.parse(fs.readFileSync(vf, "utf8")).solution : null;
  const human = viewer && viewer.events && viewer.kind;
  const d = human ? DF.difficulty(w, { ok: viewer.ok !== false, events: viewer.events }, { sigma, raw: true, route: false })
    : DF.difficulty(w, sol, { sigma });
  // an older viewer file (no route kind): the scored route, rerouted where a tight input had an easier way
  // (lib/difficulty.js easierRoute), goes into local/official_NN.json as before
  if (!human && d.rerouted.length && fs.existsSync(vf)) {
    const v = JSON.parse(fs.readFileSync(vf, "utf8"));
    v.solution = Object.assign({}, v.solution, { events: d.events, rerouted: d.rerouted });
    fs.writeFileSync(vf, JSON.stringify(v));
  }
  // cache what was scored (local/difficulty/scored_NN.json), so a change to the chance model (SIGMA,
  // LAPSE, SETTLE) can be re-checked without re-measuring windows: node tools/difficulty.js --cached
  fs.writeFileSync(path.join(OUT, `scored_${String(n).padStart(2, "0")}.json`), JSON.stringify({
    n, physics: sol.physics || null, route: human ? "human (viewer)" : "solver + humanize", scoredAt: new Date().toISOString(), seconds: d.seconds, complete: d.complete, blocks: d.blocks,
    actions: d.actions.map(a => ({ tick: a.tick, type: a.type, ms: a.ms, x: Math.round(a.x), mode: a.mode, afterSwitchMs: a.afterSwitchMs })) }));
  // into the measurements store (tools/measures.js), stamped with the physics the scored route was solved on
  require("./measures.js").record({ level: "official:" + n, name: RATED[n] ? RATED[n][0] : null, levelStr,
    measure: "difficulty", value: +d.logAttempts.toFixed(3), unit: "log10 attempts", stamps: { physics: sol.physics || null },
    detail: { perMin: +d.perMinute.toFixed(3), inputs: d.inputs, tight: d.tight, minMs: d.tightest != null ? Math.round(d.tightest) : null,
      complete: !!d.complete, coverBlocks: d.blocks != null ? Math.round(d.blocks) : null, route: human ? "human" : "solver + humanize" } });
  return Object.assign(d, { n, sol, levelBlocks: w.endX / 30 });
}

// a downloaded community level solved by `difficulty_solve.js c<id>` (local/difficulty/c<id>.json), scored on the same
// basis as the mains: the human route (lib/natural.js naturalPlan with humanCost, tap length for the level's stars, 10 min
// budget), else the solver's route humanized. Nothing goes to the viewer (other people's levels); the number goes to
// local/difficulty/community.jsonl and the measurements store. Built 2026-11-25 (DIFFICULTY.md "Community demons").
function scoreCommunity(c, sigma) {
  const file = path.join(OUT, c + ".json");
  if (!fs.existsSync(file)) { console.log(`${c}: no solution cached, run: node tools/difficulty_solve.js ${c}`); return null; }
  const sol = JSON.parse(fs.readFileSync(file, "utf8"));
  const L = readGdlvl(path.join(__dirname, "..", "local", "community", c.slice(1) + ".gdlvl")), w = GD.makeWorld(L.level.objects, L.level.header);
  const si = process.argv.indexOf("--stars"), stars = si >= 0 ? +process.argv[si + 1] : 10;
  let events = null;
  try { const p = require("../lib/natural.js").naturalPlan(w, { ok: sol.ok, events: sol.events }, L.level.objects, { cost: true, stars, budgetMs: 10 * 60e3 });
    if (p && (sol.ok ? p.path[p.path.length - 1].done : true)) events = p.events; } catch (e) {}
  const route = events ? "human" : "solver + humanize";
  const d = events ? DF.difficulty(w, { ok: sol.ok !== false, events }, { sigma, raw: true, route: false }) : DF.difficulty(w, sol, { sigma });
  const ms = d.actions.map(a => a.ms);
  console.log(`== ${L.name} (${c}): ${d.complete ? "" : "PARTIAL (sim stops at block " + f1(d.blocks) + " of " + f1(w.endX / 30) + "), "}score ${d.logAttempts.toFixed(2)} (~${Math.round(10 ** d.logAttempts)} attempts, ${DF.difficultyLabel(d.logAttempts)}), /min ${d.perMinute.toFixed(2)}; route ${route}`);
  console.log(`   ${d.inputs} inputs in ${f1(d.seconds)} s, tightest ${f0(d.tightest)} ms, median ${f0(d.medianMs)} ms, ${d.tight} under ${DF.DIFF.TIGHT} ms, under 100 ms ${ms.filter(m => m < 100).length}, longest tight streak ${d.streak}, busiest 5 s ${f1(d.peak5s)}/s`);
  for (const a of d.actions.slice().sort((p, q) => p.ms - q.ms).slice(0, 5))
    console.log(`     tight: ${(a.tick / 240).toFixed(2)} s  block ${f1(a.x / 30)} (${(100 * a.x / w.endX).toFixed(0)}%)  ${a.type.padEnd(7)} ${a.mode.padEnd(6)} window ${f0(a.ms)} ms`);
  const row = { id: c.slice(1), name: L.name, stars, covers: Math.round(100 * d.blocks / (w.endX / 30)) + "%", secs: Math.round(d.seconds), inputs: d.inputs,
    tight: d.tight, minMs: Math.round(d.tightest || 0), score: +d.logAttempts.toFixed(2), perMin: +d.perMinute.toFixed(2), route, physics: sol.physics || null, at: new Date().toISOString() };
  fs.appendFileSync(path.join(OUT, "community.jsonl"), JSON.stringify(row) + "\n");
  require("./measures.js").record({ level: "community:" + c.slice(1), name: L.name, levelStr: L.levelStr,
    measure: "difficulty", value: +d.logAttempts.toFixed(3), unit: "log10 attempts", stamps: { physics: sol.physics || null },
    detail: { perMin: +d.perMinute.toFixed(3), inputs: d.inputs, tight: d.tight, minMs: d.tightest != null ? Math.round(d.tightest) : null,
      complete: !!d.complete, coverBlocks: d.blocks != null ? Math.round(d.blocks) : null, route } });
  return d;
}

function main() {
  const args = process.argv.slice(2);
  const si = args.indexOf("--sigma"), sigma = si >= 0 ? +args.splice(si, 2)[1] : DF.DIFF.SIGMA;
  if (args.includes("--cached")) { // re-score the cached inputs with the current chance model, in seconds
    const sti = args.indexOf("--settle"), settle = sti >= 0 ? +args[sti + 1] : DF.DIFF.SETTLE;
    const uf = path.join(OUT, "user_stats.json"), user = fs.existsSync(uf) ? JSON.parse(fs.readFileSync(uf, "utf8")) : null;
    const rows = [];
    for (const n of Object.keys(RATED).map(Number)) {
      const f = path.join(OUT, `scored_${String(n).padStart(2, "0")}.json`);
      if (!fs.existsSync(f)) continue;
      const c = JSON.parse(fs.readFileSync(f, "utf8"));
      let la = 0;
      for (const a of c.actions) {
        const k = a.afterSwitchMs !== null && a.afterSwitchMs !== undefined && a.afterSwitchMs < settle ? Math.max(0.02, a.afterSwitchMs / settle) : 1;
        la -= Math.log10(Math.max(DF.hitChance(a.ms, sigma) * k, 1e-9));
      }
      // the user's rule (2026-11-23): a route that skips a portal is a physics bug, never a number
      const sk = SK.official(n), skips = sk ? SK.realSkips(sk).length : 0, stale = sk && c.complete && !sk.complete;
      rows.push({ n, la, pm: la / Math.max(c.seconds, 1e-9) * 60, cover: c.blocks, complete: c.complete, att: user && user[n] ? user[n].attempts : null, skips, stale });
      console.log(`${String(n).padStart(3)} ${RATED[n][0].padEnd(23)} ${(RATED[n][1] + " " + RATED[n][2]).padEnd(10)} ` +
        (skips ? `route SKIPS ${skips} portal(s): no number (tools/skips.js ${n})` : `score ${la.toFixed(2)}  /min ${(la / Math.max(c.seconds, 1e-9) * 60).toFixed(2)}`) +
        (stale ? "  (the saved route no longer finishes on today's physics)" : ""));
    }
    const ok = rows.filter(r => r.n !== 21 && !r.skips);
    console.log(`sigma ${sigma}, settle ${settle} ms. Spearman over ${ok.length} (Fingerdash and skipping routes out): per minute vs stars ${spearman(ok.map(r => r.pm), ok.map(r => RATED[r.n][2])).toFixed(2)}, score vs stars ${spearman(ok.map(r => r.la), ok.map(r => RATED[r.n][2])).toFixed(2)}` +
      (ok.every(r => r.att) ? `, per minute vs your attempts ${spearman(ok.map(r => r.pm), ok.map(r => r.att)).toFixed(2)}` : ""));
    return;
  }
  const files = args.filter(a => a.endsWith(".gdlvl"));
  if (files.length) {
    for (const f of files) {
      const L = readGdlvl(f), w = GD.makeWorld(L.level.objects, L.level.header);
      const r = GD.solveAny(w);
      const d = DF.difficulty(w, r.ok ? r : { events: r.trail || [] }, { sigma });
      console.log(`== ${L.name}: ${d.complete ? "" : "PARTIAL (sim stops at block " + f1(d.blocks) + "), "}score ${d.logAttempts.toFixed(2)} (~${Math.round(10 ** d.logAttempts)} attempts, ${DF.difficultyLabel(d.logAttempts)}); practice mode: ~${f0(d.practiceDeaths)} deaths`);
      console.log(`   ${d.inputs} inputs in ${f1(d.seconds)} s, tightest ${f0(d.tightest)} ms, median ${f0(d.medianMs)} ms, ${d.tight} under ${DF.DIFF.TIGHT} ms, longest tight streak ${d.streak}, busiest 5 s ${f1(d.peak5s)}/s`);
      for (const r of d.rerouted) console.log(`   easier route at block ${f1(r.x / 30)}: the ${f0(r.was)} ms input -> ${r.why} (-${r.gain} log10 attempts)`);
      for (const a of d.actions) console.log(`     ${(a.tick / 240).toFixed(2)} s  block ${f1(a.x / 30)}  ${a.type.padEnd(7)} ${a.mode.padEnd(4)} window ${f0(a.ms)}${a.open ? "+" : ""} ms  p=${a.p.toFixed(2)}`);
    }
    return;
  }
  const comm = args.filter(a => /^c\d+$/.test(a));
  if (comm.length) { for (const c of comm) scoreCommunity(c, sigma); return; }
  const ns = args.length ? args.map(Number) : Object.keys(RATED).map(Number);
  const rows = [];
  for (const n of ns) {
    const t0 = Date.now(), d = scoreOfficial(n, sigma);
    if (!d) { console.log(`${n}: no solution cached, run: node tools/difficulty_solve.js ${n}`); continue; }
    d.secsTaken = (Date.now() - t0) / 1000;
    rows.push(d);
    for (const r of d.rerouted) console.log(`  ${n}: easier route at block ${f1(r.x / 30)}: the ${f0(r.was)} ms input -> ${r.why} (-${r.gain} log10 attempts)`);
  }
  // the player's own lifetime attempts per level (node tools/save_stats.js), when there
  const uf = path.join(OUT, "user_stats.json"), user = fs.existsSync(uf) ? JSON.parse(fs.readFileSync(uf, "utf8")) : null;
  console.log(`sigma ${sigma} ms, lapse ${DF.DIFF.LAPSE * 100}%. score = log10(expected attempts) over the part the sim gets through.`);
  console.log("  # level                   rating      sim covers        inputs  /s  tight streak  min ms  med ms  score  /min  ship gap  hiding  yours");
  for (const d of rows) {
    const [name, face, stars] = RATED[d.n];
    const cover = `${Math.round(100 * d.blocks / d.levelBlocks)}%${d.complete ? "" : " " + (d.sol.why || "")}`.slice(0, 17);
    console.log(`${String(d.n).padStart(3)} ${name.padEnd(23)} ${(face + " " + stars).padEnd(11)} ${cover.padEnd(17)} ${String(d.inputs).padStart(6)} ${f1(d.perSecond).padStart(3)} ${String(d.tight).padStart(5)} ${String(d.streak).padStart(6)} ${f0(d.tightest).padStart(7)} ${f0(d.medianMs).padStart(7)} ${d.logAttempts.toFixed(2).padStart(6)} ${d.perMinute.toFixed(2).padStart(5)} ${(d.shipGap ? f0(d.shipGap.min) + "/" + f0(d.shipGap.median) : "-").padStart(9)} ${String(d.hiddenTriggers).padStart(7)} ${String(user && user[d.n] ? user[d.n].attempts : "-").padStart(6)}`);
  }
  const full = rows.filter(d => d.blocks / d.levelBlocks >= 0.1); // under 10% the sim died on something it lacks
  if (rows.length >= 4) {
    const st = rows.map(d => RATED[d.n][2]);
    console.log(`\nSpearman vs stars, all ${rows.length}: score ${spearman(rows.map(d => d.logAttempts), st).toFixed(2)}, per minute ${spearman(rows.map(d => d.perMinute), st).toFixed(2)}, tightest(-) ${spearman(rows.map(d => -(d.tightest || 999)), st).toFixed(2)}, inputs/s ${spearman(rows.map(d => d.perSecond), st).toFixed(2)}`);
    if (full.length >= 4) { const sf = full.map(d => RATED[d.n][2]);
      console.log(`Spearman vs stars, the ${full.length} the sim covers at least 10% of: score ${spearman(full.map(d => d.logAttempts), sf).toFixed(2)}, per minute ${spearman(full.map(d => d.perMinute), sf).toFixed(2)}`);
      const fu = user ? full.filter(d => user[d.n]) : [];
      if (fu.length >= 4) { const ua = fu.map(d => user[d.n].attempts);
        console.log(`Spearman vs YOUR attempts, the same ${fu.length}: score ${spearman(fu.map(d => d.logAttempts), ua).toFixed(2)}, per minute ${spearman(fu.map(d => d.perMinute), ua).toFixed(2)}; stars vs your attempts ${spearman(fu.map(d => RATED[d.n][2]), ua).toFixed(2)}`); } }
  }
}

if (require.main === module) main();
module.exports = { RATED, spearman, scoreOfficial };
