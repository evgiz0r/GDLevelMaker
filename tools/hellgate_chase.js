// node tools/hellgate_chase.js [--out levels/lab/gdlm_hellgate_chase_lab.gdlvl]   -> a short lab level with the whole kit
//   Hellgate's chase (Evgeni 2026-11-28: "we are running, and some demons are chasing us. shooting at us, throwing fire or
//   whatever, dragons above flying. we avoid by some auto gameplay that avoid those things. and then on the beat we pass the
//   gate, and it closes on them"). Shared by the auto part (176-215.4 s, its own thread) and the ending (tools/hellgate_ending.js).
//   Deco + trusted triggers only (move 901 incl. lock to player, rotate 1346, alpha 1007): never changes the run.
//
//   const kit = require("./hellgate_chase.js").kit({ g0: 4001, ch0: 850 });   // its own groups and colour channels
//   kit.chasers(ctx, { t0, t1, behind, n, beat: {t0, period} })  -> { objects, group, demons }   running demons locked to the
//        player's x from t0 to t1 (level seconds), `behind` units behind (the lead one; default 125), legs and bob on the beat.
//        demons[i] = { group, dx, arms } so a caller can move them (crash into a gate, reach, fall back).
//        runTo: the legs stop at this level second (default t1); z: layers per demon (default ["B1", "B2"]).
//   kit.dragons(ctx, { t0, t1, n, y })                         -> { objects, groups, mouth(i, t) }   dragons flying with the
//        player in the sky (default y 235 = top of the art), flapping; mouth(i, t) = the world point of dragon i's mouth at t.
//   kit.attack(ctx, { t, at: {x, y}, from: {x, y}, flight, size }) -> objects   (flight default 1.1 s: Evgeni 2026-11-28, 0.5 was
//        "too fast") a fireball from `from` (world, at launch
//        t - flight) to `at` (world) landing at t, bursting there. Aim `at` where the run WOULD have been without its dodge.
//   kit.header(h)  -> h with the kit's colour channels (call once, after everything is built)
//   ctx: tools/effects.js FX.context (xAt(t), path); groups g0.. and channels ch0.. are the kit's (the auto part and the ending
//   pass ranges that do not clash: effects.js 2001-3999 / 800-849, structdeco 912-957).
//   Art: the demon head is tools/artlab.js demonObjects (hand-built, parts head / horn / jaw / eyes / glow); the dragon is
//   art/gd/dragon.shapes.json (art/src/dragon_*.svg through tools/svg2gd.js svgShapes; ours, original art).
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const K = require("./scenekit.js"), FX = require("./effects.js"), PF = require("../lib/paintfit.js");
const T = FX.T, E = FX.E;
const DRAGON = JSON.parse(fs.readFileSync(path.join(ROOT, "art", "gd", "dragon.shapes.json"), "utf8"));
const COL = { body: [70, 14, 12], bodyD: [40, 8, 8], limb: [96, 20, 14], talon: [235, 215, 170], fire: [255, 120, 30], fireCore: [255, 230, 150], burst: [255, 90, 20] };

