// node tools/sectionstats.js [key ...] [--gen N] [--cols C] [--tier T]   -- his drawn section vs N generated ones, scored
//
// Evgeni, 2026-11-27, on tools/sectiongen.js: "the generator is bad, i compare the cps, the variaty, height changes, blocks
// in the middle. unparable. per section we will need to understand how to build a specific generator for that task".
// So those four axes, as numbers, for any section map (his drawing in knowledge/layout_sections.json, or a generator's):
//   cps       presses a second of the solver's route (tools/layoutcheck.js), 1x speed
//   heights   the route's resting heights: changes a second, mean size of a change (rows), distinct heights
//   variety   how much the motif changes: spread (coefficient of variation) of the gaps between presses and of the
//             rest lengths, and distinct shapes of the solid pieces (width x height)
//   middle    blocks in the middle of the space: share of solid cells not joined to the band's floor or top edge (a mass
//             floating in the play space), and the number of such floating pieces per 10 columns
// stats(map, check) -> numbers; `node tools/sectionstats.js ball --gen 4` prints his drawing and 4 generated ones with the
// ratio generated / his per axis. Heavy (it solves): one layoutcheck per map.
"use strict";
const COLS_PER_SEC = 311.58 / 30;
const SOLID = new Set(["#", "/", "\\", "7", "r"]);

// connected solid pieces (4-neighbour) of a map; each with its cells, bounds and whether it touches the floor / top row
function pieces(map) {
  const H = map.length, W = map[0].length, seen = map.map(l => Array(W).fill(false)), out = [];
  for (let i = 0; i < H; i++) for (let c = 0; c < W; c++) { if (seen[i][c] || !SOLID.has(map[i][c])) continue;
    const st = [[i, c]], cells = []; seen[i][c] = true;
    while (st.length) { const [a, b] = st.pop(); cells.push([a, b]);
      for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = a + da, y = b + db;
        if (x >= 0 && x < H && y >= 0 && y < W && !seen[x][y] && SOLID.has(map[x][y])) { seen[x][y] = true; st.push([x, y]); } } }
    const rows = cells.map(q => q[0]), cs = cells.map(q => q[1]);
    out.push({ n: cells.length, w: Math.max(...cs) - Math.min(...cs) + 1, h: Math.max(...rows) - Math.min(...rows) + 1,
      floor: rows.includes(H - 1), top: rows.includes(0) }); }
  return out;
}
const cv = a => { if (a.length < 2) return 0; const m = a.reduce((s, x) => s + x, 0) / a.length; if (!m) return 0;
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length) / m; };

// the four axes for one map and its layoutcheck result (route [[col, row]], taps [[col, row]])
function stats(map, chk) {
  const W = map[0].length, secs = W / COLS_PER_SEC, P = pieces(map);
  const solid = P.reduce((s, p) => s + p.n, 0), floating = P.filter(p => !p.floor && !p.top);
  const out = { cols: W, ok: !!(chk && chk.ok) };
  out.middleShare = solid ? +(floating.reduce((s, p) => s + p.n, 0) / solid).toFixed(2) : 0;
  out.middlePer10 = +(floating.length / W * 10).toFixed(2);
  out.shapes = new Set(P.map(p => p.w + "x" + p.h)).size;
  if (chk && chk.ok) {
    const taps = (chk.taps || []).filter(t => t[0] >= 0 && t[0] <= W), route = (chk.route || []).filter(q => q[0] >= 0 && q[0] <= W);
    out.cps = +(taps.length / secs).toFixed(2);
    const gaps = taps.slice(1).map((t, i) => t[0] - taps[i][0]); out.gapCV = +cv(gaps).toFixed(2);
    // resting heights: runs where the row stays (within 0.05) for 2+ samples
    const rests = []; let run = null;
    for (const [c, r] of route) { if (run && Math.abs(r - run.r) < 0.05) { run.n++; run.c1 = c; } else { if (run && run.n >= 2) rests.push(run); run = { r, n: 1, c0: c, c1: c }; } }
    if (run && run.n >= 2) rests.push(run);
    const ch = rests.slice(1).map((q, i) => Math.abs(q.r - rests[i].r)).filter(d => d > 0.5);
    out.heightChangesPerSec = +(ch.length / secs).toFixed(2);
    out.heightStep = ch.length ? +(ch.reduce((s, x) => s + x, 0) / ch.length).toFixed(1) : 0;
    out.heights = new Set(rests.map(q => Math.round(q.r))).size;
    out.restCV = +cv(rests.map(q => q.c1 - q.c0)).toFixed(2);
  }
  return out;
}
const AXES = ["cps", "heightChangesPerSec", "heightStep", "heights", "gapCV", "restCV", "shapes", "middleShare", "middlePer10"];
module.exports = { stats, pieces, AXES };

if (require.main === module) {
  require("./heavy.js").claim();
  const a = process.argv.slice(2), arg = k => { const i = a.indexOf("--" + k); return i >= 0 ? a[i + 1] : null; };
  const keys = []; for (let i = 0; i < a.length; i++) { if (a[i].startsWith("--")) { i++; continue; } keys.push(a[i]); }
  const LS = require("./layoutsections.js"), LC = require("./layoutcheck.js"), SG = require("./sectiongen.js"), n = +(arg("gen") || 3);
  for (const key of keys.length ? keys : SG.KEYS) {
    const his = LS.SECTIONS.find(z => z.key === key); if (!his) { console.log(key + ": no drawing"); continue; }
    const H = stats(his.map, LC.check(his)), cols = +(arg("cols") || his.map[0].length), rowsOf = [];
    const pr = (label, s) => console.log("  " + label.padEnd(12) + (s.ok === false ? "DOES NOT SOLVE  " : "") + AXES.map(k => k + " " + (s[k] ?? "-")).join("  "));
    console.log(`${key} (${his.mode}, his ${his.map[0].length} cols)`); pr("his", H);
    for (let s = 1; s <= n; s++) { if (!SG.GEN[key]) break; const z = SG.make(key, { cols, seed: s, tier: arg("tier") || "normal", rows: his.map.length });
      const st = stats(z.map, LC.check(z)); rowsOf.push(st); pr("gen " + s, st); }
    if (rowsOf.length) console.log("  " + "gen / his".padEnd(12) + AXES.map(k => { const v = rowsOf.filter(r => r[k] != null).map(r => r[k]), m = v.length ? v.reduce((x, y) => x + y, 0) / v.length : null;
      return k + " " + (m == null || !H[k] ? "-" : (m / H[k]).toFixed(2)); }).join("  "));
  }
}
