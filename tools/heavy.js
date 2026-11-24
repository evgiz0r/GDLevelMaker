// The one-heavy-job rule, in code. Every heavy tool (a solve, a score, a headless render, a big scan)
// calls claim() as it starts, as its own process:  if (require.main === module) require("./heavy.js").claim();
// claim() waits until it may run, then holds a slot until the process exits.
//   - a slot is a file local/locks/heavy/<pid>.json {pid, session, cmd, start} in the SHARED local/
//     (the real path, so every worktree sees the same folder); a slot whose pid is dead is cleared
//   - "Go more in parallel" (the user, 2026-11-24): 2 slots while the game is closed and a second job would still
//     leave 1.5 GB free (free >= 1.5 GB + one job's measured peak memory, jobMB(): ~3 GB), else 1
//   - never starting while under 1.5 GB is free (it waits for memory too)
//   - while the user plays (GeometryDash.exe runs): 1 slot whatever is free, none under 2 GB free
//   - a FAST LANE: a waiter whose measured runs (local/timings.jsonl) take under 2 min may take a free slot ahead of
//     the long ones -- one lane job at a time, and never ahead of a long job that has waited STARVE_MIN (10 min) or more
//   - every finished job's peak memory (maxRSS) goes to local/timings.jsonl ("mb"), and jobMB() is their 90th percentile
//   - every heavy job runs at the lowest CPU priority (idle), so the game and the desktop always win
//   - while waiting it prints "waiting for <cmd> (<session>), ~N min" (N from local/timings.jsonl)
//   - a child process of a holder (env GDLM_HEAVY_HELD) runs in its parent's slot: no deadlock when
//     a heavy tool runs another one (loop.js -> make.js, difficulty_solve.js all -> one level)
// Waits up to GDLM_HEAVY_WAIT minutes (default 120), then gives up with exit code 75.
// Priority: GDLM_HEAVY_PRIORITY=high|normal|low (or --priority high on the tool's command line); default normal.
//   Waiters register in the lock folder (w<pid>.json); a free slot goes to the highest priority waiting, first
//   come first within one priority. A running job of lower priority with yield points gives its slot back to a
//   higher one that has waited 5 min (see "yield, pause, resume" below; nothing is lost); one without yield points is
//   never stopped, so it holds a high one back by at most itself. High: what the user asked for now;
//   low: batches and measuring that can wait.
// Freshness: once a job has its slot, its worktree is compared with origin/main (git fetch at most once a minute,
//   cached in the lock folder's fetch.json). Behind and clean (no changes to tracked files, nothing of its own
//   unmerged): fast-forward, then run the same command again in this slot, so the tool, lib/ and the rules are
//   all the latest. Behind and not clean (or diverged): a loud warning with the subjects of the tools/lib commits
//   it lacks, and it runs as it is. GDLM_HEAVY_NOSYNC=1 skips it.
// GDLM_HEAVY=off skips all of it (only when the user says so). Status: node tools/heavy.js
// Why: 2026-11-23 the PC hung with 0.2 GB of 16 GB free -- five heavy node jobs from different
// sessions at once, while the rule was only written down. Test: node tests/heavy.js
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
const MIN_FREE_MB = 1500, GAME_MIN_FREE_MB = 2000;
// one heavy job's peak memory: the 90th percentile of measured ones (20+ rows), else 1.5 GB (a solve: 0.8-1.5 GB, CLAUDE.md)
const JOB_MB_DEFAULT = 1500, FAST_SECS = 120, STARVE_MIN = 10;
// LIGHT LANE (the user, 2026-11-24, on the section lab: "Iterating on them like this feels too slow" -- 6 lab builds of
// 4-77 s and 0.2-0.3 GB waited 27 min behind a 36-min solve): a job whose measured runs take under FAST_SECS and peak
// under LIGHT_MB may run as a THIRD slot, beside two held ones, when LIGHT_MB more than the usual floor is free. One
// light job at a time, so the worst extra load is LIGHT_MB.
const LIGHT_MB = 500;
const isLight = x => !!x && x.est != null && x.est < FAST_SECS && x.mb != null && x.mb < LIGHT_MB;
function lightGo(hs, free, gameOn) { return !hs.some(h => h.light) && free >= (gameOn ? GAME_MIN_FREE_MB : MIN_FREE_MB) + LIGHT_MB; }
function jobMB() {
  try { const mbs = require("./jobtime.js").rows().filter(r => r.by === "heavy" && r.mb > 0).map(r => r.mb).sort((a, b) => a - b);
    if (mbs.length >= 20) return Math.max(500, mbs[Math.floor(mbs.length * 0.9)]); } catch (e) {}
  return JOB_MB_DEFAULT;
}
const TWO_SLOTS_MB = MIN_FREE_MB + JOB_MB_DEFAULT;   // the default threshold (tests); decide() takes the measured one

