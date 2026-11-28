// node tools/livescene.js lab [--level levels/gdlm_44_hellgate.gdlvl] [--from 5 --to 80] [--out levels/lab/gdlm_lab_live_scenery.gdlvl]
// node tools/livescene.js check <level.gdlvl> [--route-of <level it was built on>]
//   LIVING SCENERY in normal gameplay (Evgeni 2026-11-28: "dragons flying shooting something behind us, war of zombies appearing
//   here and there walking. initially can be just the surrounding, but as it gets better it can also become part of the
//   hazards"). Plan: https://claude.ai/artifact/N5GSsYnUvgbb1SLjKUJkvt (Claude Doc "Living scenery in gameplay").
//   Events on a section's strong beats, deco only (phase 1): nothing here has a hitbox, groups are only on our objects.
//     flyby   dragons cross the sky behind the player (they start behind and end ahead), flapping
//     strafe  a fly-by that spits fireballs into the background (layer B2), never across the route
//     horde   a row of zombie silhouettes marching toward the player along the ground band behind the play, legs on the beat
//   const LS = require("./livescene.js"), sc = LS.scene({ g0: 6001, ch0: 1101 });
//   objs.push(...sc.horde(ctx, { t0, t1, n })); objs.push(...sc.flyby(ctx, { t0, t1 })); objs.push(...sc.strafe(ctx, { t0, t1, shots }));
//   header = sc.header(header);  ctx: tools/effects.js FX.context({ path, grid }) from the level's saved route
//   Groups 6001-6999 and colour channels 1101-1140 are this tool's (effects 2001-3999 / 800-849, the Hellgate chase kit
//   4001+ / 850-889, structdeco 912-957, signature 960+).
//   check: the AI's own critic of an event set -- FAKE HAZARD (fire-coloured deco within 45 units of the route), IN THE WAY (our
//   pieces on the play layers B1 / T1 within 60 units of the route), BUDGET (over 1500 objects in any 10 s), OFF SCREEN (an
//   actor that never comes within a screen of the route), CROWDING (two events closer than 8 s). Exit 1 on any.
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const K = require("./scenekit.js"), FX = require("./effects.js"), CH = require("./hellgate_chase.js");
const T = FX.T, E = FX.E;
const G0 = 6001, G1 = 6999, C0 = 1101;

// OPEN SPACE: where an actor of height h shows over [t0, t1] -- inside the camera's view all that time and clear of the level's blocks and hazards (a dragon behind a ceiling is not seen). Returns the bottom y
// of the band with the most clear columns, never overlapping the route's own heights +-`away`, `prefer` "high" or "low" on a tie; null when under `min` (55%) of it is clear.
const OB = require("../lib/objects.js");
function openBand(ctx, objects, t0, t1, h, prefer = "high", away = 60, min) {
  const xa = ctx.xAt(t0), xb = ctx.xAt(t1) + 300, ys = []; for (let t = t0; t <= t1; t += 0.1) ys.push(ctx.yAt(t));
  const yr0 = Math.min(...ys) - away, yr1 = Math.max(...ys) + away;   // the route's own band, kept clear: scenery, not the play
  // GD's cube camera (lib/camera.js, measured): the player 205 units over the view's bottom, never under the ground's rest
  // view (bottom ~ -65), the view 320 tall; the band must be in view the whole time, so the tightest bottom and top win
  const lo = Math.max(0, ...ys.map(y => Math.max(-65, y - 205))), hi = Math.min(...ys.map(y => Math.max(-65, y - 205) + 320)) - h;
  const solid = objects.filter(q => q.x > xa - 30 && q.x < xb + 30 && (() => { const k = (OB.objInfo(q.id) || {}).kind; return k === "solid" || k === "hazard"; })());
  const cols = []; for (let x = xa; x < xb; x += 30) cols.push(x);
  let best = null;
  for (let y = lo; y <= hi; y += 15) {
    let free = 0; for (const x of cols) if (!solid.some(q => Math.abs(q.x - x) < 15 && q.y > y - 15 && q.y < y + h + 15)) free++;
    if (away != null && y < yr1 && y + h > yr0) continue;
    const f = free / cols.length, sc = f + (prefer === "high" ? 1 : -1) * (y - lo) / 1e4;
    if (!best || sc > best.sc) best = { y, f, sc };
  }
  return best && best.f >= (min ?? 0.55) ? best : null;
}

