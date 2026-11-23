// node tools/solutions.js [--all | <level.gdlvl> ...] [--fresh | --windows]  -- solve levels ONCE, on the PC, and keep the answer
//   --fresh: solve again from scratch (the sweep's current route ranking: off the walls, then fewest presses)
//   instead of re-planning the saved inputs
//
// The viewer and the phone page replay a saved solution instead of solving in the browser (a 60 s
// level with modes takes minutes to solve; on the phone the page looked hung). A solution is
// {ok, events} -- lib/natural.js's natural replay when it works -- cached by the level's content in
// local/solutions/<hash>.json (shared folder). tools/index_levels.js puts the cached solution of
// each repo level into viewer/levels.js; tools/make.js and tools/wip.js save one whenever they solve.
// Each carries `physics` (the commit of lib/physics.js / lib/objects*.js it was solved on): after a
// physics change, get() treats older ones as stale and they are solved again.
// --all: solve every repo level that has none yet (one at a time; heavy levels take minutes).
// Each also carries `plan` (the last commit of lib/natural.js or lib/difficulty.js: the route planner and its humanCost judge). When only the plan is older, or the physics
// is older but the saved inputs still finish the level, solve() re-plans from them (a few seconds)
// instead of solving again; --all does that for every repo level.
// Each beaten one also carries `windows` -- every input's timing window (lib/windows.js, a player's window):
// [[0 press / 1 release, tick, lo, hi, tap's release index or -1], ...], stamped `win` with the commit of
// lib/windows.js + lib/difficulty.js. The viewer and the phone show them at once instead of measuring them
// on every open (seconds on the PC, longer on the phone: "it resolves every time I select a level?", the
// user, 2026-11-23). --windows: add or refresh only the windows of saved solutions (no re-solving).
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const { GD, readGdlvl } = require("./io.js");
Object.assign(GD, require("../lib/natural.js"), require("../lib/difficulty.js"));
const WIN = require("../lib/windows.js");
const DIR = path.join(__dirname, "..", "local", "solutions");

