// node tools/decogallery.js [--shots]
//
// Deco options ELEMENT BY ELEMENT, to pick from (the user, 2026-11-25: "like firy blocks or spikes, some options of how it
// might look. background."). One small test strip (steps, a block stack, a floating platform, spikes on the ground and on
// a block), dressed one element at a time, each in ice and fire (tools/decodemo.js's palettes, the ice kit's shapes):
//   blocks       5 ways to dress the block bodies (the spikes and the sky left plain)
//   spikes       5 ways to show the hazards (the blocks in option 1)
//   background   6 backgrounds behind the same play
// Every option keeps the play visible (the user: "if you dont see a spike the timing is obviously harder"): nothing in front
// of the lane, hazards in their own near-white value. Writes local/decogallery/<element>_<theme>_<n>.gdlvl and
// options.json; --shots renders one frame each with tools/shoot.js (GD art, local only) and local/decogallery/index.html
// (http://localhost:8765/local/decogallery/index.html).
"use strict";
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ROOT = path.join(__dirname, ".."), OUT = path.join(ROOT, "local", "decogallery");
const K = require("./scenekit.js"), D = require("./decokit.js"), P = require("../lib/props.js"), ICE = require("./themes/ice.js");
const { THEMES } = require("./decodemo.js"), CH = ICE.CH, I = ICE.pieces;
const io = require("./io.js"), GD = io.GD;

// the strip (blocks of 30 units, x = cell centre)
function strip(o = {}) {
  const b = (c, r) => ({ id: 1, x: c * 30 + 15, y: r * 30 + 15, rot: 0, flipX: false, flipY: false, props: {} });
  const sp = o.spike || 8, s = (c, r, id = sp) => ({ id, x: c * 30 + 15, y: r * 30 + 15, rot: 0, flipX: false, flipY: false, props: {} });
  const out = [];
  for (let c = 10; c < 13; c++) out.push(b(c, 0));                                   // a step
  for (let c = 13; c < 17; c++) { out.push(b(c, 0), b(c, 1)); }                      // a 2-high stack
  out.push(s(15, 2));                                                                // a spike on it
  for (let c = 22; c < 27; c++) out.push(b(c, 3));                                   // a floating platform
  out.push(s(20, 0), s(29, 0), s(30, 0));                                            // ground spikes
  for (let c = 33; c < 40; c++) { out.push(b(c, 0)); if (c > 34 && c < 38) out.push(b(c, 1), b(c, 2)); }   // a block mass
  out.push(s(42, 0), s(48, 0));
  return out;
}

const ICEB = ["navy body, lit cyan rim", "+ bricks and frost tops", "+ crystal windows", "+ cracks and icicles under the edges", "glowing ice: light body, dark rim"];
const FIREB = ["obsidian, lava rim", "+ bricks and a crust top", "+ molten seams", "+ thorns on the tops (charred)", "magma: hot body, dark rim"];
const SPK = ["plain (white)", "theme skin (ice spikes / thorn pits)", "a glow pool under each", "a dark halo behind each", "sparks around (clear of the lane)"];
const BGS = ["flat sky + horizon haze", "two mountain ranges", "big set piece (peak / ruined arch)", "near silhouettes (crystals / dead trees, ruins)", "hanging from above (icicles / chains)", "particles (snow / embers) + rays"];

