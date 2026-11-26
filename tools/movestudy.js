// node tools/movestudy.js [--pieces local/lego/pieces.json] [--write]
//   -- PATTERNS OF MOVEMENT in bricks (Evgeni 2026-11-26, on the first generated bricks: "if all the game play of all 20
//      structures is on 2 axes. then its almost the same. the patterns around the level have to be more irregular, not just
//      up down. that applies to all modes" -- "patterns of movement i mean"). Each brick's PATH (the player's route through
//      it, tools/lego.js pieces: [x, y, t, mode, grav, rot, grounded, mini] per sample) is cut into legs at its turns, and
//      described by numbers: height range and net change, legs per second, leg heights and lengths and how IRREGULAR they
//      are (coefficient of variation), dwell (time held level), distinct heights it rests on, grounded share, gravity flips,
//      mechanics touched. Then per mode: the official bricks' spread (p10 / median / p90) and how DIFFERENT the bricks of a
//      set are from each other (mean distance to the nearest other brick, in units of the official spread), for the official
//      set, the community set, our hand-made library ("ours") and the retired generated batch (knowledge/brickgen.json).
//   --write -> knowledge/move_study.json (numbers only: RobTop's layouts stay local). BRICKGEN.md "Movement study".
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const MODES = ["cube", "ship", "ball", "ufo", "wave", "robot", "spider", "swing"];

const q = (a, p) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
const cv = a => { if (a.length < 2) return 0; const m = mean(a); if (Math.abs(m) < 1e-6) return 0; return Math.sqrt(mean(a.map(v => (v - m) ** 2))) / Math.abs(m); };
const r2 = v => v == null ? null : Math.round(v * 100) / 100;

// one path -> movement numbers. pts: [[x, y, t, mode, grav, rot, grounded], ...] in blocks / seconds
function describe(pts, extra = {}) {
  if (!pts || pts.length < 4) return null;
  const ys = pts.map(p => p[1]), T = pts[pts.length - 1][2] - pts[0][2];
  if (!(T > 0.2)) return null;
  // legs: split where the vertical direction turns (hysteresis 0.4 block)
  const legs = []; let dir = 0, ext = ys[0], start = 0, extI = 0;
  for (let i = 1; i < pts.length; i++) {
    const y = ys[i];
    if (dir >= 0 && y < ext - 0.4) { if (dir > 0) { legs.push({ dy: ext - ys[start], dt: pts[extI][2] - pts[start][2] }); start = extI; } dir = -1; ext = y; extI = i; }
    else if (dir <= 0 && y > ext + 0.4) { if (dir < 0) { legs.push({ dy: ext - ys[start], dt: pts[extI][2] - pts[start][2] }); start = extI; } dir = 1; ext = y; extI = i; }
    else if ((dir > 0 && y > ext) || (dir < 0 && y < ext)) { ext = y; extI = i; }
  }
  if (dir !== 0) legs.push({ dy: ext - ys[start], dt: pts[extI][2] - pts[start][2] });
  // dwell: time the height holds (vertical speed under 1 block a second; per sample, as samples are 0.01-0.05 s apart); rest heights: distinct heights it holds at
  let dwellT = 0; const rests = new Set();
  for (let i = 1; i < pts.length; i++) { const dt = pts[i][2] - pts[i - 1][2]; if (dt > 0 && Math.abs(ys[i] - ys[i - 1]) / dt < 1) { dwellT += pts[i][2] - pts[i - 1][2]; rests.add(Math.round(ys[i] * 2) / 2); } }
  const amps = legs.map(l => Math.abs(l.dy)).filter(v => v >= 0.4), durs = legs.map(l => l.dt).filter(v => v > 0.02);
  let flips = 0; for (let i = 1; i < pts.length; i++) if (pts[i][4] !== pts[i - 1][4]) flips++;
  const grounded = pts.filter(p => p[6]).length / pts.length;
  return {
    T: r2(T), yRange: r2(Math.max(...ys) - Math.min(...ys)), net: r2(ys[ys.length - 1] - ys[0]),
    legsPerS: r2(legs.length / T), ampMed: r2(q(amps, 0.5) || 0), ampCv: r2(cv(amps)), durCv: r2(cv(durs)),
    dwell: r2(dwellT / T), rests: rests.size, grounded: r2(grounded), flips, mech: extra.mech || 0,
  };
}
// the axes a set's variety is measured on, each scaled by the official spread (p90 - p10) of the mode
const AXES = ["yRange", "net", "legsPerS", "ampMed", "ampCv", "durCv", "dwell", "rests", "grounded", "flips", "mech"];
function spreadOf(D) { const s = {}; for (const k of AXES) { const v = D.map(d => d[k]); const lo = q(v, 0.1), hi = q(v, 0.9); s[k] = Math.max(0.25, (hi - lo) || 0); } return s; }
// variety: for each brick, the distance to its nearest other brick of the set (mean |difference| / spread over the axes);
// the set's median of that. A set of one idea at different sizes scores low even when its sizes vary.
function variety(D, spread) {
  if (D.length < 3) return null;
  const dist = (a, b) => mean(AXES.map(k => Math.abs((a[k] || 0) - (b[k] || 0)) / spread[k]));
  const nn = D.map((a, i) => Math.min(...D.map((b, j) => i === j ? Infinity : dist(a, b))));
  // how many axes the set really uses: an axis counts when the set's own spread is at least 30% of the official one
  const used = AXES.filter(k => { const v = D.map(d => d[k]); return ((q(v, 0.9) - q(v, 0.1)) || 0) >= 0.3 * spread[k]; });
  return { nearest: r2(q(nn, 0.5)), axesUsed: used.length, axes: used };
}

