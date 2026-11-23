// GD.runSliced(w, events, opts) -- GD.run (lib/physics.js) in slices, for the viewer: the replay of a big level (official
// 20 Deadlocked: ~20k ticks, ~400 ms in one go) blocked the page when it opened ("i clicked official and it hanged").
// Same loop as run(), so the same path: tests/runner_same.js checks it against GD.run on real levels.
//   const r = GD.runSliced(w, events); while (!r.advance(20)) await nextFrame();   // advance(ms): true when finished
//   r.result -> { path, dead, done, why, killer, end }  (exactly what run() returns)
(function (OUT) {
  "use strict";
  const GD = typeof module !== "undefined" && module.exports === OUT ? Object.assign({}, require("./physics.js")) : OUT;
  const clone = s => { const c = Object.assign({}, s); c.used = s.used.slice(); return c; };   // as physics.js clone()
  function runSliced(w, events) {
    const ev = new Map();
    for (const e of events || []) {
      if (typeof e === "number") { ev.set(e, "press"); if (!ev.has(e + 1)) ev.set(e + 1, "release"); }
      else ev.set(e.tick, e.type);
    }
    const s = GD.startState(w), path = [clone(s)];
    let held = false;
    const max = Math.ceil((w.endX / (GD.SPEEDS[0].x * 60) + 5) * GD.PHYS.TPS);
    const r = { result: null, path };
    r.advance = (ms = 20) => {
      if (r.result) return true;
      const t0 = Date.now();
      let n = 0;
      while (!s.dead && !s.done && s.tick < max) {
        const e = ev.get(s.tick);
        let press = false;
        if (e === "press") { press = true; held = true; }
        if (e === "release") held = false;
        GD.step(w, s, { press, held });
        path.push(clone(s));
        if (++n % 256 === 0 && Date.now() - t0 > ms) return false;
      }
      r.result = { path, dead: s.dead, done: s.done, why: s.why, killer: s.killer, end: clone(s) };
      return true;
    };
    return r;
  }
  OUT.runSliced = runSliced;
})(typeof module !== "undefined" ? module.exports : (window.GD = window.GD || {}));
