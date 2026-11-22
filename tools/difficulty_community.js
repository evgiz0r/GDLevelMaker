// node tools/difficulty_community.js <id>[:tier] [...] [--dir local/community]  -- solves and scores
// downloaded community levels (tools/fetch_level.js; never committed), to check the tier ladder in
// DIFFICULTY.md against levels other than RobTop's. Heavy: a solve each (~1-6 min, up to ~800 MB),
// one at a time. Appends one JSON row per level to local/difficulty/community.jsonl.
const fs = require("fs"), path = require("path");
const { GD, readGdlvl } = require("./io.js");
const DF = require("../lib/difficulty.js");

const args = process.argv.slice(2), di = args.indexOf("--dir");
const dir = di >= 0 ? args.splice(di, 2)[1] : path.join(__dirname, "..", "local", "community");
const out = path.join(__dirname, "..", "local", "difficulty", "community.jsonl");
fs.mkdirSync(path.dirname(out), { recursive: true });
for (const [id, tier] of args.map(x => x.split(":"))) {
  const L = readGdlvl(path.join(dir, id + ".gdlvl")), w = GD.makeWorld(L.level.objects, L.level.header);
  const t0 = Date.now(), r = GD.solveAny(w), d = DF.difficulty(w, r.ok ? r : { events: r.trail || [] });
  const ms = d.actions.map(a => a.ms), pm = x => +(x / d.seconds * 60).toFixed(1);
  const row = { id, name: L.name, tier: tier || null, covers: Math.round(100 * d.blocks / (w.endX / 30)) + "%",
    secs: Math.round(d.seconds), inputsPerS: +d.perSecond.toFixed(2), u150pm: pm(ms.filter(m => m < 150).length),
    u100pm: pm(ms.filter(m => m < 100).length), tight: d.tight, minMs: Math.round(d.tightest || 0),
    touches: +d.touchesPerMin.toFixed(1), switches: +d.switchesPerMin.toFixed(1), rests: +d.restsPerMin.toFixed(1),
    room: d.room, score: +d.logAttempts.toFixed(2), perMin: +d.perMinute.toFixed(2), took: Math.round((Date.now() - t0) / 1000) + "s" };
  console.log(JSON.stringify(row));
  fs.appendFileSync(out, JSON.stringify(row) + "\n");
}
