// node tests/polish.js  -- checks for tools/polish.js (POLISH.md), ~35 s
// 1. a cube tap (press + release next tick) is one input, a dash hold is a press and a release
// 2. cube timings' tightest tap (block 32.8) has a 13 ms window when the tap moves as a pair (moving
//    the press alone into its own release gave 8 ms, tools/windows.js)
// 3. the read + deco passes add only objects without collision, and the level still solves
const assert = require("assert");
const { GD, readGdlvl } = require("../tools/io.js");
const P = require("../tools/polish.js");

const L = readGdlvl(__dirname + "/../examples/cube_timings.gdlvl");
const w = GD.makeWorld(L.level.objects, L.level.header);
const r = GD.solveAny(w);
assert(r.ok, "cube timings solves");
const ev = r.events.slice().sort((a, b) => a.tick - b.tick);
const ins = P.inputs(ev);
assert.strictEqual(ins.filter(i => i.type === "tap").length, 11, "11 taps");
assert(ins.some(i => i.type === "press") && ins.some(i => i.type === "release"), "the dash orb hold is a press and a release");
const path = GD.run(w, ev).path;
const k = ins.findIndex(i => Math.abs(path[i.tick].x / 30 - 32.8) < 0.2);
assert(k >= 0, "the tap at block 32.8");
const win = P.windowOf(w, ev, ins, k);
assert.strictEqual(win.ms, 13, "13 ms window at block 32.8, got " + win.ms);
console.log("ok  inputs and windows");

const res = P.polish(__dirname + "/../examples/cube_timings.gdlvl", { passes: ["read", "deco"] });
const before = new Set(L.level.objects.map(o => o.id + "," + o.x + "," + o.y));
const added = res.objs.filter(o => !before.has(o.id + "," + o.x + "," + o.y));
const solidOrHazard = added.filter(o => ["hazard", "orb", "pad", "mode", "gravity", "speed"].includes(GD.objInfo(o.id).kind));
assert.strictEqual(solidOrHazard.length, 0, "read/deco add no gameplay objects");
assert(res.r1.ok, "still solves after read + deco");
assert(res.log.some(l => l.pass === "read" && !l.kept), "indicators added");
console.log(`ok  read + deco: ${added.length} objects added or reskinned, still solves`);
