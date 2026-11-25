// node tests/compare.js -- tools/compare.js on two short repo levels (saved routes, no solve, no browser): every row has a
// value for each, the harder level by score is the one the verdict names, rows with a "better" side mark one winner, and
// the page template takes the data.
const assert = require("assert"), fs = require("fs"), path = require("path");
const C = require("../tools/compare.js");
const a = C.measureLevel("levels/gdlm_41_classic.gdlvl"), b = C.measureLevel("levels/gdlm_43_climb.gdlvl");
for (const L of [a, b]) {
  assert(L.size.seconds > 5 && L.size.presses > 0, L.name + ": size from the saved route");
  assert(isFinite(L.difficulty.score) && L.difficulty.tightestMs > 0, L.name + ": difficulty");
  assert(L.taste.score >= 0 && L.taste.score <= 100, L.name + ": taste " + JSON.stringify(L.taste));
  assert(L.bricks.pieces > 0 && Math.abs(Object.values(L.bricks.families).reduce((s, v) => s + v, 0) - 1) < 0.01, L.name + ": brick mix");
}
const rows = C.table([a, b]);
for (const r of rows) { assert.strictEqual(r.values.length, 2, r.label); if (r.best) assert(r.best.length === 1, r.label + ": one winner"); }
const v = C.verdict([a, b]), harder = a.difficulty.score > b.difficulty.score ? a : b;
assert(v.some(s => s.startsWith(harder.name + " is harder")), JSON.stringify(v));
const tpl = fs.readFileSync(path.join(__dirname, "..", "viewer", "compare.html"), "utf8");
assert(tpl.includes("/*COMPARE_DATA*/null"), "page template placeholder");
console.log(`ok compare: ${a.name} ${a.difficulty.score} vs ${b.name} ${b.difficulty.score}; taste ${a.taste.score} vs ${b.taste.score}; ${rows.length} rows`);
