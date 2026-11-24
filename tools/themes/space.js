// THEME KIT: space (ART.md "Theme kits"; the user, 2026-11-24: "Let's take the motif of space. Somewhat black background.
// [...] Bit more flying with space. Sections may give different vibes of space, a bit lighter, a bit darker. Bit more
// planets or deco. Different structures and objects. But in all, trying to create a cohesive experience.")
// From the user's reference shots (local/refs/space/, local only): near-black / deep navy sky with stars; a huge glowing
// moon or planet as the set piece, an eclipse ring; blocks as dark bodies with thin glowing cyan rims and inner glow
// panels; jagged dark terraces at the bottom; glowing outlined spikes and saws; orbs and portals the only warm colours;
// light streaks; lots of open flying room. Our own compositions -- nothing copied from those levels.
// A kit = data (palettes per variant, song brief, mode mix, rules) + dress(ctx, section) that places the deco of one
// section. tools/theme.js loads kits; tools/scenes/theme.js applies one to a level (spec "theme").
"use strict";
const K = require("../scenekit.js");
const P = require("../../lib/props.js");

// ---- channels (80-97: this kit's; lab 70/71, kit.js 60-65, props 600+, signature 988-999) and groups (420-447) ----
const CH = { rim: 80, fill: 81, panel: 82, glow: 83, hazard: 84, stars: 85, nebula: 86, nebula2: 87, planet: 88, shade: 89,
  ring: 90, moon: 91, corona: 92, rock: 93, rockLit: 94, station: 95, lights: 96, terrace: 97 };
const G = { twinkleA: 420, twinkleB: 421, nebula: 422, piece: 423, pieceSpin: 424, rocks: 425, rocks2: 426, station: 427,
  lights: 428, streaks: 429, dust: 430, far: 431, ring: 432, corona: 433 };

// ---- palettes: one family (blue-violet, cyan rims) across the level; three moods. Roles (decokit.checkRoles): the
// path is a black body with a bright cyan rim (key 21 = rim) on a near-black sky -- the rim carries it (3x+ off the sky);
// hazards keep their own pale lavender-white rim; deco sits just under / around the sky's value, never at the bodies'.
// Orbs, pads and portals keep GD's warm art: nothing in the kit is warm, so they are the only warm colours.
const VARIANTS = {
  // dark: a near-black sky; the blocks a lifted navy (their fill) so they stand off black things, rims bright cyan;
  // deco either black (shade, terraces) or clearly lit (planet, rocks): never the bodies' navy. Nebula in other hue
  // families (magenta, teal) so its glow never reads as path.
  dark: { mood: "deep space, quiet and wide", energy: 0.7, piece: "eclipse",
    bg: [4, 5, 16], ground: [1, 1, 6], line: [80, 200, 255], pathEdge: [80, 200, 255], blockFill: [30, 42, 92], panel: [40, 110, 200],
    glow: [40, 120, 255], hazardEdge: [225, 210, 255], stars: [200, 220, 255], nebula: [110, 28, 120], nebula2: [16, 96, 86],
    planet: [60, 96, 180], shade: [2, 2, 8], ring: [110, 170, 255], moon: [200, 220, 255], corona: [60, 120, 255],
    rock: [70, 80, 140], rockLit: [120, 140, 210], station: [76, 88, 150], lights: [120, 230, 255], terrace: [3, 4, 12] },
  // light: a lit navy sky; the blocks LIGHTER than it (a lit side), deco darker than the blocks
  light: { mood: "a lit side, near a planet", energy: 0.6, piece: "planet",
    bg: [14, 26, 64], ground: [6, 10, 30], line: [160, 235, 255], pathEdge: [160, 235, 255], blockFill: [66, 90, 172], panel: [90, 160, 240],
    glow: [90, 170, 255], hazardEdge: [255, 225, 255], stars: [220, 235, 255], nebula: [140, 50, 150], nebula2: [30, 120, 110],
    planet: [110, 170, 240], shade: [8, 12, 34], ring: [170, 210, 255], moon: [230, 240, 255], corona: [120, 170, 255],
    rock: [26, 34, 74], rockLit: [80, 110, 190], station: [24, 32, 70], lights: [170, 240, 255], terrace: [8, 12, 34] },
  // nebula: a violet sky full of colour; blocks a lifted indigo, the nebula in pink and teal
  nebula: { mood: "inside a nebula, colourful and busy", energy: 0.9, piece: "moon",
    bg: [16, 6, 34], ground: [4, 1, 10], line: [110, 220, 255], pathEdge: [110, 220, 255], blockFill: [48, 36, 110], panel: [90, 70, 210],
    glow: [150, 90, 255], hazardEdge: [255, 215, 245], stars: [235, 220, 255], nebula: [170, 40, 120], nebula2: [20, 110, 120],
    planet: [130, 90, 210], shade: [3, 1, 8], ring: [190, 150, 255], moon: [220, 225, 255], corona: [170, 110, 255],
    rock: [90, 70, 160], rockLit: [150, 120, 230], station: [92, 76, 170], lights: [140, 235, 255], terrace: [3, 1, 8] },
  // moon: the climax under a huge moon -- a pale blue-grey sky, the moon the brightest thing, blocks lifted slate
  moon: { mood: "under the moon, the climax", energy: 1, piece: "moon",
    bg: [27, 36, 54], ground: [8, 10, 20], line: [235, 242, 255], pathEdge: [235, 242, 255], blockFill: [72, 88, 136], panel: [120, 170, 240],
    glow: [140, 180, 255], hazardEdge: [255, 150, 215], stars: [235, 240, 255], nebula: [130, 50, 140], nebula2: [30, 120, 120],
    planet: [110, 150, 220], shade: [6, 8, 18], ring: [190, 210, 255], moon: [240, 245, 255], corona: [150, 190, 255],
    rock: [22, 28, 56], rockLit: [90, 110, 170], station: [20, 26, 52], lights: [180, 240, 255], terrace: [6, 8, 18] },
};
// blending channels (additive glow), with their opacity
const BLEND = { [CH.glow]: 0.6, [CH.nebula]: 0.22, [CH.nebula2]: 0.2, [CH.corona]: 0.45, [CH.panel]: 0.8, [CH.lights]: 1 };
// header: plain background art, no middleground hills (GD's own art drew icy hills along the floor), the plain ground
const HEADER = { kA6: "1", kA7: "1", kA25: "0" };

