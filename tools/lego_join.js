// node tools/lego_join.js [--n 30] [--seed 1] [--grain piece|brick] [--any] [--fill] [--pair <idA> <idB>] [--max-s 3]
//   --fill: start in A's real entry state (no lead-in) and fill secret ways with spikes, re-solving up to 6 rounds   -- the big-lego test (LEGO.md "Joining")
// Joins two main-level pieces (from local/lego/pieces.json, tools/lego.js mine) into one small level and asks our physics
// whether it still plays: lead-in -> piece A -> piece B, with a mode / speed portal at the seam when B needs one. Then:
//   - solved?   the solver (GD.solveAny) finds a clear; else the join is broken and says where it dies;
//   - secret way? the solved route leaves the pieces' own routes by more than 2.5 blocks for a block or more (it flies
//     over a roof, drops under a floor, skips the piece): the user, 2026-11-25: "careful for secret ways or just empty
//     spaces, for smaller structures might need to put hazards in the rest of the gap";
//   - open space: columns at the seam where the route has neither floor nor roof within 6 blocks (to be filled).
// Pairs follow the combining rules (LEGO.md "Combining"): B another kind of piece than A, about as hard (intensity within
// 0.8-1.25x), mode changes allowed. Writes local/lego/joins/<a>+<b>.gdlvl (RobTop's layouts: PC only) and the numbers to
// knowledge/lego_joins.json (no layouts).
"use strict";
if (require.main === module) require("./heavy.js").claim();
const fs = require("fs"), path = require("path");
const { GD, writeGdlvl } = require("./io.js");
const ROOT = path.join(__dirname, ".."), LOCAL = path.join(ROOT, "local"), B = 30, TPS = GD.PHYS.TPS;
const MODE_ID = { cube: 12, ship: 13, ball: 47, ufo: 111, wave: 660, robot: 745, spider: 1331, swing: 1933 };
const SPEED_ID = { 0: 200, 1: 201, 2: 202, 3: 203, 4: 1334 };
const KEEP = new Set(["solid", "slope", "hazard", "orb", "pad", "mode", "gravity", "speed", "size"]);
const r1 = v => Math.round(v * 10) / 10;

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const LEVELS = {};
function official(n) {
  if (!LEVELS[n]) { const j = JSON.parse(fs.readFileSync(path.join(LOCAL, `official_${String(n).padStart(2, "0")}.json`), "utf8")); LEVELS[n] = GD.parseLevel(j.level); }
  return LEVELS[n];
}
// the gameplay objects of a piece, moved so the piece starts at x = at (units)
function objectsOf(p, at, pre) {
  const L = official(+p.level.split(" ")[0]), x0 = p.xa * B - (pre || 0) * B, x1 = p.xa * B + p.w * B, out = [];
  for (const o of L.objects) {
    if (o.x < x0 - 15 || o.x >= x1) continue;
    const d = GD.objInfo(o.id); if (!d || !KEEP.has(d.kind)) continue;
    if (d.kind === "mode" || d.kind === "speed") continue;   // the join sets the mode and speed itself
    const c = { ...o, props: { ...o.props } }; c.x = o.x - x0 + at; c.props[2] = String(c.x); out.push(c);
  }
  return out;
}
// A's real entry state: the official route played up to A's start (the player arrives exactly as in the main level, so a
// join is not broken by a made-up lead-in; the first runs died inside the lead-in: 13 of 13 "broken" joins, 2026-11-25)
const RUNS = {};
function entryState(p) {
  const n = +p.level.split(" ")[0];
  if (!RUNS[n]) { const j = JSON.parse(fs.readFileSync(path.join(LOCAL, `official_${String(n).padStart(2, "0")}.json`), "utf8")); const L = official(n), w = GD.makeWorld(L.objects, L.header); RUNS[n] = { path: GD.run(w, j.solution.events).path, events: j.solution.events }; }
  const R = RUNS[n], i = R.path.findIndex(s => s.x >= p.xa * B);
  if (i < 0) return null;
  let held = false; for (const e of R.events) { if (e.tick > R.path[i].tick) break; held = e.type === "press"; }
  return { s: R.path[i], held };
}
function portal(id, x, y) { return { id, x, y, rot: 0, flipX: false, flipY: false, props: { 1: String(id), 2: String(x), 3: String(y) } }; }

