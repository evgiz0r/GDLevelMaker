// node tests/autobeat.js -- the beat-first auto builder (tools/autobeat.js): a short build clears with no press, every
// trigger fires on its beat or note (within a frame or two), motifs come as AAAA / BBBB / a mix, and on the song's
// notes (knowledge/song_notes) it hits a good share of them. ~3 s.
"use strict";
const ab = require("../tools/autobeat.js");
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log("FAIL " + m); } };
for (const [song, seed, music] of [["Electrodynamix", 8, null], ["Jumper", 2, null], ["Electrodynamix", 7, undefined], ["GeometricalDominator", 1, undefined]]) {
  const b = ab.build({ song, seed, beats: 40, quiet: true, music });   // null: the beat grid; undefined: the song's notes
  const m = b.measures;
  ok(m.clears, `${song} ${seed}: clears with no press (${b.fin.why})`);
  ok(m.triggers >= 10, `${song} ${seed}: ${m.triggers} triggers`);
  ok(m.onBeat >= (music === null ? 0.9 : 0.8) && m.maxOffMs <= 34, `${song} ${seed}: on the beat ${m.onBeat}, worst ${m.maxOffMs} ms`);
  if (music === null) ok(/^AAAA=/.test(b.motifs[0]), `${song} ${seed}: a block starts with AAAA (${b.motifs[0]})`);
  else ok(/low=\w+ mid=\w+ top=\w+ icons=/.test(b.motifs[0]), `${song} ${seed}: a batch maps the bands (${b.motifs[0]})`);
  if (music === undefined) ok(m.notesHit >= 0.4 && m.perSec >= 2.5, `${song} ${seed}: on the notes ${m.notesHit}, ${m.perSec}/s`);
  console.log(`${song} seed ${seed}: ${m.triggers} triggers, on beat ${m.onBeat}, modes ${m.modesSeen.join("/")}, reverse ${m.reverse}`);
}
console.log(bad ? bad + " failed" : "all ok");
process.exit(bad ? 1 : 0);
