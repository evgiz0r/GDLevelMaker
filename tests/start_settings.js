// node tests/start_settings.js -- the level header's start settings reach the sim (lib/physics.js startOf / startState0):
// kA2 start mode, kA3 mini, kA8 dual, kA11 flipped gravity (GD 2.2081 GJBaseGameLayer::setupLevelStart). A level with
// none of them starts as a normal cube, as before. Light: tiny worlds, no solve.
const assert = require("assert");
const { GD } = require("../tools/io.js");

const floor = []; for (let x = 15; x < 1500; x += 30) floor.push({ id: 1, x, y: -15 });   // something to stand on and an end
const hdr = extra => "kA4,0" + (extra ? "," + extra : "");
const world = extra => GD.makeWorld(floor.map(o => ({ ...o })), hdr(extra));
const first = (extra, inputs = []) => { const w = world(extra), r = GD.run(w, inputs); return { w, s0: GD.startState(w), r }; };

// no settings: a cube on the ground, no start object
{ const { w, s0 } = first(""); assert.strictEqual(w.start, null); assert.strictEqual(s0.mode, "cube"); assert.strictEqual(s0.grav, 1); assert.ok(!s0.p2); }
// kA2 1..7: the mode, with a flying band on the ground for the modes that have one
const modes = ["cube", "ship", "ball", "ufo", "wave", "robot", "spider", "swing"];
for (let k = 1; k < modes.length; k++) {
  const { s0 } = first("kA2," + k);
  assert.strictEqual(s0.mode, modes[k], "kA2," + k);
  if (["ship", "ufo", "wave", "swing", "ball", "spider"].includes(modes[k])) { assert.strictEqual(s0.floorY, 0); assert.ok(isFinite(s0.ceilY), modes[k] + " has a band"); }
}
// a ship start with no input stays a ship and falls to the floor, alive
{ const { r } = first("kA2,1"); const p = r.path[Math.min(200, r.path.length - 1)]; assert.strictEqual(p.mode, "ship"); assert.ok(!p.dead, "ship start lives"); }
// kA3 mini, kA11 upside down
{ const { s0 } = first("kA3,1"); assert.strictEqual(s0.mini, true); }
{ const { s0 } = first("kA11,1"); assert.strictEqual(s0.grav, -1); }
// kA8 dual: player 2 the other way up, the world goes through lib/dual.js
{ const { w, s0, r } = first("kA8,1"); assert.ok(w.hasDual); assert.ok(s0.p2 && s0.p2.grav === -s0.grav, "player 2 flipped");
  const p = r.path[Math.min(100, r.path.length - 1)]; assert.ok(p.p2, "still dual after 100 ticks"); }
// kA2 / kA3 written as 0 = the defaults
{ const { w } = first("kA2,0,kA3,0,kA8,0,kA11,0"); assert.strictEqual(w.start, null); }
console.log("start settings ok");