function scene(o = {}) {
  let g = o.g0 || G0, ch = o.ch0 || C0; const chans = {}, grp = () => g++, events = [];
  const channel = rgb => { const c = ch++; chans[c] = { rgb, blend: false, opacity: 1 }; return c; };
  // zombies: one dark silhouette colour and a dim eye glow (the roles rule: deco darker than the play, its own hue)
  const C = { zb: channel(o.zombie || [34, 30, 38]), zl: channel(o.zombieLimb || [26, 22, 30]), eye: channel(o.eye || [150, 220, 90]) };
  // the kit's creatures as silhouettes: its colours pulled 70% toward a dark backdrop tone (deco darker than the play and
  // never in the play blocks' red, ART.md "Colour by role"), so a dragon behind us never reads as a hazard
  const SIL = o.silhouette || [40, 30, 56], mix = o.silMix ?? 0.7;
  const kit = CH.kit({ g0: g + 400, ch0: ch + 2, tint: o.tint || (rgb => rgb.map((v, i) => Math.round(v * (1 - mix) + SIL[i] * mix))) });   // the dragon / fireball kit, its own ranges inside ours
  const D = (id, x, y, op) => K.obj(id, x, y, op);

  // one zombie, feet at (fx, fy), height h (units), facing left (toward the player who comes from the left): ~9 objects
  function zombie(fx, fy, h, z, groups) {
    const out = [], s = h / 60, gL = grp(), gR = grp(), gHip = grp(), gArm = grp();
    const hip = fy + 22 * s, leg = 22 * s;
    out.push(D(211, fx, hip, { s: 0.01, groups: [gHip, ...groups] }));
    for (const [gl, off] of [[gL, -3 * s], [gR, 3 * s]]) out.push(D(211, fx + off, hip - leg / 2, { ch: C.zl, z, zo: 1, sx: 6 * s / 30, sy: leg / 30, groups: [gl, ...groups] }));
    out.push(D(211, fx, hip + 13 * s, { ch: C.zb, z, zo: 2, sx: 15 * s / 30, sy: 26 * s / 30, rot: -8, groups }));          // torso, hunched
    out.push(D(497, fx - 3 * s, hip + 32 * s, { ch: C.zb, z, zo: 3, sx: 15 * s / 50, sy: 16 * s / 50, groups }));          // head
    out.push(D(497, fx - 7 * s, hip + 33 * s, { ch: C.eye, z, zo: 4, s: 2.6 * s / 50, groups }));                           // one eye
    for (const dy of [20 * s, 15 * s]) out.push(D(211, fx - 12 * s, hip + dy, { ch: C.zl, z, zo: 1, sx: 20 * s / 30, sy: 4 * s / 30, rot: 6, groups: [gArm, ...groups] }));   // arms out front
    return { objects: out, legs: [gL, gR], hip: gHip, arm: gArm };
  }

  const api = {
    // a horde: n zombies in a loose row, met ahead of the player and marching toward it; on the ground band `y` (default: 3
    // blocks under the lowest route point there, so they read as an army below), layer B3, walking on half beats
    horde(ctx, p) {
      const out = [], n = p.n ?? 8, t0 = p.t0, t1 = p.t1, R = K.rng(p.seed ?? 7), ALL = grp(), z = p.z || "B3";
      const xa = ctx.xAt(t0), xb = ctx.xAt(t1), ys = []; for (let t = t0; t <= t1; t += 0.1) ys.push(ctx.yAt(t));
      const per = ctx.grid ? ctx.grid.period : 0.5; let placed = 0, opens = [];
      const walk = p.speed ?? 60;   // units a second toward the player
      for (let i = 0; i < n; i++) {
        // each one where the player meets it: ~1 s after it comes into view, on open ground in view and off the route's band
        const ti = t0 + (t1 - t0) * (0.08 + 0.9 * (i + R() * 0.6) / n), h = (p.h ?? 54) * (0.85 + R() * 0.3), fx = ctx.xAt(ti) + 260;
        const ob = p.y == null && p.objects ? openBand(ctx, p.objects, ti, ti + 1.5, h * 1.15, "low", null) : null;
        if (p.y == null && p.objects && !ob) continue;   // nowhere to stand in view: leave this one out
        if (ob) opens.push(ob.f); placed++;
        const gZ = grp(), zb = zombie(fx, (p.y ?? ob.y) + 2, h, z, [gZ, ALL]); out.push(...zb.objects);
        for (let t = t0, k = i % 2; t < t1; t += per / 2, k ^= 1) {
          const x = ctx.xAt(t), dt = per / 2 * 0.9, a = k ? 28 : -28;
          out.push(T.rotate(x, zb.legs[0], a, dt, { centre: zb.hip, ease: E.settle }), T.rotate(x, zb.legs[1], -a, dt, { centre: zb.hip, ease: E.settle }));
          out.push(T.move(x, gZ, -walk * per / 2, k ? 3 : -3, per / 2, E.settle));
        }
      }
      // they rise into view as the stretch starts and sink back at its end
      out.push(T.move(ctx.xAt(t0) - 1, ALL, 0, -60, 0), T.move(ctx.xAt(t0), ALL, 0, 60, 0.6, E.hit), T.move(ctx.xAt(t1 - 0.6), ALL, 0, -60, 0.6, E.settle));
      events.push({ kind: "horde", t0, t1, n: placed, group: ALL, y: null, open: placed ? +(opens.reduce((a, b) => a + b, 0) / Math.max(1, opens.length)).toFixed(2) : null });
      return out;
    },
    // dragons crossing the sky with the player: locked to its x, starting `from` units behind and drifting to `to` ahead
    flyby(ctx, p) {
      const t0 = p.t0, t1 = p.t1, ys = []; for (let t = t0; t <= t1; t += 0.1) ys.push(ctx.yAt(t));
      // a small dragon (h ~62 units: the chase kit's art is ~110 at upp 0.32) fits the strips of sky a dense level has
      const H = p.h ?? 62, ob = p.y == null && p.objects ? openBand(ctx, p.objects, t0, t1, H, "high", 35, 0.4) : null;
      const y = p.y ?? (ob ? ob.y + H : Math.max(...ys) + 120), dr = kit.dragons(ctx, { t0, t1, n: p.n ?? 1, y, dx: p.from ?? -420, upp: p.upp ?? 0.32 * H / 110 });
      const out = dr.objects.slice(); out.push(T.move(ctx.xAt(t0), dr.group, (p.to ?? 380) - (p.from ?? -420), 0, t1 - t0, E.settle));
      events.push({ kind: p.kind || "flyby", t0, t1, group: dr.group, y, open: ob ? +ob.f.toFixed(2) : null });
      return { objects: out, dr, y, from: p.from ?? -420, to: p.to ?? 380 };
    },
    // a fly-by that shoots into the background: each shot from the mouth down to a spot well under / behind the route
    strafe(ctx, p) {
      const f = api.flyby(ctx, Object.assign({ kind: "strafe" }, p)), out = f.objects, shots = p.shots || [p.t0 + (p.t1 - p.t0) * 0.4, p.t0 + (p.t1 - p.t0) * 0.7];
      for (const t of shots) { const fl = 0.5, frac = (t - fl - p.t0) / (p.t1 - p.t0), m = f.dr.mouth(0, t - fl);
        const from = { x: m.x + (f.to - f.from) * frac, y: m.y }, at = { x: ctx.xAt(t) + 150, y: ctx.yAt(t) - 150 };
        out.push(...kit.attack(ctx, { t, from, at, flight: fl, z: "B2", size: 0.8 })); }
      return out;
    },
    header(h) { return kit.header(K.channels(h, chans)); },
    events, groupRange: () => [o.g0 || G0, g - 1],
  };
  return api;
}

