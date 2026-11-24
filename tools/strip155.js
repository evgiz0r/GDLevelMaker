// node tools/strip155.js [--dry]  -- one-off (2026-11-24): every level file without key 155, saved routes kept.
// Key 155 is GD 2.2's colour-batch index (tools/io.js strip155): our "1" on every object made the game draw all deco in
// one colour. tools/io.js no longer writes it; this rewrites the files already made (levels/gdlm_*.gdlvl and every
// .gdlvl under local/wip/) and copies each saved solution, window cache and stored level in local/solutions/ to the
// key tools/solutions.js now computes (the level string without 155), so nothing is solved again.
"use strict";
const fs = require("fs"), path = require("path"), zlib = require("zlib"), crypto = require("crypto");
const ROOT = path.join(__dirname, ".."), SOL = path.join(ROOT, "local", "solutions"), dry = process.argv.includes("--dry");
const io = require("./io.js"), { keyOf } = require("./solutions.js");
const oldKey = s => crypto.createHash("sha1").update(s).digest("hex").slice(0, 16);
// 1. caches: every stored level (lv/<old>.gz) -> its new key; copy <old>.* , wc/<old>.json.gz , lv/<old>.gz
let moved = 0;
const LV = path.join(SOL, "lv");
const all = fs.existsSync(SOL) ? fs.readdirSync(SOL) : [];
const migrate = (str) => {
  const o = oldKey(str), n = keyOf(str); if (o === n) return;
  for (const f of all) if (f.startsWith(o + ".")) { const t = path.join(SOL, n + f.slice(o.length)); if (!fs.existsSync(t)) { if (!dry) fs.copyFileSync(path.join(SOL, f), t); moved++; } }
  for (const [dir, ext] of [["wc", ".json.gz"], ["lv", ".gz"]]) { const a = path.join(SOL, dir, o + ext), b = path.join(SOL, dir, n + ext); if (fs.existsSync(a) && !fs.existsSync(b)) { if (!dry) fs.copyFileSync(a, b); moved++; } }
};
if (fs.existsSync(LV)) for (const f of fs.readdirSync(LV)) { try { migrate(zlib.gunzipSync(fs.readFileSync(path.join(LV, f))).toString("utf8")); } catch (e) {} }
// 2. level files
const files = fs.readdirSync(path.join(ROOT, "levels")).filter(f => /\.gdlvl$/.test(f)).map(f => path.join(ROOT, "levels", f));
const walk = d => { if (!fs.existsSync(d)) return; for (const f of fs.readdirSync(d)) { const p = path.join(d, f), st = fs.statSync(p); if (st.isDirectory()) walk(p); else if (/\.gdlvl$/.test(f)) files.push(p); } };
walk(path.join(ROOT, "local", "wip"));
let fixed = 0;
for (const f of files) {
  let R; try { R = io.readGdlvl(f); } catch (e) { continue; }
  if (!/,155,/.test(R.levelStr)) continue;
  migrate(R.levelStr);   // its route by the full string, if it was solved on this exact file
  if (!dry) io.writeGdlvl(f, R.rec, R.level);
  fixed++;
}
console.log(`${dry ? "(dry) " : ""}${fixed} level files without key 155; ${moved} cache files copied to their new keys`);
