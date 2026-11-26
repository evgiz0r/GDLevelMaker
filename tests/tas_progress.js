// node tests/tas_progress.js -- a ratchet: real-game-verified input plans (gdsolver's, see
// tools/tas.js) must carry our sim at least this far into each official level.
// When a physics/object fix gets further, raise the number here. Needs the user's GD install and
// local/gdsolver/ (not committed); skips when they are missing.
const fs = require("fs"), path = require("path");
const PLANS = process.env.GDSOLVER_PLANS || path.join(__dirname, "..", "local", "gdsolver");
const SRC = require("../tools/gdpaths.js").LEVELS;
if (!fs.existsSync(PLANS) || !fs.existsSync(SRC)) { console.log("tas_progress: skipped (no plans or no GD install)"); process.exit(0); }
const { replay } = require("../tools/tas.js");

// block reached (or "clear") per level, with the physics/object table as of this commit
// 2026-11-24 morning, a long landing buffer raised 3 (clear), 4 574, 6 489, 7 248, 8 362, 11 294; evening, LOWERED back:
// GD has no such buffer (the user's GDLM 67 frames + gdsolver's reading of GD's disassembly, PHYSICS.md "Landing
// buffer"), so those gains were covering a landing the sim makes 4-21 ticks late there -- the open lead, not a ratchet.
// 2026-11-26 GD 2.2's jump snap, the 10-unit foot margin, 32-bit x and the turned player box on turned hazards (PHYSICS.md
// "Jump snap", probe mod logs of 21 main levels) raised 1-4 to clear and 6, 7, 8, 10, 13, 18, 21; LOWERED 19 100 -> 91: its
// robot tops out 1.6 units under a thin slab (id 468, block 92.5) the old flat 15 margin let it land on -- the robot's jump
// is checked only by plans, never in a probe log. Raise 19 when the robot is calibrated.
const REACHED = { 1: "clear", 2: "clear", 3: "clear", 4: "clear", 5: 176, 6: 490, 7: 231, 8: 363, 9: 382, 10: 320,
  11: 295, 12: 33, 13: 184, 14: 30, 15: 267, 16: 141, 17: 295, 18: 123, 19: 91, 20: 32, 21: 475, 22: 75 };
// 2026-11-25 LOWERED 22 81 -> 75: the spider teleport now follows GD's search (lib/physics.js teleport, from gdsolver), which
// lands the plan's tap at tick 1743 on the id-392 spike row and kills it -- as gdsolver measured GD doing in an unturned
// frame (step.hpp, lv22 t=1,737). In GD the tap is taken in the ROTATED frame that starts there (rotate gameplay 2900,
// lv22 t=1,745): the old 81 was reached by a wrong landing. Raise it when rotated gameplay is simulated.
// 2026-11-25 rotated gameplay is in the sim (PHYSICS.md): the plan turns there now, but our spider tap comes 2-3 ticks before
// GD's relative to position (two presses moved 3-5 ticks later take it down and back out of the first turned stretch, and
// on to block 126); earlier taps need today's timing. Raise 22 once that timing is understood.
let bad = 0;
for (const [n, want] of Object.entries(REACHED)) {
  const r = replay(+n, 0);
  const got = r.done ? Infinity : r.x / 30;
  const ok = want === "clear" ? r.done : got >= want;
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "LESS"} ${n}: ${r.done ? "clears" : "block " + got.toFixed(1)} (was ${want})`);
}
process.exit(bad ? 1 : 0);
