// node tests/music.js  -- a level's music over time (lib/music.js, MUSIC.md): the song offset and GD 2.2 Song / Edit Song
// triggers. Checks: parsing triggers written the way rated 2.2 levels write them (prep + load prep, start/end/fades in ms,
// channels, Edit Song stop and volume); the spans (switch, seek, stop, volume ramp, prep does not play); level beats
// that count on through a switched song's own grid (lib/sync.js beatToTimeSegs, equal to beatToTime with one song);
// make.js "music" -> triggers, k104 and beats after the switch; the viewer's musicPlayer schedules each span once at
// the right moment and song second (a fake AudioContext); video.js's ffmpeg mix (and, when ffmpeg is here, runs it).
Object.assign(require("../tools/io.js").GD, require("../lib/sync.js"));
const GD = require("../tools/io.js").GD, M = require("../lib/music.js").MUSIC, { musicPlayer } = require("../lib/song.js");
let bad = 0; const check = (ok, what) => { console.log((ok ? "ok   " : "FAIL ") + what); if (!ok) bad++; };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

// ---- parse + spans: 1 block = 30 units, 300 units/s (a constant speed timeline)
const V = 300, tOfX = x => x / V;
const lvl = GD.parseLevel("kA13,12.5,kA15,1,kA16,0;" + [
  "1,1934,2,300,3,1125,13,1,36,1,392,555,406,1,408,40000,421,1,422,0.5,10,0.5,399,1",           // prep at 1 s: loads only
  "1,1934,2,1500,3,1125,13,1,36,1,392,555,406,1,408,40000,409,500,421,1,422,0.5,10,0.5,400,1",  // load prep at 5 s: plays 555 from 40 s
  "1,3605,2,2400,3,1125,36,1,406,0.25,418,1,421,1,422,0.5,10,2",                               // 8 s: volume to 0.25 over 2 s
  "1,1934,2,3000,3,1125,13,1,36,1,392,777,406,1,408,1000,410,4000,421,1,422,0.5,10,0.5,432,2",  // 10 s, channel 2: 777 1-4 s
  "1,3605,2,3600,3,1125,36,1,417,1,421,1,422,0.5",                                             // 12 s: stop channel 0
  "1,1934,2,4500,3,1125,62,1,36,1,392,999,406,1",                                              // spawn-triggered: skipped
].join(";") + ";");
const mu = M.parse(lvl);
check(mu.main.offset === 12.5 && mu.main.fadeIn === 1, "header: offset kA13 12.5, fade in kA15");
check(mu.events.length === 5 && mu.skipped === 1, `5 timed triggers, 1 spawn-triggered skipped (${mu.events.length}, ${mu.skipped})`);
const sp = M.spans(mu, tOfX, { end: 20 });
const main = sp.find(s => s.song === "main"), s555 = sp.find(s => s.song === 555), s777 = sp.find(s => s.song === 777);
check(main && near(main.from, 0) && near(main.to, 5) && near(main.songStart, 12.5), "main song from its offset, cut at the switch (5 s)");
check(s555 && near(s555.from, 5) && near(s555.songStart, 40) && near(s555.fadeIn, 0.5) && near(s555.to, 12), "load prep plays 555 from 40 s with a 0.5 s fade in, stopped at 12 s");
check(!sp.some(s => s.song === 555 && near(s.from, 1)), "the prep trigger alone plays nothing");
check(s777 && s777.ch === 2 && near(s777.from, 10) && near(s777.to, 13), "channel 2 plays 777 from 1 s to 4 s (3 s long) on top");
check(near(M.gain(s555, 5.25), 0.5) && near(M.gain(s555, 8), 1) && near(M.gain(s555, 9), 0.625) && near(M.gain(s555, 11), 0.25), "gain: fade in, then the Edit Song ramp to 0.25 over 2 s");
const at = M.songAt(sp, 7); check(at && at.song === 555 && near(at.sec, 42), "songAt 7 s = song 555 at 42 s");
check(M.songAt(sp, 12.5) === null, "after the stop channel 0 is silent");
check(JSON.stringify(M.songs(sp)) === "[555,777]", "songs the level needs: 555, 777");

