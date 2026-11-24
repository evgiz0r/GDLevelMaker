// Scene script for levels made by the section planner (tools/scenes.js -> tools/planlevel.js; SCENES.md):
// reads the spec's "scenePlan" and dresses each section as its place. Per section: its palette (colour
// triggers on its first bar, the plan's fade), the gameplay blocks as part of the place (designBlocks in
// its fill and edge), its props (lib/props.js from the gd-art session, kept clear of the gameplay; the
// ones it has no picture for come from tools/scenekit.js: motes for fog / smoke / embers / fireflies,
// starfield, light rays, kelp ...), a far silhouette layer for depth, the plan's camera, calm pulses on
// bar starts (TASTE.md: never white, hazards stay the brightest). Title at the start, credits at the end.
"use strict";
const fs = require("fs"), path = require("path");
const K = require("../scenekit.js");
const P = require("../../lib/props.js");
const D = require("../decokit.js");   // gd-art's deco library: backdrop depths, dressed play blocks, tufts (ART.md)
const O = require("../../lib/objects.js");

const SPEED = 311.58;
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
// scenekit stand-ins for prop names lib/props.js has no picture for (SCENES.md)
const SKY = new Set(["moon", "sun", "witch silhouette"]);   // the witch flies against the moon (gd-art)
// v2 (SCENES.md "First planned level vs Spooky Dash"): our own picks where props.js's alias is wrong for the place
const PICK = { chimneys: "factory wall" };
// one set piece per section: a character at its first bar, high, bobbing (gap 4)
const CHARACTER = { haunted: "ghost" };
// how far each place's palette moves away from the level's own (gap 3: one palette carries the level)
const SHIFT = 0.35;
const MOTES = { fog: 0.8, mist: 0.8, "green smoke": 1.2, embers: 2.5, fireflies: 2, "glowing plankton": 3, bubbles: 2.5, "fast bubbles": 4, "wind lines": 1.5 };

