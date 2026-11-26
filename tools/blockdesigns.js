// node tools/blockdesigns.js list                      the single-block designs, one line each
// node tools/blockdesigns.js spec [--out specs/lab_block_designs.json]   the gallery spec (then: node tools/make.js <it>)
//
// SINGLE-BLOCK DESIGNS (DECOART.md "Block designs"; Evgeni 2026-11-26: "and similar stuff for singular blocks", next to the
// hazards thread's spike designs). One block is a small picture: a base, something inside (a smaller shape, an inner base
// with swapped colours, a glow, facets, a vein), and edges (outline, a black inline under it, a bevel, a 3D side). Each
// design is a function draw(cx, cy, C, o) -> deco objects for ONE block centred at (cx, cy), all four sides open; the
// play block itself stays (its hitbox is unchanged), the design covers it. C maps a role to a colour channel, so one design
// takes any palette (PAL.ice, PAL.fire). Roles:
//   base   the body          deep   a darker body     inner  the swapped / inverted inner base
//   line   the bright edge (between the base and the highlight, not pure white: Woofel)     inline the dark line under it
//   glow   soft light (blending, 1293 gradients)       hi     highlight      shadow  dark side
//   detail small bright bits                           core   a bright blending core
// Layers: the base on T1 zo 4, things inside zo 5-6, the inline zo 7, the outline zo 8, details and a second glow on T2.
// The gallery (spec + tools/scenes/blockgallery.js): every design in ice (row 2) and fire (row 5), numbered, on a flat run
// with no click, then the outro and the signature. Channels 912-921 (ice), 922-931 (fire), 932 the labels (the signature takes 973-989).
"use strict";
const K = require("./scenekit.js");

const ROLES = ["base", "deep", "inner", "line", "inline", "glow", "hi", "shadow", "detail", "core"];
const PAL = {
  ice: { base: [34, 74, 128], deep: [14, 30, 66], inner: [120, 190, 235], line: [150, 225, 255], inline: [2, 6, 20],
    glow: [110, 210, 255], hi: [190, 240, 255], shadow: [8, 16, 40], detail: [240, 252, 255], core: [150, 235, 255] },
  fire: { base: [92, 24, 22], deep: [44, 8, 10], inner: [255, 150, 60], line: [255, 150, 70], inline: [10, 0, 0],
    glow: [255, 110, 30], hi: [255, 205, 120], shadow: [24, 4, 6], detail: [255, 235, 170], core: [255, 170, 60] },
  // added with the design themes (tools/designthemes.js, 2026-11-26)
  toxic: { base: [22, 64, 30], deep: [8, 28, 12], inner: [150, 255, 90], line: [140, 255, 80], inline: [2, 10, 4],
    glow: [90, 255, 60], hi: [200, 255, 160], shadow: [4, 16, 8], detail: [230, 255, 200], core: [170, 255, 90] },
  void: { base: [48, 24, 86], deep: [20, 8, 42], inner: [210, 120, 255], line: [200, 130, 255], inline: [6, 0, 14],
    glow: [170, 80, 255], hi: [235, 190, 255], shadow: [12, 4, 26], detail: [250, 230, 255], core: [220, 140, 255] },
  gold: { base: [96, 66, 20], deep: [46, 30, 8], inner: [255, 220, 120], line: [255, 210, 100], inline: [16, 8, 0],
    glow: [255, 190, 60], hi: [255, 240, 190], shadow: [26, 16, 4], detail: [255, 250, 220], core: [255, 225, 120] },
};
const OPACITY = { glow: 0.55, core: 0.7 }, BLEND = { glow: 1, core: 1, detail: 1 };
// the channel map for a palette from ch0 (10 channels), and the header definitions for it
function channels(pal, ch0) {
  const C = {}, defs = {};
  ROLES.forEach((r, i) => { C[r] = ch0 + i; defs[ch0 + i] = Object.assign({ rgb: pal[r] }, OPACITY[r] != null ? { opacity: OPACITY[r] } : {}, BLEND[r] ? { blend: true } : {}); });
  return { C, defs };
}

