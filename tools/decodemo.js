// node tools/decodemo.js [base.gdlvl] [--to <block>] [--themes ice,fire] [--shots] [--at 3.5,9.5]
//
// Deco OPTIONS, side by side (the user, 2026-11-25: "can you show me some deco options we can do, for bricks, for deco.
// the best features so far. idk for ice/fire"). One stretch of a level's gameplay (default: GDLM 50 eclipse, blocks
// 0-150: a cube town and a ship corridor) is dressed again and again, each rung adding ONE feature on top of the last,
// in two themes:
//   1 bare        the play only, in the theme's colours (block rim + hazard colour, sky, ground)
//   2 lit edges   block bodies filled dark, lit lines on every open side, a soft glow under open tops (designBlocks)
//   3 texture     + running-bond bricks inside the bodies, a trim on open tops (frost / crust), cracks
//   4 inlays      + small lights inside the masses (ice crystals / lava windows)
//   5 depth       + three depths behind the play (far range, mid range, near: crystals / dead trees and ruins)
//   6 atmosphere  + a horizon haze, snow / embers, icicles / stalactites over the flying corridor
//   7 composed    rung 6 re-arranged, not spread: quiet stretches (back layers thinned to a quarter), one focal set
//                 piece per screen at the strong spots (after a portal, mid-screen), the corridor framed
// No motion triggers and no parallax: these are stills (ART.md "Deco options"). Fire has no kit yet: it re-colours the
// ice kit's shapes (peaks -> rock, crystals -> obsidian shards) and adds Hellgate's chains, skulls, ruins and embers.
// Writes local/decodemo/<theme>_<n>_<rung>.gdlvl and local/decodemo/options.json; --shots renders each at the --at times
// with tools/shoot.js (heavy, GD art: local only) and writes local/decodemo/index.html (open it via tools/serve.js:
// http://localhost:8765/local/decodemo/index.html).
"use strict";
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ROOT = path.join(__dirname, ".."), OUT = path.join(ROOT, "local", "decodemo");
const K = require("./scenekit.js"), D = require("./decokit.js"), P = require("../lib/props.js"), ICE = require("./themes/ice.js");
const O = require("../lib/objects.js"), kindOf = b => (O.objInfo(b.id) || {}).kind;
const CH = ICE.CH, I = ICE.pieces;

// fire: the ice kit's channel roles in lava colours (role pairs like ice's: dark path body, a hot rim, near-white hazards)
const FIRE = { bg: [40, 10, 14], ground: [16, 4, 6], line: [255, 120, 40], pathEdge: [255, 110, 30], blockFill: [22, 8, 10],
  frost: [255, 170, 60], glow: [255, 70, 0], hazardEdge: [255, 235, 210], snow: [255, 150, 60],
  far: [130, 44, 40], farLit: [160, 58, 44], cap: [200, 70, 36], mid: [96, 28, 28], midLit: [126, 40, 32],
  crystal: [255, 120, 20], crack: [120, 30, 10], accent: [255, 200, 80], haze: [200, 40, 10] };
const THEMES = {
  ice: { map: ICE.channelMap("peaks"), blend: ICE.BLEND },
  fire: { map: (() => { const m = { 1000: FIRE.bg, 1001: FIRE.ground, 1002: FIRE.line };
    for (const [k, ch] of Object.entries(CH)) m[ch] = FIRE[k === "rim" ? "pathEdge" : k === "hazard" ? "hazardEdge" : k === "fill" ? "blockFill" : k]; return m; })(),
    blend: { [CH.glow]: 0.6, [CH.crystal]: 0.9, [CH.haze]: 0.3 } },
};
const RUNGS = ["bare", "lit edges", "texture", "inlays", "depth", "atmosphere", "composed"];

function base(src, toBlock) {
  const io = require("./io.js"), L = io.readGdlvl(src);
  const objects = L.level.objects.filter(b => { const k = kindOf(b); return k && k !== "decoration" && k !== "deco" && k !== "trigger" && b.x < toBlock * 30; });
  for (const b of objects) if (b.props) for (const k of [21, 22, 41, 43, 24, 25, 57]) delete b.props[k];
  return { io, L, objects };
}

