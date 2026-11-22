// Cube physics and a solver that finds the clicks that beat a level.
//
// The numbers are GD's cube values as community reverse-engineering gives them, per "tick" of
// 1/54 s (60 fps x 0.9): x 5.77 units/tick at 1x speed, jump velocity 11.180032, gravity
// 0.958199. That gives 311.58 units/s, a jump 2.17 blocks high and 0.43 s long.
// THEY ARE NOT YET CHECKED AGAINST THE USER'S GAME: see CLAUDE.md "Calibration".
// Simulated at 240 steps/s (GD 2.2 runs its physics at 240 too).
(function (GD) {
  "use strict";
  const O = (typeof module !== "undefined" && typeof require !== "undefined") ? require("./objects.js") : GD;

  const TICK = 54;
  const C = {
    TPS: 240,
    SPEED: 5.77 * TICK,            // units/s at 1x
    GRAVITY: 0.958199 * TICK * TICK, // units/s^2
    JUMP_V: 11.180032 * TICK,      // units/s
    MAX_FALL: 15 * TICK,           // units/s
    SIZE: 30,                      // cube hitbox (outer): lands on things
    INNER: 9,                      // inner hitbox: touching a block with this kills
    START_X: 0,
  };
  C.DT = 1 / C.TPS;
  C.LAND_EPS = C.MAX_FALL * C.DT + 1; // how far below a block's top the feet may be and still land

  function makeWorld(objects) {
    const solids = [], hazards = [], others = [];
    let maxX = 0;
    for (const o of objects) {
      const d = O.objInfo(o.id);
      maxX = Math.max(maxX, o.x);
      const hb = O.hitbox(o);
      if (d.kind === "solid") solids.push(Object.assign({ o }, hb));
      else if (d.kind === "hazard") hazards.push(Object.assign({ o }, hb));
      else others.push(o);
    }
    // bucket by 30-unit column for quick lookup
    const cols = new Map();
    const add = (b, kind) => {
      for (let c = Math.floor(b.x0 / 30); c <= Math.floor(b.x1 / 30); c++) {
        if (!cols.has(c)) cols.set(c, []);
        cols.get(c).push({ b, kind });
      }
    };
    solids.forEach(b => add(b, "solid"));
    hazards.forEach(b => add(b, "hazard"));
    return { objects, solids, hazards, others, cols, endX: maxX + 90 };
  }

  function startState() {
    return { tick: 0, x: C.START_X, y: C.SIZE / 2, vy: 0, grounded: true, dead: false, done: false, air: 0, rot: 0, why: "" };
  }
  function clone(s) { return Object.assign({}, s); }

  function near(w, x) {
    const out = [], c0 = Math.floor((x - 20) / 30), c1 = Math.floor((x + 20) / 30), seen = new Set();
    for (let c = c0; c <= c1; c++) {
      const l = w.cols.get(c);
      if (l) for (const e of l) if (!seen.has(e.b)) { seen.add(e.b); out.push(e); }
    }
    return out;
  }
  function overlap(a0, a1, b0, b1, c0, c1, d0, d1) { return a0 < a1 && c0 < c1 && a0 < b1 - 1e-9 && b0 < a1 - 1e-9 && c0 < d1 - 1e-9 && d0 < c1 - 1e-9; }

  // One physics step. hold = the button is down this step.
  function step(w, s, hold) {
    if (s.dead || s.done) return s;
    const dt = C.DT, h = C.SIZE / 2;
    if (s.grounded && hold) { s.vy = C.JUMP_V; s.grounded = false; }
    s.vy = Math.max(s.vy - C.GRAVITY * dt, -C.MAX_FALL);
    const prevBottom = s.y - h;
    s.x += C.SPEED * dt;
    s.y += s.vy * dt;
    s.grounded = false;
    if (s.y - h <= 0) { s.y = h; s.vy = 0; s.grounded = true; }
    for (const e of near(w, s.x)) {
      const b = e.b;
      if (e.kind === "solid") {
        if (!overlap(s.x - h, s.x + h, b.x0, b.x1, s.y - h, s.y + h, b.y0, b.y1)) continue;
        if (s.vy <= 0 && prevBottom >= b.y1 - C.LAND_EPS) { s.y = b.y1 + h; s.vy = 0; s.grounded = true; continue; }
        const i = C.INNER / 2;
        if (overlap(s.x - i, s.x + i, b.x0, b.x1, s.y - i, s.y + i, b.y0, b.y1)) { s.dead = true; s.why = "block"; s.killer = b.o; }
      } else if (overlap(s.x - h, s.x + h, b.x0, b.x1, s.y - h, s.y + h, b.y0, b.y1)) {
        s.dead = true; s.why = "spike"; s.killer = b.o;
      }
    }
    // looks only: the cube turns half a circle over one full jump, and squares up on landing
    if (s.grounded) { s.air = 0; s.rot = Math.round(s.rot / 90) * 90; }
    else { s.air++; s.rot += 180 * dt / (2 * C.JUMP_V / C.GRAVITY); }
    if (s.x >= w.endX && !s.dead) s.done = true;
    s.tick++;
    return s;
  }

  // Replay a list of click ticks (each a tap: held for one step). Returns every step.
  function run(w, clicks) {
    const set = new Set(clicks.map(c => (typeof c === "number" ? c : c.tick)));
    const s = startState(), path = [clone(s)];
    const max = Math.ceil((w.endX / C.SPEED + 2) * C.TPS);
    while (!s.dead && !s.done && s.tick < max) { step(w, s, set.has(s.tick)); path.push(clone(s)); }
    return { path, dead: s.dead, done: s.done, why: s.why, killer: s.killer, end: clone(s) };
  }

  // ---- solver ----
  // Fewest clicks; each click placed in the middle of its timing window (the run of ticks
  // where clicking still beats the level with the same number of clicks).
  function solve(w) {
    const memo = new Map();
    let far = null; // the furthest any explored run got before dying
    const key = s => s.tick + ":" + Math.round(s.y * 4);

    // min clicks needed from state s (Infinity = impossible), not pressing at s unless asked
    function cost(s0) {
      const s = clone(s0), chain = [];
      let tail = Infinity;
      for (;;) {
        if (s.done) { tail = 0; break; }
        if (s.dead) { tail = Infinity; if (!far || s.x > far.x) far = clone(s); break; }
        if (s.grounded) {
          const k = key(s);
          if (memo.has(k)) { tail = memo.get(k); break; }
          chain.push(clone(s));
        }
        step(w, s, false);
      }
      for (let i = chain.length - 1; i >= 0; i--) {
        const j = clone(chain[i]); step(w, j, true);
        const cj = 1 + cost(j);
        tail = Math.min(tail, cj);
        memo.set(key(chain[i]), tail);
      }
      return tail;
    }
    function jumpCost(g) { const j = clone(g); step(w, j, true); return 1 + cost(j); }

    let s = startState();
    const total = cost(s);
    if (total === Infinity) return { ok: false, clicks: [], dieAt: far, why: far.why, killer: far.killer };
    const clicks = [];
    let need = total;
    while (need > 0) {
      // walk without clicking; note every grounded tick where clicking keeps "need" clicks
      const t = clone(s), good = [];
      for (;;) {
        if (t.dead || t.done) break;
        if (t.grounded && jumpCost(t) === need) good.push(clone(t));
        step(w, t, false);
      }
      // the last contiguous run of good ticks is the jump over the obstacle that kills us
      let hi = good.length - 1, lo = hi;
      while (lo > 0 && good[lo - 1].tick === good[lo].tick - 1) lo--;
      const pick = good[Math.floor((lo + hi) / 2)];
      clicks.push({ tick: pick.tick, lo: good[lo].tick, hi: good[hi].tick, x: pick.x,
                    ms: Math.round((good[hi].tick - good[lo].tick + 1) / C.TPS * 1000) });
      s = clone(pick); step(w, s, true);
      need--;
    }
    return { ok: true, clicks };
  }

  Object.assign(GD, { PHYS: C, makeWorld, startState, step, run, solve });
})(typeof module !== "undefined" ? module.exports : (window.GD = window.GD || {}));
