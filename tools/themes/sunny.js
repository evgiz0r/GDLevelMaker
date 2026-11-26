// THEME KIT: sunny (ART.md "Theme kits"; the user's prompt for GDLM 73, 2026-11-26: "Sunny mood, buildings clouds birds.
// happy colors, good contrasts. rather pacy").
// A bright day over a little city. The sky is light and clean; the play is the darkest, most saturated thing on screen
// (a deep body with a sunny rim, like a building against the sky), hazards get a hot rim of their own. Behind it:
//   - a far skyline of pale buildings (near the sky's value, so it never reads as solid),
//   - a nearer row of pastel houses in three happy colours with soft windows,
//   - puffy clouds (stacked disks) drifting slowly left, on two depths,
//   - a sun with a soft halo and slow rays, carried with the player,
//   - flocks of small birds crossing the sky (two wing groups flapping on the beat, the flock moving left).
// Variants (one family: blue sky, warm light):
//   morning   pale blue sky, the sun low, a soft warm haze (the intro)
//   noon      the bluest sky, the sun high, the busiest city (the drops)
//   breeze    near-white sky, big clouds, few buildings (flying high)
//   park      mint-tinted sky, low houses, more birds (the break)
//   golden    warm golden afternoon, peach clouds (the finale)
// A kit = data + dress(ctx, section); format in tools/theme.js; applied by tools/scenes/theme.js (spec "theme": "sunny").
"use strict";
const K = require("../scenekit.js");

// ---- channels (140-159: this kit's; space 80-97, ice 100-117, fire 120-) and groups (540-569; per-section 570-) ----
const CH = { rim: 140, fill: 141, roof: 142, win: 143, hazard: 144, far: 145, farWin: 146, houseA: 147, houseB: 148, houseC: 149,
  houseWin: 150, cloud: 151, cloudShade: 152, sun: 153, halo: 154, bird: 155, haze: 156 };
const G = { cloudsA: 540, cloudsB: 541, sun: 542, rays: 543, birdsA: 544, birdsB: 545, flock: 546, wingA: 547, wingB: 548, haze: 549, twinkle: 550 };

