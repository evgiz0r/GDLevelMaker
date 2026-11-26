// Hazards (spikes, saws, pit spikes, hazard blocks) as rated levels use them, and a generator that places them the same way.
// HAZARDS.md has the study, the numbers and the rules; tools/hazards.js is the CLI (study, level, ref); score.js gate "hazards".
//
//   GD.hazardRecords(objects, path?)  -> one record per hazard: kind, size, what holds it up (ground / top of a block /
//                                        under a block / side / floating), its distance to the player's path and its role
//                                        (threat: the path passes within a block; guard: 1-3 blocks, frames the lane and
//                                        shuts other ways; fill: further, pit floors and scenery), dressing (deco on it).
//   GD.hazardStats(objects, path?)    -> the numbers HAZARDS.md compares (shares, runs, spacing, lane bounds, dressing).
//   GD.hazardsAlongPath(path, objects, opts) -> new hazard objects that follow a planned path: threats where the path
//                                        rises over something (jumps), guards along the lane's other side, pit floors under
//                                        long jumps, and nothing within opts.clear units of the path (default 1 block).
//
// path = GD.run(world, events).path (states with x, y, mode, mini, floorY, ceilY; frame states go through GD.worldXY).
// Runs in node and the browser (no dependencies but lib/objects.js and lib/physics.js).
(function (GD) {
  "use strict";
  if (typeof module !== "undefined" && typeof require !== "undefined" && !GD.objInfo) Object.assign(GD, require("./objects.js"));

  const B = 30;
  const GROUND_PIT = new Set([9, 61, 421, 446, 667, 989, 1715, 1716, 1719, 1720, 368, 919]);  // low floor "pit" spikes (fill rows)
  const isHaz = o => { const d = GD.objInfo(o.id); return d.kind === "hazard"; };
  const isSolid = o => { const d = GD.objInfo(o.id); return d.kind === "solid" || d.kind === "slope"; };
  const shapeOf = o => { const d = GD.objInfo(o.id); return d.shape === "saw" ? "saw" : GROUND_PIT.has(o.id) ? "pit" :
    d.shape === "spike" || d.shape === "midspike" || d.shape === "smallspike" ? d.shape : "spike-other"; };

  // a uniform grid of objects by 30-unit cell, for neighbour lookups
  function grid(objs) {
    const g = new Map();
    const key = (cx, cy) => cx * 100003 + cy;
    for (const o of objs) {
      const k = key(Math.floor(o.x / B), Math.floor(o.y / B));
      let a = g.get(k); if (!a) g.set(k, a = []); a.push(o);
    }
    return { at(x, y) { return g.get(key(Math.floor(x / B), Math.floor(y / B))) || []; },
      near(x, y, r) { const out = []; for (let cx = Math.floor((x - r) / B); cx <= Math.floor((x + r) / B); cx++)
        for (let cy = Math.floor((y - r) / B); cy <= Math.floor((y + r) / B); cy++) { const a = g.get(key(cx, cy)); if (a) out.push(...a); } return out; } };
  }
  // a point inside some solid's hitbox (with tolerance t)?
  function solidAt(G, x, y, t) {
    if (y <= 0 + (t || 0) && y > -B * 3) return "ground";
    for (const o of G.near(x, y, B * 1.5)) { const h = GD.hitbox(o); if (!h) continue;
      if (x >= h.x0 - t && x <= h.x1 + t && y >= h.y0 - t && y <= h.y1 + t) return "block"; }
    return null;
  }
  // the direction a hazard's base faces: 0 down (on a floor), 1 left, 2 up (hanging), 3 right; saws have none
  function baseDir(o) {
    let q = GD.quarter(o); if (o.flipY) q = (q + 2) % 4;
    return [0, 3, 2, 1][q];   // clockwise turns: base down -> left -> up -> right
  }
  function support(o, GS, GH) {
    if (shapeOf(o) === "saw") return "saw";
    const dir = baseDir(o), half = B / 2 * (GD.scaleOf(o)[1] || 1);
    const [dx, dy] = [[0, -1], [-1, 0], [0, 1], [1, 0]][dir];
    const px = o.x + dx * (half + 3), py = o.y + dy * (half + 3);
    const s = solidAt(GS, px, py, 4);
    if (!s) return GH && GH.near(px, py, 20).some(h => h !== o && Math.abs(h.x - px) <= 12 && Math.abs(h.y - py) <= 16) ? "stack" : "float";
    if (dir === 0) return s === "ground" ? "ground" : "top";
    if (dir === 2) return "under";
    return "side";
  }

  // the path as world positions, one per tick, sorted by x for lookups (a run goes forward, so it is nearly sorted)
  function pathPts(path) {
    const pts = [];
    for (const s of path || []) { const [x, y] = s.wx || (GD.worldXY ? GD.worldXY(s) : [s.x, s.y]);
      pts.push({ x, y, t: s.tick, mode: s.mode, mini: !!s.mini, fl: s.floorY, ce: s.ceilY, dead: s.dead, gr: !!s.grounded, grav: s.grav || 1 }); }
    const byX = pts.slice().sort((a, b) => a.x - b.x);
    return { pts, byX };
  }
  function lowerBound(a, x) { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m].x < x) lo = m + 1; else hi = m; } return lo; }
  // the player's states with x in [x0, x1]
  function statesIn(P, x0, x1) { const out = []; for (let i = lowerBound(P.byX, x0); i < P.byX.length && P.byX[i].x <= x1; i++) out.push(P.byX[i]); return out; }
  // distance between the player's box and a hazard's box (0 = touching)
  function boxGap(p, h) {
    const r = (p.mini ? 0.6 : 1) * B / 2;
    const gx = Math.max(h.x0 - (p.x + r), (p.x - r) - h.x1, 0), gy = Math.max(h.y0 - (p.y + r), (p.y - r) - h.y1, 0);
    return Math.hypot(gx, gy);
  }

  const ROLE = { threat: B, guard: 3 * B };     // gap to the path: < 1 block threat, < 3 blocks guard, else fill

  function hazardRecords(objects, path) {
    const objs = objects.filter(o => o && Number.isFinite(o.x) && Number.isFinite(o.y));
    const solids = objs.filter(isSolid), GS = grid(solids), GH = grid(objs.filter(isHaz));
    const deco = objs.filter(o => { const k = GD.objInfo(o.id).kind; return k === "decoration"; }), GDc = grid(deco);
    const P = path ? pathPts(path) : null;
    const out = [];
    for (const o of objs) {
      if (!isHaz(o)) continue;
      const h = GD.hitbox(o); if (!h) continue;
      const r = { o, id: o.id, x: o.x, y: o.y, shape: shapeOf(o), sup: support(o, GS, GH), dir: baseDir(o),
        scale: +(GD.scaleOf(o)[1] || 1).toFixed(2), ch: +((o.props || {})["21"] || 0) };
      // dressing: deco whose centre sits on the hazard (within a third of a block) -- glow, outline, a detail sprite
      const on = GDc.near(o.x, o.y, 12).filter(d => Math.abs(d.x - o.x) <= 10 && Math.abs(d.y - o.y) <= 10);
      r.dressed = on.length > 0; if (on.length) r.dressIds = on.map(d => d.id);
      if (P) {
        const near = statesIn(P, h.x0 - 2 * B, h.x1 + 2 * B);
        let gap = Infinity, at = null;
        for (const p of near) { const g = boxGap(p, h); if (g < gap) { gap = g; at = p; } }
        r.gap = gap; r.seen = !!at;
        if (at) { r.t = at.t; r.mode = at.mode; r.side = (h.y0 + h.y1) / 2 >= at.y ? "above" : "below"; }
        r.role = !at ? "off" : gap < ROLE.threat ? "threat" : gap < ROLE.guard ? "guard" : "fill";
      }
      out.push(r);
    }
    return out;
  }

  // runs of hazards side by side on one row (x step <= 1 block, same y within 4 units, same base direction)
  function runs(recs) {
    const rows = new Map();
    for (const r of recs) { if (r.shape === "saw" || r.shape === "pit") continue;
      const k = Math.round(r.y / 4) + ":" + r.dir; let a = rows.get(k); if (!a) rows.set(k, a = []); a.push(r); }
    const lens = [];
    for (const a of rows.values()) { a.sort((p, q) => p.x - q.x); let n = 1;
      for (let i = 1; i <= a.length; i++) { if (i < a.length && a[i].x - a[i - 1].x <= B + 1) n++; else { lens.push(n); n = 1; } } }
    return lens;
  }

  // lane bounds: every block along the path, the first thing just above and just below the player within 4 blocks:
  // a hazard, a solid (blocks, the ground, a flying mode's floor and ceiling) or nothing. Per mode group (cube-like / flying).
  function laneBounds(objects, path) {
    const P = pathPts(path), objs = objects.filter(o => isHaz(o) || isSolid(o)), G = grid(objs);
    const blank = () => ({ n: 0, above: { haz: 0, solid: 0, open: 0 }, below: { haz: 0, solid: 0, open: 0 } });
    const res = { ground: blank(), fly: blank() };
    if (!P.byX.length) return res;
    const x0 = P.byX[0].x, x1 = P.byX[P.byX.length - 1].x;
    for (let x = x0 + B; x < x1; x += B) {
      const st = statesIn(P, x - 4, x + 4); if (!st.length) continue;
      const p = st[0], R = GROUNDED.has(p.mode) ? res.ground : res.fly; R.n++;
      const r = (p.mini ? 0.6 : 1) * B / 2;
      for (const dir of [1, -1]) {
        let best = "open", bd = 4 * B;
        for (const o of G.near(x, p.y + dir * 2.5 * B, 2.6 * B)) {
          const h = GD.hitbox(o); if (!h || x < h.x0 - 15 || x > h.x1 + 15) continue;
          const d = dir > 0 ? h.y0 - (p.y + r) : (p.y - r) - h.y1;
          if (d < -4 || d >= bd) continue; bd = d; best = isHaz(o) ? "haz" : "solid";
        }
        const edge = dir > 0 ? (Number.isFinite(p.ce) && p.ce < 1e5 ? p.ce - (p.y + r) : Infinity) : (p.y - r) - (Number.isFinite(p.fl) ? p.fl : 0);
        if (edge >= -4 && edge < bd) best = "solid";
        R[dir > 0 ? "above" : "below"][best]++;
      }
    }
    return res;
  }
  const GROUNDED = new Set(["cube", "robot", "ball", "spider"]);

  // the cube's (and robot's) air arcs: from leaving a surface to the next landing, at least 0.15 s long
  function arcs(path) {
    const P = pathPts(path), out = []; let cur = null;
    for (const p of P.pts) {
      const air = !p.gr && (p.mode === "cube" || p.mode === "robot");
      if (air) { if (!cur) cur = { x0: p.x, t0: p.t, yMin: p.y, yMax: p.y, pts: [] }; cur.x1 = p.x; cur.t1 = p.t; cur.pts.push(p);
        cur.yMax = Math.max(cur.yMax, p.y); cur.yMin = Math.min(cur.yMin, p.y); }
      else if (cur) { if (cur.t1 - cur.t0 >= 36) out.push(cur); cur = null; }
    }
    return out;
  }
  // what is under each arc: the hazards (threat or guard) whose x falls inside it, at u = 0 (take-off) .. 1 (landing)
  function arcProfile(recs, path) {
    const A = arcs(path), bins = [0, 0, 0, 0, 0]; let withHaz = 0, under = 0, above = 0;
    const hs = recs.filter(r => r.role === "threat" || r.role === "guard").sort((a, b) => a.x - b.x);
    for (const a of A) {
      let any = false;
      for (const r of hs) { if (r.x < a.x0) continue; if (r.x > a.x1) break;
        const u = (r.x - a.x0) / Math.max(1, a.x1 - a.x0);
        if (r.side === "below") { bins[Math.min(4, Math.floor(u * 5))]++; under++; any = true; } else above++; }
      if (any) withHaz++;
    }
    const tot = bins.reduce((x, y) => x + y, 0) || 1;
    return { jumps: A.length, withHazard: A.length ? +(100 * withHaz / A.length).toFixed(1) : 0,
      underPerJump: A.length ? +(under / A.length).toFixed(2) : 0, abovePerJump: A.length ? +(above / A.length).toFixed(2) : 0,
      where: bins.map(b => +(100 * b / tot).toFixed(1)) };
  }

  function hazardStats(objects, path) {
    const recs = hazardRecords(objects, path);
    const n = recs.length, pct = (k, f) => n ? +(100 * recs.filter(f).length / n).toFixed(1) : 0;
    const solids = objects.filter(isSolid);
    const xs = objects.filter(o => isHaz(o) || isSolid(o)).map(o => o.x);
    const span = xs.length ? (Math.max(...xs) - Math.min(...xs)) / B : 0;
    const shapes = {}, sups = {}; for (const r of recs) { shapes[r.shape] = (shapes[r.shape] || 0) + 1; sups[r.sup] = (sups[r.sup] || 0) + 1; }
    const share = o => { const t = {}; for (const k in o) t[k] = +(100 * o[k] / (n || 1)).toFixed(1); return t; };
    const rl = runs(recs), rh = { 1: 0, 2: 0, 3: 0, "4+": 0 }; for (const l of rl) rh[l >= 4 ? "4+" : l]++;
    const blockCh = new Map(); for (const s of solids) { const c = +((s.props || {})["21"] || 0); blockCh.set(c, (blockCh.get(c) || 0) + 1); }
    const st = { hazards: n, per100: span ? +(100 * n / span).toFixed(1) : 0, shapes: share(shapes), support: share(sups),
      runs: rh, rotated: pct(0, r => r.dir === 1 || r.dir === 3), hanging: pct(0, r => r.dir === 2),
      scaled: pct(0, r => r.scale !== 1), dressed: pct(0, r => r.dressed),
      ownChannel: pct(0, r => r.ch && !blockCh.has(r.ch)), kinds: new Set(recs.map(r => r.id)).size };
    if (path) {
      const seen = recs.filter(r => r.seen), m = seen.length || 1, by = f => +(100 * seen.filter(f).length / m).toFixed(1);
      st.role = { threat: by(r => r.role === "threat"), guard: by(r => r.role === "guard"), fill: by(r => r.role === "fill") };
      st.guardAbove = by(r => r.role === "guard" && r.side === "above");
      st.guardBelow = by(r => r.role === "guard" && r.side === "below");
      // obstacles: threats grouped in time (a new one after 0.25 s with none); spacing between obstacles in seconds
      const thr = seen.filter(r => r.role === "threat").map(r => r.t).sort((a, b) => a - b);
      const obs = []; for (const t of thr) { if (!obs.length || t - obs[obs.length - 1].t1 > 60) obs.push({ t0: t, t1: t, n: 1 }); else { obs[obs.length - 1].t1 = t; obs[obs.length - 1].n++; } }
      const gaps = obs.slice(1).map((o, i) => (o.t0 - obs[i].t1) / 240).sort((a, b) => a - b);
      const q = f => gaps.length ? +gaps[Math.min(gaps.length - 1, Math.floor(f * gaps.length))].toFixed(2) : 0;
      st.obstacles = obs.length; st.obsGap = { p25: q(0.25), p50: q(0.5), p90: q(0.9) };
      st.perObstacle = obs.length ? +(thr.length / obs.length).toFixed(2) : 0;
      st.lane = laneBounds(objects, path);
      st.arcs = arcProfile(seen, path);
      const P = pathPts(path), secs = P.pts.length / 240;
      st.nearPerSec = secs ? +(seen.filter(r => r.role !== "fill").length / secs).toFixed(2) : 0;
      // threats by mode, and the median gap of threats (how close the path passes)
      const g = seen.filter(r => r.role === "threat").map(r => r.gap).sort((a, b) => a - b);
      st.threatGapMed = g.length ? +g[g.length >> 1].toFixed(1) : 0;
    }
    return st;
  }


  // ---------------------------------------------------------------- the generator
  // hazardsAlongPath(path, objects, opts) -> { objects: [new hazards and their holding blocks], notes }
  // Places hazards the way rated levels do around a path that is already planned (HAZARDS.md "Rules"):
  //  - threats under each cube / robot / pad air arc: a run of spikes on the surface under the arc, centred where the arc is
  //    highest, 1-4 by tier and arc length (rated: 72-83% of jumps have a hazard under them, 2-4 each, spread over the arc);
  //  - lane walls in flying stretches (ship, wave, ufo, swing, and grounded-mode rides with no surface near): a block line
  //    that follows the path's own contour 2-3 blocks off it, with spike runs where the path comes closest to the wall
  //    (guards: rated levels keep ~45% of their hazards 1-3 blocks from the path);
  //  - leaks (opts.leaks: paths a stray press takes, e.g. tools/autobeat.js strays()): blocked ON the wall line where
  //    the leak crosses it, as a run of 3, so the block reads as part of the frame and not a lone saw;
  //  - pit floors: low pit spikes on the ground under arcs whose take-off and landing are on blocks 2+ blocks up.
  // Nothing new comes within opts.clear units (default 8) of the player's box anywhere on the path; blocks keep 15.
  // opts.verify = {header, events}: replays the path with the new objects and drops the new piece nearest each death.
  // under: share of an arc's columns that get a spike (at least 1); wall: blocks between the path and a lane piece;
  // spikeEvery sets how far apart lane pieces go (2 * spikeEvery + 2 columns). Fitted by stripping the main levels'
  // hazards and placing new ones on the same path (tools/hazards_try.js official:N; HAZARDS.md "Generator").
  const TIER = { easy: { under: 0.5, wall: 3, spikeEvery: 4 }, normal: { under: 0.8, wall: 2.5, spikeEvery: 3 },
    hard: { under: 1.0, wall: 2, spikeEvery: 2 } };
  function hazardsAlongPath(path, objects, opts) {
    opts = opts || {};
    const tier = TIER[opts.tier] || TIER.normal, clear = opts.clear != null ? opts.clear : 8;
    let seed = (opts.seed || 1) >>> 0; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const P = pathPts(path), objs = (objects || []).filter(o => o && Number.isFinite(o.x));
    const solids = objs.filter(isSolid), GS = grid(solids);
    const busy = grid(objs.filter(o => { const k = GD.objInfo(o.id).kind; return k !== "decoration" && k !== "trigger"; }));
    const out = [], notes = { threats: 0, walls: 0, wallSpikes: 0, leakBlocks: 0, pits: 0, dropped: 0 };
    const mine = grid([]); const placed = [];
    const add = o => { placed.push(o); out.push(o); };
    const gapTo = (o, need) => { const h = GD.hitbox(o) || { x0: o.x - 15, x1: o.x + 15, y0: o.y - 15, y1: o.y + 15 };
      for (const p of statesIn(P, h.x0 - B, h.x1 + B)) if (boxGap(p, h) < need) return false; return true; };
    const free = (x, y) => !busy.near(x, y, 16).some(o => Math.abs(o.x - x) < 15 && Math.abs(o.y - y) < 15) &&
      !placed.some(o => Math.abs(o.x - x) < 15 && Math.abs(o.y - y) < 15);
    const nearPlay = x => busy.near(x, 0, 0).length && false;   // reserved
    const col = x => Math.floor(x / B) * B + B / 2;
    // the surface under (dir -1) or over (dir 1) a point: the nearest solid face, or the ground (y 0) below
    const surface = (x, y, dir) => {
      let best = dir < 0 ? 0 : Infinity;
      for (let cy = Math.floor(y / B); dir < 0 ? cy >= -1 : cy < Math.floor(y / B) + 12; cy += dir) {
        for (const o of GS.at(x, cy * B + B / 2)) { const h = GD.hitbox(o); if (!h || x < h.x0 || x > h.x1) continue;
          if (dir < 0 && h.y1 <= y && h.y1 > best) best = h.y1; if (dir > 0 && h.y0 >= y && h.y0 < best) best = h.y0; }
        if (dir < 0 && cy * B < best) break; if (dir > 0 && cy * B > best) break;
      }
      return best;
    };
    // the player's y range at a column
    const yAt = x => { const st = statesIn(P, x - 15, x + 15); if (!st.length) return null;
      let lo = Infinity, hi = -Infinity, gr = 0, grav = 1; for (const p of st) { lo = Math.min(lo, p.y); hi = Math.max(hi, p.y); if (p.gr) gr++; }
      return { lo, hi, gr: gr / st.length, mode: st[0].mode, mini: st[0].mini }; };

    // 1. threats under air arcs
    for (const a of arcs(path)) {
      const cols = []; for (let x = col(a.x0) + B; x <= a.x1 - B / 2; x += B) cols.push(x);
      if (!cols.length) continue;
      const upside = a.pts[0] && a.pts[0].grav < 0;
      // skip arcs that already have something of the level's under them
      if (cols.some(x => busy.near(x, a.yMin - 2 * B, 2 * B).some(o => isHaz(o) && Math.abs(o.x - x) < 16))) continue;
      const k = Math.max(1, Math.min(cols.length, Math.round(cols.length * tier.under + (rnd() - 0.5))));
      let apex = 0; a.pts.forEach((p, i) => { if (p.y > a.pts[apex].y) apex = i; });
      const ci = Math.max(0, Math.min(cols.length - 1, Math.round((a.pts[apex].x - cols[0]) / B)));
      let s0 = Math.max(0, Math.min(cols.length - k, ci - (k >> 1)));
      for (let i = s0; i < s0 + k; i++) {
        const x = cols[i], yr = yAt(x); if (!yr) continue;
        let o;
        if (upside) { const sy = surface(x, yr.hi + 15, 1); if (!Number.isFinite(sy) || sy - (yr.hi + 15) > 3 * B) continue; o = { id: 8, x, y: sy - 15, flipY: true }; }
        else { const sy = surface(x, yr.lo - 15, -1); if (yr.lo - 15 - sy > 3 * B) continue;   // nothing near under it: a pit, not a threat
          o = { id: 8, x, y: sy + 15 }; }
        if (!free(o.x, o.y) || !gapTo(o, clear)) continue;
        add(o); notes.threats++;
      }
    }
    // 2. lane walls along flying stretches: blocks on the path's contour 2-3 blocks off it, spikes where it comes closest
    const FLY = m => !GROUNDED.has(m);
    if (opts.walls !== false && P.byX.length) {
      const x0 = col(P.byX[0].x) + B, x1 = P.byX[P.byX.length - 1].x - B;
      const off = tier.wall * B;
      const run = [];   // per column {x, top, bot}
      for (let x = x0; x <= x1; x += B) { const yr = yAt(x); if (yr && FLY(yr.mode)) run.push({ x, lo: yr.lo, hi: yr.hi }); else run.push(null); }
      // the contour: over +-2 columns, so the wall follows the path's line, not every wiggle
      const W = 2;
      for (let i = 0; i < run.length; i++) { const r = run[i]; if (!r) continue;
        let lo = r.lo, hi = r.hi; for (let j = Math.max(0, i - W); j <= Math.min(run.length - 1, i + W); j++) if (run[j]) { lo = Math.min(lo, run[j].lo); hi = Math.max(hi, run[j].hi); }
        r.top = Math.ceil((hi + 15 + off) / B) * B; r.bot = Math.floor((lo - 15 - off) / B) * B; r.gapT = r.top - (r.hi + 15); r.gapB = (r.lo - 15) - r.bot; }
      // pieces, not a continuous wall: at each spot where the path comes closest to the line (a local minimum of the gap,
      // or every `every` columns on a straight), a 2-3 column block with spikes on its path side -- the "floating block
      // with spikes" frame of rated ship parts (CRAFT.md) -- at most one piece per `space` columns per side
      const space = tier.spikeEvery * 2 + 2, every = space + 2;
      for (const side of ["top", "bot"]) {
        let last = -1e9;
        for (let i = 0; i < run.length; i++) { const r = run[i]; if (!r) continue;
          const g = side === "top" ? "gapT" : "gapB", lm = (!run[i - 1] || run[i - 1][g] >= r[g]) && (!run[i + 1] || run[i + 1][g] >= r[g]);
          if (!(lm || i - last >= every) || i - last < space) continue;
          const w = 1 + Math.floor(rnd() * 3), lineY = side === "top" ? r.top : r.bot;
          if (side === "bot" && lineY <= 0) { // the floor is the ground: a spike run on it, if it is near enough to matter
            if (r.lo - 15 > 3 * B) continue; }
          const piece = [];
          for (let j = 0; j < w; j++) { const x = r.x + (j - (w >> 1)) * B;
            if (side === "top") piece.push({ id: 1, x, y: lineY + 15 }, { id: 8, x, y: lineY - 15, flipY: true });
            else if (lineY > 0) piece.push({ id: 1, x, y: lineY - 15 }, { id: 8, x, y: lineY + 15 });
            else piece.push({ id: 8, x, y: 15 }); }
          if (!piece.every(o => free(o.x, o.y) && gapTo(o, o.id === 1 ? 15 : clear))) continue;
          for (const o of piece) { add(o); if (o.id === 1) notes.walls++; else notes.wallSpikes++; }
          last = i;
        }
      }
    }
    // 3. leaks: block each where it leaves the path by the wall distance, as a run of 3 on that line
    for (const lk of opts.leaks || []) {
      const lp = lk.path || lk; let hit = null;
      for (const q of lp) { const yr = yAt(q.x); if (!yr) continue;
        const d = q.y > yr.hi ? q.y - yr.hi : q.y < yr.lo ? yr.lo - q.y : 0;
        if (d >= Math.min(1.5 * B, tier.wall * B)) { hit = { x: col(q.x), y: q.y, up: q.y > yr.hi, yr }; break; } }
      if (!hit) continue;
      for (const dx of [0, -B, B]) {
        const x = hit.x + dx, yr = yAt(x) || hit.yr;
        const y = hit.up ? Math.round((hit.y) / B) * B + 15 : Math.round(hit.y / B) * B - 15;
        const o = { id: 8, x, y, flipY: hit.up };
        if (!free(o.x, o.y) || !gapTo(o, clear + 7)) continue;
        add(o); notes.leakBlocks++;
      }
    }
    // 4. pit floors: low pit spikes on the ground under arcs that start and end on blocks 2+ blocks up
    if (opts.pits !== false) for (const a of arcs(path)) {
      const yA = a.pts[0].y, yB = a.pts[a.pts.length - 1].y;
      if (Math.min(yA, yB) - 15 < 2 * B) continue;
      for (let x = col(a.x0) + B; x <= a.x1 - B / 2; x += B) {
        if (surface(x, Math.min(yA, yB) - 16, -1) > 0) continue;
        const o = { id: 9, x, y: 2 };
        if (!free(o.x, o.y) || !gapTo(o, clear)) continue;
        add(o); notes.pits++;
      }
    }
    // 5. replay check: drop the new piece nearest each death until the path lives again
    if (opts.verify && GD.makeWorld && GD.run) {
      for (let k = 0; k < 40; k++) {
        const w = GD.makeWorld(objs.concat(out), opts.verify.header), q = GD.run(w, opts.verify.events || []);
        const e = q.path[q.path.length - 1]; if (!q.dead) break;
        const [ex, ey] = GD.worldXY ? GD.worldXY(e) : [e.x, e.y];
        let bi = -1, bd = Infinity; out.forEach((o, i) => { const d = Math.hypot(o.x - ex, o.y - ey); if (d < bd) { bd = d; bi = i; } });
        if (bi < 0 || bd > 4 * B) { notes.verifyFailed = { x: ex, why: q.why }; break; }
        out.splice(bi, 1); notes.dropped++;
      }
    }
    return { objects: out, notes };
  }

  Object.assign(GD, { hazardsAlongPath, HAZ_TIER: TIER, hazardArcs: arcs, hazardArcProfile: arcProfile, hazardRecords, hazardStats, hazardRuns: runs, hazardLane: laneBounds, HAZ_ROLE: ROLE });
})(typeof module !== "undefined" ? module.exports : (window.GD = window.GD || {}));
