// node tests/autoclose.js -- the auto clone (tools/autoclose.js) of two ball labs clears with no press: one with only flips
// (gravity portals) and one with ball orb presses (hidden pads under the ball, 2026-11-28). ~25 s.
process.env.GDLM_HEAVY = process.env.GDLM_HEAVY || "off";
const path = require("path"), ROOT = path.join(__dirname, "..");
const { clone, routeOf } = require(path.join(ROOT, "tools/autoclose.js"));
const { readGdlvl } = require(path.join(ROOT, "tools/io.js"));
let bad = 0;
for (const [f, want] of [["levels/gdlm_lab_clickfirst_ball.gdlvl", null], ["levels/gdlm_lab_clickfirst_corridor.gdlvl", /orb, ball/]]) {
  const file = path.join(ROOT, f), L = readGdlvl(file), ev = routeOf(file, L.levelStr);
  if (!ev) { console.log("SKIP " + f + ": no saved route"); continue; }
  const r = clone(L.levelStr, ev);
  const kinds = r.placed.map(p => p.kind).join(",");
  const ok = r.clears && !r.unhandled.length && (!want || want.test(kinds));
  console.log((ok ? "ok   " : "FAIL ") + f + `: ${r.placed.length}/${r.presses} placed, clears ${r.clears}${r.why ? " (" + r.why + ")" : ""}`);
  if (!ok) bad++;
}
process.exit(bad ? 1 : 0);
