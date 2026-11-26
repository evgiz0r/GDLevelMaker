// node tools/autobricks.js list                       -- the families and their variants
// node tools/autobricks.js build [id|family ...]      -- build + verify each variant (zero presses) -> knowledge/autobricks.json,
//                                                       each brick's test level -> local/structures/lego-auto-<id>.gdlvl
//                                                       (tools/lego.js mine library picks them up), and one lab level
//                                                       with every good brick in a row -> levels/lab/auto_lab.gdlvl
// node tools/autobricks.js show <id>                  -- one brick: its contract, measures and a text map
//
// AUTO bricks: stretches with NO click where the level moves the player -- pads, gravity / mode / speed portals, spider
// pads, platforms to land on (the user, 2026-11-26: "i want to start developing those auto structures"; 2026-11-25:
// "sections without clicks but with interesting patterns of pads portals slopes that create some interesting movement").
// AUTO.md: what one is, the study of the main levels' auto parts (tools/autostudy.js), how these are built and checked,
// the contract, what is open.
//
// How a brick is built: a family is a SCRIPT of moves (put a pad, a portal, a platform where the player comes down ...).
// Each move is placed where the sim says the player is after the moves before it (zero presses), so every pad is touched
// and every platform is landed on by construction. Then hazards are filled in where the player never goes (spikes under
// the flight, hanging spikes over it), each one kept only if the zero-press run still clears. Shapes are generic GD
// vocabulary, nothing copied from a level.
// The checks: zero presses clear it; the exit state (mode, gravity, speed, height, grounded) is the contract's "leaves";
// a stray tap every 0.1 s (each alone) -> clickSafe; its motion (movers, turns, rise) vs the main levels' auto parts.
"use strict";
if (require.main === module && /^(build)$/.test(process.argv[2] || "")) require("./heavy.js").claim();
const fs = require("fs"), path = require("path");
const { GD, writeGdlvl } = require("./io.js");
const TYPESOF = () => require("./make.js").TYPES;   // lazily: make.js requires this file for its outro (a cycle)
const study = require("./autostudy.js");
const ROOT = path.join(__dirname, ".."), OUT = path.join(ROOT, "knowledge", "autobricks.json");
const TPS = GD.PHYS.TPS, B = 30, RUNIN = 10, FAR = 400;
const SPEEDK = { "0.5x": 1, "1x": 0, "2x": 2, "3x": 3, "4x": 4 }, SPEEDNAME = ["0.5x", "1x", "2x", "3x", "4x"];
const MODE_PORTAL = { ship: "ship portal", ball: "ball portal", ufo: "ufo portal", wave: "wave portal", robot: "robot portal", spider: "spider portal", swing: "swing portal", cube: "cube portal" };
const idOf = t => typeof t === "number" ? t : TYPESOF()[t] || ({ "spider pad": 3005, "mini portal": 101, "normal size": 99 })[t];

// ---------------------------------------------------------------- the level a brick is tested in
// objs: {t, c, r, flipY?, rot?} with c = column from the brick's start (col 0 = RUNIN), r = row (0 = on the ground)
function levelOf(objs, a) {
  const header = GD.DEFAULT_HEADER.replace(/(^|,)kA4,\d+/, "$1kA4," + SPEEDK[a.speed || "1x"]);
  const all = [], put = (t, c, r, o = {}) => all.push({ id: idOf(t), x: (c + RUNIN) * B + 15, y: r * B + 15, flipY: !!o.flipY, rot: o.rot || 0 });
  if (a.mode && a.mode !== "cube") put(MODE_PORTAL[a.mode], -RUNIN + 3, 1);
  if (a.grav === -1) put("gravity down", -RUNIN + 4, 1);
  for (const o of objs) { if (!idOf(o.t)) throw new Error("unknown object " + o.t); put(o.t, o.c, o.r, o); }
  put(211, FAR, 30);   // a far decoration: the sim keeps running past the brick (the world ends 3 blocks after the last object)
  const str = header + ";" + all.map(o => `1,${o.id},2,${o.x},3,${o.y}` + (o.flipY ? ",5,1" : "") + (o.rot ? ",6," + o.rot : "")).join(";") + ";";
  return { level: GD.parseLevel(str), str };
}
function simOf(objs, a, upto) {
  const { level } = levelOf(objs, a), w = GD.makeWorld(level.objects, level.header);
  const s = GD.startState(w), p = [structuredClone(s)];
  const lim = upto != null ? (upto + RUNIN) * B : FAR * B;
  while (!s.dead && !s.done && s.x < lim && s.tick < 240 * TPS) { GD.step(w, s, { press: false, held: false }); p.push(structuredClone(s)); }
  return { w, p, dead: s.dead, why: s.why, end: s };
}
const colOf = x => Math.floor(x / B) - RUNIN;
const settled = (p, i) => i >= 2 && p[i].grounded && p[i - 1].grounded && p[i - 2].grounded;

