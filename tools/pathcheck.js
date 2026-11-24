// node tools/pathcheck.js <level: official:N | c<id> | levels/x.gdlvl> --video "<GD claude-rec ....mkv>" --t <attempt start, s>
//        [--window X,Y,W] [--tol 10] [--color lime]
// Compares PATHS, not only outcomes (the user, 2026-11-24: "we are comparing the paths right?"): one recorded attempt's
// icon, tracked in the video frame by frame (tools/track.py, real frame times, height against the ground line in the same
// frame), against the sim's path under the same logged presses (the attempt's line in local/attempts/<base>.jsonl, from
// tools/replay_run.js). Prints the height error over time and where it first stays over --tol units, and in which mode:
//   - an error that appears at one press and stays = a missed / extra input (or a clock jump in the log);
//   - an error that grows smoothly, or appears at an object (orb, pad, portal) = physics;
//   - the whole curve shifted in time = clock offset (found here: the time shift that best lines the two up).
// Only where the sim player is on or near the ground line's band is compared (cube, robot, ball, spider on the floor
// band; ship and wave fly where GD's camera hides the ground, so those frames are listed as "no ground").
// x is not measured: GD's camera follows the player sideways, so its screen x says nothing once the camera moves.
// Writes local/pathcheck/<video>_<t>.json (per frame: t, sim tick, video y, sim y, error) for the viewer's run view.
// PHYSICS.md "Fidelity: paths".
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const { GD, readGdlvl, unpack } = require("./io.js");
const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf("--" + k); return i < 0 ? d : a[i + 1]; };
const lv = a.find((x, i) => !x.startsWith("--") && !(a[i - 1] || "").startsWith("--"));
if (!lv || !opt("video") || !opt("t")) { console.log(fs.readFileSync(__filename, "utf8").split("\n").slice(0, 2).join("\n")); process.exit(1); }
const ROOT = path.join(__dirname, ".."), CAP = path.join(process.env.USERPROFILE || "", "Videos", "Captures");
const videoName = opt("video"), videoFile = fs.existsSync(videoName) ? videoName : path.join(CAP, videoName), T = +opt("t"), TOL = +opt("tol", 10);
const win = (opt("window", "172,94,1600")).split(",").map(Number), W = win[2], H = Math.round(W * 9 / 16);
const PX = 3.375 * W / 1920;   // px per unit at this window width (1080p: 3.375, CLAUDE.md "Calibration")

// the level and the attempt line
const SRC = process.env.GD_LEVELS || "C:/Program Files (x86)/Steam/steamapps/common/Geometry Dash/Resources/levels/";
const levelStr = lv.startsWith("official:") ? unpack(fs.readFileSync(SRC + lv.slice(9) + ".txt", "utf8"))
  : /^c\d+$/.test(lv) ? readGdlvl(path.join(ROOT, "local", "community", lv.slice(1) + ".gdlvl")).levelStr : readGdlvl(lv).levelStr;
const L = GD.parseLevel(levelStr), w = GD.makeWorld(L.objects, L.header);
const base = require("./attempts.js").baseOf(lv);
const line = require("./attempts.js").read(lv).filter(o => o.source === "video" && o.video && path.basename(videoFile) === o.video.file)
  .sort((p, q) => Math.abs(p.video.t - T) - Math.abs(q.video.t - T))[0];
if (!line || Math.abs(line.video.t - T) > 2) { console.log(`no attempt line for ${base} in ${path.basename(videoFile)} near ${T} s (run tools/replay_run.js first)`); process.exit(1); }
const q = GD.run(w, line.events), sim = q.path;   // sim[k]: state after tick k

// the video: the icon and the ground line per frame
const t0 = line.video.t - 2, t1 = line.video.t + line.t + 2;
const OUT = path.join(ROOT, "local", "pathcheck"); fs.mkdirSync(OUT, { recursive: true });
// only a column around the player: once GD's camera follows, the icon stays at ~0.367 of the window's width (760 px in a
// 1600 px window at x 172, measured on 4 runs); the whole width let lime decoration pull the blob (Geometrical
// Dominator: ~40 "launches" in 14 s). The first ~0.6 s, before the camera follows, falls outside it: not compared.
const colX = Math.round(win[0] + W * +opt("track-x", 0.367) - 65 * W / 1600), colW = Math.round(130 * W / 1600);
const stem = path.basename(videoFile).replace(/\.\w+$/, "") + "_" + line.video.t, cache = path.join(OUT, stem + `.col${colX}.track.csv`);
// the tracker reads every frame (~4 s of work per s of video at 1600 px): its output is kept and reused
const csv = fs.existsSync(cache) ? fs.readFileSync(cache, "utf8") : execFileSync("python", [path.join(__dirname, "track.py"), videoFile, "--from", String(t0), "--to", String(t1),
  "--crop", `${colX},${win[1]},${colW},${H}`, "--rows", "--color", opt("color", "lime")], { windowsHide: true, encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] });