// ---- beats through a switch
const g1 = { period: 0.5, t0: 0.1 }, g2 = { period: 0.4, t0: 0.05 };
let same = true;
for (const b of [1, 2.5, 17, 40]) same = same && near(GD.SYNC.beatToTimeSegs([{ from: 0, grid: g1, songStart: 3.3 }], b), GD.SYNC.beatToTime(g1, 3.3, b));
for (const t of [0, 1.234, 9]) same = same && near(GD.SYNC.timeToBeatSegs([{ from: 0, grid: g1, songStart: 3.3 }], t), GD.SYNC.timeToBeat(g1, 3.3, t));
check(same, "one segment = beatToTime / timeToBeat exactly");
const segs = [{ from: 0, grid: g1, songStart: 0 }, { from: 2, grid: g2, songStart: 10 }];
// song 1 beats at 0.1, 0.6, 1.1, 1.6 (4 before 2 s); song 2 from 10 s: beats at 10.05+0.4k >= 10 -> 10.05 = level 2.05
check(near(GD.SYNC.beatToTimeSegs(segs, 4), 1.6) && near(GD.SYNC.beatToTimeSegs(segs, 5), 2.05) && near(GD.SYNC.beatToTimeSegs(segs, 6), 2.45), "beat 5 is the new song's first beat after the switch");
check(near(GD.SYNC.timeToBeatSegs(segs, 2.45), 6) && near(GD.SYNC.timeToBeatSegs(segs, 1.1), 3), "timeToBeatSegs inverts it");

// ---- make.js "music"
const mk = require("../tools/make.js");
const spec = { name: "GDLM music test", song: { custom: 111 }, grid: { bpm: 120, t0: 0 }, offset: 0, signature: false,
  music: [{ at: "b9", song: 222, from: 30, fadeIn: 0.2, grid: { bpm: 150, t0: 0 } }, { at: "t9", volume: 0.3, over: 1 }, { at: "t11", song: "main", from: 60, prep: 0 }],
  objects: [["block", 10, 0], ["spike", "b12", 0]] };
const B = mk.build(spec, "test");
const trig = B.level.objects.filter(o => o.id === 1934), edits = B.level.objects.filter(o => o.id === 3605);
check(trig.length === 3 && edits.length === 1, `2 song switches -> 3 Song triggers (one prep), 1 Edit Song (${trig.length}, ${edits.length})`);
const load = trig.find(o => +o.props[392] === 222 && +o.props[400] === 1), prep = trig.find(o => +o.props[392] === 222 && +o.props[399] === 1);
const tl = GD.SYNC.timeline(GD.makeWorld(B.level.objects, B.level.header));
check(load && near(GD.SYNC.tOfX(tl, load.x), 4, 1e-3) && +load.props[408] === 30000 && +load.props[409] === 200, "switch at beat 9 (4 s), from 30 000 ms, fade in 200 ms");
check(prep && prep.x < load.x && near(GD.SYNC.tOfX(tl, load.x) - GD.SYNC.tOfX(tl, prep.x), 2, 1e-3), "its prep trigger 2 s before");
check(trig.some(o => +o.props[392] === 111 && +o.props[408] === 60000 && !o.props[399]), '"song": "main" = a seek in the main song (no prep with prep: 0)');
check(+edits[0].props[418] === 1 && +edits[0].props[406] === 0.3 && +edits[0].props[10] === 1, "Edit Song: change volume to 0.3 over 1 s");
check(GD.getField(B.rec, "k104") === "111,222", "record k104 lists both songs");
// beat 12 after the switch at beat 9 (4 s): song 222 at 150 BPM from 30 s: its beat at 30 s is beat 9, then 9.4 ... -> beat 12 at 5.2 s
const spike = B.level.objects.find(o => o.id === 8);
check(spike && near(GD.SYNC.tOfX(tl, spike.x), 5.2, 0.05), `"b12" after the switch uses the new song's beats (${spike && GD.SYNC.tOfX(tl, spike.x).toFixed(3)} s, want 5.2)`);
const back = M.spans(M.parse(GD.parseLevel(GD.serializeLevel(B.level))), x => GD.SYNC.tOfX(tl, x));
check(back.length === 3 && back[1].song === 222 && near(back[1].from, 4, 1e-3) && near(back[2].songStart, 60), "the written level reads back as main -> 222 -> main at 60 s");

