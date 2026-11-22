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
    // ship (gdp updateJump / gdsolver ship_params): fixed gravity, hold/release factors, limits
    SHIP_G: 0.958199, SHIP_UP: 8, SHIP_DOWN: -6.4, FLY_SNAP: 6, CORRIDOR: 300,
    SIMULATED_MODES: ["cube", "ship"],
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
             mode: "cube", floorY: 0, ceilY: Infinity,
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
    const d = b.d, sp = SPEEDS[s.sp], ship = s.mode === "ship";
    const mul = ship && d.shipMul !== undefined ? d.shipMul : d.mul;
    s.used.push(b.i); s.ring = false; s.grounded = false; s.onSlope = false; s.boost = true;
    s.act = d.name;
    if (d.act === "jump") s.vy = s.grav * sp.yStart * mul;
    else if (d.act === "blue") { s.vy = s.grav * sp.yStart * mul; flip(s); }
    else if (d.act === "green") { flip(s); s.vy = s.grav * sp.yStart * (ship ? mul : 1); }
    else if (d.act === "black") s.vy = -(ship ? 14 : C.MAX_FALL) * s.grav;
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
    s.used.push(b.i); s.act = d.name; s.grounded = false; s.onSlope = false; s.ring = false; s.boost = true;
    const bump = s.mode === "ship" && d.shipBump !== undefined ? d.shipBump : d.bump;
    if (d.act === "jump") s.vy = s.grav * C.PAD * bump;
    else if (d.act === "spider") teleport(w, s);
  }

  // mode portal: entering or leaving a flying mode halves vertical speed; flying modes get a
  // 300-unit corridor snapped to the 30 grid around the portal (floor at least the ground)
  function enterMode(s, b) {
    const to = b.d.mode;
    if (to === s.mode) return;
    if (C.SIMULATED_MODES.indexOf(to) < 0) { s.dead = true; s.why = to + " mode is not simulated yet"; s.killer = b.o; return; }
    const wasFly = s.mode === "ship", fly = to === "ship";
    if (wasFly !== fly) s.vy *= 0.5;
    s.mode = to; s.grounded = false; s.onSlope = false; s.act = b.d.name;
    if (fly) { s.floorY = Math.max(0, Math.floor((b.o.y - C.CORRIDOR / 2) / 30) * 30); s.ceilY = s.floorY + C.CORRIDOR; }
    else { s.floorY = 0; s.ceilY = Infinity; }
  }
  function gravityPortal(s, b) {
    const to = b.d.grav === 0 ? -s.grav : b.d.grav;
    if (to !== s.grav) { flip(s); s.act = b.d.name; }
  }

  // One physics step. inp = {press, held}: press = the button went down this step.
  function step(w, s, inp) {
    if (s.dead || s.done) return s;
    const sp = SPEEDS[s.sp], h = 15;
    s.act = "";
    // GD: a press arms both the jump buffer and the orb flag. The buffer stays armed while held
    // (a held cube jumps again on every landing); the orb flag is used up by an orb, pad or jump.
    if (inp.press) s.ring = true;
    s.buffered = !!inp.held;
    if (!inp.held) { s.ring = false; if (s.dashing) { s.dashing = false; s.vy = 0; } }
    const objs = near(w, s.x);
    // a press activates an orb already being touched; orbs beat a ground jump
    if (s.ring) for (const b of objs) if (b.kind === "orb" && !s.used.includes(b.i) && touching(s, b)) { useOrb(w, s, b); break; }
    if (s.mode === "cube" && s.grounded && s.buffered) { s.vy = s.grav * sp.yStart; s.grounded = false; s.onSlope = false; s.ring = false; s.act = "jump"; }

    const wasSlope = s.onSlope;
    if (s.mode === "ship" && !s.dashing) {
      // gdp updateJump: vy += -a * g * dts * flip * b. "Falling" uses the speed's own gravity.
      const falling = s.vy * s.grav < 2 * sp.g;
      const a = inp.held ? -1 : (falling ? 0.8 : 1.2), bb = inp.held ? (falling ? 0.5 : 0.4) : 0.4;
      s.vy += -a * C.SHIP_G * C.DTS * s.grav * bb;
      const up = s.vy * s.grav;
      if (s.boost && up <= C.SHIP_UP) s.boost = false;
      if (!s.boost) { if (up > C.SHIP_UP) s.vy = C.SHIP_UP * s.grav; if (up < C.SHIP_DOWN) s.vy = C.SHIP_DOWN * s.grav; }
    } else if (s.dashing) {
      s.vy = Math.sin(-s.dashAngle) * sp.x / 0.9 * s.grav; // GD rotation is clockwise; 0 = straight ahead
    } else {
      s.vy -= sp.g * C.DTS * s.grav;
      if (s.vy * s.grav < -C.MAX_FALL) s.vy = -C.MAX_FALL * s.grav;
    }
    s.x += sp.x * C.DT;
    s.y += s.vy * C.DTS;
    s.grounded = false; s.onSlope = false;

    if (s.mode === "ship") {
      // the corridor's floor and roof are safe to slide on
      if (s.y - h <= s.floorY) { s.y = s.floorY + h; if (s.vy < 0) s.vy = 0; s.grounded = s.grav === 1; }
      if (s.y + h >= s.ceilY) { s.y = s.ceilY - h; if (s.vy > 0) s.vy = 0; s.grounded = s.grav === -1; }
    }
    // the ground
    else if (s.y - h <= 0) { s.y = h; if (s.grav === 1) { s.vy = Math.max(s.vy, 0); s.grounded = s.vy === 0; } else s.vy = Math.max(s.vy, 0); }

    const feet = () => (s.grav === 1 ? s.y - h : s.y + h);
    for (const b of objs) {
      if (b.kind === "solid" && s.mode === "ship") {
        if (!touching(s, b)) continue;
        if (s.vy <= 0 && s.y - h >= b.y1 - C.FLY_SNAP) { s.y = b.y1 + h; s.vy = 0; s.grounded = s.grav === 1; continue; }
        if (s.vy >= 0 && s.y + h <= b.y0 + C.FLY_SNAP) { s.y = b.y0 - h; s.vy = 0; s.grounded = s.grav === -1; continue; }
        const i = C.INNER / 2;
        if (ov(s.x - i, s.x + i, s.y - i, s.y + i, b)) { s.dead = true; s.why = "block"; s.killer = b.o; }
      } else if (b.kind === "solid") {
        if (!touching(s, b)) continue;
        const toward = s.vy * s.grav <= 0;
        if (s.grav === 1 && toward && feet() >= b.y1 - C.SNAP) { s.y = b.y1 + h; s.vy = 0; s.grounded = true; continue; }
        if (s.grav === -1 && toward && feet() <= b.y0 + C.SNAP) { s.y = b.y0 - h; s.vy = 0; s.grounded = true; continue; }
        const i = C.INNER / 2;
        if (ov(s.x - i, s.x + i, s.y - i, s.y + i, b)) { s.dead = true; s.why = "block"; s.killer = b.o; continue; }
        // outer box overlapping a block's head side does nothing for the cube (no head bump):
        // the user's red-orb dive grazes a ledge corner and carries on (recording, 109.8 s)
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
      else if (b.kind === "mode") { if (touching(s, b)) { s.used.push(b.i); enterMode(s, b); if (s.dead) break; } }
      else if (b.kind === "gravity") { if (touching(s, b)) { s.used.push(b.i); gravityPortal(s, b); } }
    }
    if (wasSlope && !s.onSlope && !s.grounded) { /* left a slope: keeps its upward speed (a small launch) */ }
    // looks only: half a turn per jump, square on landing
    if (s.mode === "ship") s.rot = -Math.atan2(s.vy * C.DTS, sp.x * C.DT) * 180 / Math.PI;
    else if (s.grounded || s.dashing) s.rot = Math.round(s.rot / 90) * 90;
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

  // ---- sweep solver ----
  // Goes forward one step at a time keeping every distinct state (merged into small buckets of
  // height and speed), trying hold and release at each frame boundary (every 4 steps = 60 fps;
  // the user has "Click Between Steps" off). Works for every mode, uses no recursion, and its
  // answer is an exact replay (merging only drops near-duplicates). Fewest presses wins.
  function solveSweep(w, opts) {
    opts = opts || {};
    const K = opts.every || 4, CAP = opts.cap || 6000;
    const maxTicks = Math.ceil((w.endX / (SPEEDS[0].x * 60) + 5) * C.TPS);
    const fkey = (s, held) => [Math.round(s.y), Math.round(s.vy * 2), s.grav, s.mode, s.sp, s.dashing ? 1 : 0,
      s.grounded ? 1 : 0, held ? 1 : 0, s.ring ? 1 : 0, s.used.filter(i => w.objects[i].x > s.x - 40).join(".")].join(":");
    let front = [{ s: startState(w), cost: 0, held: false, parent: null }];
    let far = null, won = null, peak = 0;
    for (let t = 0; t < maxTicks && front.length && !won; t++) {
      const next = new Map();
      for (const n of front) {
        const choices = t % K === 0 ? [false, true] : [n.held];
        for (const held of choices) {
          const press = held && !n.held;
          const st = clone(n.s);
          step(w, st, { press, held });
          if (st.dead) { if (!far || st.x > far.s.x) far = { s: st, parent: n, held }; continue; }
          const node = { s: st, cost: n.cost + (press ? 1 : 0), held, parent: n };
          if (st.done) { if (!won || node.cost < won.cost) won = node; continue; }
          const k = fkey(st, held), old = next.get(k);
          if (!old || node.cost < old.cost) next.set(k, node);
        }
      }
      front = [...next.values()];
      if (front.length > CAP) { front.sort((a, b) => a.cost - b.cost); front.length = CAP; }
      peak = Math.max(peak, front.length);
    }
    const eventsOf = (node, lastHeld) => {
      const helds = [];
      for (let n = node; n.parent; n = n.parent) helds.push(n.held);
      helds.reverse();
      const ev = []; let prev = false;
      helds.forEach((h, t) => { if (h && !prev) ev.push({ tick: t, type: "press" }); if (!h && prev) ev.push({ tick: t, type: "release" }); prev = h; });
      return ev;
    };
    if (!won) {
      const tr = far ? eventsOf({ s: far.s, held: far.held, parent: far.parent }) : [];
      return { ok: false, clicks: [], trail: tr, dieAt: far && far.s, why: far && far.s.why, killer: far && far.s.killer, peak, sweep: true };
    }
    const events = eventsOf(won);
    // label each press with what it did, from a replay
    const path = run(w, events).path;
    const clicks = events.map(e => ({ type: e.type, tick: e.tick, lo: e.tick, hi: e.tick, ms: 0, x: path[e.tick].x,
      act: e.type === "press" ? (path[Math.min(e.tick + 1, path.length - 1)].act || "hold") : "release" }));
    return { ok: true, clicks, events, peak, sweep: true };
  }

  // Cube-only levels use the exact solver (it also gives timing windows); anything else, or a
  // level too big for it, uses the sweep.
  function solveAny(w, opts) {
    const modes = w.items.some(b => b.kind === "mode" && b.d.mode !== "cube");
    if (!modes) {
      try { const r = solve(w, Object.assign({ maxStates: 3000000 }, opts)); if (r.ok) return r; } catch (e) { /* too big: sweep */ }
    }
    return solveSweep(w, opts);
  }

  Object.assign(GD, { PHYS: C, SPEEDS, makeWorld, startState, step, run, solve, solveSweep, solveAny });
})(typeof module !== "undefined" ? module.exports : (window.GD = window.GD || {}));
