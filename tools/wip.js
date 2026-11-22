// node tools/wip.js put <level.gdlvl> --session <name> [--note "what changed"]
// node tools/wip.js list
// node tools/wip.js phone                     -- rows for the phone page for every current level (PHONE.md)
//
// Work in progress: the level a session is working on, shown live in the viewer's level list
// under "in progress" (refresh the page to get the newest). Files go to the shared folder
// local/wip/<session>/ (see tools/link_local.js), so every session and the viewer see them before
// anything is pushed. Put the level again after every change: same file name = the newer version.
// The user's marks on it land in local/marks.jsonl with the file name and the session, so the
// session can find them with `node tools/marks.js`.
const fs = require("fs");
const path = require("path");
const { readGdlvl } = require("./io.js");
const WIP = path.join(__dirname, "..", "local", "wip");

const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };

if (args[0] === "put") {
  const file = args[1], session = (opt("--session") || "").replace(/[^\w-]+/g, "");
  if (!file || !file.endsWith(".gdlvl") || !session) { console.log('usage: node tools/wip.js put <level.gdlvl> --session <name> [--note "..."]'); process.exit(1); }
  const L = readGdlvl(file);
  const dir = path.join(WIP, session);
  fs.mkdirSync(dir, { recursive: true });
  const base = path.basename(file);
  const metaFile = path.join(dir, base.replace(/\.gdlvl$/, ".json"));
  let meta = {}; try { meta = JSON.parse(fs.readFileSync(metaFile, "utf8")); } catch (e) {}
  const history = meta.history || [];
  history.push({ at: new Date().toISOString(), note: opt("--note") || "" });
  fs.copyFileSync(file, path.join(dir, base));
  fs.writeFileSync(metaFile, JSON.stringify({ name: L.name, session, file: base, from: path.relative(path.join(__dirname, ".."), path.resolve(file)).replace(/\\/g, "/"),
    updated: new Date().toISOString(), note: opt("--note") || "", version: history.length, history: history.slice(-20) }, null, 1));
  console.log(`wip: ${session}/${base} v${history.length} ("${L.name}") -- refresh the viewer to see it`);
  phoneRow(session, base, L, history.length, opt("--note") || "");
} else if (args[0] === "phone") {
  // rows for every current work-in-progress level (e.g. after the page's database was emptied)
  for (const m of list()) phoneRow(m.session, m.file, readGdlvl(path.join(WIP, m.session, m.file)), m.version, m.note || "");
} else if (args[0] === "list" || !args.length) {
  for (const l of list()) console.log(`${l.session.padEnd(14)} ${l.name.padEnd(28)} v${l.version}  ${l.updated}  ${l.note || ""}`);
} else console.log("usage: node tools/wip.js put|list");

function list() {
  const out = [];
  if (!fs.existsSync(WIP)) return out;
  for (const s of fs.readdirSync(WIP)) for (const f of fs.readdirSync(path.join(WIP, s)).filter(f => f.endsWith(".json"))) {
    try { const m = JSON.parse(fs.readFileSync(path.join(WIP, s, f), "utf8")); m.url = `../local/wip/${s}/${m.file}`; out.push(m); } catch (e) {}
  }
  return out.sort((a, b) => b.updated.localeCompare(a.updated));
}
// The phone page (tools/web.js, PHONE.md) can't reach this PC, so it reads work in progress from its
// own database. Each put leaves the row, the same shape as serve.js's /wip/list, in
// local/phone/wip/<doc>.json; the session then sends it with ONE ArtifactData call (printed here),
// and the open phone page shows it at once: no republish.
function phoneRow(session, base, L, version, note) {
  const ROOT = path.join(__dirname, ".."), PH = path.join(ROOT, "local", "phone");
  const { songOf } = require("./index_levels.js");
  const doc = (session + "__" + base.replace(/\.gdlvl$/, "")).replace(/[^A-Za-z0-9_\-.]/g, "_");
  const row = { name: L.name, session, file: "local/wip/" + session + "/" + base, level: L.levelStr, song: songOf(L.rec, L.level.header),
    version, note, updated: new Date().toISOString() };
  const json = JSON.stringify(row);
  if (json.length > 250000) { console.log(`phone: level too big for one database row (${(json.length / 1024).toFixed(0)} KB > 250 KB); not sent`); return; }
  fs.mkdirSync(path.join(PH, "wip"), { recursive: true });
  const f = path.join(PH, "wip", doc + ".json");
  fs.writeFileSync(f, json);
  let url = ""; try { url = fs.readFileSync(path.join(PH, "url.txt"), "utf8").trim(); } catch (e) {}
  // the real path (local/ is a link in worktrees; ArtifactData refuses paths under .claude/)
  console.log(url ? `phone: send it with ArtifactData {action: "set", url: "${url}", collection: "wip", doc_id: "${doc}", file_path: "${fs.realpathSync(f).split(path.sep).join("/")}"}` +
    ` (add if_version from a read when the row exists; see PHONE.md)` : "phone: no local/phone/url.txt (the phone page is not published yet; see PHONE.md)");
}
module.exports = { list, WIP, phoneRow };
