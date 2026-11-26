// node tests/heavy.js  -- the one-heavy-job lock (tools/heavy.js), ~15 s, in a temp lock folder
// 1. decide: 1 slot, 2 from 1.5 GB + one job's peak memory free (~3 GB), none under 1.5 GB; while the game runs 1 slot and none under 2 GB
// 2. a second job waits ("waiting for ...") while the first holds the slot, and runs after it exits
// 3. a claimed job runs at idle priority; a slot whose pid is dead is cleared; a child of a holder (GDLM_HEAVY_HELD) runs in its slot
// 4. every heavy tool claims the lock itself
// 6. freshness: a clean worktree behind origin/main is fast-forwarded; a dirty one gets a warning naming what it lacks
// 5. priority: a free slot goes to the highest-priority waiter (GDLM_HEAVY_PRIORITY), first come within one
// 7. a waiter from older heavy.js code (no ver) does not hold the second slot back
const assert = require("assert"), fs = require("fs"), path = require("path"), os = require("os"), cp = require("child_process");
const H = require("../tools/heavy.js");

// 1
assert.strictEqual(H.decide(0, 4000), "go");
assert.strictEqual(H.decide(1, 2900), "busy", "a second job would leave under 1.5 GB");
assert.strictEqual(H.decide(1, 3000), "go", "Go more in parallel: 2 slots from 1.5 GB + one job (1.5 GB)");
assert.strictEqual(H.decide(1, 3500, false, 2500), "busy", "the threshold follows the measured job size");
assert.strictEqual(H.decide(1, 7000), "go");
assert.strictEqual(H.decide(2, 9000), "busy");
assert.strictEqual(H.decide(0, 1000), "memory");
assert.strictEqual(H.decide(1, 9000, true), "busy", "one job while the game runs");
assert.strictEqual(H.decide(0, 1800, true), "memory", "2 GB free while the game runs");
assert.strictEqual(H.decide(0, 1800, false), "go");
// 5 (pure): high before normal before low; first come within one priority
assert.strictEqual(H.firstInLine([{ pid: 1, prio: "low", since: 1 }, { pid: 2, prio: "high", since: 5 }, { pid: 3, prio: "normal", since: 2 }]).pid, 2);
assert.strictEqual(H.firstInLine([{ pid: 4, prio: "normal", since: 9 }, { pid: 5, prio: "normal", since: 3 }]).pid, 5);
// fast lane (pure): a measured-short waiter goes ahead of a long first-in-line; one lane job at a time; a long job that
// has waited STARVE_MIN is never passed
{ const now = 100 * 60000, L = { pid: 6, prio: "normal", since: now - 60000, est: 900 }, F = { pid: 7, prio: "normal", since: now - 1000, est: 40 };
  let r = H.pickNext([L, F], [], now); assert.strictEqual(r.w.pid, 7); assert.strictEqual(r.lane, true);
  r = H.pickNext([L, F], [{ lane: true }], now); assert.strictEqual(r.w.pid, 6, "the lane is busy: the long job's turn");
  r = H.pickNext([Object.assign({}, L, { since: now - 11 * 60000 }), F], [], now); assert.strictEqual(r.w.pid, 6, "never starve a long job");
  r = H.pickNext([L, Object.assign({}, F, { est: null })], [], now); assert.strictEqual(r.w.pid, 6, "not measured is not fast");
  r = H.pickNext([F, L], [], now); assert.strictEqual(r.w.pid, 7); }

