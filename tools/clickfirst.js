// node tools/clickfirst.js gen [--clicks 6] [--bpm 140] [--n 150] [--keep 5] [--seed 1]  |  pattern [--pieces local/lego/pieces.json]  |  lab
//   -- a ball section built CLICKS FIRST (Evgeni 2026-11-27: "we will define the clicks, and build a pattern 'randomly', and
//      close the remaining. once we have a 'patch' chosen, we will build the hazards around it, to match the wanted timing").
//      1. the plan: N clicks on an irregular rhythm, each with its kind (a flip off a surface, a yellow orb, a blue orb) and
//         the window wanted (tight / normal / loose), and free moves between some of them (a drop off a ledge, a pad, a blue
//         pad) -- no click.
//      2. the patch: the sim walks the plan; each surface goes where the ball lands, at a height drawn for that move, and only
//         heights that bring the ball where the next click needs it (on a surface for a flip, in the air for an orb) are kept.
//         The ledge a flip leaves ends a little after the press, and the surface it flies to starts a little before its
//         landing, by the window wanted (the late and early edges of the timing).
//      3. close the rest: each click is replayed missed, early, late, and with a stray tap between clicks. A spike goes where
//         that wrong route lands, until it dies; spikes never touch the planned route. So every hazard is a threat to a
//         mistake, not filler.
//      4. the pattern: extract() turns any ball path (ours, or an official section's from tools/lego.js pieces) into a
//         recipe -- one token per event: kind, gap since the last one, height change, air time -- and scores its variance
//         (inside the section: kinds, irregular gaps and sweeps; between sections: distance of the recipes). The kept
//         candidates are the ones farthest apart.
//   -> knowledge/clickfirst.json; lab -> specs/lab_clickfirst_ball.json -> levels/gdlm_lab_clickfirst_ball.gdlvl. BRICKGEN.md "Round 3".
"use strict";
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
const fs = require("fs"), path = require("path");
const G = require("./brickgen.js"), G2 = require("./brickgen2.js");
const ROOT = path.join(__dirname, "..");
let OUT = path.join(ROOT, "knowledge", "clickfirst.json");   // --set <name>: knowledge/clickfirst_<name>.json, its lab gdlm_lab_clickfirst_<name>
const B = 30, TPS = 240, V = 311.58, WMAX = 90;
const T = s => Math.round(s * TPS);
function rng(seed) { let s = (seed >>> 0) || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const pick = (r, a) => a[Math.floor(r() * a.length)];
const rint = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
const shuffle = (r, a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

let GDc = null;
const GDlib = () => GDc || (GDc = (() => { const { GD } = require("./io.js"); Object.assign(GD, require("../lib/difficulty.js")); const WI = require("../lib/windows.js"); GD.inputWindows = GD.inputWindows || WI.inputWindows; return GD; })());

// the window wanted -> how far the ledge runs past the press (late edge) and how early the target surface starts (early edge)
// (ms: the strict window -- the click moved alone, the others kept -- that counts as hitting the wish)
const WIN = { tight: { late: 0.2, early: -0.4, ms: [50, 130] }, normal: { late: 1.0, early: 1, ms: [120, 210] }, loose: { late: 2.2, early: 3, ms: [190, 999] } };

// ---------------------------------------------------------------- 1. the plan
// beat (seconds a beat, optional): the clicks fall on the song's beats (gaps of 1/2 to 3 beats); without it, a free rhythm
function plan(r, n, beat) {
  const clicks = []; let t = beat ? beat * rint(r, 1, 2) : 0.25 + 0.05 * rint(r, 0, 4);
  const GAPS = beat ? [0.5, 1, 1, 1, 1.5, 2, 2, 3].map(m => m * beat) : [0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.6, 0.7, 0.8, 0.95];
  for (let k = 0; k < n; k++) {
    const gap = k ? pick(r, GAPS.filter(g => g >= 0.25)) : 0; t += gap;
    clicks.push({ t: +t.toFixed(3), kind: pick(r, ["flip", "flip", "flip", "orb", "blueorb"]), win: pick(r, ["tight", "normal", "normal", "loose"]),
      // a free move before it, in a long gap: a drop, a pad, a blue pad, or a gravity portal (reverse gravity with no click)
      free: gap >= 0.5 && r() < 0.6 ? pick(r, ["drop", "drop", "pad", "bluepad", "gportal", "gportal"]) : null });
  }
  return clicks;
}

// ---------------------------------------------------------------- 2. the patch
function build(r, P) {
  const { e, BR } = G2.ballCtx();
  const plats = [{ side: 1, row: 0, c0: -20, c1: Infinity, ground: true }], mechs = [], ev = [], done = [];
  let cur = plats[0];
  const objs = (extra = []) => G2.renderBall(plats.concat(extra), mechs, BR, WMAX);
  const run = (extra = [], evx = ev) => G.play("ball", objs(extra), WMAX, evx);
  const at = (rr, rel) => rr.r.path[e.tick + rel];
  const colOf = (rr, q) => (q.x - rr.h.s0 * B) / B;
  const flat = s => s.row === 0 || s.row === BR;
  const rowsFor = (side, from, lo, hi) => { const out = []; for (let k = 0; k <= BR; k++) { const d = side > 0 ? from - k : k - from; if (d >= lo && d <= hi) out.push(k); } return out.filter(k => side > 0 ? k <= BR - 3 : k >= 3); };
  // the landing on `tgt` after fromRel (first it must leave the surface it is on)
  const landing = (rr, fromRel, tgt) => {
    let air = false;
    for (let t = e.tick + fromRel + 1; t < rr.r.path.length; t++) {
      const q = rr.r.path[t]; if (q.dead) return null;
      if (!q.grounded) { air = true; continue; }
      if (!air) { if (t > e.tick + fromRel + T(0.6)) return null; continue; }
      return q.grav === tgt.side && Math.abs(q.y - G2.surfY(tgt)) < 3 ? q : null;
    }
    return null;
  };
  // try the target rows in turn: the move's objects + press, a trial surface on the target; the first row whose landing
  // comes before `deadline` (rel tick; null = any) wins. win: the early edge (target starts `early` columns before the landing)
  function move(kind, fromRel, rows, side, cStart, add, press, deadline, early) {
    for (const row of rows) {
      const tgt = { side, row }, tp = { side, row, c0: cStart, c1: Infinity };
      const ev2 = press == null ? ev : ev.concat([{ tick: press, type: "press" }, { tick: press + 12, type: "release" }]);
      mechs.push(...add);
      const tr = G.play("ball", G2.renderBall(plats.concat([tp]), mechs, BR, WMAX), WMAX, ev2);
      const land = landing(tr, fromRel, tgt);
      if (land && (deadline == null || land.tick - e.tick <= deadline)) {
        tp.c0 = Math.max(cStart, Math.floor(colOf(tr, land) - (early || 0)));
        if (press != null) ev.push({ tick: press, type: "press" }, { tick: press + 12, type: "release" });
        plats.push(tp); cur = tp; done.push(kind);
        return land.tick - e.tick;
      }
      mechs.splice(mechs.length - add.length, add.length);
    }
    return null;
  }
  for (let k = 0; k < P.length; k++) {
    const c = P[k], tk = T(c.t), next = P[k + 1], w = WIN[c.win];
    // the next click's need decides this move's deadline: a flip needs the ball down 0.1 s before it
    const deadlineFor = nx => nx && nx.kind === "flip" ? T(nx.t) - T(0.1) : null;
    // a free move before this click (planned in a long gap): halfway between the last landing and the click
    if (c.free) {
      const base = run(), qNow = at(base, tk), prevT = k ? T(P[k - 1].t) : 0;
      const fRel = Math.round((prevT + tk) / 2), q = at(base, fRel);
      if (q && q.grounded && !(c.free === "drop" && flat(cur))) {
        const cm = colOf(base, q), save = cur.c1, deadline = c.kind === "flip" ? tk - T(0.1) : null;
        if (c.free === "drop") {
          cur.c1 = Math.floor(cm);
          const ok = move("drop", fRel, shuffle(r, rowsFor(cur.side, cur.row, 1, 3)), cur.side, cur.c1 + 1, [], null, deadline, 0);
          if (ok == null) cur.c1 = save;
        } else {
          const pc = Math.round(cm) + 1, side = c.free === "pad" ? cur.side : -cur.side;
          // a gravity portal flips it with no click: the yellow one (11) turns a ball on a floor upside down, the blue one (10)
          // brings a ball on a roof back; its centre at the ball's height
          const id = c.free === "pad" ? "yellow pad" : c.free === "bluepad" ? "blue pad" : cur.side > 0 ? "gravity down" : "gravity up";
          const add = c.free === "gportal" ? [[id, pc, Math.round(((q.y - 15) / B) * 10) / 10]] : [cur.side > 0 ? [id, pc, cur.row] : [id, pc, cur.row - 1, { flipY: true }]];
          cur.c1 = pc + 1;
          const rows = c.free === "pad" ? rowsFor(side, cur.row, -1, 2).filter(x => x !== cur.row) : rowsFor(side, cur.row, 3, 5);
          const ok = move(c.free, fRel, shuffle(r, rows), side, pc + (c.free === "pad" ? 4 : 2), add, null, deadline, 0);
          if (ok == null) cur.c1 = save;
        }
      }
    }
    // the click
    const base = run(), q = at(base, tk);
    if (!q || q.dead) return { why: `click ${k + 1}: the ball is dead by then` };
    const dl = deadlineFor(next);
    if (c.kind === "flip") {
      if (!q.grounded || q.grav !== cur.side) return { why: `click ${k + 1} (flip): not on a surface at its time` };
      const cm = colOf(base, q); cur.c1 = Math.min(cur.c1, Math.floor(cm + w.late));
      const rows = shuffle(r, rowsFor(-cur.side, cur.row, 3, 5));
      if (move("flip", tk, rows, -cur.side, Math.floor(cm) + 2, [], tk, dl, w.early) == null) return { why: `click ${k + 1} (flip): no landing that suits the next click` };
    } else {
      const id = c.kind === "orb" ? "yellow orb" : "blue orb";
      let oq = q, ob = base;
      if (q.grounded && !flat(cur)) {   // roll off the ledge's end 0.1-0.2 s before the orb
        const lead = T(0.1 + 0.05 * rint(r, 0, 2)), lq = at(base, tk - lead);
        cur.c1 = Math.floor(colOf(base, lq)); ob = run(); oq = at(ob, tk);
        if (!oq || oq.dead || oq.grounded) return { why: `click ${k + 1} (${c.kind}): not in the air at its time` };
      } else if (q.grounded) cur.c1 = Math.min(cur.c1, Math.ceil(colOf(base, q)) + 1);   // a rolling orb on the ground / ceiling
      const oc = Math.round(((oq.x - ob.h.s0 * B - 15) / B) * 10) / 10, orow = Math.round(((oq.y - 15) / B) * 10) / 10;
      const side = c.kind === "orb" ? oq.grav : -oq.grav;
      const rows = shuffle(r, c.kind === "orb" ? rowsFor(side, Math.round(orow + (side > 0 ? 0 : 1)), -2, 3) : rowsFor(side, Math.round(orow + (side > 0 ? 0 : 1)), 1, 5));
      if (move(c.kind, tk, rows, side, Math.ceil(oc) + 2, [[id, oc, orow]], tk, dl, w.early) == null) return { why: `click ${k + 1} (${c.kind}): no landing that suits the next click` };
    }
  }
  // the end: the last surface runs 2-4 columns past the landing
  const fin = run(), lastQ = fin.r.path.filter(q => q.grounded && !q.dead).pop();
  const W = Math.min(WMAX, Math.ceil(colOf(fin, lastQ ? fin.r.path.find(q => q.tick > e.tick + T(P[P.length - 1].t) && q.grounded) || lastQ : lastQ)) + rint(r, 2, 4));
  for (const p of plats) if (p.c1 > W - 1) p.c1 = W - 1;
  const objects = G2.renderBall(plats, mechs, BR, W - 1);
  const b = { mode: "ball", objects, width: W, events: ev, plan: P, args: { moves: done, presses: ev.length / 2 } };
  const chk = G.play("ball", objects, W, ev);
  if (chk.r.path.some(q => q.dead && q.x < (chk.h.s1 + 3) * B)) return { why: "the finished patch kills the plan" };
  return b;
}

// ---------------------------------------------------------------- 3. close the rest: spikes where the wrong routes land
function close(b) {
  const GD = GDlib(), { e, BR } = G2.ballCtx();
  const planRun = G.play("ball", b.objects, b.width, b.events), x1 = (planRun.h.s1 + 3) * B;
  const planY = new Map(planRun.r.path.map(q => [Math.round(q.x), q.y]));
  const nearPlan = (c, row) => planRun.r.path.some(q => { const qc = (q.x - planRun.h.s0 * B) / B; return Math.abs(qc - (c + 0.5)) < 1.3 && Math.abs(q.y - (row * B + 15)) < 45; });
  const presses = b.events.filter(x => x.type === "press").map(x => x.tick);
  const variants = [];
  presses.forEach((p, i) => {
    variants.push(b.events.filter(x => !(x.tick >= p && x.tick <= p + 12)));                                    // missed
    for (const d of [-T(0.14), T(0.14)]) variants.push(b.events.map(x => x.tick >= p && x.tick <= p + 12 ? { tick: x.tick + d, type: x.type } : x));   // early / late
    const nx = presses[i + 1]; if (nx && nx - p > T(0.5)) variants.push(b.events.concat([{ tick: Math.round((p + nx) / 2), type: "press" }, { tick: Math.round((p + nx) / 2) + 10, type: "release" }]).sort((a, c) => a.tick - c.tick));   // stray tap
  });
  const added = [];
  for (const v of variants) {
    for (let it = 0; it < 4; it++) {
      const rr = G.play("ball", b.objects.concat(added), b.width, v);
      if (rr.r.path.some(q => q.dead && q.x < x1)) break;   // this mistake dies already
      // the first place the wrong route rests where the plan does not: a spike there, on that surface
      const q = rr.r.path.find(q => q.grounded && q.x > rr.h.s0 * B && q.x < rr.h.s1 * B && Math.abs((planY.get(Math.round(q.x)) ?? -999) - q.y) > 20);
      if (!q) break;
      const c = Math.floor((q.x - rr.h.s0 * B) / B) + 1, sp = q.grav > 0 ? ["spike", c, Math.round((q.y - 15) / B)] : ["spike", c, Math.round((q.y + 15) / B) - 1, { rot: 180 }];
      if (sp[2] < 0 || sp[2] >= BR || c < 1 || c >= b.width - 1 || nearPlan(c, sp[2])) break;
      const test = G.play("ball", b.objects.concat(added, [sp]), b.width, b.events);
      if (test.r.path.some(q2 => q2.dead && q2.x < x1)) break;
      added.push(sp);
    }
  }
  return Object.assign({}, b, { objects: b.objects.concat(added), args: Object.assign({}, b.args, { spikes: added.length }) });
}

// ---------------------------------------------------------------- 4. the pattern: any ball path -> a recipe, and its variance
// pts: [x, y, t, mode, grav, rot, grounded] (blocks, seconds); presses: press times in the same seconds.
// One token per event: F flip off a surface (a click), O a yellow orb (a click in the air, no gravity change), B a blue orb
// (a click in the air that flips gravity), a an auto flip (blue pad / portal on a surface), g a gravity portal in the air,
// p a pad bounce (leaves against gravity, no click), d a drop (rolls off a ledge). gap: seconds since the last event; dy: the
// height change to where it next rests (blocks, + = up); air: seconds in the air after it.
function extract(pts, presses) {
  const ev = [], used = new Set();
  const take = (t0, t1) => { for (let k = 0; k < presses.length; k++) if (!used.has(k) && presses[k] > t0 - 0.03 && presses[k] <= t1 + 0.03) { used.add(k); return true; } return false; };
  const gravSoon = (i, g) => { for (let j = i; j < pts.length && pts[j][2] - pts[i][2] <= 0.08; j++) if (pts[j][4] !== g) return j; return -1; };
  let skipTo = -1;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], q = pts[i];
    if (i <= skipTo) continue;
    if (a[6] && !q[6]) {   // leaves a surface
      const j = gravSoon(i - 1, a[4]);
      ev.push({ t: a[2], kind: take(a[2], q[2]) ? "F" : j >= 0 ? "a" : (q[1] - a[1]) * a[4] > 0.02 ? "p" : "d", i });
      if (j >= 0) skipTo = j;
    } else if (!a[6] && !q[6]) {
      const clicked = take(a[2], q[2]), j = gravSoon(i - 1, a[4]);
      if (clicked) { ev.push({ t: a[2], kind: j >= 0 ? "B" : "O", i }); if (j >= 0) skipTo = j; }
      else if (a[4] !== q[4]) ev.push({ t: a[2], kind: "g", i });
    }
  }
  // per event: the rest it ends at (next grounded sample after it), the air time
  for (let k = 0; k < ev.length; k++) {
    const x = ev[k], end = k + 1 < ev.length ? ev[k + 1].i : pts.length;
    let j = x.i; while (j < end && !pts[j][6]) j++;
    const y0 = pts[Math.max(0, x.i - 1)][1], y1 = pts[Math.min(j, pts.length - 1)][1];
    x.dy = +(y1 - y0).toFixed(1); x.air = +(pts[Math.min(j, pts.length - 1)][2] - x.t).toFixed(2); x.gap = +(k ? x.t - ev[k - 1].t : x.t - pts[0][2]).toFixed(2);
  }
  return ev.map(({ kind, gap, dy, air }) => ({ kind, gap, dy, air }));
}
const recipe = toks => toks.map(t => `${t.kind}${t.gap.toFixed(2).replace(/^0/, "")}${t.dy >= 0 ? "+" : ""}${t.dy}`).join(" ");
const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
const cv = a => { if (a.length < 2) return 0; const m = mean(a); return m ? Math.sqrt(mean(a.map(v => (v - m) ** 2))) / Math.abs(m) : 0; };
// variance inside one section (0..1 each, the mean is the score): how many kinds of event, how irregular the gaps, how
// irregular the sweeps (sizes), how often the direction turns, how many heights it rests at
function inner(toks) {
  if (toks.length < 2) return { score: 0 };
  const kinds = new Set(toks.map(t => t.kind)).size, gaps = toks.slice(1).map(t => t.gap), amps = toks.map(t => Math.abs(t.dy)).filter(v => v >= 0.3);
  let turns = 0, last = 0; for (const t of toks) { const s = Math.sign(Math.round(t.dy)); if (s && last && s !== last) turns++; if (s) last = s; }
  let y = 0; const rests = new Set([0]); for (const t of toks) { y += t.dy; rests.add(Math.round(y)); }
  const f = { kinds: Math.min(1, (kinds - 1) / 3), gapIrr: Math.min(1, cv(gaps) / 0.5), sweepIrr: Math.min(1, cv(amps) / 0.6), turns: Math.min(1, turns / Math.max(1, toks.length - 1) / 0.6), rests: Math.min(1, (rests.size - 1) / 4) };
  return Object.assign({ score: +mean(Object.values(f)).toFixed(2) }, Object.fromEntries(Object.entries(f).map(([k, v]) => [k, +v.toFixed(2)])));
}
// distance between two sections' recipes: edit distance on the kinds (normalised) + gaps and sweeps compared in order
function between(A, Bt) {
  const n = A.length, m = Bt.length, D = Array.from({ length: n + 1 }, (_, i) => [i].concat(Array(m).fill(0)));
  for (let j = 1; j <= m; j++) D[0][j] = j;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + (A[i - 1].kind === Bt[j - 1].kind ? 0 : 1));
  const L = Math.min(n, m), num = L ? mean(Array.from({ length: L }, (_, k) => Math.min(1, Math.abs(A[k].gap - Bt[k].gap) / 0.4) * 0.5 + Math.min(1, Math.abs(A[k].dy - Bt[k].dy) / 3) * 0.5)) : 1;
  return +(0.5 * D[n][m] / Math.max(n, m, 1) + 0.5 * num).toFixed(3);
}
// a generated section's path -> tokens
function tokensOf(b) {
  const { e } = G2.ballCtx(), { h, r } = G.play(b.mode, b.objects, b.width, b.events), x0 = h.s0 * B, x1 = h.s1 * B, t0 = (r.path.find(s => s.x >= x0) || {}).tick || 0;
  const pts = r.path.filter((s, i) => s.x >= x0 && s.x <= x1 && i % 2 === 0).map(s => [(s.x - x0) / B, s.y / B, (s.tick - t0) / TPS, 0, s.grav, 0, s.grounded ? 1 : 0]);
  const presses = b.events.filter(x => x.type === "press").map(x => (x.tick + e.tick - t0) / TPS);
  return extract(pts, presses);
}
function officialSections(file, lo = 4, hi = 8) {
  const P = JSON.parse(fs.readFileSync(file, "utf8")).filter(p => p.src === "official" && p.mode === "ball" && p.grain === "piece" && p.presses >= lo && p.presses <= hi);
  return P.map(p => ({ level: p.level, x: p.x, presses: p.presses, toks: extract(p.path, (p.clicks || []).filter(c => c[2] === 1).map(c => c[3])) }));
}

