// node tools/sectionbeats.js <song key> --from <s> [--to <s> | --cols N] [--min 0.3] [--json]
// A song section's real hits as the beats a section generator follows (tools/sectiongen.js `beats`): every note onset
// of the song from knowledge/song_notes/<key>.json (committed numbers, so it works in the cloud) between from and to,
// strength >= min (0.3, as the board's 🎲), near-twins (under 60 ms apart) merged to the stronger, impacts (drum entries, accents) raised to full
// strength, each as {t: seconds from the section's start, s: 0..1}. Evgeni 2026-11-27: "generate to clicks or around, not
// just to some bpm". With --from alone the section runs --cols columns at 1x (60 by default).
const { loadNotes } = require("./impacts.js");
const COLS_PER_SEC = 311.58 / 30;
function songBeats(key, from, to, { min = 0.3 } = {}) {
  const n = loadNotes(key); if (!n) throw new Error("no song notes for " + key + " (knowledge/song_notes/)");
  const out = [];
  for (const [t, s] of n.notes || []) { if (t < from - 1e-6 || t > to || s < min) continue;
    const last = out[out.length - 1]; if (last && t - last.t < 0.06) { if (s > last.s) { last.t = t; last.s = s; } continue; } out.push({ t, s }); }
  for (const [t, , s] of n.impacts || []) { if (t < from || t > to) continue; const near = out.find(b => Math.abs(b.t - t) < 0.06);
    if (near) near.s = Math.max(near.s, Math.max(0.9, s)); else out.push({ t, s: Math.max(0.9, s) }); }
  return out.sort((a, b) => a.t - b.t).map(b => ({ t: +(b.t - from).toFixed(4), s: +b.s.toFixed(2) })); }
module.exports = { songBeats };
if (require.main === module) {
  const a = process.argv.slice(2), arg = k => { const i = a.indexOf("--" + k); return i >= 0 ? a[i + 1] : null; };
  if (!a[0] || arg("from") == null) { console.log("usage: node tools/sectionbeats.js <song key> --from <s> [--to <s> | --cols N] [--min 0.3] [--json]"); process.exit(1); }
  const from = +arg("from"), to = arg("to") != null ? +arg("to") : from + (+(arg("cols") || 60)) / COLS_PER_SEC;
  const b = songBeats(a[0], from, to, { min: arg("min") != null ? +arg("min") : 0.3 });
  if (a.includes("--json")) console.log(JSON.stringify(b)); else { console.log(b.length + " hits in " + (to - from).toFixed(2) + " s"); console.log(b.map(x => x.t.toFixed(2) + (x.s >= 0.9 ? "!" : "")).join(" ")); }
}
