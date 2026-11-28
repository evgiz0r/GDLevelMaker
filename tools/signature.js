// 2026-11-28: the default is overlay() below -- a human holding a wand tipped with the Claude spark, "MADE BY HUMANS" /
// "with Claude", quiet over the last 5 s (Evgeni: "tune down the joke ... its like its empowering the human, not replacing").
// signature() is the older stage sign (opt-in; robot + human):
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
// opts.floorY   the ground / block top under it (default 0); the stage floats opts.lift (default 50) above it
// opts.ch0      first of its 14 channels (default 976: 976 .. 989)
// opts.shirt    [r,g,b] of the human's shirt (e.g. the level's accent colour; default orange)
// opts.beats    level times (s) of the beats near the end, with opts.xOfT(t) -> x and opts.tOfX(x) -> t:
//               the animation follows the beats the player hears while running up to the signature
// opts.period   seconds per beat (default 0.5)
// opts.group0   first free group (default 960; it uses 5)
// opts.text / opts.text2  the two lines (default "MADE BY CLAUDE" / "(and some humans)")
// Checked in our GD-art render (tools/shoot.js); GD's font is approximated there. In the game the text is
// GD's own font (as the user's screenshot shows).
"use strict";
const SIGN = "Made by humans, with Claude";
const OLD_SIGNS = ["Made by Claude (and some humans)"];   // replaced in a description by describe()
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

// The figures come from the prop library (lib/props.js "robot" / "human", ART.md; v3, 2026-11-23): 3-unit
// pixels, outlined, both colour keys 21 + 22 set (the v2 pixels had only 21 and showed WHITE in the game --
// the colour question is still open, ART.md "Colour"). PAIR above is v2's drawing, kept for reference.
// Its channels: one per colour name from ch0 (default 976 .. 989), all written by props.header().
const P = require("../lib/props.js");
const NAMES = ["text", "spot", "stage", "spark", "outline", "metal", "metal2", "light", "dark", "glow", "skin", "hair", "shirt", "trousers"];
function channelsOf(opts = {}) {
  const C0 = opts.ch0 || 976, CH = {};
  NAMES.forEach((n, i) => CH[n] = C0 + i);
  CH.eye = CH.glow; CH.roof = CH.dark;            // the robot's chest light and the human's mouth share channels
  const RGB = { text: [255, 214, 92], spot: [255, 236, 190], stage: [34, 30, 46], spark: [255, 246, 160], outline: [14, 12, 20],
    metal: [196, 204, 220], metal2: [118, 126, 146], light: [236, 242, 255], dark: [18, 18, 26], glow: [64, 226, 255],
    skin: [255, 204, 160], hair: [96, 56, 30], shirt: opts.shirt || [255, 122, 48], trousers: [40, 64, 150] };
  RGB.eye = RGB.glow; RGB.roof = RGB.dark;
  // the Claude spark badge (lib/claude_icons.js kit "spark": cream rays on a terracotta disc), on the three channels just
  // below ch0 (973-975 by default: kept out of 988-999 while the colour question is open, ART.md "Colour")
  BADGE.forEach((n, i) => CH[n] = C0 - BADGE.length + i);
  Object.assign(RGB, { claude: [210, 112, 80], claude2: [162, 78, 54], claudeRay: [248, 240, 226] });
  return { CH, RGB, blend: { spot: true, spark: true } };
}
const BADGE = ["claude", "claude2", "claudeRay"];
// {channel: rgb} of every channel the signature uses
function colours(opts = {}) { const { CH, RGB } = channelsOf(opts), c = {}; for (const n of NAMES.concat(BADGE)) c[CH[n]] = RGB[n]; return c; }

// the signature's channels into a level header (kS38), through props.header (one channel scheme); the
// spotlight and the spark blend (additive light)
function header(h, opts = {}) {
  const { CH, blend } = channelsOf(opts);
  h = P.header(h, colours(opts));
  for (const n of Object.keys(blend)) h = h.replace(new RegExp(`(_6_${CH[n]})(_7_)`), "$1_5_1$2");
  return h;
}

