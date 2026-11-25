// node tools/balance.js <level.gdlvl | "GDLM NN" | official:N> [...] [--html out.html] [--json out.json]
//   How a level's difficulty score is built, input by input (DIFFICULTY.md "Balance: how the score is built").
//   The score is log10(expected attempts) = the sum over inputs of -log10 p; each input's cost splits into
//     lapse  (-log10(1 - LAPSE): the price of any press, a misread or a slip),
//     timing (-log10 erf(window/2 / (SIGMA*sqrt2)): a narrow window),
//     settle (-log10 of the after-portal factor: a press due under SETTLE ms after a portal switch).
//   GDLM levels: the saved route in viewer/levels.js (no solve; the windows are measured: ~2-10 min for a long level).
//   official:N : the inputs the last full report cached (local/difficulty/scored_NN.json; numbers only, seconds).
//   Prints the top spots and the cost per section (mode stretch); --html writes one page comparing every level given,
//   with the main levels' scores next to their stars (from local/difficulty/scored_*.json when there).
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
const fs = require("fs"), path = require("path"), vm = require("vm");
const R = path.join(__dirname, "..");
const DF = require("../lib/difficulty.js");
const D = DF.DIFF;
const SCORED = process.env.GDLM_SCORED_DIR || path.join(R, "local", "difficulty");
const RATED = {
  1: ["Stereo Madness", "Easy", 1], 2: ["Back On Track", "Easy", 2], 3: ["Polargeist", "Normal", 3],
  4: ["Dry Out", "Normal", 4], 5: ["Base After Base", "Hard", 5], 6: ["Cant Let Go", "Hard", 6],
  7: ["Jumper", "Harder", 7], 8: ["Time Machine", "Harder", 8], 9: ["Cycles", "Harder", 9],
  10: ["xStep", "Insane", 10], 11: ["Clutterfunk", "Insane", 11], 12: ["Theory of Everything", "Insane", 12],
  13: ["Electroman Adventures", "Insane", 10], 14: ["Clubstep", "Demon", 14], 15: ["Electrodynamix", "Insane", 12],
  16: ["Hexagon Force", "Insane", 12], 17: ["Blast Processing", "Harder", 10], 18: ["Theory of Everything 2", "Demon", 14],
  19: ["Geometrical Dominator", "Harder", 10], 20: ["Deadlocked", "Demon", 15], 21: ["Fingerdash", "Insane", 12],
  22: ["Dash", "Harder", 10],
}; // same table as tools/difficulty.js (kept here so this tool needs no RobTop data)

const TPS = 240;
const lg = x => -Math.log10(Math.max(x, 1e-9));
const erf = x => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };

// one input -> its cost and the three parts (they add up to -log10 p, as lib/difficulty.js scores it)
function costOf(a) {
  const settle = DF.settleOf(a);   // the after-portal factor, as lib/difficulty.js scores it
  const p = Math.max(DF.hitChance(a.ms) * settle, 1e-9);
  const lateOpen = DF.lateOpenOf(a), pOpen = Math.max(DF.hitChance(a.ms) * DF.settleOf(a, D.SETTLE, true), 1e-9);
  const lapse = lg(1 - D.LAPSE), timing = lg(erf(a.ms / 2 / (D.SIGMA * Math.SQRT2))), set = lg(settle);
  return { t: +(a.tick / TPS).toFixed(3), block: +(a.x / 30).toFixed(1), mode: a.mode, type: a.type, ms: Math.round(a.ms),
    afterSwitchMs: a.afterSwitchMs === undefined ? null : a.afterSwitchMs === null ? null : Math.round(a.afterSwitchMs),
    ...v2Of(a, lateOpen, lapse, timing, set),
    p: +p.toFixed(4), cost: +lg(p).toFixed(4), lateOpen, costIfOpenExempt: +lg(pOpen).toFixed(4), lapse: +lapse.toFixed(4), timing: +timing.toFixed(4), settle: +set.toFixed(4) };
}

