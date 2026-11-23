// node tools/polish.js <level.gdlvl> [--dry] [--passes fair,read,sync,deco] [--min-ms 34] [--out file.gdlvl]
//                      [--name "final name"] [--indicator id[:rot]] [--lift 24] [--force]
// Polish a level that already exists WITHOUT redesigning it (POLISH.md): keep its layout, fix the
// smallest things, in this order, each change kept only if the level still clears on the current
// physics and no other input's window gets worse:
//   fair   inputs whose timing window is under --min-ms (default 34 ms = 2 frames at 60 fps; under
//          17 ms a press can fall between two frames and be impossible on that attempt): try small
//          moves of what is near the input (an orb or pad by half a block or a block, a portal off a
//          block edge, a spike along its surface, a small block group by a row -- with what sits on
//          it), keep the move that widens the window most.
//   read   a small soft jump indicator (tools/decorate.js INDICATOR, the chevron) low over the surface
//          at every NEEDED jump off a surface (the plan without it dies), none within 3 blocks of
//          another; the level's old indicators (group 990) are replaced. Prejumps are marked, not removed.
//   sync   portals onto bar starts (within 1.5 blocks), orbs onto beats (within half a block),
//          loosely: only a move that keeps every window as it was (SYNC.md "How much to sync").
//   deco   only on a level with little decoration (< 30% of objects): block skins 1-7 on plain blocks,
//          the classic ground kit (crystals, rods), chains under hanging blocks -- never where the
//          player's path goes, never within 3 columns of a hazard, orb or pad.
// Writes <out>.gdlvl (default local/polish/<slug>_polished.gdlvl, never committed: it may be the
// user's level) and <out>.compare.json (before + after levels, their solutions, the change list and
// the numbers) for viewer/polish.html (the before/after view). --dry: report only, write nothing.
// Then: node tools/wip.js put <out>.gdlvl --session polish --note "..."
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
const fs = require("fs"), path = require("path");
const { GD, readGdlvl, writeGdlvl } = require("./io.js");
Object.assign(GD, require("../lib/sync.js"), require("../lib/natural.js"));
const DECO = require("./decorate.js");
const { sightread } = require("./sightread.js");

const TPS = GD.PHYS.TPS, FRAME = 1000 / 60, SETTLE = 250; // SETTLE: lib/difficulty.js forcedAfterSwitch
const GAMEPLAY = new Set(["solid", "hazard", "slope", "orb", "pad", "mode", "gravity", "speed"]);
const kindOf = o => GD.objInfo(o.id).kind;
const isGameplay = o => GAMEPLAY.has(kindOf(o));
const clone = o => JSON.parse(JSON.stringify(o));

// ---------- running a plan fast (no path) ----------
function clears(w, ev) {
  const at = new Map(); for (const e of ev) at.set(e.tick, e.type);
  const s = GD.startState(w), max = Math.ceil((w.endX / (GD.SPEEDS[0].x * 60) + 5) * TPS);
  let held = false;
  while (!s.dead && !s.done && s.tick < max) {
    const e = at.get(s.tick); let press = false;
    if (e === "press") { press = true; held = true; } else if (e === "release") held = false;
    GD.step(w, s, { press, held });
  }
  return !s.dead && (s.done || s.x >= w.endX);
}
const sorted = ev => ev.slice().sort((a, b) => a.tick - b.tick);

// ---------- inputs and their windows ----------
// A cube tap is a press with its release a few ticks later: they move together (moving the press alone
// runs into its own release, which made tools/windows.js report 8 ms windows that are really 17-25).
function inputs(ev) {
  const out = [];
  for (let i = 0; i < ev.length; i++) {
    const e = ev[i], n = ev[i + 1];
    if (e.type === "press" && n && n.type === "release" && n.tick - e.tick <= 3) { out.push({ idx: [i, i + 1], type: "tap", tick: e.tick }); i++; }
    else out.push({ idx: [i], type: e.type, tick: e.tick });
  }
  return out;
}
function shifted(ev, inp, d) { const l = ev.map(x => Object.assign({}, x)); for (const i of inp.idx) l[i].tick += d; return l; }
function windowOf(w, ev, ins, k, span = 60) {
  const inp = ins[k], first = ev[inp.idx[0]].tick, last = ev[inp.idx[inp.idx.length - 1]].tick;
  const loB = k > 0 ? ev[ins[k - 1].idx[ins[k - 1].idx.length - 1]].tick + 1 - first : -span;
  const hiB = k + 1 < ins.length ? ev[ins[k + 1].idx[0]].tick - 1 - last : span;
  const ok = d => clears(w, shifted(ev, inp, d));
  // the plan may not clear as it is (after a move): find the nearest shift that does
  let c = null;
  for (let r = 0; r <= 40 && c === null; r++) for (const d of r ? [-r, r] : [0]) if (d >= Math.max(loB, -span) && d <= Math.min(hiB, span) && ok(d)) { c = d; break; }
  if (c === null) return null;
  let lo = c, hi = c;
  while (lo - 1 >= Math.max(loB, -span) && ok(lo - 1)) lo--;
  while (hi + 1 <= Math.min(hiB, span) && ok(hi + 1)) hi++;
  const n = hi - lo + 1;
  // bounded by the neighbouring input: the window is "at least" this
  return { lo: first + lo, hi: first + hi, mid: Math.round((lo + hi) / 2), ms: Math.round(n * 1000 / TPS), bounded: lo === loB || hi === hiB };
}
// every input with its window, where it is, and the time since the last mode / gravity / speed change
function allWindows(w, ev, path) {
  const ins = inputs(ev), out = [];
  let lastChange = 0;
  const changeAt = []; for (let t = 1; t < path.length; t++) { const a = path[t - 1], s = path[t]; if (s.mode !== a.mode || (s.grav || 1) !== (a.grav || 1) || s.sp !== a.sp) changeAt.push(t); }
  for (let k = 0; k < ins.length; k++) {
    const t = ins[k].tick, p = path[Math.min(t, path.length - 1)];
    while (changeAt.length && changeAt[0] <= t) lastChange = changeAt.shift();
    const win = windowOf(w, ev, ins, k);
    // closesAfterSwitchMs: how long after the last mode / gravity / speed change the window CLOSES
    // (lib/difficulty.js forcedAfterSwitch: under 250 ms the input is forced before the player settles)
    out.push(Object.assign({ k, type: ins[k].type, tick: t, x: p.x, y: p.y, mode: p.mode, act: (path[Math.min(t + 1, path.length - 1)] || {}).act || "",
      afterSwitchMs: lastChange ? Math.round((t - lastChange) * 1000 / TPS) : null,
      closesAfterSwitchMs: lastChange && win ? Math.round((win.hi - lastChange) * 1000 / TPS) : null }, win || { ms: 0, dead: true }));
  }
  return out;
}

