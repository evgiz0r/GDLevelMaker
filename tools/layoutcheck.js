// node tools/layoutcheck.js [section ...] [--show] [--skips]  (--skips: can any portal inside be flown around? a solve per portal)  (--show: the route drawn over each section as text)  -- is every theme-layout section PLAYABLE (Evgeni 2026-11-27: "i want
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
// at the speed it will be played at (z.speedName, "2x" ...: GDLM 78's 2x swing was checked at 1x and solved there, then
// died at 2x in the level, and the level's solve flew over its saws)
function specOf(z) {
  const T = LS.tiles(z), w = z.map[0].length, h = z.map.length, flat = { T: [], w: 1, h };
  // the join in front as a level's join is (lib/scenejoin.js): the cube rides its ramp and meets the section's mode portal
  // in the join's gated last column (was: the portal before the join, so a ball rode a tall entry's ramp and died there)
  const a = SJ.join(Object.assign({ mode: "cube" }, flat), { T, w, h, mode: z.mode }), b = SJ.join({ T, w, h }, flat), x0 = RUN + a.n;
  const objects = [];
  const put = (map, dc) => { for (const [kind, c, r, ex] of sampleOf(map)) objects.push(ex ? [kind, c + dc, r, ex] : [kind, c + dc, r]); };
  // the joins as text maps too, so sampleOf turns their tiles into the same objects
  const mapOf = (tiles, n) => { const g = Array.from({ length: h }, () => Array(n).fill(".")); for (const q of tiles) if (q.r < h && q.c >= 0 && q.c < n) g[h - 1 - q.r][q.c] = q.t; return g.map(l => l.join("")); };
  put(mapOf(a.tiles, a.n), RUN); put(z.map, x0); put(mapOf(b.tiles, b.n), x0 + w);
  // join tiles that lie on the section itself (the wave's slide-safe D cells, lib/scenejoin.js): in its empty cells
  const on = [...a.tiles.filter(q => q.c >= a.n).map(q => ({ t: q.t, c: q.c - a.n, r: q.r })), ...b.tiles.filter(q => q.c < 0).map(q => ({ t: q.t, c: w + q.c, r: q.r }))]
    .filter(q => q.c >= 0 && q.c < w && q.r < h && z.map[h - 1 - q.r][q.c] === ".");
  if (on.length) put(mapOf(on, w).map(l => l.replace(/[^D]/g, ".")), x0);
  const end = x0 + w + b.n;
  if (z.mode !== "cube") objects.unshift(a.portal ? [PORTAL[z.mode], RUN + a.portal.c, a.portal.r] : [PORTAL[z.mode], RUN - 3, 1]);
  return { spec: { name: "GDLM layout check " + z.key, desc: "Layout check", objects, speed: z.speedName || "1x", endCol: end + 12, structures: false, outro: false },
    x0, x1: x0 + w, end };
}

