// node tools/triggers.js [file.gdlvl ...]  -- which trigger (and unknown) ids levels use, and how often.
// With no files: the 22 official levels from the GD install plus examples/. Used to pick which
// triggers to simulate first (PHYSICS.md, "Triggers").
const fs = require("fs"), path = require("path");
const { GD, unpack, readGdlvl } = require("./io.js");
const SRC = require("./gdpaths.js").LEVELS;
const SIM = { 901: "move", 1346: "rotate", 1049: "toggle", 1268: "spawn", 1616: "stop" };
const cnt = new Map(), where = new Map();
function add(objects, name) {
  for (const o of objects) {
    const d = GD.objInfo(o.id);
    if (d.kind !== "trigger" && d.kind !== "unknown") continue;
    cnt.set(o.id, (cnt.get(o.id) || 0) + 1);
    if (!where.has(o.id)) where.set(o.id, new Set());
    where.get(o.id).add(name);
  }
}
const files = process.argv.slice(2);
if (files.length) for (const f of files) add(readGdlvl(f).level.objects, path.basename(f));
else {
  for (let n = 1; n <= 22; n++) { try { add(GD.parseLevel(unpack(fs.readFileSync(path.join(SRC, n + ".txt"), "utf8"))).objects, "lv" + n); } catch (e) {} }
  const ex = path.join(__dirname, "..", "examples");
  for (const f of fs.readdirSync(ex).filter(f => f.endsWith(".gdlvl"))) add(readGdlvl(path.join(ex, f)).level.objects, f);
}
for (const [id, c] of [...cnt].sort((a, b) => b[1] - a[1]))
  console.log(`${String(id).padStart(5)} ${String(c).padStart(5)}x in ${where.get(id).size} levels  ${SIM[id] ? "simulated: " + SIM[id] : GD.objInfo(id).kind}  (${[...where.get(id)].slice(0, 6).join(", ")})`);
