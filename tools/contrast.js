// node tools/contrast.js <level.gdlvl | official:N | save:<name>> ... [--all] [--official] [--json f] [--worst N]
// Colour readability (the user, 2026-11-24: "your color choices sometimes are bad according to background/path/spikes,
// sometimes its not clear and its all mooshy"). A soft rule, scored: along the level, every 2 blocks, with the colours
// the header and colour triggers give at that x (lib/look.js timeline; time ~ x at 1x speed, approximate), measure
// LUMINANCE contrast (WCAG ratio, (L1+.05)/(L2+.05): value, not hue -- two different hues at one brightness are mush):
//   hazard/bg    each hazard's colour (key 21, default channel 1004) against the background (1000)
//   block/bg     each solid's colour against the background
//   hazard/block a hazard against the block it sits on / next to (same brightness = the spike vanishes into it)
//   ground/bg    the ground (1001) against the background: where the floor is (passes too when the ground line 1002
//                stands out, ratio >= 3)
//   drown        deco within a block of a hazard that is in FRONT of it (layer T*) or brighter than it -- glow / deco
//                drowning the hazards
// Each section (10 blocks) gets the worst of these; the level gets a 0-100 score (share of sections that pass) and
// the worst spots with their x / seconds. --all = every levels/*.gdlvl; --official = the 22 official levels (the
// baseline the thresholds come from). Light: no solve. Pictures of the worst spots: tools/shoot.js <lvl> --at <s>.
// Thresholds (THRESH below) are set from the official levels' 10th percentile (ART.md "Colour readability").
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), LOOK = require("../lib/look.js").LOOK, O = require("../lib/objects.js");
const SPEED = 311.58;   // units / s at 1x: trigger fades are timed in seconds, we walk in x

const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const THRESH = { hazardBg: 1.6, blockBg: 1.5, hazardBlock: 1.3, groundBg: 1.1, drown: 40 };   // drown: official p90 (deco near hazards is common there: a weak signal)   // official 10th percentiles (ART.md)

function load(w) {
  let m;
  if ((m = /^official:(\d+)$/.exec(w))) { const L = require("./corpus.js").official(+m[1]); return { name: L.name, header: L.header, objects: L.objects }; }
  if ((m = /^save:(.+)$/.exec(w))) { const L = require("./corpus.js").mine().find(l => l.short.toLowerCase() === m[1].toLowerCase()); if (!L) throw new Error("not in the save: " + m[1]); return { name: L.name, header: L.header, objects: L.objects }; }
  const L = require("./io.js").readGdlvl(w); return { name: L.name || path.basename(w), header: L.level.header, objects: L.level.objects, file: w };
}
const kindOf = o => (O.objInfo(o.id) || {}).kind;
const layerOf = o => +((o.props || {})[24] || 0);

