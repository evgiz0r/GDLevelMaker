// node tools/hellgate_auto.js [--seed N] [--rate R] [--out levels/lab/hellgate_auto.gdlvl] [--session hellgate-auto] [--quiet]
//   -> Hellgate's auto part (HELLGATE.md: song 343707 from 180.7 to 215.4 s) as a standalone piece, to be stitched onto
//      GDLM 44 later: the chase (Evgeni, 2026-11-28: "we are running, and some demons are chasing us. shooting at us,
//      throwing fire ... dragons above flying. we avoid by some auto gameplay that avoid those things. and then on the beat
//      we pass the gate, and it closes on them" -- the gate is the ending thread's, tools/hellgate_ending.js, from 215.4 s).
//   Writes <out> and <out>.dodges.json: every dodge (a trigger that turned the player on a note) with the spot the player
//   would have reached without it (the zero-press run with that one trigger taken out), so the chasers' shots land there.
//
// Built from (no new mechanics here, all from the general tools):
//   1. tools/autobeat.js --offset: triggers on the song's notes in level time (kA13 = 178.47: a 2 s lead-in before 180.5 s),
//      no ending (the ending part follows); the home wall hands over a plain 1x cube on the ground.
//   2. 180.7-191.4 s raw (Evgeni: "10 seconds of the auto to show the actual gameplay behind the scenes, that it's real"):
//      plain blocks under Hellgate's sky; from 191.4 s the structure deco pass in the hellgate design theme.
//   3. The chasers (demons, dragons, their shots) come from tools/hellgate_chase.js (the ending thread's library) when it
//      is there: deco only, the zero-press run is checked again on the final file.
// Seam (agreed with the ending thread 2026-11-28): at 215.4 s the player is a cube at 1x on flat ground, normal gravity and
// size, nothing ahead.
"use strict";
if (require.main === module) require("./heavy.js").claim();
const fs = require("fs"), path = require("path");
const { GD, readGdlvl, writeGdlvl } = require("./io.js");
const AB = require("./autobeat.js"), SDC = require("./structdeco.js"), K = require("./scenekit.js");
const ROOT = path.join(__dirname, "..");
const TPS = GD.PHYS.TPS;
const SONG = "343707", OFFSET = 178.47, FROM_BEAT = 436, BEATS = 79;   // beats 436..515 = song 180.5..213.2 s: the home wall 2 beats later, the cube down by 215.4
const CUT = { raw: 180.7, deco: 191.4, brk: 203.4, end: 215.4 };            // song seconds (tools/sections.js 343707)
const lt = s => s - OFFSET;                                                   // song second -> level second

function stage(o, st, file, note, data) {
  if (!o.session) return;
  try { require("./stages.js").put({ session: o.session, base: path.basename(o.out, ".gdlvl"), name: o.name, stage: st,
    levelStr: file ? readGdlvl(file).levelStr : undefined, data, note }); }
  catch (e) { if (!o.quiet) console.log("  stages: " + e.message); }
}

// the spot each dodge saved the player from: the level with that one trigger left out, run from the start for a beat past it
function dodges(file, b, o = {}) {
  const L = readGdlvl(file).level, period = b.g.period, out = [];
  const trig = b.placed.filter(t => t.kind !== "none" && t.kind !== "speed" && t.tick / TPS < lt(CUT.end));
  const p = b.fin.p;
  for (const t of trig) {
    // the trigger object: the one autobeat put nearest the player's x on that tick
    const s = p[Math.min(p.length - 1, t.tick)];
    let best = -1, bd = 1e9;
    L.objects.forEach((q, i) => { const k = GD.objInfo(q.id).kind; if (k === "decoration" || q.id === 1) return; const d = Math.hypot(q.x - s.x, q.y - s.y); if (d < bd) { bd = d; best = i; } });
    if (best < 0 || bd > 120) continue;
    const objs = L.objects.filter((_, i) => i !== best), w = GD.makeWorld(objs, L.header);
    const upto = t.tick + Math.round(period * TPS);
    const r = GD.run(w, [], { maxTicks: upto + 1 });
    const q = r.path && r.path[Math.min(r.path.length - 1, upto)];
    const real = p[Math.min(p.length - 1, upto)];
    if (!q) continue;
    out.push({ t: +(t.tick / TPS).toFixed(3), song: +(t.tick / TPS + OFFSET).toFixed(3), kind: t.kind,
      at: { x: +q.x.toFixed(1), y: +q.y.toFixed(1) }, real: { x: +real.x.toFixed(1), y: +real.y.toFixed(1) },
      miss: +Math.hypot(q.x - real.x, q.y - real.y).toFixed(1), diedThere: !!(r.dead && r.path.length <= upto + 1) });
  }
  return out.filter(d => d.miss >= 20);   // a trigger that hardly moved the player is no dodge
}

