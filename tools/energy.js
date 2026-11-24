// node tools/energy.js <level.gdlvl | official:N | c<id>> [--sheet briefs/NN.vibe.json] [--json]
//
// A level's ENERGY CURVE, in one place (tools/compare_sections.js, and score.js against a vibe sheet, use this):
//   activity = obstacle starts per second -- the start of each hazard group (hazards closer than 2 blocks are one
//   group), every orb and every pad, and in ship / wave / ufo / swing every turn and narrowing of the corridor
//   (corridorEvents) -- counted per bar of the song's beat grid (per 2 s when the song has none),
//   at SONG time (level time + the level's song offset, kA13; through the speed portals).
//   e = the bar's activity as a percentile within the level (0 = its calmest bar, 1 = its busiest): the SHAPE,
//   comparable across levels and with a sheet's 0-1 energies; perSec keeps the absolute amount.
// Static (no solve): works on any level, ours or others'. Why obstacle starts and not presses: references have no
// saved route, and a press count follows the route the solver picked, not the level.
//
// curve(level)            -> { off, end, unit: "bar" | "2s", bars: [{ t0, t1, n, perSec, e }] }
// vsSong(c, songBars)     -> Spearman of activity against the song's loudness per bar (does the level follow the song)
// sheetBeats(sheet)       -> [{ id, t0, t1, energy, role }] from a vibe sheet (tools/vibe.js; beats[].t in song s)
// vsSheet(c, sheet)       -> { rho, beats: [{ id, role, want, got, diff }], worst } -- per beat of the sheet the
//                            level's mean e there against the sheet's energy; rho = Spearman over the beats
//                            (1 = the same shape). |diff| > 0.3 is a beat whose energy is off.
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const { GD, readGdlvl } = require("./io.js");
Object.assign(GD, require("../lib/sync.js"));
const S = GD.SYNC;

