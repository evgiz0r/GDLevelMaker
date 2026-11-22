// node tools/beats.js [--all | song.mp3 ...]  -- finds the beat grid of songs on this PC.
//
// --all (the default) does every song a level in the viewer uses, plus every official song and
// every custom song in the save folder. Results go to local/beats/<key>.json and are collected
// into viewer/beats.local.js for the viewer. Both are gitignored: they come from the songs,
// which stay on this PC.
//
// Method (no dependencies: ffmpeg decodes, the rest is plain JS):
//  1. ffmpeg -> mono 22050 Hz float PCM.
//  2. 2048-point FFT every 256 samples (11.6 ms); energy in 40 log-spaced bands; log-compressed;
//     onset envelope = summed positive change per band (spectral flux), minus its local mean.
//     A second envelope from the bands under 150 Hz (kick drum) is kept for downbeats.
//  3. Tempo: autocorrelation of the envelope over 60-240 BPM with a broad preference around
//     140 BPM (GD songs are mostly 120-180), then the beat period and phase are refined by
//     fitting one straight grid t_k = t0 + k*P to the whole song (GD songs are electronic, and
//     a level is built on one grid). Electronic music has a fixed tempo, so this works well;
//     "drift" reports how far the best local phase wanders from the grid, which catches songs
//     that change tempo.
//  4. Downbeat: the beat (mod 4) with the most kick-drum flux.
//  5. Confidence: how far the grid's envelope score sits above the same grid shifted to random
//     phases (a z-score), and the share of strong onsets within 35 ms of a beat or half-beat.
const fs = require("fs"), path = require("path"), { spawnSync } = require("child_process");

const SR = 22050, N = 2048, HOP = 256, FPS = SR / HOP, CENTER = N / 2 / HOP; // frame f is centred at (f + CENTER) / FPS
const GAME = process.env.GD_GAME || "C:/Program Files (x86)/Steam/steamapps/common/Geometry Dash";
const SAVE = process.env.GD_SAVE || path.join(process.env.LOCALAPPDATA || "", "GeometryDash");
const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "local", "beats");

// ---------- audio ----------
function decode(file) {
  const r = spawnSync("ffmpeg", ["-v", "error", "-i", file, "-ac", "1", "-ar", String(SR), "-f", "f32le", "-"],
    { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error("ffmpeg failed on " + file + ": " + String(r.stderr));
  const b = r.stdout;
  return new Float32Array(b.buffer, b.byteOffset, b.length >> 2);
}

// in-place radix-2 FFT
function makeFFT(n) {
  const rev = new Uint32Array(n), bits = Math.log2(n);
  for (let i = 0; i < n; i++) { let r = 0; for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b); rev[i] = r; }
  const cos = new Float64Array(n / 2), sin = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos(2 * Math.PI * i / n); sin[i] = -Math.sin(2 * Math.PI * i / n); }
  return (re, im) => {
    for (let i = 0; i < n; i++) { const j = rev[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let i = 0; i < n; i += size) for (let j = 0, k = 0; j < half; j++, k += step) {
        const a = i + j, b = a + half;
        const tr = re[b] * cos[k] - im[b] * sin[k], ti = re[b] * sin[k] + im[b] * cos[k];
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
      }
    }
  };
}