// one rung of one theme: the deco objects (the play is coloured in place)
function dress(theme, rung, objects, ends) {
  const x0 = -300, x1 = ends.x1, out = [], fire = theme === "fire";
  const ship = ends.fly;   // [[a, b]] flying spans
  const inFly = x => ship.some(([a, b]) => x >= a && x < b);
  for (const b of objects) { const k = kindOf(b); if (k === "solid" || k === "slope") (b.props = b.props || {})[21] = String(CH.rim); if (k === "hazard") (b.props = b.props || {})[21] = String(CH.hazard); }
  if (rung >= 2) out.push(...K.designBlocks(objects, x0, x1, { fill: CH.fill, edge: CH.rim, glow: CH.glow, win: rung >= 4 ? CH.crystal : null, windows: fire ? 0.1 : 0.14, seed: 3 }));
  if (rung >= 3) {
    out.push(...D.blockPattern(objects, x0, x1, { ch: CH.fill, top: CH.frost, seed: 41 }));
    const R = K.rng(7);
    for (const b of objects) if (kindOf(b) === "solid" && R() < 0.12) out.push(K.obj(1753, b.x + (R() - 0.5) * 10, b.y + (R() - 0.5) * 10, { ch: CH.crack, z: "T1", zo: 3, sx: 0.5 + R() * 0.5, rot: 20 + R() * 70 }));
  }
  if (rung >= 4 && fire) {   // molten seams: short glowing lines through some deep cells
    const R = K.rng(9), at = new Set(objects.filter(b => kindOf(b) === "solid").map(b => Math.round(b.x / 30 - 0.5) + "," + Math.round(b.y / 30 - 0.5)));
    for (const b of objects) { if (kindOf(b) !== "solid") continue; const c = Math.round(b.x / 30 - 0.5), r = Math.round(b.y / 30 - 0.5);
      if (at.has(c + "," + (r + 1)) && at.has(c + "," + (r - 1)) && at.has((c - 1) + "," + r) && at.has((c + 1) + "," + r) && R() < 0.18)
        out.push(K.obj(1753, b.x, b.y, { ch: CH.crystal, z: "T1", zo: 4, sx: 0.7 + R() * 0.6, rot: R() * 180 })); }
  }
  let back = [];
  if (rung >= 5) {
    back.push(...I.range(x0, x1 + 300, { seed: 4, z: "B5", hMin: 100, hMax: 210, groups: [] }));
    back.push(...I.range(x0, x1 + 300, { seed: 6, z: "B4", zo: 4, hMin: 40, hMax: 90, wMin: 90, wMax: 180, ch: CH.mid, lit: CH.midLit, cap: false, groups: [] }));
    if (!fire) { for (let x = x0 + 80; x < x1; x += 170 + (x % 7) * 10) if (!inFly(x)) back.push(...I.cluster(x, -10, { seed: 3 + x, ch: CH.mid, lit: CH.midLit, z: "B3", groups: [] })); }
    else for (const [a, b] of ends.ground) {
      back.push(...D.backdrop(a, b, { near: CH.mid, trees: "dead tree", density: 1.2, seed: 30 }));
      const R = K.rng(12); for (let x = a + 120; x < b - 60; x += 300 + R() * 200) back.push(...P.put(R() < 0.5 ? "broken arches" : "ruin", x, 0, { silhouette: CH.mid, layer: "B3", zo: -4, scale: 0.9 + R() * 0.3, seed: Math.floor(x) }).objects);
    }
  }
  if (rung >= 6) {
    back.push(...I.haze(x0, x1));
    if (!fire) back.push(...I.snow(objects, x0, x1, { seed: 5, density: 1.2 }));
    else back.push(...K.motes(x0, x1 + 300, { ch: CH.snow, density: 1.4, z: "B2", seed: 60, y0: -40, y1: 320 }));
    for (const [a, b] of ship) back.push(...I.icicles(objects, a - 60, b + 60, { seed: 2, hMin: 30, hMax: 110, ch: fire ? CH.mid : CH.far, lit: fire ? CH.midLit : CH.farLit, z: "B2", groups: [] }));
    if (fire) { const R = K.rng(21); for (const [a, b] of ends.ground) for (let x = a + 90; x < b; x += 180 + R() * 140) {
      const n = 2 + Math.floor(R() * 4); for (let k = 0; k < n; k++) back.push(K.obj(106, x, 330 - k * 62, { ch: CH.far, z: "B2", zo: 0 }));
      if (R() < 0.6) back.push(K.obj(1596 + Math.floor(R() * 2), x + 40, 14 + R() * 16, { ch: CH.cap, z: "B3", zo: 2, s: 1.3, flipX: R() < 0.5 })); } }
  }
  if (rung >= 7) back = compose(theme, back, objects, ends);
  return out.concat(back);
}

