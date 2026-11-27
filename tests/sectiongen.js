// node tests/sectiongen.js -- every section generator (tools/sectiongen.js) returns a map of the asked size in board
// letters, the same map for the same seed, another for another seed, and a mode + concept (no solves: fast)
const SG = require("../tools/sectiongen.js");
let bad = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) bad++; };
for (const key of SG.KEYS) for (const cols of [20, 75]) for (const tier of ["easy", "harder"]) {
  const a = SG.make(key, { cols, seed: 3, tier }), b = SG.make(key, { cols, seed: 3, tier }), c = SG.make(key, { cols, seed: 4, tier });
  const rect = a.map.every(l => l.length === cols) && /^[.#/\\7r^voqsGNRYBEJKWHUALP]+$/.test(a.map.join(""));
  ok(rect && a.mode && a.concept && a.map.join() === b.map.join() && (cols < 30 || a.map.join() !== c.map.join()), `${key} ${cols} cols ${tier}`);
}
process.exit(bad ? 1 : 0);
