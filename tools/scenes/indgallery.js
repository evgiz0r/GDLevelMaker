// Scene for the jump indicator gallery (tools/indstyles.js spec): each style's name over its stretch, channel 932.
"use strict";
const K = require("../scenekit.js");
module.exports = function ({ objects, header, spec }) {
  header = K.channels(header, { 932: { rgb: [200, 215, 240] } });
  const out = [K.text(18 * 30, 7 * 30, "INDICATOR STYLES", 0.6, { ch: 932, z: "T1" })];
  for (const [c, name] of spec.labels.filter(l => l[1] !== "none")) out.push(K.text((c + 14) * 30, 5 * 30, name, 0.45, { ch: 932, z: "T1" }));
  return { objects: out, header };   // only the new objects: make.js appends them (returning objects.concat(out) doubled the level)
};
