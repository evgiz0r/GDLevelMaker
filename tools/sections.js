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
// the song's notes as character() reads them (knowledge/song_notes via tools/impacts.js), and the cuts: drops, entries and
// changes at least 6 s apart, a strong impact after 16 s without one -- one definition for every builder (autobeat's
// batches, tools/songplan.js for real levels)
function load(song) {
  const j = require("./impacts.js").loadNotes(/^\d+$/.test(String(song)) ? "custom_" + song : "official_" + song);
  const music = { notes: j.notes.map(([t, s, band]) => ({ t, strength: s, band })), bars: j.bars.map(b => ({ t: b[0], heavy: b[2], intensity: b[4] })),
    impacts: j.impacts.map(([t, beat, strength, kind]) => ({ t, beat, strength, kind })) };
  return { j, music, end: j.notes[j.notes.length - 1][0] };
}
// Where the music drops: a bar whose loudness (bars[].intensity, two bars after vs two before) rises by 0.2+ to 0.4+.
// The impact list alone has no "drop" kind on many songs (Hellgate's 42.5 s drop is only a loudness jump), and the old
// first-come cut took any entry 6 s before it and then skipped the drop (Evgeni, 2026-11-28: "in hellgate also on the drops
// we didnt have a transition, it was the middle of a section").
function drops(music) {
  const B = music.bars || [], I = i => (B[i] && B[i].intensity) || 0, out = [];
  for (let i = 2; i + 1 < B.length; i++) { const before = (I(i - 2) + I(i - 1)) / 2, after = (I(i) + I(i + 1)) / 2, rise = after - before;
    if (rise >= 0.2 && after >= 0.4) out.push({ t: B[i].t, kind: "drop", strength: Math.min(1.5, 0.6 + rise * 2), rise }); }
  return out;
}
// The cuts, strongest first (not first come): drops, then entries / changes, then any strong impact; each kept when it is
// 6 s from every kept cut (5 s when either is a drop), so a drop is never lost to a weaker change just before it.
function cuts(music, end) {
  const cand = [...drops(music).map(d => ({ ...d, pri: 2 + d.strength })),
    ...music.impacts.filter(im => /drop|entry|change/.test(im.kind)).map(im => ({ ...im, pri: (im.kind === "drop" ? 2 : 1) + (im.strength || 0) })),
    ...music.impacts.filter(im => !/drop|entry|change/.test(im.kind) && im.strength >= 0.5).map(im => ({ ...im, pri: im.strength, far: true }))]
    .filter(c => c.t > 2 && c.t < end - 3).sort((a, b) => b.pri - a.pri);
  const kept = [{ t: 0, kind: "start" }, { t: end, kind: "end" }];
  for (const c of cand) {
    const ok = kept.every(k => { const gap = Math.abs(k.t - c.t), drop = c.kind === "drop" || k.kind === "drop";
      return gap >= (c.far ? 16 : drop ? 5 : 6) || (k.kind === "start" && gap >= 3); });
    if (ok) kept.push(c);
  }
  return kept.map(k => k.t).sort((a, b) => a - b);
}
// the typed sections between the cuts
function sections(song) { const { j, music, end } = load(song), cs = cuts(music, end), out = []; let prev = null;
  for (let i = 0; i + 1 < cs.length; i++) { prev = character(music, cs[i], cs[i + 1], prev); out.push(prev); }
  return { notes: j, music, cuts: cs, sections: out }; }
module.exports = { character, load, cuts, drops, sections };

if (require.main === module) {
  const song = process.argv[2] || "CantLetGo";
  const { sections: secs } = sections(song);
  for (const c of secs) {
    console.log(`${c.t0.toFixed(1).padStart(5)}-${c.t1.toFixed(1).padEnd(5)} ${c.type.padEnd(6)} lead ${c.lead.padEnd(3)} ${c.entering ? "in:" + c.entering : "     "} heavy ${c.heavy} loud ${c.inten} rising ${c.rising} ${c.impact || ""}`); }
}
