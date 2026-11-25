// node tools/impacts.js <song id | file.mp3 | official:N> [--offset S] [--bpm B --t0 S] [--top N] [--json]
// node tools/impacts.js --spec specs/NN_x.json        (song, offset and grid from the spec)
// node tools/impacts.js --level levels/x.gdlvl [--bpm B --t0 S]   (+ what the level does at each impact, dead stretches)
//   -- the song's IMPACT POINTS, not just its beats: drum entries (the low end comes in), loudness jumps and drops,
//      big accents (a hit far louder than the bars before it), timbre changes (a new section), and breaks (it goes
//      quiet). Each gets a strength 0..1 (1 = the song's biggest) and its parts. Plus a HEAVINESS per bar (0..1, the
//      song's calmest .. heaviest: loudness, low end, hit density) and suggestions for the section planner: where
//      to start a new section / change mode, and which sections are heavy enough for a faster speed.
//   Everything is in LEVEL BEATS (b1 = the first beat at or after the level's song offset, as make.js / specs), so
//   it stays true when speed portals move x: plan in beats, make.js turns beats into x through the speed portals.
//   --level also lists every strong impact with what the level does there (portal, speed, colour change) or
//   "NOTHING", and the dead stretches (no hazard / orb / pad / portal for 1.5 s+) with the song's heaviness there.
//   Writes local/impacts/<song key>[_off<offset>].json (made from the song: never committed). Light job (one decode).
//   Method, the Infertehno 2 check and what is open: SYNC.md section 9.
const fs = require("fs"), path = require("path");
const { decode, makeFFT, loadBeats, OFFICIAL } = require("./beats.js");

const SR = 22050, N = 2048, HOP = 256, FPS = SR / HOP, CENTRE = N / 2 / HOP;
const ROOT = path.join(__dirname, "..");

function songFile(arg) {
  if (/^\d+$/.test(String(arg))) return { file: path.join(ROOT, "local", "songs", arg + ".mp3"), url: "/song/custom/" + arg + ".mp3" };
  const m = /^official:(\d+)$/.exec(arg);
  if (m) return { file: null, url: "/song/official/" + OFFICIAL[+m[1] - 1] + ".mp3" };
  return { file: arg, url: "/song/custom/" + path.basename(arg) };
}

// ---------------- frame features ----------------
// per frame: loudness (dB), band energies (dB) in 8 log bands 40 Hz-10 kHz, onset flux (all, low < 150 Hz, mid)
const BANDS = [40, 80, 150, 300, 600, 1200, 2500, 5000, 10000];
function frameFeatures(pcm) {
  const fft = makeFFT(N), win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
  const bin = hz => Math.max(1, Math.round(hz / SR * N));
  const edges = BANDS.map(bin), lowHi = bin(150), midHi = bin(4000);
  const F = Math.max(0, Math.floor((pcm.length - N) / HOP));
  const loud = new Float64Array(F), band = BANDS.slice(1).map(() => new Float64Array(F));
  const flux = new Float64Array(F), fluxLow = new Float64Array(F), fluxMid = new Float64Array(F);
  const re = new Float64Array(N), im = new Float64Array(N);
  let prev = new Float64Array(N / 2), cur = new Float64Array(N / 2);
  for (let f = 0; f < F; f++) {
    const o = f * HOP; let e = 0;
    for (let i = 0; i < N; i++) { const v = pcm[o + i]; e += v * v; re[i] = v * win[i]; im[i] = 0; }
    loud[f] = 10 * Math.log10(e / N + 1e-10);
    fft(re, im);
    for (let k = 0; k < N / 2; k++) cur[k] = re[k] * re[k] + im[k] * im[k];
    for (let b = 0; b < band.length; b++) { let s = 0; for (let k = edges[b]; k < edges[b + 1]; k++) s += cur[k]; band[b][f] = 10 * Math.log10(s / (edges[b + 1] - edges[b]) + 1e-10); }
    let a = 0, l = 0, m = 0;
    if (f) for (let k = 1; k < N / 2; k++) {
      const d = Math.log1p(1000 * cur[k]) - Math.log1p(1000 * prev[k]);
      if (d > 0) { a += d; if (k < lowHi) l += d; else if (k < midHi) m += d; }
    }
    flux[f] = a / (N / 2); fluxLow[f] = l / lowHi; fluxMid[f] = m / (midHi - lowHi);
    const t = prev; prev = cur; cur = t;
  }
  return { F, loud, band, flux, fluxLow, fluxMid };
}

