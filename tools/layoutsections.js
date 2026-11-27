// node tools/layoutsections.js            -- print every layout section as a text map, with its mode and size
//
// The theme layout's SECTIONS (Evgeni, 2026-11-27: "i want the layout to have specific sections, entrance, basic
// staircase, initial open cube corridor, closer cube corridor, hanging structures, flying corridor, wave corridor, flappy
// bird corridors, ball corridors (structures on multiple heights) .. will think about more. and each of those can be
// viewed separately"). One short stretch per kind of play, the same for every design theme, so each theme is judged on
// every kind of structure. These are first drafts: he edits them on the catalogue's Themes tab board (tools/designs_tab.js,
// db collection "designdraw", part "layout:sec:<key>"), and `node tools/designs.js layout` reads his edits back.
//
// A map: rows top to bottom, the last row sits on the ground. # block, / \ floor slopes (rising, falling), 7 r ceiling
// slopes (right angle top-right, top-left), ^ spike, v hanging spike, o saw. `mode`: the game mode the section is played in
// (cube, ship, wave, ufo, ball): its portal goes at the section's start when the gallery is built from these.
"use strict";

// a grid from the bottom up: put(c, r, ch), box(c0, c1, r0, r1)
function grid(w, h) {
  const g = Array.from({ length: h }, () => Array(w).fill("."));
  const put = (c, r, ch) => { if (c >= 0 && c < w && r >= 0 && r < h) g[h - 1 - r][c] = ch; };
  const box = (c0, c1, r0, r1, ch = "#") => { for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) put(c, r, ch); };
  return { put, box, rows: () => g.map(l => l.join("")) };
}

// a tunnel whose ceiling is its floor lifted `gap` rows, so the two fit like puzzle pieces: e(x) is the floor's height at
// the column edge x (steps of 0 or 1 block per column); a column whose edges differ holds a 45-degree slope, the floor's
// solid under the line ("/" rising, "\\" falling), the ceiling's above the same line lifted ("r" rising, "7" falling)
function tunnel(G, W, e, gap, top) {
  for (let c = 0; c < W; c++) { const a = e(c), b = e(c + 1), lo = Math.min(a, b);
    if (lo > 0) G.box(c, c, 0, lo - 1); if (b > a) G.put(c, a, "/"); if (b < a) G.put(c, b, "\\");
    G.box(c, c, Math.max(a, b) + gap, top); if (b > a) G.put(c, a + gap, "r"); if (b < a) G.put(c, b + gap, "7"); } }

