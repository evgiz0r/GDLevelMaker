// node tools/difficulty_solve.js <n | c<id>> [--sweep]   -- solves official level n (or the downloaded community
//   level <id>, local/community/<id>.gdlvl -> local/difficulty/c<id>.json) into the shared local/:
//   local/difficulty/NN.json (raw solver inputs, for tools/difficulty.js) and local/official_NN.json
//   (the human route, for the viewer and other sessions). Both carry `physics`: the last commit
//   that changed lib/physics.js or lib/objects*.js, so a later physics change shows what is stale.
// node tools/difficulty_solve.js all [n ...]     -- solves several (default 1-22), ONE process at a
//   time, waiting while free memory is under 2.5 GB (a solve takes up to ~800 MB; other sessions and
//   the user's game share the PC). Prints one line per level.
// node tools/difficulty_solve.js <n> --resume [--from X]  -- after a physics change, keeps the saved
//   run up to a bit before the first place the change matters and solves only the rest: replays the
//   saved inputs (local/difficulty/NN.json, shared by every session) in the new physics, finds where
//   they now die (or where the old run died, if they now get past it), backs off 300 units and sweeps
//   from there; if that gets stuck within 2 blocks of the trouble spot it backs off 900, then 2700,
//   then solves from the start. --from X: resume at x X (units) instead. Limit: the route before the
//   resume point is the old one, so a change that opens a better route earlier is not seen; run
//   a full solve (no --resume) now and then. `all ... --resume` passes it on.
// node tools/difficulty_solve.js <n> --replan  -- only the viewer's route again (natural plan + humanCost) from
//   the saved run, when it still finishes and skips nothing; else it says to solve again.
// Checkpoints: every 30 s a sweep writes its best route so far to local/difficulty/NN.part.json (with
//   its physics commit). Stopping a solve (another session needs the PC) costs nothing: the next
//   run of the same level on the same physics carries on from the checkpoint, whatever its flags.
//   The file goes when the solve finishes. --fresh ignores (and deletes) it.
// RobTop's levels: local/ is gitignored and nothing from it is ever committed.
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
const fs = require("fs"), path = require("path"), { execFileSync, execSync } = require("child_process");
const { GD, unpack, readGdlvl } = require("./io.js");
const SRC = process.env.GD_LEVELS || "C:/Program Files (x86)/Steam/steamapps/common/Geometry Dash/Resources/levels/";
const OUT = path.join(__dirname, "..", "local", "difficulty");

function physicsCommit() {
  try { return execSync("git log -1 --format=%h -- lib/physics.js lib/dual.js lib/objects.js lib/objects_extra.js", { windowsHide: true, cwd: path.join(__dirname, ".."), encoding: "utf8" }).trim(); }
  catch (e) { return null; }
}

// a level: an official number (GD's own files), or "c<id>" for a downloaded community level
// (local/community/<id>.gdlvl, tools/fetch_level.js): same checkpoints, resume and no-skip rule
const isCommunity = n => /^c\d+$/.test(String(n));
const tag = n => isCommunity(n) ? String(n) : String(n).padStart(2, "0");
function levelText(n) {
  if (isCommunity(n)) return readGdlvl(path.join(__dirname, "..", "local", "community", String(n).slice(1) + ".gdlvl")).levelStr;
  return levelText(n);
}
const partFile = n => path.join(OUT, tag(n) + ".part.json");
function checkpointer(n, prefix, physics) {
  return (ev, st) => { fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(partFile(n), JSON.stringify({ n, physics, events: prefix.concat(ev), x: st.x, savedAt: new Date().toISOString() })); };
}
// a checkpoint of this level on this physics, if one is waiting
function partOf(n, opts) {
  const f = partFile(n);
  if (!fs.existsSync(f)) return null;
  if (opts.fresh) { fs.unlinkSync(f); return null; }
  try { const p = JSON.parse(fs.readFileSync(f, "utf8")); return p.physics === physicsCommit() && p.events ? p : null; } catch (e) { return null; }
}

function solveOfficial(n, opts) {
  const part = opts.sweep ? null : partOf(n, opts);
  if (part) { const r = continueFrom(n, part.events, part.x, [0, 300, 1200], opts, null); if (r) return r; }
  const level = levelText(n);
  const L = GD.parseLevel(level);
  const w = GD.makeWorld(L.objects, L.header);
  const t0 = Date.now();
  const ck = { onCheckpoint: opts.sweep ? null : checkpointer(n, [], physicsCommit()) };
  const r = opts.sweep ? GD.solveSweep(w) : GD.solveAny(w, ck);
  if (!opts.sweep && fs.existsSync(partFile(n))) fs.unlinkSync(partFile(n));
  const res = {
    n, ok: r.ok, sweep: !!r.sweep, secs: (Date.now() - t0) / 1000, physics: physicsCommit(), solvedAt: new Date().toISOString(),
    events: r.ok ? r.events : (r.trail || []),
    clicks: r.ok ? r.clicks : [],
    dieX: r.ok ? null : r.dieAt && r.dieAt.x, why: r.ok ? null : r.why,
    endX: w.endX,
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, tag(n) + (opts.sweep ? "_sweep" : "") + ".json"), JSON.stringify(res));
  toViewer(n, level, res);
  return res;
}

