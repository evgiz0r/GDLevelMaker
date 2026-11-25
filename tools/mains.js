// node tools/mains.js status [--json]   -- RobTop's 22 main levels: does each saved route still clear on today's sim?
//   Per level: the raw solve (local/difficulty/NN.json) and the viewer's human route (local/official_NN.json),
//   each replayed on today's physics (seconds, no solving), with the cheapest job that makes it current again:
//     ok      the human route clears and takes every portal (the raw solve may be stale: nothing uses it then)
//     replan  the raw solve still clears, only the human route fails (or is a fallback "humanize"): --replan
//     resume  the raw solve dies (or skips a portal) on today's physics: --resume from a bit before the trouble
// node tools/mains.js run [n ...] [--dry]   -- does those jobs one after another (cheap replans first, then resumes),
//   each a tools/difficulty_solve.js run at heavy priority "urgent" (the user, 2026-11-24: "If we have it failed then
//   its highest priority"), so a failed main level goes ahead of every other waiting heavy job. One runner at a time
//   (local/mains/runner.json); log local/mains/log.txt; each finished job: local/mains/history.jsonl.
// After the jobs: tools/tight.js --fix on every route it redid (timings too hard for the level), then the all-coins routes
// (coinPass: a resume --coins at low priority for a level whose coin route misses a coin; one try per physics commit).
// Automatic: tools/serve.js starts `mains.js run` after its self-update pulls a change to the physics or route code
// (ROUTE_CODE below). DIFFICULTY.md "Main levels kept current".
// RobTop's levels: everything stays in local/, nothing is committed.
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ROOT = path.join(__dirname, ".."), DIR = path.join(ROOT, "local", "mains");
// a change to any of these can make a saved main-level route stale
const ROUTE_CODE = ["lib/physics.js", "lib/dual.js", "lib/objects.js", "lib/objects_extra.js", "lib/objects_gd22.js",
  "lib/natural.js", "tools/difficulty_solve.js"];
const NAMES = { 1: "Stereo Madness", 2: "Back On Track", 3: "Polargeist", 4: "Dry Out", 5: "Base After Base",
  6: "Cant Let Go", 7: "Jumper", 8: "Time Machine", 9: "Cycles", 10: "xStep", 11: "Clutterfunk",
  12: "Theory of Everything", 13: "Electroman Adventures", 14: "Clubstep", 15: "Electrodynamix",
  16: "Hexagon Force", 17: "Blast Processing", 18: "Theory of Everything 2", 19: "Geometrical Dominator",
  20: "Deadlocked", 21: "Fingerdash", 22: "Dash" };
const tag = n => String(n).padStart(2, "0");
const readJ = f => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return null; } };

// one level's state (pure apart from the files it reads): replays both saved routes on today's sim
function stateOf(n) {
  const { GD } = require("./io.js"), ds = require("./difficulty_solve.js");
  const raw = readJ(path.join(ROOT, "local", "difficulty", tag(n) + ".json")), view = readJ(path.join(ROOT, "local", `official_${tag(n)}.json`));
  const level = ds.levelText(n), L = GD.parseLevel(level), w = GD.makeWorld(L.objects, L.header);
  const play = ev => { if (!ev) return { done: false, pct: 0, skip: null };
    const q = GD.run(w, ev), e = q.end || q.path[q.path.length - 1], done = !!(q.done || (!q.dead && !e.hd && e.x >= w.endX)), ex = GD.worldXY(e)[0];
    let skip = null; if (done) { const s = GD.skipCheck(w, q.path, ev); skip = s ? s.skipped : null; }
    return { done, pct: +Math.min(100, ex / w.endX * 100).toFixed(1), skip }; };
  const r = play(raw && raw.events), v = play(view && view.solution && view.solution.events);
  const kind = view && view.solution ? view.solution.kind || "?" : "none";
  const part = readJ(path.join(ROOT, "local", "difficulty", tag(n) + ".part.json"));
  // the human route is what the viewer and the difficulty score use: when it clears, nothing to redo even if the raw
  // solve under it went stale (Blast Processing, 2026-11-25)
  const need = v.done && !v.skip && kind === "human" ? "ok" : r.done && !r.skip ? "replan" : "resume";
  return { n, name: NAMES[n], raw: r, view: v, kind, need, physics: raw && raw.physics, part: part ? +(part.x / 30).toFixed(1) : null };
}
const fmt = p => p.done ? (p.skip ? "skips " + p.skip : "clears") : "dies " + p.pct + "%";

