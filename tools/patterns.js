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
def("ship-tunnel", "a ship corridor (band rows 0-9): floor and roof follow a wave, `gap` rows of air, teeth on the bends", (a) => {
  const w = a.w || 16, gap = a.gap || 4, amp = a.amp ?? 2, base = a.base ?? 2, o = [];
  for (let c = 0; c < w; c++) {
    const f = Math.round(base + amp * Math.sin(c / w * 2 * Math.PI)); // floor top row (blocks 0..f-1)
    const roof = f + gap;                                              // first roof row
    for (let r = 0; r < f; r++) o.push(["block", c, r]);
    for (let r = roof; r < 10; r++) o.push(["block", c, r]);
    if (a.teeth && c % 4 === 2) { o.push(["spike", c, f]); o.push(["spike", c, roof - 1, { rot: 180 }]); }
  }
  return { objects: o, width: w };
});
def("wave-zigzag", "a wave corridor (band rows 0-9): the path climbs and falls 45 degrees, `seg` columns per leg, `gap` rows", (a) => {
  const seg = a.seg || 4, legs = a.legs || 4, gap = a.gap || 3, low = a.low ?? 1, o = [];
  const w = seg * legs;
  for (let c = 0; c < w; c++) {
    const leg = Math.floor(c / seg), k = c % seg;
    const mid = low + (leg % 2 === 0 ? k : seg - k);  // path row at this column
    const bottom = mid - Math.floor(gap / 2), top = bottom + gap;
    for (let r = 0; r < bottom; r++) o.push(["block", c, r]);
    for (let r = top; r < 10; r++) o.push(["block", c, r]);
  }
  return { objects: o, width: w };
});

// expand one spec entry ["pattern", name, col, row, args] into plain entries
function expand(name, col, row, args, extra) {
  const p = P[name];
  if (!p) throw new Error(`unknown pattern "${name}" (known: ${Object.keys(P).join(", ")})`);
  const r = p.fn(args || {});
  return r.objects.map(([t, c, rr, e]) => [t, col + c, row + rr, Object.assign({}, e || {}, extra || {})]);
}

module.exports = { PATTERNS: P, expand };
if (require.main === module) for (const [k, v] of Object.entries(P)) console.log(k.padEnd(18), v.doc);
