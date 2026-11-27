// node tests/wip.js  -- `wip put` never waits on a solve (2026-11-26: a put solved an autobeat level inline for 26 min), ~10-30 s.
// In temp folders (wip, solutions cache, timings, heavy locks):
// 1. a level with no saved route is written at once with no route (a ghost in the viewer), and does not take the heavy lock
// 2. an auto level ({auto: true} beside it, tools/planned.js writeAuto) goes in with its plan of no press, at once
// 3. --plan still puts the given plan; --no-solve no solve
// 4. the background solve (`wip.js solve`, its own heavy job) puts the solution into the entry, logs its time keyed ":solve"
// 5. a background solve for a level the entry no longer holds changes nothing
// 6. tools/jobtime.js: wip put / wip solve are keyed apart; a job over 10x its estimate is flagged runaway (row, runaways(),
//    heavy.js describe() of a running one)
const fs = require("fs"), path = require("path"), os = require("os"), cp = require("child_process");
const ROOT = path.join(__dirname, ".."), tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gdlm-wip-"));
const WIPD = path.join(tmp, "wip");
Object.assign(process.env, { GDLM_WIP_DIR: WIPD, GDLM_SOLUTIONS_DIR: path.join(tmp, "solutions"), GDLM_TIMINGS: path.join(tmp, "timings.jsonl"),
  GDLM_LOCKDIR: path.join(tmp, "locks"), GDLM_HEAVY_NOSYNC: "1", GDLM_HEAVY_FREE_MB: "4000", GDLM_GAME: "0", GDLM_SESSION: "test" });
delete process.env.GDLM_HEAVY_HELD; delete process.env.GDLM_HEAVY;
let bad = 0; const check = (ok, what) => { console.log((ok ? "ok   " : "FAIL ") + what); if (!ok) bad++; };
const WIP = path.join(ROOT, "tools", "wip.js");
const run = (args, env) => { const t0 = Date.now(), r = cp.spawnSync(process.execPath, [WIP].concat(args), { cwd: ROOT, encoding: "utf8", windowsHide: true, env: Object.assign({}, process.env, env || {}) });
  return { out: (r.stdout || "") + (r.stderr || ""), secs: (Date.now() - t0) / 1000, status: r.status }; };
const meta = b => { try { return JSON.parse(fs.readFileSync(path.join(WIPD, "test-wip", b + ".json"), "utf8")); } catch (e) { return null; } };
const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// fixtures: a tiny level under its own name (nothing cached for it), and an auto copy with its {auto: true}
const src = fs.readFileSync(path.join(ROOT, "levels", "archive", "gdlm_01_one_jump.gdlvl"));
const lv = path.join(tmp, "wiptest_level.gdlvl"), auto = path.join(tmp, "wiptest_auto.gdlvl");
fs.writeFileSync(lv, src); fs.writeFileSync(auto, src);
require("../tools/planned.js").writeAuto(auto, "test");

