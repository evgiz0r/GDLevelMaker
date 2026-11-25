// THEME KIT: ice (ART.md "Theme kits"; the user's FROSTBITE brief, 2026-11-25: "Frozen landscape / Arctic / Ice caves
// [...] Ice blue, cyan, white, dark navy, and occasional purple accents [...] cold, atmospheric, slightly mysterious.
// Focus primarily on gameplay quality rather than extremely detailed decoration.")
// Blocks: a dark navy body, a light cyan rim, a white frosted top edge, a few cracks, now and then a tiny glowing crystal.
// Spikes: a pale cyan-white rim on a dark base. Backgrounds stay darker and plainer than the play (the user: "Backgrounds
// should remain darker and less detailed than the gameplay"), one per mood:
//   peaks     frozen mountains with distant snowy peaks (the entrance)
//   caves     dark blue ice caves, hanging icicles, glowing cyan crystals
//   shards    abstract frozen geometry, mirrored above and below, purple + cyan (the reversal)
//   crystal   glowing crystal formations, brighter cyan and white (the rush)
//   descent   dark navy, big frozen pillars, icicles, dimmer (the descent)
//   blizzard  a large frozen landscape and a big mountain, the most snow (the finale)
// Snow: occasional particles drifting down-left (a move trigger per section), more in the blizzard. Our own shapes:
// mountains and crystals are pairs of light triangles (693, its two flips side by side), icicles the same turned over.
// A kit = data + dress(ctx, section); format in tools/theme.js; applied by tools/scenes/theme.js (spec "theme": "ice").
"use strict";
const K = require("../scenekit.js");

// ---- channels (100-117: this kit's; space 80-97) and groups (450-469) ----
const CH = { rim: 100, fill: 101, frost: 102, glow: 103, hazard: 104, snow: 105, far: 106, farLit: 107, cap: 108, mid: 109,
  midLit: 110, crystal: 111, crack: 112, accent: 113, haze: 114 };
const G = { piece: 450, far: 451, mid: 452, snowA: 453, snowB: 454, crystals: 455, shards: 456, shards2: 457, glints: 458, haze: 459 };

