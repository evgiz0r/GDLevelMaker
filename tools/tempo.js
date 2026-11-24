// node tools/tempo.js <level.gdlvl | official:N | official ...> [--json] [--gate]
//
// Presses against the song's tempo. The user on GDLM 44 hellgate v6 (phone, 2026-11-24): "Still the cps is very small,
// compared to beat of the song." A soft rule: in the busy parts of a level (energy, tools/energy.js, in its upper half)
// the player presses about as often per BEAT as rated levels do; calm parts may be sparse.
//   inputs   = the HUMAN route's inputs (a hold through bounces = one tap per jump): our levels: the saved natural
//              route (tools/solutions.js) through lib/difficulty.js humanize; official levels: the difficulty model's
//              scored route (local/difficulty/scored_NN.json, the one QUALITY.md's CPS counts). Taps and presses in every
//              mode, and in ship / wave / ufo / swing a release too (both edges are played: deadair.js does the same)
//   phrase   = 2 bars of the song's beat grid (tools/beats.js); per phrase: inputs per beat and the energy e
//              (tools/energy.js, mean of its bars: 0 = the level's calmest bar, 1 = its busiest)
//   busy     = phrases with e >= 0.5. The level's number: the median inputs per beat over its busy phrases.
// WARN when the whole level's inputs per beat is under the official levels' range (REF.all), when the busy parts' median
// is under the officials' 10th percentile (REF.p10; measured with `node tools/tempo.js official`), or when two or more
// busy phrases have under 2 inputs in 8 beats. --phrases prints every phrase (time, mode-free count, energy).
// Static + humanize replays: about a second a level. POLISH.md "Soft rules from the user's notes".
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const { GD, readGdlvl } = require("./io.js");
const E = require("./energy.js"), B = require("./beats.js");
const DF = require("../lib/difficulty.js");   // humanize
const FLY = new Set(["ship", "wave", "ufo", "swing"]);
// measured 2026-11-24 on official 1-22 (`node tools/tempo.js official`): see POLISH.md "Presses vs tempo"
// official 1-16 + 19 (complete scored routes): inputs per beat over the whole level 0.53-0.87 (median 0.62); in the busy
// parts 0.50-1.13 (median 0.63); a busy phrase under 0.25 (1 input in 8 beats) in 1 of 17 levels (ToE, once)
const REF = { all: 0.52, p10: 0.50, median: 0.63, floor: 0.25 };

