// node tools/autobeat.js [--song Electrodynamix] [--seed 1] [--beats N] [--from-beat B] [--out levels/lab/auto_beat.gdlvl]
//                        [--name "GDLM auto beat"] [--quiet]
//   -> an AUTO level (no click at all) built BEAT-FIRST on an official song: every change of movement fires on a beat.
//      Prints each trigger (beat, kind, how far off the beat it fired) and the measures; writes the .gdlvl with the song set.
//
// The idea (Evgeni, 2026-11-26): "we should plan our change of movement ( pad/portal ) , according to the beat. that way we
// know where to put the "triggers". a trigger could also be "falling" in an auto level, to the beat ... if we place trigger
// by trigger, and follow the path and place the next one ... you need to fill the gap, and play to the next. stacking some
// motifs between those orbs ( like few of these in a row, and then few of these, and then a combination of few of these... )"
//
// How (AUTO.md "Beat-first"):
// 1. The trigger beats: the song's beat grid (viewer/song_grids.js), a trigger every 2 beats, every beat while the song is
//    loud (its sections), every 4 in a breakdown.
// 2. The motifs: triggers come in phrases of 4, phrases in blocks of 3: AAAA, then BBBB, then a mix of the two (ABAB, AABB,
//    ABBA, ABAC). A letter is a KIND of trigger: a yellow / pink / red / blue pad, a gravity portal, a fall (the ledge ends),
//    a mode portal, a speed portal, a size portal, a teleport. The song's big section changes start a new block.
// 3. Trigger by trigger: the zero-press sim says where the player is ON the beat; the trigger goes exactly there (its x tuned
//    by replays until it fires on that tick). A pad needs a surface: on the ground or a ledge, or -- falling -- a ledge is put
//    under the player so it lands on the pad on the beat.
// 4. The gap to the next trigger is filled: a player falling up gets a roof somewhere above (now and then far above: a big
//    fall off the screen), a player falling down sometimes a ledge on the way; a ledge it walks on is carried on to the next
//    trigger. A kind that cannot be placed or kills is replaced by the motif's other letter, then any other kind; a beat
//    where nothing works backtracks one trigger.
// 5. Back home at the end (a wall of cube / normal gravity / normal size / 1x portals), sparse spikes where the path never
//    goes, and a last zero-press run from the start must clear.
// 6. Round 8 (AUTO.md "Rapid runs, pads, bursts, no secret way, the ending"): notes in a RAPID RUN (4+ notes each <= 0.14 s
//    apart) are kept 0.07 s apart (--min-gap is the gap elsewhere) and take the batch's rapid kind (flips, icon toggles, blue
//    pads; every other one a yellow / red pad where it can land); our own speed BURSTS: one speed up for a 10+ note run, one
//    down for a 1.2 s+ hole, at most every 8 s, never near the song's own speed change.
// 7. No secret way: strays() presses (tap and hold) every 30 ticks; a press that neither dies nor is back on the auto run
//    within 5 s gets a saw where it leaves the path.
// 8. The ending every level gets: the auto outro (autobricks.js) + the signature (signature.js), as make.js does.
// 9. Round 9 (opts.shape, default on; AUTO.md): echo phrases, a camera band, slopes, no sinking into blocks, short spider
//    moves, no teleports, a block under every pad.
// 10. Round 10 (opts.hazards, default on): hazards that follow the path, from lib/hazards.js (HAZARDS.md), the stray presses'
//    leaks blocked on the same lane line; saws only for leaks still open after it.
"use strict";
if (require.main === module) require("./heavy.js").claim();
const fs = require("fs"), path = require("path");
const { GD, writeGdlvl } = require("./io.js");
const ROOT = path.join(__dirname, "..");
const TPS = GD.PHYS.TPS, B = 30;
const ID = {
  slope: 1338,
  block: 1, spike: 8, deco: 211,
  yellow: 35, pink: 140, red: 1332, blue: 67,
  gravDown: 11, gravUp: 10, mini: 101, normalSize: 99, tele: 747,
  cube: 12, ship: 13, ball: 47, ufo: 111, wave: 660, robot: 745, spider: 1331, swing: 1933,
  "0.5x": 200, "1x": 201, "2x": 202, "3x": 203,
};
const SPNAME = { 0: "0.5x", 1: "1x", 2: "2x", 3: "3x", 4: "4x" };
const MODES = ["cube", "ship", "ball", "ufo", "wave", "robot", "spider", "swing"];
const PADMODES = new Set(["cube", "ball", "robot", "spider", "ufo"]);
const KINDS = ["yellow", "pink", "red", "blue", "grav", "fall", "step", "slope", "mode", "mini"];   // round 9: teleports out (Evgeni: "too jumpy across screens"), slopes in   // speed: from the music (notePlan), or not at all
// when the motif's kinds do not fit (often: a player in the air can't take a pad), these in turn -- a gravity flip first,
// mode portals and teleports last (as fallbacks they made a third of the triggers: mode spam)
const FALLBACK = ["yellow", "red", "slope", "grav", "blue", "pink", "step", "fall", "mini", "mode"];
const KW = { yellow: 5, pink: 2, red: 4, blue: 3,   // yellow / red up from 3 / 2 (Evgeni, 2026-11-26: "more pads, yellow red")
  grav: 3, fall: 3, mode: 3, speed: 1, mini: 1, tele: 0.8, step: 2.5, slope: 3 };
const LOOK = 36;          // ticks after the next trigger beat the player must still be alive at
const SKY = 1500;         // the far decoration's height: the sky (300 over the highest object) is out of the way

function rng(seed) { let x = (seed * 2654435761) >>> 0 || 1; return () => ((x = (x ^ (x << 13)) >>> 0, x = (x ^ (x >>> 17)) >>> 0, x = (x ^ (x << 5)) >>> 0) / 4294967296); }

