// node tools/thumb.js <level.gdlvl | "GDLM NN" | official:N | save:<name>> [--gif] [--size 1280x720] [--cands 8]
//                     [--at <s>] [--shapes] [--out <dir>] [--port 8767]
// A level -> one picture that shows it at its best (and, with --gif, a short loop around that moment), for sharing, the
// board and level lists (the user, 2026-11-25: "Level -> thumbnail"). THUMBS.md: how the moment is picked, numbers, open.
//   1. Every half second of the route (the saved one: tools/solutions.js or viewer/levels.js; none -> a ghost at the
//      level's speed) gets a level-data score from what is on screen there (the viewer's camera: 19 blocks, player at
//      0.36): how much is drawn, how many kinds of object, play near the player (hazards, orbs, pads, portals), a mode
//      other than the cube. The first 1.5 s and the last second are left out (empty start, end wall).
//   2. The best --cands (8) moments at least 2 s apart are rendered headless by the viewer (tools/shoot.js's page: GD's
//      own art when the game is on this computer, else the viewer's game look) and each picture is scored: colourfulness
//      (Hasler-Suesstrunk), contrast (luma spread), detail (edge share), minus a flat-screen penalty (one colour over most
//      of it). Final = 0.6 picture + 0.4 data, both as ranks among the candidates.
//   3. -> local/thumbs/<level>/thumb.png (the pick at --size), thumb_small.png (480 wide, needs ffmpeg), cands/ (every
//      candidate), thumb.json (every candidate's numbers), and with --gif thumb.gif (3 s around the pick, 15 fps,
//      480 wide; needs ffmpeg).
//   --at s     skip the search: that moment. --shapes: the viewer's game look even where GD's art is on this computer.
// LOCAL ONLY when GD's art is in it (RobTop's art): never commit, never put on the public site. A thumbnail of OUR level
// in the game look (--shapes, or a computer with no GD) has no RobTop art in it.
// One heavy job (a headless browser: tools/heavy.js). Measured: THUMBS.md "Results".
if (require.main === module) require("./heavy.js").claim();
const fs = require("fs"), path = require("path"), vm = require("vm"), cp = require("child_process");
const ROOT = path.join(__dirname, ".."), { headless } = require("./headless.js"), { readPng } = require("./png.js");
const { GD } = require("./io.js");
const args = process.argv.slice(2), opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const GAME = require("./gdpaths.js").GAME;   // where GD is on this computer (SETUP.md)
const TPS = 240, VIEW_BLOCKS = 19, PLAYER_AT = 0.36;

// the level and a route: shoot.js's reader, then the saved solution (local) or the viewer's embedded one
function levelAndRoute(arg) {
  let file = arg;
  if (!/^(official|save):/.test(arg) && !fs.existsSync(arg)) {   // "GDLM 70" / "candy" -> the viewer's level list
    const e = viewerLevels().find(e => e.name.toLowerCase().startsWith(arg.toLowerCase()) || e.file.toLowerCase().includes(arg.toLowerCase()));
    if (!e) throw new Error("no level like '" + arg + "' (a .gdlvl path, a GDLM name, official:N or save:<name>)");
    file = path.join(ROOT, e.file);
  }
  const lv = require("./shoot.js").levelOf(file);
  if (!lv.solution) { try { const s = require("./solutions.js").get(lv.levelStr, true); if (s && s.events) lv.solution = s; } catch (e) {} }
  if (!lv.solution) { const e = viewerLevels().find(e => e.level === lv.levelStr || (fs.existsSync(file) && path.resolve(ROOT, e.file) === path.resolve(file)));
    if (e && e.solution && e.solution.events) lv.solution = e.solution; }
  return { lv, file };
}
let VL = null;
function viewerLevels() {
  if (VL) return VL;
  try { const c = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(ROOT, "viewer", "levels.js"), "utf8"), c); VL = c.window.GD_LEVELS || []; } catch (e) { VL = []; }
  return VL;
}

