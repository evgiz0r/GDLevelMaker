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
//   come first within one priority. A running job is never stopped, so a long low-priority job (batch
//   re-solves, measuring runs) holds a high one back by at most itself. High: what the user asked for now;
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
function claim(label) {
  if (process.env.GDLM_HEAVY === "off" || held) return;
  lowPriority();   // first of all, also while waiting and in a parent's slot
  if (process.env.GDLM_HEAVY_HELD && alive(+process.env.GDLM_HEAVY_HELD)) return;   // in the parent's slot
  const dir = lockDir(), mutex = path.join(dir, "_mutex");
  fs.mkdirSync(dir, { recursive: true });
  const cmd = label || process.argv.slice(1).map(a => path.relative(ROOT, a).startsWith("..") ? a : path.relative(ROOT, a).replace(/\\/g, "/")).join(" ");
  const limit = Date.now() + (+(process.env.GDLM_HEAVY_WAIT || 120)) * 60000;
  let lastMsg = "", lastAt = 0;
  const waitStart = Date.now(), prio = myPriority();
  let est = null;
  try { est = require("./jobtime.js").estimate(cmd); } catch (e) {}
  const me = { pid: process.pid, prio, since: waitStart, session: sessionName(), cmd, est: est ? Math.round(est.secs) : null };
  const MB = jobMB();
  const wfile = path.join(dir, "w" + process.pid + ".json");
  const unwait = () => { try { fs.unlinkSync(wfile); } catch (e) {} };
  try { fs.writeFileSync(wfile, JSON.stringify(me)); } catch (e) {}
  process.on("exit", unwait);
  for (;;) {
    // check-and-take under a short mutex (exclusive create), so two starting at once cannot both get in
    let got = false;
    try {
      const fd = fs.openSync(mutex, "wx");
      try {
        const hs = holders(dir), free = freeMB(), game = gameRunning();
        let d = decide(hs.length, free, game, MB);
        const ws = waiters(dir), pick = pickNext(ws.some(w => w.pid === me.pid) ? ws : ws.concat([me]), hs, Date.now()), first = pick.w;
        if (d === "go" && first && first.pid !== me.pid) d = "queue";
        if (d === "go") {
          held = path.join(dir, process.pid + ".json");
          fs.writeFileSync(held, JSON.stringify({ pid: process.pid, session: sessionName(), cmd, prio, lane: pick.lane, start: new Date().toISOString(), freeMB: free, est: est ? Math.round(est.secs) : null, basis: est ? est.basis : null }));
          if (pick.lane) console.log(`heavy: fast lane (measured under ${FAST_SECS / 60} min): going ahead of the long jobs`);
          got = true; unwait();
        } else {
          const msg = d === "busy" ? `waiting for ${hs.map(describe).join("; ")}${game ? " (the game runs: one job at a time)" : ""}`
            : d === "queue" ? `waiting: ${first.prio} priority ${(/tools[\\/].*/.exec(first.cmd) || [first.cmd])[0]} (${first.session}) goes first` : `waiting for memory: ${free} MB free, need ${game ? GAME_MIN_FREE_MB + " MB while the game runs" : MIN_FREE_MB + " MB"}`;
          if (msg.replace(/\d+ min in.*$/, "") !== lastMsg || Date.now() - lastAt > 120000) { console.log(`heavy: ${msg}`); lastMsg = msg.replace(/\d+ min in.*$/, ""); lastAt = Date.now(); }
        }
      } finally { fs.closeSync(fd); try { fs.unlinkSync(mutex); } catch (e) { /* removed by a waiter that took it for stale (OneDrive/Windows can be slow): fine */ } }
    } catch (e) {
      if (e.code !== "EEXIST" && e.code !== "EPERM" && e.code !== "EBUSY" && e.code !== "ENOENT") throw e;   // EPERM/EBUSY: Windows while another process deletes it
      try { if (Date.now() - fs.statSync(mutex).mtimeMs > 15000) fs.unlinkSync(mutex); } catch (e2) {}   // a crashed holder of the mutex
    }
    if (got) break;
    if (Date.now() > limit) { console.log(`heavy: gave up after ${process.env.GDLM_HEAVY_WAIT || 120} min waiting; try later`); process.exit(75); }
    sleepSync(3000 + Math.random() * 2000);
  }
  const waited = (Date.now() - waitStart) / 1000;
  if (waited > 2) console.log(`heavy: got the slot after waiting ${waited.toFixed(0)} s`);   // tools/loop.js leaves this out of the step's time
  process.env.GDLM_HEAVY_HELD = String(process.pid);   // children run in this slot
  // every finished heavy job's real duration (from getting the slot) with the estimate it had -> local/timings.jsonl
  // (tools/jobtime.js; `node tools/jobtime.js recent` shows estimate vs actual)
  const t0 = Date.now(), JT = require("./jobtime.js");
  let recorded = false;
  const rec = ok => { if (recorded || process.env.GDLM_HEAVY_NOREC === "1") return; recorded = true;
    let mb = null; try { mb = Math.round(process.resourceUsage().maxRSS / 1024); } catch (e) {}
    try { const r = JT.record(cmd, t0, ok, est, { session: sessionName(), mb });
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

module.exports = { claim, release, syncTree, holders, waiters, firstInLine, pickNext, isFast, jobMB, FAST_SECS, STARVE_MIN, myPriority, decide, gameRunning, lowPriority, lockDir, freeMB, describe, minutesLeft, etaOf, RANK, MIN_FREE_MB, TWO_SLOTS_MB, GAME_MIN_FREE_MB };
if (require.main === module) {
  const hs = holders();
  const fr = freeMB(), game = gameRunning(), mb = jobMB(), slots = !game && fr >= MIN_FREE_MB + mb ? 2 : 1;
  console.log(`${fr} MB free${game ? ", the game runs" : ""}; ${slots} slot(s) now (2 when the game is closed and ${MIN_FREE_MB + mb} MB are free; one job ~${mb} MB); ${hs.length ? hs.length + " heavy job(s): " + hs.map(h => (h.lane ? "[fast lane] " : "") + describe(h)).join("; ") : "no heavy job running"}  (lock dir ${lockDir()})`);
  const ws = waiters().sort((a, b) => (before(a, b) ? -1 : 1));
  if (ws.length) console.log("waiting, in order: " + ws.map(w => `${(/tools[\\/].*/.exec(w.cmd) || [w.cmd])[0]} (${w.session}, ${w.prio}${isFast(w) ? ", fast" : ""}, ${Math.round((Date.now() - w.since) / 60000)} min)`).join("; "));
}
