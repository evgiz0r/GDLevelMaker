// node tools/paintscene.js [scene] [--w 384 --h 180] [--seed 3] [--out local/decoart/<scene>.png]
// A small "matte painting" painter (DECOART.md): a scene as a list of soft painted layers -- sky gradient, sun and
// glow, cloud streaks, hazy far ridges, darker near ridges and spires -- that can be
//   raster(scene)  -> a soft target picture (anti-aliased, blurred where the item says), for lib/paintfit.js to fit
//                     with GD shapes (approach A, "paint then fit"), and
//   vector(scene)  -> the same items straight as GD shapes (approach B, clean vector: ridges as squares + right
//                     triangles, glows as stacked see-through disks, the sky as bands),
// so the two approaches show the same picture in two styles. Pure node, no dependencies.
// Scenes: hellgate (dusk over the gates of hell), list: node tools/paintscene.js --list
"use strict";
const fs = require("fs"), path = require("path");
const PF = require("../lib/paintfit.js");

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
function rng(seed) { let s = seed || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

// a jagged ridge line by midpoint displacement: points [x, y] from x0 to x1 (pixel space, y down)
function ridge(x0, x1, yBase, rough, R, n = 32, peaks = []) {
  let pts = [[x0, yBase + (R() - 0.5) * rough], [x1, yBase + (R() - 0.5) * rough]], amp = rough;
  while (pts.length < n) {
    const next = [];
    for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1];
      next.push(a, [(a[0] + b[0]) / 2 + (R() - 0.5) * amp * 0.3, (a[1] + b[1]) / 2 + (R() - 0.5) * amp]); }
    next.push(pts[pts.length - 1]); pts = next; amp *= 0.62;
  }
  for (const p of peaks) for (const q of pts) { const d = Math.abs(q[0] - p.x) / p.w; if (d < 1) q[1] -= p.h * (1 - d); }
  return pts.sort((a, b) => a[0] - b[0]);
}

