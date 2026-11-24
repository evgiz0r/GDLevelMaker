// node tools/coordinator.js plan <brief> [--look shared|per-part]  -- the coordinator's brief for a collab build, written
//                                                                   BEFORE any part: briefs/<NN_name>.coord.json
// node tools/coordinator.js review <brief>                         -- each built part against its role -> ok / send back
//                                                                   with a reason (before the join)
// node tools/coordinator.js show <brief>                           -- the brief as text
//
// The user (2026-11-24): "first a coordinator of the collab, so they don't just combine. and each has 'thanks for playing'
// for example. he gives them roles, and whether he makes the picture or them is a choice (i guess them to have different
// possible styles per section if we want)." BUILDING.md section 1 "The coordinator".
//
// A VIBE SHEET (gd-showcase's format, VIBES.md; briefs/<NN>.vibe.json, written by a person in a minute) is read when there
// is one: its beats' role, energy, place, mood, vehicle, moment, look and must / must-not win over the derived ones; the
// coordinator adds the build constraints (density, gaps, difficulty, contrast, seam blend). The brief keeps the sheet's
// field names (title, journey, oneImage, song.shape, lookRule, camera, feel, never; per beat place, vehicle, moment).
// The brief:
//   { level, journey, look: "shared" | "per-part", lookRules: { contrast, seamBlendSecs }, moodCurve: [energy per part],
//     parts: [{ id, t, role: intro|build|drop|calm|finale, energy 0-1, mood, density: { gaps }, difficulty,
//               look: { style, bg, ground, line } (per-part), transition: { in, out }, must: [...], mustNot: [...],
//               setPieces: [the structures this part owns] }] }
// Roles come from the song plan: the first part is the intro, the last the finale, a part with a drop (a section marked
// "flash", or a flying section after a cube one) is a drop, the part before a drop builds up, the others are calm or
// build by position. Rules every part gets: the title only in the intro, the ending (end text, signature) only in the
// finale, no set piece repeated across parts (each library structure belongs to one part), and its seam contract.
// Look: "shared" = the coordinator's palettes (the brief's sections) for every part; "per-part" = each part brings its
// own style from a pool, within the coordinator's rules (path vs sky contrast >= 3, colours blend over seamBlendSecs at
// each seam).
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const fileOf = bf => bf.replace(/\.json$/, ".coord.json");
const readJ = f => JSON.parse(fs.readFileSync(f, "utf8"));
const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const darken = (c, k) => c.map(v => Math.round(v * k));

// the style pool for per-part looks: each a sky, a path and a line; the path is darkened until it reads (contrast >= 3)
const STYLES = [
  { style: "dawn pastel", bg: [255, 190, 160], ground: [120, 60, 70], line: [255, 240, 230] },
  { style: "desert gold", bg: [250, 200, 110], ground: [120, 70, 20], line: [255, 250, 220] },
  { style: "forest", bg: [120, 190, 130], ground: [25, 60, 30], line: [210, 255, 200] },
  { style: "ice", bg: [150, 210, 240], ground: [20, 60, 100], line: [235, 250, 255] },
  { style: "neon night", bg: [70, 40, 140], ground: [10, 5, 30], line: [255, 120, 240] },
  { style: "crimson", bg: [210, 80, 70], ground: [50, 10, 10], line: [255, 210, 200] },
  { style: "violet dusk", bg: [170, 110, 190], ground: [50, 20, 70], line: [250, 220, 255] },
  { style: "deep sea", bg: [40, 110, 150], ground: [5, 30, 50], line: [170, 240, 255] },
];
const ROLE = {
  intro: { energy: 0.3, gaps: [4, 6], diff: -1, mood: "calm, inviting: learn the level" },
  build: { energy: 0.6, gaps: [3, 5], diff: 0, mood: "rising: more each bar" },
  drop: { energy: 1, gaps: [2, 3], diff: 0, mood: "the peak: dense, fast, on the beat" },
  calm: { energy: 0.4, gaps: [4, 6], diff: -1, mood: "a breather: room to look" },
  finale: { energy: 0.8, gaps: [2, 4], diff: 0, mood: "a last push, then home" },
};
const TIERS = ["Easy", "Normal", "Hard", "Harder", "Insane", "Demon"];

