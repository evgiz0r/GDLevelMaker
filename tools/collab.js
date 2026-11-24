// node tools/collab.js split <brief>                           -- the song plan -> parts of 10-20 s on section boundaries,
//                                                                each seam pinned to a song TIME -> local/collab/<base>/plan.json
// node tools/collab.js build <brief> <part> [--by <name>] [--seed n]  -- one part ALONE: compose + build + its own route
//                                                                and checks -> local/collab/<base>/p<i>.gdlvl + p<i>.json
// node tools/collab.js join <brief>                            -- the parts end to end, the seams checked, one full check
//                                                                -> levels/<slug>.gdlvl (+ viewer stages)
// node tools/collab.js status <brief>                          -- each part: builder, state, checks, time
//
// A level made the way GD collabs are (BUILDING.md section 1; the user, 2026-11-24: "Each section like 10 20 seconds.
// Done by a different agent just connected together. Need to align the song (speed portals may ruin if we add),
// location of the switch. Other than that those can be completely isolated."):
// - SPLIT: compose's sections (beats) are grouped into parts of 10-20 s; every part boundary is a seam pinned to a
//   song time (the beat it falls on). The contract at a seam: the cube, grounded on the floor, normal gravity and size,
//   at the speed the brief gives the next part's first section (mode portals live INSIDE a part: a ship section
//   enters and leaves the ship itself, as compose builds it).
// - BUILD: a part is its own little level that starts AT its seam's song time (brief offset shifted to the part's
//   first beat), so its beats, sync and speed portals are its own business; its length in blocks follows from its
//   speeds. It is composed, built, routed (tools/solutions.js) and checked alone -- a few seconds of solving.
// - JOIN: part i's objects shift by the x the player has covered when part i starts (the sum of the parts before,
//   each measured on its own speed timeline), so every seam lands on its song time whatever speeds a part used.
//   The parts' routes are joined by time (tick offset = seam time x 240) and replayed on the joined level: no solve.
//   A seam whose state differs from the contract, or a death, sends back only that part.
"use strict";
if (require.main === module && /^(build|join)$/.test(process.argv[2] || "")) require("./heavy.js").claim();
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const { GD, readGdlvl, writeGdlvl } = require("./io.js");
const SY = require("../lib/sync.js").SYNC;
const TPS = 240, SPEED_IX = { "0.5x": 0, "1x": 1, "2x": 2, "3x": 3, "4x": 4 };
const PART_MIN = 10, PART_MAX = 20;

const baseOf = bf => path.basename(bf, ".json");
const dirOf = bf => path.join(ROOT, "local", "collab", baseOf(bf));
const readJ = f => JSON.parse(fs.readFileSync(f, "utf8"));
const writeJ = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o, null, 1)); };
const SESSION = "style";

function gridOfBrief(brief) {
  const { gridOf, songOf } = require("./make.js");
  return brief.grid ? gridOf(brief) : gridOf(brief, songOf(brief));
}
function speedsOf(brief) { let cur = brief.speed || "1x"; return brief.sections.map(s => (cur = s.speed || cur)); }