// ---- scenes. Coordinates: pixels of the working picture (w x h, y down); the caller says how many GD units a
// pixel is. `ground` = the pixel row of GD's ground line (y 0). ----
const SCENES = {
  // Dusk over the gates of hell: a dark crimson sky, a pale sun high in it with a wide glow, smoke streaks lit from
  // below, a hazy far range, a dark near range with two gate towers and spires, a lava haze along the floor.
  hellgate(w, h, ground, R, o = {}) {
    const fx = o.focal ?? 0.62;   // where the focal point (the sun) sits, as a share of the width
    const top = [28, 6, 26], mid = [104, 20, 34], hor = [226, 96, 44], deep = [18, 4, 10];
    const sun = { x: w * fx, y: h * 0.26 };
    const L = [];
    L.push({ name: "sky", items: [{ t: "grad", stops: [[0, top], [0.45, mid], [ground / h * 0.86, hor], [1, hor]] }] });
    L.push({ name: "sun", items: [
      { t: "glow", x: sun.x, y: sun.y, r: h * 0.75, c: [255, 120, 50], a: 0.55 },
      { t: "glow", x: sun.x, y: sun.y, r: h * 0.3, c: [255, 200, 120], a: 0.55 },
      { t: "disk", x: sun.x, y: sun.y, r: h * 0.11, c: [255, 226, 170], a: 1, blur: 1 }] });
    const clouds = [];
    for (let i = 0; i < 9; i++) { const y = h * (0.1 + R() * 0.32), x = R() * w, rx = w * (0.08 + R() * 0.14), ry = h * (0.012 + R() * 0.02);
      const lit = mix([60, 12, 28], [255, 150, 80], Math.max(0, 1 - Math.hypot(x - sun.x, (y - sun.y) * 2) / (w * 0.4)));
      clouds.push({ t: "ellipse", x, y, rx, ry, c: mix(mid, top, 0.4), a: 0.7, blur: 2 }, { t: "ellipse", x: x + rx * 0.08, y: y + ry * 0.7, rx: rx * 0.75, ry: ry * 0.45, c: lit, a: 0.75, blur: 1 }); }
    L.push({ name: "clouds", items: clouds });
    const farther = ridge(-4, w + 4, ground - h * 0.36, h * 0.3, R, 64, [{ x: w * 0.82, w: w * 0.1, h: h * 0.14 }]);
    const far = ridge(-4, w + 4, ground - h * 0.24, h * 0.34, R, 64, [{ x: w * 0.22, w: w * 0.12, h: h * 0.16 }]);
    const down = (pts, dy) => pts.map(([x, y]) => [x, y + dy]);
    L.push({ name: "far", items: [{ t: "ridge", pts: farther, base: h, c: mix(mid, [200, 80, 90], 0.45), a: 1, blur: 0.8 },
      { t: "ridge", pts: far, base: h, c: [236, 120, 64], a: 1 },                      // the lit rim facing the sun
      { t: "ridge", pts: down(far, 1.6), base: h, c: [112, 26, 38], a: 1 },
      { t: "band", y0: ground - h * 0.16, y1: ground + 2, c: hor, a0: 0, a1: 0.45 }] });
    const near = ridge(-4, w + 4, ground - h * 0.08, h * 0.1, R, 48);
    // the gate: a landmark far off in the haze (dark red, never as dark as the play's spikes: shapes that read as
    // gameplay stay out, TASTE.md), two towers with pointed tops and a lintel, at the third of the picture
    const gate = [], gc = mix(mid, deep, 0.45), gx0 = w * (fx - 0.24), gx1 = w * (fx - 0.17), tw = Math.max(4, w * 0.012);
    for (const gx of [gx0, gx1]) gate.push({ t: "poly", pts: [[gx - tw, ground], [gx - tw, ground - h * 0.5], [gx, ground - h * 0.6], [gx + tw, ground - h * 0.5], [gx + tw, ground]], c: gc, a: 1 });
    gate.push({ t: "poly", pts: [[gx0 + tw - 1, ground - h * 0.44], [gx1 - tw + 1, ground - h * 0.44], [gx1 - tw + 1, ground - h * 0.38], [gx0 + tw - 1, ground - h * 0.38]], c: gc, a: 1 });
    L[L.length - 1].items.splice(3, 0, ...gate);
    // (no small spires along the floor: dark triangles by the ground read as spikes -- the first render, 2026-11-26)
    L.push({ name: "near", items: [{ t: "ridge", pts: near, base: h, c: [200, 80, 44], a: 1 }, { t: "ridge", pts: down(near, 1.2), base: h, c: [70, 18, 28], a: 1 },
      { t: "band", y0: ground - h * 0.06, y1: ground + 2, c: [255, 90, 30], a0: 0, a1: 0.3 }] });
    return { w, h, ground, layers: L, focal: sun };
  },
};