// the colour map of a variant: channel -> rgb (bg 1000, ground 1001, line 1002, and the kit's own)
function channelMap(v) {
  const p = VARIANTS[v] || VARIANTS.dark, m = { 1000: p.bg, 1001: p.ground, 1002: p.line };
  for (const [k, ch] of Object.entries(CH)) m[ch] = p[k === "rim" ? "pathEdge" : k === "hazard" ? "hazardEdge" : k === "fill" ? "blockFill" : k];
  return m;
}
// a role palette (the shape decokit.rolePalette returns: the section lab and compose read these keys)
function palette(v) {
  const p = VARIANTS[v] || VARIANTS.dark;
  return { bg: p.bg, ground: p.ground, line: p.line, pathEdge: p.pathEdge, blockFill: p.blockFill, hazardEdge: p.hazardEdge,
    far: p.nebula2, mid: p.terrace, near: p.rock, body: p.blockFill };   // body: the fill laid over every block (designBlocks)
}

// ---- song brief (gd-style picks from the local songs: tools/theme.js song space) ----
const SONG = { bpm: [120, 170], dur: [60, 150], mood: "spacious electronic: synth pads, a steady pulse, one big drop",
  energy: "a quiet, airy intro (room to breathe), a long build, a wide drop; breakdowns that thin out to pads",
  want: { beatless: [0.05, 0.4], dynamic: 8 },   // some beatless pad stretches (the flying parts) and a loud/quiet range of 8+ dB
  words: ["space", "star", "galaxy", "cosmos", "orbit", "nebula", "moon", "planet", "void", "astro", "stellar", "lunar", "solar", "comet"] };
// modes: "bit more flying with space" -- a mode mix compose / the section planner can follow
const MODES = { prefer: ["ship", "wave", "ufo", "ball", "cube"], flyShare: 0.5, gravity: "low-gravity feel: ship and UFO, mini wave in the drops",
  speeds: ["1x", "2x"], notes: "open flying corridors, few ceilings; cube parts on floating platforms over the void" };

