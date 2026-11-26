// Painted play blocks (DECOART.md "Blocks"): the gameplay blocks dressed as a material, not a flat fill.
// Evgeni on round 2 (2026-11-26): "The blocks are still very timid. No effects. No good texture. All single filled color.
// Very basic." So each mass of blocks gets, in front of its skins (T1, deco only, no hitbox):
//   body     one square per cell, lit from the top: warm near the open top, darker with depth, a little value noise
//   facets   1-2 turned triangles per cell, lighter or darker (a rock / crystal surface, not a grid)
//   veins    glowing cracks: random walks from the top surface down through the mass (thin turned squares on a
//            blending channel, a wider soft glow under them), in a group that pulses with the level's beat pulses
//   edges    a hot rim on open tops, dim lines on open sides, a dark band under open bottoms
//   shadow   a dark see-through copy of each edge cell, offset away from the light (B1, behind the play)
//   embers   small dots over open tops, drifting up through the stretch
// Nothing new near the lane reads as a hazard: no drips under blocks, no dark triangles outside the blocks.
//   const BA = require("./blockart.js");
//   const { objects, channels, removed } = BA.rock(level, x0, x1, { seed, ch0: 900, pal: BA.PAL.lava, veinGroup: 532 });
"use strict";
const K = require("./scenekit.js"), O = require("../lib/objects.js");

const PAL = {
  lava: { top: [92, 28, 26], deep: [18, 5, 9], facetHi: [200, 90, 60], facetLo: [10, 2, 6], vein: [255, 130, 30], veinGlow: [255, 70, 10],
    rim: [255, 170, 70], side: [150, 50, 30], under: [12, 2, 4], shadow: [0, 0, 0], ember: [255, 150, 60] },
  ice: { top: [110, 170, 220], deep: [14, 28, 60], facetHi: [200, 235, 255], facetLo: [8, 16, 40], vein: [120, 230, 255], veinGlow: [40, 140, 255],
    rim: [230, 250, 255], side: [90, 150, 210], under: [6, 10, 24], shadow: [0, 0, 10], ember: [220, 245, 255] },
};
const isBlock = b => (b.id >= 1 && b.id <= 7) || b.id === 83 || b.id === 69 || b.id === 40 && false;

