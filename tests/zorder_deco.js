// node tests/zorder_deco.js -- the viewer draws back deco in its z-layer order (key 24, then 25), not in file order
//
// Evgeni (2026-11-28, Hellgate theme card): "some objects don't have the 3D", "missing 3D on the ground, looks like a
// hole". The structures' 3D faces (tools/structdesign.js, B1) were in the level; the viewer's no-art renderer (the one
// the cloud cards and the phone use) drew back deco in file order, so a B5 backdrop slab written later covered them.
// GD draws by layer. This renders a white B1 strip with a black B5 slab after it in the file: the strip must stay seen.
const fs = require("fs"), path = require("path"), os = require("os"), cp = require("child_process");
const io = require("../tools/io.js"), ROOT = path.join(__dirname, "..");
const base = io.readGdlvl(path.join(ROOT, "levels", "gdlm_74_icy_part.gdlvl"));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zorder-"));
const sq = (x, y, sx, sy, z, ch) => ({ id: 211, x, y, rot: 0, flipX: false, flipY: false, props: { 21: String(ch), 24: String(z), 25: "0", 128: String(sx), 129: String(sy) } });
const strip = sq(240, 200, 6, 0.4, 3, 1011), slab = sq(240, 200, 8, 3, -5, 1010);
function shot(objs, name) {
  const lvl = { header: base.level.header, objects: objs }, f = path.join(tmp, name + ".gdlvl");
  io.writeGdlvl(f, Object.assign({}, base.rec, { k2: "zorder " + name }), lvl);
  cp.spawnSync(process.execPath, [path.join(ROOT, "tools", "shoot.js"), f, "--at", "0.2", "--shapes", "--out", path.join(tmp, name)], { windowsHide: true, env: Object.assign({}, process.env, { GDLM_HEAVY_NOSYNC: "1" }) });
  return path.join(tmp, name, "t000.20.png");
}
const white = png => { const { rgba } = require("../tools/png.js").readPng(png); let n = 0;
  for (let i = 0; i < rgba.length; i += 4) if (rgba[i] > 235 && rgba[i + 1] > 235 && rgba[i + 2] > 235) n++; return n; };
const a = shot([strip], "a"), b = shot([strip, slab], "b");
if (!fs.existsSync(a) || !fs.existsSync(b)) { console.log("SKIP: no headless browser here"); process.exit(0); }
const na = white(a), nb = white(b);
console.log(`white pixels: strip alone ${na}, strip + later B5 slab ${nb}`);
if (na < 200) { console.log("FAIL: the strip did not render"); process.exit(1); }
if (nb < na * 0.8) { console.log("FAIL: a B5 slab later in the file covered a B1 strip"); process.exit(1); }
console.log("ok");
