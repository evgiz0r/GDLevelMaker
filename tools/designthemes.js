// node tools/designthemes.js list                  the design themes, one line each
// node tools/designthemes.js spec [--out specs/lab_design_themes.json]   the gallery level (then: node tools/make.js <it>)
//
// DESIGN THEMES (DECOART.md "Design themes"; Evgeni 2026-11-26: "lets set up themes, where we will see the combination of
// blocks, and then a sample segment with some structures spikes and saw. (and holders and indicators)"). A theme is ONE
// combination of everything this thread designed, chosen to work together:
//   pal         the colour roles for blocks, spikes and saws alike (tools/blockdesigns.js PAL)
//   design      the structure design (tools/structdesign.js DESIGNS) + effects (3D)
//   spikes      the spike design, saws the saw design (tools/spikedesign.js DESIGNS)
//   holders     the holder style for islands (tools/connect.js STYLES)
//   indicator   the jump indicator style (tools/indstyles.js) and its colour: opposite the hazards' hue unless given
//   skies       a set of skies ({bg, ground}); a section picks one ("sky": index) or they go in turn
//   backdrops   named background deco options (tools/backdrops.js pieces: stars, clouds, skyline, mountains, geometry,
//               rings, rays, motes, horizon, rocks); a section picks one ("backdrop": "b"), else the first
//   props       GD deco pieces dressed with glow / tint / halo on the structures (tools/themeprops.js: fire, skull, smoke,
//               lava, chain, flame, thorns); a section's "props": [] = none
// A level or a section takes a theme by name: the structure deco pass (tools/structdeco.js) reads
// "structures": {"theme": "frost"} or {"sections": [{"from": 0, "theme": "hellgate"}, {"from": 120, "theme": "void"}]}
// (any field of the theme can be overridden in the same entry). Evgeni's rule stays: 2-3 looks a level.
// The gallery: per theme its name, its block combinations (single, row, L, T, 3x3, a hill, a ramp, a ring, one big block
// for the inside) floating over a flat run, then a SAMPLE SEGMENT on the ground: spikes to jump, a step with a spike on it,
// a floating island with spikes on top (held), saws, a big structure, a double spike -- the theme as it plays.
"use strict";
const SDZ = require("./structdesign.js");

const THEMES = {
  hellgate: { mood: "molten rock, hot rims", pal: "fire", design: "layered", effects: ["depth"], spikes: "ember", fire: 3, saws: "sawforge",
    holders: "brick", indicator: "caret", skies: [{ bg: [84, 36, 96], ground: [29, 12, 33] }, { bg: [60, 40, 110], ground: [21, 14, 38] }, { bg: [96, 40, 70], ground: [33, 14, 24] }],
    backdrops: { a: ["mountains", "horizon", "motes"], b: ["geometry", "rays"], c: ["rocks", "motes"] },
    props: ["fire", "skull", "smoke", "lava", "chain", "flame"] },
  frost: { mood: "ice slabs, cold light", pal: "ice", design: "inner base", effects: ["bevel"], spikes: "inner", saws: "sawglow",
    holders: "rope", indicator: "drop", skies: [{ bg: [140, 80, 50], ground: [49, 28, 17] }, { bg: [130, 70, 130], ground: [45, 24, 45] }, { bg: [40, 100, 80], ground: [14, 35, 28] }],
    backdrops: { a: ["mountains", "stars"], b: ["clouds", "motes"], c: ["rings", "stars"] } },
  toxic: { mood: "a chemical plant, green glow", pal: "toxic", design: "nested frames", effects: ["depth"], spikes: "core", saws: "sawnest",
    holders: "rod", indicator: "spark", skies: [{ bg: [100, 50, 80], ground: [35, 17, 28] }, { bg: [80, 40, 110], ground: [28, 14, 38] }, { bg: [50, 50, 110], ground: [17, 17, 38] }],
    backdrops: { a: ["skyline", "motes"], b: ["geometry", "horizon"], c: ["rings", "motes"] } },
  void: { mood: "deep space, violet edges", pal: "void", design: "corner brackets", effects: ["long depth"], spikes: "halo", saws: "sawcore",
    holders: "gdchain", indicator: "pointer", skies: [{ bg: [20, 90, 100], ground: [7, 31, 35] }, { bg: [30, 70, 110], ground: [10, 24, 38] }, { bg: [90, 70, 30], ground: [31, 24, 10] }],
    backdrops: { a: ["stars", "rings"], b: ["geometry", "stars"], c: ["stars", "horizon"] } },
  temple: { mood: "a golden temple, warm and rich", pal: "gold", design: "inner diamond", effects: ["depth + bevel"], spikes: "nested", saws: "cog",
    holders: "chain", indicator: "double chevron", skies: [{ bg: [40, 70, 130], ground: [14, 24, 45] }, { bg: [90, 50, 110], ground: [31, 17, 38] }, { bg: [30, 90, 100], ground: [10, 31, 35] }],
    backdrops: { a: ["mountains", "rays"], b: ["geometry", "motes"], c: ["clouds", "rays"] } },
};

