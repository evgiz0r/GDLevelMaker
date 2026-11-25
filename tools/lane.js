// node tools/lane.js <level.gdlvl> ... [--json]          measure: how the deco sits around the play lane
// node tools/lane.js <level.gdlvl> --apply [--out f]     the lane pass on a copy (default: local/tmp/<name>.lane.gdlvl)
//
// Path-aware deco (the user, 2026-11-25: "our character plays not that big part of the screen on a defined path"; "we want to
// improve the cohesion of the whole process repeatedly"). Rated levels keep the strip the player moves through clean and put
// the busiest art right at its edges, framing it, fading further out; our passes placed deco by x range and screen height and
// knew nothing of the route. ART.md "The play lane".
//
// The lane, per column (30 units), from the level's saved route (tools/solutions.js; make.js passes its own run):
//   lo, hi    the player's box over that column (lowest and highest y - 15 / + 15), widened by a column on each side;
//             a player standing on a surface keeps 10 units above it free for ground-line dressing (tufts)
//   vlo, vhi  what the camera shows there (lib/camera.js: the band in flying modes, the follow rule in the others)
//   fly       a flying mode (ship, ufo, wave, swing): the lane is framed by the corridor's walls
// zone(x, y): "lane" inside, "edge" within EDGE (2.5 blocks) outside it and in view, "view" further but on screen, "off".
//
// measure(L, lane) -> per level (screens with play, medians):
//   clutter   front deco (layer T1 and up, not on a block) covering the lane, as a share of the lane's area -- want ~0
//   edge      share of the visible deco that sits in the edge band (the frame)
//   waste     share of all deco never on screen (off the camera's band, or behind a block); deco locked to the camera is left out
//   frame     edge-band deco pieces per column of lane
// pass(objects, lane, o) -> { objects (the level's, the lane cleared of front deco), added (new frame pieces), removed }:
//   clear     front deco overlapping the lane is dropped (jump marks, text and the signature are kept)
//   frame     edge-band pieces, probability falling with distance from the lane (e^(-d / 1.2 blocks)), small near it,
//             on the section's own deco channels (the most used ones there, or o.ch), behind the play (B2/B1); in a flying
//             corridor, lit trims on the wall surfaces that face the lane and small lights a block into the walls
// make.js runs it after the solve when the spec has "lane" (true, or options); off by default until the composition model
// (ART.md "Deco composition") decides where frame pieces cluster. The measures are on for every level.
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const O = require("../lib/objects.js"), CAM = require("../lib/camera.js"), K = require("./scenekit.js");
const EDGE = 75, FLY = new Set(["ship", "ufo", "wave", "swing"]);
const ZN = { B5: -5, B4: -3, B3: -1, B2: 1, B1: 3, T1: 5, T2: 7, T3: 9, T4: 11 };
let CAT = null;
function cat() {
  if (CAT) return CAT; CAT = {};
  for (const line of fs.readFileSync(path.join(ROOT, "knowledge", "objects", "catalogue.tsv"), "utf8").split("\n").slice(1)) {
    const c = line.split("\t"); if (c.length < 8) continue; CAT[c[0]] = { w: +c[5] || 1, h: +c[6] || 1, layer: c[7] };
  }
  return CAT;
}
const kind = o => (O.objInfo(o.id) || {}).kind;
const isPlay = o => { const k = kind(o); return k && k !== "decoration" && k !== "deco" && k !== "trigger"; };
const isDeco = o => !isPlay(o) && o.id !== 914 && (O.objInfo(o.id) || {}).kind !== "trigger" && !(o.props && o.props[36] === "1");
const layerOf = o => { const p = o.props || {}; if (p[24] != null && p[24] !== "") return +p[24]; const c = cat()[o.id]; return c && ZN[c.layer] != null ? ZN[c.layer] : 5; };
const boxOf = o => { const c = cat()[o.id] || { w: 1, h: 1 }, p = o.props || {}, s = +(p[32] || 1);
  return { w: 30 * c.w * s * +(p[128] || 1), h: 30 * c.h * s * +(p[129] || 1) }; };