// ---------------------------------------------------------------- moves
// cur = { i: path index the next move is placed after }
const MOVES = {
  // a pad on the surface the player runs on, `gap` columns after it is settled there
  pad(objs, a, m, ctx) {
    const { p } = ctx.sim; let i = ctx.i;
    // gap 0: the pad goes under the player the moment it lands (no settling, no step); else `gap` columns after it settles
    const ready = m.gap ? (k => settled(p, k)) : (k => p[k].grounded);
    while (i < p.length && !(ready(i) && colOf(p[i].x) >= ctx.minCol)) i++;
    if (i >= p.length) return "never settles for the " + m.pad + " pad";
    const s = p[i], c = m.gap ? colOf(s.x) + 1 + m.gap : Math.max(ctx.minCol, colOf(s.x + 12));
    if (s.grav > 0) objs.push({ t: m.pad + " pad", c, r: Math.round((s.y - 15) / B) });
    else objs.push({ t: m.pad + " pad", c, r: Math.round((s.y + 15) / B) - 1, flipY: true });
    return { col: c };
  },
  // a portal in the player's way `gap` columns on, centred on where it is there
  portal(objs, a, m, ctx) {
    const { p } = ctx.sim; let i = ctx.i;
    const want = Math.max(ctx.minCol, colOf(p[i].x) + (m.gap || 1));
    while (i < p.length && colOf(p[i].x) < want) i++;
    if (i >= p.length) return "nowhere to put the " + m.portal;
    if (m.when === "rising" || m.when === "falling") {   // wait until the player rises / falls (after a pad)
      while (i < p.length && !((m.when === "rising" ? 1 : -1) * p[i].vy * p[i].grav > 1)) i++;
      if (i >= p.length) return "never " + m.when + " for the " + m.portal;
    }
    const s = p[i], c = colOf(s.x) + (m.when ? 1 : 0);
    objs.push({ t: m.portal, c, r: Math.max(1, Math.round((s.y - 15) / B)) });
    return { col: c };
  },
  // a platform where the player comes down onto height h (grav 1: its top at row h; upside down: its underside at row h)
  land(objs, a, m, ctx) {
    const { p } = ctx.sim; let i = ctx.i + 1;
    const h = m.land != null ? m.land : m.h, y = h * B;
    for (; i < p.length; i++) {
      const s = p[i], q = p[i - 1];
      if (s.grav > 0 && s.vy < 0 && q.y - 15 >= y && s.y - 15 < y + 6) break;
      if (s.grav < 0 && s.vy > 0 && q.y + 15 <= y && s.y + 15 > y - 6) break;
    }
    if (i >= p.length) return "never comes down at height " + h;
    const c0 = colOf(p[i].x) - 1, row = p[i].grav > 0 ? h - 1 : h;
    for (let c = c0; c < c0 + (m.len || 3); c++) for (let r = row; r >= (p[i].grav > 0 && m.solid ? 0 : row); r--) objs.push({ t: "block", c, r });
    return { col: c0 + (m.len || 3) - 1 };
  },
  // a long ceiling (or floor) at row h over the next n columns
  roof(objs, a, m, ctx) { const c0 = Math.max(ctx.minCol, 0) + (m.from || 0); for (let c = c0; c < c0 + (m.n || 150); c++) objs.push({ t: "block", c, r: m.h, roof: true }); return { col: ctx.minCol - 1 }; },
  // a WALL of gravity portals stacked over the corridor's whole height (rows 1, 4, 7 ... under the roof), `gap` columns
  // on: wherever the player is, it goes through one. "flip" = the colour that turns the player's gravity there;
  // back to back (gap 0) they make the "reverse portal wave" (Evgeni, 2026-11-26: "if you stack some")
  gwall(objs, a, m, ctx) {
    const { p } = ctx.sim; let i = ctx.i;
    const want = Math.max(ctx.minCol, colOf(p[i].x) + 1 + (m.gap || 0));
    while (i < p.length && colOf(p[i].x) < want) i++;
    if (i >= p.length) return "nowhere to put the gravity wall";
    const g = p[i].grav, t = m.gwall === "flip" ? (g > 0 ? "gravity down" : "gravity up") : m.gwall === "down" ? "gravity down" : m.gwall === "up" ? "gravity up" : m.gwall;
    // the corridor's height there: the lowest roof block over that column (a.H when there is none)
    const roofs = objs.filter(o => o.roof && o.c === want).map(o => o.r), H = m.H || (roofs.length ? Math.min(...roofs) : a.H || 8);
    // from just under the roof down to row 1, every 2 rows (a portal's box is 2.5 rows tall: a mini player cannot slip
    // between two)
    const rows = []; for (let r = Math.max(1, H - 1); r >= 1; r -= 2) rows.push(r); if (rows[rows.length - 1] !== 1) rows.push(1);
    for (const r of rows) objs.push({ t, c: want, r });
    return { col: want };
  },
  // a wall of any portal (mode, size, speed, gravity) over the corridor's height: {wall: "ship portal"} etc.
  wall(objs, a, m, ctx) { return MOVES.gwall(objs, a, Object.assign({}, m, { gwall: m.wall }), ctx); },
  // the roof changes height from here on (a tall chamber = room for a big fall up or down). Lowering waits until the
  // player is under the new height for a few columns, so it never meets the new roof's front face
  ceil(objs, a, m, ctx) {
    const { p } = ctx.sim; let i = ctx.i;
    const y = m.ceil * B;
    const under = k => p[k].y + 15 <= y - 8;
    while (i < p.length && !(colOf(p[i].x) >= ctx.minCol && under(i) && [12, 24, 36].every(d => p[i + d] && under(i + d)))) i++;
    if (i >= p.length) return "never under height " + m.ceil;
    const c0 = colOf(p[i].x) + 1 + (m.gap || 0);
    for (let k = objs.length - 1; k >= 0; k--) if (objs[k].roof && objs[k].c >= c0) objs.splice(k, 1);
    for (let c = c0; c < c0 + (m.n || 400); c++) objs.push({ t: "block", c, r: m.ceil, roof: true });
    return { col: c0 };
  },
  // a high FLOOR (a platform layer with its top at row h) from under the player on, n columns: after a big fall up, the
  // path goes on up there ("start a new auto path from there", Evgeni 2026-11-26). Waits until the player is above it.
  floor(objs, a, m, ctx) {
    const { p } = ctx.sim; let i = ctx.i;
    const y = m.floor * B, over = k => p[k].y - 15 >= y + 2;
    while (i < p.length && !(colOf(p[i].x) >= ctx.minCol && over(i) && [12, 24].every(d => p[i + d] && over(i + d)))) i++;
    if (i >= p.length) return "never above height " + m.floor;
    const c0 = colOf(p[i].x) + 1;
    for (let c = c0; c < c0 + (m.n || 30); c++) objs.push({ t: "block", c, r: m.floor - 1, hifloor: true });
    return { col: c0 };
  },
  // the high floor ends here (2 columns on): a player on it walks off and falls all the way down
  endfloor(objs, a, m, ctx) {
    const c0 = Math.max(ctx.minCol, colOf(ctx.sim.p[ctx.i].x) + 2 + (m.gap || 0));
    for (let k = objs.length - 1; k >= 0; k--) if (objs[k].hifloor && objs[k].c >= c0) objs.splice(k, 1);
    return { col: c0 };
  },
  // walk n columns on (a pause in the moves)
  walk(objs, a, m, ctx) { return { col: Math.max(ctx.minCol - 1, colOf(ctx.sim.p[ctx.i].x)) + m.walk }; },
};

