// node tools/orbarc.js <level.gdlvl> [--gate]
//
// Is every orb where a natural jump puts you? (The user on GDLM 44 v12's two orbs over the spike row:
// "very problematic area, its hard to time the orb to hit exactly there. the timing is unnatural and
// small".) For each orb the human route (lib/natural.js: a tap per jump) touches, this replays the route
// up to the press BEFORE the orb (the take-off jump, or the previous orb's press) and lets the cube fly
// on without pressing. On that free arc:
//   apex    where the arc tops out, and the orb's offset from it in blocks (dx > 0: the orb is after the
//           apex). Want the orb at the apex or just after it (-0.5 .. +1.5 blocks in x), and the arc
//           passing through the orb's box (|dy| under ~0.6 block at the orb's x): then the player simply
//           clicks when they reach the orb, with no need to time the take-off.
//   takeoff the take-off jump's window when each orb is clicked whenever the cube touches it (a player
//           reacts to the orb; with the orb presses fixed in time it reads 13-21 ms). Want >= 100 ms.
//   window  the press before the orb and the orb press, in ms (tools/polish.js windows, a tap moved as a pair)
//   thirds  whether the orbs of one hazard run sit on its halves or thirds (within half a block; the user:
//           symmetry over the spike row)
// --gate exits 1 when an orb is off its natural arc. POLISH.md "Orbs at the natural arc".
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
const fs = require("fs"), path = require("path");
const { GD, readGdlvl } = require("./io.js");
Object.assign(GD, require("../lib/natural.js"));
const P = require("./polish.js"), O = require("../lib/objects.js");
const args = process.argv.slice(2);
if (!args[0]) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }

const ORBS = new Set([36, 84, 141, 1022, 1333, 1594, 3004, 1330, 1704, 1751]);
const TH = { dxMin: -0.5, dxMax: 1.5, dyMax: 0.6, takeoffMs: 100 };


// The take-off window a player really has before an orb chain: the take-off tap moved tick by tick, and
// for each spot, ANY press on each orb while the cube touches it (the player clicks when they reach the
// orb) -- not the orb presses fixed in time, which reads 13-21 ms where a player has far more. Returns the
// contiguous range of take-off ticks around the planned one that clear, in ms.
function adaptiveTakeoff(w, ev, takeTick, orbs, span = 90) {
  const isDown = e => e.down === true || e.type === "press";
  ev = ev.slice().sort((a, b) => a.tick - b.tick);
  const ti = ev.findIndex(e => isDown(e) && e.tick === takeTick);
  if (ti < 0) return null;
  // drop the take-off tap and the next orbs.length taps; keep the rest
  const drop = new Set(), downs = [];
  for (let i = ti; i < ev.length && downs.length < orbs.length + 1; i++) if (isDown(ev[i])) { downs.push(i); drop.add(i); const r = ev.findIndex((e, j) => j > i && !isDown(e)); if (r >= 0) drop.add(r); }
  const rest = ev.filter((_, i) => !drop.has(i));
  const tap = t => [{ tick: t, type: "press" }, { tick: t + 1, type: "release" }];
  const srt = a => a.slice().sort((x, y) => x.tick - y.tick);
  const place = (evs, j, after) => {
    if (j === orbs.length) return P.clears(w, srt(evs));
    const path = GD.run(w, srt(evs)).path, o = orbs[j];
    for (let t = after + 2; t < path.length; t++) {
      const q = path[t]; if (!q || q.dead) break;
      if (q.x > o.x + 40) break;
      if (Math.abs(q.x - o.x) < 34 && Math.abs(q.y - o.y) < 34 && place(evs.concat(tap(t)), j + 1, t)) return true;
    }
    return false;
  };
  const ok = d => place(rest.concat(tap(takeTick + d)), 0, takeTick + d);
  let lo = 0, hi = 0;
  if (!ok(0)) return { ms: 0, lo: 0, hi: 0 };
  while (lo > -span && ok(lo - 1)) lo--;
  while (hi < span && ok(hi + 1)) hi++;
  return { lo, hi, ms: Math.round((hi - lo + 1) * 1000 / 240) };
}