// ---------------------------------------------------------------- gen
function windowsOf(b) {
  const GD = GDlib(), { h, r } = G.play(b.mode, b.objects, b.width, b.events), ev = G.absEvents(b.mode, b.events);
  try { return GD.inputWindows(h.w, ev, r.path, { strict: true }).filter(x => x.type === "press").map(x => Math.round((x.hi - x.lo + 1) / TPS * 1000)); } catch (e) { return []; }
}
function gen(opts) {
  const r = rng((opts.seed || 1) * 104729), t0 = Date.now(), why = {}, good = [];
  const no = k => { k = k.replace(/:.*/, "").replace(/click \d+ /, "click "); why[k] = (why[k] || 0) + 1; };
  for (let i = 0; i < opts.n; i++) {
    const P = plan(r, opts.clicks, opts.beat);
    let b; try { b = build(r, P); } catch (e) { b = { why: "error: " + e.message }; }
    if (b.why) { no(b.why); continue; }
    if (b.args.presses !== opts.clicks) { no("lost a click"); continue; }
    b = close(b);
    const v = G.verify(b);
    if (!v.ok) { no(v.why); continue; }
    if (v.skip) { no("a secret way (a click left out still clears)"); continue; }
    const wins = windowsOf(b), toks = tokensOf(b);
    const hit = P.map((c, k) => wins[k] == null ? null : wins[k] >= WIN[c.win].ms[0] && wins[k] <= WIN[c.win].ms[1]);
    good.push(Object.assign(b, { verify: { windows: wins, stray: v.stray, secs: v.secs, cps: v.cps }, windowHit: hit.filter(Boolean).length, toks, recipe: recipe(toks), inner: inner(toks) }));
  }
  // keep: the most varied inside first, then each next the farthest from those kept (recipe distance)
  const pool = good.slice().sort((a, c) => c.inner.score - a.inner.score), kept = [];
  while (kept.length < opts.keep && pool.length) {
    let bi = 0;
    if (kept.length) { let best = -1; pool.forEach((b, i) => { const d = Math.min(...kept.map(k => between(k.toks, b.toks))) + 0.3 * b.inner.score - 0.03 * b.verify.stray; if (d > best) { best = d; bi = i; } }); }
    kept.push(pool.splice(bi, 1)[0]);
  }
  console.log(`ball, ${opts.clicks} clicks: ${opts.n} plans, ${good.length} built + verified, ${kept.length} kept (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  console.log(`   dropped: ${Object.entries(why).sort((a, c) => c[1] - a[1]).map(([k, v]) => k + " " + v).join(", ") || "none"}`);
  const setName = path.basename(OUT, ".json").replace(/^clickfirst_?/, "") || "ball";
  kept.forEach((b, k) => { b.id = `cf-${setName}-${k + 1}`; });
  const report = summary(kept, opts.pieces);
  fs.writeFileSync(OUT, JSON.stringify({ made: new Date().toISOString(), note: "BRICKGEN.md 'Round 3': ball sections built clicks first (tools/clickfirst.js). plan = the clicks with kind and wanted window; toks = the extracted recipe; objects structure-relative; events ticks from the section's entry.",
    report, sections: kept.map(b => ({ id: b.id, width: b.width, plan: b.plan, args: b.args, verify: b.verify, windowHit: b.windowHit, recipe: b.recipe, inner: b.inner, nearestOfficial: b.nearestOfficial, events: b.events, objects: b.objects })) }, null, 0).replace(/\{"id"/g, "\n{\"id\""));
  console.log(`-> ${path.relative(ROOT, OUT)}`);
  return kept;
}
function summary(kept, piecesFile) {
  const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
  const nn = L => L.map((a, i) => Math.min(...L.map((b, j) => i === j ? Infinity : between(a, b))));
  const out = { ours: { n: kept.length, inner: med(kept.map(b => b.inner.score)), between: kept.length > 1 ? med(nn(kept.map(b => b.toks))) : null } };
  let off = null;
  try { off = officialSections(piecesFile || path.join(ROOT, "local", "lego", "pieces.json")); } catch (e) { }
  if (off && off.length > 2) {
    out.official = { n: off.length, inner: med(off.map(o => inner(o.toks).score)), between: med(nn(off.map(o => o.toks))) };
    for (const b of kept) { let best = null; for (const o of off) { const d = between(b.toks, o.toks); if (!best || d < best.d) best = { d, level: o.level, x: o.x, recipe: recipe(o.toks) }; } b.nearestOfficial = best; }
  }
  for (const b of kept) console.log(`${b.id}  inner ${b.inner.score}  windows ${b.verify.windows.join("/")} ms (${b.windowHit}/${b.plan.length} as wanted), stray ${b.verify.stray}, spikes ${b.args.spikes}\n    plan   ${b.plan.map(c => `${c.free ? c.free + "+" : ""}${c.kind}@${c.t}(${c.win})`).join(" ")}\n    recipe ${b.recipe}` + (b.nearestOfficial ? `\n    closest official: ${b.nearestOfficial.level} at block ${b.nearestOfficial.x}, distance ${b.nearestOfficial.d}  (${b.nearestOfficial.recipe})` : ""));
  console.log(`variance -- inside a section (median): ours ${out.ours.inner}` + (out.official ? `, official ${out.official.inner}` : "") + `;  between sections (median distance to the nearest other): ours ${out.ours.between}` + (out.official ? `, official ${out.official.between} (${out.official.n} official ball sections of 4-8 clicks)` : ""));
  return out;
}

// ---------------------------------------------------------------- lab: each section in its own test context
function lab() {
  const L = JSON.parse(fs.readFileSync(OUT, "utf8")).sections, e = G.entry("ball"), objs = [], seeds = [];
  const LEADIN = e.s0 - 8 - 1; let base = 8;
  for (const b of L) {
    objs.push(["ball portal", base, 1]);
    const col = base + 1 + LEADIN;
    objs.push(`// ${b.id}: ${b.recipe}`);
    for (const o of b.objects) objs.push([o[0], +(o[1] + col).toFixed(2), o[2]].concat(o[3] ? [o[3]] : []));
    const dt = (col - e.s0) * B / V;
    for (const x of b.events) if (x.type === "press") seeds.push({ t: +((e.tick + x.tick) / TPS + dt).toFixed(4), hold: 0.05 });
    const ex = col + b.width + 4;
    for (const rr of [1, 4, 7]) objs.push(["cube portal", ex, rr]);
    objs.push(["block", ex, 9]);
    base = ex + 14;
  }
  const set = path.basename(OUT, ".json").replace(/^clickfirst_?/, ""), tag = set ? "_" + set : "_ball";
  const spec = { name: "GDLM lab clickfirst " + (set || "ball"), description: "Ball sections built clicks first (tools/clickfirst.js)", speed: "1x", style: "classic", indicators: false, objects: objs, seedPresses: seeds, outro: 1 };
  const f = path.join(ROOT, "specs", `lab_clickfirst${tag}.json`);
  fs.writeFileSync(f, JSON.stringify(spec, null, 1));
  console.log(`-> ${path.relative(ROOT, f)}: ${L.length} sections; build: node tools/make.js ${path.relative(ROOT, f)}`);
}

module.exports = { plan, build, close, extract, recipe, inner, between, tokensOf, officialSections, gen };

if (require.main === module) {
  const argv = process.argv.slice(2), cmd = argv[0], arg = k => { const i = argv.indexOf("--" + k); return i >= 0 ? argv[i + 1] : null; };
  if (arg("set")) OUT = path.join(ROOT, "knowledge", `clickfirst_${arg("set")}.json`);
  if (cmd === "gen") gen({ beat: arg("bpm") ? 60 / +arg("bpm") : null, clicks: +(arg("clicks") || 6), n: +(arg("n") || 150), keep: +(arg("keep") || 5), seed: +(arg("seed") || 1), pieces: arg("pieces") });
  else if (cmd === "pattern") {
    const off = officialSections(arg("pieces") || path.join(ROOT, "local", "lego", "pieces.json"));
    for (const o of off) console.log(`${(o.level + " @" + o.x).padEnd(34)} ${o.presses} clicks  inner ${inner(o.toks).score}  ${recipe(o.toks)}`);
  } else if (cmd === "lab") lab();
  else console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).slice(0, 20).join("\n"));
}
