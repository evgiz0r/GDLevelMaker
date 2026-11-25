// node tools/decocomp.js <level.gdlvl | official:N | all> ... [--json]     how a level COMPOSES its deco
// node tools/decocomp.js --ref                 officials + the taste corpus (on the PC) -> knowledge/decocomp_ref.json
// node tools/decocomp.js <level> --strip       the density profile along the level (per 4 blocks) as JSON, for charts
//
// The user, 2026-11-25: "lets think more about the deco, just evenly putting things is not good enough". decostudy.js says
// how MUCH deco a screen has; this says how it is ARRANGED (ART.md "Deco composition"). All static (no route), deco locked to
// the camera left out (its placed x means nothing). Per level:
//   cv        coefficient of variation of deco per 8-block segment: rhythm along the level (even spreading = low)
//   quiet     share of 8-block segments under a quarter of the level's median: breathing space
//   peaks     share of segments over twice the median: big moments
//   focal     per screen (20 blocks), the share of its deco inside its densest 4-block window (even = 0.2), median
//   clump     per screen, variance / mean of deco counts over 2x2-block cells that hold any deco: >1 = pieces gather in
//             clusters, ~1 = scattered at random, <1 = laid out evenly; median
//   big       large pieces (9+ blocks^2 after scale) per screen: set pieces, median
//   trans     deco in the 8 blocks after a mode / speed / gravity portal over the level's median (set pieces at transitions)
//   follow    rank correlation, per 8 blocks, of deco with the gameplay's intensity (hazards + orbs + pads): >0 = the art
//             swells where the play does
//   above     share of deco above the play (the highest play object +-2 blocks around), the rest below or at it
//   back / front   share on back layers (B5-B3) / in front (T2 and up)
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const O = require("../lib/objects.js");
const SEG = 240, SCREEN = 600;
const ZN = { B5: -5, B4: -3, B3: -1, B2: 1, B1: 3, T1: 5, T2: 7, T3: 9, T4: 11 };
let CAT = null;
function cat() { if (CAT) return CAT; CAT = {};
  for (const line of fs.readFileSync(path.join(ROOT, "knowledge", "objects", "catalogue.tsv"), "utf8").split("\n").slice(1)) {
    const c = line.split("\t"); if (c.length >= 8) CAT[c[0]] = { w: +c[5] || 1, h: +c[6] || 1, layer: c[7], group: c[1] }; }
  return CAT; }
const info = o => O.objInfo(o.id) || {};
const isTrig = o => info(o).kind === "trigger" || (cat()[o.id] || {}).group === "triggers";
const isPlay = o => { const k = info(o).kind; return k && k !== "decoration" && k !== "deco" && k !== "trigger"; };
const layerOf = o => { const p = o.props || {}; if (p[24] != null && p[24] !== "") return +p[24]; const c = cat()[o.id]; return c && ZN[c.layer] != null ? ZN[c.layer] : 5; };
const area = o => { const c = cat()[o.id] || { w: 1, h: 1 }, p = o.props || {}, s = +(p[32] || 1); return c.w * c.h * s * s * +(p[128] || 1) * +(p[129] || 1); };
const med = a => { a = a.filter(Number.isFinite).sort((x, y) => x - y); return a.length ? a[a.length >> 1] : NaN; };
function rank(a) { const i = a.map((v, k) => [v, k]).sort((p, q) => p[0] - q[0]), r = []; i.forEach(([, k], n) => r[k] = n); return r; }
function spearman(a, b) { if (a.length < 5) return NaN; const ra = rank(a), rb = rank(b), n = a.length, ma = (n - 1) / 2;
  let sab = 0, sa = 0, sb = 0; for (let k = 0; k < n; k++) { sab += (ra[k] - ma) * (rb[k] - ma); sa += (ra[k] - ma) ** 2; sb += (rb[k] - ma) ** 2; } return sa && sb ? sab / Math.sqrt(sa * sb) : NaN; }