// ---------- candidate small moves near an input ----------
function hb(o) { try { return GD.hitbox(o); } catch (e) { return null; } }
function blockGroups(objs) {
  const cell = o => Math.round((o.x - 15) / 30) + "," + Math.round((o.y - 15) / 30);
  const solid = objs.map((o, i) => [o, i]).filter(([o]) => kindOf(o) === "solid" || kindOf(o) === "slope");
  const byCell = new Map(solid.map(([o, i]) => [cell(o), i]));
  const seen = new Set(), groups = [];
  for (const [o, i] of solid) {
    if (seen.has(i)) continue;
    const g = [], q = [i]; seen.add(i);
    while (q.length) {
      const j = q.pop(); g.push(j);
      const [c, r] = cell(objs[j]).split(",").map(Number);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = byCell.get((c + dc) + "," + (r + dr)); if (n != null && !seen.has(n)) { seen.add(n); q.push(n); } }
    }
    groups.push(g);
  }
  return groups;
}
function candidates(objs, path, t0, t1) {
  const pts = path.slice(Math.max(0, t0), Math.min(path.length, t1 + 1));
  const near = o => { const b = hb(o); if (!b) return false; return pts.some(p => p.x + 60 >= b.x0 && p.x - 60 <= b.x1 && p.y + 75 >= b.y0 && p.y - 75 <= b.y1); };
  const out = [];
  const idx = objs.map((o, i) => i).filter(i => isGameplay(objs[i]) && near(objs[i]));
  for (const i of idx) {
    const o = objs[i], k = kindOf(o);
    if (k === "orb") for (const [dx, dy] of [[15, 0], [-15, 0], [0, 15], [0, -15], [30, 0], [-30, 0], [0, 30], [0, -30]]) out.push({ what: GD.objInfo(o.id).name, at: [o.x, o.y], moves: [[i, dx, dy]] });
    if (k === "pad" || k === "hazard") for (const dx of [15, -15, 30, -30]) out.push({ what: GD.objInfo(o.id).name, at: [o.x, o.y], moves: [[i, dx, 0]] });
    if (k === "mode" || k === "gravity" || k === "speed") for (const dx of [15, -15, 30, -30, 45, -45]) out.push({ what: GD.objInfo(o.id).name, at: [o.x, o.y], moves: [[i, dx, 0]] });
  }
  // small block groups (with what sits on them) by a row or a column: "widen a gap by a row"
  for (const g of blockGroups(objs)) {
    if (g.length > 12 || !g.some(i => idx.includes(i))) continue;
    const bs = g.map(i => hb(objs[i])).filter(Boolean);
    const x0 = Math.min(...bs.map(b => b.x0)), x1 = Math.max(...bs.map(b => b.x1)), top = Math.max(...bs.map(b => b.y1)), bot = Math.min(...bs.map(b => b.y0));
    const riders = objs.map((o, i) => i).filter(i => !g.includes(i) && !(kindOf(objs[i]) === "solid" || kindOf(objs[i]) === "slope") && objs[i].x >= x0 && objs[i].x <= x1 &&
      ((objs[i].y > top - 2 && objs[i].y < top + 30) || (objs[i].y < bot + 2 && objs[i].y > bot - 30)));
    const all = g.concat(riders);
    for (const [dx, dy] of [[0, 30], [0, -30], [30, 0], [-30, 0]]) out.push({ what: `${g.length} block(s)` + (riders.length ? ` + ${riders.length} on them` : ""), at: [Math.round((x0 + x1) / 2), Math.round((top + bot) / 2)], moves: all.map(i => [i, dx, dy]) });
  }
  return out;
}
function apply(objs, cand) {
  const o2 = objs.map(clone), moved = new Set(cand.moves.map(m => m[0]));
  for (const [i, dx, dy] of cand.moves) { o2[i].x += dx; o2[i].y += dy; }
  // no landing on another gameplay object's spot, no going under the ground
  const spot = o => Math.round(o.x / 7.5) + "," + Math.round(o.y / 7.5);
  const taken = new Set(o2.filter((o, i) => !moved.has(i) && isGameplay(o)).map(spot));
  for (const i of moved) { if (o2[i].y < 0 || o2[i].x < 0 || taken.has(spot(o2[i]))) return null; }
  return o2;
}

