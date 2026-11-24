// node tools/lab68.js [--check]  -- writes specs/68_camera_lab.json: GDLM 68, the camera lab. The user (2026-11-24): "the
//   videos are also good to see how the screen moves upon some objects. make some ship, ufo, swing, wave portals not on
//   the bottom, I'll fly up and down." Stations from gd-visuals' camera-fit wishes (2026-11-24): every camera state held
//   >= 3 s; a cube climb past the 5.5-block cap (to 10), >= 2 s on top, a long drop, a red-pad launch; flying portals
//   low / middle / high, entered walking, rising and falling; two portals back to back (does a camera move restart or
//   blend?); 0.5x / 1x / 2x / 3x on flat ground with a marker every 5 blocks (horizontal camera, zoom); an upside-down
//   cube on a ceiling; open sky next to corridors. Each note gives the station's start time at the level's speeds, so
//   it can be found in a recording without the attempt list. Then: node tools/make.js specs/68_camera_lab.json.
//   --check prints the sim's band (floor / roof) and the route's y range per station.
// Sim's band rule (lib/physics.js enterMode): a flying portal at height y sets floor = max(0, floor((y - 150) / 30) * 30),
// roof = floor + 300 (ball 240, spider 270). What GD's camera does there is the question (VISUALS.md, gd-visuals).
const fs = require("fs"), path = require("path");
const b64 = s => Buffer.from(s).toString("base64");
const objs = [], lab = [];
let col = 22;   // past GD's "Attempt N" text
const label = (c, text, row = 6.5) => objs.push([914, c, row, { props: { "31": b64(text), "32": "0.5" } }]);
// a ruler as in lab67.js (art's): a thin pole with a tick at each block line, ground colour (channel 1001: never white)
const RC = { "21": "1001", "22": "1001", "24": "-1" };
const ruler = (c, from = 0, to = 14) => { for (let r = from; r <= to; r++) {
  objs.push([211, c, r, { props: Object.assign({ "128": "0.12" }, RC) }]);
  objs.push([211, c, r, { dy: -15, props: Object.assign({ "128": "0.6", "129": "0.1" }, RC) }]); } };
const pole = (c, h = 3) => { for (let r = 0; r < h; r++) objs.push([211, c, r, { props: Object.assign({ "128": "0.12" }, RC) }]); };
// speed by column (portals change it), for the station start times: blocks per second at 0.5x / 1x / 2x / 3x
const BPS = { 200: 251.2 / 30, 201: 311.6 / 30, 202: 387.4 / 30, 203: 468 / 30 }, speedAt = [[0, BPS[201]]];
const timeAt = c => { let t = 0, x = 0, v = speedAt[0][1]; for (const [sc, sv] of speedAt.slice(1)) { if (sc >= c) break; t += (sc - x) / v; x = sc; v = sv; } return t + (c - x) / v; };
const station = (name, width, note, build) => { const n = lab.length + 1, from = col; build(col, n); lab.push({ n, name, from, to: from + width, metrics: [{ m: "alive" }], note }); col += width; };
const CUBE = 12, SHIP = 13, UFO = 111, WAVE = 660, SWING = 1933, PAD = 35, RED_PAD = 1332;
const portal = (id, c, row) => objs.push([id, c, row]);
const exitPortal = c => { for (const r of [1, 4, 7, 10, 13, 16]) objs.push([CUBE, c, r]); };   // over every band height: nothing flies past
const stairs = (c, h, flat) => { for (let k = 0; k < h; k++) for (let x = c + 3 * k; x < c + 3 * k + 3; x++) for (let r = 0; r <= k; r++) objs.push(["block", x, r]);
  for (let x = c + 3 * h; x < c + 3 * h + flat; x++) for (let r = 0; r < h; r++) objs.push(["block", x, r]); return c + 3 * h + flat; };
const band = y => { const f = Math.max(0, Math.floor((y - 150) / 30) * 30); return `band ${f}-${f + 300}`; };
const rowY = r => r * 30 + 15;
const HOLD = 34;   // >= 3 s at 1x (10.4 blocks/s)

