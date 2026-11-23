// node tools/polish.js <level.gdlvl> [--dry] [--passes fair,read,sync,deco] [--min-ms 34] [--out file.gdlvl]
//                      [--name "new name"] [--indicator id[:rot]]
// Polish a level that already exists WITHOUT redesigning it (POLISH.md): keep its layout, fix the
// smallest things, in this order, each change kept only if the level still clears on the current
// physics and no other input's window gets worse:
//   fair   inputs whose timing window is under --min-ms (default 34 ms = 2 frames at 60 fps; under
//          17 ms a press can fall between two frames and be impossible on that attempt): try small
//          moves of what is near the input (an orb or pad by half a block or a block, a portal off a
//          block edge, a spike along its surface, a small block group by a row -- with what sits on
//          it), keep the move that widens the window most.
//   read   prejumps (tools/sightread.js) and jumps that cannot be read in time
//          (tools/decorate.js jumpIndicators: far cue, ledge, first jump after a portal): add a small,
//          soft jump indicator (default a faded text "v", like compose.js) where none is near.
//   sync   portals onto bar starts (within 1.5 blocks), orbs onto beats (within half a block),
//          loosely: only a move that keeps every window as it was (SYNC.md "How much to sync").
//   deco   only on a level with little decoration (< 30% of objects): block skins 1-7 on plain blocks,
//          the classic ground kit (crystals, rods), chains under hanging blocks -- never where the
//          player's path goes, never within 3 columns of a hazard, orb or pad.
// Writes <out>.gdlvl (default local/polish/<slug>_polished.gdlvl, never committed: it may be the
// user's level) and <out>.compare.json (before + after levels, their solutions, the change list and
// the numbers) for viewer/polish.html (the before/after view). --dry: report only, write nothing.
// Then: node tools/wip.js put <out>.gdlvl --session polish --note "..."
const fs = require("fs"), path = require("path");
const { GD, readGdlvl, writeGdlvl } = require("./io.js");
Object.assign(GD, require("../lib/sync.js"), require("../lib/natural.js"));
const DECO = require("./decorate.js");
const { sightread } = require("./sightread.js");

const TPS = GD.PHYS.TPS, FRAME = 1000 / 60;
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
    out.push(Object.assign({ k, type: ins[k].type, tick: t, x: p.x, y: p.y, mode: p.mode, act: (path[Math.min(t + 1, path.length - 1)] || {}).act || "",
      afterSwitchMs: lastChange ? Math.round((t - lastChange) * 1000 / TPS) : null }, win || { ms: 0, dead: true }));
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
    const tight = S.wins.filter(x => !x.dead && x.ms < MIN && !x.bounded && !tried.has(x.k)).sort((a, b) => a.ms - b.ms);
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
      if (lw[T.k] < old[T.k] + 8) continue;
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