function build(o) {
  const t0 = Date.now();
  const b = AB.buildInSong({ song: SONG, seed: o.seed, rate: o.rate, offset: OFFSET, from: FROM_BEAT, beats: BEATS, ending: false, quiet: o.quiet });
  if (!b.measures.clears) throw new Error("autobeat: the auto run dies (" + b.fin.why + ")");
  stage(o, "song", null, `Hellgate ${CUT.raw}-${CUT.end} s: ${b.measures.triggers} notes chosen`, { song: SONG });
  AB.write(o.out, b, o.name);
  stage(o, "layout", o.out, `autobeat seed ${o.seed}: ${b.measures.triggers} triggers, clears with no press`);
  const R = readGdlvl(o.out), level = R.level, p = b.fin.p;
  const xAt = t => p[Math.min(p.length - 1, Math.max(0, Math.round(t * TPS)))].x;
  // the seam: the player at the 215.4 s cut
  const sE = p[Math.min(p.length - 1, Math.round(lt(CUT.end) * TPS))];
  const seam = { song: CUT.end, x: +sE.x.toFixed(1), y: +sE.y.toFixed(1), mode: sE.mode, sp: sE.sp, grav: sE.grav, mini: !!sE.mini, onGround: !!sE.g };
  // the deco: raw before 191.4 s, the hellgate theme after
  const col0 = Math.floor(xAt(lt(CUT.deco)) / 30);
  const body = { header: level.header, objects: level.objects.filter(q => q.x >= col0 * 30 - 15) };
  const r = SDC.pass(body, [], { sections: [{ from: col0, theme: "hellgate" }], holders: "chain", interior: true }, {});
  const DT = require("./designthemes.js"), sky = DT.resolve("hellgate").skies[0];
  let header = K.channels(r.header, { 1000: { rgb: sky.bg }, 1001: { rgb: sky.ground }, 1009: { rgb: sky.ground } });
  // the structure pass dressed only what lies past col0, but its header keeps the colours of the whole level
  const add = r.objects.slice();
  if (!o.quiet) r.notes.forEach(n => console.log("  " + n));
  writeGdlvl(o.out, R.rec, { header, objects: level.objects.concat(add) });
  stage(o, "deco", o.out, `raw to ${CUT.deco} s, hellgate theme after: ${add.length} deco objects`);
  // the dodges: where the shots land
  const D = dodges(o.out, b);
  fs.writeFileSync(o.out.replace(/\.gdlvl$/, ".dodges.json"), JSON.stringify({ song: SONG, offset: OFFSET, cuts: CUT, seam, dodges: D }, null, 1));
  // deco only: the final file must still clear with no press, on the same path
  const F = readGdlvl(o.out), w = GD.makeWorld(F.level.objects, F.level.header), run = GD.run(w, []);
  const n = Math.min(run.path.length, p.length, Math.round(lt(CUT.end) * TPS) + 1), same = n > 0 && [...Array(n).keys()].every(i => Math.abs(run.path[i].x - p[i].x) < 0.01 && Math.abs(run.path[i].y - p[i].y) < 0.01);
  const clears = !run.dead;
  if (clears) require("./planned.js").writeAuto(o.out, "tools/hellgate_auto.js: clears with no press");
  stage(o, "final", o.out, clears ? `clears with no press, ${D.length} dodges` : "DIES after the deco");
  const M = Object.assign({}, b.measures, { deco: add.length, dodges: D.length, seam, finalClears: clears, samePath: same, buildSecs: +((Date.now() - t0) / 1000).toFixed(1) });
  return { b, M, D, clears };
}

if (require.main === module) {
  const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  const o = { seed: +(opt("--seed") || 1), rate: opt("--rate") ? +opt("--rate") : 3, name: opt("--name") || "GDLM 44 hellgate auto",
    session: opt("--session"), out: path.resolve(opt("--out") || path.join(ROOT, "levels", "lab", "hellgate_auto.gdlvl")), quiet: a.includes("--quiet") };
  const res = build(o);
  console.log(JSON.stringify(res.M));
  console.log(`${res.clears ? "CLEARS with no press" : "DIES after the deco"} -> ${path.relative(ROOT, o.out)} (${res.M.buildSecs} s)`);
  if (!res.clears) process.exit(1);
}
module.exports = { build, dodges, CUT, OFFSET };
