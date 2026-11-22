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
const fs = require("fs");
const path = require("path");
const { GD, writeGdlvl } = require("./io.js");
const { report } = require("./check.js");
const { buildIndex } = require("./index_levels.js");

const TYPES = { block: 1, spike: 8, "small spike": 39, "yellow orb": 36, "blue orb": 84, "yellow pad": 35, "blue pad": 67 };

function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); }

function make(specFile) {
  const spec = JSON.parse(fs.readFileSync(specFile, "utf8"));
  const objects = spec.objects.map(([type, col, row, extra]) => {
    const id = typeof type === "number" ? type : TYPES[type];
    if (!id) throw new Error(`unknown type "${type}" in ${specFile}`);
    const e = extra || {};
    return { id, x: col * 30 + 15, y: row * 30 + 15, rot: e.rot || 0, flipX: !!e.flipX, flipY: !!e.flipY, props: { 155: "1" } };
  });
  const level = { header: GD.DEFAULT_HEADER, objects };
  const rec = GD.newRecord(spec.name, spec.desc || "made by GDLevelMaker");
  const out = path.join(__dirname, "..", "levels", slug(spec.name) + ".gdlvl");
  writeGdlvl(out, rec, level);
  const r = report(out);
  buildIndex();
  return { out, r };
}

if (require.main === module) {
  const specs = process.argv.slice(2);
  if (!specs.length) { console.log("usage: node tools/make.js specs/<name>.json [...]"); process.exit(1); }
  for (const s of specs) make(s);
}
module.exports = { make, TYPES };