// ---- palettes. Roles (decokit.checkRoles): the path = a deep body + a sunny rim, far off the light sky; hazards a hot
// rim on black; deco (far skyline, houses) light and soft, near the sky's value, never the body's.
const VARIANTS = {
  morning: { mood: "a fresh morning over the city, the sun low and warm", energy: 0.6, piece: "city", sunY: 230, birds: 1,
    bg: [150, 210, 255], ground: [70, 175, 95], line: [255, 248, 215], pathEdge: [255, 214, 70], blockFill: [38, 62, 150],
    roof: [255, 245, 200], win: [255, 225, 120], hazardEdge: [255, 70, 120],
    far: [184, 222, 250], farWin: [215, 236, 255], houseA: [255, 196, 205], houseB: [190, 240, 205], houseC: [222, 205, 255],
    houseWin: [255, 250, 230], cloud: [255, 255, 255], cloudShade: [222, 234, 252], sun: [255, 236, 130], halo: [255, 220, 140],
    bird: [70, 90, 140], haze: [255, 228, 180] },
  noon: { mood: "the brightest blue sky, the sun high, a busy city", energy: 1, piece: "city", sunY: 300, birds: 1.4,
    bg: [100, 185, 255], ground: [60, 165, 85], line: [255, 255, 235], pathEdge: [255, 222, 60], blockFill: [30, 46, 130],
    roof: [255, 250, 215], win: [255, 230, 110], hazardEdge: [255, 60, 100],
    far: [140, 200, 250], farWin: [190, 225, 255], houseA: [255, 180, 190], houseB: [170, 235, 190], houseC: [205, 190, 255],
    houseWin: [255, 250, 225], cloud: [255, 255, 255], cloudShade: [205, 225, 250], sun: [255, 245, 150], halo: [255, 235, 160],
    bird: [45, 65, 120], haze: [210, 235, 255] },
  breeze: { mood: "high in a near-white sky between big clouds", energy: 0.8, piece: "clouds", sunY: 280, birds: 1,
    bg: [175, 222, 255], ground: [80, 160, 220], line: [255, 255, 255], pathEdge: [255, 205, 60], blockFill: [40, 58, 150],
    roof: [255, 245, 210], win: [255, 225, 120], hazardEdge: [255, 70, 120],
    far: [200, 230, 252], farWin: [225, 240, 255], houseA: [255, 200, 210], houseB: [195, 240, 210], houseC: [225, 210, 255],
    houseWin: [255, 250, 230], cloud: [255, 255, 255], cloudShade: [220, 232, 250], sun: [255, 240, 150], halo: [255, 230, 170],
    bird: [70, 90, 140], haze: [235, 245, 255] },
  park: { mood: "a calm park at the edge of town, mint sky, birds everywhere", energy: 0.5, piece: "park", sunY: 260, birds: 2,
    bg: [160, 232, 215], ground: [60, 170, 90], line: [255, 250, 220], pathEdge: [255, 210, 80], blockFill: [34, 70, 120],
    roof: [255, 245, 205], win: [255, 225, 130], hazardEdge: [255, 80, 120],
    far: [190, 240, 228], farWin: [220, 248, 240], houseA: [255, 200, 200], houseB: [175, 240, 200], houseC: [215, 210, 255],
    houseWin: [255, 252, 235], cloud: [255, 255, 255], cloudShade: [215, 240, 235], sun: [255, 240, 140], halo: [255, 235, 170],
    bird: [50, 90, 100], haze: [255, 245, 200] },
  golden: { mood: "a golden afternoon, warm light on every roof", energy: 1, piece: "city", sunY: 190, birds: 1.2,
    bg: [255, 205, 130], ground: [200, 120, 70], line: [255, 250, 230], pathEdge: [255, 255, 235], blockFill: [110, 40, 90],
    roof: [255, 235, 180], win: [255, 240, 150], hazardEdge: [200, 20, 70],
    far: [255, 220, 165], farWin: [255, 236, 195], houseA: [255, 175, 160], houseB: [255, 230, 150], houseC: [240, 190, 220],
    houseWin: [255, 248, 215], cloud: [255, 245, 230], cloudShade: [255, 220, 190], sun: [255, 250, 200], halo: [255, 225, 150],
    bird: [120, 60, 70], haze: [255, 190, 120] },
};
const BLEND = { [CH.halo]: 0.45, [CH.haze]: 0.35 };
// header: plain background art (13: the flat one that shows a bright colour as set, STYLE "palette light"), plain ground
const HEADER = { kA6: "13", kA7: "1", kA25: "0" };

function channelMap(v) {
  const p = VARIANTS[v] || VARIANTS.morning, m = { 1000: p.bg, 1001: p.ground, 1002: p.line };
  for (const [k, ch] of Object.entries(CH)) m[ch] = p[k === "rim" ? "pathEdge" : k === "hazard" ? "hazardEdge" : k === "fill" ? "blockFill" : k];
  return m;
}
function palette(v) {
  const p = VARIANTS[v] || VARIANTS.morning;
  return { bg: p.bg, ground: p.ground, line: p.line, pathEdge: p.pathEdge, blockFill: p.blockFill, hazardEdge: p.hazardEdge,
    far: p.far, mid: p.houseB, near: p.houseA, accent: p.houseC, body: p.blockFill };
}

// ---- song brief: bright, bouncy, quick ----
const SONG = { bpm: [130, 175], dur: [60, 110], mood: "bright and bouncy: major key, a quick beat, a happy lead",
  energy: "a light intro, an early drop, a short break, a big happy finale",
  want: { beatless: [0, 0.2], dynamic: 6 },
  words: ["sun", "sunny", "morning", "summer", "day", "happy", "sky", "walk", "style", "bright", "shine", "light", "city"] };
const MODES = { prefer: ["cube", "ship", "ball", "wave", "ufo", "robot", "swing"], flyShare: 0.35, gravity: "few",
  speeds: ["1x", "2x", "3x"], notes: "pacy: 2x for most cube and flying parts, ground modes on the hits, a 3x flight on the loudest part" };

