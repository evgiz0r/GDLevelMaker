// node tools/lego.js mine [official] [ours] [sketches] [library] [--sketch <file.json> ...]   -- cut levels into 1-3 s pieces,
//                                                  classify and measure each -> local/lego/pieces.json (all, with shapes)
//                                                  + knowledge/lego.json (committed: families, parameters, counts; shapes
//                                                  only for OUR levels and the user's sketches, never RobTop's)
// node tools/lego.js families [--src official|ours|sketch]   -- the family table: how often, typical parameters
// node tools/lego.js variety <level.gdlvl>           -- a level's piece sequence by signature: repeats, what is missing
//                                                      vs the official levels' mix
// node tools/lego.js knobs                          -- what makes a main-level piece harder or easier, per mode -> knowledge/lego_knobs.json
// node tools/lego.js votes                          -- Evgeni's 👍 / 👎 / comments (PC page + phone page) -> knowledge/lego_votes.json
// node tools/lego.js page --private                 -- everything incl. main-level bricks, for Evgeni's PRIVATE claude.ai page only
// node tools/lego.js page [--public] [--out f.html]  -- a page of thumbnails, filterable by family / mode / wrapper /
//                                                      source. Default: everything, local only (official pieces are
//                                                      RobTop's layouts: local/lego/page.html, opened on the PC or via
//                                                      serve.js). --public: ours + sketches + the official numbers only
//                                                      (for the phone Artifact).
//
// Structure research, "level building as lego" (the user, 2026-11-25: "ship wave and swing have some similarity in
// their possible structures. a path, a path with some spikes, corridors. corridors with paths ... maybe if we just
// play this as some kind of sophisticated lego"). LEGO.md: the families, how a piece is cut and measured, the
// parameters, what the official levels use vs ours, the variety rules, what is open.
//
// A piece = a stretch of a level's route (the saved solution replayed, no solving) of one mode, ~1-3 s, cut at calm
// ticks (no input near, grounded in the jumping modes). Sketches have no route: their path is the drawn corridor's
// midline (marked "path: midline").
// Families (the user's grouping):
//   fly    ship, wave, swing   -- a PATH through space; wrapped as: open / floor path / roof path / corridor,
//                                 +spikes (hazards are >= 30% of the walls), +gates (narrowings), +flips (gravity)
//   jump   cube, robot, ufo    -- hops between floors: steps, pits, pillars
//   flip   ball, spider        -- gravity-switching runners: floor <-> roof
// plus mechanics on any of them: orbs, pads, portals (gravity, speed, size).
"use strict";
if (require.main === module && /^(mine)$/.test(process.argv[2] || "")) require("./heavy.js").claim();
const fs = require("fs"), path = require("path");
const { GD, readGdlvl } = require("./io.js");
const ROOT = path.join(__dirname, ".."), LOCAL = path.join(ROOT, "local"), OUTDIR = path.join(LOCAL, "lego");
const KNOW = path.join(ROOT, "knowledge", "lego.json"), VOTESK = path.join(ROOT, "knowledge", "lego_votes.json");
const FAMILY = { ship: "fly", wave: "fly", swing: "fly", cube: "jump", robot: "jump", ufo: "jump", ball: "flip", spider: "flip" };
const TPS = GD.PHYS.TPS, B = 30;
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
const median = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };

// ---------------------------------------------------------------- sources
function officialSources() {
  const out = [];
  for (let n = 1; n <= 22; n++) {
    const f = path.join(LOCAL, `official_${String(n).padStart(2, "0")}.json`);
    if (!fs.existsSync(f)) continue;
    const j = JSON.parse(fs.readFileSync(f, "utf8"));
    if (!j.solution || !j.solution.events) continue;
    out.push({ src: "official", name: `${n} ${j.name}`, level: GD.parseLevel(j.level), events: j.solution.events, windowsKey: "official_" + n, routeKind: j.solution.kind || "unknown", routePlan: j.solution.plan || "", routeAt: j.solution.at || j.solution.planned || fs.statSync(f).mtime.toISOString().slice(0, 10) });
  }
  return out;
}
function ourSources() {
  const S = require("./solutions.js"), out = [];
  for (const f of fs.readdirSync(path.join(ROOT, "levels")).filter(f => /^gdlm_.*\.gdlvl$/.test(f)).sort()) {
    const L = readGdlvl(path.join(ROOT, "levels", f)), sol = S.get(L.levelStr, true);
    if (!sol || !sol.events) continue;
    out.push({ src: "ours", name: f.replace(/^gdlm_|\.gdlvl$/g, ""), file: "levels/" + f, level: L.level || GD.parseLevel(L.levelStr), events: sol.events, windows: sol.windows || null });
  }
  return out;
}
// the lego-* pieces of the structure library (tools/structures.js build <id> -> local/structures/), each as ONE piece
// (its mode's stretch); the saved route when the check left one, else the corridor's midline
function librarySources() {
  const S = require("./solutions.js"), dir = path.join(LOCAL, "structures"), out = [];
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).filter(f => /^(lego|sk\d+)-.*\.gdlvl$/.test(f)).sort()) {
    const L = readGdlvl(path.join(dir, f)), level = GD.parseLevel(L.levelStr);
    // verified by the solver: the saved route, else solve it now (cached in local/solutions for next time)
    let sol = S.get(L.levelStr, true);
    if (!sol || !sol.ok) try { sol = S.solve(level, L.levelStr); } catch (e) { sol = null; }
    out.push({ src: "library", name: f.replace(/\.gdlvl$/, ""), file: "tools/structures.js " + f.replace(/\.gdlvl$/, ""), level, events: sol && sol.ok ? sol.events : null, windows: sol && sol.windows || null, whole: true, unsolved: !(sol && sol.ok) });
  }
  return out;
}
function sketchSources(files) {
  const SK = require("../lib/sketch.js"), out = [];
  const dir = path.join(LOCAL, "sketches");
  if (!files.length && fs.existsSync(dir)) files = fs.readdirSync(dir).filter(f => /\.json$/.test(f)).map(f => path.join(dir, f));
  for (const f of files) {
    let sk = JSON.parse(fs.readFileSync(f, "utf8")); sk = sk.data || sk;
    const lv = SK.convert(sk);
    out.push({ src: "sketch", name: (sk.name || path.basename(f, ".json")), file: path.relative(ROOT, f), level: GD.parseLevel(lv.levelStr), events: null });
  }
  return out;
}

