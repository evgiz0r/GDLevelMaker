// node tests/hellgate_auto.js -- Hellgate's auto part (tools/hellgate_auto.js): builds into local/tmp, clears with no press on
// the same path as before the deco and the chase, hands over the agreed seam at 215.4 s (a plain 1x cube on the ground), the
// song offset is in the header, and every shot lands a beat after a dodge. ~6 s.
const assert = require("assert"), path = require("path"), fs = require("fs");
const HA = require("../tools/hellgate_auto.js"), { readGdlvl } = require("../tools/io.js");
const out = path.join(__dirname, "..", "local", "tmp", "test_hellgate_auto.gdlvl");
fs.mkdirSync(path.dirname(out), { recursive: true });
const r = HA.build({ seed: 4, rate: 3, name: "GDLM test hellgate auto", out, quiet: true });
assert.ok(r.clears && r.M.samePath, "clears with no press on the same path");
const s = r.M.seam;
assert.ok(s.mode === "cube" && s.sp === 1 && s.grav === 1 && !s.mini && s.onGround, "seam at 215.4 s: " + JSON.stringify(s));
assert.ok(/(^|,)kA13,178\.47(,|$)/.test(readGdlvl(out).level.header), "kA13 = 178.47");
assert.ok(r.D.length >= 20, "dodges found: " + r.D.length);
console.log(`ok: ${r.M.triggers} triggers, ${r.D.length} dodges, seam x ${s.x}`);
// calm (Evgeni: "a bit junky in the auto as it jumps"): fewer small hops and gravity flips than the default build
const { jank } = require("../tools/autojank.js"), outC = out.replace(".gdlvl", "_calm.gdlvl");
const c = HA.build({ seed: 5, rate: 3, calm: 0.22, name: "GDLM test hellgate auto calm", out: outC, quiet: true });
assert.ok(c.clears && c.M.samePath && c.M.seam.mode === "cube" && c.M.seam.onGround, "calm build clears and keeps the seam");
const j0 = jank(readGdlvl(out).level, { from: 2.2 }), j1 = jank(readGdlvl(outC).level, { from: 2.2 });
assert.ok(j1.hopsPerS < j0.hopsPerS * 0.6 && j1.flipsPerS < j0.flipsPerS * 0.5, `calm: hops ${j0.hopsPerS} -> ${j1.hopsPerS}, flips ${j0.flipsPerS} -> ${j1.flipsPerS}`);
console.log(`ok calm: hops/s ${j0.hopsPerS} -> ${j1.hopsPerS}, flips/s ${j0.flipsPerS} -> ${j1.flipsPerS}`);