function spearman(a, b) {
  const rank = v => { const ix = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]), r = []; for (let i = 0; i < ix.length;) { let j = i; while (j + 1 < ix.length && ix[j + 1][0] === ix[i][0]) j++; for (let k = i; k <= j; k++) r[ix[k][1]] = (i + j) / 2; i = j + 1; } return r; };
  if (a.length < 3) return NaN;
  const x = rank(a), y = rank(b), n = x.length, m = (n - 1) / 2; let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - m) * (y[i] - m); sxx += (x[i] - m) ** 2; syy += (y[i] - m) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN;
}
// Flying stretches (ship, wave, ufo, swing): the challenge is the corridor -- walls, slopes, ceiling spikes -- which a
// hazard-group count barely sees (style, GDLM 66: a wave drop read 0.12). Per 30-unit column the corridor around the
// tracked centre line: floor = top of the highest blocking thing (solid, slope, hazard) under it, ceiling = bottom of the
// lowest above it. An event at every TURN of the floor or ceiling line (its direction of travel flips; a step up then
// down is two) and every narrowing to under 3 blocks; events closer than 2 blocks merge.
const FLY = new Set(["ship", "wave", "ufo", "swing"]);
function corridorEvents(world) {
  const portals = world.items.filter(b => b.kind === "mode").sort((a, b) => a.x0 - b.x0);
  const spans = []; for (let i = 0; i < portals.length; i++) if (FLY.has(portals[i].d.mode)) spans.push({ x0: portals[i].x1, x1: i + 1 < portals.length ? portals[i + 1].x0 : world.endX, y: (portals[i].y0 + portals[i].y1) / 2 });
  if (!spans.length) return [];
  const block = world.items.filter(b => b.kind === "solid" || b.kind === "slope" || b.kind === "hazard"), col = new Map();
  for (const b of block) for (let c = Math.floor(b.x0 / 30); c <= Math.floor((b.x1 - 1) / 30); c++) { if (!col.has(c)) col.set(c, []); col.get(c).push(b); }
  const ev = [];
  for (const sp of spans) {
    let centre = Math.max(sp.y, 45), pf = null, pc = null, df = 0, dc = 0, narrow = false;
    for (let c = Math.floor(sp.x0 / 30); c * 30 < sp.x1; c++) {
      let floor = 0, ceil = Infinity;
      for (const b of col.get(c) || []) { const m = (b.y0 + b.y1) / 2; if (m < centre) floor = Math.max(floor, b.y1); else ceil = Math.min(ceil, b.y0); }
      const x = c * 30 + 15;
      if (pf != null && floor !== pf) { const d = Math.sign(floor - pf); if (df && d !== df) ev.push(x); df = d; }
      if (pc != null && Number.isFinite(ceil) && Number.isFinite(pc) && ceil !== pc) { const d = Math.sign(ceil - pc); if (dc && d !== dc) ev.push(x); dc = d; }
      const n = Number.isFinite(ceil) && ceil - floor < 90; if (n && !narrow) ev.push(x); narrow = n;
      pf = floor; pc = ceil;
      centre = Number.isFinite(ceil) ? (floor + ceil) / 2 : Math.max(centre, floor + 45);
    }
  }
  ev.sort((a, b) => a - b);
  return ev.filter((x, i) => !i || x - ev[i - 1] > 60);
}
// obstacle starts in song time
function starts(header, objects) {
  const world = GD.makeWorld(objects, header), tl = S.timeline(world);
  const off = +((/(?:^|,)kA13,([-0-9.]+)/.exec(header || "") || [])[1] || 0);
  const tOf = x => S.tOfX(tl, x) + off, out = [];
  let last = -1e9;
  for (const h of world.items.filter(b => b.kind === "hazard").sort((a, b) => a.x0 - b.x0)) { if (h.x0 - last > 60) out.push(tOf(h.x0)); last = Math.max(last, h.x1); }
  for (const b of world.items) if (b.kind === "orb" || b.kind === "pad") out.push(tOf((b.x0 + b.x1) / 2));
  for (const x of corridorEvents(world)) out.push(tOf(x));
  return { t: out.sort((a, b) => a - b), off, end: tOf(world.endX) };
}
// level: { header, objects } (+ grid: a beat grid from tools/beats.js, optional)
function curve(level) {
  const { t, off, end } = starts(level.header, level.objects), g = level.grid;
  const bars = [];
  if (g && g.ok) { const P = 4 * g.period, b0 = g.t0 + (g.downbeat || 0) * g.period; let k = Math.ceil((off - b0) / P); for (let a = b0 + k * P; a + P <= end + 1e-6; a += P) bars.push({ t0: a, t1: a + P }); }
  else for (let a = off; a + 2 <= end + 1e-6; a += 2) bars.push({ t0: a, t1: a + 2 });
  for (const b of bars) { b.n = t.filter(x => x >= b.t0 && x < b.t1).length; b.perSec = b.n / (b.t1 - b.t0); }
  const sorted = bars.map(b => b.n).sort((a, b) => a - b);
  for (const b of bars) { let lo = sorted.findIndex(v => v >= b.n), hi = lo; while (hi < sorted.length && sorted[hi] === b.n) hi++; b.e = sorted.length > 1 ? ((lo + hi - 1) / 2) / (sorted.length - 1) : 0.5; }
  return { off, end, unit: g && g.ok ? "bar" : "2s", bars };
}
// songBars: tools/songmap.js analysis .bars ({ t, loud }); matched by start time
function vsSong(c, songBars) {
  const loud = c.bars.map(b => { const s = songBars.find(x => Math.abs(x.t - b.t0) < 0.05); return s ? s.loud : NaN; });
  const ok = loud.map((v, i) => Number.isFinite(v) ? i : -1).filter(i => i >= 0);
  return spearman(ok.map(i => c.bars[i].n), ok.map(i => loud[i]));
}
function sheetBeats(sheet) {
  const from = (sheet.song && +sheet.song.from) || 0;
  return (sheet.beats || []).filter(b => Array.isArray(b.t) && b.energy != null).map(b => ({ id: b.id, role: b.role, t0: +b.t[0], t1: +b.t[1], energy: +b.energy, from }));
}
function vsSheet(c, sheet) {
  const beats = sheetBeats(sheet).map(b => {
    const in_ = c.bars.filter(x => x.t1 > b.t0 && x.t0 < b.t1);
    const got = in_.length ? in_.reduce((s, x) => s + x.e, 0) / in_.length : NaN;
    return { id: b.id, role: b.role, t: [b.t0, b.t1], want: b.energy, got: Number.isFinite(got) ? +got.toFixed(2) : null, diff: Number.isFinite(got) ? +(got - b.energy).toFixed(2) : null };
  });
  const ok = beats.filter(b => b.got != null);
  const worst = ok.slice().sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))[0] || null;
  return { rho: +(spearman(ok.map(b => b.got), ok.map(b => b.want)) || 0).toFixed(2), beats, worst, off: ok.filter(b => Math.abs(b.diff) > 0.3).length };
}
// a level from a path / official:N / c<id>, with its beat grid
function loadLevel(src) {
  const B = require("./beats.js");
  if (/^official:/.test(src)) {
    const n = +src.split(":")[1], j = JSON.parse(fs.readFileSync(path.join(ROOT, "local", `official_${String(n).padStart(2, "0")}.json`), "utf8")), lv = GD.parseLevel(j.level);
    return { name: j.name, header: lv.header, objects: lv.objects, grid: B.loadBeats("official_" + B.OFFICIAL[n - 1]) };
  }
  const r = readGdlvl(/^c\d+$/.test(src) ? path.join(ROOT, "local", "community", src.slice(1) + ".gdlvl") : src), c = GD.getField(r.rec, "k45");
  return { name: r.name, header: r.level.header, objects: r.level.objects, grid: B.loadBeats(c && c !== "0" ? "custom_" + c : "official_" + B.OFFICIAL[+(GD.getField(r.rec, "k8") || 0)]) };
}
module.exports = { curve, vsSong, vsSheet, sheetBeats, loadLevel, spearman };

if (require.main === module) {
  const a = process.argv.slice(2), si = a.indexOf("--sheet"), L = loadLevel(a[0]), c = curve(L);
  const out = { name: L.name, unit: c.unit, bars: c.bars.map(b => [+b.t0.toFixed(2), b.n, +b.e.toFixed(2)]) };
  if (si >= 0) out.sheet = vsSheet(c, JSON.parse(fs.readFileSync(a[si + 1], "utf8")));
  if (a.includes("--json")) { console.log(JSON.stringify(out)); return; }
  console.log(`${L.name}: ${c.bars.length} ${c.unit}s; energy (0 calm .. 1 busiest bar of the level):`);
  console.log("  " + c.bars.map(b => " .:-=+*#%@"[Math.min(9, Math.round(b.e * 9))]).join(""));
  if (out.sheet) {
    console.log(`against the sheet: shape rho ${out.sheet.rho}, ${out.sheet.off} beat(s) off by > 0.3`);
    for (const b of out.sheet.beats) console.log(`  ${String(b.id).padEnd(10)} ${String(b.role || "").padEnd(8)} ${b.t[0]}-${b.t[1]} s  want ${b.want}  got ${b.got}${b.diff != null && Math.abs(b.diff) > 0.3 ? "  <- off" : ""}`);
  }
}
