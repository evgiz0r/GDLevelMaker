// node tests/pixelart.js -- the pixel-art converter (lib/pixelart.js) and the prop library (lib/props.js):
// the objects redraw the picture exactly (painter's order), stay deco-only, and stay within budget.
"use strict";
const assert = require("assert"), PA = require("../lib/pixelart.js"), P = require("../lib/props.js");
const O = require("../lib/objects.js");

// redraw objects onto a grid (later z order on top) and compare with the source
function redraw(g, r, px) {
  const out = PA.grid(g.w, g.h);
  const sorted = r.objects.slice().sort((a, b) => +a.props[25] - +b.props[25]);
  for (const o of sorted) {
    const sx = +(o.props[128] || o.props[32]) * 30 / px, sy = +(o.props[129] || o.props[32]) * 30 / px;
    const cx = (o.x - r.box.left) / px, cy = (r.box.top - o.y) / px;
    for (let y = Math.round(cy - sy / 2); y < Math.round(cy + sy / 2); y++) for (let x = Math.round(cx - sx / 2); x < Math.round(cx + sx / 2); x++) out.set(x, y, o.props[21]);
  }
  return out;
}
let n = 0;
// 1. random grids: exact redraw
for (let seed = 1; seed <= 30; seed++) {
  let s = seed; const R = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const g = PA.grid(12 + (seed % 7), 10 + (seed % 5)), cols = ["a", "b", "c", "d"].slice(0, 2 + seed % 3);
  for (let i = 0; i < g.c.length; i++) g.c[i] = R() < 0.2 ? null : cols[Math.floor(R() * cols.length)];
  for (let k = 0; k < 3; k++) g.rect(Math.floor(R() * 8), Math.floor(R() * 6), 4, 3, cols[k % cols.length]);
  const ch = {}; cols.forEach((c, i) => ch[c] = 100 + i);
  const r = PA.toObjects(g, { x: 0, y: 0, px: 5, ch, anchor: "bottomleft" });
  const back = redraw(g, r, 5);
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const want = g.get(x, y) == null ? null : String(ch[g.get(x, y)]);
    assert.strictEqual(back.get(x, y), want, `seed ${seed}: pixel ${x},${y}`);
  }
  assert(r.count <= r.pixels, "never more objects than pixels"); n++;
}
// 2. every prop: deco only, within budget, has a size and colours
for (const it of P.list()) {
  const r = P.put(it.name, 300, 0, {});
  for (const o of r.objects) assert.notStrictEqual((O.objInfo(o.id) || {}).kind, "hazard", `${it.name}: object ${o.id} is a hazard`);
  for (const o of r.objects) assert(["decoration", undefined].includes((O.objInfo(o.id) || {}).kind) || [110, 85].includes(o.id), `${it.name}: object ${o.id} is ${(O.objInfo(o.id) || {}).kind}`);
  assert(r.count > 0 && r.count <= 120, `${it.name}: ${r.count} objects`);
  assert(it.size.h <= 7, `${it.name}: ${it.size.h} blocks high (TASTE: props stay under ~7)`);
  for (const ch of Object.keys(r.colours)) assert(+ch < 988 || +ch > 999, "props keep off the signature's channels 988-999");
  n++;
}
// 3. a shared allocator shares channels by colour name
const a = P.allocator(700), r1 = P.put("tree", 0, 0, { alloc: a }), r2 = P.put("bush", 300, 0, { alloc: a });
assert.strictEqual(a.map.leaf, 700 + Object.keys(a.map).indexOf("leaf"));
assert(Object.keys(r2.colours).every(c => Object.keys(r1.colours).includes(c) || +c >= 700), "bush reuses tree's leaf channel");
// 4. header gets the channels
const h = P.header("kS38,1_0_2_0_3_0_6_1000|,kA2,0", r1.colours);
for (const ch of Object.keys(r1.colours)) assert(h.includes(`_6_${ch}_`), "channel " + ch + " in header");
// 5. place() is seeded and stays inside [x0, x1]
const p1 = P.place("tombstone", 0, 900, { seed: 3 }), p2 = P.place("tombstone", 0, 900, { seed: 3 });
assert.deepStrictEqual(p1.xs, p2.xs); assert(p1.xs.length >= 2 && p1.xs.every(x => x > 0 && x < 900));
console.log(`ok (${n} checks + allocator, header, place)`);
