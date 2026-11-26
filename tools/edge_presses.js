// node tools/edge_presses.js [N ...]  -- how many presses in each saved main-level route are made past a block's end (cube,
// UFO, robot jumping off the very edge after the block is gone under the player's centre; lib/natural.js edgePresses).
// Reads local/official_NN.json (the PC's routes, or staged copies). Prints one line per level and a total.
"use strict";
const fs = require("fs"), path = require("path");
const { GD } = require("./io.js"), NAT = require("../lib/natural.js");
const nums = process.argv.slice(2).map(Number).filter(Boolean);
let total = 0;
for (let n = 1; n <= 22; n++) {
  if (nums.length && !nums.includes(n)) continue;
  const f = path.join(__dirname, "..", "local", `official_${String(n).padStart(2, "0")}.json`);
  if (!fs.existsSync(f)) { console.log(`${n}: no local route`); continue; }
  const j = JSON.parse(fs.readFileSync(f, "utf8")), lv = GD.parseLevel(j.level), w = GD.makeWorld(lv.objects, lv.header);
  const ev = j.solution && j.solution.events; if (!ev) { console.log(`${n} ${j.name}: no route`); continue; }
  const r = NAT.edgePresses(w, ev, lv.objects), list = Array.isArray(r) ? r : (r && r.list) || [];
  total += list.length;
  console.log(`${n} ${j.name}: ${list.length} edge presses` + (list.length ? "  at blocks " + list.slice(0, 12).map(e => Math.round((e.x || 0) / 3) / 10).join(", ") : ""));
}
console.log(`total ${total}`);
