// node tests/carry_windows.js -- lib/difficulty.js carryWindowCache: windows carried from a level to an edited copy
// (a spike moved; a decoration inserted at index 0, shifting every index) must equal a fresh measuring. ~2.5 min,
// heavy (takes the heavy-job lock).
require("../tools/heavy.js").claim();
const { GD, readGdlvl } = require("../tools/io.js");
const DF = require("../lib/difficulty.js"), S = require("../tools/solutions.js");
const L = readGdlvl(__dirname + "/../levels/archive/gdlm_45_first_flight.gdlvl"), s = S.get(L.levelStr, true), ev = s.events;
const objs = L.level.objects;
const wOld = GD.makeWorld(objs, L.level.header);
let t = Date.now(); DF.measureWindows(wOld, ev); console.log("old level measured", Date.now() - t, "ms");
let failed = false;
const cmp = (name, objsNew, ranges, aToB) => {
  const wNew = GD.makeWorld(objsNew, L.level.header);
  const n = DF.carryWindowCache(wOld, wNew, ranges, aToB);
  t = Date.now(); const a = DF.measureWindows(wNew, ev); const tc = Date.now() - t;
  const wRef = GD.makeWorld(objsNew, L.level.header);
  t = Date.now(); const b = DF.measureWindows(wRef, ev, { cache: false }); const tr = Date.now() - t;
  let diff = 0; for (const x of a) { const y = b.find(q => q.tick === x.tick && q.type === x.type); if (!y || y.lo !== x.lo || y.hi !== x.hi) diff++; }
  if (diff || !n) failed = true;
  console.log(`${diff || !n ? "FAIL " : "ok   "}${name}: carried ${n}, with carry ${tc} ms, fresh ${tr} ms, inputs ${a.length}, differing ${diff}`);
};
// 1: move a hazard in the middle 30 units right
const hz = objs.map((o, i) => [o, i]).filter(([o]) => GD.objInfo(o.id).kind === "hazard");
const [h, hi] = hz[Math.floor(hz.length / 2)];
const moved = objs.map((o, i) => i === hi ? Object.assign({}, o, { x: o.x + 30 }) : o);
cmp("spike moved at x " + Math.round(h.x), moved, [[h.x - 60, h.x + 90]], null);
// 2: a decoration inserted at index 0 (every index shifts by one), at x 15
const ins = [{ id: 1764, x: 15, y: 300, rot: 0, flipX: false, flipY: false, props: { 1: "1764", 2: "15", 3: "300" } }].concat(objs);
cmp("deco inserted at index 0", ins, [[0, 60]], objs.map((_, i) => i + 1));
process.exit(failed ? 1 : 0);