// ---- split: parts of 10-20 s on section boundaries (brief.parts: [[section indices], ...] overrides)
function split(briefFile) {
  const brief = readJ(briefFile), grid = gridOfBrief(brief), off = brief.offset || 0, sp = speedsOf(brief);
  const tOfBeat = b => SY.beatToTime(grid, off, b);
  let b = 1; const secs = brief.sections.map((s, i) => { const b0 = b; b += s.beats; return { i, name: s.name, b0, b1: b, t0: tOfBeat(b0), t1: tOfBeat(b) }; });
  if (secs.some((s, i) => !brief.sections[i].beats)) throw new Error("every section needs beats (a part is pinned to song time)");
  let groups = brief.parts;
  if (!groups) {
    groups = []; let cur = [];
    for (const s of secs) {
      const len = cur.length ? s.t1 - secs[cur[0]].t0 : s.t1 - s.t0;
      if (cur.length && len > PART_MAX) { groups.push(cur); cur = []; }
      cur.push(s.i);
      if (s.t1 - secs[cur[0]].t0 >= PART_MIN) { groups.push(cur); cur = []; }
    }
    if (cur.length) { if (groups.length && secs[cur[cur.length - 1]].t1 - secs[cur[0]].t0 < PART_MIN / 2) groups[groups.length - 1].push(...cur); else groups.push(cur); }
  }
  const old = (() => { try { return readJ(path.join(dirOf(briefFile), "plan.json")); } catch (e) { return null; } })();
  const parts = groups.map((g, k) => {
    const a = secs[g[0]], z = secs[g[g.length - 1]], prev = old && old.parts && old.parts[k];
    // part 0 starts at the level's start (its first beat may come a little after); the others on their first beat
    return { id: "p" + k, name: g.map(i => secs[i].name).join(" + "), sections: g, beats: [a.b0, z.b1], t: [k === 0 ? 0 : a.t0, z.t1],
      speedIn: sp[g[0]], builder: (prev && prev.builder) || null, status: (prev && prev.status) || { layout: "planned", deco: "planned", playtest: "planned", join: "planned" } };
  });
  // a seam: the cube grounded on the floor, normal gravity / size, at the next part's speed, at a song time
  const seams = parts.slice(1).map(p => ({ t: p.t[0], beat: p.beats[0], mode: "cube", speed: p.speedIn, grav: 1, mini: false, dual: false, y: 15, grounded: true }));
  const plan = { brief: path.relative(ROOT, briefFile).split(path.sep).join("/"), name: brief.name, at: new Date().toISOString(), parts, seams };
  writeJ(path.join(dirOf(briefFile), "plan.json"), plan);
  showInViewer(briefFile, plan);
  return plan;
}

// the joined level's card in the viewer: one section per part, with its builder and state
function showInViewer(briefFile, plan, stage, levelStr, data, note) {
  try {
    const ST = require("./stages.js"), { slug } = require("./make.js"), base = slug(plan.name);
    if (stage) ST.put({ session: SESSION, base, name: plan.name, stage, levelStr, data, note });
    else ST.put({ session: SESSION, base, name: plan.name, stage: "song", note: `${plan.parts.length} parts of ${plan.parts.map(p => (p.t[1] - p.t[0]).toFixed(0) + " s").join(", ")}, seams pinned to song time` });
    ST.setSections(SESSION, base, plan.parts.map(p => ({ id: p.id, name: p.name, t: p.t, beats: p.beats, builder: { layout: p.builder || "-", deco: p.builder || "-", playtest: p.builder || "-" }, status: p.status })));
  } catch (e) { console.log("   (viewer stages: " + e.message + ")"); }
}

