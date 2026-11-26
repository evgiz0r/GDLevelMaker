// require("./startramp.js").ramp(rows, {at, c0})  -- the level's opening: up on blocks at once, not on the default ground.
//   Evgeni (2026-11-26): "by default not make levels starting on the default ground, but immediately on some height on top
//   of blocks of the level design, and the structure starts from there". GD spawns the cube on the ground at x 0, so the
//   opening is a 45-degree ramp of `rows` slopes from column c0 (default 1), each on a column of blocks, walked up with no
//   press in ~0.1 s a row; the first section's floor then runs at `rows` from column c0 + rows (FLOOR_FROM). The default
//   height is START_ROWS. Objects are make.js spec entries (["slope", "<at>+<col>", row], ["block", ...]).
//   Used by tools/hellgate_build.js and tools/planbuild.js (a plan's first section base defaults to START_ROWS);
//   tools/judge.js notes a "ground start" (the cube still on the default ground 1 s in). knowledge/checklist.md.
"use strict";
const START_ROWS = 3;
function ramp(rows = START_ROWS, o = {}) {
  const at = o.at || "b1", c0 = o.c0 != null ? o.c0 : 1, out = [];
  for (let k = 0; k < rows; k++) { const x = `${at}+${c0 + k + 0.5}`;
    for (let r = 0; r < k; r++) out.push(["block", x, r]);
    out.push(["slope", x, k, {}]); }
  return out;
}
const floorFrom = (rows = START_ROWS, c0 = 1) => c0 + rows;
module.exports = { START_ROWS, ramp, floorFrom };
if (require.main === module) console.log(JSON.stringify(ramp(+process.argv[2] || START_ROWS)));
