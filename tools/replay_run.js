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
// With the recording's sound (tools/audiolog.ps1, WASAPI loopback, next to the video) and the level's song on
// this PC, the music's restart pins each attempt's clock (~10 ms) and the shift search narrows to +-25 ms;
// without, the bar fit (+-1.5 s) stands in. --audio <wav> picks the sound file by hand.
// STATUS 2026-11-24: GDLM 63 / Blast Processing / GDLM 60 attempts agree; the 02:33:44 official runs do not yet (PHYSICS.md "Fidelity").
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
// only this level's attempts: a recording holds several levels; the bar gives each attempt's implied length
// (secs * 100 / pct), which must be near this level's (the sim's run time to the end) within 25%
const allRuns = JSON.parse(fs.readFileSync(runsFile, "utf8")).runs.filter(r => r.mode === "normal" && r.secs > 1)
  .filter(r => r.start >= +opt("from", -1) && r.start <= +opt("to", 1e9));
let runs = allRuns;
if (!opt("from") && !opt("to")) {
  const lens = allRuns.map(r => r.beaten ? r.secs : r.pct > 5 ? r.secs * 100 / r.pct : null);
  const beat = allRuns.filter(r => r.beaten).map(r => r.secs);
  const ref = +opt("secs", beat.length ? beat.sort((a, b) => a - b)[beat.length >> 1] : 0);
  if (ref) runs = allRuns.filter((r, i) => lens[i] == null ? r.secs < ref * 0.3 : Math.abs(lens[i] - ref) / ref < 0.25);
  if (runs.length < allRuns.length) console.log(`${allRuns.length - runs.length} attempt(s) left out: another level by their length (this one ~${ref.toFixed(0)} s; --secs or --from/--to to choose)`);
}

// 2. the input log: press/release times in UTC ms
// two formats: tools/inputlog.ps1's "ms,utc ISO,down|up,key" and the minimal logger's "<unix ms> <down|up> <key>";
// several logs may be concatenated (a logger restarted mid-recording)
// a header line ("# ...": a logger started) resets every key: a log stopped while a key was down (02:33:44)
// must not leave the button held through the next file
const ev = [];
for (const l of fs.readFileSync(logFile, "utf8").split(/\r?\n/)) {
  if (!l.trim()) continue;
  if (l.startsWith("#")) { if (/started/.test(l)) { const iso = (l.match(/started (\S+)/) || [])[1]; ev.push({ t: iso ? Date.parse(iso) : null, reset: true }); } continue; }
  let e;
  if (l.includes(",")) { const [ms, utc, ud, key] = l.split(","); e = { t: Date.parse(utc), type: ud === "down" ? "press" : "release", key }; }
  else { const [t, ud, key] = l.trim().split(/\s+/); e = { t: +t, type: ud === "down" ? "press" : "release", key }; }
  if (isFinite(e.t)) ev.push(e);
}
// the button is down while any key is down (each key down or up, never counted twice)
const button = []; { const keys = new Set(); for (const e of ev) {
  const was = keys.size > 0; if (e.reset) { keys.clear(); if (was) button.push({ t: e.t != null ? e.t : (button[button.length - 1] || {}).t || 0, type: "release" }); continue; }
  if (e.type === "press") keys.add(e.key || "k"); else keys.delete(e.key || "k");
  const is = keys.size > 0; if (is !== was) button.push({ t: e.t, type: is ? "press" : "release" }); } }
button.sort((p, q) => p.t - q.t);
// the video's start in UTC from its name ("GD claude-rec 2026-11-24_00-33-07.mkv", local time)
const m = path.basename(video).match(/(\d{4})-(\d\d)-(\d\d)_(\d\d)-(\d\d)-(\d\d)/);
const videoT0 = m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime() : null;
if (videoT0 == null) { console.log("the video's name has no start time"); process.exit(1); }

