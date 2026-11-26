// node tools/fxgallery.js [--song Electrodynamix] [--out levels/lab/fx_gallery.gdlvl] [--name "GDLM fx gallery"] [--quiet]
//   -> the EFFECTS GALLERY: a short auto level (no click) on an official song, one labelled demo per effect of
//      tools/effects.js, each on the song's beats and notes, then the beat ending and the Claude signature. EFFECTS.md.
//   Gameplay: flat ground with yellow pads in the demos that need movement (contact flashes, clouds, the ring); in demo 5's
//   second half the pads are invisible (alpha 0) and still work. The zero-press run is checked to be the same with and
//   without the effects (they are deco and triggers only), and to clear.
//   Library: build({song}) -> {str, record, sections, measures}.
"use strict";
const fs = require("fs"), path = require("path");
const { GD, writeGdlvl } = require("./io.js");
const FX = require("./effects.js"), K = require("./scenekit.js");
const AB = require("./autobeat.js");
const ROOT = path.join(__dirname, "..");
const TPS = 240;

const objStr = o => {
  let s = `1,${o.id},2,${(+o.x).toFixed(2)},3,${(+o.y).toFixed(2)}`;
  if (o.flipX) s += ",4,1"; if (o.flipY) s += ",5,1"; if (o.rot) s += ",6," + o.rot;
  for (const [k, v] of Object.entries(o.props || {})) if (!["1", "2", "3", "4", "5", "6"].includes(k)) s += `,${k},${v}`;
  return s;
};
const levelStr = (header, objs) => header + ";" + objs.map(objStr).join(";") + ";";
function run(header, objs, farX) {
  const lv = GD.parseLevel(levelStr(header, objs.concat(farX ? [{ id: 1764, x: farX, y: 1500 }] : [])));
  const w = GD.makeWorld(lv.objects, lv.header), r = GD.run(w, []);
  return { path: r.path, dead: r.dead, why: r.why };
}

// the demos, in song beats (16 beats each), with what they show
const PLAN = [
  { b: [3, 8], title: "EFFECTS GALLERY", sub: "every effect on the beat - tools/effects.js" },
  { b: [8, 24], title: "1  ALPHA", sub: "fadeBlocks: halves trade places on each beat", fx: "fadeBlocks" },
  { b: [24, 40], title: "2  TOGGLE", sub: "chase: one group on at a time", fx: "chase" },
  { b: [40, 56], title: "3  MOVE", sub: "dancers: blocks hop in a wave", fx: "dancers" },
  { b: [56, 72], title: "4  LOCK TO CAMERA", sub: "screenFrame: a structure that rides the screen", fx: "screenFrame" },
  { b: [72, 88], title: "5  CONTACT FLASH", sub: "contactFlash: rings where you touch down", fx: "contactFlash", pads: 2, hideFrom: 80 },
  { b: [80, 88], title: "5b  HIDDEN PADS", sub: "the pads are invisible now - they still work", label2: true },
  { b: [88, 104], title: "6  HIT LINES + ZOOM", sub: "hitLines on strong notes, zoomPunch on the biggest", fx: "hitLines", also: ["zoomPunch"] },
  { b: [104, 120], title: "7  PATH GLOW + CLOUDS", sub: "pathGlow behind you, clouds lock to you", fx: "pathGlow", also: ["clouds"], pads: 4 },
  { b: [120, 136], title: "8  DANCING CIRCLE", sub: "ring: lock + rotate + scale on the beat", fx: "ring", pads: 4 },
  { b: [136, 144], title: "9a  COLOUR FLASH", sub: "beatFlash: colour trigger 899", fx: "beatFlash" },
  { b: [144, 152], title: "9b  PULSE FLASH  (untested)", sub: "pulseFlash: pulse trigger 1006", fx: "pulseFlash" },
];
const END_BEAT = 152;

