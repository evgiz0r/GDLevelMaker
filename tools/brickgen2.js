// node tools/brickgen2.js gen --mode ball [--n 300] [--keep 20] [--seed 1]  |  list [--mode ball]  |  show <id>  |  lab [--mode ball]
//   -- generated bricks, round 2: MOVE SEQUENCES (BRICKGEN.md "Round 2"). Evgeni on round 1 ("all to the garbage"): one idea
//      per mode, flat, "no height variance, no orbs, no pads, no gameplay in the middle, no small movements". So a brick is
//      now a chain of 3-7 MOVES, each placed by the sim where the player really is: a flip onto a platform at a new height, a
//      drop off a ledge onto a lower one (no click), a pad bounce, a blue pad (a flip with no click), a yellow orb or a blue
//      orb caught in the air. Hazards fill the pits after. Every brick is verified as before (tools/brickgen.js verify: the
//      plan clears, entered a few ticks early or late too; no click = death; no secret way -- skip, stray tap, the solver's
//      fewest presses) and then GATED ON MOVEMENT (tools/movestudy.js): its path's numbers must sit inside the official
//      bricks' p10-p90 on all but 2 of the 11 axes, and the kept SET is picked for distance (each next brick the one farthest
//      from those already kept), until its variety reaches the official set's (knowledge/move_study.json).
//   nearest [--pieces <local pieces.json>]: each brick's closest official brick by movement (level + column).
//   -> knowledge/brickgen2.json; lab: specs/lab_brickgen2_<mode>.json -> levels/gdlm_lab_brickgen2_<mode>.gdlvl (viewer).
"use strict";
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
const fs = require("fs"), path = require("path");
const G = require("./brickgen.js"), MS = require("./movestudy.js");
const ROOT = path.join(__dirname, ".."), OUT = path.join(ROOT, "knowledge", "brickgen2.json");
const B = 30, TPS = 240, V = 311.58;
const T = s => Math.round(s * TPS);
function rng(seed) { let s = (seed >>> 0) || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const pick = (r, a) => a[Math.floor(r() * a.length)];
const rint = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));

