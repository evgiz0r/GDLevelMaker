// node tools/brickpick.js <hits.json> --offset <song s> --from <level beat> --to <level beat> [--speed 1x] [--mode cube]
//                         [--max Normal|Hard] [--avoid id,id] [--seed N] [--json]
//   -- the brick picker (LEGO.md "The build pipeline", step 3): fills one section of a level with our own VERIFIED
//      structures (knowledge/structures.json, ok + same mode in and out) so their presses land on the song's real hits
//      (tools/hits.js, local/hits/<song>.json, a local grid where the song's own drifts). Greedy with a one-brick
//      lookahead: at the cursor, every brick x a run-up of 1-5 flat blocks is scored by its presses against the hits
//      (on a K / S / accent within 25 ms: +1, within 50 ms: +0.5, on a lesser hit: +0.3, off: -0.6), minus repeats
//      (a brick already in the level: -3; the same first tag as the last brick: -1), minus 0.1 per run-up block, and
//      a recovery rule (a press >= 0.3 s after the last brick's last press). Run-ups are 3-7 blocks and bricks whose own check found a tight timing, an unfair spot or (cube: the other modes' prejump check is approximate)
//      found a prejump are left out (GDLM 44 v3: shorter joins made 5 prejumps and an unfair tap after a portal). Prints the picks as make.js spec objects
//      (["pattern", "s:<id>", "b<beat>", 0]) and the share of presses on a hit.
//   Only our own pieces: RobTop's main-level bricks may be studied, never shipped (LEGO.md). Each brick's presses come
//   from its verified route (structures.json pic.presses); make.js re-solves the level, so check the result with
//   `node tools/hits.js --level <level>`.
// As a module: pick({ slots, offset, fromBeat, toBeat, grid, speed, mode, used, max, beats, filler, startCol })
//   (beats: count every grid beat as a hit -- for a quiet intro; filler: false = bricks only, e.g. outside cube;
//    startCol: start at this column instead of the section's first beat; beatCols: place by "b<beat>" so the
//    level's speed portals before the section don't shift it -- the section itself must be at 1x) -> { objects, picks, onHit }.
"use strict";
const fs = require("fs"), path = require("path");
// a pick's column by its beat: make.js's "b<beat>" puts a column's CENTRE on the beat, a brick's column 0 starts at its left
// edge, so "+0.5" -- without it every brick sat half a block (48 ms at 1x) early and its presses missed the hits they were
// scored on (found by tools/seedsolve.js on GDLM 44 v6, 2026-11-26: the seeds ran 0.05 s late against the solver)
const beatAt = p => "b" + p.beat + "+0.5";
const SPEED = { "0.5x": 0.7 * 5.980002 * 60, "1x": 0.9 * 5.77000189 * 60, "2x": 1.1 * 5.870002 * 60 };   // units / s (lib/physics.js SPEEDS x per frame, 60 frames)
const TIER = { Easy: 0, Normal: 1, Hard: 2, Harder: 3, Insane: 4 };

function bricks(mode, max, speed) {
  const all = Object.values(JSON.parse(fs.readFileSync(path.join(__dirname, "..", "knowledge", "structures.json"), "utf8")).structures);
  return all.filter(s => s.ok && s.needs.mode === mode && s.leaves.mode === mode && s.needs.speed === (speed || "1x") && (s.needs.grav ?? 1) === 1
    && (s.leaves.grav ?? 1) === 1 && !s.needs.mini && !s.tags.some(t => /speed|teleport|mini/.test(t)) && s.pic && s.pic.presses && !(s.notes && ((mode === "cube" && s.notes.prejumps) || s.notes.timing || s.notes.fairness)) && (TIER[s.label] ?? 1) <= (TIER[max] ?? 1))
    .map(s => ({ id: s.id, tags: s.tags, width: s.width, label: s.label,
      // press offsets in blocks from the brick's first column (pic.x0 is 2 blocks before it)
      dx: s.pic.presses.map(p => (p[0] - (s.pic.x0 + 60)) / 30) }));
}

