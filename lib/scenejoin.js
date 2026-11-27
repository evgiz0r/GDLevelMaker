// The join between two layout sections (the theme board's "current scene": tools/layoutsections.js joined() in node and
// tools/designs_tab.js sceneTiles() in the page, the same code: tools/designs.js page() puts this file in front of the tab).
// Tiles are {t, c, r}: c from the section's left edge, r rows above the ground; "#" block, "/" "\" floor slopes, "r" "7"
// ceiling slopes (r: low on the left, 7: low on the right).
// The floor ramps by 45-degree slopes from one section's exit height to the next one's entry height. The ceiling merges the
// same way (Evgeni 2026-11-27, on the fly -> wave join: "it should merge in the same y locations, where some merging is
// done on both entrances like regular structures"): two corridors with ceilings get one ceiling that slopes from the first
// one's exit height to the second one's entry height; a ceiling with nothing on the other side tapers up to its top instead
// of stopping as a cut wall.
// join(prev, next) with {T: tiles, w, h} -> { n: columns, tiles: [{t, c, r}] (c from the join's left edge), floor: entry floor }
(function (root) {
  "use strict";
  const FLOOR = /[#\/\\]/, CEIL = /[#r7]/;
  const at = (T, c) => { const m = new Map(); for (const z of T) if (z.c === c) m.set(z.r, z.t); return m; };
  // floor edge height on a column's left (side "L") or right ("R") edge: the solid run from the ground up
  function floorEdge(T, c, side) { const m = at(T, c); let f = 0; while (FLOOR.test(m.get(f) || ".")) f++;
    if (!f) return 0; const top = m.get(f - 1); if (top === "/") return side === "R" ? f : f - 1; if (top === "\\") return side === "R" ? f - 1 : f; return f; }
  // ceiling edge height (its bottom) on a column's edge, or null when the column has no ceiling run down from the top row
  function ceilEdge(T, c, h, side) { const m = at(T, c); if (!CEIL.test(m.get(h - 1) || ".")) return null; let r = h - 1;
    while (r - 1 >= 0 && CEIL.test(m.get(r - 1) || ".")) r--; const b = m.get(r);
    if (b === "r") return side === "R" ? r + 1 : r; if (b === "7") return side === "R" ? r : r + 1; return r; }
  // 45-degree ramp of edge heights from a to b over n columns, flat at the two ends
  const ramp = (a, b, n) => { const d = Math.sign(b - a), k = Math.abs(b - a), lead = Math.max(0, Math.floor((n - k) / 2));
    return x => a + d * Math.min(k, Math.max(0, x - lead)); };
  function join(prev, next) {
    const a = floorEdge(prev.T, prev.w - 1, "R"), b = floorEdge(next.T, 0, "L");
    const ca = ceilEdge(prev.T, prev.w - 1, prev.h, "R"), cb = ceilEdge(next.T, 0, next.h, "L");
    // a ceiling on one side only tapers up to that side's top
    const c0 = ca != null ? ca : cb != null ? next.h : null, c1 = cb != null ? cb : ca != null ? prev.h : null;
    const n = Math.max(3, Math.abs(b - a) + 2, c0 != null ? Math.abs(c1 - c0) + 2 : 0);
    const fe = ramp(a, b, n), ce = c0 != null ? ramp(c0, c1, n) : null, top = Math.max(prev.h, next.h) - 1, out = [];
    for (let k = 0; k < n; k++) { const p = fe(k), q = fe(k + 1), lo = Math.min(p, q);
      for (let r = 0; r < lo; r++) out.push({ t: "#", c: k, r });
      if (q > p) out.push({ t: "/", c: k, r: p }); if (q < p) out.push({ t: "\\", c: k, r: q });
      if (ce) { const u = ce(k), v = ce(k + 1), hi = Math.max(u, v), cap = Math.min(top, Math.max(ca != null ? prev.h : 0, cb != null ? next.h : 0) - 1);
        for (let r = hi; r <= cap; r++) out.push({ t: "#", c: k, r });
        if (v > u && u <= cap) out.push({ t: "r", c: k, r: u }); if (v < u && v <= cap) out.push({ t: "7", c: k, r: v }); } }
    // A MODE PORTAL NOBODY CAN SKIP (Evgeni 2026-11-27: "there are some portals that can be skipped in the connectors"):
    // when the mode changes, the portal (3 rows: floor+0..2) sits in the join's last column, and that column is walled from
    // the portal's top to the roof, the column before it slopes down into the mouth, so every way on goes through the portal
    let portal = null;
    const pc = n - 1;
    if (prev.mode && next.mode && prev.mode !== next.mode) { const mouth = b + 3; portal = { c: pc, r: b + 1, mode: next.mode };
      const keep = out.filter(q => !((q.c === pc && q.r >= mouth) || (q.c === pc - 1 && q.r >= mouth))); out.length = 0; out.push(...keep);
      for (let r = mouth; r <= top; r++) out.push({ t: "#", c: pc, r });
      if (pc >= 1 && mouth + 1 <= top) { out.push({ t: "7", c: pc - 1, r: mouth }); for (let r = mouth + 1; r <= top; r++) out.push({ t: "#", c: pc - 1, r }); } }
    // GRAVITY BACK TO NORMAL at a mode change (2026-11-27, the hellgate scene: a swing section ended upside down, the ship
    // after it flew upside down and the orb section's cube fell up into the sky -- every section is drawn and checked from
    // normal gravity): a normal-gravity portal in the gated mouth, one column before the mode portal, so it can't be skipped
    if (portal && pc >= 1) out.push({ t: "N", c: pc - 1, r: b + 1 });
    return { n, tiles: out, floor: b, portal };
  }
  const api = { join, floorEdge, ceilEdge };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.SceneJoin = api;
})(typeof window !== "undefined" ? window : this);
