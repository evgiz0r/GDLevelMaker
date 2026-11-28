// node tools/hellgate_ending.js [--out levels/gdlm_44_hellgate_ending.gdlvl] [--from 213.8] [--quiet]
//   -> Hellgate's ending animation (HELLGATE.md: song 215.4 - 231 s, no gameplay): "THE GATE CLOSES", Evgeni's pick
//      (2026-11-28) of four ideas. A standalone auto level on the Hellgate song (custom 343707) that starts at song second
//      --from (kA13), so it can be looked at alone now and stitched after the auto part later (build() works in SONG seconds).
//   The story, on the song's measured notes (knowledge/song_notes/custom_343707.json; beat k = song beat 518 + k):
//     lead-in  213.8 - 215.4  the sky goes dark, the player runs into nothing
//     A  k 0-7   215.4 - 218.7  four pillars rise out of the dark, a pair on each 2nd beat; their fire caps light, one a beat
//     B  k 8-15  218.7 - 222.0  eleven arch stones fly in from off the screen and LAND on the beats, ends first, keystone last
//     C  k 16-27 222.0 - 227.0  (the loudest bars) a ring of 8 runes inside the arch turns 1.5 times, the runes light one
//                                after another on every beat, caps flare on the strongest notes, the sky warms to red
//     D  k 28-30 227.0 - 228.2  the music thins: the ring slows, the runes dim, the sky cools
//     E  228.25 (the song's last big hit, "change" impact 0.55 / break 0.96): two doors slam shut over the player (hides it),
//                a hot seam glows where they meet, the sky flashes once and the whole stage thuds down and settles
//     F  228.6 - 231  the gate dims into the dark, the sky goes black, the quiet Claude sign (tools/signature.js overlay)
//   v3 (Evgeni on v2: "a bit tame still. some more things on the background ... still a lot of dead space ... no story yet"):
//     the STORY: a demon wakes inside the gate and tries to get out; the doors are dragged shut on it by two chains.
//       C  its eyes open in the dark doorway (k 16), it rises behind the rune seal, roars on the bars (jaw drops, glow flares),
//          its claws grip the arch from inside (k 24), souls of the burning city stream into the gate on the notes
//       D  it surges up and forward as the chains go taut
//       E  the doors slam ON it: claws pushed back, sparks burst from the seam, the arch sheds stones, red flash
//       F  its eyes glow once through the seam, then the gate is dark; ash falls; the sign
//     the BACKGROUND, all the way: a burning city skyline (windows flicker on the notes), a lava glow on the horizon that
//       heats with the song, a blood moon rising top-left, meteors across the sky on the strongest notes, drifting smoke.
//     Creatures: the hand-built demon of tools/artlab.js (demonObjects, the art lab thread, ART.md "Creatures and animation").
//   Everything is deco + trusted triggers (move, rotate, alpha, colour; no pulse, no scale) locked to the player's x (move
//   58), so the stage stays put on the screen while the cube runs along the ground. Run with and without the show must be
//   the same and clear with no press. Groups 2001+ / channels 800+ (tools/effects.js ranges).
//   Library: build({from, songTo}) -> {level, measures, log}; parts(ctx, songT) -> objects (the show alone, for stitching).
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
"use strict";
const fs = require("fs"), path = require("path");
const { GD, writeGdlvl } = require("./io.js");
const FX = require("./effects.js"), K = require("./scenekit.js");
const ROOT = path.join(__dirname, "..");
const TPS = 240, SONG = "343707";
const NOTES = require("../knowledge/song_notes/custom_343707.json");
const B0 = 518;                                   // song beat of the phrase at 215.43 s
const beatS = k => NOTES.t0 + (B0 + k) * NOTES.period;   // song second of beat k
const SLAM = 228.25;                              // the last big hit

const objStr = o => {
  let s = `1,${o.id},2,${(+o.x).toFixed(2)},3,${(+o.y).toFixed(2)}`;
  if (o.flipX) s += ",4,1"; if (o.flipY) s += ",5,1"; if (o.rot) s += ",6," + o.rot;
  for (const [k, v] of Object.entries(o.props || {})) if (!["1", "2", "3", "4", "5", "6"].includes(k)) s += `,${k},${v}`;
  return s;
};
const levelStr = (header, objs) => header + ";" + objs.map(objStr).join(";") + ";";
const runOf = (header, objs) => { const lv = GD.parseLevel(levelStr(header, objs)); return GD.run(GD.makeWorld(lv.objects, lv.header), []); };

// the hellgate colours (tools/designthemes.js hellgate: purple sky, molten rims)
const COL = {
  stone: [46, 20, 40], stoneLit: [92, 38, 52], rim: [255, 110, 40], ember: [255, 170, 70], rune: [255, 200, 120],
  door: [22, 8, 16], seam: [255, 140, 50],
  sky0: [84, 36, 96], dark: [22, 8, 26], groundDark: [10, 3, 12], heat: [92, 18, 22], heat2: [120, 30, 16],
  flash: [210, 90, 30], black: [5, 1, 6],
  city: [24, 7, 18], city2: [36, 11, 28], win: [255, 150, 60], lava: [255, 80, 20], moon: [190, 40, 30], moonGlow: [120, 24, 30],
  smoke: [60, 24, 40], void: [8, 2, 6], claw: [120, 24, 14], talon: [235, 215, 170], chain: [70, 50, 60], spark: [255, 210, 120],
  soul: [255, 210, 190], eyeR: [255, 60, 20], ash: [120, 110, 115],
};

