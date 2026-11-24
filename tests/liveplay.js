// node tests/liveplay.js  -- lib/liveplay.js (the viewer's "you play" mode and the plan replay of a build stage):
// 1. pressing and releasing live at a saved route's ticks gives exactly GD.run's path (same sim, same input rule);
// 2. a tap pressed and let go within one frame holds for one tick, like run()'s press + release a tick later;
// 3. practice: a checkpoint is saved where the run passes its x, and a restart from it continues from that state;
// 4. planEvents: a stage's data.events as they are, or data.planned (t in seconds) as presses with taps released.
const path = require("path"), fs = require("fs");
const { GD, readGdlvl } = require("../tools/io.js"); Object.assign(GD, require("../lib/liveplay.js"));
const ROOT = path.join(__dirname, "..");
let bad = 0; const check = (ok, what) => { console.log((ok ? "ok   " : "FAIL ") + what); if (!ok) bad++; };
const same = (a, b, n) => { for (let k = 0; k < n; k++) { const p = a[k], q = b[k]; if (!p || !q || p.x !== q.x || p.y !== q.y || p.vy !== q.vy || p.mode !== q.mode) return k; } return -1; };
for (const f of ["levels/gdlm_45_first_flight.gdlvl", "examples/cube_timings.gdlvl"].filter(f => fs.existsSync(path.join(ROOT, f)))) {
  const L = readGdlvl(path.join(ROOT, f)), w = GD.makeWorld(L.level.objects, L.level.header);
  let sol = null; try { sol = require("../tools/solutions.js").get(L.levelStr, true); } catch (e) {}
  if (!sol || !sol.ok) { console.log("skip " + f + " (no saved route on this PC)"); continue; }
  const ref = GD.run(w, sol.events), lp = GD.livePlay(w);
  // the live player: before stepping tick k, apply the inputs the route has at k (= a frame boundary there)
  const ev = sol.events.slice().sort((a, b) => a.tick - b.tick);
  for (const e of ev) { lp.advanceTo(e.tick); if (e.type === "press") lp.press(); else lp.release(); }
  lp.advanceTo(ref.path.length + 10);
  const k = same(ref.path, lp.path, ref.path.length);
  check(k < 0 && lp.path.length === ref.path.length && !!lp.state.done === !!ref.done, `${path.basename(f)}: live presses at the route's ticks = GD.run (${ref.path.length} ticks${k >= 0 ? ", differs at " + k : ""})`);
  // practice checkpoints: restart from the last one passed
  const cpx = ref.path[Math.floor(ref.path.length / 2)].x;
  const lp2 = GD.livePlay(w, { checkpoints: [cpx] });
  for (const e of ev) { lp2.advanceTo(e.tick); if (e.type === "press") lp2.press(); else lp2.release(); }
  lp2.advanceTo(ref.path.length + 10);
  const cp = lp2.cp; lp2.restart(true);
  check(cp && cp.x === cpx && lp2.path.length === cp.tick + 1 && lp2.state.x === ref.path[cp.tick].x && lp2.attempts === 2, `practice: restart at the checkpoint (x ${Math.round(cpx)}, tick ${cp && cp.tick})`);
  const rest = ev.filter(e => e.tick >= cp.tick);
  for (const e of rest) { lp2.advanceTo(e.tick); if (e.type === "press") lp2.press(); else lp2.release(); }
  lp2.advanceTo(ref.path.length + 10);
  check(same(ref.path, lp2.path, ref.path.length) < 0 && !!lp2.state.done === !!ref.done, "practice: from the checkpoint, the same inputs finish the same way");
  lp2.restart(false);
  check(lp2.path.length === 1 && lp2.cp === null || lp2.path.length === 1, "restart without practice: back to the start");
}
// a tap within one frame
{
  const L = readGdlvl(path.join(ROOT, "levels", "gdlm_01_one_jump.gdlvl")), w = GD.makeWorld(L.level.objects, L.level.header);
  const ref = GD.run(w, [{ tick: 30, type: "press" }, { tick: 31, type: "release" }]), lp = GD.livePlay(w);
  lp.advanceTo(30); lp.press(); lp.release(); lp.advanceTo(200);
  check(same(ref.path, lp.path, 200) < 0, "a tap pressed and released between two frames = press at k, release at k+1");
}
// planEvents
{
  const P = GD.PHYS.TPS;
  check(JSON.stringify(GD.planEvents({ events: [{ tick: 9, type: "release" }, { tick: 5, type: "press" }] })) === '[{"tick":5,"type":"press"},{"tick":9,"type":"release"}]', "planEvents: data.events, in order");
  const e = GD.planEvents({ planned: [{ t: 1, what: "jump" }, { t: 2, what: "jump" }, { t: 2.5, what: "release" }] });
  check(JSON.stringify(e) === JSON.stringify([{ tick: P, type: "press" }, { tick: P + 1, type: "release" }, { tick: 2 * P, type: "press" }, { tick: 2.5 * P, type: "release" }]), "planEvents: planned taps and a hold");
  check(GD.planEvents({}) === null && GD.planEvents(null) === null, "planEvents: no plan -> null");
}
console.log(bad ? `${bad} failed` : "all passed"); process.exit(bad ? 1 : 0);
