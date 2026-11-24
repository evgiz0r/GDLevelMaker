// node tools/climbs.js <level.gdlvl ...>     -- every CLIMB on the level's saved route (3+ cube landings in a row, each
//                                              higher) and whether each step has a readable press moment
// node tools/climbs.js --library             -- the same for the structure library (knowledge/structures.json: each
//                                              piece's solved path)
// node tools/climbs.js --all                 -- every GDLM level in levels/
//
// The user (2026-11-24, playing GDLM 68's climb, Golden Hour, Necromancy, 62): "those cube ladders are way too bad to play.
// its almost luck based if i can find where to click." A climb reads when every step has a press moment the player can see
// coming: steady spacing (the same time between presses, on the beat), a landing wide enough to land and read (2+ blocks),
// the next step on screen before the press, and a window that is not narrow. Flagged (WARN, soft):
//   uneven     the time between presses varies more than 1.5x between steps (or the spread is over 25%)
//   short      a landing under 0.3 s on the ground at its speed (3 blocks at 1x): no time to land and read the next press
//   tight      a press window under 120 ms
//   hidden     the next landing above the top of the screen when the press must come (the camera lifts only 0.38
//              blocks per block of height above 2: CLAUDE.md "Camera lift"; the screen shows ~8 blocks above the ground)
// score.js gate "climbs" runs it; compose / the library avoid it (STRUCTURES.md, checklist "Readable climbs").
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const TPS = 240, SCREEN_TOP = 8, LIFT = 0.38;
const visibleTop = hBlocks => SCREEN_TOP + LIFT * Math.max(0, hBlocks - 2);   // blocks above the ground at the top of the screen

// steps of climbs from a path (states with x, y, mode, grounded) and the press ticks; widths from the level's solids
function climbsOf(path, presses, objects, GD, wins) {
  const land = [];
  for (let t = 1; t < path.length; t++) { const a = path[t - 1], b = path[t]; if (b.mode === "cube" && b.grounded && !a.grounded) land.push(t); }
  const solids = objects ? objects.filter(o => ["solid", "slope"].includes((GD.objInfo(o.id) || {}).kind)) : [];
  const widthAt = st => {   // the landing's top surface: contiguous solids at the same top under the player
    if (!solids.length) return null;
    // only EXPOSED tops (no solid right above): a staircase of filled columns is not one wide landing
    const top = st.y - 15, cover = new Set(solids.map(o => Math.round(o.x) + ":" + Math.round(o.y)));
    const row = solids.filter(o => Math.abs(o.y + 15 - top) < 3 && !cover.has(Math.round(o.x) + ":" + Math.round(o.y + 30)));
    const under = row.find(o => Math.abs(o.x - st.x) <= 15); if (!under) return null;
    let x0 = under.x, x1 = under.x; const xs = new Set(row.map(o => Math.round(o.x)));
    while (xs.has(Math.round(x0 - 30))) x0 -= 30; while (xs.has(Math.round(x1 + 30))) x1 += 30;
    return (x1 - x0) / 30 + 1;
  };
  const out = []; let run = [];
  const flush = () => { if (run.length >= 3) out.push(run); run = []; };
  for (let i = 1; i < land.length; i++) {
    const a = path[land[i - 1]], b = path[land[i]];
    if (b.y > a.y + 10 && b.x - a.x < 300) { if (!run.length) run.push(land[i - 1]); run.push(land[i]); } else flush();
  }
  flush();
  return out.map(ticks => {
    const steps = ticks.map((t, k) => {
      // the jump into this step: the last takeoff (grounded -> airborne going up) before the landing -- the moment the player
      // must act, whether they tap or hold through the stairs
      const st = path[t]; let press = null;
      for (let u = t - 1; u > (k === 0 ? 0 : ticks[k - 1]); u--) if (path[u - 1] && path[u - 1].grounded && !path[u].grounded && path[u].vy > 0) { press = u - 1; break; }
      if (press == null) press = presses.filter(p => p < t && (k === 0 || p > ticks[k - 1])).pop() ?? null;
      // the saved window of the press nearest that takeoff (a held route's takeoffs are not its press ticks)
      let w = null; if (wins && press != null) { let best = 31; for (const [tk, v] of wins) { const d = Math.abs(tk - press); if (d < best) { best = d; w = v; } } }
      return { tick: t, x: st.x, y: st.y, press, width: widthAt(st), ms: w ? Math.round((w.hi - w.lo + 1) / TPS * 1000) : null };
    });
    // the rhythm of the climb: from the jump onto the first step on (the jump onto the base is the walk-up, not the climb)
    const gaps = []; for (let k = 2; k < steps.length; k++) if (steps[k].press != null && steps[k - 1].press != null) gaps.push((steps[k].press - steps[k - 1].press) / TPS);
    const flags = [];
    if (gaps.length >= 2) {   // 2+ gaps: a rhythm to compare
      const mn = Math.min(...gaps), mx = Math.max(...gaps), mean = gaps.reduce((s, v) => s + v, 0) / gaps.length, sd = Math.sqrt(gaps.reduce((s, v) => s + (v - mean) ** 2, 0) / gaps.length);
      if (mx / mn > 1.5 || sd / mean > 0.25) flags.push(`uneven: ${gaps.map(g => Math.round(g * 1000)).join("/")} ms between presses`);
    }
    // a landing must give time to land and read: under 0.3 s on the ground at its speed (3 blocks at 1x) is too short
    // to find the press (GDLM 68's station-1 ladder: 3-wide steps, "almost luck based")
    const vx = (path[ticks[ticks.length - 1]].x - path[ticks[0]].x) / Math.max(1, (ticks[ticks.length - 1] - ticks[0]) / TPS);
    const nar = steps.filter((s, k) => k < steps.length - 1 && s.width != null && s.width * 30 / Math.max(1, vx) < 0.3);
    if (nar.length) flags.push(`short: ${nar.length} landing(s) under 0.3 s on the ground (${nar.map(s => s.width + " blocks").join(", ")} at ${Math.round(vx)} u/s)`);
    const tight = steps.filter(s => s.ms != null && s.ms < 120);
    if (tight.length) flags.push(`tight: ${tight.map(s => s.ms + " ms").join(", ")} windows`);
    const hidden = [];
    for (let k = 1; k < steps.length; k++) { const pr = steps[k].press; if (pr == null) continue; const h = (path[pr].y - 15) / 30, next = (steps[k].y - 15) / 30 + 1; if (next > visibleTop(h)) hidden.push(Math.round(steps[k].x / 30)); }
    if (hidden.length) flags.push(`hidden: the next landing off screen at the press (blocks ${hidden.join(", ")})`);
    return { from: Math.round(steps[0].x / 30), to: Math.round(steps[steps.length - 1].x / 30), steps: steps.length, rise: +((steps[steps.length - 1].y - steps[0].y) / 30).toFixed(1), gapsMs: gaps.map(g => Math.round(g * 1000)), widths: steps.map(s => s.width), flags };
  });
}