// ---------------------------------------------------------------- the song
function loadGrid(song) {
  const w = {};
  new Function("window", fs.readFileSync(path.join(ROOT, "viewer", "song_grids.js"), "utf8"))(w);
  // an official song by name, or a custom (Newgrounds) song by id
  if (/^\d+$/.test(String(song))) {
    const g = w.SONG_GRIDS["/song/custom/" + song + ".mp3"] || w.SONG_GRIDS["/song/custom/" + song + ".ogg"];
    if (!g) throw new Error("no beat grid for custom song " + song);
    return Object.assign({ k45: String(song) }, g);
  }
  const g = w.SONG_GRIDS["/song/official/" + song + ".mp3"];
  if (!g) throw new Error("no beat grid for official song " + song);
  const { OFFICIAL } = require("./beats.js");
  const k8 = OFFICIAL.indexOf(song);
  return Object.assign({ k8 }, g);
}
// the trigger times from the song's NOTES (Evgeni, 2026-11-26: "we are not catching all the little beats ... it feels much
// more empty if we hit like 1/6 of the notes. especially in the faster sections"). notes: [{t, strength 0..1}], intensity:
// [{t, value 0..1}]. Notes closer than `minGap` s merge (the strongest stays); a note is taken when it is strong enough for
// the music's intensity there (loud parts take almost every note, calm ones only the strong), never closer than minGap.
// Speed follows the intensity per 4 beats (Evgeni: "a speed portal ... when the music speeds up, and slowering portals when
// the music speeds down"): 0.5x under 0.12, 1x under 0.45, 2x under 0.8, else 3x, changed only when it holds 3 bars.
// the song's notes as committed by tools/impacts.js (knowledge/song_notes/<key>.json), in notePlan's shape
function musicOf(song) {
  const key = /^\d+$/.test(String(song)) ? "custom_" + song : "official_" + song;
  const j = require("./impacts.js").loadNotes(key);
  if (!j) return null;
  return {
    key, notes: j.notes.map(([t, s, band]) => ({ t, strength: s, band })),
    intensity: (j.bars || []).map(b => ({ t: b[0], value: b[4] })), speedPlan: j.speedPlan || [],
    bars: (j.bars || []).map(b => ({ t: b[0], heavy: b[2], intensity: b[4] })),
    impacts: (j.impacts || []).map(([t, beat, strength, kind]) => ({ t, beat, strength, kind })),
  };
}
function notePlan(g, music, fromBeat, uptoBeat, o = {}) {
  const minGap = o.minGap || 0.17, t0 = g.t0 + fromBeat * g.period, t1 = g.t0 + uptoBeat * g.period;
  const inten = t => { const a = music.intensity; if (!a || !a.length) return 0.5; let best = a[0]; for (const x of a) if (x.t <= t) best = x; else break; return best.value; };
  const merged = [];
  for (const n of music.notes.filter(n => n.t >= t0 && n.t < t1).sort((a, b) => a.t - b.t)) {
    const last = merged[merged.length - 1];
    if (last && n.t - last.t < 0.05) { if (n.strength > last.strength) Object.assign(last, n); continue; }
    merged.push(Object.assign({}, n));
  }
  // RAPID RUNS (Evgeni, 2026-11-26: "in those rapid drum/piano ... we should do very rapid pattern. like very very close, it
  // gives that jiggery effect of the song"): 4+ kept notes each at most 0.14 s from the last (1/16 notes up to ~107 bpm, 1/8
  // up to ~214). Inside one the notes may be o.rapidGap (0.07 s) apart instead of minGap; measured on Geometrical
  // Dominator: 270 of the 407 skipped strong notes were skipped only for the 0.17 s gap, 553 notes sit in 81 such runs.
  const kept = merged.filter(n => n.strength >= Math.min(0.5, 0.65 - 0.9 * inten(n.t)));
  const runOf = new Map(); let runs = 0;
  for (let i = 0, j; i < kept.length; i = j) {
    for (j = i + 1; j < kept.length && kept[j].t - kept[j - 1].t <= 0.14; j++);
    if (j - i >= 4) { runs++; for (let k = i; k < j; k++) runOf.set(kept[k], { id: runs, len: j - i, first: k === i, last: k === j - 1 }); }
  }
  const rapidGap = o.rapidGap || 0.07;
  const out = [];
  for (const n of merged) {
    const I = inten(n.t), need = Math.min(0.5, 0.65 - 0.9 * I);   // intensity 0.7+: every note; else at least the stronger half (a calm intro was 4 s of nothing)
    if (n.strength < need) continue;
    const last = out[out.length - 1], ru = o.rapid !== false && runOf.get(n);
    if (ru && last && n.t - last.t >= rapidGap) { out.push({ t: n.t, strength: n.strength, band: n.band || "low", beat: +((n.t - g.t0) / g.period).toFixed(3), energy: I, rapid: ru }); continue; }
    if (last && n.t - last.t < (ru ? rapidGap : minGap)) { if (n.strength > last.strength + 0.2 && (out.length < 2 || n.t - out[out.length - 2].t >= minGap)) Object.assign(last, { t: n.t, strength: n.strength, beat: (n.t - g.t0) / g.period }); continue; }
    out.push({ t: n.t, strength: n.strength, band: n.band || "low", beat: +((n.t - g.t0) / g.period).toFixed(3), energy: I });
  }
  // the song's hits (accents, drops, entries): a staircase step there (Evgeni: "bit more staircases as a hit in the song")
  for (const im of music.impacts || []) {
    const at = out.find(p => Math.abs(p.t - im.t) <= 0.06);
    if (at && im.strength >= 0.5) at.accent = im.kind;
  }
  // BATCHES (Evgeni, 2026-11-26: "the same beats, music, has the same auto vibe ... assign some specific notes ( drums ,
  // piano , high , low ) as different combinations of portals/speed/icon. and reroll after some seconds, on a transition in
  // the song starting a new batch"): a new batch at the song's transitions -- a drop, a new instrument entering, a section
  // change, a speed change -- at least 6 s apart; with none for 16 s, at the next strong hit.
  const trans = (music.impacts || []).filter(im => /drop|entry|change/.test(im.kind)).map(im => im.t)
    .concat((music.speedPlan || []).map(sp => sp[0])).sort((a, b) => a - b);
  let lastB = -1e9;
  for (const p of out) {
    const isTrans = trans.some(t => Math.abs(t - p.t) <= 0.12) || (p.accent && p.t - lastB > 16);
    if (p === out[0] || (isTrans && p.t - lastB >= 6)) { p.newBatch = true; lastB = p.t; }
  }
  // each batch's CHARACTER (tools/sections.js): drop, break, build, entry, groove -- what kind of transition starts it and what
  // the section is, from heaviness, loudness and which band leads (Evgeni, 2026-11-26: "sections have to be cut by the
  // transitions of the level"); wantAt picks the batch's kinds and icons from it
  if (music.bars && music.bars.length) {
    const starts = out.filter(p => p.newBatch); let prev = null;
    starts.forEach((p, i) => { const t1 = i + 1 < starts.length ? starts[i + 1].t : t1Song(); p.section = require("./sections.js").character(music, p.t, t1, prev); prev = p.section; });
  }
  function t1Song() { return out.length ? out[out.length - 1].t + 0.5 : t1; }
  // the music's own speed plan (tools/impacts.js speedPlan) when it has one
  if (music.speedPlan && music.speedPlan.length) {
    let cur = "1x";
    for (const [t, , sp] of music.speedPlan) {
      if (sp === cur) continue;
      const at = out.find(p => p.t >= t - 0.01 && !p.speedTo);
      if (at) { at.speedTo = sp; at.newBlock = true; cur = sp; }
    }
    return bursts(out, o);
  }
  // else: speed per 4 beats from the intensity, with hysteresis (3 bars)
  const SPEEDS = [[0.12, "0.5x"], [0.45, "1x"], [0.8, "2x"], [2, "3x"]];
  const want = I => SPEEDS.find(([lim]) => I < lim)[1];
  let cur = "1x", cand = null, held = 0;
  for (let b = Math.floor(fromBeat / 4) * 4; b < uptoBeat; b += 4) {
    let I = 0, n = 0; for (let k = 0; k < 4; k++) { I += inten(g.t0 + (b + k) * g.period); n++; }
    const w = want(I / n);
    if (w === cur) { cand = null; held = 0; continue; }
    if (w === cand) held++; else { cand = w; held = 1; }
    if (held >= 3 || (o.quickSpeed && held >= 1)) {
      const at = out.find(p => p.beat >= b - 4);
      if (at && !at.speedTo) { at.speedTo = w; at.newBlock = true; cur = w; }
      cand = null; held = 0;
    }
  }
  return bursts(out, o);
}
// OUR OWN speed changes on top of the song's plan (Evgeni, 2026-11-26: "do we have speed of the song, in order to insert our own
// speed ups and slow downs?"): a long rapid run (o.burstLen, 10+ notes, a second or more of 1/16s) goes one speed up for its
// length and back after it -- a burst, at most every 8 s, never within 3 s of the song's own speed change. And a long
// stretch with no note kept (a held chord, a break: 1.2 s+) slows one step for it.
const UP = { "0.5x": "1x", "1x": "2x", "2x": "3x", "3x": "4x", "4x": "4x" }, DOWN = { "0.5x": "0.5x", "1x": "0.5x", "2x": "1x", "3x": "2x", "4x": "3x" };
function bursts(out, o = {}) {
  if (o.bursts === false) return out;
  const len = o.burstLen || 10;
  let cur = "1x", lastB = -1e9;
  const songAt = out.filter(p => p.speedTo).map(p => p.t);
  const nearSong = t => songAt.some(u => Math.abs(u - t) < 3);
  for (let i = 0; i < out.length; i++) {
    const p = out[i];
    if (p.speedTo) { cur = p.speedTo; continue; }
    if (p.rapid && p.rapid.first && p.rapid.len >= len && p.t - lastB >= 8 && !nearSong(p.t) && UP[cur] !== cur) {
      let j = i + 1; while (j < out.length && out[j].rapid && out[j].rapid.id === p.rapid.id) j++;
      if (j < out.length && !out[j].speedTo) {
        p.speedTo = UP[cur]; p.burst = "up"; out[j].speedTo = cur; out[j].burst = "back"; lastB = p.t; i = j; continue;
      }
    }
    const nx = out[i + 1];
    if (nx && nx.t - p.t >= 1.2 && !nearSong(p.t) && p.t - lastB >= 8 && DOWN[cur] !== cur && i + 2 < out.length && !out[i + 2].speedTo && !nx.speedTo) {
      p.speedTo = DOWN[cur]; p.burst = "slow"; nx.speedTo = cur; nx.burst = "back"; lastB = p.t; i++;
    }
  }
  return out;
}
// the trigger beats: every `step` beats, step from the song's energy (its section changes in loudness)
function triggerBeats(g, from, upto) {
  const marks = new Map((g.sections || []).map(([b, d]) => [b, d]));
  let e = 1, out = [], b = from;
  const energyAt = k => { let E = 1; for (const [sb, d] of g.sections || []) if (sb <= k) E = Math.max(0, Math.min(2, E + (d > 0 ? 1 : -1))); return E; };
  while (b < upto) {
    e = energyAt(b);
    const big = [...marks.keys()].some(sb => sb === b && Math.abs(marks.get(sb)) >= 3);
    out.push({ beat: b, energy: e, newBlock: big });
    const step = [4, 2, 1][e];
    // keep phrase starts on even beats when the step is 2 or 4
    b += step;
  }
  return out;
}

