// Fill pass for GDLM 50 eclipse (tools/scenes/eclipse.js calls it last). Added 2026-11-25 for the user's "some spaces
// are bit dead" and the taste score's weakest parts (TASTE_DATA.md; ART.md "Deco study"): few distinct objects, little
// motion per screen, few colour channels per screen. Per section, in that section's own colours:
//   - set pieces of its theme from GD's own deco shapes (clouds, planets, rings, rays, gradients, grass ...), behind the
//     play (B2-B4) at the heights the camera shows in that mode, never in front of a hazard;
//   - dress on the play: antennas on rooftops (cube sections), engravings and lights deep inside thick block masses
//     (flying corridors), flora along the ground in front only where no hazard / orb / pad is within 2 blocks;
//   - motion on every screen, calm: one soft pulse a beat (alternating two accent groups, towards a lighter tint of the
//     section's own colour, never white: hazards stay the brightest thing), a bob of two drifting groups, a slow sway of
//     the flora, slow continuous spins of the round pieces (rings, spirals, wheels);
//   - v3: denser sky, a brick texture in the block bodies (decokit.blockPattern), pulses that swell (fade-in 0.15 s).
// Returns { objects, channels } (channels: { ch: rgb } to define in the header; each is used in one section only).
"use strict";
const K = require("../scenekit.js"), D = require("../decokit.js"), O = require("../../lib/objects.js");
const kind = o => (O.objInfo(o.id) || {}).kind;

// per section: colours (sky pieces, dress, accent (blending), ground flora) and its theme
const THEME = [
  { name: "dusk city", col: { sky: [150, 64, 124], dress: [74, 28, 96], acc: [255, 150, 90], flora: [58, 20, 80] },
    sky: [48, 49, 129, 130, 131, 225, 226], skyS: [0.7, 1.3], skyY: [110, 230], acc: [1765, 1766, 1767, 1768, 50, 51], antenna: true, },
  { name: "night flight", col: { sky: [70, 46, 124], dress: [44, 26, 92], acc: [200, 180, 255], flora: [30, 18, 70] },
    sky: [222, 223, 224, 148, 149, 405, 500, 501], skyS: [0.6, 1.2], skyY: [-60, 320], acc: [1058, 1059, 1060, 1061, 1764, 1765], engrave: [85, 86, 87, 97, 137, 138, 139], },
  { name: "totality", col: { sky: [76, 64, 160], dress: [26, 20, 58], acc: [150, 140, 225], flora: [20, 14, 40] },
    sky: [997, 998, 999, 1000, 1831, 394, 395, 396, 1021, 1752], skyS: [0.8, 1.6], skyY: [100, 300], acc: [1521, 1522, 1523, 1524, 1019, 1020, 180, 181, 182], },
  { name: "diamond ring", col: { sky: [44, 86, 128], dress: [18, 40, 76], acc: [255, 170, 210], flora: [10, 28, 56] },
    sky: [503, 504, 505, 1009, 1010, 1011, 1012, 1013, 1269, 1270, 1273, 1274, 1291, 1292, 236, 497], skyS: [1, 2.2], skyY: [-40, 320], acc: [375, 376, 377, 378, 1055, 1056, 1057, 1766], engrave: [1058, 1059, 1752], },
  { name: "dawn", col: { sky: [255, 186, 182], dress: [140, 56, 96], acc: [255, 232, 180], flora: [178, 82, 128] },
    sky: [48, 49, 129, 130, 131, 222, 223], skyS: [0.7, 1.4], skyY: [120, 240], acc: [1765, 1766, 1767, 939], antenna: true,
    flora: [406, 407, 408, 414, 906, 907, 908, 909, 910, 940, 941, 942, 1919, 1920, 1921], },
];