// 2
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gdlm-heavy-test-"));
const env = Object.assign({}, process.env, { GDLM_HEAVY_NOSYNC: "1", GDLM_LOCKDIR: dir, GDLM_HEAVY_FREE_MB: "2500", GDLM_SESSION: "test", GDLM_GAME: "0", GDLM_TIMINGS: path.join(dir, "timings.jsonl") });
delete env.GDLM_HEAVY_HELD; delete env.GDLM_HEAVY;
const job = (ms, tag) => `require(${JSON.stringify(path.join(__dirname, "..", "tools", "heavy.js"))}).claim(${JSON.stringify(tag)}); console.log("RUN ${tag} " + Date.now()); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ${ms}); console.log("END ${tag} " + Date.now());`;
const outOf = ch => new Promise(res => { let o = ""; ch.stdout.on("data", d => o += d); ch.on("close", () => res(o)); });
(async () => {
const a = cp.spawn(process.execPath, ["-e", job(4000, "A")], { windowsHide: true, env });
let aOut = ""; a.stdout.on("data", d => aOut += d);
const t0 = Date.now();
while (!/RUN A/.test(aOut) && Date.now() - t0 < 10000) await new Promise(r => setTimeout(r, 100));
assert(/RUN A/.test(aOut), "A got the slot");
assert.strictEqual(H.holders(dir).length, 1);
const b = { stdout: await outOf(cp.spawn(process.execPath, ["-e", job(10, "B")], { windowsHide: true, env })) };
await new Promise(r => setTimeout(r, 300));
assert(/heavy: waiting for A \(test/.test(b.stdout), "B says what it waits for: " + b.stdout);
const runB = +/RUN B (\d+)/.exec(b.stdout)[1], endA = +/END A (\d+)/.exec(aOut)[1];
assert(runB >= endA, "B ran only after A ended");
assert.strictEqual(H.holders(dir).length, 0, "slots released on exit");

// 5 (live): A holds the slot; a low job queues, then a high one; when A ends the high one runs first
{
  const A = cp.spawn(process.execPath, ["-e", job(4000, "A")], { windowsHide: true, env });
  let aO = ""; A.stdout.on("data", d => aO += d);
  const t1 = Date.now();
  while (!/RUN A/.test(aO) && Date.now() - t1 < 10000) await new Promise(r => setTimeout(r, 100));
  const L = outOf(cp.spawn(process.execPath, ["-e", job(500, "L")], { windowsHide: true, env: Object.assign({}, env, { GDLM_HEAVY_PRIORITY: "low" }) }));
  await new Promise(r => setTimeout(r, 1000));
  const Hi = outOf(cp.spawn(process.execPath, ["-e", job(500, "H")], { windowsHide: true, env: Object.assign({}, env, { GDLM_HEAVY_PRIORITY: "high" }) }));
  const [lo, hi] = await Promise.all([L, Hi]);
  const runL = +/RUN L (\d+)/.exec(lo)[1], runH = +/RUN H (\d+)/.exec(hi)[1], endH = +/END H (\d+)/.exec(hi)[1];
  assert(runH < runL && runL >= endH, `the high-priority job ran first (H ${runH}, L ${runL})`);
  assert.strictEqual(H.waiters(dir).length, 0, "waiter files removed");
}

// 7 (live): a waiter from older heavy.js code (no ver: it never takes the second slot) first in line does not hold the
// second slot back: with A running, B starts beside it (2026-11-24: 15 jobs sat behind one such waiter)
{
  const sleeper = cp.spawn(process.execPath, ["-e", "setTimeout(() => {}, 20000)"], { windowsHide: true });
  fs.writeFileSync(path.join(dir, "w" + sleeper.pid + ".json"), JSON.stringify({ pid: sleeper.pid, prio: "high", since: 1, session: "old", cmd: "old.js" }));
  const env2 = Object.assign({}, env, { GDLM_HEAVY_FREE_MB: "9000" });   // room for two jobs whatever this PC's measured job size
  const A = cp.spawn(process.execPath, ["-e", job(4000, "A")], { windowsHide: true, env: env2 });
  let aO = ""; A.stdout.on("data", d => aO += d); const aClosed = new Promise(r => A.on("close", r));
  const t1 = Date.now();
  while (!/RUN A/.test(aO) && Date.now() - t1 < 10000) await new Promise(r => setTimeout(r, 100));
  const bOut = await outOf(cp.spawn(process.execPath, ["-e", job(10, "B")], { windowsHide: true, env: env2 }));
  const runB = +/RUN B (\d+)/.exec(bOut)[1];
  await aClosed;
  const endA = +/END A (\d+)/.exec(aO)[1];
  assert(runB < endA, `B used the second slot past an old-code waiter (B ${runB}, A ended ${endA})`);
  sleeper.kill(); try { fs.unlinkSync(path.join(dir, "w" + sleeper.pid + ".json")); } catch (e) {}
}

// 3
fs.writeFileSync(path.join(dir, "999999.json"), JSON.stringify({ pid: 999999, session: "x", cmd: "dead", start: new Date().toISOString() }));
assert.strictEqual(H.holders(dir).length, 0, "a dead pid's slot is cleared");
// idle priority: a claimed job runs at the lowest priority
const pr = cp.spawnSync(process.execPath, ["-e", `require(${JSON.stringify(path.join(__dirname, "..", "tools", "heavy.js"))}).claim("pr"); console.log("PRIO " + require("os").getPriority())`], { windowsHide: true, env, encoding: "utf8" });
assert(+/PRIO (-?\d+)/.exec(pr.stdout)[1] >= 10, "lowered priority: " + pr.stdout);
const child = `const cp=require("child_process"); require(${JSON.stringify(path.join(__dirname, "..", "tools", "heavy.js"))}).claim("P");
  const r = cp.spawnSync(process.execPath, ["-e", ${JSON.stringify(job(10, "C"))}], { windowsHide: true, encoding: "utf8" }); process.stdout.write(r.stdout);`;
const p = cp.spawnSync(process.execPath, ["-e", child], { windowsHide: true, env, encoding: "utf8", timeout: 20000 });
assert(/RUN C/.test(p.stdout) && !/waiting/.test(p.stdout), "a child runs in its parent's slot: " + p.stdout);
fs.rmSync(dir, { recursive: true, force: true });

// 4
for (const t of ["make", "compose", "score", "solutions", "shoot", "levelmap", "difficulty_solve", "windows", "fairness", "polish", "structures", "tas", "intent", "rules", "reactive"])
  assert(/require\("\.\/heavy\.js"\)\.claim\(\)/.test(fs.readFileSync(path.join(__dirname, "..", "tools", t + ".js"), "utf8")), t + ".js claims the lock");
// wip.js: put never waits on the lock (it writes at once); its background solve (solveJob) claims it
{ const w = fs.readFileSync(path.join(__dirname, "..", "tools", "wip.js"), "utf8"), put = w.slice(w.indexOf('args[0] === "put"'), w.indexOf('args[0] === "solve"'));
  assert(/function solveJob[\s\S]{0,300}heavy\.js"\)\.claim\(/.test(w), "wip.js solve claims the lock");
  assert(!/heavy\.js"\)\.claim\(/.test(put), "wip.js put does not wait on the lock"); }
// 6 (throwaway repos: an origin, a clone that falls behind, another clone that pushes)
{
  const g = (cwd, ...a) => cp.execFileSync("git", a, { windowsHide: true, cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "gdlm-heavy-sync-")), origin = path.join(base, "o.git"), a = path.join(base, "a"), b = path.join(base, "b");
  g(base, "init", "-q", "--bare", "-b", "main", origin);
  g(base, "clone", "-q", origin, b);
  for (const r of [b]) { g(r, "config", "user.email", "t@t"); g(r, "config", "user.name", "t"); }
  fs.mkdirSync(path.join(b, "tools")); fs.writeFileSync(path.join(b, "tools", "x.js"), "1\n");
  g(b, "add", "."); g(b, "commit", "-q", "-m", "first"); g(b, "push", "-q", "origin", "HEAD:main");
  g(base, "clone", "-q", origin, a);
  fs.writeFileSync(path.join(b, "tools", "x.js"), "2\n"); g(b, "commit", "-qam", "tools: the new rule"); g(b, "push", "-q", "origin", "HEAD:main");
  let r = H.syncTree(a);
  assert(r.ff && r.behind === 1 && fs.readFileSync(path.join(a, "tools", "x.js"), "utf8").trim() === "2","a clean tree behind is fast-forwarded: " + JSON.stringify(r));
  fs.writeFileSync(path.join(b, "tools", "x.js"), "3\n"); g(b, "commit", "-qam", "tools: another rule"); g(b, "push", "-q", "origin", "HEAD:main");
  fs.writeFileSync(path.join(a, "tools", "x.js"), "mine\n");   // uncommitted work
  r = H.syncTree(a);
  assert(!r.ff && /1 commit\(s\) behind main/.test(r.warn) && /another rule/.test(r.warn) && fs.readFileSync(path.join(a, "tools", "x.js"), "utf8").trim() === "mine","a dirty tree is warned, not moved: " + JSON.stringify(r));
  fs.rmSync(base, { recursive: true, force: true });
}
// the light lane: short and small jobs get a third slot beside two held ones, one at a time, with LIGHT_MB headroom
{
  assert(H.isLight({ est: 30, mb: 300 }) && !H.isLight({ est: 30, mb: 900 }) && !H.isLight({ est: 300, mb: 300 }) && !H.isLight({ est: 30, mb: null }), "light = measured under 2 min and 500 MB");
  assert(H.lightGo([{ pid: 1 }, { pid: 2 }], 2100, false), "two held slots, 2.1 GB free, game closed: the light job runs");
  assert(!H.lightGo([{ pid: 1 }, { pid: 2, light: true }], 4000, false), "one light job at a time");
  assert(!H.lightGo([{ pid: 1 }], 2100, true) && H.lightGo([{ pid: 1 }], 2600, true), "while the game runs: 2.5 GB free needed");
}
console.log("heavy: ok");
})().catch(e => { console.error(e); process.exit(1); });
