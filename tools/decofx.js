// node tools/decofx.js <level.gdlvl> [--theme fire|ice] [--from 0 --to 88] [--fx glow,front,set,motes,fade,camera,scene]
//        [--seed 3] [--out local/decoart] [--tag _fx]
// The "not only flat shapes" pass (DECOART.md "Why it still looks bland", round 5): what rated 2.2 levels have and our
// painted looks did not, added to one stretch of an already dressed level (best after tools/decoart.js --blocks layered):
//   glow    GD's soft glow strip 1293 instead of stacked see-through squares: a gradient inside every open block top
//           (blockart's glowTop strips are swapped for it) and a soft halo rising above the top, on blending channels
//   front   a see-through layer in front of the play (T3): stalactites / icicles hanging into the top of the screen,
//           kept above the play (60+ units over the highest play object near them), and a low heat / frost haze
//   set     one big set piece a screen (behind the play, B2): a gate with a glowing core (fire) or a crystal cluster (ice)
//   motes   embers rising (fire) or snow falling (ice) on two depths (T2 big and few, B2 small and many), carried by moves
//   fade    the front layer and each set piece fade in (alpha 1007) as they come on screen
//   camera  at the stretch's first mode portal: zoom out to 0.85 and back (1913), with a flash on the glow
//   scene   at that portal the palette turns hotter (fire) / colder (ice): colour triggers on the glow, outline and halo
// Writes <out>/<base><tag>.gdlvl. Not heavy (no solve). Also usable from code: require("./decofx.js").fx(level, x0, x1, o).
"use strict";
const fs = require("fs"), path = require("path");
const K = require("./scenekit.js"), O = require("../lib/objects.js");

const THEME = {
  fire: { halo: [255, 110, 40], front: [18, 4, 6], frontRim: [120, 30, 15], haze: [255, 80, 30], set: [34, 8, 12], setRim: [255, 120, 50],
    core: [255, 170, 70], mote: [255, 170, 80], moteDy: 150, moteDx: 20, hot: { glow: [255, 190, 80], line: [255, 220, 120], halo: [255, 150, 60] } },
  ice: { halo: [130, 210, 255], front: [6, 14, 34], frontRim: [70, 140, 200], haze: [170, 230, 255], set: [38, 72, 122], setRim: [120, 190, 240],
    core: [200, 245, 255], mote: [235, 250, 255], moteDy: -150, moteDx: -60, hot: { glow: [190, 150, 255], line: [230, 210, 255], halo: [170, 140, 255] } },
};
// channels and groups this pass owns (blockart uses 900-911, decoart's paintings 700-799, groups 1101-1111)
const CH = { halo: 950, front: 951, frontRim: 952, haze: 953, set: 954, setRim: 955, core: 956, mote: 957 };
const G = { front: 1201, motesFront: 1202, motesBack: 1203, set0: 1210 };
const isBlock = b => (b.id >= 1 && b.id <= 7) || b.id === 83 || b.id === 69;
const PORTALS = new Set([12, 13, 47, 111, 660, 745, 1331, 1933]);

