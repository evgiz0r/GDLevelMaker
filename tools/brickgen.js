// node tools/brickgen.js gen [--mode ship,wave,ball,ufo] [--n 400] [--keep 25] [--tier Normal] [--seed 1]
//                                                  -- generate bricks presses-first, verify, judge against the official
//                                                     bricks, keep the best distinct ones -> knowledge/brickgen.json
// node tools/brickgen.js list [--mode ship]        -- the kept bricks with their judge scores
// node tools/brickgen.js show <id>                 -- one brick: presses, windows, judge parts, a text map
// node tools/brickgen.js build <id>                -- its test level -> local/structures/<id>.gdlvl (the viewer / textmap)
// node tools/brickgen.js lab [--mode ship]         -- every kept brick of a mode in a row -> levels/lab/brickgen_<mode>.gdlvl
//
// OUR OWN BRICKS, generated (BRICKGEN.md; Evgeni 2026-11-26: "lets start thinking about generating our own structures
// too" -- our hand-made library pieces are poor, RobTop's are decent: so RobTop's bricks are the JUDGE, never the source).
// A brick is made PRESSES FIRST, the way tools/hitbuild.js and tools/autobricks.js build:
//   1. a rhythm: 2-6 presses on a 0.1 s grid (holds for ship, toggles for wave, taps for ball / ufo), about 2 clicks a
//      second (LEGO.md "Clicks and timing by tier": the same at every tier);
//   2. the sim plays it in the open mode band from the standard structure test entry (tools/structures.js testSpec):
//      that path is the design;
//   3. the level is built around the path: ship / wave -- floor and roof that follow the path at a set room, 45-degree
//      slopes only (smooth), narrowed into gates where the path turns; ball -- a platform on the side the ball goes to
//      after each press, at a height and length from the rhythm; ufo -- ledges under the path's low points over a pit;
//   4. hazards on the walls / in the pits, each batch kept only if the planned presses still clear
//      (guards along the lane: HAZARDS.md's rated mix is ~45% guard, ~38% fill, ~17% threat);
//   5. verified: the planned presses clear it, NO presses do not (it asks for input), ball / ufo: a stray press at any
//      tick before each planned one dies or rejoins (no secret way); the player's timing windows (lib/windows.js, the
//      same windows score.js uses) per input;
//   6. judged against the official bricks: tools/lego.js measure() classifies the brick like any cut piece (family /
//      wrapper / path kind / spikes / gates / gap -> its signature), and the brick is scored by how common that
//      signature is in the main levels and how far its numbers (seconds, presses, height range, hazards per 100 blocks,
//      gap) sit inside the official p10-p90 of that signature (knowledge/lego.json families) -- plus its fit to the
//      tier (tightest window vs knowledge/brick_tiers.json, clicks per second near 2) and Evgeni's votes on the kind;
//   7. near-duplicates (same signature, close column profile) dropped; the best `keep` per mode kept.
// The kept bricks are registered as structures "g-<mode>-<n>" (tools/structures.js), so `structures.js check g-...`
// gives them the full gates, and brickpick / compose / the catalogue use them like any library piece.
"use strict";
if (require.main === module && /^(gen)$/.test(process.argv[2] || "")) require("./heavy.js").claim();
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), OUT = path.join(ROOT, "knowledge", "brickgen.json");
const B = 30;

let _GD = null;
function GDlib() {
  if (_GD) return _GD;
  const { GD } = require("./io.js");
  Object.assign(GD, require("../lib/difficulty.js"));
  const WI = require("../lib/windows.js"); GD.inputWindows = GD.inputWindows || WI.inputWindows;
  return (_GD = GD);
}
const TPS = 240;
const TIER_WIN = { Easy: 142, Normal: 150, Hard: 108, Harder: 100, Insane: 88, Demon: 67 };   // official p10 tightest window
const TIER_ORDER = ["Easy", "Normal", "Hard", "Harder", "Insane", "Demon"];

