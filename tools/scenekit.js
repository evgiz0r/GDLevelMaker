// Scene kit: reusable 2.2 scenery recipes for hand-built (or composed) levels. SHOWCASE.md tells what
// each looks like in a render, which numbers worked, and what is still unchecked in the game.
//
//   const K = require("./scenekit.js");
//   header = K.channels(header, { 1: { rgb: [255,120,60], blend: true }, 2: { rgb: [40,20,70] } });
//   out.push(...K.palette(x, { 1000: [40,20,70], 1: [255,120,60] }, 1.0));   // colour triggers
//   out.push(...K.skyline(x0, x1, { ch: 2, winCh: 4, group: 101, ... }));      // a city silhouette
//
// Used by a level's scene script (spec "scene": "tools/scenes/<name>.js", run by tools/make.js after
// the gameplay is placed). Every function returns plain level objects {id, x, y, rot, flipX, flipY,
// props}; x, y in GD units (30 a block, ground top y 0, centres). Layers (key 24): B5 -5, B4 -3,
// B3 -1, B2 1, B1 3, T1 5, T2 7, T3 9, T4 11 (lib/art.js; unchecked in the game, modern_look.md).
// Deco ids come from knowledge/objects/catalogue.tsv (pictures: local/catalogue/).
"use strict";
const L = { B5: -5, B4: -3, B3: -1, B2: 1, B1: 3, T1: 5, T2: 7, T3: 9, T4: 11 };
const r3 = v => String(Math.round(v * 1000) / 1000);