function blocks(theme, n, objs) {
  const fire = theme === "fire", out = [], R = K.rng(5 + n);
  const solid = objs.filter(o => o.id === 1), at = new Set(solid.map(o => Math.round(o.x / 30 - 0.5) + "," + Math.round(o.y / 30 - 0.5)));
  const open = o => !at.has(Math.round(o.x / 30 - 0.5) + "," + (Math.round(o.y / 30 - 0.5) + 1));
  if (n === 5) {   // inverted: a light body, a dark rim
    out.push(...K.designBlocks(objs, -300, 9999, { fill: CH.glow, edge: CH.fill, glow: null, seed: 3 }));
    for (const o of solid) if (R() < 0.3) out.push(K.obj(1764, o.x + (R() - 0.5) * 14, o.y + (R() - 0.5) * 14, { ch: CH.frost, z: "T1", zo: 5, s: 0.3 }));
    return out;
  }
  out.push(...K.designBlocks(objs, -300, 9999, { fill: CH.fill, edge: CH.rim, glow: CH.glow, win: n === 3 && !fire ? CH.crystal : null, windows: 0.3, seed: 3 }));
  if (n >= 2) out.push(...D.blockPattern(objs, -300, 9999, { ch: CH.fill, top: CH.frost, seed: 41 }));
  if (n === 3 && fire) for (const o of solid) if (R() < 0.35) out.push(K.obj(1753, o.x, o.y, { ch: CH.crystal, z: "T1", zo: 4, sx: 0.6 + R() * 0.6, rot: R() * 180 }));
  if (n === 4) {
    if (!fire) { for (const o of solid) { if (R() < 0.25) out.push(K.obj(1753, o.x + (R() - 0.5) * 10, o.y + (R() - 0.5) * 10, { ch: CH.crack, z: "T1", zo: 3, sx: 0.7, rot: 30 + R() * 60 }));
        const c = Math.round(o.x / 30 - 0.5), r = Math.round(o.y / 30 - 0.5); if (r > 0 && !at.has(c + "," + (r - 1))) out.push(...I.crystal(o.x + (R() - 0.5) * 10, o.y - 15, 10, 14 + R() * 14, { down: true, ch: CH.rim, lit: CH.frost, z: "T1", groups: [] })); } }
    else for (const o of solid) if (open(o)) for (const dx of [-8, 6]) if (R() < 0.7) out.push(K.obj(461 + Math.floor(R() * 6), o.x + dx, o.y + 19, { ch: CH.cap, z: "T1", zo: 5, s: 0.35 + R() * 0.15 }));
  }
  return out;
}
function spikes(theme, n, objs) {
  const fire = theme === "fire", out = [], R = K.rng(9);
  const haz = objs.filter(o => o.id === 8 || o.id === 177 || o.id === 9);
  for (const h of haz) {
    if (n === 3) out.push(K.obj(1293, h.x, h.y - 6, { ch: CH.glow, z: "B1", zo: 0, sx: 1.6, sy: 0.9, flipY: true }));
    if (n === 4) out.push(K.obj(1764, h.x, h.y - 2, { ch: CH.fill, z: "B1", zo: 0, s: 1.6 }));
    if (n === 5) for (let k = 0; k < 4; k++) { const a = R() * Math.PI, d = 26 + R() * 14; out.push(K.obj(1764, h.x + Math.cos(a) * d, h.y + 6 + Math.sin(a) * d * 0.6, { ch: fire ? CH.snow : CH.crystal, z: "B1", zo: 1, s: 0.18 + R() * 0.15 })); }
  }
  return out;
}
function background(theme, n, objs) {
  const fire = theme === "fire", out = [], x0 = -300, x1 = 1800, R = K.rng(17);
  out.push(...I.haze(x0, x1));
  if (n === 2) { out.push(...I.range(x0, x1, { seed: 4, z: "B5", hMin: 100, hMax: 210, groups: [] }), ...I.range(x0, x1, { seed: 6, z: "B4", zo: 4, hMin: 40, hMax: 90, wMin: 90, wMax: 180, ch: CH.mid, lit: CH.midLit, cap: false, groups: [] })); }
  if (n === 3) { if (!fire) { out.push(...I.peak(700, 900, 380, { z: "B5", groups: [] }), ...I.cluster(560, -10, { seed: 2, size: 2, n: 5, ch: CH.mid, lit: CH.crystal, z: "B3", groups: [] })); }
    else { out.push(...P.put("broken arches", 700, 0, { silhouette: CH.far, layer: "B4", zo: -2, scale: 2.4, seed: 1 }).objects); out.push(...K.horizonGlow(450, 950, { ch: CH.glow, y: 0, h: 7, z: "B5", step: 120 })); } }
  if (n === 4) { if (!fire) for (let x = 80; x < x1; x += 160 + R() * 80) out.push(...I.cluster(x, -10, { seed: x, size: 1.2, ch: CH.mid, lit: CH.midLit, z: "B3", groups: [] }));
    else { out.push(...D.backdrop(x0, x1, { near: CH.mid, trees: "dead tree", density: 1.4, seed: 30 })); for (let x = 200; x < x1; x += 520) out.push(...P.put("ruin", x, 0, { silhouette: CH.mid, layer: "B3", zo: -4, scale: 1, seed: x }).objects); } }
  if (n === 5) { if (!fire) out.push(...I.icicles(objs, x0, x1, { seed: 2, hMin: 30, hMax: 130, ch: CH.far, lit: CH.farLit, z: "B2", groups: [] }));
    else for (let x = 60; x < x1; x += 140 + R() * 120) { const k = 2 + Math.floor(R() * 3); for (let j = 0; j < k; j++) out.push(K.obj(106, x, 330 - j * 62, { ch: CH.far, z: "B2", zo: 0 })); if (R() < 0.5) out.push(K.obj(1596 + Math.floor(R() * 2), x, 330 - k * 62 - 10, { ch: CH.cap, z: "B2", zo: 1, s: 1.2 })); } }
  if (n === 6) { if (!fire) out.push(...I.snow(objs, x0, x1, { seed: 5, density: 2.5 })); else out.push(...K.motes(x0, x1, { ch: CH.snow, density: 2.5, z: "B2", seed: 60, y0: -40, y1: 320 }));
    out.push(...K.lightRays(x0, x1, { ch: CH.haze, every: 160, z: "B3" })); }
  return out;
}

