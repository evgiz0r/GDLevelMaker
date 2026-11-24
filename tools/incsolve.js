// node tools/incsolve.js profile <level.gdlvl>          -- where a full solve's time goes (sweep, natural plan, its
//                                                           solveFrom calls, humanCost calls, windows)
// node tools/incsolve.js study <level.gdlvl> [--edits N] [--seed S] [--no-full]
//                                                        -- random one-spot edits: incremental re-solve vs a full
//                                                           solve of the edited level (passes, humanCost, time);
//                                                           a row per edit to local/incsolve/study.jsonl
// node tools/incsolve.js cutjoin <level.gdlvl>          -- the level cut in the middle, and joined with a copy of
//                                                           itself: section cache vs full solve (same rows)
// Incremental solving (PHYSICS.md "Incremental solving"; the work is lib/incsolve.js).
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
const PH = require("../lib/physics.js"), DF = require("../lib/difficulty.js");
// count and time the expensive calls the natural plan makes (patched before lib/natural.js copies them)
const prof = {};
const wrap = (mod, name) => { const f = mod[name]; mod[name] = function () { const t = Date.now(); try { return f.apply(this, arguments); } finally {
  const p = prof[name] || (prof[name] = { n: 0, ms: 0 }); p.n++; p.ms += Date.now() - t; } }; };
wrap(PH, "solveFrom"); wrap(DF, "humanCost");
const { GD, readGdlvl } = require("./io.js");
Object.assign(GD, require("../lib/natural.js"), DF);
const WIN = require("../lib/windows.js");

function profile(file) {
  const L = readGdlvl(file), w = GD.makeWorld(L.level.objects, L.level.header), out = {};
  let t = Date.now();
  const r = GD.solveAny(w); out.solve = Date.now() - t;
  if (!r.ok) { console.log(file, "not beaten", r.why); return out; }
  for (const k in prof) delete prof[k];
  t = Date.now(); const n = GD.naturalPlan(w, r, L.level.objects, { cost: true }); out.natural = Date.now() - t;
  out.inNatural = JSON.parse(JSON.stringify(prof));
  const ev = n ? n.events : r.events;
  t = Date.now(); const p = GD.run(w, ev).path; WIN.inputWindows(w, ev, p, {}); out.windows = Date.now() - t;
  t = Date.now(); GD.run(w, ev); out.replay = Date.now() - t;
  console.log(file, JSON.stringify(out));
  return out;
}

const fs = require("fs"), path = require("path");
const I = require("../lib/incsolve.js").incsolve;

// the full pipeline as tools/solutions.js fromRun does it: solve, natural plan judged by humanCost
function full(level) {
  const w = GD.makeWorld(level.objects, level.header), t0 = Date.now();
  const r = GD.solveAny(w), ts = Date.now() - t0;
  if (!r.ok) return { ok: false, ms: Date.now() - t0, solveMs: ts, why: r.why };
  let events = r.events, kind = "limit";
  for (const k in prof) delete prof[k]; const tn = Date.now();
  try { const n = GD.naturalPlan(w, r, level.objects, { cost: true }); if (n && n.path[n.path.length - 1].done) { events = n.events; kind = "human"; } } catch (e) { /* raw route */ }
  const naturalMs = Date.now() - tn, inNatural = JSON.parse(JSON.stringify(prof));
  const cost = GD.humanCost(w, events).cost;
  const out = { ok: true, events, kind, cost, presses: events.filter(e => e.type === "press").length, ms: Date.now() - t0, solveMs: ts, naturalMs, inNatural };
  return Object.defineProperty(out, "w", { value: w });   // the world (its window cache is warm), not in the rows
}
// a base level with no saved route (a cloud session has no local/): solve it whole once and save it as make.js
// would (route, checkpoints, sections, window cache), so the next study / cutjoin of it starts from there
function solveBase(L, SOL) {
  console.log("  (no saved route that finishes: solving the base level whole first, then saving it)");
  const f = full(L.level); if (!f.ok) { console.log("  base level not beaten:", f.why); return null; }
  SOL.put(L.levelStr, { ok: true, events: f.events, kind: f.kind, plan: SOL.planCommit() }, L.level, f.w);
  return f;
}
// the incremental pipeline: diff against the old level and its route, re-solve the changed stretch, re-plan it
function incremental(oldLevel, oldEvents, level, opts) {
  opts = opts || {};
  const t0 = Date.now();
  const r = I.fromBase(oldLevel, oldEvents, level, { windowCache: opts.windowCache }), w = r.w || GD.makeWorld(level.objects, level.header), inf = r.inf;
  if (r.fallback) { if (opts.noFallback) return { ok: false, fallback: r.fallback, ms: Date.now() - t0 };
    const f = full(level); return Object.assign(f, { fallback: r.fallback, ms: Date.now() - t0 }); }
  const tr = Date.now() - t0;
  let events = r.events, kind = "limit";
  for (const k in prof) delete prof[k];
  if (r.reused) kind = "human";
  else try { const n = GD.naturalPlan(w, { ok: true, events }, level.objects, { cost: true, window: [r.from, r.to] });
    if (n && n.path[n.path.length - 1].done) { events = n.events; kind = "human"; } } catch (e) { /* spliced route as it is */ }
  const inNatural = JSON.parse(JSON.stringify(prof)), cost = GD.humanCost(w, events).cost;
  return { ok: true, events, kind, cost, presses: events.filter(e => e.type === "press").length, ms: Date.now() - t0, resolveMs: tr, inNatural,
    from: r.from, to: r.to, rejoined: r.rejoined, reused: r.reused, backoff: r.backoff, tries: r.tries, nojoin: r.nojoin, inf };
}

