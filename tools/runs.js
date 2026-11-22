// node tools/runs.js <recording.mkv> [...] [--level N] [--join] [--device mouse|keyboard] [--len lo-hi]  -- where the player died, from a screen
// recording of the real game: reads GD's progress bar (top centre) on every frame. Each attempt
// is a run of rising %, ending in a drop back to 0 (a death, at the % before the drop) or 100
// (beaten). Lime bar = normal mode, so practice runs (cyan bar) are left out.
// Writes local/runs/<video name>.json; with --level N the deaths also go to the viewer and the fit.
// The bar's place is for 1920x1080 (other sizes are scaled); the recording needs no sound.
const fs = require("fs"), path = require("path"), { spawnSync } = require("child_process");
const FF = process.env.FFMPEG || "ffmpeg";
const OUT = path.join(__dirname, "..", "local", "runs");
const BAR = { x0: 615, x1: 1305, y: 32, from: 600, w: 720 }; // at 1080p, from the BAB recording
const FPS = 30;

function barSeries(video) {
  const probe = spawnSync(FF.replace(/ffmpeg(?=(\.exe)?$)/, "ffprobe"), ["-v", "error", "-select_streams", "v", "-show_entries", "stream=width,height", "-of", "csv=p=0", video], { encoding: "utf8" });
  const [W, H] = ((probe.stdout || "").trim() || "1920,1080").split(",").map(Number), k = W / 1920;
  const crop = `format=rgb24,crop=${Math.round(BAR.w * k)}:2:${Math.round(BAR.from * k)}:${Math.round(BAR.y * H / 1080)},scale=${BAR.w}:2`; // 2 rows (yuv needs even sizes); row 0 is read
  const r = spawnSync(FF, ["-v", "error", "-i", video, "-vf", `fps=${FPS},${crop}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error("ffmpeg failed on " + video + ": " + r.stderr);
  const buf = r.stdout, row = BAR.w * 3 * 2, out = [];
  for (let f = 0; f * row < buf.length; f++) {
    // the fill grows from the bar's left end: count only that, so lime-coloured level art
    // around the bar does not count (the stripes in the fill are a darker lime)
    const px = x => { const i = f * row + x * 3; return [buf[i], buf[i + 1], buf[i + 2]]; };
    const isLime = ([R, G, B]) => G > 140 && B < 110 && G > R + 20;
    const isCyan = ([R, G, B]) => G > 150 && B > 150 && R < 140;
    let white = 0;
    for (let x = 0; x < BAR.w; x++) { const [R, G, B] = px(x); if (R > 225 && G > 225 && B > 225) white++; }
    const left = BAR.x0 - BAR.from + 4, right = BAR.x1 - BAR.from;
    const fillEnd = test => { let x = left, gap = 0, end = -1; for (; x < right; x++) { if (test(px(x))) { end = x; gap = 0; } else if (++gap > 3) break; } return end; };
    const lime = isLime(px(left)) ? fillEnd(isLime) : -1, cyan = lime < 0 && isCyan(px(left)) ? fillEnd(isCyan) : -1;
    const bar = white >= 2 && white <= 30 ? (lime >= 0 ? "normal" : cyan >= 0 ? "practice" : "empty") : null;
    const fill = lime >= 0 ? lime : cyan;
    out.push({ t: f / FPS, bar, pct: bar && fill >= 0 ? Math.max(0, Math.min(100, (fill + BAR.from - BAR.x0) / (BAR.x1 - BAR.x0) * 100)) : bar ? 0 : null });
  }
  return out;
}

// attempts: rising % runs; the end of each is a death (drop to ~0) or a clear (reached ~99+)
function attempts(series) {
  const runs = [];
  let cur = null, last = null;
  for (const s of series) {
    if (s.pct === null) continue;
    if (cur && last !== null && s.pct < last - 0.8 && s.pct < 1.5) { runs.push(cur); cur = null; }
    if (!cur && s.pct < 1.5) cur = { start: s.t, end: s.t, pct: s.pct, mode: s.bar };
    if (cur) { cur.end = s.t; if (s.pct >= cur.pct) { cur.pct = s.pct; if (s.bar !== "empty") cur.mode = s.bar; } }
    last = s.pct;
  }
  if (cur) runs.push(cur);
  return runs.filter(r => r.end - r.start > 0.4).map(r => ({ start: +r.start.toFixed(2), secs: +(r.end - r.start).toFixed(2),
    pct: +r.pct.toFixed(1), mode: r.mode, beaten: r.pct >= 99,
    // the level's length in seconds from how fast the % rose: tells levels apart in a mixed session
    length: r.pct > 3 ? Math.round((r.end - r.start) / r.pct * 100) : null }));
}

if (require.main === module) {
  const args = process.argv.slice(2), li = args.indexOf("--level"), level = li >= 0 ? +args.splice(li, 2)[1] : null;
  fs.mkdirSync(OUT, { recursive: true });
  // --join: the files are one session cut into pieces (the capture restarts on fullscreen switches)
  const ji = args.indexOf("--join"), join = ji >= 0 && args.splice(ji, 1);
  const mi = args.indexOf("--device"), device = mi >= 0 ? args.splice(mi, 2)[1] : null;
  const ri = args.indexOf("--len"), lenRange = ri >= 0 ? args.splice(ri, 2)[1].split("-").map(Number) : null;
  const groups = join ? [args] : args.map(a => [a]);
  for (const g of groups) {
    let series = [], t0 = 0;
    for (const v of g) { const sr = barSeries(v); series = series.concat(sr.map(x => Object.assign(x, { t: x.t + t0 }))); t0 += sr.length / FPS; }
    const v = g[0];
    let runs = attempts(series);
    // --len lo-hi: keep the attempts on a level of that length (s), e.g. 80-110
    if (lenRange) runs = runs.filter(r => r.length === null ? r.secs < 3 && false : r.length >= lenRange[0] && r.length <= lenRange[1]);
    const file = path.join(OUT, path.basename(v).replace(/\.[^.]+$/, "") + ".json");
    fs.writeFileSync(file, JSON.stringify({ video: path.basename(v), files: g.map(x => path.basename(x)), level, device, runs }, null, 1));
    console.log(`${path.basename(v)}${g.length > 1 ? " + " + (g.length - 1) + " more" : ""}${level ? " (level " + level + ")" : ""}: ${runs.length} attempts`);
    for (const r of runs) console.log(`  at ${r.start.toFixed(1)} s: ${r.beaten ? "BEATEN" : "died at " + r.pct.toFixed(1) + "%"} after ${r.secs.toFixed(1)} s (${r.mode}${r.length ? ", level ~" + r.length + " s long" : ""})`);
  }
}
module.exports = { barSeries, attempts };