// 1 cube: climb to 10 blocks (past the 5.5-block cap), 2+ s on top, the long drop
station("cube: climb 10, stay, drop", 80, "cube camera: climb 10 blocks (jump each step), walk 2+ s on top (above the 5.5-block screen cap: how far up does the camera go?), walk off: a 10-block drop (how fast it comes back down). Hexagon Force's fit: +0.38 block per block above 2, cap 5.5; easing 9.75/s ASSUMED", c => {
  label(c, "1 cube: climb all the stairs, walk, drop");
  const e = stairs(c + 4, 10, 24); ruler(c + 2, 0, 14); ruler(e - 10, 10, 16); ruler(e + 12, 0, 14);
});
// 2 cube: a red pad from the ground (fast up to ~6-8 blocks), then 3 s flat
station("cube: red pad launch", 44, "a red pad throws the cube up fast (sim apex in --check): the camera while moving fast. Then 3 s of flat ground", c => {
  label(c, "2 cube: ride the red pad");
  objs.push([RED_PAD, c + 6, 0]); ruler(c + 12, 0, 14); ruler(c + 30, 0, 14);
});
// 3 cube upside down on a ceiling for 3+ s
station("cube upside down on a ceiling", 50, "a gravity portal flips the cube onto a ceiling (row 6) for 3+ s, then back: does the camera follow the flip the same way?", c => {
  label(c, "3 cube: upside down on the ceiling");
  for (let x = c + 4; x < c + 44; x++) objs.push(["block", x, 6]);
  portal(11, c + 6, 1); portal(10, c + 42, 4); ruler(c + 20, 0, 14); ruler(c + 36, 0, 14);
});
// 4 speeds on flat ground, ~3 s each, a pole every 5 blocks
station("speeds 0.5x 1x 2x 3x", 152, "flat ground, ~3 s at each speed (0.5x, 1x, 2x, 3x), a short pole every 5 blocks: does the player's screen x or the zoom change with speed? Back to 1x at the end", c => {
  label(c, "4 speeds: just walk (no jump)");
  const seg = [[200, 26], [201, 32], [202, 39], [203, 47]]; let x = c + 4;
  for (const [id, len] of seg) { portal(id, x, 1); speedAt.push([x, BPS[id]]); for (let p = x + 1; p < x + len; p += 5) pole(p, 3); x += len; }
  portal(201, x + 2, 1); speedAt.push([x + 2, BPS[201]]);
});
// 5 ship low, open sky, then a ship portal high ~1 s later (back to back: does the camera move restart or blend?)
station("ship LOW, then ship HIGH 1 s later", 30 + HOLD * 2, `ship portal on the floor (row 1: sim ${band(45)}): fly 3 s; then fly UP into the second ship portal (row 9, y ${rowY(9)}: sim ${band(rowY(9))}) and stay 3 s. Two band changes ~1 s apart: restart or blend?`, c => {
  label(c, "5 ship: fly, then UP into the high ship portal");
  portal(SHIP, c + 3, 1); ruler(c + 16, 0, 16);
  portal(SHIP, c + 3 + HOLD, 9); portal(SHIP, c + 3 + HOLD, 12);
  ruler(c + 18 + HOLD, 0, 16); exitPortal(c + 28 + HOLD * 2);
});
// 6 ship high, from a tower
station("ship HIGH from a tower", 22 + HOLD + 8, `ship portal on a 6-block tower (row 8, y ${rowY(8)}): sim ${band(rowY(8))}: the band starts 3 blocks up. Fly to both edges, 3+ s`, c => {
  label(c, "6 ship HIGH: climb, fly to both edges");
  const e = stairs(c + 2, 6, 4); portal(SHIP, e - 2, 8); ruler(e + 12, 0, 16); exitPortal(e + HOLD + 4);
});
// 7 ship entered rising from a pad, then a corridor
station("ship from a pad (rising), corridor", 20 + HOLD + 6, `a yellow pad throws you up through a ship portal in the air (row 3, y ${rowY(3)}: rising entry; sim ${band(rowY(3))}), then a corridor (floor row 2, roof row 8) for 3+ s`, c => {
  label(c, "7 pad up into the ship, then the corridor");
  objs.push([PAD, c + 4, 0]); portal(SHIP, c + 7, 3);
  for (let x = c + 18; x < c + 18 + HOLD; x++) objs.push(["block", x, 2], ["block", x, 8]);
  ruler(c + 14, 0, 14); ruler(c + 18 + HOLD / 2, 0, 14); exitPortal(c + 22 + HOLD);
});
// 8 UFO entered falling; 9 UFO high
station("UFO from a pad (falling)", 14 + HOLD + 4, `a yellow pad's arc comes DOWN into a UFO portal (row 2: falling entry; sim ${band(rowY(2))}). Flap up and down 3+ s`, c => {
  label(c, "8 pad, fall into the UFO, flap up and down");
  objs.push([PAD, c + 3, 0]); portal(UFO, c + 10, 2); ruler(c + 18, 0, 14); exitPortal(c + 14 + HOLD);
});
station("UFO HIGH from a tower", 22 + HOLD + 8, `UFO portal on a 6-block tower (row 9, y ${rowY(9)}): sim ${band(rowY(9))}. Flap to the top, let it fall to the bottom`, c => {
  label(c, "9 UFO HIGH: climb, flap up, let it fall");
  const e = stairs(c + 2, 6, 4); portal(UFO, e - 2, 9); ruler(e + 12, 0, 16); exitPortal(e + HOLD + 4);
});
// 10 swing low then a corridor; 11 swing high
station("swing LOW, then a corridor", 8 + HOLD * 2, `swing on the floor (row 1: sim ${band(45)}): open 3 s, then a corridor (floor row 2, roof row 7) 3 s`, c => {
  label(c, "10 swing LOW: up and down, then the corridor");
  portal(SWING, c + 3, 1); ruler(c + 14, 0, 14);
  for (let x = c + 4 + HOLD; x < c + 4 + HOLD * 2 - 4; x++) objs.push(["block", x, 2], ["block", x, 7]);
  ruler(c + 4 + HOLD + 12, 0, 14); exitPortal(c + 6 + HOLD * 2);
});
station("swing HIGH from a tower", 22 + HOLD + 8, `swing portal on a 6-block tower (row 8, y ${rowY(8)}): sim ${band(rowY(8))}`, c => {
  label(c, "11 swing HIGH: climb, flip up and down");
  const e = stairs(c + 2, 6, 4); portal(SWING, e - 2, 8); ruler(e + 12, 0, 16); exitPortal(e + HOLD + 4);
});
// 12 wave mid, open; 13 wave in a corridor
station("wave MID (rising), open", 12 + HOLD + 4, `a pad throws you up into a wave portal (row 3, rising: sim ${band(rowY(3))}); zigzag the full height for 3+ s`, c => {
  label(c, "12 pad up into the wave: zigzag the full height");
  objs.push([PAD, c + 4, 0]); portal(WAVE, c + 7, 3); ruler(c + 18, 0, 14); exitPortal(c + 12 + HOLD);
});
station("wave corridor", 10 + HOLD + 4, `wave in a corridor (floor row 3, roof row 7; entered on the floor: sim ${band(45)}): small zigzags for 3+ s`, c => {
  label(c, "13 wave: small zigzags in the corridor");
  portal(WAVE, c + 3, 1);
  for (let x = c + 8; x < c + 8 + HOLD; x++) objs.push(["block", x, 3], ["block", x, 7]);
  ruler(c + 8 + HOLD / 2, 0, 14); exitPortal(c + 10 + HOLD);
});
// 14 ship very high: the whole band above the ground
station("ship VERY HIGH from a tower", 31 + HOLD + 8, `ship portal on a 9-block tower (row 11, y ${rowY(11)}): sim ${band(rowY(11))}: the whole band is in the air. Fly to both edges, 3+ s`, c => {
  label(c, "14 ship VERY HIGH: climb, fly to both edges");
  const e = stairs(c + 2, 9, 4); portal(SHIP, e - 2, 11); ruler(e + 12, 0, 18); exitPortal(e + HOLD + 4); objs.push([CUBE, e + HOLD + 4, 19]);
});
objs.push(["block", col + 2, 0]);
for (const L of lab) L.note = `starts at ${timeAt(L.from).toFixed(1)} s. ` + L.note;

