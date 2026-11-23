// node tools/scenes.js <song> [--from-bar B] [--bars N | --secs S] [--theme haunted] [--tier Easy]
//                      [--brief briefs/NN_name.json --name "GDLM NN name"] [--json]
//   -- the SECTION PLANNER: a song's structure -> a plan of scenes, one row per section: bars and time,
//      energy, its role (intro / groove / build / drop / breather / outro), a place from a theme (mood,
//      palette, props), the mode that suits the energy, the transition on its first bar and the camera or
//      2.2 effect on its big hit. --brief also writes a compose brief (tools/compose.js) with the
//      sections in beats, modes and colours, and the plan in "scenePlan" for the scene script / props.
//   <song>  a custom song id (619544) or "custom_619544" / "official_3"; needs its song analysis in
//           local/songmap/<key>.json (node tools/songmap.js --songs, SYNC.md section 7).
//   --from-bar / --bars / --secs  the part of the song the level uses (default: from 4 bars before the
//           song's first drop, 60 s). --theme: a theme pack below (default: one picked from the song's
//           mood: dark + steady -> haunted, light -> meadow ...). --tier: the difficulty the modes are for.
// Rules (why each section gets what it gets): SCENES.md. The user, 2026-11-23, after playing rated
// illustrated levels: each section is "a little place that changes with the song (graveyard, then
// factory, then forest)"; ours "change colour and mode but don't tell anything".
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");

// ---- theme packs: places from calm to climax, each with its mood, palette and props --------------
// props are names for the props library (gd-art session, tools/props.js) or scenekit recipes; a scene
// script places them. Palettes: bg, ground, fill (gameplay blocks), edge (their lit line), accent.
// Places are generic GD-world vocabulary, nothing copied from a particular level.
const THEMES = {
  haunted: { mood: "spooky, playful", places: [
    { place: "graveyard", calm: 0.1, mood: "quiet, moonlit", palette: { bg: [34, 28, 60], ground: [20, 16, 34], fill: [26, 22, 44], edge: [150, 140, 220], accent: [255, 220, 120] }, props: ["moon", "tombstones", "dead trees", "fence", "fog", "bats"] },
    { place: "church ruin", calm: 0.35, mood: "eerie", palette: { bg: [44, 26, 56], ground: [24, 14, 30], fill: [36, 20, 44], edge: [190, 130, 220], accent: [255, 170, 90] }, props: ["broken arches", "stained window", "candles", "crows"] },
    { place: "haunted factory", calm: 0.7, mood: "mechanical, tense", palette: { bg: [30, 40, 34], ground: [14, 20, 16], fill: [24, 32, 26], edge: [140, 255, 150], accent: [255, 120, 60] }, props: ["gears", "pipes", "chimneys", "green smoke", "chains"] },
    { place: "pumpkin field", calm: 0.9, mood: "wild, the climax", palette: { bg: [60, 22, 12], ground: [30, 10, 6], fill: [44, 16, 10], edge: [255, 150, 60], accent: [255, 220, 90] }, props: ["jack-o-lanterns", "big moon", "witch silhouette", "embers"] },
    { place: "dark forest", calm: 0.25, mood: "hushed", palette: { bg: [16, 30, 30], ground: [8, 16, 16], fill: [12, 24, 24], edge: [120, 220, 200], accent: [200, 255, 150] }, props: ["tall trees", "glowing eyes", "fireflies", "mist"] },
  ] },
  ocean: { mood: "floating, calm", places: [
    { place: "sunlit shallows", calm: 0.1, mood: "bright", palette: { bg: [26, 150, 186], ground: [16, 96, 120], fill: [14, 72, 94], edge: [160, 255, 240], accent: [255, 190, 80] }, props: ["water surface", "light rays", "kelp", "fish school", "bubbles"] },
    { place: "jellyfish drift", calm: 0.5, mood: "dreamy", palette: { bg: [16, 92, 150], ground: [8, 54, 96], fill: [8, 44, 80], edge: [120, 225, 255], accent: [255, 110, 230] }, props: ["jellyfish", "bubbles", "rocks"] },
    { place: "current reef", calm: 0.8, mood: "rushing", palette: { bg: [10, 34, 96], ground: [4, 16, 52], fill: [6, 20, 62], edge: [140, 180, 255], accent: [255, 130, 110] }, props: ["coral", "rocks", "fast bubbles"] },
    { place: "abyss", calm: 0.2, mood: "dark, watched", palette: { bg: [2, 6, 16], ground: [0, 2, 6], fill: [2, 10, 18], edge: [60, 255, 200], accent: [255, 236, 120] }, props: ["glowing plankton", "eyes in the dark"] },
  ] },
  sky: { mood: "wide, hopeful", places: [
    { place: "dusk city", calm: 0.15, mood: "warm", palette: { bg: [52, 22, 78], ground: [30, 12, 48], fill: [36, 14, 56], edge: [255, 140, 100], accent: [255, 196, 90] }, props: ["skyline", "lit windows", "horizon glow"] },
    { place: "cloud layer", calm: 0.5, mood: "rising", palette: { bg: [24, 14, 58], ground: [14, 8, 36], fill: [22, 12, 50], edge: [180, 130, 255], accent: [230, 230, 255] }, props: ["clouds", "stars", "wind lines"] },
    { place: "space", calm: 0.9, mood: "the climax", palette: { bg: [4, 3, 12], ground: [0, 0, 0], fill: [14, 10, 30], edge: [140, 120, 230], accent: [255, 255, 255] }, props: ["planet", "stars", "rings"] },
    { place: "dawn", calm: 0.1, mood: "relief", palette: { bg: [214, 104, 120], ground: [96, 34, 70], fill: [92, 32, 70], edge: [255, 230, 210], accent: [255, 230, 160] }, props: ["skyline", "sun", "birds"] },
  ] },
  meadow: { mood: "happy, light", places: [
    { place: "meadow", calm: 0.1, mood: "sunny", palette: { bg: [140, 210, 255], ground: [90, 170, 80], fill: [120, 190, 100], edge: [255, 255, 220], accent: [255, 220, 90] }, props: ["hills", "flowers", "clouds", "butterflies"] },
    { place: "orchard", calm: 0.4, mood: "busy", palette: { bg: [255, 220, 170], ground: [150, 110, 70], fill: [190, 140, 90], edge: [255, 250, 230], accent: [255, 110, 90] }, props: ["trees", "fruit", "fence"] },
    { place: "windmill hill", calm: 0.8, mood: "gusty", palette: { bg: [120, 180, 255], ground: [60, 130, 70], fill: [90, 150, 90], edge: [255, 255, 255], accent: [255, 200, 60] }, props: ["windmill", "wind lines", "kites"] },
    { place: "sunset lake", calm: 0.2, mood: "slow", palette: { bg: [255, 170, 130], ground: [70, 90, 140], fill: [90, 100, 150], edge: [255, 235, 200], accent: [255, 140, 80] }, props: ["lake", "reeds", "sun"] },
  ] },
};