// ---- raster: a soft picture ----
function raster(sc, ss = 2) {
  const W = sc.w * ss, H = sc.h * ss, img = new Float32Array(W * H * 3);
  const over = (i, c, a) => { const j = 3 * i; img[j] += (c[0] - img[j]) * a; img[j + 1] += (c[1] - img[j + 1]) * a; img[j + 2] += (c[2] - img[j + 2]) * a; };
  const blurMask = (m, r) => { if (!(r > 0)) return m; r = Math.round(r * ss); const t = new Float32Array(m.length);
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < H; y++) { let s = 0; for (let x = -r; x < W + r; x++) { if (x + r < W && x + r >= 0) s += m[y * W + x + r]; if (x - r - 1 >= 0 && x - r - 1 < W) s -= m[y * W + x - r - 1]; if (x >= 0 && x < W) t[y * W + x] = s / (2 * r + 1); } }
      for (let x = 0; x < W; x++) { let s = 0; for (let y = -r; y < H + r; y++) { if (y + r < H && y + r >= 0) s += t[(y + r) * W + x]; if (y - r - 1 >= 0 && y - r - 1 < H) s -= t[(y - r - 1) * W + x]; if (y >= 0 && y < H) m[y * W + x] = s / (2 * r + 1); } } }
    return m; };
  const polyMask = pts => { const m = new Float32Array(W * H);
    for (let y = 0; y < H; y++) { const py = (y + 0.5) / ss, xs = [];
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j];
        if ((a[1] > py) !== (b[1] > py)) xs.push(a[0] + (py - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.ceil(xs[k] * ss - 0.5)); x < Math.min(W, xs[k + 1] * ss - 0.5); x++) m[y * W + x] = 1; }
    return m; };
  for (const layer of sc.layers) for (const it of layer.items) {
    if (it.t === "grad") { for (let y = 0; y < H; y++) { const f = (y + 0.5) / H; let k = 0; while (k < it.stops.length - 2 && f > it.stops[k + 1][0]) k++;
        const [f0, c0] = it.stops[k], [f1, c1] = it.stops[k + 1], c = mix(c0, c1, Math.max(0, Math.min(1, (f - f0) / (f1 - f0 || 1))));
        for (let x = 0; x < W; x++) over(y * W + x, c, 1); } continue; }
    if (it.t === "glow") { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.hypot((x + 0.5) / ss - it.x, (y + 0.5) / ss - it.y) / it.r;
        if (d < 1) over(y * W + x, it.c, it.a * Math.pow(1 - d, 2)); } continue; }
    if (it.t === "band") { for (let y = 0; y < H; y++) { const py = (y + 0.5) / ss; if (py < it.y0 || py > it.y1) continue; const a = it.a0 + (it.a1 - it.a0) * (py - it.y0) / (it.y1 - it.y0);
        for (let x = 0; x < W; x++) over(y * W + x, it.c, a); } continue; }
    let m;
    if (it.t === "disk" || it.t === "ellipse") { const rx = it.rx || it.r, ry = it.ry || it.r; m = new Float32Array(W * H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const u = ((x + 0.5) / ss - it.x) / rx, v = ((y + 0.5) / ss - it.y) / ry; if (u * u + v * v <= 1) m[y * W + x] = 1; } }
    else if (it.t === "ridge") m = polyMask(it.pts.concat([[it.pts[it.pts.length - 1][0], it.base], [it.pts[0][0], it.base]]));
    else if (it.t === "poly") m = polyMask(it.pts);
    if (!m) continue;
    blurMask(m, it.blur || 0);
    for (let i = 0; i < W * H; i++) if (m[i] > 0.001) over(i, it.c, it.a * Math.min(1, m[i]));
  }
  // down to the working size (box filter)
  const out = new Float32Array(sc.w * sc.h * 3);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = 3 * (Math.floor(y / ss) * sc.w + Math.floor(x / ss)), j = 3 * (y * W + x);
    for (let k = 0; k < 3; k++) out[o + k] += img[j + k] / (ss * ss); }
  return out;
}

