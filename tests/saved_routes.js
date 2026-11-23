// node tests/saved_routes.js [--all]
// Every GDLM level's saved route still finishes on the current physics (run it after any physics change:
// tools/solutions.js stamps each route with the physics commit it was solved on). A level whose route
// dies, or that has none, replays a death in the viewer and on the phone: the user, 2026-11-23, "why when
// I play the cube timings it dies" -- the route was stamped with older physics, the index dropped it and
// the page's own solve failed. Fix: node tools/solutions.js <level> (heavy, waits for the lock), or --all.
// Checks levels/*.gdlvl and examples/*.gdlvl (with --all also local/wip/*/*.gdlvl). One replay each: seconds.
const fs = require("fs"), path = require("path");
const { GD, readGdlvl } = require("../tools/io.js");
const sols = require("../tools/solutions.js");
const ROOT = path.join(__dirname, "..");
const dirs = ["levels", "examples"].concat(process.argv.includes("--all") ? fs.readdirSync(path.join(ROOT, "local", "wip")).map(d => "local/wip/" + d) : []);
let bad = 0, n = 0;
for (const dir of dirs) {
  const d = path.join(ROOT, dir); if (!fs.existsSync(d) || !fs.statSync(d).isDirectory()) continue;
  for (const f of fs.readdirSync(d).filter(f => f.endsWith(".gdlvl")).sort()) {
    const L = readGdlvl(path.join(d, f)); n++;
    const s = sols.get(L.levelStr, true);
    let what;
    if (!s || !s.events) what = "NO SAVED ROUTE";
    else if (!s.ok) what = "saved route does not finish (ok: false)";
    else {
      const q = GD.run(GD.makeWorld(L.level.objects, L.level.header), s.events), last = q.path[q.path.length - 1];
      what = (q.done || (q.end && !q.dead)) ? null : `DIES at block ${(last.x / 30).toFixed(1)} (${last.why || "?"})`;
      if (!what && s.physics !== sols.physicsCommit()) what = null;   // stale stamp but still finishes: fine
    }
    if (what) { bad++; console.log(`FAIL ${dir}/${f} (${L.name}): ${what}`); }
  }
}
console.log(bad ? `${bad} of ${n} levels would replay a death (or nothing): node tools/solutions.js <level>` : `ok: all ${n} saved routes finish on physics ${sols.physicsCommit()}`);
process.exit(bad ? 1 : 0);
