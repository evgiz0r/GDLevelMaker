// node tools/model.js <level.gdlvl>                 -- the level's MODEL: its sections with role, energy, look and vehicle
//                                                     (the coordinator's brief when the level has one, else derived from
//                                                     the level) -> printed, and saved as levels/<slug>.model.json
// node tools/model.js check <before.gdlvl> <after.gdlvl>  -- does a fix keep the model? its size (small / medium /
//                                                     large) and, for the sections it touches, role / energy / look /
//                                                     vehicle kept or not
//
// The user (2026-11-24): "when we fix/reshape a level, i wonder if we also call such person [the coordinator], depending
// on the size of the fix. so that the fix matches the level anyway." Every level keeps a model next to it; fixes go
// through it by size (BUILDING.md 1 "Fixes through the model", EDITING.md):
//   small  (a few objects at one spot): this check, automatic -- the section keeps its role (a calm part does not get
//          much denser, a drop does not thin out), its energy (hazards per 100 blocks within ~35%), its look (the same
//          colour triggers) and its vehicle (the same modes / speeds);
//   medium (one section reworked): the coordinator reviews the new section against its role before it lands
//          (tools/coordinator.js review, for collab levels; else this check, read by a session);
//   large  (several sections, a mode / speed change, a retarget or restyle): re-plan the model first, then build.
// Model sources, best first: the coordinator's brief (briefs/*.coord.json naming the level), a vibe sheet next to the
// level's brief, gd-showcase's storyboard (tools/storyboard.js, when it exists), else derived here: sections from the
// bg colour triggers (each look change starts one), energy from hazard density, role from energy by rank.
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const { GD, readGdlvl } = require("./io.js");
const kindOf = o => (GD.objInfo(o.id) || {}).kind;

// the level's sections: from the coordinator's brief when there is one (by song time), else from its bg colour changes
function sectionsOf(L) {
  const objs = L.level.objects, end = Math.max(...objs.filter(o => ["solid", "hazard"].includes(kindOf(o))).map(o => o.x), 300);
  const bg = objs.filter(o => o.id === 899 && String((o.props || {})[23]) === "1000").map(o => o.x).sort((a, b) => a - b);
  const cuts = [0]; for (const x of bg) if (x - cuts[cuts.length - 1] >= 300) cuts.push(x);
  cuts.push(end + 30);
  return cuts.slice(0, -1).map((x0, i) => ({ x: [x0, cuts[i + 1]] }));
}
function measure(L, x0, x1) {
  const objs = L.level.objects.filter(o => o.x >= x0 && o.x < x1), blocks = Math.max(1, (x1 - x0) / 30);
  const haz = objs.filter(o => kindOf(o) === "hazard").length / blocks * 100;
  const look = objs.filter(o => o.id === 899 || o.id === 1006).map(o => [o.id, Math.round(o.x / 30), (o.props || {})[23], (o.props || {})[7], (o.props || {})[8], (o.props || {})[9]].join(":")).sort().join("|");
  const vehicle = [...new Set(objs.filter(o => ["mode", "speed", "gravity"].includes(kindOf(o))).map(o => (GD.objInfo(o.id) || {}).name))].sort();
  return { haz: +haz.toFixed(1), look, vehicle };
}
function coordFor(name) {
  const dir = path.join(ROOT, "briefs");
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".coord.json"))) { try { const c = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); if (c.level === name) return c; } catch (e) {} }
  return null;
}
function modelOf(file) {
  const L = readGdlvl(file), coord = coordFor(L.name);
  const secs = sectionsOf(L).map(s => Object.assign(s, measure(L, s.x[0], s.x[1])));
  // roles from energy by rank (derived), or the coordinator's by song time
  const ranked = secs.slice().sort((a, b) => a.haz - b.haz);
  secs.forEach((s, i) => { const r = ranked.indexOf(s) / Math.max(1, secs.length - 1);
    s.role = i === 0 ? "intro" : i === secs.length - 1 ? "finale" : r >= 0.75 ? "drop" : r <= 0.25 ? "calm" : "build"; s.energy = +(0.2 + 0.8 * r).toFixed(2); });
  if (coord) {
    const w = GD.makeWorld(L.level.objects, L.level.header), tl = GD.SYNC.timeline(w);
    for (const s of secs) { const t = GD.SYNC.tOfX(tl, (s.x[0] + s.x[1]) / 2), cp = coord.parts.find(p => t >= p.t[0] && t < p.t[1]); if (cp) { s.role = cp.role; s.energy = cp.energy; s.part = cp.id; } }
  }
  return { level: L.name, source: coord ? "coordinator (" + coord.brief + ")" : "derived from the level", lookRule: coord ? coord.look : "per section", sections: secs };
}
const save = (file, m) => { const out = file.replace(/\.gdlvl$/, ".model.json"); fs.writeFileSync(out, JSON.stringify(m, null, 1)); return out; };

