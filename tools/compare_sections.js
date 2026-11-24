// node tools/compare_sections.js [--ours a.gdlvl,b.gdlvl] [--refs official:7,c150941693,...] [--no-render] [--out local/compare_sections]
//
// Our levels against real ones, section by section: where we are off on sync and style.
// 1. Every level is cut into sections at its SONG's section changes (tools/songmap.js: Foote novelty on the bars),
//    merged to >= 6 s, and each section gets a type: intro, build, drop, calm, groove, ending -- or "flight" when
//    it is mostly ship / wave / ufo / swing (from the song's loudness per bar and the level's portals).
// 2. Each section is measured:
//    sync     obstacles (the start of each hazard group, orbs, pads) within 60 ms of a beat / of an accent (the song's
//             strongest 30% onsets); our presses within 60 ms of a beat (saved route, tools/solutions.js; refs have
//             none); transitions (mode / speed portals, by their centre) within a quarter beat of a bar line; deco
//             pulses (pulse / colour / move / alpha / rotate triggers) within 60 ms of a beat. Luck for 60 ms is
//             120 ms / beat period (~28% at 140 BPM).
//    density  hazards and objects per block.
//    variety  height changes per 10 blocks, chunk repeats (tools/taste.js on the slice), mode changes per minute.
//    look     z-layers, motion triggers per screen, colour channels (tools/decostudy.js on the slice), contrast
//             (tools/contrast.js).
//    feel     the energy curve (tools/energy.js: obstacle starts per bar) against the song's loudness per bar:
//             Spearman over the level; per section, its energy percentile minus its loudness percentile (0 = the
//             level's energy follows the song's).
// 3. Each of our sections is paired with the reference section of the same type (same song first, then the same
//    flight-ness, then the closest loudness); the pair is rendered side by side at mid-section with
//    tools/compare_frames.js; a sheet per our level stacks the pairs with both sides' numbers.
// 4. "Where we're off": per measure, the median of (ours - reference) over the pairs, over the spread of that measure
//    among the reference sections; ranked, each with the numbers on both sides and the pair that shows it most.
// Output: local/compare_sections/ (report.md, numbers.json, sheet_*.png, gap_*.png). Local only: the pictures hold
// RobTop's art and other people's levels. Claims the heavy slot (song analysis, slices, headless renders).
const fs = require("fs"), path = require("path"), cp = require("child_process");
if (require.main === module) require("./heavy.js").claim();
const { GD, readGdlvl, unpack } = require("./io.js");
Object.assign(GD, require("../lib/sync.js"));
const S = GD.SYNC;
const B = require("./beats.js"), SM = require("./songmap.js");
const ROOT = path.join(__dirname, "..");
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(ROOT, opt("--out", "local/compare_sections"));
const OURS = opt("--ours", "levels/gdlm_64_golden_hour_v5.gdlvl,levels/gdlm_62_low_end_lullaby.gdlvl,levels/gdlm_52_necromancy.gdlvl,levels/gdlm_61_lantern_towers.gdlvl").split(",");
// Jumper, Time Machine, Spooky Dash, Dreamy; SLAM (same song as GDLM 52), Subwoofer Lullaby (same song as GDLM 62), boogie
const REFS = opt("--refs", "official:7,official:8,c150941693,c92555035,c43908596,c100157619,c114694142").split(",");
const FLY = new Set(["ship", "wave", "ufo", "swing"]);
const PULSE = new Set([1006, 899, 1007, 901, 1346, 29, 30, 105]);   // pulse, colour, alpha, move, rotate, old colour triggers
const COLOUR = new Set([29, 30, 104, 105, 221, 717, 718, 743, 744, 899, 900, 915]);
const OFFICIAL_NAMES = ["Stereo Madness", "Back On Track", "Polargeist", "Dry Out", "Base After Base", "Cant Let Go", "Jumper", "Time Machine"];
const med = a => { a = a.filter(Number.isFinite).sort((x, y) => x - y); return a.length ? a[a.length >> 1] : NaN; };
const mean = a => { a = a.filter(Number.isFinite); return a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN; };
const r2 = v => Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
function spearman(a, b) {
  const rank = v => { const ix = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]), r = []; for (let i = 0; i < ix.length;) { let j = i; while (j + 1 < ix.length && ix[j + 1][0] === ix[i][0]) j++; for (let k = i; k <= j; k++) r[ix[k][1]] = (i + j) / 2; i = j + 1; } return r; };
  const x = rank(a), y = rank(b), mx = mean(x), my = mean(y); let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN;
}

