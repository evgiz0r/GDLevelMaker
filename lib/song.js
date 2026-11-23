// GD.songPlayer(buf, audio) -- the level's song for the viewer and the phone page: an Audio-like player over a
// decoded AudioBuffer (Web Audio). Sample-exact: seeking is instant and lands where asked (an <audio> element
// seeking an mp3 lands late and keeps playing the old spot meanwhile; the viewer re-seeked every frame while
// a seek was pending, and "if i start from any place, the music starts getting bad", the user, 2026-11-23).
// The replay's clock reads currentTime, so picture and song cannot drift apart.
//   audio(): returns the AudioContext (created on first use, resumed on play)
//   p.currentTime (get/set, song seconds; may be negative: the song starts that much later), p.playbackRate,
//   p.play(), p.pause(), p.paused, p.running() -- true while the context's clock is moving (a context made
//   before any click stays suspended: then the caller keeps its own clock)
// One source node at a time: every seek, rate change or pause stops the old one first.
// Test: node tests/song_clock.js (a fake AudioContext).
(function (OUT) {
  "use strict";
  function songPlayer(buf, audio) {
    let src = null, off = 0, rate = 1, t0 = 0;
    const p = { paused: true, sources: 0 };
    const now = () => p.paused ? off : off + (audio().currentTime - t0) * rate;
    const stop = () => { if (src) { try { src.stop(); } catch (e) {} src.disconnect(); src = null; } };
    const start = () => {
      const a = audio(); if (a.resume && a.state !== "running") a.resume();
      src = a.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate; src.connect(a.destination); p.sources++;
      t0 = a.currentTime;
      if (off >= 0) src.start(0, Math.min(off, buf.duration)); else src.start(a.currentTime - off / rate, 0);
    };
    Object.defineProperty(p, "currentTime", { get: now, set(v) { const on = !p.paused; stop(); off = v; if (on) start(); } });
    Object.defineProperty(p, "playbackRate", { get: () => rate, set(v) { if (v === rate) return; const c = now(), on = !p.paused; stop(); off = c; rate = v; if (on) start(); } });
    p.play = () => { if (p.paused) { p.paused = false; start(); } return Promise.resolve(); };
    p.pause = () => { if (!p.paused) { off = now(); stop(); p.paused = true; } };
    p.running = () => !p.paused && audio().state === "running";
    return p;
  }
  OUT.songPlayer = songPlayer;
})(typeof module !== "undefined" ? module.exports : (window.GD = window.GD || {}));
