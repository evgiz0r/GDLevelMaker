// The GD 2.2 decoration kit: trigger-driven looks for tools/make.js (owner: the visuals session;
// gd-style calls it). Every function returns plain level objects {id, x, y, rot, props}.
//
//   const kit = require("./vfxkit.js");
//   objects.push(...kit.parallax(sections, { speed }));
//   objects.push(...kit.beatPulses(sections, grid, { xOfT, songOffset, drops: [t...] }));
//
// sections: [{from, to (columns), kind: cube|ship|wave|ball|upside|rest|break, fill:[r,g,b], light:[r,g,b], flash}]
//   (tools/decorate.js modernPass's list); section i's channels: fill CH0 + 2i, light CH0 + 2i + 1 (CH0 20).
// grid: {period (s per beat), t0 (song second of a beat), downbeat?} -- tools/make.js gridOf.
//
// parallax: two background layers per section (far and near) of big shapes that suit the section's
//   kind, in its fill channel darkened by object HSV, on layers B4 / B3. A move trigger locked to the
//   player's x (keys 58 = 1, 143 = how much of the player's motion the layer copies: 0.9 far, 0.6 near)
//   makes them scroll slower than the level; alpha triggers fade each layer in at its section's start
//   and out at its end, so a slow layer never drifts into the next section. Groups from opts.group0
//   (default 100): section i uses group0 + 2i (far) and + 1 (near).
// beatPulses: a pulse trigger (1006) on every bar start, on the section's light channel (towards white,
//   quick fade out), skipped in rest / break sections; on a section's first beat when it has `flash`,
//   and at every opts.drops time, a strong one on the background (1000) and the light channel.
//
// Checked in the viewer's GD art (lib/vfx.js draws both trigger kinds) with tools/shoot.js; not yet in
// the user's game. VISUALS.md "Deco kit".
"use strict";
const CH0 = 20, SPEED_1X = 311.58;
const ROW = r => r * 30 + 15;
const trig = (id, x, y, props) => ({ id, x, y, rot: 0, props: Object.assign({ 36: "1", 155: "1" }, props) });
const s = v => String(Math.round(v * 1000) / 1000);

// big shapes per kind (ids from knowledge/objects/catalogue.tsv): far layer, near layer
const SHAPES = {
  cube:   { far: [936, 937, 938], near: [222, 223, 224] },        // art clouds, round clouds
  ship:   { far: [48, 49, 129], near: [130, 131] },                // soft clouds
  wave:   { far: [394, 395], near: [396, 229] },                   // hexagons
  ball:   { far: [180, 181], near: [182, 137] },                   // cartwheels, wheel
  ufo:    { far: [936, 937], near: [1058, 1059] },
  upside: { far: [1058, 1059], near: [1060, 1061] },               // spirals
  rest:   { far: [222, 223], near: [224] },
  break:  { far: [222, 223], near: [224] },
};

// a section's x range in units
const xr = sec => [sec.from * 30, sec.to * 30];

function parallax(sections, opts = {}) {
  const speed = opts.speed || SPEED_1X, g0 = opts.group0 || 100, out = [];
  const layers = [
    { m: opts.farMul || 0.9, z: -3, zo: -20, scale: 3, v: 0.45, gap: 330, rows: [5, 8, 6, 9] },   // far: big, dark, slow
    // near: smaller and darker than first made -- at 1.8x / 70% its round clouds crossed hanging spikes in
    // cube timings and hurt hazard readability (gd-polish, 2026-11-23); shapes stay well below the hazards'
    // white outlines in brightness
    { m: opts.nearMul || 0.6, z: -1, zo: -10, scale: 1.3, v: 0.5, gap: 260, rows: [2, 4, 3, 5] }, // near
  ];
  sections.forEach((sec, i) => {
    const [x0, x1] = xr(sec), dur = (x1 - x0) / speed, shapes = SHAPES[sec.kind] || SHAPES.cube;
    layers.forEach((L, li) => {
      const g = g0 + 2 * i + li, ids = li === 0 ? shapes.far : shapes.near;
      // the layer copies m of the player's motion, so it crosses the screen (1 - m) as fast: it must span
      // what the screen sees of it during the section, plus a screen width
      const span = (x1 - x0) * (1 - L.m) + 900, start = x0 - 300;
      for (let k = 0, x = start; x < start + span; k++, x += L.gap) {
        out.push({ id: ids[k % ids.length], x: x + (k % 2) * L.gap * 0.3, y: ROW(L.rows[k % L.rows.length]), rot: 0, flipX: k % 3 === 1, flipY: false,
          props: { 21: String(CH0 + 2 * i), 24: String(L.z), 25: String(L.zo), 32: s(L.scale), 41: "1", 43: `0a1a${s(L.v)}a0a0`, 57: String(g), 155: "1" } });
      }
      // lock to the player for the section (+ the fade-out), from just before it starts
      out.push(trig(901, start, ROW(32 + li), { 10: s(dur + 1), 28: "0", 29: "0", 51: String(g), 58: "1", 143: s(L.m) }));
      // hidden until its section: off at the level start, in over 0.5 s at the section start, out at its end
      if (i > 0) out.push(trig(1007, -15, ROW(34 + 2 * i + li), { 10: "0", 35: "0", 51: String(g) }));
      out.push(trig(1007, x0, ROW(34 + li), { 10: "0.5", 35: "1", 51: String(g) }));
      out.push(trig(1007, x1, ROW(36 + li), { 10: "0.5", 35: "0", 51: String(g) }));
    });
  });
  return out;
}

