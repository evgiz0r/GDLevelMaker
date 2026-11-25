// node tools/stuck.js <n | level.gdlvl> --x <units> [--back <units>] [--past <units>] [--y <lo,hi>] [--every K] [--sweeps] [--trace]
//   Why a solve is stuck at a portal ("skipped a portal" / "stops at block B"): from the saved route's state --back
//   units (default 450) before x, every press/hold sequence (2 inputs a tick, states merged by y/vy/gravity/mode to
//   0.5 / 0.05) is played until it gets --past units (default 150) beyond x. It prints whether any sequence takes the
//   portals between, how far the ones that take them get, and what kills the rest (object id, kind, where, the
//   player's y). --y lo,hi: count only sequences that pass x with y in that band (a lane). --every K: the button may
//   change only on ticks divisible by K, as lib/physics.js solveSweep's input grid (K 4): is the grid what hides it?
//   "No sequence takes it": the sim cannot do what the level asks there (a physics lead: hitbox, mode, portal).
//   "Some take it and live": the solver missed it (its pruning; a solver lead).
// Level: an official number (GD's own files, the saved route local/difficulty/NN.json) or a .gdlvl (its saved
// solution, tools/solutions.js). Built 2026-11-24 for Electroman's flat gravity portal at block 804.
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
const fs = require("fs"), path = require("path");
const { GD, unpack, readGdlvl } = require("./io.js");
const SRC = require("./gdpaths.js").LEVELS;
const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
if (!args.length || opt("--x") == null) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).slice(0, 9).join("\n")); process.exit(1); }

function load(a) {
  if (/^\d+$/.test(a)) {
    const L = GD.parseLevel(unpack(fs.readFileSync(path.join(SRC, a + ".txt"), "utf8")));
    const r = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "local", "difficulty", String(a).padStart(2, "0") + ".json"), "utf8"));
    return { L, events: r.events };
  }
  const lv = readGdlvl(a), sol = require("./solutions.js").get(lv.levelStr, true);
  return { L: lv.level, events: sol ? sol.events : [] };
}

function study(w, events, X, o) {
  const back = o.back, past = o.past; o.every = o.every || 1;

  const q = GD.run(w, events);
  let t = q.path.findIndex(s => s.x >= X - back); if (t < 0) throw new Error("the saved route never gets to x " + (X - back));
  const ev = new Map(events.map(e => [e.tick, e.type])); let held = false;
  for (let k = 0; k < t; k++) { const e = ev.get(k); if (e === "press") held = true; if (e === "release") held = false; }
  const portals = w.items.filter(b => ["mode", "gravity", "speed", "size", "teleport", "dual"].includes(b.kind) && b.x1 > X - back && b.x0 < X + past);
  const took = s => portals.filter(b => s.used.includes(b.i) || (s.p2 && s.p2.used.includes(b.i))).map(b => b.i);
  let front = [{ s: { ...q.path[t], used: q.path[t].used.slice() }, held, took: new Set() }];
  const deaths = new Map(), done = [];
  const key = n => [Math.round(n.s.y * 2), Math.round(n.s.vy * 20), n.s.grav, n.s.mode, n.s.mini ? 1 : 0, n.s.grounded ? 1 : 0, n.held ? 1 : 0,
    [...n.took].sort().join("."), n.s.p2 ? Math.round(n.s.p2.y * 2) : ""].join(",");
  for (let tick = 0; front.length && tick < 4000; tick++) {
    const nx = new Map();
    for (const n of front) for (const h of (n.s.tick % o.every === 0 ? [false, true] : [n.held])) {
      const s = { ...n.s, used: n.s.used.slice() };
      GD.step(w, s, { press: h && !n.held, held: h });
      const tk = new Set(n.took); for (const i of took(s)) tk.add(i);
      if (s.dead) { const k = (s.killer ? s.killer.id + " " + Math.round(s.killer.x / 30 * 10) / 10 : s.why) + " (" + s.why + ")";
        const d = deaths.get(k) || { n: 0, ys: [], took: 0, sets: {} }; d.n++; if (d.ys.length < 4) d.ys.push(Math.round(s.y)); if (tk.size) d.took++;
        const sk = [...tk].sort((a, b) => a - b).join("+") || "none"; d.sets[sk] = (d.sets[sk] || 0) + 1; deaths.set(k, d); continue; }
      const m = { s, held: h, took: tk, parent: n };
      if (s.x >= X + past || s.done) { done.push(m); continue; }
      const kk = key(m); if (!nx.has(kk)) nx.set(kk, m);
    }
    front = [...nx.values()];
    if (front.length > 60000) { console.log(`  (too many states at tick ${tick}: ${front.length}; stopping early)`); break; }
  }
  // "takes every portal" = skips none the no-skip rule counts (GD.skipCheck on its path: stacked portals of one effect
  // are one, a portal that changes nothing is not required), judged only on the portals in range
  const outside = new Set(w.items.filter(b => !portals.includes(b)).map(b => b.i)), pre = q.path.slice(0, t);
  for (const m of done) { const ch = []; for (let k = m; k; k = k.parent) ch.push(k.s); m.skip = GD.skipCheck(w, pre.concat(ch.reverse()), [], outside); }
  return { portals, done, deaths, from: q.path[t] };
}

