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
  // GD.musicPlayer(spans, bufOf, audio, base) -- the same interface over a level whose song changes (lib/music.js spans:
  // Song triggers switching, seeking, fading, stopping). Its clock is the MAIN song's clock as if it never changed,
  // currentTime = base + level time (base = the level's kA13 offset), so the viewer's frame loop reads it as before.
  // On play / seek every span still ahead is scheduled at once: a buffer source starting at its level time, with a gain
  // node carrying its fades and volume ramps (sampled every 50 ms). bufOf(song) -> AudioBuffer or null (not loaded:
  // that span is silent until the player is rebuilt). Test: node tests/music.js.
  function musicPlayer(spans, bufOf, audio, base) {
    const M = (typeof module !== "undefined" ? require("./music.js") : OUT).MUSIC;
    let nodes = [], off = 0, rate = 1, t0 = 0;
    const p = { paused: true, sources: 0, spans };
    const now = () => p.paused ? off : off + (audio().currentTime - t0) * rate;
    const stop = () => { for (const n of nodes) { try { n.src.stop(); } catch (e) {} n.src.disconnect(); if (n.g) n.g.disconnect(); } nodes = []; };
    const start = () => {
      const a = audio(); if (a.resume && a.state !== "running") a.resume();
      t0 = a.currentTime; const lt = off - base;
      for (const s of spans) {
        if (s.to <= lt) continue;
        const buf = bufOf(s.song); if (!buf) continue;
        let from = Math.max(lt, s.from), songOff = s.songStart + (from - s.from);
        if (songOff < 0) { from -= songOff; songOff = 0; }   // the song starts later than the level (negative offset)
        if (from >= s.to) continue;
        const src = a.createBufferSource(); src.buffer = buf; src.playbackRate.value = rate;
        const g = a.createGain ? a.createGain() : null;
        if (g) { src.connect(g); g.connect(a.destination); } else src.connect(a.destination);
        const at = lt2 => t0 + (lt2 - lt) / rate;
        if (g) {   // the envelope: fades and ramps, as lib/music.js gain() has it
          const end = isFinite(s.to) ? s.to : from + Math.max(2, s.fadeIn + 1, ...s.ramps.map(r => r.t + r.over - from));
          g.gain.setValueAtTime(M.gain(s, from), at(from));
          const bend = isFinite(s.to) ? Math.min(end, from + 600) : end;
          for (let x = from + 0.05; x < bend; x += 0.05) g.gain.linearRampToValueAtTime(M.gain(s, x), at(x));
        }
        if (s.loop) { src.loop = true; src.loopStart = s.songStart; }
        src.start(at(from), Math.min(songOff, buf.duration), isFinite(s.to) && !s.loop ? Math.max(0, s.to - from) : undefined);
        if (isFinite(s.to) && s.loop) src.stop(at(s.to));
        nodes.push({ src, g }); p.sources++;
      }
    };
    Object.defineProperty(p, "currentTime", { get: now, set(v) { const on = !p.paused; stop(); off = v; if (on) start(); } });
    Object.defineProperty(p, "playbackRate", { get: () => rate, set(v) { if (v === rate) return; const c = now(), on = !p.paused; stop(); off = c; rate = v; if (on) start(); } });
    p.play = () => { if (p.paused) { p.paused = false; start(); } return Promise.resolve(); };
    p.pause = () => { if (!p.paused) { off = now(); stop(); p.paused = true; } };
    p.running = () => !p.paused && audio().state === "running";
    p.live = () => nodes.length;
    return p;
  }
  OUT.songPlayer = songPlayer;
  OUT.musicPlayer = musicPlayer;
})(typeof module !== "undefined" ? module.exports : (window.GD = window.GD || {}));
