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
//   "theme": a design theme (tools/designthemes.js: hellgate, frost, toxic, void, temple) for the level or a section; any
//   field next to it overrides the theme's ({"theme": "frost", "spikes": "glow"}), or no theme and every field given:
//   themes are presets, changed or extended on the fly when making a level (Evgeni). Its spikes / saws designs dress the
//   section's hazards (tools/spikedesign.js) in the same palette; its indicator goes to make.js's indicator step.
//   pal: a name in tools/blockdesigns.js PAL (ice, fire, toxic, void, gold), {role: [r, g, b], ...} for every role, or
//   {"extends": "ice", "line": [r, g, b]} = another palette with some roles changed
//   holders: false = none. Channels: a look's palette takes 10 channels (912, 922, 933 for the 1st-3rd palette), its hazards 7 (943, 950, 957); "ch0" / "hazCh0" lists change them.
//   pass(level, events, opts) -> {objects, header, notes}: deco only, the gameplay never changes (no re-solve)
"use strict";
const fs = require("fs");
const K = require("./scenekit.js"), SD = require("./structdesign.js"), CN = require("./connect.js"), B = require("./blockdesigns.js");
const SOLID = id => (id >= 1 && id <= 7) || id === 1338;
const PORTAL = new Set([12, 13, 47, 111, 660, 745, 1331, 1933, 10, 11, 200, 201, 202, 203, 1334, 99, 101, 286, 287]);
const CH0 = [912, 922, 933], HAZ0 = [943, 950, 957], MAX_LOOKS = 3;   // blocks 10 channels each, hazards 7

// a section's look: the level's defaults, then its design theme (tools/designthemes.js resolve: a name, a theme with fields
// changed, or a whole new combination), then the section's own fields
function normalise(opts, spec = {}) {
  if (opts === true || opts == null) opts = {};
  const DT = require("./designthemes.js");
  const themeName = spec.theme && (typeof spec.theme === "string" ? spec.theme : spec.theme.name);
  const look = e => { const t = e.theme ? DT.resolve(typeof e.theme === "string" ? e.theme : e.theme) : null;
    const own = Object.assign({}, e); delete own.theme; delete own.sections; delete own.from;
    return Object.assign({}, t || {}, ...Object.entries(own).filter(([, v]) => v !== undefined).map(([k, v]) => ({ [k]: v }))); };
  const top = look(opts);
  const base = Object.assign({ design: "layered", pal: themeName === "ice" ? "ice" : "fire", effects: [] }, top);
  const secs = (opts.sections && opts.sections.length ? opts.sections : [{ from: 0 }]).map(s => Object.assign({}, base, look(s), { from: s.from || 0 })).sort((a, b) => a.from - b.from);
  return { secs, holders: opts.holders === undefined ? (top.holders || "chain") : opts.holders, interior: opts.interior !== false, ch0: opts.ch0, hazCh0: opts.hazCh0, bgCh0: opts.bgCh0, maxLooks: opts.maxLooks, backdrops: opts.backdrops !== false, skies: opts.skies !== false && !spec.theme };
}

