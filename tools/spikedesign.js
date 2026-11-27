// node tools/spikedesign.js list                                  -- every design with what it is made of and its source
// node tools/spikedesign.js gallery [--out levels/gdlm_spike_designs.gdlvl] [--song Electrodynamix]
//   -> the SPIKE GALLERY: a short auto level (no click, 0.5x speed) that walks past every design, each shown three
//      ways -- a spike standing on a shelf, the same spike hanging under it, and a saw -- with its name above. The run with
//      the designs is checked to be the run without them (deco only), then the beat ending and the Claude signature.
// node tools/spikedesign.js check <level.gdlvl>                   -- the readability rules on every dressed hazard of a level
//
// One hazard, dressed (Evgeni, 2026-11-26: "do we have designs of singular spikes? like a spike inside a smaller spike?
// there are basically infinite way to create interesting spike with something inside (more smaller stuff, glow, layers)").
// A design is a function (hazard, opts) -> decoration objects in the hazard's own frame: they turn and flip with it, so the
// same design works standing, hanging and side-turned. The hazard itself is never touched (its id, position, scale and
// hitbox stay), and every part is decoration (no hitbox). Recipes come from tools/spikestudy.js (knowledge/spike_designs.json:
// what rated levels put inside one spike or saw); the measured share is in each design's `src`.
//
// Readability rules (check()): parts in FRONT of the hazard stay inside its silhouette (scale <= 0.8, centred) and use a
// channel other than the hazard's (so the spike's own colour edge stays all round it); parts BEHIND may reach 1.4x its size
// (glows, rims) but no further, so the hazard's outline is still where its hitbox is. HAZARDS.md "Dressing one hazard".
//
// Library: const SD = require("./spikedesign.js"); SD.DESIGNS (by name), SD.dress(hazard, name, ch), SD.dressAll(objects,
// {designs: [...] | "mix", seed, ch}), SD.check(objects), SD.CH (the ice palette's channels), SD.palette(name, ch0) -> {C, defs} (blockdesigns' PAL).
"use strict";
const fs = require("fs"), path = require("path");
const K = require("./scenekit.js");
const ROOT = path.join(__dirname, "..");

// colour ROLES, shared with the block designs (tools/blockdesigns.js, the deco-art thread) so spikes and blocks match:
// line (the hazard's own colour: its bright edge), inner (the swapped inner colour), glow (blending), core (a bright
// blending centre), shadow (dark rim), deep (a darker body), detail (small bright bits). A design gets C = {role: channel}.
const ROLES = ["line", "inner", "glow", "core", "shadow", "deep", "detail"];
const BD = require("./blockdesigns.js");
// channels 933-939 (ice) and 940-946 (fire): free between the blocks' 912-932 and the signature's 973-989
function palette(name, ch0) { const pal = BD.PAL[name] || BD.PAL.ice, C = {}, defs = {};
  ROLES.forEach((r, i) => { C[r] = ch0 + i; defs[ch0 + i] = Object.assign({ rgb: pal[r] }, r === "glow" ? { opacity: 0.6, blend: true } : r === "core" ? { opacity: 0.8, blend: true } : r === "detail" ? { blend: true } : {}); });
  return { C, defs }; }
const ICE = palette("ice", 933), FIRE = palette("fire", 940), CH = ICE.C;

// hazard kinds and their drawn size (blocks, catalogue.tsv): parts are scaled to it
const SPIKE = { 8: 1, 39: 0.45, 103: 0.65, 392: 0.35 }, SAW = { 88: 2.75, 89: 2, 98: 1.32, 183: 2, 184: 2, 185: 1.3, 186: 2.4, 187: 1.7, 188: 1.2,
  740: 2.6, 741: 1.9, 742: 1.3, 678: 2.6, 679: 1.9, 680: 1.3, 1705: 2.5, 1706: 1.8, 1707: 1.2, 1734: 2.5, 1735: 1.8, 1736: 1.2 };
const kindOf = id => SPIKE[id] != null ? "spike" : SAW[id] != null ? "saw" : null;
const sizeOf = h => { const p = h.props || {}, s = +(p[32] || 1); return (SPIKE[h.id] || SAW[h.id] || 1) * s; };

