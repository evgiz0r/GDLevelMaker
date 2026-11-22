// node tools/wip.js put <level.gdlvl> --session <name> [--note "what changed"]
// node tools/wip.js list
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
module.exports = { list, WIP };
