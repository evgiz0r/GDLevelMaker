// node tests/autobeat.js -- the beat-first auto builder (tools/autobeat.js): a short build clears with no press, every
// trigger fires on its beat (within a frame), every trigger moves the player, motifs come as AAAA / BBBB / a mix. ~3 s.
"use strict";
const ab = require("../tools/autobeat.js");
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log("FAIL " + m); } };
for (const [song, seed] of [["Electrodynamix", 8], ["Jumper", 2]]) {
  const b = ab.build({ song, seed, beats: 40, quiet: true });
  const m = b.measures;
  ok(m.clears, `${song} ${seed}: clears with no press (${b.fin.why})`);
  ok(m.triggers >= 10, `${song} ${seed}: ${m.triggers} triggers`);
  ok(m.onBeat >= 0.9 && m.maxOffMs <= 34, `${song} ${seed}: on the beat ${m.onBeat}, worst ${m.maxOffMs} ms`);
  ok(/^AAAA=/.test(b.motifs[0]), `${song} ${seed}: a block starts with AAAA (${b.motifs[0]})`);
  console.log(`${song} seed ${seed}: ${m.triggers} triggers, on beat ${m.onBeat}, modes ${m.modesSeen.join("/")}, reverse ${m.reverse}`);
}
console.log(bad ? bad + " failed" : "all ok");
process.exit(bad ? 1 : 0);