// ---- drawing helpers (block-local: X, Y = the bottom-left corner) ----
const LW = 2.4, IW = 1.8;
function kit(cx, cy, C, o = {}) {
  const out = [], X = cx - 15, Y = cy - 15, g = o.groups;
  const put = (id, x, y, role, zo, extra = {}) => { out.push(K.obj(id, x, y, Object.assign({ ch: C[role], z: extra.z || "T1", zo, groups: g }, extra))); };
  const rect = (x0, y0, x1, y1, role, zo, extra = {}) => put(211, (x0 + x1) / 2, (y0 + y1) / 2, role, zo, Object.assign({ sx: (x1 - x0) / 30, sy: (y1 - y0) / 30 }, extra));
  const frame = (inset, w, role, zo, extra = {}) => {   // a square ring `inset` from the edge, `w` thick
    const a = X + inset, b = X + 30 - inset, c = Y + inset, d = Y + 30 - inset;
    rect(a, d - w, b, d, role, zo, extra); rect(a, c, b, c + w, role, zo, extra);
    rect(a, c + w, a + w, d - w, role, zo, extra); rect(b - w, c + w, b, d - w, role, zo, extra);
  };
  const base = (role = "base") => rect(X, Y, X + 30, Y + 30, role, 4);
  const outline = (role = "line") => frame(0, LW, role, 8);
  const inline = (inset = 6) => frame(inset, IW, "inline", 7);
  // 1293 gradient inside the top edge (solid at the top, fading down), exact width: overlaps show as seams
  const topGlow = (h = 12, z = "T1", zo = 6) => put(1293, cx, Y + 30 - h / 2, "glow", zo, { sx: 2, sy: h / 30, flipY: true, z });
  return { out, X, Y, put, rect, frame, base, outline, inline, topGlow };
}


// a small drawing inside the block (Evgeni: "one of the designs could be just an interesting drawing"): a pixel map, one
// row a string, each run of the same letter merged into one stretched square; letters -> roles (h hi, c core, d detail,
// i inner, k inline, s shadow, g glow). The map fills the block's inner 22 x 22.
const ROLEOF = { h: "hi", c: "core", d: "detail", i: "inner", k: "inline", s: "shadow", g: "glow", l: "line" };
function pixels(k, cx, cy, rows, zo = 6, size = 22) {
  const n = rows.length, m = rows[0].length, px = size / Math.max(n, m), x0 = cx - m * px / 2, y0 = cy + n * px / 2;
  rows.forEach((row, r) => { let j = 0; while (j < m) { const ch = row[j]; let e = j; while (e < m && row[e] === ch) e++;
    if (ROLEOF[ch]) k.rect(x0 + j * px, y0 - (r + 1) * px, x0 + e * px, y0 - r * px, ROLEOF[ch], zo); j = e; } });
}
const DRAWN = {
  flame: ["....h...", "...hh...", "...hch..", "..hcch..", ".hccdch.", ".hcddch.", "..hddh..", "...hh..."],
  eye: ["........", "..hhhh..", ".h.kk.h.", "h.kddk.h", "h.kddk.h", ".h.kk.h.", "..hhhh..", "........"],
  skull: [".hhhhhh.", "hhhhhhhh", "hkkhhkkh", "hkkhhkkh", "hhhkkhhh", ".hhhhhh.", ".h.h.h..", "........"],
  key: ["........", ".hhh....", "h...h...", "h...hhhh", "h...h.h.", ".hhh..h.", "........", "........"],
};