// onset envelopes (full band and kick band), one value per hop
function envelopes(pcm) {
  const fft = makeFFT(N), win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
  const NB = 40, edges = [];
  for (let b = 0; b <= NB; b++) edges.push(Math.round(30 * Math.pow(11000 / 30, b / NB) / SR * N));
  const kickTop = Math.round(150 / SR * N);
  const frames = Math.max(0, Math.floor((pcm.length - N) / HOP));
  const env = new Float64Array(frames), kick = new Float64Array(frames), loud = new Float64Array(frames);
  const re = new Float64Array(N), im = new Float64Array(N);
  let prev = new Float64Array(NB), cur = new Float64Array(NB);
  for (let f = 0; f < frames; f++) {
    const o = f * HOP;
    let e2 = 0;
    for (let i = 0; i < N; i++) { const v = pcm[o + i]; re[i] = v * win[i]; im[i] = 0; e2 += v * v; }
    loud[f] = Math.sqrt(e2 / N);
    fft(re, im);
    let flux = 0, kflux = 0;
    for (let b = 0; b < NB; b++) {
      let s = 0; const lo = edges[b], hi = Math.max(edges[b + 1], lo + 1);
      for (let k = lo; k < hi; k++) s += re[k] * re[k] + im[k] * im[k];
      cur[b] = Math.log1p(100 * s / (hi - lo));
      const d = cur[b] - prev[b];
      if (d > 0 && f > 0) { flux += d; if (edges[b + 1] <= kickTop) kflux += d; }
    }
    env[f] = flux; kick[f] = kflux;
    const t = prev; prev = cur; cur = t;
  }
  return { env: detrend(env, Math.round(FPS)), kick: detrend(kick, Math.round(FPS)), loud };
}
// subtract a moving average and keep the positive part
function detrend(x, w) {
  const out = new Float64Array(x.length), c = new Float64Array(x.length + 1);
  for (let i = 0; i < x.length; i++) c[i + 1] = c[i] + x[i];
  for (let i = 0; i < x.length; i++) {
    const a = Math.max(0, i - w), b = Math.min(x.length, i + w + 1);
    out[i] = Math.max(0, x[i] - (c[b] - c[a]) / (b - a));
  }
  return out;
}
function smooth(x, sigma) {
  const r = Math.ceil(sigma * 3), k = [];
  for (let i = -r; i <= r; i++) k.push(Math.exp(-i * i / (2 * sigma * sigma)));
  const out = new Float64Array(x.length);
  for (let i = 0; i < x.length; i++) { let s = 0; for (let j = -r; j <= r; j++) { const v = x[i + j]; if (v !== undefined) s += v * k[j + r]; } out[i] = s; }
  return out;
}
// LAG: measured bias of the envelope peak against the true onset, in frames (tests/beats_synth.js)
const LAG = 2.44;
const at = (x, f) => { const i = Math.floor(f), a = f - i; return i < 0 || i + 1 >= x.length ? 0 : x[i] * (1 - a) + x[i + 1] * a; };

// ---------- tempo and grid ----------
function tempo(env, from, to) {
  const x = env.subarray(from, to);
  let m = 0; for (const v of x) m += v; m /= x.length;
  const lagLo = Math.floor(FPS * 60 / 240), lagHi = Math.ceil(FPS * 60 / 60);
  const ac = new Float64Array(lagHi + 2);
  for (let L = lagLo - 1; L <= lagHi + 1; L++) { let s = 0; for (let i = 0; i + L < x.length; i++) s += (x[i] - m) * (x[i + L] - m); ac[L] = s / (x.length - L); }
  const cands = [];
  for (let L = lagLo; L <= lagHi; L++) {
    if (!(ac[L] > ac[L - 1] && ac[L] >= ac[L + 1]) || ac[L] <= 0) continue;
    const d = ac[L - 1] - 2 * ac[L] + ac[L + 1], off = d ? 0.5 * (ac[L - 1] - ac[L + 1]) / d : 0;
    const lag = L + off, bpm = 60 * FPS / lag;
    const prior = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 140) / 0.9, 2));
    cands.push({ lag, bpm, score: ac[L] * prior, raw: ac[L] });
  }
  cands.sort((a, b) => b.score - a.score);
  return cands;
}
// grid score: smoothed envelope summed on t0 + k*P over [from, to)
function gridScore(sm, P, ph, from, to) {
  let s = 0, n = 0;
  for (let f = ph + Math.ceil((from - ph) / P) * P; f < to; f += P) { s += at(sm, f); n++; }
  return n ? s / n : 0;
}
function fitGrid(env, lag) {
  const sm = smooth(env, 1.5), n = env.length;
  let best = { s: -1 };
  // coarse: period +-3%, phase over one period
  for (let P = lag * 0.97; P <= lag * 1.03; P += lag * 0.0005)
    for (let ph = 0; ph < P; ph += 0.5) { const s = gridScore(sm, P, ph, 0, n); if (s > best.s) best = { s, P, ph }; }
  // fine
  const c = best;
  for (let P = c.P - lag * 0.0005; P <= c.P + lag * 0.0005; P += lag * 0.00002)
    for (let ph = c.ph - 0.6; ph <= c.ph + 0.6; ph += 0.05) { const s = gridScore(sm, P, ph, 0, n); if (s > best.s) best = { s, P, ph: ph < 0 ? ph + P : ph }; }
  // confidence: the same grid at other phases
  const others = [];
  // (skipping phases near the half-beat: off-beat hi-hats make that one score well too)
  for (let k = 1; k < 40; k++) if (Math.abs(k / 40 - 0.5) > 0.13 && k / 40 > 0.13 && k / 40 < 0.87) others.push(gridScore(sm, best.P, best.ph + best.P * k / 40, 0, n));
  best.half = gridScore(sm, best.P, best.ph + best.P / 2, 0, n) / best.s;
  const mean = others.reduce((a, b) => a + b, 0) / others.length;
  const sd = Math.sqrt(others.reduce((a, b) => a + (b - mean) * (b - mean), 0) / others.length) || 1e-9;
  best.z = (best.s - mean) / sd;
  let all = 0; for (let i = 0; i < n; i++) all += sm[i];
  best.ratio = best.s / (all / n); // envelope on the beats vs everywhere
  // drift: best local phase in 15 s pieces, as an offset from the global grid (within a quarter
  // beat: an intro that stresses the off-beats is syncopation, not drift)
  best.drift = [];
  const seg = Math.round(15 * FPS);
  for (let a = 0; a + seg / 2 < n; a += seg) {
    let lb = { s: -1, d: 0 };
    for (let d = -best.P / 4; d <= best.P / 4; d += 0.25) { const s = gridScore(sm, best.P, best.ph + d, a, Math.min(n, a + seg)); if (s > lb.s) lb = { s, d }; }
    const strength = gridScore(sm, best.P, best.ph, a, Math.min(n, a + seg));
    best.drift.push({ t: +(a / FPS).toFixed(1), ms: Math.round(lb.d / FPS * 1000), strength: +strength.toFixed(3) });
  }
  return best;
}
function peaks(env, minGap) {
  const out = [];
  const sorted = Array.from(env).filter(v => v > 0).sort((a, b) => a - b);
  const thr = sorted.length ? sorted[Math.floor(sorted.length * 0.9)] : 0;
  for (let i = 2; i < env.length - 2; i++) {
    const v = env[i];
    if (v < thr) continue;
    let ok = true;
    for (let j = Math.max(0, i - minGap); j <= Math.min(env.length - 1, i + minGap); j++) if (env[j] > v || (env[j] === v && j < i)) { ok = false; break; }
    if (ok) out.push([+((i + CENTER + LAG) / FPS).toFixed(4), +v.toFixed(3)]);
  }
  return out;
}

