// node tools/orbchain_try.js [--n 2,3] [--dx 3] [--row 2,3] [--climb 0,1] [--first 1] [--gap 2] [--run 4] [--plat 4] [--plat-h 1] [--land-h 2]
// (~6 s per layout: keep the lists short)
// Try orb-chain layouts in a small world of their own and rank them by their tightest orb window:
// a ground run, a takeoff platform (`--plat` columns, `--plat-h` rows), a spike pit with the orbs over
// it, and a landing platform that starts right where the spikes end (an early landing must not hit a
// wall: GDLM 46 v2's end chain). Each layout: n orbs (2-3), `dx` columns apart, at fixed rows. Windows
// are the natural plan's tap windows (tools/polish.js: later inputs fixed in time), plus the climb in
// rows and how high the cube gets (knowledge/checklist.md: chains of 2-3, ~3 blocks apart, climbing
// ~1 block, a safe surface ~1 block after the last orb). Prints the best layouts as spec entries.
// Made for GDLM 46 v3 (2026-11-23, POLISH.md / SKETCH.md).
const { GD } = require("./io.js");
Object.assign(GD, require("../lib/natural.js"));
const P = require("./polish.js");
const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf("--" + k); return i < 0 ? d : +a[i + 1]; };
const RUN = opt("run", 4), PLAT = opt("plat", 4), PH = opt("plat-h", 1), LH = opt("land-h", 2);
const header = GD.DEFAULT_HEADER;
const ob = (id, c, r) => ({ id, x: c * 30 + 15, y: r * 30 + 15, rot: 0, flipX: false, flipY: false, props: { 155: "1" } });

function world(orbs, pitEnd) {
  const o = [], p0 = RUN, s0 = p0 + PLAT;
  for (let c = p0; c < s0; c++) for (let r = 0; r < PH; r++) o.push(ob(1, c, r));
  for (let c = s0; c < pitEnd; c++) o.push(ob(8, c, 0));
  for (let c = pitEnd; c < pitEnd + 6; c++) for (let r = 0; r < LH; r++) o.push(ob(1, c, r));
  for (const [c, r] of orbs) o.push(ob(36, c, r));
  return o;
}
const out = [];
const list = (k, d) => (a.includes("--" + k) ? a[a.indexOf("--" + k) + 1] : d).split(",").map(Number);
const NS = list("n", "2,3"), DXS = list("dx", "3"), R0S = list("row", "2,3"), CLIMBS = list("climb", "0,1"), FIRSTS = list("first", "1"), GAPS = list("gap", "2");
for (const n of NS) for (const dx of DXS) for (const r0 of R0S) for (const climb of CLIMBS) for (const first of FIRSTS) {
  const s0 = RUN + PLAT, orbs = [];
  for (let k = 0; k < n; k++) orbs.push([s0 + first + k * dx, r0 + Math.round(climb * k / Math.max(1, n - 1))]);
  const last = orbs[orbs.length - 1][0];
  let best = null;
  for (const gap of GAPS) {          // landing: the pit ends this many columns after the last orb
    const objs = world(orbs, last + gap), w = GD.makeWorld(objs, header);
    const r = GD.solveSweep(w); if (!r.ok) continue; // the exact solver blows up in these small worlds (3M states, minutes)
    let ev = r.events; try { const nn = GD.naturalPlan(w, r, objs); if (nn && P.clears(w, nn.events)) ev = nn.events; } catch (e) {}
    ev = ev.slice().sort((x, y) => x.tick - y.tick);
    const path = GD.run(w, ev).path, wins = P.allWindows(w, ev, path).filter(x => x.type !== "release");
    if (wins.length !== n + 1) continue;  // the takeoff jump + one press per orb, nothing else
    const top = Math.max(...path.map(p => p.y)) / 30;
    const min = Math.min(...wins.map(x => x.ms));
    if (!best || min > best.min) best = { n, dx, rows: orbs.map(o => o[1]), first, gap, min, wins: wins.map(x => x.ms), top: +top.toFixed(1), climb: orbs[n - 1][1] - orbs[0][1] };
  }
  if (best) out.push(best);
}
out.sort((x, y) => y.min - x.min);
console.log("n dx first rows      land  windows (ms: takeoff, orbs)   tightest  top row  climb");
for (const b of out.slice(0, opt("top", 15)))
  console.log(`${b.n} ${b.dx}  ${b.first}     ${JSON.stringify(b.rows).padEnd(9)} +${b.gap}    ${b.wins.join(" / ").padEnd(26)} ${String(b.min).padStart(4)}     ${b.top}     ${b.climb}`);
