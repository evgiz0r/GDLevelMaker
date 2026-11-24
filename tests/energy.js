// node tests/energy.js -- tools/energy.js: a level calm then busy gives a rising curve, and it matches a sheet that
// asks for that shape (rho 1) and not one that asks for the opposite.
const assert = require("assert");
const { GD } = require("../tools/io.js");
const EN = require("../tools/energy.js");
const o = (id, c, r) => ({ id, x: c * 30 + 15, y: r * 30 + 15, rot: 0, props: {} });
const objs = [];
for (let c = 20; c < 200; c += 12) objs.push(o(8, c, 0));          // calm: a spike every 12 blocks
for (let c = 200; c < 400; c += 4) objs.push(o(8, c, 0));          // busy: every 4 blocks
objs.push(o(1, 420, 0));
const c = EN.curve({ header: GD.DEFAULT_HEADER, objects: objs });
const half = c.bars.length >> 1, m = a => a.reduce((s, b) => s + b.e, 0) / a.length;
assert(m(c.bars.slice(half)) > m(c.bars.slice(0, half)) + 0.3, "busy half reads higher");
const end = c.end, beats = [0, 1, 2, 3].map(i => ({ id: "b" + i, t: [i * end / 4, (i + 1) * end / 4] }));
const up = EN.vsSheet(c, { beats: beats.map((b, i) => ({ ...b, energy: i / 3 })) }), down = EN.vsSheet(c, { beats: beats.map((b, i) => ({ ...b, energy: 1 - i / 3 })) });
assert(up.rho > 0.7 && down.rho < -0.7, JSON.stringify([up.rho, down.rho]));
console.log("ok energy curve and sheet match", up.rho, down.rho);