// what a move does, for the no-repeat rule: "pad:blue", "gravity", "ship portal", "ceil" ... (a walk has none)
function labelOf(m) {
  if (m.pad) return "pad:" + m.pad;
  if (m.gwall) return /gravity|flip|up|down/.test(m.gwall) ? "gravity" : m.gwall;
  if (m.wall) return /gravity/.test(m.wall) ? "gravity" : m.wall;
  if (m.ceil != null) return "ceil";
  if (m.land != null) return "land";
  if (m.floor != null) return "floor";
  if (m.endfloor) return "endfloor";
  if (m.portal) return m.portal;
  return null;
}
// run a family's script: place each move from a fresh sim of what is placed so far
function place(fam, a) {
  const objs = []; let minCol = 0, sim = simOf(objs, a), i = 0, j = 0, skipped = 0;
  let lastLabel = null;
  for (const m of fam.script(a)) {
    const kind = Object.keys(MOVES).find(k => k in m);
    // never the same effect twice in a row (Evgeni, 2026-11-26: "in such auto we dont want even like 2 of the same"):
    // in a lenient family a move like the last one placed is left out
    const label = labelOf(m);
    if (fam.noRepeat && !m.force && label && label === lastLabel) { skipped++; continue; }
    // a move that kills is tried again a column later, up to 3 times (a wall that flips the cube into a roof corner
    // works one column on)
    let r, prevSim = sim;
    const snap = objs.slice(), restore = () => objs.splice(0, objs.length, ...snap);
    for (let extra = 0; extra <= 3; extra++) {
      restore();
      const mm = extra ? Object.assign({}, m, { gap: (m.gap || 0) + extra }) : m;
      r = MOVES[kind](objs, a, mm, { sim: prevSim, i, minCol });
      if (typeof r === "string") { if (fam.lenient && !m.strict) break; return { error: r }; }
      // with a roof, the run is judged only under it (past its end an upside-down player falls into the sky)
      const roofEnd = Math.max(-1, ...objs.filter(o => o.roof).map(o => o.c));
      sim = simOf(objs, a, roofEnd > 0 ? roofEnd - 2 : undefined);
      if (!sim.dead) break;
    }
    // lenient families (the generated sections) leave out a move that cannot be placed or kills, and go on
    if (fam.lenient && !m.strict && (typeof r === "string" || sim.dead)) { restore(); sim = prevSim; skipped++; continue; }
    // only what the player touches counts for the no-repeat rule (a roof or floor change is not an effect)
    if (label && !/^(ceil|floor|endfloor)$/.test(label)) lastLabel = label;
    minCol = r.col + 1;
    if (sim.dead) return { error: `dies after move ${j + 1} (${kind}): ${sim.why || ""} at col ${colOf(sim.end.x)}`, objs };
    // the next move starts from where this one was put
    i = sim.p.findIndex(s => colOf(s.x) >= r.col); if (i < 0) return { error: "the player never gets past move " + (j + 1) };
    j++;
  }
  return { objs, sim, lastCol: minCol - 1, skipped };
}
// the exit: after the last move, the first calm point -- settled on a surface, or flying in its new mode -- that is
// at least `tail` columns on
function exitOf(sim, lastCol) {
  const p = sim.p; let i = p.findIndex(s => colOf(s.x) >= lastCol + 1);
  if (i < 0) return null;
  const flying = s => /ship|ufo|wave|swing/.test(s.mode);
  while (i < p.length && !(settled(p, i) || (flying(p[i]) && p[i].tick - p[Math.max(0, i - 48)].tick >= 48 && Math.abs(p[i].vy) < 4))) i++;
  if (i >= p.length) return null;
  return i;
}
// hazards where the player never goes: spikes on the ground under the flight, hanging spikes under a roof over it,
// each kept only if the zero-press run still clears
function fillHazards(objs, a, startCol, endCol, sparse) {
  const sim = simOf(objs, a, endCol + 4), p = sim.p, occ = new Set(objs.map(o => o.c + ":" + o.r));
  const lowAt = {}, highAt = {};
  for (const s of p) { const c = colOf(s.x); if (c < startCol || c > endCol) continue; lowAt[c] = Math.min(lowAt[c] ?? 1e9, s.y); highAt[c] = Math.max(highAt[c] ?? -1e9, s.y); }
  // also the columns next to each (the player's box is a block wide)
  const near = (c, f, v) => [c - 1, c, c + 1].every(k => lowAt[k] === undefined || f(k));
  const roofs = {}; for (const o of objs) if (o.t === "block") (roofs[o.c] = roofs[o.c] || []).push(o.r);
  const cand = [];
  for (let c = startCol + 1; c < endCol; c++) {
    if (lowAt[c] === undefined) continue;
    // ground spike: the column is empty at rows 0-1 and the player stays 2.5+ blocks over the ground around it
    if (!occ.has(c + ":0") && !occ.has(c + ":1") && near(c, k => lowAt[k] >= 2.5 * B + 15)) cand.push({ t: "spike", c, r: 0 });
    // hanging spike: under the lowest roof block over the player, when the player stays 2.5 blocks under it
    const rs = (roofs[c] || []).filter(r => r * B > highAt[c]).sort((x, y) => x - y);
    if (rs.length && !occ.has(c + ":" + (rs[0] - 1)) && near(c, k => highAt[k] === undefined || highAt[k] + 15 <= (rs[0] - 2.5) * B)) cand.push({ t: "spike", c, r: rs[0] - 1, rot: 180 });
  }
  if (sparse) { const keep = cand.filter((c, k) => k % 4 === 0); cand.length = 0; cand.push(...keep); }
  let kept = 0;
  // in batches: all at once, then halves on a death (most of them are fine)
  const tryAdd = list => {
    if (!list.length) return;
    const t = objs.concat(list), s = simOf(t, a, endCol + 4);
    if (!s.dead) { objs.push(...list); kept += list.length; return; }
    if (list.length === 1) return;
    tryAdd(list.slice(0, list.length >> 1)); tryAdd(list.slice(list.length >> 1));
  };
  tryAdd(cand);
  return kept;
}

// ---------------------------------------------------------------- one brick: build + verify + measure
function buildBrick(fam, v) {
  const a = Object.assign({ mode: "cube", grav: 1, speed: "1x" }, fam.args, v.args);
  const pl = place(fam, a);
  if (pl.error) return { id: v.id, family: fam.id, ok: false, why: pl.error };
  let { objs, sim } = pl;
  let ie = exitOf(sim, pl.lastCol);
  if (ie == null) return { id: v.id, family: fam.id, ok: false, why: "no calm exit after the last move" };
  let endCol = colOf(sim.p[ie].x) + 1;
  // a roof runs on only to the exit (+1: the next brick's own roof, or the open sky, takes over)
  for (let k = objs.length - 1; k >= 0; k--) if (objs[k].roof && objs[k].c > endCol + 1) objs.splice(k, 1);
  // a landing platform runs on to the exit (the next brick's floor)
  const ex = sim.p[ie];
  if (ex.grounded && ex.grav > 0 && ex.y > 30) { const r = Math.round((ex.y - 15) / B) - 1; for (let c = colOf(ex.x); c <= endCol + 1; c++) if (!objs.some(o => o.c === c && o.r === r)) objs.push({ t: "block", c, r }); }
  if (ex.grounded && ex.grav < 0) { const r = Math.round((ex.y + 15) / B); for (let c = colOf(ex.x); c <= endCol + 1; c++) if (!objs.some(o => o.c === c && o.r === r)) objs.push({ t: "block", c, r }); }
  const hazards = fam.hazards === false ? 0 : fillHazards(objs, a, 0, endCol, fam.sparseHazards);
  sim = simOf(objs, a, endCol + 3);
  if (sim.dead) return { id: v.id, family: fam.id, ok: false, why: "dies after the hazard fill: " + sim.why + " at col " + colOf(sim.end.x) };
  ie = exitOf(sim, pl.lastCol); if (ie == null) return { id: v.id, family: fam.id, ok: false, why: "no exit after the fill" };
  const p = sim.p, i0 = Math.max(0, p.findIndex(s => colOf(s.x) >= 0) - 12), i1 = ie, s1 = p[i1];
  const d = study.describe(sim.w, p, i0, i1);
  const width = colOf(s1.x) + 1;
  // the contract: what it needs and what it leaves (height as the row the player's feet are on / its centre row flying)
  const rowOf = s => s.grounded ? (s.grav > 0 ? Math.round((s.y - 15) / B) : Math.round((s.y + 15) / B)) : +((s.y - 15) / B).toFixed(1);
  const res = {
    id: v.id, family: fam.id, doc: v.doc || fam.doc, ok: true, runin: RUNIN,
    needs: { mode: a.mode, grav: a.grav, speed: a.speed, mini: false, row: 0, grounded: true },
    leaves: { mode: s1.mode, grav: s1.grav, speed: SPEEDNAME[s1.sp], mini: !!s1.mini, row: rowOf(s1), grounded: !!s1.grounded, vy: s1.grounded ? 0 : +s1.vy.toFixed(1) },
    width, secs: d.secs, movers: d.movers.map(m => m.name), nMovers: d.movers.length, turns: d.turns, rise: d.rise, dy: d.dy, gravFlips: d.gravFlips,
    reverse: +(p.slice(i0, i1 + 1).filter(q => q.grav < 0).length / Math.max(1, i1 - i0 + 1)).toFixed(2),
    modesSeen: [...new Set(p.slice(i0, i1 + 1).map(q => q.mode + (q.mini ? " mini" : "")))], speedsSeen: [...new Set(p.slice(i0, i1 + 1).map(q => SPEEDNAME[q.sp]))],
    skipped: pl.skipped || 0,
    repeats: (() => { const cols = new Map(); for (const mv of d.movers) { const c = Math.round((mv.x || 0) / B), l = /gravity/.test(mv.name) ? "gravity" : mv.name; if (!cols.has(c)) cols.set(c, l); } const seq = [...cols.values()]; return seq.filter((l, k) => k && l === seq[k - 1]).length; })(),
    modeChanges: p.slice(i0, i1 + 1).filter((q, k, arr) => k && q.mode !== arr[k - 1].mode).length,
    effects: new Set(d.movers.filter(m => m.x != null).map(m => Math.round(m.x / B))).size,
    rate: +(new Set(d.movers.filter(m => m.x != null).map(m => Math.round(m.x / B))).size / Math.max(0.1, d.secs)).toFixed(1), hazards, clickSafe: study.clickSafe(sim.w, p, i0, i1),
    objects: objs.map(o => [o.t, o.c, o.r].concat(o.flipY || o.rot ? [Object.assign({}, o.flipY ? { flipY: true } : {}, o.rot ? { rot: o.rot } : {})] : [])),
    path: p.filter((s, k) => k >= i0 - 24 && k <= i1 + 24 && k % 6 === 0).map(s => [+((s.x / B) - RUNIN).toFixed(2), +((s.y - 15) / B).toFixed(2), s.mode[0], s.grav]),
  };
  res.interest = interest(res);
  return res;
}
// how much the brick moves the player, against the main levels' auto parts (knowledge/auto_study.json medians: ~1-1.5 s,
// 4-5 blocks of rise, 2-4 turns, 1-4 movers): 0..1
function interest(b) {
  const c = (v, lo, hi) => Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
  return +(0.3 * c(b.nMovers, 0, 4) + 0.25 * c(b.turns, 0, 5) + 0.2 * c(b.rise, 1, 6) + 0.15 * c(b.secs, 0.5, 2) + 0.1 * (b.leaves.mode !== b.needs.mode || b.leaves.grav !== b.needs.grav || b.leaves.row !== b.needs.row ? 1 : 0)).toFixed(2);
}