// composition: quiet and busy screens, one focal piece per screen at the strongest spot, the flying corridor framed
function compose(theme, back, objects, ends) {
  const fire = theme === "fire", SCREEN = 600, R = K.rng(77), out = [];
  // focal spots: each portal (the transition), and the middle of every screen that has none
  const spots = [...ends.portals];
  for (let x = 300; x < ends.x1; x += SCREEN) if (!spots.some(p => Math.abs(p - x) < 360)) spots.push(x);
  spots.sort((a, b) => a - b);
  // weight along x: 1 near a spot, falling to 0.25 between spots (the quiet stretch)
  const w = x => { const d = Math.min(...spots.map(s => Math.abs(s - x))); return d < 150 ? 1 : d < 300 ? 0.55 : 0.25; };
  for (const o of back) { const z = +((o.props || {})[24] || 0); if (z <= -3 && o.id !== 1293 && R() > w(o.x)) continue; if (o.id === 1764 && R() > w(o.x)) continue; out.push(o); }
  // the focal pieces themselves
  spots.forEach((x, i) => {
    const fly = ends.fly.some(([a, b]) => x >= a && x < b);
    if (!fire) {
      if (fly) out.push(...I.cluster(x, 330, { seed: 100 + i, size: 2.2, n: 5, down: true, ch: CH.far, lit: CH.crystal, z: "B2", groups: [] }));
      else { out.push(...I.peak(x + 120, 520, 300, { z: "B4", zo: 6, seed: i, groups: [] })); out.push(...I.cluster(x + 60, -10, { seed: 50 + i, size: 1.8, n: 5, ch: CH.mid, lit: CH.crystal, z: "B3", groups: [] })); }
    } else {
      if (fly) for (let k = -2; k <= 2; k++) out.push(...I.crystal(x + k * 40, 330, 26, 120 - Math.abs(k) * 30, { down: true, ch: CH.mid, lit: CH.crystal, z: "B2", groups: [] }));
      else { out.push(...P.put("broken arches", x + 100, 0, { silhouette: CH.far, layer: "B3", zo: -2, scale: 1.6, seed: i }).objects);
        for (const dx of [40, 160]) { for (let k = 0; k < 4; k++) out.push(K.obj(106, x + dx, 330 - k * 62, { ch: CH.cap, z: "B2", zo: 1 })); out.push(K.obj(1597, x + dx, 90, { ch: CH.cap, z: "B2", zo: 2, s: 1.6 })); } }
    }
    out.push(...K.horizonGlow(x - 120, x + 240, { ch: CH.glow, y: 0, h: 6, z: "B4", step: 120 }));   // the light gathers at the focal spot
  });
  // the flying corridor: lit rims along the walls the player flies between (its floor and ceiling)
  return out;
}

