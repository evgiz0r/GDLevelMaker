// node tools/clusters.js <level.gdlvl ...> [--gate]
//
// Uneven spike clusters (the user on GDLM 44 v13 at block ~85: "this looks like very bad jump": a single
// spike nudged against a red pad, spikes overlapping). A soft rule (CLAUDE.md: a level may break it with a
// stated reason): hazards on one surface should read as clean groups with an even rhythm. Flags (WARN):
//   overlap   two hazards whose centres are under 0.8 block apart on the same surface (doubled / stacked)
//   ragged    a group with an uneven gap inside it: hazards 1 or 2 empty columns apart (reads as a typo,
//             neither one jump nor two)
//   crowded   a hazard within 1.5 blocks before a pad or ring (you land in the pad's spot or skip it)
// (Not flagged: hazards off the block grid. Beat-placed columns are fractional on purpose, e.g. b10+1 =
// block 39.86, and a whole group shifted together reads fine.)
// Prints each spot with its block; --gate exits 1 when any is found. Static: no solve, milliseconds.
// POLISH.md "Soft rules from the user's notes".
const fs = require("fs");
const { readGdlvl } = require("./io.js");
const O = require("../lib/objects.js");
const args = process.argv.slice(2).filter(a => !a.startsWith("--"));
if (require.main === module && !args.length) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }

const PADS = new Set([35, 67, 140, 1332, 3005, 36, 84, 141, 1022, 1333, 3004]);
function check(objs) {
  const out = [];
  const haz = objs.filter(o => (O.objInfo(o.id) || {}).kind === "hazard" && !(o.props && (o.props[121] === "1" || o.props[134] === "1")));
  // surfaces: by the hazard's base height (rounded to half a block) and rotation (floor / ceiling)
  const key = o => Math.round(o.y / 15) + ":" + (Math.round((o.rot || 0) / 90) % 4 + 4) % 4;
  const bySurf = new Map();
  for (const o of haz) { const k = key(o); if (!bySurf.has(k)) bySurf.set(k, []); bySurf.get(k).push(o); }
  for (const list of bySurf.values()) {
    list.sort((a, b) => a.x - b.x);
    for (let i = 1; i < list.length; i++) {
      const d = (list[i].x - list[i - 1].x) / 30;
      if (d < 0.8) out.push({ kind: "overlap", x: list[i].x, note: `hazards ${d.toFixed(2)} block apart (ids ${list[i - 1].id}, ${list[i].id})` });
      else if (d > 1.2 && d < 3.2 && list[i].id === list[i - 1].id) {
        // a gap of 1-2 empty columns between two hazards: ragged unless it repeats (a steady pattern)
        const prev = i > 1 ? (list[i - 1].x - list[i - 2].x) / 30 : null, next = i + 1 < list.length ? (list[i + 1].x - list[i].x) / 30 : null;
        const steady = (prev && Math.abs(prev - d) < 0.3) || (next && Math.abs(next - d) < 0.3);
        if (!steady) out.push({ kind: "ragged", x: list[i].x, note: `a ${(d - 1).toFixed(1)}-column gap inside a spike group` });
      }
    }
  }
  for (const p of objs.filter(o => PADS.has(o.id) && (o.id === 35 || o.id === 67 || o.id === 140 || o.id === 1332 || o.id === 3005))) {
    const near = haz.filter(h => h.x < p.x && p.x - h.x < 45 && Math.abs(h.y - p.y) < 30);
    if (near.length) out.push({ kind: "crowded", x: p.x, note: `a hazard ${((p.x - near[near.length - 1].x) / 30).toFixed(1)} block before a pad` });
  }
  return out.sort((a, b) => a.x - b.x);
}

if (require.main === module) {
  let total = 0;
  for (const f of args) {
    const L = readGdlvl(f), r = check(L.level.objects); total += r.length;
    const by = {}; for (const s of r) by[s.kind] = (by[s.kind] || 0) + 1;
    console.log(`${L.name}: ${r.length ? Object.entries(by).map(([k, n]) => n + " " + k).join(", ") : "clean"}`);
    for (const s of r) console.log(`   block ${(s.x / 30 - 0.5).toFixed(1).padStart(6)}  ${s.kind.padEnd(8)} ${s.note}`);
  }
  process.exit(process.argv.includes("--gate") && total ? 1 : 0);
}
module.exports = { check };