const endPct = q => Math.min(100, Math.max(0, q.end.x / w.endX * 100));
const out = [];
// --- the song pins each attempt's clock (when the recording has its sound: tools/audiolog.ps1 next to the
// video, and the level's song is on this PC). GD restarts the music at every attempt, from the level's song
// offset (kA13): the loudness envelope of the recorded sound around the bar's start is matched with the song's
// first 3 s; the best lag is the attempt's start, to ~10 ms.
const FFMPEG = process.env.FFMPEG || "ffmpeg", ENV_HZ = 100;
function envelope(file, from, dur) {   // mono loudness, 100 values a second
  try { const raw = execFileSync(FFMPEG, ["-v", "error", "-ss", String(Math.max(0, from)), "-t", String(dur), "-i", file, "-ac", "1", "-ar", "4000", "-f", "f32le", "-"], { maxBuffer: 1 << 26, windowsHide: true });
    const f = new Float32Array(raw.buffer, raw.byteOffset, raw.length >> 2), n = Math.floor(f.length / 40), out = new Float32Array(n);
    for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < 40; k++) s += Math.abs(f[i * 40 + k]); out[i] = s / 40; } return out; } catch (e) { return null; }
}
function songFile() {
  const rec = L.rec ? L.rec : null, get = k => { try { return rec ? GD.getField(rec, k) : null; } catch (e) { return null; } };
  const custom = get("k45"), off = +((L.level.header.match(/(?:^|,)kA13,([-0-9.]+)/) || [])[1] || 0);
  if (custom && custom !== "0") for (const ext of [".mp3", ".ogg"]) { const f = path.join(__dirname, "..", "local", "songs", custom + ext); if (fs.existsSync(f)) return { file: f, off }; }
  let n = lv.startsWith("official:") ? +lv.slice(9) - 1 : get("k8") != null ? +get("k8") : null;
  if (n != null && isFinite(n)) { const { OFFICIAL } = require("./beats.js"), dir = (process.env.GD_LEVELS || "C:/Program Files (x86)/Steam/steamapps/common/Geometry Dash/Resources/levels/").replace(/levels\/?$/, "");
    const f = path.join(dir, OFFICIAL[n] + ".mp3"); if (fs.existsSync(f)) return { file: f, off }; }
  return null;
}
const audioFile = opt("audio", (() => { const d = path.dirname(video), stamp = path.basename(video).match(/\d{4}-\d\d-\d\d_\d\d-\d\d-\d\d/);
  if (!stamp || !fs.existsSync(d)) return null; const all = fs.readdirSync(d).filter(f => /^GD claude-audio .*\.wav$/.test(f)).sort();
  const before = all.filter(f => f.slice(16, 35) <= stamp[0]); return before.length ? path.join(d, before[before.length - 1]) : null; })());
let audio = null, song = null, songEnv = null;
if (audioFile && fs.existsSync(audioFile + ".json")) { audio = JSON.parse(fs.readFileSync(audioFile + ".json", "utf8")); audio.file = audioFile; song = songFile(); if (song) songEnv = envelope(song.file, song.off, 3); }
function pinStart(approxUtc) {   // UTC ms of the music's restart near approxUtc, or null
  if (!audio || !songEnv || !songEnv.length) return null;
  const a0 = Date.parse(audio.start_utc), from = (approxUtc - a0) / 1000 - 1.5, rec = envelope(audio.file, from, 6);
  if (!rec || rec.length < songEnv.length) return null;
  // GD's music off (the user, 2026-11-24): the recording's sound is silence there; say so once, bar fit instead
  if (Math.max(...rec) < 1e-4) { if (!pinStart.warned) { console.log("the recording's sound is silent around the attempts: GD's music is off? (bar fit instead)"); pinStart.warned = true; } return null; }
  const m = songEnv.length; let best = -2, bestLag = 0;
  const mean = a => a.reduce((s, x) => s + x, 0) / a.length, ms = mean(songEnv), ss = Math.sqrt(songEnv.reduce((s, x) => s + (x - ms) ** 2, 0)) || 1;
  for (let lag = 0; lag + m <= rec.length; lag++) {
    let mr = 0; for (let i = 0; i < m; i++) mr += rec[lag + i]; mr /= m; let num = 0, sr = 0;
    for (let i = 0; i < m; i++) { const d = rec[lag + i] - mr; num += d * (songEnv[i] - ms); sr += d * d; }
    const c = num / (ss * (Math.sqrt(sr) || 1)); if (c > best) { best = c; bestLag = lag; }
  }
  return best > 0.5 ? a0 + (Math.max(0, from) + bestLag / ENV_HZ) * 1000 : null;
}
if (audioFile) console.log(`sound: ${path.basename(audioFile)}${song ? ", song " + path.basename(song.file) : " (the level's song is not on this PC: bar fit only)"}`);

