// The solver's own icon set ("Claude" in the viewer): one original pixel icon per mode -- cube, ship, ball, UFO,
// wave, robot, spider, swing -- in the spirit of the signature robot (a visor with two warm eyes, an antenna),
// warm colours (terracotta, cream, amber glow). Our own art, no logos, nothing of RobTop's. ART.md "Claude icons".
//   const CI = require("../lib/claude_icons.js");
//   CI.MODES                      ["cube", "ship", ...]
//   CI.grid(mode)                 a lib/pixelart.js grid (colour names below), 1 pixel = 1/16 of a block for the cube
//   CI.PALETTE                    {name: [r,g,b]} -- body, shade, cream, cream2, visor, eye, outline; CI.GLOW the glow colour
//   CI.rgba(mode, scale, {glow})  {w, h, rgba} picture (glow: a 1-pixel halo in CI.GLOW), for the viewer / previews
// Pure JS (node + browser, after lib/pixelart.js).
"use strict";
(function (root) {
  const PA = typeof module !== "undefined" && module.exports ? require("./pixelart.js") : root.PIXELART;
  const PALETTE = {
    outline: [46, 26, 20], body: [214, 112, 74], shade: [168, 78, 52], cream: [246, 236, 218], cream2: [218, 198, 170],
    visor: [58, 34, 30], eye: [255, 196, 112],
  };
  const GLOW = [255, 150, 80];
  const MODES = ["cube", "ship", "ball", "ufo", "wave", "robot", "spider", "swing"];

  // a visor band with two eyes, the signature robot's face
  function face(g, x, y, w, eyeGap) {
    g.rect(x, y, w, 3, "visor");
    const c = x + w / 2;
    g.rect(Math.round(c - eyeGap / 2 - 2), y + 1, 2, 1, "eye"); g.rect(Math.round(c + eyeGap / 2), y + 1, 2, 1, "eye");
  }
  const DRAW = {
    cube() {
      const g = PA.grid(16, 16);
      g.rect(0, 0, 16, 16, "body"); g.rect(0, 12, 16, 4, "shade");
      g.rect(2, 2, 12, 2, "cream"); g.rect(2, 2, 1, 1, "cream2"); g.rect(13, 2, 1, 1, "cream2");   // a cream brow plate
      face(g, 2, 5, 12, 2);
      g.rect(6, 10, 4, 1, "cream");                                                               // a small smile line
      for (const [x, y] of [[2, 13], [13, 13]]) g.rect(x, y, 1, 1, "cream2");                    // rivets
      return g.outline("outline");
    },
    ship() {
      const g = PA.grid(26, 18);
      g.poly([[1, 10], [25, 10], [21, 16], [4, 16]], "body"); g.poly([[4, 14], [22, 14], [21, 16], [4, 16]], "shade");
      g.poly([[1, 10], [6, 4], [9, 10]], "shade");                                                // tail fin
      g.rect(10, 1, 8, 9, "cream"); face(g, 10, 4, 8, 1); g.rect(13, 0, 2, 1, "eye");             // the pilot: a little robot head
      g.rect(18, 12, 5, 1, "cream");                                                              // a stripe on the hull
      return g.outline("outline");
    },
    ball() {
      const g = PA.grid(16, 16);
      g.ellipse(8, 8, 8, 8, "body"); g.recolour("body", "shade", (x, y) => y >= 11);
      g.rect(1, 3, 14, 2, "cream");
      const keep = PA.grid(16, 16); keep.ellipse(8, 8, 8, 8, 1);
      face(g, 2, 6, 12, 2);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (!keep.get(x, y)) g.set(x, y, null);
      g.rect(7, 12, 2, 2, "cream2");                                                              // a hub bolt
      return g.outline("outline");
    },
    ufo() {
      const g = PA.grid(24, 16);
      g.ellipse(12, 7.5, 6.5, 6.5, "cream"); g.rect(4, 8, 16, 8, null);
      face(g, 7, 4, 10, 2);
      g.ellipse(12, 10.5, 11.5, 3.5, "body"); g.recolour("body", "shade", (x, y) => y >= 12);
      for (const x of [4, 9, 14, 19]) g.rect(x, 10, 1, 1, "eye");                                 // saucer lights
      return g.outline("outline");
    },
    wave() {
      const g = PA.grid(16, 12);
      g.poly([[0, 0], [15, 6], [0, 12], [4, 6]], "body"); g.poly([[0, 12], [4, 6], [15, 6]], "shade");
      g.poly([[2, 3], [9, 6], [4, 6]], "cream");
      g.rect(8, 5, 2, 1, "eye");
      return g.outline("outline");
    },
    robot() {
      const g = PA.grid(16, 20);
      g.rect(7, 0, 2, 2, "eye"); g.rect(7.5, 2, 1, 1, "cream2");                                 // antenna
      g.rect(3, 2, 10, 7, "cream"); face(g, 3, 4, 10, 2);
      g.rect(2, 9, 12, 6, "body"); g.rect(2, 13, 12, 2, "shade"); g.rect(6, 10, 4, 2, "cream");   // chest plate
      g.rect(0, 10, 2, 4, "shade"); g.rect(14, 10, 2, 4, "shade");                                // arms
      g.rect(3, 15, 4, 4, "visor"); g.rect(9, 15, 4, 4, "visor"); g.rect(2, 19, 5, 1, "shade"); g.rect(9, 19, 5, 1, "shade");
      return g.outline("outline");
    },
    spider() {
      const g = PA.grid(24, 14);
      g.ellipse(12, 6.5, 7, 5, "body"); g.recolour("body", "shade", (x, y) => y >= 9);
      g.rect(7, 2, 10, 2, "cream"); face(g, 6, 4, 12, 3);
      const o = g.outline("outline");
      // legs after the outline: thin cream-shaded lines, two each side, knees up
      for (const [x0, xk, x1] of [[6, 3, 1], [8, 6, 5], [17, 19, 20], [18, 21, 23]]) { o.line(x0, 8, xk, 6, "cream2", 1); o.line(xk, 6, x1, 13, "cream2", 1); }
      return o;
    },
    swing() {
      const g = PA.grid(20, 18);
      g.poly([[2, 1], [14, 5], [8, 7]], "cream"); g.poly([[2, 17], [14, 13], [8, 11]], "cream");  // wings, swept back
      g.poly([[2, 1], [8, 7], [5, 6]], "cream2"); g.poly([[2, 17], [8, 11], [5, 12]], "cream2");
      g.ellipse(12, 9, 7, 5.5, "body"); g.recolour("body", "shade", (x, y) => y >= 11);
      face(g, 6, 7, 12, 2);
      return g.outline("outline");
    },
  };
  const cache = {};
  function grid(mode) { if (!DRAW[mode]) throw new Error(`no icon for "${mode}"; there are ${MODES.join(", ")}`); return cache[mode] || (cache[mode] = DRAW[mode]()); }

  // the icon as an RGBA picture, each pixel scale x scale; glow: a halo one icon-pixel wide around it
  function rgba(mode, scale = 1, o = {}) {
    const g = grid(mode), pad = o.glow ? 1 : 0, W = (g.w + 2 * pad) * scale, H = (g.h + 2 * pad) * scale;
    const out = new Uint8ClampedArray(W * H * 4);
    const put = (px, py, c, a) => { for (let j = 0; j < scale; j++) for (let i = 0; i < scale; i++) { const k = ((py * scale + j) * W + px * scale + i) * 4; out[k] = c[0]; out[k + 1] = c[1]; out[k + 2] = c[2]; out[k + 3] = a; } };
    if (o.glow) for (let y = -1; y <= g.h; y++) for (let x = -1; x <= g.w; x++) {
      if (g.get(x, y) != null) continue;
      let near = false; for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (g.get(x + dx, y + dy) != null) { near = true; break; }
      if (near) put(x + pad, y + pad, o.glowColour || GLOW, 150);
    }
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) { const v = g.get(x, y); if (v != null) put(x + pad, y + pad, PALETTE[v], 255); }
    return { w: W, h: H, rgba: out };
  }

  const api = { MODES, PALETTE, GLOW, grid, rgba };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.CLAUDE_ICONS = api;
})(typeof window !== "undefined" ? window : globalThis);
