// The one-heavy-job rule, in code. Every heavy tool (a solve, a score, a headless render, a big scan)
// calls claim() as it starts, as its own process:  if (require.main === module) require("./heavy.js").claim();
// claim() waits until it may run, then holds a slot until the process exits.
//   - a slot is a file local/locks/heavy/<pid>.json {pid, session, cmd, start} in the SHARED local/
//     (the real path, so every worktree sees the same folder); a slot whose pid is dead is cleared
//   - at most 1 heavy job at a time on this 16 GB PC; 2 while more than 6 GB is free
//   - and never starting while under 1.5 GB is free (it waits for memory too)
//   - while waiting it prints "waiting for <cmd> (<session>), ~N min" (N from local/timings.jsonl)
//   - a child process of a holder (env GDLM_HEAVY_HELD) runs in its parent's slot: no deadlock when
//     a heavy tool runs another one (loop.js -> make.js, difficulty_solve.js all -> one level)
// Waits up to GDLM_HEAVY_WAIT minutes (default 120), then gives up with exit code 75.
// GDLM_HEAVY=off skips all of it (only when the user says so). Status: node tools/heavy.js
// Why: 2026-11-23 the PC hung with 0.2 GB of 16 GB free -- five heavy node jobs from different
// sessions at once, while the rule was only written down. Test: node tests/heavy.js
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
const MIN_FREE_MB = 1500, TWO_SLOTS_MB = 6000;

function lockDir() {
  if (process.env.GDLM_LOCKDIR) return process.env.GDLM_LOCKDIR;
  let local = path.join(ROOT, "local");
  try { local = fs.realpathSync(local); } catch (e) {}
  return path.join(local, "locks", "heavy");
}
const freeMB = () => Math.round(os.freemem() / 1048576);   // Windows: available (free + standby)
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
// may a new job start? (pure: tested)
function decide(nHolders, free) {
  const slots = free > TWO_SLOTS_MB ? 2 : 1;
  if (nHolders >= slots) return "busy";
  if (free < MIN_FREE_MB) return "memory";
  return "go";
}
// rough minutes left for a holder, from the time table
function minutesLeft(h) {
  const tool = (/tools[\\/](\w+)\.js/.exec(h.cmd) || [])[1] || "";
  const step = { make: "make", compose: "compose", score: "score", shoot: "render", levelmap: "map", wip: "wip", difficulty_solve: "solve-official" }[tool];
  const elapsed = (Date.now() - Date.parse(h.start)) / 1000;
  let typical = NaN;
  try {
    const rows = fs.readFileSync(path.join(ROOT, "local", "timings.jsonl"), "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l)).filter(r => r.step === step && r.ok !== false);
    const s = rows.map(r => r.secs).sort((a, b) => a - b); if (s.length) typical = s[s.length >> 1];
  } catch (e) {}
  return isNaN(typical) ? null : Math.max(1, Math.round((typical - elapsed) / 60));
}
const describe = h => `${(/tools[\\/].*/.exec(h.cmd) || [h.cmd])[0]} (${h.session}, pid ${h.pid}, ${Math.round((Date.now() - Date.parse(h.start)) / 60000)} min in` +
  (minutesLeft(h) ? `, ~${minutesLeft(h)} min left)` : ")");

let held = null;
function claim(label) {
  if (process.env.GDLM_HEAVY === "off" || held) return;
  if (process.env.GDLM_HEAVY_HELD && alive(+process.env.GDLM_HEAVY_HELD)) return;   // in the parent's slot
  const dir = lockDir(), mutex = path.join(dir, "_mutex");
  fs.mkdirSync(dir, { recursive: true });
  const cmd = label || process.argv.slice(1).map(a => path.relative(ROOT, a).startsWith("..") ? a : path.relative(ROOT, a).replace(/\\/g, "/")).join(" ");
  const limit = Date.now() + (+(process.env.GDLM_HEAVY_WAIT || 120)) * 60000;
  let lastMsg = "", lastAt = 0;
  for (;;) {
    // check-and-take under a short mutex (exclusive create), so two starting at once cannot both get in
    let got = false;
    try {
      const fd = fs.openSync(mutex, "wx");
      try {
        const hs = holders(dir), free = freeMB(), d = decide(hs.length, free);
        if (d === "go") {
          held = path.join(dir, process.pid + ".json");
          fs.writeFileSync(held, JSON.stringify({ pid: process.pid, session: sessionName(), cmd, start: new Date().toISOString(), freeMB: free }));
          got = true;
        } else {
          const msg = d === "busy" ? `waiting for ${hs.map(describe).join("; ")}` : `waiting for memory: ${free} MB free, need ${MIN_FREE_MB} MB`;
          if (msg.replace(/\d+ min in.*$/, "") !== lastMsg || Date.now() - lastAt > 120000) { console.log(`heavy: ${msg}`); lastMsg = msg.replace(/\d+ min in.*$/, ""); lastAt = Date.now(); }
        }
      } finally { fs.closeSync(fd); fs.unlinkSync(mutex); }
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      try { if (Date.now() - fs.statSync(mutex).mtimeMs > 15000) fs.unlinkSync(mutex); } catch (e2) {}   // a crashed holder of the mutex
    }
    if (got) break;
    if (Date.now() > limit) { console.log(`heavy: gave up after ${process.env.GDLM_HEAVY_WAIT || 120} min waiting; try later`); process.exit(75); }
    sleepSync(got ? 0 : 3000 + Math.random() * 2000);
  }
  process.env.GDLM_HEAVY_HELD = String(process.pid);   // children run in this slot
  const release = () => { if (held) { try { fs.unlinkSync(held); } catch (e) {} held = null; } };
  process.on("exit", release);
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"]) process.on(sig, () => { release(); process.exit(130); });
}
const release = () => { if (held) { try { fs.unlinkSync(held); } catch (e) {} held = null; delete process.env.GDLM_HEAVY_HELD; } };

module.exports = { claim, release, holders, decide, lockDir, freeMB, describe, MIN_FREE_MB, TWO_SLOTS_MB };
if (require.main === module) {
  const hs = holders();
  console.log(`${freeMB()} MB free; ${hs.length ? hs.length + " heavy job(s): " + hs.map(describe).join("; ") : "no heavy job running"}  (lock dir ${lockDir()})`);
}