function rock(level, x0, x1, o = {}) {
  const R = K.rng(o.seed || 5), pal = o.pal || PAL.lava, ch0 = o.ch0 || 900, out = [];
  const CH = { body: ch0, facet: ch0 + 1, vein: ch0 + 2, veinGlow: ch0 + 3, rim: ch0 + 4, side: ch0 + 5, under: ch0 + 6, shadow: ch0 + 7, ember: ch0 + 8 };
  const channels = {
    [CH.body]: { rgb: pal.top }, [CH.facet]: { rgb: pal.facetHi, opacity: 0.22 }, [CH.vein]: { rgb: pal.vein, blend: true },
    [CH.veinGlow]: { rgb: pal.veinGlow, blend: true, opacity: 0.35 }, [CH.rim]: { rgb: pal.rim, blend: true }, [CH.side]: { rgb: pal.side, opacity: 0.8 },
    [CH.under]: { rgb: pal.under, opacity: 0.8 }, [CH.shadow]: { rgb: pal.shadow, opacity: 0.45 }, [CH.ember]: { rgb: pal.ember, blend: true } };
  const gVein = o.veinGroup || 1110, gEmber = o.emberGroup || 1111;
  // the old flat dressing of the stretch's blocks (designBlocks: fill 211, edge lines 1753, glow 1293 on T1) goes
  const T1 = "5", old = new Set([211, 1753, 1293]);
  const before = level.objects.length;
  level.objects = level.objects.filter(b => !(old.has(b.id) && b.x >= x0 - 15 && b.x < x1 + 15 && b.props && String(b.props[24]) === T1));
  const removed = before - level.objects.length;
  const cells = new Map();
  for (const b of level.objects) if (isBlock(b)) cells.set(Math.round(b.x / 30 - 0.5) + "," + Math.round(b.y / 30 - 0.5), b);
  const has = (c, r) => cells.has(c + "," + r);
  const hsvV = (base, want) => { // value (and a little hue) from the base colour to want, as GD's HSV multipliers
    const PF = require("../lib/paintfit.js"), a = PF.rgb2hsv(base), b = PF.rgb2hsv(want);
    let dh = b[0] - a[0]; if (dh > 180) dh -= 360; if (dh < -180) dh += 360;
    return `${Math.round(dh)}a${(a[1] > 0.02 ? Math.min(2, b[1] / a[1]) : 1).toFixed(2)}a${(a[2] > 0.02 ? Math.min(2, b[2] / a[2]) : 1).toFixed(2)}a0a0`; };
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const mine = [...cells.entries()].filter(([, b]) => b.x >= x0 && b.x < x1);
  for (const [key, b] of mine) {
    const [c, r] = key.split(",").map(Number);
    let depth = 0; while (has(c, r + depth + 1) && depth < 6) depth++;            // cells of block above this one
    const t = Math.min(1, depth / 2.2), v = 0.88 + R() * 0.24;
    out.push(K.obj(211, b.x, b.y, { ch: CH.body, z: "T1", zo: 6, hsv: hsvV(pal.top, mix(pal.top, pal.deep, t).map(q => q * v)) }));
    for (let k = 0, n = 1 + (R() < 0.5 ? 1 : 0); k < n; k++) {
      const s = 0.45 + R() * 0.5, hi = R() < 0.55 - t * 0.3;
      out.push(K.obj(693, b.x + (R() - 0.5) * 30 * (1 - s), b.y + (R() - 0.5) * 30 * (1 - s), { ch: CH.facet, z: "T1", zo: 7, sx: s, sy: s * (0.6 + R() * 0.8),
        rot: 90 * Math.floor(R() * 4), flipX: R() < 0.5, hsv: hi ? null : hsvV(pal.facetHi, pal.facetLo) }));
    }
    const open = { up: !has(c, r + 1), down: !has(c, r - 1) && r > 0, left: !has(c - 1, r), right: !has(c + 1, r) };
    if (open.up) {
      out.push(K.obj(211, b.x, b.y + 13.5, { ch: CH.rim, z: "T1", zo: 10, sx: 1, sy: 0.1 }));
      out.push(K.obj(211, b.x, b.y + 9, { ch: CH.veinGlow, z: "T1", zo: 9, sx: 1, sy: 0.3 }));
      if (R() < 0.35) out.push(K.obj(1764, b.x + (R() - 0.5) * 24, b.y + 22 + R() * 30, { ch: CH.ember, z: "B1", zo: 2, s: 0.2 + R() * 0.25, groups: [gEmber] }));
    }
    if (open.down) out.push(K.obj(211, b.x, b.y - 12, { ch: CH.under, z: "T1", zo: 9, sx: 1, sy: 0.2 }));
    if (open.left) out.push(K.obj(211, b.x - 14, b.y, { ch: CH.side, z: "T1", zo: 9, sx: 0.07, sy: 1 }));
    if (open.right) out.push(K.obj(211, b.x + 14, b.y, { ch: CH.side, z: "T1", zo: 9, sx: 0.07, sy: 1, hsv: "0a1a0.7a0a0" }));
    if (open.down || open.left) out.push(K.obj(211, b.x - 5, b.y - 5, { ch: CH.shadow, z: "B1", zo: -2 }));
  }
  // veins: from some open-top cells, a crooked walk down (and sideways) through the mass
  const tops = mine.filter(([k]) => { const [c, r] = k.split(",").map(Number); return !has(c, r + 1) && has(c, r - 1); });
  for (const [k] of tops) {
    if (R() > (o.veins ?? 0.3)) continue;
    let [c, r] = k.split(",").map(Number), px = c * 30 + 15 + (R() - 0.5) * 14, py = r * 30 + 24;
    for (let step = 0; step < 6; step++) {
      const moves = [[0, -1], [0, -1], [0, -1], [-1, -1], [1, -1], [1, 0]].filter(([dc, dr]) => has(c + dc, r + dr));
      if (!moves.length) break;
      const [dc, dr] = moves[Math.floor(R() * moves.length)]; c += dc; r += dr;
      const nx = c * 30 + 15 + (R() - 0.5) * 12, ny = r * 30 + 15 + (R() - 0.5) * 10, len = Math.hypot(nx - px, ny - py), ang = -Math.atan2(ny - py, nx - px) * 180 / Math.PI;
      out.push(K.obj(211, (px + nx) / 2, (py + ny) / 2, { ch: CH.veinGlow, z: "T1", zo: 8, sx: (len + 4) / 30, sy: 0.2, rot: ang, groups: [gVein] }));
      out.push(K.obj(211, (px + nx) / 2, (py + ny) / 2, { ch: CH.vein, z: "T1", zo: 9, sx: (len + 1) / 30, sy: 0.05, rot: ang, groups: [gVein] }));
      px = nx; py = ny;
      if (R() < 0.3) break;
    }
  }
  // embers drift up over the stretch (one move; the beat pulses of the vein group come from the level's own triggers)
  if (o.secs) out.push(K.move(x0 + 20, gEmber, 0, 120, o.secs, 0));
  return { objects: out, channels, removed, CH };
}

module.exports = { rock, PAL };
