// A generic scene: gd-art's deco kit (tools/decokit.js) dressed in each section's own colours, for levels without a
// hand-made scene -- in particular every part of a collab build (tools/collab.js: a brief's "scene": "tools/scenes/kit.js"
// decorates each part where its builder builds it). Spec key "scene"; run by tools/make.js after the gameplay.
// - Sections: read from the spec's bg colour triggers (compose puts one at every section start); each gets its own
//   palette, faded in at its start: bricks + lit top trims inside the play blocks, three backdrop depths (mountains B5,
//   hills B4, tree line B3) paler toward the sky in a SECOND, cooler hue (gd-art vs Dreamy: "pink scenery on a pink sky"),
//   grass tufts clear of hazards.
// - Motion on every screen (ART.md "Deco study": the strongest sign of a featured level): the grass sways.
// - Nothing in front of a hazard (tools/contrast.js "deco over hazards").
// Channels 60-65 (the modern pass uses 20 + 2 per section; 988-999 the signature).
"use strict";
const K = require("../scenekit.js"), D = require("../decokit.js");
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const lum = c => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;

module.exports = function ({ objects, header, spec }) {
  const C = { far: 60, mid: 61, near: 62, fill: 63, trim: 64, grass: 65 };
  // the sections from the spec's bg / ground colour triggers
  const trig = (spec.objects || []).filter(e => e[0] === "colour" && e[2] && (e[2].ch === "bg" || e[2].ch === "ground"));
  const cols = [...new Set(trig.filter(e => e[2].ch === "bg").map(e => e[1]))].sort((a, b) => a - b);
  if (!cols.length) cols.push(0);
  const gameEnd = Math.max(...objects.map(o => o.x)) + 60;
  const secs = cols.map((c, i) => {
    const bg = (trig.filter(e => e[2].ch === "bg" && e[1] <= c).pop() || [0, 0, { rgb: [40, 60, 160] }])[2].rgb;
    const ground = (trig.filter(e => e[2].ch === "ground" && e[1] <= c + 1).pop() || [0, 0, { rgb: bg.map(v => v * 0.4) }])[2].rgb;
    return { x0: c * 30, x1: i + 1 < cols.length ? cols[i + 1] * 30 : gameEnd, bg, ground };
  });
  // a palette per section: the distance in a cooler hue than the sky (blue-violet for warm skies, teal for cool ones),
  // paler toward the sky; the play's fill a step under the ground, its trim a lit version of the path
  const pal = secs.map(s => {
    const warm = s.bg[0] > s.bg[2], shade = warm ? [80, 90, 150] : [40, 110, 120], dark = lum(s.bg) < 0.35;
    const d = D.depthColours(s.bg, dark ? s.bg.map(v => v * 0.35) : shade, dark ? [0.25, 0.4, 0.55] : [0.3, 0.45, 0.6]);
    return { [C.far]: d.far, [C.mid]: d.mid, [C.near]: d.near, [C.fill]: mix(s.ground, [0, 0, 0], 0.15), [C.trim]: mix(s.ground, dark ? [200, 230, 255] : [255, 245, 200], 0.55), [C.grass]: mix(s.ground, [120, 200, 90], 0.35) };
  });
  const defs = {}; for (const [ch, rgb] of Object.entries(pal[0])) defs[ch] = { rgb, blend: false, opacity: 1 };
  header = K.channels(header, defs);
  const out = [];
  secs.forEach((s, i) => {
    if (i > 0) out.push(...K.palette(s.x0 - 45, pal[i], 0.6));   // fades in to the section start, not snapped onto its beat
    out.push(...D.blockPattern(objects, s.x0, s.x1, { ch: C.fill, top: C.trim, seed: 40 + i }));
    out.push(...D.backdrop(s.x0, s.x1, { far: C.far, mid: C.mid, near: C.near, trees: lum(s.bg) < 0.35 ? "dead tree" : "tree", density: 1.5, seed: 7 + i }));
    out.push(...D.tufts(objects, s.x0, s.x1, { ch: C.grass, seed: 60 + i, group: 412 }));
  });
  out.push(...K.sway(secs[0].x0, gameEnd, 412, 7, 100, 0.35));
  // nothing in front of a hazard (within a block), except what dresses a solid block
  const O = require("../../lib/objects.js"), kindOf = o => (O.objInfo(o.id) || {}).kind;
  const haz = objects.filter(o => kindOf(o) === "hazard"), solidCell = new Set(objects.filter(o => kindOf(o) === "solid").map(o => Math.floor(o.x / 30) + ":" + Math.floor(o.y / 30)));
  const front = o => { const z = o.props && o.props[24]; return z != null && z !== "" && +z >= 1; };
  const kept = out.filter(o => !(o.x != null && kindOf(o) !== "trigger" && front(o) && !solidCell.has(Math.floor(o.x / 30) + ":" + Math.floor(o.y / 30))
    && haz.some(h => Math.abs(h.x - o.x) < 30 && Math.abs(h.y - o.y) < 30)));
  return { objects: kept, header };
};
