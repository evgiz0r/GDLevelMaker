// node tools/portalground.js <level.gdlvl | official | community> ... [--gate]
//
// A mode portal over a pit (the user on GDLM 44 hellgate round 2, the ship portal between two raised
// blocks: "not a fan of such ship entering. the empty below makes it slightly bad. would probably prefer
// flat ground in such paths"). The user's taste, so a soft rule (a warning): a mode portal (not cube)
// sits over flat, continuous ground or a platform -- the surface under it and the 2 columns before it at
// one height, with no hazard there. Flagged: a PIT (the ground under the portal lower than both 2 columns
// before and 1 after) or a hazard; a plain step (off a ledge) is only counted, not flagged. Also flagged:
// a portal whose box starts a cube's height or more above the ground under it (a walking cube passes under it).
// For each such portal: the surface in each of those 3 columns = the top of the highest solid cell
// below the portal (or the ground). Flags "pit" when they differ by a row or more or a hazard sits there.
// Portals more than 5 rows above that surface (reached in the air, inside a corridor) are skipped.
// "official" = every local/official_NN.json, "community" = every local/community/*.gdlvl: prints how often
// rated levels do it (the rule's reference). Static: milliseconds per level. POLISH.md "Soft rules".
const fs = require("fs"), path = require("path");
const GDL = require("../lib/gd.js"), O = require("../lib/objects.js");
const { readGdlvl } = require("./io.js");
const ROOT = path.join(__dirname, "..");
const MODE = { 13: "ship", 660: "wave", 111: "ufo", 47: "ball", 1331: "spider", 745: "robot", 1933: "swing" };

function check(objs) {
  const solid = objs.filter(o => { const k = (O.objInfo(o.id) || {}).kind; return (k === "solid" || k === "slope") && !(o.props && (o.props[121] === "1" || o.props[134] === "1")); });
  const haz = objs.filter(o => (O.objInfo(o.id) || {}).kind === "hazard");
  const out = [];
  for (const p of objs.filter(o => MODE[o.id])) {
    const pc = Math.floor(p.x / 30), tops = [];
    let hz = false;
    for (let c = pc - 2; c <= pc + 1; c++) {
      const under = solid.filter(o => Math.floor(o.x / 30) === c && o.y + 15 <= p.y);
      const top = under.length ? Math.max(...under.map(o => o.y + 15)) : 0;
      tops.push(top);
      if (haz.some(h => Math.floor(h.x / 30) === c && h.y >= top - 5 && h.y <= top + 45)) hz = true;
    }
    const hi = Math.max(...tops), lo = Math.min(...tops);
    if ((p.y - hi) / 30 > 5) continue;                       // high in the air: a corridor or an orb jump
    // a pit: the ground under the portal (its column or the one before) lower than on both sides
    const mid = Math.min(tops[1], tops[2]), pit = tops[0] - mid >= 30 && tops[3] - mid >= 30;
    // above: the portal's box ends more than a cube's height above the ground under it -- a cube walking there
    // passes UNDER it and never changes mode (GDLM 44 round 3: the solver walked under the second wave portal and
    // climbed the corridor as a cube; a secret way). The portal must reach the walking line.
    const sc = +((p.props && p.props[32]) || 1), bottom = p.y - 43 * sc, above = bottom >= Math.max(tops[0], tops[1], tops[2]) + 30;   // the highest of the 2 columns before and under it: a cube dropping off a ledge there is still falling into it
    if (above && !pit && !hz) out.push({ x: p.x, mode: MODE[p.id], kind: "above", note: `its box starts ${((bottom - Math.max(tops[0], tops[1], tops[2])) / 30).toFixed(1)} rows above the ground: a walking cube passes under it` });
    else if (pit || hz) out.push({ x: p.x, mode: MODE[p.id], kind: hz ? "hazard" : "pit", note: hz ? "a hazard under the portal" : `a pit under it (ground rows ${tops.map(t => t / 30).join(", ")}: from 2 before to 1 after)` });
    else if (hi - lo >= 30) out.push({ x: p.x, mode: MODE[p.id], kind: "step", info: true, note: `a step under it (rows ${tops.map(t => t / 30).join(", ")})` });
  }
  return out;
}

function files(a) {
  if (a === "official") return fs.readdirSync(path.join(ROOT, "local")).filter(f => /^official_\d+\.json$/.test(f)).map(f => path.join(ROOT, "local", f));
  if (a === "community") { const d = path.join(ROOT, "local", "community"); return fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith(".gdlvl")).map(f => path.join(d, f)) : []; }
  return [a];
}
function load(f) {
  if (f.endsWith(".json")) { const j = JSON.parse(fs.readFileSync(f, "utf8")); return { name: j.name || path.basename(f), objects: GDL.parseLevel(j.level).objects }; }
  const L = readGdlvl(f); return { name: L.name, objects: L.level.objects };
}

if (require.main === module) {
  const args = process.argv.slice(2).filter(a => !a.startsWith("--"));
  if (!args.length) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
  let total = 0;
  for (const a of args) {
    const list = files(a), group = list.length > 1 || a === "official" || a === "community";
    let portals = 0, pits = 0, levels = 0, levelsWith = 0, stepsN = 0;
    for (const f of list) {
      let L; try { L = load(f); } catch (e) { continue; }
      const all = check(L.objects), r = all.filter(s => !s.info), steps = all.length - r.length;
      const n = L.objects.filter(o => MODE[o.id]).length;
      portals += n; pits += r.length; stepsN += steps; levels++; if (r.length) levelsWith++;
      if (!group) { total += r.length; console.log(`${L.name}: ${r.length ? r.length + " mode portal(s) over a pit" : "clean"} (${n} mode portals)`); for (const s of r) console.log(`   block ${(s.x / 30 - 0.5).toFixed(1).padStart(6)}  ${s.mode} portal: ${s.note}`); }
    }
    if (group) console.log(`${a}: ${levels} levels, ${portals} mode portals: ${pits} over a pit or a hazard (${portals ? (100 * pits / portals).toFixed(0) : 0}%, in ${levelsWith} levels), ${stepsN} more over a step (${portals ? (100 * stepsN / portals).toFixed(0) : 0}%)`);
  }
  process.exit(process.argv.includes("--gate") && total ? 1 : 0);
}
module.exports = { check };
