// node tools/autostudy.js [--min 0.8] [--level 9,18] [--out knowledge/auto_study.json]
// node tools/autostudy.js --community <id,id,...|all-auto>  -- whole AUTO levels (rated Auto, played with no press) from
//   local/community/<id>.gdlvl: zero-press run, effects per second, mode / speed / size changes, upside-down share, the
//   longest falls, how often the same effect comes twice, how many effects land on the song's beat (local/beats, needs
//   tools/songs.js + tools/beats.js for the song) -> knowledge/auto_community.json (numbers only; the levels stay local)
//   How the 22 main levels build their AUTO parts: every stretch of 0.8 s+ on their saved route with no press where the
//   level itself moves the player (pads, gravity / mode / speed portals, slopes, a rise or fall of 3+ blocks). For each:
//   what moves the player (in order), how long, how far up and down, how many turns, the mode and speed, and whether a
//   stray click there kills (a tap every 0.1 s, each alone, replayed from that tick to the stretch's end).
//   Writes NUMBERS ONLY (no layouts: RobTop's levels stay local) to knowledge/auto_study.json and prints the summary
//   AUTO.md quotes. Needs local/official_NN.json (the PC's solved main levels; stage them in the cloud first).
// AUTO.md: what an auto brick is, the study, the builder (tools/autobricks.js), what is open.
"use strict";
if (require.main === module) require("./heavy.js").claim();
const fs = require("fs"), path = require("path");
const { GD } = require("./io.js");
const ROOT = path.join(__dirname, ".."), TPS = GD.PHYS.TPS, B = 30;
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const MIN = +arg("--min", 0.8), OUT = path.join(ROOT, arg("--out", "knowledge/auto_study.json"));
const ONLY = arg("--level", "") ? new Set(arg("--level").split(",").map(Number)) : null;
const SPEEDNAME = ["0.5x", "1x", "2x", "3x", "4x"];
const cloneS = s => structuredClone(s);

// one stretch [ia, ib] of the route path p in world w: what moved the player
function describe(w, p, ia, ib) {
  const movers = [], seen = new Set(p[ia].used || []);
  let lo = 1e9, hi = -1e9, slopeT = 0, gnd = 0, turns = 0, lastSign = 0, gravFlips = 0;
  const modes = [p[ia].mode], speeds = [SPEEDNAME[p[ia].sp] || String(p[ia].sp)];
  for (let i = ia; i <= ib; i++) {
    const s = p[i];
    lo = Math.min(lo, s.y); hi = Math.max(hi, s.y);
    if (s.onSlope) slopeT++;
    if (s.grounded) gnd++;
    const sg = Math.abs(s.vy) < 0.5 ? 0 : Math.sign(s.vy);
    if (sg && lastSign && sg !== lastSign) turns++;
    if (sg) lastSign = sg;
    if (i > ia && s.grav !== p[i - 1].grav) gravFlips++;
    if (s.mode !== modes[modes.length - 1]) modes.push(s.mode);
    const sn = SPEEDNAME[s.sp] || String(s.sp); if (sn !== speeds[speeds.length - 1]) speeds.push(sn);
    for (const u of s.used || []) if (!seen.has(u)) {
      seen.add(u);
      const it = w.items.find(t => t.i === u);
      if (it && it.kind !== "coin") movers.push({ kind: it.kind, name: it.d.name || String(it.o.id), x: it.o.x });
    }
  }
  if (slopeT > 0.25 * TPS) movers.push({ kind: "slope", name: "slope ride" });
  return { secs: +((p[ib].tick - p[ia].tick) / TPS).toFixed(2), x0: Math.round(p[ia].x / B), x1: Math.round(p[ib].x / B),
    rise: +((hi - lo) / B).toFixed(1), dy: +((p[ib].y - p[ia].y) / B).toFixed(1), turns, gravFlips, grounded: +(gnd / (ib - ia + 1)).toFixed(2),
    slope: +(slopeT / TPS).toFixed(2), modes, speeds, movers };
}
// the family: what does the moving (STYLE of the stretch, not its shape)
function family(d) {
  const k = d.movers.map(m => m.kind), n = m => k.filter(x => x === m).length;
  const pads = n("pad"), grav = n("gravity") + (d.gravFlips && !n("gravity") ? 1 : 0), mode = n("mode"), speed = n("speed");
  if (mode) return "portal ride";
  if (grav >= 2 || d.gravFlips >= 2) return "gravity ping-pong";
  if (pads >= 2) return "pad chain";
  if (pads === 1 && grav) return "pad + gravity";
  if (pads === 1) return "pad launch";
  if (grav === 1) return "gravity flip";
  if (speed) return "speed change";
  if (d.slope >= 0.25) return "slope ride";
  if (k.includes("orb")) return "orb pass";
  if (d.rise >= 3) return d.dy <= -3 ? "fall" : d.dy >= 3 ? "rise" : "dip";
  return "walk";
}
// does a lone tap at tick t (from the route's state there) still live to the stretch's end?
function clickSafe(w, p, ia, ib) {
  const step = Math.max(1, Math.round(0.1 * TPS)), res = [];
  for (let i = ia; i < ib - 6; i += step) {
    const s = cloneS(p[i]); let ok = true;
    GD.step(w, s, { press: true, held: true });
    for (let k = 0; k < 2 && !s.dead; k++) GD.step(w, s, { press: false, held: false });
    while (!s.dead && !s.done && s.tick < p[ib].tick) GD.step(w, s, { press: false, held: false });
    if (s.dead) ok = false;
    res.push(ok);
  }
  return res.length ? +(res.filter(Boolean).length / res.length).toFixed(2) : 1;
}

