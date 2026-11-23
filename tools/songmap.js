// node tools/songmap.js [--songs] [--levels] [--official] [--community] [--repo] [--json]
//   -- the songs on this PC: how clear their beat is, where their sections and drops are; and how
//      the levels on them follow that structure (not single beats: tools/sync.js does those).
//
//   --songs      one line per song: BPM, beat confidence, steadiness, beatless share, sections
//   --levels     per level: transitions at the song's section changes, density vs loudness, modes
//   default      both, over --official --community --repo
//   --json       also write local/songmap/levels.json (pooled numbers)
//
// Needs the beat grids (`node tools/beats.js`). Song analyses are cached in local/songmap/<key>.json
// (gitignored, like everything made from the songs). Decodes one song at a time (~30 MB each).
// Method, findings and limits: SYNC.md section 7.
//
// Song side, per bar of the beat grid (bar 0 starts on the grid's downbeat):
//  - 16 log-spaced band energies (40 Hz-10 kHz, log) and loudness, averaged over the bar;
//  - beat clarity of the bar: spectral flux within 35 ms of the bar's beats over the bar's mean flux
//    (a steady pad scores ~1.5, under 1.8 counts as beatless; real GD songs have a median of 2-4);
//  - sections: Foote novelty on the bars' self-similarity (cosine of standardised band vectors,
//    checkerboard kernel 4 bars each side): peaks at least 4 bars apart and 0.5 SD over the mean;
//    each is a "drop" (next 4 bars >= 4 dB louder or their beat clarity jumps by 0.4), a "break"
//    (>= 4 dB quieter) or a "change".
// Level side: mode portals, speed portals and colour triggers are "transitions" (time from x through
// the speed portals); hazards per bar are "density". A transition "hits" a section change within
// 1 beat. Luck: the same with the song's sections slid by whole bars (every slide of 4+ bars), so a
// level that just puts portals on bar starts gets no credit for that here.
const fs = require("fs"), path = require("path");
const { GD, unpack, readGdlvl } = require("./io.js");
Object.assign(GD, require("../lib/sync.js"));
const { loadBeats, allSongs, decode, makeFFT, OFFICIAL, GAME } = require("./beats.js");
const S = GD.SYNC;
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "local", "songmap");
const NAMES = ["Stereo Madness", "Back On Track", "Polargeist", "Dry Out", "Base After Base", "Cant Let Go", "Jumper",
  "Time Machine", "Cycles", "xStep", "Clutterfunk", "Theory of Everything", "Electroman Adventures", "Clubstep",
  "Electrodynamix", "Hexagon Force", "Blast Processing", "Theory of Everything 2", "Geometrical Dominator",
  "Deadlocked", "Fingerdash", "Dash"];
const COLOUR_TRIGGERS = new Set([29, 30, 104, 105, 221, 717, 718, 743, 744, 899, 900, 915]);

// ---------------- song ----------------
const SR = 22050, N = 2048, HOP = 512, FPS = SR / HOP, NB = 16;
function songFeatures(file) {
  const pcm = decode(file), fft = makeFFT(N), win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
  const edges = []; for (let b = 0; b <= NB; b++) edges.push(Math.round(40 * Math.pow(10000 / 40, b / NB) * N / SR));
  const nF = Math.max(0, Math.floor((pcm.length - N) / HOP));
  const bands = new Float32Array(nF * NB), flux = new Float32Array(nF), loud = new Float32Array(nF);
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let f = 0; f < nF; f++) {
    let e = 0;
    for (let i = 0; i < N; i++) { const v = pcm[f * HOP + i]; re[i] = v * win[i]; im[i] = 0; e += v * v; }
    loud[f] = 10 * Math.log10(e / N + 1e-10);
    fft(re, im);
    for (let b = 0; b < NB; b++) {
      let s = 0; for (let k = edges[b]; k < Math.max(edges[b] + 1, edges[b + 1]); k++) s += re[k] * re[k] + im[k] * im[k];
      bands[f * NB + b] = Math.log(1 + s);
    }
    if (f) { let d = 0; for (let b = 0; b < NB; b++) d += Math.max(0, bands[f * NB + b] - bands[(f - 1) * NB + b]); flux[f] = d; }
  }
  return { bands, flux, loud, nF, dur: pcm.length / SR };
}

