// The craft pass (CRAFT.md): decoration that BELONGS to the structures, the way RobTop dresses Jumper and
// xStep -- rods on pillar tops, rods under hanging columns, chains holding floating pieces and orbs up --
// instead of loose background deco. Used by tools/make.js when a spec has "craft": true (or an options
// object, below); run after the block skins. Deterministic (seeded). Only decoration: no hitboxes.
//
//   craftPass(objects, opts) -> new objects to add
//     opts.seed        (1)
//     opts.rods        share of eligible ground-pillar tops that get a rod (0.3; official ~0.2-0.35)
//     opts.underRods   share of hanging-column ends that get a rod pointing down (0.35)
//     opts.chains      chains over floating pieces (true): every floating piece (not on the ground, not
//                      part of a ceiling) hangs on one chain (<= 2 wide) or two (wider), stacked up to
//                      opts.top (row 11) or the solid above
//     opts.lanterns    chains over orbs and pads in the air (true; xStep hangs 15 orbs this way)
//     opts.skipCols    [[c0,c1], ...] column ranges to leave bare (a calm stretch, a title)
// Offsets measured on the official levels (tools/craft.js, CRAFT.md "Deco attached to structures"):
// rod 16 29 units above its block's centre (flipped: 29 below), rod 15 36 above, chain 41 48 above a
// block's or orb's centre and 70 units per link segment upward.
const { GD } = require("./io.js");

const CHAIN = 41, ROD = 16, TALL_ROD = 15, CH_LEN = 70;
const cellOf = o => [Math.floor(o.x / 30), Math.floor(o.y / 30)];
const key = (c, r) => c + "," + r;

function craftPass(objects, opts = {}) {
  const o = Object.assign({ seed: 1, rods: 0.3, underRods: 0.35, chains: true, lanterns: true, top: 11, skipCols: [] }, opts);
  let s = o.seed * 7919 + 13;
  const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const skip = c => o.skipCols.some(([a, b]) => c >= a && c < b);
  const S = new Set(), H = new Set(), P = new Map(), D = new Set();
  for (const ob of objects) {
    const k = GD.objInfo(ob.id).kind, [c, r] = cellOf(ob);
    if (k === "solid" || k === "slope" || (ob.id >= 1 && ob.id <= 7)) S.add(key(c, r));
    else if (k === "hazard") H.add(key(c, r));
    else if (["orb", "pad"].includes(k)) P.set(key(c, r), ob);
    else if (k === "decoration") D.add(key(c, r));
  }
  const free = (c, r) => !S.has(key(c, r)) && !H.has(key(c, r)) && !P.has(key(c, r));
  // pieces: 4-connected solid cells
  const seen = new Set(), pieces = [];
  for (const k0 of S) {
    if (seen.has(k0)) continue; const st = [k0], cells = []; seen.add(k0);
    while (st.length) { const q = st.pop(); cells.push(q.split(",").map(Number)); const [c, r] = cells[cells.length - 1];
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = key(c + dc, r + dr); if (S.has(n) && !seen.has(n)) { seen.add(n); st.push(n); } } }
    const xs = cells.map(p => p[0]), ys = cells.map(p => p[1]);
    pieces.push({ cells, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) });
  }
  const out = [], obj = (id, x, y, extra = {}) => out.push(Object.assign({ id, x, y, rot: 0, flipX: false, flipY: false, props: { 155: "1" } }, extra));
  const topOf = (p, c) => Math.max(...p.cells.filter(q => q[0] === c).map(q => q[1]));
  const botOf = (p, c) => Math.min(...p.cells.filter(q => q[0] === c).map(q => q[1]));
  // a chain from (x, y0) up to row `top` or to the first solid above
  const chainUp = (c, yStart) => {
    for (let y = yStart, n = 0; n < 6; y += CH_LEN, n++) {
      const r = Math.floor((y + 35) / 30);
      if (r > o.top || S.has(key(c, r)) || S.has(key(c, r - 1)) && y > yStart) break;
      obj(CHAIN, c * 30 + 15, y);
    }
  };
  for (const p of pieces) {
    if (skip(p.x0)) continue;
    const w = p.x1 - p.x0 + 1, h = p.y1 - p.y0 + 1;
    const grounded = p.y0 <= 0, ceiling = p.y1 >= o.top - 2 && h >= 2;
    if (grounded && w <= 2) {
      // a ground pillar: a rod on its top, when the two cells above are clear
      const c = p.x0, t = topOf(p, c);
      if (free(c, t + 1) && free(c, t + 2) && !D.has(key(c, t + 1)) && rnd() < o.rods)
        h >= 4 ? obj(TALL_ROD, c * 30 + 15, t * 30 + 15 + 36) : obj(ROD, c * 30 + 15, t * 30 + 15 + 29);
    } else if (ceiling && w <= 2) {
      // a hanging column: a rod pointing down under its end
      const c = p.x0, b = botOf(p, c);
      if (b > 1 && free(c, b - 1) && free(c, b - 2) && rnd() < o.underRods) obj(ROD, c * 30 + 15, b * 30 + 15 - 29, { flipY: true });
    } else if (!grounded && !ceiling && o.chains) {
      // a floating piece hangs on chains: one in the middle (<= 2 wide), else one near each end
      const cols = w <= 2 ? [p.x0] : [p.x0 + (w >= 5 ? 1 : 0), p.x1 - (w >= 5 ? 1 : 0)];
      for (const c of cols) { const t = topOf(p, c); if (free(c, t + 1)) chainUp(c, t * 30 + 15 + 48); }
      // and a rod pointing down under an end (Jumper: 17 under-block rods); never on a long ceiling --
      // a ball or an upside-down cube runs along those
      if (w <= 4) for (const c of [p.x0, p.x1]) { const b = botOf(p, c);
        if (b > 1 && free(c, b - 1) && free(c, b - 2) && rnd() < o.underRods * 1.5) { obj(ROD, c * 30 + 15, b * 30 + 15 - 29, { flipY: true }); break; } }
    }
  }
  if (o.lanterns) for (const [k, ob] of P) {
    const [c, r] = k.split(",").map(Number);
    if (r < 2 || skip(c) || GD.objInfo(ob.id).kind !== "orb") continue;   // pads sit on surfaces; orbs in the air hang
    if (free(c, r + 1) && free(c, r + 2)) chainUp(c, ob.y + 48);
  }
  return out;
}

module.exports = { craftPass };
