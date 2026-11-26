// Scene for the single-block design gallery (tools/blockdesigns.js spec): dresses the gallery's blocks, one design per
// column, ice on row 2 and fire on row 5, with a number and name over each. Channels 912-932 (the signature takes 973-989).
"use strict";
const K = require("../scenekit.js"), B = require("../blockdesigns.js");

module.exports = function ({ objects, header, spec }) {
  const g = spec.gallery, ice = B.channels(B.PAL.ice, 912), fire = B.channels(B.PAL.fire, 922);
  header = K.channels(header, Object.assign({}, ice.defs, fire.defs, { 932: { rgb: [200, 215, 240] } }));
  const out = [];
  out.push(K.text(4 * 30, 8 * 30, "BLOCK DESIGNS", 0.6, { ch: 932, z: "T1" }));
  out.push(K.text(4 * 30, 7.2 * 30, "top fire, bottom ice", 0.35, { ch: 932, z: "T1" }));
  B.DESIGNS.forEach((d, i) => {
    const c = g.x0 + i * g.w, cx = c * 30 + 15;
    out.push(...d.draw(cx, 2 * 30 + 15, ice.C), ...d.draw(cx, 5 * 30 + 15, fire.C));
    out.push(K.text(cx, 3.9 * 30, `${i + 1} ${d.name}`, 0.3, { ch: 932, z: "T1" }));
  });
  return { objects: objects.concat(out), header };
};