function analyseSong(key, file, grid) {
  const F = songFeatures(file);
  const P = grid.period, bar0 = grid.t0 + grid.downbeat * P, BAR = 4 * P;
  const frame = t => Math.round(t * FPS - N / 2 / HOP);
  const bars = [];
  for (let m = 0; bar0 + (m + 1) * BAR <= F.dur; m++) {
    const a = Math.max(1, frame(bar0 + m * BAR)), b = Math.min(F.nF, frame(bar0 + (m + 1) * BAR));
    if (b - a < 4) continue;
    const v = new Array(NB).fill(0); let e = 0, fl = 0;
    for (let f = a; f < b; f++) { for (let k = 0; k < NB; k++) v[k] += F.bands[f * NB + k]; e += Math.pow(10, F.loud[f] / 10); fl += F.flux[f]; }
    for (let k = 0; k < NB; k++) v[k] /= b - a;
    // flux at the 4 beats (max within 35 ms) vs the bar's mean flux
    let on = 0;
    for (let j = 0; j < 4; j++) { const c = frame(bar0 + m * BAR + j * P); let mx = 0; for (let f = c - 2; f <= c + 2; f++) if (f > 0 && f < F.nF) mx = Math.max(mx, F.flux[f]); on += mx; }
    const mean = fl / (b - a);
    bars.push({ m, t: +(bar0 + m * BAR).toFixed(3), v, loud: +(10 * Math.log10(e / (b - a) + 1e-10)).toFixed(1), clar: +(mean > 1e-6 ? on / 4 / mean : 0).toFixed(2) });
  }
  // self-similarity novelty (Foote), kernel 4 bars each side, Gaussian-tapered
  const n = bars.length, mu = new Array(NB).fill(0), sd = new Array(NB).fill(0);
  for (const b of bars) for (let k = 0; k < NB; k++) mu[k] += b.v[k] / n;
  for (const b of bars) for (let k = 0; k < NB; k++) sd[k] += (b.v[k] - mu[k]) ** 2 / n;
  const z = bars.map(b => { const x = b.v.map((y, k) => (y - mu[k]) / (Math.sqrt(sd[k]) || 1)); const l = Math.hypot(...x) || 1; return x.map(y => y / l); });
  const sim = (i, j) => z[i].reduce((s, y, k) => s + y * z[j][k], 0);
  const K = 4, nov = new Array(n).fill(0);
  for (let c = K; c <= n - K; c++) {
    let s = 0;
    for (let i = -K; i < K; i++) for (let j = -K; j < K; j++) {
      const w = Math.exp(-((i + 0.5) ** 2 + (j + 0.5) ** 2) / (2 * (K / 2) ** 2)) * ((i < 0) === (j < 0) ? 1 : -1);
      s += w * sim(c + i, c + j);
    }
    nov[c] = s;
  }
  const valid = nov.slice(K, n - K + 1), nm = valid.reduce((a, b) => a + b, 0) / (valid.length || 1);
  const nsd = Math.sqrt(valid.reduce((a, b) => a + (b - nm) ** 2, 0) / (valid.length || 1)) || 1;
  const mean4 = (i, j, f) => { const s = bars.slice(Math.max(0, i), Math.min(n, j)); return s.reduce((a, b) => a + f(b), 0) / (s.length || 1); };
  const sections = [];
  for (let c = K; c <= n - K; c++) {
    const zc = (nov[c] - nm) / nsd;
    if (zc < 0.5) continue;
    let peak = true; for (let d = -2; d <= 2; d++) if (d && nov[c + d] > nov[c]) peak = false;
    if (!peak || sections.some(s => c - s.bar < 4)) continue;
    const dL = mean4(c, c + 4, b => b.loud) - mean4(c - 4, c, b => b.loud), dC = mean4(c, c + 4, b => b.clar) - mean4(c - 4, c, b => b.clar);
    sections.push({ bar: c, t: bars[c].t, z: +zc.toFixed(2), dLoud: +dL.toFixed(1), dClar: +dC.toFixed(2),
      kind: dL >= 4 || (dC >= 0.4 && dL > -1) ? "drop" : dL <= -4 ? "break" : "change" });
  }
  const clar = bars.map(b => b.clar).sort((a, b) => a - b);
  const phrase = sections.filter(s => s.bar % 4 === 0).length / (sections.length || 1);
  return { key, bpm: grid.bpm, conf: grid.conf, maxDriftMs: grid.maxDriftMs, period: P, bar0, dur: +F.dur.toFixed(2),
    bars: bars.map((b, i) => ({ m: b.m, t: b.t, loud: b.loud, clar: b.clar, nov: +(i >= K && i <= n - K ? (nov[i] - nm) / nsd : 0).toFixed(2) })),
    clarityMedian: clar[clar.length >> 1], beatless: +(bars.filter(b => b.clar < 1.8).length / (n || 1)).toFixed(2),
    sections, onPhrase: +phrase.toFixed(2) };
}

