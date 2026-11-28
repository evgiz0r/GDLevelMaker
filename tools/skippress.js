// node tools/skippress.js <level.gdlvl> [...] [--route r.json] [--json out.json] [--all]
// SKIPPABLE PRESSES (Evgeni 2026-11-28, on the ball labs: "if you can just not click and it passes you to the next clicks
// then thats a skip needs to be blocked"): for each press of the level's saved route, play the route WITHOUT that press (and
// its release) and see what happens:
//   SKIP    the player is still alive at the next press, and the rest of the route still clears from there: the click
//           was not needed -- an obstacle that does not ask for it (worst kind: block it)
//   SKIP2   the same with the NEXT press left out too (a ball flip pair: two clicks that cancel out)
//   SKIP?   alive at the next press, but the rest of the route dies later either way (often only because a missed flip
//           turns later flips the wrong way: not a skip by itself; printed with --all)
//   ok      dies before the next press: the click is needed
// Mostly for ball / spider / gravity gameplay (a missed flip often just rolls on), but every mode is checked. No solving:
// one run per press, seconds on a lab.
if (require.main === module) require("./heavy.js").claim();
"use strict";
const fs = require("fs"), path = require("path");
const { GD, readGdlvl } = require("./io.js");

function skips(levelStr, events) {
  const lv = typeof levelStr === "string" ? GD.parseLevel(levelStr) : levelStr, w = GD.makeWorld(lv.objects, lv.header);   // a level string or {objects, header}
  const ev = events.filter(e => typeof e === "object").slice().sort((a, b) => a.tick - b.tick);
  const base = GD.run(w, ev), P = base.path;
  const presses = ev.map((e, i) => i).filter(i => ev[i].type === "press");
  const out = [];
  for (let k = 0; k < presses.length; k++) {
    const i = presses[k], e = ev[i], rel = ev.findIndex((r, j) => j > i && r.type === "release");
    const nextT = k + 1 < presses.length ? ev[presses[k + 1]].tick : P.length - 1;
    const nextI = k + 1 < presses.length ? presses[k + 1] : -1, nextRel = nextI < 0 ? -1 : ev.findIndex((r, j) => j > nextI && r.type === "release");
    const run = gone => { const r = GD.run(w, ev.filter((_, j) => !gone.includes(j))); const end = r.path.length - 1; return { r, end, clears: !r.dead && !!r.path[end].done }; };
    const one = run([i, rel]), alive = one.end >= nextT;
    // a ball / gravity flip left out turns every later flip the wrong way: leaving the NEXT press out too is the same
    // player with two clicks fewer -- clearing that way is a skip as well
    const two = alive && !one.clears && nextI >= 0 ? run([i, rel, nextI, nextRel]) : null;
    const s = P[Math.min(e.tick, P.length - 1)] || {}, r = one.r, end = one.end;
    const kind = !alive ? "ok" : one.clears ? "SKIP" : two && two.clears ? "SKIP2" : "SKIP?";
    out.push({ press: k + 1, tick: e.tick, t: +(e.tick / 240).toFixed(2), x: Math.round(s.x || 0), mode: s.mode, kind, diesAt: r.dead ? +(end / 240).toFixed(2) : null, why: r.why || "" });
  }
  return { presses: presses.length, clears: !!(P[P.length - 1] && P[P.length - 1].done), list: out };
}
module.exports = { skips };

if (require.main === module) {
  const a = process.argv.slice(2), opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
  const files = a.filter(x => /\.gdlvl$/.test(x));
  if (!files.length) { console.log("usage: node tools/skippress.js <level.gdlvl> [...] [--route r.json] [--json out.json]"); process.exit(1); }
  const all = {};
  for (const f of files) {
    const L = readGdlvl(f), rf = opt("--route");
    const ev = rf ? (j => Array.isArray(j) ? j : j.events)(JSON.parse(fs.readFileSync(rf, "utf8"))) : require("./autoclose.js").routeOf(f, L.levelStr);
    if (!ev) { console.log(f + ": no saved route"); continue; }
    const r = skips(L.levelStr, ev); all[f] = r;
    const sk = r.list.filter(p => p.kind === "SKIP" || p.kind === "SKIP2" || (a.includes("--all") && p.kind !== "ok"));
    console.log(`${path.basename(f)}: ${r.presses} presses, ${r.list.filter(p => p.kind === "SKIP").length} SKIP, ${r.list.filter(p => p.kind === "SKIP2").length} SKIP2, ${r.list.filter(p => p.kind === "SKIP?").length} SKIP?${r.clears ? "" : " (the route itself does not clear!)"}`);
    for (const p of sk) console.log(`  ${p.kind.padEnd(5)} press ${p.press} at ${p.t}s x ${p.x} ${p.mode}${p.diesAt != null ? ` (dies later at ${p.diesAt}s: ${p.why})` : ""}`);
  }
  if (opt("--json")) fs.writeFileSync(opt("--json"), JSON.stringify(all, null, 1));
}