if (!fs.existsSync(cache)) fs.writeFileSync(cache, csv);
const frames = [];
for (const l of csv.split(/\r?\n/).slice(1)) {
  const c = l.split(","); if (c.length < 9 || !c[1]) continue;
  const t = +c[0], cy = +c[2], edges = c[8].split(" ").map(Number).filter(v => isFinite(v));
  // the ground line: the lowest strong edge below the icon (in the lower 45% of the window)
  const gl = edges.filter(e => e > cy && e > win[1] + H * 0.55).sort((p, q) => p - q)[0];
  frames.push({ t, cy, ground: gl == null ? null : gl, yv: gl == null ? null : (gl - cy) / PX });   // icon centre above the ground, units
}
if (!frames.length) { console.log("the tracker found no icon in that span (another colour? --color r,g,b)"); process.exit(1); }

// the sim's height above the ground (only where the floor is the ground: cube-like modes, normal gravity, band at 0)
const simY = k => { const s = sim[Math.max(0, Math.min(sim.length - 1, k))]; return s; };
const comparable = s => s && (s.floorY || 0) === 0 && s.mode !== "ship" && s.mode !== "wave" && s.mode !== "ufo" && s.mode !== "swing";
// the time shift: video time of tick 0 = L0; search it where the error is smallest (the clock offset, found from the path)
function score(L0) {
  let n = 0, e = 0;
  for (const f of frames) { if (f.yv == null) continue; const k = Math.round((f.t - L0) * 240); if (k < 0 || k >= sim.length) continue;
    const s = simY(k); if (!comparable(s)) continue; e += Math.min(Math.abs(f.yv - s.y), 60); n++; }
  return n > 20 ? e / n : Infinity;
}
let best = null;
for (let L0 = line.video.t + (line.video.shift_ms || 0) / 1000 - +opt("lag", 1.0) - 0.4; L0 <= line.video.t + (line.video.shift_ms || 0) / 1000 - +opt("lag", 1.0) + 0.4; L0 += 1 / 240) { const sc = score(L0); if (!best || sc < best.sc) best = { L0, sc }; }
if (!best || !isFinite(best.sc)) { console.log("too few comparable frames (no ground in view?)"); process.exit(1); }
// per frame residuals
const rows = [];
for (const f of frames) { const k = Math.round((f.t - best.L0) * 240); if (k < 0 || k >= sim.length) continue;
  const s = simY(k), ok = f.yv != null && comparable(s);
  rows.push({ t: +f.t.toFixed(3), lt: +(k / 240).toFixed(3), tick: k, x: +s.x.toFixed(1), mode: s.mode, yv: ok ? +f.yv.toFixed(1) : null, ys: +s.y.toFixed(1), err: ok ? +(f.yv - s.y).toFixed(1) : null }); }
// first divergence: |err| > TOL on 4 comparable frames in a row
let first = null;
for (let i = 0; i + 3 < rows.length; i++) if ([0, 1, 2, 3].every(j => rows[i + j].err != null && Math.abs(rows[i + j].err) > TOL)) { first = rows[i]; break; }
const rms = arr => Math.sqrt(arr.reduce((s, v) => s + v * v, 0) / Math.max(1, arr.length));
const errs = rows.filter(r => r.err != null);
console.log(`${base} @${line.video.t}s (${line.result}${line.result === "died" ? " " + line.pct + "%" : ""}; sim ${line.sim ? line.sim.result + " " + line.sim.pct + "%" : "?"}): ${frames.length} frames, ${errs.length} comparable`);
console.log(`  level start in the video ${best.L0.toFixed(3)} s (bar start ${line.video.t} s): median abs error ${best.sc.toFixed(1)} units at the best shift`);
console.log(`  height error rms ${rms(errs.map(r => r.err)).toFixed(1)} units over the run`);
const span = 5;
for (let s0 = 0; s0 < (rows[rows.length - 1] || { lt: 0 }).lt; s0 += span) {
  const part = errs.filter(r => r.lt >= s0 && r.lt < s0 + span);
  const modes = [...new Set(rows.filter(r => r.lt >= s0 && r.lt < s0 + span).map(r => r.mode))].join("/");
  console.log(`  ${String(s0).padStart(3)}-${String(s0 + span).padEnd(3)} s  ${part.length ? "rms " + rms(part.map(r => r.err)).toFixed(1).padStart(5) + "  max " + Math.max(...part.map(r => Math.abs(r.err))).toFixed(0).padStart(4) : "no ground in view".padEnd(20)}  ${modes}`);
}
console.log(first ? `  FIRST DIVERGENCE: level time ${first.lt} s (video ${first.t} s), x ${first.x} (block ${(first.x / 30).toFixed(1)}), ${first.mode}: video ${first.yv} vs sim ${first.ys} units`
  : `  no divergence over ${TOL} units (4 frames in a row) where the ground is in view`);
