// node tools/shipstyle.js [n ...] [--mode ship|ufo|wave|...]  -- how the ship is flown: the user's recorded runs vs the
//   solver's viewer route, per official level (the user, 2026-11-24, in the viewer's vs-solver compare: "the solver ship
//   moves weirdly"). In every stretch of the mode (default ship): presses per second, how long each press is held and
//   each release lasts (p25 / p50 / p75 ms), the share of presses held under 75 ms (jitter taps), the share of time
//   held. The user's attempts (local/attempts/official_N.jsonl, replayed in the sim up to where it dies) against the
//   route (local/official_NN.json). One replay each; no solving.
// Also a library: stats(path, events, mode) for lib/natural.js / tests (a ship stretch scores on smoothness).
const fs = require("fs"), path = require("path");
const { GD, unpack } = require("./io.js");
const SRC = process.env.GD_LEVELS || "C:/Program Files (x86)/Steam/steamapps/common/Geometry Dash/Resources/levels/";
const TPS = 240;
const pc = (a, p) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const ms = t => Math.round(t / TPS * 1000);

// presses, holds and releases that fall in `mode` (by the state at the press / release tick), and ticks spent in it
function stats(p, events, mode) {
  const inMode = t => p[Math.min(t, p.length - 1)] && p[Math.min(t, p.length - 1)].mode === mode;
  let ticks = 0, held = 0, h = false; const ev = new Map(events.map(e => [e.tick, e.type]));
  for (let t = 0; t < p.length; t++) { const e = ev.get(t); if (e === "press") h = true; if (e === "release") h = false; if (p[t].mode === mode && !p[t].dead) { ticks++; if (h) held++; } }
  const holds = [], gaps = []; let down = null, up = null, presses = 0;
  for (const e of events) {
    if (e.tick >= p.length) break;
    if (e.type === "press") { if (inMode(e.tick)) { presses++; if (up != null) gaps.push(e.tick - up); } down = e.tick; }
    else if (e.type === "release" && down != null) { if (inMode(e.tick) && inMode(down)) holds.push(e.tick - down); up = inMode(e.tick) ? e.tick : null; down = null; }
  }
  return { ticks, secs: ticks / TPS, presses, pps: ticks ? presses / (ticks / TPS) : 0, holds, gaps, heldShare: ticks ? held / ticks : 0,
    jitter: holds.length ? holds.filter(x => x < 18).length / holds.length : 0 };
}
const fmt = s => s.ticks < 24 ? "(no " + "stretch)" : `${s.secs.toFixed(1).padStart(5)} s, ${s.pps.toFixed(1).padStart(4)} presses/s, hold ${[0.25, 0.5, 0.75].map(q => pc(s.holds, q) == null ? "-" : ms(pc(s.holds, q))).join("/")} ms, release ${[0.25, 0.5, 0.75].map(q => pc(s.gaps, q) == null ? "-" : ms(pc(s.gaps, q))).join("/")} ms, taps<75ms ${(s.jitter * 100).toFixed(0)}%, held ${(s.heldShare * 100).toFixed(0)}%`;

if (require.main === module) {
  const a = process.argv.slice(2), mi = a.indexOf("--mode"), mode = mi >= 0 ? a[mi + 1] : "ship";
  let nums = a.filter((x, i) => /^\d+$/.test(x) && a[i - 1] !== "--mode").map(Number);
  if (!nums.length) nums = fs.readdirSync(path.join(__dirname, "..", "local", "attempts")).map(f => (/^official_(\d+)\.jsonl$/.exec(f) || [])[1]).filter(Boolean).map(Number).sort((x, y) => x - y);
  for (const n of nums) {
    const tag = String(n).padStart(2, "0"); let v; try { v = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "local", `official_${tag}.json`), "utf8")); } catch (e) { continue; }
    const L = GD.parseLevel(v.level || unpack(fs.readFileSync(path.join(SRC, n + ".txt"), "utf8"))), w = GD.makeWorld(L.objects, L.header);
    const route = stats(GD.run(w, v.solution.events).path, v.solution.events, mode);
    if (route.ticks < 24) continue;
    console.log(`${n} ${v.name}`);
    console.log(`   solver route : ${fmt(route)}`);
    let runs = []; try { runs = fs.readFileSync(path.join(__dirname, "..", "local", "attempts", `official_${n}.jsonl`), "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l)); } catch (e) {}
    const all = { ticks: 0, presses: 0, holds: [], gaps: [], held: 0, j: 0 };
    for (const r of runs) { if (!r.events || !r.events.length) continue; const s = stats(GD.run(w, r.events).path, r.events, mode); all.ticks += s.ticks; all.presses += s.presses; all.holds.push(...s.holds); all.gaps.push(...s.gaps); all.held += s.heldShare * s.ticks; }
    if (all.ticks >= 24) console.log(`   user (${runs.length} runs): ${fmt({ ticks: all.ticks, secs: all.ticks / TPS, presses: all.presses, pps: all.presses / (all.ticks / TPS), holds: all.holds, gaps: all.gaps, heldShare: all.held / all.ticks, jitter: all.holds.length ? all.holds.filter(x => x < 18).length / all.holds.length : 0 })}`);
    else console.log(`   user: no ${mode} time in the recorded runs`);
  }
}
module.exports = { stats };
