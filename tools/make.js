// node tools/make.js specs/<name>.json   -> levels/<name>.gdlvl, checked, and added to the viewer
//
// A spec is written in grid squares, not GD units: column 0 is where the player starts,
// row 0 is the first square above the ground.
// {
//   "name": "01 one jump",            // the name shown in GD's level list
//   "desc": "one spike",              // optional
//   "objects": [                      // [type, column, row, {extra}] -- extra: rot, flipX, flipY
//     ["spike", 12, 0],
//     ["block", 20, 0],
//     ["spike", 24, 3, {"rot": 180}]
//   ]
// }
// type is a name from TYPES below or a raw object id number.
//
// Style (see STYLE.md; tools/patterns.js, tools/decorate.js):
//   extra may also hold "group": n (fade/move target) and "ch": n (colour channel).
//   ["pattern", name, col, row, {args}, {extra for every object}]   a named chunk
//   ["colour", col, {"ch": "bg"|"ground"|"obj"|n, "rgb": [r,g,b], "secs": 0.5}]
//   ["fade", col, {"group": n, "to": 0, "secs": 0.2}]   alpha trigger: hide (or show) a group
//   ["zoom", col, {"to": 0.7}]                             camera zoom (0.7 = see more)
//   "style": "classic" -> outlined block skins + ground decoration
//   "colours": {"bg": [r,g,b], "ground": [r,g,b], ...}   start colours in the header
//   "art": {"bg": n, "ground": n}                        background / ground art numbers
const fs = require("fs");
const path = require("path");
const { GD, writeGdlvl } = require("./io.js");
const { report } = require("./check.js");
const { sightread } = require("./sightread.js");
const { buildIndex } = require("./index_levels.js");
const { expand } = require("./patterns.js");
const deco = require("./decorate.js");

const TYPES = { block: 1, spike: 8, "small spike": 39, "yellow orb": 36, "blue orb": 84, "yellow pad": 35, "blue pad": 67,
  "pink orb": 141, "red orb": 1333, "pink pad": 140, "mirror portal": 45, "mirror off": 46 };

function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); }

function toObj([type, col, row, extra], specFile) {
  const id = typeof type === "number" ? type : TYPES[type];
  if (!id) throw new Error(`unknown type "${type}" in ${specFile}`);
  const e = extra || {};
  const props = { 155: "1" };
  if (e.group != null) props[57] = String(e.group);
  if (e.ch != null) props[21] = String(e.ch);
  return { id, x: col * 30 + 15, y: row * 30 + 15, rot: e.rot || 0, flipX: !!e.flipX, flipY: !!e.flipY, props };
}

function make(specFile) {
  const spec = JSON.parse(fs.readFileSync(specFile, "utf8"));
  const objects = [];
  for (const entry of spec.objects) {
    const [type, col, row] = entry;
    if (type === "pattern") { for (const e of expand(entry[1], entry[2], entry[3], entry[4], entry[5])) objects.push(toObj(e, specFile)); continue; }
    if (type === "colour") { const a = entry[2]; objects.push(deco.colourTrigger(col, a.ch, a.rgb, a.secs ?? 0.5)); continue; }
    if (type === "fade") { const a = entry[2]; objects.push(deco.fadeTrigger(col, a.group, a.to ?? 0, a.secs ?? 0.2)); continue; }
    if (type === "zoom") { const a = entry[2] || {}; objects.push(deco.zoomTrigger(col, a.to ?? 0.7, a.secs ?? 0.5)); continue; }
    objects.push(toObj(entry, specFile));
  }
  let header = GD.DEFAULT_HEADER;
  if (spec.colours) header = deco.setHeaderColours(header, spec.colours);
  if (spec.art) header = deco.setHeaderArt(header, spec.art.bg, spec.art.ground);
  if (spec.style === "classic") {
    deco.skinBlocks(objects);
    const end = Math.max(...objects.map(o => o.x)) / 30 + 4;
    objects.push(...deco.groundDeco(objects, end, spec.seed || 7));
  }
  const level = { header, objects };
  const rec = GD.newRecord(spec.name, spec.desc || "made by GDLevelMaker");
  const out = path.join(__dirname, "..", "levels", slug(spec.name) + ".gdlvl");
  writeGdlvl(out, rec, level);
  const r = report(out);
  if (r.ok) { // the user's fairness rule: no prejumps (see tools/sightread.js)
    const s = sightread(level);
    const bad = s.ok ? s.presses.filter(p => p.flag) : [];
    for (const p of bad) console.log(`   PREJUMP at block ${p.from.toFixed(1)}-${p.to.toFixed(1)}: jump ${p.lead.toFixed(1)} blocks before ${p.cue} at ${p.cueAt.toFixed(1)}`);
    console.log(bad.length ? `   NOT sight-readable: ${bad.length} prejump(s)` : "   sight-readable: every press is cued by what is right in front");
  }
  buildIndex();
  return { out, r };
}

if (require.main === module) {
  const specs = process.argv.slice(2);
  if (!specs.length) { console.log("usage: node tools/make.js specs/<name>.json [...]"); process.exit(1); }
  for (const s of specs) make(s);
}
module.exports = { make, TYPES };