// ---- the lane from a run's path ----
function lane(level, events) {
  const GD = require("../lib/physics.js");
  const w = GD.makeWorld(level.objects, level.header), run = GD.run(w, events);
  const cols = [];
  for (const s of run.path) {
    if (s.dead) break;
    const x = GD.progressX ? GD.progressX(s) : s.x, y = GD.worldXY ? GD.worldXY(s)[1] : s.y, c = Math.floor(x / 30);
    if (c < 0) continue;
    const e = cols[c] || (cols[c] = { lo: Infinity, hi: -Infinity, vlo: Infinity, vhi: -Infinity, fly: false });
    const lo = s.grounded ? y - 5 : y - 15;   // standing: 10 units above the surface stay free for ground dressing
    e.lo = Math.min(e.lo, lo); e.hi = Math.max(e.hi, y + 15);
    const cam = CAM.want(s), b = cam - CAM.BELOW;
    e.vlo = Math.min(e.vlo, b); e.vhi = Math.max(e.vhi, b + CAM.VIEW_H);
    if (FLY.has(s.mode)) { e.fly = true; e.floor = s.floorY; e.ceil = s.ceilY; }
  }
  // widen by a column each side, fill gaps
  const out = [];
  for (let c = 0; c < cols.length; c++) {
    const a = [cols[c - 1], cols[c], cols[c + 1]].filter(Boolean);
    if (!a.length) { out[c] = out[c - 1] || null; continue; }
    out[c] = { lo: Math.min(...a.map(e => e.lo)), hi: Math.max(...a.map(e => e.hi)), vlo: Math.min(...a.map(e => e.vlo)), vhi: Math.max(...a.map(e => e.vhi)),
      fly: a.some(e => e.fly), floor: (cols[c] || a[0]).floor, ceil: (cols[c] || a[0]).ceil };
  }
  return { cols: out, end: run.done || run.end };
}
function zone(L, x, y) {
  const e = L.cols[Math.floor(x / 30)]; if (!e) return "off";
  if (y >= e.lo && y <= e.hi) return "lane";
  if (y < e.vlo - 30 || y > e.vhi + 30) return "off";
  const d = y < e.lo ? e.lo - y : y - e.hi;
  return d <= EDGE ? "edge" : "view";
}
const distOut = (L, x, y) => { const e = L.cols[Math.floor(x / 30)]; if (!e) return Infinity; return y < e.lo ? e.lo - y : y > e.hi ? y - e.hi : 0; };
function routeOf(level, levelStr) {
  const S = require("./solutions.js"), sol = S.get(levelStr || require("../lib/gd.js").encodeLevel?.(level) || "", true);
  return sol && sol.ok && sol.events ? sol.events : null;
}

// ---- groups that move: locked to the camera (move with key 58: their placed x means nothing) and moved at all (901 / 1346)
function movedGroups(objects) {
  const locked = new Set(), moved = new Set();
  for (const o of objects) { const p = o.props || {}; if ((o.id === 901 || o.id === 1346) && p[51]) { moved.add(p[51]); if (p[58] === "1") locked.add(p[51]); } }
  const groupsOf = o => ((o.props || {})[57] || "").split(".").filter(Boolean);
  return { isLocked: o => groupsOf(o).some(g => locked.has(g)), isMoved: o => groupsOf(o).some(g => moved.has(g)) };
}
// ---- solids as cells, to tell deco on / inside a block from deco in the air ----
function solidCells(objects) { const S = new Set(); for (const o of objects) if (kind(o) === "solid") S.add(Math.floor(o.x / 30) + "," + Math.floor(o.y / 30)); return S; }

