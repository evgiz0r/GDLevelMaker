// node tools/variety.js <level.gdlvl | official N | gdlm | community> [...]  -- is there enough to do, and does it vary?
//
// Numbers that may tell a "bland" level from a rated one (the user called GDLM 44 bland; see
// knowledge/critiques.md). Layout only, plus presses where a solution exists. Per level:
//   haz cols    share of columns with a hazard (tools/tiercheck.js has it per section)
//   groups/s    hazard groups per second (a run of hazard columns; a new group = an empty column between)
//   orbs+pads   orbs and pads per minute
//   portals     every portal (mode, speed, gravity, size, mirror, dual...) per minute
//   modes       distinct game modes; speeds: distinct speeds
//   toolbox     distinct kinds of gameplay thing: hazards by shape, orbs/pads/portals by name
//   unique      share of gameplay chunks (tools/style.js chunks: islands of hazards/blocks up to 12
//               columns) whose picture is not repeated earlier in the level
//   quiet s     longest stretch with no hazard, in seconds (at the section's speed)
//   presses/s   from the saved natural replay of a repo level (local/solutions/); "-" for official and
//               community levels (see official() below)
//   gdlm       = every levels/gdlm_*.gdlvl
//   community  = the rated community levels in local/community/list.json, Easy..Harder, one child
//               process each (2.2 levels are big), printed with medians per tier and era
// The write-up is knowledge/levels/variety.md.
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const style = require("./style.js");
const corpus = require("./corpus.js");
const { readGdlvl } = require("./io.js");

