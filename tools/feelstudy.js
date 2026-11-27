// node tools/feelstudy.js [--write] [--rows]   -- how RobTop's main levels change SPEED, DENSITY and BEAT-MATCHING from one song
//   section to the next (FEEL.md). Each main's song is cut and typed by tools/sections.js (drop / break / build / entry /
//   groove); per section: the speed the player moves at (time-weighted, from the level's speed portals), presses a second
//   (its human route, knowledge/mains/routes.json), the share of presses on a beat (+-45 ms of the song's grid), on a
//   strong note, and the first half's presses against the second half's (is a section shaped, or flat). Each number is
//   taken RELATIVE to the level's own (a drop at 1.3x the level's cps), so levels of different tiers can be pooled.
//   --write -> knowledge/feel_ref.json (numbers only, no level data). Needs GD's main levels (tools/gdpaths.js; in the
//   cloud: GD_GAME=<folder with Resources/levels>). Light: no solve, ~2 s. Used by tools/feel.js as its targets.
"use strict";
const fs = require("fs"), path = require("path");
const { GD } = require("./io.js"); GD.SYNC = require("../lib/sync.js").SYNC;
const C = require("./corpus.js"), SX = require("./sections.js");
const ROOT = path.join(__dirname, "..");
const KEY = { "Electroman Adventures": "Electroman", "Theory of Everything": "TheoryOfEverything", "Theory of Everything 2": "TheoryOfEverything2" };
const SPN = v => v / (GD.SPEEDS[1].x * 60);   // speed in 1x units
const med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? +s[Math.floor(s.length / 2)].toFixed(3) : null; };
const q = (a, p) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(3) : null; };

function study() {
  const routes = require(path.join(ROOT, "knowledge", "mains", "routes.json")).levels, rows = [], perLevel = [];
  for (let n = 1; n <= 21; n++) {   // Dash (22) has no clean route (skips)
    const name = C.NAMES[n - 1], key = "official_" + (KEY[name] || name.replace(/\s+/g, ""));
    let S; try { S = SX.load(key.replace("official_", "")); } catch (e) { continue; }
    const r = routes.find(x => x.n === n); if (!r || !r.ok || !r.events.length) continue;
    const L = C.official(n), w = GD.makeWorld(L.objects, L.header), tl = GD.SYNC.timeline(w);
    const presses = r.events.filter(e => e.type === "press").map(e => e.tick / 240);
    const tEnd = presses[presses.length - 1] + 1, P = S.j.period, t0 = S.j.t0;
    const strong = S.music.notes.filter(x => x.strength >= 0.5).map(x => x.t);
    const near = (t, arr) => { let lo = 0, hi = arr.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < t) lo = m + 1; else hi = m; }
      return Math.min(Math.abs(arr[lo] - t), lo ? Math.abs(arr[lo - 1] - t) : 1e9); };
    const onBeat = t => { const k = (t - t0) / P; return Math.abs(k - Math.round(k)) * P <= 0.045; };
    const speedOver = (a, b) => { let s = 0, st = 0.05; for (let t = a; t < b; t += st) s += SPN(GD.SYNC.speedAtT(tl, t)) * st; return s / Math.max(st, b - a); };
    const cuts = SX.cuts(S.music, Math.min(S.end, tEnd)).filter(c => c <= tEnd); if (cuts[cuts.length - 1] < tEnd - 2) cuts.push(tEnd);
    const lv = { n, name, cps: presses.length / tEnd, speed: speedOver(0, tEnd), beat: presses.filter(onBeat).length / presses.length,
      strong: presses.filter(t => near(t, strong) <= 0.045).length / presses.length };
    perLevel.push(lv);
    let prev = null;
    for (let i = 0; i + 1 < cuts.length; i++) {
      const a = cuts[i], b = cuts[i + 1]; if (b - a < 3) continue;
      const c = SX.character(S.music, a, b, prev); prev = c;
      const ps = presses.filter(t => t >= a && t < b), mid = (a + b) / 2;
      const h1 = ps.filter(t => t < mid).length, h2 = ps.length - h1;
      rows.push({ n, name, t0: +a.toFixed(1), t1: +b.toFixed(1), type: c.type, heavy: c.heavy, loud: c.inten,
        speed: +speedOver(a, b).toFixed(2), speedRel: +(speedOver(a, b) / lv.speed).toFixed(2),
        cps: +(ps.length / (b - a)).toFixed(2), cpsRel: +((ps.length / (b - a)) / lv.cps).toFixed(2),
        beat: ps.length ? +(ps.filter(onBeat).length / ps.length).toFixed(2) : null,
        beatRel: ps.length >= 4 ? +((ps.filter(onBeat).length / ps.length) - lv.beat).toFixed(2) : null,
        strongRel: ps.length >= 4 ? +((ps.filter(t => near(t, strong) <= 0.045).length / ps.length) - lv.strong).toFixed(2) : null,
        shape: ps.length >= 4 ? +((h2 - h1) / ps.length).toFixed(2) : null,   // + = busier second half (rising), - = front-loaded
        speedUp: i > 0 && rows.length && rows[rows.length - 1].n === n ? +(speedOver(a, b) - rows[rows.length - 1].speed).toFixed(2) : 0 });
    }
  }
  // pooled per section type
  const types = {};
  for (const t of ["drop", "build", "entry", "groove", "break"]) {
    const rs = rows.filter(r => r.type === t); if (!rs.length) continue;
    types[t] = { n: rs.length, cpsRel: { p25: q(rs.map(r => r.cpsRel), 0.25), median: med(rs.map(r => r.cpsRel)), p75: q(rs.map(r => r.cpsRel), 0.75) },
      speedRel: { median: med(rs.map(r => r.speedRel)), p75: q(rs.map(r => r.speedRel), 0.75) },
      fasterShare: +(rs.filter(r => r.speedRel > 1.05).length / rs.length).toFixed(2), slowerShare: +(rs.filter(r => r.speedRel < 0.95).length / rs.length).toFixed(2),
      speedUpShare: +(rs.filter(r => r.speedUp > 0.05).length / rs.length).toFixed(2),
      beatRel: med(rs.map(r => r.beatRel)), strongRel: med(rs.map(r => r.strongRel)),
      shape: { p25: q(rs.map(r => r.shape), 0.25), median: med(rs.map(r => r.shape)), p75: q(rs.map(r => r.shape), 0.75) } };
  }
  // how the speed follows the music: speed changes that land on a section cut (+-1 s) vs inside one; heavier = faster?
  const ch = rows.filter(r => r.speedUp !== 0);
  const heavyCorr = (() => { const xs = rows.map(r => r.heavy), ys = rows.map(r => r.speedRel), mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
    let sxy = 0, sxx = 0, syy = 0; xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; syy += (ys[i] - my) ** 2; }); return +(sxy / Math.sqrt(sxx * syy || 1)).toFixed(2); })();
  // neighbours: how different two sections in a row are (the "not symmetrical" target): |cpsRel step|, share of steps < 10%
  const steps = []; for (let i = 1; i < rows.length; i++) if (rows[i].n === rows[i - 1].n) steps.push(Math.abs(rows[i].cpsRel - rows[i - 1].cpsRel));
  return { rows, perLevel, types, speed: { sectionsWithSpeedChange: ch.length, heavyVsSpeedCorr: heavyCorr },
    neighbours: { cpsStep: { p25: q(steps, 0.25), median: med(steps), p75: q(steps, 0.75) }, flatShare: +(steps.filter(s => s < 0.1).length / steps.length).toFixed(2) } };
}
module.exports = { study };

