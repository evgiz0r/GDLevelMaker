// node tools/swingbuild.js [--seed N] [--cols 80] [--rows 36] [--gap 3.5] [--bpm B] [--write] [--show]
// The swing section of the theme layout, built PRESSES FIRST (Evgeni 2026-11-27 on the board's swing: "i need the swing
// longer and more swingy, you can do some human clicks, see the pattern, and surround according to that pattern";
// "shouldnt be that jitter click ... building the structure around the pattern after doing some clicks. can be double
// triple clicks here and there not too fast"; "swing should be taller, 2 times taller for now"; "round movement and sides";
// "the swing is still bad"). And his rule for every generator: "the click pattern/holds/cps differs between generations,
// not consistent across the whole section, some have bit more cps, some have bit less".
//
// 1. A click style for this generation (seeded): the mean time between flips, how much it drifts along the section, how
//    often a quick double or triple comes (never faster than 0.17 s apart).
// 2. The flips are played in the sim (lib/physics.js) on an empty tall stretch, one at a time. A slow swell (a target
//    height from the bottom of the map to its top and back) only stretches or shortens each hold a little, so the path
//    climbs and falls over the whole height; GD keeps a swing in a 10-block band, so where the player has moved 3 rows from
//    the band's middle an R (invisible ship + swing portal pair, tools/designthemes.js) sets the band again around it.
// --bpm B: every flip waits for the next half-beat of a B bpm grid that starts as the section starts (Evgeni: "i want to be
//    able to generate according to a beat as well, so its not just random stats, should be applicable in a level"); the
//    click style then only says which half-beats are taken.
// 3. The corridor is drawn around that path: a chain of saws `gap` rows under its lowest point and over its highest in
//    each column (round sides, his drawing's o/q saws), nothing else.
// 4. Check: the planned flips clear the finished section in the sim (solved by design); tools/layoutcheck.js then solves
//    it on its own (the fewest presses, a secret way would show as far fewer presses) and scores it.
// --write puts the map into knowledge/layout_sections.json as his swing section (my-mwz1890c; the old map is kept in
// knowledge/layout_sections_old.json) -- he can draw over it on the board as before.
"use strict";
if (require.main === module) require("./heavy.js").claim();
const fs = require("fs"), path = require("path");
const { GD } = require("./io.js");
const LC = require("./layoutcheck.js");
const { build } = require("./make.js");
const KEY = "my-mwz1890c";
const a = process.argv.slice(2), arg = (k, d) => { const i = a.indexOf("--" + k); return i >= 0 ? a[i + 1] : d; };

function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// the click style of one generation (his rule: each differs, and drifts a little inside the section)
function styleOf(R) {
  return { mean: 0.45 + R() * 0.3,          // s between flips on average (~1.4-2.8 flips a second)
    drift: 0.12 + R() * 0.18,                 // how much that mean moves along the section (share)
    driftWaves: 1 + Math.floor(R() * 2),      // slow waves of the drift over the section
    phase: R() * 6.28,
    quick: 0.06 + R() * 0.12,                 // chance a flip starts a quick double / triple
    quickGap: 0.17 + R() * 0.05 };            // s between the flips of a quick double ("not too fast")
}

// layoutcheck's spec for the section, with a block past its end so an empty stretch still runs to the end (a level ends at
// its last object)
function specFor(map) { const S = LC.specOf({ key: KEY, name: "swing", mode: "swing", map }); S.spec.objects.push(["block", S.end + 8, 0]); return S; }

