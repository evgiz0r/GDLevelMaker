// node tools/difficulty_solve.js <n> [--sweep]  -- solves official level n and caches the answer
// (inputs only) in local/difficulty/NN.json for tools/difficulty.js. Run by tools/difficulty.js in
// parallel child processes; local/ is gitignored (RobTop's levels are never committed).
const fs = require("fs"), path = require("path");
const { GD, unpack } = require("./io.js");
const SRC = process.env.GD_LEVELS || "C:/Program Files (x86)/Steam/steamapps/common/Geometry Dash/Resources/levels/";
const OUT = path.join(__dirname, "..", "local", "difficulty");

function solveOfficial(n, opts) {
  const level = unpack(fs.readFileSync(path.join(SRC, n + ".txt"), "utf8"));
  const L = GD.parseLevel(level);
  const w = GD.makeWorld(L.objects, L.header);
  const t0 = Date.now();
  const r = opts.sweep ? GD.solveSweep(w) : GD.solveAny(w);
  const res = {
    n, ok: r.ok, sweep: !!r.sweep, secs: (Date.now() - t0) / 1000,
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
    JSON.stringify({ n, name: NAMES[n] ? NAMES[n][0] : "level " + n, level, solution }));
  require("./index_levels.js").buildIndex();
}

if (require.main === module) {
  const n = +process.argv[2];
  const r = solveOfficial(n, { sweep: process.argv.includes("--sweep") });
  console.log(`${n}: ${r.ok ? "beaten" : "stops at block " + (r.dieX / 30).toFixed(1) + " (" + r.why + ")"}, ${r.events.length} events, ${r.secs.toFixed(0)} s`);
}
module.exports = { solveOfficial, toViewer, SRC, OUT };