// ---------------------------------------------------------------- the families
const FAM = [];
const F = (id, o) => FAM.push(Object.assign({ id, args: {} }, o));
const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));

F("launch", { doc: "a pad throws the cube over a spike pit onto a ledge",
  variants: [].concat(...["yellow", "red", "pink"].map(pad => (pad === "pink" ? [1] : pad === "red" ? [3, 4, 6] : [2, 3, 4]).map(h => ({ id: `launch-${pad}-${h}`, args: { pad, h }, doc: `a ${pad} pad throws the cube onto a ${h}-high ledge over spikes` })))),
  script: a => [{ walk: 1 }, { pad: a.pad }, { land: a.h, len: 4 }] });
F("pad-stairs", { doc: "pads one after another, each throwing the cube onto a higher (or lower) ledge",
  variants: [
    { id: "pad-stairs-up3", args: { pad: "yellow", hs: [2, 4, 6] }, doc: "three yellow pads, each onto a ledge 2 higher" },
    { id: "pad-stairs-up-pink", args: { pad: "pink", hs: [1, 2, 3, 4] }, doc: "four pink pads up a staircase of single steps" },
    { id: "pad-stairs-down", args: { pad: "yellow", hs: [5, 3, 1] }, doc: "a red pad up high, then yellow pads hopping down ledge to ledge", first: "red", h0: 6 },
    { id: "pad-stairs-zigzag", args: { pad: "yellow", hs: [3, 1, 4, 2] }, doc: "yellow pads hopping up and down between ledges" },
  ].map(v => Object.assign(v, { args: Object.assign({}, v.args, v.first ? { first: v.first, h0: v.h0 } : {}) })),
  script: a => [{ walk: 1 }].concat(a.first ? [{ pad: a.first }, { land: a.h0, len: 2 }] : [], ...a.hs.map(h => [{ pad: a.pad, gap: 0 }, { land: h, len: 2 }])) });
F("pingpong", { doc: "blue pads on floor and roof bounce the cube up and down a spiked corridor",
  variants: [].concat(...[4, 5, 6].map(H => [3, 5].map(n => [0, 1].map(gap => ({ id: `pingpong-h${H}-n${n}-g${gap}`, args: { H, n, gap }, doc: `${n} blue pads in a ${H}-high corridor, ${gap ? "a step" : "no step"} between bounces` }))).flat())),
  script: a => [{ roof: true, h: a.H }, { walk: 1 }].concat(range(a.n, () => ({ pad: "blue", gap: a.gap }))).concat([{ walk: 1 }]) });
F("grav-pingpong", { doc: "gravity portals flip the cube between floor and roof in a spiked corridor",
  variants: [].concat(...[5, 7].map(H => [2, 4].map(n => [2, 4].map(gap => ({ id: `gravpp-h${H}-n${n}-g${gap}`, args: { H, n, gap }, doc: `${n} gravity portals, yellow and blue in turn, ${gap} blocks apart, in a ${H}-high corridor` }))).flat())),
  script: a => [{ roof: true, h: a.H }, { walk: 1 }].concat(range(a.n, k => ({ portal: k % 2 ? "gravity up" : "gravity down", gap: a.gap }))).concat([{ walk: 1 }]) });
F("spider-zigzag", { doc: "spider pads snap the cube between floor and roof",
  variants: [4, 6].map(H => [3, 5].map(n => ({ id: `spider-zz-h${H}-n${n}`, args: { H, n }, doc: `${n} spider pads in a ${H}-high corridor` }))).flat(),
  script: a => [{ roof: true, h: a.H }, { walk: 1 }].concat(range(a.n, () => ({ pad: "spider", gap: 1 }))).concat([{ walk: 1 }]) });
F("pad-flip", { doc: "a yellow pad throws the cube up into a gravity portal: it lands on a roof, and a blue pad there drops it back",
  variants: [6, 8].map(H => ({ id: `pad-flip-h${H}`, args: { H }, doc: `a pad and a gravity portal onto a ${H}-high roof, a blue pad back down` })),
  script: a => [{ roof: true, h: a.H }, { walk: 1 }, { pad: "yellow" }, { portal: "gravity down", gap: 2, when: "rising" }, { pad: "blue", gap: 2 }, { walk: 1 }] });
F("pad-portal", { doc: "a pad throws the cube into a mode portal: it comes out flying (or rolling) in the new mode",
  variants: ["ship", "ufo", "wave", "ball", "robot", "spider", "swing"].map(m => ({ id: `pad-into-${m}`, args: { into: m }, doc: `a yellow pad up into a ${m} portal` })),
  hazards: false,
  script: a => [{ walk: 1 }, { pad: "yellow" }, { portal: MODE_PORTAL[a.into], gap: 2, when: "rising" }, { walk: 2 }] });
F("speed-launch", { doc: "a speed portal, then a pad launch at the new speed onto a ledge",
  variants: [["2x", 4], ["0.5x", 3], ["3x", 4]].map(([sp, h]) => ({ id: `speed-${sp}-launch`, args: { sp, h }, doc: `a ${sp} speed portal, a yellow pad onto a ${h}-high ledge` })),
  script: a => [{ portal: a.sp + " speed", gap: 1 }, { walk: 2 }, { pad: "yellow" }, { land: a.h, len: 4 }] });
F("ball-pingpong", { doc: "the ball rolls through gravity portals and blue pads between floor and roof",
  variants: [5, 7].map(H => ({ id: `ball-pp-h${H}`, args: { mode: "ball", H }, doc: `the ball flipped 4 times by portals and pads in a ${H}-high corridor` })),
  script: a => [{ roof: true, h: a.H }, { walk: 1 }, { portal: "gravity down", gap: 2 }, { pad: "blue", gap: 1 }, { portal: "gravity down", gap: 2 }, { pad: "blue", gap: 1 }, { walk: 1 }] });
F("drop-chain", { doc: "a red pad up to a high ledge, then the cube walks off ledge after ledge down",
  variants: [{ id: "drop-chain-3", args: { hs: [5, 3, 1] }, doc: "a red pad onto a 6-high ledge, then three drops" }],
  script: a => [{ walk: 1 }, { pad: "red" }, { land: 6, len: 3 }].concat(...a.hs.map(h => [{ land: h, len: 3 }])) });

