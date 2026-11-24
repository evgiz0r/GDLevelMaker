// The deco library (ART.md "Deco library"): section-by-section dressing that brings a level from ~10 to the ~35-40
// objects per block real levels carry (knowledge/levels/modern_look.md; ART.md "Deco study"), as our own
// compositions. Each function takes the level's objects (to read the play blocks) or a range, and returns DECO
// objects only (no hitboxes), on the caller's colour channels; HSV variants shade one channel. Use it from a scene
// script (tools/scenes/*.js) per section:
//   const D = require("../decokit.js");
//   out.push(...D.blockPattern(objects, x0, x1, { ch: C.fill, top: 32, seed }));   // inside the play blocks + top trims
//   out.push(...D.backdrop(x0, x1, { far: 33, mid: 34, near: 35, seed }));          // three depths behind the play
//   out.push(...D.tufts(objects, x0, x1, { ch: 36, seed }));                       // low grass in front, clear of hazards
// motion(x0, x1, {beat, spb, energy, pulse, bob, sway}) puts the triggers; midTone(hue) gives a mid-tone palette.
// Pieces: 211 (plain square, scaled per axis), 693 (triangle), the prop library (lib/props.js) as one-colour silhouettes.
// Rules: nothing in front of a hazard; front pieces (T2) stay low and small; backdrop on B3-B5, darker / paler with
// distance; every piece on a channel the caller owns. Readability: tools/contrast.js; density: tools/decostudy.js.
"use strict";
const K = require("./scenekit.js"), P = require("../lib/props.js"), O = require("../lib/objects.js");
const kind = o => (O.objInfo(o.id) || {}).kind;
const cellOf = o => [Math.round(o.x / 30 - 0.5), Math.round(o.y / 30 - 0.5)];

// Inside the play blocks: a running-bond brick pattern on closed cells (two half-bricks a shade darker), a lit top
// trim (a thin band + two small triangles: grass / sand / snow) on open-top cells, a few specks. ~2-4 per cell.
function blockPattern(objects, x0, x1, o = {}) {
  const R = K.rng(o.seed || 41), out = [], gs = o.group ? [o.group] : [];
  const solids = objects.filter(b => kind(b) === "solid" && (b.id <= 7 || b.id === 83 || b.id === 69 || b.id === 1) && b.x >= x0 && b.x < x1 && !(b.props || {})[128]);
  const at = new Set(objects.filter(b => kind(b) === "solid").map(b => cellOf(b).join(",")));
  const haz = new Set(objects.filter(b => kind(b) === "hazard").map(b => cellOf(b).join(",")));
  for (const b of solids) {
    const [c, r] = cellOf(b), openUp = !at.has(c + "," + (r + 1)) && !haz.has(c + "," + (r + 1));
    if (openUp && o.top != null) {
      out.push(K.obj(211, b.x, b.y + 12.5, { ch: o.top, z: "T1", zo: 5, sx: 1, sy: 0.17, groups: gs }));
      for (const dx of [-8, 6]) if (R() < 0.8) out.push(K.obj(693, b.x + dx + (R() - 0.5) * 4, b.y + 17, { ch: o.top, z: "T1", zo: 5, s: 0.22 + R() * 0.12, rot: 45, groups: gs, hsv: R() < 0.5 ? "0a1a1.15a0a0" : null }));
    } else if (!openUp && o.ch != null) {
      const off = r % 2 ? 7.5 : -7.5;
      out.push(K.obj(211, b.x + off, b.y + 6, { ch: o.ch, z: "T1", zo: 3, sx: 0.42, sy: 0.33, groups: gs, hsv: "0a1a0.78a0a0" }));
      out.push(K.obj(211, b.x - off, b.y - 7, { ch: o.ch, z: "T1", zo: 3, sx: 0.42, sy: 0.33, groups: gs, hsv: "0a1a0.86a0a0" }));
      if (R() < 0.25) out.push(K.obj(211, b.x + (R() - 0.5) * 20, b.y + (R() - 0.5) * 20, { ch: o.ch, z: "T1", zo: 4, s: 0.12, groups: gs, hsv: "0a1a1.2a0a0" }));
    }
  }
  return out;
}

