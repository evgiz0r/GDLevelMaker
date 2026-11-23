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

const SPEED = 311.58;
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
// scenekit stand-ins for prop names lib/props.js has no picture for (SCENES.md)
const SKY = new Set(["moon", "sun"]);
const MOTES = { fog: 0.8, mist: 0.8, "green smoke": 1.2, embers: 2.5, fireflies: 2, "glowing plankton": 3, bubbles: 2.5, "fast bubbles": 4, "wind lines": 1.5 };

module.exports = function ({ objects, header, spec }) {
  const plan = spec.scenePlan, out = [], T0 = 3;
  const secs = plan.sections.map(s => ({ ...s, x0: s.t[0] * SPEED, x1: s.t[1] * SPEED }));
  const END = secs[secs.length - 1].x1, have = new Set(P.list().map(p => p.name));
  const alias = n => P.ALIAS && P.ALIAS[n] || n;
  // ---- channels: the level's own (props take theirs from 600 up, one block of 30 per section) ----
  const C = { glow: 1, far: 2, edge: 9, fill: 10, motes: 13, stars: 8, rays: 12 };
  const pal = s => ({ 1000: s.palette.bg, 1001: s.palette.ground, 1009: mix(s.palette.ground, s.palette.bg, 0.3), 1002: mix(s.palette.edge, [255, 255, 255], 0.2),
    1004: [245, 245, 250], [C.glow]: mix(s.palette.edge, s.palette.bg, 0.35), [C.far]: mix(s.palette.bg, [0, 0, 0], 0.45), [C.edge]: s.palette.edge, [C.fill]: s.palette.fill,
    [C.motes]: mix(s.palette.accent, s.palette.bg, 0.3), [C.stars]: mix(s.palette.accent, s.palette.bg, 0.4), [C.rays]: mix(s.palette.accent, s.palette.bg, 0.5) });
  const BLEND = new Set([C.glow, C.edge, C.motes, C.stars, C.rays]);
  const defs = {};
  for (const [ch, rgb] of Object.entries(pal(secs[0]))) defs[ch] = { rgb, blend: BLEND.has(+ch) };
  header = K.channels(header, defs);
  header = K.art(header, { bg: 1, ground: 1, line: 1 });
  secs.forEach((s, i) => { if (i) out.push(...K.palette(s.x0, pal(s), s.fade)); });

  // ---- depth: a far silhouette of the ground's colour, slower than the level ----
  out.push(...K.rocks(-300, END * 0.4 + 900, { ch: C.far, group: 400, z: "B4", every: 140, sMin: 3, sMax: 7, y: -40, ids: [50, 54] }));
  out.push(K.lockX(T0, 400, END / SPEED + 2, 0.6));

  // ---- per section: blocks as part of the place, props, camera ----
  const log = [];
  secs.forEach((s, i) => {
    const g = 410 + i, alloc = P.allocator ? P.allocator(600 + 30 * i) : undefined;
    out.push(...K.designBlocks(objects, s.x0, s.x1, { fill: C.fill, edge: C.edge, glow: C.glow, seed: 70 + i }));
    const quiet = s.role === "breather" || s.role === "intro", dens = quiet ? 0.8 : 1.4;
    for (const name of s.props) {
      const n = alias(name);
      if (SKY.has(n)) {
        // one moon / sun per section, high and to the right, drifting slowly with the screen (parallax 0.9)
        const r = P.put(n, s.x0 + 420, 170, { palette: s.palette, alloc, groups: [450 + i], layer: "B5" });
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
  const barX = plan.barSec * SPEED;
  for (let x = 0, k = 0; x < END; x += barX, k++) out.push(K.pulse(x, C.glow, mix(secs.find(s => x >= s.x0 && x < s.x1 + 1)?.palette.edge || [200, 200, 200], [255, 255, 255], 0.25), 0.1, 0.1, 0.8));
  const big = plan.sections.findIndex(s => (s.effects || []).some(e => /sky tint/.test(e)));
  if (big > 0) out.push(K.pulse(secs[big].x0, 1000, mix(secs[big].palette.bg, [255, 255, 255], 0.25), 0.05, 0.1, 1));

  // ---- title and credits ----
  const title = spec.name.replace(/^GDLM \d+\s*/, "").toUpperCase(), num = (spec.name.match(/^GDLM \d+/) || [""])[0];
  out.push(K.text(615, 180, title, 1.6, { z: "B1", groups: [440] }), K.text(615, 145, num, 0.55, { z: "B1", groups: [440] }), K.alpha(900, 440, 0, 1));
  let credit = "";
  try { const id = String(spec.song.custom), j = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..", "local", "songs", id + ".json"), "utf8")); credit = `song: ${j.artist} - ${j.name}`; } catch (e) {}
  const cx = END - 250;
  if (credit) out.push(K.text(cx, 170, credit, 0.5, { z: "B1", groups: [441] }), K.alpha(T0, 441, 0, 0), K.alpha(cx - 500, 441, 1, 1.2));
  return { objects: out, header, signature: { shirt: secs[secs.length - 1].palette.accent } };
};
