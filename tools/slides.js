// node tools/slides.js <level.gdlvl> [--min 3]  -- lazy slides: where holding (or letting go of) the button the whole way
//   skips a run of the route's presses in a flying mode (ship, ufo, wave, swing).
//
// Evgeni on GDLM 78 v9 (2026-11-28): "the ship has a lot of places it could slide, as these are slopes, need to block full sliding
// from being possible ( like holding or releaseing completely skipping a lot of gameplay )". From the saved route, at each press
// and release in a flying stretch the button is then held (or let go) for good; the run is followed until it dies or the mode
// ends. A SLIDE = it lives through `min` or more of the route's presses (default 3) and 1 s or more: those presses can be
// skipped. tools/typebuild.js scores section seeds by layoutcheck lazyCheck (the section alone); this is the whole level's check,
// run by typebuild --run beside skips.js and outside.js, and by the judge report.
//   slides(w, events, path) -> [{t0, t1, mode, input: "hold" | "release", skipped, x0, x1}]
"use strict";
const FLY = new Set(["ship", "ufo", "wave", "swing"]);

function slides(GD, w, events, path, o = {}) {
  const min = o.min ?? 3, TPS = 240, out = [], presses = events.filter(e => e.type === "press").map(e => e.tick);
  const starts = events.filter(e => FLY.has((path[Math.min(e.tick, path.length - 1)] || {}).mode));
  let coveredTo = -1;
  for (const e of starts) {
    if (e.tick < coveredTo) continue;
    const mode = path[e.tick].mode, input = e.type === "press" ? "hold" : "release";
    const prefix = events.filter(q => q.tick <= e.tick);   // up to and with this input, then nothing more: the button stays as it is
    const p = GD.run(w, prefix).path;
    // how far it lives while still in the same mode
    let k = e.tick; while (k + 1 < p.length && !p[k + 1].dead && p[k + 1].mode === mode) k++;
    const skipped = presses.filter(t => t > e.tick && t <= k).length, secs = (k - e.tick) / TPS;
    if (skipped >= min && secs >= 1) {
      out.push({ t0: +(e.tick / TPS).toFixed(2), t1: +(k / TPS).toFixed(2), mode, input, skipped, x0: +(path[e.tick].x / 30).toFixed(1), x1: +(p[k].x / 30).toFixed(1) });
      coveredTo = k;
    }
  }
  return out;
}
module.exports = { slides };

if (require.main === module) {
  const a = process.argv.slice(2), f = a.find(x => !x.startsWith("--"));
  if (!f) { console.log(require("fs").readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
  require("./heavy.js").claim();
  const { readGdlvl, GD } = require("./io.js"), L = readGdlvl(f), S = require("./solutions.js").get(L.levelStr, true);
  if (!S || !S.events) { console.log("no saved route: node tools/solutions.js " + f); process.exit(1); }
  const w = GD.makeWorld(L.level.objects, L.level.header), path = GD.run(w, S.events).path;
  const r = slides(GD, w, S.events, path, { min: a.includes("--min") ? +a[a.indexOf("--min") + 1] : 3 });
  console.log(`${L.name}: ${r.length ? r.length + " lazy slide(s)" : "no lazy slide (holding or letting go never skips 3+ presses)"}`);
  for (const s of r) console.log(`   ${s.t0}-${s.t1} s, blocks ${s.x0}-${s.x1}, ${s.mode}: ${s.input} the whole way skips ${s.skipped} presses`);
}
