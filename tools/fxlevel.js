// node tools/fxlevel.js [--song Electrodynamix] [--seed 1] [--out levels/lab/fx_level.gdlvl] [--name "GDLM fx level"] [--quiet]
//   -> an auto level (tools/autobeat.js, no click) whose gameplay is FULLY INVISIBLE from the first tick (alpha 0 on one
//      group: collision stays, AUTO.md / EFFECTS.md "Hidden gameplay") and whose show is a different music-synced effect
//      theme in each of the song's sections (tools/sections.js cuts), from tools/effects.js, plus the player's own path glow
//      and a flash where it touches a pad or ledge so the run still reads. The beat ending's blocks are hidden too; the
//      Claude sign stays visible (it is the end screen).
//   Evgeni, 2026-11-26: "make all gameplay invisible at the start so we [don't] show anything, then in each of the 9
//   sections apply some different theme (like circle around, or appearing shapes to the beat, or something falling ...)
//   what we need is a background i guess, as the basic one is very lame" -> "Fully invisible", "hidden all the way for now. maybe appear just on the last screen with the signature",
//   "go with the suggested picks" (the THEMES list below).
//   THEMES maps a section type + its order to an effect set; each section also gets its own background hue (colour 899 on
//   the background channel at the cut). The run with and without the effects must be the same and clear.
//   Library: build({song, seed}) -> {level, measures, sections}.
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
"use strict";
const fs = require("fs"), path = require("path");
const { GD, writeGdlvl, readGdlvl } = require("./io.js");
const FX = require("./effects.js"), AB = require("./autobeat.js"), SEC = require("./sections.js");
const ROOT = path.join(__dirname, "..");
const TPS = 240;

// one theme per section, in order (the song's own cut list decides how many are used); hue = the section's colour
const THEMES = [
  { name: "intro: ring grows", hue: 265, fx: ["ring"], opts: { ring: { r: 50, swell: 0.15 } } },
  { name: "drop: dancing circle + zoom", hue: 300, fx: ["ring", "zoomPunch", "beatFlash"] },
  { name: "break: clouds", hue: 200, fx: ["clouds"] },
  { name: "break: checkerboard", hue: 180, fx: ["fadeBlocks"] },
  { name: "entry: dancers", hue: 30, fx: ["dancers"] },
  { name: "entry: hit lines", hue: 220, fx: ["hitLines", "zoomPunch"] },
  { name: "the 3x part: chase + flashes", hue: 330, fx: ["chase", "beatFlash"] },
  { name: "entry: checkerboard fast", hue: 50, fx: ["fadeBlocks"], opts: { fadeBlocks: { every: 0.5 } } },
  { name: "last break: screen frame", hue: 250, fx: ["screenFrame", "clouds"] },
];

