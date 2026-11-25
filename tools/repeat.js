// node tools/repeat.js <level.gdlvl | official:N | dir/ | all> ... [--json] [--top N]
//
// Gameplay REPETITION, read from the objects (no solve). The user, 2026-11-25, after Eclipse scored taste 80: "our score is
// too high... we are way too repetitive, in the gameplay and structures" (his GDLM 71 mark: "x6 of the same mini
// structure"). taste.js's old chunkRepeat only caught identical chunks between two empty columns, so a ship tunnel that is
// one sine twice, a wave zigzag of five equal legs, or the same block-and-spike step six times along a floor went unseen.
//
// The level as a grid of play cells (one per 30-unit square): solids kept only at their surfaces (a cell with air above or
// below: the floor top and the ceiling bottom the player sees, not the fill), hazards (^ up, v down), orbs o, pads _,
// mode portals |, slopes /. Then, over windows of W = 6 columns (~0.6 s at 1x), stepped by 2, each window rebased to its
// lowest row:
//   busy        windows with something to do (a hazard, orb, pad, portal or a change of floor / ceiling height)
//   rep         share of busy windows identical to an earlier one that does not overlap it (anywhere in the level)
//   near        the same, but the earlier copy within 100 columns (~10 s at 1x: the user's "same moves within 10 s")
//   motif       the most used busy window: how many non-overlapping copies ("x6 of the same mini structure")
//   loop        the longest run of one window repeated back to back at a fixed period (3-24 columns): a zigzag of five
//               equal legs is loop 5
//   corridor    flying modes (ship, wave, ufo, swing): share of their columns inside a run of 10+ columns whose floor and
//               ceiling surfaces stay at the same rows (a same-height corridor)
//   R           the repetition index, 0 (varied) .. 1 (one thing over and over), the mean of
//               rep / 0.6, near / 0.4, (motif - 2) / 6, (loop - 2) / 4, corridor / 0.6, each capped to 0..1.
//               The caps are a first guess from the user's notes (GDLM 71); TASTE_DATA.md "Repetition" has the officials'
//               numbers and how taste.js uses R.
// --top N: print the N most repeated windows as text pictures (rows top first), with their columns.
// --ref: the reference (on the PC: needs the game install and local/): the 22 official levels and the taste corpus
//   (local/taste/corpus.json + local/community/), grouped official / featured+ (rating rank >= 2) / plain, each measure's
//   p10..p90 per group -> knowledge/repeat_ref.json (aggregates only, no level data). taste.js reads it.
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const O = require("../lib/objects.js");
const W = 6, STEP = 2, NEAR = 100, FLY = new Set(["ship", "wave", "ufo", "swing"]);

function glyph(o) {
  const d = O.objInfo(o.id) || {};
  if (d.kind === "solid") return d.slope || /slope/.test(d.name || "") ? "/" : "#";
  if (d.kind === "slope") return "/";
  if (d.kind === "hazard") { const r = ((Math.round((o.rot || 0) / 90) % 4) + 4) % 4; return (r === 2) !== !!o.flipY ? "v" : "^"; }
  if (d.kind === "orb") return "o";
  if (d.kind === "pad") return "_";
  if (d.kind === "mode") return "|";
  return null;
}

