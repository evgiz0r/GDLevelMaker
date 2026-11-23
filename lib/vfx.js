// The visual side of GD 2.2's triggers, for drawing (viewer, tools/shoot.js): what colours, opacities,
// positions, turns and camera a level has at time t of a replay. Nothing here changes gameplay: the
// physics' own trigger engine (lib/physics.js) decides collisions; this one only decides looks, from
// the replayed path (player x, y at every 240 Hz step).
//
// Firing (all trigger ids): a trigger fires when the player's x passes its x (touch-triggered ones too,
// approximated), or -- spawn-triggered (62) -- when a spawn trigger (1268) calls a group it is in, after
// the spawn's delay (63). Multi-activate (87) triggers fire every time they are called (spawn loops);
// others once. Not modelled: counters, events (on jump...), collision / touch / instant-count triggers,
// toggled-off triggers not firing, stop (1616) and pause, spawn remaps, random triggers.
// Effects at time t:
//   899 colour   23 channel, 7-9 rgb, 10 fade s, 35 opacity, 50 copy channel + 49 HSV, 15/16 player colour
//   1006 pulse   51 target, 52 0 channel / 1 group, 7-9 rgb or 48 HSV mode (49, copy 50), 45 fade in,
//                46 hold, 47 fade out, 65 main only, 66 detail only
//   1007 alpha   51 group, 35 opacity, 10 fade s
//   901 move     51 group, 28/29 offset (units), 10 s, 30 easing, 85 rate; 58/59 lock to player x/y with
//                143/144 multipliers (10 = -1: forever) -- the parallax layers of 2.2 deco
//   1346 rotate  51 group, 68 deg + 69 turns, 71 centre group, 70 lock own rotation, 10 s, 30 easing
//   1049 toggle  51 group, 56 on (1) / off
//   1913 zoom    371, 10 s;  1916 camera offset 28/29 (units), 10 s
// Measured against the user's recordings of rated 2.2 levels: VISUALS.md.
(function (GD) {
  "use strict";
  const isNode = typeof module !== "undefined" && typeof require !== "undefined";
  const TPS = 240;

  const num = (v, d) => v === undefined || v === "" ? d : +v;
  const groupsOf = o => { const g = o.props && o.props[57]; return g ? String(g).split(".").map(Number).filter(n => n > 0) : []; };

  // ---- HSV strings "h a s a v a sAdd a vAdd" (h degrees; s, v multiply unless the add flag) ----
  function hsvParse(s) {
    if (!s) return null;
    const p = String(s).split("a").map(Number);
    return { h: p[0] || 0, s: isFinite(p[1]) ? p[1] : 1, v: isFinite(p[2]) ? p[2] : 1, sAdd: p[3] === 1, vAdd: p[4] === 1 };
  }
  function hsvApply(rgb, q) {
    if (!q) return rgb;
    let [r, g, b] = rgb.map(x => x / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0, s = mx ? d / mx : 0, v = mx;
    if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + q.h + 720) % 360;
    s = Math.max(0, Math.min(1, q.sAdd ? s + q.s : s * q.s));
    v = Math.max(0, Math.min(1, q.vAdd ? v + q.v : v * q.v));
    const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
    const [a, bb, cc] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [(a + m) * 255, (bb + m) * 255, (cc + m) * 255];
  }
  const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);

  // ---- firing ----
  function build(level, path, look) {
    const objs = level.objects, trig = [], byGroup = new Map();
    objs.forEach((o, i) => { o._i = i; }); // pose() and groupTint() find an object's groups by it
    const endT = (path.length - 1) / TPS;
    objs.forEach((o, i) => {
      const id = o.id, p = o.props || {};
      if (!(id === 899 || id === 1006 || id === 1007 || id === 901 || id === 1346 || id === 1049 || id === 1268 || id === 1913 || id === 1916 || id === 29 || id === 30 || id === 105 || id === 900 || id === 915)) return;
      const t = { i, id, o, p, x: o.x, groups: groupsOf(o), spawned: p[62] === "1", multi: p[87] === "1", fires: [] };
      trig.push(t);
      if (t.spawned) for (const g of t.groups) { if (!byGroup.has(g)) byGroup.set(g, []); byGroup.get(g).push(t); }
    });
    // the player's x at each tick is increasing: a binary search gives when x is first reached
    const x0 = path[0].x;
    const timeAtX = x => {
      if (x <= x0) return 0;
      let lo = 0, hi = path.length - 1;
      if (path[hi].x < x) return Infinity;
      while (lo < hi) { const m = (lo + hi) >> 1; if (path[m].x >= x) hi = m; else lo = m + 1; }
      return lo / TPS;
    };
    // event queue (a sorted array is enough: pushes are few compared with the level)
    const q = [];
    const push = (tm, t) => { if (tm > endT + 1) return; let lo = 0, hi = q.length; while (lo < hi) { const m = (lo + hi) >> 1; if (q[m][0] <= tm) lo = m + 1; else hi = m; } q.splice(lo, 0, [tm, t]); };
    for (const t of trig) if (!t.spawned) { const tm = timeAtX(t.x); if (isFinite(tm)) push(tm, t); }
    let budget = 300000;
    while (q.length && budget-- > 0) {
      const [tm, t] = q.shift();
      if (t.fires.length && !t.multi) continue;
      if (t.fires.length > 4000) continue;
      t.fires.push(tm);
      if (t.id === 1268) { const g = +t.p[51] || 0, d = num(t.p[63], 0); for (const u of byGroup.get(g) || []) push(tm + d, u); }
    }
    // effect lists
    const V = { trig, path, endT, colour: {}, pulseCh: {}, pulseGr: {}, alpha: {}, move: {}, rot: {}, toggle: {}, zoom: [], offset: [], look };
    const add = (m, k, e) => { (m[k] = m[k] || []).push(e); };
    const OLD = { 29: 1000, 30: 1001, 105: 1004, 900: 1009, 915: 1002 };
    for (const t of trig) for (const f of t.fires) {
      const p = t.p, dur = Math.max(0, num(p[10], t.id === 1007 || t.id === 899 ? 0.5 : 0.5));
      if (t.id === 899 || OLD[t.id]) {
        const ch = t.id === 899 ? num(p[23], 1) : OLD[t.id];
        add(V.colour, ch, { t: f, dur, to: [num(p[7], 255), num(p[8], 255), num(p[9], 255)], op: num(p[35], 1), copy: +p[50] || 0, hsv: hsvParse(p[49]), player: p[15] === "1" ? 1 : p[16] === "1" ? 2 : 0 });
      } else if (t.id === 1006) {
        const e = { t: f, fin: num(p[45], 0), hold: num(p[46], 0), fout: num(p[47], 0), rgb: [num(p[7], 255), num(p[8], 255), num(p[9], 255)],
          hsvMode: p[48] === "1", hsv: hsvParse(p[49]), copy: +p[50] || 0, main: p[65] === "1", detail: p[66] === "1" };
        add(p[52] === "1" ? V.pulseGr : V.pulseCh, +p[51] || 0, e);
      } else if (t.id === 1007) add(V.alpha, +p[51] || 0, { t: f, dur: num(p[10], 0), to: num(p[35], 1) });
      else if (t.id === 901) add(V.move, +p[51] || 0, { t: f, dur: num(p[10], 0.5), dx: num(p[28], 0), dy: num(p[29], 0), ease: num(p[30], 0), rate: num(p[85], 2),
        lockX: p[58] === "1", lockY: p[59] === "1", mx: num(p[143], 1), my: num(p[144], 1) });
      else if (t.id === 1346) add(V.rot, +p[51] || 0, { t: f, dur: num(p[10], 0.5), deg: num(p[68], 0) + 360 * num(p[69], 0), center: +p[71] || 0, lock: p[70] === "1", ease: num(p[30], 0), rate: num(p[85], 2) });
      else if (t.id === 1049) add(V.toggle, +p[51] || 0, { t: f, on: p[56] === "1" });
      else if (t.id === 1913) V.zoom.push({ t: f, dur: num(p[10], 0.5), to: num(p[371], 1) });
      else if (t.id === 1916) V.offset.push({ t: f, dur: num(p[10], 0.5), to: [num(p[28], 0), num(p[29], 0)] });
    }
    const byT = (a, b) => a.t - b.t;
    for (const m of [V.colour, V.pulseCh, V.pulseGr, V.alpha, V.move, V.rot, V.toggle]) for (const k in m) m[k].sort(byT);
    V.zoom.sort(byT); V.offset.sort(byT);
    // objects whose groups something moves / turns / tints / hides: posed each frame
    const touched = new Set([...Object.keys(V.move), ...Object.keys(V.rot), ...Object.keys(V.pulseGr), ...Object.keys(V.toggle), ...Object.keys(V.alpha)].map(Number));
    V.groupObj = new Map(); // group -> first object in it (rotation centres)
    V.dynamic = [];
    objs.forEach((o, i) => {
      const gs = groupsOf(o);
      for (const g of gs) if (!V.groupObj.has(g)) V.groupObj.set(g, o);
      if (gs.some(g => touched.has(g))) V.dynamic.push(i);
    });
    V.groups = objs.map(groupsOf);
    V.fired = trig.reduce((n, t) => n + t.fires.length, 0);
    return V;
  }

  // ---- values at time t ----
  const easeOf = (type, rate, u) => ease(type, rate, u);
  // cocos2d easings (as lib/physics.js; repeated so this file stands alone)
  function ease(type, r, t) {
    if (t <= 0) return 0; if (t >= 1) return 1;
    const PI = Math.PI, per = r > 0 ? r : 0.3, sh = per / 4;
    const bo = u => u < 1 / 2.75 ? 7.5625 * u * u : u < 2 / 2.75 ? 7.5625 * (u -= 1.5 / 2.75) * u + 0.75 : u < 2.5 / 2.75 ? 7.5625 * (u -= 2.25 / 2.75) * u + 0.9375 : 7.5625 * (u -= 2.625 / 2.75) * u + 0.984375;
    switch (type) {
      case 1: { const u = t * 2; return u < 1 ? 0.5 * Math.pow(u, r) : 1 - 0.5 * Math.pow(2 - u, r); }
      case 2: return Math.pow(t, r);
      case 3: return Math.pow(t, 1 / r);
      case 4: { const u = t * 2 - 1; return u < 0 ? -0.5 * Math.pow(2, 10 * u) * Math.sin((u - sh) * 2 * PI / per) : Math.pow(2, -10 * u) * Math.sin((u - sh) * 2 * PI / per) * 0.5 + 1; }
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
  const prog = (e, t) => e.dur > 0 ? Math.min(1, Math.max(0, (t - e.t) / e.dur)) : 1;
  // a fade list: each event fades from wherever the last one had got to
  function fadeVal(start, list, t, get) {
    let from = start, to = start, t0 = -1, dur = 0;
    const at = tt => { const k = dur <= 0 ? 1 : Math.min(1, Math.max(0, (tt - t0) / dur)); return Array.isArray(from) ? from.map((v, i) => v + (to[i] - v) * k) : from + (to - from) * k; };
    for (const e of list || []) { if (e.t > t) break; from = at(e.t); to = get(e); t0 = e.t; dur = e.dur; }
    return t0 < 0 ? start : at(t);
  }
  function pulseK(e, t) {
    const d = t - e.t;
    if (d < 0) return 0;
    if (d < e.fin) return d / e.fin;
    if (d < e.fin + e.hold) return 1;
    if (d < e.fin + e.hold + e.fout) return 1 - (d - e.fin - e.hold) / e.fout;
    return 0;
  }
  // the state at time t: {col, alpha, zoom, blend, opacity, off, offsets, rots, camOff, groupPulse}
  // base: lib/look.js's stateAt (header colours); colour triggers here replace its colour part
  function stateAt(V, t, base) {
    const st = Object.assign({}, base);
    const col = Object.assign({}, base.col), start = V.look ? V.look.start : base.col;
    // colour triggers (copy colour reads the copied channel at the trigger's own time, roughly)
    for (const ch in V.colour) {
      col[ch] = fadeVal(start[ch] || [255, 255, 255], V.colour[ch], t, e => {
        let c = e.to;
        if (e.player) c = (start[e.player === 2 ? 1006 : 1005] || [255, 255, 255]);
        if (e.copy) c = hsvApply(col[e.copy] || start[e.copy] || [255, 255, 255], e.hsv);
        return c;
      });
    }
    // pulses on channels
    for (const ch in V.pulseCh) for (const e of V.pulseCh[ch]) {
      if (e.t > t) break;
      const k = pulseK(e, t); if (k <= 0) continue;
      const pc = e.hsvMode ? hsvApply(col[e.copy || ch] || [255, 255, 255], e.hsv) : e.rgb;
      col[ch] = mix(col[ch] || [255, 255, 255], pc, k);
    }
    // copy-colour channels follow their (now triggered / pulsed) source
    if (base.copy && GD.LOOK && GD.LOOK.applyCopies) GD.LOOK.applyCopies(col, base.copy);
    else if (base.copy && isNode) require("./look.js").LOOK.applyCopies(col, base.copy);
    st.col = col;
    const alpha = Object.assign({}, base.alpha);
    for (const g in V.alpha) alpha[g] = fadeVal(1, V.alpha[g], t, e => e.to);
    st.alpha = alpha;
    st.zoom = fadeVal(base.zoom || 1, V.zoom, t, e => e.to) || base.zoom;
    st.camOff = fadeVal([0, 0], V.offset, t, e => e.to);
    // toggles
    st.off = {};
    for (const g in V.toggle) { let on = true; for (const e of V.toggle[g]) { if (e.t > t) break; on = e.on; } if (!on) st.off[g] = true; }
    // group pulses: per group, the colour mix to apply to its objects' main / detail
    st.groupPulse = {};
    for (const g in V.pulseGr) for (const e of V.pulseGr[g]) {
      if (e.t > t) break;
      const k = pulseK(e, t); if (k <= 0) continue;
      st.groupPulse[g] = { rgb: e.hsvMode ? null : e.rgb, hsv: e.hsvMode ? e.hsv : null, copy: e.copy, k, main: !e.detail, detail: !e.main };
    }
    // move offsets and turns per group
    const tick = Math.min(V.path.length - 1, Math.max(0, Math.round(t * TPS)));
    const px = V.path[tick].x, py = V.path[tick].y;
    st.offsets = {};
    for (const g in V.move) {
      let dx = 0, dy = 0;
      for (const e of V.move[g]) {
        if (e.t > t) break;
        if (e.lockX || e.lockY) {
          const tEnd = e.dur < 0 ? t : Math.min(t, e.t + e.dur), k0 = Math.min(V.path.length - 1, Math.round(e.t * TPS)), k1 = Math.min(V.path.length - 1, Math.round(tEnd * TPS));
          if (e.lockX) dx += (V.path[k1].x - V.path[k0].x) * e.mx;
          if (e.lockY) dy += (V.path[k1].y - V.path[k0].y) * e.my;
        } else {
          const k = easeOf(e.ease, e.rate, prog(e, t));
          dx += e.dx * k; dy += e.dy * k;
        }
      }
      st.offsets[g] = [dx, dy];
    }
    st.rots = {};
    for (const g in V.rot) {
      const list = [];
      for (const e of V.rot[g]) { if (e.t > t) break; list.push([e, e.deg * easeOf(e.ease, e.rate, prog(e, t))]); }
      st.rots[g] = list;
    }
    st.player = [px, py];
    return st;
  }
  // an object as it is at state st: a moved / turned copy, or null when hidden (toggled off)
  function pose(V, st, o, i) {
    const gs = V.groups[i];
    if (!gs.length) return o;
    let dx = 0, dy = 0, turn = 0;
    for (const g of gs) { if (st.off[g]) return null; const v = st.offsets[g]; if (v) { dx += v[0]; dy += v[1]; } }
    let x = o.x + dx, y = o.y + dy;
    for (const g of gs) for (const [e, a] of st.rots[g] || []) {
      if (e.center) {
        const c = V.groupObj.get(e.center);
        if (c) {
          let cx = c.x, cy = c.y;
          for (const cg of groupsOf(c)) { const v = st.offsets[cg]; if (v) { cx += v[0]; cy += v[1]; } }
          const r = a * Math.PI / 180, co = Math.cos(r), sn = Math.sin(r), ux = x - cx, uy = y - cy;
          x = cx + ux * co + uy * sn; y = cy - ux * sn + uy * co;
        }
      }
      if (!e.lock) turn += a;
    }
    if (x === o.x && y === o.y && !turn) return o;
    return Object.assign({}, o, { x, y, rot: (o.rot || 0) + turn });
  }
  // the colours an object ends up with after group pulses: {main, detail} overrides or null
  function groupTint(V, st, o, i, mainCol, detailCol) {
    const gs = V.groups[i];
    let m = mainCol, d = detailCol, any = false;
    for (const g of gs) {
      const gp = st.groupPulse[g]; if (!gp) continue;
      const pc = gp.rgb || hsvApply(st.col[gp.copy] || [255, 255, 255], gp.hsv);
      if (gp.main && m) { m = mix(m, pc, gp.k); any = true; }
      if (gp.detail && d) { d = mix(d, pc, gp.k); any = true; }
    }
    return any ? { main: m, detail: d } : null;
  }

  GD.VFX = { build, stateAt, pose, groupTint, hsvParse, hsvApply, ease };
})(typeof module !== "undefined" ? module.exports : (window.GD = window.GD || {}));