const keyOf = levelStr => crypto.createHash("sha1").update(levelStr).digest("hex").slice(0, 16);
// the physics a solution was solved on: the last commit that changed lib/physics.js or lib/objects*.js
// (as tools/difficulty_solve.js stamps the official answers). A cached solution from other physics is
// stale: get() returns null for it, so it is solved again.
let PHYS = null;
function physicsCommit() {
  if (PHYS === null) {
    try { PHYS = require("child_process").execSync("git log -1 --format=%h -- lib/physics.js lib/dual.js lib/objects.js lib/objects_extra.js lib/objects_gd22.js", { windowsHide: true, cwd: path.join(__dirname, ".."), encoding: "utf8" }).trim(); } catch (e) { PHYS = ""; }
  }
  return PHYS;
}
let PLAN = null;
function planCommit() {
  if (PLAN === null) {
    try { PLAN = require("child_process").execSync("git log -1 --format=%h -- lib/natural.js lib/difficulty.js", { windowsHide: true, cwd: path.join(__dirname, ".."), encoding: "utf8" }).trim(); } catch (e) { PLAN = ""; }
  }
  return PLAN;
}
let WINC = null;
function windowsCommit() {
  if (WINC === null) {
    try { WINC = require("child_process").execSync("git log -1 --format=%h -- lib/windows.js lib/difficulty.js", { windowsHide: true, cwd: path.join(__dirname, ".."), encoding: "utf8" }).trim(); } catch (e) { WINC = ""; }
  }
  return WINC;
}
// every input's window of a beaten solution, measured now (seconds to a minute: a heavy job's work)
function measureWindows(level, sol, wIn) {
  if (!sol || !sol.ok || !sol.events || !sol.events.length) return sol;
  // wIn: the world the natural plan costed its routes on (its window cache is warm: the windows are already there)
  const w = wIn || GD.makeWorld(level.objects, level.header), ev = sol.events.slice().sort((a, b) => a.tick - b.tick);
  const path0 = GD.run(w, ev).path;
  sol.windows = WIN.inputWindows(w, ev, path0, {}).map(x => [x.type === "release" ? 1 : 0, x.tick, x.lo, x.hi, x.j]);
  sol.win = windowsCommit();
  return sol;
}
const windowsFresh = s => !!s && (!s.ok || (Array.isArray(s.windows) && (!windowsCommit() || s.win === windowsCommit())));
const fresh = s => !!s && (!s.physics || !physicsCommit() || s.physics === physicsCommit()) && (!planCommit() || s.plan === planCommit());
function get(levelStr, any) {
  let s;
  try { s = JSON.parse(fs.readFileSync(path.join(DIR, keyOf(levelStr) + ".json"), "utf8")); } catch (e) { return null; }
  if (!any && s.physics && physicsCommit() && s.physics !== physicsCommit()) return null; // stale
  return s;
}
function put(levelStr, sol, level, w) {
  // the plan stamp says which lib/natural.js made this route: only fromRun (which runs the natural plan) sets
  // it; a copied route keeps its own, so it shows up stale and is re-planned (make.js --look once copied an
  // old one-long-hold route and stamped it current: GDLM 45 wip v8, 2026-11-23)
  sol.physics = physicsCommit(); if (sol.plan === undefined) sol.plan = null; sol.solvedAt = new Date().toISOString();
  if (level) { try { measureWindows(level, sol, w); } catch (e) { delete sol.windows; } }
  // the window cache of that world goes along (local/solutions/wc/), so a later edit of this level starts warm
  if (w && GD.exportWindowCache) try { require("./inc_store.js").saveWindowCache(keyOf(levelStr), GD.exportWindowCache(w)); } catch (e) { /* a cache */ }
  if (level) incSave(levelStr, sol, level);
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, keyOf(levelStr) + ".json"), JSON.stringify(sol));
  return sol;
}
// incremental solving (PHYSICS.md "Incremental solving"): a beaten route keeps checkpoints (its exact state about
// every second, ~10-30 KB), its level is kept by hash (local/solutions/lv/) and its sections go into the section
// cache, so an edit, a cut or a join of this level later re-solves only what changed (tools/incsolve.js)
function incSave(levelStr, sol, level) {
  try {
    const INC = require("../lib/incsolve.js").incsolve, ST = require("./inc_store.js");
    ST.saveLevel(keyOf(levelStr), levelStr, sol.name);
    if (!sol.ok || !sol.events || !sol.events.length) return;
    const w = GD.makeWorld(level.objects, level.header), p = GD.run(w, sol.events).path;
    sol.checkpoints = INC.checkpoints(w, sol.events, p);
    if (INC.finishes(w, { done: p[p.length - 1].done, end: p[p.length - 1] })) INC.cacheRoute(w, sol.events, p, ST.sections(), { stamp: physicsCommit() + "/" + planCommit() });
  } catch (e) { delete sol.checkpoints; }
}
// from a solver result already in hand (make.js has one): natural plan, saved
function fromRun(level, levelStr, r) {
  const w = GD.makeWorld(level.objects, level.header);
  // an incremental re-solve hands its world (r.world): its timing windows carry over to this one (make.js adds
  // jump indicators after the check, decoration that changes no window)
  if (r && r.world) try { const INC = require("../lib/incsolve.js").incsolve, d = INC.diffObjects(r.world.objects, level.objects);
    INC.carryWindows(r.world, w, INC.influence(r.world, w, d, level.header, level.header), d); } catch (e) { /* cold */ }
  let sol;
  // THE DEFAULT (the user, 2026-11-23: "let's by default solve with the human route, then in the limits we
  // will see"): every saved route is the human route -- lib/natural.js with humanCost (no skips, no unneeded
  // presses, short taps, holds only where the mode needs them, early in each window, flying the safe line).
  // kind "human"; "limit" when no human route finishes (the raw solver route is kept, with why);
  // "unbeaten" when the solver itself is stuck.
  if (r && r.ok) {
    let events = r.events, kind = "limit", why = "the natural plan could not finish the level: the solver's raw route";
    // an incremental re-solve (r.inc, lib/incsolve.js): the route outside [from, to] is already the old natural
    // route, so only that window is planned again
    const win = r.inc && !r.inc.reused && r.inc.from != null ? [r.inc.from, r.inc.to] : null;
    try { const n = r.inc && r.inc.reused ? { events: r.events, path: GD.run(w, r.events).path } : GD.naturalPlan(w, r, level.objects, win ? { cost: true, window: win } : { cost: true });
      if (n && n.path[n.path.length - 1].done) { events = n.events; kind = "human"; why = undefined; } } catch (e) { why = "natural plan failed: " + e.message; }
    sol = { ok: true, events, kind, why, plan: planCommit() };
  } else sol = { ok: false, kind: "unbeaten", events: (r && r.trail) || [], dieX: r && r.dieAt && r.dieAt.x, why: r && r.why, skipped: r && r.skipped, plan: planCommit() };
  return put(levelStr, sol, level, w);
}
// a saved solution's windows, measured and saved when missing or from older window code (no re-solving)
function withWindows(level, levelStr, sol) {
  if (!sol || windowsFresh(sol)) return sol;
  measureWindows(level, sol);
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, keyOf(levelStr) + ".json"), JSON.stringify(sol));
  return sol;
}
// cached, or solve now
function solve(level, levelStr, opts) {
  opts = opts || {};
  const c = opts.fresh ? null : get(levelStr, true);
  if (fresh(c)) return withWindows(level, levelStr, c);
  const w = GD.makeWorld(level.objects, level.header);
  // the saved inputs still finish it: only the replay plan needs redoing
  // (and skip nothing: the no-skip rule; a route that now skips is solved again)
  if (c && c.ok && c.events && c.events.length) {
    const q = GD.run(w, c.events);
    if (!q.dead && (q.done || q.end.x >= w.endX) && !GD.skipCheck(w, q.path, c.events)) {
      // same replay plan code: only the physics stamp was old -- restamp, no work (a physics change no longer
      // makes every viewer page solve its levels again)
      if (c.plan === planCommit()) { const keep = Object.assign({}, c); delete keep.physics; delete keep.solvedAt; return put(levelStr, keep); }
      return fromRun(level, levelStr, { ok: true, events: c.events });
    }
  }
  // the saved route breaks under the new physics: re-solve only from its first changed stretch, back onto
  // its saved checkpoints (lib/incsolve.js refresh), before solving the whole level
  if (c && c.ok && c.checkpoints) try {
    const r = require("../lib/incsolve.js").incsolve.refresh(w, c.events, c.checkpoints);
    if (r.ok && !r.kept) return fromRun(level, levelStr, { ok: true, events: r.events, inc: { from: r.from, to: r.to, rejoined: r.rejoined } });
  } catch (e) { /* solve it whole */ }
  return fromRun(level, levelStr, GD.solveAny(w));
}

