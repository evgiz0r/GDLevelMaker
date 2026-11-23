// node tools/human_presses.js <video> <level.gdlvl | c<id> | official:N> [--window X,Y,W] [--runs local/runs/<video>.json]
//                              [--attempts all|beaten|N,N] [--k PX_PER_UNIT]
// Where the user really presses: the calibration data for the natural route ("align the solver to take the
// more natural path"). For each normal-mode attempt in a recording (tools/runs.js finds them from the progress
// bar), the player is tracked (tools/track.py, a narrow strip at the player's screen column, UI cut out) and
// every KICK -- the frame its vertical speed turns sharply upward from rest or a fall: a jump, an orb, a pad --
// is taken as a press. Its time since the attempt began becomes level x through the sim's own run of the level
// (speed portals included), and is compared with the sim's natural route there: the nearest sim press, its
// player window (lib/windows.js), and where the human press falls in it (0% = earliest tick that works).
// Prints one line per matched press and a summary: median |human - sim| ms and the human's median position in
// the window. Limits: a kick is a jump start in screen space (the camera follows slowly, a kick is still a
// kick); presses that change nothing visible (a held ship, a missed orb) are not seen; flipped gravity reads
// the kick the other way (handled: a sharp change of either sign from rest).
// STATUS 2026-11-23: first version, not yet run end to end (waits for the sim's Spooky Dash solve).
// Writes local/human_presses/<video>.<level>.json. Reads the video, never writes it.
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const { GD, readGdlvl, unpack } = require("./io.js");
Object.assign(GD, require("../lib/difficulty.js"), require("../lib/natural.js"));
const W = require("../lib/windows.js");

const a = process.argv.slice(2);
const opt = (k, d) => { const i = a.indexOf("--" + k); return i < 0 ? d : a[i + 1]; };
const [video, lv] = a.filter(x => !x.startsWith("--") && !a[a.indexOf(x) - 1]?.startsWith("--"));
if (!video || !lv) { console.log(fs.readFileSync(__filename, "utf8").split("\n").slice(0, 3).join("\n")); process.exit(1); }
const win = (opt("window", "0,0,1920")).split(",").map(Number), k = win[2] / 1920;

function loadLevel(s) {
  if (/^c\d+$/.test(s)) return readGdlvl(path.join(__dirname, "..", "local", "community", s.slice(1) + ".gdlvl"));
  if (s.startsWith("official:")) { const n = +s.slice(9), src = process.env.GD_LEVELS || "C:/Program Files (x86)/Steam/steamapps/common/Geometry Dash/Resources/levels/";
    const levelStr = unpack(fs.readFileSync(src + n + ".txt", "utf8")); return { levelStr, level: GD.parseLevel(levelStr) }; }
  return readGdlvl(s);
}
const L = loadLevel(lv), w = GD.makeWorld(L.level.objects, L.level.header);
// the sim's route: the cached solve (difficulty_solve.js) or the saved natural solution
let ev = null;
const tagOf = s => /^c\d+$/.test(s) ? s : s.startsWith("official:") ? String(+s.slice(9)).padStart(2, "0") : null;
if (tagOf(lv)) try { const r = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "local", "difficulty", tagOf(lv) + ".json"), "utf8")); ev = r.events; } catch (e) {}
if (!ev) try { const s = require("./solutions.js").get(L.levelStr, true); if (s) ev = s.events; } catch (e) {}
if (!ev) { console.log("no saved sim route for this level: solve it first (tools/difficulty_solve.js / tools/solutions.js)"); process.exit(1); }
try { const n = GD.naturalPlan(w, { ok: true, events: ev }, L.level.objects); if (n) ev = n.events; } catch (e) {}
ev = ev.slice().sort((p, q) => p.tick - q.tick);
const simPath = GD.run(w, ev).path;
const tickAtX = x => { let t = simPath.findIndex(s => s.x >= x); return t < 0 ? simPath.length - 1 : t; };

// the attempts: from tools/runs.js's output for this video
const runsFile = opt("runs", path.join(__dirname, "..", "local", "runs", path.basename(video).replace(/\.\w+$/, "") + ".json"));
const runs = JSON.parse(fs.readFileSync(runsFile, "utf8"));
const atts = (runs.runs || []).filter(r => r.mode !== "practice" && r.secs > 3);
const pick = opt("attempts", "all"), fromS = +opt("from", -1), toS = +opt("to", 1e9);
const inT = atts.filter(r => r.start >= fromS && r.start <= toS);
const chosen = pick === "all" ? inT : pick === "beaten" ? inT.filter(r => r.beaten) : pick.split(",").map(i => inT[+i - 1]).filter(Boolean);