function fx(level, x0, x1, o = {}) {
  const th = THEME[o.theme || "fire"], R = K.rng(o.seed || 3), want = new Set(o.fx || ["glow", "front", "set", "motes", "fade", "camera", "scene"]);
  const out = [], notes = [], ch = {};
  const blockCh = o.blockCh || 900, glowCh = blockCh + 5, lineCh = blockCh + 3;   // blockart.layered's channel order
  const secs = (x1 - x0) / 311.58 + 3;
  // the play: blocks as cells, and the highest play object (not deco, not trigger) per 30-unit column
  const cells = new Map(), top = new Map();
  for (const b of level.objects) {
    if (b.x == null || b.x < x0 - 300 || b.x > x1 + 300) continue;
    if (isBlock(b)) cells.set(Math.round(b.x / 30 - 0.5) + "," + Math.round(b.y / 30 - 0.5), b);
    const k = O.objInfo(b.id).kind;
    if (k && k !== "decoration" && k !== "trigger") { const c = Math.floor(b.x / 30); top.set(c, Math.max(top.get(c) ?? -1e9, b.y + 15)); }
  }
  const playTop = (x, span = 3) => { let m = 0; const c = Math.floor(x / 30); for (let d = -span; d <= span; d++) m = Math.max(m, top.get(c + d) ?? 0); return m; };
  const has = (c, r) => cells.has(c + "," + r);
  const mine = [...cells.entries()].filter(([, b]) => b.x >= x0 && b.x < x1).map(([k]) => k.split(",").map(Number));

  if (want.has("glow")) {
    // swap blockart's stacked glow squares (211 on the glowTop channel) for one soft gradient per open top
    const before = level.objects.length;
    level.objects = level.objects.filter(b => !(b.id === 211 && b.props && b.props[21] === String(glowCh) && b.x >= x0 - 15 && b.x < x1 + 15));
    let n = 0;
    for (const [c, r] of mine) if (!has(c, r + 1)) {
      const X = c * 30, Y = r * 30;
      out.push(K.obj(1293, X + 15, Y + 30 - 10, { ch: glowCh, z: "T1", zo: 6, sx: 2, sy: 0.67, flipY: true }));       // inside: bright at the top edge
      out.push(K.obj(1293, X + 15, Y + 30 + 14, { ch: CH.halo, z: "B1", zo: 0, sx: 2, sy: 0.95 }));                    // above: light rising off it
      n++;
    }
    ch[glowCh] = { rgb: o.theme === "ice" ? [120, 210, 255] : [255, 110, 35], blend: true, opacity: 0.75 };
    ch[CH.halo] = { rgb: th.halo, blend: true, opacity: 0.35 };
    notes.push(`glow: ${n} open tops get 1293 gradients (removed ${before - level.objects.length} glow squares)`);
  }

  if (want.has("front")) {
    // hanging silhouettes from above the screen's top, never reaching into the play
    let n = 0;
    for (let x = x0 + 40 + R() * 80; x < x1; x += 70 + R() * 150) {
      const TOPY = 300, floor = Math.max(130, playTop(x) + 75), len = Math.min(TOPY - floor, 60 + R() * 110);
      if (len < 30) continue;
      const w = 18 + R() * 26, tip = TOPY - len;
      out.push(K.obj(693, x - w / 4 - 3, tip + len / 2 + 4, { ch: CH.frontRim, z: "T3", zo: 1, sx: w / 2 / 30, sy: len / 30, flipY: true, groups: [G.front] }));  // lit rim on the left
      for (const side of [-1, 1])                                          // two right triangles = one downward point
        out.push(K.obj(693, x + side * w / 4, tip + len / 2, { ch: CH.front, z: "T3", zo: 2, sx: w / 2 / 30, sy: len / 30, flipY: true, flipX: side > 0, groups: [G.front] }));
      out.push(K.obj(211, x, TOPY - 4, { ch: CH.front, z: "T3", zo: 2, sx: (w + 10) / 30, sy: 0.3, groups: [G.front] }));   // the root
      n++;
    }
    // a low haze over the ground, see-through
    for (let x = x0; x < x1 + 300; x += 60) out.push(K.obj(1293, x, 12, { ch: CH.haze, z: "T3", zo: 0, sx: 4, sy: 1.6, groups: [G.front] }));
    ch[CH.front] = { rgb: th.front, opacity: 0.88 }; ch[CH.frontRim] = { rgb: th.frontRim, blend: true, opacity: 0.9 }; ch[CH.haze] = { rgb: th.haze, blend: true, opacity: 0.22 };
    notes.push(`front: ${n} hanging silhouettes + a ground haze on T3`);
  }

  if (want.has("set")) {
    let i = 0;
    for (let x = x0 + 420; x < x1 - 60; x += 600, i++) {
      const g = G.set0 + i, gs = [g], base = 0;
      if (o.theme === "ice") {   // kept out of the lane's value: see-through and near the sky's tone
        // a crystal cluster: tall diamonds (squares turned 45 degrees) of three sizes, a glowing core
        for (const [dx, s, h] of [[0, 2.0, 120], [-48, 1.3, 75], [44, 1.5, 85], [-80, 0.8, 40], [78, 0.9, 45]]) {
          out.push(K.obj(211, x + dx - 3, base + h + 3, { ch: CH.setRim, z: "B2", zo: 1, s, rot: 45, groups: gs }));   // lit edge first (drawn under)
          out.push(K.obj(211, x + dx, base + h, { ch: CH.set, z: "B2", zo: 2, s, rot: 45, groups: gs }));
        }
        out.push(K.obj(497, x, base + 120, { ch: CH.core, z: "B2", zo: 3, s: 0.6, groups: gs }));
      } else {
        // a gate: two pillars, a lintel with a point, a glowing core with rays
        for (const side of [-1, 1]) {
          out.push(K.obj(211, x + side * 70, base + 105, { ch: CH.set, z: "B2", zo: 2, sx: 1.3, sy: 7, groups: gs }));
          out.push(K.obj(211, x + side * 70 - 19.5 * side, base + 105, { ch: CH.setRim, z: "B2", zo: 3, sx: 0.08, sy: 7, groups: gs }));
          out.push(K.obj(693, x + side * 35, base + 226, { ch: CH.set, z: "B2", zo: 2, sx: 1.4, sy: 0.8, flipX: side > 0, groups: gs }));
        }
        out.push(K.obj(211, x, base + 205, { ch: CH.set, z: "B2", zo: 2, sx: 5.6, sy: 0.6, groups: gs }));
        out.push(K.obj(497, x, base + 110, { ch: CH.core, z: "B2", zo: 1, s: 1.3, groups: gs }));
        out.push(K.obj(497, x, base + 110, { ch: CH.setRim, z: "B2", zo: 0, s: 1.6, groups: gs }));
      }
      for (let k = 0; k < 5; k++) out.push(K.obj(1293, x + (k - 2) * 26, base + 110, { ch: CH.core, z: "B2", zo: 4, sx: 0.8, sy: 4, rot: (k - 2) * 14, groups: gs }));
      if (want.has("fade")) { out.push(K.alpha(x0 - 30, g, 0, 0)); out.push(K.alpha(x - 640, g, 1, 0.9)); }
    }
    ch[CH.set] = { rgb: th.set, opacity: o.theme === "ice" ? 0.85 : 1 }; ch[CH.setRim] = { rgb: th.setRim, blend: true, opacity: o.theme === "ice" ? 0.3 : 0.4 }; ch[CH.core] = { rgb: th.core, blend: true, opacity: o.theme === "ice" ? 0.16 : 0.3 };   // behind the lane: low contrast, the play stays readable
    notes.push(`set: ${i} set pieces (one a screen)`);
  }

  if (want.has("motes")) {
    const ids = [1764];
    out.push(...K.motes(x0, x1 + 400, { ch: CH.mote, z: "T2", group: G.motesFront, density: 0.9, y0: -20, y1: 300, sMin: 0.5, sMax: 1.1, ids, seed: (o.seed || 3) + 1 }));
    out.push(...K.motes(x0, x1 + 400, { ch: CH.mote, z: "B2", group: G.motesBack, density: 3, y0: -20, y1: 300, sMin: 0.2, sMax: 0.45, ids, seed: (o.seed || 3) + 2 }));
    out.push(K.move(x0 + 15, G.motesFront, th.moteDx * 1.5, th.moteDy * 1.4, secs, 0));
    out.push(K.move(x0 + 15, G.motesBack, th.moteDx, th.moteDy * 0.7, secs, 0));
    ch[CH.mote] = { rgb: th.mote, blend: true, opacity: 0.8 };
    notes.push("motes: two depths");
  }

  if (want.has("fade") && want.has("front")) { out.push(K.alpha(x0 - 30, G.front, 0, 0)); out.push(K.alpha(x0 + 30, G.front, 1, 1.5)); }

  const portal = level.objects.filter(b => PORTALS.has(b.id) && b.x > x0 + 60 && b.x < x1).sort((a, b) => a.x - b.x)[0];
  if (portal && want.has("camera")) {
    out.push(K.zoom(portal.x, 0.85, 0.4), K.zoom(portal.x + 620, 1, 1.0));
    out.push(K.pulse(portal.x, glowCh, [255, 255, 255], 0.05, 0.1, 0.5));
    notes.push(`camera: zoom out at the portal (x ${Math.round(portal.x)})`);
  }
  if (portal && want.has("scene")) {
    out.push(...K.palette(portal.x, { [glowCh]: th.hot.glow, [lineCh]: th.hot.line, [CH.halo]: th.hot.halo }, 0.6));
    notes.push("scene: palette turns at the portal");
  }
  return { objects: out, channels: ch, notes };
}