// the lead-in is the 10 blocks of A's own level before it (its own way into A's entry state), played in A's mode
const PRE = 10;
// direct: no lead-in; A's objects from 2 blocks before it (what the player stands on), the player put in A's entry state
function joinDirect(A, Bp, fill) {
  const lead = 6 * B, bx = lead + A.w * B, objs = [];
  objs.push(...objectsOf(A, lead - 2 * B, 2));   // objectsOf puts its first (pre) column at "at": A itself starts at lead
  const yB = Bp.path[0][1] * B;
  if ((Bp.speed || 1) !== (A.speed || 1)) objs.push(portal(SPEED_ID[Bp.speed || 1] || 201, bx - 20, Math.max(15, yB)));
  if (Bp.mode !== A.mode) { const top = Math.max(...A.path.map(q => q[1]), ...Bp.path.map(q => q[1])) * B + 120; for (let y = 45; y <= top; y += 90) objs.push(portal(MODE_ID[Bp.mode], bx - 10, y)); }
  objs.push(...objectsOf(Bp, bx));
  objs.push(...(fill || []));
  const e = entryState(A); if (!e) return null;
  const start = { ...e.s, used: [], x: e.s.x - A.xa * B + lead, tick: 0 };   // used: object indices of the other world
  return { level: { header: official(+A.level.split(" ")[0]).header, objects: objs }, bx, end: bx + Bp.w * B, lead, start, held: e.held };
}
function join(A, Bp) {
  const lead = (8 + PRE) * B, gap = 0;
  const yA = A.path[0][1] * B, yB = Bp.path[0][1] * B;
  const ctx = lead - PRE * B, objs = [portal(SPEED_ID[A.speed || 1] || 201, ctx - 60, 15)];
  for (let y = 45; y <= Math.max(...A.path.map(q => q[1])) * B + 120; y += 90) objs.push(portal(MODE_ID[A.mode], ctx - 30, y));
  objs.push(...objectsOf(A, ctx, PRE));
  const bx = lead + A.w * B + gap;
  if ((Bp.speed || 1) !== (A.speed || 1)) objs.push(portal(SPEED_ID[Bp.speed || 1] || 201, bx - 20, Math.max(15, yB)));
  // a mode seam must not be skippable: portals stacked over the whole height either piece uses (the official levels wall
  // them in instead; this is the simplest filler). First join run: 2 of 12 broke on "skipped a portal".
  if (Bp.mode !== A.mode) { const top = Math.max(...A.path.map(q => q[1]), ...Bp.path.map(q => q[1])) * B + 120; for (let y = 45; y <= top; y += 90) objs.push(portal(MODE_ID[Bp.mode], bx - 10, y)); }
  objs.push(...objectsOf(Bp, bx));
  const header = official(+A.level.split(" ")[0]).header;
  return { level: { header, objects: objs }, bx, end: bx + Bp.w * B };
}
// the pieces' own route height at x (units, joined coordinates)
function ownY(A, Bp, bx, x, lead0) {
  const lead = lead0 != null ? lead0 : (8 + PRE) * B, pick = x < bx ? [A, lead] : [Bp, bx], P = pick[0].path, rx = (x - pick[1]) / B;
  for (let i = 1; i < P.length; i++) if (P[i][0] >= rx) return P[i][1] * B;
  return P[P.length - 1][1] * B;
}
function check(A, Bp) {
  const J = join(A, Bp), w = GD.makeWorld(J.level.objects, J.level.header);
  const t0 = Date.now();
  let r = null; try { r = GD.solveAny(w, { maxStates: 1500000 }); } catch (e) { r = { ok: false, why: e.message }; }
  const res = { a: A.id, b: Bp.id, modes: A.mode + ">" + Bp.mode, modeChange: A.mode !== Bp.mode, sigs: [A.sig, Bp.sig], int: [A.int, Bp.int], dy: r1((Bp.path[0][1] - A.path[A.path.length - 1][1])), ms: Date.now() - t0 };
  if (!r || !r.ok) { const run = r && r.events ? GD.run(w, r.events) : null; const last = run && run.path[run.path.length - 1]; res.ok = false; const dx = r && r.dieAt ? r.dieAt.x : last ? last.x : null; res.dieAt = dx == null ? null : r1((dx - J.bx) / B); res.why = (r && (r.why || "no clear")) || "no clear"; return res; }
  const run = GD.run(w, r.events), lead = (8 + PRE) * B;
  // secret way: the route away from the pieces' own routes
  let off = 0, offMax = 0, from = null;
  for (const s of run.path) { if (s.x < lead || s.x > J.end) continue; const d = Math.abs(s.y - ownY(A, Bp, J.bx, s.x)); if (d > 2.5 * B) { if (from == null) from = s.x; offMax = Math.max(offMax, s.x - from); } else from = null; off = Math.max(off, d); }
  const offBlocks = r1(offMax / B);   // how far (blocks) the route ran away from the pieces' own routes
  // open space at the seam: no floor and no roof within 6 blocks of the route, 3 columns each side
  let open = 0;
  for (let c = -3; c < 3; c++) {
    const x = J.bx + c * B + 15, s = run.path.find(q => q.x >= x); if (!s) continue;
    const near = w.items.filter(it => (it.kind === "solid" || it.kind === "slope" || it.kind === "hazard") && it.x0 <= x && it.x1 >= x);
    const floor = near.some(it => it.y1 <= s.y && s.y - it.y1 <= 6 * B) || s.y <= 6 * B, roof = near.some(it => it.y0 >= s.y && it.y0 - s.y <= 6 * B);
    if (!floor && !roof) open++;
  }
  Object.assign(res, { ok: true, presses: r.events.filter(e => e.type === "press").length, ownPresses: (A.clicks || []).filter(c => c[2]).length + (Bp.clicks || []).filter(c => c[2]).length,
    secret: offMax > 0 && offBlocks >= 1, offBlocks, maxOff: r1(off / B), openSeam: open });
  return { res, J, events: r.events };
}

