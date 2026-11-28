// The join between two layout sections (the theme board's "current scene": tools/layoutsections.js joined() in node and
// tools/designs_tab.js sceneTiles() in the page, the same code: tools/designs.js page() puts this file in front of the tab).
// Tiles are {t, c, r}: c from the section's left edge, r rows above the ground; "#" block, "/" "\" floor slopes, "r" "7"
// ceiling slopes (r: low on the left, 7: low on the right), "D" the wave's slide-safe cell (below).
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
  const top0 = (prev, next) => Math.max(prev.h, next.h) - 1;
  const ramp = (a, b, n) => { const d = Math.sign(b - a), k = Math.abs(b - a), lead = Math.max(0, Math.floor((n - k) / 2));
    return x => a + d * Math.min(k, Math.max(0, x - lead)); };
  // the middle row of a flying section's exit: in the last column (of its last 8) with two or more tiles, the middle of the
  // widest gap between two of them (a corridor of saws or blocks), or null
  function exitRow(prev) { for (let c = prev.w - 1; c >= Math.max(0, prev.w - 8); c--) { const rs = [...at(prev.T, c).keys()].sort((x, y) => x - y);
      if (rs.length < 2) continue; let best = null; for (let i = 1; i < rs.length; i++) if (rs[i] - rs[i - 1] > 2 && (!best || rs[i] - rs[i - 1] > best[1] - best[0])) best = [rs[i - 1], rs[i]];
      if (best) return Math.floor((best[0] + best[1]) / 2); }
    return null; }
  // the middle row of the next section's way in: in its first column (of its first 8) with two or more tiles, the middle of
  // the widest gap of 2+ open rows between two of them (a tunnel's mouth), or null when its entry is open
  function entryRow(next) { for (let c = 0; c < Math.min(next.w, 8); c++) { const rs = [...at(next.T, c).keys()].sort((x, y) => x - y);
      if (rs.length < 2) continue; let best = null; for (let i = 1; i < rs.length; i++) if (rs[i] - rs[i - 1] > 2 && (!best || rs[i] - rs[i - 1] > best[1] - best[0])) best = [rs[i - 1], rs[i]];
      if (best) return (best[0] + best[1]) / 2; return null; }
    return null; }
  function join(prev, next) {
    const a = floorEdge(prev.T, prev.w - 1, "R"), b = floorEdge(next.T, 0, "L");
    const ca = ceilEdge(prev.T, prev.w - 1, prev.h, "R"), cb = ceilEdge(next.T, 0, next.h, "L");
    // a ceiling on one side only tapers up to that side's top
    const c0 = ca != null ? ca : cb != null ? next.h : null, c1 = cb != null ? cb : ca != null ? prev.h : null;
    // a mode change after a climb: the ramp ends 4 columns before the portal (2026-11-28, random entry heights: a cube
    // leaving a 45-degree slope is launched up, ~3 columns of air, and met the portal still rising, so a ship section
    // planned from rest on its entry floor flew 1-3 rows off its plan and died)
    // Only into a flying mode (ship, wave, ufo, swing: planned from rest on the entry floor); into ball / spider / robot / cube
    // the join is the plain ramp (the theme gallery's ufo -> ball, ship -> cube and spider -> ball joins grew by 3 columns
    // and the gallery stopped clearing, the board thread 2026-11-28)
    const modeUp = prev.mode && next.mode && prev.mode !== next.mode && b > a && /^(ship|wave|ufo|swing)$/.test(next.mode);
    // OUT OF AN OPEN FLYING EXIT (2026-11-28, the theme gallery's tall swing ended in a saw corridor ~14 rows up, the gated
    // mouth into the ship sat on the floor 3 columns on, and GD keeps a flying player in its 10-block band, so no route got
    // down: the gallery stopped clearing): when the last section flies (no floor, no ceiling at its exit), the join gets a
    // descent from the corridor's middle to the mouth, 1.5 columns a row, with a portal of the flying mode (R for a swing:
    // the ship + swing pair) every 3 rows on the way, each setting the band again around it
    const MOVER = { swing: "R", ship: "H", ufo: "U", wave: "A" }, flyEx = prev.mode && next.mode && prev.mode !== next.mode && MOVER[prev.mode] && !a && ca == null ? exitRow(prev) : null;
    // A FLYING EXIT CHANGES MODE IN THE MIDDLE, NOT ON THE GROUND (Evgeni 2026-11-28, the hellgate card's swing -> ship at
    // col 461: "when its flying (or any mode in a way), we could transition from anywhere, not only on the ground. in a way we
    // should transition more around the middle if possible"; the swing came down 14 rows to a portal on the floor and the
    // ship climbed 5 back to its tunnel): the gated portal sits at the next section's mouth (the middle of its way in), or
    // with an open entry up to 4 rows over its floor toward the exit; its band (5 rows each side) covers the mouth either way
    const er = flyEx != null ? entryRow(next) : null;
    const pr = flyEx == null ? b + 1 : Math.max(b + 1, Math.min(top0(prev, next) - 3, er != null ? Math.round(er) - 1 : Math.min(flyEx - 1, b + 4)));
    const desc = flyEx != null && Math.abs(flyEx - pr) > 4 ? flyEx - pr : 0;
    const n = Math.max(3, Math.abs(b - a) + (modeUp ? 5 : 2), c0 != null ? Math.abs(c1 - c0) + 2 : 0, desc ? Math.ceil(Math.abs(desc) * 1.5) + 4 : 0);
    const fe = modeUp ? (x => a + Math.min(b - a, Math.max(0, x - 1))) : ramp(a, b, n), ce = c0 != null ? ramp(c0, c1, n) : null, top = Math.max(prev.h, next.h) - 1, out = [];
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
    // (raised to pr over a flying exit: the column is walled under the portal too, the one before it slopes up into it)
    if (prev.mode && next.mode && prev.mode !== next.mode) { const mouth = pr + 2; portal = { c: pc, r: pr, mode: next.mode };
      const keep = out.filter(q => !((q.c === pc || q.c === pc - 1) && (q.r >= mouth || (pr > b + 1 && q.r < pr)))); out.length = 0; out.push(...keep);
      for (let r = mouth; r <= top; r++) out.push({ t: "#", c: pc, r });
      if (pc >= 1 && mouth + 1 <= top) { out.push({ t: "7", c: pc - 1, r: mouth }); for (let r = mouth + 1; r <= top; r++) out.push({ t: "#", c: pc - 1, r }); }
      if (pr > b + 1) { for (let r = 0; r < pr; r++) out.push({ t: "#", c: pc, r }); if (pc >= 1) { for (let r = 0; r < pr - 1; r++) out.push({ t: "#", c: pc - 1, r }); out.push({ t: "/", c: pc - 1, r: pr - 1 }); } } }
    // GRAVITY BACK TO NORMAL at a mode change (2026-11-27, the hellgate scene: a swing section ended upside down, the ship
    // after it flew upside down and the orb section's cube fell up into the sky -- every section is drawn and checked from
    // normal gravity): a normal-gravity portal in the gated mouth, one column before the mode portal, so it can't be skipped
    if (portal && pc >= 1) out.push({ t: "N", c: pc - 1, r: pr });
    if (portal && desc) { const d = Math.sign(desc); for (let r = flyEx - 3 * d; d > 0 ? r >= pr + 1 : r <= pr - 1; r -= 3 * d) { const k = Math.round(Math.abs(flyEx - r) * 1.5); if (k < pc - 1) out.push({ t: MOVER[prev.mode], c: k, r }); } }
    // SLIDE-SAFE SURFACES AT A WAVE PORTAL (Evgeni 2026-11-28: "the merges between sections still bit wierd, probably worst on
    // the wave as it just crashes the grounds. can we the 'D' blocks near the wave so it can slide near the portals?"). The
    // wave slides flat faces but dies sliding off a block's end and flying head-on into a slope, and a join is all ends
    // and slopes. Into or out of a wave, every floor top and ceiling bottom near the portal gets a "D" tile (GD's D block,
    // 1755: the wave touches blocks safely; lib/physics.js dArm, UNCHECKED in the game) in the empty cell against it, 3 rows
    // tall in the level (tools/designthemes.js sampleOf), so it covers the surface's own cell too: into a wave the join's
    // last 5 columns and the next section's first 4, out of one the last 4 of the section before and the whole join.
    // Tiles can lie outside the join (c < 0 or c >= n): they land on the sections around it. The rule per mode:
    // knowledge/section_types.md "Where each mode can slide".
    if (portal && (prev.mode === "wave" || next.mode === "wave")) {
      const cols = new Map(), occ = new Set(out.map(q => q.c + "," + q.r));
      const add = (c, src, sc) => { if (!cols.has(c)) cols.set(c, [src, sc]); };
      if (next.mode === "wave") { for (let k = Math.max(0, n - 5); k < n; k++) add(k); for (let k = 0; k < Math.min(4, next.w); k++) add(n + k, next, k); }
      if (prev.mode === "wave") { for (let k = 0; k < n; k++) add(k); for (let k = 1; k <= Math.min(4, prev.w); k++) add(-k, prev, prev.w - k); }
      for (const [c, [src, sc]] of cols) {
        const m = src ? at(src.T, sc) : at(out, c), h = src ? src.h : top + 1, free = r => r >= 0 && r < h && !m.has(r) && !occ.has(c + "," + r);
        let f = 0; while (FLOOR.test(m.get(f) || ".")) f++;
        if (f > 0 && free(f)) out.push({ t: "D", c, r: f });
        if (CEIL.test(m.get(h - 1) || ".")) { let r = h - 1; while (r - 1 >= 0 && CEIL.test(m.get(r - 1) || ".")) r--; if (r - 1 > f && free(r - 1)) out.push({ t: "D", c, r: r - 1 }); }
      }
    }
    return { n, tiles: out, floor: b, portal };
  }
  const api = { join, floorEdge, ceilEdge, exitRow, entryRow };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.SceneJoin = api;
})(typeof window !== "undefined" ? window : this);