function analyse(file) {
  const L = readGdlvl(file), objs = L.level.objects, w = GD.makeWorld(objs, L.level.header);
  let ev = null;
  try { const s = require("./solutions.js").get(L.levelStr, true); if (s && s.events) ev = s.events; } catch (e) {}
  if (!ev) { const r = GD.solveAny(w); if (!r.ok) throw new Error("cannot solve " + file); ev = r.events; try { const n = GD.naturalPlan(w, r, objs); if (n && P.clears(w, n.events)) ev = n.events; } catch (e) {} }
  ev = ev.slice().sort((a, b) => a.tick - b.tick);
  const run = GD.run(w, ev), path0 = run.path, wins = P.allWindows(w, ev, path0);
  const isDown = e => e.down === true || e.type === "press";
  const presses = ev.filter(isDown);
  const out = [];
  for (const orb of objs.filter(o => ORBS.has(o.id)).sort((a, b) => a.x - b.x)) {
    // the press that uses the orb: the first press while the cube is within the orb's box
    const k = presses.findIndex(p => { const q = path0[p.tick]; return q && Math.abs(q.x - orb.x) < 36 && Math.abs(q.y - orb.y) < 36; });
    if (k < 1) continue;                                // not on the route, or nothing before it
    const prev = presses[k - 1];
    // free flight from the previous press: keep every event up to and including its release, drop the rest
    const relIdx = ev.findIndex(e => !isDown(e) && e.tick > prev.tick);
    const keep = ev.filter((e, i) => e.tick <= prev.tick || (i === relIdx));
    const fr = GD.run(w, keep).path;
    let apex = null, flipped = (fr[prev.tick + 2] || {}).grav < 0;
    for (let t = prev.tick + 1; t < fr.length; t++) {
      const q = fr[t]; if (!q || q.dead) break;
      if (!apex || (flipped ? q.y < apex.y : q.y > apex.y)) apex = q;
      if (q.x > orb.x + 120) break;
    }
    let atOrb = null; for (let t = prev.tick; t < fr.length; t++) { const q = fr[t]; if (!q) break; if (q.x >= orb.x) { atOrb = q; break; } }
    const wp = wins.find(x => Math.abs(x.tick - prev.tick) <= 3), wo = wins.find(x => Math.abs(x.tick - presses[k].tick) <= 3);
    out.push({ orb: { id: orb.id, col: +(orb.x / 30 - 0.5).toFixed(1), row: +(orb.y / 30 - 0.5).toFixed(1) },
      dx: apex ? +((orb.x - apex.x) / 30).toFixed(2) : null, dy: atOrb ? +((orb.y - atOrb.y) / 30).toFixed(2) : null,
      apexCol: apex ? +(apex.x / 30 - 0.5).toFixed(1) : null, before: wp ? wp.ms : null, at: wo ? wo.ms : null, prevTick: prev.tick, obj: orb });
  }
  // hazard runs under the orbs: halves / thirds
  const haz = objs.filter(o => (O.objInfo(o.id) || {}).kind === "hazard" && o.y < 30).map(o => Math.round(o.x / 30 - 0.5)).sort((a, b) => a - b);
  const runs = []; for (const c of haz) { const r = runs[runs.length - 1]; if (r && c - r[1] <= 1) r[1] = c; else runs.push([c, c]); }
  for (const r of runs) {
    const on = out.filter(o => o.orb.col >= r[0] - 0.5 && o.orb.col <= r[1] + 0.5);
    if (!on.length) continue;
    const len = r[1] - r[0] + 1, n = on.length, marks = [];
    for (let i = 1; i <= n; i++) marks.push(r[0] - 0.5 + len * i / (n + 1));
    on.forEach((o, i) => { o.run = `${r[0]}-${r[1]}`; o.ideal = +marks[i].toFixed(1); o.sym = Math.abs(o.orb.col - marks[i]) <= 0.5; });
  }
  // the first orb of each chain: the take-off window with the orb presses re-timed as a player does
  const orbPressTicks = new Set();
  for (const orb of objs.filter(o => ORBS.has(o.id))) { const p = presses.find(p => { const q = path0[p.tick]; return q && Math.abs(q.x - orb.x) < 36 && Math.abs(q.y - orb.y) < 36; }); if (p) orbPressTicks.add(p.tick); }
  for (let i = 0; i < out.length; i++) {
    const o = out[i]; if (o.prevTick == null || orbPressTicks.has(o.prevTick)) continue;
    const chain = [o.obj]; for (let j = i + 1; j < out.length && orbPressTicks.has(out[j].prevTick); j++) chain.push(out[j].obj);
    o.takeoff = adaptiveTakeoff(w, ev, o.prevTick, chain);
  }
  for (const o of out) o.ok = (!o.takeoff || o.takeoff.ms >= TH.takeoffMs) && o.dx != null && o.dx >= TH.dxMin && o.dx <= TH.dxMax && o.dy != null && Math.abs(o.dy) <= TH.dyMax;
  return { name: L.name, orbs: out };
}

if (require.main === module) {
  const r = analyse(args[0]);
  console.log(`${r.name}: ${r.orbs.length} orbs on the route`);
  for (const o of r.orbs)
    console.log(`  orb ${o.orb.id} at block ${o.orb.col}, row ${o.orb.row}: ${o.dx == null ? "no apex" : (o.dx >= 0 ? o.dx + " after" : -o.dx + " before") + " the free arc's apex (block " + o.apexCol + ")"}, ` +
      `${o.dy == null ? "" : Math.abs(o.dy) + " blocks " + (o.dy > 0 ? "above" : "below") + " the arc"}; press before ${o.before ?? "?"} ms, orb ${o.at ?? "?"} ms` +
      (o.takeoff ? `; take-off ${o.takeoff.ms} ms with the orbs clicked on reach` : "") + (o.run ? `; spikes ${o.run}: ${o.sym ? "on" : "off"} the ${o.ideal}` : "") + (o.ok ? "" : "   OFF THE NATURAL ARC"));
  const bad = r.orbs.filter(o => !o.ok);
  console.log(bad.length ? `   ${bad.length} orb(s) off the natural arc` : "   every orb on its natural arc");
  process.exit(args.includes("--gate") && bad.length ? 1 : 0);
}
module.exports = { analyse, adaptiveTakeoff, TH };