function songCache(key, file, grid) {
  const f = path.join(OUT, key + ".json");
  if (fs.existsSync(f)) { const c = JSON.parse(fs.readFileSync(f, "utf8")); if (c.v === 2 && Math.abs(c.bpm - grid.bpm) < 1e-6) return c; }
  const r = Object.assign({ v: 2 }, analyseSong(key, file, grid));
  fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(f, JSON.stringify(r));
  return r;
}

// ---------------- levels ----------------
const offsetOf = h => { const m = /(?:^|,)kA13,([-0-9.]+)/.exec(h || ""); return m ? +m[1] : 0; };
function songUrl(rec) {
  const custom = GD.getField(rec, "k45");
  if (custom && custom !== "0") return "/song/custom/" + custom + ".mp3";
  return "/song/official/" + OFFICIAL[+(GD.getField(rec, "k8") || 0)] + ".mp3";
}
function levelSources(args) {
  const all = !args.some(a => ["--official", "--community", "--repo"].includes(a)), out = [];
  if (all || args.includes("--official")) for (let n = 1; n <= 22; n++) {
    const f = path.join(GAME, "Resources", "levels", n + ".txt");
    if (fs.existsSync(f)) out.push({ group: "official", name: NAMES[n - 1], levelStr: unpack(fs.readFileSync(f, "utf8")), song: "/song/official/" + OFFICIAL[n - 1] + ".mp3" });
  }
  const meta = {};
  try { for (const m of JSON.parse(fs.readFileSync(path.join(ROOT, "local", "community", "list.json"), "utf8"))) meta[m.id] = m; } catch (e) {}
  if (all || args.includes("--community")) {
    const d = path.join(ROOT, "local", "community");
    if (fs.existsSync(d)) for (const f of fs.readdirSync(d).sort()) if (f.endsWith(".gdlvl")) {
      try { const L = readGdlvl(path.join(d, f)); const id = f.replace(".gdlvl", "");
        out.push({ group: "community", name: L.name + " (" + id + ")", levelStr: L.levelStr, song: songUrl(L.rec), meta: meta[id] }); } catch (e) {}
    }
  }
  if (all || args.includes("--repo")) for (const dir of ["levels"]) {
    const d = path.join(ROOT, dir);
    if (fs.existsSync(d)) for (const f of fs.readdirSync(d).sort()) if (f.endsWith(".gdlvl")) {
      const L = readGdlvl(path.join(d, f)); out.push({ group: "gdlm", name: L.name, levelStr: L.levelStr, song: songUrl(L.rec) });
    }
  }
  return out;
}

