// node tools/framecheck.js <level.gdlvl | official:N> --video "<GD claude-rec ...mkv>" --inputs "<GD inputs raw ...csv>"
//        --at <bar start s> [--secs S] [--window X,Y,W] [--k 0.40] [--d -0.53] [--markers 211] [--out file.json]
// The VIDEO is the reference (the user, 2026-11-24: "we recorded everything, have the video but never compared? it must be
// useful for hitboxes and realism"). One recorded attempt, frame by frame, against the sim's replay of the same clicks:
//  1. the clock. K: the raw input log's clock vs the video's frame times (video t = log ms / 1000 + K), measured from
//     ground take-offs (a jump leaves the ground on the frame after its press). D: the attempt's level start vs the
//     progress bar's start. D comes from GEOMETRY, not from the death %: white vertical bars at known level x (GDLM 67
//     v2's rulers, id 211 stacked -- --markers) give the player's level x in every frame where one is in view
//     (x = marker x + (icon centre - bar centre) / px-per-unit), so each frame says when the level started. Sub-unit,
//     where the death-% fit (tools/replay_run.js) cannot tell two clocks 0.1 s apart.
//  2. the path. With that clock, the sim replays the logged presses; per frame: x (from the bars), height above the
//     ground line (tools/track.py --rows), video vs sim. Prints rms and max per second, and the first frame they part.
//  3. the end. Where the video's icon vanishes (death) or the attempt ends, the sim's state there: the gap between the
//     sim's player box and the object that killed it (or the nearest hazard), in units: a game death the sim survives
//     by a hair, or a sim death the game survived, is a hitbox fact.
// Needs python + numpy (tools/track.py) and ffmpeg. The track is cached in local/frames/. PHYSICS.md "Frames".
if (require.main === module) require("./heavy.js").claim();   // one heavy job at a time (tools/heavy.js)
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const { GD, readGdlvl, unpack } = require("./io.js");
const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf("--" + k); return i < 0 ? d : a[i + 1]; };
const lv = a.find((x, i) => !x.startsWith("--") && !(a[i - 1] || "").startsWith("--"));
if (!lv || !opt("video") || !opt("inputs") || !opt("at")) { console.log(fs.readFileSync(__filename, "utf8").split("\n").slice(0, 2).join("\n")); process.exit(1); }
const ROOT = path.join(__dirname, ".."), CAP = path.join(process.env.USERPROFILE || "", "Videos", "Captures");
const vname = opt("video"), video = fs.existsSync(vname) ? vname : path.join(CAP, vname);
const inName = opt("inputs"), inFile = fs.existsSync(inName) ? inName : path.join(ROOT, "local", "inputs", inName);
const AT = +opt("at"), win = opt("window", "160,101,1600").split(",").map(Number), W = win[2], H = Math.round(W * 9 / 16);
const PX = 3.375 * W / 1920;                                     // px per unit at this window width
const SRC = process.env.GD_LEVELS || "C:/Program Files (x86)/Steam/steamapps/common/Geometry Dash/Resources/levels/";
const levelStr = lv.startsWith("official:") ? unpack(fs.readFileSync(SRC + lv.slice(9) + ".txt", "utf8")) : readGdlvl(lv).levelStr;
const L = GD.parseLevel(levelStr), w = GD.makeWorld(L.objects, L.header);
const runsFile = path.join(ROOT, "local", "runs", path.basename(video).replace(/\.\w+$/, ".json"));
const run = fs.existsSync(runsFile) ? JSON.parse(fs.readFileSync(runsFile, "utf8")).runs.find(r => Math.abs(r.start - AT) < 0.5) : null;
const SECS = +opt("secs", run ? run.secs : 20);

// --- the input log: down/up with the log's own ms clock
const logText = fs.readFileSync(inFile, "utf8");
// the prior on K: the log's start (its header, UTC) vs the video's start (its file name's second, local time); the capture
// starts 0.2-1.3 s after that second (0.56 s at 18-58-15, ~1 s at 02-33 / 02-45), so K = (log start - name) - lag
const logStart = Date.parse((logText.match(/started (\S+Z)/) || [])[1] || ""), nm = path.basename(video).match(/(\d{4})-(\d\d)-(\d\d)_(\d\d)-(\d\d)-(\d\d)/);
const vidName = nm ? new Date(+nm[1], +nm[2] - 1, +nm[3], +nm[4], +nm[5], +nm[6]).getTime() : NaN;
const Kprior = isFinite(logStart) && isFinite(vidName) ? (logStart - vidName) / 1000 : null;
const log = logText.split(/\r?\n/).filter(l => /^\d/.test(l)).map(l => { const c = l.split(","); return { ms: +c[0], type: c[2] === "down" ? "press" : "release" }; });

