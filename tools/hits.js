// node tools/hits.js <song id | local/songs/x.mp3 | official:N> [--from bar] [--to bar] [--json]
//   -- the song's real hits on its beat grid: for every half-beat, how hard the kick (< 150 Hz),
//      the snare/clap (150 Hz-4 kHz) and the top (> 5 kHz) hit there, as z-scores over the song.
//      One line per bar: K = kick, S = snare/clap, x = a lesser hit, . = nothing, upper case +
//      '!' = an accent (the bar's or the song's strongest). Writes local/hits/<key>.json:
//      {grid, slots: [{beat, t, kick, snare, top, all, kind}]} -- beat numbers are make.js's
//      ("b1" = the first beat at or after offset 0), so a spec can put "j<beat>" on a hit.
//   For ultra-synced levels (GDLM 62): put every press on a slot with kind K/S/A, never on '.'.
//   Light job (decodes one song, ~10 MB); needs the beat grid (node tools/beats.js).
// node tools/hits.js --level levels/<name>.gdlvl [--skip 27.9-39.2]
//   -- how well a level's presses sit on the song's hits: from its saved solution (tools/solutions.js),
//      each press's song time against the nearest K/S/accent slot; the share within +-1 frame (16.7 ms)
//      and +-2 frames, and the median offset. --skip a-b (song seconds, repeatable): leave out a
//      stretch (a ship part whose holds follow the music's flow, not its hits).
const fs = require("fs"), path = require("path");
const { decode, makeFFT, loadBeats, OFFICIAL } = require("./beats.js");

const SR = 22050, N = 1024, HOP = 128, FPS = SR / HOP;

function songFile(arg) {
  if (/^\d+$/.test(arg)) return { file: path.join(__dirname, "..", "local", "songs", arg + ".mp3"), url: "/song/custom/" + arg + ".mp3" };
  const m = /^official:(\d+)$/.exec(arg);
  if (m) { const name = OFFICIAL[+m[1] - 1]; return { file: null, url: "/song/official/" + name + ".mp3" }; }
  return { file: arg, url: "/song/custom/" + path.basename(arg) };
}

// band flux envelopes: kick, snare, top, all
function bandFlux(pcm) {
  const fft = makeFFT(N), win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
  const bin = hz => Math.round(hz / SR * N);
  const bands = { kick: [bin(30), bin(150)], snare: [bin(150), bin(4000)], top: [bin(5000), bin(11000)] };
  const frames = Math.max(0, Math.floor((pcm.length - N) / HOP));
  const out = { kick: new Float64Array(frames), snare: new Float64Array(frames), top: new Float64Array(frames), all: new Float64Array(frames) };
  const re = new Float64Array(N), im = new Float64Array(N);
  let prev = new Float64Array(N / 2), cur = new Float64Array(N / 2);
  for (let f = 0; f < frames; f++) {
    const o = f * HOP;
    for (let i = 0; i < N; i++) { re[i] = pcm[o + i] * win[i]; im[i] = 0; }
    fft(re, im);
    for (let k = 0; k < N / 2; k++) cur[k] = Math.log1p(1000 * (re[k] * re[k] + im[k] * im[k]));
    for (const [name, [lo, hi]] of Object.entries(bands)) {
      let s = 0; for (let k = lo; k < hi; k++) { const d = cur[k] - prev[k]; if (d > 0 && f) s += d; }
      out[name][f] = s / (hi - lo);
    }
    let s = 0; for (let k = 1; k < N / 2; k++) { const d = cur[k] - prev[k]; if (d > 0 && f) s += d; }
    out.all[f] = s / (N / 2);
    const t = prev; prev = cur; cur = t;
  }
  return out;
}