// ---------------------------------------------------------------- ball
// Surfaces: {side: 1, row: k} = a floor whose top is at row k (k 0 = the ground: no blocks); {side: -1, row: k} = a roof
// whose face is at row k (k = BR, the ball band's ceiling: no blocks). A platform is a surface over columns c0..c1.
const BALL_MOVES = ["flip", "flip", "drop", "drop", "pad", "bluepad", "orb", "blueorb"], PRESS_MOVES = ["flip", "orb", "blueorb"];
function ballCtx() { const e = G.entry("ball"); return { e, BR: Math.round(e.state.ceilY / B) }; }
function renderBall(plats, mechs, BR, Wmax) {
  const o = [];
  for (const p of plats) {
    const c1 = Math.min(p.c1, Wmax);
    if (p.side > 0 && p.row > 0) for (let c = Math.max(0, p.c0); c <= c1; c++) o.push(["block", c, p.row - 1]);
    if (p.side < 0 && p.row < BR) for (let c = Math.max(0, p.c0); c <= c1; c++) o.push(["block", c, p.row]);
  }
  return o.concat(mechs);
}
const surfY = s => s.side > 0 ? s.row * B + 15 : s.row * B - 15;   // the ball's centre resting on it
function genBall(r, tier) {
  const { e, BR } = ballCtx(), WMAX = 60;
  const plats = [{ side: 1, row: 0, c0: -20, c1: Infinity }], mechs = [], ev = [], moves = [];
  let cur = plats[0], landRel = 0, yLo = 0.5, yHi = 0.5;   // the resting heights so far (ball centre, blocks)
  // a target row keeps every resting height of the brick within 4.5 blocks (official ball bricks span 1.8-5.4 blocks)
  const inSpan = (side, row) => { const y = side > 0 ? row + 0.5 : row - 0.5; return Math.max(yHi, y) - Math.min(yLo, y) <= 4.5; };
  const nMoves = rint(r, 2, 5);
  const run = (extra = [], evx = ev) => G.play("ball", renderBall(plats.concat(extra), mechs, BR, WMAX), WMAX, evx);
  const colAt = (h, rr, rel) => { const q = rr.path[e.tick + rel]; return q ? (q.x - h.s0 * B) / B : null; };
  // the first grounded state after `fromRel` with the target's gravity: on the target surface (else null)
  const landing = (h, rr, fromRel, tgt) => {
    let air = false;   // first it leaves the surface it is on (a drop rolls on to the ledge's end), then the landing
    for (let t = e.tick + fromRel + 1; t < rr.path.length; t++) {
      const q = rr.path[t]; if (q.dead) return null;
      if (!q.grounded) { air = true; continue; }
      if (!air) { if (t > e.tick + fromRel + T(0.6)) return null; continue; }
      if (q.grav === tgt.side) return Math.abs(q.y - surfY(tgt)) < 3 ? q : null;
    }
    return null;
  };
  for (let k = 0; k < nMoves + 3; k++) {
    const np = ev.length / 2;
    if (k >= nMoves && np >= 2) break;   // past the drawn number of moves only to reach 2 presses
    const flat = cur.row === 0 || cur.row === BR;   // on the ground or the band ceiling: nothing to drop off
    let tries = 0, done = false;
    while (!done && tries++ < 6) {
      const kind = pick(r, (k >= nMoves - 1 && np < 2 - (k >= nMoves ? 0 : 1) ? PRESS_MOVES : BALL_MOVES).filter(m => !(flat && m === "drop")));
      const dwell = 0.05 + 0.05 * rint(r, 0, 5), mRel = Math.max(T(0.1), landRel + T(dwell));
      const base = run();
      const cm = colAt(base.h, base.r, mRel); if (cm == null || cm > WMAX - 12) break;
      const opp = -cur.side, other = plats.filter(p => p !== cur && p.c1 >= cm);
      // rows: floors 0-4, roofs 4-BR, two rows of air at least between a floor and a roof over the same columns
      const floorRows = [0, 1, 2, 3, 4].filter(x => inSpan(1, x)), roofRows = []; for (let k2 = 3; k2 <= BR; k2++) if (inSpan(-1, k2)) roofRows.push(k2);
      const flipRows = () => opp > 0 ? floorRows.filter(x => x <= cur.row - 3 && x >= cur.row - 5) : roofRows.filter(x => x >= cur.row + 3 && x <= cur.row + 5);
      let tgt, cStart, endAt, add = [], pressRel = null;
      if (kind === "flip") {
        const rows = flipRows();
        if (!rows.length) continue;
        tgt = { side: opp, row: pick(r, rows) }; pressRel = mRel; endAt = Math.ceil(cm) + 1; cStart = Math.floor(cm) + 2;
      } else if (kind === "drop") {
        const rows = cur.side > 0 ? floorRows.filter(x => x < cur.row && x >= cur.row - 3) : roofRows.filter(x => x > cur.row && x <= cur.row + 3);
        if (!rows.length) continue;
        tgt = { side: cur.side, row: pick(r, rows) }; endAt = Math.floor(cm); cStart = endAt + 1;
      } else if (kind === "pad" || kind === "bluepad") {
        const pc = Math.round(cm) + 1, id = kind === "pad" ? "yellow pad" : "blue pad";
        add = [cur.side > 0 ? [id, pc, cur.row] : [id, pc, cur.row - 1, { flipY: true }]];
        if (kind === "pad") { const rows = (cur.side > 0 ? floorRows : roofRows).filter(x => x !== cur.row && (cur.side > 0 ? x - cur.row : cur.row - x) <= 1 && Math.abs(x - cur.row) <= 2); if (!rows.length) continue; tgt = { side: cur.side, row: pick(r, rows) }; cStart = pc + 4; }
        else { const rows = flipRows(); if (!rows.length) continue; tgt = { side: opp, row: pick(r, rows) }; cStart = pc + 2; }
        endAt = pc + 1;
      } else {   // orb / blueorb: in the air -- off a ledge's end, or rolled into on a flat
        const id = kind === "orb" ? "yellow orb" : "blue orb";
        let oc, orow, oRel;
        if (!flat) {
          const end = Math.floor(cm), save = cur.c1; cur.c1 = end;
          const fall = run(); cur.c1 = save;
          oRel = mRel + T(0.12 + 0.05 * rint(r, 0, 3));
          const q = fall.r.path[e.tick + oRel]; if (!q || q.dead || q.grounded) continue;
          oc = (q.x - fall.h.s0 * B - 15) / B; orow = (q.y - 15) / B; endAt = end;
        } else {
          oRel = mRel; const q = base.r.path[e.tick + oRel]; if (!q) continue;
          oc = (q.x - base.h.s0 * B - 15) / B; orow = (q.y - 15) / B; endAt = Math.ceil(oc) + 1;
        }
        oc = Math.round(oc * 10) / 10; orow = Math.round(orow * 10) / 10;
        add = [[id, oc, orow]]; pressRel = oRel;
        const same = cur.side, side = kind === "orb" ? same : -same;
        const rows = (side > 0 ? floorRows : roofRows).filter(x => kind === "orb" ? Math.abs(x - cur.row) <= 3 : (side > 0 ? x <= orow - 1 && x >= orow - 4 : x >= orow + 2 && x <= orow + 5));
        if (!rows.length) continue;
        tgt = { side, row: pick(r, rows) }; cStart = Math.ceil(oc) + 2;
      }
      // try: the current platform ends, the move's object and press, a long trial platform on the target
      const save = cur.c1; cur.c1 = Math.min(cur.c1, endAt);
      const tp = { side: tgt.side, row: tgt.row, c0: cStart, c1: Infinity };
      const ev2 = pressRel == null ? ev : ev.concat([{ tick: pressRel, type: "press" }, { tick: pressRel + 12, type: "release" }]);
      mechs.push(...add);
      const tr = G.play("ball", renderBall(plats.concat([tp]), mechs, BR, WMAX), WMAX, ev2);
      const land = landing(tr.h, tr.r, pressRel ?? mRel, tgt);
      // the ground / ceiling as a target: there is no platform to trim, it must land on it
      if (!land) { mechs.splice(mechs.length - add.length, add.length); cur.c1 = save; continue; }
      const lc = Math.floor((land.x - tr.h.s0 * B) / B);
      tp.c0 = Math.max(cStart, lc - 1);
      if (pressRel != null) ev.push({ tick: pressRel, type: "press" }, { tick: pressRel + 12, type: "release" });
      plats.push(tp); cur = tp; const ry = tgt.side > 0 ? tgt.row + 0.5 : tgt.row - 0.5; yLo = Math.min(yLo, ry); yHi = Math.max(yHi, ry); landRel = land.tick - e.tick; moves.push(kind); done = true;
    }
    if (!done) break;
  }
  const presses = ev.length / 2;
  if (moves.length < 2) return { why: "fewer than 2 moves placed" };
  if (presses < 2 || presses > 6) return { why: `${presses} presses (a brick has 2-6)` };
  // the end: the last platform runs 1-3 columns past the landing
  const fin = run(), lcol = colAt(fin.h, fin.r, landRel), W = Math.min(WMAX, Math.ceil(lcol) + rint(r, 1, 3));
  cur.c1 = W - 1;
  let objs = renderBall(plats, mechs, BR, W - 1);
  let { h, r: rr } = G.play("ball", objs, W, ev);
  if (rr.path.some(q => q.dead && q.x < (h.s1 + 3) * B)) return { why: "the finished brick kills the plan: " + (rr.path.find(q => q.dead) || {}).why };
  // hazards: ground spikes where the ball is 2+ blocks above, hanging spikes under the band ceiling where it is 2+ below,
  // spikes on floor platforms' tops and under roof faces where the ball is far -- kept while the plan clears
  const S = new Set(objs.map(o => o[1] + ":" + o[2])), cand = [];
  const lo = Array(W + 1).fill(Infinity), hi = Array(W + 1).fill(-Infinity);
  for (const q of rr.path) { const c = (q.x - h.s0 * B) / B; if (c < -1 || c > W + 1) continue; for (let c2 = Math.max(0, Math.floor(c - 1)); c2 <= Math.min(W, Math.ceil(c + 1)); c2++) { lo[c2] = Math.min(lo[c2], q.y); hi[c2] = Math.max(hi[c2], q.y); } }
  const occupied = (c, row) => S.has(c + ":" + row) || mechs.some(m => Math.abs(m[1] - c) < 1.5 && Math.abs(m[2] - row) < 1.5);
  for (let c = 1; c < W - 1; c++) {
    if (!occupied(c, 0) && lo[c] > 54) cand.push(["spike", c, 0]);
    if (!occupied(c, BR - 1) && hi[c] < BR * B - 54) cand.push(["spike", c, BR - 1, { rot: 180 }]);
  }
  for (const p of plats) for (let c = Math.max(1, p.c0); c <= Math.min(p.c1, W - 2); c++) {
    if (p.side > 0 && p.row > 0 && p.row < BR - 1 && !occupied(c, p.row) && (lo[c] > p.row * B + 54 || hi[c] < p.row * B - 30)) cand.push(["spike", c, p.row]);
    if (p.side < 0 && p.row < BR && p.row > 1 && !occupied(c, p.row - 1) && (hi[c] < p.row * B - 54 || lo[c] > p.row * B + 30)) cand.push(["spike", c, p.row - 1, { rot: 180 }]);
  }
  const spikes = G.keepIfClears("ball", objs, cand, W, ev);
  return { mode: "ball", tier, objects: objs.concat(spikes), width: W, events: ev, args: { moves, presses } };
}