// ---------------------------------------------------------------- route
function heldAt(events) {   // tick -> held?, and the input ticks
  const ev = (events || []).slice().sort((a, b) => a.tick - b.tick), ticks = ev.map(e => e.tick);
  return { ticks, held: t => { let h = false; for (const e of ev) { if (e.tick > t) break; h = e.type === "press"; } return h; } };
}
// a sketch has no route: walk the drawn level column by column through the free gap the path is in, mode by mode
function midlineRoute(w) {
  const items = w.items, portals = items.filter(i => i.kind === "mode" || i.kind === "gravity" || i.kind === "speed").sort((a, b) => a.x0 - b.x0);
  const endX = Math.max(w.endX || 0, ...items.map(i => i.x1)) + 60, path = [];
  let mode = "cube", grav = 1, y = 15, pi = 0;
  for (let x = 0; x < endX; x += 5) {
    while (pi < portals.length && portals[pi].x0 <= x) {
      const p = portals[pi++];
      if (p.kind === "mode") { mode = p.d.mode; y = (p.y0 + p.y1) / 2; }
      if (p.kind === "gravity") grav = p.d.grav === 0 ? -grav : p.d.grav;
    }
    if (FAMILY[mode] === "fly") {
      // free intervals at this column; keep the one nearest y, go to its middle (smoothly)
      const occ = items.filter(i => (i.kind === "solid" || i.kind === "hazard" || i.kind === "slope") && i.x0 <= x + 2 && i.x1 >= x - 2).map(i => [i.y0, i.y1]).sort((a, b) => a[0] - b[0]);
      let lo = 0, best = null;
      for (const [a, b] of [...occ, [1e4, 1e4]]) { if (a > lo + 10) { const mid = (lo + Math.min(a, 1200)) / 2, d = Math.abs(mid - y); if (!best || d < best.d) best = { mid, d, lo, hi: a }; } lo = Math.max(lo, b); }
      if (best) y += Math.max(-5, Math.min(5, best.mid - y));
    } else y = 15;
    path.push({ tick: path.length, x, y, mode, grav, sp: 1, floorY: 0, ceilY: null, grounded: FAMILY[mode] !== "fly" });
  }
  return { path, dead: false, midline: true };
}
function route(s) {
  const w = GD.makeWorld(s.level.objects, s.level.header);
  if (!s.events) return { w, r: midlineRoute(w), inputs: heldAt([]) };
  const r = GD.run(w, s.events);
  return { w, r, inputs: heldAt(s.events) };
}

// ---------------------------------------------------------------- cutting
// two sizes: a piece (1-3 s, about a screen) and a brick (~0.8 s: one obstacle or move -- the user, 2026-11-25: "all the
// structures all full screen? hmm i thought the point is that they are smaller")
const GRAIN = { piece: { target: 2.2, mins: 0.6, slack: 0.5 }, brick: { target: 0.8, mins: 0.35, slack: 0.3 } };
let TARGET = 2.2, MINS = 0.6, SLACK = 0.5;
// a brick: 2-6 presses, cut in the longest pause between presses that keeps the count in range (the user, 2026-11-25:
// "not even whole screen length [...] short ones. with like 2-6 clicks"). Within one mode stretch; a stretch with fewer
// than 2 presses is one brick if it lasts 0.35 s or more.
function cutBricks(r, inputs, o) {
  const p = r.path, out = [];
  if (!p.length || r.midline) return out;
  const presses = [], idxOf = tk => Math.max(0, Math.min(p.length - 1, tk - p[0].tick));
  { let h = false; const ev = (inputs.ticks || []); for (const t of ev) { const nh = inputs.held(t); if (nh && !h) presses.push(t); h = nh; } }
  let a = 0;
  const spans = [];
  for (let t = 1; t <= p.length; t++) if (t === p.length || p[t].mode !== p[a].mode || p[t].dead) { spans.push([a, t - 1]); if (t < p.length && p[t].dead) break; a = t; }
  for (const [i0, i1] of spans) {
    const ps = presses.filter(t => t >= p[i0].tick && t <= p[i1].tick);
    if (ps.length < 2) { if ((p[i1].tick - p[i0].tick) / TPS >= 0.35 && ps.length) out.push([i0, i1]); continue; }
    // groups of 2-6 presses, split in the longest pause; a brick runs from a little before its first press (0.3 s, or half
    // the pause before) to a little after its last (0.45 s -- the landing --, or half the pause after): long walks
    // between bricks are left out
    const groups = []; let k = 0;
    while (k < ps.length) {
      const left = ps.length - k;
      if (left <= 6) { groups.push([k, ps.length - 1]); break; }
      let best = -1, bj = 2;
      for (let j = 2; j <= 6 && k + j < ps.length; j++) { if (ps.length - (k + j) < 2) break; const g = (ps[k + j] - ps[k + j - 1]) * (j <= 3 ? 1 : j === 4 ? 0.75 : 0.55); if (g > best) { best = g; bj = j; } }   // short bricks preferred
      groups.push([k, k + bj - 1]); k += bj;
    }
    // auto bricks: 0.8 s or more with no press where the level moves the player itself (pads, gravity / mode / speed
    // portals, or a rise or fall of 3+ blocks) -- the user, 2026-11-25: "sections without clicks but with interesting
    // patterns of pads portals slopes that create some interesting movement". Marked [i0, i1, "auto"].
    if (o && o.auto) for (let k = 0; k <= ps.length; k++) {
      const a = k ? ps[k - 1] + 0.2 * TPS : p[i0].tick, b = k < ps.length ? ps[k] - 0.15 * TPS : p[i1].tick;
      if ((b - a) / TPS < 0.8) continue;
      const ia = idxOf(Math.round(a)), ib = idxOf(Math.round(b)), xa = p[ia].x, xb = p[ib].x;
      const moves = o.items.filter(it => it.x0 >= xa && it.x0 < xb && (it.kind === "pad" || it.kind === "gravity" || it.kind === "mode" || it.kind === "speed")).length;
      let lo = 1e9, hi = -1e9; for (let i = ia; i <= ib; i++) { lo = Math.min(lo, p[i].y); hi = Math.max(hi, p[i].y); }
      if (moves || hi - lo >= 3 * B) out.push([ia, ib, "auto"]);
    }
    for (const [g0, g1] of groups) {
      const prev = g0 ? ps[g0 - 1] : p[i0].tick, next = g1 + 1 < ps.length ? ps[g1 + 1] : p[i1].tick;
      const t0 = Math.max(p[i0].tick, ps[g0] - Math.min(0.3 * TPS, (ps[g0] - prev) / 2)), t1 = Math.min(p[i1].tick, ps[g1] + Math.min(0.45 * TPS, (next - ps[g1]) / 2));
      out.push([idxOf(Math.round(t0)), idxOf(Math.round(t1))]);
    }
  }
  return out;
}
function cut(r, inputs, whole, grain) {
  if (grain === "brick") return cutBricks(r, inputs, whole);
  const G = GRAIN[grain || "piece"]; TARGET = G.target; MINS = G.mins; SLACK = G.slack;
  const p = r.path, spans = [];
  if (!p.length) return spans;
  let a = 0;
  for (let t = 1; t <= p.length; t++) if (t === p.length || p[t].mode !== p[a].mode || p[t].dead) { spans.push([a, t - 1]); if (t < p.length && p[t].dead) break; a = t; }
  const secs = (i, j) => r.midline ? (p[j].x - p[i].x) / 311.58 : (p[j].tick - p[i].tick) / TPS;
  const calm = i => {   // larger = calmer: seconds to the nearest input, grounded bonus in the jumping modes
    const tk = r.midline ? 0 : p[i].tick; let d = 1;
    if (!r.midline) for (const u of inputs.ticks) d = Math.min(d, Math.abs(u - tk) / TPS);
    return d + (p[i].grounded && FAMILY[p[i].mode] !== "fly" ? 0.3 : 0);
  };
  const out = [];
  if (whole) return spans.filter(([i0, i1]) => r.path[i0].mode !== "cube" && secs(i0, i1) >= MINS);
  for (const [i0, i1] of spans) {
    const D = secs(i0, i1);
    if (D < MINS) continue;
    const n = Math.max(1, Math.round(D / TARGET));
    let s = i0;
    for (let k = 1; k <= n; k++) {
      let e = i1;
      if (k < n) {
        // target end, snapped to the calmest state within +-0.5 s
        let best = -1, bi = -1;
        for (let j = s; j <= i1; j++) {
          const dt = secs(s, j); if (dt < D / n - SLACK) continue; if (dt > D / n + SLACK) break;
          if (j % 4) continue;
          const c = calm(j); if (c > best) { best = c; bi = j; }
        }
        e = bi > 0 ? bi : Math.min(i1, s + 1);
      }
      if (secs(s, e) >= MINS) out.push([s, e]);
      s = e;
    }
  }
  return out;
}

