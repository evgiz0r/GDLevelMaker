// tools/effects.js -- music-synced visual effects written straight into a level (EFFECTS.md).
//   const FX = require("./effects.js");
//   const ctx = FX.context({ path, grid, notes });       // path: a zero-press GD.run path; grid {t0, period}; notes [{t, strength}]
//   objects.push(...FX.ring(ctx, { t0: 20, t1: 27 }));   // every effect: (ctx, {t0, t1, ...params}) -> GD objects
//   objects.push(...ctx.prelude());                      // once, at the end: hides the effects' groups at the level start
//   header = ctx.header(header);                         // once: the effects' colour channels in the header (kS38)
// `node tools/effects.js` lists the effects with their parameters.
//
// Evgeni (2026-11-26): "i want to gain the controls, my imagination is not strong enough yet. from dancing blocks on the
// screen, to small glows along the path with clouds around us to a dancing circle around us pulsing to the song". Mainly for
// AUTO levels (no click: the path is known in advance, so an effect can be timed to the player's exact position on a note).
//
// Rules every effect keeps:
// - Deco only: every object is decoration (no hitbox) or a trigger; groups are only ever on effect objects, so a move /
//   toggle never touches gameplay. tests/effects.js checks the zero-press run is the same with and without the effects.
// - Triggers fire when the player's x passes theirs; "at time t" means at the x the player has at t (ctx.xAt, from the run),
//   so speed portals and pads are taken into account.
// - Trusted triggers first: alpha 1007, move 901 (incl. lock to player / camera), rotate 1346, scale 2067, toggle 1049,
//   colour 899. Pulse 1006 only in `pulseFlash`, labelled untested (Evgeni does not trust pulse yet).
// - Trigger keys checked against 8 rated 2.2 community levels (EFFECTS.md "Trigger keys").
// - Groups 2001-3999 and colour channels 800-849 are this toolkit's (signature 960+ / 976-996, decofx 1201+ / 950-957,
//   blockart 900-911, decoart 700-799, groups 1101-1111).
"use strict";
const K = require("./scenekit.js");
const TPS = 240;
const r3 = v => String(Math.round(v * 1000) / 1000);

// ------------------------------------------------------------------ triggers (keys: EFFECTS.md "Trigger keys")
const T = {
  alpha: (x, g, to, secs) => K.trig(1007, x, { 51: String(g), 35: r3(to), 10: r3(secs) }),
  // move by (dx, dy) units over secs; easing 0 none, 1 in-out, 2 in, 3 out, ... 13 sine in-out, 14 sine in, 15 sine out
  move: (x, g, dx, dy, secs, ease = 0) => K.trig(901, x, { 51: String(g), 28: r3(dx), 29: r3(dy), 10: r3(secs), 30: String(ease), 85: "2" }),
  // follow the player's x / y (58 / 59) for secs; mod 1 = moves with the player, 0.5 = half as much (143 / 144)
  lockPlayer: (x, g, secs, o = {}) => K.trig(901, x, Object.assign({ 51: String(g), 28: "0", 29: "0", 10: r3(secs), 85: "2" },
    o.x !== false ? { 58: "1", 143: r3(o.modX ?? 1) } : {}, o.y ? { 59: "1", 144: r3(o.modY ?? 1) } : {})),
  // follow the camera's x / y (141 / 142): the group keeps its place on the screen (mod < 1: a slow far layer)
  lockCamera: (x, g, secs, o = {}) => K.trig(901, x, Object.assign({ 51: String(g), 28: "0", 29: "0", 10: r3(secs), 85: "2", 141: "1", 143: r3(o.modX ?? 1) },
    o.y !== false ? { 142: "1", 144: r3(o.modY ?? 1) } : {})),
  // turn by deg over secs about the centre group (71) or each object's own centre
  rotate: (x, g, deg, secs, o = {}) => K.rotate(x, g, deg, secs, o),
  // scale by (sx, sy) over secs about the centre group (71); o.div: divide instead (undo an earlier scale exactly)
  scale: (x, g, sx, sy, secs, o = {}) => K.trig(2067, x, Object.assign({ 51: String(g), 150: r3(sx), 151: r3(sy), 10: r3(secs), 30: String(o.ease || 0), 85: "2" },
    o.centre ? { 71: String(o.centre) } : {}, o.div ? { 153: "1", 154: "1" } : {})),
  toggle: (x, g, on) => K.toggle(x, g, on),
  colour: (x, ch, rgb, secs, opacity = 1) => K.colour(x, ch, rgb, secs, opacity),
  pulse: (x, target, rgb, fin, hold, fout, o = {}) => K.pulse(x, target, rgb, fin, hold, fout, o),
  zoom: (x, to, secs) => K.zoom(x, to, secs),
};

