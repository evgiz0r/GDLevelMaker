// THEME KIT: fire (ART.md "Theme kits"; built 2026-11-25 from the user's picks on the deco gallery -- tools/decogallery.js,
// the phone viewer's "deco" page; the user: "continue with your picks"):
//   blocks       obsidian bodies, a hot lava rim, a soft glow under open tops, molten seams through deep cells (gallery blocks 3)
//   spikes       plain, crisp, near-white (gallery spikes 1), a few sparks around some of them, never in the lane (spikes 5)
//   background   two ranges of dark rock (gallery background 2: far lighter than near), a low lava haze; quiet extras:
//                embers rising (background 6), hanging chains now and then high up (fire 5), faint light rays
// Rules kept: the play stays visible (nothing in front of the lane, hazards the brightest thing); the background never reads
// as solid (no lit-rim squares behind the play, ranges darker and softer than the path); quiet stretches between busy ones
// (the chains and rays only every few screens). Variants: molten (the default), inferno (hotter, the drops), ash (cooling,
// the ending). Not used (the review): thorn pits (black blobs on dark ground), flat scaled arch props, thorns on tops.
// Format: tools/theme.js; applied by tools/scenes/theme.js (spec "theme": "fire").
"use strict";
const K = require("../scenekit.js"), D = require("../decokit.js"), ICE = require("./ice.js");
const I = ICE.pieces;

// ---- channels 120-134 (ice 100-114, space 80-97) and groups 530-549 (per-section parallax 550-609) ----
const CH = { rim: 120, fill: 121, crust: 122, glow: 123, hazard: 124, ember: 125, far: 126, farLit: 127, mid: 128,
  midLit: 129, seam: 130, chain: 131, haze: 132, ray: 133 };
const G = { embersA: 530, embersB: 531, seams: 532, chains: 533, rays: 534, sparks: 535, haze: 536 };

const VARIANTS = {
  molten: { mood: "a dark volcanic land, lava light from below", energy: 0.6,
    bg: [40, 10, 14], ground: [16, 4, 6], line: [255, 120, 40], pathEdge: [255, 110, 30], blockFill: [22, 8, 10],
    crust: [255, 170, 60], glow: [255, 70, 0], hazardEdge: [255, 235, 210], ember: [255, 150, 60],
    far: [110, 36, 34], farLit: [134, 48, 38], mid: [80, 24, 24], midLit: [104, 34, 28],
    seam: [255, 120, 20], chain: [90, 30, 30], haze: [200, 40, 10], ray: [255, 120, 60] },
  inferno: { mood: "the drop: hotter, brighter rims, a storm of embers", energy: 1,
    bg: [60, 12, 10], ground: [22, 5, 4], line: [255, 170, 60], pathEdge: [255, 150, 40], blockFill: [26, 8, 8],
    crust: [255, 210, 90], glow: [255, 110, 10], hazardEdge: [255, 245, 225], ember: [255, 190, 80],
    far: [128, 42, 32], farLit: [158, 58, 36], mid: [92, 27, 22], midLit: [122, 38, 26],
    seam: [255, 170, 40], chain: [110, 36, 30], haze: [230, 70, 10], ray: [255, 160, 80] },
  ash: { mood: "cooling: grey-red ash, dim embers (the ending)", energy: 0.35,
    bg: [34, 22, 24], ground: [14, 9, 10], line: [220, 120, 90], pathEdge: [230, 110, 70], blockFill: [20, 12, 13],
    crust: [210, 150, 120], glow: [200, 70, 30], hazardEdge: [245, 235, 230], ember: [210, 130, 90],
    far: [84, 58, 58], farLit: [102, 70, 68], mid: [62, 41, 43], midLit: [80, 52, 50],
    seam: [220, 110, 50], chain: [70, 48, 48], haze: [140, 60, 40], ray: [220, 140, 110] },
};
const BLEND = { [CH.glow]: 0.6, [CH.seam]: 0.9, [CH.haze]: 0.3, [CH.ray]: 0.18 };
const HEADER = { kA6: "1", kA7: "1", kA25: "0" };