function pick(o) {
  const v = SPEED[o.speed || "1x"] / 30, P = o.grid.period;       // blocks per second, seconds per beat
  const tOfBeat = b => (b - 1) * P;                                // level seconds (beat 1 at the level's start: offset on a beat)
  const strong = o.slots.filter(s => s.kind === "K" || s.kind === "S" || s.kind === "A").map(s => s.t - o.offset);
  // o.beats: a quiet stretch with no detected hits (an intro) is played on the grid's beats instead
  if (o.beats) for (let b = Math.ceil(o.fromBeat); b <= o.toBeat; b++) strong.push(tOfBeat(b));
   const weak = o.slots.filter(s => s.kind === "x").map(s => s.t - o.offset);
  const near = (arr, t) => { let m = 1e9; for (const u of arr) { const d = Math.abs(u - t); if (d < m) m = d; } return m; };
  const hitScore = t => { const d = near(strong, t); return d <= 0.025 ? 1 : d <= 0.05 ? 0.5 : near(weak, t) <= 0.025 ? 0.3 : -0.6; };
  // o.minDensity: leave out bricks with fewer presses per 10 blocks (Evgeni on v4: "some of them are way too boring")
  const lib = o.fillerOnly ? [] : bricks(o.mode || "cube", o.max || "Normal", o.speed).filter(b => !o.minDensity || 10 * b.dx.length / b.width >= o.minDensity);   // fillerOnly: single spikes only (mini: no verified bricks at that size)
  const used = new Set(o.used || []), picks = [];
  let col = o.startCol != null ? Math.ceil(o.startCol) : Math.round(tOfBeat(o.fromBeat) * v), lastPress = col / v - 0.5, lastTag = null;
  const end = tOfBeat(o.toBeat) * v;
  const score = (b, c) => {
    const ts = b.dx.map(d => (c + d) / v);
    if (ts[0] - lastPress < 0.3) return null;
    let s = ts.reduce((a, t) => a + hitScore(t), 0);
    // dead air (score.js "dead air": 2 s with nothing to press): a brick whose first press leaves a long gap loses
    if (ts.length && ts[0] - lastPress > (o.deadAir || 1.8)) s -= 2;   // o.deadAir: a tighter limit (Evgeni on v3: "2 seconds of nothing")
    if (used.has(b.id)) s -= o.usedPenalty ?? 3;
    if (lastTag && b.tags[0] === lastTag) s -= 1;
    return { s, ts };
  };
  while (true) {
    let best = null;
    // run-up between bricks: 3-7 blocks by default (shorter joins made prejumps and a tap 183 ms after a portal, GDLM 44
    // v3); o.gap [min, max] to tighten it (Evgeni on v4: "the gaps between structures is too long")
    const [g0, g1] = o.gap || [3, 7];
    for (const b of lib) for (let g = g0; g <= g1; g++) {
      const c = col + g; if (c + b.width > end) continue;
      const r = score(b, c); if (!r) continue;
      const s = r.s - 0.1 * g + 0.05 * b.dx.length;
      if (!best || s > best.s) best = { b, c, s, ts: r.ts };
    }
    // the filler: one spike placed by make.js's "j<beat>" so its jump is pressed ON the next strong hit (a brick that
    // fits no hits loses to it; two in a row cost 0.5 each, so it does not become a spike train)
    if (o.filler !== false) for (const t of strong.slice().sort((a, b) => a - b)) {
      const c0 = t * v; if (c0 < col + 1 || t - lastPress < (o.fillGap ?? 0.3) || c0 + 4 > end) continue;   // o.fillGap: more room at speed (planbuild, GDLM 73)
      const s = 1 - 0.1 * (c0 - col) - (lastTag === "single" ? 0.5 : 0);
      if (!best || s > best.s) best = { b: { id: "single", tags: ["single"], width: 4, label: "Easy", dx: [0], j: true }, c: c0, s, ts: [t] };
      break;
    }
    if (!best) break;
    if (best.b.j) {
      const beat = +(best.ts[0] / P + 1).toFixed(3);
      picks.push({ id: "single", col: best.c, beat, width: 4, presses: best.ts, onHit: 1, label: "Easy", j: true });
      lastTag = "single"; lastPress = best.ts[0]; col = Math.ceil(best.c + 4); continue;
    }
    picks.push({ id: best.b.id, col: best.c, beat: +(best.c / v / P + 1).toFixed(3), width: best.b.width, presses: best.ts.map(t => +t.toFixed(3)),
      onHit: best.ts.filter(t => hitScore(t) >= 0.5).length, label: best.b.label });
    used.add(best.b.id); lastTag = best.b.tags[0]; lastPress = best.ts[best.ts.length - 1] ?? lastPress; col = best.c + best.b.width;
  }
  const n = picks.reduce((a, p) => a + p.presses.length, 0), h = picks.reduce((a, p) => a + p.onHit, 0);
  return { picks, objects: picks.map(p => { const at = o.beatCols ? beatAt(p) : p.col;   // beatCols: by beat (right after speed portals)
    return p.j ? ["pattern", "single", "j" + p.beat, 0] : (o.mode || "cube") === "cube" ? ["pattern", "s:" + p.id, at, 0] : ["pattern", "s:" + p.id, at, 0, { raw: true }]; }), presses: n, onHit: n ? h / n : 0, endCol: col };
}