// ---------- the passes ----------
function state(objs, header, ev) {
  const w = GD.makeWorld(objs, header), path = GD.run(w, ev).path;
  return { w, path, wins: allWindows(w, ev, path) };
}
// re-centre input k on its window in world w; null if it cannot clear
function retime(w, ev, k) {
  const ins = inputs(ev), win = windowOf(w, ev, ins, k);
  if (!win) return null;
  return sorted(shifted(ev, ins[k], win.mid));
}
// the windows of inputs k-2..k+2 after a change; null if one cannot clear any more
function localWins(w, ev, k) {
  const ins = inputs(ev), out = {};
  for (let j = Math.max(0, k - 2); j <= Math.min(ins.length - 1, k + 2); j++) { const r = windowOf(w, ev, ins, j); if (!r) return null; out[j] = r.ms; }
  return out;
}

function fairPass(objs, header, ev, MIN, log) {
  let S = state(objs, header, ev);
  const tried = new Set();
  for (let round = 0; round < 12; round++) {
    const forced = x => x.closesAfterSwitchMs != null && x.closesAfterSwitchMs < SETTLE && !x.bounded;
    const tight = S.wins.filter(x => !x.dead && (x.ms < MIN && !x.bounded || forced(x)) && !tried.has(x.k)).sort((a, b) => a.ms - b.ms);
    if (!tight.length) break;
    const T = tight[0]; tried.add(T.k);
    const ins = inputs(ev), prevT = T.k > 0 ? ins[T.k - 1].tick : 0, nextT = T.k + 1 < ins.length ? ins[T.k + 1].tick : T.tick + 120;
    const cands = candidates(objs, S.path, prevT, Math.min(nextT, T.tick + 120));
    const old = {}; for (let j = Math.max(0, T.k - 2); j <= Math.min(S.wins.length - 1, T.k + 2); j++) old[j] = S.wins[j].ms;
    let best = null;
    for (const c of cands) {
      const o2 = apply(objs, c); if (!o2) continue;
      const w2 = GD.makeWorld(o2, header);
      const ev2 = retime(w2, ev, T.k); if (!ev2) continue;
      const lw = localWins(w2, ev2, T.k); if (!lw) continue;
      const better = lw[T.k] >= old[T.k] + 8;
      let settles = false;
      if (forced(T)) { const S2 = allWindows(w2, ev2, GD.run(w2, ev2).path)[T.k]; settles = S2 && S2.closesAfterSwitchMs != null && S2.closesAfterSwitchMs >= Math.min(SETTLE, T.closesAfterSwitchMs + 40) && lw[T.k] >= old[T.k] - 4; }
      if (!better && !settles) continue;
      if (Object.keys(old).some(j => +j !== T.k && lw[j] < Math.min(old[j], MIN) - 1)) continue;
      const score = Math.min(...Object.values(lw).filter((v, i) => true)) * 0 + lw[T.k] - c.moves.length * 0.5 - Math.abs(c.moves[0][1] + c.moves[0][2]) / 30;
      if (!best || score > best.score) best = { c, o2, ev2, lw, score };
    }
    if (!best) { log.push({ pass: "fair", kept: true, x: T.x, what: `input at block ${(T.x / 30).toFixed(1)} (${T.ms} ms${T.afterSwitchMs != null && T.afterSwitchMs < 400 ? `, ${T.afterSwitchMs} ms after a mode change` : ""})`, why: "no small move widens it" }); continue; }
    const [i0, dx, dy] = best.c.moves[0];
    objs = best.o2; ev = best.ev2; S = state(objs, header, ev);
    const after = S.wins[T.k] ? S.wins[T.k].ms : best.lw[T.k];
    log.push({ pass: "fair", x: T.x, what: `${best.c.what} at block ${(best.c.at[0] / 30).toFixed(1)}, row ${(best.c.at[1] / 30 - 0.5).toFixed(1)}`,
      change: `moved ${dx ? (dx > 0 ? "right " : "left ") + Math.abs(dx) / 30 + " block" : ""}${dy ? (dy > 0 ? "up " : "down ") + Math.abs(dy) / 30 + " block" : ""}`,
      before: `${T.ms} ms`, after: `${after} ms`, numbers: { input: T.k, beforeMs: T.ms, afterMs: after, neighbours: best.lw } });
    tried.delete(T.k); // may be widened further by a second move
    if (log.filter(l => l.pass === "fair" && l.numbers && l.numbers.input === T.k).length >= 2) tried.add(T.k);
  }
  return { objs, ev };
}

