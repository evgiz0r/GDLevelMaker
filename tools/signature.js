// The signature at the end of every GDLM level: a little robot and a little human high-fiving on a small
// lit stage under a spotlight, a spark where their hands meet, and two lines of text above them:
// "MADE BY CLAUDE" / "(and some humans)". On the beat (when the song's beats are given) both bob, the
// spark and the stage's edge flash, and the spotlight breathes.
// Only GD objects: pixel art from plain 1x1 deco squares (id 211, no collision) scaled to 6-unit pixels
// (the pair is ~2.8 blocks tall), gradients (1293) for the spotlight, a circle (497) for the halo, text
// objects (914), move / pulse triggers.
// (The user, 2026-11-23: "a robot and a human standing side by side ... at the end of the level as a
// signature", signed "Made by Claude (and some humans)"; then "Can we improve the signage in the end"
// after seeing v1 in the phone's editor: pale, see-through, wrong colours, no stage.) Owner: the visuals
// session; make.js calls it for every GDLM level, polish tools may too. VISUALS.md "Signature".
//
//   const sig = require("./signature.js");
//   header = sig.header(header, opts);                 // REQUIRED: the signature's colours live in the header
//   objects.push(...sig.signature({ col, floorY, beats, period, xOfT, tOfX }));
//   record description: sig.describe(oldDescription)  -> adds the line once
//
// Why the header: v1 set its channels (990-996) only with colour triggers near the end. The editor does
// not run triggers, so it showed those channels in its own placeholder colours (pale green / blue / pink,
// see-through) -- the user's phone screenshot of hellgate v12. Channels defined in the header (kS38) look
// the same in the editor and the game from the first frame. v1 also drew the eyes in channel 1010, which
// our header template lists as white: now a channel of its own.
//
// opts.col      column where the signature starts (default 0); it is ~8 blocks wide
// opts.floorY   y the stage stands on (default 0, the ground; a block top: its y + 15)
// opts.ch0      first of its 12 channels (default 988: 988 .. 999)
// opts.shirt    [r,g,b] of the human's shirt (e.g. the level's accent colour; default orange)
// opts.beats    level times (s) of the beats near the end, with opts.xOfT(t) -> x and opts.tOfX(x) -> t:
//               the animation follows the beats the player hears while running up to the signature
// opts.period   seconds per beat (default 0.5)
// opts.group0   first free group (default 960; it uses 5)
// opts.text / opts.text2  the two lines (default "MADE BY CLAUDE" / "(and some humans)")
// Checked in our GD-art render (tools/shoot.js); GD's font is approximated there. In the game the text is
// GD's own font (as the user's screenshot shows).
"use strict";
const SIGN = "Made by Claude (and some humans)";
const PX = 6, BLOCK = 211;
// the pair, top row first, 19 pixels wide. Robot (left): d antenna, e eyes and c chest lights (glow),
// h head / b body / a arms (metal), k mouth (dark), l legs and feet (dark metal). Human (right): r hair,
// s skin, o eyes and mouth (dark), t shirt, p trousers, f shoes (dark). The robot's right arm and the
// human's left arm go up and their hands meet over the gap (high five); y is the spark there.
const PAIR = [
  ".........yy........",
  "........y..y.......",
  ".........as........",
  "....d....a.s.......",
  "....d....a.s.rrrrr.",
  ".hhhhhhh.a.s.rssss.",
  ".heeheeh.a.s.sosos.",
  ".heeheeh.a.s.sssss.",
  ".hhkkkhha..s.ssoss.",
  "..bbbbba...ttttttt.",
  ".abcbcb......ttttts",
  ".abbbbb......ttttts",
  "..l...l......pp.pp.",
  ".ll...ll.....ff.ff.",
];
const PART = { d: "glow", e: "glow", c: "glow", y: "spark", h: "metal", b: "metal", a: "metal", k: "dark", l: "metalDark",
  r: "hair", s: "skin", o: "dark", t: "shirt", p: "trousers", f: "dark" };
const ROBOT = new Set("deckyhbal".split("").filter(c => c !== "y")), SPARK = "y";

