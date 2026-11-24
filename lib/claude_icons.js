// The solver's own icon KIT ("Claude" in the viewer): one original pixel icon per mode -- cube, ship, ball, ufo,
// wave, robot, spider, swing -- that all share one motif and one palette, so the set reads as one player at a
// glance (the way a GD player's kit does: the user's reference pictures, 2026-11-24). Our own art: no logos,
// nothing of RobTop's. ART.md "Claude icons".
//   const CI = require("../lib/claude_icons.js");
//   CI.MODES, CI.KITS                     mode names; kit names ("spark", "spark2", "sparkface", "visor", "cmark", "smile")
//   CI.grid(mode, kit)                    a lib/pixelart.js grid (colour names: body shade plate plate2 mark eye outline)
//   CI.badge(size)                        the spark as a round badge, size px (24: 12 rays) -- the end sign
//   CI.palette(kit), CI.glow(kit)         {name: [r,g,b]}, [r,g,b]
//   CI.rgba(mode, scale, {kit, glow})     {w, h, rgba} picture (glow: a 1-pixel halo), for the viewer / previews
// Each mode is a body with a "face slot"; a kit draws its motif into every slot, so a new motif is one function.
// Pure JS (node + browser, after lib/pixelart.js).
"use strict";
(function (root) {
  const PA = typeof module !== "undefined" && module.exports ? require("./pixelart.js") : root.PIXELART;
  const MODES = ["cube", "ship", "ball", "ufo", "wave", "robot", "spider", "swing"];

  // ---- kits: a palette, what fills a head, and the motif drawn into each face slot ----
  const KITS = {
    // D / E / F: the Claude spark -- the user's "main traits" (2026-11-24): a radial starburst of thin rays in
    // terracotta and cream. Drawn here as pixel rays (our own drawing, not the logo image pasted in).
    spark: { title: "D  spark: cream rays on terracotta", motif: "spark", head: "body", glow: [255, 170, 110],
      pal: { outline: [44, 22, 16], body: [210, 112, 80], shade: [162, 78, 54], plate: [244, 236, 222], plate2: [218, 200, 176], mark: [248, 240, 226], eye: [60, 30, 24] } },
    spark2: { title: "E  spark: terracotta rays on cream", motif: "spark", head: "plate", disc: true, glow: [255, 170, 110],
      pal: { outline: [44, 22, 16], body: [210, 112, 80], shade: [162, 78, 54], plate: [246, 240, 228], plate2: [220, 204, 182], mark: [212, 108, 74], eye: [60, 30, 24] } },
    sparkface: { title: "F  spark with eyes (D + kit C's friendliness)", motif: "spark", head: "body", eyes: true, glow: [255, 170, 110],
      pal: { outline: [44, 22, 16], body: [210, 112, 80], shade: [162, 78, 54], plate: [244, 236, 222], plate2: [218, 200, 176], mark: [248, 240, 226], eye: [52, 26, 20] } },
    // A: the signature robot's face -- a dark visor with two amber eyes under a cream brow, terracotta body
    visor: { title: "A  visor bot", head: "plate", glow: [255, 150, 80],
      pal: { outline: [42, 22, 16], body: [214, 110, 72], shade: [164, 74, 48], plate: [246, 236, 218], plate2: [214, 194, 166], mark: [56, 32, 28], eye: [255, 198, 110] } },
    // B: a bold cream "C" on terracotta, an amber spark dot beside it
    cmark: { title: "B  C mark", head: "body", glow: [255, 176, 96],
      pal: { outline: [40, 20, 14], body: [204, 98, 62], shade: [150, 64, 40], plate: [246, 236, 218], plate2: [220, 200, 172], mark: [248, 238, 220], eye: [255, 200, 96] } },
    // C: a kind face -- happy closed eyes and a smile in dark brown on a cream face, rosy cheeks, terracotta body
    smile: { title: "C  happy face", head: "plate", glow: [255, 190, 130],
      pal: { outline: [44, 24, 18], body: [222, 120, 80], shade: [170, 82, 54], plate: [250, 238, 220], plate2: [226, 206, 178], mark: [60, 34, 28], eye: [246, 150, 130] } },
  };

  // ---- motifs: draw into slot [x, y, w, h] ----
  const MOTIF = {
    // a starburst: rays from the slot's centre, alternating long / short; a cream (or plate) disc under it on kit.disc
    spark(g, x, y, w, h, k) {
      const cx = x + w / 2 - 0.5, cy = y + h / 2 - 0.5, r = Math.min(w, h) / 2;
      if (k.disc) g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, "plate");
      const n = r >= 8 ? 12 : 8, r0 = r >= 4 ? 1.6 : 0.8;   // 12 rays need a 16+ px slot: at 16 px they smear           // a clear ring round the hub keeps the rays apart
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 2 * Math.PI + (n === 8 ? 0 : 0.13), L = (i % 2 ? 0.7 : 1) * (r - 0.2), ca = Math.cos(a), sa = Math.sin(a);
        g.line(cx + ca * r0, cy + sa * r0, cx + ca * L, cy + sa * L, "mark", 1);
      }
      g.set(Math.round(cx), Math.round(cy), "mark");
      if (k.eyes && r >= 3.5) { g.set(Math.round(cx) - 1, Math.round(cy), "eye"); g.set(Math.round(cx) + 1, Math.round(cy), "eye"); }
    },
    visor(g, x, y, w, h) {
      if (h >= 5) { g.rect(x, y, w, 2, "plate"); y += 2; h -= 2; }
      const vh = Math.min(3, h), vy = y + Math.floor((h - vh) / 2), c = x + w / 2, gap = w >= 10 ? 2 : 1;
      g.rect(x, vy, w, vh, "mark");
      const ey = vy + Math.floor(vh / 2), ew = w >= 8 ? 2 : 1;
      g.rect(Math.round(c - gap / 2 - ew), ey, ew, 1, "eye"); g.rect(Math.round(c + gap / 2), ey, ew, 1, "eye");
    },
    cmark(g, x, y, w, h) {
      const hh = Math.min(h, 9), ww = Math.max(3, Math.min(w - 2, hh - 1)), t = hh >= 7 ? 2 : 1;
      const x0 = Math.round(x + (w - ww - (hh >= 5 ? 2 : 0)) / 2), y0 = Math.round(y + (h - hh) / 2);
      g.rect(x0 + t, y0, ww - t, t, "mark"); g.rect(x0 + t, y0 + hh - t, ww - t, t, "mark"); g.rect(x0, y0 + t, t, hh - 2 * t, "mark");
      if (hh >= 5) { g.rect(x0 + ww + 1, y0 + Math.floor(hh / 2) - (t - 1), t, t, "eye"); }            // the spark dot
    },
    smile(g, x, y, w, h) {
      g.rect(x, y, w, h, "plate");
      const c = x + w / 2, ex = w >= 10 ? 3 : 2, ey = y + (h >= 6 ? 1 : 0);
      for (const s of [-1, 1]) {                                                                  // closed happy eyes: ^ ^
        const cx = Math.round(c + s * ex - 0.5);
        g.set(cx, ey, "mark"); g.set(cx - 1, ey + 1, "mark"); g.set(cx + 1, ey + 1, "mark");
      }
      if (h >= 5) {
        const sy = ey + 3, sw = w >= 10 ? 4 : 2;
        g.rect(Math.round(c - sw / 2), sy + 1, sw, 1, "mark"); g.set(Math.round(c - sw / 2) - 1, sy, "mark"); g.set(Math.round(c + sw / 2), sy, "mark");
        if (w >= 10) { g.set(x + 1, sy, "eye"); g.set(x + w - 2, sy, "eye"); }                     // cheeks
      }
    },
  };

  // ---- bodies: each returns {g, slot} before the motif and the outline ----
  const BODY = {
    cube(k) { const g = PA.grid(16, 16); g.rect(0, 0, 16, 16, "body"); g.rect(0, 13, 16, 3, "shade");
      if (k.head === "plate") g.rect(2, 2, 12, 10, "plate");
      return { g, slot: [2, 2, 12, 10], big: [1, 1, 14, 12], after: g => { g.set(1, 14, "plate2"); g.set(14, 14, "plate2"); } }; },
    ship(k) { const g = PA.grid(26, 18);
      g.poly([[1, 10], [25, 10], [21, 16], [4, 16]], "body"); g.poly([[4, 14], [22, 14], [21, 16], [4, 16]], "shade");
      g.poly([[1, 10], [6, 4], [9, 10]], "shade"); g.rect(18, 12, 5, 1, "plate");
      g.rect(10, 1, 9, 9, k.head); return { g, slot: [10, 2, 9, 7], big: [10, 1, 9, 9] }; },
    ball() { const g = PA.grid(16, 16); g.ellipse(8, 8, 8, 8, "body"); g.recolour("body", "shade", (x, y) => y >= 12);
      return { g, slot: [3, 3, 10, 8], big: [1, 1, 14, 11], clip: 8 }; },
    ufo(k) { const g = PA.grid(24, 16); g.ellipse(12, 8, 7, 7, k.head); g.rect(0, 9, 24, 7, null);
      g.ellipse(12, 11, 11.5, 3.5, "body"); g.recolour("body", "shade", (x, y) => y >= 12);
      for (const x of [4, 9, 14, 19]) g.rect(x, 11, 1, 1, "eye");
      return { g, slot: [7, 2, 10, 7], big: [6, 1, 12, 8] }; },
    wave() { const g = PA.grid(16, 12); g.poly([[0, 0], [15, 6], [0, 12], [4, 6]], "body"); g.poly([[0, 12], [4, 6], [15, 6]], "shade");
      return { g, slot: [3, 3, 7, 5] }; },
    robot(k) { const g = PA.grid(16, 20);
      g.rect(7, 0, 2, 1, "eye"); g.rect(7, 1, 2, 1, "plate2");
      g.rect(3, 2, 10, 8, k.head);
      g.rect(2, 10, 12, 5, "body"); g.rect(2, 13, 12, 2, "shade"); g.rect(6, 11, 4, 1, "plate");
      g.rect(0, 10, 2, 4, "shade"); g.rect(14, 10, 2, 4, "shade");
      g.rect(3, 15, 4, 4, "shade"); g.rect(9, 15, 4, 4, "shade"); g.rect(2, 19, 5, 1, "body"); g.rect(9, 19, 5, 1, "body");
      return { g, slot: [3, 2, 10, 8], big: [3, 1, 10, 9] }; },
    spider() { const g = PA.grid(24, 14); g.ellipse(12, 6.5, 7, 5.5, "body"); g.recolour("body", "shade", (x, y) => y >= 10);
      return { g, slot: [7, 2, 10, 7], big: [5, 1, 14, 10], clip: [12, 6.5, 7, 5.5],
        legs: o => { for (const [x0, xk, x1] of [[6, 3, 1], [8, 6, 5], [17, 19, 20], [18, 21, 23]]) { o.line(x0, 9, xk, 7, "plate2", 1); o.line(xk, 7, x1, 13, "plate2", 1); } } }; },
    swing() { const g = PA.grid(20, 18);
      g.poly([[2, 1], [14, 5], [8, 7]], "plate"); g.poly([[2, 17], [14, 13], [8, 11]], "plate");
      g.poly([[2, 1], [8, 7], [5, 6]], "plate2"); g.poly([[2, 17], [8, 11], [5, 12]], "plate2");
      g.ellipse(12, 9, 7, 6, "body"); g.recolour("body", "shade", (x, y) => y >= 13);
      return { g, slot: [7, 5, 10, 7], big: [5, 3, 14, 12], clip: [12, 9, 7, 6] }; },
  };

  const cache = {};
  function grid(mode, kit = "visor") {
    const key = mode + "/" + kit; if (cache[key]) return cache[key];
    const k = KITS[kit], b = BODY[mode]; if (!k || !b) throw new Error(`no icon ${mode}/${kit}; modes ${MODES.join(", ")}, kits ${Object.keys(KITS).join(", ")}`);
    const { g, slot: slot0, big, clip, legs, after } = b(k), slot = k.motif === "spark" && big ? big : slot0;   // the spark wants room
    const keep = clip ? (() => { const m = PA.grid(g.w, g.h); if (typeof clip === "number") m.ellipse(clip, clip, clip, clip, 1); else m.ellipse(clip[0], clip[1], clip[2], clip[3], 1); return m; })() : null;
    const before = g.c.slice();
    MOTIF[k.motif || kit](g, ...slot, k);
    if (keep) for (let i = 0; i < g.c.length; i++) if (!keep.c[i] && g.c[i] !== before[i]) g.c[i] = before[i];   // the motif stays inside a round body
    if (after) after(g);
    const o = g.outline("outline");
    if (legs) legs(o);
    return cache[key] = o;
  }
  // the spark as a round badge at a size where 12 rays stay apart (the end sign, props): terracotta disc, cream rays
  function badge(size = 24) {
    const g = PA.grid(size, size), r = size / 2, c = r - 0.5;
    g.ellipse(r, r, r - 0.5, r - 0.5, "body"); g.recolour("body", "shade", (x, y) => Math.hypot(x - c, y - c) > r - 2.5 && y > c);
    const n = size >= 20 ? 12 : 8;
    for (let i = 0; i < n; i++) { const a = (i / n) * 2 * Math.PI + 0.13, L = (i % 2 ? 0.62 : 0.86) * (r - 1), ca = Math.cos(a), sa = Math.sin(a);
      g.line(c + ca * 2, c + sa * 2, c + ca * L, c + sa * L, "mark", 1); }
    g.rect(Math.round(c) - 1, Math.round(c) - 1, 2, 2, "mark");
    return g.outline("outline");
  }
  const palette = kit => KITS[kit || "visor"].pal, glow = kit => KITS[kit || "visor"].glow;

  function rgba(mode, scale = 1, o = {}) {
    const kit = o.kit || "visor", g = grid(mode, kit), P = palette(kit), pad = o.glow ? 1 : 0, W = (g.w + 2 * pad) * scale, H = (g.h + 2 * pad) * scale;
    const out = new Uint8ClampedArray(W * H * 4);
    const put = (px, py, c, a) => { for (let j = 0; j < scale; j++) for (let i = 0; i < scale; i++) { const k = ((py * scale + j) * W + px * scale + i) * 4; out[k] = c[0]; out[k + 1] = c[1]; out[k + 2] = c[2]; out[k + 3] = a; } };
    if (o.glow) for (let y = -1; y <= g.h; y++) for (let x = -1; x <= g.w; x++) {
      if (g.get(x, y) != null) continue;
      let near = false; for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (g.get(x + dx, y + dy) != null) { near = true; break; }
      if (near) put(x + pad, y + pad, o.glowColour || glow(kit), 150);
    }
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) { const v = g.get(x, y); if (v != null) put(x + pad, y + pad, P[v], 255); }
    return { w: W, h: H, rgba: out };
  }

  const api = { MODES, KITS: Object.keys(KITS), KIT_DEFS: KITS, grid, badge, palette, glow, rgba,
    get PALETTE() { return palette("visor"); }, get GLOW() { return glow("visor"); } };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.CLAUDE_ICONS = api;
})(typeof window !== "undefined" ? window : globalThis);
