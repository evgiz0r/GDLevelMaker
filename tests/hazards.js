// node tests/hazards.js -- lib/hazards.js: roles against a path, and hazardsAlongPath keeps clear of the path and follows it
const assert = require("assert"), path = require("path");
const { GD, readGdlvl } = require("../tools/io.js");
Object.assign(GD, require("../lib/hazards.js"));
const H = require("../tools/hazards.js");
// a flat run with one jump over a spike: the spike is a threat, a far one is fill
const objs = [{ id: 8, x: 315, y: 15 }, { id: 8, x: 1215, y: 300 }].map(o => ({ rot: 0, flipX: false, flipY: false, props: {}, ...o }));
const w = GD.makeWorld(objs, GD.DEFAULT_HEADER);
let q = null;
for (let t = 0; t < 400 && (!q || q.dead); t += 4) q = GD.run(w, [{ tick: t, type: "press" }, { tick: t + 2, type: "release" }]);
const rec = GD.hazardRecords(objs, q.path);
assert.ok(!q.dead, "the jump clears the spike");
assert.equal(rec[0].role, "threat"); assert.equal(rec[1].role, "fill");
// the generator on the auto lab level (no presses): replays clean, nothing within the clear distance, roles near rated
const f = path.join(__dirname, "..", "levels", "lab", "auto_beat.gdlvl");
const r = readGdlvl(f), base = r.level.objects.filter(o => GD.objInfo(o.id).kind !== "hazard");
const run = GD.run(GD.makeWorld(base, r.level.header), []);
const res = GD.hazardsAlongPath(run.path, base, { verify: { header: r.level.header, events: [] } });
assert.ok(res.objects.length > 50, "places hazards");
const all = base.concat(res.objects.map(o => ({ rot: 0, flipX: false, flipY: false, props: {}, ...o })));
const q2 = GD.run(GD.makeWorld(all, r.level.header), []);
assert.ok(!q2.dead, "the auto run still clears");
const c = H.check({ header: r.level.header, objects: all }, []);
assert.ok(c.f["role.fill"] < 60 && c.f["role.guard"] > 25, "roles near rated: " + c.summary);
const c0 = H.check(r.level, []);
assert.ok(c0.flags.length > 0, "the old auto level is flagged: " + c0.summary);
console.log("ok -- " + c.summary + " | before: " + c0.summary);
