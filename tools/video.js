// node tools/video.js <level.gdlvl | official:N | c<id>> [--run <attempt id | last>] [--route] [--from s] [--to s]
//                     [--fps 60|30] [--size 1280x720] [--out file.mp4] [--port 8767] [--vs-rec] [--clicks mouse|keyboard]
// A video of the level playing, as the game draws it, with its song in sync: an mp4 to send to the chat or watch on the
// phone (the user, 2026-11-24: "a flow that makes a video from replay ... similar to the actual gameplay"). Frames are
// the viewer's game look with GD's own art from the install (lib/art.js), its camera, trail, colours and death burst,
// rendered headless (test=1, hidden) on a virtual clock -- every frame exactly 1/fps apart whatever the render speed --
// then joined with the song (from level time 0 = song second kA13 offset) by ffmpeg.
//   --route (default): the saved route (the viewer's natural replay); --run <id|last>: one of the user's attempts
//   (local/attempts/, tools/attempts.js) drawn with the user's own icon, ending ~1 s after the death burst.
//   --from/--to: a part, in level seconds. Default 1280x720 at 60 fps; it stays under 30 MB (re-encoded at a lower
//   bitrate when the first pass is bigger).
//   --clicks mouse|keyboard: a click on every press and release (lib/clicks.js's self-made samples), mixed under the song,
//   like the click-sound bots players use.
// Writes local/video/<level>[_run_<id>].mp4 -- LOCAL ONLY: RobTop's art and the song are in it, never commit or upload it.
// One heavy job (tools/heavy.js; it times itself into local/timings.jsonl).
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ROOT = path.join(__dirname, ".."), { headless } = require("./headless.js"), { levelOf } = require("./shoot.js");
const args = process.argv.slice(2), opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
if (require.main === module && (!args.length || args[0].startsWith("--"))) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(1); }
const GAME = require("./gdpaths.js").GAME;
const SAVE = require("./gdpaths.js").SAVE;
const MAX_MB = 30;