// a part in the hazard's frame -> a world object. l: {id, lx, ly (units of the hazard's half size: -1 = its base for a spike),
// s (scale against the hazard's drawn size, then x the part's own), rot, front (true = in front), z, ch, flipY}
function place(h, l, size) {
  const half = 15 * size; let lx = l.lx * half, ly = l.ly * half, flipY = !!l.flipY, flipX = !!l.flipX;
  if (h.flipX) { lx = -lx; flipX = !flipX; } if (h.flipY) { ly = -ly; flipY = !flipY; }
  const a = (h.rot || 0) * Math.PI / 180;   // GD turns clockwise
  const x = h.x + lx * Math.cos(a) + ly * Math.sin(a), y = h.y - lx * Math.sin(a) + ly * Math.cos(a);
  const hz = +((h.props || {})[24] || 5);  // the hazard's layer (T1 by default)
  const z = l.z != null ? l.z : l.front ? Math.max(hz, 5) : 1;          // front: on the hazard's layer, above it; behind: B2
  // GD draws a spike / saw at z order 2 on T1 (lib/objects_art.js): front parts go above it, behind parts below
  const hzo = +((h.props || {})[25] || 2);
  const o = K.obj(l.id, x, y, { ch: l.ch, z, zo: l.front ? hzo + 1 + (l.zo || 0) : -2 + (l.zo || 0), s: +(l.s * size).toFixed(3), rot: ((h.rot || 0) + (!!h.flipX !== !!h.flipY ? -1 : 1) * (l.rot || 0) + 360) % 360, flipX, flipY });
  delete o.props[155];
  o._part = { front: !!l.front, rel: l.s * (l.own || 1), of: h, l };
  return o;
}