function channelsOf(opts = {}) {
  const C0 = opts.ch0 || 988;
  const names = ["text", "spot", "metal", "metalDark", "glow", "skin", "hair", "shirt", "trousers", "dark", "stage", "spark"];
  const CH = {}; names.forEach((n, i) => CH[n] = C0 + i);
  const RGB = { text: [255, 214, 92], spot: [255, 236, 190], metal: [196, 204, 220], metalDark: [104, 112, 132], glow: [64, 226, 255],
    skin: [255, 204, 160], hair: [96, 56, 30], shirt: opts.shirt || [255, 122, 48], trousers: [40, 64, 150], dark: [18, 18, 26],
    stage: [34, 30, 46], spark: [255, 246, 160] };
  return { CH, RGB, blend: { spot: true, spark: true } };
}

// the signature's channels written into a level header (kS38): base colour, full opacity, the spotlight
// and spark blending (additive light). Replaces those channels when the header has them already.
function header(h, opts = {}) {
  const { CH, RGB, blend } = channelsOf(opts);
  return h.replace(/kS38,([^,]*)/, (all, list) => {
    const mine = new Set(Object.values(CH).map(String));
    const keep = list.split("|").filter(c => c && !mine.has((/(?:^|_)6_(\d+)(?:_|$)/.exec(c) || [])[1]));
    for (const n in CH) { const [r, g, b] = RGB[n]; keep.push(`1_${r}_2_${g}_3_${b}_11_255_12_255_13_255_4_-1_6_${CH[n]}` + (blend[n] ? "_5_1" : "") + "_7_1_15_1_18_0_8_1"); }
    return "kS38," + keep.join("|") + "|";
  });
}