// ---------------- load a level and its song ----------------
function load(src) {
  let name, header, objects, levelStr, songKey, file = null, renderId = src;
  if (/^official:/.test(src)) {
    const n = +src.split(":")[1], j = JSON.parse(fs.readFileSync(path.join(ROOT, "local", `official_${String(n).padStart(2, "0")}.json`), "utf8"));
    levelStr = j.level; const lv = GD.parseLevel(levelStr); header = lv.header; objects = lv.objects;
    name = OFFICIAL_NAMES[n - 1] || j.name || "official " + n; songKey = "official_" + B.OFFICIAL[n - 1];
  } else {
    file = /^c\d+$/.test(src) ? path.join(ROOT, "local", "community", src.slice(1) + ".gdlvl") : path.resolve(ROOT, src);
    const r = readGdlvl(file); levelStr = r.levelStr; header = r.level.header; objects = r.level.objects; name = r.name;
    const c = GD.getField(r.rec, "k45"); songKey = c && c !== "0" ? "custom_" + c : "official_" + B.OFFICIAL[+(GD.getField(r.rec, "k8") || 0)];
    if (/^c\d+$/.test(src)) renderId = src.slice(1);
  }
  const grid = B.loadBeats(songKey), songFile = (B.allSongs().find(s => s.key === songKey) || {}).file;
  if (!grid || !grid.ok || !songFile) throw new Error(`${name}: no beat grid for ${songKey} (node tools/beats.js <song file>)`);
  const song = SM.songCache(songKey, songFile, grid);
  return { src, name: String(name).trim(), header, objects, levelStr, songKey, grid, song, file, renderId };
}

// ---------------- events in song time ----------------
function events(L) {
  const world = GD.makeWorld(L.objects, L.header), tl = S.timeline(world);
  const off = +((/(?:^|,)kA13,([-0-9.]+)/.exec(L.header || "") || [])[1] || 0);
  const tOf = x => S.tOfX(tl, x) + off;
  const haz = world.items.filter(b => b.kind === "hazard").sort((a, b) => a.x0 - b.x0);
  const obs = []; let last = -1e9;
  for (const h of haz) { if (h.x0 - last > 60) obs.push({ x: h.x0, t: tOf(h.x0) }); last = Math.max(last, h.x1); }
  for (const b of world.items) if (b.kind === "orb" || b.kind === "pad") obs.push({ x: (b.x0 + b.x1) / 2, t: tOf((b.x0 + b.x1) / 2), what: b.kind });
  obs.sort((a, b) => a.t - b.t);
  const portals = world.items.filter(b => b.kind === "mode" || b.kind === "speed").map(b => ({ x: (b.x0 + b.x1) / 2, t: tOf((b.x0 + b.x1) / 2), what: b.kind === "mode" ? b.d.mode : "speed" })).sort((a, b) => a.t - b.t);
  const colour = L.objects.filter(o => COLOUR.has(o.id)).map(o => ({ x: o.x, t: tOf(o.x) }));
  const pulses = L.objects.filter(o => PULSE.has(o.id)).map(o => ({ x: o.x, t: tOf(o.x) }));
  let presses = null;
  try { const sol = require("./solutions.js").get(L.levelStr, true); if (sol && sol.events && sol.events.length) presses = sol.events.filter(e => e.type === "press").map(e => ({ t: e.tick / 240 + off })); } catch (e) {}
  const endX = world.endX, end = tOf(endX);
  const modeAt = t => { let m = "cube"; for (const p of portals) if (p.what !== "speed" && p.t <= t) m = p.what; return m; };
  return { world, tl, off, tOf, xOfT: t => S.xOfT(tl, t - off), obs, portals, colour, pulses, presses, end, endX, modeAt, haz };
}

