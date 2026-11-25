// node tools/lego_seams.js [--src official|ours|both] [--level <n|name>]   -- how levels COMBINE their pieces (LEGO.md "Combining")
// The user, 2026-11-25: "do we know how to combine structures [...] i want to focus on mainlevel and then think how to invent
// more". Every route here is a real clear replayed by our physics (the official levels' saved routes, our solver's), so each
// seam it measures is a seam a player got through. Per level: the pieces in order (tools/lego.js cut + measure), then
//   - mode seams: where the mode changes -- quiet time before the portal (last press -> portal) and after it (portal -> first
//     press), the height kept through it, a press forced in the first 0.25 s, a speed change at the same spot;
//   - rhythm: each piece's intensity (presses per second + hazards), how the next one compares (up / down / same), what
//     follows the level's hardest pieces, the spacing of peaks;
//   - breathers: 1 s or more without a press -- per minute and where (right after a mode change or not);
//   - variety: the next piece's family / mode / wrapper / signature against this one's, the mode-to-mode matrix, how long a
//     mode stretch lasts.
// Writes knowledge/lego_seams.json (numbers only: no layouts, so RobTop's levels stay on the PC) and prints official vs ours.
"use strict";
if (require.main === module) require("./heavy.js").claim();
const fs = require("fs"), path = require("path");
const L = require("./lego.js");
const { GD } = require("./io.js");
const TPS = GD.PHYS.TPS, B = 30, ROOT = path.join(__dirname, "..");
const r2 = v => Math.round(v * 100) / 100;
const med = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
const q = (a, f) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };
const share = (a, f) => a.length ? r2(a.filter(f).length / a.length) : null;

function study(src) {
  const R = L.route(src), p = R.r.path;
  const press = (src.events || []).filter(e => e.type === "press").map(e => e.tick).sort((a, b) => a - b);
  const cuts = L.cut(R.r, R.inputs);
  const pcs = cuts.map(([a, b]) => Object.assign(L.measure(src, R.w, R.r, R.inputs, a, b), { i0: a, i1: b }));
  const T = i => p[i].tick / TPS;
  for (const P of pcs) P.int = r2(P.presses / Math.max(0.3, P.s) + P.hzPer100 / 100);   // presses per second + hazards per block
  // mode seams on the whole route (not only at cut points)
  const modeSeams = [];
  for (let i = 1; i < p.length; i++) {
    if (p[i].mode === p[i - 1].mode || p[i].dead) continue;
    const tk = p[i].tick, before = press.filter(t => t <= tk).pop(), after = press.find(t => t > tk);
    let spd = false; for (let j = Math.max(0, i - 24); j < Math.min(p.length, i + 24); j++) if (p[j].sp !== p[i].sp) spd = true;
    modeSeams.push({ from: p[i - 1].mode, to: p[i].mode, t: r2(tk / TPS), x: Math.round(p[i].x / B),
      quietBefore: before == null ? null : r2((tk - before) / TPS), quietAfter: after == null ? null : r2((after - tk) / TPS),
      forced: after != null && (after - tk) / TPS < 0.25, grounded: !!p[i - 1].grounded, y: r2(p[i].y / B), speedChange: spd });
  }
  // breathers: 1 s+ without a press
  const breathers = [];
  for (let k = 1; k < press.length; k++) { const g = (press[k] - press[k - 1]) / TPS; if (g >= 1) breathers.push({ s: r2(g), t: r2(press[k - 1] / TPS), afterMode: modeSeams.some(m => m.t >= press[k - 1] / TPS - 0.5 && m.t <= press[k] / TPS) }); }
  const dur = p.length ? p[p.length - 1].tick / TPS : 0;
  // height: how high the route goes (the user: "we could also go higher in gd, we dont have to remain on that height")
  const ys = p.filter((_, i) => i % 24 === 0).map(s => s.y / B);
  const height = { max: r2(Math.max(...ys)), p90: r2(q(ys, .9)), above10: share(ys, y => y > 10), above20: share(ys, y => y > 20) };
  return { name: src.name, src: src.src, seconds: r2(dur), dead: !!R.r.dead, pieces: pcs.map(P => ({ x: P.x, s: P.s, mode: P.mode, family: P.family, wrap: P.wrap, sig: P.sig, int: P.int, presses: P.presses, hz: P.hzPer100 })), modeSeams, breathers, height };
}

