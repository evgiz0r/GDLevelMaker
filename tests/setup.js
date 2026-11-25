// node tests/setup.js   -- tools/setup.js as a new user would meet it: a copy of the repo with NO local/, and a fake
// Geometry Dash folder (Resources/levels/1..22.txt made from our own GDLM 01, so no RobTop data is needed). Checks that
// gdpaths finds the game from --game and remembers it, that mains_routes imports a route that clears, marks one that
// dies, lists levels without a route, writes local/official_NN.json, and that the viewer's list has them. SETUP.md.
const fs = require("fs"), path = require("path"), os = require("os"), cp = require("child_process");
const ROOT = path.join(__dirname, "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gdlm-setup-")), repo = path.join(tmp, "repo"), game = path.join(tmp, "Geometry Dash");
let fails = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
try {
  // a fresh copy: code and our levels, no local/
  for (const d of ["tools", "lib", "levels", "specs"]) fs.cpSync(path.join(ROOT, d), path.join(repo, d), { recursive: true });
  fs.mkdirSync(path.join(repo, "viewer")); fs.mkdirSync(path.join(repo, "knowledge", "objects"), { recursive: true });
  fs.copyFileSync(path.join(ROOT, "knowledge", "objects", "catalogue.tsv"), path.join(repo, "knowledge", "objects", "catalogue.tsv"));
  // fake game: every main level is GDLM 01 (one jump), packed as GD ships them
  const { readGdlvl, pack } = require("../tools/io.js");
  // (levels/archive/ since 2026-11-25: the fixture must not depend on which levels are current)
  const lv = readGdlvl(path.join(ROOT, "levels", "archive", "gdlm_01_one_jump.gdlvl")).levelStr;
  fs.mkdirSync(path.join(game, "Resources", "levels"), { recursive: true });
  for (let n = 1; n <= 22; n++) fs.writeFileSync(path.join(game, "Resources", "levels", n + ".txt"), pack(lv));
  // its route: one jump, found by trying each press tick (GDLM 01 is one jump; no saved route needed, which the committed
  // viewer list stopped carrying once the level was archived)
  const { replay, sha } = require("../tools/mains_routes.js");
  let sol = null;
  for (let t = 10; t < 3000 && !sol; t += 2) { const ev = [{ type: "press", tick: t }, { type: "release", tick: t + 4 }]; if (replay(lv, ev).done) sol = { events: ev }; }
  ok(sol, "GDLM 01: a one-jump route to use as a fixture");
  const early = [{ type: "press", tick: 1 }, { type: "release", tick: 4 }];
  fs.mkdirSync(path.join(repo, "knowledge", "mains"), { recursive: true });
  fs.writeFileSync(path.join(repo, "knowledge", "mains", "routes.json"), JSON.stringify({ levels: [
    { n: 1, name: "Stereo Madness", levelSha: sha(lv), ok: true, kind: "human", events: sol.events },
    { n: 2, name: "Back On Track", levelSha: "different", ok: true, kind: "human", events: sol.events },
    { n: 3, name: "Polargeist", levelSha: sha(lv), ok: true, kind: "human", events: early },     // jumps at the start: dies at the spike
    { n: 4, name: "Dry Out", levelSha: sha(lv), ok: true, kind: "human", events: early, raw: { ok: true, events: sol.events } },   // human dies, raw clears
    { n: 5, name: "Base After Base", levelSha: sha(lv), ok: false, kind: "human", events: [] } ] }));   // not beaten yet
  const env = Object.assign({}, process.env); delete env.GD_GAME; delete env.GD_LEVELS; delete env.GD_SAVE;
  env.GDLM_HEAVY = "off"; env.LOCALAPPDATA = path.join(tmp, "appdata"); env.HOME = tmp; env.USERPROFILE = tmp;
  const run = (a) => cp.spawnSync(process.execPath, [path.join(repo, "tools", "setup.js"), ...a], { cwd: repo, env, encoding: "utf8", windowsHide: true });
  const r = run(["--game", game, "--json"]);
  let rep = null; try { rep = JSON.parse(r.stdout); } catch (e) { console.log(r.stdout, r.stderr); }
  ok(rep, "setup --json prints a report");
  const c = n => rep && rep.checks.find(x => x.name === n);
  ok(c("Geometry Dash found") && c("Geometry Dash found").ok, "finds the game from --game");
  ok(fs.existsSync(path.join(repo, "local", "gd_paths.json")), "remembers it in local/gd_paths.json");
  const rows = rep && rep.mains ? rep.mains.rows : [];
  ok(rows[0] && rows[0].state === "clears" && rows[0].sameLevel, "level 1: the route from git clears");
  ok(rows[1] && rows[1].state === "clears" && rows[1].sameLevel === false, "level 2: clears, flagged as a different level");
  ok(rows[2] && rows[2].state === "fails", "level 3: a route that dies is marked fails");
  ok(rows[3] && rows[3].state === "clears" && rows[3].kind === "raw", "level 4: the human route dies, the raw solve from git clears and is used");
  ok(rows[4] && rows[4].state === "no route", "level 5: an empty route counts as no route");
  ok(rows.filter(x => x.state === "no route").length === 18, "levels 5-22: listed without a route");
  ok(r.status === 1 && rep && rep.mains.ready === 3, "not READY while a route from git dies (exit 1)");
  ok(c("main levels without a route in git") && !c("main levels without a route in git").needed, "levels without a route: a warning, not a failure");
  const o1 = JSON.parse(fs.readFileSync(path.join(repo, "local", "official_01.json"), "utf8"));
  ok(o1.level === lv && o1.solution.ok, "local/official_01.json has the level from the game and the route");
  const o3 = JSON.parse(fs.readFileSync(path.join(repo, "local", "official_03.json"), "utf8"));
  ok(o3.solution.ok === false && o3.solution.dieX > 0, "local/official_03.json: ok:false at its death spot");
  const idx = fs.readFileSync(path.join(repo, "viewer", "levels.local.js"), "utf8");
  ok(/official 1: Stereo Madness/.test(idx) && /official 22: Dash/.test(idx), "the viewer's list has the main levels");
  // a second run, no --game: found again through local/gd_paths.json, existing routes kept
  const r2 = run(["--json"]), rep2 = JSON.parse(r2.stdout);
  ok(rep2.checks[1].detail.includes("local/gd_paths.json"), "second run finds the game through local/gd_paths.json");
  ok(rep2.mains.rows[0].state === "kept", "second run keeps routes already in local/");
  // gdpaths with nothing set and nothing saved: says not found, keeps the old default
  const r3 = cp.spawnSync(process.execPath, [path.join(ROOT, "tools", "gdpaths.js"), "--json"], { env: Object.assign({}, env, { GD_GAME: path.join(tmp, "nowhere") }), encoding: "utf8", windowsHide: true });
  ok(JSON.parse(r3.stdout).found.game === false, "gdpaths reports a game folder without levels as not found");
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
console.log(fails ? fails + " failed" : "all ok");
process.exit(fails ? 1 : 0);
