// A THEME scene (ART.md "Theme kits"): dresses a level with a theme kit (tools/themes/<name>.js) section by section.
// Spec key "scene": "tools/scenes/theme.js" plus "theme": one of
//   "space"                                     every section the kit's first variant
//   { "name": "space", "variant": "dark" }      one variant
//   { "name": "space", "variants": ["dark", "nebula", "light"] }   cycled over the sections
//   { "name": "space", "sections": [{ "from": 0, "variant": "light", "piece": "planet", "energy": 0.5 }, { "from": 64, ... }] }
// Sections (when not given): the spec's bg colour triggers (compose puts one at every section start), else the whole level.
// It takes over the level's colours: removes the bg / ground / line colour triggers the builder placed, defines the kit's
// channels in the header, fades each section's palette in just before it starts, sets key 21 on blocks (rim) and
// hazards, places the kit's deco and the motion (decokit.motion, energy per section). Run by tools/make.js after the
// gameplay; compose / collab parts / the lab use it through "scene". Checks: tools/roles.js (score.js gate "roles").
"use strict";
const K = require("../scenekit.js"), D = require("../decokit.js");

module.exports = function ({ objects, header, spec, tl, beatX, GD }) {
  const TH = require("../theme.js"), t = TH.parse(spec.theme), kit = TH.get(t.name);   // (required here: tools/theme.js requires this file)
  const tOf = x => { try { return GD.SYNC.tOfX(tl, x); } catch (e) { return x / 311.58; } };
  const end = Math.max(...objects.filter(o => o.x != null).map(o => o.x)) + 60;
  // sections
  let starts = t.sections ? t.sections.map(s => s.from * 30) : [...new Set((spec.objects || []).filter(e => e[0] === "colour" && e[2] && e[2].ch === "bg").map(e => e[1] * 30))].sort((a, b) => a - b);
  if (!starts.length || starts[0] > 0) starts.unshift(0);
  starts = [...new Set(starts)];
  const variants = Object.keys(kit.VARIANTS);
  const secs = starts.map((x0, i) => { const given = (t.sections || [])[i] || {};
    return Object.assign({ i, x0, x1: i + 1 < starts.length ? starts[i + 1] : end,
      variant: given.variant || t.variant || (t.variants ? t.variants[i % t.variants.length] : variants[0]) }, given); });
  // the builder's own sky / ground / line colour triggers give way to the kit's
  for (let k = objects.length - 1; k >= 0; k--) { const o = objects[k];
    if (o.id === 899 && o.props && [1000, 1001, 1002].includes(+o.props[23])) objects.splice(k, 1); }
  // header: every kit channel at the first section's colours (blending ones flagged)
  const defs = {}; for (const [ch, rgb] of Object.entries(kit.channelMap(secs[0].variant))) defs[ch] = { rgb, blend: kit.BLEND[ch] != null, opacity: kit.BLEND[ch] ?? 1 };
  header = K.channels(header, defs);
  const out = [];
  // beat length for the motion (units per beat, seconds per beat)
  let beat = 155.8, spb = 0.5;
  try { if (beatX) { const a = beatX(8), b = beatX(9); if (b > a) { beat = b - a; spb = tOf(b) - tOf(a); } } } catch (e) {}
  for (const s of secs) {
    if (s.i > 0) out.push(...K.palette(s.x0 - 45, kit.channelMap(s.variant), 0.6));
    out.push(...kit.dress({ objects, tOf }, s));
    const energy = s.energy ?? kit.VARIANTS[s.variant].energy;
    out.push(...D.motion(s.x0, s.x1, Object.assign({ beat, spb, energy, phase: beatX ? (() => { try { return beatX(0); } catch (e) { return 0; } })() : 0 }, kit.MOTION)));
  }
  // nothing in front of a hazard within a block, unless it dresses a solid (as tools/scenes/kit.js)
  const O = require("../../lib/objects.js"), kindOf = o => (O.objInfo(o.id) || {}).kind;
  const haz = objects.filter(o => kindOf(o) === "hazard"), solidCell = new Set(objects.filter(o => kindOf(o) === "solid").map(o => Math.floor(o.x / 30) + ":" + Math.floor(o.y / 30)));
  const front = o => { const z = o.props && o.props[24]; return z != null && z !== "" && +z >= 1; };
  const kept = out.filter(o => !(o.x != null && kindOf(o) !== "trigger" && front(o) && !solidCell.has(Math.floor(o.x / 30) + ":" + Math.floor(o.y / 30))
    && haz.some(h => Math.abs(h.x - o.x) < 30 && Math.abs(h.y - o.y) < 30)));
  return { objects: kept, header };
};
