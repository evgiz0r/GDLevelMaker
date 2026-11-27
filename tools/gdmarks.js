// node tools/gdmarks.js <save:<level name> | level.gdlvl | official:N> [--json]
// Marker blocks Evgeni puts in a level IN THE GD EDITOR (2026-11-27: "give me a marker to add to a level, so i put like a
// marker block"): a TEXT object (Edit -> the "A" text object, id 914) whose text starts with "@", e.g. "@ too tight here"
// or just "@". This lists each one with its spot: block column, row, % of the level, and the link to that moment.
// The same object without "@" is ordinary level text and is ignored. Install the level from his save first if needed:
// "save:GDLM 44" reads what is really in his game (read only).
// --strip <out.gdlvl>: a copy without the markers (Evgeni: "after its fixed you can remove the marker"): every fixed level
// goes back without them; a level we rebuild from our spec never has them anyway.
const path = require("path");
const { GD } = require("./io.js"), { levelOf } = require("./shoot.js");
const a = process.argv.slice(2);
if (!a[0] || a[0].startsWith("--")) { console.log(require("fs").readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }

function textOf(o) { const v = o.props && o.props[31]; if (v == null) return null;
  try { return Buffer.from(String(v).replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"); } catch (e) { return null; } }

function marks(levelStr) {
  const level = GD.parseLevel(levelStr), xs = level.objects.map(o => o.x), end = Math.max(...xs);
  return level.objects.filter(o => o.id === 914).map(o => ({ o, t: textOf(o) })).filter(z => z.t != null && z.t.trim().startsWith("@"))
    .map(z => ({ note: z.t.trim().slice(1).trim(), col: +(z.o.x / 30).toFixed(1), row: +(z.o.y / 30).toFixed(1), pct: +(100 * z.o.x / end).toFixed(1), x: z.o.x, y: z.o.y }))
    .sort((p, q) => p.x - q.x);
}

if (require.main === module) {
  const L = levelOf(a[0]), M = marks(L.levelStr);
  if (a.includes("--json")) console.log(JSON.stringify({ level: L.name, marks: M }));
  else { console.log(`${L.name}: ${M.length} marker${M.length === 1 ? "" : "s"}`);
    for (const m of M) console.log(`  col ${m.col}, row ${m.row} (${m.pct}%): ${m.note || "(no note)"}`); }
}
function strip(level) { level.objects = level.objects.filter(o => !(o.id === 914 && (textOf(o) || "").trim().startsWith("@"))); return level; }
if (require.main === module && a.includes("--strip")) { const io = require("./io.js"), out = a[a.indexOf("--strip") + 1];
  if (!/\.gdlvl$/.test(a[0])) { console.log("--strip works on a .gdlvl file (install it from the save first)"); process.exit(1); }
  const R = io.readGdlvl(a[0]), n = R.level.objects.length; strip(R.level); io.writeGdlvl(out, R.rec, R.level);
  console.log(`-> ${out}: ${n - R.level.objects.length} marker(s) removed`); }
module.exports = { marks, textOf, strip };