// ---- the viewer's player (fake AudioContext)
function fakeCtx() {
  const ctx = { currentTime: 100, state: "running", destination: {}, started: [] };
  ctx.createBufferSource = () => { const n = { playbackRate: { value: 1 }, connect() {}, disconnect() {}, start(when, off, dur) { ctx.started.push({ n, when, off, dur }); }, stop() { n.stopped = true; } }; return n; };
  ctx.createGain = () => ({ gain: { pts: [], setValueAtTime(v, t) { this.pts.push([t, v]); }, linearRampToValueAtTime(v, t) { this.pts.push([t, v]); } }, connect() {}, disconnect() {} });
  return ctx;
}
const ctx = fakeCtx(), bufs = { main: { duration: 200 }, 555: { duration: 200 }, 777: { duration: 200 } };
const p = musicPlayer(sp, id => bufs[id], () => ctx, 12.5);
p.currentTime = 12.5 + 3; p.play();
const st = ctx.started;
check(st.length === 3, `play at level 3 s schedules the 3 spans still ahead (${st.length})`);
const a0 = st.find(s => near(s.off, 15.5)), a1 = st.find(s => near(s.off, 40)), a2 = st.find(s => near(s.off, 1));
check(a0 && near(a0.when, 100) && near(a0.dur, 2), "main: now, from song 15.5 s, for 2 s");
check(a1 && near(a1.when, 102) && near(a1.dur, 7), "555: in 2 s, from 40 s, for 7 s");
check(a2 && near(a2.when, 107) && near(a2.dur, 3), "777: in 7 s, from 1 s, for 3 s");
ctx.currentTime = 101; check(near(p.currentTime, 16.5), "the clock is the main song's (offset + level time)");
p.currentTime = 12.5 + 6; check(st.slice(0, 3).every(s => s.n.stopped) && st.length === 5, "a seek stops every source and schedules again (2 ahead from 6 s)");
p.pause(); check(st.every(s => s.n.stopped), "pause stops them all");

// ---- video.js's mix
const V2 = require("../tools/video.js");
const fsp = require("fs"), os = require("os"), path = require("path");
const files = sp.map(s => Object.assign({}, s, { file: "/x/" + s.song + ".mp3" }));
const mix = V2.musicArgs(files, 3, 12);
check(mix && mix.inputs.filter(x => x === "-i").length === 3 && /amix=inputs=3/.test(mix.filter) && /adelay=2000\|2000/.test(mix.filter), "video: 3 inputs, 555 delayed 2 s, mixed");
const ff = require("child_process").spawnSync("ffmpeg", ["-version"], { windowsHide: true });
if (ff.status === 0) {
  const dir = fsp.mkdtempSync(path.join(os.tmpdir(), "music-")), tone = (f, hz) => require("child_process").spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `sine=frequency=${hz}:duration=60`, f], { windowsHide: true });
  const real = sp.map(s => Object.assign({}, s, { file: path.join(dir, s.song + ".wav") }));
  for (const [i, s] of real.entries()) tone(s.file, 300 + i * 200);
  const m = V2.musicArgs(real, 0, 14, 0), out = path.join(dir, "out.wav");
  const r = require("child_process").spawnSync("ffmpeg", ["-v", "error", "-y", ...m.inputs, "-filter_complex", m.filter, "-map", "[aout]", "-t", "14", out], { windowsHide: true });
  check(r.status === 0 && fsp.statSync(out).size > 100000, "ffmpeg runs the mix" + (r.status ? ": " + String(r.stderr).slice(0, 200) : ""));
} else console.log("skip ffmpeg run (not installed)");

console.log(bad ? `${bad} FAILED` : "all ok");
process.exit(bad ? 1 : 0);
