// node tests/structdeco.js -- the structure deco pass (tools/structdeco.js): looks per section, whole structures, holders,
// the inside of big structures, the 2-3 looks rule
"use strict";
const SD = require("../tools/structdeco.js"), assert = require("assert");
const blk = (c, r) => ({ id: 1, x: c * 30 + 15, y: r * 30 + 15, rot: 0, flipX: false, flipY: false, props: {} });
const objs = [];
for (let c = 0; c < 8; c++) for (let r = 0; r < 4; r++) objs.push(blk(c, r));   // a big 8 x 4 structure on the ground
for (let c = 18; c < 22; c++) objs.push(blk(c, 5));                               // a floating bar from block 18
for (let c = 38; c < 41; c++) objs.push(blk(c, 4));                               // another from block 38
const level = { header: "kS38,1_0_2_0_3_0", objects: objs };
// one look
let r = SD.pass(level, null, true, {});
assert(r.objects.length > 100, "dressed");
assert(/holders \{/.test(r.notes[0]), "holders counted");
assert(r.objects.some(o => o.id === 1293 && o.props[43]), "the big structure gets its top-lit gradient");
// two looks: the 8 x 4 structure starts in section 1 and stays in one look though it runs past block 5
r = SD.pass(level, null, { sections: [{ from: 0, pal: "fire" }, { from: 5, pal: "ice" }, { from: 30, pal: "ice", design: "inner base" }], holders: false }, {});
const ch = o => +o.props[21];
const onBig = r.objects.filter(o => o.x < 8 * 30 && o.y < 4 * 30 && o.props[21]);
assert(onBig.length && onBig.every(o => ch(o) >= 912 && ch(o) < 922), "the big structure in the first look (fire, 912) only");
assert(r.objects.some(o => o.x > 18 * 30 && o.x < 22 * 30 && ch(o) >= 922 && ch(o) < 932), "the bar in the ice look (922)");
assert(/holders off/.test(r.notes[0]));
// four looks: warned
r = SD.pass(level, null, { sections: [{ from: 0 }, { from: 10, design: "outline" }, { from: 20, design: "inner base" }, { from: 30, design: "drawn" }], holders: false }, {});
assert(r.notes.some(n => /WARN 4 structure looks/.test(n)), "more than 3 looks warned");
// interior off
const a = SD.pass(level, null, { holders: false }, {}).objects.length, b = SD.pass(level, null, { holders: false, interior: false }, {}).objects.length;
assert(b < a, "interior: false draws less");
console.log("structdeco: ok");
// design themes: a preset, a preset with fields changed, a whole new one; hazards dressed; sky + backdrop drawn
{
  const DT = require("../tools/designthemes.js");
  const t = DT.resolve({ theme: "frost", spikes: "glow", pal: { extends: "ice", line: [255, 0, 0] } });
  assert(t.design === "inner base" && t.spikes === "glow" && t.pal.line[0] === 255 && t.pal.base, "a theme changed on the fly");
  const lv = { header: level.header, objects: level.objects.concat([{ id: 8, x: 12 * 30 + 15, y: 15, rot: 0, flipX: false, flipY: false, props: {} }]) };
  const r2 = SD.pass(lv, null, { sections: [{ from: 0, theme: "frost" }, { from: 30, theme: { pal: "gold", design: "outline", spikes: "core", backdrops: { a: ["stars"] }, skies: [{ bg: [1, 2, 3], ground: [0, 0, 0] }] } }], holders: false }, {});
  assert(r2.notes.some(n => /hazards: 1 dressed/.test(n)), "the spike dressed in its section's design");
  assert(r2.notes.some(n => /backdrops: 2 skies/.test(n)), "both sections set their sky");
  assert(r2.objects.some(o => o.id === 899 && o.props[23] === "1013"), "the middleground coloured with the sky");
  const si = SD.indicators({ indicators: {}, structures: { sections: [{ from: 0, theme: "void" }] } });
  assert(si.style[0][1] === "pointer" && si.colour[0][1] === "auto", "the theme's indicator style");
  // every theme's skies, as the pass lifts them, pass the contrast rules (Evgeni 2026-11-27: "the background and the
  // blocks look too alike")
  const BD = require("../tools/backdrops.js"), BP = require("../tools/blockdesigns.js").PAL;
  for (const [n, t] of Object.entries(DT.THEMES)) for (const sky of t.skies) { const f = BD.check(BP[t.pal], BD.fit(BP[t.pal], sky));
    assert(!f.length, `${n} sky ${sky.bg}: ${f.join("; ")}`); }
  assert(BD.check(BP.fire, { bg: [92, 24, 22], ground: [10, 2, 2] }).length, "a sky in the blocks' own colour fails");
  console.log("structdeco themes: ok");
}
