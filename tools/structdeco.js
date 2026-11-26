// node tools/structdeco.js <level.gdlvl> [--route <wip.json | solution.json>] [--spec '<json>'] [--out <file>]
//   -> the level's gameplay structures dressed by the structure deco pass (what make.js runs as its deco step)
//
// THE STRUCTURE DECO PASS (DECOART.md "The structure deco pass"; Evgeni 2026-11-26: "i want to use the deco knowledge we
// now gaining later during the deco stage"). One place that applies what the deco-art thread learned, so every new level
// gets it, not only the Hellgate copies:
//   designs per structure   a design follows the whole structure (tools/structdesign.js: outline, inline, inner base,
//                           corners and notches, slopes both ways), not one box per block
//   one look per section    one block design (+ palette + 3D effect) per section, changed only when the vibe changes,
//                           2-3 looks a level at most ("the director"): a structure takes the look of the section its left
//                           end is in, so a structure is never cut in two looks
//   3D                      effects: depth, bevel, long depth, depth + bevel
//   big structures inside   panel seams, rivets, lamps, a layer line along the shape, a top-lit gradient (interior/shade)
//   holders                 islands held by ropes / chains / rods near their ends, bridges between close islands, never
//                           where the route passes, never across a portal (tools/connect.js)
// Jump indicators (style, a colour away from the hazards) stay in make.js's indicator step (tools/indstyles.js).
// Spec key (make.js):
//   "structures": true                                      the defaults: layered, fire palette (ice for an ice theme),
//                                                           chain holders, inside on
//   "structures": {"design": "inner base", "pal": "ice", "effects": ["depth"], "holders": "rope", "interior": true}
//   "structures": {"sections": [{"from": 0, "design": "layered", "pal": "fire"}, {"from": 120, "design": "nested frames",
//                  "pal": "ice", "effects": ["bevel"]}], "holders": "chain"}      from = block column
//   pal: a name in tools/blockdesigns.js PAL (ice, fire) or {role: [r, g, b], ...} for every role there
//   holders: false = none. Channels: a look's palette takes 10 channels (912, 922, 933 for the 1st-3rd palette).
//   pass(level, events, opts) -> {objects, header, notes}: deco only, the gameplay never changes (no re-solve)
"use strict";
const fs = require("fs");
const K = require("./scenekit.js"), SD = require("./structdesign.js"), CN = require("./connect.js"), B = require("./blockdesigns.js");
const SOLID = id => (id >= 1 && id <= 7) || id === 1338;
const PORTAL = new Set([12, 13, 47, 111, 660, 745, 1331, 1933, 10, 11, 200, 201, 202, 203, 1334, 99, 101, 286, 287]);
const CH0 = [912, 922, 933], MAX_LOOKS = 3;

function normalise(opts, spec = {}) {
  if (opts === true || opts == null) opts = {};
  const themeName = spec.theme && (typeof spec.theme === "string" ? spec.theme : spec.theme.name);
  const base = { design: opts.design || "layered", pal: opts.pal || (themeName === "ice" ? "ice" : "fire"), effects: opts.effects || [] };
  const secs = (opts.sections && opts.sections.length ? opts.sections : [{ from: 0 }]).map(s => Object.assign({}, base, s)).sort((a, b) => a.from - b.from);
  return { secs, holders: opts.holders === undefined ? "chain" : opts.holders, interior: opts.interior !== false };
}