// a seeded random stream (same level every build)
function rng(seed) { let s = seed || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// one deco object. o: ch (main channel, key 21), ch2 (detail, 22), z (layer name or number, 24),
// zo (z order, 25), s / sx / sy (scale, 32 / 128 / 129), rot, flipX, flipY, groups ([n] -> 57),
// hsv ("h a s a v a sAdd a vAdd" -> 41 + 43), props (raw extra keys)
function obj(id, x, y, o = {}) {
  const p = { 155: "1" };
  if (o.ch != null) p[21] = String(o.ch);
  if (o.ch2 != null) p[22] = String(o.ch2);
  if (o.z != null) p[24] = String(typeof o.z === "string" ? L[o.z] : o.z);
  if (o.zo != null) p[25] = String(o.zo);
  if (o.s != null) p[32] = r3(o.s);
  if (o.sx != null) p[128] = r3(o.sx);
  if (o.sy != null) p[129] = r3(o.sy);
  if (o.groups && o.groups.length) p[57] = o.groups.join(".");
  if (o.hsv) { p[41] = "1"; p[43] = o.hsv; }
  if (o.props) Object.assign(p, o.props);
  return { id, x: +x.toFixed(2), y: +y.toFixed(2), rot: o.rot ? +o.rot.toFixed(2) : 0, flipX: !!o.flipX, flipY: !!o.flipY, props: p };
}
// a trigger (never drawn in the game). Fires when the player's x passes x.
function trig(id, x, props, y) { return { id, x: +x.toFixed(2), y: y == null ? 345 + (trig.n = ((trig.n || 0) + 1) % 12) * 30 : y, rot: 0, flipX: false, flipY: false, props: Object.assign({ 36: "1", 155: "1" }, props) }; }

// --- triggers ---
const colour = (x, ch, rgb, secs = 0.5, opacity = 1) => trig(899, x, { 23: String(ch), 7: String(rgb[0]), 8: String(rgb[1]), 9: String(rgb[2]), 10: r3(secs), 35: r3(opacity) });
// several channels at once: map {ch: [r,g,b]}
const palette = (x, map, secs = 0.5) => Object.entries(map).map(([ch, rgb]) => colour(x, +ch, rgb, secs));
const alpha = (x, group, to, secs = 0.5) => trig(1007, x, { 51: String(group), 35: r3(to), 10: r3(secs) });
// easing (key 30): 0 none, 1 ease in-out, 2 in, 3 out, ... 13 sine in-out, 14 sine in, 15 sine out (lib/vfx.js)
const move = (x, group, dx, dy, secs, ease = 0, rate = 2) => trig(901, x, { 51: String(group), 28: r3(dx), 29: r3(dy), 10: r3(secs), 30: String(ease), 85: r3(rate) });
// lock a group to the player's x for `secs`: it keeps `mul` of the player's motion (1 = stays put on
// the screen, 0.9 = a far layer drifting back slowly, 0.6 = a near one)
const lockX = (x, group, secs, mul = 1) => trig(901, x, { 51: String(group), 28: "0", 29: "0", 10: r3(secs), 58: "1", 143: r3(mul) });
const rotate = (x, group, deg, secs, o = {}) => trig(1346, x, Object.assign({ 51: String(group), 68: r3(deg % 360), 69: String(Math.trunc(deg / 360)), 10: r3(secs), 30: String(o.ease || 0) },
  o.centre ? { 71: String(o.centre) } : {}, o.lock ? { 70: "1" } : {}));
// pulse a colour channel (or a group: o.group) towards rgb: fade in, hold, fade out (s)
const pulse = (x, target, rgb, fin, hold, fout, o = {}) => trig(1006, x, { 51: String(target), 52: o.group ? "1" : "0", 7: String(rgb[0]), 8: String(rgb[1]), 9: String(rgb[2]), 45: r3(fin), 46: r3(hold), 47: r3(fout) });
const zoom = (x, to, secs = 0.5) => trig(1913, x, { 371: r3(to), 10: r3(secs) });
const toggle = (x, group, on) => trig(1049, x, { 51: String(group), 56: on ? "1" : "0" });

// --- header colour channels: kS38 entries "1_r_2_g_3_b_..._5_blend_6_channel_7_opacity" ---
// defs {ch: {rgb, blend, opacity}}; replaces the channel when the header has it already
function channels(header, defs) {
  return header.replace(/kS38,([^,]*)/, (all, list) => {
    const parts = list.split("|").filter(Boolean), keep = parts.filter(c => !(/(^|_)6_(\d+)(_|$)/.exec(c) && defs[+/(^|_)6_(\d+)(_|$)/.exec(c)[2]]));
    for (const [ch, d] of Object.entries(defs)) {
      const [r, g, b] = d.rgb;
      keep.push(`1_${r}_2_${g}_3_${b}_11_255_12_255_13_255_4_-1_6_${ch}` + (d.blend ? "_5_1" : "") + `_7_${d.opacity ?? 1}_15_1_18_0_8_1`);
    }
    return "kS38," + keep.join("|") + "|";
  });
}
// background / ground / middleground art numbers (kA6 bg, kA7 ground, kA25 middleground, kA17 line)
function art(header, a) {
  for (const [k, v] of Object.entries({ kA6: a.bg, kA7: a.ground, kA25: a.mg, kA17: a.line })) if (v != null) header = header.replace(new RegExp(k + ",\\d+"), k + "," + v);
  return header;
}

// --- scenery ---

// A city skyline between x0 and x1: buildings from the ground up (flat fills 211, scaled per axis),
// some with a stepped top or an antenna, lit windows in a grid (dots 1764 in winCh, blending), a few
// windows in `twinkle` groups for beat flicker. o: ch, winCh, z, group (all objects), hMin/hMax
// (blocks), wMin/wMax, gap (units), hsv (for shades), seed, base (y of the bottom), winShare
function skyline(x0, x1, o = {}) {
  const R = rng(o.seed || 11), out = [], gs = o.group ? [o.group] : [];
  const hMin = o.hMin ?? 3, hMax = o.hMax ?? 8, wMin = o.wMin ?? 1.5, wMax = o.wMax ?? 3, base = o.base ?? 0, z = o.z ?? "B4";
  for (let x = x0; x < x1;) {
    const w = (wMin + R() * (wMax - wMin)) * 30, h = Math.round(hMin + R() * (hMax - hMin)) * 30, cx = x + w / 2;
    out.push(obj(211, cx, base + h / 2, { ch: o.ch, z, zo: 0, sx: w / 30, sy: h / 30, groups: gs, hsv: R() < 0.5 ? o.hsv : null }));
    // a stepped crown or an antenna on some
    const roll = R();
    if (roll < 0.3) out.push(obj(211, cx, base + h + 15, { ch: o.ch, z, zo: 0, sx: w / 30 * 0.55, sy: 1, groups: gs }));
    else if (roll < 0.45) {
      out.push(obj(211, cx, base + h + 30, { ch: o.ch, z, zo: 0, sx: 0.08, sy: 2, groups: gs }));
      if (o.winCh) out.push(obj(1764, cx, base + h + 62, { ch: o.lightCh || o.winCh, z, zo: 2, s: 0.8, groups: gs.concat(o.twinkle ? [o.twinkle[0]] : []) }));
    }
    // windows: a grid with gaps, lit at random
    if (o.winCh) {
      const cols = Math.max(1, Math.floor(w / 22)), rows = Math.max(1, Math.floor((h - 20) / 24));
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        if (R() > (o.winShare ?? 0.45)) continue;
        const wx = cx - (cols - 1) * 11 + i * 22, wy = base + 18 + j * 24;
        const tw = o.twinkle && R() < 0.25 ? [o.twinkle[Math.floor(R() * o.twinkle.length)]] : [];
        out.push(obj(1764, wx, wy, { ch: o.winCh, z, zo: 1, s: o.winScale ?? 0.9, groups: gs.concat(tw), hsv: R() < 0.4 ? "-15a1a0.8a0a0" : null }));
      }
    }
    x += w + (o.gap ?? 6) + R() * 14;
  }
  return out;
}

