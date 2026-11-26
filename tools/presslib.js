// node tools/presslib.js test [--set gdlm|official|gdsolver|all] [--rollout] [--levels a,b] [--theta 0.3]
//   -- leave-one-out: learn from every level of the set but one, predict that one's presses, for each level in turn
// node tools/presslib.js learn [--set ...]          -- build the library from every clear of the set -> local/presslib/lib.json
// node tools/presslib.js solve <level.gdlvl | official:N> [--theta 0.3]  -- the library's first guess, driven through
//   the level, repaired locally where it dies (intent.js's verify loop), vs a full sweep solve: presses, repairs, time
// node tools/presslib.js hints <level.gdlvl | official:N>  -- what the creator put in the level about the route
//   (start positions, jump marks, coins, orbs/pads/portals), and whether a saved route agrees with each start position
//
// THE PRESS LIBRARY (the user, 2026-11-24: "how can we gain the knowledge of the one doing the layout ... that knows
// how to play and what is expected of structures"). Every press and release of a route that CLEARS a level (gdsolver's
// real-game plans, our solved routes, the user's logged runs) becomes an example: what the player sees around it (a
// grid of the objects ahead, relative to the player, x scaled to 1x speed, y turned with gravity) and the player's
// state (mode, gravity, mini, button down, on the ground). Looked up by that picture at four levels of detail (fine grid,
// coarse grid, near grid, state only: the finest one seen often enough wins), the library gives, at any frame, the share
// of good players who pressed (or let go) right there. Used as the solver's first guess: the level is played by the
// library, and only where that dies does a local search run (from a calm point ~1 s before, to ~6 blocks past).
// The physics is never loosened: every route is a plain replay of the sim, checked for skips like any other.
// PHYSICS.md "The press library". Data from RobTop's levels stays in local/ (the library is built from them, never
// committed). Light: tables and replays; `solve` runs local searches (claims the heavy slot).
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const { GD, unpack, readGdlvl } = require("./io.js");
const OUT = path.join(ROOT, "local", "presslib");

// ---- the picture around the player ----
const CELL = 15, C0 = -15, NC = 16, R0 = -60, NR = 12;        // fine grid: x -15..225, y -60..120 (in 1x units)
const PRI = { ".": 0, B: 1, T: 2, P: 3, R: 4, M: 5, H: 6 };   // a cell shows its most telling object
const CODE = { solid: "B", slope: "B", hazard: "H", orb: "R", pad: "P", mode: "T", gravity: "T", speed: "T", size: "T", teleport: "T", dual: "T", mark: "M" };
const MODES = { cube: "c", ship: "s", ball: "b", ufo: "u", wave: "w", robot: "r", spider: "d", swing: "g" };

// creator hints that live in deco: jump marks (our group 990; GD's arrow ids would go here once known) as kind "mark"
function markItems(w) {
  if (w._marks) return w._marks;
  const out = [];
  for (const o of w.objects) if (o.props && String(o.props[57] || "").split(".").includes("990")) out.push({ kind: "mark", x0: o.x - 8, x1: o.x + 8, y0: o.y - 8, y1: o.y + 8 });
  const cols = new Map();
  for (const b of out) for (let c = Math.floor(b.x0 / 30); c <= Math.floor(b.x1 / 30); c++) { if (!cols.has(c)) cols.set(c, []); cols.get(c).push(b); }
  return (w._marks = cols);
}