function summarize(levels) {
  const ints = [], next = [], afterPeak = [], peakGaps = [], spans = [], seams = [], br = [], brPerMin = [], mat = {}, nextSame = { family: [], mode: [], wrap: [], sig: [] }, theme = [];
  for (const Lv of levels) {
    const P = Lv.pieces; if (!P.length) continue;
    const lvInts = P.map(x => x.int); ints.push(...lvInts);
    const hi = q(lvInts, 0.8);
    for (let k = 1; k < P.length; k++) {
      const a = P[k - 1], b = P[k];
      next.push(b.int / Math.max(0.05, a.int));
      if (a.int >= hi) afterPeak.push(b.int / Math.max(0.05, a.int));
      for (const f of ["family", "mode", "wrap", "sig"]) nextSame[f].push(a[f] === b[f]);
      if (a.mode === b.mode) theme.push(a.sig !== b.sig);   // same mode, another kind of piece: a variation, not a repeat
    }
    let lastPeak = null; P.forEach(x => { if (x.int >= hi) { if (lastPeak != null) peakGaps.push(x.x - lastPeak); lastPeak = x.x; } });
    let start = 0; for (const m of Lv.modeSeams) { spans.push({ mode: m.from, s: m.t - start }); start = m.t; const k = m.from + " -> " + m.to; mat[k] = (mat[k] || 0) + 1; }
    if (Lv.seconds) spans.push({ mode: (Lv.modeSeams.length ? Lv.modeSeams[Lv.modeSeams.length - 1].to : P[0].mode), s: Lv.seconds - start });
    seams.push(...Lv.modeSeams); br.push(...Lv.breathers); brPerMin.push(Lv.breathers.length / Math.max(0.2, Lv.seconds / 60));
  }
  // the level's shape: where its hardest 3 pieces in a row sit (0 start .. 1 end), how the first and last piece rank
  const climax = [], firstRank = [], lastRank = [];
  for (const Lv of levels) { const r = Lv.pieces.map(x => x.int); if (r.length < 6) continue; let best = -1, bi = 0; for (let i = 0; i + 3 <= r.length; i++) { const v = r[i] + r[i + 1] + r[i + 2]; if (v > best) { best = v; bi = i; } } climax.push((bi + 1.5) / r.length); const srt = r.slice().sort((a, b) => a - b); firstRank.push(srt.indexOf(r[0]) / r.length); lastRank.push(srt.indexOf(r[r.length - 1]) / r.length); }
  const spanBy = {}; for (const s of spans) (spanBy[s.mode] = spanBy[s.mode] || []).push(s.s);
  return {
    levels: levels.length, pieces: ints.length,
    rhythm: { intensity: { p20: q(ints, .2), median: med(ints), p80: q(ints, .8) },
      nextUp: share(next, r => r > 1.25), nextDown: share(next, r => r < 0.8), nextSame: share(next, r => r >= 0.8 && r <= 1.25),
      afterPeakDown: share(afterPeak, r => r < 0.8), afterPeakUp: share(afterPeak, r => r > 1.25), peakGapBlocks: { p20: q(peakGaps, .2), median: med(peakGaps), p80: q(peakGaps, .8) } },
    modeSeams: { n: seams.length, perLevel: r2(seams.length / Math.max(1, levels.length)),
      quietBefore: { p20: q(seams.filter(m => m.quietBefore != null).map(m => m.quietBefore), .2), median: med(seams.filter(m => m.quietBefore != null).map(m => m.quietBefore)) },
      quietAfter: { p20: q(seams.filter(m => m.quietAfter != null).map(m => m.quietAfter), .2), median: med(seams.filter(m => m.quietAfter != null).map(m => m.quietAfter)) },
      forcedShare: share(seams, m => m.forced), fromGroundShare: share(seams, m => m.grounded), withSpeedChange: share(seams, m => m.speedChange),
      matrix: Object.fromEntries(Object.entries(mat).sort((a, b) => b[1] - a[1])) },
    modeStretchSeconds: Object.fromEntries(Object.entries(spanBy).map(([k, a]) => [k, { n: a.length, median: r2(med(a)), p80: r2(q(a, .8)) }])),
    height: { maxMedian: r2(med(levels.map(l => l.height.max))), levelsAbove20: share(levels, l => l.height.max > 20), timeAbove10: r2(med(levels.map(l => l.height.above10))), timeAbove10Mean: r2(levels.reduce((a, l) => a + l.height.above10, 0) / Math.max(1, levels.length)) },
    shape: { climaxAt: r2(med(climax)), climaxInLastThird: share(climax, x => x > 0.66), firstPieceRank: r2(med(firstRank)), lastPieceRank: r2(med(lastRank)) },
    breathers: { perMinute: r2(med(brPerMin)), medianSeconds: med(br.map(b => b.s)), afterModeShare: share(br, b => b.afterMode) },
    variety: { nextSameFamily: share(nextSame.family, x => x), nextSameMode: share(nextSame.mode, x => x), nextSameWrap: share(nextSame.wrap, x => x), nextSameSig: share(nextSame.sig, x => x), sameModeVariation: share(theme, x => x) },
  };
}