// Indicators (the user on GDLM 46 v2, 2026-11-23: "too high above the ground", one "where no jump is
// needed", "some jumps have none"): every jump off a surface that is NEEDED -- the plan without that tap
// dies -- gets one, LOW over the surface (centre `lift` units up, default INDICATOR.lift = 24: the chevron's bottom just
// above the ground), none within 3 blocks of another. Marks the level already has in the indicator group
// (990) are replaced; other arrows nearby count as marks and are left alone.
function readPass(level, objs, header, ev, opts, log) {
  const sr = sightread({ header, objects: objs }, 1.5);
  const pre = sr.ok ? sr.presses.filter(p => p.flag) : [];
  const grp = String(DECO.INDICATOR.group), inGroup = o => String((o.props || {})[57] || "").split(".").includes(grp);
  const old = objs.filter(o => inGroup(o) || (o.id === 1007 && String((o.props || {})[51]) === grp));
  if (old.length) { objs = objs.filter(o => !old.includes(o)); log.push({ pass: "read", what: `${old.filter(inGroup).length} old indicators`, change: "removed, re-placed by the rule below", before: `${old.filter(inGroup).length}`, after: "see below" }); }
  const w = GD.makeWorld(objs, header), path = GD.run(w, ev).path;
  const id = opts.id || DECO.INDICATOR.id, mo = opts.id ? { rot: opts.rot || 0 } : {}, lift = opts.lift ?? DECO.INDICATOR.lift;
  const other = objs.filter(o => o.id === 914 || [132, 460, 494, 3630, 3631, 3632].includes(o.id) || o.id === id);
  const ins = inputs(ev), marks = [];
  for (const m of DECO.jumpIndicators(w, { events: ev }, id, GD, Object.assign({ all: true }, mo))) {
    // the tap that makes this jump: the input nearest the takeoff
    let best = -1, bd = Infinity;
    ins.forEach((inp, k) => { if (inp.type === "release") return; const d = Math.abs(path[Math.min(inp.tick, path.length - 1)].x - m.x); if (d < bd) { bd = d; best = k; } });
    if (best < 0 || bd > 45) continue;
    const without = ev.filter((e, i) => !ins[best].idx.includes(i));
    if (clears(w, without)) continue;                       // not needed: no mark
    if (marks.length && m.x - marks[marks.length - 1].x < 90) continue;
    const up = m.rot % 360 !== (((mo.rot ?? DECO.INDICATOR.rot ?? 0) + 180) % 360);
    m.y += up ? lift - DECO.INDICATOR.lift : DECO.INDICATOR.lift - lift;
    const isPre = pre.some(p => Math.abs(p.to * 30 - m.x) < 60);
    m.why = (m.why || "needed jump") + (isPre ? ",prejump" : "");
    marks.push(m);
  }
  const add = marks.filter(m => !other.some(a => Math.abs(a.x - m.x) < 60));
  if (!add.length) { log.push({ pass: "read", kept: true, what: `${pre.length} prejump(s)`, why: other.length ? "indicators already there" : "no jump needs one" }); return { objs, prejumps: pre.length }; }
  objs = objs.concat([DECO.indicatorFade()]);
  for (const m of add) { const why = m.why; delete m.why; objs.push(m); log.push({ pass: "read", x: m.x, what: `jump at block ${(m.x / 30).toFixed(1)}`, change: `indicator (${why})`, before: "none", after: `deco ${id}, ${lift} units over the surface` }); }
  return { objs, prejumps: pre.length };
}

function syncPass(L, objs, header, ev, MIN, log) {
  const song = require("./index_levels.js").songOf(L.rec, header);
  const grid = song && require("./beats.js").loadBeats(song.url);
  if (!grid || !grid.ok) { log.push({ pass: "sync", kept: true, what: "song", why: "no beat grid on this PC (node tools/beats.js)" }); return { objs, ev, sync: null }; }
  const off = song.offset || 0;
  const beatOf = (tl, x) => GD.SYNC.timeToBeat(grid, off, GD.SYNC.tOfX(tl, x));
  const isBar = b => { const k = Math.round((GD.SYNC.beatToTime(grid, off, b) + off - grid.t0) / grid.period); return ((k - (grid.downbeat || 0)) % 4 + 4) % 4 === 0; };
  const nearestBar = b => { let best = null; for (let c = Math.floor(b) - 4; c <= Math.ceil(b) + 4; c++) if (isBar(c) && (best === null || Math.abs(c - b) < Math.abs(best - b))) best = c; return best; };
  const on = (tl, os) => os.filter(o => { const b = beatOf(tl, o.x); return Math.abs(b - Math.round(b)) * grid.period < 0.035; }).length;
  let S = state(objs, header, ev);
  const tl0 = GD.SYNC.timeline(S.w);
  const isPortal = o => ["mode", "gravity", "speed"].includes(kindOf(o)), isOrb = o => kindOf(o) === "orb";
  const touched = new Set(); // only what the run reaches
  const before = { portals: on(tl0, objs.filter(isPortal)), orbs: on(tl0, objs.filter(isOrb)), nPortals: objs.filter(isPortal).length, nOrbs: objs.filter(isOrb).length };
  const order = objs.map((o, i) => i).filter(i => isPortal(objs[i]) || isOrb(objs[i])).sort((a, b) => objs[a].x - objs[b].x);
  for (const i of order) {
    const o = objs[i], tl = GD.SYNC.timeline(S.w), b = beatOf(tl, o.x), portal = isPortal(o);
    const target = portal ? nearestBar(b) : Math.round(b);
    const v = GD.SYNC.speedAtT(tl, GD.SYNC.tOfX(tl, o.x));
    const dx = Math.round((GD.SYNC.beatToTime(grid, off, target) - GD.SYNC.tOfX(tl, o.x)) * v);
    if (Math.abs(dx) < 3 || Math.abs(dx) > (portal ? 45 : 15)) continue;
    // the input this object belongs to: the first one at or after it is reached
    const tReach = S.path.findIndex(s => s.x >= o.x - 45), k = S.wins.findIndex(x => x.tick >= tReach);
    const o2 = apply(objs, { moves: [[i, dx, 0]] }); if (!o2) continue;
    const w2 = GD.makeWorld(o2, header);
    let ev2 = k >= 0 ? retime(w2, ev, k) : (clears(w2, ev) ? ev : null);
    const what = `${GD.objInfo(o.id).name} at block ${(o.x / 30).toFixed(1)}`;
    if (!ev2) { log.push({ pass: "sync", kept: true, x: o.x, what, why: `on ${portal ? "the bar" : "the beat"} it would need more than one input re-timed` }); continue; }
    const old = k >= 0 ? localWins(S.w, ev, k) : {}, lw = k >= 0 ? localWins(w2, ev2, k) : {};
    if (!lw || Object.keys(old).some(j => lw[j] < Math.min(old[j], MIN) - 1 || lw[j] < old[j] - 4)) { log.push({ pass: "sync", kept: true, x: o.x, what, why: "on the beat a window gets tighter" }); continue; }
    objs = o2; ev = ev2; S = state(objs, header, ev);
    log.push({ pass: "sync", x: o.x, what, change: `moved ${dx > 0 ? "right" : "left"} ${Math.abs(dx)} units onto ${portal ? "bar start" : "beat"} ${target}`, before: `beat ${b.toFixed(2)}`, after: `beat ${target}` });
  }
  const tl1 = GD.SYNC.timeline(S.w);
  const after = { portals: on(tl1, objs.filter(isPortal)), orbs: on(tl1, objs.filter(isOrb)), nPortals: before.nPortals, nOrbs: before.nOrbs };
  return { objs, ev, sync: { bpm: grid.bpm, before, after } };
}

