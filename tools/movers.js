// node tools/movers.js [n ... | file.gdlvl ...]  -- which moving-object triggers levels use, and which of them
//   reach things the player collides with. Default: the 22 official levels from the GD install.
// Per level, one line per trigger feature: how many triggers have it, and how many of those target a group
// holding hitboxes (solids, hazards, orbs, pads, portals) -- the ones that can change a solve. "sim" says
// whether lib/physics.js models it. Used to decide what to simulate next (PHYSICS.md "Moving objects").
const fs = require("fs"), path = require("path");
const { GD, unpack, readGdlvl } = require("./io.js");
const SRC = require("./gdpaths.js").LEVELS;
const args = process.argv.slice(2);
const levels = args.length ? args.map(a => /\.gdlvl$/.test(a) ? { name: path.basename(a), objects: readGdlvl(a).level.objects }
  : { name: "lv" + a, objects: GD.parseLevel(unpack(fs.readFileSync(path.join(SRC, a + ".txt"), "utf8"))).objects })
  : Array.from({ length: 22 }, (_, i) => i + 1).map(n => { try { return { name: "lv" + n, objects: GD.parseLevel(unpack(fs.readFileSync(path.join(SRC, n + ".txt"), "utf8"))).objects }; } catch (e) { return null; } }).filter(Boolean);
const groupsOf = o => { const g = o.props && o.props["57"]; return g ? String(g).split(".").map(Number).filter(n => n > 0) : []; };
// features: [name, test(trigger object), simulated?]
const P = o => o.props || {};
const FEATURES = [
  ["move", o => o.id === 901 && P(o)["100"] !== "1" && P(o)["58"] !== "1" && P(o)["59"] !== "1", "yes"],
  ["move lock to player", o => o.id === 901 && (P(o)["58"] === "1" || P(o)["59"] === "1"), "yes (unchecked)"],
  ["move to target (100)", o => o.id === 901 && P(o)["100"] === "1", "no"],
  ["rotate", o => o.id === 1346, "yes"],
  ["toggle", o => o.id === 1049, "yes (groups of objects; a toggled-off trigger still fires: no)"],
  ["spawn", o => o.id === 1268, "yes"],
  ["stop / pause / resume (580)", o => o.id === 1616, "stop only"],
  ["follow", o => o.id === 1347, "no"],
  ["follow player Y", o => o.id === 1814, "no"],
  ["scale", o => o.id === 2067, "no"],
  ["touch-triggered (11)", o => [901, 1346, 1049, 1268].includes(o.id) && P(o)["11"] === "1", "yes"],
  ["multi-trigger (87)", o => [901, 1346, 1049, 1268, 1616].includes(o.id) && P(o)["87"] === "1", "no: fires once"],
  ["collision block/trigger", o => [1815, 1816].includes(o.id), "no"],
  ["count / pickup", o => [1611, 1811, 1817].includes(o.id), "no"],
];
for (const L of levels) {
  const w = GD.makeWorld(L.objects, "");
  const hitG = new Set();
  for (const b of w.items) for (const g of b.groups || []) hitG.add(g);
  // a toggle or spawn can reach hitboxes through the triggers it controls: count the trigger's own target
  const rows = [];
  for (const [name, test, sim] of FEATURES) {
    const ts = L.objects.filter(test);
    if (!ts.length) continue;
    const hit = ts.filter(o => hitG.has(+P(o)["51"] || 0)).length;
    const xs = ts.filter(o => hitG.has(+P(o)["51"] || 0)).map(o => o.x / 30);
    rows.push(`  ${name.padEnd(28)} ${String(ts.length).padStart(4)}  on hitboxes ${String(hit).padStart(4)}${xs.length ? "  blocks " + Math.round(Math.min(...xs)) + "-" + Math.round(Math.max(...xs)) : ""}  [sim: ${sim}]`);
  }
  const dynKinds = {};
  for (const b of w.dyn || []) dynKinds[b.kind] = (dynKinds[b.kind] || 0) + 1;
  console.log(`${L.name}: ${rows.length ? "" : "no moving-object triggers"}${(w.dyn || []).length ? "moving hitboxes " + JSON.stringify(dynKinds) : ""}`);
  for (const r of rows) console.log(r);
}
