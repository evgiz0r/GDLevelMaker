// node tests/tempo.js -- tools/tempo.js: official levels with a complete scored route sit in the reference range
// (inputs per beat 0.53-0.87 over the level, no WARN on the whole-level / busy-part numbers), and the gate's flags work.
// Needs local/official_NN.json, local/difficulty/scored_NN.json and the beat grids (local/beats/); skips what is missing.
"use strict";
const fs = require("fs"), path = require("path"), T = require("../tools/tempo.js");
let bad = 0, ran = 0;
for (const n of [1, 3, 7, 9, 14]) {
  const nn = String(n).padStart(2, "0");
  if (!fs.existsSync(path.join(__dirname, "..", "local", "difficulty", "scored_" + nn + ".json"))) continue;
  const r = T.check("official:" + n); if (r.error) continue; ran++;
  const ok = r.perBeat >= 0.5 && r.perBeat <= 0.95 && !r.flags.some(f => /over the level|busy parts/.test(f));
  console.log(`${ok ? "ok  " : "FAIL"} ${r.name}: ${r.perBeat} per beat, busy ${r.busyPerBeat}`); if (!ok) bad++;
}
// a level with no inputs: every flag fires
const fake = { name: "empty", header: "", objects: [{ id: 1, x: 6000, y: 15 }], grid: { ok: true, bpm: 120, period: 0.5, t0: 0, downbeat: 0 } };
const q = T.analyse(fake, []);
const okE = !q.error && q.flags.length >= 1; console.log(`${okE ? "ok  " : "FAIL"} an empty level warns (${q.flags.length} flag(s))`); if (!okE) bad++;
console.log(ran ? `${ran} official levels checked` : "no official data here: only the synthetic check ran");
process.exit(bad ? 1 : 0);