module.exports = function fill({ objects, S, beatX, secs, T0, chBase = 20, gBase = 270 }) {
  const out = [], channels = {};
  const solid = new Set(), busy = [];
  for (const o of objects) {
    const k = kind(o);
    if (k === "solid") solid.add(Math.round(o.x / 30 - 0.5) + "," + Math.round(o.y / 30 - 0.5));
    if (k === "hazard" || k === "orb" || k === "pad" || k === "portal") busy.push([o.x, o.y]);
  }
  const near = (x, y, d) => busy.some(([bx, by]) => Math.abs(bx - x) < d && Math.abs(by - y) < d);
  const isS = (c, r) => solid.has(c + "," + r);
  const beatsIn = (x0, x1) => { const a = []; for (let b = 1; b < 200; b++) { const x = beatX(b); if (x >= x0 && x < x1) a.push(x); } return a; };

  S.forEach(([x0, x1], i) => {
    const T = THEME[i], R = K.rng(900 + i * 17), ch = {}, g = {};
    const mix = (a, b, t) => a.map((v, n) => Math.round(v + (b[n] - v) * t));
    T.col.sky2 = mix(T.col.sky, T.col.acc, 0.3); T.col.dress2 = mix(T.col.dress, T.col.sky, 0.3);   // a second shade of each, a hue step apart
    ["sky", "dress", "acc", "flora", "sky2", "dress2"].forEach((k, j) => { ch[k] = chBase + i * 6 + j; channels[ch[k]] = { rgb: T.col[k], blend: k === "acc" }; });
    ["pulseA", "pulseB", "bobA", "bobB", "sway", "spin", "bobC"].forEach((k, j) => g[k] = gBase + i * 7 + j);
    const pick = a => a[Math.floor(R() * a.length)];

    // 1. sky set pieces behind the play, two drifting groups (bob), round ones spinning
    const round = new Set([222, 223, 224, 148, 149, 405, 997, 998, 999, 1000, 1831, 1058, 1059, 1060, 1061, 236, 497, 180, 181, 182, 1752]);
    for (let x = x0 + 20; x < x1; x += (i === 2 ? 12 : 30) + R() * (i === 2 ? 20 : 40)) {
      const id = pick(T.sky), y = T.skyY[0] + R() * (T.skyY[1] - T.skyY[0]);
      if (isS(Math.round(x / 30 - 0.5), Math.round(y / 30 - 0.5)) && R() < 0.7) continue;   // mostly hidden in a block mass
      const grp = round.has(id) && R() < 0.5 ? g.spin : [g.bobA, g.bobB, g.bobC][Math.floor(R() * 3)];
      out.push(K.obj(id, x, y, { ch: R() < 0.5 ? ch.sky : ch.sky2, z: pick(["B2", "B3", "B4"]), zo: -2, s: T.skyS[0] + R() * (T.skyS[1] - T.skyS[0]), flipX: R() < 0.5, groups: [grp], hsv: R() < 0.4 ? "0a1a0.8a0a0" : null }));
    }
    // accent sparks: small lights in the sky, two pulse groups
    for (let x = x0 + 10; x < x1; x += (i === 2 ? 10 : 22) + R() * (i === 2 ? 16 : 36)) {
      const id = pick(T.acc), y = T.skyY[0] + R() * (T.skyY[1] - T.skyY[0]);
      if (isS(Math.round(x / 30 - 0.5), Math.round(y / 30 - 0.5)) || near(x, y, 50)) continue;
      const spin = [1521, 1522, 1523, 1524, 180, 181, 182, 1058, 1059, 1060, 1061, 375, 376, 377, 378].includes(id);
      out.push(K.obj(id, x, y, { ch: ch.acc, z: "B2", zo: -1, s: (spin ? 0.6 : 0.35) + R() * 0.5, rot: R() * 360, groups: [spin ? g.spin : (R() < 0.5 ? g.pulseA : g.pulseB)] }));
    }

    // 2. dress on the play
    for (const o of objects) {
      if (kind(o) !== "solid" || o.x < x0 || o.x >= x1) continue;
      const c = Math.round(o.x / 30 - 0.5), r = Math.round(o.y / 30 - 0.5);
      // antennas on rooftops: an open top, at least 2 blocks clear of hazards / orbs
      if (T.antenna && !isS(c, r + 1) && !isS(c, r + 2) && r >= 0 && R() < 0.22 && !near(o.x, o.y + 40, 75))
        out.push(K.obj(pick([15, 16, 17]), o.x + (R() - 0.5) * 12, o.y + 15 + 20, { ch: ch.dress, z: "B1", zo: -3, groups: [R() < 0.5 ? g.pulseA : g.pulseB] }));
      // engravings and lights deep inside a block mass (all 8 neighbours solid), never by an edge the player reads
      if (T.engrave && R() < 0.12) {
        let deep = true; for (let dc = -1; dc <= 1 && deep; dc++) for (let dr = -1; dr <= 1; dr++) if (!isS(c + dc, r + dr)) { deep = false; break; }
        if (deep && !near(o.x, o.y, 70)) out.push(K.obj(pick(T.engrave), o.x, o.y, { ch: ch.dress, z: "T2", zo: 2, s: 0.5 + R() * 0.4, rot: R() * 360, groups: [g.spin] }));
        else if (deep) out.push(K.obj(1764, o.x, o.y, { ch: ch.acc, z: "T2", zo: 2, s: 0.4, groups: [g.pulseA] }));
      }
    }
    // a quiet texture in the block bodies (bricks a shade darker than the fill), lit trims on the rooftops at dusk and dawn
    out.push(...D.blockPattern(objects, x0, x1, { ch: i % 2 ? ch.dress2 : ch.dress, top: T.antenna ? ch.acc : null, seed: 300 + i }));
    // flora along the ground, in front, away from hazards and off the floor blocks the player runs on
    if (T.flora) for (let x = x0 + 8; x < x1; x += 10 + R() * 22) {
      const c = Math.round(x / 30 - 0.5);
      if (isS(c, 0) || near(x, 15, 65)) continue;
      out.push(K.obj(pick(T.flora), x, 4 + R() * 4, { ch: R() < 0.8 ? ch.flora : ch.acc, z: "T2", zo: 1, s: 0.6 + R() * 0.6, flipX: R() < 0.5, groups: [g.sway] }));
    }

    // 3. motion: one soft pulse a beat (A / B alternating), the two drift groups bob in turn, the flora sways, spins
    const lighter = T.col.acc.map(v => Math.min(255, Math.round(v + (255 - v) * 0.45)));
    beatsIn(x0, x1).forEach((x, k) => {
      out.push(K.pulse(x, k % 2 ? g.pulseB : g.pulseA, lighter, 0.15, 0.05, 0.45, { group: true }));   // a swell, not a flash (taste.js counts fade-in <= 0.1 as a flash)
      // the off-beat: a fainter swell of the other accent group (the drop sections only: totality and the diamond ring)
      if (i === 2 || i === 3) out.push(K.pulse(x + (beatX(2) - beatX(1)) / 2, k % 2 ? g.pulseA : g.pulseB, lighter, 0.15, 0, 0.3, { group: true }));
      out.push(K.move(x + (beatX(2) - beatX(1)) / 2, g.bobC, 0, k % 2 ? -4 : 4, secs(beatX(2) - beatX(1)) * 0.45, 13));   // the third drift group on the off-beats
      out.push(K.move(x, k % 2 ? g.bobB : g.bobA, 0, k % 4 < 2 ? 6 : -6, secs(beatX(2) - beatX(1)) * 0.95, 13));
      if (T.flora && k % 2 === 0) out.push(K.rotate(x, g.sway, k % 4 ? -8 : 8, secs(beatX(3) - beatX(1)) * 0.95, { ease: 13 }));
    });
    // spins: a slow turn per screen (continuous, chained), the rays and wheels of the drop a little faster
    for (let x = x0; x < x1; x += 300) out.push(K.rotate(x, g.spin, i === 2 ? 90 : 45, secs(300), {}));
    // nothing of a section shows before its colours are right: the groups fade in with the section
    for (const k of Object.keys(g)) { if (i > 0) out.push(K.alpha(T0, g[k], 0, 0), K.alpha(x0 - 420, g[k], 1, 0.8)); out.push(K.alpha(x1 + 360, g[k], 0, 0.8)); }
  });
  return { objects: out, channels };
};
