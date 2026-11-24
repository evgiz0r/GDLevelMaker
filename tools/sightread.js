// node tools/sightread.js <level.gdlvl> [...]  -- is each click cued by what is right in front?
//
// The user's rule (after playing GDLM 41/42): a fair, sight-readable level never makes you
// "prejump" -- commit to a jump while the thing it is for is still far ahead, in the middle of
// nothing, so you can only get it right by knowing the pattern in advance.
//
// For each press of the solver's solution: drop that press (and the ones after it), run on, and
// see what kills the cube; that object, or a nearer gameplay object ahead within reach (a
// block to land on, an orb), is the press's CUE. The LEAD is how far ahead of the cube's
// front edge the cue still is at the LATEST moment the press works (the end of its window).
// Small lead = you jump when the obstacle is in your face = reactable. Big lead = a prejump.
// Flagged: lead > LIMIT blocks (default 1.5; --limit n; times the speed over 1x at 2x+); presses made in ship/UFO/wave/swing are steering and not judged. A press that
// fires an orb counts as cued, and so does jumping off the end of a ledge.
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
const { GD, readGdlvl } = require("./io.js");
// flying modes turn slowly, so steering starts further ahead of what it is for: allow 3 blocks
const FLYING = new Set(["ship", "ufo", "wave", "swing"]), FLY_LIMIT = 3;
// the limit is a reaction TIME: at 2x the same time covers 1.24x the blocks (GDLM 64 round 6: three 2x jumps "1.6-1.7
// blocks ahead" = 1.3-1.4 blocks of 1x time). Only scaled up: slow speeds keep the 1x limit.
const speedFactor = st => { const S = GD.SPEEDS; return st && S && S[st.sp] && S[1] ? Math.max(1, S[st.sp].x / S[1].x) : 1; };

// A cube hold that re-jumps on landing -> one press per jump (press on the jump's tick, release
// the tick after). Returned only if the run is unchanged; else the original events.
function humanize(w, events) {
  const path = GD.run(w, events).path;
  if (!path[path.length - 1].done) return events;
  const ev = events.slice().sort((a, b) => a.tick - b.tick);
  // the button state the solver used, per tick
  const held = new Array(path.length).fill(false);
  { let h = false, i = 0; for (let t = 0; t < path.length; t++) { while (i < ev.length && ev[i].tick === t) { h = ev[i].type === "press"; i++; } held[t] = h; } }
  // the button state a person would use: in cube mode, down only on the tick a jump or an orb fires;
  // elsewhere (ship, wave, ...) as the solver held it
  const want = held.slice();
  for (let t = 0; t + 1 < path.length; t++) {
    if (path[t].mode !== "cube") continue;
    const b = path[t + 1], g = path[t].grav || 1;
    const fires = held[t] && ((b.act === "jump" && b.vy * g > 5 && path[t].vy * g <= 0.5) || (/orb/.test(b.act || "") && b.act !== path[t].act));
    want[t] = fires;
  }
  const out = [];
  for (let t = 0; t < path.length; t++) if (want[t] !== (t ? want[t - 1] : false)) out.push({ tick: t, type: want[t] ? "press" : "release" });
  if (out.length === ev.length && out.every((e, i) => e.tick === ev[i].tick && e.type === ev[i].type)) return events;
  const p2 = GD.run(w, out).path;
  const same = p2.length === path.length && p2[p2.length - 1].done && Math.abs(p2[p2.length - 1].y - path[path.length - 1].y) < 1e-6;
  return same ? out : events;
}