// --- the video: icon, ground line, white bars per frame (cached)
const OUT = path.join(ROOT, "local", "frames"); fs.mkdirSync(OUT, { recursive: true });
const t0 = AT - 1.5, t1 = AT + SECS + 1.5, stem = path.basename(video).replace(/\.\w+$/, "") + "_" + AT;
const cache = path.join(OUT, stem + ".track.csv");
const csv = fs.existsSync(cache) ? fs.readFileSync(cache, "utf8") : execFileSync("python", [path.join(__dirname, "track.py"), video, "--from", String(t0), "--to", String(t1),
  "--crop", `${win[0]},${win[1]},${W},${H}`, "--rows", "--cols"], { windowsHide: true, encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] });
if (!fs.existsSync(cache)) fs.writeFileSync(cache, csv);
const frames = [];
let lastKey = null;
for (const l of csv.split(/\r?\n/).slice(1)) {
  const c = l.split(","); if (c.length < 10) continue;
  const t = +c[0], has = c[1] !== "";
  const key = c.slice(1, 8).join(",") + "|" + c[9];
  const dup = key === lastKey; lastKey = key;                    // the capture repeats a frame when the game drew none
  const cx = has ? +c[1] : null, cy = has ? +c[2] : null;
  const edges = (c[8] || "").split(" ").map(Number).filter(isFinite);
  const gl = has ? edges.filter(e => e > cy && e > win[1] + H * 0.55).sort((p, q) => p - q)[0] : null;
  const bars = (c[9] || "").split(" ").filter(Boolean).map(s => { const [x, wd] = s.split(":").map(Number); return { x, wd }; });
  frames.push({ t, dup, cx, cy, ground: gl == null ? null : gl, h: gl == null || !has ? null : (gl - cy) / PX, bars });
}

// --- markers: columns of the marker id (>= 5 stacked: a ruler), their level x
const MID = +opt("markers", 211), colN = {};
for (const o of L.objects) if (+o.id === MID) colN[o.x] = (colN[o.x] || 0) + 1;
const markers = Object.entries(colN).filter(([, n]) => n >= 5).map(([x]) => +x).sort((p, q) => p - q);

// --- K: take-offs vs presses (cube on the ground: the icon leaves the ground line band)
let K = opt("k") != null ? +opt("k") : null;
const takeoffs = [];
for (let i = 1; i < frames.length; i++) { const p = frames[i - 1], f = frames[i];
  if (p.h != null && f.h != null && !f.dup && Math.abs(p.h - 15) < 1.5 && f.h - p.h > 5) takeoffs.push(p.t); }
