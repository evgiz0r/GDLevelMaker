// GD.MUSIC -- a level's music over time: the main song with its start offset, plus GD 2.2's Song triggers (1934:
// play a song on a channel, from a point, with fades) and Edit Song triggers (3605: stop a channel, change its
// volume). One model for the viewer (lib/song.js musicPlayer), the video (tools/video.js) and the builders
// (tools/make.js "music"). MUSIC.md: the keys, where they come from, what is checked and what is open.
//
//   parse(level)                      -> { main: {offset, fadeIn, fadeOut}, events: [...], skipped }   level = {header, objects}
//   spans(music, tOfX, opts)          -> [{ch, song, from, to, songStart, volume, fadeIn, fadeOut, ramps, loop, speed}]
//        song: "main" (the level's own song, channel 0) or a custom song id; from/to: level seconds; songStart: song second
//        playing at `from`. opts.end = level end in seconds (default Infinity).
//   gain(span, t)                     -> the span's volume at level second t (fades and volume ramps)
//   songAt(spans, t, ch = 0)          -> { song, sec } what channel ch plays at level second t (null: silence)
//   songs(spans)                      -> the custom song ids the level needs (for the record's k104)
//   objects(list, opts)               -> GD objects for make.js's spec "music" (see tools/make.js)
//   usesTriggers(level)               -> true when the level has any Song / Edit Song trigger
//
// Keys (from rated 2.2 levels on the PC and gdlib's property table, MUSIC.md "Keys"):
//   1934 Song: 392 song id, 432 channel (0 = the main song's channel), 406 volume (1), 404 speed, 408 start ms,
//              409 fade in ms, 410 end ms, 411 fade out ms, 413 loop, 399 prep (load only), 400 load prep (play the
//              prepped song), 13 preview, 10 0.5 / 421 1 / 422 0.5 (GD's defaults on every one)
//   3605 Edit Song: 432 channel, 417 stop, 418 change volume -> 406, 419 change speed -> 404, 10 duration s
// Only triggers fired by the player crossing their x are timed; spawn- (62) and touch-triggered (11) ones are counted
// in `skipped` (they fire from other triggers, which we do not follow here).
(function (OUT) {
  "use strict";
  const GD = OUT;
  const num = (p, k, d) => p && p[k] != null && p[k] !== "" ? +p[k] : d;

  function headerVal(header, k) { const m = new RegExp("(?:^|,)" + k + ",([-0-9.]+)").exec(header || ""); return m ? +m[1] : 0; }

  function parse(level) {
    const header = level.header || "";
    const main = { offset: headerVal(header, "kA13"), fadeIn: headerVal(header, "kA15") ? 1 : 0, fadeOut: headerVal(header, "kA16") ? 1 : 0 };
    const events = []; let skipped = 0;
    for (const o of level.objects || []) {
      if (o.id !== 1934 && o.id !== 3605) continue;
      const p = o.props || {};
      if (+p[62] === 1 || +p[11] === 1) { skipped++; continue; }
      const ch = num(p, 432, 0);
      if (o.id === 1934) events.push({ kind: "song", x: o.x, ch, song: num(p, 392, 0), volume: num(p, 406, 1), speed: num(p, 404, 0),
        start: num(p, 408, 0) / 1000, end: num(p, 410, 0) / 1000, fadeIn: num(p, 409, 0) / 1000, fadeOut: num(p, 411, 0) / 1000,
        loop: +p[413] === 1, prep: +p[399] === 1, loadPrep: +p[400] === 1 });
      else events.push({ kind: "edit", x: o.x, ch, stop: +p[417] === 1, changeVolume: +p[418] === 1, volume: num(p, 406, 1),
        changeSpeed: +p[419] === 1, speed: num(p, 404, 0), duration: num(p, 10, 0.5) });
    }
    events.sort((a, b) => a.x - b.x);
    return { main, events, skipped };
  }

  function usesTriggers(level) { return (level.objects || []).some(o => o.id === 1934 || o.id === 3605); }

  // the channels over time. A Song trigger replaces what its channel plays (channel 0 = the main song); prep only
  // loads, load prep plays what was prepped (its own fields win when it names a song). An end time cuts the span.
  function spans(music, tOfX, opts) {
    opts = opts || {};
    const END = opts.end != null ? opts.end : Infinity, out = [], cur = {}, prepped = {};
    const close = (ch, t) => { const s = cur[ch]; if (!s) return; s.to = Math.min(s.to, Math.max(s.from, t)); delete cur[ch]; };
    const m = music.main || {};
    if (opts.mainSong !== false) {
      cur[0] = { ch: 0, song: "main", from: 0, to: END, songStart: m.offset || 0, volume: 1, fadeIn: m.fadeIn || 0, fadeOut: 0, ramps: [], loop: false, speed: 0 };
      out.push(cur[0]);
    }
    for (const e of music.events) {
      const t = Math.max(0, tOfX(e.x));
      if (t >= END) break;
      if (e.kind === "song") {
        if (e.prep && !e.loadPrep) { prepped[e.ch] = e; continue; }
        const f = e.loadPrep && !e.song && prepped[e.ch] ? prepped[e.ch] : e;
        close(e.ch, t);
        if (!f.song) continue;
        const s = { ch: e.ch, song: f.song, from: t, to: END, songStart: f.start, volume: f.volume, fadeIn: f.fadeIn, fadeOut: f.fadeOut,
          ramps: [], loop: f.loop, speed: f.speed };
        if (f.end > f.start && !f.loop) s.to = Math.min(END, t + (f.end - f.start));
        out.push(s); cur[e.ch] = s;
      } else {
        const s = cur[e.ch]; if (!s) continue;
        if (e.stop) { close(e.ch, t); continue; }
        if (e.changeVolume) s.ramps.push({ t, to: e.volume, over: Math.max(0, e.duration) });
        if (e.changeSpeed) s.speedChanged = true;   // not modelled (MUSIC.md "Open")
      }
    }
    // the main song's end fade (kA16): GD fades the last second of the level
    if (m.fadeOut && out[0] && out[0].song === "main" && isFinite(out[0].to)) out[0].fadeOut = 1;
    return out.filter(s => s.to > s.from);
  }

  function gain(s, t) {
    if (t < s.from || t >= s.to) return 0;
    let v = s.volume;
    for (const r of s.ramps) if (t >= r.t) { const k = r.over > 0 ? Math.min(1, (t - r.t) / r.over) : 1, from = v; v = from + (r.to - from) * k; }
    if (s.fadeIn > 0 && t - s.from < s.fadeIn) v *= (t - s.from) / s.fadeIn;
    if (s.fadeOut > 0 && isFinite(s.to) && s.to - t < s.fadeOut) v *= Math.max(0, (s.to - t) / s.fadeOut);
    return v;
  }

  function songAt(list, t, ch) {
    ch = ch || 0; let best = null;
    for (const s of list) if (s.ch === ch && t >= s.from && t < s.to) best = s;
    return best ? { song: best.song, sec: best.songStart + (t - best.from), span: best } : null;
  }

  function songs(list) { return [...new Set(list.filter(s => s.song !== "main").map(s => s.song))]; }

  // spec "music" entries -> trigger objects. Each entry: {x, song, from (song s), to (song s), fadeIn, fadeOut (s), volume,
  // channel, prep (blocks before x for a prep trigger, default 0 = none)} or {x, stop: true, channel} or {x, volume, over, channel}.
  // A prep trigger loads the song early so the switch does not stall on loading (what rated levels do).
  function objects(list, opts) {
    const y = (opts && opts.y) || 1185, out = [];
    const base = { 13: 1, 36: 1, 421: 1, 422: 0.5 };
    for (const e of list) {
      const ch = e.channel || 0;
      if (e.song != null) {
        const p = Object.assign({}, base, { 392: e.song, 406: e.volume != null ? e.volume : 1, 10: 0.5 });
        if (e.from) p[408] = Math.round(e.from * 1000);
        if (e.to) p[410] = Math.round(e.to * 1000);
        if (e.fadeIn) p[409] = Math.round(e.fadeIn * 1000);
        if (e.fadeOut) p[411] = Math.round(e.fadeOut * 1000);
        if (e.loop) p[413] = 1;
        if (ch) p[432] = ch;
        if (e.prep) { out.push({ id: 1934, x: e.x - e.prep * 30, y, props: Object.assign({}, p, { 399: 1 }) }); p[400] = 1; }
        out.push({ id: 1934, x: e.x, y, props: p });
      } else {
        const p = { 36: 1, 421: 1, 422: 0.5 };
        if (ch) p[432] = ch;
        if (e.stop) p[417] = 1;
        else if (e.volume != null) { p[418] = 1; p[406] = e.volume; p[10] = e.over != null ? e.over : 0.5; }
        out.push({ id: 3605, x: e.x, y, props: p });
      }
    }
    return out;
  }

  GD.MUSIC = { parse, spans, gain, songAt, songs, objects, usesTriggers };
})(typeof module !== "undefined" ? module.exports : (window.GD = window.GD || {}));
