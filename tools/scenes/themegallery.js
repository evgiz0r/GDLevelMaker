// Scene for the design themes gallery (tools/designthemes.js spec): each theme's name over its stretch, channel 932.
"use strict";
const K = require("../scenekit.js");
module.exports = function ({ objects, header, spec }) {
  header = K.channels(header, { 932: { rgb: [225, 225, 235] } });
  const out = [K.text(16 * 30, 10 * 30, "DESIGN THEMES", 0.6, { ch: 932, z: "T1" })];
  for (const [c, name] of spec.labels) out.push(K.text((c + 8) * 30, 9 * 30, name.toUpperCase(), 0.5, { ch: 932, z: "T1" }));
  return { objects: objects.concat(out), header };
};