// ---------------- sections ----------------
function sections(L, E) {
  const song = L.song, P = song.period, start = Math.max(E.off, song.bar0), end = Math.min(E.end, song.dur);
  let cuts = [start, ...song.sections.map(s => s.t).filter(t => t > start + 4 * P && t < end - 4 * P), end];
  // merge pieces under 6 s into their neighbour
  for (let changed = true; changed;) { changed = false; for (let i = 1; i < cuts.length - 1; i++) if (cuts[i] - cuts[i - 1] < 6 || cuts[i + 1] - cuts[i] < 6) { cuts.splice(i, 1); changed = true; break; } }
  const kindAt = t => (song.sections.find(s => Math.abs(s.t - t) < 1e-3) || {}).kind;
  const allLoud = song.bars.filter(b => b.t >= start && b.t < end).map(b => b.loud).sort((a, b) => a - b);
  const lp = v => allLoud.filter(x => x < v).length / (allLoud.length || 1);
  const out = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const t0 = cuts[i], t1 = cuts[i + 1], bars = song.bars.filter(b => b.t >= t0 - 1e-3 && b.t < t1 - 1e-3);
    const loud = mean(bars.map(b => b.loud)), modes = {};
    for (let t = t0; t < t1; t += 0.25) { const m = E.modeAt(t); modes[m] = (modes[m] || 0) + 1; }
    const flyShare = Object.entries(modes).filter(([m]) => FLY.has(m)).reduce((s, [, c]) => s + c, 0) / Object.values(modes).reduce((a, b) => a + b, 0);
    out.push({ i, t0, t1, kind: kindAt(t0), loud, loudPct: mean(bars.map(b => lp(b.loud))), flyShare, mainMode: Object.entries(modes).sort((a, b) => b[1] - a[1])[0][0] });
  }
  for (const s of out) {
    const nxt = out[s.i + 1];
    s.type = s.i === 0 ? "intro" : s.i === out.length - 1 ? "ending"
      : s.kind === "drop" || s.loudPct >= 0.7 ? "drop"
      : s.kind === "break" || s.loudPct <= 0.3 ? "calm"
      : nxt && (nxt.kind === "drop" || nxt.loudPct >= 0.7) && nxt.loud > s.loud ? "build" : "groove";
    if (s.flyShare >= 0.6 && s.type !== "intro" && s.type !== "ending") s.type = "flight";
  }
  return out;
}

