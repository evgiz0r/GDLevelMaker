// node tools/triples.js [level.gdlvl ...] [--all]   -- triple spikes in a level: how many, where, back-to-back pairs
//
// The user (2026-11-24): "lets do less triple spikes for now as well." A soft rule (knowledge/checklist.md "Few triple
// spikes"): a triple (exactly three full spikes side by side on one row; 4+ in a row is a pit, a hazard floor the player clears another way) is rare -- at most one per ~15 s of level,
// never two within 4 s of each other; singles, doubles, pits, pillars and orbs carry the jumps instead.
// Counted: full spikes (id 8) with the same y and rotation, each within 31 units of the last (a run of exactly 3 = one triple).
// Not counted: pit spikes (small / low ids 9, 39, 61, 103...: a hazard floor, not a jump).
// score.js gate "triples" (WARN: soft -- a level may keep one with a stated reason). --all: every level in levels/.
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const { GD, readGdlvl } = require("./io.js");
Object.assign(GD, require("../lib/sync.js"));
const PER_S = 15, GAP_S = 4;

function triplesOf(level) {
  const spikes = level.objects.filter(o => o.id === 8).map(o => ({ x: o.x, y: Math.round(o.y), r: Math.round(o.rot || 0) % 360 }))
    .sort((a, b) => a.y - b.y || a.r - b.r || a.x - b.x);
  let tl = null; try { tl = GD.SYNC.timeline(GD.makeWorld(level.objects, level.header)); } catch (e) {}
  const out = [];
  for (let i = 0; i < spikes.length;) {
    let j = i; while (j + 1 < spikes.length && spikes[j + 1].y === spikes[i].y && spikes[j + 1].r === spikes[i].r && spikes[j + 1].x - spikes[j].x <= 31) j++;
    const n = j - i + 1;
    if (n === 3) out.push({ x: spikes[i].x, n, t: tl ? +GD.SYNC.tOfX(tl, spikes[i].x).toFixed(2) : null, block: Math.round(spikes[i].x / 30) });
    i = j + 1;
  }
  return out.sort((a, b) => a.x - b.x);
}
// the rule: count, allowed count (1 per 15 s, at least 1), back-to-back pairs (under 4 s apart)
function check(level) {
  const T = triplesOf(level);
  let secs = 0; try { const w = GD.makeWorld(level.objects, level.header), tl = GD.SYNC.timeline(w); secs = GD.SYNC.tOfX(tl, Math.max(...level.objects.map(o => o.x))); } catch (e) {}
  const allowed = Math.max(1, Math.floor(secs / PER_S)), close = [];
  for (let i = 1; i < T.length; i++) if (T[i].t != null && T[i].t - T[i - 1].t < GAP_S) close.push([T[i - 1], T[i]]);
  const flags = [];
  if (T.length > allowed) flags.push(`${T.length} triple spikes in ${secs.toFixed(0)} s (want at most ${allowed}: one per ${PER_S} s)`);
  if (close.length) flags.push(`${close.length} back to back (under ${GAP_S} s apart: ${close.map(([a, b]) => `${a.t}-${b.t} s`).join(", ")})`);
  return { triples: T, n: T.length, allowed, secs: +secs.toFixed(1), close, flags };
}
module.exports = { triplesOf, check, PER_S, GAP_S };

if (require.main === module) {
  let files = process.argv.slice(2).filter(a => !a.startsWith("--"));
  if (process.argv.includes("--all")) files = fs.readdirSync(path.join(ROOT, "levels")).filter(f => f.endsWith(".gdlvl")).map(f => path.join("levels", f));
  let bad = 0, tot = 0;
  for (const f of files) {
    let L; try { L = readGdlvl(f); } catch (e) { console.log(f, "unreadable"); continue; }
    const c = check(L.level); tot += c.n; if (c.flags.length) bad++;
    console.log(`${(c.flags.length ? "WARN " : "ok   ") + path.basename(f).padEnd(40)} ${String(c.n).padStart(3)} triples / ${c.secs} s${c.flags.length ? "  " + c.flags.join("; ") : ""}${c.n && files.length === 1 ? "\n  at " + c.triples.map(t => `${t.t} s (block ${t.block})`).join(", ") : ""}`);
  }
  if (files.length > 1) console.log(`${bad} of ${files.length} levels over the rule, ${tot} triples in all`);
}