module.exports = function ({ objects, header, spec, xOfT }) {
  const plan = spec.scenePlan, out = [], T0 = 3;
  // x from level time through the level's speed portals when make.js / collab.js scene gives xOfT (a vibe sheet's
  // level at 2x / 3x, VIBES.md); 1x otherwise (the section planner's levels)
  const X = typeof xOfT === "function" ? xOfT : t => t * SPEED;
  const secs = plan.sections.map(s => ({ ...s, x0: X(s.t[0]), x1: X(s.t[1]) }));
  const END = secs[secs.length - 1].x1, have = new Set(P.list().map(p => p.name));
  const alias = n => PICK[n] || P.ALIAS && P.ALIAS[n] || n;
  // gap 3: every section's palette is the level's (the first place's) moved SHIFT of the way to its own place
  const base = secs[0].palette, mixP = (a, b, t) => Object.fromEntries(Object.keys(a).map(k => [k, mix(a[k], b[k], t)]));
  // (a vibe sheet whose look is per part -- scenePlan.onePalette false -- keeps each section's own palette)
  if (plan.onePalette !== false) secs.forEach((s, i) => { s.place0 = s.palette; s.palette = i ? mixP(base, s.palette, SHIFT) : base; });
  // ---- channels: the level's own (props take theirs from 600 up, one block of 30 per section) ----
  const C = { glow: 1, far: 2, edge: 9, fill: 10, motes: 13, stars: 8, rays: 12, dFar: 70, dMid: 71, dNear: 72, trim: 73, grass: 74, cloud: 75 };
  const pal = s => ({ 1000: s.palette.bg, 1001: s.palette.ground, 1009: mix(s.palette.ground, s.palette.bg, 0.3), 1002: mix(s.palette.edge, [255, 255, 255], 0.2),
    1004: [245, 245, 250], [C.glow]: mix(s.palette.edge, s.palette.bg, 0.35), [C.far]: mix(s.palette.bg, [0, 0, 0], 0.45), [C.edge]: s.palette.edge, [C.fill]: s.palette.fill,
    [C.motes]: mix(s.palette.accent, s.palette.bg, 0.3), [C.stars]: mix(s.palette.accent, s.palette.bg, 0.4), [C.rays]: mix(s.palette.accent, s.palette.bg, 0.5),
    // gap 1: three backdrop depths, paler than the sky towards the place's edge colour (lit silhouettes on a night sky)
    ...(d => ({ [C.dFar]: d.far, [C.dMid]: d.mid, [C.dNear]: d.near }))(D.depthColours(s.palette.bg, mix(s.palette.edge, s.palette.bg, 0.45), [0.22, 0.34, 0.46])),
    [C.cloud]: mix(s.palette.bg, s.palette.edge, 0.18),
    // gap 2: lit tops on the play blocks, grass in front
    [C.trim]: mix(s.palette.edge, s.palette.accent, 0.3), [C.grass]: mix(s.palette.fill, s.palette.edge, 0.35) });
  const BLEND = new Set([C.glow, C.edge, C.motes, C.stars, C.rays]);
  const defs = {};
  for (const [ch, rgb] of Object.entries(pal(secs[0]))) defs[ch] = { rgb, blend: BLEND.has(+ch) };
  header = K.channels(header, defs);
  header = K.art(header, { bg: 1, ground: 1, line: 1 });
  secs.forEach((s, i) => { if (i) out.push(...K.palette(s.x0, pal(s), s.fade)); });

  // ---- depth: a far silhouette of the ground's colour, slower than the level ----
  // (v1's far rocks silhouette is replaced by decokit's three depths, per section below)

  // ---- per section: blocks as part of the place, props, camera ----
  const log = [];
  secs.forEach((s, i) => {
    const g = 410 + i, alloc = P.allocator ? P.allocator(600 + 30 * i) : undefined;
    out.push(...K.designBlocks(objects, s.x0, s.x1, { fill: C.fill, edge: C.edge, glow: C.glow, seed: 70 + i }));
    // gap 2: the play blocks dressed as the place (bricks inside, a lit trim on open tops), grass tufts that sway
    out.push(...D.blockPattern(objects, s.x0, s.x1, { ch: C.fill, top: C.trim, seed: 40 + i }));
    out.push(...D.tufts(objects, s.x0, s.x1, { ch: C.grass, seed: 60 + i, group: 412 }));
    // gap 1: the screen full -- mountains, hills and a tree line behind the play, a cloud band over the top half
    const dark = /graveyard|forest|ruin/.test(s.place) ? "dead tree" : "tree";
    out.push(...D.backdrop(s.x0, s.x1, { far: C.dFar, mid: C.dMid, near: C.dNear, trees: dark, density: 1.6, seed: 7 + i }));
    for (let x = s.x0 + 60, k = 0; x < s.x1; x += 330, k++)
      out.push(...P.put("cloud band", x, 205 + (k % 2) * 18, { silhouette: C.cloud, layer: "B4", scale: 1.3, seed: k + 3 * i, groups: [413] }).objects);
    // gap 4: one character per section, high on its first bar, bobbing
    const who = CHARACTER[plan.theme];
    if (who && have.has(who) && i > 0) {
      const r = P.put(who, s.x0 + 360, 160, { palette: s.palette, alloc, groups: [460 + i], layer: "B2" });
      out.push(...r.objects, ...K.bob(s.x0 - 300, s.x1, 460 + i, 12, 311, 1)); header = P.header(header, r.colours);
      log.push(`${s.place}: ${who} (set piece)`);
    }
    const quiet = s.role === "breather" || s.role === "intro", dens = quiet ? 0.8 : 1.4;
    for (const name of s.props) {
      const n = alias(name);
      if (SKY.has(n)) {
        // one moon / sun per section, high and to the right, drifting slowly with the screen (parallax 0.9)
        const lit = n === "moon" || n === "sun", r = P.put(n, s.x0 + (lit ? 420 : 440), lit ? 170 : 182, { palette: s.palette, alloc, groups: [450 + i], layer: lit ? "B5" : "B4" });
        out.push(...r.objects, K.lockX(s.x0 - 300, 450 + i, (s.x1 - s.x0 + 600) / SPEED, 0.9)); header = P.header(header, r.colours);
        log.push(`${s.place}: one ${n}`);
      } else if (have.has(n)) {
        try {
          const r = P.place(n, s.x0 + 30, s.x1 - 30, { palette: s.palette, alloc, avoid: objects, density: dens, seed: 31 * i + n.length });
          if (r.objects.length) { out.push(...r.objects); header = P.header(header, r.colours); log.push(`${s.place}: ${n} x${r.count}`); }
        } catch (e) { log.push(`${s.place}: ${n} failed (${e.message})`); }
      } else if (MOTES[name]) {
        out.push(...K.motes(s.x0, s.x1 + 300, { ch: C.motes, group: g, density: MOTES[name], z: name === "fog" || name === "mist" ? "B3" : "B1", seed: 50 + i, y0: 0, y1: 220, sMin: 0.2, sMax: 0.6 }));
        out.push(K.move(s.x0 - 100, g, 0, name === "fog" || name === "mist" ? 20 : 120, (s.x1 - s.x0) / SPEED + 2, 0));
        log.push(`${s.place}: ${name} (motes)`);
      } else if (name === "stars") out.push(...K.starfield(s.x0, s.x1 + 300, { ch: C.stars, y0: 120, y1: 220, density: 3, seed: 20 + i }));
      else if (name === "light rays") out.push(...K.lightRays(s.x0, s.x1, { ch: C.rays, group: 430 + i, z: "B1", every: 130 }));
      else if (name === "kelp") out.push(...K.kelp(s.x0, s.x1, { ch: C.fill, every: 140, seed: 40 + i }));
      else log.push(`${s.place}: ${name} (no picture yet)`);
    }
    const z = +String(s.camera).replace(/[^\d.]/g, "") || 1;
    if (i === 0 || z !== (+String(secs[i - 1].camera).replace(/[^\d.]/g, "") || 1)) out.push(K.zoom(s.x0 + (i ? 0 : T0), z, i ? 0.8 : 0));
  });
  if (process.env.SCENE_LOG !== "0") console.log("   scene (planned): " + log.join("; "));

  // ---- calm pulses: the glow swells on bar starts (a tint of the place's own edge, never white); the
  // level's one sky shift on the biggest loudness jump (the planner marks it) ----
  // (scenePlan.pulses false: a sheet that says no pulses -- never / camera "plain" -- gets none)
  if (plan.pulses !== false) for (let k = 0, x = 0; (x = X(k * plan.barSec)) < END; k++) out.push(K.pulse(x, C.glow, mix(secs.find(s => x >= s.x0 && x < s.x1 + 1)?.palette.edge || [200, 200, 200], [255, 255, 255], 0.25), 0.1, 0.1, 0.8));
  const big = plan.sections.findIndex(s => (s.effects || []).some(e => /sky tint/.test(e)));
  if (big > 0) out.push(K.pulse(secs[big].x0, 1000, mix(secs[big].palette.bg, [255, 255, 255], 0.25), 0.05, 0.1, 1));

  // ---- title and credits ----
  const title = spec.name.replace(/^GDLM \d+\s*/, "").toUpperCase(), num = (spec.name.match(/^GDLM \d+/) || [""])[0];
  out.push(K.text(615, 180, title, 1.6, { z: "B1", groups: [440] }), K.text(615, 145, num, 0.55, { z: "B1", groups: [440] }), K.alpha(900, 440, 0, 1));
  let credit = "";
  try { const id = String(spec.song.custom), j = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "local", "songs", id + ".json"), "utf8")); credit = `song: ${j.artist} - ${j.name}`; } catch (e) {}
  const cx = END - 250;
  if (credit) out.push(K.text(cx, 170, credit, 0.5, { z: "B1", groups: [441] }), K.alpha(T0, 441, 0, 0), K.alpha(cx - 500, 441, 1, 1.2));
  out.push(...K.sway(0, END, 412, 7, 100, 0.35));   // motion on every screen (ART.md "Deco study")
  // nothing in front of a hazard (within a block), except what dresses a solid block (tools/scenes/kit.js's rule)
  const kindOf = o => (O.objInfo(o.id) || {}).kind;
  const haz = objects.filter(o => kindOf(o) === "hazard"), solidCell = new Set(objects.filter(o => kindOf(o) === "solid").map(o => Math.floor(o.x / 30) + ":" + Math.floor(o.y / 30)));
  const front = o => { const z = o.props && o.props[24]; return z != null && z !== "" && +z >= 1; };
  const kept = out.filter(o => !(o.x != null && kindOf(o) !== "trigger" && front(o) && !solidCell.has(Math.floor(o.x / 30) + ":" + Math.floor(o.y / 30))
    && haz.some(h => Math.abs(h.x - o.x) < 30 && Math.abs(h.y - o.y) < 30)));
  return { objects: kept, header, signature: { shirt: secs[secs.length - 1].palette.accent } };
};
