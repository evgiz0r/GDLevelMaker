// node tests/decokit.js -- decokit.motion (count per screen by energy, nothing drifts, pulses mostly off the beat) and
// decokit.midTone (block/bg ~3, under contrast.js's stark line, hazards >= 4 off the background) for every hue.
const D = require("../tools/decokit.js"), C = require("../tools/contrast.js");
let bad = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) bad++; };
const G = { pulse: [11, 12, 13, 14], bob: [21, 22, 23], sway: [31] };
const m = D.motion(0, 6000, Object.assign({ beat: 155.8, spb: 0.5, energy: 1 }, G));
ok(Math.abs(m.length / 10 - 46) < 3, `energy 1: ${(m.length / 10).toFixed(1)} triggers a screen (target ~45)`);
const calm = D.motion(0, 6000, Object.assign({ beat: 155.8, spb: 0.5, energy: 0.3 }, G));
ok(calm.length / 10 < 25, `energy 0.3: ${(calm.length / 10).toFixed(1)} a screen`);
const net = {}; for (const t of m) if (t.id === 901) net[t.props[51]] = (net[t.props[51]] || 0) + +t.props[29];
ok(Object.values(net).every(v => Math.abs(v) < 1e-9), "bob groups end where they began");
const rot = {}; for (const t of m) if (t.id === 1346) rot[t.props[51]] = (rot[t.props[51]] || 0) + +t.props[68];
ok(Object.values(rot).every(v => Math.abs(v) < 1e-9), "sway groups end upright");
const P = m.filter(t => t.id === 1006), onBeat = P.filter(t => Math.abs(t.x / 155.8 - Math.round(t.x / 155.8)) < 0.02).length / P.length;
ok(onBeat < 0.4, `pulses on a beat: ${Math.round(onBeat * 100)}% (real levels ~30%)`);
for (let h = 0; h < 360; h += 30) { const p = D.midTone(h);
  ok(p.ratios.blockBg >= 2.5 && p.ratios.blockBg < C.STARK && p.ratios.hazardBg >= 4 && C.ratio(p.edge, p.block) >= 3,
    `midTone(${h}): block/bg ${p.ratios.blockBg}, hazard/bg ${p.ratios.hazardBg}, edge/block ${p.ratios.edgeBlock}`); }
console.log(bad ? `${bad} FAILED` : "all passed"); process.exit(bad ? 1 : 0);