function analyse(file) {
  const pcm = decode(file);
  const dur = pcm.length / SR;
  const { env, kick, loud } = envelopes(pcm);
  // tempo from the loudest part (skips quiet intros)
  const cands = tempo(env, 0, env.length);
  if (!cands.length) return { file, dur, ok: false };
  // The autocorrelation often confuses the tempo with 3/2, 2/3, 2 or 1/2 of it, so fit a grid for
  // the top peaks and those ratios (75-210 BPM) and keep the one whose beats carry the most onset
  // energy compared with the song overall ("ratio"). A slow grid wins that too easily (it keeps
  // only the strongest hits), so a grid whose half-beats are also strong (half > 0.5) counts as
  // its double. A mild 140 BPM preference breaks near-ties. Checked by ear-free means on the 22
  // official songs: this gives the tempo the levels are built on (see SYNC.md).
  const tried = [];
  const fitAt = (bpm) => {
    let g = tried.find(t => Math.abs(t.bpm / bpm - 1) < 0.02);
    if (g) return g;
    g = fitGrid(env, 60 * FPS / bpm);
    g.bpm = 60 * FPS / g.P;
    tried.push(g);
    if (process.env.BEATS_DEBUG) console.log("   cand", g.bpm.toFixed(1), "z", g.z.toFixed(1), "ratio", g.ratio.toFixed(2), "half", g.half.toFixed(2));
    return g;
  };
  for (const c of cands.slice(0, 3)) for (const r of [1, 1.5, 2 / 3, 2, 0.5]) {
    const bpm = c.bpm * r;
    if (bpm >= 75 && bpm <= 210) fitAt(bpm);
  }
  const prior = bpm => Math.exp(-0.5 * Math.pow(Math.log2(bpm / 140), 2));
  const pickable = [];
  for (const g of tried.slice()) {
    let e = g;
    while (e.half > 0.5 && e.bpm * 2 <= 215) e = fitAt(e.bpm * 2);
    if (!pickable.includes(e)) pickable.push(e);
  }
  pickable.forEach(g => { g.rank = g.ratio * prior(g.bpm); });
  pickable.sort((a, b) => b.rank - a.rank);
  const g = pickable[0];
  const others = pickable.slice(1);
  const P = g.P / FPS, t0full = (g.ph + CENTER + LAG) / FPS;
  const t0 = t0full - Math.floor(t0full / P) * P;
  const nBeats = Math.floor((dur - t0) / P) + 1;
  // downbeat: the beat mod 4 with most kick flux
  const ks = smooth(kick, 1.5), bar = [0, 0, 0, 0];
  for (let k = 0; k < nBeats; k++) bar[k % 4] += at(ks, (t0 + k * P) * FPS - CENTER - LAG);
  const order = [0, 1, 2, 3].sort((a, b) => bar[b] - bar[a]);
  // loudness per beat (dB, RMS over the beat) and section changes: beats where the next 8 beats
  // are 3 dB or more louder or quieter than the previous 8 (drops, breakdowns), local maxima only
  const lb = [];
  for (let k = 0; k < nBeats; k++) {
    const a = Math.max(0, Math.round((t0 + k * P) * FPS - CENTER)), b = Math.min(loud.length, Math.round((t0 + (k + 1) * P) * FPS - CENTER));
    let e = 0; for (let i = a; i < b; i++) e += loud[i] * loud[i];
    lb.push(+(10 * Math.log10(e / Math.max(1, b - a) + 1e-10)).toFixed(1));
  }
  const jump = lb.map((_, k) => {
    if (k < 8 || k + 8 > lb.length) return 0;
    const m = (i, j) => lb.slice(i, j).reduce((x, y) => x + y, 0) / (j - i);
    return m(k, k + 8) - m(k - 8, k);
  });
  const sections = [];
  for (let k = 1; k < jump.length - 1; k++)
    if (Math.abs(jump[k]) >= 3 && Math.abs(jump[k]) >= Math.abs(jump[k - 1]) && Math.abs(jump[k]) > Math.abs(jump[k + 1]) && !sections.some(s => k - s[0] < 8))
      sections.push([k, +jump[k].toFixed(1)]);
  // onsets and how many fall on the grid
  const ons = peaks(env, Math.round(0.05 * FPS));
  const strong = ons.slice().sort((a, b) => b[1] - a[1]).slice(0, Math.max(20, Math.floor(ons.length / 3)));
  const near = (t, sub) => { const q = (t - t0) / (P / sub); return Math.abs(q - Math.round(q)) * P / sub; };
  const onGrid = strong.filter(o => near(o[0], 2) < 0.035).length / strong.length;
  const maxDrift = Math.max(...g.drift.filter(d => d.strength > 0).map(d => Math.abs(d.ms)));
  return {
    file: path.basename(file), dur: +dur.toFixed(3), ok: true,
    bpm: +(60 / P).toFixed(3), period: +P.toFixed(6), t0: +t0.toFixed(4), beats: nBeats,
    downbeat: order[0], downbeatConf: +(bar[order[0]] / Math.max(1e-9, bar[order[1]])).toFixed(2),
    z: +g.z.toFixed(1), offbeat: +g.half.toFixed(2), onGrid: +onGrid.toFixed(2), maxDriftMs: maxDrift, drift: g.drift,
    alternatives: others.slice(0, 3).map(t => [+t.bpm.toFixed(1), +t.ratio.toFixed(2)]),
    ratio: +g.ratio.toFixed(2),
    // high: beats carry 3x the average onset energy and the grid holds all song long
    conf: g.ratio >= 3 && maxDrift <= 25 ? "high" : g.ratio >= 2.3 && maxDrift <= 60 ? "medium" : "low",
    loud: lb, sections, // sections: [beat index, dB change] (beat index from t0)
    onsets: ons,
  };
}

