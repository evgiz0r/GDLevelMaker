// node tools/decowin.js <level.gdlvl | official:N | id> --at <block>[,<block>...] [--w 24] [--out local/deco/<name>.png] [--ppu 2]
// A quick, ART-FREE picture of a window of a level, to judge decoration while iterating (ART.md "Deco library"): every
// object in layer order (key 24 / catalogue default), deco squares (211 & friends) and triangles (693) as flat shapes in
// their channel's start colour (header kS38; HSV value shifts applied), play blocks as dark squares with a light edge,
// spikes as triangles, other ids as a faint box. No solve, no GD art: light enough to run any time. Colour triggers are
// ignored (start colours only). Several --at blocks -> one PNG with the windows stacked, each labelled with objects
// per block in view. For the real look use tools/shoot.js (heavy, GD art).
"use strict";
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ROOT = path.join(__dirname, ".."), LOOK = require("../lib/look.js").LOOK, O = require("../lib/objects.js");
const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const CAT = {};
for (const line of fs.readFileSync(path.join(ROOT, "knowledge", "objects", "catalogue.tsv"), "utf8").split("\n").slice(1)) { const c = line.split("\t"); if (c.length >= 8) CAT[c[0]] = { family: c[2], w: +c[5] || 1, h: +c[6] || 1, layer: c[7] }; }
const ZN = { B5: -5, B4: -3, B3: -1, B2: 1, B1: 3, T1: 5, T2: 7, T3: 9, T4: 11 };

function windows(L, ats, w) {
  const col = LOOK.headerColours(L.header), out = [];
  const layerOf = o => { const p = o.props || {}; if (p[24] != null && p[24] !== "") return +p[24]; const c = CAT[o.id]; return c && ZN[c.layer] != null ? ZN[c.layer] : 5; };
  for (const at of ats) {
    const x0 = at * 30, x1 = x0 + w * 30, items = [];
    let n = 0;
    for (const o of L.objects) {
      if (o.x == null || o.x < x0 - 200 || o.x > x1 + 200) continue;
      const k = (O.objInfo(o.id) || {}).kind; if (k === "trigger") continue;
      if (o.x >= x0 && o.x < x1) n++;
      const p = o.props || {}, c = CAT[o.id] || { w: 1, h: 1 };
      let rgb = col[+p[21]] || (k === "solid" || k === "hazard" ? [255, 255, 255] : col[1004] || [255, 255, 255]);
      if (p[41] === "1" && p[43]) { const v = +String(p[43]).split("a")[2]; if (v > 0) rgb = rgb.map(q => Math.max(0, Math.min(255, q * v))); }
      const s = +(p[32] || 1), sx = +(p[128] || 1) * s, sy = +(p[129] || 1) * s;
      items.push({ id: o.id, kind: k || "deco", x: o.x - x0, y: o.y, w: c.w * 30 * sx, h: c.h * 30 * sy, rot: o.rot || 0, fx: !!o.flipX, fy: !!o.flipY, rgb, z: layerOf(o), zo: +(p[25] || 0),
        tri: o.id === 693 || /triangle/.test(c.family || ""), blend: !!LOOK.channelFlags(L.header).blend[+p[21]] });
    }
    items.sort((a, b) => a.z - b.z || a.zo - b.zo);
    out.push({ at, w, perBlock: +(n / w).toFixed(1), bg: col[1000], ground: col[1001], items });
  }
  return out;
}

if (require.main === module) {
  const src = args[0]; if (!src) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(0); }
  const L = require("./contrast.js").load(/^\d+$/.test(src) ? path.join(ROOT, "local", "community", src + ".gdlvl") : src);
  const ats = String(opt("--at", "0")).split(",").map(Number), w = +opt("--w", 24);
  const out = opt("--out", path.join(ROOT, "local", "deco", path.basename(src).replace(/[:.]/g, "_") + ".png"));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const job = out.replace(/\.png$/, ".json");
  fs.writeFileSync(job, JSON.stringify({ title: `${L.name}`, ppu: +opt("--ppu", 2), wins: windows(L, ats, w) }));
  cp.execFileSync("python", [path.join(__dirname, "decowin.py"), job, out], { stdio: "inherit", windowsHide: true });
}
module.exports = { windows };
