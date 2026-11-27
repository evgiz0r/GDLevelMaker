// node tools/songclarity.js  -- rank the official songs for a level whose sync should be easy to SEE: strong notes (strength
//   >= 0.6) per second (fewer = clearer), the share of them on the beat / on half beats (within 35 ms), and how clearly one
//   instrument band (low / mid / top) leads each bar. Numbers only, from knowledge/song_notes/ (tools/impacts.js --commit).
//   Used to pick the second auto lab's song (Can't Let Go, 2026-11-26; AUTO.md).
const fs = require("fs"), path = require("path");
const DIR = path.join(__dirname, "..", "knowledge", "song_notes");
const rows = [];
for (const f of fs.readdirSync(DIR).filter(f => f.startsWith("official_"))) {
  const j = JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")), N = j.notes, P = j.period, dur = N[N.length - 1][0];
  const strong = N.filter(n => n[1] >= 0.6);
  const near = (t, step) => { const ph = ((t - j.t0) / (P * step)) % 1; return Math.min(ph, 1 - ph) * P * step < 0.035; };
  const by = {};
  for (const n of N) { if (n[1] < 0.5) continue; const b = Math.floor((n[0] - j.t0) / (4 * P)); (by[b] = by[b] || { low: 0, mid: 0, top: 0 })[n[2]]++; }
  let lead = 0, c = 0;
  for (const v of Object.values(by)) { const t = v.low + v.mid + v.top; if (t < 3) continue; lead += Math.max(v.low, v.mid, v.top) / t; c++; }
  rows.push({ song: f.slice(9, -5), bpm: Math.round(j.bpm), notesPerS: +(N.length / dur).toFixed(1), strongPerS: +(strong.length / dur).toFixed(2),
    onBeat: +(strong.filter(n => near(n[0], 1)).length / strong.length).toFixed(2), onHalf: +(strong.filter(n => near(n[0], 0.5)).length / strong.length).toFixed(2),
    leadShare: +(lead / c).toFixed(2) });
}
rows.sort((a, b) => a.strongPerS - b.strongPerS);
console.log("song                  bpm  notes/s strong/s onBeat onHalf leadShare");
for (const r of rows) console.log(r.song.padEnd(22), String(r.bpm).padStart(3), String(r.notesPerS).padStart(7), String(r.strongPerS).padStart(8), String(r.onBeat).padStart(6), String(r.onHalf).padStart(6), String(r.leadShare).padStart(9));
