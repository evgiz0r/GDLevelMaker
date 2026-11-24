// The deco library (ART.md "Deco library"): section-by-section dressing that brings a level from ~10 to the ~35-40
// objects per block real levels carry (knowledge/levels/modern_look.md; ART.md "Deco study"), as our own
// compositions. Each function takes the level's objects (to read the play blocks) or a range, and returns DECO
// objects only (no hitboxes), on the caller's colour channels; HSV variants shade one channel. Use it from a scene
// script (tools/scenes/*.js) per section:
//   const D = require("../decokit.js");
//   out.push(...D.blockPattern(objects, x0, x1, { ch: C.fill, top: 32, seed }));   // inside the play blocks + top trims
//   out.push(...D.backdrop(x0, x1, { far: 33, mid: 34, near: 35, seed }));          // three depths behind the play
//   out.push(...D.tufts(objects, x0, x1, { ch: 36, seed }));                       // low grass in front, clear of hazards
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

module.exports = { blockPattern, backdrop, tufts, depthColours };
