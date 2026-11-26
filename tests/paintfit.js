// node tests/paintfit.js -- the picture fitter (lib/paintfit.js) and the painter (tools/paintscene.js), DECOART.md:
// a fit beats the flat mean colour by far, the GD objects (base channel + HSV) redraw the fit, only deco pieces come out,
// and the no-art view knows their shapes.
"use strict";
const assert = require("assert");
const PF = require("../lib/paintfit.js"), PS = require("../tools/paintscene.js"), O = require("../lib/objects.js");
const w = 96, h = 48, sc = PS.scene("hellgate", w, h, 42, 3, { focal: 0.6 }), T = PS.raster(sc);
const flat = PF.render([], w, h, [0, 1, 2].map(k => { let s = 0; for (let i = 0; i < w * h; i++) s += T[3 * i + k]; return s / (w * h); }));
const f = PF.fit({ w, h, rgb: T }, { shapes: 60, seed: 2, tries: 60, climb: 30 });
const e0 = PF.rmse(flat, T);
assert(f.shapes.length >= 50, "most shapes placed: " + f.shapes.length);
assert(f.error < e0 * 0.5, `fit ${f.error.toFixed(1)} vs flat ${e0.toFixed(1)}`);
const g = PF.toGD(f.shapes, { upp: 2.5, ch0: 700 });
for (const o of g.objects) assert.strictEqual(O.objInfo(o.id).kind, "decoration", "deco only: " + o.id);
const back = PF.render(PF.fromGD(g.objects, g.channels, { upp: 2.5 }), w, h, f.bg);
assert(PF.rmse(back, T) < f.error + 1.5, `GD objects redraw the fit: ${PF.rmse(back, T).toFixed(2)} vs ${f.error.toFixed(2)}`);
const v = PS.vector(sc);
assert(v.length > 20 && PF.rmse(PF.render(v, w, h, [0, 0, 0]), T) < e0, "the vector version looks like the painting");
// shapes: the triangle's right angle is at the bottom right (GD's 693 rises to the right)
const one = PF.render([{ k: "tri", x: 5, y: 5, w: 10, h: 10, rot: 0, c: [255, 255, 255], a: 1 }], 10, 10, [0, 0, 0]);
assert(one[3 * (9 * 10 + 8)] > 200 && one[3 * (1 * 10 + 1)] < 50, "693 rises to the right");
global.GD = {}; require("../lib/look.js");
const LOOK = (global.GD.LOOK || require("../lib/look.js").LOOK);
assert(LOOK.isFlat(211) && LOOK.isFlat(693) && LOOK.isFlat(497), "the no-art view draws the flat pieces");
console.log(`ok paintfit: fit ${f.error.toFixed(1)} (flat ${e0.toFixed(1)}), ${g.objects.length} objects, ${Object.keys(g.channels).length} channels`);
