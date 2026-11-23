// node tools/joins.js <level.gdlvl ...> [--gate]
//
// Disconnected structure (the user on GDLM 44 hellgate round 2 at the wave entry: "disconnected structure":
// the entry's flat roof ended and the first leg's sloped roof began two rows lower, an open step in the
// ceiling; showcase saw the same as a stub at GDLM 50's wave entrance). A soft rule: structures are
// connected -- a slope's surface joins the next piece flush at both ends.
// For every 45-degree slope (1338, not turned) each end of its surface must touch, on the outward side,
// another block or slope (any solid cell whose edge passes through that point), the ground (y 0), or the
// top of a flying band (y 300+). An end in open air is an open edge: the surface stops mid-air or steps.
// Prints each with its block; --gate exits 1 when any is found. Static: milliseconds per level.
// Placement that avoids it: patterns.js wave-zigzag keeps the `leadGap` roof until the leg's slope meets it.
// POLISH.md "Soft rules from the user's notes".
const fs = require("fs");
const { readGdlvl } = require("./io.js");
const args = process.argv.slice(2).filter(a => !a.startsWith("--"));

const SOLID = new Set([1, 2, 3, 4, 5, 6, 7, 40, 83, 69, 70, 71, 72, 74, 75, 76, 77, 78, 81, 82, 90, 91, 92, 93, 94, 95, 96, 116, 117, 118, 119, 120, 121, 122, 146, 147, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169, 170, 171, 172, 173, 174, 175, 207, 208, 209, 210, 211, 212, 213, 247, 248, 249, 250, 251, 252, 253, 254, 255, 256, 257, 258, 260, 261, 263, 264, 265, 267, 268, 269, 270, 271, 272, 274, 275]);
const SLOPE = 1338;
function check(objs) {
  const isDeco = o => o.props && (o.props[121] === "1" || o.props[134] === "1");
  const cells = objs.filter(o => (SOLID.has(o.id) || o.id === SLOPE) && !isDeco(o) && !(o.props && o.props[32] && +o.props[32] !== 1));
  // the edges of every solid cell, for "does anything touch this point"
  const boxes = cells.map(o => ({ o, x0: o.x - 15, x1: o.x + 15, y0: o.y - 15, y1: o.y + 15 }));
  const touches = (px, py, side, self) => boxes.some(b => b.o !== self && (side < 0 ? b.x1 <= px + 1 && b.x0 < px : b.x0 >= px - 1 && b.x1 > px)
    && px >= b.x0 - 1 && px <= b.x1 + 1 && py >= b.y0 - 1 && py <= b.y1 + 1);
  const out = [];
  for (const s of cells) {
    if (s.id !== SLOPE || (s.rot || 0) % 360) continue;
    const x0 = s.x - 15, x1 = s.x + 15, y0 = s.y - 15, y1 = s.y + 15;
    // the surface: rising (bottom-left -> top-right) unless exactly one of flipX / flipY is set
    const rising = !!s.flipX === !!s.flipY;
    const ends = rising ? [[x0, y0, -1], [x1, y1, 1]] : [[x0, y1, -1], [x1, y0, 1]];
    for (const [px, py, side] of ends) {
      if (py <= 1 || py >= 299) continue;              // the ground, or the top of a flying band
      if (touches(px, py, side, s)) continue;
      out.push({ x: px, y: py, note: `a slope's ${side < 0 ? "left" : "right"} end at row ${(py / 30).toFixed(1)} meets nothing (an open edge / step)` });
    }
  }
  return out.sort((a, b) => a.x - b.x);
}

if (require.main === module) {
  if (!args.length) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
  let total = 0;
  for (const f of args) {
    const L = readGdlvl(f), r = check(L.level.objects); total += r.length;
    console.log(`${L.name}: ${r.length ? r.length + " open edge(s)" : "clean"}`);
    for (const s of r) console.log(`   block ${(s.x / 30).toFixed(1).padStart(6)}  ${s.note}`);
  }
  process.exit(process.argv.includes("--gate") && total ? 1 : 0);
}
module.exports = { check };
