// node tools/hellgate_full.js [--gameplay levels/gdlm_44_hellgate_gameplay_full.gdlvl] [--auto levels/gdlm_44_hellgate_auto_calm.gdlvl]
//                              [--ending levels/gdlm_44_hellgate_ending.gdlvl] [--out levels/gdlm_44_hellgate_full.gdlvl]
//   -> Hellgate end to end (HELLGATE.md "The full stitch"): the gameplay part, the auto chase and the gate ending, each
//      built by its own tool, joined on the song by tools/splice.js. Evgeni (2026-11-28): "where are we with full hell gate
//      - just to feel something while its still improving the different parts". So this only joins: each part is
//      rebuilt by its owner (typebuild for the gameplay, tools/hellgate_auto.js, tools/hellgate_ending.js) and this is run
//      again; rough spots are listed, not fixed here.
//   Seams (song seconds):
//     178.47  gameplay -> auto: the auto's own 2 s lead-in starts here (a cube on flat ground at 1x); the gameplay is cut
//             there (its last section, the ufo, loses ~2 s after its rest) and a portal wall turns the player into that cube
//     214.8   auto -> ending: the auto's cube has landed for good (its home wall), the ending is flat ground; the whole
//             ending level comes along (its set-up triggers and lead-in from 213.8 s play over the auto's last second)
//   Writes the level, <out>.planned.json (the gameplay's presses before the seam) and the route (tools/solutions.js),
//   and prints the seams with the player's state on both sides.
"use strict";
if (require.main === module) require("./heavy.js").claim();
const fs = require("fs"), path = require("path");
const { GD, readGdlvl, writeGdlvl } = require("./io.js");
const { splice } = require("./splice.js");
const ROOT = path.join(__dirname, ".."), TPS = GD.PHYS.TPS;
const SEAM1 = 178.47, SEAM2 = 214.8;

function build(o) {
  const G = readGdlvl(o.gameplay), A = readGdlvl(o.auto), E = readGdlvl(o.ending);
  const S = require("./solutions.js"), sol = S.get(G.levelStr, true);
  if (!sol || !sol.ok) throw new Error("the gameplay part has no beaten route: make.js it first");
  const g0 = require("./splice.js").songStart(G.level.header), cutTick = Math.round((SEAM1 - g0) * TPS);
  // the gameplay's presses before the seam (a hold still down there is let go at the seam)
  const ev = []; let down = false;
  for (const e of sol.events) { if (e.tick >= cutTick - 1) break; ev.push(e); down = e.type === "press"; }
  if (down) ev.push({ type: "release", tick: cutTick - 1 });
  const pathG = GD.run(GD.makeWorld(G.level.objects, G.level.header), sol.events).path;
  const r1 = splice(G, A, { at: SEAM1, pathA: pathG, wall: { mode: "cube", speed: 1, grav: 1, mini: false }, fade: 1.0 });
  const mid = { level: r1.level, levelStr: null };
  const pathM = GD.run(GD.makeWorld(r1.level.objects, r1.level.header), ev).path;
  const r2 = splice(mid, E, { at: SEAM2, pathA: pathM, leadB: Infinity, fade: 0.6 });
  const level = r2.level;
  // the whole run: the gameplay's presses, then nothing
  const w = GD.makeWorld(level.objects, level.header), run = GD.run(w, ev), p = run.path, end = p[p.length - 1];
  // the auto part must play exactly as alone after its first note (180.5 s): same height and mode as its own run
  const pA = GD.run(GD.makeWorld(A.level.objects, A.level.header), []).path, a0 = require("./splice.js").songStart(A.level.header);
  const drift = [];
  for (const s of [180.5, 185, 191.4, 200, 210, 214.7]) {
    const i = Math.round((s - g0) * TPS), j = Math.round((s - a0) * TPS);
    if (i < p.length && j < pA.length) drift.push({ song: s, dy: +(p[i].y - pA[j].y).toFixed(2), dx: +((p[i].x - r1.dx) - pA[j].x).toFixed(2), mode: p[i].mode, alone: pA[j].mode });
  }
  const res = { seams: [r1.report, r2.report], clears: !!end.done && !run.dead, dies: run.dead ? { song: +(g0 + p.length / TPS).toFixed(2), why: end.why } : null,
    secs: +(p.length / TPS).toFixed(1), songTo: +(g0 + p.length / TPS).toFixed(1), presses: ev.filter(e => e.type === "press").length, objects: level.objects.length, autoDrift: drift };
  return { G, level, ev, res, w, p };
}

if (require.main === module) {
  const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
  const o = { gameplay: path.resolve(opt("--gameplay", path.join(ROOT, "levels/gdlm_44_hellgate_gameplay_full.gdlvl"))),
    auto: path.resolve(opt("--auto", path.join(ROOT, "levels/gdlm_44_hellgate_auto_calm.gdlvl"))),
    ending: path.resolve(opt("--ending", path.join(ROOT, "levels/gdlm_44_hellgate_ending.gdlvl"))),
    out: path.resolve(opt("--out", path.join(ROOT, "levels/gdlm_44_hellgate_full.gdlvl"))), name: opt("--name", "GDLM 44 hellgate full") };
  const b = build(o);
  const rec = b.G.rec; GD.setField(rec, "k2", "s", o.name);
  writeGdlvl(o.out, rec, b.level);
  const R = readGdlvl(o.out);
  fs.writeFileSync(o.out.replace(/\.gdlvl$/, ".planned.json"), JSON.stringify({ made: "tools/hellgate_full.js", planned: b.ev.filter(e => e.type === "press").map(e => ({ t: +(e.tick / TPS).toFixed(4), what: "the gameplay part's route" })) }, null, 1));
  if (b.res.clears) require("./solutions.js").put(R.levelStr, { ok: true, kind: "human", events: b.ev, name: o.name, why: "joined: the gameplay part's route, the auto and the ending with no press" }, R.level);
  fs.writeFileSync(o.out.replace(/\.gdlvl$/, ".seams.json"), JSON.stringify(b.res, null, 1));
  console.log(JSON.stringify(b.res, null, 1));
  console.log("-> " + path.relative(ROOT, o.out) + (b.res.clears ? "  CLEARS" : "  DIES"));
}
module.exports = { build, SEAM1, SEAM2 };