// ---------------- helpers ----------------
const mean = (a, i, j) => { i = Math.max(0, i); j = Math.min(a.length, j); let s = 0; for (let k = i; k < j; k++) s += a[k]; return j > i ? s / (j - i) : NaN; };
const median = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
const zs = a => { const v = a.filter(Number.isFinite), m = v.reduce((x, y) => x + y, 0) / v.length, sd = Math.sqrt(v.reduce((x, y) => x + (y - m) ** 2, 0) / v.length) || 1; return a.map(x => (x - m) / sd); };
const pctl = a => { const s = a.slice().sort((x, y) => x - y); return a.map(v => { let lo = 0, hi = s.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (s[mid] < v) lo = mid + 1; else hi = mid; } return lo / Math.max(1, s.length - 1); }); };
const clip01 = x => Math.max(0, Math.min(1, x));
const r2 = x => +x.toFixed(2);

// ---------------- the analysis ----------------
// grid: {period, t0[, downbeat]} in song seconds; offset: the song second the level starts at (kA13)
function impacts(pcm, grid, offset = 0, opts = {}) {
  const ff = frameFeatures(pcm), dur = pcm.length / SR, P = grid.period;
  const fr = t => Math.round(t * FPS - CENTRE);
  const k1 = Math.ceil((offset - grid.t0) / P - 1e-9);      // grid index of level beat 1 (lib/sync.js beatToTime)
  const beatT = b => grid.t0 + (k1 + b - 1) * P;            // song second of level beat b
  const nBeats = Math.floor((dur - 0.05 - beatT(1)) / P);
  if (nBeats < 16) throw new Error("song too short after the offset: " + nBeats + " beats");
  // per beat [t, t+P): loudness, low end, band vector, hit strengths on the beat and the half-beat
  const peak = (x, t) => { const f = fr(t); let m = 0; for (let d = -5; d <= 2; d++) { const v = x[f + d]; if (v > m) m = v; } return m; };
  const B = [];
  for (let b = 1; b <= nBeats; b++) {
    const t = beatT(b), f0 = fr(t), f1 = fr(t + P);
    B.push({ b, t, loud: mean(ff.loud, f0, f1), low: (mean(ff.band[0], f0, f1) + mean(ff.band[1], f0, f1)) / 2,
      vec: ff.band.map(x => mean(x, f0, f1)), dens: mean(ff.flux, f0, f1),
      hit: Math.max(peak(ff.flux, t), peak(ff.flux, t + P / 2)), kick: Math.max(peak(ff.fluxLow, t), peak(ff.fluxLow, t + P / 2)),
      onBeat: peak(ff.flux, t), onKick: peak(ff.fluxLow, t), onMid: peak(ff.fluxMid, t) });
  }
  const n = B.length;
  const loud = B.map(x => x.loud), low = B.map(x => x.low);
  // a beat's own hit, z over the song (on the beat itself: impacts land on beats)
  const hitZ = zs(B.map(x => Math.max(x.onBeat, 0.6 * x.onKick + 0.4 * x.onMid)));
  const kickZ = zs(B.map(x => x.onKick));
  // Foote novelty on standardised band vectors, kernel K beats each side
  const vz = B[0].vec.map((_, j) => zs(B.map(x => x.vec[j])));
  const V = B.map((_, i) => vz.map(c => c[i]));
  const cos = (a, b) => { let s = 0, x = 0, y = 0; for (let j = 0; j < a.length; j++) { s += a[j] * b[j]; x += a[j] * a[j]; y += b[j] * b[j]; } return s / (Math.sqrt(x * y) || 1); };
  const novelty = K => B.map((_, i) => { let s = 0, c = 0; for (let a = -K; a < K; a++) for (let b = -K; b < K; b++) { const p = i + a, q = i + b; if (p < 0 || q < 0 || p >= n || q >= n) continue; s += ((a < 0) === (b < 0) ? 1 : -1) * cos(V[p], V[q]); c++; } return c ? s / c : 0; });
  const nov = zs(novelty(8).map((x, i) => x + novelty(4)[i]));
  // band levels per beat, floored 40 dB under the band's loud level (a silent band "entering" is not +80 dB)
  const bandDb = B[0].vec.map((_, j) => { const v = B.map(x => x.vec[j]), top = v.slice().sort((a, b) => a - b)[Math.floor(v.length * 0.9)]; return v.map(x => Math.max(x, top - 40)); });
  const W = [2, 4, 8], soft = (x, k) => x > 0 ? x / (x + k) : 0;
  // per beat i: the boundary just before beat i. Steps are averaged over 2, 4 and 8 beats each side: a real step
  // peaks on its own beat at every width, a slow swell does not.
  const raw = B.map((x, i) => {
    let rise = 0, fall = 0, entry = 0, lowRise = 0, nw = 0;
    for (const w of W) {
      if (i - w < 0 || i + w > n) continue;
      const d = mean(loud, i, i + w) - mean(loud, i - w, i);
      rise += Math.max(0, d); fall += Math.max(0, -d);
      let e = 0;
      bandDb.forEach((c, j) => { const r = (mean(c, i, i + w) - mean(c, i - w, i)) * (j < 2 ? 1 : 0.8); if (r > e) e = r; if (j < 2) lowRise += Math.max(0, r) / 2; });
      entry += e; nw++;
    }
    if (nw) { rise /= nw; fall /= nw; entry /= nw; lowRise /= nw; }
    // the hit against the 8 beats before it: a big accent stands out of its context, a steady kick does not
    const ctx = []; for (let k = Math.max(0, i - 8); k < i; k++) ctx.push(hitZ[k]);
    const accent = i >= 2 ? hitZ[i] - Math.max(median(ctx), -0.5) : 0;
    const parts = { rise: soft(rise, 4), entry: soft(entry, 8), accent: soft(accent, 1.5), change: soft(nov[i], 1.5) };
    // half the strongest single sign (one clear sign is an impact), half all of them together
    const score = 0.5 * Math.max(parts.rise, parts.entry, parts.accent, 0.8 * parts.change)
      + 0.5 * (0.3 * parts.rise + 0.25 * parts.entry + 0.25 * parts.accent + 0.2 * parts.change);
    const brk = 0.7 * soft(fall, 4) + 0.3 * parts.change;
    return { b: x.b, t: x.t, score, brk, parts, rise, fall, entry, lowRise, accent, nov: nov[i], hitZ: hitZ[i], kickZ: kickZ[i] };
  });
  // peaks: the best beat within +-3 beats, over a floor
  const pick = (key, floor, gap) => {
    const out = [];
    for (let i = 1; i < n - 1; i++) {
      const v = raw[i][key]; if (v < floor) continue;
      let best = true; for (let d = -gap; d <= gap && best; d++) if (d && raw[i + d] && raw[i + d][key] > v) best = false;
      if (best) out.push(raw[i]);
    }
    return out;
  };
  const top = Math.max(...raw.map(r => r.score)) || 1, topB = Math.max(...raw.map(r => r.brk)) || 1;
  const barOf = b => { const g = k1 + b - 1 - (grid.downbeat || 0); return ((g % 4) + 4) % 4; }; // 0 = on a bar start
  const kindOf = r => {
    const p = r.parts, w = { entry: p.entry * (r.entry > 2 * r.rise ? 1.1 : 0.8), drop: p.rise, accent: p.accent, change: p.change * 0.9 };
    return Object.entries(w).sort((a, b) => b[1] - a[1])[0][0];
  };
  const imp = pick("score", opts.floor ?? 0.18, 3).map(r => ({
    beat: r.b, t: r2(r.t), level_t: r2(r.t - offset), strength: r2(r.score / top), kind: kindOf(r), inBar: barOf(r.b),
    loudJump_dB: r2(r.rise), bandJump_dB: r2(r.entry), lowJump_dB: r2(r.lowRise), accent: r2(r.accent), novelty: r2(r.nov), hit: r2(r.hitZ) }));
  const breaks = pick("brk", 0.3, 4).filter(r => r.fall >= 3).map(r => ({ beat: r.b, t: r2(r.t), level_t: r2(r.t - offset), strength: r2(r.brk / topB), drop_dB: r2(r.fall) }));
  // heaviness per bar (bars from the grid's downbeat, in level beats): loudness, low end, hit density, kicks
  const pL = pctl(loud), pLo = pctl(low), pD = pctl(B.map(x => x.dens)), pK = pctl(B.map(x => x.kick));
  const heavyBeat = B.map((_, i) => 0.35 * pL[i] + 0.25 * pLo[i] + 0.2 * pD[i] + 0.2 * pK[i]);
  const bars = [];
  let start = 1; while (barOf(start) !== 0) start++;
  if (start > 1) bars.push({ beat: 1, beats: start - 1 });
  for (let b = start; b <= n; b += 4) bars.push({ beat: b, beats: Math.min(4, n - b + 1) });
  for (const bar of bars) {
    const h = heavyBeat.slice(bar.beat - 1, bar.beat - 1 + bar.beats);
    bar.heavy = r2(h.reduce((a, c) => a + c, 0) / h.length);
    bar.loud_dB = r2(mean(loud, bar.beat - 1, bar.beat - 1 + bar.beats));
  }
  // smooth heaviness over 2 bars each side for section-level reading
  const hv = bars.map((_, i) => { const s = bars.slice(Math.max(0, i - 1), i + 2).map(x => x.heavy); return s.reduce((a, c) => a + c, 0) / s.length; });
  bars.forEach((x, i) => x.heavySmooth = r2(hv[i]));
  return { grid: { period: P, bpm: r2(60 / P), t0: grid.t0, downbeat: grid.downbeat || 0 }, offset, beats: n, impacts: imp, breaks, bars, suggest: suggest(imp, breaks, bars, n, opts) };
}

