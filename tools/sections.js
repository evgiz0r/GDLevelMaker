// node tools/sections.js <Official song | custom id>  -- the song's sections, cut at its transitions, each with its CHARACTER:
//   what kind of transition starts it and what kind of section it is, from the measured notes (knowledge/song_notes/,
//   tools/impacts.js): drop, break (breakdown), build, entry (an instrument comes in), groove (more of the same). With the band
//   that leads it (low = kick / bass, mid = snare / keys, top = hats / high notes), its heaviness and loudness against the song.
//   Evgeni (2026-11-26): "sections have to be cut by the transitions of the level" -- and what a section gets follows what
//   kind of section it is, not a dice roll. Used by tools/autobeat.js (each batch's kinds and icons, AUTO.md "Sections by
//   character"); any builder can call character(music, t0, t1, prev).
const pct = (arr, q) => { const s = arr.slice().sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0; };
// music: {notes:[{t,strength,band}], bars:[{t, heavy, intensity}], impacts:[{t,kind,strength}]}
function character(music, t0, t1, prev) {
  const bars = (music.bars || []).filter(b => b.t >= t0 - 0.01 && b.t < t1);
  const avg = (k, bs) => bs.length ? bs.reduce((a, b) => a + b[k], 0) / bs.length : 0.5;
  const all = music.bars || [];
  const heavy = avg("heavy", bars), inten = avg("intensity", bars);
  const hiI = pct(all.map(b => b.intensity), 0.7), loI = pct(all.map(b => b.intensity), 0.3);
  const hiH = pct(all.map(b => b.heavy), 0.7);
  // the band that leads: most of the strong notes
  const cnt = { low: 0, mid: 0, top: 0 };
  for (const n of music.notes || []) if (n.t >= t0 && n.t < t1 && n.strength >= 0.5) cnt[n.band || "low"]++;
  const tot = cnt.low + cnt.mid + cnt.top || 1, lead = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
  const share = { low: cnt.low / tot, mid: cnt.mid / tot, top: cnt.top / tot };
  // the transition at its start
  const im = (music.impacts || []).filter(i => Math.abs(i.t - t0) <= 0.5).sort((a, b) => b.strength - a.strength)[0];
  // the first half against the second: rising = a build
  const half = (t0 + t1) / 2, a = avg("intensity", bars.filter(b => b.t < half)), b = avg("intensity", bars.filter(b => b.t >= half));
  const dI = prev ? inten - prev.inten : 0, dH = prev ? heavy - prev.heavy : 0;
  // which band came in: the one whose share rose most against the section before
  let entering = null;
  if (prev && prev.share) { let best = 0.08; for (const k of ["low", "mid", "top"]) { const d = share[k] - prev.share[k]; if (d > best) { best = d; entering = k; } } }
  let type;
  if ((im && im.kind === "drop") || (heavy >= hiH && (dH >= 0.12 || dI >= 0.15))) type = "drop";
  else if (inten <= loI || dI < -0.18 || dH <= -0.15) type = "break";
  else if (b - a > 0.2) type = "build";
  else if ((im && im.kind === "entry") || entering) type = "entry";
  else type = "groove";
  return { t0, t1, type, dH: +dH.toFixed(2), lead, entering: entering || (type === "entry" ? lead : null), heavy: +heavy.toFixed(2), inten: +inten.toFixed(2), share,
    impact: im ? im.kind : null, rising: +(b - a).toFixed(2) };
}
module.exports = { character };

if (require.main === module) {
  const song = process.argv[2] || "CantLetGo";
  const j = require("./impacts.js").loadNotes(/^\d+$/.test(song) ? "custom_" + song : "official_" + song);
  const music = { notes: j.notes.map(([t, s, band]) => ({ t, strength: s, band })), bars: j.bars.map(b => ({ t: b[0], heavy: b[2], intensity: b[4] })),
    impacts: j.impacts.map(([t, beat, strength, kind]) => ({ t, beat, strength, kind })) };
  // cut at the transitions, at least 6 s apart (as autobeat's batches)
  const cuts = [0]; for (const im of music.impacts) { const gap = im.t - cuts[cuts.length - 1]; if ((/drop|entry|change/.test(im.kind) && gap >= 6) || (im.strength >= 0.5 && gap > 16)) cuts.push(im.t); }
  const end = j.notes[j.notes.length - 1][0]; cuts.push(end);
  let prev = null;
  for (let i = 0; i + 1 < cuts.length; i++) { const c = character(music, cuts[i], cuts[i + 1], prev); prev = c;
    console.log(`${c.t0.toFixed(1).padStart(5)}-${c.t1.toFixed(1).padEnd(5)} ${c.type.padEnd(6)} lead ${c.lead.padEnd(3)} ${c.entering ? "in:" + c.entering : "     "} heavy ${c.heavy} loud ${c.inten} rising ${c.rising} ${c.impact || ""}`); }
}
