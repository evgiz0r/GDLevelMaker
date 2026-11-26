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
"use strict";
if (require.main === module) require("./heavy.js").claim();
const fs = require("fs"), path = require("path");
const { GD, writeGdlvl } = require("./io.js");
const ROOT = path.join(__dirname, "..");
const TPS = GD.PHYS.TPS, B = 30;
const ID = {
  block: 1, spike: 8, deco: 211,
  yellow: 35, pink: 140, red: 1332, blue: 67,
  gravDown: 11, gravUp: 10, mini: 101, normalSize: 99, tele: 747,
  cube: 12, ship: 13, ball: 47, ufo: 111, wave: 660, robot: 745, spider: 1331, swing: 1933,
  "0.5x": 200, "1x": 201, "2x": 202, "3x": 203,
};
const SPNAME = { 0: "0.5x", 1: "1x", 2: "2x", 3: "3x", 4: "4x" };
const MODES = ["cube", "ship", "ball", "ufo", "wave", "robot", "spider", "swing"];
const PADMODES = new Set(["cube", "ball", "robot", "spider", "ufo"]);
const KINDS = ["yellow", "pink", "red", "blue", "grav", "fall", "mode", "mini", "tele"];   // speed: from the music (notePlan), or not at all
// when the motif's kinds do not fit (often: a player in the air can't take a pad), these in turn -- a gravity flip first,
// mode portals and teleports last (as fallbacks they made a third of the triggers: mode spam)
const FALLBACK = ["grav", "blue", "yellow", "pink", "red", "fall", "mini", "mode", "tele"];
const KW = { yellow: 3, pink: 2, red: 2, blue: 3, grav: 3, fall: 3, mode: 3, speed: 1, mini: 1, tele: 0.8 };
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
  const out = [];
  for (const n of merged) {
    const I = inten(n.t), need = Math.min(0.5, 0.65 - 0.9 * I);   // intensity 0.7+: every note; else at least the stronger half (a calm intro was 4 s of nothing)
    if (n.strength < need) continue;
    const last = out[out.length - 1];
    if (last && n.t - last.t < minGap) { if (n.strength > last.strength + 0.2 && (out.length < 2 || n.t - out[out.length - 2].t >= minGap)) Object.assign(last, { t: n.t, strength: n.strength, beat: (n.t - g.t0) / g.period }); continue; }
    out.push({ t: n.t, strength: n.strength, beat: +((n.t - g.t0) / g.period).toFixed(3), energy: I });
  }
  // the music's own speed plan (tools/impacts.js speedPlan) when it has one
  if (music.speedPlan && music.speedPlan.length) {
    let cur = "1x";
    for (const [t, , sp] of music.speedPlan) {
      if (sp === cur) continue;
      const at = out.find(p => p.t >= t - 0.01 && !p.speedTo);
      if (at) { at.speedTo = sp; at.newBlock = true; cur = sp; }
    }
    return out;
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
  for (const o of objs.concat(extra)) parts.push(`1,${o.id},2,${o.x.toFixed(2)},3,${o.y}` + (o.flipY ? ",5,1" : "") + (o.off ? ",54," + o.off : ""));
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
  mode(s, st) {
    const opts = MODES.filter(m => m !== s.mode && !(st.lastMode && m === st.lastMode));
    const m = opts[Math.floor(st.r() * opts.length)];
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

// ---------------------------------------------------------------- the builder
function build(opts = {}) {
  const song = opts.song || "Electrodynamix", seed = opts.seed || 1, r = rng(seed);
  const g = loadGrid(song);
  const tickOf = b => Math.round((g.t0 + b * g.period) * TPS);
  const lastBeat = Math.min(g.beats - 6, opts.beats != null ? (opts.from || 4) + opts.beats : g.beats - 6);
  if (opts.music === undefined) opts.music = musicOf(song);   // the song's notes when they are measured, else the beat grid
  const plan = opts.music ? notePlan(g, opts.music, opts.from || 4, lastBeat, opts) : triggerBeats(g, opts.from || 4, lastBeat);
  const st = { objs: [], segs: [], r, lastMode: null };
  const farX = () => 20000 + (plan.length ? 0 : 0);   // far enough for any song at 3x: replaced by the real end at the end
  const FAR = 400 * B * 4;
  const placed = [];            // per trigger: {beat, tick, kind, label, fired, off}
  // motifs: blocks of 3 phrases of 4 -- AAAA, BBBB, a mix
  const MIX = ["ABAB", "AABB", "ABBA", "ABAC", "AABA"];
  const pick = (not) => { const ks = KINDS.filter(k => !not.includes(k)); let tot = ks.reduce((a, k) => a + KW[k], 0), x = r() * tot; for (const k of ks) { x -= KW[k]; if (x <= 0) return k; } return ks[ks.length - 1]; };
  let letters = {}, pattern = "", block = 0, posInBlock = 0;
  const motifLog = [];
  function wantAt(i) {
    const p = plan[i];
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
          if (segs.ledgeFor == null) segs.ledgeFor = r() < 0.45 ? 2 + Math.floor(r() * 3) : 0;
          const bottom = s.y - half(s), H = Math.floor((s.y + 0.5 * s.vy * 0 - half(s)) / B) * B;
          if (segs.ledgeFor && t > from && p[t - 1].vy >= 0 && bottom > (segs.ledgeFor + 2) * B) segs.ledgeAt = Math.floor((bottom - segs.ledgeFor * B) / B) * B;
          if (segs.ledgeAt && bottom <= segs.ledgeAt + 3 && p[t - 1].y - half(s) > segs.ledgeAt + 3) {
            fix = { H: segs.ledgeAt, dir: 1, x0: Math.floor((s.x - 20) / B) * B, x1: Math.ceil(nextLead(i, p, Math.min(upto, p.length - 1)) / B) * B, tag: "ledge" };
            segs.ledgeAt = 0; segs.ledgeFor = 0; break;
          }
        }
        if (s.g || s.grav > 0) { phaseY = null; continue; }
        if (phaseY == null) phaseY = s.y;
        const rise = segs.riseFor || (segs.riseFor = (r() < 0.25 ? 14 + Math.floor(r() * 12) : 3 + Math.floor(r() * 6)) * B);
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
    const order = st.speedTo ? ["speed"] : [want, ...others.filter(k => k !== want), ...FALLBACK.filter(k => k !== want && !others.includes(k))];
    let best = null;
    for (const kind of order) {
      if (tried[i].has(kind)) continue;
      if (kind === "mode" && st.modeRun >= 3) continue;
      const k = kindAt(kind, s, st);
      if (!k) continue;
      // tune dx so it fires on the beat tick
      let dx = k.dx0, got = null;
      for (let it = 0; it < 4; it++) {
        const c = k.tune(dx);
        const segs = cloneSegs(st.segs).concat(c.segs);
        if (c.cutAt != null) { const sg = segs.find(q => q.x0 === k.cut.x0 && q.H === k.cut.H && q.dir === k.cut.dir); sg.x1 = c.cutAt; }
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
      if (got.c.cutAt != null) { const sg = segs.find(q => q.x0 === k.cut.x0 && q.H === k.cut.H && q.dir === k.cut.dir); sg.x1 = got.c.cutAt; }
      const objs = st.objs.concat(got.c.objs);
      const res = fillGap(objs, segs, i, tb);
      if (res.dead || res.done) continue;
      // it must MOVE the player: a portal that only changes the mode of a player walking on flat ground is no change of
      // movement (seed 4's first try walked half a minute that way)
      // With notes close together the next trigger comes quickly: then it is enough that the vertical speed turned.
      if (kind !== "speed") { const t1 = Math.min(i + 1 < plan.length ? tickOf(plan[i + 1].beat) : tb + 120, res.p.length - 1); let dy = 0;
        for (let t = tb; t <= t1; t++) dy = Math.max(dy, Math.abs(res.p[t].y - base.p[Math.min(t, base.p.length - 1)].y));
        const tq = Math.min(tb + 10, res.p.length - 1), dvy = Math.abs(res.p[tq].vy - base.p[Math.min(tq, base.p.length - 1)].vy);
        if (dy < Math.min(B, 0.25 * (t1 - tb)) && dvy < 2) continue; }
      const end = res.p[res.p.length - 1];
      if (end.y > SKY + 300) continue;
      best = { kind, label: k.label, err: got.err, objs, segs, res };
      break;
    }
    if (!best) {
      // nothing fits: a beat with no trigger, if the run lives on; else back one trigger
      const segs = cloneSegs(st.segs), res = fillGap(st.objs.slice(), segs, i, tb);
      if (!res.dead && !res.done) { history[i] = { objs: st.objs, segs: st.segs, base, want: { want, others }, lastMode: st.lastMode, modeRun: st.modeRun }; st.segs = segs; base = res; placed.push({ beat: plan[i].beat, kind: "none" }); continue; }
      if (i === 0) throw new Error("no trigger fits the first beat");
      const h = history[i - 1];
      tried[i - 1].add(placed[placed.length - 1].kind); tried[i].clear();
      st.objs = h.objs; st.segs = h.segs; base = h.base; st.lastMode = h.lastMode; st.modeRun = h.modeRun; placed.pop(); history.length = i - 1;
      i -= 2; continue;
    }
    history[i] = { objs: st.objs, segs: st.segs, base, want: { want, others }, lastMode: st.lastMode, modeRun: st.modeRun };
    st.objs = best.objs; st.segs = best.segs; base = best.res;
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
  // ---- spikes where the path never goes (sparse), kept only if it still clears
  let fin = run(st.objs, st.segs, 1e9, endX + 90);
  const spikes = [];
  if (!fin.dead) {
    const p = fin.p, lowAt = new Map();
    for (const s of p) { const c = Math.floor(s.x / B); lowAt.set(c, Math.min(lowAt.get(c) ?? 1e9, s.y)); }
    const blocked = new Set();
    for (const sg of st.segs) if (sg.dir > 0 && sg.H <= 60) for (let c = Math.floor(sg.x0 / B) - 1; c <= Math.ceil(sg.x1 / B) + 1; c++) blocked.add(c);
    for (let c = 12; c < Math.floor(wx / B) - 2; c++) {
      let low = 1e9; for (let d = -3; d <= 3; d++) low = Math.min(low, lowAt.get(c + d) ?? 1e9);
      if (low > 150 && low < 1e8 && !blocked.has(c) && (c % 7 < 3)) spikes.push({ id: ID.spike, x: c * B + 15, y: 15, kind: "spike" });
    }
    let objs = st.objs.concat(spikes), res = run(objs, st.segs, 1e9, endX + 90);
    if (res.dead) { objs = st.objs; res = fin; spikes.length = 0; }
    st.objs = objs; fin = res;
  }
  const lv = { str: levelString(st.objs, st.segs) };
  const M = measures(fin, placed, g);
  if (opts.music) {   // how many of the song's notes a trigger lands on (Evgeni: "we hit like 1/6 of the notes")
    const tt = placed.filter(t => t.kind !== "none").map(t => t.tick / TPS), lo = tt[0] - 0.01, hi = tt[tt.length - 1] + 0.01;
    const strong = opts.music.notes.filter(n => n.t >= lo && n.t <= hi && n.strength >= 0.3);
    const hit = n => tt.some(t => Math.abs(t - n.t) <= 0.03);
    M.notesHit = +(strong.filter(hit).length / Math.max(1, strong.length)).toFixed(2);
    M.perSec = +(tt.length / Math.max(1, hi - lo)).toFixed(1);
    M.speedChanges = placed.filter(t => t.kind === "speed").length;
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
  const rec = GD.newRecord(name, `auto, beat-first: every trigger on a beat of ${b.song} (tools/autobeat.js, AUTO.md)`);
  if (b.g.k45) GD.setField(rec, "k45", "i", b.g.k45); else GD.setField(rec, "k8", "i", String(b.g.k8));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  writeGdlvl(out, rec, GD.parseLevel(b.lv.str));
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
module.exports = { build, write, triggerBeats, notePlan, musicOf, loadGrid };
