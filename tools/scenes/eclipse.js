// Scene script for specs/50_eclipse.json (GDLM 50 eclipse), run by tools/make.js after the gameplay.
// The motif: a sun and a moon fixed on the screen; the moon slides over the sun through the first two
// sections and covers it exactly on the drop (totality), then slides off. Each section is its own
// scene with its own palette (SHOWCASE.md):
//   S1 bars 0-4   cube  dusk city: two skyline layers (parallax), lit windows, orange horizon glow, title
//   S2 bars 4-8   ship  the sky darkens, the city sinks away, stars come out, clouds drift by
//   S3 bars 8-12  cube  totality on the drop: black sky, white corona, rays and rings turning, flash, zoom out
//   S4 bars 12-16 wave  the diamond ring: gold, light rays from above, gold dust
//   S5 bars 16-22 cube  dawn: pink sky, the city rises again, credits
"use strict";
const K = require("../scenekit.js");

module.exports = function ({ objects, header, beatX }) {
  const out = [];
  const barX = k => beatX(4 * k + 1);
  const S = [[0, barX(4)], [barX(4), barX(8)], [barX(8), barX(12)], [barX(12), barX(16)], [barX(16), barX(22) + 300]];
  const END = S[4][1], SPEED = 311.58, secs = x => x / SPEED;

  // ---- colour channels ----
  const C = { glow: 1, far: 2, near: 3, win: 4, sun: 5, moon: 6, corona: 7, stars: 8, edge: 9, fill: 10, cloud: 11, rays: 12, motes: 13, rings: 14, frame: 15 };
  const BLEND = new Set([C.glow, C.win, C.sun, C.corona, C.stars, C.edge, C.rays, C.motes, C.rings]);
  // palettes per section (also 1000 bg, 1001 ground, 1009 ground 2, 1002 line, 1004 objects = spikes)
  const P = [
    { 1000: [52, 22, 78], 1001: [30, 12, 48], 1009: [44, 18, 66], 1002: [255, 160, 110], 1004: [255, 245, 235],
      [C.glow]: [255, 95, 45], [C.far]: [86, 36, 104], [C.near]: [42, 16, 62], [C.win]: [255, 180, 80], [C.sun]: [255, 196, 90],
      [C.moon]: [34, 14, 54], [C.corona]: [255, 210, 140], [C.stars]: [220, 190, 255], [C.edge]: [255, 140, 100], [C.fill]: [36, 14, 56],
      [C.cloud]: [120, 52, 120], [C.rays]: [255, 160, 90], [C.motes]: [255, 150, 90], [C.rings]: [255, 200, 140], [C.frame]: [20, 6, 34] },
    { 1000: [24, 14, 58], 1001: [14, 8, 36], 1009: [20, 12, 48], 1002: [190, 150, 255], 1004: [245, 245, 255],
      [C.glow]: [150, 50, 130], [C.cloud]: [64, 40, 112], [C.stars]: [230, 230, 255], [C.edge]: [180, 130, 255], [C.fill]: [22, 12, 50],
      [C.moon]: [18, 10, 44], [C.corona]: [255, 230, 190], [C.motes]: [190, 160, 255], [C.win]: [255, 160, 70] },
    { 1000: [4, 3, 12], 1001: [0, 0, 0], 1009: [6, 4, 14], 1002: [255, 255, 255], 1004: [255, 255, 255],
      [C.glow]: [70, 40, 160], [C.moon]: [0, 0, 0], [C.corona]: [255, 250, 235], [C.rays]: [200, 190, 255], [C.rings]: [170, 150, 255],
      [C.stars]: [255, 255, 255], [C.edge]: [255, 255, 255], [C.fill]: [14, 10, 30], [C.cloud]: [20, 14, 40], [C.motes]: [255, 255, 255], [C.frame]: [0, 0, 0] },
    { 1000: [8, 22, 48], 1001: [4, 12, 30], 1009: [8, 20, 42], 1002: [255, 210, 120], 1004: [255, 250, 235],
      [C.glow]: [255, 170, 60], [C.moon]: [6, 16, 38], [C.corona]: [255, 215, 120], [C.rays]: [255, 200, 90], [C.rings]: [255, 190, 90],
      [C.stars]: [200, 230, 255], [C.edge]: [255, 205, 110], [C.fill]: [6, 18, 40], [C.cloud]: [30, 60, 96], [C.motes]: [255, 210, 110] },
    { 1000: [214, 104, 120], 1001: [96, 34, 70], 1009: [130, 50, 86], 1002: [255, 230, 200], 1004: [255, 255, 255],
      [C.glow]: [255, 200, 130], [C.far]: [170, 80, 120], [C.near]: [110, 40, 84], [C.win]: [255, 220, 150], [C.sun]: [255, 230, 160],
      [C.moon]: [190, 90, 120], [C.corona]: [255, 235, 190], [C.stars]: [255, 230, 240], [C.edge]: [255, 230, 210], [C.fill]: [92, 32, 70],
      [C.cloud]: [255, 170, 170], [C.rays]: [255, 220, 170], [C.motes]: [255, 220, 230], [C.rings]: [255, 220, 190], [C.frame]: [120, 40, 80] },
  ];
  // header: start colours of S1, every channel, a third of them blending
  const defs = {};
  for (const [ch, rgb] of Object.entries(P[0])) defs[ch] = { rgb, blend: BLEND.has(+ch) };
  header = K.channels(header, defs);
  header = K.art(header, { bg: 1, ground: 1, line: 1 });
  // palette changes: S2 over 3 s (dusk deepening), S3 at once (the drop), S4 over 1 s, S5 over 4 s (dawn)
  const FADE = [0, 3, 0, 1, 4];
  for (let i = 1; i < 5; i++) out.push(...K.palette(S[i][0], P[i], FADE[i]));

  // ---- groups ----
  const G = { all: 200, moon: 201, corona: 202, rays: 203, rings: 204, rings2: 205, centre: 206,
    far1: 210, near1: 211, far5: 212, near5: 213, twA: 214, twB: 215, stars: 220, stars2: 221,
    cloud2: 230, cloud4: 232, frame: 234, rays4: 240, motes: 250, title: 260, credits: 261, glow: 262 };
  const T0 = 3; // x of the triggers that set the start state (the player starts at x 0)

  // ---- the eclipse: fixed on the screen all level (locked to the player's x) ----
  const R = 62;
  out.push(...K.eclipse({ cx: 235, cy: 150, r: R, moonDx: 2.3 * R, ch: { sun: C.sun, moon: C.moon, corona: C.corona, rays: C.corona, rings: C.rings }, g: G, nRays: 12 }));
  out.push(K.lockX(T0, G.all, secs(END) + 2, 1));
  // the moon slides over the sun: totality exactly on the drop (S3's start), then off again
  out.push(K.move(T0, G.moon, -2.3 * R, 0, secs(S[2][0]), 13));
  out.push(K.move(S[3][0], G.moon, -0.32 * R, 0, 2.5, 13));               // the diamond ring: a sliver on the right
  out.push(K.move(S[4][0], G.moon, -1.9 * R, 0.4 * R, 7, 13), K.alpha(S[4][0] + 200, G.moon, 0, 5));  // dawn: it slides away and fades
  // corona, rays, rings: faint before the drop, full on it, fading after
  out.push(K.alpha(T0, G.corona, 0.12, 0), K.alpha(T0, G.rays, 0, 0), K.alpha(T0, G.rings, 0, 0), K.alpha(T0, G.rings2, 0, 0));
  out.push(K.alpha(S[1][0], G.corona, 0.45, 6), K.alpha(S[1][0] + 0.6 * (S[2][0] - S[1][0]), G.rays, 0.25, 3));
  out.push(K.alpha(S[2][0], G.corona, 1, 0), K.alpha(S[2][0], G.rays, 1, 0), K.alpha(S[2][0], G.rings, 0.9, 0.2), K.alpha(S[2][0], G.rings2, 0.7, 0.2));
  out.push(K.alpha(S[3][0], G.rings, 0.35, 1.5), K.alpha(S[3][0], G.rings2, 0, 1.5), K.alpha(S[3][0], G.rays, 0.7, 1.5));
  out.push(K.alpha(S[4][0], G.corona, 0.3, 4), K.alpha(S[4][0], G.rays, 0.2, 4), K.alpha(S[4][0], G.rings, 0, 2));
  // rays turn slowly about the sun from the drop on; rings turn both ways
  const rest = secs(END - S[2][0]);
  out.push(K.rotate(S[2][0], G.rays, 120, rest, { centre: G.centre }));
  out.push(K.rotate(S[2][0], G.rings, 360 * 3, rest), K.rotate(S[2][0], G.rings2, -360 * 2, rest));

  // ---- sky: horizon glow along the whole level, stars locked far away ----
  out.push(...K.horizonGlow(-300, END + 600, { ch: C.glow, y: 0, h: 5, z: "B5", group: G.glow }));
  const starSpan = (m, dur) => dur * (1 - m) + 1000;
  out.push(...K.starfield(-300, -300 + starSpan(0.95, END), { ch: C.stars, y0: 110, y1: 330, density: 6, base: [G.stars], seed: 21 }));
  out.push(...K.starfield(-300, -300 + starSpan(0.8, END), { ch: C.stars, y0: 70, y1: 330, density: 3, base: [G.stars2], seed: 22 }));
  out.push(K.lockX(T0, G.stars, secs(END) + 2, 0.95), K.lockX(T0, G.stars2, secs(END) + 2, 0.8));
  out.push(K.alpha(T0, G.stars, 0.2, 0), K.alpha(T0, G.stars2, 0, 0));
  out.push(K.alpha(S[1][0], G.stars, 0.8, 4), K.alpha(S[1][0], G.stars2, 0.6, 4));
  out.push(K.alpha(S[2][0], G.stars, 1, 0), K.alpha(S[2][0], G.stars2, 1, 0));
  out.push(K.alpha(S[4][0], G.stars, 0.15, 4), K.alpha(S[4][0], G.stars2, 0, 3));
  // glow: dim in the dark middle
  out.push(K.alpha(S[2][0], G.glow, 0.45, 0), K.alpha(S[3][0], G.glow, 0.8, 1), K.alpha(S[4][0], G.glow, 1, 3));

  // ---- the city (S1, and again rising at dawn in S5): two parallax layers ----
  const city = (x0, x1, far, near, seed) => {
    const len = x1 - x0;
    out.push(...K.skyline(x0 - 300, x0 + len * 0.15 + 900, { ch: C.far, winCh: C.win, group: far, z: "B4", hMin: 3, hMax: 6, wMin: 1.4, wMax: 2.6, seed, winShare: 0.3, winScale: 0.5, hsv: "0a1a0.85a0a0", twinkle: [G.twA, G.twB] }));
    out.push(...K.skyline(x0 - 300, x0 + len * 0.4 + 900, { ch: C.near, winCh: C.win, group: near, z: "B3", hMin: 1, hMax: 4, wMin: 2, wMax: 3.6, seed: seed + 1, winShare: 0.4, winScale: 0.65, gap: 30, twinkle: [G.twA, G.twB] }));
    out.push(K.lockX(x0 - 1, far, secs(len) + 4, 0.85), K.lockX(x0 - 1, near, secs(len) + 4, 0.6));
  };
  city(S[0][0], S[0][1], G.far1, G.near1, 31);
  // S2: the city sinks as the ship takes off, and fades
  out.push(K.move(S[1][0], G.far1, 0, -200, 3.5, 2), K.move(S[1][0], G.near1, 0, -260, 3, 2));
  out.push(K.alpha(S[1][0] + 60, G.far1, 0, 3), K.alpha(S[1][0] + 60, G.near1, 0, 2.5));
  // S5: it rises again
  city(S[4][0], S[4][1], G.far5, G.near5, 41);
  out.push(K.move(T0, G.far5, 0, -220, 0), K.move(T0, G.near5, 0, -280, 0), K.alpha(T0, G.far5, 0, 0), K.alpha(T0, G.near5, 0, 0));
  out.push(K.move(S[4][0], G.far5, 0, 220, 4, 3), K.move(S[4][0], G.near5, 0, 280, 3.2, 3), K.alpha(S[4][0], G.far5, 1, 2.5), K.alpha(S[4][0], G.near5, 1, 2));
  // windows twinkle on the beat (pulse the two groups towards white, alternating bars)
  for (const [x0, x1] of [S[0], S[4]]) for (let b = 1; b < 120; b++) {
    const x = beatX(b); if (x < x0 || x >= x1) continue;
    if (b % 2 === 1) out.push(K.pulse(x, b % 4 === 1 ? G.twA : G.twB, [255, 255, 230], 0.02, 0.08, 0.35, { group: true }));
  }

  // ---- S2 / S4: clouds drifting through the corridor, behind the play ----
  const clouds = (x0, x1, g, seed) => {
    const Rn = K.rng(seed);
    for (let x = x0 + 100; x < x1 + 600; x += 70 + Rn() * 80)
      out.push(K.obj([936, 937, 938][Math.floor(Rn() * 3)], x, 40 + Rn() * 220, { ch: C.cloud, z: "B3", zo: 0, s: 1.4 + Rn() * 1.6, flipX: Rn() < 0.5, groups: [g], hsv: Rn() < 0.5 ? "0a1a0.75a0a0" : null }));
    out.push(K.move(x0, g, -secs(x1 - x0) * 40, 0, secs(x1 - x0) + 2, 0));   // drift back: they pass faster than the level
    out.push(K.alpha(T0, g, 0, 0), K.alpha(x0, g, 0.5, 1.5), K.alpha(x1, g, 0, 1));
  };
  clouds(S[1][0], S[1][1], G.cloud2, 51);

  // ---- S4: light rays from above, in front, see-through ----
  out.push(...K.lightRays(S[3][0], S[3][1] + 200, { ch: C.rays, group: G.rays4, z: "T3", every: 110, tilt: -22, y: 360 }));
  out.push(K.alpha(T0, G.rays4, 0, 0), K.alpha(S[3][0], G.rays4, 0.35, 1.2), K.alpha(S[3][1], G.rays4, 0, 1));

  // ---- motes: the motif particles of each section, drifting up (S3: sparks, faster) ----
  const MOTE = [[0, 3.5, 90, [1764]], [1, 2.5, 60, [1764]], [2, 4, 260, [1764]], [3, 3.5, 120, [1764]], [4, 3, 80, [1764]]];
  for (const [i, dens, rise, ids] of MOTE) {
    const [x0, x1] = S[i], g = G.motes + i;
    out.push(...K.motes(x0, x1 + 400, { ch: C.motes, group: g, density: dens, ids, z: "T2", seed: 60 + i, y0: -40, y1: 320 }));
    out.push(K.move(x0 - 200, g, 0, rise, secs(x1 - x0) + 2, 0));
  }

  // ---- the gameplay blocks dressed: dark fills with lit edges (rooftops in the city) ----
  const WIN = [0.45, 0, 0, 0, 0.45];
  S.forEach(([x0, x1], i) => out.push(...K.designBlocks(objects, x0, x1, { fill: C.fill, edge: C.edge, glow: C.glow, win: WIN[i] ? C.win : null, windows: WIN[i], seed: 70 + i })));
  // slopes (the wave's walls) take the fill colour; spikes stay white (1004)
  for (const o of objects) if (o.id === 1338) { o.props = o.props || {}; o.props[21] = String(C.edge); }

  // ---- beat pulses: lit edges on bar starts; on every beat at the drop; a white flash on it ----
  for (let b = 1; b < 4 * 22; b++) {
    const x = beatX(b), sec = S.findIndex(([a, c]) => x >= a && x < c);
    if (sec < 0) continue;
    const bar = (b - 1) % 4 === 0;
    if (sec === 2) { // totality: every beat
      out.push(K.pulse(x, C.edge, [255, 255, 255], 0, 0.05, 0.3));
      if (bar) out.push(K.pulse(x, C.corona, [255, 255, 255], 0, 0.06, 0.5), K.pulse(x, C.rings, [255, 255, 255], 0, 0.06, 0.6));
      else out.push(K.pulse(x, C.stars, [255, 255, 255], 0, 0.03, 0.25));
    } else if (sec === 3) { if ((b - 1) % 2 === 0) out.push(K.pulse(x, C.rays, [255, 255, 220], 0, 0.05, 0.4)); if (bar) out.push(K.pulse(x, C.edge, [255, 255, 255], 0, 0.04, 0.4)); }
    else if (bar) out.push(K.pulse(x, C.edge, [255, 255, 255], 0, 0.05, 0.45), K.pulse(x, C.glow, [255, 230, 200], 0, 0.05, 0.6));
  }
  // the drop: a white flash of the sky, and the camera pulls back to show the corona; back at S4
  out.push(K.pulse(S[2][0], 1000, [255, 255, 255], 0, 0.06, 0.9), K.pulse(S[2][0], C.glow, [255, 255, 255], 0, 0.1, 1.2));
  out.push(K.zoom(S[2][0], 0.82, 0.6), K.zoom(S[3][0] - 60, 1, 1.2));
  // the flash into S2 (take-off) and S5 (dawn): softer
  out.push(K.pulse(S[1][0], 1000, [120, 80, 200], 0, 0.05, 0.6), K.pulse(S[4][0], 1000, [255, 230, 200], 0.1, 0.1, 1.2));

  // ---- a dark frame along the top of the screen in the cube sections (fades out for the flying ones) ----
  out.push(...K.topFrame(0, { ch: C.frame, group: G.frame, y: 250, h: 3.5 }), K.lockX(T0, G.frame, secs(END) + 2, 1));
  out.push(K.alpha(T0, G.frame, 0.85, 0), K.alpha(S[1][0], G.frame, 0, 1), K.alpha(S[2][0], G.frame, 0.9, 0), K.alpha(S[3][0], G.frame, 0, 1), K.alpha(S[4][0], G.frame, 0.6, 2));

  // ---- title and credits ----
  out.push(K.text(240, 190, "ECLIPSE", 1.9, { z: "B1", groups: [G.title] }));
  out.push(K.text(240, 155, "GDLM 50", 0.6, { z: "B1", groups: [G.title] }));
  out.push(K.alpha(S[0][0] + 330, G.title, 0, 1));
  const cx = barX(21) + 330;
  out.push(K.text(cx, 180, "ECLIPSE", 1.5, { z: "B1", groups: [G.credits] }));
  out.push(K.text(cx, 145, "song: Uxvellda - Eclipse", 0.5, { z: "B1", groups: [G.credits] }));
  out.push(K.text(cx, 125, "made with GDLevelMaker", 0.45, { z: "B1", groups: [G.credits] }));
  out.push(K.alpha(T0, G.credits, 0, 0), K.alpha(barX(20), G.credits, 1, 1.5));
  // where the level ends: an invisible marker past the credits, so the end comes after them
  out.push(K.obj(1764, END, 300, { ch: C.motes, z: "B5" }));

  return { objects: out, header };
};
