// GD.livePlay(w, opts) -- the sim run live, one input at a time, for the viewer's "you play" mode (VIEWER.md): the
// same GD.step as GD.run / GD.runSliced (tests/liveplay.js checks that pressing at a route's ticks gives run()'s path),
// with practice checkpoints and restarts.
//   const lp = GD.livePlay(w, { checkpoints: [x, ...] });
//   lp.press(); lp.release();            // take effect on the next tick stepped (presses land on a frame boundary,
//                                        // as in the user's game: "Click Between Steps" is off)
//   lp.advanceTo(tick)                   // step until path.length - 1 === tick, or death / the end; -> lp.state
//   lp.path, lp.held                     // every step's state and button (arrays, grow as it runs)
//   lp.restart(fromCheckpoint)           // back to the start, or to the last checkpoint passed (practice)
//   lp.state.dead / .done / .why, lp.cp (the checkpoint it restarts from: {tick, x} or null)
//   lp.events                            this attempt's inputs [{tick, type}] from the level's start (a practice attempt
//                                        keeps the presses that reached its checkpoint): GD.run(w, lp.events) replays it
// GD.levelHash(levelStr) -- FNV-1a 32 of a level string, hex: ties a saved attempt to that exact version.
// GD.comparePresses(routeTicks, runTicks, tol = 12) -- a run's presses against the route's: pairs within tol ticks
// (12 = 50 ms) -> { pairs: [{ route, run, dt (ticks, + = late) }], missing: [route ticks], extra: [run ticks] }
// GD.planEvents(data) -- a build stage's plan as input events [{tick, type}]: data.events (tools/compose.js: the
// plan driven through the sim) or else data.planned [{t, what: "jump" | "release" | ...}] (a jump not followed by a
// release is a tap: released a tick later). null when the stage has no plan.
(function (OUT) {
  "use strict";
  const GD = typeof module !== "undefined" && module.exports === OUT ? Object.assign({}, require("./physics.js")) : OUT;
  const clone = s => { const c = { ...s }; c.used = s.used.slice(); return c; };   // as physics.js clone() (a spread: tests/fast_states.js)

  function livePlay(w, opts = {}) {
    const cps = (opts.checkpoints || []).filter(x => x > 0).sort((a, b) => a - b);
    const lp = { path: [], held: [], state: null, cp: null, attempts: 0, events: [] };
    let held = false, pressNext = false, releaseAfter = false, saved = [];   // saved: [{tick, x, state, held}] checkpoints passed this attempt
    const max = Math.ceil((w.endX / (GD.SPEEDS[0].x * 60) + 5) * GD.PHYS.TPS);
    const begin = from => {
      lp.attempts++;
      if (from) {
        lp.path.length = from.tick + 1; lp.held.length = from.tick + 1;
        lp.events = lp.events.filter(e => e.tick < from.tick);
        if (from.held && !(lp.events.length && lp.events[lp.events.length - 1].type === "press")) lp.events.push({ tick: Math.max(0, from.tick - 1), type: "press" });
        lp.state = clone(from.state); held = from.held; lp.held[from.tick] = held ? 1 : 0;
        saved = saved.filter(c => c.tick <= from.tick);
      } else {
        lp.state = GD.startState(w); lp.path.length = 0; lp.held.length = 0;
        lp.path.push(clone(lp.state)); lp.held.push(0); held = false; saved = []; lp.events = [];
      }
      pressNext = false; releaseAfter = false;
    };
    lp.press = () => { if (!held) { held = true; pressNext = true; releaseAfter = false; } };
    // a tap pressed and let go within one frame still holds for its first tick (as run()'s press then release)
    lp.release = () => { if (pressNext) releaseAfter = true; else held = false; };
    lp.advanceTo = tick => {
      const s = lp.state;
      while (lp.path.length - 1 < tick && !s.dead && !s.done && s.tick < max) {
        const press = pressNext, tk = lp.path.length - 1, last = lp.events[lp.events.length - 1]; pressNext = false;
        if (press) lp.events.push({ tick: tk, type: "press" });
        else if (!held && last && last.type === "press") lp.events.push({ tick: tk, type: "release" });
        GD.step(w, s, { press, held });
        lp.path.push(clone(s)); lp.held.push(held ? 1 : 0);
        if (releaseAfter) { held = false; releaseAfter = false; }
        // a practice checkpoint: the first tick past its x, on the ground or flying steady (not mid-death)
        const next = cps.find(x => !saved.some(c => c.x === x) && s.x >= x);
        if (next !== undefined && !s.dead) saved.push({ x: next, tick: lp.path.length - 1, state: clone(s), held });
      }
      lp.cp = saved.length ? { tick: saved[saved.length - 1].tick, x: saved[saved.length - 1].x } : null;
      return s;
    };
    lp.restart = practice => begin(practice && saved.length ? saved[saved.length - 1] : null);
    begin(null); lp.attempts = 1;
    return lp;
  }

  function planEvents(data) {
    if (!data) return null;
    const TPS = GD.PHYS.TPS;
    if (Array.isArray(data.events) && data.events.length) return data.events.map(e => ({ tick: e.tick, type: e.type })).sort((a, b) => a.tick - b.tick);
    if (!Array.isArray(data.planned) || !data.planned.length) return null;
    const pl = data.planned.slice().sort((a, b) => a.t - b.t), out = [];
    pl.forEach((p, i) => {
      const tick = Math.max(0, Math.round(p.t * TPS));
      if (/release/.test(p.what || "")) { out.push({ tick, type: "release" }); return; }
      out.push({ tick, type: "press" });
      const nx = pl[i + 1];
      if (!(nx && /release/.test(nx.what || ""))) out.push({ tick: tick + 1, type: "release" });
    });
    // two inputs on one tick: the later one wins in run(); keep order, drop exact duplicates
    return out.filter((e, i) => !(out[i + 1] && out[i + 1].tick === e.tick && out[i + 1].type === e.type));
  }
  function levelHash(str) { let h = 0x811c9dc5; str = String(str); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, "0"); }
  function comparePresses(route, run, tol = 12) {
    const r = route.slice().sort((a, b) => a - b), u = run.slice().sort((a, b) => a - b), used = new Set(), pairs = [], missing = [];
    for (const t of r) {
      let best = -1; for (let j = 0; j < u.length; j++) { if (used.has(j)) continue; const d = Math.abs(u[j] - t); if (d <= tol && (best < 0 || d < Math.abs(u[best] - t))) best = j; }
      if (best < 0) missing.push(t); else { used.add(best); pairs.push({ route: t, run: u[best], dt: u[best] - t }); }
    }
    return { pairs, missing, extra: u.filter((x, j) => !used.has(j)) };
  }
  OUT.livePlay = livePlay; OUT.planEvents = planEvents; OUT.levelHash = levelHash; OUT.comparePresses = comparePresses;
})(typeof module !== "undefined" ? module.exports : (window.GD = window.GD || {}));
