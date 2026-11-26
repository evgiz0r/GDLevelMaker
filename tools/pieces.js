// node tools/pieces.js <spec.json> [--out pieces.json]
//   -- the pieces a spec is built from (its "pattern" entries: structures, bricks, fly paths), each with the blocks it
//      spans, its clicks per second and where it joins the next one (the user, 2026-11-26: "show the structures on the
//      pictures and their limits where they attach"). Prints one line a piece; --out writes [{x0, x1, name, n}] for
//      `node tools/levelmap.js <level> --pieces <out>` (a bracket per piece on the level map).
//   A piece's span comes from make.js build(): ctx.placements[i].x0 / x1 (blocks) of the objects it put down.
"use strict";
const fs = require("fs"), path = require("path");
function pieces(specFile) {
  const M = require("./make.js"), sp = JSON.parse(fs.readFileSync(specFile, "utf8"));
  const log = console.log; console.log = () => {};
  let r; try { r = M.build(sp, specFile, { placementsOnly: true }); } finally { console.log = log; }
  return r.ctx.placements.filter(p => p.x0 != null).map(p => ({ name: p.name.replace(/^s:/, "") + (p.args && p.args.mode ? " " + p.args.mode : ""), x0: +p.x0.toFixed(1), x1: +p.x1.toFixed(1), n: p.n }))
    .sort((a, b) => a.x0 - b.x0);
}
if (require.main === module) {
  const a = process.argv.slice(2), oi = a.indexOf("--out");
  if (!a[0]) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
  const ps = pieces(a[0]);
  ps.forEach((p, i) => { const next = ps[i + 1]; console.log(`${String(i + 1).padStart(3)} ${p.name.padEnd(24)} blocks ${String(p.x0).padStart(6)}-${String(p.x1).padEnd(6)} ${next ? "gap to next " + (next.x0 - p.x1).toFixed(1) : "last"}`); });
  if (oi >= 0) { fs.writeFileSync(a[oi + 1], JSON.stringify(ps)); console.log("wrote " + a[oi + 1]); }
}
module.exports = { pieces };
