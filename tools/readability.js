// node tools/readability.js <level> [--every 1] [--fps 8] [--from S] [--to S] [--gate] [--name n]
//
// Can a player tell at a glance what kills? (The user on GDLM 44 hellgate round 1: "waaaay too flashy. the
// contrast between the objects is bad, hard to tell what kills you what not".) Renders the level as GD
// draws it (the viewer's GD art, headless like tools/shoot.js) twice at each moment -- as it is, and with
// every hazard removed, replaying the SAME solution so the camera matches -- and measures, per frame:
//   contrast   the hazards' luminance against what is drawn right behind them (WCAG contrast ratio of the
//              median hazard pixel vs the median of the same pixels without hazards). Want >= 3 (WCAG's
//              minimum for things you must see); "weak" = share of hazard pixels under 1.5 against their own
//              background pixel (a hazard dissolving into the scene).
//   clutter    share of the frame (without hazards) as bright as the hazards (>= 70% of their luminance):
//              deco, lights and glow that compete with what kills. Gameplay objects that are not hazards
//              (orbs, portals, the player) count too: it is what the eye has to sort through.
//   flash      the frame's mean luminance sampled at --fps through the level: flashes per second (a rise and
//              fall of >= 0.06 within half a second) and the largest jump between two samples.
// Prints a line per frame, the level's numbers, and with --gate exits 1 when a threshold fails (TH below).
// Writes local/readability/<name>.json. Uses the saved solution (tools/solutions.js). Frames 960x540.
// One heavy job at a time (a headless browser with the sheets, ~1 GB). POLISH.md "Readability".
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ROOT = path.join(__dirname, ".."), { headless } = require("./headless.js"), { levelOf } = require("./shoot.js");
const GDL = require("../lib/gd.js"), O = require("../lib/objects.js");
const args = process.argv.slice(2), opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
if (!args[0] || args[0].startsWith("--")) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }

// thresholds of the gate (calibrated on official levels vs hellgate round 1, POLISH.md "Readability")
const TH = { contrastMin: 3, contrastMedian: 4.5, weakMax: 0.35, clutterMax: 0.04, flashPerSec: 0.5, jumpMax: 0.12 };
const W = 960, H = 540, SW = 480, SH = 270;   // render size; analysed at half

