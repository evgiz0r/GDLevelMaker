// node tests/heavy.js  -- the one-heavy-job lock (tools/heavy.js), ~15 s, in a temp lock folder
// 1. decide: 1 slot, 2 above 6 GB free, none under 1.5 GB; while the game runs 1 slot and none under 2 GB
// 2. a second job waits ("waiting for ...") while the first holds the slot, and runs after it exits
// 3. a claimed job runs at idle priority; a slot whose pid is dead is cleared; a child of a holder (GDLM_HEAVY_HELD) runs in its slot
// 4. every heavy tool claims the lock itself
// 5. priority: a free slot goes to the highest-priority waiter (GDLM_HEAVY_PRIORITY), first come within one
const assert = require("assert"), fs = require("fs"), path = require("path"), os = require("os"), cp = require("child_process");
const H = require("../tools/heavy.js");

// 1
assert.strictEqual(H.decide(0, 4000), "go");
assert.strictEqual(H.decide(1, 4000), "busy");
assert.strictEqual(H.decide(1, 7000), "go");
assert.strictEqual(H.decide(2, 9000), "busy");
assert.strictEqual(H.decide(0, 1000), "memory");
assert.strictEqual(H.decide(1, 9000, true), "busy", "one job while the game runs");
assert.strictEqual(H.decide(0, 1800, true), "memory", "2 GB free while the game runs");
assert.strictEqual(H.decide(0, 1800, false), "go");
// 5 (pure): high before normal before low; first come within one priority
assert.strictEqual(H.firstInLine([{ pid: 1, prio: "low", since: 1 }, { pid: 2, prio: "high", since: 5 }, { pid: 3, prio: "normal", since: 2 }]).pid, 2);
assert.strictEqual(H.firstInLine([{ pid: 4, prio: "normal", since: 9 }, { pid: 5, prio: "normal", since: 3 }]).pid, 5);

// 2
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gdlm-heavy-test-"));
const env = Object.assign({}, process.env, { GDLM_LOCKDIR: dir, GDLM_HEAVY_FREE_MB: "4000", GDLM_SESSION: "test", GDLM_GAME: "0" });
delete env.GDLM_HEAVY_HELD; delete env.GDLM_HEAVY;
const job = (ms, tag) => `require(${JSON.stringify(path.join(__dirname, "..", "tools", "heavy.js"))}).claim(${JSON.stringify(tag)}); console.log("RUN ${tag} " + Date.now()); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ${ms}); console.log("END ${tag} " + Date.now());`;
const outOf = ch => new Promise(res => { let o = ""; ch.stdout.on("data", d => o += d); ch.on("close", () => res(o)); });
(async () => {
const a = cp.spawn(process.execPath, ["-e", job(4000, "A")], { env });
let aOut = ""; a.stdout.on("data", d => aOut += d);
const t0 = Date.now();
while (!/RUN A/.test(aOut) && Date.now() - t0 < 10000) await new Promise(r => setTimeout(r, 100));
assert(/RUN A/.test(aOut), "A got the slot");
assert.strictEqual(H.holders(dir).length, 1);
const b = { stdout: await outOf(cp.spawn(process.execPath, ["-e", job(10, "B")], { env })) };
await new Promise(r => setTimeout(r, 300));
assert(/heavy: waiting for A \(test/.test(b.stdout), "B says what it waits for: " + b.stdout);
const runB = +/RUN B (\d+)/.exec(b.stdout)[1], endA = +/END A (\d+)/.exec(aOut)[1];
assert(runB >= endA, "B ran only after A ended");
assert.strictEqual(H.holders(dir).length, 0, "slots released on exit");

// 5 (live): A holds the slot; a low job queues, then a high one; when A ends the high one runs first
{
  const A = cp.spawn(process.execPath, ["-e", job(4000, "A")], { env });
  let aO = ""; A.stdout.on("data", d => aO += d);
  const t1 = Date.now();
  while (!/RUN A/.test(aO) && Date.now() - t1 < 10000) await new Promise(r => setTimeout(r, 100));
  const L = outOf(cp.spawn(process.execPath, ["-e", job(500, "L")], { env: Object.assign({}, env, { GDLM_HEAVY_PRIORITY: "low" }) }));
  await new Promise(r => setTimeout(r, 1000));
  const Hi = outOf(cp.spawn(process.execPath, ["-e", job(500, "H")], { env: Object.assign({}, env, { GDLM_HEAVY_PRIORITY: "high" }) }));
  const [lo, hi] = await Promise.all([L, Hi]);
  const runL = +/RUN L (\d+)/.exec(lo)[1], runH = +/RUN H (\d+)/.exec(hi)[1], endH = +/END H (\d+)/.exec(hi)[1];
  assert(runH < runL && runL >= endH, `the high-priority job ran first (H ${runH}, L ${runL})`);
  assert.strictEqual(H.waiters(dir).length, 0, "waiter files removed");
}

// 3
fs.writeFileSync(path.join(dir, "999999.json"), JSON.stringify({ pid: 999999, session: "x", cmd: "dead", start: new Date().toISOString() }));
assert.strictEqual(H.holders(dir).length, 0, "a dead pid's slot is cleared");
// idle priority: a claimed job runs at the lowest priority
const pr = cp.spawnSync(process.execPath, ["-e", `require(${JSON.stringify(path.join(__dirname, "..", "tools", "heavy.js"))}).claim("pr"); console.log("PRIO " + require("os").getPriority())`], { env, encoding: "utf8" });
assert(+/PRIO (-?\d+)/.exec(pr.stdout)[1] >= 10, "lowered priority: " + pr.stdout);
const child = `const cp=require("child_process"); require(${JSON.stringify(path.join(__dirname, "..", "tools", "heavy.js"))}).claim("P");
  const r = cp.spawnSync(process.execPath, ["-e", ${JSON.stringify(job(10, "C"))}], { encoding: "utf8" }); process.stdout.write(r.stdout);`;
const p = cp.spawnSync(process.execPath, ["-e", child], { env, encoding: "utf8", timeout: 20000 });
assert(/RUN C/.test(p.stdout) && !/waiting/.test(p.stdout), "a child runs in its parent's slot: " + p.stdout);
fs.rmSync(dir, { recursive: true, force: true });

// 4
for (const t of ["make", "compose", "score", "solutions", "shoot", "levelmap", "difficulty_solve", "windows", "fairness", "polish", "structures", "tas"])
  assert(/require\("\.\/heavy\.js"\)\.claim\(\)/.test(fs.readFileSync(path.join(__dirname, "..", "tools", t + ".js"), "utf8")), t + ".js claims the lock");
assert(/heavy\.js"\)\.claim\(\)/.test(fs.readFileSync(path.join(__dirname, "..", "tools", "wip.js"), "utf8")), "wip.js put claims the lock");
console.log("heavy: ok");
})().catch(e => { console.error(e); process.exit(1); });
