// node tools/cinemalab.js [--make]   -> specs/lab_cinema.json (+ --make: node tools/make.js on it -> levels/gdlm_cinema_lab.gdlvl)
//
// CINEMA LAB (Evgeni 2026-11-28, after playing a story level: "lets try - level moves into playing on a 3d table, moving
// diagonally on the table / we bonk into the wall with a death animation, but we live and see ourselves after a bit / ship
// gameplay spinning around the middle"). A ~29 s playable lab: easy cube jumps, then a ship corridor. The tricks are the
// scene tools/scenes/cinema.js (camera zoom / rotate / offset, hide / show player, shake, ghost trail: keys in EFFECTS.md
// "Camera and player triggers", read from 583 rated levels). They show only in GD; the viewer plays the gameplay.
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), V = 311.58 / 30;      // columns a second at 1x
const col = t => Math.round(t * V);
const o = [], put = (type, c, r, e) => o.push(e ? [type, c, r, e] : [type, c, r]);

// 0-2 s: a plain start; 2-8.5 s: on the table (a few single spikes and a step); 10.5 s: the wall (deco only)
for (const t of [1.2, 3.4, 4.6, 5.8]) put("spike", col(t), 0);
for (let c = col(6.8); c < col(6.8) + 3; c++) put("block", c, 0);
put("spike", col(7.9), 0);
put("spike", col(12.0), 0);
// 12.8 s: the ship, in a wide corridor (ceiling at row 10), with soft pillars to steer round while the view spins
const s0 = col(12.8), s1 = col(26.6);
put("ship portal", s0, 2);
for (let c = s0 - 2; c <= s1 + 2; c++) put("block", c, 10);
[[15.2, "up"], [17.4, "down"], [19.6, "up"], [21.8, "down"], [24.0, "up"]].forEach(([t, k]) => {
  const c = col(t);
  for (let r = 0; r < 3; r++) for (let dc = 0; dc < 2; dc++) put("block", c + dc, k === "up" ? r : 9 - r);
});
put("cube portal", s1, 2);
put("spike", col(28.2), 0);

const spec = {
  name: "GDLM cinema lab",
  desc: "Cinema lab: onto a table, a fake death at a wall, a spinning ship. Made by humans, with Claude",
  colours: { bg: [28, 40, 70], ground: [40, 58, 96] },
  song: { official: 7 }, grid: { bpm: 178.001, t0: 0.0099 },
  scene: "tools/scenes/cinema.js",
  cinema: { table: [2.0, 8.6], wall: 10.5, spin: [13.6, 25.6] },
  objects: o,
};
const out = path.join(ROOT, "specs", "lab_cinema.json");
fs.writeFileSync(out, JSON.stringify(spec, null, 1));
console.log(`${out}: ${o.length} objects`);
if (process.argv.includes("--make")) require("child_process").spawnSync(process.execPath, [path.join(ROOT, "tools", "make.js"), out], { stdio: "inherit", windowsHide: true });