function pass(level, events, opts, spec) {
  const o = normalise(opts, spec), notes = [];
  // palettes: one channel block per distinct palette
  const palKey = p => typeof p === "string" ? p : JSON.stringify(p), pals = new Map(), hpals = new Map();
  const ch0 = o.ch0 || CH0, hz0 = o.hazCh0 || HAZ0, SPK = require("./spikedesign.js");
  for (const s of o.secs) if (!pals.has(palKey(s.pal))) {
    if (pals.size >= ch0.length) throw new Error(`structures: more than ${ch0.length} palettes`);
    const P = typeof s.pal === "string" ? B.PAL[s.pal] : s.pal; if (!P) throw new Error("structures: no palette " + s.pal);
    pals.set(palKey(s.pal), B.channels(P, ch0[pals.size]));
    // the hazards' roles from the same palette (spikedesign's 7 roles), on their own channels
    const C = {}, defs = {}; SPK.ROLES.forEach((r, i) => { C[r] = hz0[hpals.size] + i; defs[C[r]] = Object.assign({ rgb: P[r] },
      r === "glow" ? { opacity: 0.6, blend: true } : r === "core" ? { opacity: 0.8, blend: true } : r === "detail" ? { blend: true } : {}); });
    hpals.set(palKey(s.pal), { C, defs });
  }
  let header = level.header;
  for (const p of pals.values()) header = K.channels(header, p.defs);
  if (o.secs.some(s => s.spikes || s.saws)) for (const p of hpals.values()) header = K.channels(header, p.defs);
  const looks = new Set(o.secs.map(s => s.design + "|" + palKey(s.pal) + "|" + [].concat(s.effects || []).join("+")));
  if (looks.size > (o.maxLooks || MAX_LOOKS)) notes.push(`WARN ${looks.size} structure looks: the rule is 2-3 a level (knowledge/checklist.md "One block design and one spike design at a time")`);
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
    out.push(...SD.dress(groups[i], s.design, pals.get(palKey(s.pal)).C, { effects: [].concat(s.effects || []), interior: o.interior })); });
  // skies and backdrops: a section with a theme gets its sky (colour triggers at its start, unless a theme kit owns the
  // colours) and its backdrop option drawn over its span, on 4 channels per palette (880, 884, 888 ...)
  const BD = require("./backdrops.js"), bg0 = o.bgCh0 || [880, 884, 888, 892, 896], bgs = new Map(), warned = new Set(); let nb = 0, ns = 0;
  const end = Math.max(...level.objects.map(b => b.x)) + 300;
  o.secs.forEach((s, i) => {
    const x0 = s.from * 30, x1 = i + 1 < o.secs.length ? o.secs[i + 1].from * 30 : end;
    const skies = s.skies || [], sky0 = skies.length ? skies[(s.sky != null ? s.sky : i) % skies.length] : null;
    // lifted until the blocks stand out of it (backdrops.fit); what still fails the contrast rules is a warning
    const P = typeof s.pal === "string" ? B.PAL[s.pal] : s.pal, sky = sky0 && P ? BD.fit(P, sky0) : sky0;
    if (sky && P) for (const w of BD.check(P, sky)) if (!warned.has(w)) { warned.add(w); notes.push(`!! contrast (section ${s.from}): ${w}`); }
    // the middleground (1013 / 1014) too: left undefined the game draws lilac hills (fire kit's note)
    if (sky && o.skies) { const mg = sky.mid || sky.bg.map((v, k) => Math.round((v + sky.ground[k]) / 2)), xt = Math.max(0, x0 - 60);
      out.push(K.colour(xt, 1000, sky.bg, 0.6), K.colour(xt, 1001, sky.ground, 0.6), K.colour(xt, 1013, mg, 0.6), K.colour(xt, 1014, sky.ground, 0.6)); ns++;
      if (i === 0) header = K.channels(header, { 1000: { rgb: sky.bg }, 1001: { rgb: sky.ground }, 1013: { rgb: mg }, 1014: { rgb: sky.ground } }); }
    if (!o.backdrops || !s.backdrops) return;
    const opt = s.backdrop || Object.keys(s.backdrops)[0], names = Array.isArray(opt) ? opt : s.backdrops[opt]; if (!names) return;
    const key = palKey(s.pal) + JSON.stringify(sky && sky.bg);
    if (!bgs.has(key)) { if (bgs.size >= bg0.length) return; const cols = BD.colours(P, sky || { bg: [20, 20, 30] }), b = bg0[bgs.size];
      const C = { far: b, mid: b + 1, light: b + 2, glow: b + 3 };
      header = K.channels(header, { [C.far]: { rgb: cols.far }, [C.mid]: { rgb: cols.mid }, [C.light]: { rgb: cols.light }, [C.glow]: { rgb: cols.glow, blend: true, opacity: 0.35 } });
      bgs.set(key, C); }
    const objs = BD.draw(names, x0, x1, bgs.get(key), { seed: i + 1 }); out.push(...objs); nb += objs.length;
  });
  if (ns || nb) notes.push(`backdrops: ${ns} skies, ${nb} background pieces`);
  // spikes and saws: each in its section's design and palette (deco only, the hazard untouched)
  let nh = 0;
  o.secs.forEach((s, i) => { if (!s.spikes && !s.saws) return; const C = hpals.get(palKey(s.pal)).C;
    for (const h of level.objects) { const k = SPK.kindOf(h.id); if (!k || secOf(h.x) !== i) continue;
      const name = k === "spike" ? s.spikes : s.saws; if (!name) continue;
      const parts = SPK.strip(SPK.dress(h, name, C)); nh += parts.length ? 1 : 0; out.push(...parts); } });
  if (nh) notes.push(`hazards: ${nh} dressed (${[...new Set(o.secs.map(s => [s.spikes, s.saws].filter(Boolean).join("/")))].join(", ")})`);
  let tally = {};
  if (o.holders) {
    const pathCells = events ? CN.routeCells(level, events) : new Set();
    if (!events) notes.push("WARN holders without a route: nothing kept clear for the player");
    const breaks = level.objects.filter(b => PORTAL.has(b.id)).map(b => b.x);
    const conns = CN.connectors(blocks, { pathCells, breaks });
    for (const q of conns) tally[q.kind] = (tally[q.kind] || 0) + 1;
    // each connector in the palette of the section it starts in
    o.secs.forEach((s, i) => { const mine = conns.filter(q => secOf(Math.min(q.x0, q.x1)) === i);
      if (mine.length) out.push(...CN.draw(mine, pals.get(palKey(s.pal)).C, { style: (o.holders && s.holders) || o.holders })); });
  }
  notes.unshift(`structures: ${SD.structures(blocks).length} dressed in ${looks.size} look(s) (${o.secs.map(s => `${s.from}: ${s.design}/${typeof s.pal === "string" ? s.pal : "custom"}${[].concat(s.effects || []).length ? "+" + [].concat(s.effects).join("+") : ""}`).join(", ")}), +${out.length} objects; holders ${o.holders ? JSON.stringify(tally) : "off"}`);
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

// the jump indicators from the design themes: each section's indicator style and an "auto" colour (opposite its hazards),
// unless the spec's "indicators" names its own style / colour
function indicators(spec) {
  const ind = spec.indicators; if (!ind || !spec.structures) return ind;
  let o; try { o = normalise(spec.structures, spec); } catch (e) { return ind; }
  if (!o.secs.some(s => s.indicator)) return ind;
  return Object.assign({}, ind, ind.style ? {} : { style: o.secs.map(s => [s.from, s.indicator || "chevron"]) },
    ind.colour ? {} : { colour: o.secs.map(s => [s.from, s.indicatorColour || "auto"]) });
}
module.exports = { pass, apply, normalise, indicators };
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
