// node tests/thumb.js -- tools/thumb.js without a browser: the level-data score picks a busy stretch over an empty one,
// candidates keep their spacing, and the picture score ranks a colourful detailed frame above a flat one.
const assert = require("assert"), fs = require("fs"), path = require("path"), os = require("os");
const { GD } = require("../tools/io.js");
const T = require("../tools/thumb.js"), { writePng } = require("../tools/png.js");
const o = (id, c, r) => ({ id, x: c * 30 + 15, y: r * 30 + 15, rot: 0, props: {} });
const objs = [];
for (let c = 20; c < 300; c += 15) objs.push(o(1, c, 0));                       // sparse: a block every 15
for (let c = 300; c < 420; c++) { objs.push(o(1, c, 0)); if (c % 3 === 0) objs.push(o(8, c, 1)); objs.push(o(1, c, 5)); }  // busy
objs.push(o(1, 500, 0));
const L = { header: GD.DEFAULT_HEADER, objects: objs }, w = GD.makeWorld(objs, L.header);
const v = 311.58 / 240, pth = []; for (let k = 0; k * v < 15000; k++) pth.push({ x: k * v, y: 0, mode: "cube" });
const c = T.dataScores(L, w, pth), best = c.slice().sort((a, b) => b.data - a.data)[0];
assert(best.x > 300 * 30 - 400 && best.x < 420 * 30 + 300, "best moment in the busy stretch: x " + best.x);
const p = T.pickSpaced(c, 6, 2);
for (let i = 1; i < p.length; i++) assert(p[i].t - p[i - 1].t >= 2 - 1e-9, "spaced 2 s");
assert(p.length === 6, "6 candidates");
// pictures: flat purple vs coloured stripes with edges
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "thumbtest-")), W = 64, H = 36;
const flat = Buffer.alloc(W * H * 4), busy = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) { flat.set([40, 0, 80, 255], i * 4); const x = i % W, s = Math.floor(x / 4) % 3; busy.set(s === 0 ? [250, 40, 40, 255] : s === 1 ? [30, 220, 60, 255] : [20, 30, 240, 255], i * 4); }
writePng(path.join(dir, "flat.png"), W, H, flat); writePng(path.join(dir, "busy.png"), W, H, busy);
const a = T.imageScore(path.join(dir, "flat.png")), b = T.imageScore(path.join(dir, "busy.png"));
assert(b.colour > a.colour && b.detail > a.detail && b.flat < a.flat, JSON.stringify({ a, b }));
fs.rmSync(dir, { recursive: true, force: true });
console.log("ok thumb: busy stretch at", best.t, "s; picture score", JSON.stringify(b), "vs flat", JSON.stringify(a));