// one clock offset for the whole recording (the log's clock vs the video name's second): found on the attempts
// that are most constrained -- the clears and long runs -- then every attempt is judged within +-60 ms of it
function fit(r, center, span) {
  // the music's restart pins the clock (+-25 ms) -- but a pin can lock onto the wrong spot (02-33-44: every
  // pinned attempt died in the first 7%, the bar fit got 23-63%), so the bar fit runs too and the closer one wins
  const t00 = videoT0 + r.start * 1000, pinned = pinStart(t00);
  const tries = [[t00, center, span, false]].concat(pinned != null ? [[pinned, 0, 25, true]] : []);
  let best = null;
  for (const [t0, c0, sp0, pin] of tries)
  for (let sh = c0 - sp0; sh <= c0 + sp0; sh += 1000 / 240) {
    const start = t0 + sh, list = button.filter(e => e.t >= start - 50 && e.t <= start + r.secs * 1000 + 500)
      .map(e => ({ tick: Math.max(0, Math.round((e.t - start) / 1000 * 240)), type: e.type }));
    if (!list.length) continue;
    const q = GD.run(w, list), pct = q.done ? 100 : endPct(q), err = Math.abs(pct - (r.beaten ? 100 : r.pct));
    if (!best || err < best.err - 1e-9) best = { err, sh: sh + (t0 - t00), pct, q, list, pin };
  }
  return best;
}
const anchors = runs.filter(r => r.beaten).concat(runs.filter(r => !r.beaten).sort((a, b) => b.secs - a.secs)).slice(0, 4);
const shifts = anchors.map(r => fit(r, 0, 1500)).filter(b => b && b.err <= 2.5).map(b => b.sh).sort((a, b) => a - b);
const OFFSET = +opt("offset", shifts.length ? shifts[shifts.length >> 1] : 0);
console.log(`clock offset ${Math.round(OFFSET)} ms (from ${shifts.length} anchor attempt(s)${shifts.length ? ": " + shifts.map(Math.round).join(", ") : ""})`);
// the first attempt after a level loads (nothing on the bar for 3 s before): its bar shows ~0.55 s before the
// level starts moving (GD's fade-in; GDLM 63 +580 ms, Blast Processing +520 ms, 2026-11-24)
const LOAD_MS = 550;
for (const r of runs) {
  const prev = allRuns.filter(q => q.start < r.start).pop(), afterLoad = !prev || r.start - (prev.start + prev.secs) > 3;
  const best = fit(r, OFFSET + (afterLoad ? LOAD_MS : 0), shifts.length ? (afterLoad ? 150 : 60) : 1500);
  if (!best) { out.push({ attempt: r.start, note: "no inputs logged in this attempt" }); continue; }
  const want = r.beaten ? 100 : r.pct, restart = !r.beaten && r.secs < 3 && r.pct < 5;   // a quick restart, not a death
  const ok = best.err <= 2.5 || restart;   // GD's % and our x/endX differ by ~1-2%
  const row = { video_t: r.start, video: r.beaten ? "beaten" : `died ${r.pct.toFixed(1)}%`, sim: best.q.done ? "beaten" : `died ${best.pct.toFixed(1)}% (${best.q.why || "?"})`,
    shift_ms: Math.round(best.sh), presses: best.list.filter(e => e.type === "press").length, agree: ok,
    events: best.list, beaten: !!r.beaten, videoPct: r.beaten ? 100 : r.pct, secs: r.secs, x: +(w.endX * (r.beaten ? 100 : r.pct) / 100).toFixed(1), why: best.q.why };
  if (!ok) { const s = best.q.end; Object.assign(row, { mismatch: `the sim ${best.q.done ? "finishes" : "dies at " + best.pct.toFixed(1) + "% x " + s.x.toFixed(0) + " (" + s.mode + ", " + (best.q.why || "?") + ")"} where the video ${r.beaten ? "beats it" : "dies at " + want.toFixed(1) + "%"}` }); }
  out.push(row);
  console.log(`${r.start.toFixed(1).padStart(7)} s  video ${row.video.padEnd(12)} sim ${row.sim.padEnd(24)} shift ${row.shift_ms} ms  ${restart ? "restart (not judged)" : ok ? "agree" : "MISMATCH"}`);
}
// the shared per-attempt file (agreed with gd-visuals: the viewer's "you play" uses the same lines, and shows
// them as a ghost beside the route): local/attempts/<base>.jsonl, one attempt per line
{
  // visuals' lib/liveplay.js levelHash (FNV-1a 32, 8 hex digits): the viewer lists lines by base + hash
  let hashOf; try { hashOf = require("../lib/liveplay.js").levelHash; } catch (e) {}
  if (!hashOf) hashOf = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, "0"); };
  // a build stage (local/wip/<session>/<base>.stages/<stage>.gdlvl) lists as "<base>.<stage>"
  const stage = lv.split(path.sep).join("/").match(/([^/]+)\.stages\/([^/]+)\.gdlvl$/);
  const base = stage ? stage[1] + "." + stage[2] : /^c\d+$/.test(lv) ? lv : lv.startsWith("official:") ? "official_" + lv.slice(9) : path.basename(lv).replace(/\.gdlvl$/, "");
  const adir = path.join(__dirname, "..", "local", "attempts"); fs.mkdirSync(adir, { recursive: true });
  const lines = [];
  for (const o of out) { if (!o.events) continue;
    lines.push(JSON.stringify({ id: "a" + Date.now().toString(36) + lines.length, at: new Date().toISOString(), source: "video", level: L.name || lv, file: lv.startsWith("official:") || /^c\d+$/.test(lv) ? lv : path.relative(path.join(__dirname, ".."), path.resolve(lv)).split(path.sep).join("/"),
      hash: hashOf(L.levelStr), events: o.events, result: o.beaten ? "clear" : "died", x: o.x, pct: o.videoPct, t: o.secs, why: o.why || null, practice: false, from: null,
      video: { file: path.basename(video), inputs: path.basename(logFile), t: o.video_t, shift_ms: o.shift_ms, agree: o.agree, res: o.agree ? "agree" : "mismatch", mismatch: o.mismatch || undefined } })); }
  // re-running a video replaces that video's lines (no duplicates); other lines (the viewer's, other videos) stay
  const af = path.join(adir, base + ".jsonl"), keep = fs.existsSync(af) ? fs.readFileSync(af, "utf8").split("\n").filter(l => { if (!l.trim()) return false;
    try { const o = JSON.parse(l); return !(o.source === "video" && o.video && o.video.file === path.basename(video)); } catch (e) { return true; } }) : [];
  if (lines.length) fs.writeFileSync(af, keep.concat(lines).join("\n") + "\n");
}
const dir = path.join(__dirname, "..", "local", "replays"); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, path.basename(video).replace(/\.\w+$/, "") + ".json"), JSON.stringify({ level: L.name, video: path.basename(video), log: path.basename(logFile), attempts: out }, null, 1));
console.log(`${out.filter(o => o.agree).length} of ${out.length} attempts agree; mismatches go to PHYSICS.md "Fidelity"`);
