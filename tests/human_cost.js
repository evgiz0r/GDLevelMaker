// node tests/human_cost.js -- lib/difficulty.js humanCost: the same route with its presses moved to the early edge of
// their windows must cost more than with them in the middle, and the cost must be the difficulty score plus small terms.
const { GD, readGdlvl } = require("../tools/io.js");
const DF = require("../lib/difficulty.js"), S = require("../tools/solutions.js");
const L = readGdlvl(__dirname + "/../levels/gdlm_41_classic.gdlvl"), w = GD.makeWorld(L.level.objects, L.level.header);
const sol = S.get(L.levelStr, true);
if (!sol || !sol.events) { console.log("skip: no saved solution for GDLM 41 (node tools/solutions.js levels/gdlm_41_classic.gdlvl)"); process.exit(0); }
const base = DF.humanCost(w, sol.events);
let ok = true;
const check = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) ok = false; };
check(Math.abs(base.cost - Object.values(base.terms).reduce((a, b) => a + b, 0)) < 1e-9, `cost = sum of terms (${base.cost.toFixed(3)})`);
// edge-timed: presses moved one at a time to 1 tick inside the early edge of their window (lenient windows let
// later inputs adjust, so they move singly); the first move that still clears is compared
let tried = 0, done = false;
for (const a of base.actions) {
  if (done || a.type !== "tap" || a.lo == null || a.hi - a.lo < 6) continue;
  const ev = sol.events.map(e => Object.assign({}, e));
  const i = ev.findIndex(e => e.type === "press" && e.tick === a.tick); if (i < 0) continue;
  const d = a.lo + 1 - a.tick; ev[i].tick += d; if (ev[i + 1] && ev[i + 1].type === "release") ev[i + 1].tick += d;
  tried++;
  if (GD.run(w, ev).dead) continue;
  const e = DF.humanCost(w, ev); done = true;
  check(e.terms.centre > base.terms.centre && e.cost > base.cost, `press at tick ${a.tick} moved to its window's edge costs more: ${e.cost.toFixed(3)} > ${base.cost.toFixed(3)} (centre ${e.terms.centre.toFixed(3)} vs ${base.terms.centre.toFixed(3)})`);
}
check(done, `an edge-timed variant that clears (${tried} tried)`);
process.exit(ok ? 0 : 1);
