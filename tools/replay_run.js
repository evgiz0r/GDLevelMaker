// node tools/replay_run.js <video.mkv> <inputs.csv> <level.gdlvl | official:N | c<id>> [--window X,Y,W] [--from S --to S]
// The user's real GD runs replayed in our sim (USE_CASES 29; the user: "the physics might not match exactly.
// but thats good, it will also force the engine to become closer"). Every recorded run becomes a physics test.
//  1. attempts: tools/runs.js reads GD's progress bar in the video (each normal-mode attempt: its start in the
//     video, the % it died at or "beaten"); --window for a windowed GD.
//  2. inputs: tools/inputlog.ps1's log (written by tools/record.sh with the recording): down/up with wall-clock
//     times. The video's clock: its file name's start time (whole seconds), so the offset between the two
//     clocks is found per attempt: the shift (within +-1.5 s of the name's estimate, in 1/240 s) at which the
//     sim, fed that attempt's presses, dies at the video's % (or finishes, if the video beat it).
//  3. report per attempt: the matched shift, the sim's end vs the video's. An attempt no shift explains is a
//     PHYSICS MISMATCH (level, %, x, mode): it goes to PHYSICS.md's fidelity list. The per-press offsets
//     against the solved human route (early/late/extra/missing) go to local/replays/<video>.json for the
//     viewer's ghost and for difficulty; and one line per attempt in local/attempts/<base>.jsonl (the format
//     shared with the viewer's "you play", agreed with gd-visuals: events, result, pct, video {file, inputs, t,
//     shift_ms, agree, res, mismatch}).
// No sound is recorded on this PC (no loopback), so the song can't align it yet; with sound, the music's
// restart per attempt would pin the clock to a frame.
// STATUS 2026-11-24: first version, not yet run on a real log (the first recording with inputs comes next).
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const { GD, readGdlvl, unpack } = require("./io.js");
Object.assign(GD, require("../lib/natural.js"));
const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf("--" + k); return i < 0 ? d : a[i + 1]; };
const [video, logFile, lv] = a.filter((x, i) => !x.startsWith("--") && !(a[i - 1] || "").startsWith("--"));
if (!video || !logFile || !lv) { console.log(fs.readFileSync(__filename, "utf8").split("\n").slice(0, 2).join("\n")); process.exit(1); }

function loadLevel(s) {
  if (/^c\d+$/.test(s)) return readGdlvl(path.join(__dirname, "..", "local", "community", s.slice(1) + ".gdlvl"));
  if (s.startsWith("official:")) { const n = +s.slice(9), src = process.env.GD_LEVELS || "C:/Program Files (x86)/Steam/steamapps/common/Geometry Dash/Resources/levels/";
    const levelStr = unpack(fs.readFileSync(src + n + ".txt", "utf8")); return { levelStr, level: GD.parseLevel(levelStr), name: "official " + n }; }
  return readGdlvl(s);
}
const L = loadLevel(lv), w = GD.makeWorld(L.level.objects, L.level.header);

// 1. attempts from the progress bar (tools/runs.js output, run it first if missing)
const runsFile = path.join(__dirname, "..", "local", "runs", path.basename(video).replace(/\.\w+$/, "") + ".json");
if (!fs.existsSync(runsFile)) execFileSync(process.execPath, [path.join(__dirname, "runs.js"), video].concat(opt("window") ? ["--window", opt("window")] : []), { windowsHide: true, stdio: "inherit" });
const runs = JSON.parse(fs.readFileSync(runsFile, "utf8")).runs.filter(r => r.mode === "normal" && r.secs > 1)
  .filter(r => r.start >= +opt("from", -1) && r.start <= +opt("to", 1e9));

// 2. the input log: press/release times in UTC ms
// two formats: tools/inputlog.ps1's "ms,utc ISO,down|up,key" and the minimal logger's "<unix ms> <down|up> <key>"
const ev = fs.readFileSync(logFile, "utf8").split(/\r?\n/).filter(l => l.trim() && !l.startsWith("#")).map(l => {
  if (l.includes(",")) { const [ms, utc, ud, key] = l.split(","); return { t: Date.parse(utc), type: ud === "down" ? "press" : "release", key }; }
  const [t, ud, key] = l.trim().split(/\s+/); return { t: +t, type: ud === "down" ? "press" : "release", key };
}).filter(e => isFinite(e.t)).sort((p, q) => p.t - q.t);
// merge keys: the button is down while any of them is down
const button = []; { let n = 0; for (const e of ev) { const was = n > 0; n += e.type === "press" ? 1 : -1; n = Math.max(0, n); const is = n > 0; if (is !== was) button.push({ t: e.t, type: is ? "press" : "release" }); } }
// the video's start in UTC from its name ("GD claude-rec 2026-11-24_00-33-07.mkv", local time)
const m = path.basename(video).match(/(\d{4})-(\d\d)-(\d\d)_(\d\d)-(\d\d)-(\d\d)/);
const videoT0 = m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() : null;
if (videoT0 == null) { console.log("the video's name has no start time"); process.exit(1); }

