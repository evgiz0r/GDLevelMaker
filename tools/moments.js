// node tools/moments.js <level.gdlvl> [--song <id>] [--offset <s>]  -- transition moments: does something happen on the
//   strong beats at the level's section changes?
//
// Evgeni (2026-11-28): "we have many moments in the game with really strong beat. if its in a transition, something should
// happen ... today those feel too simple or not special at all"; "thats all for the orchistrator to do".
//   plan({ music, from, P, parts, opts })  -> [{t, effects, size, y, hue, why}]   the orchestrator's part (tools/typebuild.js):
//       for every section change, the strongest song impact or drop (tools/sections.js drops) within `near` s of it; at or over
//       `min` strength it gets a moment, at or over `big` (or a drop) the big set. Effects (tools/effects.js, deco only, no pulse,
//       no flash): gateShut (a gate slams shut behind the player), riseReveal (the next skyline rises out of the ground),
//       cameraBreath (the camera pulls back and lifts, then settles), slabsFall (slabs drop from the sky and land on the beat).
//       Two a moment, the pairs rotating so two moments in a row differ; the level's strongest one gets three (`peak`).
//       Knobs (the brief's "moments": false | {min, big, near, kinds: [[...], ...], size}; per section "moment": "none" |
//       [effects]) -- the orchestrator steers, the effects realise it.
//   check(level, notes)  -> [{t, strength, ok, what}]   the judge's part: each strong beat near a mode / speed / gravity portal
//       and whether a moment trigger (move, zoom, camera offset, colour, alpha in group 991, which tools/scenes/typefx.js puts on
//       the moments' triggers) fires within 0.4 s of it. tools/report.js
//       notes the flat ones ("flat transition").
"use strict";
const SX = require("./sections.js");

// two events a moment, rotating so two moments in a row differ; the level's strongest beat at a change gets three
const SETS = [["gateShut", "cameraBreath"], ["riseReveal", "slabsFall"], ["slabsFall", "cameraBreath"], ["gateShut", "riseReveal"], ["riseReveal", "cameraBreath"], ["gateShut", "slabsFall"]];
const BIG = ["gateShut", "riseReveal", "cameraBreath"];

// the song's strong beats (song seconds): impacts and loudness drops, strongest kept where two are within 0.25 s
function strongBeats(music) {
  const all = [...(music.impacts || []).map(i => ({ t: i.t, s: i.strength || 0, kind: i.kind })), ...SX.drops(music).map(d => ({ t: d.t, s: d.strength, kind: "drop" }))]
    .sort((a, b) => b.s - a.s), out = [];
  for (const b of all) if (!out.some(o => Math.abs(o.t - b.t) < 0.25)) out.push(b);
  return out.sort((a, b) => a.t - b.t);
}

function plan({ music, from = 0, P, parts, opts = {} }) {
  if (opts === false) return [];
  const min = opts.min ?? 0.6, big = opts.big ?? 0.9, near = opts.near ?? 0.6, sets = opts.kinds || SETS, beats = strongBeats(music), out = [];
  let k = 0;
  for (const p of parts) {
    if (p.b0 <= 1 || p.moment === "none") continue;
    const tb = (p.b0 - 1) * P;   // level seconds of the section change
    const cand = beats.filter(b => Math.abs(b.t - from - tb) <= near).sort((a, b) => b.s - a.s)[0];
    if (!cand || cand.s < min) continue;
    const isBig = cand.s >= big || cand.kind === "drop";
    const effects = Array.isArray(p.moment) ? p.moment : sets[k++ % sets.length];
    out.push({ t: +(cand.t - from).toFixed(3), effects, size: opts.size ?? (isBig ? 1.15 : 0.9), y: (p.floor + 1.5) * 30, hue: p.hue,
      why: `${cand.kind} ${cand.s.toFixed(2)} at the s${p.i} change`, section: p.i, s: cand.s });
  }
  // the strongest of them: all three (one peak a level, so it stays special)
  const top = out.filter(m => !Array.isArray((parts.find(p => p.i === m.section) || {}).moment)).sort((a, b) => b.s - a.s)[0];
  if (top) top.effects = opts.peak || BIG;
  for (const m of out) delete m.s;
  return out;
}

// the level's section changes: mode / speed / gravity portals in x order, with their level time from the route's path
const PORTAL = new Set([12, 13, 47, 111, 660, 745, 1331, 1933, 200, 201, 202, 203, 1334, 10, 11]);
const MOMENT_TRIG = new Set([901, 1913, 1916, 899, 1007]);
function check({ objects, path, music, from = 0, min = 0.6, near = 0.6 }) {
  const TPS = 240, tOfX = x => { let lo = 0, hi = path.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (path[m].x >= x) hi = m; else lo = m + 1; } return lo / TPS; };
  const portals = objects.filter(o => PORTAL.has(o.id)).map(o => tOfX(o.x)).sort((a, b) => a - b), changes = [];
  for (const t of portals) if (!changes.length || t - changes[changes.length - 1] > 1) changes.push(t);
  const trigT = objects.filter(o => MOMENT_TRIG.has(o.id) && o.props && String(o.props[57] || "").split(".").includes("991")).map(o => tOfX(o.x));
  const beats = strongBeats(music), out = [];
  for (const tc of changes) {
    const b = beats.filter(b => Math.abs(b.t - from - tc) <= near).sort((a, b) => b.s - a.s)[0];
    if (!b || b.s < min) continue;
    const t = b.t - from, ok = trigT.some(x => Math.abs(x - t) <= 0.4);
    out.push({ t: +t.toFixed(2), strength: +b.s.toFixed(2), kind: b.kind, ok, what: ok ? "a moment" : "flat transition: a strong beat at a section change and nothing happens" });
  }
  return out;
}
module.exports = { plan, check, strongBeats, SETS, BIG };

if (require.main === module) {
  const a = process.argv.slice(2), f = a.find(x => !x.startsWith("--"));
  if (!f) { console.log(require("fs").readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
  const { readGdlvl, GD } = require("./io.js"), L = readGdlvl(f), S = require("./solutions.js").get(L.levelStr, true);
  const song = a.includes("--song") ? a[a.indexOf("--song") + 1] : ((L.rec.fields || []).find(f => f.key === "k45") || {}).value, from = a.includes("--offset") ? +a[a.indexOf("--offset") + 1] : +(L.level.header.match(/kA13,([\d.]+)/) || [0, 0])[1];
  const w = GD.makeWorld(L.level.objects, L.level.header), path = GD.run(w, S ? S.events : []).path;
  const r = check({ objects: L.level.objects, path, music: SX.load(song).music, from });
  for (const m of r) console.log(`${m.t.toFixed(2).padStart(6)} s  ${m.kind.padEnd(6)} ${m.strength}  ${m.ok ? "ok  " : "FLAT"} ${m.what}`);
  console.log(`${r.filter(m => !m.ok).length} flat of ${r.length} strong transition beats`);
}
