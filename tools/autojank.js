#!/usr/bin/env node
// Usage: node tools/autojank.js <level.gdlvl> [...] [--from s] [--to s] [--json]
// How jumpy an auto level looks (Evgeni on Hellgate's auto, 2026-11-28: "its a bit junky in the auto as it jumps"): the
// zero-press run's vertical path cut into legs (up or down runs between turns). legs/s = turns a second; hops/s = legs
// under 1.5 rows (small up-down twitches: the jumpy look); flips/s = gravity flips a second; swing = 1 s windows whose height
// spread is over 8 rows. AUTO.md "Calm auto". Light (one run), no heavy lock.
const { GD, readGdlvl } = require("./io.js");
function jank(level, o = {}) {
  const r = GD.run(GD.makeWorld(level.objects, level.header), []), p = r.path, T0 = (o.from || 0) * 240, T1 = Math.min(p.length, o.to ? o.to * 240 : p.length);
  const legs = []; let dir = 0, y0 = p[T0].y, t0 = T0, flips = 0;
  for (let t = T0 + 1; t < T1; t++) {
    const d = Math.sign(Math.round((p[t].y - p[t - 1].y) * 10));
    if (d && dir && d !== dir) { legs.push({ t: t0 / 240, h: Math.abs(p[t - 1].y - y0) }); y0 = p[t - 1].y; t0 = t; }
    if (d) dir = d;
    if (p[t].grav !== p[t - 1].grav) flips++;
  }
  let swing = 0, win = 0;
  for (let t = T0; t + 240 < T1; t += 60, win++) { let lo = 1e9, hi = -1e9; for (let k = t; k < t + 240; k++) { lo = Math.min(lo, p[k].y); hi = Math.max(hi, p[k].y); } if (hi - lo > 240) swing++; }
  const T = (T1 - T0) / 240, hops = legs.filter(l => l.h < 45).length;
  return { secs: +T.toFixed(1), clears: !r.dead, legsPerS: +(legs.length / T).toFixed(2), hopsPerS: +(hops / T).toFixed(2), flipsPerS: +(flips / T).toFixed(2), swing, windows: win,
    meanLegRows: +(legs.reduce((a, l) => a + l.h, 0) / Math.max(1, legs.length) / 30).toFixed(2) };
}
module.exports = { jank };
if (require.main === module) {
  const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  const files = a.filter((x, i) => !x.startsWith("--") && !(i && ["--from", "--to"].includes(a[i - 1])));
  for (const f of files) {
    const j = jank(readGdlvl(f).level, { from: +opt("--from") || 0, to: +opt("--to") || 0 });
    console.log(a.includes("--json") ? JSON.stringify({ file: f, ...j }) : `${f.split("/").pop()}  legs/s ${j.legsPerS}  hops/s ${j.hopsPerS}  flips/s ${j.flipsPerS}  mean leg ${j.meanLegRows} rows  swing>8 ${j.swing}/${j.windows}${j.clears ? "" : "  DIES"}`);
  }
}