const spec = { name: "GDLM 68 camera lab", desc: "Fly up and down! Flying portals low, middle and high, open sky and corridors: how GD's camera moves. Record it.", lab, objects: objs };
const out = path.join(__dirname, "..", "specs", "68_camera_lab.json");
if (!process.argv.includes("--check")) {
  fs.writeFileSync(out, JSON.stringify(spec, null, 0).replace(/\],\[/g, "],\n["));
  console.log("wrote", out, objs.length, "objects,", lab.length, "stations,", col + 3, "columns,", timeAt(col + 3).toFixed(1), "s");
} else {
  // the sim on the built level's solved route: per station, its start time, the mode, band (floor / roof), the route's y range
  const { GD, readGdlvl } = require("./io.js"), sols = require("./solutions.js");
  const lv = readGdlvl(path.join(__dirname, "..", "levels", "gdlm_68_camera_lab.gdlvl")), sol = sols.get(lv.levelStr, true);
  if (!sol) { console.log("no saved route: build it first"); process.exit(1); }
  const w = GD.makeWorld(lv.level.objects, lv.level.header), p = GD.run(w, sol.events).path;
  for (const L of lab) {
    const ps = p.filter(s => s.x >= L.from * 30 && s.x < L.to * 30); if (!ps.length) { console.log(L.n, "not reached"); continue; }
    const fl = ps.filter(s => s.mode !== "cube"), m = fl[0] || ps[0];
    console.log(`${String(L.n).padStart(2)} ${L.name.padEnd(36)} t ${(ps[0].tick / 240).toFixed(1).padStart(5)} s (note ${timeAt(L.from).toFixed(1)})  ${m.mode.padEnd(5)} floor ${isFinite(m.floorY) ? m.floorY : "-"} roof ${isFinite(m.ceilY) ? m.ceilY : "-"}  route y ${Math.round(Math.min(...ps.map(s => s.y)))}-${Math.round(Math.max(...ps.map(s => s.y)))}`);
  }
}