// ---------------------------------------------------------------- timing windows (a piece's difficulty)
// every input's player window (lib/windows.js, the one definition the viewer, score.js and difficulty share): ours come
// saved with their route; an official route's are measured once (~7 s a level) and kept in local/lego/windows/, keyed by
// the route and the physics / windows commits. Format as tools/solutions.js: [0 press / 1 release, tick, lo, hi, j].
function windowsOf(src, w, r) {
  if (src.windows) return src.windows;
  if (!src.events || r.midline) return [];
  const S = require("./solutions.js"), crypto = require("crypto");
  const key = crypto.createHash("sha1").update(JSON.stringify(src.events) + S.physicsCommit() + (S.windowsCommit ? S.windowsCommit() : "")).digest("hex").slice(0, 16);
  const f = path.join(OUTDIR, "windows", (src.windowsKey || src.name.replace(/[^a-z0-9]+/gi, "_")) + ".json");
  // measured windows are committed in knowledge/lego_windows/ (timing numbers only, no layouts), so the PC does not
  // measure them again (~40 min for the 22 main levels the first time)
  for (const g of [f, path.join(ROOT, "knowledge", "lego_windows", path.basename(f))]) try { const c = JSON.parse(fs.readFileSync(g, "utf8")); if (c.key === key) return c.windows; } catch (e) {}
  if (process.env.LEGO_CACHED_WINDOWS) return [];   // only what is measured already (a quick rebuild while a long one runs)
  const WIN = require("../lib/windows.js");
  const t0 = Date.now();
  const ws = WIN.inputWindows(w, src.events, r.path, {}).map(x => [x.type === "release" ? 1 : 0, x.tick, x.lo, x.hi, x.j]);
  fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify({ key, windows: ws }));
  const kf = path.join(ROOT, "knowledge", "lego_windows", path.basename(f)); fs.mkdirSync(path.dirname(kf), { recursive: true }); fs.writeFileSync(kf, JSON.stringify({ key, windows: ws }));
  console.log(`    windows of ${src.name}: ${ws.length} inputs, ${Date.now() - t0} ms`);
  return ws;
}
// a piece's difficulty from the windows of its inputs: log10 of the expected attempts to get through it in one go
// (lib/difficulty.js hitChance: the user's fitted timing spread and lapse), its tightest window and the tight ones (< 60 ms)
function pieceDifficulty(ws, t0, t1) {
  const Dif = require("../lib/difficulty.js");
  const ms = ws.filter(x => x[1] >= t0 && x[1] <= t1).map(x => (x[3] - x[2] + 1) / TPS * 1000);
  if (!ms.length) return { diff: 0, tightMs: null, tight: 0, windows: 0 };
  const diff = ms.reduce((c, m) => c - Math.log10(Math.max(Dif.hitChance(m), 1e-9)), 0);
  return { diff: r2(diff), tightMs: Math.round(Math.min(...ms)), tight: ms.filter(m => m < 60).length, windows: ms.length };
}

