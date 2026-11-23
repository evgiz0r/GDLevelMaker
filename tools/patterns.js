// Named gameplay chunks and trigger helpers for tools/make.js specs. See STYLE.md.
//
// A pattern expands to spec objects ([type, col, row, extra]) placed at (col, row) = its
// bottom-left square. Every pattern here is a generic shape (the official levels use these
// shapes too, and so does everyone) -- nothing is copied from a particular level.
// Returns { objects, width } so a spec can chain them.
const P = {};
function def(name, doc, fn) { P[name] = { doc, fn }; }

// --- spikes on a floor ---
def("spikes", "n spikes side by side (n 1..3 is one jump at 1x; 4+ needs an orb/pad)", (a) => {
  const n = a.n || 1, o = [];
  for (let i = 0; i < n; i++) o.push(["spike", i, 0]);
  return { objects: o, width: n };
});
def("single", "one spike", () => P.spikes.fn({ n: 1 }));
def("double", "two spikes", () => P.spikes.fn({ n: 2 }));
def("triple", "three spikes: the classic hardest ground jump", () => P.spikes.fn({ n: 3 }));
def("spike-block", "spike then a 1-high block to land on and jump off", () => ({
  objects: [["spike", 0, 0], ["block", 3, 0]], width: 4 }));
def("block-spike-block", "jump block to block over a spike (the spike punishes a short hop)", () => ({
  objects: [["block", 0, 0], ["spike", 1, 0], ["spike", 2, 0], ["block", 3, 0]], width: 4 }));

// --- terrain ---
def("stairs", "n one-square steps up, w squares each (default 3), optional spike on the far floor", (a) => {
  const n = a.n || 3, w = a.w || 3, o = [];
  for (let s = 0; s < n; s++) for (let c = 0; c < w; c++) for (let r = 0; r <= s; r++) o.push(["block", s * w + c, r]);
  return { objects: o, width: n * w };
});
def("platform", "a flat platform w long at height h (top row h), filled to the floor", (a) => {
  const w = a.w || 4, h = a.h || 1, o = [];
  for (let c = 0; c < w; c++) for (let r = 0; r < h; r++) o.push(["block", c, r]);
  if (a.spike != null) o.push(["spike", a.spike, h]);
  return { objects: o, width: w };
});
def("hops", "floating 1-high slabs of blocks rising by `rise` with a spike pit under them", (a) => {
  const n = a.n || 3, gap = a.gap || 2, w = a.w || 2, rise = a.rise ?? 1, o = [];
  let c = 0;
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < w; k++) o.push(["block", c + k, 1 + i * rise]);
    c += w;
    if (i < n - 1) for (let k = 0; k < gap; k++) o.push(["spike", c + k, 0]);
    c += gap;
  }
  return { objects: o, width: c - gap };
});
def("gate", "ceiling with hanging spikes over ground spikes, `open` squares of air between (4+ = fair)", (a) => {
  const w = a.w || 2, open = a.open || 4, o = [];
  for (let c = 0; c < w; c++) {
    o.push(["spike", c, 0]);
    o.push(["spike", c, open + 1, { rot: 180 }]);
    o.push(["block", c, open + 2]);
  }
  return { objects: o, width: w };
});
def("pillar", "a w-wide column h high to jump onto/over", (a) => P.platform.fn({ w: a.w || 1, h: a.h || 2 }));

// --- orbs and pads ---
def("orb-pit", "yellow orb over a long spike run (n spikes); click the orb at the top of a jump", (a) => {
  const n = a.n || 5, o = [];
  for (let i = 0; i < n; i++) o.push(["spike", i, 0]);
  o.push(["yellow orb", Math.floor(n / 2), a.orbRow || 2]);
  return { objects: o, width: n };
});
def("pad-launch", "yellow pad on the floor, a spike run after it, a platform to land on", (a) => {
  const n = a.n || 4, o = [["yellow pad", 0, 0]];
  for (let i = 0; i < n; i++) o.push(["spike", 2 + i, 0]);
  return { objects: o, width: 2 + n };
});

