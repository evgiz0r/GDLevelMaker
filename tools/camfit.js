// node tools/camfit.js <attempt id> <track.csv> [--window 160,101,1600] [--level <file>] [--csv out.csv] [--shift <ms> | --fit-shift]
// The game's camera height against the viewer's, frame by frame, from a recording of the user's run (VISUALS.md "Camera").
//   track.csv: python tools/track.py VIDEO --from S --to S --crop <the GD window minus its progress bar> > track.csv
//   the attempt: a line of local/attempts/*.jsonl with video.level_t (the video time of tick 0; tools/replay_run.js).
// Per frame: tick = (t - level_t) * 240, the sim's player y at that tick (the attempt's own presses replayed), the
// player's screen row from the track -> the level y at the window's bottom edge = the game's camera ("bottom"). Prints,
// per stretch of one mode, the game's bottom against ours (lib/camera.js, the viewer's rule, eased like the viewer), the
// mean and worst error in blocks, and the corridor (floorY / ceilY) the sim saw.
// --fit-shift: level_t can be off by a few hundred ms (GDLM 68's long attempt: -340 ms); the shift that makes the measured
// camera smoothest (the least frame-to-frame jump) is the right one -- a wrong clock pairs the video's player with the
// sim's y of another moment and the "camera" jumps with every jump. --shift <ms>: give it (tick = (t - level_t + shift) * 240).
// The window: x, y, width in screen px (16:9); one unit = width / 1920 * 3.375 px (1080p: 3.375, CLAUDE.md Calibration).
const fs = require("fs"), path = require("path");
const { GD, readGdlvl } = require("./io.js");
const CAM = require("../lib/camera.js");
const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf("--" + k); return i < 0 ? d : a[i + 1]; };
const [id, trackFile] = a.filter((x, i) => !x.startsWith("--") && !(a[i - 1] || "").startsWith("--"));
if (!id || !trackFile) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }

function findAttempt(id) {
  const dir = path.join(__dirname, "..", "local", "attempts");
  for (const f of fs.readdirSync(dir)) if (f.endsWith(".jsonl"))
    for (const l of fs.readFileSync(path.join(dir, f), "utf8").split(/\r?\n/)) if (l.includes(id)) { try { const r = JSON.parse(l); if (r.id === id) return r; } catch (e) {} }
  return null;
}
const R = findAttempt(id); if (!R) { console.error("no attempt " + id); process.exit(1); }
if (!R.video || R.video.level_t == null) { console.error("attempt " + id + " has no video.level_t"); process.exit(1); }
const L = readGdlvl(opt("level", R.file)), w = GD.makeWorld(L.level.objects, L.level.header), run = GD.run(w, R.events);
const [wx, wy, ww] = opt("window", "160,101,1600").split(",").map(Number), wh = ww * 9 / 16, ppu = ww / 1920 * 3.375;
const rows = fs.readFileSync(trackFile, "utf8").trim().split(/\r?\n/).filter(l => /^\d/.test(l)).map(l => l.split(",").map(Number));
const lt0 = R.video.level_t, bottomAt = (t, cy, d) => { const k = Math.round((t - lt0 + d / 1000) * 240); return k < 0 || k >= run.path.length ? null : run.path[k].y - (wy + wh - cy) / ppu; };
let shift = +opt("shift", 0);
if (a.includes("--fit-shift")) { let best = null;
  for (let d = -1500; d <= 1500; d += 10) { let tv = 0, n = 0, prev = null;
    for (const [t, , cy, nn] of rows) { if (!(nn > 30)) continue; const b = bottomAt(t, cy, d); if (b == null) { prev = null; continue; } if (prev != null) { tv += Math.min(60, Math.abs(b - prev)); n++; } prev = b; }
    if (n > 50 && (!best || tv / n < best.v)) best = { d, v: tv / n }; }
  shift = best.d; console.log(`clock: shift ${shift} ms makes the camera smoothest (${best.v.toFixed(2)} units a frame)`); }
const lt = lt0 - shift / 1000, out = [];
for (const [t, cx, cy, n] of rows) {
  const tick = Math.round((t - lt) * 240); if (tick < 0 || tick >= run.path.length || !(n > 30)) continue;
  const s = run.path[tick], bottom = s.y - (wy + wh - cy) / ppu;
  out.push({ t, tick, x: s.x, y: s.y, mode: s.mode, floorY: s.floorY, ceilY: s.ceilY, bottom, row: cy });
}
// ours: the viewer's rule on the same path, eased per video frame like the viewer (lib/camera.js)
let cam = null, prevT = null;
for (const o of out) { const want = CAM.want(run.path[o.tick], { look: true });
  cam = cam == null ? want : CAM.ease(cam, want, o.t - prevT, run.path[o.tick], true); prevT = o.t; o.ours = cam - CAM.BELOW; o.err = (o.ours - o.bottom) / 30; }
if (opt("csv")) fs.writeFileSync(opt("csv"), "t,tick,x,y,mode,floorY,ceilY,game_bottom,our_bottom\n" + out.map(o => [o.t.toFixed(3), o.tick, o.x.toFixed(1), o.y.toFixed(1), o.mode, o.floorY, o.ceilY, o.bottom.toFixed(1), o.ours.toFixed(1)].join(",")).join("\n"));
// stretches of one mode
const segs = []; for (const o of out) { const g = segs[segs.length - 1]; if (g && g.mode === o.mode && o.tick - g.last.tick < 60) { g.f.push(o); g.last = o; } else segs.push({ mode: o.mode, f: [o], last: o }); }
console.log(`${R.level} attempt ${id}: ${out.length} frames, ${(out.length && out[out.length - 1].t - out[0].t).toFixed(1)} s; bottom = level y at the window's bottom (units), err = ours - game (blocks)`);
let all = [];
for (const g of segs) { if (g.f.length < 10) continue; const e = g.f.map(o => o.err), m = e.reduce((p, c) => p + Math.abs(c), 0) / e.length; all = all.concat(e);
  const f0 = g.f[0], f1 = g.f[g.f.length - 1], rng = k => `${Math.min(...g.f.map(o => o[k])).toFixed(0)}..${Math.max(...g.f.map(o => o[k])).toFixed(0)}`;
  console.log(`${g.mode.padEnd(5)} x ${f0.x.toFixed(0)}-${f1.x.toFixed(0)} (${f0.t.toFixed(1)}-${f1.t.toFixed(1)} s): game bottom ${rng("bottom")}, ours ${rng("ours")}, player y ${rng("y")}` +
    (isFinite(f0.ceilY) ? `, corridor ${f0.floorY}..${f0.ceilY}` : "") + ` | mean |err| ${m.toFixed(2)}, worst ${Math.max(...e.map(Math.abs)).toFixed(2)} blocks`); }
if (all.length) console.log(`all: mean |err| ${(all.reduce((p, c) => p + Math.abs(c), 0) / all.length).toFixed(2)} blocks over ${all.length} frames`);