function measureLevel(src, song) {
  const L = GD.parseLevel(src.levelStr), world = GD.makeWorld(L.objects, L.header), tl = S.timeline(world);
  const off = offsetOf(L.header), P = song.period, end = S.tOfX(tl, world.endX) + off;
  const tr = [];
  for (const b of world.items) if (b.kind === "mode" || b.kind === "speed") tr.push({ t: S.tOfX(tl, b.x0 - 15) + off, what: b.kind === "mode" ? b.d.mode : "speed" });
  for (const o of L.objects) if (COLOUR_TRIGGERS.has(o.id)) tr.push({ t: S.tOfX(tl, o.x) + off, what: "colour" });
  // keep one transition per beat (a portal and its colour trigger are one moment)
  tr.sort((a, b) => a.t - b.t);
  const moments = []; for (const e of tr) if (!moments.length || e.t - moments[moments.length - 1].t > P) moments.push(e);
  const inSpan = song.sections.filter(s => s.t > off + 2 * P && s.t < end - 2 * P);
  const hitRate = (secs, shift) => secs.filter(s => moments.some(e => Math.abs(e.t - (s.t + shift)) <= P)).length / (secs.length || 1);
  const r = { group: src.group, name: src.name, song: song.key, seconds: +(end - off).toFixed(1), sections: inSpan.length, moments: moments.length };
  if (inSpan.length >= 2 && moments.length >= 2) {
    r.hit = +hitRate(inSpan, 0).toFixed(2);
    const luck = [];
    const barsIn = Math.floor((end - off) / (4 * P));
    for (let k = 4; k <= barsIn - 4; k++) for (const sg of [1, -1]) {
      const sh = sg * k * 4 * P, moved = inSpan.map(s => ({ t: s.t + sh })).filter(s => s.t > off && s.t < end);
      if (moved.length >= 2) luck.push(hitRate(moved, 0));
    }
    if (luck.length) { r.luck = +(luck.reduce((a, b) => a + b, 0) / luck.length).toFixed(2); r.p = +(luck.filter(x => x >= r.hit).length / luck.length).toFixed(2); }
    r.drops = inSpan.filter(s => s.kind === "drop").length;
    r.dropHit = r.drops ? +(inSpan.filter(s => s.kind === "drop" && moments.some(e => Math.abs(e.t - s.t) <= P)).length / r.drops).toFixed(2) : null;
  }
  // density: hazards per bar vs the bar's loudness (Spearman), and the mode at each bar
  const bars = song.bars.filter(b => b.t >= off && b.t + 4 * P <= end);
  if (bars.length >= 8) {
    const haz = bars.map(() => 0), mt = new Map(bars.map((b, i) => [b.m, i]));
    for (const b of world.items) if (b.kind === "hazard") { const t = S.tOfX(tl, (b.x0 + b.x1) / 2) + off; const m = Math.floor((t - song.bar0) / (4 * P)); if (mt.has(m)) haz[mt.get(m)]++; }
    r.densLoud = +spearman(haz, bars.map(b => b.loud)).toFixed(2);
    const modeAt = t => { let m = "cube"; for (const e of tr) if (e.what !== "speed" && e.what !== "colour" && e.t <= t) m = e.what; return m; };
    // the bar's beat clarity and loudness as a percentile within this song (0 = the song's calmest)
    const pct = (f) => { const all = song.bars.map(f).sort((a, b) => a - b); return v => all.filter(x => x < v).length / all.length; };
    const pc = pct(b => b.clar), pl = pct(b => b.loud);
    r.barModes = bars.map(b => [modeAt(b.t + 2 * P), pc(b.clar), pl(b.loud)]);
    // novelty (section-change strength) where the level's portals and colour changes are, vs everywhere
    // in the level: threshold-free. A moment counts at the bar line within 1 beat of it.
    const lineNov = new Map(song.bars.map(b => [b.m, b.nov]));
    r.novAt = { portal: [], colour: [] };
    for (const e of moments) {
      const q = (e.t - song.bar0) / (4 * P), m = Math.round(q);
      if (Math.abs(q - m) * 4 > 1 || !lineNov.has(m)) continue;
      r.novAt[e.what === "colour" ? "colour" : "portal"].push(lineNov.get(m));
    }
    r.novAll = bars.map(b => b.nov);
  }
  return r;
}
function rank(a) { const i = a.map((v, k) => [v, k]).sort((x, y) => x[0] - y[0]), r = new Array(a.length); for (let j = 0; j < i.length;) { let k = j; while (k + 1 < i.length && i[k + 1][0] === i[j][0]) k++; for (let q = j; q <= k; q++) r[i[q][1]] = (j + k) / 2; j = k + 1; } return r; }
function spearman(a, b) { const x = rank(a), y = rank(b), n = a.length, mx = (n - 1) / 2; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - mx); sxx += (x[i] - mx) ** 2; syy += (y[i] - mx) ** 2; } return sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0; }