// A soft glow band along the horizon (vertical gradients 1293 stretched wide, fading upwards).
// o: ch (blending), y (bottom), h (blocks), z, group, step (units)
function horizonGlow(x0, x1, o = {}) {
  const out = [], step = o.step ?? 120, h = o.h ?? 4;
  for (let x = x0; x < x1 + step; x += step)
    out.push(obj(1293, x, (o.y ?? 0) + h * 15, { ch: o.ch, z: o.z ?? "B5", zo: -5, sx: step / 15 * 1.05, sy: h, groups: o.group ? [o.group] : [] }));
  return out;
}

// The eclipse set piece: a sun disk (497) with a corona ring (236) and rays (1019) around it, ring
// segments (997, 998) for rotation, and a moon disk (497) over it. Returns {objects, centre} where
// the groups are: all (lock it to the screen), moon (slide it across), corona (fade in), rays (turn
// about the sun: the sun disk is in the `centre` group), rings (turn about their own centres).
// o: cx, cy, r (sun radius, units), ch {sun, moon, corona, rays, rings}, g {all, moon, corona, rays,
// rings, centre}, nRays
function eclipse(o) {
  const out = [], g = o.g, r = o.r ?? 80, d497 = 50; // d_circle_02 is 1.67 blocks = 50 units across
  const all = g.all;
  out.push(obj(497, o.cx, o.cy, { ch: o.ch.sun, z: "B5", zo: 2, s: 2 * r / d497, groups: [all, g.centre] }));
  // soft halo: rings a little larger, faint
  out.push(obj(236, o.cx, o.cy, { ch: o.ch.corona, z: "B5", zo: 1, s: 2.25 * r / d497, groups: [all, g.corona] }));
  out.push(obj(236, o.cx, o.cy, { ch: o.ch.corona, z: "B5", zo: 0, s: 2.9 * r / d497, groups: [all, g.corona], hsv: "0a1a0.55a0a0" }));
  // rays: radial, each as long as 1.2 radii, in two lengths
  const n = o.nRays ?? 16;
  for (let i = 0; i < n; i++) {
    const th = i * 360 / n, long = i % 2 === 0, len = (long ? 1.5 : 1.0) * r, sy = len / 81, R = r * 1.05 + len / 2;
    const rad = th * Math.PI / 180;
    out.push(obj(1021, o.cx + R * Math.sin(rad), o.cy + R * Math.cos(rad), { ch: o.ch.rays, z: "B5", zo: -1, rot: th, sx: long ? 0.8 : 0.6, sy, groups: [all, g.rays] }));
  }
  // ring segments, centred on the sun
  out.push(obj(997, o.cx, o.cy, { ch: o.ch.rings, z: "B4", zo: 0, s: 3.2 * r / 113, groups: [all, g.rings] }));
  out.push(obj(998, o.cx, o.cy, { ch: o.ch.rings, z: "B4", zo: 0, s: 2.7 * r / 90, groups: [all, g.rings2 || g.rings], rot: 20 }));
  // the moon, on top of the sun
  out.push(obj(497, o.cx + (o.moonDx ?? 0), o.cy + (o.moonDy ?? 0), { ch: o.ch.moon, z: "B5", zo: 5, s: 2 * r * 1.02 / d497, groups: [all, g.moon] }));
  return out;
}