function stretches(w, p, events) {
  const ps = events.filter(e => e.type === "press").map(e => e.tick).sort((a, b) => a - b), out = [];
  const idxOf = t => { let lo = 0, hi = p.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (p[m].tick < t) lo = m + 1; else hi = m; } return lo; };
  const end = p[p.length - 1].tick;
  for (let k = 0; k <= ps.length; k++) {
    // a held press keeps going: the stretch starts after its release
    const rel = k ? (events.find(e => e.type === "release" && e.tick > ps[k - 1]) || { tick: ps[k - 1] }).tick : 0;
    const a = k ? Math.max(rel, ps[k - 1]) + 0.2 * TPS : 0.5 * TPS, b = k < ps.length ? ps[k] - 0.15 * TPS : end - 0.1 * TPS;
    if ((b - a) / TPS < MIN) continue;
    const ia = idxOf(Math.round(a)), ib = idxOf(Math.round(b));
    if (ib - ia < MIN * TPS * 0.9) continue;
    out.push([ia, ib]);
  }
  return out;
}

// ---------------------------------------------------------------- whole auto levels from the community
function measureAuto(w, p, beats, offset) {
  const ev = [], seen = new Set();
  for (const s of p) for (const u of s.used || []) if (!seen.has(u)) {
    seen.add(u); const it = w.items.find(t => t.i === u);
    if (it && it.kind !== "coin") ev.push({ t: s.tick / TPS, col: Math.round(it.o.x / B), name: /gravity/.test(it.d.name || "") ? "gravity" : it.d.name || String(it.o.id), kind: it.kind });
  }
  // one effect per column (a stacked wall is one)
  const eff = []; for (const e of ev) if (!eff.length || eff[eff.length - 1].col !== e.col) eff.push(e);
  const secs = p[p.length - 1].tick / TPS;
  // falls: the longest runs of one vertical direction (blocks, seconds)
  const falls = []; let a = 0;
  for (let i = 1; i < p.length; i++) { const d = Math.sign(p[i].y - p[i - 1].y), d0 = Math.sign(p[a + 1 < p.length ? a + 1 : a].y - p[a].y); if (d !== d0 || i === p.length - 1) { const dy = (p[i - 1].y - p[a].y) / B; if (Math.abs(dy) >= 3) falls.push({ dy: +dy.toFixed(1), secs: +((p[i - 1].tick - p[a].tick) / TPS).toFixed(2), grav: p[a].grav }); a = i - 1; } }
  falls.sort((x, y) => Math.abs(y.dy) - Math.abs(x.dy));
  const ch = k => p.filter((q, i) => i && q[k] !== p[i - 1][k]).length;
  const kinds = {}; for (const e of eff) kinds[e.name] = (kinds[e.name] || 0) + 1;
  const out = { secs: +secs.toFixed(1), effects: eff.length, rate: +(eff.length / secs).toFixed(2), modeChanges: ch("mode"), speedChanges: ch("sp"), sizeChanges: ch("mini"),
    reverse: +(p.filter(q => q.grav < 0).length / p.length).toFixed(2), repeats: +(eff.filter((e, i) => i && e.name === eff[i - 1].name).length / Math.max(1, eff.length - 1)).toFixed(2),
    rise: +((Math.max(...p.map(q => q.y)) - Math.min(...p.map(q => q.y))) / B).toFixed(1), bigFalls: falls.filter(f => Math.abs(f.dy) >= 8).length, longestFall: falls[0] || null,
    gapMedian: (() => { const g = eff.slice(1).map((e, i) => e.t - eff[i].t).sort((x, y) => x - y); return g.length ? +g[g.length >> 1].toFixed(2) : null; })(),
    kinds: Object.entries(kinds).sort((x, y) => y[1] - x[1]).slice(0, 10) };
  if (beats && beats.period) {
    const P = beats.period, err = t => { const st = t + (offset || 0) - beats.t0, ph = ((st / P) % 1 + 1) % 1; return Math.min(ph, 1 - ph) * P * 1000; };
    const ms = eff.map(e => err(e.t));
    out.onBeat = +(ms.filter(m => m <= 50).length / Math.max(1, ms.length)).toFixed(2);   // chance alone: 100 ms / period
    out.onHalf = +(eff.map(e => { const st = e.t + (offset || 0) - beats.t0, ph = ((st / (P / 2)) % 1 + 1) % 1; return Math.min(ph, 1 - ph) * P / 2 * 1000; }).filter(m => m <= 40).length / Math.max(1, eff.length)).toFixed(2);
    out.chance = +(0.1 / P).toFixed(2); out.bpm = beats.bpm;
  }
  return out;
}
function community(ids) {
  const { readGdlvl } = require("./io.js"), dir = path.join(ROOT, "local", "community"), res = [];
  let beatsOf = () => null; try { const BT = require("./beats.js"); beatsOf = id => id ? BT.loadBeats("custom_" + id) : null; } catch (e) {}
  if (ids[0] === "all-auto") ids = fs.readdirSync(dir).filter(f => /^\d+\.gdlvl$/.test(f)).map(f => f.replace(".gdlvl", ""));
  for (const id of ids) {
    const f = path.join(dir, id + ".gdlvl"); if (!fs.existsSync(f)) { console.log(`  ${id}: not in local/community (node tools/fetch_level.js ${id})`); continue; }
    const L = readGdlvl(f), w = GD.makeWorld(L.level.objects, L.level.header), r = GD.run(w, []);
    if (r.dead && (r.end.x / w.endX) < 0.9 && ids.length > 1 && process.argv.includes("--only-auto")) continue;
    const song = GD.getField(L.rec, "k45"), off = +((/(^|,)kA13,([-0-9.]+)/.exec(L.level.header) || [])[2] || 0);
    const m = measureAuto(w, r.path, beatsOf(song), off);
    m.id = id; m.name = L.name; m.song = song || null; m.auto = !r.dead; if (r.dead) m.diesAt = +(100 * r.end.x / w.endX).toFixed(0);
    res.push(m);
    console.log(`  ${id} ${L.name.padEnd(24)} ${m.auto ? "auto " : "dies " + m.diesAt + "%"} ${m.secs}s  ${m.rate} eff/s (gap ${m.gapMedian}s)  modes ${m.modeChanges} speed ${m.speedChanges} size ${m.sizeChanges}  rev ${m.reverse}  repeats ${m.repeats}  rise ${m.rise}  big falls ${m.bigFalls}${m.longestFall ? " (longest " + m.longestFall.dy + " in " + m.longestFall.secs + "s)" : ""}${m.onBeat != null ? "  on beat " + m.onBeat + " (chance " + m.chance + ")" : "  (no beat grid)"}`);
  }
  const OUTC = path.join(ROOT, "knowledge", "auto_community.json");
  let old = []; try { old = JSON.parse(fs.readFileSync(OUTC, "utf8")).levels || []; } catch (e) {}
  const all = old.filter(o => !res.some(r => r.id === o.id)).concat(res);
  fs.writeFileSync(OUTC, JSON.stringify({ v: 1, at: new Date().toISOString().slice(0, 10), note: "whole community auto levels, numbers only (tools/autostudy.js --community, AUTO.md)", levels: all }, null, 0).replace(/\},\{"secs"/g, "},\n{\"secs\""));
  console.log("  -> " + path.relative(ROOT, OUTC));
}