// 1
let r = run(["put", lv, "--session", "test-wip", "--note", "first"], { GDLM_WIP_BG: "0" }), m = meta("wiptest_level");
check(r.status === 0 && m && m.version === 1 && m.solution === undefined && !m.solving, "no saved route: written at once with no route (" + r.secs.toFixed(1) + " s)");
check(r.secs < 15, "the put took " + r.secs.toFixed(1) + " s (< 15 s; it was 26 min with an inline solve)");
check(!fs.existsSync(path.join(tmp, "timings.jsonl")) || !fs.readFileSync(path.join(tmp, "timings.jsonl"), "utf8").includes('"tool":"wip"'), "the put is not a heavy job (no heavy row)");
// 2
r = run(["put", auto, "--session", "test-wip"], { GDLM_WIP_BG: "0" }); m = meta("wiptest_auto");
check(m && m.solution && m.solution.kind === "plan" && m.solution.ok && m.solution.events.length === 0, "an auto level: its plan of no press at once: " + JSON.stringify(m && m.solution && { kind: m.solution.kind, n: m.solution.events.length }));
// 3
const planF = path.join(tmp, "plan.json"); fs.writeFileSync(planF, JSON.stringify({ ok: true, events: [{ tick: 100, type: "press" }, { tick: 114, type: "release" }] }));
r = run(["put", lv, "--session", "test-wip", "--plan", planF]); m = meta("wiptest_level");
check(m && m.version === 2 && m.solution.kind === "plan" && m.solution.events.length === 2 && !m.solving, "--plan: the given plan, no background solve");
r = run(["put", lv, "--session", "test-wip", "--no-solve"]); m = meta("wiptest_level");
check(m && m.version === 3 && m.solution === undefined && !m.solving, "--no-solve: no route, no background solve");
// 4
r = run(["put", lv, "--session", "test-wip", "--note", "bg"]); m = meta("wiptest_level");
check(m && m.solving && m.solving.pid > 0 && /wip_solve/.test(m.solving.log), "the put starts the background solve: " + JSON.stringify(m && m.solving));
for (let i = 0; i < 240 && meta("wiptest_level").solving; i++) sleep(500);
m = meta("wiptest_level");
check(m && !m.solving && m.solution && m.solution.ok && m.solution.events.length > 0, "the background solve put its route into the entry: " + (m && m.solution ? m.solution.kind + ", " + m.solution.events.length + " inputs" : "none") + (m && m.solving ? " (still solving after 2 min)" : ""));
const rows = fs.existsSync(path.join(tmp, "timings.jsonl")) ? fs.readFileSync(path.join(tmp, "timings.jsonl"), "utf8").split("\n").filter(Boolean).map(JSON.parse) : [];
const srow = rows.find(x => x.tool === "wip");
check(srow && srow.flags.includes(":solve") && srow.level === "wiptest_level", "the solve logs its time as wip :solve of that level: " + JSON.stringify(srow && { flags: srow.flags, level: srow.level, secs: srow.secs }));
// 4b: an auto level with no {auto: true} beside it: the solve finds "no press clears it" before any search (tools/solutions.js)
{ const IO = require("../tools/io.js"), L = IO.readGdlvl(lv), objs = L.level.objects.filter(o => +o.id !== 8);   // the jump's spike out: a block to walk past
  const f = path.join(tmp, "wiptest_flat.gdlvl"); IO.writeGdlvl(f, IO.GD.newRecord("wiptest flat", ""), { header: L.level.header, objects: objs });
  run(["put", f, "--session", "test-wip"]);
  for (let i = 0; i < 240 && meta("wiptest_flat") && meta("wiptest_flat").solving; i++) sleep(500);
  const mf = meta("wiptest_flat");
  check(mf && mf.solution && mf.solution.ok && mf.solution.source === "auto" && mf.solution.events.length === 0, "an auto level with no plan: solved as 'no press' with no search: " + JSON.stringify(mf && mf.solution && { source: mf.solution.source, n: mf.solution.events.length })); }
// 5
const before = JSON.stringify(meta("wiptest_level"));
r = run(["solve", "test-wip/wiptest_level", "--hash", "000000000000"]);
check(/newer level/.test(r.out) && JSON.stringify(meta("wiptest_level")) === before, "a solve for a level the entry no longer holds changes nothing");

// 6
const JT = require("../tools/jobtime.js");
check(JT.key("node tools/wip.js put local/tmp/x.gdlvl --session s").flags.includes(":put") && JT.key("tools/wip.js solve s/x local/wip/s/x.gdlvl").flags.includes(":solve"), "wip put and wip solve are keyed apart");
const est = { secs: 2, basis: "test" };
const row = JT.record("tools/score.js levels/x.gdlvl", Date.now() - 90e3, true, est);
check(row.runaway === true && JT.runaways(1).some(x => x.tool === "score" && x.x >= 10), "a finished job over 10x its estimate is flagged runaway (row and runaways())");
check(!JT.record("tools/score.js levels/x.gdlvl", Date.now() - 15e3, true, est).runaway, "under a minute is never a runaway");
const H = require("../tools/heavy.js");
check(/^!!! runaway \(\d+x/.test(H.describe({ pid: 1, session: "t", cmd: "tools/score.js x.gdlvl", start: new Date(Date.now() - 120e3).toISOString(), est: 5, basis: "test" })), "a running job over 10x its estimate: '!!! runaway' in heavy.js");
check(!/runaway/.test(H.describe({ pid: 1, session: "t", cmd: "tools/score.js x.gdlvl", start: new Date(Date.now() - 20e3).toISOString(), est: 5, basis: "test" })), "a job a bit over its estimate is not");

fs.rmSync(tmp, { recursive: true, force: true });
console.log(bad ? `${bad} failed` : "all passed"); process.exit(bad ? 1 : 0);
