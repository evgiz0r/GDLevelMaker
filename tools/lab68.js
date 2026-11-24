// node tools/lab68.js [--check]  -- writes specs/68_camera_lab.json: GDLM 68, the camera lab. The user (2026-11-24): "the
//   videos are also good to see how the screen moves upon some objects. make some ship, ufo, swing, wave portals not on
//   the bottom, I'll fly up and down." Mostly free flight: flying portals low, in the middle and high, entered walking,
//   rising and falling; open sky next to corridors; a cube stretch with big height changes. A recording of it shows when
//   GD's camera locks to a mode's band and when it follows (gd-visuals fits the camera, VISUALS.md). Then:
//   node tools/make.js specs/68_camera_lab.json.  --check prints the sim's band (floor / roof) and heights per station.
// Sim's band rule (lib/physics.js enterMode): a flying portal at height y sets floor = max(0, floor((y - 150) / 30) * 30),
// roof = floor + 300 (ball 240, spider 270); the viewer centres the camera on it. What GD does is the question.
// Rulers: deco 211 squares on every other row, colour channel 1014 (defined: never white; tools/channels.js).
const fs = require("fs"), path = require("path");
const b64 = s => Buffer.from(s).toString("base64");
const objs = [], lab = [];
let col = 22;   // past GD's "Attempt N" text
const label = (c, text, row = 6.5) => objs.push([914, c, row, { props: { "31": b64(text), "32": "0.5" } }]);
const ruler = (c, from = 0, to = 14) => { for (let r = from; r <= to; r += 2) objs.push([211, c, r, { props: { "21": "1014" } }]); };
const station = (name, width, note, build) => { const n = lab.length + 1, from = col; build(col, n); lab.push({ n, name, from, to: from + width, metrics: [{ m: "alive" }], note }); col += width; };
const CUBE = 12, SHIP = 13, UFO = 111, WAVE = 660, SWING = 1933;
const portal = (id, c, row) => objs.push([id, c, row]);
// a flying stretch's exit: cube portals stacked over every height a band can reach (rows 1-13: y 0-420), so nothing
// flies past it (GDLM 67 v2's swing flew over a 3-block exit)
const exitPortal = (c) => { for (const r of [1, 4, 7, 10, 13]) objs.push([CUBE, c, r]); };
// stairs: k steps of 3 columns, each one block higher, then a platform `flat` columns long at height h (top y 30h)
const stairs = (c, h, flat) => { for (let k = 0; k < h; k++) for (let x = c + 3 * k; x < c + 3 * k + 3; x++) for (let r = 0; r <= k; r++) objs.push(["block", x, r]);
  for (let x = c + 3 * h; x < c + 3 * h + flat; x++) for (let r = 0; r < h; r++) objs.push(["block", x, r]); return c + 3 * h + flat; };
const band = y => { const f = Math.max(0, Math.floor((y - 150) / 30) * 30); return `band ${f}-${f + 300}`; };
const rowY = r => r * 30 + 15;