module.exports = { fx, THEME, CH, G };

if (require.main === module) {
  const io = require("./io.js");
  const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
  const file = args[0];
  if (!file || file.startsWith("--")) { console.log(fs.readFileSync(__filename, "utf8").split("\n").slice(0, 14).join("\n")); process.exit(1); }
  const R = io.readGdlvl(file), L = R.level, theme = opt("--theme", /ice|frost/.test(file) ? "ice" : "fire");
  const x0 = +opt("--from", 0) * 30, x1 = +opt("--to", 88) * 30, tag = opt("--tag", "_fx");
  const r = fx(L, x0, x1, { theme, seed: +opt("--seed", 3), fx: opt("--fx") ? opt("--fx").split(",") : null });
  L.objects.push(...r.objects); L.header = K.channels(L.header, r.channels);
  const OUT = opt("--out", path.join(__dirname, "..", "local", "decoart")); fs.mkdirSync(OUT, { recursive: true });
  const base = path.basename(file, ".gdlvl"), out = path.join(OUT, base + tag + ".gdlvl");
  io.GD.setField(R.rec, "k2", "s", `${R.name}${tag.replace(/_/g, " ")}`);
  io.writeGdlvl(out, R.rec, L);
  console.log(`${out} (${L.objects.length} objects, +${r.objects.length}) ${theme}\n  ` + r.notes.join("\n  "));
}
