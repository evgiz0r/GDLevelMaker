// node tools/roles.js <level.gdlvl | official:N | save:<name> | dir/> ... [--all] [--json f] [--worst N] [--shots N]
//
// Colour by ROLE (the user, 2026-11-24: "Usually the contrast in our games is pretty bad. Can we do clear contrasts
// between the different things (ground, spikes, deco). Sometimes the path is very unclear with similar shades of black,
// grey, brown"). The background and the deco may be busy and mid-tone (gd-taste's section comparison); the PLAYABLE
// roles must separate from them. Every 10 blocks, with the colours the header and colour triggers give at that moment
// (time through the speed portals), each object's colour (key 21, else its default channel; HSV 41/43; a blending
// channel adds to the background, a channel's opacity mixes with it) is compared by role:
//   path/bg      a block or the ground against the background
//   path/deco    deco touching a block (or standing on the ground line) in the path's colour family and value
//   hazard/path  a spike against the block it sits on: near the same value in two DIFFERENT colours (one colour for
//                both is classic GD, told apart by shape: noted as "shared", not failed)
//   hazard/deco  deco touching a hazard in its colour family and value
//   hazard/bg    a hazard against the background
// "Same family" = both neutral (grey / black / dark: saturation < 0.25 or value < 0.18 -- black, grey and dark brown
// all read as one), one neutral and the other dark, or both chromatic within 35 degrees of hue. "Similar" = same family
// and a luminance ratio under the pair's limit (LIM). Deco counts by its covered area (blocks^2) and only at 0.5+ (path)
// / 0.3+ (hazard) per section. A block reads as a MASS: its body (a skin's see-through dark fill, ~62% black over the
// sky, as lib/look.js draws it and the user's GDLM 52 recording shows) must stand out from the bg, and deco in the body's
// value merges with it -- a bright rim alone does not save it. A level FAILS when 10% of its sections fail a pair (score.js
// gate "roles"; officials 0-5%, their blackout flashes); --shots N renders the
// N worst sections with tools/shoot.js and makes one labelled sheet: local/roles/<level>/sheet.jpg.
// Orbs, pads and portals keep GD's own art colours (not measured here: open). ART.md "Colour by role".
"use strict";
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ROOT = path.join(__dirname, ".."), LOOK = require("../lib/look.js").LOOK, O = require("../lib/objects.js");
const C = require("./contrast.js");
const LIM = { pathBg: 1.4, pathDeco: 1.35, hazardPath: 1.3, hazardDeco: 1.5, hazardBg: 1.6 };
const AREA = { pathDeco: 0.5, hazardDeco: 0.3 };

let CAT = null;
function cat() {
  if (CAT) return CAT; CAT = {};
  try { for (const l of fs.readFileSync(path.join(ROOT, "knowledge", "objects", "catalogue.tsv"), "utf8").split(/\r?\n/).slice(1)) {
    const c = l.split(String.fromCharCode(9)); if (c.length < 9) continue;
    CAT[+c[0]] = { w: +c[5] || 1, h: +c[6] || 1, ch: c[8] === "" ? null : +c[8], det: c[9] === "" ? null : +c[9], fam: c[2] }; } } catch (e) {}
  return CAT;
}
const hsv = c => { const [r, g, b] = c.map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0; if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: mx ? d / mx : 0, v: mx }; };
const neutral = c => { const q = hsv(c); return q.s < 0.25 || q.v < 0.18; };
function sameFamily(a, b) {
  const na = neutral(a), nb = neutral(b);
  if (na && nb) return true;
  if (na || nb) return hsv(na ? b : a).v < 0.3;
  const d = Math.abs(hsv(a).h - hsv(b).h); return Math.min(d, 360 - d) < 35;
}
const similar = (a, b, lim) => C.ratio(a, b) < lim && sameFamily(a, b);
// a role's colours: a play object can read by its body OR its edge, so it is lost against a colour only when EVERY one
// of its colours is similar to it
const lostIn = (set, b, lim) => set.every(a => similar(a, b, lim));
const same = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 12;

