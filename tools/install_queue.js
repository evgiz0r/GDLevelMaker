// node tools/install_queue.js add <level.gdlvl> [...] [--by <who>]   queue levels for the game's save
// node tools/install_queue.js list                                    what is waiting
// node tools/install_queue.js watch [--every 30] [--exit-after-install] [--save <path>]
// node tools/install_queue.js report                                  the last install's read-back
//
// Levels wait for hours when GD is open, because install.js refuses while it runs (GD rewrites the
// save on exit). This queue lets the coordinator or the user line levels up; the watcher polls
// tasklist (light: one tasklist call per poll, no heavy job) and, the moment GD is NOT running,
// runs tools/install.js on everything queued (one run: it backs the save up first and keeps online
// IDs k1/k16/k60/k79), then reads the save back and checks every level: found by name, the same
// level data as the file (sha1 of the level string), the object count, online ID if any. Report to
// local/install_reports/<time>.json (+ one line per batch in local/install_reports/log.jsonl);
// the queue is emptied of what was processed (a level that failed the read-back is in the report,
// not re-queued). PUBLISH.md "Install queue".
//
// It never uploads, never starts or closes GD, never touches anything but the save (via install.js).
// Who adds: the coordinator session or the user only (PUBLISH.md). Same name queued twice: the
// newer entry replaces the older.
const fs = require("fs"), path = require("path"), crypto = require("crypto");
const { execFileSync } = require("child_process");
const { readGdlvl, unpack } = require("./io.js");
const INST = require("./install.js");

const ROOT = path.join(__dirname, "..");
const QUEUE = process.env.GDLM_INSTALL_QUEUE || path.join(ROOT, "local", "install_queue.json");   // env: tests only
const FILES = path.join(path.dirname(QUEUE), "install_queue_files");   // copies of the queued files
const REPORTS = process.env.GDLM_INSTALL_REPORTS || path.join(ROOT, "local", "install_reports");
const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const sha = s => crypto.createHash("sha1").update(s).digest("hex").slice(0, 12);
const now = () => new Date().toISOString();

function load() { try { return JSON.parse(fs.readFileSync(QUEUE, "utf8")); } catch (e) { return { queue: [] }; } }
function store(q) { fs.mkdirSync(path.dirname(QUEUE), { recursive: true }); fs.writeFileSync(QUEUE, JSON.stringify(q, null, 2) + "\n"); }

// the wip version of a file, if it sits next to its wip json (local/wip/<session>/<name>.json)
function wipVersion(file) {
  const j = file.replace(/\.gdlvl$/, ".json");
  try { const w = JSON.parse(fs.readFileSync(j, "utf8")); return { version: w.version || (w.history || []).length || null, note: w.note || null, session: w.session || null }; } catch (e) { return null; }
}

function add() {
  const by = opt("--by", "unknown");
  const files = args.slice(1).filter((a, n) => a.endsWith(".gdlvl") && args[n] !== by);
  if (!files.length) { console.log("usage: node tools/install_queue.js add <level.gdlvl> [...] [--by <who>]"); process.exit(1); }
  const q = load();
  for (const f of files) {
    // the file is copied into the queue's own folder (next to install_queue.json, in the shared local/):
    // the watcher may run in another checkout, where a relative path means another file or none
    // (2026-11-23: "file missing" for a level queued from the main checkout)
    const abs = path.resolve(f), L = readGdlvl(abs), h = sha(L.levelStr);
    fs.mkdirSync(FILES, { recursive: true });
    const copy = h + "_" + path.basename(abs);
    fs.copyFileSync(abs, path.join(FILES, copy));
    const e = { file: abs.replace(/\\/g, "/"), copy, name: L.name, objects: L.level.objects.length, sha: h,
      wip: wipVersion(abs), added: now(), by };
    for (const x of q.queue) if (x.name === e.name && x.copy && x.copy !== copy) try { fs.unlinkSync(path.join(FILES, x.copy)); } catch (err) {}
    q.queue = q.queue.filter(x => x.name !== e.name);
    q.queue.push(e);
    console.log(`queued "${e.name}" (${e.objects} objects, ${e.sha}) from ${e.file}`);
  }
  store(q);
  console.log(`${q.queue.length} waiting. The watcher installs them when GD is closed (node tools/install_queue.js watch).`);
}

function readBack(save, items) {
  const xml = INST.decodeSave(fs.readFileSync(save));
  const recs = INST.splitLevels(xml).items;
  return items.map(e => {
    const at = recs.findIndex(r => INST.nameOf(r.inner) === e.name);
    if (at < 0) return { ...e, ok: false, problem: "not in the save" };
    const inner = recs[at].inner;
    const k4 = (inner.match(/<k>k4<\/k><s>([^<]*)<\/s>/) || [])[1];
    let levelStr = null; try { levelStr = unpack(k4); } catch (err) {}
    const objects = levelStr ? levelStr.split(";").filter(Boolean).length - 1 : null;
    const k1 = (INST.entry(inner, "k1") || "").replace(/<[^>]+>/g, "").replace(/^k1/, "") || null;
    const got = { position: at + 1, objects, sha: levelStr ? sha(levelStr) : null, onlineId: k1 };
    const ok = got.sha === e.sha && objects === e.objects;
    return { ...e, ok, got, problem: ok ? undefined : "save differs from the file" };
  });
}

