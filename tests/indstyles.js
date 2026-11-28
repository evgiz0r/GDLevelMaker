// node tests/indstyles.js -- jump indicator styles (tools/indstyles.js): every style's pieces sit in the indicator group on
// the indicator's channel, near the mark; upside down they turn over; a list of [column, style] picks by x; "none" drops
"use strict";
const assert = require("assert"), S = require("../tools/indstyles.js"), D = require("../tools/decorate.js");
const I = D.INDICATOR, mark = (x, up) => ({ id: I.id, x, y: up ? 60 : 240, rot: up ? I.rot : I.rot + 180, props: {} });
for (const name of Object.keys(S.STYLES)) {
  const ps = S.expand([mark(300, true)], { style: name });
  assert(ps.length >= 1, name);
  for (const p of ps) { assert.strictEqual(p.props[57], String(I.group), name + " group"); assert.strictEqual(p.props[21], String(I.ch), name + " channel");
    assert(Math.abs(p.x - 300) < 20 && Math.abs(p.y - 60) < 20, name + " near the mark"); }
  const dn = S.expand([mark(300, false)], { style: name });
  assert.deepStrictEqual(dn.map(p => +(p.y - 240).toFixed(2)), ps.map(p => -(p.y - 60).toFixed(2) || 0), name + " turned over");
}
assert.strictEqual(S.styleAt({ style: [[0, "caret"], [10, "halo"]] }, 400), "halo");
assert.strictEqual(S.expand([mark(30, true)], { style: [[0, "none"]] }).length, 0);
assert.strictEqual(S.expand([mark(30, true)], {})[0].id, I.id);   // no style: the old single chevron, unchanged
console.log("indstyles: ok");
// colour "auto": opposite the hazards' hue; white hazards -> a soft cyan; the channel goes in the header
{
  const K = require("../tools/scenekit.js"), hdr = K.channels("kS38,|,kA4,0", { 5: { rgb: [255, 40, 40] } });
  const red = S.colourFor([{ id: 8, x: 100, y: 15, props: { 21: "5" } }], hdr);
  assert(red.hazardHue < 15 || red.hazardHue > 345, "red hazards"); assert(red.rgb[0] < Math.max(red.rgb[1], red.rgb[2]), "not a red mark");
  // ... and away from the sky (the default blue one here): Hellgate's violet marks on a violet sky, 2026-11-28
  { const h = S.rgbHsv ? S.rgbHsv(red.rgb)[0] : null; if (h != null) assert(Math.min(Math.abs(h - 214), 360 - Math.abs(h - 214)) >= 60, "mark hue " + h + " too near the blue sky"); }
  assert.strictEqual(S.colourFor([{ id: 8, x: 100, y: 15, props: {} }], hdr).hazardHue, null);
  const c = S.applyColour([{ id: 8, x: 100, y: 15, props: { 21: "5" } }], hdr, { colour: "auto" });
  assert.strictEqual(c.ch, S.CH); assert(c.header.includes("_6_" + S.CH));
  assert.strictEqual(S.applyColour([], hdr, {}).ch, null);
  console.log("indstyles colour: ok");
}
