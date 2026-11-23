// node tests/song_clock.js  -- the viewer's song clock (lib/song.js) stays exact through seeks: "if i start from
// any place, the music starts getting bad" (the user, 2026-11-23). A fake AudioContext whose clock advances in
// 128-sample steps with jittery frame times. (The viewer advances by frame time and pulls a tenth of the gap
// to this clock each frame, since the stepped audio clock alone stuttered; this checks the clock it pulls to.)
// Checks, starting at 10, 25 and 40 s (and a negative song offset): the clock stays within 20 ms of the true song
// position over 10 s, every seek / rate change leaves exactly ONE source node playing (no overlapping audio),
// pause stops the node, and a suspended context (no click yet) is reported as not running.
const { songPlayer } = require("../lib/song.js");
let bad = 0; const check = (ok, what) => { console.log((ok ? "ok   " : "FAIL ") + what); if (!ok) bad++; };
function fakeCtx() {
  const ctx = { currentTime: 0, state: "running", destination: {}, live: 0, started: [] };
  ctx.resume = () => { ctx.state = "running"; };
  ctx.createBufferSource = () => {
    const n = { playbackRate: { value: 1 }, connect() {}, disconnect() {}, on: false };
    n.start = (when, offset) => { n.on = true; ctx.live++; ctx.started.push({ when, offset, at: ctx.currentTime }); };
    n.stop = () => { if (n.on) { n.on = false; ctx.live--; } };
    return n;
  };
  // where the real audio is: the source that started last, at its offset + elapsed * rate
  ctx.truePos = rate => { const s = ctx.started[ctx.started.length - 1]; return s.offset + (ctx.currentTime - Math.max(s.at, s.when)) * rate; };
  ctx.advance = sec => { const q = 128 / 44100; ctx.currentTime = Math.floor((ctx.currentTime + sec) / q) * q; };
  return ctx;
}
const buf = { duration: 180 };
for (const start of [10, 25, 40]) {
  const ctx = fakeCtx(), p = songPlayer(buf, () => ctx), offset = 3.2;
  p.currentTime = offset + start; p.play();
  let worst = 0, t = 0;
  for (let f = 0; f < 600; f++) {                     // ~10 s of frames at a jittery 60 fps
    ctx.advance(1 / 60 + (Math.random() - 0.5) * 0.006);
    t = p.currentTime - offset;                       // the viewer's frame(): t = song clock - song offset
    worst = Math.max(worst, Math.abs((t + offset) - ctx.truePos(1)));
  }
  check(worst < 0.02 && Math.abs(t - (start + ctx.currentTime)) < 0.05, `start at ${start} s: worst drift ${(worst * 1000).toFixed(1)} ms over 10 s, ended at ${t.toFixed(2)} s`);
  check(ctx.live === 1, `start at ${start} s: one source node playing (${ctx.live})`);
  p.currentTime = start + 5; p.currentTime = start + 6; p.playbackRate = 0.5;   // seeks and a speed change
  check(ctx.live === 1, `after two seeks and a rate change: one source node (${ctx.live})`);
  p.pause(); check(ctx.live === 0 && p.paused, "pause stops it");
}
{ // a song that starts after the level does (negative position): the node is scheduled, the clock still runs
  const ctx = fakeCtx(), p = songPlayer(buf, () => ctx);
  p.currentTime = -0.5; p.play(); ctx.advance(1);
  check(Math.abs(p.currentTime - 0.5) < 0.01 && ctx.started[0].when > 0, `negative start: clock ${p.currentTime.toFixed(3)} s after 1 s, node scheduled at ${ctx.started[0].when.toFixed(2)} s`);
}
{ // a context made before any click is suspended: the viewer must keep its own clock then
  const ctx = fakeCtx(); ctx.state = "suspended"; ctx.resume = () => {};
  const p = songPlayer(buf, () => ctx); p.play();
  check(!p.running(), "suspended context: running() is false, so the replay keeps its frame clock");
}
console.log(bad ? `${bad} failed` : "all passed"); process.exit(bad ? 1 : 0);
