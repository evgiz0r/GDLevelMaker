// One pen, two intents (the user, 2026-11-25: "all im thinking is a path, or just sketch [...] i dont want to swap colors,
// or to do 5 clicks every time [...] somehow the result will match my thought"). DRAW.md "One pen: path or shape".
// A stroke drawn with the board's ✨ pen is read as one of:
//   PATH   where the player goes: a curve moving right (smooth, arcs, diagonals). It is filled with lego bricks (the
//          verified pieces of our own levels, viewer/bricks.js from tools/brickset.js) whose replayed route follows the
//          curve best, chained so each brick starts where the last one ended (mode, height), a portal where the mode
//          changes. The bricks' own presses come with them, so the result plays at once.
//   SHAPE  a structure: an outline of mostly flat and upright lines (steps, pillars, a pit), or a closed loop. It snaps
//          to the brick whose tops, column by column, are nearest to the drawn tops, placed where it was drawn.
//
//   const I = require("../lib/intent.js")        // browser: window.GD.INTENT (load after sketch.js and bricks.js)
//   I.classify(pts)                -> { kind: "path" | "shape", why }
//   I.fillPath(pts, bricks, o)     -> { placed: [{ brick, x, dy, err }], objs, presses, err }
//   I.snapShape(pts, bricks, o)    -> the same with one brick
//   I.apply(sketch, item, bricks)  -> replaces the drawn item by its bricks (a pinned "auto" stroke carrying the objects in
//                                     `built`, plus the bricks' presses), returns { kind, placed, note }
// Units as the sketch: level units (30 = a block), ground top y = 0. Pure JS (node and browser). Test: node tests/intent.js.
(function (OUT) {
  "use strict";
  const NODE = typeof module !== "undefined" && module.exports === OUT;
  const SK = NODE ? require("./sketch.js") : OUT.SKETCH;
  const G = NODE ? Object.assign({}, require("./gd.js"), require("./objects.js"), require("./physics.js")) : OUT;
  const B = 30, GROUND = { cube: 1, robot: 1, ball: 1, spider: 1, ufo: 0 }, FLY = { ship: 1, wave: 1, swing: 1, ufo: 1 };
  const PORTAL = { cube: 12, ship: 13, ball: 47, ufo: 111, wave: 660, robot: 745, spider: 1331, swing: 1933 };

  // ---- what was drawn ----
  function classify(pts) {
    if (!pts || pts.length < 2) return { kind: "path", why: "a dot" };
    if (SK.isLoop(pts)) return { kind: "shape", why: "a closed outline" };
    const p = SK.simplify(pts, 6);
    let len = 0, axis = 0, upright = 0, back = 0, fwd = 0;
    for (let i = 1; i < p.length; i++) {
      const dx = p[i][0] - p[i - 1][0], dy = p[i][1] - p[i - 1][1], l = Math.hypot(dx, dy); if (!l) continue;
      const a = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI);   // 0 right, 90 up/down, 180 left
      len += l; if (dx < 0) back += -dx; else fwd += dx;
      if (a < 15 || a > 165 || Math.abs(a - 90) < 15) axis += l;
      if (Math.abs(a - 90) < 15 && Math.abs(dy) > 20) upright++;
    }
    if (back > 0.2 * (fwd + back)) return { kind: "shape", why: "it goes back on itself" };
    // flat and upright lines are a structure when they stand on the ground (both ends low: a ledge, a pillar) or step
    // more than once; one climb and then a flat line in the air is a flight
    const low = q => q[1] < 20;
    if (axis > 0.75 * len && (upright >= 2 || upright === 1 && low(p[0]) && low(p[p.length - 1]))) return { kind: "shape", why: "flat and upright lines" };
    return { kind: "path", why: "a curve moving right" };
  }

  // the drawn line's height at x (blocks), from its top-most point there
  function curveAt(pts) {
    const p = pts.slice().sort((a, b) => a[0] - b[0]);
    return x => {
      if (x <= p[0][0]) return p[0][1] / B; if (x >= p[p.length - 1][0]) return p[p.length - 1][1] / B;
      let lo = 0, hi = p.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (p[m][0] <= x) lo = m; else hi = m; }
      const a = p[lo], b = p[hi], t = b[0] === a[0] ? 0 : (x - a[0]) / (b[0] - a[0]);
      return (a[1] + (b[1] - a[1]) * t) / B;
    };
  }

  // a brick put down at x (units) moved up by dy (blocks): its objects and presses in level units
  function place(br, x, dy) {
    const objs = br.objs.map(o => ({ id: o[0], x: +(x + o[1]).toFixed(1), y: +(o[2] + dy * B).toFixed(1), rot: o[3] || 0, flipX: !!o[4], flipY: !!o[5] }));
    const presses = []; let open = null;
    for (const [cx, down] of br.clicks) {
      const px = +(x + cx * B).toFixed(1);
      if (down) open = { k: "press", x: px, y: 0, auto: br.id }; else if (open) { if (px > open.x + 6) open.x1 = px; presses.push(open); open = null; }
    }
    if (open) presses.push(open);
    return { objs, presses };
  }

  // ---- a path: bricks along the curve ----
  function fillPath(pts, bricks, o = {}) {
    o = o || {}; const sp = o.speed == null ? 1 : o.speed, at = curveAt(pts);
    const xs = Math.min(...pts.map(p => p[0])), xe = Math.max(...pts.map(p => p[0]));
    const pool = bricks.filter(b => (b.sp || 1) === sp && b.path && b.path.length >= 4 && b.w >= 6 && b.w <= 40);
    const placed = [], recent = [];
    let x = xs, mode = o.mode || null, exitY = null, total = 0, prevGround = true;
    while (x < xe - 3 * B) {
      const left = (xe - x) / B, cands = [];
      for (const br of pool) {
        if (br.w > left + 6) continue;
        const ground = !FLY[br.mode];
        // where it sits: a ground-mode brick on the ground as built; a flying one continues the last exit height
        // (the first one goes where the line starts)
        // the seam contract (LEGO.md "Joining"): a ground brick starts where the last one left the player -- on the
        // ground or on the same block height, standing -- and the first one starts on the ground
        if (ground) {
          const fromY = exitY != null && mode && !FLY[mode] ? exitY : 0.5;
          if (Math.abs(br.en.y - fromY) > 0.2 || !br.en.ground || (placed.length && !prevGround)) continue;
        }
        let dy = 0;
        if (!ground) dy = Math.round(((exitY != null && mode && FLY[mode] ? exitY : at(x)) - br.en.y) * 2) / 2;
        if (!ground && Math.min(...br.objs.map(q => q[2])) + dy * B < -15) continue;   // nothing under the ground
        let e = 0, n = 0;
        for (const [px, py] of br.path) { const d = at(x + px * B) - (py + dy); e += Math.abs(d); n++; }
        e /= n;
        if (mode && br.mode !== mode) e += 0.3;                                   // a portal: fine, but not for nothing
        if (mode && br.mode === mode && exitY != null && Math.abs(exitY - (br.en.y + dy)) > 0.6) e += 1.5;   // a jump in height
        if (mode && !FLY[mode] && !ground) e += 0.15;                             // from the ground into the air
        if (recent.includes(br.id)) e += 0.8;                                     // variety: not the same brick again
        e += 1.5 / br.w;                                                          // a longer brick reads as one idea
        cands.push({ br, dy, e });
      }
      // the best fit that still plays: each try replays the sketch so far with it (o.check), the next best when it dies
      // (LEGO.md: "a piece that fails is swapped for the next of its kind, not searched")
      cands.sort((a, b) => a.e - b.e);
      let best = null;
      for (const c of cands.slice(0, o.check ? 12 : 1)) {
        const trial = placed.concat([{ brick: c.br, x, dy: c.dy }]);
        if (!o.check || o.check(assemble(trial, { first: o.mode || "cube" }), x + c.br.w * B)) { best = c; break; }
      }
      if (!best) break;
      placed.push({ brick: best.br, x, dy: best.dy, err: +best.e.toFixed(2), portal: !mode || best.br.mode !== mode });
      recent.push(best.br.id); if (recent.length > 4) recent.shift();
      total += best.e; mode = best.br.mode; exitY = best.br.ex.y + best.dy; prevGround = !!best.br.ex.ground || !!FLY[mode]; x += best.br.w * B;
    }
    return assemble(placed, { first: o.mode || "cube" }, total / Math.max(1, placed.length));
  }

  function assemble(placed, o, err) {
    const objs = [], presses = []; let mode = o.first;
    for (const p of placed) {
      if (p.brick.mode !== mode) {   // the mode's portal a block before the brick, at the height it is entered
        objs.push({ id: PORTAL[p.brick.mode], x: +(p.x - 15).toFixed(1), y: +((p.brick.en.y + p.dy) * B).toFixed(1), rot: 0, flipX: false, flipY: false, portal: 1 });
        mode = p.brick.mode;
      }
      const r = place(p.brick, p.x, p.dy); objs.push(...r.objs); presses.push(...r.presses);
    }
    return { placed: placed.map(p => ({ id: p.brick.id, mode: p.brick.mode, sig: p.brick.sig, x: p.x, w: p.brick.w, dy: p.dy, err: p.err })), objs, presses, err: +(err || 0).toFixed(2) };
  }

  // ---- a path through the air: a corridor around it (the fly-path idea, tools/patterns.js, built here so it runs on
  // the phone too) and the holds that fly it, found by a small steering run in the sim ----
  // which block columns of the line are flying: the line stays over 1.3 blocks for 6+ columns (a cube's hop is back on
  // the ground within ~4)
  function stretches(pts) {
    const at = curveAt(pts), xs = Math.min(...pts.map(p => p[0])), xe = Math.max(...pts.map(p => p[0]));
    const n = Math.max(1, Math.floor((xe - xs) / B)), air = [];
    for (let c = 0; c < n; c++) air.push(at(xs + c * B + 15) > 1.3);
    const out = []; let c = 0;
    while (c < n) { let e = c; while (e < n && air[e] === air[c]) e++; out.push({ air: air[c], x0: xs + c * B, x1: xs + e * B }); c = e; }
    // short air runs are hops: ground; then merge neighbours of the same kind
    for (const r of out) if (r.air && (r.x1 - r.x0) / B < 6) r.air = false;
    const m = []; for (const r of out) { const l = m[m.length - 1]; if (l && l.air === r.air) l.x1 = r.x1; else m.push(Object.assign({}, r)); }
    return m;
  }
  function flyMode(at, x0, x1) {   // straight 45-degree legs: wave; smooth curves: ship
    let leg = 0, n = 0;
    for (let x = x0 + 15; x < x1 - 15; x += 15) { const s = Math.abs(at(x + 15) - at(x - 15)); n++; if (s > 0.7 && s < 1.4) leg++; }
    return n && leg / n > 0.45 ? "wave" : "ship";
  }
  function corridor(at, x0, x1, mode) {
    const gap = mode === "wave" ? 4 : 5, lo = Math.floor(gap / 2), n = Math.max(4, Math.round((x1 - x0) / B)), rows = [];
    let r = 0;   // from the ground (the cube walks into the portal), a row a column at most: 45 degrees
    for (let c = 0; c < n; c++) {
      const want = c >= n - 3 ? 0 : Math.max(lo, Math.min(7, Math.round(at(x0 + c * B + 15) - 0.5)));
      r += Math.sign(want - r); rows.push(r);
    }
    const objs = [], cell = (id, c, row, f) => objs.push(Object.assign({ id, x: +(x0 + c * B + 15).toFixed(1), y: row * B + 15, rot: 0, flipX: false, flipY: false }, f || {}));
    for (let c = 0; c < n; c++) {
      const m0 = rows[c], m1 = c + 1 < n ? rows[c + 1] : m0, mm = Math.min(m0, m1), MM = Math.max(m0, m1);
      const fl = mm - lo, cl = MM - lo + gap - 1;
      for (let k = 0; k < fl; k++) cell(1, c, k);
      if (m0 !== m1) { const up = m1 > m0; if (fl >= 0) cell(1338, c, fl, up ? {} : { flipX: true }); cell(1338, c, cl, up ? { flipX: true, flipY: true } : { flipY: true }); }
      const roof = m0 !== m1 ? cl + 1 : MM - lo + gap;
      for (let k = roof; k < roof + 2; k++) cell(1, c, k);
    }
    cell(PORTAL[mode], -1, 1); cell(PORTAL.cube, n, 1);
    return { objs, rows, x1: x0 + n * B };
  }
  // the holds that fly every corridor: tick by tick, hold when the line ahead is above the player (wave), or when it is
  // above where the player is heading (ship: y + K * vy, K tried a few ways, the one that gets furthest kept)
  function steer(sk, flies) {
    if (!G || !G.step) return [];
    const lv = SK.convert(sk), w = G.makeWorld(lv.play, lv.header), plan = SK.planEvents(sk), pm = new Map(plan.map(e => [e.tick, e.type]));
    const inFly = x => flies.find(f => x >= f.x0 - 45 && x < f.x1);
    let bestHolds = [], bestX = -1;
    for (const K of [0, 4, 8, 14, 22]) {
      const s = G.startState(w), holds = []; let held = false, cur = null;
      while (!s.dead && !s.done && s.tick < 240 * 120) {
        const f = FLY[s.mode] && inFly(s.x);
        let h;
        if (f) {
          const t = f.at(s.x + 30 + K) * B;   // the wave: hold up the rising legs, let go on the falling ones, with a little slack
          h = f.mode === "wave" ? (held ? t > s.y - 8 : t > s.y + 8) : t - (s.y + K * s.vy) > 0;   // so one input per leg
        }
        else { const e = pm.get(s.tick); h = e === "press" ? true : e === "release" ? false : held; }
        if (f && h && !held) cur = { k: "press", x: +s.x.toFixed(1), y: 0, auto: "steer" };
        if (f && !h && held && cur) { if (s.x > cur.x + 6) cur.x1 = +s.x.toFixed(1); holds.push(cur); cur = null; }
        const press = h && !held; held = h;
        G.step(w, s, { press, held });
      }
      if (cur) holds.push(cur);
      const x = G.progressX(s); if (s.done) return holds;
      if (x > bestX) { bestX = x; bestHolds = holds; }
    }
    return bestHolds;
  }

  // ---- a shape: the nearest brick by its tops ----
  function topsOf(br) {   // per block column: the highest top of a solid / hazard there (blocks), or null
    const t = new Array(Math.ceil(br.w)).fill(null);
    for (const [id, x, y] of br.objs) {
      if (PORTAL_IDS.has(id)) continue;
      const c = Math.floor(x / B); if (c < 0 || c >= t.length) continue;
      const top = (y + 15) / B; if (t[c] == null || top > t[c]) t[c] = top;
    }
    return t;
  }
  const PORTAL_IDS = new Set([...Object.values(PORTAL), 10, 11, 99, 101, 200, 201, 202, 203, 1334, 36, 84, 141, 1022, 1330, 1333, 1704, 3004]);
  function drawnTops(pts) {
    const xs = Math.min(...pts.map(p => p[0])), xe = Math.max(...pts.map(p => p[0])), n = Math.max(1, Math.round((xe - xs) / B)), t = [];
    for (let c = 0; c < n; c++) {
      const a = xs + c * B, b = a + B; let m = null;
      for (let i = 1; i < pts.length; i++) {   // every segment's points inside the column
        const p = pts[i - 1], q = pts[i];
        for (let k = 0; k <= 4; k++) { const x = p[0] + (q[0] - p[0]) * k / 4, y = p[1] + (q[1] - p[1]) * k / 4; if (x >= a && x < b && (m == null || y > m)) m = y; }
      }
      t.push(m == null ? null : Math.max(0, m) / B);
    }
    return { xs, tops: t };
  }
  function snapShape(pts, bricks, o = {}) {
    const sp = (o && o.speed) == null ? 1 : o.speed, d = drawnTops(pts), n = d.tops.length, cands = [];
    for (const br of bricks) {
      if ((br.sp || 1) !== sp || br.w < n * 0.6 || br.w > n * 1.6 + 4) continue;
      const bt = topsOf(br); let e = 0, k = 0;
      // only the columns where something stands (drawn or in the brick): flat ground matches anything
      for (let c = 0; c < n; c++) { if (d.tops[c] == null) continue; const v = bt[Math.min(bt.length - 1, Math.round(c * bt.length / n))] || 0; if (v < 0.3 && d.tops[c] < 0.3) continue; e += Math.abs(v - d.tops[c]); k++; }
      if (!k) continue; const e0 = e / k; e = e0 + Math.abs(br.w - n) * 0.05 + (o.mode && br.en.mode !== o.mode ? 0.5 : 0);
      if (!br.en.ground || Math.abs(br.en.y - 0.5) > 0.2) e += 3;   // it has to be enterable from the ground
      cands.push({ br, e, e0 });
    }
    cands.sort((a, b) => a.e - b.e);
    let best = null;
    for (const c of cands.slice(0, o.check ? 12 : 1)) {
      const r = assemble([{ brick: c.br, x: d.xs, dy: 0 }], { first: o.mode || c.br.mode });
      if (!o.check || o.check(r, d.xs + c.br.w * B)) { best = c; break; }
    }
    if (!best && cands.length) best = cands[0];
    // nothing in the library is shaped like it (tops off by more than ~3/4 block on average): build what was drawn
    if (best && best.e0 > 0.75) return { placed: [], objs: [], presses: [], err: +best.e0.toFixed(2), literal: true };
    if (!best) return { placed: [], objs: [], presses: [], err: null };
    return assemble([{ brick: best.br, x: d.xs, dy: 0, err: +best.e.toFixed(2) }], { first: o.mode || best.br.mode }, best.e);
  }

  // ---- on the board ----
  function modeAt(sk, x) {   // the mode the player is in at x: the last portal stamp or brick before it
    let m = "cube", mx = -Infinity;
    for (const it of sk.items || []) {
      if (it.k === "stamp" && /^portal:/.test(it.what) && it.x < x && it.x > mx) { m = it.what.slice(7); mx = it.x; }
      if (it.k === "stroke" && it.auto && it.auto.last && it.auto.x1 <= x + 1 && it.auto.x1 > mx) { m = it.auto.last; mx = it.auto.x1; }
    }
    return m;
  }
  function apply(sk, item, bricks) {
    const c = classify(item.pts), x0 = Math.min(...item.pts.map(p => p[0]));
    const o = { speed: sk.speed == null ? 1 : sk.speed, mode: modeAt(sk, x0) };
    const i = sk.items.indexOf(item); if (i >= 0) sk.items.splice(i, 1);
    if (G && G.run) o.check = (r, xEnd) => {   // does the sketch with these bricks play to xEnd with their presses?
      const t = { speed: sk.speed, song: sk.song, items: sk.items.concat([{ k: "stroke", pen: "auto", pts: [[0, 0]], built: r.objs }], r.presses) };
      const lv = SK.convert(t), q = G.run(G.makeWorld(lv.play, lv.header), SK.planEvents(t));
      return q.done || G.progressX(q.end) >= xEnd - 15;
    };
    if (c.kind === "path") return applyPath(sk, item, bricks, o, c);
    const r = snapShape(item.pts, bricks, o);
    if (r.literal) {   // as the ground pen draws it (blocks down to the ground), left to the layout fitter to make it play
      item.pen = "ground"; item.auto = { kind: "shape", literal: true }; sk.items.push(item);
      return { kind: c.kind, why: c.why, placed: [{ mode: o.mode, sig: "your shape, as drawn" }], note: "built as you drew it (no brick looks like it)" };
    }
    if (!r.placed.length) return { kind: c.kind, why: c.why, placed: [], note: "no brick fits here yet" };
    const last = r.placed[r.placed.length - 1];
    sk.items.push({ k: "stroke", pen: "auto", pts: item.pts, pin: true, built: r.objs,
      auto: { kind: c.kind, bricks: r.placed.map(p => p.id), last: last.mode, x1: last.x + last.w * B, err: r.err } });
    for (const p of r.presses) sk.items.push(p);
    return { kind: c.kind, why: c.why, placed: r.placed, err: r.err,
      note: (c.kind === "path" ? "path -> " : "shape -> ") + r.placed.map(p => p.mode + " " + (p.sig || "").split(" / ").slice(2).join(" ")).join(", ") };
  }

  function applyPath(sk, item, bricks, o, c) {
    const at = curveAt(item.pts), parts = stretches(item.pts), placed = [], flies = [], kept = sk.items.length;
    let mode = o.mode, err = 0, n = 0, x = Math.max(45, parts.length ? parts[0].x0 : 0);   // the player starts at 0: a portal goes in front of it
    for (const part of parts) {
      const x0 = Math.max(x, part.x0);
      if (part.air) {
        const fm = flyMode(at, x0, part.x1), cr = corridor(at, x0, part.x1, fm);
        sk.items.push({ k: "stroke", pen: "auto", pts: item.pts.filter(p => p[0] >= x0 && p[0] <= cr.x1), pin: true, built: cr.objs,
          auto: { kind: "path", fly: fm, last: "cube", x1: cr.x1 } });
        flies.push({ x0, x1: cr.x1, mode: fm, at: xx => Math.max(Math.floor((fm === "wave" ? 4 : 5) / 2), Math.min(7, Math.round(at(xx) - 0.5))) + 0.5 });
        placed.push({ mode: fm, sig: "fly / " + fm + " / corridor / your line", x: x0, w: (cr.x1 - x0) / B });
        // the holds so far, so the next ground part is checked with them
        for (let i = sk.items.length - 1; i >= 0; i--) if (sk.items[i].auto === "steer") sk.items.splice(i, 1);
        sk.items.push(...steer(sk, flies)); x = cr.x1; mode = "cube"; continue;
      }
      const sub = item.pts.filter(p => p[0] >= x0 && p[0] <= part.x1); if (sub.length < 2) { sub.length = 0; sub.push([x0, 15], [part.x1, 15]); }
      const r = fillPath(sub, bricks, Object.assign({}, o, { mode }));
      if (!r.placed.length) continue;
      const last = r.placed[r.placed.length - 1];
      sk.items.push({ k: "stroke", pen: "auto", pts: sub, pin: true, built: r.objs, auto: { kind: "path", bricks: r.placed.map(p => p.id), last: last.mode, x1: last.x + last.w * B, err: r.err } });
      sk.items.push(...r.presses); placed.push(...r.placed); err += r.err; n++; mode = last.mode; x = last.x + last.w * B;
    }
    if (!placed.length) return { kind: c.kind, why: c.why, placed, note: "no brick fits here yet" };
    return { kind: c.kind, why: c.why, placed, err: +(err / Math.max(1, n)).toFixed(2), added: sk.items.length - kept,
      note: "path -> " + placed.map(p => p.mode + " " + (p.sig || "").split(" / ").slice(2).join(" ")).join(", ") };
  }

  OUT.INTENT = { classify, fillPath, snapShape, apply, curveAt, topsOf, stretches, flyMode, corridor };
  if (NODE) Object.assign(OUT, OUT.INTENT);
})(typeof module !== "undefined" ? module.exports : (window.GD = window.GD || {}));
