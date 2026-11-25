// node tests/balance.js -- tools/balance.js: per-press costs add up to the score, parts add up to each cost, settleOf as before
const assert = require("assert");
const DF = require("../lib/difficulty.js"), B = require("../tools/balance.js");
const acts = [{ tick: 240, x: 300, mode: "cube", type: "tap", ms: 50, afterSwitchMs: null },
  { tick: 480, x: 600, mode: "ship", type: "press", ms: 275, afterSwitchMs: 71 },
  { tick: 720, x: 900, mode: "wave", type: "press", ms: 404.2, afterSwitchMs: 200 }];
const b = B.balance("t", acts, { seconds: 4 });
let ref = 0; for (const a of acts) ref -= Math.log10(DF.hitChance(a.ms) * DF.settleOf(a));
assert(Math.abs(b.score - ref) < 0.002, "score = sum of -log10 p");
for (const a of b.inputs) assert(Math.abs(a.lapse + a.timing + a.settle - a.cost) < 0.002, "parts add up");
assert.strictEqual(DF.settleOf(acts[2]), 200 / 300, "late-open windows still count as forced by default (open question)");
assert.strictEqual(DF.settleOf(acts[2], 300, true), 1, "exempt when asked");
assert(b.ifOpenExempt < b.score && b.openForced === 1);
console.log("ok");
