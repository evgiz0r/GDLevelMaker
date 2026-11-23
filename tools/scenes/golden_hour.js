// Scene script for specs/64_golden_hour.json (GDLM 64 golden hour), run by tools/make.js after the gameplay.
// The user's "rung 5" of the beauty ladder (knowledge/levels/modern_look.md, Worked example 1: the ideas of
// Fall Out, never its art): one day in golden light, a new scene per section changed at the portal with the
// mode, one motif through all of them (drifting light motes), frames around the play, bold see-through front
// layers, hazards white or grey on the colour (compose sets channel 1004 per section).
//   S0 first light  calm, pale peach, the sun just under the horizon
//   S1 sunrise      cube on stepped terrain; the sun rises, a far town, clouds framing top and bottom
//   S2 noon flight  ship on the drop: blazing gold, light rays from above, clouds left and right
//   S3 noon run     cube at 2x: white-hot sky, the sun high, the frame thins
//   S4 dusk         upside down: mauve, the sun sinks red, long rays, the first stars
//   S5 night wave   wave on the second drop: deep blue, the sun becomes the moon, stars
//   S6 night run    cube: stars, the town lit, a vignette closing in at the end
//   S7 dawn         pale pink-gold, the sun again, the credits
// Transitions at every portal: a short flash toward the new scene's light colour (never white) and on the
// two drops a quick zoom that eases back. Channels 20-31 are this script's (988-999 the signature's).
"use strict";
const K = require("../scenekit.js");