// the filler (LEGO.md "Joining and connecting"): solve the join from A's real entry state; where the route runs away from
// the bricks' own routes (a secret way), put spikes on the way it took (one per block, only where it was more than 2.5
// blocks off), and solve again -- up to 6 rounds. Hazards only: blocks would give the cube new floors to use.
function spike(x, y) { return { id: 8, x, y, rot: 0, flipX: false, flipY: false, props: { 1: "8", 2: String(x), 3: String(y) } }; }
function checkFilled(A, Bp, rounds = 6) {
  const fill = [], t0 = Date.now(); let res = null, J = null, ev = null;
  for (let k = 0; k <= rounds; k++) {
    J = joinDirect(A, Bp, fill); if (!J) return { res: { a: A.id, b: Bp.id, ok: false, why: "no entry state", modes: A.mode + ">" + Bp.mode } };
    const w = GD.makeWorld(J.level.objects, J.level.header);
    let r = null; try { r = GD.solveSweep(w, { start: J.start, held: J.held, cap: 6000 }); } catch (e) { r = { ok: false, why: e.message + " @ " + String(e.stack).split("\n")[1].trim() }; }
    res = { a: A.id, b: Bp.id, modes: A.mode + ">" + Bp.mode, modeChange: A.mode !== Bp.mode, rounds: k, spikes: fill.length };
    if (!r || !r.ok) { res.ok = false; res.why = (r && r.why) || "no clear"; const dx = r && r.dieAt ? r.dieAt.x : null; res.dieAt = dx == null ? null : r1((dx - J.bx) / B); break; }
    ev = r.events;
    const run = GD.run(w, r.events);
    const off = [];
    for (const s of run.path) { if (s.x < J.lead || s.x > J.end) continue; if (Math.abs(s.y - ownY(A, Bp, J.bx, s.x, J.lead)) > 2.5 * B) off.push(s); }
    // a secret way = a block or more of route off the bricks' own routes
    const span = off.length ? off[off.length - 1].x - off[0].x : 0;
    res.ok = true; res.secret = span >= B; res.presses = r.events.filter(e => e.type === "press").length;
    if (!res.secret || k === rounds) break;
    let lastX = -1e9; for (const s of off) if (s.x - lastX >= B) { fill.push(spike(Math.round(s.x / 15) * 15, Math.round(s.y / 15) * 15)); lastX = s.x; }
  }
  res.ms = Date.now() - t0;
  return { res, J, events: ev };
}
function pool(grain) {
  const all = JSON.parse(fs.readFileSync(path.join(LOCAL, "lego", "pieces.json"), "utf8"));
  return all.filter(p => (p.grain || "piece") === (grain || "piece") && p.src === "official" && p.verified && !p.empty && !p.dupOf && p.smooth !== false && !p.flips && MODE_ID[p.mode] && p.path && p.path.length > 2)
    .map(p => Object.assign(p, { int: Math.round((p.presses / Math.max(0.3, p.s) + (p.hzPer100 || 0) / 100) * 100) / 100 }));
}
// the seam contract (BUILDING.md): B may follow A when A's exit state fits B's entry -- same gravity; in the same mode,
// both on the ground at about the same height (within 1 block) or both in the air within 1.5 blocks; a mode change
// needs only the same gravity (the portal resets the rest). --any: pair without it (the first runs, to see why joins break)
let CONTRACT = true, FILL = false;
function fits(A, Bp) {
  const a = A.exit, b = Bp.entry; if (!a || !b) return true;
  if (a.grav !== b.grav) return false;
  if (A.mode !== Bp.mode) return true;
  if (a.ground !== b.ground) return false;
  return Math.abs(a.y - b.y) <= (a.ground ? 1 : 1.5);
}
function pairs(P, n, seed) {
  const R = rng(seed), out = [];
  for (let k = 0; out.length < n && k < n * 200; k++) {
    const A = P[Math.floor(R() * P.length)], Bp = P[Math.floor(R() * P.length)];
    if (A === Bp || A.sig === Bp.sig || A.level === Bp.level && Math.abs(A.x - Bp.x) < 40) continue;
    const ratio = Bp.int / Math.max(0.05, A.int); if (ratio < 0.8 || ratio > 1.25) continue;
    if (CONTRACT && !fits(A, Bp)) continue;
    out.push([A, Bp]);
  }
  return out;
}