// The v2 model (the user, 2026-11-25; DIFFICULTY.md "Balance"), next to the current one until it is fitted:
//  - flying modes: a press's own window is "almost fake" ("you could straight fly by tighter clicking"): it costs only the
//    slip; the flight is scored by how open it is, per second (lib/difficulty.js flyRoom);
//  - the after-portal cut only for a jumping press that cannot be made before the portal (its window opens after the switch)
//    and whose window really closes (not at the search limit).
const FLY = new Set(["ship", "ufo", "wave", "swing"]);
function v2Of(a, lateOpen, lapse, timing, set) {
  const dual = a.dual ? lg(1 - DUAL_PEN) : 0;
  if (FLY.has(a.mode)) return { v2: +(lapse + dual).toFixed(4), dual: +dual.toFixed(4) };
  const opensBefore = a.afterSwitchMs !== null && a.afterSwitchMs !== undefined && a.ms > a.afterSwitchMs + 1;
  const grav = a.upside || (a.sinceFlipMs !== null && a.sinceFlipMs !== undefined && a.sinceFlipMs < GRAV_RECENT_MS) ? lg(1 - GRAV_PEN) : 0;
  return { v2: +(lapse + timing + grav + dual + (opensBefore || lateOpen ? 0 : set)).toFixed(4), opensBefore, grav: +grav.toFixed(4), dual: +dual.toFixed(4) };
}

// Gravity play (the user, 2026-11-25: "gravity play should be counted as increased difficulty slightly somehow"): a jumping
// press made upside down, or within GRAV_RECENT_MS after a gravity flip (portal, orb or pad), costs a little more: its
// chance x (1 - GRAV_PEN). ASSUMED (0.01 a press, about the slip itself, x3 the slip cost), not fitted. Needs the run's path,
// so only where the level is here (our levels everywhere, the mains on the PC).
const GRAV_PEN = 0.01, GRAV_RECENT_MS = 1000;
// Dual (the user, 2026-11-25: "some people think hexagon force is harder than the demons because the two hard duals"):
// one button moves two players, so each press in a dual stretch is two things to get right. A press made while dual
// has its chance x (1 - DUAL_PEN), ASSUMED 0.05, flying presses too (they are cheap otherwise). Not fitted.
const DUAL_PEN = 0.05;
function gravOf(actions, path) {
  let lastFlip = -1e9;
  const flipAt = [];
  for (let t = 1; t < path.length; t++) if (path[t].grav !== path[t - 1].grav) flipAt.push(t);
  for (const a of actions) {
    const s = path[Math.min(a.tick, path.length - 1)];
    let f = -1e9; for (const t of flipAt) { if (t <= a.tick) f = t; else break; }
    a.upside = !!(s && s.grav < 0); a.dual = !!(s && s.p2); a.sinceFlipMs = f < 0 ? null : (a.tick - f) / TPS * 1000;
  }
  return flipAt.length;
}

// A lone hard press among easy ones (the user, 2026-11-25: "like jogging for 2 miles, and then having to jump 2 meters.
// yes its hard ... but it feels unfair"): a jumping press under SPIKE_MS whose neighbours within SPIKE_S seconds have a
// median window of SPIKE_CALM ms or more. A fairness flag (knowledge/checklist.md), not a score.
const SPIKE_MS = 60, SPIKE_S = 5, SPIKE_CALM = 150;
function spikes(inputs) {
  const J = inputs.filter(a => !FLY.has(a.mode));
  const out = [];
  for (const a of J) {
    if (a.ms >= SPIKE_MS) continue;
    const nb = J.filter(b => b !== a && Math.abs(b.t - a.t) <= SPIKE_S).map(b => b.ms).sort((x, y) => x - y);
    const med = nb.length ? nb[Math.floor(nb.length / 2)] : 999;
    if (med >= SPIKE_CALM) out.push({ t: a.t, block: a.block, mode: a.mode, ms: a.ms, calm: med, near: nb.length });
  }
  return out;
}