// ---- vector: the same items as paintfit shapes (pixel space), clean edges ----
function vector(sc) {
  const S = [], { w, h } = sc;
  const rect = (x, y, ww, hh, c, a, rot = 0) => S.push({ k: "rect", x, y, w: ww, h: hh, rot, c, a });
  for (const layer of sc.layers) for (const it of layer.items) {
    if (it.t === "grad") { const n = 12; for (let i = 0; i < n; i++) { const f0 = i / n, f1 = (i + 1) / n, f = (f0 + f1) / 2; let k = 0;
        while (k < it.stops.length - 2 && f > it.stops[k + 1][0]) k++;
        const [g0, c0] = it.stops[k], [g1, c1] = it.stops[k + 1];
        rect(w / 2, (f0 + f1) / 2 * h, w + 4, h / n + 1, mix(c0, c1, Math.max(0, Math.min(1, (f - g0) / (g1 - g0 || 1)))), 1); } }
    else if (it.t === "glow") { for (const [f, a] of [[1, 0.06], [0.85, 0.07], [0.7, 0.08], [0.56, 0.09], [0.43, 0.11], [0.31, 0.13], [0.2, 0.16]]) S.push({ k: "disk", x: it.x, y: it.y, w: 2 * it.r * f, h: 2 * it.r * f, rot: 0, c: it.c, a: Math.min(1, a * it.a * 1.6) }); }
    else if (it.t === "disk" || it.t === "ellipse") S.push({ k: "disk", x: it.x, y: it.y, w: 2 * (it.rx || it.r), h: 2 * (it.ry || it.r), rot: 0, c: it.c, a: it.a });
    else if (it.t === "band") { const n = 4; for (let i = 0; i < n; i++) { const y0 = it.y0 + (it.y1 - it.y0) * i / n, y1 = it.y0 + (it.y1 - it.y0) * (i + 1) / n;
        rect(w / 2, (y0 + y1) / 2, w + 4, y1 - y0 + 0.5, it.c, it.a0 + (it.a1 - it.a0) * (i + 0.5) / n); } }
    else if (it.t === "ridge") {
      // simplify to ~14 segments, then each segment: a square from the base up to its lower end + a right triangle on top
      const pts = it.pts.filter((_, i) => i % Math.max(1, Math.floor(it.pts.length / 14)) === 0).concat([it.pts[it.pts.length - 1]]);
      for (let i = 0; i + 1 < pts.length; i++) { const [xa, ya] = pts[i], [xb, yb] = pts[i + 1], lo = Math.max(ya, yb), hi = Math.min(ya, yb), ww = xb - xa + 0.6;
        rect((xa + xb) / 2, (lo + it.base) / 2, ww, it.base - lo + 0.5, it.c, it.a);
        if (lo - hi > 0.5) S.push({ k: "tri", x: (xa + xb) / 2, y: (lo + hi) / 2, w: ww, h: lo - hi, rot: 0, fx: yb > ya, c: it.c, a: it.a }); } }
    else if (it.t === "poly") { // spires and towers: a triangle pair for a pointed shape, a square for a box (bounding parts)
      const xs = it.pts.map(p => p[0]), ys = it.pts.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      if (it.pts.length === 3) { const ax = it.pts[1][0];
        S.push({ k: "tri", x: (x0 + ax) / 2, y: (y0 + y1) / 2, w: ax - x0, h: y1 - y0, rot: 0, fx: false, c: it.c, a: it.a });
        S.push({ k: "tri", x: (ax + x1) / 2, y: (y0 + y1) / 2, w: x1 - ax, h: y1 - y0, rot: 0, fx: true, c: it.c, a: it.a }); }
      else if (it.pts.length === 5 && it.pts[2][1] === y0) { const sh = it.pts[1][1]; // a tower: body + pointed top
        rect((x0 + x1) / 2, (sh + y1) / 2, x1 - x0, y1 - sh, it.c, it.a);
        S.push({ k: "tri", x: (x0 + it.pts[2][0]) / 2, y: (y0 + sh) / 2, w: it.pts[2][0] - x0, h: sh - y0, rot: 0, fx: false, c: it.c, a: it.a });
        S.push({ k: "tri", x: (it.pts[2][0] + x1) / 2, y: (y0 + sh) / 2, w: x1 - it.pts[2][0], h: sh - y0, rot: 0, fx: true, c: it.c, a: it.a }); }
      else rect((x0 + x1) / 2, (y0 + y1) / 2, x1 - x0, y1 - y0, it.c, it.a); }
  }
  return S;
}

function scene(name, w, h, ground, seed, o = {}) {
  const f = SCENES[name]; if (!f) throw new Error("no scene " + name + " (have: " + Object.keys(SCENES).join(", ") + ")");
  return f(w, h, ground, rng(seed || 3), o);
}
function toPng(file, rgb, w, h) {
  const { writePng } = require("./png.js"), b = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) { for (let k = 0; k < 3; k++) b[4 * i + k] = Math.max(0, Math.min(255, Math.round(rgb[3 * i + k]))); b[4 * i + 3] = 255; }
  fs.mkdirSync(path.dirname(file), { recursive: true }); writePng(file, w, h, b);
}

module.exports = { SCENES, scene, raster, vector, ridge, toPng };

if (require.main === module) {
  const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  if (args.includes("--list")) { console.log(Object.keys(SCENES).join("\n")); process.exit(0); }
  const name = args[0] && !args[0].startsWith("--") ? args[0] : "hellgate", w = +opt("--w", 384), h = +opt("--h", 180);
  const sc = scene(name, w, h, Math.round(h * 0.85), +opt("--seed", 3));
  const out = opt("--out", path.join(__dirname, "..", "local", "decoart", name + ".png"));
  toPng(out, raster(sc), w, h);
  toPng(out.replace(/\.png$/, "_vector.png"), PF.render(vector(sc), w, h, [0, 0, 0]), w, h);
  console.log("wrote", out, "and", out.replace(/\.png$/, "_vector.png"), `(${vector(sc).length} vector shapes)`);
}