// the block combinations shown per theme (connector sheet picks + one big block)
const COMBOS = [["single", ["#"]], ["row", ["###"]], ["L", ["#..", "###"]], ["T", ["###", ".#."]], ["3x3", ["###", "###", "###"]],
  ["hill", ["./\\.", "/##\\"]], ["ramp", ["./##", "/###"]], ["ring", ["####", "#..#", "####"]], ["big", ["#######", "#######", "#######", "#######"]]];

// the scene: one continuous level part per theme with every kind of piece in it (Evgeni 2026-11-27: "just 1 full scene
// with pieces"; "the part should have variaty ( some big structures, hanging , stuff, some slopes, connecting structures")).
// Text rows, top row first, row 0 = on the ground: # block, / \\ slopes (7 r on the ceiling side), ^ spike, v hanging spike,
// o saw / q small saw on a corner, s small saw sunk in a top. The cube runs it UP ON the structures (Evgeni 2026-11-27:
// "gameplay in these themes to be mostly above ground. with the scene having much more structures, and more connected
// ones. less open space"): masses down to the ground with pits of spikes between, held islands, ceiling masses with
// hanging spikes over the low stretch.
const SCENE = [
  "....#################...............############.#########..........................##########..",
  "....#################.......................v..v.q########......................................",
  "....................................................v...........................................",
  "................................................................................................",
  ".............................s.......................................................^..........",
  "...............^..........######..########\\...^..............^..####..####......./######\\.......",
  "........../########...##########..###############\\......../#####............#############\\......",
  "...../#############...##########..######################..######............##############\\.....",
  "/##################^^^##########^^######################^^######^.^.^.^.^.^.###############\\....",
];
// a scene map -> objects (SAMPLE is the default scene's)
function sampleOf(MAP) { const SAMPLE = [];
MAP.forEach((line, i) => { const r = MAP.length - 1 - i;
  [...line].forEach((ch, c) => {
    if (ch === "#" || ch === ":") SAMPLE.push(["block", c, r]);
    else if (ch === "/" || ch === "\\" || ch === "7" || ch === "r") SAMPLE.push(["slope", c, r, { flipX: ch === "\\" || ch === "r", flipY: ch === "7" || ch === "r" }]);
    else if (ch === "^") SAMPLE.push(["spike", c, r]);
    else if (ch === "v") SAMPLE.push(["spike", c, r, { rot: 180 }]);
    else if (ch === "o") SAMPLE.push([1706, c, r, { dy: -15 }]);
    else if (ch === "q") SAMPLE.push([1707, c, r, { dy: -15 }]);
    else if (ch === "s") SAMPLE.push([1707, c, r, { dy: -8 }]);
    else if (ch === "G") SAMPLE.push([11, c, r]);   // gravity portal, upside down (the board's 🟡)
    else if (ch === "N") SAMPLE.push([10, c, r]);   // gravity portal, back to normal (🔵)
    // a portal of the mode you are already in moves the band (Evgeni 2026-11-27: "people put invisible ones to move further
    // in the screens"; lib/physics.js): W swing, H ship, U ufo, A wave, L ball, P spider
    else if ("WHUALP".includes(ch)) SAMPLE.push([{ W: 1933, H: 13, U: 111, A: 660, L: 47, P: 1331 }[ch], c, r]);
    // orbs and pads (Evgeni 2026-11-27: sets of yellow / blue / green orbs, "and pads i guess"): Y yellow orb, B blue orb,
    // E green orb, J yellow pad, K blue pad (pads sit on the cell's floor)
    else if (ch === "Y") SAMPLE.push([36, c, r]);
    else if (ch === "B") SAMPLE.push([84, c, r]);
    else if (ch === "E") SAMPLE.push([1022, c, r]);
    else if (ch === "J") SAMPLE.push([35, c, r, { dy: -13 }]);
    else if (ch === "K") SAMPLE.push([67, c, r, { dy: -13 }]);
    // R: a swing re-centring pair (Evgeni 2026-11-27: "swing/ship/ufo portals in the middle of the gameplay recenter the
    // screen. people put invisible ones to move further in the screens"): a ship portal and right after it a swing portal,
    // so the swing's 10-block band is set again around this row (a swing portal alone does nothing in a swing: gdsolver,
    // lib/physics.js enterMode); invisible in the level's deco pass
    else if (ch === "R") { SAMPLE.push([13, c - 0.25, r]); SAMPLE.push([1933, c + 0.25, r]); }
  }); });
  return SAMPLE; }
