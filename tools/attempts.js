// The user's attempts at a level, one format for every source (USE_CASES 29): the viewer's "you play" (POST /play) and
// real GD recordings (tools/replay_run.js: logged inputs aligned to the video). The viewer replays one as a ghost
// beside the route with each press early / late / extra / missing (VIEWER.md); difficulty can read where people die.
//   node tools/attempts.js list <level.gdlvl | official:N | base>      the attempts at that level, newest last
//   node tools/attempts.js deaths <level...>                          deaths per 5% of the level (all sources)
//   require("./attempts.js").append(line) / .read(fileOrBase, hash?) / .baseOf(file)
// File: local/attempts/<base>.jsonl (base: the level file's name without .gdlvl, official_<N>, c<id>), one line each:
//   { id, at, source: "viewer" | "video", level, file, hash: GD.levelHash(levelStr) (lib/liveplay.js; that exact version),
//     events: [{tick, type: "press" | "release"}] (240 Hz ticks from the level's start; GD.run(world, events) replays it),
//     result: "died" | "clear", x, pct, t, why, practice, from: {tick, x} | null (a practice attempt still replays from
//     tick 0: the presses that reached its checkpoint are kept), session?, stage?,
//     video?: { file, t, shift_ms, agree, mismatch? } }
// GDLM_LOCAL_DIR: tests.
const fs = require("fs"), path = require("path");
const DIR = () => path.join(process.env.GDLM_LOCAL_DIR || path.join(__dirname, "..", "local"), "attempts");
function baseOf(file) {
  const f = String(file || "");
  if (/^official:(\d+)$/.test(f)) return "official_" + RegExp.$1;
  if (/^c\d+$/.test(f)) return f;
  const st = /([\w.-]+)\.stages[\\/](\w+)\.gdlvl$/.exec(f); if (st) return st[1] + "." + st[2];   // a build stage: <base>.<stage>
  return path.basename(f).replace(/\.(gdlvl|json)$/, "").replace(/[^\w.-]+/g, "_") || "unknown";
}
function append(a) {
  const line = Object.assign({ id: "a" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), at: new Date().toISOString() }, a);
  if (!Array.isArray(line.events)) throw new Error("events needed");
  line.events = line.events.filter(e => e && isFinite(e.tick) && (e.type === "press" || e.type === "release")).map(e => ({ tick: Math.round(e.tick), type: e.type }));
  fs.mkdirSync(DIR(), { recursive: true });
  fs.appendFileSync(path.join(DIR(), baseOf(line.file) + ".jsonl"), JSON.stringify(line) + "\n");
  return line;
}
function read(file, hash) {
  let rows = [];
  try { rows = fs.readFileSync(path.join(DIR(), baseOf(file) + ".jsonl"), "utf8").split(/\r?\n/).filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean); } catch (e) {}
  return hash ? rows.filter(r => r.hash === hash) : rows;
}
module.exports = { append, read, baseOf, DIR };

if (require.main === module) {
  const a = process.argv.slice(2);
  if (a[0] === "list" && a[1]) {
    for (const r of read(a[1])) console.log(`${r.at.slice(5, 16).replace("T", " ")} ${r.source.padEnd(6)} ${r.result === "clear" ? "clear  " : "died " + String(Math.round(r.pct)).padStart(3) + "%"} ${String(r.events.filter(e => e.type === "press").length).padStart(3)} presses ${r.practice ? "practice" : "normal  "} ${r.why || ""} [${r.hash}]`);
  } else if (a[0] === "deaths" && a[1]) {
    const b = {}; for (const r of read(a[1]).filter(r => r.result === "died")) { const k = Math.floor(r.pct / 5) * 5; b[k] = (b[k] || 0) + 1; }
    for (const k of Object.keys(b).map(Number).sort((x, y) => x - y)) console.log(`${String(k).padStart(3)}-${k + 5}%  ${"#".repeat(b[k])} ${b[k]}`);
  } else console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n"));
}
