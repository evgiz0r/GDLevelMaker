// node tools/modeorder.js            -- when each mode, speed, size, gravity, dual, orb and pad first appears in the official
//                                       levels 1-22 -> knowledge/mode_order.json (and a table)
// node tools/modeorder.js <level>     -- that level's features with their tiers, and the tier floor they set
//
// The user (2026-11-24): "the difficulty of modes is usually correlated to their appearance in gd main levels". GD's
// main levels bring in one new thing at a time as their star rating climbs, so the first official level a feature
// appears in is a good measure of how hard it reads to a player: the feature's TIER is the rating of that level.
// Used by tools/score.js ("mode tier": a feature above the level's target tier is a WARN, a soft rule -- a brief may
// allow it with a reason) and tools/compose.js (a NOTE when a brief puts a later mode in a lower-tier level).
// DIFFICULTY.md "Mode order".
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), OUT = path.join(ROOT, "knowledge", "mode_order.json");
const NAMES = ["Stereo Madness", "Back On Track", "Polargeist", "Dry Out", "Base After Base", "Can't Let Go", "Jumper", "Time Machine", "Cycles", "xStep", "Clutterfunk", "Theory of Everything", "Electroman Adventures", "Clubstep", "Electrodynamix", "Hexagon Force", "Blast Processing", "Theory of Everything 2", "Geometrical Dominator", "Deadlocked", "Fingerdash", "Dash"];
// the official ratings of levels 1-22 (GD's own labels)
const RATING = ["Easy", "Easy", "Normal", "Normal", "Hard", "Hard", "Harder", "Harder", "Harder", "Insane", "Insane", "Harder", "Insane", "Demon", "Insane", "Insane", "Harder", "Demon", "Harder", "Demon", "Insane", "Insane"];
const TIERS = ["Easy", "Normal", "Hard", "Harder", "Insane", "Demon"];

// a level's features (objects): mode portals, speeds (incl. the start speed), a gravity flip, mini, dual, orbs, pads
function features(objects, header) {
  const { GD } = require("./io.js"), f = new Set();
  for (const o of objects) {
    const i = GD.objInfo(o.id) || {}, n = i.name || "";
    if (i.kind === "mode") f.add("mode:" + i.mode);
    if (i.kind === "speed" && i.speed !== 1) f.add("speed:" + ["0.5x", "1x", "2x", "3x", "4x"][i.speed]);   // a 1x portal only returns to normal
    if (i.kind === "gravity" && i.grav === -1) f.add("gravity flip");
    if (/dual/.test(n) && /portal/.test(n) && !/single/.test(n)) f.add("dual");
    if (/mini/.test(n) && /portal/.test(n)) f.add("mini");
    if (/orb/.test(n) && /orb|ring/.test(i.kind || "")) f.add("orb:" + n.replace(/ orb.*/, ""));   // gameplay orbs only (deco named like one does not count)
    if (/pad/.test(n) && i.kind === "pad") f.add("pad:" + n.replace(/ pad.*/, ""));
  }
  if (header) { const m = /(^|,)kA4,(\d+)/.exec(header); const sp = m ? { 0: "1x", 1: "0.5x", 2: "2x", 3: "3x", 4: "4x" }[m[2]] : null; if (sp && sp !== "1x") f.add("speed:" + sp); }
  f.add("mode:cube");
  return f;
}

function build() {
  const corpus = require("./corpus.js"), first = {}, count = {};
  for (let n = 1; n <= 22; n++) {
    let L; try { L = corpus.official(n); } catch (e) { continue; }
    for (const f of features(L.objects, L.header)) { count[f] = (count[f] || 0) + 1; if (!first[f]) first[f] = n; }
  }
  const order = Object.entries(first).sort((a, b) => a[1] - b[1]).map(([f, n]) => ({ feature: f, level: n, name: NAMES[n - 1], tier: RATING[n - 1], in: count[f] }));
  const out = { note: "first appearance of each feature in the official levels 1-22 (tools/modeorder.js); tier = that level's rating", order };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  return out;
}
function load() { try { return JSON.parse(fs.readFileSync(OUT, "utf8")); } catch (e) { return build(); } }
// the tier floor of a set of features: the highest tier among them, and which features set it
function floor(feats) {
  const t = Object.fromEntries(load().order.map(r => [r.feature, r.tier]));
  let top = "Easy"; const why = [];
  for (const f of feats) { const ti = t[f]; if (!ti) continue; if (TIERS.indexOf(ti) > TIERS.indexOf(top)) top = ti; }
  for (const f of feats) if (t[f] === top && top !== "Easy") why.push(f);
  return { tier: top, why, tiers: Object.fromEntries([...feats].filter(f => t[f]).map(f => [f, t[f]])) };
}
const tierOf = feature => { const r = load().order.find(x => x.feature === feature); return r ? r.tier : null; };

module.exports = { features, build, load, floor, tierOf, TIERS };

if (require.main === module) {
  const arg = process.argv[2];
  if (!arg) { const o = build(); for (const r of o.order) console.log(String(r.level).padStart(2), r.name.padEnd(22), r.tier.padEnd(7), r.feature.padEnd(18), "in", r.in, "of 22"); }
  else { const { readGdlvl } = require("./io.js"), L = readGdlvl(arg), fl = floor(features(L.level.objects, L.level.header)); console.log(`${L.name}: tier floor ${fl.tier}${fl.why.length ? " (" + fl.why.join(", ") + ")" : ""}`); console.log(JSON.stringify(fl.tiers)); }
}