// inputs (s, level time) from a route on a level: [{ t, mode, type }] -> the counted times
const counted = acts => acts.filter(a => a.type !== "release" || FLY.has(a.mode)).map(a => a.t);
function inputs(objs, header, events) {
  const w = GD.makeWorld(objs, header);
  try { events = DF.humanize(w, events).events || events; } catch (e) {}
  const p = GD.run(w, events).path;
  return counted(events.map(e => ({ t: e.tick / 240, mode: (p[Math.min(p.length - 1, e.tick)] || {}).mode, type: e.type === "press" || e.down === true ? "press" : "release" })));
}
// level: energy.loadLevel's; t: input times in level seconds
function analyse(level, t) {
  const c = E.curve(level), g = level.grid, off = c.off;
  if (!g || !g.ok || c.unit !== "bar") return { error: "no beat grid for its song (node tools/beats.js)" };
  const song = t.map(x => x + off);
  const phrases = [];
  for (let i = 0; i + 1 < c.bars.length; i += 2) {
    const a = c.bars[i], b = c.bars[i + 1], n = song.filter(x => x >= a.t0 && x < b.t1).length;
    phrases.push({ t0: a.t0 - off, t1: b.t1 - off, n, perBeat: n / 8, e: (a.e + b.e) / 2 });
  }
  const busy = phrases.filter(p => p.e >= 0.5), med = v => { const s = v.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
  const busyMed = med(busy.map(p => p.perBeat)), all = song.length / ((c.end - off) / g.period);
  const flags = [];
  if (all < REF.all) flags.push(`${all.toFixed(2)} inputs per beat over the level (official levels: 0.53-0.87, median 0.62)`);
  if (busy.length && busyMed < REF.p10) flags.push(`busy parts: ${busyMed.toFixed(2)} inputs per beat (official levels: median ${REF.median}, 10th percentile ${REF.p10})`);
  const empty = busy.filter(p => p.perBeat < REF.floor);   // one is normal (ToE has one), two or more is a pattern
  if (empty.length >= 2) flags.push(`${empty.length} busy phrases with under 2 inputs in 8 beats: ${empty.map(p => p.t0.toFixed(1) + "-" + p.t1.toFixed(1) + " s").join(", ")}`);
  return { bpm: g.bpm, perBeat: +all.toFixed(2), busyPerBeat: +busyMed.toFixed(2), cps: +(song.length / (c.end - off)).toFixed(2), phrases, flags };
}
function check(src) {
  const L = E.loadLevel(src);
  if (/^official:\d+$/.test(src)) {
    const nn = String(+src.split(":")[1]).padStart(2, "0");
    let sc; try { sc = JSON.parse(fs.readFileSync(path.join(ROOT, "local", "difficulty", "scored_" + nn + ".json"), "utf8")); } catch (e) {}
    if (!sc || !sc.complete) return { name: L.name, error: "no complete scored route (node tools/difficulty.js)" };
    return Object.assign({ name: L.name }, analyse(L, counted(sc.actions.map(a => ({ t: a.tick / 240, mode: a.mode, type: a.type })))));
  }
  const r = readGdlvl(src), sol = require("./solutions.js").get(r.levelStr, true);
  if (!sol || !sol.events) return { name: L.name, error: "no saved route (node tools/solutions.js <level>)" };
  return Object.assign({ name: L.name }, analyse(L, inputs(L.objects, L.header, sol.events)));
}
module.exports = { check, analyse, inputs, REF };

if (require.main === module) {
  const argv = process.argv.slice(2);
  let list = argv.filter(a => !a.startsWith("--"));
  if (!list.length) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
  list = list.flatMap(a => a === "official" ? Array.from({ length: 22 }, (_, i) => "official:" + (i + 1)) : [a]);
  const rows = []; let bad = 0;
  for (const f of list) {
    let r; try { r = check(f); } catch (e) { r = { name: f, error: e.message }; }
    rows.push(r);
    if (r.error) { console.log(`${r.name}: ${r.error}`); continue; }
    bad += r.flags.length;
    console.log(`${r.name.padEnd(28)} ${r.bpm.toFixed(0).padStart(4)} bpm  ${r.cps.toFixed(2)} inputs/s  ${r.perBeat.toFixed(2)} per beat, busy parts ${r.busyPerBeat.toFixed(2)}${r.flags.length ? "  WARN" : ""}`);
    for (const s of r.flags) console.log("   " + s);
    if (argv.includes("--phrases")) for (const p of r.phrases) console.log(`     ${p.t0.toFixed(1).padStart(6)}-${p.t1.toFixed(1).padEnd(6)} s  ${String(p.n).padStart(2)} inputs  ${p.perBeat.toFixed(2)}/beat  energy ${p.e.toFixed(2)}${p.e >= 0.5 ? " busy" : ""}`);
  }
  const ok = rows.filter(r => !r.error);
  if (ok.length > 2) {
    const q = (v, p) => { const s = v.slice().sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
    const bm = ok.map(r => r.busyPerBeat), ph = ok.flatMap(r => r.phrases.filter(p => p.e >= 0.5).map(p => p.perBeat));
    console.log(`\n${ok.length} levels: busy inputs per beat p10 ${q(bm, 0.1).toFixed(2)}, median ${q(bm, 0.5).toFixed(2)}; busy phrases p5 ${q(ph, 0.05).toFixed(2)}, p10 ${q(ph, 0.1).toFixed(2)}`);
  }
  if (argv.includes("--json")) console.log(JSON.stringify(rows.map(r => Object.assign({}, r, { phrases: undefined }))));
  process.exit(argv.includes("--gate") && bad ? 1 : 0);
}