// ---------- which songs ----------
const OFFICIAL = ["StereoMadness", "BackOnTrack", "Polargeist", "DryOut", "BaseAfterBase", "CantLetGo",
  "Jumper", "TimeMachine", "Cycles", "xStep", "Clutterfunk", "TheoryOfEverything", "Electroman", "Clubstep",
  "Electrodynamix", "HexagonForce", "BlastProcessing", "TheoryOfEverything2", "GeometricalDominator",
  "Deadlocked", "Fingerdash", "Dash"];
function allSongs() {
  const list = [];
  for (const n of OFFICIAL) { const f = path.join(GAME, "Resources", n + ".mp3"); if (fs.existsSync(f)) list.push({ key: "official_" + n, url: "/song/official/" + n + ".mp3", file: f }); }
  // custom songs: the game's save folder, then the shared cache from tools/songs.js
  const seen = new Set();
  for (const dir of [SAVE, path.join(ROOT, "local", "songs")]) if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).sort()) {
    const m = /^(\d+)\.(mp3|ogg)$/.exec(f);
    if (m && !seen.has(m[1])) { seen.add(m[1]); list.push({ key: "custom_" + m[1], url: "/song/custom/" + f, file: path.join(dir, f) }); }
  }
  return list;
}
// the song a viewer url points at, or null
function keyOfUrl(url) {
  const m = /^\/song\/(official|custom)\/([A-Za-z0-9]+)\.(mp3|ogg)$/.exec(url || "");
  return m ? m[1] + "_" + m[2] : null;
}
function loadBeats(urlOrKey) {
  const key = urlOrKey && urlOrKey.startsWith("/") ? keyOfUrl(urlOrKey) : urlOrKey;
  const f = key && path.join(OUT, key + ".json");
  return f && fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null;
}
// viewer/beats.local.js: the grid (not the onsets) of every analysed song, by url
function writeViewerIndex() {
  const out = {};
  if (fs.existsSync(OUT)) for (const f of fs.readdirSync(OUT)) {
    if (!f.endsWith(".json")) continue;
    const b = JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8"));
    if (!b.ok) continue;
    const [kind, name] = f.replace(/\.json$/, "").split(/_(.+)/);
    out["/song/" + kind + "/" + b.file] = { bpm: b.bpm, period: b.period, t0: b.t0, beats: b.beats, downbeat: b.downbeat, conf: b.conf, sections: b.sections };
  }
  fs.writeFileSync(path.join(ROOT, "viewer", "beats.local.js"),
    "// generated by tools/beats.js from the songs on this PC -- not committed\nwindow.GD_BEATS = " + JSON.stringify(out) + ";\n");
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const files = args.filter(a => !a.startsWith("--"));
  const songs = files.length ? files.map(f => ({ key: "file_" + path.basename(f).replace(/\W+/g, "_"), file: f })) : allSongs();
  fs.mkdirSync(OUT, { recursive: true });
  for (const s of songs) {
    const out = path.join(OUT, s.key + ".json");
    if (!force && !files.length && fs.existsSync(out)) { const b = JSON.parse(fs.readFileSync(out, "utf8")); console.log(line(s.key, b) + "  (cached)"); continue; }
    const t = Date.now();
    const b = analyse(s.file);
    fs.writeFileSync(out, JSON.stringify(b));
    console.log(line(s.key, b) + `  ${((Date.now() - t) / 1000).toFixed(1)}s`);
  }
  writeViewerIndex();
}
function line(key, b) {
  if (!b.ok) return `${key.padEnd(34)} no beat found`;
  return `${key.padEnd(34)} ${b.bpm.toFixed(2).padStart(7)} BPM  first beat ${b.t0.toFixed(3)} s  downbeat ${b.downbeat} (x${b.downbeatConf})  ` +
    `ratio ${b.ratio.toFixed(2)}  z ${String(b.z).padStart(5)}  on-grid ${Math.round(b.onGrid * 100)}%  drift ${b.maxDriftMs} ms  ${b.conf}` + (b.alternatives.length ? `  (alt ${b.alternatives.map(a => a[0] + " r" + a[1]).join(", ")})` : "");
}
// fit one fixed grid near a given tempo (to test a claimed BPM against the audio): the fit may
// slide up to 3% to the tempo the song really has. Returns {bpm, ratio, z, half, maxDriftMs}.
function fitAtBpm(file, bpm) {
  const { env } = envelopes(decode(file));
  const g = fitGrid(env, 60 * FPS / bpm);
  return { bpm: 60 * FPS / g.P, ratio: g.ratio, z: g.z, half: g.half, maxDriftMs: Math.max(...g.drift.map(d => Math.abs(d.ms))) };
}
module.exports = { analyse, loadBeats, keyOfUrl, allSongs, writeViewerIndex, fitAtBpm, OFFICIAL, GAME };
