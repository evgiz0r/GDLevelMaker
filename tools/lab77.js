// node tools/lab77.js [--check]  -- writes specs/77_missing_physics_lab.json: GDLM 77, the lab level for what our sim still
//   gets wrong or never saw in the game: the open rows of PHYSICS.md "The mismatch queue" that need the game (5 pink orb,
//   6 pink pad, 7 ship entry, 10 teleport angles, 11 upside-down cube into the ground, 14 UFO / robot / spider / swing,
//   4c slopes in other modes) and the "missing" list (mirror portal, a player carried by a moving block).
//   Then: node tools/make.js specs/77_missing_physics_lab.json.
// Built for the probe mod, not for a person: `node tools/probe.js play save:"GDLM 77 missing physics lab" --launch` presses
// the sim's route on exact ticks and logs the true position every tick (GEODE.md "Playback"). Where the log and the sim part,
// the sim is wrong right there; each station's note says what the sim predicts. Kept for when we get to these rows
// (the user, 2026-11-27: "a level of missing physics, we can have for future when we hit it").
// Order: stations the sim is surest of first, the ones that may kill in the game last (a death ends the run there):
//   1-2 mirror, 3-5 pink pad (cube, ball, ship), 6 pink orb, 7-8 ship entry, 9-12 UFO / robot / spider / swing,
//   13-14 ball and ship on a slope, 15-17 teleport at 0 / 45 / 90 degrees, 18 a block that lifts the cube, 19 the green
//   orb throw into the ground upside down.
// Not here on purpose: teleport variants 2902 / 2064 and the teleport trigger 3022 (we don't know what they do yet: never
// guess an id -- CLAUDE.md), rotated slopes (4c's Bloodbath case: a lab of its own once 1-19 are read).
// --check: plays the built level's saved route in the sim and prints per station what the sim does (the predictions).
const fs = require("fs"), path = require("path");
const b64 = s => Buffer.from(s).toString("base64");
const objs = [], lab = [];
let col = 22;   // GD's "Attempt N" text covers the first ~12 blocks
const label = (c, text, row = 7.5) => objs.push([914, c, row, { props: { "31": b64(text), "32": "0.5" } }]);
const RC = { "21": "1001", "22": "1001", "24": "-1" };   // ruler on the ground channel (never an undefined channel: tools/channels.js)
const ruler = (c, from = 0, to = 9) => { for (let r = from; r <= to; r++) {
  objs.push([211, c, r, { props: Object.assign({ "128": "0.12" }, RC) }]);
  objs.push([211, c, r, { dy: -15, props: Object.assign({ "128": "0.6", "129": "0.1" }, RC) }]); } };
const trig = (id, c, row, props, extra) => objs.push([id, c, row, Object.assign({ props }, extra || {})]);
const station = (name, width, metrics, note, build) => {
  const n = lab.length + 1, from = col;
  build(col, n);
  lab.push({ n, name, from, to: from + width, metrics: typeof metrics === "function" ? metrics(from) : metrics, note });
  col += width;
};
const CUBE = 12, SHIP = 13, BALL = 47, UFO = 111, ROBOT = 745, SPIDER = 1331, SWING = 1933;
const portal = (id, c, row = 1) => objs.push([id, c, row]);
const exitPortal = (id, c) => { for (const r of [1, 4, 7, 9]) objs.push([id, c, r]); };   // over the whole height: no flying past it
const roof = (from, to, row = 10) => { for (let k = from; k <= to; k++) objs.push(["block", k, row]); };

// ---- mirror portal (45 on, 46 off): the sim treats it as a screen flip only. A jump over a spike inside it.
station("mirror portal: jump inside", 22, [{ m: "alive" }, { m: "launch", at: 10 }], "sim: the mirror changes nothing in the physics: the same jump arc as outside (x keeps going right in world terms)", c => {
  label(c, `${lab.length + 1} mirror: does the jump change?`);
  portal(45, c + 3); objs.push(["spike", c + 10, 0]); ruler(c + 13, 0, 5); portal(46, c + 18);
});
station("mirror portal: jump outside (same spike)", 16, [{ m: "alive" }], "the same spike outside the mirror: its jump is the reference for station 1", c => {
  label(c, `${lab.length + 1} the same jump, no mirror`);
  objs.push(["spike", c + 7, 0]); ruler(c + 10, 0, 5);
});