// ---------------------------------------------------------------- measuring one piece
const KCODE = { solid: "S", slope: "L", hazard: "H", orb: "O", pad: "P", mode: "M", gravity: "G", speed: "V", size: "Z" };
const ORBISH = /orb/, PADISH = /pad/;
function measure(src, w, r, inputs, i0, i1) {
  const p = r.path, a = p[i0], b = p[i1], mode = a.mode, fam = FAMILY[mode] || "other";
  const xa = a.x, xb = b.x, W = Math.max(1, Math.round((xb - xa) / B));
  const items = w.items.filter(it => it.x1 > xa - B && it.x0 < xb + B);
  const seconds = r.midline ? (xb - xa) / 311.58 : (b.tick - a.tick) / TPS;
  // per column: the path's height, the floor and roof right under / over it, and what they are made of
  const cols = [];
  for (let c = 0; c < W; c++) {
    const x0 = xa + c * B, x1 = x0 + B;
    const ys = []; let grav = 1, band = null;
    for (let i = i0; i <= i1; i++) if (p[i].x >= x0 && p[i].x < x1) { ys.push(p[i].y); grav = p[i].grav; if (p[i].ceilY != null) band = [p[i].floorY || 0, p[i].ceilY]; }
    if (!ys.length) { cols.push(cols.length ? Object.assign({}, cols[cols.length - 1]) : { py: a.y / B }); continue; }
    const py = ys.reduce((s, v) => s + v, 0) / ys.length, lo = Math.min(...ys), hi = Math.max(...ys);
    let f = { y: 0, k: "G" }, rf = band ? { y: band[1], k: "E" } : null;
    for (const it of items) {
      if (it.x1 <= x0 || it.x0 >= x1) continue;
      const k = it.kind === "hazard" ? "H" : (it.kind === "solid" || it.kind === "slope") ? "S" : null;
      if (!k) continue;
      const sl = it.kind === "slope" ? 1 : 0;
      if (it.y1 <= lo + 4 && it.y1 > f.y) f = { y: it.y1, k, sl };
      if (it.y0 >= hi - 4 && (!rf || it.y0 < rf.y)) rf = { y: it.y0, k, sl };
    }
    if (band && f.k === "G" && band[0] > 0) f = { y: band[0], k: "E" };
    cols.push({ py: r1(py / B), f: r1(f.y / B), fk: f.k, r: rf ? r1(rf.y / B) : null, rk: rf ? rf.k : null, fs: f.sl || 0, rs: rf && rf.sl || 0, g: grav });
  }
  // mechanics in the stretch
  const mech = {}; let flips = 0, portals = [];
  for (const it of items) {
    if (it.x0 < xa - 5 || it.x0 > xb) continue;
    if (ORBISH.test(it.d.name || "") || PADISH.test(it.d.name || "")) mech[it.d.name] = (mech[it.d.name] || 0) + 1;
    if (it.kind === "gravity" || it.kind === "speed" || it.kind === "size" || it.kind === "mode") portals.push(it.d.name);
  }
  for (let i = i0 + 1; i <= i1; i++) if (p[i].grav !== p[i - 1].grav) flips++;
  let presses = 0, heldT = 0, toggles = 0;
  if (!r.midline) {
    for (const u of inputs.ticks) if (u >= a.tick && u <= b.tick) toggles++;
    for (let i = i0; i <= i1; i += 4) if (inputs.held(p[i].tick)) heldT++;
    presses = Math.ceil(toggles / 2);
  }
  const hold = r.midline ? null : r2(heldT / Math.max(1, (i1 - i0) / 4));
  const hazards = items.filter(it => it.kind === "hazard" && it.x0 >= xa && it.x0 < xb).length;
  const pyS = cols.map(c => c.py), yRange = r1(Math.max(...pyS) - Math.min(...pyS));
  // the seam contract: the player's state where the piece starts and ends (mode, speed, gravity, height in blocks, vertical
  // speed, on the ground or not) -- two pieces join cleanly when one's exit matches the next one's entry (BUILDING.md)
  const st = q => ({ mode: q.mode, sp: q.sp, grav: q.grav, y: r1(q.y / B), vy: r1(q.vy || 0), ground: !!q.grounded });
  const P = { src: src.src, level: src.name, file: src.file, mode, family: fam, speed: a.sp, x: Math.round(xa / B), xa: r2(xa / B), w: W, entry: st(a), exit: st(b),
    s: r2(seconds), presses, toggles, hold, flips, hazards, hzPer100: Math.round(hazards / W * 100), mech, portals, yRange, midline: !!r.midline };
  // verified = a route (the solver's, a real clear's or the level's planned one) replayed by our physics goes through the
  // whole piece alive; a sketch's midline is drawn, never played (the user: "lets have structures which are verified by
  // physics and the solver")
  P.verified = !r.midline && !src.unsolved && !p.slice(i0, i1 + 1).some(q => q.dead);
  P.why = P.verified ? "" : r.midline ? (src.unsolved ? "the solver found no way through" : "drawn, not played: no route") : "the route dies here";
  if (fam === "fly") Object.assign(P, flyShape(cols, mode));
  else Object.assign(P, groundShape(cols, p, i0, i1));
  P.sig = signature(P);
  P.cols = cols;
  // empty: nothing to react to -- no hazard, orb, pad or portal, and (jump/flip) flat ground or (fly) open air.
  // The user, 2026-11-25: "there are too many empty structures".
  P.empty = !hazards && !Object.keys(mech).length && !portals.length && (fam === "fly" ? P.wrap === "open" : P.wrap === "flat" || presses === 0);
  // smooth (fly only): the walls next to the path change height by slopes, not by block stairs. steps = wall jumps of a
  // block or more between two columns where neither side is a slope, per 10 columns. The user: "some patterns are not
  // smooth" / "i wanted smooth play in those corridors".
  if (fam === "fly") {
    let st = 0;
    for (let c = 1; c < cols.length; c++) {
      const A = cols[c - 1], C = cols[c];
      if (A.fk === "S" && C.fk === "S" && Math.abs(C.f - A.f) >= 0.9 && !A.fs && !C.fs) st++;
      if (A.rk === "S" && C.rk === "S" && A.r != null && C.r != null && Math.abs(C.r - A.r) >= 0.9 && !A.rs && !C.rs) st++;
    }
    P.steps = r1(st / Math.max(1, W) * 10); P.smooth = P.steps <= 1;
  }
  // the clicks: every press and release of the route inside the piece, where it happened (blocks from the piece start)
  P.clicks = [];
  if (!r.midline) for (const u of inputs.ticks) if (u >= a.tick && u <= b.tick) {
    const q = p[Math.max(i0, Math.min(i1, i0 + (u - a.tick)))];
    P.clicks.push([r1((q.x - xa) / B), r1(q.y / B), inputs.held(u) ? 1 : 0, r2((u - a.tick) / TPS)]);
  }
  P.shape = items.filter(it => /^(solid|slope|hazard|orb|pad|mode|gravity|speed|size)$/.test(it.kind) && it.x1 > xa - B && it.x0 < xb + B)
    .slice(0, 900).map(it => [KCODE[it.kind], r1((it.x0 - xa) / B), r1(it.y0 / B), r1((it.x1 - xa) / B), r1(it.y1 / B), it.d.color || "", it.kind === "slope" ? slopeCorner(it) : ""]);
  // the route as our physics played it: [x, y, seconds from the piece start] (the page replays it at its real speed)
  // plus what the page needs to draw the player as the game does (the user, 2026-11-25: "need proper icons in the replays
  // of the structures", "colors and player icons + reverse"): mode (index in MODES), gravity (-1 = upside down: the icon is
  // drawn mirrored), the drawn rotation (lib/look.js visualRot, the viewer's), grounded and mini
  const vr = r.midline ? null : LOOK.visualRot(p.slice(i0, i1 + 1)), step = Math.max(1, Math.round((i1 - i0) / 120));
  // world position (a state inside rotated gameplay steps in its frame's coordinates: GD.worldXY turns it back; the
  // user's "something weird with paths", 2026-11-25). A teleport is a real jump: the page breaks the line there.
  const wxy = s => GD.worldXY ? GD.worldXY(s) : [s.x, s.y], wa = wxy(a)[0] - xa;
  P.path = []; for (let i = i0; i <= i1; i += step) { const [wx, wy] = wxy(p[i]); P.path.push([r1((wx - wa - xa) / B), r1(wy / B), r2(r.midline ? (p[i].x - xa) / 311.58 : (p[i].tick - a.tick) / TPS),
    Math.max(0, MODES.indexOf(p[i].mode)), p[i].grav < 0 ? -1 : 1, vr ? Math.round(vr[i - i0]) : 0, p[i].grounded ? 1 : 0, p[i].mini ? 1 : 0]); }
  P.colors = levelColours(src, r, a);
  // which route the piece was cut from (the solver thread, 2026-11-25): its kind ("human" = lib/natural.js planned it,
  // "humanize" = the raw solve patched, keeps its flying jitter) and when it was planned; jitter = wave presses under
  // 0.1 s apart (a wave leg is one press: knowledge/checklist.md). The page hides jittery and non-human pieces by default.
  P.routeKind = src.routeKind || (src.src === "official" ? "unknown" : "ours");
  if (src.routeAt) P.routeAt = src.routeAt;
  if (src.src === "official") P.routePlan = src.routePlan || "";   // the planner commit (difficulty_solve.js); "" = planned before the 2026-11-25 wave planner
  { const pr = P.clicks.filter(c => c[2]).map(c => c[3]); P.jitter = FAMILY[mode] === "fly" ? pr.filter((t, i) => i && t - pr[i - 1] < 0.1).length : 0; }
  // inner cut points (the user, 2026-11-25: "what we could cut from start or the end, like checkpoints where we could
  // take even smaller parts (on demand)"): calm moments between two presses where the brick can be trimmed -- the button
  // up, at least 0.2 s to the next press, and (cube family) on the ground. [x blocks, seconds, presses before it]; a
  // slice from one cut to another is a smaller brick with the same route. Joining a slice is checked like any join.
  P.cuts = [];
  if (!r.midline) {
    const pr = P.clicks.filter(c => c[2]);
    for (let k = 0; k + 1 < pr.length; k++) {
      const t0 = pr[k][3], t1 = pr[k + 1][3]; if (t1 - t0 < 0.2) continue;
      let best = null;
      for (let i = i0; i <= i1; i++) {
        const ts = (p[i].tick - a.tick) / TPS; if (ts <= t0 + 0.05 || ts >= t1 - 0.05) continue;
        if (inputs.held(p[i].tick)) continue;
        if (FAMILY[p[i].mode] !== "fly" && !p[i].grounded) continue;
        const score = Math.min(ts - t0, t1 - ts); if (!best || score > best.score) best = { i, ts, score };
      }
      if (best) P.cuts.push([r1((p[best.i].x - xa) / B), r2(best.ts), k + 1]);
    }
  }
  return P;
}
// the level's colours where the piece starts (header + colour triggers fired by then, lib/look.js): background, ground,
// line, and the player's two colours as the level sets them (1005/1006 default to GD's lime and cyan)
const LOOK = require("../lib/look.js").LOOK, MODES = ["cube", "ship", "ball", "ufo", "wave", "robot", "spider", "swing"];
function levelColours(src, r, a) {
  if (!src.level) return null;
  const P = r.path, TPSr = TPS;
  if (!r._tl) {
    const fireAt = x => { if (r.midline) return x / 311.58; let lo = 0, hi = P.length - 1; if (P[hi].x < x) return Infinity;
      while (lo < hi) { const m = (lo + hi) >> 1; if (P[m].x < x) lo = m + 1; else hi = m; } return (P[lo].tick - P[0].tick) / TPSr; };
    try { r._tl = LOOK.timeline(src.level, fireAt); } catch (e) { r._tl = null; }
  }
  if (!r._tl) return null;
  const st = LOOK.stateAt(r._tl, r.midline ? a.x / 311.58 : (a.tick - P[0].tick) / TPSr), col = st.col || st, hex = c => c ? "#" + c.slice(0, 3).map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("") : null;
  return { bg: hex(col[1000]), ground: hex(col[1001]), line: hex(col[1002]), obj: hex(col[1004]) };
}
// a slope's square corner, so pictures draw the ramp, not a block: "/" floor rising right, "\\" floor falling, "7" a
// ceiling whose underside goes down to the right, "r" one going up (lib/physics.js: up / ceil / down)
function slopeCorner(it) { return it.ceil ? (it.down === 1 ? "7" : "r") : (it.up === -1 ? "\\" : "/"); }
function flyShape(cols, mode) {
  const n = cols.length, near = 8;
  const floorNear = cols.filter(c => c.fk !== "G" && c.fk !== "E" && c.py - c.f <= near || (c.fk === "G" && c.py <= 3)).length / n;
  const roofNear = cols.filter(c => c.r != null && c.rk !== "E" && c.r - c.py <= near).length / n;
  const gaps = cols.filter(c => c.r != null && c.rk !== "E").map(c => c.r - c.f);
  const gap = median(gaps);
  const walls = cols.reduce((s, c) => s + (c.fk === "H") + (c.rk === "H"), 0), wallsAll = cols.reduce((s, c) => s + 1 + (c.r != null && c.rk !== "E"), 0);
  // gates: narrowings of 2+ blocks below the median gap, up to 5 columns long
  let gates = 0;
  if (gap != null) for (let c = 0; c < n; c++) { const g = cols[c].r != null && cols[c].rk !== "E" ? cols[c].r - cols[c].f : 99; if (g <= gap - 2 && (c === 0 || !(cols[c - 1].r != null && cols[c - 1].r - cols[c - 1].f <= gap - 2))) gates++; }
  // path turns: the path's direction changes (hysteresis half a block)
  let turns = 0, dir = 0, ext = cols[0].py;
  for (const c of cols) { if (dir >= 0 && c.py < ext - 0.5) { if (dir > 0) turns++; dir = -1; ext = c.py; } else if (dir <= 0 && c.py > ext + 0.5) { if (dir < 0) turns++; dir = 1; ext = c.py; } else ext = dir > 0 ? Math.max(ext, c.py) : dir < 0 ? Math.min(ext, c.py) : ext; }
  const slopeCols = cols.filter((c, i) => i && Math.abs(c.py - cols[i - 1].py) >= 0.5).length / n;
  let wrap = floorNear >= 0.6 && roofNear >= 0.6 ? "corridor" : floorNear >= 0.6 ? "floor path" : roofNear >= 0.6 ? "roof path" : "open";
  const spiky = walls / Math.max(1, wallsAll) >= 0.3;
  return { wrap, spiky, gates, gap: gap == null ? null : r1(gap), floorNear: r2(floorNear), roofNear: r2(roofNear), turns, slope: r2(slopeCols),
    pathKind: turns === 0 ? (slopeCols > 0.3 ? "slope" : "straight") : turns <= 2 ? "bend" : "zigzag" };
}
function groundShape(cols, p, i0, i1) {
  let floors = 0, last = null, pits = 0, top = 0;
  for (let i = i0; i <= i1; i += 4) { const q = p[i]; if (!q.grounded) continue; const f = Math.round((q.grav === -1 ? q.y + 15 : q.y - 15) / B); if (last != null && f !== last) floors++; last = f; top = Math.max(top, f); }
  for (const c of cols) if (c.fk === "H") pits++;
  const wrap = floors >= 3 ? "steps" : pits / cols.length >= 0.3 ? "pits" : cols.some(c => c.r != null && c.rk !== "E" && c.r - c.py <= 3) ? "low roof" : "flat";
  return { wrap, floors, pitShare: r2(pits / cols.length), top };
}
function signature(P) {
  const m = Object.keys(P.mech).map(k => k.replace(/ (orb|pad)$/, "-$1")).sort().join("+");
  const bits = [P.family, P.mode, P.wrap];
  if (P.family === "fly") { bits.push(P.pathKind); if (P.spiky) bits.push("spikes"); if (P.gates) bits.push("gates"); if (P.gap != null) bits.push(P.gap <= 3 ? "narrow" : P.gap <= 5.5 ? "mid" : "wide"); }
  if (P.flips) bits.push("flips");
  if (m) bits.push(m);
  return bits.join(" / ");
}

