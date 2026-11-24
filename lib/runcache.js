// lib/runcache.js -- GD.run, exact, without replaying what an earlier run already played.
//
// The route planner (lib/natural.js), the windows (lib/windows.js), firmUp and the no-skip checks call GD.run
// thousands of times on one world, each with an input list that differs from an earlier one in one spot (a tap
// moved, a press dropped, a hold cut). Each call replayed the whole level from tick 0: Hexagon Force's viewer
// route took ~15 min after a 9.5 min solve (2026-11-24). Here a run:
//   1. starts from the state of a cached run on the same world at the first tick where their inputs differ
//      (the states before it are the same: step() is a pure function of the world, the state and the input);
//   2. once past the last tick where they differ, checks every few ticks whether its state is EXACTLY the cached
//      run's state at that tick (every field, objects compared by content) with the same button; from there on
//      the two runs are the same, so it takes the cached tail and the cached end.
// The result is the same object shape as GD.run's ({ path, dead, done, why, killer, end }). Path states are shared
// with the cached runs (GD.run's states are snapshots nobody writes to); the path array itself is new.
// GDLM_RUNCACHE=0 (node) or GD.RUNCACHE = false turns it off. Test: node tests/runcache.js (cached == plain).
(function (root) {
  const KEEP = 6, EVERY = 8;
  let GD = null;
  const off = () => GD.RUNCACHE === false || (typeof process !== "undefined" && process.env && process.env.GDLM_RUNCACHE === "0");

  // the inputs as GD.run reads them: a number is a 1-tick tap; a later event on the same tick wins
  function norm(events) {
    const ev = new Map();
    for (const e of events || []) {
      if (typeof e === "number") { ev.set(e, "press"); if (!ev.has(e + 1)) ev.set(e + 1, "release"); }
      else ev.set(e.tick, e.type);
    }
    return { map: ev, list: [...ev.entries()].sort((a, b) => a[0] - b[0]) };
  }
  // first and last tick where two input lists differ (Infinity / -1 when the same)
  function diff(a, b) {
    let i = 0;
    while (i < a.length && i < b.length && a[i][0] === b[i][0] && a[i][1] === b[i][1]) i++;
    const first = i < a.length || i < b.length ? Math.min(i < a.length ? a[i][0] : Infinity, i < b.length ? b[i][0] : Infinity) : Infinity;
    let j = a.length - 1, k = b.length - 1;
    while (j >= i && k >= i && a[j][0] === b[k][0] && a[j][1] === b[k][1]) { j--; k--; }
    const last = Math.max(j >= i ? a[j][0] : -1, k >= i ? b[k][0] : -1);
    return { first, last };
  }
  // the button before tick t
  function heldAt(list, t) { let h = false; for (const [tk, ty] of list) { if (tk >= t) break; if (ty === "press") h = true; else if (ty === "release") h = false; } return h; }
  const clone = s => { const c = { ...s }; c.used = s.used.slice(); return c; };
  function same(a, b) {
    for (const k in a) {
      const x = a[k], y = b[k];
      if (x === y) continue;
      if (x && y && typeof x === "object" && typeof y === "object") { if (JSON.stringify(x) !== JSON.stringify(y)) return false; continue; }
      return false;
    }
    for (const k in b) if (!(k in a)) return false;
    return true;
  }

  function install(G) {
    if (!G.run || G.run.cached) return;
    GD = G;
    const plain = GD.run, caches = new WeakMap();
    const run = function (w, events) {
      if (off()) return plain(w, events);
      const E = norm(events);
      let list = caches.get(w); if (!list) caches.set(w, list = []);
      // the cached run that agrees longest
      let best = null, bd = null;
      for (const c of list) { const d = diff(E.list, c.E.list); if (!best || d.first > bd.first) { best = c; bd = d; } }
      const out = r => { const i = list.indexOf(r.c); if (i >= 0) list.splice(i, 1); list.unshift(r.c); if (list.length > KEEP) list.pop(); return r.res; };
      const max = Math.ceil((w.endX / (GD.SPEEDS[0].x * 60) + 5) * GD.PHYS.TPS);
      if (best) {
        const L = best.path.length - 1;
        // the cached run ended (died, finished or timed out) before the inputs differ: this run is the same
        if (L < bd.first) return out({ c: best, res: { ...best.res, path: best.path.slice(), end: clone(best.res.end) } });
      }
      const T = best ? bd.first : 0;
      const s = best ? clone(best.path[T]) : GD.startState(w), path = best ? best.path.slice(0, T + 1) : [clone(s)];
      let held = best ? heldAt(E.list, T) : false, joined = null;
      while (!s.dead && !s.done && s.tick < max) {
        const e = E.map.get(s.tick);
        let press = false;
        if (e === "press") { press = true; held = true; }
        if (e === "release") held = false;
        GD.step(w, s, { press, held });
        path.push(clone(s));
        // back on the cached run: same tick, same state, same button, same inputs from here on
        if (best && s.tick > bd.last && s.tick % EVERY === 0 && s.tick < best.path.length && held === heldAt(best.E.list, s.tick) && same(s, best.path[s.tick])) { joined = best; break; }
      }
      let res;
      if (joined) {
        for (let t = s.tick + 1; t < joined.path.length; t++) path.push(joined.path[t]);
        res = { path, dead: joined.res.dead, done: joined.res.done, why: joined.res.why, killer: joined.res.killer, end: clone(joined.res.end) };
      } else res = { path, dead: s.dead, done: s.done, why: s.why, killer: s.killer, end: clone(s) };
      const c = { E, path, res: { dead: res.dead, done: res.done, why: res.why, killer: res.killer, end: res.end } };
      return out({ c, res: { ...res, path: path.slice() } });
    };
    run.cached = true; run.plain = plain;
    GD.run = run;
  }
  root.installRunCache = install;
})(typeof module !== "undefined" ? module.exports : (window.GD = window.GD || {}));