// ---------------- planner suggestions ----------------
// section starts: the strongest impacts and breaks, at least `minLen` beats apart, snapped to a bar start when one is
// within 1 beat (portals and new sections sit on bar starts in the official levels, SYNC.md); each section gets its
// heaviness and a speed suggestion relative to the song (heavier = faster is allowed, not forced).
function suggest(imp, breaks, bars, n, opts = {}) {
  const minLen = opts.minLen || 16;
  const cands = imp.filter(i => i.strength >= (opts.secFloor ?? 0.5)).map(i => ({ beat: i.beat, s: i.strength * (i.inBar ? 0.85 : 1), why: i.kind, inBar: i.inBar }))
    .concat(breaks.filter(b => b.strength >= 0.5).map(b => ({ beat: b.beat, s: 0.8 * b.strength, why: "break" })))
    .sort((a, b) => b.s - a.s);
  const starts = [];
  for (const c of cands) if (c.beat > minLen / 2 && c.beat < n - minLen / 2 && starts.every(s => Math.abs(s.beat - c.beat) >= minLen)) starts.push(c);
  starts.sort((a, b) => a.beat - b.beat);
  const heavyAt = (a, z) => { const h = bars.filter(x => x.beat >= a && x.beat < z); return h.length ? h.reduce((s, x) => s + x.heavy, 0) / h.length : 0; };
  const edges = [{ beat: 1, s: 0, why: "start" }, ...starts];
  const sections = edges.map((e, i) => {
    const to = i + 1 < edges.length ? edges[i + 1].beat : n + 1, h = heavyAt(e.beat, to);
    return { from: e.beat, to: to - 1, why: e.why, strength: r2(e.s), heavy: r2(h) };
  });
  // speed: by heaviness rank within the song; a jump of heaviness into a heavy section = a speed-up candidate
  const hs = sections.map(s => s.heavy).sort((a, b) => a - b), q = p => hs[Math.min(hs.length - 1, Math.floor(p * hs.length))];
  for (const [i, s] of sections.entries()) {
    s.speed = s.heavy >= Math.max(0.7, q(0.75)) ? "fast (a step up: 2x/3x)" : s.heavy <= Math.min(0.35, q(0.25)) ? "calm (0.5x-1x, a breather)" : "normal";
    const prev = sections[i - 1];
    if (prev && s.heavy - prev.heavy >= 0.15 && s.heavy >= 0.6) s.speedUp = true;
    if (prev && prev.heavy - s.heavy >= 0.15) s.calmer = true;
    s.mode = s.why === "break" ? "breather / auto or slow part" : s.why === "drop" || s.why === "entry" ? "mode or speed change on the impact" : s.why === "accent" ? "a big moment (orb, pad, portal) on the hit" : s.why === "change" ? "new section look / mode" : "";
  }
  return { sections, note: "Level beats: speed portals change x, not beats; specs in beats keep every later beat on time. A speed-up moves later objects in x, never in time." };
}