// ---- build one part alone
function partBrief(brief, part, k, nParts, seed) {
  const sub = JSON.parse(JSON.stringify(brief));
  sub.sections = part.sections.map(i => brief.sections[i]);
  sub.speed = part.speedIn;
  sub.offset = (brief.offset || 0) + part.t[0];   // the part's level time 0 = its seam's song time (not rounded: a rounded
  // offset just past the beat makes lib/sync.js's beat 1 the NEXT beat)
  sub.name = brief.name + " part " + (k + 1);
  sub.seed = (brief.seed || 1) * 1000 + k * 37 + (seed || 0);
  if (k > 0) sub.leadIn = brief.partLeadIn ?? 4;                 // not the level's 10-block calm start at every seam
  if (k < nParts - 1) sub.signature = false;                     // the signature ends the last part only
  delete sub.parts;
  return sub;
}
function build(briefFile, k, opts = {}) {
  const t0 = Date.now(), brief = readJ(briefFile), plan = readJ(path.join(dirOf(briefFile), "plan.json"));
  const part = plan.parts[k]; if (!part) throw new Error("no part " + k);
  const sub = partBrief(brief, part, k, plan.parts.length, opts.seed);
  const C = require("./compose.js"), { build: mk } = require("./make.js"), { scoreLevel } = require("./score.js");
  const log0 = console.log; let built, spec;
  console.log = () => {};
  try { spec = C.compose(sub).spec; built = mk(spec, briefFile); } finally { console.log = log0; }
  const level = built.level, levelStr = GD.serializeLevel(level), w = GD.makeWorld(level.objects, level.header), tl = SY.timeline(w);
  const dur = part.t[1] - part.t[0], L = SY.xOfT(tl, dur) - SY.xOfT(tl, 0);
  const tb = Date.now();
  const sol = require("./solutions.js").solve(level, levelStr, { name: sub.name });
  const ts = Date.now();
  const sc = scoreLevel(level, sub, { fairness: false, levelStr });
  const BLOCK = ["beatable", "prejumps", "timing", "recovery", "skips", "reactive", "fairness"];
  const gates = Object.fromEntries(sc.gates.filter(g => BLOCK.includes(g.name) && g.status !== "PASS").map(g => [g.name, g.status + ": " + String(g.value).slice(0, 160)]));
  const fails = sc.gates.filter(g => g.status === "FAIL").map(g => g.name);
  // the part's own exit: the state its route leaves at the seam time (what the next part will be handed)
  let exit = null;
  if (sol && sol.ok) { const p = GD.run(w, sol.events).path, q = p[Math.min(p.length - 1, Math.round(dur * TPS) - 1)] || {}; exit = { mode: q.mode, sp: q.sp, grav: q.grav, y: q.y != null ? +q.y.toFixed(1) : null, vy: q.vy != null ? +q.vy.toFixed(2) : null, grounded: !!q.grounded, x: q.x }; }
  const dir = dirOf(briefFile); fs.mkdirSync(dir, { recursive: true });
  writeGdlvl(path.join(dir, part.id + ".gdlvl"), built.rec, level);
  const res = { part: part.id, by: opts.by || "style", seed: opts.seed || 0, ok: !!(sol && sol.ok) && !fails.length, solved: !!(sol && sol.ok), fails, gates, dur: +dur.toFixed(4), L: +L.toFixed(2),
    events: sol && sol.ok ? sol.events : null, exit, objects: level.objects.length,
    secs: { build: (tb - t0) / 1000, route: (ts - tb) / 1000, check: (Date.now() - ts) / 1000, total: (Date.now() - t0) / 1000 }, at: new Date().toISOString() };
  writeJ(path.join(dir, part.id + ".json"), res);
  part.builder = res.by; part.status = Object.assign({}, part.status, { layout: "built", deco: "built", playtest: res.ok ? "ok" : "redo", join: "planned" });
  writeJ(path.join(dir, "plan.json"), plan); showInViewer(briefFile, plan);
  try { fs.appendFileSync(path.join(ROOT, "local", "timings.jsonl"), JSON.stringify({ at: res.at, tool: "collab.js", step: "collab-build", level: brief.name, part: part.id, by: res.by, secs: res.secs.total }) + "\n"); } catch (e) {}
  return res;
}

