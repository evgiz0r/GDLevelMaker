// node tools/pixelart.js <image.png> [--at x,y] [--scale s | --width blocks] [--colours k] [--max-objects N]
//        [--anchor bottom|top|center|bottomleft] [--layer B2] [--ch0 600] [--outline r,g,b] [--glow r,g,b]
//        [--into level.gdlvl --out out.gdlvl] [--json out.json] [--preview out.png]
// A small picture -> GD decoration objects (lib/pixelart.js; ART.md): the colours quantised to a few channels,
// runs of one colour merged into stretched deco squares (211, no hitbox), painter's order so a colour runs
// under the details above it, one z order per colour, all on one layer behind the play.
//   --at x,y        GD units where the picture goes (default 0,0), at its --anchor point (default bottom-centre)
//   --scale s       blocks per image pixel (default 0.125 = 8 pixels a block); or --width W: the picture W blocks wide
//   --colours k     at most k colours / channels (default 6); fully transparent pixels (alpha < 128) stay empty
//   --max-objects N if the result is over N, fewer colours first (down to 3), then a coarser grid (half), until it fits
//   --outline r,g,b a 1-pixel outline in that colour around the picture (one more channel; reads well in GD)
//   --glow r,g,b    a 2-pixel soft edge behind it (a channel at 40% opacity)
//   --into / --out  add the objects (and the header channels) to a copy of a level; else just report
//   --json          write {objects, colours} for a scene script; --preview: a PNG of what GD will draw
// The report: objects, pixels, objects per colour, channels with their colours, size in blocks.
// Pictures: anything PNG (PIL, Paint, Blender renders via tools/blender_model.sh in the GamePlatform kit). Small
// and flat-coloured works best: 16-64 px wide. A photo works but needs --max-objects.
"use strict";
const fs = require("fs"), path = require("path");
const PA = require("../lib/pixelart.js"), { readPng, writePng } = require("./png.js");
const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const rgbArg = s => s ? s.split(",").map(Number) : null;

// picture -> {objects, colours {ch: rgb}, report}
function convert(file, o = {}) {
  const { w, h, rgba } = typeof file === "string" ? readPng(file) : file;
  const target = o.width ? o.width / w : (o.scale || 0.125);                    // blocks per pixel
  let k = o.colours || 6, f = 1, res;
  for (;;) {
    let src = { w, h, rgba };
    let { grid: g, palette } = PA.quantise(src.rgba, w, h, k);
    if (f > 1) g = PA.downscale(g, f);
    let base = g;
    if (o.outline) { base = base.outline("outline"); palette.outline = o.outline; }
    if (o.glow) { base = base.outline("glow").outline("glow"); palette.glow = o.glow; }
    const pad = (base.w - g.w) / 2, px = target * f * 30;
    // keep the anchor where the picture itself is: grow the box by the padding
    const ch = {}; let next = o.ch0 || 600; for (const name of Object.keys(base.colours())) ch[name] = next++;
    const r = PA.toObjects(base, { x: o.x || 0, y: (o.y || 0) - (/(bottom)/.test(o.anchor || "bottom") ? pad * px : /top/.test(o.anchor || "") ? -pad * px : 0), px, anchor: o.anchor || "bottom", ch, z: o.layer || "B2", zo: o.zo || 0, bottom: o.glow ? ["glow"] : null });
    const colours = {}; for (const [name, c] of Object.entries(ch)) colours[c] = palette[name];
    res = { objects: r.objects, colours, count: r.count, pixels: r.pixels, byColour: r.byColour, size: r.size, grid: base, px, k, f, ch, palette, glowCh: o.glow ? ch.glow : null };
    if (!o.max || r.count <= o.max) break;
    if (k > 3) k--; else { f *= 2; k = o.colours || 6; if (w / f < 4) break; }
  }
  return res;
}

// a PNG of what the objects draw (deco squares in their channel colours), 4 px a unit by default
function preview(res, file, ppu = 4) {
  const xs = [], ys = [];
  for (const o of res.objects) { const p = o.props, sx = +(p[128] || p[32] || 1) * 15, sy = +(p[129] || p[32] || 1) * 15; xs.push(o.x - sx, o.x + sx); ys.push(o.y - sy, o.y + sy); }
  const x0 = Math.min(...xs) - 4, x1 = Math.max(...xs) + 4, y0 = Math.min(...ys) - 4, y1 = Math.max(...ys) + 4;
  const W = Math.ceil((x1 - x0) * ppu), H = Math.ceil((y1 - y0) * ppu), img = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) img.set([40, 36, 52, 255], i * 4);
  const sorted = res.objects.slice().sort((a, b) => (+a.props[24] - +b.props[24]) || (+a.props[25] - +b.props[25]));
  for (const o of sorted) {
    const p = o.props, c = res.colours[p[21]] || [255, 255, 255], a = +p[21] === res.glowCh ? 0.4 : 1, sx = +(p[128] || p[32] || 1) * 15, sy = +(p[129] || p[32] || 1) * 15;
    for (let y = Math.round((y1 - (o.y + sy)) * ppu); y < Math.round((y1 - (o.y - sy)) * ppu); y++) for (let x = Math.round((o.x - sx - x0) * ppu); x < Math.round((o.x + sx - x0) * ppu); x++) {
      const i = (y * W + x) * 4; for (let q = 0; q < 3; q++) img[i + q] = Math.round(img[i + q] * (1 - a) + c[q] * a);
    }
  }
  writePng(file, W, H, img);
}

if (require.main === module) {
  if (!args[0] || args[0].startsWith("--")) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
  const [ax, ay] = (opt("--at", "0,0")).split(",").map(Number);
  const res = convert(args[0], { x: ax, y: ay, scale: opt("--scale") ? +opt("--scale") : null, width: opt("--width") ? +opt("--width") : null, colours: +opt("--colours", 6),
    max: opt("--max-objects") ? +opt("--max-objects") : null, anchor: opt("--anchor"), layer: opt("--layer"), ch0: +opt("--ch0", 600), outline: rgbArg(opt("--outline")), glow: rgbArg(opt("--glow")) });
  console.log(`${path.basename(args[0])}: ${res.count} objects for ${res.pixels} pixels (${res.grid.w}x${res.grid.h} grid${res.f > 1 ? `, image shrunk ${res.f}x to fit` : ""}), ${res.size.w.toFixed(2)} x ${res.size.h.toFixed(2)} blocks, ${res.px.toFixed(2)} units a pixel`);
  for (const [name, n] of Object.entries(res.byColour)) console.log(`  ch ${res.ch[name]}  rgb(${res.palette[name].join(",")})  ${n} objects`);
  if (opt("--json")) fs.writeFileSync(opt("--json"), JSON.stringify({ objects: res.objects, colours: res.colours }));
  if (opt("--preview")) { preview(res, opt("--preview")); console.log("preview:", opt("--preview")); }
  if (opt("--into")) {
    const { GD, readGdlvl, writeGdlvl } = require("./io.js"), P = require("../lib/props.js");
    const L = readGdlvl(opt("--into")), lvl = GD.parseLevel(L.levelStr);
    lvl.header = P.header(lvl.header, res.colours);
    if (res.glowCh) lvl.header = lvl.header.replace(new RegExp(`(_6_${res.glowCh})_7_1`), "$1_7_0.4");
    lvl.objects.push(...res.objects);
    const out = opt("--out") || opt("--into").replace(/\.gdlvl$/, "_art.gdlvl");
    writeGdlvl(out, L.rec, lvl); console.log("wrote", out);
  }
}
module.exports = { convert, preview };