function decoPass(objs, header, ev, log) {
  const deco = objs.filter(o => !isGameplay(o)).length;
  if (deco / objs.length > 0.3) { log.push({ pass: "deco", kept: true, what: "decoration", why: `${Math.round(deco / objs.length * 100)}% of objects are deco already` }); return { objs }; }
  const w = GD.makeWorld(objs, header), path = GD.run(w, ev).path;
  // the path corridor: where the player's box goes, plus a little
  const inPath = (x, y, r = 30) => { for (let t = 0; t < path.length; t += 2) { const p = path[t]; if (Math.abs(p.x - x) < r && Math.abs(p.y - y) < r + 5) return true; } return false; };
  let n = 0;
  // 1. block skins on plain blocks (the classic outlined set)
  const plain = objs.filter(o => o.id === 1 && !o.rot).length, skinned = objs.filter(o => [2, 3, 4, 6, 7].includes(o.id)).length;
  if (plain > 4 && skinned === 0) {
    const o2 = objs.map(clone); DECO.skinBlocks(o2);
    if (clears(GD.makeWorld(o2, header), ev)) { objs = o2; log.push({ pass: "deco", what: `${plain} plain blocks`, change: "classic outlined skins by exposed sides (ids 1-7)", before: "plain", after: "skinned" }); }
  }
  // 2. the classic ground kit, behind the player: crystals on the floor, rods on block tops
  const endCol = Math.ceil(w.endX / 30);
  const ground = DECO.groundDeco(objs, endCol, 7, () => 0.18).filter(d => !(d.id === 16 && inPath(d.x, d.y + 15, 20)));
  objs = objs.concat(ground); n += ground.length;
  if (ground.length) log.push({ pass: "deco", what: "floor and block tops", change: `${ground.length} ground crystals / rods (none within 3 columns of a hazard, orb or pad)`, before: "bare", after: `${ground.length} objects` });
  // 3. chains under hanging blocks (depth): a block with air under it, 3+ rows up, and the chain off the path
  const solidAt = new Set(objs.filter(o => kindOf(o) === "solid").map(o => Math.round((o.x - 15) / 30) + "," + Math.round((o.y - 15) / 30)));
  const busy = new Set(); for (const o of objs) if (["hazard", "orb", "pad"].includes(kindOf(o))) for (let d = -2; d <= 2; d++) busy.add(Math.round((o.x - 15) / 30) + d);
  let chains = 0, lastC = -10;
  for (const o of objs.filter(o => kindOf(o) === "solid").sort((a, b) => a.x - b.x)) {
    const c = Math.round((o.x - 15) / 30), r = Math.round((o.y - 15) / 30);
    if (r < 3 || solidAt.has(c + "," + (r - 1)) || busy.has(c) || c - lastC < 3) continue;
    const y = o.y - 30;
    if (inPath(o.x, y, 30) || inPath(o.x, y - 15, 30)) continue;
    objs.push({ id: 41, x: o.x, y, rot: 0, flipX: false, flipY: false, props: { 155: "1" } }); chains++; lastC = c;
  }
  if (chains) log.push({ pass: "deco", what: "hanging blocks", change: `${chains} chains under them, off the player's path`, before: "bare", after: `${chains} objects` });
  return { objs };
}

// ---------- look: the modern decoration (knowledge/levels/modern_look.md, knowledge/checklist.md) ----------
// The user (2026-11-23): "By polish i mean make it prettier. More visuals. Maybe more gameplay. More synced.
// Fix visual issues. Maybe to extend if possible". Sections are cut where the run changes mode or gravity
// (at least MINSEC columns each, short ones merged); each gets a palette from the level's own background
// colour turned round the hue wheel, so the level keeps its colours as the first scene. Then:
// tools/decorate.js modernPass (a lit fill behind every block, a soft light on open tops, backdrop shapes
// per kind of section, a dot motif, cloud bands framing the top, a title), tools/vfxkit.js parallax (two
// slow background layers per section) and beatPulses (a pulse on every bar start, a flash at each new
// section) on the song's grid. Only no-collision objects; all behind the play except the pulses.
const MINSEC = 15;
function hsv2rgb(h, s, v) { const f = n => { const k = (n + h / 60) % 6; return Math.round(255 * (v - v * s * Math.max(0, Math.min(k, 4 - k, 1)))); }; return [f(5), f(3), f(1)]; }
function rgb2hsv([r, g, b]) { r /= 255; g /= 255; b /= 255; const M = Math.max(r, g, b), m = Math.min(r, g, b), d = M - m;
  let h = 0; if (d) h = M === r ? ((g - b) / d) % 6 : M === g ? (b - r) / d + 2 : (r - g) / d + 4; return [(h * 60 + 360) % 360, M ? d / M : 0, M]; }
