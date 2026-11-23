// node tests/beats_synth.js -- tools/beats.js on made-up songs with a known grid.
// Kick on every beat (louder on the downbeat), hi-hat on the off-beats, a bass note per bar and
// noise; checks tempo, beat phase (ms) and downbeat. Needs ffmpeg.
const fs = require("fs"), os = require("os"), path = require("path"), { spawnSync } = require("child_process");
const { analyse } = require("../tools/beats.js");
const SR = 44100;
function song(bpm, t0, dur, down, swingMs) {
  const x = new Float32Array(Math.round(dur * SR)), P = 60 / bpm;
  let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) - 0.5;
  for (let i = 0; i < x.length; i++) x[i] = 0.02 * rnd();
  const add = (t, f) => { for (let i = Math.max(0, Math.round(t * SR)); i < x.length && i < (t + 0.3) * SR; i++) x[i] += f((i / SR) - t); };
  for (let k = 0; t0 + k * P < dur; k++) {
    const t = t0 + k * P + (k % 2 ? swingMs / 1000 : 0), acc = k % 4 === down ? 1 : 0.55;
    add(t, u => acc * 0.8 * Math.sin(2 * Math.PI * (55 + 90 * Math.exp(-u * 30)) * u) * Math.exp(-u * 12));
    add(t + P / 2, u => 0.25 * rnd() * Math.exp(-u * 60));
    if (k % 4 === down) add(t, u => 0.2 * Math.sin(2 * Math.PI * 110 * u) * Math.exp(-u * 3));
  }
  const f = path.join(os.tmpdir(), `gdlm_synth_${bpm}.wav`);
  const r = spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "f32le", "-ar", String(SR), "-ac", "1", "-i", "-", f], { windowsHide: true, input: Buffer.from(x.buffer) });
  if (r.status) throw new Error(String(r.stderr));
  return f;
}
let bad = 0;
for (const [bpm, t0, down] of [[150, 0.437, 2], [128, 0.1, 0], [174, 1.234, 1], [100, 0.61, 3], [140, 0.05, 0]]) {
  const f = song(bpm, t0, 60, down, 0);
  const b = analyse(f);
  fs.unlinkSync(f);
  // compare the first beat at/after 0 of both grids
  const P = 60 / bpm, want0 = t0 - Math.floor(t0 / P) * P;
  let dt = (b.t0 - want0) * 1000; dt -= Math.round(dt / (P * 1000)) * P * 1000;
  // detected beat i is synth beat i - floor(t0/P) (the detected grid starts at the first beat >= 0)
  const k = Math.floor(t0 / P) - Math.round((b.t0 - want0) / P), wantDown = ((down + k) % 4 + 4) % 4;
  const ok = Math.abs(b.bpm - bpm) < 0.05 && Math.abs(dt) < 8 && b.downbeat === wantDown;
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "BAD "} ${bpm} BPM -> ${b.bpm}  phase ${dt.toFixed(1)} ms  downbeat ${b.downbeat} (want ${wantDown})  z ${b.z} ${b.conf}`);
}
process.exit(bad ? 1 : 0);
