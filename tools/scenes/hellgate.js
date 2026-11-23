// Scene script for specs/44_hellgate.json (GDLM 44 hellgate), run by tools/make.js after the gameplay
// (spec "scene"; rebuild a look-only change with `node tools/make.js specs/44_hellgate.json --look`).
// Owner: the polish session (POLISH.md "Hellgate rounds"); the gameplay spec is gd-style's.
// The idea: a descent into a burning underworld, one scene per mode, each mode change a flash.
// Spans are cut at every mode portal; each gets the scene of its mode:
//   cube   ember dusk / molten (alternating): rock spires, lava glow, chains and skulls in the molten ones
//   ship   crimson cavern: stalactites come down from the top, embers stream past
//   wave   black and orange: everything dark but the lit edges, sparks fly fast
//   ball   smoke: dim purple-red haze, slow embers
// After the song's own drop (DROP_BEAT, songmap: bar 17, +9 dB) every palette runs hotter. Drop zones
// pulse on every beat; the end cools to ash at the signature.
// Every object here is decoration or a trigger (no collision): the gameplay is untouched.
"use strict";
const K = require("../scenekit.js");

const DROP_BEAT = 69;            // the song's drop (343707: bar 17, t 28.2 s) -- only if the level gets there
const ZONES = [[21, 25], [69, 77], [81, 85]];   // beats that pulse on every beat (red pad moments, the drop)