function readPass(level, objs, header, ev, opts, log) {
  const lv = { header, objects: objs };
  const sr = sightread(lv, 1.5);
  const w = GD.makeWorld(objs, header), path = GD.run(w, ev).path;
  const already = objs.filter(o => o.id === 914 || [132, 460, 494, 3630, 3631, 3632].includes(o.id) || (opts.id && o.id === opts.id));
  const marks = DECO.jumpIndicators(w, { events: ev }, opts.id || DECO.INDICATOR.id, GD, opts.id ? { rot: opts.rot } : {});
  // a prejump the indicator rule missed gets one at its takeoff
  const pre = sr.ok ? sr.presses.filter(p => p.flag) : [];
  for (const p of pre) {
    const x = p.to * 30;
    if (marks.some(m => Math.abs(m.x - x) < 60)) { marks.find(m => Math.abs(m.x - x) < 60).why += ",prejump"; continue; }
    const t = path.findIndex(s => s.x >= x); const s = path[Math.max(0, t)];
    if (!s || !(s.grounded || s.mode !== "cube")) continue;
    const up = (s.grav || 1) > 0, surface = up ? s.y - 15 : s.y + 15;
    marks.push({ id: opts.id || DECO.INDICATOR.id, x: Math.round(x / 15) * 15, y: up ? surface + DECO.INDICATOR.lift : surface - DECO.INDICATOR.lift,
      rot: ((opts.rot || 0) + (up ? 0 : 180)) % 360, flipX: false, flipY: false, props: { 155: "1", 57: String(DECO.INDICATOR.group), 31: Buffer.from("v").toString("base64"), 32: "0.8" }, why: "prejump" });
  }
  const add = marks.filter(m => !already.some(a => Math.abs(a.x - m.x) < 120));
  if (!add.length) { log.push({ pass: "read", kept: true, what: `${pre.length} prejump(s)`, why: already.length ? "indicators already there" : "no jump needs one" }); return { objs, prejumps: pre.length }; }
  if (!opts.id) add.push(DECO.indicatorFade());
  for (const m of add) { const why = m.why; delete m.why; objs.push(m); if (why) log.push({ pass: "read", x: m.x, what: `jump at block ${(m.x / 30).toFixed(1)}`, change: `indicator added (${why})`, before: "none", after: opts.id ? `deco ${opts.id}` : `"v" at 45%` }); }
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

// ---------- the level's numbers ----------
function numbers(objs, header, ev, MIN) {
  const S = state(objs, header, ev), ms = S.wins.filter(x => !x.dead && (x.type === "tap" || x.type === "press")).map(x => x.ms);
  const s = ms.slice().sort((a, b) => a - b);
  return { inputs: S.wins.length, tightestMs: s[0], medianMs: s[Math.floor(s.length / 2)], under: ms.filter(m => m < MIN).length, under1frame: ms.filter(m => m < FRAME).length,
    deco: objs.filter(o => !isGameplay(o)).length, objects: objs.length, wins: S.wins.map(x => ({ x: Math.round(x.x), ms: x.ms, type: x.type, mode: x.mode, bounded: !!x.bounded, afterSwitchMs: x.afterSwitchMs })) };
}

function polish(file, opt = {}) {
  const L = readGdlvl(file), header = L.level.header, MIN = opt.minMs || 34;
  const passes = opt.passes || ["fair", "read", "sync", "deco"];
  const w0 = GD.makeWorld(L.level.objects, header);
  const cached = require("./solutions.js").get(L.levelStr);
  const r0 = GD.solveAny(w0);
  if (!r0.ok) throw new Error(`${L.name}: not beatable on the current physics (dies at block ${(r0.dieAt.x / 30).toFixed(1)}: ${r0.why}); fix the level or the physics first`);
  let objs = L.level.objects.map(clone), ev = sorted(r0.events);
  const log = [], before = numbers(objs, header, ev, MIN);
  const beforeSR = sightread({ header, objects: objs }, 1.5);
  before.prejumps = beforeSR.ok ? beforeSR.presses.filter(p => p.flag).length : null;
  let sync = null;
  if (passes.includes("fair")) ({ objs, ev } = fairPass(objs, header, ev, MIN, log));
  if (passes.includes("sync")) ({ objs, ev, sync } = syncPass(L, objs, header, ev, MIN, log));
  if (passes.includes("read")) ({ objs } = readPass(L.level, objs, header, ev, opt.indicator || {}, log));
  if (passes.includes("deco")) ({ objs } = decoPass(objs, header, ev, log));
  // the final check: a fresh solve on the current physics, not just our edited plan
  const w1 = GD.makeWorld(objs, header), r1 = GD.solveAny(w1);
  if (!r1.ok) throw new Error(`polished level does not solve (dies at block ${(r1.dieAt.x / 30).toFixed(1)}: ${r1.why}) -- a pass is wrong`);
  const after = numbers(objs, header, sorted(ev), MIN);
  const afterSR = sightread({ header, objects: objs }, 1.5);
  after.prejumps = afterSR.ok ? afterSR.presses.filter(p => p.flag).length : null;
  return { L, objs, header, log, before, after, sync, r0, r1, cached };
}

function print(res) {
  const { L, log, before: b, after: a, sync } = res;
  console.log(`== ${L.name}: ${b.objects} -> ${a.objects} objects`);
  console.log(`   windows: tightest ${b.tightestMs} -> ${a.tightestMs} ms, median ${b.medianMs} -> ${a.medianMs} ms, under the limit ${b.under} -> ${a.under}, under 1 frame ${b.under1frame} -> ${a.under1frame}`);
  console.log(`   prejumps ${b.prejumps} -> ${a.prejumps} (indicators mark the rest), deco ${b.deco} -> ${a.deco}`);
  if (sync) console.log(`   sync (${sync.bpm.toFixed(1)} BPM): portals on a beat ${sync.before.portals}/${sync.before.nPortals} -> ${sync.after.portals}/${sync.after.nPortals}, orbs ${sync.before.orbs}/${sync.before.nOrbs} -> ${sync.after.orbs}/${sync.after.nOrbs}`);
  console.log(`   inputs: before -> after (ms; + = bounded by the next input, at least this)${b.wins.length !== a.wins.length ? "  [input count changed: " + b.wins.length + " -> " + a.wins.length + "]" : ""}`);
  for (let k = 0; k < Math.max(b.wins.length, a.wins.length); k++) {
    const x = b.wins[k], y = a.wins[k], f = v => v ? `${String(v.ms).padStart(4)} ms${v.bounded ? "+" : " "}` : "   -    ";
    const z = x || y;
    console.log(`     block ${(z.x / 30).toFixed(1).padStart(6)} ${z.type.padEnd(7)} ${z.mode.padEnd(6)} ${f(x)} -> ${f(y)}${z.afterSwitchMs != null && z.afterSwitchMs < 400 ? `  ${z.afterSwitchMs} ms after a switch` : ""}${x && y && y.ms < x.ms ? "  (tighter)" : ""}`);
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
    indicator: ind ? { id: +ind.split(":")[0], rot: +(ind.split(":")[1] || 0) } : {} });
  print(res);
  if (a.includes("--dry")) process.exit(0);
  const slug = GD.getField(res.L.rec, "k2").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const out = val("out") || path.join(__dirname, "..", "local", "polish", slug + "_polished.gdlvl");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const rec = res.L.rec, name = val("name") || (/^GDLM /.test(res.L.name) ? res.L.name + " polished" : "GDLM polished " + res.L.name);
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
