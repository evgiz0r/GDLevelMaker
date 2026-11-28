// tools/scenes/cinema.js -- the cinema lab's scene (spec specs/lab_cinema.json, made by tools/cinemalab.js): three story
// tricks from Evgeni's ideas (2026-11-28, after playing a story level), built from GD's camera and player triggers:
//   A  the level moves onto a table seen from above at an angle: the camera zooms out and turns (2015), the table and the
//      things on it are drawn around the play lane, so the cube runs diagonally across the table top; then back in.
//   B  a fake death: the cube bonks into a wall, a death burst (shards + a ring in the player's colour 1005), shake, a zoom
//      punch, the player hidden (1612) ... and a second later it is there again (1613) with a ghost trail. The wall is deco.
//   C  ship gameplay with the view spinning around the middle: camera rotate BY 360 (key 70), re-fired every 4 s.
// spec.cinema = {table: [t0, t1], wall: t, spin: [t0, t1]} in level seconds. Camera triggers show only in GD (EFFECTS.md).
"use strict";
const FX = require("../effects.js"), K = require("../scenekit.js");
const T = FX.T, E = FX.E, D = (id, x, y, o) => K.obj(id, x, y, o);
module.exports = function ({ spec, xOfT, header }) {
  const C = spec.cinema, TPS = 240, path = [];
  for (let i = 0; i <= 40 * TPS; i++) path.push({ x: xOfT(i / TPS), y: 15 });
  const ctx = FX.context({ path, group0: 3701, ch0: 820 }), out = [], add = a => { for (const o of a) out.push(o); };

  // ---- A: the table
  {
    const [t0, t1] = C.table, xa = xOfT(t0 - 0.6), xb = xOfT(t1 + 0.6), len = xb - xa, cx = (xa + xb) / 2;
    const wood = ctx.channel([168, 112, 64]), grain = ctx.channel([138, 88, 48]), edge = ctx.channel([210, 160, 104]);
    const room = [34, 28, 40], cer = ctx.channel([226, 232, 240]), cerD = ctx.channel([170, 180, 196]), coffee = ctx.channel([70, 40, 24]);
    const yel = ctx.channel([250, 196, 40]), pink = ctx.channel([236, 120, 140]), lead = ctx.channel([60, 56, 60]), paper = ctx.channel([238, 234, 220]), ink = ctx.channel([90, 110, 170]);
    const g = ctx.hideAtStart(ctx.group());
    // the table top: one big plank behind the lane (B4) with grain lines and a lit far edge; the front edge is GD's ground
    add([D(211, cx, 210, { ch: wood, z: "B4", zo: -50, sx: len / 30, sy: 14, groups: [g] })]);
    for (let y = 30, k = 0; y < 420; y += 38, k++) add([D(211, cx + (k % 3) * 40, y, { ch: grain, z: "B4", zo: -49, sx: len / 30 * 0.97, sy: 0.07, groups: [g] })]);
    add([D(211, cx, 422, { ch: edge, z: "B4", zo: -48, sx: len / 30, sy: 0.35, groups: [g] })]);
    // a sheet of paper under the lane (turned a little), with written lines
    const px = xOfT(t0 + 1.6);
    add([D(211, px, 110, { ch: paper, z: "B3", zo: -30, sx: 9, sy: 6.5, rot: -6, groups: [g] })]);
    for (let i = 0; i < 6; i++) add([D(211, px - 20 + i * 2, 170 - i * 22, { ch: ink, z: "B3", zo: -29, sx: 6.5 - (i % 2), sy: 0.08, rot: -6, groups: [g] })]);
    // a mug far back: body, rim, coffee, handle (a disk with the wood showing through)
    const mx = xOfT(t0 + 3.4);
    add([D(211, mx, 300, { ch: cer, z: "B3", zo: -20, sx: 4, sy: 5, groups: [g] }), D(497, mx, 375, { ch: cerD, z: "B3", zo: -19, sx: 2.4, sy: 0.7, groups: [g] }),
      D(497, mx, 375, { ch: coffee, z: "B3", zo: -18, sx: 2.1, sy: 0.55, groups: [g] }), D(497, mx, 225, { ch: cer, z: "B3", zo: -21, sx: 2.4, sy: 0.7, groups: [g] }),
      D(497, mx + 70, 300, { ch: cer, z: "B3", zo: -22, s: 1.3, groups: [g] }), D(497, mx + 70, 300, { ch: wood, z: "B3", zo: -21, s: 0.8, groups: [g] })]);
    // a pencil lying across the back of the table: yellow body, wood cone, lead tip, pink eraser
    const qx = xOfT(t0 + 5.0), ang = 14, ca = Math.cos(ang * Math.PI / 180), sa = Math.sin(ang * Math.PI / 180), P = (u, v) => [qx + u * ca - v * sa, 330 + u * sa + v * ca];
    const [bx, by] = P(0, 0), [ex, ey] = P(-160, 0), [tx, ty] = P(150, 0);
    add([D(211, bx, by, { ch: yel, z: "B3", zo: -10, sx: 9.4, sy: 0.9, rot: -ang, groups: [g] }), D(211, ex, ey, { ch: pink, z: "B3", zo: -9, sx: 1.4, sy: 0.9, rot: -ang, groups: [g] }),
      D(693, tx, ty + 6, { ch: grain, z: "B3", zo: -9, sx: 0.7, sy: 0.45, rot: -ang, groups: [g] }), D(693, tx, ty - 6, { ch: grain, z: "B3", zo: -9, sx: 0.7, sy: 0.45, rot: -ang, flipY: true, groups: [g] })]);
    add([T.alpha(xOfT(t0 - 0.6), g, 1, 0.8), T.alpha(xOfT(t1 + 0.4), g, 0, 0.6)]);
    // the camera: pull back and turn to the table's angle, the room and the table's front edge in their colours; then back
    const x0 = xOfT(t0), x1 = xOfT(t1);
    add([T.zoomE(x0, 0.55, 1.6, 13), T.camRotate(x0, -18, 1.6, { ease: 13 }), T.camOffset(x0, 60, 40, 1.6, 13)]);
    add([K.colour(x0, 1000, room, 1.2), K.colour(x0, 1001, [120, 76, 40], 1.2), K.colour(x0, 1009, [100, 62, 32], 1.2)]);
    add([T.zoomE(x1, 1, 1.1, 13), T.camRotate(x1, 0, 1.1, { ease: 13 }), T.camOffset(x1, 0, 0, 1.1, 13)]);
    add([K.colour(x1, 1000, spec.colours.bg, 1.0), K.colour(x1, 1001, spec.colours.ground, 1.0), K.colour(x1, 1009, spec.colours.ground, 1.0)]);
  }

  // ---- B: the fake death at a wall
  {
    const xw = xOfT(C.wall), xh = xw - 30, ht = C.wall - 30 / 311.58;   // the player's right edge reaches the wall
    const brick = ctx.channel([120, 54, 44]), mortar = ctx.channel([60, 30, 28]), gW = ctx.group();
    for (let r = 0; r < 12; r++) for (let c = 0; c < 2; c++) add([D(211, xw + 15 + c * 30 + (r % 2 ? 15 : 0), 12 + r * 24, { ch: brick, z: "B1", zo: 10, sx: 0.93, sy: 0.75, groups: [gW] })]);
    add([D(211, xw + 45, 150, { ch: mortar, z: "B1", zo: 9, sx: 2.6, sy: 10.2, groups: [gW] })]);
    // the burst where the cube was: 12 shards and a ring in the player's colour (channel 1005)
    const gB = ctx.hideAtStart(ctx.group()), gRing = ctx.hideAtStart(ctx.group());
    const sh = [];
    for (let i = 0; i < 12; i++) { const gi = ctx.group(); sh.push(gi); add([D(211, xh, 15, { ch: 1005, z: "T1", zo: 20, s: 0.22 + (i % 3) * 0.08, rot: i * 30, groups: [gB, gi] })]); }
    add([D(497, xh, 15, { ch: 1005, z: "T1", zo: 19, s: 0.4, groups: [gRing] })]);
    add([T.hidePlayer(xh), T.shake(xh, 3, 0.35), T.zoomE(xh, 1.25, 0.06, 0), T.zoomE(xh + 25, 1, 0.7, 13), T.camRotate(xh, 4, 0.05), T.camRotate(xh + 25, 0, 0.5, { ease: 13 })]);
    add([T.alpha(xh, gB, 1, 0), T.alpha(xh, gRing, 0.9, 0), T.scale(xh, gRing, 5, 5, 0.4, { ease: E.hit }), T.alpha(xh + 6, gRing, 0, 0.4), T.alpha(xOfT(ht + 0.25), gB, 0, 0.5)]);
    sh.forEach((gi, i) => { const a = i * Math.PI * 2 / 12 + 0.2; add([T.move(xh, gi, Math.cos(a) * 95, Math.max(-10, Math.sin(a) * 95), 0.6, E.hit), T.rotate(xh, gi, 200 + i * 15, 0.6)]); });
    add([T.move(xh, gW, 8, 0, 0.05), T.move(xh + 18, gW, -8, 0, 0.3, E.settle)]);   // the wall takes the hit
    // ... and the cube is back a second later, with a ghost trail and a small pop
    const xs = xOfT(ht + 1.0), gPop = ctx.hideAtStart(ctx.group());
    add([D(497, xs, 15, { ch: 1005, z: "T1", zo: 19, s: 0.3, groups: [gPop] })]);
    add([T.showPlayer(xs), T.trailOn(xs), T.alpha(xs, gPop, 0.8, 0), T.scale(xs, gPop, 3, 3, 0.3, { ease: E.hit }), T.alpha(xs + 4, gPop, 0, 0.3), T.trailOff(xOfT(ht + 2.4))]);
  }

  // ---- C: the spin
  {
    const [t0, t1] = C.spin, n = Math.max(1, Math.round((t1 - t0) / 4)), per = (t1 - t0) / n;
    for (let k = 0; k < n; k++) add([T.camRotate(xOfT(t0 + k * per), 360, per, { add: true, ease: k === 0 ? 14 : k === n - 1 ? 15 : 0 })]);
  }
  add(ctx.prelude());
  console.log(`   cinema: table ${C.table.join("-")} s, wall ${C.wall} s, spin ${C.spin.join("-")} s; ${out.length} objects`);
  return { objects: out, header: ctx.header(header) };
};