// ---------------------------------------------------------------- commands
function mine(which, sketchFiles) {
  const srcs = [];
  if (which.includes("official")) srcs.push(...officialSources());
  if (which.includes("ours")) srcs.push(...ourSources());
  if (which.includes("sketches") || sketchFiles.length) srcs.push(...sketchSources(sketchFiles));
  if (which.includes("library")) srcs.push(...librarySources());
  const pieces = [];
  for (const s of srcs) {
    const t0 = Date.now();
    let R; try { R = route(s); } catch (e) { console.log("  skip", s.name, e.message); continue; }
    const cuts = cut(R.r, R.inputs, s.whole);
    let ws = []; try { ws = windowsOf(s, R.w, R.r); } catch (e) { console.log("  no windows for", s.name, e.message); }
    for (const [i0, i1] of cuts) { const P = measure(s, R.w, R.r, R.inputs, i0, i1); Object.assign(P, pieceDifficulty(ws, R.r.path[i0].tick, R.r.path[i1].tick)); P.grain = "piece"; if (P.jitter && P.jitter < 3 && !P.tight) P.jitter = 0; pieces.push(P); }
    // bricks: the same route cut finer (not for the library's whole pieces)
    if (!s.whole) for (const [i0, i1, kind] of cut(R.r, R.inputs, { auto: true, items: R.w.items }, "brick")) { const P = measure(s, R.w, R.r, R.inputs, i0, i1); Object.assign(P, pieceDifficulty(ws, R.r.path[i0].tick, R.r.path[i1].tick)); P.grain = "brick"; if (P.jitter && P.jitter < 3 && !P.tight) P.jitter = 0; if (kind === "auto") { P.auto = true; P.sig = "auto / " + P.sig; P.empty = false; } pieces.push(P); }
    console.log(`  ${s.src.padEnd(8)} ${s.name.padEnd(34)} ${String(cuts.length).padStart(3)} pieces${R.r.dead ? " (route dies at block " + Math.round(R.r.path[R.r.path.length - 1].x / B) + ")" : ""}  ${Date.now() - t0} ms`);
  }
  pieces.forEach((p, i) => p.id = ({ official: "r", ours: "u", sketch: "s", library: "l" }[p.src] + "-" + p.level.replace(/[^a-z0-9]+/gi, "_").toLowerCase() + "-" + p.x + (p.grain === "brick" ? (p.auto ? "a" : "b") : "")));
  fs.mkdirSync(OUTDIR, { recursive: true });
  const prev = fs.existsSync(path.join(OUTDIR, "pieces.json")) ? JSON.parse(fs.readFileSync(path.join(OUTDIR, "pieces.json"), "utf8")) : [];
  const keep = prev.filter(p => !srcs.some(s => s.src === p.src));   // mining one source keeps the others
  const all = keep.concat(pieces);
  dedupe(all);
  fs.writeFileSync(path.join(OUTDIR, "pieces.json"), JSON.stringify(all));
  writeKnowledge(all);
  console.log(`${pieces.length} pieces from ${srcs.length} levels -> local/lego/pieces.json (${all.length} in all), knowledge/lego.json`);
  return all;
}
// duplicates: the same layout again (a level repeating a chunk, or two levels sharing one), even when the two cuts start
// at a different phase of it. Each piece becomes a row of columns (what is in each block column, in level coordinates);
// two pieces of one mode are the same when, at some shift, 80% of the shorter one overlaps and every overlapping column
// matches. The first keeps `copies` and `alsoIn`, the others get `dupOf`. The user, 2026-11-25: "many duplications like this".
function columns(p) {
  const m = new Map(), x0 = p.xa != null ? p.xa : p.x;
  for (const s of p.shape || []) {
    const c = Math.floor(x0 + (s[1] + s[3]) / 2 + 1e-3), k = s[0] + Math.round(s[2] * 2) / 2 + (s[6] || "");
    (m.get(c) || m.set(c, []).get(c)).push(k);
  }
  const a = Math.floor(x0 + 1e-3), out = [];
  for (let c = a; c < a + p.w; c++) out.push((m.get(c) || []).sort().join(","));
  return out;
}
function sameLayout(A, B) {   // column rows
  const nA = A.length, nB = B.length, need = Math.ceil(0.8 * Math.min(nA, nB));
  const idx = new Map(); B.forEach((k, j) => { if (k) (idx.get(k) || idx.set(k, []).get(k)).push(j); });
  const tried = new Set();
  for (let i = 0; i < nA; i++) {
    if (!A[i]) continue;
    for (const j of idx.get(A[i]) || []) {
      const sh = i - j; if (tried.has(sh)) continue; tried.add(sh);
      const lo = Math.max(0, sh), hi = Math.min(nA, nB + sh); if (hi - lo < need) continue;
      let ok = true, full = 0;
      for (let c = lo; c < hi; c++) { if (A[c] !== B[c - sh]) { ok = false; break; } if (A[c]) full++; }
      if (ok && full >= (hi - lo) / 2) return true;
    }
  }
  return false;
}
function dedupe(pieces) {
  for (const p of pieces) { delete p.dupOf; delete p.copies; delete p.alsoIn; }
  const reps = {};
  for (const p of pieces) {
    if (!(p.shape || []).length) continue;
    const C = columns(p), gk = p.mode + "|" + (p.grain || "piece"), R = reps[gk] = reps[gk] || [];
    const f = R.find(r => sameLayout(r.C, C));
    if (f) { p.dupOf = f.p.id; f.p.copies = (f.p.copies || 1) + 1; (f.p.alsoIn = f.p.alsoIn || []).push(p.level + " @" + p.x); }
    else R.push({ p, C });
  }
}
// committed: per family / signature, counts by source and parameter ranges; shapes of ours and sketches only
function writeKnowledge(allG) {
  const bricks = allG.filter(p => p.grain === "brick"), all = allG.filter(p => p.grain !== "brick");
  const fam = {};
  for (const p of all) {
    const k = p.sig, e = fam[k] = fam[k] || { sig: k, family: p.family, mode: p.mode, wrap: p.wrap, n: { official: 0, ours: 0, sketch: 0, library: 0 }, levels: { official: new Set(), ours: new Set(), sketch: new Set(), library: new Set() }, s: [], w: [], presses: [], hold: [], gap: [], yRange: [], hz: [] };
    e.n[p.src]++; e.levels[p.src].add(p.level);
    e.s.push(p.s); e.w.push(p.w); e.presses.push(p.presses); if (p.hold != null) e.hold.push(p.hold); if (p.gap != null) e.gap.push(p.gap); e.yRange.push(p.yRange); e.hz.push(p.hzPer100);
  }
  const range = a => a.length ? [Math.min(...a), median(a), Math.max(...a)] : null;
  const families = Object.values(fam).map(e => ({ sig: e.sig, family: e.family, mode: e.mode, wrap: e.wrap, n: e.n,
    officialLevels: e.levels.official.size, oursLevels: e.levels.ours.size,
    seconds: range(e.s), width: range(e.w), presses: range(e.presses), hold: range(e.hold), gap: range(e.gap), yRange: range(e.yRange), hazardsPer100: range(e.hz) }))
    .sort((a, b) => (b.n.official - a.n.official) || (b.n.ours - a.n.ours));
  const W = sigWeights(readVotes());
  for (const f of families) if (W[f.sig]) { const e = W[f.sig]; f.vote = { up: e.up, down: e.down, weight: e.weight, comments: e.comments.slice(0, 5) }; }
  const mix = {}; for (const p of all) { const m = mix[p.src] = mix[p.src] || {}; const k = p.family + "/" + p.mode + "/" + p.wrap; m[k] = (m[k] || 0) + 1; }
  const pub = all.filter(p => p.src !== "official").map(p => { const q = Object.assign({}, p); delete q.cols; if (p.src === "ours") { delete q.shape; delete q.path; } return q; });   // our levels are in the repo: rebuild their shapes with mine
  const out = { made: new Date().toISOString().slice(0, 10), physics: require("./solutions.js").physicsCommit(), note: "LEGO.md. Families and parameters of 1-3 s pieces cut from routes; official pieces as numbers only (no layouts).",
    counts: { official: all.filter(p => p.src === "official").length, ours: all.filter(p => p.src === "ours").length, sketch: all.filter(p => p.src === "sketch").length, library: all.filter(p => p.src === "library").length },
    bricks: { official: bricks.filter(p => p.src === "official").length, ours: bricks.filter(p => p.src === "ours").length,
      distinctOfficial: bricks.filter(p => p.src === "official" && !p.dupOf && !p.empty).length,
      mostRepeated: bricks.filter(p => p.src === "official" && p.copies > 1).sort((a, b) => b.copies - a.copies).slice(0, 12).map(p => ({ sig: p.sig, copies: p.copies, w: p.w, presses: p.presses })) },
    shown: { note: "what the catalogue shows by default: verified, not empty, not a duplicate, smooth when flying", n: all.filter(p => p.verified && !p.empty && !p.dupOf && p.smooth !== false).length,
      empty: all.filter(p => p.empty).length, duplicates: all.filter(p => p.dupOf).length, notSmooth: all.filter(p => p.smooth === false).length }, mix, families, pieces: pub };
  fs.writeFileSync(KNOW, JSON.stringify(out, null, 0).replace(/\},\{"sig"/g, '},\n{"sig"').replace(/\},\{"src"/g, '},\n{"src"'));
}
function load() { const f = path.join(OUTDIR, "pieces.json"); if (!fs.existsSync(f)) { console.log("no local/lego/pieces.json: run `node tools/lego.js mine official ours sketches` first"); process.exit(1); } return JSON.parse(fs.readFileSync(f, "utf8")); }
function families(all, src) {
  const rows = {};
  for (const p of all) { if (src && p.src !== src) continue; const k = p.family + " / " + p.mode + " / " + p.wrap + (p.spiky ? " +spikes" : "") + (p.gates ? " +gates" : "") + (p.flips ? " +flips" : ""); const r = rows[k] = rows[k] || { official: 0, ours: 0, sketch: 0, library: 0 }; r[p.src]++; }
  const tot = { official: 0, ours: 0, sketch: 0 }; for (const r of Object.values(rows)) for (const k in tot) tot[k] += r[k];
  console.log("family / mode / wrap".padEnd(48) + "official   ours   sketch");
  for (const [k, r] of Object.entries(rows).sort((a, b) => b[1].official - a[1].official || b[1].ours - a[1].ours))
    console.log(k.padEnd(48) + `${String(r.official).padStart(4)} ${String(Math.round(r.official / Math.max(1, tot.official) * 100)).padStart(3)}%  ${String(r.ours).padStart(4)} ${String(Math.round(r.ours / Math.max(1, tot.ours) * 100)).padStart(3)}%  ${String(r.sketch).padStart(4)}`);
}
// a level's sequence of pieces: the same signature back to back or within 4 pieces = a repeat
function variety(file) {
  const L = readGdlvl(file), S = require("./solutions.js"), sol = S.get(L.levelStr, true);
  const s = { src: "ours", name: path.basename(file), level: GD.parseLevel(L.levelStr), events: sol && sol.events };
  const R = route(s), ps = cut(R.r, R.inputs).map(([a, b]) => measure(s, R.w, R.r, R.inputs, a, b));
  let rep = 0;
  ps.forEach((p, i) => { const back = ps.slice(Math.max(0, i - 4), i).findIndex(q => q.sig === p.sig); if (back >= 0) rep++; console.log(`${String(p.x).padStart(5)}  ${p.s.toFixed(1)}s  ${back >= 0 ? "REPEAT " : "       "}${p.sig}`); });
  console.log(`${ps.length} pieces, ${rep} repeat a signature from the 4 before (${Math.round(rep / Math.max(1, ps.length) * 100)}%), ${new Set(ps.map(p => p.sig)).size} distinct`);
  return { pieces: ps.length, repeats: rep, distinct: new Set(ps.map(p => p.sig)).size };
}

