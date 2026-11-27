// node tools/layoutcheck.js [section ...] [--show]  (--show: the route drawn over each section as text)  -- is every theme-layout section PLAYABLE (Evgeni 2026-11-27: "i want
//   the layout to be also playble, all of those should solve, and have some difficulty score. as thats a proof of the
//   coherency. if something is way too hard, like the corridors or some jumps, lets try to make somehow easier ( not
//   forced )"). Each section of tools/layoutsections.js (his edits included) is built alone as a small level: a run-up on
//   the ground, its mode portal, the section joined in and out by lib/scenejoin.js, a flat exit. The solver plays it
//   (GD.solveAny), the difficulty model scores the route (lib/difficulty.js: ~attempts and a label), the tightest windows
//   name the hard presses. -> knowledge/layout_check.json (numbers only; the board shows them) + a line per section.
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
const fs = require("fs"), path = require("path");
const { GD } = require("./io.js");
const DF = require("../lib/difficulty.js");
const SJ = require("../lib/scenejoin.js");
const LS = require("./layoutsections.js");
const { sampleOf } = require("./designthemes.js");
const { build } = require("./make.js");
const PORTAL = { cube: "cube portal", ship: "ship portal", wave: "wave portal", ufo: "ufo portal", ball: "ball portal", robot: "robot portal", spider: "spider portal", swing: "swing portal" };
const RUN = 8;   // run-up columns before the section's join

// one section -> a spec: run-up, portal, entry join, the section, exit join, a flat end
function specOf(z) {
  const T = LS.tiles(z), w = z.map[0].length, h = z.map.length, flat = { T: [], w: 1, h };
  const a = SJ.join(flat, { T, w, h }), b = SJ.join({ T, w, h }, flat), x0 = RUN + a.n;
  const objects = [];
  const put = (map, dc) => { for (const [kind, c, r, ex] of sampleOf(map)) objects.push(ex ? [kind, c + dc, r, ex] : [kind, c + dc, r]); };
  // the joins as text maps too, so sampleOf turns their tiles into the same objects
  const mapOf = (tiles, n) => { const g = Array.from({ length: h }, () => Array(n).fill(".")); for (const q of tiles) if (q.r < h) g[h - 1 - q.r][q.c] = q.t; return g.map(l => l.join("")); };
  put(mapOf(a.tiles, a.n), RUN); put(z.map, x0); put(mapOf(b.tiles, b.n), x0 + w);
  const end = x0 + w + b.n;
  if (z.mode !== "cube") objects.unshift([PORTAL[z.mode], RUN - 3, 1]);
  return { spec: { name: "GDLM layout check " + z.key, desc: "Layout check", objects, endCol: end + 12, structures: false, outro: false },
    x0, x1: x0 + w, end };
}

function check(z) {
  const t0 = Date.now(), S = specOf(z);
  let level;
  try { level = build(S.spec, "layoutcheck:" + z.key, {}).level; } catch (e) { return { key: z.key, name: z.name, mode: z.mode, ok: false, why: "build failed: " + e.message }; }
  const w = GD.makeWorld(level.objects, level.header), r = GD.solveAny(w), out = { key: z.key, name: z.name, mode: z.mode, cols: z.map[0].length, ms: Date.now() - t0 };
  if (!r.ok) { const bx = r.dieAt.x / 30 - S.x0; return Object.assign(out, { ok: false, dieCol: +bx.toFixed(1), dieRow: +(r.dieAt.y / 30).toFixed(1), why: r.why + (r.killer ? " (" + (r.killer.name || r.killer.id || JSON.stringify(r.killer)) + ")" : "") }); }
  // the player's route (lib/natural.js, what the viewer shows) and its player windows (lib/windows.js: the one
  // definition score.js, the viewer and difficulty share); only the section's own inputs count, not the run-up's
  let ev = r.events; try { const n = require("../lib/natural.js").naturalPlan(w, r, level.objects); if (n && n.path[n.path.length - 1].done) ev = n.events; } catch (e) {}
  const p = GD.run(w, ev).path, colOf = t => (p[Math.min(t, p.length - 1)] || {}).x / 30 - S.x0, inSec = t => { const c = colOf(t); return c >= -1 && c <= S.x1 - S.x0 + 1; };
  const presses = ev.filter(e => e.type === "press" && inSec(e.tick)).length;
  let d = null; try { d = DF.difficulty(w, { ok: true, events: ev }, { raw: true, route: false }); } catch (e) { d = null; }
  let tight = [];
  try { tight = require("../lib/windows.js").inputWindows(w, ev, p, {}).filter(x => inSec(x.tick)).map(x => ({ col: +colOf(x.tick).toFixed(1), ms: Math.round((x.hi - x.lo + 1) / GD.PHYS.TPS * 1000), type: x.type }))
    .sort((a, b) => a.ms - b.ms).slice(0, 3); } catch (e) {}
  // the route over the section as text (--show): * where the player's centre passes, P where it presses
  const H = z.map.length, g = z.map.map(l => [...l]);
  for (let t = 0; t < p.length; t += 4) { const c = Math.floor(p[t].x / 30 - S.x0), rr = Math.floor(p[t].y / 30); if (c >= 0 && c < g[0].length && rr >= 0 && rr < H && g[H - 1 - rr][c] === ".") g[H - 1 - rr][c] = "*"; }
  for (const e of ev) if (e.type === "press") { const q = p[Math.min(e.tick, p.length - 1)], c = Math.floor(q.x / 30 - S.x0), rr = Math.floor(q.y / 30); if (c >= 0 && c < g[0].length && rr >= 0 && rr < H) g[H - 1 - rr][c] = "P"; }
  out.show = g.map(l => l.join(""));
  return Object.assign(out, { ok: true, presses, tight, attempts: d ? Math.round(10 ** d.logAttempts) : null, log: d ? +d.logAttempts.toFixed(2) : null, label: d ? DF.difficultyLabel(d.logAttempts) : null });
}

if (require.main === module) {
  const want = process.argv.slice(2).filter(a => !a.startsWith("--"));
  const out = [];
  for (const z of LS.SECTIONS) { if (want.length && !want.includes(z.key)) continue; const c = check(z); out.push(c);
    console.log(c.ok ? `${z.key.padEnd(14)} ${z.mode.padEnd(6)} solves: ${c.presses} presses, ${c.label} (~${c.attempts} attempts)${c.tight.length ? ", tightest " + c.tight.map(t => t.ms + " ms (" + t.type + ") at col " + t.col).join(", ") : ""}  [${(c.ms / 1000).toFixed(0)} s]`
      : `${z.key.padEnd(14)} ${z.mode.padEnd(6)} DOES NOT SOLVE: dies at col ${c.dieCol}, row ${c.dieRow}: ${c.why}  [${((c.ms || 0) / 1000).toFixed(0)} s]`); }
  if (process.argv.includes("--show")) for (const c of out) if (c.show) console.log("\n" + c.key + ":\n" + c.show.map(l => "  " + l).join("\n"));
  for (const c of out) delete c.show;
  const f = path.join(__dirname, "..", "knowledge", "layout_check.json"), old = (() => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return {}; } })();
  for (const c of out) old[c.key] = Object.assign(c, { at: new Date().toISOString().slice(0, 16) });
  fs.writeFileSync(f, JSON.stringify(old, null, 1) + "\n"); console.log("-> knowledge/layout_check.json");
}
module.exports = { specOf, check };