const endPct = q => Math.min(100, Math.max(0, q.end.x / w.endX * 100));
const out = [];
for (const r of runs) {
  const t0 = videoT0 + r.start * 1000;   // the attempt's first frame, UTC, to within the name's second
  let best = null;
  for (let sh = -1500; sh <= 1500; sh += 1000 / 240) {
    const start = t0 + sh, list = button.filter(e => e.t >= start - 50 && e.t <= start + r.secs * 1000 + 500)
      .map(e => ({ tick: Math.max(0, Math.round((e.t - start) / 1000 * 240)), type: e.type }));
    if (!list.length) continue;
    const q = GD.run(w, list), pct = q.done ? 100 : endPct(q), want = r.beaten ? 100 : r.pct;
    const err = Math.abs(pct - want);
    if (!best || err < best.err) best = { err, sh, pct, q, list };
  }
  if (!best) { out.push({ attempt: r.start, note: "no inputs logged in this attempt" }); continue; }
  const want = r.beaten ? 100 : r.pct, ok = best.err <= 1.5;
  const row = { video_t: r.start, video: r.beaten ? "beaten" : `died ${r.pct.toFixed(1)}%`, sim: best.q.done ? "beaten" : `died ${best.pct.toFixed(1)}% (${best.q.why || "?"})`,
    shift_ms: Math.round(best.sh), presses: best.list.filter(e => e.type === "press").length, agree: ok,
    events: best.list, beaten: !!r.beaten, videoPct: r.beaten ? 100 : r.pct, secs: r.secs, x: +(w.endX * (r.beaten ? 100 : r.pct) / 100).toFixed(1), why: best.q.why };
  if (!ok) { const s = best.q.end; Object.assign(row, { mismatch: `the sim ${best.q.done ? "finishes" : "dies at " + best.pct.toFixed(1) + "% x " + s.x.toFixed(0) + " (" + s.mode + ", " + (best.q.why || "?") + ")"} where the video ${r.beaten ? "beats it" : "dies at " + want.toFixed(1) + "%"}` }); }
  out.push(row);
  console.log(`${r.start.toFixed(1).padStart(7)} s  video ${row.video.padEnd(12)} sim ${row.sim.padEnd(24)} shift ${row.shift_ms} ms  ${ok ? "agree" : "MISMATCH"}`);
}
// the shared per-attempt file (agreed with gd-visuals: the viewer's "you play" uses the same lines, and shows
// them as a ghost beside the route): local/attempts/<base>.jsonl, one attempt per line
{
  const fnv = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
  const hashOf = GD.levelHash || fnv, base = /^c\d+$/.test(lv) ? lv : lv.startsWith("official:") ? "official_" + lv.slice(9) : path.basename(lv).replace(/\.gdlvl$/, "");
  const adir = path.join(__dirname, "..", "local", "attempts"); fs.mkdirSync(adir, { recursive: true });
  const lines = [];
  for (const o of out) { if (!o.events) continue;
    lines.push(JSON.stringify({ id: "a" + Date.now().toString(36) + lines.length, at: new Date().toISOString(), source: "video", level: L.name || lv, file: lv.startsWith("official:") || /^c\d+$/.test(lv) ? lv : path.relative(path.join(__dirname, ".."), path.resolve(lv)).split(path.sep).join("/"),
      hash: hashOf(L.levelStr), events: o.events, result: o.beaten ? "clear" : "died", x: o.x, pct: o.videoPct, t: o.secs, why: o.why || null, practice: false, from: null,
      video: { file: path.basename(video), inputs: path.basename(logFile), t: o.video_t, shift_ms: o.shift_ms, agree: o.agree, res: o.agree ? "agree" : "mismatch", mismatch: o.mismatch || undefined } })); }
  if (lines.length) fs.appendFileSync(path.join(adir, base + ".jsonl"), lines.join("\n") + "\n");
}
const dir = path.join(__dirname, "..", "local", "replays"); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, path.basename(video).replace(/\.\w+$/, "") + ".json"), JSON.stringify({ level: L.name, video: path.basename(video), log: path.basename(logFile), attempts: out }, null, 1));
console.log(`${out.filter(o => o.agree).length} of ${out.length} attempts agree; mismatches go to PHYSICS.md "Fidelity"`);