// ---- the designs. Each: {kind, src (what rated levels do, from spikestudy), parts(ch, R) -> [part]} ----
// fake spike 1889 / 191 (a spike-shaped decoration, no hitbox) is what makes "a spike inside a spike"
const D = {
  glow: { kind: "spike", src: "a soft gradient behind the spike on a glow channel: 1011 / 503 on 59 / 52 of 127 levels, the most used dressing (503 here: 1011 drew a square box behind it)",
    parts: c => [{ id: 503, lx: 0, ly: -0.35, s: 1.0, ch: c.glow }] },
  halo: { kind: "spike", src: "a bigger spike shape behind on a blending channel: a lit rim all round (26 levels put the lit triangle 693 on spikes; 693 is a right triangle, so the spike-shaped 1889 here)",
    parts: c => [{ id: 1889, lx: 0, ly: -1 + 1.0 + 0.3, s: 1.0, ch: c.glow }] },
  inner: { kind: "spike", src: "a smaller copy of the hazard inside it on its own channel (2.2 levels: Free the Boys, Mission S; 39% of 2.2 hazards have a part under 0.85x)",
    parts: c => [{ id: 1889, lx: 0, ly: -1 + 0.55, s: 0.55, front: true, ch: c.inner }] },
  nested: { kind: "spike", src: "two copies inside, alternating colours (Mission S nests its saws 0.9 / 0.7 / 0.5)",
    parts: c => [{ id: 1889, lx: 0, ly: -1 + 0.72, s: 0.72, front: true, ch: c.inner }, { id: 1889, lx: 0, ly: -1 + 0.4, s: 0.4, front: true, zo: 1, ch: c.line }] },
  core: { kind: "spike", src: "a small glow ball 1764 in the spike: 28 levels (mostly behind; in front it reads as a lit core)",
    parts: c => [{ id: 1764, lx: 0, ly: -0.45, s: 0.95, own: 0.27, front: true, ch: c.inner }, { id: 1764, lx: 0, ly: -0.45, s: 2.2, own: 0.27, ch: c.glow }] },
  ring: { kind: "spike", src: "a lit ring in the spike: a ball in the inner colour with a smaller dark one in it (Free the Boys rings its pit spikes with fade rings 1838; 1838 is a quarter piece)",
    parts: c => [{ id: 1764, lx: 0, ly: -0.42, s: 1.5, own: 0.27, front: true, ch: c.inner }, { id: 1764, lx: 0, ly: -0.42, s: 0.85, own: 0.27, front: true, zo: 1, ch: c.deep }] },
  layers: { kind: "spike", src: "glow + an inner spike + a core: the 2.2 'layered' spike (67% of 2.2 hazards carry 2+ parts)",
    parts: c => [{ id: 503, lx: 0, ly: -0.35, s: 1.0, ch: c.glow }, { id: 1889, lx: 0, ly: -1 + 0.6, s: 0.6, front: true, ch: c.inner }, { id: 1764, lx: 0, ly: -0.55, s: 0.8, own: 0.27, front: true, zo: 1, ch: c.line }] },
  // Evgeni 2026-11-27 on hellgate's spikes: "maybe a bit prettier spike, with more effects": the layered spike plus a
  // fanned burst behind and a hot glow at its foot -- four parts, the hitbox still the one spike
  ember: { kind: "spike", src: "layers + crown: glow 503, a fanned pair of spikes behind, an inner spike and a lit core in front, a soft glow at the foot",
    // capped to the block (Evgeni 2026-11-27: "the glow is too wide, it goes out of the block"): the burst and glows stay
    // inside the spike's cell width (check() "capped to the block")
    parts: c => [{ id: 1889, lx: -0.3, ly: -1 + 0.55, s: 0.5, rot: -20, ch: c.glow }, { id: 1889, lx: 0.3, ly: -1 + 0.55, s: 0.5, rot: 20, ch: c.glow },
      { id: 503, lx: 0, ly: -0.35, s: 1.0, ch: c.glow }, { id: 504, lx: 0, ly: -0.85, s: 1.0, ch: c.glow },
      { id: 1889, lx: 0, ly: -1 + 0.6, s: 0.6, front: true, ch: c.inner }, { id: 1764, lx: 0, ly: -0.55, s: 0.8, own: 0.27, front: true, zo: 1, ch: c.line }] },
  // FIRE (Evgeni 2026-11-27: "i want some firey objects too on the grownd sometims as hazards where spikes are"): the spike
  // burns -- GD's looped fire 923 (animated in the game) rises behind it from its foot on a blending glow channel, a hot
  // glow 504 at the foot, a dark ember spike and a lit core in front. The hitbox is still the one spike, and the flame stays
  // in the spike's block width (0.7x of a 0.97-block flame). Themes put it on some standing spikes (structdeco "fire": N)
  fire: { kind: "spike", src: "the looped fire 920-924 / fire_b 1936-1939 effects of 2.2 (catalogue.tsv 'effects'), behind the spike like the 1011 / 503 glows",
    parts: c => [{ id: 923, lx: 0, ly: -1 + 1.28, s: 0.7, ch: c.glow }, { id: 504, lx: 0, ly: -0.85, s: 1.0, ch: c.core },
      { id: 1889, lx: 0, ly: -1 + 0.6, s: 0.6, front: true, ch: c.deep }, { id: 1764, lx: 0, ly: -0.5, s: 0.7, own: 0.27, front: true, zo: 1, ch: c.core }] },
  crown: { kind: "spike", src: "spikes fanned out behind it (35 levels put copies of a spike turned 90 / 270 on it: a burst); here decoration in the glow colour, so the hitbox is the one spike",
    parts: c => [{ id: 1889, lx: -0.25, ly: -1 + 0.6, s: 0.6, rot: -18, ch: c.glow }, { id: 1889, lx: 0.25, ly: -1 + 0.6, s: 0.6, rot: 18, ch: c.glow }] },
  double: { kind: "spike", src: "a second outline: a bigger copy behind in the inner colour ('same hazard on another channel' in 16 levels)",
    parts: c => [{ id: 1889, lx: 0, ly: -1 + 1.0 + 0.22, s: 1.0, ch: c.inner }] },
  crystals: { kind: "spike", src: "low deco spikes 20 / 21 at its foot: 39 / 25 levels (pit rows)",
    parts: c => [{ id: 21, lx: -0.45, ly: -0.84, s: 0.4, own: 1.4, ch: c.glow }, { id: 21, lx: 0.45, ly: -0.84, s: 0.4, own: 1.4, flipX: true, ch: c.glow }] },
  // saws
  cog: { kind: "saw", src: "a cogwheel 85-87 behind the saw, teeth out past its rim (24-30 levels each), lit in the glow colour", parts: c => [{ id: 86, lx: 0, ly: 0, s: 1.3 / 1.8, own: 1.8, ch: c.glow }] },
  sawcore: { kind: "saw", src: "a glow ball at the hub in front (1764 on 22 levels' saws; 211 at half size behind on 55, hidden by the saw's black body)",
    parts: c => [{ id: 1764, lx: 0, ly: 0, s: 0.35 / 0.27, own: 0.27, front: true, ch: c.inner }] },
  sawnest: { kind: "saw", src: "a smaller wheel inside the saw on its own channel (Mission S: rings at 0.5-0.9; Avarinth: circles 3637 inside)",
    parts: c => [{ id: 87, lx: 0, ly: 0, s: 0.55 / 1.25, own: 1.25, front: true, ch: c.inner }, { id: 1764, lx: 0, ly: 0, s: 0.2 / 0.27, own: 0.27, front: true, zo: 1, ch: c.line }] },
  // Evgeni 2026-11-27 on hellgate's saws: "ugly black circles, bad hazards" -- one dressing was not enough: glow, teeth
  // and a lit wheel inside, so the saw reads as a machine part of the theme, not a hole
  sawforge: { kind: "saw", src: "glow 50 behind + a cogwheel 86 past the rim + a smaller wheel 87 and a core in front (the layered 2.2 saw: sawglow + cog + sawnest)",
    parts: c => [{ id: 50, lx: 0, ly: 0, s: 1.25, ch: c.glow }, { id: 86, lx: 0, ly: 0, s: 1.3 / 1.8, own: 1.8, ch: c.glow },
      { id: 87, lx: 0, ly: 0, s: 0.6 / 1.25, own: 1.25, front: true, ch: c.inner }, { id: 1764, lx: 0, ly: 0, s: 0.22 / 0.27, own: 0.27, front: true, zo: 1, ch: c.line }] },
  sawglow: { kind: "saw", src: "a round glow 50 behind the saw (29 levels) on a blending channel, a little past its teeth", parts: c => [{ id: 50, lx: 0, ly: 0, s: 1.12, ch: c.glow }] },
};
const DESIGNS = D;