// the saved run replayed in the current physics: its states by tick, and where it ends
function replay(w, events) {
  const ev = new Map(events.map(e => [e.tick, e.type])), s = GD.startState(w), st = [structuredClone(s)];
  const max = Math.ceil((w.endX / (GD.SPEEDS[0].x * 60) + 5) * GD.PHYS.TPS);
  let held = false; const helds = [false];
  while (!s.dead && !s.done && s.tick < max) {
    const e = ev.get(s.tick); let press = false;
    if (e === "press") { press = true; held = true; } if (e === "release") held = false;
    GD.step(w, s, { press, held }); st.push(structuredClone(s)); helds.push(held);
  }
  return { st, helds, end: s };
}

function resumeOfficial(n, opts) {
  const part = partOf(n, opts);
  if (part) { const r = continueFrom(n, part.events, part.x, [0, 300, 1200], opts, null); if (r) return r; }
  const file = path.join(OUT, tag(n) + ".json");
  if (!fs.existsSync(file)) return solveOfficial(n, opts);
  const old = JSON.parse(fs.readFileSync(file, "utf8"));
  return continueFrom(n, old.events, opts.from, opts.from != null ? [0] : [300, 900, 2700], opts, old) || solveOfficial(n, opts);
}

// keep `events` up to a bit before x `trouble` and sweep the rest; backs: how far before it to try,
// in turn. old: the saved result being redone (trouble left null: found by replaying its events in
// the current physics). Null when every start gets stuck within 2 blocks of the trouble spot.
function continueFrom(n, events, trouble, backs, opts, old) {
  const file = path.join(OUT, tag(n) + ".json"), physics = physicsCommit();
  const level = levelText(n);
  const L = GD.parseLevel(level), w = GD.makeWorld(L.objects, L.header), t0 = Date.now();
  const rp = replay(w, events), endS = rp.end;
  const save = (r, evs, from) => {
    const res = { n, ok: r.ok, sweep: true, secs: (Date.now() - t0) / 1000, physics, solvedAt: new Date().toISOString(),
      events: evs, clicks: r.ok ? r.clicks || [] : [], dieX: r.ok ? null : r.dieX, why: r.ok ? null : r.why, endX: w.endX,
      resumedFrom: from, resumedOver: old ? old.physics || null : physics };
    fs.writeFileSync(file, JSON.stringify(res)); toViewer(n, level, res);
    if (fs.existsSync(partFile(n))) fs.unlinkSync(partFile(n));
    return res;
  };
  // the old inputs still beat it: nothing to redo
  if (old && (endS.done || (!endS.dead && endS.x >= w.endX))) return save({ ok: true, clicks: old.clicks }, old.events, null);
  // where the change matters: the new death, or the old one if the old inputs now get past it
  if (trouble == null) trouble = old.dieX != null && endS.x > old.dieX + 1 ? old.dieX : endS.x;
  for (const back of backs) {
    const x0 = trouble - back;
    if (x0 <= 0) break;
    let t = rp.st.findIndex(s => s.x >= x0); if (t < 0) t = rp.st.length - 1;
    // start on a tick with the button released if one is near (nothing mid-hold)
    for (let k = t; k > Math.max(0, t - 60); k--) if (!rp.helds[k]) { t = k; break; }
    const start = rp.st[t], prefix = events.filter(e => e.tick < t);
    if (!opts.quiet) console.log(`  (solving from block ${(start.x / 30).toFixed(1)})`);
    const r = GD.solveFrom(w, start, { held: rp.helds[t], onCheckpoint: checkpointer(n, prefix, physics) });
    const evs = prefix.concat(r.ok ? r.events : r.trail || []);
    const dieX = r.ok ? null : r.dieAt && r.dieAt.x;
    // the kept prefix comes from the old run: if it went around a portal (made before the no-skip rule, or before
    // dual portals counted), the stitched route is a secret way. Check the whole route; then a full solve.
    if (r.ok) { const q = GD.run(w, evs), sk = GD.skipCheck(w, q.path, evs);
      if (sk) { if (!opts.quiet) console.log(`  (the kept old run skips ${sk.skipped}: solving from the start)`); return null; } }
    if (r.ok || dieX > trouble + 60) return save({ ok: r.ok, clicks: r.clicks, dieX, why: r.why }, evs, +start.x.toFixed(1));
    if (!opts.quiet) console.log(`  (stuck at block ${dieX && (dieX / 30).toFixed(1)}, backing off)`);
  }
  return null;
}

