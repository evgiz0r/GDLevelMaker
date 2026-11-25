// node tools/lego.js mine [official] [ours] [sketches] [library] [--sketch <file.json> ...]   -- cut levels into 1-3 s pieces,
//                                                  classify and measure each -> local/lego/pieces.json (all, with shapes)
//                                                  + knowledge/lego.json (committed: families, parameters, counts; shapes
//                                                  only for OUR levels and the user's sketches, never RobTop's)
// node tools/lego.js families [--src official|ours|sketch]   -- the family table: how often, typical parameters
// node tools/lego.js variety <level.gdlvl>           -- a level's piece sequence by signature: repeats, what is missing
//                                                      vs the official levels' mix
// node tools/lego.js page [--public] [--out f.html]  -- a page of thumbnails, filterable by family / mode / wrapper /
//                                                      source. Default: everything, local only (official pieces are
//                                                      RobTop's layouts: local/lego/page.html, opened on the PC or via
//                                                      serve.js). --public: ours + sketches + the official numbers only
//                                                      (for the phone Artifact).
//
// Structure research, "level building as lego" (the user, 2026-11-25: "ship wave and swing have some similarity in
// their possible structures. a path, a path with some spikes, corridors. corridors with paths ... maybe if we just
// play this as some kind of sophisticated lego"). LEGO.md: the families, how a piece is cut and measured, the
// parameters, what the official levels use vs ours, the variety rules, what is open.
//
// A piece = a stretch of a level's route (the saved solution replayed, no solving) of one mode, ~1-3 s, cut at calm
// ticks (no input near, grounded in the jumping modes). Sketches have no route: their path is the drawn corridor's
// midline (marked "path: midline").
// Families (the user's grouping):
//   fly    ship, wave, swing   -- a PATH through space; wrapped as: open / floor path / roof path / corridor,
//                                 +spikes (hazards are >= 30% of the walls), +gates (narrowings), +flips (gravity)
//   jump   cube, robot, ufo    -- hops between floors: steps, pits, pillars
//   flip   ball, spider        -- gravity-switching runners: floor <-> roof
// plus mechanics on any of them: orbs, pads, portals (gravity, speed, size).
"use strict";
if (require.main === module && /^(mine)$/.test(process.argv[2] || "")) require("./heavy.js").claim();
const fs = require("fs"), path = require("path");
const { GD, readGdlvl } = require("./io.js");
const ROOT = path.join(__dirname, ".."), LOCAL = path.join(ROOT, "local"), OUTDIR = path.join(LOCAL, "lego");
const KNOW = path.join(ROOT, "knowledge", "lego.json");
const FAMILY = { ship: "fly", wave: "fly", swing: "fly", cube: "jump", robot: "jump", ufo: "jump", ball: "flip", spider: "flip" };
const TPS = GD.PHYS.TPS, B = 30;
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
const median = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };

// ---------------------------------------------------------------- sources
function officialSources() {
  const out = [];
  for (let n = 1; n <= 22; n++) {
    const f = path.join(LOCAL, `official_${String(n).padStart(2, "0")}.json`);
    if (!fs.existsSync(f)) continue;
    const j = JSON.parse(fs.readFileSync(f, "utf8"));
    if (!j.solution || !j.solution.events) continue;
    out.push({ src: "official", name: `${n} ${j.name}`, level: GD.parseLevel(j.level), events: j.solution.events });
  }
  return out;
}
function ourSources() {
  const S = require("./solutions.js"), out = [];
  for (const f of fs.readdirSync(path.join(ROOT, "levels")).filter(f => /^gdlm_.*\.gdlvl$/.test(f)).sort()) {
    const L = readGdlvl(path.join(ROOT, "levels", f)), sol = S.get(L.levelStr, true);
    if (!sol || !sol.events) continue;
    out.push({ src: "ours", name: f.replace(/^gdlm_|\.gdlvl$/g, ""), file: "levels/" + f, level: L.level || GD.parseLevel(L.levelStr), events: sol.events });
  }
  return out;
}
// the lego-* pieces of the structure library (tools/structures.js build <id> -> local/structures/), each as ONE piece
// (its mode's stretch); the saved route when the check left one, else the corridor's midline
function librarySources() {
  const S = require("./solutions.js"), dir = path.join(LOCAL, "structures"), out = [];
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).filter(f => /^lego-.*\.gdlvl$/.test(f)).sort()) {
    const L = readGdlvl(path.join(dir, f)), sol = S.get(L.levelStr, true);
    out.push({ src: "library", name: f.replace(/\.gdlvl$/, ""), file: "tools/structures.js " + f.replace(/\.gdlvl$/, ""), level: GD.parseLevel(L.levelStr), events: sol && sol.ok !== false ? sol.events : null, whole: true });
  }
  return out;
}
function sketchSources(files) {
  const SK = require("../lib/sketch.js"), out = [];
  const dir = path.join(LOCAL, "sketches");
  if (!files.length && fs.existsSync(dir)) files = fs.readdirSync(dir).filter(f => /\.json$/.test(f)).map(f => path.join(dir, f));
  for (const f of files) {
    let sk = JSON.parse(fs.readFileSync(f, "utf8")); sk = sk.data || sk;
    const lv = SK.convert(sk);
    out.push({ src: "sketch", name: (sk.name || path.basename(f, ".json")), file: path.relative(ROOT, f), level: GD.parseLevel(lv.levelStr), events: null });
  }
  return out;
}

