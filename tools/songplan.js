// node tools/songplan.js <custom id | Official> [--to <s>] [--from <s>]  -- a level's section plan from its song: cut at the
//   song's transitions (tools/sections.js's cuts: drops, entries, changes at least 6 s apart), each section typed by
//   sections.js character() (drop / break / build / entry / groove, the band that leads it, heaviness), and a mode and
//   feel per section that follow its type. Evgeni (2026-11-26): "sections have to be cut by the transitions of the level";
//   what a section gets follows what kind of section it is. Used by tools/hellgate_build.js (GDLM 44 v9).
//   The rules (soft, written from the mains' habits, LEGO.md "Combining", knowledge/levels/variety.md "Mode share"):
//     break   calm: cube, ball, ufo in turn (a break up to 12.5 s stays one section), a rest inside one over 8 s
//     entry   a new mode: the band coming in picks it -- low: ball / robot, mid: ufo or the cube upside down, top: wave
//     build   cube, denser as it rises
//     drop    the flight: ship (wave when the ship was the last flight)
//     groove  more of the same family, another mode than the last
//   never the same mode twice in a row; cube under ~50% of the time (tier "hard"); one upside-down cube section; a section
//   over SPLIT s is cut into equal parts on bars, the later parts typed groove (a long one held in one mode is a long corridor). Returns beats on the song's grid
//   (beat 1 = the song second `from`, which must sit on a beat).
"use strict";
const SPLIT = 10;

function plan(song, o = {}) {
  // one section typer for every builder: tools/sections.js (its cuts and character())
  const SX = require("./sections.js"), { j, music, end: songEnd } = SX.load(song), character = SX.character;
  const P = j.period, t0 = j.t0, from = o.from != null ? o.from : t0, to = o.to || 75;
  const cuts = SX.cuts(music, songEnd);
  // the level ends at the cut nearest `to`
  let endCut = cuts.reduce((b, c) => Math.abs(c - to) < Math.abs(b - to) ? c : b, cuts[cuts.length - 1]);
  const beat = t => Math.max(1, Math.round((t - from) / P) + 1);
  let secs = [], prev = null;
  for (let i = 0; i + 1 < cuts.length && cuts[i] < endCut - 0.5; i++) { const c = character(music, cuts[i], cuts[i + 1], prev); prev = c; secs.push(c); }
  // split the long ones at their middle bar (4 beats)
  const out = [];
  for (const c of secs) { const d = c.t1 - c.t0;
    if (d > (c.type === "break" ? 12.5 : SPLIT)) { const n = Math.ceil(d / SPLIT), step = d / n;
      for (let k = 0; k < n; k++) { const a = c.t0 + k * step, b = k === n - 1 ? c.t1 : c.t0 + (k + 1) * step;
        const ba = k ? Math.round((beat(a) - 1) / 4) * 4 + 1 : beat(a);
        out.push(Object.assign({}, c, { t0: a, t1: b, b0: ba, part: k, type: k && c.type !== "break" ? "groove" : c.type })); } }
    else out.push(Object.assign({}, c, { b0: beat(c.t0) })); }
  for (let i = 0; i < out.length; i++) out[i].b1 = i + 1 < out.length ? out[i + 1].b0 : beat(endCut);
  // modes
  let last = null, lastFly = null, udUsed = false, cubeT = 0, totT = 0;
  const FLYM = new Set(["ship", "wave", "ufo"]);
  for (const s of out) { const d = (s.b1 - s.b0) * P; let m;
    const cubeOk = (cubeT + d) / (totT + d) <= (o.cubeMax || 0.5) || totT === 0;
    if (s.type === "drop") m = lastFly === "ship" ? "wave" : "ship";
    else if (s.type === "entry") m = s.entering === "top" || s.lead === "top" ? "wave" : s.entering === "mid" || s.lead === "mid" ? (!udUsed && cubeOk && last !== "cube" ? "cube-ud" : "ufo") : "ball";   // (upside down is reverse variety: not held to the cube share)
    else if (s.type === "build") m = cubeOk ? "cube" : "ball";
    else if (s.type === "groove") m = last === "wave" || last === "ship" ? (!udUsed && cubeOk ? "cube-ud" : "cube") : lastFly === "ship" ? "wave" : "ship";
    else if (s.entering === "mid" && !udUsed && last !== "cube") m = "cube-ud";   // a break with a new mid sound
    else m = last === "cube" || !cubeOk ? (last === "ball" ? "ufo" : "ball") : last === "ball" ? "ufo" : "cube";   // break: calm modes in turn
    if (m === last || (m === "cube-ud" && last === "cube") || (m === "cube" && last === "cube-ud")) m = m === "ball" ? "cube" : m === "cube" || m === "cube-ud" ? "ball" : m === "wave" ? "ship" : m === "ship" ? "wave" : "cube";
    if (m === "cube-ud") udUsed = true;
    s.mode = m; if (FLYM.has(m)) lastFly = m; last = m; totT += d; if (/cube/.test(m)) cubeT += d;
    // a rest in a calm section over 8 s, in its middle bar
    if (s.type === "break" && d > 8) { const mid = Math.round(((s.b0 + s.b1) / 2 - 1) / 4) * 4 + 1; s.rest = [[mid, mid + 4]]; }
  }
  return { from, period: P, t0, sections: out.map(s => ({ b0: s.b0, b1: s.b1, t0: +s.t0.toFixed(1), t1: +s.t1.toFixed(1), type: s.type, lead: s.lead, entering: s.entering, heavy: s.heavy, mode: s.mode, rest: s.rest })) };
}
module.exports = { plan };

if (require.main === module) {
  const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? +a[i + 1] : undefined; };
  if (!a[0]) { console.log(require("fs").readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
  const r = plan(a[0], { to: opt("--to"), from: opt("--from") });
  for (const s of r.sections) console.log(`b${s.b0}-${s.b1}  ${String(s.t0).padStart(5)}-${String(s.t1).padEnd(5)} s  ${s.type.padEnd(6)} lead ${s.lead}${s.entering ? " in:" + s.entering : ""}  -> ${s.mode}${s.rest ? " rest b" + s.rest[0].join("-") : ""}`);
}
