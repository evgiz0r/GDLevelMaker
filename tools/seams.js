// node tools/seams.js write briefs/<NN_name>.json     -- the seam contract from the brief + the layout's plan
// node tools/seams.js check briefs/<NN_name>.json [<level.gdlvl>]  -- does the level (default: levels/<base>) keep it?
// node tools/seams.js status briefs/<NN_name>.json <section> <role> <state> [--by <builder>]
//
// Levels are made the way GD collabs are (the user: "usually it is easy to make a level in sections, where those
// section stops are defined, and you can change the gameplay somewhat between them ... one player doing layout,
// other deco and playtest, and it could be separate for each section"). The song plan fixes the section
// boundaries first; each SEAM fixes the state there, and anything inside a section may change as long as its
// seams hold. Sections can then be built (laid out, decorated, playtested, redone) separately, by different
// builders, and joined: the join only checks the seams.
//
// The contract: briefs/<NN_name>.seams.json (committed, next to the brief):
//   { level, song: {custom, offset, bpm, t0}, sections: [{
//       id: "s3", name, beats: [b0, b1], t: [t0, t1] (s), x: [x0, x1] (units, from the speed timeline),
//       in:  { mode, speed, grav, mini, dual, y, vy, grounded, scene: {bg, ground, line, obj} },
//       out: { ...same at the section's end },
//       builder: { layout: "style", deco: "style", playtest: "style" },      (a session name, "human", ...)
//       status:  { layout: "planned" | "built" | "ok" | "redo", deco: ..., playtest: ... } }] }
// y / vy are the player's centre height (units) and vertical speed at the seam; a seam is calm by default: the
// cube grounded at the floor height it stands on there (compose's sections start and end that way).
// Tolerances when checking: y within 8 units, vy within 0.5, mode/speed/grav/mini exact.
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const { GD, readGdlvl } = require("./io.js");
const SY = require("../lib/sync.js");
const SPEED_NAMES = ["0.5x", "1x", "2x", "3x", "4x"];

const fileOf = briefFile => briefFile.replace(/\.json$/, ".seams.json");
const stateAt = (p, x) => { const q = p.find(s => s && s.x >= x) || p[p.length - 1]; return q ? { mode: q.mode, speed: SPEED_NAMES[q.sp] || String(q.sp), grav: q.grav, mini: !!q.mini, dual: !!q.p2, y: +q.y.toFixed(1), vy: +q.vy.toFixed(2), grounded: !!q.grounded } : null; };

// the contract from the brief, the composed spec and a route through it (the layout's driven plan)
function write(briefFile) {
  const brief = JSON.parse(fs.readFileSync(briefFile, "utf8"));
  const C = require("./compose.js"), { build } = require("./make.js"), I = require("./intent.js");
  const { spec, ranges } = C.compose(brief);
  const log0 = console.log; console.log = () => {};
  let built; try { built = build(spec, briefFile); } finally { console.log = log0; }
  const w = GD.makeWorld(built.level.objects, built.level.header), tl = SY.SYNC.timeline(w);
  const { intents } = I.intents(built.ctx.placements || [], tl, { raw: built.ctx.raw });
  const v = I.verify(w, built.level, intents, { maxRepairs: 6 }), p = GD.run(w, v.events).path;
  let old = null; try { old = JSON.parse(fs.readFileSync(fileOf(briefFile), "utf8")); } catch (e) {}
  let b = 1;
  const sections = brief.sections.map((s, i) => {
    const b0 = b; b += s.beats || 0;
    const rg = ranges[i], x0 = rg[2] * 30, x1 = rg[3] * 30, prev = old && old.sections && old.sections[i];
    const scene = { bg: s.bg, ground: s.ground, line: s.line, obj: s.obj };
    return { id: "s" + i, name: s.name, beats: s.beats ? [b0, b] : null, t: [+SY.SYNC.tOfX(tl, x0).toFixed(3), +SY.SYNC.tOfX(tl, x1).toFixed(3)], x: [x0, x1],
      in: Object.assign(stateAt(p, x0) || {}, { scene }), out: Object.assign(stateAt(p, x1 - 1) || {}, { scene }),
      builder: (prev && prev.builder) || { layout: brief.session || "style", deco: brief.session || "style", playtest: brief.session || "style" },
      status: (prev && prev.status) || { layout: "planned", deco: "planned", playtest: "planned" } };
  });
  const out = { level: brief.name, brief: path.relative(ROOT, briefFile).replace(/\\/g, "/"), song: { custom: brief.song && brief.song.custom, offset: brief.offset || 0, bpm: brief.grid && brief.grid.bpm, t0: brief.grid && brief.grid.t0 },
    planOk: v.ok, sections };
  fs.writeFileSync(fileOf(briefFile), JSON.stringify(out, null, 1));
  return out;
}

