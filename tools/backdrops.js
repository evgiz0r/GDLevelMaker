// node tools/backdrops.js list      the background deco pieces a design theme can pick from
//
// BACKGROUNDS FOR DESIGN THEMES (DECOART.md "Design themes"; Evgeni 2026-11-26: "in the theme we might already include
// somethings such as - background or a set of backgrounds. and background deco ( stars/clouds/geometrical stricutures)
// maybe also few options according to the theme"). A theme (tools/designthemes.js) carries:
//   skies     a set of skies ({bg, ground}): a section picks one by index ("sky": 1), else they go in turn
//   backdrops a few named options, each a list of the pieces below: a section picks one by name ("backdrop": "b"),
//             else the first
// Pieces (each (x0, x1, C, o) -> deco objects, behind the play on B2-B5; scenekit / decokit recipes):
//   stars      dots and crosses in the upper sky, twinkle-ready       clouds    a frame of clouds along the top
//   skyline    city towers with lit windows                           mountains far ranges + near hills (decokit)
//   geometry   big turned squares and thin circuit lines, far back    rings     large faint circles, nested
//   rays       light rays from above                                  motes     drifting dots (embers, spores, dust)
//   horizon    a glow along the horizon                               rocks     boulders along the ground, far
// C: the backdrop channels {far, mid, light, glow} (glow blending); the colours come from the theme's palette and sky.
"use strict";
const K = require("./scenekit.js");

const PIECES = {
  stars: (x0, x1, C, o) => K.starfield(x0, x1, { ch: C.light, y0: 150, y1: 420, density: 3, seed: o.seed }),
  clouds: (x0, x1, C, o) => K.cloudFrame(x0, x1, { ch: C.mid, top: 390, seed: o.seed }).filter(p => p.props[24] !== "7"),
  skyline: (x0, x1, C, o) => K.skyline(x0, x1, { ch: C.far, winCh: C.light, hMin: 3, hMax: 9, seed: o.seed, z: "B4" }),
  mountains: (x0, x1, C, o) => require("./decokit.js").backdrop(x0, x1, { far: C.far, mid: C.mid, seed: o.seed }),
  geometry: (x0, x1, C, o) => { const R = K.rng(o.seed || 17), out = [];
    for (let x = x0; x < x1; x += 150 + R() * 160) {
      const s = 2 + R() * 4, y = 90 + R() * 260, rot = R() < 0.5 ? 45 : 15 + R() * 30;
      out.push(K.obj(211, x, y, { ch: C.far, z: "B4", zo: -4, s, rot }));
      out.push(K.obj(211, x, y, { ch: C.mid, z: "B4", zo: -3, s: s * 0.8, rot, hsv: "0a1a0.7a0a0" }));
      if (R() < 0.5) out.push(K.obj(211, x, y, { ch: C.far, z: "B4", zo: -2, s: s * 0.45, rot }));
      // a circuit line running off it
      if (R() < 0.6) { const len = 60 + R() * 140, up = R() < 0.5;
        out.push(K.obj(211, x + len / 2, y, { ch: C.mid, z: "B4", zo: -3, sx: len / 30, sy: 0.07 }));
        out.push(K.obj(211, x + len, y + (up ? 30 : -30), { ch: C.mid, z: "B4", zo: -3, sx: 0.07, sy: 2 }));
        out.push(K.obj(1764, x + len, y + (up ? 60 : -60), { ch: C.light, z: "B4", zo: -2, s: 0.8 })); }
    } return out; },
  rings: (x0, x1, C, o) => { const R = K.rng(o.seed || 19), out = [];
    for (let x = x0 + 100; x < x1; x += 260 + R() * 200) { const y = 150 + R() * 200, s = 3 + R() * 3;
      for (let k = 0; k < 3; k++) out.push(K.obj(1764, x, y, { ch: k % 2 ? C.far : C.mid, z: "B5", zo: -6 + k, s: s * 3.7 * (1 - k * 0.22), hsv: k === 2 ? "0a1a0.6a0a0" : null })); }
    return out; },
  rays: (x0, x1, C, o) => K.lightRays(x0, x1, { ch: C.glow, z: "B2", every: 140, seed: o.seed, y: 430 }),
  motes: (x0, x1, C, o) => K.motes(x0, x1, { ch: C.light, z: "B2", density: 1.5, y0: 30, y1: 380, sMax: 0.6, seed: o.seed }),
  horizon: (x0, x1, C) => K.horizonGlow(x0, x1, { ch: C.glow, h: 5, z: "B5" }),
  rocks: (x0, x1, C, o) => K.rocks(x0, x1, { ch: C.far, z: "B4", seed: o.seed }),
};

// the channels' colours from a palette (tools/blockdesigns.js roles) and a sky: far = the sky a step lighter toward the
// palette's hue, mid = a step more, light = the palette's detail, dim; glow = the palette's glow (blending, faint)
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
function colours(P, sky) {
  return { far: mix(sky.bg, P.base, 0.45), mid: mix(sky.bg, P.base, 0.8), light: mix(P.detail, sky.bg, 0.35), glow: P.glow };
}
function draw(names, x0, x1, C, o = {}) { const out = [];
  for (const n of [].concat(names || [])) { const f = PIECES[n]; if (!f) throw new Error("no backdrop piece " + n);
    out.push(...f(x0, x1, C, Object.assign({}, o, { seed: (o.seed || 1) * 31 + n.length }))); }
  return out; }

module.exports = { PIECES, colours, draw };
if (require.main === module) {
  if (process.argv[2] === "list") console.log(Object.keys(PIECES).join(", "));
  else console.log(require("fs").readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n"));
}