function plan(briefFile, opts = {}) {
  const brief = readJ(briefFile), C = require("./collab.js");
  const planFile = path.join(ROOT, "local", "collab", path.basename(briefFile, ".json"), "plan.json");
  const P = fs.existsSync(planFile) ? readJ(planFile) : C.split(briefFile);
  const n = P.parts.length, secOf = i => brief.sections[i];
  const isDrop = p => p.sections.some((i, j) => { const s = secOf(i), prev = secOf(i - 1); return s.flash || (s.mode && s.mode !== "upside" && prev && !prev.mode); });
  const roles = P.parts.map((p, k) => k === 0 ? "intro" : k === n - 1 ? "finale" : isDrop(p) ? "drop" : null);
  for (let k = 1; k < n - 1; k++) if (!roles[k]) roles[k] = roles[k + 1] === "drop" ? "build" : (k % 2 ? "calm" : "build");
  // a vibe sheet next to the brief: its beats by time (the part whose middle falls in a beat takes it)
  let vibe = null; try { vibe = readJ(briefFile.replace(/.json$/, ".vibe.json")); } catch (e) {}
  const beatOf = p => vibe && vibe.beats && vibe.beats.find(b => (p.t[0] + p.t[1]) / 2 >= b.t[0] && (p.t[0] + p.t[1]) / 2 < b.t[1]);
  if (vibe) P.parts.forEach((p, k) => { const b = beatOf(p); if (b && b.role) roles[k] = b.role === "break" ? "calm" : b.role; });
  const lookRule = vibe && vibe.lookRule, look = opts.look || (lookRule === "per-part" || lookRule === "shifting" ? "per-part" : lookRule ? "shared" : null) || brief.look || "shared", lab = (brief.difficulty || {}).label || "Normal";
  // each library structure belongs to one part (no repeated set pieces): first come, first served in part order
  const owned = new Set();
  const parts = P.parts.map((p, k) => {
    const R = ROLE[roles[k]] || ROLE.build, vb = beatOf(p) || {}, uses = [...new Set(p.sections.flatMap(i => secOf(i).use || []))].filter(u => u.startsWith("s:"));
    const setPieces = uses.filter(u => !owned.has(u)); setPieces.forEach(u => owned.add(u));
    let st = null;
    if (look === "per-part") {
      st = Object.assign({}, STYLES[(k * 3 + (brief.seed || 0)) % STYLES.length]);
      for (let g = 0; g < 8 && ratio(st.bg, st.ground) < 3; g++) st.ground = darken(st.ground, 0.8);
    }
    const di = Math.max(0, Math.min(TIERS.length - 1, TIERS.indexOf(lab) + R.diff));
    if (vb.look && vb.look.palette && look === "per-part") st = Object.assign({ style: vb.look.scene || vb.place || "from the vibe sheet" }, vb.look.palette);
    const modes = [...new Set(p.sections.map(i => secOf(i).mode || "cube"))];
    return { id: p.id, t: p.t, role: roles[k], energy: vb.energy ?? R.energy, mood: vb.mood || R.mood, place: vb.place || null,
      vehicle: vb.vehicle || { mode: modes.join(" + "), speed: p.speedIn }, moment: vb.moment || null, density: { gaps: R.gaps }, difficulty: TIERS[di],
      look: st, transition: { in: k === 0 ? "level start" : `from ${roles[k - 1]}: colours blend over ${brief.seamBlendSecs ?? 1.7} s`, out: k === n - 1 ? "the ending" : `into ${roles[k + 1]}` },
      must: [...(vb.must || []), k === 0 ? "the title" : null, k === n - 1 ? "the ending: end text + signature" : null, "its seam contracts", `a ${roles[k]}'s density (gaps ${R.gaps.join("-")})`].filter(Boolean),
      mustNot: [...(vb.mustNot || []), k > 0 ? "a title" : null, k < n - 1 ? "an ending (no 'thanks for playing', no signature)" : null, "another part's set pieces"].filter(Boolean),
      setPieces };
  });
  const coord = { level: brief.name, title: (vibe && vibe.title) || brief.name, brief: path.relative(ROOT, briefFile).split(path.sep).join("/"), at: new Date().toISOString(),
    vibe: vibe ? path.relative(ROOT, briefFile.replace(/.json$/, ".vibe.json")).split(path.sep).join("/") : null,
    journey: (vibe && vibe.journey) || brief.story || brief.idea || brief.desc || "", oneImage: (vibe && vibe.oneImage) || null,
    song: { shape: parts.map(p => ({ t: p.t, part: p.role })) }, lookRule: (vibe && vibe.lookRule) || look, camera: (vibe && vibe.camera) || null,
    feel: (vibe && vibe.feel) || { tier: (brief.difficulty || {}).label || null }, never: (vibe && vibe.never) || [], look, lookRules: look === "per-part" ? { contrast: 3, seamBlendSecs: brief.seamBlendSecs ?? 1.7 } : { palettes: "the brief's sections" },
    moodCurve: parts.map(p => p.energy), difficultyCurve: parts.map(p => p.difficulty), parts };
  fs.writeFileSync(fileOf(briefFile), JSON.stringify(coord, null, 1));
  return coord;
}
const load = briefFile => { try { return readJ(fileOf(briefFile)); } catch (e) { return null; } };

