// Loads levels to study, in memory only (nothing here is written anywhere):
//   official(n)  the game's own levels from the install (RobTop's: never commit them)
//   mine()       the user's created levels from their save (CCLocalLevels.dat, read only)
//   file(path)   a .gdlvl
// Each returns { name, source, header, objects, rec? }.
const fs = require("fs"), path = require("path"), zlib = require("zlib");
const { GD, unpack, readGdlvl } = require("./io.js");

const OFFICIAL_DIR = require("./gdpaths.js").LEVELS;
const SAVE = process.env.GD_SAVE_FILE || path.join(require("./gdpaths.js").SAVE, "CCLocalLevels.dat");
const NAMES = ["Stereo Madness", "Back On Track", "Polargeist", "Dry Out", "Base After Base", "Cant Let Go",
  "Jumper", "Time Machine", "Cycles", "xStep", "Clutterfunk", "Theory of Everything", "Electroman Adventures",
  "Clubstep", "Electrodynamix", "Hexagon Force", "Blast Processing", "Theory of Everything 2",
  "Geometrical Dominator", "Deadlocked", "Fingerdash", "Dash"];

function official(n) {
  const text = unpack(fs.readFileSync(path.join(OFFICIAL_DIR, n + ".txt"), "utf8"));
  const L = GD.parseLevel(text);
  return { name: `official ${n}: ${NAMES[n - 1]}`, short: NAMES[n - 1], source: "official", n, header: L.header, objects: L.objects };
}
function officialAll() { const out = []; for (let n = 1; n <= 22; n++) out.push(official(n)); return out; }

// the save: XOR 11 -> base64url -> gzip -> plist; levels are the k_N dicts under LLM_01
function decodeSave(buf) {
  const s = Buffer.from(buf.map(b => b ^ 11)).toString("latin1").replace(/\0/g, "").trim();
  return zlib.gunzipSync(Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64")).toString("utf8");
}
function mine() {
  const xml = decodeSave(fs.readFileSync(SAVE));
  const out = [];
  const re = /<k>k_\d+<\/k><d><k>kCEK<\/k><i>4<\/i>/g;
  let m;
  while ((m = re.exec(xml))) {
    // the record runs to its balanced </d>
    let p = m.index + m[0].length, d = 1;
    while (d > 0) {
      const o = xml.indexOf("<d>", p), c = xml.indexOf("</d>", p);
      if (o >= 0 && o < c) { d++; p = o + 3; } else { d--; p = c + 4; }
    }
    const inner = xml.slice(m.index + m[0].length, p - 4);
    const rec = GD.parseRecord('<plist version="1.0"><dict><k>kCEK</k><i>4</i>' + inner + "</dict></plist>");
    const k4 = GD.getField(rec, "k4");
    if (!k4) continue;
    let text;
    try { text = unpack(k4); } catch (e) { continue; }
    const L = GD.parseLevel(text);
    const name = GD.getField(rec, "k2") || "?";
    out.push({ name: "mine: " + name, short: name, source: "mine", header: L.header, objects: L.objects, rec, levelStr: text });
  }
  return out;
}
function file(f) {
  const L = readGdlvl(f);
  return { name: L.name, short: L.name, source: "file", header: L.level.header, objects: L.level.objects, rec: L.rec };
}

module.exports = { official, officialAll, mine, file, NAMES };
if (require.main === module) {
  for (const l of mine()) console.log(l.short.padEnd(30), l.objects.length);
  for (const l of officialAll()) console.log(l.short.padEnd(30), l.objects.length);
}
