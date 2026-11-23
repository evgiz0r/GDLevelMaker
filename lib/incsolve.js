// Incremental solving: reuse a saved route after an edit, a cut/join or a physics change instead of solving
// the whole level again (PHYSICS.md "Incremental solving"). Works in node and the browser; no file I/O here
// (tools/incsolve.js and tools/solutions.js keep the files).
//
// The pieces:
//   objKey(o)                 an object's identity (all its keys), so two levels can be diffed
//   diffObjects(a, b)         which objects went and came
//   influence(wA, wB, diff)   the x range the changes can touch the player in (moved groups and triggers
//                             included); {none} for decoration-only edits, {full, why} when it cannot tell
//   canon(w, s), sameState()  a state with object indices replaced by object identity: two states compare
//                             equal only when every field is equal (generic: new state fields count too)
//   calm(w, s)                a point to cut a route at: grounded, not dashing, no trigger still acting
//   checkpoints(w, ev, path)  ~1 s apart, each at a calm tick when there is one, canon state + button
//   resolve(...)              the edit re-solve: keep the route up to a calm tick before the change,
//                             search from there (lib/physics.js solveSweep from a state) until the new
//                             run is in the old route's exact state again, splice the old rest back in
(function (OUT) {
  "use strict";
  const GD = (typeof module !== "undefined" && typeof require !== "undefined")
    ? Object.assign({}, require("./objects.js"), require("./physics.js")) : OUT;
  const TPS = 240;

  // ---- identity and diff ----
  function objKey(o) {
    if (o.props) return Object.keys(o.props).sort((a, b) => a - b || (a < b ? -1 : 1)).map(k => k + "=" + o.props[k]).join(",");
    return [o.id, o.x, o.y, o.rot || 0, o.flipX ? 1 : 0, o.flipY ? 1 : 0].join(",");
  }
  // removed: indices in a, added: indices in b, aToB: index in b of each kept object of a (-1 removed)
  function diffObjects(a, b) {
    const pool = new Map();
    b.forEach((o, i) => { const k = objKey(o); if (!pool.has(k)) pool.set(k, []); pool.get(k).push(i); });
    const aToB = new Array(a.length).fill(-1), removed = [], used = new Set();
    a.forEach((o, i) => { const l = pool.get(objKey(o)); if (l && l.length) { aToB[i] = l.shift(); used.add(aToB[i]); } else removed.push(i); });
    const added = []; for (let i = 0; i < b.length; i++) if (!used.has(i)) added.push(i);
    return { removed, added, aToB };
  }

  const groupsOf = o => { const g = o.props && o.props["57"]; return g ? String(g).split(".").map(Number).filter(n => n > 0) : []; };
  // the x range one object of world w can touch the player in, or null (it cannot: decoration nobody moves)
  function reachOf(w, i) {
    const o = w.objects[i], d = GD.objInfo(o.id);
    const trig = w.trig && w.trig.list.find(t => t.i === i);
    if (trig) {
      // a trigger acts where it fires (its x, or its touch box) on its group's objects wherever they go
      let x0 = o.x - 60, x1 = o.x + 60;
      for (const b of w.dyn || []) if (b.groups.includes(trig.group)) { x0 = Math.min(x0, b.reach[0]); x1 = Math.max(x1, b.reach[1]); }
      // a spawn trigger calls other triggers: anything they reach too (one level deep, then give up)
      if (trig.kind === "spawn") return null;   // handled by the caller as "full" (rare in our levels)
      return [x0, x1];
    }
    const it = w.items.find(b => b.i === i);
    if (it) return it.dyn ? [it.reach[0], it.reach[1]] : [it.x0, it.x1];
    // decoration: only matters as a rotate centre (its group is someone's centre) or as a jump mark
    if (groupsOf(o).length && w.trig && w.trig.list.some(t => t.kind === "rotate" && groupsOf(o).includes(t.center))) return [-Infinity, Infinity];
    if (d && (d.kind === "decoration" || d.kind === "unknown" || d.kind === "trigger")) return null;
    return null;
  }
  // the x range the edit can change the run in: [xa, xb] (the player's centre x), { none } or { full, why }
  function influence(wA, wB, diff, headerA, headerB) {
    if ((headerA || "") !== (headerB || "")) return { full: true, why: "the level header changed (start speed, mode, colours...)" };
    let xa = Infinity, xb = -Infinity, n = 0;
    const take = (w, i) => {
      const t = w.trig && w.trig.list.find(q => q.i === i);
      if (t && t.kind === "spawn") return "a spawn trigger changed";
      const r = reachOf(w, i);
      if (!r) return null;
      if (!isFinite(r[0]) || !isFinite(r[1])) return "a changed object moves with the player or is a rotate centre";
      xa = Math.min(xa, r[0]); xb = Math.max(xb, r[1]); n++;
      return null;
    };
    for (const i of diff.removed) { const why = take(wA, i); if (why) return { full: true, why }; }
    for (const i of diff.added) { const why = take(wB, i); if (why) return { full: true, why }; }
    if (wA.endX !== wB.endX) { xa = Math.min(xa, Math.min(wA.endX, wB.endX) - 30); xb = Math.max(xb, Math.max(wA.endX, wB.endX)); n++; }
    if (!n) return { none: true };
    // the player box (15) and near()'s 40-unit look around it
    return { xa: xa - 45, xb: xb + 45 };
  }

  // a short stable hash of an object's identity (canon states hold many; FNV-1a twice, 12 hex)
  function hkey(str) {
    let a = 0x811c9dc5, b = 0x01000193 ^ str.length;
    for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); a = Math.imul(a ^ c, 16777619) >>> 0; b = Math.imul(b + c, 2246822519) >>> 0; }
    return a.toString(16).padStart(8, "0") + (b >>> 16).toString(16).padStart(4, "0");
  }
  const okey = (w, i) => { if (!w._ok) w._ok = new Map(); let k = w._ok.get(i); if (k === undefined) { k = hkey(objKey(w.objects[i])); w._ok.set(i, k); } return k; };
  // ---- states ----
  const TRIG_MAPS = { fired: 1, stopped: 1, offDone: 1, lockAt: 1, paused: 1, psum: 1, tgt: 1, fol: 1, nfire: 1 };
  const SKIP = new Set(["act", "why", "killer", "tp", "trail"]);
  // trigger-keyed state (lib/physics.js / gd-physics2): keys are a trigger index k, or "k.n" for its n-th repeat
  const trigOf = (w, k) => w.trig && w.trig.list[parseInt(k, 10)];
  const trigKey = (w, k) => { const t = trigOf(w, k), n = String(k).split(".")[1]; return (t ? okey(w, t.i) : "k" + k) + (n !== undefined ? "." + n : ""); };
  // only triggers that act on something the player can touch: one moving decoration changes nothing
  const byTrig = (w, m) => { if (!m) return m; const o = {}; for (const k of Object.keys(m)) { const t = trigOf(w, k); if (t && !gameplayTrig(w, t)) continue; o[trigKey(w, k)] = m[k]; } return o; };
  // a state with indices turned into object identity (comparable across two versions of a level); the
  // object list kept in s.used is the near objects step() keeps, so this is exact
  function canon(w, s) {
    const c = {};
    for (const k of Object.keys(s)) {
      if (SKIP.has(k)) continue;
      const v = s[k];
      if (k === "used") c.used = v.map(i => okey(w, i)).sort();
      else if (k === "p2" && v) c.p2 = norm(canon(w, v));   // dual: player 2's own fields (lib/dual.js), its own used list
      else if (TRIG_MAPS[k]) c[k] = byTrig(w, v);
      else if (k === "pend" && v) c.pend = v.filter(([, i]) => !trigOf(w, i) || gameplayTrig(w, trigOf(w, i))).map(([t, i]) => [t, trigKey(w, i)]);
      else if (k === "off" && v) { gameplayTrig(w, { group: -1 }); const o = {}; for (const g of Object.keys(v)) if (w._gp.has(+g)) o[g] = v[g]; c.off = o; }
      else c[k] = v;
    }
    return c;
  }
  function deepEq(a, b) {
    if (a === b) return true;
    if (typeof a === "number" && typeof b === "number") return Number.isNaN(a) && Number.isNaN(b);
    if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const ka = Object.keys(a).filter(k => a[k] !== undefined), kb = Object.keys(b).filter(k => b[k] !== undefined);
    if (ka.length !== kb.length) return false;
    for (const k of ka) if (!deepEq(a[k], b[k])) return false;
    return true;
  }
  // canon states equal; false/"" and missing count the same (a field step() has not set yet)
  const norm = c => { const o = {}; for (const k of Object.keys(c)) { const v = c[k]; if (v === undefined || v === null || v === false || v === "" || v === 0 && k !== "x" && k !== "y" && k !== "vy" && k !== "tick") continue;
    if (v && typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length) continue; if (Array.isArray(v) && !v.length) continue; o[k] = v; } return o; };
  const sameState = (a, b) => deepEq(norm(a), norm(b));
  // where two canon states differ (for reports)
  function stateDiff(a, b) { const A = norm(a), B = norm(b), out = []; for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) if (!deepEq(A[k], B[k])) out.push(k + ": " + JSON.stringify(A[k]) + " vs " + JSON.stringify(B[k])); return out; }

  // does trigger t act on anything the player can touch (a moved or toggled hitbox, or another trigger)?
  function gameplayTrig(w, t) {
    if (!w._gp) { w._gp = new Set(); for (const b of w.dyn || []) for (const g of b.groups) w._gp.add(g);
      for (const b of w.items) for (const g of b.groups || []) if (w.trig.list.some(u => u.kind === "toggle" && u.group === g)) w._gp.add(g);
      for (const u of w.trig.list) for (const g of u.groups) w._gp.add(g); }
    return t.kind === "spawn" || t.kind === "stop" || w._gp.has(t.group);
  }
  // a point a route can be cut at: on the ground, not dashing, no orb flag, and every trigger that fired
  // has finished acting (no pending spawn delay, no move or rotate under way, no lock still following)
  function calm(w, s) {
    if (!s || s.dead || !s.grounded || s.dashing || s.ring || s.onSlope || s.p2) return false;   // never cut in dual
    if (s.pend && s.pend.length) return false;                                                     // a spawn still waiting
    if (s.fired && w.trig) for (const k in s.fired) {
      const t = trigOf(w, k), f = s.fired[k];
      if (!t) continue;
      if (!gameplayTrig(w, t)) continue;   // a trigger that only moves decoration cannot change the run
      if (f > s.tick) return false;
      if (t.dur > 0 && s.tick - f < t.dur && !(s.stopped && s.stopped[k] !== undefined)) return false;
      if (s.paused && s.paused[k]) return false;
      if (t.kind === "toggle" && !(s.offDone && s.offDone[k])) return false;
    }
    return true;
  }
  const heldArray = (ev, n) => { const h = new Array(n).fill(false); const e = ev.slice().sort((a, b) => a.tick - b.tick); let cur = false, i = 0;
    for (let t = 0; t < n; t++) { while (i < e.length && e[i].tick === t) { cur = e[i].type === "press"; i++; } h[t] = cur; } return h; };
  // the button before tick t (what step t-1 was given)
  const heldBefore = (ev, t) => { let h = false; for (const e of ev.slice().sort((a, b) => a.tick - b.tick)) { if (e.tick >= t) break; h = e.type === "press"; } return h; };

  // checkpoints along a route: about every `every` seconds, at the first calm tick in the next half second
  // (else exactly there): [tick, held (button down going into this tick), canon state]
  function checkpoints(w, events, path, opts) {
    const every = Math.round(((opts && opts.every) || 1) * TPS), out = [];
    const held = heldArray(events, path.length + 1);
    for (let t = 0; t < path.length; t += every) {
      let c = t; for (let k = t; k < Math.min(path.length, t + every / 2); k++) if (calm(w, path[k])) { c = k; break; }
      if (!path[c] || path[c].dead) break;
      out.push([c, c > 0 ? held[c - 1] : false, norm(canon(w, path[c]))]);
    }
    return out;
  }

  // run events from a state (absolute ticks), path by tick
  function runFrom(w, s0, held0, events, maxTick) {
    const ev = new Map(); for (const e of events) ev.set(e.tick, e.type);
    const s = Object.assign({}, s0); s.used = s0.used.slice();
    const path = []; path[s.tick] = Object.assign({}, s);
    const max = maxTick || Math.ceil((w.endX / (GD.SPEEDS[0].x * 60) + 5) * TPS);
    let h = held0;
    while (!s.dead && !s.done && s.tick < max) {
      const e = ev.get(s.tick); let press = false;
      if (e === "press") { press = true; h = true; } else if (e === "release") h = false;
      GD.step(w, s, { press, held: h });
      const c = Object.assign({}, s); c.used = s.used.slice(); path[s.tick] = c;
    }
    return { path, end: s };
  }
  const finishes = (w, r) => r.done || (!r.dead && r.end && r.end.x >= w.endX);

  // ---- the edit re-solve ----
  // wNew: the edited level's world. base: { events, path?: the old route's path in the OLD world (every tick
  // a rejoin candidate), wOld?: its world (to canon that path), checkpoints?: saved canon states (sparse
  // rejoin candidates when the old level is gone) }. inf: influence() of the edit.
  // opts.solve(w, start, held, goal) -> a solveSweep-like result (default GD.solveSweep with opts.goal).
  // Returns { ok, events, from, to, rejoined, backoff, ms, why } or { fallback: why } (then solve it whole).
  function resolve(wNew, base, inf, opts) {
    opts = opts || {};
    const t0 = Date.now(), Eold = base.events.slice().sort((a, b) => a.tick - b.tick);
    if (inf.full) return { fallback: inf.why };
    const rN = GD.run(wNew, Eold), pathN = rN.path;
    if (inf.none) {
      if (finishes(wNew, rN) && (!GD.skipCheck || !GD.skipCheck(wNew, pathN, Eold))) return { ok: true, events: Eold, reused: "whole", ms: Date.now() - t0 };
      return { fallback: "only decoration changed, yet the old route no longer finishes (influence missed something)" };
    }
    // the reference states the new route may rejoin: by tick
    const ref = new Map();
    if (base.path && base.wOld) {
      const heldO = heldArray(Eold, base.path.length + 1);
      ref.get = function (t) { const p = base.path[t]; if (!p) return undefined; if (!this._c) this._c = new Map();
        if (!this._c.has(t)) this._c.set(t, [t > 0 ? heldO[t - 1] : false, canon(base.wOld, p)]); return this._c.get(t); };
    } else if (base.checkpoints) for (const [t, h, c] of base.checkpoints) ref.set(t, [h, c]);
    else return { fallback: "no old path and no checkpoints to rejoin" };
    // the first tick the new run comes near the change; the prefix before it must be the old one exactly
    let tx = pathN.findIndex(p => p && p.x >= inf.xa);
    if (tx < 0) tx = pathN.length - 1;
    for (const [t, h, c] of base.checkpoints || []) {
      if (t >= tx) break;
      if (!pathN[t] || !sameState(canon(wNew, pathN[t]), c)) return { fallback: "the unchanged prefix replays differently at tick " + t + ": " + (pathN[t] ? stateDiff(canon(wNew, pathN[t]), c).slice(0, 3).join("; ") : "it died") };
    }
    const tries = [];
    for (const back of opts.backoff || [1, 3, 8]) {
      // start: the last calm tick at least `back` seconds before the change (or the level's start)
      let c = Math.max(0, tx - Math.round(back * TPS));
      while (c > 0 && !calm(wNew, pathN[c])) c--;
      if (tries.length && tries[tries.length - 1].from === c) continue;
      const start = pathN[c], held0 = c > 0 ? heldBefore(Eold, c) : false;
      let joinAt = null, checks = 0;
      const goal = (st, held) => {
        if (st.x < inf.xb || checks > 50) return false;
        const r = ref.get(st.tick);
        if (!r || r[0] !== held || !sameState(canon(wNew, st), r[1])) return false;
        checks++;
        joinAt = st.tick;
        return true;
      };
      const sv = (opts.solve || ((w, s, h, g) => GD.solveSweep(w, { start: s, held: h, goal: g })))(wNew, start, held0, goal);
      tries.push({ from: c, back, ok: !!(sv && sv.ok), joinAt: sv && sv.ok ? sv.goalTick : null });
      if (!sv || !sv.ok) continue;
      let ev = Eold.filter(e => e.tick < c).concat(sv.events.filter(e => e.tick >= c));
      const T = sv.goalTick;
      if (T != null) {
        // the old rest from T on, with the button as the old route has it there
        const mid = sv.events.filter(e => e.tick < T);
        ev = Eold.filter(e => e.tick < c).concat(mid, Eold.filter(e => e.tick >= T));
      }
      // tidy: no two events at one tick, alternating press/release
      ev.sort((a, b) => a.tick - b.tick);
      const clean = []; let h = false;
      for (const e of ev) { const p = e.type === "press"; if (p === h) continue; if (clean.length && clean[clean.length - 1].tick === e.tick) { clean.pop(); h = !h; continue; } clean.push(e); h = p; }
      const q = GD.run(wNew, clean);
      if (!finishes(wNew, q)) { tries[tries.length - 1].why = "spliced route does not finish"; continue; }
      if (GD.skipCheck && GD.skipCheck(wNew, q.path, clean)) { tries[tries.length - 1].why = "spliced route skips"; continue; }
      return { ok: true, events: clean, from: c, to: T != null ? T : q.path.length - 1, rejoined: T != null, backoff: back, tries, ms: Date.now() - t0 };
    }
    return { fallback: "no route from " + tries.map(t => "tick " + t.from).join(", ") + " (" + tries.map(t => t.why || "search stuck").join("; ") + ")", tries, ms: Date.now() - t0 };
  }

  // the edit re-solve from an old level and its route (both in hand): { ok, events, from, to, rejoined, ms } with
  // the events a whole route of the new level, or { fallback: why } (then solve the level whole)
  function fromBase(oldLevel, oldEvents, level, opts) {
    const wOld = GD.makeWorld(oldLevel.objects, oldLevel.header), w = GD.makeWorld(level.objects, level.header);
    const inf = influence(wOld, w, diffObjects(oldLevel.objects, level.objects), oldLevel.header, level.header);
    const pOld = GD.run(wOld, oldEvents).path;
    if (!finishes(wOld, { done: pOld[pOld.length - 1].done, end: pOld[pOld.length - 1] })) return { fallback: "the old route does not finish the old level (physics changed since?)" };
    const r = resolve(w, { events: oldEvents, path: pOld, wOld, checkpoints: checkpoints(wOld, oldEvents, pOld) }, inf, opts);
    return Object.assign(r, { inf, w });
  }

  // After a physics or object-table change: replay the saved route first. Kept when it still finishes and skips
  // nothing (the cheap refresh tools/solutions.js already did); else the stretch from the first checkpoint that
  // replays differently (or where it now dies or skips) is solved again from the calm tick before it, until the
  // run is back in a saved checkpoint state (then the old rest is replayed under the new physics and must
  // finish), or to the end. Returns resolve()'s result ({ ok, events, from, to } or { fallback }), or
  // { ok, events, kept: true }.
  function refresh(w, events, cks, opts) {
    const ev = events.slice().sort((a, b) => a.tick - b.tick), r = GD.run(w, ev);
    const sk = finishes(w, r) && GD.skipCheck ? GD.skipCheck(w, r.path, ev) : null;
    if (finishes(w, r) && !sk) return { ok: true, events: ev, kept: true };
    if (!cks || !cks.length) return { fallback: "no checkpoints saved with this route" };
    const bad = sk ? (sk.dieAt ? sk.dieAt.x : r.end.x) : r.end.x;
    let xd = bad;
    for (const [t, , c] of cks) { const p = r.path[t]; if (!p || !sameState(canon(w, p), c)) { xd = Math.min(bad, p ? p.x : r.end.x); break; } }
    return resolve(w, { events: ev, checkpoints: cks }, { xa: xd, xb: bad + 60 }, opts);
  }

  // ---- the section cache ----
  // A route is cut at calm ticks of a plain mode (on the ground in cube, robot, ball or spider; calm() above)
  // into sections of at least opts.min seconds. A section is cached by what decides its route: the objects
  // that can touch the player in it, their x taken from the grid column the section starts in (so a section
  // moved by whole blocks, as cutting and joining levels do, keeps its key), and the entry state with x the
  // same way. The player's x within a block (its phase) is NOT in the key: a joined level puts the player
  // a fraction of a step elsewhere, so every cached section is checked by replaying it from the real entry
  // state before it is used (a replay costs ~1 ms per second of level).
  const PLAIN = { cube: 1, robot: 1, ball: 1, spider: 1 };
  const relKey = (o, X0) => objKey(Object.assign({}, o, { x: o.x - X0, props: o.props ? Object.assign({}, o.props, { "2": String(+(o.x - X0).toFixed(3)) }) : undefined }));
  // the objects that can touch the player between x0 and x1 (static by hitbox, moved ones by their reach,
  // triggers by where they act), as one hash relative to X0
  function objectsHash(w, x0, x1, X0) {
    if (!w._rng) w._rng = w.objects.map((o, i) => reachOf(w, i));
    const keys = [];
    w.objects.forEach((o, i) => { const r = w._rng[i]; if (!r || r[1] < x0 || r[0] > x1) return; keys.push(relKey(o, X0)); });
    return hkey(keys.sort().join(";")) + ":" + keys.length;
  }
  // the entry state without x and tick (the phase is checked by the replay), with the orbs/pads it already
  // used near it relative to its column
  function entryKey(w, s, held) {
    const c = norm(canon(w, s)); delete c.x; delete c.tick; delete c.prev; delete c.used;
    const X0 = Math.floor(s.x / 30) * 30;
    c.usedRel = s.used.filter(i => w.objects[i].x > s.x - 40).map(i => hkey(relKey(w.objects[i], X0))).sort();
    return hkey(JSON.stringify(c) + (held ? "H" : ""));
  }
  const isCut = (w, s) => !!(calm(w, s) && PLAIN[s.mode]);
  // sections of a finished route: [{from, to}] by tick, cut at calm plain ticks at least opts.min s apart
  function sectionsOf(w, events, path, opts) {
    const min = Math.round(((opts && opts.min) || 2) * TPS), cuts = [0];
    for (let t = min; t < path.length - min; t++) if (t - cuts[cuts.length - 1] >= min && isCut(w, path[t])) cuts.push(t);
    const out = []; for (let k = 0; k < cuts.length; k++) out.push({ from: cuts[k], to: k + 1 < cuts.length ? cuts[k + 1] : path.length - 1 });
    return out;
  }
  // a cache record of one section: { key, objs, end, len, dx, held0, stamp, ev: [[relTick, 0 press / 1 release]], endX }
  function sectionRecord(w, events, path, sec, stamp) {
    const a = path[sec.from], b = path[sec.to], X0 = Math.floor(a.x / 30) * 30, held0 = heldBefore(events, sec.from);
    const last = sec.to === path.length - 1;   // the last section runs to the level's end
    return { key: entryKey(w, a, held0), objs: objectsHash(w, a.x - 45, (last ? w.endX : b.x) + 45, X0), end: last ? "level" : "cut",
      len: sec.to - sec.from, dx: b.x - a.x, held0, stamp: stamp || "",
      ev: events.filter(e => e.tick >= sec.from && e.tick < sec.to).map(e => [e.tick - sec.from, e.type === "press" ? 0 : 1]),
      endX: last ? w.endX - X0 : null };
  }
  // store: { get(key) -> [records], put(record) } (tools/incsolve.js keeps them in local/incsolve/sections/)
  function cacheRoute(w, events, path, store, opts) {
    const recs = sectionsOf(w, events, path, opts).map(s => sectionRecord(w, events, path, s, opts && opts.stamp));
    for (const r of recs) store.put(r);
    return recs;
  }
  // the button going into tick T after events (sorted) starting with the button `held` at tick `from`
  const heldAfter = (held, ev, T) => { let h = held; for (const e of ev) { if (e.tick >= T) break; h = e.type === "press"; } return h; };
  // the cached sections that start at state s: the first whose objects match here and whose replay from s
  // reaches its end alive (calm, for a mid-level one). Returns { events (absolute), state, held, rec } or null.
  function useCached(w, s, held, store, stamp) {
    const list = store.get(entryKey(w, s, held));
    if (!list || !list.length) return null;
    const X0 = Math.floor(s.x / 30) * 30;
    for (const r of list) {
      if (stamp && r.stamp && r.stamp !== stamp) continue;
      if (r.end === "level" && r.endX !== w.endX - X0) continue;
      const x1 = r.end === "level" ? w.endX : s.x + r.dx;
      if (objectsHash(w, s.x - 45, x1 + 45, X0) !== r.objs) continue;
      const ev = r.ev.map(([t, k]) => ({ tick: s.tick + t, type: k ? "release" : "press" }));
      const q = runFrom(w, s, held, ev, r.end === "level" ? undefined : s.tick + r.len), e = q.end;
      if (e.dead) continue;
      if (r.end === "level") { if (!(e.done || e.x >= w.endX)) continue; }
      else if (e.tick !== s.tick + r.len || !isCut(w, e)) continue;
      return { events: ev, state: e, held: heldAfter(held, ev, e.tick), rec: r };
    }
    return null;
  }
  // Solve a level from its start with the cache: replay a cached section wherever one fits; elsewhere search
  // (opts.solve: solveSweep from a state) until the run reaches a calm state where a cached section starts
  // (a seam), or the end. Returns { ok, events, reused: n sections, seams: [[fromTick, toTick]], ms }.
  function solveWithCache(w, store, opts) {
    opts = opts || {};
    const t0 = Date.now(), solveFn = opts.solve || ((w, s, h, g) => GD.solveSweep(w, { start: s, held: h, goal: g }));
    let s = GD.startState(w), held = false, events = [], reused = 0; const seams = [];
    for (let guard = 0; guard < 2000; guard++) {
      if (s.done || s.x >= w.endX) return { ok: true, events, reused, seams, ms: Date.now() - t0 };
      const c = useCached(w, s, held, store, opts.stamp);
      if (c) { events = events.concat(c.events); s = c.state; held = c.held; reused++; continue; }
      const from = s.tick;
      const goal = (st, h) => st.tick > from + 1 && isCut(w, st) && !!useCached(w, st, h, store, opts.stamp);
      const r = solveFn(w, s, held, goal);
      if (!r || !r.ok) return { ok: false, events, reused, seams, why: (r && r.why) || "seam search stuck", at: s.x, ms: Date.now() - t0 };
      const T = r.goalTick != null ? r.goalTick : Infinity, part = r.events.filter(e => e.tick >= from && e.tick < T);
      events = events.concat(part);
      seams.push([from, r.goalTick != null ? T : null]);
      if (r.goalTick == null) return { ok: true, events, reused, seams, ms: Date.now() - t0 };
      const q = runFrom(w, s, held, part, T);
      if (q.end.tick !== T || q.end.dead) return { ok: false, events, reused, seams, why: "seam replay differs from the search", ms: Date.now() - t0 };
      held = heldAfter(held, part, T); s = q.end;
    }
    return { ok: false, events, reused, seams, why: "too many sections", ms: Date.now() - t0 };
  }

  // ---- windows: measure only the inputs an edit can change ----
  // An input's player window (lib/windows.js -> lib/difficulty.js measureWindows) depends only on the run
  // from S0 ticks before it to its look-ahead after the next input (difficulty's own exact cache key: the
  // state where the search starts, the button over the span, the input, where the run ends). So an old
  // window is reused when the new route has the same input at the same tick, the same exact state SPAN ticks
  // before it, the same button over [tick - SPAN, next input + SPAN], both runs end the same way, and the
  // edit's x range is not within that stretch. opts.span: ticks each way (default: difficulty's own bounds).
  // oldWin: the saved compact windows [[0 press / 1 release, tick, lo, hi, j], ...]. Returns the new list and
  // how many were measured.
  function windowsIncremental(wOld, evOld, pathOld, oldWin, w, ev, path, inf, inputWindows, opts) {
    opts = opts || {};
    let D = GD.DIFF || OUT.DIFF; if (!D && typeof require !== "undefined") try { D = require("./difficulty.js").DIFF; } catch (e) { D = {}; }
    D = D || {}; const S0 = opts.back || Math.max(D.MAX_SHIFT || 120, D.ROUTE_SHIFT || 0), AH = opts.ahead || (S0 + 2 * (D.HORIZON || 240) + 8);
    const e1 = ev.slice().sort((a, b) => a.tick - b.tick), e0 = evOld.slice().sort((a, b) => a.tick - b.tick);
    const h1 = heldArray(e1, path.length + AH + 1), h0 = heldArray(e0, pathOld.length + AH + 1);
    const doneSame = !!path[path.length - 1].done === !!pathOld[pathOld.length - 1].done && path.length === pathOld.length;
    const old = new Map(oldWin.map(x => [x[0] + ":" + x[1], x]));
    const reuse = new Map();
    e1.forEach((e, i) => {
      const o = old.get((e.type === "release" ? 1 : 0) + ":" + e.tick);
      if (!o) return;
      const next = e1[i + 1] ? e1[i + 1].tick : path.length, k0 = Math.max(0, e.tick - S0), k1 = Math.min(path.length - 1, Math.max(e.tick, next) + AH);
      if (k1 >= path.length - 1 && !doneSame) return;
      if (!pathOld[k0] || !path[k0] || !sameState(canon(wOld, pathOld[k0]), canon(w, path[k0]))) return;
      for (let t = k0; t <= k1; t++) if (h1[t] !== h0[t]) return;
      if (inf && !inf.none) { if (inf.full) return; const xa = path[k0].x - 60, xb = path[k1].x + 60; if (!(inf.xb < xa || inf.xa > xb)) return; }
      reuse.set(i, o);
    });
    const measured = inputWindows(w, e1, path, { only: i => !reuse.has(i) && !(i > 0 && reuse.has(i - 1) && reuse.get(i - 1)[4] === i) });
    const out = measured.map(x => [x.type === "release" ? 1 : 0, x.tick, x.lo, x.hi, x.j]);
    for (const [i, o] of reuse) out.push([o[0], o[1], o[2], o[3], o[4] >= 0 ? i + (o[4] - oldIndex(e0, o)) : -1]);
    out.sort((a, b) => a[1] - b[1] || a[0] - b[0]);
    return { windows: out, measured: measured.length, reused: reuse.size };
  }
  const oldIndex = (e0, o) => e0.findIndex(e => e.tick === o[1] && (e.type === "release" ? 1 : 0) === o[0]);

  Object.assign(OUT, { incsolve: { windowsIncremental, objKey, diffObjects, influence, canon, sameState, stateDiff, calm, checkpoints, runFrom, resolve, fromBase, refresh, heldArray, heldBefore, finishes,
    sectionsOf, sectionRecord, cacheRoute, useCached, solveWithCache, entryKey, objectsHash, hkey } });
})(typeof module !== "undefined" ? module.exports : (window.GD = window.GD || {}));