const GEN = { ball: genBall };

// ---------------------------------------------------------------- movement: the brick's path described as tools/movestudy.js does
const MECH = new Set(["yellow orb", "blue orb", "pink orb", "red orb", "green dash orb", "yellow pad", "blue pad", "pink pad", "red pad", "spider orb", "spider pad", "gravity down", "gravity up"]);
function movement(b, v) {
  const { h, r } = v || G.play(b.mode, b.objects, b.width, b.events), x0 = h.s0 * B, x1 = h.s1 * B, t0 = (r.path.find(s => s.x >= x0) || {}).tick || 0;
  const pts = r.path.filter((s, i) => s.x >= x0 && s.x <= x1 && i % 4 === 0).map(s => [(s.x - x0) / B, s.y / B, (s.tick - t0) / TPS, 0, s.grav, 0, s.grounded ? 1 : 0]);
  return MS.describe(pts, { mech: b.objects.filter(o => MECH.has(o[0])).length });
}
let STUDY = null;
const study = () => STUDY || (STUDY = JSON.parse(fs.readFileSync(path.join(ROOT, "knowledge", "move_study.json"), "utf8")));
function officialRange(mode) { const M = study().modes[mode]; return M && M.official; }
function spread(mode) { const R = officialRange(mode), s = {}; for (const k of MS.AXES) s[k] = Math.max(0.25, R[k][2] - R[k][0]); return s; }
// the axes where a brick is outside the official p10-p90 (with a tenth of the spread as slack)
function outside(d, mode) {
  const R = officialRange(mode), sp = spread(mode), out = [];
  for (const k of MS.AXES) { const lo = R[k][0] - 0.1 * sp[k], hi = R[k][2] + 0.1 * sp[k]; if (d[k] < lo || d[k] > hi) out.push(`${k} ${d[k]} (official ${R[k][0]}-${R[k][2]})`); }
  return out;
}
const dist = (a, b, sp) => MS.AXES.reduce((s, k) => s + Math.abs((a[k] || 0) - (b[k] || 0)) / sp[k], 0) / MS.AXES.length;