// ---------------- measures ----------------
function sliceLevel(L, x0, x1) {
  return { header: L.header, objects: L.objects.filter(o => o.x >= x0 && o.x < x1).map(o => Object.assign({}, o, { x: o.x - x0 + 300 })) };
}
function measure(L, E, s) {
  const P = L.song.period, g = L.grid, beatT = k => g.t0 + k * P;
  const nearBeat = (t, tol) => { const k = Math.round((t - g.t0) / P); return Math.abs(t - beatT(k)) <= tol; };
  const nearBar = t => { const b0 = L.song.bar0, q = (t - b0) / (4 * P); return Math.abs(q - Math.round(q)) * 4 * P <= P / 4; };
  const on = (list, f) => { const v = list.filter(e => e.t >= s.t0 && e.t < s.t1); return v.length ? { share: v.filter(e => f(e.t)).length / v.length, n: v.length } : { share: NaN, n: 0 }; };
  const strong = (() => { const st = g.onsets.map(o => o[1]).sort((a, b) => a - b), cut = st[Math.floor(st.length * 0.7)]; return g.onsets.filter(o => o[1] >= cut).map(o => o[0]); })();
  const nearAccent = t => { let lo = 0, hi = strong.length; while (lo < hi) { const m = (lo + hi) >> 1; if (strong[m] < t) lo = m + 1; else hi = m; } return [strong[lo - 1], strong[lo]].some(a => a != null && Math.abs(a - t) <= 0.06); };
  const x0 = E.xOfT(s.t0), x1 = E.xOfT(s.t1), blocks = Math.max(1, (x1 - x0) / 30), mins = (s.t1 - s.t0) / 60;
  const M = { secs: s.t1 - s.t0, luck60: 0.12 / P };
  const o1 = on(E.obs, t => nearBeat(t, 0.06)); M.obsOnBeat = o1.share; M.nObs = o1.n;
  M.obsOnAccent = on(E.obs, nearAccent).share;
  M.pressOnBeat = E.presses ? on(E.presses, t => nearBeat(t, 0.06)).share : NaN;
  // portals by their centre (SYNC.md); colour triggers are placed before the moment they fade to, so they are pulses here
  const tr = E.portals.filter((e, i, a) => !i || e.t - a[i - 1].t > P);
  const t1 = on(tr, nearBar); M.transOnBar = t1.share; M.nTrans = t1.n;
  const p1 = on(E.pulses, t => nearBeat(t, 0.06)); M.pulsesOnBeat = p1.share; M.pulsesPerMin = p1.n / mins;
  M.hazPerBlock = E.haz.filter(h => h.x0 >= x0 && h.x0 < x1).length / blocks;
  const inX = L.objects.filter(o => o.x >= x0 && o.x < x1);
  M.objPerBlock = inX.length / blocks;
  M.modeChangesPerMin = E.portals.filter(p => p.what !== "speed" && p.t >= s.t0 && p.t < s.t1).length / mins;
  const sl = sliceLevel(L, x0, x1);
  try { const F = require("./taste.js").measureOne(sl).F; M.heightChanges10 = F.heightChanges10; M.chunkRepeat = F.chunkRepeat; M.distinctIds = F.distinctIds; } catch (e) {}
  try { const d = require("./decostudy.js").measure(Object.assign({ name: L.name }, sl)); if (d) { M.layers = d.layers; M.motionPerScreen = d.motion; M.channels = d.ch; M.dress = d.dress; } } catch (e) {}
  try { M.contrast = require("./contrast.js").measure(sl).score; } catch (e) {}
  return M;
}
// feel: the level's energy curve (tools/energy.js, the one definition) against the song's loudness per bar; per section
// its mean energy percentile minus its loudness percentile (0 = the level's energy follows the song's there)
function feel(L, E, secs) {
  const EN = require("./energy.js"), c = EN.curve({ header: L.header, objects: L.objects, grid: L.grid });
  const loudAt = b => { const s = L.song.bars.find(x => Math.abs(x.t - b.t0) < 0.05); return s ? s.loud : NaN; };
  const sl = c.bars.map(loudAt).filter(Number.isFinite).sort((a, b) => a - b), lp = v => sl.filter(x => x < v).length / (sl.length || 1);
  for (const s of secs) {
    const ix = c.bars.filter(b => b.t0 >= s.t0 - 0.05 && b.t0 < s.t1 - 0.05 && Number.isFinite(loudAt(b)));
    s.M.energyGap = ix.length ? mean(ix.map(b => b.e)) - mean(ix.map(b => lp(loudAt(b)))) : NaN;
    s.M.actPerBar = ix.length ? mean(ix.map(b => b.n)) : NaN;
  }
  return EN.vsSong(c, L.song.bars);
}
// ---------------- the measures shown, and how they read ----------------
const SHOW = [
  ["sync", "obsOnBeat", "obstacles on a beat", "%"], ["sync", "obsOnAccent", "obstacles on an accent", "%"], ["sync", "transOnBar", "transitions on a bar line", "%"],
  ["sync", "pulsesOnBeat", "deco pulses on a beat", "%"], ["sync", "pulsesPerMin", "deco pulses per minute", ""],
  ["density", "hazPerBlock", "hazards per block", ""], ["density", "objPerBlock", "objects per block", ""],
  ["variety", "heightChanges10", "height changes /10 blocks*", "", "norank"], ["variety", "chunkRepeat", "repeated chunks", "%"], ["variety", "modeChangesPerMin", "mode changes per minute", ""],
  ["look", "layers", "z-layers in use", ""], ["look", "motionPerScreen", "motion triggers per screen", ""], ["look", "channels", "colour channels per screen", ""], ["look", "contrast", "contrast score**", ""], ["look", "dress", "deco around play objects", ""],
  ["feel", "actPerBar", "obstacles per bar", ""], ["feel", "energyGap", "energy vs song (activity - loudness pct)", ""],
];
const fmt = (v, u) => !Number.isFinite(v) ? "-" : u === "%" ? Math.round(v * 100) + "%" : Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(2);

