// node tools/autodeco.js --song <id | Official> --seed N [--rate R] [--beats N] [--name "GDLM 75 ..."] [--out levels/x.gdlvl]
//                        [--session <wip session>] [--looks "fire,ice"] [--no-motes] [--quiet]
//   -> a short beat-first AUTO level (tools/autobeat.js) with its structures dressed and held together: the structure deco
//      pass (tools/structdeco.js: one design per structure, a look per song section, 3D) + holders and bridges
//      (tools/connect.js: chains / ropes, kept off the zero-press path, never across a portal) + motes, then the beat ending +
//      signature autobeat gives every level. Puts the build stages (song, layout, path, deco, final) with tools/stages.js.
//
// Why (2026-11-27, a short auto "with some deco and connected structures": structures held up or joined, not floating loose).
// Looks follow the song (tools/sections.js): break / entry / groove sections take the first look, drop sections the second
// (2 looks at most: knowledge/checklist.md "one block design at a time"). The ending keeps its own dress (beatend.js endDeco,
// fire on channels 912+, the same palette as look 1), so blocks of the ending are left out of the pass.
// Deco only after autobeat: the zero-press run is checked again on the final file and must still clear.
"use strict";
if (require.main === module) require("./heavy.js").claim();
const fs = require("fs"), path = require("path");
const { GD, readGdlvl, writeGdlvl } = require("./io.js");
const AB = require("./autobeat.js"), SDC = require("./structdeco.js"), K = require("./scenekit.js");
const ROOT = path.join(__dirname, "..");
const TPS = GD.PHYS.TPS;
const LOOKS = {
  fire: { design: "layered", pal: "fire", effects: ["bevel"], holders: "chain" },   // not "depth": its dark extrusion merges with a plain block's black body (roles pathDeco 18/29 sections on GDLM 75; bevel 3/29)
  ice: { design: "nested frames", pal: "ice", effects: ["bevel"], holders: "rope" },
};

const SKY = {   // bg 1000, ground 1001, line 1002, ground 2 1009, middleground 1013 / 1014 (GDLM 44 hellgate's for fire)
  fire: { 1000: { rgb: [40, 10, 14] }, 1001: { rgb: [16, 4, 6] }, 1002: { rgb: [255, 120, 40] }, 1009: { rgb: [12, 0, 0] }, 1013: { rgb: [22, 8, 10] }, 1014: { rgb: [16, 4, 6] } },
  ice: { 1000: { rgb: [8, 18, 40] }, 1001: { rgb: [4, 8, 20] }, 1002: { rgb: [150, 225, 255] }, 1009: { rgb: [2, 4, 12] }, 1013: { rgb: [10, 20, 40] }, 1014: { rgb: [4, 8, 20] } },
};

function stage(o, st, file, note, data) {
  if (!o.session) return;
  try { require("./stages.js").put({ session: o.session, base: path.basename(o.out, ".gdlvl"), name: o.name, stage: st,
    levelStr: file ? readGdlvl(file).levelStr : undefined, data, note }); }
  catch (e) { if (!o.quiet) console.log("  stages: " + e.message); }
}