function measure(L) {
  const cells = new Map(), modeAt = [];
  let maxC = 0;
  for (const o of L.objects) {
    const d = O.objInfo(o.id) || {};
    if (d.kind === "mode") modeAt.push([o.x, d.mode]);
    const g = glyph(o); if (!g) continue;
    const c = Math.floor(o.x / 30), r = Math.floor(o.y / 30);
    if (r < -1 || r > 40 || c < 0) continue;
    const k = c + "," + r, was = cells.get(k);
    if (!was || was === "#") cells.set(k, g);
    maxC = Math.max(maxC, c);
  }
  modeAt.sort((a, b) => a[0] - b[0]);
  const modeOf = c => { let m = "cube"; for (const [x, md] of modeAt) if (x <= c * 30 + 15) m = md; return m; };
  // per column: its cells, solids only at a surface
  const col = [];
  for (let c = 0; c <= maxC; c++) {
    const a = [];
    for (let r = -1; r <= 40; r++) {
      const g = cells.get(c + "," + r); if (!g) continue;
      if (g === "#" && cells.get(c + "," + (r + 1)) === "#" && (r === -1 || cells.get(c + "," + (r - 1)) === "#")) continue;   // fill
      a.push([r, g]);
    }
    col.push(a);
  }
  const surf = c => (col[c] || []).filter(([, g]) => g === "#" || g === "/").map(([r]) => r).join(".");
  // windows
  const sig = c => {
    let rmin = 99; for (let k = c; k < c + W; k++) for (const [r] of col[k] || []) rmin = Math.min(rmin, r);
    if (rmin === 99) return null;
    const parts = []; for (let k = c; k < c + W; k++) parts.push((col[k] || []).map(([r, g]) => (r - rmin) + g).join(""));
    return parts.join("|");
  };
  const busyAt = c => {
    for (let k = c; k < c + W; k++) for (const [, g] of col[k] || []) if (g !== "#" && g !== "/") return true;
    for (let k = c + 1; k < c + W; k++) if (surf(k) !== surf(k - 1)) return true;
    return false;
  };
  const wins = [];
  for (let c = 0; c + W <= maxC + 1; c += STEP) { if (!busyAt(c)) continue; const s = sig(c); if (s) wins.push({ c, s }); }
  const firstSeen = new Map(), lastSeen = new Map(), copies = new Map();
  let rep = 0, near = 0;
  for (const w of wins) {
    const f = firstSeen.get(w.s), l = lastSeen.get(w.s);
    if (f != null && w.c - f >= W) rep++;
    if (l != null && w.c - l >= W && w.c - l <= NEAR) near++;
    if (f == null) firstSeen.set(w.s, w.c);
    if (l == null || w.c - l >= W) { lastSeen.set(w.s, w.c); const a = copies.get(w.s) || []; a.push(w.c); copies.set(w.s, a); }
  }
  let motif = 0, motifSig = null;
  for (const [s, a] of copies) if (a.length > motif) { motif = a.length; motifSig = s; }
  // loops: the same window back to back at period p
  const sigAt = new Map(wins.map(w => [w.c, w.s]));
  let loop = 1, loopAt = null;
  for (const w of wins) for (let p = 4; p <= 24; p += 2) {
    let n = 1; while (sigAt.get(w.c + n * p) === w.s) n++;
    if (n > loop) { loop = n; loopAt = w.c; }
  }
  // same-height corridors in the flying modes
  let flyCols = 0, flatCols = 0, run = 0, prev = null;
  const endRun = () => { if (run >= 10) flatCols += run; run = 0; };
  for (let c = 0; c <= maxC; c++) {
    if (!FLY.has(modeOf(c))) { endRun(); prev = null; continue; }
    flyCols++;
    const s = surf(c), hasHaz = (col[c] || []).some(([, g]) => g !== "#");
    if (s && s === prev && !hasHaz) run++; else { endRun(); run = s ? 1 : 0; }
    prev = s;
  }
  endRun();
  const busy = wins.length, cl = v => Math.max(0, Math.min(1, v));
  const F = { busy, rep: busy ? rep / busy : 0, near: busy ? near / busy : 0, motif, loop, corridor: flyCols ? flatCols / flyCols : 0, flyCols };
  F.R = (cl(F.rep / 0.6) + cl(F.near / 0.4) + cl((motif - 2) / 6) + cl((loop - 2) / 4) + cl(F.corridor / 0.6)) / 5;
  for (const k of ["rep", "near", "corridor", "R"]) F[k] = +F[k].toFixed(3);
  const pic = s => { if (!s) return ""; const cs = s.split("|").map(x => (x.match(/-?\d+[^\d-]/g) || []).map(t => [+t.slice(0, -1), t.slice(-1)]));
    let rmax = 0; for (const a of cs) for (const [r] of a) rmax = Math.max(rmax, r);
    const rows = []; for (let r = rmax; r >= 0; r--) rows.push(cs.map(a => (a.find(([rr]) => rr === r) || [0, "."])[1]).join("")); return rows.join("\n"); };
  F.top = [...copies].sort((a, b) => b[1].length - a[1].length).slice(0, 5).map(([s, a]) => ({ n: a.length, cols: a, pic: pic(s) }));
  F.loopAt = loopAt; F.motifPic = pic(motifSig);
  return F;
}