// also show it in the viewer (local/official_NN.json, the format tools/official.js writes)
function toViewer(n, level, res) {
  if (isCommunity(n)) return;   // other people's levels: numbers only, not in the viewer's official list
  const NAMES = require("./difficulty.js").RATED;
  // the viewer shows the route a person would play: the natural plan judged by humanCost (lib/natural.js:
  // no unneeded press, short taps, early in each window, wave/ship lines off the walls; PHYSICS.md "How the
  // route is chosen"), as the GDLM levels get; difficulty's humanize when the natural plan fails
  const L = GD.parseLevel(level), w = GD.makeWorld(L.objects, L.header);
  let events = null;
  try { const n = require("../lib/natural.js").naturalPlan(w, { ok: res.ok, events: res.events }, L.objects, { cost: true });
    if (n && (res.ok ? n.path[n.path.length - 1].done : true)) events = n.events; } catch (e) {}
  const kind = events ? "human" : "humanize";   // tools/difficulty.js scores a "human" route as it is
  if (!events) events = require("../lib/difficulty.js").humanize(w, res.events).events;
  const solution = res.ok ? { ok: true, events, kind } : { ok: false, events, dieX: res.dieX, why: res.why, kind };
  fs.writeFileSync(path.join(OUT, "..", `official_${String(n).padStart(2, "0")}.json`),
    JSON.stringify({ n, name: NAMES[n] ? NAMES[n][0] : "level " + n, level, solution, physics: res.physics || null }));
  require("./index_levels.js").buildIndex();
}

function freeGB() {
  try { return +execSync('powershell -NoProfile -c "(Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory"', { windowsHide: true, encoding: "utf8" }) / 1048576; }
  catch (e) { return 99; }
}
const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === "all") {
    const ns = args.slice(1).filter(a => !a.startsWith("--")).map(a => isCommunity(a) ? a : Number(a)); const list = ns.length ? ns : Array.from({ length: 22 }, (_, i) => i + 1);
    for (const n of list) {
      let waited = 0;
      while (freeGB() < 2.5) { if (waited++ % 6 === 0) console.log(`  (waiting: under 2.5 GB free)`); sleep(10000); }
      try { process.stdout.write(execFileSync(process.execPath, ["--max-old-space-size=2000", __filename, String(n)].concat(args.filter(a => a === "--resume" || a === "--fresh")), { windowsHide: true, encoding: "utf8" })); }
      catch (e) { console.log(`${n}: failed: ${String(e.message).split("\n")[0]}`); }
    }
  } else {
    const n = isCommunity(args[0]) ? args[0] : +args[0];
    if (args.includes("--replan")) {   // the viewer's route again from the saved run, no solve (it must still finish and skip nothing)
      const file = path.join(OUT, tag(n) + ".json"), r = JSON.parse(fs.readFileSync(file, "utf8")), level = levelText(n);
      const L = GD.parseLevel(level), w = GD.makeWorld(L.objects, L.header), q = GD.run(w, r.events);
      const sk = r.ok && GD.skipCheck(w, q.path, r.events);
      if (r.ok && (q.dead || !(q.done || q.end.x >= w.endX))) { console.log(`${n}: the saved run no longer finishes: solve it again (--resume)`); process.exit(1); }
      if (sk) { console.log(`${n}: the saved run skips ${sk.skipped}: a secret way, solve it again`); process.exit(1); }
      toViewer(n, level, r); const v = JSON.parse(fs.readFileSync(path.join(OUT, "..", `official_${tag(n)}.json`), "utf8"));
      console.log(`${n}: viewer route re-planned: ${r.events.filter(e => e.type === "press").length} raw presses -> ${v.solution.events.filter(e => e.type === "press").length}`); return;
    }
    const fi = args.indexOf("--from"), o = { sweep: args.includes("--sweep"), fresh: args.includes("--fresh"), from: fi < 0 ? null : +args[fi + 1] };
    const r = args.includes("--resume") || fi >= 0 ? resumeOfficial(n, o) : solveOfficial(n, o);
    console.log(`${n}: ${r.ok ? "beaten" : "stops at block " + (r.dieX / 30).toFixed(1) + " (" + r.why + ")"}, ${r.events.length} events, ${r.secs.toFixed(0)} s, physics ${r.physics}` +
      (r.resumedFrom != null ? `, resumed from block ${(r.resumedFrom / 30).toFixed(1)}` : r.resumedOver !== undefined ? ", old inputs still hold" : ""));
  }
}
module.exports = { solveOfficial, resumeOfficial, continueFrom, toViewer, physicsCommit, SRC, OUT };