function measure(L) {
  const tl = LOOK.timeline({ header: L.header, objects: L.objects }, x => x);
  for (const k in tl.colour) for (const e of tl.colour[k]) e.dur *= SPEED;
  const objs = L.objects.filter(o => o.x != null);
  const haz = objs.filter(o => kindOf(o) === "hazard"), sol = objs.filter(o => kindOf(o) === "solid");
  const deco = objs.filter(o => { const k = kindOf(o); return (k === "decoration" || k === "deco" || k == null) && o.id !== 914; });
  const maxX = Math.max(300, ...objs.filter(o => kindOf(o) === "hazard" || kindOf(o) === "solid").map(o => o.x));
  const colourOf = (o, st) => { const c = (o.props || {})[21]; return st.col[+c] || st.col[1004] || [255, 255, 255]; };
  const secs = [];
  for (let x0 = 0; x0 < maxX; x0 += 300) {
    const st = LOOK.stateAt(tl, x0 + 150), bg = st.col[1000], gr = st.col[1001];
    const inS = a => a.filter(o => o.x >= x0 && o.x < x0 + 300);
    const H = inS(haz), S = inS(sol);
    const s = { x0, t: +(x0 / SPEED).toFixed(1), groundBg: ratio(gr, bg), hazardBg: Infinity, blockBg: Infinity, hazardBlock: Infinity, drown: 0, n: H.length + S.length };
    for (const h of H) {
      const hc = colourOf(h, st); s.hazardBg = Math.min(s.hazardBg, ratio(hc, bg));
      // a spike and its block in ONE colour is normal GD (told apart by shape); mush is two DIFFERENT colours at one brightness
      for (const b of S) if (Math.abs(b.x - h.x) <= 31 && Math.abs(b.y - h.y) <= 31) { const bc = colourOf(b, st);
        if (Math.hypot(hc[0] - bc[0], hc[1] - bc[1], hc[2] - bc[2]) > 40) s.hazardBlock = Math.min(s.hazardBlock, ratio(hc, bc)); }
      for (const d of deco) if (Math.abs(d.x - h.x) <= 30 && Math.abs(d.y - h.y) <= 30) {
        const dc = colourOf(d, st); if (layerOf(d) >= 1 || (lum(dc) > lum(hc) && ratio(dc, hc) < 1.3)) { s.drown++; }
      }
    }
    for (const b of S) s.blockBg = Math.min(s.blockBg, ratio(colourOf(b, st), bg));
    s.fails = [];
    if (s.hazardBg < THRESH.hazardBg) s.fails.push(`hazard/bg ${s.hazardBg.toFixed(2)}`);
    if (s.blockBg < THRESH.blockBg) s.fails.push(`block/bg ${s.blockBg.toFixed(2)}`);
    if (s.hazardBlock < THRESH.hazardBlock) s.fails.push(`hazard/block ${s.hazardBlock.toFixed(2)}`);
    s.lineBg = ratio(st.col[1002] || [255, 255, 255], bg);   // the ground line can mark the floor when the ground itself does not
    if (s.groundBg < THRESH.groundBg && s.lineBg < 3) s.fails.push(`ground/bg ${s.groundBg.toFixed(2)}`);
    if (s.drown >= THRESH.drown) s.fails.push(`${s.drown} deco over hazards`);
    // badness for ranking: how far under each threshold
    s.bad = Math.max(0, THRESH.hazardBg - s.hazardBg) * 2 + Math.max(0, THRESH.blockBg - s.blockBg) + Math.max(0, THRESH.hazardBlock - s.hazardBlock) + Math.max(0, THRESH.groundBg - s.groundBg) + Math.min(2, s.drown / 6);
    if (s.n) secs.push(s);
  }
  const pass = secs.filter(s => !s.fails.length).length;
  const fin = v => v != null && isFinite(v) ? +v.toFixed(2) : null, med = a => { a = a.filter(isFinite).sort((p, q) => p - q); return a.length ? a[Math.floor(a.length / 2)] : null; };
  return { name: L.name, score: secs.length ? Math.round(100 * pass / secs.length) : 100, sections: secs.length,
    median: { hazardBg: fin(med(secs.map(s => s.hazardBg))), blockBg: fin(med(secs.map(s => s.blockBg))), groundBg: fin(med(secs.map(s => s.groundBg))) },
    worst: secs.filter(s => s.fails.length).sort((a, b) => b.bad - a.bad), secs };
}

if (require.main === module) {
  const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
  let list = args.filter((a, i) => !a.startsWith("--") && !["--json", "--worst"].includes(args[i - 1]));
  if (args.includes("--all")) list = list.concat(fs.readdirSync(path.join(ROOT, "levels")).filter(f => /^gdlm.*\.gdlvl$/.test(f)).map(f => path.join(ROOT, "levels", f)));
  if (args.includes("--official")) for (let n = 1; n <= 22; n++) list.push("official:" + n);
  if (!list.length) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(0); }
  const N = +opt("--worst", 3), out = [];
  for (const w of list) {
    let r; try { r = measure(load(w)); } catch (e) { console.log(`${w}: ${e.message}`); continue; }
    out.push(Object.assign({ src: w }, r, { secs: undefined }));
    console.log(`${String(r.score).padStart(3)}  ${r.name}  (${r.sections} sections; median hazard/bg ${r.median.hazardBg}, block/bg ${r.median.blockBg}, ground/bg ${r.median.groundBg})`);
    for (const s of r.worst.slice(0, N)) console.log(`       x ${s.x0}-${s.x0 + 300} (~${s.t} s): ${s.fails.join(", ")}`);
  }
  if (opt("--json")) fs.writeFileSync(opt("--json"), JSON.stringify(out.map(r => Object.assign({}, r, { worst: r.worst.slice(0, 10) })), null, 1));
}
module.exports = { measure, load, ratio, lum, THRESH };