// ---------------- the level side ----------------
function levelSide(levelStr, res) {
  const { GD } = require("./io.js"); Object.assign(GD, require("../lib/sync.js")); const S = GD.SYNC;
  const L = GD.parseLevel(levelStr), world = GD.makeWorld(L.objects, L.header), tl = S.timeline(world);
  const P = res.grid.period, beatOfT = lt => (lt + res.offset - res.grid.t0) / P - Math.ceil((res.offset - res.grid.t0) / P - 1e-9) + 1;
  const COLOUR = new Set([29, 30, 104, 105, 221, 717, 718, 743, 744, 899, 900, 915]);
  const ev = [];
  for (const b of world.items) {
    if (b.kind === "mode") ev.push({ beat: beatOfT(S.tOfX(tl, b.x0 - 15)), what: (b.d.mode || "mode") + " portal" });
    else if (b.kind === "speed") ev.push({ beat: beatOfT(S.tOfX(tl, b.x0 - 15)), what: "speed " + (b.d.speed ?? "") });
    else if (b.kind === "gravity" || b.kind === "mini" || b.kind === "mirror" || b.kind === "dual") ev.push({ beat: beatOfT(S.tOfX(tl, b.x0 - 15)), what: b.kind + " portal" });
    else if (b.kind === "orb" || b.kind === "pad") ev.push({ beat: beatOfT(S.tOfX(tl, (b.x0 + b.x1) / 2)), what: b.kind, small: true });
  }
  for (const o of L.objects) if (COLOUR.has(o.id)) ev.push({ beat: beatOfT(S.tOfX(tl, o.x)), what: "colour", small: true });
  ev.sort((a, b) => a.beat - b.beat);
  const endBeat = beatOfT(S.tOfX(tl, world.endX));
  const atImpact = res.impacts.filter(i => i.beat <= endBeat && i.strength >= 0.3).map(i => {
    const near = ev.filter(e => Math.abs(e.beat - i.beat) <= 1);
    const big = near.filter(e => !e.small);
    return { beat: i.beat, strength: i.strength, kind: i.kind, level: near.length ? [...new Set(near.map(e => e.what))].join(", ") : "NOTHING", missed: !big.length };
  });
  // dead stretches: no hazard / orb / pad / portal for 1.5 s+, with the song's heaviness there
  const xs = world.items.filter(b => b.kind !== "solid" && b.kind !== "deco" && b.kind !== "trigger").map(b => (b.x0 + b.x1) / 2).sort((a, b) => a - b);
  const dead = [];
  for (let i = 1; i < xs.length; i++) {
    const a = S.tOfX(tl, xs[i - 1]), z = S.tOfX(tl, xs[i]);
    if (z - a >= 1.5) {
      const ba = beatOfT(a), bz = beatOfT(z), h = res.bars.filter(x => x.beat + x.beats > ba && x.beat < bz);
      const heavy = h.length ? h.reduce((s, x) => s + x.heavy, 0) / h.length : 0;
      dead.push({ from: r2(ba), to: r2(bz), seconds: r2(z - a), heavy: r2(heavy), verdict: heavy >= 0.5 ? "DEAD in a heavy part" : "breather (quiet music)" });
    }
  }
  return { endBeat: r2(endBeat), atImpact, dead };
}