let demonChannels = {};   // the demon's own colour channels (870+), set by parts(), into the header by build()
// The show: songT(s) = level seconds of song second s; ctx from FX.context on the level's run.
function parts(ctx, songT, o = {}) {
  const out = [], log = [], D = (id, x, y, op = {}) => K.obj(id, x, y, op);
  const xs = s => ctx.xAt(songT(s));               // trigger x for song second s
  const tLock = songT(o.lockAt || 214.8), x0 = ctx.xAt(tLock), lockSecs = songT(o.songTo || 232.5) - tLock;
  const C = { x: x0 + 10, y: 95 };                 // the arch's centre, just ahead of the player: the player stands in the gate
  const ALL = ctx.group();                         // everything on the stage: locked to the player's x
  const g = () => ctx.group();
  const hid = gr => ctx.hideAtStart(gr);
  const ch = (rgb, op = {}) => ctx.channel(rgb, op);
  const chStone = ch(COL.stone), chLit = ch(COL.stoneLit), chRim = ch(COL.rim, { blend: true }), chEmber = ch(COL.ember, { blend: true });
  const chRune = ch(COL.rune, { blend: true }), chDoor = ch(COL.door), chSeam = ch(COL.seam, { blend: true });
  const fades = [];                                 // groups to dim at the end
  let seed = 7; const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  out.push(FX.T.lockPlayer(x0, ALL, lockSecs));
  // the sky: dark for the lead-in
  out.push(FX.T.colour(xs(214.0), 1000, COL.dark, 1.2), FX.T.colour(xs(214.0) + 1, 1001, COL.groundDark, 1.2));

  // BACKDROP (v3): the burning city behind the gate, filling the screen's width (about -195 .. +360 around the player)
  const BACK = hid(g()), WIN = [hid(g()), hid(g()), hid(g())], chCity = ch(COL.city), chCity2 = ch(COL.city2), chWin = ch(COL.win, { blend: true });
  const chLava = ch(COL.lava, { blend: true }), chMoon = ch(COL.moon), chMoonGlow = ch(COL.moonGlow, { blend: true }), chSmoke = ch(COL.smoke, { opacity: 0.5 });
  let wins = 0;
  for (let x = x0 - 230; x < x0 + 400;) {            // far row: tall thin spires, faint
    const w = 14 + R() * 22, h = 40 + R() * 70;
    out.push(D(211, x, h / 2, { ch: chCity2, z: "B5", zo: 1, sx: w / 30, sy: h / 30, groups: [BACK, ALL] }));
    if (R() < 0.5) out.push(D(693, x, h + 9, { ch: chCity2, z: "B5", zo: 1, sx: w / 60, sy: 0.6, groups: [BACK, ALL] }), D(693, x - w / 4, h + 9, { ch: chCity2, z: "B5", zo: 1, sx: w / 60, sy: 0.6, flipX: true, groups: [BACK, ALL] }));
    x += w + 4 + R() * 18;
  }
  for (let x = x0 - 220; x < x0 + 400;) {            // near row: blocky towers with lit windows
    const w = 24 + R() * 30, h = 18 + R() * 45;
    out.push(D(211, x, h / 2, { ch: chCity, z: "B4", zo: 1, sx: w / 30, sy: h / 30, groups: [BACK, ALL] }));
    for (let wy = 10; wy < h - 6; wy += 13) for (let wx = -w / 2 + 6; wx < w / 2 - 4; wx += 9) if (R() < 0.35) {
      out.push(D(211, x + wx, wy, { ch: chWin, z: "B4", zo: 2, sx: 3.5 / 30, sy: 5 / 30, groups: [WIN[wins++ % 3], ALL] }));
    }
    x += w + 2 + R() * 14;
  }
  // the horizon burns: a lava glow along the ground behind the city
  const LAVA = hid(g());
  for (let x = x0 - 220; x < x0 + 420; x += 60) out.push(D(1293, x, 4, { ch: chLava, z: "B5", zo: 0, sx: 2.6, sy: 1.6, groups: [LAVA, ALL] }));
  // smoke drifting across the city, slow
  const SMOKE = hid(g());
  for (let i = 0; i < 9; i++) out.push(D(1764, x0 - 200 + i * 70 + R() * 30, 70 + R() * 90, { ch: chSmoke, z: "B4", zo: 4, s: 2.2 + R() * 1.6, groups: [SMOKE, ALL] }));
  // the blood moon, top left, over the left tower
  const MOON = hid(g()), mx = x0 - 115, my = 200;
  out.push(D(497, mx, my, { ch: chMoonGlow, z: "B5", zo: 2, s: 0.95, groups: [MOON, ALL] }));
  out.push(D(497, mx, my, { ch: chMoon, z: "B5", zo: 3, s: 0.55, groups: [MOON, ALL] }));
  out.push(D(497, mx + 7, my + 6, { ch: chCity2, z: "B5", zo: 4, s: 0.16, groups: [MOON, ALL] }), D(497, mx - 9, my - 7, { ch: chCity2, z: "B5", zo: 4, s: 0.1, groups: [MOON, ALL] }));
  // the city comes out of the dark with the first pillar; the moon rises through A and B; the smoke drifts the whole time
  out.push(FX.T.alpha(xs(beatS(0) - 0.6), BACK, 1, 1.0), FX.T.alpha(xs(beatS(0)), LAVA, 0.35, 1.5), FX.T.alpha(xs(beatS(0)), SMOKE, 1, 2));
  out.push(FX.T.move(xs(214.0), MOON, 0, -70, 0), FX.T.alpha(xs(beatS(2)), MOON, 1, 1.5), FX.T.move(xs(beatS(2)), MOON, 0, 70, beatS(16) - beatS(2), FX.E.sineOut));
  out.push(FX.T.move(xs(beatS(0)), SMOKE, 90, 0, 14, 0), FX.T.move(xs(beatS(0)), BACK, -25, 0, 14, 0));   // a slow parallax drift
  for (const w of WIN) out.push(FX.T.alpha(xs(beatS(1)), w, 0.5, 0.6));
  // windows flicker on the notes, the three sets in turn
  let wf = 0, lastW = -9;
  for (const [t, st] of NOTES.notes) if (t >= beatS(2) && t < SLAM && st >= 0.5 && t - lastW > 0.1) {
    lastW = t; const w = WIN[wf++ % 3]; out.push(FX.T.alpha(xs(t), w, 1, 0), FX.T.alpha(xs(t + 0.04), w, 0.45, 0.35));
  }
  // the horizon heats with the song: brighter in C, a flare on each loud bar
  out.push(FX.T.alpha(xs(beatS(16)), LAVA, 0.7, 1.0));
  for (let k = 16; k < 28; k += 4) out.push(FX.T.alpha(xs(beatS(k)), LAVA, 1, 0), FX.T.alpha(xs(beatS(k) + 0.05), LAVA, 0.7, 0.6));
  log.push(`BACKDROP city, ${wins} windows flickering on ${wf} notes, lava horizon, blood moon, drifting smoke`);

  // meteors across the sky on the strongest notes (from the top right, off the screen, to somewhere in the city)
  const chMet = ch(COL.ember, { blend: true }); let mets = 0, lastM = -9;
  for (const [t, st] of NOTES.notes) if (t >= beatS(6) && t < beatS(28) && st >= 0.85 && t - lastM > NOTES.period * 1.8) {
    lastM = t; mets++;
    const gm = hid(g()), sx = x0 + 300 + R() * 120, sy = 300 + R() * 40, ex = x0 - 120 + R() * 330, ey = 30 + R() * 60;
    const ang = Math.atan2(sy - ey, sx - ex) * 180 / Math.PI;
    out.push(D(211, sx, sy, { ch: chStone, z: "B4", zo: 6, s: 0.28, rot: 45, groups: [gm, ALL] }));
    out.push(D(211, sx + 24 * Math.cos(ang * Math.PI / 180), sy + 24 * Math.sin(ang * Math.PI / 180), { ch: chMet, z: "B4", zo: 5, sx: 1.7, sy: 0.12, rot: -ang, groups: [gm, ALL] }));
    out.push(D(1764, sx, sy, { ch: chMet, z: "B4", zo: 7, s: 0.5, groups: [gm, ALL] }));
    out.push(FX.T.alpha(xs(t - 0.45), gm, 1, 0.05), FX.T.move(xs(t - 0.45), gm, ex - sx, ey - sy, 0.45, 11), FX.T.alpha(xs(t), gm, 0, 0.25));
    const gb = hid(g());                             // the impact: a flash in the city
    out.push(D(1293, ex, ey, { ch: chLava, z: "B4", zo: 8, sx: 1.6, sy: 1.6, groups: [gb, ALL] }));
    out.push(FX.T.alpha(xs(t), gb, 1, 0), FX.T.alpha(xs(t + 0.05), gb, 0, 0.6));
  }
  log.push(`meteors: ${mets} on the strongest notes`);

  // A. the pillars: two tall towers outside, two that hold the arch, rising 150 units out of the dark
  const RISE = 150;
  const pillars = [
    { dx: -170, h: 150, w: 26, k: 0 }, { dx: 190, h: 150, w: 26, k: 1 },
    { dx: -95, h: 86, w: 30, k: 2 }, { dx: 115, h: 86, w: 30, k: 3 },
  ];
  const caps = [], pillarGroups = [];
  for (const p of pillars) {
    const gp = hid(g()), x = x0 + p.dx;
    for (let y = 0; y < p.h; y += 30) {              // stacked stones with a lit edge: reads as masonry
      const hh = Math.min(30, p.h - y);
      out.push(D(211, x, y + hh / 2 - RISE, { ch: chStone, z: "B2", sx: p.w / 30, sy: (hh - 2) / 30, groups: [gp, ALL] }));
      out.push(D(211, x - p.w / 2 + 2, y + hh / 2 - RISE, { ch: chLit, z: "B2", zo: 1, sx: 3 / 30, sy: (hh - 2) / 30, groups: [gp, ALL] }));
    }
    const gc = hid(g());                             // the fire cap: a glow on top, lit later
    out.push(D(1293, x, p.h + 6 - RISE, { ch: chRim, z: "B1", sx: p.w / 30 * 1.3, sy: 0.5, groups: [gp, gc, ALL] }));
    out.push(D(1764, x, p.h + 4 - RISE, { ch: chEmber, z: "B1", zo: 2, s: 0.9, groups: [gp, gc, ALL] }));
    caps.push(gc); pillarGroups.push(gp);
    const t = beatS(p.k);
    out.push(FX.T.alpha(xs(t - 0.12), gp, 1, 0.08), FX.T.move(xs(t - 0.12), gp, 0, RISE, 0.22, FX.E.pop));   // overshoots a little, lands on the beat
    fades.push(gp);
  }
  caps.forEach((gc, i) => out.push(FX.T.alpha(xs(beatS(4 + i)), gc, 0.9, 0.08)));
  log.push(`A pillars rise one a beat ${beatS(0).toFixed(2)}-${beatS(3).toFixed(2)} s, caps light ${beatS(4).toFixed(2)}-${beatS(7).toFixed(2)} s`);

  // embers rising through A-C: one on every beat, somewhere in the gate
  // ENERGY (Evgeni on v1: "a bit too tame, it has to be much more energetic"): an ember bursts up on every note of the song
  // from 0.55 up (not only the beats), faster, bigger on the strong ones
  let embers = 0, lastE = -9;
  for (const [t, st] of NOTES.notes) {
    if (t < beatS(0) - 0.01 || t >= SLAM + 0.5 || st < 0.45 || t - lastE < 0.08) continue;
    lastE = t; embers++;
    const ge = hid(g()), x = x0 - 160 + R() * 340, y = 5 + R() * 50, big = st >= 0.85;
    out.push(D(1764, x, y, { ch: chEmber, z: "B3", s: (big ? 0.6 : 0.3) + R() * 0.35, groups: [ge, ALL] }));
    out.push(FX.T.alpha(xs(t), ge, big ? 1 : 0.8, 0), FX.T.move(xs(t), ge, (R() - 0.5) * 50, (big ? 170 : 110) + R() * 60, 0.9, FX.E.hit),
      FX.T.alpha(xs(t + 0.25), ge, 0, 0.6));
  }

  // B. the arch: 9 stones on a half circle, each flying in from out of the screen and landing on its beat
  const RA = 105, N = 11, stones = [];
  for (let i = 0; i < N; i++) {
    const a = Math.PI * i / (N - 1), gs = hid(g()), key = i === (N - 1) / 2;
    const x = C.x - RA * Math.cos(a), y = C.y + RA * Math.sin(a), rot = -(a * 180 / Math.PI - 90);
    out.push(D(211, x, y, { ch: chStone, z: "B2", zo: 3, sx: key ? 1.3 : 1.05, sy: key ? 0.95 : 0.8, rot, groups: [gs, ALL] }));
    out.push(D(211, x, y + (key ? 11 : 8.5), { ch: chLit, z: "B2", zo: 4, sx: key ? 1.15 : 0.9, sy: 0.08, rot, groups: [gs, ALL] }));
    if (key) out.push(D(1293, x, y, { ch: chRim, z: "B1", sx: 1.3, sy: 1.0, groups: [gs, ALL] }));
    // ends first, keystone last: pairs on beats 8-12 and the keystone on 13
    const k = 8 + Math.min(i, N - 1 - i), t = beatS(k), fly = 0.26;
    const ox = -Math.cos(a) * 330, oy = Math.sin(a) * 160 + 90;       // starts out of the screen, up and outwards
    stones.push({ gs, ox, oy });
    out.push(FX.T.move((ctx.path[0].x || 0) + 4, gs, ox, oy, 0));                      // parked out of the screen before anything shows
    out.push(FX.T.alpha(xs(t - fly), gs, 1, 0), FX.T.move(xs(t - fly), gs, -ox, -oy, fly, 11));   // exponential in: lands ON the beat
    out.push(FX.T.rotate(xs(t - fly), gs, i % 2 ? 360 : -360, fly, { ease: FX.E.sineOut }));          // spinning in, a whole turn
    fades.push(gs);
  }
  // the arch settles: a small drop and back on the bar after the keystone
  const settle = beatS(14);
  for (const s of stones) out.push(FX.T.move(xs(settle), s.gs, 0, -3, 0.08, FX.E.hit), FX.T.move(xs(settle + 0.1), s.gs, 0, 3, 0.35, FX.E.settle));
  log.push(`B arch stones land on ${beatS(8).toFixed(2)}-${beatS(12).toFixed(2)} s, keystone ${beatS(13).toFixed(2)} s`);

  // THE DEMON (v3 story): behind the doorway's dark, behind the rune seal, in front of the city
  const VOID = hid(g()), chVoid = ch(COL.void);
  out.push(D(211, C.x, C.y / 2, { ch: chVoid, z: "B3", zo: -90, sx: 2 * (RA - 8) / 30, sy: C.y / 30, groups: [VOID, ALL] }));
  out.push(D(497, C.x, C.y, { ch: chVoid, z: "B3", zo: -90, s: 2 * (RA - 8) / 120, groups: [VOID, ALL] }));   // 497: a 120-unit disk
  const DEM = g(), dFace = hid(g()), dJaw = hid(g()), dEyes = hid(g()), dGlow = hid(g());
  const dm = require("./artlab.js").demonObjects({ upp: 0.5, x0: C.x - 75, y0: 178, layer: -1, ch0: 870, all: DEM, zo0: -60,
    groups: { head: dFace, horn: dFace, jaw: dJaw, eyes: dEyes, glow: dGlow } });
  for (const ob of dm.objects) { ob.props[57] += "." + ALL; out.push(ob); }
  demonChannels = dm.channels;
  const k16 = beatS(16), rise = 46;
  out.push(FX.T.alpha(xs(beatS(14)), VOID, 1, 0.8));
  out.push(FX.T.move((ctx.path[0].x || 0) + 4, DEM, 0, -rise, 0));                              // parked low
  out.push(FX.T.alpha(xs(k16), dGlow, 0.9, 0.3), FX.T.alpha(xs(k16 + 0.1), dEyes, 1, 0.15));     // the eyes open in the dark
  out.push(FX.T.alpha(xs(beatS(18)), dFace, 0.85, beatS(22) - beatS(18)), FX.T.alpha(xs(beatS(18)), dJaw, 0.85, beatS(22) - beatS(18)),
    FX.T.move(xs(beatS(18)), DEM, 0, rise, beatS(22) - beatS(18), FX.E.sineOut));               // it rises out of the dark
  for (const k of [20, 24, 26]) {                                                                // it roars on the bars
    const t = beatS(k);
    out.push(FX.T.move(xs(t), dJaw, 0, -9, 0.08, FX.E.hit), FX.T.move(xs(t + 0.35), dJaw, 0, 9, 0.3, FX.E.settle));
    out.push(FX.T.alpha(xs(t), dGlow, 1, 0), FX.T.alpha(xs(t + 0.1), dGlow, 0.7, 0.5));
    out.push(FX.T.rotate(xs(t), dFace, k % 8 ? 4 : -4, 0.1, { ease: FX.E.hit }), FX.T.rotate(xs(t + 0.35), dFace, k % 8 ? -4 : 4, 0.3, { ease: FX.E.settle }));
  }
  // its claws grip the arch from inside (k 24): three talons over the arch's inner edge each side
  const CLAW = [hid(g()), hid(g())], chClaw = ch(COL.claw), chTalon = ch(COL.talon);
  CLAW.forEach((gcl, j) => {
    const sx = j ? 1 : -1, cx = C.x + sx * (RA - 16), cy = C.y + 30;
    out.push(D(497, cx, cy, { ch: chClaw, z: "B2", zo: 8, sx: 0.28, sy: 0.22, groups: [gcl, ALL] }));
    for (let f = 0; f < 3; f++) out.push(D(693, cx + sx * 12, cy + 10 - f * 10, { ch: chTalon, z: "B2", zo: 9, sx: 0.45, sy: 0.22, rot: sx > 0 ? 0 : 0, flipX: sx < 0, groups: [gcl, ALL] }));
    out.push(FX.T.move((ctx.path[0].x || 0) + 4, gcl, -sx * 30, 0, 0));
    out.push(FX.T.alpha(xs(beatS(24) - 0.1), gcl, 1, 0.1), FX.T.move(xs(beatS(24) - 0.1), gcl, sx * 30, 0, 0.1, FX.E.hit));   // slap onto the stone
    out.push(FX.T.move(xs(beatS(28)), gcl, sx * 6, 4, 0.2, FX.E.pop));                                                     // D: pulls harder
    out.push(FX.T.move(xs(SLAM - 0.08), gcl, -sx * 40, -6, 0.1, 11), FX.T.alpha(xs(SLAM - 0.05), gcl, 0, 0.06));          // knocked back in by the doors
  });
  // D: it surges up and forward as the chains go taut (the glow flares)
  out.push(FX.T.move(xs(beatS(28)), DEM, 0, 14, SLAM - 0.1 - beatS(28), FX.E.pop), FX.T.alpha(xs(beatS(28)), dGlow, 1, 0.3));
  out.push(FX.T.alpha(xs(SLAM + 0.1), DEM, 0, 0));                                                // shut away behind the doors
  // souls of the city stream into the gate on the notes of C
  const chSoul = ch(COL.soul, { blend: true }); let souls = 0, lastSo = -9;
  for (const [t, st] of NOTES.notes) if (t >= k16 && t < SLAM - 0.5 && st >= 0.5 && t - lastSo > 0.12) {
    lastSo = t; souls++;
    const gs = hid(g()), left = R() < 0.5, x = left ? x0 - 190 + R() * 60 : x0 + 230 + R() * 120, y = 30 + R() * 170;
    out.push(D(1764, x, y, { ch: chSoul, z: "B3", zo: 2, s: 0.35 + R() * 0.3, groups: [gs, ALL] }));
    out.push(FX.T.alpha(xs(t), gs, 0.9, 0.1), FX.T.move(xs(t), gs, C.x + (R() - 0.5) * 40 - x, C.y + (R() - 0.5) * 50 - y, 0.85, 11), FX.T.alpha(xs(t + 0.6), gs, 0, 0.25));
  }
  log.push(`STORY demon (${dm.objects.length} objects): eyes ${k16.toFixed(2)} s, rises to ${beatS(22).toFixed(2)} s, roars on 3 bars, claws ${beatS(24).toFixed(2)} s, surges in D, shut away at the slam; ${souls} souls sucked in`);

  // C. the rune ring inside the arch: 8 runes, turning 1.5 times through the loud bars, lit one after another on every beat
  const RING = hid(g()), CEN = g(), RR = 62, runes = [];
  out.push(D(1764, C.x, C.y + 20, { ch: chRune, z: "B4", s: 0.1, groups: [CEN, ALL] }));   // the centre the ring turns about
  out.push(D(236, C.x, C.y + 20, { ch: chRim, z: "B2", zo: 0, s: 2.2, groups: [RING, ALL] }));     // a faint disc behind the runes
  for (let i = 0; i < 8; i++) {
    const a = 2 * Math.PI * i / 8, gr = hid(g()), x = C.x + RR * Math.cos(a), y = C.y + 20 + RR * Math.sin(a);
    out.push(D(211, x, y, { ch: chRune, z: "B2", zo: 6, s: 0.38, rot: 45, groups: [gr, RING, ALL] }));
    out.push(D(1764, x, y, { ch: chRim, z: "B2", zo: 5, s: 1.1, groups: [gr, RING, ALL] }));
    runes.push(gr);
  }
  const c0 = beatS(16), c1 = beatS(28);
  out.push(FX.T.alpha(xs(c0 - 0.2), RING, 0.25, 0.4));
  for (const gr of runes) out.push(FX.T.alpha(xs(c0 - 0.2), gr, 0.3, 0.4));
  out.push(FX.T.rotate(xs(c0), RING, 1080, c1 - c0, { centre: CEN }));
  // a rune lights on every note from 0.6 up (the 8ths and 16ths, not only the beats), round the ring
  let ri = 0, lastR = -9;
  for (const [t, st] of NOTES.notes) if (t >= c0 && t < c1 && st >= 0.45 && t - lastR > 0.08) {
    lastR = t; const gr = runes[ri++ % 8];
    out.push(FX.T.alpha(xs(t), gr, 1, 0), FX.T.alpha(xs(t + 0.04), gr, 0.35, 0.3));
  }
  // and the whole ring kicks outward on every beat
  for (let k = 16; k < 28; k++) for (let i = 0; i < 8; i++) {
    const a = 2 * Math.PI * i / 8, t = beatS(k), d = k % 4 === 0 ? 14 : 8;
    out.push(FX.T.move(xs(t), runes[i], d * Math.cos(a), d * Math.sin(a), 0.05, FX.E.hit), FX.T.move(xs(t + 0.06), runes[i], -d * Math.cos(a), -d * Math.sin(a), 0.25, FX.E.settle));
  }
  // caps flare on the loudest notes of C (strength 1, never closer than a beat)
  let last = -9, flares = 0;
  for (const [s, st] of NOTES.notes) if (s >= c0 && s < c1 && st >= 0.9 && s - last > NOTES.period * 0.9) {
    last = s; flares++;
    for (const gc of caps) out.push(FX.T.alpha(xs(s), gc, 1, 0), FX.T.alpha(xs(s + 0.05), gc, 0.75, 0.4));
  }
  // the sky warms through C (calm, on bar starts)
  out.push(FX.T.colour(xs(c0), 1000, COL.heat, 1.6), FX.T.colour(xs(beatS(24)), 1000, COL.heat2, 1.6));
  log.push(`C rune ring turns 3 times ${c0.toFixed(2)}-${c1.toFixed(2)} s, ${ri} rune flashes on the notes, ring kicks on every beat, ${flares} cap flares; ${embers} embers on notes`);

  // D. the music thins: the ring slows to a stop, the runes dim, the sky cools
  out.push(FX.T.rotate(xs(c1), RING, 25, SLAM - c1, { centre: CEN, ease: FX.E.sineOut }));
  for (const gr of runes) out.push(FX.T.alpha(xs(c1), gr, 0.2, 0.8));
  out.push(FX.T.colour(xs(c1), 1000, [48, 12, 22], 1.0));
  for (const gc of caps) out.push(FX.T.alpha(xs(c1), gc, 0.5, 1.0));

  // E. the slam: two doors (strips that fill the arch's inner shape) slide in and meet at the last hit, over the player
  const DL = hid(g()), DR = hid(g()), SEAM = hid(g()), RIN = RA - 10, OPEN = 150;
  const DLm = g(), DRm = g(), CHN = [hid(g()), hid(g())], chChain = ch(COL.chain);
  for (let sx = -1; sx <= 1; sx += 2) {
    const gd = sx < 0 ? DL : DR, gm = sx < 0 ? DLm : DRm, gch = CHN[sx < 0 ? 0 : 1];
    // the chain that drags this door shut: from the top of the screen to the door's top, links alternating
    const cxx = C.x + sx * RIN * 0.55 + sx * OPEN, top = 270, bot = C.y + Math.sqrt(RIN * RIN - (RIN * 0.55) ** 2) - 4;
    for (let y = bot, i = 0; y < top; y += 11, i++) out.push(D(211, cxx, y, { ch: chChain, z: "B1", zo: 1, sx: (i % 2 ? 2.5 : 6) / 30, sy: 10 / 30, groups: [gch, gm, ALL] }));
    for (let i = 0; i < 12; i++) {
      const dx = (i + 0.5) * (RIN / 12), h = C.y + Math.sqrt(Math.max(0, RIN * RIN - dx * dx));
      const x = C.x + sx * dx;
      out.push(D(211, x + sx * OPEN, h / 2, { ch: chDoor, z: "T1", zo: 2, sx: (RIN / 12 + 0.6) / 30, sy: h / 30, groups: [gd, gm, ALL] }));
    }
    // a lit edge down the door's middle
    out.push(D(211, C.x + sx * RIN * 0.5 + sx * OPEN, (C.y + 40) / 2, { ch: chLit, z: "T1", zo: 3, sx: 2 / 30, sy: (C.y + 40) / 30, groups: [gd, gm, ALL] }));
  }
  out.push(D(1293, C.x, (C.y + RIN) / 2, { ch: chSeam, z: "T1", zo: 4, sx: 0.5, sy: (C.y + RIN) / 30, groups: [SEAM, ALL] }));
  const shut = 0.6;
  out.push(FX.T.alpha(xs(SLAM - shut), DL, 1, 0.2), FX.T.alpha(xs(SLAM - shut), DR, 1, 0.2),
    FX.T.move(xs(SLAM - shut), DLm, OPEN, 0, shut, 11), FX.T.move(xs(SLAM - shut), DRm, -OPEN, 0, shut, 11),
    FX.T.alpha(xs(SLAM), SEAM, 1, 0), FX.T.alpha(xs(SLAM + 0.1), SEAM, 0, 1.6));
  // the chains drop in at the start of D, jolt on its beats, and go taut
  for (const gch of CHN) out.push(FX.T.alpha(xs(beatS(24)), gch, 1, 0.3));
  for (const [i, gm] of [DLm, DRm].entries()) { const sx = i ? -1 : 1;
    out.push(FX.T.move((ctx.path[0].x || 0) + 4, gm, 0, 60, 0), FX.T.move(xs(beatS(24)), gm, 0, -60, 0.3, FX.E.pop));        // the chains come down from above
    for (const k of [28, 29, 30]) out.push(FX.T.move(xs(beatS(k)), gm, sx * 6, 0, 0.05, FX.E.hit), FX.T.move(xs(beatS(k) + 0.06), gm, -sx * 4, 0, 0.12, FX.E.settle));
    out.push(FX.T.move(xs(SLAM - shut - 0.01), gm, -sx * 2 * 3, 0, 0.01, 0)); }
  // sparks burst out of the seam, in front of everything
  const chSpark = ch(COL.spark, { blend: true });
  for (let i = 0; i < 18; i++) {
    const gsp = hid(g()), y = 20 + R() * (C.y + RIN - 30), a = (i % 2 ? 0 : Math.PI) + (R() - 0.5) * 1.6, d = 70 + R() * 120;
    out.push(D(1764, C.x, y, { ch: chSpark, z: "T2", zo: 1, s: 0.25 + R() * 0.25, groups: [gsp, ALL] }));
    out.push(FX.T.alpha(xs(SLAM), gsp, 1, 0), FX.T.move(xs(SLAM), gsp, d * Math.cos(a), d * Math.sin(a) * 0.7 - 10, 0.5 + R() * 0.3, FX.E.hit), FX.T.alpha(xs(SLAM + 0.2), gsp, 0, 0.5));
  }
  // the arch sheds stones: they drop from the top of the arch, turning, and break on the ground
  for (let i = 0; i < 9; i++) {
    const gr = hid(g()), x = C.x + (R() - 0.5) * 230, y = C.y + RA - 10 + R() * 30, tf = SLAM + 0.05 + R() * 0.35, fall = 0.45 + R() * 0.25;
    out.push(D(211, x, y, { ch: chStone, z: "T1", zo: 6, s: 0.22 + R() * 0.2, rot: R() * 90, groups: [gr, ALL] }));
    out.push(FX.T.alpha(xs(tf), gr, 1, 0), FX.T.move(xs(tf), gr, (R() - 0.5) * 40, -y + 6, fall, 11), FX.T.rotate(xs(tf), gr, (R() < 0.5 ? -1 : 1) * (120 + R() * 200), fall),
      FX.T.alpha(xs(tf + fall), gr, 0, 0.3));
  }
  // F: its eyes glow once through the seam -- still in there -- then dark
  const SEYE = hid(g()), chEyeR = ch(COL.eyeR, { blend: true });
  for (const dx of [-14, 14]) out.push(D(1764, C.x + dx, C.y + 12, { ch: chEyeR, z: "T2", zo: 2, s: 0.35, groups: [SEYE, ALL] }));
  out.push(FX.T.alpha(xs(229.0), SEYE, 0.9, 0.25), FX.T.alpha(xs(229.4), SEYE, 0, 0.9));
  // ash falls through F
  const chAsh = ch(COL.ash, { opacity: 0.8 });
  for (let i = 0; i < 22; i++) {
    const ga = hid(g()), x = x0 - 180 + R() * 520, y = 230 + R() * 40, t = 228.6 + R() * 1.8;
    out.push(D(211, x, y, { ch: chAsh, z: "T1", zo: 7, s: 0.07 + R() * 0.06, rot: R() * 90, groups: [ga, ALL] }));
    out.push(FX.T.alpha(xs(t), ga, 0.9, 0.3), FX.T.move(xs(t), ga, 20 + R() * 40, -(160 + R() * 70), 2.6, 0), FX.T.rotate(xs(t), ga, 200, 2.6), FX.T.alpha(xs(t + 1.9), ga, 0, 0.7));
  }
  // the sky flashes once and the stage thuds down and settles
  out.push(FX.T.colour(xs(SLAM), 1000, COL.flash, 0), FX.T.colour(xs(SLAM + 0.02), 1000, [30, 6, 10], 0.7));
  for (const gc of caps) out.push(FX.T.alpha(xs(SLAM), gc, 1, 0), FX.T.alpha(xs(SLAM + 0.05), gc, 0.3, 1.2));
  log.push(`E doors slam at ${SLAM} s (the last big hit)`);

  // ENERGY: the stage thumps on every beat (bigger on the bar), the camera punches in on each bar and the strongest notes,
  // the sky flares on the bars of the loud part, the towers shudder on the strongest notes, and the slam shakes the screen
  for (let k = 0; k < 31; k++) {
    const t = beatS(k), d = k % 4 === 0 ? 9 : 4;
    out.push(FX.T.move(xs(t), ALL, 0, -d, 0.04, FX.E.hit), FX.T.move(xs(t + 0.05), ALL, 0, d, 0.25, FX.E.settle));
    if (k % 4 === 0) out.push(FX.T.zoom(xs(t), k >= 16 ? 1.1 : 1.05, 0.05), FX.T.zoom(xs(t + 0.06), 1, 0.4));
    if (k >= 16 && k < 28 && k % 4 === 0) out.push(FX.T.colour(xs(t) + 0.5, 1000, [180, 50, 28], 0), FX.T.colour(xs(t + 0.03), 1000, k >= 24 ? COL.heat2 : COL.heat, 0.45));
  }
  let lastS = -9, shudders = 0;
  for (const [t, st] of NOTES.notes) if (t >= beatS(4) && t < SLAM - 0.2 && st >= 0.9 && t - lastS > NOTES.period * 0.9) {
    lastS = t; shudders++;
    for (const [j, gp] of pillarGroups.entries()) { const dx = j % 2 ? 4 : -4;
      out.push(FX.T.move(xs(t), gp, dx, 0, 0.03, FX.E.hit), FX.T.move(xs(t + 0.04), gp, -dx, 0, 0.2, FX.E.settle)); }
    if (t >= c0) out.push(FX.T.zoom(xs(t) + 0.3, 1.13, 0.04), FX.T.zoom(xs(t + 0.05), 1, 0.35));
  }
  // the slam: a screen shake (the stage, decaying) and a big zoom punch
  [[10, -8], [-8, 6], [6, -4], [-4, 3], [2, -2]].forEach(([dx, dy], i) => {
    const t = SLAM + i * 0.05; out.push(FX.T.move(xs(t) + 0.2, ALL, dx - (i ? [10, -8, 6, -4][i - 1] : 0), dy - (i ? [-8, 6, -4, 3][i - 1] : 0), 0.04, FX.E.hit));
  });
  out.push(FX.T.move(xs(SLAM + 0.26), ALL, -2, 2, 0.1, FX.E.settle));
  out.push(FX.T.zoom(xs(SLAM) + 0.4, 1.2, 0.05), FX.T.zoom(xs(SLAM + 0.08), 1, 1.0));
  log.push(`ENERGY: stage thump on 31 beats, zoom punches on bars + ${shudders} strongest notes (towers shudder), sky flares on the loud bars, slam shake + zoom`);

  // F. the closed gate dims into the dark
  const f0 = 229.5;
  for (const gr of fades.concat([DL, DR], CHN)) out.push(FX.T.alpha(xs(f0), gr, 0.3, 1.5));
  for (const gr of [BACK, LAVA, SMOKE, MOON, VOID].concat(WIN)) out.push(FX.T.alpha(xs(SLAM + 0.3), gr, 0, f0 + 1.2 - SLAM));
  out.push(FX.T.alpha(xs(f0), RING, 0, 1.2));
  for (const gr of runes.concat(caps)) out.push(FX.T.alpha(xs(f0), gr, 0, 1.2));
  out.push(FX.T.colour(xs(f0), 1000, COL.black, 1.8), FX.T.colour(xs(f0) + 1, 1001, COL.black, 1.8));
  out.push(FX.T.colour(xs(f0) + 2, 1013, COL.black, 1.8), FX.T.colour(xs(f0) + 3, 1014, COL.black, 1.8));
  for (const gr of fades.concat([DL, DR], CHN)) out.push(FX.T.alpha(xs(231.0), gr, 0, 1.0));
  log.push(`F gate dims from ${f0} s, dark by 232 s`);
  return { objects: out, log };
}