module.exports = function ({ objects, header, beatX }) {
  const out = [];
  // section starts on the song's bars (briefs/64_golden_hour.json: beats 8, 72, 28, 28, 24, 28, 32, 8)
  const B = [1, 9, 81, 109, 137, 161, 189, 221, 229];
  const X = B.map(b => beatX(b));
  const S = X.slice(0, -1).map((x, i) => [x, X[i + 1]]);
  const END = X[X.length - 1] + 200;
  const C = { sun: 20, glow: 21, far: 22, cloud: 23, rays: 24, motes: 25, stars: 26, fill: 27, edge: 28, frame: 29, win: 30, halo: 31 };
  const BLEND = new Set([C.sun, C.glow, C.rays, C.motes, C.stars, C.edge, C.win, C.halo]);
  // a palette per scene
  const P = [
    { [C.sun]: [255, 150, 90], [C.glow]: [255, 140, 90], [C.far]: [150, 90, 110], [C.cloud]: [255, 200, 180], [C.rays]: [255, 190, 150], [C.motes]: [255, 220, 170], [C.stars]: [255, 230, 220], [C.fill]: [120, 70, 80], [C.edge]: [255, 210, 170], [C.frame]: [90, 50, 70], [C.win]: [255, 210, 140], [C.halo]: [255, 170, 120] },
    { [C.sun]: [255, 190, 90], [C.glow]: [255, 170, 80], [C.far]: [170, 95, 90], [C.cloud]: [255, 215, 170], [C.rays]: [255, 210, 140], [C.motes]: [255, 230, 160], [C.fill]: [140, 70, 50], [C.edge]: [255, 220, 150], [C.frame]: [120, 60, 50], [C.halo]: [255, 200, 120] },
    { [C.sun]: [255, 245, 190], [C.glow]: [255, 220, 120], [C.far]: [210, 140, 60], [C.cloud]: [255, 240, 200], [C.rays]: [255, 240, 170], [C.motes]: [255, 250, 200], [C.fill]: [170, 100, 30], [C.edge]: [255, 240, 170], [C.frame]: [160, 90, 30], [C.halo]: [255, 240, 170] },
    { [C.sun]: [255, 255, 220], [C.glow]: [255, 230, 140], [C.far]: [220, 150, 60], [C.cloud]: [255, 245, 210], [C.rays]: [255, 245, 190], [C.motes]: [255, 250, 210], [C.fill]: [160, 90, 25], [C.edge]: [255, 245, 180], [C.frame]: [150, 80, 20], [C.halo]: [255, 250, 200] },
    { [C.sun]: [255, 110, 80], [C.glow]: [255, 120, 110], [C.far]: [90, 40, 80], [C.cloud]: [230, 140, 180], [C.rays]: [255, 150, 140], [C.motes]: [255, 180, 200], [C.stars]: [255, 220, 240], [C.fill]: [80, 30, 70], [C.edge]: [255, 170, 210], [C.frame]: [60, 20, 55], [C.win]: [255, 190, 120], [C.halo]: [255, 140, 120] },
    { [C.sun]: [220, 230, 255], [C.glow]: [70, 80, 170], [C.far]: [30, 30, 70], [C.cloud]: [70, 80, 140], [C.rays]: [150, 170, 255], [C.motes]: [190, 210, 255], [C.stars]: [230, 235, 255], [C.fill]: [22, 22, 56], [C.edge]: [170, 190, 255], [C.frame]: [10, 10, 30], [C.win]: [255, 210, 130], [C.halo]: [170, 190, 255] },
    { [C.sun]: [230, 235, 255], [C.glow]: [60, 60, 150], [C.far]: [26, 26, 62], [C.cloud]: [60, 66, 120], [C.motes]: [200, 215, 255], [C.stars]: [240, 240, 255], [C.fill]: [18, 18, 48], [C.edge]: [180, 195, 255], [C.frame]: [6, 6, 22], [C.win]: [255, 215, 140], [C.halo]: [180, 195, 255] },
    { [C.sun]: [255, 200, 150], [C.glow]: [255, 190, 170], [C.far]: [190, 120, 130], [C.cloud]: [255, 225, 215], [C.rays]: [255, 215, 190], [C.motes]: [255, 235, 220], [C.stars]: [255, 240, 235], [C.fill]: [150, 90, 100], [C.edge]: [255, 230, 210], [C.frame]: [120, 70, 90], [C.win]: [255, 220, 170], [C.halo]: [255, 210, 170] },
  ];
  const defs = {};
  for (const [ch, rgb] of Object.entries(P[0])) defs[ch] = { rgb, blend: BLEND.has(+ch), opacity: +ch === C.rays ? 0.35 : +ch === C.cloud ? 0.85 : 1 };
  header = K.channels(header, defs);
  // the scene changes at each portal: quick on the drops (S2, S5), slow on the calm turns
  const FADE = [0, 2, 0.15, 0.6, 2.5, 0.15, 1, 3];
  for (let i = 1; i < S.length; i++) out.push(...K.palette(S[i][0], P[i], FADE[i]));
  // transitions: a short flash toward the new scene's light colour (bg 1000), never white; a quick zoom on the drops
  for (let i = 1; i < S.length; i++) {
    const light = P[i][C.halo] || P[i][C.sun];
    out.push(K.pulse(S[i][0], 1000, light, 0.05, 0.1, i === 2 || i === 5 ? 0.6 : 0.4));
  }
  out.push(K.zoom(S[2][0], 0.85, 0.15), K.zoom(S[2][0] + 300, 1, 1.2), K.zoom(S[5][0], 0.85, 0.15), K.zoom(S[5][0] + 300, 1, 1.2));

  // ---- groups ----
  const G = { sun: 300, glow: 301, far: 302, cloudA: 303, cloudF: 304, rays: 305, motes: 306, stars: 307, vign: 308, title: 309, credit: 310, halo: 311 };
  const T0 = 3, SPEED = 311.58, secs = x => x / SPEED;

  // ---- the sun (and later the moon): fixed on the screen, rising and setting through the day ----
  const sun = (x, y, s, o = {}) => K.obj(497, x, y, Object.assign({ ch: C.sun, z: "B4", zo: 2, s }, o));
  out.push(sun(260, 40, 2.6, { groups: [G.sun] }));
  out.push(K.obj(497, 260, 40, { ch: C.halo, z: "B5", zo: 0, s: 5.2, groups: [G.sun, G.halo] }));
  out.push(K.lockX(T0, G.sun, secs(END) + 2, 1));
  out.push(K.alpha(T0, G.halo, 0.25, 0));
  out.push(K.move(S[1][0], G.sun, 0, 150, secs(S[1][1] - S[1][0]), 15));   // sunrise: up
  out.push(K.move(S[2][0], G.sun, 0, 60, 3, 13));                            // noon: high
  out.push(K.move(S[4][0], G.sun, 0, -170, secs(S[4][1] - S[4][0]), 14));   // dusk: sinks
  out.push(K.move(S[5][0], G.sun, 0, 130, 2, 13));                           // night: the moon is up
  out.push(K.move(S[7][0], G.sun, 0, -60, 3, 13));                           // dawn: low again
  out.push(K.alpha(S[2][0], G.halo, 0.45, 1), K.alpha(S[5][0], G.halo, 0.2, 1), K.alpha(S[7][0], G.halo, 0.35, 2));

  // ---- sky: horizon glow along the level, a far town drifting slower than the play ----
  out.push(...K.horizonGlow(-300, END + 600, { ch: C.glow, y: 0, h: 5, z: "B5", group: G.glow }));
  out.push(...K.skyline(-200, END + 600, { ch: C.far, winCh: C.win, z: "B4", group: G.far, hMin: 1, hMax: 4, wMin: 2, wMax: 5, gap: 40, seed: 64, winShare: 0.25, hsv: "0a1a0.8a0a0" }));
  out.push(K.lockX(T0, G.far, secs(END) + 2, 0.85));
  out.push(K.alpha(T0, G.far, 0.85, 0));

  // ---- frames: clouds top and bottom in the bright scenes, light rays at noon and dusk ----
  for (const i of [0, 1, 2, 3, 7]) out.push(...K.cloudFrame(S[i][0], S[i][1], { ch: C.cloud, top: 300, bottom: i === 2 ? null : -70, group: G.cloudA, frontGroup: G.cloudF, seed: 10 + i }));
  out.push(K.alpha(T0, G.cloudF, 0.45, 0));
  for (const i of [2, 3, 4]) out.push(...K.lightRays(S[i][0], S[i][1], { ch: C.rays, group: G.rays, z: "T3", every: i === 4 ? 150 : 100, tilt: i === 4 ? 30 : 16, seed: 20 + i }));
  // stars: dusk (faint), night
  out.push(...K.starfield(S[4][0], S[6][1] + 200, { ch: C.stars, y0: 110, y1: 330, density: 5, base: [G.stars], seed: 64 }));
  out.push(K.alpha(T0, G.stars, 0, 0), K.alpha(S[4][0], G.stars, 0.4, 3), K.alpha(S[5][0], G.stars, 1, 1), K.alpha(S[7][0], G.stars, 0, 3));

  // ---- the motif: drifting light motes through every scene, in front, see-through, half with HSV ----
  out.push(...K.motes(S[0][0], END, { ch: C.motes, z: "T2", group: G.motes, density: 4, y0: -20, y1: 300, sMin: 0.25, sMax: 0.75, seed: 6 }));
  // a soft dust band in front near the ground (see-through, the bottom frame of every scene)
  out.push(...K.motes(S[0][0], END, { ch: C.halo, z: "T3", group: G.motes, density: 3, y0: -50, y1: 25, sMin: 0.8, sMax: 1.6, ids: [1764], seed: 8 }));
  out.push(...K.motes(S[0][0], END, { ch: C.motes, z: "T3", group: G.motes, density: 0.6, y0: 40, y1: 260, sMin: 0.6, sMax: 1.1, ids: [1764, 1765], seed: 7 }));
  out.push(K.alpha(T0, G.motes, 0.7, 0));
  for (let i = 0; i < S.length; i++) out.push(K.move(S[i][0], G.motes, 0, i % 2 ? -30 : 40, secs(S[i][1] - S[i][0]), 13));

  // ---- the gameplay blocks dressed in each scene's colours ----
  for (let i = 0; i < S.length; i++) out.push(...K.designBlocks(objects, S[i][0], S[i][1], { fill: C.fill, edge: C.edge, glow: C.halo, win: i >= 5 ? C.win : null, windows: 0.3, seed: 30 + i }));

  // ---- a vignette closing in at the end of the night (top and bottom bands, locked to the screen) ----
  const vx = S[6][0] + 0.6 * (S[6][1] - S[6][0]);
  out.push(...K.topFrame(vx, { ch: C.frame, y: 300, h: 4, group: G.vign }));
  out.push(...K.topFrame(vx, { ch: C.frame, y: 60, h: 3, group: G.vign }).map(o => Object.assign(o, { flipY: false })));
  out.push(K.alpha(T0, G.vign, 0, 0), K.lockX(vx - 10, G.vign, secs(S[7][1] - vx) + 1, 1), K.alpha(vx, G.vign, 0.8, 2), K.alpha(S[7][0], G.vign, 0, 2));

  // ---- title (after GD's attempt counter) and the song credit at dawn ----
  out.push(K.text(26 * 30, 190, "golden hour", 1.1, { ch: C.edge, z: "B1", groups: [G.title] }));
  out.push(K.text(S[7][0] + 90, 200, "Golden Haze - Detious / DeadRewind", 0.45, { ch: C.edge, z: "B1", groups: [G.credit] }));

  // ---- props from gd-art's library (lib/props.js, ART.md): ground props behind the play (B3), kept 2 blocks
  // clear of every gameplay column so they never read as obstacles, tinted toward each scene; their own
  // channels from 600 up (never 20-31, this script's, nor 988-999, the signature's)
  const PR = require("../../lib/props.js"), alloc = PR.allocator(600);
  const tint = i => ({ bg: P[i][C.glow], ground: P[i][C.far], fill: P[i][C.fill], edge: P[i][C.edge], accent: P[i][C.sun] });
  const PROPS = [[1, "tree", 1.2, 1.4], [1, "bush", 2, 1], [2, "house", 0.8, 1], [3, "house", 1, 1], [3, "windmill", 0.12, 1], [4, "dead tree", 1, 1.3], [6, "lamp post", 1.5, 1], [7, "bush", 1.5, 1]];
  for (const [i, name, density, scale] of PROPS) {
    const r = PR.place(name, S[i][0], S[i][1], { alloc, density, scale, layer: "B3", avoid: objects, clear: 2, palette: tint(i), seed: 40 + i, groups: [G.far + 20] });
    out.push(...r.objects); header = PR.header(header, r.colours);
  }
  // ---- the 2.2 numbers (Fall Out: ~38% of the deco in front, HSV on ~half): the lit block edges go to the
  // first see-through front layer (T2; the fills stay behind the play), and half of the rest get a slight
  // hue / brightness shift so one channel reads as many shades
  let k = 0;
  for (const o of out) {
    if (!o.props || o.id === 899 || o.id === 901 || o.id === 1006 || o.id === 1007 || o.id === 1346 || o.id === 1913 || o.id === 914) continue;
    if (o.id === 1753) o.props[24] = "7";
    if (!o.props[41] && (k++ % 2 === 0)) { o.props[41] = "1"; o.props[43] = (k % 3 === 0 ? "-8" : "6") + "a1a" + (k % 5 === 0 ? "0.9" : "1.05") + "a0a0"; }
  }
  return { objects: out, header };
};