// ---- pieces (each returns objects; sizes in units, one block = 30; disk 497 is 50 units across at scale 1) ----
const D497 = 50;
// a planet: a disk, its night side (a darker disk offset over it: a lit crescent stays), craters, a tilted ring
function planet(x, y, r, o = {}) {
  const gs = o.groups || [], z = o.z || "B5", out = [], R = K.rng(o.seed || 3);
  out.push(K.obj(497, x, y, { ch: CH.planet, z, zo: 2, s: 2 * r / D497, groups: gs }));
  out.push(K.obj(497, x + r * 0.28, y - r * 0.12, { ch: CH.shade, z, zo: 3, s: 2 * r * 0.97 / D497, groups: gs }));
  for (let i = 0; i < 5; i++) { const a = R() * 6.28, d = R() * r * 0.6;
    out.push(K.obj(497, x - r * 0.3 + Math.cos(a) * d * 0.5, y + Math.sin(a) * d, { ch: CH.planet, z, zo: 4, s: (0.08 + R() * 0.12) * r / D497 * 2, groups: gs, hsv: "0a1a0.75a0a0" })); }
  if (o.ring !== false) for (const [sc, zo] of [[3.1, 1], [2.6, 5]])
    out.push(K.obj(997, x, y, { ch: CH.ring, z, zo, sx: sc * r / 113, sy: sc * r / 113 * 0.28, rot: -14, groups: (o.ringGroups || gs) }));
  return out;
}
// a moon: a bright disk with a soft corona (two rings, blending) and grey maria
function moon(x, y, r, o = {}) {
  const gs = o.groups || [], z = o.z || "B5", out = [], R = K.rng(o.seed || 9);
  out.push(K.obj(236, x, y, { ch: CH.corona, z, zo: 0, s: 2.9 * r / D497, groups: (o.coronaGroups || gs) }));
  out.push(K.obj(236, x, y, { ch: CH.corona, z, zo: 1, s: 2.3 * r / D497, groups: (o.coronaGroups || gs), hsv: "0a1a1.2a0a0" }));
  out.push(K.obj(497, x, y, { ch: CH.moon, z, zo: 2, s: 2 * r / D497, groups: gs }));
  for (let i = 0; i < 7; i++) { const a = R() * 6.28, d = R() * r * 0.7;
    out.push(K.obj(497, x + Math.cos(a) * d, y + Math.sin(a) * d, { ch: CH.moon, z, zo: 3, s: (0.1 + R() * 0.22) * r / D497 * 2, groups: gs, hsv: "0a0.8a0.82a0a0" })); }
  return out;
}
// an eclipse ring: a black disk on a bright corona (scenekit's eclipse with the moon centred)
function eclipseRing(x, y, r, o = {}) {
  const g = { all: o.group || G.piece, centre: G.piece, corona: G.corona, rays: G.corona, rings: G.ring, rings2: G.ring, moon: o.group || G.piece };
  return K.eclipse({ cx: x, cy: y, r, moonDx: 0, moonDy: 0, nRays: 0, ch: { sun: CH.moon, moon: CH.shade, corona: CH.corona, rays: CH.corona, rings: CH.ring }, g });
}
// a rock: three squares turned to a rough polygon, one lit facet; small ones only, behind the play
function rock(x, y, s, o = {}) {
  const R = K.rng(o.seed || 1), gs = o.groups || [], z = o.z || "B2", out = [];
  for (let i = 0; i < 3; i++) out.push(K.obj(211, x + (R() - 0.5) * 8 * s, y + (R() - 0.5) * 8 * s, { ch: CH.rock, z, zo: 1, s: s * (0.55 + R() * 0.35), rot: R() * 90, groups: gs, hsv: i === 1 ? "0a1a0.8a0a0" : null }));
  out.push(K.obj(211, x - 3 * s, y + 3 * s, { ch: CH.rockLit, z, zo: 2, s: s * 0.22, rot: R() * 90, groups: gs }));   // a lit facet: a square, never a triangle (it read as an arrow)
  return out;
}
// an asteroid field across [x0, x1): rocks in the open sky, kept off the play (2 blocks from any play object)
function asteroids(objects, x0, x1, o = {}) {
  const R = K.rng(o.seed || 17), out = [], play = playCells(objects), n = Math.round((x1 - x0) / 100 * (o.density ?? 1.2));
  for (let i = 0; i < n; i++) {
    const x = x0 + R() * (x1 - x0), y = (o.y0 ?? 40) + R() * ((o.y1 ?? 330) - (o.y0 ?? 40));
    if (near(play, x, y, 2)) continue;
    out.push(...rock(x, y, 0.5 + R() * 1.1, { seed: i + (o.seed || 0), groups: [R() < 0.5 ? G.rocks : G.rocks2], z: R() < 0.5 ? "B2" : "B3" }));
  }
  return out;
}
// a space station: a hub, two arms of solar panels (a grid of thin plates), an antenna, blinking lights
function station(x, y, s = 1, o = {}) {
  const gs = o.groups || [G.station], z = o.z || "B4", out = [], L = gs.concat([G.lights]);
  out.push(K.obj(211, x, y, { ch: CH.station, z, zo: 2, sx: 2.2 * s, sy: 1.1 * s, groups: gs }));
  out.push(K.obj(497, x, y, { ch: CH.station, z, zo: 3, s: 1.1 * s, groups: gs, hsv: "0a1a1.3a0a0" }));
  for (const side of [-1, 1]) {
    out.push(K.obj(211, x + side * 55 * s, y, { ch: CH.station, z, zo: 1, sx: 1.6 * s, sy: 0.12 * s, groups: gs }));
    for (let k = 0; k < 3; k++) for (const dy of [-1, 1])
      out.push(K.obj(211, x + side * (40 + k * 16) * s, y + dy * 13 * s, { ch: CH.panel, z, zo: 2, sx: 0.45 * s, sy: 0.7 * s, groups: gs }));
  }
  out.push(K.obj(1753, x, y + 30 * s, { ch: CH.station, z, zo: 1, sx: 1.2 * s, rot: 90, groups: gs }));
  for (const [dx, dy] of [[0, 48], [-80, 0], [80, 0], [24, -14]]) out.push(K.obj(1764, x + dx * s, y + dy * s, { ch: CH.lights, z, zo: 4, s: 0.45 * s, groups: L }));
  return out;
}
// nebula: big soft blending disks, two colours, behind everything
function nebula(x0, x1, o = {}) {
  const R = K.rng(o.seed || 23), out = [], n = Math.round((x1 - x0) / 300 * (o.density ?? 2));
  // a cloud: three nested disks on a blending channel (each adds a little light: soft-ish edges, no blow-out)
  for (let i = 0; i < n; i++) { const x = x0 + R() * (x1 - x0), y = 60 + R() * 260, s = 2.5 + R() * 3.5, ch = R() < 0.55 ? CH.nebula : CH.nebula2;
    for (const [k, v] of [[1, "0a1a0.45a0a0"], [0.72, "0a1a0.7a0a0"], [0.45, null]]) out.push(K.obj(497, x + (1 - k) * 12, y, { ch, z: "B5", zo: -15 + Math.round(k * 2), s: s * k, groups: [G.nebula], hsv: v })); }
  return out;
}
// light streaks: long thin lines on a slant (shooting stars), faint, behind the play
function streaks(x0, x1, o = {}) {
  const R = K.rng(o.seed || 29), out = [];
  for (let x = x0; x < x1; x += 160 + R() * 220) out.push(K.obj(1753, x, 120 + R() * 220, { ch: CH.lights, z: "B3", zo: -2, sx: 2 + R() * 3, sy: 0.6, rot: -18 + (R() - 0.5) * 6, groups: [G.streaks], hsv: "0a0.6a0.7a0a0" }));
  return out;
}
// jagged terraces along the bottom (stepped plates with a thin rim on their tops), only under open sky -- never next
// to a block (roles.js: deco in a block body's value next to it merges); lifted a little off black for that
function terraces(objects, x0, x1, o = {}) {
  const R = K.rng(o.seed || 31), out = [], play = playCells(objects);
  let x = x0, h = 1;
  while (x < x1) {
    const w = 2 + Math.floor(R() * 4); h = Math.max(1, Math.min(3, h + (R() < 0.5 ? -1 : 1)));
    const cx = x + w * 15, top = h * 20;
    let clear = true; for (let c = x; c < x + w * 30; c += 30) if (near(play, c + 15, top / 2, 1.5)) clear = false;
    if (clear) {
      out.push(K.obj(211, cx, top / 2 - 4, { ch: CH.terrace, z: "B2", zo: 0, sx: w, sy: top / 30, groups: [G.far] }));
      out.push(K.obj(1753, cx, top - 3, { ch: CH.glow, z: "B2", zo: 1, sx: w, sy: 0.5, groups: [G.far] }));
      if (R() < 0.5) out.push(K.obj(693, x + w * 30 - 6, top + 6, { ch: CH.terrace, z: "B2", zo: 0, s: 0.45, groups: [G.far] }));
    }
    x += w * 30;
  }
  return out;
}
// the play itself: a block's rim = key 21 on CH.rim (GD draws the body dark), a navy fill over it with inner glow panels
// on stacks and a glow under open tops (scenekit.designBlocks); spikes and saws on CH.hazard
function dressPlay(objects, x0, x1, o = {}) {
  const O = require("../../lib/objects.js"), kindOf = b => (O.objInfo(b.id) || {}).kind;
  for (const b of objects) if (b.x >= x0 && b.x < x1) {
    const k = kindOf(b); if (k !== "solid" && k !== "hazard") continue;
    b.props = b.props || {}; b.props[21] = String(k === "hazard" ? CH.hazard : CH.rim);
    if (DETAIL().has(b.id)) b.props[22] = String(CH.fill);   // a block / spike with a detail part (light squares, colour spikes): its body dark
  }
  return K.designBlocks(objects, x0, x1, { fill: CH.fill, edge: CH.rim, glow: CH.glow, win: CH.panel, windows: 0.35, seed: o.seed || 3 });
}

