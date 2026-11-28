// node tools/joincheck.js [--from KEY] [--only KEY] [--solve] [--json]  -- are the theme layout's MODE CHANGES where the play is?
//   (Evgeni 2026-11-28, the hellgate card's swing -> ship at col 461: "bad transition, when its flying (or any mode in a way),
//   we could transition from anywhere, not only on the ground. in a way we should transition more around the middle if
//   possible"). For every pair of neighbouring sections of tools/layoutsections.js whose mode changes, the join of
//   lib/scenejoin.js (the same one typebuild.js puts between generated sections) is measured without a solve:
//     drop   rows from the last section's flying exit (scenejoin exitRow) down to the portal's middle,
//     climb  rows from the portal's middle up to the next section's way in (scenejoin entryRow),
//     DIP    when the way goes down to the portal and up again (drop and climb both 3+ rows): the old ground portal,
//     BAND   when the next section's way in lies outside the band the portal sets (5 rows each side of it: physics.js).
//   --solve also builds each flagged or flying-exit pair as a small level (a run-up, the two sections, their joins) and
//   solves it, so a moved portal that no route can take shows as DIES. Exit 1 on any DIP, BAND or DIES.
//   Test: node tests/joincheck.js
"use strict";
const SJ = require("../lib/scenejoin.js"), LS = require("./layoutsections.js");

function pairs(sections) {
  const out = []; let prev = null;
  for (const z of sections) { const cur = { T: LS.tiles(z), w: z.map[0].length, h: z.map.length, mode: z.mode, key: z.key, z };
    if (prev && prev.mode !== cur.mode) out.push([prev, cur]); prev = cur; }
  return out;
}
// one join measured: { from, to, modes, portal row (its middle), drop, climb, flags }
function measure(prev, next) {
  const j = SJ.join(prev, next), p = j.portal; if (!p) return null;
  const mid = p.r + 1, ex = SJ.exitRow(prev), en = SJ.entryRow(next), open = SJ.floorEdge(prev.T, prev.w - 1, "R") === 0 && SJ.ceilEdge(prev.T, prev.w - 1, prev.h, "R") == null;
  const flying = /^(ship|wave|ufo|swing)$/.test(prev.mode) && open && ex != null;
  const drop = flying ? +(ex - mid).toFixed(1) : null, climb = en != null ? +(en - mid).toFixed(1) : null, flags = [];
  if (drop != null && climb != null && drop >= 3 && climb >= 3) flags.push("DIP");
  if (en != null && /^(ship|wave|ufo|swing|ball|spider)$/.test(next.mode) && Math.abs(en - mid) > 4) flags.push("BAND");
  return { from: prev.key, to: next.key, modes: prev.mode + " -> " + next.mode, portalRow: p.r, mid, exit: ex, entry: en, drop, climb, flying, flags, n: j.n };
}
function all(sections = LS.SECTIONS) { return pairs(sections).map(([a, b]) => Object.assign(measure(a, b) || {}, { a, b })).filter(m => m.from); }

// --solve: the pair as one small level (as tools/layoutcheck.js builds one section): run-up, cube -> first section join,
// the first section, the join, the second, its exit join, a flat end; solved by GD.solveAny
function solvePair(a, b) {
  const { GD } = require("./io.js"), { sampleOf, withOffsets } = require("./designthemes.js"), { build } = require("./make.js");
  const PORTAL = { cube: "cube portal", ship: "ship portal", wave: "wave portal", ufo: "ufo portal", ball: "ball portal", robot: "robot portal", spider: "spider portal", swing: "swing portal" };
  const h = Math.max(a.h, b.h), flat = { T: [], w: 1, h }, RUN = 8, objects = [];
  const j0 = SJ.join(Object.assign({ mode: "cube" }, flat), a), j1 = SJ.join(a, b), j2 = SJ.join(b, flat);
  const mapOf = (tiles, n, H) => { const g = Array.from({ length: H }, () => Array(n).fill(".")); for (const q of tiles) if (q.r < H && q.c >= 0 && q.c < n) g[H - 1 - q.r][q.c] = q.t; return g.map(l => l.join("")); };
  const put = (map, dc, offs) => { for (const [kind, c, r, ex] of withOffsets(sampleOf(map), offs)) objects.push(ex ? [kind, c + dc, r, ex] : [kind, c + dc, r]); };
  let x = RUN; put(mapOf(j0.tiles, j0.n, h), x); x += j0.n; const xa = x; put(a.z.map, x, a.z.offsets); x += a.w;
  const xj = x; put(mapOf(j1.tiles, j1.n, h), x); x += j1.n; const xb = x; put(b.z.map, x, b.z.offsets); x += b.w; put(mapOf(j2.tiles, j2.n, h), x); x += j2.n;
  if (a.mode !== "cube") objects.unshift(j0.portal ? [PORTAL[a.mode], RUN + j0.portal.c, j0.portal.r] : [PORTAL[a.mode], RUN - 3, 1]);
  if (j1.portal) objects.push([PORTAL[b.mode], xj + j1.portal.c, j1.portal.r]);
  const spec = { name: "GDLM join check " + a.key + " " + b.key, desc: "Join check", objects, speed: "1x", endCol: x + 12, structures: false, outro: false };
  const t0 = Date.now(); const level = build(spec, "joincheck:" + a.key, {}).level, w = GD.makeWorld(level.objects, level.header), r = GD.solveAny(w);
  const col = r.ok ? null : r.dieAt.x / 30;
  return { ok: !!r.ok, s: +((Date.now() - t0) / 1000).toFixed(1), die: r.ok ? null : { where: col < xj ? a.key : col < xb ? "join" : b.key, col: +(col - (col < xj ? xa : col < xb ? xj : xb)).toFixed(1), why: r.why } };
}

if (require.main === module) {
  const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  if (args.includes("--solve")) require("./heavy.js").claim();
  let ms = all(); const only = opt("--only"); if (only) ms = ms.filter(m => m.from === only || m.to === only);
  let bad = 0;
  for (const m of ms) {
    if (args.includes("--solve") && (m.flying || m.flags.length)) { m.solve = solvePair(m.a, m.b); if (!m.solve.ok) m.flags.push("DIES"); }
    if (m.flags.length) bad++;
    if (!args.includes("--json")) console.log(`${m.flags.length ? "!! " + m.flags.join(" ") : "ok"}  ${m.from} -> ${m.to} (${m.modes}): portal mid row ${m.mid}` +
      (m.drop != null ? `, drop ${m.drop} from the exit (row ${m.exit})` : "") + (m.climb != null ? `, climb ${m.climb} to the way in (row ${m.entry})` : "") +
      (m.solve ? `; solve ${m.solve.ok ? "clears" : "DIES in " + m.solve.die.where + " col " + m.solve.die.col + " (" + m.solve.die.why + ")"} ${m.solve.s} s` : ""));
  }
  if (args.includes("--json")) console.log(JSON.stringify(ms.map(({ a, b, ...m }) => m), null, 1));
  process.exit(bad ? 1 : 0);
}
module.exports = { measure, all, pairs, solvePair };