if (K == null) {
  // each take-off frame t: the press that caused it is the latest down before it; K = t - press s (minus up to a frame)
  const cand = [];
  const [klo, khi] = Kprior != null ? [Kprior - 1.3, Kprior - 0.2] : [-2, 2];
  for (let kk = klo; kk <= khi; kk += 0.002) { let n = 0, err = 0;
    for (const tk of takeoffs) { const pr = log.filter(e => e.type === "press" && e.ms / 1000 + kk <= tk + 0.001).pop(); if (!pr) continue;
      const dt = tk - (pr.ms / 1000 + kk); if (dt >= 0 && dt < 0.034) { n++; err += dt; } }
    cand.push({ kk, n, err }); }
  cand.sort((p, q) => q.n - p.n || p.err - q.err); K = cand.length ? +cand[0].kk.toFixed(3) : 0.4;
  console.log(`K (video = log + K): ${K} s from ${cand[0] ? cand[0].n : 0} of ${takeoffs.length} take-offs (each within a frame after its press)${Kprior != null ? `; searched ${(Kprior - 1.3).toFixed(2)}..${(Kprior - 0.2).toFixed(2)} from the files' start times` : ""}`);
} else console.log(`K (video = log + K): ${K} s (given)`);

// --- D: the level start from the bars
const xAt = (q, k) => q.path[Math.max(0, Math.min(q.path.length - 1, k))].x;
const evFor = ts => { const ev = log.filter(e => e.ms / 1000 + K >= ts - 0.05 && e.ms / 1000 + K <= ts + SECS + 2).map(e => ({ type: e.type, tick: Math.max(0, Math.round((e.ms / 1000 + K - ts) * 240)) }));
  while (ev.length && ev[0].type === "release") ev.shift(); return ev; };
const D0 = +opt("d", -0.53);
let q = GD.run(w, evFor(AT + D0));
// time at which the sim reaches x (ticks are 1/240 s; x only depends on speed portals, not on presses -- until death)
const tickOfX = (qq, x) => { const p = qq.path; let lo = 0, hi = p.length - 1; if (x > p[hi].x) return null; while (lo < hi) { const m = (lo + hi) >> 1; if (p[m].x < x) lo = m + 1; else hi = m; }
  const k = lo, x1 = p[k].x, x0 = k ? p[k - 1].x : x1; return k - (x0 < x1 ? (x1 - x) / (x1 - x0) : 0); };
const ds = [];
for (const f of frames) { if (f.dup || f.cx == null || !f.bars.length) continue;
  for (const b of f.bars) { if (Math.abs(b.wd - 30 * PX) > 6) continue;
    for (const m of markers) { const x = m + (f.cx - win[0] - (b.x - win[0])) / PX; const k = tickOfX(q, x); if (k == null) continue;
      ds.push({ d: f.t - k / 240 - AT, t: f.t, x, m }); } } }
let D = D0, nD = 0;
if (ds.length) {
  let best = null;
  for (let d = D0 - 1; d <= D0 + 1; d += 0.002) { const n = ds.filter(v => Math.abs(v.d - d) < 0.012).length; if (!best || n > best.n) best = { d, n }; }
  const near = ds.filter(v => Math.abs(v.d - best.d) < 0.012).map(v => v.d).sort((p, q) => p - q);
  D = near[near.length >> 1]; nD = near.length;
  q = GD.run(w, evFor(AT + D));
}
// no bars (official levels): D from the path itself -- the height above the ground line, video vs sim, over the frames
// where the sim is in a ground mode on the floor band (mean |error| clipped at 60 units), searched +-0.5 s around --d
let how = `${nD} bar sightings`;
if (!nD) {
  let best = null;
  for (let d = D0 - 0.5; d <= D0 + 0.5; d += 1 / 240) {
    const qq = GD.run(w, evFor(AT + d)); let n = 0, e = 0;
    for (const f of frames) { if (f.dup || f.h == null) continue; const k = Math.round((f.t - AT - d) * 240); if (k < 0 || k >= qq.path.length) continue;
      const s = qq.path[k]; if ((s.floorY || 0) !== 0 || !["cube", "robot", "ball", "spider"].includes(s.mode)) continue; e += Math.min(Math.abs(f.h - s.y), 60); n++; }
    const sc = n > 20 ? e / n - Math.min(qq.path.length, 240 * SECS) / 240 / 1000 : Infinity;   // ties: the clock that lives longer
    if (!best || sc < best.sc) best = { d, sc, n };
  }
  if (best && isFinite(best.sc)) { D = best.d; how = `the height fit (mean error ${best.sc.toFixed(1)} units over ${best.n} frames)`; q = GD.run(w, evFor(AT + D)); }
  else how = "nothing (--d default)";
}
console.log(`D (level start - bar start): ${D.toFixed(4)} s from ${how}; level start in the video ${(AT + D).toFixed(4)} s`);

// --- the path, frame by frame
const TS = AT + D, rows = [];
for (const f of frames) { if (f.dup) continue; const k = Math.round((f.t - TS) * 240); if (k < 0 || k >= q.path.length) continue;
  const s = q.path[k], comparable = (s.floorY || 0) === 0 && ["cube", "robot", "ball", "spider", "ship"].includes(s.mode) && f.h != null && f.h < 250;
  let xv = null; for (const b of f.bars) if (f.cx != null && Math.abs(b.wd - 30 * PX) <= 6) { const cand = markers.map(m => m + (f.cx - b.x) / PX).sort((p, r) => Math.abs(p - s.x) - Math.abs(r - s.x))[0]; if (cand != null && Math.abs(cand - s.x) < 45) xv = cand; }
  rows.push({ t: +f.t.toFixed(4), lt: +(k / 240).toFixed(4), tick: k, mode: s.mode, xs: +s.x.toFixed(1), xv: xv == null ? null : +xv.toFixed(1), dx: xv == null ? null : +(xv - s.x).toFixed(1),
    ys: +s.y.toFixed(1), yv: f.h == null || !comparable ? null : +f.h.toFixed(1), dy: f.h == null || !comparable ? null : +(f.h - s.y).toFixed(1), seen: f.cx != null }); }
const rms = v => v.length ? Math.sqrt(v.reduce((s, x) => s + x * x, 0) / v.length) : NaN;
const dxs = rows.filter(r => r.dx != null).map(r => r.dx), dys = rows.filter(r => r.dy != null).map(r => r.dy);
console.log(`path: ${rows.length} frames; x vs sim rms ${rms(dxs).toFixed(1)} units over ${dxs.length} frames; height vs sim rms ${rms(dys).toFixed(1)} units over ${dys.length} frames`);
for (let s0 = 0; s0 < (rows.length ? rows[rows.length - 1].lt : 0); s0 += 1) {
  const part = rows.filter(r => r.lt >= s0 && r.lt < s0 + 1), py = part.filter(r => r.dy != null).map(r => r.dy), px = part.filter(r => r.dx != null).map(r => r.dx);
  if (!py.length && !px.length) continue;
  const mx = py.length ? py.reduce((m, v) => Math.abs(v) > Math.abs(m) ? v : m, 0) : null;
  console.log(`  ${String(s0).padStart(3)} s  block ${(part[0].xs / 30).toFixed(0).padStart(4)}  ${part[0].mode.padEnd(6)} height rms ${py.length ? rms(py).toFixed(1).padStart(5) : "    -"} max ${mx == null ? "   -" : mx.toFixed(0).padStart(4)}   x ${px.length ? (px.reduce((s, v) => s + v, 0) / px.length).toFixed(1).padStart(5) : "    -"}`);
}
let first = null;
for (let i = 0; i + 3 < rows.length; i++) if ([0, 1, 2, 3].every(j => rows[i + j].dy != null && Math.abs(rows[i + j].dy) > 10)) { first = rows[i]; break; }
console.log(first ? `FIRST PARTING (height > 10 units, 4 frames): level time ${first.lt} s, block ${(first.xs / 30).toFixed(2)}, ${first.mode}: video ${first.yv} vs sim ${first.ys}` : "no parting over 10 units in height");

// --- the end: where the video's icon vanishes for good vs the sim's end
const lastSeen = frames.filter(f => f.cx != null && f.t < AT + SECS + 0.5).pop();
const endK = lastSeen ? Math.round((lastSeen.t - TS) * 240) : null;
const simEnd = q.dead ? `dies at tick ${q.path.length - 1} (${((q.path.length - 1) / 240).toFixed(3)} s), block ${(q.end.x / 30).toFixed(2)}, ${q.end.why}` : q.done ? "clears" : "runs on";
console.log(`end: the video's icon last seen at level time ${endK == null ? "-" : (endK / 240).toFixed(3)} s${endK != null && endK < q.path.length ? " (sim there: block " + (q.path[endK].x / 30).toFixed(2) + ", y " + q.path[endK].y.toFixed(1) + ")" : ""}; the sim ${simEnd}`);
// the nearest hazard to the sim's player at the video's end (or the sim's death): the gap in units, per axis
const at = q.path[Math.min(q.path.length - 1, endK == null ? q.path.length - 1 : endK)];
const near = w.items.filter(o => o.kind === "hazard" && o.x1 > at.x - 90 && o.x0 < at.x + 90 && o.y1 > at.y - 90 && o.y0 < at.y + 90).map(o => {
  const gx = Math.max(o.x0 - (at.x + 15), (at.x - 15) - o.x1), gy = Math.max(o.y0 - (at.y + 15), (at.y - 15) - o.y1);
  return { id: o.o.id, x: (o.x0 + o.x1) / 2, y: (o.y0 + o.y1) / 2, gapX: gx, gapY: gy }; }).sort((p, r) => Math.max(p.gapX, p.gapY) - Math.max(r.gapX, r.gapY));
for (const n of near.slice(0, 4)) console.log(`  hazard ${n.id} at (${n.x.toFixed(0)}, ${n.y.toFixed(0)}): gap x ${n.gapX.toFixed(1)}, y ${n.gapY.toFixed(1)} units from the player's 30x30 box (both negative = touching)`);
const outFile = opt("out", path.join(OUT, stem + ".json"));
fs.writeFileSync(outFile, JSON.stringify({ level: lv, video: path.basename(video), at: AT, K, D: +D.toFixed(4), levelStart: +(AT + D).toFixed(4), nD, takeoffs: takeoffs.length,
  rmsX: +rms(dxs).toFixed(2), rmsY: +rms(dys).toFixed(2), first, end: { lastSeen: endK, sim: simEnd }, events: evFor(TS), rows }));
console.log("wrote " + path.relative(ROOT, outFile));