// ---- one section: everything the kit places between x0 and x1 (variant = dark | light | nebula) ----
// ctx: { objects, tOf: x -> s, beat (units per beat), spb, energy }
function dress(ctx, sec) {
  const { objects } = ctx, { x0, x1 } = sec, v = VARIANTS[sec.variant] ? sec.variant : "dark", vv = VARIANTS[v], out = [], seed = (sec.i || 0) * 13 + 5;
  const secs = Math.max(1, ctx.tOf(x1) - ctx.tOf(x0));
  out.push(...dressPlay(objects, x0, x1, { seed }));
  // far: stars (two twinkle sets), nebula, streaks -- drifting back slowly (locked to the player's x at 0.9 / 0.8)
  out.push(...K.starfield(x0 - 60, x1 + 400, { ch: CH.stars, y0: -20, y1: 360, density: v === "light" ? 3 : 5, base: [G.dust], groups: [G.twinkleA, G.twinkleB], seed: seed + 1 }));
  if ((sec.piece || vv.piece) !== "moon" || v === "nebula") out.push(...nebula(x0, x1 + 300, { density: v === "nebula" ? 2.5 : v === "light" ? 0.8 : 1.2, seed: seed + 2 }));
  out.push(...streaks(x0, x1, { seed: seed + 3 }));
  // the set piece of this section: one, big, high on the screen, carried with the player (it stays in view)
  const px = x0 + 360, py = 210, piece = sec.piece || vv.piece;
  if (piece === "planet") out.push(...planet(px, py, 95, { groups: [G.piece], ringGroups: [G.piece], seed }));
  else if (piece === "moon") out.push(...moon(px, py, 85, { groups: [G.piece], coronaGroups: [G.piece, G.corona], seed }));
  else if (piece === "eclipse") out.push(...eclipseRing(px, py, 55, { group: G.piece }));
  else if (piece === "station") out.push(...station(px, py + 20, 1.3, { groups: [G.piece] }));
  out.push(K.lockX(x0 - 30, G.piece, secs + 1, 0.92));
  // mid: an asteroid field (busier in the drops), a station now and then, terraces under the open sky
  out.push(...asteroids(objects, x0, x1, { density: 0.6 + (sec.energy ?? vv.energy), seed: seed + 4 }));
  if (piece !== "station" && (sec.i || 0) % 2 === 1) out.push(...station(x0 + (x1 - x0) * 0.6, 300, 0.8));
  out.push(...terraces(objects, x0, x1, { seed: seed + 5 }));
  return out;
}