// ---- measure ----
function measure(level, L) {
  const S = solidCells(level.objects), M = movedGroups(level.objects), deco = level.objects.filter(o => o.x != null && isDeco(o) && !M.isLocked(o));
  // hidden: behind a block (a back layer inside a solid cell); a fill drawn on the block (T1 and up) is its look, not waste
  const inSolid = o => layerOf(o) < 5 && S.has(Math.floor(o.x / 30) + "," + Math.floor(o.y / 30));
  const screens = new Map(), scr = x => Math.floor(x / 600);
  const get = k => screens.get(k) || (screens.set(k, { laneCols: 0, laneArea: 0, cover: 0, vis: 0, edge: 0, off: 0, all: 0 }), screens.get(k));
  L.cols.forEach((e, c) => { if (!e) return; const s = get(scr(c * 30)); s.laneCols++; s.laneArea += Math.max(30, e.hi - e.lo) * 30; });
  for (const o of deco) {
    const s = screens.get(scr(o.x)); if (!s) continue;
    s.all++;
    const z = zone(L, o.x, o.y);
    if (z === "off" || inSolid(o)) { s.off++; continue; }
    s.vis++;
    if (z === "edge") s.edge++;
    if (layerOf(o) >= 5 && !M.isMoved(o) && !S.has(Math.floor(o.x / 30) + "," + Math.floor((o.y - 20) / 30))) {   // in front (moving deco: its placed spot is not where it is seen): how much of the lane it covers
      const b = boxOf(o), e = L.cols[Math.floor(o.x / 30)];
      if (e) { const ov = Math.max(0, Math.min(o.y + b.h / 2, e.hi) - Math.max(o.y - b.h / 2, e.lo)) * Math.min(b.w, 30); s.cover += ov; }
    }
  }
  const rows = [...screens.values()].filter(s => s.laneCols >= 5);
  const med = a => { a = a.filter(Number.isFinite).sort((x, y) => x - y); return a.length ? a[a.length >> 1] : NaN; };
  const r3 = v => Number.isFinite(v) ? +v.toFixed(3) : null;
  return { screens: rows.length,
    clutter: r3(med(rows.map(s => Math.min(1, s.cover / s.laneArea)))),
    edge: r3(med(rows.map(s => s.vis ? s.edge / s.vis : 0))),
    waste: r3(med(rows.map(s => s.all ? s.off / s.all : 0))),
    frame: r3(med(rows.map(s => s.edge / s.laneCols))) };
}

