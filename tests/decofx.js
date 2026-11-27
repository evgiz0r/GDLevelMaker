// node tests/decofx.js -- tools/decofx.js: every pass adds its pieces, the front layer stays out of the play,
// every channel it uses is defined (nothing drawn white in the game), and 1293 draws as a gradient in lib/look.js
"use strict";
const assert = require("assert"), path = require("path");
const io = require("../tools/io.js"), FX = require("../tools/decofx.js"), K = require("../tools/scenekit.js"), O = require("../lib/objects.js");
const R = io.readGdlvl(path.join(__dirname, "..", "levels", "gdlm_44_hellgate.gdlvl")), L = R.level;
for (const theme of ["fire", "ice"]) {
  const lv = { header: L.header, objects: L.objects.slice() };
  const r = FX.fx(lv, 0, 88 * 30, { theme });
  const ids = r.objects.map(o => o.id);
  assert(ids.filter(i => i === 1293).length > 20, theme + ": glow gradients");
  assert(r.objects.some(o => o.props[24] === "9"), theme + ": a front (T3) layer");
  assert(r.objects.some(o => o.id === 1007) && r.objects.some(o => o.id === 901), theme + ": fades and moves");
  // channels used by the new objects are all defined by the pass or by blockart's range (900-911)
  for (const o of r.objects) { const c = +o.props[21]; if (c) assert(r.channels[c] || (c >= 900 && c < 912), theme + ": channel " + c + " undefined"); }
  // hanging silhouettes: their lowest point stays 60+ units over the play below them
  for (const o of r.objects.filter(o => o.id === 693 && o.props[24] === "9")) {
    const tip = o.y - 15 * +(o.props[129] || 1);
    const play = L.objects.filter(b => Math.abs(b.x - o.x) < 90 && !["decoration", "trigger"].includes(O.objInfo(b.id).kind)).reduce((m, b) => Math.max(m, b.y + 15), 0);
    assert(tip >= play + 55, `${theme}: silhouette at x ${o.x} reaches ${tip.toFixed(0)}, play top ${play}`);
  }
}
// blockart.layered on off-grid blocks (beat-synced x): the dressing sits on the real blocks, and at an inner corner the
// black inline runs on to meet the wall's inline (Evgeni 2026-11-26: "not exactly coherent in the corners")
{ const BA = require("../tools/blockart.js"), off = 8.9, mk = (x, y) => ({ id: 1, x: x + off, y, rot: 0, props: {} });
  const lv = { header: "", objects: [mk(15, 15), mk(45, 15), mk(45, 45)] };
  const r = BA.layered(lv, 0, 300, { seed: 1 });
  const bases = r.objects.filter(o => o.id === 211 && o.props[25] === "4");
  assert.deepStrictEqual(bases.map(o => o.x).sort((a, b) => a - b), [15 + off, 45 + off, 45 + off], "bases on the real block centres");
  const inl = r.objects.filter(o => o.props[21] === String(r.CH.inline));
  const top0 = inl.find(o => Math.abs(o.y - (30 - 6)) < 0.01 && o.x < 30 + off);          // the top inline of the low cell
  const right = top0.x + 15 * +top0.props[128];
  assert(Math.abs(right - (30 + off + 6 + 0.9)) < 0.05, "inner corner: the top inline runs 6 units into the wall (" + right + ")");
  assert(inl.every(o => o.props[25] === "7") && r.objects.filter(o => o.props[21] === String(r.CH.line)).every(o => o.props[25] === "8"), "inline one z-order under the outline");
}
const look = require("fs").readFileSync(path.join(__dirname, "..", "lib", "look.js"), "utf8");
assert(/1293: \["grad"/.test(look), "look.js draws 1293 as a gradient");
console.log("ok decofx");