// a seeded random one-spot edit of a level: move a hazard/solid/orb a block, or delete one
function rng(seed) { let a = seed >>> 0 || 1; return () => { a ^= a << 13; a >>>= 0; a ^= a >> 17; a ^= a << 5; a >>>= 0; return a / 4294967296; }; }
function randomEdit(level, rand) {
  const xs = level.objects.map(o => o.x), lo = Math.min(...xs), hi = Math.max(...xs);
  const cand = level.objects.map((o, i) => ({ o, i, k: GD.objInfo(o.id).kind })).filter(c => /hazard|solid|orb|pad/.test(c.k) && c.o.x > lo + (hi - lo) * 0.2 && c.o.x < lo + (hi - lo) * 0.8);
  if (!cand.length) return null;
  const c = cand[Math.floor(rand() * cand.length)], objs = level.objects.slice(), kind = ["dx", "dy", "del"][Math.floor(rand() * 3)];
  if (kind === "del") objs.splice(c.i, 1);
  else { const o = Object.assign({}, c.o, { props: Object.assign({}, c.o.props) }), d = rand() < 0.5 ? -30 : 30;
    if (kind === "dx") { o.x += d; o.props["2"] = String(o.x); } else { o.y = Math.max(15, o.y + d); o.props["3"] = String(o.y); }
    objs[c.i] = o; }
  return { level: { header: level.header, objects: objs }, what: kind + " " + GD.objInfo(c.o.id).name + " at x " + c.o.x + " y " + c.o.y };
}

function study(file, opts) {
  const L = readGdlvl(file), SOL = require("./solutions.js");
  let base = SOL.get(L.levelStr, true), w = GD.makeWorld(L.level.objects, L.level.header);
  if (!base || !base.ok || !I.finishes(w, GD.run(w, base.events))) { console.log(file + ": the saved route does not finish here"); base = solveBase(L, SOL); if (!base) return; }
  const rand = rng(opts.seed || 1), out = path.join(__dirname, "..", "local", "incsolve"); fs.mkdirSync(out, { recursive: true });
  for (let k = 0; k < (opts.edits || 3); k++) {
    const e = randomEdit(L.level, rand); if (!e) break;
    const wc = require("./inc_store.js").loadWindowCache(SOL.keyOf(L.levelStr));
    const inc = incremental(L.level, base.events, e.level, { noFallback: opts.noFull, windowCache: wc });
    const fu = opts.noFull ? null : full(e.level);
    const row = { level: path.basename(file), edit: e.what, inc: { ok: inc.ok, cost: inc.cost, presses: inc.presses, ms: inc.ms, resolveMs: inc.resolveMs, inNatural: inc.inNatural, from: inc.from, to: inc.to, rejoined: inc.rejoined, reused: inc.reused, fallback: inc.fallback, kind: inc.kind, tries: inc.tries, nojoin: inc.nojoin },
      full: fu && { ok: fu.ok, cost: fu.cost, presses: fu.presses, ms: fu.ms, solveMs: fu.solveMs, naturalMs: fu.naturalMs, inNatural: fu.inNatural, kind: fu.kind }, at: new Date().toISOString() };
    fs.appendFileSync(path.join(out, "study.jsonl"), JSON.stringify(row) + "\n");
    console.log(JSON.stringify(row));
  }
}

