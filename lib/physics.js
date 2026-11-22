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
    SIMULATED_MODES: ["cube", "ship", "ball", "ufo", "wave", "robot", "spider", "swing"],
    // the other modes, from gdsolver's measured model (MIT): UFO flap speed, robot hover ticks,
    // wave contact box / kill box / band clamp, spider box
    UFO_FLAP: 7, ROBOT_HOVER: 67, WAVE_HALF: 5, WAVE_KILL: 1.5, WAVE_CLAMP: 10, SPIDER_HALF: 13.5,
  };
  C.SPEED = SPEEDS[1].x * 60; // units/s at 1x (311.58), for display

  function makeWorld(objects, header) {
    const items = [];
    let maxX = 0, maxY = 0;
    objects.forEach((o, i) => {
      const d = O.objInfo(o.id);
      maxX = Math.max(maxX, o.x); maxY = Math.max(maxY, o.y);
      const hb = O.hitbox(o);
      if (!hb || d.kind === "unknown" || d.kind === "decoration" || d.kind === "trigger") return;
      // per-object editor flags: 121 "No Touch" (no collision at all), 134 "Passable" (a solid
      // you go through). ASSUMED key numbers, from memory of the format.
      const pr = o.props || {};
      if (pr["121"] === "1" || (pr["134"] === "1" && d.kind === "solid")) return;
      // a saw's reach is its radius x max(scaleX, scaleY) (GJBaseGameLayer::playerCircleCollision, via gdsolver)
      const it = Object.assign({ i, o, d, kind: d.kind, q: O.quarter(o), r: (d.r || 0) * Math.max(...O.scaleOf(o)), oneway: !!d.oneway }, hb);
      if (d.kind === "slope") {
        // half a turn is the same as flipping both ways; quarter turns (walls) act as blocks
        const fx = it.q === 2 ? !o.flipX : !!o.flipX, fy = it.q === 2 ? !o.flipY : !!o.flipY;
        if (it.q === 1 || it.q === 3) it.kind = "solid";
        else {
          it.rise = (hb.y1 - hb.y0) / (hb.x1 - hb.x0);
          if (fy) { it.ceil = true; it.down = fx ? -1 : 1; } // a ceiling slope: its underside goes down to the right (down 1) or up
          else it.up = fx ? -1 : 1;
        }
      }
      it.groups = groupsOf(o);
      items.push(it);
    });
    const trig = readTriggers(objects);
    // objects a move or toggle reaches are tested where they are at the time (dynamic), not from the
    // static columns
    const moved = new Map();  // group -> how far a move can take it in x
    for (const t of trig.list) if (t.kind === "move" || t.kind === "toggle" || t.kind === "rotate") {
      const m = moved.get(t.group) || { dx: 0, rot: [] };
      if (t.kind === "move") m.dx += Math.abs(t.dx) * 1.5; // easing can overshoot
      if (t.kind === "rotate") m.rot.push(t);
      moved.set(t.group, m);
    }
    // where each group's objects are (any object, decoration and triggers too: a rotate's centre
    // is often an invisible one)
    const byGroup = new Map();
    for (const o of objects) for (const g of groupsOf(o)) { if (!byGroup.has(g)) byGroup.set(g, o); }
    for (const t of trig.list) if (t.kind === "rotate" && t.center && byGroup.has(t.center)) {
      const c = byGroup.get(t.center); t.cx = c.x; t.cy = c.y; t.cgroups = groupsOf(c);
    }
    let moveReach = 0;
    for (const m of moved.values()) moveReach = Math.max(moveReach, m.dx);
    const dyn = [];
    for (const b of items) {
      const gs = b.groups.filter(g => moved.has(g));
      if (!gs.length) continue;
      b.dyn = true; let rx = 0;
      for (const g of gs) {
        rx += moved.get(g).dx;
        // turning about a centre: anywhere on that circle (plus the centre's own moves)
        for (const t of moved.get(g).rot) if (t.cx !== undefined) rx += Math.hypot(b.o.x - t.cx, b.o.y - t.cy) + moveReach;
      }
      b.reach = [b.x0 - rx, b.x1 + rx];
      b.rots = trig.list.filter(t => t.kind === "rotate" && b.groups.includes(t.group));
      if (!b.rots.length) b.rots = null;
      dyn.push(b);
    }
    // every object (decoration too) a trigger moves, turns or toggles, for drawing (posedObjects)
    const posed = [];
    objects.forEach((o, i) => {
      const gs = groupsOf(o);
      if (!gs.some(g => moved.has(g))) return;
      const rots = trig.list.filter(t => t.kind === "rotate" && gs.includes(t.group));
      posed.push({ i, o, groups: gs, rots: rots.length ? rots : null });
    });
    const cols = new Map();
    for (const b of items) {
      if (b.dyn) continue;
      for (let c = Math.floor(b.x0 / 30); c <= Math.floor(b.x1 / 30); c++) {
        if (!cols.has(c)) cols.set(c, []);
        cols.get(c).push(b);
      }
    }
    const m = /(?:^|,)kA4,(\d+)/.exec(header || "");
    const startSpeed = m ? (KA4[m[1]] !== undefined ? KA4[m[1]] : 1) : 1;
    // ASSUMED, not confirmed: going far above everything in the level counts as a death
    return { objects, items, cols, dyn, trig, posed, endX: maxX + 90, skyY: maxY + 300, startSpeed,
             solids: items.filter(b => b.kind === "solid"), hazards: items.filter(b => b.kind === "hazard") };
  }

  // ---- triggers that change the level as you play: move, toggle, spawn ----
  // Read from the object keys (GD 2.2): 51 target group, 57 an object's groups ("3.7"), 28/29 move
  // x/y in units (30 = a block), 10 duration (s), 30 easing, 85 easing rate, 56 toggle on (1) / off,
  // 63 spawn delay (s), 11 touch triggered, 62 spawn triggered.
  // A trigger fires when the player's x passes its x, a touch-triggered one when the player's box
  // meets its 30x30, a spawn-triggered one only when a spawn trigger calls its group.
  // NOT modelled: move "lock to player" (58/59), "move to target" (100), follow, rotate, the
  // player being carried by a block moving sideways. sure:false -- checked on the plans only.
  function groupsOf(o) {
    const g = o.props && o.props["57"];
    return g ? String(g).split(".").map(Number).filter(n => n > 0) : [];
  }
  function readTriggers(objects) {
    const list = [];
    objects.forEach((o, i) => {
      const p = o.props || {}, id = o.id;
      const kind = id === 901 ? "move" : id === 1049 ? "toggle" : id === 1268 ? "spawn" : id === 1346 ? "rotate" : id === 1616 ? "stop" : null;
      if (!kind) return;
      const t = { i, kind, x: o.x, y: o.y, group: +p["51"] || 0, touch: p["11"] === "1", spawned: p["62"] === "1",
                  groups: groupsOf(o) };
      if (!t.group) return;
      if (kind === "move") {
        if (p["58"] === "1" || p["59"] === "1" || p["100"] === "1") return;
        t.dx = +p["28"] || 0; t.dy = +p["29"] || 0;
        t.dur = Math.max(0, p["10"] !== undefined ? +p["10"] : 0.5) * C.TPS;
        t.ease = +p["30"] || 0; t.rate = p["85"] !== undefined ? +p["85"] : 2;
      } else if (kind === "rotate") {
        // 68 degrees (clockwise) + 69 whole turns, about group 71's object (none: each object about
        // its own centre); 70 = lock the objects' own rotation
        t.deg = (+p["68"] || 0) + 360 * (+p["69"] || 0); t.center = +p["71"] || 0; t.lock = p["70"] === "1";
        t.dur = Math.max(0, p["10"] !== undefined ? +p["10"] : 0.5) * C.TPS;
        t.ease = +p["30"] || 0; t.rate = p["85"] !== undefined ? +p["85"] : 2;
      } else if (kind === "toggle") t.on = p["56"] === "1";
      else t.delay = (+p["63"] || 0) * C.TPS;
      list.push(t);
    });
    list.forEach((t, k) => { t.k = k; });
    const byX = list.filter(t => !t.touch && !t.spawned).sort((a, b) => a.x - b.x);
    const touch = list.filter(t => t.touch && !t.spawned);
    const byGroup = new Map();  // spawn-triggered triggers, by the groups they are in
    for (const t of list) if (t.spawned) for (const g of t.groups) { if (!byGroup.has(g)) byGroup.set(g, []); byGroup.get(g).push(t); }
    return { list, byX, touch, byGroup };
  }
  // cocos2d's easings, as GD's move trigger uses them (r = the "easing rate"; the period for elastic)
  function ease(type, r, t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const PI = Math.PI;
    const bo = u => u < 1 / 2.75 ? 7.5625 * u * u : u < 2 / 2.75 ? 7.5625 * (u -= 1.5 / 2.75) * u + 0.75
      : u < 2.5 / 2.75 ? 7.5625 * (u -= 2.25 / 2.75) * u + 0.9375 : 7.5625 * (u -= 2.625 / 2.75) * u + 0.984375;
    const per = r > 0 ? r : 0.3, sh = per / 4;
    switch (type) {
      case 1: { const u = t * 2; return u < 1 ? 0.5 * Math.pow(u, r) : 1 - 0.5 * Math.pow(2 - u, r); }
      case 2: return Math.pow(t, r);
      case 3: return Math.pow(t, 1 / r);
      case 4: { const u = t * 2 - 1; return u < 0 ? -0.5 * Math.pow(2, 10 * u) * Math.sin((u - sh) * 2 * PI / per)
                                                 : Math.pow(2, -10 * u) * Math.sin((u - sh) * 2 * PI / per) * 0.5 + 1; }
      case 5: { const u = t - 1; return -Math.pow(2, 10 * u) * Math.sin((u - sh) * 2 * PI / per); }
      case 6: return Math.pow(2, -10 * t) * Math.sin((t - sh) * 2 * PI / per) + 1;
      case 7: return t < 0.5 ? (1 - bo(1 - 2 * t)) * 0.5 : bo(2 * t - 1) * 0.5 + 0.5;
      case 8: return 1 - bo(1 - t);
      case 9: return bo(t);
      case 10: { const u = t * 2; return u < 1 ? 0.5 * Math.pow(2, 10 * (u - 1)) : 0.5 * (2 - Math.pow(2, -10 * (u - 1))); }
      case 11: return Math.pow(2, 10 * (t - 1));
      case 12: return 1 - Math.pow(2, -10 * t);
      case 13: return -0.5 * (Math.cos(PI * t) - 1);
      case 14: return 1 - Math.cos(t * PI / 2);
      case 15: return Math.sin(t * PI / 2);
      case 16: { const o = 2.5949095, u = t * 2; return u < 1 ? (u * u * ((o + 1) * u - o)) / 2 : ((u - 2) * (u - 2) * ((o + 1) * (u - 2) + o)) / 2 + 1; }
      case 17: { const o = 1.70158; return t * t * ((o + 1) * t - o); }
      case 18: { const o = 1.70158, u = t - 1; return u * u * ((o + 1) * u + o) + 1; }
      default: return t;
    }
  }
  // fire what the player has reached this tick (s.fired: trigger k -> the tick it acts from;
  // s.off: group -> toggled off; both copied on write, so states can share them)
  function fireTriggers(w, s) {
    const T = w.trig;
    if (!T || !T.list.length) return;
    let fired = null;
    const fire = (t, tick) => {
      if (!fired) fired = Object.assign({}, s.fired);
      if (fired[t.k] !== undefined) return;
      fired[t.k] = tick;
      if (t.kind === "stop") for (const u of T.list) if (u.groups.includes(t.group) && fired[u.k] !== undefined && fired[u.k] <= tick) {
        s.stopped = Object.assign({}, s.stopped); if (s.stopped[u.k] === undefined) s.stopped[u.k] = tick;
      }
      if (t.kind === "spawn") for (const u of T.byGroup.get(t.group) || []) fire(u, tick + t.delay);
    };
    while ((s.tp || 0) < T.byX.length && T.byX[s.tp || 0].x <= s.x) { fire(T.byX[s.tp || 0], s.tick); s.tp = (s.tp || 0) + 1; }
    if (T.touch.length) {
      const k = halfOf(s);
      for (const t of T.touch) if ((!s.fired || s.fired[t.k] === undefined) && Math.abs(t.x - s.x) < 15 + k && Math.abs(t.y - s.y) < 15 + k) fire(t, s.tick);
    }
    if (fired) s.fired = fired;
    // toggles act when their tick comes (a spawned one may wait for a delay)
    if (s.fired) for (const k in s.fired) {
      const t = T.list[k];
      if (t.kind === "toggle" && s.fired[k] <= s.tick && !(s.offDone && s.offDone[k])) {
        s.off = Object.assign({}, s.off); s.off[t.group] = !t.on;
        s.offDone = Object.assign({}, s.offDone); s.offDone[k] = true;
      }
    }
  }
  // how far through its action a fired trigger is (null: not started); a stop freezes it
  function progress(s, t) {
    const f = s.fired && s.fired[t.k];
    if (f === undefined || f > s.tick) return null;
    const now = s.stopped && s.stopped[t.k] !== undefined ? Math.min(s.tick, s.stopped[t.k]) : s.tick;
    return t.dur > 0 ? ease(t.ease, t.rate, (now - f) / t.dur) : 1;
  }
  // where a group is now: the sum of the moves on it that have started
  function groupOffset(w, s, g) {
    let dx = 0, dy = 0;
    if (s.fired) for (const k in s.fired) {
      const t = w.trig.list[k];
      if (t.kind !== "move" || t.group !== g) continue;
      const e = progress(s, t);
      if (e === null) continue;
      dx += t.dx * e; dy += t.dy * e;
    }
    return [dx, dy];
  }
  // where object o (in groups gs, turned by rotates rots) is at state s: [x, y, extra turn]
  function poseOf(w, s, o, gs, rots, cache) {
    const off = list => { let dx = 0, dy = 0; for (const g of list) {
      if (!cache.has(g)) cache.set(g, groupOffset(w, s, g));
      const v = cache.get(g); dx += v[0]; dy += v[1]; } return [dx, dy]; };
    const [dx, dy] = off(gs);
    let px = o.x + dx, py = o.y + dy, turn = 0;
    if (s.fired && rots) for (const t of rots) {
      const e = progress(s, t);
      if (e === null) continue;
      const a = t.deg * e;
      if (t.cx !== undefined) {
        const co = off(t.cgroups), cx = t.cx + co[0], cy = t.cy + co[1];
        const r = a * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r), ux = px - cx, uy = py - cy;
        px = cx + ux * c + uy * sn; py = cy - ux * sn + uy * c;
      }
      if (!t.lock) turn += a;
    }
    return [px, py, turn];
  }
  // for drawing: the objects triggers move, where they are in state s ({i, o: moved copy, off})
  function posedObjects(w, s) {
    const cache = new Map();
    return (w.posed || []).map(p => {
      const [x, y, turn] = poseOf(w, s, p.o, p.groups, p.rots, cache);
      return { i: p.i, o: Object.assign({}, p.o, { x, y, rot: (p.o.rot || 0) + turn }), off: !!(s.off && p.groups.some(g => s.off[g])) };
    });
  }
  // the dynamic objects near the player, moved to where they are now (toggled-off ones left out)
  function nearDyn(w, s, out) {
    if (!w.dyn || !w.dyn.length) return out;
    const cache = new Map();
    for (const b of w.dyn) {
      if (b.reach[1] < s.x - 40 || b.reach[0] > s.x + 40) continue;
      if (s.off && b.groups.some(g => s.off[g])) continue;
      // rotates: the object's centre turns about the centre object (both where their moves put them),
      // and the object itself turns with it unless locked
      const [px, py, turn] = poseOf(w, s, b.o, b.groups, b.rots, cache);
      if (turn % 360) {
        const hb = O.hitbox(Object.assign({}, b.o, { x: px, y: py, rot: (b.o.rot || 0) + turn }));
        out.push(Object.assign({}, b, hb, { obb: hb.obb, mx: 0, my: 0 }));
      } else {
        const mx = px - b.o.x, my = py - b.o.y;
        out.push(mx || my ? Object.assign({}, b, { x0: b.x0 + mx, x1: b.x1 + mx, y0: b.y0 + my, y1: b.y1 + my, mx, my }) : b);
      }
    }
    return out;
  }

  function startState(w) {
    return { tick: 0, x: C.START_X, y: C.SIZE / 2, vy: 0, grav: 1, sp: w ? w.startSpeed : 1,
             mode: "cube", floorY: 0, ceilY: Infinity,
             grounded: true, onSlope: false, dashing: false, used: [], buffered: false, ring: false,
             dead: false, done: false, why: "", killer: null, act: "", rot: 0 };
  }
  // GD keeps vertical speed on a 0.001 grid: every velocity step is rounded (gdsolver's qVy,
  // measured: a 0.0432 step goes 0 -> 0.043 -> 0.086 -> 0.129).
  const q3 = v => Math.round(v * 1000) / 1000;
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
  const touching = (s, b) => { const k = halfOf(s); return ov(s.x - k, s.x + k, s.y - k, s.y + k, b); };
  // Orbs: GD tests the player's box where it was at the end of the previous tick; for an orb turned
  // off the grid it asks the oriented boxes, the player's turned by its spin (gdsolver measured
  // both: GJBaseGameLayer::collisionCheckObjects). Upright orbs are a plain box test.
  // The wave keeps an unturned square of half 6.
  function orbTouch(px, py, rot, s, b) {
    if (s.mode === "wave") return ov(px - 6, px + 6, py - 6, py + 6, b);
    const k = halfOf(s), t = (rot || 0) * Math.PI / 180, c = Math.abs(Math.cos(t)), si = Math.abs(Math.sin(t));
    const hw = (b.x1 - b.x0) / 2, hh = (b.y1 - b.y0) / 2, dx = px - (b.x0 + b.x1) / 2, dy = py - (b.y0 + b.y1) / 2;
    if (!((b.o.rot || 0) % 90)) return ov(px - k, px + k, py - k, py + k, b); // an upright orb: plain boxes
    const ext = k * (c + si);                         // the turned square on the world axes
    if (Math.abs(dx) >= hw + ext || Math.abs(dy) >= hh + ext) return false;
    const ct = Math.cos(t), st = Math.sin(t);         // the orb on the player's own axes
    const lx = dx * ct + dy * st, ly = -dx * st + dy * ct, oe = hw * c + hh * si;
    return Math.abs(lx) < k + oe && Math.abs(ly) < k + oe;
  }

  // a hazard turned off the grid, against the player's square: SAT on the box's two axes and the
  // world's (gdsolver measured that GD kills by the turned box, not the box around it: lv20 wave vs a
  // spike at -63 degrees, and a rig of spikes at 15/30/45/63)
  function obbHit(b, px, py, k) {
    const o = b.obb, dx = px - o.cx - (b.mx || 0), dy = py - o.cy - (b.my || 0);
    const r = k * (Math.abs(o.c) + Math.abs(o.s));
    const lx = dx * o.c + dy * o.s, ly = -dx * o.s + dy * o.c;
    if (Math.abs(lx) >= o.hw + r || Math.abs(ly) >= o.hh + r) return false;
    const ex = o.hw * Math.abs(o.c) + o.hh * Math.abs(o.s), ey = o.hw * Math.abs(o.s) + o.hh * Math.abs(o.c);
    return Math.abs(dx) < ex + k && Math.abs(dy) < ey + k;
  }

  // slope surface height under the player (floor slopes only)
  function slopeTop(b, xc) {
    if (b.up > 0) { const px = Math.min(xc + 15, b.x1); return px < b.x0 ? null : b.y0 + (px - b.x0) * b.rise; }
    const px = Math.max(xc - 15, b.x0); return px > b.x1 ? null : b.y0 + (b.x1 - px) * b.rise;
  }

  // a ceiling slope's underside at the lowest point over the player's width
  function slopeBottom(b, xc) {
    if (b.down > 0) { const px = Math.min(xc + 15, b.x1); return px < b.x0 ? null : b.y1 - (px - b.x0) * b.rise; }
    const px = Math.max(xc - 15, b.x0); return px > b.x1 ? null : b.y1 - (b.x1 - px) * b.rise;
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
    // ball and spider take a ring's launch x 0.7 (the pink one from 0.77, not 0.72): gdsolver,
    // GD stores 3.1304 for a ball's blue ring and 6.0263 for its pink one
    const rolls = s.mode === "ball" || s.mode === "spider", post = rolls ? 0.7 : 1;
    const mul = ship && d.shipMul !== undefined ? d.shipMul : s.mode === "ufo" && d.ufoMul !== undefined ? d.ufoMul
              : rolls && d.ballMul !== undefined ? d.ballMul : d.mul;
    s.used.push(b.i); s.ring = false; s.grounded = false; s.onSlope = false; s.boost = true;
    s.act = d.name;
    const mf = MF(s);
    if (d.act === "jump") s.vy = s.grav * q3(sp.yStart * mul) * post * mf;
    else if (d.act === "blue") { s.vy = s.grav * sp.yStart * mul * mf; flip(s); s.vy *= post; }
    else if (d.act === "green") { flip(s); s.vy = s.grav * sp.yStart * (ship ? mul : 1) * post * mf; }
    else if (d.act === "black") s.vy = -(ship ? 14 : C.MAX_FALL) * s.grav;
    else if (d.act === "dash") { if (d.flip) flip(s); s.dashing = true; s.dashAngle = (b.o.rot || 0) * Math.PI / 180; s.vy = 0; }
    else if (d.act === "spider") teleport(w, s);
  }
  const padRoll = s => (s.mode === "ball" || s.mode === "spider" || s.mode === "swing" ? 0.6 : 1);
  function usePad(w, s, b) {
    const d = b.d;
    if (d.act === "blue") {
      // which way it faces: upright, turned half a turn, or flipped (key 5) to hang from a ceiling
      const fy = !!b.o.flipY, facingUp = (b.q === 0 && !fy) || (b.q === 2 && fy), facingDown = (b.q === 2 && !fy) || (b.q === 0 && fy);
      if (!((facingUp && s.grav === 1) || (facingDown && s.grav === -1))) return;
      s.used.push(b.i); s.act = d.name; s.vy = s.grav * C.PAD * d.bump * MF(s); flip(s); s.vy *= padRoll(s); return;
    }
    s.used.push(b.i); s.act = d.name; s.grounded = false; s.onSlope = false; s.ring = false; s.boost = true;
    // GD's pad table (GJBaseGameLayer::bumpPlayer, via gdsolver): pink ship 0.35, UFO 0.4, ball/spider
    // 0.7, else 0.65; red ship 0.63 (mini 0.95), UFO 0.6 (mini 0.98), else 1.25; yellow 1. Then x16,
    // x0.8 mini, x0.6 for ball, spider and swing (measured: a ball's yellow pad 9.6, pink 6.72).
    const m = s.mode, rolls = m === "ball" || m === "spider";
    const bump = d.id === 140 ? (m === "ship" ? 0.35 : m === "ufo" ? 0.4 : rolls ? 0.7 : 0.65)
               : d.id === 1332 ? (m === "ship" ? (s.mini ? 0.95 : 0.63) : m === "ufo" ? (s.mini ? 0.98 : 0.6) : 1.25)
               : m === "ship" && d.shipBump !== undefined ? d.shipBump : d.bump;
    if (d.act === "jump") s.vy = s.grav * C.PAD * bump * MF(s) * padRoll(s);
    else if (d.act === "spider") teleport(w, s);
  }

  // Mode portals. A flying mode's portal (and ball, spider) sets a band: floor = the 30 grid at
  // or below portal y - H/2 (at least the ground), ceiling = floor + H; H = 300 ship/UFO/wave/swing,
  // 240 ball, 270 spider. Cube and robot portals leave it alone (gdsolver, read from GD's
  // getGroundHeightForMode and checked on 18 portals). A portal of the mode you are in does nothing.
  // Entering or leaving a flying mode halves vertical speed.
  const FLY = { ship: 1, ufo: 1, wave: 1, swing: 1 };
  const BAND = { ship: 300, ufo: 300, wave: 300, swing: 300, ball: 240, spider: 270 };
  function enterMode(s, b) {
    const to = b.d.mode;
    if (to === s.mode) return;
    if (C.SIMULATED_MODES.indexOf(to) < 0) { s.dead = true; s.why = to + " mode is not simulated yet"; s.killer = b.o; return; }
    if (!!FLY[s.mode] !== !!FLY[to]) s.vy *= 0.5;
    s.mode = to; s.grounded = false; s.onSlope = false; s.act = b.d.name; s.og = false; s.swingPend = false;
    if (BAND[to]) { s.floorY = Math.max(0, Math.floor((b.o.y - BAND[to] / 2) / 30) * 30); s.ceilY = s.floorY + BAND[to]; }
  }
  // the player's box half-size for contact (orbs, pads, portals, hazards); the wave's rect is
  // 10x10 and it dies on a solid only with a 3x3 box (gdsolver); the spider's is 27
  // Mini (gdsolver, lv11): half 9 (spider 8.1, wave 3), launches x 0.8, gravity unchanged on foot;
  // ship/UFO gravity and limits / 0.85, mini UFO flaps to 6.8, mini swing gravity x 1.5.
  const halfOf = s => (s.mode === "wave" ? (s.mini ? 3 : C.WAVE_HALF) : s.mode === "spider" ? (s.mini ? 8.1 : C.SPIDER_HALF) : s.mini ? 9 : 15);
  const MF = s => (s.mini ? 0.8 : 1);
  // flying modes' speed limits (8 up, 6.4 down), skipped while an orb/pad boost is still above 8
  function clampFly(s) {
    const up = s.vy * s.grav, hi = s.mini ? 9.412 : C.SHIP_UP, lo = s.mini ? -7.529 : C.SHIP_DOWN;
    if (s.boost && up <= hi) s.boost = false;
    if (!s.boost) { if (up > hi) s.vy = hi * s.grav; if (up < lo) s.vy = lo * s.grav; }
  }
  function gravityPortal(s, b) {
    const to = b.d.grav === 0 ? -s.grav : b.d.grav;
    if (to !== s.grav) { flip(s); s.act = b.d.name; }
  }

  // One physics step. inp = {press, held}: press = the button went down this step.
  function step(w, s, inp) {
    if (s.dead || s.done) return s;
    const sp = SPEEDS[s.sp], h = halfOf(s), m = s.mode;
    s.act = "";
    // GD: a press arms both the jump buffer and the orb flag. The buffer stays armed while held
    // (a held cube jumps again on every landing); the orb flag (s.ring) is used up by an orb, a
    // pad, a jump, a ball tap, a UFO flap...: the modes other than cube need a fresh press.
    if (inp.press) { s.ring = true; s.robotLet = false; }
    s.buffered = !!inp.held;
    if (!inp.held) { s.ring = false; s.robotLet = true; if (s.dashing) { s.dashing = false; s.vy = 0; } }
    fireTriggers(w, s);
    const objs = nearDyn(w, s, near(w, s.x));
    // a press activates an orb already being touched; orbs beat a ground jump
    const px0 = s.x, py0 = s.y, rot0 = s.rot;
    // ...or one touched at the end of the tick before that: GD keeps the touched orbs in a list that
    // carries over a tick (m_touchedRings). Real-game plans: lv9 gets 83 -> 343 blocks and lv15 229 -> 267
    // with it, no level less far. (gdsolver's notes leave the carry-over out for a cube on foot after one
    // custom-level case with a moving red orb; the official levels say otherwise.)
    const pp = s.prev || [px0, py0, rot0];
    if (s.ring) for (const b of objs) if (b.kind === "orb" && !s.used.includes(b.i) && (orbTouch(px0, py0, rot0, s, b) || orbTouch(pp[0], pp[1], pp[2], s, b))) { useOrb(w, s, b); break; }
    s.prev = [px0, py0, rot0];
    // Upside-down coyote: walking off a ledge with gravity flipped, GD leaves its on-ground flag set
    // until the fall speed passes 2g (its flipped "is falling" test is bugged), so a fresh press
    // still jumps from mid-air (gdsolver measured it: presses 0-2 ticks after leaving jump, later
    // ones do not). Upright, the flag clears at once.
    const coyote = m === "cube" && !s.grounded && s.og && inp.press;
    let noGrav = false;
    if (m === "cube" && (s.grounded || coyote) && s.buffered) { s.vy = s.grav * sp.yStart * MF(s); s.grounded = false; s.onSlope = false; s.ring = false; s.act = "jump"; }
    else if (m === "robot" && s.grounded && s.ring) {
      // half a cube jump; then while held it hovers (gravity cancelled) for 67 ticks at most, and a
      // release ends the hover for good (gdsolver: GD adds back the gravity it subtracts, budget 1.5)
      s.vy = s.grav * sp.yStart * 0.5 * MF(s); s.grounded = false; s.ring = false; s.act = "jump"; s.hover = 0; s.robotLet = false;
    } else if (m === "ball" && s.grounded && s.ring) {
      // tap: jump speed, flip gravity (which halves it), x 0.6 -> 3.354 at 1x towards the new floor
      s.vy = s.grav * sp.yStart * MF(s); flip(s); s.vy *= 0.6; s.ring = false; s.act = "tap";
    } else if (m === "spider" && s.grounded && s.ring) { teleport(w, s); s.ring = false; s.act = "teleport"; }
    else if (m === "ufo" && s.ring) {
      const flap = s.mini ? 6.8 : C.UFO_FLAP;
      if (s.vy * s.grav < flap) s.vy = flap * s.grav;
      s.ring = false; s.grounded = false; s.act = "flap";
    } else if (m === "swing" && s.ring) { s.swingPend = true; s.ring = false; }
    if (m === "robot" && s.act !== "jump" && s.hover !== undefined && s.hover < C.ROBOT_HOVER && inp.held && !s.robotLet && !s.grounded) { s.hover++; noGrav = true; }

    const wasSlope = s.onSlope;
    if (s.dashing) {
      s.vy = Math.sin(-s.dashAngle) * sp.x / 0.9 * s.grav; // GD rotation is clockwise; 0 = straight ahead
    } else if (m === "ship") {
      // gdp updateJump: vy += -a * g * dts * flip * b. "Falling" uses the speed's own gravity.
      // GD's playerIsFallingBugged: the switch is at +2g in WORLD terms, also upside down (gdsolver
      // measured it: flipped, the player-frame threshold is -2g, not a mirror of the upright one)
      const falling = s.vy * s.grav <= 2 * sp.g * s.grav;
      const a = inp.held ? -1 : (falling ? 0.8 : 1.2), bb = inp.held ? (falling ? 0.5 : 0.4) : 0.4;
      s.vy = q3(s.vy - a * C.SHIP_G * C.DTS * s.grav * bb / (s.mini ? 0.85 : 1));
      clampFly(s);
    } else if (m === "ufo") {
      // gravity 0.086 while falling or slow, 0.129 while rising fast (gdsolver's UfoModel)
      const falling = s.vy * s.grav <= 2 * sp.g * s.grav;
      s.vy = q3(s.vy - (falling ? 0.4 : 0.6) * C.SHIP_G * C.DTS * s.grav / (s.mini ? 0.85 : 1));
      clampFly(s);
    } else if (m === "wave") {
      // straight lines, up while held and down when not: one unit up per unit forward (45 degrees),
      // two for mini (gdsolver; the user's Deadlocked video: a mini wave's trail is 2.00:1). y moves
      // vy * 0.225 a tick and x speed * 0.25, hence the 0.25 / 0.225.
      // GD keeps the wave's y speed at +-speed (what a following mode inherits, no mini factor) and
      // moves y by the line itself
      const dir = s.grav * (inp.held ? 1 : -1);
      s.vy = dir * sp.x; s.waveDy = dir * sp.x * C.DT * (s.mini ? 2 : 1);
    } else if (m === "swing") {
      // a press flips gravity one tick later, keeping 80% of the speed; gravity 0.086; |vy| <= 8
      if (s.swingPend && !inp.press) { s.swingPend = false; s.grav = -s.grav; s.vy *= 0.8; s.grounded = false; s.act = "swing"; }
      s.vy = q3(s.vy - (s.mini ? 0.6 : 0.4) * C.SHIP_G * C.DTS * s.grav);
      s.vy = Math.max(-C.SHIP_UP, Math.min(C.SHIP_UP, s.vy));
    } else if (!noGrav) {
      // cube: the speed's gravity; ball and spider 0.6 x 0.958; robot 0.9 x the speed's
      const g = m === "ball" || m === "spider" ? C.SHIP_G * 0.6 : m === "robot" ? sp.g * 0.9 : sp.g;
      s.vy = q3(s.vy - g * C.DTS * s.grav);
      if (s.vy * s.grav < -C.MAX_FALL) s.vy = -C.MAX_FALL * s.grav;
    }
    s.x += sp.x * C.DT;
    s.y += m === "wave" && !s.dashing ? s.waveDy : s.vy * C.DTS;
    // GD's on-ground flag after leaving a surface without a jump (see "coyote" above)
    if (s.grounded) s.og = s.grav === -1 && s.act !== "jump";
    else if (s.og && -s.vy * s.grav > 2 * sp.g) s.og = false;
    if (s.act || m !== "cube") s.og = false;
    s.grounded = false; s.onSlope = false;

    if (BAND[m]) {
      // the band's floor and roof are safe to slide on (the wave's centre stays 10 off them)
      const k = m === "wave" ? (s.mini ? 6 : C.WAVE_CLAMP) : h;
      if (s.y - k <= s.floorY) { s.y = s.floorY + k; if (s.vy < 0) s.vy = 0; s.grounded = s.grav === 1; }
      if (s.y + k >= s.ceilY) { s.y = s.ceilY - k; if (s.vy > 0) s.vy = 0; s.grounded = s.grav === -1; }
    }
    // the ground
    else if (s.y - h <= 0) { s.y = h; if (s.grav === 1) { s.vy = Math.max(s.vy, 0); s.grounded = s.vy === 0; } else s.vy = Math.max(s.vy, 0); }

    const feet = () => (s.grav === 1 ? s.y - h : s.y + h);
    for (const b of objs) {
      if (b.kind === "solid" && m === "wave") {
        // the wave dies only when its tiny kill box enters a block; it slides along faces
        const i = C.WAVE_KILL;
        if (!b.oneway && ov(s.x - i, s.x + i, s.y - i, s.y + i, b)) { s.dead = true; s.why = "block"; s.killer = b.o; continue; }
        if (!touching(s, b)) continue;
        if (s.vy <= 0 && s.y >= b.y1) { s.y = b.y1 + h; s.vy = 0; s.grounded = s.grav === 1; }
        else if (s.vy >= 0 && s.y <= b.y0) { s.y = b.y0 - h; s.vy = 0; s.grounded = s.grav === -1; }
      } else if (b.kind === "solid" && FLY[m]) {
        if (!touching(s, b)) continue;
        if (s.vy <= 0 && s.y - h >= b.y1 - C.FLY_SNAP) { s.y = b.y1 + h; s.vy = 0; s.grounded = s.grav === 1; continue; }
        if (s.vy >= 0 && s.y + h <= b.y0 + C.FLY_SNAP) { s.y = b.y0 - h; s.vy = 0; s.grounded = s.grav === -1; continue; }
        const i = C.INNER / 2;
        if (!b.oneway && ov(s.x - i, s.x + i, s.y - i, s.y + i, b)) { s.dead = true; s.why = "block"; s.killer = b.o; }
      } else if (b.kind === "solid") {
        if (!touching(s, b)) continue;
        const toward = s.vy * s.grav <= 0;
        if (s.grav === 1 && toward && feet() >= b.y1 - C.SNAP) { s.y = b.y1 + h; s.vy = 0; s.grounded = true; continue; }
        if (s.grav === -1 && toward && feet() <= b.y0 + C.SNAP) { s.y = b.y0 - h; s.vy = 0; s.grounded = true; continue; }
        const i = C.INNER / 2;
        if (!b.oneway && ov(s.x - i, s.x + i, s.y - i, s.y + i, b)) { s.dead = true; s.why = "block"; s.killer = b.o; continue; }
        // outer box overlapping a block's head side does nothing for the cube (no head bump):
        // the user's red-orb dive grazes a ledge corner and carries on (recording, 109.8 s)
      } else if (b.kind === "slope" && b.ceil) {
        // a ceiling slope (UNCHECKED against the game): flying modes and an upside-down player slide
        // along its underside; an upright cube only dies in it (no head bump)
        if (!touching(s, b)) continue;
        const bot = slopeBottom(b, s.x);
        if (bot === null) continue;
        const slopeV = -sp.x * b.rise * b.down / 0.9;
        const rides = FLY[m] || s.grav === -1;
        if (rides && s.y + h > bot && s.y + h <= bot + C.SNAP + 2 && s.vy >= Math.min(slopeV, 0) - 1e-6) {
          s.y = bot - h; if (s.grav === -1) s.grounded = true;
          s.vy = bot > b.y0 + 1e-6 || b.down < 0 ? Math.min(s.vy, slopeV) : Math.min(s.vy, 0);
          if (s.grav === -1) { s.vy = slopeV; s.onSlope = true; }
        } else if (s.y + h > bot + (rides ? C.SNAP + 2 : 0)) {
          const i = C.INNER / 2;
          const px = Math.max(b.x0, Math.min(b.x1, b.down > 0 ? s.x + i : s.x - i));
          const under = b.down > 0 ? b.y1 - (px - b.x0) * b.rise : b.y1 - (b.x1 - px) * b.rise;
          if (ov(s.x - i, s.x + i, s.y - i, s.y + i, b) && s.y + i > under) { s.dead = true; s.why = "slope"; s.killer = b.o; }
        }
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
      if (b.kind === "hazard") {
        let hitIt = touching(s, b);
        if (hitIt && b.obb && !b.r) hitIt = obbHit(b, s.x, s.y, halfOf(s));
        if (hitIt && b.r) { const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
          const hh = halfOf(s), dx = Math.max(Math.abs(cx - s.x) - hh, 0), dy = Math.max(Math.abs(cy - s.y) - hh, 0); hitIt = dx * dx + dy * dy < b.r * b.r; }
        if (hitIt) { s.dead = true; s.why = b.r ? "saw" : "spike"; s.killer = b.o; break; }
      }
      else if (b.kind === "unsupported") { if (touching(s, b)) { s.dead = true; s.why = b.d.what + " is not simulated yet"; s.killer = b.o; break; } }
      else if (b.kind === "orb") { if (s.ring && orbTouch(px0, py0, rot0, s, b)) useOrb(w, s, b); }
      else if (b.kind === "pad") { if (touching(s, b)) usePad(w, s, b); }
      else if (b.kind === "speed") { if (touching(s, b)) { s.sp = b.d.speed; s.used.push(b.i); } }
      else if (b.kind === "mode") { if (touching(s, b)) { s.used.push(b.i); enterMode(s, b); if (s.dead) break; } }
      else if (b.kind === "gravity") { if (touching(s, b)) { s.used.push(b.i); gravityPortal(s, b); } }
      else if (b.kind === "teleport") { if (touching(s, b)) { s.used.push(b.i);
        // to the exit: same x, the portal's y + key 54, speed kept (UNCHECKED; rotated portals, "smooth"
        // teleport and the 2.2 options 345+ are not modelled)
        s.y = b.o.y + (+(b.o.props && b.o.props["54"]) || 0) + (b.my || 0); s.grounded = false; s.onSlope = false; s.act = b.d.name; } }
      else if (b.kind === "size") { if (touching(s, b)) { s.used.push(b.i); if (s.mini !== b.d.mini) { s.mini = b.d.mini; s.act = b.d.name; } } }
    }
    if (wasSlope && !s.onSlope && !s.grounded) { /* left a slope: keeps its upward speed (a small launch) */ }
    // looks only: half a turn per jump, square on landing
    if (s.mode === "ship") s.rot = -Math.atan2(s.vy * C.DTS, sp.x * C.DT) * 180 / Math.PI;
    else if (s.grounded || s.dashing) s.rot = Math.round(s.rot / 90) * 90;
    else s.rot += s.grav * 180 * C.DTS / (2 * sp.yStart * MF(s) / sp.g); // half a turn per flat jump (mini: 0.8 of the time)
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
      for (const b of nearDyn(w, s, near(w, s.x))) if (b.kind === "orb" && !s.used.includes(b.i) && orbTouch(s.x, s.y, s.rot, s, b)) return true;
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
    // opts.start: solve the rest of the level from this state (opts.held: the button is down there)
    const s0 = opts.start ? clone(opts.start) : startState(w), T0 = s0.tick || 0, held0 = !!opts.held;
    let front = [{ s: s0, cost: 0, held: held0, parent: null }];
    let far = null, won = null, peak = 0;
    for (let t = T0; t < maxTicks && front.length && !won; t++) {
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
      const ev = []; let prev = held0;
      helds.forEach((h, i) => { const t = T0 + i; if (h && !prev) ev.push({ tick: t, type: "press" }); if (!h && prev) ev.push({ tick: t, type: "release" }); prev = h; });
      return ev;
    };
    if (!won) {
      const tr = far ? eventsOf({ s: far.s, held: far.held, parent: far.parent }) : [];
      return { ok: false, clicks: [], trail: tr, dieAt: far && far.s, why: far && far.s.why, killer: far && far.s.killer, peak, sweep: true };
    }
    const events = eventsOf(won);
    // label each press with what it did, from a replay
    let path;
    if (!opts.start) path = run(w, events).path;
    else { // replay from the start state; path[t] by absolute tick
      path = []; const st = clone(s0), evm = new Map(events.map(e => [e.tick, e.type])); let h = held0;
      path[st.tick] = clone(st);
      while (!st.dead && !st.done && st.tick < maxTicks) { const e = evm.get(st.tick); const press = e === "press";
        if (e) h = press; step(w, st, { press, held: h }); path[st.tick] = clone(st); }
    }
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

  // the rest of a level from a given state (e.g. after a hand-made stretch): events have absolute ticks
  const solveFrom = (w, state, opts) => solveSweep(w, Object.assign({}, opts, { start: state }));

  Object.assign(GD, { PHYS: C, SPEEDS, makeWorld, startState, step, run, solve, solveSweep, solveAny, solveFrom, posedObjects });
})(typeof module !== "undefined" ? module.exports : (window.GD = window.GD || {}));