// ---- join
function join(briefFile) {
  const t0 = Date.now(), brief = readJ(briefFile), dir = dirOf(briefFile), plan = readJ(path.join(dir, "plan.json"));
  const parts = plan.parts.map(p => ({ p, r: (() => { try { return readJ(path.join(dir, p.id + ".json")); } catch (e) { return null; } })(), L: (() => { try { return readGdlvl(path.join(dir, p.id + ".gdlvl")); } catch (e) { return null; } })() }));
  const missing = parts.filter(q => !q.r || !q.L).map(q => q.p.id);
  if (missing.length) return { ok: false, problems: ["not built yet: " + missing.join(", ")] };
  const objects = [], events = [], problems = [], send = new Set();
  let shift = 0;
  parts.forEach(({ p, r, L }, k) => {
    const last = k === parts.length - 1, end = r.L;
    // a part's objects within its own stretch (its run-out past the seam belongs to the next part); the last keeps all
    for (const o of L.level.objects) if (last || o.x <= end + 15) objects.push(Object.assign({}, o, { x: +(o.x + shift).toFixed(3) }));
    if (r.events) { const dt = Math.round(p.t[0] * TPS); for (const e of r.events) if (last || e.tick < Math.round(r.dur * TPS)) events.push(Object.assign({}, e, { tick: e.tick + dt })); }
    else { problems.push(`${p.id}: no route`); send.add(p.id); }
    p.shift = +shift.toFixed(2);
    shift += end;
  });
  // a press that would hold across a seam: release it there (each part's route is its own)
  events.sort((a, b) => a.tick - b.tick || (a.type === "release" ? -1 : 1));
  const level = { header: parts[0].L.level.header, objects };
  const levelStr = GD.serializeLevel(level), w = GD.makeWorld(level.objects, level.header), tl = SY.timeline(w);
  const run = GD.run(w, events), path0 = run.path;
  // the seams: the joined run's state at each seam time against the contract
  const seamRes = plan.seams.map((s, i) => {
    const tick = Math.round(s.t * TPS), q = path0[Math.min(tick, path0.length - 1)] || {}, want = SPEED_IX[s.speed];
    const xT = SY.xOfT(tl, s.t), xPart = parts[i + 1].p.shift;
    const bad = [];
    if (tick >= path0.length - 1 && run.dead) bad.push("the run died before it");
    else {
      if (q.mode !== s.mode) bad.push(`mode ${q.mode} (contract ${s.mode})`);
      if (want != null && q.sp !== want) bad.push(`speed ${q.sp} (contract ${s.speed})`);
      if ((q.grav || 1) !== s.grav) bad.push(`gravity ${q.grav}`);
      if (q.y != null && Math.abs(q.y - s.y) > 8) bad.push(`y ${q.y.toFixed(1)} (contract ${s.y})`);
      if (s.grounded && q.vy != null && Math.abs(q.vy) > 0.5) bad.push(`vy ${q.vy.toFixed(2)} (contract grounded)`);
    }
    // sync at the seam: the joined level's x at the seam time is where the next part starts
    if (Math.abs(xT - xPart) > 6) bad.push(`sync: x at the seam time ${xT.toFixed(1)} vs the part's start ${xPart} (${((xT - xPart) / 30).toFixed(2)} blocks)`);
    return { seam: i, t: s.t, ok: !bad.length, bad, after: parts[i + 1].p.id, before: parts[i].p.id };
  });
  for (const s of seamRes) if (!s.ok) { problems.push(`seam ${s.before}|${s.after} at ${s.t.toFixed(2)} s: ${s.bad.join(", ")}`); send.add(s.bad.some(b => /sync/.test(b)) ? s.before : s.after); }
  if (run.dead) {
    const x = run.end ? run.end.x : (path0[path0.length - 1] || {}).x || 0, k = parts.findIndex(({ p }, i) => i === parts.length - 1 || x < parts[i + 1].p.shift);
    problems.push(`the joined route dies at block ${(x / 30).toFixed(1)} in ${parts[k].p.id} (${run.why || "?"})`); send.add(parts[k].p.id);
  }
  const skip = !run.dead ? GD.skipCheck(w, path0, events) : null;
  if (skip) problems.push("the joined route skips " + JSON.stringify(skip).slice(0, 120));
  // the joined level: the first part's record, renamed
  const { slug } = require("./make.js"), out = path.join(ROOT, "levels", slug(brief.name) + ".gdlvl");
  const rec = parts[0].L.rec; GD.setField(rec, "k2", "s", brief.name);
  writeGdlvl(out, rec, level);
  // the route (no solve: the parts' own routes, joined) and the full check on it
  let full = null;
  if (!run.dead) {
    try { require("./solutions.js").fromRun(level, levelStr, { ok: true, events }, { name: brief.name }); } catch (e) { problems.push("saving the route: " + e.message); }
    try { const sc = require("./score.js").scoreLevel(level, brief, { fairness: true, levelStr, name: brief.name }); full = { ok: sc.ok, fails: sc.gates.filter(g => g.status === "FAIL").map(g => g.name + ": " + String(g.value).slice(0, 140)), warns: sc.gates.filter(g => g.status === "WARN").map(g => g.name) }; } catch (e) { problems.push("full check: " + e.message); }
  }
  for (const { p } of parts) p.status = Object.assign({}, p.status, { join: send.has(p.id) ? "redo" : (run.dead ? "waiting" : "joined") });
  writeJ(path.join(dir, "plan.json"), plan);
  const res = { ok: !problems.length && full && full.ok, problems, send: [...send], seams: seamRes, full, out: path.relative(ROOT, out), objects: objects.length, secs: (Date.now() - t0) / 1000, at: new Date().toISOString() };
  writeJ(path.join(dir, "join.json"), res);
  showInViewer(briefFile, plan, "final", levelStr, { events }, `joined ${parts.length} parts: ${res.ok ? "every seam holds, full check READY" : problems.length + " problem(s)" + (full && full.fails.length ? ", full check: " + full.fails.length + " FAIL" : "")}`);
  try { fs.appendFileSync(path.join(ROOT, "local", "timings.jsonl"), JSON.stringify({ at: res.at, tool: "collab.js", step: "collab-join", level: brief.name, secs: res.secs }) + "\n"); } catch (e) {}
  return res;
}

