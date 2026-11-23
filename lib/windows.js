// GD.inputWindows(w, events, path, opts) -- the timing window of every input of a plan, fast enough for
// the viewer: each press / release (a tap -- press + release within 3 ticks -- moves as one) is moved tick by
// tick and the run replayed, as tools/windows.js does, but each try starts from the plan's own saved state
// just before the change (path[k], the state at tick k) and stops as soon as it rejoins the plan (same
// position, speed, mode, gravity and used orbs at the same tick, button state equal): from there on it is the
// plan's own run, which clears. tools/windows.js replays the whole level per try (3.5 min on GDLM 45);
// this takes seconds. A window stops at the neighbouring inputs (moving past one would reorder the plan)
// and at opts.span ticks (default 60 = 250 ms) each way.
// Returns [{ i, j, type, tick, lo, hi }] per moved input (j: the tap's release index, or -1).
// opts.only(i) -> false skips an input; opts.budget: ms to spend before returning (then call again with
// opts.from = the returned .next to continue; used by the viewer to stay responsive).
(function (OUT) {
  "use strict";
  const GD = typeof module !== "undefined" && module.exports === OUT
    ? Object.assign({}, require("./objects.js"), require("./physics.js")) : OUT;
  const same = (a, b) => a.x === b.x && a.y === b.y && a.vy === b.vy && a.grav === b.grav && a.sp === b.sp &&
    a.mode === b.mode && a.grounded === b.grounded && a.dashing === b.dashing && a.used.length === b.used.length &&
    a.floorY === b.floorY && a.ceilY === b.ceilY && a.buffered === b.buffered && a.ring === b.ring;
  const cl = s => { const c = Object.assign({}, s); c.used = s.used.slice(); return c; };

  function inputWindows(w, events, path, opts) {
    opts = opts || {};
    const SPAN = opts.span || 60, ev = events.slice().sort((a, b) => a.tick - b.tick);
    const max = Math.ceil((w.endX / (GD.SPEEDS[0].x * 60) + 5) * GD.PHYS.TPS);
    const heldBefore = (list, k) => { let h = false; for (const e of list) { if (e.tick >= k) break; h = e.type === "press"; } return h; };
    const clears = (list, a, last) => {
      const m = new Map(); for (const e of list) m.set(e.tick, e.type);
      const s = cl(path[Math.min(a, path.length - 1)]); let held = heldBefore(list, a);
      if (s.tick !== a) return null; // the plan never got that far
      while (!s.dead && !s.done && s.tick < max) {
        if (s.tick > last && s.tick < path.length && same(s, path[s.tick]) && held === heldBefore(ev, s.tick)) return true;
        const e = m.get(s.tick); let press = false;
        if (e === "press") { press = true; held = true; } else if (e === "release") held = false;
        GD.step(w, s, { press, held });
      }
      return !s.dead && (s.done || s.x >= w.endX);
    };
    const tapEnd = i => ev[i].type === "press" && ev[i + 1] && ev[i + 1].type === "release" && ev[i + 1].tick - ev[i].tick <= 3 ? i + 1 : -1;
    const out = opts.out || [], t0 = Date.now();
    for (let i = opts.from || 0; i < ev.length; i++) {
      if (opts.budget && Date.now() - t0 > opts.budget) return Object.assign(out, { next: i });
      if (i > 0 && tapEnd(i - 1) === i) continue;
      if (opts.only && !opts.only(i)) continue;
      const e = ev[i], j = tapEnd(i), gap = j > 0 ? ev[j].tick - e.tick : 0, lastI = j > 0 ? j : i;
      const lo0 = Math.max(i > 0 ? ev[i - 1].tick + 1 : 0, e.tick - SPAN);
      const hi0 = Math.min(lastI + 1 < ev.length ? ev[lastI + 1].tick - 1 - gap : Infinity, e.tick + SPAN);
      const ok = t => { const l = ev.map(x => Object.assign({}, x)); l[i].tick = t; if (j > 0) l[j].tick = t + gap;
        return clears(l, Math.min(t, e.tick), Math.max(t, e.tick) + gap + 1); };
      let lo = e.tick, hi = e.tick;
      while (lo - 1 >= lo0 && ok(lo - 1)) lo--;
      while (hi + 1 <= hi0 && ok(hi + 1)) hi++;
      out.push({ i, j, type: e.type, tick: e.tick, lo, hi });
    }
    return Object.assign(out, { next: null });
  }
  OUT.inputWindows = inputWindows;
})(typeof module !== "undefined" ? module.exports : (window.GD = window.GD || {}));