function status() {
  const out = [];
  for (let n = 1; n <= 22; n++) { try { out.push(stateOf(n)); } catch (e) { out.push({ n, name: NAMES[n], need: "resume", error: String(e.message).split("\n")[0] }); } }
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, "status.json"), JSON.stringify({ at: new Date().toISOString(), levels: out }, null, 1));
  return out;
}
const runner = () => { const r = readJ(path.join(DIR, "runner.json")); if (!r) return null;
  try { process.kill(r.pid, 0); return r; } catch (e) { return null; } };
const log = s => { const line = `${new Date().toISOString()} ${s}`; console.log(s); fs.mkdirSync(DIR, { recursive: true }); fs.appendFileSync(path.join(DIR, "log.txt"), line + "\n"); };

function run(only, dry) {
  const other = runner();
  if (other && other.pid !== process.pid) { console.log(`mains: a runner already works (pid ${other.pid}, since ${other.since}); it re-checks every level before it ends`); return; }
  fs.mkdirSync(DIR, { recursive: true });
  if (!dry) fs.writeFileSync(path.join(DIR, "runner.json"), JSON.stringify({ pid: process.pid, since: new Date().toISOString() }));
  const done = new Set();
  try {
    for (let round = 0; round < 3; round++) {   // re-check after a pass: physics may have moved again meanwhile
      const all = status().filter(s => s.need !== "ok" && (!only.length || only.includes(s.n)));
      const st = all.filter(s => !done.has(s.n + s.need));
      if (!st.length) {
        // what a resume could not fix on this physics is an open physics lead (PHYSICS.md), not a solver gap
        log(all.length ? `mains: still failing after their job: ${all.map(s => `${s.n} ${s.name} (${fmt(s.raw)})`).join(", ")} -- open physics leads, not re-run until physics changes`
          : only.length ? `mains: ${only.join(", ")} clear on today's sim` : "mains: every main level clears on today's sim");
        break; }
      // cheap first: replans, then resumes (a level with a checkpoint waiting first: it carries on from there)
      st.sort((a, b) => (a.need === "replan" ? 0 : 1) - (b.need === "replan" ? 0 : 1) || (b.part != null) - (a.part != null) || a.n - b.n);
      log(`mains: to do: ${st.map(s => `${s.n} ${s.need}`).join(", ")}`);
      if (dry) return;
      for (const s of st) {
        done.add(s.n + s.need);
        const t0 = Date.now();
        const args = [path.join(__dirname, "difficulty_solve.js"), String(s.n), "--" + s.need];
        log(`mains: ${s.n} ${s.name}: ${s.need} (raw ${s.raw ? fmt(s.raw) : "?"}, route ${s.view ? fmt(s.view) : "?"})`);
        const r = cp.spawnSync(process.execPath, ["--max-old-space-size=3000"].concat(args), { windowsHide: true, cwd: ROOT, encoding: "utf8",
          env: Object.assign({}, process.env, { GDLM_HEAVY_PRIORITY: "urgent" }), maxBuffer: 64 << 20 });
        const lastLine = String(r.stdout || "").trim().split("\n").filter(l => /^\d+:/.test(l)).pop() || String(r.stderr || "").trim().split("\n").pop();
        let after = null; try { after = stateOf(s.n); } catch (e) {}
        const rec = { at: new Date().toISOString(), n: s.n, name: s.name, job: s.need, secs: Math.round((Date.now() - t0) / 1000), code: r.status,
          result: lastLine, after: after && { need: after.need, raw: fmt(after.raw), route: fmt(after.view), kind: after.kind } };
        fs.appendFileSync(path.join(DIR, "history.jsonl"), JSON.stringify(rec) + "\n");
        log(`mains: ${s.n} ${s.name}: ${s.need} took ${rec.secs} s -> ${after ? `raw ${fmt(after.raw)}, route ${fmt(after.view)} (${after.kind})` : lastLine}`);
        // a replan that found the raw solve no longer finishes falls through to a resume next round
      }
    }
    if (dry) return;
    // timings too hard for the level (DIFFICULTY.md "Too tight for the level"): re-search the spots on every route redone
    const redone = [...new Set([...done].map(k => parseInt(k, 10)))];
    if (redone.length) job("tight", ["tight.js"].concat(redone.map(String), ["--fix"]), "normal");
    // the all-coins routes (DIFFICULTY.md "Coin routes"), after the plain ones and at low priority: a level whose coin route
    // does not clear with every coin gets a resume (from its plain route when it has none); one try per physics commit
    if (!only.length || process.argv.includes("--coins")) coinPass(only);
  } finally { if (!dry) { const r = readJ(path.join(DIR, "runner.json")); if (r && r.pid === process.pid) fs.unlinkSync(path.join(DIR, "runner.json")); } }
}