// a whole level: inputs -> totals, sections (mode stretches), top spots, the running total
function balance(name, actions, meta) {
  const inputs = actions.map(costOf);
  const sum = k => inputs.reduce((s, a) => s + a[k], 0);
  const total = sum("cost");
  const sections = [];
  for (const a of inputs) {
    const last = sections[sections.length - 1];
    if (last && last.mode === a.mode) { last.to = a.t; last.toBlock = a.block; last.inputs++; last.cost += a.cost; last.minMs = Math.min(last.minMs, a.ms); }
    else sections.push({ mode: a.mode, from: a.t, to: a.t, fromBlock: a.block, toBlock: a.block, inputs: 1, cost: a.cost, minMs: a.ms });
  }
  for (const s of sections) { s.cost = +s.cost.toFixed(3); s.share = +(s.cost / total).toFixed(3); }
  let run = 0;
  const curve = inputs.map(a => +(run += a.cost).toFixed(3));
  const top = inputs.map((a, i) => ({ i, ...a })).sort((x, y) => y.cost - x.cost).slice(0, 10)
    .map(a => ({ ...a, share: +(a.cost / total).toFixed(3) }));
  const bands = [[0, 30], [30, 60], [60, 100], [100, 200], [200, 1e9]].map(([lo, hi]) => {
    const g = inputs.filter(a => a.ms >= lo && a.ms < hi);
    return { lo, hi: hi > 1e8 ? null : hi, inputs: g.length, cost: +g.reduce((s, a) => s + a.cost, 0).toFixed(3) };
  });
  const { fly: _fly, ...metaOut } = meta;
  return { name, ...metaOut, score: +total.toFixed(3), attempts: Math.round(10 ** total), label: DF.difficultyLabel(total),
    // the open question in lib/difficulty.js settleOf: the score if late-open windows were not counted as forced
    ifOpenExempt: +sum("costIfOpenExempt").toFixed(3), openForced: inputs.filter(a => a.lateOpen && a.settle > 0).length,
    parts: { lapse: +sum("lapse").toFixed(3), timing: +sum("timing").toFixed(3), settle: +sum("settle").toFixed(3) },
    model: { SIGMA: D.SIGMA, LAPSE: D.LAPSE, SETTLE: D.SETTLE, FLY_SPREAD: DF.FLY_SPREAD, FLY_SIZE: DF.FLY_SIZE }, inputs, sections, top, bands, curve,
    v2: v2Total(inputs, meta.fly), spikes: spikes(inputs),
    flyRaw: meta.fly ? meta.fly.map(f => [f.t, f.mode, f.slack, f.n]) : null };   // [s, mode, slack units, samples]: for refitting FLY_SPREAD
}

function v2Total(inputs, fly) {
  const presses = inputs.reduce((s, a) => s + a.v2, 0), flyCost = fly ? fly.reduce((s, f) => s + f.cost, 0) : null;
  const worstFly = fly && fly.length ? fly.slice().sort((x, y) => y.cost - x.cost).slice(0, 5) : [];
  const grav = inputs.reduce((s, a) => s + (a.grav || 0), 0);
  const dual = inputs.reduce((s, a) => s + (a.dual || 0), 0);
  return { score: +(presses + (flyCost || 0)).toFixed(3), presses: +presses.toFixed(3), dual: +dual.toFixed(3), dualPresses: inputs.filter(a => a.dual > 0).length, grav: +grav.toFixed(3), gravPresses: inputs.filter(a => a.grav > 0).length, fly: flyCost === null ? null : +flyCost.toFixed(3),
    flySeconds: fly ? fly.length : null, worstFly, label: DF.difficultyLabel(presses + (flyCost || 0)) };
}

const LEVELS = process.env.GD_LEVELS || "C:/Program Files (x86)/Steam/steamapps/common/Geometry Dash/Resources/levels/";
function official(n) {
  const f = path.join(SCORED, `scored_${String(n).padStart(2, "0")}.json`);
  if (!fs.existsSync(f)) return null;
  const c = JSON.parse(fs.readFileSync(f, "utf8"));
  const [nm, face, stars] = RATED[n] || ["official " + n, "?", null];
  // the flight room needs the level and its route: only where RobTop's files are (the PC); else v2 has no flight part
  let fly;
  const lf = path.join(LEVELS, n + ".txt"), vf = path.join(R, "local", `official_${String(n).padStart(2, "0")}.json`);
  if (fs.existsSync(lf) && fs.existsSync(vf)) {
    const { GD, unpack } = require("./io.js"), L = GD.parseLevel(unpack(fs.readFileSync(lf, "utf8")));
    const w = GD.makeWorld(L.objects, L.header), v = JSON.parse(fs.readFileSync(vf, "utf8")).solution;
    if (v && v.events) { const pth = GD.run(w, v.events).path; fly = DF.flyRoom(w, pth); gravOf(c.actions, pth); }
  }
  return balance(nm, c.actions, { fly, kind: "official", n, rating: `${face} ${stars}`, stars, seconds: c.seconds, complete: c.complete, scoredAt: c.scoredAt, physics: c.physics });
}

function ours(arg) {
  const { GD, readGdlvl } = require("./io.js");
  const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(R, "viewer", "levels.js"), "utf8"), ctx);
  const want = arg.toLowerCase();
  const e = ctx.window.GD_LEVELS.find(e => e.file.toLowerCase().endsWith(path.basename(want)) || e.name.toLowerCase().startsWith(want));
  const file = e ? path.join(R, e.file) : arg;
  const Lv = readGdlvl(file), w = GD.makeWorld(Lv.level.objects, Lv.level.header);
  let sol = e && e.solution && e.solution.events ? e.solution : null;
  if (!sol) { const r = GD.solveAny(w); sol = r.ok ? r : { events: r.trail || [] }; }
  const d = DF.difficulty(w, sol, {});
  const runPath = GD.run(w, d.events).path, fly = DF.flyRoom(w, runPath), flips = gravOf(d.actions, runPath);
  const b = balance(Lv.name || (e && e.name), d.actions, { fly, flips, kind: "gdlm", file: path.relative(R, file).replace(/\\/g, "/"), seconds: d.seconds, complete: d.complete,
    rerouted: d.rerouted || [], chainExtra: d.chainExtra, worstChain: d.worstChain });
  if (Math.abs(b.score - d.logAttempts) > 0.01) console.error(`!! balance ${b.score} differs from difficulty ${d.logAttempts.toFixed(3)}`);
  return b;
}