// ---- roles -> modes (Easy/Normal) ---------------------------------------------------------------
// calm = cube or ball platforming, a build-up = ship or UFO, a drop = wave or a fast cube, a breather =
// slow, the cube upside down or the robot; the next section never repeats the mode before it.
const MODES = {
  intro: ["cube"], groove: ["cube", "ball", "robot", "upside"], build: ["ship", "ufo"],
  ride: ["upside", "ball", "ufo", "robot", "cube", "wave", "ship"],   // the loud phrases after a drop's first one (may keep the drop's mode)
  drop: ["wave", "cube 2x", "ship"], breather: ["cube 0.5x", "robot", "upside"], outro: ["cube"],
};
// compose.js modes (it builds "ship", "wave", "ball", "upside" sections and plain cube ones)
const COMPOSE_MODE = { ship: "ship", wave: "wave", ball: "ball", upside: "upside" };

function loadSong(arg) {
  const key = /^\d+$/.test(arg) ? "custom_" + arg : arg;
  const f = path.join(ROOT, "local", "songmap", key + ".json");
  if (!fs.existsSync(f)) throw new Error(`no song analysis ${f}: run "node tools/songmap.js --songs" (the song must be on this PC)`);
  return JSON.parse(fs.readFileSync(f, "utf8"));
}