// votes: Evgeni's 👍 / 👎 / comments from the catalogue. PC page -> local/lego/votes.jsonl (tools/serve.js); phone page ->
// its database (collection "legovotes": fetch with one ArtifactData list into local/lego/votes_phone.json). The newest per
// piece wins; saved to knowledge/lego_votes.json (committed) and folded into knowledge/lego.json as a weight per signature:
// 1 + 0.5 x (ups - downs), kept within 0.25..3 -- a preference, never a ban (the user, 2026-11-25).
function readVotes() {
  const last = {}, put = v => { if (v && v.id && (!last[v.id] || String(v.at) > String(last[v.id].at))) last[v.id] = v; };
  try { for (const l of fs.readFileSync(path.join(OUTDIR, "votes.jsonl"), "utf8").split("\n")) if (l.trim()) try { put(JSON.parse(l)); } catch (e) {} } catch (e) {}
  try { const d = JSON.parse(fs.readFileSync(path.join(OUTDIR, "votes_phone.json"), "utf8")); for (const r of Array.isArray(d) ? d : d.docs || d.documents || []) put(r.data || r); } catch (e) {}
  try { for (const v of JSON.parse(fs.readFileSync(VOTESK, "utf8")).votes || []) put(v); } catch (e) {}
  return last;
}
function sigWeights(votes) {
  const w = {};
  for (const v of Object.values(votes)) { if (!v.sig) continue; const e = w[v.sig] = w[v.sig] || { up: 0, down: 0, comments: [] }; if (v.vote > 0) e.up++; if (v.vote < 0) e.down++; if (v.comment) e.comments.push(v.comment); }
  for (const e of Object.values(w)) e.weight = Math.max(0.25, Math.min(3, 1 + 0.5 * (e.up - e.down)));
  return w;
}
function votesCmd() {
  const v = readVotes(), list = Object.values(v).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  for (const x of list) console.log(`${(x.vote > 0 ? "👍" : x.vote < 0 ? "👎" : "  ")} ${x.id.padEnd(34)} ${x.sig}${x.comment ? "\n     " + x.comment : ""}`);
  fs.writeFileSync(VOTESK, JSON.stringify({ note: "Evgeni's votes on lego pieces (tools/lego.js votes). A vote is a preference weight, never a ban.", votes: list }, null, 1));
  const w = sigWeights(v);
  console.log(`${list.length} votes (${list.filter(x => x.vote > 0).length} up, ${list.filter(x => x.vote < 0).length} down, ${list.filter(x => x.comment).length} with a comment) -> ${path.relative(ROOT, VOTESK)}`);
  for (const [k, e] of Object.entries(w).sort((a, b) => b[1].weight - a[1].weight)) console.log(`  weight ${e.weight.toFixed(2)}  ${k}`);
  try { writeKnowledge(load()); } catch (e) {}
}
// knobs: what makes a piece harder or easier, per mode, on the main levels' pieces. Each parameter against the piece's
// difficulty (log10 attempts from its timing windows): the rank correlation, and the parameter's median in the easiest
// and the hardest quarter. The user, 2026-11-25: "maybe think what parameters they have to make harder or easier.
// probably dont want to copy same structures just with small diff for difficulty" -- so the knobs worth turning are the
// ones that change the piece's kind (gap, speed, mechanics), not a shifted spike. -> knowledge/lego_knobs.json
const KNOBS = {
  "presses/s": p => p.presses / Math.max(0.3, p.s), "hazards/100": p => p.hzPer100, "speed": p => p.speed, "corridor gap": p => p.gap,
  "climb": p => p.yRange, "path turns": p => p.turns, "gates": p => p.gates, "held share": p => p.hold, "orbs+pads": p => Object.values(p.mech || {}).reduce((a, b) => a + b, 0),
  "floors (steps)": p => p.floors, "pits share": p => p.pitShare, "width (blocks)": p => p.w,
};
function rankCorr(xs, ys) {
  const rk = a => { const o = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]), r = new Array(a.length); o.forEach(([v, i], k) => r[i] = k); return r; };
  const n = xs.length; if (n < 8) return null; const a = rk(xs), b = rk(ys), ma = (n - 1) / 2;
  let sab = 0, sa = 0, sb = 0; for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - ma); sa += (a[i] - ma) ** 2; sb += (b[i] - ma) ** 2; }
  return sa && sb ? r2(sab / Math.sqrt(sa * sb)) : null;
}
function knobs(all) {
  const out = { made: new Date().toISOString().slice(0, 10), note: "LEGO.md 'Difficulty knobs'. Main-level pieces only; diff = log10 attempts from timing windows.", modes: {} };
  const P = all.filter(p => p.src === "official" && p.verified && !p.dupOf && p.diff != null);
  for (const mode of [...new Set(P.map(p => p.mode))]) {
    const ps = P.filter(p => p.mode === mode); if (ps.length < 12) continue;
    const ds = ps.map(p => p.diff), sorted = ds.slice().sort((a, b) => a - b), lo = sorted[Math.floor(ds.length / 4)], hi = sorted[Math.floor(ds.length * 3 / 4)];
    const tw = ps.map(p => p.tightMs).filter(v => v != null).sort((a, b) => a - b);
    const row = { n: ps.length, tightestMs: { p10: tw[Math.floor(tw.length / 10)], p25: tw[Math.floor(tw.length / 4)], median: tw[tw.length >> 1] }, diff: { p25: lo, median: sorted[ds.length >> 1], p75: hi, max: sorted[sorted.length - 1] }, tightMs: median(ps.map(p => p.tightMs).filter(v => v != null)), knobs: {} };
    for (const [k, f] of Object.entries(KNOBS)) {
      const pairs = ps.map(p => [f(p), p.diff]).filter(([v]) => v != null && isFinite(v)); if (pairs.length < 12) continue;
      const easy = pairs.filter(x => x[1] <= lo).map(x => x[0]), hard = pairs.filter(x => x[1] >= hi).map(x => x[0]);
      const tp = ps.filter(p => p.tightMs != null).map(p => [f(p), -p.tightMs]).filter(([v]) => v != null && isFinite(v));
      row.knobs[k] = { corr: rankCorr(pairs.map(x => x[0]), pairs.map(x => x[1])), tightCorr: rankCorr(tp.map(x => x[0]), tp.map(x => x[1])), easy: r2(median(easy)), hard: r2(median(hard)) };
    }
    out.modes[mode] = row;
  }
  fs.writeFileSync(path.join(ROOT, "knowledge", "lego_knobs.json"), JSON.stringify(out, null, 1));
  for (const [m, r] of Object.entries(out.modes)) {
    console.log(`\n${m}: ${r.n} pieces, difficulty p25 ${r.diff.p25} / median ${r.diff.median} / p75 ${r.diff.p75} / max ${r.diff.max}, tightest window p10 ${r.tightestMs.p10} / p25 ${r.tightestMs.p25} / median ${r.tightestMs.median} ms`);
    for (const [k, v] of Object.entries(r.knobs).sort((a, b) => Math.abs(b[1].corr || 0) - Math.abs(a[1].corr || 0)).slice(0, 6)) console.log(`   ${k.padEnd(16)} corr ${String(v.corr).padStart(5)}  vs tightness ${String(v.tightCorr).padStart(5)}   easy quarter ${v.easy}  hard quarter ${v.hard}`);
  }
  return out;
}
module.exports = { knobs, officialSources, ourSources, heldAt, readVotes, sigWeights, cut, measure, route, signature, FAMILY, mine, load, dedupe, columns, sameLayout };

if (require.main === module) {
  const A = process.argv.slice(2), cmd = A[0];
  const opt = k => { const i = A.indexOf("--" + k); return i >= 0 ? A[i + 1] : null; };
  if (cmd === "mine") {
    const which = A.slice(1).filter(a => !a.startsWith("--") && !/\.json$/.test(a));
    const sk = A.filter((a, i) => A[i - 1] === "--sketch");
    mine(which.length ? which : ["official", "ours", "sketches", "library"], sk);
  } else if (cmd === "families") families(load(), opt("src"));
  else if (cmd === "variety") variety(A[1]);
  else if (cmd === "votes") votesCmd();
  else if (cmd === "knobs") knobs(load());
  else if (cmd === "page") require("./lego_page.js").build(load(), { pub: A.includes("--public"), priv: A.includes("--private"), out: opt("out") });
  else console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("// node")).join("\n"));
}