function main() {
  if (process.argv.includes("--community")) return community(arg("--community", "all-auto").split(","));
  const all = [];
  for (let n = 1; n <= 22; n++) {
    if (ONLY && !ONLY.has(n)) continue;
    const f = path.join(ROOT, "local", `official_${String(n).padStart(2, "0")}.json`);
    if (!fs.existsSync(f)) { console.log(`  ${n}: no local/official_${n}.json`); continue; }
    const j = JSON.parse(fs.readFileSync(f, "utf8"));
    if (!j.solution || !j.solution.events) continue;
    const L = GD.parseLevel(j.level), w = GD.makeWorld(L.objects, L.header);
    const r = GD.run(w, j.solution.events), p = r.path;
    const lvlSecs = p[p.length - 1].tick / TPS;
    let nAuto = 0, autoSecs = 0;
    for (const [ia, ib] of stretches(w, p, j.solution.events)) {
      const d = describe(w, p, ia, ib); d.family = family(d);
      if (d.family === "walk") continue;
      if (d.modes.length === 1 && /ship|ufo|wave|swing/.test(d.modes[0]) && !d.movers.length && d.rise < 3) continue;   // a flying mode coasting: not auto
      d.clickSafe = clickSafe(w, p, ia, ib);
      d.level = n; d.levelName = j.name; d.at = +(p[ia].tick / TPS).toFixed(1);
      all.push(d); nAuto++; autoSecs += d.secs;
    }
    console.log(`  ${String(n).padStart(2)} ${j.name.padEnd(22)} ${String(nAuto).padStart(3)} auto stretches, ${autoSecs.toFixed(1)} s of ${lvlSecs.toFixed(0)} s (${(100 * autoSecs / lvlSecs).toFixed(0)}%)${r.dead ? "  (route dies at " + Math.round(r.end.x / B) + ")" : ""}`);
  }
  // summary per family
  const fam = {};
  for (const d of all) (fam[d.family] = fam[d.family] || []).push(d);
  const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
  const summary = Object.entries(fam).sort((a, b) => b[1].length - a[1].length).map(([k, ds]) => {
    const modes = {}; for (const d of ds) for (const m of d.modes) modes[m] = (modes[m] || 0) + 1;
    const movers = {}; for (const d of ds) for (const m of d.movers) movers[m.name] = (movers[m.name] || 0) + 1;
    return { family: k, n: ds.length, levels: new Set(ds.map(d => d.level)).size, secs: med(ds.map(d => d.secs)), rise: med(ds.map(d => d.rise)),
      turns: med(ds.map(d => d.turns)), movers: med(ds.map(d => d.movers.length)), clickSafe: med(ds.map(d => d.clickSafe)),
      clickKills: +(ds.filter(d => d.clickSafe < 0.5).length / ds.length).toFixed(2), modes, topMovers: Object.entries(movers).sort((a, b) => b[1] - a[1]).slice(0, 6) };
  });
  console.log("\n  family              n  lvls  secs  rise  turns movers clickSafe  stray-click kills");
  for (const s of summary) console.log(`  ${s.family.padEnd(18)} ${String(s.n).padStart(3)} ${String(s.levels).padStart(5)} ${String(s.secs).padStart(5)} ${String(s.rise).padStart(5)} ${String(s.turns).padStart(5)} ${String(s.movers).padStart(6)} ${String(s.clickSafe).padStart(9)}  ${(100 * s.clickKills).toFixed(0)}%   ${s.topMovers.map(m => m[0] + " " + m[1]).join(", ")}`);
  // the longest and most moved, for the doc
  const rich = all.filter(d => d.movers.length >= 3).sort((a, b) => b.movers.length - a.movers.length).slice(0, 12);
  console.log("\n  richest (3+ movers):");
  for (const d of rich) console.log(`   ${d.levelName} ${d.at}s (blocks ${d.x0}-${d.x1}) ${d.secs}s ${d.modes.join(">")} ${d.speeds.join(">")}: ${d.movers.map(m => m.name).join(", ")}  rise ${d.rise} turns ${d.turns} clickSafe ${d.clickSafe}`);
  fs.writeFileSync(OUT, JSON.stringify({ v: 1, at: new Date().toISOString().slice(0, 10), min: MIN, note: "numbers only: no layouts (tools/autostudy.js, AUTO.md)", summary,
    stretches: all.map(d => ({ level: d.level, at: d.at, x0: d.x0, x1: d.x1, secs: d.secs, family: d.family, modes: d.modes, speeds: d.speeds, movers: d.movers.map(m => m.name), rise: d.rise, dy: d.dy, turns: d.turns, gravFlips: d.gravFlips, grounded: d.grounded, slope: d.slope, clickSafe: d.clickSafe })) }, null, 0).replace(/\},\{/g, "},\n{"));
  console.log("\n  -> " + path.relative(ROOT, OUT));
}
if (require.main === module) main();
module.exports = { describe, family, clickSafe, stretches, measureAuto };
