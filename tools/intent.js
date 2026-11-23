// node tools/intent.js <spec.json> [--probe]   -- build a level from its INTENDED route and verify it
//
// The user (2026-11-24): "designing levels should solve very little, maybe with a strong co-solver just to
// find secret ways or bad sections" -- building from the intended route is "obviously the whole point".
// So a level's route is not searched for, it is ASSEMBLED:
//   1. every pattern / structure carries its intended inputs: the player's route through it (lib/natural.js:
//      taps, holds only where the mode needs them, early in each window, flying the safe line), found ONCE
//      per (pattern, args, speed) in a small test level and cached in local/intent/ (shared);
//   2. make.js records where each pattern lands; the level's intended route is their inputs laid end to end,
//      fired by position (when the player reaches the x where the press belongs), not by fixed ticks, so a
//      little drift does not break it;
//   3. the route is VERIFIED with one replay (seconds). Where it dies, a LOCAL repair: a search from a calm
//      state ~1 s before the failure (lib/physics.js solveSweep from a state) to past it, spliced in, then the
//      intended inputs carry on;
//   4. --probe: the "secret way" co-solver -- before each mode/gravity/speed portal, a short search for a way
//      past it without taking it (a level bug: block that way).
// make.js uses it first (tools/check.js report opts.intent) and falls back to a full solve only when the
// intended route cannot be made to work. Reports the time per build. STYLE.md "Intended routes".
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
"use strict";
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const ROOT = path.join(__dirname, ".."), DIR = path.join(ROOT, "local", "intent");
const { GD } = require("./io.js");
Object.assign(GD, require("../lib/natural.js"));
const INC = () => require("../lib/incsolve.js").incsolve;
const SPEED_NAMES = ["0.5x", "1x", "2x", "3x", "4x"];
const speedAt = (tl, x) => { let s = tl[0]; for (const g of tl) if (g.x <= x) s = g; let best = 1, d = Infinity; GD.SPEEDS.forEach((sp, i) => { const e = Math.abs(sp.x * 60 - s.v); if (e < d) { d = e; best = i; } }); return SPEED_NAMES[best]; };

// ---- 1. a pattern's intended inputs, relative to its column (cached) ----
function relInputs(name, args, speed, opts = {}) {
  const key = crypto.createHash("sha1").update(JSON.stringify([name, args || {}, speed, 2])).digest("hex").slice(0, 16);
  const file = path.join(DIR, key + ".json");
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) {}
  if (opts.cacheOnly) return null;            // a build's path stage never solves (make.js)
  const { build } = require("./make.js"), { PATTERNS } = require("./patterns.js");
  const P = PATTERNS[name]; if (!P) return null;
  const width = P.fn(args || {}).width, C0 = 12;
  const spec = { name: "intent " + name, speed, style: "classic", indicators: false, signature: false,
    objects: [["pattern", name, C0, 0, args || {}], ["block", C0 + width + 14, 0]] };
  const log = console.log; console.log = () => {};
  let out;
  try {
    const { level } = build(spec, "intent");
    const w = GD.makeWorld(level.objects, level.header), r = GD.solveAny(w);
    if (!r.ok) out = { name, args, speed, fail: r.why || "not beaten" };
    else {
      let ev = r.events;
      try { const n = GD.naturalPlan(w, r, level.objects, { cost: true }); if (n && n.path[n.path.length - 1].done) ev = n.events; } catch (e) {}
      const p = GD.run(w, ev).path, x0 = C0 * 30;
      out = { name, args, speed, width, inputs: ev.map(e => ({ dx: +((p[e.tick] || p[p.length - 1]).x - x0).toFixed(2), type: e.type })) };
    }
  } finally { console.log = log; }
  fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(file, JSON.stringify(out));
  return out;
}

// ---- 2. the level's intended route: the placements' inputs laid end to end ----
// placements: [{name, col, row, args}] (make.js build -> ctx.placements); tl: the speed timeline
function intents(placements, tl, opts = {}) {
  const out = [], missing = [];
  // terrain rises (raw blocks, compose's block terrain): each column whose top is one row above the column
  // before it on the cube's floor is a "step-up" placement (opts.raw: make.js ctx.raw)
  if (opts.raw && opts.raw.length) {
    const top = new Map();
    for (const b of opts.raw) if (b.type === "block") { const c = Math.round(b.col); top.set(c, Math.max(top.get(c) ?? -1, b.row)); }
    const cols = [...top.keys()].sort((a, b) => a - b);
    for (const c of cols) { const t = top.get(c), prev = top.has(c - 1) ? top.get(c - 1) : -1; if (t >= 0 && t - prev === 1 && t < 4) placements = placements.concat([{ name: "step-up", col: c, row: prev + 1, args: {} }]); }
  }
  for (const p of placements) {
    const sp = speedAt(tl, p.col * 30), rel = relInputs(p.name, p.args, sp, opts);
    if (!rel || rel.fail || !rel.inputs) { missing.push(`${p.name}@${p.col}${rel && rel.fail ? " (" + rel.fail + ")" : ""}`); continue; }
    for (const i of rel.inputs) out.push({ x: p.col * 30 + i.dx, type: i.type, from: p.name + "@" + p.col });
  }
  out.sort((a, b) => a.x - b.x);
  // alternate press / release (two patterns' inputs can overlap at a seam: keep the order, drop doubles)
  const clean = []; let held = false;
  for (const e of out) { const pr = e.type === "press"; if (pr === held) continue; clean.push(e); held = pr; }
  return { intents: clean, missing };
}