// 1 cube: stairs up 6, a drop, a yellow pad into the air (cube camera follow)
station("cube: stairs, drop, pad", 48, "cube camera: climb 6 blocks (jump each step), walk off the top (a 6-block drop), then a yellow pad throws you up ~4 blocks. GD's cube camera follows the player up and down; the viewer's own camera is the thing being fitted", c => {
  label(c, "1 cube: climb the stairs, drop, ride the pad");
  const e = stairs(c + 4, 6, 6); ruler(e + 1, 0, 10);
  objs.push([35, e + 10, 0]); ruler(e + 16, 0, 10);
});
// 2 ship low, open sky
station("ship LOW, open sky", 46, `ship portal on the floor (row 1, y 45): sim ${band(45)}. Fly to the top and the bottom, slowly and fast: no blocks, so only the band and the camera bound you`, c => {
  label(c, "2 ship LOW: fly up and down, open sky");
  portal(SHIP, c + 3, 1); ruler(c + 14, 0, 14); ruler(c + 30, 0, 14); exitPortal(c + 44);
});
// 3 ship high, from a platform
station("ship HIGH, open sky", 64, `ship portal high on a 6-block tower (row 8, y ${rowY(8)}): sim ${band(rowY(8))}: the band starts 3 blocks up, so the floor of the band is in the air. Fly up and down to its edges`, c => {
  label(c, "3 ship HIGH: climb, take it high, fly to the edges");
  const e = stairs(c + 2, 6, 4); portal(SHIP, e - 2, 8); ruler(e + 10, 0, 14); ruler(e + 26, 0, 14); exitPortal(e + 42);
});
// 4 ship entered rising from a pad, then a corridor
station("ship from a pad (rising), corridor", 44, `a yellow pad throws you up through a ship portal in the air (row 3, y ${rowY(3)}: rising entry; sim ${band(rowY(3))}), then a corridor (floor row 2, roof row 8) for 16 blocks: does the camera stop following inside it?`, c => {
  label(c, "4 pad up into the ship, then the corridor");
  objs.push([35, c + 4, 0]); portal(SHIP, c + 7, 3);
  for (let x = c + 20; x < c + 36; x++) objs.push(["block", x, 2], ["block", x, 8]);
  ruler(c + 16, 0, 14); ruler(c + 28, 0, 14); exitPortal(c + 41);
});
// 5 UFO entered falling
station("UFO from a pad (falling)", 42, `a yellow pad's arc comes DOWN through a UFO portal (row 2, y ${rowY(2)}: falling entry; sim ${band(rowY(2))}). Then tap to fly up and down`, c => {
  label(c, "5 pad, fall into the UFO, then fly");
  objs.push([35, c + 3, 0]); portal(UFO, c + 10, 2); ruler(c + 18, 0, 14); ruler(c + 30, 0, 14); exitPortal(c + 40);
});
// 6 UFO high
station("UFO HIGH", 62, `UFO portal high (row 9, y ${rowY(9)}, on a 6-block tower): sim ${band(rowY(9))}. Flap up to the top, let it fall to the bottom`, c => {
  label(c, "6 UFO HIGH: climb, flap up, let it fall");
  const e = stairs(c + 2, 6, 4); portal(UFO, e - 2, 9); ruler(e + 10, 0, 14); ruler(e + 26, 0, 14); exitPortal(e + 40);
});
// 7 swing low, then a corridor
station("swing LOW, corridor", 48, `swing on the floor (row 1: sim ${band(45)}): open for 14 blocks, then a corridor (floor row 2, roof row 7) for 16`, c => {
  label(c, "7 swing LOW: up and down, then the corridor");
  portal(SWING, c + 3, 1); ruler(c + 12, 0, 14);
  for (let x = c + 22; x < c + 38; x++) objs.push(["block", x, 2], ["block", x, 7]);
  ruler(c + 30, 0, 14); exitPortal(c + 45);
});
// 8 swing high
station("swing HIGH", 60, `swing portal high (row 8, y ${rowY(8)}, on a tower): sim ${band(rowY(8))}`, c => {
  label(c, "8 swing HIGH: climb, flip up and down");
  const e = stairs(c + 2, 6, 4); portal(SWING, e - 2, 8); ruler(e + 10, 0, 14); ruler(e + 24, 0, 14); exitPortal(e + 38);
});
// 9 wave mid, open; 10 wave in a corridor
station("wave MID (rising), open", 42, `a pad throws you up into a wave portal (row 3, rising: sim ${band(rowY(3))}); hold and let go to zigzag the full height, open sky`, c => {
  label(c, "9 pad up into the wave: zigzag the full height");
  objs.push([35, c + 4, 0]); portal(WAVE, c + 7, 3); ruler(c + 16, 0, 14); ruler(c + 30, 0, 14); exitPortal(c + 40);
});
station("wave corridor", 40, `wave in a corridor (floor row 3, roof row 7; entered on the floor: sim ${band(45)}): small zigzags inside it`, c => {
  label(c, "10 wave: small zigzags in the corridor");
  portal(WAVE, c + 3, 1);
  for (let x = c + 10; x < c + 32; x++) objs.push(["block", x, 3], ["block", x, 7]);
  ruler(c + 20, 0, 14); exitPortal(c + 37);
});
// 11 ship very high: the band starts 6 blocks up (the camera must leave the ground behind)
station("ship VERY HIGH, open sky", 76, `ship portal very high (row 11, y ${rowY(11)}, on a 9-block tower): sim ${band(rowY(11))}: the whole band is above the ground's top. Fly to both edges`, c => {
  label(c, "11 ship VERY HIGH: climb, fly to both edges");
  const e = stairs(c + 2, 9, 4); portal(SHIP, e - 2, 11); ruler(e + 10, 0, 16); ruler(e + 26, 0, 16); exitPortal(e + 40);
  for (const r of [16]) objs.push([CUBE, e + 40, r]);
});
objs.push(["block", col + 2, 0]);

const spec = { name: "GDLM 68 camera lab", desc: "Fly up and down! Flying portals low, middle and high, open sky and corridors: how GD's camera moves. Record it.", lab, objects: objs };
const out = path.join(__dirname, "..", "specs", "68_camera_lab.json");
if (!process.argv.includes("--check")) {
  fs.writeFileSync(out, JSON.stringify(spec, null, 0).replace(/\],\[/g, "],\n["));
  console.log("wrote", out, objs.length, "objects,", lab.length, "stations,", col + 3, "columns");
} else {
  // the sim on the built level's solved route: per station, the mode, band (floor / roof) and the route's y range
  const { GD, readGdlvl } = require("./io.js"), sols = require("./solutions.js");
  const lv = readGdlvl(path.join(__dirname, "..", "levels", "gdlm_68_camera_lab.gdlvl")), sol = sols.get(lv.levelStr, true);
  if (!sol) { console.log("no saved route: build it first"); process.exit(1); }
  const w = GD.makeWorld(lv.level.objects, lv.level.header), p = GD.run(w, sol.events).path;
  for (const L of lab) {
    const ps = p.filter(s => s.x >= L.from * 30 && s.x < L.to * 30); if (!ps.length) { console.log(L.n, "not reached"); continue; }
    const fl = ps.filter(s => s.mode !== "cube"), m = fl[0] || ps[0];
    console.log(`${String(L.n).padStart(2)} ${L.name.padEnd(36)} ${m.mode.padEnd(5)} floor ${isFinite(m.floorY) ? m.floorY : "-"} roof ${isFinite(m.ceilY) ? m.ceilY : "-"}  route y ${Math.round(Math.min(...ps.map(s => s.y)))}-${Math.round(Math.max(...ps.map(s => s.y)))}`);
  }
}