function grid(w, s) {
  const norm = GD.SPEEDS[1].x / GD.SPEEDS[s.sp != null ? s.sp : 1].x, g = s.grav < 0 ? -1 : 1;
  const cells = new Array(NC * NR).fill(".");
  const xa = s.x + C0 / norm, xb = s.x + (C0 + NC * CELL) / norm;
  const seen = new Set(), marks = markItems(w);
  const put = b => {
    if (seen.has(b)) return; seen.add(b);
    const k = CODE[b.kind]; if (!k) return;
    let y0 = (b.y0 - s.y) * g, y1 = (b.y1 - s.y) * g; if (y0 > y1) [y0, y1] = [y1, y0];
    const x0 = (b.x0 - s.x) * norm, x1 = (b.x1 - s.x) * norm;
    const c0 = Math.max(0, Math.floor((x0 - C0) / CELL)), c1 = Math.min(NC - 1, Math.floor((x1 - C0 - 0.01) / CELL));
    const r0 = Math.max(0, Math.floor((y0 - R0) / CELL)), r1 = Math.min(NR - 1, Math.floor((y1 - R0 - 0.01) / CELL));
    for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) { const i = r * NC + c; if (PRI[k] > PRI[cells[i]]) cells[i] = k; }
  };
  for (let c = Math.floor(xa / 30); c <= Math.floor(xb / 30); c++) {
    const l = w.cols.get(c); if (l) for (const b of l) put(b);
    const m = marks.get(c); if (m) for (const b of m) put(b);
  }
  for (const b of w.dyn || []) if (b.x1 >= xa && b.x0 <= xb) put(b);   // moving objects where they start (approximate)
  // the floor and the roof of a flying band count as blocks
  if (isFinite(s.floorY) || isFinite(s.ceilY)) for (const yy of [s.floorY, s.ceilY]) if (isFinite(yy)) {
    const ry = (yy - s.y) * g, r = Math.floor((ry - R0) / CELL);
    if (r >= 0 && r < NR) for (let c = 0; c < NC; c++) if (cells[r * NC + c] === ".") cells[r * NC + c] = "B";
  }
  return cells;
}
// a coarser picture: cells merged f x f, cols/rows cut to [c0, c1) x [r0, r1) of the coarse grid
function coarse(cells, f, nc, nr) {
  const out = [];
  for (let r = 0; r < nr; r++) for (let c = 0; c < nc; c++) {
    let best = ".";
    for (let dr = 0; dr < f; dr++) for (let dc = 0; dc < f; dc++) { const v = cells[(r * f + dr) * NC + c * f + dc]; if (v && PRI[v] > PRI[best]) best = v; }
    out.push(best);
  }
  return out.join("");
}
// the four keys, finest first
function keys(w, s, held) {
  const cells = grid(w, s), m = MODES[s.mode] || "?", h = held ? 1 : 0, gr = s.grounded ? 1 : 0, mi = s.mini ? 1 : 0;
  const vq = Math.max(-3, Math.min(3, Math.round((s.vy || 0) * (s.grav < 0 ? -1 : 1) / 4)));
  // near grid: the first 5 coarse columns (x -15..135) and the rows y -30..90 (coarse rows 1..4)
  const c30 = coarse(cells, 2, 8, 6), near = [];
  for (let r = 1; r < 5; r++) near.push(c30.slice(r * 8, r * 8 + 5));
  return [`${m}${h}${gr}${mi}${vq}|${cells.join("")}`, `${m}${h}${gr}${mi}|${c30}`, `${m}${h}${gr}|${near.join("")}`, `${m}${h}${gr}`];
}

