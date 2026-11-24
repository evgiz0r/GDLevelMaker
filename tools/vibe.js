// node tools/vibe.js check <sheet.vibe.json>                    -- the sheet's fields, layer by layer, and what is missing
// node tools/vibe.js brief <sheet.vibe.json> --out briefs/NN.json [--name "GDLM NN x"]
//                                                               -- the sheet -> a compose brief (tools/compose.js): one
//                                                                  section per beat of the sheet, on the song's beats
//
// A VIBE SHEET (VIBES.md) is a level written before any block exists, in the user's layers ("a mental model, where the
// level is the implementation"): intent -> experience curve -> scenes and roles -> motifs -> rhythm -> (blocks and deco,
// which the pipeline makes). Field names are shared with tools/coordinator.js (briefs/<NN>.vibe.json is read there too):
//   intent            title, journey (one line), oneImage (what the level is remembered by), never [...]
//   experience curve  feel { tier, modeStretch (s a mode lasts), density }, song { official | custom, from (s), shape
//                     [{ t:[t0,t1], part: intro|build|drop|break|finale }] }, and every beat's energy 0-1
//   scenes and roles  beats [{ id, t:[t0,t1] (song s from `from`), role intro|build|drop|calm|break|finale, energy, place,
//                     mood, vehicle { mode ("cube then ship": two sections), at (s, the switch), speed, speeds [one per mode], why }, moment, look { palette { bg, ground, line } (hex), palettes [bg hex, ...]
//                     (several eras in one beat: the beat is cut into that many sections, each switching), scene },
//                     transition { in: "instant" | "fade 10s" | ..., out }, must [...], mustNot [...] }]
//   motifs            motifs [...]: what comes back and means something ("a palette switch on every phrase: a new era")
//   rhythm            rhythm { sync: loose | portals | tight, speed: "1x" }
//   look              lookRule shared | shifting | per-part | switchAtDrop, camera (words), dress "plain" (a 1.x-style
//                     level: no scene, no 2.2 look); per beat look.props [...] (lib/props.js names) overrides the place's
//   density           feel.hazards (hazards per block, the level) or a beat's density: the gaps between chunks follow it
// The brief keeps the sheet whole under "vibe" (compose writes it to its log) and maps what compose can build: modes
// cube / ship / wave / ball / upside (robot, ufo, spider, swing: their structures in a cube section; mirror and dual are
// not simulated -- noted, left out), energy -> patterns and gaps, palette and fade per section, a "flash" on a drop.
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const OFFICIAL = ["StereoMadness", "BackOnTrack", "Polargeist", "DryOut", "BaseAfterBase", "CantLetGo", "Jumper", "TimeMachine", "Cycles", "xStep", "Clutterfunk", "TheoryOfEverything", "ElectromanAdventures", "Clubstep", "Electrodynamix", "HexagonForce", "BlastProcessing", "TheoryOfEverything2", "GeometricalDominator", "Deadlocked", "Fingerdash", "Dash"];
const LAYERS = {
  intent: ["title", "journey", "oneImage", "never"],
  "experience curve": ["feel", "song", "beats[].energy"],
  "scenes and roles": ["beats[].role", "beats[].place", "beats[].mood", "beats[].vehicle", "beats[].moment", "beats[].look"],
  motifs: ["motifs"],
  rhythm: ["rhythm"],
};
const hexRgb = h => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || "")); if (!m) return null; const n = parseInt(m[1], 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
// energy -> what a cube section may place and how far apart (calm early, tighter and richer as it rises)
const BY_ENERGY = [
  [0.35, ["single", "spike-block", "platform"], [5, 8]],
  [0.6, ["single", "double", "spike-block", "hops", "stairs"], [3, 6]],
  [0.8, ["double", "triple", "block-spike-block", "orb-pit", "pad-launch"], [3, 5]],
  [1.01, ["triple", "orb-pit", "orb-ladder", "gate", "climb"], [2, 4]],
];
const STRUCT_MODE = { robot: "s:robot-steps", ufo: "s:ufo-pillars", spider: "s:spider-steps", swing: "s:swing-wiggle" };

function songBeats(song) {
  let f;
  if (song.official) f = path.join(ROOT, "local", "beats", "official_" + OFFICIAL[(+song.official) - 1] + ".json");
  else if (song.custom) f = path.join(ROOT, "local", "beats", "custom_" + song.custom + ".json");
  if (!f || !fs.existsSync(f)) throw new Error("no beat grid for the song (" + JSON.stringify(song) + "): node tools/beats.js first");
  return JSON.parse(fs.readFileSync(f, "utf8"));
}

function check(v) {
  const out = [];
  const has = k => { if (k.startsWith("beats[].")) { const f = k.slice(8); return (v.beats || []).length && v.beats.every(b => b[f] != null); } return v[k] != null && (!Array.isArray(v[k]) || v[k].length); };
  for (const [layer, keys] of Object.entries(LAYERS)) out.push(`${layer.padEnd(17)} ${keys.map(k => (has(k) ? "✓ " : k === "beats[].energy" ? "~ " : "✗ ") + k + (!has(k) && k === "beats[].energy" ? " (from the song)" : "")).join("  ")}`);
  const b = v.beats || [];
  for (let i = 1; i < b.length; i++) if (Math.abs(b[i].t[0] - b[i - 1].t[1]) > 0.05) out.push(`! beat ${b[i].id || i}: starts at ${b[i].t[0]} s, the one before ends at ${b[i - 1].t[1]} s`);
  return out;
}

// a place in words -> the section planner's pack place (tools/scenes.js THEMES): words first, else the closest sky
const SYN = { forest: "forest", woods: "forest", tree: "forest", grave: "graveyard", graveyard: "graveyard", cemetery: "graveyard", tomb: "graveyard",
  church: "church", ruin: "ruin", factory: "factory", machine: "factory", pumpkin: "pumpkin", halloween: "pumpkin", candy: "orchard",
  sea: "ocean", ocean: "ocean", water: "shallows", underwater: "reef", reef: "reef", deep: "abyss", abyss: "abyss", jelly: "jellyfish",
  city: "city", town: "city", street: "city", night: "city", cloud: "cloud", sky: "cloud", space: "space", star: "space", dawn: "dawn", sunrise: "dawn",
  meadow: "meadow", field: "meadow", orchard: "orchard", hill: "windmill", lake: "lake", sunset: "sunset" };
function pickPlace(words, bg) {
  const T = require("./scenes.js").THEMES, all = [].concat(...Object.values(T).map(t => t.places || t));
  const w = String(words || "").toLowerCase().match(/[a-z]+/g) || [], keys = w.map(x => SYN[x] || SYN[x.replace(/s$/, "")]).filter(Boolean);
  let best = null, bs = 0;
  for (const p of all) { const sc = keys.filter(k => (p.place + " " + p.props.join(" ")).includes(k)).length; if (sc > bs) { bs = sc; best = p; } }
  if (best) return best;
  const d = p => bg ? p.palette.bg.reduce((t, x, i) => t + (x - bg[i]) ** 2, 0) : 0;
  return all.slice().sort((a, b) => d(a) - d(b))[0];
}

function brief(v, o = {}) {
  // a vehicle "cube then ship [then ufo ...]" is that many sections: the switches at vehicle.at (song s; a number or a
  // list, one per "then"), else evenly spread
  v = Object.assign({}, v, { beats: [].concat(...(v.beats || []).map(b => {
    const m = String((b.vehicle || {}).mode || "").split(/\s+then\s+/);
    if (m.length < 2) return [b];
    const at = [].concat(b.vehicle.at != null ? b.vehicle.at : []).map(Number);
    const cuts = m.slice(1).map((_, k) => at[k] != null && at[k] > b.t[0] && at[k] < b.t[1] ? at[k] : b.t[0] + (b.t[1] - b.t[0]) * (k + 1) / m.length);
    const edges = [b.t[0], ...cuts, b.t[1]];
    return m.map((md, k) => Object.assign({}, b, { id: (b.id || "") + (k ? " (" + md + ")" : ""), t: [edges[k], edges[k + 1]], vehicle: Object.assign({}, b.vehicle, { mode: md }, b.vehicle.speeds && b.vehicle.speeds[k] ? { speed: b.vehicle.speeds[k] } : {}) }, k ? { transition: {} } : {}));
  })) });
  const grid = songBeats(v.song || {}), period = 60 / grid.bpm, from = (v.song && v.song.from) || 0;
  const tier = (v.feel && v.feel.tier) || "Normal", notes = [];
  // fix 1 (VIBES.md "Results"): a beat with no energy takes the song's own -- its loudness there as a percentile of
  // the song's bars (tools/songmap.js); felt energies disagreed with the measured ones on Time Machine (r 0.47)
  const bars = (() => { try { const B = require("./beats.js"), SM = require("./songmap.js"); const key = v.song.official ? "official_" + OFFICIAL[v.song.official - 1] : "custom_" + v.song.custom;
    const file = (B.allSongs().find(x => x.key === key) || {}).file; return file ? SM.songCache(key, file, grid).bars : null; } catch (e) { return null; } })();
  const loudPct = (a, b) => { if (!bars || !bars.length) return null; const all = bars.map(x => x.loud).sort((p, q) => p - q), w = bars.filter(x => x.t >= a && x.t < b);
    if (!w.length) return null; const m = w.reduce((t, x) => t + x.loud, 0) / w.length; return +(all.filter(x => x < m).length / all.length).toFixed(2); };
  // the level starts on the song's first beat at or after `from`; each beat of the sheet -> whole bars of the song,
  // the boundary rounded to the nearest bar (running, so the total stays on the song)
  const t0 = grid.t0 + Math.ceil((from - grid.t0) / period - 1e-6) * period, offset = +t0.toFixed(3);
  let usedBeats = 0;
  const sections = (v.beats || []).map((b, i) => {
    const endBeat = Math.max(usedBeats + 4, Math.round((b.t[1] + from - t0) / period / 4) * 4);
    const n = endBeat - usedBeats; usedBeats = endBeat;
    const s = { name: (b.id || `beat ${i + 1}`) + (b.place ? ": " + b.place : ""), beats: n };
    const veh = b.vehicle || {}, mode = String(veh.mode || "cube").toLowerCase();
    if (/^(0\.5|1|2|3|4)x$/.test(String(veh.speed || ""))) s.speed = veh.speed;   // the section's speed portal (compose)
    if (/mirror/.test(mode) || /mirror/.test(b.moment || "")) notes.push(`${s.name}: mirror is not simulated -- left out`);
    if (/dual/.test(mode)) notes.push(`${s.name}: dual left out (the composer has no dual section)`);
    const base = mode.replace(/mirror(ed)?|dual|mini/g, "").trim();
    if (/upside/.test(base) && !/ship|wave|ball/.test(base)) s.mode = "upside";
    else if (/^(ship|wave|ball)/.test(base.replace("upside ", ""))) s.mode = base.replace("upside ", "").split(" ")[0];
    let e = b.energy;
    if (e == null) { e = loudPct(b.t[0] + from, b.t[1] + from); if (e != null) notes.push(`${s.name}: energy ${e} from the song's loudness`); else e = 0.5; }
    let [, use, gaps] = BY_ENERGY.find(([lim]) => e < lim);
    // fix 1: density as hazards per block (the beat's "density", else feel.hazards): the gap between chunks from it
    // (a chunk is ~2.5 columns with ~1 hazard a column: h = 2.5 / (2.5 + gap)), denser patterns from 0.8 up
    const hz = typeof b.density === "number" ? b.density : v.feel && typeof v.feel.hazards === "number" ? v.feel.hazards : null;
    if (hz != null && hz > 0) { const g = Math.max(1, Math.round(2.5 * (1 / hz - 1))); gaps = [g, g + 2];
      if (hz >= 0.8) use = [...new Set(["double", "triple", "spikes", "block-spike-block"].concat(use))]; }
    if (!s.mode) {
      const st = STRUCT_MODE[base.split(" ")[0]];
      s.use = st ? [st].concat(use.slice(0, 2)) : use.slice();
      s.gaps = gaps;
      if (st) notes.push(`${s.name}: ${base} as its structure ${st} in a cube section (compose has no ${base} section)`);
      // fix 3: the section's own vehicle only -- the structure library adds a structure per cube section and spreads
      // modes on purpose (GDLM 69 got a ufo, a ball and a wave the sheet never asked for)
      s.structureModes = st ? [base.split(" ")[0]] : ["cube"];
    }
    s._t = b.t; s._place = b.place || ""; s._role = b.role; s._energy = e; s._look = b.look || {}; s._mood = b.mood || ""; s._camera = b.camera || "";
    if (b.role === "intro" && i === 0 && e < 0.35) s.rest = false;
    const pal = (b.look && b.look.palette) || {}, bg = hexRgb(pal.bg);
    if (bg) { s.bg = bg; s.ground = hexRgb(pal.ground) || mix(bg, [0, 0, 0], 0.55); s.line = hexRgb(pal.line) || mix(bg, [255, 255, 255], 0.6); s.obj = [255, 255, 255]; }
    const fade = /fade\s*(\d+(\.\d+)?)/.exec((b.transition && b.transition.in) || ""); if (fade) s.secs = +fade[1];
    if (b.role === "drop" && /flash/i.test(b.moment || "")) s.flash = true;
    if (b.role === "calm" || b.role === "break") s.deco = 0.1;
    return s;
  });
  // a beat with several palettes (look.palettes): cut into that many sections of whole bars, each its own colour
  const out = [];
  sections.forEach((s, i) => {
    const b = v.beats[i], pals = (b.look && b.look.palettes || []).map(hexRgb).filter(Boolean);
    if (pals.length < 2 || s.beats < pals.length * 4) { out.push(s); return; }
    const bars = s.beats / 4; let used = 0;
    pals.forEach((bg, k) => { const nb = Math.round(bars * (k + 1) / pals.length) - used; used += nb;
      out.push(Object.assign({}, s, { name: `${s.name} (${k + 1}/${pals.length})`, beats: nb * 4, bg, ground: mix(bg, [0, 0, 0], 0.55), line: mix(bg, [255, 255, 255], 0.6), secs: k ? 0 : s.secs })); });
  });
  sections.length = 0; sections.push(...out);
  // fix 2: a scene from each beat's place (tools/scenes/planned.js, after the build: collab.js scene / recompile.js):
  // the place's words matched to the section planner's theme packs (tools/scenes.js), else the pack place whose sky is
  // closest to the beat's; the beat's own sky kept. dress "plain" (a 1.x-style level) = no scene and no 2.2 look.
  const plain = v.dress === "plain";
  let cum = 0; const plan = [];
  for (const s of sections) { const t = [+(cum * period).toFixed(3), +((cum + s.beats) * period).toFixed(3)]; cum += s.beats;
    if (!plain) { const pk = pickPlace(s._place + " " + (s._look.scene || "") + " " + s._mood, s.bg);
      plan.push({ t, role: s._role === "calm" || s._role === "break" ? "breather" : s._role, energy: s._energy, mode: s.mode || "cube", fade: s.secs || 0, camera: s._camera || "zoom 1",
        place: pk.place, mood: s._mood || pk.mood, palette: Object.assign({}, pk.palette, s.bg ? { bg: s.bg } : {}, s.ground ? { ground: s.ground } : {}), props: s._look.props || pk.props }); } }
  for (const s of sections) for (const k of Object.keys(s)) if (k.startsWith("_")) delete s[k];
  const noPulse = /pulse|flash|compet/i.test((v.never || []).join(" ")) || /plain|still/i.test(v.camera || "");
  return {
    name: o.name || v.title, desc: (v.desc || String(v.journey || "").split(/(?<=[.!?:])\s/)[0]).slice(0, 140), notes: v.journey || "", idea: v.oneImage || "", story: (v.beats || []).map(b => `${b.t[0]}-${b.t[1]} s ${b.role}: ${b.moment || b.mood || ""}`).join("; "),
    song: Object.assign({}, v.song.official ? { official: v.song.official } : { custom: v.song.custom }), grid: { bpm: grid.bpm, t0: grid.t0 }, offset,
    seed: o.seed || 31, difficulty: { label: tier, minWindowMs: /easy|normal/i.test(tier) ? 60 : 40 }, structures: true, signature: {},
    vibe: v, vibeNotes: notes, sections,
    // fix 3: the sheet's never / camera as switches compose obeys; the scene replaces compose's generic 2.2 look
    ...(noPulse ? { pulses: false } : {}), ...(plain || plan.length ? { modern: false } : {}),
    ...(plan.length ? { levelScene: "tools/scenes/planned.js", scenePlan: { theme: "vibe", barSec: 4 * period, onePalette: v.lookRule !== "shifting", pulses: !noPulse, sections: plan } } : {}),
  };
}
module.exports = { check, brief, LAYERS };

if (require.main === module) {
  const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  if (!a[1]) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
  const v = JSON.parse(fs.readFileSync(a[1], "utf8"));
  if (a[0] === "check") { for (const l of check(v)) console.log(l); }
  else if (a[0] === "brief") {
    const b = brief(v, { name: opt("--name") });
    for (const l of check(v)) console.log("  " + l);
    for (const n of b.vibeNotes) console.log("  note: " + n);
    for (const s of b.sections) console.log(`  ${String(s.beats).padStart(3)} beats  ${(s.mode || "cube").padEnd(7)} ${s.name}${s.use ? "  use " + s.use.join(",") : ""}`);
    if (opt("--out")) { fs.writeFileSync(opt("--out"), JSON.stringify(b, null, 2) + "\n"); console.log("-> " + opt("--out")); }
  } else { console.log("unknown command " + a[0]); process.exit(1); }
}
