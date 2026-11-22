// node tests/tas_progress.js -- a ratchet: real-game-verified input plans (gdsolver's, see
// tools/tas.js) must carry our sim at least this far into each official level.
// When a physics/object fix gets further, raise the number here. Needs the user's GD install and
// local/gdsolver/ (not committed); skips when they are missing.
const fs = require("fs"), path = require("path");
const PLANS = process.env.GDSOLVER_PLANS || path.join(__dirname, "..", "local", "gdsolver");
const SRC = process.env.GD_LEVELS || "C:/Program Files (x86)/Steam/steamapps/common/Geometry Dash/Resources/levels/";
if (!fs.existsSync(PLANS) || !fs.existsSync(SRC)) { console.log("tas_progress: skipped (no plans or no GD install)"); process.exit(0); }
const { replay } = require("../tools/tas.js");

// block reached (or "clear") per level, with the physics/object table as of this commit
const REACHED = { 1: 328, 2: 493, 3: 909, 4: 415, 5: 175, 6: 303, 7: 210, 8: 333, 9: 382, 10: 167,
  11: 288, 12: 33, 13: 116, 14: 30, 15: 267, 16: 141, 17: 295, 18: 105, 19: 100, 20: 32, 21: 54, 22: 81 };
let bad = 0;
for (const [n, want] of Object.entries(REACHED)) {
  const r = replay(+n, 0);
  const got = r.done ? Infinity : r.x / 30;
  const ok = got >= want;
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "LESS"} ${n}: ${r.done ? "clears" : "block " + got.toFixed(1)} (was ${want})`);
}
process.exit(bad ? 1 : 0);