// ------------------------------------------------------------------ check: what the AI should catch before he does
const FIRE = new Set([1764, 1293]);
function check(objects, routePath, o = {}) {
  const ours = objects.filter(ob => { const gs = String((ob.props || {})[57] || "").split(".").map(Number); return gs.some(x => (x >= G0 && x <= G1) || (x >= 6401 && x <= 6999)); });
  const P = routePath.filter((_, i) => i % 24 === 0), near = (ob, d) => P.some(q => Math.abs(q.x - ob.x) < d && Math.abs(q.y - ob.y) < d);
  const issues = [];
  for (const ob of ours) {
    const z = +((ob.props || {})[24] ?? 0);
    if (FIRE.has(ob.id) && near(ob, 45) && z >= 1) issues.push({ kind: "FAKE HAZARD", x: Math.round(ob.x), y: Math.round(ob.y), why: "fire-coloured deco on a front layer next to the route" });
    if (z >= 1 && !FIRE.has(ob.id) && near(ob, 60)) issues.push({ kind: "IN THE WAY", x: Math.round(ob.x), y: Math.round(ob.y), why: "our piece on a play layer by the route" });
  }
  const per10 = new Map(); for (const ob of ours) { const k = Math.floor(ob.x / 3116); per10.set(k, (per10.get(k) || 0) + 1); }
  for (const [k, n] of per10) if (n > (o.budget || 1500)) issues.push({ kind: "BUDGET", x: k * 3116, why: n + " objects in 10 s" });
  const ev = (o.events || []).slice().sort((a, b) => a.t0 - b.t0);
  for (let i = 1; i < ev.length; i++) if (ev[i].t0 - ev[i - 1].t0 < 8) issues.push({ kind: "CROWDING", t: ev[i].t0, why: `${ev[i - 1].kind} at ${ev[i - 1].t0} s and ${ev[i].kind} at ${ev[i].t0} s` });
  for (const e of ev) if (e.open == null) issues.push({ kind: "HIDDEN", t: e.t0, why: `${e.kind}: no stretch of open sky in view (blocks cover it); move the event or pass y` });
  return { objects: ours.length, issues };
}