// opts.lift  how high the stage floats over opts.floorY (default 50; was 90, which put the title at y 232, above the game's view top
//            ~227 for a cube on the ground -- lib/camera.js: bottom 93 under the ground, 320 tall; cut off in GDLM 72, the
//            user 2026-11-25): the level's end line lies
//            past the signature, so the player runs on under it -- the figures stand clear of the path
//            (GDLM 60: the cube ran through v2's figures standing on the ground)
function signature(opts = {}) {
  const { CH, RGB } = channelsOf(opts);
  const col = opts.col != null ? opts.col : 0, floorY = (opts.floorY || 0) + (opts.lift == null ? 50 : opts.lift), g0 = opts.group0 || 960;
  const G = { robot: g0, human: g0 + 1, spark: g0 + 2, spot: g0 + 3, stageEdge: g0 + 4 };
  const out = [], r3 = v => String(+(+v).toFixed(3));
  const o = (id, x, y, p) => out.push({ id, x: +x.toFixed(2), y: +y.toFixed(2), rot: 0, flipX: false, flipY: false, props: Object.assign({ 155: "1" }, p) });
  const both = ch => ({ 21: String(ch), 22: String(ch) });
  // the colours again as triggers just before it (0 s): only a safety net when a caller forgot header()
  NAMES.forEach((n, i) => o(899, col * 30 - 600, floorY + 300 + 30 * (i % 7), { 7: String(RGB[n][0]), 8: String(RGB[n][1]), 9: String(RGB[n][2]),
    10: "0", 23: String(CH[n]), 35: "1", 36: "1" }));
  // stage: a floating plinth 12 units high, 6 blocks wide, a lit top edge
  const stageH = 12, sx0 = col * 30, sw = 180, top = floorY + stageH, cx = sx0 + sw / 2;
  o(211, cx, floorY + stageH / 2, Object.assign(both(CH.stage), { 24: "3", 25: "1", 128: r3(sw / 30), 129: r3(stageH / 30) }));
  o(211, cx, top - 1.5, Object.assign(both(CH.glow), { 24: "3", 25: "2", 128: r3(sw / 30), 129: r3(3 / 30), 57: String(G.stageEdge) }));
  // the spotlight from above: two gradients (1293) leaning in onto the stage (no halo ring: rings read as orbs)
  for (const s of [-1, 1]) { o(1293, cx + s * 22, top + 150, Object.assign(both(CH.spot), { 24: "-1", 25: "1", 128: "2.6", 129: "9", 57: String(G.spot), 41: "1", 43: "0a1a0.6a0a0" })); Object.assign(out[out.length - 1], { rot: s * 9, flipY: true }); }
  // the pair from the prop library, side by side, facing each other
  const alloc = P.allocator(CH.text, Object.assign({}, CH));
  const robot = P.put("robot", cx - 27, top, { alloc, colours: RGB, groups: [G.robot], zo: 4, layer: "B1" });
  const human = P.put("human", cx + 27, top, { alloc, colours: RGB, groups: [G.human], zo: 4, layer: "B1", flipX: true });
  out.push(...robot.objects, ...human.objects);
  // a small spark between their heads
  const headY = top + 2.2 * 30;
  for (const [dx, dy] of [[0, 0], [-4, 4], [4, 4], [0, 8]]) o(211, cx + dx, headY + dy, Object.assign(both(CH.spark), { 24: "3", 25: "9", 32: r3(4 / 30), 57: String(G.spark) }));
  // two lines above: the name big in gold, the humans smaller in white
  const ty = top + 2.8 * 30 + 26;
  const txt = (s, y, scale, ch) => o(914, cx, y, Object.assign(both(ch), { 24: "5", 25: "8", 32: r3(scale),
    31: Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_") }));
  txt(opts.text || "MADE BY HUMANS", ty + 20, 0.62, CH.text);
  txt(opts.text2 || "with Claude", ty, 0.4, 1011);
  // the Claude spark crowning the sign (the user, 2026-11-24: "add such icon also in the sign in the end of the level"):
  // a round terracotta badge with 12 cream rays, 2 blocks, above the gold title; it hops with the spark group on the beat.
  // Private levels only for now: the spark evokes Anthropic's Claude mark (ART.md "Claude icons").
  if (opts.badge !== false) {
    const CI = require("../lib/claude_icons.js"), PA = require("../lib/pixelart.js");
    const b = PA.toObjects(CI.badge(24), { x: cx, y: ty + 20 + 48, px: 2.5, anchor: "center", z: "B1", zo: 10, groups: [G.spark],
      ch: { outline: CH.outline, body: CH.claude, shade: CH.claude2, mark: CH.claudeRay } });
    out.push(...b.objects);
  }
  // on the beat: both hop 4 units and land, the spark and the stage edge flash, the spotlight breathes
  // (every other beat). Only the beats heard in the last ~26 blocks before it.
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
// The quiet sign: the default ending since 2026-11-27 (Evgeni: "cut our signature for now from actual gameplay and make it
// appear in like the last 5 seconds of the level not bothering the game play with whatever effects"). No stage, no
// spotlight, no beat bobs / pulses / flashes, no run-on blocks: the pair, the two lines and the badge, smaller (opts.scale,
// default 0.55), behind the player (B1), fade in once at T - secs and ride with the camera (move 901 lock to camera x + y)
// to the end. Nothing past the level's own end: the level still ends at its last gameplay object.
//   objects.push(...sig.overlay({ endX, xOfT, tOfX, secs: 5, camY }))  + header = sig.header(header, {})
// opts.endX   x of the level's end (its last gameplay object / end marker); the sign shows over the last opts.secs before it
// opts.cam    the camera at T - secs (lib/camera.js: the level y at the ground line's row; default 0 = a cube near the ground):
//             the sign hangs in the view's top right, its top 12 units under the view's top (cam + 227 at 16:9)
// opts.dx     units right of the player where the sign's centre sits when it appears (default 250; the player is 36% across
//             a 569-unit view, so the right edge is ~364 ahead)
function overlay(opts = {}) {
  // v2 (Evgeni, 2026-11-28: "tune down the joke ... made by humans, but with claude, and somehow a wand a human holds";
  // "its like its empowering the human, not replacing"): ONE figure, the human, holding up a wand whose tip is the Claude
  // spark; "MADE BY HUMANS" over "with Claude". No robot: Claude is the tool in the human's hand.
  const { CH, RGB } = channelsOf(opts), sc = opts.scale || 0.7, secs = opts.secs == null ? 5 : opts.secs;
  const tEnd = opts.tOfX(opts.endX), t0 = Math.max(0.5, tEnd - secs), x0 = opts.xOfT(t0);
  const H = 152;   // the title's top over the feet, at scale 1
  const cx = x0 + (opts.dx == null ? 250 : opts.dx), base = (opts.cam || 0) + 227 - 12 - H * sc;
  const G = (opts.group0 || 960) + 5, out = [], r3 = v => String(+(+v).toFixed(3));
  const o = (id, x, y, p) => out.push({ id, x: +x.toFixed(2), y: +y.toFixed(2), rot: 0, flipX: false, flipY: false, props: Object.assign({ 155: "1" }, p) });
  const both = ch => ({ 21: String(ch), 22: String(ch) });
  const alloc = P.allocator(CH.text, Object.assign({}, CH));
  // the human (prop "human": 14 x 26 pixels of 3 units, feet at y); its right hand is pixel column 12-13, row 17-18 from the top
  const hx = cx - 12 * sc;
  const human = P.put("human", hx, base, { alloc, colours: RGB, groups: [G], zo: 4, layer: "B1", scale: sc });
  out.push(...human.objects);
  // the wand: a thin rod from the hand up and out, the Claude spark at its tip, a few still sparkles round it (no effects)
  const hand = [hx + 19.5 * sc, base + 25 * sc], tip = [hx + 42 * sc, base + 82 * sc];
  const len = Math.hypot(tip[0] - hand[0], tip[1] - hand[1]), ang = Math.atan2(tip[0] - hand[0], tip[1] - hand[1]) * 180 / Math.PI;
  o(211, (hand[0] + tip[0]) / 2, (hand[1] + tip[1]) / 2, Object.assign(both(CH.outline), { 24: "3", 25: "5", 128: r3(4.5 * sc / 30), 129: r3(len / 30), 57: String(G) }));
  Object.assign(out[out.length - 1], { rot: +ang.toFixed(2) });
  o(211, (hand[0] + tip[0]) / 2, (hand[1] + tip[1]) / 2, Object.assign(both(CH.light), { 24: "3", 25: "6", 128: r3(2 * sc / 30), 129: r3((len - 3) / 30), 57: String(G) }));
  Object.assign(out[out.length - 1], { rot: +ang.toFixed(2) });
  if (opts.badge !== false) {
    const CI = require("../lib/claude_icons.js"), PA = require("../lib/pixelart.js");
    const b = PA.toObjects(CI.badge(24), { x: tip[0], y: tip[1], px: 1.1 * sc, anchor: "center", z: "B1", zo: 10, groups: [G],
      ch: { outline: CH.outline, body: CH.claude, shade: CH.claude2, mark: CH.claudeRay } });
    out.push(...b.objects);
  }
  for (const [dx, dy, s] of [[-18, 4, 3], [17, 10, 2.5], [-6, 20, 2], [19, -9, 2], [-15, -12, 2.5]])
    o(211, tip[0] + dx * sc, tip[1] + dy * sc, Object.assign(both(CH.spark), { 24: "3", 25: "9", 32: r3(s * sc / 30), 6: "45", 57: String(G) }));
  // the words: what it is (made by humans) big, how (with Claude) small, over the figure
  const txt = (str, y, scale, ch) => o(914, cx, y, Object.assign(both(ch), { 24: "3", 25: "8", 32: r3(scale * sc), 57: String(G),
    31: Buffer.from(str).toString("base64").replace(/\+/g, "-").replace(/\//g, "_") }));
  txt(opts.text || "MADE BY HUMANS", base + 140 * sc, 0.62, CH.text);
  txt(opts.text2 || "with Claude", base + 118 * sc, 0.45, 1011);
  // hidden until T - secs (the alpha well before it comes into view), then one calm fade in, locked to the camera to the end
  const ty2 = base + 300;
  o(1007, Math.max(15, x0 - 700), ty2, { 36: "1", 51: String(G), 35: "0", 10: "0" });
  o(1007, x0, ty2 + 30, { 36: "1", 51: String(G), 35: r3(opts.opacity || 0.92), 10: "0.8" });
  o(901, x0, ty2 + 60, { 36: "1", 51: String(G), 28: "0", 29: "0", 10: r3(secs + 3), 85: "2", 141: "1", 143: "1", 142: "1", 144: "1" });
  return out;
}
// Where the level must end so the sign is still on screen at the end (Evgeni, 2026-11-26: "the end screen has to include our
// sign, it extends bit too much so our signature goes away"). GD ends a level at its FURTHEST object (any kind) and puts the
// end wall ~340 units past it; the camera stops with the wall at the screen's right edge, and a 16:9 screen is ~569 units
// (19 blocks) wide, so the last view shows only the last ~229 units before the furthest object. The sign is ~7 blocks wide
// (text ~117 units each side of its centre at col + 3 blocks), so nothing may lie past its right edge: extent(col).x1.
// Not measured in a recording yet (the end wall's 340 and the stop are from memory); the user's report fits it (the old end,
// 7.5 blocks past the sign's centre, showed the sign leaving the screen).
const TEXT_HALF = 117;
function extent(col) { const cx = (col || 0) * 30 + 90; return { x0: cx - TEXT_HALF, x1: cx + TEXT_HALF, cx }; }
// drop every object past the sign's right edge (blocks, deco, triggers: GD counts them all); returns the kept objects
function clipEnd(objects, col) { const x1 = extent(col).x1; return objects.filter(o => !(o.x > x1)); }
// the record's description (k3) gets the line once
function describe(desc) {
  desc = String(desc || "").trim();
  for (const old of OLD_SIGNS) desc = desc.split(old).join(SIGN);
  return desc.includes(SIGN) ? desc : (desc ? desc + " -- " : "") + SIGN;
}
module.exports = { signature, overlay, header, describe, extent, clipEnd, TEXT_HALF, channelsOf, colours, SIGN, OLD_SIGNS, PAIR };

// node tools/signature.js <level.gdlvl> [--out file]  -- add the signature to a copy of a level (end of
// the level, on the ground, beats from local/beats when the song has them) -> local/tmp/<name>_sig.gdlvl,
// to look at with tools/shoot.js
if (require.main === module) {
  const path = require("path"), fs = require("fs"), { readGdlvl, writeGdlvl, GD } = require("./io.js");
  const args = process.argv.slice(2), opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
  const L = readGdlvl(args[0]), maxX = Math.max(...L.level.objects.map(o => o.x));
  // drop an older signature (its groups 960+ / channels 988-999) so the copy shows only the new one
  const objs = L.level.objects.filter(o => !(o.x > maxX - 1200 && (/^9[6-6]\d/.test((o.props || {})[57] || "") || +(o.props || {})[21] >= 976 && +(o.props || {})[21] <= 999
    || (o.id === 899 && +(o.props || {})[23] >= 976 && +(o.props || {})[23] <= 999) || o.id === 914)));
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
