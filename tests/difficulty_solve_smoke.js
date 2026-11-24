// node tests/difficulty_solve_smoke.js -- tools/difficulty_solve.js can read its levels (seconds, no solve).
// An official level (GD's own file; skipped when GD is not installed here) and a community level
// (local/community; skipped when none is downloaded) must load and build a world. Written after a
// search-and-replace made levelText call itself and every official solve crashed (2026-11-24).
const fs = require("fs"), path = require("path");
const ds = require("../tools/difficulty_solve.js"), { GD } = require("../tools/io.js");
let bad = 0, ran = 0;
const tryLevel = (n, why) => {
  try { const t = ds.levelText(n), L = GD.parseLevel(t), w = GD.makeWorld(L.objects, L.header); ran++;
    console.log(`ok   ${why}: ${L.objects.length} objects, ends at block ${(w.endX / 30).toFixed(0)}`); }
  catch (e) { bad++; console.log(`BAD  ${why}: ${String(e.message).split("\n")[0]}`); }
};
if (fs.existsSync(path.join(ds.SRC, "1.txt"))) tryLevel(1, "official 1"); else console.log("skip official (GD not installed here)");
const cdir = path.join(__dirname, "..", "local", "community");
const c = fs.existsSync(cdir) && fs.readdirSync(cdir).find(f => /^\d+\.gdlvl$/.test(f));
if (c) tryLevel("c" + c.replace(".gdlvl", ""), "community " + c); else console.log("skip community (none downloaded)");
process.exit(bad ? 1 : 0);