// ---------------------------------------------------------------- gen: many candidates -> verified -> gated -> a varied set
function load() { try { return JSON.parse(fs.readFileSync(OUT, "utf8")); } catch (e) { return { bricks: [] }; } }
function gen(opts) {
  const out = load(), keepOld = out.bricks.filter(b => !opts.modes.includes(b.mode)), kept = [];
  for (const mode of opts.modes) {
    const r = rng((opts.seed || 1) * 7919 + mode.length * 131), t0 = Date.now(), why = {}, good = [], sp = spread(mode);
    const no = k => { k = k.replace(/:.*/, ""); why[k] = (why[k] || 0) + 1; };
    for (let i = 0; i < opts.n; i++) {
      let b; try { b = GEN[mode](r, opts.tier || "Normal"); } catch (e) { b = { why: "error: " + e.message }; }
      if (b.why) { no(b.why); continue; }
      const v = G.verify(b);
      if (!v.ok) { no(v.why); continue; }
      // a planned press left out and it still clears = a way with fewer clicks (Evgeni: a secret way is unnatural): out.
      // A stray extra tap that still clears is a looser brick, not a shortcut: counted, and the set prefers the tight ones
      if (v.skip) { no("a secret way (a planned press left out still clears)"); continue; }
      const d = movement(b, v), off = outside(d, mode);
      if (off.length > 2) { no("movement outside the official range on 3+ axes"); continue; }
      good.push(Object.assign(b, { verify: { minMs: v.minMs, windows: v.windows, presses: v.presses, secs: v.secs, cps: v.cps, stray: v.stray }, move: d, outside: off }));
    }
    // the set: start from the brick inside on most axes, then each time the one farthest from the set so far; the solver's
    // fewest presses checked as each is taken (fewer than planned = a secret way, left out)
    const mine = []; let solved = 0, secretSolve = 0;
    const pool = good.slice().sort((a, b) => a.outside.length - b.outside.length);
    while (mine.length < opts.keep && pool.length) {
      let bi = 0;
      if (mine.length) { let best = -1; pool.forEach((b, i) => { const m = Math.min(...mine.map(x => dist(x.move, b.move, sp))) - 0.05 * b.outside.length - 0.02 * Math.min(5, b.verify.stray); if (m > best) { best = m; bi = i; } }); }
      const b = pool.splice(bi, 1)[0];
      let f; try { f = G.fewest(b); } catch (e) { f = "gave up"; }   // (the solver's state cap: no fewer-press way found in it)
      solved++; b.verify.solverPresses = f;
      if (typeof f === "number" && f < b.verify.presses) { secretSolve++; continue; }
      mine.push(b);
    }
    const vs = mine.length >= 3 ? MS.variety(mine.map(b => b.move), sp) : null, offV = study().modes[mode].variety.official;
    console.log(`${mode}: ${opts.n} tried, ${good.length} verified + inside the movement range, ${mine.length} kept (${((Date.now() - t0) / 1000).toFixed(0)} s); solver: ${solved} solved, ${secretSolve} left out`);
    console.log(`   dropped: ${Object.entries(why).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + " " + v).join(", ") || "none"}`);
    if (vs) console.log(`   variety of the set: nearest ${vs.nearest} on ${vs.axesUsed} axes (official set of 20: ${offV.nearest} on ${offV.axesUsed})`);
    const mv = {}; for (const b of mine) for (const m of b.args.moves) mv[m] = (mv[m] || 0) + 1;
    console.log("   moves used: " + Object.entries(mv).map(([k, v]) => `${k} ${v}`).join(", "));
    mine.forEach((b, k) => { b.id = `g2-${mode}-${k + 1}`; b.variety = vs; });
    kept.push(...mine);
  }
  const all = keepOld.concat(kept);
  fs.writeFileSync(OUT, JSON.stringify({ made: new Date().toISOString(), note: "BRICKGEN.md 'Round 2': generated move-sequence bricks, gated on movement against the official bricks (knowledge/move_study.json). objects are structure-relative [type, col, row, extra]; events are ticks from the brick's entry (the structures.js test harness).",
    bricks: all.map(b => ({ id: b.id, mode: b.mode, tier: b.tier, width: b.width, args: b.args, verify: b.verify, move: b.move, outside: b.outside, events: b.events, objects: b.objects })) }, null, 0).replace(/\{"id"/g, "\n{\"id\""));
  console.log(`-> ${path.relative(ROOT, OUT)}: ${all.length} bricks`);
  return kept;
}

// ---------------------------------------------------------------- lab: each brick in its own copy of the test context (as round 1's lab)
function lab(mode, bricks) {
  const e = G.entry(mode), objs = [], seeds = [];
  const MODE_PORTAL = { ship: "ship portal", ball: "ball portal", ufo: "ufo portal", wave: "wave portal", robot: "robot portal", spider: "spider portal", swing: "swing portal" };
  const LEADIN = e.s0 - 8 - 1;
  let base = 8;
  for (const b of bricks) {
    objs.push([MODE_PORTAL[mode], base, 1]);
    const col = base + 1 + LEADIN;
    objs.push(`// ${b.id}: ${b.args.moves.join(" ")}`);
    for (const o of b.objects) objs.push([o[0], +(o[1] + col).toFixed(2), o[2]].concat(o[3] ? [o[3]] : []));
    const dt = (col - e.s0) * B / V, ev = b.events.slice().sort((a, c) => a.tick - c.tick);
    for (let i = 0; i < ev.length; i++) if (ev[i].type === "press") {
      const rel = ev.slice(i + 1).find(x => x.type === "release"), t = (e.tick + ev[i].tick) / TPS + dt;
      seeds.push({ t: +t.toFixed(4), hold: rel ? +((rel.tick - ev[i].tick) / TPS).toFixed(4) : 0.02 });
    }
    const ex = col + b.width + 4;
    for (const rr of [1, 4, 7]) objs.push(["cube portal", ex, rr]);
    objs.push(["block", ex, 9]);
    base = ex + 14;
  }
  const spec = { name: `GDLM lab brickgen2 ${mode}`, description: `Generated ${mode} bricks, round 2: move sequences (tools/brickgen2.js)`, speed: "1x", style: "classic", indicators: false,
    objects: objs, seedPresses: seeds, outro: 1 };
  const f = path.join(ROOT, "specs", `lab_brickgen2_${mode}.json`);
  fs.writeFileSync(f, JSON.stringify(spec, null, 1));
  console.log(`-> ${path.relative(ROOT, f)}: ${bricks.length} bricks, ${seeds.length} seeded presses; build: node tools/make.js ${path.relative(ROOT, f)}`);
  return f;
}

function textmap(b) {
  const grid = Array.from({ length: 10 }, () => Array(b.width).fill("."));
  const ch = { block: "#", "yellow pad": "p", "blue pad": "b", "yellow orb": "O", "blue orb": "B" };
  for (const [t, c, rw, x] of b.objects) { const cc = Math.round(c), rr = Math.round(rw); if (rr < 0 || rr > 9 || cc < 0 || cc >= b.width) continue; grid[rr][cc] = ch[t] || (t === "spike" ? (x && x.rot ? "v" : "^") : "?"); }
  const v = G.play(b.mode, b.objects, b.width, b.events);
  for (const q of v.r.path) { const c = Math.floor((q.x - v.h.s0 * B) / B), rr = Math.floor(q.y / B); if (c >= 0 && c < b.width && rr >= 0 && rr < 10 && grid[rr][c] === ".") grid[rr][c] = "o"; }
  const rows = []; for (let rr = 9; rr >= 0; rr--) rows.push(String(rr).padStart(2) + " " + grid[rr].join(""));
  return rows.join("\n");
}

module.exports = { gen, genBall, movement, outside, lab, load, textmap, GEN };

if (require.main === module) {
  const argv = process.argv.slice(2), cmd = argv[0], arg = k => { const i = argv.indexOf("--" + k); return i >= 0 ? argv[i + 1] : null; };
  if (cmd === "gen") gen({ modes: (arg("mode") || "ball").split(","), n: +(arg("n") || 300), keep: +(arg("keep") || 20), seed: +(arg("seed") || 1) });
  else if (cmd === "list") for (const b of load().bricks.filter(b => !arg("mode") || b.mode === arg("mode")))
    console.log(`${b.id.padEnd(12)} ${b.verify.presses} presses ${b.verify.secs} s, tightest ${b.verify.minMs} ms  ${b.args.moves.join(" ")}  | range ${b.move.yRange} legs/s ${b.move.legsPerS} grounded ${b.move.grounded} flips ${b.move.flips} mech ${b.move.mech}`);
  else if (cmd === "show") { const b = load().bricks.find(b => b.id === argv[1]); if (!b) { console.log("no brick " + argv[1]); process.exit(1); } console.log(JSON.stringify({ id: b.id, args: b.args, verify: b.verify, move: b.move, outside: b.outside })); console.log(textmap(b)); }
  else if (cmd === "lab") { const L = load().bricks; for (const mode of [...new Set(L.map(b => b.mode))].filter(m => !arg("mode") || m === arg("mode"))) lab(mode, L.filter(b => b.mode === mode)); }
  else if (cmd !== "nearest") console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).slice(0, 12).join("\n"));
}

