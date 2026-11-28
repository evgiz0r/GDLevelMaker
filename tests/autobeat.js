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
  else ok(/low=\w+ mid=\w+ top=\w+ rapid=\w+ icons=/.test(b.motifs[0]), `${song} ${seed}: a batch maps the bands (${b.motifs[0]})`);
  if (music === undefined) ok(m.notesHit >= 0.4 && m.perSec >= 2.5, `${song} ${seed}: on the notes ${m.notesHit}, ${m.perSec}/s`);
  // round 8: every build ends with the outro + the signature, and has had its stray presses checked
  ok(/signature/.test(m.ending || ""), `${song} ${seed}: ends with the signature (${m.ending})`);
  ok(Array.isArray(m.blockPasses) && m.blockPasses.length > 0, `${song} ${seed}: stray presses checked (${m.blockPasses})`);
  console.log(`${song} seed ${seed}: ${m.triggers} triggers, on beat ${m.onBeat}, modes ${m.modesSeen.join("/")}, reverse ${m.reverse}`);
}
// rapid runs (round 8): close notes kept 0.07 s apart inside a run, and our own speed bursts on the long ones
{
  const g = ab.loadGrid("GeometricalDominator"), mu = ab.musicOf("GeometricalDominator"), p = ab.notePlan(g, mu, 2, 120, {});
  const close = p.filter((x, i) => i && x.t - p[i - 1].t < 0.17).length;
  ok(close > 50, `rapid runs: ${close} notes closer than 0.17 s to the last`);
  ok(p.some(x => x.burst === "up") && p.some(x => x.burst === "back"), "a speed burst up and back on a long rapid run");
}
// round 9 (shape): no teleports, the path inside a camera band, slopes in, no sinking into ledges
{
  const b = ab.build({ song: "GeometricalDominator", seed: 1, beats: 160, from: 2, quiet: true, sections: false });
  const m = b.measures;
  ok(m.clears, "round 9 build clears");
  ok(!m.byKind.tele, `no teleports (${m.byKind.tele || 0})`);
  ok(m.riseBlocks <= 35, `the path stays low enough for the camera: rises ${m.riseBlocks} blocks`);
  ok((m.byKind.slope || 0) >= 1, `slopes as a move (ground slopes only while air landings are off) (${m.byKind.slope || 0})`);
  ok(m.clipTicks <= 30, `no play inside the blocks: ${m.clipTicks} ticks`);
  ok(m.hazards && m.hazards.placed > 50 && m.hazards.threats > 0, `hazards follow the path (lib/hazards.js): ${JSON.stringify(m.hazards)}`);
}
// sections by character (tools/sections.js): a whole song, each batch typed by its transition; a drop gets the big pads
{
  const b = ab.build({ song: "CantLetGo", seed: 3, quiet: true });
  const m = b.measures, log = b.motifs.join("\n");
  ok(m.clears, "sections build clears");
  ok(/drop/.test(log) && /break/.test(log) && /entry/.test(log), "drop, break and entry sections are typed: " + log.split("\n").filter(l => / s: /.test(l)).map(l => l.split(",")[0]).join(" | "));
  ok(/drop[^\n]*low=red/.test(log), "the drop has red pads on the low notes");
  ok(m.clipTicks <= 30, `no play inside the blocks: ${m.clipTicks} ticks`);
  ok(/quiet signature/.test(m.ending), "the default ending is the quiet sign (2026-11-27): " + m.ending);
  // the sign itself: hidden at first, one fade in, locked to the camera, nothing past the level's last gameplay object
  const fs = require("fs"), path = require("path"), { readGdlvl, GD } = require("../tools/io.js");
  const out = path.join(__dirname, "..", "local", "tmp", "test_quiet_sign.gdlvl");
  ab.write(out, b, "GDLM test quiet sign");
  const lv = readGdlvl(out).level, G = "965", inG = o => String((o.props || {})[57] || "").split(".").includes(G);
  const trig = lv.objects.filter(o => +(o.props || {})[51] === +G);
  ok(trig.some(o => o.id === 1007 && o.props[35] === "0") && trig.some(o => o.id === 901 && o.props[141] === "1"), "the sign is hidden, then locked to the camera");
  ok(!lv.objects.some(o => [1006].includes(o.id) && o.x > Math.max(...lv.objects.map(q => q.x)) - 2500), "no pulses near the end");
  const play = lv.objects.filter(o => !["decoration", "trigger"].includes(GD.objInfo(o.id).kind));
  ok(Math.max(...lv.objects.filter(inG).map(o => o.x)) < Math.max(...play.map(o => o.x)), "the sign lies inside the level, before its end");
}
// a piece that starts inside its song (opts.offset = kA13; HELLGATE.md's auto part from 180.7 s): triggers in level time, one
// speed portal for the speed the song already has there, the offset in the header
{
  const b = ab.build({ song: "343707", seed: 1, offset: 178.47, from: 436, beats: 84, rate: 3, ending: false, quiet: true });
  const m = b.measures, trig = b.placed.filter(t => t.kind !== "none");
  ok(m.clears, "offset build clears");
  ok(trig[0].tick / 240 > 1.5 && trig[0].tick / 240 < 5, `first trigger soon after the 2 s lead-in: ${(trig[0].tick / 240).toFixed(2)} s`);
  ok(m.speedChanges <= 8, `speed portals follow the song, not one per note: ${m.speedChanges}`);
  const fs = require("fs"), path = require("path"), { readGdlvl } = require("../tools/io.js");
  const out = path.join(__dirname, "..", "local", "tmp", "test_offset.gdlvl");
  ab.write(out, b, "GDLM test offset");
  ok(/(^|,)kA13,178\.47(,|$)/.test(readGdlvl(out).level.header), "kA13 = the offset");
}
console.log(bad ? bad + " failed" : "all ok");
process.exit(bad ? 1 : 0);