// the player's x and mode at every tick: the route replayed, or a ghost at the start speed
function pathOf(lv) {
  const L = GD.parseLevel(lv.levelStr), w = GD.makeWorld(L.objects, L.header);
  let path_ = null;
  if (lv.solution && lv.solution.events && lv.solution.events.length) { const r = GD.run(w, lv.solution.events); if (r.path.length > TPS) path_ = r.path; }
  if (!path_) { const P = require("../lib/physics.js"), v = ((P.SPEEDS[0] || P.SPEEDS[1]).x) * 60 / TPS; path_ = [];
    for (let k = 0; k * v < w.endX; k++) path_.push({ x: k * v, y: 0, mode: "cube", ghost: true }); }
  return { L, w, path: path_ };
}

// level-data score of each moment: what the viewer's camera has in view there
function dataScores(L, w, pth) {
  const VW = VIEW_BLOCKS * 30, objs = [];
  for (const o of L.objects) { const k = GD.objInfo(o.id).kind; if (k === "trigger") continue; objs.push({ x: o.x, id: o.id, k }); }
  objs.sort((a, b) => a.x - b.x);
  const lo = x => { let a = 0, b = objs.length; while (a < b) { const m = (a + b) >> 1; if (objs[m].x < x) a = m + 1; else b = m; } return a; };
  const end = (pth.length - 1) / TPS, out = [];
  for (let t = 1.5; t <= end - 1; t += 0.5) {
    const s = pth[Math.min(pth.length - 1, Math.round(t * TPS))], x0 = s.x - VW * PLAYER_AT, x1 = x0 + VW;
    let n = 0, play = 0; const ids = new Set();
    for (let i = lo(x0); i < objs.length && objs[i].x <= x1; i++) { const o = objs[i]; n++; ids.add(o.id);
      if (/hazard|orb|pad|mode|gravity|speed|size|portal/.test(o.k) && o.x > s.x - 30 && o.x < s.x + 300) play++; }
    out.push({ t: +t.toFixed(2), x: Math.round(s.x), mode: s.mode || "cube", objects: n, kinds: ids.size, play });
  }
  const top = k => Math.max(1, ...out.map(c => c[k]).sort((a, b) => a - b).slice(0, Math.max(1, Math.ceil(out.length * 0.95))));
  const nTop = top("objects"), kTop = top("kinds"), pTop = top("play");
  for (const c of out) c.data = +(0.35 * Math.min(1, c.objects / nTop) + 0.3 * Math.min(1, c.kinds / kTop) + 0.2 * Math.min(1, c.play / pTop) + 0.15 * (c.mode !== "cube" ? 1 : 0)).toFixed(3);
  return out;
}
function pickSpaced(cands, n, gap) {
  const by = cands.slice().sort((a, b) => b.data - a.data), got = [];
  for (const c of by) { if (got.length >= n) break; if (got.every(g => Math.abs(g.t - c.t) >= gap)) got.push(c); }
  return got.sort((a, b) => a.t - b.t);
}

// picture score: colourful, contrasty, detailed, not one flat colour (sampled every 2nd pixel)
function imageScore(file) {
  const { w, h, rgba } = readPng(file);
  let n = 0, sRg = 0, sYb = 0, sRg2 = 0, sYb2 = 0, sL = 0, sL2 = 0, edges = 0; const hist = new Map();
  for (let y = 0; y < h - 2; y += 2) for (let x = 0; x < w - 2; x += 2) {
    const i = (y * w + x) * 4, r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    const rg = r - g, yb = (r + g) / 2 - b, l = 0.299 * r + 0.587 * g + 0.114 * b;
    sRg += rg; sRg2 += rg * rg; sYb += yb; sYb2 += yb * yb; sL += l; sL2 += l * l; n++;
    const j = i + 8, l2 = 0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2];
    const k = i + w * 8, l3 = 0.299 * rgba[k] + 0.587 * rgba[k + 1] + 0.114 * rgba[k + 2];
    if (Math.abs(l - l2) > 24 || Math.abs(l - l3) > 24) edges++;
    const q = (r >> 5) * 64 + (g >> 5) * 8 + (b >> 5); hist.set(q, (hist.get(q) || 0) + 1);
  }
  const sd = (s, s2) => Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2));
  const colour = Math.sqrt(sd(sRg, sRg2) ** 2 + sd(sYb, sYb2) ** 2) + 0.3 * Math.sqrt((sRg / n) ** 2 + (sYb / n) ** 2);
  const flat = Math.max(...hist.values()) / n;
  return { colour: +colour.toFixed(1), contrast: +sd(sL, sL2).toFixed(1), detail: +(edges / n).toFixed(3), flat: +flat.toFixed(3) };
}
const rankOf = (arr, k) => { const v = arr.map(c => c[k]), s = v.slice().sort((a, b) => a - b); return v.map(x => arr.length < 2 ? 1 : s.indexOf(x) / (arr.length - 1)); };