function kit(o = {}) {
  let g = o.g0 || 4001, ch = o.ch0 || 850;
  const chans = {}, grp = () => g++;
  const channel = (rgb, op = {}) => { const c = ch++; chans[c] = { rgb, blend: !!op.blend, opacity: op.opacity ?? 1 }; return c; };
  const C = { body: channel(COL.body), bodyD: channel(COL.bodyD), limb: channel(COL.limb), talon: channel(COL.talon),
    fire: channel(COL.fire, { blend: true }), core: channel(COL.fireCore, { blend: true }), burst: channel(COL.burst, { blend: true }) };
  let headCh = null, dragonCh = null;
  const D = (id, x, y, op) => K.obj(id, x, y, op);
  const kitObj = { groupRange: () => [o.g0 || 4001, g - 1], channelRange: () => [o.ch0 || 850, ch - 1] };

  // one running demon: feet at (fx, 0), height h; parts in their own groups (legs turn about the hip)
  function demon(fx, h, groups, z) {
    const out = [], s = h / 70, gL = grp(), gR = grp(), gHip = grp(), gArm = grp();
    const hipY = 26 * s, legL = 26 * s;
    out.push(D(211, fx, hipY, { s: 0.01, groups: [gHip, ...groups] }));                                        // the hip: legs turn about it
    for (const [gl, off] of [[gL, -4 * s], [gR, 4 * s]])
      out.push(D(211, fx + off, hipY - legL / 2, { ch: C.limb, z, zo: 1, sx: 7 * s / 30, sy: legL / 30, groups: [gl, ...groups] }));
    out.push(D(497, fx, hipY + 14 * s, { ch: C.bodyD, z, zo: 2, sx: 30 * s / 50, sy: 34 * s / 50, groups }));  // torso, rim
    out.push(D(497, fx + 1, hipY + 15 * s, { ch: C.body, z, zo: 3, sx: 26 * s / 50, sy: 30 * s / 50, groups }));
    // arms reaching forward (to the right, at the player), talons on the ends
    for (const [dy, len] of [[22 * s, 26 * s], [16 * s, 22 * s]]) {
      const x1 = fx + 6 * s, y1 = hipY + dy;
      out.push(D(211, x1 + len / 2, y1 + 4 * s, { ch: C.limb, z, zo: 4, sx: len / 30, sy: 5 * s / 30, rot: -12, groups: [gArm, ...groups] }));
      for (let f = 0; f < 3; f++) out.push(D(693, x1 + len + 3 * s, y1 + 8 * s - f * 4 * s, { ch: C.talon, z, zo: 5, sx: 8 * s / 30, sy: 3 * s / 30, groups: [gArm, ...groups] }));
    }
    // the head: the art lab's demon, small, on the shoulders (300 px art -> h * 0.55 wide)
    const upp = 0.6 * h / 300, headY0 = hipY + 26 * s + 280 * upp;   // the chin (art y ~280) on the torso's top
    const hd = require("./artlab.js").demonObjects({ upp, x0: fx - 150 * upp, y0: headY0, layer: ({ B2: 1, B1: 3, T1: 5 })[z] ?? 3, ch0: headCh || ch, all: groups[0], zo0: 10 });
    if (!headCh) { headCh = ch; for (const [c, d] of Object.entries(hd.channels)) chans[c] = d; ch = Math.max(ch, ...Object.keys(hd.channels).map(Number)) + 1; }
    for (const ob of hd.objects) { const extra = groups.slice(1); if (extra.length) ob.props[57] += "." + extra.join("."); out.push(ob); }
    return { objects: out, legs: [gL, gR], hip: gHip, arm: gArm };
  }

  kitObj.chasers = (ctx, p) => {
    const out = [], ALL = grp(), n = p.n ?? 3, behind = p.behind ?? 125, t0 = p.t0, t1 = p.t1, x0 = ctx.xAt(t0);
    const per = p.beat ? p.beat.period : 0.4138, bt0 = p.beat ? p.beat.t0 : t0, runTo = p.runTo ?? t1;   // legs move until runTo
    const specs = [{ dx: -behind, h: 72 }, { dx: -behind - 42, h: 58 }, { dx: -behind - 78, h: 64 }].slice(0, n);
    const demons = [];
    specs.forEach((sp, i) => {
      const gD = grp(), z = p.z ? p.z[i] || p.z[0] : i === 0 ? "B1" : "B2";
      const d = demon(x0 + sp.dx, sp.h, [gD, ALL], z);
      out.push(...d.objects);
      demons.push({ group: gD, dx: sp.dx, h: sp.h, arm: d.arm, legs: d.legs, hip: d.hip });
      // running: legs swing on every half beat, the body bobs, the arms claw on the beats
      let k = Math.ceil((t0 - bt0) / (per / 2)), flip = i % 2;
      for (let t = bt0 + k * per / 2; t < runTo; t += per / 2, flip ^= 1) {
        const a = flip ? 46 : -46, x = ctx.xAt(t), dt = per / 2 * 0.9;
        out.push(T.rotate(x, d.legs[0], a, dt, { centre: d.hip, ease: E.settle }), T.rotate(x, d.legs[1], -a, dt, { centre: d.hip, ease: E.settle }));
        out.push(T.move(x, gD, 0, flip ? 5 : -5, dt, E.settle));
      }
    });
    out.push(T.lockPlayer(x0 - 1, ALL, t1 - t0));
    return { objects: out, group: ALL, demons };
  };

  // the dragon shapes, mirrored to face right (the way we run) unless face: "left"
  const mirror = sh => sh.map(q => Object.assign({}, q, { x: DRAGON.w - q.x, rot: -q.rot, fx: q.k === "tri" ? !q.fx : q.fx }));
  kitObj.dragons = (ctx, p) => {
    const out = [], n = p.n ?? 2, t0 = p.t0, t1 = p.t1, x0 = ctx.xAt(t0), groups = [], mouths = [];
    const ALL = grp();
    for (let i = 0; i < n; i++) {
      const gA = grp(), gW = grp(), gH = grp(), upp = (p.upp ?? 0.32) * (i ? 0.8 : 1);
      const left = x0 + (p.dx ?? -40) + i * 170, top = (p.y ?? 238) - i * 16;
      const body = PF.toGD(mirror(DRAGON.body), { upp, x0: left, y0: top, layer: -1, ch0: dragonCh || ch, k: 6, groups: [gA, ALL], zo0: -40 });
      const wingCh = (dragonCh || ch) + 12;
      const wing = PF.toGD(mirror(DRAGON.wing), { upp, x0: left, y0: top, layer: -1, ch0: wingCh, k: 3, groups: [gA, gW, ALL], zo0: 40 });
      if (!dragonCh) { dragonCh = ch; for (const [c, d] of Object.entries(Object.assign({}, body.channels, wing.channels))) chans[c] = d; ch = Math.max(ch, ...Object.keys(chans).map(Number)) + 1; }
      out.push(...body.objects, ...wing.objects);
      const hx = left + (DRAGON.w - DRAGON.hinge[0]) * upp, hy = top - DRAGON.hinge[1] * upp;
      out.push(D(211, hx, hy, { s: 0.01, groups: [gA, gH, ALL] }));
      // flap every 0.3 s; drift and dip slowly (each its own phase)
      for (let t = t0, k = 0; t < t1; t += 0.3, k++) out.push(T.rotate(ctx.xAt(t), gW, k % 2 ? 34 : -34, 0.3, { centre: gH, ease: E.settle }));
      for (let t = t0 + i * 0.7, k = 0; t < t1; t += 1.4, k++) out.push(T.move(ctx.xAt(t), gA, k % 2 ? 30 : -30, k % 2 ? 18 : -18, 1.4, E.settle));
      groups.push(gA);
      // the mouth: the head end of the art (mirrored: right side), a third down
      mouths.push({ dx: left - x0 + (DRAGON.w - 30) * upp, y: top - 0.38 * DRAGON.h * upp });
    }
    out.push(T.lockPlayer(x0 - 1, ALL, t1 - t0));
    // where dragon i's mouth is at level time t (world x, y); the drift is left out (+-30, small)
    const mouth = (i, t) => ({ x: ctx.xAt(t) + mouths[i].dx, y: mouths[i].y });
    return { objects: out, group: ALL, groups, mouth };
  };

  kitObj.attack = (ctx, p) => {
    const out = [], fl = p.flight ?? 1.1, tl = p.t - fl, s = p.size ?? 1, gF = grp(), gB = grp();
    const from = p.from, at = p.at;
    out.push(D(1764, from.x, from.y, { ch: C.fire, z: "T1", zo: 1, s: 1.1 * s, groups: [gF] }));
    out.push(D(497, from.x, from.y, { ch: C.core, z: "T1", zo: 2, s: 0.12 * s, groups: [gF] }));
    const ang = Math.atan2(at.y - from.y, at.x - from.x);
    out.push(D(211, from.x - 14 * s * Math.cos(ang), from.y - 14 * s * Math.sin(ang), { ch: C.fire, z: "T1", zo: 0, sx: 1.0 * s, sy: 0.14 * s, rot: -ang * 180 / Math.PI, groups: [gF] }));
    out.push(T.alpha((ctx.path[0].x || 0) + 3, gF, 0, 0), T.alpha((ctx.path[0].x || 0) + 3, gB, 0, 0));
    out.push(T.alpha(ctx.xAt(tl), gF, 1, 0.05), T.move(ctx.xAt(tl), gF, at.x - from.x, at.y - from.y, fl, 11), T.alpha(ctx.xAt(p.t), gF, 0, 0.08));
    // the burst where it lands: a flash and six sparks thrown up
    out.push(D(1293, at.x, at.y + 6, { ch: C.burst, z: "T1", zo: 3, sx: 1.4 * s, sy: 1.4 * s, groups: [gB] }));
    const sp = [];
    for (let i = 0; i < 6; i++) { const gS = grp(); sp.push(gS); out.push(D(1764, at.x, at.y + 4, { ch: C.fire, z: "T1", zo: 4, s: 0.3 * s, groups: [gS, gB] })); }
    out.push(T.alpha(ctx.xAt(p.t), gB, 1, 0), T.alpha(ctx.xAt(p.t + 0.08), gB, 0, 0.45));
    sp.forEach((gS, i) => { const a = Math.PI * (0.15 + 0.7 * i / 5); out.push(T.move(ctx.xAt(p.t), gS, 50 * s * Math.cos(a), 45 * s * Math.sin(a), 0.5, E.hit)); });
    return out;
  };
  kitObj.header = h => K.channels(h, chans);
  kitObj.channels = chans;
  return kitObj;
}
module.exports = { kit, DRAGON };