// the level, its saved route and its song file + offset
function resolve(w) {
  if (/^c\d+$/.test(w)) w = path.join(ROOT, "local", "community", w.slice(1) + ".gdlvl");
  const lv = levelOf(w);
  if (!lv.solution) try { const s = require("./solutions.js").get(lv.levelStr, true); if (s && s.events) lv.solution = s; } catch (e) {}
  if (!lv.solution) lv.solution = { ok: false, events: [], why: "not solved: the camera runs at the level's speed", pending: true };   // never solve in the page
  let song = null, m;
  if ((m = /^official:(\d+)$/.exec(w))) {
    const src = fs.readFileSync(path.join(__dirname, "index_levels.js"), "utf8"), arr = /OFFICIAL_SONGS = (\[[^\]]+\])/.exec(src);
    const names = arr ? eval(arr[1]) : [];   // the list in index_levels.js, read as data
    if (names[+m[1] - 1]) song = { file: path.join(GAME, "Resources", names[+m[1] - 1] + ".mp3"), offset: 0 };
  } else if (/\.gdlvl$/.test(w)) {
    const L = require("./io.js").readGdlvl(w), s = require("./index_levels.js").songOf(L.rec, L.level.header);
    const sm = /^\/song\/(official|custom)\/(\w+)\.mp3$/.exec(s.url);
    if (sm) { const f = sm[1] === "official" ? path.join(GAME, "Resources", sm[2] + ".mp3")
      : (require("./songs.js").songFile(sm[2]) || [".mp3", ".ogg"].map(e => path.join(SAVE, sm[2] + e)).find(f => fs.existsSync(f)));
      if (f) song = { file: f, offset: s.offset || 0 }; }
    // Song triggers (GD 2.2: switch, seek, fade, stop mid-level; lib/music.js): every span with its own song file
    const M = require("../lib/music.js").MUSIC, GD = require("./io.js").GD;
    if (song && M.usesTriggers(L.level)) {
      if (!GD.SYNC) Object.assign(GD, require("../lib/sync.js"));
      const tl = GD.SYNC.timeline(GD.makeWorld(L.level.objects, L.level.header)), mu = M.parse(L.level); mu.main.offset = song.offset;
      const fileOf = id => id === "main" ? song.file : (require("./songs.js").songFile(String(id)) || [".mp3", ".ogg"].map(e => path.join(SAVE, id + e)).find(f => fs.existsSync(f)));
      song.music = M.spans(mu, x => GD.SYNC.tOfX(tl, x)).map(sp => Object.assign(sp, { file: fileOf(sp.song) }));
      for (const sp of song.music) if (!sp.file) console.log(`song ${sp.song} is not on this PC (node tools/songs.js ${sp.song}): silent from level ${sp.from.toFixed(1)} s`);
    }
  }
  if (song && !fs.existsSync(song.file)) song = null;
  return { lv, song, file: w };
}
// ffmpeg inputs + filter for a level whose song changes: each span cut from its song, its fades and volume ramps as a
// piecewise-linear volume (lib/music.js gain(), sampled at its corners and every 0.1 s inside a change), delayed to its
// level time and mixed. from0 = the video's first level second, dur = its length, first = the ffmpeg input index of the
// first song (1: the frames are input 0).
function musicArgs(spans, from0, dur, first = 1) {
  const M = require("../lib/music.js").MUSIC, inputs = [], parts = [];
  for (const s of spans) {
    if (!s.file || s.to <= from0) continue;
    let lf = Math.max(s.from, from0), off = s.songStart + (lf - s.from);
    if (off < 0) { lf -= off; off = 0; }
    const end = Math.min(s.to, from0 + dur); if (end <= lf) continue;
    const corners = new Set([lf, end]);
    const win = (a, b) => { for (let x = a; x < b; x += 0.1) if (x > lf && x < end) corners.add(x); corners.add(Math.min(end, Math.max(lf, b))); };
    if (s.fadeIn) win(s.from, s.from + s.fadeIn);
    for (const r of s.ramps) win(r.t, r.t + r.over);
    if (s.fadeOut && isFinite(s.to)) win(s.to - s.fadeOut, s.to);
    const pts = [...corners].filter(x => x >= lf && x <= end).sort((a, b) => a - b).map(x => [x - lf, M.gain(s, Math.min(x, end - 1e-6))]);
    let expr = String(pts[pts.length - 1][1].toFixed(4));
    for (let i = pts.length - 2; i >= 0; i--) { const [x0, v0] = pts[i], [x1, v1] = pts[i + 1]; if (x1 <= x0) continue;
      expr = `if(lt(t,${x1.toFixed(3)}),${v0.toFixed(4)}+(${(v1 - v0).toFixed(4)})*(t-${x0.toFixed(3)})/${(x1 - x0).toFixed(3)},${expr})`; }
    const k = inputs.length / 4 + first, ms = Math.round((lf - from0) * 1000);
    inputs.push("-ss", off.toFixed(3), "-i", s.file);
    parts.push(`[${k}:a]atrim=0:${(end - lf).toFixed(3)},asetpts=PTS-STARTPTS,volume=eval=frame:volume='${expr}',adelay=${ms}|${ms}[m${k}]`);
  }
  if (!parts.length) return null;
  const n = parts.length, labels = parts.map((p, i) => `[m${i + first}]`).join("");
  return { inputs, filter: parts.join(";") + `;${labels}amix=inputs=${n}:duration=longest:normalize=0,apad[aout]` };
}
function attempt(file, want) {
  const A = require("./attempts.js"), GD = require("../lib/gd.js");
  const base = (GD.attemptsBase || require("../lib/liveplay.js").attemptsBase)(file);
  const rows = A.read(base).filter(r => r.events && r.events.length);
  if (!rows.length) throw new Error(`no attempts with inputs for ${file} (local/attempts/${base}.jsonl)`);
  const r = want === "last" ? rows.reduce((a, b) => ((b.at || "") >= (a.at || "") ? b : a)) : rows.find(x => x.id === want);
  if (!r) throw new Error(`no attempt ${want}; there are: ` + rows.slice(-8).map(x => `${x.id} (${x.result === "clear" ? "clear" : "died " + Math.round(x.pct) + "%"})`).join(", "));
  return r;
}
function ff(a) { return cp.spawnSync(process.env.FFMPEG || "ffmpeg", a, { windowsHide: true, maxBuffer: 1 << 26 }); }

