// node tools/sectiongen.js show <key> [--cols 40] [--rows R] [--seed 1] [--tier easy|normal|hard|harder] [--bpm B]
// node tools/sectiongen.js check [key ...] [--cols 30,60,120] [--seeds 1,2] [--tiers easy,hard] [--bpm B] [--show]
//                                                         -- does every generated section solve (tools/layoutcheck.js),
//                                                            and does its difficulty follow the tier asked for
//
// SECTION TYPES AS GENERATORS (Evgeni, 2026-11-27: "each section we are adding is not just a collection of possible this
// specific layout strcutures, its a complete possible section of any length, adjustable. with a 'clearer' concept";
// "the template is not building one or two blocks right and left, but lets have a more abstrct concept that might create
// it in various difficulty and length"; "use one of such possible sections, as a template ( not copy this exactly ), and
// create somewhat approriate layout for the specific beat and difficulty needed"; "i need also reverse gravity portals").
// So nothing here starts from his drawing (knowledge/layout_sections.json): each type is its CONCEPT in code -- the idea,
// the motif, and the parameters the motif may change (knowledge/section_types.md, the table) -- built fresh:
//   entry -> body: the motif repeated, its parameters changed each repeat -> exit.
// Knobs, the same for every type:
//   cols, rows   any length; rows = the band height (each type has its own default)
//   seed         another layout of the same concept
//   tier         easy | normal | hard | harder (or 0..1): one number d that moves every parameter of the type toward
//                its hard end (shorter runs, narrower gaps, more hazards, faster motifs)
//   bpm / beatCols  motif lengths snap to half beats (columns per beat at 1x = 311.58 / 30 * 60 / bpm), so each motif --
//                and the press it asks for -- falls on the song's beat grid (loosely: the press inside a motif is not
//                placed on its beat yet)
// GEN[key](opts) -> { map: rows top first in the board's letters, mode }. Letters (tools/layoutsections.js):
//   # block, / \ floor slopes, 7 r ceiling slopes, ^ spike, v hanging spike, o saw, q / s small saws, G gravity upside
//   down (id 11), N gravity back (id 10). The board (tools/designs_tab.js, the board thread) calls these for its length
//   control; tools/layoutcheck.js solves whatever they return.
"use strict";
const LS = require("./layoutsections.js");