// ---------------------------------------------------------------- the level and its zero-press run
function levelString(objs, segs, extra = []) {
  // the trigger objects first, the ledges' blocks after: an appended trigger keeps every earlier object's index, so a run
  // can go on from a saved state of the run before (s.used holds world indices)
  const parts = [];
  for (const o of objs.concat(extra)) parts.push(`1,${o.id},2,${o.x.toFixed(2)},3,${o.y}` + (o.flipY ? ",5,1" : "") + (o.flipX ? ",4,1" : "") + (o.rot ? ",6," + o.rot : "") + (o.off ? ",54," + o.off : ""));
  for (const sg of segs) {
    const y = sg.dir > 0 ? sg.H - 15 : sg.H + 15;
    for (let x = sg.x0 + 15; x < sg.x1 - 15 + 0.01; x += 30) parts.push(`1,1,2,${x.toFixed(2)},3,${y}`);
    const last = sg.x1 - 15;
    if ((last - sg.x0 - 15) % 30 > 0.01) parts.push(`1,1,2,${last.toFixed(2)},3,${y}`);
  }
  return GD.DEFAULT_HEADER + ";" + parts.join(";") + ";";
}
// from: { base: an earlier run, at: tick } -- go on from base's last saved state at or before `at` (everything the change
// touches lies ahead of the player there), instead of from the start: the builder's runs stay short on long songs.
const CK = 120;
function run(objs, segs, upto, farX, from) {
  const str = levelString(objs, segs, [{ id: ID.deco, x: farX, y: SKY }]);
  const lv = GD.parseLevel(str), w = GD.makeWorld(lv.objects, lv.header);
  let s, p, cks;
  const ck = from && from.base.cks ? Math.floor(Math.max(0, Math.min(from.at, from.base.p.length - 1)) / CK) * CK : -1;
  if (ck > 0 && from.base.cks.has(ck)) {
    s = structuredClone(from.base.cks.get(ck)); p = from.base.p.slice(0, ck + 1);
    cks = new Map([...from.base.cks].filter(([t]) => t <= ck));
  } else { s = GD.startState(w); p = [snap(s)]; cks = new Map(); }
  while (!s.dead && !s.done && s.tick < upto) {
    GD.step(w, s, { press: false, held: false }); p.push(snap(s));
    if (s.tick % CK === 0) cks.set(s.tick, structuredClone(s));
  }
  return { p, dead: s.dead, why: s.why, done: s.done, cks };
}
const snap = s => ({ x: s.x, y: s.y, vy: s.vy, grav: s.grav, mode: s.mode, sp: s.sp, mini: !!s.mini, g: !!s.grounded, dead: s.dead });
const same = (a, b) => a && b && Math.abs(a.y - b.y) < 0.01 && Math.abs(a.vy - b.vy) < 0.01 && a.grav === b.grav && a.mode === b.mode && a.sp === b.sp && a.mini === b.mini && Math.abs(a.x - b.x) < 0.01;
// the first tick from `from` where two runs part
function diverge(p, q, from) { for (let t = Math.max(0, from); t < Math.min(p.length, q.length); t++) if (!same(p[t], q[t])) return t; return -1; }
const half = s => s.mini ? 9 : 15;
const REJ = { band: 0, spider: 0, clip: 0 };   // round 9's rejections, for the measures
// does the player's drawn box sink into a ledge / roof row by more than `depth` units, ticks a..b (round 9)
function clips(p, segs, a, b, depth = 4) {
  for (let t = a; t <= b && t < p.length; t++) {
    const s = p[t], h = half(s);
    for (const sg of segs) {
      if (s.x + h < sg.x0 || s.x - h > sg.x1) continue;
      const lo = sg.dir > 0 ? sg.H - B : sg.H, hi = lo + B;
      const ox = Math.min(s.x + h, sg.x1) - Math.max(s.x - h, sg.x0), oy = Math.min(s.y + h, hi) - Math.max(s.y - h, lo);
      if (ox > depth && oy > depth) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------- the kinds: where each goes, given the state on the beat
// each returns null (cannot go here) or { tune: fn(dx) -> {objs, segs}, dx0, label }
function segUnder(segs, s) {
  const bottom = s.grav > 0 ? s.y - half(s) : s.y + half(s);
  return segs.find(sg => sg.dir === s.grav && Math.abs(sg.H - bottom) < 2 && sg.x0 <= s.x + 15 && sg.x1 >= s.x - 15);
}
function surfaceOf(s) { return s.grav > 0 ? Math.round((s.y - half(s)) / B) * B : Math.round((s.y + half(s)) / B) * B; }
const KIND = {
  pad(color, s, st) {
    if (!PADMODES.has(s.mode)) return null;
    const towards = s.vy * s.grav < -0.5;   // falling towards its floor (or roof, upside down)
    if (!s.g && !towards) return null;
    let H, newSeg = null;
    if (s.g) H = surfaceOf(s);
    else {
      H = s.grav > 0 ? Math.floor((s.y - half(s) - 2) / B) * B : Math.ceil((s.y + half(s) + 2) / B) * B;
      if (s.grav > 0 && H < B) H = 0;
      if (H !== 0) newSeg = { H, dir: s.grav, x0: Math.floor((s.x - 40) / B) * B, x1: Math.floor((s.x + 50) / B) * B + B, tag: "catch" };
    }
    if (s.grav < 0 && !s.g && !newSeg) return null;
    const y = s.grav > 0 ? H + 15 : H - 15;
    return {
      label: color + " pad", dx0: 14,
      tune: dx => ({ objs: [{ id: ID[color], x: s.x + dx, y, flipY: s.grav < 0, kind: color }], segs: newSeg ? [newSeg] : [] }),
    };
  },
  grav(s) {
    const id = s.grav > 0 ? ID.gravDown : ID.gravUp;
    return { label: s.grav > 0 ? "gravity down" : "gravity up", dx0: 22, tune: dx => ({ objs: [{ id, x: s.x + dx, y: s.y, kind: "grav" }], segs: [] }) };
  },
  fall(s, st) {
    if (!s.g) return null;
    const sg = segUnder(st.segs, s);
    if (!sg) return null;
    return { label: s.grav > 0 ? "fall" : "fall up", dx0: 15, cut: sg, tune: dx => ({ objs: [], segs: [], cutAt: s.x + dx }) };
  },
  // a staircase step: the ledge ends on the note and goes on one (or two) rows lower -- or higher, under a roof upside down
  step(s, st) {
    if (!s.g && s.vy * s.grav < -0.5 && PADMODES.has(s.mode)) {
      // in the air, coming down: the stair it lands on, on the note (then the next hits step down from it)
      const H = s.grav > 0 ? Math.floor((s.y - half(s) - 2) / B) * B : Math.ceil((s.y + half(s) + 2) / B) * B;
      if (s.grav > 0 && H < 2 * B) return null;
      return { label: "land on a stair", dx0: 0, tune: dx => ({ objs: [], segs: [{ H, dir: s.grav, x0: Math.floor((s.x + dx - 40) / B) * B, x1: Math.floor((s.x + dx + 240) / B) * B, tag: "stair" }] }) };
    }
    if (!s.g) return null;
    const sg = segUnder(st.segs, s);
    if (!sg) return null;
    const rows = st.r() < 0.75 ? 1 : 2, H = sg.H - s.grav * rows * B;
    if (s.grav > 0 && H < 0) return null;
    return {
      label: "step " + (s.grav > 0 ? "down" : "up"), dx0: 15, cut: sg,
      tune: dx => ({ objs: [], cutAt: s.x + dx, segs: H === 0 ? [] : [{ H, dir: s.grav, x0: s.x + dx, x1: s.x + dx + 240, tag: "step" }] }),
    };
  },
  // a SLOPE (Evgeni, 2026-11-26: "no slopes at all, a slope could count as a jump in a way as it has a similar effect"): the
  // ledge (or the ground) ends on the note in a 45-degree slope, 1 or 2 rows up or down, and goes on from its other end
  slope(s, st) {
    if (s.grav < 0 || !PADMODES.has(s.mode)) return null;
    if (!s.g) {
      // OFF until the sim is checked (opts.airSlopes): GDLM auto beat v6 in the game (probe log 2026-11-26) matched the sim
      // tick for tick for 10 s, then a cube falling onto a rising slope LANDED in the game (vy -> 0, then 3.09) while the sim
      // threw it up at once (5.77, 7.41); he died 5 s later. Reported to the physics thread.
      if (!st.airSlopes) return null;
      // in the air coming down: it lands ON a slope on the note (most of an auto is in the air: 40 of 627 notes found the
      // player on the ground) -- a slope down it runs off, or a slope up that throws it on
      if (s.vy > -0.5) return null;
      // the slope's row holds the player's foot at the note, and it sits so that its surface is right under the foot there
      const foot = s.y - half(s), H = Math.ceil(foot / B) * B;
      if (H < 2 * B) return null;
      const up = st.r() < 0.5;
      return { label: "land on a slope " + (up ? "up" : "down"), dx0: up ? -(foot - H + B) : -(H - foot), tune: dx => {
        const x0 = s.x + dx;
        return { objs: [{ id: ID.slope, x: x0 + 15, y: H - 15, flipX: !up, kind: "slope" }],
          segs: [{ H: up ? H : H - B, dir: 1, x0: x0 + B, x1: x0 + B + 240, tag: "slope" }] };
      } };
    }
    const sg = segUnder(st.segs, s), H = sg ? sg.H : surfaceOf(s);
    if (!sg && H !== 0) return null;
    const rows = st.r() < 0.7 ? 1 : 2, up = H === 0 || H >= 7 * B ? H < 7 * B : st.r() < 0.5;
    if (!up && H - rows * B < 0) return null;
    const H2 = H + (up ? 1 : -1) * rows * B;
    return {
      label: "slope " + (up ? "up" : "down") + (rows > 1 ? " 2" : ""), dx0: 16, cut: sg,
      tune: dx => {
        const x0 = Math.round((s.x + dx) / 3) * 3, objs = [];
        for (let k = 0; k < rows; k++) objs.push({ id: ID.slope, x: x0 + 15 + k * B, y: up ? H + 15 + k * B : H - 15 - k * B, flipX: !up, kind: "slope" });
        return { objs, cutAt: sg ? x0 : null, segs: H2 === 0 ? [] : [{ H: H2, dir: 1, x0: x0 + rows * B, x1: x0 + rows * B + 240, tag: "slope" }] };
      },
    };
  },
  mode(s, st) {
    // a batch's icons: its first one when the batch starts (st.modeTo), else the other one of the two
    let m = st.modeTo;
    if (m && m === s.mode) return null;
    if (!m) {
      const icons = (st.icons || []).filter(x => x !== s.mode);
      const opts = icons.length ? icons : MODES.filter(x => x !== s.mode && !(st.lastMode && x === st.lastMode));
      m = opts[Math.floor(st.r() * opts.length)];
    }
    // on the ground a mode portal alone changes no movement: it comes with a gravity flip there (a GD classic)
    const flip = s.g ? [{ id: s.grav > 0 ? ID.gravDown : ID.gravUp, dx: 0 }] : [];
    return { label: m + " portal" + (flip.length ? " + flip" : ""), dx0: 22, tune: dx => ({ objs: [{ id: ID[m], x: s.x + dx, y: Math.max(45, s.y), kind: "mode" }].concat(flip.map(f => ({ id: f.id, x: s.x + dx, y: Math.max(45, s.y), kind: "grav" }))), segs: [] }) };
  },
  speed(s, st) {
    const cur = SPNAME[s.sp] || "1x", opts = ["1x", "2x", "2x", "3x", "0.5x"].filter(v => v !== cur);
    if (st.speedTo && st.speedTo === cur) return null;
    const v = st.speedTo || opts[Math.floor(st.r() * opts.length)];
    return { label: v + " speed", dx0: 22, tune: dx => ({ objs: [{ id: ID[v], x: s.x + dx, y: Math.max(45, s.y), kind: "speed" }], segs: [] }) };
  },
  mini(s) {
    const id = s.mini ? ID.normalSize : ID.mini;
    return { label: s.mini ? "normal size" : "mini portal", dx0: 22, tune: dx => ({ objs: [{ id, x: s.x + dx, y: Math.max(45, s.y), kind: "mini" }], segs: [] }) };
  },
  tele(s, st) {
    const rows = 4 + Math.floor(st.r() * 7), up = s.grav > 0 ? (s.y < 200 || st.r() < 0.6) : st.r() < 0.4;
    let off = (up ? 1 : -1) * rows * B;
    if (s.y + off < 60) off = rows * B;
    return { label: "teleport " + (off > 0 ? "up " : "down ") + Math.abs(off / B), dx0: 10, tune: dx => ({ objs: [{ id: ID.tele, x: s.x + dx, y: s.y, off, kind: "tele" }], segs: [] }) };
  },
};
function kindAt(kind, s, st) {
  if (["yellow", "pink", "red", "blue"].includes(kind)) return KIND.pad(kind, s, st);
  return KIND[kind](s, st);
}

// ---------------------------------------------------------------- no secret way: a press anywhere dies or comes back
// Evgeni (2026-11-26): "how to block the path, so that the auto is the path i take (and not some secret way that i fly away
// ...) basically anything besides our path should be blocked". An auto level can still be pressed: a press may jump over a
// portal and leave the level's path for good. strays() presses at every `every` ticks of the zero-press run -- a tap (one
// tick) and a hold (`hold` ticks) -- and follows the run for `follow` ticks (5 s: at 1.5 s 137 of 1550 presses on Geometrical Dominator were not back yet, at 5 s 7): it is fine when it dies or is back in the auto
// run's exact state; else it is a LEAK, with the stray's path. block() puts a saw (89, r 21.6) on each leak where it first
// strays 2 blocks off the auto path, never within 45 units of the auto path, and keeps it only while the auto run clears.
const SAW = 89;
function strays(objs, segs, fin, o = {}) {
  const every = o.every || 30, follow = o.follow || 1200, hold = o.hold || 48, upto = o.uptoX || Infinity;
  const str = levelString(objs, segs, [{ id: ID.deco, x: (o.farX || 1e5), y: SKY }]), lv = GD.parseLevel(str), w = GD.makeWorld(lv.objects, lv.header);
  const P = fin.p, leaks = [];
  let checked = 0;
  for (let t0 = every; t0 < P.length - 2; t0 += every) {
    if (P[t0].x > upto) break;
    const ck = Math.floor(t0 / CK) * CK;
    if (!fin.cks.has(ck) && ck > 0) continue;
    for (const len of [1, hold]) {
      const s = ck > 0 ? structuredClone(fin.cks.get(ck)) : GD.startState(w);
      while (s.tick < t0) GD.step(w, s, { press: false, held: false });
      const path = [];
      let fate = "leak";
      for (let k = 0; k < follow; k++) {
        const down = k < len;
        GD.step(w, s, { press: k === 0, held: down });
        if (s.dead) { fate = "dies"; break; }
        if (s.done) { fate = "end"; break; }
        const a = P[s.tick];
        if (!a) { fate = "end"; break; }
        if (!down && same(snap(s), a)) { fate = k === 0 ? "nothing" : "back"; break; }
        path.push({ t: s.tick, x: s.x, y: s.y });
      }
      checked++;
      if (fate === "leak") leaks.push({ t0, len, path });
    }
  }
  return { checked, leaks };
}
// where to block a leak: the first point of its path 1.5+ blocks from the auto run at that x, with 45 units clear of it
function blockSpot(leak, P, idxOfX) {
  for (const q of leak.path) {
    const i = idxOfX(q.x); if (i < 0) continue;
    if (Math.abs(P[i].y - q.y) < 45) continue;
    let ok = true;
    for (let j = Math.max(0, i - 40); j < Math.min(P.length, i + 40) && ok; j++) if (Math.abs(P[j].x - q.x) < 45 && Math.abs(P[j].y - q.y) < 45) ok = false;
    if (ok) return { id: SAW, x: +q.x.toFixed(1), y: Math.round(q.y), kind: "block" };
  }
  return null;
}

// ---------------------------------------------------------------- a batch from its section's character (AUTO.md "Sections by character")
// drop: the heavy part -- big pads (red on the low notes, yellow on the mid), blue pads on the top, punchy landing icons;
// break: the calm part -- a flight (ship / swing / ufo), gentle kinds (gravity, mini, icons);
// build: rising -- stairs and slopes climbing, pink pads on the top;
// entry: an instrument comes in -- the batch before goes on, and the band that came in gets a new, visible kind;
// groove: more of the same -- the batch before goes on with one new icon.
const LANDK = ["yellow", "pink", "red", "blue", "step", "fall"];
function sectionBatch(c, prev, r, t) {
  const pickOf = arr => arr[Math.floor(r() * arr.length)];
  const landIcons = ["cube", "ball", "robot", "spider", "ufo"];
  let low, mid, top, icons, fly = false, rapid;
  const fresh = (not, from) => pickOf(from.filter(k => !not.includes(k))) || from[0];
  if (c.type === "drop") { low = "red"; mid = "yellow"; top = "blue"; icons = ["robot", "ball"].sort(() => r() - 0.5); rapid = "blue"; }
  else if (c.type === "break") { fly = true; low = "grav"; mid = "mini"; top = "mode"; icons = ["ship", "ufo"]; rapid = "grav"; }   // swing: not yet checked in the game
  else if (c.type === "build") { low = "step"; mid = c.lead === "top" ? "pink" : "slope"; top = mid === "pink" ? "slope" : "pink"; icons = [pickOf(["cube", "ufo"]), pickOf(["ball", "robot"])]; rapid = "mode"; }
  else if (prev && (c.type === "entry" || c.type === "groove")) {
    ({ low, mid, top, fly, rapid } = prev); icons = prev.icons.slice();
    const band = c.type === "entry" ? (c.entering || c.lead) : null;
    if (band) {   // the band that came in gets a new kind, one the batch does not use yet; pads when it lands
      const pool = fly ? ["grav", "mode", "mini", "slope"] : ["yellow", "red", "pink", "blue", "step", "grav", "mode"];
      const k = fresh([low, mid, top], pool); if (band === "low") low = k; else if (band === "mid") mid = k; else top = k;
    }
    // one new icon (the second one), of the kind the batch can use
    const can = fly ? ["ship", "ufo", "wave"] : landIcons;
    icons[1] = fresh(icons, can);
  } else { low = "yellow"; mid = "grav"; top = "mode"; icons = ["cube", "ufo"]; rapid = "grav"; }
  const lands = [low, mid, top].some(k => LANDK.includes(k));
  if (lands) { fly = false; icons = icons.map((m, i) => landIcons.includes(m) ? m : (i === 0 ? "cube" : fresh(icons, landIcons))); }
  if (!fly && ![low, mid, top].some(k => k === "yellow" || k === "red")) top = "yellow";
  return { low, mid, top, icons, t, first: true, fly, rapid, section: c.type };
}

// ---------------------------------------------------------------- the builder
function build(opts = {}) {
  REJ.band = REJ.spider = REJ.clip = 0;
  const song = opts.song || "Electrodynamix", seed = opts.seed || 1, r = rng(seed);
  const g = loadGrid(song);
  const tickOf = b => Math.round((g.t0 + b * g.period) * TPS);
  const lastBeat = Math.min(g.beats - 6, opts.beats != null ? (opts.from || 4) + opts.beats : g.beats - 6);
  if (opts.music === undefined) opts.music = musicOf(song);   // the song's notes when they are measured, else the beat grid
  const plan = opts.music ? notePlan(g, opts.music, opts.from || 4, lastBeat, opts) : triggerBeats(g, opts.from || 4, lastBeat);
  const st = { objs: [], segs: [], r, lastMode: null, airSlopes: !!opts.airSlopes };
  const farX = () => 20000 + (plan.length ? 0 : 0);   // far enough for any song at 3x: replaced by the real end at the end
  const FAR = 400 * B * 4;
  const placed = [];            // per trigger: {beat, tick, kind, label, fired, off}
  // motifs: blocks of 3 phrases of 4 -- AAAA, BBBB, a mix
  const MIX = ["ABAB", "AABB", "ABBA", "ABAC", "AABA"];
  const pick = (not) => { const ks = KINDS.filter(k => !not.includes(k)); let tot = ks.reduce((a, k) => a + KW[k], 0), x = r() * tot; for (const k of ks) { x -= KW[k]; if (x <= 0) return k; } return ks[ks.length - 1]; };
  let letters = {}, pattern = "", block = 0, posInBlock = 0;
  const motifLog = [];
  let batch = null;
  function wantAt(i) {
    const p = plan[i];
    if (opts.music && p.band) {
      // the batch: a kind for each band (low = kick / bass, mid = snare / keys, top = hats / high notes), two icons (modes)
      if (!batch || p.newBatch) {
        if (opts.sections !== false && p.section) { batch = sectionBatch(p.section, batch, r, p.t); motifLog.push(`${p.t.toFixed(1)} s: ${p.section.type}${p.section.entering ? " (" + p.section.entering + " in)" : ""}, lead ${p.section.lead}: low=${batch.low} mid=${batch.mid} top=${batch.top} rapid=${batch.rapid} icons=${batch.icons.join("/")}`); }
        else {
        const used = batch ? [batch.low, batch.mid, batch.top] : [];
        // now and then a FLIGHT batch: portals only, so the icons can be ship / wave / swing too
        const fly = batch && !batch.fly && r() < 0.4, landK = ["yellow", "pink", "red", "blue", "step", "fall"];
        const pk = not => pick(fly ? not.concat(landK) : not);
        let low = pk(used.concat("tele")), mid = pk([low, ...used]), top = pk([low, mid]);
        // a landing batch always has a yellow or red pad on one band (Evgeni, 2026-11-26: "more pads, yellow red")
        if (!fly && ![low, mid, top].some(k => k === "yellow" || k === "red")) { const pad = r() < 0.55 ? "yellow" : "red"; if (r() < 0.5) mid = pad; else top = pad; }
        // icons that the batch's kinds work in: pads, stairs and falls want a mode that lands (cube, ball, robot, spider, ufo);
        // a batch of portals only may fly (ship, wave, swing too)
        const lands = [low, mid, top].some(k => ["yellow", "pink", "red", "blue", "step", "fall"].includes(k));
        const ic = MODES.filter(m => !(batch && batch.icons.includes(m)) && (!lands || PADMODES.has(m))).sort(() => r() - 0.5).slice(0, 2);
        if (fly) { ic[0] = ["ship", "wave", "swing"][Math.floor(r() * 3)]; if (ic[1] === ic[0]) ic[1] = MODES.find(m => m !== ic[0] && !(batch && batch.icons.includes(m))); }
        // the batch's RAPID kind, for the very close notes of a fast run: flips (the player wiggles up and down), the two
        // icons in turn, or blue pads (bouncing floor <-> roof) when it lands
        const rapid = fly ? (r() < 0.6 ? "grav" : "mode") : (r() < 0.5 ? "grav" : r() < 0.6 ? "blue" : "mode");
        batch = { low, mid, top, icons: ic, t: p.t, first: true, fly, rapid };
        motifLog.push(`${p.t.toFixed(1)} s: low=${low} mid=${mid} top=${top} rapid=${rapid} icons=${ic.join("/")}`);
        }
      }
      // ECHO (round 9, Evgeni: "it feels very random"): phrases of 16 beats come in pairs, call and response; a note of the
      // response wants what the call did on the same 16th of its phrase, so a repeated bar of music draws a repeated shape
      if (opts.shape !== false && !p.newBatch) {
        const ph = Math.floor((p.beat - (opts.from || 4)) / 16), pos = Math.round(((p.beat - (opts.from || 4)) % 16) * 4);
        if (ph % 2 === 1) {
          for (let q = placed.length - 1; q >= 0 && q > placed.length - 200; q--) {
            const e = placed[q], eph = Math.floor((e.beat - (opts.from || 4)) / 16);
            if (eph < ph - 1) break;
            if (eph === ph - 1 && Math.round(((e.beat - (opts.from || 4)) % 16) * 4) === pos && e.kind !== "none" && e.kind !== "speed") return { want: e.kind, others: [batch.low, batch.mid, batch.top].filter(k => k !== e.kind), batch, echo: true };
          }
        }
      }
      if (p.rapid && !p.accent) return { want: batch.rapid, others: ["grav", "mode", "blue"].filter(k => k !== batch.rapid), batch, rapid: true };
      const want = p.accent ? (opts.shape !== false && r() < 0.5 ? "slope" : "step") : batch[p.band] || batch.low;
      return { want, others: [batch.low, batch.mid, batch.top].filter(k => k !== want), batch };
    }
    if (i === 0 || p.newBlock || posInBlock >= 12) {
      posInBlock = 0; block++;
      const A = pick([letters.A, letters.B, "tele"].filter(Boolean));   // never four teleports in a row: they read as the player jumping about
      // a mode change at least every other block (Evgeni: "auto doesnt have to be cube"), a fall in every block where it fits
      let Bk = !Object.values(letters).includes("mode") && A !== "mode" ? "mode" : pick([A]);
      const C = A !== "fall" && Bk !== "fall" && r() < 0.6 ? "fall" : pick([A, Bk]);
      letters = { A, B: Bk, C };
    }
    const phrase = Math.floor(posInBlock / 4), j = posInBlock % 4;
    if (j === 0) { pattern = phrase === 0 ? "AAAA" : phrase === 1 ? "BBBB" : MIX[Math.floor(r() * MIX.length)]; motifLog.push(`${pattern.replace(/./g, c => c)}=${pattern.split("").map(c => letters[c]).join(",")}`); }
    posInBlock++;
    const L = pattern[j];
    return { want: letters[L], others: Object.values(letters).filter(k => k !== letters[L]) };
  }
  // the committed run, long enough to see past trigger i
  let base = run(st.objs, st.segs, tickOf(plan[0].beat) + LOOK + 4, FAR);
  const horizon = i => i + 1 < plan.length ? tickOf(plan[i + 1].beat) + LOOK : tickOf(plan[i].beat) + 240;
  const nextLead = (i, p, t) => {   // x the player will be at by trigger i+2 (or i+1 at the end), for carrying ledges on
    const t2 = i + 2 < plan.length ? tickOf(plan[i + 2].beat) : t + 240;
    const s = p[Math.min(t, p.length - 1)], v = p[Math.min(t, p.length - 1)].x - p[Math.max(0, Math.min(t, p.length - 1) - 1)].x || 1.3;
    return s.x + v * (t2 - t) + 60;
  };
  // fill the gap after a candidate: roofs for a player falling up, ledges now and then on the way down, ledges carried on.
  function fillGap(objs, segs, i, from) {
    const upto = horizon(i), R = () => run(objs, segs, upto, FAR, { base, at: from - 61 });
    let res = R();
    for (let round = 0; round < 6; round++) {
      const p = res.p;
      // a player falling up: the roof goes where it has risen by `rise`
      let phaseY = null, fix = null;
      for (let t = from; t < p.length; t++) {
        const s = p[t];
        if (s.grav > 0 && !s.g && s.vy < 0) {
          // falling down from high up: now and then a ledge on the way (a step to fall off later), not always the ground
          if (segs.ledgeFor == null) segs.ledgeFor = r() < (batch && Object.values(batch).includes("step") ? 0.85 : 0.45) ? 2 + Math.floor(r() * 3) : 0;   // a batch with steps wants ledges to step off
          const bottom = s.y - half(s), H = Math.floor((s.y + 0.5 * s.vy * 0 - half(s)) / B) * B;
          if (segs.ledgeFor && t > from && p[t - 1].vy >= 0 && bottom > (segs.ledgeFor + 2) * B) segs.ledgeAt = Math.floor((bottom - segs.ledgeFor * B) / B) * B;
          if (segs.ledgeAt && bottom <= segs.ledgeAt + 3 && p[t - 1].y - half(s) > segs.ledgeAt + 3) {
            fix = { H: segs.ledgeAt, dir: 1, x0: Math.floor((s.x - 20) / B) * B, x1: Math.ceil(nextLead(i, p, Math.min(upto, p.length - 1)) / B) * B, tag: "ledge" };
            segs.ledgeAt = 0; segs.ledgeFor = 0; break;
          }
        }
        if (s.g || s.grav > 0) { phaseY = null; continue; }
        if (phaseY == null) phaseY = s.y;
        // round 9 (the camera band): a big rise (14-25 rows) only where a new batch starts -- a section change on a strong hit
        const bigOK = opts.shape === false || (plan[i] && plan[i].newBatch);
        const rise = segs.riseFor || (segs.riseFor = (bigOK && r() < 0.5 ? 14 + Math.floor(r() * 12) : 3 + Math.floor(r() * (opts.shape === false ? 6 : 4))) * B);
        if (s.vy > 0 && (s.y - phaseY >= rise || s.y > SKY + 200)) {
          const H = Math.ceil((s.y + half(s) + 1) / B) * B;
          fix = { H, dir: -1, x0: Math.floor((s.x - 20) / B) * B, x1: Math.ceil(nextLead(i, p, Math.min(upto, p.length - 1)) / B) * B, tag: "roof" };
          break;
        }
      }
      // carried on: a ledge the player stands on at the next trigger beat runs on to the one after
      if (!fix && !res.dead) {
        const t1 = Math.min(i + 1 < plan.length ? tickOf(plan[i + 1].beat) : upto, p.length - 1), s = p[t1];
        if (s.g) {
          const sg = segUnder(segs, s), need = nextLead(i, p, t1);
          if (sg && sg.x1 < need) { sg.x1 = Math.ceil(need / B) * B; res = R(); continue; }
        }
      }
      if (!fix) break;
      segs.push(fix); res = R();
    }
    return res;
  }
  const cloneSegs = segs => segs.map(sg => Object.assign({}, sg));
  const tried = plan.map(() => new Set());
  const history = [];   // to backtrack: snapshots before each trigger
  for (let i = 0; i < plan.length; i++) {
    const tb = tickOf(plan[i].beat);
    if (base.p.length <= tb + LOOK) base = run(st.objs, st.segs, horizon(i), FAR, { base, at: base.p.length - 2 });
    const s = base.p[tb];
    if (!s || s.dead) throw new Error("the committed run is dead before beat " + plan[i].beat);
    const { want, others } = history.length === i ? wantAt(i) : history[i].want;
    // the music's speed changes here: the speed portal first (it moves nothing by itself, so no motion rule for it)
    st.speedTo = plan[i].speedTo || null;
    const bt = (history.length === i ? null : null) || batch;
    st.icons = bt ? bt.icons : null;
    // a new batch starts in its own icon: a mode portal first (unless the music's speed changes right here)
    st.modeTo = !st.speedTo && bt && bt.first && base.p[tb] && base.p[tb].mode !== bt.icons[0] ? bt.icons[0] : null;
    let order = st.speedTo ? ["speed"] : st.modeTo ? ["mode", want, ...FALLBACK] : [want, ...others.filter(k => k !== want), ...FALLBACK.filter(k => k !== want && !others.includes(k))];
    // in a rapid run on a landing batch every other note is a yellow or red pad where the player comes down onto something
    // (flip, pad, flip, pad: the jiggle) -- the pads say no by themselves where it cannot land
    if (plan[i].rapid && bt && !bt.fly && !st.speedTo && !st.modeTo && (i % 2 === 1)) { const pd = r() < 0.55 ? "yellow" : "red"; order = [pd, pd === "yellow" ? "red" : "yellow", ...order.filter(k => k !== "yellow" && k !== "red")]; }
    let best = null;
    for (const kind of order) {
      if (tried[i].has(kind)) continue;
      if (kind === "mode" && st.modeRun >= 3 && !plan[i].rapid) continue;   // a rapid run may toggle the icons note after note
      const k = kindAt(kind, s, st);
      if (!k) continue;
      // tune dx so it fires on the beat tick
      let dx = k.dx0, got = null;
      for (let it = 0; it < 4; it++) {
        const c = k.tune(dx);
        const segs = cloneSegs(st.segs).concat(c.segs);
        if (c.cutAt != null && k.cut) { const sg = segs.find(q => q.x0 === k.cut.x0 && q.H === k.cut.H && q.dir === k.cut.dir); sg.x1 = c.cutAt; }
        const objs = st.objs.concat(c.objs);
        const res = run(objs, segs, tb + 90, FAR, { base, at: tb - 61 });
        const f = diverge(res.p, base.p, tb - 60);
        if (f < 0) break;   // it never changes the run: not this kind here
        const err = f - tb;
        if (!got || Math.abs(err) < Math.abs(got.err)) got = { dx, err, c };
        if (err === 0) break;
        const v = (base.p[tb + 1].x - base.p[tb].x) || 1;
        dx -= err * v;
      }
      if (!got || Math.abs(got.err) > 8) continue;
      // fill the gap and play to the next trigger
      const segs = cloneSegs(st.segs).concat(got.c.segs);
      if (got.c.cutAt != null && k.cut) { const sg = segs.find(q => q.x0 === k.cut.x0 && q.H === k.cut.H && q.dir === k.cut.dir); sg.x1 = got.c.cutAt; }
      const objs = st.objs.concat(got.c.objs);
      const res = fillGap(objs, segs, i, tb);
      if (res.dead || res.done) continue;
      // it must MOVE the player: a portal that only changes the mode of a player walking on flat ground is no change of
      // movement (seed 4's first try walked half a minute that way)
      // With notes close together the next trigger comes quickly: then it is enough that the vertical speed turned.
      if (kind !== "speed" && !(kind === "mode" && st.modeTo)) { const t1 = Math.min(i + 1 < plan.length ? tickOf(plan[i + 1].beat) : tb + 120, res.p.length - 1); let dy = 0;
        for (let t = tb; t <= t1; t++) dy = Math.max(dy, Math.abs(res.p[t].y - base.p[Math.min(t, base.p.length - 1)].y));
        const tq = Math.min(tb + 10, res.p.length - 1), dvy = Math.abs(res.p[tq].vy - base.p[Math.min(tq, base.p.length - 1)].vy);
        if (dy < Math.min(B, 0.25 * (t1 - tb)) && dvy < 2) continue; }
      const end = res.p[res.p.length - 1];
      if (end.y > SKY + 300) continue;
      if (opts.shape !== false) {
        const t1 = Math.min(i + 1 < plan.length ? tickOf(plan[i + 1].beat) : tb + 120, res.p.length - 1);
        // the CAMERA BAND: within a batch the path never climbs more than 12 rows over the band's floor (the GD camera shows
        // ~10 blocks); it may come down (the band follows it down), and a new batch may move it up: big rises belong to section changes
        if (!plan[i].newBatch && st.band != null) { let out = false; for (let t = tb; t <= t1 && !out; t++) if (res.p[t].y > st.band + (opts.bandRows || 14) * B) out = true; if (out) { REJ.band++; continue; } }
        // SPIDER only across short gaps (Evgeni: "for spider portals - only to very small distance"): 4 rows at most
        if (s.mode === "spider" || res.p[Math.min(tb + 2, t1)].mode === "spider") { let mx = 0; for (let t = tb; t <= t1; t++) mx = Math.max(mx, Math.abs(res.p[t].y - s.y)); if (mx > 4 * B) { REJ.spider++; continue; } }
        // NOT INSIDE THE BLOCKS (Evgeni: "does janky movement somewhat within the block ... fine with hitboxes"): the player's
        // drawn box may touch a ledge or roof but not sink into it by more than 4 units
        if (clips(res.p, segs, tb, t1)) { REJ.clip++; continue; }
      }
      best = { kind, label: k.label, err: got.err, objs, segs, res };
      break;
    }
    if (!best) {
      // nothing fits: a beat with no trigger, if the run lives on; else back one trigger
      const segs = cloneSegs(st.segs), res = fillGap(st.objs.slice(), segs, i, tb);
      if (!res.dead && !res.done) { history[i] = { objs: st.objs, segs: st.segs, base, want: { want, others }, lastMode: st.lastMode, modeRun: st.modeRun, band: st.band }; st.segs = segs; base = res; placed.push({ beat: plan[i].beat, kind: "none" }); continue; }
      if (i === 0) throw new Error("no trigger fits the first beat");
      const h = history[i - 1];
      tried[i - 1].add(placed[placed.length - 1].kind); tried[i].clear();
      st.objs = h.objs; st.segs = h.segs; base = h.base; st.lastMode = h.lastMode; st.modeRun = h.modeRun; st.band = h.band; placed.pop(); history.length = i - 1;
      i -= 2; continue;
    }
    history[i] = { objs: st.objs, segs: st.segs, base, want: { want, others }, lastMode: st.lastMode, modeRun: st.modeRun, band: st.band };
    st.objs = best.objs; st.segs = best.segs; base = best.res;
    if (opts.shape !== false && st.band != null && !plan[i].newBatch) { const t1 = Math.min(i + 1 < plan.length ? tickOf(plan[i + 1].beat) : tb + 120, base.p.length - 1); let lo = 1e9; for (let t = tb; t <= t1; t++) lo = Math.min(lo, base.p[t].y); st.band = Math.min(st.band, Math.max(0, Math.floor((lo - 30) / B) * B)); }
    if (opts.shape !== false && (st.band == null || plan[i].newBatch)) { const t1 = Math.min(i + 1 < plan.length ? tickOf(plan[i + 1].beat) : tb + 120, base.p.length - 1); let lo = 1e9; for (let t = tb; t <= t1; t++) lo = Math.min(lo, base.p[t].y); st.band = Math.max(0, Math.floor((lo - 30) / B) * B); }
    if (best.kind === "mode" && batch) batch.first = false;   // the batch's own icon is in: until then each trigger tries it first
    if (best.kind === "mode") { st.lastMode = s.mode; st.modeRun = (st.modeRun || 0) + 1; } else st.modeRun = 0;
    placed.push({ beat: plan[i].beat, tick: tb, kind: best.kind, want, label: best.label, err: best.err, energy: plan[i].energy });
    if (!opts.quiet) process.stdout.write(`  b${String(plan[i].beat).padStart(3)} ${(best.kind === want ? "" : "~").padEnd(1)}${best.label.padEnd(18)} ${best.err >= 0 ? "+" : ""}${(best.err / TPS * 1000).toFixed(0)} ms\n`);
  }
  // ---- home: a wall of portals back to the cube, normal gravity and size, 1x; then the run-out
  const tEnd = tickOf(plan[plan.length - 1].beat) + Math.round(g.period * 2 * TPS);
  const sE = base.p[Math.min(tEnd, base.p.length - 1)];
  const wx = sE.x + 60, homeObjs = [];
  const top = Math.max(sE.y + 120, ...st.segs.filter(q => q.x1 > wx).map(q => q.H + 60));
  // roofs and ledges past the wall end at it
  for (const sg of st.segs) if (sg.x1 > wx - 30) sg.x1 = Math.max(sg.x0 + 30, Math.floor((wx - 30) / B) * B);
  for (let y = 45; y <= top; y += 60) for (const [k, id] of [[0, ID.cube], [1, ID.gravUp], [2, ID.normalSize], [3, ID["1x"]]]) homeObjs.push({ id, x: wx + k * 40, y, kind: "home" });
  st.objs = st.objs.concat(homeObjs);
  const endX = wx + 160 + 10 * 30 * 3;
  st.objs.push({ id: ID.deco, x: endX, y: 15, kind: "end" });
  const M0 = {};
  // ---- spikes where the path never goes (sparse), kept only if it still clears
  let fin = run(st.objs, st.segs, 1e9, endX + 90);
  // a wave (or cube) sliding along a ledge the home wall cut short dies at its end ("block edge": the wave dies sliding off a
  // block's end, PHYSICS.md): carry that ledge on past the wall, up to 3 times
  for (let k = 0; k < 3 && fin.dead && /edge/.test(fin.why || ""); k++) {
    const e = fin.p[fin.p.length - 1], sg = st.segs.filter(q => Math.abs(q.x1 - e.x) < 40).sort((a, b) => Math.abs(a.H - e.y) - Math.abs(b.H - e.y))[0];
    if (!sg) break;
    for (const q of st.segs) if (q.H === sg.H && q.dir === sg.dir && q.x1 === sg.x1) q.x1 = Math.max(q.x1, wx + 200);
    fin = run(st.objs, st.segs, 1e9, endX + 90);
  }
  const spikes = [];
  // (the old sparse ground spikes; since round 10 lib/hazards.js places hazards along the path, below: opts.hazards false = the old way)
  if (!fin.dead && opts.hazards === false) {
    const p = fin.p, lowAt = new Map();
    for (const s of p) { const c = Math.floor(s.x / B); lowAt.set(c, Math.min(lowAt.get(c) ?? 1e9, s.y)); }
    const blocked = new Set();
    for (const sg of st.segs) if (sg.dir > 0 && sg.H <= 60) for (let c = Math.floor(sg.x0 / B) - 1; c <= Math.ceil(sg.x1 / B) + 1; c++) blocked.add(c);
    for (let c = 12; c < Math.floor(wx / B) - 2; c++) {
      let low = 1e9; for (let d = -3; d <= 3; d++) low = Math.min(low, lowAt.get(c + d) ?? 1e9);
      // the ground varies (Evgeni: "more variations of ground - spikes"): runs of spikes with gaps, and where the path is
      // high, small pillars with a spike on top; the pattern changes every 24 columns
      if (!(low > 150 && low < 1e8 && !blocked.has(c))) continue;
      const v = Math.floor(c / 24) % 4, k = c % 8;
      if (v === 0 && k < 3) spikes.push({ id: ID.spike, x: c * B + 15, y: 15, kind: "spike" });
      else if (v === 1 && k % 2 === 0) spikes.push({ id: ID.spike, x: c * B + 15, y: 15, kind: "spike" });
      else if (v === 2 && low > 260 && k < 2) { spikes.push({ id: ID.block, x: c * B + 15, y: 15, kind: "pillar" }, { id: ID.block, x: c * B + 15, y: 45, kind: "pillar" }, { id: ID.spike, x: c * B + 15, y: 75, kind: "spike" }); }
      else if (v === 3 && k < 5) spikes.push({ id: ID.spike, x: c * B + 15, y: 15, kind: "spike" });
    }
    let objs = st.objs.concat(spikes), res = run(objs, st.segs, 1e9, endX + 90);
    if (res.dead) { objs = st.objs; res = fin; spikes.length = 0; }
    st.objs = objs; fin = res;
  }
  // ---- every pad on something (v5 in the picture: 11 of 190 pads hung in the air -- on a slope's row, past a ledge cut
  // later, ...): an unsupported pad gets a block under it, kept while the run still clears
  if (!fin.dead) {
    const added = [];
    for (const o of st.objs.filter(q => ["yellow", "pink", "red", "blue"].includes(q.kind))) {
      const H = o.flipY ? o.y + 15 : o.y - 15, dir = o.flipY ? -1 : 1;
      if ((H === 0 && dir > 0) || st.segs.some(sg => sg.dir === dir && Math.abs(sg.H - H) < 1 && sg.x0 <= o.x + 5 && sg.x1 >= o.x - 5)) continue;
      const x0 = Math.floor((o.x - 15) / B) * B;
      added.push({ H, dir, x0, x1: Math.max(x0 + B, Math.ceil((o.x + 15) / B) * B), tag: "padfoot" });
    }
    if (added.length) {
      let keep = added.slice();
      for (let tries = 0; tries < 8 && keep.length; tries++) {
        const res = run(st.objs, st.segs.concat(keep), 1e9, endX + 90);
        if (!res.dead) { st.segs = st.segs.concat(keep); fin = res; break; }
        const dx = res.p[res.p.length - 1].x; keep = keep.filter(q => q.x1 < dx - 120 || q.x0 > dx + 120);
      }
      M0.padFeet = (st.segs.filter(q => q.tag === "padfoot").length) + "/" + added.length;
    }
  }
  // ---- hazards that follow the path (round 10; Evgeni: "the spike blocks around the game seem also very random, they are not
  // coherent and not fluid with the path"): lib/hazards.js hazardsAlongPath, fitted on the main levels and rated community
  // levels (HAZARDS.md) -- spikes under air arcs, lane pieces on the path's contour 2-3 blocks off in flying stretches, pit
  // floors, and each stray press's leak blocked on that same line. The saws below only take the leaks still open after it.
  if (opts.hazards !== false && !fin.dead) {
    Object.assign(GD, require("../lib/hazards.js"));
    const sr = strays(st.objs, st.segs, fin, { uptoX: wx - 60, farX: endX + 90 });
    const lv0 = GD.parseLevel(levelString(st.objs, st.segs)), w0 = GD.makeWorld(lv0.objects, lv0.header), q0 = GD.run(w0, []);
    const hz = GD.hazardsAlongPath(q0.path, lv0.objects, { tier: opts.tier || "normal", seed, leaks: sr.leaks.map(l => ({ path: l.path })),
      verify: { header: lv0.header, events: [] } });
    const add = hz.objects.map(o => ({ id: o.id, x: o.x, y: o.y, flipY: !!o.flipY, kind: "haz" }));
    const res = add.length ? run(st.objs.concat(add), st.segs, 1e9, endX + 90) : fin;
    if (!res.dead) { st.objs = st.objs.concat(add); fin = res; }
    M0.hazards = Object.assign({ placed: res.dead ? 0 : add.length, leaksBefore: sr.leaks.length + "/" + sr.checked }, hz.notes);
    if (!opts.quiet) console.log(`  hazards along the path: ${M0.hazards.placed} (threats ${hz.notes.threats}, walls ${hz.notes.walls}+${hz.notes.wallSpikes} spikes, leak blocks ${hz.notes.leakBlocks}, pits ${hz.notes.pits}, dropped ${hz.notes.dropped})` + (res.dead ? " -- the run died with them: left out" : ""));
  }
  // ---- no secret way (strays / blockSpot above): up to opts.blockPasses (4) passes of saws on the leaks, each kept only
  // while the auto run still clears (a pass that kills drops its saws near the death and tries again)
  if (opts.block !== false && !fin.dead) {
    const idxOfX = x => { let lo = 0, hi = fin.p.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (fin.p[m].x < x) lo = m + 1; else hi = m; } return lo; };
    let saws = 0; M0.blockPasses = [];
    for (let pass = 0; pass < (opts.blockPasses || 4); pass++) {
      const sr = strays(st.objs, st.segs, fin, { uptoX: wx - 60, farX: endX + 90 });
      M0.blockPasses.push(sr.leaks.length + "/" + sr.checked);
      if (!sr.leaks.length) break;
      let add = [];
      for (const lk of sr.leaks) { const sp = blockSpot(lk, fin.p, idxOfX); if (sp && !add.some(q => Math.abs(q.x - sp.x) < 40 && Math.abs(q.y - sp.y) < 40) && !st.objs.some(q => q.kind === "block" && Math.abs(q.x - sp.x) < 40 && Math.abs(q.y - sp.y) < 40)) add.push(sp); }
      if (!add.length) break;
      for (let tries = 0; tries < 6 && add.length; tries++) {
        const res = run(st.objs.concat(add), st.segs, 1e9, endX + 90);
        if (!res.dead) { st.objs = st.objs.concat(add); fin = res; saws += add.length; add = []; break; }
        const dx = res.p[res.p.length - 1].x; add = add.filter(q => Math.abs(q.x - dx) > 240);
      }
    }
    M0.saws = saws;
    if (!opts.quiet) console.log(`  no secret way: ${saws} saws, leaks per pass ${M0.blockPasses.join(", ")}`);
  }
  // ---- the ending every level gets (Evgeni, 2026-11-26: "from now-on everywhere, we add the latest end screen claude sign on
  // every level we make"): the auto outro (tools/autobricks.js outro: any arrival -> plain cube, a big fall up and down), then
  // the signature (tools/signature.js) -- the same pair make.js puts on every GDLM level ("outro": <seed> + the signature)
  let sig = null;
  // the beat ending (tools/beatend.js, default since 2026-11-26: Evgeni found the outro "too big ... doesnt match the beat"):
  // half a screen of pad bounces hit and landed on the beats, then the sign. opts.ending "outro" = the old outro.
  if (opts.ending !== false && opts.ending !== "outro" && !fin.dead) {
    try {
      const be = require("./beatend.js").beatEnd(levelString(st.objs.filter(q => q.kind !== "end"), st.segs), { period: g.period, t0: g.t0, fromX: wx });
      const objs = st.objs.filter(q => q.kind !== "end").concat(be.objects.map(q => Object.assign({ kind: "beatend" }, q)));
      const res = run(objs, st.segs, 1e9, be.endX);
      if (!res.dead) { st.objs = objs; fin = res; sig = { col: be.signCol, floorY: be.floorY, beat: be.beats, notes: be.notes, secs: +((be.endX - be.startX) / 311.58).toFixed(2) }; }
      else if (!opts.quiet) console.log("  the beat ending dies (" + res.why + ")");
    } catch (e) { if (!opts.quiet) console.log("  the beat ending failed: " + e.message); }
    if (sig && !opts.quiet) console.log("  beat ending: " + sig.notes.join("; "));
  }
  if (!sig && opts.ending !== false && !fin.dead) {
    const o = require("./autobricks.js").outro(opts.outro || (seed % 6) + 1);
    const col = Math.ceil((wx + 160) / B) + 3;
    const outroObjs = o.entries(col).map(([id, c, rr, e]) => ({ id, x: c * B + 15, y: rr * B + 15 + ((e && e.dy) || 0), flipY: !!(e && e.flipY), flipX: !!(e && e.flipX), rot: (e && e.rot) || 0, kind: "outro" }));
    const objs = st.objs.filter(q => q.kind !== "end").concat(outroObjs);
    const lastX = Math.max(...outroObjs.map(q => q.x));
    const res = run(objs, st.segs, 1e9, lastX + 400);
    if (!res.dead) { st.objs = objs; fin = res; sig = { col: Math.ceil(lastX / B) + 3, outro: o.secs }; }
    else if (!opts.quiet) console.log("  the outro dies (" + res.why + "): ending without it");
    if (!sig) sig = { col: Math.ceil(endX / B) + 3 };
  }
  const lv = { str: levelString(st.objs, st.segs), sig };
  const M = Object.assign(measures(fin, placed, g), M0);
  M.ending = sig ? (sig.beat ? `beat ending ${sig.secs} s + signature` : sig.outro ? `outro ${sig.outro} s + signature` : "signature") : "none";
  if (opts.music) {   // how many of the song's notes a trigger lands on (Evgeni: "we hit like 1/6 of the notes")
    const tt = placed.filter(t => t.kind !== "none").map(t => t.tick / TPS), lo = tt[0] - 0.01, hi = tt[tt.length - 1] + 0.01;
    const strong = opts.music.notes.filter(n => n.t >= lo && n.t <= hi && n.strength >= 0.3);
    const hit = n => tt.some(t => Math.abs(t - n.t) <= 0.03);
    M.notesHit = +(strong.filter(hit).length / Math.max(1, strong.length)).toFixed(2);
    M.perSec = +(tt.length / Math.max(1, hi - lo)).toFixed(1);
    M.speedChanges = placed.filter(t => t.kind === "speed").length;
  }
  if (opts.shape !== false) { M.rejected = Object.assign({}, REJ); M.clipTicks = 0; for (let t = 0; t < fin.p.length; t += 2) if (clips(fin.p, st.segs, t, t)) M.clipTicks++; M.clipTicks *= 2;
  }
  return { song, g, seed, plan, placed, motifs: motifLog, objs: st.objs, segs: st.segs, fin, lv, endX, measures: M };
}

function measures(fin, placed, g) {
  const p = fin.p, trig = placed.filter(t => t.kind !== "none");
  let modeCh = 0, rev = 0, maxY = 0, air = 0;
  const modes = new Set(), speeds = new Set();
  for (let t = 1; t < p.length; t++) { if (p[t].mode !== p[t - 1].mode) modeCh++; if (p[t].grav < 0) rev++; if (!p[t].g) air++; maxY = Math.max(maxY, p[t].y); modes.add(p[t].mode); speeds.add(SPNAME[p[t].sp]); }
  const errs = trig.map(t => Math.abs(t.err) / TPS * 1000);
  const byKind = {}; for (const t of trig) byKind[t.kind] = (byKind[t.kind] || 0) + 1;
  return {
    secs: +(p.length / TPS).toFixed(1), triggers: trig.length, skippedBeats: placed.length - trig.length,
    onBeat: +(errs.filter(e => e <= 17).length / Math.max(1, errs.length)).toFixed(2),
    meanOffMs: +(errs.reduce((a, e) => a + e, 0) / Math.max(1, errs.length)).toFixed(1), maxOffMs: +Math.max(0, ...errs).toFixed(0),
    asWanted: +(trig.filter(t => t.kind === t.want).length / Math.max(1, trig.length)).toFixed(2),
    modeChanges: modeCh, modesSeen: [...modes], speedsSeen: [...speeds], reverse: +(rev / p.length).toFixed(2),
    inAir: +(air / p.length).toFixed(2), riseBlocks: +(maxY / B).toFixed(1), byKind, clears: !fin.dead,
  };
}

function write(out, b, name) {
  let desc = `auto, beat-first: every trigger on a note of ${b.song} (tools/autobeat.js, AUTO.md)`;
  let str = b.lv.str;
  if (b.lv.sig) {   // the signature: its colours in the header, its objects after the outro, the level clipped 5 blocks after it
    const sg = require("./signature.js"), lvl = GD.parseLevel(str);
    const fy = b.lv.sig.floorY || 0, xOfT = t => t * 311.58, tOfX = x => x / 311.58;   // the ending runs at 1x
    const lastT = b.fin.p.length / TPS, beats = [];
    for (let k = Math.ceil((lastT - 6 - b.g.t0) / b.g.period); b.g.t0 + k * b.g.period < lastT + 4; k++) beats.push(b.g.t0 + k * b.g.period);
    // the sign's beat triggers sit at the x the player reaches on each beat (from the run, not a 1x guess)
    const p = b.fin.p, xAt = t => { const i = Math.max(0, Math.round(t * TPS)); return i < p.length ? p[i].x : p[p.length - 1].x + (i - p.length + 1) * 311.58 / TPS; };
    const header = sg.header(lvl.header, { col: b.lv.sig.col, floorY: fy });
    const so = sg.signature({ col: b.lv.sig.col, floorY: fy, period: b.g.period, beats: b.lv.sig.beat ? beats : undefined, xOfT: xAt, tOfX: x => { let i = p.findIndex(s => s.x >= x); if (i < 0) i = p.length - 1; return i / TPS; } });
    desc = sg.describe(desc);
    const rec = GD.newRecord(name, desc);
    if (b.g.k45) GD.setField(rec, "k45", "i", b.g.k45); else GD.setField(rec, "k8", "i", String(b.g.k8));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    writeGdlvl(out, rec, { header, objects: lvl.objects.concat(so) });
    return;
  }
  const rec = GD.newRecord(name, desc);
  if (b.g.k45) GD.setField(rec, "k45", "i", b.g.k45); else GD.setField(rec, "k8", "i", String(b.g.k8));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  writeGdlvl(out, rec, GD.parseLevel(str));
}

if (require.main === module) {
  const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  const t0 = Date.now();
  const notes = opt("--notes") ? JSON.parse(fs.readFileSync(opt("--notes"), "utf8")) : a.includes("--beats-only") ? null : undefined;
  const b = build({ music: notes, minGap: opt("--min-gap") ? +opt("--min-gap") : undefined, song: opt("--song") || "Electrodynamix", seed: +(opt("--seed") || 1), beats: opt("--beats") != null ? +opt("--beats") : null, from: opt("--from-beat") != null ? +opt("--from-beat") : 2, quiet: a.includes("--quiet") });
  const out = path.resolve(opt("--out") || path.join(ROOT, "levels", "lab", "auto_beat.gdlvl"));
  write(out, b, opt("--name") || "GDLM auto beat");
  console.log("motifs (blocks of AAAA, BBBB, a mix):\n  " + b.motifs.join("\n  "));
  console.log(JSON.stringify(b.measures));
  console.log(`${b.measures.clears ? "CLEARS with no press" : "DIES: " + b.fin.why} -> ${path.relative(ROOT, out)} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}
module.exports = { build, write, triggerBeats, notePlan, musicOf, loadGrid, strays, run, clips };