// node tools/brickgen2.js nearest [--pieces local/lego/pieces.json] -- each kept brick's closest official brick by movement
// (the official pieces stay local; only the level name and column go into knowledge/brickgen2.json)
function nearest(file) {
  const P = JSON.parse(fs.readFileSync(file, "utf8")).filter(p => p.src === "official" && p.grain === "brick" && p.verified !== false);
  const out = load();
  for (const b of out.bricks) {
    const sp = spread(b.mode); let best = null;
    for (const p of P.filter(p => p.mode === b.mode)) {
      const d = MS.describe(p.path, { mech: Object.values(p.mech || {}).reduce((s, v) => s + v, 0) + (p.portals || []).length }); if (!d) continue;
      const dd = dist(b.move, d, sp); if (!best || dd < best.d) best = { d: +dd.toFixed(3), level: p.level, x: p.x, sig: p.sig, presses: p.presses };
    }
    b.nearestOfficial = best;
    console.log(`${b.id.padEnd(12)} ${b.args.moves.join(" ").padEnd(34)} -> ${best ? `${best.level} at block ${best.x} (${best.sig}, ${best.presses} presses), distance ${best.d}` : "none"}`);
  }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 0).replace(/\{"id"/g, "\n{\"id\""));
}
if (require.main === module && process.argv[2] === "nearest") {
  const i = process.argv.indexOf("--pieces");
  nearest(i > 0 ? process.argv[i + 1] : path.join(ROOT, "local", "lego", "pieces.json"));
}