function plan(song, o = {}) {
  const barSec = song.period * 4, bars = song.bars;
  const firstDrop = (song.sections.find(s => s.kind === "drop") || { bar: 4 }).bar;
  const b0 = o.fromBar ?? Math.max(0, firstDrop - 4);
  const n = o.bars ?? Math.round((o.secs ?? 60) / barSec);
  const b1 = Math.min(bars.length, b0 + n);
  // boundaries: the song's own section changes inside the window, then 4-bar phrases for stretches of 8+
  // bars (a new little place every ~4 bars, ~7 s), merged so no section is under 2 bars
  let cuts = [b0, ...song.sections.filter(s => s.bar > b0 + 1 && s.bar < b1 - 1).map(s => s.bar), b1];
  const out = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    let a = cuts[i]; const c = cuts[i + 1];
    while (c - a >= 8) { out.push(a); a += 4; }
    out.push(a);
  }
  out.push(b1);
  cuts = out.filter((b, i) => i === 0 || i === out.length - 1 || b - out[i - 1] >= 2);
  const kindAt = b => (song.sections.find(s => s.bar === b) || {}).kind;
  const loudOf = (a, c) => bars.slice(a, c).reduce((s, x) => s + x.loud, 0) / Math.max(1, c - a);
  const clarOf = (a, c) => bars.slice(a, c).reduce((s, x) => s + x.clar, 0) / Math.max(1, c - a);
  const secs = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i], c = cuts[i + 1], h = Math.floor((a + c) / 2);
    secs.push({ bars: [a - b0, c - b0], songBars: [a, c], t: [+((a - b0) * barSec).toFixed(2), +((c - b0) * barSec).toFixed(2)],
      loud: +loudOf(a, c).toFixed(1), clar: +clarOf(a, c).toFixed(2), rise: +(loudOf(h, c) - loudOf(a, h)).toFixed(1), kind: kindAt(a) || (i === 0 ? "start" : "phrase") });
  }
  // energy 0..1: loudness (70%) and beat clarity (30%), ranked within the level's own range
  const lo = Math.min(...secs.map(s => s.loud)), hi = Math.max(...secs.map(s => s.loud)), clo = Math.min(...secs.map(s => s.clar)), chi = Math.max(...secs.map(s => s.clar));
  for (const s of secs) s.energy = +(0.7 * (s.loud - lo) / Math.max(1, hi - lo) + 0.3 * (s.clar - clo) / Math.max(0.1, chi - clo)).toFixed(2);
  // roles
  secs.forEach((s, i) => {
    const next = secs[i + 1], prev = secs[i - 1];
    if (i === 0) s.role = "intro";
    // the last section is the outro unless it is a drop the level ends on (then the signature follows it)
    else if (i === secs.length - 1 && secs.length > 2 && !(s.kind === "drop" || s.energy >= 0.75)) s.role = "outro";
    // a drop is the song's own drop, or the first loud phrase after a quieter one; the loud phrases
    // that follow it "ride" it (intense, but another mode and place: four drops in a row read as one)
    else if (s.kind === "drop" || (s.energy >= 0.75 && !(prev && prev.energy >= 0.75))) s.role = "drop";
    else if (s.energy >= 0.75) s.role = "ride";
    else if (prev && prev.role === "drop" && (s.kind === "break" || s.loud < prev.loud - 3)) s.role = "breather";
    else if (next && (next.kind === "drop" || next.energy >= 0.75) && (s.rise > 1 || s.energy >= 0.35)) s.role = "build";
    else s.role = s.energy < 0.3 ? "breather" : "groove";
  });
  // a theme: the user's, else from the song's mood (dark and steady -> haunted; bright -> meadow)
  const theme = THEMES[o.theme] ? o.theme : (song.bpm >= 150 ? "sky" : song.clarityMedian > 3 ? "haunted" : "ocean");
  const places = THEMES[theme].places;
  // places: intro the calmest; drops the most intense; breathers the quiet ones; builds in between; a
  // place is not used twice in a row, and the outro returns to the first (the journey home)
  const byCalm = [...places].sort((p, q) => p.calm - q.calm);
  let prevPlace = null; const used = new Map();
  for (const s of secs) {
    const want = { intro: 0, groove: 0.35, build: 0.55, drop: 1, ride: 0.75, breather: 0.2, outro: 0 }[s.role];
    let cands = byCalm.filter(p => p !== prevPlace).sort((p, q) => Math.abs(p.calm - want) + 0.3 * (used.get(p) || 0) - Math.abs(q.calm - want) - 0.3 * (used.get(q) || 0));
    if (s.role === "outro") cands = [byCalm[0]];
    s.scene = cands[0]; prevPlace = s.scene; used.set(s.scene, (used.get(s.scene) || 0) + 1);
  }
  // modes: a section keeps the mode before it unless its energy class changes (calm / build / loud /
  // breather) or that mode has run 8 bars -- the places change every phrase, the modes on the song's big
  // turns (score.js "mode changes": official levels 1.3-5.2 a minute; TASTE_DATA.md: fewer swaps rate
  // better). A new mode: from the role's list, never the one just before, one the level has not used first.
  const CLASS = { intro: "calm", groove: "calm", outro: "calm", build: "build", drop: "loud", ride: "loud", breather: "breather" };
  let prevMode = null, prevClass = null, run = 0; const usedM = new Set();
  for (const s of secs) {
    const len = s.bars[1] - s.bars[0], cls = CLASS[s.role];
    if (prevMode && cls === prevClass && run < 8 && MODES[s.role].includes(prevMode)) { s.mode = prevMode; run += len; continue; }
    const ok = MODES[s.role].filter(x => x !== prevMode);
    const m = ok.find(x => !usedM.has(x.split(" ")[0])) || ok[0] || MODES[s.role][0];
    s.mode = m; prevMode = m; prevClass = cls; run = len; usedM.add(m.split(" ")[0]);
  }
  // transitions and effects: on each section's first bar. The palette fade length follows the role
  // (instant into a drop, a bar into a build, two bars into a breather); the camera: zoom out on a drop
  // (see more of the place), in on a breather; one soft sky tint shift on the level's biggest hit only
  // (TASTE.md: calm, never white). The big hit = the largest loudness jump into a section.
  let big = null;
  secs.forEach((s, i) => { if (i && (!big || s.loud - secs[i - 1].loud > big.d)) big = { s, d: s.loud - secs[i - 1].loud }; });
  for (const s of secs) {
    s.fade = { drop: 0, ride: barSec / 2, build: barSec, breather: 2 * barSec, outro: 2 * barSec, groove: barSec / 2, intro: 0 }[s.role];
    s.camera = s.role === "drop" ? "zoom 0.85" : s.role === "breather" ? "zoom 1.1" : "zoom 1";
    s.effects = [];
    if (big && s === big.s) s.effects.push("the level's one sky tint shift (towards a lighter tint of the place's bg, not white)");
    if (s.role === "drop") s.effects.push("props move with the beat on bar starts (bob/sway), particles faster");
    if (s.role === "build") s.effects.push("parallax speeds up; light grows over the section");
    if (s.role === "breather") s.effects.push("fewer props, slow motion (sway, drift), dim edges");
  }
  return { song: song.key, bpm: song.bpm, period: song.period, barSec, fromBar: b0, toBar: b1, offset: +(song.bar0 + b0 * barSec).toFixed(4), theme, sections: secs };
}