// ---- the lab level: 12 s on flat ground, demons chasing, two dragons above, fireballs landing around the player
if (require.main === module) {
  const { GD, writeGdlvl } = require("./io.js");
  const a = process.argv.slice(2), out = path.resolve(a[a.indexOf("--out") + 1] && a.includes("--out") ? a[a.indexOf("--out") + 1] : path.join(ROOT, "levels", "lab", "gdlm_hellgate_chase_lab.gdlvl"));
  const objStr = o => { let s = `1,${o.id},2,${(+o.x).toFixed(2)},3,${(+o.y).toFixed(2)}`; if (o.flipX) s += ",4,1"; if (o.flipY) s += ",5,1"; if (o.rot) s += ",6," + o.rot;
    for (const [k, v] of Object.entries(o.props || {})) if (!["1", "2", "3", "4", "5", "6"].includes(k)) s += `,${k},${v}`; return s; };
  let header = K.channels(GD.DEFAULT_HEADER, { 1000: { rgb: [60, 14, 20] }, 1001: { rgb: [26, 8, 12] }, 1013: { rgb: [40, 10, 16] }, 1014: { rgb: [30, 8, 12] } });
  const LEN = 12, far = [{ id: 1764, x: LEN * 311.58, y: 1500, props: {} }];
  const lv0 = GD.parseLevel(header + ";" + far.map(objStr).join(";") + ";"), run = GD.run(GD.makeWorld(lv0.objects, lv0.header), []);
  const ctx = FX.context({ path: run.path });
  const kt = kit({});
  const ch = kt.chasers(ctx, { t0: 0.5, t1: LEN - 0.5 }), dr = kt.dragons(ctx, { t0: 0.5, t1: LEN - 0.5 });
  const objs = far.concat(ch.objects, dr.objects);
  for (let t = 2, i = 0; t < LEN - 1; t += 1.2, i++) objs.push(...kt.attack(ctx, { t, from: dr.mouth(i % 2, t - 0.5), at: { x: ctx.xAt(t) + (i % 2 ? 90 : -60), y: 0 } }));
  header = kt.header(header);
  const lv = GD.parseLevel(header + ";" + objs.map(objStr).join(";") + ";"), r = GD.run(GD.makeWorld(lv.objects, lv.header), []);
  const rec = GD.newRecord("GDLM hellgate chase lab", "Hellgate's chasers: demons running behind, dragons above, fireballs (auto, no click). Made by Claude (and some humans)");
  GD.setField(rec, "k45", "i", "343707");
  writeGdlvl(out, rec, { header, objects: objs });
  try { require("./planned.js").writeAuto(out, "tools/hellgate_chase.js lab: no gameplay"); } catch (e) {}
  console.log(`${path.relative(ROOT, out)}: ${objs.length} objects, groups ${kt.groupRange().join("-")}, channels ${kt.channelRange().join("-")}, run ${r.dead ? "DIES " + r.why : "clears"}`);
}
