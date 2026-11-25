// node tools/save_stats.js  -- reads (never writes) the player's own stats for the official levels
// from the game's save (CCGameManager.dat) into local/difficulty/user_stats.json, for
// tools/difficulty.js to compare with. Save format: XOR 11 -> base64url -> gzip -> plist.
// Keys per level (GLM_01 dict, entry "n"): k18 attempts (lifetime, incl. replays after beating),
// k36 jumps, k19 normal-mode best %, k20 practice best %, k88 the normal-mode new-best steps
// (e.g. "1,15,84": 1%, then +15 to 16%, then +84 to 100%).
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const SAVE = process.env.GD_SAVE_FILE || path.join(require("./gdpaths.js").SAVE, "CCGameManager.dat");
const OUT = path.join(__dirname, "..", "local", "difficulty", "user_stats.json");

function readSave(file) {
  const b = fs.readFileSync(file);
  for (let i = 0; i < b.length; i++) b[i] ^= 11;
  const s = b.toString("latin1").replace(/\0/g, "").replace(/-/g, "+").replace(/_/g, "/");
  return zlib.gunzipSync(Buffer.from(s, "base64")).toString("utf8");
}

function officialStats(xml) {
  const at = xml.indexOf("<k>GLM_01</k>"), out = {};
  if (at < 0) return out;
  for (let n = 1; n <= 22; n++) {
    const a = xml.indexOf(`<k>${n}</k><d><k>kCEK</k><i>4</i><k>k1</k><i>${n}</i>`, at);
    if (a < 0) continue;
    const seg = xml.slice(a, xml.indexOf("</d>", a));
    const g = k => { const r = new RegExp(`<k>${k}</k><[is]>([^<]*)<`).exec(seg); return r ? r[1] : null; };
    out[n] = { attempts: +g("k18") || 0, jumps: +g("k36") || 0, normal: +g("k19") || 0, practice: +g("k20") || 0,
               bestSteps: (g("k88") || "").split(",").filter(Boolean).map(Number) };
  }
  return out;
}

if (require.main === module) {
  const stats = officialStats(readSave(SAVE));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(stats, null, 1));
  for (const [n, s] of Object.entries(stats)) console.log(`${n.padStart(2)}  ${String(s.attempts).padStart(5)} attempts  normal ${s.normal}%  best steps ${s.bestSteps.join(",")}`);
}
module.exports = { readSave, officialStats };
