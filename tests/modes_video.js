// node tests/modes_video.js -- vertical accelerations measured in the user's Clutterfunk recording
// (GD claude-rec 2026-11-22_18-09-30.mkv, 60 fps, 1080p) must match the sim.
// Measured with tools/track.py on the player's colour (crop 560,60,300,800), fitting a parabola to
// every 7-9 frame window and taking the peaks of the histogram (units per frame^2, up positive):
//   cube 18-26 s and 84-116 s: +-0.78     ship 27.5-34.5 s: hold +0.40, release -0.25
//   ball 43-64 s: +-0.47 (gravity flips with every tap)
// One frame = 4 physics ticks; y moves vy * 0.225 per tick.
const GD = Object.assign({}, require("../lib/objects.js"), require("../lib/physics.js"));
const MEASURED = [["cube gravity", "cube", false, -0.78, 0.04], ["ship hold", "ship", true, 0.40, 0.03],
                  ["ship release (falling)", "ship", false, -0.25, 0.03], ["ball gravity", "ball", false, -0.47, 0.03]];
const w = GD.makeWorld([{ id: 1, x: 30000, y: 3000 }]);
let bad = 0;
for (const [name, mode, held, want, tol] of MEASURED) {
  const s = GD.startState(w);
  Object.assign(s, { mode, y: 1500, grounded: false, floorY: 0, ceilY: 3000, vy: mode === "ship" ? (held ? -3 : 0) : 0 });
  const ys = [];
  for (let t = 0; t < 4 * 12; t++) { GD.step(w, s, { press: false, held }); if (t % 4 === 3) ys.push(s.y); }
  const a = ys.slice(2, 8).map((_, i) => ys[i + 3] - 2 * ys[i + 2] + ys[i + 1]);
  const got = a.reduce((p, c) => p + c, 0) / a.length;
  const ok = Math.abs(got - want) <= tol;
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "BAD "} ${name}: sim ${got.toFixed(3)}, video ${want} +- ${tol}`);
}
process.exit(bad ? 1 : 0);