// ---------------------------------------------------------------- dense ("janky") families: no gaps, no walks
// Evgeni (2026-11-26, on the first lab): "much jankier. for example reverse portal waves - if you stack some. or a corridor
// or blue portals (without gaps). or a corridor of those spider orbs. i want an effect like x10 times more often. with no
// buffers at all between the sections". The main levels' auto parts move the player ~1 time a second (median; top 10%:
// 4.6, max 8.7: knowledge/auto_study.json); these aim at 5-10+.
const M = {
  wave: (n, gap = 0) => range(n, () => ({ gwall: "flip", gap })),
  blues: n => range(n, () => ({ pad: "blue", gap: 0 })),
  spiders: n => range(n, () => ({ pad: "spider", gap: 0 })),
  // a blue pad, then a gravity wall right where it lands: the pad throws, the wall turns it back mid-flight
  bluewave: n => [].concat(...range(n, () => [{ pad: "blue", gap: 0 }, { gwall: "flip", gap: 1 }])),
  spiderwave: n => [].concat(...range(n, () => [{ pad: "spider", gap: 0 }, { gwall: "flip", gap: 0 }])),
};
F("portal-wave", { doc: "stacked gravity-portal walls back to back: the cube zigzags in a reverse-portal wave",
  variants: [].concat(...[3, 5, 8].map(H => [[10, 0], [8, 1], [6, 2]].map(([n, gap]) => ({ id: `pwave-h${H}-n${n}-g${gap}`, args: { H, n, gap }, doc: `${n} gravity walls ${gap ? gap + " apart" : "back to back"} in a ${H}-high corridor` })))),
  script: a => [{ roof: true, h: a.H }, { walk: 1 }].concat(M.wave(a.n, a.gap)) });
F("blue-run", { doc: "blue pads with no gap on floor and roof of a low corridor: the fastest ping-pong",
  variants: [2, 3, 4].map(H => ({ id: `bluerun-h${H}`, args: { H, n: 10 }, doc: `10 blue pads, no gap, in a ${H}-high corridor` })),
  script: a => [{ roof: true, h: a.H }, { walk: 1 }].concat(M.blues(a.n)) });
F("spider-run", { doc: "spider pads with no gap: the cube snaps floor-roof-floor every two columns",
  variants: [2, 4, 6].map(H => ({ id: `spiderrun-h${H}`, args: { H, n: 10 }, doc: `10 spider pads, no gap, in a ${H}-high corridor` })),
  script: a => [{ roof: true, h: a.H }, { walk: 1 }].concat(M.spiders(a.n)) });
F("blue-wave", { doc: "a blue pad throws the cube, a gravity wall turns it back halfway, again and again",
  variants: [4, 6].map(H => ({ id: `bluewave-h${H}`, args: { H, n: 6 }, doc: `6 pad + wall pairs in a ${H}-high corridor` })),
  script: a => [{ roof: true, h: a.H }, { walk: 1 }].concat(M.bluewave(a.n)) });
F("spider-wave", { doc: "a spider pad snaps the cube to the roof, a gravity wall right after drops it back",
  variants: [3, 5].map(H => ({ id: `spiderwave-h${H}`, args: { H, n: 6 }, doc: `6 spider pad + wall pairs in a ${H}-high corridor` })),
  script: a => [{ roof: true, h: a.H }, { walk: 1 }].concat(M.spiderwave(a.n)) });
// a long section: motifs straight after each other (no walk, no buffer), picked by a seed
function rng(seed) { let x = seed * 9301 + 49297; return () => (x = (x * 9301 + 49297) % 233280) / 233280; }
function jankScript(a) {
  const R = rng(a.seed), out = [{ roof: true, h: a.H, n: a.cols + 40 }, { walk: 1 }];
  const kinds = [() => M.wave(4 + (R() * 6 | 0), R() < 0.7 ? 0 : 1), () => M.blues(3 + (R() * 5 | 0)), () => M.spiders(3 + (R() * 5 | 0)),
    () => M.bluewave(2 + (R() * 3 | 0)), () => M.spiderwave(2 + (R() * 3 | 0))];
  let last = -1;
  for (let k = 0; k < a.motifs; k++) { let j; do j = R() * kinds.length | 0; while (j === last); last = j; out.push(...kinds[j]()); }
  return out;
}
F("jank", { doc: "a long auto section of mixed motifs back to back -- portal waves, blue runs, spider runs, pad + wall pairs -- no buffers",
  variants: [[1, 4], [2, 5], [3, 3], [4, 6], [5, 5], [6, 4]].map(([seed, H]) => ({ id: `jank-${seed}-h${H}`, args: { seed, H, motifs: 6, cols: 120 }, doc: `6 motifs back to back in a ${H}-high corridor (seed ${seed})` }))
    .concat([{ id: "jank-long", args: { seed: 11, H: 5, motifs: 30, cols: 500 }, doc: "30 motifs back to back, ~30 s with no buffer: the jank lab" }]),
  script: jankScript });

// ---------------------------------------------------------------- round 2: chambers, big falls, modes, mini, speed
// Evgeni (2026-11-26, on jank round 1): "auto levels also like to do some big falls up or down, it extend the motion. and
// in auto reverse is almost the same so could be 50% of the time. auto doesnt have to be cube as well, and could also be
// mini, or with speed portals ... ship, swing, ufo, could do some autos flying up down via pads and portals. now we can
// go really junky and then go back a bit, into something more coherent".
// A section is a run of CHAMBERS: each changes the roof height (tall ones, 9-14 rows, are room for a big fall up or down
// through a single gravity wall), maybe the mode (a wall of mode portals), the size and the speed, then 2-3 motifs. A
// move that cannot be placed or kills is left out (lenient), so any mix can be tried; the run is checked as a whole.
const MODES = ["cube", "ship", "ufo", "wave", "ball", "robot", "spider", "swing"];
function chamberScript(a) {
  const R = rng(a.seed), pick = arr => arr[R() * arr.length | 0];
  const out = [{ roof: true, h: 6, n: a.cols + 60 }, { walk: 1 }];
  let mode = "cube", mini = false, speed = "1x";
  for (let k = 0; k < a.chambers; k++) {
    const tall = R() < (a.tall != null ? a.tall : 0.4), H = tall ? 9 + (R() * 6 | 0) : 3 + (R() * 4 | 0);
    out.push({ ceil: H });
    if (R() < (a.modeP != null ? a.modeP : 0.6)) { const m = pick(MODES.filter(x => x !== mode)); out.push({ wall: MODE_PORTAL[m], gap: 0 }); mode = m; }
    if (R() < 0.3) { mini = !mini; out.push({ wall: mini ? "mini portal" : "normal size", gap: 0 }); }
    if (R() < 0.3) { const sp = pick(["0.5x", "1x", "2x", "3x"].filter(x => x !== speed)); out.push({ wall: sp + " speed", gap: 0 }); speed = sp; }
    // reverse half the time: a chamber starts with a flip when the coin says so (the walls inside keep flipping)
    if (R() < 0.5) out.push({ gwall: "flip", gap: 0 });
    const kinds = [
      () => tall ? [{ gwall: "flip", gap: 6 + (R() * 6 | 0) }] : M.wave(3 + (R() * 4 | 0), R() < 0.5 ? 0 : 1),   // tall: one wall, a big fall
      () => M.wave(3 + (R() * 5 | 0), R() * 3 | 0),
      () => M.blues(3 + (R() * 4 | 0)), () => M.spiders(3 + (R() * 4 | 0)),
      () => M.bluewave(2 + (R() * 2 | 0)), () => M.spiderwave(2 + (R() * 2 | 0)),
      () => [{ pad: "yellow", gap: 0 }, { gwall: "flip", gap: 2 }],   // a pad up, a wall turns it into a fall the other way
    ];
    const nm = 2 + (R() * 2 | 0);
    for (let q = 0; q < nm; q++) out.push(...kinds[R() * kinds.length | 0]());
  }
  // back to a plain cube on the floor at 1x, so it joins anything (the contract's exit)
  out.push({ ceil: 6 }, { wall: "cube portal", gap: 0 }, { wall: "normal size", gap: 0 }, { wall: "1x speed", gap: 0 }, { wall: "gravity up", gap: 0 }, { walk: 2 });
  return out;
}
F("chambers", { doc: "round 2: chambers of different heights (big falls up and down), modes, mini, speed, reverse half the time, motifs back to back",
  lenient: true,
  variants: [1, 2, 3, 4, 5, 6].map(seed => ({ id: `chambers-${seed}`, args: { seed, chambers: 4, cols: 200 }, doc: `4 chambers, seed ${seed}` }))
    .concat([{ id: "chambers-long", args: { seed: 21, chambers: 18, cols: 900 }, doc: "18 chambers back to back, no buffer: the round 2 jank lab" }]),
  script: chamberScript });