function headerColour(header, ch) { const m = new RegExp("(?:^|\|)1_(\d+)_2_(\d+)_3_(\d+)[^|]*_6_" + ch + "(?:_|\||$)").exec((/kS38,([^,]*)/.exec(header) || [])[1] || ""); return m ? [+m[1], +m[2], +m[3]] : null; }
function sectionsOf(path, endX) {
  const cuts = [0];
  for (let t = 1; t < path.length; t++) { const a = path[t - 1], b = path[t]; if (b.mode !== a.mode || (b.grav || 1) !== (a.grav || 1)) cuts.push(Math.round(b.x / 30)); }
  const secs = [];
  for (let k = 0; k < cuts.length; k++) {
    const from = cuts[k], to = k + 1 < cuts.length ? cuts[k + 1] : Math.ceil(endX / 30) + 4;
    const p = path.find(q => q.x >= from * 30 + 15) || path[path.length - 1];
    const kind = (p.grav || 1) < 0 && p.mode === "cube" ? "upside" : p.mode;
    if (secs.length && (to - from < MINSEC || secs[secs.length - 1].to - secs[secs.length - 1].from < MINSEC)) { secs[secs.length - 1].to = to; continue; }
    secs.push({ from, to, kind });
  }
  return secs;
}
function lookPass(L, objs, header, ev, log) {
  const w = GD.makeWorld(objs, header), path = GD.run(w, ev).path, blocks = Math.ceil(w.endX / 30);
  const perBlock = objs.length / blocks;
  if (perBlock > 8) { log.push({ pass: "look", kept: true, what: "decoration", why: `${perBlock.toFixed(1)} objects per block already` }); return { objs }; }
  // channels: modernPass and vfxkit use 20 + 2i (fill) and 21 + 2i (light); refuse if the level uses them
  const used = new Set(objs.flatMap(o => [o.props && o.props[21], o.props && o.props[22], o.props && o.props[23]].filter(Boolean).map(Number)));
  const secs = sectionsOf(path, w.endX);
  if ([...used].some(c => c >= 20 && c < 20 + 2 * secs.length)) { log.push({ pass: "look", kept: true, what: "decoration", why: "the level uses colour channels 20+ (modernPass's)" }); return { objs }; }
  const base = rgb2hsv(headerColour(header, 1000) || [40, 60, 160]);
  secs.forEach((sc, i) => {
    const h = (base[0] + i * 47) % 360, sat = Math.max(0.45, base[1]), v = Math.max(0.35, Math.min(0.75, base[2]));
    // the fill sits behind every block, and GD's blocks are see-through: a bright fill turned GDLM 46's
    // wave walls into flat hot-pink masses (render, 2026-11-23). So: a dark tint of the scene's colour,
    // and a soft pastel light
    sc.fill = hsv2rgb(h, sat * 0.7, Math.min(0.32, v * 0.5)); sc.light = hsv2rgb(h, sat * 0.4, 0.85); sc.flash = i > 0;
  });
  const n0 = objs.length;
  const add = [];
  const o2 = objs.map(clone);
  const plain = o2.filter(o => o.id === 1 && !o.rot).length, skinned = o2.filter(o => [2, 3, 4, 6, 7].includes(o.id)).length;
  add.push(...DECO.modernPass(o2, secs, { title: L.name.replace(/^GDLM (polished )?/, ""), seed: 5 }));
  // no reskinning: the outlined classic skins over modernPass's lit fill drew the user's glowing black
  // blocks (cube timings) as a checkered grid in the GD-art render -- the level's own block look stays
  const kit = require("./vfxkit.js");
  add.push(...kit.parallax(secs, { speed: GD.SPEEDS[w.startSpeed || 1] ? GD.SPEEDS[w.startSpeed || 1].x * 60 : undefined }));
  const song = require("./index_levels.js").songOf(L.rec, header), grid = song && require("./beats.js").loadBeats(song.url);
  let pulses = 0;
  if (grid && grid.ok) { const tl = GD.SYNC.timeline(w), pl = kit.beatPulses(secs, grid, { xOfT: t => GD.SYNC.xOfT(tl, t), songOffset: song.offset || 0 }); pulses = pl.length; add.push(...pl); }
  // nothing decorative may sit on the player's path in front of it: drop front-layer objects (key 24 > 3) near the path
  const front = d => +(d.props && d.props[24] || 0) > 3;
  const near = (x, y) => { for (let t = 0; t < path.length; t += 3) { const p = path[t]; if (Math.abs(p.x - x) < 40 && Math.abs(p.y - y) < 40) return true; } return false; };
  // and no shape over a hazard, orb or pad (knowledge/checklist.md "Readable"): a cloud band crossed cube
  // timings' hanging spikes in the GD-art render. Radius from the object's scale; triggers and the block
  // fills (207 / 505, on the blocks by design) are exempt; parallax layers move, so their spot says little
  const hot = objs.filter(o => ["hazard", "orb", "pad"].includes(kindOf(o)));
  const overHazard = d => { if (kindOf(d) === "trigger" || d.id === 207 || d.id === 505 || +(d.props && d.props[57]) >= 100 && +(d.props && d.props[57]) < 200) return false;
    const r = 30 * Math.max(0.5, +(d.props && d.props[32]) || 1) + 15; return hot.some(h => Math.abs(h.x - d.x) < r && Math.abs(h.y - d.y) < r); };
  // the soft light (505) on a block whose top a slope covers drew the wave's diagonal walls as a staircase
  // (GDLM 46 v3 render; "the wave looks like cube" was GDLM 44's complaint about square walls)
  const slopeCell = new Set(objs.filter(o => kindOf(o) === "slope").map(o => Math.round((o.x - 15) / 30) + "," + Math.round((o.y - 15) / 30)));
  const underSlope = d => d.id === 505 && [0, 1, -1].some(dc => slopeCell.has((Math.round((d.x - 15) / 30) + dc) + "," + (Math.round((d.y - 15) / 30) + 1)));
  const keep = add.filter(d => !(front(d) && near(d.x, d.y)) && !overHazard(d) && !underSlope(d));
  const out = o2.concat(keep);
  if (!clears(GD.makeWorld(out, header), ev)) { log.push({ pass: "look", kept: true, what: "decoration", why: "the decorated level no longer clears with the same plan: not added" }); return { objs }; }
  log.push({ pass: "look", what: `${secs.length} sections (${secs.map(sc => sc.kind + " " + sc.from + "-" + sc.to).join(", ")})`,
    change: `modern decoration: lit block fills, backdrops, motif, cloud frame, title; parallax; ${pulses} beat pulses`,
    before: `${perBlock.toFixed(1)} objects/block`, after: `${(out.length / blocks).toFixed(1)} objects/block (+${out.length - n0})` });
  return { objs: out, sections: secs };
}