function fromPieces(file) {
  const P = JSON.parse(fs.readFileSync(file, "utf8"));
  return P.filter(p => p.grain === "brick" || p.src === "ours").map(p => ({ src: p.src, mode: p.mode, verified: p.verified, presses: p.presses,
    d: describe(p.path, { mech: Object.values(p.mech || {}).reduce((s, v) => s + v, 0) + (p.portals || []).length }) })).filter(p => p.d && p.verified !== false);
}
function fromBrickgen() {
  let G; try { G = require("./brickgen.js"); } catch (e) { return []; }
  const out = [];
  for (const b of G.load().bricks) {
    const { h, r } = G.play(b.mode, b.objects, b.width, b.events), x0 = h.s0 * 30, x1 = h.s1 * 30, t0 = (r.path.find(s => s.x >= x0) || {}).tick || 0;
    const pts = r.path.filter((s, i) => s.x >= x0 && s.x <= x1 && i % 4 === 0).map(s => [(s.x - x0) / 30, s.y / 30, (s.tick - t0) / 240, 0, s.grav, 0, s.grounded ? 1 : 0]);
    out.push({ src: "generated", mode: b.mode, d: describe(pts, { mech: 0 }) });
  }
  return out.filter(p => p.d);
}

function study(file) {
  const all = fromPieces(file).concat(fromBrickgen()), res = { made: new Date().toISOString(), note: "BRICKGEN.md 'Movement study': movement numbers per brick path; p10/median/p90 per mode of the official bricks; variety per set = median distance to the nearest other brick (in official spreads) and axes used.", modes: {} };
  for (const mode of MODES) {
    const off = all.filter(p => p.mode === mode && p.src === "official").map(p => p.d);
    if (off.length < 10) continue;
    const spread = spreadOf(off), M = { n: {}, official: {}, variety: {} };
    for (const k of AXES) { const v = off.map(d => d[k]); M.official[k] = [q(v, 0.1), q(v, 0.5), q(v, 0.9)]; }
    for (const src of ["official", "community", "ours", "generated"]) {
      const D = all.filter(p => p.mode === mode && p.src === src).map(p => p.d);
      M.n[src] = D.length;
      if (D.length >= 3) {
        // sets of 20 (a lab's size): the median over random draws, so sets of different sizes compare
        const draws = [];
        for (let k = 0; k < (D.length > 20 ? 15 : 1); k++) {
          const pick = D.length > 20 ? D.slice().sort(() => Math.random() - 0.5).slice(0, 20) : D;
          draws.push(variety(pick, spread));
        }
        M.variety[src] = { nearest: r2(q(draws.map(d => d.nearest), 0.5)), axesUsed: q(draws.map(d => d.axesUsed), 0.5),
          medians: Object.fromEntries(AXES.map(k => [k, q(D.map(d => d[k]), 0.5)])) };
      }
    }
    res.modes[mode] = M;
  }
  return res;
}

if (require.main === module) {
  const argv = process.argv.slice(2), arg = k => { const i = argv.indexOf("--" + k); return i >= 0 ? argv[i + 1] : null; };
  const file = arg("pieces") || path.join(ROOT, "local", "lego", "pieces.json");
  const R = study(file);
  for (const [mode, M] of Object.entries(R.modes)) {
    console.log(`\n== ${mode}  (bricks: ${Object.entries(M.n).map(([k, v]) => k + " " + v).join(", ")})`);
    console.log("   variety of a set of 20 (median distance to its nearest other brick, in official spreads; axes it really uses of " + AXES.length + "):");
    for (const [src, v] of Object.entries(M.variety)) console.log(`     ${src.padEnd(10)} nearest ${String(v.nearest).padStart(5)}   axes ${v.axesUsed}`);
    console.log("   medians        " + AXES.map(k => k.padStart(8)).join(""));
    for (const [src, v] of Object.entries(M.variety)) console.log(`     ${src.padEnd(10)} ` + AXES.map(k => String(v.medians[k]).padStart(8)).join(""));
  }
  if (argv.includes("--write")) { const f = path.join(ROOT, "knowledge", "move_study.json"); fs.writeFileSync(f, JSON.stringify(R, null, 1)); console.log("\n-> " + path.relative(ROOT, f)); }
}
module.exports = { describe, variety, spreadOf, AXES, study };