function sightread(level, limit = 1.5, opts = {}) {
  const w = opts.world || GD.makeWorld(level.objects, level.header);
  // opts.route: a verified route whose presses carry their windows ({ ok, events, clicks: [{type, tick, lo, hi, x}] },
  // tools/score.js from the saved human route): judged as it is, no solving, no re-measuring
  // A saved window that reaches MAX_SHIFT (48 steps) past its press is cut off by the measure, not by the level: its
  // hi is not "the latest moment the press works", which is what the cue distance needs (the ball corridor of
  // tests/style_gates.js: saved hi 2.1 blocks before the spike, real latest 0.9). Those are measured on the route
  // itself by shifting (lib/sync.js pressWindows, later inputs fixed): no solve.
  if (opts.route && opts.route.ok && opts.route.clicks.every(c => c.type !== "press" || c.lo != null)) {
    const CAP = require("../lib/difficulty.js").DIFF.MAX_SHIFT;
    let presses = opts.route.clicks.filter(c => c.type === "press");
    if (presses.some(c => c.hi - c.tick >= CAP)) {
      // walk each cut-off press (with its own release) later, one step at a time, while the run lives to the next
      // input (up to 1 s: a ball press can wait 3+ blocks)
      const ev = opts.route.events, basePath = GD.run(w, ev).path, end = basePath.length;
      presses = presses.map(c => {
        if (c.hi - c.tick < CAP) return c;
        // never across a mode change: a ship press walked past the exit portal was judged as a cube jump "2.3 ahead"
        // (GDLM 66 p1, block 52 -> 60.6)
        const m0 = (basePath[c.tick] || {}).mode;
        const i = ev.findIndex(e => e.type === "press" && e.tick === c.tick); if (i < 0) return c;
        const rel = ev[i + 1] && ev[i + 1].type === "release" ? i + 1 : -1, dur = rel < 0 ? 0 : ev[rel].tick - c.tick;
        const next = ev.find((e, j) => j > (rel < 0 ? i : rel)), stop = Math.min(c.tick + 240, next ? next.tick - dur - 1 : end);
        let hi = c.hi;
        for (let t = c.hi + 1; t <= stop && (basePath[t] || {}).mode === m0; t++) {
          // this press's job ends at the next input: alive until then counts (later inputs belong to later presses;
          // keeping them fixed in time made a later flip look fatal on the ball corridor)
          const moved = ev.slice(0, (rel < 0 ? i : rel) + 1).map((e, j) => j === i ? Object.assign({}, e, { tick: t }) : j === rel ? Object.assign({}, e, { tick: t + dur }) : e);
          const run = GD.run(w, moved);
          if (run.dead && run.path.length - 1 < (next ? next.tick : end)) break; hi = t;
        }
        // walked all the way to the next input (or the mode change) and still alive: the press answers nothing at its
        // moment -- a free jump (score.js's "pointless jumps" judges those), not a prejump (GDLM 66: a free hop at 967.9
        // walked to 978 read "11.5 ahead" of a spike 22 blocks after the press)
        const free = hi >= stop || (basePath[hi + 1] || {}).mode !== m0;
        return Object.assign({}, c, { hi, free });
      });
    }
    return judge(w, level, presses, opts.route.events, limit, false);
  }
  const r = GD.solveAny(w);
  if (!r.ok) return { ok: false };
  let presses = r.clicks.filter(c => c.type === "press");
  let base = r.events;
  // The solver takes the fewest presses, so it climbs with one long hold (a held cube re-jumps on
  // landing) -- a person taps once per jump. Judge the tapped version: every cube jump its own
  // press. And the sweep solver (levels with modes) gives no windows: measure each press's window
  // by shifting it (lib/sync.js pressWindows), so "the latest moment the press works" is real.
  // (Taps: opts.taps. Off by default: shifting one tap with every later input fixed in time makes
  // windows look tiny on mode levels -- a person adapts the next jump, the replay cannot.)
  const tapped = opts.taps ? humanize(w, r.events) : r.events;
  const approx = presses.some(c => c.lo == null || c.lo === c.hi);
  if (tapped !== r.events || approx) {
    const sync = require("../lib/sync.js");
    const pw = (sync.SYNC || GD.SYNC).pressWindows(w, tapped);
    if (pw) {
      base = tapped;
      presses = pw.windows.map(p => ({ type: "press", tick: p.tick, lo: p.lo, hi: p.hi, x: pw.path[p.tick].x, act: p.act, ms: Math.round((p.hi - p.lo + 1) / GD.PHYS.TPS * 1000) }));
    }
  }
  return judge(w, level, presses, base, limit, approx);
}