function hits(arg) {
  const { file, url } = songFile(arg);
  const b = loadBeats(url);
  if (!b || !b.ok) throw new Error("no beat grid for " + url + ": run node tools/beats.js");
  const pcm = decode(file || b.file);
  const env = bandFlux(pcm);
  const centre = N / 2 / HOP;
  // strongest value within +-35 ms of t (the flux peak sits a little before the onset)
  const peak = (x, t) => { const f = Math.round(t * FPS - centre); let m = 0; for (let d = -4; d <= 3; d++) { const v = x[f + d]; if (v > m) m = v; } return m; };
  const P = b.period, t0 = b.t0, dur = pcm.length / SR;
  const first = Math.ceil(-t0 / P - 1e-9);   // grid beat index at or after 0 -> make.js beat 1
  const raw = [];
  for (let k = first * 2; (t0 + k * P / 2) < dur - 0.05; k++) {
    const t = t0 + k * P / 2;
    raw.push({ beat: +((k / 2 - first) + 1).toFixed(1), t: +t.toFixed(4), kick: peak(env.kick, t), snare: peak(env.snare, t), top: peak(env.top, t), all: peak(env.all, t) });
  }
  // z-scores per band over the song
  for (const name of ["kick", "snare", "top", "all"]) {
    const v = raw.map(r => r[name]), m = v.reduce((a, c) => a + c, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, c) => a + (c - m) ** 2, 0) / v.length) || 1;
    for (const r of raw) r[name] = +((r[name] - m) / sd).toFixed(2);
  }
  for (const r of raw) {
    const s = Math.max(r.kick, r.snare);
    r.kind = r.all >= 2 || s >= 2.2 ? "A" : r.kick >= 0.8 && r.kick >= r.snare ? "K" : r.snare >= 0.8 ? "S" : Math.max(r.kick, r.snare, r.all) >= 0.3 ? "x" : ".";
  }
  // the grid's downbeat in make.js beats: bars start on beats where (beat-1+first) % 4 == downbeat
  const bar1 = ((b.downbeat - first) % 4 + 4) % 4 + 1;
  return { song: url, bpm: b.bpm, t0, period: P, barStartBeat: bar1, slots: raw };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? +args[i + 1] : d; };
  if (!args[0]) { console.log("usage: node tools/hits.js <song id | file | official:N> [--from bar] [--to bar] [--json]"); process.exit(1); }
  if (args[0] === "--level") return levelReport(args[1], args);
  const h = hits(args[0]);
  const out = path.join(__dirname, "..", "local", "hits");
  fs.mkdirSync(out, { recursive: true });
  const key = path.basename(h.song, ".mp3");
  fs.writeFileSync(path.join(out, key + ".json"), JSON.stringify(h));
  console.log(`${h.song}: ${h.bpm} BPM, bars start on beat ${h.barStartBeat} (+4n); slots are half-beats. -> local/hits/${key}.json`);
  console.log("bar  beat    t(s)   8 half-beats: K kick, S snare, A accent, x lesser, . none");
  const from = opt("--from", 0), to = opt("--to", 1e9);
  for (let i = 0, bar = 0; i < h.slots.length; bar++) {
    const startBeat = h.barStartBeat + bar * 4 - (h.barStartBeat > 1 ? 4 : 0);
    const row = h.slots.filter(s => s.beat >= startBeat && s.beat < startBeat + 4);
    i = h.slots.findIndex(s => s.beat >= startBeat + 4); if (i < 0) i = h.slots.length;
    if (bar < from || bar > to || !row.length) continue;
    const marks = row.map(s => s.kind === "A" ? (s.kick >= s.snare ? "K!" : "S!") : s.kind + " ").join("");
    console.log(String(bar).padStart(3), String(row[0].beat).padStart(5), row[0].t.toFixed(2).padStart(7), "  " + marks);
  }
}
function levelReport(file, args) {
  const { readGdlvl, GD } = require("./io.js");
  const R = readGdlvl(file), rec = R.rec, str = R.levelStr;
  const sol = require("./solutions.js").get(str, true);
  if (!sol || !sol.ok) throw new Error("no saved solution for " + file + ": run node tools/solutions.js " + file);
  const song = GD.getField(rec, "k45");
  const off = +((/(?:^|,)kA13,([-0-9.]+)/.exec(str.split(";")[0]) || [])[1] || 0);
  const h = hits(song);
  const skips = [];
  args.forEach((a, i) => { if (a === "--skip") { const [x, y] = args[i + 1].split("-").map(Number); skips.push([x, y]); } });
  const strong = h.slots.filter(s => s.kind !== "." && s.kind !== "x");
  const rows = [];
  for (const e of sol.events) {
    if (e.type !== "press") continue;
    const t = e.tick / 240 + off;
    if (skips.some(([x, y]) => t >= x && t <= y)) continue;
    let best = null;
    for (const s of strong) if (!best || Math.abs(s.t - t) < Math.abs(best.t - t)) best = s;
    rows.push({ t, dt: (t - best.t) * 1000, kind: best.kind, beat: best.beat });
  }
  const n = rows.length, f1 = rows.filter(r => Math.abs(r.dt) <= 16.7).length, f2 = rows.filter(r => Math.abs(r.dt) <= 33.4).length;
  const med = rows.map(r => r.dt).sort((a, b) => a - b)[n >> 1];
  for (const r of rows) console.log(r.t.toFixed(3).padStart(8), "beat", String(r.beat).padStart(6), r.kind, (r.dt >= 0 ? "+" : "") + r.dt.toFixed(0) + " ms");
  console.log(`${n} presses: ${f1} (${Math.round(100 * f1 / n)}%) within +-1 frame of a hit, ${f2} (${Math.round(100 * f2 / n)}%) within +-2 frames; median offset ${med.toFixed(0)} ms`);
}
module.exports = { hits };
