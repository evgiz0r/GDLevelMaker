// node tools/pathpic.js <official N | level.gdlvl> --from <block> --to <block> [--route a.json --route b.json ...] [--out file.png]
//   A route's path through a stretch as a picture, routes stacked one panel each (before / after a planner change): solids
//   grey, hazards red, the path in white with the button held drawn green, a dot at each press. Routes: viewer-route files
//   (local/official_NN.json shape: {level, solution: {events}}); none given = the current local/official_NN.json.
//   Writes a PNG (ffmpeg converts a PPM): local/shots/pathpic/<name>.png. Art-free (shapes only), local only.
const fs = require("fs"), path = require("path"), cp = require("child_process");
const { GD, unpack, readGdlvl } = require("./io.js");
const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
const routes = a.map((x, i) => a[i - 1] === "--route" ? x : null).filter(Boolean);
const lv = a[0];
if (!lv || opt("--from") == null) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
const ROOT = path.join(__dirname, ".."), SRC = process.env.GD_LEVELS || "C:/Program Files (x86)/Steam/steamapps/common/Geometry Dash/Resources/levels/";
const n = /^\d+$/.test(lv) ? +lv : null;
if (!routes.length && n) routes.push(path.join(ROOT, "local", `official_${String(n).padStart(2, "0")}.json`));
const levelStr = n ? unpack(fs.readFileSync(path.join(SRC, n + ".txt"), "utf8")) : readGdlvl(lv).levelStr;
const L = GD.parseLevel(levelStr), w = GD.makeWorld(L.objects, L.header);
const x0 = +opt("--from") * 30, x1 = +opt("--to") * 30, S = 2;   // px per unit
const paths = routes.map(f => { const v = JSON.parse(fs.readFileSync(f, "utf8")), ev = v.solution ? v.solution.events : v.events; return { name: path.basename(f), ev, p: GD.run(w, ev).path }; });
// the y range: the paths' range plus a margin
let ylo = Infinity, yhi = -Infinity;
for (const r of paths) for (const s of r.p) if (s.x >= x0 && s.x <= x1) { ylo = Math.min(ylo, s.y); yhi = Math.max(yhi, s.y); }
ylo = Math.max(0, Math.floor((ylo - 120) / 30) * 30); yhi = Math.ceil((yhi + 120) / 30) * 30;
const W = Math.round((x1 - x0) * S), PH = Math.round((yhi - ylo) * S), H = PH * paths.length + 4 * (paths.length - 1);
const img = Buffer.alloc(W * H * 3, 24);
const put = (x, y, c) => { if (x < 0 || y < 0 || x >= W || y >= H) return; const i = (y * W + x) * 3; img[i] = c[0]; img[i + 1] = c[1]; img[i + 2] = c[2]; };
const rect = (px0, py0, px1, py1, c) => { for (let y = Math.max(0, py0); y < Math.min(H, py1); y++) for (let x = Math.max(0, px0); x < Math.min(W, px1); x++) put(x, y, c); };
paths.forEach((r, k) => {
  const top = k * (PH + 4), X = x => Math.round((x - x0) * S), Y = y => top + Math.round((yhi - y) * S);
  for (const b of w.items) {
    if (b.x1 < x0 || b.x0 > x1 || b.y1 < ylo || b.y0 > yhi) continue;
    const c = b.kind === "solid" || b.kind === "slope" ? [110, 110, 120] : b.kind === "hazard" ? [200, 50, 50] : b.kind === "orb" || b.kind === "pad" ? [230, 200, 40] : null;
    if (c) rect(X(b.x0), Y(b.y1), X(b.x1), Y(b.y0), c);
  }
  rect(0, Y(0), W, Y(0) + 2, [80, 80, 160]);
  const ev = new Map(r.ev.map(e => [e.tick, e.type])); let held = false;
  for (let t = 0; t < r.p.length; t++) {
    const e = ev.get(t); if (e === "press") held = true; if (e === "release") held = false;
    const s = r.p[t]; if (s.x < x0 || s.x > x1) continue;
    const c = held ? [60, 230, 90] : [235, 235, 235];
    rect(X(s.x) - 1, Y(s.y) - 1, X(s.x) + 2, Y(s.y) + 2, c);
    if (e === "press") rect(X(s.x) - 3, Y(s.y) - 3, X(s.x) + 4, Y(s.y) + 4, [60, 230, 90]);
  }
  if (k) rect(0, top - 4, W, top, [255, 255, 255]);
});
const out = opt("--out", path.join(ROOT, "local", "shots", "pathpic", `${n ? "official_" + n : path.basename(lv, ".gdlvl")}_${opt("--from")}-${opt("--to")}.png`));
fs.mkdirSync(path.dirname(out), { recursive: true });
const ppm = out.replace(/\.png$/, ".ppm"); fs.writeFileSync(ppm, Buffer.concat([Buffer.from(`P6\n${W} ${H}\n255\n`), img]));
cp.execFileSync(process.env.FFMPEG || "ffmpeg", ["-loglevel", "error", "-y", "-i", ppm, out], { windowsHide: true }); fs.unlinkSync(ppm);
console.log(`wrote ${out} (${paths.map(r => r.name).join(" / ")}, top to bottom)`);