const DESIGNS = [
  { name: "outline", note: "the plain start: a body and a bright edge", draw(cx, cy, C, o) {
    const k = kit(cx, cy, C, o); k.base(); k.outline(); return k.out; } },
  { name: "layered", note: "our round-5 block: dark inline under the outline, a glow inside the top", draw(cx, cy, C, o) {
    const k = kit(cx, cy, C, o); k.base(); k.topGlow(); k.inline(); k.outline(); return k.out; } },
  { name: "inner base", note: "Woofel: a second, smaller base with the colours swapped (light core, dark rim)", draw(cx, cy, C, o) {
    const k = kit(cx, cy, C, o); k.base("deep"); k.rect(k.X + 7, k.Y + 7, k.X + 23, k.Y + 23, "inner", 5); k.frame(7, 1.2, "inline", 7); k.outline(); return k.out; } },
  { name: "inner diamond", note: "a smaller shape inside: a turned square", draw(cx, cy, C, o) {
    const k = kit(cx, cy, C, o); k.base(); k.put(211, cx, cy, "deep", 5, { s: 0.55, rot: 45 }); k.put(211, cx, cy, "hi", 6, { s: 0.3, rot: 45 }); k.outline(); return k.out; } },
  { name: "nested frames", note: "rings stepping inward, each dimmer", draw(cx, cy, C, o) {
    const k = kit(cx, cy, C, o); k.base("deep"); k.frame(6, 1.6, "line", 6, { hsv: "0a1a0.6a0a0" }); k.frame(11, 1.4, "line", 6, { hsv: "0a1a0.35a0a0" }); k.outline(); return k.out; } },
  { name: "corner brackets", note: "bright L pieces on the corners over a dark inline", draw(cx, cy, C, o) {
    const k = kit(cx, cy, C, o), L = 9, w = 2.4; k.base(); k.inline(5);
    for (const [sx, sy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const x = k.X + sx * 30, y = k.Y + sy * 30, dx = sx ? -1 : 1, dy = sy ? -1 : 1;
      k.rect(Math.min(x, x + dx * L), Math.min(y, y + dy * w), Math.max(x, x + dx * L), Math.max(y, y + dy * w), "line", 8);
      k.rect(Math.min(x, x + dx * w), Math.min(y, y + dy * L), Math.max(x, x + dx * w), Math.max(y, y + dy * L), "line", 8);
    }
    return k.out; } },
  { name: "bevel", note: "light from the top-left: lit top and left, shadowed bottom and right", draw(cx, cy, C, o) {
    const k = kit(cx, cy, C, o), b = 3.5; k.base();
    k.rect(k.X, k.Y + 30 - b, k.X + 30, k.Y + 30, "hi", 6); k.rect(k.X, k.Y, k.X + b, k.Y + 30 - b, "hi", 6, { hsv: "0a1a0.8a0a0" });
    k.rect(k.X + b, k.Y, k.X + 30, k.Y + b, "shadow", 6); k.rect(k.X + 30 - b, k.Y + b, k.X + 30, k.Y + 30 - b, "shadow", 6);
    k.frame(0, 1, "line", 8); return k.out; } },
  { name: "glow core", note: "a dark body with a soft light in its middle", draw(cx, cy, C, o) {
    const k = kit(cx, cy, C, o); k.base("deep"); k.put(497, cx, cy, "core", 5, { s: 0.42 }); k.put(1764, cx, cy, "detail", 6, { s: 0.35 }); k.inline(); k.outline(); return k.out; } },
  { name: "facets", note: "four triangles meeting in the middle, lit top-left, dark bottom-right: a cut crystal", draw(cx, cy, C, o) {
    const k = kit(cx, cy, C, o); k.base();
    // 693: right angle bottom-right; four half-squares (15 x 15) per quarter make the facets
    const tri = (x, y, rot, role, hsv) => k.put(693, x, y, role, 5, Object.assign({ s: 0.5, rot }, hsv ? { hsv } : {}));
    tri(cx - 7.5, cy + 7.5, 0, "hi", "0a1a0.7a0a0"); tri(cx + 7.5, cy + 7.5, 90, "base", "0a1a1.25a0a0");
    tri(cx + 7.5, cy - 7.5, 180, "deep"); tri(cx - 7.5, cy - 7.5, 270, "base");
    k.put(211, cx, cy, "line", 6, { sx: 42 / 30 * 0.05, sy: 1.4, rot: 45, hsv: "0a1a0.7a0a0" }); k.put(211, cx, cy, "line", 6, { sx: 42 / 30 * 0.05, sy: 1.4, rot: -45, hsv: "0a1a0.7a0a0" });
    k.outline(); return k.out; } },
  { name: "vein", note: "a thin glowing crack across the body, sparks at its ends", draw(cx, cy, C, o) {
    const k = kit(cx, cy, C, o); k.base("deep");
    k.put(211, cx - 3, cy + 2, "glow", 6, { sx: 0.06, sy: 0.6, rot: 35 }); k.put(211, cx + 5, cy - 5, "glow", 6, { sx: 0.06, sy: 0.35, rot: -20 });
    k.put(211, cx - 3, cy + 2, "core", 5, { sx: 0.25, sy: 0.7, rot: 35 });
    k.put(1764, cx - 8, cy + 10, "detail", 6, { s: 0.25 }); k.put(1764, cx + 7, cy - 9, "detail", 6, { s: 0.2 });
    k.inline(); k.outline(); return k.out; } },
  { name: "dots", note: "four small lights in a square: a panel", draw(cx, cy, C, o) {
    const k = kit(cx, cy, C, o); k.base(); for (const dx of [-6.5, 6.5]) for (const dy of [-6.5, 6.5]) k.put(1764, cx + dx, cy + dy, "detail", 6, { s: 0.28 });
    k.inline(4); k.outline(); return k.out; } },
  { name: "split", note: "a lit upper half over the body, a dark line between", draw(cx, cy, C, o) {
    const k = kit(cx, cy, C, o); k.base(); k.rect(k.X, cy, k.X + 30, k.Y + 30, "inner", 5, { hsv: "0a1a0.55a0a0" }); k.rect(k.X, cy - 0.9, k.X + 30, cy + 0.9, "inline", 7);
    k.outline(); return k.out; } },
  { name: "3D", note: "the block pushed back up-right: a dark side behind it, a dim rim on the side's top", draw(cx, cy, C, o) {
    const k = kit(cx, cy, C, o), d = 7; k.base(); k.inline(); k.outline();
    k.put(211, cx + d, cy + d, "shadow", 1, { z: "B1" });
    k.put(693, k.X + d / 2, k.Y + 30 + d / 2, "shadow", 1, { z: "B1", sx: d / 30, sy: d / 30 });
    k.put(693, k.X + 30 + d / 2, k.Y + d / 2, "shadow", 1, { z: "B1", sx: d / 30, sy: d / 30, rot: 180 });
    k.rect(k.X + d, k.Y + 30 + d - 1.4, k.X + 30 + d, k.Y + 30 + d, "line", 2, { z: "B1", hsv: "0a1a0.45a0a0" });
    return k.out; } },
  { name: "double glow", note: "Woofel: a glow inside the top and a second, smaller one over the outline on T2", draw(cx, cy, C, o) {
    const k = kit(cx, cy, C, o); k.base(); k.topGlow(14); k.inline(); k.outline();
    k.put(1293, cx, k.Y + 30 + 3, "glow", 0, { z: "T2", sx: 2, sy: 0.2, hsv: "0a0.6a1a0a0" }); return k.out; } },
  { name: "window", note: "a framed window: a dark inner square with a thin lit frame and a core", draw(cx, cy, C, o) {
    const k = kit(cx, cy, C, o); k.base(); k.rect(k.X + 8, k.Y + 8, k.X + 22, k.Y + 22, "deep", 5); k.frame(8, 1.2, "hi", 6);
    k.put(1764, cx, cy, "core", 6, { s: 0.3 }); k.outline(); return k.out; } },
  { name: "cross", note: "a plus inside, like a rivet plate", draw(cx, cy, C, o) {
    const k = kit(cx, cy, C, o); k.base(); k.rect(cx - 1.2, k.Y + 7, cx + 1.2, k.Y + 23, "hi", 6, { hsv: "0a1a0.75a0a0" }); k.rect(k.X + 7, cy - 1.2, k.X + 23, cy + 1.2, "hi", 6, { hsv: "0a1a0.75a0a0" });
    k.inline(4); k.outline(); return k.out; } },
  { name: "drawn snowflake", note: "a drawing: six thin arms with ticks, a bright centre", draw(cx, cy, C, o) {
    const k = kit(cx, cy, C, o); k.base("deep");
    for (const a of [0, 60, 120]) { k.put(211, cx, cy, "hi", 6, { sx: 0.07, sy: 0.72, rot: a });
      for (const sgn of [1, -1]) { const r = (a + 90) * Math.PI / 180, tx = cx + Math.sin(r) * 0 + sgn * 6.5 * Math.sin(a * Math.PI / 180), ty = cy + sgn * 6.5 * Math.cos(a * Math.PI / 180);
        k.put(211, tx, ty, "hi", 6, { sx: 0.05, sy: 0.22, rot: a + 50 }); k.put(211, tx, ty, "hi", 6, { sx: 0.05, sy: 0.22, rot: a - 50 }); } }
    k.put(1764, cx, cy, "detail", 7, { s: 0.3 }); k.outline(); return k.out; } },
  { name: "drawn moon", note: "a drawing: a crescent moon and a star on a night tile", draw(cx, cy, C, o) {
    const k = kit(cx, cy, C, o); k.base("deep"); k.put(497, cx - 2, cy + 1, "hi", 5, { s: 0.36 }); k.put(497, cx + 2.5, cy + 3.5, "deep", 6, { s: 0.3 });
    k.put(1764, cx + 7, cy - 6, "detail", 7, { s: 0.22 }); k.put(1764, cx - 8, cy - 8, "detail", 7, { s: 0.12 }); k.outline(); return k.out; } },
  { name: "drawn flame", note: "a pixel drawing: a little flame", draw(cx, cy, C, o) {
    const k = kit(cx, cy, C, o); k.base("deep"); pixels(k, cx, cy, DRAWN.flame); k.outline(); return k.out; } },
  { name: "drawn eye", note: "a pixel drawing: an eye watching the player", draw(cx, cy, C, o) {
    const k = kit(cx, cy, C, o); k.base("deep"); pixels(k, cx, cy, DRAWN.eye); k.outline(); return k.out; } },
  { name: "drawn skull", note: "a pixel drawing: a small skull", draw(cx, cy, C, o) {
    const k = kit(cx, cy, C, o); k.base("deep"); pixels(k, cx, cy, DRAWN.skull); k.outline(); return k.out; } },
  { name: "drawn key", note: "a pixel drawing: a key", draw(cx, cy, C, o) {
    const k = kit(cx, cy, C, o); k.base("deep"); pixels(k, cx, cy, DRAWN.key); k.outline(); return k.out; } },
];


function spec() {
  const W = 6, X0 = 14, objects = ["// the designs, in ice (row 2) and fire (row 5); flat run, no click"];
  DESIGNS.forEach((d, i) => { const c = X0 + i * W; objects.push(["block", c, 2]); objects.push(["block", c, 5]); });
  return {
    name: "GDLM block designs", desc: "Single block designs, ice and fire: things inside a block (tools/blockdesigns.js).",
    notes: "Evgeni 2026-11-26: 'and similar stuff for singular blocks'; the gallery for marking, DECOART.md 'Block designs'",
    colours: { bg: [10, 14, 30], ground: [4, 6, 14] }, scene: "tools/scenes/blockgallery.js",
    gallery: { x0: X0, w: W }, outro: 75, signature: {}, objects,
  };
}

module.exports = { DESIGNS, PAL, ROLES, channels, kit, pixels, DRAWN, spec };

if (require.main === module) {
  const a = process.argv.slice(2);
  if (a[0] === "list") DESIGNS.forEach((d, i) => console.log(`${String(i + 1).padStart(2)}  ${d.name.padEnd(16)} ${d.note}`));
  else if (a[0] === "spec") { const out = a.includes("--out") ? a[a.indexOf("--out") + 1] : "specs/lab_block_designs.json";
    require("fs").writeFileSync(out, JSON.stringify(spec(), null, 1) + "\n"); console.log("wrote " + out); }
  else console.log(require("fs").readFileSync(__filename, "utf8").split("\n").slice(0, 3).join("\n"));
}
