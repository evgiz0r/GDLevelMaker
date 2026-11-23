// node tests/songmap_synthetic.js  -- checks tools/songmap.js's song side on a made-up song with a
// known structure: 120 BPM, 24 bars of quiet kicks, 24 bars of loud kicks + hi-hats + bass (a drop
// at bar 24), 16 bars of a beatless pad (a break at bar 48). Needs ffmpeg (as tools/beats.js does).
// Expects: a drop within 1 bar of 24, a break within 1 bar of 48, clear beats before 48 and
// beat clarity under 1.8 in the pad.
const fs = require("fs"), path = require("path"), os = require("os");
const { analyseSong } = require("../tools/songmap.js");
const SR = 22050, BPM = 120, P = 60 / BPM, BAR = 4 * P, bars = 64;
const n = Math.round(bars * BAR * SR), x = new Float32Array(n);
let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5;
for (let i = 0; i < n; i++) {
  const t = i / SR, bar = Math.floor(t / BAR), inBeat = t % P;
  let v = 0;
  if (bar < 48) {
    const amp = bar < 24 ? 0.15 : 0.6;
    if (inBeat < 0.12) v += amp * Math.sin(2 * Math.PI * (60 + 90 * Math.exp(-inBeat * 40)) * inBeat) * Math.exp(-inBeat * 25); // kick
    if (bar >= 24) {
      const off = (t + P / 2) % P; if (off < 0.03) v += 0.25 * rnd() * Math.exp(-off * 120);             // off-beat hat
      v += 0.15 * Math.sin(2 * Math.PI * 55 * t);                                                         // bass
    }
  } else v += 0.2 * (Math.sin(2 * Math.PI * 220 * t) + Math.sin(2 * Math.PI * 277 * t) + Math.sin(2 * Math.PI * 330 * t)) / 3; // pad
  x[i] = v;
}
const buf = Buffer.alloc(44 + n * 2);
buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(x[i] * 32767))), 44 + i * 2);
const file = path.join(os.tmpdir(), "songmap_synthetic.wav");
fs.writeFileSync(file, buf);
const r = analyseSong("synthetic", file, { period: P, t0: 0, downbeat: 0, bpm: BPM, conf: "high", maxDriftMs: 0 });
fs.unlinkSync(file);
let ok = true;
const check = (what, cond) => { console.log((cond ? "ok   " : "FAIL ") + what); if (!cond) ok = false; };
const near = (bar, kind) => r.sections.find(s => Math.abs(s.bar - bar) <= 1 && s.kind === kind);
console.log("sections:", r.sections.map(s => `${s.bar}:${s.kind} z${s.z}`).join("  "));
check("a drop at bar 24 (+-1)", !!near(24, "drop"));
check("a break at bar 48 (+-1)", !!near(48, "break"));
const mean = (a, b) => { const s = r.bars.filter(q => q.m >= a && q.m < b); return s.reduce((u, q) => u + q.clar, 0) / s.length; };
const beatC = mean(2, 46), padC = mean(50, 62);
console.log(`beat clarity: beats ${beatC.toFixed(2)}, pad ${padC.toFixed(2)}`);
check("clear beats before the pad (clarity > 2)", beatC > 2);
check("the pad reads as beatless (clarity < 1.8)", padC < 1.8);
process.exit(ok ? 0 : 1);