function ofLevel(file) {
  const { GD, readGdlvl } = require("./io.js"), L = readGdlvl(file), sol = require("./solutions.js").get(L.levelStr, true);
  if (!sol || !sol.events) return { name: L.name, error: "no saved route (node tools/solutions.js " + file + ")" };
  const w = GD.makeWorld(L.level.objects, L.level.header), p = GD.run(w, sol.events).path;
  const wins = new Map((sol.windows || []).filter(x => !x[0]).map(([, tick, lo, hi]) => [tick, { lo, hi }]));
  return { name: L.name, climbs: climbsOf(p, sol.events.filter(e => e.type === "press").map(e => e.tick), L.level.objects, GD, wins) };
}
// a library piece: its stored solved path (pic.path every 4 ticks, [x, y, mode]) and presses ([x, y]); no widths from
// objects there -- the pic's objects give them
function ofPiece(r) {
  const { GD } = require("./io.js");
  if (!r.pic || !r.pic.path) return null;
  const path = r.pic.path.map(([x, y, mode], i, a) => ({ x, y, mode, grounded: false })), objs = (r.pic.objects || []).map(([id, x, y]) => ({ id, x, y }));
  // grounded: resting on a solid top (the pic path is every 4 ticks; a state whose y did not change from the one before)
  for (let i = 1; i < path.length; i++) path[i].grounded = Math.abs(path[i].y - path[i - 1].y) < 0.5 && objs.some(o => ["solid", "slope"].includes((GD.objInfo(o.id) || {}).kind) && Math.abs(o.x - path[i].x) <= 15 && Math.abs(o.y + 15 - (path[i].y - 15)) < 3 || path[i].y <= 15.5);
  const presses = (r.pic.presses || []).map(([x]) => { let best = 0, d = 1e9; path.forEach((s, i) => { if (Math.abs(s.x - x) < d) { d = Math.abs(s.x - x); best = i; } }); return best; });
  const cl = climbsOf(path, presses, objs, GD, null);
  for (const c of cl) c.gapsMs = c.gapsMs.map(g => g * 4);   // the pic's path is every 4th tick
  return cl;
}

module.exports = { climbsOf, ofLevel, ofPiece, visibleTop };

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args[0] === "--library") {
    const db = JSON.parse(fs.readFileSync(path.join(ROOT, "knowledge", "structures.json"), "utf8")).structures;
    for (const [id, r] of Object.entries(db)) { const cl = ofPiece(r); if (!cl || !cl.length) continue; for (const c of cl) console.log(`${id.padEnd(20)} climb ${c.steps} steps, rise ${c.rise}, widths ${c.widths.join("/")}${c.flags.length ? "  !! " + c.flags.join("; ") : "  ok"}`); }
  } else {
    const files = args[0] === "--all" ? fs.readdirSync(path.join(ROOT, "levels")).filter(f => /^gdlm_.*\.gdlvl$/.test(f)).map(f => path.join(ROOT, "levels", f)) : args;
    for (const f of files) {
      const r = ofLevel(f); if (r.error) { console.log(`${r.name}: ${r.error}`); continue; }
      const bad = r.climbs.filter(c => c.flags.length);
      console.log(`${r.name}: ${r.climbs.length} climb(s), ${bad.length} hard to read`);
      for (const c of r.climbs) console.log(`   blocks ${c.from}-${c.to}: ${c.steps} steps, rise ${c.rise} blocks, presses ${c.gapsMs.join("/")} ms apart, landings ${c.widths.map(w => w == null ? "?" : w).join("/")} wide${c.flags.length ? "\n      !! " + c.flags.join("\n      !! ") : ""}`);
    }
  }
}