// ------------------------------------------------------------------ the context: time <-> x, notes, groups, channels
function context(o) {
  const p = o.path, g = o.grid || { t0: 0, period: 0.5 }, notes = (o.notes || []).slice().sort((a, b) => a.t - b.t);
  const last = p[p.length - 1], v = 311.58;
  const at = t => { const i = Math.round(t * TPS); return i < 0 ? p[0] : i < p.length ? p[i] : null; };
  const xAt = t => { const s = at(t); return s ? s.x : last.x + (t * TPS - p.length + 1) * v / TPS; };
  const yAt = t => { const s = at(t); return s ? s.y : last.y; };
  let nextGroup = o.group0 || 2001, nextCh = o.ch0 || 800;
  const chans = {}, hidden = new Set(), off = new Set();
  const ctx = {
    path: p, grid: g, xAt, yAt, v,
    tAt: x => { let lo = 0, hi = p.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (p[m].x >= x) hi = m; else lo = m + 1; } return lo / TPS; },
    // beats (level times) in [t0, t1): every `every` beats, starting `phase` beats after the grid
    beats(t0, t1, every = 1, phase = 0) { const out = []; for (let k = Math.ceil((t0 - g.t0) / g.period / every - 1e-9) * every + phase; g.t0 + k * g.period < t1 - 1e-6; k += every) if (g.t0 + k * g.period >= t0 - 1e-6) out.push(g.t0 + k * g.period); return out; },
    // the song's notes in [t0, t1) at or above strength s, never two closer than gap
    notes(t0, t1, s = 0.5, gap = 0.12) { const out = []; for (const n of notes) if (n.t >= t0 && n.t < t1 && n.strength >= s && (!out.length || n.t - out[out.length - 1].t >= gap)) out.push(n); return out; },
    // where the player touched something: take-offs and landings (from the run's grounded flag)
    contacts(t0, t1) { const out = []; for (let i = Math.max(1, Math.round(t0 * TPS)); i < Math.min(p.length, t1 * TPS); i++) { const a = p[i - 1].grounded, b = p[i].grounded; if (a !== b) out.push({ t: i / TPS, x: p[i].x, y: p[i].y, kind: b ? "land" : "off" }); } return out; },
    group: () => nextGroup++,
    // a colour channel of the effects', defined in the header; blend = additive (glows)
    channel(rgb, o = {}) { const ch = nextCh++; chans[ch] = { rgb, blend: !!o.blend, opacity: o.opacity ?? 1 }; return ch; },
    hideAtStart: gr => { hidden.add(gr); return gr; },     // alpha 0 from the first tick
    offAtStart: gr => { off.add(gr); return gr; },         // toggled off from the first tick
    prelude() { const x = (p[0].x || 0) + 3, out = []; for (const gr of hidden) out.push(T.alpha(x, gr, 0, 0)); for (const gr of off) out.push(T.toggle(x, gr, false)); return out; },
    header: h => K.channels(h, chans),
  };
  return ctx;
}
const D = (id, x, y, o = {}) => K.obj(id, x, y, o);    // one deco object (scenekit's obj: ch, z, zo, s, sx, sy, rot, groups, hsv)

