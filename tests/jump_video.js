// node tests/jump_video.js -- the cube's plain jump must match the user's recording.
// Data: cube centre screen y (px) per frame of one ground jump, from a 1080p 30fps capture of
// "cube timings" (attempt 1, 8.31-8.75 s). 3.375 px per unit; ground-level cube centre = 724 px.
// Measured by tracking the cube's lime colour (see CLAUDE.md "Calibration").
const GD = Object.assign({}, require("../lib/objects.js"), require("../lib/physics.js"));
const vid = [[8.3472,663],[8.3806,612],[8.4139,571],[8.4472,540],[8.4804,520],[8.5137,511],[8.5471,512],
             [8.5805,523],[8.6138,545],[8.6471,577],[8.6811,620],[8.7137,674],[8.7471,722]];
const w = GD.makeWorld([{ id: 1, x: 3000, y: 300 }]);
const r = GD.run(w, [0]);
let best = null;
for (let t0 = 8.30; t0 <= 8.347; t0 += 0.0005) {
  let e = 0;
  for (const [t, py] of vid) { const s = r.path[Math.max(0, Math.min(Math.round((t - t0) * 240), r.path.length - 1))]; e += (724 - (s.y - 15) * 3.375 - py) ** 2; }
  if (!best || e < best.e) best = { t0, e };
}
const rms = Math.sqrt(best.e / vid.length);
console.log(`jump vs video: rms ${rms.toFixed(2)} px (${(rms / 3.375).toFixed(2)} units)`);
process.exit(rms < 3 ? 0 : 1);
