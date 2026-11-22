// node tools/solutions.js [--all | <level.gdlvl> ...]  -- solve levels ONCE, on the PC, and keep the answer
//
// The viewer and the phone page replay a saved solution instead of solving in the browser (a 60 s
// level with modes takes minutes to solve; on the phone the page looked hung). A solution is
// {ok, events} -- lib/natural.js's natural replay when it works -- cached by the level's content in
// local/solutions/<hash>.json (shared folder). tools/index_levels.js puts the cached solution of
// each repo level into viewer/levels.js; tools/make.js and tools/wip.js save one whenever they solve.
// Each carries `physics` (the commit of lib/physics.js / lib/objects*.js it was solved on): after a
// physics change, get() treats older ones as stale and they are solved again.
// --all: solve every repo level that has none yet (one at a time; heavy levels take minutes).
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const { GD, readGdlvl } = require("./io.js");
Object.assign(GD, require("../lib/natural.js"));
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
function get(levelStr, any) {
  let s;
  try { s = JSON.parse(fs.readFileSync(path.join(DIR, keyOf(levelStr) + ".json"), "utf8")); } catch (e) { return null; }
  if (!any && s.physics && physicsCommit() && s.physics !== physicsCommit()) return null; // stale
  return s;
}
function put(levelStr, sol) {
  sol.physics = physicsCommit(); sol.solvedAt = new Date().toISOString();
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
    try { const n = GD.naturalPlan(w, r, level.objects); if (n && n.path[n.path.length - 1].done) events = n.events; } catch (e) {}
    sol = { ok: true, events };
  } else sol = { ok: false, events: (r && r.trail) || [], dieX: r && r.dieAt && r.dieAt.x, why: r && r.why };
  return put(levelStr, sol);
}
// cached, or solve now
function solve(level, levelStr) {
  const c = get(levelStr);
  if (c) return c;
  const w = GD.makeWorld(level.objects, level.header);
  return fromRun(level, levelStr, GD.solveAny(w));
}

module.exports = { get, put, fromRun, solve, keyOf, physicsCommit };

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
    if (get(L.levelStr)) { console.log(`${f}: saved already`); continue; }
    const t0 = Date.now();
    const s = solve(L.level, L.levelStr);
    console.log(`${f}: ${s.ok ? "beaten" : "not beaten"}, ${s.events.length} inputs, solved in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  require("./index_levels.js").buildIndex();
}
