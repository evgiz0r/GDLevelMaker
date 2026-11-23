// node tools/indicators.js <level.gdlvl ...> [--fix] [--gate]
//
// Jump marks (the chevrons, group 990: tools/decorate.js INDICATOR) on or next to a hazard. The user on
// GDLM 44 hellgate round 2: "indicator inside spike". The rule (soft, one copy for every build):
// a mark shows the take-off, so its centre sits at least ~1 block (decorate.js INDICATOR.clear, 40
// units, minus 10 of slack here) in front of the hazard's hitbox, never on or touching one.
// Placement: decorate.js jumpIndicators (make.js, polish.js and every spec-built level use it).
// Check: decorate.js indicatorIssues (this tool; score.js can call it).
// --fix moves each mark that fails back (left, along its surface) to the nearest spot that is clear, and
// writes the file in place: look-only, the gameplay is untouched; the saved solution is replayed once and
// kept for the new file (no re-solve).
// Static: milliseconds per level. POLISH.md "Soft rules from the user's notes".
const fs = require("fs");
const { GD, readGdlvl, writeGdlvl } = require("./io.js");
const DECO = require("./decorate.js");
const args = process.argv.slice(2).filter(a => !a.startsWith("--"));
if (require.main === module && !args.length) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }

let total = 0;
if (require.main === module) for (const f of args) {
  const L = readGdlvl(f), objs = L.level.objects, w = GD.makeWorld(objs, L.level.header);
  const bad = DECO.indicatorIssues(objs, w);
  total += bad.length;
  console.log(`${L.name}: ${bad.length ? bad.length + " mark(s) on or next to a hazard" : "clean"}`);
  for (const b of bad) console.log(`   mark at block ${(b.x / 30 - 0.5).toFixed(1)}, ${b.gap} units from a hazard's hitbox`);
  if (process.argv.includes("--fix") && bad.length) {
    let moved = 0;
    for (const b of bad) {
      const o = objs.find(q => q.x === b.x && q.y === b.y && q.props && q.props[57] === String(DECO.INDICATOR.group));
      if (!o) continue;
      for (let dx = 15; dx <= 120; dx += 15) {
        const t = Object.assign({}, o, { x: o.x - dx });
        if (!DECO.indicatorIssues([t], w, DECO.INDICATOR.clear).length) { o.x = t.x; moved++; break; }
      }
    }
    writeGdlvl(f, L.rec, L.level);
    // keep the saved solution (marks do not collide): replay it once on the new level, then store it
    let kept = "";
    try {
      const sols = require("./solutions.js"), old = sols.get(L.levelStr, true), L2 = readGdlvl(f);
      if (old && old.events) {
        const q = GD.run(GD.makeWorld(L2.level.objects, L2.level.header), old.events);
        if (q.done || (q.end && !q.dead)) { sols.put(L2.levelStr, Object.assign({}, old)); kept = "; saved solution kept (replayed to the end)"; }
      }
    } catch (e) { kept = "; (solution not carried over: " + e.message + ")"; }
    console.log(`   moved ${moved} of ${bad.length}; wrote ${f}${kept}`);
  }
}
if (require.main === module) process.exit(process.argv.includes("--gate") && total ? 1 : 0);