// --- height and modes (after the user's "all same height, no variety" on GDLM 44 v1) ---
def("climb", "pillars rising 1, 2, 3... high (w wide) with spike pits (gap) between: jump up each one", (a) => {
  const n = a.n || 3, w = a.w || 2, gap = a.gap ?? 2, o = [];
  let c = 0;
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < w; k++) for (let r = 0; r <= i; r++) o.push(["block", c + k, r]);
    c += w;
    if (i < n - 1) { for (let k = 0; k < gap; k++) o.push(["spike", c + k, 0]); c += gap; }
  }
  return { objects: o, width: c };
});
def("descend", "pillars falling n, n-1, ... 1 high with spike pits: drop down each one", (a) => {
  const n = a.n || 3, w = a.w || 2, gap = a.gap ?? 2, o = [];
  let c = 0;
  for (let i = 0; i < n; i++) {
    const h = n - i;
    for (let k = 0; k < w; k++) for (let r = 0; r < h; r++) o.push(["block", c + k, r]);
    c += w;
    if (i < n - 1) { for (let k = 0; k < gap; k++) o.push(["spike", c + k, 0]); c += gap; }
  }
  return { objects: o, width: c };
});
def("orb-ladder", "yellow orbs climbing over a spike floor; rows = orb heights, dx = columns between orbs", (a) => {
  const rows = a.rows || [2, 3, 4], dx = a.dx || 4, o = [];
  const width = dx * rows.length + 1;
  for (let c = 0; c < width; c++) o.push(["spike", c, 0]);
  rows.forEach((r, i) => o.push([a.orb || "yellow orb", 1 + i * dx, r]));
  return { objects: o, width };
});
// Flying corridors are placed at row 0 (their band is rows 0-9: GD sets a ship/wave band's floor
// from the portal's height, and any portal at row 5 or lower gives floor 0). `portal: true` puts
// the mode's portal one column before the corridor, centred on the path's first row -- a portal
// off the path reads wrong (playtest, GDLM 44 v2). `exit: "cube"` puts a cube portal after it,
// centred on the last row of the path. `portalRow` overrides the entry portal's row (1 = reached by a
// cube running on the ground).
// The exit portal gets a frame (blocks above and below it, rows 0-9) so the only way out of the
// corridor is through it: without one the solver flew over GDLM 44's exit and played on as a ship.
function portals(o, mode, entryRow, exitRow, w, a) {
  if (a.portal) o.push([mode + " portal", -1, entryRow]);
  if (a.exit) {
    o.push([a.exit + " portal", w, exitRow]);
    for (let r = 0; r < 10; r++) if (r < exitRow - 1 || r > exitRow + 1) o.push(["block", w, r]);
  }
}
def("ship-tunnel", "a ship corridor (band rows 0-9): floor and roof follow `waves` sine waves, `gap` rows of air, teeth on the bends; portal/exit options", (a) => {
  const w = a.w || 16, gap = a.gap || 5, amp = a.amp ?? 1.5, base = a.base ?? 1, o = [];
  // `waves`: how many rises and falls over the corridor (one over a 120-block ship is flat)
  const floorAt = c => Math.max(0, Math.round(base + amp * Math.sin(c / w * 2 * Math.PI * (a.waves || 1))));
  for (let c = 0; c < w; c++) {
    const f = floorAt(c);              // floor top row (blocks 0..f-1)
    const roof = f + gap;              // first roof row
    for (let r = 0; r < f; r++) o.push(["block", c, r]);
    for (let r = roof; r < 10; r++) o.push(["block", c, r]);
    // teeth alternate floor / roof, never both in one column (both at once left 3 rows: 42 ms)
    // and not before `lead` columns: a calm lead-in after the portal (rated Easy ships ~8 blocks)
    const lead = a.lead ?? 6;
    // never on a step of the floor or roof (or next to one): the wall changes height there, and a
    // tooth on top of that is a trap (GDLM 44: the user's ship crashed into a spike hanging under a
    // ceiling step, real_stats 2026-11-23)
    const flatHere = [c - 1, c + 1].every(k => k < 0 || k >= w || floorAt(k) === f);
    if (a.teeth && flatHere && c >= lead && (c - lead) % 8 === 0) o.push(["spike", c, f]);
    if (a.teeth && flatHere && c >= lead && (c - lead) % 8 === 4) o.push(["spike", c, roof - 1, { rot: 180 }]);
  }
  const mid = c => floorAt(c) + (gap - 1) / 2;
  portals(o, "ship", a.portalRow ?? Math.min(5, Math.round(mid(0))), Math.round(mid(w - 1)), w, a);
  return { objects: o, width: w + (a.exit ? 1 : 0) };
});
def("wave-zigzag", "a wave corridor (band rows 0-9): the path climbs and falls 45 degrees, `seg` columns per leg, `gap` rows of room, `flat` level columns at each peak and valley, `lead` level columns at the entry; portal/exit options", (a) => {
  // `flat`: with 45-degree slope walls the wave flies exactly parallel to them, and at a turn the next
  // leg's slope meets it head-on -- which kills (physics, 2026-11-23: GDLM 44's zigzag turns were
  // 13-88 ms, "i still couldnt fit into the gap"). A flat roof or floor at each turn is met at 45
  // degrees, so the wave slides along it and can turn anywhere on it: ~95 ms per flat column at 1x.
  const seg = a.seg || 4, legs = a.legs || 4, gap = a.gap || 4, low = a.low ?? 2, flat = a.flat || 0, lead = a.lead || 0, o = [];
  const L = seg + flat, w = lead + L * legs;
  const midAt = c => { if (c < lead) return low; c -= lead; const leg = Math.floor(c / L), k = Math.min(c % L, seg); return low + (leg % 2 === 0 ? k : seg - k); };
  for (let c = 0; c < w; c++) {
    if (a.slopes) {
      // walls of 45-degree slopes along the legs, so the corridor is a straight diagonal (square
      // blocks made it a staircase: "the wave looks like cube", playtest GDLM 44 v3). The sim models
      // floor slopes and treats ceiling slopes as full blocks, so it checks with less room than the game.
      const m0 = midAt(c), m1 = c + 1 < w ? midAt(c + 1) : m0, up = m1 > m0;
      if (m0 === m1) { // level: floor below row m0 - gap/2, roof from `gap` rows above it
        const f = m0 - Math.floor(gap / 2);
        for (let r = 0; r < f; r++) o.push(["block", c, r]);
        for (let r = f + gap; r < 10; r++) o.push(["block", c, r]);
        continue;
      }
      const fl = Math.min(m0, m1) - Math.floor(gap / 2);       // floor slope row
      const cl = Math.max(m0, m1) - Math.floor(gap / 2) + gap - 1; // ceiling slope row
      for (let r = 0; r < fl; r++) o.push(["block", c, r]);
      if (fl >= 0) o.push(["slope", c, fl, up ? {} : { flipX: true }]);
      // ceiling: a rising roof is the slope turned over both ways (solid top-left), a falling roof
      // only upside down (solid top-right)
      if (cl <= 9) o.push(["slope", c, cl, up ? { flipX: true, flipY: true } : { flipY: true }]);
      for (let r = cl + 1; r < 10; r++) o.push(["block", c, r]);
      continue;
    }
    // the room is measured around the path over this column and its neighbours, so the turns do
    // not pinch (square blocks at an apex left 2 rows where the legs had 4)
    const ms = [midAt(Math.max(0, c - 1)), midAt(c), midAt(Math.min(w - 1, c + 1))];
    const bottom = Math.min(...ms) - Math.floor(gap / 2), top = Math.max(...ms) - Math.floor(gap / 2) + gap;
    for (let r = 0; r < bottom; r++) o.push(["block", c, r]);
    for (let r = top; r < 10; r++) o.push(["block", c, r]);
  }
  // the exit over the last floor: a corridor ending level (flat) has the wave sliding on its floor,
  // so the portal covers the floor's top row and the two above it (centred one row up); in the middle
  // of the path it let only a late release through (GDLM 44 v7: 54 ms, the early ones slid under it)
  const endFlat = a.slopes && flat && midAt(w - 1) === midAt(w - 2);
  portals(o, "wave", a.portalRow ?? Math.min(5, midAt(0)), endFlat ? midAt(w - 1) - Math.floor(gap / 2) + 1 : midAt(w - 1), w, a);
  return { objects: o, width: w + (a.exit ? 1 : 0) };
});