if (require.main === module) {
  const A = process.argv.slice(2), opt = (k, d) => { const i = A.indexOf("--" + k); return i >= 0 ? A[i + 1] : d; };
  if (A.includes("--any")) CONTRACT = false;
  FILL = A.includes("--fill");
  const P = pool(opt("grain", "piece")), byId = Object.fromEntries(P.map(p => [p.id, p]));
  const list = A.includes("--pair") ? [[byId[A[A.indexOf("--pair") + 1]], byId[A[A.indexOf("--pair") + 2]]]] : pairs(P, +opt("n", 30), +opt("seed", 1));
  const dir = path.join(LOCAL, "lego", "joins"); fs.mkdirSync(dir, { recursive: true });
  const rows = [];
  for (const [a, b] of list) {
    if (!a || !b) { console.log("no such piece"); continue; }
    const out = FILL ? checkFilled(a, b) : check(a, b), res = out.res || out;
    rows.push(res);
    console.log(`${res.ok ? (res.secret ? "SECRET" : "ok    ") : "BROKEN"} ${res.modes.padEnd(13)} ${(a.id + " + " + b.id).padEnd(52)} ${res.ok ? (FILL ? `presses ${res.presses}, ${res.spikes} filler spikes in ${res.rounds} rounds` : `presses ${res.presses} (own ${res.ownPresses}), off ${res.maxOff} bl, open seam cols ${res.openSeam}`) : `dies ${res.dieAt} bl from seam: ${res.why}`}  ${res.ms} ms`);
    if (out.J) { const rec = GD.newRecord(`lego join ${a.id}+${b.id}`, "two main-level pieces joined (tools/lego_join.js), local only"); writeGdlvl(path.join(dir, `${a.id}+${b.id}.gdlvl`), rec, out.J.level); }
  }
  const sh = f => rows.length ? Math.round(rows.filter(f).length / rows.length * 100) : 0;
  const sum = { made: new Date().toISOString().slice(0, 10), physics: require("./solutions.js").physicsCommit(), n: rows.length,
    clear: sh(r => r.ok), secret: sh(r => r.ok && r.secret), broken: sh(r => !r.ok), openSeam: sh(r => r.ok && r.openSeam > 0),
    modeChange: { n: rows.filter(r => r.modeChange).length, clear: Math.round(rows.filter(r => r.modeChange && r.ok).length / Math.max(1, rows.filter(r => r.modeChange).length) * 100) },
    sameMode: { n: rows.filter(r => !r.modeChange).length, clear: Math.round(rows.filter(r => !r.modeChange && r.ok).length / Math.max(1, rows.filter(r => !r.modeChange).length) * 100) },
    causes: rows.reduce((m, r) => { const k = !r.ok ? "broken: " + String(r.why).split(/[:(]/)[0].trim() : r.secret ? "secret way" : "clear"; m[k] = (m[k] || 0) + 1; return m; }, {}),
    rows: rows.map(r => ({ modes: r.modes, ok: r.ok, secret: !!r.secret, dy: r.dy, open: r.openSeam || 0, dieAt: r.dieAt, why: r.why })) };
  sum.contract = CONTRACT; sum.grain = opt("grain", "piece");
  sum.fill = FILL; if (FILL) sum.spikes = rows.reduce((s, r) => s + (r.spikes || 0), 0);
  if (!A.includes("--pair")) fs.writeFileSync(path.join(ROOT, "knowledge", "lego_joins" + (CONTRACT ? "" : "_any") + (FILL ? "_filled" : "") + ".json"), JSON.stringify(sum, null, 1));
  console.log(JSON.stringify(sum.causes));
  console.log(`\n${rows.length} joins: ${sum.clear}% clear (${sum.secret}% by a secret way), ${sum.broken}% broken, ${sum.openSeam}% with open space at the seam; same mode ${sum.sameMode.clear}% of ${sum.sameMode.n}, mode change ${sum.modeChange.clear}% of ${sum.modeChange.n}`);
}
module.exports = { join, joinDirect, check, checkFilled, entryState, pool, pairs, fits, objectsOf, portal, spike, official, MODE_ID, SPEED_ID };
