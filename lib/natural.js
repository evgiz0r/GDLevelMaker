// A natural way to play a solved level, for the replay (and for judging the level by it).
// The solver finds the FEWEST presses, which looks wrong to a player (playtest, GDLM 44 v3):
// holds that make the cube re-jump on every landing ("empty clicks" with nothing to jump over),
// a ship flown with a few long holds and releases (it zigzags like a wave), jumps taken at the
// very last moment off every edge. naturalPlan rewrites the inputs, keeping only changes after
// which the run still finishes:
//   1. cube holds -> one tap per jump;
//   2. a press that is not needed is dropped (an "empty click"; any mode but ship/wave holds), and
//      one held from a block into a ship/wave portal moves to the portal;
//   3. each ship / wave / UFO / swing stretch is flown again by a controller that steers for the
//      middle of the free space ahead (the ship hovers with short taps, the wave follows its
//      corridor), stretch by stretch.
//   4. each tap goes early in its timing window (40% in), not at its last safe frame;
//   5. every hold outside ship/wave is cut to the shortest that still finishes (taps, not long holds);
//   6. orbs are taken buffered: pressed a little before and held until the orb fires on first contact;
//   7. a tap is as long as a real one (~60 ms) where that changes nothing.
// Needs lib/physics.js (GD.run, GD.step, GD.startState, GD.makeWorld) and lib/objects.js.
// Works in node and the browser. Cost: a few dozen replays of the level (well under a second
// for a 10 s level, a few seconds for 90 s).
(function (OUT) {
  "use strict";
  // in node the physics comes from its own modules; in the browser it is already on window.GD
  const GD = (typeof module !== "undefined" && typeof require !== "undefined")
    ? Object.assign({}, require("./objects.js"), require("./physics.js")) : OUT;
  const DEBUG = typeof process !== "undefined" && process.env && process.env.NATURAL_DEBUG;
  const clone = s => { const c = { ...s }; if (s.used) c.used = s.used.slice(); return c; };
  // GOAL: for a run the solver could not finish, a change is kept if the run still gets this far
  // (the user wants the unbeaten Deadlocked map flown mid-corridor too, 2026-11-23)
  let GOAL = null;
  // WIN [t0, t1]: naturalPlan's opts.window -- only inputs with a tick in it are moved or dropped, only flying
  // stretches overlapping it are flown again (lib/incsolve.js: after an edit only the re-solved stretch needs it)
  let WIN = null;
  const inWin = t => !WIN || (t >= WIN[0] && t <= WIN[1]);
  // past the budget (opts.budgetMs) every replay stops the pass it is in: naturalPlan returns the last route plan() had checked
  const finishes = (w, ev) => { const p = GD.run(w, ev).path, e = p[p.length - 1]; return e.done || (GOAL !== null && e.x >= GOAL - 1) ? p : null; };
  // tools/heavy.js pause / yield: offered before every replay of a pass (a pause waits in place, nothing is lost); the
  // time paused does not count against the budget
  const done = (w, ev) => {
    const f = typeof globalThis !== "undefined" && globalThis.gdlmYield;
    if (f) { const t = Date.now(); if (f() && DEADLINE !== Infinity) DEADLINE += Date.now() - t; }
    if (DEADLINE !== Infinity && Date.now() > DEADLINE) throw BUDGET; return finishes(w, ev); };
  const toEvents = held => { const out = []; let h = false; for (let t = 0; t < held.length; t++) if (held[t] !== h) { out.push({ tick: t, type: held[t] ? "press" : "release" }); h = held[t]; } return out; };
  const heldOf = (ev, n) => { const held = new Array(n).fill(false); let h = false, i = 0; const e = ev.slice().sort((a, b) => a.tick - b.tick); for (let t = 0; t < n; t++) { while (i < e.length && e[i].tick === t) { h = e[i].type === "press"; i++; } held[t] = h; } return held; };
  const FLY = { ship: 1, wave: 1, ufo: 1, swing: 1 };
  // The human cost of a whole route (lib/difficulty.js humanCost, the difficulty session's: windows, presses,
  // position in window, marks; lower is better, log10-attempts units). The one judge of "more natural" between
  // two routes that both finish and skip nothing. Null when it is not loaded (the browser without difficulty.js).
  // Slow (one window measure of the whole route: ~30 s on GDLM 44's ship), so only with naturalPlan's
  // opts.cost (tools/solutions.js, when it saves a route); cached per route.
  let HC = null, USE_COST = false; const costCache = new Map();
  function humanCost(w, ev) {
    if (!USE_COST) return null;
    const key = ev.map(e => e.tick + (e.type === "press" ? "p" : "r")).join(",");
    if (costCache.has(key)) return costCache.get(key);
    const v = humanCostRaw(w, ev); costCache.set(key, v); return v;
  }
  function humanCostRaw(w, ev) {
    if (HC === null) { HC = GD.humanCost || OUT.humanCost || false;
      if (!HC && typeof require !== "undefined") try { HC = require("./difficulty.js").humanCost || false; } catch (e) { HC = false; } }
    if (!HC) return null;
    try { return HC(w, ev).cost; } catch (e) { return null; }
  }
  const clean = (w, ev, p) => !GD.skipCheck || !GD.skipCheck(w, p, ev);
  // the tightest player window (ms) among a route's inputs in ticks [a, b) (lib/difficulty.js measureWindows, the windows
  // everything else uses; cached on w); null when it cannot be measured. The user, 2026-11-25: "its better to get an extra
  // click or two than having a terrible timing ... mostly in the flying sections (wave ship ufo swing). we can have a tas
  // doing little clicks but human route should avoid bad timings at the cost of an easy timing"
  let MW = null;
  function tightestMs(w, ev, a, b) {
    if (MW === null) { MW = GD.measureWindows || OUT.measureWindows || false;
      if (!MW && typeof require !== "undefined") try { MW = require("./difficulty.js").measureWindows || false; } catch (e) { MW = false; } }
    if (!MW) return null;
    try {
      const ms = MW(w, ev.slice().sort((x, y) => x.tick - y.tick), { range: [a, b - 1] }).map(m => m.ms).filter(v => v != null);
      return ms.length ? Math.min(...ms) : Infinity;
    } catch (e) { return null; }
  }
  const EASY_MS = 100;   // a flying input's window a person hits without thinking (DIFFICULTY.md: under ~100 ms counts as tight)

  // 1. cube holds -> taps: the button goes down only on the tick a jump or an orb fires
  function taps(w, ev, path) {
    const held = heldOf(ev, path.length), want = held.slice();
    for (let t = 0; t + 1 < path.length; t++) {
      if (path[t].mode !== "cube" || !inWin(t)) continue;
      const b = path[t + 1], g = path[t].grav || 1;
      want[t] = held[t] && ((b.act === "jump" && b.vy * g > 5 && path[t].vy * g <= 0.5) || (/orb|pad/.test(b.act || "") && b.act !== path[t].act));
    }
    const out = toEvents(want);
    if (done(w, out)) return out;
    // all at once failed somewhere: hold by hold, keeping each conversion that still finishes (GDLM 62 kept
    // 2-10 s holds through whole cube and ball stretches because one spot failed the all-at-once try)
    return tapsEach(w, ev, path);
  }
  // one hold at a time: a hold (outside ship/wave) that fires several jumps / flips / orbs becomes one tap per
  // firing (pressed on the tick before it fires, released the next)
  const FIRES = a => a === "jump" || a === "tap" || a === "flap" || a === "teleport" || /orb|pad/.test(a || "");
  function tapsEach(w, ev, path) {
    let cur = ev.slice();
    for (let i = 0; i < cur.length; i++) {
      if (cur[i].type !== "press") continue;
      const j = cur.findIndex((x, k) => k > i && x.type === "release"); if (j < 0) continue;
      const a = cur[i].tick, b = cur[j].tick, m = (path[a] || {}).mode;
      // a hold that stays in ship / wave steers: leave it; one that starts there and runs on past the exit into cube jumps
      // (GDLM 44: a wave press held 3.0-3.8 s through the exit and on over spikes) is split like the others
      if (b - a <= 36 || (HOLDS[m] && path.slice(a, Math.min(b + 1, path.length)).every(st => HOLDS[st.mode]))) continue;
      const fires = []; for (let t = a; t < b && t + 1 < path.length; t++) if (path[t + 1].act && FIRES(path[t + 1].act) && path[t + 1].act !== (path[t].act || "")) fires.push(t);
      if (fires.length < 2) continue;
      let tapsEv = []; for (const t of fires) { tapsEv.push({ tick: t, type: "press" }, { tick: t + 1, type: "release" }); }
      let tr = cur.slice(0, i).concat(tapsEv, cur.slice(j + 1)).sort((p, q) => p.tick - q.tick);
      let p2 = done(w, tr);
      // a hold that runs into or out of a ship / wave part (GDLM 44, 45, 64: 1-8 s holds kept whole): the button stays
      // down wherever the mode steers by holding, and only the cube / ball / robot firings in between become taps
      if (!p2 && path.slice(a, Math.min(b + 1, path.length)).some(st => HOLDS[st.mode])) {
        const want = []; for (let t = a; t < b && t < path.length; t++) want[t - a] = !!HOLDS[path[t].mode];
        for (const t of fires) if (!HOLDS[path[t].mode] && !/portal/.test(path[t + 1].act || "")) want[t - a] = true;
        // a portal into a holding mode: be down from the tick before it, as the original hold was
        for (let t = a + 1; t < b && t < path.length; t++) if (HOLDS[path[t].mode] && !HOLDS[path[t - 1].mode]) want[t - 1 - a] = true;
        tapsEv = []; let dn = false;
        for (let k = 0; k < want.length; k++) { if (want[k] && !dn) { tapsEv.push({ tick: a + k, type: "press" }); dn = true; } else if (!want[k] && dn) { tapsEv.push({ tick: a + k, type: "release" }); dn = false; } }
        if (dn) tapsEv.push({ tick: b, type: "release" });
        tr = cur.slice(0, i).concat(tapsEv, cur.slice(j + 1)).sort((p, q) => p.tick - q.tick);
        p2 = done(w, tr);
        if (!p2) {   // still not: hold on from the last tap before each portal into the holding mode, through it
          for (let t = a + 1; t < b && t < path.length; t++) if (HOLDS[path[t].mode] && !HOLDS[path[t - 1].mode]) {
            let k = t - 1; while (k > a && !fires.includes(k)) k--; for (let u = k; u < t; u++) want[u - a] = true; }
          tapsEv = []; let dn2 = false;
          for (let k = 0; k < want.length; k++) { if (want[k] && !dn2) { tapsEv.push({ tick: a + k, type: "press" }); dn2 = true; } else if (!want[k] && dn2) { tapsEv.push({ tick: a + k, type: "release" }); dn2 = false; } }
          if (dn2) tapsEv.push({ tick: b, type: "release" });
          tr = cur.slice(0, i).concat(tapsEv, cur.slice(j + 1)).sort((p, q) => p.tick - q.tick);
          p2 = done(w, tr);
        }
      }
      if (!p2) {   // greedy: open the gap after each firing on its own, keeping each opening that still finishes -- a hold
        // stays only between the firings that need it (GDLM 60 at 10.45 s: the 7th of 8 jumps needs the button kept down)
        const gapsOpen = []; let best = null;
        for (let g = 0; g < fires.length; g++) {
          const open = gapsOpen.concat([g]), tv = []; let dn = false;
          for (let t = a; t < b; t++) { const inGap = open.some(k => t > fires[k] && t < (k + 1 < fires.length ? fires[k + 1] : b));
            if (!inGap && !dn) { tv.push({ tick: t, type: "press" }); dn = true; } else if (inGap && dn) { tv.push({ tick: t, type: "release" }); dn = false; } }
          if (dn) tv.push({ tick: b, type: "release" });
          const t2 = cur.slice(0, i).concat(tv, cur.slice(j + 1)).sort((p, q) => p.tick - q.tick), pp = done(w, t2);
          if (pp) { gapsOpen.push(g); best = { tr: t2, p: pp }; }
        }
        if (best) { tr = best.tr; p2 = best.p; }
      }
      if (p2) { cur = tr; path = p2; i = cur.findIndex(x => x.tick > fires[fires.length - 1] + 1) - 1; if (i < -1) break; }
    }
    return cur;
  }

  // 2. no press that is not needed (the user on GDLM 44 v12: "some places mark to jump but no need"),
  // last first, re-checked until nothing changes:
  //   a. a press with its release goes if the run still finishes without it (any mode but ship/wave,
  //      whose holds steer: a cube jump, an orb, a ball/spider/swing flip, a UFO hop);
  //   b. a press made before a portal and held into a flying mode (the button already down on the
  //      block before a ship portal) moves to the portal: the jump on the block was not needed.
  const HOLDS = { ship: 1, wave: 1 };
  function dropEmpty(w, ev, path) {
    let cur = ev.slice();
    for (let pass = 0; pass < 3; pass++) {
      let changed = false;
      for (let i = cur.length - 1; i >= 0; i--) {
        const e = cur[i];
        if (!e || e.type !== "press" || !inWin(e.tick)) continue;
        const p = path[Math.min(e.tick, path.length - 1)];
        if (!p || HOLDS[p.mode]) continue;
        const rel = cur.findIndex((x, j) => j > i && x.type === "release");
        const relMode = rel >= 0 ? path[Math.min(cur[rel].tick, path.length - 1)].mode : null;
        if (rel < 0 || !HOLDS[relMode]) {
          const trial = cur.filter((x, j) => j !== i && j !== rel);
          const p2 = done(w, trial);
          if (p2) { cur = trial; path = p2; changed = true; continue; }
        }
        if (rel >= 0 && HOLDS[relMode]) {      // b: held into a ship/wave part: press at the portal instead
          let t = e.tick; while (t < cur[rel].tick && !HOLDS[path[t].mode]) t++;
          if (t > e.tick + 1) {
            const trial = cur.map((x, j) => j === i ? { tick: t - 1, type: "press" } : x);
            const p2 = done(w, trial);
            if (p2) { cur = trial; path = p2; changed = true; }
          }
        }
      }
      if (!changed) break;
    }
    return cur;
  }

  // 2c. holds no longer than needed (the user, 2026-11-23: "the clicks expand too long in levels" -- the
  // saved routes held the button through cube jumps and between them, where a player taps). Outside ship and
  // wave (whose holds steer), each hold is cut to the shortest that still finishes the run: release after 1,
  // 2, 4, 8 ... ticks, the first that works. A hold a mode needs (a robot's long jump, a dash orb, an auto-jump
  // chain the level is built on) stays as long as it must, because shorter ones do not finish.
  function shortenHolds(w, ev, path) {
    let cur = ev.slice();
    for (let i = 0; i < cur.length; i++) {
      if (cur[i].type !== "press" || !inWin(cur[i].tick)) continue;
      const j = cur.findIndex((x, k) => k > i && x.type === "release");
      if (j < 0) continue;
      const p = path[Math.min(cur[i].tick, path.length - 1)], len = cur[j].tick - cur[i].tick;
      if (!p || HOLDS[p.mode] || len <= 2) continue;
      for (const d of [1, 2, 4, 8, 16, 32, 64]) {
        if (d >= len) break;
        const trial = cur.map((x, k) => k === j ? { tick: cur[i].tick + d, type: "release" } : x);
        const p2 = done(w, trial);
        if (p2) { cur = trial; path = p2; break; }
      }
    }
    return cur;
  }

  // 6. orbs taken BUFFERED (the user, 2026-11-24: "usually with orbs, when possible, we want to buffer. All of
  // the orbs: buffer if possible"): the button goes down a little before the orb and stays down until it fires
  // on the first tick of contact -- the timing becomes "when I reach the orb", not a mid-orb click. In the sim
  // a press arms the orb flag (s.ring), kept while held, so a held press fires at first touch. For each press
  // whose effect is an orb, the press moves BUF ticks earlier (the most that works, up to 6 frames) and the hold
  // runs to 2 ticks past the old firing; kept when the run still finishes with that orb still taken.
  const BUF = [24, 20, 16, 12, 8];
  function orbPress(path, e) { const a = path[Math.min(e.tick + 1, path.length - 1)]; return a && a.act && /orb/.test(a.act) ? a.act : null; }
  function bufferOrbs(w, ev, path) {
    let cur = ev.slice();
    for (let i = 0; i < cur.length; i++) {
      if (cur[i].type !== "press" || !orbPress(path, cur[i])) continue;
      const j = cur.findIndex((x, k) => k > i && x.type === "release");
      const T = cur[i].tick, lo = i > 0 ? cur[i - 1].tick + 1 : 0, hi = j >= 0 && cur[j + 1] ? cur[j + 1].tick - 1 : Infinity;
      const used0 = new Set(); for (const p of path) for (const u of p.used) used0.add(u);
      for (const d of BUF) {
        if (T - d < lo || T + 2 > hi) continue;
        const tr = cur.map((x, k) => k === i ? { tick: T - d, type: "press" } : k === j ? { tick: Math.max(x.tick, T + 2), type: "release" } : x);
        const p2 = done(w, tr); if (!p2) continue;
        const used = new Set(); for (const p of p2) for (const u of p.used) used.add(u);
        if ([...used0].every(u => used.has(u))) { cur = tr; path = p2; break; }
      }
    }
    return cur;
  }
  // orbs of a route that cannot be taken buffered (only a precise click works): [{x, act}] -- a level-design
  // warning (tests/saved_routes.js)
  function unbufferedOrbs(w, ev) {
    const path = GD.run(w, ev).path, out = [];
    for (const e of ev) {
      if (e.type !== "press") continue; const act = orbPress(path, e); if (!act) continue;
      const i = ev.indexOf(e), j = ev.findIndex((x, k) => k > i && x.type === "release"), lo = i > 0 ? ev[i - 1].tick + 1 : 0;
      const ok = BUF.slice(-1).concat([12]).some(d => e.tick - d >= lo && done(w, ev.map((x, k) => k === i ? { tick: e.tick - d, type: "press" } : k === j ? { tick: Math.max(x.tick, e.tick + 2), type: "release" } : x)));
      if (!ok) out.push({ x: path[e.tick].x, act });
    }
    return out;
  }

  // cube jumps over nothing: from the ground, landing no higher than the take-off, with no hazard, orb or pad
  // under or near the arc, and walking instead survives at least 3 blocks past the landing (the user: "the solver jumps a lot when it could just drop, while just dropping in
  // the staircases is usually the intended way"). Returns [{x, down}] (down: it jumped off a step). A human
  // route has none; tests/saved_routes.js warns on them.
  function pointlessJumps(w, ev) {
    const p = GD.run(w, ev).path, near = w.items.filter(b => b.kind === "hazard" || b.kind === "orb" || b.kind === "pad"), out = [];
    for (const e of ev) {
      if (e.type !== "press") continue;
      const a = p[e.tick]; if (!a || a.mode !== "cube" || !a.grounded) continue;
      let t = e.tick + 2; while (t < p.length - 1 && !p[t].grounded && !p[t].dead) t++;
      const land = p[t]; if (!land || land.dead || land.y > a.y + 1) continue;
      if (near.some(b => b.x0 < land.x + 15 && b.x1 > a.x - 15 && b.y0 < Math.max(a.y, land.y) + 80)) continue;
      // and walking instead (this press alone dropped) survives well past where the jump landed: hopping block
      // to block over a gap is not pointless when walking off drops into the gap before a wall (GDLM 62 block 77)
      const i = ev.indexOf(e), rel = ev.findIndex((x, k) => k > i && x.type === "release");
      const q = GD.run(w, ev.filter((x, k) => k !== i && k !== rel));
      if (q.dead && q.end.x < land.x + 90) continue;
      out.push({ x: a.x, down: land.y < a.y - 1 });
    }
    return out;
  }

  // 7. a tap as long as a real one (the user on Dry Out: "clicks still fully extended" -- 100 ms holds -- but a
  // 1-tick press is not a human tap either): outside ship/wave each tap is TAP ticks long where that changes nothing in
  // the run (the same path tick for tick); else it stays as short as it must.
  // How long: the user (2026-11-24): "depends probably on the skill, higher skill you have more control over taps, and
  // probably slightly smaller. i would go somewhere 60-90 ms for humans as default ... really depends on the level."
  // So 75 ms by default, by the level's stars when known (1-2: 90, 3-5: 80, 6-7: 75, 8-9: 70, 10+ demons: 60), opts.tapMs
  // overrides (a level's own setting), opts.player "user" plays it as this player (tools/habits.js: median tap 120 ms
  // over 3,675 taps; opts.playerTapMs to pass a newer number). Was 14 ticks (58 ms) for every level.
  const TAP_DEFAULT_MS = 75, USER_TAP_MS = 120;
  const tapMsFor = o => { o = o || {};
    if (o.tapMs) return +o.tapMs;
    if (o.player === "user") return +(o.playerTapMs || USER_TAP_MS);
    const st = +o.stars; if (!st) return TAP_DEFAULT_MS;
    return st <= 2 ? 90 : st <= 5 ? 80 : st <= 7 ? 75 : st <= 9 ? 70 : 60; };
  let TAP = Math.round(TAP_DEFAULT_MS * 0.24);
  function humanTaps(w, ev, path) {
    let cur = ev.slice();
    const same = (p) => p.length === path.length && p.every((q, t) => q.x === path[t].x && q.y === path[t].y && q.mode === path[t].mode);
    for (let i = 0; i < cur.length; i++) {
      if (cur[i].type !== "press") continue;
      const j = cur.findIndex((x, k) => k > i && x.type === "release"); if (j < 0) continue;
      const m = (path[Math.min(cur[i].tick, path.length - 1)] || {}).mode, len = cur[j].tick - cur[i].tick;
      if (HOLDS[m] || len >= TAP) continue;
      const nt = Math.min(cur[i].tick + TAP, cur[j + 1] ? cur[j + 1].tick - 1 : Infinity);
      if (nt <= cur[j].tick) continue;
      const tr = cur.map((x, k) => k === j ? { tick: nt, type: "release" } : x), p2 = GD.run(w, tr).path;
      if (same(p2)) cur = tr;
    }
    return cur;
  }

  // the next n presses (each with its release) after tick t shifted, one by one, by the smallest number of whole
  // frames (up to 32 ticks either way) that lets the run live 1 s past it; then the whole run must finish
  function retimeNext(w, ev, t, n) {
    let cur = ev.slice();
    const idx = cur.map((e, k) => k).filter(k => cur[k].type === "press" && cur[k].tick > t).slice(0, n);
    for (const k of idx) {
      const j = cur.findIndex((x, q) => q > k && x.type === "release");
      let placed = false;
      for (const d of [0, 4, -4, 8, -8, 12, -12, 16, -16, 20, -20, 24, -24, 32, -32]) {
        const tr = cur.map((x, q) => q === k || q === j ? { tick: x.tick + d, type: x.type } : x);
        if (k > 0 && tr[k].tick <= tr[k - 1].tick) continue;
        if (j >= 0 && tr[j + 1] && tr[j].tick >= tr[j + 1].tick) continue;
        const r = GD.run(w, tr);
        if (!r.dead || r.path.length - 1 > tr[k].tick + 240) { cur = tr; placed = true; break; }
      }
      if (!placed) return null;
    }
    const p = done(w, cur);
    return p ? { ev: cur, path: p } : null;
  }
  // 8. jumps over nothing that plain dropping could not remove (the later presses then miss): drop it and
  // re-time the next three presses, as a player adjusts. Only for the few pointlessJumps (cost: a few replays each).
  function dropPointless(w, ev, path) {
    let cur = ev.slice();
    for (const pj of pointlessJumps(w, cur)) {
      const i = cur.findIndex(e => e.type === "press" && Math.abs((path[Math.min(e.tick, path.length - 1)] || {}).x - pj.x) < 1);
      if (i < 0) continue;
      const rel = cur.findIndex((x, k) => k > i && x.type === "release");
      const trial = cur.filter((x, k) => k !== i && k !== rel), t = cur[i].tick;
      const p2 = done(w, trial); if (p2) { cur = trial; path = p2; continue; }
      const rt = retimeNext(w, trial, t, 3); if (rt) { cur = rt.ev; path = rt.path; }
    }
    return cur;
  }

  // presses of a route that can go with the run still finishing (tools/score.js warns on them)
  function extraPresses(w, ev) {
    const path = GD.run(w, ev).path, out = [];
    ev.forEach((e, i) => {
      if (e.type !== "press") return;
      const p = path[Math.min(e.tick, path.length - 1)];
      if (!p || HOLDS[p.mode]) return;
      const rel = ev.findIndex((x, j) => j > i && x.type === "release");
      if (rel >= 0 && HOLDS[path[Math.min(ev[rel].tick, path.length - 1)].mode]) return;
      const q = GD.run(w, ev.filter((x, j) => j !== i && j !== rel)), end = q.end;
      if (!q.dead && (q.done || end.x >= w.endX)) out.push({ tick: e.tick, x: p.x, mode: p.mode });
    });
    return out;
  }

  // free space ahead of x: [floor, ceiling] around y, from the level's solids, hazards and slopes.
  // A slope counts by its surface at x, not its box (the user on a wave corridor of 45-degree slopes, 2026-11-25: "really
  // unnatural ... these corridors should be just few holds and releases": with slopes as full squares the corridor's
  // middle went up and down in steps, and the controller corrected at every step)
  function slopeY(b, x) {
    const px = Math.max(b.x0, Math.min(b.x1, x));
    if (b.ceil) return b.down > 0 ? b.y1 - (px - b.x0) * b.rise : b.y1 - (b.x1 - px) * b.rise;
    return b.up > 0 ? b.y0 + (px - b.x0) * b.rise : b.y0 + (b.x1 - px) * b.rise;
  }
  function freeAt(boxes, s, x) {
    let lo = s.floorY || 0, hi = isFinite(s.ceilY) ? s.ceilY : (s.floorY || 0) + 300;
    for (const b of boxes) {
      if (b.x1 < x - 10 || b.x0 > x + 10) continue;
      if (b.kind === "slope" && b.rise != null) {
        const y = slopeY(b, x);
        if (b.ceil) { if (y >= s.y - 4 && y < hi) hi = y; } else if (y <= s.y + 4 && y > lo) lo = y;
        continue;
      }
      if (b.y1 <= s.y + 4 && b.y1 > lo) lo = b.y1;
      if (b.y0 >= s.y - 4 && b.y0 < hi) hi = b.y0;
    }
    return [lo, hi];
  }
  // the walls a flying player steers between: the sim's own items (scaled, No Touch left out; slopes with their surface)
  function flyBoxes(w, objects) {
    if (w && w.items) return w.items.filter(b => b.kind === "solid" || b.kind === "hazard" || b.kind === "slope");
    return (objects || []).map(o => ({ d: GD.objInfo(o.id), hb: GD.hitbox(o) }))
      .filter(b => b.hb && (b.d.kind === "solid" || b.d.kind === "hazard" || b.d.kind === "slope")).map(b => b.hb);
  }

  // run from a state with a held[] array up to tick `until`; returns the state (dead or not)
  function simFrom(w, s0, held, from, until) {
    const s = clone(s0);
    for (let t = from; t < until && !s.dead && !s.done; t++) GD.step(w, s, { press: held[t] && !(t ? held[t - 1] : false), held: held[t] });
    return s;
  }
  // After inputs up to `from` changed, re-time the later inputs one by one: shift each by the
  // smallest number of ticks that lets the run live until the next input (+1/4 s). A player
  // adjusts to where they actually are; the solver's ticks assumed the old path.
  function retime(w, held, path0, from, total) {
    const ev = toEvents(held.slice(from)).map(e => ({ tick: e.tick + from, type: e.type }));
    // the state at `from` under the new inputs
    let s = simFrom(w, GD.startState(w), held, 0, from);
    if (s.dead) return null;
    const out = held.slice(0, from);
    let t = from, h = held[from - 1] || false;
    const shifts = [0]; for (let d = 1; d <= 36; d++) shifts.push(d, -d);
    for (let i = 0; i < ev.length; i++) {
      const e = ev[i], next = i + 1 < ev.length ? ev[i + 1].tick : total;
      let placed = false;
      for (const d of shifts) {
        const at = e.tick + d;
        if (at < t) continue;
        const trial = out.slice();
        for (let k = t; k < at; k++) trial[k] = h;
        const h2 = e.type === "press";
        for (let k = at; k < Math.max(at + 1, next + d); k++) trial[k] = h2;
        const until = Math.min(total, Math.max(at + 1, next + d) + 60);
        const st = simFrom(w, s, trial.concat(new Array(Math.max(0, until - trial.length)).fill(h2)), t, until);
        if (!st.dead) {
          for (let k = t; k < at; k++) out[k] = h;
          s = simFrom(w, s, trial, t, at);
          t = at; h = h2; placed = true; break;
        }
      }
      if (!placed) { if (DEBUG) console.log("  retime: no shift works for", e.type, "at tick", e.tick); return null; }
    }
    for (let k = t; k < total; k++) out[k] = h;
    return out;
  }

  // how a route flies a stretch of ticks [a, b): presses in it, and ticks within NEAR units of a solid or
  // hazard above or below while airborne (the user on GDLM 45's wave: "way too many clicks ... way too close
  // to the borders. these waves can be cleared in their native pattern")
  const NEAR = 12;
  // the player's half size as the sim's hitbox (physics.js halfOf): the wave's is 5 (mini 3), not the cube's 15 -- with 15 a
  // wave in a 3-row corridor counted as near a wall all the way, and a clean corridor line lost to a jittery one
  const halfSize = s => s.mode === "wave" ? (s.mini ? 3 : 5) : s.mode === "spider" ? (s.mini ? 8.1 : 13.5) : s.mini ? 9 : 15;
  function clearance(boxes, s) { const [lo, hi] = freeAt(boxes, s, s.x), h = halfSize(s); return Math.min(s.y - h - lo, hi - s.y - h); }
  // a wave sliding along a flat floor or roof (a wave always moves at 45 degrees, so vertical speed 0 is a slide: on a
  // block's face, lib/physics.js waveOn, or the band's floor / roof). It is safe while it lasts -- the sim kills a wave
  // sliding off a block's end and one flying head-on into a slope (both calibrated) -- and it needs no press. The user,
  // 2026-11-25: "many places wave avoids ground but probably in many of them we can slide on it avoiding the clicks in the
  // middle". So a slide is never a "near a wall" tick, and the wave planner counts it as no stray.
  const sliding = st => st.mode === "wave" && st.vy === 0 && !st.dead;
  function stretchCost(boxes, ev, path, a, b) {
    let close = 0;
    // riding the floor or the roof counts as close too (clearance 0): the user's Stereo Madness ship riding the
    // floor and the roof under hanging spikes
    for (let t = a; t < b && t < path.length; t++) if (!sliding(path[t]) && (path[t].grounded || clearance(boxes, path[t]) < NEAR)) close++;
    return { close, presses: ev.filter(e => e.type === "press" && e.tick >= a && e.tick < b).length };
  }
  // a wave corridor's own turns between ticks a and b: its middle changing direction by 20+ units (a person's wave changes
  // button about once per turn: "follow the pattern of the level", the user, 2026-11-25); routeCheck's offPattern and fly()
  function waveTurns(boxes, path, a, b) {
    let turns = 0, dir = 0, ext = null;
    for (let u = a; u < b && u < path.length; u += 8) {
      const [lo, hi] = freeAt(boxes, path[u], path[u].x); if (hi - lo > 280) continue;   // open air: no corridor
      const c = (lo + hi) / 2;
      if (ext === null) { ext = c; continue; }
      if (dir === 0) { if (c > ext + 20) { dir = 1; ext = c; } else if (c < ext - 20) { dir = -1; ext = c; } continue; }
      if (dir > 0) { if (c > ext) ext = c; else if (c < ext - 20) { turns++; dir = -1; ext = c; } }
      else if (c < ext) ext = c; else if (c > ext + 20) { turns++; dir = 1; ext = c; }
    }
    return turns;
  }
  // ticks near a wall in every flying stretch from tick a to the end (a stretch's new line re-solves the rest of the level,
  // which must not get worse either: GDLM 44's first try took a patterned stretch and rode the walls after it, 0 -> 518 ticks)
  function flyCloseFrom(boxes, path, a) {
    let n = 0;
    for (let t = a; t < path.length; t++) if (FLY[path[t].mode] && !sliding(path[t]) && (path[t].grounded || clearance(boxes, path[t]) < NEAR)) n++;
    return n;
  }
  // inputs off the corridor's pattern: beyond its turns + 2, and only as many as there are quick re-presses (a leg under
  // 150 ms): a wave in open air or over hills with half-second legs follows its own pattern even with few corridor turns
  // (GDLM 52's waves: 22 inputs for 6 counted turns, every leg ~500 ms)
  function offPattern(ins, turns) {
    const quick = ins.filter((e, i) => i > 0 && e.tick - ins[i - 1].tick < 36).length;
    return Math.max(0, Math.min(ins.length - (turns + 2), quick));
  }
  const cleaner = (p, q) => p.close !== q.close ? p.close < q.close : p.presses < q.presses;

  // The wave planner (the user, 2026-11-25, on a wave corridor of 45-degree slopes: "these corridors should be just few
  // holds and releases. in tighter corridors we will need to fly tighter but in general we want to follow the pattern of
  // the level"). It plans WAVE_LOOK units ahead: keep the button, switch it once, or switch it twice, at any frames, and
  // takes the plan that strays least out of the corridor's comfortable middle (the middle of the free space, less
  // WAVE_MARGIN from each wall: a wide corridor leaves room to hold on, a tight one asks for a tight line), counting
  // WAVE_SWITCH per switch. It follows that plan and plans again at each switch and every 16 ticks, so each leg runs until
  // the corridor turns: one input per leg of the corridor. (One switch per plan was not enough: the plan could not see
  // the next turn coming back, and rode the floor of tight corridors.)
  const WAVE_LOOK = 150, WAVE_MARGIN = 45, WAVE_SWITCH = 6;
  function waveLine(w, near, s0, h0, a, b, held, total) {
    let s = clone(s0), h = h0, t = a;
    const dev = st => {
      if (sliding(st)) return 0;   // sliding along a floor or roof is a rest, not a stray (the user, 2026-11-25)
      const [lo, hi] = freeAt(near, st, st.x), half = halfSize(st);
      const room = (hi - lo) / 2 - half, comfort = Math.max(0, room - WAVE_MARGIN);
      return Math.max(0, Math.abs(st.y - (lo + hi) / 2) - comfort);
    };
    // one button held for n ticks from st0: cum[i] = the strays summed over the first i ticks, alive = ticks survived,
    // sts[k] = the state at tick 4k (only when asked)
    const line = (st0, hh, prev, n, keep) => {
      const q = clone(st0), cum = new Float64Array(n + 1), sts = keep ? [] : null; let alive = n, p = prev;
      for (let i = 0; i < n; i++) {
        if (sts && i % 4 === 0) sts.push(clone(q));
        GD.step(w, q, { press: hh && !p, held: hh }); p = hh;
        if (q.dead) { alive = i; for (let k = i + 1; k <= n; k++) cum[k] = cum[i]; break; }
        if (q.done || q.mode !== "wave") { for (let k = i + 1; k <= n; k++) cum[k] = cum[i]; if (sts) while (sts.length * 4 <= n) sts.push(clone(q)); break; }
        cum[i + 1] = cum[i] + dev(q);
      }
      return { cum, alive, sts };
    };
    const planFrom = (st, T) => {
      const keep = line(st, h, h, T, true);
      const score = (sum, survived, k) => survived < T ? 1e6 - survived : sum / T + k * WAVE_SWITCH;
      let best = { c: score(keep.cum[T], keep.alive, 0), sw: [] };
      for (let s1 = 0; s1 < T && s1 <= keep.alive; s1 += 4) {
        const L1 = line(keep.sts[s1 / 4], !h, h, T - s1, true), n1 = T - s1;
        const c1 = score(keep.cum[s1] + L1.cum[n1], s1 + L1.alive, 1);
        if (c1 < best.c - 1e-9) best = { c: c1, sw: [s1] };
        for (let d = 16; d < n1 && d <= L1.alive; d += 8) {
          const L2 = line(L1.sts[d / 4], h, !h, n1 - d, false);
          const c2 = score(keep.cum[s1] + L1.cum[d] + L2.cum[n1 - d], s1 + d + L2.alive, 2);
          if (c2 < best.c - 1e-9) best = { c: c2, sw: [s1, s1 + d] };
        }
      }
      return best.sw;
    };
    let plan = null, planned = -1e9;
    for (; t < total && !s.dead && !s.done && s.mode === "wave"; t++) {
      if (t % 4 === 0 && (plan === null || t - planned >= 16 || (plan.length && plan[0] === t))) {
        const sp = GD.SPEEDS[s.sp] || GD.SPEEDS[1], T = Math.max(48, Math.min(200, 4 * Math.round(WAVE_LOOK / sp.x)));
        plan = planFrom(s, T).map(d => t + d); planned = t;
      }
      if (plan && plan.length && plan[0] === t) { h = !h; plan.shift(); plan = plan.length ? plan : []; planned = -1e9; }
      held[t] = h;
      GD.step(w, s, { press: h && !(t ? held[t - 1] : false), held: h });
    }
    return { s, t, h };
  }

  // 3. fly each flying stretch with a controller; keep it if the whole level still finishes and it
  // flies the stretch cleaner than the route it replaces (the solver's sweep already ranks routes by
  // distance from walls, then presses: its wave legs are often the native one-press-per-leg zigzag),
  // re-timing the inputs after it
  function fly(w, ev, objects) {
    const boxes = flyBoxes(w, objects);
    let cur = ev;
    let path = done(w, cur);
    if (!path) return ev;
    const spansOf = p => { const sp = []; for (let t = 0; t < p.length; t++) { if (!FLY[p[t].mode]) continue; const a = t; while (t < p.length && FLY[p[t].mode]) t++; sp.push([a, t]); } return sp; };
    const nSpans = spansOf(path).length;
    for (let si = 0; si < nSpans && !over(); si++) {
      const [a, b] = spansOf(path)[si] || [];
      if (a == null) break;
      if (WIN && (b < WIN[0] || a > WIN[1])) continue;
      let best = null;
      // the stretch's boxes once (the tube below looks at many x per tick)
      const xa = path[a] ? path[a].x - 60 : 0, xb = (path[Math.min(b, path.length - 1)] || {}).x + 600;
      const near = boxes.filter(q => q.x1 >= xa && q.x0 <= xb);
      // Look-ahead "tube" (the user on Stereo Madness's ship: "it's unnatural to wait so late and fly up ...
      // much more natural ... flying somewhat straight through the paths"): the target height is the middle of
      // the free space averaged over the next L units, so climbs and dives start early and smoothly, and is
      // kept inside the free space just ahead with a margin. L is tried at 240 (8 blocks), 150 and 360.
      const tube = (st, x, L) => {
        let sum = 0, n = 0;
        for (let d = 30; d <= L; d += 15) { const [l, hh] = freeAt(near, st, x + d); sum += (l + hh) / 2; n++; }
        return sum / n;
      };
      // the ship keeps each button state at least DWELL ticks (a person holds ~280 ms and lets go ~300 ms: tools/habits.js,
      // tools/shipstyle.js on the user's runs, 2026-11-24): the bang-bang steering with no dwell flew the ship in 4-6
      // presses a second, most of them taps under 75 ms ("the solver ship moves weirdly"). Longest dwell first; an early
      // switch only when the ship would otherwise leave the free space within 8 ticks. Other modes: no dwell.
      const shipHere = path.slice(a, b).some(q => q.mode === "ship");
      const tries = [];
      for (const dwell of shipHere ? [40, 28, 18, 0] : [0]) for (const [k, L] of [[16, 240], [16, 150], [16, 360], [10, 0], [6, 0]]) tries.push([k, L, dwell]);
      // a stretch that is all wave is first flown by the wave planner: long legs that follow the corridor (waveLine)
      const waveAll = path.slice(a, b).every(q => q.mode === "wave");
      // the solver's line off the corridor's pattern: then the wave planner's line wins on the pattern alone (patterned below);
      // otherwise it competes like any other line (GDLM 64: its line kept off the walls, 211 -> 68 ticks, same presses)
      const offNow = waveAll && offPattern(cur.filter(e => e.tick >= a && e.tick < b), waveTurns(boxes, path, a, b)) > 0;
      if (waveAll) tries.unshift(["wave"]);
      for (const [k, L, dwell] of tries) {
        if (over()) break;
        const total = path.length + 600;
        const held = heldOf(cur, total), orig = held.slice();
        let s = clone(path[a]);
        let h = held[Math.max(0, a - 1)], t = a, lastSw = -1e9;
        if (k === "wave") { const r = waveLine(w, near, s, h, a, b, held, total); s = r.s; t = r.t; h = r.h;
          if (DEBUG === "2") { const q = clone(path[a]); for (let u = a; u < t; u++) { GD.step(w, q, { press: held[u] && !held[u - 1], held: held[u] }); if (u % 8 === 0) { const [lo, hi] = freeAt(near, q, q.x); console.log("  wave", (q.x / 30).toFixed(1), "y", q.y.toFixed(0), "free", lo.toFixed(0), hi.toFixed(0), held[u] ? "UP" : "dn"); } } } }
        else for (; t < total && !s.dead && !s.done && (FLY[s.mode] || t < b); t++) {
          if (!FLY[s.mode] || (!GD.solveFrom && t >= b - 24)) { h = orig[t]; }   // the last 0.1 s: the solver's own button, to hand over cleanly
          else {
            const sp = GD.SPEEDS[s.sp] || GD.SPEEDS[1];
            const [lo, hi] = freeAt(near, s, s.x + sp.x * k);
            // steer for the middle of the room ahead; in the last 1/2 s before the stretch ends,
            // for the solver's own line, so the hand-over to the next part is where its plan expects
            // without solveFrom, the last 1/2 s steers for the solver's own line so its later inputs fit
            // the last 1/2 s before the stretch ends steers for the solver's own line, so the next part starts
            // where a plan exists (with solveFrom too: Stereo Madness's ship left the player where nothing
            // could finish the level)
            const late = t >= b - 120 && path[Math.min(path.length - 1, t + k)];
            let want = (lo + hi) / 2;
            if (L) { const m = Math.min(24, (hi - lo) / 2 - 1); want = Math.max(lo + m, Math.min(hi - m, tube(s, s.x, L))); }
            const ship = s.mode === "ship" && dwell > 0;
            const mid = late ? path[Math.min(path.length - 1, t + k)].y : want, g = s.grav || 1, band = s.mode === "wave" ? 12 : ship ? 8 : 3; // wave: a wide dead band, no flicker at the turns
            const err = (mid - (s.y + (s.mode === "wave" ? 0 : s.vy * k * 0.25))) * g;
            let nh = h;
            if (err > band) nh = true; else if (err < -band) nh = false;   // a dead band: no chatter
            if (ship && nh !== h && t - lastSw < dwell) {
              const half = s.mini ? 9 : 15, py = s.y + s.vy * 8;   // switch early only to stay inside the room
              if (!(py - half < lo + 2 || py + half > hi - 2)) nh = h;
            }
            if (nh !== h) lastSw = t;
            h = nh;
          }
          held[t] = h;
          GD.step(w, s, { press: h && !(t ? held[t - 1] : false), held: h });
        }
        if (s.dead) { if (DEBUG) console.log("fly", si, "k", k, "dies in the stretch at", (s.x / 30).toFixed(1), s.why); continue; }
        if (DEBUG && k === "wave") console.log("fly", si, "wave planner reached block", (s.x / 30).toFixed(1), "mode", s.mode, "presses", toEvents(held.slice(a, t)).filter(e => e.type === "press").length);
        // the rest of the level from where the controller left the player (lib/physics.js
        // solveFrom); fall back to re-timing the old inputs if the solver finds nothing
        let trial = null;
        if (GD.solveFrom && GOAL === null) {   // an unbeaten level: the solver found no finish, re-time instead
          try {
            // with a window: stop as soon as the search is back on the current route (its exact state and
            // button at a tick past the window), and keep the current route from there
            const goal = WIN ? rejoinGoal(w, cur, path, Math.max(t, WIN[1])) : null;
            const rest = GD.solveFrom(w, s, goal ? { held: h, goal } : { held: h });
            if (rest && rest.ok) trial = toEvents(held.slice(0, t)).concat(
              (h ? [] : []), rest.events.filter(e => e.tick >= t && (rest.goalTick == null || e.tick < rest.goalTick)),
              rest.goalTick != null ? cur.filter(e => e.tick >= rest.goalTick) : []);
            // the button state must carry over: toEvents ends with h; the rest starts from held = h
          } catch (e) { if (DEBUG) console.log("solveFrom failed:", e.message); }
        }
        if (!trial) {
          const re = retime(w, held, path, t, total);
          if (!re) { if (DEBUG) console.log("fly", si, "k", k, "no plan after tick", t, "block", (s.x / 30).toFixed(1)); continue; }
          trial = toEvents(re);
        }
        const p2 = done(w, trial);
        if (p2) { best = { trial, p2, wave: k === "wave" }; if (DEBUG) console.log("fly", si, "line from try", k, L, dwell); break; }
      }
      if (best) {
        const now = stretchCost(boxes, cur, path, a, b), then = stretchCost(boxes, best.trial, best.p2, a, b);
        if (DEBUG) console.log("fly", si, "solver", JSON.stringify(now), "controller", JSON.stringify(then));
        // the lower human cost wins; the wall/press count decides when the cost is not available or ties
        const skipT = GD.skipCheck ? GD.skipCheck(w, best.p2, best.trial) : null;
        if (DEBUG && skipT) console.log("fly", si, "controller route skips", skipT.skipped);
        const cNow = humanCost(w, cur), cThen = !skipT ? humanCost(w, best.trial) : Infinity;
        if (DEBUG) console.log("fly", si, "humanCost solver", cNow, "controller", cThen);
        // a ship stretch also wins on smoothness: a quarter fewer presses for at most 15% more human cost (the solver's
        // own ship line was often the cheaper one by humanCost while flying in jitter taps)
        const smoother = shipHere && then.presses <= now.presses * 0.75 && (cNow == null || cThen == null || cThen <= cNow * 1.15 + 1e-6);
        // a wave stretch flown by the wave planner wins when it needs no more presses and keeps off the walls about as well
        // (the user, 2026-11-25: "we want to follow the pattern of the level, and here its hold and release in the corridors")
        // and only where the solver's line is off the pattern (more inputs than the corridor's turns + 2), with the rest of
        // the route no closer to the walls than before
        const patterned = best.wave && offNow && then.presses <= now.presses && then.close <= now.close + 24 &&
          flyCloseFrom(boxes, best.p2, a) <= flyCloseFrom(boxes, path, a) + 24 &&
          (cNow == null || cThen == null || cThen <= cNow * 1.3 + 1e-6);
        // and a flying stretch never takes a jittery controller line over the solver's own: over 2.5 presses a second (the user
        // flies 1.5-1.7) and more presses than the line it replaces (Time Machine 354-431: the solver's 6 presses riding the
        // floor and roof lost to the no-dwell controller's 40, on humanCost alone)
        // The same for every flying mode (GDLM 64's wave: a k-10 controller line with 35 presses for the solver's 13 won on
        // 20 fewer near-wall ticks, 39 legs under 100 ms)
        const jittery = then.presses > now.presses && then.presses / Math.max(1e-9, (b - a) / 240) > 2.5;
        // timing before presses (the user, 2026-11-25): a line never wins on fewer presses or smoothness when its tightest
        // window is under EASY_MS and tighter than the line it replaces; and a line with up to two more presses wins when
        // it turns a tight window (under EASY_MS) into one at least half as wide again
        let wNow = null, wThen = null;
        const timing = () => { if (wNow === null) { wNow = tightestMs(w, cur, a, b); wThen = tightestMs(w, best.trial, a, b); } return wNow != null && wThen != null; };
        const tighter = () => timing() && wThen < EASY_MS && wThen < wNow - 4;
        const easier = !skipT && then.presses <= now.presses + 2 && timing() && wNow < EASY_MS && wThen >= wNow * 1.5 && then.close <= now.close + 24;
        let take = easier || (patterned || !jittery && (smoother || (cNow != null && cThen != null && Math.abs(cThen - cNow) > 1e-6 ? cThen < cNow : cleaner(then, now))));
        if (take && !easier && tighter()) take = false;
        if (DEBUG && wNow !== null) console.log("fly", si, "tightest window solver", wNow, "ms, new line", wThen, "ms", easier ? "(easier: taken)" : take ? "" : "(kept the solver's)");
        if (take) { cur = best.trial; path = best.p2; }
      }
    }
    return cur;
  }

  // 4. click where a person would: the solver's taps sit wherever the search left them, often the
  // last safe frame, so the replay looked like a near miss every time (the user on GDLM 45's ball,
  // "the clicks are too close to death ... i would prefer to click way earlier"). Each tap (press
  // and its release together, outside ship/wave holds) is moved whole frames (4 ticks; Click Between
  // Steps is off) earlier and later while the whole run still finishes; it goes EARLY_AT of the way
  // into that window from its early edge. Left to right, so each later window is measured with the
  // earlier taps already moved. Cost: a replay per frame tried, stopping at each edge.
  let PLANNED = null;   // planned press ticks for this plan (naturalPlan opts.planned)
  const EARLY_AT = 0.4, REACH = 48, LOOK = 720;   // REACH: frames looked at each way (0.8 s); LOOK: 3 s
  const HOLDY = { ship: 1, wave: 1 };
  function early(w, ev, path) {
    let cur = ev.slice();
    for (let i = 0; i < cur.length && !over(); i++) {
      if (cur[i].type !== "press" || !inWin(cur[i].tick)) continue;
      const p = path[Math.min(cur[i].tick, path.length - 1)];
      if (!p || HOLDY[p.mode]) continue;
      const j = cur.findIndex((x, k) => k > i && x.type === "release");
      const lo = i > 0 ? cur[i - 1].tick + 1 : 0, hi = (j >= 0 && cur[j + 1] ? cur[j + 1].tick : Infinity) - 1;
      const shifted = d => { const c = cur.map(e => Object.assign({}, e)); c[i].tick += d; if (j >= 0) c[j].tick += d; return c; };
      const fits = d => cur[i].tick + d >= lo && (j < 0 ? cur[i].tick + d : cur[j].tick + d) <= hi;
      // a shift is tried from the saved state just before it, for LOOK ticks after the tap (the whole
      // run is checked once at the end): a full replay per frame tried cost 72 s on GDLM 45
      const lives = d => {
        const c = shifted(d), t0 = Math.max(0, Math.min(cur[i].tick, c[i].tick) - 1), end = Math.max(cur[i].tick, c[i].tick) + LOOK;
        if (t0 >= path.length) return false;
        const held = heldOf(c, end + 1), s = clone(path[t0]);
        for (let t = t0; t < end && !s.dead && !s.done; t++) GD.step(w, s, { press: held[t] && !(t ? held[t - 1] : false), held: held[t] });
        return !s.dead;
      };
      let a = 0, b = 0;
      while (a > -REACH * 4 && fits(a - 4) && lives(a - 4)) a -= 4;
      while (b < REACH * 4 && fits(b + 4) && lives(b + 4)) b += 4;
      let d = a + Math.round((b - a) * EARLY_AT / 4) * 4;
      // a press the build planned (opts.planned: the level's own beat/press plan, BUILDING.md section 2) goes on
      // its planned tick when that tick is inside the window: the route presses where the level was designed to
      if (PLANNED) { const t0 = cur[i].tick, near = PLANNED.filter(pt => pt >= t0 + a && pt <= t0 + b).sort((x, y) => Math.abs(x - t0) - Math.abs(y - t0))[0];
        if (near != null) d = near - t0; }
      if (d !== 0) { const c = shifted(d); const p2 = done(w, c); if (p2) { cur = c; path = p2; } }
    }
    return cur;
  }

  // the search may stop when it is in the current route's exact state (lib/incsolve.js sameState) with the
  // same button, at a tick after `after`
  function rejoinGoal(w, cur, path, after) {
    const INC = OUT.incsolve || (typeof require !== "undefined" ? (() => { try { return require("./incsolve.js").incsolve; } catch (e) { return null; } })() : null);
    if (!INC) return null;
    const held = heldOf(cur, path.length + 1);
    return (st, h) => st.tick > after && st.tick < path.length && h === held[st.tick - 1] && INC.sameState(INC.canon(w, st), INC.canon(w, path[st.tick]));
  }
  // opts.cost: judge route choices by lib/difficulty.js humanCost (slow; tools/solutions.js uses it)
  function naturalPlan(w, sol, objects, opts) {
    if (!sol || !sol.events || !sol.events.length) return null;
    GOAL = sol.ok ? null : GD.run(w, sol.events).end.x;
    USE_COST = !!(opts && opts.cost); costCache.clear(); WIN = (opts && opts.window) || null;
    // opts.planned: seconds from the level start (tools/planned.js) -> ticks
    PLANNED = opts && opts.planned && opts.planned.length ? opts.planned.map(t => Math.round(t * 240)) : null;
    TAP = Math.max(1, Math.round(tapMsFor(opts) * 0.24));
    // opts.budgetMs: a time budget; past it the optional passes are skipped and fly / early stop where they are (the route
    // so far still finishes). Fingerdash's viewer route (a 6.7 s replay: 256 triggers fired) ran 36+ min (2026-11-24)
    DEADLINE = opts && opts.budgetMs ? Date.now() + opts.budgetMs : Infinity;
    LAST = null;
    try { return plan(w, sol, objects); }
    catch (e) { if (e !== BUDGET) throw e; return LAST; }   // out of time inside a pass: the last route plan() had checked (at worst the solver's own)
    finally { LAST = null; DEADLINE = Infinity; GOAL = null; USE_COST = false; costCache.clear(); WIN = null; PLANNED = null; TAP = Math.round(TAP_DEFAULT_MS * 0.24); }
  }
  let DEADLINE = Infinity, LAST = null;
  const BUDGET = new Error("natural: time budget spent");
  const over = () => Date.now() > DEADLINE;
  function plan(w, sol, objects) {
    let ev = sol.events.slice();
    let path = finishes(w, ev);   // the solver's own route: the fallback when the budget runs out in the first pass
    if (path) LAST = { events: ev.slice(), path };
    const ok = () => { if (path) LAST = { events: ev, path }; return !over(); };
    if (!path) return null;
    ev = taps(w, ev, path); path = done(w, ev);
    ev = dropEmpty(w, ev, path); path = done(w, ev);
    ev = shortenHolds(w, ev, path); path = done(w, ev);
    if (ok()) ev = fly(w, ev, objects || w.objects || []);
    path = done(w, ev);
    if (path && ok()) { const evm = mergeLegs(w, ev, objects || w.objects || []); const pm = done(w, evm); if (pm) { ev = evm; path = pm; } }
    if (path && ok()) { ev = taps(w, ev, path); path = done(w, ev); ev = dropEmpty(w, ev, path); path = done(w, ev); }
    if (path && ok()) { ev = early(w, ev, path); path = done(w, ev); }
    // moving taps earlier can leave a later one with nothing to do: drop it too
    if (path && ok()) { const ev2 = dropEmpty(w, ev, path); const p2 = done(w, ev2); if (p2) { ev = ev2; path = p2; } }
    if (path && ok()) { const ev3 = shortenHolds(w, ev, path); const p3 = done(w, ev3); if (p3) { ev = ev3; path = p3; } }
    // last: buffer the orb presses (after the holds were shortened: a buffered orb press is a short hold on purpose)
    if (path && ok()) { const ev6 = dropPointless(w, ev, path); const p6 = done(w, ev6); if (p6) { ev = ev6; path = p6; } }
    if (path && ok()) { const ev4 = bufferOrbs(w, ev, path); const p4 = done(w, ev4); if (p4) { ev = ev4; path = p4; } }
    if (path && ok()) { const ev5 = humanTaps(w, ev, path); const p5 = done(w, ev5); if (p5) { ev = ev5; path = p5; } }
    // and once more, last: a hold through several jumps that a later pass made or kept (an orb press buffered into an
    // auto-jump chain, GDLM 44 at 25.85 s: 2.77 s through 5 jumps) becomes taps where the run still finishes
    if (path && ok()) { const ev7 = tapsEach(w, ev, path); const p7 = done(w, ev7); if (p7) { ev = ev7; path = p7; } }
    if (path && ok()) { const ev8 = spreadPresses(w, ev, path); const p8 = done(w, ev8); if (p8) { ev = ev8; path = p8; } }
    // the finished natural route against the solver's own: keep the one with the lower human cost (both finish
    // and skip nothing). The natural passes are rules of thumb; the cost is the measure.
    // Not when the solver's route rides more cube holds over 0.6 s (auto-jump chains): humanCost counts such a hold as
    // one input where the taps are one each, so the raw route won on every dense cube level and was saved as "human"
    // (GDLM 64 v2, 2026-11-24: 14 holds up to 6.5 s, read by score.js as 14-27 block prejumps and a 6 s ending).
    const longHolds = (ev2, p) => { let n = 0; for (let i = 0; i < ev2.length; i++) { const e = ev2[i]; if (e.type !== "press") continue;
      const r = ev2.slice(i + 1).find(x => x.type === "release"), d = (r ? r.tick : p.length) - e.tick;
      if (d > 144 && (p[e.tick] || {}).mode === "cube") n++; } return n; };
    if (path && sol.ok && ok()) {
      const p0 = done(w, sol.events);
      if (p0 && clean(w, sol.events, p0) && longHolds(sol.events, p0) <= longHolds(ev, path)) { const a = humanCost(w, ev), b = humanCost(w, sol.events);
        if (DEBUG) console.log("plan: humanCost natural", a, "solver", b);
        if (a != null && b != null && b < a - 1e-6) return { events: sol.events, path: p0, humanCost: b }; }
    }
    return path ? { events: ev, path } : { events: sol.events, path: GD.run(w, sol.events).path };
  }

  // A release and the next press closer than MIN_GAP ticks (50 ms) is no human double tap (gd-physics2's tools/humanroute.js,
  // 2026-11-24: Clubstep 752/755/756 and ToE2 4788/4791/4792 -- a blue orb's press split from a hold, re-pressed 1 tick
  // later). Each such pair is mended by the first of these that still finishes and skips nothing: hold through (drop the
  // release and the press), the press later (whole frames, up to 0.2 s), the release earlier (down to a 1-tick tap).
  const MIN_GAP = 12;
  function spreadPresses(w, ev, path) {
    let cur = ev;
    for (let i = 0; i + 1 < cur.length; i++) {
      const r = cur[i], p = cur[i + 1];
      if (r.type !== "release" || p.type !== "press" || p.tick - r.tick >= MIN_GAP) continue;
      const tries = [cur.filter((e, j) => j !== i && j !== i + 1)];
      for (let d = MIN_GAP - (p.tick - r.tick); d <= 48; d += 4) if (!cur[i + 2] || p.tick + d < cur[i + 2].tick) tries.push(cur.map((e, j) => j === i + 1 ? Object.assign({}, e, { tick: p.tick + d }) : e));
      const pr = cur[i - 1];
      for (let t = p.tick - MIN_GAP; t > (pr ? pr.tick : -1); t -= 4) tries.push(cur.map((e, j) => j === i ? Object.assign({}, e, { tick: t }) : e));
      for (const tr of tries) { const q = done(w, tr); if (q && clean(w, tr, q)) { cur = tr; i = Math.max(-1, i - 2); break; } }
    }
    return cur;
  }

  // 3b. wave legs, merged (polish on GDLM 44 hellgate, 2026-11-24: the controller's middle-of-the-tube steering split the
  // climbing 45-degree leg of a 5-row corridor into 5 presses with 8-19 tick gaps -- "5 legs under 100 ms", 202 ticks
  // near a wall -- where one press per leg flies it: 2 presses, 21 ticks near a wall). Per wave stretch: take out a
  // release and the press after it (or a press and its release), then nudge the stretch's other inputs (whole frames,
  // up to 0.2 s) until the run finishes again; keep it when the stretch has fewer short legs, then fewer ticks near a
  // wall, then fewer presses. Repeats while it helps.
  const MERGE_MS = 15000;
  function mergeLegs(w, ev, objects) {
    const boxes = flyBoxes(w, objects || w.objects);
    let cur = ev, path = done(w, cur);
    if (!path) return ev;
    const waves = p => { const sp = []; for (let t = 0; t < p.length; t++) { if (p[t].mode !== "wave") continue; const a = t; while (t < p.length && p[t].mode === "wave") t++; sp.push([a, t]); } return sp; };
    const cost = (e2, p2, a, b) => { const ins = e2.filter(e => e.tick >= a && e.tick < b), c = stretchCost(boxes, e2, p2, a, b);
      const short = ins.filter((e, i) => i > 0 && e.tick - ins[i - 1].tick < 24).length; return short * 1000 + c.close * 10 + c.presses; };
    // bounded (a whole-level replay per trial: an unbounded search held the heavy slot for 2 h over every saved route):
    // only the two inputs either side of the merged pair are nudged, and the level gets MERGE_MS in all
    const n0 = waves(path).length, until = Date.now() + MERGE_MS;
    for (let si = 0; si < n0 && Date.now() < until; si++) {
      for (let round = 0; round < 8; round++) {
        const [a, b] = waves(path)[si] || [];
        if (a == null || (WIN && (b < WIN[0] || a > WIN[1]))) break;
        const base = cost(cur, path, a, b);
        if (base < 1000) break;                       // no short leg left: the controller's line stands
        const idx = cur.map((e, i) => i).filter(i => cur[i].tick >= a && cur[i].tick < b);
        let best = null;
        for (let j = 0; j + 1 < idx.length && Date.now() < until; j++) {
          const i1 = idx[j], i2 = idx[j + 1];
          if (cur[i2].tick - cur[i1].tick >= 24) continue;   // only a short leg is merged
          let trial = cur.filter((e, i) => i !== i1 && i !== i2);
          let p2 = done(w, trial), c2 = p2 ? cost(trial, p2, a, b) : Infinity;
          // nudge the stretch's remaining inputs, one at a time, by whole frames
          for (let pass = 0; pass < 3; pass++) {
            let moved = false;
            const ins = trial.map((e, i) => i).filter(i => i >= i1 - 2 && i < i1 + 2 && trial[i].tick > a - 24 && trial[i].tick < b + 24);
            for (const k of ins) for (const d of [-4, 4, -8, 8, -16, 16, -24, 24, -36, 36, -48, 48]) {
              const t2 = trial[k].tick + d;
              if ((trial[k - 1] && t2 <= trial[k - 1].tick) || (trial[k + 1] && t2 >= trial[k + 1].tick)) continue;
              const tr = trial.slice(); tr[k] = Object.assign({}, tr[k], { tick: t2 });
              const p3 = done(w, tr); if (!p3) continue;
              const c3 = cost(tr, p3, a, b);
              if (c3 < c2) { trial = tr; p2 = p3; c2 = c3; moved = true; }
            }
            if (!moved) break;
          }
          if (p2 && c2 < base && (!best || c2 < best.c) && clean(w, trial, p2)) best = { trial, p2, c: c2 };
        }
        if (!best) break;
        if (DEBUG) console.log("mergeLegs", si, base, "->", best.c);
        cur = best.trial; path = best.p2;
      }
    }
    return cur;
  }

  // routeCheck: per flying stretch of a run, its presses, the ticks within NEAR of a wall, and wave legs
  // shorter than 100 ms (a jittered leg: more than one press for one leg of the zigzag); tools/score.js
  function routeCheck(w, ev, objects) {
    const boxes = flyBoxes(w, objects || w.objects);
    const path = GD.run(w, ev).path, out = [];
    for (let t = 0; t < path.length; t++) {
      if (!FLY[path[t].mode]) continue;
      const a = t, mode = path[t].mode; while (t < path.length && path[t].mode === mode) t++;
      const c = stretchCost(boxes, ev, path, a, t), ins = ev.filter(e => e.tick >= a && e.tick < t);
      const short = mode === "wave" ? ins.filter((e, i) => i > 0 && e.tick - ins[i - 1].tick < 24).length : 0;
      // the corridor's own turns: its middle changing direction by 20+ units (a person's wave changes button about once per
      // turn: "follow the pattern of the level", the user, 2026-11-25); offPattern = inputs beyond turns + 2
      const turns = mode === "wave" ? waveTurns(boxes, path, a, t) : 0;
      out.push({ mode, from: path[a].x, to: path[t - 1].x, presses: c.presses, closeTicks: c.close, shortLegs: short,
        inputs: ins.length, turns, offPattern: mode === "wave" ? offPattern(ins, turns) : 0 });
    }
    return out;
  }

  const flyFree = (w, s, x) => freeAt(w._flyBoxes || (w._flyBoxes = flyBoxes(w)), s, x == null ? s.x : x);
  Object.assign(OUT, { flyFree, naturalPlan, mergeLegs, spreadPresses, routeCheck, extraPresses, pointlessJumps, unbufferedOrbs, tapMsFor });
})(typeof module !== "undefined" ? module.exports : (window.GD = window.GD || {}));