function plan(o = {}) {
  const bpm = +(o.bpm || 0), seed = +(o.seed ?? 1), cols = +(o.cols ?? 80), H = +(o.rows ?? 36), gap = +(o.gap ?? 3.5);
  const R = rng(seed * 2654435761), st = styleOf(R);
  const empty = Array.from({ length: H }, () => ".".repeat(cols));
  const S = specFor(empty);
  const base = build(S.spec, "swingbuild", {}).level;
  const TPS = GD.PHYS.TPS, X0 = S.x0 * 30, X1 = (S.x0 + cols) * 30;
  const lo = 4, hi = H - 5;                                                     // the swell's bottom and top (rows)
  const swell = u => lo + (hi - lo) * (1 - Math.cos(2 * Math.PI * u)) / 2;     // bottom -> top -> bottom over the section
  const movers = [], events = [];
  const world = () => GD.makeWorld(base.objects.concat(movers.map(m => ({ id: m.id, x: m.x, y: m.y, rot: 0, flipX: false, flipY: false, props: {} }))), base.header);
  let w = world(), run = GD.run(w, events), t = 0, lastFlip = -1e9, quickLeft = 0, safety = 0, nextR = -1e9, t0 = null;
  const inSec = s => s.x >= X0 && s.x <= X1;
  const flipAt = tick => { events.push({ tick, type: "press" }, { tick: tick + 2, type: "release" }); events.sort((p, q) => p.tick - q.tick); };
  // play the section forward, deciding each flip from the state the sim is in (the clicks first, the walls later)
  while (safety++ < 20000) {
    const p = run.path; if (t >= p.length - 1) break;
    const s = p[t]; if (s.x > X1) break;
    if (inSec(s)) { if (t0 === null) t0 = t;
      const onBeat = !bpm || ((t - t0) % (TPS * 30 / bpm)) < 1;   // a half-beat tick (or no grid)
      const u = (s.x - X0) / (X1 - X0), y = s.y / 30;
      // the band: set again where the player has moved 3 rows from its middle
      // (one pair at a time: the next only once the player is past the last one)
      if (isFinite(s.ceilY) && s.x > nextR && Math.abs(y - (s.floorY + s.ceilY) / 60) >= 3 && s.x < X1 - 90 && s.x > X0 + 60) {
        movers.push({ id: 13, x: s.x + 24, y: s.y }, { id: 1933, x: s.x + 40, y: s.y }); nextR = s.x + 60;
        w = world(); run = GD.run(w, events); continue; }
      const goingUp = s.vy > 0 || (s.vy === 0 && s.grav < 0);
      const mean = st.mean * (1 + st.drift * Math.sin(st.phase + 2 * Math.PI * st.driftWaves * u));
      // the swell only leans each hold: longer towards the target height, shorter away from it
      const err = Math.max(-1, Math.min(1, (swell(u) - y) / 3)), lean = goingUp ? 1 + 0.7 * err : 1 - 0.7 * err;
      const want = quickLeft > 0 ? st.quickGap : mean * lean;
      // never into the map's floor or roof (the walls of the corridor would leave the map)
      const edge = (goingUp && y > H - 2.5) || (!goingUp && y < 1.5);
      if (((t - lastFlip) / TPS >= want && onBeat) || (edge && (t - lastFlip) / TPS >= st.quickGap)) {
        if (quickLeft > 0) quickLeft--; else if (R() < st.quick) quickLeft = R() < 0.35 ? 2 : 1;
        flipAt(t); lastFlip = t; run = GD.run(w, events); t++; continue; }
    }
    t++;
  }
  run = GD.run(w, events);
  // the corridor around the path: per column the path's lowest and highest point, saws `gap` rows beyond each
  const g = Array.from({ length: H }, () => Array(cols).fill("."));
  const lowC = Array(cols).fill(Infinity), highC = Array(cols).fill(-Infinity);
  for (const s of run.path) { const c = Math.floor((s.x - X0) / 30); if (c < 0 || c >= cols) continue; const y = s.y / 30 - 0.5; lowC[c] = Math.min(lowC[c], y); highC[c] = Math.max(highC[c], y); }
  for (let c = 2; c < cols - 2; c++) { if (!isFinite(lowC[c])) continue;
    const ch = c % 2 ? "q" : "o", rl = Math.round(lowC[c] - gap), rh = Math.round(highC[c] + gap);
    if (rl >= 0 && rl < H) g[H - 1 - rl][c] = ch; if (rh >= 0 && rh < H) g[H - 1 - rh][c] = ch; }
  for (let i = 0; i < movers.length; i += 2) { const m = movers[i], c = Math.round((m.x - X0) / 30 - 0.25), r = Math.round(m.y / 30 - 0.5); if (c >= 0 && c < cols && r >= 0 && r < H) g[H - 1 - r][c] = "R"; }
  const map = g.map(l => l.join(""));
  return { map, events, style: st, seed, flips: events.filter(e => e.type === "press").length, secs: (X1 - X0) / 30 / 10.386, S };
}

