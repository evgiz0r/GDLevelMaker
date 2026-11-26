// node tools/decoart.js <level.gdlvl> [--from 0 --to 88] [--scene hellgate] [--shapes 300] [--seed 3]
//        [--variants kit,fit,vector] [--out local/decoart] [--image pic.png]
// The deco-as-a-picture experiment (DECOART.md): one stretch of a level dressed three ways, so they can be compared
// side by side in the viewer --
//   kit     the level's own deco as it is (the theme kit), cut to the stretch: the baseline;
//   fit     approach A, "paint then fit": a matte painting (tools/paintscene.js) of the scene's back (sky, sun,
//           clouds, far ranges) fitted with --shapes GD shapes (lib/paintfit.js), soft and painterly; the near
//           silhouettes as clean vector shapes;
//   vector  approach B: the same picture straight as clean vector shapes (bands, disks, ridges of squares + right
//           triangles);
//   image   approach C (with --image): any picture -- the user's drawing, a generated image -- fitted as the back.
// Both picture variants replace the stretch's back layers (B5 / B4 / B3 deco) and keep the play's own dressing. The back
// spans y -30..270 (what a cube part shows: ~8 blocks over the ground) and is locked to the player's x at 0.9 (it drifts slowly: far away), the near layer at 0.75 (parallax).
// Writes <out>/<base>_<variant>.gdlvl plus a preview PNG of the back for each (art-free, exact for these shapes).
// Not heavy (no solve); put each in the viewer with `node tools/wip.js put <file> --session deco-art`.
"use strict";
const fs = require("fs"), path = require("path");
const io = require("./io.js"), K = require("./scenekit.js"), PS = require("./paintscene.js"), PF = require("../lib/paintfit.js");

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const file = args[0];
if (!file || file.startsWith("--")) { console.log(fs.readFileSync(__filename, "utf8").split("\n").slice(0, 16).join("\n")); process.exit(1); }
const B0 = +opt("--from", 0), B1 = +opt("--to", 88), X1 = B1 * 30, SPEED = 311.58;
const sceneName = opt("--scene", "hellgate"), nShapes = +opt("--shapes", 500), seed = +opt("--seed", 3);
const OUT = opt("--out", path.join(__dirname, "..", "local", "decoart"));
const variants = opt("--variants", "kit,fit,vector" + (opt("--image") ? ",image" : "")).split(",");
fs.mkdirSync(OUT, { recursive: true });

const UPP = 2.5, TOP = 270, BOTTOM = -30, H = (TOP - BOTTOM) / UPP, GROUND = TOP / UPP;   // the picture spans y -30..270
const LOCK = { back: 0.9, near: 0.75 }, X0 = -300, MARGIN = 240;
const widthFor = mul => Math.round((600 + (1 - mul) * (X1 - B0 * 30) + MARGIN) / UPP);
const CH = { back: 700, near: 760 }, G = { back: 1101, near: 1102 };
const secs = (X1 - B0 * 30) / SPEED + 3;

function cut() {
  const R = io.readGdlvl(file), L = R.level;
  L.objects = L.objects.filter(o => o.x == null || o.x < X1);
  return R;
}
const BACK_LAYERS = new Set(["-5", "-3", "-1"]);
function stripBack(L) {
  const before = L.objects.length;
  L.objects = L.objects.filter(o => !(o.x >= B0 * 30 - 600 && o.x < X1 + 600 && o.props && BACK_LAYERS.has(String(o.props[24]))));
  return before - L.objects.length;
}
function place(L, shapes, layerName, gdLayer, k) {
  const g = PF.toGD(shapes, { x0: X0 + B0 * 30, y0: TOP, upp: UPP, ch0: CH[layerName], k, layer: gdLayer, groups: [G[layerName]], zo0: layerName === "back" ? -60 : -10 });
  L.objects.push(...g.objects);
  L.objects.push(K.lockX(B0 * 30 + 15, G[layerName], secs, LOCK[layerName]));
  L.header = K.channels(L.header, g.channels);
  return g;
}
const BACK = new Set(["sky", "sun", "clouds", "far"]);
const pick = (sc, names) => Object.assign({}, sc, { layers: sc.layers.filter(l => names(l.name)) });

for (const v of variants) {
  const R = cut(), L = R.level, base = path.basename(file, ".gdlvl"), name = `${base}_${v}`;
  let note = "";
  if (v !== "kit") {
    const removed = stripBack(L);
    const wb = widthFor(LOCK.back), wn = widthFor(LOCK.near);
    // the focal point (the scene's sun) at 68% of the screen's width half way through the stretch: the camera's left edge
    // is ~260 units behind the player and the view ~570 wide (1080p, measured on the viewer's frames)
    const mid = (B0 * 30 + X1) / 2, left = X0 + B0 * 30 + LOCK.back * (mid - B0 * 30), focal = (mid - 260 + 0.68 * 570 - left) / (wb * UPP);
    const scB = PS.scene(sceneName, wb, H, GROUND, seed, { focal }), scN = PS.scene(sceneName, wn, H, GROUND, seed, { focal });
    let back;
    if (v === "vector") back = PS.vector(pick(scB, n => BACK.has(n)));
    else {
      let target;
      if (v === "image") { const { readPng } = require("./png.js"), im = readPng(opt("--image"));
        target = { w: wb, h: H, rgb: new Float32Array(wb * H * 3) };
        for (let y = 0; y < H; y++) for (let x = 0; x < wb; x++) { const sx = Math.min(im.w - 1, Math.floor(x * im.w / wb)), sy = Math.min(im.h - 1, Math.floor(y * im.h / H));
          for (let c = 0; c < 3; c++) target.rgb[3 * (y * wb + x) + c] = im.rgba[4 * (sy * im.w + sx) + c]; } }
      else target = { w: wb, h: H, rgb: PS.raster(pick(scB, n => BACK.has(n))) };
      const t0 = Date.now(), f = PF.fit(target, { shapes: nShapes, seed });
      // the fit's own background colour becomes one big square at the back of the picture
      back = [{ k: "rect", x: wb / 2, y: H / 2, w: wb + 4, h: H + 4, rot: 0, c: f.bg, a: 1 }].concat(f.shapes);
      PS.toPng(path.join(OUT, name + "_target.png"), target.rgb, wb, H);
      note = `fit ${f.shapes.length} shapes, rmse ${f.error.toFixed(1)}, ${((Date.now() - t0) / 1000).toFixed(0)} s; `;
    }
    const near = PS.vector(pick(scN, n => !BACK.has(n)));
    const gb = place(L, back, "back", -5, 6), gn = place(L, near, "near", -3, 4);
    PS.toPng(path.join(OUT, name + "_back.png"), PF.render(PF.fromGD(gb.objects, Object.assign({}, gb.channels), { x0: X0 + B0 * 30, y0: TOP, upp: UPP }), wb, H, [0, 0, 0]), wb, H);
    note += `removed ${removed} back-layer deco, back ${gb.objects.length} objects (${Object.keys(gb.channels).length} channels), near ${gn.objects.length}`;
  }
  io.GD.setField(R.rec, "k2", "s", `${R.name} art ${v}`);
  const out = path.join(OUT, name + ".gdlvl");
  io.writeGdlvl(out, R.rec, L);
  console.log(`${v}: ${out} (${L.objects.length} objects) ${note}`);
}