// ---- pieces (one block = 30 units) ----
// a puffy cloud: a row of disks (497, 50 units across at scale 1) with a flat-ish shaded underside
function cloud(x, y, size, o = {}) {
  const R = K.rng(o.seed || 1), gs = o.groups || [], z = o.z || "B3", out = [], n = 3 + Math.floor(R() * 3);
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1) - 0.5, s = size * (1 - Math.abs(t) * 0.9) * (0.85 + R() * 0.3);
    out.push(K.obj(497, x + t * size * 90, y + s * 12, { ch: CH.cloud, z, zo: (o.zo ?? 0) + 2, s, groups: gs }));
  }
  out.push(K.obj(497, x, y - size * 6, { ch: CH.cloudShade, z, zo: o.zo ?? 0, sx: size * 2.4, sy: size * 0.55, groups: gs }));
  return out;
}
// a sun: disk, two soft halo rings (blending), and rays turning slowly (their own group, about the disk)
function sun(x, y, r, o = {}) {
  const out = [], gs = o.groups || [G.sun];
  out.push(K.obj(497, x, y, { ch: CH.sun, z: "B5", zo: 5, s: 2 * r / 50, groups: gs.concat([G.sun + 100]) }));
  out.push(K.obj(497, x, y, { ch: CH.halo, z: "B5", zo: 3, s: 3.0 * r / 50, groups: gs }));
  out.push(K.obj(497, x, y, { ch: CH.halo, z: "B5", zo: 2, s: 4.4 * r / 50, groups: gs }));
  const n = 12;
  for (let i = 0; i < n; i++) { const th = i * 360 / n, len = (i % 2 ? 0.9 : 1.4) * r, R = r * 1.25 + len / 2, rad = th * Math.PI / 180;
    out.push(K.obj(1021, x + R * Math.sin(rad), y + R * Math.cos(rad), { ch: CH.halo, z: "B5", zo: 1, rot: th, sx: 0.7, sy: len / 81, groups: gs.concat([G.rays]) })); }
  return out;
}
// one bird: a small "v" of two thin lines (1753), each wing in its own flap group (it turns about its own centre)
function bird(x, y, s, o = {}) {
  const z = o.z || "B2", base = o.groups || [];
  return [
    K.obj(1753, x - 6 * s, y + 2 * s, { ch: CH.bird, z, zo: 6, sx: 0.42 * s, rot: -28, groups: base.concat([G.wingA]) }),
    K.obj(1753, x + 6 * s, y + 2 * s, { ch: CH.bird, z, zo: 6, sx: 0.42 * s, rot: 28, groups: base.concat([G.wingB]) }),
    K.obj(1764, x, y, { ch: CH.bird, z, zo: 7, s: 0.22 * s, groups: base }),
  ];
}
// a flock: 3-7 birds in a loose V, high in the sky
function flock(x, y, o = {}) {
  const R = K.rng(o.seed || 5), n = o.n || 3 + Math.floor(R() * 5), out = [], s = o.s || 1;
  for (let i = 0; i < n; i++) { const k = Math.ceil(i / 2) * (i % 2 ? 1 : -1);
    out.push(...bird(x + Math.abs(k) * 22 * s + (R() - 0.5) * 6, y + k * 12 * s + (R() - 0.5) * 6, s * (0.8 + R() * 0.4), o)); }
  return out;
}
// pastel houses: bodies (211) in three colours, a lighter roof strip or a pitched roof (693 pair), a few soft windows
function houses(objects, x0, x1, o = {}) {
  const R = K.rng(o.seed || 9), out = [], gs = o.groups || [], z = o.z || "B3", chs = [CH.houseA, CH.houseB, CH.houseC];
  const hMin = o.hMin ?? 2, hMax = o.hMax ?? 5, base = o.base ?? 0;
  for (let x = x0; x < x1;) {
    const w = (1.6 + R() * 1.6) * 30, h = Math.round(hMin + R() * (hMax - hMin)) * 30, cx = x + w / 2, ch = chs[Math.floor(R() * 3)];
    out.push(K.obj(211, cx, base + h / 2, { ch, z, zo: 0, sx: w / 30, sy: h / 30, groups: gs }));
    if (R() < 0.5) {   // a pitched roof
      const rh = 18 + R() * 16;
      out.push(K.obj(693, cx - w / 4, base + h + rh / 2, { ch, z, zo: 0, sx: w / 60, sy: rh / 30, groups: gs, hsv: "0a1a0.9a0a0" }));
      out.push(K.obj(693, cx + w / 4, base + h + rh / 2, { ch, z, zo: 0, sx: w / 60, sy: rh / 30, flipX: true, groups: gs, hsv: "0a1a0.82a0a0" }));
    } else out.push(K.obj(211, cx, base + h + 3, { ch, z, zo: 1, sx: w / 30 + 0.15, sy: 0.2, groups: gs, hsv: "0a1a0.88a0a0" }));
    const cols = Math.max(1, Math.floor(w / 24)), rows = Math.max(1, Math.floor((h - 14) / 26));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      if (R() > 0.55) continue;
      out.push(K.obj(211, cx - (cols - 1) * 12 + i * 24, base + 20 + j * 26, { ch: CH.houseWin, z, zo: 2, sx: 0.3, sy: 0.36, groups: gs.concat(R() < 0.15 ? [G.twinkle] : []) }));
    }
    x += w + 4 + R() * (o.gap ?? 26);
  }
  return out;
}
// trees for the park: a trunk and a round crown of two disks
function trees(x0, x1, o = {}) {
  const R = K.rng(o.seed || 21), out = [], gs = o.groups || [], z = o.z || "B3";
  for (let x = x0; x < x1; x += 70 + R() * 90) { const s = 0.8 + R() * 0.6;
    out.push(K.obj(211, x, 20 * s, { ch: CH.houseC, z, zo: 0, sx: 0.25 * s, sy: 1.4 * s, groups: gs, hsv: "0a0.4a0.75a0a0" }));
    out.push(K.obj(497, x, 52 * s, { ch: CH.houseB, z, zo: 1, s: 1.05 * s, groups: gs }));
    out.push(K.obj(497, x + 9 * s, 62 * s, { ch: CH.houseB, z, zo: 2, s: 0.65 * s, groups: gs, hsv: "0a1a1.08a0a0" })); }
  return out;
}