function dress(h, name, ch = CH) {
  const d = D[name], k = kindOf(h.id); if (!d || !k || d.kind !== k) return [];
  return d.parts(ch).map(l => place(h, l, sizeOf(h)));
}
// every hazard of a level: designs = [names] (taken in turn, seeded) or "mix" (each kind's designs); returns the new objects
function dressAll(objects, o = {}) {
  const R = K.rng(o.seed || 1), out = [], ch = o.ch || CH;
  // Evgeni's votes weight the pick (tools/designs.js: 3 liked, 1 unvoted, 0.25 disliked; never a ban)
  let W = () => 1; try { const w = require("./designs.js").weight; W = (k, n) => { try { return w(k, n); } catch (e) { return 1; } }; } catch (e) {}
  if (typeof o.weight === "function") W = o.weight;
  const pick = k => { const names = Array.isArray(o.designs) ? o.designs.filter(n => D[n] && D[n].kind === k) : Object.keys(D).filter(n => D[n].kind === k);
    const ws = names.map(n => W(k, n)), tot = ws.reduce((a, b) => a + b, 0); let r = R() * tot;
    for (let i = 0; i < names.length; i++) { r -= ws[i]; if (r < 0) return names[i]; } return names[names.length - 1]; };
  for (const h of objects) { const k = kindOf(h.id); if (!k) continue; const n = pick(k); if (n) out.push(...dress(h, n, ch)); }
  return out;
}