const px = (k0) => Math.round(k0);
const crop = [px(win[0] + 620 * k), px(win[1] + 140 * k), px(180 * k), px(860 * k)].join(",");
const unitPx = +opt("k", 3.375 * k);   // px per unit on screen (only scales the kick threshold)
const kicks = [];
for (const r of chosen) {
  const t0 = r.start, t1 = r.start + r.secs;
  const csv = execFileSync(process.env.PYTHON || "python", [path.join(__dirname, "track.py"), video, "--from", String(t0), "--to", String(t1), "--crop", crop, "--tol", "70"], { encoding: "utf8", maxBuffer: 1 << 28 });
  const fr = csv.trim().split("\n").slice(1).map(l => l.split(",").map(Number)).filter(f => f[3] > 150 * k * k);
  for (let i = 2; i < fr.length; i++) {
    const dt0 = fr[i - 1][0] - fr[i - 2][0], dt1 = fr[i][0] - fr[i - 1][0];
    if (dt0 > 0.025 || dt1 > 0.025) continue;
    const v0 = (fr[i - 2][2] - fr[i - 1][2]) / unitPx, v1 = (fr[i - 1][2] - fr[i][2]) / unitPx;   // units/frame, up +
    // a kick: from rest or a fall to a sharp climb (or, upside down, a sharp drop) of >= 4 units/frame change
    if (Math.abs(v1 - v0) >= 4 && Math.abs(v1) >= 4 && Math.abs(v0) <= Math.abs(v1) * 0.6) {
      const tLevel = fr[i - 1][0] - t0, tick = Math.round(tLevel * 240), x = simPath[Math.min(tick, simPath.length - 1)].x;
      kicks.push({ video_t: +fr[i - 1][0].toFixed(3), attempt_t: +tLevel.toFixed(3), x: +x.toFixed(1), attempt: atts.indexOf(r) + 1 });
      i += 3;
    }
  }
}
// match each human press to the sim route's nearest press (within 2 blocks) and its player window
const press = ev.map((e, i) => ({ e, i })).filter(p => p.e.type === "press");
const want = new Set(), match = [];
for (const h of kicks) {
  const th = tickAtX(h.x);
  let best = null; for (const p of press) { const d = Math.abs(simPath[Math.min(p.e.tick, simPath.length - 1)].x - h.x); if (d <= 60 && (!best || d < best.d)) best = { p, d }; }
  if (!best) continue;
  want.add(best.p.i); match.push({ h, th, p: best.p });
}
const wins = W.inputWindows(w, ev, simPath, { only: i => want.has(i) });
const out = [];
for (const m of match) {
  const wv = wins.find(x => x.i === m.p.i); if (!wv) continue;
  const span = Math.max(1, wv.hi - wv.lo), pos = (m.th - wv.lo) / span, ms = (m.th - m.p.e.tick) / 240 * 1000;
  out.push(Object.assign({}, m.h, { simTick: m.p.e.tick, humanTick: m.th, lo: wv.lo, hi: wv.hi, windowMs: Math.round((wv.hi - wv.lo + 1) / 0.24), posInWindow: +pos.toFixed(2), humanMinusSimMs: Math.round(ms) }));
}
const med = xs => { if (!xs.length) return null; xs = xs.slice().sort((p, q) => p - q); return xs[xs.length >> 1]; };
for (const o of out) console.log(`att ${o.attempt}  x ${o.x.toFixed(0).padStart(6)}  human ${o.humanMinusSimMs >= 0 ? "+" : ""}${o.humanMinusSimMs} ms vs sim  window ${o.windowMs} ms  at ${Math.round(o.posInWindow * 100)}%`);
console.log(`${kicks.length} kicks in ${chosen.length} attempts, ${out.length} matched to sim presses: median |human - sim| ${med(out.map(o => Math.abs(o.humanMinusSimMs)))} ms, human median position in window ${med(out.map(o => o.posInWindow))}`);
const dir = path.join(__dirname, "..", "local", "human_presses"); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, path.basename(video).replace(/\.\w+$/, "") + "." + (tagOf(lv) || path.basename(lv)) + ".json"), JSON.stringify(out));