// the play: blocks as little buildings -- key 21 rim, a deep fill (scenekit.designBlocks) with lit windows on stacks, a pale
// roof line on every open top; hazards on CH.hazard
function dressPlay(objects, x0, x1, o = {}) {
  const O = require("../../lib/objects.js"), kindOf = b => (O.objInfo(b.id) || {}).kind, out = [];
  const isBlock = b => b.id >= 1 && b.id <= 7 || b.id === 83 || b.id === 69;
  const at = new Set(objects.filter(isBlock).map(b => Math.round(b.x / 30 - 0.5) + "," + Math.round(b.y / 30 - 0.5)));
  for (const b of objects) if (b.x >= x0 && b.x < x1) {
    const k = kindOf(b); if (k !== "solid" && k !== "hazard" && k !== "slope") continue;   // slopes too: left white they matched the clouds (roles)
    b.props = b.props || {}; b.props[21] = String(k === "hazard" ? CH.hazard : CH.rim);
  }
  out.push(...K.designBlocks(objects, x0, x1, { fill: CH.fill, edge: CH.rim, win: CH.win, windows: 0.45, seed: o.seed || 3 }));
  for (const b of objects) {
    if (!isBlock(b) || b.x < x0 || b.x >= x1) continue;
    const c = Math.round(b.x / 30 - 0.5), r = Math.round(b.y / 30 - 0.5);
    if (!at.has(c + "," + (r + 1)) && r < 9) out.push(K.obj(1753, b.x, b.y + 12, { ch: CH.roof, z: "T1", zo: 5, sx: 1, sy: 1.6 }));
  }
  return out;
}