// ---- palettes: one family (navy -> cyan -> white) with purple as the accent. Roles (decokit.checkRoles): the path is a
// dark navy body with a light cyan rim; hazards a near-white rim; deco near the sky's value, under the play.
const VARIANTS = {
  peaks: { mood: "a cold, clear entrance under distant peaks", energy: 0.5, piece: "range",
    bg: [34, 78, 128], ground: [10, 20, 42], line: [170, 235, 255], pathEdge: [110, 220, 255], blockFill: [12, 24, 54],
    frost: [235, 250, 255], glow: [80, 200, 255], hazardEdge: [240, 250, 255], snow: [230, 245, 255],
    far: [52, 100, 152], farLit: [70, 122, 176], cap: [134, 170, 199], mid: [26, 60, 104], midLit: [40, 82, 130],
    crystal: [90, 210, 255], crack: [40, 80, 130], accent: [150, 110, 230], haze: [120, 190, 240] },
  caves: { mood: "dark blue ice caves, icicles overhead, cyan crystals", energy: 0.7, piece: "icicles",
    bg: [8, 18, 46], ground: [3, 8, 22], line: [110, 210, 255], pathEdge: [90, 210, 255], blockFill: [16, 34, 78],
    frost: [225, 245, 255], glow: [40, 190, 255], hazardEdge: [235, 250, 255], snow: [190, 225, 255],
    far: [32, 57, 113], farLit: [34, 62, 118], cap: [50, 90, 140], mid: [42, 57, 98], midLit: [29, 60, 112],
    crystal: [40, 220, 255], crack: [40, 90, 160], accent: [120, 90, 220], haze: [30, 120, 220] },
  shards: { mood: "frozen geometry, mirrored, purple and cyan", energy: 0.8, piece: "shards",
    bg: [26, 12, 54], ground: [8, 3, 20], line: [140, 220, 255], pathEdge: [100, 225, 255], blockFill: [22, 20, 70],
    frost: [235, 240, 255], glow: [120, 120, 255], hazardEdge: [245, 235, 255], snow: [220, 210, 255],
    far: [64, 38, 120], farLit: [65, 39, 114], cap: [110, 80, 170], mid: [62, 46, 113], midLit: [70, 50, 130],
    crystal: [90, 230, 255], crack: [80, 70, 170], accent: [170, 100, 240], haze: [130, 70, 220] },
  crystal: { mood: "glowing crystals, brighter cyan and white, the rush", energy: 1, piece: "crystals",
    bg: [18, 64, 102], ground: [6, 18, 36], line: [200, 245, 255], pathEdge: [150, 240, 255], blockFill: [10, 26, 52],
    frost: [245, 252, 255], glow: [100, 230, 255], hazardEdge: [255, 255, 255], snow: [235, 250, 255],
    far: [30, 86, 130], farLit: [46, 108, 152], cap: [140, 200, 230], mid: [18, 57, 97], midLit: [60, 150, 200],
    crystal: [120, 240, 255], crack: [40, 100, 150], accent: [150, 120, 240], haze: [90, 200, 255] },
  descent: { mood: "dark navy, frozen pillars, dimmer, the descent", energy: 0.75, piece: "pillars",
    bg: [5, 10, 28], ground: [2, 4, 12], line: [110, 200, 240], pathEdge: [90, 205, 245], blockFill: [16, 30, 68],
    frost: [220, 240, 255], glow: [40, 150, 230], hazardEdge: [235, 248, 255], snow: [170, 205, 240],
    far: [37, 55, 107], farLit: [38, 59, 106], cap: [40, 70, 110], mid: [46, 60, 97], midLit: [29, 55, 105],
    crystal: [50, 190, 240], crack: [36, 70, 130], accent: [110, 80, 200], haze: [20, 80, 170] },
  blizzard: { mood: "a wide frozen landscape in a blizzard, the finale", energy: 1, piece: "mountain",
    bg: [30, 84, 124], ground: [8, 20, 40], line: [220, 248, 255], pathEdge: [140, 235, 255], blockFill: [12, 26, 56],
    frost: [255, 255, 255], glow: [110, 220, 255], hazardEdge: [255, 255, 255], snow: [240, 250, 255],
    far: [48, 104, 148], farLit: [66, 126, 170], cap: [152, 188, 211], mid: [20, 54, 92], midLit: [36, 80, 120],
    crystal: [120, 235, 255], crack: [40, 90, 140], accent: [160, 130, 240], haze: [140, 210, 250] },
};
const BLEND = { [CH.glow]: 0.55, [CH.crystal]: 0.85, [CH.haze]: 0.18 };
// header: plain background art, no middleground hills, the plain ground
const HEADER = { kA6: "1", kA7: "1", kA25: "0" };

function channelMap(v) {
  const p = VARIANTS[v] || VARIANTS.peaks, m = { 1000: p.bg, 1001: p.ground, 1002: p.line };
  for (const [k, ch] of Object.entries(CH)) m[ch] = p[k === "rim" ? "pathEdge" : k === "hazard" ? "hazardEdge" : k === "fill" ? "blockFill" : k];
  return m;
}
function palette(v) {
  const p = VARIANTS[v] || VARIANTS.peaks;
  return { bg: p.bg, ground: p.ground, line: p.line, pathEdge: p.pathEdge, blockFill: p.blockFill, hazardEdge: p.hazardEdge,
    far: p.far, mid: p.mid, near: p.midLit, body: p.blockFill };
}

// ---- song brief: cold, atmospheric, a steady drive; ~1:30 ----
const SONG = { bpm: [125, 175], dur: [80, 110], mood: "cold electronic: icy synths and bells, a steady drive, a big drop",
  energy: "an airy intro, rising, a hard drop at the middle, a darker descent, a big final build",
  want: { beatless: [0.05, 0.3], dynamic: 8 },
  words: ["ice", "frost", "frozen", "snow", "winter", "cold", "glacier", "arctic", "polar", "crystal", "blizzard", "freeze", "chill", "north", "aurora"] };
const MODES = { prefer: ["cube", "ship", "ball", "wave", "spider", "ufo"], flyShare: 0.4, gravity: "gravity flips and mirrored parts",
  speeds: ["1x", "2x"], notes: "platforms at many heights; narrow but fair corridors; mirror portals for the reversals" };