// ---------------------------------------------------------------- round 4: long motions, big falls, a path up high
// Evgeni (2026-11-26): "motions can be long as well, it doesnt have to be mega spammy ... we can try to add some falls
// up, that fall a lot, and start a new auto path from there. could be a decent off the screen fall". The round 3 mix with
// more room between effects (gaps of 0-5 columns), and two big moves: BIG UP -- the roof jumps to 18-28 rows, the player
// is flipped and falls up off the screen onto it, a floor appears a few rows under that roof and the path goes on up
// there -- and BIG DOWN -- normal gravity, the high floor ends, the player falls all the way to the ground.
function longScript(a) {
  const R = rng(a.seed), pick = arr => arr[R() * arr.length | 0];
  const out = [{ roof: true, h: 8, n: a.cols + 80 }, { walk: 1 }];
  let mode = "cube", mini = false, speed = "1x", sinceMode = 0, sinceCeil = 0, sinceBig = 0, H = 8, high = 0;
  const recent = [], gap = () => R() < 0.4 ? 0 : 1 + (R() * 5 | 0);
  const EFFECTS = {
    flip: () => [{ gwall: "flip", gap: gap() }],
    fall: () => [{ gwall: "flip", gap: 5 + (R() * 6 | 0) }],
    blue: () => [{ pad: "blue", gap: gap() }],
    spider: () => [{ pad: "spider", gap: gap() }],
    yellow: () => [{ pad: "yellow", gap: gap() }],
    pink: () => [{ pad: "pink", gap: gap() }],
    red: () => [{ pad: "red", gap: gap() }],
    size: () => { mini = !mini; return [{ wall: mini ? "mini portal" : "normal size", gap: gap() }]; },
    speed: () => { speed = pick(["0.5x", "1x", "2x", "3x"].filter(x => x !== speed)); return [{ wall: speed + " speed", gap: gap() }]; },
    ledge: () => [{ land: 2 + (R() * Math.max(1, H - 4) | 0), len: 2 + (R() * 4 | 0) }],
    walk: () => [{ walk: 3 + (R() * 6 | 0) }],   // a long plain motion: nothing for a while
  };
  const keys = Object.keys(EFFECTS);
  for (let k = 0; k < a.effects; k++) {
    if (!high && sinceBig >= 5 + (R() * 4 | 0)) {   // BIG UP
      const T = 18 + (R() * 11 | 0), h = 4 + (R() * 3 | 0);
      out.push({ ceil: T }, { gwall: "down", gap: 1, force: true }, { floor: T - h, n: 30 + (R() * 30 | 0) });
      high = T; H = h; sinceBig = 0; sinceCeil = 0; recent.length = 0; continue;
    }
    if (high && sinceBig >= 3 + (R() * 3 | 0)) {    // BIG DOWN
      out.push({ gwall: "up", gap: 1, force: true }, { endfloor: true, gap: 2 }, { ceil: 7 + (R() * 4 | 0) });
      high = 0; H = 8; sinceBig = 0; sinceCeil = 0; recent.length = 0; continue;
    }
    if (!high && sinceCeil >= 3 + (R() * 3 | 0)) { H = H >= 9 ? 3 + (R() * 3 | 0) : 9 + (R() * 6 | 0); out.push({ ceil: H }); sinceCeil = 0; recent.length = 0; }
    if (sinceMode >= 1 + (R() * 3 | 0)) { mode = pick(MODES.filter(x => x !== mode)); out.push({ wall: MODE_PORTAL[mode], gap: gap() }); sinceMode = 0; }
    let e; do e = pick(keys); while (recent.includes(e) || (e === "fall" && (H < 8 || high)) || (e === "ledge" && (H < 7 || high)));
    recent.push(e); if (recent.length > 2) recent.shift();
    out.push(...EFFECTS[e]());
    sinceMode++; sinceCeil++; sinceBig++;
  }
  // the exit, strict: normal gravity, off the high floor, the cube on the ground, then the roof comes down to 6
  out.push({ gwall: "up", gap: 1, force: true, strict: true });
  if (high) out.push({ endfloor: true, gap: 2, strict: true });
  out.push({ wall: "cube portal", gap: 1, force: true, strict: true }, { wall: "normal size", gap: 0, force: true, strict: true },
    { wall: "1x speed", gap: 0, force: true, strict: true }, { ceil: 6, strict: true }, { walk: 2 });
  return out;
}
F("long", { doc: "round 4: the never-twice mix with room between effects, long plain motions, and big falls up off the screen onto a high path, and back down",
  lenient: true, noRepeat: true, sparseHazards: true,
  variants: [1, 2, 3, 4, 5, 6].map(seed => ({ id: `long-${seed}`, args: { seed, effects: 18, cols: 400 }, doc: `18 effects with big falls, seed ${seed}` }))
    .concat([{ id: "long-run", args: { seed: 41, effects: 50, cols: 1200 }, doc: "50 effects with big falls up and down: the round 4 lab" }]),
  script: longScript });

