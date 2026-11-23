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
// Each also carries `plan` (the commit of lib/natural.js). When only the plan is older, or the physics
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
    try { PHYS = require("child_process").execSync("git log -1 --format=%h -- lib/physics.js lib/objects.js lib/objects_extra.js lib/objects_gd22.js", { cwd: path.join(__dirname, ".."), encoding: "utf8" }).trim(); } catch (e) { PHYS = ""; }
  }
  return PHYS;
}
let PLAN = null;
function planCommit() {
  if (PLAN === null) {
    try { PLAN = require("child_process").execSync("git log -1 --format=%h -- lib/natural.js", { cwd: path.join(__dirname, ".."), encoding: "utf8" }).trim(); } catch (e) { PLAN = ""; }
  }
  return PLAN;
}
let WINC = null;
function windowsCommit() {
  if (WINC === null) {
    try { WINC = require("child_process").execSync("git log -1 --format=%h -- lib/windows.js lib/difficulty.js", { cwd: path.join(__dirname, ".."), encoding: "utf8" }).trim(); } catch (e) { WINC = ""; }
  }
  return WINC;
}
// every input's window of a beaten solution, measured now (seconds to a minute: a heavy job's work)
function measureWindows(level, sol) {
  if (!sol || !sol.ok || !sol.events || !sol.events.length) return sol;
  const w = GD.makeWorld(level.objects, level.header), ev = sol.events.slice().sort((a, b) => a.tick - b.tick);
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
function put(levelStr, sol, level) {
  sol.physics = physicsCommit(); sol.plan = planCommit(); sol.solvedAt = new Date().toISOString();
  if (level) { try { measureWindows(level, sol); } catch (e) { delete sol.windows; } }
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, keyOf(levelStr) + ".json"), JSON.stringify(sol));
  return sol;
}
// from a solver result already in hand (make.js has one): natural plan, saved
function fromRun(level, levelStr, r) {
  const w = GD.makeWorld(level.objects, level.header);
  let sol;
  if (r && r.ok) {
    let events = r.events;
    try { const n = GD.naturalPlan(w, r, level.objects, { cost: true }); if (n && n.path[n.path.length - 1].done) events = n.events; } catch (e) {}
    sol = { ok: true, events };
  } else sol = { ok: false, events: (r && r.trail) || [], dieX: r && r.dieAt && r.dieAt.x, why: r && r.why };
  return put(levelStr, sol, level);
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
