// node tools/mains_routes.js export      -- (on a PC that has them solved) RobTop's 22 main levels' human routes, from
//   local/official_NN.json, into knowledge/mains/routes.json: our own press timings only, NO level data (each route
//   carries a hash of the level text it was solved on). Commit that file so a fresh clone needs no hours of solving.
// node tools/mains_routes.js import [--force] [--json]   -- (on a new computer, tools/setup.js runs it) reads each main
//   level from the player's OWN game (tools/gdpaths.js LEVELS), replays the route from git on today's sim and writes
//   local/official_NN.json (level + route), which the viewer lists under "official". Keeps an existing local file
//   unless --force. A route that no longer clears is still written, as ok:false at its death spot, and listed: fix
//   with `node tools/mains.js run`. A level with no route is written with no solution (the viewer runs it as a ghost).
// node tools/mains_routes.js check       -- replays every route in knowledge/mains/routes.json, writes nothing.
// SETUP.md; DIFFICULTY.md "Main levels kept current". Re-export after tools/mains.js run re-solved levels.
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const ROOT = path.join(__dirname, ".."), LOCAL = path.join(ROOT, "local");
const FILE = path.join(ROOT, "knowledge", "mains", "routes.json");
const NAMES = ["Stereo Madness", "Back On Track", "Polargeist", "Dry Out", "Base After Base", "Cant Let Go", "Jumper",
  "Time Machine", "Cycles", "xStep", "Clutterfunk", "Theory of Everything", "Electroman Adventures", "Clubstep",
  "Electrodynamix", "Hexagon Force", "Blast Processing", "Theory of Everything 2", "Geometrical Dominator", "Deadlocked",
  "Fingerdash", "Dash"];
const tag = n => String(n).padStart(2, "0");
const sha = s => crypto.createHash("sha1").update(s).digest("hex").slice(0, 12);
const readJ = f => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return null; } };
const physicsCommit = () => { try { return require("child_process").execSync("git log -1 --format=%h -- lib/physics.js lib/dual.js lib/objects.js lib/objects_extra.js", { windowsHide: true, cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() || null; } catch (e) { return null; } };

function levelFromGame(n) {
  const { unpack } = require("./io.js"), f = path.join(require("./gdpaths.js").LEVELS, n + ".txt");
  if (!fs.existsSync(f)) return null;
  return unpack(fs.readFileSync(f, "utf8"));
}
// does `events` clear `level` on today's sim? {done, pct, dieX}
function replay(level, events) {
  const { GD } = require("./io.js"), L = GD.parseLevel(level), w = GD.makeWorld(L.objects, L.header);
  const q = GD.run(w, events || []), e = q.end || q.path[q.path.length - 1];
  const done = !!(q.done || (!q.dead && !e.hd && e.x >= w.endX)), x = GD.worldXY(e)[0];
  return { done, pct: +Math.min(100, x / w.endX * 100).toFixed(1), dieX: done ? null : x };
}

function exportRoutes() {
  const out = { note: "Human routes (press timings) for RobTop's 22 main levels, made by our solver. No level data: the levels come from the player's own game (tools/mains_routes.js import, SETUP.md).", exported: new Date().toISOString(), levels: [] };
  for (let n = 1; n <= 22; n++) {
    const o = readJ(path.join(LOCAL, `official_${tag(n)}.json`));
    if (!o || !o.solution || !o.solution.events) { console.log(`${n} ${NAMES[n - 1]}: no route in local/ -- skipped`); continue; }
    const s = o.solution;
    out.levels.push({ n, name: NAMES[n - 1], levelSha: sha(o.level), physics: o.physics || null, ok: !!s.ok, kind: s.kind || null, events: s.events });
    console.log(`${n} ${NAMES[n - 1]}: ${s.ok ? "clears" : "fails"} (${s.kind || "?"}, ${s.events.length} events)`);
  }
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(out));
  console.log(`-> ${path.relative(ROOT, FILE)}: ${out.levels.length} routes. Commit it.`);
}

// one row per main level; writes local/official_NN.json unless dry
function importRoutes({ force = false, dry = false, log = console.log } = {}) {
  const R = readJ(FILE), byN = {};
  if (R) for (const r of R.levels) byN[r.n] = r;
  const phys = physicsCommit(), rows = [];
  fs.mkdirSync(LOCAL, { recursive: true });
  for (let n = 1; n <= 22; n++) {
    const name = NAMES[n - 1], dest = path.join(LOCAL, `official_${tag(n)}.json`), row = { n, name };
    rows.push(row);
    const level = levelFromGame(n);
    if (!level) { row.state = "no level file"; log(`${tag(n)} ${name}: no ${n}.txt in the game's levels folder`); continue; }
    const have = readJ(dest);
    if (have && have.solution && !force && !dry) { row.state = "kept"; row.ok = !!have.solution.ok; log(`${tag(n)} ${name}: local route kept (--force to replace)`); continue; }
    const r = byN[n];
    if (!r) { row.state = "no route";
      if (!dry) fs.writeFileSync(dest, JSON.stringify({ n, name, level, solution: undefined, physics: null }));
      log(`${tag(n)} ${name}: no route in git -- listed without one (solve: node tools/difficulty_solve.js ${n})`); continue; }
    const t0 = Date.now(), p = replay(level, r.events), secs = ((Date.now() - t0) / 1000).toFixed(1);
    row.sameLevel = r.levelSha === sha(level); row.ok = p.done; row.pct = p.pct; row.secs = +secs;
    row.state = p.done ? "clears" : "fails";
    const solution = p.done ? { ok: true, events: r.events, kind: r.kind } : { ok: false, events: r.events, dieX: p.dieX, why: "route from git dies here on this sim", kind: r.kind };
    if (!dry) fs.writeFileSync(dest, JSON.stringify({ n, name, level, solution, physics: p.done ? r.physics : null, from: "knowledge/mains/routes.json" }));
    log(`${tag(n)} ${name}: ${p.done ? "clears" : "DIES at " + p.pct + "%"} (${secs} s)${row.sameLevel ? "" : " -- your game's level differs from the one the route was made on"}${r.physics && phys && r.physics !== phys ? " [route physics " + r.physics + ", sim " + phys + "]" : ""}`);
  }
  if (!dry) try { require("./index_levels.js").buildIndex(); } catch (e) { log("index: " + e.message); }
  return rows;
}

if (require.main === module) {
  const a = process.argv.slice(2), cmd = a[0];
  if (cmd === "export") exportRoutes();
  else if (cmd === "import" || cmd === "check") {
    const rows = importRoutes({ force: a.includes("--force"), dry: cmd === "check", log: a.includes("--json") ? () => {} : console.log });
    if (a.includes("--json")) console.log(JSON.stringify(rows));
    else { const c = s => rows.filter(r => r.state === s).length;
      console.log(`\n${c("clears")} clear, ${c("fails")} fail, ${c("kept")} kept, ${c("no route")} without a route, ${c("no level file")} missing from the game`); }
  } else { console.log("usage: node tools/mains_routes.js export | import [--force] | check"); process.exit(1); }
}
module.exports = { exportRoutes, importRoutes, replay, sha, FILE, NAMES };