function load(w) { return C.load(w); }
const kindOf = o => (O.objInfo(o.id) || {}).kind;

function measure(L) {
  const GD = Object.assign({}, require("../lib/gd.js"), O, require("../lib/physics.js"), require("../lib/sync.js"));
  let tOf = x => x / 311.58;
  try { const tl = GD.SYNC.timeline(GD.makeWorld(L.objects, L.header)); tOf = x => GD.SYNC.tOfX(tl, x); } catch (e) {}
  const tl = LOOK.timeline({ header: L.header, objects: L.objects }, x => x);
  for (const k in tl.colour) for (const e of tl.colour[k]) e.dur *= 311.58;
  const V = require("../lib/vfx.js").VFX, K = cat();
  const objs = L.objects.filter(o => o.x != null);
  const haz = objs.filter(o => kindOf(o) === "hazard"), sol = objs.filter(o => kindOf(o) === "solid" || o.id === 1338 || o.id === 1339);
  const deco = objs.filter(o => { const k = kindOf(o); return (k === "decoration" || k === "deco" || k == null) && o.id !== 914; });
  const size = o => { const p = o.props || {}, c = K[o.id] || { w: 1, h: 1 }, s = +(p[32] || 1);
    return { w: c.w * 30 * s * +(p[128] || 1), h: c.h * 30 * s * +(p[129] || 1) }; };
  const maxX = Math.max(300, ...haz.concat(sol).map(o => o.x));
  // cells of the path's mass: solids, and block skins placed as scenery (ids 5 / 73 / 80 ...: the filler under a floor)
  const massObjs = objs.filter(o => kindOf(o) === "solid" || /^(square|blockOutline)/.test((cat()[o.id] || {}).fam || ""));
  const massAt = (x, y) => massObjs.some(b => Math.abs(b.x - x) < 3 && Math.abs(b.y - y) < 3);   // (a linear scan per piece: fine at level sizes)
  const K0 = cat(), solidCells = new Set(objs.filter(o => kindOf(o) === "solid" || /^(square|blockOutline)/.test((K0[o.id] || {}).fam || "")).map(b => Math.round(b.x / 30 - 0.5) + ":" + Math.round(b.y / 30 - 0.5)));
  const secs = [];
  for (let x0 = 0; x0 < maxX; x0 += 300) {
    const st = LOOK.stateAt(tl, x0 + 150), bg = st.col[1000] || [40, 125, 255], gr = st.col[1001] || [0, 102, 255];
    const R = c => c.map(Math.round);
    const chCol = (ch, o) => { const p = (o && o.props) || {}; let c = st.col[ch] || [255, 255, 255];
      if (o && p[41] === "1" && p[43]) c = V.hsvApply(c, V.hsvParse(p[43]));
      const op = st.opacity && st.opacity[ch] != null ? +st.opacity[ch] : 1;
      if (st.blend && st.blend[ch]) c = c.map((v, i) => Math.min(255, bg[i] + v * op));
      else if (op < 1) c = c.map((v, i) => bg[i] + (v - bg[i]) * op);
      return R(c); };
    // a block skin's body is see-through: ~62% black over what is behind (lib/look.js draws it so; the user's GDLM 52
    // recording, 2026-11-24_19-34-49.mkv: dark grey bodies on a grey-purple sky); id 1 and spikes: opaque black
    const body = o => (o.id >= 2 && o.id <= 7) || o.id === 83 || o.id === 69 ? R(bg.map(v => v * 0.38)) : [0, 0, 0];
    const mainCh = o => { const p = o.props || {}; return p[21] != null && p[21] !== "" ? +p[21] : (K[o.id] || {}).ch ?? 1004; };
    const colourOf = o => chCol(mainCh(o), o);
    // GD's play art (lib/look.js draws it the same way): block skins, spikes, pits, outlines are a BLACK body whose
    // edge lines take the colour; colour-spike / light-square kinds have a detail part (22) for the body; outline
    // blocks are edges only
    const roleCols = o => { const c = K[o.id] || {}, main = colourOf(o), p = o.props || {};
      if (/^blockOutline/.test(c.fam || "")) return [main];
      if (c.det != null) return [chCol(p[22] != null && p[22] !== "" ? +p[22] : c.det, o), main];   // body = its detail part, rim = key 21
      const f = fillAt.get(o.x + ":" + o.y); if (f) return [colourOf(f), main];   // a fill laid over it (designBlocks) IS its body
      if (c.ch == null || c.ch === 1004) return [body(o), main];
      return [main]; };
    const inS = a => a.filter(o => o.x >= x0 && o.x < x0 + 300);
    const H = inS(haz), S = inS(sol), D = deco.filter(o => o.x >= x0 - 60 && o.x < x0 + 360);
    if (!H.length && !S.length) continue;
    // fills laid exactly over a block (scenekit.designBlocks: a 211 square at its centre): what shows as its body
    const fillAt = new Map();
    for (const d of D) if (d.id === 211 && (d.props || {})[21] && Math.abs(+((d.props || {})[128] || (d.props || {})[32] || 1) - 1) < 0.06) {
      const b = S.find(b => Math.abs(b.x - d.x) < 3 && Math.abs(b.y - d.y) < 3); if (b) fillAt.set(b.x + ":" + b.y, d); }
    const s = { x0, t: +tOf(x0 + 150).toFixed(2), pairs: {}, fails: [], shared: 0 };
    const worse = (k, r, a, b, extra) => { const p = s.pairs[k] || (s.pairs[k] = { ratio: Infinity, area: 0 });
      if (r < p.ratio) Object.assign(p, { ratio: +r.toFixed(2), a, b }, extra || {}); return p; };
    // path / bg: the ground (with its line) and every block
    const gset = [R(gr), chCol(1002)], bgR = R(bg);
    if (lostIn(gset, bgR, LIM.pathBg)) worse("pathBg", C.ratio(gset[0], bgR), gset[0], bgR, { what: "ground" }).bad = true;
    // a light part laid on a block (id 207-family "lightsquare" in a cell another solid fills: the modern pass's dress) is
    // the block's dress, not a path piece of its own
    const cellKey = b => Math.round(b.x / 30 - 0.5) + ":" + Math.round(b.y / 30 - 0.5), plain = new Set(S.filter(b => !/^lightsquare/.test((K[b.id] || {}).fam || "")).map(cellKey));
    const SC = S.filter(b => !(/^lightsquare/.test((K[b.id] || {}).fam || "") && plain.has(cellKey(b)))).map(b => [b, roleCols(b)]), HC = H.map(h => [h, roleCols(h)]);
    // a block must read as a MASS, not only by a thin rim: its body (or, for a body-less outline, its colour) against the bg
    // (a bright rim, 3x+ off the sky, carries a body lost in an EMPTY sky: Can't Let Go's black-on-black with white edges;
    // deco in the body's value is what turns it to mush -- path/deco below)
    for (const [b, cs] of SC) if (similar(cs[0], bgR, LIM.pathBg) && !(cs.length > 1 && C.ratio(cs[cs.length - 1], bgR) >= 3)) { const p = worse("pathBg", C.ratio(cs[0], bgR), cs[0], bgR, { what: "block body", x: b.x, y: b.y }); p.n = (p.n || 0) + 1; }
    // deco touching a play object (boxes overlap within 6 units), or standing on the ground line
    const touch = (d, o, ds) => Math.abs(d.x - o.x) <= ds.w / 2 + 21 && Math.abs(d.y - o.y) <= ds.h / 2 + 21;
    for (const d of D) {
      const ds = size(d), area = ds.w * ds.h / 900; if (area < 0.1) continue;   // crumbs (trims, specks, stars) cannot hide a block
      // deco with no colour key draws its own sprite colours (GD's black-and-white art): not judged by a channel
      if ((d.props || {})[21] == null || d.props[21] === "") continue;
      const dc = colourOf(d);
      // a block's own dress (a fill laid exactly over it: scenekit.designBlocks) is the block, not deco beside it
      if (ds.w <= 32 && ds.h <= 32 && massAt(d.x, d.y)) continue;
      // a big piece on the farthest layer (B5, 9+ blocks^2: a nebula, a planet, a moon) is part of the SKY: judged as the sky is
      // (path/bg: lost only when the body matches it AND the rim is under 3x off it)
      // (a glow on a blending channel on B5 too: light in the sky, however small)
      const sky = +((d.props || {})[24] || 0) <= -5 && (area >= 9 || !!(st.blend && st.blend[mainCh(d)]));
      // a fill inside the blocks (its box's corners and centre all inside the path's mass: blockPattern's bricks,
      // decorate.js's merged fills, panels) is their dress too
      { const inMass = (x, y) => massObjs.some(m => Math.abs(m.x - x) <= 15.5 && Math.abs(m.y - y) <= 15.5), hw = ds.w / 2 - 1.5, hh = ds.h / 2 - 1.5;
        if (ds.w * ds.h <= 900 * 400 && [[0, 0], [-hw, -hh], [hw, -hh], [-hw, hh], [hw, hh]].every(([dx, dy]) => inMass(d.x + dx, d.y + dy))) continue; }
      // ... and so are its rim lines (thin lines 1753 along a block's side) and the glow under an open top (1293)
      if ((d.id === 1753 || d.id === 1293) && sol.some(b => Math.abs(b.x - d.x) <= 16 && Math.abs(b.y - d.y) <= 16)) continue;
      const hitB = SC.find(([b, cs]) => touch(d, b, ds) && similar(cs[0], dc, LIM.pathDeco) && !(sky && cs.length > 1 && C.ratio(cs[cs.length - 1], dc) >= 3));   // deco in the body's value and family: the mass merges
      const onGround = d.y - ds.h / 2 <= 15 && d.x >= x0 && d.x < x0 + 300 && lostIn(gset, dc, LIM.pathDeco);
      if (hitB || onGround) { const pc = hitB ? hitB[1][0] : gset[0];
        const p = worse("pathDeco", C.ratio(dc, pc), dc, pc, { x: d.x, y: d.y, id: d.id }); p.area += area; }
      const hitH = HC.find(([h, cs]) => touch(d, h, ds) && lostIn(cs, dc, LIM.hazardDeco));
      if (hitH) { const hc = hitH[1][hitH[1].length - 1]; const p = worse("hazardDeco", C.ratio(dc, hc), dc, hc, { x: d.x, y: d.y, id: d.id }); p.area += area; }
    }
    for (const [h, hs] of HC) {
      if (lostIn(hs, bgR, LIM.hazardBg)) worse("hazardBg", Math.max(...hs.map(c => C.ratio(c, bgR))), hs[hs.length - 1], bgR, { x: h.x, y: h.y }).bad = true;
      for (const [b, bs] of SC) if (Math.abs(b.x - h.x) <= 31 && Math.abs(b.y - h.y) <= 31) {
        const he = hs[hs.length - 1], be = bs[bs.length - 1];   // their edges (the bodies are both black in GD's art)
        if (same(he, be)) s.shared++;
        else if (similar(he, be, LIM.hazardPath)) worse("hazardPath", C.ratio(he, be), he, be, { x: h.x, y: h.y }).bad = true; }
    }
    for (const k in s.pairs) { const p = s.pairs[k];
      if (p.bad || (AREA[k] != null && p.area >= AREA[k]) || (k === "pathBg" && p.n >= 3)) s.fails.push(`${k} ${p.ratio}` + (p.area ? ` (${p.area.toFixed(1)} block^2 of deco)` : "") + ` rgb(${p.a}) vs rgb(${p.b})`); }
    s.bad = s.fails.length + Object.entries(s.pairs).reduce((a, [k, p]) => a + Math.max(0, (LIM[k] - p.ratio)) + (p.area || 0) / 4, 0);
    secs.push(s);
  }
  const failed = secs.filter(s => s.fails.length), byPair = {};
  for (const s of failed) for (const f of s.fails) { const k = f.split(" ")[0]; byPair[k] = (byPair[k] || 0) + 1; }
  // a level fails at 10% of its sections (the official levels: 0-5%, their blackout flashes; ours 2026-11-24: 70-95%)
  return { name: L.name, sections: secs.length, failed: failed.length, share: secs.length ? +(failed.length / secs.length).toFixed(2) : 0, ok: failed.length < Math.max(2, 0.1 * secs.length), byPair,
    shared: secs.reduce((a, s) => a + s.shared, 0), worst: failed.sort((a, b) => b.bad - a.bad), secs };
}

