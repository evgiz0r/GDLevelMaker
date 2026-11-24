// The whiteboard's sketch -> a GD level (viewer/draw.html; DRAW.md). A sketch is drawn freehand in level units
// (30 = one block, x right, y up, ground top at y = 0, the player starts at x = 0) -- no grid: every stroke and
// every stamp keeps the exact spot it was drawn at, and the conversion keeps it (objects are placed off the grid).
//
//   const SK = require("../lib/sketch.js");        // browser: window.GD.SKETCH (load after props.js + gd.js)
//   const r = SK.convert(sketch)    -> { objects, header, levelStr, colours, notes, endX, counts }
//   SK.layerOf(item)                -> "play" | "deco" | "note"
//   SK.simplify(pts, eps)           Ramer-Douglas-Peucker on a freehand stroke ([[x, y], ...])
//   SK.timeToX(sketch, t) / xToTime(sketch, x)   through the sketch's speed stamps (beat lines, song time)
//
// A sketch: { v: 1, name, speed: 1 (start speed index: 0 = 0.5x, 1 = 1x, 2 = 2x, 3 = 3x, 4 = 4x), song: {custom | official,
//   bpm, t0, offset}, items: [...] }. Items:
//   { k: "stroke", pen, pts: [[x, y], ...], col, w, front, flip }
//     pen "ground"    a surface top; filled with blocks down to the ground. Its steepness picks the piece per column:
//                     flat blocks, 22 or 45 degree slopes, a wall where it jumps (rules: DRAW.md "Reading strokes")
//     pen "platform"  blocks along the line wherever it goes (a floating platform, a wall, a ceiling)
//     pen "spikes"    spikes along the line, standing on it, turned to the line (snapped upright within 12
//                     degrees); they point away from the nearest solid, so a line under a ceiling hangs them
//     pen "deco"      a coloured line: stretched deco squares (211) along it, col [r, g, b], w its width in units,
//                     behind the play (layer B2) or in front (front: true, T1); no hitbox
//     pen "note"      the user's own note for whoever builds the level: never in the level
//   { k: "stamp", what, x, y, rot, s, flipX }    one object exactly there. what: a key of STAMPS (orbs, pads,
//     portals, speed, gravity, spike, saw, block...) or "prop:<name>" (lib/props.js: tree, cloud, house, ...: deco)
//   { k: "press", x, x1, y }   "I jump here" (pen "jump"): a tap at x, or a hold from x to x1. Not objects: the plan the
//     level is built around (BUILDING.md: presses before blocks). planEvents(sk) turns them into input events;
//     the page replays them at once and says where they die
//   { k: "text", x, y, text }                     a note on the board (never in the level)
// A ground, blocks or spikes stroke that comes back to where it started (a loop) is an AREA: ground / blocks fill it,
// spikes line its floor.
//
// Pure JS, no node APIs (runs in the viewer). Test: node tests/sketch.js.
(function (OUT) {
  "use strict";
  const NODE = typeof module !== "undefined" && module.exports === OUT;
  const G = NODE ? Object.assign({}, require("./gd.js"), require("./objects.js"), require("./physics.js")) : OUT;
  const P = NODE ? require("./props.js") : (typeof window !== "undefined" ? window.PROPS : null);

  const STAMPS = {
    "orb:yellow": 36, "orb:pink": 141, "orb:red": 1333, "orb:blue": 84, "orb:green": 1022, "orb:black": 1330, "orb:dash": 1704, "orb:spider": 3004,
    "pad:yellow": 35, "pad:pink": 140, "pad:red": 1332, "pad:blue": 67, "pad:spider": 3005,
    "portal:cube": 12, "portal:ship": 13, "portal:ball": 47, "portal:ufo": 111, "portal:wave": 660, "portal:robot": 745,
    "portal:spider": 1331, "portal:swing": 1933, "grav:up": 11, "grav:down": 10, "size:mini": 101, "size:big": 99,
    "dual:on": 286, "dual:off": 287,
    "speed:0.5": 200, "speed:1": 201, "speed:2": 202, "speed:3": 203, "speed:4": 1334,
    "spike": 8, "small spike": 39, "saw": 89, "small saw": 98, "big saw": 88, "block": 1, "slab": 40,
  };
  const SPEED_OF = { 200: 0, 201: 1, 202: 2, 203: 3, 1334: 4 };
  const PEN_LAYER = { ground: "play", platform: "play", spikes: "play", deco: "deco", note: "note" };
  function layerOf(it) {
    if (it.k === "press") return "plan";
    if (it.k === "stroke") return PEN_LAYER[it.pen] || "note";
    if (it.k === "stamp") return /^prop:/.test(it.what) ? "deco" : "play";
    return "note";
  }

  // ---- geometry helpers ----
  function simplify(pts, eps) {
    if (pts.length < 3) return pts.slice();
    const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
    const st = [[0, pts.length - 1]];
    while (st.length) {
      const [a, b] = st.pop(); const [ax, ay] = pts[a], [bx, by] = pts[b];
      const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-9; let m = -1, md = 0;
      for (let i = a + 1; i < b; i++) { const d = Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / L; if (d > md) { md = d; m = i; } }
      if (md > eps) { keep[m] = 1; st.push([a, m], [m, b]); }
    }
    return pts.filter((p, i) => keep[i]);
  }
  // walk a polyline: a point every `step` units of length, starting `first` in, with the local direction
  function walk(pts, step, first) {
    const out = []; let next = first, acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], L = Math.hypot(bx - ax, by - ay);
      if (!L) continue;
      while (next <= acc + L) { const f = (next - acc) / L; out.push({ x: ax + (bx - ax) * f, y: ay + (by - ay) * f, dx: (bx - ax) / L, dy: (by - ay) / L }); next += step; }
      acc += L;
    }
    if (!out.length && pts.length) { const a = pts[0], b = pts[pts.length - 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; out.push({ x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, dx: (b[0] - a[0]) / L || 1, dy: (b[1] - a[1]) / L }); }
    return out;
  }
  // the highest point of a polyline above x (null where it has none)
  function topAt(pts, x) {
    let best = null;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      if ((x < Math.min(ax, bx)) || (x > Math.max(ax, bx))) continue;
      const y = bx === ax ? Math.max(ay, by) : ay + (by - ay) * (x - ax) / (bx - ax);
      if (best === null || y > best) best = y;
    }
    return best;
  }
  function isLoop(pts) {
    if (pts.length < 4) return false;
    let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const a = pts[0], b = pts[pts.length - 1];
    return len > 90 && Math.hypot(a[0] - b[0], a[1] - b[1]) < Math.max(25, len * 0.12);
  }
  // the inside of a loop above x: [[y0, y1], ...] bottom to top
  function spansAt(pts, x) {
    const ys = [], n = pts.length;
    for (let i = 0; i < n; i++) { const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % n];
      if ((ax <= x && bx > x) || (bx <= x && ax > x)) ys.push(ay + (by - ay) * (x - ax) / (bx - ax)); }
    ys.sort((a, b) => a - b); const out = [];
    for (let i = 0; i + 1 < ys.length; i += 2) out.push([ys[i], ys[i + 1]]);
    return out;
  }
  function areaPen(it, out) {
    const xs = it.pts.map(p => p[0]), x0 = Math.min(...xs), x1 = Math.max(...xs), n = Math.max(1, Math.round((x1 - x0) / 30));
    for (let i = 0; i < n; i++) {
      const xc = x0 + (x1 - x0) * (i + 0.5) / n;
      for (const [ya, yb] of spansAt(it.pts, xc)) {
        if (it.pen === "spikes") { out.push(obj(8, xc, Math.max(0, ya) + 15)); continue; }
        if (yb - ya < 12) continue;
        for (let yy = yb - 15; yy + 15 > Math.max(ya, 0) + 8; yy -= 30) out.push(obj(1, xc, yy));   // top flush with the area's top
      }
    }
  }
  const r2 = v => Math.round(v * 100) / 100;
  const obj = (id, x, y, extra) => Object.assign({ id, x: r2(x), y: r2(y), rot: 0, flipX: false, flipY: false, props: {} }, extra || {});

  // ---- the pens ----
  // ground: columns 30 wide from where the stroke starts (not snapped); the piece per column from how far the line
  // climbs over it, the column filled down to the ground
  function groundPen(pts, out) {
    const xs = pts.map(p => p[0]), x0 = Math.min(...xs), x1 = Math.max(...xs);
    const n = Math.max(1, Math.round((x1 - x0) / 30));
    let y = null;
    const fill = (xc, top) => { if (top < 8) return; for (let yy = top - 15; yy + 15 > 1; yy -= 30) out.push(obj(1, xc, yy)); };
    for (let i = 0; i < n; i++) {
      const xL = x0 + i * 30, xc = xL + 15, here = topAt(pts, Math.min(x1, xc));
      if (here === null) { y = null; continue; }
      if (y === null) y = here;
      const T = topAt(pts, Math.min(x1, xL + 30)), T2 = topAt(pts, Math.min(x1, xL + 60));
      const d = T === null ? 0 : T - y, d2 = T2 === null ? d : T2 - y;
      if (y < 4 && d < 9) { y = Math.max(y, 0); if (d < -9) y = Math.max(0, T); continue; }   // on the ground: nothing to build
      if (d >= 50 || d <= -50) { fill(xc, y); y = T; continue; }                                 // a wall: the next column starts at the new height
      if (d >= 22) { out.push(obj(1338, xc, y + 15)); fill(xc, y); y += 30; continue; }       // 45 up
      if (d <= -22) { out.push(obj(1338, xc, y - 15, { flipX: true })); fill(xc, y - 30); y -= 30; continue; }
      if ((d > 9 || d2 >= 22) && i + 1 < n && d2 > 9) { out.push(obj(1339, xL + 30, y + 15)); fill(xc, y); fill(xc + 30, y); y += 30; i++; continue; }   // 22 up, two columns
      if ((d < -9 || d2 <= -22) && i + 1 < n && d2 < -9 && y >= 30) { out.push(obj(1339, xL + 30, y - 15, { flipX: true })); fill(xc, y - 30); fill(xc + 30, y - 30); y -= 30; i++; continue; }
      fill(xc, y);                                                                               // flat at the line's height (off the grid)
      if (d < -9) y = T;                                                                         // a drop: safe as a step
    }
  }
  // platform: a block every 30 units along the line; lying flat its top is the line, standing it is centred on it
  function platformPen(pts, out) {
    const placed = [];
    for (const p of walk(pts, 30, 15)) {
      const flat = Math.abs(p.dx) >= Math.abs(p.dy), x = p.x, y = flat ? p.y - 15 : p.y;
      if (placed.some(q => Math.abs(q[0] - x) < 22 && Math.abs(q[1] - y) < 22)) continue;
      placed.push([x, y]); out.push(obj(1, x, y));
    }
  }
  function spikesPen(it, pts, out, solids) {
    const near = (x, y) => solids.some(o => { const h = G.hitbox(o); return h && x > h.x0 - 4 && x < h.x1 + 4 && y > h.y0 - 4 && y < h.y1 + 4; });
    for (const p of walk(pts, 30, 15)) {
      let nx = -p.dy, ny = p.dx;                                        // left of the direction it was drawn
      if (ny < 0 || (ny === 0 && nx > 0)) { nx = -nx; ny = -ny; }       // up by default
      if (near(p.x + nx * 20, p.y + ny * 20) && !near(p.x - nx * 20, p.y - ny * 20)) { nx = -nx; ny = -ny; }   // a solid on that side: point away
      if (it.flip) { nx = -nx; ny = -ny; }
      let rot = Math.atan2(nx, ny) * 180 / Math.PI;                    // clockwise from up
      const q = Math.round(rot / 90) * 90; if (Math.abs(rot - q) < 12) rot = q;
      const a = rot * Math.PI / 180;
      out.push(obj(8, p.x + Math.sin(a) * 15, p.y + Math.cos(a) * 15, { rot: ((Math.round(rot) % 360) + 360) % 360 }));
    }
  }
  // deco line: one stretched square per straight piece of the (simplified) line, a little longer so joints close
  function decoPen(it, pts, out, chOf, zo) {
    const w = it.w || 6, ch = chOf(it.col || [255, 255, 255]), layer = it.front ? 5 : 1;
    const sp = simplify(pts, Math.max(1, w * 0.25));
    if (sp.length === 1) sp.push([sp[0][0] + 0.1, sp[0][1]]);
    for (let i = 1; i < sp.length; i++) {
      const [ax, ay] = sp[i - 1], [bx, by] = sp[i], L = Math.hypot(bx - ax, by - ay);
      if (L < 0.05) continue;
      out.push(obj(211, (ax + bx) / 2, (ay + by) / 2, { rot: r2(-Math.atan2(by - ay, bx - ax) * 180 / Math.PI),
        props: { 21: String(ch), 22: String(ch), 24: String(layer), 25: String(zo), 128: String(r2((L + w * 0.9) / 30)), 129: String(r2(w / 30)) } }));
    }
  }

  // ---- speed and time ----
  const unitsPerSec = sp => G.SPEEDS[sp].x * 60;
  function speedMarks(sk) {
    const marks = (sk.items || []).filter(it => it.k === "stamp" && SPEED_OF[STAMPS[it.what]] != null).map(it => ({ x: it.x, sp: SPEED_OF[STAMPS[it.what]] })).sort((a, b) => a.x - b.x);
    return [{ x: -1e9, sp: sk.speed == null ? 1 : sk.speed }].concat(marks);
  }
  function xToTime(sk, x) {
    const m = speedMarks(sk); let t = 0, px = 0, sp = m[0].sp;
    for (const k of m.slice(1)) { if (k.x <= 0) { sp = k.sp; continue; } if (k.x >= x) break; t += (k.x - px) / unitsPerSec(sp); px = k.x; sp = k.sp; }
    return t + (x - px) / unitsPerSec(sp);
  }
  function timeToX(sk, t) {
    const m = speedMarks(sk); let tt = 0, px = 0, sp = m[0].sp;
    for (const k of m.slice(1)) { if (k.x <= 0) { sp = k.sp; continue; } const dt = (k.x - px) / unitsPerSec(sp); if (tt + dt >= t) break; tt += dt; px = k.x; sp = k.sp; }
    return px + (t - tt) * unitsPerSec(sp);
  }

  // ---- the whole sketch ----
  function convert(sk) {
    const items = sk.items || [], play = [], deco = [], notes = [], colours = {};
    const decoCh = {}; let nextCh = 800;
    const chOf = c => { const k = c.join(","); if (!decoCh[k]) { decoCh[k] = nextCh++; colours[decoCh[k]] = c.slice(); } return decoCh[k]; };
    const alloc = P ? P.allocator(600) : null;
    const strokes = items.filter(it => it.k === "stroke" && it.pts && it.pts.length);
    for (const it of strokes) {
      if ((it.pen === "ground" || it.pen === "platform") && isLoop(it.pts)) areaPen(it, play);
      else if (it.pen === "ground") groundPen(it.pts, play); else if (it.pen === "platform") platformPen(it.pts, play);
    }
    for (const it of items) if (it.k === "stamp" && STAMPS[it.what] != null) {
      const id = STAMPS[it.what], o = obj(id, it.x, it.y, { rot: Math.round(it.rot || 0), flipX: !!it.flipX });
      if (it.s && it.s !== 1) o.props[32] = String(r2(it.s));
      play.push(o);
    }
    const solids = play.filter(o => { const k = G.objInfo(o.id).kind; return k === "solid" || k === "slope"; });
    for (const it of strokes) if (it.pen === "spikes") { if (isLoop(it.pts)) areaPen(it, play); else spikesPen(it, it.pts, play, solids); }
    let zo = 0;
    for (const it of items) {
      if (it.k === "stroke" && it.pen === "deco") decoPen(it, it.pts, deco, chOf, zo++);
      else if (it.k === "stamp" && /^prop:/.test(it.what) && P) {
        try {
          const r = P.put(it.what.slice(5), it.x, it.y, { alloc, scale: it.s || 1, flipX: !!it.flipX, seed: it.seed || 0 });
          for (const o of r.objects) { if (o.props) delete o.props[155]; deco.push(o); }   // never 155 (CLAUDE.md "The format")
          Object.assign(colours, r.colours);
        } catch (e) { notes.push("prop " + it.what + ": " + e.message); }
      } else if (it.k === "stroke" && it.pen === "note" || it.k === "text") notes.push(it.text || "a drawn note");
    }
    const objects = play.concat(deco);
    const KA4 = { 0: 1, 1: 0, 2: 2, 3: 3, 4: 4 };                       // our speed index -> the header's (0 = 1x there)
    let header = String(G.DEFAULT_HEADER).replace(/kA4,\d+/, "kA4," + KA4[sk.speed == null ? 1 : sk.speed]);
    if (sk.song && sk.song.offset) header = header.replace(/kA13,[\d.]*/, "kA13," + sk.song.offset);
    if (P && Object.keys(colours).length) header = P.header(header, colours);
    const levelStr = G.serializeLevel({ header, objects });
    const endX = objects.reduce((m, o) => Math.max(m, o.x), 0) + 90;
    const counts = { play: play.length, deco: deco.length, solids: solids.length, spikes: play.filter(o => o.id === 8).length };
    return { objects, play, deco, header, levelStr, colours, notes, endX, counts };
  }

  // the "I jump here" marks as input events (taps: press + release a tick later; holds: press at x, release at x1)
  function planEvents(sk) {
    const TPS = G.PHYS.TPS, ev = [];
    for (const it of (sk.items || []).filter(i => i.k === "press").sort((a, b) => a.x - b.x)) {
      const t = Math.max(0, Math.round(xToTime(sk, it.x) * TPS));
      const r = it.x1 != null && it.x1 > it.x + 6 ? Math.max(t + 1, Math.round(xToTime(sk, it.x1) * TPS)) : t + 1;
      ev.push({ tick: t, type: "press" }, { tick: r, type: "release" });
    }
    ev.sort((a, b) => a.tick - b.tick || (a.type === "release" ? -1 : 1));
    return ev.filter((e, i) => !(ev[i + 1] && ev[i + 1].tick === e.tick && ev[i + 1].type === e.type));
  }

  OUT.SKETCH = { STAMPS, convert, planEvents, isLoop, layerOf, simplify, walk, topAt, timeToX, xToTime, unitsPerSec };
  if (NODE) Object.assign(OUT, OUT.SKETCH);
})(typeof module !== "undefined" ? module.exports : (window.GD = window.GD || {}));
