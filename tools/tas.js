// node tools/tas.js [n ...] [--shift k]  -- plays a real-game-verified input plan through our sim.
//
// gdsolver (github.com/gdsolver/gdsolver, MIT) publishes, for each of the 22 official levels, an
// input plan that clears the level in the real game (GD 2.2): one `input=<tick>,<buttons>` line
// per press/release at 240 Hz ticks, bit 0 = jump. If our sim, fed the same inputs, dies where the
// game did not, our physics or object table is wrong right there. Cheap: one run, no search.
// Plans are read from local/gdsolver/solution_lv<N>_dp.txt (gitignored; copy them from gdsolver's
// data/). Levels from the user's install, like tools/official.js. Nothing here is committed.
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
const fs = require("fs"), path = require("path");
const { GD, unpack } = require("./io.js");
const SRC = require("./gdpaths.js").LEVELS;
const PLANS = process.env.GDSOLVER_PLANS || path.join(__dirname, "..", "local", "gdsolver");

function loadPlan(n) {
  const ev = [];
  let held = false;
  for (const line of fs.readFileSync(path.join(PLANS, `solution_lv${n}_dp.txt`), "utf8").split(/\r?\n/)) {
    const m = /^input=(\d+),(\d+)/.exec(line);
    if (!m) continue;
    const h = (+m[2] & 1) === 1;
    // the plan's tick t is our step t-1: run() applies an event at s.tick before stepping, so
    // path[t] is the state after t steps, while the plans number the first update 1. Ground jumps
    // forgive a tick either way; orbs at the edge of their reach do not (lv11, 14, 16, 18, 19 get
    // much further with t-1 and no level gets less far).
    if (h !== held) ev.push({ tick: +m[1] - 1, type: h ? "press" : "release" });
    held = h;
  }
  return ev;
}

// GD reads the button 2 ticks late in ship and UFO mode and 1 tick late in the others (gdsolver's
// latOf, read off GD). loadPlan's events (already t-1) are the 1-tick case; in ship/UFO the button the
// body sees is the plan's one tick earlier. Ship plans got further with it (PHYSICS.md).
const LATE = { ship: 1, ufo: 1 };
function playLatent(w, ev, late) {
  late = late || LATE;
  const level = [];  // button level per step, by the 1-tick convention
  let held = false, k = 0;
  const sorted = ev.slice().sort((a, b) => a.tick - b.tick);
  const end = GD.maxTicksOf(w);
  for (let t = 0; t <= end; t++) { while (k < sorted.length && sorted[k].tick <= t) held = sorted[k++].type === "press"; level.push(held); }
  const s = GD.startState(w), path = [Object.assign({}, s, { used: s.used.slice() })];
  let prev = false;
  while (!s.dead && !s.done && s.tick < end) {
    const i = s.tick - (process.env.NOLATE ? 0 : (late[s.mode] || 0));
    const h = i >= 0 ? level[i] : false;
    GD.step(w, s, { press: h && !prev, held: h });
    prev = h;
    path.push(Object.assign({}, s, { used: s.used.slice() }));
  }
  return { path, dead: s.dead, done: s.done, why: s.why, killer: s.killer, end: path[path.length - 1] };
}

function replay(n, shift) {
  const level = unpack(fs.readFileSync(path.join(SRC, n + ".txt"), "utf8"));
  const L = GD.parseLevel(level);
  const w = GD.makeWorld(L.objects, L.header);
  const ev = loadPlan(n).map(e => ({ tick: e.tick + shift, type: e.type }));
  const r = playLatent(w, ev);
  const e = r.end;
  return { n, w, r, ev, x: e.x, done: r.done, why: r.why, killer: r.killer, tick: e.tick, mode: e.mode };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  let shift = 0;
  const si = args.indexOf("--shift");
  if (si >= 0) { shift = +args[si + 1]; args.splice(si, 2); }
  const ns = args.length ? args.map(Number) : Array.from({ length: 22 }, (_, i) => i + 1);
  for (const n of ns) {
    let res;
    try { res = replay(n, shift); } catch (err) { console.log(`${n}: ${err.message}`); continue; }
    const k = res.killer;
    console.log(`${n}: ${res.done ? "CLEARS" : `dies at block ${(res.x / 30).toFixed(1)} tick ${res.tick} (${res.why}${k ? `, id ${k.id} at ${(k.x / 30).toFixed(1)},${(k.y / 30).toFixed(1)}` : ""}) mode ${res.mode}`} -- end block ${(res.w.endX / 30).toFixed(0)}, ${res.ev.filter(e => e.type === "press").length} presses`);
  }
}
module.exports = { loadPlan, replay, playLatent };
