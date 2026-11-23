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
    // the 1.9-2.0 format (official levels): kS29 bg, kS30 ground, kS31 line, kS32 obj, kS33..kS36
    // colours 1-4, kS37 3DL; each "1_r_2_g_3_b_4_player_5_blend"
    for (const [k, ch] of OLD_CH) if (h[k]) { const f = fields(h[k]); col[ch] = [+f[1] || 0, +f[2] || 0, +f[3] || 0]; }
    for (const c of String(h.kS38 || "").split("|")) {
      if (!c) continue;
      const f = fields(c);
      if (f[6] == null) continue;
      col[+f[6]] = [+f[1] || 0, +f[2] || 0, +f[3] || 0];
    }
    // channels that follow the player's colours (field 4: 1 = colour 1, 2 = colour 2)
    for (const [ch, pc] of Object.entries(channelFlags(header).player)) col[ch] = (pc === 2 ? DEFAULT[1006] : DEFAULT[1005]).slice();
    // 1005 / 1006 are always the player's own colours, whatever the header stores (GDLM 41 stores orange
    // for 1005; its antenna balls and deco spikes show the user's lime in the game)
    col[1005] = DEFAULT[1005].slice(); col[1006] = DEFAULT[1006].slice();
    col[1010] = [0, 0, 0]; col[1011] = [255, 255, 255];
    return col;
  }
  const OLD_CH = [["kS29", 1000], ["kS30", 1001], ["kS31", 1002], ["kS32", 1004], ["kS33", 1], ["kS34", 2], ["kS35", 3], ["kS36", 4], ["kS37", 1003]];
  function fields(c) { const p = String(c).split("_"), f = {}; for (let i = 0; i + 1 < p.length; i += 2) f[p[i]] = p[i + 1]; return f; }
  // per channel: blending (additive, field 5), opacity (field 7), player colour (field 4)
  function channelFlags(header) {
    // the player's colours blend by default (GD 2.2 headers say 5_1 for them; Cycles' old-format header
    // says nothing, and its P1 ground spikes and chains show lime added over purple in the game)
    const h = headerMap(header), out = { blend: { 1005: true, 1006: true }, opacity: {}, player: {}, copy: {} };
    const take = (ch, f) => {
      if (f[5] === "1") out.blend[ch] = true; else if (f[5] === "0" || f[5] == null) delete out.blend[ch];
      if (f[7] != null && f[7] !== "" && +f[7] < 1) out.opacity[ch] = Math.max(0, +f[7]);
      if (f[4] === "1" || f[4] === "2") out.player[ch] = +f[4];
      // copy colour: field 9 = the channel copied, 10 = an HSV shift on it (Spire's glow channels copy
      // the background, so they change when it does; without this they stayed white and washed it out)
      if (f[9] && +f[9] > 0) out.copy[ch] = { src: +f[9], hsv: f[10] || "" };
    };
    for (const [k, ch] of OLD_CH) if (h[k]) take(ch, fields(h[k]));
    for (const c of String(h.kS38 || "").split("|")) { if (!c) continue; const f = fields(c); if (f[6] != null) take(+f[6], f); }
    return out;
  }

  // ---- triggers ----
  // colour 899 (7/8/9 rgb, 10 seconds, 23 channel); the 1.x ones carry their channel in the id
  const OLD_COLOUR = { 29: 1000, 30: 1001, 105: 1004, 900: 1009, 915: 1002 };
  // fireAt(x) -> level seconds when the player passes x, or Infinity (never reached)
  function timeline(level, fireAt) {
    const tl = { start: headerColours(level.header), flags: channelFlags(level.header), colour: {}, alpha: {}, zoom: [] };
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
    // 1007 "LBG": the background, lightened (GD derives it from 1000; the exact shift is not measured)
    if (col[1000]) col[1007] = mix(col[1000], [255, 255, 255], 0.3);
    const fl = tl.flags || { blend: {}, opacity: {} };
    applyCopies(col, fl.copy);
    return { col, alpha, zoom: valueAt([1], tl.zoom, t)[0], blend: fl.blend, opacity: fl.opacity, copy: fl.copy };
  }
  // copy-colour channels take their source's colour now (two passes: a copy of a copy)
  function applyCopies(col, copy) {
    if (!copy) return col;
    const V = GD.VFX || (typeof require !== "undefined" ? require("./vfx.js").VFX : null);
    for (let pass = 0; pass < 2; pass++) for (const ch in copy) {
      const c = copy[ch], src = col[c.src];
      if (src) col[ch] = V ? V.hsvApply(src, V.hsvParse(c.hsv)) : src.slice();
    }
    return col;
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
    if (!st) return [255, 255, 255]; // the schematic view has no colours
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
    } else if (drawMark(ctx, o, st)) {
    } else {
      const c = chan(o, st, 21, 1004);
      ctx.fillStyle = css(c, 0.13); ctx.beginPath(); ctx.arc(0, 0, 10, 0, 7); ctx.fill();
    }
  }
  // jump indicators and text: the arrows (d_arrow_01/02/03: 132, 460, 494 and their 2.2 copies 3630-3632)
  // in their own shape, pointing +x before the object's rotation (460 turned 90 = a chevron pointing down),
  // and text objects (914) in GD's place of its font. Both size with key 32 (local() does not scale) and
  // take colour channel 21. st may be null (the schematic view: white). Returns false for anything else.
  const ARROWS = {
    460: [-14, 22, -7, 22, 14, 0, -7, -22, -14, -22, 7, 0], 3631: 460,         // ">" chevron, 0.95 x 1.47 blocks
    494: [-11, 22, -6, 22, 11, 0, -6, -22, -11, -22, 6, 0], 3632: 494,          // thin chevron, 0.73 x 1.47
    132: [-23, -6, 2, -6, 2, -17, 23, 0, 2, 17, 2, 6, -23, 6], 3630: 132,       // block arrow, 1.55 x 1.12
  };
  function isMark(id) { return id === 914 || ARROWS[id] !== undefined; }
  function drawMark(ctx, o, st) {
    const k = +((o.props && o.props[32]) || 1) || 1;
    let pts = ARROWS[o.id]; if (typeof pts === "number") pts = ARROWS[pts];
    if (pts) {
      const c = chan(o, st, 21, 1004);
      ctx.save(); ctx.scale(k, k);
      ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath();
      ctx.fillStyle = css(c); ctx.shadowColor = css(c, 0.8); ctx.shadowBlur = 6; ctx.fill(); ctx.shadowBlur = 0;
      ctx.restore();
      return true;
    }
    if (o.id !== 914 || !o.props || !o.props[31]) return false;
    let txt = "";
    try { const b = String(o.props[31]).replace(/-/g, "+").replace(/_/g, "/"); txt = typeof atob === "function" ? decodeURIComponent(escape(atob(b))) : Buffer.from(b, "base64").toString(); } catch (e) {}
    const c = o.props[21] ? chan(o, st, 21, 1011) : [255, 255, 255];
    ctx.save(); ctx.scale(1, -1); // this space is y-up; text is drawn y-down
    ctx.fillStyle = css(c); ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 2;
    ctx.font = `bold ${Math.round(26 * k)}px system-ui`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.strokeText(txt, 0, 0); ctx.fillText(txt, 0, 0);
    ctx.restore();
    return true;
  }
  // the user's icon: the default cube in lime and cyan (the player's own colours, not the level's)
  function drawPlayerCube(ctx) {
    ctx.fillStyle = "#7dff00"; ctx.fillRect(-15, -15, 30, 30);
    ctx.strokeStyle = "#000"; ctx.lineWidth = 2; ctx.strokeRect(-14, -14, 28, 28);
    ctx.strokeRect(-8, -8, 16, 16);
    ctx.fillStyle = "#000"; ctx.fillRect(-5, -5, 10, 10);
    ctx.fillStyle = "#00ffff"; ctx.fillRect(-3.5, -3.5, 7, 7);
  }

  // ---- the player: icons of every mode, glow, trail, particles ----
  // GD's default icon colours: green body, cyan details, black outlines. Shapes are drawn here, not
  // taken from the game's art. Local units, y up (the viewer's local() flips y), 30 = one block.
  const P1 = "#7dff00", P2 = "#00ffff", P1RGB = "125,255,0";
  function outline(ctx) { ctx.strokeStyle = "#000"; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.stroke(); }
  function poly(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); }
  function miniCube(ctx, x, y, k) { ctx.save(); ctx.translate(x, y); ctx.scale(k, k); drawPlayerCube(ctx); ctx.restore(); }
  const ICON = {
    cube: ctx => drawPlayerCube(ctx),
    ship: ctx => {
      miniCube(ctx, -4, 8, 0.5);
      poly(ctx, [-17, -10, 13, -10, 19, -4, 9, 2, -17, 2]); ctx.fillStyle = P1; ctx.fill(); outline(ctx);
      poly(ctx, [-12, -6.5, 8, -6.5, 10, -3.5, -12, -3.5]); ctx.fillStyle = P2; ctx.fill();
      poly(ctx, [-17, -8, -21, -6, -21, 0, -17, 0]); ctx.fillStyle = "#000"; ctx.fill();
    },
    ufo: ctx => {
      miniCube(ctx, 0, 6, 0.5);
      ctx.beginPath(); ctx.arc(0, 2, 12, 0, Math.PI); ctx.fillStyle = "rgba(0,255,255,.25)"; ctx.fill(); outline(ctx);
      ctx.beginPath(); ctx.ellipse(0, -6, 8, 4, 0, 0, 2 * Math.PI); ctx.fillStyle = P2; ctx.fill(); outline(ctx);
      ctx.beginPath(); ctx.ellipse(0, 0, 19, 5.5, 0, 0, 2 * Math.PI); ctx.fillStyle = P1; ctx.fill(); outline(ctx);
    },
    ball: ctx => {
      ctx.beginPath(); ctx.arc(0, 0, 15, 0, 2 * Math.PI); ctx.fillStyle = P1; ctx.fill(); outline(ctx);
      ctx.beginPath(); ctx.arc(0, 0, 9.5, 0, 2 * Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, 2 * Math.PI); ctx.fillStyle = P2; ctx.fill(); outline(ctx);
      ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(-9.5, 0); ctx.moveTo(15, 0); ctx.lineTo(9.5, 0);
      ctx.moveTo(0, -15); ctx.lineTo(0, -9.5); ctx.moveTo(0, 15); ctx.lineTo(0, 9.5); ctx.stroke();
    },
    wave: ctx => {
      poly(ctx, [14, 0, -11, 11, -6, 0, -11, -11]); ctx.fillStyle = P1; ctx.fill(); outline(ctx);
      poly(ctx, [5, 0, -5, 4, -3, 0, -5, -4]); ctx.fillStyle = P2; ctx.fill();
    },
  };
  // the player at state s (x, y, rot already smoothed by the viewer); local(o, fn) draws in level units
  // iconFn(ctx, mode) -> true when it drew the icon (lib/art.js: GD's own icon sprites)
  function drawPlayer(ctx, view, s, held, local, speedX, iconFn) {
    const { sx, sy, scale } = view, m = s.mini ? 0.6 : 1, X = sx(s.x), Y = sy(s.y), R = 36 * scale * m;
    if (!s.dead) {                         // glow: a soft light in the icon's colour, added over the scene
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(X, Y, 0, X, Y, R);
      g.addColorStop(0, `rgba(${P1RGB},${held ? 0.42 : 0.3})`); g.addColorStop(1, `rgba(${P1RGB},0)`);
      ctx.fillStyle = g; ctx.fillRect(X - R, Y - R, 2 * R, 2 * R); ctx.restore();
    }
    const shape = ICON[s.mode] || ICON.cube, up = s.grav < 0;
    const icon = iconFn ? (c => { if (!iconFn(c, s.mode)) shape(c); }) : shape;
    if (s.mode === "wave") {
      const a = Math.atan2(s.vy, speedX || 10);
      local({ x: s.x, y: s.y, rot: 0 }, () => { ctx.scale(m, m); ctx.rotate(a); icon(ctx); });
    } else if (s.mode === "ufo" || s.mode === "ship") {
      local({ x: s.x, y: s.y, rot: s.rot, flipY: up }, () => { ctx.scale(m, m); icon(ctx); });
    } else local({ x: s.x, y: s.y, rot: s.rot }, () => { ctx.scale(m, m); icon(ctx); });
  }
  // what the player leaves behind: the wave's solid trail, a fading streak (flying modes, and the cube
  // after an orb or a pad), and particles (cube on the ground, ship and UFO exhaust). Particles come
  // from the step that spawned them, so scrubbing back shows the same ones.
  function drawTrail(ctx, view, path, k, f, s) {
    const { sx, sy, scale } = view, TPS = 240, at = j => j >= k ? s : path[j];
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round"; ctx.lineJoin = "round";
    const line = (from, step) => { ctx.beginPath(); ctx.moveTo(sx(at(from).x), sy(at(from).y));
      for (let j = from + step; j < k; j += step) ctx.lineTo(sx(path[j].x), sy(path[j].y)); ctx.lineTo(sx(s.x), sy(s.y)); };
    if (s.mode === "wave") {
      let i = k; while (i > 0 && k - i < TPS * 2 && path[i - 1].mode === "wave") i--;
      line(i, 2);
      ctx.strokeStyle = `rgba(${P1RGB},.5)`; ctx.lineWidth = 11 * scale * (s.mini ? 0.6 : 1); ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.lineWidth = 3.5 * scale * (s.mini ? 0.6 : 1); ctx.stroke();
    } else {
      let show = s.mode !== "cube";
      if (!show && !s.grounded) for (let j = k; j > k - TPS * 0.45 && j > 0; j--) if (/orb|pad/.test(path[j].act || "")) { show = true; break; }
      if (show) {
        const n = Math.round(TPS * 0.22), j0 = Math.max(0, k - n);
        for (let j = j0; j < k; j += 2) {
          const a = path[j], b = at(Math.min(j + 2, k)), u = (j - j0) / n;
          ctx.strokeStyle = `rgba(${P1RGB},${0.55 * u})`; ctx.lineWidth = Math.max(1, 10 * scale * u);
          ctx.beginPath(); ctx.moveTo(sx(a.x), sy(a.y)); ctx.lineTo(sx(b.x), sy(b.y)); ctx.stroke();
        }
      }
    }
    const rnd = (j, q) => { const x = Math.sin(j * 12.9898 + q * 78.233) * 43758.5453; return x - Math.floor(x); };
    const life = 0.32;
    for (let j = k - (k % 5); j > k - TPS * life && j >= 0; j -= 5) {
      const p = path[j]; if (p.dead) continue;
      const age = (k - j + f) / TPS; if (age > life) continue;
      let px, py, vx, vy, col, size;
      if (p.mode === "cube" || p.mode === "robot") {
        if (!p.grounded) continue;
        px = p.x - 12; py = p.y - 14 * (p.grav || 1); vx = -30 - 50 * rnd(j, 1); vy = (20 + 50 * rnd(j, 2)) * (p.grav || 1);
        col = P1RGB; size = 4;
      } else if (p.mode === "ship" || p.mode === "ufo") {
        px = p.x - 18; py = p.y - (p.mode === "ufo" ? 6 : 3) * (p.grav || 1); vx = -70 - 80 * rnd(j, 1); vy = (rnd(j, 2) - 0.5) * 60;
        col = "255,200,70"; size = 5;
      } else continue;
      const a = 1 - age / life, x = px + vx * age, y = py + vy * age, sz = size * (0.4 + 0.6 * a) * scale;
      ctx.fillStyle = `rgba(${col},${0.8 * a})`; ctx.fillRect(sx(x) - sz / 2, sy(y) - sz / 2, sz, sz);
    }
    ctx.restore();
  }

  GD.LOOK = { DEFAULT, headerColours, channelFlags, applyCopies, timeline, valueAt, stateAt, objAlpha, edges, isSkin, css, mix,
    drawBackground, drawMiddleground, drawGround, drawBlocks, drawSpike, drawDeco, drawMark, isMark, drawPlayerCube,
    drawPlayer, drawTrail };
})(typeof module !== "undefined" ? module.exports : (window.GD = window.GD || {}));