// pickSection(o): the whole section at once (Evgeni on v5, 2026-11-26: pieces of one section close in CPS, short joins, no
//   brick twice, the section filled to its end). A beam search over brick x run-up chains instead of pick()'s greedy one
//   brick at a time: each chain is scored by its presses on the hits (as pick()), minus
//     cps      1.5 x |the brick's presses a second - the chain's mean so far| / mean (pieces of a section close in CPS)
//     repeat   4 for a brick already in the level or section (o.used), 1 for the same first tag as the last brick
//     run-up   0.15 per block of run-up (short joins), dead air 2 (a first press over o.deadAir s after the last)
//     tail     0.4 per block left empty before the section's end (filled to its end)
//   o.beam (default 60) chains kept per step; same options as pick() otherwise (gap, minDensity, filler, beats, startCol,
//   beatCols, max, mode, speed). Returns what pick() returns, plus cps (presses a second per pick) and cv (their spread).
function pickSection(o) {
  const v = SPEED[o.speed || "1x"] / 30, P = o.grid.period, tOfBeat = b => (b - 1) * P;
  const strong = o.slots.filter(s => s.kind === "K" || s.kind === "S" || s.kind === "A").map(s => s.t - o.offset);
  if (o.beats) for (let b = Math.ceil(o.fromBeat); b <= o.toBeat; b++) strong.push(tOfBeat(b));
  strong.sort((a, b) => a - b);
  const weak = o.slots.filter(s => s.kind === "x").map(s => s.t - o.offset);
  const near = (arr, t) => { let m = 1e9; for (const u of arr) { const d = Math.abs(u - t); if (d < m) m = d; } return m; };
  const hitScore = t => { const d = near(strong, t); return d <= 0.025 ? 1 : d <= 0.05 ? 0.5 : near(weak, t) <= 0.025 ? 0.3 : -0.6; };
  const lib = o.fillerOnly ? [] : bricks(o.mode || "cube", o.max || "Normal", o.speed).filter(b => b.dx.length && (!o.minDensity || 10 * b.dx.length / b.width >= o.minDensity));
  const used0 = new Set(o.used || []), [g0, g1] = o.gap || [2, 4], end = tOfBeat(o.toBeat) * v, BEAM = o.beam || 60;
  const col0 = o.startCol != null ? Math.ceil(o.startCol) : Math.round(tOfBeat(o.fromBeat) * v);
  let beam = [{ col: col0, lastPress: col0 / v - 0.5, lastTag: null, used: used0, picks: [], s: 0, cps: [] }], done = [];
  for (let step = 0; step < 60 && beam.length; step++) {
    const next = [];
    for (const st of beam) {
      let grew = false;
      const meanCps = st.cps.length ? st.cps.reduce((a, b) => a + b, 0) / st.cps.length : null;
      const push = (pk, ts, width, gap, tag, id, s) => {
        const cps = ts.length / ((width + gap) / v);
        let x = s - 0.15 * gap;
        if (meanCps) x -= 1.5 * Math.abs(cps - meanCps) / meanCps;
        if (ts.length && ts[0] - st.lastPress > (o.deadAir || 1.8)) x -= 2;
        if (st.lastTag && tag === st.lastTag) x -= tag === "single" ? 0.5 : 1;
        const used = new Set(st.used); if (id !== "single") used.add(id);
        next.push({ col: pk.col + width, lastPress: ts.length ? ts[ts.length - 1] : st.lastPress, lastTag: tag, used, picks: st.picks.concat([pk]), s: st.s + x, cps: st.cps.concat([cps]) });
        grew = true;
      };
      for (const b of lib) for (let g = g0; g <= g1; g++) {
        const c = st.col + g; if (c + b.width > end) continue;
        const ts = b.dx.map(d => (c + d) / v); if (ts[0] - st.lastPress < 0.3) continue;
        let s = ts.reduce((a, t) => a + hitScore(t), 0) + 0.05 * ts.length;
        if (st.used.has(b.id)) s -= o.usedPenalty ?? 4;
        push({ id: b.id, col: c, beat: +(c / v / P + 1).toFixed(3), width: b.width, presses: ts.map(t => +t.toFixed(3)), onHit: ts.filter(t => hitScore(t) >= 0.5).length, label: b.label },
          ts, b.width, g, b.tags[0], b.id, s);
      }
      // the filler single spike, jumped on the next strong hits (two choices, so the beam can skip one)
      if (o.filler !== false) { let k = 0;
        for (const t of strong) { const c0 = t * v; if (c0 < st.col + 1 || t - st.lastPress < (o.fillGap ?? 0.3) || c0 + 4 > end) continue;
          const g = Math.max(0, Math.round(c0 - st.col));
          push({ id: "single", col: c0, beat: +(t / P + 1).toFixed(3), width: 4, presses: [t], onHit: 1, label: "Easy", j: true }, [t], 4, g, "single", "single", 1 - (g > g1 ? 0.15 * (g - g1) : 0));
          if (++k >= 2) break; } }
      if (!grew) done.push(Object.assign({}, st, { s: st.s - 0.4 * Math.max(0, end - st.col - 3) }));
    }
    next.sort((a, b) => b.s - a.s);
    // keep the best chain per (column, last brick): no beam full of near twins
    const seen = new Set(); beam = [];
    for (const n of next) { const k = Math.round(n.col) + "|" + (n.picks[n.picks.length - 1] || {}).id; if (seen.has(k)) continue; seen.add(k); beam.push(n); if (beam.length >= BEAM) break; }
  }
  done.push(...beam.map(st => Object.assign({}, st, { s: st.s - 0.4 * Math.max(0, end - st.col - 3) })));
  done.sort((a, b) => b.s - a.s);
  const best = done[0], picks = best.picks;
  const n = picks.reduce((a, p) => a + p.presses.length, 0), h = picks.reduce((a, p) => a + p.onHit, 0);
  const cps = best.cps, m = cps.reduce((a, b) => a + b, 0) / Math.max(1, cps.length);
  const cv = cps.length > 1 ? Math.sqrt(cps.reduce((a, b) => a + (b - m) ** 2, 0) / cps.length) / m : 0;
  return { picks, objects: picks.map(p => { const at = o.beatCols ? beatAt(p) : p.col;
    return p.j ? ["pattern", "single", "j" + p.beat, 0] : (o.mode || "cube") === "cube" ? ["pattern", "s:" + p.id, at, 0] : ["pattern", "s:" + p.id, at, 0, { raw: true }]; }),
    presses: n, onHit: n ? h / n : 0, endCol: best.col, cps: cps.map(c => +c.toFixed(2)), cv: +cv.toFixed(2), tail: +Math.max(0, end - best.col).toFixed(1) };
}

if (require.main === module) {
  const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
  if (!a[0]) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
  const H = JSON.parse(fs.readFileSync(a[0], "utf8"));
  const r = pick({ slots: H.slots, grid: { period: H.period }, offset: +opt("--offset", 0), fromBeat: +opt("--from", 1), toBeat: +opt("--to", 33),
    speed: opt("--speed", "1x"), mode: opt("--mode", "cube"), max: opt("--max", "Normal"), used: (opt("--avoid", "") || "").split(",").filter(Boolean) });
  if (a.includes("--json")) return console.log(JSON.stringify(r));
  for (const p of r.picks) console.log(`b${String(p.beat).padEnd(8)} ${p.id.padEnd(26)} ${String(p.width).padStart(3)} blocks  ${p.onHit}/${p.presses.length} presses on a hit  ${p.label}`);
  console.log(`${r.picks.length} bricks, ${r.presses} presses, ${Math.round(r.onHit * 100)}% on a hit`);
  console.log(JSON.stringify(r.objects));
}
module.exports = { pick, pickSection, bricks, beatAt };