const SECTIONS = [
  { key: "entrance", name: "entrance", mode: "cube", note: "up a ramp onto blocks (never the bare ground), a first spike, a small pit", map: (() => {
    const G = grid(24, 7);
    for (let k = 0; k < 3; k++) { G.put(k, k, "/"); G.box(k + 1, k + 1, 0, k); }
    G.box(3, 12, 0, 2); G.put(9, 3, "^");
    G.box(13, 14, 0, 0, "^");
    G.box(15, 23, 0, 3); G.put(20, 4, "^");
    return G.rows(); })() },
  { key: "staircase", name: "basic staircase", mode: "cube", note: "steps up one block at a time, a spike on a landing, steps down", map: (() => {
    const G = grid(28, 9);
    [[0, 2], [4, 3], [8, 4], [12, 5]].forEach(([c, h]) => G.box(c, c + 3, 0, h));
    G.put(14, 6, "^");
    G.box(16, 19, 0, 4); G.box(20, 23, 0, 3); G.box(24, 27, 0, 2);
    G.put(21, 4, "^");
    return G.rows(); })() },
  // fully open on the top (Evgeni 2026-11-27: "on open cube we want it fully open on the top")
  { key: "opencube", name: "open cube corridor", mode: "cube", note: "a floor with pits, nothing overhead: lots of room, platforms in the middle", map: (() => {
    const G = grid(32, 8);
    G.box(0, 6, 0, 1); G.box(7, 9, 0, 0, "^"); G.box(10, 17, 0, 1); G.box(18, 20, 0, 0, "^"); G.box(21, 31, 0, 1);
    G.box(12, 15, 5, 5); G.put(14, 6, "^");
    G.box(24, 26, 4, 4); G.put(13, 2, "^"); G.put(28, 2, "^");
    return G.rows(); })() },
  { key: "closecube", name: "closer cube corridor", mode: "cube", note: "the ceiling comes down to 4 blocks over the floor, hanging spikes in it", map: (() => {
    const G = grid(32, 8);
    G.box(0, 31, 0, 0); G.box(0, 31, 5, 7);
    G.box(8, 9, 0, 0, "^"); G.box(20, 21, 0, 0, "^");
    G.put(6, 1, "^"); G.put(15, 1, "^"); G.put(26, 1, "^");
    G.put(11, 4, "v"); G.put(18, 4, "v"); G.put(23, 4, "v");
    G.box(13, 16, 4, 4); G.put(12, 4, "7"); G.put(17, 4, "r");
    return G.rows(); })() },
  { key: "hanging", name: "hanging structures", mode: "cube", note: "structures hanging from the top over a floor with spikes (holders come from the theme)", map: (() => {
    const G = grid(32, 12);
    G.box(0, 31, 0, 1); G.box(7, 9, 1, 1, "^"); G.box(22, 23, 1, 1, "^");
    G.box(3, 10, 8, 9); G.box(5, 8, 10, 11); G.put(4, 7, "v"); G.put(9, 7, "v");
    G.box(14, 20, 7, 8); G.put(13, 8, "7"); G.put(21, 8, "r"); G.box(16, 18, 9, 11); G.put(17, 6, "v");
    G.box(25, 30, 9, 9); G.box(27, 28, 10, 11); G.put(26, 8, "v"); G.put(29, 8, "v");
    return G.rows(); })() },
  { key: "fly", name: "flying corridor", mode: "ship", note: "a floor and a ceiling that rise and fall together, a saw in the middle", map: (() => {
    const G = grid(36, 12), floor = [1, 1, 1, 2, 3, 3, 3, 2, 1, 1, 1, 1, 2, 3, 4, 4, 3, 2, 1, 1], GAP = 7;
    for (let c = 0; c < 36; c++) { const f = floor[c % floor.length], fn = floor[(c + 1) % floor.length], top = f + GAP;
      G.box(c, c, 0, f - 1); if (fn > f) G.put(c, f, "/"); if (fn < f) G.put(c, f - 1, "\\");
      // the ceiling follows the floor GAP rows up: rising, the next column's new bottom cell is a slope filled top-left
      // ("r"); falling, the cell under this column's bottom becomes one filled top-right ("7")
      G.box(c, c, top, 11); if (fn > f) G.put(c + 1, top, "r"); if (fn < f) G.put(c, top - 1, "7"); }
    G.put(10, 6, "o"); G.put(27, 7, "o"); G.put(5, 4, "^"); G.put(30, 1, "^");
    return G.rows(); })() },
  // a fast part in the middle (Evgeni 2026-11-27: "for the wave corridor, in the middle some different pattern like more
  // cps"): the slow zigzag turns every 5-6 blocks, the middle one every 2 (about 2.5x the clicks a second), then slow again.
  // The ceiling is the floor lifted 4 rows, cell for cell ("it should in some way fit, as if we lift the structures it
  // connects perfectly"): tunnel() draws both from one line of edge heights.
  { key: "wave", name: "wave corridor", mode: "wave", note: "a 45-degree zigzag tunnel, 4 blocks high, its ceiling the floor lifted; a quick zigzag in the middle (a turn every 2 blocks: more clicks a second)", map: (() => {
    const W = 41, G = grid(W, 10), slow = x => Math.min(5, (k => k < 6 ? k : 12 - k)(x % 12)),
      e = x => x <= 11 ? slow(x) : x <= 28 ? 1 + ((x - 12) % 4 < 2 ? (x - 12) % 4 : 4 - (x - 12) % 4) : slow(x - 28);   // middle: 1..3..1
    tunnel(G, W, e, 4, 9);
    return G.rows(); })() },
  { key: "flappy", name: "flappy bird corridors", mode: "ufo", note: "pipes from the floor and the ceiling with a 4-block gap at changing heights", map: (() => {
    const G = grid(34, 12);
    G.box(0, 33, 0, 0, "#");
    [[3, 3], [9, 5], [15, 2], [21, 6], [27, 4]].forEach(([c, g]) => { G.box(c, c + 1, 0, g - 1); G.box(c, c + 1, g + 4, 11); G.put(c, g - 1, "^"); G.put(c + 1, g + 4, "v"); });
    G.put(6, 1, "^"); G.put(18, 1, "^"); G.put(30, 1, "^");
    return G.rows(); })() },
  { key: "ball", name: "ball corridors", mode: "ball", note: "floors and ceilings at several heights: the ball flips from one to the next", map: (() => {
    const G = grid(34, 10);
    G.box(0, 5, 0, 1); G.box(6, 11, 8, 9); G.box(12, 17, 0, 3); G.box(18, 23, 9, 9); G.box(18, 21, 6, 6);
    G.box(24, 29, 0, 1); G.box(28, 33, 8, 9); G.box(30, 33, 0, 2);
    G.put(4, 2, "^"); G.put(9, 7, "v"); G.put(15, 4, "^"); G.put(20, 8, "v"); G.put(26, 2, "^"); G.put(31, 7, "v");
    G.box(6, 11, 0, 0, "^"); G.box(18, 23, 0, 0, "^");
    return G.rows(); })() },
];
// his edited maps (tools/designs.js layout --apply) replace the drafts
try { const ed = JSON.parse(require("fs").readFileSync(require("path").join(__dirname, "..", "knowledge", "layout_sections.json"), "utf8"));
  for (const z of SECTIONS) if (ed[z.key]) { z.map = ed[z.key]; z.edited = true; } } catch (e) {}
// as board tiles: {t, c, r} with c from the section's left edge, r rows above the ground
const tiles = s => { const out = []; s.map.forEach((l, i) => [...l].forEach((ch, c) => { if (ch !== ".") out.push({ t: ch, c, r: s.map.length - 1 - i }); })); return out; };
module.exports = { SECTIONS, tiles, grid };
if (require.main === module) for (const s of SECTIONS) console.log(`\n${s.key} (${s.name}, ${s.mode}, ${s.map[0].length} x ${s.map.length}): ${s.note}\n` + s.map.map(l => "  " + l).join("\n"));