// ---------------- main ----------------
if (require.main === module) {
  const args = process.argv.slice(2);
  const doSongs = args.includes("--songs") || !args.includes("--levels"), doLevels = args.includes("--levels") || !args.includes("--songs");
  const files = new Map(allSongs().map(s => [s.key, s.file]));
  const songs = new Map();
  const getSong = key => {
    if (songs.has(key)) return songs.get(key);
    const g = loadBeats(key), file = files.get(key);
    const s = g && g.ok && file ? songCache(key, file, g) : null;
    songs.set(key, s); return s;
  };
  const keyOf = url => { const m = /^\/song\/(official|custom)\/([A-Za-z0-9]+)\./.exec(url || ""); return m ? m[1] + "_" + m[2] : null; };
  if (doSongs) {
    console.log("song".padEnd(34), "BPM    conf    drift  clarity beatless sections (bar:kind)                        on 4-bar phrase");
    for (const k of [...files.keys()]) {
      const s = getSong(k); if (!s) { console.log(k.padEnd(34), "no beat grid"); continue; }
      const secs = s.sections.map(x => x.bar + ":" + x.kind[0]).join(" ");
      console.log(k.padEnd(34), s.bpm.toFixed(1).padStart(5), String(s.conf).padEnd(7), String(s.maxDriftMs).padStart(4) + "ms",
        String(s.clarityMedian).padStart(6), (Math.round(s.beatless * 100) + "%").padStart(7), " ", secs.slice(0, 52).padEnd(52), Math.round(s.onPhrase * 100) + "%");
    }
  }
  if (doLevels) {
    const rows = [];
    for (const src of levelSources(args)) {
      const key = keyOf(src.song), song = key && getSong(key);
      if (!song) continue;
      try { rows.push(measureLevel(src, song)); } catch (e) { console.warn("skip", src.name, e.message); }
    }
    console.log("\nlevel".padEnd(46), "song".padEnd(28), "secs  sect  moves  at a section  luck  p     drops hit   density~loud");
    for (const r of rows) console.log(("[" + r.group[0] + "] " + r.name).slice(0, 45).padEnd(45), r.song.replace(/^(official|custom)_/, "").slice(0, 27).padEnd(27),
      String(r.seconds).padStart(6), String(r.sections).padStart(4), String(r.moments).padStart(6), r.hit !== undefined ? (Math.round(r.hit * 100) + "%").padStart(8) : "       -",
      r.luck !== undefined ? (Math.round(r.luck * 100) + "%").padStart(7) : "      -", r.p !== undefined ? String(r.p).padStart(5) : "    -",
      r.drops ? (r.drops + " " + Math.round(r.dropHit * 100) + "%").padStart(9) : "        -", r.densLoud !== undefined ? String(r.densLoud).padStart(8) : "");
    // pooled, per group
    const pool = {};
    for (const r of rows) {
      const g = pool[r.group] = pool[r.group] || { n: 0, hit: 0, luck: 0, levels: 0, drops: 0, dropHit: 0, dl: [], modes: {} };
      if (r.hit !== undefined && r.luck !== undefined) { g.levels++; g.n += r.sections; g.hit += r.hit * r.sections; g.luck += r.luck * r.sections; }
      if (r.drops) { g.drops += r.drops; g.dropHit += r.dropHit * r.drops; }
      if (r.densLoud !== undefined) g.dl.push(r.densLoud);
      for (const [m, c, l] of r.barModes || []) { const q = g.modes[m] = g.modes[m] || { bars: 0, clar: [], beatless: 0, loud: [] }; q.bars++; q.clar.push(c); q.loud.push(l); if (c < 0.2) q.beatless++; }
      if (r.novAt) { g.nov = g.nov || { portal: [], colour: [], all: [] }; g.nov.portal.push(...r.novAt.portal); g.nov.colour.push(...r.novAt.colour); g.nov.all.push(...r.novAll); }
    }
    const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
    const med = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[b.length >> 1] : NaN; };
    console.log("\npooled:");
    const summary = {};
    for (const [g, q] of Object.entries(pool)) {
      const s = summary[g] = { levels: q.levels, sections: q.n, atSection: +(q.hit / (q.n || 1)).toFixed(2), luck: +(q.luck / (q.n || 1)).toFixed(2),
        drops: q.drops, dropsHit: +(q.dropHit / (q.drops || 1)).toFixed(2), densityLoudMedian: +med(q.dl).toFixed(2), densityLoudPositive: +(q.dl.filter(x => x > 0).length / (q.dl.length || 1)).toFixed(2),
        modes: Object.fromEntries(Object.entries(q.modes).map(([m, v]) => [m, { bars: v.bars, clarityPct: +mean(v.clar).toFixed(2), calmest20: +(v.beatless / v.bars).toFixed(2), loudPct: +mean(v.loud).toFixed(2) }])) };
      if (q.nov) {
        // share of moments on a bar line in the song's top 20% of novelty, vs 20% by luck
        const top = q.nov.all.slice().sort((a, b) => b - a)[Math.floor(q.nov.all.length * 0.2)];
        for (const k of ["portal", "colour"]) s["nov_" + k] = { n: q.nov[k].length, mean: +mean(q.nov[k]).toFixed(2), top20: +(q.nov[k].filter(x => x >= top).length / (q.nov[k].length || 1)).toFixed(2) };
        s.nov_all = +mean(q.nov.all).toFixed(2);
      }
      console.log(`  ${g}: ${s.levels} levels, ${s.sections} section changes: a transition at ${Math.round(s.atSection * 100)}% (luck ${Math.round(s.luck * 100)}%); ` +
        `drops ${s.drops}, met ${Math.round(s.dropsHit * 100)}%; hazards per bar vs loudness: median r ${s.densityLoudMedian}, positive in ${Math.round(s.densityLoudPositive * 100)}%`);
      if (s.nov_portal) console.log(`     novelty (section-change strength, z) at portals ${s.nov_portal.mean} (n ${s.nov_portal.n}, ${Math.round(s.nov_portal.top20 * 100)}% in the song's top 20%), ` +
        `at colour changes ${s.nov_colour.mean} (n ${s.nov_colour.n}, ${Math.round(s.nov_colour.top20 * 100)}%), all bars ${s.nov_all}`);
      console.log("     mode    bars   beat clarity / loudness as a percentile of the song (0.5 = typical), share in the song's calmest 20% bars");
      for (const [m, v] of Object.entries(s.modes).sort((a, b) => b[1].bars - a[1].bars))
        console.log(`     ${m.padEnd(7)} ${String(v.bars).padStart(5)}   clarity ${v.clarityPct}   loudness ${v.loudPct}   calmest-20% ${Math.round(v.calmest20 * 100)}%`);
    }
    if (args.includes("--json")) { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, "levels.json"), JSON.stringify({ summary, rows: rows.map(r => Object.assign({}, r, { barModes: undefined })) }, null, 1)); }
  }
}
module.exports = { analyseSong, songCache, measureLevel };
