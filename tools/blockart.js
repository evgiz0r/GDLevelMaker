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


// --- layered: the block built the way GD creators teach it (DECOART.md "Block design", Evgeni's six steps) ---
// base   2-3 colours of one palette in patches (a hue-shifted variant, a darker one), the top row lighter
// texture a low-opacity brick pattern + a few big low-contrast blended squares (break up flat space)
// line   a bright outline on every open edge, and a black INLINE a fixed distance inside it, corners closed
// light  a low-opacity blending glow under the top edge, a dark glow over the bottom edge; the black inline is in
//        front of the glow (the tutorials: lines behind glow are wasted)
// detail small bright bits (high contrast = small) in some inner cells
// 3D     one direction for every edge (up-right, d units), darker than the base, behind the block (B1), with the
//        corner triangles that close the extrusion and a dim rim on its outer top edge
const LPAL = {
  lava: { a: [74, 20, 24], b: [70, 18, 52], c: [38, 9, 13], line: [255, 140, 50], inline: [0, 0, 0], glowTop: [255, 100, 30],
    glowBot: [0, 0, 0], tex: [0, 0, 0], big: [255, 90, 40], detail: [255, 215, 140], d3: [26, 5, 9], d3rim: [140, 45, 25] },
  ice: { a: [40, 80, 130], b: [60, 60, 140], c: [18, 34, 70], line: [180, 240, 255], inline: [0, 0, 10], glowTop: [120, 210, 255],
    glowBot: [0, 0, 10], tex: [0, 0, 10], big: [120, 200, 255], detail: [235, 250, 255], d3: [10, 18, 40], d3rim: [80, 140, 200] },
};
function layered(level, x0, x1, o = {}) {
  const R = K.rng(o.seed || 5), pal = o.pal || LPAL.lava, ch0 = o.ch0 || 900, out = [], d = o.depth3d ?? 8;
  const names = ["a", "b", "c", "line", "inline", "glowTop", "glowBot", "tex", "big", "detail", "d3", "d3rim"];
  const CH = {}; names.forEach((n, i) => CH[n] = ch0 + i);
  const op = { glowTop: 0.32, glowBot: 0.45, tex: 0.2, big: 0.1 }, blend = { glowTop: 1, big: 1, detail: 1 };
  const channels = {}; for (const n of names) channels[CH[n]] = Object.assign({ rgb: pal[n] }, op[n] != null ? { opacity: op[n] } : {}, blend[n] ? { blend: true } : {});
  const T1 = "5", old = new Set([211, 1753, 1293]);
  const before = level.objects.length;
  level.objects = level.objects.filter(b => !(old.has(b.id) && b.x >= x0 - 15 && b.x < x1 + 15 && b.props && String(b.props[24]) === T1));
  const removed = before - level.objects.length;
  const cells = new Map();
  for (const b of level.objects) if (isBlock(b)) cells.set(Math.round(b.x / 30 - 0.5) + "," + Math.round(b.y / 30 - 0.5), b);
  const has = (c, r) => cells.has(c + "," + r);
  const mine = [...cells.entries()].filter(([, b]) => b.x >= x0 && b.x < x1);
  // colour patches: a coarse value noise over 3x2-cell blocks picks a / b / c
  const pn = new Map(), patch = (c, r) => { const k = Math.floor(c / 3) + "," + Math.floor(r / 2); if (!pn.has(k)) pn.set(k, R()); return pn.get(k); };
  const strip = (x, y, w, h, ch, zo, z = "T1", extra = {}) => out.push(K.obj(211, x, y, Object.assign({ ch, z, zo, sx: w / 30, sy: h / 30 }, extra)));
  const LW = 2.4, IW = 1.8, IN = 6;   // outline width, inline width, inline distance from the edge
  for (const [key, b] of mine) {
    const [c, r] = key.split(",").map(Number), X = c * 30, Y = r * 30, cx = X + 15, cy = Y + 15;
    const open = { up: !has(c, r + 1), down: !has(c, r - 1) && r > 0, left: !has(c - 1, r), right: !has(c + 1, r) };
    // base
    const p = patch(c, r), base = p < 0.55 ? "a" : p < 0.82 ? "b" : "c", v = (open.up ? 1.25 : 1) * (0.92 + R() * 0.16);
    out.push(K.obj(211, cx, cy, { ch: CH[base], z: "T1", zo: 4, hsv: `0a1a${v.toFixed(2)}a0a0` }));
    // texture: bricks (two rows per cell, the joints staggered)
    strip(cx, Y + 15, 30, 1.2, CH.tex, 5);
    const j = (r % 2) ? 7 : 22; strip(X + j, Y + 22.5, 1.2, 15, CH.tex, 5); strip(X + (j + 15) % 30, Y + 7.5, 1.2, 15, CH.tex, 5);
    if (R() < 0.12) out.push(K.obj(211, cx + (R() - 0.5) * 10, cy + (R() - 0.5) * 10, { ch: CH.big, z: "T1", zo: 5, s: 0.8 + R() * 0.6, rot: 45 }));
    // light: glow inside the top edge, dark inside the bottom edge
    if (open.up) { strip(cx, Y + 30 - 6, 30, 12, CH.glowTop, 6); strip(cx, Y + 30 - 3, 30, 6, CH.glowTop, 6); }
    if (open.down) strip(cx, Y + 6, 30, 12, CH.glowBot, 6);
    // outline (bright) on open edges
    if (open.up) strip(cx, Y + 30 - LW / 2, 30, LW, CH.line, 8);
    if (open.down) strip(cx, Y + LW / 2, 30, LW, CH.line, 8);
    if (open.left) strip(X + LW / 2, cy, LW, 30, CH.line, 8);
    if (open.right) strip(X + 30 - LW / 2, cy, LW, 30, CH.line, 8);
    // inline (black, in front of the glow): runs along each open edge IN units inside, stops at the inline of a crossing edge
    const xa = X + (open.left ? IN : 0), xb = X + 30 - (open.right ? IN : 0), ya = Y + (open.down ? IN : 0), yb = Y + 30 - (open.up ? IN : 0);
    if (open.up) strip((xa + xb) / 2, Y + 30 - IN, xb - xa + IW, IW, CH.inline, 9);
    if (open.down) strip((xa + xb) / 2, Y + IN, xb - xa + IW, IW, CH.inline, 9);
    if (open.left) strip(X + IN, (ya + yb) / 2, IW, yb - ya + IW, CH.inline, 9);
    if (open.right) strip(X + 30 - IN, (ya + yb) / 2, IW, yb - ya + IW, CH.inline, 9);
    // details: small and bright, only in some inner cells
    if (!open.up && !open.left && !open.right && R() < 0.14) {
      const dx = cx + (R() - 0.5) * 12, dy = cy + (R() - 0.5) * 12;
      if (R() < 0.5) out.push(K.obj(1764, dx, dy, { ch: CH.detail, z: "T1", zo: 10, s: 0.35 }));
      else { strip(dx, dy, 6, 2, CH.detail, 10); strip(dx + 4, dy + 2, 2, 6, CH.detail, 10); }
    }
    // 3D: the cell moved by (d, d) behind the block, and the two corner triangles of the sweep
    out.push(K.obj(211, cx + d, cy + d, { ch: CH.d3, z: "B1", zo: 1 }));
    if (open.up && !has(c + 1, r + 1)) strip(cx + d, Y + 30 + d - 0.8, 30, 1.6, CH.d3rim, 2, "B1");
    if (open.up && open.left) out.push(K.obj(693, X + d / 2, Y + 30 + d / 2, { ch: CH.d3, z: "B1", zo: 1, sx: d / 30, sy: d / 30 }));
    if (open.right && (open.down || r === 0)) out.push(K.obj(693, X + 30 + d / 2, Y + d / 2, { ch: CH.d3, z: "B1", zo: 1, sx: d / 30, sy: d / 30, rot: 180 }));
  }
  if (o.secs) { for (const [k, b] of mine) { const [c, r] = k.split(",").map(Number); if (!has(c, r + 1) && R() < 0.3) out.push(K.obj(1764, b.x + (R() - 0.5) * 24, b.y + 22 + R() * 30, { ch: CH.detail, z: "B1", zo: 2, s: 0.2 + R() * 0.2, groups: [o.emberGroup || 1111] })); }
    out.push(K.move(x0 + 20, o.emberGroup || 1111, 0, 120, o.secs, 0)); }
  return { objects: out, channels, removed, CH };
}

module.exports = { rock, layered, PAL, LPAL };