// ------------------------------------------------------------------ the effects
const FX = {};
const doc = {};

doc.label = "text locked to the screen for the section, fading in and out: {text, sub, y}. The visible screen is about 7.5 blocks over the ground and 6.5 behind / 12 ahead of the player at 1x";
FX.label = (c, o) => {
  const g = c.hideAtStart(c.group()), x0 = c.xAt(o.t0), dur = o.t1 - o.t0, ch = o.ch || c.channel([255, 255, 255]);
  const out = [D(914, x0 + 150, o.y ?? 205, { s: 0.6, ch, z: "T3", groups: [g], props: { 31: b64(o.text) } })];
  if (o.sub) out.push(D(914, x0 + 150, (o.y ?? 205) - 20, { s: 0.35, ch, z: "T3", groups: [g], props: { 31: b64(o.sub) } }));
  out.push(T.lockCamera(x0, g, dur), T.alpha(x0, g, 1, 0.3), T.alpha(c.xAt(o.t1 - 0.4), g, 0, 0.35));
  return out;
};
const b64 = s => Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_");

doc.fadeBlocks = "ALPHA: a checkerboard of squares on the screen, the two halves trading places on every beat: {cols, rows, every, lo, fade, rgb}";
FX.fadeBlocks = (c, o) => {
  const A = c.hideAtStart(c.group()), B = c.hideAtStart(c.group()), all = c.group(), x0 = c.xAt(o.t0);
  const cols = o.cols ?? 12, rows = o.rows ?? 3, sz = 26, ch = c.channel(o.rgb || [90, 200, 255], { blend: true }), out = [];
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++)
    out.push(D(211, x0 - 60 + i * 30, 120 + j * 30, { ch, z: "B2", s: sz / 30, groups: [(i + j) % 2 ? A : B, all] }));
  out.push(T.lockCamera(x0, all, o.t1 - o.t0));
  const lo = o.lo ?? 0.1, f = o.fade ?? 0.08;
  c.beats(o.t0, o.t1, o.every ?? 1).forEach((t, k) => { const x = c.xAt(t); out.push(T.alpha(x, k % 2 ? A : B, 1, f), T.alpha(x, k % 2 ? B : A, lo, f * 3)); });
  const xe = c.xAt(o.t1 - 0.3); out.push(T.alpha(xe, A, 0, 0.3), T.alpha(xe, B, 0, 0.3));
  return out;
};

doc.chase = "TOGGLE: a row of lights, one of n groups on at a time, moving along on every half beat: {n, count, every, rgb}";
FX.chase = (c, o) => {
  const n = o.n ?? 4, gs = Array.from({ length: n }, () => c.offAtStart(c.group())), all = c.group(), x0 = c.xAt(o.t0), out = [];
  const ch = c.channel(o.rgb || [255, 220, 90], { blend: true });
  for (let i = 0; i < (o.count ?? 16); i++) {
    out.push(D(1764, x0 - 60 + i * 24, 175, { ch, z: "T2", s: 2.2, groups: [gs[i % n], all] }));
    out.push(D(1764, x0 - 60 + i * 24, 80, { ch, z: "T2", s: 2.2, groups: [gs[(n - 1 - (i % n))], all] }));
  }
  out.push(T.lockCamera(x0, all, o.t1 - o.t0));
  c.beats(o.t0, o.t1, o.every ?? 0.5).forEach((t, k) => { const x = c.xAt(t); out.push(T.toggle(x, gs[k % n], true), T.toggle(x, gs[(k + n - 1) % n], false)); });
  const xe = c.xAt(o.t1 - 0.05); for (const g of gs) out.push(T.toggle(xe, g, false));
  return out;
};