function build(o = {}) {
  const song = o.song || "Electrodynamix", seed = o.seed || 1;
  const b = AB.build({ song, seed, quiet: true });
  if (b.measures && b.measures.clears === false) throw new Error("the auto level dies: " + (b.fin && b.fin.why));
  const tmp = path.join(ROOT, "local", "tmp", "fxlevel_base.gdlvl");
  AB.write(tmp, b, "base");
  const L = readGdlvl(tmp), lv = GD.parseLevel(L.levelStr);
  const run = objs => GD.run(GD.makeWorld(objs, lv.header), []);
  const base = run(lv.objects);
  if (base.dead) throw new Error("the base dies: " + base.why);
  const g = AB.loadGrid(song), music = AB.musicOf(song);
  const ctx = FX.context({ path: base.path, grid: g, notes: music ? music.notes : [] });
  // 1. hide every object but the sign (its text 914, its groups 960-964, anything from the sign's column on that is deco)
  const sgn = require("./signature.js"), col = b.lv.sig ? b.lv.sig.col : null, ext = col != null ? sgn.extent(col) : null;
  const isSign = q => q.id === 914 || String((q.props || {})[57] || "").split(".").some(v => +v >= 960 && +v <= 964)
    || (ext && q.x >= ext.x0 - 60 && ["decoration"].includes((GD.objInfo(q.id) || {}).kind));
  const hide = ctx.hideAtStart(ctx.group());
  let hidden = 0;
  for (const q of lv.objects) {
    const k = (GD.objInfo(q.id) || {}).kind;
    if (k === "trigger" || isSign(q)) continue;
    q.props = Object.assign({}, q.props);
    q.props[57] = q.props[57] ? q.props[57] + "." + hide : String(hide);
    hidden++;
  }
  // 2. the sections and their themes
  const end = base.path.length / TPS - 2;
  const cuts = SEC.sections(song).sections.filter(s => s.t0 < end);
  const fx = [], log = [];
  const secs = cuts.length ? cuts : [{ t0: 0, t1: end, type: "groove" }];
  secs.forEach((s, i) => {
    const th = THEMES[Math.min(i, THEMES.length - 1)], t0 = Math.max(0.3, s.t0), t1 = Math.min(end, s.t1);
    if (t1 - t0 < 1) return;
    ctx.setHue(th.hue);
    // the background of the section: its own deep colour on the bg (1000) and ground (1001) channels, eased in at the cut
    fx.push(FX.T.colour(ctx.xAt(t0), 1000, ctx.pal.bg, 0.4), FX.T.colour(ctx.xAt(t0) + 1, 1001, ctx.pal.deep, 0.4));
    for (const name of th.fx) fx.push(...FX[name](ctx, Object.assign({ t0, t1 }, (th.opts || {})[name] || {})));
    // the run reads through these: the path's glow and a flash at every contact, in every section
    fx.push(...FX.pathGlow(ctx, { t0, t1 }), ...FX.contactFlash(ctx, { t0, t1 }));
    log.push(`${t0.toFixed(1)}-${t1.toFixed(1)} s ${s.type || ""}: ${th.name}`);
  });
  // the gameplay comes back on the last screen, with the sign (Evgeni: "hidden all the way for now. maybe appear just on the
  // last screen with the signature"): GD's final view starts ~229 units before the furthest object (signature.js extent)
  if (ext) { const xr = Math.max(...lv.objects.map(q => q.x)) - 229 - 60;
    fx.push({ id: 1007, x: xr, y: 1650, rot: 0, flipX: false, flipY: false, props: { 51: String(hide), 35: "1", 10: "0.5" } });
    log.push(`gameplay fades in at x ${xr.toFixed(0)} (the last screen)`); }
  fx.push(...ctx.prelude());
  const header = ctx.header(lv.header);
  const withFx = run(lv.objects.concat(fx)), same = withFx.path.length === base.path.length &&
    withFx.path.every((s, i) => Math.abs(s.x - base.path[i].x) < 1e-6 && Math.abs(s.y - base.path[i].y) < 1e-6);
  const level = { header, objects: lv.objects.concat(fx) };
  const measures = { secs: +(base.path.length / TPS).toFixed(1), hidden, fxObjects: fx.length, sections: log.length,
    fxChangeRun: !same, clears: !withFx.dead, why: withFx.why || "" };
  return { song, g, level, measures, log, record: L.record };
}

module.exports = { build, THEMES };

if (require.main === module) {
  const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  const r = build({ song: opt("--song") || "Electrodynamix", seed: +(opt("--seed") || 1) });
  const out = path.resolve(opt("--out") || path.join(ROOT, "levels", "lab", "fx_level.gdlvl"));
  const sg = require("./signature.js");
  const rec = GD.newRecord(opt("--name") || "GDLM fx level", sg.describe(`auto, gameplay invisible, one effect theme per section of ${r.song} (tools/fxlevel.js, EFFECTS.md)`));
  if (r.g.k45) GD.setField(rec, "k45", "i", r.g.k45); else GD.setField(rec, "k8", "i", String(r.g.k8));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  writeGdlvl(out, rec, r.level);
  if (!a.includes("--quiet")) console.log(r.log.join("\n"));
  console.log(JSON.stringify(r.measures));
  console.log(`${r.measures.clears && !r.measures.fxChangeRun ? "CLEARS, effects leave the run unchanged" : "PROBLEM"} -> ${path.relative(ROOT, out)}`);
}
