// node tests/taste.js -- the taste measures (tools/taste.js) on small hand-built levels: each rule's
// measure says what it should on a level built to pass it and one built to break it.
const assert = require("assert");
const { GD } = require("../tools/io.js");
const { measureOne, taste } = require("../tools/taste.js");
const o = (id, c, r, extra = {}) => ({ id, x: c * 30 + 15, y: r * 30 + 15, rot: 0, props: Object.assign({}, extra) });
const lvl = objs => ({ header: GD.DEFAULT_HEADER, objects: objs });
const floorTo = n => Array.from({ length: 30 }, (_, i) => o(1, n + i, -1)).slice(0, 0);   // the ground is implicit
let ok = 0;
const t = (name, f) => { f(); ok++; console.log("ok", name); };

t("orb centred over its spike row", () => {
  const base = [o(8, 10, 0), o(8, 11, 0), o(8, 12, 0), o(8, 60, 0)];
  const good = measureOne(lvl([...base, o(36, 11, 3)])).F, bad = measureOne(lvl([...base, o(36, 13, 3)])).F;
  assert.strictEqual(good.orbCentred, 1); assert.strictEqual(bad.orbCentred, 0);
});
t("flat floor before a mode portal", () => {
  const good = measureOne(lvl([o(8, 5, 0), o(13, 20, 2), o(8, 60, 0)])).F;
  const bad = measureOne(lvl([o(8, 18, 0), o(13, 20, 2), o(8, 60, 0)])).F;
  assert.strictEqual(good.portalFlat, 1); assert.strictEqual(bad.portalFlat, 0);
});
t("a step 3 blocks after a spike is flagged, one right after is not", () => {
  const bad = measureOne(lvl([o(8, 10, 0), o(1, 14, 0), o(8, 60, 0)])).F;
  const fine = measureOne(lvl([o(8, 10, 0), o(1, 11, 0), o(8, 60, 0)])).F;
  assert(bad.spikeStepBad > 0 && fine.spikeStepBad === 0, JSON.stringify([bad.spikeStepBad, fine.spikeStepBad]));
});
t("height changes: blocks to stand on vs a flat floor", () => {
  const steps = []; for (let c = 10; c < 50; c++) steps.push(o(1, c, Math.floor((c - 10) / 4) % 3));
  const hilly = measureOne(lvl([...steps, o(8, 60, 0)])).F, flat = measureOne(lvl([o(8, 20, 0), o(8, 60, 0)])).F;
  assert(hilly.heightChanges10 > flat.heightChanges10 && flat.groundShare > hilly.groundShare);
});
t("taste() gives 0-100 and parts when a model exists", () => {
  let m; try { m = require("../knowledge/taste_model.json"); } catch (e) { return; }
  const r = taste(measureOne(lvl([o(8, 10, 0), o(8, 60, 0)])).F, "EN|2.2", m);
  assert(r.score >= 0 && r.score <= 100 && Array.isArray(r.parts));
});
console.log(ok, "taste tests passed");
