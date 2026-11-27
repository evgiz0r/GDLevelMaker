// node tests/fix_radius.js -- GD 2.2's level setting "Fix Radius Collision" (header kA39) picks the saw test (lib/physics.js
// makeWorld fixRadius; PHYSICS.md "Fix Radius Collision"): on = centre distance < half the player + the saw's radius, off =
// the player's rect against the circle. Checked on Evgeni's clear of the room-mover lab in GD 2.2091 (2026-11-27): with
// kA39,1 (as the level has) its 21 presses clear; with kA39,0 the same presses die on the saw at (1485, 450), x ~1498.
const assert = require("assert");
const { GD, readGdlvl } = require("../tools/io.js");
const L = readGdlvl(__dirname + "/../levels/gdlm_lab_room_mover.gdlvl");
const TICKS = [648, -676, 780, -808, 840, -856, 912, -944, 1012, -1040, 1132, -1160, 1224, -1248, 1284, -1316, 1872, -1892, 1992, -2024];
const ev = TICKS.map(t => ({ tick: Math.abs(t), type: t > 0 ? "press" : "release" }));
const run = hdrEdit => { const lv = GD.parseLevel(L.levelStr.replace(/(^[^;]*?)kA39,\d/, (m, a) => a + hdrEdit)); return GD.run(GD.makeWorld(lv.objects, lv.header), ev); };
const on = run("kA39,1"), off = run("kA39,0");
const end = r => r.path[r.path.length - 1];
assert.ok(!end(on).dead, "kA39 on: the game's clear clears (died at x " + end(on).x.toFixed(1) + " " + end(on).why + ")");
assert.ok(end(off).dead && end(off).why === "saw" && Math.abs(end(off).x - 1498) < 5, "kA39 off: dies on the saw near x 1498 (got " + end(off).x.toFixed(1) + " " + end(off).why + ")");
console.log("fix radius ok: on clears, off dies on the saw at x " + end(off).x.toFixed(1));