// cut and join: the level cut after its middle section boundary, and the level followed by a copy of itself
// (moved by whole blocks), each solved with the section cache (seeded from the level's own route) and whole
function cutjoin(file) {
  const L = readGdlvl(file), SOL = require("./solutions.js"), ST = require("./inc_store.js");
  const w = GD.makeWorld(L.level.objects, L.level.header);
  let base = SOL.get(L.levelStr, true);
  if (!base || !base.ok || !I.finishes(w, GD.run(w, base.events))) { base = solveBase(L, SOL); if (!base) return; }
  const p = GD.run(w, base.events).path, store = ST.sections(), stamp = SOL.physicsCommit() + "/" + SOL.planCommit();
  I.cacheRoute(w, base.events, p, store, { stamp });
  const secs = I.sectionsOf(w, base.events, p), cutX = p[secs[Math.floor(secs.length / 2)].from].x + 150;
  const deco = o => GD.objInfo(o.id).kind === "decoration";
  const cut = { header: L.level.header, objects: L.level.objects.filter(o => o.x < cutX || deco(o)) };
  const xs = L.level.objects.map(o => o.x), dx = Math.ceil((Math.max(...xs) + 300) / 30) * 30;
  const join = { header: L.level.header, objects: L.level.objects.concat(L.level.objects.filter(o => !deco(o)).map(o => Object.assign({}, o, { x: o.x + dx, props: Object.assign({}, o.props, { 2: String(o.x + dx) }) }))) };
  const out = path.join(__dirname, "..", "local", "incsolve"); fs.mkdirSync(out, { recursive: true });
  for (const [what, lv] of [["cut at x " + Math.round(cutX), cut], ["joined with itself (+" + dx + ")", join]]) {
    const wl = GD.makeWorld(lv.objects, lv.header), t0 = Date.now();
    const c = I.solveWithCache(wl, store, { stamp });
    let cost = null, kind = "limit";
    if (c.ok) { let ev = c.events; try { const n = GD.naturalPlan(wl, { ok: true, events: ev }, lv.objects, { cost: true, window: c.seams.length ? [c.seams[0][0], Math.max(...c.seams.map(s => s[1] == null ? Infinity : s[1]))] : [0, -1] });
        if (n && n.path[n.path.length - 1].done) { ev = n.events; kind = "human"; } } catch (e) { /* as it is */ }
      c.events = ev; cost = GD.humanCost(wl, ev).cost; }
    const cms = Date.now() - t0, fu = full(lv);
    const row = { level: path.basename(file), edit: what, inc: { ok: c.ok, cost, ms: cms, reused: c.reused, seams: c.seams, why: c.why, kind }, full: { ok: fu.ok, cost: fu.cost, ms: fu.ms, kind: fu.kind }, at: new Date().toISOString() };
    fs.appendFileSync(path.join(out, "study.jsonl"), JSON.stringify(row) + "\n");
    console.log(JSON.stringify(row));
  }
}

module.exports = { cutjoin, profile, full, incremental, randomEdit, study, rng, prof };
if (require.main === module) {
  const [cmd, ...rest] = process.argv.slice(2);
  const arg = (n, d) => { const i = rest.indexOf(n); return i >= 0 ? +rest[i + 1] : d; };
  if (cmd === "profile") for (const f of rest) profile(f);
  else if (cmd === "cutjoin") for (const f of rest.filter(a => a.endsWith(".gdlvl"))) cutjoin(f);
  else if (cmd === "study") for (const f of rest.filter(a => a.endsWith(".gdlvl"))) study(f, { edits: arg("--edits", 3), seed: arg("--seed", 1), noFull: rest.includes("--no-full") });
  else console.log("usage: node tools/incsolve.js profile <level.gdlvl> ...");
}