// a part's brief under the coordinator's: its gaps by role, its style (per-part look), its set pieces only, the seam blend
function applyTo(sub, cp, coord) {
  if (!cp) return sub;
  for (const s of sub.sections) {
    if (s.use && !s.mode && !s.rest) s.gaps = s.gaps || cp.density.gaps;
    // no set piece of another part: a library structure this part does not own is left out
    if (s.use) { const own = new Set(cp.setPieces); s.use = s.use.filter(u => !u.startsWith("s:") || own.has(u)); if (!s.use.length) s.use = ["single", "double"]; }
    if (coord.look === "per-part" && cp.look) { s.bg = cp.look.bg; s.ground = cp.look.ground; s.line = cp.look.line; }
  }
  if (coord.look === "per-part") sub.sections[0] = Object.assign({}, sub.sections[0], { secs: coord.lookRules.seamBlendSecs });
  sub.difficulty = Object.assign({}, sub.difficulty || {}, { label: cp.difficulty });
  sub._role = cp.role;
  return sub;
}

// review: each built part against its role, before the join
function review(briefFile) {
  const coord = load(briefFile); if (!coord) throw new Error("no coordinator's brief: node tools/coordinator.js plan " + briefFile);
  const { GD, readGdlvl } = require("./io.js"), dir = path.join(ROOT, "local", "collab", path.basename(briefFile, ".json"));
  const out = [], hz = []; const texts = lv => lv.objects.filter(o => o.id === 914 && o.props && o.props[31]).map(o => { try { return Buffer.from(String(o.props[31]).replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(); } catch (e) { return ""; } });
  for (const cp of coord.parts) {
    let L, r; try { L = readGdlvl(path.join(dir, cp.id + ".gdlvl")); r = readJ(path.join(dir, cp.id + ".json")); } catch (e) { out.push({ id: cp.id, ok: false, why: ["not built"] }); continue; }
    const why = [], t = texts(L.level), k = coord.parts.indexOf(cp), last = k === coord.parts.length - 1;
    if (k > 0 && t.some(x => x.toLowerCase().includes(String(coord.level).toLowerCase()))) why.push("has the level's title (only the intro may)");
    if (!last && t.some(x => /thanks for playing|made by claude/i.test(x))) why.push("has an ending (only the finale may)");
    const blocks = Math.max(1, r.L / 30), haz = L.level.objects.filter(o => (GD.objInfo(o.id) || {}).kind === "hazard" && o.x >= 0 && o.x <= r.L).length / blocks * 100;
    hz.push(haz); cp._haz = haz;
    if (r.patterns) { const others = coord.parts.filter(q => q !== cp).flatMap(q => q.setPieces); const dup = r.patterns.filter(u => u.startsWith("s:") && others.includes(u)); if (dup.length) why.push("uses another part's set piece: " + [...new Set(dup)].join(", ")); }
    out.push({ id: cp.id, role: cp.role, haz: +haz.toFixed(1), ok: true, why });
  }
  // density by role: a drop at least as dense as the level's middle, an intro / calm part no denser than it
  const med = hz.slice().sort((a, b) => a - b)[Math.floor(hz.length / 2)] || 0;
  for (const o of out) {
    if (o.role === "drop" && o.haz < med * 0.9) o.why.push(`a drop with fewer hazards (${o.haz}/100 blocks) than the level's middle (${med.toFixed(1)})`);
    if ((o.role === "intro" || o.role === "calm") && o.haz > med * 1.3) o.why.push(`a ${o.role} denser (${o.haz}) than the level's middle (${med.toFixed(1)})`);
    o.ok = !o.why.length;
  }
  const res = { at: new Date().toISOString(), parts: out, median: +med.toFixed(1), send: out.filter(o => !o.ok).map(o => o.id) };
  fs.writeFileSync(path.join(dir, "review.json"), JSON.stringify(res, null, 1));
  return res;
}

module.exports = { plan, load, applyTo, review, fileOf, STYLES, ROLE };

if (require.main === module) {
  const [cmd, bf, ...rest] = process.argv.slice(2), opt = k => { const i = rest.indexOf(k); return i >= 0 ? rest[i + 1] : null; };
  if (!cmd || !bf) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("// node")).join("\n")); process.exit(1); }
  const show = c => { console.log(`${c.level}: look ${c.look}; journey: ${c.journey}`); for (const p of c.parts) console.log(`  ${p.id} ${p.role.padEnd(6)} energy ${p.energy} ${p.difficulty.padEnd(7)} gaps ${p.density.gaps.join("-")}${p.look ? "  style " + p.look.style : ""}  set pieces: ${p.setPieces.join(", ") || "-"}  | must not: ${p.mustNot.join("; ")}`); };
  if (cmd === "plan") show(plan(bf, { look: opt("--look") }));
  else if (cmd === "show") show(load(bf));
  else if (cmd === "review") { const r = review(bf); for (const o of r.parts) console.log(`  ${o.id} ${String(o.role).padEnd(6)} ${o.ok ? "ok      " : "SEND BACK"} hazards ${o.haz}/100${o.why.length ? "  -- " + o.why.join("; ") : ""}`); console.log(r.send.length ? "send back: " + r.send.join(", ") : "every part fits its role"); process.exit(r.send.length ? 2 : 0); }
}
