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

// a height wander (Evgeni 2026-11-27: "can we try 100% spread or close in all generations if possible", then, on the ship
// corridor: "trying to spread in a too forced way. making the gameplay really long to create those patterns ... we should
// start from the middle, if we want to have chances to cover more ground. it doesnt have to be good every generation"):
// the path starts in the middle; each next target is a move of 2 to ~half the room either way (toward the far side more
// often), and only now and then (15%) the very edge. Coverage comes by chance, not by forced climbs.
const tour = (R, lo, hi) => h => { const m = (lo + hi) / 2, span = hi - lo;
  if (R.chance(0.15)) return h < m ? hi : lo;
  const dir = R.chance(h < m ? 0.7 : 0.3) ? 1 : -1, n = R.int(2, Math.max(2, Math.round(span / 2)));
  return clamp(h + dir * n, lo, hi); };
// BAND MOVERS for a flying corridor taller than the mode's 10-row band (Evgeni 2026-11-27: "even if i make height x2 some
// of the modes stay on their height like hardcoded"; "swing/ship/ufo portals in the middle of the gameplay recenter the
// screen. people put invisible ones to move further in the screens"): a hidden portal of the mode (`ch`: H ship, U ufo,
// A wave) at the corridor's middle each time that middle has moved 3 rows from the band's centre; physics re-bands on it
// (lib/physics.js: floor = the portal's y - 150, down to 30 units). Soft blocks beside it (Evgeni: "should be softly blocked
// along both sides ... if there is no room in the corridor no need to block"): a spike on the floor and one hanging from
// the ceiling in its column when the corridor is 6 rows or more. mid(x) = the corridor's middle row, lo(x) / hi(x) its
// floor row and ceiling row (hi = H: no ceiling there).
function bandMovers(G, W, H, ch, mid, lo, hi) { if (H <= 10) return;
  let bc = 5;
  for (let x = 3; x < W - 3; x++) { const m = mid(x); if (Math.abs(m - bc) < 3) continue;
    const r = Math.round(m); G.put(x, r, ch); bc = Math.max(0, Math.floor((r * 30 + 15 - 150) / 30)) + 5;
    if (hi(x) - lo(x) >= 6) { G.put(x, lo(x), "^"); if (hi(x) < H) G.put(x, hi(x) - 1, "v"); } } }
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
CONCEPT.staircase = "climb a step at a time to a landing, then a gravity portal: down the steps hanging from the top, upside down, and back; hazards on some landings";
// and a flip upside down and back (Evgeni 2026-11-27: "lets add a reverse and back play in the basic staircases as well,
// and inrease the spread as well"): at the top landing a G portal drops the cube onto a ceiling bar, it walks down a
// staircase hanging from the top (each step a row lower: a jump toward the floor), and an N portal at its last step drops
// it back to the floor, where the climbing starts again from the ground
GEN.staircase = o => { const { R, imix, len, chance, W, H, G } = ctx(o, 9), top = H - 4; let h = 0, dir = 1, c = 0, flips = 0, same = 0, lastW = 0;
  // one cube jump onto a step a row up, in columns: 3.85 at 1x (GD's arc: 89 ticks), longer at a faster speed (o.speed:
  // its blocks a second over 1x's); 4 columns at 1x, 5 at 2x
  const JW = Math.round(3.85 * (o.speed || 1) + 0.2);
  const floorH = [];   // the floor's height per column, for the roof below
  while (c < W) {
    // not the same jump over and over (Evgeni 2026-11-27: "straircases have too many straight jumps, shouldnt have so many
    // in a row possible"): step widths 2-7, never 3 alike running; now and then a flat step over a little pit, or a step
    // back against the climb
    // ...but every step is a PROPER JUMP apart (Evgeni 2026-11-27: "their distance is too akward", "should be a proper jump
    // otherwise its impossible to adjust or predict"): a step one row up is either one jump long (JW: jump on landing,
    // land on the next; a chain of 2-3 of them) or a landing of two jumps' room (2 JW: walk, then the jump at its edge),
    // never the in-between widths (2, 5-7) that made the press land at an odd spot. Variety now comes from the rhythm
    // (chains of 1-3, then a landing) and the pits / steps back below, not from odd widths.
    let w; if (dir < 0) w = R.pick([JW, 2 * JW]);   // going down: walking off, any proper rhythm
    else if (same >= R.int(1, 3) || c === 0) { w = 2 * JW; same = 0; } else { w = JW; same++; }
    lastW = w;
    const end = Math.min(W - 1, c + w - 1); G.box(c, end, 0, h); for (let x = c; x <= end; x++) floorH[x] = h;
    if (w >= 2 * JW && c > 0 && end < W - 1) { if (chance(0.25, 0.6)) G.put(c + JW, h + 1, "^"); else if (chance(0, 0.3)) G.put(end, h + 1, "s"); }   // only on a landing, a jump in from its start
    c = end + 1;
    if (dir > 0 && h >= top) {
      if ((flips === 0 || R.chance(0.5)) && c + 24 < W) { flips++;   // the flip: G on this landing, the hanging staircase
        G.put(end - 1, h + 1, "G"); G.box(end - 2, end + 3, H - 1, H - 1); let ht = H - 1, x = end + 4;
        while (ht - 1 > 3 && x < W - 8) { const sw = R.chance(0.6) ? JW : 2 * JW, se = Math.min(W - 8, x + sw - 1); G.box(x, se, ht, H - 1);
          if (sw >= 2 * JW && chance(0.25, 0.6)) G.put(x + JW, ht - 1, "v"); x = se + 1; ht--; }
        G.box(x, x + 2, ht, H - 1); G.put(x + 1, ht - 1, "N");   // the last step, and back to the floor
        // the floor under the hanging staircase: low, spiked where the cube would fall early
        G.box(end + 1, x + 5, 0, 0); for (let q = end + 3; q < x; q += R.int(3, 5)) G.put(q, 1, "^");
        for (let q = end + 1; q <= x + 5; q++) floorH[q] = H;   // no roof here: the hanging staircase is the roof
        c = x + 6; h = 0; dir = 1; continue; }
      dir = -1; const e2 = Math.min(W - 1, c + len(3, 5)); G.box(c, e2, 0, h); for (let x = c; x <= e2; x++) floorH[x] = h; c = e2 + 1; }
    else if (dir < 0 && h <= 0) dir = 1;
    if (c > 4 && h > 0 && h < top && R.chance(0.15)) {   // a flat step over a pit (1-2 wide, a spike in it)
      const pw = R.int(1, 2); for (let x = c; x < Math.min(W, c + pw); x++) { G.put(x, 0, "^"); floorH[x] = 0; } c += pw; continue; }
    if (c > 4 && h > 1 && h < top && dir > 0 && R.chance(0.12)) { h -= 1; continue; }   // a step back down, then on up
    h = clamp(h + dir, 0, top); }   // one row a step: two rows left a 4 ms window (tight for any tier)
  // hazards on the roof (Evgeni: "they still have no hazards on the roof"): a bar along the top where the play is well
  // below it (5 rows or more), with spikes hanging in groups; gaps in it, and never over the high landings ("the fact we
  // put a line of blockers shouldnt stop us from reaching that full height")
  for (let x = 0; x < W; x++) if (floorH[x] != null && floorH[x] + 1 <= H - 6) { G.put(x, H - 1, "#"); if (R.chance(0.35)) G.put(x, H - 2, "v"); }
  return { map: G.rows(), mode: "cube" }; };

