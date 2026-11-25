// node tools/lego_match.js <level.gdlvl | official:N> [--min 0.6] [--top 3] [--src official|ours|all] [--test]
// The reverse lego (the user, 2026-11-25: "given a structure (in a new or old level), find a matching one. and in that way
// we can also try to help the solver of the level"). The level is read as block columns (what is in each column: solids,
// slopes, hazards, orbs, pads, portals -- tools/lego.js columns(), no route needed), and every catalogue brick is slid
// along it: a column of the brick votes for every level column with the same contents, the best (brick, shift) pairs are
// scored by how much of the brick's columns match (each column's objects: shared / all). A match above --min (0.6) says:
// this stretch is built like that brick, and the brick's clicks, moved to the level's x, are where a press probably goes.
//   --test   (official:N only) leave level N's own bricks out, match, and compare the predicted presses with the level's
//            real route: the share of real presses within a block of a predicted one, and of predicted ones that are real.
// The predicted presses are a hint for the solver (tools/presslib.js does the same from a learned picture); nothing here
// changes a level.
"use strict";
const fs = require("fs"), path = require("path");
const { GD, readGdlvl } = require("./io.js");
const L = require("./lego.js");
const ROOT = path.join(__dirname, ".."), B = 30;
const KC = { solid: "S", slope: "L", hazard: "H", orb: "O", pad: "P", mode: "M", gravity: "G", speed: "V", size: "Z" };

function levelOf(arg) {
  const m = /^official:(\d+)$/.exec(arg);
  if (m) { const j = JSON.parse(fs.readFileSync(path.join(ROOT, "local", `official_${m[1].padStart(2, "0")}.json`), "utf8")); return { name: `${+m[1]} ${j.name}`, level: GD.parseLevel(j.level), events: j.solution && j.solution.events, n: +m[1] }; }
  const r = readGdlvl(arg); return { name: path.basename(arg), level: r.level, events: null };
}
// the whole level as columns, in the same keys as a brick's (tools/lego.js columns())
function levelColumns(level) {
  const w = GD.makeWorld(level.objects, level.header), m = new Map();
  let maxC = 0;
  for (const it of w.items) {
    const k = KC[it.kind]; if (!k) continue;
    const corner = it.kind === "slope" ? (it.ceil ? (it.down === 1 ? "7" : "r") : (it.up === -1 ? "\\" : "/")) : "";
    const c = Math.floor((it.x0 + it.x1) / 2 / B + 1e-3), key = k + Math.round(it.y0 / B * 2) / 2 + corner;
    (m.get(c) || m.set(c, []).get(c)).push(key); maxC = Math.max(maxC, c);
  }
  const out = []; for (let c = 0; c <= maxC; c++) out.push((m.get(c) || []).sort());
  return { cols: out, w };
}
function colScore(a, b) {   // shared objects / all objects in the two columns (multisets); two empty columns say nothing
  if (!a.length && !b.length) return null;
  let i = 0, j = 0, s = 0; while (i < a.length && j < b.length) { if (a[i] === b[j]) { s++; i++; j++; } else if (a[i] < b[j]) i++; else j++; }
  return s / (a.length + b.length - s);
}
function match(level, bricks, o = {}) {
  const LC = levelColumns(level), cols = LC.cols, idx = new Map();
  cols.forEach((k, c) => { for (const key of new Set(k)) (idx.get(key) || idx.set(key, []).get(key)).push(c); });
  const found = [];
  for (const b of bricks) {
    const bc = L.columns(b).map(s => s ? s.split(",").sort() : []), votes = new Map();
    bc.forEach((k, j) => { for (const key of new Set(k)) for (const c of idx.get(key) || []) { const sh = c - j; votes.set(sh, (votes.get(sh) || 0) + 1); } });
    const need = Math.max(3, bc.filter(k => k.length).length * 0.5);
    for (const [sh, v] of votes) {
      if (v < need) continue;
      let tot = 0, n = 0;
      for (let j = 0; j < bc.length; j++) { const lc = cols[sh + j] || []; const s = colScore(bc[j], lc); if (s == null) continue; tot += s; n++; }
      const score = n ? tot / n : 0;
      if (score >= (o.min || 0.6) && n >= 3) found.push({ brick: b, at: sh, score: Math.round(score * 100) / 100 });
    }
  }
  // keep the best match per stretch (no two kept matches overlapping by more than half)
  found.sort((a, b) => b.score - a.score || b.brick.w - a.brick.w);
  const kept = [];
  for (const f of found) if (!kept.some(k => Math.min(k.at + k.brick.w, f.at + f.brick.w) - Math.max(k.at, f.at) > Math.min(k.brick.w, f.brick.w) / 2)) kept.push(f);
  kept.sort((a, b) => a.at - b.at);
  // the brick's presses moved to the level: x in blocks (the brick's own x0 is its first column)
  for (const k of kept) { const x0 = Math.floor(k.brick.xa + 1e-3), off = k.brick.xa - x0; k.presses = (k.brick.clicks || []).filter(c => c[2]).map(c => Math.round((k.at + off + c[0]) * 10) / 10);
    k.clicksX = (k.brick.clicks || []).map(c => [Math.round((k.at + off + c[0]) * 10) / 10, c[2] ? 1 : 0]); }
  return { kept, cols: cols.length };
}

