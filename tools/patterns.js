// Named gameplay chunks and trigger helpers for tools/make.js specs. See STYLE.md.
//
// A pattern expands to spec objects ([type, col, row, extra]) placed at (col, row) = its
// bottom-left square. Every pattern here is a generic shape (the official levels use these
// shapes too, and so does everyone) -- nothing is copied from a particular level.
// Returns { objects, width } so a spec can chain them.
const P = {};
function def(name, doc, fn) { P[name] = { doc, fn }; }

// --- varied flying corridors (`vary`: a seed) ---
// The user on GDLM 71 (2026-11-25, 12 viewer marks): "too repetitive, same height corridor. we have x6 of the same mini
// structure", "structure is 4 times. should be 2 max", "no heights change. all on 2 levels. with ball/spider/wave there
// should be different corridors (where top and bottom not same height)". So with `vary` a corridor is a run of
// segments, each with its own floor and roof heights (moved independently) and its own obstacle motif, and no motif or
// shape comes more than twice in a row (checklist "Flying variety"; tools/flyvariety.js measures it).
function vrng(seed) { let s = ((seed | 0) * 9301 + 49297) % 233280 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const vint = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
// pick from `opts`, never one of the last `maxRun` picks when all of them were the same, and not the last one when
// there is a choice and r() says so
function vpick(r, opts, hist, maxRun = 2) {
  const tail = hist.slice(-maxRun), same = tail.length === maxRun && tail.every(x => x === tail[0]);
  let pool = opts.filter(o => !(same && o === tail[0]));
  if (pool.length > 1 && hist.length && r() < 0.75) pool = pool.filter(o => o !== hist[hist.length - 1]);
  return pool[Math.floor(r() * pool.length)];
}
// floor F / roof R (first roof row) per column moving from (f0, r0) to (f1, r1), a row every 2 columns: first the moves
// that open the room (floor down, roof up), then the ones that close it, so the room never drops below the smaller end
function vtransit(f0, r0, f1, r1) {
  const out = [];
  let f = f0, rr = r0, k = 0;
  const step = (want, cur) => cur + Math.sign(want - cur);
  // phase 1: floor down, roof up
  while ((f1 < f && f !== f1) || (r1 > rr && rr !== r1)) {
    if (k % 2 === 1) { if (f1 < f) f = step(f1, f); if (r1 > rr) rr = step(r1, rr); }
    out.push([f, rr]); k++;
  }
  while (f !== f1 || rr !== r1) {
    if (k % 2 === 1) { if (f1 !== f) f = step(f1, f); if (r1 !== rr) rr = step(r1, rr); }
    out.push([f, rr]); k++;
  }
  return out;
}
function shipVary(a) {
  const r = vrng(a.vary), w = a.w || 16, g0 = a.gap || 5, lead = a.lead ?? 6, base = a.base ?? 0, o = [];
  const F = new Array(w).fill(base), R = new Array(w).fill(base + g0), mot = [];
  const shapes = [], motifs = [];
  let c = Math.min(lead, w), f = base, rf = base + g0;
  while (c < w) {
    let nf, ng, key, tries = 0;
    do {
      // floor and roof each move at most 2 rows (a 3-row move took ~14 columns of stairs: no room left for anything else)
      nf = Math.max(0, Math.min(3, f + vint(r, -2, 2))); ng = g0 + vint(r, 0, 2); if (nf + ng > 9) ng = 9 - nf;
      if (Math.abs(nf + ng - rf) > 2) ng = rf + Math.sign(nf + ng - rf) * 2 - nf;
      if (ng < g0) ng = g0;
      key = nf + ":" + ng; tries++;
    } while (tries < 30 && ((nf === f && nf + ng === rf) || shapes.slice(-2).includes(key) || (Math.abs(nf - f) < 1 && tries < 10)));
    let tr = vtransit(f, rf, nf, nf + ng);
    let len = Math.max(vint(r, 8, 12), tr.length + 6);
    if (w - (c + len) < 8) {
      len = w - c;
      // the last segment ends at the entry heights: the next corridor's mouth meets it (a direct mode switch,
      // compose.js `endLow`)
      // and always: an exit high up left the cube falling past the next part's seam (GDLM 71 p4)
      { nf = base; ng = g0; key = nf + ":" + ng; tr = vtransit(f, rf, nf, nf + ng); }
    }
    for (let i = 0; i < len && c + i < w; i++) { const [ff, rr] = i < tr.length ? tr[i] : [nf, nf + ng]; F[c + i] = ff; R[c + i] = rr; }
    shapes.push(key);
    const s0 = c + tr.length + 1, s1 = Math.min(c + len, w - 3) - 1;   // the flat stretch, a column clear at each end
    // spikes twice as likely as the block shapes (a ship needs hazards to steer around, not only walls)
    const opts = ["floor-spike", "roof-spike", "floor-spike", "roof-spike", "bump", "hang", "calm"].concat(a.teeth !== false ? ["teeth", "teeth"] : [], a.pit ? ["pit"] : []);
    // a motif per ~5 columns of the level stretch (one per segment left the ship ~2 s with nothing to do), calm at most
    // once in a row
    const parts = Math.max(1, Math.floor((s1 - s0 + 1) / 4));
    for (let q = 0; q < parts; q++) {
      const a0 = s0 + Math.floor(q * (s1 - s0 + 1) / parts), a1 = s0 + Math.floor((q + 1) * (s1 - s0 + 1) / parts) - 1;
      const m = a1 - a0 >= 1 ? vpick(r, opts.filter(x => !(x === "calm" && motifs.slice(-2).includes("calm"))), motifs) : "calm";
      motifs.push(m); mot.push([m, a0 + (q ? 1 : 0), a1, nf, nf + ng]);
    }
    f = nf; rf = nf + ng; c += len;
  }
  for (let cc = 0; cc < w; cc++) { for (let rr = 0; rr < F[cc]; rr++) o.push(["block", cc, rr]); for (let rr = R[cc]; rr < 10; rr++) o.push(["block", cc, rr]); }
  for (const [m, s0, s1, ff, rr] of mot) {
    const mid = Math.floor((s0 + s1) / 2);
    if (m === "floor-spike") o.push(["spike", mid, ff]);
    else if (m === "roof-spike") o.push(["spike", mid, rr - 1, { rot: 180 }]);
    else if (m === "teeth") { o.push(["spike", s0, ff]); if (s1 - s0 >= 3) o.push(["spike", Math.min(s1, s0 + 3), rr - 1, { rot: 180 }]); }
    else if (m === "bump" && rr - ff >= 6) { for (let x = mid - 1; x <= mid; x++) o.push(["block", x, ff]); }
    else if (m === "hang" && rr - ff >= 6) { for (let x = mid - 1; x <= mid; x++) o.push(["block", x, rr - 1]); }
    else if (m === "pit") for (let x = s0; x <= s1; x++) o.push([9, x, ff, { dy: -13 }]);
  }
  const mid = c => F[c] + (R[c] - F[c] - 1) / 2;
  portals(o, "ship", a.portalRow ?? Math.min(5, Math.round(mid(0))), Math.round(mid(w - 1)), w, a);
  return { objects: o, width: w + (a.exit ? 1 : 0) };
}
// the wave's path height per column with legs of their own length and peaks / valleys at their own heights
function waveVaryPath(a, W) {
  const r = vrng(a.vary), lead = a.lead || 0, low = a.low ?? 2, flat = a.flat || 0, lo = low, hi = low + (a.seg || 4);
  const M = new Array(W).fill(low);
  let c = lead, cur = low, up = true; const hist = [];
  while (c < W) {
    const room = up ? hi - cur : cur - lo;
    // legs of 3+ rows: 2-row legs at 2x were turns under 100 ms (GDLM 71 v2, score.js "route")
    let d = room < 3 ? room : vint(r, 3, room);
    const key = (up ? "u" : "d") + d;
    if (hist.slice(-2).every(k => k === key) && hist.length >= 2 && room > 3) d = d > 3 ? d - 1 : d + 1;
    hist.push((up ? "u" : "d") + d);
    const fl = flat ? flat + (r() < 0.4 ? 1 : 0) : 0;
    for (let i = 1; i <= d && c < W; i++, c++) M[c] = cur + (up ? i : -i);
    cur += up ? d : -d;
    for (let i = 0; i < fl && c < W; i++, c++) M[c] = cur;
    up = !up;
    // the last leg: a level end of at least `flat` columns (the exit fills the mouth there)
    if (W - c < d + fl + Math.max(1, flat) && c < W) { while (c < W) M[c++] = cur; }
  }
  // `endLow`: back down to `low` and level for the last columns (a direct switch into the next mode's corridor)
  if (a.endLow) {
    // from the last point where the path is at a turn's level run or rising, with room after it for a level turn
    // (`flat`), the fall to `low` and 2 level columns: turns without a level run meet the slope head-on
    let e = W - 1;
    const fits = x => W - 1 - x >= flat + (M[x] - low) + 2;
    while (e > lead && (!fits(e) || (M[e - 1] > M[e]))) e--;
    let x = e + 1;
    if (M[e] > low) for (let i = 0; i < flat && x < W; i++) M[x++] = M[e];
    let cur2 = M[e];
    for (; x < W; x++) { cur2 = Math.max(low, cur2 - 1); M[x] = cur2; }
  }
  return M;
}
// ball / swing / spider: hazards alternate floor / roof as before, but their spacing and count vary, and the floor moves
// while the player rides the roof (after a floor hazard) and the roof while it rides the floor, so the corridor's top and
// bottom change apart (the user: "different corridors (where top and bottom not same height)")
function ballVary(a, mode) {
  const r = vrng(a.vary), w = a.w || 32, g = a.gap || 5, every = a.every || 9, lead = a.lead ?? 5, o = [];
  const top = mode === "swing" ? 8 : 7;
  const F = new Array(w).fill(0), R = new Array(w).fill(g), haz = [];
  const set = (arr, from, v) => { for (let x = from; x < w; x++) arr[x] = v; };
  let k = 0, c = lead; const hist = [];
  while (c < w - 6) {
    let n = vpick(r, [1, 2, 2, 3].filter(x => x < 3 || every >= 8), hist.map(h => h.n));
    if (c + n > w - 6) n = 1;
    hist.push({ n }); haz.push([c, n, k % 2 === 0]);
    const p = c + n + 1;
    if (p < w - 6) {
      if (k % 2 === 0) {   // floor hazard: the player rides the roof from here, the floor may move
        const opts = [0, 1, 2].filter(v => v !== F[p] && v <= R[p] - g);
        if (opts.length && r() < 0.75) set(F, p, opts[Math.floor(r() * opts.length)]);
      } else {             // roof hazard: on the floor now, the roof may move
        const opts = [F[p] + g, F[p] + g + 1, F[p] + g + 2].filter(v => v !== R[p] && v <= top);
        if (opts.length && r() < 0.75) set(R, p, opts[Math.floor(r() * opts.length)]);
      }
    }
    c += every + vint(r, -1, 2); k++;
  }
  // back to the ground for the exit (a step down: safe on either side)
  const last = haz.length ? haz[haz.length - 1][0] + haz[haz.length - 1][1] + 1 : lead;
  if (last < w) set(F, Math.min(w - 3, last), 0);
  for (let x = 0; x < w; x++) { for (let rr = 0; rr < F[x]; rr++) o.push(["block", x, rr]); for (let rr = R[x]; rr <= top; rr++) o.push(["block", x, rr]); }
  for (const [x, n, floor] of haz) for (let i = 0; i < n; i++)
    o.push(floor ? ["spike", x + i, F[x + i]] : ["spike", x + i, R[x + i] - 1, { rot: 180 }]);
  if (a.pit) for (let j = 0; j + 1 < haz.length; j++) {
    const [x, n, floor] = haz[j], nx = haz[j + 1][0];
    for (let xx = x + n + 2; xx < nx - (a.pitClear ?? 3); xx++) o.push(floor ? [9, xx, F[xx], { dy: -13 }] : [9, xx, R[xx] - 1, { dy: 13, rot: 180 }]);
  }
  portals(o, mode, a.portalRow ?? 1, 1, w, a);
  return { objects: o, width: w + (a.exit ? 1 : 0), R };
}
// ufo: obstacles of several kinds (pillar, hanger, a gate of both, floor spikes, a raised step), heights and widths
// varied, the roof up and down a row between them
function ufoVary(a) {
  const r = vrng(a.vary), w = a.w || 32, g = a.gap || 7, every = a.every || 7, lead = a.lead ?? 6, o = [];
  const R = new Array(w).fill(g), obs = [];
  let c = lead; const hist = [];
  while (c < w - 5) {
    const roof = R[c];
    const kinds = ["pillar", "hanger", "gate", "spikes", "step"].filter(kd => kd !== "gate" || roof >= 7);
    const kd = vpick(r, kinds, hist);
    hist.push(kd);
    let wd = vint(r, 1, 3), used = wd;
    if (kd === "pillar") { const h = Math.min(vint(r, 2, 3), roof - 4); for (let i = 0; i < wd; i++) for (let rr = 0; rr < h; rr++) o.push(["block", c + i, rr]); }
    else if (kd === "hanger") { const h = Math.min(vint(r, 1, 3), roof - 4); for (let i = 0; i < wd; i++) for (let rr = roof - h; rr < roof; rr++) o.push(["block", c + i, rr]); }
    else if (kd === "gate") { const h1 = vint(r, 1, 2), h2 = Math.max(1, Math.min(2, roof - 4 - h1)); wd = 1; used = 1; for (let rr = 0; rr < h1; rr++) o.push(["block", c, rr]); for (let rr = roof - h2; rr < roof; rr++) o.push(["block", c, rr]); }
    else if (kd === "spikes") { wd = vint(r, 2, 3); used = wd; for (let i = 0; i < wd; i++) o.push(["spike", c + i, 0]); }
    else if (kd === "step") { wd = vint(r, 4, 6); used = wd; for (let i = 0; i < wd && c + i < w - 4; i++) o.push(["block", c + i, 0]); }
    obs.push([c, used]);
    // the roof moves a row up or down after this obstacle, before the next one
    const nx = c + used + every - 2 + vint(r, -1, 2);
    if (r() < 0.5) { const nr = Math.max(6, Math.min(8, roof + (r() < 0.5 ? -1 : 1))); for (let x = c + used + 2; x < w; x++) R[x] = nr; }
    c = Math.max(nx, c + used + 4);
  }
  for (let x = 0; x < w; x++) for (let rr = R[x]; rr < 9; rr++) o.push(["block", x, rr]);
  portals(o, "ufo", a.portalRow ?? 1, 1, w, a);
  return { objects: o, width: w + (a.exit ? 1 : 0) };
}


// --- spikes on a floor ---
def("spikes", "n spikes side by side (n 1..3 is one jump at 1x; 4+ needs an orb/pad)", (a) => {
  const n = a.n || 1, o = [];
  for (let i = 0; i < n; i++) o.push(["spike", i, 0]);
  return { objects: o, width: n };
});
def("single", "one spike", () => P.spikes.fn({ n: 1 }));
def("double", "two spikes", () => P.spikes.fn({ n: 2 }));
def("triple", "three spikes: the classic hardest ground jump", () => P.spikes.fn({ n: 3 }));
// `at`: the block's column (default 3), `w`: its width (default 1). At 3 the jump over the spike comes
// down at the block's edge, so its window is cut by the block, not the spike (score.js "reactive": GDLM 45
// v6/v7, 117 and 33 ms), and a step 2-5 blocks after the spike is where the jump comes down (GDLM 47 ~29.3 s):
// compose uses at 1, w 3 at Easy/Normal -- one jump clears the spike and lands on the block.
def("spike-block", "spike then a 1-high block (at `at`, `w` wide) to land on and jump off", (a) => {
  const at = a.at || 3, w = a.w || 1, o = [["spike", 0, 0]];
  for (let c = 0; c < w; c++) o.push(["block", at + c, 0]);
  return { objects: o, width: at + w };
});
// `w1`/`w2`: widths of the two blocks (default 1, the old shape). A 1-wide first block makes the cube
// land and jump again at once -- an exact hop, not a reaction (the user on GDLM 45 v6; score.js
// "reactive"): compose uses 2 and 2 at Easy/Normal, so the cube lands, sees the spikes and jumps.
def("block-spike-block", "jump block to block over two spikes (the spikes punish a short hop); w1/w2 = block widths", (a) => {
  const w1 = a.w1 || 1, w2 = a.w2 || 1, o = [];
  for (let c = 0; c < w1; c++) o.push(["block", c, 0]);
  o.push(["spike", w1, 0], ["spike", w1 + 1, 0]);
  for (let c = 0; c < w2; c++) o.push(["block", w1 + 2 + c, 0]);
  return { objects: o, width: w1 + 2 + w2 };
});

// --- terrain ---
// steps 4+ wide (readable climbs, tools/climbs.js: a 3-wide step at 1x is 0.29 s on the ground -- the user on GDLM 68's
// ladder: "almost luck based if i can find where to click"); a.narrow true allows less
def("stairs", "n one-square steps up, w squares each (default and minimum 4), optional spike on the far floor", (a) => {
  const n = a.n || 3, w = a.narrow ? (a.w || 3) : Math.max(4, a.w || 4), o = [];
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
  const w = a.w || 2, rise = a.rise ?? 1, o = [];
  // slabs at one height 2 apart are walked across without a jump, so the spikes under the gaps never
  // matter (the user on GDLM 47 ~18.7 s: "dunno if we have to jump or not ... then there is no point in
  // those spikes"; score.js "hazards matter"): level hops get gaps of 3 or more, which need a jump each
  const n = a.n || 3, gap = rise === 0 ? Math.max(3, a.gap || 2) : (a.gap || 2);
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
// a plain step up onto a w-wide floor one row higher: compose's block terrain is made of these; tools/intent.js
// caches the press for it, so a terrain level's plan is complete without a solve
def("step-up", "a step up one row onto a floor w wide (default 4)", (a) => P.platform.fn({ w: a.w || 4, h: 1 }));

// --- orbs and pads ---
def("orb-pit", "yellow orb over a long spike run (n spikes); click the orb at the top of a jump", (a) => {
  const n = a.n || 5, o = [];
  for (let i = 0; i < n; i++) o.push(["spike", i, 0]);
  o.push(["yellow orb", Math.floor(n / 2), a.orbRow || 2]);
  return { objects: o, width: n };
});
def("pad-launch", "yellow pad on the floor, a run of n spikes (default 3) after it", (a) => {
  // 3 by default: the pad's arc at 1x does not clear 4, and the player then has to jump before the pad
  // to arrive high -- a prejump (GDLM 47's finale; GDLM 41/45 set n: 3 by hand)
  const n = a.n || 3, o = [["yellow pad", 0, 0]];
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
// exitRow: a number (the portal's centre row; it covers that row and one either side, blocks above and
// below), or [r0, r1]: the portal is stretched (scaleY, key 129: its 86-unit box grows with it) to fill
// rows r0..r1 exactly, so a corridor wider than 3 rows needs no one-block hanger above it
function portals(o, mode, entryRow, exitRow, w, a) {
  if (a.portal) o.push([mode + " portal", -1, entryRow]);
  if (a.exit) {
    const [r0, r1] = Array.isArray(exitRow) ? exitRow : [exitRow - 1, exitRow + 1];
    const span = r1 - r0 + 1;
    o.push([a.exit + " portal", w, (r0 + r1) / 2, span === 3 ? undefined : { props: { 129: String(+(span * 30 / 86).toFixed(3)) } }]);
    for (let r = 0; r < 10; r++) if (r < r0 || r > r1) o.push(["block", w, r]);
  }
}
def("ship-tunnel", "a ship corridor (band rows 0-9): floor and roof follow `waves` sine waves, `gap` rows of air, teeth on the bends; portal/exit options; `vary` (a seed): segments with their own floor / roof heights and motifs instead", (a) => {
  if (a.vary) return shipVary(a);
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
    const te = a.teethEvery || 8;   // dense: 6 (STRUCTURES.md "Dense chains, other modes")
    const tooth = a.teeth && flatHere && c >= lead && ((c - lead) % te === 0 || (c - lead) % te === te / 2);
    if (a.teeth && flatHere && c >= lead && (c - lead) % te === 0) o.push(["spike", c, f]);
    if (a.teeth && flatHere && c >= lead && (c - lead) % te === te / 2) o.push(["spike", c, roof - 1, { rot: 180 }]);
    // `pit`: the low spikes (id 9, sunk 13 units) along the flat floor after the lead-in, as a hazard floor
    // (Jumper / xStep ships fly over one): not on a step, not next to a tooth, not in the last 3 columns
    if (a.pit && flatHere && !tooth && c >= lead && c < w - 3 && f >= 0) o.push([9, c, f, { dy: -13 }]);
  }
  const mid = c => floorAt(c) + (gap - 1) / 2;
  portals(o, "ship", a.portalRow ?? Math.min(5, Math.round(mid(0))), Math.round(mid(w - 1)), w, a);
  return { objects: o, width: w + (a.exit ? 1 : 0) };
});
def("wave-zigzag", "a wave corridor (band rows 0-9): the path climbs and falls 45 degrees, `seg` columns per leg, `gap` rows of room, `flat` level columns at each peak and valley, `lead` level columns at the entry (`leadGap` rows of room there); portal/exit options", (a) => {
  // `flat`: with 45-degree slope walls the wave flies exactly parallel to them, and at a turn the next
  // leg's slope meets it head-on -- which kills (physics, 2026-11-23: GDLM 44's zigzag turns were
  // 13-88 ms, "i still couldnt fit into the gap"). A flat roof or floor at each turn is met at 45
  // degrees, so the wave slides along it and can turn anywhere on it: ~95 ms per flat column at 1x.
  const seg = a.seg || 4, legs = a.legs || 4, gap = a.gap || 4, low = a.low ?? 2, flat = a.flat || 0, lead = a.lead || 0, o = [];
  const L = seg + flat, w = lead + L * legs;
  // the entry's roof with `leadGap` (its bottom row): the first leg keeps it until its own roof climbs to
  // it, so the slope joins it flush -- dropping straight to the leg's roof left an open step in the
  // ceiling (the user, GDLM 44 round 2: "disconnected structure"; tools/joins.js checks it)
  let leadRoof = null, joined = true;
  if (a.slopes && a.leadGap && lead) { leadRoof = low - Math.floor(a.leadGap / 2) + a.leadGap; joined = false; }   // unclamped, as the entry's roof
  const midAt0 = c => { if (c < lead) return low; c -= lead; const leg = Math.floor(c / L), k = Math.min(c % L, seg); return low + (leg % 2 === 0 ? k : seg - k); };
  // : legs of their own length and height (the user on GDLM 71: "structure is 4 times. should be 2 max")
  const VM = a.vary ? waveVaryPath(a, w) : null;
  const midAt = c => VM ? VM[Math.max(0, Math.min(w - 1, c))] : midAt0(c);
  for (let c = 0; c < w; c++) {
    if (a.slopes) {
      // walls of 45-degree slopes along the legs, so the corridor is a straight diagonal (square
      // blocks made it a staircase: "the wave looks like cube", playtest GDLM 44 v3). The sim models
      // floor slopes and treats ceiling slopes as full blocks, so it checks with less room than the game.
      const m0 = midAt(c), m1 = c + 1 < w ? midAt(c + 1) : m0, up = m1 > m0;
      if (m0 === m1) { // level: floor below row m0 - gap/2, roof from `gap` rows above it
        // `leadGap`: more room in the `lead` columns, so a wave that enters with the button held (or
        // let go) has ~300 ms before it meets the roof (or floor) -- tools/fairness.js "switch"
        // (WAVE_DEADLINE); GDLM 46 v3's ship -> wave entrance gave 100 ms with the corridor's 3 rows
        const g = c < lead && a.leadGap ? a.leadGap : gap;
        // the roof from the UNclamped floor row, so it joins the legs' slopes flush: with the floor
        // clamped at the ground (low < gap/2) the level roof sat a row above the first slope and left a
        // hanging notch at the mouth (the user on GDLM 50 v2's wave entrance: "this entrance is wrong in
        // its shape"; tools/softrules.js "stubs")
        const f0 = m0 - Math.floor(g / 2), f = Math.max(0, f0);
        if (g !== gap) {
          for (let r = f0 + g; r < 10; r++) o.push(["block", c, r]);
          // the floor ramps up to meet the first leg's floor flush (a 1-row step there was an open edge)
          const fl1 = Math.min(midAt(lead), midAt(lead + 1)) - Math.floor(gap / 2), k = c - (lead - (fl1 - f));
          if (k >= 0 && k < fl1 - f) { for (let r = 0; r < f + k; r++) o.push(["block", c, r]); o.push(["slope", c, f + k, {}]); }
          continue;
        }
        for (let r = 0; r < f; r++) o.push(["block", c, r]);
        let roof = f0 + gap;
        if (!joined) { if (roof < leadRoof) roof = leadRoof; else joined = true; }
        for (let r = roof; r < 10; r++) o.push(["block", c, r]);
        // `teeth`: at a flat turn, a spike on the side the wave is NOT on (a floor spike under a peak, where the
        // wave slides along the roof; a hanging one over a valley), only with 4+ rows of room
        if (VM && a.teeth && c >= lead && gap >= 4 && f0 >= 0) {
          // the middle of each level run: a floor spike under a peak, a hanging one over a valley
          let s0 = c, s1 = c; while (s0 > lead && VM[s0 - 1] === VM[c]) s0--; while (s1 < w - 1 && VM[s1 + 1] === VM[c]) s1++;
          if (c === Math.floor((s0 + s1) / 2) && s1 < w - 3 && s0 > lead) { if (VM[s0 - 1] < VM[c]) o.push(["spike", c, f]); else o.push(["spike", c, roof - 1, { rot: 180 }]); }
        } else if (a.teeth && c >= lead && gap >= 4 && f0 >= 0) {
          const peak = midAt(c) > low && (c - lead) % L >= seg;
          const kk = (c - lead) % L - seg, leg = Math.floor((c - lead) / L);
          if (kk === Math.floor(flat / 2)) { if (leg % 2 === 0) o.push(["spike", c, f]); else o.push(["spike", c, roof - 1, { rot: 180 }]); }
        }
        continue;
      }
      const fl = Math.min(m0, m1) - Math.floor(gap / 2);       // floor slope row
      const cl = Math.max(m0, m1) - Math.floor(gap / 2) + gap - 1; // ceiling slope row
      for (let r = 0; r < fl; r++) o.push(["block", c, r]);
      if (fl >= 0) o.push(["slope", c, fl, up ? {} : { flipX: true }]);
      // ceiling: a rising roof is the slope turned over both ways (solid top-left), a falling roof
      // only upside down (solid top-right)
      if (!joined && c >= lead) {
        if (cl < leadRoof || !up) { for (let r = leadRoof; r < 10; r++) o.push(["block", c, r]); continue; }  // still under the entry's roof
        joined = true;   // the rising roof meets the entry's roof here: flush
      }
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
  // a corridor ending level: the exit portal fills the corridor's mouth (floor to roof), flush
  const f1 = midAt(w - 1) - Math.floor(gap / 2);
  portals(o, "wave", a.portalRow ?? Math.min(5, midAt(0)), endFlat ? [Math.max(0, f1), f1 + gap - 1] : midAt(w - 1), w, a);
  return { objects: o, width: w + (a.exit ? 1 : 0) };
});

def("ball-run", "a ball corridor (band rows 0-7 from a portal on the ground): a roof `gap` rows up, spikes alternating floor / roof every `every` columns after `lead`, so each one is a flip; portal/exit options", (a) => {
  // The ball flips gravity on a tap and takes ~0.35 s (3-4 blocks at 1x) to cross a 5-row room,
  // so hazards come `every` (default 9) columns apart at Easy. The roof is solid all along: a
  // ball rolling on the band's invisible ceiling would not read. Floor spikes come in pairs or
  // alone (variety), the roof's hang one row under it.
  if (a.vary) { const { R, ...res } = ballVary(a, a._mode || "ball"); return res; }
  const w = a.w || 32, gap = a.gap || 5, every = a.every || 9, lead = a.lead ?? 5, o = [];
  for (let c = 0; c < w; c++) for (let r = gap; r < 8; r++) o.push(["block", c, r]);
  let k = 0;
  for (let c = lead; c < w - 6; c += every, k++) {
    const n = k % 4 === 2 ? 1 : 2;               // 2, 2, 1, 2, ...
    for (let i = 0; i < n; i++) {
      if (k % 2 === 0) o.push(["spike", c + i, 0]);
      else o.push(["spike", c + i, gap - 1, { rot: 180 }]);
    }
    // `pit`: after a floor spike the ball rides the roof until the next (roof) spike, so the floor under that ride
    // is a hazard floor of low spikes (and the roof after a roof spike) -- 2 columns clear after the spike, and
    // `pitClear` (3) before the next one, where the ball flips back
    if (a.pit && c + every < w - 6) for (let x = c + n + 2; x < c + every - (a.pitClear ?? 3); x++)
      o.push(k % 2 === 0 ? [9, x, 0, { dy: -13 }] : [9, x, gap - 1, { dy: 13, rot: 180 }]);
  }
  // exit on the floor (the frame forces a last flip down when the ball rides the roof)
  portals(o, a._mode || "ball", a.portalRow ?? 1, 1, w, a);
  return { objects: o, width: w + (a.exit ? 1 : 0) };
});
// The swing (2.2): a tap flips its gravity like the ball's, but it flies (a smooth arc, no rolling), so the same
// floor / roof alternation reads for it; a little more room (gap 6) since it swings past the middle row.
// Space level (GDLM 71, the user: "Bit more flying with space").
def("swing-run", "a swing corridor (band rows 0-7 from a portal on the ground): a roof `gap` (6) rows up, spikes alternating floor / roof every `every` (8) columns, each one a flip; portal/exit options", (a) =>
  (() => {
    // its gravity flips stay after the cube portal (GDLM 71 p5 left upside down in the air): a blue gravity portal in the
    // exit funnel, one column before it, puts it back
    const r = P["ball-run"].fn(Object.assign({ gap: 6, every: 8 }, a, { _mode: "swing" }));
    if (a.exit) { const w = a.w || 32; r.objects.push(["gravity up", w - 1, 1]); for (let rr = 3; rr < (a.gap || 6); rr++) r.objects.push(["block", w - 1, rr]); }
    return r;
  })());
// The spider (GDLM 72 FROSTBITE: "a spider section with quick teleport timings"): a tap teleports it to the other side at
// once, so the ball's floor / roof alternation reads for it, closer together (`every` 6). Its gravity is put back in the
// exit funnel as the swing's is.
def("spider-run", "a spider corridor (band rows 0-7 from a portal on the ground): a roof `gap` (5) rows up, spikes alternating floor / roof every `every` (6) columns, each one a teleport; portal/exit options", (a) =>
  (() => {
    const r = P["ball-run"].fn(Object.assign({ gap: 5, every: 6 }, a, { _mode: "spider" }));
    if (a.exit) { const w = a.w || 32; r.objects.push(["gravity up", w - 1, 1]); for (let rr = 3; rr < (a.gap || 5); rr++) r.objects.push(["block", w - 1, rr]); }
    return r;
  })());
// The UFO: a tap is a hop, it falls between taps (flappy). A corridor with a solid roof `gap` rows up; pillars from the
// floor (2 or 3 rows, 2 wide) alternate with hangers from the roof (2 rows), `every` columns apart after `lead`, so
// the player hops over a pillar, then lets the UFO sink under a hanger.
def("ufo-run", "a ufo corridor (band rows 0-8 from a portal on the ground): roof `gap` (7) rows up, floor pillars (2-3 rows) alternating with roof hangers (2 rows) every `every` (7) columns; portal/exit options", (a) => {
  if (a.vary) return ufoVary(a);
  const w = a.w || 32, gap = a.gap || 7, every = a.every || 7, lead = a.lead ?? 6, o = [];
  for (let c = 0; c < w; c++) for (let r = gap; r < 9; r++) o.push(["block", c, r]);
  let k = 0;
  for (let c = lead; c < w - 6; c += every, k++) {
    if (k % 2 === 0) { const h = k % 4 === 0 ? 2 : 3; for (let i = 0; i < 2; i++) for (let r = 0; r < h; r++) o.push(["block", c + i, r]); }
    else for (let i = 0; i < 2; i++) for (let r = gap - 2; r < gap; r++) o.push(["block", c + i, r]);
  }
  portals(o, "ufo", a.portalRow ?? 1, 1, w, a);
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
    const low = t === 9 || t === 61;   // the low pit spikes (sunk with dy): turned over, sunk into the ceiling
    if (t !== "block" && t !== "spike" && !low) throw new Error(`mirrorUp: ${t} upside down is not supported`);
    const e2 = Object.assign({}, e || {});
    if (t === "spike" || low) e2.rot = ((e2.rot || 0) + 180) % 360;
    if (low && e2.dy) e2.dy = -e2.dy;
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

// the structure library (tools/structures.js, STRUCTURES.md) as patterns named "s:<id>"
require("./structures.js").register(P);

// The lego path (LEGO.md): ONE path for the flying family -- ship, wave, swing -- wrapped in different ways (the user,
// 2026-11-25: "ship wave and swing have some similarity in their possible structures. a path, a path with some spikes,
// corridors. corridors with paths"). Band rows 0-9.
//   rows   the path's height at each knot (rows above the ground), e.g. [2, 6, 2, 6]
//   seg    columns per leg for ship / swing (a wave leg is always 45 degrees: |rise| columns); flat: level columns at
//          each knot (the turn); lead / tail: level columns before the first and after the last knot
//   wrap   "corridor" (floor + roof) | "floor" (a floor path, open above) | "roof" (a roof path) | "open" (no walls:
//          only the band; spikes / gates then mark the path)
//   gap    rows of room around the path (corridor); spikes: "none" | "turns" (one on the far side at each flat turn) |
//          "floor" / "roof" / "both" (along that wall's level stretches, `every` columns apart)
//   gates  a list of knot indexes where the room narrows to `gateGap` rows for one column (a pillar from the floor and a
//          hanger from the roof, the path threading between)
//   flipAt knot indexes that get a gravity portal (instead of turns: "flip" = every inner knot)
//   turns  "click" (the player turns the path) | "flip" (a gravity portal at every turn: the same path is flown
//          holding through -- the user's sketch 11-25 17:06, "portals are on the meeting point so you can hold/release
//          more for the same path") | "mix" (every other turn); wave and ship only
def("fly-path", "one path for ship / wave / swing (`mode`), wrapped as corridor / floor / roof / open, with spikes, gates and click- or portal-turns (LEGO.md)", (a) => {
  const mode = a.mode || "wave", wave = mode === "wave", rows = a.rows || [2, 6, 2, 6], seg = a.seg || 5, flat = a.flat ?? 2;
  const lead = a.lead ?? 4, tail = a.tail ?? 3, gap = a.gap || (wave ? 4 : 5), wrap = a.wrap || "corridor", o = [];
  // the path, a row per column
  const m = [], knots = [];
  for (let c = 0; c < lead; c++) m.push(rows[0]);
  rows.forEach((r, i) => {
    // legs are 45 degrees (|rise| columns, slopes on both walls: smooth for every mode -- the user on a stair-stepped
    // ship corridor: "i wanted smooth play in those corridors"); `stairs: true` (ship / swing) spreads a leg over `seg`
    // columns of block steps instead
    if (i) { const d = r - rows[i - 1], n = wave || !a.stairs ? Math.abs(d) : Math.max(Math.abs(d), seg); for (let k = 1; k <= n; k++) m.push(rows[i - 1] + Math.round(d * k / n)); }
    knots.push(m.length);
    if (i < rows.length - 1) for (let k = 0; k < flat; k++) m.push(r);
  });
  for (let c = 0; c < tail; c++) m.push(rows[rows.length - 1]);
  const w = m.length, lo = Math.floor(gap / 2), floorWall = wrap === "corridor" || wrap === "floor", roofWall = wrap === "corridor" || wrap === "roof";
  const gateAt = new Set((a.gates || []).map(i => knots[Math.min(i, knots.length - 1)] + (flat ? Math.floor(flat / 2) : 0)));
  const gg = a.gateGap || Math.max(3, gap - 2), every = a.every || 4;
  for (let c = 0; c < w; c++) {
    const m0 = m[c], m1 = c + 1 < w ? m[c + 1] : m0;
    if (m0 !== m1 && Math.abs(m1 - m0) === 1 && !gateAt.has(c)) {
      // a 45-degree step: slopes on both walls, as wave-zigzag (the wave rides them; ship and swing see a smooth wall)
      const fl = Math.min(m0, m1) - lo, cl = Math.max(m0, m1) - lo + gap - 1, up = m1 > m0;
      if (floorWall) { for (let r = 0; r < fl; r++) o.push(["block", c, r]); if (fl >= 0) o.push(["slope", c, fl, up ? {} : { flipX: true }]); }
      if (roofWall) { if (cl <= 9) o.push(["slope", c, cl, up ? { flipX: true, flipY: true } : { flipY: true }]); for (let r = cl + 1; r < 10; r++) o.push(["block", c, r]); }
      continue;
    }
    // level (or a steeper ship step: blocks)
    const mm = Math.min(m0, m1), MM = Math.max(m0, m1), gate = gateAt.has(c);
    const f = gate ? m0 - Math.floor(gg / 2) : mm - lo, roof = gate ? m0 - Math.floor(gg / 2) + gg : MM - lo + gap;
    if (floorWall || gate) for (let r = 0; r < f; r++) o.push(["block", c, r]);
    if (roofWall || gate) for (let r = Math.max(roof, 0); r < 10; r++) o.push(["block", c, r]);
    if (gate || c < lead || c >= w - tail) continue;
    const k = knots.findIndex(x => c >= x && c < x + flat);
    if (a.spikes === "turns" && k > 0 && c === knots[k] + Math.floor(flat / 2) && gap >= 4) {
      const peak = rows[k] > rows[k - 1];
      if (peak && floorWall) o.push(["spike", c, Math.max(0, f)]); else if (!peak && roofWall && roof - 1 <= 9) o.push(["spike", c, roof - 1, { rot: 180 }]);
    }
    if (/floor|both/.test(a.spikes || "") && floorWall && m0 === m1 && c % every === 0 && f >= 0) o.push(["spike", c, f]);
    if (/roof|both/.test(a.spikes || "") && roofWall && m0 === m1 && c % every === 2 && roof <= 9) o.push(["spike", c, roof - 1, { rot: 180 }]);
  }
  // turns by portal: a gravity portal on the path at the turn (the middle of the flat): going up into a peak it turns
  // the player upside down, so the held button now flies down (and back at the next valley)
  if ((a.turns === "flip" || a.turns === "mix" || a.flipAt) && mode !== "swing") {
    let g = 1;
    rows.forEach((r, i) => {
      if (i === 0 || i === rows.length - 1) return;
      if (a.turns === "mix" && i % 2 === 0) return;
      if (a.flipAt && !a.flipAt.includes(i)) return;   // only at these knots (the user's sketch puts them where he wants)
      const c = knots[i] + Math.floor(flat / 2);
      g = -g; o.push([g === -1 ? "gravity down" : "gravity up", c, r]);
    });
    if (g === -1) o.push(["gravity up", w - 1, m[w - 1]]);   // leave in normal gravity
  }
  const exitRow = m[w - 1];
  portals(o, mode, a.portalRow ?? Math.min(5, m[0]), exitRow, w, a);
  return { objects: o, width: w + (a.exit ? 1 : 0), exitRow, path: m, knots };
});

module.exports = { PATTERNS: P, expand, mirrorUp };
if (require.main === module) for (const [k, v] of Object.entries(P)) console.log(k.padEnd(18), v.doc);
