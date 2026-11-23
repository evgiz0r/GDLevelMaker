// What every object id is, for the deco catalogue (tools/catalogue.js, viewer/catalogue.html,
// knowledge/objects/): its root frame, kind, group (contact sheet), family (frame-name stem) and a short
// looks-like note. Runs in node and the browser. Notes per family come from looking at the sheets
// (local/catalogue/, rendered from the user's install); see knowledge/objects/README.md.
(function (GD) {
  "use strict";
  const isNode = typeof module !== "undefined" && typeof require !== "undefined";
  const O = isNode ? require("./objects.js") : GD;
  const A = isNode ? require("./objects_art.js") : GD;
  const F = isNode ? require("./objects_frames.js") : GD;

  // root frame: OpenGD's (what GD shows after setup) where it has the id, else GD 2.2's own table
  // GD 2.2's own frame name where it has the id (names the family), else OpenGD's
  const frameOf = id => F.FRAMES[id] || (A.ART[id] && A.ART[id][5]) || null;
  // "d_spikes_01_001.png" -> "d_spikes"; "blockOutline_14new_001.png" -> "blockOutline"; "pixelart_367_001" -> "pixelart"
  function family(frame) {
    if (!frame) return "";
    let s = frame.replace(/\.png$/, "").replace(/_001$/, "");
    s = s.replace(/(_\d+[a-z]*)+(_(color|glow|extra|2|front|back|small|shine))*$/i, "");
    s = s.replace(/_(\d+[a-z]*|color|glow|extra|small)$/i, "");
    s = s.replace(/_\d+$/, "");
    if (/^gdh_/.test(s)) return "gdh";            // one 2.2 block set, dozens of part names
    if (/^puzzle_/.test(s)) return "puzzle";
    return s;
  }
  // contact-sheet group. Order matters: gameplay kinds first, then the deco families by look.
  const GROUPS = [
    ["blocks", "solid blocks and platforms (collide)"],
    ["slopes", "slopes"],
    ["hazards", "spikes, saws and other things that kill"],
    ["interactive", "portals, orbs, pads, speed, size, coins, keys"],
    ["triggers", "triggers and editor-only objects (not drawn in the game)"],
    ["deco-blocks", "decoration blocks, outlines, block parts (no collision)"],
    ["deco-spikes", "ground spikes, thorns, grass, crystals (no collision)"],
    ["deco-shapes", "circles, rings, lines, arrows, squares, shapes"],
    ["deco-scenery", "clouds, chains, rods, lights, bushes, pillars and other scenery"],
    ["pixel", "pixel art (2.2 pixel sheet)"],
    ["effects", "fire, particles, animated and special"],
    ["deco-other", "other decoration"],
  ];
  function group(id) {
    const d = O.objInfo(+id), f = frameOf(id) || "", fam = family(f).toLowerCase();
    if (d.kind === "trigger" || /^edit_/.test(f)) return "triggers";
    if (d.kind === "solid") return "blocks";
    if (d.kind === "slope") return "slopes";
    if (d.kind === "hazard") return "hazards";
    if (["orb", "pad", "mode", "gravity", "size", "speed", "teleport", "special", "unsupported"].includes(d.kind) || /^(portal|ring|bump|boost|secretcoin)/.test(fam)) return "interactive";
    if (/^pixel/.test(fam)) return "pixel";
    if (/fire|particle|firesheet|^d_fx|anim|beam|explosion|sparkle|^gj_|smoke|drops|lightning|bubble/.test(fam) || /^(fire|particle)/i.test(f)) return "effects";
    if (/spike|thorn|grass|crystal|spark|wave/.test(fam) && !/square/.test(fam)) return "deco-spikes";
    if (/square|block|outline|plank|slab|brick|tile|grid|colorsquare|lightsquare|pit|^gdh|puzzle|platform/.test(fam)) return "deco-blocks";
    if (/circle|ring|line|arrow|art|shape|triangle|diamond|star|heart|cross|dot|bar|segment|edge|corner|curve|wave|ball|link|gradient|spiral|swirve|zag|geometric|mark|rainbow/.test(fam)) return "deco-shapes";
    if (/cloud|chain|rod|light|bush|pillar|plant|tree|flower|moon|sun|gear|cog|torch|lamp|rock|vine|eye|skull|face|monster|fan|wheel|bulb|pipe|bone|water|lava|smoke/.test(fam)) return "deco-scenery";
    return "deco-other";
  }
  // a looks-like note from the family name (words split), with hand notes for the common families
  const NOTE = {
    square: "plain block skin (grid, outline sides vary by id)", blockOutline: "outline only, no fill",
    spike: "spike (kills)", pit: "small floor spike", d_spikes: "ground spikes / crystals, low, a row",
    d_thorn: "thorns", d_cloud: "cloud", chain: "hanging chain", rod: "antenna: stick with a ball on top",
    ring: "jump orb", gravring: "gravity orb", bump: "jump pad", gravbump: "gravity pad", portal: "portal",
    boost: "speed changer", d_ball: "ball / circle", d_circle: "circle", plank: "thin platform (slab)",
    colorPlank: "thin platform", d_arrow: "arrow", lightsquare: "lit block part", pixelart: "pixel-art tile",
    d_largeSquare: "large square", d_flashRing: "flashing ring", d_ringSeg: "ring segment",
    gdh: "2.2 block set part (gdh_*): edges, corners, fills", d_link: "chain link / connector", d_gradient: "soft gradient",
  };
  function note(frame) {
    const fam = family(frame);
    if (NOTE[fam]) return NOTE[fam];
    return fam.replace(/^d_/, "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").toLowerCase();
  }
  // every id with a frame, in id order
  function ids() {
    const s = new Set(Object.keys(F.FRAMES).concat(Object.keys(A.ART)).map(Number));
    return [...s].sort((a, b) => a - b).filter(id => frameOf(id));
  }
  GD.CATALOGUE = { frameOf, family, group, note, ids, GROUPS };
})(typeof module !== "undefined" ? module.exports : (window.GD = window.GD || {}));