// ---- pieces (one block = 30 units) ----
// a peak: two light triangles (693 rises to the right; flipX falls), the right face darker; a snow cap on top
function peak(x, w, h, o = {}) {
  const gs = o.groups || [], z = o.z || "B4", out = [], half = w / 2, base = o.base ?? 0;
  out.push(K.obj(693, x - half / 2, base + h / 2, { ch: o.ch || CH.far, z, zo: o.zo ?? 0, sx: half / 30, sy: h / 30, groups: gs }));
  out.push(K.obj(693, x + half / 2, base + h / 2, { ch: o.lit || CH.farLit, z, zo: o.zo ?? 0, sx: half / 30, sy: h / 30, flipX: true, groups: gs }));
  if (o.cap !== false) { const ch = h * 0.28, cw = half * 0.28;
    out.push(K.obj(693, x - cw / 2, base + h - ch / 2, { ch: CH.cap, z, zo: (o.zo ?? 0) + 1, sx: cw / 30, sy: ch / 30, groups: gs }));
    out.push(K.obj(693, x + cw / 2, base + h - ch / 2, { ch: CH.cap, z, zo: (o.zo ?? 0) + 1, sx: cw / 30, sy: ch / 30, flipX: true, groups: gs, hsv: "0a1a0.85a0a0" })); }
  return out;
}
// a range of peaks along [x0, x1)
function range(x0, x1, o = {}) {
  const R = K.rng(o.seed || 3), out = [];
  for (let x = x0; x < x1;) { const w = (o.wMin ?? 150) + R() * ((o.wMax ?? 300) - (o.wMin ?? 150)), h = (o.hMin ?? 90) + R() * ((o.hMax ?? 200) - (o.hMin ?? 90));
    out.push(...peak(x + w / 2, w, h, Object.assign({}, o, { seed: R() * 1e6 })));
    x += w * (0.55 + R() * 0.35); }
  return out;
}
// a crystal: a tall narrow pair of triangles, one face lit, on a blending glow channel when `glow`
function crystal(x, y, w, h, o = {}) {
  const gs = o.groups || [], z = o.z || "B3", out = [], flipY = !!o.down;
  const cy = flipY ? y - h / 2 : y + h / 2;
  out.push(K.obj(693, x - w / 4, cy, { ch: o.ch || CH.mid, z, zo: o.zo ?? 1, sx: w / 60, sy: h / 30, flipY, groups: gs }));
  out.push(K.obj(693, x + w / 4, cy, { ch: o.lit || CH.midLit, z, zo: o.zo ?? 1, sx: w / 60, sy: h / 30, flipX: true, flipY, groups: gs }));
  return out;
}
// a cluster of crystals growing from y (up) or hanging from it (down)
function cluster(x, y, o = {}) {
  const R = K.rng(o.seed || 7), out = [], n = o.n || 3 + Math.floor(R() * 3), size = o.size ?? 1;
  for (let i = 0; i < n; i++) { const dx = (i - (n - 1) / 2) * 14 * size + (R() - 0.5) * 6, h = (30 + R() * 50) * size * (i === Math.floor(n / 2) ? 1.5 : 1);
    out.push(...crystal(x + dx, y, (12 + R() * 8) * size, h, o)); }
  return out;
}
// icicles hanging from the top of the view (y), behind the play: one big pair here and there, small ones between
function icicles(objects, x0, x1, o = {}) {
  const R = K.rng(o.seed || 11), out = [], play = playCells(objects), top = o.y ?? 330;
  for (let x = x0; x < x1; x += 26 + R() * 40) {
    const h = (o.hMin ?? 20) + R() * ((o.hMax ?? 90) - (o.hMin ?? 20));
    if (near(play, x, top - h / 2, 1.2)) continue;
    out.push(...crystal(x, top, 10 + R() * 14, h, { down: true, ch: o.ch || CH.far, lit: o.lit || CH.farLit, z: o.z || "B3", groups: o.groups || [G.far] }));
  }
  return out;
}
// frozen pillars: tall dark columns with a lit edge and a cap, far behind
function pillars(x0, x1, o = {}) {
  const R = K.rng(o.seed || 13), out = [];
  for (let x = x0 + 60; x < x1; x += 180 + R() * 160) {
    const w = 40 + R() * 30, h = 360;
    out.push(K.obj(211, x, h / 2 - 30, { ch: CH.far, z: "B4", zo: 0, sx: w / 30, sy: h / 30, groups: [G.far] }));
    out.push(K.obj(1753, x - w / 2 + 2, h / 2 - 30, { ch: CH.farLit, z: "B4", zo: 1, sx: h / 30, rot: 90, groups: [G.far] }));
    out.push(...crystal(x, 330, w * 1.1, 60 + R() * 50, { down: true, ch: CH.far, lit: CH.farLit, z: "B4", zo: 2, groups: [G.far] }));
  }
  return out;
}
// abstract frozen geometry: diamond outlines (four lines) and solid shards, mirrored about the middle of the view
function shards(objects, x0, x1, o = {}) {
  const R = K.rng(o.seed || 17), out = [], play = playCells(objects), mid = o.mid ?? 150;
  for (let x = x0; x < x1; x += 90 + R() * 110) {
    const dy = 70 + R() * 110, s = 0.8 + R() * 1.6, g = R() < 0.5 ? G.shards : G.shards2;
    for (const y of [mid + dy, mid - dy]) {
      if (near(play, x, y, 1.5)) continue;
      if (R() < 0.5) { const L = 30 * s; for (const [ax, ay, rot] of [[-1, 1, 45], [1, 1, -45], [-1, -1, -45], [1, -1, 45]])
        out.push(K.obj(1753, x + ax * L * 0.35, y + ay * L * 0.35, { ch: CH.farLit, z: "B3", zo: 1, sx: s, rot, groups: [g] })); }
      else out.push(K.obj(211, x, y, { ch: CH.far, z: "B3", zo: 0, s: s * 0.7, rot: 45, groups: [g] }));
    }
  }
  return out;
}
// snow: small dots across the view, in two sets, carried down-left over the section by move triggers (y0..y1, behind
// the play mostly; a few in front only where nothing is near)
function snow(objects, x0, x1, o = {}) {
  const R = K.rng(o.seed || 19), out = [], n = Math.round((x1 - x0) / 100 * (o.density ?? 1)), play = playCells(objects);
  for (let i = 0; i < n; i++) { const x = x0 + R() * (x1 - x0 + 300), y = (o.y0 ?? 20) + R() * ((o.y1 ?? 420) - (o.y0 ?? 20));
    const front = R() < 0.15 && !near(play, x, y, 2);
    out.push(K.obj(1764, x, y, { ch: CH.snow, z: front ? "T2" : "B2", zo: 0, s: 0.25 + R() * (front ? 0.5 : 0.35), groups: [R() < 0.5 ? G.snowA : G.snowB], hsv: R() < 0.4 ? "0a1a0.7a0a0" : null })); }
  return out;
}
// a lit haze band at the horizon (soft, blending, behind everything)
function haze(x0, x1) { return K.horizonGlow(x0 - 60, x1 + 60, { ch: CH.haze, y: 0, h: 5, z: "B5", group: G.haze }); }

