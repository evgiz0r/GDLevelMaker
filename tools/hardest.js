// node tools/hardest.js  -- difficulty of every GDLM level from the saved routes in viewer/levels.js (no solving; ~15 min in the cloud),
//   one JSON line per level: score (log10 attempts), label, tightest window, hardest input. Sort by "la" for a ranking.
const R = require("path").join(__dirname, "..") + "/"; const vm = require("vm"), fs = require("fs");
const { GD, readGdlvl } = require(R + "tools/io.js"); const DF = require(R + "lib/difficulty.js");
const ctx = { window: {} }; vm.runInNewContext(fs.readFileSync(R + "viewer/levels.js", "utf8"), ctx);
const out = [];
for (const e of ctx.window.GD_LEVELS) {
  if (!/^GDLM/.test(e.name) || !e.solution || !e.solution.events) continue;
  try {
    const Lv = readGdlvl(R + e.file); const w = GD.makeWorld(Lv.level.objects, Lv.level.header);
    const d = DF.difficulty(w, e.solution, {});
    const hard = d.actions.slice().sort((a, b) => a.p - b.p)[0];
    console.log(JSON.stringify({ n: e.name, ok: e.solution.ok, la: +d.logAttempts.toFixed(2), lab: DF.difficultyLabel(d.logAttempts), sec: Math.round(d.seconds), complete: d.complete, tight: Math.round(d.tightest),
      hard: hard && { t: (hard.tick / 240).toFixed(1), blk: Math.round(hard.x / 30), ms: Math.round(hard.ms), mode: hard.mode, type: hard.type, p: +hard.p.toFixed(2) } }));
  } catch (err) { console.log(JSON.stringify({ n: e.name, err: String(err).slice(0, 80) })); }
}
console.log("DONE");