if (require.main === module) {
  const A = process.argv.slice(2), opt = k => { const i = A.indexOf("--" + k); return i >= 0 ? A[i + 1] : null; };
  const which = opt("src") || "both", lv = opt("level");
  const out = { made: new Date().toISOString().slice(0, 10), physics: require("./solutions.js").physicsCommit(), note: "LEGO.md 'Combining'. How levels join their 1-3 s pieces, from routes replayed by our physics. Numbers only." };
  for (const s of ["official", "ours"]) {
    if (which !== "both" && which !== s) continue;
    let srcs = s === "official" ? L.officialSources() : L.ourSources();
    if (lv) srcs = srcs.filter(x => x.name.toLowerCase().includes(lv.toLowerCase()) || x.name.split(" ")[0] === lv);
    const levels = srcs.map(x => { try { return study(x); } catch (e) { console.log("  skip", x.name, e.message); return null; } }).filter(Boolean);
    out[s] = summarize(levels);
    out[s].perLevel = levels.map(Lv => ({ name: Lv.name, seconds: Lv.seconds, pieces: Lv.pieces.length, modeSeams: Lv.modeSeams.length, breathers: Lv.breathers.length, height: Lv.height, rhythm: Lv.pieces.map(x => x.int) , modes: Lv.modeSeams.map(m => `${m.from}->${m.to} @${m.t}s quiet ${m.quietBefore}/${m.quietAfter}${m.forced ? " FORCED" : ""}`) }));
  }
  if (!lv) fs.writeFileSync(path.join(ROOT, "knowledge", "lego_seams.json"), JSON.stringify(out, null, 1));
  const show = (k, f) => console.log(k.padEnd(44) + ["official", "ours"].map(s => out[s] ? String(JSON.stringify(f(out[s]))).padEnd(40) : "").join(""));
  console.log("".padEnd(44) + "official".padEnd(40) + "ours");
  show("pieces / levels", o => [o.pieces, o.levels]);
  show("intensity p20 / median / p80", o => o.rhythm.intensity);
  show("next piece harder / easier / same", o => [o.rhythm.nextUp, o.rhythm.nextDown, o.rhythm.nextSame]);
  show("after a top-20% piece: easier / harder", o => [o.rhythm.afterPeakDown, o.rhythm.afterPeakUp]);
  show("blocks between peaks p20/med/p80", o => o.rhythm.peakGapBlocks);
  show("mode changes per level", o => o.modeSeams.perLevel);
  show("quiet before portal (s) p20/med", o => o.modeSeams.quietBefore);
  show("quiet after portal (s) p20/med", o => o.modeSeams.quietAfter);
  show("press forced <0.25 s after portal", o => o.modeSeams.forcedShare);
  show("portal taken from the ground", o => o.modeSeams.fromGroundShare);
  show("speed change at the portal", o => o.modeSeams.withSpeedChange);
  show("height: max (median level) / share >20", o => [o.height.maxMedian, o.height.levelsAbove20]);
  show("time above 10 blocks: median / mean", o => [o.height.timeAbove10, o.height.timeAbove10Mean]);
  show("level shape: climax at / first / last rank", o => [o.shape.climaxAt, o.shape.firstPieceRank, o.shape.lastPieceRank]);
  show("breathers (1 s+ no press) per min", o => o.breathers.perMinute);
  show("breather right after a mode change", o => o.breathers.afterModeShare);
  show("next piece same family / mode", o => [o.variety.nextSameFamily, o.variety.nextSameMode]);
  show("next piece same wrapper / signature", o => [o.variety.nextSameWrap, o.variety.nextSameSig]);
  show("same mode, other kind of piece", o => o.variety.sameModeVariation);
  for (const s of ["official", "ours"]) if (out[s]) { console.log(`\n${s}: mode stretches (s)`, JSON.stringify(out[s].modeStretchSeconds)); console.log(`${s}: top mode changes`, JSON.stringify(Object.entries(out[s].modeSeams.matrix).slice(0, 10))); }
  if (lv) for (const s of ["official", "ours"]) if (out[s]) for (const l of out[s].perLevel) console.log(`\n${l.name}: rhythm ${l.rhythm.join(" ")}\n  ${l.modes.join("\n  ")}`);
}
module.exports = { study, summarize };
