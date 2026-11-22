// How a level LOOKS in the game, roughly: colour channels from the header, colour / alpha / zoom
// triggers over time, and drawing helpers for the viewer (background, middleground hills, ground,
// block skins, spikes, decoration). No game art: shapes are drawn to match frames of the user's
// own play (GDLM 41 / 42 recording, 2026-11-22), not copied from GD's sprite sheets.
// The timeline part runs in node too (tests); the drawing part needs a canvas.
(function (GD) {
  "use strict";
  const O = (typeof module !== "undefined" && typeof require !== "undefined") ? require("./objects.js") : GD;

  // ---- colour channels ----
  // 1000 bg, 1001 ground, 1009 ground 2, 1002 line, 1004 obj, 1005/1006 player 1/2,
  // 1013/1014 middleground 1/2. 1010 is "black" and 1011 "white" whatever the header says.
  const DEFAULT = { 1000: [40, 125, 255], 1001: [0, 102, 255], 1009: [0, 102, 255], 1002: [255, 255, 255], 1004: [255, 255, 255],
    1005: [125, 255, 0], 1006: [0, 255, 255], 1013: [107, 100, 193], 1014: [125, 176, 193], 1010: [0, 0, 0], 1011: [255, 255, 255] };
  function headerMap(header) {
    const kv = String(header || "").split(","), m = {};
    for (let i = 0; i + 1 < kv.length; i += 2) m[kv[i]] = kv[i + 1];
    return m;
  }
  // start colour of every channel the header lists (kS38 = "1_r_2_g_3_b_..._6_channel|..."),
  // with the 1.x-era kS1..kS6 (bg / ground rgb) as a fallback
  function headerColours(header) {
    const h = headerMap(header), col = {};
    for (const k in DEFAULT) col[k] = DEFAULT[k].slice();
    if (h.kS1 != null) col[1000] = [+h.kS1, +h.kS2, +h.kS3];
    if (h.kS4 != null) col[1001] = [+h.kS4, +h.kS5, +h.kS6];
    for (const c of String(h.kS38 || "").split("|")) {
      if (!c) continue;
      const p = c.split("_"), f = {};
      for (let i = 0; i + 1 < p.length; i += 2) f[p[i]] = p[i + 1];
      if (f[6] == null) continue;
      col[+f[6]] = [+f[1] || 0, +f[2] || 0, +f[3] || 0];
    }
    col[1010] = [0, 0, 0]; col[1011] = [255, 255, 255];
    return col;
  }

  // ---- triggers ----
  // colour 899 (7/8/9 rgb, 10 seconds, 23 channel); the 1.x ones carry their channel in the id
  const OLD_COLOUR = { 29: 1000, 30: 1001, 105: 1004, 900: 1009, 915: 1002 };
  // fireAt(x) -> level seconds when the player passes x, or Infinity (never reached)
  function timeline(level, fireAt) {
    const tl = { start: headerColours(level.header), colour: {}, alpha: {}, zoom: [] };
    const push = (list, key, ev) => { (list[key] = list[key] || []).push(ev); };
    for (const o of level.objects) {
      const p = o.props || {};
      if (p[62] === "1") continue; // spawn-triggered: fired by another trigger, not by position
      const ch = o.id === 899 ? +(p[23] || 1) : OLD_COLOUR[o.id];
      const id = o.id;
      if (!(ch || id === 1007 || id === 1913)) continue;
      const t = fireAt(o.x);
      if (!isFinite(t)) continue;
      const dur = Math.max(0, +(p[10] || 0));
      if (ch) push(tl.colour, ch, { t, dur, to: [+(p[7] || 0), +(p[8] || 0), +(p[9] || 0)] });
      else if (id === 1007) push(tl.alpha, +(p[51] || 0), { t, dur, to: [p[35] == null ? 1 : +p[35]] });
      else tl.zoom.push({ t, dur, to: [+(p[371] || 1)] });
    }
    const byT = (a, b) => a.t - b.t;
    for (const k in tl.colour) tl.colour[k].sort(byT);
    for (const k in tl.alpha) tl.alpha[k].sort(byT);
    tl.zoom.sort(byT);
    return tl;
  }
  // the value of one channel at time t: each trigger fades from wherever the last one had got to
  function valueAt(start, events, t) {
    let from = start, to = start, t0 = -1, dur = 0;
    const at = (tt) => {
      const k = dur <= 0 ? 1 : Math.min(1, Math.max(0, (tt - t0) / dur));
      return from.map((v, i) => v + (to[i] - v) * k);
    };
    for (const e of events || []) {
      if (e.t > t) break;
      from = at(e.t); to = e.to; t0 = e.t; dur = e.dur;
    }
    return t0 < 0 ? start : at(t);
  }
  function stateAt(tl, t) {
    const col = {};
    for (const k in tl.start) col[k] = tl.colour[k] ? valueAt(tl.start[k], tl.colour[k], t) : tl.start[k];
    for (const k in tl.colour) if (!col[k]) col[k] = valueAt([255, 255, 255], tl.colour[k], t);
    const alpha = {};
    for (const g in tl.alpha) alpha[g] = valueAt([1], tl.alpha[g], t)[0];
    return { col, alpha, zoom: valueAt([1], tl.zoom, t)[0] };
  }
  // an object's opacity from its groups (key 57, dot-separated); several groups multiply
  function objAlpha(o, alpha) {
    const g = o.props && o.props[57];
    if (!g) return 1;
    let a = 1;
    for (const id of String(g).split(".")) if (alpha[id] != null) a *= alpha[id];
    return a;
  }

  // ---- block skins 1-7: which sides carry the outline ----
  // Unrotated: 1 all four, 2 the top, 3 top + left, 4 the top-left corner only, 5 none (fill),
  // 6 top + right + left, 7 right + left. Flips swap sides, then the rotation (clockwise) turns
  // them -- the inverse of tools/decorate.js SKIN, so a decorated level outlines exactly its outside.
  const SKIN_EDGES = { 1: "URDL", 2: "U", 3: "UL", 4: "", 5: "", 6: "URL", 7: "RL" };
  const CW = { U: "R", R: "D", D: "L", L: "U" };
  function edges(o) {
    let e = (SKIN_EDGES[o.id] || "").split("");
    if (o.flipX) e = e.map(s => ({ L: "R", R: "L" })[s] || s);
    if (o.flipY) e = e.map(s => ({ U: "D", D: "U" })[s] || s);
    let r = Math.round(((o.rot || 0) % 360 + 360) % 360 / 90) % 4;
    while (r-- > 0) e = e.map(s => CW[s]);
    return e;
  }
  const isSkin = id => id >= 1 && id <= 7;

  // ---- drawing (browser) ----
  const css = (c, a = 1, k = 1) => `rgba(${Math.round(Math.min(255, c[0] * k))},${Math.round(Math.min(255, c[1] * k))},${Math.round(Math.min(255, c[2] * k))},${a})`;
  const mix = (c, d, k) => c.map((v, i) => v + (d[i] - v) * k);

  // background art: a dark sky with big pixel-edged bright blobs (what the user's level shows,
  // bg art 57), tinted by channel 1000. Masks made once at low resolution and scaled up unsmoothed.
  let masks = null;
  function makeMasks() {
    const N = 96;
    const mk = () => { const c = document.createElement("canvas"); c.width = c.height = N; return c; };
    const mid = mk(), bright = mk();
    const mx = mid.getContext("2d"), bx = bright.getContext("2d");
    const md = mx.createImageData(N, N), bd = bx.createImageData(N, N);
    let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const wob = []; for (let i = 0; i < 12; i++) wob.push([rnd() * 6.28, 1 + Math.floor(rnd() * 4), rnd()]);
    const r = (a, base, amp) => base * (1 + amp * wob.reduce((v, [ph, f, w]) => v + Math.sin(a * f + ph) * w, 0) / 6);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = (y * N + x) * 4;
      // the blob is wrapped horizontally so the tile repeats
      let best = 9;
      for (const ox of [-N, 0, N]) {
        const dx = (x - (N * 0.42 + ox)) / N, dy = (y - N * 0.56) / N;
        const a = Math.atan2(dy, dx), d = Math.hypot(dx / 0.72, dy);
        best = Math.min(best, d / r(a, 0.27, 0.3));
      }
      md.data[i + 3] = best < 1.32 ? 255 : 0;
      bd.data[i + 3] = best < 0.92 ? 255 : 0;
    }
    mx.putImageData(md, 0, 0); bx.putImageData(bd, 0, 0);
    masks = { N, mid, bright, cache: {} };
  }
  function tinted(mask, col, key) {
    const c = masks.cache;
    if (c[key] && c[key].col === col) return c[key].cv;
    const cv = c[key] && c[key].cv || document.createElement("canvas");
    cv.width = cv.height = masks.N;
    const x = cv.getContext("2d");
    x.globalCompositeOperation = "source-over"; x.clearRect(0, 0, masks.N, masks.N);
    x.fillStyle = col; x.fillRect(0, 0, masks.N, masks.N);
    x.globalCompositeOperation = "destination-in"; x.drawImage(mask, 0, 0);
    c[key] = { col, cv };
    return cv;
  }
  function drawBackground(ctx, v, st) {
    if (!masks) makeMasks();
    const bg = st.col[1000];
    ctx.fillStyle = css(bg, 1, 0.5); ctx.fillRect(0, 0, v.W, v.H);
    const size = v.H * 1.05, off = ((v.camX * v.scale * 0.1) % size + size) % size;
    const mid = tinted(masks.mid, css(bg, 1, 0.72), "mid"), br = tinted(masks.bright, css(bg, 1, 1), "bright");
    const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
    for (let x = -off; x < v.W; x += size) { ctx.drawImage(mid, x, v.H * -0.12, size, size); ctx.drawImage(br, x, v.H * -0.12, size, size); }
    ctx.imageSmoothingEnabled = sm;
  }
  // middleground: two rows of soft hills just above the ground (channels 1013 / 1014, lightened)
  // ridges: |sin| folds give pointed peaks and round valleys, like the game's snowy mountains
  function hill(x, seed) { return 1 - Math.abs(Math.sin(x * 1.1 + seed)) * 0.75 - Math.abs(Math.sin(x * 2.6 + seed * 2)) * 0.3 + Math.sin(x * 6.1 + seed * 3) * 0.06; }
  // hills and ground tiles keep their screen size when the camera zooms (as in the game)
  const unit1 = v => v.H / (30 * 10.67);
  function drawMiddleground(ctx, v, st) {
    const gy = v.sy(0), u1 = unit1(v), u = 30 * u1;
    const rows = [[st.col[1013], 0.25, 0.25, 1.15, 1], [mix(st.col[1014], st.col[1013], 0.5), 0.35, 0.1, 0.7, 4]];
    for (const [c, par, h, amp, seed] of rows) {
      ctx.fillStyle = css(mix(c, [255, 255, 255], 0.22));
      ctx.beginPath(); ctx.moveTo(0, gy);
      for (let px = 0; px <= v.W + 8; px += 8) {
        const wx = (px / u1 + v.camX * v.scale / u1 * par) / 30 / 3; // in "hill units" of 3 blocks
        ctx.lineTo(px, gy - u * (h + amp * hill(wx, seed)));
      }
      ctx.lineTo(v.W, gy); ctx.closePath(); ctx.fill();
    }
  }
  // ground: hexagon tiles in channel 1001 (outlines a darker 1001: in GDLM 41 they turn purple with
  // the ground while 1009 stays blue), the line (1002) on top
  function drawGround(ctx, v, st) {
    const gy = v.sy(0);
    if (gy > v.H) return;
    const g = st.col[1001];
    ctx.fillStyle = css(g, 1, 0.95); ctx.fillRect(0, gy, v.W, v.H - gy);
    const R = 30 * 1.25 * unit1(v), w = R * Math.sqrt(3);
    ctx.save(); ctx.beginPath(); ctx.rect(0, gy, v.W, v.H - gy); ctx.clip();
    ctx.strokeStyle = css(g, 1, 0.72); ctx.lineWidth = Math.max(1.5, R * 0.07); ctx.lineJoin = "round";
    const ox = -((v.camX * v.scale) % w + w) % w;
    for (let row = 0; gy + (row - 0.5) * R * 1.5 < v.H; row++) {
      const cy = gy + R * 0.35 + row * R * 1.5;
      for (let cx = ox - w + (row % 2) * w / 2; cx < v.W + w; cx += w) {
        ctx.beginPath();
        for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; ctx.lineTo(cx + Math.cos(a) * R * 0.94, cy + Math.sin(a) * R * 0.94); }
        ctx.closePath(); ctx.stroke();
      }
    }
    // shade towards the bottom
    const sh = ctx.createLinearGradient(0, gy, 0, v.H);
    sh.addColorStop(0, "rgba(0,0,0,0)"); sh.addColorStop(1, "rgba(0,0,0,.35)");
    ctx.fillStyle = sh; ctx.fillRect(0, gy, v.W, v.H - gy);
    ctx.restore();
    // the line: bright in the middle, fading out to the screen edges
    const ln = ctx.createLinearGradient(0, 0, v.W, 0), lc = st.col[1002];
    ln.addColorStop(0, css(lc, 0)); ln.addColorStop(0.25, css(lc, 1)); ln.addColorStop(0.75, css(lc, 1)); ln.addColorStop(1, css(lc, 0));
    ctx.fillStyle = ln; ctx.fillRect(0, gy - 1, v.W, Math.max(2, v.scale * 1.2));
  }

  // objects. v: {sx, sy, scale}; local(o, fn) draws in the object's own units (y up)
  function chan(o, st, key, dflt) {
    const c = o.props && o.props[key];
    return st.col[+c] || st.col[dflt] || [255, 255, 255];
  }
  // blocks in two passes over the whole screen: fills first, then edges, so a glow is never covered
  function drawBlocks(ctx, v, st, objs, local) {
    for (const [o, a] of objs) {
      local(o, () => {
        ctx.globalAlpha = a;
        if (o.id === 1) {
          const gr = ctx.createLinearGradient(0, 15, 0, -15);
          gr.addColorStop(0, "#2a2f45"); gr.addColorStop(0.45, "#05060a"); gr.addColorStop(1, "#000");
          ctx.fillStyle = gr; ctx.fillRect(-15, -15, 30, 30);
        } else {
          ctx.fillStyle = "rgba(0,0,0,.62)"; ctx.fillRect(-15, -15, 30, 30);
          // the grid skin: faint lines at the cell edges and halves
          ctx.strokeStyle = css(chan(o, st, 21, 1004), 0.16); ctx.lineWidth = 1.2 / v.scale;
          ctx.beginPath();
          for (const q of [-15, 0, 15]) { ctx.moveTo(q, -15); ctx.lineTo(q, 15); ctx.moveTo(-15, q); ctx.lineTo(15, q); }
          ctx.stroke();
        }
      });
    }
    ctx.lineCap = "square";
    for (const [o, a] of objs) {
      const e = edges(o);
      if (!e.length && o.id !== 4) continue;
      const c = chan(o, st, 21, 1004);
      // edges are drawn unrotated in world terms: e already has the rotation applied
      ctx.save(); ctx.translate(v.sx(o.x), v.sy(o.y)); ctx.scale(v.scale, v.scale);
      ctx.globalAlpha = a; ctx.strokeStyle = css(c); ctx.lineWidth = 2.2; ctx.shadowColor = css(c, 0.8); ctx.shadowBlur = 8 * v.scale / 3;
      ctx.beginPath();
      const s = 14;
      if (e.includes("U")) { ctx.moveTo(-s, -s); ctx.lineTo(s, -s); }
      if (e.includes("D")) { ctx.moveTo(-s, s); ctx.lineTo(s, s); }
      if (e.includes("L")) { ctx.moveTo(-s, -s); ctx.lineTo(-s, s); }
      if (e.includes("R")) { ctx.moveTo(s, -s); ctx.lineTo(s, s); }
      if (o.id === 4) { // the inner-corner dot, top-left before flips/rotation
        let cx = -s, cy = -s;
        if (o.flipX) cx = -cx; if (o.flipY) cy = -cy;
        const r = Math.round(((o.rot || 0) % 360 + 360) % 360 / 90) % 4;
        for (let k = 0; k < r; k++) [cx, cy] = [-cy, cx];
        ctx.rect(cx - 1, cy - 1, 2, 2);
      }
      ctx.stroke(); ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  function spikePath(ctx, top) { ctx.beginPath(); ctx.moveTo(-14, -15); ctx.lineTo(14, -15); ctx.lineTo(0, top); ctx.closePath(); }
  function drawSpike(ctx, v, st, o, d, scale) {
    const top = d.shape === "smallspike" ? 0 : d.shape === "midspike" ? 4 : 15;
    spikePath(ctx, top);
    const gr = ctx.createLinearGradient(0, top, 0, -15);
    gr.addColorStop(0, "#000"); gr.addColorStop(0.6, "#06070c"); gr.addColorStop(1, "#3a4060");
    ctx.fillStyle = gr; ctx.fill();
    const c = chan(o, st, 21, 1004);
    ctx.lineJoin = "round"; ctx.strokeStyle = css(c); ctx.lineWidth = 1.8; ctx.shadowColor = css(c, 0.9); ctx.shadowBlur = 8 * scale / 3; ctx.stroke(); ctx.shadowBlur = 0;
  }
  // decoration: the few ids seen in the user's game get their shape, the rest a faint smudge
  function drawDeco(ctx, o, st) {
    const id = o.id;
    if (id >= 18 && id <= 21) { // pale icy crystal spikes
      const h = { 18: [10, 18, 8], 19: [14, 9, 20, 7], 20: [8, 15, 9], 21: [6, 11, 7] }[id];
      const base = -15 + ({ 18: -4, 19: -4, 20: 2, 21: 8 })[id];
      const gr = ctx.createLinearGradient(0, base, 0, base + 22);
      gr.addColorStop(0, "rgba(160,235,255,.25)"); gr.addColorStop(1, "rgba(235,255,255,.85)");
      ctx.fillStyle = gr; ctx.beginPath();
      h.forEach((hh, i) => { const x = -13 + i * 26 / (h.length - 1 || 1); ctx.moveTo(x - 4, base); ctx.lineTo(x, base + hh); ctx.lineTo(x + 4, base); });
      ctx.fill();
    } else if (id === 16) { // antenna: a thin stick with a pale ball
      ctx.fillStyle = "rgba(10,10,20,.9)"; ctx.fillRect(-1, -14, 2, 22);
      ctx.fillStyle = "rgba(225,255,190,.95)"; ctx.beginPath(); ctx.arc(0, 10, 4.5, 0, 7); ctx.fill();
    } else {
      const c = chan(o, st, 21, 1004);
      ctx.fillStyle = css(c, 0.13); ctx.beginPath(); ctx.arc(0, 0, 10, 0, 7); ctx.fill();
    }
  }
  // the user's icon: the default cube in lime and cyan (the player's own colours, not the level's)
  function drawPlayerCube(ctx) {
    ctx.fillStyle = "#7dff00"; ctx.fillRect(-15, -15, 30, 30);
    ctx.strokeStyle = "#000"; ctx.lineWidth = 2; ctx.strokeRect(-14, -14, 28, 28);
    ctx.strokeRect(-8, -8, 16, 16);
    ctx.fillStyle = "#000"; ctx.fillRect(-5, -5, 10, 10);
    ctx.fillStyle = "#00ffff"; ctx.fillRect(-3.5, -3.5, 7, 7);
  }

  GD.LOOK = { DEFAULT, headerColours, timeline, valueAt, stateAt, objAlpha, edges, isSkin, css, mix,
    drawBackground, drawMiddleground, drawGround, drawBlocks, drawSpike, drawDeco, drawPlayerCube };
})(typeof module !== "undefined" ? module.exports : (window.GD = window.GD || {}));
