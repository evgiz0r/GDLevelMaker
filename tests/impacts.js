// node tests/impacts.js -- tools/impacts.js finds the impact points of a made-up song with known ones.
// The song (145 BPM, written as a WAV to local/tmp/, needs ffmpeg like every song tool): a quiet pad b1-20, the kick
// comes in at b21, one big crash at b37, snare drums join at b53, louder from b61, a break b89-92, loudest from b93.
// The tool must find b21, b37, b53, b61 and b93 among its strongest impacts (+-1 beat), the break at b89, heaviness
// rising over the song, and suggest a section start at each of b21, b53, b93.
const fs = require("fs"), path = require("path");
const { impacts } = require("../tools/impacts.js");
const { decode } = require("../tools/beats.js");
const SR = 22050, BPM = 145, P = 60 / BPM, T0 = 0.3, BEATS = 124;
const n = Math.ceil((T0 + BEATS * P + 1) * SR), pcm = new Float32Array(n);
let seed = 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const beatT = b => T0 + (b - 1) * P;
const add = (t, len, f) => { const s = Math.round(t * SR); for (let i = 0; i < len * SR && s + i < n; i++) pcm[s + i] += f(i / SR); };
const kick = (t, g) => add(t, 0.18, x => g * Math.sin(2 * Math.PI * (55 + 90 * Math.exp(-x * 30)) * x) * Math.exp(-x * 18));
const snare = (t, g) => add(t, 0.15, x => g * rnd() * Math.exp(-x * 25));
const crash = (t, g) => add(t, 1.2, x => g * (rnd() + 0.6 * Math.sin(2 * Math.PI * 60 * x)) * Math.exp(-x * 2.5));
// pad: a soft chord all through, louder later
for (let i = 0; i < n; i++) {
  const t = i / SR, b = (t - T0) / P + 1;
  const g = b < 61 ? 0.04 : b < 89 ? 0.08 : b < 93 ? 0.02 : 0.14;
  pcm[i] += g * (Math.sin(2 * Math.PI * 220 * t) + Math.sin(2 * Math.PI * 277 * t) + Math.sin(2 * Math.PI * 330 * t)) / 3;
}
for (let b = 1; b <= BEATS; b++) {
  const t = beatT(b);
  if (b >= 21 && !(b >= 89 && b < 93)) kick(t, b >= 93 ? 0.9 : b >= 61 ? 0.7 : 0.5);
  if (b >= 53 && b % 2 === 0 && !(b >= 89 && b < 93)) snare(t, b >= 93 ? 0.45 : 0.3);
  if (b >= 93) snare(t + P / 2, 0.2);
}
crash(beatT(37), 0.9); for (const h of [53, 53.5, 54, 54.25, 54.5, 54.75]) snare(beatT(h), 0.4); // the drum fill into b53's part
 crash(beatT(93), 0.8);
const dir = path.join(__dirname, "..", "local", "tmp"); fs.mkdirSync(dir, { recursive: true });
const wav = path.join(dir, "impacts_test.wav");
const buf = Buffer.alloc(44 + n * 2);
buf.write("RIFF", 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write("WAVEfmt ", 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
buf.write("data", 36); buf.writeUInt32LE(n * 2, 40);
for (let i = 0; i < n; i++) buf.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(pcm[i] * 20000))), 44 + i * 2);
fs.writeFileSync(wav, buf);

const res = impacts(decode(wav), { period: P, t0: T0, downbeat: 0 }, 0);
let bad = 0;
const ok = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) bad++; };
const strong = res.impacts.filter(i => i.strength >= 0.3);
const near = b => strong.find(i => Math.abs(i.beat - b) <= 1);
for (const b of [21, 37, 53, 61, 93]) { const i = near(b); ok(i, `impact at b${b}: ${i ? `b${i.beat} ${i.kind} ${i.strength}` : "none; strong: " + strong.map(x => "b" + x.beat).join(" ")}`); }
const quiet = strong.filter(i => i.beat > 3 && i.beat < 19);
ok(!quiet.length, "nothing strong in the quiet intro b4-18" + (quiet.length ? ": " + quiet.map(x => "b" + x.beat).join(" ") : ""));
ok(res.breaks.some(b => Math.abs(b.beat - 89) <= 1), "break at b89: " + res.breaks.map(b => "b" + b.beat).join(" "));
const hv = a => res.bars.filter(x => x.beat >= a[0] && x.beat < a[1]).reduce((s, x, _, A) => s + x.heavy / A.length, 0);
ok(hv([1, 21]) < hv([21, 53]) && hv([21, 53]) < hv([61, 89]) && hv([61, 89]) < hv([93, 125]), `heaviness rises: ${[[1, 21], [21, 53], [61, 89], [93, 125]].map(a => hv(a).toFixed(2)).join(" < ")}`);
const starts = res.suggest.sections.map(s => s.from);
for (const b of [21, 53, 93]) ok(starts.some(s => Math.abs(s - b) <= 1), `section suggested at b${b} (starts: ${starts.join(" ")})`);
const last = res.suggest.sections[res.suggest.sections.length - 1];
ok(/fast/.test(last.speed), "the loudest part is a fast candidate: " + last.speed);
// offset: the same song from 10 beats in, b1 = old b11
const r2 = impacts(decode(wav), { period: P, t0: T0, downbeat: 0 }, T0 + 10 * P);
ok(r2.impacts.some(i => i.strength >= 0.3 && Math.abs(i.beat - 11) <= 1), "with an offset 10 beats in, the kick entry is level b11");
console.log(bad ? bad + " failed" : "all ok");
process.exit(bad ? 1 : 0);
