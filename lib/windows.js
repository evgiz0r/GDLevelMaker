// GD.inputWindows(w, events, path, opts) -- the timing window of every input of a plan: ONE definition for
// the viewer, tools/windows.js, tools/score.js and difficulty (agreed 2026-11-23 after they disagreed 4 ms vs
// 113 ms on GDLM 47 and 13 vs 208 ms on GDLM 44 v13).
// The window is a PLAYER's: the input moved a tick at a time counts as hit while the run can still go on with
// the next inputs re-planned around it, the way a player corrects (lib/difficulty.js measureWindows: a short
// beam search up to ~1 s ahead; a tight input also gets the widest stretch of moments that works, as a player
// picks the best moment the level offers). It is the definition validated against the user's attempts
// (DIFFICULTY.md). Measured on GDLM 47's natural route: tightest 8 ms (block 67.5, a real spike-then-step
// jump); the strict rule read five more 4 ms "windows" there that re-planned are 50 ms and up.
// opts.strict: the old rule, for debugging -- every later input stays at its tick, so moving a jump a tick
// makes a later fixed input miss (it understates windows); fast (each try starts from the plan's saved
// state and stops when it rejoins the plan).
// Returns [{ i, j, type, tick, lo, hi }] per moved input (i: index in the tick-sorted events; j: the tap's
// release index, or -1). opts.only(i) -> false skips an input; opts.budget: ms to spend before returning
// (then call again with opts.from = the returned .next to continue; the viewer stays responsive).
// opts.span (strict only): ticks looked at each way (default 60).
// In the browser lib/difficulty.js must be loaded first (else the strict rule is used).
(function (OUT) {
  "use strict";
  const GD = typeof module !== "undefined" && module.exports === OUT
    ? Object.assign({}, require("./objects.js"), require("./physics.js"), require("./difficulty.js")) : OUT;
  const same = (a, b) => a.x === b.x && a.y === b.y && a.vy === b.vy && a.grav === b.grav && a.sp === b.sp &&
    a.mode === b.mode && a.grounded === b.grounded && a.dashing === b.dashing && a.used.length === b.used.length &&
    a.floorY === b.floorY && a.ceilY === b.ceilY && a.buffered === b.buffered && a.ring === b.ring;
  const cl = s => { const c = { ...s }; c.used = s.used.slice(); return c; };

  function inputWindows(w, events, path, opts) {
    opts = opts || {};
    if (!opts.strict && GD.measureWindows && GD.actionsOf) return playerWindows(w, events, opts);
    return strictWindows(w, events, path, opts);
  }

  function playerWindows(w, events, opts) {
    const ev = events.slice().sort((a, b) => a.tick - b.tick), acts = GD.actionsOf(ev);
    const out = opts.out || [], t0 = Date.now();
    // the inputs to measure, then measured in batches with ONE replay each (measureWindows opts.ticks); with a
    // budget, small batches so the viewer can stop between them
    const todo = [];
    for (let k = opts.from || 0; k < acts.length; k++) {
      const a = acts[k];
      const i = ev.findIndex(e => e.tick === a.tick && (a.type === "release" ? e.type === "release" : e.type === "press"));
      if (i < 0 || (opts.only && !opts.only(i))) continue;
      todo.push({ k, a, i });
    }
    const BATCH = opts.budget ? 4 : Infinity;
    for (let b = 0; b < todo.length; b += BATCH) {
      if (opts.budget && Date.now() - t0 > opts.budget) return Object.assign(out, { next: todo[b].k });
      const part = todo.slice(b, b + BATCH);
      const ms = GD.measureWindows(w, ev, { ticks: part.map(p => p.a.tick) });
      for (const { a, i } of part) {
        const m = ms.find(x => x.tick === a.tick);
        if (!m) continue;   // after the point a run the sim cannot finish stops being scored
        out.push({ i, j: a.type === "tap" ? i + 1 : -1, type: ev[i].type, tick: a.tick, lo: m.lo, hi: m.hi, open: !!m.open, moved: !!m.moved });
      }
    }
    return Object.assign(out, { next: null });
  }

  function strictWindows(w, events, path, opts) {
    const SPAN = opts.span || 60, ev = events.slice().sort((a, b) => a.tick - b.tick);
    const max = Math.ceil((w.endX / (GD.SPEEDS[0].x * 60) + 5) * GD.PHYS.TPS);
    const heldBefore = (list, k) => { let h = false; for (const e of list) { if (e.tick >= k) break; h = e.type === "press"; } return h; };
    const clears = (list, a, last) => {
      const m = new Map(); for (const e of list) m.set(e.tick, e.type);
      const s = cl(path[Math.min(a, path.length - 1)]); let held = heldBefore(list, a);
      if (s.tick !== a) return null; // the plan never got that far
      while (!s.dead && !s.done && s.tick < max) {
        if (s.tick > last && s.tick < path.length && same(s, path[s.tick]) && held === heldBefore(ev, s.tick)) return true;
        const e = m.get(s.tick); let press = false;
        if (e === "press") { press = true; held = true; } else if (e === "release") held = false;
        GD.step(w, s, { press, held });
      }
      return !s.dead && (s.done || s.x >= w.endX);
    };
    const tapEnd = i => ev[i].type === "press" && ev[i + 1] && ev[i + 1].type === "release" && ev[i + 1].tick - ev[i].tick <= 3 ? i + 1 : -1;
    const out = opts.out || [], t0 = Date.now();
    for (let i = opts.from || 0; i < ev.length; i++) {
      if (opts.budget && Date.now() - t0 > opts.budget) return Object.assign(out, { next: i });
      if (i > 0 && tapEnd(i - 1) === i) continue;
      if (opts.only && !opts.only(i)) continue;
      const e = ev[i], j = tapEnd(i), gap = j > 0 ? ev[j].tick - e.tick : 0, lastI = j > 0 ? j : i;
      const lo0 = Math.max(i > 0 ? ev[i - 1].tick + 1 : 0, e.tick - SPAN);
      const hi0 = Math.min(lastI + 1 < ev.length ? ev[lastI + 1].tick - 1 - gap : Infinity, e.tick + SPAN);
      const ok = t => { const l = ev.map(x => Object.assign({}, x)); l[i].tick = t; if (j > 0) l[j].tick = t + gap;
        return clears(l, Math.min(t, e.tick), Math.max(t, e.tick) + gap + 1); };
      let lo = e.tick, hi = e.tick;
      while (lo - 1 >= lo0 && ok(lo - 1)) lo--;
      while (hi + 1 <= hi0 && ok(hi + 1)) hi++;
      out.push({ i, j, type: e.type, tick: e.tick, lo, hi });
    }
    return Object.assign(out, { next: null });
  }
  OUT.inputWindows = inputWindows;
  OUT.strictWindows = strictWindows;
})(typeof module !== "undefined" ? module.exports : (window.GD = window.GD || {}));