function build(o) {
  const t0 = Date.now();
  // 1. layout + path: autobeat (triggers on the song's notes, hazards along the path, beat ending, signature)
  const b = AB.buildInSong({ song: o.song, seed: o.seed, rate: o.rate, beats: o.beats, from: o.from ?? 2, quiet: o.quiet });
  if (!b.measures.clears) throw new Error("autobeat: the auto run dies (" + b.fin.why + ")");
  stage(o, "song", null, `song ${o.song}: ${b.placed.filter(t => t.kind !== "none").length} notes chosen`, { song: String(o.song) });
  AB.write(o.out, b, o.name);
  stage(o, "layout", o.out, `autobeat seed ${o.seed}: ${b.measures.triggers} triggers, ${b.measures.secs} s, clears with no press`);
  stage(o, "path", o.out, `zero-press run: modes ${b.measures.modesSeen.join("/")}, on the beat ${b.measures.onBeat}`);
  const R = readGdlvl(o.out), level = R.level;
  // 2. the song's sections -> a look per section, at the x the zero-press run is at when the section starts
  let secs = [];
  try { secs = require("./sections.js").sections(String(o.song)).sections; } catch (e) { if (!o.quiet) console.log("  sections: " + e.message); }
  const p = b.fin.p, xAt = t => p[Math.min(p.length - 1, Math.max(0, Math.round(t * TPS)))].x;
  const looks = (o.looks || "fire,ice").split(",").map(s => s.trim());
  const sec = [{ from: 0, ...LOOKS[looks[0]] }];
  for (const s of secs) {
    if (s.t0 <= 0.01 || s.t0 * TPS >= p.length) continue;
    const want = s.type === "drop" && looks[1] ? looks[1] : looks[0];
    const cur = sec[sec.length - 1];
    if (cur.pal !== LOOKS[want].pal) sec.push({ from: Math.floor(xAt(s.t0) / 30), ...LOOKS[want] });
  }
  // 3. the structure pass on the gameplay blocks before the ending (the ending is dressed by beatend.js already)
  const endX0 = b.lv.sig && b.lv.sig.be ? b.lv.sig.be.startX - 60 : Infinity;
  const body = { header: level.header, objects: level.objects.filter(q => q.x < endX0) };
  const r = SDC.pass(body, [], { sections: sec, holders: "chain", interior: true }, {});
  // the scene colours: autobeat leaves GD's default sky (magenta 255,80,246), which no look is made for; a dark sky of the
  // first look's hue keeps the dressed structures (and their dark shades) apart from the sky (tools/roles.js)
  let header = K.channels(r.header, SKY[sec[0].pal] || SKY.fire); const add = r.objects.slice();
  if (!o.quiet) r.notes.forEach(n => console.log("  " + n));
  // 4. motes per look (decofx), over the gameplay part
  if (o.motes !== false) {
    const FX = require("./decofx.js");
    sec.forEach((s, i) => { const x0 = s.from * 30, x1 = i + 1 < sec.length ? sec[i + 1].from * 30 : Math.min(endX0, p[p.length - 1].x);
      try { const f = FX.fx({ header, objects: level.objects }, x0, x1, { theme: s.pal, fx: ["motes"] }); header = K.channels(header, f.channels); add.push(...f.objects); }
      catch (e) { if (!o.quiet) console.log("  motes: " + e.message); } });
  }
  writeGdlvl(o.out, R.rec, { header, objects: level.objects.concat(add) });
  stage(o, "deco", o.out, `structure deco + holders: ${r.notes[0] || ""}`);
  // 5. deco only: the final file must still clear with no press
  const F = readGdlvl(o.out), w = GD.makeWorld(F.level.objects, F.level.header), run = GD.run(w, []);
  const clears = !run.dead;
  stage(o, "final", o.out, clears ? "clears with no press after the deco" : "DIES after the deco");
  const M = Object.assign({}, b.measures, { looks: sec.map(s => `${s.from}:${s.pal}/${s.design}`), deco: add.length, finalClears: clears, buildSecs: +((Date.now() - t0) / 1000).toFixed(1) });
  return { b, M, sec, clears, notes: r.notes };
}

if (require.main === module) {
  const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  if (!a.length) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(0); }
  const o = { song: opt("--song") || "1086693", seed: +(opt("--seed") || 1), rate: opt("--rate") ? +opt("--rate") : undefined,
    beats: opt("--beats") != null ? +opt("--beats") : null, name: opt("--name") || "GDLM auto deco", session: opt("--session"),
    out: path.resolve(opt("--out") || path.join(ROOT, "levels", "lab", "auto_deco.gdlvl")), looks: opt("--looks") || undefined,
    motes: !a.includes("--no-motes"), quiet: a.includes("--quiet") };
  const res = build(o);
  console.log(JSON.stringify(res.M));
  console.log(`${res.clears ? "CLEARS with no press" : "DIES after the deco: " + "check"} -> ${path.relative(ROOT, o.out)}`);
  if (!res.clears) process.exit(1);
}
module.exports = { build, LOOKS };
