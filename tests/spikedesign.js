// node tests/spikedesign.js -- the spike / saw designs (tools/spikedesign.js): every design dresses a standing, a hanging and a
// side-turned hazard with decoration only, keeps the readability rules, turns with the hazard, and the gallery level clears
// with no press and the same run with or without its designs.
const assert = require("assert");
const SD = require("../tools/spikedesign.js"), { GD } = require("../tools/io.js");

const spike = (o = {}) => Object.assign({ id: 8, x: 300, y: 15, rot: 0, flipX: false, flipY: false, props: { 21: "933" } }, o);
const saw = { id: 89, x: 300, y: 120, rot: 0, flipX: false, flipY: false, props: { 21: "933" } };
let n = 0;
for (const [name, d] of Object.entries(SD.DESIGNS)) {
  const hs = d.kind === "spike" ? [spike(), spike({ flipY: true, y: 285 }), spike({ rot: 90 })] : [saw];
  for (const h of hs) {
    const parts = SD.dress(h, name);
    assert(parts.length > 0, name + ": no parts");
    for (const p of parts) assert.strictEqual(GD.objInfo(p.id).kind, "decoration", `${name}: part ${p.id} is not decoration`);
    const bad = SD.check(parts); assert.strictEqual(bad.length, 0, `${name}: ${bad.map(b => b.why).join("; ")}`);
    // parts stay on the hazard (within 1.5 of its size)
    for (const p of parts) assert(Math.hypot(p.x - h.x, p.y - h.y) <= 1.5 * 15 * (d.kind === "saw" ? 2 : 1), `${name}: part ${p.id} strays`);
    n++;
  }
  // the wrong kind gets nothing
  assert.strictEqual(SD.dress(d.kind === "spike" ? saw : spike(), name).length, 0, name + ": dressed the wrong kind");
}
// a hanging spike's inner copy hangs too, and sits on the same side as its base
const up = SD.dress(spike(), "inner")[0], down = SD.dress(spike({ flipY: true, y: 285 }), "inner")[0];
assert(up.y < 15 && !up.flipY, "inner: the standing copy sits low, upright");
assert(down.y > 285 && down.flipY, "inner: the hanging copy sits high, flipped");
// a turned spike's inner copy is turned with it and moved along its base direction (rot 90: base to the left)
const side = SD.dress(spike({ rot: 90 }), "inner")[0];
assert(side.rot === 90 && side.x < 300 && Math.abs(side.y - 15) < 1e-6, "inner: turns with the spike");
// the check catches a part that covers the spike's edge
const big = SD.dress(spike(), "inner")[0]; big._part = Object.assign({}, big._part, { rel: 1 });
assert(SD.check([big]).length > 0, "check: a front part at 1x must be flagged");
// the gallery
const b = SD.gallery({});
assert(b.measures.clears, "gallery dies: " + b.measures.why);
assert(!b.measures.decoChangesRun, "the designs change the run");
assert.strictEqual(b.measures.readability, 0);
console.log(`ok -- ${Object.keys(SD.DESIGNS).length} designs on ${n} hazards (standing, hanging, side-turned, saws); gallery ${b.measures.secs} s, ${b.measures.parts} parts, clears`);
