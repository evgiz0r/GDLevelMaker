// Scene for the holder gallery (tools/connect.js spec): each copy's islands dressed in the layered structure design and
// held in one holder style, its name over it. Channels as the structure gallery (912-931), 932 the labels.
"use strict";
const K = require("../scenekit.js"), B = require("../blockdesigns.js"), SD = require("../structdesign.js"), CN = require("../connect.js");
module.exports = function ({ objects, header, spec }) {
  const pal = { ice: B.channels(B.PAL.ice, 912), fire: B.channels(B.PAL.fire, 922) };
  header = K.channels(header, Object.assign({}, pal.ice.defs, pal.fire.defs, { 932: { rgb: [200, 215, 240] } }));
  const out = [K.text(16 * 30, 9.5 * 30, "HOLDERS", 0.6, { ch: 932, z: "T1" })];
  const blocks = objects.filter(o => o.id === 1 && o.y > 45);
  for (const cp of spec.copies) {
    const mine = blocks.filter(b => b.x >= cp.c0 * 30 && b.x < (cp.c1 + 1) * 30), C = pal[cp.pal].C;
    out.push(...SD.dress(mine, "layered", C), ...CN.draw(CN.connectors(mine), C, { style: cp.style }));
    out.push(K.text((cp.c0 + 13) * 30, 8.6 * 30, cp.style, 0.45, { ch: 932, z: "T1" }));
  }
  return { objects: out, header };   // only the new objects: make.js appends them (returning objects.concat(out) doubled the level)
};
