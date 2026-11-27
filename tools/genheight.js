// node tools/genheight.js [key ...] [--cols 80] [--scale 2] [--seeds 1,2] [--tier normal]
// How generated sections spread over the height (Evgeni 2026-11-27: "write the stats of height distribution for all
// sections in x2 height and 80 length"): every tools/sectiongen.js type at its default rows and at rows x scale, solved by
// tools/layoutcheck.js, one line per type: rows visited / the map's rows, the share of playable rows (layoutcheck's
// spread.used: band-capped unless the map has movers), how even (entropy 0-1), touches the bottom / top, presses.
// A type that does not solve says where it dies.
"use strict";
if (require.main === module) require("./heavy.js").claim();
const SG = require("./sectiongen.js"), LC = require("./layoutcheck.js");
const a = process.argv.slice(2), arg = (k, d) => { const i = a.indexOf("--" + k); return i >= 0 ? a[i + 1] : d; };
const pos = a.filter((x, i) => !x.startsWith("--") && !(i > 0 && a[i - 1].startsWith("--")));
const cols = +arg("cols", 80), scale = +arg("scale", 2), seeds = arg("seeds", "1,2").split(",").map(Number), tier = arg("tier", "normal");
const keys = pos.length ? pos : SG.KEYS.filter(k => k !== "hanging");
const pct = x => Math.round(x * 100) + "%";
function one(key, rows) {
  const out = [];
  for (const seed of seeds) {
    const z = SG.make(key, { cols, seed, tier, rows }), c = LC.check(z), H = z.map.length;
    if (!c.ok) { out.push({ H, ok: false, why: `dies col ${c.dieCol} row ${c.dieRow}: ${c.why}` }); continue; }
    const s = c.spread || {}, vis = (s.rows || []).filter(n => n).length;
    out.push({ H, ok: true, vis, used: s.used, even: s.even, low: s.low, high: s.high, presses: c.presses, label: c.label });
  }
  return out;
}
const fmt = rs => rs.map(r => r.ok ? `${r.vis}/${r.H} rows, ${pct(r.used)} playable, even ${r.even}${r.low ? "" : ", no bottom"}${r.high ? "" : ", no top"}, ${r.presses}p ${r.label}`
  : `${r.H} rows NO (${r.why})`).join("  |  ");
console.log(`${cols} cols, tier ${tier}, seeds ${seeds.join(",")}: default rows vs x${scale}`);
for (const key of keys) {
  const base = SG.make(key, { cols, seed: seeds[0], tier }).map.length;
  console.log(`${key.padEnd(14)} x1: ${fmt(one(key, base))}`);
  console.log(`${"".padEnd(14)} x${scale}: ${fmt(one(key, Math.round(base * scale)))}`);
}
