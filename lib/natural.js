// A natural way to play a solved level, for the replay (and for judging the level by it).
// The solver finds the FEWEST presses, which looks wrong to a player (playtest, GDLM 44 v3):
// holds that make the cube re-jump on every landing ("empty clicks" with nothing to jump over),
// a ship flown with a few long holds and releases (it zigzags like a wave), jumps taken at the
// very last moment off every edge. naturalPlan rewrites the inputs, keeping only changes after
// which the run still finishes:
//   1. cube holds -> one tap per jump;
//   2. a tap whose jump is not needed is dropped (it was an "empty click");
//   3. each ship / wave / UFO / swing stretch is flown again by a controller that steers for the
//      middle of the free space ahead (the ship hovers with short taps, the wave follows its
//      corridor), stretch by stretch.
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
  const done = (w, ev) => { const p = GD.run(w, ev).path; return p[p.length - 1].done ? p : null; };
  const toEvents = held => { const out = []; let h = false; for (let t = 0; t < held.length; t++) if (held[t] !== h) { out.push({ tick: t, type: held[t] ? "press" : "release" }); h = held[t]; } return out; };
  const heldOf = (ev, n) => { const held = new Array(n).fill(false); let h = false, i = 0; const e = ev.slice().sort((a, b) => a.tick - b.tick); for (let t = 0; t < n; t++) { while (i < e.length && e[i].tick === t) { h = e[i].type === "press"; i++; } held[t] = h; } return held; };
  const FLY = { ship: 1, wave: 1, ufo: 1, swing: 1 };

  // 1. cube holds -> taps: the button goes down only on the tick a jump or an orb fires
  function taps(w, ev, path) {
    const held = heldOf(ev, path.length), want = held.slice();
    for (let t = 0; t + 1 < path.length; t++) {
      if (path[t].mode !== "cube") continue;
      const b = path[t + 1], g = path[t].grav || 1;
      want[t] = held[t] && ((b.act === "jump" && b.vy * g > 5 && path[t].vy * g <= 0.5) || (/orb|pad/.test(b.act || "") && b.act !== path[t].act));
    }
    const out = toEvents(want);
    return done(w, out) ? out : ev;
  }

  // 2. drop taps whose jump is not needed, last first
  function dropEmpty(w, ev, path) {
    let cur = ev.slice();
    for (let i = cur.length - 1; i >= 0; i--) {
      const e = cur[i];
      if (e.type !== "press") continue;
      const p = path[Math.min(e.tick, path.length - 1)];
      if (!p || p.mode !== "cube") continue;
      const rel = cur.findIndex((x, j) => j > i && x.type === "release");
      if (rel < 0 || cur[rel].tick - e.tick > 2) continue;          // only 1-2 tick taps
      const trial = cur.filter((x, j) => j !== i && j !== rel);
      if (done(w, trial)) cur = trial;
    }
    return cur;
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

  // 3. fly each flying stretch with a controller; keep it if the whole level still finishes,
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
      let best = null;
      for (const k of [10, 16, 6]) {
        const total = path.length + 600;
        const held = heldOf(cur, total), orig = held.slice();
        const s = clone(path[a]);
        let h = held[Math.max(0, a - 1)], t = a;
        for (; t < total && !s.dead && !s.done && (FLY[s.mode] || t < b); t++) {
          if (!FLY[s.mode] || (!GD.solveFrom && t >= b - 24)) { h = orig[t]; }   // the last 0.1 s: the solver's own button, to hand over cleanly
          else {
            const sp = GD.SPEEDS[s.sp] || GD.SPEEDS[1];
            const [lo, hi] = freeAt(boxes, s, s.x + sp.x * k);
            // steer for the middle of the room ahead; in the last 1/2 s before the stretch ends,
            // for the solver's own line, so the hand-over to the next part is where its plan expects
            // without solveFrom, the last 1/2 s steers for the solver's own line so its later inputs fit
            const late = !GD.solveFrom && t >= b - 120 && path[Math.min(path.length - 1, t + k)];
            const mid = late ? path[Math.min(path.length - 1, t + k)].y : (lo + hi) / 2, g = s.grav || 1, band = s.mode === "wave" ? 12 : 3; // wave: a wide dead band, no flicker at the turns
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
        if (GD.solveFrom) {
          try {
            const rest = GD.solveFrom(w, s, { held: h });
            if (rest && rest.ok) trial = toEvents(held.slice(0, t)).concat(
              (h ? [] : []), rest.events.filter(e => e.tick >= t));
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
      if (best) { cur = best.trial; path = best.p2; }
    }
    return cur;
  }

  function naturalPlan(w, sol, objects) {
    if (!sol || !sol.ok) return null;
    let ev = sol.events.slice();
    let path = done(w, ev);
    if (!path) return null;
    ev = taps(w, ev, path); path = done(w, ev);
    ev = dropEmpty(w, ev, path); path = done(w, ev);
    ev = fly(w, ev, objects || w.objects || []);
    path = done(w, ev);
    if (path) { ev = taps(w, ev, path); path = done(w, ev); ev = dropEmpty(w, ev, path); path = done(w, ev); }
    return path ? { events: ev, path } : { events: sol.events, path: GD.run(w, sol.events).path };
  }

  Object.assign(OUT, { naturalPlan });
})(typeof module !== "undefined" ? module.exports : (window.GD = window.GD || {}));
