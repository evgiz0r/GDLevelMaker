// Music sync: where a level's actions fall on its song's beat grid.
//
// A beat grid is {period, t0} in song seconds (from tools/beats.js): beat k is at t0 + k*period.
// Level time 0 is song time `offset` (the level's kA13). "Level beat" b counts from 1 = the first
// beat at or after the level starts, so "jump on beat 12" means level beat 12; fractions are fine
// (12.5 = the "and" after beat 12).
// Runs in node and in the browser, like the rest of lib/.
(function (GD) {
  "use strict";
  const PH = (typeof module !== "undefined" && typeof require !== "undefined") ? require("./physics.js") : GD;

  // ---- level time <-> x, through the speed portals (touching = the player's box reaches the
  // portal's box, as in physics.js; height is ignored, so a speed portal off the path still counts)
  function timeline(world) {
    const C = PH.PHYS, ups = sp => PH.SPEEDS[sp].x * 60;
    const portals = world.items.filter(b => b.kind === "speed").map(b => ({ x: b.x0 - C.SIZE / 2, sp: b.d.speed })).sort((a, b) => a.x - b.x);
    const segs = [{ x: 0, t: 0, v: ups(world.startSpeed) }];
    for (const p of portals) {
      const last = segs[segs.length - 1];
      if (p.x <= last.x) { last.v = ups(p.sp); continue; }
      segs.push({ x: p.x, t: last.t + (p.x - last.x) / last.v, v: ups(p.sp) });
    }
    return segs;
  }
  function tOfX(tl, x) { let s = tl[0]; for (const g of tl) if (g.x <= x) s = g; return s.t + (x - s.x) / s.v; }
  function xOfT(tl, t) { let s = tl[0]; for (const g of tl) if (g.t <= t) s = g; return s.x + (t - s.t) * s.v; }
  function speedAtT(tl, t) { let s = tl[0]; for (const g of tl) if (g.t <= t) s = g; return s.v; }

  // ---- beat grid
  // level beat b (1 = first beat at or after the level start) -> level time
  function beatToTime(grid, offset, b) {
    const k1 = Math.ceil((offset - grid.t0) / grid.period - 1e-9);
    return grid.t0 + (k1 + b - 1) * grid.period - offset;
  }
  // level time -> level beat (fractional)
  function timeToBeat(grid, offset, t) {
    const k1 = Math.ceil((offset - grid.t0) / grid.period - 1e-9);
    return (t + offset - grid.t0) / grid.period - k1 + 1;
  }

  // ---- press windows from a known solution
  // For each press, shift it (and its release, keeping the hold length) one 240 Hz step at a time
  // and replay; the window is the run of shifts that still beats the level with everything else
  // unchanged. A shifted run counts as fine once it is back on the original run's exact state.
  function pressWindows(world, events, maxShift) {
    maxShift = maxShift || 72; // 0.3 s each way
    const base = PH.run(world, events).path;
    if (!base[base.length - 1].done) return null;
    const ev = events.slice().sort((a, b) => a.tick - b.tick);
    const out = [];
    const same = (a, b) => Math.abs(a.y - b.y) < 1e-6 && Math.abs(a.vy - b.vy) < 1e-6 && a.grav === b.grav && a.sp === b.sp &&
      a.mode === b.mode && !!a.grounded === !!b.grounded && !!a.dashing === !!b.dashing && a.used.length === b.used.length;
    for (let i = 0; i < ev.length; i++) {
      if (ev[i].type !== "press") continue;
      const r = ev.findIndex((e, j) => j > i && e.type === "release");
      const prevRel = ev.slice(0, i).reverse().find(e => e.type === "release");
      const nextPress = ev.find((e, j) => j > i && e.type === "press");
      const p0 = ev[i].tick, r0 = r >= 0 ? ev[r].tick : null;
      const ok = d => {
        const pt = p0 + d, rt = r0 === null ? null : r0 + d;
        if (pt < 0 || (prevRel && pt <= prevRel.tick) || (nextPress && rt !== null && rt >= nextPress.tick)) return false;
        const map = new Map();
        for (let j = 0; j < ev.length; j++) if (j !== i && j !== r) map.set(ev[j].tick, ev[j].type);
        map.set(pt, "press"); if (rt !== null) map.set(rt, "release");
        const t0 = Math.min(p0, pt), tEnd = Math.max(r0 === null ? p0 : r0, rt === null ? pt : rt);
        const s = clone(base[t0]);
        let held = isHeld(ev, t0);
        while (!s.dead && !s.done) {
          if (s.tick > tEnd && s.tick < base.length && same(s, base[s.tick])) return true;
          const e = map.get(s.tick);
          let press = false;
          if (e === "press") { press = true; held = true; }
          if (e === "release") held = false;
          PH.step(world, s, { press, held });
          if (s.tick > base.length + 2400) return false;
        }
        return !!s.done;
      };
      let lo = 0, hi = 0;
      while (lo > -maxShift && ok(lo - 1)) lo--;
      while (hi < maxShift && ok(hi + 1)) hi++;
      out.push({ tick: p0, lo: p0 + lo, hi: p0 + hi, hold: r0 === null ? 0 : r0 - p0, act: base[Math.min(p0 + 1, base.length - 1)].act || "" });
    }
    return { windows: out, path: base };
  }
  function isHeld(ev, tick) { let h = false; for (const e of ev) { if (e.tick >= tick) break; h = e.type === "press"; } return h; }
  function clone(s) { return JSON.parse(JSON.stringify(s)); }

  // ---- what in a level happens when (level seconds). Each event: {t0, t1, mid, kind, sub, label}.
  // t0..t1 is the span in which doing it works (a press window, the time the cube overlaps an orb);
  // pads, portals and obstacles are points. Objects are timed when the player's centre passes the
  // object's centre: that is how the official levels line up with the beat (portals sit on the
  // beat to within 0.04 beat by their centre, but 0.3 beat early by first contact; SYNC.md).
  function levelEvents(world, tl, windows) {
    const C = PH.PHYS, out = [];
    if (windows) for (const w of windows) out.push({ kind: "press", sub: "press", t0: w.lo / C.TPS, t1: (w.hi + 1) / C.TPS, mid: w.tick / C.TPS, label: w.act || "press" });
    const items = world.items.slice().sort((a, b) => a.x0 - b.x0);
    let cluster = null;
    for (const b of items) {
      const cx = (b.x0 + b.x1) / 2, t = tOfX(tl, cx), pt = (kind) => out.push({ kind, sub: b.kind, t0: t, t1: t, mid: t, label: b.d.name, x: cx });
      if (b.kind === "orb") out.push({ kind: "orb", sub: "orb", t0: tOfX(tl, b.x0 - C.SIZE / 2), t1: tOfX(tl, b.x1 + C.SIZE / 2), mid: t, label: b.d.name, x: cx });
      else if (b.kind === "pad") pt("pad");
      else if (b.kind === "speed" || b.kind === "mode" || b.kind === "gravity") pt("portal");
      else if (b.kind === "hazard") {
        // a run of hazards with gaps under one block is one obstacle; its time is its first hazard
        if (cluster && b.x0 - cluster.x1 < C.SIZE) { cluster.x1 = Math.max(cluster.x1, b.x1); continue; }
        cluster = { x1: b.x1 };
        pt("obstacle");
      }
    }
    return out.sort((a, b) => a.mid - b.mid);
  }

  // ---- scores
  // hit: the event's span comes within `tol` s of a grid line (grid = beat / sub).
  // chance: the same with the grid slid to 48 other phases (wide windows hit by luck; this says how
  // often). kappa = (hit - chance) / (1 - chance): 1 = every event on the grid, 0 = no better than
  // luck. p = share of slid grids that do at least as well (small = really synced).
  // R and offset: how tightly the events' middles cluster around one phase of the grid (1 = all
  // at the same phase), and where that phase is, in ms after the grid line.
  function score(events, grid, offset, sub, tol) {
    sub = sub || 1; tol = tol === undefined ? 0.035 : tol;
    const P = grid.period / sub;
    const hitsAt = shift => {
      let h = 0;
      for (const e of events) {
        const a = e.t0 + offset - grid.t0 - shift - tol, b = e.t1 + offset - grid.t0 - shift + tol;
        if (Math.floor(b / P) >= Math.ceil(a / P)) h++;
      }
      return h;
    };
    const n = events.length;
    if (!n) return { n: 0 };
    const hit = hitsAt(0) / n;
    let sum = 0, ge = 0;
    const K = 48;
    for (let k = 1; k <= K; k++) { const hk = hitsAt(P * k / (K + 1)) / n; sum += hk; if (hk >= hit) ge++; }
    const chance = sum / K;
    let cx = 0, cy = 0;
    for (const e of events) { const ph = 2 * Math.PI * (e.mid + offset - grid.t0) / P; cx += Math.cos(ph); cy += Math.sin(ph); }
    const R = Math.hypot(cx, cy) / n;
    let ang = Math.atan2(cy, cx); // phase of the cluster
    return { n, hit: round(hit), chance: round(chance), kappa: chance < 1 ? round((hit - chance) / (1 - chance)) : 0,
             p: round((ge + 1) / (K + 1)), R: round(R), offsetMs: Math.round(ang / (2 * Math.PI) * P * 1000) };
  }
  function round(v) { return Math.round(v * 100) / 100; }

  Object.assign(GD, { SYNC: { timeline, tOfX, xOfT, speedAtT, beatToTime, timeToBeat, pressWindows, levelEvents, score } });
})(typeof module !== "undefined" ? module.exports : (window.GD = window.GD || {}));
