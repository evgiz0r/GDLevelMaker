// node tests/beats_published.js  -- checks the official songs' beat grids (local/beats/, from
// `node tools/beats.js`) against tempos players have published, and where they disagree, tests
// the published tempo on the audio itself. Needs the game's songs on this PC. ~10 s.
//
// Source: gdforum.freeforums.net thread 59158, "List of BPM of Geometry Dash Songs" (2018, player
// estimates, not RobTop's). Dash is not in it. Hexagon Force is listed at half tempo (81).
// Result on Nov 22 2026: 19/21 agree within 1 BPM (counting half/double); Polargeist ("~175")
// and Jumper (175) disagree, and the audio sides with the grid (163 fits to 4 ms over the whole
// song, 175 does not fit; a fit started at 175 slides to 178.00).
const fs = require("fs"), path = require("path");
const { loadBeats, fitAtBpm, OFFICIAL, GAME } = require("../tools/beats.js");
const PUBLISHED = { StereoMadness: 160, BackOnTrack: 142, Polargeist: 175, DryOut: 145, BaseAfterBase: 141,
  CantLetGo: 170, Jumper: 175, TimeMachine: 143, Cycles: 140, xStep: 130, Clutterfunk: 140,
  TheoryOfEverything: 130, Electroman: 170, Clubstep: 128, Electrodynamix: 127, HexagonForce: 81,
  BlastProcessing: 135, TheoryOfEverything2: 132, GeometricalDominator: 148, Deadlocked: 135, Fingerdash: 112 };
let agree = 0, n = 0, bad = 0;
for (const name of OFFICIAL) {
  const pub = PUBLISHED[name];
  const b = loadBeats("official_" + name);
  if (!b) { console.log(`${name}: no grid (run node tools/beats.js)`); continue; }
  if (!pub) { console.log(`${name.padEnd(22)} grid ${b.bpm.toFixed(1)}  (no published tempo)`); continue; }
  n++;
  const near = [pub, pub * 2, pub / 2].some(p => Math.abs(p - b.bpm) <= 1);
  if (near) { agree++; console.log(`${name.padEnd(22)} grid ${b.bpm.toFixed(1)}  published ${pub}  agree`); continue; }
  // disagreement: fit a grid at the published tempo and compare with the grid's own fit
  const file = path.join(GAME, "Resources", name + ".mp3");
  const theirs = fitAtBpm(file, pub), ours = fitAtBpm(file, b.bpm);
  const oursWins = ours.ratio > theirs.ratio && ours.maxDriftMs <= theirs.maxDriftMs || Math.abs(theirs.bpm - b.bpm) < 0.5;
  if (!oursWins) bad++;
  console.log(`${name.padEnd(22)} grid ${b.bpm.toFixed(1)}  published ${pub}  DISAGREE: fit at ${pub} -> ${theirs.bpm.toFixed(2)} ` +
    `(ratio ${theirs.ratio.toFixed(2)}, drift ${theirs.maxDriftMs} ms) vs grid (ratio ${ours.ratio.toFixed(2)}, drift ${ours.maxDriftMs} ms): ` +
    (oursWins ? "the audio sides with the grid" : "THE PUBLISHED TEMPO FITS BETTER"));
}
console.log(`\n${agree}/${n} agree with the published tempo; ${bad} disagreement(s) where the published tempo fits the audio better`);
process.exit(bad ? 1 : 0);
