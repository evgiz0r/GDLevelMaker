// node tools/themeprops.js list            the dressed GD deco pieces each design theme can put on its structures
// THEME PROPS (Evgeni 2026-11-27: "lets find some more decorations around the firy helish theme" / "usually the basic
// blocks are very bland without some kind of effect, glow, hue, screen wrap"). GD's own hellish deco -- skulls, lava tops,
// looping fire, smoke, chains, thorns (knowledge/objects/catalogue.tsv) -- never placed plain: every piece is
//   tinted    on the theme's own prop channels (hot = the palette's glow, ember = its core, dark = its deep), so it sits in
//             the level's colours, not GD's default white / grey
//   lit       a soft halo behind it (a big circle on a blending channel at low opacity) and, on tops, GD's glow strip 1293
//             rising from the block (decofx's glow), so it reads as a light source
//   grouped   few focal spots a screen (a skull with its fire and smoke together), quiet stretches between -- not spread
//             evenly (DECOART.md: deco is composed, not sprinkled)
//   clear     never in a cell the route passes (connect.js routeCells) or one row above it, never on a hazard
// Placement by where it goes: "top" (an open block top), "hang" (under a ceiling), "pit" (a spike floor or gap on the
// ground), "edge" (the side of a structure). The theme's "props" list (tools/designthemes.js) names the pieces; the
// structure deco pass (tools/structdeco.js) calls place() per section. Channels 860-865 (CH below).
"use strict";
const K = require("./scenekit.js");

const CH = { hot: 860, ember: 861, dark: 862, halo: 863, smoke: 864, chain: 865 };
// each piece: ids (one picked per placement), where, scale, z layer, the channel role, halo size (0 = none), glow strip
const PIECES = {
  skull:     { ids: [1596, 1597], where: "top", s: 0.9, z: "B1", ch: "ember", halo: 2.2, dy: 14 },
  fire:      { ids: [920, 921, 923, 924], where: "top", s: 1, z: "B1", ch: "hot", halo: 2.8, glow: 1, dy: 22 },
  flame:     { ids: [1936, 1937, 1938, 1939], where: "top", s: 0.8, z: "T1", ch: "hot", halo: 1.6, dy: 14 },
  smoke:     { ids: [1849, 1850], where: "top", s: 1.4, z: "B2", ch: "smoke", halo: 0, dy: 60 },
  lava:      { ids: [1591, 1593], where: "pit", s: 1, z: "T1", ch: "hot", halo: 1.4, glow: 1, dy: 6, run: true },
  chain:     { ids: [41, 106, 107, 498, 499], where: "hang", s: 1, z: "B1", ch: "chain", halo: 0, dy: -20 },
  thorns:    { ids: [123, 124, 125, 126, 127, 128], where: "edge", s: 0.8, z: "B1", ch: "dark", halo: 0, dy: 0 },
};
// the channels' colours from a block palette (tools/blockdesigns.js PAL): hot / ember lit, dark for silhouettes
function channels(P) {
  return { [CH.hot]: { rgb: P.glow, blend: true }, [CH.ember]: { rgb: P.hi || P.core }, [CH.dark]: { rgb: P.shadow || P.deep },
    [CH.halo]: { rgb: P.core || P.glow, blend: true, opacity: 0.3 }, [CH.smoke]: { rgb: P.deep, opacity: 0.55 }, [CH.chain]: { rgb: P.deep } };
}

// cells: solid "c,r" set; clear: route cells; haz: hazard cells. -> candidate spots per kind, inside [x0, x1)
function spots(blocks, hazards, clear, x0, x1) {
  const key = (c, r) => c + "," + r, solid = new Set(blocks.map(b => key(Math.floor(b.x / 30), Math.floor(b.y / 30))));
  const haz = new Set(hazards.map(h => key(Math.floor(h.x / 30), Math.floor(h.y / 30))));
  const free = (c, r) => !solid.has(key(c, r)) && !haz.has(key(c, r)) && !clear.has(key(c, r)) && !clear.has(key(c, r - 1));
  const out = { top: [], hang: [], pit: [], edge: [] };
  for (const k of solid) { const [c, r] = k.split(",").map(Number); if (c * 30 < x0 || c * 30 >= x1) continue;
    if (free(c, r + 1) && free(c, r + 2)) out.top.push({ c, r: r + 1 });
    if (r > 2 && free(c, r - 1) && free(c, r - 2)) out.hang.push({ c, r: r - 1 });
    if (!solid.has(key(c - 1, r)) && free(c - 1, r) && solid.has(key(c, r + 1))) out.edge.push({ c: c - 1, r }); }
  for (const h of hazards) { const c = Math.floor(h.x / 30), r = Math.floor(h.y / 30); if (r > 1 || c * 30 < x0 || c * 30 >= x1 || h.flipY) continue;
    out.pit.push({ c, r }); }
  for (const v of Object.values(out)) v.sort((a, b) => a.c - b.c || a.r - b.r);
  return out;
}

// place a theme's props over [x0, x1): a focal spot about every `every` blocks (default 16), the pieces gathered there;
// one quiet screen in three with none. -> objects
function place(names, level, clear, x0, x1, o = {}) {
  const R = K.rng(o.seed || 7), every = (o.every || 16) * 30, out = [];
  const solidIds = o.isSolid || (b => (b.id >= 1 && b.id <= 7) || b.id === 83 || b.id === 69 || b.id === 1338);
  const blocks = level.objects.filter(solidIds), hazards = level.objects.filter(b => o.isHazard ? o.isHazard(b) : [8, 39, 103, 9, 61].includes(b.id));
  const S = spots(blocks, hazards, clear || new Set(), x0, x1), used = new Set();
  const want = [].concat(names || []).filter(n => PIECES[n]);
  for (let fx = x0 + every / 2, k = 0; fx < x1; fx += every * (0.75 + R() * 0.5), k++) {
    if (k % 3 === 2) continue;                                       // a quiet screen
    for (const n of want) { const P = PIECES[n], list = S[P.where].filter(p => Math.abs(p.c * 30 - fx) < every / 2 && !used.has(n + p.c));
      if (!list.length || R() < 0.25) continue;
      const take = P.run ? list.filter(p => Math.abs(p.c - list[0].c) < 6) : [list[Math.floor(R() * list.length)]];
      for (const p of take) { used.add(n + p.c);
        const id = P.ids[Math.floor(R() * P.ids.length)], x = p.c * 30 + 15, y = p.r * 30 + (P.dy || 0);
        if (P.halo) out.push(K.obj(1764, x, y + 10, { ch: CH.halo, z: "B3", zo: -1, s: P.halo * 3.7 }));
        if (P.glow) out.push(K.obj(1293, x, p.r * 30 + 22, { ch: CH.hot, z: "B1", sx: 2, sy: 1.2 }));
        out.push(K.obj(id, x, y, { ch: CH[P.ch], z: P.z, s: P.s * (0.85 + R() * 0.3), flipX: R() < 0.5 })); } } }
  return out;
}

if (require.main === module) {
  for (const [n, p] of Object.entries(PIECES)) console.log(`${n.padEnd(8)} ${p.where.padEnd(5)} ids ${p.ids.join(",")}  ${p.ch}${p.halo ? ", halo" : ""}${p.glow ? ", glow strip" : ""}`);
}
module.exports = { PIECES, CH, channels, spots, place };
