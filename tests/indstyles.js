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