function build(o = {}) {
  const song = o.song || "Electrodynamix", g = AB.loadGrid(song), music = AB.musicOf(song);
  const tb = b => g.t0 + b * g.period;
  let header = K.channels(GD.DEFAULT_HEADER, { 1000: { rgb: [16, 14, 46] }, 1001: { rgb: [28, 24, 70] }, 1009: { rgb: [60, 50, 140] } });
  const log = [];
  // 1. gameplay: flat ground; yellow pads on beats where the demo wants movement (each placed on the run so far)
  const play = [], hidePads = 3990;
  let base = run(header, play, tb(END_BEAT + 4) * 311.58 + 600);
  for (const s of PLAN.filter(s => s.pads)) {
    for (let b = s.b[0] + 1; b < s.b[1] - 1; b += s.pads) {
      const t = tb(b), i = Math.round(t * TPS), st = base.path[i];
      if (!st || !st.grounded) continue;
      const pad = { id: 35, x: st.x, y: 2 };
      if (s.hideFrom != null && b >= s.hideFrom) pad.props = { 57: String(hidePads) };
      // the launch on the beat tick: move the pad by the error, a few replays
      let trial;
      for (let k = 0; k < 4; k++) {
        trial = run(header, play.concat([pad]), tb(END_BEAT + 4) * 311.58 + 600);
        const q = trial.path; let L = -1;
        for (let j = Math.max(1, i - 120); j < Math.min(q.length, i + 120); j++) if (q[j].vy > q[j - 1].vy + 5 && q[j - 1].grounded) { L = j; break; }
        if (L < 0 || L === i) break;
        pad.x += (i - L) * 311.58 / TPS;
      }
      if (trial.dead) { log.push(`pad at beat ${b}: dies (${trial.why}), left out`); continue; }
      play.push(pad); base = trial;
    }
  }
  log.push(`${play.length} pads`);
  // 2. the effects, on that run
  const ctx = FX.context({ path: base.path, grid: g, notes: music ? music.notes : [] });
  const fx = [];
  if (play.some(q => q.props)) ctx.hideAtStart(hidePads);   // the hidden pads: alpha 0 from the first tick, they still work
  for (const s of PLAN) {
    const t0 = tb(s.b[0]), t1 = tb(s.b[1]);
    fx.push(...FX.label(ctx, { t0, t1: s.label2 ? t1 : s.hideFrom != null ? tb(s.hideFrom) : t1, text: s.title, sub: s.sub, y: 205 }));
    if (s.fx) fx.push(...FX[s.fx](ctx, { t0, t1 }));
    for (const a of s.also || []) fx.push(...FX[a](ctx, { t0, t1 }));
  }
  fx.push(...ctx.prelude());
  header = ctx.header(header);
  // 3. the effects must not change the run (deco and triggers only)
  const farX = tb(END_BEAT + 4) * 311.58 + 600, withFx = run(header, play.concat(fx), farX), same = withFx.path.length === base.path.length &&
    withFx.path.every((s, i) => Math.abs(s.x - base.path[i].x) < 1e-6 && Math.abs(s.y - base.path[i].y) < 1e-6);
  // 4. the beat ending + the signature (every level gets them)
  const fromX = ctx.xAt(tb(END_BEAT));
  const be = require("./beatend.js").beatEnd(levelStr(header, play), { period: g.period, t0: g.t0, fromX });
  const ending = be.objects.map(q => Object.assign({}, q, q.flipY ? {} : {}));
  const all = play.concat(ending);
  const fin = run(header, all.concat(fx), be.endX);
  const sg = require("./signature.js"), p = fin.path;
  const xAt = t => { const i = Math.round(t * TPS); return i < p.length ? p[i].x : p[p.length - 1].x + (i - p.length + 1) * 311.58 / TPS; };
  const tOfX = x => { let i = p.findIndex(s => s.x >= x); if (i < 0) i = p.length - 1; return i / TPS; };
  header = sg.header(header, { col: be.signCol, floorY: be.floorY || 0 });
  const sign = sg.signature({ col: be.signCol, floorY: be.floorY || 0, period: g.period, beats: be.beats, xOfT: xAt, tOfX });
  const str = levelStr(header, all.concat(fx));
  const lvl = GD.parseLevel(str);
  lvl.objects = lvl.objects.concat(sign);
  const measures = {
    secs: +(p.length / TPS).toFixed(1), pads: play.length, fxObjects: fx.length,
    triggers: fx.filter(q => [901, 1007, 1346, 2067, 1049, 899, 1006, 1913].includes(q.id)).length,
    groups: new Set(fx.flatMap(q => q.props && q.props[57] ? String(q.props[57]).split(".") : [])).size,
    fxChangeRun: !same, clears: !fin.dead && !withFx.dead, why: fin.why || withFx.why || "",
  };
  return { song, g, level: lvl, layoutStr: levelStr(header, all), measures, log, endingNotes: be.notes };
}

function write(out, b, name) {
  const sg = require("./signature.js");
  const rec = GD.newRecord(name, sg.describe(`effects gallery: one labelled demo per effect of tools/effects.js, on ${b.song}'s beats (auto, no click; EFFECTS.md)`));
  if (b.g.k45) GD.setField(rec, "k45", "i", b.g.k45); else GD.setField(rec, "k8", "i", String(b.g.k8));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  writeGdlvl(out, rec, b.level);
}

if (require.main === module) {
  const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  const t0 = Date.now(), b = build({ song: opt("--song") || undefined });
  const out = path.resolve(opt("--out") || path.join(ROOT, "levels", "lab", "fx_gallery.gdlvl"));
  write(out, b, opt("--name") || "GDLM fx gallery");
  // the build's stages for the viewer (CLAUDE.md "Every build shows its steps"): the layout (pads + ending), then the final
  try {
    const st = require("./stages.js"), name = opt("--name") || "GDLM fx gallery", base = path.basename(out, ".gdlvl"), session = opt("--session") || "fx-gallery";
    st.put({ session, base, name, stage: "layout", levelStr: b.layoutStr, note: b.measures.pads + " pads on beats, flat ground" });
    st.put({ session, base, name, stage: "final", levelStr: GD.serializeLevel ? GD.serializeLevel(b.level) : undefined, note: b.measures.triggers + " effect triggers" });
  } catch (e) { console.log("  stages: " + e.message); }
  if (!a.includes("--quiet")) { for (const l of b.log) console.log("  " + l); for (const l of b.endingNotes || []) console.log("  ending: " + l); }
  console.log(JSON.stringify(b.measures));
  console.log(`${b.measures.clears ? "CLEARS with no press" : "DIES: " + b.measures.why}${b.measures.fxChangeRun ? "  !! the effects change the run" : ""} -> ${path.relative(ROOT, out)} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
module.exports = { build, write, PLAN };