function signature(opts = {}) {
  const { CH, RGB } = channelsOf(opts);
  const col = opts.col != null ? opts.col : 0, floorY = opts.floorY || 0, g0 = opts.group0 || 960;
  const G = { robot: g0, human: g0 + 1, spark: g0 + 2, spot: g0 + 3, stageEdge: g0 + 4 };
  const out = [], r3 = v => String(+(+v).toFixed(3));
  const o = (id, x, y, p) => out.push({ id, x: +x.toFixed(2), y: +y.toFixed(2), rot: 0, flipX: false, flipY: false, props: Object.assign({ 155: "1" }, p) });
  // the colours again as triggers just before it (0 s): only a safety net when a caller forgot header();
  // the header is what the editor and the first frame show
  Object.keys(CH).forEach((n, i) => o(899, col * 30 - 600, floorY + 390 + 30 * (i % 6), { 7: String(RGB[n][0]), 8: String(RGB[n][1]), 9: String(RGB[n][2]),
    10: "0", 23: String(CH[n]), 35: "1", 36: "1" }));
  const W = PAIR[0].length, rows = PAIR.length;
  // stage: a plinth 15 units high, 3 px wider than the pair on each side, a lit top edge
  const stageH = 15, sx0 = col * 30, sw = (W + 6) * PX, top = floorY + stageH;
  o(BLOCK, sx0 + sw / 2, floorY + stageH / 2, { 21: String(CH.stage), 24: "3", 25: "1", 128: r3(sw / 30), 129: r3(stageH / 30) });
  o(BLOCK, sx0 + sw / 2, top - 1.5, { 21: String(CH.glow), 24: "3", 25: "2", 128: r3(sw / 30), 129: r3(3 / 30), 57: String(G.stageEdge) });
  // halo behind the pair (circle, spotlight colour, blending) and the spotlight from above: two gradients
  // (1293, bright at the top) leaning in from both sides onto the stage
  const cx = sx0 + sw / 2, x0 = sx0 + 3 * PX + PX / 2;
  o(497, cx, top + rows * PX * 0.55, { 21: String(CH.spot), 24: "-1", 25: "0", 32: "1.5", 57: String(G.spot), 41: "1", 43: "0a1a0.28a0a0" });
  for (const s of [-1, 1]) { o(1293, cx + s * 22, top + 150, { 21: String(CH.spot), 24: "-1", 25: "1", 128: "2.6", 129: "9", 57: String(G.spot), 41: "1", 43: "0a1a0.6a0a0" }); Object.assign(out[out.length - 1], { rot: s * 9, flipY: true }); }
  // the pair
  PAIR.forEach((row, r) => [...row].forEach((c, i) => {
    if (c === ".") return;
    const part = PART[c], x = x0 + i * PX, y = top + (rows - 1 - r) * PX + PX / 2;
    const groups = c === SPARK ? [G.spark] : ROBOT.has(c) ? [G.robot] : [G.human];
    o(BLOCK, x, y, { 21: String(CH[part]), 24: "3", 25: part === "dark" || part === "glow" ? "6" : "5", 32: r3(PX / 30), 57: groups.join(".") });
  }));
  // two lines above: the name big in gold, the humans smaller in white
  const ty = top + rows * PX + 26;
  const txt = (s, y, scale, ch) => o(914, cx, y, { 21: String(ch), 24: "5", 25: "8", 32: r3(scale),
    31: Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_") });
  txt(opts.text || "MADE BY CLAUDE", ty + 20, 0.62, CH.text);
  txt(opts.text2 || "(and some humans)", ty, 0.4, 1011);
  // on the beat: both hop 4 units and land, the spark and the stage edge flash white, the spotlight
  // breathes (a pulse up on every other beat). Only the beats heard in the last ~26 blocks before it.
  if (opts.beats && opts.xOfT) {
    const per = opts.period || 0.5, half = Math.max(0.08, per / 2);
    let k = 0;
    for (const bt of opts.beats) {
      const x = opts.xOfT(bt); if (x > cx) break;
      if (x < cx - 30 * 26) continue;
      const ty2 = floorY + 300;
      for (const g of [G.robot, G.human, G.spark]) {
        o(901, x, ty2, { 10: r3(half), 28: "0", 29: "4", 30: "2", 51: String(g), 36: "1" });
        const xb = opts.tOfX ? opts.xOfT(opts.tOfX(x) + half) : x + 1;
        o(901, xb, ty2 + 30, { 10: r3(half), 28: "0", 29: "-4", 30: "1", 51: String(g), 36: "1" });
      }
      o(1006, x, ty2 + 60, { 51: String(CH.spark), 52: "0", 7: "255", 8: "255", 9: "255", 45: "0.03", 46: "0.05", 47: r3(per * 0.8), 36: "1" });
      o(1006, x, ty2 + 90, { 51: String(CH.glow), 52: "0", 7: "200", 8: "250", 9: "255", 45: "0.03", 46: "0.03", 47: r3(per * 0.7), 36: "1" });
      if (k % 2 === 0) o(1006, x, ty2 + 120, { 51: String(CH.spot), 52: "0", 7: "255", 8: "255", 9: "255", 45: r3(per * 0.4), 46: "0", 47: r3(per * 1.4), 36: "1" });
      k++;
    }
  }
  return out;
}
// the record's description (k3) gets the line once
function describe(desc) {
  desc = String(desc || "").trim();
  return desc.includes(SIGN) ? desc : (desc ? desc + " -- " : "") + SIGN;
}
module.exports = { signature, header, describe, channelsOf, SIGN, PAIR };

// node tools/signature.js <level.gdlvl> [--out file]  -- add the signature to a copy of a level (end of
// the level, on the ground, beats from local/beats when the song has them) -> local/tmp/<name>_sig.gdlvl,
// to look at with tools/shoot.js
if (require.main === module) {
  const path = require("path"), fs = require("fs"), { readGdlvl, writeGdlvl, GD } = require("./io.js");
  const args = process.argv.slice(2), opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
  const L = readGdlvl(args[0]), maxX = Math.max(...L.level.objects.map(o => o.x));
  // drop an older signature (its groups 960+ / channels 988-999) so the copy shows only the new one
  const objs = L.level.objects.filter(o => !(o.x > maxX - 1200 && (/^9[6-6]\d/.test((o.props || {})[57] || "") || +(o.props || {})[21] >= 988 && +(o.props || {})[21] <= 999
    || (o.id === 899 && +(o.props || {})[23] >= 988 && +(o.props || {})[23] <= 999) || o.id === 914)));
  const lastCol = Math.ceil(Math.max(...objs.map(o => o.x)) / 30);
  let beats = null, period = 0.5;
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
  writeGdlvl(out, L.rec, { header: header(L.level.header), objects: objs.concat(sig) });
  console.log(`signature: ${sig.length} objects (${sig.filter(o => o.id === BLOCK).length} pixels, ${sig.filter(o => [901, 1006].includes(o.id)).length} beat triggers) at column ${lastCol + 4} -> ${path.relative(process.cwd(), out)}`);
}