// the readability rules: returns [{x, y, why}] -- a front part bigger than 0.8x or off the hazard's centre, a front part on
// the hazard's own channel, a behind part over 1.4x, any part with a hitbox
// glows and gradients: see-through (they light the hazard, they do not cover it), so the size rule leaves them be in front
// a part's drawn width and height at scale 1 (lib/look.js FLAT; 1764's own size is in its `own`)
const PART_W = { 923: [29, 55], 503: [30, 20], 504: [20, 20], 1889: [30, 30], 21: [30, 14], 1764: [30, 30], 211: [30, 30] };
const SEE_THROUGH = new Set([211, 1753, 503, 504, 1011, 1012, 1292, 1293, 693, 694, 695, 696]);
function check(objects, o = {}) {
  const { GD } = require("./io.js"), bad = [];
  for (const p of objects) {
    const m = p._part; if (!m) continue; const h = m.of, hc = +((h.props || {})[21] || 0), pc = +((p.props || {})[21] || 0);
    const inf = GD.objInfo(p.id); if (inf.kind !== "decoration") bad.push({ x: p.x, y: p.y, why: `part ${p.id} is ${inf.kind}, not decoration` });
    const d = Math.hypot(p.x - h.x, p.y - h.y) / (15 * sizeOf(h));
    if (m.front && m.rel > 0.8 && !SEE_THROUGH.has(p.id)) bad.push({ x: p.x, y: p.y, why: `front part ${p.id} at ${m.rel.toFixed(2)}x covers the hazard's edge` });
    if (m.front && d > 0.7 && !SEE_THROUGH.has(p.id)) bad.push({ x: p.x, y: p.y, why: `front part ${p.id} off the hazard's centre (${d.toFixed(2)})` });
    if (m.front && hc && pc === hc && m.rel > 0.5) bad.push({ x: p.x, y: p.y, why: `front part ${p.id} on the hazard's own channel ${hc}: no edge` });
    if (!m.front && m.rel > 1.4) bad.push({ x: p.x, y: p.y, why: `behind part ${p.id} at ${m.rel.toFixed(2)}x: the outline leaves the hitbox` });
    // CAPPED TO THE BLOCK (Evgeni 2026-11-27, hellgate: "the glow is too wide, it goes out of the block, should be capped
    // to the block for now"): a spike's parts stay inside its cell's width (its own frame, turned parts by their box)
    if (kindOf(h.id) === "spike" && m.l && o.cap !== false) { const W = PART_W[p.id] || [30, 30], a = Math.abs((m.l.rot || 0) * Math.PI / 180);
      const hw = (Math.cos(a) * W[0] + Math.sin(a) * W[1]) / 2 * m.rel, ext = Math.abs(m.l.lx) * 15 + hw;
      if (ext > 15.5) bad.push({ x: p.x, y: p.y, why: `part ${p.id} reaches ${ext.toFixed(1)} units from the spike's middle: past its block (15)` }); }
  }
  return bad;
}
const strip = objs => objs.map(o => { if (!o._part) return o; const c = Object.assign({}, o); delete c._part; return c; });

