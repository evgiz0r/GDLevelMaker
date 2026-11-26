// node tools/islands.js <level.gdlvl | official pieces.json> [...]   -- are the structures joined or a set of islands?
// node tools/islands.js --ref <pieces.json>                           -- the official reference (lego catalogue's
//                                                                         pieces.json: RobTop's 1-3 s pieces as cells)
//
// Evgeni (2026-11-26): "now that we have proper structures we can probably connect structures slightly better visually,
// making a level look like an extended one and not a set of island structures"; "structures should in general connect,
// unless something else happens on the level ( bigger space, transition )". DECOART.md "Connected structures".
// Per window of W blocks (25, about a screen): the solid cells (blocks, slopes) grouped into islands (cells joined by a
// side or a corner); an island is ANCHORED when it reaches the ground (row 0), the floor or roof of a flying band, or
// a block 9+ rows up (a ceiling); FLOATING otherwise. Numbers:
//   islands      islands per window
//   floating     share of solid cells in floating islands
//   gap          the longest run of columns with no solid at all between two islands (blocks)
// The gameplay solids only (deco that joins them comes later: tools/connect.js).
"use strict";
const fs = require("fs"), path = require("path");
const W = 25;

// cells: Set "c,r" -> metrics for one window
function measure(cells, o = {}) {
  const has = k => cells.has(k), seen = new Set(), isl = [];
  for (const k0 of cells) {
    if (seen.has(k0)) continue;
    const st = [k0], one = []; seen.add(k0);
    while (st.length) { const k = st.pop(); one.push(k); const [c, r] = k.split(",").map(Number);
      for (let dc = -1; dc <= 1; dc++) for (let dr = -1; dr <= 1; dr++) { const n = (c + dc) + "," + (r + dr); if (has(n) && !seen.has(n)) { seen.add(n); st.push(n); } } }
    const cs = one.map(k => k.split(",").map(Number));
    isl.push({ n: cs.length, c0: Math.min(...cs.map(q => q[0])), c1: Math.max(...cs.map(q => q[0])), r0: Math.min(...cs.map(q => q[1])), r1: Math.max(...cs.map(q => q[1])) });
  }
  const anchored = i => i.r0 <= 0 || i.r1 >= (o.roof || 9) || (o.band && (i.r0 <= o.band[0] || i.r1 >= o.band[1]));
  const tot = isl.reduce((a, i) => a + i.n, 0), fl = isl.filter(i => !anchored(i)).reduce((a, i) => a + i.n, 0);
  const sorted = isl.slice().sort((a, b) => a.c0 - b.c0); let gap = 0, reach = -Infinity;
  for (const i of sorted) { if (reach > -Infinity && i.c0 - reach - 1 > gap) gap = i.c0 - reach - 1; reach = Math.max(reach, i.c1); }
  return { islands: isl.length, floating: tot ? fl / tot : 0, gap, cells: tot };
}
const SOLID = id => (id >= 1 && id <= 7) || id === 1338 || id === 40 || id === 83 || id === 69;
// a level: windows of W blocks across it, from its gameplay solids
function level(file) {
  const { readGdlvl } = require("./io.js"), L = readGdlvl(file).level;
  const sol = L.objects.filter(o => SOLID(o.id));
  if (!sol.length) return [];
  const x1 = Math.max(...sol.map(o => o.x)), out = [];
  for (let x0 = 0; x0 < x1; x0 += W * 30) {
    const cells = new Set(sol.filter(o => o.x >= x0 && o.x < x0 + W * 30).map(o => Math.floor((o.x - x0) / 30) + "," + Math.floor(o.y / 30)));
    if (cells.size) out.push(Object.assign({ x0: x0 / 30 }, measure(cells)));
  }
  return out;
}
// the catalogue's pieces: shape entries ["S" | "L", x0, y0, x1, y1] in blocks
function pieces(file, filter = p => p.src === "official" && p.grain === "piece") {
  const P = JSON.parse(fs.readFileSync(file, "utf8")), out = [];
  for (const p of P.filter(filter)) {
    const cells = new Set();
    for (const s of p.shape || []) if (s[0] === "S" || s[0] === "L") for (let c = Math.floor(s[1]); c < Math.ceil(s[3] - 1e-6); c++) for (let r = Math.floor(s[2]); r < Math.ceil(s[4] - 1e-6); r++) cells.add(c + "," + r);
    if (cells.size) out.push(Object.assign({ level: p.level, mode: p.mode, family: p.family, w: p.w }, measure(cells)));
  }
  return out;
}
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const pct = (a, q) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * q))] : 0; };
function summary(rows, perBlocks) {
  const isl = rows.map(r => r.islands * W / (perBlocks ? (r.w || W) : W));
  return { windows: rows.length, islandsPerScreen: +med(isl).toFixed(1), floating: +med(rows.map(r => r.floating)).toFixed(2), floatingP75: +pct(rows.map(r => r.floating), 0.75).toFixed(2),
    gap: med(rows.map(r => r.gap)), gapP90: pct(rows.map(r => r.gap), 0.9) };
}
module.exports = { measure, level, pieces, summary, W };
if (require.main === module) {
  const a = process.argv.slice(2);
  if (!a.length) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(0); }
  if (a[0] === "--ref") {
    const rows = pieces(a[1]);
    for (const fam of ["jump", "flip", "fly"]) console.log(("official " + fam).padEnd(34), JSON.stringify(summary(rows.filter(r => r.family === fam), true)));
    process.exit(0);
  }
  for (const f of a) { const rows = level(f); console.log(path.basename(f).padEnd(34), JSON.stringify(summary(rows))); }
}