function installNow(save) {
  const q = load();
  if (!q.queue.length) return null;
  const batch = q.queue.slice();
  const src = e => e.copy ? path.join(FILES, e.copy) : path.resolve(ROOT, e.file);
  const missing = batch.filter(e => !fs.existsSync(src(e)));
  const todo = batch.filter(e => !missing.includes(e));
  // online IDs the save holds for these names before installing: an install must never drop one
  const idsBefore = {};
  try {
    for (const r of INST.splitLevels(INST.decodeSave(fs.readFileSync(save))).items) {
      const k1 = (INST.entry(r.inner, "k1") || "").replace(/<[^>]+>/g, "").replace(/^k1/, "");
      if (k1 && todo.some(e => e.name === INST.nameOf(r.inner))) idsBefore[INST.nameOf(r.inner)] = k1;
    }
  } catch (e) {}
  let out = "", err = null;
  if (todo.length) {
    try {
      out = execFileSync(process.execPath, [process.env.GDLM_INSTALL_JS || path.join(__dirname, "install.js"), ...todo.map(src), ...(opt("--save") ? ["--save", save] : [])], { windowsHide: true, encoding: "utf8" });
    } catch (e) { err = (e.stdout || "") + (e.stderr || "") || e.message; }
  }
  if (err && /running/i.test(err)) return { skipped: "GD started" };   // GD came up between poll and install: try later
  let checked = err ? todo.map(e => ({ ...e, ok: false, problem: "install.js failed" })) : readBack(save, todo);
  // an online ID lost (an install.js without keepOnline, as main's once did with hellgate's 152848491):
  // put the backup back and report every level as not installed
  const lost = checked.filter(l => idsBefore[l.name] && (!l.got || l.got.onlineId !== idsBefore[l.name]));
  if (lost.length) {
    const bk = ((out.match(/backup: (.+)/) || [])[1] || "").trim();
    let restored = false;
    if (bk && fs.existsSync(bk)) { fs.copyFileSync(bk, save); restored = true; }
    checked = checked.map(l => ({ ...l, ok: false, problem: `online ID dropped for ${lost.map(x => `${x.name} (${idsBefore[x.name]})`).join(", ")}; ` + (restored ? `save restored from ${bk}` : "COULD NOT RESTORE the backup") }));
  }
  const report = { at: now(), save, installOutput: (out || err || "").trim().split(/\r?\n/), levels: [...checked, ...missing.map(e => ({ ...e, ok: false, problem: "file missing" }))] };
  fs.mkdirSync(REPORTS, { recursive: true });
  const name = path.join(REPORTS, report.at.replace(/[:.]/g, "-") + ".json");
  fs.writeFileSync(name, JSON.stringify(report, null, 2) + "\n");
  fs.appendFileSync(path.join(REPORTS, "log.jsonl"), JSON.stringify({ at: report.at, report: path.basename(name), levels: report.levels.map(l => ({ name: l.name, ok: l.ok, problem: l.problem, onlineId: l.got && l.got.onlineId })) }) + "\n");
  // empty the queue of what was processed; anything added meanwhile stays
  const after = load();
  after.queue = after.queue.filter(x => !batch.some(b => b.name === x.name && b.added === x.added));
  store(after);
  for (const b of batch) if (b.copy && !after.queue.some(x => x.copy === b.copy)) try { fs.unlinkSync(path.join(FILES, b.copy)); } catch (err) {}
  return { report, file: name };
}

function show(r) {
  for (const l of r.levels) console.log(`  ${l.ok ? "ok  " : "FAIL"} ${l.name}: ${l.got ? `position ${l.got.position}, ${l.got.objects} objects, ${l.got.sha}` : ""}` +
    `${l.got && l.got.onlineId ? `, online ID ${l.got.onlineId} kept` : ""}${l.wip ? `, wip v${l.wip.version}` : ""}${l.problem ? ` -- ${l.problem}` : ""}`);
}

async function watch() {
  const every = +opt("--every", 30) * 1000;
  const save = opt("--save", path.join(require("./gdpaths.js").SAVE, "CCLocalLevels.dat"));
  const testRunning = opt("--pretend-running");   // tests: a file whose existence means "GD is running"
  const running = () => testRunning ? fs.existsSync(testRunning) : INST.gameRunning();
  console.log(`${now()} watching: every ${every / 1000} s, installs the queue (${QUEUE}) when GD is closed. Never uploads, never closes GD.`);
  for (;;) {
    if (load().queue.length && !running()) {
      const r = installNow(save);
      if (r && r.report) {
        console.log(`${now()} installed ${r.report.levels.filter(l => l.ok).length}/${r.report.levels.length}; report ${path.relative(ROOT, r.file)}`);
        show(r.report);
        if (args.includes("--exit-after-install")) process.exit(r.report.levels.every(l => l.ok) ? 0 : 2);
      }
    }
    await new Promise(res => setTimeout(res, every));
  }
}

const cmd = args[0];
if (cmd === "add") add();
else if (cmd === "list") { const q = load(); console.log(q.queue.length ? q.queue.map(e => `${e.name}  ${e.file}  (${e.objects} objects, by ${e.by}, ${e.added})`).join("\n") : "queue empty"); }
else if (cmd === "watch") watch();
else if (cmd === "report") {
  const files = fs.existsSync(REPORTS) ? fs.readdirSync(REPORTS).filter(f => f.endsWith(".json")).sort() : [];
  if (!files.length) console.log("no reports yet"); else { const r = JSON.parse(fs.readFileSync(path.join(REPORTS, files.at(-1)), "utf8")); console.log(r.at); show(r); }
}
else { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).slice(0, 4).join("\n")); process.exit(1); }