function judge(w, level, presses, base, limit, approx) {
  const out = [];
  for (const c of presses) {
    // events strictly before this press (with their auto releases)
    const before = base.filter(e => e.tick < c.tick);
    const res = GD.run(w, before);
    const hiState = GD.run(w, before.concat([{ tick: c.hi, type: "press" }, { tick: c.hi + 1, type: "release" }])).path[c.hi] || res.path[c.hi];
    const xHi = hiState ? hiState.x : c.x;
    const loState = res.path[c.lo];
    const xLo = loState ? loState.x : c.x;
    // the cue: what kills you without this press, or the nearest gameplay object ahead within
    // reach (a hop's front face, an orb) if that is closer -- either way, something to react to
    let cue = null, lead = null;
    const y = hiState ? hiState.y : 0;
    const cands = level.objects.filter(o => { const k = GD.objInfo(o.id).kind; return ["solid", "slope", "hazard", "orb", "pad"].includes(k); })
      .map(o => ({ o, hb: GD.hitbox(o) })).filter(c => c.hb && c.hb.x0 >= xHi + 15 - 1 && c.hb.y0 < y + 120 && c.hb.y1 > y - 15);
    if (res.dead && res.killer) cands.push({ o: res.killer, hb: GD.hitbox(res.killer) });
    for (const c of cands) {
      if (!c.hb) continue;
      const l = (c.hb.x0 - (xHi + 15)) / 30;
      if (lead == null || l < lead) { lead = l; cue = c.o; }
    }
    // jumping at the end of a ledge is cued by the ledge: at the latest moment the cube stands on a
    // solid whose far edge is within half a block of its front, and walking off it kills in the fall
    // (before landing anywhere). If walking off lands safely and the death comes later, that is
    // still a prejump (GDLM 41 v1's stairs).
    if (hiState && hiState.grounded && lead != null && lead > 0) {
      const foot = (hiState.grav || 1) > 0 ? hiState.y - 15 : hiState.y + 15;
      // without this press: does the cube die in the fall, before landing anywhere?
      let diesInFall = false;
      if (res.dead) {
        let left = false; diesInFall = true;
        for (let t = c.hi; t < res.path.length; t++) {
          const st = res.path[t];
          // a "landing" that dies within 1/8 s is the crash itself (into the next pillar's side)
          if (!st.grounded) left = true; else if (left) { diesInFall = res.path.length - 1 - t <= 30; break; }
        }
      }
      const ledge = diesInFall && level.objects.some(o => {
        const k = GD.objInfo(o.id).kind; if (k !== "solid") return false;
        const hb = GD.hitbox(o); if (!hb) return false;
        const onIt = Math.abs(((hiState.grav || 1) > 0 ? hb.y1 : hb.y0) - foot) < 2 && hb.x0 <= hiState.x && hb.x1 >= hiState.x - 15;
        return onIt && hb.x1 <= hiState.x + 15 + 15 && !level.objects.some(n => { if (n === o || GD.objInfo(n.id).kind !== "solid") return false; const h2 = GD.hitbox(n); return h2 && Math.abs(h2.x0 - hb.x1) < 1 && Math.abs(h2.y1 - hb.y1) < 1; });
      });
      if (ledge) { lead = 0; cue = null; }
    }
    // a press that fires an orb is cued by that orb: the cube is touching it
    if (c.act && GD.objInfo && /orb/.test(c.act)) { lead = 0; cue = null; }
    if (c.free) { lead = 0; cue = null; }
    // A press whose latest moment is in a flying mode (ship, ufo, wave, swing) is steering, not a jump: it has no
    // one thing it answers, so it is not judged as a prejump -- the route, fairness and timing gates judge flight
    // (GDLM 44's ship tunnel: the fly controller's centring presses read as "4.1 / 10.1 blocks ahead of a block";
    // GDLM 64's wave mouth: a cube press held into the wave portal, "4.8 ahead"). A hold that carries out of flight
    // into a cube jump is still judged: its latest moment is then in cube mode. (polish + physics, 2026-11-24)
    if (lead != null && hiState && FLYING.has(hiState.mode)) { lead = 0; cue = null; }
    // a press right at a flying mode's portal (its latest moment within 2 blocks before the portal, still in cube) is the
    // hold that carries the player into the new mode: cued by the portal (GDLM 66: a cube press at block 141 "4.7 ahead"
    // of the ship corridor's first block, its portal at 142)
    if (lead != null && lead > 0 && level.objects.some(o => { const i = GD.objInfo(o.id); return i && i.kind === "mode" && FLYING.has(i.mode) && o.x >= xHi - 15 && o.x <= xHi + 105; })) { lead = 0; cue = null; }
    // a press that would be flagged: its latest moment measured as a PLAYER's (lib/windows.js: the later inputs re-planned
    // around it, as a player corrects). With the later inputs fixed, a later first press breaks the NEXT jump, so the
    // window ends early and the lead reads long (GDLM 66 p1: "2.3 ahead" with the next jump 4 blocks on; GDLM 50 v3:
    // "4.2 ahead" before a robot part -- showcase, 2026-11-24). Only for presses over the limit: it costs a replay each.
    let xHiP = xHi;
    const lim = (FLYING.has(hiState && hiState.mode) ? FLY_LIMIT : limit) * speedFactor(hiState);
    if (lead != null && lead > lim) try {
      const W = require("../lib/windows.js"), ev = base.slice().sort((a, b) => a.tick - b.tick), idx = ev.findIndex(e => e.type === "press" && e.tick === c.tick);
      const win = idx >= 0 ? (W.inputWindows || GD.inputWindows)(w, ev, GD.run(w, ev).path, { only: i => i === idx }) : null;
      const pw = win && win.find(x => x.i === idx);
      if (pw && pw.hi > c.hi) {
        const st = GD.run(w, ev.filter(e => e.tick < c.tick).concat([{ tick: pw.hi, type: "press" }, { tick: pw.hi + 1, type: "release" }])).path[pw.hi];
        if (st) { xHiP = st.x; lead = lead - (xHiP - xHi) / 30; }
      }
    } catch (e) { /* keep the strict reading */ }
    out.push({ act: c.act, block: c.x / 30, from: xLo / 30, to: xHiP / 30, ms: c.ms, cue: cue && GD.objInfo(cue.id).name, cueAt: cue && cue.x / 30,
      mode: hiState && hiState.mode, lead, flag: lead != null && lead > (FLYING.has(hiState && hiState.mode) ? FLY_LIMIT : limit) * speedFactor(hiState) });
  }
  return { ok: true, presses: out, approx };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const li = args.indexOf("--limit");
  const limit = li >= 0 ? +args[li + 1] : 1.5;
  const files = args.filter((a, i) => a.endsWith(".gdlvl"));
  let bad = 0;
  for (const f of files) {
    const L = readGdlvl(f);
    const s = sightread(L.level, limit);
    console.log(`== ${L.name}`);
    if (!s.ok) { console.log("   not beatable"); bad++; continue; }
    for (const p of s.presses)
      console.log(`   ${p.flag ? "PREJUMP" : "ok     "} press at block ${p.from.toFixed(1)}-${p.to.toFixed(1)} (${p.ms} ms) for ${p.cue || "?"} at ${p.cueAt ? p.cueAt.toFixed(1) : "?"}: lead ${p.lead == null ? "?" : p.lead.toFixed(1)} blocks`);
    const n = s.presses.filter(p => p.flag).length;
    console.log(`   ${n ? n + " prejump(s)" : "sight-readable"} (limit ${limit} blocks)`);
    if (n) bad++;
  }
  process.exit(bad ? 2 : 0);
}
module.exports = { sightread };