// ---- pink pad (row 6, sure:false): cube, ball, ship. No input on any of them.
station("pink pad: cube", 16, c => [{ m: "launch", at: c + 4 }, { m: "alive" }], "no press: sim launches the cube at 0.65 of a yellow pad (vy 10.4), apex ~2.4 blocks. Read the touch step's vy in the log", c => {
  label(c, `${lab.length + 1} pink pad, cube, no press`);
  objs.push([140, c + 4, -0.4]); ruler(c + 8, 0, 6);
});
station("pink pad: ball", 18, c => [{ m: "launch", at: c + 6 }, { m: "alive" }], "no press: sim launches the ball at 0.65 x 0.6 of a yellow pad (vy 6.72)", c => {
  label(c, `${lab.length + 1} pink pad, ball, no press`);
  portal(BALL, c + 2); objs.push([140, c + 6, -0.4]); ruler(c + 10, 0, 6); exitPortal(CUBE, c + 16);
});
station("pink pad: ship", 20, c => [{ m: "launch", at: c + 7 }, { m: "alive" }], "no press: the ship rests on the floor, rolls over the pink pad: sim kicks it at 0.35 of a yellow pad", c => {
  label(c, `${lab.length + 1} pink pad, ship, no press`);
  portal(SHIP, c + 2); objs.push([140, c + 7, -0.4]); roof(c + 2, c + 18); ruler(c + 11, 0, 9); exitPortal(CUBE, c + 18);
});

// ---- pink orb (row 5): one tap from the ground under it
station("pink orb launch", 16, c => [{ m: "launch", at: c + 6 }, { m: "alive" }], "the route taps the pink orb from the floor: sim launches at 0.72 of a jump (apex ~2.1 blocks over the orb). The lab video gave 0.5-0.63", c => {
  label(c, `${lab.length + 1} pink orb from the floor`);
  objs.push([141, c + 6, 1]); objs.push(["spike", c + 7, 0], ["spike", c + 8, 0]); ruler(c + 10, 0, 9);
});

// ---- ship entry speed (row 7): a yellow pad throws the cube through a ship portal, no input until past the rulers
const shipEntry = (when, pc, prow, note) => station(`ship entry ${when}`, 24, c => [{ m: "yAt", at: [c + pc + 2, c + pc + 4] }, { m: "alive" }], note, c => {
  label(c, `${lab.length + 1} ship entry ${when}, no press`);
  objs.push([35, c + 3, -0.4]); portal(SHIP, c + pc, prow);
  ruler(c + pc + 2, 0, 8); ruler(c + pc + 4, 0, 8); roof(c + pc - 1, c + 22, 11);
  exitPortal(CUBE, c + 22);
});
shipEntry("RISING", 4, 3, "the pad throws the cube up through the ship portal: sim halves vy on entry (11.9 -> 5.8): y ~115 at the first ruler, ~103 at the second");
shipEntry("FALLING", 8, 2, "the pad's arc comes down through the ship portal: sim halves vy (-8 -> -4): y ~34 at the first ruler, on the floor by the second. gdsolver's plans fit 0.25 on falling entries");