module.exports = { get, put, fromRun, solve, keyOf, physicsCommit, planCommit, fresh, withWindows, windowsFresh, measureWindows };

if (require.main === module) {
  const args = process.argv.slice(2);
  let files = args.filter(a => a.endsWith(".gdlvl"));
  if (args.includes("--all")) for (const d of ["levels", "examples"]) {
    const dir = path.join(__dirname, "..", d);
    if (fs.existsSync(dir)) files = files.concat(fs.readdirSync(dir).filter(f => f.endsWith(".gdlvl")).map(f => path.join(d, f)));
  }
  if (!files.length) { console.log("usage: node tools/solutions.js [--all | <level.gdlvl> ...]"); process.exit(1); }
  for (const f of files) {
    const L = readGdlvl(f);
    const again = args.includes("--fresh");
    if (args.includes("--windows")) {                 // only the windows of what is saved
      const c = get(L.levelStr, true);
      if (!c || !fresh(c)) { console.log(`${f}: no fresh saved solution (solve it first)`); continue; }
      if (windowsFresh(c)) { console.log(`${f}: windows saved already`); continue; }
      const t0 = Date.now(); withWindows(L.level, L.levelStr, c);
      console.log(`${f}: ${(c.windows || []).length} windows measured in ${((Date.now() - t0) / 1000).toFixed(0)} s`); continue;
    }
    if (!again && fresh(get(L.levelStr, true)) && windowsFresh(get(L.levelStr, true))) { console.log(`${f}: saved already`); continue; }
    const t0 = Date.now();
    const s = solve(L.level, L.levelStr, { fresh: again });
    console.log(`${f}: ${s.ok ? "beaten" : "not beaten"}, ${s.events.length} inputs, solved in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  require("./index_levels.js").buildIndex();
}