// ---- the pass ----
const FRAME_IDS = [1764, 1765, 1766, 1767, 211, 693, 236, 497, 1059, 1060, 503, 504, 1009, 1010];
function pass(objects, L, o = {}) {
  const R = K.rng(o.seed || 77), S = solidCells(objects), M = movedGroups(objects);
  const keep = ob => !isDeco(ob) || ob.id === 914 || (ob.props && (ob.props[57] || "").split(".").includes("990")) || layerOf(ob) < 5 || M.isMoved(ob) || S.has(Math.floor(ob.x / 30) + "," + Math.floor(ob.y / 30))
    || S.has(Math.floor(ob.x / 30) + "," + Math.floor((ob.y - 20) / 30));   // dressing on a block's top (trims, tufts): the surface, not the lane
  const removed = [], kept = [];
  for (const ob of objects) {
    if (ob.x == null || keep(ob)) { kept.push(ob); continue; }
    const b = boxOf(ob), e = L.cols[Math.floor(ob.x / 30)];
    const ov = e ? Math.min(ob.y + b.h / 2, e.hi) - Math.max(ob.y - b.h / 2, e.lo) : 0;
    if (ov > 4) removed.push(ob); else kept.push(ob);
  }
  const added = [];
  if (o.frame !== false) {
    // the section's own channels: the deco channels most used within 20 blocks
    const chAt = x => { if (o.ch) return o.ch; const n = {}; for (const ob of kept) if (isDeco(ob) && Math.abs(ob.x - x) < 600) { const c = (ob.props || {})[21]; if (c && +c < 1000) n[c] = (n[c] || 0) + 1; }
      return Object.entries(n).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c]) => +c); };
    let chCache = null, chX = -1e9;
    L.cols.forEach((e, c) => {
      if (!e) return;
      const x = c * 30 + 15; if (x - chX > 300) { chCache = chAt(x); chX = x; }
      if (!chCache || !chCache.length) return;
      const ch = () => chCache[Math.floor(R() * chCache.length)];
      if (e.fly) {
        // corridor walls: a lit trim on the surface facing the lane (one piece a column), a light a block inside now and then
        for (const [sy, dir] of [[e.lo, -1], [e.hi, 1]]) {
          const r = Math.floor((sy + dir * 15) / 30);
          for (let k = 0; k < 4; k++) { const rr = r + dir * k; if (S.has(c + "," + rr)) {
            const face = dir < 0 ? rr * 30 + 30 : rr * 30;
            added.push(K.obj(211, x, face - dir * 3, { ch: ch(), z: "T1", zo: 6, sx: 1, sy: 0.12, hsv: "0a1a1.25a0a0" }));
            if (R() < 0.25 && S.has(c + "," + (rr + dir))) added.push(K.obj(1764, x + (R() - 0.5) * 10, (rr + dir) * 30 + 15, { ch: ch(), z: "T1", zo: 6, s: 0.5 }));
            break; } }
        }
        return;
      }
      // ground modes: above the lane, falling off with distance, small near the lane; never inside a solid or the lane
      for (let k = 0; k < 3; k++) {
        const d = R() * EDGE * 1.6, y = e.hi + 8 + d;
        if (R() > Math.exp(-d / 36) * (o.density ?? 0.9)) continue;
        if (y > e.vhi - 20 || S.has(c + "," + Math.floor(y / 30))) continue;
        const id = (o.ids || FRAME_IDS)[Math.floor(R() * (o.ids || FRAME_IDS).length)];
        const s = 0.25 + (d / EDGE) * 0.5 + R() * 0.2, b = boxOf({ id, props: { 32: s } });
        if (y - b.h / 2 < e.hi + 4) continue;
        added.push(K.obj(id, x + (R() - 0.5) * 24, y, { ch: ch(), z: d < EDGE / 2 ? "B1" : "B2", zo: 2, s, rot: R() < 0.5 ? R() * 360 : 0, hsv: d > EDGE / 2 ? "0a1a0.8a0a0" : null }));
      }
    });
  }
  return { objects: kept.concat(added), added, removed };
}

module.exports = { lane, zone, distOut, measure, pass, routeOf, EDGE };

if (require.main === module) {
  const args = process.argv.slice(2), io = require("./io.js");
  const files = args.filter(a => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--out");
  if (!files.length) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(0); }
  const rows = [];
  for (const f of files) {
    const R0 = io.readGdlvl(f), sol = require("./solutions.js").get(R0.levelStr, true);
    if (!sol || !sol.ok) { console.log(`${f}: no saved route (make.js or tools/solutions.js first)`); continue; }
    const L = lane(R0.level, sol.events), m = measure(R0.level, L);
    if (args.includes("--apply")) {
      const p = pass(R0.level.objects, L, {}); const lv = Object.assign({}, R0.level, { objects: p.objects }), m2 = measure(lv, L);
      const out = args.includes("--out") ? args[args.indexOf("--out") + 1] : path.join(ROOT, "local", "tmp", path.basename(f).replace(".gdlvl", ".lane.gdlvl"));
      fs.mkdirSync(path.dirname(out), { recursive: true }); io.writeGdlvl(out, R0.rec, lv);
      console.log(`${R0.name}: removed ${p.removed.length} front deco from the lane, added ${p.added.length} frame pieces -> ${out}\n  before ${JSON.stringify(m)}\n  after  ${JSON.stringify(m2)}`);
    } else rows.push({ name: R0.name, ...m });
  }
  if (rows.length) { if (args.includes("--json")) console.log(JSON.stringify(rows)); else {
    console.log("level                               screens clutter  edge  waste frame/col");
    for (const r of rows) console.log(`${String(r.name).slice(0, 34).padEnd(34)} ${String(r.screens).padStart(8)} ${String(r.clutter).padStart(7)} ${String(r.edge).padStart(5)} ${String(r.waste).padStart(6)} ${String(r.frame).padStart(9)}`); } }
}