// the N worst sections as GD-art frames (tools/shoot.js) + one labelled sheet (python, PIL)
function shots(src, r, n, outDir) {
  const W = r.worst.slice(0, n); if (!W.length) return null;
  fs.mkdirSync(outDir, { recursive: true });
  cp.execFileSync(process.execPath, [path.join(__dirname, "shoot.js"), src, "--at", W.map(s => s.t).join(","), "--out", outDir], { stdio: "inherit", windowsHide: true });
  const job = path.join(outDir, "job.json"), pngs = fs.readdirSync(outDir).filter(f => /\.png$/.test(f)).sort();
  const items = W.map(s => { const want = s.t.toFixed(2); const f = pngs.find(p => p.includes(want)) || pngs.find(p => Math.abs(parseFloat(p.replace(/[^\d.]/g, "")) - s.t) < 0.06);
    return { png: f ? path.join(outDir, f) : null, label: `${r.name}  ~${s.t} s (x ${s.x0}-${s.x0 + 300})`, fails: s.fails }; }).filter(i => i.png);
  fs.writeFileSync(job, JSON.stringify({ items, out: path.join(outDir, "sheet.jpg") }));
  cp.execFileSync("python", [path.join(__dirname, "roles_sheet.py"), job], { stdio: "inherit", windowsHide: true });
  return path.join(outDir, "sheet.jpg");
}

