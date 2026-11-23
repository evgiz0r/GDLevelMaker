// node tests/loop.js  -- checks for tools/loop.js (the one-command loop), ~2 s
// 1. ETA: built-in guess with no runs; nearest-length runs scaled (capped at 4x); the time table buckets
// 2. guard: heavy jobs are found by tool name (serve.js / loop.js / this process are not), and the
//    decision is go / warn (one other) / wait (two others, or under 1.2 GB free)
// 3. end to end on a tiny level (one spike) in a temp folder: score runs, READY, one timing row written
//    (to a temp timings file, not the shared one); --eta runs nothing
// 5. owners: another session's recent wip of the level stops the run, one's own does not
// 4. it never installs or uploads: no install.js / upload / GD server in its source
const assert = require("assert"), fs = require("fs"), path = require("path"), os = require("os"), cp = require("child_process");
const L = require("../tools/loop.js");

// 1
const g = L.eta("score", 20, []);
assert(g.from === 0 && g.secs > 0, "a guess when nothing is timed");
const rows = [{ step: "score", secs: 10, levelSecs: 10 }, { step: "score", secs: 40, levelSecs: 40 }, { step: "score", secs: 90, levelSecs: 90 }, { step: "make", secs: 999, levelSecs: 20 }];
const e = L.eta("score", 20, rows);
assert.strictEqual(e.from, 3); assert(Math.abs(e.secs - 20) < 1e-9, "scaled by length: " + e.secs);
assert(Math.abs(L.eta("score", 1000, [{ step: "score", secs: 10, levelSecs: 10 }]).secs - 40) < 1e-9, "scaling capped at 4x");
assert(L.eta("score", 20, [{ step: "score", secs: 5, levelSecs: 20, ok: false }]).from === 0, "failed runs are not used");
const t = L.table(rows);
assert(t.find(r => r.step === "score" && r.len === "30-75 s").median === 40, "table buckets by level length");
assert.strictEqual(L.fmt(45), "45 s"); assert.strictEqual(L.fmt(150), "2.5 min");

// 2
const procs = [{ pid: 1, cmd: '"node" tools/make.js specs/50_eclipse.json' }, { pid: 2, cmd: "node tools/serve.js 8765" },
  { pid: 3, cmd: "node C:\\x\\tools\\score.js levels/a.gdlvl" }, { pid: 4, cmd: "node tools/loop.js specs/x.json" }, { pid: 5, cmd: "node tools/shoot.js a" }];
assert.deepStrictEqual(L.heavyJobs(procs, [5]).map(p => p.pid), [1, 3]);
assert.strictEqual(L.guardDecision([], 4000), "go");
assert.strictEqual(L.guardDecision([{}], 4000), "warn");
assert.strictEqual(L.guardDecision([{}, {}], 4000), "wait");
assert.strictEqual(L.guardDecision([], 500), "wait");

// 3
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gdlm-loop-test-"));
const { GD, writeGdlvl } = require("../tools/io.js");
const lv = path.join(tmp, "one_spike.gdlvl");
writeGdlvl(lv, GD.newRecord("GDLM test one spike", ""), { header: "kA4,0", objects: [{ id: 8, x: 12 * 30 + 15, y: 15 }] });
const env = Object.assign({}, process.env, { GDLM_TIMINGS: path.join(tmp, "timings.jsonl"), GDLM_LOOPLOGS: path.join(tmp, "logs") });
const loop = a => cp.spawnSync(process.execPath, [path.join(__dirname, "..", "tools", "loop.js")].concat(a), { env, encoding: "utf8" });
const dry = loop([lv, "--eta"]);
assert.strictEqual(dry.status, 0, dry.stdout + dry.stderr); assert(/ETA/.test(dry.stdout)); assert(!fs.existsSync(env.GDLM_TIMINGS), "--eta runs nothing");
const real = loop([lv, "--force"]);   // tiny level: --force so a busy PC does not make the test wait
assert.strictEqual(real.status, 0, real.stdout + real.stderr);
assert(/READY/.test(real.stdout) && /presses/.test(real.stdout), real.stdout);
const logged = L.readTimings(env.GDLM_TIMINGS);
assert.strictEqual(logged.length, 1); assert(logged[0].step === "score" && logged[0].ok && logged[0].secs > 0 && logged[0].levelSecs > 0);
fs.rmSync(tmp, { recursive: true, force: true });

// 5. owners: another session's recent wip of the same level stops the run; one's own does not
const wd = fs.mkdtempSync(path.join(os.tmpdir(), "gdlm-loop-wip-"));
fs.mkdirSync(path.join(wd, "style")); fs.writeFileSync(path.join(wd, "style", "gdlm_47_x.gdlvl"), "");
assert.strictEqual(L.othersAtWork(["levels/gdlm_47_x.gdlvl"], "me", 3, wd).length, 1, "another session's wip");
assert.strictEqual(L.othersAtWork(["levels/gdlm_47_x.gdlvl"], "style", 3, wd).length, 0, "my own wip");
assert.strictEqual(L.othersAtWork(["levels/gdlm_48_y.gdlvl"], "me", 3, wd).length, 0, "another level");
fs.rmSync(wd, { recursive: true, force: true });

// 4
const src = fs.readFileSync(path.join(__dirname, "..", "tools", "loop.js"), "utf8").split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
assert(!/install\.js|uploadGJ|boomlings|publish\.js/i.test(src), "loop.js must never install or upload");
console.log("loop: ok");
