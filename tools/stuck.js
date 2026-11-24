// node tools/stuck.js <n | level.gdlvl> --x <units> [--back <units>] [--past <units>] [--y <lo,hi>]
//   Why a solve is stuck at a portal ("skipped a portal" / "stops at block B"): from the saved route's state --back
//   units (default 450) before x, every press/hold sequence (2 inputs a tick, states merged by y/vy/gravity/mode to
//   0.5 / 0.05) is played until it gets --past units (default 150) beyond x. It prints whether any sequence takes the
//   portals between, how far the ones that take them get, and what kills the rest (object id, kind, where, the
//   player's y). --y lo,hi: count only sequences that pass x with y in that band (a lane).
//   "No sequence takes it": the sim cannot do what the level asks there (a physics lead: hitbox, mode, portal).
//   "Some take it and live": the solver missed it (its pruning; a solver lead).
// Level: an official number (GD's own files, the saved route local/difficulty/NN.json) or a .gdlvl (its saved
// solution, tools/solutions.js). Built 2026-11-24 for Electroman's flat gravity portal at block 804.
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
const fs = require("fs"), path = require("path");
const { GD, unpack, readGdlvl } = require("./io.js");
const SRC = process.env.GD_LEVELS || "C:/Program Files (x86)/Steam/steamapps/common/Geometry Dash/Resources/levels/";
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
  const back = o.back, past = o.past;
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
    for (const n of front) for (const h of [false, true]) {
      const s = { ...n.s, used: n.s.used.slice() };
      GD.step(w, s, { press: h && !n.held, held: h });
      const tk = new Set(n.took); for (const i of took(s)) tk.add(i);
      if (s.dead) { const k = (s.killer ? s.killer.id + " " + Math.round(s.killer.x / 30 * 10) / 10 : s.why) + " (" + s.why + ")";
        const d = deaths.get(k) || { n: 0, ys: [], took: 0 }; d.n++; if (d.ys.length < 4) d.ys.push(Math.round(s.y)); if (tk.size) d.took++; deaths.set(k, d); continue; }
      const m = { s, held: h, took: tk };
      if (s.x >= X + past || s.done) { done.push(m); continue; }
      const kk = key(m); if (!nx.has(kk)) nx.set(kk, m);
    }
    front = [...nx.values()];
    if (front.length > 60000) { console.log(`  (too many states at tick ${tick}: ${front.length}; stopping early)`); break; }
  }
  return { portals, done, deaths, from: q.path[t] };
}

if (require.main === module) {
  const { L, events } = load(args[0]), w = GD.makeWorld(L.objects, L.header);
  const X = +opt("--x"), o = { back: +opt("--back", 450), past: +opt("--past", 150) };
  const band = opt("--y") ? opt("--y").split(",").map(Number) : null;
  const r = study(w, events, X, o);
  console.log(`from block ${(r.from.x / 30).toFixed(1)} (y ${r.from.y.toFixed(0)}, ${r.from.mode}, gravity ${r.from.grav}) to block ${((X + o.past) / 30).toFixed(1)}`);
  console.log("portals here: " + (r.portals.map(b => `${b.d.name} #${b.i} at block ${((b.x0 + b.x1) / 60).toFixed(1)} y ${Math.round(b.y0)}-${Math.round(b.y1)}`).join("; ") || "none"));
  const all = r.portals.map(b => b.i), takesAll = r.done.filter(m => all.every(i => m.took.has(i)));
  console.log(`sequences that get past: ${r.done.length}; taking every portal here: ${takesAll.length}`);
  for (const b of r.portals) console.log(`  ${b.d.name} #${b.i}: taken by ${r.done.filter(m => m.took.has(b.i)).length} that get past`);
  if (band) console.log(`  in the band y ${band[0]}-${band[1]} at the end: ${r.done.filter(m => m.s.y >= band[0] && m.s.y <= band[1]).length}`);
  console.log("deaths (killer id, block (why): count, player y, how many had taken a portal here):");
  for (const [k, d] of [...r.deaths.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 15)) console.log(`  ${k}: ${d.n}, y ${d.ys.join("/")}, ${d.took} took one`);
  console.log(takesAll.length ? "=> some sequences take it and live: a SOLVER lead (the sweep pruned them)" : r.portals.length ? "=> no sequence takes it and lives: a PHYSICS lead (hitbox, mode or portal there)" : "=> no portal in range");
}
module.exports = { study };
