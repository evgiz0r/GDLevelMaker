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
// extreme (Evgeni 2026-11-27: "lets increase the cps of harder ... or add 1 more level"; and "the wave seems a bit too hard
// for harder, too tight"): past harder only the pace grows (shorter runs, more presses a second); room -- corridor gaps,
// platform sizes -- stops at harder's, through room() below
const TIERS = { easy: 0, normal: 0.35, hard: 0.7, harder: 1, extreme: 1.4 };
const COLS_PER_SEC = 311.58 / 30;

// the shared context every generator gets: the random, d (0 easy .. 1 harder), mix(easy, hard) -> the value at this tier,
// len(lo, hi) -> a motif length snapped to half beats when a tempo is given, chance(easyP, hardP)
function ctx(o, defRows) {
  const R = rng(o.seed ?? 1), d = typeof o.tier === "number" ? clamp(o.tier, 0, 1.4) : (TIERS[o.tier] ?? 0.2);
  const beatCols = o.beatCols || (o.bpm ? COLS_PER_SEC * 60 / o.bpm : 0);
  const mix = (a, b) => a + (b - a) * d, imix = (a, b) => Math.round(mix(a, b)), room = (a, b) => Math.round(a + (b - a) * Math.min(1, d));
  const len = (lo, hi) => { let n = R.int(Math.min(lo, hi), Math.max(lo, hi)); if (beatCols) { const h = beatCols / 2; n = Math.max(2, Math.round(Math.round(n / h) * h)); } return n; };
  const W = o.cols || 32, H = o.rows || defRows;
  return { R, d, mix, imix, room, len, chance: (a, b) => R.chance(Math.min(0.95, mix(a, b))), W, H, G: LS.grid(W, H), beatCols };
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

// the join nearest c0 where one movement of the path ends and the next starts (the line changes direction, or a slope
// meets a flat); with `minLeg`, only joins between two movements at least that long ("exactly at the connecting point of
// longer sweeps", Evgeni 2026-11-27 on fly portals). A portal goes there, at the corridor's middle height.
function joinNear(e, W, c0, minLeg = 1) {
  const dir = c => Math.sign(e(c + 1) - e(c)), legLen = (c, step) => { let n = 0; const d = dir(step > 0 ? c : c - 1);
    for (let x = c; x > 0 && x < W - 1 && dir(step > 0 ? x : x - 1) === d && n < 40; x += step) n++; return n; };
  const isJoin = c => c > 2 && c < W - 3 && dir(c - 1) !== dir(c) && legLen(c, -1) >= minLeg && legLen(c, 1) >= minLeg;
  for (let d = 0; d < W; d++) for (const c of [c0 + d, c0 - d]) if (isJoin(c)) return c;
  return minLeg > 1 ? joinNear(e, W, c0, 1) : c0; }

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
GEN.hanging = o => { const { R, imix, room, len, chance, W, H, G } = ctx(o, 12); let c = 2;
  G.box(0, W - 1, 0, 1);
  while (c < W - 4) { const w = R.int(3, 7), low = R.int(imix(8, 6), imix(9, 7)), e = Math.min(W - 2, c + w - 1);
    G.box(c, e, low, H - 1); if (w >= 5) G.box(c + 1, e - 1, low - 1, low - 1);
    if (chance(0.5, 0.9)) G.put(c, low - 1, "v"); if (e - c >= 3 && chance(0.4, 0.9)) G.put(e, low - 1, "v");
    // never three spikes in a row (Evgeni 2026-11-27 on a generated one: "i dont like triple spikes ... pretty bland"):
    // one or two spikes on the floor's top, or an open pit with a saw in it
    const pit = c + w + 1, n = R.int(1, room(1, 2));
    if (pit < W - 3) { if (R.chance(0.4)) { for (let x = pit; x < pit + n + 1; x++) { G.put(x, 0, "."); G.put(x, 1, "."); } G.put(pit, 0, "o"); }
      else G.box(pit, pit + n - 1, 2, 2, "^"); }
    c += w + len(room(5, 3), room(6, 4)); }
  return { map: G.rows(), mode: "cube" }; };

// FLYING (ship). Idea: a floor and a ceiling that rise and fall together. Motif: a hill (leg up, flat, leg down). Varies:
// hill height and flat length, spikes in valleys and hanging at the crests, a saw in the open gap. Harder: a narrower gap,
// shorter flats, more hazards. A gravity pair: the held button now flies down.
CONCEPT.fly = "floor and ceiling rise and fall together in hills; spikes in valleys, saws in the gap; a gravity pair";
GEN.fly = o => { const { R, imix, room, len, chance, W, H, G } = ctx(o, 12), gap = room(8, 5), hiMax = H - gap - 2;
  const e = line(W, 1, L => { const to = L.h() <= 2 ? R.int(Math.min(hiMax, 3), hiMax) : R.int(1, Math.max(1, L.h() - 2)); L.run(len(imix(3, 1), imix(4, 2))); L.leg(to); });
  tunnel(G, W, e, gap, H - 1);
  const gp = gravPair(W, 30);
  for (let c = 3; c < W - 2; c++) { const a = e(c), b = e(c + 1), p = e(c - 1); if (a !== b || (gp && (Math.abs(c - gp[0]) < 3 || Math.abs(c - gp[1]) < 3))) continue;
    if (p > a && chance(0.5, 0.9)) G.put(c, a, "^");
    else if (p < a && chance(0.3, 0.8)) G.put(c, a + gap - 1, "v");
    else if (gap >= 6 && chance(0.03, 0.1)) G.put(c, a + Math.floor(gap / 2), "o"); }
  if (gp) { const a = joinNear(e, W, gp[0], 3); let b = joinNear(e, W, gp[1], 3); if (b <= a + 4) b = joinNear(e, W, a + 10, 3);
    for (const [c, t] of [[a, "G"], [b, "N"]]) { for (let r = e(c); r < e(c) + gap; r++) if ("^vo".includes(G.rows()[H - 1 - r][c])) G.put(c, r, ".");
      G.put(c, e(c) + Math.floor(gap / 2), t); } }
  return { map: G.rows(), mode: "ship" }; };

// WAVE. Idea: a 45-degree zigzag tunnel, its ceiling the floor lifted. Motif: one leg up + one down. Varies: leg length;
// slow legs, a quick zigzag in the middle (more clicks a second), slow again. Harder: a narrower tunnel, a longer quick
// part. A gravity pair in the quick part.
CONCEPT.wave = "a 45-degree zigzag tunnel; slow legs, a quick middle, slow again; a gravity pair";
GEN.wave = o => { const { R, mix, imix, room, W, H, G } = ctx(o, 13), gap = room(6, 5), q0 = mix(0.35, 0.2), q1 = mix(0.65, 0.8);
  // more variety on one screen, legs of every size, short flats between some, and one ground slide (Evgeni 2026-11-27: "wave
  // corridors should have a bit more veriaty on the screen, again a bit more split. and we can add 1 ground slide (where
  // the corridor passes through the ground/floor)"): the floor drops to the ground and the wave slides along it a while
  const top = H - gap - 1, slideAt = W >= 30 ? R.int(Math.round(W * 0.3), Math.round(W * 0.6)) : -1; let slid = false, k = 0, dir = -1;
  const e = line(W, 1, (L, x) => { const mid = x > W * q0 && x < W * q1;
    if (!slid && slideAt >= 0 && x >= slideAt) { slid = true; L.leg(0); L.run(R.int(4, 7)); return; }
    if (k++ % 2 === 0 && R.chance(0.25)) { L.run(R.int(1, 3)); return; }
    const amp = mid ? R.pick([1, 1, 2, 2, 3]) : R.pick([1, 2, 3, 3, 4, 5]);
    dir = -dir; let to = clamp(L.h() + dir * amp, 1, top); if (to === L.h()) { dir = -dir; to = clamp(L.h() + dir * amp, 1, top); }
    L.leg(to); });
  tunnel(G, W, e, gap, H - 1);
  // the map is taller than a wave's 10-block band: a hidden wave portal (board letter A; lib/physics.js re-centres the band
  // on a same-mode portal at a new height) moves the band with the corridor whenever its middle is 2 rows off the band's
  let bc = 5;
  for (let c = 2; c < W - 2; c++) { const r = Math.round(e(c) + gap / 2); if (Math.abs(r - bc) < 2 || G.rows()[H - 1 - r][c] !== ".") continue;
    G.put(c, r, "A"); bc = Math.max(0, Math.floor((r * 30 + 15 - 150) / 30)) + 5; }
  const gp = gravPair(W, 30);
  // portals on a TURN (the join of two inputs), never mid-leg (Evgeni 2026-11-27 on a generated wave: "portals in waves
  // should usually be on connecting points of clicks or holds, putting them in the middle of a corridor is big difficulty
  // spike"): the nearest column where the line changes direction, at the corridor's middle height there
  if (gp) { const a = joinNear(e, W, gp[0]), b = joinNear(e, W, gp[1]); G.put(a, e(a) + Math.floor(gap / 2), "G"); if (b !== a) G.put(b, e(b) + Math.floor(gap / 2), "N"); }
  return { map: G.rows(), mode: "wave" }; };

// FLAPPY (ufo). Idea: pipes from the floor and the ceiling with a gap at changing heights. Motif: one pipe pair. Varies:
// the gap's height (walks up and down), the spacing, spike tips. Harder: a narrower gap, closer pipes, bigger jumps.
CONCEPT.flappy = "pipe pairs from floor and ceiling; the gap's height walks up and down";
GEN.flappy = o => { const { R, imix, room, len, chance, W, H, G } = ctx(o, 12), gh = room(5, 3); let g = R.int(2, 5);
  G.box(0, W - 1, 0, 0);
  for (let c = 3; c < W - 2; c += len(room(7, 4), room(8, 5))) {
    G.box(c, c + 1, 0, g - 1); G.box(c, c + 1, g + gh, H - 1); G.put(c, g - 1, "^"); G.put(c + 1, g + gh, "v");
    if (c + 3 < W - 2 && chance(0.3, 0.6)) G.put(c + 3, 1, "^");
    const jump = imix(1, 3); g = clamp(g + R.pick([-jump, -1, 1, jump]), 2, H - gh - 2); }
  return { map: G.rows(), mode: "ufo" }; };

// BALL (v2, rebuilt 2026-11-27 after Evgeni: "the generator is bad, i compare the cps, the variaty, height changes, blocks
// in the middle"; measured against his drawing by tools/sectionstats.js). How his ball corridor works: the ball rolls on a
// SURFACE, flips, flies across to the next surface on the other side, and so on; every surface is either a mass (a floor
// mass up from the ground, a ceiling mass down from the top) or a PIECE FLOATING IN THE MIDDLE, landed on from above or from
// below; spike pits under everything, hanging spikes and spikes at surface ends. Built by construction, not by the solver:
// each surface starts where a flip in the last `win` columns of the one before lands (the ball's travel time across the
// height difference), so the flip window is the overlap; early flips fly into open space, late ones roll off into a pit.
// Varies: surface width, kind (mass / middle piece), height step (big and small), a hazard at a surface's end.
CONCEPT.ball = "flip from surface to surface on the other side: floor and ceiling masses and pieces floating in the middle, at big and small height steps, over saw pits";
const BALL_G = 1670;   // ball gravity, units/s^2 (Clutterfunk recording: 0.464 units/frame^2 at 60 fps)
const ballTravel = rows => Math.sqrt(2 * Math.max(0.5, rows) * 30 / BALL_G) * COLS_PER_SEC;   // columns across `rows`
GEN.ball = o => { const { R, mix, imix, chance, W, H, G } = ctx(o, 10), BT = Math.min(H, 8);   // the ball band: rows 0..7 (its ceiling at 240 units)
  const win = mix(2.6, 1.4);   // flip window, columns
  const S = [{ side: 1, kind: "mass", y: 2, c0: 0, c1: R.int(5, 7) }];   // y: the surface's row (floor side: the row the ball rolls on; ceiling side: the row it hangs in)
  while (S[S.length - 1].c1 < W) {
    // moves of 2-4 rows, under half the band on average (Evgeni 2026-11-27: "in the jumping modes, that the average length
    // of movement is below the half of the full length, just to have less updown from ground to floor"), and the play
    // height wandering over the whole band both ways ("the height of the gameplay is too similar ... more balanced across
    // the y axis, in both directions"): pieces in the middle, a floor or ceiling mass only at the band's edges
    const p = S[S.length - 1], side = -p.side, step = R.int(2, o.maxStep ?? 4);
    // a floor-side surface sits low enough to flip up from (row <= BT - 4), a ceiling-side one high enough to drop from
    const y = side < 0 ? clamp(p.y + step, Math.max(3, p.y + 2), BT - 2) : clamp(p.y - step, 1, Math.min(BT - 4, p.y - 2));
    const kind = side < 0 ? (y >= BT - 2 ? "mass" : "mid") : (y <= 1 ? "mass" : "mid");
    const d = Math.abs(p.y - y) - 1, flip = p.c1 - (p.end ? 1 : 0), c0 = Math.max(p.c0 + 2, Math.round(flip + ballTravel(d) - win)), w = R.pick([R.int(2, 3), R.int(imix(4, 3), imix(6, 5)), R.int(imix(4, 3), imix(6, 5)), R.int(imix(9, 7), imix(12, 9))]);   // short, medium, long: his rests vary a lot (CV ~1)
    S.push({ side, kind, y, c0, c1: c0 + w, thick: kind === "mid" ? (R.chance(0.7) ? 1 : 2) : 0, end: chance(0.25, 0.5) });
  }
  // draw: ground spikes and a row of hanging spikes along the top (the ball band's ceiling holds the ball otherwise, so
  // an early flip must die there, not ride the band edge), then each surface
  // no walls of spikes and no floating spikes (Evgeni 2026-11-27 on 🎲 ball: "just blocking like that with a wall of spike
  // is rough, lets place proper hazards, spikes not on the ground is bad"): saws along the pits and under the band's
  // ceiling, a saw every 2 columns (their round edge covers the gap), short spike groups only on blocks
  // and then (Evgeni, on 🎲 ball seed 52432: "still the blockers of spikes not on correct height, either spikes are on the
  // ground (or top), or there are hazards (on both sides)"): spikes stand on the ground, and hang from a ceiling bar laid at
  // the band's top (row BT), in groups of 2-3 with a column between (a ball that lands in the gap rolls into the next
  // group), a saw now and then in place of a group
  if (H > BT) G.box(0, W - 1, BT, Math.min(H - 1, BT));
  for (const [row, t] of [[0, "^"], [BT - 1, "v"]]) for (let c = 0; c < W;) {
    if (R.chance(0.2)) { G.put(c, row, "o"); c += 2; continue; }
    const n = R.int(2, 3); for (let k = 0; k < n && c + k < W; k++) G.put(c + k, row, t); c += n + 1; }
  for (const s of S) { const c1 = Math.min(W - 1, s.c1);
    if (s.side > 0) { if (s.kind === "mass") G.box(s.c0, c1, 0, s.y - 1); else G.box(s.c0, c1, s.y - s.thick, s.y - 1);
      if (s.end && s.c1 < W) G.put(c1, s.y, "^"); }
    else { if (s.kind === "mass") G.box(s.c0, c1, s.y + 1, H - 1); else { G.box(s.c0, c1, s.y + 1, s.y + s.thick); if (chance(0.3, 0.6)) G.put(s.c0 + 1, s.y + s.thick + 1, "^"); }
      if (s.end && s.c1 < W) G.put(c1, s.y, "v"); } }
  return { map: G.rows(), mode: "ball" }; };

// STAIR PATH (cube, his "strairpath", my-mwz1637w). Idea: a lattice of single blocks a column every 3; many ways in theory,
// every wrong one closed by a hazard. Motif: the next column's way block a hop up. His drawing and notes: a reverse and a
// normal portal ("still no reverse portals on generation"), a bit taller, saws instead of spikes in the middle, no long
// runs at one height ("sometimes we have too many in a row of the same height"). So the way CLIMBS (a hop of +1, +2 at
// the hard end) to near the top, a G there flips the player onto the blocks' undersides, the way climbs again (mirrored:
// towards the ground), an N near the bottom flips back; repeat. A cube can't step DOWN a lattice (a jump hits the block
// above, a walk-off falls short of the next column), which is why the flat runs came: the flips are the way down.
// Harder: lower turn points (more flips per length), more +2 hops, saws everywhere.
CONCEPT["my-mwz1637w"] = "a lattice of single blocks 3 apart; the way climbs, a gravity portal flips play onto the undersides and it climbs back down, then flips back; wrong blocks carry hazards";
// The turn (Evgeni: "still no reverse portals on generation" -- the pair is part of the stair path): the top step is a
// 2-wide block, the gravity portal stands right after it at the player's height, and the next step hangs 3 rows up so the
// flipped cube meets its underside a block later; the way back down mirrors it with the normal portal.
GEN["my-mwz1637w"] = o => { const { R, imix, chance, W, H, G } = ctx(o, 13), DU = o.du ?? 5, top = H - 2 - DU, low = DU + 1;
  G.box(0, 2, 0, 1); for (let c = 3; c < W - 3; c += 2) G.put(c, 0, "o");   // saws in the pit, not a spike wall
  let h = 1, up = false, k = 0, run = 0, turn = false, turnHi = R.int(Math.max(2, top - imix(0, 2)), top), turnLo = R.int(low, low + imix(0, 2));
  const lastC = 4 + 3 * Math.floor((W - 7 - 4) / 3);
  for (let c = 4; c <= lastC; c += 3, k++) {
    if (k > 0) {
      if (turn) { turn = false; h = up ? Math.min(H - 2, h + DU) : Math.max(1, h - DU); }
      else { // a hop toward the turn: +1 at most 3 times running (measured: a 4th +1 from a 1-wide block lands past the
        // next one), +2 or a step back -1 between, never a flat run
        let hop = run >= 3 || chance(0.15, 0.4) ? (R.chance(0.6) ? 2 : -1) : 1;
        if (hop === -1 && (up ? h + 1 > H - 2 : h - 1 < 1)) hop = 2;
        run = hop === 1 ? run + 1 : 0;
        h = up ? Math.max(turnLo, h - hop) : Math.min(turnHi, h + hop); } }
    const mid = c > W / 4 && c < 3 * W / 4;
    // the lattice; the block right over the way block is left out (head room: a jump from a 1-wide block hits it), the
    // others carry a hazard on the face the player would land on
    for (let r = (h % 3) || 3; r < H - 1; r += 3) { if (r === (up ? h - 3 : h + 3)) continue; G.put(c, r, "#"); if (r === h || o.clean) continue;
      const face = up ? r - 1 : r + 1; if (face <= 0 || face >= H - 1) continue;
      G.put(c, face, mid || chance(0.3, 0.7) ? (R.chance(0.6) ? "s" : "q") : (up ? "v" : "^")); }
    // the last chance to turn back to normal gravity is forced, so the run ends on its feet
    if ((up && (h <= turnLo || c === lastC - 3)) || (!up && h >= turnHi && c <= lastC - 6)) {
      if (o.wide) G.put(c + 1, h, "#"); G.put(c + (o.gOff ?? 1), up ? h - 1 : h + 1, up ? "N" : "G"); turn = true; up = !up; run = o.turnRun ?? 2;
      if (up) turnLo = R.int(low, Math.min(h + DU - 1, low + imix(0, 2))); else turnHi = R.int(Math.max(h - DU + 1, top - imix(0, 2)), top); } }
  G.box(W - 3, W - 1, 0, 1);
  return { map: G.rows(), mode: "cube" }; };

// SWING (his, my-mwz1890c). Idea: round movement, a big up-and-down corridor whose sides are curves of saws, not blocks.
// Motif: one wave of the path. Varies: amplitude, period, the corridor's width. Harder: tighter waves, a narrower corridor.
CONCEPT["my-mwz1890c"] = "a sine-shaped corridor drawn by two chains of saws; amplitude, period and width change wave to wave";
// Evgeni 2026-11-27 on a generated one: "swing should swing more, like double the height possible", and on his drawing
// "exntend the pattern a bit longer", then "swing still not high enough". GD bounds a swing to a 10-block band (lib/physics.js
// BAND: 300 units, set by the portal), so the height comes from filling the band: the corridor's middle swings from one band
// edge to the other (the edge is the far wall at a peak), saw chains on the open side only, longer waves.
GEN["my-mwz1890c"] = o => { const { R, imix, room, len, W, H: HH, G } = ctx(Object.assign({ cols: 48 }, o), 20);
  if (HH >= 16 && W >= 40) return swingTall(o, { R, imix, room, len, W, H: HH, G });
  const H = Math.min(10, HH); let c = 0;
  while (c < W) { const gap = R.int(room(5, 4), room(6, 5)), A = (H - gap) / 2 * (o.amp ?? R.pick([0.8, 1, 1])), mid = H / 2,
      P = len(imix(26, 20), imix(34, 26));
    for (let x = 0; x < P && c + x < W; x++) { const y = mid + A * Math.sin(2 * Math.PI * x / P), lo = Math.round(y - gap / 2) - 1, hi = Math.round(y + gap / 2), ch = (c + x) % 2 ? "q" : "o";
      if (lo >= 0) G.put(c + x, lo, ch); if (hi < H) G.put(c + x, hi, ch); }
    c += P; }
  return { map: G.rows(), mode: "swing" }; };
// The tall swing (Evgeni: "even taller swing structures, swing can go even higher than screen", then "swing/ship/ufo
// portals in the middle of the gameplay recenter the screen. people put invisible ones to move further in the screens"):
// the corridor rides a slow swell from the bottom of the map to its top and back, the quick swing waves on top of it, and
// an R pair (ship + swing portal, invisible) sets the 10-block band again around the player each time the swell has moved
// 3 rows from the band's middle. In the sim (lib/physics.js) a climb over 20 rows through three pairs solves; in the game
// UNCHECKED (the ship tick between the two portals, and that the pair re-bands like a mode change).
function swingTall(o, { R, imix, room, len, W, H, G }) {
  // the swell and the waves together stay under ~0.7 rows a column (steeper than that a swing can't follow)
  const gap = R.int(room(5, 4), room(6, 5)), A = o.amp ?? 1.5, P = len(imix(26, 20), imix(34, 26)),
    Pd = Math.max(60, Math.round(W * R.pick([1, 1, 0.75]))), top = H - 5;
  const D = x => 5 + (top - 5) * (1 - Math.cos(2 * Math.PI * x / Pd)) / 2, Y = x => D(x) + A * Math.sin(2 * Math.PI * x / P);
  let bc = 5;
  for (let x = 0; x < W; x++) { const y = Y(x), lo = Math.round(y - gap / 2) - 1, hi = Math.round(y + gap / 2), ch = x % 2 ? "q" : "o";
    if (lo >= 0) G.put(x, lo, ch); if (hi < H) G.put(x, hi, ch);
    if (x > 2 && x < W - 2 && Math.abs(D(x) - bc) >= 3) { const r = Math.round(y); G.put(x, r, "R");
      bc = Math.max(0, Math.floor((r * 30 + 15 - 150) / 30)) + 5; } }
  return { map: G.rows(), mode: "swing" }; }

// FLYING ON THE GROUNDS (ship, his my-mwz1s7po). Idea: a narrow corridor between two thin bars: "you need to either fully
// hold or release on the obsicles, and the corridor may change height". Motif: a flat run with obstacle runs on the floor
// (hold: ride the ceiling) or the ceiling (release: ride the floor), then a 45-degree climb or drop of both bars. Varies:
// run length, which side, the height step. Closed above and below (bars), so the ship can't go round it.
CONCEPT["my-mwz1s7po"] = "a narrow corridor of two thin bars; obstacle runs on the floor (hold) or the ceiling (release); the bars climb and drop together";
GEN["my-mwz1s7po"] = o => { const { R, imix, room, len, chance, W, H, G } = ctx(Object.assign({ cols: 56 }, o), 14), gap = room(5, 3);
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

// how often a level builder should pick a type (1 = as often as any): Evgeni 2026-11-27 on hanging: "low priority on using
// such ... considering removing as others contain these feates"
const PRIORITY = { hanging: 0.2 };
module.exports = { PRIORITY, GEN, CONCEPT, KEYS, TIERS, make, rng, tunnel };

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