// the same hash the page computes from a part's tiles (designs_tab.js hashTiles): sorted "t,c,r" cells
function hashMap(map) { const cells = []; map.forEach((l, i) => [...l].forEach((ch, c) => { if (ch !== ".") cells.push(ch + "," + c + "," + (map.length - 1 - i)); }));
  cells.sort(); let h = 0; for (const ch of cells.join(";")) h = (h * 31 + ch.charCodeAt(0)) | 0; return h; }
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
  // the route for the board (designs_tab.js "〰 solver path"): points in section cells (c across, r up from the ground,
  // the player's centre), every 8 ticks, inside the section only; presses marked; hash of the map it was solved on, so
  // the board can tell when he has drawn since (then the route is shown as old)
  out.route = []; for (let t = 0; t < p.length; t += 8) { const c = p[t].x / 30 - S.x0, rr = p[t].y / 30 - 0.5; if (c >= -0.5 && c <= z.map[0].length + 0.5) out.route.push([+c.toFixed(2), +rr.toFixed(2)]); }
  out.taps = ev.filter(e => e.type === "press" && inSec(e.tick)).map(e => { const q = p[Math.min(e.tick, p.length - 1)]; return [+(q.x / 30 - S.x0).toFixed(2), +(q.y / 30 - 0.5).toFixed(2)]; });
  // MOVE SIZE (Evgeni 2026-11-27: "in the 'jumping' modes, the average length of movement is below the half of the full
  // length, just to have less updown from ground to floor"): the route's vertical legs (turning points of y inside the
  // section), their mean height in rows and as a share of the room (the mode's band, or the section's height): the soft
  // target is under 0.5
  { const ys = []; for (let t = 0; t < p.length; t += 4) { const c = p[t].x / 30 - S.x0; if (c >= 0 && c <= z.map[0].length) ys.push(p[t].y / 30); }
    const legs = []; let a0 = ys[0], dir = 0;
    for (let i = 1; i < ys.length; i++) { const d = Math.sign(ys[i] - ys[i - 1]); if (!d) continue;
      if (dir && d !== dir) { legs.push(Math.abs(ys[i - 1] - a0)); a0 = ys[i - 1]; } dir = d; }
    if (ys.length) legs.push(Math.abs(ys[ys.length - 1] - a0));
    const big = legs.filter(x => x >= 0.5), room = Math.min(z.map.length, { ball: 8, spider: 9, ship: 10, ufo: 10, wave: 10, swing: 10 }[z.mode] || z.map.length);
    const mean = big.length ? big.reduce((s, x) => s + x, 0) / big.length : 0;
    out.move = { legs: big.length, mean: +mean.toFixed(2), share: +(mean / room).toFixed(2), room };
    // HEIGHT SPREAD (Evgeni 2026-11-27: "if our gameplay height distribution is good across the y in all modes of the level
    // (using reverse or what not), it will make it a better level than all game focused on small part of y"; flying "should
    // also be able and hit the ground/floor as part of the path"): which rows of the section's height the player's centre
    // spends time in. used = share of rows visited at all, even = how evenly (normalised entropy of the time per row, 0..1);
    // soft target: used >= 0.6 and even >= 0.6. A whole level sums its sections (tools/heightspread.js does that from a route).
    const H = z.map.length, per = Array(H).fill(0); for (const y of ys) { const r = Math.max(0, Math.min(H - 1, Math.floor(y))); per[r]++; }
    const tot = per.reduce((a, b) => a + b, 0) || 1, ent = per.reduce((e, n) => n ? e - (n / tot) * Math.log(n / tot) : e, 0);
    // EXTREMES (Evgeni 2026-11-27: "all our sections should involve the ground/floor at some of the play. even those fully
    // blocked (ball / spider ...) we should allow some of the gameplay on the more extremes"): does the route reach the
    // bottom row and the top rows of its room (the mode's band, or the section) at least once
    const used = per.map((n, r) => n ? r : -1).filter(r => r >= 0), top = Math.min(H, room) - 1;
    // the rows a player can be in at all: not solid or hazard all the way across, and inside the mode's band (a band
    // mode never leaves its 10 rows unless a hidden same-mode portal moves the band: W H U A L P R in the map); `used`
    // is the share of those (Evgeni 2026-11-27: "can we try 100% spread or close in all generations")
    const movers = z.map.some(l => /[WHUALPR]/.test(l)), cap = movers ? H : Math.min(H, room);
    const open = [...Array(cap).keys()].filter(r => [...z.map[H - 1 - r]].some(ch => !"#/\\7r^vosq".includes(ch))).length || H;
    out.spread = { used: +Math.min(1, used.length / open).toFixed(2), playable: open, even: +(H > 1 ? ent / Math.log(H) : 1).toFixed(2), rows: per,
      low: used.length ? used[0] <= 1 : false, high: used.length ? used[used.length - 1] >= top - 1 : false }; }
  // SKIPPABLE PORTALS (--skips; Evgeni 2026-11-27: "need to be careful in flying modes, that we cant skip the portal after
  // us just by flying around it (or the reverse in the way)"): each portal inside the section is turned into a killer of
  // its own size (three spikes scaled x3 down its middle) and the section solved again: if it still clears, a route
  // exists that never touches that portal -- a skip. One solve per portal, so only on demand.
  if (process.argv.includes("--skips")) { const PK = new Set([10, 11, 12, 13, 47, 111, 660, 745, 1331, 1933]), x0 = S.x0 * 30, x1 = x0 + z.map[0].length * 30;
    out.skips = [];
    for (const p of level.objects.filter(o => PK.has(o.id) && o.x > x0 + 15 && o.x < x1)) {
      const objs = level.objects.filter(o => o !== p).concat([-30, 0, 30].map(dy => ({ id: 8, x: p.x, y: p.y + dy, rot: 0, flipX: false, flipY: false, props: { 32: "3" } })));
      const r2 = GD.solveAny(GD.makeWorld(objs, level.header));
      if (r2.ok) out.skips.push({ col: +(p.x / 30 - S.x0).toFixed(1), row: +(p.y / 30).toFixed(1), id: p.id }); } }
  out.mapHash = hashMap(z.map);
  return Object.assign(out, { ok: true, presses, tight, attempts: d ? Math.round(10 ** d.logAttempts) : null, log: d ? +d.logAttempts.toFixed(2) : null, label: d ? DF.difficultyLabel(d.logAttempts) : null });
}