function job(what, args, prio) {
  const t0 = Date.now();
  const r = cp.spawnSync(process.execPath, ["--max-old-space-size=3000", path.join(__dirname, args[0])].concat(args.slice(1)), { windowsHide: true, cwd: ROOT,
    encoding: "utf8", env: Object.assign({}, process.env, { GDLM_HEAVY_PRIORITY: prio }), maxBuffer: 64 << 20 });
  const lines = String(r.stdout || "").trim().split("\n").filter(l => /^\s*\d+[ :]/.test(l));
  log(`mains: ${what} ${args.slice(1).join(" ")} took ${Math.round((Date.now() - t0) / 1000)} s` + (lines.length ? "\n  " + lines.join("\n  ") : ""));
  return r;
}
// a level's coin route on today's sim: { total, got, done } (local/official_NN_coins.json replayed with needCoins)
function coinState(n) {
  const { GD } = require("./io.js"), ds = require("./difficulty_solve.js");
  const L = GD.parseLevel(ds.levelText(n)), w = GD.makeWorld(L.objects, L.header); w.needCoins = true;
  const total = GD.coinList(w).length, v = readJ(path.join(ROOT, "local", `official_${tag(n)}_coins.json`));
  if (!v || !v.solution) return { total, got: 0, done: false, none: true };
  const q = GD.run(w, v.solution.events), e = q.end || q.path[q.path.length - 1];
  return { total, got: GD.coinCount(e), done: !!q.done };
}
function coinPass(only) {
  const triedF = path.join(DIR, "coins_tried.json"), tried = readJ(triedF) || {}, phys = require("./difficulty_solve.js").physicsCommit();
  const st = status();
  for (const s of st) {
    if (s.need !== "ok" || (only.length && !only.includes(s.n))) continue;
    let c; try { c = coinState(s.n); } catch (e) { continue; }
    if (!c.total || (c.done && c.got === c.total)) continue;
    if (tried[s.n] === phys) continue;   // already tried on this physics: a coin lead (reported by tools/coins.js status)
    tried[s.n] = phys; fs.writeFileSync(triedF, JSON.stringify(tried));
    log(`mains: ${s.n} ${s.name}: coin route ${c.none ? "none yet" : (c.done ? "clears" : "dies") + " with " + c.got + "/" + c.total} -> resume --coins`);
    job("coins", ["difficulty_solve.js", String(s.n), "--resume", "--coins"], "low");
    const a = coinState(s.n);
    log(`mains: ${s.n} ${s.name}: coin route now ${a.done ? "clears" : "dies"} with ${a.got}/${a.total} coins`);
    if (a.done && a.got === a.total) job("tight coins", ["tight.js", String(s.n), "--fix", "--coins"], "low");
  }
}

// serve.js calls this after a self-update// serve.js calls this after a self-update: start a detached runner when the update touched route code
function afterUpdate(before, after, git) {
  let changed = "";
  try { changed = git(["diff", "--name-only", before, after, "--"].concat(ROUTE_CODE)); } catch (e) { return false; }
  if (!changed || runner()) return false;
  cp.spawn(process.execPath, [__filename, "run"], { windowsHide: true, cwd: ROOT, detached: true, stdio: "ignore" }).unref();
  console.log(`self-update: route code changed (${changed.split("\n").join(", ")}): mains.js run started for the main levels`);
  return true;
}

module.exports = { stateOf, status, afterUpdate, coinState, ROUTE_CODE, NAMES };

if (require.main === module) {
  const a = process.argv.slice(2), nums = a.filter(x => /^\d+$/.test(x)).map(Number);
  if (a[0] === "status") {
    const st = status();
    if (a.includes("--json")) console.log(JSON.stringify(st, null, 1));
    else for (const s of st) console.log(`${String(s.n).padStart(2)} ${(s.name || "").padEnd(24)} ${s.need.padEnd(7)} raw ${s.raw ? fmt(s.raw).padEnd(14) : "?".padEnd(14)} route ${s.view ? fmt(s.view).padEnd(14) : "?".padEnd(14)} ${s.kind || ""}${s.part != null ? `  checkpoint at block ${s.part}` : ""}${s.error ? "  " + s.error : ""}`);
    const r = runner(); if (r) console.log(`runner working: pid ${r.pid} since ${r.since}`);
  } else if (a[0] === "run") run(nums, a.includes("--dry"));
  else { console.log(fs.readFileSync(__filename, "utf8").split("\n").slice(0, 10).join("\n")); process.exit(1); }
}
