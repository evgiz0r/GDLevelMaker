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
    LAPSE: 0.0065,      // chance of fluffing any input whatever its window (fit with SIGMA on the user's runs, DIFFICULTY.md)
    SIGMA: 10.5,        // ms, spread of a player's timing error (fit with LAPSE on the user's runs, DIFFICULTY.md)
    MAX_SHIFT: 48,      // steps (200 ms) searched each way; a wider window counts as 400 ms
    FREEZE: 16,         // steps (67 ms): after a mistimed input a player cannot correct sooner
    TAP: 30,            // a press released within 30 steps (125 ms) is one tap
    TAPLEN: 24,         // how long a person's tap keeps the button down: 100 ms (ASSUMED, typical)
    HORIZON: 120,       // steps (0.5 s) past the next input that a shifted run must survive
    BEAM: 150,          // look-ahead states kept per step
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
  // chance to get one input right: no lapse, and the timing error lands inside the window
  const hitChance = (ms, sigma, lapse) => (1 - (lapse === undefined ? D.LAPSE : lapse)) * erf(ms / 2 / ((sigma || D.SIGMA) * Math.SQRT2));

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

  // The solver's fewest-presses route often holds the button through a whole staircase, the cube
  // jumping again on every landing. People tap each jump. This turns every cube-mode hold into
  // one tap per jump or orb it caused (the same moves, so the same path) and keeps the change
  // only when a replay still gets as far. Ship, dash-orb and other holds that matter stay.
  function humanize(w, events, opts) {
    opts = opts || {};
    // a person's tap stays down ~100 ms, so a press a little before landing still jumps;
    // where that long a tap would jump twice, try shorter ones
    const LENS = opts.tapLen ? [opts.tapLen] : [D.TAPLEN, 12, 6];
    const orbNames = new Set(Object.values(P.OBJECTS || {}).filter(d => d.kind === "orb").map(d => d.name));
    const reach = ev => { const r = P.run(w, ev); return { done: r.done, x: r.end.x }; };
    const goal = reach(events);
    let ev = events.slice().sort((a, b) => a.tick - b.tick), changed = 0;
    for (let i = 0; i < ev.length; i++) {
      if (ev[i].type !== "press") continue;
      const p = ev[i].tick, rIdx = ev.findIndex((e, j) => j > i && e.type === "release");
      const path = P.run(w, ev).path;
      const r = rIdx >= 0 ? ev[rIdx].tick : path.length - 1;
      if (r - p <= LENS[LENS.length - 1]) continue; // already a tap
      let cubeOnly = true; const taps = [];
      for (let t = p; t < Math.min(r, path.length - 1); t++) {
        const s = path[t];
        if (s.mode !== "cube" || s.dashing) { cubeOnly = false; break; }
        const act = path[t + 1].act;
        if (act === "jump" || orbNames.has(act)) taps.push(t);
      }
      if (!cubeOnly || !taps.length || (taps.length === 1 && taps[0] === p && r - p <= D.TAP)) continue;
      for (const len of LENS) {
        const repl = taps.flatMap((t, k) => [{ tick: t, type: "press" }, { tick: Math.min(t + len, k + 1 < taps.length ? taps[k + 1] - 1 : t + len), type: "release" }]);
        const next = ev.slice(0, i).concat(repl, rIdx >= 0 ? ev.slice(rIdx + 1) : ev.slice(i + 1));
        const got = reach(next);
        if (got.done === goal.done && got.x >= goal.x - 1) { ev = next; i += repl.length - 1; changed++; break; }
      }
    }
    // solver taps last one step; a person's last ~100 ms (where that changes nothing else)
    for (let i = 0; i + 1 < ev.length; i++) {
      const a = ev[i], b = ev[i + 1];
      if (a.type !== "press" || b.type !== "release" || b.tick - a.tick >= D.TAPLEN) continue;
      const until = Math.min(a.tick + D.TAPLEN, i + 2 < ev.length ? ev[i + 2].tick - 1 : a.tick + D.TAPLEN);
      if (until <= b.tick) continue;
      const next = ev.slice(); next[i + 1] = { tick: until, type: "release" };
      const got = reach(next);
      if (got.done === goal.done && got.x >= goal.x - 1) { ev = next; changed++; }
    }
    return { events: ev, changed };
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
    const run = P.run(w, events);
    // a run the sim cannot finish is scored up to 1 s before it dies (the inputs just before
    // a forced death have no window at all); living to that point counts as surviving
    const path = run.path, last = run.done ? path.length - 1 : Math.max(0, path.length - 1 - TPS);
    const acts = actionsOf(events).filter(a => run.done || a.tick < last);
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
        const until = Math.min(run.done ? last + 1 : last, Math.min(Math.max(t, nextT), t + D.HORIZON) + D.HORIZON); // at most 1 s ahead
        if (d <= 0) return survives(w, path[t], t > 0 ? heldAt[t - 1] : false, a, t + a.dur + gap, until, heldAt);
        // late: the old input carries on for d steps, then the action
        const s = cloneS(path[a.tick]);
        for (let k = 0; k < d; k++) { P.step(w, s, { press: false, held: before }); if (s.dead) return false; if (s.done) return true; }
        return survives(w, s, before, a, t + a.dur + gap, until, heldAt);
      };
      // a frame (4 steps) at a time, then step by step inside the first frame that fails
      const reach = (sign) => {
        let n = 0;
        while (n < D.MAX_SHIFT && ok(sign * Math.min(n + 4, D.MAX_SHIFT))) n = Math.min(n + 4, D.MAX_SHIFT);
        if (n < D.MAX_SHIFT) while (n < D.MAX_SHIFT && ok(sign * (n + 1))) n++;
        return n;
      };
      const lo = reach(-1), hi = reach(1);
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
    // score the route a person would play (taps, not long holds) unless asked for the raw one
    const hu = opts.raw ? { events: sol.events || [], changed: 0 } : humanize(w, sol.events || []);
    const events = hu.events;
    const acts = opts.actions || ((sol.clicks && sol.clicks.length && !sol.sweep && sol.ok && !hu.changed)
      ? actionsFromExact(w, sol) : measureWindows(w, events, opts));
    const r = P.run(w, events);
    const path = r.done ? r.path : r.path.slice(0, Math.max(1, r.path.length - TPS));
    const secs = (path.length - 1) / TPS, endX = path[path.length - 1].x;
    let logAtt = 0, deaths = 0;
    for (const a of acts) {
      a.p = Math.max(hitChance(a.ms, sigma, opts.lapse), 1e-9);
      logAtt += -Math.log10(a.p);
      deaths += 1 / a.p - 1; // practice mode: each input retried from just before it until it works
    }
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
    const unsupported = w.objects.filter(o => P.objInfo(o.id).kind === "unsupported" && o.x <= endX).length;
    const ms = acts.map(a => a.ms);
    // recovery: time from landing to the next press. Land-and-jump-again chains under ~150 ms
    // were the wall on the style session's GDLM 42 (all 8 of the user's deaths, mouse, normal
    // mode), even with fair windows. Reported, not in the score yet (one level of data).
    let quick = 0, prevT = -1;
    for (const a of acts) {
      if (a.type === "release" || a.mode !== "cube") { prevT = a.tick; continue; }
      let land = null;
      for (let t = Math.min(a.tick + 1, path.length - 1); t > Math.max(prevT, 0); t--) if (path[t].grounded && !path[t - 1].grounded) { land = t; break; }
      // the latest moment the press still works, counted from the landing: how long the player
      // has to see the landing and react (a press on the landing step itself is just early)
      a.recoveryMs = land === null ? null : msOf((a.hi !== undefined ? a.hi : a.tick) - land);
      if (a.recoveryMs !== null && a.recoveryMs < 150) quick++;
      prevT = a.tick;
    }
    return {
      quickRecoveries: quick,                      // presses < 150 ms after a landing
      actions: acts, events, humanized: hu.changed,
      seconds: secs, blocks: endX / 30, complete: !!r.done,
      inputs: acts.length,
      perSecond: acts.length / Math.max(secs, 1e-9),
      peak5s: cps5,
      tightest: ms.length ? Math.min(...ms) : null,
      medianMs: quantile(ms, 0.5),
      tight: ms.filter(m => m < D.TIGHT).length,
      streak: best,
      logAttempts: logAtt,                         // the score: log10 of expected attempts
      practiceDeaths: deaths,                      // expected deaths to clear it in practice mode
      perMinute: logAtt / Math.max(secs, 1e-9) * 60, // the same per minute played (for partial runs)
      lookAhead: quantile(ahead, 0.5),             // s of warning before an input, typical
      shipGap: gaps.length ? { min: Math.min(...gaps), median: quantile(gaps, 0.5) } : null,
      hiddenTriggers: hidden, unsupported,
    };
  }

  // A rough name for a score, on the official levels' scale (DIFFICULTY.md: where the cut-offs come from)
  function label(logAtt) {
    const cuts = [[0.3, "Easy"], [0.8, "Normal"], [1.5, "Hard"], [2.5, "Harder"], [4, "Insane"]];
    for (const [c, n] of cuts) if (logAtt < c) return n;
    return "Demon";
  }

  Object.assign(GD, { DIFF: D, humanize, hitChance, actionsOf, measureWindows, actionsFromExact, difficulty: score, difficultyLabel: label });
})(typeof module !== "undefined" ? module.exports : (window.GD = window.GD || {}));
