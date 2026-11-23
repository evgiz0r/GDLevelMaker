// Scene script for specs/44_hellgate.json (GDLM 44 hellgate), run by tools/make.js after the gameplay
// (spec "scene"; rebuild a look-only change with `node tools/make.js specs/44_hellgate.json --look`).
// Owner: the polish session (POLISH.md "Hellgate rounds"); the gameplay spec is gd-style's.
// The idea: a descent into a burning underworld, one scene per mode, each mode change a flash.
//   S0 cube  climb        ember dusk: far rock spires, lava glow on the horizon, fires at the foot of the rocks
//   S1 ship  tunnel       crimson cavern: hanging spires from the top, embers streaming past
//   S2 cube  orbs         molten: brighter lava, chains hanging, skulls on the far rocks
//   S3 wave  zigzag       black and orange: everything dark but the lit edges, sparks fly fast
//   S4 cube  run + drop   the drop (red pad, beat 21): white-hot flash, every beat pulses
//   S5 cube  gate / end   cooling ash: the palette fades out to the signature
// Every object here is decoration or a trigger (no collision): the gameplay is untouched.
"use strict";
const K = require("../scenekit.js");

module.exports = function ({ objects, header, beatX }) {
  const out = [], SPEED = 311.58, secs = x => x / SPEED;
  // ---- sections: cut at the mode portals, the drop at beat 21, the gate at beat 25 ----
  const portals = objects.filter(o => [12, 13, 660, 47, 111].includes(o.id)).map(o => o.x).sort((a, b) => a - b);
  // the signature (make.js, tools/signature.js) goes 4 blocks after the last gameplay object; the scene runs
  // a screen past it so it stands in the lava light (left to make.js it went after the far scenery: 25 blocks late)
  const SIG = Math.ceil(Math.max(...objects.map(o => o.x)) / 30) + 4;
  const END = SIG * 30 + 600;
  const cuts = [-300, ...portals.slice(0, 4), beatX(21), beatX(25), END];
  const S = cuts.slice(0, -1).map((x, i) => [x, cuts[i + 1]]);   // 7 spans: S0..S6 (S4 = run to the drop, S5 drop, S6 end)
  const T0 = 3;

  // ---- colour channels (own, 30+) ----
  const C = { lava: 30, horizon: 31, far: 32, near: 33, fill: 34, edge: 35, ember: 36, fire: 37, frame: 38, chain: 39, skull: 40, top: 41 };
  const BLEND = new Set([C.lava, C.horizon, C.edge, C.ember, C.fire]);
  // palettes per span (+ 1013/1014 middleground: the hills were icy blue in v12)
  const P = [
    { [C.lava]: [255, 90, 10], [C.horizon]: [200, 50, 0], [C.far]: [60, 8, 6], [C.near]: [34, 4, 4], [C.fill]: [22, 3, 3], [C.edge]: [255, 110, 20],
      [C.ember]: [255, 150, 40], [C.fire]: [255, 120, 20], [C.frame]: [8, 0, 0], [C.chain]: [70, 20, 14], [C.skull]: [120, 50, 30], [C.top]: [40, 4, 4],
      1013: [70, 10, 6], 1014: [110, 22, 8] },
    { [C.lava]: [220, 30, 10], [C.horizon]: [150, 10, 20], [C.far]: [50, 4, 10], [C.near]: [30, 2, 8], [C.fill]: [24, 2, 6], [C.edge]: [255, 60, 40],
      [C.ember]: [255, 90, 60], [C.top]: [50, 4, 10], 1013: [60, 6, 12], 1014: [90, 12, 16] },
    { [C.lava]: [255, 140, 20], [C.horizon]: [230, 90, 0], [C.far]: [70, 14, 4], [C.near]: [40, 8, 2], [C.fill]: [26, 6, 2], [C.edge]: [255, 170, 40],
      [C.ember]: [255, 200, 80], [C.fire]: [255, 170, 40], [C.top]: [50, 10, 2], 1013: [80, 18, 4], 1014: [130, 40, 6] },
    { [C.lava]: [255, 70, 0], [C.horizon]: [90, 20, 0], [C.far]: [14, 2, 2], [C.near]: [8, 0, 0], [C.fill]: [10, 0, 0], [C.edge]: [255, 120, 0],
      [C.ember]: [255, 160, 30], [C.top]: [6, 0, 0], 1013: [20, 2, 2], 1014: [30, 4, 2] },
    { [C.lava]: [255, 100, 10], [C.horizon]: [210, 60, 0], [C.far]: [64, 10, 4], [C.near]: [36, 6, 2], [C.fill]: [24, 4, 2], [C.edge]: [255, 130, 30],
      [C.ember]: [255, 170, 60], [C.top]: [40, 6, 2], 1013: [70, 12, 4], 1014: [110, 26, 6] },
    { [C.lava]: [255, 150, 40], [C.horizon]: [140, 30, 0], [C.far]: [90, 18, 4], [C.near]: [50, 8, 2], [C.fill]: [36, 6, 0], [C.edge]: [255, 210, 110],
      [C.ember]: [255, 240, 160], [C.fire]: [255, 220, 100], [C.top]: [70, 10, 0], 1013: [120, 30, 4], 1014: [170, 60, 10] },
    { [C.lava]: [120, 30, 10], [C.horizon]: [70, 14, 6], [C.far]: [26, 6, 6], [C.near]: [16, 4, 4], [C.fill]: [12, 2, 2], [C.edge]: [170, 70, 40],
      [C.ember]: [160, 90, 70], [C.fire]: [160, 60, 20], [C.top]: [8, 0, 0], 1013: [30, 6, 6], 1014: [44, 10, 8] },
  ];
  const defs = {};
  for (const [ch, rgb] of Object.entries(P[0])) defs[ch] = { rgb, blend: BLEND.has(+ch) };
  header = K.channels(header, defs);
  const FADE = [0, 0, 0.4, 0, 0.6, 0, 2.5];          // mode changes switch at once (the flash), the end cools slowly
  for (let i = 1; i < S.length; i++) out.push(...K.palette(S[i][0], P[i], FADE[i]));

  // ---- groups ----
  const G = { far: 300, near: 301, top: 302, frame: 303, hang: 304, chains: 305, embers: 310, fires: 320, glow: 330 };
  const LEN = END + 300;

  // ---- lava glow along the whole level (blending gradients rising off the ground), pulsed on bars ----
  out.push(...K.horizonGlow(-300, END, { ch: C.horizon, y: 0, h: 6, z: "B5", group: G.glow }));
  out.push(...K.horizonGlow(-300, END, { ch: C.lava, y: 0, h: 1.6, z: "B2", step: 90 }));

  // ---- rock spires: thorn sprites (461-466) scaled up into jagged rocks, two parallax layers ----
  const spires = (x0, x1, o) => {
    const R = K.rng(o.seed), res = [];
    for (let x = x0; x < x1; x += o.step * (0.6 + R() * 0.8)) {
      const id = [466, 461, 463, 466, 462][Math.floor(R() * 5)], s = o.sMin + R() * (o.sMax - o.sMin);
      const h = (id === 466 ? 1.55 : 1.0) * 30 * s;
      res.push(K.obj(id, x, o.top ? o.y - h / 2 : o.y + h / 2, { ch: o.ch, z: o.z, zo: o.zo || 0, s, flipX: R() < 0.5, flipY: !!o.top, groups: [o.group], hsv: R() < 0.4 ? "0a1a0.8a0a0" : null }));
    }
    return res;
  };
  // the far layer keeps 0.85 of the player's motion: it only needs to cover 15% of the level + a screen
  out.push(...spires(-300, LEN * 0.15 + 1200, { ch: C.far, z: "B4", group: G.far, step: 150, sMin: 3.5, sMax: 6, y: -10, seed: 3 }));
  out.push(...spires(-300, LEN * 0.4 + 1200, { ch: C.near, z: "B3", group: G.near, step: 260, sMin: 2.2, sMax: 3.4, y: -10, seed: 4 }));
  out.push(K.lockX(T0, G.far, secs(LEN) + 2, 0.85), K.lockX(T0, G.near, secs(LEN) + 2, 0.6));
  // stalactites from the top: on in the ship and the wave (cavern), up out of view elsewhere
  out.push(...spires(-300, LEN * 0.3 + 1200, { ch: C.top, z: "B3", group: G.hang, step: 150, sMin: 2, sMax: 3.2, y: 420, top: true, seed: 5 }));
  out.push(K.lockX(T0, G.hang, secs(LEN) + 2, 0.7), K.move(T0, G.hang, 0, 160, 0));
  for (const i of [1, 3]) out.push(K.move(S[i][0], G.hang, 0, -160, 0.6, 3), K.move(S[i][1], G.hang, 0, 160, 0.6, 2));

  // ---- fires: at the foot of the rocks, behind the play, never near a hazard, orb, pad or portal ----
  const busy = objects.filter(o => o.props && o.props[57] !== "990" && [8, 39, 103, 36, 84, 141, 1022, 35, 67, 140, 1332, 12, 13, 660, 47, 111].includes(o.id));
  const free = (x, y, r) => !busy.some(o => Math.abs(o.x - x) < r && Math.abs(o.y - y) < r + 30);
  const surf = new Map();  // column -> top of the highest block standing on the ground (for fires on blocks)
  for (const o of objects) if (o.id >= 1 && o.id <= 7) { const c = Math.floor(o.x / 30); surf.set(c, Math.max(surf.get(c) || 0, o.y + 15)); }
  {
    const R = K.rng(8);
    for (let x = 120; x < END - 300; x += 150 + R() * 120) {
      if (!free(x, 30, 75)) continue;
      const y0 = surf.get(Math.floor(x / 30)) || 0;
      if (y0 > 60) continue;                      // only on the ground or a low block: tall ones are tunnel walls
      out.push(K.obj([923, 924, 920][Math.floor(R() * 3)], x, y0 + 14, { ch: C.fire, z: "B4", zo: 3, s: 0.8 + R() * 0.4, groups: [G.fires], hsv: "0a1a0.6a0a0" }));
    }
  }

  // ---- chains hanging in the molten span (S2) and the end (S6), behind ----
  for (const i of [2, 6]) {
    const R = K.rng(20 + i);
    for (let x = S[i][0] + 60; x < S[i][1] - 60; x += 90 + R() * 90) {
      if (!free(x, 200, 45)) continue;
      const n = 2 + Math.floor(R() * 3);
      for (let k = 0; k < n; k++) out.push(K.obj(106, x, 330 - k * 62, { ch: C.chain, z: "B2", zo: 0, s: 1, groups: [G.chains] }));
    }
  }
  // ---- skulls on the near rocks (S2, S6), small, far back ----
  for (const i of [2, 6]) {
    const R = K.rng(40 + i);
    for (let x = S[i][0] + 80; x < S[i][1]; x += 160 + R() * 120) out.push(K.obj(1596 + Math.floor(R() * 2), x, 12 + R() * 20, { ch: C.skull, z: "B3", zo: 2, s: 1.3, flipX: R() < 0.5 }));
  }

  // ---- embers: small dots drifting up, in front; faster in the ship and the wave ----
  const RISE = [110, 260, 140, 320, 160, 220, 60];
  S.forEach(([x0, x1], i) => {
    const g = G.embers + i;
    out.push(...K.motes(x0, x1 + 400, { ch: C.ember, group: g, density: i === 5 ? 5 : 3, z: i % 2 ? "T2" : "B1", seed: 60 + i, y0: -40, y1: 300 }));
    out.push(K.move(x0 - 200, g, i === 1 || i === 3 ? -120 : -20, RISE[i], secs(x1 - x0) + 2, 0));
  });

  // ---- the gameplay blocks: obsidian with lava edges (dark fill over the skins, lit open sides) ----
  out.push(...K.designBlocks(objects, -300, END, { fill: C.fill, edge: C.edge, glow: C.lava, seed: 70 }));
  for (const o of objects) if (o.id === 1338) { o.props = o.props || {}; o.props[21] = String(C.edge); }

  // ---- beat pulses: lava + edges on every bar; every beat in the drop; flashes at each mode change ----
  for (let b = 1; b < 40; b++) {
    const x = beatX(b), sec = S.findIndex(([a, c]) => x >= a && x < c);
    if (sec < 0 || x > END - 300) continue;
    const bar = (b - 1) % 4 === 0;
    if (sec === 5) {
      out.push(K.pulse(x, C.edge, [255, 255, 220], 0, 0.05, 0.3), K.pulse(x, C.lava, [255, 190, 90], 0, 0.05, 0.35));
      if (bar) out.push(K.pulse(x, C.horizon, [255, 140, 40], 0, 0.08, 0.6));
    } else if (bar) out.push(K.pulse(x, C.edge, [255, 230, 160], 0, 0.05, 0.45), K.pulse(x, C.lava, [255, 210, 120], 0, 0.05, 0.5));
    else if (sec !== 6) out.push(K.pulse(x, C.ember, [255, 255, 200], 0, 0.03, 0.25));
  }
  // mode changes: a flash of the lava light and a short shake of the fires' brightness
  for (let i = 1; i < S.length - 1; i++) out.push(K.pulse(S[i][0], C.horizon, [255, 200, 120], 0, 0.06, 0.7), K.pulse(S[i][0], C.fire, [255, 255, 200], 0, 0.05, 0.5));
  // the drop: the lava flares (the spec flashes the sky itself: a second sky flash washed it out to beige,
  // with the white spikes unreadable on it), the camera pulls back a little, then returns at the gate
  out.push(K.pulse(S[5][0], C.lava, [255, 200, 90], 0, 0.1, 0.8), K.zoom(S[5][0], 0.9, 0.4), K.zoom(S[6][0], 1, 1));

  // ---- portal glows: a soft lit disc behind each mode portal (the entry reads from far) ----
  for (const o of objects) if ([12, 13, 660].includes(o.id))
    out.push(K.obj(236, o.x, o.y, { ch: C.near, z: "B1", zo: -2, s: 1.6 }));

  // ---- a dark frame along the top of the screen (cube spans), the ceiling of hell ----
  out.push(...K.topFrame(0, { ch: C.frame, group: G.frame, y: 250, h: 3.5 }), K.lockX(T0, G.frame, secs(LEN) + 2, 1));
  out.push(K.alpha(T0, G.frame, 0.8, 0));
  for (const i of [1, 3]) out.push(K.alpha(S[i][0], G.frame, 0, 0.5), K.alpha(S[i][1], G.frame, 0.8, 0.8));

  return { objects: out, header, signature: { col: SIG, shirt: [255, 110, 20] } };
};