doc.dancers = "MOVE: n blocks on the screen hopping on every beat, one after the other (a wave): {n, dy, stagger (beats), up, down, rgb}";
FX.dancers = (c, o) => {
  const n = o.n ?? 8, all = c.hideAtStart(c.group()), x0 = c.xAt(o.t0), out = [], P = c.grid.period;
  const ch = c.channel(o.rgb || [255, 90, 160]), chE = c.channel([255, 255, 255]);
  const gs = [];
  for (let i = 0; i < n; i++) {
    const g = c.group(); gs.push(g);
    const x = x0 - 40 + i * 42, y = 150;
    out.push(D(211, x, y, { ch, z: "T2", s: 0.9, groups: [g, all] }), D(1764, x, y + 4, { ch: chE, z: "T2", zo: 2, s: 1.2, groups: [g, all] }));
  }
  out.push(T.lockCamera(x0, all, o.t1 - o.t0), T.alpha(x0, all, 1, 0.2));
  const dy = o.dy ?? 24, up = o.up ?? 0.1, down = o.down ?? 0.25, st = (o.stagger ?? 0.125) * P;
  for (const t of c.beats(o.t0, o.t1 - 0.4, 1)) gs.forEach((g, i) => {
    const ti = t + i * st, big = (Math.round((t - c.grid.t0) / P) % 4 === 0) ? 1.6 : 1;
    out.push(T.move(c.xAt(ti), g, 0, dy * big, up, 3), T.move(c.xAt(ti + up), g, 0, -dy * big, down, 2));
  });
  out.push(T.alpha(c.xAt(o.t1 - 0.35), all, 0, 0.3));
  return out;
};

doc.screenFrame = "MOVE lock to camera: a static structure (corner brackets, bars) riding with the screen, plus a far layer at half speed: {rgb}";
FX.screenFrame = (c, o) => {
  const fr = c.hideAtStart(c.group()), far = c.hideAtStart(c.group()), x0 = c.xAt(o.t0), dur = o.t1 - o.t0, out = [];
  const ch = c.channel(o.rgb || [120, 255, 200]), chF = c.channel([60, 90, 160]);
  const L = x0 - 140, R = x0 + 290, B = 40, Tp = 215;
  for (const [x, y, sx, sy] of [[L, Tp, 4, 0.25], [L - 54, Tp - 54, 0.25, 4], [R, Tp, 4, 0.25], [R + 54, Tp - 54, 0.25, 4], [L, B, 4, 0.25], [L - 54, B + 54, 0.25, 4], [R, B, 4, 0.25], [R + 54, B + 54, 0.25, 4]])
    out.push(D(211, x, y, { ch, z: "T3", sx, sy, groups: [fr] }));
  for (let i = 0; i < 9; i++) out.push(D(211, L + 60 + i * 40, Tp - 12, { ch, z: "T3", sx: 0.8, sy: 0.12, groups: [fr] }));
  // the far layer: tall pillars, locked at half the camera's speed (they drift back slowly: depth)
  for (let i = 0; i < 10; i++) out.push(D(211, x0 - 100 + i * 90, 60 + (i % 3) * 25, { ch: chF, z: "B4", sx: 0.9, sy: 3 + (i % 3), groups: [far] }));
  out.push(T.lockCamera(x0, fr, dur), T.lockCamera(x0, far, dur, { modX: 0.5, y: false }), T.alpha(x0, fr, 1, 0.3), T.alpha(x0, far, 1, 0.6));
  out.push(T.alpha(c.xAt(o.t1 - 0.35), fr, 0, 0.3), T.alpha(c.xAt(o.t1 - 0.35), far, 0, 0.3));
  return out;
};

