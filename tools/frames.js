// node tools/frames.js <level.gdlvl> [...]  -- timing windows as the user's game sees them.
// The user's GD has "Click Between Steps" OFF: a press counts only on a 60 fps frame boundary
// (every 4th 240 Hz physics step). For each press of the exact solution this prints its window in
// steps and the FEWEST frame boundaries inside it over the 4 possible frame phases, then re-solves
// with presses only on frame boundaries (solveSweep) to show the level is beatable that way too.
// A window with 1-2 frames (under ~50 ms) is a triple-spike-level squeeze: fine for hard levels,
// too tight for easy/test ones (STYLE.md: timing is a per-level difficulty knob).
// Found on Nov 22 2026: GDLM 02's last triple had 2 frames (46 ms); it became a double (8 frames).
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
const path = require("path");
const { GD, readGdlvl } = require("./io.js");
const files = process.argv.slice(2);
if (!files.length) { console.log("usage: node tools/frames.js levels/<name>.gdlvl [...]"); process.exit(1); }
let worstAll = Infinity;
for (const f of files) {
  const L = readGdlvl(f).level, w = GD.makeWorld(L.objects, L.header);
  const r = GD.solve(w, { maxStates: 3000000 });
  if (!r.ok) { console.log(`${path.basename(f)}: the exact solver cannot beat it (cube-only levels; others: solveSweep only)`); continue; }
  let worst = Infinity;
  const rows = r.clicks.filter(c => c.type === "press").map(c => {
    let minF = Infinity;
    for (let ph = 0; ph < 4; ph++) { let k = 0; for (let t = c.lo; t <= c.hi; t++) if ((t + ph) % 4 === 0) k++; minF = Math.min(minF, k); }
    worst = Math.min(worst, minF);
    return `block ${(c.x / 30).toFixed(1)}: ${c.hi - c.lo + 1} steps (${Math.round((c.hi - c.lo + 1) / 0.24)} ms), ${minF} frame${minF === 1 ? "" : "s"}${minF <= 2 ? "  <- tight" : ""}`;
  });
  const sw = GD.solveSweep(w);
  console.log(`== ${path.basename(f)}: ${rows.length} presses, fewest frames in a window ${worst}; frame-boundary solve: ` +
    (sw.ok ? `beaten (${sw.events.filter(e => e.type === "press").length} presses; holding counts once)` : `FAILS at block ${(sw.dieAt.x / 30).toFixed(1)}`));
  for (const s of rows) console.log("   " + s);
  worstAll = Math.min(worstAll, worst);
}
process.exit(worstAll === 0 ? 1 : 0);