// ---------------------------------------------------------------- route
function heldAt(events) {   // tick -> held?, and the input ticks
  const ev = (events || []).slice().sort((a, b) => a.tick - b.tick), ticks = ev.map(e => e.tick);
  return { ticks, held: t => { let h = false; for (const e of ev) { if (e.tick > t) break; h = e.type === "press"; } return h; } };
}
// a sketch has no route: walk the drawn level column by column through the free gap the path is in, mode by mode
function midlineRoute(w) {
  const items = w.items, portals = items.filter(i => i.kind === "mode" || i.kind === "gravity" || i.kind === "speed").sort((a, b) => a.x0 - b.x0);
  const endX = Math.max(w.endX || 0, ...items.map(i => i.x1)) + 60, path = [];
  let mode = "cube", grav = 1, y = 15, pi = 0;
  for (let x = 0; x < endX; x += 5) {
    while (pi < portals.length && portals[pi].x0 <= x) {
      const p = portals[pi++];
      if (p.kind === "mode") { mode = p.d.mode; y = (p.y0 + p.y1) / 2; }
      if (p.kind === "gravity") grav = p.d.grav === 0 ? -grav : p.d.grav;
    }
    if (FAMILY[mode] === "fly") {
      // free intervals at this column; keep the one nearest y, go to its middle (smoothly)
      const occ = items.filter(i => (i.kind === "solid" || i.kind === "hazard" || i.kind === "slope") && i.x0 <= x + 2 && i.x1 >= x - 2).map(i => [i.y0, i.y1]).sort((a, b) => a[0] - b[0]);
      let lo = 0, best = null;
      for (const [a, b] of [...occ, [1e4, 1e4]]) { if (a > lo + 10) { const mid = (lo + Math.min(a, 1200)) / 2, d = Math.abs(mid - y); if (!best || d < best.d) best = { mid, d, lo, hi: a }; } lo = Math.max(lo, b); }
      if (best) y += Math.max(-5, Math.min(5, best.mid - y));
    } else y = 15;
    path.push({ tick: path.length, x, y, mode, grav, sp: 1, floorY: 0, ceilY: null, grounded: FAMILY[mode] !== "fly" });
  }
  return { path, dead: false, midline: true };
}
function route(s) {
  const w = GD.makeWorld(s.level.objects, s.level.header);
  if (!s.events) return { w, r: midlineRoute(w), inputs: heldAt([]) };
  const r = GD.run(w, s.events);
  return { w, r, inputs: heldAt(s.events) };
}