function build(o = {}) {
  const from = o.from ?? 213.8, songTo = o.songTo ?? 232.5;
  const songT = s => s - from;
  let header = GD.DEFAULT_HEADER.replace(/(^|,)kA13,[-0-9.]+/, "$1kA13," + from).replace(/(^|,)kA15,\d/, "$1kA15,0");
  header = K.channels(header, { 1000: { rgb: COL.sky0 }, 1001: { rgb: [29, 12, 33] }, 1009: { rgb: [40, 16, 44] },
    1013: { rgb: [44, 16, 44] }, 1014: { rgb: [30, 10, 30] } });   // the middleground hills: hellgate dark, not GD's default lavender
  const endX = (songTo - from) * 311.58;          // flat ground at 1x; the level ends after the song is silent
  const end = [{ id: 1764, x: endX, y: 1500, rot: 0, props: {} }];
  const base = runOf(header, end);
  if (base.dead) throw new Error("the empty run dies: " + base.why);
  const ctx = FX.context({ path: base.path, grid: { t0: NOTES.t0 - from, period: NOTES.period } });
  const show = parts(ctx, songT, o);
  // the quiet sign over the last 5 s of the song (it is silent from ~231 s: the sign fades in at 226.5 s)
  const sg = require("./signature.js"), p = base.path;
  const xAt = t => ctx.xAt(t), tOfX = x => { let i = p.findIndex(s => s.x >= x); if (i < 0) i = p.length - 1; return i / TPS; };
  const sign = sg.overlay({ endX: ctx.xAt(songT(231.5)), xOfT: xAt, tOfX, secs: 5, cam: 0, dx: 290 });   // right of the right tower (x0 + 203)
  header = K.channels(sg.header(ctx.header(header), {}), demonChannels);
  const objs = end.concat(show.objects, ctx.prelude(), sign);
  const withFx = runOf(header, objs);
  const same = withFx.path.length === base.path.length && withFx.path.every((s, i) => Math.abs(s.x - p[i].x) < 1e-6 && Math.abs(s.y - p[i].y) < 1e-6);
  const measures = { secs: +(p.length / TPS).toFixed(2), songFrom: from, objects: objs.length,
    triggers: objs.filter(q => (GD.objInfo(q.id) || {}).kind === "trigger").length, groups: ctx.group() - 2001,
    clears: !!withFx.done || !withFx.dead, showChangesRun: !same };
  return { header, objects: objs, measures, log: show.log };
}

module.exports = { build, parts, beatS, SLAM };

if (require.main === module) {
  const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  const r = build({ from: opt("--from") != null ? +opt("--from") : undefined });
  const out = path.resolve(opt("--out") || path.join(ROOT, "levels", "gdlm_44_hellgate_ending.gdlvl"));
  const sg = require("./signature.js");
  const rec = GD.newRecord("GDLM 44 hellgate ending", sg.describe("Hellgate's ending: the gate closes (no gameplay, song 213.8-232 s; tools/hellgate_ending.js, HELLGATE.md)"));
  GD.setField(rec, "k45", "i", SONG);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  writeGdlvl(out, rec, { header: r.header, objects: r.objects });
  if (r.measures.clears) require("./planned.js").writeAuto(out, "tools/hellgate_ending.js: no gameplay, clears with no press");
  if (!a.includes("--quiet")) console.log(r.log.join("\n"));
  console.log(JSON.stringify(r.measures));
  console.log(`${r.measures.clears && !r.measures.showChangesRun ? "CLEARS, the show leaves the run unchanged" : "PROBLEM"} -> ${path.relative(ROOT, out)}`);
}