module.exports = function ({ objects, header, beatX }) {
  const out = [], SPEED = 311.58, secs = x => x / SPEED;
  const MODE = { 12: "cube", 13: "ship", 660: "wave", 47: "ball", 111: "ufo" };
  const portals = objects.filter(o => MODE[o.id]).sort((a, b) => a.x - b.x);
  // the signature (make.js, tools/signature.js) goes 4 blocks after the last gameplay object; the scene runs
  // a screen past it so it stands in the lava light (left to make.js it went after the far scenery: 25 blocks late)
  const SIG = Math.ceil(Math.max(...objects.map(o => o.x)) / 30) + 4;
  // the level ends a few blocks past the sign: GD ends a level at its furthest object, so no scenery may
  // run on (v4 ran 2.9 s past the sign: "the ending is too long where nothing happens", tools/deadair.js)
  const END = SIG * 30 + 180, LEN = END + 300, T0 = 3;
  const lastX = Math.max(...objects.filter(o => o.id === 1 || o.id === 8).map(o => o.x));
  const dropX = beatX(DROP_BEAT), hasDrop = dropX < lastX;
  // spans: [x0, x1, mode]; the end (cooling) starts 8 blocks before the signature
  const S = [];
  let x0 = -300, mode = "cube";
  for (const p of portals) { if (p.x - x0 > 60) S.push([x0, p.x, mode]); x0 = p.x; mode = MODE[p.id]; }
  const coolX = SIG * 30 - 240;
  S.push([x0, Math.max(x0 + 60, coolX), mode], [Math.max(x0 + 60, coolX), END, "end"]);

  // ---- colour channels (own, 30+) ----
  const C = { lava: 30, horizon: 31, far: 32, near: 33, fill: 34, edge: 35, ember: 36, fire: 37, frame: 38, chain: 39, skull: 40, top: 41 };
  const BLEND = new Set([C.edge]);   // round 1 blended five channels: glow on glow washed the spikes out
  // palettes (+ 1013/1014 middleground: the hills were icy blue in v12)
  // Round 2 (the user: "waaaay too flashy ... hard to tell what kills you"): the scenery is dark and
  // desaturated, a little lighter far away than near (depth), the only lit colour is the block edges;
  // the glow sits high in the sky, never behind the spikes (white spikes on bright lava were unreadable).
  const PAL = {
    ember: { [C.lava]: [70, 16, 6], [C.horizon]: [35, 8, 5], [C.far]: [34, 14, 14], [C.near]: [20, 8, 8], [C.fill]: [14, 6, 6], [C.edge]: [200, 80, 30],
      [C.ember]: [130, 60, 30], [C.fire]: [90, 40, 20], [C.frame]: [6, 0, 0], [C.chain]: [36, 18, 16], [C.skull]: [44, 24, 20], [C.top]: [22, 8, 8],
      1013: [30, 10, 8], 1014: [40, 14, 10] },
    molten: { [C.lava]: [80, 24, 6], [C.horizon]: [40, 13, 5], [C.far]: [38, 18, 12], [C.near]: [22, 10, 6], [C.fill]: [16, 8, 4], [C.edge]: [210, 110, 40],
      [C.ember]: [140, 80, 36], [C.top]: [24, 10, 6], 1013: [32, 14, 8], 1014: [44, 18, 10] },
    ship: { [C.lava]: [70, 12, 12], [C.horizon]: [34, 6, 10], [C.far]: [32, 10, 16], [C.near]: [18, 6, 10], [C.fill]: [16, 4, 8], [C.edge]: [200, 60, 50],
      [C.ember]: [130, 50, 50], [C.top]: [26, 6, 12], 1013: [28, 8, 12], 1014: [36, 10, 16] },
    wave: { [C.lava]: [60, 18, 4], [C.horizon]: [22, 7, 2], [C.far]: [16, 6, 6], [C.near]: [10, 4, 4], [C.fill]: [10, 4, 2], [C.edge]: [210, 100, 20],
      [C.ember]: [130, 70, 20], [C.top]: [10, 2, 2], 1013: [16, 6, 4], 1014: [20, 8, 6] },
    ball: { [C.lava]: [60, 16, 26], [C.horizon]: [29, 8, 17], [C.far]: [30, 12, 22], [C.near]: [18, 6, 14], [C.fill]: [14, 4, 10], [C.edge]: [200, 70, 100],
      [C.ember]: [120, 60, 80], [C.top]: [20, 6, 14], 1013: [26, 8, 18], 1014: [34, 10, 24] },
    end: { [C.lava]: [40, 12, 6], [C.horizon]: [18, 6, 4], [C.far]: [20, 8, 8], [C.near]: [12, 4, 4], [C.fill]: [10, 4, 4], [C.edge]: [140, 60, 30],
      [C.ember]: [90, 50, 40], [C.fire]: [60, 30, 16], [C.top]: [6, 0, 0], 1013: [18, 6, 6], 1014: [24, 8, 8] },
  };
  // after the song's drop: hotter (lit colours toward yellow, dark ones a little brighter)
  const hot = p => Object.fromEntries(Object.entries(p).map(([ch, [r, g, b]]) => [ch, +ch === C.edge
    ? [Math.min(255, r + 25), Math.min(255, g + 30), b] : +ch === C.horizon ? [Math.round(r * 1.25), Math.round(g * 1.2), b] : [r, g, b]]));
  let cubeN = 0;
  const palOf = (sp) => {
    const m = sp[2], base = m === "cube" ? (cubeN++ % 2 ? PAL.molten : PAL.ember) : PAL[m] || PAL.ember;
    return hasDrop && sp[0] >= dropX - 30 && m !== "end" ? hot(base) : base;
  };
  const pals = S.map(palOf);
  const defs = {};
  for (const [ch, rgb] of Object.entries(Object.assign({}, PAL.ember, pals[0]))) defs[ch] = { rgb, blend: BLEND.has(+ch) };
  header = K.channels(header, defs);
  // mode changes switch at once (the flash); the end cools over 2.5 s
  for (let i = 1; i < S.length; i++) out.push(...K.palette(S[i][0], pals[i], S[i][2] === "end" ? 2.5 : 0));

  // ---- groups ----
  const G = { far: 300, near: 301, frame: 303, hang: 304, chains: 305, embers: 310, fires: 340, glow: 341 };

  // ---- lava glow along the whole level (blending gradients rising off the ground), pulsed on bars ----
  // a faint warm haze rising off the ground (its colours at 60%: at full the median hazard contrast fell
  // to 4.4, tools/readability.js), dim enough that the spikes stay the brightest thing there
  // (starting it at row 4 drew a hard line across the sky)
  out.push(...K.horizonGlow(-300, END, { ch: C.horizon, y: 0, h: 8, z: "B5", group: G.glow }));

  // ---- rock spires: thorn sprites (461-466) scaled up into jagged rocks, two parallax layers ----
  const spires = (a, b, o) => {
    const R = K.rng(o.seed), res = [];
    for (let x = a; x < b; x += o.step * (0.6 + R() * 0.8)) {
      const id = [466, 461, 463, 466, 462][Math.floor(R() * 5)], s = o.sMin + R() * (o.sMax - o.sMin);
      const h = (id === 466 ? 1.55 : 1.0) * 30 * s;
      res.push(K.obj(id, x, o.top ? o.y - h / 2 : o.y + h / 2, { ch: o.ch, z: o.z, zo: o.zo || 0, s, flipX: R() < 0.5, flipY: !!o.top, groups: [o.group], hsv: R() < 0.4 ? "0a1a0.8a0a0" : null }));
    }
    return res;
  };
  // a layer locked at m keeps m of the player's motion: it covers (1 - m) of the level + a screen
  out.push(...spires(-300, LEN * 0.15 + 1200, { ch: C.far, z: "B4", group: G.far, step: 150, sMin: 3.5, sMax: 6, y: -10, seed: 3 }));
  out.push(K.lockX(T0, G.far, secs(LEN) + 2, 0.85));
  // stalactites from the top: lowered into the flying spans (cavern), up out of view elsewhere
  out.push(...spires(-300, LEN * 0.3 + 1200, { ch: C.top, z: "B3", group: G.hang, step: 150, sMin: 2, sMax: 3.2, y: 420, top: true, seed: 5 }));
  out.push(K.lockX(T0, G.hang, secs(LEN) + 2, 0.7), K.move(T0, G.hang, 0, 160, 0));
  for (const [a, b, m] of S) if (m === "ship" || m === "wave") out.push(K.move(a, G.hang, 0, -160, 0.6, 3), K.move(b, G.hang, 0, 160, 0.6, 2));

  // ---- fires: far back, small, dimmed (near the path they read as hazards); never near a hazard, orb, pad or portal ----
  const busy = objects.filter(o => [8, 39, 103, 36, 84, 141, 1022, 35, 67, 140, 1332, 12, 13, 660, 47, 111].includes(o.id));
  const free = (x, y, r) => !busy.some(o => Math.abs(o.x - x) < r && Math.abs(o.y - y) < r + 30);
  const surf = new Map();
  for (const o of objects) if (o.id >= 1 && o.id <= 7) { const c = Math.floor(o.x / 30); surf.set(c, Math.max(surf.get(c) || 0, o.y + 15)); }
  // fires (920-924): removed in round 2 -- a flame at the ground reads as something that kills

  // ---- chains and skulls in the molten cube spans and the end, behind ----
  cubeN = 0;
  S.forEach(([a, b, m], i) => {
    const molten = m === "end" || (m === "cube" && cubeN++ % 2 === 1);
    if (!molten) return;
    const R = K.rng(20 + i);
    for (let x = a + 60; x < b - 60; x += 90 + R() * 90) {
      if (!free(x, 200, 45)) continue;
      const n = 2 + Math.floor(R() * 3);
      for (let k = 0; k < n; k++) out.push(K.obj(106, x, 330 - k * 62, { ch: C.chain, z: "B2", zo: 0, s: 1, groups: [G.chains] }));
    }
    for (let x = a + 80; x < b; x += 160 + R() * 120) out.push(K.obj(1596 + Math.floor(R() * 2), x, 12 + R() * 20, { ch: C.skull, z: "B3", zo: 2, s: 1.3, flipX: R() < 0.5 }));
  });

  // ---- embers: small dots drifting up; faster and sideways in the flying spans, a storm after the drop ----
  const RISE = { cube: 130, ship: 260, wave: 320, ball: 90, ufo: 200, end: 60 };
  S.forEach(([a, b, m], i) => {
    const g = G.embers + i, fly = m === "ship" || m === "wave", afterDrop = hasDrop && a >= dropX - 30;
    out.push(...K.motes(a, b + 400, { ch: C.ember, group: g, density: afterDrop ? 1.6 : 1.2, z: "B2", seed: 60 + i, y0: -40, y1: 300 }));
    out.push(K.move(a - 200, g, fly ? -120 : -20, RISE[m] || 130, secs(b - a) + 2, 0));
  });

  // ---- the gameplay blocks: obsidian with lava edges (dark fill over the skins, lit open sides) ----
  out.push(...K.designBlocks(objects, -300, END, { fill: C.fill, edge: C.edge, glow: C.lava, seed: 70 }));
  for (const o of objects) if (o.id === 1338) { o.props = o.props || {}; o.props[21] = String(C.edge); }

  // ---- pulses (round 2: seasoning, not the meal): the block edges brighten softly on the bars of the drop
  // zones and at each mode change; nothing else flashes, no full-screen flash, no per-beat pulse ----
  const inZone = b => ZONES.some(([z0, z1]) => b >= z0 && b < z1 && beatX(z0) < lastX);
  for (let b = 1; b < 400; b++) {
    const x = beatX(b);
    if (x > SIG * 30) break;
    if (inZone(b) && (b - 1) % 4 === 0) out.push(K.pulse(x, C.edge, [255, 200, 120], 0.05, 0.05, 0.5));
  }
  for (let i = 1; i < S.length - 1; i++) out.push(K.pulse(S[i][0], C.edge, [255, 200, 140], 0.05, 0.05, 0.6));
  if (hasDrop) out.push(K.zoom(dropX, 0.9, 0.6), K.zoom(beatX(DROP_BEAT + 8), 1, 1));

  // ---- a dark disc behind each mode portal: it frames the portal (a lit one hid it) ----
  for (const o of portals) out.push(K.obj(236, o.x, o.y, { ch: C.near, z: "B1", zo: -2, s: 1.6 }));

  // ---- a dark frame along the top of the screen in the ground spans, the ceiling of hell ----
  out.push(...K.topFrame(0, { ch: C.frame, group: G.frame, y: 250, h: 3.5 }), K.lockX(T0, G.frame, secs(LEN) + 2, 1));
  out.push(K.alpha(T0, G.frame, 0.8, 0));
  for (const [a, b, m] of S) if (m === "ship" || m === "wave") out.push(K.alpha(a, G.frame, 0, 0.5), K.alpha(b, G.frame, 0.8, 0.8));

  // nothing past the end (parallax layers start further back and are locked to the player: their far
  // objects would stretch the level)
  const kept = out.filter(o => o.x <= END || o.id === 899 || o.id === 901 || o.id === 1006 || o.id === 1007 || o.id === 1913 || o.id === 1346);
  return { objects: kept, header, signature: { col: SIG, shirt: [255, 110, 20] } };
};