// ---- learning ----
const MIN = [3, 4, 6, 1];   // examples needed at each level before it is trusted
function emptyLib() { return { levels: 0, frames: 0, t: [new Map(), new Map(), new Map(), new Map()] }; }
// one clearing route -> frames (decision points every 4 ticks: the user's 60 fps, "Click Between Steps" off)
// a run that dies (a user's attempt, a plan our sim does not finish) still teaches up to a second before its end
function framesOf(w, events, partial) {
  const r = GD.run(w, events), p = r.path, out = [];
  const done = !!(r.done || p[p.length - 1].done), stop = done ? p.length : partial ? p.length - GD.PHYS.TPS : 0;
  const ev = events.slice().sort((a, b) => a.tick - b.tick);
  let held = false, k = 0;
  for (let t = 0; t + 4 < stop; t += 4) {
    let act = 0; const before = held;
    while (k < ev.length && ev[k].tick < t + 4) { const pr = ev[k].type === "press"; if (pr !== held) { if (pr !== before) act = 1; held = pr; } k++; }
    out.push({ t, s: p[t], held: before, act });
  }
  return { frames: out, done, endX: p[p.length - 1].x };
}
function add(lib, w, frames, weight = 1) {
  for (const f of frames) {
    const ks = keys(w, f.s, f.held);
    ks.forEach((key, i) => { const m = lib.t[i], v = m.get(key) || [0, 0]; v[0] += weight; v[1] += f.act * weight; m.set(key, v); });
    lib.frames++;
  }
  lib.levels++;
}
// the share of players who acted (pressed if up, let go if down) in this picture; and which level answered
// Smoothed from the coarsest level to the finest (each level's count pulls toward its parent's share with weight ALPHA):
// a picture seen once says little, a picture seen 50 times says nearly all. level: the finest level seen MIN times.
const ALPHA = 3;
function share(lib, w, s, held) {
  const ks = keys(w, s, held);
  let p = 0, level = 4, n = 0;
  for (let i = ks.length - 1; i >= 0; i--) {
    const v = lib.t[i].get(ks[i]); if (!v) continue;
    p = (v[1] + ALPHA * p) / (v[0] + ALPHA);
    if (v[0] >= MIN[i]) { level = i; n = v[0]; }
  }
  return { p, level, n };
}
const FLY = { ship: 1, wave: 1 };   // held modes: the button's level steers; every other mode is played by taps
const saveLib = (lib, file) => { fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ levels: lib.levels, frames: lib.frames, t: lib.t.map(m => [...m]) })); };
const loadLib = file => { const j = JSON.parse(fs.readFileSync(file, "utf8")); return { levels: j.levels, frames: j.frames, t: j.t.map(a => new Map(a)) }; };

// ---- the clears we learn from ----
// gdlm: the repo's levels with a saved route that clears (local/solutions, tools/solutions.js)
// official: RobTop's 22 with our saved human route (local/official_NN.json) -- on the PC only
// gdsolver: RobTop's 22 with gdsolver's real-game plans where they clear in our sim -- on the PC only
const OFFICIAL_SRC = require("./gdpaths.js").LEVELS;
const officialText = n => unpack(fs.readFileSync(path.join(OFFICIAL_SRC, n + ".txt"), "utf8"));
function loadLevel(spec) {
  const m = /^official:(\d+)$/.exec(spec);
  const levelStr = m ? officialText(+m[1]) : readGdlvl(spec).levelStr;
  const L = GD.parseLevel(levelStr);
  return { name: spec, levelStr, objects: L.objects, w: GD.makeWorld(L.objects, L.header) };
}
function clears(set) {
  const out = [];
  if (set === "gdlm" || set === "all") {
    const S = require("./solutions.js");
    for (const dir of ["levels", "examples"]) for (const f of fs.readdirSync(path.join(ROOT, dir)).filter(f => f.endsWith(".gdlvl")).sort()) {
      const file = path.join(dir, f);
      let lv; try { lv = loadLevel(path.join(ROOT, file)); } catch (e) { continue; }
      const sol = S.get(lv.levelStr, true);
      if (sol && sol.ok && sol.events && sol.events.length) out.push(Object.assign(lv, { name: file, events: sol.events, src: "gdlm" }));
    }
  }
  for (const kind of ["official", "gdsolver"]) if (set === kind || set === "all") for (let n = 1; n <= 22; n++) {
    let lv; try { lv = loadLevel("official:" + n); } catch (e) { continue; }
    let events = null;
    if (kind === "official") { try { const j = JSON.parse(fs.readFileSync(path.join(ROOT, "local", `official_${String(n).padStart(2, "0")}.json`), "utf8")); events = j.solution && j.solution.ok !== false && j.solution.events; } catch (e) {} }
    else { try { events = require("./tas.js").loadPlan(n); } catch (e) {} }
    if (events && events.length) out.push(Object.assign(lv, { name: `${kind}:${n}`, events, src: kind }));
  }
  // user: the user's own attempts (local/attempts, tools/attempts.js), on the level version they were played on;
  // a death teaches up to a second before it (partial)
  if (set === "user" || set === "all") {
    const A = path.join(ROOT, "local", "attempts"), LP = require("../lib/liveplay.js");
    let files = []; try { files = fs.readdirSync(A).filter(f => f.endsWith(".jsonl")); } catch (e) {}
    for (const f of files) {
      const base = f.replace(/\.jsonl$/, ""), m = /^official_(\d+)$/.exec(base);
      let lv = null;
      const lines = fs.readFileSync(path.join(A, f), "utf8").split(/\r?\n/).filter(Boolean).map(l => { try { return JSON.parse(l); } catch (e) { return null; } }).filter(Boolean);
      for (const ln of lines) {
        if (!ln.events || ln.events.length < 2 || ln.from) continue;   // practice attempts start mid-level
        try { if (!lv) lv = m ? loadLevel("official:" + m[1]) : loadLevel(path.isAbsolute(ln.file || "") ? ln.file : path.join(ROOT, ln.file || "")); } catch (e) { break; }
        if (ln.hash && LP.levelHash && LP.levelHash(lv.levelStr) !== ln.hash) continue;   // another version of the level
        out.push(Object.assign({}, lv, { name: `user:${base}#${ln.id}`, events: ln.events, src: "user", partial: true, group: "user:" + base }));
      }
    }
  }
  for (const c of out) if (c.src === "gdsolver") c.partial = true;   // a real-game clear our sim does not finish yet
  for (const c of out) c.group = c.group || c.name.replace(/^(official|gdsolver):/, "official:");  // held out together
  return out;
}