doc.contactFlash = "ALPHA + SCALE: a ring and a glow at every take-off and landing (pads, ledges), growing and fading: {rgb, size, secs}";
FX.contactFlash = (c, o) => {
  const out = [], ch = c.channel(o.rgb || [255, 240, 150], { blend: true }), secs = o.secs ?? 0.35, s0 = o.size ?? 0.5;
  for (const k of c.contacts(o.t0, o.t1)) {
    const g = c.hideAtStart(c.group()), fy = k.y - 15;
    out.push(D(236, k.x, fy, { ch, z: "T2", s: s0, groups: [g] }), D(1293, k.x, fy + 14, { ch, z: "T2", sx: 3, sy: 1, groups: [g] }));
    const x = k.x;  // the player is here at the contact: the trigger fires on that tick
    out.push(T.alpha(x - 1, g, 1, 0.02), T.scale(x, g, 3, 3, secs, { ease: 3, centre: g }), T.alpha(c.xAt(k.t + 0.05), g, 0, secs));
  }
  return out;
};

doc.hitLines = "ALPHA + MOVE: a line flashes in on every strong note, slides and fades: {minS, rgb, len}";
FX.hitLines = (c, o) => {
  const out = [], ch = c.channel(o.rgb || [255, 255, 255], { blend: true }), R = K.rng(o.seed || 7);
  for (const n of c.notes(o.t0, o.t1, o.minS ?? 0.6, 0.1)) {
    const g = c.hideAtStart(c.group()), x = c.xAt(n.t), rot = [0, 45, 90, -45, 20, -20][Math.floor(R() * 6)];
    const px = x + 40 + R() * 260, py = 60 + R() * 140, len = (o.len ?? 5) * (0.6 + n.strength * 0.8);
    out.push(D(1753, px, py, { ch, z: "T2", sx: len, sy: 2, rot, groups: [g] }));
    const a = rot * Math.PI / 180, d = 40;
    out.push(T.alpha(x, g, 1, 0.02), T.move(x, g, d * Math.cos(a), -d * Math.sin(a), 0.4, 3), T.alpha(c.xAt(n.t + 0.06), g, 0, 0.35));
  }
  return out;
};

doc.pathGlow = "ALPHA: soft glow dots along the path the player takes, lit as the player passes and fading behind: {every (units), rgb, linger}";
FX.pathGlow = (c, o) => {
  const out = [], ch = c.channel(o.rgb || [140, 220, 255], { blend: true }), every = o.every ?? 18, linger = o.linger ?? 1.2;
  const R = K.rng(o.seed || 3);
  let g = null, gx = -1e9;
  for (let x = c.xAt(o.t0); x < c.xAt(o.t1); x += every) {
    const t = c.tAt(x), y = c.yAt(t);
    if (x - gx >= 60) { g = c.hideAtStart(c.group()); gx = x; out.push(T.alpha(x, g, 1, 0.08), T.alpha(c.xAt(t + 0.25), g, 0, linger)); }
    out.push(D(1764, x, y + (R() - 0.5) * 14, { ch, z: "B1", s: 1 + R() * 1.6, groups: [g] }));
  }
  return out;
};

doc.clouds = "MOVE lock to player: soft clouds around the player, following it (x and y) and bobbing on the beats: {n, rgb, opacity}";
FX.clouds = (c, o) => {
  const all = c.hideAtStart(c.group()), x0 = c.xAt(o.t0), y0 = c.yAt(o.t0), dur = o.t1 - o.t0, out = [];
  const ch = c.channel(o.rgb || [220, 235, 255], { opacity: o.opacity ?? 0.55 });
  const spots = [[-80, 40, 224, 1.3], [70, 55, 223, 0.8], [-30, 95, 129, 0.7], [110, -5, 224, 1], [-120, -5, 131, 1.4], [20, -40, 224, 0.9]].slice(0, o.n ?? 6);
  const gs = spots.map(([dx, dy, id, s]) => { const g = c.group(); out.push(D(id, x0 + dx, y0 + dy, { ch, z: "B1", s, groups: [g, all] })); return g; });
  out.push(T.lockPlayer(x0, all, dur, { y: true }), T.alpha(x0, all, 1, 0.5));
  c.beats(o.t0, o.t1 - 0.5, 1).forEach((t, k) => gs.forEach((g, i) => out.push(T.move(c.xAt(t), g, 0, ((k + i) % 2 ? -8 : 8), c.grid.period * 0.9, 13))));
  out.push(T.alpha(c.xAt(o.t1 - 0.5), all, 0, 0.45));
  return out;
};