// does the plan clear the finished section in the sim (solved by design)?
function verify(P) {
  const S = specFor(P.map), level = build(S.spec, "swingbuild:check", {}).level;
  const w = GD.makeWorld(level.objects, level.header), r = GD.run(w, P.events);
  return { ok: !!r.done && !r.dead, why: r.why, at: r.dead ? +(r.end.x / 30 - S.x0).toFixed(1) : null, y: r.dead ? r.end.y / 30 - 0.5 : null, shift: S.x0 - P.S.x0 };
}
// hazards stay only where the plan clears (as brickgen does): a saw the planned flips hit is taken out, the nearest one to
// the death spot, until the plan clears; returns how many went
function trim(P, max = 40) {
  let n = 0, v = verify(P);
  while (!v.ok && v.at != null && n < max) { const H = P.map.length, g = P.map.map(l => [...l]); let best = null;
    g.forEach((l, i) => l.forEach((ch, c) => { if (ch !== "o" && ch !== "q") return; const d = Math.hypot(c + 0.5 - v.at, H - 1 - i + 0.5 - v.y); if (!best || d < best.d) best = { d, i, c }; }));
    if (!best || best.d > 4) break; g[best.i][best.c] = "."; P.map = g.map(l => l.join("")); n++; v = verify(P); }
  return { removed: n, v };
}

if (require.main === module) {
  const P = plan({ seed: arg("seed", 1), cols: arg("cols", 80), rows: arg("rows", 36), gap: arg("gap", 3.5), bpm: arg("bpm", 0) }), T = trim(P), v = T.v;
  const st = P.style;
  console.log(`seed ${P.seed}: ${P.flips} flips in ~${P.secs.toFixed(1)} s (${(P.flips / P.secs).toFixed(1)} a second), style: ${st.mean.toFixed(2)} s between flips ±${Math.round(st.drift * 100)}%, quick doubles ${Math.round(st.quick * 100)}%`);
  if (T.removed) console.log(`${T.removed} saw(s) the planned flips touched taken out`);
  console.log(v.ok ? "the planned flips clear it (solved by design)" : `PLAN DIES at col ${v.at}: ${v.why}${v.shift ? " (join shifted " + v.shift + " cols)" : ""}`);
  if (a.includes("--show")) console.log(P.map.join("\n"));
  if (a.includes("--write") && v.ok) {
    const f = path.join(__dirname, "..", "knowledge", "layout_sections.json"), L = JSON.parse(fs.readFileSync(f, "utf8"));
    const fo = path.join(__dirname, "..", "knowledge", "layout_sections_old.json"), O = fs.existsSync(fo) ? JSON.parse(fs.readFileSync(fo, "utf8")) : {};
    if (L[KEY]) (O[KEY] = O[KEY] || []).push({ at: new Date().toISOString(), map: L[KEY] });
    L[KEY] = P.map; fs.writeFileSync(f, JSON.stringify(L, null, 1) + "\n"); fs.writeFileSync(fo, JSON.stringify(O, null, 1) + "\n");
    console.log("-> knowledge/layout_sections.json (" + KEY + "), the old map in knowledge/layout_sections_old.json");
  }
}
module.exports = { plan, verify, trim, styleOf };
