// node tools/wip.js put <level.gdlvl> --session <name> [--note "what changed"] [--no-solve]
// node tools/wip.js list
// node tools/wip.js phone                     -- rows for the phone page for every current level (PHONE.md)
//
// Work in progress: the level a session is working on, shown live in the viewer's level list
// under "in progress" (refresh the page to get the newest). Files go to the shared folder
// local/wip/<session>/ (see tools/link_local.js), so every session and the viewer see them before
// anything is pushed. Put the level again after every change: same file name = the newer version.
// The user's marks on it land in local/marks.jsonl with the file name and the session, so the
// session can find them with `node tools/marks.js`.
// The level is solved HERE (with lib/natural.js's natural replay) and the solution goes with it, so
// the viewer and the phone only replay it: solving a 60 s level with modes in a phone's browser took
// so long the page looked hung. --no-solve skips that (the viewer then solves it itself).
const fs = require("fs");
const path = require("path");
const { readGdlvl } = require("./io.js");
const WIP = path.join(__dirname, "..", "local", "wip");

const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };

if (args[0] === "put") {
  require("./heavy.js").claim();   // the solve below is heavy: one heavy job at a time (tools/heavy.js)
  const file = args[1], session = (opt("--session") || "").replace(/[^\w-]+/g, "");
  if (!file || !file.endsWith(".gdlvl") || !session) { console.log('usage: node tools/wip.js put <level.gdlvl> --session <name> [--note "..."]'); process.exit(1); }
  const L = readGdlvl(file);
  const dir = path.join(WIP, session);
  fs.mkdirSync(dir, { recursive: true });
  const base = path.basename(file);
  const metaFile = path.join(dir, base.replace(/\.gdlvl$/, ".json"));
  let meta = {}; try { meta = JSON.parse(fs.readFileSync(metaFile, "utf8")); } catch (e) {}
  const history = meta.history || [];
  // which checklist the level was built against (the user: sessions must use what others learned;
  // knowledge/checklist.md's last commit, added to the note so the viewer and the phone show it)
  let checklist = "";
  try { checklist = require("child_process").execSync("git log -1 --format=%h -- knowledge/checklist.md", { cwd: path.join(__dirname, ".."), encoding: "utf8" }).trim(); } catch (e) {}
  const note = (opt("--note") || "") + (checklist ? ` [checklist ${checklist}]` : "");
  // `hash` = the level's content: a re-put of the same level (a route refresh, a re-stamp) keeps its `made` time,
  // which is what the level picker shows ("it all shows low time, since reset", the user, 2026-11-23)
  const hash = require("crypto").createHash("sha1").update(L.levelStr).digest("hex").slice(0, 12), now = new Date().toISOString();
  const same = history.filter(h => h.hash === hash);
  history.push({ at: now, note, checklist, hash });
  const made = same.length ? same[0].made || same[0].at : now;
  history[history.length - 1].made = made;
  fs.copyFileSync(file, path.join(dir, base));
  const solution = args.includes("--no-solve") ? undefined : solveFor(L);
  fs.writeFileSync(metaFile, JSON.stringify({ name: L.name, session, file: base, from: path.relative(path.join(__dirname, ".."), path.resolve(file)).replace(/\\/g, "/"),
    updated: now, made, note, checklist, version: history.length, history: history.slice(-20), solution }, null, 1));
  console.log(`wip: ${session}/${base} v${history.length} ("${L.name}") -- refresh the viewer to see it`);
  phoneRow(session, base, L, history.length, note, solution, made);
} else if (args[0] === "phone") {
  // rows for every current work-in-progress level (e.g. after the page's database was emptied)
  for (const m of list()) phoneRow(m.session, m.file, readGdlvl(path.join(WIP, m.session, m.file)), m.version, m.note || "", m.solution, m.made || m.updated);
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
// the solution the viewer replays: {ok, events} (the natural plan when it works), or the furthest run
function solveFor(L) {
  const t0 = Date.now();
  const sol = require("./solutions.js").solve(L.level, L.levelStr);  // cached when make.js already solved it
  console.log(`solution for the viewer and the phone: ${sol.ok ? "beaten" : "not beaten"} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  return sol;
}
function phoneRow(session, base, L, version, note, solution, made) {
  const ROOT = path.join(__dirname, ".."), PH = path.join(ROOT, "local", "phone");
  const { songOf } = require("./index_levels.js");
  const doc = (session + "__" + base.replace(/\.gdlvl$/, "")).replace(/[^A-Za-z0-9_\-.]/g, "_");
  // timing windows measured since (tools/solutions.js cache) for the same inputs go along: the phone shows them at once
  try { const c = require("./solutions.js").get(L.levelStr, true);
    if (solution && !solution.windows && c && c.windows && JSON.stringify(c.events) === JSON.stringify(solution.events)) solution = Object.assign({}, solution, { windows: c.windows, win: c.win }); } catch (e) {}
  const row = { name: L.name, session, file: "local/wip/" + session + "/" + base, level: L.levelStr, song: songOf(L.rec, L.level.header),
    version, note, updated: made || new Date().toISOString(), made: made || undefined, solution };   // the version's time, not the row's
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