// ---------------------------------------------------------------- the gallery level
function gallery(o = {}) {
  const { GD } = require("./io.js"), AB = require("./autobeat.js");
  const g = AB.loadGrid(o.song || "Electrodynamix");
  const SPD = 251.16 / 240;   // 0.5x: units a tick (lib/physics.js SPEEDS)
  const names = Object.keys(D), spikes = names.filter(n => D[n].kind === "spike"), saws = names.filter(n => D[n].kind === "saw");
  const play = [], deco = [], X0 = 420, STEP = 210;
  // one stop per spike design: an ICE spike standing on a shelf, a FIRE spike hanging under it, a saw above (the saw designs
  // in turn, ice and fire alternating); the plain ones first, to compare. Shelves in the fire palette's deep colour.
  const blk = (x, y) => K.obj(1, x, y, { ch: FIRE.C.deep });
  const stops = ["plain"].concat(spikes);
  stops.forEach((n, i) => {
    const x = X0 + i * STEP, sawPal = i % 2 ? FIRE : ICE;
    for (const dx of [-30, 0, 30]) play.push(blk(x + dx, 105));
    const up = { id: 8, x, y: 135, rot: 0, flipX: false, flipY: false, props: { 21: String(ICE.C.line) } };
    const down = { id: 8, x, y: 75, rot: 0, flipX: false, flipY: true, props: { 21: String(FIRE.C.line) } };
    const sawName = i === 0 ? "plain" : saws[(i - 1) % saws.length];
    const saw = { id: 89, x, y: 225, rot: 0, flipX: false, flipY: false, props: { 21: String(sawPal.C.line) } };
    play.push(up, down, saw);
    if (n !== "plain") deco.push(...dress(up, n, ICE.C), ...dress(down, n, FIRE.C));
    if (sawName !== "plain") deco.push(...dress(saw, sawName, sawPal.C));
    deco.push(K.text(x, 300, (i ? i + " " : "") + n, 0.5, { ch: ICE.C.detail, z: 5 }));
    if (sawName !== "plain") deco.push(K.text(x, 280, "saw: " + sawName, 0.32, { ch: ICE.C.inner, z: 5 }));
  });
  deco.push(K.zoom(5, 0.7, 0));   // zoomed out: shelf, hanging spike, saw and label all on screen
  let header = GD.DEFAULT_HEADER.replace(/(^|,)kA4,[^,;]*/, "$1kA4,1"); if (!/(^|,)kA4,/.test(header)) header += ",kA4,1";
  header = K.channels(header, Object.assign({}, ICE.defs, FIRE.defs, { 1000: { rgb: [12, 16, 30] }, 1001: { rgb: [20, 26, 44] }, 1009: { rgb: [30, 38, 60] } }));
  const objStr = q => { let s = `1,${q.id},2,${(+q.x).toFixed(2)},3,${(+q.y).toFixed(2)}`; if (q.flipX) s += ",4,1"; if (q.flipY) s += ",5,1"; if (q.rot) s += ",6," + q.rot;
    for (const [k, v] of Object.entries(q.props || {})) if (!["1", "2", "3", "4", "5", "6"].includes(k)) s += `,${k},${v}`; return s; };
  const lstr = objs => header + ";" + objs.map(objStr).join(";") + ";";
  const run = objs => { const lv = GD.parseLevel(lstr(objs)); const r = GD.run(GD.makeWorld(lv.objects, lv.header), []); return r; };
  const endX = X0 + stops.length * STEP + 150;
  const far = { id: 1764, x: endX + 900, y: 1500, props: {} };
  const base = run(play.concat(far)), withD = run(play.concat(strip(deco), far));
  const same = base.path.length === withD.path.length && base.path.every((s, i) => Math.abs(s.x - withD.path[i].x) < 1e-6 && Math.abs(s.y - withD.path[i].y) < 1e-6);
  // the beat ending + the signature (every level gets them)
  const be = require("./beatend.js").beatEnd(lstr(play), { period: g.period, t0: g.t0, fromX: endX });
  const all = play.concat(be.objects), fin = run(all.concat(strip(deco)).concat([{ id: 1764, x: be.endX, y: 1500, props: {} }]));
  const sg = require("./signature.js"), p = fin.path;
  const xAt = t => { const i = Math.round(t * 240); return i < p.length ? p[i].x : p[p.length - 1].x + (i - p.length + 1) * SPD; };
  const tOfX = x => { let i = p.findIndex(s => s.x >= x); if (i < 0) i = p.length - 1; return i / 240; };
  header = sg.header(header, { col: be.signCol, floorY: be.floorY || 0 });
  const sign = sg.signature({ col: be.signCol, floorY: be.floorY || 0, period: g.period, beats: be.beats, xOfT: xAt, tOfX });
  const lvl = GD.parseLevel(lstr(all.concat(strip(deco))));
  lvl.objects = sg.clipEnd(lvl.objects.concat(sign), be.signCol);
  const bad = check(deco);
  return { g, level: lvl, layoutStr: lstr(all), measures: { secs: +(p.length / 240).toFixed(1), designs: names.length, parts: deco.length,
    decoChangesRun: !same, clears: !fin.dead && !withD.dead, why: fin.why || withD.why || "", readability: bad.length }, bad };
}

