// The signature at the end of every GDLM level: a little robot and a little human standing side by side,
// "Made by Claude (and some humans)" above them, and (optional) both bobbing on the beat while the robot
// waves. Only GD objects: pixel art from plain 1x1 deco squares (id 211, no collision) scaled to 6-unit
// pixels (each figure ~2.4 blocks tall), a text object (914), move / rotate triggers.
// (The user, 2026-11-23: "a robot and a human standing side by side ... at the end of the level as a
// signature", signed "Made by Claude (and some humans)".) Owner: the visuals session; make.js and the
// polish tools call it.
//
//   const sig = require("./signature.js");
//   objects.push(...sig.signature({ col, floorY, channels: { main, accent, light }, beats, xOfT }));
//   record description: sig.describe(oldDescription)  -> adds the line once
//
// opts.col      column where the signature starts (default: 3 after the last object); it is 7 blocks wide
// opts.floorY   y the figures stand on (default 0, the ground; a block top: its y + 15)
// opts.channels {accent | shirt, light | text}: the level's colours the shirt copies and the text uses;
//               the rest has its own channels opts.ch0 .. +6 (default 990-996), set just before it.
// opts.beats    level times (s) of the beats near the end, opts.xOfT(t) -> x: the figures bob on each beat
//               the player hears while running up to them, and the robot waves (rotate about its shoulder)
// opts.group0   first free group (default 960; it uses 4)
// opts.text     the line (default SIGN); opts.textScale (default 0.55)
// Checked in our GD-art render (tools/shoot.js); the text is drawn by lib/art.js's text drawing, which
// only approximates GD's font. VISUALS.md "Signature".
"use strict";
const SIGN = "Made by Claude (and some humans)";
const PX = 6, BLOCK = 211;
// pixel art, top row first. Robot (9 wide): d antenna / lights (accent), h head and b body (main),
// e eyes, k mouth (black), a left arm, w the waving right arm (own group), s its shoulder (the turn's
// centre), l legs (darker metal)
const ROBOT = [
  "....d....",
  "....d....",
  ".hhhhhhh.",
  ".heeheeh.",
  ".heeheeh.",
  ".hhhhhhhw",
  ".hhkkkhhw",
  "..bbbbbs.",
  ".abdbdb..",
  ".abbbbb..",
  "..l...l..",
  "..l...l..",
];
// Human (7 wide): r hair, s skin, e eyes and m mouth (black), t shirt, p trousers
const HUMAN = [
  "..rrr..",
  ".rrrrr.",
  ".rssss.",
  ".sesess",
  ".sssss.",
  ".ssmss.",
  "..sss..",
  ".ttttt.",
  "sttttts",
  ".ttttt.",
  ".pp.pp.",
  ".pp.pp.",
];

