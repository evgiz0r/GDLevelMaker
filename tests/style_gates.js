// node tests/style_gates.js  -- the style gates still agree with what the user found in play.
// Fixtures: our own GDLM levels (tests/fixtures), never other people's. Takes ~1-2 min (solves).
const assert = require("assert");
const { readGdlvl } = require("../tools/io.js");
const { sightread } = require("../tools/sightread.js");
const { scoreLevel } = require("../tools/score.js");
const path = require("path");
const at = f => readGdlvl(path.join(__dirname, "..", f)).level;
let n = 0;
const ok = (msg) => { n++; console.log("ok  " + msg); };

// 1. GDLM 41 v1: the user had to prejump before the yellow pad (block ~110); the check must say so
{ const s = sightread(at("tests/fixtures/gdlm_41_v1.gdlvl"));
  const pad = s.presses.filter(p => p.flag && /pad/.test(p.cue || ""));
  assert(pad.length === 1 && Math.abs(pad[0].to - 110) < 3, "GDLM 41 v1's pad prejump is flagged");
  ok("GDLM 41 v1: the pad prejump the user hit is flagged"); }
// 2. the fixed GDLM 41 has none
{ const s = sightread(at("levels/gdlm_41_classic.gdlvl"));
  assert(!s.presses.some(p => p.flag), "GDLM 41 is sight-readable");
  ok("GDLM 41 (fixed): sight-readable"); }
// 3. GDLM 42 v4: every press >= 100 ms after landing (the chain that was the wall in v3 is gone)
{ const s = scoreLevel(at("levels/gdlm_42_seen_then_gone.gdlvl"), { difficulty: { label: "Normal" } });
  assert.strictEqual(s.gates.find(g => g.name === "recovery").status, "PASS");
  ok("GDLM 42: no land-and-jump-at-once chains"); }
// 4. GDLM 44: every portal and orb on the solved path (no secret ways)
{ const s = scoreLevel(at("levels/gdlm_44_hellgate.gdlvl"), { difficulty: { label: "Easy" } });
  assert.strictEqual(s.gates.find(g => g.name === "skips").status, "PASS");
  ok("GDLM 44: no skipped portals or orbs"); }
console.log(`${n} checks passed`);