// Stars: dots (1764) and a few crosses (1765) in the upper sky, split over `groups` for twinkling.
// o: ch, y0, y1, density (per 100 units), z, base (groups every star has), groups (twinkle sets)
function starfield(x0, x1, o = {}) {
  const R = rng(o.seed || 5), out = [], n = Math.round((x1 - x0) / 100 * (o.density ?? 3));
  for (let i = 0; i < n; i++) {
    const tw = o.groups ? [o.groups[i % o.groups.length]] : [];
    const big = R() < 0.12;
    out.push(obj(1764, x0 + R() * (x1 - x0), (o.y0 ?? 120) + R() * ((o.y1 ?? 300) - (o.y0 ?? 120)),
      { ch: o.ch, z: o.z ?? "B5", zo: -8, s: big ? 1.1 : 0.3 + R() * 0.5, groups: (o.base || []).concat(tw), hsv: R() < 0.35 ? (o.hsv || "200a0.6a1a0a0") : null }));
  }
  return out;
}

// A frame of clouds (art clouds 936-938) along the top and/or bottom of the view, two depths:
// behind (B2) and a faint front row (T2) at the very edge. o: ch, top (y), bottom (y), group, frontGroup
function cloudFrame(x0, x1, o = {}) {
  const R = rng(o.seed || 7), out = [], ids = [936, 937, 938];
  for (const [y, flip] of [[o.top, true], [o.bottom, false]]) {
    if (y == null) continue;
    for (let x = x0 - 40; x < x1 + 40; x += 45 + R() * 35) {
      out.push(obj(ids[Math.floor(R() * 3)], x, y + (R() - 0.5) * 24, { ch: o.ch, z: "B2", zo: 0, s: 1.6 + R() * 1.1, flipY: flip, flipX: R() < 0.5, groups: o.group ? [o.group] : [], hsv: R() < 0.5 ? "0a1a0.8a0a0" : null }));
      if (R() < 0.45) out.push(obj(ids[Math.floor(R() * 3)], x + 20, y + (flip ? 30 : -30), { ch: o.ch, z: "T2", zo: 0, s: 2 + R(), flipY: flip, groups: o.frontGroup ? [o.frontGroup] : [], hsv: "0a1a1.25a0a0" }));
    }
  }
  return out;
}

