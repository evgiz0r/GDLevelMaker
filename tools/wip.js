// node tools/wip.js put <level.gdlvl> --session <name> [--note "what changed"] [--no-solve] [--plan <plan.json>] [--wait]
//   Never waits on a solve (2026-11-26: a put of an autobeat level with no saved route solved it inline for 26 min, and the
//   build stayed off the viewer): the level is written AT ONCE with the best route at hand --
//     --plan <plan.json>: the level's own planned presses ({ok, events, dieX?, why?}: a layout's plan, e.g. the whiteboard's
//       layout fitter), so the viewer replays the plan at once (CLAUDE.md "A layout is playable the moment it exists");
//     else the saved route (tools/solutions.js cache) when it is current;
//     else the build's planned presses (tools/planned.js: <level>.planned.json beside the level, levels/<slug>.planned.json,
//       or the build's stages; {auto: true} = an auto level, no press) as a "plan" route;
//     else none: the viewer runs it as a ghost (the camera at the level's speed) --
//   and when that route is not a current saved one, the solve runs AFTER, as its own background heavy job
//   (`wip.js solve`, log in local/logs/wip_solve/), which puts the solution into the entry when it is done (only if the
//   entry still holds the same level; a newer put stops an older solve of the same entry). --no-solve: no solve at all;
//   --wait: solve here after writing (the old behaviour, for scripts that need the route); GDLM_WIP_BG=0: no background job.
// node tools/wip.js solve <session>/<base> [--hash <h>]  -- the background solve (heavy lock); run by put
// node tools/wip.js list
// node tools/wip.js archive <session>/<base> [...]      -- take entries out of the viewer's in-progress list
// node tools/wip.js archive --superseded [--dry]       -- every entry a newer copy of the same level replaced
//   Files are MOVED (never deleted) to local/wip_archive/<session>/: the .gdlvl, its .json, .stages, .variants. The
//   viewer never reads that folder. "Same level" = the same file name without _vN/_polished (collab parts _pN and
//   lab_* variants are left alone);
//   the newest copy stays -- a wip entry or the pushed levels/ file (its last commit) -- and nothing touched in the
//   last 3 hours is moved by --superseded (a session may be working on it; name it to move it anyway).
// node tools/wip.js phone                     -- rows for the phone page for every current level (PHONE.md)
//
// Work in progress: the level a session is working on, shown live in the viewer's level list
// under "in progress" (refresh the page to get the newest). Files go to the shared folder
// local/wip/<session>/ (see tools/link_local.js), so every session and the viewer see them before
// anything is pushed. Put the level again after every change: same file name = the newer version.
// The user's marks on it land in local/marks.jsonl with the file name and the session, so the
// session can find them with `node tools/marks.js`.
// The solution (lib/natural.js's natural replay) goes with the entry, so the viewer and the phone only replay it:
// solving a 60 s level with modes in a phone's browser took so long the page looked hung. Until the background solve
// is done the entry carries `solving` {pid, since, est, log} and the viewer shows the plan or the ghost.
const fs = require("fs");
const path = require("path");
const { readGdlvl } = require("./io.js");
const WIP = process.env.GDLM_WIP_DIR || path.join(__dirname, "..", "local", "wip");   // GDLM_WIP_DIR: tests

const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };

