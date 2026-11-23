// Pixel art -> GD objects. The core of tools/pixelart.js (pictures) and lib/props.js (the prop library).
// ART.md: what works, the object counts, what is unchecked in the game.
//
//   const PA = require("../lib/pixelart.js");
//   const g = PA.grid(16, 16);                      // a canvas of colour names (null = empty)
//   g.ellipse(8, 8, 7, 6, "orange"); g.rect(7, 0, 2, 3, "stem");   // drawing (x right, y DOWN, row 0 on top)
//   const g2 = PA.fromRows(["..aa..", ".abba."], { a: "dark", b: "skin" });   // or hand-drawn rows
//   const r = PA.toObjects(g, { x, y, px: 4, ch: { orange: 401, stem: 402 }, z: "B2" });
//   r.objects   // GD objects: deco square 211 scaled into rectangles (keys 128 / 129), no hitbox
//   r.count, r.byColour
//
// How it saves objects: (1) a run of same-colour pixels becomes ONE square stretched into a rectangle
// (2.2's separate scale X / Y); (2) painter's order -- colours are drawn bottom-up (biggest area first) and a
// colour's rectangles may run under the pixels of any colour drawn above it, so a pumpkin is one orange
// block or so under its eyes, not dozens around them. Each colour gets its own z order (key 25) so the
// order holds in the game. Typical: a 16x16 sprite of 4-6 colours -> 25-60 objects.
//
// Pure: no node APIs, runs in the browser too (like the rest of lib/).
"use strict";
(function (root) {
  const LAYERS = { B5: -5, B4: -3, B3: -1, B2: 1, B1: 3, T1: 5, T2: 7, T3: 9, T4: 11 };
  const r3 = v => String(Math.round(v * 1000) / 1000);
  const SQUARE = 211;            // lightsquare_01_05_color: a plain white 1x1 square, decoration (no hitbox)

  // ---- the canvas ----
  function grid(w, h) {
    const g = { w, h, c: new Array(w * h).fill(null) };
    const inb = (x, y) => x >= 0 && y >= 0 && x < g.w && y < g.h;
    g.get = (x, y) => inb(x, y) ? g.c[y * g.w + x] : null;
    g.set = (x, y, v) => { x = Math.round(x); y = Math.round(y); if (inb(x, y)) g.c[y * g.w + x] = v; return g; };
    g.rect = (x, y, w2, h2, v) => { for (let j = 0; j < h2; j++) for (let i = 0; i < w2; i++) g.set(x + i, y + j, v); return g; };
    // filled ellipse centred (cx, cy) (pixel centres at .5 offsets are fine), radii rx, ry
    g.ellipse = (cx, cy, rx, ry, v) => {
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) g.set(x, y, v);
      }
      return g;
    };
    g.ring = (cx, cy, rx, ry, t, v) => {
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
        const dx = (x + 0.5 - cx), dy = (y + 0.5 - cy), o = (dx / rx) ** 2 + (dy / ry) ** 2, i = (dx / Math.max(0.1, rx - t)) ** 2 + (dy / Math.max(0.1, ry - t)) ** 2;
        if (o <= 1 && i > 1) g.set(x, y, v);
      }
      return g;
    };
    // a line from (x0,y0) to (x1,y1), t pixels thick
    g.line = (x0, y0, x1, y1, v, t = 1) => {
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
      for (let k = 0; k <= n; k++) {
        const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n;
        if (t <= 1) g.set(Math.floor(x), Math.floor(y), v);
        else for (let j = -t / 2; j < t / 2; j++) for (let i = -t / 2; i < t / 2; i++) g.set(Math.floor(x + i + 0.5), Math.floor(y + j + 0.5), v);
      }
      return g;
    };
    // filled polygon [[x,y],...] (scanline, pixel centres)
    g.poly = (pts, v) => {
      for (let y = 0; y < g.h; y++) {
        const yc = y + 0.5, xs = [];
        for (let i = 0; i < pts.length; i++) {
          const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
          if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + (yc - ay) / (by - ay) * (bx - ax));
        }
        xs.sort((a, b) => a - b);
        for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - 0.5); x + 0.5 <= xs[k + 1]; x++) g.set(x, y, v);
      }
      return g;
    };
    // paint a hand-drawn block of rows at (x, y): rows of characters, legend {char: colour}; '.' / ' ' skip
    g.stamp = (x, y, rows, legend) => { rows.forEach((row, j) => [...row].forEach((ch, i) => { if (legend[ch] !== undefined) g.set(x + i, y + j, legend[ch]); })); return g; };
    // replace one colour with another inside a region test fn(x, y)
    g.recolour = (from, to, fn) => { for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.get(x, y) === from && (!fn || fn(x, y))) g.c[y * g.w + x] = to; return g; };
    // a 1-pixel outline of colour v around everything drawn (grows the canvas by 1 on each side)
    g.outline = (v, diag = false) => {
      const o = grid(g.w + 2, g.h + 2);
      for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) o.c[(y + 1) * o.w + x + 1] = g.get(x, y);
      const add = [];
      for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) {
        if (o.get(x, y) != null) continue;
        const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].concat(diag ? [[1, 1], [1, -1], [-1, 1], [-1, -1]] : []);
        if (n.some(([dx, dy]) => o.get(x + dx, y + dy) != null)) add.push([x, y]);
      }
      for (const [x, y] of add) o.set(x, y, v);
      return o;
    };
    g.flipX = () => { const o = grid(g.w, g.h); for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) o.c[y * g.w + x] = g.get(g.w - 1 - x, y); return o; };
    g.colours = () => { const m = {}; for (const v of g.c) if (v != null) m[v] = (m[v] || 0) + 1; return m; };
    g.text = () => { const keys = Object.keys(g.colours()), ch = "abcdefghijklmnopqrstuvwxyz0123456789"; const rows = [];
      for (let y = 0; y < g.h; y++) { let s = ""; for (let x = 0; x < g.w; x++) { const v = g.get(x, y); s += v == null ? "." : ch[keys.indexOf(v)] || "?"; } rows.push(s); }
      return rows.join("\n") + "\n" + keys.map((k, i) => ch[i] + "=" + k).join(" "); };
    return g;
  }
  function fromRows(rows, legend) { const w = Math.max(...rows.map(r => r.length)); return grid(w, rows.length).stamp(0, 0, rows, legend); }

  // ---- rectangles: painter's-order merge ----
  // order: colour names bottom -> top (default: by area, largest first). Returns [{v, x, y, w, h}] in draw order.
  function rects(g, order) {
    const area = g.colours();
    order = (order || Object.keys(area).sort((a, b) => area[b] - area[a])).filter(v => area[v]);
    const rank = {}; order.forEach((v, i) => rank[v] = i);
    const out = [];
    for (const v of order) {
      const me = rank[v];
      const allowed = (x, y) => { const c = g.get(x, y); return c != null && rank[c] >= me; };
      const done = new Uint8Array(g.w * g.h);
      const need = (x, y) => g.get(x, y) === v && !done[y * g.w + x];
      for (let y0 = 0; y0 < g.h; y0++) for (let x0 = 0; x0 < g.w; x0++) {
        if (!need(x0, y0)) continue;
        // candidates: anchored at the seed's row, for every height grow right then left as far as allowed
        let best = null;
        for (let h = 1; y0 + h <= g.h; h++) {
          let ok = true; for (let j = 0; j < h; j++) if (!allowed(x0, y0 + j)) ok = false;
          if (!ok) break;
          let x1 = x0; while (x1 + 1 < g.w && [...Array(h).keys()].every(j => allowed(x1 + 1, y0 + j))) x1++;
          let xa = x0; while (xa - 1 >= 0 && [...Array(h).keys()].every(j => allowed(xa - 1, y0 + j))) xa--;
          // also try growing upwards (rows above the seed may still hold uncovered cells of v? no: scan order
          // covered them already -- but extending over them is free, so grow up as far as allowed)
          let ya = y0; while (ya - 1 >= 0) { let k = true; for (let i = xa; i <= x1; i++) if (!allowed(i, ya - 1)) { k = false; break; } if (!k) break; ya--; }
          let gain = 0; for (let j = y0; j < y0 + h; j++) for (let i = xa; i <= x1; i++) if (need(i, j)) gain++;
          const a = (x1 - xa + 1) * (y0 + h - ya);
          if (!best || gain > best.gain || (gain === best.gain && a < best.a)) best = { gain, a, x: xa, y: ya, w: x1 - xa + 1, h: y0 + h - ya };
        }
        for (let j = best.y; j < best.y + best.h; j++) for (let i = best.x; i < best.x + best.w; i++) if (g.get(i, j) === v) done[j * g.w + i] = 1;
        out.push({ v, x: best.x, y: best.y, w: best.w, h: best.h });
      }
    }
    return { rects: out, order };
  }
  // the paint order with the fewest rectangles: start from "by area" and "by how far a colour spreads"
  // (an outline wraps everything, so it goes at the bottom), then move single colours while it helps
  // bottom: names pinned at the bottom in that order (a glow under everything)
  function bestOrder(g, fixed, bottom) {
    if (fixed) return rects(g, fixed);
    const area = g.colours(), pin = (bottom || []).filter(v => area[v]), names = Object.keys(area).filter(v => !pin.includes(v));
    const span = v => { let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (g.get(x, y) === v) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return (x1 - x0 + 1) * (y1 - y0 + 1); };
    const sp = {}; names.forEach(v => sp[v] = span(v));
    let best = null;
    for (const start of [names.slice().sort((a, b) => area[b] - area[a]), names.slice().sort((a, b) => sp[b] - sp[a] || area[b] - area[a])]) {
      let cur = rects(g, pin.concat(start));
      for (let improved = true, rounds = 0; improved && rounds < 4; rounds++) {
        improved = false;
        for (let i = pin.length; i < cur.order.length; i++) for (let j = pin.length; j < cur.order.length; j++) {
          if (i === j) continue;
          const o = cur.order.slice(); const [v] = o.splice(i, 1); o.splice(j, 0, v);
          const r = rects(g, o);
          if (r.rects.length < cur.rects.length) { cur = r; improved = true; }
        }
      }
      if (!best || cur.rects.length < best.rects.length) best = cur;
    }
    return best;
  }

  // ---- GD objects ----
  // opts: x, y      where the grid goes, GD units; anchor says which point of the grid that is:
  //                 "bottom" (default: bottom-centre, for things standing on y), "top" (top-centre, hanging
  //                 from y), "center", "bottomleft"
  //       px        units per pixel (30 = a block; 3.75 = 8 pixels a block)
  //       ch        {colour name: channel} -- every colour needs one (an unmapped name -> ch.default or 1)
  //       chKeys    which object keys carry the channel: "both" (21 and 22, default -- works whether GD colours
  //                 211 by its main or its detail channel), "main", "detail"
  //       z         layer (name B5..T4 or number, key 24; default "B2": behind the player, in front of B3-B5)
  //       zo        first z order (key 25; default 0); each colour in the paint order gets the next one
  //       order     paint order bottom -> top (colour names)
  //       groups    [n] on every object (key 57: move / alpha / rotate the prop)
  //       groupOf   {colour: [n]} extra groups per colour (e.g. a glowing eye that pulses)
  //       opacity   {colour: 0..1} -> HSV can't do alpha; use a channel with that opacity instead (see props)
  //       flipX     mirror
  //       gap       shrink each rectangle by this many units per side (0 default; 0.1 hides seams? see ART.md)
  function toObjects(g, o = {}) {
    if (o.flipX) g = g.flipX();
    const px = o.px || 3.75, anchor = o.anchor || "bottom";
    const W = g.w * px, H = g.h * px;
    let left = o.x || 0, top = (o.y || 0);
    if (anchor === "bottom") { left -= W / 2; top += H; }
    else if (anchor === "top") left -= W / 2;
    else if (anchor === "center") { left -= W / 2; top += H / 2; }
    else if (anchor === "bottomleft") top += H;
    const { rects: rs, order } = bestOrder(g, o.order, o.bottom);
    const zo0 = o.zo == null ? 0 : o.zo, z = o.z == null ? "B2" : o.z;
    const keys = o.chKeys || "both";
    const objects = [], byColour = {};
    for (const r of rs) {
      const ch = (o.ch && (o.ch[r.v] != null ? o.ch[r.v] : o.ch.default)) || 1;
      const cx = left + (r.x + r.w / 2) * px, cy = top - (r.y + r.h / 2) * px;
      const gap = o.gap || 0;
      const p = { 155: "1", 24: String(typeof z === "string" ? LAYERS[z] : z), 25: String(zo0 + order.indexOf(r.v)) };
      if (keys !== "detail") p[21] = String(ch);
      if (keys !== "main") p[22] = String(ch);
      const sx = (r.w * px - 2 * gap) / 30, sy = (r.h * px - 2 * gap) / 30;
      if (Math.abs(sx - sy) < 1e-6) p[32] = r3(sx); else { p[128] = r3(sx); p[129] = r3(sy); }
      const gr = [].concat(o.groups || [], (o.groupOf && o.groupOf[r.v]) || []);
      if (gr.length) p[57] = gr.join(".");
      if (o.props) Object.assign(p, o.props);
      objects.push({ id: SQUARE, x: +cx.toFixed(2), y: +cy.toFixed(2), rot: 0, flipX: false, flipY: false, props: p });
      byColour[r.v] = (byColour[r.v] || 0) + 1;
    }
    const pixels = g.c.filter(v => v != null).length;
    return { objects, count: objects.length, pixels, byColour, order, size: { w: W / 30, h: H / 30 }, box: { left, top, right: left + W, bottom: top - H } };
  }

  // ---- colours from a picture ----
  // rgba: Uint8 array w*h*4. k-means on the opaque pixels into at most k colours. Returns a grid whose
  // colour names are "c0".."c{k-1}" and palette {c0: [r,g,b], ...}. alphaMin: below = empty.
  function quantise(rgba, w, h, k = 6, alphaMin = 128) {
    const pts = [];
    for (let i = 0; i < w * h; i++) if (rgba[i * 4 + 3] >= alphaMin) pts.push([rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2], i]);
    const g = grid(w, h);
    if (!pts.length) return { grid: g, palette: {} };
    // distinct colours first: if there are <= k, use them exactly
    const uniq = new Map(); for (const p of pts) { const key = p[0] << 16 | p[1] << 8 | p[2]; uniq.set(key, (uniq.get(key) || 0) + 1); }
    let cent;
    if (uniq.size <= k) cent = [...uniq.keys()].map(key => [key >> 16 & 255, key >> 8 & 255, key & 255]);
    else {
      // k-means++ seeding on the most common colours, then 12 rounds
      const common = [...uniq.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => [key >> 16 & 255, key >> 8 & 255, key & 255]);
      cent = [common[0]];
      while (cent.length < k) {
        let far = null, fd = -1;
        for (const c of common.slice(0, 2000)) { const d = Math.min(...cent.map(m => (m[0] - c[0]) ** 2 + (m[1] - c[1]) ** 2 + (m[2] - c[2]) ** 2)); if (d > fd) { fd = d; far = c; } }
        if (fd <= 0) break; cent.push(far.slice());
      }
      for (let it = 0; it < 12; it++) {
        const sum = cent.map(() => [0, 0, 0, 0]);
        for (const p of pts) { let bi = 0, bd = 1e9; cent.forEach((m, i) => { const d = (m[0] - p[0]) ** 2 + (m[1] - p[1]) ** 2 + (m[2] - p[2]) ** 2; if (d < bd) { bd = d; bi = i; } }); const s = sum[bi]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; }
        cent = cent.map((m, i) => sum[i][3] ? [sum[i][0] / sum[i][3], sum[i][1] / sum[i][3], sum[i][2] / sum[i][3]].map(Math.round) : m);
      }
    }
    for (const p of pts) { let bi = 0, bd = 1e9; cent.forEach((m, i) => { const d = (m[0] - p[0]) ** 2 + (m[1] - p[1]) ** 2 + (m[2] - p[2]) ** 2; if (d < bd) { bd = d; bi = i; } }); g.c[p[3]] = "c" + bi; }
    const palette = {}; cent.forEach((m, i) => palette["c" + i] = m);
    return { grid: g, palette };
  }
  // shrink a grid by an integer factor (majority colour of each block; empty wins ties with < half filled)
  function downscale(g, f) {
    const o = grid(Math.ceil(g.w / f), Math.ceil(g.h / f));
    for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) {
      const n = {}; let filled = 0, tot = 0;
      for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) { const v = g.get(x * f + i, y * f + j); tot++; if (v != null) { filled++; n[v] = (n[v] || 0) + 1; } }
      if (filled * 2 >= tot) o.c[y * o.w + x] = Object.keys(n).sort((a, b) => n[b] - n[a])[0];
    }
    return o;
  }

  const api = { grid, fromRows, rects, bestOrder, toObjects, quantise, downscale, LAYERS, SQUARE };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.PIXELART = api;
})(this);
