// node tools/portals.js <level.gdlvl> [...]   -- every portal kind in a level with its count, and the game modes in order
//   (mode portals sorted by x, repeats folded). Layout only, no solve, no heavy lock. Built 2026-11-25 for the community
//   demon study (DIFFICULTY.md "Community demons"): tells at a glance which modes and specials (dual, mirror, mini,
//   speeds) a downloaded level needs before spending a solve on it.
const { readGdlvl } = require("./io.js");
const O = require("../lib/objects.js");

function portals(file) {
  const r = readGdlvl(file);
  const counts = {}, seq = [];
  let endX = 0;
  for (const o of r.level.objects || []) {
    if (o.x > endX) endX = o.x;
    const d = O.objInfo(o.id);
    if (!d || !(/portal/.test(d.name || "") || ["mode", "speed", "gravity", "size", "dual", "mirror", "teleport"].includes(d.kind))) continue;
    counts[d.name] = (counts[d.name] || 0) + 1;
    if (d.kind === "mode") seq.push([o.x, d.mode]);
  }
  seq.sort((a, b) => a[0] - b[0]);
  const modes = [];
  for (const [, m] of seq) if (modes[modes.length - 1] !== m) modes.push(m);
  return { name: r.name, objects: (r.level.objects || []).length, endX: Math.round(endX), counts, modes };
}

if (require.main === module) {
  for (const f of process.argv.slice(2)) {
    const p = portals(f);
    console.log(`${p.name} (${f}): ${p.objects} objects, ends at x ${p.endX}`);
    console.log("  portals:", Object.entries(p.counts).map(([k, v]) => `${k} ${v}`).join(", ") || "none");
    console.log("  modes:", [...new Set(p.modes)].join(", ") || "cube only", "| in order:", p.modes.join(" > "));
  }
}
module.exports = { portals };