function status(briefFile) {
  const dir = dirOf(briefFile), plan = readJ(path.join(dir, "plan.json"));
  for (const p of plan.parts) {
    let r = null; try { r = readJ(path.join(dir, p.id + ".json")); } catch (e) {}
    console.log(`${p.id} ${p.name.padEnd(28)} ${(p.t[1] - p.t[0]).toFixed(1).padStart(5)} s  ${String(p.speedIn).padEnd(4)} by ${String(p.builder || "-").padEnd(12)} ${JSON.stringify(p.status)}` +
      (r ? `  ${r.ok ? "ok" : "FAIL " + r.fails.join(",")} ${r.secs.total.toFixed(0)} s` : ""));
  }
}

module.exports = { split, build, join, status, partBrief };

if (require.main === module) {
  const [cmd, bf, ...rest] = process.argv.slice(2);
  const opt = k => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : null; };
  if (!cmd || !bf) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("// node")).join("\n")); process.exit(1); }
  if (cmd === "split") { const p = split(bf); console.log(`${p.parts.length} parts:`); for (const x of p.parts) console.log(`  ${x.id} ${x.name.padEnd(30)} beats ${x.beats[0]}-${x.beats[1]}  ${x.t[0].toFixed(2)}-${x.t[1].toFixed(2)} s (${(x.t[1] - x.t[0]).toFixed(1)} s) in at ${x.speedIn}`); }
  else if (cmd === "build") {
    const k = +String(rest[0]).replace(/^p/, ""), r = build(bf, k, { by: opt("--by") || "style", seed: +(opt("--seed") || 0) });
    console.log(`${r.part} by ${r.by}: ${r.ok ? "OK" : "NOT OK"} -- ${r.solved ? "beaten" : "not beaten"}, ${r.L.toFixed(0)} units (${(r.L / 30).toFixed(1)} blocks) in ${r.dur.toFixed(2)} s; exit ${JSON.stringify(r.exit)}; ` +
      `${r.secs.total.toFixed(0)} s (build ${r.secs.build.toFixed(0)}, route ${r.secs.route.toFixed(0)}, check ${r.secs.check.toFixed(0)})`);
    for (const [g, v] of Object.entries(r.gates)) console.log(`   ${g}: ${v}`);
    process.exit(r.ok ? 0 : 2);
  }
  else if (cmd === "join") { const r = join(bf); console.log(r.ok ? `JOINED: every seam holds, full check READY -> ${r.out} (${r.secs.toFixed(0)} s)` : `NOT JOINED (${(r.secs || 0).toFixed(0)} s):`); for (const p of r.problems || []) console.log("   " + p); if (r.full) { for (const f of r.full.fails) console.log("   full check FAIL " + f); console.log("   warnings: " + r.full.warns.join(", ")); } if (r.send && r.send.length) console.log("   send back: " + r.send.join(", ")); process.exit(r.ok ? 0 : 2); }
  else if (cmd === "status") status(bf);
}
