// node tests/heavy_yield.js  -- tools/heavy.js pause / resume / yield on REAL work (tests/heavy_yield_job.js: solve +
// natural plan of examples/cube_timings, rounds times), in a private lock folder, one slot:
//   1. the same job run straight through -> its RESULT hash
//   2. yield: a low-priority job runs; a high-priority job queues behind it; after GDLM_HEAVY_YIELD_MIN the waiter asks,
//      the low job gives its slot back at a yield point, the high job runs and ends FIRST, the low job resumes and
//      ends with the SAME hash
//   3. pause by hand: `heavy.js pause <pid>` -> the job's slot file goes while the process lives and does no work;
//      `heavy.js resume <pid>` -> it takes the slot again and ends with the SAME hash
// ~1 min (the jobs run at idle CPU priority).
const fs = require("fs"), os = require("os"), path = require("path"), { spawn, spawnSync } = require("child_process");
const ROOT = path.join(__dirname, ".."), JOB = path.join(__dirname, "heavy_yield_job.js"), HEAVY = path.join(ROOT, "tools", "heavy.js");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "heavy-yield-"));
const ROUNDS = 6;
const env = Object.assign({}, process.env, { GDLM_LOCKDIR: dir, GDLM_HEAVY_NOSYNC: "1", GDLM_HEAVY_NOREC: "1", GDLM_GAME: "0",
  GDLM_HEAVY_FREE_MB: "2000",            // one slot (two need 1.5 GB + one job's peak free)
  GDLM_HEAVY_POLL_MS: "200", GDLM_HEAVY_YIELD_CHECK_MS: "100", GDLM_HEAVY_YIELD_MIN: "0.03", GDLM_HEAVY_YIELD_HOLD_MS: "500" });
delete env.GDLM_HEAVY_HELD; delete env.GDLM_HEAVY; delete env.GDLM_HEAVY_PRIORITY;
let fails = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
function start(label, rounds, prio) {
  const p = spawn(process.execPath, [JOB, label, String(rounds)], { env: Object.assign({}, env, { GDLM_HEAVY_PRIORITY: prio }), windowsHide: true });
  const j = { p, out: "", end: null };
  p.stdout.on("data", d => j.out += d); p.stderr.on("data", d => j.out += d);
  j.done = new Promise(r => p.on("exit", code => { j.end = Date.now(); j.code = code; r(); }));
  return j;
}
const hash = j => (/RESULT (\w+)/.exec(j.out) || [])[1];
const holds = pid => fs.existsSync(path.join(dir, pid + ".json"));
async function until(f, ms, what) { const t = Date.now(); while (Date.now() - t < ms) { if (f()) return true; await sleep(100); } console.log("  (timed out waiting for " + what + ")"); return false; }

(async () => {
  // 1. straight through
  const ref = start("test-ref", ROUNDS, "normal"); await ref.done;
  const H = hash(ref);
  ok(!!H && ref.code === 0, `reference run: RESULT ${H}`);

  // 2. a high-priority waiter makes a low-priority job yield
  const low = start("test-low", ROUNDS, "low");
  await until(() => holds(low.p.pid), 20000, "the low job's slot");
  await until(() => /round 1\//.test(low.out), 20000, "the low job's first round");
  const high = start("test-high", 1, "high");
  await Promise.all([low.done, high.done]);
  ok(/yielding its slot/.test(low.out) && /resumed after/.test(low.out), "the low job yielded and resumed");
  ok(/asked .* to yield/.test(high.out), "the high job asked for the slot");
  ok(high.end < low.end, "the high job finished first");
  ok(hash(low) === H, `the yielded job's result is the same (${hash(low)})`);
  ok(!!hash(high) && high.code === 0, "the high job finished its work");

  // 3. pause and resume by hand
  const job = start("test-pause", ROUNDS, "normal");
  await until(() => holds(job.p.pid) && /round 1\//.test(job.out), 20000, "the job's first round");
  const pr = spawnSync(process.execPath, [HEAVY, "pause", String(job.p.pid)], { env, encoding: "utf8", windowsHide: true });
  ok(pr.status === 0 && /pause asked/.test(pr.stdout), "heavy.js pause <pid> asks it");
  const paused = await until(() => /PAUSED/.test(job.out) && !holds(job.p.pid), 10000, "the pause");
  ok(paused && job.end === null, "paused: slot given back, the process still alive");
  const stat = spawnSync(process.execPath, [HEAVY], { env, encoding: "utf8", windowsHide: true });
  ok(/PAUSED .*pid /.test(stat.stdout), "node tools/heavy.js lists it as PAUSED");
  const rounds0 = (job.out.match(/round \d/g) || []).length;
  await sleep(2000);
  ok((job.out.match(/round \d/g) || []).length === rounds0, "no work while paused");
  const rr = spawnSync(process.execPath, [HEAVY, "resume", String(job.p.pid)], { env, encoding: "utf8", windowsHide: true });
  ok(rr.status === 0 && /resumed pid/.test(rr.stdout), "heavy.js resume <pid>");
  await job.done;
  ok(/resumed after/.test(job.out) && job.code === 0, "it took the slot again and finished");
  ok(hash(job) === H, `the paused job's result is the same (${hash(job)})`);

  // pure: who is asked to yield
  const HV = require(HEAVY), now = Date.now(), old = new Date(now - 120000).toISOString();
  process.env.GDLM_HEAVY_YIELD_MIN = "5"; delete process.env.GDLM_HEAVY_YIELD_HOLD_MS;
  const hs = [{ pid: 1, prio: "low", yields: true, start: old }, { pid: 2, prio: "normal", yields: true, start: old }, { pid: 3, prio: "low", start: old }];
  ok(HV.yieldVictim({ prio: "high" }, hs, [], now, 6).pid === 1, "yieldVictim: the lowest priority with yield points");
  ok(HV.yieldVictim({ prio: "high" }, hs, [], now, 4) === null, "yieldVictim: not before YIELD_MIN");
  ok(HV.yieldVictim({ prio: "low" }, hs, [], now, 60) === null, "yieldVictim: never for an equal or lower priority");
  ok(HV.yieldVictim({ prio: "high" }, hs, [{ pid: 1 }], now, 6).pid === 2, "yieldVictim: not one asked already");
  ok(HV.yieldVictim({ prio: "high" }, [{ pid: 1, prio: "low", yields: true, start: new Date(now - 5000).toISOString() }], [], now, 6) === null, "yieldVictim: not one that just got its slot");

  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  console.log(fails ? `heavy_yield: ${fails} FAILED` : "heavy_yield: ok");
  process.exit(fails ? 1 : 0);
})();