module.exports = { scene, check, openBand };

if (require.main === module) {
  const a = process.argv.slice(2), arg = (k, d) => { const i = a.indexOf("--" + k); return i >= 0 ? a[i + 1] : d; };
  const { GD, readGdlvl, writeGdlvl } = require("./io.js"), SOL = require("./solutions.js");
  const lvPath = path.resolve(a[0] === "check" ? a[1] : arg("level", path.join(ROOT, "levels", "gdlm_44_hellgate.gdlvl")));
  const L = readGdlvl(lvPath); let sol = SOL.get(L.levelStr, true);
  if ((!sol || !sol.events) && arg("route-of")) sol = SOL.get(readGdlvl(path.resolve(arg("route-of"))).levelStr, true);
  if (!sol || !sol.events) { const pe = require("./planned.js").plannedEvents(L.name, lvPath); if (Array.isArray(pe)) sol = { events: pe }; }
  if (!sol || !sol.events) { console.error("no saved route or planned presses for " + lvPath + ": the events follow the route"); process.exit(2); }
  const w = GD.makeWorld(L.level.objects, L.level.header), run = GD.run(w, sol.events);
  if (a[0] === "check") { const r = check(L.level.objects, run.path); for (const x of r.issues) console.log(`!! ${x.kind} ${x.x != null ? "x " + x.x + (x.y != null ? " y " + x.y : "") : "t " + x.t}: ${x.why}`);
    console.log(`${r.objects} living-scenery objects, ${r.issues.length} issue(s)`); process.exit(r.issues.length ? 1 : 0); }
  if (a[0] !== "lab") { console.log("usage: node tools/livescene.js lab [--level L] | check <level>"); process.exit(1); }
  // THE LAB: the level with three events in [from, to] (seconds): a horde, a fly-by, a strafe, 10+ s apart
  const bpm = 140, ctx = FX.context({ path: run.path, grid: { t0: 0, period: 60 / bpm } });
  // events stay in the gameplay: up to the last block or hazard (the open stretch after it is the ending's)
  const lastX = Math.max(...L.level.objects.filter(q => { const k = (OB.objInfo(q.id) || {}).kind; return k === "solid" || k === "hazard"; }).map(q => q.x));
  const t0 = +arg("from", 5), t1 = Math.min(+arg("to", 80), ctx.tAt(lastX) - 1);
  const sc = scene({}), objs = L.level.objects.slice(), span = t1 - t0;
  // the sky events go where open sky is in view for their whole length (openBand), at least 8 s after the last event
  const skyAt = (from, len) => { for (let t = from; t + len < t1; t += 0.5) if (openBand(ctx, L.level.objects, t, t + len, 62, "high", 35, 0.4)) return t; return null; };
  objs.push(...sc.horde(ctx, { t0: t0 + 1, t1: t0 + 1 + span * 0.25, n: 8, objects: L.level.objects }));
  // a dense level has few strips of sky (Hellgate 5-55 s: one, at 47 s): the first goes to a strafe, a second (8 s on) to a fly-by
  const ts = skyAt(t0 + 9, 3); if (ts != null) objs.push(...sc.strafe(ctx, { t0: ts, t1: ts + 3, from: -300, to: 500, shots: [ts + 1.4, ts + 2.4], objects: L.level.objects }));
  const tf = ts != null ? skyAt(ts + 8, 3) : null; if (tf != null) objs.push(...sc.flyby(ctx, { t0: tf, t1: tf + 3, from: -300, to: 500, objects: L.level.objects }).objects);
  const header = sc.header(L.level.header);
  const c = check(objs, run.path, { events: sc.events });
  const out = path.resolve(arg("out", path.join(ROOT, "levels", "lab", "gdlm_lab_live_scenery.gdlvl")));
  const rec = GD.newRecord("GDLM lab live scenery", "Living scenery on " + L.name + ": a zombie horde, a dragon fly-by, a dragon strafe (deco only). Made by Claude (and some humans)");
  for (const k of ["k45", "k8"]) { const v = GD.getField(L.rec, k); if (v != null) GD.setField(rec, k, "i", String(v)); }
  writeGdlvl(out, rec, { header, objects: objs });
  // the route stays the level's: same gameplay, so the saved route replays as is
  const w2 = GD.makeWorld(GD.parseLevel(readGdlvl(out).levelStr).objects, header), r2 = GD.run(w2, sol.events);
  // same gameplay, same route: saved for the new level string, so the viewer replays it at once and wip put never solves
  if (r2.done && !r2.dead) SOL.put(readGdlvl(out).levelStr, Object.assign({}, sol, { ok: true, copiedFrom: path.basename(lvPath) }));
  console.log(`${path.relative(ROOT, out)}: +${objs.length - L.level.objects.length} objects (${sc.events.map(e => e.kind + " " + e.t0.toFixed(1) + "-" + e.t1.toFixed(1) + " s" + (e.y != null ? " y " + Math.round(e.y) : " n " + e.n) + " open " + e.open).join(", ")}), route ${r2.done && !r2.dead ? "still clears" : "DIES " + r2.why}; check: ${c.issues.length ? c.issues.map(x => x.kind).join(", ") : "clean"}`);
}