function load(spec) { return require("./contrast.js").load(spec); }

function ref() {
  require("./heavy.js").claim();
  const groups = { official: [], featured: [], plain: [] };
  for (let n = 1; n <= 22; n++) try { groups.official.push(measure(load("official:" + n))); } catch (e) { console.error("official", n, e.message); }
  let corpus = []; try { corpus = JSON.parse(fs.readFileSync(path.join(ROOT, "local", "taste", "corpus.json"), "utf8")); } catch (e) { console.error("no taste corpus:", e.message); }
  for (const l of corpus) {
    const f = path.join(ROOT, "local", "community", l.id + ".gdlvl"); if (!fs.existsSync(f)) continue;
    let F; try { F = measure(load(f)); } catch (e) { continue; }
    if (F.busy < 20) continue;   // trigger-built levels read as empty
    (l.rank >= 2 ? groups.featured : groups.plain).push(F);
  }
  const keys = ["rep", "near", "motif", "loop", "corridor", "R"], q = (a, p) => a[Math.min(a.length - 1, Math.floor(p * (a.length - 1) + 0.5))];
  const out = { made: new Date().toISOString().slice(0, 10), W, STEP, NEAR, groups: {} };
  for (const [g, rows] of Object.entries(groups)) { out.groups[g] = { n: rows.length };
    for (const k of keys) { const v = rows.map(r => r[k]).filter(Number.isFinite).sort((a, b) => a - b); if (v.length) out.groups[g][k] = [0.1, 0.25, 0.5, 0.75, 0.9].map(p => +q(v, p).toFixed(3)); } }
  out.officials = groups.official.map((F, i) => ({ n: i + 1, R: F.R, rep: F.rep, motif: F.motif, loop: F.loop, corridor: F.corridor }));
  fs.writeFileSync(path.join(ROOT, "knowledge", "repeat_ref.json"), JSON.stringify(out, null, 1) + "\n");
  console.log(JSON.stringify(out.groups, null, 1));
}

if (require.main === module && process.argv.includes("--ref")) ref();
else if (require.main === module) {
  const args = process.argv.slice(2), json = args.includes("--json"), topN = args.includes("--top") ? +args[args.indexOf("--top") + 1] : 0;
  let files = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i]; if (a === "--top") { i++; continue; } if (a.startsWith("--")) continue;
    if (a === "all") files.push(...fs.readdirSync(path.join(ROOT, "levels")).filter(f => /^gdlm_.*\.gdlvl$/.test(f)).map(f => path.join(ROOT, "levels", f)));
    else if (/\/$/.test(a)) files.push(...fs.readdirSync(a).filter(f => f.endsWith(".gdlvl")).map(f => path.join(a, f)));
    else files.push(a);
  }
  if (!files.length) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(0); }
  const rows = [];
  for (const f of files) { let L; try { L = load(f); } catch (e) { console.error(f, e.message); continue; } const F = measure(L); rows.push({ file: f, name: L.name, ...F }); }
  if (json) { console.log(JSON.stringify(rows.map(r => { const { top, motifPic, ...rest } = r; return rest; }))); process.exit(0); }
  console.log("level                                  busy   rep  near motif loop corridor     R");
  for (const r of rows) {
    console.log(`${String(r.name).slice(0, 36).padEnd(36)} ${String(r.busy).padStart(6)} ${r.rep.toFixed(2).padStart(5)} ${r.near.toFixed(2).padStart(5)} ${String(r.motif).padStart(5)} ${String(r.loop).padStart(4)} ${r.corridor.toFixed(2).padStart(8)} ${r.R.toFixed(2).padStart(5)}`);
    if (topN) for (const t of r.top.slice(0, topN)) console.log(`   x${t.n} at columns ${t.cols.slice(0, 8).join(", ")}${t.cols.length > 8 ? " ..." : ""}\n${t.pic.split("\n").map(l => "      " + l).join("\n")}`);
  }
}
module.exports = { measure };
