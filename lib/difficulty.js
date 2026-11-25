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
    SETTLE_LATE_OPEN: false, // exempt late-open windows from the after-portal cut (see settleOf; open question)
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
    SETTLE: 300,        // ms: a window closing this soon after a portal switch loses chance in proportion (fit on 7 real tries, see score())
    CHAIN_GAP: 300,     // ms: jumping-mode inputs closer than this are one chain for chainExtra (ASSUMED; ~ a reaction)
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
  // the after-portal factor of one input (item 5 of DIFFICULTY.md "The measure"); cached inputs without hi count a full
  // 404 ms window as open at the late end. One definition for score(), tools/difficulty.js --cached, quality, balance.
  const lateOpenOf = a => a.lateOpen !== undefined ? a.lateOpen : a.hi !== undefined ? a.hi - a.tick >= D.MAX_SHIFT : a.ms >= msOf(2 * D.MAX_SHIFT + 1) - 0.5;
  // OPEN (2026-11-25, tools/balance.js): should a late-open window be exempt? It is a measuring artifact (its "close" is the
  // search limit), but the exemption drops the fit with the user's own attempts (Spearman 0.87 -> 0.80; vs stars 0.82 -> 0.84).
  // Off until decided: D.SETTLE_LATE_OPEN = true (or opts.lateOpen) turns it on. DIFFICULTY.md "Balance".
  const settleOf = (a, settle, exemptOpen) => { settle = settle || D.SETTLE; if (exemptOpen === undefined) exemptOpen = D.SETTLE_LATE_OPEN;
    return a.afterSwitchMs !== null && a.afterSwitchMs !== undefined && a.afterSwitchMs < settle && !(exemptOpen && lateOpenOf(a)) ? Math.max(0.02, a.afterSwitchMs / settle) : 1; };
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
  const cloneS = s => { const c = { ...s }; c.used = s.used.slice(); if (Array.isArray(s.prev)) c.prev = s.prev.slice(); return c; };

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

  const WCACHE = new WeakMap(); // world -> Map(key -> window), see measureWindows
  // carryWindowCache(wOld, wNew, ranges, aToB) -> how many windows were carried: after an edit, the windows
  // measured on the old level whose look-ahead span (x of the search's start - 40 .. x at its far end + 40)
  // misses every edited x range [[xa, xb], ...] are valid on the new level, so they go into its cache.
  // aToB[oldIndex] = newIndex (-1 removed; tools' diffObjects) renames the object and trigger indices a cached
  // state holds (used orbs/portals; fired / lockAt per trigger); an entry naming a removed one is dropped.
  // Without aToB, indices must be unchanged. (lib/incsolve.js calls it before re-planning; the user: reuse solves)
  // exportWindowCache(w) -> plain JSON { v, entries: [[key, window], ...] } of a world's measured windows, and
  // importWindowCache(w, data) -> how many went in: so a later process (make.js, solutions.js run one per edit)
  // starts warm. Keys stay whole (a state's JSON): carryWindowCache must read and rename them, a hash could not.
  // The caller keeps the export with the level it was measured on (the same level, or carry it after an edit).
  function exportWindowCache(w) { const c = WCACHE.get(w); return { v: 1, entries: c ? [...c] : [] }; }
  function importWindowCache(w, data) {
    if (!data || data.v !== 1 || !Array.isArray(data.entries)) return 0;
    const c = WCACHE.get(w) || (WCACHE.set(w, new Map()), WCACHE.get(w));
    for (const [k, v] of data.entries) c.set(k, v);
    return data.entries.length;
  }
  function carryWindowCache(wOld, wNew, ranges, aToB) {
    const from = WCACHE.get(wOld); if (!from) return 0;
    const to = WCACHE.get(wNew) || (WCACHE.set(wNew, new Map()), WCACHE.get(wNew));
    const obj = i => (aToB ? (aToB[i] === undefined ? -1 : aToB[i]) : i);
    const newK = new Map(); (wNew.trig ? wNew.trig.list : []).forEach((t, k) => newK.set(t.i, k));
    const trig = k => { const [a, n] = String(k).split("."), t = wOld.trig && wOld.trig.list[+a]; if (!t) return null;
      const j = obj(t.i), b = j < 0 ? undefined : newK.get(j); return b === undefined ? null : (n !== undefined ? b + "." + n : String(b)); };
    let n = 0;
    for (const [key, v] of from) {
      if (v.x0 === undefined || ranges.some(([a, b]) => v.x1 >= Math.min(a, b) && v.x0 <= Math.max(a, b))) continue;
      const cut = key.indexOf("|"), st = JSON.parse(key.slice(0, cut));
      if (st.killer) continue;
      let ok = true;
      if (st.used) st.used = st.used.map(i => { const j = obj(i); if (j < 0) ok = false; return j; });
      for (const f of ["fired", "lockAt"]) if (st[f]) { const o = {}; for (const k of Object.keys(st[f])) { const m = trig(k); if (m === null) { ok = false; break; } o[m] = st[f][k]; } st[f] = o; }
      if (!ok) continue;
      to.set(JSON.stringify(st) + key.slice(cut), v); n++;
    }
    return n;
  }
  // Timing window of every action in a solution, by shifting it. path = run(w, events).path.
  // opts.fast: no scan of a tight input's neighbourhood for an easier moment (D.ROUTE_SHIFT) -- cheaper, and a
  // needlessly tight solver timing then reads tight.
  function measureWindows(w, events, opts) {
    opts = opts || {};
    const orbNames = new Set(Object.values(P.OBJECTS || {}).filter(d => d.kind === "orb").map(d => d.name));
    const run = P.run(w, events);
    // a run the sim cannot finish is scored up to 1 s before it dies (the inputs just before
    // a forced death have no window at all); living to that point counts as surviving
    const path = run.path, last = run.done ? path.length - 1 : Math.max(0, path.length - 1 - TPS);
    const range = opts.range; // [from, to]: measure only the actions in this stretch
    const only = opts.ticks ? new Set(opts.ticks) : null; // ticks: measure only the actions at these ticks (one replay for all)
    const acts = actionsOf(events).filter(a => (run.done || a.tick < last) && (!range || (a.tick >= range[0] && a.tick <= range[1])) && (!only || only.has(a.tick)));
    const heldAt = new Array(path.length).fill(false); // input held during step t
    { let h = false, j = 0; const ev = events.slice().sort((a, b) => a.tick - b.tick);
      for (let t = 0; t < path.length; t++) { while (j < ev.length && ev[j].tick === t) { h = ev[j].type === "press"; j++; } heldAt[t] = h; } }
    const allTicks = actionsOf(events).map(a => a.tick);
    // Exact cache (opts.cache !== false): an input's window depends only on the state where its search starts,
    // the button over the span the search can see, the input itself and where the run ends -- so a candidate
    // route that shares them with one measured before reuses the result (humanCost compares many such routes).
    const cache = opts.cache === false ? null : (WCACHE.get(w) || (WCACHE.set(w, new Map()), WCACHE.get(w)));
    const S0 = Math.max(D.MAX_SHIFT, D.ROUTE_SHIFT);
    acts.forEach((a, i) => {
      const nextT = range || only ? (allTicks.find(t => t > a.tick) ?? last) : i + 1 < acts.length ? acts[i + 1].tick : last;
      const gap = Math.min(D.FREEZE, Math.max(1, nextT - a.tick - a.dur));
      let key = null;
      if (cache) {
        const k0 = Math.max(0, a.tick - S0), k1 = Math.min(path.length, Math.max(a.tick, nextT) + S0 + 2 * D.HORIZON + 8);
        key = [JSON.stringify(path[k0]), heldAt.slice(k0, k1).map(h => h ? 1 : 0).join(""), a.type, a.dur, nextT - a.tick,
          Math.min(last - a.tick, k1 - a.tick), run.done ? 1 : 0, opts.fast ? 1 : 0, "h1"].join("|");
        const hit = cache.get(key);
        if (hit) { Object.assign(a, { lo: a.tick + hit.dlo, hi: a.tick + hit.dhi, open: hit.open, ms: hit.ms, moved: hit.moved }); const s = path[Math.min(a.tick, last)]; a.x = s.x; a.mode = s.mode; a.sp = s.sp; return; }
      }
      const before = a.tick > 0 ? heldAt[a.tick - 1] : false;
      const ok = (d) => {
        const t = a.tick + d;
        if (t < 0 || t >= last) return false;
        const until = Math.min(run.done ? last + 1 : last, Math.min(Math.max(t, nextT), t + D.HORIZON) + D.HORIZON); // at most 1 s ahead
        // early: a tap pressed d steps sooner is HELD until its own release (a player holds through a landing or
        // into an orb -- the jump or orb fires on contact; physics, GDLM 50's land-and-jump taps read 1 tick and
        // buffered orb takes read narrow when the early tap let go before the contact)
        if (d <= 0) { const b = a.type === "tap" && d < 0 ? Object.assign({}, a, { dur: a.dur - d }) : a;
          return survives(w, path[t], t > 0 ? heldAt[t - 1] : false, b, t + b.dur + gap, until, heldAt); }
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
      if (!opts.fast && a.ms < D.TIGHT && (a.type !== "release" || flying)) {
        let run = 0, best = 0, bestEnd = 0;
        for (let d = -D.ROUTE_SHIFT; d <= D.ROUTE_SHIFT; d += 2) {
          if (d === 0 || ((flying || effective(d)) && ok(d))) { run += 2; if (run > best) { best = run; bestEnd = d; } } else run = 0;
        }
        if (msOf(best) > a.ms) { a.lo = a.tick + bestEnd - best + 2; a.hi = a.tick + bestEnd; a.ms = msOf(best); a.moved = true; }
      }
      const s = path[Math.min(a.tick, last)];
      a.x = s.x; a.mode = s.mode; a.sp = s.sp;
      if (key) { if (cache.size > 20000) cache.clear();
        const k0 = Math.max(0, a.tick - S0), k1 = Math.min(path.length - 1, Math.max(a.tick, nextT) + S0 + 2 * D.HORIZON + 8);
        cache.set(key, { dlo: a.lo - a.tick, dhi: a.hi - a.tick, open: a.open, ms: a.ms, moved: a.moved, x0: path[k0].x - 40, x1: path[k1].x + 40 }); }
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

  // Route choice like a player (the user: "when there is a hard timing, we avoid it", e.g. the
  // Polargeist jump that skips an orb; the easier timing "should usually be the path"). The
  // solver picks the fewest presses; around each tight input this tries other routes -- drop it,
  // move it up to 600 ms, drop it and tap somewhere else, or add one tap (an orb the solver
  // skipped) -- keeps those that rejoin the original path within 2 s, and takes the one whose
  // inputs, ALL of them charged (so no free rescue taps), have the best chance: max sum log p.
  const REPAIR = { BEFORE: 360, AFTER: 288, SHIFT: 144, PAIR: 288, REJOIN: 480, MAX_MEASURE: 24 };
  function heldArray(events, n) {
    const h = new Array(n).fill(false), ev = events.slice().sort((a, b) => a.tick - b.tick);
    let cur = false, j = 0;
    for (let t = 0; t < n; t++) { while (j < ev.length && ev[j].tick === t) { cur = ev[j].type === "press"; j++; } h[t] = cur; }
    return h;
  }
  function eventsOf(h) {
    const ev = []; let prev = false;
    for (let t = 0; t < h.length; t++) if (h[t] !== prev) { ev.push({ tick: t, type: h[t] ? "press" : "release" }); prev = h[t]; }
    return ev;
  }
  const costOf = (acts, from, to, sigma) => acts.filter(a => a.tick >= from && a.tick <= to)
    .reduce((c, a) => c - Math.log10(Math.max(hitChance(a.ms, sigma), 1e-9)), 0);

  // Joint chance of a stretch of route: every input in [lo, hi] gets its own timing error at once
  // (normal, SIGMA; a tap moves whole), none is re-planned, and the run must live 1 s past the
  // stretch or rejoin the route. Routes are compared on this, not on one window at a time: the
  // usual window lets the look-ahead re-plan later inputs, and inputs can be linked (an early jump,
  // then a held press that jumps on landing: the landing spot hangs on the first jump, so both
  // must be right together, though each alone has a wide window). Same random draws for every
  // route (seeded), so the comparison is fair. Lapses are added per input.
  const MC_SAMPLES = 200;
  function jointCost(w, held, path, lo, hi, sigma) {
    const ev = eventsOf(held.slice(0, path.length)), acts = actionsOf(ev).filter(a => a.tick >= lo && a.tick <= hi);
    if (!acts.length) return 0;
    let seed = 12345;
    const rnd = () => { // mulberry32
      seed = (seed + 0x6D2B79F5) | 0; let z = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z; return ((z ^ (z >>> 14)) >>> 0) / 4294967296; };
    const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
    const sd = (sigma || D.SIGMA) / 1000 * TPS; // steps
    let alive = 0;
    for (let k = 0; k < MC_SAMPLES; k++) {
      const shifted = [];
      const moved = new Set();
      for (const a of acts) {
        const d = Math.round(gauss() * sd);
        const idx = ev.findIndex(e => e.tick === a.tick);
        shifted.push({ tick: a.tick + d, type: ev[idx].type }); moved.add(idx);
        if (a.type === "tap") { shifted.push({ tick: ev[idx + 1].tick + d, type: "release" }); moved.add(idx + 1); }
      }
      const ev2 = ev.filter((_, i) => !moved.has(i)).concat(shifted).sort((x, y) => x.tick - y.tick || (x.type === "release" ? -1 : 1));
      const t0 = Math.max(1, Math.min(...shifted.map(e => e.tick), ...[...moved].map(i => ev[i].tick)) - 1); // before both the old and the new moment
      const end = Math.min(path.length - 1, Math.max(...shifted.map(e => e.tick)) + TPS);
      const h2 = heldArray(ev2, end + 1);
      const s = cloneS(path[t0]); let prev = h2[t0 - 1], ok = true;
      for (let t = t0; t < end; t++) {
        const hv = h2[t];
        P.step(w, s, { press: hv && !prev, held: hv }); prev = hv;
        if (s.dead) { ok = false; break; }
        if (s.done) break;
      }
      if (ok) alive++;
    }
    const p = Math.max(alive, 0.5) / MC_SAMPLES * Math.pow(1 - D.LAPSE, acts.length);
    return -Math.log10(p);
  }

  function easierRoute(w, events, acts, opts) {
    opts = opts || {};
    const sigma = opts.sigma || D.SIGMA;
    const orbNames = new Set(Object.values(P.OBJECTS || {}).filter(d => d.kind === "orb").map(d => d.name));
    let run = P.run(w, events), path = run.path;
    if (!run.done) return { events, acts, changed: 0 }; // only finished routes (a partial one has no goal to keep)
    const N = path.length + REPAIR.REJOIN;
    let held = heldArray(events, N), changed = 0, tried = new Set(), log = [];
    for (;;) {
      // steering modes (ship, wave, swing) never land back on the same state; their window search
      // already re-plans the steering after a mistimed input
      const a = acts.find(x => x.ms < D.TIGHT && !tried.has(x.tick) && x.type !== "release" && !/ship|wave|swing/.test(x.mode));
      if (!a) break;
      tried.add(a.tick);
      const from = Math.max(1, a.tick - REPAIR.BEFORE), to = Math.min(path.length - 1, a.tick + REPAIR.AFTER);
      const dur = a.dur || D.TAPLEN;
      const cands = [];
      const without = held.slice(); for (let t = a.tick; t < N && held[t] && t < a.tick + Math.max(dur, 1) + 400; t++) without[t] = false;
      const tapAt = (h, t, len) => { if (h[t - 1] || h[t]) return null; const c = h.slice(); for (let k = t; k < t + len && k < N; k++) { if (h[k]) break; c[k] = true; } return c; };
      cands.push({ why: "drop", h: without });
      for (let d = -REPAIR.SHIFT; d <= REPAIR.SHIFT; d += 4) {
        if (a.tick + d >= a.lo - 4 && a.tick + d <= a.hi + 4) continue;
        const c = tapAt(without, a.tick + d, Math.max(dur, D.TAPLEN)); if (c) cands.push({ why: "move " + Math.round(msOf(d)) + " ms", h: c });
      }
      for (let t = from - (from % 4); t <= to; t += 4) {
        if (!(t >= a.lo - 4 && t <= a.hi + 4)) { const c = tapAt(without, t, D.TAPLEN); if (c) cands.push({ why: "drop, tap " + Math.round(msOf(t - a.tick)) + " ms", h: c }); }
        const c2 = (t >= a.lo - 4 && t <= a.hi + 4) ? null : tapAt(held, t, D.TAPLEN); if (c2) cands.push({ why: "add tap " + Math.round(msOf(t - a.tick)) + " ms", h: c2 });
      }
      // two taps in its place (a jump and an orb onto a platform; onto a platform, then off its end)
      for (let t1 = from - (from % 8); t1 < a.tick + REPAIR.SHIFT; t1 += 8) {
        const c1 = tapAt(without, t1, D.TAPLEN); if (!c1) continue;
        for (let t2 = t1 + D.TAPLEN + 8; t2 <= Math.min(to, t1 + REPAIR.PAIR); t2 += 8) {
          const c = tapAt(c1, t2, D.TAPLEN);
          if (c) cands.push({ why: "two taps " + Math.round(msOf(t1 - a.tick)) + " and " + Math.round(msOf(t2 - a.tick)) + " ms", h: c });
        }
      }
      // simulate each from its first changed step; it must rejoin the original path
      const groups = new Map();
      for (const c of cands) {
        let t0 = from; while (t0 < N && c.h[t0] === held[t0]) t0++;
        if (t0 >= path.length) continue;
        t0 = Math.max(1, t0);
        let tLast = N - 1; while (tLast > t0 && c.h[tLast] === held[tLast]) tLast--;
        const s = cloneS(path[t0]); let prev = c.h[t0 - 1], rejoin = null; const sig = [];
        const newPress = new Set(), worked = new Set(); let lastPress = -1;
        for (let t = t0; t <= tLast; t++) if (c.h[t] && !c.h[t - 1] && !(held[t] && !held[t - 1])) newPress.add(t);
        for (let t = t0; t < Math.min(path.length - 1, to + REPAIR.REJOIN); t++) {
          if (c.h[t] && !prev) lastPress = t;
          P.step(w, s, { press: c.h[t] && !prev, held: c.h[t] }); prev = c.h[t];
          if (s.dead) break;
          if (s.act && (s.act === "jump" || orbNames.has(s.act) || /flap|teleport/.test(s.act))) { sig.push(Math.round(t / 24) + s.act); if (c.h[t]) worked.add(lastPress); }
          if (s.done) { rejoin = t; break; }
          const o = path[t + 1];
          if (t > tLast && c.h[t] === held[t] && Math.abs(s.x - o.x) < 0.5 && fkey(w, s, c.h[t]) === fkey(w, o, held[t])) { rejoin = t; break; }
        }
        if (rejoin === null || [...newPress].some(t => !worked.has(t))) continue; // every new tap must do something
        const key = sig.join(",");
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(Object.assign(c, { rejoin }));
      }
      // one route per distinct sequence of jumps/orbs, its middle candidate; fewest inputs first
      const reps = [...groups.values()].map(g => g[g.length >> 1])
        .sort((x, y) => eventsOf(x.h).length - eventsOf(y.h).length).slice(0, REPAIR.MAX_MEASURE);
      if (opts.debug) opts.debug(`tight ${Math.round(a.ms)} ms at block ${(a.x / 30).toFixed(1)} (${a.mode}, ${a.type}): ${cands.length} tried, ${[...groups.values()].reduce((n, g) => n + g.length, 0)} rejoin, ${groups.size} routes`);
      if (!reps.length) continue;
      let best = null;
      for (const c of reps) {
        const hi = Math.max(c.rejoin, a.tick) + 24, lo = from - TPS;
        const ev = eventsOf(c.h.slice(0, path.length + 1));
        const r = P.run(w, ev);
        if (!r.done) continue;
        // the joint chance decides (every input of the route charged, none re-planned) ...
        const sc = jointCost(w, c.h, r.path, lo, hi, sigma), so = jointCost(w, held, path, lo, hi, sigma);
        if (opts.debug) opts.debug(`   ${c.why}: joint cost ${sc.toFixed(3)} vs ${so.toFixed(3)}`);
        if (!(sc < so - 0.02)) continue;
        // ... and the usual windows, which the score uses, must agree
        const cActs = measureWindows(w, ev, { range: [lo, hi] });
        const cost = costOf(cActs, lo, hi, sigma), orig = costOf(acts, lo, hi, sigma);
        if (opts.debug) opts.debug(`   ${c.why}: ${cActs.length} inputs cost ${cost.toFixed(3)} vs ${orig.toFixed(3)}`);
        if (cost < orig - 0.02 && (!best || cost - orig < best.gain)) best = { c, ev, cActs, lo, hi, gain: cost - orig, orig, cost };
      }
      if (!best) continue;
      log.push({ tick: a.tick, x: a.x, was: a.ms, why: best.c.why, gain: +(-best.gain).toFixed(3) });
      events = best.ev; held = heldArray(events, N); path = P.run(w, events).path; changed++;
      acts = acts.filter(x => x.tick < best.lo || x.tick > best.hi).concat(best.cActs).sort((x, y) => x.tick - y.tick);
      for (const x of best.cActs) if (x.ms < D.TIGHT) tried.add(x.tick); // no endless re-routing
    }
    return { events, acts, changed, log };
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
    let events = hu.events;
    let acts = opts.actions || ((sol.clicks && sol.clicks.length && !sol.sweep && sol.ok && !hu.changed)
      ? actionsFromExact(w, sol) : measureWindows(w, events, opts));
    // a player avoids a tight timing when the level offers an easier route (easierRoute)
    let rerouted = { changed: 0, log: [] };
    if (!opts.raw && !opts.actions && opts.route !== false) {
      rerouted = easierRoute(w, events, acts, opts);
      if (rerouted.changed) { events = rerouted.events; acts = rerouted.acts; }
    }
    const r = P.run(w, events);
    const path = r.done ? r.path : r.path.slice(0, Math.max(1, r.path.length - TPS));
    const secs = (path.length - 1) / TPS, endX = path[path.length - 1].x;
    // Forced right after a portal switch (mode, speed, gravity portal, size): the player has not
    // settled into the new mode yet. Per input, afterSwitchMs = ms from the last switch at or
    // before it to its window's end; under SETTLE the input's chance is scaled by afterSwitchMs /
    // SETTLE. Fitted on the user's first attempts at two GDLM levels (physics session's
    // local/real_stats.jsonl, 2026-11-23): a wave entry closing 54 ms after the portal passed 1 of 5
    // times, a jump closing 171 ms after a wave exit 1 of 2 (a 92 and a 129 ms window, which alone
    // give ~100%). Maximum likelihood 315 ms. opts.settle === false turns it off.
    const switchTicks = [];
    for (let t = 1; t < path.length; t++) {
      const s0 = path[t - 1], s1 = path[t];
      if (s1.mode !== s0.mode || s1.sp !== s0.sp || !!s1.mini !== !!s0.mini || (s1.grav !== s0.grav && /portal/.test(s1.act || ""))) switchTicks.push(t);
    }
    let afterSwitch = 0;
    for (const a of acts) {
      let k = -1; for (let i = 0; i < switchTicks.length && switchTicks[i] <= a.tick; i++) k = i;
      a.afterSwitchMs = k < 0 ? null : msOf((a.hi !== undefined ? a.hi : a.tick) - switchTicks[k]);
      // a window whose late end hit the search limit (MAX_SHIFT) does not close there: its real end is later, so
      // afterSwitchMs is only a floor and the press is not forced (tools/balance.js found it: 6 of FROSTBITE's 9
      // after-portal presses had 404 ms windows "closing" exactly 200 ms after the portal, 1.06 of its 2.66)
      a.lateOpen = lateOpenOf(a);
      a.settle = settleOf(a, D.SETTLE, opts.lateOpen);
      if (a.settle < 1) afterSwitch++;
    }
    // Chains with no time to correct (the physics session, GDLM 46 v2: "can't adjust" orb chains,
    // the user: "I mostly died deaths not really my fault"). Inputs in jumping modes closer than
    // CHAIN_GAP are one chain; its joint chance (every input jittered at once, none re-planned)
    // is set against the product of its windows. Reported only: at a 300 ms gap it adds little on
    // GDLM 46, at 400 ms it predicts 62% deaths in a stretch where the user had 33%.
    const chains = [];
    if (opts.chains !== false) {
      const J = acts.filter(a => !/ship|wave|swing/.test(a.mode));
      let ch = [];
      const flush = () => { if (ch.length > 1) chains.push(ch); ch = []; };
      for (const a of J) { if (ch.length && a.tick - ch[ch.length - 1].tick >= D.CHAIN_GAP / 1000 * TPS) flush(); ch.push(a); }
      flush();
    }
    const heldAll = chains.length ? heldArray(events, r.path.length + 1) : null;
    let chainExtra = 0, worstChain = null;
    for (const c of chains) {
      const ind = c.reduce((t, a) => t - Math.log10(Math.max(hitChance(a.ms, sigma, opts.lapse), 1e-9)), 0);
      const j = jointCost(w, heldAll, r.path, c[0].tick - 1, c[c.length - 1].tick + 1, sigma);
      if (j > ind) { chainExtra += j - ind; if (!worstChain || j - ind > worstChain.extra) worstChain = { x: c[0].x, inputs: c.length, extra: j - ind, joint: j }; }
    }
    let logAtt = 0, deaths = 0;
    for (const a of acts) {
      a.p = Math.max(hitChance(a.ms, sigma, opts.lapse) * (opts.settle === false ? 1 : a.settle), 1e-9);
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
      chainExtra, worstChain,                      // log10 attempts more if quick chains are not corrected (not in the score)
      forcedAfterSwitch: afterSwitch,              // windows closing < SETTLE ms after a portal switch (their chance is scaled)
      actions: acts, events, humanized: hu.changed, rerouted: rerouted.log || [],
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

  // humanCost(w, events, opts) -> { cost, terms, actions }: how hard a route is FOR A PERSON, lower is better --
  // the one cost every solver's final pick and the viewer's natural route use (the user, 2026-11-23: "the
  // natural route = the valid route with the lowest human cost"; physics wires it into lib/natural.js).
  // In log10-attempts units, so the main term IS the difficulty score of exactly this route (no humanize, no
  // route choice: the caller's candidates are the choice):
  //   windows   -sum log10 p over every input (lenient windows, measureWindows; settling after a portal)
  //   presses   0.01 a press (0.002 in a flying mode): of two equally safe routes, the one with fewer inputs
  //   centre    0.02 x how far each input sits from the middle of its window (0 = middle, 1 = at an edge):
  //             a route timed at its windows' edges looks wrong when replayed and is not what a person does
  //   marks     0.05 per jump mark (deco group 990; pieces within 45 units are one) with no jump (jump, flap or
//             orb firing -- a held button jumps on landing too) within 60 units: off the indicated path
  //   beat      opts.beats (level-time seconds): 0.005 x distance to the nearest beat in beats, per press (off
  //             unless given; the user: sync loosely)
  // opts.actions: windows already measured for these events (skips the measuring).
  //   clearance 0.1 a second that a flying mode (ship, UFO, wave, swing) spends nearer a wall, hazard or the band's
  //             floor/roof than the corridor forces: closer than min(12, room / 4) units to the nearest one, room =
  //             the free height around it (physics, Stereo Madness's first ship: the solver's line rides floor and
  //             ceiling 62% of the time; the user: "just flying somewhat straight through the paths")
  //   presses   in a flying mode 0.002 a press, not 0.01: hover taps are how a person flies
  //   pointless 0.05 per cube jump over nothing (lib/natural.js pointlessJumps: from the ground, lands no higher,
  //             nothing under or near the arc) -- the user: "just dropping in the staircases is usually the intended
  //             way", a jump there "creates a timing"; walking off costs nothing
  const HC = { POINTLESS: 0.05, PRESS: 0.01, PRESS_FLY: 0.002, CENTRE: 0.02, MARK: 0.05, BEAT: 0.005, MARK_DIST: 60, CLEAR: 0.1, CLEAR_MAX: 12, CLEAR_ROOM: 0.25 };
  const FLY = /^(ship|ufo|wave|swing)$/;
  // lib/natural.js's pointlessJumps, looked up when called (natural.js uses humanCost: no load-time cycle)
  function pointlessOf(w, events) {
    const N = typeof module !== "undefined" && typeof require !== "undefined" ? require("./natural.js") : GD;
    const f = N.pointlessJumps || (typeof GD !== "undefined" && GD.pointlessJumps);
    try { return f ? f(w, events).length : 0; } catch (e) { return 0; }
  }
  // seconds a route's flying ticks spend nearer a surface than the corridor forces (see HC.CLEAR)
  function clearanceSeconds(w, path) {
    let close = 0;
    for (let t = 0; t < path.length; t += 2) {
      const s = path[t];
      if (!FLY.test(s.mode)) continue;
      const h = s.mode === "wave" ? (s.mini ? 3 : 5) : (s.mini ? 9 : 15);
      let up = isFinite(s.ceilY) ? s.ceilY - s.y : 600, down = s.y - (isFinite(s.floorY) ? s.floorY : 0);
      for (let c = Math.floor((s.x - h) / 30); c <= Math.floor((s.x + h) / 30); c++) {
        for (const b of w.cols.get(c) || []) {
          if (b.kind !== "hazard" && b.kind !== "solid" && b.kind !== "slope") continue;
          if (!(s.x - h < b.x1 && b.x0 < s.x + h)) continue;
          if (b.y0 >= s.y) up = Math.min(up, b.y0 - s.y); else if (b.y1 <= s.y) down = Math.min(down, s.y - b.y1);
        }
      }
      const eu = Math.max(0, up - h), ed = Math.max(0, down - h), room = Math.min(eu + ed, 600);
      if (Math.min(eu, ed) < Math.min(HC.CLEAR_MAX, room * HC.CLEAR_ROOM)) close += 2;
    }
    return close / TPS;
  }
  function humanCost(w, events, opts) {
    opts = opts || {};
    const d = score(w, { events }, Object.assign({ raw: true, route: false, chains: false }, opts));
    const presses = events.filter(e => e.type === "press");
    let centre = 0;
    for (const a of d.actions) if (a.lo != null && a.hi != null && a.hi > a.lo) { const mid = (a.lo + a.hi) / 2, half = (a.hi - a.lo) / 2; centre += Math.min(1, Math.abs(a.tick - mid) / half); }
    const r = P.run(w, events), xAt = t => (r.path[Math.min(t, r.path.length - 1)] || {}).x;
    // where the player jumps (a jump, flap or orb fires: a held button jumps again on landing), not where it presses
    const orbNames = new Set(Object.values(P.OBJECTS || {}).filter(o => o.kind === "orb").map(o => o.name)), JUMPS = new Set(["jump", "tap", "flap"]);
    const pressX = r.path.filter(q => q.act && (JUMPS.has(q.act) || orbNames.has(q.act))).map(q => q.x);
    const marks = (w.objects || []).filter(o => o.props && String(o.props[57] || "").split(".").includes("990"));
    // a mark is often several objects (arrow + glow): pieces within 45 units in x are one mark
    const xs = marks.map(m => m.x).filter(x => x < r.end.x).sort((a, b) => a - b), cl = [];
    for (const x of xs) { if (cl.length && x - cl[cl.length - 1].x1 <= 45) cl[cl.length - 1].x1 = x; else cl.push({ x0: x, x1: x }); }
    const missed = cl.filter(c => !pressX.some(x => x >= c.x0 - HC.MARK_DIST && x <= c.x1 + HC.MARK_DIST)).length;
    let beat = 0;
    if (opts.beats && opts.beats.length) for (const e of presses) { const t = e.tick / TPS; let b = Infinity; for (const q of opts.beats) b = Math.min(b, Math.abs(q - t)); beat += b; }
    const flyPress = presses.filter(e => FLY.test((r.path[Math.min(e.tick, r.path.length - 1)] || {}).mode || "")).length;
    const terms = { windows: d.logAttempts, presses: HC.PRESS * (presses.length - flyPress) + HC.PRESS_FLY * flyPress,
      clearance: HC.CLEAR * clearanceSeconds(w, r.path),
      pointless: HC.POINTLESS * pointlessOf(w, events), centre: HC.CENTRE * centre, marks: HC.MARK * missed, beat: HC.BEAT * beat };
    return { cost: Object.values(terms).reduce((a, b) => a + b, 0), terms, actions: d.actions, complete: d.complete };
  }
  const TIER_NAMES = ["Easy", "Normal", "Hard", "Harder"];
  const tierName = t => t === null ? null : t < 1.5 ? "Easy" : t < 2.5 ? "Normal" : t < 3.5 ? "Hard" : t < 4.5 ? "Harder" : "beyond Harder";

  // A rough name for a score, on the official levels' scale (DIFFICULTY.md: where the cut-offs come from)
  function label(logAtt) {
    const cuts = [[0.3, "Easy"], [0.8, "Normal"], [1.5, "Hard"], [2.5, "Harder"], [4, "Insane"]];
    for (const [c, n] of cuts) if (logAtt < c) return n;
    return "Demon";
  }

  Object.assign(GD, { DIFF: D, settleOf, lateOpenOf, survivesFrom: survives, cloneState: cloneS, layout, TIER_FEATURES, tierFromLayout, tierName, humanize, hitChance, actionsOf, measureWindows, actionsFromExact, easierRoute, jointCost: (w, events, lo, hi, sigma) => { const r = P.run(w, events); return jointCost(w, heldArray(events, r.path.length + 1), r.path, lo, hi, sigma); }, difficulty: score, difficultyLabel: label, humanCost, HUMAN_COST: HC, carryWindowCache, exportWindowCache, importWindowCache });
})(typeof module !== "undefined" ? module.exports : (window.GD = window.GD || {}));
