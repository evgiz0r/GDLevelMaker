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
    { [C.sun]: [255, 150, 90], [C.glow]: [255, 140, 90], [C.far]: [150, 90, 110], [C.cloud]: [255, 200, 180], [C.rays]: [255, 190, 150], [C.motes]: [255, 220, 170], [C.stars]: [255, 230, 220], [C.fill]: [95, 50, 60], [C.edge]: [255, 210, 170], [C.frame]: [70, 35, 50], [C.win]: [255, 210, 140], [C.halo]: [255, 170, 120] },
    { [C.sun]: [255, 190, 90], [C.glow]: [255, 170, 80], [C.far]: [170, 95, 90], [C.cloud]: [255, 215, 170], [C.rays]: [255, 210, 140], [C.motes]: [255, 230, 160], [C.fill]: [105, 48, 32], [C.edge]: [255, 220, 150], [C.frame]: [85, 40, 30], [C.halo]: [255, 200, 120] },
    { [C.sun]: [255, 245, 190], [C.glow]: [255, 220, 120], [C.far]: [210, 140, 60], [C.cloud]: [255, 240, 200], [C.rays]: [255, 240, 170], [C.motes]: [255, 250, 200], [C.fill]: [125, 68, 18], [C.edge]: [255, 240, 170], [C.frame]: [100, 55, 15], [C.halo]: [255, 240, 170] },
    { [C.sun]: [255, 255, 220], [C.glow]: [255, 230, 140], [C.far]: [220, 150, 60], [C.cloud]: [255, 245, 210], [C.rays]: [255, 245, 190], [C.motes]: [255, 250, 210], [C.fill]: [118, 62, 14], [C.edge]: [255, 245, 180], [C.frame]: [95, 50, 12], [C.halo]: [255, 250, 200] },
    { [C.sun]: [255, 110, 80], [C.glow]: [255, 120, 110], [C.far]: [90, 40, 80], [C.cloud]: [230, 140, 180], [C.rays]: [255, 150, 140], [C.motes]: [255, 180, 200], [C.stars]: [255, 220, 240], [C.fill]: [58, 18, 50], [C.edge]: [255, 170, 210], [C.frame]: [40, 12, 36], [C.win]: [255, 190, 120], [C.halo]: [255, 140, 120] },
    { [C.sun]: [220, 230, 255], [C.glow]: [120, 130, 230], [C.far]: [56, 60, 140], [C.cloud]: [120, 128, 215], [C.rays]: [150, 170, 255], [C.motes]: [190, 210, 255], [C.stars]: [230, 235, 255], [C.fill]: [12, 12, 34], [C.edge]: [170, 190, 255], [C.frame]: [5, 5, 16], [C.win]: [255, 210, 130], [C.halo]: [170, 190, 255] },
    { [C.sun]: [230, 235, 255], [C.glow]: [110, 115, 215], [C.far]: [50, 52, 128], [C.cloud]: [110, 116, 200], [C.motes]: [200, 215, 255], [C.stars]: [240, 240, 255], [C.fill]: [10, 10, 28], [C.edge]: [180, 195, 255], [C.frame]: [4, 4, 14], [C.win]: [255, 215, 140], [C.halo]: [180, 195, 255] },
    { [C.sun]: [255, 200, 150], [C.glow]: [255, 190, 170], [C.far]: [190, 120, 130], [C.cloud]: [255, 225, 215], [C.rays]: [255, 215, 190], [C.motes]: [255, 235, 220], [C.stars]: [255, 240, 235], [C.fill]: [118, 68, 78], [C.edge]: [255, 230, 210], [C.frame]: [90, 52, 64], [C.win]: [255, 220, 170], [C.halo]: [255, 210, 170] },
  ];
  // gd-art's deco kit (tools/decokit.js): channels 32-36 -- top trims (a lit path), three backdrop depths paler
  // toward the sky (aerial perspective, never as dark as the play), grass a step under the trim
  const D = require("../decokit.js"), SKY = require("../../briefs/64_golden_hour.json").sections.map(s => s.bg);
  Object.assign(C, { trim: 32, far2: 33, mid: 34, near: 35, grass: 36 });
  const TRIM = [[190, 150, 110], [170, 190, 80], [195, 205, 85], [190, 200, 70], [205, 115, 175], [125, 145, 255], [115, 135, 245], [215, 175, 155]];
  // a second hue (gd-art, GDLM 64 vs Dreamy: "pink scenery on a pink sky"): the day scenes' distance goes cool blue-violet
  // against the warm sky (aerial perspective), dusk toward deep violet, night stays blue
  const SHADE = [[90, 90, 150], [80, 90, 150], [90, 110, 160], [90, 110, 160], [60, 40, 120], [20, 20, 60], [20, 20, 60], [100, 100, 160]];
  // the bright day scenes (sunrise, noon): the backdrop steps well down from the sky -- at the kit's default the
  // tree line was mid-gold on a gold sky behind a gold path ("noon is mushy", v1 vs Jumper)
  const DEEP = new Set([1, 2, 3]);
  P.forEach((p, i) => { const d = D.depthColours(SKY[i], SHADE[i], DEEP.has(i) ? [0.32, 0.48, 0.62] : undefined); Object.assign(p, { [C.trim]: TRIM[i], [C.grass]: TRIM[i].map(v => Math.round(v * 0.72)), [C.far2]: d.far, [C.mid]: d.mid, [C.near]: d.near }); });
  const defs = {};
  for (const [ch, rgb] of Object.entries(P[0])) defs[ch] = { rgb, blend: BLEND.has(+ch), opacity: +ch === C.rays ? 0.18 : +ch === C.cloud ? 0.85 : 1 };
  header = K.channels(header, defs);
  // the scene changes at each portal: quick on the drops (S2, S5), slow on the calm turns
  const FADE = [0, 2, 0.15, 0.6, 2.5, 0.15, 1, 3];
  // each palette fades IN to its section's downbeat, starting half a beat before (not snapped onto the grid: our colour
  // triggers sat 91% on a beat vs real levels' ~31%, gd-taste's section comparison; a fade that lands on the beat reads better)
  const halfBeat = (beatX(2) - beatX(1)) / 2;
  for (let i = 1; i < S.length; i++) out.push(...K.palette(S[i][0] - halfBeat, P[i], FADE[i]));
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
  out.push(...K.skyline(-200, END + 600, { ch: C.far, winCh: C.win, z: "B5", group: G.far, hMin: 1, hMax: 4, wMin: 2, wMax: 5, gap: 40, seed: 64, winShare: 0.25, hsv: "0a1a0.8a0a0" }));
  out.push(K.lockX(T0, G.far, secs(END) + 2, 0.85));
  out.push(K.alpha(T0, G.far, 0.85, 0));

  // ---- frames: clouds top and bottom in the bright scenes, light rays at noon and dusk ----
  // (scalloped cloud bands, not cloudFrame's stretched squares: gd-art, "what reads most as 3 squares is the big flat rectangles")
  const PRc = require("../../lib/props.js");
  for (const i of [0, 1, 2, 3, 7]) {
    out.push(...PRc.place("cloud band", S[i][0], S[i][1], { silhouette: C.cloud, gap: 0, density: 1.25, flipY: true, y: 330, layer: "B4", seed: 10 + i, groups: [G.cloudA] }).objects);
    // (no bottom band: it showed as pink blobs inside the dark ground)
  }
  out.push(K.alpha(T0, G.cloudF, 0.6, 0));
  for (const i of [2, 3, 4]) out.push(...K.lightRays(S[i][0], S[i][1], { ch: C.rays, group: G.rays, z: "T3", every: i === 4 ? 150 : 100, tilt: i === 4 ? 30 : 16, seed: 20 + i }));
  // stars: dusk (faint), night
  out.push(...K.starfield(S[4][0], S[6][1] + 200, { ch: C.stars, y0: 110, y1: 330, density: 5, base: [G.stars], seed: 64 }));
  out.push(K.alpha(T0, G.stars, 0, 0), K.alpha(S[4][0], G.stars, 0.4, 3), K.alpha(S[5][0], G.stars, 1, 1), K.alpha(S[7][0], G.stars, 0, 3));

  // ---- the motif: drifting light motes through every scene, in front, see-through, half with HSV ----
  out.push(...K.motes(S[0][0], END, { ch: C.motes, z: "T2", group: G.motes, density: 4, y0: -20, y1: 300, sMin: 0.25, sMax: 0.75, seed: 6 }));
  // a soft dust band in front near the ground (see-through, the bottom frame of every scene)
  out.push(...K.motes(S[0][0], END, { ch: C.halo, z: "T3", group: G.motes, density: 3, y0: -50, y1: 25, sMin: 0.8, sMax: 1.6, ids: [1764], seed: 8 }));
  out.push(...K.motes(S[0][0], END, { ch: C.motes, z: "T3", group: G.motes, density: 0.6, y0: 40, y1: 260, sMin: 0.6, sMax: 1.1, ids: [1764, 1765], seed: 7 }));
  out.push(K.alpha(T0, G.motes, 0.45, 0));
  for (let i = 0; i < S.length; i++) out.push(K.move(S[i][0], G.motes, 0, i % 2 ? -30 : 40, secs(S[i][1] - S[i][0]), 13));

  // ---- the gameplay blocks dressed in each scene's colours ----
  for (let i = 0; i < S.length; i++) out.push(...K.designBlocks(objects, S[i][0], S[i][1], { fill: C.fill, edge: C.edge, glow: C.halo, win: i >= 5 ? C.win : null, windows: 0.3, seed: 30 + i }));
  // gd-art's kit: bricks in closed cells + lit top trims and grass tufts in the cube scenes; three backdrop depths
  // in every scene (mountains B5 / hills B4 / tree line B3)
  const CUBE = new Set([0, 1, 3, 4, 6, 7]);
  for (let i = 0; i < S.length; i++) {
    if (CUBE.has(i)) {
      out.push(...D.blockPattern(objects, S[i][0], S[i][1], { ch: C.fill, top: C.trim, seed: 40 + i }));
      out.push(...D.tufts(objects, S[i][0], S[i][1], { ch: C.grass, seed: 60 + i, group: 312 }));
    }
    out.push(...D.backdrop(S[i][0], S[i][1], { far: C.far2, mid: C.mid, near: i === 2 ? null : C.near, trees: i >= 4 ? "dead tree" : "tree", density: 1.5, seed: i }));
  }
  // ---- motion on every screen (gd-art / gd-taste: moving deco is the strongest sign of a featured level,
  // ART.md "Deco study"): the grass sways, the motes bob, the lit block edges pulse on every bar toward a
  // brighter tint of their own colour every second bar (calm: under 0.5 a second, never white) -- ~10 triggers per 20-block screen
  out.push(...K.sway(S[0][0], END, 312, 7, 100, 0.35));
  out.push(...K.bob(S[0][0], END, G.motes, 12, 160, 0.5));
  { const spb = 8, bars = []; for (let b = 1; beatX(b) < END - 60; b += spb) bars.push(b);
    // every second one on the off-beat ("and" of beat 2): loose, not snapped (real levels ~31% of pulses on a beat)
    for (const [j, b] of bars.entries()) { const x = j % 2 ? beatX(b + 1.5) : beatX(b), i = Math.max(0, S.findIndex(([a, z]) => x >= a && x < z)), e = P[i][C.edge];
      out.push(K.pulse(x, C.edge, e.map(v => Math.round(v + (255 - v) * 0.35)), 0.05, 0.1, 0.5)); } }

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
  // set pieces (gd-art, ab45937): mountains and hills far behind the town in every scene (bg props: B5,
  // never over the play), a ruin and a tower behind the play at dusk and in the night
  // (the mountains / hills props were replaced by decokit's backdrop above: one depth order, mountains B5 behind the trees)
  for (const [i, name] of [[4, "ruin"], [6, "tower"], [5, "tower"]]) {
    const r = PR.place(name, S[i][0], S[i][1], { alloc, density: 0.5, scale: 1, layer: "B3", avoid: objects, clear: 2, palette: tint(i), seed: 70 + i });
    out.push(...r.objects); header = PR.header(header, r.colours);
  }
  // (gd-art's cloud bands were tried as a top frame: the kit's cloudFrame already frames the top; over budget)
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
  // nothing in front of a hazard (tools/contrast.js "deco over hazards": v2 had 58 at x 2400-2700): deco on B2 or
  // in front within a block of a spike / saw goes, except what dresses a solid block (its fill and edges)
  const GDo = require("../../lib/objects.js"), kindOf = o => (GDo.objInfo(o.id) || {}).kind;
  const haz = objects.filter(o => kindOf(o) === "hazard"), solidCell = new Set(objects.filter(o => kindOf(o) === "solid").map(o => Math.floor(o.x / 30) + ":" + Math.floor(o.y / 30)));
  const front = o => { const z = o.props && o.props[24]; return z != null && z !== "" && +z >= 1; };
  const kept = out.filter(o => !(o.x != null && o.id !== 1346 && kindOf(o) !== "trigger" && front(o) && !solidCell.has(Math.floor(o.x / 30) + ":" + Math.floor(o.y / 30))
    && haz.some(h => Math.abs(h.x - o.x) < 30 && Math.abs(h.y - o.y) < 30)));
  return { objects: kept, header };
};