// Designed blocks: the gameplay blocks between x0 and x1 get a flat fill in front of their skin (211
// on T1, z order above), a lit edge on every open side (gridLine 1753 on the edge, blending), and on
// tall stacks windows (like buildings). o: fill, edge, win (channels), group, windows (share)
function designBlocks(objects, x0, x1, o = {}) {
  const R = rng(o.seed || 3), out = [];
  const isBlock = b => b.id >= 1 && b.id <= 7 || b.id === 1 || b.id === 83 || b.id === 69;
  const blocks = objects.filter(b => isBlock(b) && b.x >= x0 && b.x < x1);
  const at = new Set(objects.filter(b => isBlock(b) || b.id === 1338).map(b => Math.round(b.x / 30 - 0.5) + "," + Math.round(b.y / 30 - 0.5)));
  const gs = o.group ? [o.group] : [];
  // slopes (1338): a triangle fill (693, the same flips) and a lit edge along the slope
  for (const b of objects) {
    if (b.id !== 1338 || b.x < x0 || b.x >= x1) continue;
    out.push(obj(693, b.x, b.y, { ch: o.fill, z: "T1", zo: 2, flipX: b.flipX, flipY: b.flipY, rot: b.rot || 0, groups: gs }));
    out.push(obj(1753, b.x, b.y, { ch: o.edge, z: "T1", zo: 4, sx: 1.42, rot: (!!b.flipX !== !!b.flipY) ? 45 : -45, groups: gs }));
  }
  for (const b of blocks) {
    const c = Math.round(b.x / 30 - 0.5), r = Math.round(b.y / 30 - 0.5);
    out.push(obj(211, b.x, b.y, { ch: o.fill, z: "T1", zo: 2, groups: gs, hsv: (c + r) % 2 ? "0a1a0.85a0a0" : null }));
    const open = { up: !at.has(c + "," + (r + 1)) && r < 9, down: !at.has(c + "," + (r - 1)) && r > 0, left: !at.has((c - 1) + "," + r), right: !at.has((c + 1) + "," + r) };
    // the edge line: 1753 is a 1-block thin line through the cell; moved to the side
    if (open.up) out.push(obj(1753, b.x, b.y + 14, { ch: o.edge, z: "T1", zo: 4, sx: 1, groups: gs, hsv: c % 2 ? "0a0.7a1a0a0" : null }));
    if (open.down) out.push(obj(1753, b.x, b.y - 14, { ch: o.edge, z: "T1", zo: 4, groups: gs }));
    if (open.left) out.push(obj(1753, b.x - 14, b.y, { ch: o.edge, z: "T1", zo: 4, rot: 90, groups: gs }));
    if (open.right) out.push(obj(1753, b.x + 14, b.y, { ch: o.edge, z: "T1", zo: 4, rot: 90, groups: gs }));
    // a soft glow just under an open top (gradient 1293 turned over: bright at the top)
    if (open.up && o.glow) out.push(obj(1293, b.x, b.y + 3, { ch: o.glow, z: "T1", zo: 3, sx: 2, sy: 0.8, flipY: true, groups: gs }));
    // windows on inner cells of a stack
    if (o.win && !open.up && R() < (o.windows ?? 0.5)) {
      out.push(obj(1764, b.x - 7, b.y + 4, { ch: o.win, z: "T1", zo: 3, s: 0.8, groups: gs }));
      if (R() < 0.6) out.push(obj(1764, b.x + 7, b.y + 4, { ch: o.win, z: "T1", zo: 3, s: 0.8, groups: gs }));
    }
  }
  return out;
}

// Drifting motes (the level's motif particles): small dots / rings at all heights in front (T2) or
// behind, a group a `move` trigger carries upward (or anywhere) through the section.
// o: ch, z, group, density (per 100 units), y0, y1, ids
function motes(x0, x1, o = {}) {
  const R = rng(o.seed || 9), out = [], n = Math.round((x1 - x0) / 100 * (o.density ?? 2)), ids = o.ids || [1764];
  for (let i = 0; i < n; i++)
    out.push(obj(ids[Math.floor(R() * ids.length)], x0 + R() * (x1 - x0), (o.y0 ?? -60) + R() * ((o.y1 ?? 300) - (o.y0 ?? -60)),
      { ch: o.ch, z: o.z ?? "T2", zo: 0, s: (o.sMin ?? 0.3) + R() * ((o.sMax ?? 0.8) - (o.sMin ?? 0.3)), groups: o.group ? [o.group] : [], hsv: R() < 0.5 ? "30a1a1a0a0" : null }));
  return out;
}

// Light rays from above (vertical gradients 1293, long and tilted), see-through, in front of the play.
// o: ch (blending), group, z, every (units), tilt (degrees), y (top)
function lightRays(x0, x1, o = {}) {
  const R = rng(o.seed || 13), out = [];
  for (let x = x0; x < x1; x += (o.every ?? 90) + R() * 60)
    out.push(obj(1293, x, (o.y ?? 330) - 140, { ch: o.ch, z: o.z ?? "T3", zo: 0, sx: 1.2 + R() * 2.2, sy: 10, rot: (o.tilt ?? 18) + (R() - 0.5) * 8, flipY: true, groups: o.group ? [o.group] : [] }));
  return out;
}

