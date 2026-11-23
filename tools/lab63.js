// node tools/lab63.js  -- writes specs/63_dual_movers_lab.json: the lab level for dual mode and moving objects
//   (PHYSICS.md "Dual" and "Moving objects"). Each numbered station checks one rule the sim takes from GD's code
//   but nobody has seen in the user's game yet. Then: node tools/make.js specs/63_dual_movers_lab.json.
// The station notes say what the sim expects; what the recording shows instead is a calibration fact.
const fs = require("fs"), path = require("path");
const b64 = s => Buffer.from(s).toString("base64");
const objs = [];
const label = (col, text, row = 6.5) => objs.push([914, col, row, { props: { "31": b64(text), "32": "0.5" } }]);
const trig = (id, col, props) => objs.push([id, col, 7, { props }]);
const lab = [];

// 1 dual cube: player 2 spawns mirrored and rides the roof of the dual band (ASSUMED 300 units: row 9's top)
label(6, "1 dual: where does player 2 ride?");
objs.push([286, 10, 1]);
objs.push(["spike", 20, 0], ["spike", 20, 9, { rot: 180 }]);
lab.push({ n: 1, name: "dual cube", from: 8, to: 26, metrics: [{ m: "alive" }], note: "sim: player 2 rides upside down with its top at y 300 (10 blocks); one press jumps both, mirrored" });
// 2 a gravity portal touched by player 1 flips both (they stay mirrored)
label(26, "2 gravity portal in dual");
objs.push([11, 28, 1]);
objs.push(["spike", 36, 0], ["spike", 36, 9, { rot: 180 }]);
lab.push({ n: 2, name: "dual gravity portal", from: 26, to: 40, metrics: [{ m: "alive" }], note: "sim: player 1 goes to the roof, player 2 to the floor (both flip)" });
// 3 the solo portal low down: player 2 (now on the floor) touches it and is the one kept
label(40, "3 solo portal: who stays?");
objs.push([287, 43, 1]);
lab.push({ n: 3, name: "solo portal", from: 40, to: 50, metrics: [{ m: "alive" }, { m: "yAt", at: [48] }], note: "sim: the floor player stays (GD keeps whoever touched it); if the run ends on the roof, GD kept player 1" });

// 4 a platform rising under the player (move trigger, 2 blocks in 1 s)
const O = 52;
label(O, "4 rising floor");
for (let c = O + 2; c <= O + 14; c++) objs.push(["block", c, 0, { group: 21 }]);
trig(901, O + 6, { "51": "21", "29": "60", "10": "1", "30": "0" });
lab.push({ n: 4, name: "rising platform", from: O, to: O + 18, metrics: [{ m: "alive" }, { m: "yAt", at: [O + 12] }], note: "sim: the cube rides the block up 60 units in 1 s" });
// 5 move to target (100): a spike high up moves onto a marker on the floor
label(O + 18, "5 move to target");
objs.push(["spike", O + 28, 8, { group: 22 }], [211, O + 28, 0, { group: 23 }]);
trig(901, O + 18, { "51": "22", "100": "1", "71": "23", "10": "0.5" });
lab.push({ n: 5, name: "move to target", from: O + 18, to: O + 32, metrics: [{ m: "alive" }], note: "sim: the spike lands on the marker at the floor (jump it)" });
// 6 pause / resume (stop trigger 580): a rising spike paused low, so the cube passes UNDER it (do not jump)
label(O + 32, "6 pause: do not jump");
objs.push(["spike", O + 46, 0, { group: 24 }]);
trig(901, O + 34, { "51": "24", "29": "120", "10": "0.6", "30": "0", "57": "25" });
trig(1616, O + 36, { "51": "25", "580": "1" });
trig(1616, O + 52, { "51": "25", "580": "2" });
lab.push({ n: 6, name: "pause / resume", from: O + 32, to: O + 50, metrics: [{ m: "alive" }], note: "sim: the spike stops ~38 units up (pause after ~0.19 s of 0.6 s) until the resume after the player; without the pause it is 120 up" });
// 7 a multi-trigger spawn loop: every 0.5 s the spike goes up 20 units; 3 steps by the time the cube gets there
label(O + 50, "7 spawn loop: do not jump");
objs.push(["spike", O + 62, 0, { group: 26 }]);
trig(1268, O + 50, { "51": "3" });
objs.push([901, O + 50, 8, { group: 3, props: { "51": "26", "29": "20", "10": "0", "62": "1", "87": "1" } }]);
objs.push([1268, O + 50, 9, { group: 3, props: { "51": "3", "63": "0.5", "62": "1", "87": "1" } }]);
lab.push({ n: 7, name: "multi-trigger loop", from: O + 50, to: O + 66, metrics: [{ m: "alive" }], note: "sim: the spike is 60 up when the cube passes (3 loops); fired once it would be 20 up and kill" });
// 8 a trigger in a toggled-off group does not fire
label(O + 66, "8 toggled-off trigger: do not jump");
trig(1049, O + 68, { "51": "27", "56": "0" });
objs.push([901, O + 72, 7, { group: 27, props: { "51": "28", "29": "-150", "10": "0" } }]);
objs.push(["spike", O + 80, 5, { group: 28 }]);
lab.push({ n: 8, name: "toggled-off trigger", from: O + 66, to: O + 84, metrics: [{ m: "alive" }], note: "sim: the move never fires, the spike stays 5 blocks up; if it drops to the floor, GD fires triggers in a disabled group" });
objs.push(["block", O + 100, 0]);

const spec = { name: "GDLM 63 dual and movers lab", desc: "A test course: play once in practice mode with hitboxes on. Dual mode (1-3) and moving objects (4-8). At 6, 7 and 8, do not jump.", lab, objects: objs };
const out = path.join(__dirname, "..", "specs", "63_dual_movers_lab.json");
fs.writeFileSync(out, JSON.stringify(spec, null, 0).replace(/\],\[/g, "],\n["));
console.log("wrote", out, objs.length, "objects");
