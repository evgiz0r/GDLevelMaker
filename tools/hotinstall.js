// Install into a RUNNING Geometry Dash through the probe mod's install inbox (mods/gdlm-probe v0.6.0+, GEODE.md
// "Install into a running GD"). tools/install.js calls this when GeometryDash.exe runs; nothing to run by hand except:
//   node tools/hotinstall.js status            is the running game's mod able to take installs (version, pid)
//   node tools/hotinstall.js results [--all]   what the mod answered (pending requests too)
//
// How: one request file per level, <GD save>/geode/mods/gdlm.probe/install/<id>.req.json = {id, name, record, save},
// record = the level's plist record as install.js would put it in the save (description, length label). The mod looks
// at the folder once a second on menus only (never during play), adds / replaces the level in My Levels keeping its
// online ID, lets GD save CCLocalLevels.dat, and answers <id>.result.json. A request made while the user is in a level
// waits there until they leave it. The mod is "there" when probe.status.json names a version >= MIN and the pid of the
// GeometryDash.exe that runs now (an older or disabled mod -> the caller falls back to the install queue).
// Env (tests only): GDLM_PROBE_DIR = the mod's folder.
const fs = require("fs"), path = require("path");
const { execFileSync } = require("child_process");

const MIN = [0, 6, 0];
function probeDir() {
  return process.env.GDLM_PROBE_DIR || path.join(require("./gdpaths.js").SAVE, "geode", "mods", "gdlm.probe");
}
const inboxDir = (dir = probeDir()) => path.join(dir, "install");
const ver = v => String(v || "").replace(/^v/, "").split(".").map(n => parseInt(n, 10) || 0);
function atLeast(v, min = MIN) { const a = ver(v); for (let i = 0; i < 3; i++) { if ((a[i] || 0) !== min[i]) return (a[i] || 0) > min[i]; } return true; }

// the pids of running GeometryDash.exe (Windows tasklist; [] elsewhere or on error)
function gdPids() {
  try {
    const out = execFileSync("tasklist", ["/FI", "IMAGENAME eq GeometryDash.exe", "/FO", "CSV", "/NH"], { windowsHide: true, encoding: "utf8" });
    return [...out.matchAll(/"GeometryDash\.exe","(\d+)"/gi)].map(m => +m[1]);
  } catch (e) { return []; }
}

// {ok, why, status}: can the running game take an install now
function modReady({ dir = probeDir(), pids = gdPids() } = {}) {
  let st;
  try { st = JSON.parse(fs.readFileSync(path.join(dir, "probe.status.json"), "utf8")); }
  catch (e) { return { ok: false, why: "no probe.status.json: the probe mod v0.6.0+ has not reached GD's main menu (not installed, disabled or older)" }; }
  if (!atLeast(st.version)) return { ok: false, why: `the probe mod is ${st.version}: the install inbox needs v${MIN.join(".")}+`, status: st };
  if (!pids.includes(+st.pid)) return { ok: false, why: `probe.status.json is from another GD run (pid ${st.pid}, running: ${pids.join(", ") || "none"}): the mod did not start in this one`, status: st };
  return { ok: true, status: st };
}

// the full plist record from the inner dict (what a .gdlvl unpacks to)
const recordOf = inner => `<?xml version="1.0"?><plist version="1.0" gjver="2.0"><dict>${inner}</dict></plist>`;
const safe = s => String(s).replace(/[^A-Za-z0-9]+/g, "_").slice(0, 40);

// drop one request; returns its id. Written as .tmp then renamed, so the mod never reads half a file.
function request(name, inner, { dir = probeDir(), save = true } = {}) {
  const d = inboxDir(dir); fs.mkdirSync(d, { recursive: true });
  const id = `${Date.now()}_${process.pid}_${safe(name)}`;
  const p = path.join(d, id + ".req.json");
  fs.writeFileSync(p + ".tmp", JSON.stringify({ id, name, record: recordOf(inner), save, wall_ms: Date.now() }));
  fs.renameSync(p + ".tmp", p);
  return id;
}

// requests for these names still waiting (made earlier, not taken yet): a closed-game install of the same level makes
// them stale, so install.js removes them (else the mod would put the older version back at the next GD start)
function dropPending(names, { dir = probeDir() } = {}) {
  const d = inboxDir(dir), gone = [];
  let files = []; try { files = fs.readdirSync(d).filter(f => f.endsWith(".req.json")); } catch (e) { return gone; }
  for (const f of files) {
    try { const j = JSON.parse(fs.readFileSync(path.join(d, f), "utf8")); if (names.includes(j.name)) { fs.renameSync(path.join(d, f), path.join(d, f.replace(/\.req\.json$/, ".dropped.json"))); gone.push(j.name); } } catch (e) {}
  }
  return gone;
}

function readResult(id, { dir = probeDir() } = {}) {
  try { return JSON.parse(fs.readFileSync(path.join(inboxDir(dir), id + ".result.json"), "utf8")); } catch (e) { return null; }
}

// waits up to `wait` ms for every id; returns {id: result | null}. Synchronous (a CLI): sleeps with Atomics.wait.
function waitResults(ids, { dir = probeDir(), wait = 20000, every = 250 } = {}) {
  const out = {}, t0 = Date.now(), nap = new Int32Array(new SharedArrayBuffer(4));
  for (;;) {
    for (const id of ids) if (!out[id]) out[id] = readResult(id, { dir });
    if (ids.every(id => out[id]) || Date.now() - t0 >= wait) return out;
    Atomics.wait(nap, 0, 0, every);
  }
}

function main() {
  const a = process.argv.slice(2);
  if (a[0] === "status") { const r = modReady(); console.log(r.ok ? `ready: probe mod ${r.status.version} in GD pid ${r.status.pid}` : `not ready: ${r.why}`); process.exit(r.ok ? 0 : 1); }
  if (a[0] === "results") {
    const d = inboxDir(); let files = []; try { files = fs.readdirSync(d).sort(); } catch (e) {}
    for (const f of files.filter(f => f.endsWith(".req.json"))) console.log(`pending  ${f.replace(/\.req\.json$/, "")}  (waits for a menu in GD)`);
    const res = files.filter(f => f.endsWith(".result.json")).map(f => JSON.parse(fs.readFileSync(path.join(d, f), "utf8")));
    for (const r of a.includes("--all") ? res : res.slice(-10)) console.log(`${r.status.padEnd(9)} ${r.name}` + (r.why ? `: ${r.why}` : ` (position ${r.position}${r.replaced ? ", replaced" : ", new"}${r.online_id > 0 ? `, online ID ${r.online_id}` : ""}, saved ${r.saved}, song ${r.song})`) + `  ${new Date(r.wall_ms).toISOString()}`);
    return;
  }
  console.log("usage: node tools/hotinstall.js status | results [--all]   (installs: node tools/install.js <level.gdlvl> with GD running)");
}
if (require.main === module) main();
module.exports = { MIN, probeDir, inboxDir, atLeast, gdPids, modReady, recordOf, request, dropPending, readResult, waitResults };