// A frame along the top of the view: soft gradients (1293, solid at the top) side by side over a
// screen width around x, to lock to the player's x (lockX with mul 1) so it stays on the screen.
// o: ch, y (top of the frame), h (blocks), z, group, from / to (units around x, the screen is about
// -205 .. +365 from the player at zoom 1)
function topFrame(x, o = {}) {
  const out = [], h = o.h ?? 4, top = o.y ?? 260;
  for (let dx = o.from ?? -330; dx < (o.to ?? 520); dx += 58)
    out.push(obj(1293, x + dx, top - h * 15, { ch: o.ch, z: o.z ?? "T3", zo: 0, sx: 4.2, sy: h, flipY: true, groups: o.group ? [o.group] : [] }));
  return out;
}

// Text (914). In the game it uses GD's own font; our render uses a system font (only the place counts).
function text(x, y, str, scale, o = {}) {
  return obj(914, x, y, Object.assign({}, o, { s: scale, props: Object.assign({ 31: Buffer.from(str).toString("base64").replace(/\+/g, "-").replace(/\//g, "_") }, o.props || {}) }));
}

// Pulses on beats: one per beat index in `beats` (level beat numbers), via beatX
function beatPulses(beatX, beats, target, rgb, fin, hold, fout, o = {}) { return beats.map(b => pulse(beatX(b), target, rgb, fin, hold, fout, o)); }

// --- loops: motion that keeps going (GD has no loop without spawn triggers: a chain of triggers along x) ---
// Bob a group up and down: a move trigger every `every` units from x0 to x1, alternating +dy / -dy, each
// lasting `secs` (sine in-out). Start at x0 going up; the chain ends where it began (an even count).
function bob(x0, x1, group, dy, every, secs) {
  const out = []; let k = 0;
  for (let x = x0; x < x1 || k % 2; x += every, k++) out.push(move(x, group, 0, k % 2 ? -dy : dy, secs, 13));
  return out;
}
// Sway: the same with rotate triggers (each object of the group turns about its own centre, no centre group)
function sway(x0, x1, group, deg, every, secs) {
  const out = [rotate(x0, group, deg, secs, { ease: 13 })]; let k = 1, x = x0 + every, side = 1;
  for (; x < x1; x += every, k++, side = -side) out.push(rotate(x, group, -2 * deg * side, secs, { ease: 13 }));
  out.push(rotate(x, group, -deg * side, secs, { ease: 13 }));   // back to upright
  return out;
}

// --- underwater ---
// A jellyfish: a bell (disk 497 squashed), a lighter inner bell, `n` tentacles (thin lines 1753 turned
// upright) hanging under it. o: ch (bell, blend), ch2 (tentacles), s (size: bell width in blocks), z, groups
function jellyfish(x, y, o = {}) {
  const s = o.s ?? 1, gs = o.groups || [], z = o.z ?? "B2", out = [];
  out.push(obj(497, x, y, { ch: o.ch, z, zo: 3, sx: 0.6 * s, sy: 0.42 * s, groups: gs }));
  out.push(obj(497, x, y + 2 * s, { ch: o.ch, z, zo: 4, sx: 0.36 * s, sy: 0.22 * s, groups: gs, hsv: "0a0.5a1.4a0a0" }));
  const n = o.n ?? 4;
  for (let i = 0; i < n; i++) {
    const dx = (i - (n - 1) / 2) * 6 * s, len = (0.9 + (i % 2) * 0.5) * s;
    out.push(obj(1753, x + dx, y - 8 * s - len * 15, { ch: o.ch2 ?? o.ch, z, zo: 2, sx: len, rot: 90, groups: gs }));
  }
  return out;
}
// A school of small fish facing left (they swim against the level: move the group by -dx): ellipse
// bodies (497) and triangle tails (693). o: ch, n, z, group, spread (units), seed
function fishSchool(x, y, o = {}) {
  const R = rng(o.seed || 17), out = [], gs = o.group ? [o.group] : [], z = o.z ?? "B2";
  for (let i = 0; i < (o.n ?? 7); i++) {
    const fx = x + (R() - 0.5) * (o.spread ?? 140), fy = y + (R() - 0.5) * (o.spread ?? 140) * 0.45, s = 0.7 + R() * 0.5;
    out.push(obj(497, fx, fy, { ch: o.ch, z, zo: 2, sx: 0.42 * s, sy: 0.2 * s, groups: gs, hsv: R() < 0.4 ? "0a1a0.8a0a0" : null }));
    out.push(obj(693, fx + 12 * s, fy, { ch: o.ch, z, zo: 1, s: 0.32 * s, rot: 45, groups: gs }));
  }
  return out;
}
// Kelp: stalks of leaves (squashed disks 497) from the floor; every leaf is in `group` (sway it).
// o: ch, z, every (units between stalks), hMin/hMax (leaves), seed, groups (alternating sway groups)
function kelp(x0, x1, o = {}) {
  const R = rng(o.seed || 19), out = [], gsets = o.groups || [];
  let k = 0;
  for (let x = x0; x < x1; x += (o.every ?? 120) * (0.6 + R() * 0.8), k++) {
    const n = Math.round((o.hMin ?? 3) + R() * ((o.hMax ?? 6) - (o.hMin ?? 3))), gs = gsets.length ? [gsets[k % gsets.length]] : [];
    for (let j = 0; j < n; j++)
      out.push(obj(497, x + Math.sin(j * 1.3 + k) * 5, 12 + j * 22, { ch: o.ch, z: o.z ?? "B3", zo: 0, sx: 0.26, sy: 0.6, rot: (j % 2 ? 18 : -18), groups: gs, hsv: j === n - 1 ? "0a1a1.25a0a0" : null }));
  }
  return out;
}
// The water's surface seen from below: a bright band (gradient 1293, solid at the top) and a row of
// small waves (157) hanging from it, over a screen width around x (lock it to the player). o: ch, y, group
function waterSurface(x, o = {}) {
  const out = [], y = o.y ?? 230, gs = o.group ? [o.group] : [];
  for (let dx = o.from ?? -330; dx < (o.to ?? 520); dx += 58) out.push(obj(1293, x + dx, y + 30, { ch: o.ch, z: o.z ?? "B1", zo: 0, sx: 4.2, sy: 2, flipY: true, groups: gs }));
  for (let dx = o.from ?? -330; dx < (o.to ?? 520); dx += 30) out.push(obj(157, x + dx, y + 2, { ch: o.ch, z: o.z ?? "B1", zo: 1, s: 1, flipY: true, groups: gs }));
  out.push(obj(1753, x + 95, y + 14, { ch: o.ch, z: o.z ?? "B1", zo: 2, sx: 30, groups: gs }));
  return out;
}
// Rounded rocks or hills along the floor (balls 50-54 scaled), a far layer for parallax. o: ch, z, group, sMin/sMax, seed
function rocks(x0, x1, o = {}) {
  const R = rng(o.seed || 23), out = [], gs = o.group ? [o.group] : [];
  for (let x = x0; x < x1; x += (o.every ?? 110) * (0.5 + R())) {
    const s = (o.sMin ?? 2) + R() * ((o.sMax ?? 5) - (o.sMin ?? 2));
    out.push(obj((o.ids || [50, 54])[Math.floor(R() * (o.ids || [50, 54]).length)], x, s * 9 + (o.y ?? -10), { ch: o.ch, z: o.z ?? "B4", zo: 0, sx: s * (1 + R() * 0.6), sy: s, groups: gs, hsv: R() < 0.5 ? "0a1a0.85a0a0" : null }));
  }
  return out;
}

module.exports = { L, rng, obj, trig, colour, palette, alpha, move, lockX, rotate, pulse, zoom, toggle, channels, art,
  skyline, horizonGlow, topFrame, eclipse, starfield, cloudFrame, designBlocks, motes, lightRays, text, beatPulses,
  bob, sway, jellyfish, fishSchool, kelp, waterSurface, rocks };