const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const LUT = Float64Array.from({ length: 256 }, (_, i) => lin(i));
const lumOf = (b, i) => 0.2126 * LUT[b[i]] + 0.7152 * LUT[b[i + 1]] + 0.0722 * LUT[b[i + 2]];
const cr = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const med = a => { if (!a.length) return NaN; const s = Float64Array.from(a).sort(); return s[s.length >> 1]; };
function raw(png) { return cp.execFileSync("ffmpeg", ["-v", "error", "-i", png, "-vf", `scale=${SW}:${SH}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 64 << 20 }); }

async function render(level, times, tag) {
  const id = "r" + tag + Date.now().toString(36), dir = path.join(ROOT, "local", "shoot");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, id + ".json"), JSON.stringify({ level, times, art: true, width: W, height: H }));
  const r = await headless(`viewer/?shoot=${id}`, path.join(dir, id, ".done"), { port: +(opt("--port") || 8767), timeoutMs: 30 * 60e3, width: W, height: H });
  const out = times.map((_, i) => { const f = path.join(dir, id, String(i).padStart(3, "0") + ".png"); return fs.existsSync(f) ? raw(f) : null; });
  try { fs.rmSync(path.join(dir, id), { recursive: true, force: true }); fs.unlinkSync(path.join(dir, id + ".json")); } catch (e) {}
  if (!r.ok) console.log(`(render ${tag} timed out: ${out.filter(Boolean).length}/${times.length} frames)`);
  return out;
}

function frameStats(A, B) {
  const n = SW * SH, hz = [], hzBg = [], weakN = [], lumB = new Float64Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * 3, la = lumOf(A, i), lb = lumOf(B, i); lumB[p] = lb;
    const d = Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]);
    if (d > 60) { hz.push(la); hzBg.push(lb); weakN.push(cr(la, lb) < 1.5 ? 1 : 0); }
  }
  if (hz.length < 20) return null;   // no hazard on screen
  const Lh = med(hz), Lb = med(hzBg);
  let bright = 0; for (let p = 0; p < n; p++) if (lumB[p] >= 0.7 * Lh) bright++;
  return { hazardPx: hz.length, Lh: +Lh.toFixed(3), Lb: +Lb.toFixed(3), contrast: +cr(Lh, Lb).toFixed(2),
    weak: +(weakN.reduce((a, b) => a + b, 0) / weakN.length).toFixed(2), clutter: +(bright / n).toFixed(3) };
}
const meanLum = A => { let s = 0; for (let i = 0; i < A.length; i += 3 * 7) s += lumOf(A, i); return s / (A.length / 21); };

(async () => {
  const lv = levelOf(args[0]);
  if (!lv.solution) { try { const s = require("./solutions.js").get(lv.levelStr, true); if (s && s.events) lv.solution = s; } catch (e) {} }
  if (!lv.solution) { console.log("no saved solution: run node tools/solutions.js <level> first (the camera must follow the same run twice)"); process.exit(1); }
  const L = GDL.parseLevel(lv.levelStr), TPS = 240;   // physics ticks per second (lib/physics.js steps at 240 Hz)
  const lenS = Math.min(lv.solution.events.length ? Math.max(...lv.solution.events.map(e => e.tick)) / TPS + 1.5 : 10, Math.max(...L.objects.map(o => o.x)) / 311.58);
  const t0 = +(opt("--from") || 0.3), t1 = +(opt("--to") || lenS), every = +(opt("--every") || 1), fps = +(opt("--fps") || 8);
  const ct = []; for (let t = t0; t <= t1; t += every) ct.push(+t.toFixed(3));
  const ft = []; for (let t = t0; t <= t1; t += 1 / fps) ft.push(+t.toFixed(3));
  // the same level with every hazard taken out (the solution's run does not touch them)
  const noHaz = L.objects.filter(o => (O.objInfo(o.id) || {}).kind !== "hazard");
  const strip = GDL.serializeLevel({ header: L.header, objects: noHaz });
  const name = (opt("--name") || lv.name).replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_");
  console.log(`${lv.name}: ${ct.length} frames for contrast, ${ft.length} for flashing (${fps} fps), ${L.objects.length - noHaz.length} hazards`);
  const tAll = [...new Set([...ct, ...ft])].sort((a, b) => a - b);
  const A = await render(lv, tAll, "a");
  const B = await render({ name: lv.name + " (no hazards)", levelStr: strip, solution: lv.solution }, ct, "b");
  const frames = [];
  ct.forEach((t, k) => { const a = A[tAll.indexOf(t)], b = B[k]; if (!a || !b) return; const s = frameStats(a, b); if (s) frames.push(Object.assign({ t }, s)); });
  const lum = ft.map(t => { const a = A[tAll.indexOf(t)]; return a ? meanLum(a) : null; });
  // flashes: a rise of >= 0.06 followed by a fall of >= 0.06 (or the reverse) within half a second
  let flashes = 0, jump = 0;
  for (let i = 1; i < lum.length; i++) if (lum[i] != null && lum[i - 1] != null) jump = Math.max(jump, Math.abs(lum[i] - lum[i - 1]));
  for (let i = 0; i < lum.length; i++) {
    if (lum[i] == null) continue;
    const win = Math.max(1, Math.round(fps / 2));
    for (let j = i + 1; j <= Math.min(lum.length - 1, i + win); j++) {
      if (lum[j] == null || Math.abs(lum[j] - lum[i]) < 0.06) continue;
      const back = lum.slice(j + 1, j + 1 + win).some(v => v != null && Math.sign(lum[j] - lum[i]) * (lum[j] - v) >= 0.06);
      if (back) { flashes++; i = j; }
      break;
    }
  }
  const dur = Math.max(0.1, t1 - t0);
  const res = { level: lv.name, frames, flash: { perSec: +(flashes / dur).toFixed(2), count: flashes, jumpMax: +jump.toFixed(3), lum: lum.map(v => v == null ? null : +v.toFixed(3)) } };
  const cs = frames.map(f => f.contrast);
  res.summary = { contrastMin: Math.min(...cs), contrastMedian: med(cs), weakMax: Math.max(...frames.map(f => f.weak)), clutterMax: Math.max(...frames.map(f => f.clutter)),
    clutterMedian: med(frames.map(f => f.clutter)), flashPerSec: res.flash.perSec, jumpMax: res.flash.jumpMax };
  for (const f of frames) console.log(`  t=${f.t.toFixed(1).padStart(5)} s  contrast ${String(f.contrast).padStart(5)}  (hazard ${f.Lh} on ${f.Lb})  weak ${f.weak}  clutter ${(f.clutter * 100).toFixed(1)}%`);
  const S = res.summary, fails = [];
  if (!frames.length) fails.push("no frame with a hazard on screen was measured (render failed?)");
  if (lum.filter(v => v != null).length < 2) fails.push("no flash samples");
  if (S.contrastMin < TH.contrastMin) fails.push(`a frame's hazard contrast ${S.contrastMin} < ${TH.contrastMin}`);
  if (S.contrastMedian < TH.contrastMedian) fails.push(`median hazard contrast ${S.contrastMedian} < ${TH.contrastMedian}`);
  if (S.weakMax > TH.weakMax) fails.push(`${Math.round(S.weakMax * 100)}% of a frame's hazard pixels blend into the scene (> ${TH.weakMax * 100}%)`);
  if (S.clutterMax > TH.clutterMax) fails.push(`${(S.clutterMax * 100).toFixed(1)}% of a frame is as bright as the hazards (> ${TH.clutterMax * 100}%)`);
  if (S.flashPerSec > TH.flashPerSec) fails.push(`${S.flashPerSec} flashes per second (> ${TH.flashPerSec})`);
  if (S.jumpMax > TH.jumpMax) fails.push(`a brightness jump of ${S.jumpMax} between two frames (> ${TH.jumpMax})`);
  res.fails = fails;
  console.log(`== ${lv.name}: contrast min ${S.contrastMin} / median ${S.contrastMedian}, weak max ${S.weakMax}, clutter max ${(S.clutterMax * 100).toFixed(1)}% (median ${(S.clutterMedian * 100).toFixed(1)}%), flashes ${S.flashPerSec}/s, largest jump ${S.jumpMax}`);
  console.log(fails.length ? "   NOT READABLE: " + fails.join("; ") : "   readable");
  const dir = path.join(ROOT, "local", "readability"); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name + ".json"), JSON.stringify(res, null, 1));
  process.exit(args.includes("--gate") && fails.length ? 1 : 0);
})().catch(e => { console.error(e.stack || e.message); process.exit(1); });
module.exports = { TH };
