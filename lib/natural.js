// A natural way to play a solved level, for the replay (and for judging the level by it).
// The solver finds the FEWEST presses, which looks wrong to a player (playtest, GDLM 44 v3):
// holds that make the cube re-jump on every landing ("empty clicks" with nothing to jump over),
// a ship flown with a few long holds and releases (it zigzags like a wave), jumps taken at the
// very last moment off every edge. naturalPlan rewrites the inputs, keeping only changes after
// which the run still finishes:
//   1. cube holds -> one tap per jump;
//   2. a press that is not needed is dropped (an "empty click"; any mode but ship/wave holds), and
//      one held from a block into a ship/wave portal moves to the portal;
//   3. each ship / wave / UFO / swing stretch is flown again by a controller that steers for the
//      middle of the free space ahead (the ship hovers with short taps, the wave follows its
//      corridor), stretch by stretch.
//   4. each tap goes early in its timing window (40% in), not at its last safe frame;
//   5. every hold outside ship/wave is cut to the shortest that still finishes (taps, not long holds).
// Needs lib/physics.js (GD.run, GD.step, GD.startState, GD.makeWorld) and lib/objects.js.
// Works in node and the browser. Cost: a few dozen replays of the level (well under a second
// for a 10 s level, a few seconds for 90 s).
(function (OUT) {
  "use strict";
  // in node the physics comes from its own modules; in the browser it is already on window.GD
  const GD = (typeof module !== "undefined" && typeof require !== "undefined")
    ? Object.assign({}, require("./objects.js"), require("./physics.js")) : OUT;
  const DEBUG = typeof process !== "undefined" && process.env && process.env.NATURAL_DEBUG;
  const clone = s => { const c = Object.assign({}, s); if (s.used) c.used = s.used.slice(); return c; };
  // GOAL: for a run the solver could not finish, a change is kept if the run still gets this far
  // (the user wants the unbeaten Deadlocked map flown mid-corridor too, 2026-11-23)
  let GOAL = null;
  // WIN [t0, t1]: naturalPlan's opts.window -- only inputs with a tick in it are moved or dropped, only flying
  // stretches overlapping it are flown again (lib/incsolve.js: after an edit only the re-solved stretch needs it)
  let WIN = null;
  const inWin = t => !WIN || (t >= WIN[0] && t <= WIN[1]);
  const done = (w, ev) => { const p = GD.run(w, ev).path, e = p[p.length - 1]; return e.done || (GOAL !== null && e.x >= GOAL - 1) ? p : null; };
  const toEvents = held => { const out = []; let h = false; for (let t = 0; t < held.length; t++) if (held[t] !== h) { out.push({ tick: t, type: held[t] ? "press" : "release" }); h = held[t]; } return out; };
  const heldOf = (ev, n) => { const held = new Array(n).fill(false); let h = false, i = 0; const e = ev.slice().sort((a, b) => a.tick - b.tick); for (let t = 0; t < n; t++) { while (i < e.length && e[i].tick === t) { h = e[i].type === "press"; i++; } held[t] = h; } return held; };
  const FLY = { ship: 1, wave: 1, ufo: 1, swing: 1 };
  // The human cost of a whole route (lib/difficulty.js humanCost, the difficulty session's: windows, presses,
  // position in window, marks; lower is better, log10-attempts units). The one judge of "more natural" between
  // two routes that both finish and skip nothing. Null when it is not loaded (the browser without difficulty.js).
  // Slow (one window measure of the whole route: ~30 s on GDLM 44's ship), so only with naturalPlan's
  // opts.cost (tools/solutions.js, when it saves a route); cached per route.
  let HC = null, USE_COST = false; const costCache = new Map();
  function humanCost(w, ev) {
    if (!USE_COST) return null;
    const key = ev.map(e => e.tick + (e.type === "press" ? "p" : "r")).join(",");
    if (costCache.has(key)) return costCache.get(key);
    const v = humanCostRaw(w, ev); costCache.set(key, v); return v;
  }
  function humanCostRaw(w, ev) {
    if (HC === null) { HC = GD.humanCost || OUT.humanCost || false;
      if (!HC && typeof require !== "undefined") try { HC = require("./difficulty.js").humanCost || false; } catch (e) { HC = false; } }
    if (!HC) return null;
    try { return HC(w, ev).cost; } catch (e) { return null; }
  }
  const clean = (w, ev, p) => !GD.skipCheck || !GD.skipCheck(w, p, ev);

  // 1. cube holds -> taps: the button goes down only on the tick a jump or an orb fires
  function taps(w, ev, path) {
    const held = heldOf(ev, path.length), want = held.slice();
    for (let t = 0; t + 1 < path.length; t++) {
      if (path[t].mode !== "cube" || !inWin(t)) continue;
      const b = path[t + 1], g = path[t].grav || 1;
      want[t] = held[t] && ((b.act === "jump" && b.vy * g > 5 && path[t].vy * g <= 0.5) || (/orb|pad/.test(b.act || "") && b.act !== path[t].act));
    }
    const out = toEvents(want);
    return done(w, out) ? out : ev;
  }

  // 2. no press that is not needed (the user on GDLM 44 v12: "some places mark to jump but no need"),
  // last first, re-checked until nothing changes:
  //   a. a press with its release goes if the run still finishes without it (any mode but ship/wave,
  //      whose holds steer: a cube jump, an orb, a ball/spider/swing flip, a UFO hop);
  //   b. a press made before a portal and held into a flying mode (the button already down on the
  //      block before a ship portal) moves to the portal: the jump on the block was not needed.
  const HOLDS = { ship: 1, wave: 1 };
  function dropEmpty(w, ev, path) {
    let cur = ev.slice();
    for (let pass = 0; pass < 3; pass++) {
      let changed = false;
      for (let i = cur.length - 1; i >= 0; i--) {
        const e = cur[i];
        if (!e || e.type !== "press" || !inWin(e.tick)) continue;
        const p = path[Math.min(e.tick, path.length - 1)];
        if (!p || HOLDS[p.mode]) continue;
        const rel = cur.findIndex((x, j) => j > i && x.type === "release");
        const relMode = rel >= 0 ? path[Math.min(cur[rel].tick, path.length - 1)].mode : null;
        if (rel < 0 || !HOLDS[relMode]) {
          const trial = cur.filter((x, j) => j !== i && j !== rel);
          const p2 = done(w, trial);
          if (p2) { cur = trial; path = p2; changed = true; continue; }
        }
        if (rel >= 0 && HOLDS[relMode]) {      // b: held into a ship/wave part: press at the portal instead
          let t = e.tick; while (t < cur[rel].tick && !HOLDS[path[t].mode]) t++;
          if (t > e.tick + 1) {
            const trial = cur.map((x, j) => j === i ? { tick: t - 1, type: "press" } : x);
            const p2 = done(w, trial);
            if (p2) { cur = trial; path = p2; changed = true; }
          }
        }
      }
      if (!changed) break;
    }
    return cur;
  }

  // 2c. holds no longer than needed (the user, 2026-11-23: "the clicks expand too long in levels" -- the
  // saved routes held the button through cube jumps and between them, where a player taps). Outside ship and
  // wave (whose holds steer), each hold is cut to the shortest that still finishes the run: release after 1,
  // 2, 4, 8 ... ticks, the first that works. A hold a mode needs (a robot's long jump, a dash orb, an auto-jump
  // chain the level is built on) stays as long as it must, because shorter ones do not finish.
  function shortenHolds(w, ev, path) {
    let cur = ev.slice();
    for (let i = 0; i < cur.length; i++) {
      if (cur[i].type !== "press" || !inWin(cur[i].tick)) continue;
      const j = cur.findIndex((x, k) => k > i && x.type === "release");
      if (j < 0) continue;
      const p = path[Math.min(cur[i].tick, path.length - 1)], len = cur[j].tick - cur[i].tick;
      if (!p || HOLDS[p.mode] || len <= 2) continue;
      for (const d of [1, 2, 4, 8, 16, 32, 64]) {
        if (d >= len) break;
        const trial = cur.map((x, k) => k === j ? { tick: cur[i].tick + d, type: "release" } : x);
        const p2 = done(w, trial);
        if (p2) { cur = trial; path = p2; break; }
      }
    }
    return cur;
  }

  // presses of a route that can go with the run still finishing (tools/score.js warns on them)
  function extraPresses(w, ev) {
    const path = GD.run(w, ev).path, out = [];
    ev.forEach((e, i) => {
      if (e.type !== "press") return;
      const p = path[Math.min(e.tick, path.length - 1)];
      if (!p || HOLDS[p.mode]) return;
      const rel = ev.findIndex((x, j) => j > i && x.type === "release");
      if (rel >= 0 && HOLDS[path[Math.min(ev[rel].tick, path.length - 1)].mode]) return;
      const q = GD.run(w, ev.filter((x, j) => j !== i && j !== rel)), end = q.end;
      if (!q.dead && (q.done || end.x >= w.endX)) out.push({ tick: e.tick, x: p.x, mode: p.mode });
    });
    return out;
  }

  // free space ahead of x: [floor, ceiling] around y, from the level's solids and hazards
  function freeAt(boxes, s, x) {
    let lo = s.floorY || 0, hi = isFinite(s.ceilY) ? s.ceilY : (s.floorY || 0) + 300;
    for (const b of boxes) {
      if (b.x1 < x - 10 || b.x0 > x + 10) continue;
      if (b.y1 <= s.y + 4 && b.y1 > lo) lo = b.y1;
      if (b.y0 >= s.y - 4 && b.y0 < hi) hi = b.y0;
    }
    return [lo, hi];
  }

  // run from a state with a held[] array up to tick `until`; returns the state (dead or not)
  function simFrom(w, s0, held, from, until) {
    const s = clone(s0);
    for (let t = from; t < until && !s.dead && !s.done; t++) GD.step(w, s, { press: held[t] && !(t ? held[t - 1] : false), held: held[t] });
    return s;
  }
  // After inputs up to `from` changed, re-time the later inputs one by one: shift each by the
  // smallest number of ticks that lets the run live until the next input (+1/4 s). A player
  // adjusts to where they actually are; the solver's ticks assumed the old path.
  function retime(w, held, path0, from, total) {
    const ev = toEvents(held.slice(from)).map(e => ({ tick: e.tick + from, type: e.type }));
    // the state at `from` under the new inputs
    let s = simFrom(w, GD.startState(w), held, 0, from);
    if (s.dead) return null;
    const out = held.slice(0, from);
    let t = from, h = held[from - 1] || false;
    const shifts = [0]; for (let d = 1; d <= 36; d++) shifts.push(d, -d);
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i], next = i + 1 < ev.length ? ev[i + 1].tick : total;
      let placed = false;
      for (const d of shifts) {
        const at = e.tick + d;
        if (at < t) continue;
        const trial = out.slice();
        for (let k = t; k < at; k++) trial[k] = h;
        const h2 = e.type === "press";
        for (let k = at; k < Math.max(at + 1, next + d); k++) trial[k] = h2;
        const until = Math.min(total, Math.max(at + 1, next + d) + 60);
        const st = simFrom(w, s, trial.concat(new Array(Math.max(0, until - trial.length)).fill(h2)), t, until);
        if (!st.dead) {
          for (let k = t; k < at; k++) out[k] = h;
          s = simFrom(w, s, trial, t, at);
          t = at; h = h2; placed = true; break;
        }
      }
      if (!placed) { if (DEBUG) console.log("  retime: no shift works for", e.type, "at tick", e.tick); return null; }
    }
    for (let k = t; k < total; k++) out[k] = h;
    return out;
  }

  // how a route flies a stretch of ticks [a, b): presses in it, and ticks within NEAR units of a solid or
  // hazard above or below while airborne (the user on GDLM 45's wave: "way too many clicks ... way too close
  // to the borders. these waves can be cleared in their native pattern")
  const NEAR = 12;
  function clearance(boxes, s) { const [lo, hi] = freeAt(boxes, s, s.x), h = s.mini ? 9 : 15; return Math.min(s.y - h - lo, hi - s.y - h); }
  function stretchCost(boxes, ev, path, a, b) {
    let close = 0;
    // riding the floor or the roof counts as close too (clearance 0): the user's Stereo Madness ship riding the
    // floor and the roof under hanging spikes
    for (let t = a; t < b && t < path.length; t++) if (path[t].grounded || clearance(boxes, path[t]) < NEAR) close++;
    return { close, presses: ev.filter(e => e.type === "press" && e.tick >= a && e.tick < b).length };
  }
  const cleaner = (p, q) => p.close !== q.close ? p.close < q.close : p.presses < q.presses;

  // 3. fly each flying stretch with a controller; keep it if the whole level still finishes and it
  // flies the stretch cleaner than the route it replaces (the solver's sweep already ranks routes by
  // distance from walls, then presses: its wave legs are often the native one-press-per-leg zigzag),
  // re-timing the inputs after it
  function fly(w, ev, objects) {
    const boxes = objects.map(o => ({ d: GD.objInfo(o.id), hb: GD.hitbox(o) }))
      .filter(b => b.hb && (b.d.kind === "solid" || b.d.kind === "hazard" || b.d.kind === "slope")).map(b => b.hb);
    let cur = ev;
    let path = done(w, cur);
    if (!path) return ev;
    const spansOf = p => { const sp = []; for (let t = 0; t < p.length; t++) { if (!FLY[p[t].mode]) continue; const a = t; while (t < p.length && FLY[p[t].mode]) t++; sp.push([a, t]); } return sp; };
    const nSpans = spansOf(path).length;
    for (let si = 0; si < nSpans; si++) {
      const [a, b] = spansOf(path)[si] || [];
      if (a == null) break;
      if (WIN && (b < WIN[0] || a > WIN[1])) continue;
      let best = null;
      // the stretch's boxes once (the tube below looks at many x per tick)
      const xa = path[a] ? path[a].x - 60 : 0, xb = (path[Math.min(b, path.length - 1)] || {}).x + 600;
      const near = boxes.filter(q => q.x1 >= xa && q.x0 <= xb);
      // Look-ahead "tube" (the user on Stereo Madness's ship: "it's unnatural to wait so late and fly up ...
      // much more natural ... flying somewhat straight through the paths"): the target height is the middle of
      // the free space averaged over the next L units, so climbs and dives start early and smoothly, and is
      // kept inside the free space just ahead with a margin. L is tried at 240 (8 blocks), 150 and 360.
      const tube = (st, x, L) => {
        let sum = 0, n = 0;
        for (let d = 30; d <= L; d += 15) { const [l, hh] = freeAt(near, st, x + d); sum += (l + hh) / 2; n++; }
        return sum / n;
      };
      for (const [k, L] of [[16, 240], [16, 150], [16, 360], [10, 0], [6, 0]]) {
        const total = path.length + 600;
        const held = heldOf(cur, total), orig = held.slice();
        const s = clone(path[a]);
        let h = held[Math.max(0, a - 1)], t = a;
        for (; t < total && !s.dead && !s.done && (FLY[s.mode] || t < b); t++) {
          if (!FLY[s.mode] || (!GD.solveFrom && t >= b - 24)) { h = orig[t]; }   // the last 0.1 s: the solver's own button, to hand over cleanly
          else {
            const sp = GD.SPEEDS[s.sp] || GD.SPEEDS[1];
            const [lo, hi] = freeAt(near, s, s.x + sp.x * k);
            // steer for the middle of the room ahead; in the last 1/2 s before the stretch ends,
            // for the solver's own line, so the hand-over to the next part is where its plan expects
            // without solveFrom, the last 1/2 s steers for the solver's own line so its later inputs fit
            // the last 1/2 s before the stretch ends steers for the solver's own line, so the next part starts
            // where a plan exists (with solveFrom too: Stereo Madness's ship left the player where nothing
            // could finish the level)
            const late = t >= b - 120 && path[Math.min(path.length - 1, t + k)];
            let want = (lo + hi) / 2;
            if (L) { const m = Math.min(24, (hi - lo) / 2 - 1); want = Math.max(lo + m, Math.min(hi - m, tube(s, s.x, L))); }
            const mid = late ? path[Math.min(path.length - 1, t + k)].y : want, g = s.grav || 1, band = s.mode === "wave" ? 12 : 3; // wave: a wide dead band, no flicker at the turns
            const err = (mid - (s.y + (s.mode === "wave" ? 0 : s.vy * k * 0.25))) * g;
            if (err > band) h = true; else if (err < -band) h = false;   // a dead band: no chatter
          }
          held[t] = h;
          GD.step(w, s, { press: h && !(t ? held[t - 1] : false), held: h });
        }
        if (s.dead) { if (DEBUG) console.log("fly", si, "k", k, "dies in the stretch at", (s.x / 30).toFixed(1), s.why); continue; }
        // the rest of the level from where the controller left the player (lib/physics.js
        // solveFrom); fall back to re-timing the old inputs if the solver finds nothing
        let trial = null;
        if (GD.solveFrom && GOAL === null) {   // an unbeaten level: the solver found no finish, re-time instead
          try {
            // with a window: stop as soon as the search is back on the current route (its exact state and
            // button at a tick past the window), and keep the current route from there
            const goal = WIN ? rejoinGoal(w, cur, path, Math.max(t, WIN[1])) : null;
            const rest = GD.solveFrom(w, s, goal ? { held: h, goal } : { held: h });
            if (rest && rest.ok) trial = toEvents(held.slice(0, t)).concat(
              (h ? [] : []), rest.events.filter(e => e.tick >= t && (rest.goalTick == null || e.tick < rest.goalTick)),
              rest.goalTick != null ? cur.filter(e => e.tick >= rest.goalTick) : []);
            // the button state must carry over: toEvents ends with h; the rest starts from held = h
          } catch (e) { if (DEBUG) console.log("solveFrom failed:", e.message); }
        }
        if (!trial) {
          const re = retime(w, held, path, t, total);
          if (!re) { if (DEBUG) console.log("fly", si, "k", k, "no plan after tick", t, "block", (s.x / 30).toFixed(1)); continue; }
          trial = toEvents(re);
        }
        const p2 = done(w, trial);
        if (p2) { best = { trial, p2 }; break; }
      }
      if (best) {
        const now = stretchCost(boxes, cur, path, a, b), then = stretchCost(boxes, best.trial, best.p2, a, b);
        if (DEBUG) console.log("fly", si, "solver", JSON.stringify(now), "controller", JSON.stringify(then));
        // the lower human cost wins; the wall/press count decides when the cost is not available or ties
        const skipT = GD.skipCheck ? GD.skipCheck(w, best.p2, best.trial) : null;
        if (DEBUG && skipT) console.log("fly", si, "controller route skips", skipT.skipped);
        const cNow = humanCost(w, cur), cThen = !skipT ? humanCost(w, best.trial) : Infinity;
        if (DEBUG) console.log("fly", si, "humanCost solver", cNow, "controller", cThen);
        const take = cNow != null && cThen != null && Math.abs(cThen - cNow) > 1e-6 ? cThen < cNow : cleaner(then, now);
        if (take) { cur = best.trial; path = best.p2; }
      }
    }
    return cur;
  }

  // 4. click where a person would: the solver's taps sit wherever the search left them, often the
  // last safe frame, so the replay looked like a near miss every time (the user on GDLM 45's ball,
  // "the clicks are too close to death ... i would prefer to click way earlier"). Each tap (press
  // and its release together, outside ship/wave holds) is moved whole frames (4 ticks; Click Between
  // Steps is off) earlier and later while the whole run still finishes; it goes EARLY_AT of the way
  // into that window from its early edge. Left to right, so each later window is measured with the
  // earlier taps already moved. Cost: a replay per frame tried, stopping at each edge.
  const EARLY_AT = 0.4, REACH = 48, LOOK = 720;   // REACH: frames looked at each way (0.8 s); LOOK: 3 s
  const HOLDY = { ship: 1, wave: 1 };
  function early(w, ev, path) {
    let cur = ev.slice();
    for (let i = 0; i < cur.length; i++) {
      if (cur[i].type !== "press" || !inWin(cur[i].tick)) continue;
      const p = path[Math.min(cur[i].tick, path.length - 1)];
      if (!p || HOLDY[p.mode]) continue;
      const j = cur.findIndex((x, k) => k > i && x.type === "release");
      const lo = i > 0 ? cur[i - 1].tick + 1 : 0, hi = (j >= 0 && cur[j + 1] ? cur[j + 1].tick : Infinity) - 1;
      const shifted = d => { const c = cur.map(e => Object.assign({}, e)); c[i].tick += d; if (j >= 0) c[j].tick += d; return c; };
      const fits = d => cur[i].tick + d >= lo && (j < 0 ? cur[i].tick + d : cur[j].tick + d) <= hi;
      // a shift is tried from the saved state just before it, for LOOK ticks after the tap (the whole
      // run is checked once at the end): a full replay per frame tried cost 72 s on GDLM 45
      const lives = d => {
        const c = shifted(d), t0 = Math.max(0, Math.min(cur[i].tick, c[i].tick) - 1), end = Math.max(cur[i].tick, c[i].tick) + LOOK;
        if (t0 >= path.length) return false;
        const held = heldOf(c, end + 1), s = clone(path[t0]);
        for (let t = t0; t < end && !s.dead && !s.done; t++) GD.step(w, s, { press: held[t] && !(t ? held[t - 1] : false), held: held[t] });
        return !s.dead;
      };
      let a = 0, b = 0;
      while (a > -REACH * 4 && fits(a - 4) && lives(a - 4)) a -= 4;
      while (b < REACH * 4 && fits(b + 4) && lives(b + 4)) b += 4;
      const d = a + Math.round((b - a) * EARLY_AT / 4) * 4;
      if (d !== 0) { const c = shifted(d); const p2 = done(w, c); if (p2) { cur = c; path = p2; } }
    }
    return cur;
  }

  // the search may stop when it is in the current route's exact state (lib/incsolve.js sameState) with the
  // same button, at a tick after `after`
  function rejoinGoal(w, cur, path, after) {
    const INC = OUT.incsolve || (typeof require !== "undefined" ? (() => { try { return require("./incsolve.js").incsolve; } catch (e) { return null; } })() : null);
    if (!INC) return null;
    const held = heldOf(cur, path.length + 1);
    return (st, h) => st.tick > after && st.tick < path.length && h === held[st.tick - 1] && INC.sameState(INC.canon(w, st), INC.canon(w, path[st.tick]));
  }
  // opts.cost: judge route choices by lib/difficulty.js humanCost (slow; tools/solutions.js uses it)
  function naturalPlan(w, sol, objects, opts) {
    if (!sol || !sol.events || !sol.events.length) return null;
    GOAL = sol.ok ? null : GD.run(w, sol.events).end.x;
    USE_COST = !!(opts && opts.cost); costCache.clear(); WIN = (opts && opts.window) || null;
    try { return plan(w, sol, objects); } finally { GOAL = null; USE_COST = false; costCache.clear(); WIN = null; }
  }
  function plan(w, sol, objects) {
    let ev = sol.events.slice();
    let path = done(w, ev);
    if (!path) return null;
    ev = taps(w, ev, path); path = done(w, ev);
    ev = dropEmpty(w, ev, path); path = done(w, ev);
    ev = shortenHolds(w, ev, path); path = done(w, ev);
    ev = fly(w, ev, objects || w.objects || []);
    path = done(w, ev);
    if (path) { ev = taps(w, ev, path); path = done(w, ev); ev = dropEmpty(w, ev, path); path = done(w, ev); }
    if (path) { ev = early(w, ev, path); path = done(w, ev); }
    // moving taps earlier can leave a later one with nothing to do: drop it too
    if (path) { const ev2 = dropEmpty(w, ev, path); const p2 = done(w, ev2); if (p2) { ev = ev2; path = p2; } }
    if (path) { const ev3 = shortenHolds(w, ev, path); const p3 = done(w, ev3); if (p3) { ev = ev3; path = p3; } }
    // the finished natural route against the solver's own: keep the one with the lower human cost (both finish
    // and skip nothing). The natural passes are rules of thumb; the cost is the measure.
    if (path && sol.ok) {
      const p0 = done(w, sol.events);
      if (p0 && clean(w, sol.events, p0)) { const a = humanCost(w, ev), b = humanCost(w, sol.events);
        if (DEBUG) console.log("plan: humanCost natural", a, "solver", b);
        if (a != null && b != null && b < a - 1e-6) return { events: sol.events, path: p0, humanCost: b }; }
    }
    return path ? { events: ev, path } : { events: sol.events, path: GD.run(w, sol.events).path };
  }

  // routeCheck: per flying stretch of a run, its presses, the ticks within NEAR of a wall, and wave legs
  // shorter than 100 ms (a jittered leg: more than one press for one leg of the zigzag); tools/score.js
  function routeCheck(w, ev, objects) {
    const boxes = (objects || w.objects || []).map(o => ({ d: GD.objInfo(o.id), hb: GD.hitbox(o) }))
      .filter(x => x.hb && (x.d.kind === "solid" || x.d.kind === "hazard" || x.d.kind === "slope")).map(x => x.hb);
    const path = GD.run(w, ev).path, out = [];
    for (let t = 0; t < path.length; t++) {
      if (!FLY[path[t].mode]) continue;
      const a = t, mode = path[t].mode; while (t < path.length && path[t].mode === mode) t++;
      const c = stretchCost(boxes, ev, path, a, t), ins = ev.filter(e => e.tick >= a && e.tick < t);
      const short = mode === "wave" ? ins.filter((e, i) => i > 0 && e.tick - ins[i - 1].tick < 24).length : 0;
      out.push({ mode, from: path[a].x, to: path[t - 1].x, presses: c.presses, closeTicks: c.close, shortLegs: short });
    }
    return out;
  }

  Object.assign(OUT, { naturalPlan, routeCheck, extraPresses });
})(typeof module !== "undefined" ? module.exports : (window.GD = window.GD || {}));