// ---------------------------------------------------------------- cutting
const TARGET = 2.2, MINS = 0.6;
function cut(r, inputs, whole) {
  const p = r.path, spans = [];
  if (!p.length) return spans;
  let a = 0;
  for (let t = 1; t <= p.length; t++) if (t === p.length || p[t].mode !== p[a].mode || p[t].dead) { spans.push([a, t - 1]); if (t < p.length && p[t].dead) break; a = t; }
  const secs = (i, j) => r.midline ? (p[j].x - p[i].x) / 311.58 : (p[j].tick - p[i].tick) / TPS;
  const calm = i => {   // larger = calmer: seconds to the nearest input, grounded bonus in the jumping modes
    const tk = r.midline ? 0 : p[i].tick; let d = 1;
    if (!r.midline) for (const u of inputs.ticks) d = Math.min(d, Math.abs(u - tk) / TPS);
    return d + (p[i].grounded && FAMILY[p[i].mode] !== "fly" ? 0.3 : 0);
  };
  const out = [];
  if (whole) return spans.filter(([i0, i1]) => r.path[i0].mode !== "cube" && secs(i0, i1) >= MINS);
  for (const [i0, i1] of spans) {
    const D = secs(i0, i1);
    if (D < MINS) continue;
    const n = Math.max(1, Math.round(D / TARGET));
    let s = i0;
    for (let k = 1; k <= n; k++) {
      let e = i1;
      if (k < n) {
        // target end, snapped to the calmest state within +-0.5 s
        let best = -1, bi = -1;
        for (let j = s; j <= i1; j++) {
          const dt = secs(s, j); if (dt < D / n - 0.5) continue; if (dt > D / n + 0.5) break;
          if (j % 4) continue;
          const c = calm(j); if (c > best) { best = c; bi = j; }
        }
        e = bi > 0 ? bi : Math.min(i1, s + 1);
      }
      if (secs(s, e) >= MINS) out.push([s, e]);
      s = e;
    }
  }
  return out;
}