function pass(level, events, opts, spec) {
  const o = normalise(opts, spec), notes = [];
  // palettes: one channel block per distinct palette
  const palKey = p => typeof p === "string" ? p : JSON.stringify(p), pals = new Map();
  for (const s of o.secs) if (!pals.has(palKey(s.pal))) {
    if (pals.size >= CH0.length) throw new Error(`structures: more than ${CH0.length} palettes`);
    const P = typeof s.pal === "string" ? B.PAL[s.pal] : s.pal; if (!P) throw new Error("structures: no palette " + s.pal);
    pals.set(palKey(s.pal), B.channels(P, CH0[pals.size]));
  }
  let header = level.header;
  for (const p of pals.values()) header = K.channels(header, p.defs);
  const looks = new Set(o.secs.map(s => s.design + "|" + palKey(s.pal) + "|" + s.effects.join("+")));
  if (looks.size > MAX_LOOKS) notes.push(`WARN ${looks.size} structure looks: the rule is 2-3 a level (knowledge/checklist.md "One block design and one spike design at a time")`);
  // whole structures, each to the section of its left end
  const blocks = level.objects.filter(b => SOLID(b.id));
  const secOf = x => { let k = 0; o.secs.forEach((s, i) => { if (x >= s.from * 30 - 1) k = i; }); return k; };
  const groups = o.secs.map(() => []);
  for (const st of SD.structures(blocks)) {
    let cmin = Infinity; for (const k of st.S) cmin = Math.min(cmin, +k.split(",")[0]);
    const x0 = cmin * 30 + st.ox;
    const mine = blocks.filter(b => st.S.has(Math.round((b.x - 15 - st.ox) / 30) + "," + Math.round((b.y - 15 - st.oy) / 30)));
    groups[secOf(x0)].push(...mine);
  }
  const out = [];
  o.secs.forEach((s, i) => { if (!groups[i].length) return;
    out.push(...SD.dress(groups[i], s.design, pals.get(palKey(s.pal)).C, { effects: s.effects, interior: o.interior })); });
  let tally = {};
  if (o.holders) {
    const pathCells = events ? CN.routeCells(level, events) : new Set();
    if (!events) notes.push("WARN holders without a route: nothing kept clear for the player");
    const breaks = level.objects.filter(b => PORTAL.has(b.id)).map(b => b.x);
    const conns = CN.connectors(blocks, { pathCells, breaks });
    for (const q of conns) tally[q.kind] = (tally[q.kind] || 0) + 1;
    // each connector in the palette of the section it starts in
    o.secs.forEach((s, i) => { const mine = conns.filter(q => secOf(Math.min(q.x0, q.x1)) === i);
      if (mine.length) out.push(...CN.draw(mine, pals.get(palKey(s.pal)).C, { style: s.holders || o.holders })); });
  }
  notes.unshift(`structures: ${SD.structures(blocks).length} dressed in ${looks.size} look(s) (${o.secs.map(s => `${s.from}: ${s.design}/${typeof s.pal === "string" ? s.pal : "custom"}${s.effects.length ? "+" + s.effects.join("+") : ""}`).join(", ")}), +${out.length} objects; holders ${o.holders ? JSON.stringify(tally) : "off"}`);
  return { objects: out, header, notes };
}

// make.js: dress level in place (deco only)
function apply(level, events, spec) {
  if (!spec || !spec.structures) return;
  try {
    const r = pass(level, events, spec.structures, spec);
    level.objects.push(...r.objects); level.header = r.header;
    for (const n of r.notes) console.log("   " + n);
  } catch (e) { console.log("   structures: skipped (" + e.message + ")"); }
}

module.exports = { pass, apply, normalise };
if (require.main === module) {
  const a = process.argv.slice(2), opt = n => { const i = a.indexOf(n); return i >= 0 ? a[i + 1] : null; };
  if (!a[0]) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(0); }
  const { readGdlvl, writeGdlvl } = require("./io.js"), R = readGdlvl(a[0]);
  let events = null;
  if (opt("--route")) { const j = JSON.parse(fs.readFileSync(opt("--route"), "utf8")); events = (j.solution || j).events; }
  const r = pass(R.level, events, opt("--spec") ? JSON.parse(opt("--spec")) : true, {});
  r.notes.forEach(n => console.log(n));
  const out = opt("--out") || a[0].replace(/\.gdlvl$/, "_dressed.gdlvl");
  writeGdlvl(out, R.rec, { header: r.header, objects: R.level.objects.concat(r.objects) }); console.log("-> " + out);
}
