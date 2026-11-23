// node tests/install_keeps_id.js
//
// Re-installing a level that is already shared online must keep its online ID (k1) and upload
// version (k16), so pressing Share again in GD updates the same upload (PUBLISH.md). Works on a
// COPY of the user's save in the OS temp folder (skips if there is no save); never touches the save.
const fs = require("fs"), os = require("os"), path = require("path"), zlib = require("zlib");
const { execFileSync } = require("child_process");

const save = path.join(process.env.LOCALAPPDATA || "", "GeometryDash", "CCLocalLevels.dat");
const level = path.join(__dirname, "..", "levels", "gdlm_44_hellgate.gdlvl");
const NAME = "GDLM 44 hellgate";
if (!fs.existsSync(save) || !fs.existsSync(level)) { console.log("skip: no save or no level file"); process.exit(0); }

const dec = b => zlib.gunzipSync(Buffer.from(Buffer.from(b.map(x => x ^ 11)).toString("latin1").replace(/\0/g, "").trim()
  .replace(/-/g, "+").replace(/_/g, "/"), "base64")).toString("utf8");
const enc = x => Buffer.from(Buffer.from(zlib.gzipSync(Buffer.from(x)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_"), "latin1").map(b => b ^ 11));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gdlm-install-test-"));
const copy = path.join(dir, "CCLocalLevels.dat");
let x = dec(fs.readFileSync(save));
const n = x.indexOf(`<k>k2</k><s>${NAME}</s>`);
if (n < 0) { console.log(`skip: "${NAME}" not in the save`); process.exit(0); }
// strip any real online keys of this record, then put fake ones in
const c = x.lastIndexOf("<k>kCEK</k><i>4</i>", n) + "<k>kCEK</k><i>4</i>".length;
const head = x.slice(c, n).replace(/<k>k(1|16)<\/k><i>[^<]*<\/i>/g, "");
x = x.slice(0, c) + "<k>k1</k><i>999000111</i><k>k16</k><i>3</i>" + head + x.slice(n);
fs.writeFileSync(copy, enc(x));

execFileSync(process.execPath, [path.join(__dirname, "..", "tools", "install.js"), level, "--save", copy], { stdio: "pipe" });
const y = dec(fs.readFileSync(copy));
const m = y.indexOf(`<k>k2</k><s>${NAME}</s>`);
const rec = y.slice(y.lastIndexOf("<k>kCEK</k>", m), m);
const ok = rec.includes("<k>k1</k><i>999000111</i>") && rec.includes("<k>k16</k><i>3</i>");
fs.rmSync(dir, { recursive: true, force: true });
console.log(ok ? "ok: online ID and version kept" : "FAIL: re-install dropped the online ID\n" + rec);
process.exit(ok ? 0 : 1);