if (require.main !== module) { /* a library: list(), phoneRow() ... */ } else if (args[0] === "put") {
  const t0 = Date.now();
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
  try { checklist = require("child_process").execSync("git log -1 --format=%h -- knowledge/checklist.md", { windowsHide: true, cwd: path.join(__dirname, ".."), encoding: "utf8" }).trim(); } catch (e) {}
  const note = (opt("--note") || "") + (checklist ? ` [checklist ${checklist}]` : "");
  // `hash` = the level's content: a re-put of the same level (a route refresh, a re-stamp) keeps its `made` time,
  // which is what the level picker shows ("it all shows low time, since reset", the user, 2026-11-23)
  const hash = require("crypto").createHash("sha1").update(L.levelStr).digest("hex").slice(0, 12), now = new Date().toISOString();
  const same = history.filter(h => h.hash === hash);
  history.push({ at: now, note, checklist, hash });
  const made = same.length ? same[0].made || same[0].at : now;
  history[history.length - 1].made = made;
  fs.copyFileSync(file, path.join(dir, base));
  const from = path.relative(path.join(__dirname, ".."), path.resolve(file)).replace(/\\/g, "/");
  stopSolve(meta.solving, session, base);   // an older background solve of this entry: its level is gone
  const at = opt("--plan") ? { solution: Object.assign({ kind: "plan" }, JSON.parse(fs.readFileSync(opt("--plan"), "utf8"))), what: "the given plan", done: true }
    : args.includes("--no-solve") ? { solution: undefined, what: "none (--no-solve)", done: true } : routeAtHand(L, path.resolve(file));
  const entry = { name: L.name, session, file: base, from, updated: now, made, note, checklist, version: history.length, history: history.slice(-20), solution: at.solution };
  writeJSON(metaFile, entry);
  console.log(`wip: ${session}/${base} v${history.length} ("${L.name}") -- refresh the viewer to see it; route: ${at.what || "none yet (the viewer runs it as a ghost)"} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  if (!at.done) {
    if (args.includes("--wait")) solveJob(session, base.replace(/\.gdlvl$/, ""), hash);
    else if (process.env.GDLM_WIP_BG !== "0") { entry.solving = startSolve(session, base, hash); writeJSON(metaFile, entry);
      console.log(`wip: the solve runs in the background (heavy job, pid ${entry.solving.pid}, ${entry.solving.est || "time not measured"}); log ${entry.solving.log}`); }
  }
  phoneRow(session, base, L, history.length, note, entry.solution, made);
} else if (args[0] === "solve") {
  const [session, b] = String(args[1] || "").split("/");
  if (!session || !b) { console.log("usage: node tools/wip.js solve <session>/<base> [--hash <h>]"); process.exit(1); }
  solveJob(session.replace(/[^\w-]+/g, ""), b.replace(/\.(gdlvl|json)$/, ""), opt("--hash"));
} else if (args[0] === "phone") {
  // rows for every current work-in-progress level (e.g. after the page's database was emptied)
  for (const m of list()) phoneRow(m.session, m.file, readGdlvl(path.join(WIP, m.session, m.file)), m.version, m.note || "", m.solution, m.made || m.updated);
} else if (args[0] === "list" || !args.length) {
  for (const l of list()) console.log(`${l.session.padEnd(14)} ${l.name.padEnd(28)} v${l.version}  ${l.updated}  ${l.note || ""}`);
} else if (args[0] === "archive") {
  const dry = args.includes("--dry"), names = args.slice(1).filter(a => !a.startsWith("--"));
  const todo = args.includes("--superseded") ? superseded() : names.map(n => { const [session, b] = n.split("/"); return { session, base: (b || "").replace(/\.(gdlvl|json)$/, ""), why: "asked" }; });
  if (!todo.length) console.log(args.includes("--superseded") ? "wip archive: nothing superseded" : "usage: node tools/wip.js archive <session>/<base> ... | --superseded [--dry]");
  for (const t of todo) {
    const moved = archive(t.session, t.base, dry);
    console.log(`${dry ? "would move" : "moved"} ${t.session}/${t.base} (${t.why}): ${moved.join(", ") || "nothing there"}`);
  }
} else console.log("usage: node tools/wip.js put|solve|list|phone|archive");

// the level an entry is a copy of: its file name without _vN / _polished ("gdlm_44_hellgate_polished" -> "gdlm_44_hellgate");
// null for what is meant to sit side by side: a collab build's parts (_p0, _p1 ...) and the section lab's variants (lab_*)
function levelKey(name, base) {
  base = String(base).replace(/\.gdlvl$/, "");
  if (/^lab_|_p\d+$/i.test(base)) return null;
  return base.toLowerCase().replace(/(_v\d+|_polished)+$/i, "");
}
// entries (wip levels and stage-only builds) that a newer copy of the same level replaced: [{session, base, why}]
function superseded() {
  const ROOT = path.join(__dirname, ".."), cp = require("child_process"), recent = Date.now() - 3 * 3600e3, copies = [];
  for (const m of list()) copies.push({ session: m.session, base: m.file.replace(/\.gdlvl$/, ""), key: levelKey(m.name, m.file), when: Date.parse(m.updated || m.made) || 0 });
  for (const b of require("./stages.js").list()) {
    if (copies.some(c => c.session === b.session && c.base === b.base)) continue;
    const st = b.index.stages || [], last = st[st.length - 1];
    copies.push({ session: b.session, base: b.base, key: levelKey(b.index.name, b.base), when: Date.parse(last && last.at) || 0 });
  }
  for (const f of fs.existsSync(path.join(ROOT, "levels")) ? fs.readdirSync(path.join(ROOT, "levels")).filter(f => f.endsWith(".gdlvl")) : []) {
    let when = 0; try { when = 1000 * +cp.execSync(`git log -1 --format=%ct -- "levels/${f}"`, { windowsHide: true, cwd: ROOT, encoding: "utf8" }).trim(); } catch (e) {}
    let name = ""; try { name = readGdlvl(path.join(ROOT, "levels", f)).name; } catch (e) {}
    copies.push({ session: null, base: "levels/" + f.replace(/\.gdlvl$/, ""), key: levelKey(name, f), when });
  }
  const out = [];
  for (const key of new Set(copies.map(c => c.key))) {
    const same = copies.filter(c => c.key === key).sort((a, b) => b.when - a.when), top = same[0];
    if (key === null) continue;
    for (const c of same.slice(1)) if (c.session && c.when < recent)
      out.push({ session: c.session, base: c.base, why: "newer: " + (top.session ? top.session + "/" : "") + top.base + " " + new Date(top.when).toISOString().slice(0, 16) });
  }
  return out;
}
// move one entry's files to local/wip_archive/<session>/ (never delete); a name already there gets a time suffix
function archive(session, base, dry) {
  session = String(session || "").replace(/[^\w-]+/g, ""); base = String(base || "").replace(/[^\w.-]+/g, "");
  const from = path.join(WIP, session), to = path.join(WIP, "..", "wip_archive", session), moved = [];
  if (!session || !base || !fs.existsSync(from)) return moved;
  for (const ext of [".gdlvl", ".json", ".stages", ".variants"]) {
    const src = path.join(from, base + ext); if (!fs.existsSync(src)) continue;
    let dst = path.join(to, base + ext); if (fs.existsSync(dst)) dst = path.join(to, base + "." + Date.now() + ext);
    if (!dry) { fs.mkdirSync(to, { recursive: true }); fs.renameSync(src, dst); }
    moved.push(path.relative(path.join(WIP, "..", ".."), dst).replace(/\\/g, "/"));
  }
  return moved;
}

// the best route at hand without solving: { solution, what, done } -- done = a current saved route (no solve needed)
function routeAtHand(L, file) {
  let S = null; try { S = require("./solutions.js"); } catch (e) { return { solution: undefined, done: false }; }
  const c = S.get(L.levelStr, true);
  let pe = null; try { pe = require("./planned.js").plannedEvents(L.name, file); } catch (e) {}
  // as solutions.solve: a current saved route stands, unless the level has a plan and the saved route is not it
  if (c && S.fresh(c) && S.windowsFresh(c) && (!pe || c.source === "planned")) return { solution: c, what: "saved route (" + (c.kind || (c.ok ? "beaten" : "unbeaten")) + ")", done: true };
  if (pe) return { solution: { ok: true, kind: "plan", events: pe, planReplay: true, why: pe.length ? "the build's planned presses, not checked yet (the solve runs after)" : "an auto level: no press" },
    what: pe.length ? `the build's plan (${pe.filter(e => e.type === "press").length} presses)` : "auto (no press)", done: false };
  if (c && c.events) return { solution: Object.assign({}, c, { stale: true }), what: "the old saved route (stale: re-solving after)", done: false };
  return { solution: undefined, done: false };
}
function writeJSON(f, obj) { const tmp = f + "." + process.pid + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(obj, null, 1)); fs.renameSync(tmp, f); }
function solveCmdOf(session, base) { return `tools/wip.js solve ${session}/${base.replace(/\.gdlvl$/, "")}`; }   // a declaration: the CLI above runs before this line
// the background solve: its own process (detached, hidden), which takes the heavy lock itself
function startSolve(session, base, hash) {
  const ROOT = path.join(__dirname, ".."), cp = require("child_process"), b = base.replace(/\.gdlvl$/, "");
  const logDir = path.join(WIP, "..", "logs", "wip_solve"); fs.mkdirSync(logDir, { recursive: true });
  const log = path.join(logDir, session + "__" + b + ".log"), fd = fs.openSync(log, "w");
  const env = Object.assign({}, process.env); delete env.GDLM_HEAVY_HELD;   // its own slot, not the caller's (which ends now)
  const ch = cp.spawn(process.execPath, [path.join(__dirname, "wip.js"), "solve", session + "/" + b, "--hash", hash], { cwd: ROOT, detached: true, windowsHide: true, stdio: ["ignore", fd, fd], env });
  ch.unref(); fs.closeSync(fd);
  let est = null; try { const JT = require("./jobtime.js"), e = JT.estimate(solveCmdOf(session, b) + " " + path.join(WIP, session, base)); if (e) est = `~${JT.fmt(e.secs)}: ${e.basis}`; } catch (e) {}
  const rel = path.relative(ROOT, log);
  return { pid: ch.pid, since: new Date().toISOString(), hash, est, log: (rel.startsWith("..") ? log : rel).replace(/\\/g, "/") };
}
// stop an older background solve of the same entry -- only when the heavy lock shows that pid running that very command
function stopSolve(solving, session, base) {
  if (!solving || !solving.pid) return;
  try { const H = require("./heavy.js"), want = solveCmdOf(session, base);
    const me = H.holders().concat(H.waiters()).find(h => h.pid === solving.pid && String(h.cmd || "").includes(want));
    if (me) { process.kill(solving.pid); console.log(`wip: stopped the older background solve (pid ${solving.pid}): a newer level is in`); }
  } catch (e) {}
}
// the solve itself (heavy): the entry gets the solution only if it still holds the level this job was started for
function solveJob(session, b, hash) {
  const lvl = path.join(WIP, session, b + ".gdlvl"), metaFile = path.join(WIP, session, b + ".json");
  require("./heavy.js").claim(solveCmdOf(session, b) + " " + lvl);
  const read = () => { try { return JSON.parse(fs.readFileSync(metaFile, "utf8")); } catch (e) { return null; } };
  const latest = m => m && m.history && m.history.length ? m.history[m.history.length - 1].hash : null;
  let m = read();
  if (!m) { console.log(`wip solve: no entry ${session}/${b}`); process.exit(1); }
  if (hash && latest(m) !== hash) { console.log("wip solve: the entry holds a newer level; nothing to do"); return; }
  const L = readGdlvl(lvl), t0 = Date.now();
  let sol, err;
  const src = m.from ? path.resolve(path.join(__dirname, ".."), m.from) : lvl;
  try { sol = require("./solutions.js").solve(L.level, L.levelStr, { name: L.name, file: fs.existsSync(src) ? src : lvl }); } catch (e) { err = e; }
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  m = read();   // again: a put may have come in meanwhile
  if (!m || (hash && latest(m) !== hash)) { console.log(`wip solve: done in ${secs} s, but the entry holds a newer level now (the route is in the solutions cache)`); return; }
  delete m.solving;
  if (err) { m.solveError = String(err.message || err).slice(0, 300); writeJSON(metaFile, m); console.log("wip solve: FAILED: " + err.stack); process.exitCode = 1; return; }
  m.solution = sol; delete m.solveError;
  writeJSON(metaFile, m);
  console.log(`wip solve: ${session}/${b}: ${sol.ok ? "beaten" : "not beaten"} (${(sol.events || []).length} inputs, ${secs} s) -- the viewer shows it on refresh`);
  phoneRow(session, b + ".gdlvl", L, m.version, m.note || "", sol, m.made || m.updated);
}

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
function phoneRow(session, base, L, version, note, solution, made) {
  const PH = path.join(WIP, "..", "phone");
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
module.exports = { list, WIP, phoneRow, archive, superseded, levelKey };