if (require.main === module) {
  const want = process.argv.slice(2).filter(a => !a.startsWith("--"));
  const out = [];
  for (const z of LS.SECTIONS) { if (want.length && !want.includes(z.key)) continue; const c = check(z); out.push(c);
    console.log(c.ok ? `${z.key.padEnd(14)} ${z.mode.padEnd(6)} solves: ${c.presses} presses, ${c.label} (~${c.attempts} attempts)${c.tight.length ? ", tightest " + c.tight.map(t => t.ms + " ms (" + t.type + ") at col " + t.col).join(", ") : ""} · moves ${c.move ? c.move.mean + " rows avg, " + Math.round(c.move.share * 100) + "% of " + c.move.room + (c.move.share > 0.5 ? " (OVER half)" : "") : "?"}${c.spread ? " · height: " + Math.round(c.spread.used * 100) + "% of rows, even " + c.spread.even + (c.spread.used < 0.6 || c.spread.even < 0.6 ? " (NARROW)" : "") + (!c.spread.low || !c.spread.high ? " · never at the " + [!c.spread.low && "bottom", !c.spread.high && "top"].filter(Boolean).join(" or ") : "") : ""}${c.skips ? (c.skips.length ? " · SKIPPABLE portal(s) at col " + c.skips.map(q => q.col).join(", ") : " · no portal can be skipped") : ""}  [${(c.ms / 1000).toFixed(0)} s]`
      : `${z.key.padEnd(14)} ${z.mode.padEnd(6)} DOES NOT SOLVE: dies at col ${c.dieCol}, row ${c.dieRow}: ${c.why}  [${((c.ms || 0) / 1000).toFixed(0)} s]`); }
  if (process.argv.includes("--show")) for (const c of out) if (c.show) console.log("\n" + c.key + ":\n" + c.show.map(l => "  " + l).join("\n"));
  for (const c of out) delete c.show;
  const f = path.join(__dirname, "..", "knowledge", "layout_check.json"), old = (() => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return {}; } })();
  for (const c of out) old[c.key] = Object.assign(c, { at: new Date().toISOString().slice(0, 16) });
  fs.writeFileSync(f, JSON.stringify(old, null, 1) + "\n"); console.log("-> knowledge/layout_check.json");
}
// PRESSES FIRST (Evgeni 2026-11-27: "our generating solves by design and we just patch the timings and search secret ways
// with the solver"): a generated section that carries its planned presses (z.presses, columns of the player's centre in
// the section) is played with exactly those taps; ok = the plan alone clears it, else where it dies. No search.
function planCheck(z, opts = {}) {
  if (!z.presses) return { key: z.key, plan: false };
  const S = specOf(z); let level;
  try { level = build(S.spec, "layoutcheck:" + z.key, {}).level; } catch (e) { return { key: z.key, plan: true, ok: false, why: "build failed: " + e.message }; }
  const w = GD.makeWorld(level.objects, level.header), p0 = GD.run(w, []).path, dx = p0[1].x - p0[0].x;
  // a number is a tap (press, release the next tick); a [press, release] pair is a hold (ship, wave, swing)
  // a plan's tick 0 is the first tick at or past the section's start; a column c is c * 30 / dx ticks on from there
  const T0 = Math.ceil((S.x0 * 30 - p0[0].x) / dx - 1e-9), tk = c => T0 + Math.round(c * 30 / dx), ev = [];
  for (const q of z.presses) if (Array.isArray(q)) { const a = tk(q[0]); ev.push({ tick: a, type: "press" }, { tick: Math.max(a + 1, tk(q[1])), type: "release" }); } else ev.push(tk(q));
  const r = GD.run(w, ev), end = r.path[r.path.length - 1];
  // the REAL path of the plan (the catalogue's 〰 line, Evgeni 2026-11-28: "we dont replay once with real physics?"): the
  // replay's centre in section cells (c across, r up from the ground), every 8 ticks, inside the section
  const path = []; for (let t = 0, ev8 = opts.every || 8; t < r.path.length; t += ev8) { const c = r.path[t].x / 30 - S.x0; if (c >= -0.5 && c <= z.map[0].length + 0.5) path.push([+c.toFixed(2), +(r.path[t].y / 30 - 0.5).toFixed(2)]); }
  return { key: z.key, plan: true, ok: !!r.done && !r.dead, presses: z.presses.length, path,
    dieCol: r.dead ? +(end.x / 30 - S.x0).toFixed(1) : undefined, dieRow: r.dead ? +(end.y / 30).toFixed(1) : undefined, why: r.dead ? r.why : undefined }; }
module.exports = { specOf, check, hashMap, planCheck };
