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
// Mini cube (the same recording, 22.9-23.1 s, a lime box of 58 px = 0.6 of a block): it turns 90
// degrees every 10 frames (square boxes at 22.900 and 23.067 s), gdsolver's mini rate (2.25 deg/tick;
// full size 1.73), and its fall from an apex goes at the same 0.78 units/frame^2 as a full cube.
{
  const s = GD.startState(w);
  Object.assign(s, { mini: true, y: 1500, grounded: false, vy: 0 });
  const r0 = s.rot, ys = [];
  for (let t = 0; t < 40; t++) { GD.step(w, s, { press: false, held: false }); if (t % 4 === 3) ys.push(s.y); }
  const per90 = 90 / (Math.abs(s.rot - r0) / 40) / 4;
  const a = (ys[6] - 2 * ys[5] + ys[4]);
  const ok = Math.abs(per90 - 10) <= 0.7 && Math.abs(a + 0.78) <= 0.04;
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "BAD "} mini cube: 90 deg in ${per90.toFixed(2)} frames (video 10), gravity ${a.toFixed(3)} (video -0.78)`);
}
// Wave: the user's Deadlocked recording (Game Bar, "Geometry Dash 2026-11-22 17-45-34.mp4", 124.4-125.1 s,
// hitboxes on, a mini wave): its trail -- fixed in the world, so camera moves do not bend it -- runs
// at 2.00:1 in every frame (the slope histogram of the trail's white core, 7 frames). gdsolver: 1:1
// full size, 2:1 mini. The full-size 1:1 is gdsolver's only, not yet seen in a recording.
for (const [mini, want, src] of [[true, 2.0, "video"], [false, 1.0, "gdsolver"]]) {
  const s = GD.startState(w);
  Object.assign(s, { mode: "wave", mini, y: 1500, grounded: false, floorY: 0, ceilY: 3000 });
  const x0 = s.x, y0 = s.y;
  for (let t = 0; t < 20; t++) GD.step(w, s, { press: false, held: true });
  const got = (s.y - y0) / (s.x - x0), ok = Math.abs(got - want) <= 0.03;
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "BAD "} ${mini ? "mini " : ""}wave slope: sim ${got.toFixed(3)}, ${src} ${want}`);
}
process.exit(bad ? 1 : 0);
