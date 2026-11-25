// node tools/onbeat.js <level.gdlvl> [--song <id>] [--bpm B --t0 S --downbeat 0] [--write] [--fly]
//   -- can this level be played on the beat? For every press of its saved route (tools/solutions.js, with windows), the
//      song's hits (tools/hits.js) that fall inside that press's timing window: a press whose window holds a K / S /
//      accent can be pressed ON the hit, one with only a lesser hit nearly so. Prints the share per kind and per mode
//      stretch. Flying stretches (ship, wave, swing, ufo) are left out unless --fly: their holds follow the music's flow.
//   --write: the on-hit times as the level's plan, <level>.planned.json ({planned: [{t, what}]}, level seconds); then
//      `node tools/solutions.js <level> --fresh` builds the human route on them where they clear (tools/planned.js,
//      lib/natural.js opts.planned) and `node tools/hits.js --level <level>` measures the result.
//   GDLM 44 v3 (2026-11-25): written because the picker's bricks had their presses placed by the solver in the middle
//   of each window, 7% of them on a hit, while 40% of the windows held a strong hit.
"use strict";
const fs = require("fs"), path = require("path");
const FLY = new Set(["ship", "wave", "swing", "ufo"]);

function onbeat(file, o = {}) {
  const { readGdlvl, GD } = require("./io.js"), S = require("./solutions.js"), { hits } = require("./hits.js");
  const L = readGdlvl(file), sol = S.get(L.levelStr, true);
  if (!sol || !sol.ok || !sol.windows) throw new Error("no saved route with windows for " + file + ": node tools/solutions.js " + file);
  const song = o.song || GD.getField(L.rec, "k45");
  const off = +((/(?:^|,)kA13,([-0-9.]+)/.exec(L.levelStr.split(";")[0]) || [])[1] || 0);
  const H = hits(song, { bpm: o.bpm, t0: o.t0, downbeat: o.downbeat });
  const strong = H.slots.filter(s => s.kind === "K" || s.kind === "S" || s.kind === "A").map(s => s.t - off);
  const weak = H.slots.filter(s => s.kind === "x").map(s => s.t - off);
  const w = GD.makeWorld(L.level.objects, L.level.header), p = GD.run(w, sol.events).path;
  const rows = [], planned = [];
  for (const [ty, tick, lo, hi] of sol.windows) {
    if (ty !== 0) continue;
    const mode = (p[tick] || p[p.length - 1]).mode;
    if (FLY.has(mode) && !o.fly) continue;
    const a = lo / 240 + 0.008, b = hi / 240 - 0.008, mid = tick / 240;   // a frame's margin inside the window
    const inS = strong.filter(t => t >= a && t <= b), inW = weak.filter(t => t >= a && t <= b);
    const near = arr => arr.slice().sort((u, v) => Math.abs(u - mid) - Math.abs(v - mid))[0];
    const kind = inS.length ? "strong" : inW.length ? "lesser" : "none", t = inS.length ? near(inS) : inW.length ? near(inW) : null;
    rows.push({ tick, mode, kind, t, ms: Math.round((hi - lo) / 0.24) });
    if (t != null) planned.push({ t: +t.toFixed(4), what: "press on a " + kind + " hit" });
  }
  const n = rows.length, k = s => rows.filter(r => r.kind === s).length;
  return { file, n, strong: k("strong"), lesser: k("lesser"), none: k("none"), rows, planned };
}

if (require.main === module) {
  const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  if (!a[0]) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
  const num = k => opt(k) != null ? +opt(k) : undefined;
  const r = onbeat(a[0], { song: opt("--song"), bpm: num("--bpm"), t0: num("--t0"), downbeat: num("--downbeat"), fly: a.includes("--fly") });
  const pc = x => Math.round(100 * x / (r.n || 1)) + "%";
  console.log(`${path.basename(r.file)}: ${r.n} presses${a.includes("--fly") ? "" : " outside flying stretches"}: ${r.strong} (${pc(r.strong)}) can land on a strong hit, ${r.lesser} (${pc(r.lesser)}) on a lesser one, ${r.none} (${pc(r.none)}) on none`);
  const by = {}; for (const x of r.rows) { const b = by[x.mode] = by[x.mode] || { n: 0, s: 0 }; b.n++; if (x.kind === "strong") b.s++; }
  console.log("   by mode: " + Object.entries(by).map(([m, b]) => `${m} ${b.s}/${b.n}`).join(", "));
  if (a.includes("--write")) {
    const out = a[0].replace(/\.gdlvl$/, ".planned.json");
    fs.writeFileSync(out, JSON.stringify({ made: "tools/onbeat.js", planned: r.planned }, null, 1) + "\n");
    console.log(`-> ${out} (${r.planned.length} presses on hits); next: node tools/solutions.js ${a[0]} --fresh`);
  }
}
module.exports = { onbeat };