// fire the intents by position from state s (button `held`) up to the end; returns events (absolute ticks)
function drive(w, list, s0, held0) {
  const s = Object.assign({}, s0, { used: s0.used.slice() });
  let held = !!held0, i = 0;
  while (i < list.length && list[i].x < s.x - 1) i++;          // intents behind the start are past
  const ev = [], max = Math.ceil((w.endX / (GD.SPEEDS[0].x * 60) + 5) * GD.PHYS.TPS);
  for (let t = s.tick || 0; t < max && !s.dead && !s.done; t++) {
    let press = false;
    while (i < list.length && list[i].x <= s.x) {
      const pr = list[i].type === "press";
      if (pr !== held) { ev.push({ tick: t, type: list[i].type }); held = pr; press = pr; }
      i++;
    }
    GD.step(w, s, { press, held });
  }
  return ev;
}

// ---- 3. verify, repair locally ----
function verify(w, level, list, opts = {}) {
  const t0 = Date.now(), log = [];
  const I = INC();
  let events = drive(w, list, GD.startState(w), false), repairs = 0;
  for (; repairs <= (opts.maxRepairs ?? 12); repairs++) {
    const res = GD.run(w, events), p = res.path;
    const skip = GD.skipCheck ? GD.skipCheck(w, p, events) : null;
    if (!res.dead && !skip) return { ok: true, events, repairs, ms: Date.now() - t0, log };
    if (repairs === (opts.maxRepairs ?? 12)) break;
    // the failure: death, or the first skipped portal
    const td = res.dead ? p.length - 1 : Math.max(0, skip.dieAt.tick ?? p.findIndex(q => q.x >= skip.dieAt.x));
    const xd = p[Math.max(0, td)].x;
    let c = Math.max(0, td - GD.PHYS.TPS);
    while (c > 0 && !I.calm(w, p[c])) c--;
    const heldAt = I.heldBefore ? I.heldBefore(events, c) : false;
    const goalX = xd + 180;
    const sv = GD.solveSweep(w, { start: p[c], held: heldAt, goal: (st, h) => st.x >= goalX && !!st.grounded === true });
    if (!sv || !sv.ok) { log.push(`block ${(xd / 30).toFixed(1)}: no local repair (${res.dead ? res.why : skip.why + " " + (skip.skipped || "")})`); return { ok: false, events, repairs, ms: Date.now() - t0, log, dieX: xd }; }
    const T = sv.goalTick ?? (sv.events.length ? sv.events[sv.events.length - 1].tick + 1 : c);
    const prefix = events.filter(e => e.tick < c).concat(sv.events.filter(e => e.tick >= c && e.tick < T));
    const pp = GD.run(w, prefix).path, st = pp[Math.min(T, pp.length - 1)];
    const h = prefix.length ? prefix[prefix.length - 1].type === "press" : false;
    events = prefix.concat(drive(w, list.filter(e => e.x > st.x), st, h));
    log.push(`block ${(xd / 30).toFixed(1)}: repaired by a local search (ticks ${c}-${T}, ${res.dead ? res.why : skip.why})`);
  }
  return { ok: false, events, repairs, ms: Date.now() - t0, log };
}

// ---- 4. secret ways: before each portal, a short search for a way past it without taking it ----
function probe(w, events) {
  const p = GD.run(w, events).path, out = [];
  const ports = w.items.filter(b => ["mode", "gravity", "speed", "size", "teleport"].includes(b.kind));
  const I = INC();
  for (const b of ports) {
    let c = p.findIndex(q => q.x >= b.x0 - 120); if (c < 0) continue;
    while (c > 0 && !I.calm(w, p[c])) c--;
    const held = I.heldBefore ? I.heldBefore(events, c) : false;
    const sv = GD.solveSweep(w, { start: p[c], held, anyRoute: true, cap: 1500,
      goal: st => st.x >= b.x1 + 60 && !st.used.includes(b.i) && st.x <= b.x1 + 400 });
    if (sv && sv.ok) out.push({ x: b.x0, what: (b.d && b.d.name) || b.kind });
  }
  return out;
}

module.exports = { relInputs, intents, drive, verify, probe };

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("// node")).join("\n")); process.exit(1); }
  const spec = JSON.parse(fs.readFileSync(file, "utf8")), { build } = require("./make.js");
  const t0 = Date.now(), log0 = console.log; console.log = () => {};
  const b = build(spec, file); console.log = log0;
  const w = GD.makeWorld(b.level.objects, b.level.header), tl = GD.SYNC ? GD.SYNC.timeline(w) : require("../lib/sync.js").SYNC.timeline(w);
  const t1 = Date.now(), { intents: list, missing } = intents(b.ctx.placements || [], tl, { raw: b.ctx.raw });
  const t2 = Date.now(), v = verify(w, b.level, list);
  console.log(`${spec.name}: ${list.length} intended inputs from ${(b.ctx.placements || []).length} patterns (inputs ready in ${((t2 - t1) / 1000).toFixed(1)} s${missing.length ? "; no intent for " + missing.join(", ") : ""})`);
  console.log(`   verify: ${v.ok ? "PASSES" : "does not pass"} with ${v.repairs} local repair(s) in ${(v.ms / 1000).toFixed(1)} s` + (v.log.length ? "\n   " + v.log.join("\n   ") : ""));
  if (process.argv.includes("--probe") && v.ok) { const t3 = Date.now(), s = probe(w, v.events); console.log(`   secret ways: ${s.length ? s.map(x => `${x.what} at block ${(x.x / 30).toFixed(0)}`).join("; ") : "none"} (${((Date.now() - t3) / 1000).toFixed(1)} s)`); }
  console.log(`   total ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
