// node tools/heightspread.js <level.gdlvl | official:N | save:<name>> [...] [--json]
// How a level's gameplay spreads over the height (Evgeni 2026-11-27: "if our gameplay height distribution is good across
// the y in all modes of the level (using reverse or what not), it will make it a better level than all game focused on
// small part of y"). From the saved route (tools/solutions.js; none -> it says so, no solve here): the player's centre every
// 4 ticks, in rows above the ground; per mode and for the whole level: the rows used (lowest..highest), the share of the
// 0..12-row screen band they cover, and evenness (normalised entropy of time per row, 0..1). Upside-down time is counted
// too (gravity -1), since flipping is one of the ways to use the height. Soft target (knowledge/checklist.md): whole level
// cover >= 0.6 and even >= 0.6; one mode stuck in <= 3 rows for its whole stretch is a note.
const { GD } = require("./io.js"), { levelOf } = require("./shoot.js");
const a = process.argv.slice(2);
if (!a[0] || a[0].startsWith("--")) { console.log(require("fs").readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
const ROWS = 12;

function spreadOf(path) {
  const by = {}, all = Array(ROWS).fill(0); let flip = 0, n = 0;
  for (let t = 0; t < path.length; t += 4) { const s = path[t], r = Math.max(0, Math.min(ROWS - 1, Math.floor(s.y / 30)));
    (by[s.mode] = by[s.mode] || Array(ROWS).fill(0))[r]++; all[r]++; n++; if (s.grav === -1) flip++; }
  const stat = per => { const tot = per.reduce((x, y) => x + y, 0) || 1, used = per.map((v, i) => v ? i : -1).filter(i => i >= 0);
    const ent = per.reduce((e, v) => v ? e - (v / tot) * Math.log(v / tot) : e, 0);
    return { lo: used[0], hi: used[used.length - 1], cover: +(used.length / ROWS).toFixed(2), even: +(ent / Math.log(ROWS)).toFixed(2), share: +(tot / (n || 1)).toFixed(2) }; };
  const modes = {}; for (const [m, per] of Object.entries(by)) modes[m] = stat(per);
  return { level: stat(all), modes, upsideDown: +(flip / (n || 1)).toFixed(2), rows: all };
}

function forLevel(w) {
  const L = levelOf(w), level = GD.parseLevel(L.levelStr), sol = L.solution || require("./solutions.js").get(L.levelStr, true);
  if (!sol || !sol.events) return { name: L.name, err: "no saved route (solve it first: node tools/solutions.js)" };
  const path = GD.run(GD.makeWorld(level.objects, level.header), sol.events).path;
  return Object.assign({ name: L.name }, spreadOf(path));
}

if (require.main === module) {
  const out = a.filter(x => !x.startsWith("--")).map(forLevel);
  if (a.includes("--json")) console.log(JSON.stringify(out));
  else for (const r of out) { if (r.err) { console.log(`${r.name}: ${r.err}`); continue; }
    const v = r.level, narrow = v.cover < 0.6 || v.even < 0.6;
    console.log(`${r.name}: rows ${v.lo}-${v.hi}, cover ${Math.round(v.cover * 100)}%, even ${v.even}, upside down ${Math.round(r.upsideDown * 100)}% of the time${narrow ? "  (NARROW)" : ""}`);
    for (const [m, s] of Object.entries(r.modes)) console.log(`  ${m.padEnd(7)} ${Math.round(s.share * 100)}% of time, rows ${s.lo}-${s.hi}, even ${s.even}${s.hi - s.lo <= 2 && s.share > 0.1 ? "  (stuck in " + (s.hi - s.lo + 1) + " rows)" : ""}`); }
}
module.exports = { spreadOf, forLevel };