// ---- modes never seen in the user's game (row 14): spikes to make the route press, a roof to keep it in
station("UFO: flaps over a spike row", 26, [{ m: "accel" }, { m: "alive" }], "sim: each flap sets vy 7 (gravity 0.086 / 0.129 falling); three flaps over the row. The log's vy on each press step answers it", c => {
  label(c, `${lab.length + 1} UFO: flaps`);
  portal(UFO, c + 2); for (let k = c + 6; k <= c + 18; k++) objs.push(["spike", k, 0]); roof(c + 2, c + 24, 8);
  ruler(c + 12, 0, 7); exitPortal(CUBE, c + 24);
});
station("robot: held jump over a long gap", 24, [{ m: "accel" }, { m: "alive" }], "sim: jump 0.5x a cube's, then hovers 67 ticks while held, gravity 0.9x", c => {
  label(c, `${lab.length + 1} robot: long held jump`);
  portal(ROBOT, c + 2); for (let k = c + 8; k <= c + 10; k++) objs.push(["spike", k, 0]); ruler(c + 13, 0, 6); exitPortal(CUBE, c + 22);
});
station("spider: to the roof and back", 26, [{ m: "alive" }], "sim: a tap teleports the spider to the roof at once (GD's spiderTestJumpInternal search), the next tap back to the floor", c => {
  label(c, `${lab.length + 1} spider: roof and back`);
  portal(SPIDER, c + 2); roof(c + 2, c + 24, 5);
  for (let k = c + 7; k <= c + 11; k++) objs.push(["spike", k, 0]);
  for (let k = c + 15; k <= c + 19; k++) objs.push(["spike", k, 4, { rot: 180 }]);
  ruler(c + 13, 0, 5); exitPortal(CUBE, c + 24);
});
station("swing: floor, roof, floor", 28, [{ m: "accel" }, { m: "alive" }], "sim: gravity flips a tick after each press, vy x0.8, gravity 0.086, limit 8", c => {
  label(c, `${lab.length + 1} swing: flips`);
  portal(SWING, c + 2); roof(c + 2, c + 26, 7);
  for (let k = c + 6; k <= c + 9; k++) objs.push(["spike", k, 0]);
  for (let k = c + 12; k <= c + 15; k++) objs.push(["spike", k, 6, { rot: 180 }]);
  for (let k = c + 18; k <= c + 21; k++) objs.push(["spike", k, 0]);
  ruler(c + 16, 0, 7); exitPortal(CUBE, c + 26);
});

// ---- slopes in other modes (row 4c; the cube's slope is measured, these are not)
const slopeUp = (c, n) => { for (let k = 0; k < n; k++) { objs.push([1338, c + k, k]); for (let r = 0; r < k; r++) objs.push(["block", c + k, r]); } };
station("ball up a 45-degree slope", 24, c => [{ m: "yAt", at: [c + 13, c + 15] }, { m: "alive" }], "no press: the ball rolls up 3 blocks of 45-degree slope, sim: held at the top a tick, then launched like the cube (7.405 x the ball's factor)", c => {
  label(c, `${lab.length + 1} ball up a slope, no press`);
  portal(BALL, c + 2); slopeUp(c + 8, 3); for (let k = c + 11; k <= c + 13; k++) for (let r = 0; r < 3; r++) objs.push(["block", k, r]);
  ruler(c + 16, 0, 7); exitPortal(CUBE, c + 22);
});
station("ship up a 45-degree slope", 26, c => [{ m: "yAt", at: [c + 13, c + 16] }, { m: "alive" }], "no press: the ship slides up the slope and off its top: sim rides it like the cube and launches at the top", c => {
  label(c, `${lab.length + 1} ship up a slope, no press`);
  portal(SHIP, c + 2); slopeUp(c + 8, 3); for (let k = c + 11; k <= c + 13; k++) for (let r = 0; r < 3; r++) objs.push(["block", k, r]);
  roof(c + 2, c + 24, 10); ruler(c + 17, 0, 9); exitPortal(CUBE, c + 24);
});

// ---- teleport (row 10): the exit is key 54 above the entry; the 2026-11-26 Deadlocked log says the full key at -53 degrees
for (const deg of [0, 45, 90]) station(`teleport turned ${deg}`, 18, c => [{ m: "dy", at: c + 5 }, { m: "alive" }], `the cube walks into a teleport turned ${deg} degrees, key 54 = 150: sim moves it the full 150 straight up at any angle`, c => {
  label(c, `${lab.length + 1} teleport turned ${deg}`);
  objs.push([747, c + 5, 1, { rot: deg, props: { "54": "150" } }]);
  ruler(c + 9, 0, 9);
});