function build() {
  fs.mkdirSync(OUT, { recursive: true });
  const rec = io.readGdlvl(path.join(ROOT, "levels", "archive", "gdlm_50_eclipse.gdlvl")).rec, rows = [];
  const put = (el, theme, n, label, objs, deco) => {
    for (const o of objs) o.props[21] = String(o.id === 1 ? CH.rim : CH.hazard);
    const T = THEMES[theme], defs = {}; for (const [ch, rgb] of Object.entries(T.map)) defs[ch] = { rgb, blend: T.blend[ch] != null, opacity: T.blend[ch] ?? 1 };
    let header = K.channels(GD.DEFAULT_HEADER, defs);
    for (const [k, v] of Object.entries(ICE.HEADER)) header = new RegExp("(^|,)" + k + ",").test(header) ? header.replace(new RegExp("(^|,)" + k + ",[^,;]*"), "$1" + k + "," + v) : header + "," + k + "," + v;
    const file = path.join(OUT, `${el}_${theme}_${n}.gdlvl`);
    GD.setField(rec, "k2", "s", `GDLM deco ${el} ${theme} ${n}`);
    io.writeGdlvl(file, rec, { header, objects: objs.concat(deco) });
    rows.push({ el, theme, n, label: typeof label === "string" ? label : label[theme], file: path.relative(ROOT, file).replace(/\\/g, "/"), deco: deco.length });
  };
  for (const theme of ["ice", "fire"]) {
    (theme === "ice" ? ICEB : FIREB).forEach((label, i) => { const o = strip(); put("blocks", theme, i + 1, label, o, blocks(theme, i + 1, o)); });
    SPK.forEach((label, i) => { const o = strip({ spike: i === 1 ? (theme === "ice" ? 177 : 9) : 8 }); put("spikes", theme, i + 1, label, o, blocks(theme, 1, o).concat(spikes(theme, i + 1, o))); });
    BGS.forEach((label, i) => { const o = strip(); put("background", theme, i + 1, label, o, blocks(theme, 2, o).concat(background(theme, i + 1, o))); });
  }
  fs.writeFileSync(path.join(OUT, "options.json"), JSON.stringify(rows, null, 1));
  return rows;
}

function page(rows) {
  const img = r => { const d = path.join(OUT, path.basename(r.file, ".gdlvl") + "_shots"), p = fs.existsSync(d) ? fs.readdirSync(d).filter(f => f.endsWith(".png")).sort()[0] : null;
    return p ? `<img loading=lazy src="${path.basename(d)}/${p}">` : "<i>no frame</i>"; };
  let h = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width"><title>Deco gallery</title>
<style>body{background:#111;color:#ddd;font:14px system-ui;margin:16px}h2{margin-top:28px}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,420px),1fr));gap:12px}img{width:100%;display:block;border-radius:4px}figcaption{padding:4px 0}</style>
<h1>Deco gallery: pick per element</h1><p>Same strip every time; only one element changes. Ice left, fire right in each pair. (tools/decogallery.js)</p>`;
  for (const el of ["blocks", "spikes", "background"]) {
    h += `<h2>${el}</h2><div class=g>`;
    const ns = [...new Set(rows.filter(r => r.el === el).map(r => r.n))];
    for (const n of ns) for (const theme of ["ice", "fire"]) { const r = rows.find(q => q.el === el && q.n === n && q.theme === theme); h += `<figure>${img(r)}<figcaption>${el} ${theme} ${n}: ${r.label}</figcaption></figure>`; }
    h += "</div>";
  }
  fs.writeFileSync(path.join(OUT, "index.html"), h);
}

if (require.main === module) {
  const rows = build(); for (const r of rows) console.log(`${r.file.padEnd(48)} ${String(r.deco).padStart(4)}  ${r.label}`);
  if (process.argv.includes("--shots")) {
    require("./heavy.js").claim();
    for (const r of rows) cp.execFileSync(process.execPath, [path.join(__dirname, "shoot.js"), path.join(ROOT, r.file), "--at", process.argv.includes("--at") ? process.argv[process.argv.indexOf("--at") + 1] : "1.8", "--out", path.join(OUT, path.basename(r.file, ".gdlvl") + "_shots")], { stdio: "inherit", windowsHide: true });
    page(rows); console.log("gallery: local/decogallery/index.html (http://localhost:8765/local/decogallery/index.html)");
  }
}
module.exports = { build, strip };