if (require.main === module) {
  const A = process.argv.slice(2), opt = (k, d) => { const i = A.indexOf("--" + k); return i >= 0 ? A[i + 1] : d; };
  const src = levelOf(A[0]), which = opt("src", "all");
  let bricks = L.load().filter(p => p.grain === "brick" && p.verified && !p.dupOf && !p.empty && (which === "all" || p.src === which));
  if (A.includes("--test") && src.n) bricks = bricks.filter(p => !p.level.startsWith(src.n + " "));
  const t0 = Date.now(), R = match(src.level, bricks, { min: +opt("min", 0.6) });
  for (const k of R.kept) console.log(`block ${String(k.at).padStart(5)}-${String(k.at + k.brick.w).padEnd(5)} ${k.score.toFixed(2)}  ${k.brick.id.padEnd(40)} ${k.brick.sig}   presses at ${k.presses.join(" ")}`);
  const covered = R.kept.reduce((s, k) => s + k.brick.w, 0);
  console.log(`${R.kept.length} matches covering ~${Math.round(covered / Math.max(1, R.cols) * 100)}% of ${R.cols} columns, ${bricks.length} bricks tried, ${Date.now() - t0} ms`);
  if (A.includes("--test") && src.events) {
    // the real presses' x along the level's own route
    const w = GD.makeWorld(src.level.objects, src.level.header), run = GD.run(w, src.events), p0 = run.path[0].tick;
    const realX = src.events.filter(e => e.type === "press").map(e => { const s = run.path[Math.min(run.path.length - 1, e.tick - p0)]; return s ? GD.progressX ? GD.progressX(s) / B : s.x / B : null; }).filter(v => v != null);
    const pred = R.kept.flatMap(k => k.presses), within = (x, arr) => arr.some(y => Math.abs(x - y) <= 1);
    const inMatched = realX.filter(x => R.kept.some(k => x >= k.at && x <= k.at + k.brick.w));
    const hit = inMatched.filter(x => within(x, pred)).length, prec = pred.filter(x => within(x, realX)).length;
    console.log(`TEST ${src.name}: real presses inside matched stretches ${inMatched.length} of ${realX.length}; of those, ${hit} (${Math.round(hit / Math.max(1, inMatched.length) * 100)}%) have a predicted press within 1 block; ${prec} of ${pred.length} predicted presses (${Math.round(prec / Math.max(1, pred.length) * 100)}%) are real`);
  }
}
// the solver's hints from a match: inside each matched stretch [x0, x1] (blocks) the button follows the brick's own clicks
// (x where it goes down / up). tools/presslib.js solveWithLib({ hints }) drives by them there and by its library elsewhere.
function hintsFor(level, bricks, o = {}) {
  const R = match(level, bricks, o);
  return R.kept.map(k => ({ x0: k.at, x1: k.at + k.brick.w, clicks: k.clicksX, brick: k.brick.id, score: k.score }));
}
module.exports = { match, levelColumns, hintsFor };