// ---------- the level's numbers ----------
function numbers(objs, header, ev, MIN) {
  const S = state(objs, header, ev), ms = S.wins.filter(x => !x.dead && (x.type === "tap" || x.type === "press")).map(x => x.ms);
  const s = ms.slice().sort((a, b) => a - b);
  return { inputs: S.wins.length, tightestMs: s[0], medianMs: s[Math.floor(s.length / 2)], under: ms.filter(m => m < MIN).length, under1frame: ms.filter(m => m < FRAME).length,
    forced: S.wins.filter(x => x.closesAfterSwitchMs != null && x.closesAfterSwitchMs < SETTLE && !x.bounded).length,
    deco: objs.filter(o => !isGameplay(o)).length, objects: objs.length, wins: S.wins.map(x => ({ x: Math.round(x.x), ms: x.ms, type: x.type, mode: x.mode, bounded: !!x.bounded, afterSwitchMs: x.afterSwitchMs, closesAfterSwitchMs: x.closesAfterSwitchMs })) };
}

function polish(file, opt = {}) {
  const L = readGdlvl(file), header = L.level.header, MIN = opt.minMs || 34;
  const passes = opt.passes || ["fair", "sync", "read", "look"];
  const w0 = GD.makeWorld(L.level.objects, header);
  const cached = require("./solutions.js").get(L.levelStr);
  const r0 = GD.solveAny(w0);
  if (!r0.ok) throw new Error(`${L.name}: not beatable on the current physics (dies at block ${(r0.dieAt.x / 30).toFixed(1)}: ${r0.why}); fix the level or the physics first`);
  // windows are measured on the NATURAL plan (lib/natural.js: a tap per jump, ship and wave flown along
  // the middle): the solver's fewest-presses plan holds through whole cube runs, and a hold's press
  // timing sets every jump after it -- GDLM 44 read "4 ms" at block 5 that no player meets
  let objs = L.level.objects.map(clone), ev = sorted(r0.events), plan = "solver";
  try { const n = GD.naturalPlan(w0, r0, objs); if (n && clears(w0, n.events)) { ev = sorted(n.events); plan = "natural"; } } catch (e) {}
  const log = [], before = numbers(objs, header, ev, MIN);
  const beforeSR = sightread({ header, objects: objs }, 1.5);
  before.prejumps = beforeSR.ok ? beforeSR.presses.filter(p => p.flag).length : null;
  let sync = null;
  if (passes.includes("fair")) ({ objs, ev } = fairPass(objs, header, ev, MIN, log));
  if (passes.includes("sync")) ({ objs, ev, sync } = syncPass(L, objs, header, ev, MIN, log));
  if (passes.includes("read")) ({ objs } = readPass(L.level, objs, header, ev, opt.indicator || {}, log));
  if (passes.includes("look")) ({ objs } = lookPass(L, objs, header, ev, log));
  if (passes.includes("deco")) ({ objs } = decoPass(objs, header, ev, log)); // the old classic kit, by request only
  // the final check: a fresh solve on the current physics, not just our edited plan
  const w1 = GD.makeWorld(objs, header), r1 = GD.solveAny(w1);
  if (!r1.ok) throw new Error(`polished level does not solve (dies at block ${(r1.dieAt.x / 30).toFixed(1)}: ${r1.why}) -- a pass is wrong`);
  // the fairness gate (tools/fairness.js, difficulty session: families fitted on the user's labelled
  // deaths): a FAIL blocks writing, unless --force; WARNs go into the report
  let fair = null;
  try { const F = require("./fairness.js"); w1.name = L.name; fair = F.flags(F.analyse(w1, r1)); } catch (e) { fair = null; log.push({ pass: "gate", kept: true, what: "fairness", why: "tools/fairness.js failed: " + e.message }); }
  for (const f of fair || []) log.push({ pass: "gate", kept: true, x: f.x0, what: `${f.severity} ${f.family} at block ${(f.x0 / 30).toFixed(1)}`, why: f.note });
  if (fair && fair.some(f => f.severity === "FAIL") && !opt.force) throw new Error("the fairness gate fails (tools/fairness.js):\n" + fair.filter(f => f.severity === "FAIL").map(f => `  ${f.family} at block ${(f.x0 / 30).toFixed(1)}: ${f.note}`).join("\n") + "\n(--force writes it anyway)");
  const after = numbers(objs, header, sorted(ev), MIN);
  const afterSR = sightread({ header, objects: objs }, 1.5);
  after.prejumps = afterSR.ok ? afterSR.presses.filter(p => p.flag).length : null;
  return { L, objs, header, log, before, after, sync, r0, r1, cached, plan, fair };
}

