// node tests/jobtime.js  -- estimates come from measurements only (tools/jobtime.js, CLAUDE.md): in a temp timings file,
// a job's key is tool + level + flags (+ jN for a spec with jN columns, a spec counts as the level it builds); the
// estimate says its basis; a run of another size or other flags gives "not measured" (null); loop.js rows count for
// their level; a real heavy job (tools/heavy.js claim) logs its duration with the estimate it had; recent() shows drift.
const fs = require("fs"), path = require("path"), os = require("os"), cp = require("child_process");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gdlm-jobtime-")), FILE = path.join(tmp, "timings.jsonl");
process.env.GDLM_TIMINGS = FILE;
const JT = require("../tools/jobtime.js");
let bad = 0; const check = (ok, what) => { console.log((ok ? "ok   " : "FAIL ") + what); if (!ok) bad++; };
// a spec with jN columns of its own (the real specs/62 lost its jN columns, 2026-11-26: the test must not depend on it)
fs.mkdirSync(path.join(tmp, "specs")); const SPEC = path.join(tmp, "specs", "62_low_end_lullaby.json").replace(/\\/g, "/"); fs.writeFileSync(SPEC, JSON.stringify({ objects: [["j12", 0, "spike"]] }));
const k = JT.key("node C:\\x\\tools\\make.js " + SPEC + " --full");
check(k.tool === "make" && k.level === "gdlm_62_low_end_lullaby" && k.flags.join() === "--full,jN", "key: tool, the level a spec builds, flags + jN: " + JSON.stringify(k));
check(JT.estimate("tools/make.js levels/archive/gdlm_41_classic.gdlvl") === null, "no runs: not measured");
const row = o => fs.appendFileSync(FILE, JSON.stringify(Object.assign({ at: new Date(Date.now() - 3600e3).toISOString(), ok: true }, o)) + "\n");
row({ step: "make", secs: 1707, level: "gdlm_62_low_end_lullaby" });   // a loop.js row (no flags logged)
let e = JT.estimate("tools/make.js " + SPEC);
check(e && Math.round(e.secs) === 1707 && /this level, loop\.js runs: 28 min/.test(e.basis), "a loop.js run of this level counts, with its basis: " + (e && e.basis));
check(JT.estimate("tools/make.js " + SPEC + " --look") === null, "--look is another job: not measured");
for (const s of [20, 30, 25]) row({ by: "heavy", tool: "score", level: "gdlm_41_classic", flags: [], kb: 3, secs: s });
e = JT.estimate("tools/score.js levels/archive/gdlm_41_classic.gdlvl");
check(e && e.secs === 25 && e.n === 3 && e.basis === "last 3 score, this level: 20-30 s", "last 3 of the same key: median and range: " + (e && e.basis));
check(JT.estimate("tools/score.js levels/archive/gdlm_41_classic.gdlvl --gates") === null, "other flags: not measured");
check(JT.estimate("tools/score.js levels/archive/gdlm_62_low_end_lullaby.gdlvl") === null, "a level of another size: not measured (score took 11 s on short levels, minutes on long ones)");
// a real heavy job logs its own time with the estimate it had
const dir = path.join(tmp, "locks");
const env = Object.assign({}, process.env, { GDLM_HEAVY_NOSYNC: "1", GDLM_LOCKDIR: dir, GDLM_HEAVY_FREE_MB: "4000", GDLM_SESSION: "test", GDLM_GAME: "0" });
delete env.GDLM_HEAVY_HELD; delete env.GDLM_HEAVY;
const heavy = JSON.stringify(path.join(__dirname, "..", "tools", "heavy.js"));
cp.spawnSync(process.execPath, ["-e", `require(${heavy}).claim("tools/score.js levels/archive/gdlm_41_classic.gdlvl"); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300);`], { windowsHide: true, env });
const last = JT.rows().pop();
check(last && last.by === "heavy" && last.tool === "score" && last.level === "gdlm_41_classic" && last.secs >= 0.2 && last.est === 25 && last.ok === true, "heavy.js logs a finished job: " + JSON.stringify(last));
const r = JT.recent(1)[0];
check(r && r.est === 25 && r.drift > 0 && r.drift < 0.1, "recent(): estimate vs actual (drift " + (r && r.drift) + ")");
fs.rmSync(tmp, { recursive: true, force: true });
console.log(bad ? `${bad} failed` : "all passed"); process.exit(bad ? 1 : 0);
