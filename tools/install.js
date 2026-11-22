// node tools/install.js <level.gdlvl> [...] [--save <path>] [--dry]
//
// Puts levels straight into the game's save (Windows: %LOCALAPPDATA%\GeometryDash\CCLocalLevels.dat)
// so they appear at the top of Create -> My Levels. A level with the same name is replaced in
// place, so re-installing after an edit updates it instead of piling up copies.
//
// The game must be CLOSED: it rewrites this file when it exits, wiping anything put in meanwhile.
// Every run first copies the save to GeometryDash\gdlm_backups\ (restore = copy it back).
// --dry writes nothing to the save: it builds the new save in memory and checks it decodes.
//
// Save format: XOR every byte with 11 -> base64url -> gzip -> plist. Levels are the dict under
// LLM_01, keys k_0 (newest) .. k_N, each the same record a .gdlvl holds.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { execSync } = require("child_process");
const { unpack } = require("./io.js");

function decodeSave(buf) {
  const s = Buffer.from(buf.map(b => b ^ 11)).toString("latin1").replace(/\0/g, "").trim();
  return zlib.gunzipSync(Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64")).toString("utf8");
}
function encodeSave(xml) {
  const b64 = zlib.gzipSync(Buffer.from(xml, "utf8")).toString("base64").replace(/\+/g, "-").replace(/\//g, "_");
  return Buffer.from(Buffer.from(b64, "latin1").map(b => b ^ 11));
}
function gameRunning() {
  try { return /GeometryDash\.exe/i.test(execSync("tasklist", { encoding: "utf8" })); } catch (e) { return false; }
}
function levelNames(xml) {
  return [...xml.matchAll(/<k>(k_\d+)<\/k><d><k>kCEK<\/k><i>4<\/i>[\s\S]*?<k>k2<\/k><s>([^<]*)<\/s>/g)].map(m => m[2]);
}
// the level dicts under LLM_01, as [{key, text}] with balanced <d> nesting
function splitLevels(xml) {
  const start = xml.indexOf("<k>LLM_01</k><d>");
  if (start < 0) throw new Error("no LLM_01 in save");
  let i = start + "<k>LLM_01</k><d>".length, depth = 1, j = i;
  while (depth > 0) {
    const o = xml.indexOf("<d>", j), c = xml.indexOf("</d>", j);
    if (o >= 0 && o < c) { depth++; j = o + 3; } else { depth--; j = c + 4; }
  }
  const body = xml.slice(i, j - 4), items = [];
  let head = "", k = 0;
  const re = /<k>(k_\d+)<\/k><d>/g;
  const first = body.search(re);
  head = body.slice(0, first);
  k = first;
  while (k < body.length) {
    const m = /^<k>(k_\d+)<\/k><d>/.exec(body.slice(k));
    if (!m) throw new Error("unexpected save layout at " + k);
    let p = k + m[0].length, d = 1;
    while (d > 0) {
      const o = body.indexOf("<d>", p), c = body.indexOf("</d>", p);
      if (o >= 0 && o < c) { d++; p = o + 3; } else { d--; p = c + 4; }
    }
    items.push({ key: m[1], inner: body.slice(k + m[0].length, p - 4) });
    k = p;
  }
  return { before: xml.slice(0, i), head, items, after: xml.slice(j - 4) };
}
function joinLevels(parts) {
  return parts.before + parts.head + parts.items.map((it, n) => `<k>k_${n}</k><d>${it.inner}</d>`).join("") + parts.after;
}
function nameOf(inner) { const m = inner.match(/<k>k2<\/k><s>([^<]*)<\/s>/); return m ? m[1] : ""; }

function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const si = args.indexOf("--save");
  const save = si >= 0 ? args[si + 1] : path.join(process.env.LOCALAPPDATA || "", "GeometryDash", "CCLocalLevels.dat");
  const files = args.filter((a, n) => a.endsWith(".gdlvl") && args[n - 1] !== "--save");
  if (!files.length) { console.log("usage: node tools/install.js <level.gdlvl> [...] [--save path] [--dry]"); process.exit(1); }
  if (!dry && si < 0 && gameRunning()) { console.log("Geometry Dash is running. Close it first (it overwrites the save on exit)."); process.exit(3); }

  const buf = fs.readFileSync(save);
  const xml = decodeSave(buf);
  const parts = splitLevels(xml);
  if (joinLevels(parts) !== xml) throw new Error("save did not split/join cleanly; refusing to touch it");

  for (const f of files) {
    const rec = unpack(fs.readFileSync(f, "utf8"));
    const inner = rec.match(/<plist[^>]*><dict>([\s\S]*)<\/dict><\/plist>/)[1];
    const name = nameOf(inner);
    const at = parts.items.findIndex(it => nameOf(it.inner) === name);
    if (at >= 0) { parts.items[at].inner = inner; console.log(`replaced "${name}" (position ${at + 1})`); }
    else { parts.items.unshift({ key: "", inner }); console.log(`added "${name}" at the top`); }
  }
  const out = joinLevels(parts);
  const enc = encodeSave(out);
  if (decodeSave(enc) !== out) throw new Error("re-encoded save does not decode back; not writing");
  console.log("levels now:", levelNames(out).slice(0, 8).join(" | "), levelNames(out).length > 8 ? `... (${levelNames(out).length})` : "");
  if (dry) { console.log("dry run: nothing written"); return; }

  const bdir = path.join(path.dirname(save), "gdlm_backups");
  fs.mkdirSync(bdir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = path.join(bdir, `CCLocalLevels.${stamp}.dat`);
  fs.copyFileSync(save, backup);
  fs.writeFileSync(save, enc);
  console.log(`written. backup: ${backup}`);
}
main();