// ---- a player carried by a moving block (missing in the sim): the cube stands on a block that rises 2 blocks
station("a block lifts the cube", 26, c => [{ m: "yAt", at: [c + 12, c + 16] }, { m: "alive" }], "the cube walks onto a 6-block platform; a move trigger lifts it 60 units over 0.5 s while the cube is on it. Sim: does not carry the player (the block pushes it up only as a landing); GD carries it", c => {
  label(c, `${lab.length + 1} a rising platform`);
  for (let k = c + 8; k <= c + 15; k++) objs.push(["block", k, 0, { group: 81 }]);
  trig(901, c + 10, 9, { "51": "81", "29": "60", "10": "0.5" });
  ruler(c + 17, 0, 6); objs.push(["block", c + 16, 0], ["block", c + 16, 1], ["block", c + 16, 2]);
  for (let k = c + 17; k <= c + 22; k++) objs.push(["block", k, 2]);
});

// ---- green orb into the ground, upside down (row 11; LAST: the game may kill it here)
station("green orb throw into the ground", 25, c => [{ m: "launch", at: c + 6 }, { m: "alive" }], "the route taps the green orb low over the floor: sim flips gravity and throws the cube DOWN (away from its new floor, the roof) into the ground, where it lives. GDLM 67: the game killed it 3 of 4 times. Then a blue portal puts gravity back", c => {
  label(c, `${lab.length + 1} green orb into the ground`);
  // floor spikes under the roof, past where the throw meets the ground: no jump clears them, only the orb's flip to the
  // roof (so the route must take it). v1 had them from +8: the throw itself landed the cube on them
  objs.push([1022, c + 6, 1]); roof(c + 4, c + 19, 6); for (let k = c + 12; k <= c + 15; k++) objs.push(["spike", k, 0]);
  objs.push([10, c + 18, 4]); ruler(c + 21, 0, 6);
});

objs.push(["block", col + 2, 0]);

// keep everything on the grid's own columns; the outro and the signature come from make.js
const spec = { name: "GDLM 77 missing physics lab", desc: "For the probe mod: it plays our route and logs the game. One open physics question per station.",
  accept: { "dead air": "lab level: watch-only stations and labels, no gameplay to fill (tools/deadair.js)" }, lab, objects: objs };
const out = path.join(__dirname, "..", "specs", "77_missing_physics_lab.json");
// stations where the probe must NOT press (their answer is what the game does on its own): the probe route drops the
// presses the viewer's human-like route puts there (it flies every ship mid-corridor)
const HANDS_OFF = ["pink pad: ship", "ship entry RISING", "ship entry FALLING", "ball up a 45-degree slope", "ship up a 45-degree slope"];
spec.lab.forEach(l => { if (HANDS_OFF.includes(l.name)) l.handsOff = true; });
if (process.argv.includes("--route")) route();
else if (!process.argv.includes("--check")) {
  fs.writeFileSync(out, JSON.stringify(spec, null, 0).replace(/\],\[/g, "],\n["));
  console.log("wrote", out, objs.length, "objects,", lab.length, "stations,", col + 3, "columns");
} else check();

