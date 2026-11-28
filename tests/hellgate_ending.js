// node tests/hellgate_ending.js  -- Hellgate's ending animation (tools/hellgate_ending.js, HELLGATE.md): the level clears with
// (v5: pink pads, id 140, are the only gameplay objects: the auto dodges.)
// no press, the show leaves the run unchanged, nothing but deco and trusted triggers (move, alpha, rotate, colour, zoom; no pulse, no scale), the portcullis lands on the
// song's last hit and the arch stones land on their beats. ~2 s.
"use strict";
const assert = require("assert");
const { GD } = require("../tools/io.js");
const HE = require("../tools/hellgate_ending.js");
const r = HE.build({});
assert.ok(r.measures.clears, "the ending dies");
assert.ok(!r.measures.showChangesRun, "the show changes the zero-press run");
const OK = new Set([901, 1007, 1346, 899, 1913]);   // zoom 1913 since v2 (energy pass); never pulse 1006 or scale 2067
for (const o of r.objects) {
  const k = (GD.objInfo(o.id) || {}).kind;
  assert.ok(k === "decoration" || o.id === 914 || o.id === 140 || (k === "trigger" && OK.has(o.id)), `object ${o.id} (${k}) is not deco or a trusted trigger`);
}
// the portcullis drop (exponential in, 170 units down) ends on the last hit, from the path: trigger x -> time + duration
const lv = GD.parseLevel(r.header + ";" + r.objects.map(GD.objToString).join(";") + ";");
const run = GD.run(GD.makeWorld(lv.objects, lv.header), []), p = run.path, tAt = x => p.findIndex(s => s.x >= x) / 240;
const from = r.measures.songFrom;
const drops = r.objects.filter(o => o.id === 901 && +o.props[29] === -170 && o.props[30] === "11");
assert.strictEqual(drops.length, 1, "one portcullis drop");
assert.ok(Math.abs(tAt(drops[0].x) + +drops[0].props[10] + from - HE.SLAM) < 0.02, "the portcullis does not land on the last hit");
// the gate comes at the player at the ground's speed and ends behind him at the slam, so he runs through it on beat 30
const app = r.objects.filter(o => o.id === 901 && +o.props[28] < -300 && +o.props[30] === 0 && +o.props[10] > 1);
assert.strictEqual(app.length, 1, "one gate approach move");
assert.ok(Math.abs(tAt(app[0].x) + +app[0].props[10] + from - HE.SLAM) < 0.02, "the gate approach does not end on the slam");
assert.ok(Math.abs(-app[0].props[28] / +app[0].props[10] - 311.58) < 3, "the gate does not come at the ground's speed");
// the chase kit (groups 4101+, channels 850+) and the show's own ranges do not meet
assert.ok(2001 + r.measures.groups < 4101, "the show's groups run into the chase kit's (4101+)");
// v5: the player is in the air (a pad's hop) when each shot lands, and the shots fly slow (Evgeni: "too fast")
for (const t of HE.fireTimes()) { const y = p[Math.round((t - from) * 240)].y - p[0].y; assert.ok(y > 40, `the player is not hopping over the shot at ${t.toFixed(2)} s (y +${y.toFixed(0)})`); }
assert.ok(HE.FLIGHT >= 1, "the shots fly faster than 1 s again");
const lands = r.objects.filter(o => o.id === 901 && o.props[30] === "11" && +o.props[10] === 0.26);   // the stones fly 0.26 s (meteors, souls, debris use ease 11 too)
assert.strictEqual(lands.length, 11, "eleven arch stones fly in");
for (const m of lands) { const s = tAt(m.x) + +m.props[10] + from, k = (s - HE.beatS(0)) / (HE.beatS(1) - HE.beatS(0)); assert.ok(Math.abs(k - Math.round(k)) < 0.05, `a stone lands off the beat (${s.toFixed(3)} s)`); }
console.log(`ok: ${r.measures.objects} objects, ${r.measures.triggers} triggers, portcullis on ${HE.SLAM} s, the gate passed on beat 30, 11 stones on beats`);