const ROOT = path.join(__dirname, "..");
const COMM = path.join(ROOT, "local", "community");
const med = a => { a = a.filter(Number.isFinite); if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const f = (v, d = 1) => Number.isFinite(v) ? (+v).toFixed(d) : "-";
// a kind of gameplay thing: hazards by shape (spike, small spike, saw, box...), orbs, pads and
// portals by name, so skins of the same spike count once
const { GD } = require("./io.js");
const kindOf = o => { const d = GD.objInfo(o.id); return d.kind === "hazard" ? "hazard:" + (d.shape || "box") : d.name; };
const BPS = { "0.5x": 8.4, "1x": 10.4, "2x": 12.9, "3x": 15.6, "4x": 19.2 };

function measure(L, presses) {
  const a = style.analyse(L);
  const min = a.secs / 60;
  const cat = o => style.classify(o.id).cat;
  const game = L.objects.filter(o => ["hazard", "orb", "pad", "portal"].includes(cat(o)));
  const hazCols = [...new Set(L.objects.filter(o => cat(o) === "hazard").map(o => Math.floor(o.x / 30)))].sort((p, q) => p - q);
  let groups = hazCols.length ? 1 : 0;
  for (let i = 1; i < hazCols.length; i++) if (hazCols[i] - hazCols[i - 1] > 1) groups++;
  // longest hazard-free stretch in seconds, using the speed of the section it starts in
  const speedAt = col => { let sp = "1x"; for (const s of a.sections) if (s.from <= col) sp = s.speed; return sp; };
  let quiet = 0;
  const edges = [0].concat(hazCols, [Math.floor(a.blocks)]);
  for (let i = 1; i < edges.length; i++) quiet = Math.max(quiet, (edges[i] - edges[i - 1] - 1) / BPS[speedAt(edges[i - 1])]);
  const ch = style.chunks(L).filter(c => c.pic.length > 1);
  const seen = new Set(); let fresh = 0;
  for (const c of ch) { if (!seen.has(c.pic)) fresh++; seen.add(c.pic); }
  return {
    secs: a.secs, hazCols: hazCols.length / Math.max(1, a.blocks), groupsPerSec: groups / Math.max(1, a.secs),
    actsPerMin: game.filter(o => ["orb", "pad"].includes(cat(o))).length / min,
    portalsPerMin: game.filter(o => cat(o) === "portal").length / min,
    modes: new Set(a.sections.map(s => s.mode)).size, speeds: new Set(a.sections.map(s => s.speed)).size,
    toolbox: new Set(game.map(kindOf)).size, unique: ch.length ? fresh / ch.length : NaN, chunks: ch.length,
    quiet, pressesPerSec: Number.isFinite(presses) ? presses / a.secs : NaN,
  };
}
const countPresses = events => events ? events.filter(e => e.type === "press").length : NaN;

// official levels: no presses here. local/difficulty/NN.json holds the solver's fewest-press route
// (Stereo Madness: 24 presses, against 119 inputs on the human route in DIFFICULTY.md), which is
// not what a player does; DIFFICULTY.md's "Tier ladder" has the human-route inputs per second.
function official(n) {
  return { name: "official " + n + " " + corpus.NAMES[n - 1], ...measure(corpus.official(n), NaN) };
}
function file(fp) {
  const R = readGdlvl(fp);
  let p = NaN;
  try { const s = require("./solutions.js").get(R.levelStr, true); if (s && s.ok) p = countPresses(s.events); } catch (e) {}
  return { name: R.name, ...measure(corpus.file(fp), p) };
}

const HEAD = "| level | s | haz cols | groups/s | orbs+pads /min | portals /min | modes | speeds | toolbox | unique | quiet s | presses/s |\n|---|---|---|---|---|---|---|---|---|---|---|---|";
const row = (label, r) => `| ${label} | ${f(r.secs, 0)} | ${Math.round(100 * r.hazCols)}% | ${f(r.groupsPerSec, 2)} | ${f(r.actsPerMin, 0)} | ${f(r.portalsPerMin, 0)} | ${f(r.modes, 0)} | ${f(r.speeds, 0)} | ${f(r.toolbox, 0)} | ${Number.isFinite(r.unique) ? Math.round(100 * r.unique) + "%" : "-"} | ${f(r.quiet)} | ${f(r.pressesPerSec, 2)} |`;
const medRow = (label, R) => { const m = {}; for (const k of Object.keys(R[0] || {})) m[k] = med(R.map(r => r[k])); return row(`${label} (n=${R.length})`, m); };

const args = process.argv.slice(2);
if (args[0] === "one") { process.stdout.write(JSON.stringify(measure(corpus.file(path.join(COMM, args[1] + ".gdlvl"))))); return; }
if (!args.length) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); return; }
const rows = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "official") rows.push(official(+args[++i]));
  else if (args[i] === "gdlm") for (const fn of fs.readdirSync(path.join(ROOT, "levels")).filter(x => /^gdlm_.*\.gdlvl$/.test(x)).sort()) rows.push(file(path.join(ROOT, "levels", fn)));
  else if (args[i] === "community") {
    const list = JSON.parse(fs.readFileSync(path.join(COMM, "list.json"), "utf8")), C = [];
    for (const l of list) {
      if (!fs.existsSync(path.join(COMM, l.id + ".gdlvl"))) continue;
      try { C.push({ ...l, ...JSON.parse(execFileSync(process.execPath, ["--max-old-space-size=1500", __filename, "one", l.id], { windowsHide: true, encoding: "utf8", maxBuffer: 1 << 24 })) }); }
      catch (e) { console.error("skip", l.id, l.name); }
    }
    fs.writeFileSync(path.join(COMM, "variety.json"), JSON.stringify(C, null, 1));
    console.log(HEAD);
    for (const t of ["Easy", "Normal", "Hard", "Harder"]) for (const e of ["2.0-2.1", "2.2", "1.x"]) { const R = C.filter(r => r.tier === t && r.era === e); if (R.length >= 3) console.log(medRow(`${t}, ${e}`, R)); }
    console.log(`\n${C.length} levels -> local/community/variety.json`);
  }
  else rows.push(file(args[i]));
}
if (rows.length) { console.log(HEAD); for (const r of rows) console.log(row(r.name, r)); }
