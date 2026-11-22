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
    LAPSE: 0.0075,      // chance of fluffing any input whatever its window (tools/difficulty_fit.js on the user's runs)
    SIGMA: 13,          // ms, spread of a player's timing error (tools/difficulty_fit.js on the user's runs)
    MAX_SHIFT: 48,      // steps (200 ms) searched each way; a wider window counts as 400 ms
    ROUTE_SHIFT: 48,    // steps (200 ms): how far a tight input looks for an easier moment. Further
                        // (600 ms tried) finds fake routes: an early jump the look-ahead rescues with a
                        // free extra jump. Real route choice needs a solver that charges every input
                        // (DIFFICULTY.md, Open 1)
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
    const orbNames = new Set(Object.values(P.OBJECTS || {}).filter(d => d.kind === "orb").map(d => d.name));
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
      // The solver's route can be needlessly tight (Jumper: it lands on a slab corner past a
      // spike, 8 ms, where the usual route has ~117 ms). A tight input gets a scan of every
      // moment within the search range, and the widest stretch that works is its window: the
      // player picks the best moment the level offers, not the solver's.
      // A moment only counts if the press there does something (a jump or an orb): a press that
      // does nothing, then the look-ahead pressing again, is a free double-tap, not a route.
      const acts0 = new Set(["jump", "tap", "flap", "teleport"]);
      const effective = d => {
        const t = a.tick + d;
        if (t < 0 || t >= last) return false;
        const s = cloneS(path[d <= 0 ? t : a.tick]);
        for (let k = 0; d > 0 && k < d; k++) P.step(w, s, { press: false, held: before });
        for (let k = 0; k <= Math.max(a.dur, 1); k++) {
          P.step(w, s, { press: k === 0, held: true });
          if (acts0.has(s.act) || orbNames.has(s.act)) return true;
          if (s.dead || s.done) return false;
        }
        return false;
      };
      const flying = path[Math.min(a.tick, last)].mode !== "cube"; // flying: any press or release steers
      if (a.ms < D.TIGHT && (a.type !== "release" || flying)) {
        let run = 0, best = 0, bestEnd = 0;
        for (let d = -D.ROUTE_SHIFT; d <= D.ROUTE_SHIFT; d += 2) {
          if (d === 0 || ((flying || effective(d)) && ok(d))) { run += 2; if (run > best) { best = run; bestEnd = d; } } else run = 0;
        }
        if (msOf(best) > a.ms) { a.lo = a.tick + bestEnd - best + 2; a.hi = a.tick + bestEnd; a.ms = msOf(best); a.moved = true; }
      }
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
  // Room in flying modes: free height around the player's path, hazards AND blocks (a wave dies on
  // blocks, and even the ship needs room to steer), in units (30 = one row), per mode. The user
  // found GDLM 44's wave "slightly too difficult" with the same windows as the rest: it had 2-3
  // rows of room where the ship had 5 (style session).
  function corridor(w, path) {
    const byMode = {};
    for (let t = 0; t < path.length; t += 4) {
      const s = path[t];
      if (s.mode === "cube" || s.mode === "ball" || s.mode === "robot" || s.mode === "spider") continue;
      let up = isFinite(s.ceilY) ? s.ceilY - s.y : 600, down = s.y - (isFinite(s.floorY) ? s.floorY : 0);
      for (let c = Math.floor((s.x - 15) / 30); c <= Math.floor((s.x + 15) / 30); c++) {
        for (const b of w.cols.get(c) || []) {
          if (b.kind !== "hazard" && b.kind !== "solid") continue;
          if (!(s.x - 15 < b.x1 && b.x0 < s.x + 15)) continue;
          if (b.y0 >= s.y) up = Math.min(up, b.y0 - s.y);
          else if (b.y1 <= s.y) down = Math.min(down, s.y - b.y1);
        }
      }
      (byMode[s.mode] = byMode[s.mode] || []).push(Math.max(0, up) + Math.max(0, down));
    }
    return byMode;
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
    // density and switching (the knowledge session's 91 community levels: Hard differs from
    // Normal by these more than by tight timing): things the path touches, changes of mode,
    // gravity or speed, and rests (1.5 s or more with no input), all per minute
    let touches = 0, switches = 0, rests = 0;
    for (let t = 1; t < path.length; t++) {
      const s0 = path[t - 1], s1 = path[t], act = s1.act || "";
      if (/orb|pad|portal/.test(act)) touches++;
      if (s1.mode !== s0.mode || s1.grav !== s0.grav || s1.sp !== s0.sp) switches++;
    }
    for (let i = 1; i < acts.length; i++) if ((acts[i].tick - acts[i - 1].tick) / TPS >= 1.5) rests++;
    const perMin = x => x / Math.max(secs, 1e-9) * 60;
    return {
      touchesPerMin: perMin(touches), switchesPerMin: perMin(switches), restsPerMin: perMin(rests),
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
      // free height (units, 30 = a row) per flying mode, blocks and hazards both: min and median
      room: Object.fromEntries(Object.entries(gaps).map(([m, g]) => [m, { min: Math.min(...g), median: quantile(g, 0.5) }])),
      shipGap: gaps.ship ? { min: Math.min(...gaps.ship), median: quantile(gaps.ship, 0.5) } : null,
      hiddenTriggers: hidden, unsupported,
    };
  }

  // Layout of a level, from its objects alone (no solving, so cheap for hundreds of levels).
  // What separates Easy..Harder (knowledge/levels/modes_low_tier.md, 91 rated community levels):
  // room after each portal (lead-in), the share of columns holding a hazard, section length,
  // orbs/pads per minute and rests. Sections are cut at mode and speed portals; seconds use each
  // section's speed. Static: levels that move their gameplay with triggers (2.2) read as emptier.
  const BPS = [8.4, 10.4, 12.9, 15.6, 19.2]; // blocks per second at 0.5x, 1x, 2x, 3x, 4x
  function layout(w) {
    const cut = w.items.filter(b => b.kind === "mode" || b.kind === "speed").sort((a, b) => a.x0 - b.x0);
    const haz = w.items.filter(b => b.kind === "hazard"), act = w.items.filter(b => b.kind === "orb" || b.kind === "pad");
    const end = w.endX - 90;
    let sp = w.startSpeed, x = 0;
    const secs = [];
    const bounds = cut.map(b => ({ x: (b.x0 + b.x1) / 2, sp: b.kind === "speed" ? b.d.speed : null }));
    bounds.push({ x: end, sp: null });
    const hazCols = new Set(haz.map(b => Math.floor((b.x0 + b.x1) / 60)));
    let total = 0, leadSum = 0, leadN = 0, fast = 0;
    const modes = new Set(["cube"].concat(cut.filter(b => b.kind === "mode").map(b => b.d.mode)));
    for (const bd of bounds) {
      const blocks = (bd.x - x) / 30;
      if (sp >= 2) fast += blocks / BPS[sp];
      if (blocks >= 8) {
        const t = blocks / BPS[sp]; secs.push(t); total += t;
        const first = haz.filter(h => h.x0 >= x && h.x0 < bd.x).reduce((m, h) => Math.min(m, h.x0), bd.x);
        leadSum += Math.min((first - x) / 30, 20); leadN++;
      } else if (blocks > 0) total += blocks / BPS[sp];
      x = bd.x; if (bd.sp !== null) sp = bd.sp;
    }
    const cols = Math.max(1, Math.floor(end / 30));
    let rests = 0, run = 0;
    for (let c = 0; c < cols; c++) { if (hazCols.has(c)) { if (run >= 6) rests++; run = 0; } else run++; }
    const min = Math.max(total, 1e-9) / 60;
    return {
      seconds: total, sections: secs.length, secsPerSection: secs.length ? total / secs.length : total,
      leadIn: leadN ? leadSum / leadN : 0,                 // blocks from a portal to its first hazard (capped 20)
      hazCols: hazCols.size / cols,                         // share of columns with a hazard
      haz10: haz.length / cols * 10,                        // hazards per 10 blocks
      orbsPadsPerMin: act.length / min, restsPerMin: rests / min, switchesPerMin: cut.length / min,
      fastShare: fast / Math.max(total, 1e-9),             // share of the time at 2x or faster
      modes: modes.size,                                    // distinct game modes
    };
  }

  // Tier from layout: a linear model on standardised layout features, fit by
  // tools/difficulty_tiers.js (rated community levels before 2.2 + official 1-8). Returns a
  // continuous tier, 1 = Easy, 2 = Normal, 3 = Hard, 4 = Harder (above 4: harder than Harder).
  const TIER_FEATURES = [
    ["leadIn", r => r.leadIn], ["hazCols", r => r.hazCols], ["haz10", r => r.haz10],
    ["orbsPads", r => Math.log1p(r.orbsPadsPerMin)], ["rests", r => r.restsPerMin],
    ["section s", r => Math.log(Math.max(r.secsPerSection, 0.5))], ["switches", r => r.switchesPerMin],
    ["fast", r => r.fastShare || 0], ["modes", r => r.modes || 1],
  ];
  // fit 2026-11-22 on 81 levels; leave-one-out Spearman 0.55, exact tier 37%, within one tier 89%
  let TIER_MODEL = {"mean":[5.7842,0.5889,15.6255,3.3251,9.2098,1.9964,20.541,0.2172,4.4321],"sd":[4.7211,0.2542,12.4113,1.2171,7.5703,0.8357,19.4128,0.2363,1.6476],"w":[2.5062,-0.1373,0.5851,-0.0605,0.2793,0.0606,0.3699,0.2446,0.2674,0.0064]};
  function tierFromLayout(lay, model) {
    const m = model || TIER_MODEL;
    if (!m) return null;
    return TIER_FEATURES.reduce((t, [, f], j) => t + m.w[j + 1] * (f(lay) - m.mean[j]) / m.sd[j], m.w[0]);
  }
  const TIER_NAMES = ["Easy", "Normal", "Hard", "Harder"];
  const tierName = t => t === null ? null : t < 1.5 ? "Easy" : t < 2.5 ? "Normal" : t < 3.5 ? "Hard" : t < 4.5 ? "Harder" : "beyond Harder";

  // A rough name for a score, on the official levels' scale (DIFFICULTY.md: where the cut-offs come from)
  function label(logAtt) {
    const cuts = [[0.3, "Easy"], [0.8, "Normal"], [1.5, "Hard"], [2.5, "Harder"], [4, "Insane"]];
    for (const [c, n] of cuts) if (logAtt < c) return n;
    return "Demon";
  }

  Object.assign(GD, { DIFF: D, layout, TIER_FEATURES, tierFromLayout, tierName, humanize, hitChance, actionsOf, measureWindows, actionsFromExact, difficulty: score, difficultyLabel: label });
})(typeof module !== "undefined" ? module.exports : (window.GD = window.GD || {}));