function render(lv, times, W, H, art, extra = {}) {
  const id = "th" + Date.now().toString(36), dir = path.join(ROOT, "local", "shoot"); fs.mkdirSync(dir, { recursive: true });
  const job = Object.assign({ level: lv, times, art, width: W, height: H, followObjects: !!lv.ghostFollow }, extra);
  fs.writeFileSync(path.join(dir, id + ".json"), JSON.stringify(job));
  return headless(`viewer/?shoot=${id}`, path.join(dir, id, ".done"), { port: +(opt("--port") || 8767), width: W, height: H, timeoutMs: 15 * 60e3, stallMs: 3 * 60e3 })
    .then(r => ({ r, dir: path.join(dir, id), cleanup: () => { try { fs.rmSync(path.join(dir, id), { recursive: true, force: true }); fs.unlinkSync(path.join(dir, id + ".json")); } catch (e) {} } }));
}
function ff(a) { return cp.spawnSync(process.env.FFMPEG || "ffmpeg", ["-y", "-loglevel", "error", ...a], { windowsHide: true, maxBuffer: 1 << 26 }); }
const hasFfmpeg = () => { try { return ff(["-version"]).status === 0; } catch (e) { return false; } };

async function thumb(arg, o = {}) {
  const T0 = Date.now(), { lv } = levelAndRoute(arg);
  if (!lv.solution) { lv.solution = { ok: false, events: [], why: "not solved: the camera runs at the level's speed", pending: true }; lv.ghostFollow = (lv.levelStr.match(/;/g) || []).length > 3000; }
  const [W, H] = (o.size || "1280x720").split("x").map(Number);
  const art = !o.shapes && fs.existsSync(path.join(GAME, "Resources"));
  const { L, w, path: pth } = pathOf(lv);
  let cands = dataScores(L, w, pth);
  if (!cands.length) cands = [{ t: Math.max(0, (pth.length - 1) / TPS / 2), data: 0, objects: 0, kinds: 0, play: 0, mode: "cube" }];
  const picked = o.at != null ? [{ t: +o.at, data: 0 }] : pickSpaced(cands, o.cands || 8, 2);
  const safe = String(lv.name).replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "level";
  const out = o.out || path.join(ROOT, "local", "thumbs", safe); fs.mkdirSync(path.join(out, "cands"), { recursive: true });
  for (const f of fs.readdirSync(path.join(out, "cands"))) fs.unlinkSync(path.join(out, "cands", f));
  const R = await render(lv, picked.map(c => c.t), W, H, art);
  picked.forEach((c, i) => { const src = path.join(R.dir, String(i).padStart(3, "0") + ".png");
    if (fs.existsSync(src)) { c.file = path.join(out, "cands", `t${c.t.toFixed(2).padStart(6, "0")}.png`); fs.copyFileSync(src, c.file); Object.assign(c, imageScore(c.file)); } });
  R.cleanup();
  const got = picked.filter(c => c.file);
  if (!got.length) throw new Error(`no frames rendered (${R.r.ok ? "the page finished" : R.r.stalled ? "the page hung" : "timed out"})`);
  const rc = rankOf(got, "colour"), rt = rankOf(got, "contrast"), rd = rankOf(got, "detail"), rf = rankOf(got, "flat"), rData = rankOf(got, "data");
  got.forEach((c, i) => { c.picture = +(0.4 * rc[i] + 0.25 * rt[i] + 0.35 * rd[i] - 0.3 * rf[i]).toFixed(3); });
  const rp = rankOf(got, "picture");
  got.forEach((c, i) => { c.score = +(0.6 * rp[i] + 0.4 * rData[i]).toFixed(3); });
  const best = got.slice().sort((a, b) => b.score - a.score)[0];
  const files = { thumb: path.join(out, "thumb.png") };
  fs.copyFileSync(best.file, files.thumb);
  const ffOk = hasFfmpeg();
  if (ffOk) {
    files.small = path.join(out, "thumb_small.png"); ff(["-i", files.thumb, "-vf", "scale=480:-1:flags=lanczos", files.small]);
    if (got.length > 1) { files.sheet = path.join(out, "cands.jpg");
      const cols = Math.min(4, got.length), rows = Math.ceil(got.length / cols), inp = [];
      for (const c of got) inp.push("-i", c.file);
      const lab = got.map((c, i) => `[${i}:v]scale=480:-1,drawbox=x=0:y=0:w=iw:h=ih:color=${c === best ? "yellow" : "black"}@1:t=${c === best ? 8 : 2}[v${i}]`).join(";");
      const pad = []; for (let i = got.length; i < cols * rows; i++) pad.push(`color=black:s=480x${Math.round(480 * H / W)}[v${i}]`);
      const all = Array.from({ length: cols * rows }, (_, i) => `[v${i}]`).join("");
      ff([...inp, "-filter_complex", [lab, ...pad, `${all}xstack=inputs=${cols * rows}:layout=${Array.from({ length: cols * rows }, (_, i) => `${(i % cols) * 480}_${Math.floor(i / cols) * Math.round(480 * H / W)}`).join("|")}`].join(";"), "-frames:v", "1", "-q:v", "3", files.sheet]);
      if (!fs.existsSync(files.sheet)) delete files.sheet; }
  }
  if (o.gif) {
    if (!ffOk) console.log("--gif needs ffmpeg: no gif");
    else {
      const end = (pth.length - 1) / TPS, from = Math.max(0, best.t - 1.2), to = Math.min(end, best.t + 1.8);
      const G = await render(lv, [], 480, Math.round(480 * H / W), art, { video: { fps: 15, from, to, quality: 0.9 } });
      const fr = fs.existsSync(G.dir) ? fs.readdirSync(G.dir).filter(f => /^f\d+\.jpg$/.test(f)).length : 0;
      if (fr) { files.gif = path.join(out, "thumb.gif");
        ff(["-framerate", "15", "-i", path.join(G.dir, "f%05d.jpg"), "-vf", "split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4", "-loop", "0", files.gif]);
        if (!fs.existsSync(files.gif)) delete files.gif; }
      G.cleanup();
    }
  }
  const res = { level: lv.name, made: new Date().toISOString(), art: art ? "gd" : "game look", size: `${W}x${H}`, seconds: +((Date.now() - T0) / 1000).toFixed(1),
    route: lv.solution.pending ? "ghost" : "saved", best: { t: best.t, score: best.score }, files: Object.fromEntries(Object.entries(files).map(([k, f]) => [k, path.relative(ROOT, f).replace(/\\/g, "/")])),
    candidates: got.map(({ file, ...c }) => c) };
  fs.writeFileSync(path.join(out, "thumb.json"), JSON.stringify(res, null, 1));
  return res;
}
module.exports = { thumb, dataScores, imageScore, pickSpaced, levelAndRoute, pathOf };

if (require.main === module) {
  if (!args.length || args[0].startsWith("--")) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
  thumb(args[0], { gif: args.includes("--gif"), shapes: args.includes("--shapes"), size: opt("--size"), cands: opt("--cands") ? +opt("--cands") : undefined, at: opt("--at"), out: opt("--out") })
    .then(r => {
      console.log(`${r.level}: best moment ${r.best.t} s (${r.art}, route ${r.route}) in ${r.seconds} s`);
      for (const c of r.candidates) console.log(`  ${c.t === r.best.t ? "*" : " "} ${String(c.t).padStart(6)} s  score ${c.score.toFixed(2)}  picture ${c.picture.toFixed(2)} (colour ${c.colour}, contrast ${c.contrast}, detail ${c.detail}, flat ${c.flat})  data ${c.data} (${c.objects} objects, ${c.kinds} kinds, ${c.play} play, ${c.mode})`);
      for (const [k, f] of Object.entries(r.files)) console.log(`  ${k}: ${f}`);
    }).catch(e => { console.error(e.message); process.exit(1); });
}