// the play: a block's rim = key 21 on CH.rim; the navy fill, lit edges and tiny crystals (scenekit.designBlocks); a white
// frost line on every open top; a crack through some stacked blocks; hazards on CH.hazard
function dressPlay(objects, x0, x1, o = {}) {
  const O = require("../../lib/objects.js"), kindOf = b => (O.objInfo(b.id) || {}).kind, R = K.rng(o.seed || 5), out = [];
  const isBlock = b => b.id >= 1 && b.id <= 7 || b.id === 83 || b.id === 69;
  const at = new Set(objects.filter(isBlock).map(b => Math.round(b.x / 30 - 0.5) + "," + Math.round(b.y / 30 - 0.5)));
  for (const b of objects) if (b.x >= x0 && b.x < x1) {
    const k = kindOf(b); if (k !== "solid" && k !== "hazard") continue;
    b.props = b.props || {}; b.props[21] = String(k === "hazard" ? CH.hazard : CH.rim);
  }
  out.push(...K.designBlocks(objects, x0, x1, { fill: CH.fill, edge: CH.rim, glow: CH.glow, win: CH.crystal, windows: 0.12, seed: o.seed || 3 }));
  for (const b of objects) {
    if (!isBlock(b) || b.x < x0 || b.x >= x1) continue;
    const c = Math.round(b.x / 30 - 0.5), r = Math.round(b.y / 30 - 0.5);
    if (!at.has(c + "," + (r + 1)) && r < 9) out.push(K.obj(1753, b.x, b.y + 13, { ch: CH.frost, z: "T1", zo: 5, sx: 1, sy: 2.2 }));   // frosted top
    else if (R() < 0.22) out.push(K.obj(1753, b.x + (R() - 0.5) * 10, b.y + (R() - 0.5) * 10, { ch: CH.crack, z: "T1", zo: 3, sx: 0.5 + R() * 0.5, rot: 20 + R() * 70 }));   // a crack
  }
  return out;
}