// level x of song second t: opts.xOfT(levelTime) or constant speed; songOffset = song second at level t 0
function beatPulses(sections, grid, opts = {}) {
  const speed = opts.speed || SPEED_1X, off = opts.songOffset || 0;
  const xOfT = opts.xOfT || (t => t * speed);
  const out = [], endX = Math.max(...sections.map(sc => sc.to)) * 30;
  const secAt = x => sections.findIndex(sc => x >= sc.from * 30 && x < sc.to * 30);
  const white = [255, 255, 255];
  const pulse = (x, ch, rgb, fin, hold, fout, row) => out.push(trig(1006, x, ROW(row), {
    7: String(rgb[0]), 8: String(rgb[1]), 9: String(rgb[2]), 45: s(fin), 46: s(hold), 47: s(fout), 51: String(ch), 52: "0" }));
  // bar starts: every 4th beat from the downbeat
  const db = grid.downbeat || 0;
  const k0 = Math.ceil((off - grid.t0) / grid.period);
  for (let k = k0; ; k++) {
    const t = grid.t0 + k * grid.period - off;             // level time of beat k
    const x = xOfT(t);
    if (x > endX) break;
    if (((k - db) % 4 + 4) % 4 !== 0 || t < 0) continue;
    const i = secAt(x); if (i < 0) continue;
    const sec = sections[i];
    if (sec.kind === "rest" || sec.kind === "break") continue;
    pulse(x, CH0 + 2 * i + 1, opts.color || white, 0, 0.03, Math.min(0.6, grid.period * 1.2), 40);
  }
  // section starts with a flash, and drops: a strong pulse of the background and the light channel
  const strong = (x, i) => {
    const sec = sections[i] || {};
    pulse(x, 1000, sec.light || white, 0, 0.08, 0.9, 42);
    pulse(x, CH0 + 2 * i + 1, white, 0, 0.1, 0.8, 43);
  };
  sections.forEach((sec, i) => { if (sec.flash) strong(sec.from * 30, i); });
  for (const t of opts.drops || []) { const x = xOfT(t); const i = secAt(x); if (i >= 0) strong(x, i); }
  return out;
}

module.exports = { parallax, beatPulses, SHAPES, CH0 };

// node tools/vfxkit.js <level.gdlvl> [--song <id>] [--out <file>]  -- try the kit on any level: sections
// from its mode portals, a palette per section (colour triggers on channels CH0..), beat grid from
// local/beats (tools/beats.js) or 128 BPM. Writes local/tmp/<name>_kit.gdlvl, to look at with
// `node tools/shoot.js local/tmp/<name>_kit.gdlvl --at ...`.
if (require.main === module) {
  const path = require("path"), fs = require("fs"), { readGdlvl, writeGdlvl } = require("./io.js"), O = require("../lib/objects.js"), GD = require("../lib/gd.js");
  const args = process.argv.slice(2), opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
  const L = readGdlvl(args[0]);
  const objs = L.level.objects, endCol = Math.ceil(Math.max(...objs.map(o => o.x)) / 30) + 2;
  const KIND = { 12: "cube", 13: "ship", 47: "ball", 111: "ufo", 660: "wave" };
  const cuts = [{ col: 0, kind: "cube" }].concat(objs.filter(o => KIND[o.id]).map(o => ({ col: Math.round(o.x / 30), kind: KIND[o.id] }))).sort((a, b) => a.col - b.col);
  const PAL = [[[30, 60, 160], [120, 200, 255]], [[90, 20, 140], [230, 120, 255]], [[10, 110, 80], [120, 255, 190]], [[150, 50, 20], [255, 190, 90]], [[20, 90, 150], [140, 230, 255]]];
  const sections = cuts.map((c, i) => ({ from: c.col, to: i + 1 < cuts.length ? cuts[i + 1].col : endCol, kind: c.kind, fill: PAL[i % PAL.length][0], light: PAL[i % PAL.length][1], flash: i > 0 && c.kind !== cuts[i - 1].kind }))
    .filter(sc => sc.to - sc.from >= 4);
  const songId = opt("--song") || GD.getField(L.rec, "k45");
  let grid = null;
  try { const b = require("./beats.js").loadBeats("custom_" + songId); if (b && b.ok) grid = { period: b.period, t0: b.t0, downbeat: b.downbeat }; } catch (e) {}
  if (!grid) { grid = { period: 60 / 128, t0: 0 }; console.log("(no beat grid for song " + songId + ": 128 BPM)"); }
  const extra = [];
  sections.forEach((sc, i) => {
    for (const [ch, c] of [[CH0 + 2 * i, sc.fill], [CH0 + 2 * i + 1, sc.light]])
      if (!objs.some(o => o.id === 899 && +(o.props || {})[23] === ch)) // keep the colours a level sets itself
      extra.push(trig(899, -15, ROW(50 + extra.length), { 7: String(c[0]), 8: String(c[1]), 9: String(c[2]), 10: "0", 23: String(ch), 35: "1" }));
  });
  const p = parallax(sections), b = beatPulses(sections, grid, {});
  const name = path.basename(args[0], ".gdlvl"), out = opt("--out") || path.join(__dirname, "..", "local", "tmp", name + "_kit.gdlvl");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  GD.setField(L.rec, "k2", "s", L.name + " +kit");
  writeGdlvl(out, L.rec, { header: L.level.header, objects: objs.concat(extra, p, b) });
  console.log(`${sections.length} sections (${sections.map(sc => sc.kind).join(" ")}), parallax ${p.length} objects, pulses ${b.length}, colours ${extra.length} -> ${path.relative(process.cwd(), out)}`);
}
