// node tools/tas_why.js <n> [...]  -- where and why the sim dies on official level n's real-game plan:
// the killer, the last state changes (orbs, pads, portals, landings), the presses around it.
const { replay } = require("./tas.js");
const H = require("../lib/objects.js");
for (const n of process.argv.slice(2).map(Number)) {
  const r = replay(n, 0), P = r.r.path, e = r.r.end, k = r.killer;
  if (r.done) { console.log(`L${n}: clears`); continue; }
  console.log(`L${n} tick ${e.tick} block ${(e.x / 30).toFixed(2)} y ${(e.y / 30).toFixed(2)} vy ${e.vy.toFixed(2)} grav ${e.grav} ${e.mode}${e.mini ? " mini" : ""}`);
  if (k) console.log(`   killer ${k.id} ${H.objInfo(k.id).name} at ${(k.x / 30).toFixed(2)},${(k.y / 30).toFixed(2)} rot ${k.rot || 0} props ${JSON.stringify(k.props)}`);
  const ch = [];
  for (let t = Math.max(1, e.tick - 240); t <= e.tick; t++) {
    const p = P[t], q = P[t - 1];
    if ((p.act && p.act !== q.act) || p.grav !== q.grav || p.grounded !== q.grounded || p.mode !== q.mode)
      ch.push(`${t}:${p.act || ""}${p.grounded ? "G" : ""} x${(p.x / 30).toFixed(2)} y${(p.y / 30).toFixed(2)} vy${p.vy.toFixed(2)}`);
  }
  console.log("   last second:", ch.slice(-12).join(" | "));
  console.log("   presses:", r.ev.filter(v => v.tick > e.tick - 240 && v.tick <= e.tick + 20).map(v => v.type[0] + v.tick).join(" "));
}