function toBrief(p, o) {
  return {
    name: o.name || "GDLM NN " + p.theme,
    idea: `a scene level from the section planner (tools/scenes.js): ${p.sections.map(s => s.scene.place).join(" -> ")}`,
    difficulty: { label: o.tier || "Easy", minWindowMs: 60 },
    song: { custom: +String(p.song).replace(/\D/g, "") }, offset: p.offset,
    sections: p.sections.map(s => {
      const m = s.mode.split(" ")[0], sec = { name: `${s.role}: ${s.scene.place}`, beats: (s.bars[1] - s.bars[0]) * 4, bg: s.scene.palette.bg, ground: s.scene.palette.ground, secs: +s.fade.toFixed(2) };
      if (COMPOSE_MODE[m]) sec.mode = COMPOSE_MODE[m];
      if (s.role === "intro" || s.role === "outro") sec.rest = s.role === "outro";
      return sec;
    }),
    scenePlan: p,
  };
}

module.exports = { plan, toBrief, THEMES, MODES, loadSong };

if (require.main === module) {
  const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  if (!a[0] || a[0].startsWith("--")) { console.log("usage: node tools/scenes.js <song> [--from-bar B] [--bars N | --secs S] [--theme " + Object.keys(THEMES).join("|") + "] [--brief file --name \"GDLM NN x\"] [--json]"); process.exit(1); }
  const song = loadSong(a[0]);
  const p = plan(song, { fromBar: opt("--from-bar") != null ? +opt("--from-bar") : undefined, bars: opt("--bars") != null ? +opt("--bars") : undefined, secs: opt("--secs") != null ? +opt("--secs") : undefined, theme: opt("--theme") });
  console.log(`${song.key}: ${song.bpm} BPM, bars ${p.fromBar}-${p.toBar} (song second ${p.offset}), theme "${p.theme}" (${THEMES[p.theme].mood})`);
  console.log("  bars    seconds      energy role      place              mode       fade  camera     loud/clar");
  for (const s of p.sections)
    console.log(`  ${String(s.bars[0]).padStart(2)}-${String(s.bars[1]).padEnd(3)} ${String(s.t[0]).padStart(5)}-${String(s.t[1]).padEnd(6)} ${String(s.energy).padEnd(6)} ${s.role.padEnd(9)} ${s.scene.place.padEnd(18)} ${s.mode.padEnd(10)} ${s.fade.toFixed(1).padStart(4)}  ${s.camera.padEnd(10)} ${s.loud}/${s.clar}  props: ${s.scene.props.join(", ")}${s.effects.length ? "  | " + s.effects.join("; ") : ""}`);
  if (opt("--brief")) { fs.writeFileSync(opt("--brief"), JSON.stringify(toBrief(p, { name: opt("--name"), tier: opt("--tier") }), null, 2)); console.log("brief -> " + opt("--brief")); }
  if (a.includes("--json")) { fs.mkdirSync(path.join(ROOT, "local", "plans"), { recursive: true }); const f = path.join(ROOT, "local", "plans", `${song.key}_${p.fromBar}.json`); fs.writeFileSync(f, JSON.stringify(p, null, 1)); console.log("plan -> " + f); }
}