// Three depths of scenery behind the play, each one flat colour (a silhouette: depth by value, not detail):
// far mountains (B5), mid hills (B4), near tree line (B3) on the ground line, seeded, repeated across [x0, x1).
// o: far, mid, near (channels), y (ground line, 0), trees ("tree" | "dead tree" | ...), density (trees per 10 blocks)
function backdrop(x0, x1, o = {}) {
  const out = [], gs = o.group ? [o.group] : [], y = o.y || 0;
  if (o.far != null) for (let x = x0 - 120, i = 0; x < x1 + 200; x += 330, i++)
    out.push(...P.put("mountains", x + 180, y + 20, { silhouette: o.far, layer: "B5", zo: -20, scale: 1.25, seed: i + (o.seed || 0), groups: gs, flipX: i % 2 === 1 }).objects);
  if (o.mid != null) for (let x = x0 - 60, i = 0; x < x1 + 200; x += 330, i++)
    out.push(...P.put("hills", x + 180, y, { silhouette: o.mid, layer: "B4", zo: -10, scale: 1.1, seed: i + 7 + (o.seed || 0), groups: gs }).objects);
  if (o.near != null) {
    const name = o.trees || "tree", r = P.place(name, x0, x1, { silhouette: o.near, layer: "B3", zo: -5, density: o.density ?? 2, gap: 0.5, seed: o.seed || 3, y, groups: gs, scale: 1 });
    // a second, smaller row for depth
    const r2 = P.place(name, x0 + 40, x1, { silhouette: o.near, layer: "B3", zo: -6, density: (o.density ?? 2) * 0.7, gap: 0.5, seed: (o.seed || 3) + 50, y, scale: 0.65, groups: gs });
    out.push(...r.objects, ...r2.objects);
  }
  return out;
}

// Low grass / flowers along the ground line, in front (T2), only where no hazard or orb stands within 2 blocks and
// nothing solid sits on the ground there (the floor the player runs on). o: ch, density (per block, 1.5), seed
function tufts(objects, x0, x1, o = {}) {
  const R = K.rng(o.seed || 17), out = [], gs = o.group ? [o.group] : [], y = o.y || 0;
  const busy = objects.filter(b => { const k = kind(b); return k === "hazard" || k === "orb" || k === "pad" || k === "portal"; }).map(b => b.x);
  const ground = new Set(objects.filter(b => kind(b) === "solid" && b.y < 30).map(b => Math.round(b.x / 30 - 0.5)));
  const n = Math.round((x1 - x0) / 30 * (o.density ?? 1.5));
  for (let i = 0; i < n; i++) {
    const x = x0 + R() * (x1 - x0);
    if (busy.some(bx => Math.abs(bx - x) < 60) || ground.has(Math.round(x / 30 - 0.5))) continue;
    for (let k = 0; k < 3; k++) out.push(K.obj(693, x + (k - 1) * 4 + (R() - 0.5) * 3, y + 3 + R() * 2, { ch: o.ch, z: "T2", zo: 1, s: 0.15 + R() * 0.12, rot: 45, groups: gs, hsv: R() < 0.4 ? "0a1a0.8a0a0" : null }));
  }
  return out;
}

// Colours for the three depths from the sky (aerial perspective): far ~ the sky with a little of the tint, near the
// most -- but never as dark as the play: hazards and block edges must stay the darkest / brightest thing on screen
// (tools/contrast.js). tint: the scene's shadow hue. Returns {far, mid, near} rgb.
function depthColours(sky, tint = [90, 60, 100], k = [0.18, 0.32, 0.48]) {
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return { far: mix(sky, tint, k[0]), mid: mix(sky, tint, k[1]), near: mix(sky, tint, k[2]) };
}