def("ball-run", "a ball corridor (band rows 0-7 from a portal on the ground): a roof `gap` rows up, spikes alternating floor / roof every `every` columns after `lead`, so each one is a flip; portal/exit options", (a) => {
  // The ball flips gravity on a tap and takes ~0.35 s (3-4 blocks at 1x) to cross a 5-row room,
  // so hazards come `every` (default 9) columns apart at Easy. The roof is solid all along: a
  // ball rolling on the band's invisible ceiling would not read. Floor spikes come in pairs or
  // alone (variety), the roof's hang one row under it.
  const w = a.w || 32, gap = a.gap || 5, every = a.every || 9, lead = a.lead ?? 5, o = [];
  for (let c = 0; c < w; c++) for (let r = gap; r < 8; r++) o.push(["block", c, r]);
  let k = 0;
  for (let c = lead; c < w - 6; c += every, k++) {
    const n = k % 4 === 2 ? 1 : 2;               // 2, 2, 1, 2, ...
    for (let i = 0; i < n; i++) {
      if (k % 2 === 0) o.push(["spike", c + i, 0]);
      else o.push(["spike", c + i, gap - 1, { rot: 180 }]);
    }
  }
  // exit on the floor (the frame forces a last flip down when the ball rides the roof)
  portals(o, "ball", a.portalRow ?? 1, 1, w, a);
  return { objects: o, width: w + (a.exit ? 1 : 0) };
});

