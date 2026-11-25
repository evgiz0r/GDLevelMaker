// The layout fitter: a whiteboard sketch (lib/sketch.js, DRAW.md) -> a layout that plays with the user's own clicks.
// The drawing is intent, not geometry ("its not 1:1 ... it has to be redone properly, or reporting the user something
// is off", the user, 2026-11-24). Two passes, both written back into a COPY of the sketch so the board can show them:
//
//  1. tidy (reading the drawing):
//     - a ground line with things under it (orbs, pads, portals, spikes, a lower ground) is a CEILING: blocks above the
//       line, 2 thick; otherwise a FLOOR filled down to the ground;
//     - heights snap to whole blocks and columns to the block grid; a one-column wobble is smoothed; a climb of one
//       block that was drawn as a slope becomes a 45-degree slope, and a floor that starts one block above the ground
//       gets a ramp in (a freehand line never starts exactly on the ground);
//     - spikes within 2 blocks of a floor stand on it, of a ceiling hang from it; a free flat spike line gets a row of
//       blocks behind it and points to where the play is (the orbs, portals, the other spike line of a corridor);
//     - pads go onto the surface under (or over) them; jump marks keep only their x (their height means nothing);
//     - in wave and ship parts a jump mark toggles hold / release (a tap means "turn here").
//  2. fit by replay (the user's clicks stay; the level moves around them, beat-first like tools/hitbuild.js):
//     the marks are replayed; portals the path misses are moved onto it, an orb with a mark next to it goes where the
//     player is at that press; at a death the least change that gets further is kept, in this order: nudge the
//     nearest mark (up to 2 blocks), a mark that is not needed (a pad already jumps) removed, a jump added where none
//     was marked, the spike or block that killed removed. Every change is listed with its spot: "~" adjusted, "x" a
//     piece of the drawing that could not stay as drawn.
//
//   const F = require("../lib/sketchfit.js")     // browser: GD.SKETCHFIT (after sketch.js and physics.js)
//   const r = F.fit(sketch, { maxRounds })  -> { sketch: fitted copy, changes: [{x, mark, text}], clear, dieX, why,
//                                               events, presses, level: convert() of the fitted sketch, rounds }
// Pure JS (node and browser). Test: node tests/sketchfit.js. Tool: node tools/sketch.js <id> --fit.
(function (OUT) {
  "use strict";
  const NODE = typeof module !== "undefined" && module.exports === OUT;
  const G = NODE ? Object.assign({}, require("./gd.js"), require("./objects.js"), require("./physics.js")) : OUT;
  const SK = NODE ? require("./sketch.js") : OUT.SKETCH;
  const B = 30, snap = y => Math.round(y / B) * B, colOf = x => Math.floor(x / B), cx = c => c * B + 15;
  const clone = o => JSON.parse(JSON.stringify(o));
  const isPortal = w => /^(portal|grav|size|speed|dual):/.test(w), isOrb = w => /^orb:/.test(w), isPad = w => /^pad:/.test(w);
  const yAt = (pts, x) => SK.topAt(pts, Math.max(pts[0][0], Math.min(pts[pts.length - 1][0], x)));
  const span = pts => { const xs = pts.map(p => p[0]); return [Math.min(...xs), Math.max(...xs)]; };

  // ---- 1. tidy ----
  function tidy(sk, changes) {
    const items = sk.items, ground = items.filter(it => it.k === "stroke" && it.pen === "ground" && !SK.isLoop(it.pts));
    const spikeLines = items.filter(it => it.k === "stroke" && it.pen === "spikes" && !SK.isLoop(it.pts));
    const stamps = items.filter(it => it.k === "stamp" && !/^prop:/.test(it.what));
    for (const g of ground) g.pts = g.pts.slice().sort((a, b) => a[0] - b[0]);
    // floors and ceilings
    for (const g of ground) {
      const [a, b] = span(g.pts); let under = 0;
      for (const s of stamps) if (s.x > a && s.x < b && s.y < yAt(g.pts, s.x) - 20 && s.y > yAt(g.pts, s.x) - 400) under++;
      for (const l of spikeLines) for (const p of l.pts) if (p[0] > a && p[0] < b && p[1] < yAt(g.pts, p[0]) - 25 && p[1] > yAt(g.pts, p[0]) - 400) { under++; break; }
      for (const h of ground) if (h !== g) { const [c, d] = span(h.pts), m = (Math.max(a, c) + Math.min(b, d)) / 2;
        if (Math.min(b, d) - Math.max(a, c) > 45 && yAt(h.pts, m) < yAt(g.pts, m) - 60) under++; }
      g.role = under ? "ceiling" : "floor";
    }
    // per column: floor tops and ceiling bottoms
    const floorTop = new Map(), ceilBot = new Map();
    const setTop = (c, t) => { if (!floorTop.has(c) || floorTop.get(c) < t) floorTop.set(c, t); };
    for (const g of ground) {
      const [a, b] = span(g.pts), c0 = colOf(a + 8), c1 = colOf(b - 8), cols = [];
      for (let c = c0; c <= c1; c++) cols.push({ c, y: snap(yAt(g.pts, cx(c))), raw: yAt(g.pts, cx(c)) });
      for (let i = 1; i + 1 < cols.length; i++)   // a one-column wobble
        if (cols[i - 1].y === cols[i + 1].y && cols[i].y !== cols[i - 1].y && Math.abs(cols[i].y - cols[i - 1].y) <= B) cols[i].y = cols[i - 1].y;
      const built = [];
      if (g.role === "ceiling") {
        for (const k of cols) { const bot = Math.max(B, k.y); built.push({ id: 1, x: cx(k.c), y: bot + 15 }, { id: 1, x: cx(k.c), y: bot + 45 }); ceilBot.set(k.c, Math.min(ceilBot.has(k.c) ? ceilBot.get(k.c) : 1e9, bot)); }
      } else {
        const fill = (c, top) => { for (let y = top - 15; y > 0; y -= B) built.push({ id: 1, x: cx(c), y }); };
        cols.forEach((k, i) => {
          const prev = i ? cols[i - 1].y : (floorTop.get(k.c - 1) || 0), d = k.y - prev;
          const rise = yAt(g.pts, cx(k.c) + 15) - yAt(g.pts, cx(k.c) - 15), wide = yAt(g.pts, cx(k.c) + 45) - yAt(g.pts, cx(k.c) - 45);
          const gentle = Math.abs(rise) < 25 && Math.abs(wide) < 60;   // no sharp climb drawn there: a slope, not a wall
          k.y = Math.max(0, k.y);
          if (d === B && (gentle || i === 0)) {                                  // a 45-degree slope (or the ramp in)
            built.push({ id: 1338, x: cx(k.c), y: prev + 15 }); fill(k.c, prev);
            if (i === 0) changes.push({ x: cx(k.c), mark: "~", text: "the ground line starts a block up: a ramp in" });
          } else if (d === -B && gentle && i) { built.push({ id: 1338, x: cx(k.c), y: k.y + 15, flipX: true }); fill(k.c, k.y); }
          else fill(k.c, k.y);
          setTop(k.c, k.y);
        });
      }
      g.built = built; g.cols = cols.map(k => [k.c, k.y]);
    }
    // portals: standing on the floor under them (or hanging from the ceiling over them) when drawn near one. A portal of
    // a mode with a band (ship, UFO, wave, swing 10 blocks, ball 8, spider 9: lib/physics.js BAND, GD's own rule) sets the
    // floor and ceiling from its height; it goes as high as a player on the floor still touches, so the band starts on
    // that floor, and a ceiling drawn above the band comes down to it (the player could never reach it in GD)
    const BAND = { ship: 300, ufo: 300, wave: 300, swing: 300, ball: 240, spider: 270 };
    const portals = stamps.filter(s => isPortal(s.what) && !/^speed:/.test(s.what)).sort((a, b) => a.x - b.x);
    for (const s of portals) {
      const c = colOf(s.x), h = G.objInfo(SK.STAMPS[s.what]).hit, half = h ? h.h / 2 : 43, mode = /^portal:/.test(s.what) && s.what.slice(7);
      const ft = floorTop.has(c) ? floorTop.get(c) : 0, cb = ceilBot.get(c), y0 = s.y;
      if (cb != null && cb - s.y < s.y - ft && cb - s.y < 150) s.y = cb - half; else if (s.y - ft < 150) s.y = ft + (BAND[mode] ? 60 : half);
      if (Math.abs(s.y - y0) > 12) changes.push({ x: s.x, mark: "~", text: `${s.what} put ${s.y > y0 ? "up" : "down"} ${(Math.abs(s.y - y0) / B).toFixed(1)} blocks, onto the path by the ${s.y > (cb || 1e9) - 100 ? "ceiling" : "floor"}` });
    }
    portals.filter(s => /^portal:/.test(s.what)).forEach((p, i, ms) => {
      const H = BAND[p.what.slice(7)]; if (!H) return;
      const x1 = i + 1 < ms.length ? ms[i + 1].x : Infinity, bf = Math.max(0, Math.floor((p.y - H / 2) / B) * B), top = bf + H;
      for (const g of ground) if (g.role === "ceiling") {
        let moved = 0, at = null;
        for (const k of g.cols) { const x = cx(k[0]); if (x < p.x || x >= x1 || k[1] <= top) continue;
          const d = k[1] - top; for (const b of g.built) if (b.x === x) b.y -= d; moved = Math.max(moved, d); at = at == null ? x : at; k[1] = top; ceilBot.set(k[0], top); }
        if (moved) changes.push({ x: at, mark: "~", text: `the ceiling over the ${p.what.slice(7)} part comes down ${(moved / B).toFixed(0)} blocks to ${top}: in GD a ${p.what.slice(7)} portal gives a band of ${H / B} blocks from where it stands (${bf} to ${top}), anything higher is out of reach` });
      }
    });
    // spikes
    let based = 0, attached = 0;
    for (const l of spikeLines) {
      const built = [], seen = new Set(), pts = l.pts;
      const [a, b] = span(pts), cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      // where the play is, for a free line: the nearest thing above or below it
      let best = null;
      for (const s of stamps) if (s.x > a - 60 && s.x < b + 60 && Math.abs(s.y - cy) < 400 && (!best || Math.abs(s.y - cy) < Math.abs(best))) best = s.y - cy;
      for (const o of spikeLines) if (o !== l) { const [c, d] = span(o.pts); if (Math.min(b, d) - Math.max(a, c) > 30) { const oy = o.pts.reduce((s, p) => s + p[1], 0) / o.pts.length; if (Math.abs(oy - cy) < 300 && (!best || Math.abs(oy - cy) < Math.abs(best))) best = oy - cy; } }
      const up = best == null || best > 0;
      for (const p of SK.walk(SK.simplify(pts, 3), B, 15)) {
        const c = colOf(p.x), ft = floorTop.has(c) ? floorTop.get(c) : 0, cb = ceilBot.get(c), flat = Math.abs(p.dy) < 0.45;
        if (p.y - ft > -20 && p.y - ft < 60) { if (!seen.has(c)) { seen.add(c); built.push({ id: 8, x: cx(c), y: ft + 15 }); attached++; } continue; }
        if (cb != null && cb - p.y > -20 && cb - p.y < 60) { if (!seen.has(c)) { seen.add(c); built.push({ id: 8, x: cx(c), y: cb - 15, rot: 180 }); attached++; } continue; }
        if (flat) {
          if (seen.has(c)) continue; seen.add(c); const base = snap(p.y);
          if (up) { built.push({ id: 8, x: cx(c), y: base + 15 }, { id: 1, x: cx(c), y: base - 15 }); setTop(c, base); }
          else { built.push({ id: 8, x: cx(c), y: base - 15, rot: 180 }, { id: 1, x: cx(c), y: base + 15 }); }
          based++; continue;
        }
        // a slanted free line (a corridor wall): the spike turned to it, pointing to the play side
        let nx = -p.dy, ny = p.dx; if ((ny > 0) !== up) { nx = -nx; ny = -ny; }
        const rot = Math.round(Math.atan2(nx, ny) * 180 / Math.PI), r = rot * Math.PI / 180;
        built.push({ id: 8, x: +(p.x + Math.sin(r) * 15).toFixed(1), y: +(p.y + Math.cos(r) * 15).toFixed(1), rot: (rot + 360) % 360 });
      }
      l.built = built;
    }
    if (based) changes.push({ x: null, mark: "~", text: based + " floating spikes got a block under them (spikes stand on something in GD)" });
    // pads onto a surface
    for (const s of stamps) if (isPad(s.what)) {
      const c = colOf(s.x), ft = floorTop.has(c) ? floorTop.get(c) : 0, cb = ceilBot.get(c);
      if (cb != null && cb - s.y < s.y - ft) { s.y = cb - 15; s.flipY = true; } else s.y = ft + 15;
      s.x = cx(c);
    }
    // marks: only x matters
    for (const it of items) if (it.k === "press") it.y = null;
    return { floorTop, ceilBot };
  }

  // ---- the marks as inputs: taps in cube / ball / spider ..., toggles in wave and ship ----
  function modeAt(sk) {
    const ps = sk.items.filter(it => it.k === "stamp" && /^portal:/.test(it.what) && !it.off).map(it => ({ x: it.x, m: it.what.slice(7) })).sort((a, b) => a.x - b.x);
    return x => { let m = "cube"; for (const p of ps) if (p.x <= x) m = p.m; return m; };
  }
  function events(sk) {
    const TPS = G.PHYS.TPS, mode = modeAt(sk), ev = [], tick = x => Math.max(0, Math.round(SK.xToTime(sk, x) * TPS));
    const marks = sk.items.filter(it => it.k === "press").sort((a, b) => a.x - b.x);
    const portals = sk.items.filter(it => it.k === "stamp" && /^portal:/.test(it.what) && !it.off).map(it => it.x).sort((a, b) => a - b);
    let holding = false;
    for (const m of marks) {
      const fly = /^(wave|ship|swing)$/.test(mode(m.x));
      if (fly) {
        const t = tick(m.x);
        if (!holding) { ev.push({ tick: t, type: "press" }); holding = true; }
        else { ev.push({ tick: t, type: "release" }); holding = false; }
        const nextPortal = portals.find(p => p > m.x), nextMark = marks.find(o => o.x > m.x);
        if (holding && nextPortal != null && (!nextMark || nextMark.x > nextPortal)) { ev.push({ tick: tick(nextPortal) - 1, type: "release" }); holding = false; }
        continue;
      }
      const t = tick(m.x);
      if (m.x1 != null && m.x1 > m.x + 6) ev.push({ tick: t, type: "press" }, { tick: Math.max(t + 1, tick(m.x1)), type: "release" });
      else ev.push({ tick: t, type: "press" }, { tick: t + 1, type: "release" });
    }
    ev.sort((a, b) => a.tick - b.tick || (a.type === "release" ? -1 : 1));
    return ev.filter((e, i) => !(ev[i + 1] && ev[i + 1].tick === e.tick));
  }

  // ---- 2. fit by replay ----
  function play(sk) {
    const lv = SK.convert(sk), w = G.makeWorld(lv.play, lv.header), ev = events(sk), r = G.run(w, ev);
    const clear = !!(r.done || (!r.dead && r.end.x >= w.endX - 5));
    return { lv, w, ev, r, clear, x: clear ? Infinity : r.end.x };
  }
  // the marks' exact ticks: a beam search, mark by mark. Each mark may move up to R ticks (about 1.5 blocks at 1x) or
  // be left out (costly); between marks nothing is pressed. In wave / ship a mark toggles hold; leaving those modes lets go.
  const FLY = { wave: 1, ship: 1 };
  const cl = s => { const c = { ...s }; c.used = s.used.slice(); return c; };
  function timing(w, nominal, opts) {
    const R = opts.R || 40, STEP = opts.step || 2, K = opts.beam || 14, SKIP = 400, max = Math.ceil((w.endX / (G.SPEEDS[0].x * 60) + 5) * G.PHYS.TPS);
    let far = null;
    // the drawn portals: a plan that goes past one without taking it costs as much as leaving out a mark
    const PORT = w.objects.map(o => ({ o, d: G.objInfo(o.id) })).filter(p => p.d.kind === "mode" || p.d.kind === "gravity")
      .map(p => ({ x: p.o.x, mode: p.d.kind === "mode" ? p.d.mode : null, grav: p.d.kind === "gravity" ? p.d.grav : null })).sort((a, b) => a.x - b.x);
    const passPortals = n => { while (n.pi < PORT.length && n.s.x > PORT[n.pi].x + 20) { const p = PORT[n.pi++];
      if (p.mode ? n.s.mode !== p.mode : n.s.grav !== p.grav) n.dev += 400; } };
    const idle = n => { // one tick with nothing pressed
      if (n.held && !FLY[n.s.mode]) { n.held = false; n.ev.push({ tick: n.s.tick, type: "release" }); }
      if (n.hu && n.s.tick >= n.hu) { n.hu = 0; n.ev.push({ tick: n.s.tick, type: "release" }); }   // the end of a robot's hold
      G.step(w, n.s, { press: false, held: n.held || !!n.hu }); passPortals(n);
      if (n.s.dead && (!far || n.s.x > far.x)) far = { x: n.s.x, y: n.s.y, why: n.s.why, killer: n.s.killer, tick: n.s.tick };
      return !n.s.dead;
    };
    const until = (n, t) => { while (n.s.tick < t && !n.s.done) if (!idle(n)) return false; return true; };
    const press = (n, L) => {
      const t = n.s.tick;
      if (L > 1 && !FLY[n.s.mode]) { n.ev.push({ tick: t, type: "press" }); n.hu = t + L; G.step(w, n.s, { press: true, held: true }); }
      else if (FLY[n.s.mode]) { n.held = !n.held; n.ev.push({ tick: t, type: n.held ? "press" : "release" }); G.step(w, n.s, { press: n.held, held: n.held }); }
      else { n.ev.push({ tick: t, type: "press" }, { tick: t + 1, type: "release" }); G.step(w, n.s, { press: true, held: true }); }
      if (n.s.dead && (!far || n.s.x > far.x)) far = { x: n.s.x, y: n.s.y, why: n.s.why, killer: n.s.killer, tick: n.s.tick };
      return !n.s.dead;
    };
    const key = n => [Math.round(n.s.y), Math.round(n.s.vy * 2), n.s.grav, n.s.mode, n.held ? 1 : 0, n.hu ? n.hu - n.s.tick : 0, n.s.used.join(".")].join(":");
    let beam = [{ s: G.startState(w), held: false, ev: [], dev: 0, skipped: [] }], prev = beam;
    for (let i = 0; i < nominal.length; i++) {
      const T = nominal[i], lo = Math.max(0, T - R), hi = T + R, nextLo = i + 1 < nominal.length ? Math.max(0, nominal[i + 1] - R) : max, cand = [];
      for (const n0 of beam) {
        const n = { s: cl(n0.s), held: n0.held, hu: n0.hu || 0, pi: n0.pi || 0, ev: n0.ev.slice(), dev: n0.dev, skipped: n0.skipped };
        if (!until(n, lo)) continue;
        for (let t = Math.max(lo, n.s.tick); t <= hi && !n.s.done; t++) {
          if ((t - lo) % STEP === 0) for (const L of n.s.mode === "robot" ? [1, 15, 30, 45] : [1]) {   // a robot jumps higher the longer it is held
            const b = { s: cl(n.s), held: n.held, hu: 0, pi: n.pi, ev: n.ev.slice(), dev: n.dev + Math.abs(t - T) + (L > 1 ? 3 : 0), skipped: n.skipped }; if (press(b, L)) cand.push(b); }
          if (!idle(n)) break;
        }
        if (!n.s.dead) cand.push({ s: n.s, held: n.held, hu: n.hu, pi: n.pi, ev: n.ev, dev: n.dev + SKIP, skipped: n.skipped.concat([i]) });
      }
      const alive = [];
      for (const c of cand) if (until(c, Math.max(nextLo, c.s.tick))) alive.push(c);
      alive.sort((a, b) => a.dev - b.dev);
      const seen = new Set(); beam = [];
      for (const c of alive) { const k = key(c); if (seen.has(k)) continue; seen.add(k); beam.push(c); if (beam.length >= K) break; }
      if (!beam.length) return { ok: false, far, stage: i, best: prev[0] ? prev[0].ev : [] };
      prev = beam;
    }
    for (const n of beam) { while (!n.s.done && !n.s.dead && n.s.tick < max) idle(n); if (n.s.done || (!n.s.dead && n.s.x >= w.endX - 5)) return { ok: true, events: n.ev, skipped: n.skipped, dev: n.dev, far }; }
    return { ok: false, far, stage: nominal.length, best: beam[0] ? beam[0].ev : [] };
  }

  function fit(sk0, opts) {
    opts = opts || {};
    const sk = clone(sk0), changes = [];
    tidy(sk, changes);
    const TPS = G.PHYS.TPS, tickOf = x => Math.round(SK.xToTime(sk, x) * TPS), xOfTick = t => SK.timeToX(sk, t / TPS);
    const marks = () => sk.items.filter(it => it.k === "press").sort((a, b) => a.x - b.x);
    let rounds = 0, res = null, lv = null, removed = 0; const claimed = new Set();
    const MAX = opts.maxRounds || 25, MAXREMOVE = opts.maxRemove || 8;
    while (rounds++ < MAX) {
      lv = SK.convert(sk); const w = G.makeWorld(lv.play, lv.header), ms = marks();
      res = timing(w, ms.map(m => tickOf(m.x)), opts);
      if (res.ok) {
        // report what the timing did to the marks
        ms.forEach((m, i) => { if (res.skipped.includes(i)) changes.push({ x: m.x, mark: "~", text: `your mark at block ${(m.x / B).toFixed(1)} is not needed (left out)` }); });
        break;
      }
      // nothing gets through with the marks: change the drawing at the death, the least first
      const f = res.far; if (!f) break;
      // an orb next to a mark the player passes by: it goes where the player is at that press (one orb per mark; an orb
      // more than 4 blocks off is left: then the drawing means something else)
      const path = G.run(w, res.best).path; let pulled = false;
      for (const m of ms) {
        const orb = sk.items.filter(it => it.k === "stamp" && isOrb(it.what) && !it.off && !claimed.has(it) && it.x > m.x - 40 && it.x < m.x + 120)
          .sort((a, b) => Math.abs(a.x - m.x) - Math.abs(b.x - m.x))[0];
        if (!orb || tickOf(m.x) >= path.length) continue;
        let st = null, d = 1e9;   // the path's closest pass by the orb (before the mark's press changes it)
        for (let t = Math.max(0, tickOf(m.x) - 80); t < Math.min(path.length, tickOf(m.x) + 80); t++) { const q = path[t], e = Math.hypot(q.x + 6 - orb.x, q.y - orb.y); if (e < d) { d = e; st = q; } }
        if (!st || d > 120) continue;
        claimed.add(orb);
        if (d > 12) {
          changes.push({ x: orb.x, mark: "~", text: `${orb.what} moved ${(d / B).toFixed(1)} blocks onto the path, your mark with it` });
          orb.x = Math.round(st.x + 6); orb.y = Math.round(st.y); m.x = +st.x.toFixed(1); pulled = true; break;
        }
      }
      if (pulled) continue;
      // a mode or gravity portal the path goes past without touching: it moves onto the path (a portal is drawn to be
      // taken; one the player misses means nothing in the level)
      for (const p of sk.items.filter(it => it.k === "stamp" && !it.off && !claimed.has(it) && isPortal(it.what) && !/^speed:/.test(it.what) && it.x < f.x).sort((a, b) => a.x - b.x)) {
        const q = path.find(st => st.x >= p.x); claimed.add(p); if (!q) continue;
        const want = /^portal:/.test(p.what) ? p.what.slice(7) : null, got = path.find(st => st.x >= p.x + 20);
        const taken = got && (want ? got.mode === want : got.grav === (p.what === "grav:up" ? -1 : 1));
        if (taken || Math.abs(q.y - p.y) < 8 || Math.abs(q.y - p.y) > 120) continue;   // more than 4 blocks off: the path is wrong, not the portal
        changes.push({ x: p.x, mark: "~", text: `${p.what} moved ${(Math.abs(q.y - p.y) / B).toFixed(1)} blocks ${q.y > p.y ? "up" : "down"} onto the path (the player went ${q.y > p.y ? "over" : "under"} it)` });
        p.y = Math.round(q.y); pulled = true; break;
      }
      if (pulled) continue;
      const near = ms.filter(m => m.x > f.x - 160 && m.x < f.x + 20).length;
      const kill = f.killer, src = kill && kill.src;
      const addedNear = sk.items.some(it => it.k === "press" && it.added && Math.abs(it.x - f.x) < 100);
      if (!near || !addedNear && (f.why === "spike" || f.why === "block")) {   // a jump the drawing needs but nobody marked (the timing search places it)
        const x = xOfTick(f.tick - 30); sk.items.push({ k: "press", x: +x.toFixed(1), y: null, added: true });
        changes.push({ x, mark: "~", text: `a jump added at block ${(x / B).toFixed(1)} (for the ${f.why || "hit"} at ${(f.x / B).toFixed(1)})` });
        continue;
      }
      if (++removed > MAXREMOVE) { changes.push({ x: f.x, mark: "x", text: `stopped here: no timing of your marks gets past the ${f.why || "hit"} at block ${(f.x / B).toFixed(1)}; change the drawing here (or tell Claude what you meant)` }); break; }
      if (kill && kill.id !== 8 && G.objInfo(kill.id).kind !== "hazard") {   // a wall: never eaten block by block
        changes.push({ x: f.x, mark: "x", text: `stopped here: a wall at block ${(f.x / B).toFixed(1)} your marks can't get over (a lower step, a portal, an orb or a pad would)` }); break; }
      if (src && src.built) {
        const i = src.built.findIndex(b => b.id === kill.id && Math.abs(b.x - kill.x) < 0.5 && Math.abs(b.y - kill.y) < 0.5);
        if (i >= 0) { src.built.splice(i, 1); changes.push({ x: kill.x, mark: "x", text: `${kill.id === 8 ? "a spike" : "a block"} at block ${(kill.x / B).toFixed(1)} taken out: no timing of your marks gets past it` }); continue; }
      }
      if (src && src.k === "stamp") { src.off = true; changes.push({ x: src.x, mark: "x", text: `${src.what} at block ${(src.x / B).toFixed(1)} taken out: no timing of your marks gets past it` }); continue; }
      break;
    }
    const ok = !!(res && res.ok), ev = ok ? res.events : (res && res.best) || [];   // not clear: the furthest partial plan, so the path shows up to the stop
    if (!ok && res && res.far && !changes.some(c => /^stopped here/.test(c.text)))
      changes.push({ x: res.far.x, mark: "x", text: `stopped here: no timing of your marks gets past the ${res.far.why || "hit"} at block ${(res.far.x / B).toFixed(1)}; change the drawing here (or tell Claude what you meant)` });
    return { sketch: sk, changes, clear: ok, dieX: ok ? null : res && res.far && res.far.x, why: ok ? "" : res && res.far && res.far.why, events: ev, presses: ev.filter(e => e.type === "press").length, level: lv, rounds };
  }

  OUT.SKETCHFIT = { fit, tidy, events };
  if (NODE) Object.assign(OUT, OUT.SKETCHFIT);
})(typeof module !== "undefined" ? module.exports : (window.GD = window.GD || {}));