// ---------------- CLI ----------------
function run(args) {
  const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  let songArg = args[0] && !args[0].startsWith("--") ? args[0] : null, offset = +opt("--offset", 0), grid = null, levelStr = null, name = null;
  if (opt("--spec")) {
    const spec = JSON.parse(fs.readFileSync(opt("--spec"), "utf8"));
    songArg = spec.song && (spec.song.custom || (spec.song.official != null ? "official:" + (spec.song.official + 1) : null));
    offset = spec.offset || 0;
    if (spec.grid) grid = { period: spec.grid.period || 60 / spec.grid.bpm, t0: spec.grid.t0 || 0, downbeat: spec.grid.downbeat || 0 };
    const lvl = path.join(ROOT, "levels", path.basename(opt("--spec"), ".json").replace(/^(\d+)_/, "gdlm_$1_") + ".gdlvl");
    if (fs.existsSync(lvl)) { levelStr = require("./io.js").readGdlvl(lvl).levelStr; name = lvl; }
  }
  if (opt("--level")) {
    const { GD, readGdlvl } = require("./io.js"), R = readGdlvl(opt("--level"));
    levelStr = R.levelStr; name = opt("--level");
    const custom = GD.getField(R.rec, "k45");
    songArg = custom && custom !== "0" ? custom : "official:" + (+(GD.getField(R.rec, "k8") || 0) + 1);
    offset = +((/(?:^|,)kA13,([-0-9.]+)/.exec(levelStr.split(";")[0]) || [])[1] || 0);
  }
  if (!songArg) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
  const { file, url } = songFile(songArg);
  if (opt("--bpm") || opt("--t0")) {
    const b0 = loadBeats(url) || {};
    const bpm = +(opt("--bpm") || b0.bpm); grid = { period: 60 / bpm, t0: +(opt("--t0") ?? b0.t0), downbeat: +(opt("--downbeat", 0)) };
  }
  let b = loadBeats(url);
  if (!grid) {
    if (!b || !b.ok) throw new Error("no beat grid for " + url + ": run node tools/beats.js, or give --bpm and --t0");
    grid = { period: b.period, t0: b.t0, downbeat: b.downbeat || 0 };
  }
  const f = file || (b && b.file);
  if (!f || !fs.existsSync(f)) throw new Error("song file not on this machine: " + (f || url) + " (songs live on the PC: local/songs/, tools/songs.js)");
  const res = impacts(decode(f), grid, offset, { floor: opt("--floor") != null ? +opt("--floor") : undefined, minLen: opt("--min-len") ? +opt("--min-len") : undefined });
  res.song = url;
  if (levelStr) { res.level = name; res.levelSide = levelSide(levelStr, res); }
  const out = path.join(ROOT, "local", "impacts"); fs.mkdirSync(out, { recursive: true });
  const key = path.basename(url, ".mp3") + (offset ? "_off" + offset : "");
  fs.writeFileSync(path.join(out, key + ".json"), JSON.stringify(res, null, 1));
  if (args.includes("--json")) { console.log(JSON.stringify(res, null, 1)); return res; }
  print(res, +opt("--top", 25));
  console.log(`-> local/impacts/${key}.json`);
  return res;
}

