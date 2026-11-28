// node tests/hellgate_chase.js -- the chase kit (tools/hellgate_chase.js): deco + trusted triggers only, inside its own
// group / channel ranges, and the run is the same with and without it.
const assert = require("assert"), { GD } = require("../tools/io.js"), FX = require("../tools/effects.js"), CH = require("../tools/hellgate_chase.js");
const far = [{ id: 1764, x: 3000, y: 1500, rot: 0, props: {} }];
const lv0 = GD.parseLevel(GD.DEFAULT_HEADER + ";" + far.map(GD.objToString).join(";") + ";"), base = GD.run(GD.makeWorld(lv0.objects, lv0.header), []);
const ctx = FX.context({ path: base.path }), kit = CH.kit({ g0: 4001, ch0: 850 });
const objs = [...kit.chasers(ctx, { t0: 0.5, t1: 8 }).objects];
const dr = kit.dragons(ctx, { t0: 0.5, t1: 8 }); objs.push(...dr.objects, ...kit.attack(ctx, { t: 3, from: dr.mouth(0, 2.5), at: { x: ctx.xAt(3) - 60, y: 0 } }));
for (const o of objs) {
  const k = (GD.objInfo(o.id) || {}).kind;
  if (k === "trigger") assert.ok([901, 1007, 1346].includes(o.id), "untrusted trigger " + o.id);
  else assert.ok(!/solid|hazard|portal|orb|pad|slope/.test(k || ""), "gameplay object " + o.id + " " + k);
  for (const g of String((o.props || {})[57] || "").split(".").filter(Boolean)) assert.ok(+g >= 4001 && +g < 4400, "group out of range " + g);
}
const [c0, c1] = kit.channelRange(); assert.ok(c0 >= 850 && c1 < 912, `channels ${c0}-${c1} clash with structdeco`);
const lv = GD.parseLevel(kit.header(GD.DEFAULT_HEADER) + ";" + far.concat(objs).map(GD.objToString).join(";") + ";"), r = GD.run(GD.makeWorld(lv.objects, lv.header), []);
assert.strictEqual(r.path.length, base.path.length, "the kit changes the run");
console.log(`ok: ${objs.length} objects, groups ${kit.groupRange().join("-")}, channels ${c0}-${c1}`);