if (require.main === module) (async () => {
  const R = resolve(args[0]), run = opt("--run") ? attempt(args[0], opt("--run")) : null;   // inputs first: a wrong one fails before queueing
  await require("./heavy.js").claim();
  const fps = +(opt("--fps") || 60), [W, H] = (opt("--size") || "1280x720").split("x").map(Number);
  const video = { fps, from: opt("--from") != null ? +opt("--from") : 0, to: opt("--to") != null ? +opt("--to") : null };
  const id = "v" + Date.now().toString(36), dir = path.join(ROOT, "local", "shoot"); fs.mkdirSync(dir, { recursive: true });
  const job = { level: R.lv, art: true, width: W, height: H, video, run: run || undefined, ghost: run ? false : undefined };
  fs.writeFileSync(path.join(dir, id + ".json"), JSON.stringify(job));
  const t0 = Date.now();
  const r = await headless(`viewer/?shoot=${id}`, path.join(dir, id, ".done"), { port: +(opt("--port") || 8767), width: W, height: H, timeoutMs: 60 * 60e3, stallMs: 3 * 60e3 });
  const fdir = path.join(dir, id);
  let info = {}; try { info = JSON.parse(fs.readFileSync(path.join(fdir, ".done"), "utf8")); } catch (e) {}
  const frames = fs.existsSync(fdir) ? fs.readdirSync(fdir).filter(f => /^f\d+\.jpg$/.test(f)).length : 0;
  if (!r.ok || !frames) { console.error(`no frames (${r.ok ? "page finished" : r.stalled ? "no new frame for 3 min: the page hung" : "page timed out"}): open viewer/?shoot=${id} to see why`); process.exit(1); }
  const tRender = (Date.now() - t0) / 1000;
  const safe = s => String(s).replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "level";
  const out = opt("--out") ? path.resolve(opt("--out")) : path.join(ROOT, "local", "video", safe(R.lv.name) + (run ? "_run_" + run.id : "") + (video.from || video.to != null ? `_${video.from}-${info.to != null ? (+info.to).toFixed(1) : ""}s` : "") + ".mp4");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const dur = frames / fps;
  const enc = vb => {
    const a = ["-v", "error", "-y", "-framerate", String(fps), "-i", path.join(fdir, "f%05d.jpg")];
    if (R.song && R.song.music) { const m = musicArgs(R.song.music, info.from || 0, dur); if (m) a.push(...m.inputs, "-filter_complex", m.filter, "-map", "0:v", "-map", "[aout]", "-c:a", "aac", "-b:a", "160k", "-t", dur.toFixed(3)); }
    else if (R.song) a.push("-ss", String(R.song.offset + (info.from || 0)), "-i", R.song.file, "-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", "160k", "-af", "apad", "-t", dur.toFixed(3));   // the frames set the length: a song that ends before the end screen is padded with silence (-shortest cut Jumper's card off, 2026-11-25)
    a.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium");
    if (vb) a.push("-b:v", vb + "k", "-maxrate", Math.round(vb * 1.3) + "k", "-bufsize", Math.round(vb * 2) + "k"); else a.push("-crf", "22");
    a.push("-movflags", "+faststart", out);
    const q = ff(a); if (q.status !== 0) throw new Error("ffmpeg: " + String(q.stderr).slice(0, 300));
  };
  enc(null);
  let mb = fs.statSync(out).size / 1048576;
  if (mb > MAX_MB) { const vb = Math.floor(((MAX_MB - 1.5) * 8192) / dur - 160); enc(Math.max(300, vb)); mb = fs.statSync(out).size / 1048576; }
  // --clicks: the press / release clicks as a WAV, mixed under the song (or alone when there is none); the video is copied
  const ck = opt("--clicks");
  if (ck) {
    const C = require("../lib/clicks.js").CLICKS, sr = 48000, wf = path.join(fdir, "clicks.wav"), tmp = out.replace(/\.mp4$/, ".clicks.mp4");
    fs.writeFileSync(wf, Buffer.from(C.wav(C.track(C.KINDS.includes(ck) ? ck : "mouse", info.clicks || [], sr, dur), sr)));
    const a = ["-v", "error", "-y", "-i", out, "-i", wf];
    if (R.song) a.push("-filter_complex", "[0:a][1:a]amix=inputs=2:duration=first:normalize=0[a]", "-map", "0:v", "-map", "[a]");
    else a.push("-map", "0:v", "-map", "1:a");
    a.push("-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-t", dur.toFixed(3), "-movflags", "+faststart", tmp);
    const q = ff(a); if (q.status !== 0) console.error("--clicks: ffmpeg failed, the video has no clicks: " + String(q.stderr).slice(0, 300));
    else { fs.renameSync(tmp, out); mb = fs.statSync(out).size / 1048576; console.log(`clicks: ${(info.clicks || []).length} ${ck} clicks mixed in`); }
  }
  try { fs.rmSync(fdir, { recursive: true, force: true }); fs.unlinkSync(path.join(dir, id + ".json")); } catch (e) {}
  console.log(`${path.relative(ROOT, out)}: ${dur.toFixed(1)} s at ${fps} fps, ${W}x${H}, ${mb.toFixed(1)} MB` + (R.song ? `, song ${path.basename(R.song.file)} from ${(R.song.offset + (info.from || 0)).toFixed(2)} s` : ", no song found (silent)") +
    (run ? `, your run ${run.id} (${run.result === "clear" ? "clear" : "died " + Math.round(run.pct) + "%"})` : ", the saved route") + `; render ${tRender.toFixed(0)} s, total ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  // --vs-rec: a run recorded on video (its line's video.file and video.level_t = the video second of level tick 0, the
  // physics session's alignment) side by side with ours, same moments, 2 x 960x540, the recording's own sound
  if (args.includes("--vs-rec")) {
    if (!run || !run.video || !run.video.file || run.video.level_t == null) { console.error("--vs-rec needs --run <an attempt from a recording>"); process.exit(1); }
    const rec = path.join(process.env.GD_RECS || path.join(process.env.USERPROFILE || "", "Videos", "Captures"), run.video.file);
    if (!fs.existsSync(rec)) { console.error("recording not on this PC: " + rec); process.exit(1); }
    const vs = out.replace(/\.mp4$/, "_vs_rec.mp4"), ss = run.video.level_t + (info.from || 0);
    const q = ff(["-v", "error", "-y", "-i", out, "-ss", ss.toFixed(3), "-t", dur.toFixed(3), "-i", rec,
      "-filter_complex", `[0:v]scale=960:540,fps=${fps}[a];[1:v]scale=960:540,fps=${fps}[b];[a][b]hstack,drawtext=text='ours (viewer)':x=12:y=12:fontcolor=white:fontsize=22:box=1:boxcolor=black@0.6,drawtext=text='the game (your recording)':x=972:y=12:fontcolor=white:fontsize=22:box=1:boxcolor=black@0.6[v]`,
      "-map", "[v]", "-map", "1:a?", "-c:v", "libx264", "-preset", "medium", "-crf", "24", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", vs]);
    if (q.status !== 0) { console.error("side by side failed: " + String(q.stderr).slice(0, 300)); process.exit(1); }
    console.log(`${path.relative(ROOT, vs)}: side by side with ${run.video.file} from ${ss.toFixed(2)} s, ${(fs.statSync(vs).size / 1048576).toFixed(1)} MB`);
  }
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
module.exports = { resolve, musicArgs };
