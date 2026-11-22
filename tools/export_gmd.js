// node tools/export_gmd.js levels/<name>.gdlvl [...] [--out dir]
// -> <name>.gmd: the same level as plain XML, the format GDShare (the Geode mod) imports.
// Used to get a level onto the user's phone: send the .gmd to the chat, download it on the
// phone, import it in GD with GDShare (Create -> My Levels -> import).
// A .gdlvl is base64url(gzip(record XML)); a .gmd is that record XML itself.
const fs = require("fs");
const path = require("path");
const { unpack } = require("./io.js");

const args = process.argv.slice(2);
const oi = args.indexOf("--out");
const out = oi >= 0 ? args[oi + 1] : path.join(__dirname, "..", "export");
const files = args.filter((a, i) => a.endsWith(".gdlvl") && args[i - 1] !== "--out");
if (!files.length) { console.log("usage: node tools/export_gmd.js levels/<name>.gdlvl [...] [--out dir]"); process.exit(1); }
fs.mkdirSync(out, { recursive: true });
for (const f of files) {
  const xml = unpack(fs.readFileSync(f, "utf8"));
  if (!/^<\?xml[^>]*\?><plist[^>]*><dict>[\s\S]*<\/dict><\/plist>$/.test(xml)) throw new Error(f + ": not a level record");
  const name = (xml.match(/<k>k2<\/k><s>([^<]*)<\/s>/) || [])[1] || path.basename(f, ".gdlvl");
  const dest = path.join(out, name.replace(/[^\w -]+/g, "").trim().replace(/\s+/g, "_") + ".gmd");
  fs.writeFileSync(dest, xml);
  console.log(`${f} -> ${dest} (${xml.length} bytes, "${name}")`);
}
