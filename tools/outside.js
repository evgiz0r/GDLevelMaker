// node tools/outside.js <level.gdlvl ...> [--json]  -- does a saved route fly AROUND the structures? (Evgeni 2026-11-28: "be
//   careful for secret ways and skipping the structures (in wave for example)"). Replays the saved route (tools/solutions.js)
//   and, column by column, compares the player with the level's solid and hazard objects near it (within 5 blocks ahead and
//   behind): the player is OUTSIDE when it is above everything there (over the top of a corridor) or below everything (under
//   its floor) while something exists in that column. A stretch of 0.4 s or more outside is a skip: the structure was meant
//   to be played through. Riding the ground under a corridor's floor counts (GDLM 78's ship at 6.5 s: "the wrong path"). Prints each stretch with its blocks, time and mode; exit 1 when
//   any is found. Used by tools/typebuild.js --run after the solve.
"use strict";
const path = require("path");
const { GD, readGdlvl } = require("./io.js");
const SOLIDISH = new Set(["solid", "hazard", "slope"]);

function outside(objects, header, events, o = {}) {
  const w = GD.makeWorld(objects, header), run = o.path ? { path: o.path, end: o.path[o.path.length - 1], done: true } : GD.run(w, events), P = run.path;
  // the level's surfaces per block column: top-most and bottom-most solid / hazard, and whether the column is a CORRIDOR (a
  // roof over an open run of 2+ rows over a floor or the ground): over the top of a corridor is a skip, over a bare floor
  // or a bump with open sky is not (GDLM 76's open ship stretch, flappy's gaps between pipes)
  const cols = new Map(), rows = new Map();
  for (const b of w.items || []) { if (!SOLIDISH.has(b.kind)) continue;
    const c0 = Math.floor(b.x0 / 30), c1 = Math.floor((b.x1 - 1) / 30), r0 = Math.max(0, Math.floor(b.y0 / 30)), r1 = Math.floor((b.y1 - 1) / 30);
    for (let c = c0; c <= c1; c++) { const e = cols.get(c) || { top: -Infinity, bot: Infinity }; e.top = Math.max(e.top, b.y1); e.bot = Math.min(e.bot, b.y0); cols.set(c, e);
      const set = rows.get(c) || new Set(); for (let r = r0; r <= r1 && r < 400; r++) set.add(r); rows.set(c, set); } }
  const corridor = c => { const set = rows.get(c); if (!set) return false; const rs = [...set].sort((a, b) => a - b);
    let below = -1;   // the ground counts as a floor at row -1
    for (const r of rs) { if (r - below - 1 >= 2 && below >= -1 && rs.some(q => q < r) || (r - below - 1 >= 2 && below === -1 && r >= 2)) return true; below = r; } return false; };
  // per column the corridor's ROOF top (the highest filled row with an open run of 2+ rows under it and something -- or
  // the ground -- under that) and its FLOOR bottom (the lowest filled row with an open run of 2+ rows over it and something
  // over that): over a ground pillar with open sky, or under a pipe hanging over open ground down to the floor (flappy,
  // GDLM 78 block 516), is the way, not a skip
  const sides = new Map(), sideOf = c => { if (sides.has(c)) return sides.get(c); const set = rows.get(c); let roof = -Infinity, floor = Infinity;
    if (set) { const rs = [...set].sort((a, b) => a - b);
      for (let i = 0; i < rs.length; i++) { const under = i ? rs[i - 1] : -1; if (rs[i] - under - 1 >= 2) { let j = i; while (j + 1 < rs.length && rs[j + 1] === rs[j] + 1) j++; roof = Math.max(roof, (rs[j] + 1) * 30); } }
      for (let i = rs.length - 1; i >= 0; i--) { if (i + 1 < rs.length && rs[i + 1] - rs[i] - 1 >= 2) { let j = i; while (j > 0 && rs[j - 1] === rs[j] - 1) j--; floor = Math.min(floor, rs[j] * 30); } } }
    const v = { roof, floor }; sides.set(c, v); return v; };
  const R = o.reach || 5, near = x => { const c = Math.floor(x / 30); let top = -Infinity, bot = Infinity, n = 0, cor = 0;
    for (let k = c - R; k <= c + R; k++) { const e = sideOf(k); if (e.roof > -Infinity || e.floor < Infinity) { top = Math.max(top, e.roof); bot = Math.min(bot, e.floor); n++; } if (corridor(k)) cor++; }
    return n && cor >= 3 ? { top, bot } : null; };   // at least 3 corridor columns around
  const out = []; let cur = null; const MIN = o.min || 0.4, dt = 1 / 240;
  for (const p of P) {
    const wxy = GD.worldXY ? GD.worldXY(p) : [p.x, p.y], xy = { x: wxy[0], y: wxy[1] }, e = near(xy.x);   // worldXY gives [x, y]
    const off = e && ((e.top > -Infinity && xy.y - 15 > e.top + 15) || (e.bot < Infinity && xy.y < e.bot - 2)) ? (xy.y > e.top ? "above" : "below") : null;
    if (off && cur && cur.side === off) { cur.x1 = xy.x; cur.n++; }
    else { if (cur && cur.n * dt * (o.stride || 1) >= MIN) out.push(cur); cur = off ? { side: off, x0: xy.x, x1: xy.x, n: 1, mode: p.mode, t0: p.t != null ? p.t : null } : null; }
  }
  if (cur && cur.n * dt * (o.stride || 1) >= MIN) out.push(cur);
  return { reach: run.end.x, done: !!run.done, stretches: out.map(s => ({ side: s.side, mode: s.mode, block0: +(s.x0 / 30).toFixed(1), block1: +(s.x1 / 30).toFixed(1) })) };
}
function file(f) {
  const L = readGdlvl(f), s = require("./solutions.js").get(L.levelStr, true);
  if (!s || !s.events) return { name: L.name, none: true };
  // a path point per tick? GD.run's path may be thinned: measure its stride from the x step at 1x
  return Object.assign({ name: L.name }, outside(L.level.objects, L.level.header, s.events));
}