// LAUNCHES (the robust part): a jump, orb or pad throws the icon up the screen faster than GD's camera ever moves
// (a cube jump ~1700 px/s at 1600 px wide), so upward onsets in the video are the game's launches whatever the camera
// does. The sim's: a tick where vertical speed (against gravity) jumps by > 4 units/frame. Matched within 60 ms after
// the best single shift; what is left over on each side is a missed press / an action the sim did not take.
const vid = [];
for (let i = 2; i < frames.length; i++) {
  const f0 = frames[i - 2], f1 = frames[i - 1], f2 = frames[i];
  const v1 = (f0.cy - f1.cy) / (f1.t - f0.t), v2 = (f1.cy - f2.cy) / (f2.t - f1.t);   // px/s, up positive
  if (v2 > 900 * W / 1600 && v1 < 400 * W / 1600 && !(vid.length && f1.t - vid[vid.length - 1] < 0.12)) vid.push(f1.t);
}
const simL = [];
for (let k = 1; k < sim.length; k++) { const p = sim[k - 1], s = sim[k], g = s.grav || 1;
  if ((s.vy - p.vy) * g > 4 && !(simL.length && k - simL[simL.length - 1].k < 29)) simL.push({ k, mode: s.mode, x: s.x, act: s.act || "" }); }
let bestM = null;
// the level start is known to ~0.3 s: the bar start + the attempt's fitted shift - the video's lag behind its file
// name's second (0.98 s at 02:33, 1.05 s at 02:45: --lag); a wider search lets noise line up (GD: 2 s off)
const L0c = line.video.t + (line.video.shift_ms || 0) / 1000 - +opt("lag", 1.0);
for (let L0 = L0c - 0.4; L0 <= L0c + 0.4; L0 += 1 / 240) {
  let m = 0; for (const e of simL) { const tv = L0 + e.k / 240; if (vid.some(t => Math.abs(t - tv) < 0.06)) m++; }
  if (!bestM || m > bestM.m) bestM = { L0, m };
}
const used = new Set(), matches = [], simOnly = [];
for (const e of simL) { const tv = bestM.L0 + e.k / 240; let j = -1, d = 0.06;
  vid.forEach((t, i) => { if (!used.has(i) && Math.abs(t - tv) < d) { d = Math.abs(t - tv); j = i; } });
  if (j >= 0) { used.add(j); matches.push({ lt: e.k / 240, dt: vid[j] - tv, mode: e.mode }); } else simOnly.push(e); }
const vidOnly = vid.filter((t, i) => !used.has(i) && t > bestM.L0 && t < bestM.L0 + (sim.length - 1) / 240);
const med = arr => { const b = arr.slice().sort((p, q) => p - q); return b.length ? b[b.length >> 1] : 0; };
const early = matches.filter(m => m.lt < 10).map(m => m.dt), late = matches.filter(m => m.lt > (sim.length / 240) - 15).map(m => m.dt);
console.log(`  LAUNCHES: video ${vid.filter(t => t > bestM.L0 && t < bestM.L0 + sim.length / 240).length}, sim ${simL.length}, matched ${matches.length} (level start ${bestM.L0.toFixed(3)} s in the video)`);
console.log(`    timing: median ${(med(matches.map(m => m.dt)) * 1000).toFixed(0)} ms; first 10 s ${(med(early) * 1000).toFixed(0)} ms, last 15 s ${(med(late) * 1000).toFixed(0)} ms (a change = clock drift)`);
const firstVid = vidOnly[0], firstSim = simOnly[0];
console.log(`    first launch only in the VIDEO: ${firstVid != null ? "level time " + (firstVid - bestM.L0).toFixed(2) + " s (the game launched, the sim did not: a missed press, an orb/pad the sim missed, or a buffered input)" : "none"}`);
console.log(`    first launch only in the SIM: ${firstSim ? "level time " + (firstSim.k / 240).toFixed(2) + " s, block " + (firstSim.x / 30).toFixed(1) + ", " + firstSim.mode + (firstSim.act ? " (" + firstSim.act + ")" : "") : "none"}`);
const out = OUT;
fs.writeFileSync(path.join(out, path.basename(videoFile).replace(/\.\w+$/, "") + "_" + line.video.t + ".json"),
  JSON.stringify({ level: lv, base, video: path.basename(videoFile), t: line.video.t, levelStart: +bestM.L0.toFixed(3), tol: TOL, px: PX,
    launches: { video: vid.map(t => +(t - bestM.L0).toFixed(3)), sim: simL.map(e => +(e.k / 240).toFixed(3)), matched: matches,
      videoOnly: vidOnly.map(t => +(t - bestM.L0).toFixed(3)), simOnly: simOnly.map(e => ({ t: +(e.k / 240).toFixed(3), x: +e.x.toFixed(1), mode: e.mode, act: e.act })) },
    height: { start: +best.L0.toFixed(3), first: first || null, rms: +rms(errs.map(r => r.err)).toFixed(2), note: "height vs the lowest edge: valid only while the ground is in view" }, rows }));