// ---------------------------------------------------------------- measuring one piece
const KCODE = { solid: "S", slope: "L", hazard: "H", orb: "O", pad: "P", mode: "M", gravity: "G", speed: "V", size: "Z" };
const ORBISH = /orb/, PADISH = /pad/;
function measure(src, w, r, inputs, i0, i1) {
  const p = r.path, a = p[i0], b = p[i1], mode = a.mode, fam = FAMILY[mode] || "other";
  const xa = a.x, xb = b.x, W = Math.max(1, Math.round((xb - xa) / B));
  const items = w.items.filter(it => it.x1 > xa - B && it.x0 < xb + B);
  const seconds = r.midline ? (xb - xa) / 311.58 : (b.tick - a.tick) / TPS;
  // per column: the path's height, the floor and roof right under / over it, and what they are made of
  const cols = [];
  for (let c = 0; c < W; c++) {
    const x0 = xa + c * B, x1 = x0 + B;
    const ys = []; let grav = 1, band = null;
    for (let i = i0; i <= i1; i++) if (p[i].x >= x0 && p[i].x < x1) { ys.push(p[i].y); grav = p[i].grav; if (p[i].ceilY != null) band = [p[i].floorY || 0, p[i].ceilY]; }
    if (!ys.length) { cols.push(cols.length ? Object.assign({}, cols[cols.length - 1]) : { py: a.y / B }); continue; }
    const py = ys.reduce((s, v) => s + v, 0) / ys.length, lo = Math.min(...ys), hi = Math.max(...ys);
    let f = { y: 0, k: "G" }, rf = band ? { y: band[1], k: "E" } : null;
    for (const it of items) {
      if (it.x1 <= x0 || it.x0 >= x1) continue;
      const k = it.kind === "hazard" ? "H" : (it.kind === "solid" || it.kind === "slope") ? "S" : null;
      if (!k) continue;
      if (it.y1 <= lo + 4 && it.y1 > f.y) f = { y: it.y1, k };
      if (it.y0 >= hi - 4 && (!rf || it.y0 < rf.y)) rf = { y: it.y0, k };
    }
    if (band && f.k === "G" && band[0] > 0) f = { y: band[0], k: "E" };
    cols.push({ py: r1(py / B), f: r1(f.y / B), fk: f.k, r: rf ? r1(rf.y / B) : null, rk: rf ? rf.k : null, g: grav });
  }
  // mechanics in the stretch
  const mech = {}; let flips = 0, portals = [];
  for (const it of items) {
    if (it.x0 < xa - 5 || it.x0 > xb) continue;
    if (ORBISH.test(it.d.name || "") || PADISH.test(it.d.name || "")) mech[it.d.name] = (mech[it.d.name] || 0) + 1;
    if (it.kind === "gravity" || it.kind === "speed" || it.kind === "size" || it.kind === "mode") portals.push(it.d.name);
  }
  for (let i = i0 + 1; i <= i1; i++) if (p[i].grav !== p[i - 1].grav) flips++;
  let presses = 0, heldT = 0, toggles = 0;
  if (!r.midline) {
    for (const u of inputs.ticks) if (u >= a.tick && u <= b.tick) toggles++;
    for (let i = i0; i <= i1; i += 4) if (inputs.held(p[i].tick)) heldT++;
    presses = Math.ceil(toggles / 2);
  }
  const hold = r.midline ? null : r2(heldT / Math.max(1, (i1 - i0) / 4));
  const hazards = items.filter(it => it.kind === "hazard" && it.x0 >= xa && it.x0 < xb).length;
  const pyS = cols.map(c => c.py), yRange = r1(Math.max(...pyS) - Math.min(...pyS));
  const P = { src: src.src, level: src.name, file: src.file, mode, family: fam, speed: a.sp, x: Math.round(xa / B), w: W,
    s: r2(seconds), presses, toggles, hold, flips, hazards, hzPer100: Math.round(hazards / W * 100), mech, portals, yRange, midline: !!r.midline };
  if (fam === "fly") Object.assign(P, flyShape(cols, mode));
  else Object.assign(P, groundShape(cols, p, i0, i1));
  P.sig = signature(P);
  P.cols = cols;
  P.shape = items.filter(it => /^(solid|slope|hazard|orb|pad|mode|gravity|speed|size)$/.test(it.kind) && it.x1 > xa - B && it.x0 < xb + B)
    .slice(0, 900).map(it => [KCODE[it.kind], r1((it.x0 - xa) / B), r1(it.y0 / B), r1((it.x1 - xa) / B), r1(it.y1 / B), it.d.color || ""]);
  P.path = []; for (let i = i0; i <= i1; i += Math.max(1, Math.round((i1 - i0) / 80))) P.path.push([r1((p[i].x - xa) / B), r1(p[i].y / B)]);
  return P;
}
function flyShape(cols, mode) {
  const n = cols.length, near = 8;
  const floorNear = cols.filter(c => c.fk !== "G" && c.fk !== "E" && c.py - c.f <= near || (c.fk === "G" && c.py <= 3)).length / n;
  const roofNear = cols.filter(c => c.r != null && c.rk !== "E" && c.r - c.py <= near).length / n;
  const gaps = cols.filter(c => c.r != null && c.rk !== "E").map(c => c.r - c.f);
  const gap = median(gaps);
  const walls = cols.reduce((s, c) => s + (c.fk === "H") + (c.rk === "H"), 0), wallsAll = cols.reduce((s, c) => s + 1 + (c.r != null && c.rk !== "E"), 0);
  // gates: narrowings of 2+ blocks below the median gap, up to 5 columns long
  let gates = 0;
  if (gap != null) for (let c = 0; c < n; c++) { const g = cols[c].r != null && cols[c].rk !== "E" ? cols[c].r - cols[c].f : 99; if (g <= gap - 2 && (c === 0 || !(cols[c - 1].r != null && cols[c - 1].r - cols[c - 1].f <= gap - 2))) gates++; }
  // path turns: the path's direction changes (hysteresis half a block)
  let turns = 0, dir = 0, ext = cols[0].py;
  for (const c of cols) { if (dir >= 0 && c.py < ext - 0.5) { if (dir > 0) turns++; dir = -1; ext = c.py; } else if (dir <= 0 && c.py > ext + 0.5) { if (dir < 0) turns++; dir = 1; ext = c.py; } else ext = dir > 0 ? Math.max(ext, c.py) : dir < 0 ? Math.min(ext, c.py) : ext; }
  const slopeCols = cols.filter((c, i) => i && Math.abs(c.py - cols[i - 1].py) >= 0.5).length / n;
  let wrap = floorNear >= 0.6 && roofNear >= 0.6 ? "corridor" : floorNear >= 0.6 ? "floor path" : roofNear >= 0.6 ? "roof path" : "open";
  const spiky = walls / Math.max(1, wallsAll) >= 0.3;
  return { wrap, spiky, gates, gap: gap == null ? null : r1(gap), floorNear: r2(floorNear), roofNear: r2(roofNear), turns, slope: r2(slopeCols),
    pathKind: turns === 0 ? (slopeCols > 0.3 ? "slope" : "straight") : turns <= 2 ? "bend" : "zigzag" };
}
function groundShape(cols, p, i0, i1) {
  let floors = 0, last = null, pits = 0, top = 0;
  for (let i = i0; i <= i1; i += 4) { const q = p[i]; if (!q.grounded) continue; const f = Math.round((q.grav === -1 ? q.y + 15 : q.y - 15) / B); if (last != null && f !== last) floors++; last = f; top = Math.max(top, f); }
  for (const c of cols) if (c.fk === "H") pits++;
  const wrap = floors >= 3 ? "steps" : pits / cols.length >= 0.3 ? "pits" : cols.some(c => c.r != null && c.rk !== "E" && c.r - c.py <= 3) ? "low roof" : "flat";
  return { wrap, floors, pitShare: r2(pits / cols.length), top };
}
function signature(P) {
  const m = Object.keys(P.mech).map(k => k.replace(/ (orb|pad)$/, "-$1")).sort().join("+");
  const bits = [P.family, P.mode, P.wrap];
  if (P.family === "fly") { bits.push(P.pathKind); if (P.spiky) bits.push("spikes"); if (P.gates) bits.push("gates"); if (P.gap != null) bits.push(P.gap <= 3 ? "narrow" : P.gap <= 5.5 ? "mid" : "wide"); }
  if (P.flips) bits.push("flips");
  if (m) bits.push(m);
  return bits.join(" / ");
}