// ---- prediction along a known route (no rollout): does the library press where the clear pressed? ----
// The player presses at the PEAK: when the share is over theta and no higher in the next PEAK frames (what the
// player sees coming, on the path the player would take without pressing)
const PEAK = 3;
function predictAlong(lib, w, frames, theta, kind) {
  const truth = [], fired = [], lv = [0, 0, 0, 0, 0];
  const want = f => !kind || (kind === "fly") === !!FLY[f.s.mode];
  const ps = frames.map(f => f.held ? 0 : share(lib, w, f.s, false));
  frames.forEach((f, i) => {
    if (!want(f) || f.held) return;
    if (f.act) truth.push(i);
    lv[ps[i].level]++;
    if (ps[i].p >= theta && ![1, 2, 3].slice(0, PEAK).some(d => frames[i + d] && !frames[i + d].held && ps[i + d].p > ps[i].p)
        && !(fired.length && fired[fired.length - 1] >= i - 2)) fired.push(i);
  });
  const match = tol => { const used = new Set(); let hit = 0;
    for (const t of truth) { const j = fired.find(p => !used.has(p) && Math.abs(p - t) <= tol); if (j !== undefined) { used.add(j); hit++; } }
    return hit; };
  return { truth: truth.length, fired: fired.length, hit1: match(1), hit3: match(3), levels: lv };
}