function print(res) {
  const { L, log, before: b, after: a, sync } = res;
  console.log(`== ${L.name}: ${b.objects} -> ${a.objects} objects (windows on the ${res.plan} plan)`);
  console.log(`   windows: tightest ${b.tightestMs} -> ${a.tightestMs} ms, median ${b.medianMs} -> ${a.medianMs} ms, under the limit ${b.under} -> ${a.under}, under 1 frame ${b.under1frame} -> ${a.under1frame}`);
  if (res.fair) console.log(`   fairness gate (tools/fairness.js): ${res.fair.length ? res.fair.map(f => f.severity + " " + f.family).join(", ") : "fair"}`);
  console.log(`   forced right after a mode change (window closes < ${SETTLE} ms after it): ${b.forced} -> ${a.forced}`);
  console.log(`   prejumps ${b.prejumps} -> ${a.prejumps} (indicators mark the rest), deco ${b.deco} -> ${a.deco}`);
  if (sync) console.log(`   sync (${sync.bpm.toFixed(1)} BPM): portals on a beat ${sync.before.portals}/${sync.before.nPortals} -> ${sync.after.portals}/${sync.after.nPortals}, orbs ${sync.before.orbs}/${sync.before.nOrbs} -> ${sync.after.orbs}/${sync.after.nOrbs}`);
  console.log(`   inputs: before -> after (ms; + = bounded by the next input, at least this)${b.wins.length !== a.wins.length ? "  [input count changed: " + b.wins.length + " -> " + a.wins.length + "]" : ""}`);
  for (let k = 0; k < Math.max(b.wins.length, a.wins.length); k++) {
    const x = b.wins[k], y = a.wins[k], f = v => v ? `${String(v.ms).padStart(4)} ms${v.bounded ? "+" : " "}` : "   -    ";
    const z = x || y;
    console.log(`     block ${(z.x / 30).toFixed(1).padStart(6)} ${z.type.padEnd(7)} ${z.mode.padEnd(6)} ${f(x)} -> ${f(y)}${x && x.closesAfterSwitchMs != null && x.closesAfterSwitchMs < 500 ? `  closes ${x.closesAfterSwitchMs}${y && y.closesAfterSwitchMs != null ? " -> " + y.closesAfterSwitchMs : ""} ms after a switch${x.closesAfterSwitchMs < SETTLE ? " FORCED" : ""}` : ""}${x && y && y.ms < x.ms ? "  (tighter)" : ""}`);
  }
  console.log("   changes:");
  for (const l of log) console.log(l.kept ? `     [${l.pass}] kept: ${l.what} -- ${l.why}` : `     [${l.pass}] ${l.what}: ${l.change} (${l.before} -> ${l.after})`);
}

if (require.main === module) {
  const a = process.argv.slice(2), file = a.find(x => x.endsWith(".gdlvl"));
  const val = k => { const i = a.indexOf("--" + k); return i < 0 ? undefined : a[i + 1]; };
  if (!file) { console.log(fs.readFileSync(__filename, "utf8").split("\n").slice(0, 24).join("\n")); process.exit(1); }
  const ind = val("indicator");
  const res = polish(file, { minMs: val("min-ms") ? +val("min-ms") : 34, passes: val("passes") ? val("passes").split(",") : undefined,
    force: a.includes("--force"), indicator: Object.assign(ind ? { id: +ind.split(":")[0], rot: +(ind.split(":")[1] || 0) } : {}, val("lift") ? { lift: +val("lift") } : {}) });
  print(res);
  if (a.includes("--dry")) process.exit(0);
  const slug = GD.getField(res.L.rec, "k2").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const out = val("out") || path.join(__dirname, "..", "local", "polish", slug + "_polished.gdlvl");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  // names are fixed at the first upload (PUBLISH.md: the server refuses a renamed shared level), so a
  // GDLM level keeps its name exactly; anything else needs a proper final name (--name) before it is uploaded
  const rec = res.L.rec, name = val("name") || (/^GDLM /.test(res.L.name) ? res.L.name : "GDLM polished " + res.L.name);
  if (!val("name") && !/^GDLM /.test(res.L.name)) console.log(`note: "${name}" is a working name; give it its final name with --name before it is ever uploaded (names never change after)`);
  GD.setField(rec, "k2", "s", name);
  writeGdlvl(out, rec, { header: res.header, objects: res.objs });
  // before/after for viewer/polish.html: both levels with their (natural) solutions
  const sols = require("./solutions.js"), { songOf } = require("./index_levels.js");
  const before = readGdlvl(file), after = readGdlvl(out);
  const sb = sols.fromRun(before.level, before.levelStr, res.r0), sa = sols.fromRun(after.level, after.levelStr, res.r1);
  const cmp = { made: new Date().toISOString(), source: file, out: path.relative(path.join(__dirname, ".."), out).replace(/\\/g, "/"),
    before: { name: before.name, level: before.levelStr, solution: sb, song: songOf(before.rec, before.level.header), numbers: Object.assign({}, res.before, { wins: undefined }) },
    after: { name: after.name, level: after.levelStr, solution: sa, song: songOf(after.rec, after.level.header), numbers: Object.assign({}, res.after, { wins: undefined }) },
    windows: { before: res.before.wins, after: res.after.wins }, sync: res.sync, changes: res.log };
  fs.writeFileSync(out.replace(/\.gdlvl$/, ".compare.json"), JSON.stringify(cmp));
  console.log(`wrote ${out} ("${name}") and its .compare.json; before/after: node tools/serve.js, http://localhost:8765/viewer/polish.html#c=${encodeURIComponent(cmp.out.replace(/\.gdlvl$/, ".compare.json"))}`);
}
module.exports = { polish, inputs, windowOf, allWindows, clears };