doc.ring = "LOCK + ROTATE + SCALE: a circle around the player with orbiting dots, turning, swelling on every beat, bigger on the strong notes: {r, dots, swell, spin (deg per beat), rgb}";
FX.ring = (c, o) => {
  const x0 = c.xAt(o.t0), y0 = c.yAt(o.t0), dur = o.t1 - o.t0, P = c.grid.period, out = [];
  const all = c.hideAtStart(c.group()), centre = c.group(), orbit = c.group();
  const ch = c.channel(o.rgb || [255, 120, 255], { blend: true }), chD = c.channel([255, 255, 255], { blend: true });
  const r = o.r ?? 45, n = o.dots ?? 8;
  out.push(D(236, x0, y0, { ch, z: "T2", s: 2 * r / 50, groups: [all, centre] }));
  for (let i = 0; i < n; i++) { const a = i * 2 * Math.PI / n; out.push(D(1764, x0 + (r + 10) * Math.cos(a), y0 + (r + 10) * Math.sin(a), { ch: chD, z: "T2", s: i % 2 ? 1.2 : 2, groups: [all, orbit] })); }
  out.push(T.lockPlayer(x0, all, dur, { y: true }), T.alpha(x0, all, 1, 0.3));
  out.push(T.rotate(x0, orbit, (o.spin ?? 45) * dur / P, dur, { centre }));
  const strong = c.notes(o.t0, o.t1, 0.8, 0.2).map(n => n.t);
  for (const t of c.beats(o.t0, o.t1 - 0.4, 1)) {
    const big = strong.some(s => Math.abs(s - t) < 0.06), k = big ? (o.swell ?? 1.3) * 1.25 : (o.swell ?? 1.3);
    out.push(T.scale(c.xAt(t), all, k, k, 0.06, { ease: 3, centre }), T.scale(c.xAt(t + 0.07), all, k, k, P * 0.6, { ease: 2, centre, div: true }));
  }
  out.push(T.alpha(c.xAt(o.t1 - 0.35), all, 0, 0.3));
  return out;
};

doc.beatFlash = "COLOUR 899: the background flashes towards a colour on the beats and settles back: {every, rgb, back, ch (default 1000 = background)}";
FX.beatFlash = (c, o) => {
  const out = [], ch = o.ch ?? 1000, back = o.back || [20, 20, 60], hit = o.rgb || [90, 60, 200];
  for (const t of c.beats(o.t0, o.t1, o.every ?? 1)) { const x = c.xAt(t); out.push(T.colour(x, ch, hit, 0.03), T.colour(c.xAt(t + 0.05), ch, back, c.grid.period * 0.7)); }
  return out;
};

doc.pulseFlash = "PULSE 1006 (UNTESTED in the game): the same flash with one pulse trigger per beat: {every, rgb, ch}";
FX.pulseFlash = (c, o) => c.beats(o.t0, o.t1, o.every ?? 1).map(t => T.pulse(c.xAt(t), o.ch ?? 1000, o.rgb || [90, 60, 200], 0.03, 0.02, c.grid.period * 0.7));

doc.zoomPunch = "ZOOM 1913: the camera zooms in a little on the strongest notes and eases back: {to, minS}";
FX.zoomPunch = (c, o) => {
  const out = [];
  for (const n of c.notes(o.t0, o.t1, o.minS ?? 0.9, 1)) out.push(T.zoom(c.xAt(n.t), o.to ?? 1.08, 0.05), T.zoom(c.xAt(n.t + 0.08), 1, 0.4));
  return out;
};

module.exports = Object.assign({ context, T, doc }, FX);

if (require.main === module) for (const [k, v] of Object.entries(doc)) console.log(`${k.padEnd(13)} ${v}`);