function measure(L, opts = {}) {
  const objs = L.objects.filter(o => o.x != null);
  const locked = new Set(); for (const o of objs) { const p = o.props || {}; if (o.id === 901 && p[58] === "1" && p[51]) locked.add(p[51]); }
  const isLocked = o => ((o.props || {})[57] || "").split(".").some(g => locked.has(g));
  const play = objs.filter(isPlay), deco = objs.filter(o => !isPlay(o) && !isTrig(o) && o.id !== 914 && !isLocked(o));
  if (play.length < 20 || deco.length < 50) return null;
  const x1 = Math.max(...play.map(o => o.x)), nSeg = Math.ceil(x1 / SEG);
  const segD = new Array(nSeg).fill(0), segP = new Array(nSeg).fill(0);
  for (const o of deco) { const s = Math.floor(o.x / SEG); if (s >= 0 && s < nSeg) segD[s]++; }
  for (const o of play) { const k = info(o).kind, s = Math.floor(o.x / SEG); if (s >= 0 && s < nSeg && (k === "hazard" || k === "orb" || k === "pad")) segP[s]++; }
  const m = med(segD), mean = segD.reduce((a, b) => a + b, 0) / nSeg, sd = Math.sqrt(segD.reduce((a, v) => a + (v - mean) ** 2, 0) / nSeg);
  // the play's top per column (+-2 blocks) for above / below
  const topAt = new Map(); for (const o of play) { const c = Math.floor(o.x / 30); for (let d = -2; d <= 2; d++) topAt.set(c + d, Math.max(topAt.get(c + d) ?? -1e9, o.y)); }
  let above = 0, back = 0, front = 0;
  for (const o of deco) { const t = topAt.get(Math.floor(o.x / 30)); if (t != null && o.y > t + 15) above++; const z = layerOf(o); if (z <= -1) back++; if (z >= 7) front++; }
  // screens
  const focal = [], clump = [], big = [];
  for (let x0 = 0; x0 < x1; x0 += SCREEN) {
    const D = deco.filter(o => o.x >= x0 && o.x < x0 + SCREEN); if (D.length < 10) continue;
    const per = new Array(20).fill(0); for (const o of D) per[Math.min(19, Math.floor((o.x - x0) / 30))]++;
    let best = 0; for (let i = 0; i + 4 <= 20; i++) best = Math.max(best, per[i] + per[i + 1] + per[i + 2] + per[i + 3]);
    focal.push(best / D.length);
    const cells = new Map(); for (const o of D) { const k = Math.floor(o.x / 60) + "," + Math.floor(o.y / 60); cells.set(k, (cells.get(k) || 0) + 1); }
    const v = [...cells.values()], mu = v.reduce((a, b) => a + b, 0) / v.length; if (v.length >= 4) clump.push(v.reduce((a, c) => a + (c - mu) ** 2, 0) / v.length / mu);
    big.push(D.filter(o => area(o) >= 9).length);
  }
  // transitions
  const portals = play.filter(o => { const k = info(o).kind; return k === "mode" || k === "speed" || k === "gravity"; }).map(o => o.x);
  const tr = []; for (const px of portals) { let n = 0; for (const o of deco) if (o.x >= px && o.x < px + SEG) n++; tr.push(n); }
  const r3 = v => Number.isFinite(v) ? +v.toFixed(3) : null;
  const F = { name: L.name, segs: nSeg, cv: r3(sd / Math.max(1e-9, mean)), quiet: r3(segD.filter(v => v < m / 4).length / nSeg), peaks: r3(segD.filter(v => v > 2 * m).length / nSeg),
    focal: r3(med(focal)), clump: r3(med(clump)), big: r3(med(big)), trans: r3(tr.length && m ? med(tr) / m : NaN), follow: r3(spearman(segD, segP)),
    above: r3(above / deco.length), back: r3(back / deco.length), front: r3(front / deco.length) };
  if (opts.strip) F.strip = { seg: SEG, deco: segD, play: segP, portals: portals.map(x => +(x / 30).toFixed(1)) };
  return F;
}
function load(spec) { return require("./contrast.js").load(spec); }