// ---------------------------------------------------------------- commands
function mine(which, sketchFiles) {
  const srcs = [];
  if (which.includes("official")) srcs.push(...officialSources());
  if (which.includes("ours")) srcs.push(...ourSources());
  if (which.includes("sketches") || sketchFiles.length) srcs.push(...sketchSources(sketchFiles));
  if (which.includes("library")) srcs.push(...librarySources());
  const pieces = [];
  for (const s of srcs) {
    const t0 = Date.now();
    let R; try { R = route(s); } catch (e) { console.log("  skip", s.name, e.message); continue; }
    const cuts = cut(R.r, R.inputs, s.whole);
    for (const [i0, i1] of cuts) pieces.push(measure(s, R.w, R.r, R.inputs, i0, i1));
    console.log(`  ${s.src.padEnd(8)} ${s.name.padEnd(34)} ${String(cuts.length).padStart(3)} pieces${R.r.dead ? " (route dies at block " + Math.round(R.r.path[R.r.path.length - 1].x / B) + ")" : ""}  ${Date.now() - t0} ms`);
  }
  pieces.forEach((p, i) => p.id = (p.src[0] + "-" + p.level.replace(/[^a-z0-9]+/gi, "_").toLowerCase() + "-" + p.x));
  fs.mkdirSync(OUTDIR, { recursive: true });
  const prev = fs.existsSync(path.join(OUTDIR, "pieces.json")) ? JSON.parse(fs.readFileSync(path.join(OUTDIR, "pieces.json"), "utf8")) : [];
  const keep = prev.filter(p => !srcs.some(s => s.src === p.src));   // mining one source keeps the others
  const all = keep.concat(pieces);
  fs.writeFileSync(path.join(OUTDIR, "pieces.json"), JSON.stringify(all));
  writeKnowledge(all);
  console.log(`${pieces.length} pieces from ${srcs.length} levels -> local/lego/pieces.json (${all.length} in all), knowledge/lego.json`);
  return all;
}
// committed: per family / signature, counts by source and parameter ranges; shapes of ours and sketches only
function writeKnowledge(all) {
  const fam = {};
  for (const p of all) {
    const k = p.sig, e = fam[k] = fam[k] || { sig: k, family: p.family, mode: p.mode, wrap: p.wrap, n: { official: 0, ours: 0, sketch: 0, library: 0 }, levels: { official: new Set(), ours: new Set(), sketch: new Set(), library: new Set() }, s: [], w: [], presses: [], hold: [], gap: [], yRange: [], hz: [] };
    e.n[p.src]++; e.levels[p.src].add(p.level);
    e.s.push(p.s); e.w.push(p.w); e.presses.push(p.presses); if (p.hold != null) e.hold.push(p.hold); if (p.gap != null) e.gap.push(p.gap); e.yRange.push(p.yRange); e.hz.push(p.hzPer100);
  }
  const range = a => a.length ? [Math.min(...a), median(a), Math.max(...a)] : null;
  const families = Object.values(fam).map(e => ({ sig: e.sig, family: e.family, mode: e.mode, wrap: e.wrap, n: e.n,
    officialLevels: e.levels.official.size, oursLevels: e.levels.ours.size,
    seconds: range(e.s), width: range(e.w), presses: range(e.presses), hold: range(e.hold), gap: range(e.gap), yRange: range(e.yRange), hazardsPer100: range(e.hz) }))
    .sort((a, b) => (b.n.official - a.n.official) || (b.n.ours - a.n.ours));
  const mix = {}; for (const p of all) { const m = mix[p.src] = mix[p.src] || {}; const k = p.family + "/" + p.mode + "/" + p.wrap; m[k] = (m[k] || 0) + 1; }
  const pub = all.filter(p => p.src !== "official").map(p => { const q = Object.assign({}, p); delete q.cols; if (p.src === "ours") { delete q.shape; delete q.path; } return q; });   // our levels are in the repo: rebuild their shapes with mine
  const out = { made: new Date().toISOString().slice(0, 10), physics: require("./solutions.js").physicsCommit(), note: "LEGO.md. Families and parameters of 1-3 s pieces cut from routes; official pieces as numbers only (no layouts).",
    counts: { official: all.filter(p => p.src === "official").length, ours: all.filter(p => p.src === "ours").length, sketch: all.filter(p => p.src === "sketch").length, library: all.filter(p => p.src === "library").length }, mix, families, pieces: pub };
  fs.writeFileSync(KNOW, JSON.stringify(out, null, 0).replace(/\},\{"sig"/g, '},\n{"sig"').replace(/\},\{"src"/g, '},\n{"src"'));
}
function load() { const f = path.join(OUTDIR, "pieces.json"); if (!fs.existsSync(f)) { console.log("no local/lego/pieces.json: run `node tools/lego.js mine official ours sketches` first"); process.exit(1); } return JSON.parse(fs.readFileSync(f, "utf8")); }
function families(all, src) {
  const rows = {};
  for (const p of all) { if (src && p.src !== src) continue; const k = p.family + " / " + p.mode + " / " + p.wrap + (p.spiky ? " +spikes" : "") + (p.gates ? " +gates" : "") + (p.flips ? " +flips" : ""); const r = rows[k] = rows[k] || { official: 0, ours: 0, sketch: 0, library: 0 }; r[p.src]++; }
  const tot = { official: 0, ours: 0, sketch: 0 }; for (const r of Object.values(rows)) for (const k in tot) tot[k] += r[k];
  console.log("family / mode / wrap".padEnd(48) + "official   ours   sketch");
  for (const [k, r] of Object.entries(rows).sort((a, b) => b[1].official - a[1].official || b[1].ours - a[1].ours))
    console.log(k.padEnd(48) + `${String(r.official).padStart(4)} ${String(Math.round(r.official / Math.max(1, tot.official) * 100)).padStart(3)}%  ${String(r.ours).padStart(4)} ${String(Math.round(r.ours / Math.max(1, tot.ours) * 100)).padStart(3)}%  ${String(r.sketch).padStart(4)}`);
}
// a level's sequence of pieces: the same signature back to back or within 4 pieces = a repeat
function variety(file) {
  const L = readGdlvl(file), S = require("./solutions.js"), sol = S.get(L.levelStr, true);
  const s = { src: "ours", name: path.basename(file), level: GD.parseLevel(L.levelStr), events: sol && sol.events };
  const R = route(s), ps = cut(R.r, R.inputs).map(([a, b]) => measure(s, R.w, R.r, R.inputs, a, b));
  let rep = 0;
  ps.forEach((p, i) => { const back = ps.slice(Math.max(0, i - 4), i).findIndex(q => q.sig === p.sig); if (back >= 0) rep++; console.log(`${String(p.x).padStart(5)}  ${p.s.toFixed(1)}s  ${back >= 0 ? "REPEAT " : "       "}${p.sig}`); });
  console.log(`${ps.length} pieces, ${rep} repeat a signature from the 4 before (${Math.round(rep / Math.max(1, ps.length) * 100)}%), ${new Set(ps.map(p => p.sig)).size} distinct`);
  return { pieces: ps.length, repeats: rep, distinct: new Set(ps.map(p => p.sig)).size };
}

module.exports = { cut, measure, route, signature, FAMILY, mine, load };

if (require.main === module) {
  const A = process.argv.slice(2), cmd = A[0];
  const opt = k => { const i = A.indexOf("--" + k); return i >= 0 ? A[i + 1] : null; };
  if (cmd === "mine") {
    const which = A.slice(1).filter(a => !a.startsWith("--") && !/\.json$/.test(a));
    const sk = A.filter((a, i) => A[i - 1] === "--sketch");
    mine(which.length ? which : ["official", "ours", "sketches", "library"], sk);
  } else if (cmd === "families") families(load(), opt("src"));
  else if (cmd === "variety") variety(A[1]);
  else if (cmd === "page") require("./lego_page.js").build(load(), { pub: A.includes("--public"), out: opt("out") });
  else console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("// node")).join("\n"));
}
