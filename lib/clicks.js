// GD.CLICKS -- click sounds for route replays, like the click-sound bots players use (the user, 2026-11-25: "can we do the
// click sound as a keyboard/mouse click?"). Self-made: every sample is synthesised here from seeded noise and decaying
// tones (no recorded or third-party audio), so it can ship in git, on the phone page and the public site.
//   GD.CLICKS.KINDS                       ["mouse", "keyboard"]
//   GD.CLICKS.samples(kind, sr)           -> { down: [Float32Array x4], up: [Float32Array x4] }: four takes each, so a
//                                            fast chain does not sound like one sample repeated
//   GD.CLICKS.track(kind, clicks, sr, dur) -> Float32Array, `dur` seconds: each {t (s), type: "press"|"release"} mixed in
//                                            (tools/video.js writes it as a WAV and mixes it under the song)
//   GD.CLICKS.wav(float32, sr)            -> a 16-bit mono WAV as bytes (Uint8Array)
// The viewer (viewer/index.html) plays them through Web Audio; the old square-wave beep stays as the kind "beep".
(function (OUT) {
  "use strict";
  const KINDS = ["mouse", "keyboard"];
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296 * 2 - 1; }; }
  // RBJ biquad, in place
  function biquad(x, sr, type, f, q) {
    const w = 2 * Math.PI * f / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * q);
    let b0, b1, b2; const a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
    if (type === "lp") { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; }
    else if (type === "hp") { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; }
    else { b0 = al; b1 = 0; b2 = -al; }   // band-pass
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) { const y = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x[i]; y2 = y1; y1 = y; x[i] = y; }
    return x;
  }
  function norm(x, peak) { let m = 0; for (const v of x) m = Math.max(m, Math.abs(v)); if (m) for (let i = 0; i < x.length; i++) x[i] *= peak / m; return x; }
  // one take: a noise transient through a band, plus a short resonant "body" (the switch / the keycap)
  function take(sr, o, seed) {
    const r = rng(seed), n = Math.round(sr * o.len), x = new Float32Array(n), j = 1 + r() * 0.06;   // +-6 % pitch per take
    for (let i = 0; i < n; i++) { const t = i / sr; x[i] = r() * Math.exp(-t / o.noiseDecay); }
    biquad(x, sr, "bp", o.band * j, o.q); if (o.hp) biquad(x, sr, "hp", o.hp, 0.7);
    norm(x, 1);
    for (const b of o.body) for (let i = 0; i < n; i++) { const t = i / sr; x[i] += b.amp * Math.sin(2 * Math.PI * b.f * j * t) * Math.exp(-t / b.decay); }
    if (o.second) { const d = Math.round(sr * o.second.at), y = take(sr, Object.assign({}, o, { second: null, len: o.len - o.second.at }), seed + 7);
      for (let i = 0; i < y.length && d + i < n; i++) x[d + i] += y[i] * o.second.amp; }
    for (let i = 0; i < Math.min(n, 24); i++) x[i] *= i / 24;                          // no step at the start
    for (let i = 0; i < Math.min(n, 64); i++) x[n - 1 - i] *= i / 64;                  // nor at the end
    return norm(x, o.peak);
  }
  const SPEC = {
    // a mouse button: a hard, very short tick (the microswitch), the release a little higher and softer
    mouse: { down: { len: 0.035, noiseDecay: 0.0016, band: 4200, q: 1.4, hp: 900, body: [{ f: 2600, amp: 0.35, decay: 0.004 }, { f: 5200, amp: 0.15, decay: 0.002 }], peak: 0.9 },
             up:   { len: 0.03, noiseDecay: 0.0012, band: 5200, q: 1.6, hp: 1200, body: [{ f: 3100, amp: 0.3, decay: 0.003 }], peak: 0.55 } },
    // a mechanical key: the switch click, the cap bottoming out a few ms later (a lower "thock"), the release a light clack
    keyboard: { down: { len: 0.07, noiseDecay: 0.003, band: 2600, q: 0.9, hp: 300, body: [{ f: 420, amp: 0.55, decay: 0.012 }, { f: 1500, amp: 0.25, decay: 0.006 }], second: { at: 0.006, amp: 0.6 }, peak: 0.9 },
                up:   { len: 0.05, noiseDecay: 0.002, band: 3400, q: 1.1, hp: 500, body: [{ f: 620, amp: 0.3, decay: 0.008 }], peak: 0.5 } },
  };
  const CACHE = {};
  function samples(kind, sr) {
    const k = SPEC[kind] ? kind : "mouse", key = k + sr;
    if (!CACHE[key]) CACHE[key] = { down: [0, 1, 2, 3].map(i => take(sr, SPEC[k].down, 11 + i * 101)), up: [0, 1, 2, 3].map(i => take(sr, SPEC[k].up, 5003 + i * 97)) };
    return CACHE[key];
  }
  function track(kind, clicks, sr, dur, gain = 0.8) {
    const out = new Float32Array(Math.max(1, Math.round(dur * sr))), S = samples(kind, sr); let nd = 0, nu = 0;
    for (const c of clicks || []) {
      const s = c.type === "release" ? S.up[nu++ % 4] : S.down[nd++ % 4], at = Math.round(c.t * sr);
      for (let i = 0; i < s.length; i++) { const k = at + i; if (k >= 0 && k < out.length) out[k] += s[i] * gain; }
    }
    for (let i = 0; i < out.length; i++) out[i] = Math.max(-1, Math.min(1, out[i]));
    return out;
  }
  function wav(x, sr) {
    const b = new Uint8Array(44 + x.length * 2), v = new DataView(b.buffer), w = (o, s) => { for (let i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i); };
    w(0, "RIFF"); v.setUint32(4, 36 + x.length * 2, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, x.length * 2, true);
    for (let i = 0; i < x.length; i++) v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, x[i])) * 32767), true);
    return b;
  }
  OUT.CLICKS = { KINDS, samples, track, wav };
})(typeof module !== "undefined" ? module.exports : (window.GD = window.GD || {}));
