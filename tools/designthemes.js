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
// A level or a section takes a theme by name: the structure deco pass (tools/structdeco.js) reads
// "structures": {"theme": "frost"} or {"sections": [{"from": 0, "theme": "hellgate"}, {"from": 120, "theme": "void"}]}
// (any field of the theme can be overridden in the same entry). Evgeni's rule stays: 2-3 looks a level.
// The gallery: per theme its name, its block combinations (single, row, L, T, 3x3, a hill, a ramp, a ring, one big block
// for the inside) floating over a flat run, then a SAMPLE SEGMENT on the ground: spikes to jump, a step with a spike on it,
// a floating island with spikes on top (held), saws, a big structure, a double spike -- the theme as it plays.
"use strict";
const SDZ = require("./structdesign.js");

const THEMES = {
  hellgate: { mood: "molten rock, hot rims", pal: "fire", design: "layered", effects: ["depth"], spikes: "layers", saws: "cog",
    holders: "chain", indicator: "caret", skies: [{ bg: [40, 10, 14], ground: [16, 4, 6] }, { bg: [58, 14, 10], ground: [22, 5, 4] }, { bg: [28, 18, 20], ground: [12, 8, 9] }],
    backdrops: { a: ["mountains", "horizon", "motes"], b: ["geometry", "rays"], c: ["rocks", "motes"] } },
  frost: { mood: "ice slabs, cold light", pal: "ice", design: "inner base", effects: ["bevel"], spikes: "inner", saws: "sawglow",
    holders: "rope", indicator: "drop", skies: [{ bg: [12, 24, 52], ground: [4, 10, 24] }, { bg: [24, 44, 80], ground: [8, 18, 36] }, { bg: [8, 12, 30], ground: [2, 4, 14] }],
    backdrops: { a: ["mountains", "stars"], b: ["clouds", "motes"], c: ["rings", "stars"] } },
  toxic: { mood: "a chemical plant, green glow", pal: "toxic", design: "nested frames", effects: ["depth"], spikes: "core", saws: "sawnest",
    holders: "rod", indicator: "spark", skies: [{ bg: [10, 26, 14], ground: [4, 12, 6] }, { bg: [18, 34, 10], ground: [6, 14, 4] }],
    backdrops: { a: ["skyline", "motes"], b: ["geometry", "horizon"], c: ["rings", "motes"] } },
  void: { mood: "deep space, violet edges", pal: "void", design: "corner brackets", effects: ["long depth"], spikes: "halo", saws: "sawcore",
    holders: "gdchain", indicator: "pointer", skies: [{ bg: [16, 8, 32], ground: [6, 2, 14] }, { bg: [6, 4, 16], ground: [2, 1, 8] }, { bg: [30, 10, 44], ground: [10, 3, 18] }],
    backdrops: { a: ["stars", "rings"], b: ["geometry", "stars"], c: ["stars", "horizon"] } },
  temple: { mood: "a golden temple, warm and rich", pal: "gold", design: "inner diamond", effects: ["depth + bevel"], spikes: "nested", saws: "cog",
    holders: "chain", indicator: "double chevron", skies: [{ bg: [36, 22, 8], ground: [14, 8, 2] }, { bg: [52, 34, 12], ground: [20, 12, 4] }],
    backdrops: { a: ["mountains", "rays"], b: ["geometry", "motes"], c: ["clouds", "rays"] } },
};

// the block combinations shown per theme (connector sheet picks + one big block)
const COMBOS = [["single", ["#"]], ["row", ["###"]], ["L", ["#..", "###"]], ["T", ["###", ".#."]], ["3x3", ["###", "###", "###"]],
  ["hill", ["./\\.", "/##\\"]], ["ramp", ["./##", "/###"]], ["ring", ["####", "#..#", "####"]], ["big", ["#######", "#######", "#######", "#######"]]];

// the sample segment, columns from its start: [kind, col, row, extra]
const SAMPLE = [
  ["spike", 3, 0],
  ["block", 8, 0], ["block", 9, 0], ["block", 10, 0], ["block", 11, 0], ["block", 12, 0], ["spike", 11, 1],
  ["spike", 17, 0],
  // a floating island with spikes on top, high enough to run under
  ...[20, 21, 22, 23, 24].flatMap(c => [["block", c, 5], ["block", c, 6]]), ["spike", 21, 7], ["spike", 23, 7],
  [1707, 27, 0, { dy: -8 }],   // a small saw sunk in the ground: jump it like a spike
  // a big structure to land on? no: a big one up high, its saw on the corner
  ...[31, 32, 33, 34, 35, 36, 37].flatMap(c => [4, 5, 6, 7].map(r => ["block", c, r])), [1706, 31, 4, { dy: -15 }],
  ["spike", 33, 0], ["spike", 41, 0], ["spike", 42, 0],
];

function list() { for (const [n, t] of Object.entries(THEMES)) console.log(n.padEnd(10) + `${t.pal} ${t.design}${t.effects.length ? " + " + t.effects.join(", ") : ""}; spikes ${t.spikes}, saws ${t.saws}; ${t.holders}; indicator ${t.indicator}; ${t.skies.length} skies; backdrops ${Object.entries(t.backdrops).map(([k, v]) => k + " " + v.join("+")).join(", ")} -- ${t.mood}`); }

function spec() {
  const objects = ["// design themes: per theme its block combinations, then a sample segment"], sections = [], labels = [], ind = [];
  let c = 14;
  for (const [name, t] of Object.entries(THEMES)) {
    sections.push({ from: c - 6, theme: name, backdrop: "a", sky: 0 }); labels.push([c - 6, name]); ind.push([c - 6, t.indicator]);
        const L = SDZ.lay(COMBOS, c, 3, 2);
    for (const [x, y, k] of L.cells) objects.push(k === "#" ? ["block", x, y] : ["slope", x, y, { flipX: k[1] === "l", flipY: k[0] === "t" }]);
    c = L.end + 6;
    sections.push({ from: c - 2, theme: name, backdrop: "b", sky: 1 });
    for (const [kind, dc, r, ex] of SAMPLE) objects.push(ex ? [kind, c + dc, r, ex] : [kind, c + dc, r]);
    c += 50;
  }
  ind.push([c - 3, "none"]);
  return {
    name: "GDLM design themes", desc: "Design themes: blocks, 3D, spikes, saws, holders and indicators that go together (tools/designthemes.js).",
    notes: "Evgeni 2026-11-26: 'set up themes, where we will see the combination of blocks, and then a sample segment with some structures spikes and saw. (and holders and indicators)'; DECOART.md 'Design themes'",
    colours: { bg: THEMES.hellgate.skies[0].bg, ground: THEMES.hellgate.skies[0].ground },
    structures: { sections, ch0: [700, 710, 720, 730, 740], hazCh0: [750, 757, 764, 771, 778], bgCh0: [880, 884, 888, 892, 896], maxLooks: 10 },
    indicators: { all: true, style: ind, colour: sections.map(s => [s.from, "auto"]) },
    scene: "tools/scenes/themegallery.js", labels, outro: 76, signature: {}, objects,
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
module.exports = { resolve, THEMES, COMBOS, SAMPLE, spec, list };
if (require.main === module) {
  const a = process.argv.slice(2);
  if (a[0] === "list") list();
  else if (a[0] === "spec") { const out = a.includes("--out") ? a[a.indexOf("--out") + 1] : "specs/lab_design_themes.json";
    require("fs").writeFileSync(out, JSON.stringify(spec(), null, 1) + "\n"); console.log("wrote " + out); }
  else console.log(require("fs").readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n"));
}