// a fix against the model: which objects changed, how big the fix is, and whether each touched section keeps its model
function checkFix(beforeFile, afterFile) {
  const A = readGdlvl(beforeFile), B = readGdlvl(afterFile), m = modelOf(beforeFile);
  const key = o => o.id + "@" + Math.round(o.x) + "," + Math.round(o.y);
  const GP = new Set(["solid", "hazard", "slope", "orb", "pad", "mode", "speed", "gravity", "portal"]);
  const ka = new Map(A.level.objects.filter(o => GP.has(kindOf(o))).map(o => [key(o), o])), kb = new Map(B.level.objects.filter(o => GP.has(kindOf(o))).map(o => [key(o), o]));
  const changed = [...[...ka.keys()].filter(k => !kb.has(k)).map(k => ka.get(k)), ...[...kb.keys()].filter(k => !ka.has(k)).map(k => kb.get(k))];
  // a section is touched by a gameplay change in it, or by a change of its look (colour triggers: a recolour is a fix too)
  const lookMoved = m.sections.filter(s => measure(A, s.x[0], s.x[1]).look !== measure(B, s.x[0], s.x[1]).look);
  const touched = m.sections.filter(s => changed.some(o => o.x >= s.x[0] && o.x < s.x[1]) || lookMoved.includes(s));
  const span = changed.length ? (Math.max(...changed.map(o => o.x)) - Math.min(...changed.map(o => o.x))) / 30 : 0;
  const modeChange = changed.some(o => ["mode", "speed", "gravity"].includes(kindOf(o)));
  const size = !changed.length && !lookMoved.length ? "none" : touched.length > 1 || modeChange || span > 40 ? "large" : changed.length > 8 || span > 6 || lookMoved.length ? "medium" : "small";
  const notes = [];
  for (const s of touched) {
    const a = measure(A, s.x[0], s.x[1]), b = measure(B, s.x[0], s.x[1]), d = a.haz ? (b.haz - a.haz) / a.haz : (b.haz ? 1 : 0);
    const where = `section at block ${Math.round(s.x[0] / 30)}-${Math.round(s.x[1] / 30)} (${s.role}${s.part ? ", " + s.part : ""})`;
    if ((s.role === "calm" || s.role === "intro") && d > 0.35) notes.push(`${where}: hazards ${a.haz} -> ${b.haz}/100 blocks -- a ${s.role} getting much denser`);
    if (s.role === "drop" && d < -0.35) notes.push(`${where}: hazards ${a.haz} -> ${b.haz} -- the drop thinning out`);
    if (Math.abs(d) > 0.6) notes.push(`${where}: its energy moved ${Math.round(d * 100)}% (hazards ${a.haz} -> ${b.haz})`);
    if (a.look !== b.look) notes.push(`${where}: its look changed (colour triggers): the level's look rule is "${m.lookRule}"`);
    if (a.vehicle.join() !== b.vehicle.join()) notes.push(`${where}: its vehicle changed (${a.vehicle.join(", ") || "cube"} -> ${b.vehicle.join(", ") || "cube"})`);
  }
  const next = size === "small" ? (notes.length ? "the fix leaves the section's model: rethink it, or make it a medium fix" : "keeps the model")
    : size === "medium" ? "medium: the coordinator reviews the new section against its role before it lands"
    : size === "large" ? "large: re-plan the model first (the coordinator), then build" : "nothing changed";
  return { ok: !notes.length && size !== "large", size, changed: changed.length, span: +span.toFixed(1), sections: touched.map(s => ({ x: s.x, role: s.role, part: s.part || null })), notes, next, model: m.source };
}

module.exports = { modelOf, checkFix, save, measure };

if (require.main === module) {
  const [a, b, c] = process.argv.slice(2);
  if (a === "check" && b && c) { const r = checkFix(b, c); console.log(`fix: ${r.size} (${r.changed} gameplay object(s), ${r.span} blocks) against the model (${r.model}): ${r.ok ? "keeps it" : "see below"} -- ${r.next}`); for (const n of r.notes) console.log("   " + n); process.exit(r.ok ? 0 : 2); }
  else if (a) { const m = modelOf(a); console.log(`${m.level}: model ${m.source}, look rule ${m.lookRule}`); for (const s of m.sections) console.log(`  block ${Math.round(s.x[0] / 30)}-${Math.round(s.x[1] / 30)}  ${s.role.padEnd(6)} energy ${s.energy}  hazards ${s.haz}/100  ${s.vehicle.join(", ") || "cube"}${s.part ? "  (" + s.part + ")" : ""}`); console.log("-> " + save(a, m)); }
  else console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("// node")).join("\n"));
}