function main() {
  const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
  if (a[0] === "list" || !a[0]) {
    for (const [n, d] of Object.entries(D)) console.log(`${n.padEnd(9)} ${d.kind.padEnd(5)} ${d.parts(CH).map(p => p.id + "@" + p.s + (p.front ? " front" : "")).join(", ").padEnd(42)} ${d.src}`);
    return;
  }
  if (a[0] === "check") {
    const { GD, readGdlvl } = require("./io.js"), r = readGdlvl(a[1]);
    // a saved level has no _part marks: rebuild them by matching decoration centred on each hazard
    const objs = r.level.objects, haz = objs.filter(o => kindOf(o.id)), out = [];
    for (const h of haz) for (const d of objs) { if (d === h || GD.objInfo(d.id).kind !== "decoration") continue;
      const dist = Math.hypot(d.x - h.x, d.y - h.y); if (dist > 15 * sizeOf(h)) continue;
      const z = +((d.props || {})[24] || 0), hz = +((h.props || {})[24] || 5), zo = +((d.props || {})[25] || 0), hzo = +((h.props || {})[25] || 0);
      const front = z > hz || (z === hz && zo > hzo);
      out.push(Object.assign({}, d, { _part: { front, rel: +((d.props || {})[32] || 1) / ((h.props || {})[32] || 1) * (catSize(d.id) / (SPIKE[h.id] || SAW[h.id] || 1)), of: h } })); }
    const bad = check(out); console.log(`${haz.length} hazards, ${out.length} parts on them, ${bad.length} readability notes`); for (const b of bad.slice(0, 30)) console.log(`  x ${Math.round(b.x)} y ${Math.round(b.y)}: ${b.why}`);
    return;
  }
  if (a[0] === "gallery") {
    const { GD, writeGdlvl } = require("./io.js"), t0 = Date.now();
    const b = gallery({ song: opt("--song") });
    const out = path.resolve(opt("--out", path.join(ROOT, "levels", "gdlm_spike_designs.gdlvl"))), name = opt("--name", "GDLM spike designs");
    const sg = require("./signature.js");
    const rec = GD.newRecord(name, sg.describe("spike gallery: one design per stop, standing, hanging and as a saw (auto, no click; HAZARDS.md)"));
    if (b.g.k45) GD.setField(rec, "k45", "i", b.g.k45); else GD.setField(rec, "k8", "i", String(b.g.k8));
    fs.mkdirSync(path.dirname(out), { recursive: true }); writeGdlvl(out, rec, b.level);
    try { const st = require("./stages.js"), base = path.basename(out, ".gdlvl"), session = opt("--session", "hazards");
      st.put({ session, base, name, stage: "layout", levelStr: b.layoutStr, note: "shelves with plain spikes and saws" });
      st.put({ session, base, name, stage: "final", levelStr: GD.serializeLevel ? GD.serializeLevel(b.level) : undefined, note: b.measures.designs + " designs" }); } catch (e) { console.log("  stages: " + e.message); }
    for (const x of b.bad) console.log(`  readability: x ${Math.round(x.x)}: ${x.why}`);
    console.log(JSON.stringify(b.measures));
    console.log(`${b.measures.clears ? "CLEARS with no press" : "DIES: " + b.measures.why}${b.measures.decoChangesRun ? "  !! the designs change the run" : ""} -> ${path.relative(ROOT, out)} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  }
}
// a decoration's drawn size in blocks (catalogue.tsv), for check() on saved levels
let CAT = null;
function catSize(id) {
  if (!CAT) { CAT = {}; try { for (const l of fs.readFileSync(path.join(ROOT, "knowledge", "objects", "catalogue.tsv"), "utf8").split("\n").slice(1)) { const c = l.split("\t"); if (c[0]) CAT[c[0]] = Math.max(+c[5] || 1, +c[6] || 1); } } catch (e) {} }
  return CAT[id] || 1;
}
if (require.main === module) main();
module.exports = { DESIGNS, CH, ROLES, palette, ICE, FIRE, dress, dressAll, check, strip, kindOf, gallery };
