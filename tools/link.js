// node tools/link.js <level file | wip base | name> [--t 40] [--v 5] [--run <attempt id>] [--md]
// Links that open a level at a version, a moment and optionally one of the user's runs (LINKS.md). Every session that
// names a level in a report gives these (CLAUDE.md). Prints:
//   phone: <phone page>#<base>--v5--t40          (works anywhere: the Artifact keeps a plain #name; local/phone/url.txt)
//   pc:    http://localhost:8765/viewer/#lv=<file>&v=5&t=40
//   lan:   http://<this PC's LAN address>:8765/viewer/#lv=...   (the phone on the home wifi, while serve.js runs: GD art,
//          songs and runs too; the address can change when the router hands out another)
// The level is looked up like the viewer does: a file path, else a base name in local/wip/<session>/ or levels/; the
// version is the wip's newest unless --v. --md: one markdown line [name](phone link) for a chat report.
const fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.join(__dirname, "..");
const args = process.argv.slice(2), opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };

function find(w) {
  const om = /^official[:_]0*(\d+)$/.exec(String(w));
  if (om) { const b = "official_" + om[1].padStart(2, "0"); return { file: "local/" + b + ".json", base: b, version: 0 }; }
  const base = path.basename(String(w)).replace(/\.gdlvl$/, "");
  if (fs.existsSync(path.join(ROOT, w)) && /\.gdlvl$/.test(w)) return { file: w.replace(/\\/g, "/"), base, version: wipVersion(w) };
  // newest wip of that base across sessions, else levels/
  let best = null;
  try {
    for (const s of fs.readdirSync(path.join(ROOT, "local", "wip"))) {
      const f = path.join(ROOT, "local", "wip", s, base + ".gdlvl"); if (!fs.existsSync(f)) continue;
      const v = wipVersion("local/wip/" + s + "/" + base + ".gdlvl"), m = fs.statSync(f).mtimeMs;
      if (!best || m > best.m) best = { file: "local/wip/" + s + "/" + base + ".gdlvl", base, version: v, m };
    }
  } catch (e) {}
  if (best) return best;
  if (fs.existsSync(path.join(ROOT, "levels", base + ".gdlvl"))) return { file: "levels/" + base + ".gdlvl", base, version: 0 };
  return { file: w, base, version: 0, unknown: true };
}
// local/wip/<session>/<base>.json (tools/wip.js) keeps the version; 0 when it is not a wip
function wipVersion(f) {
  const m = /^local\/wip\/([\w-]+)\/([\w.-]+)\.gdlvl$/.exec(String(f).replace(/\\/g, "/")); if (!m) return 0;
  for (const meta of [path.join(ROOT, "local", "wip", m[1], m[2] + ".json"), path.join(ROOT, "local", "wip", m[1], "index.json")]) {
    try { const j = JSON.parse(fs.readFileSync(meta, "utf8")); const r = j.version != null ? j : (j[m[2]] || (j.levels || []).find(x => x.file === m[2] + ".gdlvl"));
      if (r && r.version != null) return +r.version; } catch (e) {}
  }
  return 0;
}
function lanIp() {
  for (const list of Object.values(os.networkInterfaces())) for (const a of list || []) if (a.family === "IPv4" && !a.internal && /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))/.test(a.address)) return a.address;
  return null;
}
function links(w, o = {}) {
  const L = find(w), v = o.v || L.version, t = o.t != null ? +o.t : 0;
  const long = "#lv=" + encodeURIComponent(L.file) + (v ? "&v=" + v : "") + (t ? "&t=" + t : "") + (o.run ? "&run=" + encodeURIComponent(o.run) : "");
  const short = "#" + L.base + (v ? "--v" + v : "") + (t ? "--t" + t : "") + (o.run ? "--r" + o.run : "");
  let phone = null; try { phone = fs.readFileSync(path.join(ROOT, "local", "phone", "url.txt"), "utf8").trim() + short; } catch (e) {}
  const ip = lanIp();
  return { level: L, phone, pc: "http://localhost:8765/viewer/" + long, lan: ip ? `http://${ip}:8765/viewer/` + long : null, short };
}
module.exports = { links };
if (require.main === module) {
  if (!args.length || args[0].startsWith("--")) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
  const r = links(args[0], { t: opt("--t"), v: opt("--v") ? +opt("--v") : 0, run: opt("--run") });
  if (r.level.unknown) console.log(`(no level file found for ${args[0]}: the links use the name as given)`);
  if (args.includes("--md")) console.log(`[${r.level.base}${r.level.version ? " v" + r.level.version : ""}](${r.phone || r.pc})`);
  else { if (r.phone) console.log("phone: " + r.phone); console.log("pc:    " + r.pc); if (r.lan) console.log("lan:   " + r.lan); }
}
