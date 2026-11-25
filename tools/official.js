// node tools/official.js [n ...]  -- solves the game's own levels (Resources/levels/<n>.txt in the
// user's install) and saves the answers to local/, which the viewer shows under "official".
// They are RobTop's levels: local/ is gitignored and nothing from it is ever committed.
const fs = require("fs"), path = require("path");
const { GD, unpack } = require("./io.js");
const SRC = require("./gdpaths.js").LEVELS;
const OUT = path.join(__dirname, "..", "local");
const NAMES = { 1: "Stereo Madness", 2: "Back On Track", 3: "Polargeist", 4: "Dry Out", 5: "Base After Base",
  6: "Cant Let Go", 7: "Jumper", 8: "Time Machine", 9: "Cycles", 10: "xStep", 11: "Clutterfunk",
  12: "Theory of Everything", 13: "Electroman Adventures", 14: "Clubstep", 15: "Electrodynamix",
  16: "Hexagon Force", 17: "Blast Processing", 18: "Theory of Everything 2", 19: "Geometrical Dominator",
  20: "Deadlocked", 21: "Fingerdash", 22: "Dash" };
fs.mkdirSync(OUT, { recursive: true });
const ns = process.argv.slice(2).map(Number);
for (const n of ns.length ? ns : [1, 2, 3]) {
  const level = unpack(fs.readFileSync(path.join(SRC, n + ".txt"), "utf8"));
  const L = GD.parseLevel(level);
  const w = GD.makeWorld(L.objects, L.header);
  const t0 = Date.now();
  const r = GD.solveAny(w);
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  const res = r.ok ? { ok: true, events: r.events } : { ok: false, events: r.trail || [], dieX: r.dieAt && r.dieAt.x, why: r.why };
  fs.writeFileSync(path.join(OUT, `official_${String(n).padStart(2, "0")}.json`),
    JSON.stringify({ n, name: NAMES[n] || "level " + n, level, solution: res }));
  console.log(`${n} ${NAMES[n]}: ${r.ok ? "beaten, " + r.events.filter(e => e.type === "press").length + " presses" : "stops at block " + (r.dieAt.x / 30).toFixed(1) + " (" + r.why + ")"} in ${secs}s`);
}
require("./index_levels.js").buildIndex();