// An upside-down stretch for the cube: a ceiling `ceil` rows up (its lower face), a yellow gravity
// portal on the ground at the start, a blue one under the ceiling at the end. `chunk` objects
// (plain pattern output, floor-based) are mirrored onto the ceiling by compose.js (mirrorUp).
def("ceiling", "a ceiling `w` long whose lower face is row `ceil` (default 6), 2 blocks thick; with portal/exit: gravity portals in and out", (a) => {
  const w = a.w || 24, ceil = a.ceil || 6, o = [];
  for (let c = 0; c < w; c++) for (let r = ceil; r < ceil + 2; r++) o.push(["block", c, r]);
  if (a.portal) o.push(["gravity down", -1, 1]);      // id 11: upside down; the cube falls up
  if (a.exit) {
    // under the ceiling, centred on the path's row (ceil - 1) minus one so it does not sit in the
    // ceiling; framed below so the only way on is through it
    o.push(["gravity up", w - 1, ceil - 2]);
    for (let r = 0; r < ceil - 3; r++) o.push(["block", w - 1, r]);
  }
  return { objects: o, width: w };
});
// floor-based pattern objects -> the same shape hanging from a ceiling whose lower face is row
// `ceil`: row r -> ceil - 1 - r, spikes turned over. Only shapes made of blocks and spikes
// (pads and orbs upside down are not checked in the sim).
function mirrorUp(objs, ceil) {
  return objs.map(([t, c, r, e]) => {
    if (t !== "block" && t !== "spike") throw new Error(`mirrorUp: ${t} upside down is not supported`);
    const e2 = Object.assign({}, e || {});
    if (t === "spike") e2.rot = ((e2.rot || 0) + 180) % 360;
    return [t, c, ceil - 1 - r, e2];
  });
}

// expand one spec entry ["pattern", name, col, row, args] into plain entries
function expand(name, col, row, args, extra) {
  const p = P[name];
  if (!p) throw new Error(`unknown pattern "${name}" (known: ${Object.keys(P).join(", ")})`);
  const r = p.fn(args || {});
  return r.objects.map(([t, c, rr, e]) => [t, col + c, row + rr, Object.assign({}, e || {}, extra || {})]);
}

module.exports = { PATTERNS: P, expand, mirrorUp };
if (require.main === module) for (const [k, v] of Object.entries(P)) console.log(k.padEnd(18), v.doc);