// the same test on a section map (tools/sectiongen.js rows, top row first) and a layoutcheck route ([col, row] points, 8
// ticks apart): the share of route points above or below every cell of a corridor around them -- typebuild.js scores a seed
// down by it, so a generated section whose own solve flies around its structure is not picked
const FILLED = /[#^vosq\/\\7r]/;
function outsideMap(map, route, R = 5) {
  const H = map.length, W = map[0].length, filled = (c, r) => c >= 0 && c < W && r >= 0 && r < H && FILLED.test(map[H - 1 - r][c]);
  const colInfo = []; for (let c = 0; c < W; c++) { let top = -1, bot = H, cor = false, below = -1;
    const rs = []; for (let r = 0; r < H; r++) if (filled(c, r)) { if (r - below - 1 >= 2 && (below >= 0 || r >= 2)) cor = true; rs.push(r); below = r; }
    // roof top / floor bottom as in outside(): a ground pillar's top or a hanging pipe's foot is not a corridor side
    for (let i = 0; i < rs.length; i++) if (rs[i] - (i ? rs[i - 1] : -1) - 1 >= 2) { let j = i; while (j + 1 < rs.length && rs[j + 1] === rs[j] + 1) j++; top = Math.max(top, rs[j]); }
    for (let i = rs.length - 2; i >= 0; i--) if (rs[i + 1] - rs[i] - 1 >= 2) { let j = i; while (j > 0 && rs[j - 1] === rs[j] - 1) j--; bot = Math.min(bot, rs[j]); }
    colInfo.push({ top, bot, cor }); }
  let off = 0, n = 0;
  for (const [c, r] of route || []) { const ci = Math.round(c); let top = -1, bot = H, cors = 0;
    for (let k = ci - R; k <= ci + R; k++) { const e = colInfo[k]; if (!e) continue; if (e.top >= 0) top = Math.max(top, e.top); if (e.bot < H) bot = Math.min(bot, e.bot); if (e.cor) cors++; }
    n++; if (cors >= 3 && ((top >= 0 && r > top + 1) || (bot < H && r < bot - 0.15))) off++; }
  return n ? off / n : 0;
}
module.exports = { outside, outsideMap, file };

if (require.main === module) {
  const args = process.argv.slice(2).filter(a => !a.startsWith("--"));
  if (!args.length) { console.log(require("fs").readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
  let bad = 0; const all = [];
  for (const a of args) { const r = file(a); all.push(r);
    if (process.argv.includes("--json")) continue;
    if (r.none) { console.log(`${r.name}: no saved route`); continue; }
    if (!r.stretches.length) console.log(`${r.name}: the route stays inside the structures`);
    else { bad++; console.log(`${r.name}: ${r.stretches.length} stretch(es) flown around the structures`);
      for (const s of r.stretches) console.log(`   ${s.side} everything, ${s.mode}, blocks ${s.block0}-${s.block1}`); } }
  if (process.argv.includes("--json")) console.log(JSON.stringify(all));
  process.exit(bad ? 1 : 0);
}