if (require.main === module) {
  const a = process.argv.slice(2), r = study();
  if (a.includes("--rows")) for (const x of r.rows) console.log(`${String(x.n).padStart(2)} ${x.name.slice(0, 14).padEnd(14)} ${String(x.t0).padStart(5)}-${String(x.t1).padEnd(5)} ${x.type.padEnd(6)} heavy ${x.heavy.toFixed(2)} speed ${x.speed.toFixed(2)} (x${x.speedRel}) cps ${x.cps} (x${x.cpsRel}) beat ${x.beat} shape ${x.shape}`);
  console.log("type    n   cps rel p25/med/p75   speed rel med  faster  slower  beat +-  strong +-  shape p25/med/p75");
  for (const [t, v] of Object.entries(r.types)) console.log(`${t.padEnd(6)} ${String(v.n).padStart(3)}   ${v.cpsRel.p25} / ${v.cpsRel.median} / ${v.cpsRel.p75}     ${v.speedRel.median}        ${v.fasterShare}    ${v.slowerShare}    ${v.beatRel}    ${v.strongRel}     ${v.shape.p25} / ${v.shape.median} / ${v.shape.p75}`);
  console.log("speed:", JSON.stringify(r.speed), " neighbours:", JSON.stringify(r.neighbours));
  if (a.includes("--write")) {
    const out = { made: new Date().toISOString().slice(0, 10), note: "FEEL.md. Per song-section type in RobTop's mains (21, Dash left out): presses/s, speed, on-beat share relative to the level's own; numbers only.",
      types: r.types, speed: r.speed, neighbours: r.neighbours, levels: r.perLevel.map(l => ({ n: l.n, name: l.name, cps: +l.cps.toFixed(2), speed: +l.speed.toFixed(2), beat: +l.beat.toFixed(2) })),
      sections: r.rows.map(x => [x.n, x.t0, x.t1, x.type, x.heavy, x.speedRel, x.cpsRel, x.beatRel, x.shape]) };
    fs.writeFileSync(path.join(ROOT, "knowledge", "feel_ref.json"), JSON.stringify(out, null, 1) + "\n"); console.log("-> knowledge/feel_ref.json");
  }
}