function build(src, o = {}) {
  const toBlock = o.to || 150, themes = o.themes || ["ice", "fire"], rows = [];
  fs.mkdirSync(OUT, { recursive: true });
  for (const theme of themes) RUNGS.forEach((name, i) => {
    const { io, L, objects } = base(src, toBlock), GD = io.GD;
    const MODE = { 12: "cube", 13: "ship", 660: "wave", 47: "ball", 111: "ufo", 1331: "spider", 745: "robot" };
    const portals = objects.filter(b => MODE[b.id]).sort((a, b) => a.x - b.x);
    const fly = [], ground = []; let a = -300, m = "cube";
    for (const p of portals) { (m === "ship" || m === "wave" || m === "ufo" ? fly : ground).push([a, p.x]); a = p.x; m = MODE[p.id]; }
    const x1 = toBlock * 30 + 300; (m === "ship" || m === "wave" ? fly : ground).push([a, x1]);
    const ends = { x1, fly, ground, portals: portals.map(p => p.x) };
    const deco = dress(theme, i + 1, objects, ends);
    const T = THEMES[theme], defs = {};
    for (const [ch, rgb] of Object.entries(T.map)) defs[ch] = { rgb, blend: T.blend[ch] != null, opacity: T.blend[ch] ?? 1 };
    let header = K.channels(L.level.header, defs);
    for (const [k, v] of Object.entries(ICE.HEADER)) header = new RegExp("(^|,)" + k + ",").test(header) ? header.replace(new RegExp("(^|,)" + k + ",[^,;]*"), "$1" + k + "," + v) : header + "," + k + "," + v;
    const file = path.join(OUT, `${theme}_${i + 1}_${name.replace(/ /g, "_")}.gdlvl`);
    GD.setField(L.rec, "k2", "s", `GDLM deco ${theme} ${i + 1} ${name}`);
    io.writeGdlvl(file, L.rec, { header, objects: objects.concat(deco) });
    rows.push({ theme, rung: i + 1, name, file: path.relative(ROOT, file).replace(/\\/g, "/"), deco: deco.length });
  });
  fs.writeFileSync(path.join(OUT, "options.json"), JSON.stringify(rows, null, 1));
  return rows;
}

function page(rows, at) {
  const cell = (r, t) => { const f = `${path.basename(r.file, ".gdlvl")}_shots`; const pngs = fs.existsSync(path.join(OUT, f)) ? fs.readdirSync(path.join(OUT, f)).filter(p => p.endsWith(".png")).sort() : [];
    return pngs[t] ? `<img loading=lazy src="${f}/${pngs[t]}">` : "<i>no frame</i>"; };
  const themes = [...new Set(rows.map(r => r.theme))];
  let h = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width"><title>Deco options</title>
<style>body{background:#111;color:#ddd;font:14px system-ui;margin:16px}table{border-collapse:collapse}td,th{padding:4px;vertical-align:top}img{width:min(46vw,640px);display:block}th{text-align:left}</style>
<h2>Deco options -- each row adds one feature (tools/decodemo.js)</h2><table><tr><th></th>${themes.map(t => at.map(a => `<th>${t}, ${a} s</th>`).join("")).join("")}</tr>`;
  for (let i = 0; i < RUNGS.length; i++) h += `<tr><th>${i + 1} ${RUNGS[i]}</th>${themes.map(t => { const r = rows.find(q => q.theme === t && q.rung === i + 1); return at.map((_, k) => `<td>${cell(r, k)}</td>`).join(""); }).join("")}</tr>`;
  fs.writeFileSync(path.join(OUT, "index.html"), h + "</table>");
}

if (require.main === module) {
  const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
  const src = a[0] && !a[0].startsWith("--") ? a[0] : path.join(ROOT, "levels", "gdlm_50_eclipse.gdlvl");
  const rows = build(src, { to: +opt("--to", 150), themes: opt("--themes", "ice,fire").split(",") });
  for (const r of rows) console.log(`${r.file}  ${r.deco} deco`);
  const at = opt("--at", "3.5,9.5").split(",").map(Number);
  if (a.includes("--shots")) {
    require("./heavy.js").claim();
    for (const r of rows) cp.execFileSync(process.execPath, [path.join(__dirname, "shoot.js"), path.join(ROOT, r.file), "--at", at.join(","), "--out", path.join(OUT, path.basename(r.file, ".gdlvl") + "_shots")], { stdio: "inherit", windowsHide: true });
    page(rows, at); console.log("sheet: local/decodemo/index.html (http://localhost:8765/local/decodemo/index.html)");
  }
}
module.exports = { build, RUNGS };