// --sweeps: the real solver (GD.solveFrom) from the same start with one setting changed at a time (default; a 10x front
// cap; the button free every tick; the fine merge), each with where it ends: which setting hides the way
function sweeps(w, events, X, o) {
  const q = GD.run(w, events); let t = q.path.findIndex(s => s.x >= X - o.back);
  const ev = new Map(events.map(e => [e.tick, e.type])); let held = false;
  for (let k = 0; k < t; k++) { const e = ev.get(k); if (e === "press") held = true; if (e === "release") held = false; }
  for (const [name, extra] of [["default", {}], ["cap 60000", { cap: 60000 }], ["every 1", { every: 1 }], ["fine", { fine: true }], ["every 1 + cap 60000", { every: 1, cap: 60000 }], ["allowSkips", { allowSkips: true }]]) {
    const t0 = Date.now(), r = GD.solveFrom(w, q.path[t], Object.assign({ held }, extra));
    if (r.ok && extra.allowSkips) { const pre = events.filter(e => e.tick < t), qq = GD.run(w, pre.concat(r.events));
      const used = new Set(); for (const s of qq.path) { for (const i of s.used) used.add(i); if (s.p2) for (const i of s.p2.used) used.add(i); }
      const P = w.items.filter(b => ["mode", "gravity", "speed", "size", "teleport", "dual"].includes(b.kind) && b.x0 > q.path[t].x && b.x1 < X + 900);
      console.log("    portals near, taken or not by the allowSkips route: " + P.map(b => `${b.d.name} #${b.i} @${(b.x0 / 30).toFixed(1)} y${Math.round(b.y0)} ${used.has(b.i) ? "taken" : "NOT"}`).join("; ")); }
    console.log(`  ${name.padEnd(20)} ${r.ok ? "BEATEN" : "stops at block " + (r.dieAt ? (r.dieAt.x / 30).toFixed(1) : "?") + " (" + r.why + (r.skipped ? ": " + r.skipped : "") + ")"}, peak front ${r.peak}, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
}

if (require.main === module) {
  const { L, events } = load(args[0]), w = GD.makeWorld(L.objects, L.header);
  if (args.includes("--trace")) {   // the default sweep from the same start: per tick, its states in a y band (--y lo,hi) and their skip count
    const [lo, hi] = (opt("--y") || "132,210").split(",").map(Number), X = +opt("--x"), back = +opt("--back", 450);
    const q = GD.run(w, events); const t = q.path.findIndex(s => s.x >= X - back);
    const ev = new Map(events.map(e => [e.tick, e.type])); let held = false;
    for (let k = 0; k < t; k++) { const e = ev.get(k); if (e === "press") held = true; if (e === "release") held = false; }
    let last = "";
    GD.solveFrom(w, q.path[t], { held, trace: (tk, front) => {
      const inb = front.filter(n => n.s.y >= lo && n.s.y <= hi), line = `${inb.length} in band (sp ${[...new Set(inb.map(n => n.sp))].join("/")}), front ${front.length}`;
      if (line !== last && front[0].s.x > X - back + 30) { console.log(`  block ${(front[0].s.x / 30).toFixed(1)}: ${line}`); last = line; } } });
    process.exit(0);
  }
  if (args.includes("--sweeps")) { sweeps(w, events, +opt("--x"), { back: +opt("--back", 450) }); process.exit(0); }
  const X = +opt("--x"), o = { back: +opt("--back", 450), past: +opt("--past", 150), every: +opt("--every", 1) };
  const band = opt("--y") ? opt("--y").split(",").map(Number) : null;
  const r = study(w, events, X, o);
  console.log(`from block ${(r.from.x / 30).toFixed(1)} (y ${r.from.y.toFixed(0)}, ${r.from.mode}, gravity ${r.from.grav}) to block ${((X + o.past) / 30).toFixed(1)}`);
  console.log("portals here: " + (r.portals.map(b => `${b.d.name} #${b.i} at block ${((b.x0 + b.x1) / 60).toFixed(1)} y ${Math.round(b.y0)}-${Math.round(b.y1)}`).join("; ") || "none"));
  const takesAll = r.done.filter(m => !m.skip);
  console.log(`sequences that get past: ${r.done.length}; skipping no portal that counts (GD.skipCheck): ${takesAll.length}`);
  const why = {}; for (const m of r.done) if (m.skip) why[m.skip.skipped] = (why[m.skip.skipped] || 0) + 1;
  for (const [k, c] of Object.entries(why)) console.log(`  ${c} skip ${k}`);
  for (const b of r.portals) console.log(`  ${b.d.name} #${b.i}: taken by ${r.done.filter(m => m.took.has(b.i)).length} that get past`);
  if (band) console.log(`  in the band y ${band[0]}-${band[1]} at the end: ${r.done.filter(m => m.s.y >= band[0] && m.s.y <= band[1]).length}`);
  console.log("deaths (killer id, block (why): count, player y, how many had taken a portal here):");
  for (const [k, d] of [...r.deaths.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 15)) console.log(`  ${k}: ${d.n}, y ${d.ys.join("/")}, portals taken: ${Object.entries(d.sets).map(([s, c]) => (s === "none" ? "none" : "#" + s.replace(/[+]/g, "+#")) + " x" + c).join(", ")}`);
  console.log(takesAll.length ? "=> some sequences take it and live: a SOLVER lead (the sweep pruned them)" : r.portals.length ? "=> no sequence takes it and lives: a PHYSICS lead (hitbox, mode or portal there)" : "=> no portal in range");
}
module.exports = { study };