// does a level keep the contract? replays its saved route (or its plan) and compares the state at each seam
function check(briefFile, levelFile) {
  const c = JSON.parse(fs.readFileSync(fileOf(briefFile), "utf8"));
  const brief = JSON.parse(fs.readFileSync(briefFile, "utf8"));
  const L = readGdlvl(levelFile || path.join(ROOT, "levels", require("./make.js").slug(brief.name) + ".gdlvl"));
  const sol = require("./solutions.js").get(L.levelStr) || require("./solutions.js").get(L.levelStr, true);
  if (!sol || !sol.events) return { ok: false, problems: ["no saved route for the level (node tools/solutions.js)"] };
  const w = GD.makeWorld(L.level.objects, L.level.header), p = GD.run(w, sol.events).path, problems = [];
  const cmp = (want, got, where) => {
    if (!want || !got) return;
    for (const k of ["mode", "speed", "grav", "mini", "dual"]) if (want[k] !== undefined && want[k] !== got[k]) problems.push(`${where}: ${k} ${got[k]} (contract ${want[k]})`);
    if (want.y != null && Math.abs(want.y - got.y) > 8) problems.push(`${where}: y ${got.y} (contract ${want.y})`);
    if (want.vy != null && Math.abs(want.vy - got.vy) > 0.5) problems.push(`${where}: vy ${got.vy} (contract ${want.vy})`);
  };
  for (const s of c.sections) { cmp(s.in, stateAt(p, s.x[0]), `${s.name} in`); cmp(s.out, stateAt(p, s.x[1] - 1), `${s.name} out`); }
  return { ok: !problems.length, problems };
}

function status(briefFile, sectionName, role, state, by) {
  const f = fileOf(briefFile), c = JSON.parse(fs.readFileSync(f, "utf8"));
  const s = c.sections.find(x => x.name === sectionName || x.id === sectionName);
  if (!s) throw new Error("no section " + sectionName);
  s.status[role] = state; if (by) s.builder[role] = by;
  fs.writeFileSync(f, JSON.stringify(c, null, 1));
  return s;
}

module.exports = { write, check, status, fileOf, stateAt };

if (require.main === module) {
  const [cmd, brief, ...rest] = process.argv.slice(2);
  if (!cmd || !brief) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("// node")).join("\n")); process.exit(1); }
  if (cmd === "write") { require("./heavy.js").claim(); const c = write(brief); console.log(`${fileOf(brief)}: ${c.sections.length} sections, plan ${c.planOk ? "plays through" : "has gaps"}`); for (const s of c.sections) console.log(`  ${s.id} ${s.name.padEnd(14)} t ${s.t[0].toFixed(1)}-${s.t[1].toFixed(1)} s  in ${s.in.mode}/${s.in.speed}/g${s.in.grav} y${s.in.y}  out ${s.out.mode}/${s.out.speed}/g${s.out.grav} y${s.out.y}`); }
  else if (cmd === "check") { const r = check(brief, rest[0]); console.log(r.ok ? "every seam holds" : r.problems.join("\n")); process.exit(r.ok ? 0 : 2); }
  else if (cmd === "status") { const bi = rest.indexOf("--by"); const s = status(brief, rest[0], rest[1], rest[2], bi >= 0 ? rest[bi + 1] : null); console.log(s.name, JSON.stringify(s.status)); }
}
