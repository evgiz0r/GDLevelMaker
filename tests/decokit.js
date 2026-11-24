// node tests/decokit.js -- decokit.motion (count per screen by energy, nothing drifts, pulses mostly off the beat) and
// decokit.midTone (block/bg ~3, under contrast.js's stark line, hazards >= 4 off the background) for every hue;
// decokit.rolePalette and tools/roles.js (colour by role: mush fails, clear passes, the official levels pass).
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
// rolePalette: every hue gives a palette whose roles separate by tools/roles.js's own rule
for (let h = 0; h < 360; h += 15) { const p = D.rolePalette(h);
  ok(p.ok, `rolePalette(${h}): ${JSON.stringify(p.ratios)}${p.ok ? "" : " mixes " + Object.keys(p.check).filter(k => p.check[k]).join(",")}`); }
// roles.js on a made-up section: blocks (skin 2) on a grey sky, deco touching them in the bodies' value -> mush; the same
// deco lifted to the sky's value -> clear; and official levels 1-12 pass
const RL = require("../tools/roles.js");
const lvl = decoCh => { const objects = [];
  for (let c = 0; c < 40; c++) objects.push({ id: 2, x: 15 + c * 30, y: 15, rot: 0, props: { 21: "4" } });
  for (let c = 0; c < 40; c += 2) objects.push({ id: 211, x: 15 + c * 30, y: 45, rot: 0, props: { 21: String(decoCh), 128: "1", 129: "1" } });
  return { name: "mush test", header: "kS38,1_60_2_60_3_70_6_1000|1_250_2_250_3_250_6_4|1_22_2_22_3_27_6_5|1_58_2_58_3_66_6_6|", objects }; };
const mush = RL.measure(lvl(5)), clear = RL.measure(lvl(6));
ok(!mush.ok && mush.byPair.pathDeco, `dark-grey deco on dark-grey block bodies fails (${JSON.stringify(mush.byPair)})`);
ok(clear.ok, `the same deco at the sky's value passes (${JSON.stringify(clear.byPair)})`);
for (let n = 1; n <= 12; n++) { let r; try { r = RL.measure(require("../tools/contrast.js").load("official:" + n)); } catch (e) { continue; }
  ok(r.ok, `official ${n} ${r.name}: ${r.failed}/${r.sections} sections`); }
// theme kits: every variant's palette passes the role pairs; the space kit on a repo level's gameplay mixes nothing
const TH = require("../tools/theme.js");
for (const t of TH.list()) for (const [v, r] of Object.entries(TH.check(t))) ok(r.ok, `theme ${t}/${v} palette${r.ok ? "" : " mixes " + r.mixes.join(",")}`);
{ const out = require("path").join(__dirname, "..", "local", "tmp", "theme_test.gdlvl");
  const r = TH.demo("space", require("path").join(__dirname, "..", "levels", "gdlm_45_first_flight.gdlvl"), { out });
  const R = RL.measure(require("../tools/contrast.js").load(r.out)), ch = require("../tools/channels.js").check(require("../tools/io.js").readGdlvl(r.out).level);
  ok(R.ok, `space demo on GDLM 45: ${R.failed}/${R.sections} sections mix ${JSON.stringify(R.byPair)}`);
  ok(ch.ok, `space demo: no deco on an undefined channel (${ch.undefinedCount})`); }
console.log(bad ? `${bad} FAILED` : "all passed"); process.exit(bad ? 1 : 0);
