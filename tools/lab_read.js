// node tools/lab_read.js <video> --start S [--x0 X] [--to S2] [--spec specs/60_physics_lab.json] [--ground PX] [--color lime]
// node tools/lab_read.js --sim [--spec ...]     -- the sim's own numbers only (what the game should show)
//
// Reads a recording of the user playing a lab level (GDLM 60 physics lab: specs with a "lab" list of
// stations) and compares it with the sim, station by station: each station names metrics, and the
// same metric is measured on the sim's run (the saved solution) and on the player tracked in the video
// (tools/track.py, the lime cube, real frame times). One play closes many questions at once.
//   --start S   the video second the attempt starts (the first frame the cube moves at x = 0, or at
//               --x0 X units after a practice-mode respawn); x then follows from time (the lab runs
//               at 1x throughout, and teleports keep x). Tracking stops at the first death (the cube
//               vanishes or jumps back): run again with the next attempt's --start / --x0.
//   --ground PX the ground line's screen y at the start (default 775 at 1080p: cube centre 724 + 15 units);
//               followed frame to frame through track.py's --rows edges, since GD's camera moves.
// Metrics: alive (reaches the station's end), dy (y change through a teleport at column c), yAt (height
// at column c), launch (vertical speed the frame after the kick nearest column `at`: an orb, a jump), flat
// (y spread over the metric's from..to: a dash), slope (a wave leg's |dy|/|dx|), accel (the station's
// accelerations, units/frame^2: the peaks held and released). A metric's own from/to narrow its columns.
// Units: GD units (a block = 30), frames of 1/60 s; 1 unit = 3.375 px at 1080p.
// Writes nothing; real_stats rows and docs are the analyst's job (CLAUDE.md "Real-game stats").
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const { GD, readGdlvl } = require("./io.js");

const a = process.argv.slice(2);
const opt = (k, d) => { const i = a.indexOf("--" + k); return i < 0 ? d : a[i + 1]; };
const specFile = opt("spec", path.join(__dirname, "..", "specs", "60_physics_lab.json"));
const spec = JSON.parse(fs.readFileSync(specFile, "utf8"));
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const lvFile = opt("level", path.join(__dirname, "..", "levels", slug(spec.name).replace(/^(?!gdlm_)/, "gdlm_") + ".gdlvl"));
const TOL = { dy: 8, yAt: 6, launch: 0.6, flat: 3, accel: 0.05, slope: 0.1 };

// ---- the sim's run, sampled like a 60 fps video (every 4 ticks) ----
function simPath() {
  const L = readGdlvl(lvFile), w = GD.makeWorld(L.level.objects, L.level.header);
  let ev = null;
  try { const s = require("./solutions.js").get(L.levelStr, true); if (s && s.ok) ev = s.events; } catch (e) {}
  if (!ev) { const r = GD.solveAny(w); if (!r.ok) throw new Error("the sim cannot beat " + lvFile); ev = r.events; }
  const q = GD.run(w, ev), out = [];
  for (let t = 0; t < q.path.length; t += 4) { const s = q.path[t]; out.push({ t: t / 240, x: s.x, y: s.y, mode: s.mode }); }
  return { path: out, dead: q.dead, vx: q.path[240].x - q.path[0].x };   // units per second at the start speed
}

// ---- the player in the video ----
function videoPath(video, vx) {
  const t0 = +opt("start"), x0 = +opt("x0", 0), dur = (spec.lab[spec.lab.length - 1].to * 30 + 60 - x0) / vx + 1;
  const t1 = opt("to") ? +opt("to") : t0 + dur;
  const py = process.env.PYTHON || "python";
  const csv = execFileSync(py, [path.join(__dirname, "track.py"), video, "--from", String(t0), "--to", String(t1), "--rows", "--color", opt("color", "lime")],
    { encoding: "utf8", maxBuffer: 1 << 28 });
  let ground = +opt("ground", 775), lastX = null, miss = 0;
  const out = [];
  for (const line of csv.trim().split("\n").slice(1)) {
    const f = line.split(","), t = +f[0], n = +f[3], rows = (f[8] || "").split(" ").filter(Boolean).map(Number);
    const near = rows.filter(r => Math.abs(r - ground) < 25).sort((p, q) => Math.abs(p - ground) - Math.abs(q - ground));
    if (near.length) ground = near[0];
    if (!n) { if (++miss >= 4) break; continue; }   // gone for 4 frames: dead (or the cube left the screen)
    miss = 0;
    const cx = +f[1];
    if (lastX !== null && Math.abs(cx - lastX) > 150) break;   // jumped back: a respawn
    lastX = cx;
    out.push({ t: t - t0, x: x0 + vx * (t - t0), y: (ground - +f[2]) / 3.375 });
  }
  return out;
}