// ---------------- main ----------------
async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const lv = {};
  for (const src of [...OURS, ...REFS]) {
    try {
      const L = load(src), E = events(L), secs = sections(L, E);
      for (const s of secs) s.M = measure(L, E, s);
      const rho = feel(L, E, secs);
      lv[src] = { src, L, E, secs, rho, ours: OURS.includes(src) };
      console.log(`${L.name.padEnd(28)} ${L.songKey.padEnd(18)} ${secs.map(s => s.type).join(" ")}  energy~loudness ${r2(rho)}` + (E.presses ? "" : "  (no saved route)"));
    } catch (e) { console.log(src, "skipped:", e.message); }
  }
  const refSecs = Object.values(lv).filter(v => !v.ours).flatMap(v => v.secs.map(s => ({ v, s })));
  // pair every one of our sections with a reference section of the same type
  const pairs = [];
  for (const o of Object.values(lv).filter(v => v.ours)) for (const s of o.secs) {
    let c = refSecs.filter(r => r.s.type === s.type);
    if (!c.length) continue;
    const same = c.filter(r => r.v.L.songKey === o.L.songKey);
    if (same.length) c = same;
    c.sort((a, b) => (Math.abs(a.s.flyShare - s.flyShare) > 0.5) - (Math.abs(b.s.flyShare - s.flyShare) > 0.5) || Math.abs(a.s.loudPct - s.loudPct) - Math.abs(b.s.loudPct - s.loudPct)
      || (same.length ? Math.abs(a.s.t0 - s.t0) - Math.abs(b.s.t0 - s.t0) : 0));
    pairs.push({ o, s, r: c[0].v, rs: c[0].s, same: !!same.length });
  }
  // gaps: per measure, median (ours - ref) over the spread among the reference sections
  const gaps = [];
  for (const [area, k, label, u, norank] of SHOW) {
    if (norank) continue;
    const refVals = refSecs.map(r => r.s.M[k]).filter(Number.isFinite).sort((a, b) => a - b);
    if (refVals.length < 4) continue;
    const iqr = (refVals[Math.floor(refVals.length * 0.75)] - refVals[Math.floor(refVals.length * 0.25)]) || (refVals[refVals.length - 1] - refVals[0]) || 1;
    const d = pairs.map(p => ({ p, d: p.s.M[k] - p.rs.M[k] })).filter(x => Number.isFinite(x.d));
    if (d.length < 3) continue;
    const md = med(d.map(x => x.d)), worst = d.slice().sort((a, b) => Math.sign(md) * (b.d - a.d))[0];
    gaps.push({ area, k, label, u, z: md / iqr, ours: med(d.map(x => x.p.s.M[k])), ref: med(d.map(x => x.p.rs.M[k])), n: d.length, same: d.filter(x => Math.sign(x.d) === Math.sign(md)).length, worst: worst.p });
  }
  gaps.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
  // pictures
  const shots = {};
  if (!args.includes("--no-render")) for (const p of pairs) {
    const key = `${p.o.L.name}|${p.s.i}`, at = ((p.s.t0 + p.s.t1) / 2 - p.o.E.off).toFixed(2), rat = ((p.rs.t0 + p.rs.t1) / 2 - p.r.E.off).toFixed(2);
    const dir = path.join(OUT, "frames", slug(p.o.L.name) + "_" + p.s.i);
    try {
      cp.execFileSync(process.execPath, [path.join(__dirname, "compare_frames.js"), p.o.src, p.r.L.renderId, "--at", "s:" + at, "--ref-at", "s:" + rat, "--out", dir],
        { windowsHide: true, cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], env: process.env, timeout: 15 * 60e3 });
      const png = fs.readdirSync(dir).filter(f => f.endsWith(".png")).map(f => path.join(dir, f))[0];
      if (png) shots[key] = png;
    } catch (e) { console.log("render failed", key, String(e.stderr || e.message).slice(-400)); }
  }
  const data = { made: new Date().toISOString(), levels: Object.values(lv).map(v => ({ src: v.src, name: v.L.name, song: v.L.songKey, ours: v.ours, energyLoud: r2(v.rho), routed: !!v.E.presses,
      sections: v.secs.map(s => ({ i: s.i, type: s.type, t0: r2(s.t0), t1: r2(s.t1), mode: s.mainMode, loudPct: r2(s.loudPct), M: Object.fromEntries(Object.entries(s.M).map(([k, x]) => [k, r2(x)])) })) })),
    pairs: pairs.map(p => ({ ours: p.o.L.name, section: p.s.i, type: p.s.type, ref: p.r.L.name, refSection: p.rs.i, sameSong: p.same, shot: shots[`${p.o.L.name}|${p.s.i}`] || null })),
    gaps: gaps.map(g => ({ area: g.area, measure: g.k, label: g.label, z: r2(g.z), ours: r2(g.ours), ref: r2(g.ref), pairs: g.n, sameDirection: g.same, worst: g.worst.o.L.name + " #" + g.worst.s.i + " vs " + g.worst.r.L.name + " #" + g.worst.rs.i })) };
  fs.writeFileSync(path.join(OUT, "numbers.json"), JSON.stringify(data, null, 1));
  // sheets: per our level, the pairs stacked with the numbers
  const sheetIn = { pairs: [], gaps: [] };
  for (const p of pairs) sheetIn.pairs.push({ level: p.o.L.name, title: `${p.o.L.name} #${p.s.i} ${p.s.type} (${p.s.mainMode}, ${fmtT(p.s.t0 - p.o.E.off)}-${fmtT(p.s.t1 - p.o.E.off)})  vs  ${p.r.L.name} #${p.rs.i} ${p.rs.type} (${p.rs.mainMode}, ${fmtT(p.rs.t0 - p.r.E.off)}-${fmtT(p.rs.t1 - p.r.E.off)})${p.same ? "  same song" : ""}`,
    png: shots[`${p.o.L.name}|${p.s.i}`] || null, rows: SHOW.map(([a, k, l, u]) => [a, l, fmt(p.s.M[k], u), fmt(p.rs.M[k], u)]) });
  gaps.slice(0, 6).forEach((g, i) => sheetIn.gaps.push({ rank: i + 1, title: `${i + 1}. ${g.label}: ours ${fmt(g.ours, g.u)}, real ${fmt(g.ref, g.u)} (${g.same}/${g.n} pairs the same way)`,
    png: shots[`${g.worst.o.L.name}|${g.worst.s.i}`] || null, sub: `shown: ${g.worst.o.L.name} #${g.worst.s.i} ${g.worst.s.type} (${fmt(g.worst.s.M[g.k], g.u)}) vs ${g.worst.r.L.name} #${g.worst.rs.i} (${fmt(g.worst.rs.M[g.k], g.u)})` }));
  fs.writeFileSync(path.join(OUT, "sheets.json"), JSON.stringify(sheetIn));
  try { cp.execFileSync("python", [path.join(__dirname, "compare_sheets.py"), path.join(OUT, "sheets.json"), OUT], { windowsHide: true, stdio: "inherit" }); } catch (e) { console.log("sheets failed:", e.message); }
  // report
  const lines = ["# Sections: ours vs real levels", "", `Made ${data.made.slice(0, 16)} by tools/compare_sections.js. Luck for "on a beat" (60 ms) is ~${Math.round(mean(pairs.map(p => p.s.M.luck60)) * 100)}%.`, "",
    "## Where we're off (biggest first)", "", "| # | measure | ours | real | pairs the same way | shown by |", "|---|---|---|---|---|---|"];
  gaps.forEach((g, i) => lines.push(`| ${i + 1} | ${g.label} (${g.area}) | ${fmt(g.ours, g.u)} | ${fmt(g.ref, g.u)} | ${g.same}/${g.n} | ${g.worst.o.L.name} #${g.worst.s.i} vs ${g.worst.r.L.name} #${g.worst.rs.i} |`));
  lines.push("", "\* height changes: a static proxy that reads 0 on most 2.2 levels; shown, not ranked. \*\* contrast: featured levels sit LOWER than the rest (ART.md \"Deco study\"), so higher is not better.");
  lines.push("", "## Levels", "", "| level | song | sections | energy follows loudness (rho) | route |", "|---|---|---|---|---|");
  for (const v of Object.values(lv)) lines.push(`| ${v.ours ? "**" + v.L.name + "**" : v.L.name} | ${v.L.songKey} | ${v.secs.map(s => s.type).join(", ")} | ${fmt(v.rho, "")} | ${v.E.presses ? "saved" : "-"} |`);
  lines.push("", "## Pairs", "");
  for (const p of sheetIn.pairs) { lines.push("### " + p.title, "", "| | measure | ours | real |", "|---|---|---|---|"); for (const r of p.rows) lines.push(`| ${r[0]} | ${r[1]} | ${r[2]} | ${r[3]} |`); lines.push(""); }
  fs.writeFileSync(path.join(OUT, "report.md"), lines.join("\n"));
  console.log("\nwhere we're off:"); gaps.slice(0, 8).forEach((g, i) => console.log(`  ${i + 1}. ${g.label}: ours ${fmt(g.ours, g.u)}, real ${fmt(g.ref, g.u)}  (z ${r2(g.z)}, ${g.same}/${g.n} pairs)`));
  console.log("->", path.relative(ROOT, OUT));
}
const slug = s => s.toLowerCase().replace(/\W+/g, "_").replace(/^_|_$/g, "");
const fmtT = t => `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, "0")}`;
module.exports = { load, events, sections, measure };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