function signature(opts = {}) {
  // its own colour channels (opts.ch0, default 990..996), set by colour triggers just before it, so the
  // pair looks the same on any level: grey metal, cyan eyes and lights, peach skin, brown hair, navy
  // trousers. The shirt copies one of the level's colours (opts.channels.accent / shirt) when given, so
  // it belongs to the level; else orange. The text takes opts.channels.light / text (default white).
  // (Player colours 1005 / 1006 were tried first: they blend, and the human turned see-through.)
  const C0 = opts.ch0 || 990, oc = opts.channels || {};
  const CH = { metal: C0, metalDark: C0 + 1, glow: C0 + 2, skin: C0 + 3, hair: C0 + 4, shirt: C0 + 5, trousers: C0 + 6 };
  const RGB = { metal: [205, 210, 222], metalDark: [118, 124, 140], glow: [70, 225, 255], skin: [255, 206, 165], hair: [92, 58, 34], shirt: [255, 128, 60], trousers: [44, 62, 128] };
  const copyShirt = oc.shirt || oc.accent || 0, textCh = oc.text || oc.light || 1011;
  const LOOK = { metal: [CH.metal], metalDark: [CH.metalDark], glow: [CH.glow], eye: [CH.glow], mouth: [1010], hair: [CH.hair], skin: [CH.skin], dot: [1010], shirt: [CH.shirt], trousers: [CH.trousers] };
  const col = opts.col != null ? opts.col : 0, floorY = opts.floorY || 0, g0 = opts.group0 || 960;
  const G = { robot: g0, arm: g0 + 1, shoulder: g0 + 2, human: g0 + 3 };
  const out = [];
  for (const k in CH) out.push({ id: 899, x: col * 30 - 30 * 20, y: (opts.floorY || 0) + 420 + 30 * Object.keys(CH).indexOf(k), rot: 0,
    props: Object.assign({ 7: String(RGB[k][0]), 8: String(RGB[k][1]), 9: String(RGB[k][2]), 10: "0", 23: String(CH[k]), 35: "1", 155: "1" },
      k === "shirt" && copyShirt ? { 50: String(copyShirt), 49: "0a1a1a0a0" } : {}) });
  const pix = (x, y, chan, groups, extra) => out.push({ id: BLOCK, x, y, rot: 0, flipX: false, flipY: false,
    props: Object.assign({ 21: String(chan), 24: "3", 25: "5", 32: String(+(PX / 30).toFixed(4)), 57: groups.join("."), 155: "1" }, extra || {}) });
  // robot at the left, human 1.5 blocks to its right; pixel centres from the bottom row up
  const x0 = col * 30 + PX / 2, rows = ROBOT.length;
  ROBOT.forEach((row, r) => [...row].forEach((c, i) => {
    if (c === ".") return;
    const x = x0 + i * PX, y = floorY + (rows - 1 - r) * PX + PX / 2;
    const [chan, hsv] = LOOK[{ d: "glow", h: "metal", b: "metal", a: "metal", w: "metal", s: "metal", l: "metalDark", e: "eye", k: "mouth" }[c]];
    const groups = c === "w" ? [G.robot, G.arm] : c === "s" ? [G.robot, G.shoulder] : [G.robot];
    pix(x, y, chan, groups, Object.assign({}, hsv || {}, c === "e" || c === "k" || c === "d" ? { 25: "6" } : {}));
  }));
  const hx0 = x0 + 9 * PX + 30, hrows = HUMAN.length;
  HUMAN.forEach((row, r) => [...row].forEach((c, i) => {
    if (c === ".") return;
    const x = hx0 + i * PX, y = floorY + (hrows - 1 - r) * PX + PX / 2;
    const [chan, hsv] = LOOK[{ r: "hair", s: "skin", e: "dot", m: "dot", t: "shirt", p: "trousers" }[c]];
    pix(x, y, chan, [G.human], Object.assign({}, hsv || {}, c === "e" || c === "m" ? { 25: "6" } : {}));
  }));
  // the line above them, centred over the pair, a little softer (opacity via the text's own channel)
  const midX = (x0 + hx0 + 6 * PX) / 2, topY = floorY + rows * PX;
  out.push({ id: 914, x: midX, y: topY + 24, rot: 0, props: { 21: String(textCh), 24: "5", 31: Buffer.from(opts.text || SIGN).toString("base64").replace(/\+/g, "-").replace(/\//g, "_"),
    32: String(opts.textScale || 0.42), 155: "1" } });
  // animation: on each beat the player hears within reach, both hop 4 units and the robot's arm swings
  if (opts.beats && opts.xOfT) {
    let k = 0;
    const tEnd = opts.beats.length ? opts.beats[opts.beats.length - 1] : 0;
    for (const bt of opts.beats) {
      const x = opts.xOfT(bt); if (x > x0) break;
      if (x < x0 - 30 * 26) continue; // only the last ~26 blocks: what the player sees of the signature
      const half = Math.max(0.08, (opts.period || 0.4) / 2);
      for (const g of [G.robot, G.human]) {
        out.push({ id: 901, x, y: floorY + 300, rot: 0, props: { 10: String(+half.toFixed(3)), 28: "0", 29: "4", 30: "2", 51: String(g), 155: "1" } });
        out.push({ id: 901, x: x + 1, y: floorY + 330, rot: 0, props: { 10: String(+half.toFixed(3)), 28: "0", 29: "-4", 30: "1", 51: String(g), 155: "1" }, delayed: half });
      }
      out.push({ id: 1346, x, y: floorY + 360, rot: 0, props: { 10: String(+half.toFixed(3)), 51: String(G.arm), 68: String(k % 2 ? -40 : 40), 70: "1", 71: String(G.shoulder), 30: "1", 155: "1" } });
      k++;
    }
    // the falling half of each hop has to start half a beat later: put it where the player is then
    for (const o of out) if (o.delayed) { const t = opts.tOfX ? opts.tOfX(o.x) : null; if (t != null) o.x = opts.xOfT(t + o.delayed); delete o.delayed; }
    if (!opts.tOfX) for (const o of out) delete o.delayed;
    void tEnd;
  }
  return out;
}
// the record's description (k3) gets the line once
function describe(desc) {
  desc = String(desc || "").trim();
  return desc.includes(SIGN) ? desc : (desc ? desc + " -- " : "") + SIGN;
}
module.exports = { signature, describe, SIGN, ROBOT, HUMAN };

// node tools/signature.js <level.gdlvl> [--out file]  -- add the signature to a copy of a level (end of
// the level, on the ground, beats from local/beats when the song has them) -> local/tmp/<name>_sig.gdlvl,
// to look at with tools/shoot.js
if (require.main === module) {
  const path = require("path"), fs = require("fs"), { readGdlvl, writeGdlvl, GD } = require("./io.js");
  const args = process.argv.slice(2), opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
  const L = readGdlvl(args[0]), objs = L.level.objects;
  const lastCol = Math.ceil(Math.max(...objs.map(o => o.x)) / 30);
  // beats: the song's grid (tools/beats.js), level time = song time - offset (header kA13)
  let beats = null, period = 0.4;
  const speed = 311.58, xOfT = t => t * speed, tOfX = x => x / speed;
  try {
    const song = GD.getField(L.rec, "k45"), b = require("./beats.js").loadBeats("custom_" + song);
    const off = +(/(?:^|,)kA13,([-0-9.]+)/.exec(L.level.header) || [0, 0])[1];
    if (b && b.ok) { period = b.period; beats = []; for (let k = 0; k < 2000; k++) { const t = b.t0 + k * b.period - off; if (t > 0) beats.push(t); if (xOfT(t) > (lastCol + 12) * 30) break; } }
  } catch (e) {}
  const sig = signature({ col: lastCol + 4, beats, period, xOfT, tOfX });
  GD.setField(L.rec, "k2", "s", L.name + " +sig");
  GD.setField(L.rec, "k3", "s", Buffer.from(describe(Buffer.from(GD.getField(L.rec, "k3") || "", "base64").toString())).toString("base64"));
  const out = opt("--out") || path.join(__dirname, "..", "local", "tmp", path.basename(args[0], ".gdlvl") + "_sig.gdlvl");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  writeGdlvl(out, L.rec, { header: L.level.header, objects: objs.concat(sig) });
  console.log(`signature: ${sig.length} objects (${sig.filter(o => o.id === BLOCK).length} pixels, ${sig.filter(o => o.id === 901 || o.id === 1346).length} triggers) at column ${lastCol + 4} -> ${path.relative(process.cwd(), out)}`);
}