// ---- metrics, the same on both paths ----
const inX = (p, c0, c1) => p.filter(s => s.x >= c0 * 30 && s.x <= c1 * 30);
const vy = p => p.slice(1).map((s, i) => s.y - p[i].y);
let VXF = 0;   // units per frame at the lab's speed (set below)
function metric(p, st, m, end) {
  const fr = inX(p, m.from != null ? m.from : st.from, m.to != null ? m.to : st.to);
  if (m.m === "alive") return end >= st.to * 30 ? "passed" : "died at block " + (end / 30).toFixed(1);
  // a teleport fires at first touch (a turned one, wider, earlier): the highest point near it minus the height well before
  if (m.m === "dy") return m.at.map(c => {
    const xc = c * 30 + 15, b = p.filter(s => s.x < xc - 80).pop(), near = p.filter(s => s.x >= xc - 75 && s.x <= xc + 45);
    return b && near.length ? +(Math.max(...near.map(s => s.y)) - b.y).toFixed(1) : null; });
  if (m.m === "yAt") return m.at.map(c => { const s = p.find(q => q.x >= c * 30 + 15); return s ? +s.y.toFixed(1) : null; });
  if (fr.length < 4) return null;
  const v = vy(fr);
  if (m.m === "launch") {            // the kick (speed jump between frames) nearest column m.at: the speed just after it
    let best = null;
    for (let i = 1; i < v.length; i++) if (Math.abs(v[i] - v[i - 1]) > 2) {
      const d = Math.abs(fr[i].x - (m.at * 30 + 15));
      if (!best || d < best.d) best = { d, v: v[i] };
    }
    return best ? +best.v.toFixed(2) : null;
  }
  if (m.m === "flat") { const ys = fr.map(s => s.y); return +(Math.max(...ys) - Math.min(...ys)).toFixed(1); }
  if (m.m === "slope") {             // a wave leg's steepness: |dy| per |dx|, frames away from the turns
    const r = v.map((x, i) => i && Math.abs(x - v[i - 1]) < 0.5 && Math.abs(x) > 0.5 ? Math.abs(x) / VXF : null).filter(x => x != null).sort((a, b) => a - b);
    return r.length ? +r[r.length >> 1].toFixed(2) : null;
  }
  if (m.m === "accel") {             // second differences away from kicks; the peaks of each sign
    const acc = v.slice(1).map((x, i) => x - v[i]).filter(x => Math.abs(x) < 1.5 && Math.abs(x) > 0.05);
    const med = xs => { if (!xs.length) return null; xs = xs.slice().sort((p, q) => p - q); return +xs[xs.length >> 1].toFixed(3); };
    return { up: med(acc.filter(x => x > 0)), down: med(acc.filter(x => x < 0)), n: acc.length };
  }
}
const same = (m, s, g) => {
  if (s == null || g == null) return "?";
  if (m.m === "alive") return s === g ? "agree" : "DIFFER";
  const tol = TOL[m.m], cmp = (p, q) => p == null || q == null || Math.abs(p - q) <= tol;
  if (Array.isArray(s)) return s.every((x, i) => cmp(x, g[i])) ? "agree" : "DIFFER";
  if (typeof s === "object") return cmp(s.up, g.up) && cmp(s.down, g.down) ? "agree" : "DIFFER";
  return cmp(s, g) ? "agree" : "DIFFER";
};
const show = x => x == null ? "-" : typeof x === "object" && !Array.isArray(x) ? `up ${x.up} down ${x.down}` : JSON.stringify(x);

const sim = simPath(), simEnd = sim.path[sim.path.length - 1].x;
VXF = sim.vx / 60;
const video = a.includes("--sim") ? null : a.find(x => !x.startsWith("--") && !/^[-\d.]+$/.test(x) && x !== specFile && x !== lvFile);
let vid = null, vidEnd = null;
if (video) { vid = videoPath(video, sim.vx); vidEnd = vid.length ? vid[vid.length - 1].x : 0; }
console.log(`${spec.name}: sim ${sim.dead ? "dies" : "beats it"}; ${video ? `video ${path.basename(video)} from ${opt("start")} s: tracked to block ${(vidEnd / 30).toFixed(1)}` : "(sim only)"}`);
for (const st of spec.lab) {
  for (const m of st.metrics) {
    const s = metric(sim.path, st, m, simEnd), g = vid ? metric(vid, st, m, vidEnd) : null;
    if (vid && st.from * 30 > vidEnd) continue;
    console.log(`${String(st.n).padStart(2)} ${st.name.padEnd(24)} ${m.m.padEnd(6)} sim ${show(s).padEnd(26)}` + (vid ? ` game ${show(g).padEnd(26)} ${same(m, s, g)}` : ""));
  }
}
if (vid && vidEnd < spec.lab[spec.lab.length - 1].to * 30) console.log(`(tracking ended at block ${(vidEnd / 30).toFixed(1)}: a death or respawn; read the rest with the next --start and --x0)`);
