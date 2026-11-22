// Cube physics and a solver that finds the clicks that beat a level.
//
// Numbers and rules come from decompilations of GD 2.2's own physics (sources in CLAUDE.md),
// checked against the user's recordings where noted there. GD runs 240 physics steps a second;
// velocities are in units per 1/60 s "frame". Per step: x moves dt = 0.25 frames, y moves
// dts = 0.225 frames (GD's 0.9 slow factor on vertical motion).
(function (GD) {
  "use strict";
  const O = (typeof module !== "undefined" && typeof require !== "undefined") ? require("./objects.js") : GD;

  // index: 0 = 0.5x, 1 = 1x, 2 = 2x, 3 = 3x, 4 = 4x. x = units per frame.
  const SPEEDS = [
    { name: "0.5x", x: 0.7 * 5.980002, yStart: 10.620032, g: 0.940199 },
    { name: "1x", x: 0.9 * 5.77000189, yStart: 11.1800318, g: 0.958199024 },
    { name: "2x", x: 1.1 * 5.870002, yStart: 11.420032, g: 0.957199 },
    { name: "3x", x: 1.3 * 6.000002, yStart: 11.230032, g: 0.961199 },
    { name: "4x", x: 1.6 * 6.000002, yStart: 11.230032, g: 0.961199 },
  ];
  const KA4 = { 0: 1, 1: 0, 2: 2, 3: 3, 4: 4 }; // level header start speed -> SPEEDS index

  const C = {
    TPS: 240, DT: 0.25, DTS: 0.225, MAX_FALL: 15, PAD: 16,
    SIZE: 30, INNER: 9, SNAP: 15, START_X: 0, SPEEDS,
  };
  C.SPEED = SPEEDS[1].x * 60; // units/s at 1x (311.58), for display

  function makeWorld(objects, header) {
    const items = [];
    let maxX = 0, maxY = 0;
    objects.forEach((o, i) => {
      const d = O.objInfo(o.id);
      maxX = Math.max(maxX, o.x); maxY = Math.max(maxY, o.y);
      const hb = O.hitbox(o);
      if (!hb || d.kind === "unknown") return;
      const it = Object.assign({ i, o, d, kind: d.kind, q: O.quarter(o) }, hb);
      if (d.kind === "slope") {
        if (it.q !== 0 || o.flipY) { it.kind = "solid"; } // only floor slopes are modelled; others act as blocks
        else { it.up = o.flipX ? -1 : 1; it.rise = (hb.y1 - hb.y0) / (hb.x1 - hb.x0); }
      }
      items.push(it);
    });
    const cols = new Map();
    for (const b of items) {
      for (let c = Math.floor(b.x0 / 30); c <= Math.floor(b.x1 / 30); c++) {
        if (!cols.has(c)) cols.set(c, []);
        cols.get(c).push(b);
      }
    }
    const m = /(?:^|,)kA4,(\d+)/.exec(header || "");
    const startSpeed = m ? (KA4[m[1]] !== undefined ? KA4[m[1]] : 1) : 1;
    // ASSUMED, not confirmed: going far above everything in the level counts as a death
    return { objects, items, cols, endX: maxX + 90, skyY: maxY + 300, startSpeed,
             solids: items.filter(b => b.kind === "solid"), hazards: items.filter(b => b.kind === "hazard") };
  }

  function startState(w) {
    return { tick: 0, x: C.START_X, y: C.SIZE / 2, vy: 0, grav: 1, sp: w ? w.startSpeed : 1,
             grounded: true, onSlope: false, dashing: false, used: [], buffered: false, ring: false,
             dead: false, done: false, why: "", killer: null, act: "", rot: 0 };
  }
  function clone(s) { const c = Object.assign({}, s); c.used = s.used.slice(); return c; }

  function near(w, x) {
    const out = [], seen = new Set();
    for (let c = Math.floor((x - 40) / 30); c <= Math.floor((x + 40) / 30); c++) {
      const l = w.cols.get(c);
      if (l) for (const b of l) if (!seen.has(b)) { seen.add(b); out.push(b); }
    }
    return out;
  }
  const ov = (ax0, ax1, ay0, ay1, b) => ax0 < b.x1 && b.x0 < ax1 && ay0 < b.y1 && b.y0 < ay1;
  const touching = (s, b) => ov(s.x - 15, s.x + 15, s.y - 15, s.y + 15, b);

  // slope surface height under the player (floor slopes only)
  function slopeTop(b, xc) {
    if (b.up > 0) { const px = Math.min(xc + 15, b.x1); return px < b.x0 ? null : b.y0 + (px - b.x0) * b.rise; }
    const px = Math.max(xc - 15, b.x0); return px > b.x1 ? null : b.y0 + (b.x1 - px) * b.rise;
  }

  function flip(s) { s.grav = -s.grav; s.vy *= 0.5; s.grounded = false; s.onSlope = false; }

  // spider: jump to the nearest surface on the other side, then gravity points at it
  function teleport(w, s) {
    const dir = s.grav; // towards the current "up" (+1 = world up when gravity is normal)
    let best = null;
    for (const b of w.solids) {
      if (!(s.x - 4.5 < b.x1 && b.x0 < s.x + 4.5)) continue; // ASSUMED: the inner-box strip above/below
      if (dir > 0 && b.y0 >= s.y && (best === null || b.y0 < best)) best = b.y0;
      if (dir < 0 && b.y1 <= s.y && (best === null || b.y1 > best)) best = b.y1;
    }
    if (dir < 0) best = Math.max(best === null ? 0 : best, 0);
    if (best !== null) s.y = dir > 0 ? best - 15 : best + 15;
    s.grav = -s.grav; s.vy = 0; s.grounded = true; s.onSlope = false;
  }

  function useOrb(w, s, b) {
    const d = b.d, sp = SPEEDS[s.sp];
    s.used.push(b.i); s.buffered = false; s.ring = false; s.grounded = false; s.onSlope = false;
    s.act = d.name;
    if (d.act === "jump") s.vy = s.grav * sp.yStart * d.mul;
    else if (d.act === "blue") { s.vy = s.grav * sp.yStart * d.mul; flip(s); }
    else if (d.act === "green") { flip(s); s.vy = s.grav * sp.yStart; }
    else if (d.act === "black") s.vy = -C.MAX_FALL * s.grav;
    else if (d.act === "dash") { if (d.flip) flip(s); s.dashing = true; s.dashAngle = (b.o.rot || 0) * Math.PI / 180; s.vy = 0; }
    else if (d.act === "spider") teleport(w, s);
  }
  function usePad(w, s, b) {
    const d = b.d;
    if (d.act === "blue") {
      const facingUp = b.q === 0, facingDown = b.q === 2;
      if (!((facingUp && s.grav === 1) || (facingDown && s.grav === -1))) return;
      s.used.push(b.i); s.act = d.name; s.vy = s.grav * C.PAD * d.bump; flip(s); return;
    }
    s.used.push(b.i); s.act = d.name; s.grounded = false; s.onSlope = false;
    if (d.act === "jump") s.vy = s.grav * C.PAD * d.bump;
    else if (d.act === "spider") teleport(w, s);
  }

  // One physics step. inp = {press, held}: press = the button went down this step.
  function step(w, s, inp) {
    if (s.dead || s.done) return s;
    const sp = SPEEDS[s.sp], h = 15;
    s.act = "";
    if (inp.press) { s.buffered = true; s.ring = true; }
    if (!inp.held) { s.buffered = false; s.ring = false; if (s.dashing) { s.dashing = false; s.vy = 0; } }
    const objs = near(w, s.x);
    // a press activates an orb already being touched; orbs beat a ground jump
    if (s.ring) for (const b of objs) if (b.kind === "orb" && !s.used.includes(b.i) && touching(s, b)) { useOrb(w, s, b); break; }
    if (s.grounded && s.buffered) { s.vy = s.grav * sp.yStart; s.grounded = false; s.onSlope = false; s.buffered = false; s.act = "jump"; }

    const wasSlope = s.onSlope;
    if (s.dashing) {
      s.vy = Math.sin(-s.dashAngle) * sp.x / 0.9 * s.grav; // GD rotation is clockwise; 0 = straight ahead
    } else {
      s.vy -= sp.g * C.DTS * s.grav;
      if (s.vy * s.grav < -C.MAX_FALL) s.vy = -C.MAX_FALL * s.grav;
    }
    s.x += sp.x * C.DT;
    s.y += s.vy * C.DTS;
    s.grounded = false; s.onSlope = false;

    // the ground
    if (s.y - h <= 0) { s.y = h; if (s.grav === 1) { s.vy = Math.max(s.vy, 0); s.grounded = s.vy === 0; } else s.vy = Math.max(s.vy, 0); }

    const feet = () => (s.grav === 1 ? s.y - h : s.y + h);
    for (const b of objs) {
      if (b.kind === "solid") {
        if (!touching(s, b)) continue;
        const toward = s.vy * s.grav <= 0;
        if (s.grav === 1 && toward && feet() >= b.y1 - C.SNAP) { s.y = b.y1 + h; s.vy = 0; s.grounded = true; continue; }
        if (s.grav === -1 && toward && feet() <= b.y0 + C.SNAP) { s.y = b.y0 - h; s.vy = 0; s.grounded = true; continue; }
        const i = C.INNER / 2;
        if (ov(s.x - i, s.x + i, s.y - i, s.y + i, b)) { s.dead = true; s.why = "block"; s.killer = b.o; continue; }
        // head bump: pushed back out, not killed
        if (s.grav === 1 && s.vy > 0 && s.y + h <= b.y0 + C.SNAP) { s.y = b.y0 - h; s.vy = 0; }
        else if (s.grav === -1 && s.vy < 0 && s.y - h >= b.y1 - C.SNAP) { s.y = b.y1 + h; s.vy = 0; }
      } else if (b.kind === "slope") {
        if (s.grav !== 1 || !touching(s, b)) continue;
        const top = slopeTop(b, s.x);
        if (top === null) continue;
        const slopeV = sp.x * b.rise * b.up / 0.9;
        if (s.y - h < top && s.y - h >= top - C.SNAP - 2 && s.vy <= Math.max(slopeV, 0) + 1e-6) {
          s.y = top + h; s.grounded = true;
          if (top < b.y1 - 1e-6 || b.up < 0) { s.onSlope = true; s.vy = slopeV; } else s.vy = 0;
        } else if (s.y - h < top - C.SNAP - 2) {
          const i = C.INNER / 2;
          if (ov(s.x - i, s.x + i, s.y - i, s.y + i, b)) { s.dead = true; s.why = "slope"; s.killer = b.o; }
        }
      }
    }
    if (!s.dead) for (const b of objs) {
      if (s.used.includes(b.i)) continue;
      if (b.kind === "hazard") { if (touching(s, b)) { s.dead = true; s.why = "spike"; s.killer = b.o; break; } }
      else if (b.kind === "orb") { if (s.ring && touching(s, b)) useOrb(w, s, b); }
      else if (b.kind === "pad") { if (touching(s, b)) usePad(w, s, b); }
      else if (b.kind === "speed") { if (touching(s, b)) { s.sp = b.d.speed; s.used.push(b.i); } }
    }
    if (wasSlope && !s.onSlope && !s.grounded) { /* left a slope: keeps its upward speed (a small launch) */ }
    // looks only: half a turn per jump, square on landing
    if (s.grounded || s.dashing) s.rot = Math.round(s.rot / 90) * 90;
    else s.rot += s.grav * 180 * C.DTS / (2 * sp.yStart / sp.g);
    if (s.used.length > 8) s.used = s.used.filter(i => w.objects[i].x > s.x - 80);
    if (s.y > w.skyY || s.y < -300) { s.dead = true; s.why = "sky"; }
    if (s.x >= w.endX && !s.dead) s.done = true;
    s.tick++;
    return s;
  }

  const NONE = { press: false, held: false };
  function idle(s) { return s.dashing ? { press: false, held: true } : NONE; }
  const PRESS = { press: true, held: true };
  const RELEASE = { press: false, held: false };

  // Replay input events: [{tick, type: "press"|"release"}]; a plain number = a tap at that tick.
  function run(w, events) {
    const ev = new Map();
    for (const e of events || []) {
      if (typeof e === "number") { ev.set(e, "press"); if (!ev.has(e + 1)) ev.set(e + 1, "release"); }
      else ev.set(e.tick, e.type);
    }
    const s = startState(w), path = [clone(s)];
    let held = false;
    const max = Math.ceil((w.endX / (SPEEDS[0].x * 60) + 5) * C.TPS);
    while (!s.dead && !s.done && s.tick < max) {
      const e = ev.get(s.tick);
      let press = false;
      if (e === "press") { press = true; held = true; }
      if (e === "release") held = false;
      step(w, s, { press, held });
      path.push(clone(s));
    }
    return { path, dead: s.dead, done: s.done, why: s.why, killer: s.killer, end: clone(s) };
  }

  // ---- solver ----
  // Fewest presses. Each action is placed in the middle of its window: the run of steps
  // where doing it still beats the level with the same number of presses.
  function solve(w, opts) {
    const limit = (opts && opts.maxStates) || 3000000;
    const memo = new Map();
    let far = null, states = 0;
    const key = s => [s.tick, Math.round(s.y * 2), Math.round(s.vy * 4), s.grav, s.sp, s.dashing ? 1 : 0,
                      s.grounded ? 1 : 0, s.used.filter(i => w.objects[i].x > s.x - 40).join(".")].join(":");
    const canPress = (s) => {
      if (s.grounded) return true;
      for (const b of near(w, s.x)) if (b.kind === "orb" && !s.used.includes(b.i) && touching(s, b)) return true;
      return false;
    };

    const trail = [];
    function cost(s0) {
      const s = clone(s0), chain = [];
      let tail = Infinity;
      for (;;) {
        if (++states > limit) throw new Error("solver gave up: too many states");
        if (s.done) { tail = 0; break; }
        if (s.dead) { if (!far || s.x > far.x) { far = clone(s); far.trail = trail.slice(); } break; }
        const p = canPress(s), r = s.dashing;
        if (p || r) {
          const k = key(s);
          if (memo.has(k)) { tail = memo.get(k); break; }
          chain.push({ s: clone(s), k, p, r });
        }
        step(w, s, idle(s));
      }
      for (let i = chain.length - 1; i >= 0; i--) {
        const c = chain[i];
        if (c.p) { const j = clone(c.s); step(w, j, PRESS); trail.push({ tick: c.s.tick, type: "press" }); tail = Math.min(tail, 1 + cost(j)); trail.pop(); }
        if (c.r) { const j = clone(c.s); step(w, j, RELEASE); trail.push({ tick: c.s.tick, type: "release" }); tail = Math.min(tail, cost(j)); trail.pop(); }
        memo.set(c.k, tail);
      }
      return tail;
    }

    let s = startState(w);
    const total = cost(s);
    if (total === Infinity) return { ok: false, clicks: [], trail: far && far.trail, dieAt: far, why: far && far.why, killer: far && far.killer, states };
    const clicks = [];
    let need = total, guard = 0;
    while (guard++ < 500) {
      const t = clone(s), good = [];
      let finished = false;
      for (;;) {
        if (t.done) { finished = true; break; }
        if (t.dead) break;
        if (canPress(t)) { const j = clone(t); step(w, j, PRESS); if (1 + cost(j) === need) good.push({ kind: "press", s: clone(t), after: j }); }
        if (t.dashing) { const j = clone(t); step(w, j, RELEASE); if (cost(j) === need) good.push({ kind: "release", s: clone(t), after: j }); }
        step(w, t, idle(t));
      }
      if (need === 0 && finished && !good.some(g => g.kind === "release")) break;
      if (need === 0 && finished) break;
      if (!good.length) break;
      let hi = good.length - 1, lo = hi;
      while (lo > 0 && good[lo - 1].kind === good[hi].kind && good[lo - 1].s.tick === good[lo].s.tick - 1) lo--;
      const pick = good[Math.floor((lo + hi) / 2)];
      clicks.push({ type: pick.kind, tick: pick.s.tick, lo: good[lo].s.tick, hi: good[hi].s.tick, x: pick.s.x,
                    act: pick.kind === "press" ? pick.after.act : "release",
                    ms: Math.round((good[hi].s.tick - good[lo].s.tick + 1) / C.TPS * 1000) });
      if (pick.kind === "press" && !pick.after.dashing) clicks.push({ type: "release", tick: pick.s.tick + 1, auto: true });
      s = pick.after;
      if (pick.kind === "press") need--;
    }
    const events = clicks.map(c => ({ tick: c.tick, type: c.type }));
    return { ok: true, clicks: clicks.filter(c => !c.auto), events, states };
  }

  Object.assign(GD, { PHYS: C, SPEEDS, makeWorld, startState, step, run, solve });
})(typeof module !== "undefined" ? module.exports : (window.GD = window.GD || {}));
