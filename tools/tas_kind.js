// node tools/tas_kind.js <kind> <id,id,...>  -- what if these object ids were another kind?
// Replays every real-game plan (tools/tas.js) with the ids re-kinded (solid, hazard, decoration...)
// and prints the levels whose reach changes. How 661-664 and 1903-1905 were found to be slabs,
// not the hazards OpenGD's table calls them. Cheap: 44 plain runs, no search.
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
const GD = require("../lib/objects.js");
const { replay } = require("./tas.js");
const [kind, list] = process.argv.slice(2);
if (!kind || !list) { console.log("usage: node tools/tas_kind.js <kind> <id,id,...>"); process.exit(1); }
const ns = Array.from({ length: 22 }, (_, i) => i + 1);
const reach = () => ns.map(n => { try { const r = replay(n, 0); return r.done ? Infinity : +(r.x / 30).toFixed(1); } catch (e) { return null; } });
const base = reach();
for (const id of list.split(",").map(Number)) GD.OBJECTS[id] = Object.assign({}, GD.objInfo(id), { id, kind });
const got = reach();
const diff = ns.map((n, i) => got[i] !== base[i] ? `${n}: ${base[i]} -> ${got[i]}` : null).filter(Boolean);
console.log(diff.join("  ") || "no change (no plan reaches these ids, or they do not matter there)");