function ref() {
  require("./heavy.js").claim();
  const groups = { official: [], featured: [], plain: [] };
  for (let n = 1; n <= 22; n++) try { const F = measure(load("official:" + n)); if (F) groups.official.push(F); } catch (e) { console.error("official", n, e.message); }
  let corpus = []; try { corpus = JSON.parse(fs.readFileSync(path.join(ROOT, "local", "taste", "corpus.json"), "utf8")); } catch (e) { console.error("no taste corpus:", e.message); }
  for (const l of corpus) { const f = path.join(ROOT, "local", "community", l.id + ".gdlvl"); if (!fs.existsSync(f)) continue;
    let F; try { F = measure(load(f)); } catch (e) { continue; } if (!F) continue; F.era = l.era; (l.rank >= 2 ? groups.featured : groups.plain).push(F); }
  const keys = ["cv", "quiet", "peaks", "focal", "clump", "big", "trans", "follow", "above", "back", "front"];
  const q = (a, p) => a[Math.min(a.length - 1, Math.floor(p * (a.length - 1) + 0.5))];
  const out = { made: new Date().toISOString().slice(0, 10), groups: {} };
  for (const [g, rows] of Object.entries(groups)) { out.groups[g] = { n: rows.length };
    for (const k of keys) { const v = rows.map(r => r[k]).filter(Number.isFinite).sort((a, b) => a - b); if (v.length) out.groups[g][k] = [0.1, 0.25, 0.5, 0.75, 0.9].map(p => +q(v, p).toFixed(3)); } }
  // featured 2.2 apart: the modern look
  const f22 = groups.featured.filter(r => r.era === "2.2"); out.groups.featured22 = { n: f22.length };
  for (const k of keys) { const v = f22.map(r => r[k]).filter(Number.isFinite).sort((a, b) => a - b); if (v.length) out.groups.featured22[k] = [0.1, 0.25, 0.5, 0.75, 0.9].map(p => +q(v, p).toFixed(3)); }
  // three example strips (density profiles only, no level data): the officials' 1, 3 and 10
  out.strips = {}; for (const n of [1, 3, 10]) try { const F = measure(load("official:" + n), { strip: true }); out.strips["official" + n] = F.strip; } catch (e) {}
  fs.writeFileSync(path.join(ROOT, "knowledge", "decocomp_ref.json"), JSON.stringify(out, null, 1) + "\n");
  console.log(JSON.stringify(out.groups, null, 1));
}

if (require.main === module && process.argv.includes("--ref")) ref();
else if (require.main === module) {
  const args = process.argv.slice(2), files = [];
  for (const a of args) { if (a.startsWith("--")) continue; if (a === "all") files.push(...fs.readdirSync(path.join(ROOT, "levels")).filter(f => /^gdlm_.*\.gdlvl$/.test(f)).map(f => path.join(ROOT, "levels", f))); else files.push(a); }
  if (!files.length) { console.log(fs.readFileSync(__filename, "utf8").split("\n").filter(l => l.startsWith("//")).join("\n")); process.exit(0); }
  const rows = []; for (const f of files) { try { const F = measure(load(f), { strip: args.includes("--strip") }); if (F) rows.push(F); } catch (e) { console.error(f, e.message); } }
  if (args.includes("--json") || args.includes("--strip")) console.log(JSON.stringify(rows));
  else { console.log("level                               cv  quiet peaks focal clump  big trans follow above  back front");
    for (const r of rows) console.log(`${String(r.name).slice(0, 32).padEnd(32)} ${["cv", "quiet", "peaks", "focal", "clump", "big", "trans", "follow", "above", "back", "front"].map(k => String(r[k] ?? "-").padStart(5)).join(" ")}`); }
}
module.exports = { measure };
