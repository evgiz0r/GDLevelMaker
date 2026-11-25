// node tests/clicks.js -- lib/clicks.js: the mouse / keyboard click samples (self-made, deterministic), the click track
// tools/video.js --clicks mixes in, and the WAV writer.
const C = require("../lib/clicks.js").CLICKS;
let fails = 0; const check = (c, m) => { console.log((c ? "ok   " : "FAIL ") + m); if (!c) fails++; };
for (const k of C.KINDS) {
  const S = C.samples(k, 48000), peak = a => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
  check(S.down.length === 4 && S.up.length === 4 && S.down.every(a => a.length > 400 && a.every(Number.isFinite)), `${k}: four press and four release takes, finite`);
  check(S.down.every(a => peak(a) > 0.8 && peak(a) <= 1) && S.up.every(a => peak(a) < peak(S.down[0])), `${k}: presses loud, releases softer`);
  check(S.down[0].some((v, i) => v !== S.down[1][i]), `${k}: the takes differ`);
  check(C.samples(k, 48000).down[0] === S.down[0] && require("../lib/clicks.js").CLICKS.samples(k, 44100).down[0].length !== S.down[0].length, `${k}: cached per sample rate`);
}
const tr = C.track("mouse", [{ t: 0.1, type: "press" }, { t: 0.3, type: "release" }], 48000, 0.5);
check(tr.length === 24000 && Math.abs(tr[4800 + 30]) > 0 && tr.slice(0, 4790).every(v => v === 0), "track: a click at its time, silence before");
const w = C.wav(tr, 48000);
check(w.length === 44 + 48000 && String.fromCharCode(...w.slice(0, 4)) === "RIFF", "wav: header and 16-bit samples");
console.log(fails ? fails + " failed" : "all ok"); process.exit(fails ? 1 : 0);