// ---------------------------------------------------------------- rng
function rng(seed) { let s = (seed >>> 0) || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const pickOf = (r, arr) => arr[Math.floor(r() * arr.length)];

// ---------------------------------------------------------------- the test harness (the same one structures.js checks with)
function harness(mode, objects, width) {
  const GD = GDlib(), S = require("./structures.js"), { build } = require("./make.js");
  const st = { id: "gen", needs: { mode, grav: 1, mini: false, speed: "1x" }, leaves: { mode, grav: 1, mini: false, speed: "1x" }, args: {},
    build: () => ({ objects, width }) };
  const t = S.testSpec(st, {});
  const log = console.log; console.log = () => {};
  let level; try { level = build(t.spec, "brickgen").level; } finally { console.log = log; }
  const w = GD.makeWorld(level.objects, level.header);
  return { w, level, s0: t.s0, s1: t.s1, exitCol: t.exitCol };
}
// the tick the player reaches the brick's first column with no input (the lead-in has none)
function entryTick(mode) {
  const GD = GDlib(), h = harness(mode, [], 40), r = GD.run(h.w, []);
  const i = r.path.findIndex(q => q.x >= h.s0 * B);
  return { tick: r.path[i].tick, s0: h.s0, state: r.path[i] };
}
const ENTRY = {};
const entry = mode => ENTRY[mode] || (ENTRY[mode] = entryTick(mode));

// events relative to the brick's entry tick -> absolute
const absEvents = (mode, rel) => rel.map(e => ({ tick: e.tick + entry(mode).tick, type: e.type }));
function play(mode, objects, width, rel) {
  const GD = GDlib(), h = harness(mode, objects, width), r = GD.run(h.w, absEvents(mode, rel));
  return { h, r };
}
// alive through the brick and 3 blocks past it?
const clears = (h, r) => !r.path.some(q => q.dead && q.x < (h.s1 + 3) * B) && r.path[r.path.length - 1].x >= (h.s1 + 3) * B - 1;

// ---------------------------------------------------------------- rhythms
// press times in seconds from the brick's entry: a 0.1 s grid, gaps 0.2-0.8 s, mean near 0.5 s (2 clicks a second)
function rhythm(r, n, lo = 2, hi = 8) {
  const ts = []; let t = 0.15 + 0.1 * Math.floor(r() * 3);
  for (let k = 0; k < n; k++) { ts.push(+t.toFixed(2)); t += 0.1 * (lo + Math.floor(r() * (hi - lo + 1))); }
  return ts;
}
const T = s => Math.round(s * TPS);

// ---------------------------------------------------------------- walls around a flown path (ship / wave)
// per column edge c (0..W): the path's lowest / highest point near it -> the floor's top and roof's bottom at that edge,
// with `room` blocks of air (less at gates), then smoothed to 45 degrees (one row per column at most: slopes only)
function pathCols(r, s0, W, win = 1) {
  const lo = Array(W + 1).fill(Infinity), hi = Array(W + 1).fill(-Infinity);
  for (const q of r.path) {
    const c = (q.x - s0 * B) / B; if (c < -1.5 || c > W + 1.5) continue;
    for (let e = Math.max(0, Math.ceil(c - win)); e <= Math.min(W, Math.floor(c + win)); e++) { lo[e] = Math.min(lo[e], q.y); hi[e] = Math.max(hi[e], q.y); }
  }
  for (let e = 0; e <= W; e++) if (!isFinite(lo[e])) { lo[e] = lo[e - 1] ?? 15; hi[e] = hi[e - 1] ?? 15; }
  return { lo, hi };
}
function profile(r, s0, W, o) {
  const { lo, hi } = pathCols(r, s0, W, o.win || 1), band = o.band || 10;
  const roomAt = e => o.room - (o.gates && o.gates.has(e) ? o.gateCut : 0);
  const f = [], g = [];
  for (let e = 0; e <= W; e++) {
    f.push(Math.max(0, Math.floor((lo[e] - o.half) / B - roomAt(e))));
    g.push(Math.min(band, Math.ceil((hi[e] + o.half) / B + roomAt(e))));
  }
  // 45 degrees at most: the floor only goes down and the roof only up to fix a jump (never less room)
  for (let it = 0; it < W + 2; it++) for (let e = 0; e <= W; e++) {
    if (e > 0) { f[e] = Math.min(f[e], f[e - 1] + 1); g[e] = Math.max(g[e], g[e - 1] - 1); }
    if (e < W) { f[e] = Math.min(f[e], f[e + 1] + 1); g[e] = Math.max(g[e], g[e + 1] - 1); }
  }
  return { f, g, lo, hi };
}
// edge heights -> blocks and 45-degree slopes (tools/patterns.js fly-path's slope orientations)
function walls(P, W, o) {
  const objs = [], band = o.band || 10;
  for (let c = 0; c < W; c++) {
    const a = P.f[c], b = P.f[c + 1];
    if (o.floor !== false && !(o.floorFrom != null && c < o.floorFrom)) {
      if (a === b) for (let r = 0; r < a; r++) objs.push(["block", c, r]);
      else if (b === a + 1) { for (let r = 0; r < a; r++) objs.push(["block", c, r]); objs.push(["slope", c, a]); }
      else { for (let r = 0; r < b; r++) objs.push(["block", c, r]); objs.push(["slope", c, b, { flipX: true }]); }
    }
    const A = P.g[c], Bn = P.g[c + 1];
    if (o.roof !== false) {
      if (A === Bn) { for (let r = A; r < band; r++) objs.push(["block", c, r]); }
      else if (Bn === A + 1) { objs.push(["slope", c, A, { flipX: true, flipY: true }]); for (let r = A + 1; r < band; r++) objs.push(["block", c, r]); }
      else { objs.push(["slope", c, Bn, { flipY: true }]); for (let r = Bn + 1; r < band; r++) objs.push(["block", c, r]); }
    }
  }
  return objs;
}
// spikes on the flat parts of the walls, as near the path as the tier allows (guards); a batch is kept only if the
// planned presses still clear (halved on a death, as tools/autobricks.js fillHazards)
function wallSpikes(P, W, o) {
  const cand = [];
  for (let c = 1; c < W - 1; c++) {
    const lo = Math.min(P.lo[c], P.lo[c + 1]), hi = Math.max(P.hi[c], P.hi[c + 1]);
    if (o.floor !== false && P.f[c] === P.f[c + 1] && (P.f[c] > 0 || o.groundSpikes) && !(o.floorFrom != null && c < o.floorFrom)) {
      const top = P.f[c] * B + 21;   // a spike's hitbox top (6 x 12, centred on its cell)
      if (lo - o.half - top >= o.clear) cand.push(["spike", c, P.f[c]]);
    }
    if (o.roof !== false && P.g[c] === P.g[c + 1] && P.g[c] < (o.band || 10)) {
      const bot = P.g[c] * B - 21;
      if (bot - (hi + o.half) >= o.clear) cand.push(["spike", c, P.g[c] - 1, { rot: 180 }]);
    }
  }
  return cand;
}
function keepIfClears(mode, base, cand, W, rel) {
  const kept = [];
  const tryAdd = list => {
    if (!list.length) return;
    const { h, r } = play(mode, base.concat(kept, list), W, rel);
    if (clears(h, r)) { kept.push(...list); return; }
    if (list.length === 1) return;
    tryAdd(list.slice(0, list.length >> 1)); tryAdd(list.slice(list.length >> 1));
  };
  tryAdd(cand);
  return kept;
}

// ---------------------------------------------------------------- flying modes: ship and wave
const FLY = {
  ship: { half: 13, rooms: { Easy: [2.2, 2.6], Normal: [2, 2.4], Hard: [1.7, 2.1], Harder: [1.5, 1.9], Insane: [1.3, 1.6], Demon: [1.1, 1.4] }, gateCut: 1, clear: { Easy: 30, Normal: 24, Hard: 18, Harder: 14, Insane: 10, Demon: 8 } },
  wave: { half: 8, win: 0.5, rooms: { Easy: [1.3, 1.6], Normal: [1.1, 1.4], Hard: [0.9, 1.2], Harder: [0.8, 1.1], Insane: [0.7, 0.9], Demon: [0.6, 0.8] }, gateCut: 0.4, clear: { Easy: 24, Normal: 18, Hard: 14, Harder: 10, Insane: 8, Demon: 6 } },
};
// ship: a hold per press (held 25-80% of the gap to the next); wave: a toggle per input (press = up, release = down)
// The ship is steered: each hold's length is the one (of 0.05-0.6 s) that brings the ship nearest a height drawn for
// that leg (rows 2-7), played in the open band -- a free hold length mostly flew it into the band's roof. The wave's
// legs are 45 degrees, so its toggle times alone set the heights: a gap that would leave rows 1.5-8 is shortened.
function yAt(mode, ev, tick) {
  const { r } = play(mode, [], 60, ev), t = entry(mode).tick + tick, q = r.path.find(q => q.tick >= t) || r.path[r.path.length - 1];
  return { y: q.y, dead: r.path.some(q => q.dead && q.tick <= t) };
}
function flyEvents(mode, r, n) {
  const ts = rhythm(r, n, mode === "wave" ? 2 : 3, mode === "wave" ? 5 : 7), ev = [];
  if (mode === "ship") ts.forEach((t, k) => {
    const next = ts[k + 1] ?? t + 0.45, want = (1.5 + r() * 4) * B + 15;
    let best = null;
    for (let hold = 0.05; hold <= Math.min(0.6, next - t - 0.05) + 1e-9; hold += 0.05) {
      const e2 = ev.concat([{ tick: T(t), type: "press" }, { tick: T(t + hold), type: "release" }]), a = yAt(mode, e2, T(next)), m = yAt(mode, e2, T((t + next) / 2));
      if (a.dead || m.dead) continue;
      const d = Math.abs(a.y - want) + Math.abs(m.y - want) / 2;
      if (!best || d < best.d) best = { d, hold };
    }
    const hold = best ? +best.hold.toFixed(2) : 0.1;
    ev.push({ tick: T(t), type: "press" }, { tick: T(t + hold), type: "release" });
  });
  else {
    // wave: up 1 row per column (10.4 columns a second): keep each leg inside rows 1.5-8
    let y = 0.5, up = false, t = ts[0];
    const out = [ts[0]];
    for (let k = 1; k < n + (n % 2); k++) {
      up = !up;
      let gap = (ts[k] ?? t + 0.3) - t;
      const room = up ? 8 - y : y - 1.5, maxGap = Math.max(0.15, room / 10.4);
      gap = Math.min(gap, Math.floor(maxGap * 10) / 10 || 0.1);
      y += (up ? 1 : -1) * gap * 10.4; t += gap; out.push(+t.toFixed(2));
    }
    out.forEach((tt, k) => ev.push({ tick: T(tt), type: k % 2 ? "release" : "press" }));
  }
  return { ev, last: Math.max(...ev.map(e => e.tick)) / TPS };
}
function genFly(mode, r, tier) {
  const GD = GDlib(), M = FLY[mode], n = (2 + Math.floor(r() * 5)) * (mode === "wave" ? 2 : 1);   // wave: n toggles = n/2 presses
  const { ev, last } = flyEvents(mode, r, n);
  const W = Math.ceil((last + 0.35 + r() * 0.3) * 311.6 / B);
  // the path in the open band (nothing built yet)
  const open = play(mode, [], W, ev);
  const ys = open.r.path.filter(q => q.x >= open.h.s0 * B && q.x <= (open.h.s0 + W) * B).map(q => q.y);
  if (!ys.length || open.r.path.some(q => q.dead && q.x < (open.h.s0 + W) * B)) return { why: "dies in the open band" };
  const [rl, rh] = M.rooms[tier], room = rl + r() * (rh - rl);
  if (Math.max(...ys) + M.half + room * B > 300 - 2) return { why: "too high for its room" };
  // gates: where the path turns (local extremes of the edge profile), at Normal and up, 1-2 of them
  const pc = pathCols(open.r, open.h.s0, W, M.win || 1), mid = pc.lo.map((v, e) => (v + pc.hi[e]) / 2), gates = new Set();
  if (tier !== "Easy") for (let e = 2; e < W - 2; e++) if ((mid[e] > mid[e - 2] + 20 && mid[e] > mid[e + 2] + 20) || (mid[e] < mid[e - 2] - 20 && mid[e] < mid[e + 2] - 20)) { if (r() < 0.6) gates.add(e); }
  const wrap = pickOf(r, ["corridor", "corridor", "corridor", "corridor", "floor"]);
  const o = { half: M.half, win: M.win || 1, room, gates, gateCut: M.gateCut, floor: true, roof: wrap === "corridor", clear: M.clear[tier], floorFrom: 0 };
  const P = profile(open.r, open.h.s0, W, o);
  const base = walls(P, W, o);
  let { h, r: run } = play(mode, base, W, ev);
  if (!clears(h, run)) return { why: "the walls kill the planned path: " + (run.why || "?") };
  const spikes = keepIfClears(mode, base, wallSpikes(P, W, o), W, ev);
  const objects = base.concat(spikes);
  return { mode, tier, objects, width: W, events: ev, args: { room: +room.toFixed(2), gates: gates.size, wrap, n } };
}

// ---------------------------------------------------------------- ball: a platform where the ball goes after each press
// The ball runs on the band floor at entry. Each press flips it; it lands on a platform (roof side after an odd press,
// floor side after an even one) that the generator puts where the flight ends, at a height from the rhythm; the
// platform runs to just past the next press. Under it: a pit (spikes on the ground) when the ball is over it.
function genBall(r, tier) {
  const n = 2 + Math.floor(r() * 5), ts = rhythm(r, n, 3, 7), ev = [];
  ts.forEach(t => ev.push({ tick: T(t), type: "press" }, { tick: T(t) + 12, type: "release" }));
  const last = ts[ts.length - 1], W = Math.ceil((last + 0.55) * 311.6 / B);
  const objs = [];
  // ball band: rows 0..9 (portal at row 1, as fly-path's band); platforms: floor side rows 0-3 (top), roof side rows 5-9 (face)
  let side = 1;   // 1 = on a floor, -1 = on a roof
  const lastRow = { floor: null, roof: null }, BR = Math.round(entry("ball").state.ceilY / B);   // the ball's band: rows 0..BR-1 (8 at a portal on row 1)
  for (let k = 0; k < n; k++) {
    side = -side;
    const t0 = ts[k], t1 = ts[k + 1] ?? last + 0.5;
    // the platform on the side it goes to: a roof face at row 5-8, or a floor top at row 1-3; it starts where the ball
    // would land and lasts to 2 columns past the next press (found by playing the presses so far over a long platform)
    // a ball that does not flip must not be caught by its side's next platform (the solver's way round with fewer
    // presses): floor tops never step down and roof faces never step up from one platform of that side to the next
    let row = side < 0 ? BR - 3 + Math.floor(r() * 2) : 1 + Math.floor(r() * 2);
    if (side > 0 && lastRow.floor != null) row = Math.max(row, lastRow.floor);
    if (side < 0 && lastRow.roof != null) row = Math.min(row, lastRow.roof);
    if (side > 0) lastRow.floor = row; else lastRow.roof = row;
    const c0 = Math.floor(t0 * 311.6 / B) + 1, c1 = Math.min(W - 1, Math.ceil(t1 * 311.6 / B) + 1);
    const trial = objs.slice();
    for (let c = c0; c <= c1; c++) side < 0 ? trial.push(["block", c, row]) : trial.push(["block", c, row - 1]);
    const { h, r: run } = play("ball", trial, W, ev.slice(0, 2 * (k + 1)));
    // where it landed: the first grounded state after the press
    const pt = entry("ball").tick + T(t0) + 2;
    const land = run.path.find(q => q.tick > pt && q.grounded && q.grav === (side < 0 ? -1 : 1));
    if (!land) return { why: `press ${k + 1}: no landing on its platform` };
    const lc = Math.floor((land.x - h.s0 * B) / B);
    for (let c = Math.max(c0, lc - 1); c <= c1; c++) side < 0 ? objs.push(["block", c, row]) : objs.push(["block", c, row - 1]);
  }
  // a floor under the last platform side to the end (the exit: back on the band floor or roof)
  let { h, r: run } = play("ball", objs, W, ev);
  if (!clears(h, run)) return { why: "the platforms kill the planned path: " + (run.why || "?") };
  // pits: spikes on the ground wherever the ball is 2+ blocks above it, and hanging spikes under the band roof where it
  // is 2+ blocks below it -- kept if the presses still clear
  const pc = pathCols(run, h.s0, W), cand = [];
  const occ = new Set(objs.map(o => o[1] + ":" + o[2]));
  for (let c = 1; c < W - 1; c++) {
    if (!occ.has(c + ":0") && Math.min(pc.lo[c], pc.lo[c + 1]) > 15 + 21 + 18) cand.push(["spike", c, 0]);
    if (!occ.has(c + ":" + (BR - 1)) && Math.max(pc.hi[c], pc.hi[c + 1]) < BR * B - 15 - 21 - 18) cand.push(["spike", c, BR - 1, { rot: 180 }]);
  }
  const spikes = keepIfClears("ball", objs, cand, W, ev);
  return { mode: "ball", tier, objects: objs.concat(spikes), width: W, events: ev, args: { n } };
}

// ---------------------------------------------------------------- ufo: flaps between ledges over a pit
// Steered like the ship: each flap's time (on the 0.1 s grid, 0.2-0.6 s after the last) is the one that keeps the ufo
// nearest a height drawn for that hop (rows 1.5-4.5). Under each flap's low point a short ledge (2-3 columns) at the
// height the ufo is at, so it hops from ledge to ledge; the floor between is a pit of spikes; the band roof stays far
// (Evgeni on a ufo piece: "in rather wide areas, you can have way less of timings" -- no hanging spikes near the path).
function genUfo(r, tier) {
  const n = 2 + Math.floor(r() * 5), ev = [], taps = [], pull = 3 + Math.floor(r() * 3);
  let t = 0.15 + 0.1 * Math.floor(r() * 2);
  for (let k = 0; k < n; k++) {
    const want = (1.5 + r() * 3) * B + 15;
    let best = null;
    for (let g = 2; g <= 6; g++) {
      const tt = k ? +(t + 0.1 * g).toFixed(2) : t, e2 = ev.concat([{ tick: T(tt), type: "press" }, { tick: T(tt) + 12, type: "release" }]);
      const a = yAt("ufo", e2, T(tt + 0.3)), m = yAt("ufo", e2, T(tt + 0.15));
      if (a.dead || m.dead) continue;
      const d = Math.abs(a.y - want) + Math.abs(m.y - want) / 2 + 8 * Math.abs(g - pull);   // a mild pull to 0.4 s (2.5 cps)
      if (!best || d < best.d) best = { d, tt };
      if (!k) break;
    }
    if (!best) return { why: "no flap keeps it in the band" };
    t = best.tt; taps.push(t); ev.push({ tick: T(t), type: "press" }, { tick: T(t) + 12, type: "release" });
  }
  const W = Math.ceil((t + 0.45) * 311.6 / B);
  const open = play("ufo", [], W, ev);
  if (open.r.path.some(q => q.dead && q.x < (open.h.s0 + W) * B)) return { why: "dies in the open band" };
  const e0 = entry("ufo").tick, objs = [], ledgeCols = new Set();
  for (const tt of taps) {
    const q = open.r.path.find(q => q.tick >= e0 + T(tt)); if (!q) continue;
    const c = Math.floor((q.x - open.h.s0 * B) / B), top = Math.floor((q.y - 15 + 3) / B);   // the ledge's top row under the ufo
    if (top < 1) continue;
    const w = 2 + Math.floor(r() * 2);
    for (let cc = c - w + 1; cc <= c; cc++) if (cc >= 0 && !ledgeCols.has(cc)) { ledgeCols.add(cc); objs.push(["block", cc, top - 1]); for (let k = 0; k < top - 1; k++) objs.push(["block", cc, k]); }   // a pillar from the ground
  }
  let { h, r: run } = play("ufo", objs, W, ev);
  if (!clears(h, run)) return { why: "the ledges kill the planned path: " + (run.why || "?") };
  const P2 = pathCols(run, h.s0, W), occ = new Set(objs.map(o => o[1] + ":" + o[2])), cand = [];
  const clear = FLY.ship.clear[tier];
  for (let c = 1; c < W - 1; c++) {
    // pit spikes on the ground, and a spike on a ledge's top where the ufo passes high over it
    const lo = Math.min(P2.lo[c], P2.lo[c + 1]);
    if (!occ.has(c + ":0") && lo - 13 - 21 >= clear) cand.push(["spike", c, 0]);
    const ledge = objs.find(o => o[1] === c);
    if (ledge && lo - 13 - ((ledge[2] + 1) * B + 21) >= clear + 15 && r() < 0.5) cand.push(["spike", c, ledge[2] + 1]);
  }
  const spikes = keepIfClears("ufo", objs, cand, W, ev);
  return { mode: "ufo", tier, objects: objs.concat(spikes), width: W, events: ev, args: { n } };
}

const GEN = { ship: (r, t) => genFly("ship", r, t), wave: (r, t) => genFly("wave", r, t), ball: genBall, ufo: genUfo };

// ---------------------------------------------------------------- verify
function verify(b) {
  const GD = GDlib(), { h, r } = play(b.mode, b.objects, b.width, b.events);
  if (!clears(h, r)) return { ok: false, why: "the planned presses die: " + (r.why || "?") };
  // robust to where it is entered: the whole plan a few ticks early or late (a level enters the brick at another sub-tick
  // phase than the test does -- the first ship lab died in a brick that cleared alone) must still clear
  for (const d of [-3, -2, -1, 1, 2, 3]) {
    const rr = GD.run(h.w, absEvents(b.mode, b.events.map(e => ({ tick: e.tick + d, type: e.type }))));
    if (rr.path.some(q => q.dead && q.x < (h.s1 + 3) * B)) return { ok: false, why: `fragile: the plan ${d > 0 ? "+" : ""}${d} ticks dies` };
  }
  // it asks for input: with no press the player dies in it
  const none = GD.run(h.w, []);
  if (!none.path.some(q => q.dead && q.x < (h.s1 + 1) * B)) return { ok: false, why: "cleared with no press at all" };
  // windows of the planned inputs inside the brick (the player's window, later inputs re-planned)
  const ev = absEvents(b.mode, b.events), x0 = h.s0 * B, x1 = h.s1 * B;
  let wins = [];
  try {
    wins = GD.inputWindows(h.w, ev, r.path, {}).map(x => ({ tick: x.tick, type: x.type, ms: Math.round((x.hi - x.lo + 1) / TPS * 1000), open: x.open }));
  } catch (e) { return { ok: false, why: "windows: " + e.message }; }
  const inside = wins.filter(w => { const q = r.path[w.tick]; return q && q.x >= x0 - 45 && q.x <= x1 + 30; });
  const minMs = inside.length ? Math.min(...inside.map(w => w.ms)) : null;
  // no secret way for the tap modes (Evgeni on the catalogue: "secret way within the structures unnatural"):
  //  - skip: leave out one planned press -- still clears = the brick has a way with fewer clicks;
  //  - extra: one stray tap at least 0.25 s from every planned press (so not just an early / late press), the planned
  //    presses kept -- still clears = a second route through it.
  let secret = 0, skip = 0, stray = 0;   // skip: a planned press left out still clears; stray: an extra tap still clears
  const xa = (h.exitCol != null ? h.exitCol + 3 : h.s1 + 6) * B;   // through the test's exit portals: a ball left floating dies after the brick
  const alive = rr => !rr.path.some(q => q.dead && q.x < xa) && rr.path[rr.path.length - 1].x >= xa;
  // wave: leave out one press with its release (one up-leg) -- still clears = the corridor can be slid or held through
  // with fewer inputs (the structures check's human route flew g-wave-hard-1 with 1 press where 2 were planned)
  if (b.mode === "wave") {
    const e2 = ev.slice().sort((a, c) => a.tick - c.tick);
    for (let i = 0; i < e2.length; i++) if (e2[i].type === "press") {
      const j = e2.findIndex((x, k) => k > i && x.type === "release");
      if (alive(GD.run(h.w, e2.filter((x, k) => k !== i && k !== j)))) secret++;
    }
  }
  if (b.mode === "ball" || b.mode === "ufo") {
    const presses = ev.filter(e => e.type === "press").map(e => e.tick), t0 = entry(b.mode).tick, tEnd = r.path.find(q => q.x >= x1).tick;
    for (const p of presses) if (alive(GD.run(h.w, ev.filter(e => !(e.tick >= p && e.tick <= p + 12))))) { secret++; skip++; }
    // (ufo: an extra flap in open air is the mode's freedom, like a ship's; only the skip counts)
    if (b.mode === "ball") for (let t = t0 + 12; t < Math.min(tEnd - 24, presses[presses.length - 1]); t += 12) {   // after the last press the next brick decides
      if (presses.some(p => Math.abs(p - t) < 0.25 * TPS)) continue;
      const ev2 = ev.concat([{ tick: t, type: "press" }, { tick: t + 10, type: "release" }]).sort((a, c) => a.tick - c.tick);
      if (alive(GD.run(h.w, ev2))) { secret++; stray++; }
    }
  }
  const pr = b.events.filter(e => e.type === "press" || b.mode === "wave"), secs = (Math.max(...r.path.filter(q => q.x <= x1).map(q => q.tick)) - entry(b.mode).tick) / TPS;
  return { ok: true, minMs, windows: inside.map(w => w.ms), presses: b.events.filter(e => e.type === "press").length, secs: +secs.toFixed(2), cps: +(pr.length / Math.max(0.3, secs)).toFixed(2), secret, skip, stray, h, r };
}

// the solver's fewest presses inside the brick (lib/physics.js solve on the test level), null when it finds none
function fewest(b) {
  const GD = GDlib(), h = harness(b.mode, b.objects, b.width), sol = GD.solve(h.w, { maxStates: 400000 });
  if (!sol.ok) return null;
  const x0 = h.s0 * B - 45, x1 = h.s1 * B + 30;
  return sol.clicks.filter(c => c.type === "press" && c.x >= x0 && c.x <= x1).length;
}

// ---------------------------------------------------------------- the judge: against the official bricks
let FAMS = null, TIERS = null, VOTES = null;
function refs() {
  if (!FAMS) {
    const L = JSON.parse(fs.readFileSync(path.join(ROOT, "knowledge", "lego.json"), "utf8"));
    FAMS = new Map(L.families.map(f => [f.sig, f]));
    FAMS.byMode = {}; for (const f of L.families) { const m = f.mode; FAMS.byMode[m] = (FAMS.byMode[m] || 0) + (f.n.official || 0); }
    try { TIERS = JSON.parse(fs.readFileSync(path.join(ROOT, "knowledge", "brick_tiers.json"), "utf8")).tiers; } catch (e) { TIERS = {}; }
    try { VOTES = require("./lego.js").sigWeights(require("./lego.js").readVotes()); } catch (e) { VOTES = {}; }
  }
  return { FAMS, TIERS, VOTES };
}
// inside [p10, p90] = 1, falling to 0 at twice the span outside
const inBand = (v, band) => {
  if (v == null || !band) return 0.5;
  const [lo, , hi] = band, span = Math.max(1e-6, hi - lo);
  if (v >= lo && v <= hi) return 1;
  const d = v < lo ? lo - v : v - hi; return Math.max(0, 1 - d / (2 * span));
};
function judge(b, v) {
  const GD = GDlib(), lego = require("./lego.js"), { FAMS, VOTES } = refs();
  const { h, r } = v, p = r.path, x0 = h.s0 * B, x1 = h.s1 * B;
  const i0 = p.findIndex(q => q.x >= x0), i1 = Math.max(i0 + 1, p.findIndex(q => q.x >= x1) - 1);
  const ev = absEvents(b.mode, b.events);
  const P = lego.measure({ src: "gen", name: "brickgen" }, h.w, r, lego.heldAt(ev), i0, i1);
  const fam = FAMS.get(P.sig), nOff = fam ? fam.n.official || 0 : 0, modeOff = FAMS.byMode[b.mode] || 1;
  // how common this kind is in RobTop's levels (share of the mode's official bricks; 15%+ = full marks)
  const common = Math.min(1, nOff / modeOff / 0.15);
  // its numbers inside the official spread of the same kind
  const fit = fam && nOff >= 3 ? (inBand(P.s, fam.seconds) + inBand(P.presses, fam.presses) + inBand(P.yRange, fam.yRange) + inBand(P.hzPer100, fam.hazardsPer100) + (fam.gap ? inBand(P.gap, fam.gap) : 1)) / 5 : 0.2;
  // the tier: tightest window at or over the tier's official p10 and not far over its median x 1.5 (too loose = too easy)
  const tw = TIER_WIN[b.tier] || 120, med = { Easy: 221, Normal: 238, Hard: 221, Harder: 208, Insane: 200, Demon: 179 }[b.tier] || 200;
  const tierFit = v.minMs == null ? 0.3 : v.minMs < tw * 0.8 ? 0 : v.minMs < tw ? 0.5 : v.minMs <= med * 1.6 ? 1 : Math.max(0.4, 1 - (v.minMs - med * 1.6) / 400);
  // clicks per second near the official 1.8-2.2 (wave counts toggles)
  const cpsFit = inBand(v.cps, b.mode === "wave" ? [1.6, 3, 5] : [1.4, 2, 2.8]);
  const smooth = P.smooth === false ? 0.5 : 1, secret = v.secret ? Math.max(0, 1 - v.secret / 3) : 1;
  const vote = VOTES && VOTES[P.sig] ? VOTES[P.sig].weight : 1;
  const score = Math.round(100 * (0.3 * common + 0.3 * fit + 0.2 * tierFit + 0.2 * cpsFit) * smooth * secret * Math.min(1.2, Math.max(0.5, vote)));
  return { score, sig: P.sig, common: +common.toFixed(2), fit: +fit.toFixed(2), tierFit: +tierFit.toFixed(2), cpsFit: +cpsFit.toFixed(2), officialOfKind: nOff,
    yRange: P.yRange, hzPer100: P.hzPer100, gap: P.gap ?? null, gates: P.gates ?? null, spiky: P.spiky ?? null, smooth: P.smooth ?? null, wrap: P.wrap, pathKind: P.pathKind || null };
}

// ---------------------------------------------------------------- distinctness: the column profile of solids and hazards
function shapeKey(b) {
  const cols = {}; for (const [t, c, r] of b.objects) { const k = cols[c] || (cols[c] = { s: [], h: [] }); (t === "spike" ? k.h : k.s).push(r); }
  return Array.from({ length: b.width }, (_, c) => { const k = cols[c] || { s: [], h: [] }; return [k.s.length ? Math.max(...k.s.filter(r => r < 5), -1) : -1, k.s.length ? Math.min(...k.s.filter(r => r >= 5), 10) : 10, k.h.length]; });
}
function distance(A, Bk) {
  const n = Math.max(A.length, Bk.length); let d = 0;
  for (let c = 0; c < n; c++) { const a = A[c] || [-1, 10, 0], b = Bk[c] || [-1, 10, 0]; d += Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + 0.5 * Math.abs(a[2] - b[2]); }
  return d / n;
}

// ---------------------------------------------------------------- commands
function load() { try { return JSON.parse(fs.readFileSync(OUT, "utf8")); } catch (e) { return { bricks: [] }; } }
function gen(opts) {
  const modes = opts.modes, out = load(), keepOld = out.bricks.filter(b => !modes.includes(b.mode) || (opts.tiers && !opts.tiers.includes(b.tier)));
  const kept = [];
  for (const mode of modes) for (const tier of opts.tiers) {
    const r = rng((opts.seed || 1) * 7919 + mode.length * 131 + TIER_ORDER.indexOf(tier)), t0 = Date.now(), why = {};
    const good = [];
    for (let i = 0; i < opts.n; i++) {
      let b; try { b = GEN[mode](r, tier); } catch (e) { b = { why: "error: " + e.message }; }
      if (b.why) { const k = b.why.replace(/:.*/, ""); why[k] = (why[k] || 0) + 1; continue; }
      const v = verify(b);
      if (!v.ok) { const k = v.why.replace(/:.*/, ""); why[k] = (why[k] || 0) + 1; continue; }
      if (v.secret) { why["a secret way (fewer inputs or a stray tap clears it)"] = (why["a secret way (fewer inputs or a stray tap clears it)"] || 0) + 1; continue; }
      const j = judge(b, v);
      good.push(Object.assign(b, { verify: { minMs: v.minMs, windows: v.windows, presses: v.presses, secs: v.secs, cps: v.cps, secret: v.secret }, judge: j, key: shapeKey(b) }));
    }
    good.sort((a, b) => b.judge.score - a.judge.score);
    const mine = [];
    let solved = 0, secretSolve = 0;
    for (const b of good) {
      if (mine.length >= opts.keep) break;
      if (mine.some(m => m.judge.sig === b.judge.sig && distance(m.key, b.key) < 0.8)) continue;
      // the solver's fewest presses through it (tap modes): fewer than planned = a secret way (g-ball-normal-1 of the
      // first batch: planned 4, the solver 1). The press count inside the brick, from the same test level.
      if (/^(ball|ufo|cube|robot|spider)$/.test(mode)) {   // (wave: GD.solve's clicks are toggles, not presses: the wave gets the skip check in verify instead)
        const f = fewest(b); solved++;
        b.verify.solverPresses = f;
        if (f != null && f < b.verify.presses) { secretSolve++; continue; }
      }
      mine.push(b);
    }
    if (solved) console.log(`   solver: ${solved} solved, ${secretSolve} left out (the solver got through with fewer presses)`);
    console.log(`${mode} ${tier}: ${opts.n} tried, ${good.length} verified, ${mine.length} kept (${((Date.now() - t0) / 1000).toFixed(0)} s); dropped: ${Object.entries(why).map(([k, v]) => k + " " + v).join(", ") || "none"}`);
    const sigs = {}; for (const b of mine) sigs[b.judge.sig] = (sigs[b.judge.sig] || 0) + 1;
    console.log("   kinds: " + Object.entries(sigs).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} x${v}`).join("; "));
    mine.forEach((b, k) => { b.id = `g-${mode}-${tier.toLowerCase()}-${k + 1}`; delete b.key; });
    kept.push(...mine);
  }
  const all = keepOld.concat(kept);
  fs.writeFileSync(OUT, JSON.stringify({ made: new Date().toISOString(), note: "BRICKGEN.md: our own bricks, generated presses-first and judged against the official bricks (knowledge/lego.json families). objects are structure-relative [type, col, row, extra]; events are ticks from the brick's entry (the structures.js test harness).", bricks: all.map(compact) }, null, 0).replace(/\{"id"/g, "\n{\"id\""));
  console.log(`-> ${path.relative(ROOT, OUT)}: ${all.length} bricks`);
  return kept;
}
const compact = b => ({ id: b.id, mode: b.mode, tier: b.tier, width: b.width, args: b.args, verify: b.verify, judge: b.judge, events: b.events, objects: b.objects });

function textmap(b) {
  const rows = [];
  const grid = Array.from({ length: 10 }, () => Array(b.width).fill("."));
  for (const [t, c, r, e] of b.objects) { if (r < 0 || r > 9 || c < 0 || c >= b.width) continue; grid[r][c] = t === "block" ? "#" : t === "slope" ? (e && e.flipY ? (e.flipX ? "\\" : "/") : (e && e.flipX ? "\\" : "/")) : t === "spike" ? (e && e.rot ? "v" : "^") : "?"; }
  const v = play(b.mode, b.objects, b.width, b.events);
  for (const q of v.r.path) { const c = Math.floor((q.x - v.h.s0 * B) / B), rr = Math.floor(q.y / B); if (c >= 0 && c < b.width && rr >= 0 && rr < 10 && grid[rr][c] === ".") grid[rr][c] = "o"; }
  for (let r = 9; r >= 0; r--) rows.push(String(r).padStart(2) + " " + grid[r].join(""));
  return rows.join("\n");
}
function testLevel(b) {
  const S = require("./structures.js"), { build } = require("./make.js");
  const st = S.byId(b.id) || { id: b.id, needs: { mode: b.mode, grav: 1, mini: false, speed: "1x" }, leaves: { mode: b.mode, grav: 1, mini: false, speed: "1x" }, args: {}, build: () => ({ objects: b.objects, width: b.width }) };
  const t = S.testSpec(st, {});
  t.spec.name = "GDLM brick " + b.id;
  const log = console.log; console.log = () => {};
  try { return build(t.spec, b.id).level; } finally { console.log = log; }
}

// structures.js registers every kept brick as a structure (so check / rank / page / brickpick see it)
function asStructures() {
  return load().bricks.map(b => ({ id: b.id, mode: b.mode, tier: b.tier, tags: [b.mode, "generated", b.judge.sig.split(" / ")[2] || ""].filter(Boolean),
    doc: `generated ${b.mode} brick (${b.judge.sig}), ${b.verify.presses} presses, tightest ${b.verify.minMs} ms, judge ${b.judge.score}`,
    objects: b.objects, width: b.width }));
}

// every kept brick of a mode in a row -> specs/lab_brickgen_<mode>.json, built by make.js into levels/gdlm_lab_brickgen_<mode>
// .gdlvl (the viewer's lab tab): the cube runs in, the mode portal, the standard lead-in, then each brick with 5 open columns
// after it, a wall of cube portals, the outro and the signature (every level we make ends with them). The bricks' planned
// presses are the solve's seeds (tools/seedsolve.js), so only the joins are searched.
function lab(mode, bricks) {
  const V = 311.58, e = entry(mode), objs = [], seeds = [];
  const MODE_PORTAL = { ship: "ship portal", ball: "ball portal", ufo: "ufo portal", wave: "wave portal", robot: "robot portal", spider: "spider portal", swing: "swing portal" };
  const LEADIN = e.s0 - 8 - 1;   // the test level's lead-in after its portal (structures.js LEADIN)
  // each brick in its own copy of the test context (mode portal, lead-in, brick, a wall of cube portals 4 on, 14 blocks of
  // cube): the bricks are judged alone, so the lab replays each one exactly as it was verified -- joining them is the
  // picker's job (BRICKGEN.md "Open")
  let base = 8;
  const order = bricks.slice().sort((a, b) => b.judge.score - a.judge.score);
  for (const b of order) {
    objs.push([MODE_PORTAL[mode], base, 1]);
    const col = base + 1 + LEADIN;
    objs.push(["pattern", "s:" + b.id, col, 0, { raw: true }]);   // raw: the body only (the pattern would add its own portal, lead-in and exit wall)
    const dt = (col - e.s0) * B / V, ev = b.events.slice().sort((a, c) => a.tick - c.tick);
    for (let i = 0; i < ev.length; i++) if (ev[i].type === "press") {
      const rel = ev.slice(i + 1).find(x => x.type === "release"), t = (e.tick + ev[i].tick) / TPS + dt;
      seeds.push({ t: +t.toFixed(4), hold: rel ? +((rel.tick - ev[i].tick) / TPS).toFixed(4) : 0.02 });
    }
    const ex = col + b.width + 4;
    for (const rr of [1, 4, 7]) objs.push(["cube portal", ex, rr]);
    objs.push(["block", ex, 9]);
    base = ex + 14;   // the cube lands from the exit portal wall before the next portal
  }
  const spec = { name: `GDLM lab brickgen ${mode}`, description: `Generated ${mode} bricks (tools/brickgen.js), best first`, speed: "1x", style: "classic", indicators: false,
    objects: objs, seedPresses: seeds, outro: 1 };
  const f = path.join(ROOT, "specs", `lab_brickgen_${mode}.json`);
  fs.writeFileSync(f, JSON.stringify(spec, null, 1));
  console.log(`-> ${path.relative(ROOT, f)}: ${order.length} bricks, ${seeds.length} seeded presses; build: node tools/make.js ${path.relative(ROOT, f)}`);
  return f;
}

module.exports = { fewest, keepIfClears, harness, absEvents, lab, gen, verify, judge, load, asStructures, textmap, testLevel, GEN, play, entry };

if (require.main === module) {
  const argv = process.argv.slice(2), cmd = argv[0], arg = k => { const i = argv.indexOf("--" + k); return i >= 0 ? argv[i + 1] : null; };
  if (cmd === "gen") {
    gen({ modes: (arg("mode") || "ship,wave,ball,ufo").split(","), tiers: (arg("tier") || "Normal").split(","), n: +(arg("n") || 400), keep: +(arg("keep") || 25), seed: +(arg("seed") || 1) });
  } else if (cmd === "list") {
    const m = arg("mode");
    for (const b of load().bricks.filter(b => !m || b.mode === m)) console.log(`${b.id.padEnd(24)} ${String(b.judge.score).padStart(3)}  ${b.verify.presses} presses ${b.verify.secs} s ${b.verify.cps} cps, tightest ${b.verify.minMs} ms  ${b.judge.sig}  (official of kind ${b.judge.officialOfKind}, fit ${b.judge.fit})`);
  } else if (cmd === "show") {
    const b = load().bricks.find(b => b.id === argv[1]); if (!b) { console.log("no brick " + argv[1]); process.exit(1); }
    console.log(JSON.stringify({ id: b.id, mode: b.mode, tier: b.tier, args: b.args, verify: b.verify, judge: b.judge }, null, 1));
    console.log(textmap(b));
  } else if (cmd === "build" || cmd === "lab") {
    const { writeGdlvl } = require("./io.js");
    const list = cmd === "build" ? load().bricks.filter(b => b.id === argv[1]) : load().bricks.filter(b => !arg("mode") || b.mode === arg("mode"));
    if (cmd === "build") { const b = list[0]; if (!b) { console.log("no brick " + argv[1]); process.exit(1); }
      const f = path.join(ROOT, "local", "structures", b.id + ".gdlvl"); fs.mkdirSync(path.dirname(f), { recursive: true });
      writeGdlvl(f, "GDLM brick " + b.id, testLevel(b)); console.log("-> " + path.relative(ROOT, f)); }
    else for (const mode of [...new Set(list.map(b => b.mode))]) lab(mode, list.filter(b => b.mode === mode));
  } else console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).slice(0, 7).join("\n"));
}
