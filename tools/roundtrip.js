// node tools/roundtrip.js <level.gdlvl> -- parse and re-serialise; must give back the same text
const fs = require("fs");
const { GD, unpack } = require("./io.js");
let bad = 0;
for (const f of process.argv.slice(2)) {
  const xml = unpack(fs.readFileSync(f, "utf8"));
  const rec = GD.parseRecord(xml);
  const lvl = unpack(GD.getField(rec, "k4"));
  const a = GD.serializeRecord(rec) === xml, b = GD.serializeLevel(GD.parseLevel(lvl));
  // object key order may differ from the game's; compare as sets of key/value pairs per object
  const norm = s => s.split(";").filter(Boolean).map(o => o.split(",").reduce((acc, v, i, arr) => (i % 2 ? acc : acc.concat(arr[i] + "=" + arr[i + 1])), []).sort().join(",")).join(";");
  const ok = a && norm(b) === norm(lvl);
  console.log(`${ok ? "ok  " : "FAIL"} ${f}  record:${a} objects:${norm(b) === norm(lvl)}`);
  if (!ok) bad++;
}
process.exit(bad ? 1 : 0);