// ---------------------------------------------------------------- the auto ending (outro)
// Evgeni (2026-11-26): "i wanted to add some auto gameplay in the end, so its not just flat on the ground near our sign
// ... it could be a signature we iterate on". The outro starts with walls that bring ANY arrival to a plain cube
// (cube portal, normal gravity, normal size, 1x, stacked 24 rows high so a player arriving anywhere goes through them),
// lets it land, then a short round-4 run: a few never-twice effects, one BIG UP off the screen onto a high path, and a
// BIG DOWN that lands on the ground in front of the signature. make.js: spec "outro": true | {seed} (AUTO.md "Outro").
function outroScript(a) {
  const R = rng(a.seed), pick = arr => arr[R() * arr.length | 0];
  const out = [{ roof: true, h: 24, n: a.cols + 80 }];
  for (const w of ["cube portal", "gravity up", "normal size", "1x speed"]) out.push({ wall: w, gap: 0, force: true, strict: true });
  out.push({ walk: 8 }, { ceil: 7 + (R() * 3 | 0), strict: true });
  const modes = MODES.filter(m => m !== "cube"), m1 = pick(modes), m2 = pick(modes.filter(m => m !== m1));
  const pads = ["yellow", "pink", "red", "blue", "spider"], p1 = pick(pads), p2 = pick(pads.filter(p => p !== p1));
  const T = 20 + (R() * 7 | 0), h = 4 + (R() * 2 | 0);
  out.push({ pad: p1, gap: 1 }, { gwall: "flip", gap: 3 }, { wall: MODE_PORTAL[m1], gap: 2 }, { pad: p2, gap: 1 },
    { wall: "cube portal", gap: 2, force: true }, { ceil: T }, { gwall: "down", gap: 1, force: true }, { floor: T - h, n: 26 },
    { wall: MODE_PORTAL[m2], gap: 3 }, { gwall: "up", gap: 3, force: true }, { wall: "2x speed", gap: 2 },
    { wall: "cube portal", gap: 2, force: true, strict: true }, { gwall: "up", gap: 0, force: true, strict: true },
    { endfloor: true, gap: 3, strict: true }, { wall: "1x speed", gap: 2, force: true, strict: true }, { ceil: 12, strict: true }, { walk: 3 });
  return out;
}
F("outro", { doc: "the auto ending before our signature: any arrival -> a plain cube, a few effects, a big fall up off the screen onto a high path, a big fall down in front of the sign",
  lenient: true, noRepeat: true, sparseHazards: true,
  variants: [1, 2, 3, 4, 5, 6].map(seed => ({ id: `outro-${seed}`, args: { seed, cols: 140 }, doc: `the auto ending, seed ${seed}` })),
  script: outroScript });
// the outro for a level: its objects as make.js spec entries from column `col` (the brick's own col 0 -> col), its width;
// from the built bricks (knowledge/autobricks.json) when that variant is there, else built now
function outro(seed = 1) {
  let b = null;
  try { b = JSON.parse(fs.readFileSync(OUT, "utf8")).bricks.find(x => x.id === "outro-" + seed && x.ok); } catch (e) {}
  if (!b) { const f = FAM.find(x => x.id === "outro"), v = { id: "outro-" + seed, args: { seed, cols: 140 } }; b = buildBrick(f, v); }
  if (!b.ok) throw new Error("outro " + seed + " does not clear: " + b.why);
  return { width: b.width, secs: b.secs, entries: col => b.objects.filter(([t]) => t !== 211).map(([t, c, r, e]) => [idOf(t), col + c, r, e || undefined].filter(x => x !== undefined)) };
}

// ---------------------------------------------------------------- round 3: never the same thing twice
// Evgeni (2026-11-26, on jank round 1): "its way too repetivive, in such auto we dont want even like 2 of the same. we said
// more game modes. we said to change heights. and fall. this is just one corridor with poop". So a section is a string of
// SINGLE effects, each a different kind from the last two; the mode changes every 1-3 effects; the roof jumps between
// low and tall every few effects (a tall room + one flip = a big fall up or down); ledges change the floor; speed and size
// change often; no runs of one pad or portal; hazards only where they frame the path (spikes thin: one in four kept).
function mixScript(a) {
  const R = rng(a.seed), pick = arr => arr[R() * arr.length | 0];
  const out = [{ roof: true, h: 8, n: a.cols + 80 }, { walk: 1 }];
  let mode = "cube", mini = false, speed = "1x", sinceMode = 0, sinceCeil = 0, H = 8;
  const recent = [];
  const EFFECTS = {
    flip: () => ({ gwall: "flip", gap: R() * 3 | 0 }),
    fall: () => ({ gwall: "flip", gap: 4 + (R() * 5 | 0) }),   // a flip with room before the next: the long fall / rise
    blue: () => ({ pad: "blue", gap: R() < 0.5 ? 0 : 1 }),
    spider: () => ({ pad: "spider", gap: R() < 0.5 ? 0 : 1 }),
    yellow: () => ({ pad: "yellow", gap: 0 }),
    pink: () => ({ pad: "pink", gap: 0 }),
    red: () => ({ pad: "red", gap: 0 }),
    size: () => { mini = !mini; return { wall: mini ? "mini portal" : "normal size", gap: R() * 2 | 0 }; },
    speed: () => { speed = pick(["0.5x", "1x", "2x", "3x"].filter(x => x !== speed)); return { wall: speed + " speed", gap: R() * 2 | 0 }; },
    ledge: () => ({ land: 2 + (R() * Math.max(1, H - 4) | 0), len: 2 + (R() * 3 | 0) }),
  };
  const keys = Object.keys(EFFECTS);
  for (let k = 0; k < a.effects; k++) {
    // the roof: every 3-5 effects, low (3-5) <-> tall (9-14)
    if (sinceCeil >= 3 + (R() * 3 | 0)) { H = H >= 9 ? 3 + (R() * 3 | 0) : 9 + (R() * 6 | 0); out.push({ ceil: H }); sinceCeil = 0; recent.length = 0; }
    // the mode: every 1-3 effects
    if (sinceMode >= 1 + (R() * 3 | 0)) { mode = pick(MODES.filter(x => x !== mode)); out.push({ wall: MODE_PORTAL[mode], gap: R() * 2 | 0 }); sinceMode = 0; }
    let e; do e = pick(keys); while (recent.includes(e) || (e === "fall" && H < 8) || (e === "ledge" && H < 7));
    recent.push(e); if (recent.length > 2) recent.shift();
    out.push(EFFECTS[e]());
    sinceMode++; sinceCeil++;
  }
  out.push({ ceil: 6 }, { wall: "cube portal", gap: 0 }, { wall: "normal size", gap: 0 }, { wall: "1x speed", gap: 0 }, { wall: "gravity up", gap: 0 }, { walk: 2 });
  return out;
}
F("mix", { doc: "round 3: single effects, never the same twice, the mode every 1-3 effects, low and tall rooms in turn (big falls), ledges, speed and size changes",
  lenient: true, noRepeat: true, sparseHazards: true,
  variants: [1, 2, 3, 4, 5, 6].map(seed => ({ id: `mix-${seed}`, args: { seed, effects: 14, cols: 220 }, doc: `14 effects, seed ${seed}` }))
    .concat([{ id: "mix-long", args: { seed: 31, effects: 60, cols: 900 }, doc: "60 effects, no buffer: the round 3 lab" }]),
  script: mixScript });

function variants(filter) {
  const out = [];
  for (const f of FAM) for (const v of f.variants) if (!filter.length || filter.includes(v.id) || filter.includes(f.id)) out.push([f, v]);
  return out;
}

// ---------------------------------------------------------------- outputs
function writeLevel(file, name, objs, a) {
  const { str } = levelOf(objs.filter(o => o.t !== 211), a);
  const level = GD.parseLevel(str.replace(/;1,211,[^;]*;/, ";"));
  // the run-out: a block far on (the level ends 3 blocks after it), so the player walks on past the brick
  fs.mkdirSync(path.dirname(file), { recursive: true });
  writeGdlvl(file, GD.newRecord(name, "auto bricks: no clicks (tools/autobricks.js, AUTO.md)"), level);
  if (/[\\/]levels[\\/]/.test(path.resolve(file))) require("./planned.js").writeAuto(file, "tools/autobricks.js: no clicks");   // the labs: wip put replays them at once
}
// every good brick in a row: each one's own test (cube on the ground, 1x) with a portal back to the cube and a calm
// stretch between, so the lab clears with no click at all
function labObjects(good, check) {
  const objs = []; let col = 0;
  for (const b of good) {
    const n0 = objs.length, c0 = col;
    if (b.needs.mode !== "cube") { objs.push({ t: MODE_PORTAL[b.needs.mode], c: col, r: 1 }); col += 4; }
    if (b.needs.speed !== "1x") { objs.push({ t: b.needs.speed + " speed", c: col, r: 1 }); col += 2; }
    for (const [t, c, r, e] of b.objects) objs.push(Object.assign({ t, c: col + c, r }, e || {}));
    col += b.width + 1;
    // back to the cube, normal gravity, 1x, on the ground: a wall of portals over the height (the brick may leave anywhere)
    const back = [];
    if (b.leaves.mode !== "cube") back.push("cube portal");
    if (b.leaves.grav !== 1) back.push("gravity up");
    if (b.leaves.speed !== "1x") back.push("1x speed");
    if (b.leaves.mini) back.push("normal size");
    for (const t of back) { for (const r of [1, 4, 7, 10]) objs.push({ t, c: col, r }); col += 2; }
    col += 8;
    // a brick that breaks the chain (its exit does not meet the portal wall) is left out of the lab
    if (check && simOf(objs, { mode: "cube", grav: 1, speed: "1x" }, col).dead) { objs.length = n0; col = c0; b.notInLab = true; }
  }
  return { objs, width: col };
}