function mains() {
  const out = [];
  for (const n of Object.keys(RATED).map(Number)) { const b = official(n); if (b) out.push({ n, name: b.name, rating: b.rating, stars: b.stars, score: b.score, ifOpenExempt: b.ifOpenExempt, v2: b.v2.score, v2fly: b.v2.fly, seconds: b.seconds, complete: b.complete, inputs: b.inputs.length }); }
  return out;
}

function print(b) {
  console.log(`== ${b.name}: score ${b.score.toFixed(2)} (~${b.attempts} attempts, ${b.label}) = lapse ${b.parts.lapse.toFixed(2)} + timing ${b.parts.timing.toFixed(2)} + after-portal ${b.parts.settle.toFixed(2)}; ${b.inputs.length} inputs in ${Math.round(b.seconds)} s`);
  if (b.openForced) console.log(`   ${b.openForced} after-portal press(es) have a window whose late end is the search limit; not counting them as forced: ${b.ifOpenExempt.toFixed(2)}`);
  console.log(`   v2 (flying by room, after-portal only when forced): ${b.v2.score.toFixed(2)} = presses ${b.v2.presses.toFixed(2)} (gravity ${b.v2.grav.toFixed(2)} over ${b.v2.gravPresses}, dual ${b.v2.dual.toFixed(2)} over ${b.v2.dualPresses}) + flight ${b.v2.fly === null ? "not measured (no level data here)" : b.v2.fly.toFixed(2) + " over " + b.v2.flySeconds + " s"}`);
  for (const f of b.v2.worstFly.slice(0, 3)) console.log(`     flight ${f.t} s ${f.mode} block ${Math.round(f.x / 30)}: ${f.slack} units of slack, p=${f.p.toFixed(2)}`);
  for (const k of b.spikes) console.log(`   SPIKE ${k.t.toFixed(1)} s block ${Math.round(k.block)} ${k.mode}: ${k.ms} ms among presses of ~${k.calm} ms (unfair: a lone hard press)`);
  console.log("   top spots:");
  for (const a of b.top.slice(0, 6)) console.log(`     ${a.t.toFixed(1).padStart(6)} s  block ${String(Math.round(a.block)).padStart(4)}  ${a.mode.padEnd(6)} ${a.type.padEnd(7)} window ${String(a.ms).padStart(3)} ms${a.afterSwitchMs !== null && a.settle > 0 ? `, ${a.afterSwitchMs} ms after a portal` : ""}  p=${a.p.toFixed(2)}  cost ${a.cost.toFixed(2)} (${Math.round(a.share * 100)}%)`);
  console.log("   sections:");
  for (const s of b.sections) console.log(`     ${s.from.toFixed(1).padStart(6)}-${s.to.toFixed(1).padEnd(6)} s ${s.mode.padEnd(6)} ${String(s.inputs).padStart(3)} inputs  cost ${s.cost.toFixed(2)} (${Math.round(s.share * 100)}%)  tightest ${s.minMs} ms`);
}

function main() {
  const args = process.argv.slice(2);
  const take = k => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : null; };
  const html = take("--html"), json = take("--json");
  const levels = args.map(a => /^official:\d+$/.test(a) ? official(+a.split(":")[1]) : ours(a)).filter(Boolean);
  for (const b of levels) print(b);
  const data = { made: new Date().toISOString(), levels, mains: mains() };
  const out = path.join(R, "local", "balance"); fs.mkdirSync(out, { recursive: true });
  for (const b of levels) fs.writeFileSync(path.join(out, (b.n ? "official_" + b.n : b.name).replace(/[^\w]+/g, "_").toLowerCase() + ".json"), JSON.stringify(b));
  if (json) fs.writeFileSync(json, JSON.stringify(data));
  if (html) {
    const tpl = fs.readFileSync(path.join(R, "viewer", "balance.html"), "utf8");
    fs.writeFileSync(html, tpl.replace("/*BALANCE_DATA*/null", JSON.stringify(data)));
    console.log("page:", html);
  }
}

if (require.main === module) main();
module.exports = { balance, costOf, official, mains };
