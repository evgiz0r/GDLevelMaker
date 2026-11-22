// node tools/difficulty_solve.js <n> [--sweep]   -- solves official level n into the shared local/:
//   local/difficulty/NN.json (raw solver inputs, for tools/difficulty.js) and local/official_NN.json
//   (the human route, for the viewer and other sessions). Both carry `physics`: the last commit
//   that changed lib/physics.js or lib/objects*.js, so a later physics change shows what is stale.
// node tools/difficulty_solve.js all [n ...]     -- solves several (default 1-22), ONE process at a
//   time, waiting while free memory is under 2.5 GB (a solve takes up to ~800 MB; other sessions and
//   the user's game share the PC). Prints one line per level.
// RobTop's levels: local/ is gitignored and nothing from it is ever committed.
const fs = require("fs"), path = require("path"), { execFileSync, execSync } = require("child_process");
const { GD, unpack } = require("./io.js");
const SRC = process.env.GD_LEVELS || "C:/Program Files (x86)/Steam/steamapps/common/Geometry Dash/Resources/levels/";
const OUT = path.join(__dirname, "..", "local", "difficulty");

function physicsCommit() {
  try { return execSync("git log -1 --format=%h -- lib/physics.js lib/objects.js lib/objects_extra.js", { cwd: path.join(__dirname, ".."), encoding: "utf8" }).trim(); }
  catch (e) { return null; }
}

function solveOfficial(n, opts) {
  const level = unpack(fs.readFileSync(path.join(SRC, n + ".txt"), "utf8"));
  const L = GD.parseLevel(level);
  const w = GD.makeWorld(L.objects, L.header);
  const t0 = Date.now();
  const r = opts.sweep ? GD.solveSweep(w) : GD.solveAny(w);
  const res = {
    n, ok: r.ok, sweep: !!r.sweep, secs: (Date.now() - t0) / 1000, physics: physicsCommit(), solvedAt: new Date().toISOString(),
    events: r.ok ? r.events : (r.trail || []),
    clicks: r.ok ? r.clicks : [],
    dieX: r.ok ? null : r.dieAt && r.dieAt.x, why: r.ok ? null : r.why,
    endX: w.endX,
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, String(n).padStart(2, "0") + (opts.sweep ? "_sweep" : "") + ".json"), JSON.stringify(res));
  toViewer(n, level, res);
  return res;
}

// also show it in the viewer (local/official_NN.json, the format tools/official.js writes)
function toViewer(n, level, res) {
  const NAMES = require("./difficulty.js").RATED;
  // the viewer shows the route a person would play: one tap per cube jump instead of long holds
  const L = GD.parseLevel(level), w = GD.makeWorld(L.objects, L.header);
  const events = require("../lib/difficulty.js").humanize(w, res.events).events;
  const solution = res.ok ? { ok: true, events } : { ok: false, events, dieX: res.dieX, why: res.why };
  fs.writeFileSync(path.join(OUT, "..", `official_${String(n).padStart(2, "0")}.json`),
    JSON.stringify({ n, name: NAMES[n] ? NAMES[n][0] : "level " + n, level, solution, physics: res.physics || null }));
  require("./index_levels.js").buildIndex();
}

function freeGB() {
  try { return +execSync('powershell -NoProfile -c "(Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory"', { encoding: "utf8" }) / 1048576; }
  catch (e) { return 99; }
}
const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === "all") {
    const ns = args.slice(1).map(Number); const list = ns.length ? ns : Array.from({ length: 22 }, (_, i) => i + 1);
    for (const n of list) {
      let waited = 0;
      while (freeGB() < 2.5) { if (waited++ % 6 === 0) console.log(`  (waiting: under 2.5 GB free)`); sleep(10000); }
      try { process.stdout.write(execFileSync(process.execPath, ["--max-old-space-size=2000", __filename, String(n)], { encoding: "utf8" })); }
      catch (e) { console.log(`${n}: failed: ${String(e.message).split("\n")[0]}`); }
    }
  } else {
    const n = +args[0];
    const r = solveOfficial(n, { sweep: args.includes("--sweep") });
    console.log(`${n}: ${r.ok ? "beaten" : "stops at block " + (r.dieX / 30).toFixed(1) + " (" + r.why + ")"}, ${r.events.length} events, ${r.secs.toFixed(0)} s, physics ${r.physics}`);
  }
}
module.exports = { solveOfficial, toViewer, physicsCommit, SRC, OUT };