if (require.main === module) {
  const args = process.argv.slice(2), opt = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
  let list = args.filter((a, i) => !a.startsWith("--") && !["--json", "--worst", "--shots"].includes(args[i - 1]));
  list = list.flatMap(w => fs.existsSync(w) && fs.statSync(w).isDirectory() ? fs.readdirSync(w).filter(f => /\.gdlvl$/.test(f)).map(f => path.join(w, f)) : [w]);
  if (args.includes("--all")) list = list.concat(fs.readdirSync(path.join(ROOT, "levels")).filter(f => /^gdlm.*\.gdlvl$/.test(f)).map(f => path.join("levels", f)));
  if (!list.length) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(0); }
  const nShots = +opt("--shots", 0);
  if (nShots) require("./heavy.js").claim();
  const N = +opt("--worst", 3), out = [];
  for (const w of list) {
    let r; try { r = measure(load(w)); } catch (e) { console.log(`${w}: ${e.message}`); continue; }
    out.push(Object.assign({ src: w }, r, { secs: undefined, worst: r.worst.slice(0, 10) }));
    console.log(`${r.ok ? "ok  " : "FAIL"}  ${r.name}  ${r.failed}/${r.sections} sections mix a playable role with deco or bg  ${JSON.stringify(r.byPair)}${r.shared ? `  (${r.shared} spikes share their block's colour: shape only)` : ""}`);
    for (const s of r.worst.slice(0, N)) console.log(`       ~${s.t} s, x ${s.x0}-${s.x0 + 300}: ${s.fails.join("; ")}`);
    if (nShots && r.worst.length) {
      const dir = path.join(ROOT, "local", "roles", path.basename(String(w)).replace(/\.gdlvl$/, "").replace(/[^\w.-]+/g, "_"));
      try { console.log("       sheet:", shots(w, r, nShots, dir)); } catch (e) { console.log("       shots failed:", e.message); }
    }
  }
  if (opt("--json")) fs.writeFileSync(opt("--json"), JSON.stringify(out, null, 1));
}
module.exports = { measure, similar, sameFamily, neutral, LIM, AREA };