// --- motion: deco that moves with the song (ART.md "Deco targets": the strongest gap; gd-taste's section comparison,
// local/compare_sections, 2026-11-24: rated 2.2 levels median 48 motion triggers per screen and ~1700 pulse / move /
// rotate triggers a minute, ours 10 and 406). Per beat, at energy 1: one group pulse per pulse group (the first on the
// beat, the others on the off-beats: real levels put ~30% of their pulses on a beat, ours 57% read as a metronome),
// a bob up and back per bob group in its own phase, a sway out and back per sway group. Every group ends each beat
// where it began (nothing drifts). With 4 pulse + 3 bob + 1 sway groups: 4 + 6 + 2 = 12 triggers a beat = ~46 a
// screen at 120 bpm (1x), ~1440 a minute. energy (0-1) uses only the first ceil(n * energy) groups of each kind:
// calm 0.3, groove 0.6, drop 1. The caller owns the groups: put deco in them (o.group on blockPattern, props'
// groups, scenekit motes). Pulses touch deco groups only -- never a group holding a hazard, orb or block edge
// (a flashing spike reads as a different object; contrast.js "drown").
// o: beat (units per beat), spb (seconds per beat), phase (x of a beat, default x0), energy, pulse [groups],
//    bob [groups], sway [groups], dy (bob height, 4), deg (sway angle, 6), rgb (pulse colour, white), fade (of a beat, 0.6)
function motion(x0, x1, o = {}) {
  const out = [], beat = o.beat || 155.8, spb = o.spb || 0.5, e = Math.max(0, Math.min(1, o.energy ?? 1));
  const use = a => (a || []).slice(0, Math.ceil((a || []).length * e));
  const P = use(o.pulse), B = use(o.bob), W = use(o.sway), dy = o.dy ?? 4, deg = o.deg ?? 6, rgb = o.rgb || [255, 255, 255];
  const ph = o.phase ?? x0, first = ph + Math.ceil((x0 - ph) / beat - 1e-6) * beat;
  for (let x = first; x + beat <= x1 + 1e-6; x += beat) {
    P.forEach((g, i) => out.push(K.pulse(x + (i ? beat * (i / P.length) : 0), g, rgb, 0, 0, spb * (o.fade ?? 0.6), { group: true })));
    B.forEach((g, i) => { const t = x + beat * (i / Math.max(1, B.length)) * 0.5;
      out.push(K.move(t, g, 0, dy, spb / 2, 13), K.move(t + beat / 2, g, 0, -dy, spb / 2, 13)); });
    W.forEach(g => out.push(K.rotate(x, g, deg, spb / 2, { ease: 13 }), K.rotate(x + beat / 2, g, -deg, spb / 2, { ease: 13 })));
  }
  return out;
}

// A mid-tone scene with clear hazards (gd-taste's comparison: rated 2.2 levels' contrast score ~50 against our 100;
// their background sits at luminance ~0.2-0.26 or near black, their blocks within 1.35-6.2x of it and read by their
// outlines; ours were black blocks on a bright sky, 5.6-15x). Given a hue (0-360), returns rgb for bg, ground, block
// (fill), edge (block outline: scenekit blocks o.edge), hazard and deco depths far/mid/near, so that
// block/bg ~ o.blockRatio (3: knowledge/checklist.md "Three values", under contrast.js's stark 6.5), hazard/bg ~4.4
// (checklist: sky vs spikes >= 4; rated medians 3.8-4.2), deco between bg and
// block. o: bgLum (0.17), blockRatio (3), dark (true: blocks darker than bg; false: lighter), sat (0.6).
function midTone(hue, o = {}) {
  const C = require("./contrast.js"), sat = o.sat ?? 0.6;
  const hsv = (h, s, v) => { const f = n => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
    return [f(5), f(3), f(1)].map(c => Math.round(c * 255)); };
  const atLum = (h, s, L) => { let lo = 0, hi = 1; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (C.lum(hsv(h, s, m)) < L) lo = m; else hi = m; } return hsv(h, s, hi); };
  const bgL = o.bgLum ?? 0.17, r = o.blockRatio ?? 3, dark = o.dark !== false;
  const blockL = dark ? (bgL + 0.05) / r - 0.05 : (bgL + 0.05) * r - 0.05;
  const hz = dark ? Math.min(1, (bgL + 0.05) * 4.4 - 0.05) : Math.max(0, (bgL + 0.05) / 4.4 - 0.05);
  const bg = atLum(hue, sat, bgL), block = atLum(hue, sat * 0.9, Math.max(0.002, blockL));
  const mixL = t => bgL + (blockL - bgL) * t;
  const P = { bg, ground: atLum(hue, sat, Math.max(0.002, mixL(1.1))), block, edge: atLum((hue + 20) % 360, sat * 0.5, Math.min(1, bgL * 3 + 0.1)),
    hazard: atLum(hue, dark ? 0.06 : sat, hz), far: atLum((hue + 10) % 360, sat * 0.7, mixL(0.2)), mid: atLum((hue + 5) % 360, sat * 0.8, mixL(0.45)), near: atLum(hue, sat * 0.9, mixL(0.7)) };
  P.ratios = { blockBg: +C.ratio(P.block, P.bg).toFixed(2), hazardBg: +C.ratio(P.hazard, P.bg).toFixed(2), edgeBlock: +C.ratio(P.edge, P.block).toFixed(2) };
  return P;
}

module.exports = { blockPattern, backdrop, tufts, depthColours, motion, midTone };
