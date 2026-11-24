// GD's own art in the viewer: objects drawn with the sprite frames of the user's game install, tinted
// by the level's colour channels at that moment, in GD's z-layers; background, middleground, ground,
// floor line and the player icon from the same files. Nothing of RobTop's is stored here or in the
// repo: the sheets come at run time from tools/serve.js (/gdres/..., read from the game's Resources).
// Which frames an object is made of: lib/objects_art.js (OpenGD's 2.1 table: children, colour roles,
// layers) and lib/objects_frames.js (GD 2.2's own id -> root frame, for ids OpenGD lacks).
// See VISUALS.md for what is known, how it was checked and what is open.
// The plist parser and the object -> sprite tree part run in node too (tools/catalogue.js, tests).
(function (GD) {
  "use strict";
  const isNode = typeof module !== "undefined" && typeof require !== "undefined";
  const A = isNode ? require("./objects_art.js") : GD;
  const F = isNode ? require("./objects_frames.js") : GD;

  // ---- plist frame tables (TexturePacker format 3, as GD 2.2 ships them) ----
  const nums = s => String(s).match(/-?[\d.]+/g).map(Number);
  function parsePlist(xml) {
    const frames = {}, i0 = xml.indexOf("<key>frames</key>");
    const meta = xml.indexOf("<key>metadata</key>");
    const body = xml.slice(i0, meta > 0 ? meta : undefined);
    const re = /<key>([^<]+)<\/key>\s*<dict>([\s\S]*?)<\/dict>/g;
    let m;
    while ((m = re.exec(body))) {
      if (m[1] === "frames") { re.lastIndex = m.index + 20; continue; }
      const d = {}, kre = /<key>(\w+)<\/key>\s*(?:<string>([^<]*)<\/string>|<(true|false)\/>|<array\/>|<integer>([^<]*)<\/integer>)/g;
      let k;
      while ((k = kre.exec(m[2]))) d[k[1]] = k[2] != null ? k[2] : k[3] != null ? k[3] === "true" : k[4];
      if (!d.textureRect) continue;
      const [x, y, w, h] = nums(d.textureRect), [ox, oy] = nums(d.spriteOffset || "{0,0}"), [sw, sh] = nums(d.spriteSourceSize || `{${w},${h}}`);
      frames[m[1]] = { x, y, w, h, ox, oy, sw, sh, rot: !!d.textureRotated };
    }
    return frames;
  }

  // ---- the sprite tree of an object id ----
  // node: {frame, role, x, y (centre, units, y up, relative to the parent's centre), rot (deg, clockwise),
  //        sx, sy, flip, z, kids:[]}; roles "b" main colour, "d" detail, "k" black, "" as drawn.
  // frameSize(name) -> [w, h] in units (source size / 4 at uhd) or null.
  const LAYER_DEFAULT = 5; // T1
  // parts OpenGD's table lacks, seen in the user's recordings (VISUALS.md): the antennas 15-17 carry a
  // ball (rod_ball_0N) above the stick, in the detail role, default channel 1005 (the player's colour 1,
  // blending: mint over a blue sky in GDLM 41). Child format as in tools/import_art.js; x, y from the
  // parent's bottom-left, and the stick's frame is 26.5 / 42 / 12.5 units tall.
  const SUPPLEMENT = {
    15: { ch2: 1005, kids: [["rod_ball_01_001.png", "d", 3.25, 42 + 2, 0, 0.13, 0.13, 0, 1, 0.5, 0.5, null, null]] },
    16: { ch2: 1005, kids: [["rod_ball_02_001.png", "d", 3, 26.5 + 2, 0, 0.13, 0.13, 0, 1, 0.5, 0.5, null, null]] },
    17: { ch2: 1005, kids: [["rod_ball_03_001.png", "d", 2.75, 12.5 + 2, 0, 0.13, 0.13, 0, 1, 0.5, 0.5, null, null]] },
  };
  // portals: GD draws the back half (portal_NN_back) behind the player as its own sprite; OpenGD's table
  // has only the front. Added as a child centred on the front (x = null: the parent's centre).
  function portalBack(frame) { const m = /^portal_(\d+)_front_001\.png$/.exec(frame); return m ? { kids: [["portal_" + m[1] + "_back_001.png", "", null, null, 0, 1, 1, 0, -1, 0.5, 0.5, null, null]] } : null; }
  function info(id) {
    if (id === 914) return null; // text: GD draws it with its font (the table's frame is the editor button); lib/look.js draws the text
    const a = A.ART[id], sup = SUPPLEMENT[id] || portalBack(a ? a[5] : F.FRAMES[id] || "");
    if (a && sup) return { z: a[0], zo: a[1], ch1: a[2], ch2: sup.ch2 != null ? sup.ch2 : a[3], type: a[4], frame: a[5], role: a[6], kids: (a[7] || []).concat(sup.kids), src: "opengd+" };
    if (a) return { z: a[0], zo: a[1], ch1: a[2], ch2: a[3], type: a[4], frame: a[5], role: a[6], kids: a[7] || [], src: "opengd" };
    const f = F.FRAMES[id];
    if (f) return { z: LAYER_DEFAULT, zo: 0, ch1: 1004, ch2: -1, type: -1, frame: f, role: "b", kids: sup ? sup.kids : [], src: "gd22" };
    return null;
  }
  function tree(id, frameSize) {
    let d = info(id);
    if (!d) return null;
    // OpenGD's 2.1 frame names that GD 2.2 renamed (d_thorn2_0N -> d_thorn_0N): GD's own name instead
    if (!frameSize(d.frame) && F.FRAMES[id] && frameSize(F.FRAMES[id])) d = Object.assign({}, d, { frame: F.FRAMES[id] });
    const rootSize = frameSize(d.frame) || [30, 30];
    const kid = (c, pw, ph) => {
      const [frame, role, x, y, rot, sx, sy, flip, z, ax, ay, cw0, ch0, sub] = c;
      const fs = frameSize(frame) || [cw0 || 0, ch0 || 0];
      const cw = cw0 == null ? fs[0] : cw0, ch = ch0 == null ? fs[1] : ch0;
      // the node sits at its anchor; its content box centre is (0.5 - anchor) * size away (before rot / scale)
      const n = { frame, role, x: x == null ? 0 : x - pw / 2, y: y == null ? 0 : y - ph / 2, cx: (0.5 - ax) * cw, cy: (0.5 - ay) * ch, rot, sx, sy, flip, z, kids: [] };
      n.kids = (sub || []).map(s => kid(s, cw, ch));
      return n;
    };
    return Object.assign({}, d, { node: { frame: d.frame, role: d.role, x: 0, y: 0, cx: 0, cy: 0, rot: 0, sx: 1, sy: 1, flip: 0, z: 0,
      kids: d.kids.map(c => kid(c, rootSize[0], rootSize[1])) } });
  }
  // every frame an object uses (for the catalogue and for loading)
  function framesOf(t) { const out = []; const walk = n => { out.push(n.frame); n.kids.forEach(walk); }; if (t) walk(t.node); return out; }

  // ---- browser: sheets, tinting, drawing ----
  const SHEETS = ["GJ_GameSheet", "GJ_GameSheet02", "GJ_GameSheet03", "GJ_GameSheet04", "GJ_GameSheetGlow",
    "PixelSheet_01", "FireSheet_01", "GJ_ParticleSheet"];
  const ICONS = ["icons/player_01", "icons/ship_01", "icons/player_ball_01", "icons/dart_01", "icons/bird_01", "icons/spider_01", "icons/robot_01", "icons/swing_01"];
  const PX = 4; // uhd: 4 px per unit
  const S = { anim: {}, ready: false, failed: null, frames: {}, sheetOf: {}, img: {}, loading: {}, base: "/gdres/", onload: null, images: {} };

  async function load(base, onload) {
    S.base = base || S.base; S.onload = onload || null;
    try {
      const lists = await Promise.all(SHEETS.concat(ICONS).map(async n => {
        const r = await fetch(S.base + n + "-uhd.plist");
        if (!r.ok) throw new Error(n + "-uhd.plist: " + r.status);
        return [n, parsePlist(await r.text())];
      }));
      for (const [n, fr] of lists) for (const k in fr) if (!S.frames[k]) { S.frames[k] = fr[k]; S.sheetOf[k] = n; }
      S.ready = true;
      // the robot's and spider's leg animations (GD's own layout of their parts; optional)
      for (const n of ["Robot", "Spider"]) fetch(S.base + n + "_AnimDesc.plist").then(r => r.ok ? r.text() : "").then(t => { if (t) Object.assign(S.anim, parseAnim(t)); }).catch(() => {});
    } catch (e) { S.failed = String(e.message || e); }
    return S.ready;
  }
  // a sheet's image, loaded the first time one of its frames is drawn; redraws when it arrives
  function sheet(n) {
    if (S.img[n]) return S.img[n];
    if (!S.loading[n]) {
      S.loading[n] = true;
      const im = new Image(); if (/^https?:/.test(S.base)) im.crossOrigin = "anonymous"; // the public page reads the PC's server: CORS, so tinting can read the pixels
      im.onload = () => { S.img[n] = im; if (S.onload) S.onload(); };
      im.onerror = () => { S.failed = n + "-uhd.png did not load"; };
      im.src = S.base + n + "-uhd.png";
    }
    return null;
  }
  // every sheet's image, for pages that draw many objects at once (viewer/catalogue.html)
  function preload() {
    return Promise.all(SHEETS.concat(ICONS).map(n => new Promise(res => {
      if (S.img[n]) return res();
      const im = new Image(); if (/^https?:/.test(S.base)) im.crossOrigin = "anonymous"; // the public page reads the PC's server: CORS, so tinting can read the pixels im.onload = () => { S.img[n] = im; res(); }; im.onerror = () => res(); im.src = S.base + n + "-uhd.png";
      S.loading[n] = true;
    })));
  }
  // a whole image (background, ground, middleground)
  function image(name) {
    if (S.images[name]) return S.images[name].ok ? S.images[name].im : null;
    const im = new Image(), rec = { im, ok: false }; if (/^https?:/.test(S.base)) im.crossOrigin = "anonymous";
    S.images[name] = rec;
    im.onload = () => { rec.ok = true; if (S.onload) S.onload(); };
    im.src = S.base + name;
    return null;
  }
  const frameSize = name => { const f = S.frames[name]; return f ? [f.sw / PX, f.sh / PX] : null; };
  const has = id => !!info(id) && S.ready && !!S.frames[info(id).frame];

  // tinted copies of frames: GD multiplies the texture by the colour (white parts take it fully)
  const tintCache = new Map();
  // a time budget for making new tinted copies (each costs a canvas op; a fresh stretch with new colours made one draw
  // take 150-190 ms): budget(ms) before a draw, budget(0) after; past the deadline a miss returns null (not drawn this
  // time) and sets S.missed, so the caller draws again after a yield until nothing was missed. Off by default.
  S.deadline = 0; S.missed = false;
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
  const overBudget = () => { if (S.deadline && now() > S.deadline) { S.missed = true; return true; } return false; };
  function budget(ms) { S.deadline = ms ? now() + ms : 0; if (ms) S.missed = false; }
  function tinted(name, rgb) {
    const f = S.frames[name]; if (!f) return null;
    const im = sheet(S.sheetOf[name]); if (!im) return null;
    const q = rgb ? rgb.map(v => Math.max(0, Math.min(255, Math.round(v / 4) * 4))) : null;
    const key = name + (q ? "|" + q.join(",") : "");
    let c = tintCache.get(key);
    if (c) { tintCache.delete(key); tintCache.set(key, c); return c; }
    if (overBudget()) return null;   // drawn on a later pass (budget(): the map in the page)
    // textureRect's size is the frame upright; a rotated frame is stored turned 90 degrees clockwise,
    // so it takes h x w pixels of the sheet
    const w = f.w, h = f.h, rw = f.rot ? h : w, rh = f.rot ? w : h;
    c = document.createElement("canvas"); c.width = Math.max(1, w); c.height = Math.max(1, h);
    const x = c.getContext("2d");
    if (f.rot) { x.translate(0, h); x.rotate(-Math.PI / 2); }
    x.drawImage(im, f.x, f.y, rw, rh, 0, 0, rw, rh);
    x.setTransform(1, 0, 0, 1, 0, 0);
    if (q && !(q[0] === 252 && q[1] === 252 && q[2] === 252) && !(q[0] >= 255 && q[1] >= 255 && q[2] >= 255)) {
      x.globalCompositeOperation = "multiply"; x.fillStyle = `rgb(${q[0]},${q[1]},${q[2]})`; x.fillRect(0, 0, c.width, c.height);
      x.globalCompositeOperation = "destination-in";
      if (f.rot) { x.translate(0, h); x.rotate(-Math.PI / 2); }
      x.drawImage(im, f.x, f.y, rw, rh, 0, 0, rw, rh);
    }
    tintCache.set(key, c);
    if (tintCache.size > 2500) tintCache.delete(tintCache.keys().next().value);
    return c;
  }
  // one frame centred on the current origin (units, y up), with its trim offset
  function blit(ctx, name, rgb, flip) {
    const f = S.frames[name]; if (!f) return false;
    const c = tinted(name, rgb); if (!c) return true; // sheet still loading
    const w = c.width / PX, h = c.height / PX;
    ctx.save();
    ctx.scale(flip & 1 ? -1 : 1, flip & 2 ? 1 : -1); // y down for the image
    ctx.drawImage(c, f.ox / PX - w / 2, -f.oy / PX - h / 2, w, h);
    ctx.restore();
    return true;
  }
  function drawNode(ctx, n, col) {
    ctx.save();
    ctx.translate(n.x, n.y); ctx.rotate(-n.rot * Math.PI / 180); ctx.scale(n.sx, n.sy);
    ctx.translate(n.cx, n.cy);
    const kids = n.kids.slice().sort((a, b) => a.z - b.z);
    for (const k of kids) if (k.z < 0) drawNode(ctx, k, col);
    blit(ctx, n.frame, col(n.role), n.flip);
    for (const k of kids) if (k.z >= 0) drawNode(ctx, k, col);
    ctx.restore();
  }
  const treeCache = {};
  function treeOf(id) { if (!(id in treeCache)) treeCache[id] = S.ready ? tree(id, frameSize) : null; return treeCache[id]; }

  // colours of an object: main = key 21 (else the default), detail = key 22 (else main, as OpenGD does
  // when the detail channel is unset), black = 1010. st.col is LOOK.stateAt's channel table.
  function colours(o, t, st) {
    const p = o.props || {};
    const ch1 = +p[21] || t.ch1, ch2 = +p[22] || t.ch2;
    let c1 = st.col[ch1] || (ch1 > 0 ? [255, 255, 255] : null);
    let c2 = ch2 > 0 && st.col[ch2] ? st.col[ch2] : null;
    // the object's own HSV shift (41 / 43 main, 42 / 44 detail; lib/vfx.js reads the strings); an object
    // with no detail channel draws its detail parts in the main colour, main HSV included (OpenGD)
    const V = GD.VFX || (isNode ? require("./vfx.js").VFX : null);
    if (V && p[41] === "1" && c1) c1 = V.hsvApply(c1, V.hsvParse(p[43]));
    if (!c2) c2 = c1;
    else if (V && p[42] === "1") c2 = V.hsvApply(c2, V.hsvParse(p[44]));
    // group pulses (lib/vfx.js): st.tint(o, main, detail) -> {main, detail} or null
    if (st.tint) { const r = st.tint(o, c1, c2); if (r) { c1 = r.main || c1; c2 = r.detail || c2; } }
    return { main: c1, detail: c2, ch1, ch2 };
  }
  // the z-layer an object is drawn in (key 24; 0 = its default) and its order (key 25)
  function layerOf(o, t) { const z = +(o.props && o.props[24]) || 0; return z || t.z || LAYER_DEFAULT; }
  function orderOf(o, t) { const p = o.props && o.props[25]; return p != null && p !== "" ? +p : t.zo; }

  // draw a list of objects (already posed for this moment): fn(o) -> alpha. Returns the ids it could not
  // draw (no frame known) so the caller draws those its own way. local(o, fn): the viewer's object frame.
  function drawObjects(ctx, objs, st, local, alphaOf, skip, playerLayer) {
    const items = [], rest = [], texts = [];
    for (const o of objs) {
      if (o.id === 914) { const a = alphaOf(o); if (a > 0.01) texts.push([o, a]); continue; }
      if (skip && skip(o)) continue;
      if (!(o.id in treeCache) && overBudget()) continue;   // its tree is built on a later pass (budget())
      const t = treeOf(o.id);
      if (!t || !S.frames[t.frame]) { rest.push(o); continue; }
      const a = alphaOf(o); if (a <= 0.01) continue;
      items.push({ o, t, a, z: layerOf(o, t), zo: orderOf(o, t) });
    }
    items.sort((p, q) => p.z - q.z || p.zo - q.zo);
    const draw = it => {
      const c = colours(it.o, it.t, st), blendCh = st.blend && st.blend[c.ch1];
      const col = r => r === "k" ? [0, 0, 0] : r === "d" ? c.detail : r === "b" ? c.main : null;
      ctx.globalAlpha = it.a * (st.opacity && st.opacity[c.ch1] != null ? st.opacity[c.ch1] : 1);
      if (blendCh) ctx.globalCompositeOperation = "lighter";
      local(it.o, () => { const sc = scaleOf(it.o); ctx.scale(sc[0], sc[1]); drawNode(ctx, it.t.node, col); });
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    };
    const glow = () => {
      ctx.globalCompositeOperation = "lighter";
      for (const it of items) {
        const g = A.ART_GLOW[it.o.id]; if (!g || (it.o.props && it.o.props[96] === "1")) continue;
        const c = colours(it.o, it.t, st);
        // the glow takes the object's main colour (OpenGD; Cycles' white blocks glow white in the user's
        // game). GDLM 41's white blocks showed lime edges, but the installed copy differs from the repo's
        // file (more deco), so that is not counted against this. VISUALS.md "Open".
        const gc = c.main;
        ctx.globalAlpha = it.a;
        for (let k = 0; k < GLOW_PASSES; k++) local(it.o, () => { const sc = scaleOf(it.o); ctx.scale(sc[0], sc[1]); blit(ctx, g, gc || [255, 255, 255], 0); });
      }
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
    };
    // B layers, glow, (player), T layers -- OpenGD's order; the viewer draws the player at playerLayer
    let i = 0;
    while (i < items.length && items[i].z < LAYER_DEFAULT) draw(items[i++]);
    glow();
    const below = i;
    return { rest, after: () => { for (let j = below; j < items.length; j++) draw(items[j]); for (const [o, a] of texts) drawText(ctx, o, st, local, a); } };
  }
  // text objects (914): key 31 = the text (base64), 32 = scale, 21 = colour channel (default white).
  // GD draws them in its bigFont; a heavy rounded system font stands in (size by eye: a capital ~26
  // units tall at scale 1). Not checked against a recording yet.
  function textOf(o) {
    const b = String((o.props || {})[31] || "").replace(/-/g, "+").replace(/_/g, "/");
    try { return typeof atob === "function" ? decodeURIComponent(escape(atob(b))) : Buffer.from(b, "base64").toString("utf8"); } catch (e) { return ""; }
  }
  function drawText(ctx, o, st, local, a) {
    const txt = textOf(o); if (!txt) return;
    const p = o.props || {}, c = st.col[+p[21] || 1011] || [255, 255, 255], sc = scaleOf(o);
    ctx.save(); ctx.globalAlpha = a * (st.opacity && st.opacity[+p[21]] != null ? st.opacity[+p[21]] : 1);
    local(o, () => {
      ctx.scale(sc[0], -sc[1]);
      ctx.font = "900 26px 'Arial Rounded MT Bold', 'Arial Black', system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.lineJoin = "round"; ctx.lineWidth = 5; ctx.strokeStyle = "rgba(0,0,0,.75)"; ctx.strokeText(txt, 0, 0);
      ctx.fillStyle = `rgb(${c.map(Math.round).join(",")})`; ctx.fillText(txt, 0, 0);
    });
    ctx.restore();
  }
  function scaleOf(o) {
    const p = o.props || {}, s = p[32] != null && p[32] !== "" ? +p[32] : 1;
    return [p[128] != null && p[128] !== "" ? +p[128] : s, p[129] != null && p[129] !== "" ? +p[129] : s];
  }

  // ---- background, middleground, ground, line (header kA6 bg, kA25 middleground, kA7 ground, kA17 line) ----
  const pad2 = n => String(Math.max(1, n | 0)).padStart(2, "0");
  function hdr(header) { const kv = String(header || "").split(","), m = {}; for (let i = 0; i + 1 < kv.length; i += 2) m[kv[i]] = kv[i + 1]; return m; }
  function scenery(header) {
    const h = hdr(header);
    return { bg: pad2(+h.kA6 || 1), ground: pad2(+h.kA7 || 1), mg: +h.kA25 || 0, line: (+h.kA17 || 1) === 2 ? 2 : 1 };
  }
  // a whole picture tinted (cached per colour)
  const imgTint = new Map();
  function tintImage(name, rgb) {
    const im = image(name); if (!im) return null;
    // under a budget (the map, drawn small) a quarter-size copy: one full-size 2048 px tint alone took ~80 ms
    const k = S.deadline ? 0.5 : 1, q = rgb.map(v => Math.round(v / 4) * 4), key = name + "|" + q.join(",") + (k < 1 ? "|half" : "");
    let c = imgTint.get(key); if (c) return c;
    if (overBudget()) return null;
    c = document.createElement("canvas"); c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k));
    const x = c.getContext("2d");
    x.drawImage(im, 0, 0, c.width, c.height); x.globalCompositeOperation = "multiply"; x.fillStyle = `rgb(${q})`; x.fillRect(0, 0, c.width, c.height);
    x.globalCompositeOperation = "destination-in"; x.drawImage(im, 0, 0, c.width, c.height);
    c.ow = im.width; c.oh = im.height;   // sizes are laid out from the picture's own size
    imgTint.set(key, c); if (imgTint.size > 60) imgTint.delete(imgTint.keys().next().value);
    return c;
  }
  // v: {W, H, scale, camX, sx, sy}; u1 = screen px per unit at zoom 1 (hills and ground keep screen size)
  function drawBackground(ctx, v, st, sc) {
    const im = tintImage("game_bg_" + sc.bg + "_001-uhd.png", st.col[1000]);
    if (!im) return false;
    // natural size (512 units for a 2048 px tile), its bottom on the ground line: matches the blob size in
    // the GDLM 41 recording; the real game also moves it up and down slower than the camera (not done)
    const u1 = v.H / (30 * 10.67), size = (im.oh || im.height) / PX * u1;
    const w = (im.ow || im.width) / (im.oh || im.height) * size, off = ((v.camX * v.scale * 0.1) % w + w) % w;
    const y = v.sy(0) - size;
    for (let x = -off; x < v.W; x += w) ctx.drawImage(im, x, y, w, size);
    if (y > 0) { ctx.fillStyle = `rgb(${st.col[1000].map(Math.round)})`; ctx.fillRect(0, 0, v.W, y); }
    return true;
  }
  const MG_ABOVE = 40, GLOW_PASSES = 1;
  function drawMiddleground(ctx, v, st, sc) {
    if (!sc.mg) return;
    const u1 = v.H / (30 * 10.67);
    for (const [suffix, ch] of [["_001", 1013], ["_2_001", 1014]]) {
      const im = tintImage("fg_" + pad2(sc.mg) + suffix + "-uhd.png", st.col[ch] || [255, 255, 255]);
      if (!im) continue;
      // the pictures hang mostly below the ground line: only their top ~40 units (the hill row) show
      // above it in the game; the ground is drawn over the rest
      const w = (im.ow || im.width) / PX * u1, h = (im.oh || im.height) / PX * u1, off = ((v.camX * v.scale * 0.3) % w + w) % w;
      for (let x = -off; x < v.W; x += w) ctx.drawImage(im, x, v.sy(0) - MG_ABOVE * u1, w, h);
    }
  }
  function drawGround(ctx, v, st, sc) {
    const gy = v.sy(0); if (gy > v.H) return true;
    const im = tintImage("groundSquare_" + sc.ground + "_001-uhd.png", st.col[1001]);
    if (!im) return false;
    const u1 = v.H / (30 * 10.67), s = (im.ow || im.width) / PX * u1, off = ((v.camX * v.scale) % s + s) % s;
    for (let x = -off; x < v.W; x += s) ctx.drawImage(im, x, gy, s, s);
    const im2 = tintImage("groundSquare_" + sc.ground + "_2_001-uhd.png", st.col[1009] || st.col[1001]);
    if (im2) for (let x = -off; x < v.W; x += s) ctx.drawImage(im2, x, gy, s, s);
    // the floor line: additive, in channel 1002, centred on the screen
    const ln = "floorLine_0" + sc.line + "_001.png", f = S.frames[ln];
    if (f) {
      const c = tinted(ln, st.col[1002] || [255, 255, 255]);
      if (c) { ctx.save(); ctx.globalCompositeOperation = "lighter"; const w = c.width / PX * u1, h = c.height / PX * u1;
        ctx.drawImage(c, v.W / 2 - w / 2, gy - h / 2, w, h); ctx.restore(); }
    }
    return true;
  }

  // GD's part animations (Robot_AnimDesc.plist, Spider_AnimDesc.plist in Resources): name -> frames, each a list of
  // parts {tex, x, y, sx, sy, rot, fx, fy, z} in points (= level units), y up, rotation clockwise in degrees
  function parseAnim(xml) {
    const out = {}, re = /<key>((?:Robot|Spider)_[a-z0-9]+(?:_[a-z]+)*)_(\d+)\.png<\/key>\s*<dict>/g, idx = [];
    let m; while ((m = re.exec(xml))) idx.push([m[1], +m[2], m.index]);
    for (let a = 0; a < idx.length; a++) {
      const [name, n, at] = idx[a], body = xml.slice(at, a + 1 < idx.length ? idx[a + 1][2] : undefined), parts = [];
      const pr = /<key>sprite_\d+<\/key>\s*<dict>([\s\S]*?)<\/dict>/g; let q;
      while ((q = pr.exec(body))) {
        const d = {}, kr = /<key>(\w+)<\/key>\s*<string>([^<]*)<\/string>/g; let k; while ((k = kr.exec(q[1]))) d[k[1]] = k[2];
        if (!d.texture) continue;
        const [x, y] = nums(d.position || "{0,0}"), [sx, sy] = nums(d.scale || "{1,1}"), [fx, fy] = nums(d.flipped || "{0,0}");
        parts.push({ tex: d.texture.replace(/_001\.png$/, ""), x, y, sx, sy, rot: +d.rotation || 0, fx, fy, z: +d.zValue || 0 });
      }
      parts.sort((p1, p2) => p1.z - p2.z);
      (out[name] = out[name] || [])[n - 1] = parts;
    }
    for (const k in out) out[k] = out[k].filter(Boolean);
    return out;
  }
  // which animation, which frame: run on the ground, jump going up, fall coming down (s: the player state)
  function animFrame(mode, s) {
    const A = mode === "robot" ? "Robot" : "Spider", up = (s.vy || 0) * (s.grav || 1) > 0;
    const pick = s.grounded ? [A + "_run"] : up ? [A + "_jump_loop", A + "_jump"] : [A + "_fall_loop", A + "_jump"];
    for (const n of pick) { const fr = S.anim[n]; if (fr && fr.length) return fr[Math.floor((s.tick || 0) / 240 * 24) % fr.length]; }
    return null;
  }

  // ---- the player icon: icon 1 of each mode in the player's colours (P1 green, P2 cyan by default) ----
  const P1 = [125, 255, 0], P2 = [0, 255, 255];
  const ICON = { cube: "player_01", ship: "ship_01", ball: "player_ball_01", wave: "dart_01", ufo: "bird_01", spider: "spider_01", robot: "robot_01", swing: "swing_01" };
  function iconParts(base, c1 = P1, c2 = P2) { return [[base + "_2_001.png", c2], [base + "_001.png", c1], [base + "_extra_001.png", null]].filter(p => S.frames[p[0]]); }
  // the user's own icons and colours (tools/save_icons.js via GET /me/icons): their sheets (Resources/icons/<kind>_NN)
  // are loaded once; drawIcon(..., "user") then draws them, so a run of the user's looks like the user in the game
  const USER = { icons: null, c1: P1, c2: P2 };
  async function loadUserIcons(prof) {
    const KIND = { cube: "player", ship: "ship", ball: "player_ball", ufo: "bird", wave: "dart", robot: "robot", spider: "spider", swing: "swing" }, icons = {};
    await Promise.all(Object.keys(KIND).map(async m => {
      const id = (prof && prof.icons && prof.icons[m]) || 1, name = KIND[m] + "_" + String(id).padStart(2, "0"), sh = "icons/" + name;
      if (S.frames[name + "_001.png"]) { icons[m] = name; return; }
      try { const r = await fetch(S.base + sh + "-uhd.plist"); if (!r.ok) return; const fr = parsePlist(await r.text());
        for (const k in fr) if (!S.frames[k]) { S.frames[k] = fr[k]; S.sheetOf[k] = sh; } icons[m] = name; } catch (e) {}
    }));
    USER.icons = icons; USER.c1 = (prof && prof.color1 && prof.color1.rgb) || P1; USER.c2 = (prof && prof.color2 && prof.color2.rgb) || P2;
    if (S.onload) S.onload();
    return USER;
  }
  // in local units, y up, centred on the player; who = "user": the user's own icon and colours
  function drawIcon(ctx, mode, s, who) {
    const U = who === "user" && USER.icons, c1 = U ? USER.c1 : P1, c2 = U ? USER.c2 : P2;
    if (mode === "robot" || mode === "spider") {   // built from its parts, as GD's animation places them
      const parts = animFrame(mode, s || {});
      if (parts) {
        for (const p of parts) {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(-p.rot * Math.PI / 180); ctx.scale(p.sx * (p.fx ? -1 : 1), p.sy * (p.fy ? -1 : 1));
          for (const [n, c] of iconParts(p.tex, c1, c2)) blit(ctx, n, c, 0);
          ctx.restore();
        }
        return true;
      }
    }
    const base = (U && USER.icons[mode]) || ICON[mode] || ICON.cube;
    if (!S.frames[base + "_001.png"]) return false;
    if (mode === "ship" || mode === "ufo") { ctx.save(); ctx.translate(0, mode === "ship" ? 5 : 5); ctx.scale(0.55, 0.55); for (const [n, c] of iconParts((U && USER.icons.cube) || "player_01", c1, c2)) blit(ctx, n, c, 0); ctx.restore(); }
    for (const [n, c] of iconParts(base, c1, c2)) blit(ctx, n, c, 0);
    return true;
  }

  GD.ART_LIB = { S, budget, parsePlist, info, tree, framesOf, load, preload, has, frameSize, drawObjects, drawNode, blit, colours, layerOf, orderOf, treeOf,
    scenery, drawBackground, drawMiddleground, drawGround, drawIcon, loadUserIcons, USER, parseAnim, SHEETS, ICONS, PX };
})(typeof module !== "undefined" ? module.exports : (window.GD = window.GD || {}));