function lockDir() {
  if (process.env.GDLM_LOCKDIR) return process.env.GDLM_LOCKDIR;
  let local = path.join(ROOT, "local");
  try { local = fs.realpathSync(local); } catch (e) {}
  return path.join(local, "locks", "heavy");
}
const freeMB = () => process.env.GDLM_HEAVY_FREE_MB ? +process.env.GDLM_HEAVY_FREE_MB : Math.round(os.freemem() / 1048576);   // Windows: available (free + standby); the env is for tests
const sleepSync = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; } };
function sessionName() {
  if (process.env.GDLM_SESSION) return process.env.GDLM_SESSION;
  const m = /worktrees[\\/]([^\\/]+)/.exec(ROOT);
  return m ? m[1] : "main";
}
// the live holders; stale ones (dead pid, unreadable) are removed
function holders(dir = lockDir()) {
  let files = [];
  try { files = fs.readdirSync(dir).filter(f => /^\d+\.json$/.test(f)); } catch (e) { return []; }
  const out = [];
  for (const f of files) {
    let h = null;
    try { h = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch (e) {}
    if (!h || !alive(h.pid)) { try { fs.unlinkSync(path.join(dir, f)); } catch (e) {} continue; }
    out.push(h);
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}
// priority of this process: env, then a --priority flag
const RANK = { high: 0, normal: 1, low: 2 };
function myPriority() {
  let p = process.env.GDLM_HEAVY_PRIORITY || process.env.HEAVY_PRIORITY || "";
  const i = process.argv.indexOf("--priority"); if (!p && i > 0) p = process.argv[i + 1] || "";
  const m = /^--priority=(\w+)$/.exec(process.argv.find(a => /^--priority=/.test(a)) || ""); if (!p && m) p = m[1];
  return RANK[p] !== undefined ? p : "normal";
}
// the live waiters (w<pid>.json); stale ones are removed
function waiters(dir = lockDir()) {
  let files = [];
  try { files = fs.readdirSync(dir).filter(f => /^w\d+\.json$/.test(f)); } catch (e) { return []; }
  const out = [];
  for (const f of files) {
    let h = null;
    try { h = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch (e) {}
    if (!h || !alive(h.pid)) { try { fs.unlinkSync(path.join(dir, f)); } catch (e) {} continue; }
    out.push(h);
  }
  return out;
}
// who goes first among waiters: higher priority, then who came first (pure: tested)
const before = (a, b) => RANK[a.prio] !== RANK[b.prio] ? RANK[a.prio] < RANK[b.prio] : a.since !== b.since ? a.since < b.since : a.pid < b.pid;
function firstInLine(ws) { return ws.reduce((m, w) => (!m || before(w, m) ? w : m), null); }
const isFast = x => !!x && x.est != null && x.est < FAST_SECS;
// who gets the next free slot (pure: tested): the fast lane first -- the first fast waiter, when no lane job runs and
// no long waiter has waited STARVE_MIN -- else the first in line. Returns { w, lane }.
function pickNext(ws, hs, now) {
  if (!ws.length) return { w: null, lane: false };
  const first = firstInLine(ws);
  if (isFast(first)) return { w: first, lane: false };
  const starved = ws.some(w => !isFast(w) && now - w.since >= STARVE_MIN * 60000);
  const laneBusy = (hs || []).some(h => h.lane);
  const fast = firstInLine(ws.filter(isFast));
  if (fast && !starved && !laneBusy) return { w: fast, lane: true };
  return { w: first, lane: false };
}
// may a new job start? (pure: tested) mb = one job's peak memory (jobMB())
function decide(nHolders, free, gameOn, mb) {
  const slots = !gameOn && free >= MIN_FREE_MB + (mb || JOB_MB_DEFAULT) ? 2 : 1;
  if (nHolders >= slots) return "busy";
  if (free < (gameOn ? GAME_MIN_FREE_MB : MIN_FREE_MB)) return "memory";
  return "go";
}
// is the user playing? (GeometryDash.exe running; GDLM_GAME=1/0 forces it, for tests)
function gameRunning() {
  if (process.env.GDLM_GAME) return process.env.GDLM_GAME === "1";
  try {
    const cmd = process.platform === "win32" ? ["tasklist", ["/FI", "IMAGENAME eq GeometryDash.exe", "/NH"]] : ["ps", ["-A"]];
    return /GeometryDash/i.test(require("child_process").execFileSync(cmd[0], cmd[1], { encoding: "utf8", timeout: 10000, windowsHide: true }));
  } catch (e) { return false; }
}
// lowest CPU priority for this process (Windows: Idle class via libuv), so the game never stutters
function lowPriority() {
  try { os.setPriority(process.pid, 19); } catch (e) { try { os.setPriority(process.pid, 10); } catch (e2) {} }
}
// time left for a holder, from measurements only (tools/jobtime.js: same tool + level + flags): { left (min), basis,
// over, secs } or null = not measured. The estimate is taken when the job gets its slot and kept in its slot file.
function etaOf(h) {
  let est = h.est != null ? { secs: h.est, basis: h.basis } : null;
  if (!est && !("est" in h)) try { est = require("./jobtime.js").estimate(h.cmd); } catch (e) {}
  if (!est) return null;
  const elapsed = h.start ? (Date.now() - Date.parse(h.start)) / 1000 : 0;
  return { left: Math.max(1, Math.round((est.secs - elapsed) / 60)), basis: est.basis, over: elapsed > est.secs * 1.2, secs: est.secs };
}
function minutesLeft(h) { const e = etaOf(h); return e ? e.left : null; }
const describe = h => { const e = etaOf(h); return `${(/tools[\\/].*/.exec(h.cmd) || [h.cmd])[0]} (${h.session}, ${h.prio && h.prio !== "normal" ? h.prio + " priority, " : ""}pid ${h.pid}, ${Math.round((Date.now() - Date.parse(h.start)) / 60000)} min in` +
  (!e ? ", time not measured)" : e.over ? `, past its estimate: ${e.basis})` : `, ~${e.left} min left: ${e.basis})`); };

// is the worktree at root behind origin/main? fast-forward when it is clean. Returns
// { behind, ff: true when moved, warn: the message when it could not, subjects }
function syncTree(root, opts = {}) {
  const git = args => require("child_process").execFileSync("git", args, { cwd: root, encoding: "utf8", timeout: 60000, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }).trim();
  const out = { behind: 0, ff: false, warn: null, subjects: [] };
  try {
    const stamp = opts.stamp, now = Date.now();
    let last = 0; try { last = JSON.parse(fs.readFileSync(stamp, "utf8")).at || 0; } catch (e) {}
    if (!stamp || now - last > 60000) {
      try { git(["fetch", "-q", "origin", "main"]); } catch (e) {}
      if (stamp) try { fs.writeFileSync(stamp, JSON.stringify({ at: now })); } catch (e) {}
    }
    out.behind = +git(["rev-list", "--count", "HEAD..origin/main"]) || 0;
    if (!out.behind) return out;
    out.subjects = git(["log", "--format=%s", "HEAD..origin/main", "--", "tools", "lib"]).split("\n").filter(Boolean);
    const dirty = git(["status", "--porcelain", "--untracked-files=no"]) !== "";
    if (!dirty) {
      try { git(["merge", "-q", "--ff-only", "origin/main"]); out.ff = true; return out; } catch (e) {}
    }
    out.warn = `this job runs on code ${out.behind} commit(s) behind main (${dirty ? "uncommitted changes" : "the branch has its own commits"}: merge origin/main)` +
      (out.subjects.length ? "; tools/lib changes it lacks:\n    " + out.subjects.slice(0, 8).map(s => s.slice(0, 110)).join("\n    ") : "");
  } catch (e) {}
  return out;
}

let held = null;
// ---- yield, pause, resume (the user, 2026-11-24: "We can't pause solver work in the middle if needed? We should be able
// to stop and resume any search, no?") ----
// A job pauses IN ITS OWN PROCESS: at a yield point (yieldPoint(), also globalThis.gdlmYield, which lib/physics.js's
// run / solve and lib/natural.js's passes call) it gives its slot back, waits, takes a slot again and carries on where it
// was -- nothing is saved or redone, so a pause loses no work, whatever the job. Requests are files in the lock folder:
// y<slot pid>.json {kind: "yield" | "pause", by, reason, at}.
//   - yield: a waiter of HIGHER priority that is first in line and has waited YIELD_MIN (GDLM_HEAVY_YIELD_MIN, default
//     5 min) with no free slot asks the lowest-priority running job that has yield points; that job gives the slot back
//     and queues again at its own priority (its old place in line), so the waiter goes first.
//   - pause: `node tools/heavy.js pause <pid | words of its command>` -- the job gives the slot back and waits until
//     `node tools/heavy.js resume <...>` (or the request file goes). While paused it holds no slot but keeps its memory.
// A request reaches a job at its next yield point (within ~2 s of work in the solvers and the planner). A job with no
// yield points ("yields" missing in its slot file) cannot pause: it finishes, or is stopped and re-run (difficulty_solve
// resumes from its checkpoint; saved_routes keeps every route it fixed).
const YIELD_MIN = () => +(process.env.GDLM_HEAVY_YIELD_MIN || 5);
let slot = null;   // { dir, pid (the slot file's pid: this process, or the parent whose slot it runs in), own, rec, me }
const reqFile = (dir, pid) => path.join(dir, "y" + pid + ".json");
function readReq(dir, pid) { try { return JSON.parse(fs.readFileSync(reqFile(dir, pid), "utf8")); } catch (e) { return null; } }
// the live requests; ones for a dead pid are removed
function requests(dir = lockDir()) {
  let files = []; try { files = fs.readdirSync(dir).filter(f => /^y\d+\.json$/.test(f)); } catch (e) { return []; }
  const out = [];
  for (const f of files) {
    let r = null; try { r = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch (e) {}
    const pid = +/\d+/.exec(f)[0];
    if (!r || !alive(pid)) { try { fs.unlinkSync(path.join(dir, f)); } catch (e) {} continue; }
    out.push(Object.assign({ pid }, r));
  }
  return out;
}
// the job a long-waiting waiter w asks to yield (pure: tested): the lowest priority below w's, with yield points, not
// asked already, holding its slot over a minute (so two jobs never swap back and forth)
function yieldVictim(w, hs, reqs, now, waitedMin) {
  if (waitedMin < YIELD_MIN()) return null;
  const asked = new Set((reqs || []).map(r => r.pid));
  const c = hs.filter(h => h.yields && !asked.has(h.pid) && RANK[h.prio || "normal"] > RANK[w.prio] && now - Date.parse(h.start) > +(process.env.GDLM_HEAVY_YIELD_HOLD_MS || 60000));
  return c.sort((a, b) => RANK[b.prio || "normal"] - RANK[a.prio || "normal"] || Date.parse(b.start) - Date.parse(a.start))[0] || null;
}
const short = cmd => (/tools[\\/].*|tests[\\/].*/.exec(cmd) || [cmd])[0];
// wait for a slot (the queue, the lanes, memory); returns { lane, light } once this process may run
function waitTurn(dir, me) {
  const mutex = path.join(dir, "_mutex"), limit = Date.now() + (+(process.env.GDLM_HEAVY_WAIT || 120)) * 60000, MB = jobMB();
  const wfile = path.join(dir, "w" + process.pid + ".json");
  const unwait = () => { try { fs.unlinkSync(wfile); } catch (e) {} };
  try { fs.writeFileSync(wfile, JSON.stringify(me)); } catch (e) {}
  process.on("exit", unwait);
  let lastMsg = "", lastAt = 0;
  for (;;) {
    // check-and-take under a short mutex (exclusive create), so two starting at once cannot both get in
    let got = null;
    try {
      const fd = fs.openSync(mutex, "wx");
      try {
        const hs = holders(dir), free = freeMB(), game = gameRunning();
        let d = decide(hs.filter(h => !h.light).length, free, game, MB);
        const ws0 = waiters(dir), ws1 = ws0.some(w => w.pid === me.pid) ? ws0 : ws0.concat([me]);
        const ws = hs.length ? ws1.filter(w => (w.ver || 0) >= 2) : ws1, pick = pickNext(ws, hs, Date.now()), first = pick.w;
        if (d === "go" && first && first.pid !== me.pid) d = "queue";
        let light = false;
        if (d !== "go" && d !== "memory" && isLight(me) && lightGo(hs, free, game)) { d = "go"; light = true; }
        if (d === "go") {
          got = { lane: pick.lane && !light, light };
          if (light) console.log(`heavy: light lane (measured under ${FAST_SECS / 60} min and ${LIGHT_MB} MB): a third slot beside the long jobs`);
          else if (pick.lane) console.log(`heavy: fast lane (measured under ${FAST_SECS / 60} min): going ahead of the long jobs`);
          unwait();
        } else {
          // first in line and waited long: ask a lower-priority job with yield points to give its slot back
          if (d === "busy" && first && first.pid === me.pid) {
            const v = yieldVictim(me, hs, requests(dir), Date.now(), (Date.now() - me.since) / 60000);
            if (v) try {
              fs.writeFileSync(reqFile(dir, v.pid), JSON.stringify({ kind: "yield", by: `${me.session} pid ${me.pid}`, reason: `${me.prio} priority ${short(me.cmd)} waited ${Math.round((Date.now() - me.since) / 60000)} min`, at: new Date().toISOString() }));
              console.log(`heavy: asked ${describe(v)} to yield its slot`);
            } catch (e) {}
          }
          const msg = d === "busy" ? `waiting for ${hs.map(describe).join("; ")}${game ? " (the game runs: one job at a time)" : ""}`
            : d === "queue" ? `waiting: ${first.prio} priority ${short(first.cmd)} (${first.session}) goes first` : `waiting for memory: ${free} MB free, need ${game ? GAME_MIN_FREE_MB + " MB while the game runs" : MIN_FREE_MB + " MB"}`;
          if (msg.replace(/\d+ min in.*$/, "") !== lastMsg || Date.now() - lastAt > 120000) { console.log(`heavy: ${msg}`); lastMsg = msg.replace(/\d+ min in.*$/, ""); lastAt = Date.now(); }
        }
      } finally { fs.closeSync(fd); try { fs.unlinkSync(mutex); } catch (e) { /* removed by a waiter that took it for stale (OneDrive/Windows can be slow): fine */ } }
    } catch (e) {
      if (e.code !== "EEXIST" && e.code !== "EPERM" && e.code !== "EBUSY" && e.code !== "ENOENT") throw e;   // EPERM/EBUSY: Windows while another process deletes it
      try { if (Date.now() - fs.statSync(mutex).mtimeMs > 15000) fs.unlinkSync(mutex); } catch (e2) {}   // a crashed holder of the mutex
    }
    if (got) return got;
    if (Date.now() > limit) { console.log(`heavy: gave up after ${process.env.GDLM_HEAVY_WAIT || 120} min waiting; try later`); process.exit(75); }
    sleepSync(+(process.env.GDLM_HEAVY_POLL_MS || 0) || 3000 + Math.random() * 2000);
  }
}
const writeSlot = (dir, pid, rec) => { const f = path.join(dir, pid + ".json"); fs.writeFileSync(f, JSON.stringify(rec)); return f; };
let lastYieldCheck = 0, marked = false, pausedMs = 0;   // pausedMs: time without a slot, left out of the measured time
// call it often from long work: cheap (a clock read; a file read at most every 2 s). Returns true when the job paused.
function yieldPoint() {
  if (!slot) return false;
  if (!marked) {   // the slot file says this job can yield (only such jobs are asked)
    marked = true;
    try { const f = path.join(slot.dir, slot.pid + ".json"), r = JSON.parse(fs.readFileSync(f, "utf8")); if (!r.yields) { r.yields = true; fs.writeFileSync(f, JSON.stringify(r)); } slot.rec = r; } catch (e) {}
  }
  const now = Date.now();
  if (now - lastYieldCheck < +(process.env.GDLM_HEAVY_YIELD_CHECK_MS || 2000)) return false;
  lastYieldCheck = now;
  const req = readReq(slot.dir, slot.pid);
  if (!req) return false;
  const f = path.join(slot.dir, slot.pid + ".json");
  let rec = slot.rec; try { rec = JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) {}
  try { fs.unlinkSync(f); } catch (e) {}
  if (slot.own) held = null;
  console.log(`heavy: ${req.kind === "pause" ? "PAUSED" : "yielding its slot"} (${req.reason || "asked by " + req.by}); nothing is lost: it carries on from here`);
  if (req.kind === "pause") { while (readReq(slot.dir, slot.pid)) sleepSync(+(process.env.GDLM_HEAVY_POLL_MS || 0) || 2000); }
  else { try { fs.unlinkSync(reqFile(slot.dir, slot.pid)); } catch (e) {} }
  const t1 = Date.now();
  waitTurn(slot.dir, Object.assign({}, slot.me, { pid: process.pid }));
  rec = Object.assign({}, rec, { yields: true, yielded: (rec.yielded || 0) + 1 });
  const file = writeSlot(slot.dir, slot.pid, rec);
  if (slot.own) held = file;
  slot.rec = rec;
  pausedMs += Date.now() - now;
  console.log(`heavy: resumed after ${((Date.now() - now) / 1000).toFixed(0)} s (${((Date.now() - t1) / 1000).toFixed(0)} s of it waiting for a slot)`);
  return true;
}
// heavy.js pause|resume|yield <pid | words of the command>: the request file for each running job that matches
function request(kind, what) {
  const dir = lockDir(), hs = holders(dir), paused = requests(dir).filter(r => r.kind === "pause");
  const match = x => what && (String(x.pid) === what || (x.cmd || "").includes(what));
  if (kind === "resume") {
    const rs = paused.filter(r => String(r.pid) === what || (r.cmd || "").includes(what) || !what);
    for (const r of rs) { try { fs.unlinkSync(reqFile(dir, r.pid)); } catch (e) {} console.log(`resumed pid ${r.pid} ${short(r.cmd || "")}: it takes a slot as one is free`); }
    if (!rs.length) console.log(`no paused job matches "${what || ""}"`);
    return rs.length;
  }
  const hit = hs.filter(match);
  if (!hit.length) { console.log(`no running heavy job matches "${what || ""}" (node tools/heavy.js lists them)`); return 0; }
  for (const h of hit) {
    fs.writeFileSync(reqFile(dir, h.pid), JSON.stringify({ kind, by: "heavy.js " + kind, reason: kind === "pause" ? "paused by hand: node tools/heavy.js resume " + h.pid : "asked by hand", at: new Date().toISOString(), cmd: h.cmd }));
    console.log(`${kind} asked of ${describe(h)}${h.yields ? ": it stops at its next yield point (seconds)" : ": NO YIELD POINTS seen in it yet -- it stops at its first one, or finishes; stopping it (kill) loses the item in progress"}`);
  }
  return hit.length;
}
function claim(label) {
  if (process.env.GDLM_HEAVY === "off" || held) return;
  lowPriority();   // first of all, also while waiting and in a parent's slot
  const dir = lockDir();
  const cmd = label || process.argv.slice(1).map(a => path.relative(ROOT, a).startsWith("..") ? a : path.relative(ROOT, a).replace(/\\/g, "/")).join(" ");
  if (process.env.GDLM_HEAVY_HELD && alive(+process.env.GDLM_HEAVY_HELD)) {   // in the parent's slot: it yields that slot
    const ppid = +process.env.GDLM_HEAVY_HELD;
    let rec = null; try { rec = JSON.parse(fs.readFileSync(path.join(dir, ppid + ".json"), "utf8")); } catch (e) {}
    if (rec) { slot = { dir, pid: ppid, own: false, rec, me: { pid: process.pid, prio: rec.prio || myPriority(), since: Date.parse(rec.start) || Date.now(), session: rec.session, cmd: rec.cmd, est: rec.est, mb: null, ver: 2 } }; globalThis.gdlmYield = yieldPoint; }
    return;
  }
  fs.mkdirSync(dir, { recursive: true });
  const waitStart = Date.now(), prio = myPriority();
  let est = null;
  try { est = require("./jobtime.js").estimate(cmd); } catch (e) {}
  // ver 2: this waiter uses the second slot when decide() allows it. A waiter without it runs older heavy.js code (one
  // slot unless 6 GB free): put first in line it never took the free second slot, and every newer job queued behind
  // it (2026-11-24: 15 jobs idle for 20 min behind one). Such a waiter is first in line only when no job runs.
  const me = { pid: process.pid, prio, since: waitStart, session: sessionName(), cmd, est: est ? Math.round(est.secs) : null, mb: est ? est.mb : null, ver: 2 };
  const got = waitTurn(dir, me);
  const srec = { pid: process.pid, session: sessionName(), cmd, prio, lane: got.lane, light: got.light, start: new Date().toISOString(), freeMB: freeMB(), est: est ? Math.round(est.secs) : null, basis: est ? est.basis : null };
  held = writeSlot(dir, process.pid, srec);
  slot = { dir, pid: process.pid, own: true, rec: srec, me };
  globalThis.gdlmYield = yieldPoint;
  const waited = (Date.now() - waitStart) / 1000;
  if (waited > 2) console.log(`heavy: got the slot after waiting ${waited.toFixed(0)} s`);   // tools/loop.js leaves this out of the step's time
  process.env.GDLM_HEAVY_HELD = String(process.pid);   // children run in this slot
  // every finished heavy job's real duration (from getting the slot) with the estimate it had -> local/timings.jsonl
  // (tools/jobtime.js; `node tools/jobtime.js recent` shows estimate vs actual)
  const t0 = Date.now(), JT = require("./jobtime.js");
  let recorded = false;
  const rec = ok => { if (recorded || process.env.GDLM_HEAVY_NOREC === "1") return; recorded = true;
    let mb = null; try { mb = Math.round(process.resourceUsage().maxRSS / 1024); } catch (e) {}
    try { const r = JT.record(cmd, t0 + pausedMs, ok, est, { session: sessionName(), mb });
      if (r.secs > 30) process.stderr.write(`heavy: took ${JT.fmt(r.secs)}${est ? " (estimate " + JT.fmt(est.secs) + ": " + est.basis + ")" : " (no estimate: not measured before)"}\n`); } catch (e) {} };
  process.on("exit", code => rec(code === 0));
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]) process.on(sig, () => rec(false));
  if (process.env.GDLM_HEAVY_NOSYNC !== "1" && !label) {
    const r = syncTree(ROOT, { stamp: path.join(dir, "fetch.json") });
    if (r.warn) console.log("\n!!! heavy: " + r.warn + "\n");
    else if (r.ff) {
      // the code changed under this process: run the same command again, new code, in this slot
      console.log(`heavy: fast-forwarded ${r.behind} commit(s) from origin/main; running again on the new code`);
      const ch = require("child_process").spawnSync(process.execPath, process.argv.slice(1), { windowsHide: true, stdio: "inherit", env: Object.assign({}, process.env, { GDLM_HEAVY_NOSYNC: "1" }) });
      process.exit(ch.status === null ? 1 : ch.status);
    }
  }
  const release = () => { if (held) { try { fs.unlinkSync(held); } catch (e) {} held = null; } };
  process.on("exit", release);
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]) process.on(sig, () => { release(); process.exit(130); });
}
const release = () => { if (held) { try { fs.unlinkSync(held); } catch (e) {} held = null; delete process.env.GDLM_HEAVY_HELD; } };

