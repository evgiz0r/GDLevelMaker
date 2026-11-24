// node tools/hitroute.js briefs/<NN>.hits.json levels/<name>.gdlvl [--save]
//   -- play a hit-planned level (tools/hitlevel.js) the way it is meant: ONE tap exactly on each planned
//      hit (a ~60 ms tap, as a human taps), orb-pit cells with a second, buffered tap on the orb, and the
//      solver's own inputs only inside ship sections (their holds follow the music's flow). Reports
//      whether that run clears the level, where it dies if not, and per tap its window (how early / late
//      it can come with the others kept) and where the hit sits in it. --save stores the run as the
//      level's saved route (tools/solutions.js), so the viewer and the phone replay taps on the hits.
//   Heavy-ish (one replay per tap shift; a 60 s level ~1-2 min): takes the heavy slot.
if (require.main === module) require("./heavy.js").claim();
const fs = require("fs");
const { readGdlvl, GD } = require("./io.js");
const SOL = require("./solutions.js");

const TPS = 240, TAP = Math.round(0.06 * TPS);

function plan2route(plan, level, levelStr) {
  const P = 60 / plan.grid.bpm, t0 = plan.grid.t0, off = plan.offset || 0;
  const tOf = b => t0 + (b - 1) * P - off;
  const secs = plan.sections;
  const shipRanges = secs.map((s, i) => s.kind === "ship" ? [tOf(s.from), tOf(secs[i + 1].from)] : null).filter(Boolean);
  const taps = [];
  for (const [b, kind] of plan.cells) {
    if (kind === "pad") continue;
    taps.push({ beat: b, kind, tick: Math.round(tOf(b) * TPS) });
  }
  // the solver's inputs inside ship parts
  const sol = SOL.get(levelStr, true);
  const ship = [];
  if (sol) for (const e of sol.events) { const t = e.tick / TPS; if (shipRanges.some(([a, z]) => t > a + 0.05 && t < z)) ship.push(e); }
  return { taps, ship, tOf };
}

function eventsOf(taps, ship, extra) {
  const ev = [];
  for (const t of taps) { ev.push({ tick: t.tick, type: "press" }); ev.push({ tick: t.tick + TAP, type: "release" }); }
  for (const e of extra || []) ev.push(e);
  return ev.concat(ship).sort((a, b) => a.tick - b.tick || (a.type === "release" ? -1 : 1));
}

function main() {
  const [planFile, lvlFile] = process.argv.slice(2);
  const plan = JSON.parse(fs.readFileSync(planFile, "utf8"));
  const R = readGdlvl(lvlFile), w = GD.makeWorld(R.level.objects, R.level.header);
  const { taps, ship } = plan2route(plan, R.level, R.levelStr);
  const runOf = (ts, extra) => GD.run(w, eventsOf(ts, ship, extra));
  // orb cells: a second tap where the jump's arc meets the orb (buffered: try 2..60 ticks after the jump)
  const extra = [];
  for (const t of taps.filter(t => t.kind === "orb")) {
    let ok = null;
    for (let d = 30; d <= 110 && !ok; d += 2) {
      const e = [{ tick: t.tick + d, type: "press" }, { tick: t.tick + d + TAP, type: "release" }];
      const r = runOf(taps, extra.concat(e));
      const died = r.path[r.path.length - 1];
      const orbUsed = r.path.some(q => q.act === "yellow orb" && q.tick >= t.tick && q.tick <= t.tick + d + TAP);
      if (orbUsed && (!died.dead || died.tick > t.tick + 240)) ok = e;
    }
    if (ok) { extra.push(...ok); t.orbTick = ok[0].tick; }
    else console.log(`   orb at beat ${t.beat}: no buffered tap takes it`);
  }
  const r = runOf(taps, extra), last = r.path[r.path.length - 1];
  const cleared = !last.dead;
  console.log(`${R.name}: ${taps.length} taps on hits${extra.length ? ` + ${extra.length / 2} orb taps` : ""} + ${ship.filter(e => e.type === "press").length} ship presses -> ${cleared ? "CLEARS" : `DIES at t=${(last.tick / TPS).toFixed(2)} s, x block ${(last.x / 30).toFixed(1)} (${last.why || "?"})`}`);
  // windows: shift one tap with the rest fixed
  const survives = (i, d) => { const ts = taps.map((t, k) => k === i ? Object.assign({}, t, { tick: t.tick + d }) : t); const q = runOf(ts, extra).path; return !q[q.length - 1].dead; };
  let rows = [], minW = Infinity;
  if (cleared) for (let i = 0; i < taps.length; i++) {
    let lo = 0, hi = 0;
    while (lo > -96 && survives(i, lo - 1)) lo--;
    while (hi < 96 && survives(i, hi + 1)) hi++;
    const wms = (hi - lo + 1) / TPS * 1000; minW = Math.min(minW, wms);
    rows.push({ beat: taps[i].beat, kind: taps[i].kind, early: -lo / TPS * 1000, late: hi / TPS * 1000, wms });
    console.log(`   b${String(taps[i].beat).padEnd(6)} ${taps[i].kind.padEnd(6)} window ${wms.toFixed(0).padStart(4)} ms: the hit sits ${(-lo / TPS * 1000).toFixed(0)} ms after its start, ${(hi / TPS * 1000).toFixed(0)} ms before its end`);
  }
  if (rows.length) {
    const centred = rows.filter(r => Math.min(r.early, r.late) >= 0.25 * r.wms).length;
    console.log(`taps exactly on the hits clear the level. tightest window ${minW.toFixed(0)} ms; ${centred}/${rows.length} hits in the middle half of their window; ${rows.filter(r => r.wms >= 150).length}/${rows.length} windows >= 150 ms`);
  }
  if (process.argv.includes("--save") && cleared) {
    SOL.put(R.levelStr, { ok: true, events: eventsOf(taps, ship, extra), kind: "hits", plan: "hitroute" }, R.level);
    console.log("saved as the level's route (kind: hits)");
  }
}
if (require.main === module) main();
module.exports = { plan2route };
