// node tests/heavy_yield_job.js <label> [rounds]  -- a real heavy job for tests/heavy_yield.js: takes a slot (tools/heavy.js),
// then, rounds times, solves examples/cube_timings.gdlvl and plans its natural route (lib/physics.js solve + lib/natural.js:
// the yield points under test), and prints one line "RESULT <hash>" of every round's events. Same input -> same hash,
// paused or not.
const path = require("path"), crypto = require("crypto");
const label = process.argv[2] || "test-heavy-yield", rounds = +process.argv[3] || 1;
require("../tools/heavy.js").claim(label);
const { GD, readGdlvl } = require("../tools/io.js");
Object.assign(GD, require("../lib/natural.js"));
const L = readGdlvl(path.join(__dirname, "..", "examples", "cube_timings.gdlvl"));
const h = crypto.createHash("sha1");
for (let i = 0; i < rounds; i++) {
  const w = GD.makeWorld(L.level.objects, L.level.header), r = GD.solveAny(w);
  const n = GD.naturalPlan(w, r, L.level.objects, { cost: true });
  h.update(JSON.stringify([r.ok, r.events, n && n.events]));
  console.log(`round ${i + 1}/${rounds}`);
}
console.log("RESULT " + h.digest("hex"));