// ---- one section ----
function dress(ctx, sec) {
  const { objects } = ctx, { x0, x1 } = sec, v = VARIANTS[sec.variant] ? sec.variant : "peaks", vv = VARIANTS[v], out = [], seed = (sec.i || 0) * 17 + 3;
  const secs = Math.max(1, ctx.tOf(x1) - ctx.tOf(x0)), piece = sec.piece || vv.piece, energy = sec.energy ?? vv.energy;
  out.push(...dressPlay(objects, x0, x1, { seed }));
  out.push(...haze(x0, x1));
  // far: the section's background, carried with the player at 0.85-0.92 (slow parallax: "subtle background movement")
  if (piece === "range" || piece === "mountain") {
    out.push(...range(x0 - 200, x1 + 600, { seed: seed + 1, groups: [G.far], z: "B5", hMin: 100, hMax: 210 }));
    if (piece === "mountain") out.push(...peak(x0 + 520, 760, 330, { groups: [G.piece], z: "B5", zo: 3, seed }));
    out.push(...range(x0 - 100, x1 + 400, { seed: seed + 2, groups: [G.mid], z: "B4", zo: 4, hMin: 40, hMax: 90, wMin: 90, wMax: 180, ch: CH.mid, lit: CH.midLit, cap: false }));
  } else if (piece === "icicles") {
    out.push(...icicles(objects, x0 - 60, x1 + 300, { seed: seed + 1 }));
    for (let x = x0 + 120; x < x1; x += 260 + (seed % 5) * 20) out.push(...cluster(x, -10, { seed: seed + x, ch: CH.mid, lit: CH.crystal, groups: [G.crystals], z: "B3" }));
  } else if (piece === "shards") {
    out.push(...shards(objects, x0, x1 + 300, { seed: seed + 1 }));
  } else if (piece === "crystals") {
    for (let x = x0 + 60; x < x1 + 300; x += 150 + (x % 7) * 10) out.push(...cluster(x, -10, { seed: seed + x, size: 1.6, ch: CH.far, lit: CH.crystal, groups: [G.crystals], z: "B4" }));
    out.push(...range(x0 - 100, x1 + 400, { seed: seed + 2, groups: [G.mid], z: "B5", hMin: 60, hMax: 140, ch: CH.far, lit: CH.farLit, cap: false }));
  } else if (piece === "pillars") {
    out.push(...pillars(x0, x1 + 300, { seed: seed + 1 }));
    out.push(...icicles(objects, x0 - 60, x1 + 300, { seed: seed + 2, hMin: 15, hMax: 60, ch: CH.mid, lit: CH.midLit, z: "B2" }));
  }
  out.push(K.lockX(x0 - 30, G.far, secs + 1, 0.9), K.lockX(x0 - 30, G.piece, secs + 1, 0.95), K.lockX(x0 - 30, G.mid, secs + 1, 0.75));
  // snow: occasional, the most in the blizzard; drifting down-left
  const dens = piece === "mountain" ? 2.2 : v === "caves" || v === "descent" ? 0.5 : 0.9;
  out.push(...snow(objects, x0, x1, { seed: seed + 5, density: dens * (0.6 + energy * 0.6) }));
  out.push(K.move(x0 - 60, G.snowA, -60, -160, secs + 1, 0), K.move(x0 - 60, G.snowB, -30, -110, secs + 1, 0));
  return out;
}

// motion: crystals and glints pulse on the beat, the shards bob, a few crystals sway
const MOTION = { pulse: [G.crystals, G.shards, G.glints], bob: [G.shards, G.shards2], sway: [G.shards2] };

// ---- helpers ----
function playCells(objects) {
  const O = require("../../lib/objects.js"), s = new Set();
  for (const b of objects) { const k = (O.objInfo(b.id) || {}).kind; if (k && k !== "decoration" && k !== "deco" && k !== "trigger") s.add(Math.floor(b.x / 30) + ":" + Math.floor(b.y / 30)); }
  return s;
}
function near(cells, x, y, r) { const c = Math.floor(x / 30), w = Math.floor(y / 30), n = Math.ceil(r);
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) if (cells.has((c + i) + ":" + (w + j))) return true; return false; }

module.exports = { name: "ice", mood: "ice: frozen peaks, ice caves, crystals; navy, cyan, white, a touch of purple", CH, G, VARIANTS, BLEND, HEADER,
  channelMap, palette, SONG, MODES, MOTION, dress, pieces: { peak, range, crystal, cluster, icicles, pillars, shards, snow, haze, dressPlay } };
