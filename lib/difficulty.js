// How hard is a level? Scores a level from a solution (its input events), in node and the browser.
//
// The core number is a timing model: every input the player must make has a window (how much
// earlier or later than the solver's moment it can come and the run still lives). A player whose
// timing error is normal with spread SIGMA hits a window w with p = erf(w/2 / (SIGMA*sqrt 2)).
// The level's difficulty is the expected number of attempts to beat it in one go, 1 / prod(p),
// reported as log10 ("2.0" = about a hundred attempts). Tight inputs dominate it; many easy ones
// add a little; length adds through the number of inputs. DIFFICULTY.md has the evidence.
//
// Windows: the exact cube solver gives them (same number of presses still beats the level).
// For any other solution (the sweep solver, ship parts) they are measured here by replay: shift
// one input by d steps, hold it for a human minimum, then let a short look-ahead search pick any
// inputs: if some continuation survives past the next input, d is inside the window.
(function (GD) {
  "use strict";
  const P = (typeof module !== "undefined" && typeof require !== "undefined")
    ? Object.assign({}, require("./objects.js"), require("./physics.js")) : GD;

  const D = {
    SIGMA: 30,          // ms, spread of a player's timing error (fit in DIFFICULTY.md)
    MAX_SHIFT: 48,      // steps (200 ms) searched each way; a wider window counts as 400 ms
    FREEZE: 16,         // steps (67 ms): after a mistimed input a player cannot correct sooner
    TAP: 8,             // a press released within 8 steps (33 ms) is one tap
    HORIZON: 120,       // steps (0.5 s) past the next input that a shifted run must survive
    BEAM: 400,          // look-ahead states kept per step
    TIGHT: 60,          // ms: a window this small counts as a tight input
    STREAK_GAP: 0.6,    // s: tight inputs closer than this are one streak
    VIEW_AHEAD: 420,    // units visible ahead of the player at 16:9 (ASSUMED, 19 blocks wide screen)
  };
  const TPS = 240, msOf = ticks => ticks / TPS * 1000;

  function erf(x) { // Abramowitz-Stegun 7.1.26, |error| < 1.5e-7
    const s = x < 0 ? -1 : 1; x = Math.abs(x);
    const t = 1 / (1 + 0.3275911 * x);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return s * y;
  }
  const hitChance = (ms, sigma) => erf(ms / 2 / ((sigma || D.SIGMA) * Math.SQRT2));

  // events [{tick, type}] -> actions: a tap (press + quick release) or a lone press / release
  function actionsOf(events) {
    const ev = events.slice().sort((a, b) => a.tick - b.tick), out = [];
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i], n = ev[i + 1];
      if (e.type === "press" && n && n.type === "release" && n.tick - e.tick <= D.TAP) { out.push({ tick: e.tick, type: "tap", dur: n.tick - e.tick }); i++; }
      else out.push({ tick: e.tick, type: e.type, dur: 0 });
    }
    return out;
  }

  const fkey = (w, s, held) => [Math.round(s.y), Math.round(s.vy * 2), s.grav, s.mode, s.sp, s.dashing ? 1 : 0,
    s.grounded ? 1 : 0, held ? 1 : 0, s.ring ? 1 : 0, s.used.filter(i => w.objects[i].x > s.x - 40).join(".")].join(":");
  const cloneS = s => { const c = Object.assign({}, s); c.used = s.used.slice(); return c; };

  // From state s at tick t (input `held` so far): apply action a at tick t (if given), keep the
  // input fixed until `free`, then any inputs at 60 fps frame boundaries. Lives until `until`?
  function survives(w, s0, held0, a, free, until, plan) {
    if (plan && follows(w, s0, held0, a, free, until, plan)) return true;
    let front = [{ s: cloneS(s0), held: held0 }];
    const start = s0.tick;
    for (let t = start; t < until; t++) {
      const next = new Map();
      for (const n of front) {
        let choices;
        if (a && t === start) choices = [a.type === "release" ? false : true];
        else if (a && a.type === "tap" && t < start + a.dur) choices = [true];
        else if (a && a.type === "tap" && t === start + a.dur) choices = [false];
        else if (t < free || t % 4 !== 0) choices = [n.held];
        else choices = [n.held, !n.held];
        for (const held of choices) {
          const st = cloneS(n.s);
          P.step(w, st, { press: held && !n.held, held });
          if (st.dead) continue;
          if (st.done) return true;
          const k = fkey(w, st, held);
          if (!next.has(k)) next.set(k, { s: st, held });
        }
      }
      front = [...next.values()];
      if (!front.length) return false;
      if (front.length > D.BEAM) front.length = D.BEAM;
    }
    return true;
  }

  // Quick check first: the action, then the solution's own inputs (plan[t] = held), live?
  function follows(w, s0, held0, a, free, until, plan) {
    const s = cloneS(s0), start = s0.tick;
    let held = held0;
    for (let t = start; t < until; t++) {
      let h;
      if (t === start) h = a.type !== "release";
      else if (a.type === "tap" && t < start + a.dur) h = true;
      else if (a.type === "tap" && t === start + a.dur) h = false;
      else if (t < free) h = held;
      else h = t < plan.length ? plan[t] : false;
      P.step(w, s, { press: h && !held, held: h }); held = h;
      if (s.dead) return false;
      if (s.done) return true;
    }
    return true;
  }

  // Timing window of every action in a solution, by shifting it. path = run(w, events).path.
  function measureWindows(w, events, opts) {
    opts = opts || {};
    const acts = actionsOf(events);
    const path = P.run(w, events).path, last = path.length - 1;
    const heldAt = new Array(path.length).fill(false); // input held during step t
    { let h = false, j = 0; const ev = events.slice().sort((a, b) => a.tick - b.tick);
      for (let t = 0; t < path.length; t++) { while (j < ev.length && ev[j].tick === t) { h = ev[j].type === "press"; j++; } heldAt[t] = h; } }
    acts.forEach((a, i) => {
      const nextT = i + 1 < acts.length ? acts[i + 1].tick : last;
      const gap = Math.min(D.FREEZE, Math.max(1, nextT - a.tick - a.dur));
      const before = a.tick > 0 ? heldAt[a.tick - 1] : false;
      const ok = (d) => {
        const t = a.tick + d;
        if (t < 0 || t >= last) return false;
        const until = Math.min(last + 1, Math.max(t, nextT) + D.HORIZON);
        if (d <= 0) return survives(w, path[t], t > 0 ? heldAt[t - 1] : false, a, t + a.dur + gap, until, heldAt);
        // late: the old input carries on for d steps, then the action
        const s = cloneS(path[a.tick]);
        for (let k = 0; k < d; k++) { P.step(w, s, { press: false, held: before }); if (s.dead) return false; if (s.done) return true; }
        return survives(w, s, before, a, t + a.dur + gap, until, heldAt);
      };
      let lo = 0, hi = 0;
      while (lo < D.MAX_SHIFT && ok(-(lo + 1))) lo++;
      while (hi < D.MAX_SHIFT && ok(hi + 1)) hi++;
      a.lo = a.tick - lo; a.hi = a.tick + hi;
      a.open = lo === D.MAX_SHIFT || hi === D.MAX_SHIFT; // hit the search limit: window at least this
      a.ms = msOf(lo + hi + 1);
      const s = path[Math.min(a.tick, last)];
      a.x = s.x; a.mode = s.mode; a.sp = s.sp;
      if (opts.progress) opts.progress(i, acts.length);
    });
    return acts;
  }

  // Actions straight from the exact cube solver's clicks (they already carry windows).
  function actionsFromExact(w, r) {
    const path = P.run(w, r.events).path;
    return r.clicks.map(c => {
      const s = path[Math.min(c.tick, path.length - 1)];
      return { tick: c.tick, type: c.type === "press" ? "tap" : c.type, lo: c.lo, hi: c.hi, ms: msOf(c.hi - c.lo + 1),
               x: s.x, mode: s.mode, sp: s.sp, exact: true };
    });
  }

  // Ship corridor: free height around the ship's path, per step (blocks count their kill box).
  function corridor(w, path) {
    const gaps = [];
    for (let t = 0; t < path.length; t += 4) {
      const s = path[t];
      if (s.mode !== "ship") continue;
      let up = s.ceilY - (s.y + 15), down = (s.y - 15) - s.floorY;
      for (const b of w.items) {
        if (b.kind !== "hazard" && b.kind !== "solid") continue;
        if (!(s.x - 15 < b.x1 && b.x0 < s.x + 15)) continue;
        if (b.kind === "solid") continue; // the ship slides on blocks; only their sides kill
        if (b.y0 >= s.y) up = Math.min(up, b.y0 - (s.y + 15));
        if (b.y1 <= s.y) down = Math.min(down, (s.y - 15) - b.y1);
      }
      gaps.push(Math.max(0, up) + Math.max(0, down));
    }
    return gaps;
  }

  // Trigger-like objects the player cannot see coming (moving, hiding or spawning things).
  // Ids from the 2.x editor (sure:false): 901 move, 1007 alpha, 1049 toggle, 1268 spawn,
  // 1346 rotate, 1347 follow, 1006 pulse (cosmetic, excluded), 29/30 colour (cosmetic, excluded).
  const HIDING = new Set([901, 1007, 1049, 1268, 1346, 1347]);

  function quantile(a, q) { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(q * b.length))]; }

  // Score a level. sol = a solver result ({ok, events, clicks, sweep}) or {events}.
  function score(w, sol, opts) {
    opts = opts || {};
    const sigma = opts.sigma || D.SIGMA;
    const acts = opts.actions || ((sol.clicks && sol.clicks.length && !sol.sweep && sol.ok)
      ? actionsFromExact(w, sol) : measureWindows(w, sol.events || [], opts));
    const r = P.run(w, sol.events || []);
    const path = r.path, secs = (path.length - 1) / TPS, endX = path[path.length - 1].x;
    let logAtt = 0;
    for (const a of acts) { a.p = hitChance(a.ms, sigma); logAtt += -Math.log10(Math.max(a.p, 1e-9)); }
    // streaks of tight inputs
    let streak = 0, best = 0, prev = -1e9;
    for (const a of acts) {
      if (a.ms < D.TIGHT) { streak = (a.tick - prev) / TPS <= D.STREAK_GAP ? streak + 1 : 1; prev = a.tick; best = Math.max(best, streak); }
    }
    // busiest 5 s of inputs
    let cps5 = 0;
    for (let i = 0, j = 0; i < acts.length; i++) { while (acts[i].tick - acts[j].tick > 5 * TPS) j++; cps5 = Math.max(cps5, (i - j + 1) / 5); }
    // reading: inputs per screen of look-ahead, and seconds of look-ahead at the speeds used
    const ahead = acts.map(a => D.VIEW_AHEAD / (P.SPEEDS[a.sp].x * 60));
    const gaps = corridor(w, path);
    const hidden = w.objects.filter(o => HIDING.has(o.id) && o.x <= endX).length;
    const unknown = w.objects.filter(o => P.objInfo(o.id).kind === "unknown" && o.x <= endX && !HIDING.has(o.id)).length;
    const ms = acts.map(a => a.ms);
    return {
      actions: acts,
      seconds: secs, blocks: endX / 30, complete: !!r.done,
      inputs: acts.length,
      perSecond: acts.length / Math.max(secs, 1e-9),
      peak5s: cps5,
      tightest: ms.length ? Math.min(...ms) : null,
      medianMs: quantile(ms, 0.5),
      tight: ms.filter(m => m < D.TIGHT).length,
      streak: best,
      logAttempts: logAtt,                         // the score: log10 of expected attempts
      perMinute: logAtt / Math.max(secs, 1e-9) * 60, // the same per minute played (for partial runs)
      lookAhead: quantile(ahead, 0.5),             // s of warning before an input, typical
      shipGap: gaps.length ? { min: Math.min(...gaps), median: quantile(gaps, 0.5) } : null,
      hiddenTriggers: hidden, unknownObjects: unknown,
    };
  }

  // A rough name for a score, on the official levels' scale (DIFFICULTY.md: where the cut-offs come from)
  function label(logAtt) {
    const cuts = [[0.3, "Easy"], [0.8, "Normal"], [1.5, "Hard"], [2.5, "Harder"], [4, "Insane"]];
    for (const [c, n] of cuts) if (logAtt < c) return n;
    return "Demon";
  }

  Object.assign(GD, { DIFF: D, hitChance, actionsOf, measureWindows, actionsFromExact, difficulty: score, difficultyLabel: label });
})(typeof module !== "undefined" ? module.exports : (window.GD = window.GD || {}));