module.exports = { claim, release, yieldPoint, request, requests, yieldVictim, syncTree, holders, waiters, firstInLine, pickNext, isFast, isLight, lightGo, LIGHT_MB, jobMB, FAST_SECS, STARVE_MIN, myPriority, decide, gameRunning, lowPriority, lockDir, freeMB, describe, minutesLeft, etaOf, RANK, MIN_FREE_MB, TWO_SLOTS_MB, GAME_MIN_FREE_MB };
if (require.main === module && /^(pause|resume|yield)$/.test(process.argv[2] || "")) {
  process.exit(request(process.argv[2], process.argv.slice(3).join(" ")) ? 0 : 1);
} else if (require.main === module) {
  const hs = holders();
  const fr = freeMB(), game = gameRunning(), mb = jobMB(), slots = !game && fr >= MIN_FREE_MB + mb ? 2 : 1;
  console.log(`${fr} MB free${game ? ", the game runs" : ""}; ${slots} slot(s) now (2 when the game is closed and ${MIN_FREE_MB + mb} MB are free; one job ~${mb} MB); ${hs.length ? hs.length + " heavy job(s): " + hs.map(h => (h.light ? "[light lane] " : h.lane ? "[fast lane] " : "") + describe(h)).join("; ") : "no heavy job running"}  (lock dir ${lockDir()})`);
  const ws = waiters().sort((a, b) => (before(a, b) ? -1 : 1));
  if (ws.length) console.log("waiting, in order: " + ws.map(w => `${(/tools[\\/].*/.exec(w.cmd) || [w.cmd])[0]} (${w.session}, ${w.prio}${isFast(w) ? ", fast" : ""}, ${Math.round((Date.now() - w.since) / 60000)} min)`).join("; "));
  const ps = requests().filter(r => r.kind === "pause");
  if (ps.length) console.log("PAUSED (no slot; node tools/heavy.js resume <pid>): " + ps.map(r => `pid ${r.pid} ${short(r.cmd || "")} (since ${r.at})`).join("; "));
}
