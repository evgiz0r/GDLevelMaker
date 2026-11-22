// node tools/check.js <level.gdlvl> [...]   -- is it beatable, and where are the clicks?
const { GD, readGdlvl } = require("./io.js");

function report(file) {
  const L = readGdlvl(file);
  const w = GD.makeWorld(L.level.objects);
  const counts = {};
  for (const o of L.level.objects) { const d = GD.objInfo(o.id); counts[d.name] = (counts[d.name] || 0) + 1; }
  console.log(`== ${L.name}  (${file})`);
  console.log(`   ${L.level.objects.length} objects, ${(w.endX / 30).toFixed(0)} blocks, ${(w.endX / GD.PHYS.SPEED).toFixed(1)} s at 1x`);
  console.log("   " + Object.entries(counts).map(([k, v]) => `${k} x${v}`).join(", "));
  const unsim = L.level.objects.filter(o => ["orb", "pad", "unknown"].includes(GD.objInfo(o.id).kind));
  if (unsim.length) console.log(`   NOTE ${unsim.length} objects are not simulated yet (orbs, pads, unknown ids): the result below ignores them`);
  const r = GD.solve(w);
  if (!r.ok) {
    console.log(`   NOT BEATABLE with cube physics: the furthest run dies at x=${r.dieAt.x.toFixed(0)} (block ${(r.dieAt.x / 30).toFixed(1)}, ${(r.dieAt.tick / GD.PHYS.TPS).toFixed(2)} s), hit a ${r.why} at x=${r.killer.x}`);
    return r;
  }
  console.log(`   beatable: ${r.clicks.length} clicks`);
  for (const c of r.clicks) {
    console.log(`     t=${(c.tick / GD.PHYS.TPS).toFixed(3)} s  block ${(c.x / 30).toFixed(1)}  window ${c.ms} ms`);
  }
  if (r.clicks.length) console.log(`   tightest window: ${Math.min(...r.clicks.map(c => c.ms))} ms`);
  return r;
}

if (require.main === module) {
  const files = process.argv.slice(2);
  if (!files.length) { console.log("usage: node tools/check.js <level.gdlvl> [...]"); process.exit(1); }
  let bad = 0;
  for (const f of files) if (!report(f).ok) bad++;
  process.exit(bad ? 2 : 0);
}
module.exports = { report };
