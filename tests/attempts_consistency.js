// node tests/attempts_consistency.js [--no-replay]   -- every attempt line from a recording says two things apart and
// they never contradict (the user, 2026-11-24: "how didnt we catch my runs": xStep's clear was written as result
// "clear" with why "spike" -- the sim's death -- and the viewer drew the user's clear as a death).
// For each local/attempts/*.jsonl line with source "video" (tools/replay_run.js):
//   - top level (result / pct / why) = what really happened in the game; `why` only on a death, never on a clear;
//   - `sim` = { result, pct, x, why } = our sim replaying the same events; present on every line (an old line without
//     it was never checked: re-run tools/replay_run.js on its recording);
//   - `agree` = tools/attempts.js agreeOf(line), or null for a quick restart (video.res "restart");
//   - and (unless --no-replay) `sim` matches a fresh replay of the events on today's physics: a physics change that
//     moves the outcome makes the line stale -- re-run replay_run.js on that recording.
// Viewer lines (source "viewer") are played in the sim itself: only the why-on-a-clear rule applies to them.
// Skips when there is no local/attempts (another machine). PHYSICS.md "Fidelity".
const fs = require("fs"), path = require("path");
const { agreeOf, AGREE_PCT } = require("../tools/attempts.js");
const DIR = path.join(process.env.GDLM_LOCAL_DIR || path.join(__dirname, "..", "local"), "attempts");
if (!fs.existsSync(DIR)) { console.log("attempts_consistency: skipped (no local/attempts)"); process.exit(0); }
const replay = !process.argv.includes("--no-replay");
const { GD, readGdlvl, unpack } = require("../tools/io.js");
const SRC = require("../tools/gdpaths.js").LEVELS;
const worlds = new Map();
function worldOf(file) {
  if (worlds.has(file)) return worlds.get(file);
  let w = null;
  try {
    let levelStr;
    if (/^official:\d+$/.test(file)) levelStr = unpack(fs.readFileSync(SRC + file.slice(9) + ".txt", "utf8"));
    else if (/^c\d+$/.test(file)) levelStr = readGdlvl(path.join(__dirname, "..", "local", "community", file.slice(1) + ".gdlvl")).levelStr;
    else levelStr = readGdlvl(path.join(__dirname, "..", file)).levelStr;
    const L = GD.parseLevel(levelStr); w = { w: GD.makeWorld(L.objects, L.header), hash: require("../lib/liveplay.js").levelHash(levelStr) };
  } catch (e) {}
  worlds.set(file, w); return w;
}
let bad = 0, n = 0;
const fail = (f, o, msg) => { bad++; console.log(`FAIL ${f} ${o.video ? o.video.file + " @" + o.video.t + "s" : o.id}: ${msg}`); };
for (const f of fs.readdirSync(DIR).filter(f => f.endsWith(".jsonl")).sort()) {
  for (const l of fs.readFileSync(path.join(DIR, f), "utf8").split(/\r?\n/).filter(Boolean)) {
    let o; try { o = JSON.parse(l); } catch (e) { fail(f, { id: "?" }, "not JSON"); continue; }
    n++;
    if (o.result === "clear" && o.why) fail(f, o, `result "clear" with why "${o.why}" (a cause on a clear: the sim's death written as the user's?)`);
    if (o.source !== "video") continue;
    if (!o.sim || !o.sim.result) { fail(f, o, "no sim outcome: never checked (re-run tools/replay_run.js on " + (o.video && o.video.file) + ")"); continue; }
    const restart = o.video && o.video.res === "restart";
    const want = restart ? null : agreeOf(o);
    if (o.agree !== want) fail(f, o, `agree ${o.agree} but the rule says ${want} (you: ${o.result} ${o.pct}%, sim: ${o.sim.result} ${o.sim.pct}%)`);
    if (replay) {
      const W = worldOf(o.file);
      if (!W) { console.log(`skip ${f}: level ${o.file} not on this PC`); continue; }
      if (o.hash && W.hash !== o.hash) { console.log(`skip ${f} @${o.video && o.video.t}: the level changed since (hash)`); continue; }
      const q = GD.run(W.w, o.events), res = q.done ? "clear" : "died", pct = q.done ? 100 : Math.min(100, q.end.x / W.w.endX * 100);
      if (res !== o.sim.result || (res === "died" && Math.abs(pct - o.sim.pct) > AGREE_PCT))
        fail(f, o, `stale: the sim now ${res === "clear" ? "clears" : "dies at " + pct.toFixed(1) + "%"}, the line says ${o.sim.result} ${o.sim.pct}% (physics changed: re-run replay_run.js)`);
    }
  }
}
console.log(bad ? `${bad} of ${n} attempt lines inconsistent` : `ok   ${n} attempt lines consistent`);
process.exit(bad ? 1 : 0);