// motion groups for decokit.motion: pulses (twinkle, lights, nebula), bobs (rocks, station), sways (rocks turn)
const MOTION = { pulse: [G.twinkleA, G.lights, G.twinkleB, G.nebula], bob: [G.rocks, G.station, G.rocks2], sway: [G.rocks2] };

// ---- helpers ----
let DET = null;
function DETAIL() { if (DET) return DET; DET = new Set();
  try { for (const l of require("fs").readFileSync(require("path").join(__dirname, "..", "..", "knowledge", "objects", "catalogue.tsv"), "utf8").split(String.fromCharCode(10)).slice(1)) {
    const c = l.split(String.fromCharCode(9)); if (c.length >= 10 && c[9] !== "" && c[9] !== "?") DET.add(+c[0]); } } catch (e) {}
  return DET; }
function playCells(objects) {
  const O = require("../../lib/objects.js"), s = new Set();
  for (const b of objects) { const k = (O.objInfo(b.id) || {}).kind; if (k && k !== "decoration" && k !== "deco" && k !== "trigger") s.add(Math.floor(b.x / 30) + ":" + Math.floor(b.y / 30)); }
  return s;
}
function near(cells, x, y, r) { const c = Math.floor(x / 30), w = Math.floor(y / 30), n = Math.ceil(r);
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) if (cells.has((c + i) + ":" + (w + j))) return true; return false; }

module.exports = { name: "space", mood: "space: a dark, wide sky, glowing rims, planets", CH, G, VARIANTS, BLEND, HEADER, channelMap, palette, SONG, MODES, MOTION,
  dress, pieces: { planet, moon, eclipseRing, rock, asteroids, station, nebula, streaks, terraces, dressPlay } };
