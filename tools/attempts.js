// The user's attempts at a level, one format for every source (USE_CASES 29): the viewer's "you play" (POST /play) and
// real GD recordings (tools/replay_run.js: logged inputs aligned to the video). The viewer replays one as a ghost
// beside the route with each press early / late / extra / missing (VIEWER.md); difficulty can read where people die.
//   node tools/attempts.js list <level.gdlvl | official:N | base>      the attempts at that level, newest last
//   node tools/attempts.js deaths <level...>                          deaths per 5% of the level (all sources)
//   node tools/attempts.js index                                      every level with attempts, newest played first
//   require("./attempts.js").append(line) / .read(fileOrBase, hash?) / .baseOf(file) / .index()
// File: local/attempts/<base>.jsonl (base: baseOf(file) -- the level file's name without .gdlvl; official_<N> with no zero
//   padding for official:N and the viewer's local/official_NN.json alike; c<id>), one line each:
//   { id, at, source: "viewer" | "video", level, file, hash: GD.levelHash(levelStr) (lib/liveplay.js; that exact version),
//     events: [{tick, type: "press" | "release"}] (240 Hz ticks from the level's start; GD.run(world, events) replays it),
//     result: "died" | "clear", x, pct, t, why, practice, from: {tick, x} | null (a practice attempt still replays from
//     tick 0: the presses that reached its checkpoint are kept), session?, stage?,
//     video?: { file, inputs (the input log's file name), t (start in the video, s), shift_ms, agree, res: "agree" | "mismatch",
//              mismatch? } }   (tools/replay_run.js, source "video"; agreed with physics 2026-11-24)
//   Outcome, two sides (proposed to physics 2026-11-24): result / pct / x / t / why = what really happened (the game in the
//   recording, or the viewer's play; why only for a real death), sim: { result, pct, x, why, tick } = our sim replaying the
//   same events, agree: true when both end the same way (same result, pct within 1). The viewer shows both when they differ.
//   pct as GD shows it (0-100), x in units, for both sources. A practice attempt from a recording only has the inputs
//   after its checkpoint: events start at from.tick, and the viewer prepends the route's own presses up to from.tick
//   (and compares only from there); a viewer attempt carries its own presses before it.
// GDLM_LOCAL_DIR: tests.
const fs = require("fs"), path = require("path");
const DIR = () => path.join(process.env.GDLM_LOCAL_DIR || path.join(__dirname, "..", "local"), "attempts");
// the key: lib/liveplay.js attemptsBase (the viewer uses the same function to find a level's runs)
const baseOf = file => require("../lib/liveplay.js").attemptsBase(file);
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
// every level with attempts, newest played first: one small row each (the viewer's "my runs" tab; GET /attempts/index).
// Cached by the files' sizes and times, so a repeat call reads nothing.
let IDX = null;
function index() {
  let names = []; try { names = fs.readdirSync(DIR()).filter(f => f.endsWith(".jsonl")); } catch (e) { return []; }
  const stamp = names.map(f => { try { const st = fs.statSync(path.join(DIR(), f)); return f + ":" + st.size + ":" + st.mtimeMs; } catch (e) { return f; } }).join("|");
  if (IDX && IDX.stamp === stamp && IDX.dir === DIR()) return IDX.rows;
  const rows = [];
  for (const f of names) {
    const all = read(f.replace(/\.jsonl$/, "")); if (!all.length) continue;
    const last = all.reduce((a, b) => (b.at || "") >= (a.at || "") ? b : a);
    rows.push({ base: f.replace(/\.jsonl$/, ""), level: last.level || "", file: last.file || "", attempts: all.length, clears: all.filter(r => r.result === "clear").length,
      best: Math.max(...all.map(r => r.result === "clear" ? 100 : +r.pct || 0)), last: last.at, lastId: last.id, lastHash: last.hash || "",
      viewer: all.filter(r => r.source !== "video").length, video: all.filter(r => r.source === "video").length,
      mismatch: all.filter(r => r.video && r.video.res === "mismatch").length, hashes: [...new Set(all.map(r => r.hash))] });
  }
  rows.sort((a, b) => String(b.last).localeCompare(String(a.last)));
  IDX = { stamp, dir: DIR(), rows }; return rows;
}
module.exports = { append, read, baseOf, index, DIR };

if (require.main === module) {
  const a = process.argv.slice(2);
  if (a[0] === "list" && a[1]) {
    for (const r of read(a[1])) console.log(`${r.at.slice(5, 16).replace("T", " ")} ${r.source.padEnd(6)} ${r.result === "clear" ? "clear  " : "died " + String(Math.round(r.pct)).padStart(3) + "%"} ${String(r.events.filter(e => e.type === "press").length).padStart(3)} presses ${r.practice ? "practice" : "normal  "} ${r.why || ""} [${r.hash}]`);
  } else if (a[0] === "deaths" && a[1]) {
    const b = {}; for (const r of read(a[1]).filter(r => r.result === "died")) { const k = Math.floor(r.pct / 5) * 5; b[k] = (b[k] || 0) + 1; }
    for (const k of Object.keys(b).map(Number).sort((x, y) => x - y)) console.log(`${String(k).padStart(3)}-${k + 5}%  ${"#".repeat(b[k])} ${b[k]}`);
  } else if (a[0] === "index") {
    for (const r of index()) console.log(`${String(r.last).slice(5, 16).replace("T", " ")} ${r.base.padEnd(34)} ${String(r.attempts).padStart(3)} tries ${String(r.clears).padStart(2)} clear  best ${String(Math.round(r.best)).padStart(3)}%  ${r.video ? r.video + " video" : ""}`);
  } else console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n"));
}
