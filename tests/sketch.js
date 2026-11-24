// node tests/sketch.js -- lib/sketch.js (the whiteboard's sketch -> level, DRAW.md): pens, areas, stamps off the grid,
// deco without key 155 and with its colours in the header, the jump marks as events, speed / time.
const SK = require("../lib/sketch.js"), GD = Object.assign({}, require("../lib/gd.js"), require("../lib/physics.js"));
let fail = 0; const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fail++; };
const conv = items => SK.convert({ speed: 1, items });

let r = conv([{ k: "stroke", pen: "ground", pts: [[300, 0], [300, 1], [420, 1.5], [450, 61], [600, 62]] }]);
ok(r.play.some(o => o.id === 1 && Math.abs(o.y - 46) < 1) && r.play.every(o => o.y > 0), "ground: the flat top keeps its drawn height (off the grid: a block at y 46), nothing under the ground");
r = conv([{ k: "stroke", pen: "ground", pts: [[100, 0], [400, 300]] }]);
ok(r.play.filter(o => o.id === 1338).length >= 8, "ground: a 45 degree stroke becomes 45 degree slopes");
r = conv([{ k: "stroke", pen: "ground", pts: [[300, 0], [300, 60], [420, 60], [420, 0], [302, 1]] }]);
ok(SK.isLoop([[300, 0], [300, 60], [420, 60], [420, 0], [302, 1]]) && r.play.filter(o => o.id === 1).length === 8, "ground area: a loop is filled (4 columns x 2)");
r = conv([{ k: "stroke", pen: "spikes", pts: [[600, 0], [600, 40], [700, 40], [700, 0], [602, 0]] }]);
ok(r.play.filter(o => o.id === 8).length === 3 && r.play.every(o => o.y === 15), "spike area: spikes along its floor");
r = conv([{ k: "stroke", pen: "platform", pts: [[0, 120], [300, 120]] }, { k: "stroke", pen: "spikes", pts: [[30, 88], [270, 88]] }]);
ok(r.play.filter(o => o.id === 8).every(o => o.rot === 180), "spikes under a platform hang (point away from the solid)");
r = conv([{ k: "stamp", what: "orb:pink", x: 123.4, y: 56.7, rot: 30 }]);
ok(r.play[0].id === 141 && r.play[0].x === 123.4 && r.play[0].y === 56.7 && r.play[0].rot === 30, "stamps keep their exact spot and turn");
r = conv([{ k: "stroke", pen: "deco", col: [255, 0, 0], w: 8, pts: [[0, 100], [100, 150], [200, 100]] }, { k: "stamp", what: "prop:tree", x: 300, y: 0 }, { k: "stroke", pen: "note", pts: [[0, 0], [9, 9]] }]);
ok(r.deco.length > 10 && r.play.length === 0 && r.deco.every(o => !(o.props && 155 in o.props)), "deco lines and props are deco, never key 155");
ok(/6_800/.test(r.header) && r.notes.length === 1, "deco colours in the header; notes stay out of the level");
const sk = { speed: 1, items: [{ k: "press", x: 311.58, y: 0 }, { k: "press", x: 623.16, x1: 934.74, y: 0 }] };
const ev = SK.planEvents(sk);
ok(ev.length === 4 && ev[0].tick === 240 && ev[1].tick === 241 && ev[2].tick === 480 && ev[3].tick === 720, "jump marks -> events (tap, hold) at the level's speed");
ok(Math.abs(SK.timeToX({ speed: 2, items: [] }, 1) - GD.SPEEDS[2].x * 60) < 1e-6 && /kA4,2/.test(SK.convert({ speed: 2, items: [] }).header) && /kA4,0/.test(SK.convert({ speed: 1, items: [] }).header), "speed: time <-> x, header kA4 (0 = 1x)");
const sp = { speed: 1, items: [{ k: "stamp", what: "speed:2", x: 311.58, y: 30 }] };
ok(Math.abs(SK.xToTime(sp, 311.58 + GD.SPEEDS[2].x * 60) - 2) < 1e-6, "a speed stamp changes the time along the board");
r = conv([{ k: "stroke", pen: "ground", pts: [[200, 0], [300, 40], [500, 70], [700, 60], [800, 0]] }]);
const w = GD.makeWorld(r.objects, r.header), s = GD.solveAny(w);
ok(s.ok, "a drawn hill is beatable");
console.log(fail ? fail + " failed" : "all ok"); process.exit(fail ? 1 : 0);
