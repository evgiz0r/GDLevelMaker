// Cube physics and a solver that finds the clicks that beat a level.
//
// Numbers and rules come from decompilations of GD 2.2's own physics (sources in CLAUDE.md),
// checked against the user's recordings where noted there. GD runs 240 physics steps a second;
// velocities are in units per 1/60 s "frame". Per step: x moves dt = 0.25 frames, y moves
// dts = 0.225 frames (GD's 0.9 slow factor on vertical motion).
(function (GD) {
  "use strict";
  const O = (typeof module !== "undefined" && typeof require !== "undefined") ? require("./objects.js") : GD;
  // dual mode (two players, one button) lives in lib/dual.js; the browser loads it as GD.dualStep
  const D = (typeof module !== "undefined" && typeof require !== "undefined") ? require("./dual.js") : GD;
  // (2026-11-24 morning to evening the sim kept a released air press until landing -- wrong, see below and PHYSICS.md.)
  // The cube on landing, GD's rule (2026-11-24, replacing the long buffer): m_jumpBuffered is a LEVEL -- set by pushButton, cleared by
  // releaseButton -- and the cube's jump gate reads it twice a tick, so a press still down on the tick BEFORE the landing
  // tick jumps (one tick of grace) and a press released in the air does nothing (gdsolver's step.hpp, from GD's
  // disassembly; seen in the user's GDLM 67 run, 18-58-15.mkv: three released presses 14-44 ticks before a landing, the
  // cube sat on the ground every time). GDLM_LANDBUF=old: the long buffer (falling until landing, rising 40 ticks);
  // =<ticks>: a countdown, for measuring. PHYSICS.md "Landing buffer".
  const LB_ENV = typeof process !== "undefined" && process.env ? process.env.GDLM_LANDBUF : undefined;
  const LB_GD = LB_ENV == null || LB_ENV === "" || LB_ENV === "gd";
  const LANDBUF = LB_GD ? 0 : LB_ENV === "old" ? Infinity : +LB_ENV;
  const LANDRISE = LANDBUF === Infinity ? 40 : LANDBUF;
  // A cube that LANDED ON THE GROUND last tick jumps no sooner than the tick after (GD: land t164, the held re-jump at t165
  // -- gdsolver's rig, a press at t60 held: jump t61, land t164, jump t165; the user's held bounce on GDLM 67, 18-58-15.mkv
  // 244.2 s: a hop every 104-105 ticks, the sim's was 103). Ground plane only: on blocks it broke an official attempt
  // line. GDLM_LANDWAIT=0 turns it off, =all applies it to every landing (measuring). PHYSICS.md "Landing buffer".
  const LW_ENV = typeof process !== "undefined" && process.env ? process.env.GDLM_LANDWAIT : undefined;
  const EXP_LW = LW_ENV === "0" ? "" : LW_ENV === "all" ? "all" : "ground";

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
        // a turned slope is the slope whose square corner sits where the turn puts it: take the
        // corner of the unturned, flipped slope (plain "/" has it bottom-right), turn it clockwise
        // q quarters (BR -> BL -> TL -> TR), read the flips back. Half a turn = both flips. The
        // hitbox (hb) is already turned, so a 2:1 slope turned a quarter rises 2 per 1 (UNCHECKED
        // in the game for quarter turns; Dash's swing part has 1744 at 90)
        let cx = o.flipX ? 0 : 1, cy = o.flipY ? 1 : 0;           // corner: x 1 = right, y 1 = top
        for (let k = 0; k < it.q; k++) [cx, cy] = [cy === 0 ? 0 : 1, cx === 0 ? 1 : 0];
        const fx = cx === 0, fy = cy === 1;
        {
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
    // where each group's objects are (any object, decoration and triggers too: a rotate's centre
    // is often an invisible one; a move-to-target's target too)
    const byGroup = new Map();
    for (const o of objects) for (const g of groupsOf(o)) { if (!byGroup.has(g)) byGroup.set(g, o); }
    for (const t of trig.list) if (t.kind === "move" || t.kind === "toggle" || t.kind === "rotate" || t.kind === "follow") {
      const m = moved.get(t.group) || { dx: 0, rot: [] };
      if (t.kind === "move") {
        // easing can overshoot; a lock follows the player anywhere; a target: as far as it is (x1.5) plus slack
        const c = byGroup.get(t.tcenter || t.group), g = byGroup.get(t.target);
        m.dx += t.lockX || (t.target !== undefined && (t.tplayer || !g || !c)) ? 1e9 : t.target !== undefined ? Math.abs(g.x - c.x) * 1.5 + 300 : Math.abs(t.dx) * 1.5;
      }
      if (t.kind === "follow") m.dx += 1e9;   // follows another group's moves: anywhere
      if (t.kind === "rotate") m.rot.push(t);
      moved.set(t.group, m);
    }
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
    return { objects, items, cols, dyn, trig, posed, groupObj: byGroup, hasDual: items.some(b => b.kind === "dual"), endX: maxX + 90, skyY: maxY + 300, startSpeed,
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
      const kind = id === 901 ? "move" : id === 1049 ? "toggle" : id === 1268 ? "spawn" : id === 1346 ? "rotate" : id === 1616 ? "stop"
        : id === 1347 ? "follow" : null;
      if (!kind) return;
      const t = { i, kind, x: o.x, y: o.y, group: +p["51"] || 0, touch: p["11"] === "1", spawned: p["62"] === "1",
                  groups: groupsOf(o) };
      if (!t.group) return;
      // a touch trigger's box is 30x30 times its scale (32 uniform, 128/129 x/y, as hitboxes): Dash's touch spawns on
      // its invisible platforms (1268 at y 195, scale y 1.1) were missed by a mini cube standing on the platform (its
      // centre 24 above, the unscaled limit 15 + 9), so the next platform never rose (2026-11-24)
      const sc = +p["32"] || 1; t.hw = 15 * (p["128"] !== undefined ? +p["128"] : sc); t.hh = 15 * (p["129"] !== undefined ? +p["129"] : sc);
      // 87 multi-trigger: a spawn-triggered trigger that may fire again each time it is spawned (else once)
      t.multi = p["87"] === "1";
      if (kind === "move") {
        t.dx = +p["28"] || 0; t.dy = +p["29"] || 0;
        // 100 move to target: the group moves so that its centre object (group 395; none: the group's own
        // first object) lands on group 71's object (138: on player 1), measured when it fires; 101 = 1 x only,
        // 2 y only (keys from the 2.2081 decompile's EffectGameObject save string). 397 "dynamic" (keeps
        // following a moving target) is not modelled: the target is read once.
        if (p["100"] === "1") { t.target = +p["71"] || 0; t.tcenter = +p["395"] || 0; t.tmode = +p["101"] || 0; t.tplayer = p["138"] === "1"; }
        // 58/59 lock to player X/Y: for the duration the group moves with the player (by the player's
        // own motion since the trigger fired), then stays where that left it (UNCHECKED against the
        // game; Spire's flipped-cube roof, 2026-11-23). Key 100 (move to target) is not modelled.
        t.lockX = p["58"] === "1"; t.lockY = p["59"] === "1";
        t.dur = Math.max(0, p["10"] !== undefined ? +p["10"] : 0.5) * C.TPS;
        t.ease = +p["30"] || 0; t.rate = p["85"] !== undefined ? +p["85"] : 2;
      } else if (kind === "rotate") {
        // 68 degrees (clockwise) + 69 whole turns, about group 71's object (none: each object about
        // its own centre); 70 = lock the objects' own rotation
        t.deg = (+p["68"] || 0) + 360 * (+p["69"] || 0); t.center = +p["71"] || 0; t.lock = p["70"] === "1";
        t.dur = Math.max(0, p["10"] !== undefined ? +p["10"] : 0.5) * C.TPS;
        t.ease = +p["30"] || 0; t.rate = p["85"] !== undefined ? +p["85"] : 2;
      } else if (kind === "follow") {
        // follow (1347): for its duration the group moves by group 71's own movement since it fired, times
        // 72 (x) and 73 (y) (default 1). UNCHECKED in the game.
        t.fgroup = +p["71"] || 0; t.fx = p["72"] !== undefined ? +p["72"] : 1; t.fy = p["73"] !== undefined ? +p["73"] : 1;
        t.dur = Math.max(0, p["10"] !== undefined ? +p["10"] : 0.5) * C.TPS;
        if (!t.fgroup) return;
      } else if (kind === "stop") t.smode = +p["580"] || 0;  // 580: 0 stop, 1 pause, 2 resume (2.2; ASSUMED key)
      else if (kind === "toggle") t.on = p["56"] === "1";
      else t.delay = (+p["63"] || 0) * C.TPS;
      list.push(t);
    });
    list.forEach((t, k) => { t.k = k; });
    const byX = list.filter(t => !t.touch && !t.spawned).sort((a, b) => a.x - b.x);
    const touch = list.filter(t => t.touch && !t.spawned);
    const byGroup = new Map();  // spawn-triggered triggers, by the groups they are in
    for (const t of list) if (t.spawned) for (const g of t.groups) { if (!byGroup.has(g)) byGroup.set(g, []); byGroup.get(g).push(t); }
    const lock = list.filter(t => t.lockX || t.lockY), follow = list.filter(t => t.kind === "follow");
    return { list, byX, touch, byGroup, lock: lock.length ? lock : null, follow: follow.length ? follow : null };
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
  // A trigger can be live more than once (87 multi-trigger, spawned again): its first firing is keyed k in
  // s.fired, the n-th repeat "k.n" (s.nfire[k] = repeats so far). keysOf lists them.
  const keysOf = (s, t) => { const n = (s.nfire && s.nfire[t.k]) || 0, out = [t.k]; for (let i = 1; i <= n; i++) out.push(t.k + "." + i); return out; };
  const trigOf = (w, k) => w.trig.list[parseInt(k, 10)];
  // where an object is now (its groups' moves; rotates not included): for move-to-target
  function objNow(w, s, o) { let x = o.x, y = o.y; for (const g of groupsOf(o)) { const v = groupOffset(w, s, g); x += v[0]; y += v[1]; } return [x, y]; }
  function targetDelta(w, s, t) {
    const c = w.groupObj && w.groupObj.get(t.tcenter || t.group), g = w.groupObj && w.groupObj.get(t.target);
    if (!c || (!g && !t.tplayer)) return [0, 0];
    const [cx, cy] = objNow(w, s, c), [tx, ty] = t.tplayer ? [s.x, s.y] : objNow(w, s, g);
    return [t.tmode === 2 ? 0 : tx - cx, t.tmode === 1 ? 0 : ty - cy];
  }
  // fire what the player has reached this tick (s.fired: key -> the tick it acts from; s.off: group ->
  // toggled off; all copied on write, so states can share them)
  function fireTriggers(w, s) {
    const T = w.trig;
    if (!T || !T.list.length) return;
    let fired = null;
    const cow = name => { s[name] = Object.assign({}, s[name]); };
    const fire = (t, tick, depth) => {
      if ((depth || 0) > 40) return;
      if (!fired) fired = Object.assign({}, s.fired);
      let key = t.k;
      if (fired[t.k] !== undefined) {
        if (!t.multi) return;
        // a repeat that acts later waits in s.pend for its tick (spawn loops would run away otherwise)
        if (tick > s.tick) { s.pend = (s.pend || []).concat([[tick, t.k]]); return; }
        const n = (s.nfire && s.nfire[t.k]) || 0;
        if (n >= 64 || fired[n ? t.k + "." + n : t.k] === tick) return;   // a cap; the same tick twice is one firing
        cow("nfire"); s.nfire[t.k] = n + 1; key = t.k + "." + (n + 1);
      }
      fired[key] = tick;
      if (t.target !== undefined) { cow("tgt"); s.tgt[key] = targetDelta(w, s, t); }
      if (t.kind === "stop") for (const u of T.list) if (u.groups.includes(t.group)) for (const uk of keysOf(s, u)) {
        if (fired[uk] === undefined || fired[uk] > tick) continue;
        if (t.smode === 1) { if (!(s.paused && s.paused[uk] !== undefined)) { cow("paused"); s.paused[uk] = tick; } }
        else if (t.smode === 2) { if (s.paused && s.paused[uk] !== undefined) { cow("psum"); s.psum[uk] = (s.psum[uk] || 0) + tick - s.paused[uk]; cow("paused"); delete s.paused[uk]; } }
        else { cow("stopped"); if (s.stopped[uk] === undefined) s.stopped[uk] = tick; }
      }
      if (t.kind === "spawn") for (const u of T.byGroup.get(t.group) || []) fire(u, tick + t.delay, (depth || 0) + 1);
    };
    // repeats whose tick has come
    if (s.pend && s.pend.length && s.pend.some(p => p[0] <= s.tick)) {
      const due = s.pend.filter(p => p[0] <= s.tick).sort((a, b) => a[0] - b[0]);
      s.pend = s.pend.filter(p => p[0] > s.tick);
      for (const d of due) fire(T.list[d[1]], s.tick);
    }
    // a trigger in a group a toggle switched off does not fire when passed or touched
    const offT = t => !!(s.off && t.groups.some(g => s.off[g]));
    while ((s.tp || 0) < T.byX.length && T.byX[s.tp || 0].x <= s.x) { const t = T.byX[s.tp || 0]; if (!offT(t)) fire(t, s.tick); s.tp = (s.tp || 0) + 1; }
    if (T.touch.length) {
      const k = halfOf(s);
      for (const t of T.touch) if ((!s.fired || s.fired[t.k] === undefined) && !offT(t) && Math.abs(t.x - s.x) < t.hw + k && Math.abs(t.y - s.y) < t.hh + k) fire(t, s.tick);
    }
    if (fired) s.fired = fired;
    // lock-to-player moves: where the player was when it started, and when its time ran out
    if (s.fired && T.lock) for (const t of T.lock) {
      const f = s.fired[t.k];
      if (f === undefined || f > s.tick) continue;
      const L = s.lockAt && s.lockAt[t.k];
      const over = s.tick - f >= t.dur || (s.stopped && s.stopped[t.k] !== undefined);
      if (!L || (over && L.length < 4)) {
        s.lockAt = Object.assign({}, s.lockAt);
        s.lockAt[t.k] = L ? [L[0], L[1], s.x, s.y] : (over ? [s.x, s.y, s.x, s.y] : [s.x, s.y]);
      }
    }
    // follows: where the followed group was when it started, and when its time ran out
    if (s.fired && T.follow) for (const t of T.follow) for (const k of keysOf(s, t)) {
      const f = s.fired[k];
      if (f === undefined || f > s.tick) continue;
      const F = s.fol && s.fol[k];
      const over = s.tick - f >= t.dur || (s.stopped && s.stopped[k] !== undefined);
      if (!F || (over && F.length < 4)) {
        const cur = groupOffset(w, s, t.fgroup);
        cow("fol"); s.fol[k] = F ? [F[0], F[1], cur[0], cur[1]] : (over ? [cur[0], cur[1], cur[0], cur[1]] : [cur[0], cur[1]]);
      }
    }
    // toggles act when their tick comes (a spawned one may wait for a delay); a level with no toggle skips the walk
    // over every fired trigger (a decorated level fires hundreds: it was ~10% of a window measure)
    if (T.hasToggle === undefined) T.hasToggle = T.list.some(t => t.kind === "toggle");
    if (s.fired && T.hasToggle) for (const k in s.fired) {
      const t = trigOf(w, k);
      if (t.kind === "toggle" && s.fired[k] <= s.tick && !(s.offDone && s.offDone[k])) {
        s.off = Object.assign({}, s.off); s.off[t.group] = !t.on;
        s.offDone = Object.assign({}, s.offDone); s.offDone[k] = true;
      }
    }
  }
  // how far through its action a firing (key k) is (null: not started); a stop freezes it, a pause holds it
  // until a resume (the time paused does not count)
  function progress(s, t, k) {
    if (k === undefined) k = t.k;
    const f = s.fired && s.fired[k];
    if (f === undefined || f > s.tick) return null;
    let now = s.tick;
    if (s.stopped && s.stopped[k] !== undefined) now = Math.min(now, s.stopped[k]);
    if (s.paused && s.paused[k] !== undefined) now = Math.min(now, s.paused[k]);
    const el = now - f - ((s.psum && s.psum[k]) || 0);
    return t.dur > 0 ? ease(t.ease, t.rate, el / t.dur) : 1;
  }
  // where a group is now: the sum of the moves (and follows) on it that have started
  function groupOffset(w, s, g, depth) {
    let dx = 0, dy = 0;
    if (s.fired) for (const k in s.fired) {
      const t = trigOf(w, k);
      if (t.group !== g) continue;
      if (t.kind === "follow") {
        if ((depth || 0) > 4) continue;
        const F = s.fol && s.fol[k];
        if (!F) continue;
        const cur = F.length > 2 ? [F[2], F[3]] : groupOffset(w, s, t.fgroup, (depth || 0) + 1);
        dx += t.fx * (cur[0] - F[0]); dy += t.fy * (cur[1] - F[1]);
        continue;
      }
      if (t.kind !== "move") continue;
      const e = progress(s, t, k);
      if (e === null) continue;
      const d = t.target !== undefined ? (s.tgt && s.tgt[k]) || [0, 0] : [t.dx, t.dy];
      dx += d[0] * e; dy += d[1] * e;
      if ((t.lockX || t.lockY) && String(k) === String(t.k)) {
        const L = s.lockAt && s.lockAt[t.k];
        if (L) { const ex = L.length > 2 ? L[2] : s.x, ey = L.length > 2 ? L[3] : s.y;
          if (t.lockX) dx += ex - L[0]; if (t.lockY) dy += ey - L[1]; }
      }
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
    if (s.fired && rots) for (const t of rots) for (const key of keysOf(s, t)) {
      const e = progress(s, t, key);
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
  // spread, not Object.assign({}, s): on V8 (node 22) Object.assign into {} of a 20+ field state makes a dictionary-mode
  // object -- 5.8 us a copy and slow field reads in step() -- where a spread keeps the fast shape (64 ns). Every solver,
  // window measure and replay clones states: humanCost spent 45% of its time copying (lib/incsolve.js session, 2026-11-23)
  function clone(s) { const c = { ...s }; c.used = s.used.slice(); return c; }

  // the static objects within 40 units of x. A world's columns never change after makeWorld, so the list for each
  // column span is built once (same order as before) and kept on the world; a copy only where nearDyn appends to it
  function near(w, x) {
    const c0 = Math.floor((x - 40) / 30), c1 = Math.floor((x + 40) / 30);
    const memo = w._near || (w._near = new Map()), key = c0 * 4 + (c1 - c0);
    let out = memo.get(key);
    if (!out) {
      out = []; const seen = new Set();
      for (let c = c0; c <= c1; c++) {
        const l = w.cols.get(c);
        if (l) for (const b of l) if (!seen.has(b)) { seen.add(b); out.push(b); }
      }
      memo.set(key, out);
    }
    return w.dyn && w.dyn.length ? out.slice() : out;
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
  function slopeTop(b, xc, half) {
    const k = half === undefined ? 15 : half;
    if (b.up > 0) { const px = Math.min(xc + k, b.x1); return px < b.x0 ? null : b.y0 + (px - b.x0) * b.rise; }
    const px = Math.max(xc - k, b.x0); return px > b.x1 ? null : b.y0 + (b.x1 - px) * b.rise;
  }

  // a ceiling slope's underside at the lowest point over the player's width
  function slopeBottom(b, xc, half) {
    const k = half === undefined ? 15 : half;
    if (b.down > 0) { const px = Math.min(xc + k, b.x1); return px < b.x0 ? null : b.y1 - (px - b.x0) * b.rise; }
    const px = Math.max(xc - k, b.x0); return px > b.x1 ? null : b.y1 - (b.x1 - px) * b.rise;
  }

  function flip(s) { s.grav = -s.grav; s.vy *= 0.5; s.grounded = false; s.onSlope = false; }

  // spider: jump to the nearest surface on the other side, then gravity points at it
  // GD's own search (PlayerObject::spiderTestJumpInternal, 2.2081, as gdsolver read and measured it on lv22 and
  // custom levels: dp/src/dp/step.hpp spiderTargetGd), frame 0, travelling right:
  //  - SOLIDS in a strip from the player's centre to 14.5 ahead (mini: half + 1); a landing up to 10 behind the
  //    player's own height is still taken; the nearest wins; a solid wholly ahead of the centre only when the player's
  //    box at the landing height meets no other solid of the list (each shrunk 2 top and bottom)
  //  - HAZARDS in a strip of +-4 (mini 2.4) around the centre (a saw by its radius): with no solid in the strip the
  //    solids are asked again over [x - half, x + half + 4]; a hazard nearer than the landing is the landing, and kills
  //  - nothing found: the band's face when a portal set one, else the ground when going down; going up into nothing
  //    with no band: no teleport (gdsolver drops that branch: unmeasured)
  //  - the player rests at the face +- its own half (13.5 spider, 15 cube on a spider orb/pad), gravity flipped,
  //    vy 1.0 the way it went and NOT grounded (GD's dump: onGround 0 on the teleport tick, landing on the next)
  // Before 2026-11-25 this was a guessed +-4.5 strip, landing at +-15, grounded, band ignored: Dash's spider at block 76
  // took a slab edge GD's strip misses and fell into the band's roof instead (gdsolver's real-game plan, tools/tas.js 22).
  function teleport(w, s) {
    const up = s.grav > 0, gs = up ? 1 : -1, ph = halfOf(s), x = s.x, fromY = s.y;
    const sHalf = s.mini ? ph + 1 : 14.5, hzS = s.mini ? 2.4 : 4;
    const bandWall = isFinite(s.ceilY), bLo = s.floorY, bHi = s.ceilY;
    const objs = nearDyn(w, s, near(w, x));
    const strip = [], wide = []; let haz = null;
    const s0 = x, s1 = x + sHalf, w0 = x - ph, w1 = x + ph + 4;
    for (const b of objs) {
      if (b.kind !== "solid" && b.kind !== "slope" && b.kind !== "hazard") continue;
      const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, hw = (b.x1 - b.x0) / 2, hh = (b.y1 - b.y0) / 2;
      const hx = b.kind === "hazard" && b.r > 0 ? b.r : hw, hy = b.kind === "hazard" && b.r > 0 ? b.r : hh;
      if (up ? cy + hy < fromY + ph - 2 : cy - hy > fromY - ph + 2) continue;              // not beyond the player
      if (bandWall && (up ? cy - hy > bHi : cy + hy < bLo)) continue;                      // past the band
      if (b.kind === "hazard") {
        if (cx + hx < x - hzS || cx - hx > x + hzS) continue;
        if (!haz || (cy - haz.cy) * gs < 0) haz = { b, cy };
        continue;
      }
      if (!(b.x1 < s0 || b.x0 > s1)) strip.push(b);
      if (!(b.x1 < w0 || b.x0 > w1)) wide.push(b);
    }
    const faceOf = b => {
      if (b.kind === "slope" && !!b.ceil === up) {                                         // a ramp facing the search: its line
        const lo = b.ceil ? (b.down > 0 ? b.y1 : b.y0) : (b.up > 0 ? b.y0 : b.y1), hi = b.ceil ? (b.down > 0 ? b.y0 : b.y1) : (b.up > 0 ? b.y1 : b.y0);
        return lo + (hi - lo) * (x - b.x0) / (b.x1 - b.x0);
      }
      return up ? b.y0 : b.y1;
    };
    const pick = L => {
      let y = null, solid = false;
      for (const b of L) {
        const rest = faceOf(b) - gs * ph;
        if ((rest - fromY) * gs < -10) continue;
        if (y !== null && (rest - fromY) * gs >= (y - fromY) * gs) continue;
        if (b.x0 > x && L.some(o => o !== b && !(x + ph < o.x0 || o.x1 < x - ph || rest + ph < o.y0 + 2 || o.y1 - 2 < rest - ph))) continue;
        y = rest; solid = true;
      }
      if (y === null && !up && !bandWall) { const rest = ph; if (fromY - rest > 0.5) y = rest; }
      if (y === null && bandWall) y = up ? bHi - ph : bLo + ph;
      return { y, solid };
    };
    const nearer = y => haz && (y === null || (haz.cy - y) * gs < 0);
    let r, onHaz = false;
    if (!strip.length && haz) { if (!wide.length) onHaz = true; else { r = pick(wide); onHaz = nearer(r.y); } }
    else { r = pick(strip); if (nearer(r.y)) { const r2 = wide.length ? pick(wide) : null; if (!r2 || nearer(r2.y)) onHaz = true; else r = r2; } }
    if (onHaz) { s.y = haz.cy; s.dead = true; s.why = "spider teleport onto a hazard"; s.killer = haz.b.o; return; }
    if (!r || r.y === null) return;   // nothing to land on (unmeasured: gdsolver drops the branch)
    s.y = r.y; s.grav = -s.grav; s.vy = gs; s.grounded = false; s.onSlope = false;
  }

  function useOrb(w, s, b) { s.lb = 0;
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
    else if (d.act === "blue") { s.vy = s.grav * sp.yStart * mul * mf; flip(s); s.lflip = true; s.vy *= post; }
    else if (d.act === "green") { flip(s); s.lflip = true; s.vy = s.grav * sp.yStart * (ship ? mul : 1) * post * mf; }
    else if (d.act === "black") s.vy = -(ship ? 14 : C.MAX_FALL) * s.grav;
    else if (d.act === "dash") { if (d.flip) { flip(s); s.lflip = true; } s.dashing = true; s.dashAngle = (b.o.rot || 0) * Math.PI / 180; s.vy = 0; }
    else if (d.act === "spider") teleport(w, s);
  }
  const padRoll = s => (s.mode === "ball" || s.mode === "spider" || s.mode === "swing" ? 0.6 : 1);
  function usePad(w, s, b) {
    const d = b.d;
    if (d.act === "blue") {
      // which way it faces: upright, turned half a turn, or flipped (key 5) to hang from a ceiling
      const fy = !!b.o.flipY, facingUp = (b.q === 0 && !fy) || (b.q === 2 && fy), facingDown = (b.q === 2 && !fy) || (b.q === 0 && fy);
      if (!((facingUp && s.grav === 1) || (facingDown && s.grav === -1))) return;
      s.used.push(b.i); s.act = d.name; s.vy = s.grav * C.PAD * d.bump * MF(s); flip(s); s.lflip = true; s.vy *= padRoll(s); return;
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
  // getGroundHeightForMode and checked on 18 portals). A portal of the mode you are in does nothing -- band included: gdsolver injected a wave player at y 600 after lv20's second wave portal (x 4445) in GD and got it back at the FIRST portal's ceiling, 380 at three x (constants.hpp kWaveClamp). A view that seems to move there (GDLM 68, 56.3 s) is the camera, not the band.
  // Entering or leaving a flying mode halves vertical speed.
  const FLY = { ship: 1, ufo: 1, wave: 1, swing: 1 };
  const BAND = { ship: 300, ufo: 300, wave: 300, swing: 300, ball: 240, spider: 270 };
  function enterMode(s, b) {
    const to = b.d.mode;
    if (to === s.mode) return;
    if (C.SIMULATED_MODES.indexOf(to) < 0) { s.dead = true; s.why = to + " mode is not simulated yet"; s.killer = b.o; return; }
    if (!!FLY[s.mode] !== !!FLY[to]) s.vy *= 0.5;
    s.mode = to; s.grounded = false; s.onSlope = false; s.act = b.d.name; s.og = false; s.swingPend = false;
    s.modeIn = true; s.portalY = b.o.y;   // for dual (lib/dual.js)
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
    if (to !== s.grav) { flip(s); s.lflip = true; s.act = b.d.name; }
  }

  // One physics step. inp = {press, held}: press = the button went down this step.
  // A level with dual portals goes through lib/dual.js, which steps each player with stepOne.
  const DUAL_API = { flip: s => flip(s), BAND: null };
  function step(w, s, inp) {
    if (!w.hasDual) return stepOne(w, s, inp);
    DUAL_API.BAND = BAND;
    return D.dualStep(w, s, inp, stepOne, DUAL_API);
  }
  function stepOne(w, s, inp) {
    if (s.dead || s.done) return s;
    // a cube that landed on the ground last tick cannot jump this tick (EXP_LW above)
    const freshLand = EXP_LW && s.grounded && !s.wasG && (EXP_LW === "all" || Math.abs(s.y - (s.grav === 1 ? 15 : -1e9)) < 1e-6);
    s.wasG = s.grounded;
    const sp = SPEEDS[s.sp], h = halfOf(s), m = s.mode;
    s.act = "";
    // GD: a press arms both the jump buffer and the orb flag. The buffer stays armed while held
    // (a held cube jumps again on every landing); the orb flag (s.ring) is used up by an orb, a
    // pad, a jump, a ball tap, a UFO flap...: the modes other than cube need a fresh press.
    if (inp.press) { s.ring = true; s.robotLet = false; }
    s.buffered = !!inp.held;
    let lbPrev = 0;   // GD: the button's level on the previous tick (m_jumpBuffered read again in the physics)
    if (LB_GD) { lbPrev = s.lb || 0; s.lb = m === "cube" && inp.held ? 1 : 0; }
    else if (LANDBUF) { if (m !== "cube") s.lb = 0; else if (inp.press && !s.grounded) s.lb = s.vy * s.grav <= 0 ? LANDBUF : LANDRISE; else if (s.lb > 0 && s.lb !== Infinity) s.lb--; }
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
    if (m === "cube" && !freshLand && (s.grounded || coyote) && (s.buffered || (LB_GD ? lbPrev > 0 : s.lb > 0))) { s.lb = 0; s.vy = s.grav * sp.yStart * MF(s); s.grounded = false; s.onSlope = false; s.ring = false; s.act = "jump"; }
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
    // a wave that slid along a block last tick (see the wave branch below)
    const slid = m === "wave" && s.waveOn; s.waveOn = false;

    if (BAND[m] || s.dualBand) {
      // the band's floor and roof (in dual every mode has them: lib/dual.js) are safe to slide on (the wave's centre stays 10 off them)
      const k = m === "wave" ? (s.mini ? 6 : C.WAVE_CLAMP) : h;
      if (s.y - k <= s.floorY) { s.y = s.floorY + k; if (s.vy < 0) s.vy = 0; s.grounded = s.grav === 1; }
      if (s.y + k >= s.ceilY) { s.y = s.ceilY - k; if (s.vy > 0) s.vy = 0; s.grounded = s.grav === -1; }
    }
    // the ground
    else if (s.y - h <= 0) { s.y = h; if (s.grav === 1) { s.vy = Math.max(s.vy, 0); s.grounded = s.vy === 0; } else s.vy = Math.max(s.vy, 0); }

    const feet = () => (s.grav === 1 ? s.y - h : s.y + h);
    // a wave meeting a slope face: it slides when it comes in at a glancing angle (45 degrees onto
    // flat ground or a block top: seen) and dies head-on (down into a rising 45-degree slope, 90
    // degrees: the user's GDLM 44 zigzag, 2026-11-23_03-11-47.mkv ~25 s). The cut between 45 and 90
    // is not measured: 67.5. surf = the face's dy/dx; ceil = the face is above the wave.
    const waveHeadOn = (surf, ceil) => {
      const k = Math.sign(s.vy) * (s.mini ? 2 : 1);
      const a = (ceil ? Math.atan(k) - Math.atan(surf) : Math.atan(surf) - Math.atan(k)) * 180 / Math.PI;
      return a > 67.5;
    };
    for (const b of objs) {
      if (b.kind === "solid" && m === "wave") {
        // the wave dies only when its tiny kill box enters a block; it slides along faces
        const i = C.WAVE_KILL;
        if (!b.oneway && ov(s.x - i, s.x + i, s.y - i, s.y + i, b)) { s.dead = true; s.why = "block"; s.killer = b.o; continue; }
        if (!touching(s, b)) continue;
        // sliding off a block's end kills: once the wave's centre is past the face it slid on, its
        // box still on the corner is a hit, not a landing (the user's GDLM 44 runs, 2026-11-23: two of
        // two deaths exactly as the centre passed the block's top-right corner; PHYSICS.md "Wave")
        // (a seam to the next block of the same face is not an end)
        if (slid && !b.oneway && (s.x > b.x1 || s.x < b.x0) && !objs.some(c => c !== b && c.kind === "solid" &&
            c.x0 <= s.x && s.x <= c.x1 && (Math.abs(c.y1 - b.y1) < 0.5 || Math.abs(c.y0 - b.y0) < 0.5))) {
          s.dead = true; s.why = "block edge"; s.killer = b.o; continue;
        }
        if (s.vy <= 0 && s.y >= b.y1) { s.y = b.y1 + h; s.vy = 0; s.grounded = s.grav === 1; s.waveOn = true; }
        else if (s.vy >= 0 && s.y <= b.y0) { s.y = b.y0 - h; s.vy = 0; s.grounded = s.grav === -1; s.waveOn = true; }
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
        if (m === "wave" && s.vy > 0) {
          const d = slopeBottom(b, s.x + 1, 0), d0 = slopeBottom(b, s.x, 0);
          if (d !== null && d0 !== null && waveHeadOn(d - d0, true)) {
            // head-on: no sliding; it dies once its kill box is in (grazing a V's tip is survived:
            // Blast Processing's plan, block 166)
            const ki = slopeBottom(b, s.x, C.WAVE_KILL);
            if (ki !== null && s.y + C.WAVE_KILL > ki) { s.dead = true; s.why = "slope"; s.killer = b.o; }
            continue;
          }
        }
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
        if (m === "wave" && s.vy < 0) {
          const u = slopeTop(b, s.x + 1, 0), u0 = slopeTop(b, s.x, 0);
          if (u !== null && u0 !== null && waveHeadOn(u - u0, false)) {
            const ki = slopeTop(b, s.x, C.WAVE_KILL);
            if (ki !== null && s.y - C.WAVE_KILL < ki) { s.dead = true; s.why = "slope"; s.killer = b.o; }
            continue;
          }
        }
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
        // a turned portal: the exit is key 54 along the portal's own turned axis; only its height is
        // used (Deadlocked's portals at -53/-90 degrees; UNCHECKED whether GD also moves x)
        // a portal turned a quarter (90, -90, 270) moves the full key 54 straight up/down, like an
        // unturned one -- cos would make it a no-op (Deadlocked's ball part, 13245-14771: the full offset
        // gets the sweep 80+ blocks on, neither "no move" nor "x moves by 54" passes; "angle mod 90" fits too)
        const off = +(b.o.props && b.o.props["54"]) || 0, deg = b.o.rot || 0;
        const rr = (b.o.props && b.o.props["55"] === "1") || Math.abs(deg) % 180 === 90 ? 0 : deg * Math.PI / 180;
        s.y = b.o.y + off * Math.cos(rr) + (b.my || 0); s.grounded = false; s.onSlope = false; s.act = b.d.name; } }
      else if (b.kind === "dual") { if (touching(s, b)) { s.used.push(b.i); s.dualReq = b.d.dual ? 1 : -1; s.portalY = b.o.y; } }
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

  // a heavy job may be asked to give its slot back (tools/heavy.js: pause / yield); the solver and every replay offer it
  // here: a pause waits in place and goes on with nothing lost. In the browser there is no globalThis.gdlmYield.
  const yieldNow = () => { const f = typeof globalThis !== "undefined" && globalThis.gdlmYield; if (f) f(); };
  const NONE = { press: false, held: false };
  function idle(s) { return s.dashing ? { press: false, held: true } : NONE; }
  const PRESS = { press: true, held: true };
  const RELEASE = { press: false, held: false };

  // Replay input events: [{tick, type: "press"|"release"}]; a plain number = a tap at that tick.
  function run(w, events) {
    yieldNow();
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
                      s.grounded ? 1 : 0, s.lb > 0 ? s.lb : 0, s.used.filter(i => w.objects[i].x > s.x - 40).join("."), D.dualKey(s.p2)].join(":");
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
        if ((states & 4095) === 0) yieldNow();
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
    // states merged by y to 1 unit and vy to 0.5 a tick (opts.fine: y to 1/4, vy to 0.05), and by the objects used
    // that are not yet behind: an object stays in the key until the player is 40 units past its RIGHT EDGE. It was 40
    // past its centre, but a portal's skip is counted only 15 past its right edge: for a wide portal (Electroman's flat
    // gravity portal at block 804, 75 wide) a route that took it and one that did not merged in between, the merge
    // could keep the one that did not, and the no-skip rule then dropped it: every way through was lost
    // (2026-11-24; tools/stuck.js --sweeps found it)
    const FY = opts.fine ? 4 : 1, FV = opts.fine ? 20 : 2;
    if (!w.usedX1) { w.usedX1 = w.objects.map(o => o.x); for (const b of w.items) if (b.i != null && b.x1 > w.usedX1[b.i]) w.usedX1[b.i] = b.x1; }
    const fkey = (s, held) => [Math.round(s.y * FY), Math.round(s.vy * FV), s.grav, s.mode, s.sp, s.dashing ? 1 : 0,
      s.grounded ? 1 : 0, held ? 1 : 0, s.ring ? 1 : 0, s.swingPend ? 1 : 0, s.lb > 0 ? s.lb : 0, s.used.filter(i => w.usedX1[i] > s.x - 40).join("."), D.dualKey(s.p2)].join(":");
    // opts.start: solve the rest of the level from this state (opts.held: the button is down there)
    const s0 = opts.start ? clone(opts.start) : startState(w), T0 = s0.tick || 0, held0 = !!opts.held;
    // The intended route, not just the fewest presses (the user on a Deadlocked map: "the player skips
    // the portal ... in normal levels you usually dont skip portals"). Ranked in order: portals (mode,
    // gravity, speed, size, teleport) passed without taking them, then orbs and pads passed unused,
    // then presses. opts.anyRoute: presses only, as before.
    const route = !opts.anyRoute;
    if (route && !w.routeP) {
      const by = kinds => w.items.filter(b => kinds.includes(b.kind)).sort((a, b) => a.x1 - b.x1);
      w.routeP = by(["mode", "gravity", "speed", "size", "teleport", "dual"]); w.routeO = by(["orb", "pad"]);
      // portals of the same effect stacked at one x (a column of two gravity portals so any height takes
      // one) are one requirement: skipping counts only when the player passes the last of them having
      // taken none. g[k] = index of the group's last member in routeP.
      const eff = b => b.kind + ":" + (b.d.mode || "") + ":" + (b.d.grav != null ? b.d.grav : "") + ":" + (b.d.speed != null ? b.d.speed : b.d.name);
      const P = w.routeP, cx = b => (b.x0 + b.x1) / 2;
      w.routeGroup = P.map((b, k) => P.filter(c => eff(c) === eff(b) && Math.abs(cx(c) - cx(b)) < 30).map(c => P.indexOf(c)));
    }
    // then, in flying modes, ticks spent within NEAR units of a wall (solid, hazard, slope or the
    // band's floor/roof): the user on the same map, "he waves way too close to the border"
    const NEAR = 12, NEAR_MAX = 45;
    const hug = st => {
      if (!FLY[st.mode] && st.mode !== "wave") return 0;   // returns 100000 (very near) or 1 (near): hg = 100000 x very + near
      let lo = isFinite(st.floorY) ? st.floorY : 0, hi = isFinite(st.ceilY) ? st.ceilY : Infinity;
      for (const b of nearDyn(w, st, near(w, st.x))) {
        if (b.kind !== "solid" && b.kind !== "hazard" && b.kind !== "slope") continue;
        if (b.x1 < st.x - 6 || b.x0 > st.x + 6) continue;
        if (b.y1 <= st.y && b.y1 > lo) lo = b.y1; else if (b.y0 >= st.y && b.y0 < hi) hi = b.y0;
      }
      // near = closer than half the room to the middle (capped at 1.5 blocks): Jumper's ship kept
      // 12-15 units off spike rows with 150-210 of room under a flat 12-unit rule (visuals, 2026-11-23)
      const h = halfOf(st), c = Math.min(st.y - lo, hi - st.y) - h, room = (hi - lo) / 2 - h;
      // two tiers, ranked in this order: within NEAR (12) of a wall, then within the room-scaled
      // distance (one count alone traded a few very close passes for fewer moderate ones)
      // the wave only moves at 45 degrees: holding the middle half of a flat corridor made a run of
      // 3-frame zigzags (Deadlocked map, 14.6 s); it keeps the middle 70% instead, longer legs
      const share = st.mode === "wave" ? 0.3 : 0.5;
      return c < NEAR ? 100000 : c < Math.min(NEAR_MAX, Math.max(NEAR, room * share)) ? 1 : 0;
    };
    // THE USER'S RULE (2026-11-23, firm): "we need to stop accepting those secret ways by the solvers.
    // especially in official levels. if the solver skips something, its 99% wrong." A route that passes a
    // portal (mode, gravity, speed, size, teleport) without taking it is dropped, not ranked: the solve
    // reports where it got stuck ("skipped <portal> at x"). opts.allowSkips: the old ranking (debugging).
    const strict = route && !opts.allowSkips;
    // fewest skipped portals first; orbs/pads skipped (so) are only counted, never ranked: an orb may be a decoy
    // and taking it is not the level's requirement (the user, 2026-11-24)
    const better = (a, b) => a.sp !== b.sp ? a.sp < b.sp : a.hg !== b.hg ? a.hg < b.hg : a.cost < b.cost;
    // "would this portal change nothing" is judged on the state crossing the portal's CENTRE, as skipCheck judges it;
    // judged 15 past its right edge instead, a ball flipping gravity in Electroman's lower lane (block 804) had normal
    // gravity there, its untaken normal-gravity portal counted as no change, it won the sweep and the final skipCheck
    // (gravity flipped at the centre) then rejected the whole solve (2026-11-24)
    if (route && !w.routeC) { const cx = b => (b.x0 + b.x1) / 2; w.routeC = w.routeP.map((b, k) => k).sort((a, b) => cx(w.routeP[a]) - cx(w.routeP[b])); }
    const skips = (n, st) => {  // advance the node's pointers past what the player has now passed
      let { pi, oi, sp, so, ci = 0, ne = null } = n, skippedAt = n.skippedAt || null;
      while (ci < w.routeC.length && (w.routeP[w.routeC[ci]].x0 + w.routeP[w.routeC[ci]].x1) / 2 <= st.x) {
        const k = w.routeC[ci]; if (noEffect(w.routeP[k], st)) { ne = ne ? new Set(ne) : new Set(); ne.add(k); } ci++;
      }
      while (pi < w.routeP.length && w.routeP[pi].x1 < st.x - 15) {
        const grp = w.routeGroup[pi];
        if (pi === Math.max(...grp) && reach[pi] <= REACH && !(ne && ne.has(pi)) && !grp.some(k => usedIn(st, w.routeP[k].i))) { sp++; skippedAt = w.routeP[pi]; }
        pi++;
      }
      while (oi < w.routeO.length && w.routeO[oi].x1 < st.x - 15) { if (!usedIn(st, w.routeO[oi].i)) so++; oi++; }
      return { pi, oi, sp, so, skippedAt, ci, ne };
    };
    // reach[k]: the nearest any search state came to portal k (see the loop below); here because skips()
    // reads it from the very first node (solveFrom starts past portals: it threw before, 2026-11-23)
    const REACH = 60, reach = route ? w.routeP.map(() => Infinity) : [];
    let front = [{ s: s0, cost: 0, held: held0, parent: null, pi: 0, oi: 0, sp: 0, so: 0, hg: 0 }];
    if (route) Object.assign(front[0], skips(front[0], s0), { sp: 0, so: 0 });
    const eventsOf = (node, lastHeld) => {
      const helds = [];
      for (let n = node; n.parent; n = n.parent) helds.push(n.held);
      helds.reverse();
      const ev = []; let prev = held0;
      helds.forEach((h, i) => { const t = T0 + i; if (h && !prev) ev.push({ tick: t, type: "press" }); if (!h && prev) ev.push({ tick: t, type: "release" }); prev = h; });
      return ev;
    };
    // opts.onCheckpoint(events, state, held): every opts.checkpointSecs (default 30) seconds, the best
    // route so far (events from T0, the state it has reached), so a long solve that is stopped can
    // carry on from there (tools/difficulty_solve.js writes it to local/difficulty/NN.part.json)
    const CK = (opts.checkpointSecs || 30) * 1000; let ckAt = Date.now() + CK;
    let far = null, won = null, peak = 0;
    // A portal no state of the search ever came within REACH units of (a decorative one far above the play,
    // ClockWood's ball portal at y 675, Spooky Dash's teleport at y 1605) is not a requirement; one the search
    // got near and still never took is (the no-skip rule: stuck there). reach[k]: the nearest any state came
    // to portal k's group while approaching it.
    const boxGap = (st, b) => Math.max(0, b.x0 - (st.x + 15), (st.x - 15) - b.x1, b.y0 - (st.y + 15), (st.y - 15) - b.y1);
    for (let t = T0; t < maxTicks && front.length && !won; t++) {
      if (route) for (let k = 0; k < w.routeP.length; k++) {
        const b = w.routeP[k], fx = front[0].s.x;
        if (fx < b.x0 - 90 || fx > b.x1 + 20) continue;
        let m = reach[k];
        for (const n of front) { const d = n.s.p2 ? Math.min(boxGap(n.s, b), boxGap({ x: n.s.x, y: n.s.p2.y }, b)) : boxGap(n.s, b); if (d < m) m = d; if (m === 0) break; }
        for (const g of w.routeGroup[k]) reach[g] = Math.min(reach[g], m);
      }
      if (opts.onCheckpoint && Date.now() >= ckAt && front.length) {
        ckAt = Date.now() + CK;
        const b = front.reduce((m, n) => (better(n, m) ? n : m));
        opts.onCheckpoint(eventsOf(b), clone(b.s), b.held);
      }
      const next = new Map();
      for (const n of front) {
        const choices = t % K === 0 ? [false, true] : [n.held];
        for (const held of choices) {
          const press = held && !n.held;
          const st = clone(n.s);
          step(w, st, { press, held });
          if (st.dead) { if (!far || st.x > far.s.x) far = { s: st, parent: n, held }; continue; }
          const node = { s: st, cost: n.cost + (press ? 1 : 0), held, parent: n, pi: n.pi, oi: n.oi, sp: n.sp, so: n.so, hg: n.hg, ci: n.ci, ne: n.ne };
          if (route) { Object.assign(node, skips(n, st)); node.hg += hug(st); }
          // opts.strict: a route that skips a portal is out (to find where the intended route dies)
          if ((strict || opts.strict) && node.sp > 0) {
            const sk = node.skippedAt;
            if (!far || st.x > far.s.x) far = { s: Object.assign(clone(st), { why: "skipped a portal", killer: sk ? sk.o : null, skipped: sk ? sk.d.name + " at x " + Math.round((sk.x0 + sk.x1) / 2) : "a portal" }), parent: n, held };
            continue;
          }
          if (st.done) { if (!won || better(node, won)) won = node; continue; }
          // opts.goal(state, held): this state rejoins a known route (lib/incsolve.js: the old route's exact
          // state at this tick), so the search ends here as won; the result's goalTick says where
          if (opts.goal && opts.goal(st, held)) { node.goal = st.tick; if (!won || better(node, won)) won = node; continue; }
          const k = fkey(st, held), old = next.get(k);
          if (!old || better(node, old)) next.set(k, node);
        }
      }
      front = [...next.values()];
      if (front.length > CAP) { front.sort((a, b) => better(a, b) ? -1 : better(b, a) ? 1 : 0); front.length = CAP; }
      if (opts.trace) opts.trace(t, front);   // debugging (tools/stuck.js --trace): the front after each tick
      peak = Math.max(peak, front.length);
    }
    if (!won) {
      const tr = far ? eventsOf({ s: far.s, held: far.held, parent: far.parent }) : [];
      return { ok: false, clicks: [], trail: tr, dieAt: far && far.s, why: far && far.s.why, killer: far && far.s.killer, skipped: far && far.s.skipped, peak, sweep: true };
    }
    const events = eventsOf(won);
    // label each press with what it did, from a replay
    let path;
    if (!opts.start) path = run(w, events).path;
    else { // replay from the start state; path[t] by absolute tick
      path = []; const st = clone(s0), evm = new Map(events.map(e => [e.tick, e.type])); let h = held0;
      path[st.tick] = clone(st);
      while (!st.dead && !st.done && st.tick < maxTicks && !(won.goal != null && st.tick >= won.goal)) { const e = evm.get(st.tick); const press = e === "press";
        if (e) h = press; step(w, st, { press, held: h }); path[st.tick] = clone(st); }
    }
    const clicks = events.map(e => ({ type: e.type, tick: e.tick, lo: e.tick, hi: e.tick, ms: 0, x: path[e.tick].x,
      act: e.type === "press" ? (path[Math.min(e.tick + 1, path.length - 1)].act || "hold") : "release" }));
    // portals every route could reach and this one passed untaken: stuck there (the user's no-skip rule; under strict)
    if (strict) { const far = new Set(w.routeP.filter((b, k) => reach[k] > REACH).map(b => b.i));
      const sk = skipCheck(w, path, events, far); if (sk) return Object.assign(sk, { peak, sweep: true }); }
    const outOfReach = route ? w.routeP.filter((b, k) => reach[k] > REACH && b.x1 < (path[path.length - 1] || {}).x).map(b => b.d.name + " at x " + Math.round((b.x0 + b.x1) / 2) + " y " + Math.round((b.y0 + b.y1) / 2)) : [];
    return { ok: true, clicks, events, peak, sweep: true, goalTick: won.goal, skipped: route ? { portals: won.sp, orbs: won.so } : undefined, outOfReach };
  }

  // a portal that would change nothing for this player (a ship portal while a ship, a speed portal at that
  // speed, a gravity portal pointing the way gravity already points, the size it already is) is not a
  // requirement: passing it untouched is no secret way (Stereo Madness's second ship portal inside a ship)
  const usedIn = (st, i) => st.used.includes(i) || !!(st.p2 && st.p2.used.includes(i));
  function noEffect(b, st) {
    if (!st) return false;
    if (b.kind === "mode") return b.d.mode === st.mode;
    if (b.kind === "speed") return b.d.speed === st.sp;
    if (b.kind === "gravity") return b.d.grav !== 0 && b.d.grav === st.grav;
    if (b.kind === "size") return !!b.d.mini === !!st.mini;
    if (b.kind === "dual") return !!b.d.dual === !!st.p2;
    return false;
  }

  // The user's no-skip rule on a finished route (path by tick): a portal group passed with none of it taken
  // (PHYSICS.md "No secret ways"). Returns a stuck result, or null when the route is clean. Orbs, pads and dash
  // orbs are NOT requirements (the user, 2026-11-24: "skipping an orb or a dash is not bad, sometimes they are
  // actually fake and should be avoided. Unlike portals or whole paths"); opts.orbs: true also reports an orb/pad
  // the player's box came within NEARBY units of and left unused (a warning for level design, not a failure).
  // ignore: object indices that are not requirements (portals the sweep found out of reach); without it every
  // portal the route passes untaken counts (solveAny then hands the level to the sweep, which knows reach)
  function skipCheck(w, path, events, ignore, opts) {
    const by = kinds => w.items.filter(b => kinds.includes(b.kind)).sort((a, b) => a.x1 - b.x1);
    const P = by(["mode", "gravity", "speed", "size", "teleport", "dual"]), O = by(["orb", "pad"]);
    // step() keeps s.used to objects near the player, so what a run fired is the union over its whole path
    // (difficulty session, 2026-11-23: end.used alone had lost almost every portal and orb)
    const ps0 = path.filter(Boolean), end = ps0[ps0.length - 1], usedAll = new Set();
    for (const p of ps0) { for (const i of p.used) usedAll.add(i); if (p.p2) for (const i of p.p2.used) usedAll.add(i); }
    const stuck = (b, why) => { const at = ps0.find(p => p.x >= (b.x0 + b.x1) / 2) || end;
      return { ok: false, clicks: [], trail: events.filter(e => e.tick <= at.tick), dieAt: at, why, killer: b.o, skipped: b.d.name + " at x " + Math.round((b.x0 + b.x1) / 2) }; };
    const eff = b => b.kind + ":" + (b.d.mode || "") + ":" + (b.d.grav != null ? b.d.grav : "") + ":" + (b.d.speed != null ? b.d.speed : b.d.name), cx = b => (b.x0 + b.x1) / 2;
    for (const b of P) {
      if (!end || end.x < b.x1 + 15 || usedAll.has(b.i) || (ignore && ignore.has(b.i))) continue;
      if (P.some(c => c !== b && eff(c) === eff(b) && Math.abs(cx(c) - cx(b)) < 30 && usedAll.has(c.i))) continue;
      if (noEffect(b, ps0.find(p => p.x >= cx(b)))) continue;
      return stuck(b, "skipped a portal");
    }
    if (!(opts && opts.orbs)) return null;
    const NEARBY = 15, h = 15;
    for (const b of O) {
      if (usedAll.has(b.i)) continue;
      const close = ps0.some(p => p.x >= b.x0 - 30 && p.x <= b.x1 + 30 && p.x + h > b.x0 - NEARBY && p.x - h < b.x1 + NEARBY && p.y + h > b.y0 - NEARBY && p.y - h < b.y1 + NEARBY);
      if (close && !decoy(w, ps0, b)) return stuck(b, "skipped an orb/pad");
    }
    return null;
  }

  // A decoy orb or pad: taking it kills, whatever you press after (Hexagon Force's yellow orb at block 553.7 sends
  // the cube into the ceiling spikes, every way; the routes through take 551.5 -> 556.0 or 558.4 instead). The level
  // does not "clearly mean you to take" it, so passing it is no secret way. Checked by an exhaustive held/not-held
  // search from a block before it: decoy when no state that took it gets DECOY_PAST units past it. Runs only for an
  // orb the route left unused beside it (rare), ~1k states over ~100 ticks.
  const DECOY_PAST = 90;
  function decoy(w, ps0, b) {
    const i0 = ps0.findIndex(p => p.x >= b.x0 - 45);
    if (i0 < 0) return false;
    const start = ps0[Math.max(0, i0 - 1)], goal = b.x1 + DECOY_PAST;
    let front = [{ s: clone(start), h: false, took: false }], n = 0;
    while (front.length && n++ < 2000) {
      const nx = new Map();
      for (const f of front) for (const h of [false, true]) {
        const r = step(w, clone(f.s), { press: h && !f.h, held: h });
        if (r.dead) continue;
        const took = f.took || usedIn(r, b.i);
        if (took && r.x >= goal) return false;            // a way on after taking it: a real requirement
        if (!took && r.x > b.x1 + 30) continue;           // past it untaken: no longer a candidate
        const key = [Math.round(r.y * 2), Math.round(r.vy * 4), r.grav, r.mode, h ? 1 : 0, r.grounded ? 1 : 0, took ? 1 : 0].join(",");
        if (!nx.has(key)) nx.set(key, { s: r, h, took });
      }
      front = [...nx.values()];
      if (front.length > 20000) return false;             // too big to tell: keep the requirement
    }
    return true;
  }

  // Cube-only levels use the exact solver (it also gives timing windows); anything else, or a
  // level too big for it, uses the sweep.
  function solveAny(w, opts) {
    const modes = w.hasDual || w.items.some(b => b.kind === "mode" && b.d.mode !== "cube");
    if (!modes) {
      // the exact solver only counts presses: its route may skip a portal or orb (a secret way); then the
      // ranked sweep, which takes them when any route can, decides
      try { const r = solve(w, Object.assign({ maxStates: 3000000 }, opts));
        if (r.ok && firmUp(w, r) && ((opts && opts.allowSkips) || !skipCheck(w, run(w, r.events).path, r.events))) return r; } catch (e) { /* too big: sweep */ }
    }
    return solveSweep(w, opts);
  }

  // solve() merges near-twin states (y to 0.5, vy to 0.25) to stay fast, so a click's window can
  // hold ticks that only a twin survives (the difficulty session's triple spike + orb: window
  // 429-450, real 440-450, the picked 439 died). Replay every tick of every window with the rest
  // of the plan; keep the run of ticks that really clear, the click in its middle. False if a
  // click has none (then solveAny falls back to the sweep, an exact replay).
  function firmUp(w, r) {
    const ev = r.events;
    const clears = list => { const q = run(w, list); return q.done || (!q.dead && q.end && q.end.x >= w.endX); };
    for (const c of r.clicks) {
      const i = ev.findIndex(e => e.tick === c.tick && e.type === c.type);
      if (i < 0) continue;
      const auto = c.type === "press" && ev[i + 1] && ev[i + 1].type === "release" && ev[i + 1].tick === c.tick + 1 ? i + 1 : -1;
      const prevT = i > 0 ? ev[i - 1].tick : -1, nextT = ev[(auto > 0 ? auto : i) + 1] ? ev[(auto > 0 ? auto : i) + 1].tick : Infinity;
      const ok = [];
      for (let t = Math.max(c.lo, prevT + 1); t <= c.hi && t + (auto > 0 ? 1 : 0) < nextT; t++) {
        const list = ev.map(e => Object.assign({}, e));
        list[i].tick = t; if (auto > 0) list[auto].tick = t + 1;
        if (clears(list)) ok.push(t);
      }
      if (!ok.length) return false;
      // the run of good ticks holding the pick, else the longest
      const runs = []; ok.forEach(t => { const l = runs[runs.length - 1]; if (l && l[1] === t - 1) l[1] = t; else runs.push([t, t]); });
      const best = runs.find(([a, b]) => a <= c.tick && c.tick <= b) || runs.reduce((m, x) => (x[1] - x[0] > m[1] - m[0] ? x : m));
      const t = Math.floor((best[0] + best[1]) / 2);
      c.lo = best[0]; c.hi = best[1]; c.ms = Math.round((best[1] - best[0] + 1) / C.TPS * 1000);
      ev[i].tick = t; if (auto > 0) ev[auto].tick = t + 1; c.tick = t;
    }
    return clears(ev);
  }

  // the rest of a level from a given state (e.g. after a hand-made stretch): events have absolute ticks
  const solveFrom = (w, state, opts) => solveSweep(w, Object.assign({}, opts, { start: state }));

  Object.assign(GD, { PHYS: C, SPEEDS, makeWorld, startState, step, run, solve, solveSweep, solveAny, solveFrom, posedObjects, skipCheck });
})(typeof module !== "undefined" ? module.exports : (window.GD = window.GD || {}));
