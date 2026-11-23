// Scene script for specs/51_adrift.json (GDLM 51 adrift), run by tools/make.js after the gameplay.
// The idea (TASTE.md round 1): a journey told by depth, not one set piece. The water's surface is on
// the screen at the start and rises out of view as we sink; the light fades section by section; things
// live and move all the time (jellyfish bob, kelp sways, fish swim past, bubbles rise) -- loops, where
// GDLM 50's motion was one-way. In the song's break, the dark sea floor, two pairs of eyes watch.
//   S0 bars 0-4   cube        sunlit shallows: surface band, light rays, kelp, a fish school, title
//   S1 bars 4-10  UFO         the drop: sinking, the surface rises away, jellyfish everywhere
//   S2 bars 10-16 cube        currents turn you over (gravity, blue/green orbs and pads): deep blue
//   S3 bars 16-20 robot       the break: near black, glowing plankton, eyes in the dark
//   S4 bars 20-23 mini ship   the last drop: rising, light and the surface come back, credits
"use strict";
const K = require("../scenekit.js");

module.exports = function ({ objects, header, beatX }) {
  const out = [];
  const barX = k => beatX(4 * k + 1);
  const S = [[0, barX(4)], [barX(4), barX(10)], [barX(10), barX(16)], [barX(16), barX(20)], [barX(20), barX(23) + 400]];
  const END = S[4][1], SPEED = 311.58, secs = x => x / SPEED, T0 = 3;

  // ---- colour channels ----
  const C = { glow: 1, rockFar: 2, rockNear: 3, kelp: 4, jelly: 5, tent: 6, fish: 7, bubble: 8, edge: 9, fill: 10, rays: 11,
    surface: 12, eyes: 13, coral: 14, plankton: 15 };
  const BLEND = new Set([C.glow, C.tent, C.bubble, C.edge, C.rays, C.surface, C.eyes, C.plankton]);
  const P = [
    { 1000: [26, 150, 186], 1001: [16, 96, 120], 1009: [22, 120, 146], 1002: [190, 255, 250], 1004: [240, 255, 252],
      [C.glow]: [90, 230, 220], [C.rockFar]: [30, 120, 150], [C.rockNear]: [18, 86, 112], [C.kelp]: [40, 150, 100], [C.jelly]: [255, 150, 220],
      [C.tent]: [255, 190, 235], [C.fish]: [255, 190, 80], [C.bubble]: [90, 175, 205], [C.edge]: [160, 255, 240], [C.fill]: [14, 72, 94],
      [C.rays]: [220, 255, 245], [C.surface]: [220, 255, 250], [C.eyes]: [255, 236, 120], [C.coral]: [255, 120, 110], [C.plankton]: [140, 255, 220] },
    { 1000: [16, 92, 150], 1001: [8, 54, 96], 1009: [12, 70, 118], 1002: [140, 220, 255], 1004: [235, 250, 255],
      [C.glow]: [60, 170, 255], [C.rockFar]: [18, 76, 126], [C.rockNear]: [10, 54, 96], [C.kelp]: [24, 100, 90], [C.jelly]: [255, 110, 230],
      [C.tent]: [255, 160, 240], [C.edge]: [120, 225, 255], [C.fill]: [8, 44, 80], [C.rays]: [170, 230, 255], [C.bubble]: [90, 170, 220] },
    { 1000: [10, 34, 96], 1001: [4, 16, 52], 1009: [8, 24, 70], 1002: [140, 170, 255], 1004: [230, 236, 255],
      [C.glow]: [90, 110, 255], [C.rockFar]: [12, 34, 86], [C.rockNear]: [6, 20, 60], [C.kelp]: [16, 60, 80], [C.jelly]: [190, 120, 255],
      [C.tent]: [210, 160, 255], [C.edge]: [140, 180, 255], [C.fill]: [6, 20, 62], [C.bubble]: [70, 110, 200], [C.coral]: [150, 70, 140] },
    { 1000: [2, 6, 16], 1001: [0, 2, 6], 1009: [2, 4, 10], 1002: [60, 255, 200], 1004: [220, 255, 240],
      [C.glow]: [20, 150, 120], [C.rockFar]: [4, 12, 22], [C.rockNear]: [2, 8, 16], [C.kelp]: [4, 20, 24], [C.edge]: [60, 255, 200],
      [C.fill]: [2, 10, 18], [C.bubble]: [60, 200, 170], [C.eyes]: [255, 236, 120], [C.plankton]: [70, 255, 200], [C.coral]: [20, 40, 50] },
    { 1000: [40, 160, 200], 1001: [18, 100, 126], 1009: [26, 126, 150], 1002: [255, 240, 190], 1004: [255, 255, 245],
      [C.glow]: [255, 230, 150], [C.rockFar]: [30, 120, 150], [C.rockNear]: [18, 86, 112], [C.kelp]: [40, 150, 100], [C.edge]: [255, 236, 170],
      [C.fill]: [14, 72, 94], [C.rays]: [255, 245, 210], [C.bubble]: [100, 190, 215], [C.surface]: [255, 250, 220], [C.eyes]: [255, 236, 120],
      [C.fish]: [255, 200, 90], [C.coral]: [255, 130, 110], [C.plankton]: [255, 240, 200] },
  ];
  const defs = {};
  for (const [ch, rgb] of Object.entries(P[0])) defs[ch] = { rgb, blend: BLEND.has(+ch) };
  header = K.channels(header, defs);
  header = K.art(header, { bg: 1, ground: 1, line: 1 });
  // sinking: each fade takes most of a section; the drop into S4 is quick (we burst up)
  const FADE = [0, 6, 4, 3, 2.5];
  for (let i = 1; i < 5; i++) out.push(...K.palette(S[i][0], P[i], FADE[i]));

  const G = { surface: 300, rays: 301, rays4: 302, rockFar: 303, rockNear: 304, kelpA: 305, kelpB: 306, jellyA: 307, jellyB: 308,
    fish0: 309, fish4: 310, eyes: 311, eyesB: 312, plankton: 313, bubbles: 320, title: 330, credits: 331, coral: 332, glow: 333 };

  // ---- the surface: on the screen at the start, rises away as the UFO sinks, comes back at the end ----
  out.push(...K.waterSurface(0, { ch: C.surface, group: G.surface, y: 214 }));
  out.push(K.lockX(T0, G.surface, secs(END) + 2, 1));
  out.push(K.move(S[1][0], G.surface, 0, 260, 4, 2), K.alpha(S[1][0], G.surface, 0, 4));
  out.push(K.move(S[4][0], G.surface, 0, -260, secs(S[4][1] - S[4][0] - 300), 3), K.alpha(S[4][0], G.surface, 1, 3));
  out.push(...K.bob(T0, END, G.surface, 4, 2 * (barX(1) - barX(0)) / 4, secs(2 * (barX(1) - barX(0)) / 4)));

  // ---- light rays from the surface (S0, S1 fading; S4 back), shimmering on half bars ----
  out.push(...K.lightRays(-200, S[1][1], { ch: C.rays, group: G.rays, z: "B1", every: 120, tilt: 14, y: 330 }));
  out.push(K.alpha(T0, G.rays, 0.45, 0), K.alpha(S[1][0], G.rays, 0.2, 4), K.alpha(S[1][0] + 0.6 * (S[1][1] - S[1][0]), G.rays, 0, 3));
  out.push(...K.lightRays(S[4][0], END + 400, { ch: C.rays, group: G.rays4, z: "B1", every: 110, tilt: 14, y: 330, seed: 14 }));
  out.push(K.alpha(T0, G.rays4, 0, 0), K.alpha(S[4][0], G.rays4, 0.5, 2.5));

  // ---- the floor: far and near rocks (parallax), kelp swaying, coral ----
  out.push(...K.rocks(-300, END * 0.35 + 900, { ch: C.rockFar, group: G.rockFar, z: "B4", every: 120, sMin: 3, sMax: 7, y: -40 }));
  out.push(...K.rocks(-300, END * 0.6 + 900, { ch: C.rockNear, group: G.rockNear, z: "B3", every: 160, sMin: 1.5, sMax: 3.5, y: -16, seed: 29 }));
  out.push(K.lockX(T0, G.rockFar, secs(END) + 2, 0.65), K.lockX(T0, G.rockNear, secs(END) + 2, 0.4));
  out.push(...K.kelp(-100, S[2][1], { ch: C.kelp, groups: [G.kelpA, G.kelpB], every: 140, hMin: 3, hMax: 7 }));
  out.push(...K.kelp(S[4][0], END + 400, { ch: C.kelp, groups: [G.kelpA, G.kelpB], every: 150, hMin: 3, hMax: 6, seed: 41 }));
  const half = (barX(1) - barX(0)) / 2;
  out.push(...K.sway(T0, END, G.kelpA, 10, half * 2, secs(half * 2)), ...K.sway(T0 + half, END, G.kelpB, 10, half * 2, secs(half * 2)));
  { const Rc = K.rng(51);
    for (let x = 60; x < END; x += 160 + Rc() * 200) {
      if (x > S[3][0] - 100 && x < S[3][1]) continue;
      for (let j = 0; j < 5; j++) out.push(K.obj(497, x + (Rc() - 0.5) * 36, 4 + Rc() * 14 + j * 3, { ch: C.coral, z: "B2", zo: 1, s: 0.18 + Rc() * 0.22, groups: [G.coral], hsv: Rc() < 0.5 ? "20a1a1a0a0" : null }));
    } }

  // ---- jellyfish: S1 and S2, behind the play, bobbing in two phases ----
  { const Rj = K.rng(61);
    for (let x = S[1][0] - 100; x < S[2][1]; x += 90 + Rj() * 110) {
      const y = 130 + Rj() * 150, g = Rj() < 0.5 ? G.jellyA : G.jellyB;
      out.push(...K.jellyfish(x, y, { ch: C.jelly, ch2: C.tent, s: 0.8 + Rj() * 1.1, z: Rj() < 0.3 ? "B4" : "B2", groups: [g] }));
    } }
  out.push(...K.bob(T0, END, G.jellyA, 16, 2 * half, secs(2 * half)), ...K.bob(T0 + half, END, G.jellyB, 16, 2 * half, secs(2 * half)));
  out.push(K.alpha(T0, G.jellyA, 0, 0), K.alpha(T0, G.jellyB, 0, 0));
  out.push(K.alpha(S[1][0] - 300, G.jellyA, 0.9, 2), K.alpha(S[1][0] - 150, G.jellyB, 0.9, 2));
  out.push(K.alpha(S[2][1] - 200, G.jellyA, 0, 2), K.alpha(S[2][1] - 200, G.jellyB, 0, 2));

  // ---- fish schools swimming past (against the level) in S0 and S4 ----
  out.push(...K.fishSchool(S[0][0] + 900, 150, { ch: C.fish, group: G.fish0, n: 9, spread: 160 }));
  out.push(K.move(S[0][0] + 200, G.fish0, -900, 20, 5, 0));
  out.push(...K.fishSchool(S[4][0] + 1000, 170, { ch: C.fish, group: G.fish4, n: 9, spread: 160, seed: 18 }));
  out.push(K.move(S[4][0] + 100, G.fish4, -1000, -30, 5, 0));

  // ---- bubbles rising everywhere (rings 236), faster on the drops ----
  const BUB = [[0, 2.5, 120], [1, 3, 260], [2, 2.5, 160], [3, 0, 0], [4, 4, 360]];
  for (const [i, dens, rise] of BUB) {
    if (!dens) continue;
    const [x0, x1] = S[i], g = G.bubbles + i;
    out.push(...K.motes(x0, x1 + 400, { ch: C.bubble, group: g, density: dens, ids: [236], z: "B2", seed: 70 + i, y0: -40, y1: 300, sMin: 0.1, sMax: 0.3 }));
    out.push(K.move(x0 - 200, g, 0, rise, secs(x1 - x0) + 2, 0));
  }

  // ---- S3, the break: glowing plankton, and eyes in the dark ----
  out.push(...K.motes(S[3][0] - 200, S[3][1] + 400, { ch: C.plankton, group: G.plankton, density: 4, z: "B2", seed: 81, y0: 0, y1: 300 }));
  out.push(K.alpha(T0, G.plankton, 0, 0), K.alpha(S[3][0] - 100, G.plankton, 1, 2), K.alpha(S[4][0] + 200, G.plankton, 0, 2));
  out.push(...K.bob(S[3][0] - 200, S[4][0] + 400, G.plankton, 10, 2 * half, secs(2 * half)));
  const eye = (x, y, s, g) => [K.obj(1764, x - 14 * s, y, { ch: C.eyes, z: "B4", zo: 5, s: 1.3 * s, groups: [G.eyes, g] }), K.obj(1764, x + 14 * s, y, { ch: C.eyes, z: "B4", zo: 5, s: 1.3 * s, groups: [G.eyes, g] })];
  out.push(...eye(S[3][0] + 420, 175, 2.2, G.eyes), ...eye(S[3][0] + 120, 200, 1.2, G.eyesB));
  out.push(K.lockX(S[3][0] - 2, G.eyes, secs(S[3][1] - S[3][0]) + 3, 0.9));
  out.push(K.alpha(T0, G.eyes, 0, 0), K.alpha(S[3][0] + 260, G.eyes, 1, 2), K.alpha(S[4][0], G.eyes, 0, 0.3));
  // they blink: a quick fade down and up every two bars, the small pair half a bar later
  for (let b = 66; b < 81; b += 8) out.push(K.alpha(beatX(b + 3), G.eyes, 0, 0.08), K.alpha(beatX(b + 3) + 25, G.eyes, 1, 0.12));

  // ---- the gameplay blocks: rock fills with lit edges ----
  S.forEach(([x0, x1], i) => out.push(...K.designBlocks(objects, x0, x1, { fill: C.fill, edge: C.edge, glow: C.glow, seed: 90 + i })));

  // ---- beats: edges on bars, bubbles on beats in the drops; flashes and zoom on the drops ----
  for (let b = 1; b < 4 * 23; b++) {
    const x = beatX(b), sec = S.findIndex(([a, c]) => x >= a && x < c), bar = (b - 1) % 4 === 0;
    if (sec < 0) continue;
    // calm: only on bars, soft swells of the deco's own colour, never the gameplay edges, never white (TASTE.md)
    if (sec === 1 && bar) out.push(K.pulse(x, C.jelly, [255, 170, 240], 0.1, 0.1, 0.8));
    if (sec === 3 && bar) out.push(K.pulse(x, C.plankton, [150, 255, 220], 0.15, 0.1, 0.9));
  }
  out.push(K.pulse(S[4][0], 1000, [90, 190, 220], 0.1, 0.1, 1));   // one soft flash, on the last drop
  out.push(K.zoom(S[1][0], 0.88, 1.5), K.zoom(S[2][0] - 60, 1, 1), K.zoom(S[4][0], 0.9, 1), K.zoom(S[4][1] - 700, 1, 1.5));

  // ---- title and credits ----
  out.push(K.text(615, 170, "ADRIFT", 1.8, { z: "B1", groups: [G.title] }), K.text(615, 135, "GDLM 51", 0.6, { z: "B1", groups: [G.title] }));
  out.push(K.alpha(900, G.title, 0, 1));
  const cx = barX(23) + 150;
  out.push(K.text(cx, 175, "song: balderdact - Adrift", 0.5, { z: "B1", groups: [G.credits] }));
  out.push(K.alpha(T0, G.credits, 0, 0), K.alpha(barX(21), G.credits, 1, 1.5));
  out.push(K.obj(1764, END, 300, { ch: C.bubble, z: "B5" }));   // the end marker: the level ends after the credits
  return { objects: out, header };
};
