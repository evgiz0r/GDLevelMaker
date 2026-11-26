// node tools/deco_page.js   -- the deco options as one page for the phone viewer (local/phone_deco/: index.html + JPGs)
//
// Takes the frames tools/decogallery.js --shots (element by element: blocks / spikes / background, ice and fire side by
// side) and tools/decodemo.js --shots (the 7 rungs) rendered, shrinks each to 960 px wide JPG (ffmpeg, quality ~80), and
// writes one page: the gallery first, then the rung sheet. tools/web.js carries local/phone_deco/ into the phone page as
// deco/ with a "deco" button (and #deco opens it). GD art is in the pictures: only on the user's PRIVATE claude.ai page
// (approved 2026-11-25, VISUALS.md), never in git or on the public site.
"use strict";
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ROOT = path.join(__dirname, ".."), L = path.join(ROOT, "local"), OUT = path.join(L, "phone_deco");
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const readJ = f => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return null; } };
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
let n = 0;
function jpg(png, name) { // -> the JPG's name in OUT, or null
  if (!png || !fs.existsSync(png)) return null;
  cp.execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", png, "-vf", "scale=960:-2", "-q:v", "4", path.join(OUT, name)], { windowsHide: true });
  n++; return name;
}
const shotsOf = file => { const d = path.join(ROOT, file.replace(/\.gdlvl$/, "_shots"));
  return fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith(".png")).sort().map(f => path.join(d, f)) : []; };
const img = (name, alt) => name ? `<img loading=lazy src="${name}" alt="${esc(alt)}">` : `<div class=none>no frame</div>`;

let h = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width, initial-scale=1"><title>Deco options</title>
<style>body{background:#0b0820;color:#ddd;font:14px system-ui;margin:12px}h2{margin:18px 0 6px}h3{margin:14px 0 4px;color:#9cf}
.row{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px}.row figure{margin:0}img{width:100%;display:block;border-radius:4px}
figcaption{font-size:12px;opacity:.8;padding:2px 0}.none{aspect-ratio:16/9;display:grid;place-items:center;background:#222;border-radius:4px;opacity:.6}
.lab{font-weight:600}</style>
<h1>Deco options</h1><p>Same play, dressed differently. Ice on the left, fire on the right.</p>`;

// the best looks now, first (local/decoart/best.json: [{group: "fire"|"ice"|..., png, caption, level?}], written by hand or a
// deco session after each round; DECOART.md): what to look at before the older options below
const best = readJ(path.join(L, "decoart", "best.json")) || [];
if (best.length) {
  h += `<h2>Best looks now</h2><p>The newest and strongest of each theme. Open the level in the viewer to mark spots.</p>`;
  for (const g of [...new Set(best.map(b => b.group))]) {
    h += `<h3>${esc(g)}</h3><div class=row>`;
    best.filter(b => b.group === g).forEach((b, i) => { const f = path.isAbsolute(b.png) ? b.png : path.join(ROOT, b.png);
      h += `<figure>${img(jpg(f, `best_${g}_${i}.jpg`), b.caption)}<figcaption>${esc(b.caption)}${b.level ? ` · in the viewer: <b>${esc(b.level)}</b>` : ""}</figcaption></figure>`; });
    h += `</div>`;
  }
  h += `<h2>Earlier options (2026-11-25)</h2>`;
}
const gal = readJ(path.join(L, "decogallery", "options.json")) || [];
if (gal.length) {
  h += `<h2>Element by element</h2>`;
  for (const el of [...new Set(gal.map(r => r.el))]) {
    h += `<h3>${esc(el)}</h3>`;
    for (const k of [...new Set(gal.filter(r => r.el === el).map(r => r.n))].sort((a, b) => a - b)) {
      h += `<div class=row>`;
      for (const th of ["ice", "fire"]) { const r = gal.find(q => q.el === el && q.n === k && q.theme === th); if (!r) { h += "<figure></figure>"; continue; }
        h += `<figure>${img(jpg(shotsOf(r.file)[0], `g_${el}_${th}_${k}.jpg`), r.label)}<figcaption><span class=lab>${esc(el)} ${k}</span> · ${esc(th)}: ${esc(r.label)}</figcaption></figure>`; }
      h += `</div>`;
    }
  }
}
// theme kits (tools/theme.js demo <kit> <level> --shots -> local/themes/<kit>_demo_<level>_shots/): ~6 frames each, spread
const KITS = path.join(L, "themes");
const kits = fs.existsSync(KITS) ? fs.readdirSync(KITS).filter(d => /^(\w+?)_demo_.+_shots$/.test(d) && fs.statSync(path.join(KITS, d)).isDirectory()) : [];
if (kits.length) {
  h += `<h2>Theme kits (tools/themes/)</h2>`;
  for (const d of kits.sort()) {
    const kit = /^(\w+?)_demo_/.exec(d)[1], all = fs.readdirSync(path.join(KITS, d)).filter(f => f.endsWith(".png")).sort();
    const pick = all.length <= 6 ? all : Array.from({ length: 6 }, (_, i) => all[Math.round(i * (all.length - 1) / 5)]);
    h += `<h3>${esc(kit)}</h3><div class=row>`;
    pick.forEach((f, i) => { h += `<figure>${img(jpg(path.join(KITS, d, f), `k_${kit}_${i}.jpg`), kit)}<figcaption>${esc(kit)}, ${esc(f.replace(/^t0*|\.png$/g, ""))} s</figcaption></figure>`; });
    h += `</div>`;
  }
}
const demo = readJ(path.join(L, "decodemo", "options.json")) || [];
if (demo.length) {
  h += `<h2>Rung by rung (each adds one feature)</h2>`;
  for (const k of [...new Set(demo.map(r => r.rung))].sort((a, b) => a - b)) {
    const rs = demo.filter(r => r.rung === k);
    h += `<h3>${k} ${esc(rs[0].name)}</h3>`;
    const shots = Object.fromEntries(rs.map(r => [r.theme, shotsOf(r.file)]));
    const frames = Math.max(...Object.values(shots).map(s => s.length), 1);
    for (let f = 0; f < frames; f++) {
      h += `<div class=row>`;
      for (const th of ["ice", "fire"]) h += `<figure>${img(jpg((shots[th] || [])[f], `r${k}_${th}_${f}.jpg`), `${th} ${rs[0].name}`)}<figcaption>${esc(th)}, frame ${f + 1}</figcaption></figure>`;
      h += `</div>`;
    }
  }
}
fs.writeFileSync(path.join(OUT, "index.html"), h);
console.log(`${path.relative(ROOT, OUT)}: index.html + ${n} JPGs (${(fs.readdirSync(OUT).reduce((s, f) => s + fs.statSync(path.join(OUT, f)).size, 0) / 1e6).toFixed(1)} MB)`);