// OPEN CUBE (cube). Idea: a floor with pits, nothing overhead, platforms floating in the middle. Motif: a floor run + a
// spike pit. Varies: pit width, run length, a platform after the pit at one of two heights, a spike on it.
CONCEPT.opencube = "a floor with spike pits and open sky; platforms float at two heights";
GEN.opencube = o => { const { R, imix, len, chance, W, H, G } = ctx(o, 8);
  // the whole sky (Evgeni 2026-11-27: "100% spread or close in all generations"): the floor is one row (the cube runs at
  // row 1), and after some pits a climb of floating platforms 2 rows apart (a cube jump's comfortable height) up to the
  // top of the section, then the drop back to the floor
  G.box(0, W - 1, 0, 0); let c = len(5, 7), k = 0;
  while (c < W - 6) {
    if ((k++ % 2 === 1 || chance(0.2, 0.4)) && c + 14 < W) {   // a climb: 2-3 platforms, each 2 rows over the last, spikes under
      let px = c, py = 2; const n = Math.min(R.int(2, 3), Math.floor((H - 2) / 2)); let end = px;
      for (let q = 0; q < n && px + 4 < W - 4; q++) { const pl = R.int(imix(4, 3), 4); G.box(px, px + pl - 1, py, py);
        if (q === n - 1 && pl >= 4 && chance(0.2, 0.6)) G.put(px + 1, py + 1, "^"); end = px + pl; px += pl + R.int(0, 1); py += 2; }
      G.box(c + 1, end + 1, 0, 0, "^");   // the floor under the climb is spikes: the way is over the top
      c = end + 2 + len(imix(6, 4), imix(8, 5)); continue; }
    const pw = imix(2, 4); G.box(c, c + pw - 1, 0, 0, "^");
    if (chance(0.3, 0.7)) G.put(c + pw + 3, 1, "^");
    c += pw + len(imix(9, 5), imix(10, 7)); }
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
GEN.fly = o => { const { R, imix, room, len, chance, W, H, G } = ctx(o, 10), gap = room(6, 5), hiMax = H - gap;   // taller than 10: band movers
  // the valleys go down to the ground now and then (Evgeni 2026-11-27: "the flying should also be able and hit the
  // ground/floor as part of the path. keeping more distribution over the heights"): the ship slides along it there
  // and the whole band (10 rows, the map's height): the corridor tours from the ground to the band's roof (hiMax = no
  // ceiling blocks there, the roof is the ceiling), a gap of 6 (5 harder) rows
  const next = tour(R, 0, hiMax);
  const e = line(W, Math.round(hiMax / 2), L => { L.run(len(imix(3, 1), imix(4, 2)) + (L.h() === 0 || L.h() === hiMax ? 2 : 0)); L.leg(next(L.h())); });
  tunnel(G, W, e, gap, H - 1);
  const gp = gravPair(W, 30);
  bandMovers(G, W, H, "H", x => e(x) + gap / 2, x => Math.max(e(x), e(x + 1)), x => Math.min(e(x), e(x + 1)) + gap);
  // hazards on the sides, never floating in the middle (Evgeni 2026-11-27 on 🎲 fly 53193: "the placing of the hazards is
  // too random and unbalanced/unmatched, they should not be so much in the middle, somewhat more to the sides. for ship we
  // need to cover some of the corridor in spikes otherwise i can just slide"): along each flat stretch, the floor or the
  // ceiling (taking turns, by chance) spiked for most of its length, so neither can be slid the whole way; a spike in
  // each valley's floor, one hanging at each crest
  let side = R.chance(0.5) ? 1 : -1;
  const near = c => gp && (Math.abs(c - gp[0]) < 3 || Math.abs(c - gp[1]) < 3);
  for (let c = 3; c < W - 2; c++) { const a = e(c), b = e(c + 1), p = e(c - 1); if (a !== b || near(c)) continue;
    let n = 0; while (c + n + 1 < W - 2 && e(c + n + 1) === a && e(c + n + 2) === a) n++;   // flat from c to c + n
    if (n >= 2 && chance(0.5, 0.85)) {   // a spiked stretch on one side, a column or two left clear at its ends
      const roof = side < 0 && a + gap < H, k0 = c + 1, k1 = c + n - 1;
      for (let x = k0; x <= k1; x++) if (!near(x)) G.put(x, roof ? a + gap - 1 : a, roof ? "v" : "^");
      if (R.chance(0.6)) side = -side; c += n; continue; }
    if (p > a && chance(0.5, 0.9)) G.put(c, a, "^");
    else if (p < a && a + gap < H && chance(0.3, 0.8)) G.put(c, a + gap - 1, "v"); }
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
  // no hidden band movers inside a wave (Evgeni 2026-11-27: "no need portals inside the wave sections if they reach, it will
  // make the screen go bad"; his room-mover lab run showed GD 2.2091 holding no band at all, PHYSICS.md)
  const gp = gravPair(W, 30);
  // portals on a TURN (the join of two inputs), never mid-leg (Evgeni 2026-11-27 on a generated wave: "portals in waves
  // should usually be on connecting points of clicks or holds, putting them in the middle of a corridor is big difficulty
  // spike"): the nearest column where the line changes direction, at the corridor's middle height there
  if (gp) { const a = joinNear(e, W, gp[0]), b = joinNear(e, W, gp[1]); G.put(a, e(a) + Math.floor(gap / 2), "G"); if (b !== a) G.put(b, e(b) + Math.floor(gap / 2), "N"); }
  return { map: G.rows(), mode: "wave" }; };

// FLAPPY (ufo). Idea: pipes from the floor and the ceiling with a gap at changing heights. Motif: one pipe pair. Varies:
// the gap's height (walks up and down), the spacing, spike tips. Harder: a narrower gap, closer pipes, bigger jumps.
CONCEPT.flappy = "pipe pairs from floor and ceiling; the gap's height walks up and down";
// Evgeni 2026-11-27: "flappy bird generates too much of the same poles there should be some variation in width of
// structures in the gameplays as well, and here as well we want to try and use the extremes": poles 1 to 4 wide, and the
// gap tours the whole 10-row band (the ufo's), from just over the ground (no lower pole) to the band's roof (no upper one)
GEN.flappy = o => { const { R, imix, room, len, chance, W, H, G } = ctx(o, 10), gh = room(5, 3), next = tour(R, 1, H - gh); let g = R.int(2, 4);
  G.box(0, W - 1, 0, 0);
  let bc = 5;   // the band's centre row (taller than 10 rows: hidden ufo portals in the pole gaps move it, bandMovers)
  for (let c = 3; c < W - 2;) { const pw = Math.min(W - 2 - c, R.pick([1, 2, 2, 3, 4]));
    if (g > 1) { G.box(c, c + pw - 1, 0, g - 1); G.put(c, g - 1, "^"); }
    if (g + gh < H) { G.box(c, c + pw - 1, g + gh, H - 1); G.put(c + pw - 1, g + gh, "v"); }
    if (c + pw + 2 < W - 2 && g > 2 && chance(0.3, 0.6)) G.put(c + pw + 2, 1, "^");
    // the next gap: toward the other half of the band, but a ufo climbs only so fast, so far gaps get more room between
    let g2 = next(g); if (H > 10) g2 = clamp(g2, g - 5, g + 5);
    // a band mover in this gap (the ufo can't go round it: the poles hold it) set between this gap and the next
    if (H > 10) { const t = (g + gh / 2 + g2 + gh / 2) / 2; if (Math.abs(t - bc) >= 2) { const r = clamp(Math.round(t), g, g + gh - 1);
      G.put(c + Math.floor((pw - 1) / 2), r, "U"); bc = Math.max(0, Math.floor((r * 30 + 15 - 150) / 30)) + 5; } }
    const far = Math.abs(g2 - g);
    c += pw + len(room(6, 4), room(7, 5)) + Math.max(0, far - imix(3, 4)); g = g2; }
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
GEN.ball = o => rollers(o, { mode: "ball", band: 8, travel: ballTravel });
// the ball's body, shared with the spider (a 9-row band, and it crosses instantly: the spider teleports to the other side)
// and with "ball portals" (some flips made by a gravity portal at the surface's end instead of a click)
function rollers(o, { mode, band, travel, portals = 0, overlap = null }) { const { R, mix, imix, chance, W, H, G } = ctx(o, 10), BT = Math.min(H, band);   // the band: rows 0..band-1
  const win = mix(2.6, 1.4);   // flip window, columns
  const S = [{ side: 1, kind: "mass", y: 2, c0: 0, c1: R.int(5, 7) }];   // y: the surface's row (floor side: the row the ball rolls on; ceiling side: the row it hangs in)
  while (S[S.length - 1].c1 < W) {
    // moves of 2-4 rows, under half the band on average (Evgeni 2026-11-27: "in the jumping modes, that the average length
    // of movement is below the half of the full length, just to have less updown from ground to floor"), and the play
    // height wandering over the whole band both ways ("the height of the gameplay is too similar ... more balanced across
    // the y axis, in both directions"): pieces in the middle, a floor or ceiling mass only at the band's edges
    const p = S[S.length - 1], side = -p.side, step = R.int(2, o.maxStep ?? 4);
    // a floor-side surface sits low enough to flip up from (row <= BT - 4), a ceiling-side one high enough to drop from
    // and now and then the very edges (Evgeni 2026-11-27: "all our sections should involve the ground/floor at some of the
    // play. even those fully blocked (ball / spider...)"): a stretch rolled on the ground itself (row 0, its spikes taken
    // away there) or under the ceiling bar (row BT - 1)
    const edge = R.chance(0.3);
    const y = side < 0 ? clamp(p.y + step, Math.max(3, p.y + 2), edge ? BT - 1 : BT - 2) : clamp(p.y - step, edge ? 0 : 1, Math.min(BT - 4, p.y - 2));
    const kind = side < 0 ? (y >= BT - 2 ? "mass" : "mid") : (y <= 1 ? "mass" : "mid");
    // a portal flip happens exactly at the surface's end (no window to leave); travel 0 = the spider's instant crossing
    const byPortal = portals && p.c1 + 2 < W && R.chance(portals);
    const d = Math.abs(p.y - y) - 1, flip = p.c1 - (p.end ? 1 : 0), c0 = Math.max(p.c0 + 2, Math.round(flip + travel(d) - (byPortal ? 0 : travel(d) ? win : -1))), w = R.pick([R.int(2, 3), R.int(imix(4, 3), imix(6, 5)), R.int(imix(4, 3), imix(6, 5)), R.int(imix(9, 7), imix(12, 9))]);   // short, medium, long: his rests vary a lot (CV ~1)
    // a portal is the way past an obstacle (Evgeni: "a portals just flip you arround instead of being a way to pass an
    // obsicle like in the layout i drew"): the surface goes on 3 columns past it with spikes on it, so a player who doesn't
    // flip there runs into them; the flip is the portal's, and the clicks stay on the other transitions
    if (byPortal) { p.end = false; p.portal = p.c1 + 1; p.c1 += 3; }
    // the spider: the next piece overlaps this one by `overlap` columns, and that overlap is the click's window
    const c0b = overlap && !byPortal ? Math.max(p.c0 + 2, flip + 1 - overlap()) : c0;
    S.push({ side, kind, y, c0: c0b, c1: c0b + w, thick: kind === "mid" ? (R.chance(0.7) ? 1 : 2) : 0, end: chance(0.25, 0.5) });
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
    if (s.side > 0 && s.y === 0) for (let c = s.c0; c <= c1; c++) G.put(c, 0, ".");
    if (s.side < 0 && s.y === BT - 1) for (let c = s.c0; c <= c1; c++) G.put(c, BT - 1, ".");
    // and the two columns past a surface at the edges stay clear: a saw there reaches the player rolling off its end
    if (s.side > 0 ? s.y <= 1 : s.y >= BT - 2) for (let c = c1 + 1; c <= Math.min(W - 1, c1 + 2); c++) for (const row of [0, BT - 1])
      G.put(c, row, ".");
    if (s.side > 0) { if (s.kind === "mass") G.box(s.c0, c1, 0, s.y - 1); else G.box(s.c0, c1, s.y - s.thick, s.y - 1);
      if (s.end && s.c1 < W) G.put(c1, s.y, "^"); }
    else { if (s.kind === "mass") G.box(s.c0, c1, s.y + 1, H - 1); else { G.box(s.c0, c1, s.y + 1, s.y + s.thick); if (chance(0.3, 0.6)) G.put(s.c0 + 1, s.y + s.thick + 1, "^"); }
      if (s.end && s.c1 < W) G.put(c1, s.y, "v"); }
    // the portal stands one column past the surface's end at the player's height: G sends a floor roller up, N brings a
    // ceiling roller down (the hazards under / over it cleared so the player meets the portal, not a spike)
    if (s.portal && s.portal < W) { const c = s.portal, row = s.y; for (let r = Math.max(0, row - 1); r <= Math.min(BT - 1, row + 1); r++) if (G.rows()[H - 1 - r][c] !== "#") G.put(c, r, ".");
      G.put(c, row, s.side > 0 ? "G" : "N");
      for (const x of [c + 1, c + 2]) if (x < W) G.put(x, row, s.side > 0 ? "^" : "v"); } }
  return { map: G.rows(), mode }; }

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
  // a tall map in a short section: turn lower, so at least one flip and back fits (about half the columns for the climb)
  turnHi = Math.max(2, Math.min(turnHi, 1 + Math.round((lastC - 4) / 3 * 0.5)));
  // runs of jumps: about 3 at most, softly (Evgeni 2026-11-27: "stairpath has still like 9 jumps in a row sometimes. max 3
  // jumps in a row", "when i say max, i mean distribute so that anything more much lower chances ... dont want to set hard
  // limits"): after n hops a REST comes with chance 0 / 0 / 0.25 / 0.6 / 0.85 (n = 0..4+): the way block is 3 wide and
  // the next column comes 5 on, not 3 (a run, then the same jump), so the rhythm breaks
  let hops = 0, step = 3, lastWay = lastC;
  for (let c = 4; c <= lastC; c += step, k++) { step = 3; lastWay = c;
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
    let turned = false;
    if ((up && (h <= turnLo || c >= lastC - 5)) || (!up && h >= turnHi && c <= lastC - 6)) { turned = true; hops = 0;
      if (o.wide) G.put(c + 1, h, "#"); G.put(c + (o.gOff ?? 1), up ? h - 1 : h + 1, up ? "N" : "G"); turn = true; up = !up; run = o.turnRun ?? 2;
      if (up) turnLo = R.int(low, Math.min(h + DU - 1, low + imix(0, 2))); else turnHi = R.int(Math.max(h - DU + 1, top - imix(0, 2)), top); }
    if (!turned && !turn && k > 0 && c + 5 <= lastC - 6 && R.chance([0, 0, 0.25, 0.6, 0.85][Math.min(4, hops)])) {
      G.put(c + 1, h, "#"); G.put(c + 2, h, "#"); step = 5; hops = 0; }
    else if (!turned) hops++; }
  G.box(Math.min(W - 3, lastWay + 5), W - 1, 0, 1);   // the end platform, 5 on from the last way column (rests shift it)
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
  while (c < W) { const gap = R.int(room(5, 4), room(6, 5)), A = (H - 2) / 2 * (o.amp ?? R.pick([0.8, 1, 1])), mid = H / 2,   // the path's middle reaches the ground and the roof (the walls leave the map there)
      P = len(room(26, 20), room(34, 26));
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
  const gap = R.int(room(5, 4), room(6, 5)), A = o.amp ?? 1.5, P = len(room(26, 20), room(34, 26)),
    Pd = Math.max(60, Math.round(W * R.pick([1, 1, 0.75]))), top = H - 4;
  // the swell from row 5 to the map's top less 4 (wider than this failed at 60 cols: too steep with the waves; open:
  // the whole height needs a longer swell, Evgeni "100% spread or close in all generations")
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
GEN["my-mwz1s7po"] = o => { const { R, imix, room, len, chance, W, H, G } = ctx(Object.assign({ cols: 56 }, o), 10), gap = room(5, 3);
  // the ship's band is 10 rows: the corridor tours all of it, down to the ground (no lower bar there) and up to the roof
  const next = tour(R, 0, H - gap);
  const e = line(W, Math.round((H - gap) / 2), L => { L.run(len(imix(10, 6), imix(12, 8))); L.leg(next(L.h())); });
  tunnel(G, W, e, gap, H - 1, 2);
  bandMovers(G, W, H, "H", x => e(x) + gap / 2, x => Math.max(e(x), e(x + 1)), x => Math.min(e(x), e(x + 1)) + gap);
  let side = R.chance(0.5) ? 1 : -1;
  for (let c = 4; c < W - 2; c++) { const b = e(c); if (!(e(c - 1) === b && e(c + 1) === b && e(c + 2) === b)) continue;
    if (chance(0.3, 0.55)) { const n = R.int(1, imix(2, 4)); let k = 0;
      for (; k < n && e(c + k + 1) === b && c + k < W - 2; k++) G.put(c + k, side > 0 ? b : b + gap - 1, side > 0 ? "^" : "v");
      c += k + 1; if (R.chance(0.4)) side = -side; } }
  return { map: G.rows(), mode: "ship" }; };

// SPIDER CORRIDORS (his my-mwz7nxue). Idea: the ball's surfaces, but the spider teleports across at once, so the next
// surface may start right where the last one ends; a 9-row band (270 units).
CONCEPT["my-mwz7nxue"] = "floor and ceiling pieces the spider teleports between; the next one starts right where the last ends, at changing heights";
// Evgeni 2026-11-27: "in spider we need alignment of top and bottom, that alignment decides the difficulty in a way as a
// timing and cps", then "the platforms you jump still dont overlap in possible gameplay": each piece starts before the
// last one ends, the overlap (3 columns easy, 1 at harder, now and then one more or less) is the window to teleport in
GEN["my-mwz7nxue"] = o => { const { R, mix } = ctx(o, 10), base = mix(3, 1.2);
  return rollers(o, { mode: "spider", band: 9, travel: () => 0, overlap: () => clamp(Math.round(base + R.pick([-1, 0, 0, 0, 1])), 1, 4) }); };

// BALL PORTALS (his my-mwz8kaem). Idea: the ball corridor, but some flips are made for the player by a gravity portal
// standing at a surface's end (G up, N down), between the clicked ones.
CONCEPT["my-mwz8kaem"] = "ball surfaces on both sides; some flips are gravity portals at a surface's end, the rest are clicks";
GEN["my-mwz8kaem"] = o => rollers(o, { mode: "ball", band: 8, travel: ballTravel, portals: 0.3 });

// ORB GAMEPLAY (cube, his my-mwz2haf0). Idea: over a spike floor, the cube goes from orb to orb; sets of one kind (yellow:
// up, blue: flip and fly the other way, green: flip and launch forward) and mixes. The page can't run the sim, so the
// orbs go on the cube's own arc, computed here with GD's numbers (lib/physics.js: 1x speed 5.193 u a tick at 240 Hz, the
// 0.9 slow factor on vertical motion, g 0.958, jump 11.18, blue x0.8 then a flip, a flip halves vy): each orb at least
// ~3.5 columns after the last press, in the middle rows, so the route takes every one (tools/orbfit.js is the sim's own
// placer for his drawn one). A ceiling bar with hanging spikes catches a missed blue / green.
CONCEPT["my-mwz2haf0"] = "over a spike floor the cube flies from orb to orb, each on the arc of the last: sets of yellow, of blue (zigzag), of green (forward, reversed), and mixes";
GEN["my-mwz2haf0"] = o => { const { R, imix, room, chance, W, H, G } = ctx(o, 14);
  const X = 5.77000189 * 0.9 * 0.25, DTS = 0.225, g = 0.958199024, J = 11.1800318, top = H - 2;
  const st = { x: 6 * 30 + 15, y: 4 * 30 + 15, vy: J, grav: 1 };   // the cube jumping off the start platform's end (cols 0-6, 4 high)
  G.box(0, 6, 0, 3); for (let c = 0; c < W; c++) G.put(c, 0, "^"); G.box(0, 6, 0, 3);
  G.box(0, W - 1, H - 1, H - 1); for (let c = 0; c < W; c += 1) if (R.chance(0.85)) G.put(c, H - 2, "v");
  const step = q => { q.vy -= g * DTS * q.grav; if (q.vy * q.grav < -15) q.vy = -15 * q.grav; q.x += X; q.y += q.vy * DTS; };
  const row = q => (q.y - 15) / 30, col = q => (q.x - 15) / 30;
  // the spots on the arc from q where an orb of `kind` can go: past the gap (shorter right after a flip: a flipped cube
  // crosses the band in ~3 columns), in the middle rows, not in the last 8 columns; a flip orb on the side it flips away
  // from (normal -> reversed in the lower part, reversed -> normal in the upper part), so the flipped arc has room
  const candsOf = (q0, kind, lastC) => { const flips = kind !== "Y", gapC = q0.flipped ? 1.5 : room(3.5, 3), out = []; let q = { ...q0 }, n = 0;
    while (col(q) < W - 9 && n++ < 2000) { step(q); const r = row(q), c = col(q);
      if (r < 1.2 || r > top - 0.5) break;
      const side = !flips || (q.grav > 0 ? r <= H / 2 - 2 : r >= H / 2 + 1);
      if (n % 6 === 0 && c - lastC >= gapC && r >= 3 && r <= top - 3 && side) out.push({ ...q }); if (out.length > 40) break; }
    return out; };
  // the orb's effect, pressed as the cube is at its centre
  const apply = (sp, kind) => { const q = { ...sp }; q.x = Math.round(col(sp)) * 30 + 15; q.y = Math.round(row(sp)) * 30 + 15;
    if (kind === "Y") q.vy = q.grav * J;
    else if (kind === "B") { q.vy = q.grav * J * 0.8; q.grav = -q.grav; q.vy *= 0.5; }
    else { q.grav = -q.grav; q.vy = q.grav * J; }
    q.flipped = kind !== "Y"; return q; };
  // the kinds: sets of 2-4 of one kind; blue and green only past easy; the gravity at the end must be normal
  const pool = o.tier === "easy" || ctx(o, 14).d < 0.2 ? ["Y"] : ["Y", "Y", "B", "E"];
  // a run of orbs is 2-4 long, 5 now and then, never more (Evgeni 2026-11-27: "some sequences seem too long (8 orbs i see),
  // i think lets max it to 5 (very rare)"): then a landing, or the chain ends
  const runLen = () => R.chance(0.08) ? 5 : R.int(2, 4);
  let set = R.pick(pool), left = runLen(), lastC = 5, cur = { ...st }, guard = 0, since = 0;
  // the landing goes anywhere in the height (Evgeni: "100% spread or close"): on the ground itself (blocks in place of
  // the spike floor), low or middle, and with the gravity reversed on a ceiling platform up to the top bar; the cube
  // runs along it and jumps off its end. want: the row to come down to (or up to, reversed)
  const landAt = want => { const up = cur.grav < 0; let q = { ...cur }, n = 0, at = null;
    while (n++ < 1500 && col(q) < W - 16) { step(q); const rq = row(q); if (rq > top + 0.5 || rq < 0.5) break;
      if (col(q) - lastC >= 2 && (up ? q.vy > 0 && rq >= want - 0.5 : q.vy < 0 && rq <= want + 0.5)) { at = q; break; } }
    if (!at) return false;
    const rr = up ? Math.min(top, Math.ceil(row(at))) : Math.max(1, Math.floor(row(at))), c0 = Math.floor(col(at)), len = R.int(room(5, 3), room(7, 4));
    G.box(c0, c0 + len, up ? rr + 1 : rr - 1, up ? rr + 1 : rr - 1); for (let x = c0; x <= c0 + len; x++) G.put(x, rr, ".");
    cur = { x: (c0 + len) * 30 + 15, y: rr * 30 + 15, vy: up ? -J : J, grav: up ? -1 : 1, flipped: false }; lastC = c0 + len - 1; since = 0; return true; };
  const wantRow = () => cur.grav < 0 ? top - R.pick([0, 1, 3, 5]) : R.pick([1, 1, 3, 5, 6]);
  const orbs = [];
  while (guard++ < 200) {
    // fly on until a good spot: past the gap (shorter right after a flip: a flipped cube crosses the band in ~3 columns),
    // in the middle rows, not in the last 8 columns. A flip orb goes on the side it flips away from (normal -> reversed in
    // the lower half, reversed -> normal in the upper half), so the flipped arc has the whole band to cross
    let kind = set; if (cur.grav < 0 && lastC > W - 24 && kind === "Y") kind = R.pick(["B", "E"]);
    const cands = candsOf(cur, kind, lastC).filter(sp => kind === "Y" && sp.grav > 0 || candsOf(apply(sp, kind), kind === "Y" ? "Y" : "B", Math.round(col(sp))).length);
    if (!cands.length) { if (since && landAt(cur.grav < 0 ? top - 1 : 1)) continue;   // nowhere for an orb: land first
      if (kind !== "Y" || cur.grav < 0) { if (cur.grav < 0) break; set = "Y"; continue; } break; }
    const spot = cands[R.int(0, Math.min(cands.length - 1, imix(6, 3)))];
    const c = Math.round(col(spot)), r = Math.round(row(spot));
    if (orbs.some(b => Math.abs(b.c - c) < 3 && Math.abs(b.r - r) < 2)) break;
    orbs.push({ c, r, kind }); cur = apply(spot, kind); since++;
    lastC = c; if (--left <= 0 || since >= 5) { set = R.pick(pool); left = runLen();
      // a landing after every set (Evgeni 2026-11-27: "the orb gameplay has only orbs, we want it to land at some parts,
      // every 2-4 orbs"): a platform where the arc comes down through rows 3-6, the cube runs along it and jumps off its end
      if (!landAt(wantRow()) && since >= 5) break; }
  }
  // back to normal gravity at the end: a blue orb on the arc if the last one left it reversed
  if (cur.grav < 0) { const cs = candsOf(cur, "B", lastC); if (cs.length) { const sp = cs[0], c = Math.round(col(sp)), r = Math.round(row(sp));
    orbs.push({ c, r, kind: "B" }); cur = apply(sp, "B"); lastC = c; } }
  for (const b of orbs) G.put(b.c, b.r, b.kind);
  // land: the end platform from where the last arc comes down to a row it can stand on, to the map's end
  let q = { ...cur }, n = 0, land = W - 4, lr = 2;
  while (n++ < 3000) { step(q); if (q.vy < 0 && row(q) <= 3.6) { land = Math.max(lastC + 2, Math.floor(col(q))); lr = Math.max(1, Math.min(3, Math.round(row(q) - 0.5))); break; } if (col(q) > W) break; }
  land = Math.min(land, W - 3); G.box(land, W - 1, 0, lr - 1); for (let c = land; c < W; c++) G.put(c, lr, ".");
  return { map: G.rows(), mode: "cube" }; };

const KEYS = Object.keys(GEN);
function make(key, opts = {}) { const g = GEN[key]; if (!g) throw new Error("no generator for " + key + " (have " + KEYS.join(", ") + ")");
  const o = {}; for (const k of ["cols", "rows", "seed", "bpm", "beatCols", "speed"]) if (opts[k] != null) o[k] = +opts[k];
  if (opts.tier != null) o.tier = isNaN(+opts.tier) ? opts.tier : +opts.tier;
  const r = g(o), z = (LS.SECTIONS || []).find(s => s.key === key);
  // a section taller than 12 rows asks the builder to zoom out (Evgeni 2026-11-27: "maybe we need to zoom out a bit to allow
  // bigger gameplay"): camera zoom trigger 1913 at 0.85 over it, back to 1 after
  if (r.map.length > 12 && r.zoom == null) r.zoom = 0.85;
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
