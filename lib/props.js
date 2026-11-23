// The prop library: illustrated scenery (trees, pumpkins, houses, lamps, robots...) as GD objects, drawn
// as pixel art (lib/pixelart.js -> merged deco squares, no hitboxes) or from GD's own deco pieces where
// those look better (chains, cogwheels). ART.md: every prop's picture, object count, size, colours and
// what is unchecked in the game. Contact sheet: node tools/props.js sheet.
//
//   const P = require("../lib/props.js");
//   P.list()                                   -> [{name, attach, size:{w,h} blocks, count, colours, tags}]
//   const r = P.put("pumpkin", x, y, opts)     // ONE prop. x = its centre, y = the ground / block top it
//                                              // stands on (attach "ground"), the ceiling it hangs from
//                                              // ("hang"), or its centre ("bg")
//   const r = P.place("dead tree", x0, x1, opts)   // a row of them between x0 and x1 (density, seeded)
//   r.objects  plain level objects {id, x, y, rot, flipX, flipY, props} (like tools/scenekit.js recipes)
//   r.colours  {channel: [r,g,b]} the channels these objects use -> put them in the HEADER:
//   header = P.header(header, r.colours)       // (kS38; a colour only set by a trigger shows pale in the editor)
//
// opts (all optional):
//   palette   a scene palette {bg, ground, fill, edge, accent} ([r,g,b] each, the showcase planner's): every
//             prop colour is pulled towards the scene (outline/dark from edge, lights from accent, the rest
//             tinted by fill), so a scene reads as ONE palette, as in rated levels. Or `theme`: a name in THEMES.
//   colours   {name: [r,g,b]} override single colour names (see NAMES)
//   channels  {name: channel} fixed channels; otherwise names are given channels from ch0 (default 600) up,
//             the same name -> the same channel across calls that share one `alloc` (P.allocator(ch0))
//   alloc     a shared allocator: props placed with one alloc share channels by colour name (fewer channels)
//   scale     size multiplier (1 = the prop's own size; pixels stay square)
//   layer     "B4" etc. (default: the prop's own: ground props B2, background ones B4)
//   zo        z order base (default 0)
//   groups    [n] on every object (move / alpha / rotate the prop with triggers)
//   chKeys    "both" (default: keys 21 + 22), "main" or "detail" -- which key carries the channel (ART.md: colour)
//   flipX     mirror; seed: variation (trees and rocks change shape a little)
//   density   place(): props per 10 blocks (default 1.5); gap: min blocks between (default 1)
//
// Rules the props keep (TASTE.md, critiques): calm, no flashes; nothing that reads as a hazard, orb or pad
// (no thick rings, no spike shapes near the path, no yellow/pink/blue orb colours on round shapes); at most
// ~7 blocks high; they stand OFF the player's path -- the caller places them where the player is not
// (background layer, or ground spots with no gameplay above them; lib/props.js does not know the path).
// Pure JS, no node APIs (the viewer can load it after lib/pixelart.js).
"use strict";
(function (root) {
  const PA = typeof module !== "undefined" && module.exports ? require("./pixelart.js") : root.PIXELART;

  // ---- colour names and their natural colours ----
  const NAMES = {
    outline: [20, 14, 24], dark: [44, 36, 52], wood: [120, 78, 44], bark: [84, 60, 48], bark2: [58, 44, 40],
    leaf: [58, 140, 64], leaf2: [104, 190, 84], leaf3: [34, 96, 52], stone: [118, 118, 132], stone2: [160, 160, 172], stone3: [84, 84, 98],
    metal: [150, 160, 176], metal2: [104, 112, 130], glow: [255, 214, 110], light: [255, 240, 190],
    orange: [240, 122, 30], orange2: [255, 164, 60], stem: [70, 110, 40], roof: [150, 54, 54], roof2: [112, 38, 44],
    wall: [196, 170, 140], wall2: [158, 130, 106], cloud: [236, 240, 250], cloud2: [196, 206, 228],
    moon: [244, 238, 210], moon2: [208, 200, 170], skin: [240, 192, 150], hair: [96, 58, 36], shirt: [60, 120, 220],
    trousers: [52, 60, 92], ghost: [232, 236, 248], ghost2: [184, 192, 220], eye: [140, 255, 120], wing: [36, 28, 44],
  };
  // themes: overrides of single names (a scene palette, opts.palette, does the same from 5 colours)
  const THEMES = {
    day: {},
    spooky: { leaf: [86, 60, 120], leaf2: [120, 86, 160], leaf3: [56, 40, 84], bark: [52, 40, 56], bark2: [36, 28, 40], wall: [92, 80, 110], wall2: [70, 60, 88],
      roof: [46, 36, 60], roof2: [34, 26, 46], stone: [96, 96, 116], stone2: [130, 130, 150], stone3: [64, 64, 82], glow: [255, 170, 60], light: [255, 210, 120], cloud: [120, 110, 150], cloud2: [86, 78, 116] },
    night: { leaf: [30, 70, 70], leaf2: [44, 100, 96], leaf3: [20, 48, 52], wall: [70, 80, 110], wall2: [52, 60, 86], cloud: [90, 100, 140], cloud2: [64, 72, 108], stone: [70, 80, 100], stone2: [96, 106, 130], stone3: [50, 58, 76] },
    factory: { metal: [120, 124, 132], metal2: [80, 84, 92], wall: [110, 96, 86], wall2: [84, 72, 66], glow: [255, 150, 40], stone: [96, 90, 86], stone2: [126, 118, 110], stone3: [70, 64, 62] },
  };
  const LIGHT = new Set(["glow", "light", "eye"]), DARK = new Set(["outline", "dark", "bark2", "wing"]);
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const lum = c => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  // the rgb of a colour name under opts (palette / theme / colours)
  function colourOf(name, o = {}) {
    if (o.colours && o.colours[name]) return o.colours[name];
    let c = (THEMES[o.theme] || {})[name] || NAMES[name] || [255, 255, 255];
    const P = o.palette;
    if (P) {
      if (DARK.has(name) && P.edge) c = mix(P.edge, [0, 0, 0], name === "outline" ? 0.6 : 0.35);
      else if (LIGHT.has(name) && P.accent) c = mix(c, P.accent, 0.6);
      else if (P.fill) { // keep the name's brightness, take the scene's hue half way
        const f = P.fill, l = lum(c), lf = Math.max(1, lum(f)), toned = f.map(v => Math.min(255, Math.round(v * l / lf)));
        c = mix(c, toned, 0.5);
      }
    }
    return c;
  }
  // channels by colour name, shared by everything placed with the same allocator
  function allocator(ch0 = 600, fixed = {}) { const map = Object.assign({}, fixed); let next = ch0; return { map, ch: name => map[name] != null ? map[name] : (map[name] = next++) }; }

  // ---- the props: each draws a grid (pixel art) and says how it attaches ----
  // def: {attach, px (units a pixel), layer, tags, draw(seed) -> grid, extra?(x, y, o, chOf) -> objects (GD pieces)}
  const rnd = seed => { let s = (seed || 1) * 9301 + 49297; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
  const DEFS = {
    tree: { attach: "ground", px: 5, layer: "B2", tags: ["meadow", "forest", "haunted"], draw(seed) {
      const R = rnd(seed), g = PA.grid(20, 26);
      g.rect(8, 15, 4, 11, "bark"); g.rect(11, 15, 1, 11, "bark2"); g.line(10, 18, 15, 14, "bark", 2);
      const blobs = [[10, 9, 8, 7], [5, 12, 4.5, 4], [15, 12, 4.5, 4], [10, 4.5, 5.5, 4.5]].map(b => b.map(v => v + (R() - 0.5) * 1.2));
      for (const [x, y, rx, ry] of blobs) g.ellipse(x, y, rx, ry, "leaf");
      for (const [x, y, rx, ry] of blobs) g.ellipse(x - rx * 0.25, y - ry * 0.3, rx * 0.55, ry * 0.5, "leaf2");
      g.ellipse(10, 15, 7, 2.2, "leaf3"); g.rect(8, 16, 4, 1, "bark2");
      return g.outline("outline");
    } },
    "dead tree": { attach: "ground", px: 5, layer: "B2", tags: ["haunted"], draw(seed) {
      const R = rnd(seed), g = PA.grid(22, 28);
      g.poly([[8, 28], [14, 28], [12.5, 10], [10, 10]], "bark"); g.poly([[12, 28], [14, 28], [12.5, 12]], "bark2");
      const br = (x0, y0, x1, y1, t) => g.line(x0, y0, x1 + (R() - 0.5) * 2, y1 + (R() - 0.5) * 2, "bark", t);
      br(11, 13, 3, 6, 2); br(11, 11, 11, 1, 2); br(12, 15, 20, 8, 2); br(4, 7, 1, 7, 1); br(5, 8, 4, 3, 1); br(18, 10, 21, 6, 1); br(17, 10, 16, 4, 1); br(11, 4, 14, 2, 1);
      g.poly([[6, 28], [16, 28], [13, 26], [9, 26]], "bark2");
      return g.outline("outline");
    } },
    pumpkin: { attach: "ground", px: 3, layer: "B2", tags: ["haunted", "autumn"], draw() {
      const g = PA.grid(18, 15);
      g.ellipse(9, 9, 8.6, 6, "orange"); g.ellipse(4.5, 9, 3.5, 5.6, "orange2"); g.ellipse(13.5, 9, 3.5, 5.6, "orange2"); g.ellipse(9, 9, 3.2, 6, "orange");
      g.rect(8, 0, 2, 4, "stem"); g.set(10, 1, "stem");
      g.poly([[3.5, 6.5], [7, 6.5], [5.2, 9]], "glow"); g.poly([[11, 6.5], [14.5, 6.5], [12.8, 9]], "glow");
      g.rect(5, 11, 8, 2, "glow"); g.set(6, 11, "orange"); g.set(9, 12, "orange"); g.set(11, 11, "orange");
      return g.outline("outline");
    } },
    house: { attach: "ground", px: 5, layer: "B2", tags: ["haunted", "town", "meadow"], draw() {
      const g = PA.grid(24, 26);
      g.rect(15, 2, 3, 8, "wall2"); g.rect(14, 1, 5, 2, "dark");                      // chimney
      g.poly([[0, 12], [12, 2], [24, 12]], "roof"); g.poly([[12, 2], [24, 12], [18, 12]], "roof2");
      g.rect(2, 12, 20, 14, "wall"); g.rect(18, 12, 4, 14, "wall2");
      g.rect(4, 15, 4, 4, "dark"); g.rect(5, 16, 2, 2, "glow");                        // windows
      g.rect(15, 15, 4, 4, "dark"); g.rect(16, 16, 2, 2, "glow");
      g.rect(9, 18, 5, 8, "dark"); g.rect(10, 19, 3, 7, "wood"); g.set(12, 22, "glow");  // door
      g.rect(10, 7, 3, 3, "dark"); g.set(11, 8, "glow");                               // attic window
      return g.outline("outline");
    } },
    "lamp post": { attach: "ground", px: 4, layer: "B2", tags: ["town", "haunted", "night"], draw() {
      const g = PA.grid(9, 28);
      g.rect(3, 6, 3, 1, "metal"); g.rect(1, 2, 7, 5, "metal2"); g.rect(2, 3, 5, 3, "light"); g.rect(3, 4, 3, 1, "glow");
      g.rect(3, 0, 3, 2, "metal2"); g.rect(4, 7, 1, 19, "metal"); g.rect(3, 9, 3, 1, "metal2"); g.rect(2, 25, 5, 3, "metal2"); g.rect(1, 27, 7, 1, "metal2");
      return g.outline("outline");
    } },
    fence: { attach: "ground", px: 3, layer: "B2", tags: ["haunted", "meadow", "town"], draw() {
      const g = PA.grid(21, 12);
      for (const x of [0, 7, 14]) { g.rect(x + 1, 2, 4, 10, "wood"); g.poly([[x + 1, 2], [x + 3, 0], [x + 5, 2]], "wood"); g.rect(x + 4, 2, 1, 10, "bark"); }
      g.rect(0, 4, 21, 2, "bark"); g.rect(0, 8, 21, 2, "bark");
      for (const x of [0, 7, 14]) { g.rect(x + 1, 4, 3, 2, "wood"); g.rect(x + 1, 8, 3, 2, "wood"); }
      return g.outline("outline");
    } },
    tombstone: { attach: "ground", px: 3, layer: "B2", tags: ["haunted"], draw(seed) {
      const g = PA.grid(12, 15);
      g.rect(1, 4, 10, 11, "stone"); g.ellipse(6, 5, 5, 4, "stone"); g.rect(8, 4, 3, 11, "stone3"); g.ellipse(7.5, 2.8, 2.2, 1.8, "stone2");
      if ((seed || 0) % 2) { g.rect(5, 5, 2, 7, "stone3"); g.rect(3, 7, 6, 2, "stone3"); } else { g.rect(3, 6, 6, 1, "stone3"); g.rect(3, 8, 5, 1, "stone3"); g.rect(3, 10, 6, 1, "stone3"); }
      g.rect(0, 13, 12, 2, "leaf3");
      return g.outline("outline");
    } },
    "hanging block": { attach: "hang", px: 3, layer: "B2", tags: ["factory", "haunted", "cave"], draw() {
      const g = PA.grid(16, 14);
      g.rect(5, 0, 6, 2, "metal2"); g.rect(0, 2, 16, 12, "stone"); g.rect(0, 2, 16, 2, "stone2"); g.rect(13, 2, 3, 12, "stone3"); g.rect(0, 12, 16, 2, "stone3");
      for (const [x, y] of [[2, 5], [11, 5], [2, 10], [11, 10]]) g.set(x, y, "metal");
      return g.outline("outline");
    }, chain: 3 },  // blocks of GD chain (110) above it, see extra()
    gear: { attach: "bg", px: 3, layer: "B4", tags: ["factory", "haunted"], draw() {
      const g = PA.grid(8, 8); g.ellipse(4, 4, 3.6, 3.6, "metal2"); g.ellipse(4, 4, 1.6, 1.6, "dark"); return g;
    }, cog: 85 },     // GD's cogwheel 85 (2.33 blocks) behind a pixel hub
    cloud: { attach: "bg", px: 5, layer: "B4", tags: ["sky", "meadow"], draw(seed) {
      const R = rnd(seed), g = PA.grid(28, 12);
      for (const [x, y, rx, ry] of [[8, 7, 6, 4], [15, 5, 7, 5], [21, 7, 6, 4], [14, 9, 11, 3]]) g.ellipse(x + (R() - 0.5) * 2, y, rx, ry, "cloud");
      g.recolour("cloud", "cloud2", (x, y) => y >= 9);
      return g;
    } },
    moon: { attach: "bg", px: 5, layer: "B5", tags: ["haunted", "night", "sky"], draw() {
      const g = PA.grid(22, 22);
      g.ellipse(11, 11, 10.5, 10.5, "moon");
      g.recolour("moon", "moon2", (x, y) => Math.hypot(x + 0.5 - 8.5, y + 0.5 - 8.5) > 11);   // the shaded limb, lower right
      for (const [x, y, r] of [[7, 7, 2], [14, 14, 2.6], [6, 14, 1.4], [15, 6, 1.2]]) g.ellipse(x, y, r, r, "moon2");
      return g;
    } },
    bush: { attach: "ground", px: 4, layer: "B2", tags: ["meadow", "forest"], draw(seed) {
      const R = rnd(seed), g = PA.grid(16, 9);
      for (const [x, y, rx, ry] of [[4.5, 6, 4.5, 3.5], [8, 4.5, 5, 4.5], [12, 6, 4, 3.5]]) g.ellipse(x + (R() - 0.5), y, rx, ry, "leaf");
      for (const [x, y] of [[4, 4.5], [8, 2.8], [12, 4.6]]) g.ellipse(x, y, 2, 1.4, "leaf2");
      g.rect(0, 8, 16, 1, "leaf3");
      return g.outline("outline");
    } },
    rock: { attach: "ground", px: 4, layer: "B2", tags: ["meadow", "cave", "ocean", "haunted"], draw(seed) {
      const R = rnd(seed), g = PA.grid(14, 9), j = () => (R() - 0.5) * 2;
      g.poly([[0, 9], [1 + j(), 4], [5, 1 + j() / 2], [10, 1.5 + j() / 2], [13, 5 + j()], [14, 9]], "stone");
      g.poly([[9, 9], [10, 2], [13, 5], [14, 9]], "stone3"); g.poly([[3, 4], [5, 2], [8, 2.2], [6, 4]], "stone2");
      return g.outline("outline");
    } },
    robot: { attach: "ground", px: 3, layer: "B2", tags: ["signature", "factory", "town"], draw() {
      const g = PA.grid(16, 26);
      g.rect(7, 0, 2, 2, "glow"); g.rect(7, 2, 2, 3, "metal2");                       // antenna
      g.rect(2, 5, 12, 8, "metal"); g.rect(12, 5, 2, 8, "metal2"); g.rect(2, 5, 12, 1, "light");
      g.rect(4, 7, 3, 3, "dark"); g.rect(9, 7, 3, 3, "dark"); g.rect(5, 8, 1, 1, "glow"); g.rect(10, 8, 1, 1, "glow");
      g.rect(5, 11, 6, 1, "dark");
      g.rect(6, 13, 4, 1, "metal2");                                                   // neck
      g.rect(3, 14, 10, 7, "metal"); g.rect(11, 14, 2, 7, "metal2"); g.rect(5, 16, 6, 3, "dark"); g.rect(6, 17, 1, 1, "glow"); g.rect(9, 17, 1, 1, "eye");
      g.rect(0, 14, 2, 6, "metal2"); g.rect(14, 14, 2, 6, "metal2"); g.rect(0, 20, 2, 1, "dark"); g.rect(14, 20, 2, 1, "dark");
      g.rect(4, 21, 3, 4, "metal2"); g.rect(9, 21, 3, 4, "metal2"); g.rect(3, 25, 4, 1, "dark"); g.rect(9, 25, 4, 1, "dark");
      return g.outline("outline");
    } },
    human: { attach: "ground", px: 3, layer: "B2", tags: ["signature", "town"], draw() {
      const g = PA.grid(14, 26);
      g.rect(3, 1, 8, 8, "skin"); g.rect(3, 0, 8, 2, "hair"); g.rect(2, 1, 2, 5, "hair"); g.rect(10, 1, 1, 3, "hair");
      g.rect(5, 4, 1, 2, "dark"); g.rect(8, 4, 1, 2, "dark"); g.rect(5, 7, 3, 1, "roof");
      g.rect(6, 9, 2, 1, "skin");
      g.rect(2, 10, 10, 8, "shirt"); g.rect(0, 10, 2, 7, "shirt"); g.rect(12, 10, 2, 7, "shirt"); g.rect(0, 17, 2, 2, "skin"); g.rect(12, 17, 2, 2, "skin");
      g.rect(3, 18, 8, 2, "trousers"); g.rect(3, 20, 3, 5, "trousers"); g.rect(8, 20, 3, 5, "trousers"); g.rect(2, 25, 4, 1, "dark"); g.rect(8, 25, 4, 1, "dark");
      return g.outline("outline");
    } },
    ghost: { attach: "bg", px: 3, layer: "B3", tags: ["haunted", "creature"], draw() {
      const g = PA.grid(16, 20);
      g.ellipse(8, 7, 7.5, 7, "ghost"); g.rect(0.5, 7, 15, 10, "ghost");
      for (const x of [0, 4, 8, 12]) g.poly([[x + 0.5, 16], [x + 4.5, 16], [x + 2.5, 20]], "ghost");
      g.rect(11, 5, 4, 12, "ghost2"); g.ellipse(4.5, 7.5, 1.6, 2.2, "dark"); g.ellipse(10.5, 7.5, 1.6, 2.2, "dark"); g.ellipse(7.5, 12, 2, 1.6, "dark");
      return g.outline("outline");
    } },
    "glowing eyes": { attach: "bg", px: 3, layer: "B3", tags: ["haunted", "creature", "ocean", "cave"], draw() {
      const g = PA.grid(15, 5);
      g.poly([[0, 1.5], [5.5, 0.5], [5, 4], [1, 3.5]], "eye"); g.poly([[9.5, 0.5], [15, 1.5], [14, 3.5], [10, 4]], "eye"); g.rect(3, 1, 1, 3, "dark"); g.rect(11, 1, 1, 3, "dark");
      return g;
    } },
    bat: { attach: "bg", px: 3, layer: "B3", tags: ["haunted", "night"], draw() {
      const g = PA.grid(16, 7);
      g.poly([[8, 1], [3, 0], [0, 3], [2, 3], [3, 5], [5, 4], [6, 6], [8, 4]], "wing"); g.poly([[8, 1], [13, 0], [16, 3], [14, 3], [13, 5], [11, 4], [10, 6], [8, 4]], "wing");
      g.rect(7, 1, 2, 4, "wing"); g.set(7, 0, "wing"); g.set(8, 0, "wing"); g.set(7, 2, "eye"); g.set(8, 2, "eye");
      return g;
    } },
    crow: { attach: "ground", px: 2.5, layer: "B2", tags: ["haunted"], draw() {   // perched; put it on a fence / tombstone top
      const g = PA.grid(14, 10);
      g.ellipse(6, 5.5, 4.5, 3.2, "wing"); g.ellipse(10.5, 3, 2.4, 2.2, "wing"); g.poly([[12, 2.5], [14, 3.5], [12, 4]], "orange2"); g.set(11, 2, "eye");
      g.poly([[2, 5], [0, 7.5], [3, 7]], "wing"); g.rect(5, 8, 1, 2, "dark"); g.rect(8, 8, 1, 2, "dark"); g.ellipse(6, 4.8, 3, 1.6, "dark");
      return g;
    } },
    candle: { attach: "ground", px: 2.5, layer: "B2", tags: ["haunted"], draw() {
      const g = PA.grid(6, 14);
      g.ellipse(3, 2.4, 1.6, 2.4, "glow"); g.ellipse(3, 3, 0.8, 1.2, "light"); g.rect(1, 5, 4, 9, "moon"); g.rect(3, 5, 2, 9, "moon2"); g.rect(1, 5, 1, 3, "moon");
      return g.outline("outline");
    } },
    flower: { attach: "ground", px: 2.5, layer: "B2", tags: ["meadow"], draw(seed) {
      const g = PA.grid(9, 13), petal = ["orange2", "roof", "moon", "shirt"][(seed || 0) % 4];
      g.rect(4, 5, 1, 8, "leaf"); g.ellipse(2.5, 9, 2, 1, "leaf2");
      for (const [x, y] of [[4.5, 1.5], [2, 3.5], [7, 3.5], [3, 6], [6, 6]]) g.ellipse(x, y, 1.7, 1.7, petal);
      g.ellipse(4.5, 4, 1.3, 1.3, "glow");
      return g.outline("outline");
    } },
    sun: { attach: "bg", px: 5, layer: "B5", tags: ["sky", "meadow"], draw() {
      const g = PA.grid(20, 20);
      g.ellipse(10, 10, 9.5, 9.5, "glow"); g.ellipse(10, 10, 7.5, 7.5, "light");
      return g;
    } },
    windmill: { attach: "ground", px: 5, layer: "B2", tags: ["meadow"], draw() {
      const g = PA.grid(26, 30);
      g.poly([[9, 30], [17, 30], [15.5, 11], [10.5, 11]], "wall"); g.poly([[13, 30], [17, 30], [15.5, 11], [13, 11]], "wall2");
      g.poly([[9.5, 11], [13, 6], [16.5, 11]], "roof"); g.rect(11, 24, 4, 6, "dark");
      g.line(13, 9, 3, 1, "wood", 2); g.line(13, 9, 23, 1, "wood", 2); g.line(13, 9, 4, 18, "wood", 2); g.line(13, 9, 22, 18, "wood", 2);
      g.poly([[6, 2], [3, 1], [9.5, 6], [11, 4.5]], "cloud"); g.poly([[20, 2], [23, 1], [16.5, 6], [15, 4.5]], "cloud");
      g.poly([[5, 16], [4, 18], [10, 12], [11, 13.5]], "cloud"); g.poly([[21, 16], [22, 18], [16, 12], [15, 13.5]], "cloud");
      g.rect(12, 8, 2, 2, "dark");
      return g.outline("outline");
    } },
  };
  // aliases: other sessions' names (the showcase planner's) -> ours
  const ALIAS = { "dead trees": "dead tree", tombstones: "tombstone", "jack-o-lanterns": "pumpkin", "jack-o-lantern": "pumpkin", gears: "gear", chains: "hanging block", chain: "hanging block",
    "tall trees": "tree", trees: "tree", clouds: "cloud", "big moon": "moon", bats: "bat", rocks: "rock", bushes: "bush", lamp: "lamp post", lamps: "lamp post", eyes: "glowing eyes", creature: "ghost", face: "ghost", houses: "house", chimneys: "house", crows: "crow", candles: "candle", flowers: "flower", windmills: "windmill" };
  const defOf = name => { const n = ALIAS[name] || name; const d = DEFS[n]; if (!d) throw new Error(`no prop "${name}"; there are: ${Object.keys(DEFS).join(", ")}`); return [n, d]; };

  const cache = {};
  function gridOf(name, seed) { const k = name + "#" + (seed || 0); return cache[k] || (cache[k] = DEFS[name].draw(seed || 0)); }

  // one prop
  function put(name, x, y, o = {}) {
    const [n, d] = defOf(name), alloc = o.alloc || allocator(o.ch0 || 600, o.channels);
    const g = gridOf(n, o.seed), px = d.px * (o.scale || 1), layer = o.layer || d.layer;
    const used = Object.keys(g.colours());
    const chOf = c => alloc.ch(c), ch = {}; used.forEach(c => ch[c] = chOf(c));
    const anchor = d.attach === "ground" ? "bottom" : d.attach === "hang" ? "top" : "center";
    const objects = [], colours = {};
    // GD pieces behind / above the pixel art
    if (d.cog) { // GD's cogwheel (2.33 blocks), the pixel hub on top of it
      objects.push(piece(d.cog, x, y, { ch: chOf("metal"), z: layer, zo: (o.zo || 0) - 1, s: o.scale || 1, groups: o.groups })); colours[chOf("metal")] = colourOf("metal", o);
    }
    let top = y;
    if (d.chain) { // GD's chain 110 (0.65 x 1.13 blocks) from the ceiling down, the block under it
      const sc = o.scale || 1, link = 1.13 * 30 * sc, nLinks = Math.max(1, Math.round((o.chain || d.chain) * 30 / link));
      for (let i = 0; i < nLinks; i++) objects.push(piece(110, x, y - link * (i + 0.5), { ch: chOf("metal2"), z: layer, zo: (o.zo || 0) - 1, s: sc, groups: o.groups }));
      colours[chOf("metal2")] = colourOf("metal2", o); top = y - link * nLinks + 2 * sc;
    }
    const r = PA.toObjects(g, { x, y: d.attach === "hang" ? top : y, px, anchor, ch, z: layer, zo: o.zo || 0, groups: o.groups, flipX: o.flipX, chKeys: o.chKeys });
    objects.push(...r.objects);
    used.forEach(c => colours[ch[c]] = colourOf(c, o));
    const size = d.cog ? { w: 2.33 * (o.scale || 1), h: 2.33 * (o.scale || 1) } : { w: r.size.w, h: r.size.h + (top !== y ? (y - top) / 30 : 0) };
    return { name: n, objects, colours, count: objects.length, size, box: r.box, attach: d.attach, layer };
  }
  function piece(id, x, y, o) {
    const p = { 155: "1", 21: String(o.ch), 22: String(o.ch), 24: String(PA.LAYERS[o.z] != null ? PA.LAYERS[o.z] : o.z), 25: String(o.zo || 0) };
    if (o.s && o.s !== 1) p[32] = String(Math.round(o.s * 1000) / 1000);
    if (o.groups && o.groups.length) p[57] = o.groups.join(".");
    return { id, x: +x.toFixed(2), y: +y.toFixed(2), rot: 0, flipX: false, flipY: false, props: p };
  }

  // a row of props between x0 and x1 (seeded, so a rebuild gives the same row). y: ground / ceiling / centre line.
  function place(name, x0, x1, o = {}) {
    const [n, d] = defOf(name), alloc = o.alloc || allocator(o.ch0 || 600, o.channels);
    const dens = o.density == null ? 1.5 : o.density, gap = (o.gap == null ? 1 : o.gap) * 30;
    const R = rnd(o.seed || 7), w = (gridOf(n, 0).w * d.px * (o.scale || 1));
    const y = o.y != null ? o.y : d.attach === "bg" ? 150 : d.attach === "hang" ? 300 : 0;
    const out = { name: n, objects: [], colours: {}, count: 0, xs: [] };
    let x = x0 + w / 2 + R() * gap;
    const step = 300 / Math.max(0.05, dens);
    while (x + w / 2 <= x1) {
      const seed = Math.floor(R() * 4), vy = d.attach === "bg" ? y + (R() - 0.5) * (o.spreadY == null ? 60 : o.spreadY) : y;
      const r = put(n, x, vy, Object.assign({}, o, { alloc, seed, flipX: o.flipX != null ? o.flipX : R() < 0.5 && n !== "house" }));
      out.objects.push(...r.objects); Object.assign(out.colours, r.colours); out.xs.push(+x.toFixed(1));
      x += Math.max(w + gap, step * (0.6 + R() * 0.8));
    }
    out.count = out.objects.length;
    return out;
  }

  // the channels into the level header (kS38)
  function header(h, colours) {
    return h.replace(/kS38,([^,]*)/, (all, list) => {
      const parts = list.split("|").filter(Boolean).filter(c => { const m = /(^|_)6_(\d+)(_|$)/.exec(c); return !(m && colours[+m[2]]); });
      for (const [ch, [r, g, b]] of Object.entries(colours)) parts.push(`1_${r}_2_${g}_3_${b}_11_255_12_255_13_255_4_-1_6_${ch}` + "_7_1" + "_15_1_18_0_8_1");
      return "kS38," + parts.join("|") + "|";
    });
  }

  function list() {
    return Object.entries(DEFS).map(([name, d]) => {
      const r = put(name, 0, 0, {});
      return { name, attach: d.attach, layer: d.layer, size: { w: +r.size.w.toFixed(2), h: +r.size.h.toFixed(2) }, count: r.count, colours: Object.keys(gridOf(name, 0).colours()), tags: d.tags };
    });
  }

  const api = { list, put, place, header, allocator, colourOf, gridOf, NAMES, THEMES, DEFS, ALIAS };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.PROPS = api;
})(this);