// ---- driving a level by the library, repaired locally where it dies ----
// hints (tools/lego_match.js hintsFor, the reverse lego): inside a matched brick's stretch the button follows that brick's
// own clicks by x instead of the library; outside, the library as before
function hintAt(hints, xb) { for (const h of hints || []) if (xb >= h.x0 && xb < h.x1) return h; return null; }
function drive(lib, w, s0, held0, theta, untilX, hints) {
  const s = { ...s0, used: s0.used.slice() }; let held = !!held0;   // spread, never Object.assign (CLAUDE.md)
  const ev = [], max = Math.ceil((w.endX / (GD.SPEEDS[0].x * 60) + 5) * GD.PHYS.TPS);
  let last = -99;
  for (let t = s.tick || 0; t < max && !s.dead && !s.done && !(untilX && s.x >= untilX); t++) {
    let press = false;
    const xb = (GD.progressX ? GD.progressX(s) : s.x) / 30, h = hints && hintAt(hints, xb);
    if (h) {   // the brick's next click whose x the player has reached (and not passed by more than a block)
      let c = h.clicks.filter(c => c[0] <= xb && c[0] > xb - 1 && !!c[1] !== held).pop();
      // a hinted press is taken only where the run dies within ~1 s without it (the brick was matched by its layout,
      // not its route, so its extra presses are not this level's); releases are always followed
      if (c && c[1] && hints.needed) {
        const q = { ...s, used: s.used.slice() };
        for (let k = 0; k < 240 && !q.dead && !q.done; k++) GD.step(w, q, { press: false, held });
        if (!q.dead) c = null;
      }
      if (c && t - last > 2) { held = !!c[1]; press = held; last = t; ev.push({ tick: t, type: held ? "press" : "release" }); }
    } else if (t % 4 === 0 && t - last > 8) {
      const p0 = share(lib, w, s, held).p;
      let act = p0 >= theta;
      if (act) {   // a peak: the share is not higher a few frames on, the button left as it is
        const q = { ...s, used: s.used.slice() };
        for (let d = 1; d <= PEAK && act; d++) { for (let k = 0; k < 4; k++) GD.step(w, q, { press: false, held }); if (q.dead) break; if (share(lib, w, q, held).p > p0) act = false; }
      }
      if (act) { held = !held; press = held; last = t; ev.push({ tick: t, type: held ? "press" : "release" }); }
    }
    GD.step(w, s, { press, held });
  }
  return ev;
}
function heldAt(ev, t) { let h = false; for (const e of ev) { if (e.tick >= t) break; h = e.type === "press"; } return h; }
function solveWithLib(lib, w, theta, opts = {}) {
  const I = require("../lib/incsolve.js").incsolve, t0 = Date.now(), log = [];
  let events = drive(lib, w, GD.startState(w), false, theta, null, opts.hints), repairs = 0, searched = 0;
  const FLYR = { ship: 1, wave: 1, ufo: 1, swing: 1 };
  for (;;) {
    const res = GD.run(w, events), p = res.path, end = p[p.length - 1];
    const skip = !res.dead && end.done ? GD.skipCheck(w, p, events) : null;
    if (end.done && !skip) return { ok: true, events, repairs, ms: Date.now() - t0, searchMs: searched, log };
    if (repairs >= (opts.maxRepairs || 200)) return { ok: false, events, repairs, ms: Date.now() - t0, searchMs: searched, log, dieX: end.x };
    repairs++;
    const td = skip ? Math.max(0, p.findIndex(q => q.x >= skip.dieAt.x)) : p.length - 1, xd = p[td].x;
    let back = 0, fixed = false;
    for (const secs of [1, 2.5, 6]) {
      let c = Math.max(0, td - Math.round(secs * GD.PHYS.TPS));
      while (c > 0 && !I.calm(w, p[c])) c--;
      if (back && c >= back) continue; back = c;   // only a calm point further back than the last try (was "c <= back": it skipped every try after the first)
      // a death inside a flying stretch is searched once to the stretch's end (back in a tap mode), not repaired
      // bit by bit: each repair of a ship part costs a sweep from a calm point before the portal (GDLM 45: 21 repairs,
      // 132 s vs a full sweep's 59 s)
      let goalX = xd + 180;
      if (FLYR[p[td].mode] || FLYR[p[Math.max(0, td - 60)].mode]) {
        const out = w.items.filter(b => b.kind === "mode" && b.x0 > xd && !FLYR[b.d.mode]).sort((x, y) => x.x0 - y.x0)[0];
        goalX = Math.max(goalX, out ? out.x1 + 60 : w.endX);
      }
      const h = heldAt(events, c), ts = Date.now();
      const sv = GD.solveSweep(w, { start: p[c], held: h, cap: opts.cap || 6000,
        goal: st => st.x >= goalX && (!!st.grounded || !!FLYR[st.mode]) });
      searched += Date.now() - ts;
      if (!sv || !sv.ok) continue;
      const T = sv.goalTick != null ? sv.goalTick : (sv.events.length ? sv.events[sv.events.length - 1].tick + 1 : c);
      const prefix = events.filter(e => e.tick < c).concat(sv.events.filter(e => e.tick >= c && e.tick < T));
      const pp = GD.run(w, prefix).path, st = pp[Math.min(T, pp.length - 1)];
      if (st.dead) continue;
      events = prefix.concat(drive(lib, w, st, heldAt(prefix, T + 1), theta, null, opts.hints));
      log.push(`block ${(xd / 30).toFixed(1)}: repaired from ${(p[c].x / 30).toFixed(1)} (${secs} s back)`);
      fixed = true; break;
    }
    if (!fixed) { log.push(`block ${(xd / 30).toFixed(1)}: no local repair`); return { ok: false, events, repairs, ms: Date.now() - t0, searchMs: searched, log, dieX: xd }; }
  }
}

