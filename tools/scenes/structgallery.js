// Scene for the structure design gallery (tools/structdesign.js spec): dresses each copy of the connector sheet with its
// design and 3D effect, in ice or fire, a label over each. Channels 912-931 as the single-block gallery, 932 the labels.
"use strict";
const K = require("../scenekit.js"), B = require("../blockdesigns.js"), D = require("../structdesign.js");
const SOLID = new Set([1, 2, 3, 4, 5, 6, 7, 1338]);
module.exports = function ({ objects, header, spec }) {
  const pal = { ice: B.channels(B.PAL.ice, 912), fire: B.channels(B.PAL.fire, 922) };
  header = K.channels(header, Object.assign({}, pal.ice.defs, pal.fire.defs, { 932: { rgb: [200, 215, 240] } }));
  const out = [K.text(4 * 30, 8 * 30, "STRUCTURE DESIGNS", 0.6, { ch: 932, z: "T1" }), K.text(4 * 30, 7.2 * 30, "one design on every join", 0.35, { ch: 932, z: "T1" })];
  const blocks = objects.filter(o => SOLID.has(o.id) && o.y > 45);
  for (const cp of spec.copies) {
    const mine = blocks.filter(b => b.x >= cp.c0 * 30 && b.x < cp.c1 * 30 + 30);
    out.push(...D.dress(mine, cp.design, pal[cp.pal].C, { effects: cp.effects }));
    out.push(K.text((cp.c0 + cp.c1) / 2 * 30, 7.4 * 30, cp.label, 0.45, { ch: 932, z: "T1" }));
  }
  return { objects: out, header };   // only the new objects: make.js appends them (returning objects.concat(out) doubled the level)
};