function channelMap(v) {
  const p = VARIANTS[v] || VARIANTS.molten, m = { 1000: p.bg, 1001: p.ground, 1002: p.line, 1013: p.blockFill, 1014: p.ground };   // middleground: dark (undefined it drew lilac hills)
  for (const [k, ch] of Object.entries(CH)) m[ch] = p[k === "rim" ? "pathEdge" : k === "hazard" ? "hazardEdge" : k === "fill" ? "blockFill" : k];
  return m;
}
function palette(v) {
  const p = VARIANTS[v] || VARIANTS.molten;
  return { bg: p.bg, ground: p.ground, line: p.line, pathEdge: p.pathEdge, blockFill: p.blockFill, hazardEdge: p.hazardEdge,
    far: p.far, mid: p.mid, near: p.midLit, body: p.blockFill };
}

const SONG = { bpm: [130, 180], dur: [70, 110], mood: "hard, driving electronic: heavy bass, distorted leads, a big drop",
  energy: "a dark build, a hard drop, a relentless middle, a cooling end", want: { beatless: [0.03, 0.2], dynamic: 9 },
  words: ["fire", "flame", "inferno", "hell", "lava", "magma", "burn", "ember", "blaze", "volcano", "heat", "ash", "demon", "infernal"] };
const MODES = { prefer: ["cube", "ship", "wave", "ball", "robot"], flyShare: 0.35, gravity: "few flips; drops and tight corridors",
  speeds: ["1x", "2x", "3x"], notes: "heavier, faster sections; caverns for the flying parts" };

function playCells(objects) {
  const O = require("../../lib/objects.js"), s = new Set();
  for (const b of objects) { const k = (O.objInfo(b.id) || {}).kind; if (k && k !== "decoration" && k !== "deco" && k !== "trigger") s.add(Math.floor(b.x / 30) + ":" + Math.floor(b.y / 30)); }
  return s;
}
function near(cells, x, y, r) { const c = Math.floor(x / 30), w = Math.floor(y / 30), n = Math.ceil(r);
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) if (cells.has((c + i) + ":" + (w + j))) return true; return false; }

// the play: rim + hazard colours, obsidian bodies with lit edges and a glow under open tops, molten seams in deep cells
function dressPlay(objects, x0, x1, o = {}) {
  const O = require("../../lib/objects.js"), kindOf = b => (O.objInfo(b.id) || {}).kind, R = K.rng(o.seed || 7), out = [];
  for (const b of objects) if (b.x >= x0 && b.x < x1) {
    const k = kindOf(b); if (k !== "solid" && k !== "hazard" && k !== "slope") continue;
    b.props = b.props || {}; b.props[21] = String(k === "hazard" ? CH.hazard : CH.rim);
  }
  out.push(...K.designBlocks(objects, x0, x1, { fill: CH.fill, edge: CH.rim, glow: CH.glow, seed: o.seed || 3 }));
  const isBlock = b => b.id >= 1 && b.id <= 7 || b.id === 83 || b.id === 69;
  const at = new Set(objects.filter(isBlock).map(b => Math.round(b.x / 30 - 0.5) + "," + Math.round(b.y / 30 - 0.5)));
  for (const b of objects) {
    if (!isBlock(b) || b.x < x0 || b.x >= x1) continue;
    const c = Math.round(b.x / 30 - 0.5), r = Math.round(b.y / 30 - 0.5);
    const deep = at.has(c + "," + (r + 1)) && at.has(c + "," + (r - 1)) && at.has((c - 1) + "," + r) && at.has((c + 1) + "," + r);
    if (deep && R() < 0.2) out.push(K.obj(1753, b.x, b.y, { ch: CH.seam, z: "T1", zo: 4, sx: 0.7 + R() * 0.6, rot: R() * 180, groups: [G.seams] }));
  }
  return out;
}
// sparks: a few small dots around some spikes, behind, never above the lane's middle (they sit low and to the sides)
function sparks(objects, x0, x1, o = {}) {
  const O = require("../../lib/objects.js"), R = K.rng(o.seed || 11), out = [];
  for (const h of objects) {
    if (h.x < x0 || h.x >= x1 || (O.objInfo(h.id) || {}).kind !== "hazard" || R() > (o.share ?? 0.4)) continue;
    for (let k = 0; k < 3; k++) { const a = R() * Math.PI, d = 26 + R() * 14;
      out.push(K.obj(1764, h.x + Math.cos(a) * d, h.y + 4 + Math.sin(a) * d * 0.5, { ch: CH.ember, z: "B1", zo: 1, s: 0.16 + R() * 0.14, groups: [G.sparks] })); }
  }
  return out;
}
// chains hanging from the top of the view, high and dark, only where no play is near (a quiet extra)
function chains(objects, x0, x1, o = {}) {
  const R = K.rng(o.seed || 21), out = [], play = playCells(objects);
  for (let x = x0 + 120; x < x1; x += (o.every ?? 520) + R() * 200) {
    const n = 2 + Math.floor(R() * 3); if ([...Array(n)].some((_, k) => near(play, x, 330 - k * 62, 2))) continue;
    for (let k = 0; k < n; k++) out.push(K.obj(106, x, 330 - k * 62, { ch: CH.chain, z: "B2", zo: 0, groups: [G.chains] }));
  }
  return out;
}