function rng(seed) { let s = ((seed >>> 0) * 2654435761) >>> 0 || 1; const f = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  f.int = (a, b) => a + Math.floor(f() * (b - a + 1)); f.pick = a => a[Math.floor(f() * a.length)]; f.chance = p => f() < p; return f; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = { easy: 0, normal: 0.35, hard: 0.7, harder: 1 };
const COLS_PER_SEC = 311.58 / 30;

// the shared context every generator gets: the random, d (0 easy .. 1 harder), mix(easy, hard) -> the value at this tier,
// len(lo, hi) -> a motif length snapped to half beats when a tempo is given, chance(easyP, hardP)
function ctx(o, defRows) {
  const R = rng(o.seed ?? 1), d = typeof o.tier === "number" ? clamp(o.tier, 0, 1) : (TIERS[o.tier] ?? 0.2);
  const beatCols = o.beatCols || (o.bpm ? COLS_PER_SEC * 60 / o.bpm : 0);
  const mix = (a, b) => a + (b - a) * d, imix = (a, b) => Math.round(mix(a, b));
  const len = (lo, hi) => { let n = R.int(Math.min(lo, hi), Math.max(lo, hi)); if (beatCols) { const h = beatCols / 2; n = Math.max(2, Math.round(Math.round(n / h) * h)); } return n; };
  const W = o.cols || 32, H = o.rows || defRows;
  return { R, d, mix, imix, len, chance: (a, b) => R.chance(mix(a, b)), W, H, G: LS.grid(W, H), beatCols };
}
// a gravity pair (G upside down, N back) in sections long enough to show it: G at ~1/3, N at ~2/3
const gravPair = (W, min = 24) => W >= min ? [Math.round(W * 0.3), Math.round(W * 0.7)] : null;
// a tunnel from one floor line e(x) (heights at column edges, steps of 0 or 1 a column), its ceiling the floor lifted
// `gap` rows; `thick` = wall thickness (0 = solid to the band's edge)
function tunnel(G, W, e, gap, top, thick = 0) {
  for (let c = 0; c < W; c++) { const a = e(c), b = e(c + 1), lo = Math.min(a, b), hi = Math.max(a, b);
    if (lo > 0) G.box(c, c, thick ? Math.max(0, lo - thick) : 0, lo - 1); if (b > a) G.put(c, a, "/"); if (b < a) G.put(c, b, "\\");
    G.box(c, c, hi + gap, thick ? Math.min(top, hi + gap + thick - 1) : top); if (b > a) G.put(c, a + gap, "r"); if (b < a) G.put(c, b + gap, "7"); } }
// a line of heights at column edges, built by a step(api, x) that adds runs (flat) and 45-degree legs -> e(x)
function line(W, h0, step) { const e = [h0]; let h = h0;
  const api = { h: () => h, run: n => { for (let k = 0; k < n; k++) e.push(h); }, leg: to => { while (h !== to) { h += Math.sign(to - h); e.push(h); } } };
  while (e.length <= W + 1) { const n = e.length; step(api, n); if (e.length === n) e.push(h); }
  return x => e[Math.min(Math.max(0, x), e.length - 1)]; }

const GEN = {}, CONCEPT = {};

// ENTRANCE (cube). Idea: up a ramp onto the level's blocks, then a first hazard. Motif: a flat run + one hazard (a spike,
// a pit, a step). Varies: run length, which hazard, the floor's height. Harder: shorter runs, wider pits, double spikes.
CONCEPT.entrance = "up a ramp onto blocks, then flat runs each with one hazard (spike, pit, step)";
GEN.entrance = o => { const { R, imix, len, chance, W, H, G } = ctx(o, 7); let h = 3;
  for (let k = 0; k < 3; k++) { G.put(k, k, "/"); G.box(k + 1, k + 1, 0, k); }
  let c = 3;
  while (c < W) { const run = len(imix(8, 5), imix(10, 6)), end = Math.min(W - 1, c + run - 1); G.box(c, end, 0, h - 1);
    if (end - c >= 4 && c > 3) { const kind = R.pick(["spike", "pit", "step", "spike"]), x = c + 2;
      if (kind === "spike") { G.put(x, h, "^"); if (chance(0, 0.6)) G.put(x + 1, h, "^"); }
      else if (kind === "pit") { const pw = imix(2, 3); G.box(x, x + pw - 1, 0, h - 1, "."); G.box(x, x + pw - 1, 0, 0, "^"); }
      else { h = clamp(h + R.pick([-1, 1]), 2, H - 3); G.box(x, end, 0, h - 1); } }
    c = end + 1; }
  return { map: G.rows(), mode: "cube" }; };

// STAIRCASE (cube). Idea: climb, a landing, step down. Motif: a step of one row. Varies: step width, hazards on some
// landings, a saw at a step's edge (hard), climb height. Harder: narrower steps, more hazards, two rows a step sometimes.
CONCEPT.staircase = "climb a step at a time to a landing, then step down; hazards on some landings";
GEN.staircase = o => { const { imix, len, chance, W, H, G } = ctx(o, 9), top = H - 4; let h = 1, dir = 1, c = 0;
  while (c < W) { const w = len(imix(6, 4), imix(6, 5)), end = Math.min(W - 1, c + w - 1); G.box(c, end, 0, h);
    if (w >= 4 && c > 0 && end < W - 1) { if (chance(0.25, 0.6)) G.put(c + 2, h + 1, "^"); else if (chance(0, 0.3)) G.put(end, h + 1, "s"); }
    c = end + 1;
    if (dir > 0 && h >= top) { dir = -1; const e2 = Math.min(W - 1, c + len(3, 5)); G.box(c, e2, 0, h); c = e2 + 1; }
    else if (dir < 0 && h <= 1) dir = 1;
    h = clamp(h + dir, 1, top); }   // one row a step: two rows left a 4 ms window (tight for any tier)
  return { map: G.rows(), mode: "cube" }; };

// OPEN CUBE (cube). Idea: a floor with pits, nothing overhead, platforms floating in the middle. Motif: a floor run + a
// spike pit. Varies: pit width, run length, a platform after the pit at one of two heights, a spike on it.
CONCEPT.opencube = "a floor with spike pits and open sky; platforms float at two heights";
GEN.opencube = o => { const { R, imix, len, chance, W, G } = ctx(o, 8);
  G.box(0, W - 1, 0, 1); let c = len(5, 7);
  while (c < W - 6) { const pw = imix(2, 4);
    G.box(c, c + pw - 1, 1, 1, "."); G.box(c, c + pw - 1, 0, 0, "^");
    const run = len(imix(9, 5), imix(10, 7));
    if (chance(0.4, 0.6) && c + pw + 5 < W) { const py = R.pick([4, 5]), px = c + pw + R.int(1, 2), pl = R.int(3, 4);
      G.box(px, px + pl - 1, py, py); if (chance(0.2, 0.6)) G.put(px + 1, py + 1, "^"); }
    else if (chance(0.3, 0.7)) G.put(c + pw + 3, 2, "^");
    c += pw + run; }
  return { map: G.rows(), mode: "cube" }; };

// CLOSER CUBE (cube). Idea: the ceiling comes down close and hangs spikes, out of step with the floor's. Motif: a floor
// hazard + a hanging spike a few columns on. Varies: spacing, pit or spike. A gravity pair (his note): G puts the player on
// the ceiling, its hanging spikes now the ones to jump, N back.
CONCEPT.closecube = "a low ceiling with hanging spikes out of step with floor hazards; a gravity pair flips play onto the ceiling";
GEN.closecube = o => { const { R, imix, len, chance, W, H, G } = ctx(o, 8), gp = gravPair(W), near = c => gp && (Math.abs(c - gp[0]) < 3 || Math.abs(c - gp[1]) < 3);
  G.box(0, W - 1, 0, 0); G.box(0, W - 1, 5, H - 1);
  for (let c = len(5, 7); c < W - 3; c += len(imix(9, 5), imix(10, 7))) { if (near(c)) continue;
    const flipped = gp && c > gp[0] && c < gp[1], v = c + R.int(3, 4);
    // upside down the obstacles mirror (Evgeni: floor pits -> ceiling pits): the pit goes in the ceiling, the single
    // spike stands on the floor
    if (!flipped) { if (chance(0.5, 0.7)) G.box(c, c + 1, 0, 0, "^"); else G.put(c, 1, "^"); if (v < W - 2 && !near(v)) G.put(v, 4, "v"); }
    else { if (chance(0.5, 0.7)) { G.box(c, c + 1, 5, 5, "."); G.box(c, c + 1, 6, 6, "v"); } else G.put(c, 4, "v"); if (v < W - 2 && !near(v)) G.put(v, 1, "^"); } }
  if (gp) { G.put(gp[0], 2, "G"); G.put(gp[1], 3, "N"); }
  return { map: G.rows(), mode: "cube" }; };

// HANGING (cube). Idea: masses hang from the top over a spiked floor; jump between and under them. Motif: one hanging
// mass + a pit. Varies: mass width, how low it hangs, its hanging spikes, the gap to the next.
CONCEPT.hanging = "masses hang from the top over a floor with spike pits; their width and depth change";
GEN.hanging = o => { const { R, imix, len, chance, W, H, G } = ctx(o, 12); let c = 2;
  G.box(0, W - 1, 0, 1);
  while (c < W - 4) { const w = R.int(3, 7), low = R.int(imix(8, 6), imix(9, 7)), e = Math.min(W - 2, c + w - 1);
    G.box(c, e, low, H - 1); if (w >= 5) G.box(c + 1, e - 1, low - 1, low - 1);
    if (chance(0.5, 0.9)) G.put(c, low - 1, "v"); if (e - c >= 3 && chance(0.4, 0.9)) G.put(e, low - 1, "v");
    const pit = c + w + 1; if (pit < W - 3) G.box(pit, pit + imix(1, 3) - 1, 2, 2, "^");   // on the floor's top: a jump each
    c += w + len(imix(5, 3), imix(6, 4)); }
  return { map: G.rows(), mode: "cube" }; };

// FLYING (ship). Idea: a floor and a ceiling that rise and fall together. Motif: a hill (leg up, flat, leg down). Varies:
// hill height and flat length, spikes in valleys and hanging at the crests, a saw in the open gap. Harder: a narrower gap,
// shorter flats, more hazards. A gravity pair: the held button now flies down.
CONCEPT.fly = "floor and ceiling rise and fall together in hills; spikes in valleys, saws in the gap; a gravity pair";
GEN.fly = o => { const { R, imix, len, chance, W, H, G } = ctx(o, 12), gap = imix(8, 5), hiMax = H - gap - 2;
  const e = line(W, 1, L => { const to = L.h() <= 2 ? R.int(Math.min(hiMax, 3), hiMax) : R.int(1, Math.max(1, L.h() - 2)); L.run(len(imix(3, 1), imix(4, 2))); L.leg(to); });
  tunnel(G, W, e, gap, H - 1);
  const gp = gravPair(W, 30);
  for (let c = 3; c < W - 2; c++) { const a = e(c), b = e(c + 1), p = e(c - 1); if (a !== b || (gp && (Math.abs(c - gp[0]) < 3 || Math.abs(c - gp[1]) < 3))) continue;
    if (p > a && chance(0.5, 0.9)) G.put(c, a, "^");
    else if (p < a && chance(0.3, 0.8)) G.put(c, a + gap - 1, "v");
    else if (gap >= 6 && chance(0.03, 0.1)) G.put(c, a + Math.floor(gap / 2), "o"); }
  if (gp) { G.put(gp[0], e(gp[0]) + Math.floor(gap / 2), "G"); G.put(gp[1], e(gp[1]) + Math.floor(gap / 2), "N"); }
  return { map: G.rows(), mode: "ship" }; };

// WAVE. Idea: a 45-degree zigzag tunnel, its ceiling the floor lifted. Motif: one leg up + one down. Varies: leg length;
// slow legs, a quick zigzag in the middle (more clicks a second), slow again. Harder: a narrower tunnel, a longer quick
// part. A gravity pair in the quick part.
CONCEPT.wave = "a 45-degree zigzag tunnel; slow legs, a quick middle, slow again; a gravity pair";
GEN.wave = o => { const { R, mix, imix, W, H, G } = ctx(o, 10), gap = imix(5, 3), q0 = mix(0.35, 0.2), q1 = mix(0.65, 0.8);
  const e = line(W, 1, (L, x) => { const mid = x > W * q0 && x < W * q1, amp = mid ? R.int(1, 2) : R.int(3, Math.max(3, Math.min(5, H - gap - 2)));
    L.leg(L.h() > 1 ? 1 : Math.min(H - gap - 1, 1 + amp)); });
  tunnel(G, W, e, gap, H - 1);
  const gp = gravPair(W, 30);
  if (gp) { G.put(gp[0], e(gp[0]) + Math.floor(gap / 2), "G"); G.put(gp[1], e(gp[1]) + Math.floor(gap / 2), "N"); }
  return { map: G.rows(), mode: "wave" }; };

// FLAPPY (ufo). Idea: pipes from the floor and the ceiling with a gap at changing heights. Motif: one pipe pair. Varies:
// the gap's height (walks up and down), the spacing, spike tips. Harder: a narrower gap, closer pipes, bigger jumps.
CONCEPT.flappy = "pipe pairs from floor and ceiling; the gap's height walks up and down";
GEN.flappy = o => { const { R, imix, len, chance, W, H, G } = ctx(o, 12), gh = imix(5, 3); let g = R.int(2, 5);
  G.box(0, W - 1, 0, 0);
  for (let c = 3; c < W - 2; c += len(imix(7, 4), imix(8, 5))) {
    G.box(c, c + 1, 0, g - 1); G.box(c, c + 1, g + gh, H - 1); G.put(c, g - 1, "^"); G.put(c + 1, g + gh, "v");
    if (c + 3 < W - 2 && chance(0.3, 0.6)) G.put(c + 3, 1, "^");
    const jump = imix(1, 3); g = clamp(g + R.pick([-jump, -1, 1, jump]), 2, H - gh - 2); }
  return { map: G.rows(), mode: "ufo" }; };

// BALL. Idea: floors and ceilings at several heights; the ball flips from one to the next. Motif: a floor run, then a
// ceiling run, a spike pit between. Varies: run length, height step, the pit's width. Harder: shorter runs, wider pits.
CONCEPT.ball = "floor and ceiling runs in turn at stepping heights over a spike pit; flip from one to the next";
GEN.ball = o => { const { R, imix, len, W, H, G } = ctx(o, 10); let c = 0, floor = true, f = 2, k = H - 2;
  G.box(0, W - 1, 0, 0, "^");
  while (c < W) { const run = Math.min(W - c, len(imix(7, 4), imix(8, 5))), e = c + run - 1;
    if (floor) { G.box(c, e, 0, f - 1); f = clamp(f + R.pick([-1, 1, 2]), 1, 3); }
    else { G.box(c, e, k, H - 1); k = clamp(k + R.pick([-1, 1, -2]), H - 3, H - 1); }
    floor = !floor; c = e + 1 + R.int(imix(1, 2), imix(1, 3)); }
  return { map: G.rows(), mode: "ball" }; };

// STAIR PATH (cube, his "strairpath", my-mwz1637w). Idea: a lattice of single blocks; many ways in theory, every wrong one
// closed by a hazard. Motif: a column of blocks 3 rows apart; the next column's way block 1 up, 1 down or 2 up. His notes:
// a reverse and a normal portal (G .. N: the middle is played on the blocks' undersides), a bit taller, hazards other than
// spikes in the middle (small saws there).
CONCEPT["my-mwz1637w"] = "a lattice of single blocks 3 apart; one way block per column, the rest closed by hazards; a gravity pair plays the middle on the undersides";
GEN["my-mwz1637w"] = o => { const { R, chance, W, H, G } = ctx(o, 13), gp = o.flip ? gravPair(W, 27) : null; let h = 1, up = false, phase = 0;   // {flip: true}: the gravity pair (dies as placed today, so off by default)
  G.box(0, W - 1, 0, 0, "^"); G.box(0, 2, 0, 1);
  for (let c = 4, k = 0; c < W - 3; c += 3, k++) {
    if (gp && phase === 0 && c >= gp[0]) { G.put(c - 2, h + 1, "G"); up = true; phase = 1; h = clamp(h + 3, 3, H - 2); }
    else if (gp && phase === 1 && c >= gp[1]) { G.put(c - 2, h - 1, "N"); up = false; phase = 2; h = clamp(h - 3, 1, H - 4); }
    else h = up ? clamp(h + R.pick([-1, -1, 1, -2]), 3, H - 2) : clamp(h + (k === 0 ? 1 : R.pick([1, 1, -1, 2])), 1, H - 4);   // open: the 2-up hop leaves 8-29 ms windows
    const mid = gp ? c > gp[0] - 3 && c < gp[1] + 3 : c > W / 3 && c < 2 * W / 3;
    for (let r = (h % 3) || 3; r < H - 1; r += 3) { G.put(c, r, "#"); if (r === h) continue;
      const face = up ? r - 1 : r + 1; if (face <= 0 || face >= H) continue;
      G.put(c, face, mid ? (chance(0.6, 0.9) ? "s" : "q") : (up ? "v" : "^")); } }
  G.box(W - 3, W - 1, 0, up ? 1 : Math.max(1, h));
  return { map: G.rows(), mode: "cube" }; };

// SWING (his, my-mwz1890c). Idea: round movement, a big up-and-down corridor whose sides are curves of saws, not blocks.
// Motif: one wave of the path. Varies: amplitude, period, the corridor's width. Harder: tighter waves, a narrower corridor.
CONCEPT["my-mwz1890c"] = "a sine-shaped corridor drawn by two chains of saws; amplitude, period and width change wave to wave";
GEN["my-mwz1890c"] = o => { const { R, imix, len, W, H, G } = ctx(o, 13), mid = (H - 1) / 2; let c = 0;
  while (c < W) { const P = len(imix(20, 14), imix(22, 17)), A = R.int(2, Math.max(2, Math.floor(H / 2) - 3)), gap = R.int(imix(7, 5), imix(7, 6));
    for (let x = 0; x < P && c + x < W; x++) { const y = mid + A * Math.sin(2 * Math.PI * x / P), lo = Math.round(y - gap / 2), hi = Math.round(y + gap / 2), ch = (c + x) % 2 ? "q" : "o";
      if (lo >= 0) G.put(c + x, lo, ch); if (hi < H) G.put(c + x, hi, ch); }
    c += P; }
  return { map: G.rows(), mode: "swing" }; };

// FLYING ON THE GROUNDS (ship, his my-mwz1s7po). Idea: a narrow corridor between two thin bars: "you need to either fully
// hold or release on the obsicles, and the corridor may change height". Motif: a flat run with obstacle runs on the floor
// (hold: ride the ceiling) or the ceiling (release: ride the floor), then a 45-degree climb or drop of both bars. Varies:
// run length, which side, the height step. Closed above and below (bars), so the ship can't go round it.
CONCEPT["my-mwz1s7po"] = "a narrow corridor of two thin bars; obstacle runs on the floor (hold) or the ceiling (release); the bars climb and drop together";
GEN["my-mwz1s7po"] = o => { const { R, imix, len, chance, W, H, G } = ctx(o, 14), gap = imix(5, 3);
  const e = line(W, 2, L => { L.run(len(imix(10, 6), imix(12, 8))); L.leg(clamp(L.h() + R.pick([-3, -2, 2, 3]), 2, H - gap - 3)); });
  tunnel(G, W, e, gap, H - 1, 2);
  let side = R.chance(0.5) ? 1 : -1;
  for (let c = 4; c < W - 2; c++) { const b = e(c); if (!(e(c - 1) === b && e(c + 1) === b && e(c + 2) === b)) continue;
    if (chance(0.3, 0.55)) { const n = R.int(1, imix(2, 4)); let k = 0;
      for (; k < n && e(c + k + 1) === b && c + k < W - 2; k++) G.put(c + k, side > 0 ? b : b + gap - 1, side > 0 ? "^" : "v");
      c += k + 1; if (R.chance(0.4)) side = -side; } }
  return { map: G.rows(), mode: "ship" }; };

const KEYS = Object.keys(GEN);
function make(key, opts = {}) { const g = GEN[key]; if (!g) throw new Error("no generator for " + key + " (have " + KEYS.join(", ") + ")");
  const o = {}; for (const k of ["cols", "rows", "seed", "bpm", "beatCols"]) if (opts[k] != null) o[k] = +opts[k];
  if (opts.tier != null) o.tier = isNaN(+opts.tier) ? opts.tier : +opts.tier;
  const r = g(o), z = (LS.SECTIONS || []).find(s => s.key === key);
  return Object.assign({ key, name: (z && z.name) || key, concept: CONCEPT[key], opts: o }, r); }

module.exports = { GEN, CONCEPT, KEYS, TIERS, make, rng, tunnel };

if (require.main === module) {
  const a = process.argv.slice(2), arg = k => { const i = a.indexOf("--" + k); return i >= 0 ? a[i + 1] : null; }, cmd = a[0];
  const pos = []; for (let i = 1; i < a.length; i++) { if (a[i].startsWith("--")) { if (a[i] !== "--show") i++; continue; } pos.push(a[i]); }
  if (cmd === "show") { const z = make(pos[0], { cols: arg("cols"), rows: arg("rows"), seed: arg("seed"), tier: arg("tier"), bpm: arg("bpm") });
    console.log(z.key + " (" + z.mode + ", " + z.map[0].length + " x " + z.map.length + "): " + z.concept + "\n" + z.map.join("\n")); }
  else if (cmd === "check") {
    require("./heavy.js").claim();
    const LC = require("./layoutcheck.js"), cols = (arg("cols") || "30,60,120").split(",").map(Number), seeds = (arg("seeds") || "1,2").split(",").map(Number), tiers = (arg("tiers") || "normal").split(",");
    let ok = 0, n = 0;
    for (const key of pos.length ? pos : KEYS) for (const tier of tiers) for (const W of cols) for (const seed of seeds) {
      const z = make(key, { cols: W, seed, tier, bpm: arg("bpm") }); n++;
      const c = LC.check(z); if (c.ok) ok++;
      console.log(`${key.padEnd(13)} ${tier.padEnd(6)} ${String(W).padStart(4)} cols seed ${seed}: ` + (c.ok ? `solves, ${c.presses} presses, ${c.label} (~${c.attempts})${c.tight[0] ? ", tightest " + c.tight[0].ms + " ms" : ""}` : `NO: dies at col ${c.dieCol} row ${c.dieRow}: ${c.why}`) + `  [${(c.ms / 1000).toFixed(0)} s]`);
      if (!c.ok && a.includes("--show")) console.log(z.map.map(l => "   " + l).join("\n"));
    }
    console.log(`${ok} of ${n} solve`);
  } else console.log("usage: node tools/sectiongen.js show <key> [--cols N] [--tier easy|normal|hard|harder] [--bpm B] | check [key ...] [--cols 30,60,120] [--seeds 1,2] [--tiers easy,hard]\nkeys: " + KEYS.join(", "));
}