// ---- creator hints ----
const SP_MODE = ["cube", "ship", "ball", "ufo", "wave", "robot", "spider", "swing"];
function hints(lv) {
  const sp = lv.objects.filter(o => o.id === 31).map(o => ({ x: o.x, y: o.y, mode: SP_MODE[+(o.props.kA2 || 0)] || "?",
    speed: +(o.props.kA4 || 0), mini: o.props.kA3 === "1", flipped: o.props.kA11 === "1", dual: o.props.kA8 === "1" }))
    .sort((a, b) => a.x - b.x);
  const marks = lv.objects.filter(o => o.props && String(o.props[57] || "").split(".").includes("990")).map(o => o.x).sort((a, b) => a - b);
  const coins = lv.objects.filter(o => o.id === 1329 || o.id === 142).map(o => ({ x: o.x, y: o.y }));
  const count = k => lv.w.items.filter(b => b.kind === k).length;
  return { startPositions: sp, marks, coins, orbs: count("orb"), pads: count("pad"), portals: ["mode", "gravity", "speed", "size", "teleport", "dual"].reduce((a, k) => a + count(k), 0) };
}
// a route against the start positions: at each start position's x, is the player in the state the creator set there?
function agreeStartPos(lv, events, h) {
  const p = GD.run(lv.w, events).path, out = [];
  for (const sp of h.startPositions) {
    const s = p.find(q => q.x >= sp.x); if (!s) continue;
    const sIdx = [1, 0, 2, 3, 4][sp.speed] ?? 1;   // kA4 -> SPEEDS index, as the header
    const bad = [];
    if (s.mode !== sp.mode) bad.push(`mode ${s.mode} (start pos: ${sp.mode})`);
    if ((s.grav < 0) !== sp.flipped) bad.push(`gravity ${s.grav < 0 ? "flipped" : "normal"}`);
    if (!!s.mini !== sp.mini) bad.push(`size ${s.mini ? "mini" : "normal"}`);
    if (s.sp !== sIdx) bad.push(`speed ${GD.SPEEDS[s.sp].name} (start pos: ${GD.SPEEDS[sIdx].name})`);
    out.push({ x: sp.x, ok: !bad.length, bad, dy: Math.round(s.y - sp.y) });
  }
  return out;
}

module.exports = { keys, grid, framesOf, add, share, emptyLib, clears, predictAlong, solveWithLib, hints, agreeStartPos, loadLib, saveLib };