// ridges: ice's peak range in rock colours, lower, with gaps (whole peaks dropped) so it never reads as a solid wall
// (kit renders 2026-11-26: the molten ranges filled most of the lower screen)
function ridges(x0, x1, o) {
  const R = K.rng((o.seed || 1) + 99), all = I.range(x0, x1, o), out = [];
  for (let i = 0; i + 1 < all.length; i += 2) if (R() > (o.drop ?? 0.4)) out.push(all[i], all[i + 1]);
  return out;
}

function dress(ctx, sec) {
  const { objects } = ctx, { x0, x1 } = sec, v = VARIANTS[sec.variant] ? sec.variant : "molten", vv = VARIANTS[v], out = [], seed = (sec.i || 0) * 17 + 5;
  const gF = 550 + 3 * (sec.i || 0), gM = gF + 1, secs = Math.max(1, ctx.tOf(x1) - ctx.tOf(x0)), energy = sec.energy ?? vv.energy;
  out.push(...dressPlay(objects, x0, x1, { seed }));
  out.push(...sparks(objects, x0, x1, { seed, share: 0.25 + energy * 0.3 }));
  // two ranges of rock (ice's peak shapes in rock colours, no snow caps), carried with the player (slow parallax)
  out.push(...ridges(x0 - 200, x1 + 600, { seed: seed + 1, groups: [gF], z: "B5", hMin: 60, hMax: 140, ch: CH.far, lit: CH.farLit, cap: false, drop: 0.4 }));
  out.push(...ridges(x0 - 100, x1 + 400, { seed: seed + 2, groups: [gM], z: "B4", zo: 4, hMin: 25, hMax: 60, wMin: 90, wMax: 180, ch: CH.mid, lit: CH.midLit, cap: false, drop: 0.5 }));
  out.push(K.lockX(x0 - 30, gF, secs + 1, 0.9), K.lockX(x0 - 30, gM, secs + 1, 0.75));
  out.push(...K.horizonGlow(x0 - 60, x1 + 60, { ch: CH.haze, y: 0, h: 5, z: "B5", group: G.haze }));
  // embers rising (two sets, carried up and a little back over the section)
  out.push(...K.motes(x0, x1 + 300, { ch: CH.ember, group: G.embersA, density: 0.6 + energy, z: "B2", seed: seed + 3, y0: -40, y1: 320, sMin: 0.2, sMax: 0.5 }));
  out.push(K.move(x0 - 60, G.embersA, -40, 180, secs + 1, 0));
  // quiet extras: chains high up every few screens, a few faint rays in the hot variants
  if (energy >= 0.5) out.push(...chains(objects, x0, x1, { seed: seed + 4, every: energy >= 0.9 ? 420 : 620 }));
  if (energy >= 0.6) out.push(...K.lightRays(x0 + 200, x1, { ch: CH.ray, group: G.rays, every: 420, z: "B3", seed: seed + 5 }));
  return out;
}

const MOTION = { pulse: [G.seams, G.sparks], bob: [G.chains], sway: [] };

module.exports = { name: "fire", mood: "fire: obsidian and lava, dark rock ranges, embers; black, red, orange, a touch of gold", CH, G, VARIANTS,
  BLEND, HEADER, channelMap, palette, SONG, MODES, MOTION, dress, pieces: { dressPlay, sparks, chains } };
