// node tests/sectiongen.js -- every section generator (tools/sectiongen.js) returns a map of the asked size in board
// letters, the same map for the same seed, another for another seed, and a mode + concept (no solves); a type with planned
// presses is cleared by them alone (sim runs, ~10 s; --quick skips)
const SG = require("../tools/sectiongen.js");
let bad = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) bad++; };
for (const key of SG.KEYS) for (const cols of [20, 75]) for (const tier of ["easy", "harder"]) {
  const a = SG.make(key, { cols, seed: 3, tier }), b = SG.make(key, { cols, seed: 3, tier }), c = SG.make(key, { cols, seed: 4, tier });
  const rect = a.map.every(l => l.length === cols) && /^[.#/\\7r^voqsGNRYBEJKWHUALP]+$/.test(a.map.join(""));
  ok(rect && a.mode && a.concept && a.map.join() === b.map.join() && (cols < 30 || a.map.join() !== c.map.join()), `${key} ${cols} cols ${tier}`);
}
// PRESSES FIRST: a type that carries its planned presses must be cleared by exactly those taps, no search (each a sim run:
// a few seconds in all). Off with --quick.
if (!process.argv.includes("--quick")) { const LC = require("../tools/layoutcheck.js"), log = console.log;
  for (const key of SG.KEYS) for (const [cols, rows] of [[60, undefined], [60, 20]]) for (const tier of ["easy", "harder"]) {
    const z = SG.make(key, { cols, rows, seed: 2, tier }); if (!z.presses) continue;
    console.log = () => {}; let r; try { r = LC.planCheck(z); } finally { console.log = log; }
    ok(r.ok, `plan ${key} ${cols}x${rows || "-"} ${tier}: ${z.presses.length} presses` + (r.ok ? "" : ` die col ${r.dieCol} row ${r.dieRow} (${r.why})`)); } }
process.exit(bad ? 1 : 0);