// node tools/lab77.js --route  -- the probe's route: the saved route with every press inside a hands-off station dropped,
// checked to still clear in the sim -> levels/gdlm_77_missing_physics_lab.probe.json ({events}); play it with
// `node tools/probe.js play save:"GDLM 77 missing physics lab" --launch --events levels/gdlm_77_missing_physics_lab.probe.json`
function route() {
  const { GD, readGdlvl } = require("./io.js"), sols = require("./solutions.js");
  const file = path.join(__dirname, "..", "levels", "gdlm_77_missing_physics_lab.gdlvl"), lv = readGdlvl(file);
  const sol = sols.get(lv.levelStr, true); if (!sol) { console.log("no saved route: build it first (make.js)"); process.exit(1); }
  require("./heavy.js").claim();   // the re-solves below are heavy
  const w = GD.makeWorld(lv.level.objects, lv.level.header), off = spec.lab.filter(l => l.handsOff);
  // the first hands-off station with a press in it, on the run of `events`: drop its presses, play through it with the
  // button up, then solve the rest of the level from its end (fewest presses); repeat until none is left
  let events = sol.events.slice();
  for (let round = 0; round < off.length + 1; round++) {
    const p = GD.run(w, events).path, colAt = t => GD.progressX(p[Math.min(t, p.length - 1)]) / 30;
    const L = off.find(l => events.some(e => e.type === "press" && colAt(e.tick) >= l.from && colAt(e.tick) < l.to));
    if (!L) break;
    const t0 = p.findIndex(s => GD.progressX(s) >= L.from * 30);
    const pre = events.filter(e => e.tick < t0);
    if (pre.length && pre[pre.length - 1].type === "press") pre.push({ tick: t0, type: "release" });
    const q = GD.run(w, pre), t1 = q.path.findIndex(s => GD.progressX(s) >= L.to * 30);
    if (t1 < 0) { console.log(`station ${L.n} ${L.name} kills with no press (block ${(GD.progressX(q.path[q.path.length - 1]) / 30).toFixed(1)}): fix the station`); process.exit(1); }
    const r = GD.solveFrom(w, q.path[t1], { held: false });
    if (!r.ok) { console.log(`no way on from the end of station ${L.n} ${L.name} (${r.why || "?"}, block ${r.dieAt ? (r.dieAt.x / 30).toFixed(1) : "?"})`); process.exit(1); }
    events = pre.concat(r.events.filter(e => e.tick >= t1));
    console.log(`station ${L.n} ${L.name}: hands off, the rest re-solved (${r.events.filter(e => e.type === "press").length} presses)`);
  }
  const q = GD.run(w, events);
  const end = q.path[q.path.length - 1];
  console.log(q.done ? "the probe route clears" : `the probe route DIES at block ${(GD.progressX(end) / 30).toFixed(1)}`);
  if (!q.done) process.exit(1);
  const out = file.replace(/\.gdlvl$/, ".probe.json");
  fs.writeFileSync(out, JSON.stringify({ level: "GDLM 77 missing physics lab", from: "tools/lab77.js --route", physics: sol.physics, events }));
  console.log("wrote", out, events.filter(e => e.type === "press").length, "presses");
}

function check() {
  const { GD, readGdlvl } = require("./io.js"), sols = require("./solutions.js");
  const lv = readGdlvl(path.join(__dirname, "..", "levels", "gdlm_77_missing_physics_lab.gdlvl"));
  const sol = sols.get(lv.levelStr, true); if (!sol) { console.log("no saved route: build it first (make.js)"); return; }
  const w = GD.makeWorld(lv.level.objects, lv.level.header), q = GD.run(w, sol.events), route = q.path || [];
  console.log(q.done ? "route clears" : "route DIES at block " + (GD.progressX(q.state || route[route.length - 1]) / 30).toFixed(1));
  for (const L of lab) {
    const seg = route.filter(s => s.x >= L.from * 30 && s.x < L.to * 30);
    if (!seg.length) { console.log(`${String(L.n).padStart(2)} ${L.name}: not reached`); continue; }
    const top = Math.max(...seg.map(s => s.y)), low = Math.min(...seg.map(s => s.y));
    const yAt = c => { const s = route.find(p => p.x >= c * 30); return s ? s.y.toFixed(1) : "-"; };
    const ys = L.metrics.filter(m => m.m === "yAt").flatMap(m => m.at).map(c => `y@${c - L.from} ${yAt(c)}`).join(", ");
    console.log(`${String(L.n).padStart(2)} ${L.name}: y ${low.toFixed(1)}..${top.toFixed(1)}${ys ? "; " + ys : ""}`);
  }
}