function main() {
  const cmd = process.argv[2] || "list", args = process.argv.slice(3).filter(x => !x.startsWith("--"));
  if (cmd === "list") {
    for (const f of FAM) { console.log(`${f.id.padEnd(16)} ${f.doc}`); for (const v of f.variants) console.log(`    ${v.id.padEnd(24)} ${v.doc}`); }
    return;
  }
  if (cmd === "show") {
    const j = JSON.parse(fs.readFileSync(OUT, "utf8")), b = j.bricks.find(x => x.id === args[0]);
    if (!b) { console.log("no brick " + args[0]); return; }
    console.log(JSON.stringify(Object.assign({}, b, { objects: b.objects.length + " objects", path: b.path.length + " samples" }), null, 1));
    return;
  }
  if (cmd !== "build") { console.log("usage: node tools/autobricks.js list | build [id|family ...] | show <id>"); return; }
  const list = variants(args), res = [];
  const t0 = Date.now();
  for (const [f, v] of list) {
    let b; try { b = buildBrick(f, v); } catch (e) { b = { id: v.id, family: f.id, ok: false, why: "error: " + e.message }; }
    res.push(b);
    if (b.ok) console.log(`  ok   ${b.id.padEnd(24)} ${b.secs}s ${String(b.width).padStart(3)} cols  ${b.needs.mode}->${b.leaves.mode}${b.leaves.grav < 0 ? " (upside down)" : ""} row ${b.leaves.row}  movers ${b.nMovers} (${b.rate}/s) rev ${b.reverse} rep ${b.repeats} modes ${b.modeChanges} ${b.modesSeen.length > 1 ? "[" + b.modesSeen.join(",") + " " + b.speedsSeen.join(",") + "] " : ""}turns ${b.turns} rise ${b.rise}  hazards ${b.hazards}  clickSafe ${b.clickSafe}  interest ${b.interest}`);
    else console.log(`  FAIL ${b.id.padEnd(24)} ${b.why}`);
    if (b.ok) writeLevel(path.join(ROOT, "local", "structures", "lego-auto-" + b.id + ".gdlvl"), "auto " + b.id, b.objects.map(([t, c, r, e]) => Object.assign({ t, c, r }, e || {})), { mode: b.needs.mode, grav: b.needs.grav, speed: b.needs.speed });
  }
  // keep earlier results of bricks not rebuilt this time
  let old = []; try { old = JSON.parse(fs.readFileSync(OUT, "utf8")).bricks || []; } catch (e) {}
  const ids = new Set(res.map(b => b.id)), live = new Set(FAM.flatMap(f => f.variants.map(v => v.id)));
  const bricks = old.filter(b => !ids.has(b.id) && live.has(b.id)).concat(res).sort((x, y) => (y.ok - x.ok) || (y.interest || 0) - (x.interest || 0));
  fs.writeFileSync(OUT, JSON.stringify({ v: 1, at: new Date().toISOString().slice(0, 10), note: "auto (no-click) bricks: tools/autobricks.js, AUTO.md", bricks }, null, 0).replace(/\},\{"id"/g, "},\n{\"id\""));
  const good = bricks.filter(b => b.ok);
  console.log(`\n  ${good.length} of ${bricks.length} bricks clear with no click (${((Date.now() - t0) / 1000).toFixed(1)} s) -> ${path.relative(ROOT, OUT)}`);
  // the lab level: every good brick in a row, verified as one run with zero presses
  const lab = labObjects(good.filter(b => !["jank", "chambers", "mix", "long", "outro"].includes(b.family)), true), a = { mode: "cube", grav: 1, speed: "1x" };
  const s = simOf(lab.objs, a, lab.width + 6);
  console.log(`  lab: ${good.length} bricks, ${lab.width} columns: ${s.dead ? "DIES at col " + colOf(s.end.x) + " (" + (s.why || "") + ")" : "clears with no click (" + (s.end.tick / TPS).toFixed(1) + " s)"}`);
  const labFile = path.join(ROOT, "levels", "lab", "auto_lab.gdlvl");
  writeLevel(labFile, "GDLM auto lab", lab.objs, a);
  console.log("  -> " + path.relative(ROOT, labFile) + (good.some(b => b.notInLab) ? "  (left out, their exit breaks the chain: " + good.filter(b => b.notInLab).map(b => b.id).join(", ") + ")" : ""));
  // the jank lab: the long jank section alone, one run with no buffer (Evgeni: "no buffers at all between the sections")
  const ll = good.find(b => b.id === "long-run");
  if (ll) { const f = path.join(ROOT, "levels", "lab", "auto_long.gdlvl"); writeLevel(f, "GDLM auto long", ll.objects.map(([t, c, r, e]) => Object.assign({ t, c, r }, e || {})), a); console.log("  -> " + path.relative(ROOT, f) + ` (${ll.secs} s, ${ll.effects} effects, ${ll.rate}/s, reverse ${ll.reverse}, repeats ${ll.repeats}, mode changes ${ll.modeChanges}, rise ${ll.rise})`); }
  const ml = good.find(b => b.id === "mix-long");
  if (ml) { const f = path.join(ROOT, "levels", "lab", "auto_mix.gdlvl"); writeLevel(f, "GDLM auto mix", ml.objects.map(([t, c, r, e]) => Object.assign({ t, c, r }, e || {})), a); console.log("  -> " + path.relative(ROOT, f) + ` (${ml.secs} s, ${ml.effects} effects, ${ml.rate}/s, reverse ${ml.reverse}, repeats ${ml.repeats}, mode changes ${ml.modeChanges})`); }
  const cl = good.find(b => b.id === "chambers-long");
  if (cl) { const f = path.join(ROOT, "levels", "lab", "auto_chambers.gdlvl"); writeLevel(f, "GDLM auto chambers", cl.objects.map(([t, c, r, e]) => Object.assign({ t, c, r }, e || {})), a); console.log("  -> " + path.relative(ROOT, f) + ` (${cl.secs} s, ${cl.effects} effects, ${cl.rate}/s, reverse ${cl.reverse})`); }
  const jl = good.find(b => b.id === "jank-long");
  if (jl) { const f = path.join(ROOT, "levels", "lab", "auto_jank.gdlvl"); writeLevel(f, "GDLM auto jank", jl.objects.map(([t, c, r, e]) => Object.assign({ t, c, r }, e || {})), a); console.log("  -> " + path.relative(ROOT, f) + ` (${jl.secs} s, ${jl.effects} effects, ${jl.rate}/s)`); }
}
if (require.main === module) main();
module.exports = { FAM, buildBrick, variants, simOf, levelOf, labObjects, place, outro };