const SAMPLE = sampleOf(SCENE);
// ON DEMAND (Evgeni 2026-11-27: "we will update the themes on demand dont want to burn updating the whole universe"): a
// theme listed in knowledge/theme_scenes.json as "joined" plays the theme layout's sections joined
// (tools/layoutsections.js joined(): every section, open joins, a mode portal where the mode changes); the others keep
// SCENE until his 🔨 build on their card asks for it
const SCENE_OF = (() => { try { return JSON.parse(require("fs").readFileSync(require("path").join(__dirname, "..", "knowledge", "theme_scenes.json"), "utf8")); } catch (e) { return {}; } })();
const PORTAL = { cube: "cube portal", ship: "ship portal", wave: "wave portal", ufo: "ufo portal", ball: "ball portal", swing: "swing portal", robot: "robot portal", spider: "spider portal" };
function sceneFor(name) {
  if (SCENE_OF[name] !== "joined") return { sample: SAMPLE, w: SCENE_W, end: SCENE_END };
  const j = require("./layoutsections.js").joined(), sample = sampleOf(j.map), w = j.map[0].length;
  for (const p of j.portals) sample.push([PORTAL[p.mode], p.c, p.r]);
  sample.push([PORTAL.cube, w + 1, 1]);   // back to the cube for the next theme
  return { sample, w: w + 3, end: w + 3 }; }
// the kit: every piece a theme brings, laid out one by one above the cube's lane (rows 4-7), before its scene
const KIT_MAP = [
  "................................",
  "...#..#..../\\..^.#....o..#####..",
  "#.###.###./##\\.#.v.q.....#####..",
  ".........................#######",
  ".........................#......",
  ".........................#......",
];
const KIT = [], KIT_W = KIT_MAP[0].length + 3;
KIT_MAP.forEach((line, i) => { const r = 7 - i;
  [...line].forEach((ch, c) => {
    if (ch === "#") KIT.push(["block", c, r]);
    else if (ch === "/" || ch === "\\") KIT.push(["slope", c, r, { flipX: ch === "\\" }]);
    else if (ch === "^") KIT.push(["spike", c, r]);
    else if (ch === "v") KIT.push(["spike", c, r, { rot: 180 }]);
    else if (ch === "q") KIT.push([1707, c, r]);
    else if (ch === "o") KIT.push([1706, c, r]);
  }); });
const SCENE_W = SCENE[0].length, SCENE_END = Math.max(...SCENE.map(l => l.replace(/\.+$/, "").length)) + 2;   // last piece + 2

// THE CARD'S SKY AND BACKGROUND (Evgeni 2026-11-27: "and we have backgrounds and background deco? ... where do i change in the
// workbook"): his pick per theme from the catalogue card's ⚙ (db collection "themepick", written to
// knowledge/theme_picks.json by Claude before a rebuild): { <theme>: { sky: index, backdrop: "a" | "b" | "c" } }
function picks() { if (process.env.GDLM_THEME_PICK) { const [sky, backdrop] = process.env.GDLM_THEME_PICK.split(","); return new Proxy({}, { get: () => ({ sky: +sky, backdrop }) }); }   // tools/themevariants.js: one combo for every theme
  try { return JSON.parse(require("fs").readFileSync(require("path").join(__dirname, "..", "knowledge", "theme_picks.json"), "utf8")); } catch (e) { return {}; } }