if (require.main === module) {
  const a = process.argv.slice(2), cmd = a[0], opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
  const set = opt("--set", "gdlm"), theta = +opt("--theta", 0.3);
  if (cmd === "learn") {
    const lib = emptyLib(), cl = clears(set);
    for (const c of cl) { const f = framesOf(c.w, c.events, c.partial); if (f.done || c.partial) add(lib, c.w, f.frames); }
    const file = path.join(OUT, `lib_${set}.json`); saveLib(lib, file);
    console.log(`${lib.levels} clears, ${lib.frames} frames -> ${path.relative(ROOT, file)}`);
  } else if (cmd === "test") {
    if (a.includes("--rollout")) require("./heavy.js").claim();   // local searches and full sweeps: heavy
    let cl = clears(set); const only = opt("--levels");
    const F = cl.map(c => { const f = framesOf(c.w, c.events, c.partial); return f.done || (c.partial && f.frames.length) ? f.frames : null; });
    const keep = cl.map((c, i) => F[i] ? i : -1).filter(i => i >= 0);
    console.log(`${keep.length} clears of ${cl.length} in set ${set}; theta ${theta}`);
    const tot = { truth: 0, fired: 0, hit1: 0, hit3: 0, base1: 0, base3: 0, baseFired: 0 };
    for (const i of keep) {
      if (only && !only.split(",").some(s => cl[i].name.includes(s))) continue;
      const lib = emptyLib(), base = emptyLib();
      // leave out the whole level (every clear of it: our route, gdsolver's plan, the user's attempts), not just this one
      for (const j of keep) if (cl[j].group !== cl[i].group) add(lib, cl[j].w, F[j]);
      // the baseline: the state-only level of the same library (mode, button, ground): what "no picture" gets
      for (const [k, v] of lib.t[3]) base.t[3].set(k, v);
      const r = predictAlong(lib, cl[i].w, F[i], theta), b = predictAlong(base, cl[i].w, F[i], theta);
      for (const kd of ["tap", "fly"]) { const q = predictAlong(lib, cl[i].w, F[i], theta, kd), T = tot[kd] || (tot[kd] = { truth: 0, fired: 0, hit3: 0 }); T.truth += q.truth; T.fired += q.fired; T.hit3 += q.hit3; }
      tot.truth += r.truth; tot.fired += r.fired; tot.hit1 += r.hit1; tot.hit3 += r.hit3; tot.base1 += b.hit1; tot.base3 += b.hit3; tot.baseFired += b.fired;
      let line = `${cl[i].name}: presses ${r.truth}, library pressed ${r.fired}, on time ${r.hit1} (+-1 frame) / ${r.hit3} (+-3); answered by fine/coarse/near/state/none ${r.levels.join("/")}`;
      if (a.includes("--rollout")) {
        const lr = solveWithLib(lib, cl[i].w, theta), ts = Date.now();
        const full = GD.solveSweep(cl[i].w), fullMs = Date.now() - ts;
        line += `\n    rollout: ${lr.ok ? "CLEARS" : "stuck at block " + (lr.dieX / 30).toFixed(1)} with ${lr.repairs} repairs in ${(lr.ms / 1000).toFixed(1)} s (search ${(lr.searchMs / 1000).toFixed(1)} s); full sweep ${full.ok ? "clears" : "fails"} in ${(fullMs / 1000).toFixed(1)} s`;
      }
      console.log(line);
    }
    const pc = (x, y) => y ? (100 * x / y).toFixed(0) + "%" : "-";
    for (const kd of ["tap", "fly"]) if (tot[kd]) console.log(`${kd === "tap" ? "taps (cube, ball, ufo, robot, spider, swing)" : "flying (ship, wave)"}: ${tot[kd].truth} presses, recall ${pc(tot[kd].hit3, tot[kd].truth)}, precision ${pc(tot[kd].hit3, tot[kd].fired)} (+-3 frames)`);
    console.log(`ALL: recall ${pc(tot.hit1, tot.truth)} (+-1 frame) / ${pc(tot.hit3, tot.truth)} (+-3), precision ${pc(tot.hit3, tot.fired)} (+-3); state-only baseline: recall ${pc(tot.base3, tot.truth)}, precision ${pc(tot.base3, tot.baseFired)}`);
  } else if (cmd === "solve") {
    const lv = loadLevel(a[1]), lib = loadLib(opt("--lib", path.join(OUT, `lib_${set}.json`)));
    require("./heavy.js").claim();
    const r = solveWithLib(lib, lv.w, theta), ts = Date.now(), full = a.includes("--vs-full") ? GD.solveSweep(lv.w) : null;
    console.log(`${a[1]}: ${r.ok ? "CLEARS" : "stuck at block " + (r.dieX / 30).toFixed(1)}, ${r.events.filter(e => e.type === "press").length} presses, ${r.repairs} repairs, ${(r.ms / 1000).toFixed(1)} s` +
      (full ? `; full sweep ${full.ok ? "clears" : "fails"} in ${((Date.now() - ts) / 1000).toFixed(1)} s` : "") + (r.log.length ? "\n  " + r.log.join("\n  ") : ""));
  } else if (cmd === "hints") {
    const lv = loadLevel(a[1]), h = hints(lv);
    console.log(`${a[1]}: ${h.startPositions.length} start positions, ${h.marks.length} jump-mark pieces, ${h.coins.length} coins, ${h.orbs} orbs, ${h.pads} pads, ${h.portals} portals`);
    const S = /^official:/.test(a[1]) ? null : require("./solutions.js"), sol = S && S.get(lv.levelStr, true);
    if (sol && sol.events) for (const r of agreeStartPos(lv, sol.events, h)) console.log(`  start pos at block ${(r.x / 30).toFixed(1)}: ${r.ok ? "the route agrees" : "route differs: " + r.bad.join(", ")} (height ${r.dy >= 0 ? "+" : ""}${r.dy})`);
  } else console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("// node")).join("\n"));
}