function print(res, topN) {
  console.log(`${res.song}  ${res.grid.bpm} BPM  offset ${res.offset}s  ${res.beats} level beats (b1 = song ${(res.grid.t0 + Math.ceil((res.offset - res.grid.t0) / res.grid.period - 1e-9) * res.grid.period).toFixed(2)} s)`);
  console.log("\nIMPACTS (strongest first; inBar 0 = on a bar start)");
  console.log("  beat  level s  str  kind    loud+dB band+dB accent novelty");
  for (const i of res.impacts.slice().sort((a, b) => b.strength - a.strength).slice(0, topN).sort((a, b) => a.beat - b.beat))
    console.log(`  b${String(i.beat).padEnd(4)} ${i.level_t.toFixed(2).padStart(7)}  ${i.strength.toFixed(2)} ${i.kind.padEnd(7)} ${i.loudJump_dB.toFixed(1).padStart(6)} ${i.bandJump_dB.toFixed(1).padStart(6)} ${i.accent.toFixed(1).padStart(6)} ${i.novelty.toFixed(1).padStart(6)}  ${i.inBar ? "(beat " + (i.inBar + 1) + " of bar)" : ""}`);
  if (res.breaks.length) console.log("\nBREAKS (it goes quiet): " + res.breaks.filter(b => b.strength >= 0.4).map(b => `b${b.beat} -${b.drop_dB} dB`).join(", "));
  console.log("\nHEAVINESS per bar (0 calm .. 1 heaviest), 8 bars a line:");
  for (let i = 0; i < res.bars.length; i += 8) {
    const row = res.bars.slice(i, i + 8);
    console.log(`  b${String(row[0].beat).padEnd(4)} ` + row.map(x => (x.heavy * 9 | 0) + "").join(" ") + "   " + row.map(x => "▁▂▃▄▅▆▇█"[Math.min(7, x.heavy * 8 | 0)]).join(""));
  }
  console.log("\nSUGGESTED SECTIONS (for the planner):");
  for (const s of res.suggest.sections) console.log(`  b${String(s.from).padEnd(4)}-b${String(s.to).padEnd(4)} heavy ${s.heavy.toFixed(2)}  ${s.why.padEnd(6)} ${s.speed}${s.speedUp ? "  << speed-up candidate" : ""}${s.calmer ? "  (calmer)" : ""}${s.mode ? "  -- " + s.mode : ""}`);
  console.log("  " + res.suggest.note);
  if (res.levelSide) {
    const L = res.levelSide;
    console.log(`\nLEVEL ${res.level} (ends at b${L.endBeat}): what it does at each impact (str >= 0.3)`);
    for (const a of L.atImpact) console.log(`  b${String(a.beat).padEnd(4)} ${a.strength.toFixed(2)} ${a.kind.padEnd(7)} ${a.missed ? "MISSED  " : "        "}${a.level}`);
    const m = L.atImpact.filter(a => a.missed).length;
    console.log(`  ${m} of ${L.atImpact.length} impacts have no portal / speed change within 1 beat`);
    if (L.dead.length) { console.log("  dead stretches (1.5 s+ with no hazard, orb, pad or portal):"); for (const d of L.dead) console.log(`    b${d.from}-b${d.to}  ${d.seconds}s  heavy ${d.heavy}  ${d.verdict}`); }
  }
}

if (require.main === module) run(process.argv.slice(2));
module.exports = { impacts, frameFeatures, suggest, levelSide, run };