// ---- one section ----
function dress(ctx, sec) {
  const { objects } = ctx, { x0, x1 } = sec, v = VARIANTS[sec.variant] ? sec.variant : "morning", vv = VARIANTS[v], out = [], seed = (sec.i || 0) * 17 + 3;
  const gF = 570 + 4 * (sec.i || 0), gM = gF + 1, gS = gF + 2, gC = gF + 3;   // far skyline, houses, sun, clouds: this section's own
  const secs = Math.max(1, ctx.tOf(x1) - ctx.tOf(x0)), piece = sec.piece || vv.piece, energy = sec.energy ?? vv.energy, R = K.rng(seed);
  out.push(...dressPlay(objects, x0, x1, { seed }));
  out.push(...K.horizonGlow(x0 - 60, x1 + 60, { ch: CH.haze, y: 0, h: 5, z: "B5", group: G.haze }));
  // the sun, ahead of the section start so it sits upper right, carried with the player (0.97: it hardly moves)
  out.push(...sun(x0 + 300, vv.sunY, piece === "clouds" ? 45 : 38, { groups: [gS] }));
  // far skyline: pale buildings, slow parallax
  if (piece !== "clouds") out.push(...K.skyline(x0 - 200, x1 + 500, { ch: CH.far, winCh: CH.farWin, z: "B4", group: gF, hMin: piece === "park" ? 2 : 3,
    hMax: piece === "park" ? 5 : 9, wMin: 1.4, wMax: 2.8, gap: 4, seed: seed + 1, winShare: 0.35, winScale: 0.6 }));
  // nearer pastel houses (city), trees and low houses (park); none in the cloud variant
  if (piece === "city") out.push(...houses(objects, x0 - 120, x1 + 360, { seed: seed + 2, groups: [gM], z: "B3", hMin: 2, hMax: 5 }));
  if (piece === "park") { out.push(...trees(x0 - 120, x1 + 360, { seed: seed + 3, groups: [gM] })); out.push(...houses(objects, x0 + 200, x1 + 360, { seed: seed + 2, groups: [gM], z: "B3", hMin: 1, hMax: 2, gap: 160 })); }
  // clouds: two depths, high in the sky; more and bigger in the cloud variant (and a low bank under the flight)
  const cloudEvery = piece === "clouds" ? 150 : 260;
  for (let x = x0 - 100; x < x1 + 400; x += cloudEvery * (0.7 + R() * 0.6)) {
    const far = R() < 0.5;
    out.push(...cloud(x, 200 + R() * 170, (far ? 0.9 : 1.3) * (piece === "clouds" ? 1.5 : 1) * (0.8 + R() * 0.4),
      { seed: seed + x, groups: [far ? G.cloudsA : G.cloudsB, gC], z: far ? "B4" : "B3", zo: far ? 3 : 4 }));
  }
  if (piece === "clouds") for (let x = x0 - 60; x < x1 + 300; x += 70 + R() * 50) out.push(...cloud(x, -20 + R() * 25, 1.7 + R() * 0.6, { seed: seed + x + 1, groups: [G.cloudsB, gC], z: "B3", zo: 4 }));
  // birds: flocks crossing high, flying against the level (move left), wings flapping (MOTION sway on the wing groups)
  const nFlocks = Math.max(1, Math.round(secs / 4 * vv.birds));
  for (let k = 0; k < nFlocks; k++) { const fx = x0 + (k + 0.5) * (x1 - x0) / nFlocks + 200, fy = 250 + R() * 110;
    out.push(...flock(fx, fy, { seed: seed + k * 31, groups: [k % 2 ? G.birdsA : G.birdsB, G.flock], s: 0.9 + R() * 0.4 })); }
  // motion: parallax locks, clouds drifting left, birds flying left and bobbing, the sun's rays turning
  out.push(K.lockX(x0 - 30, gF, secs + 1, 0.88), K.lockX(x0 - 30, gM, secs + 1, 0.7), K.lockX(x0 - 30, gS, secs + 1, 0.97), K.lockX(x0 - 30, gC, secs + 1, 0.8));
  out.push(K.move(x0 - 60, G.cloudsA, -50, 0, secs + 1, 0), K.move(x0 - 60, G.cloudsB, -90, 0, secs + 1, 0));
  out.push(K.move(x0 - 60, G.birdsA, -300 * secs / 6, 40, secs + 1, 0), K.move(x0 - 60, G.birdsB, -360 * secs / 6, -30, secs + 1, 0));
  out.push(K.rotate(x0 - 60, G.rays, 40 * secs / 6, secs + 1, { centre: G.sun + 100 }));
  return out;
}

// motion: windows twinkle and the sun's halo pulses on the beat, clouds bob gently, the wings flap (sway) every beat
const MOTION = { pulse: [G.twinkle, G.sun], bob: [G.cloudsA, G.flock], sway: [G.wingA, G.wingB] };

module.exports = { name: "sunny", mood: "sunny: a bright day over a little city -- blue sky, pastel houses, clouds, birds, a warm sun", CH, G, VARIANTS, BLEND, HEADER,
  channelMap, palette, SONG, MODES, MOTION, dress, pieces: { cloud, sun, bird, flock, houses, trees, dressPlay } };