function list() { for (const [n, t] of Object.entries(THEMES)) console.log(n.padEnd(10) + `${t.pal} ${t.design}${t.effects.length ? " + " + t.effects.join(", ") : ""}; spikes ${t.spikes}, saws ${t.saws}; ${t.holders}; indicator ${t.indicator}; ${t.skies.length} skies; backdrops ${Object.entries(t.backdrops).map(([k, v]) => k + " " + v.join("+")).join(", ")} -- ${t.mood}`); }

function spec() {
  const objects = ["// design themes: one scene per theme with every kind of piece"], sections = [], labels = [], ind = [], scenes = [];
  let c = 14;
  for (const [name, t] of Object.entries(THEMES)) {
    // one continuous scene per theme: its pieces, sky, backdrop and holders together (Evgeni: "just 1 full scene")
    const pk = picks()[name] || {}; sections.push({ from: c - 6, theme: name, backdrop: pk.backdrop || "a", sky: pk.sky || 0 }); labels.push([c - 6, name]); ind.push([c - 6, t.indicator]);
    // the theme's kit first, up out of the cube's way: its pieces one by one, in its own design and colours (Evgeni
    // 2026-11-27: "i wanted near each theme, the set of objects/spikes whatever it uses")
    for (const [kind, dc, r, ex] of KIT) objects.push(ex ? [kind, c + dc, r, ex] : [kind, c + dc, r]);
    const k0 = c; c += KIT_W;
    const S = sceneFor(name);
    for (const [kind, dc, r, ex] of S.sample) objects.push(ex ? [kind, c + dc, r, ex] : [kind, c + dc, r]);
    scenes.push({ name, c0: k0 - 2, c1: c + S.end, kit: [k0, k0 + KIT_W - 3], scene: c });
    c += S.w + 24;   // room after the scene, so its picture's last frame stays in this theme
  }
  ind.push([c - 3, "none"]);
  return {
    name: "GDLM design themes", desc: "Design themes: blocks, 3D, spikes, saws, holders and indicators that go together (tools/designthemes.js).",
    notes: "Evgeni 2026-11-26: 'set up themes, where we will see the combination of blocks, and then a sample segment with some structures spikes and saw. (and holders and indicators)'; DECOART.md 'Design themes'",
    colours: { bg: THEMES.hellgate.skies[0].bg, ground: THEMES.hellgate.skies[0].ground },
    structures: { sections, ch0: [700, 710, 720, 730, 740], hazCh0: [750, 757, 764, 771, 778], bgCh0: [880, 884, 888, 892, 896], maxLooks: 10 },
    indicators: { all: true, style: ind, colour: sections.map(s => [s.from, "auto"]) },
    scene: "tools/scenes/themegallery.js", labels, scenes, outro: 76, signature: {}, objects,
  };
}
// a theme entry -> its full combination: a name ("frost"), {theme: "frost", <any field overridden>}, or a whole new one
// given inline ({pal: {...roles rgb} | "fire", design, effects, spikes, saws, holders, indicator, sky}): Evgeni, "we dont
// always have to pick from the set of themes we have, we should be able to change or extend on the fly as needed when
// making a level". Fields left out come from the base theme, else from hellgate.
function resolve(e) {
  if (!e) return null;
  if (typeof e === "string") { if (!THEMES[e]) throw new Error("no design theme " + e); return Object.assign({ name: e }, THEMES[e]); }
  const base = e.theme ? THEMES[e.theme] : THEMES.hellgate; if (!base) throw new Error("no design theme " + e.theme);
  const out = Object.assign({ name: e.theme || "custom" }, base);
  if (e.sky && !e.skies) out.skies = [e.sky];
  for (const [k, v] of Object.entries(e)) if (v !== undefined && k !== "theme") out[k] = v;
  if (e.pal && typeof e.pal === "object" && e.pal.extends) {   // a palette that changes only some roles of another
    const B = require("./blockdesigns.js").PAL[e.pal.extends]; out.pal = Object.assign({}, B, e.pal); delete out.pal.extends; }
  return out;
}
module.exports = { picks, resolve, THEMES, COMBOS, SAMPLE, SCENE, KIT_MAP, spec, list, sampleOf, sceneFor };
if (require.main === module) {
  const a = process.argv.slice(2);
  if (a[0] === "list") list();
  else if (a[0] === "spec") { const out = a.includes("--out") ? a[a.indexOf("--out") + 1] : "specs/lab_design_themes.json";
    require("fs").writeFileSync(out, JSON.stringify(spec(), null, 1) + "\n"); console.log("wrote " + out); }
  else console.log(require("fs").readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n"));
}
