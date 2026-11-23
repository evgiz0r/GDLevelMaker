// node tests/saved_routes.js [--all] [--fix]
// Every GDLM level's saved route still finishes on the current physics (run it after any physics change:
// tools/solutions.js stamps each route with the physics commit it was solved on). A level whose route
// dies, or that has none, replays a death in the viewer and on the phone: the user, 2026-11-23, "why when
// I play the cube timings it dies" -- the route was stamped with older physics, the index dropped it and
// the page's own solve failed. Fix: node tools/solutions.js <level> (heavy, waits for the lock), or --all.
// Checks levels/*.gdlvl and examples/*.gdlvl (with --all also local/wip/*/*.gdlvl). One replay each: seconds.
// A route that skips a portal or an orb/pad on its line (the no-skip rule, GD.skipCheck) fails too, and so does
// one with a hold (outside ship/wave) longer than needed: every saved route is the human route.
// --fix: refresh every route that fails or carries an old physics stamp (tools/solutions.js solve(): a clean
// route is only restamped, instant; one that dies or skips is solved again, heavy, through the lock). Run
// `node tests/saved_routes.js --all --fix` after any physics change, then push viewer/levels.js.
const fs = require("fs"), path = require("path");
const { GD, readGdlvl } = require("../tools/io.js");
const sols = require("../tools/solutions.js");
const ROOT = path.join(__dirname, "..");
const FIX = process.argv.includes("--fix");
// the first hold (outside ship/wave, over 0.15 s) that a shorter release still finishes with: a route that is
// not the human route (tools/solutions.js fromRun makes it); null when every hold is needed
function longHold(L, ev, path) {
  const w = GD.makeWorld(L.level.objects, L.level.header), e = ev.slice().sort((a, b) => a.tick - b.tick);
  const fin = list => { const r = GD.run(w, list); return r.done || (!r.dead && r.end.x >= w.endX); };
  for (let i = 0; i < e.length; i++) {
    if (e[i].type !== "press") continue;
    const j = e.findIndex((x, k) => k > i && x.type === "release"); if (j < 0) continue;
    const len = e[j].tick - e[i].tick, m = (path[e[i].tick] || {}).mode;
    if (len <= 36 || m === "ship" || m === "wave") continue;   // up to 0.15 s is a tap (a human tap lasts 50-100 ms)
    for (const d of [1, 2, 4, 8]) { if (d >= len) break;
      if (fin(e.map((x, k) => k === j ? { tick: e[i].tick + d, type: "release" } : x)))
        return `HOLD of ${(len / 240).toFixed(2)} s at block ${(path[e[i].tick].x / 30).toFixed(1)} (${m}) where a ${d}-tick tap finishes: not the human route`; }
  }
  return null;
}
if (FIX) require("../tools/heavy.js").claim();
const dirs = ["levels", "examples"].concat(process.argv.includes("--all") ? fs.readdirSync(path.join(ROOT, "local", "wip")).map(d => "local/wip/" + d) : []);
let bad = 0, n = 0;
for (const dir of dirs) {
  const d = path.join(ROOT, dir); if (!fs.existsSync(d) || !fs.statSync(d).isDirectory()) continue;
  for (const f of fs.readdirSync(d).filter(f => f.endsWith(".gdlvl")).sort()) {
    const L = readGdlvl(path.join(d, f)); n++;
    const s = sols.get(L.levelStr, true);
    let what;
    if (!s || !s.events) what = "NO SAVED ROUTE";
    else if (!s.ok) what = "saved route does not finish (ok: false)";
    else {
      const q = GD.run(GD.makeWorld(L.level.objects, L.level.header), s.events), last = q.path[q.path.length - 1];
      what = (q.done || (q.end && !q.dead)) ? null : `DIES at block ${(last.x / 30).toFixed(1)} (${last.why || "?"})`;
      if (!what) { const sk = GD.skipCheck(GD.makeWorld(L.level.objects, L.level.header), q.path, s.events); if (sk) what = `SKIPS ${sk.skipped} (${sk.why})`; }
      // the human route is the default: outside ship/wave no hold longer than needed (the user on GDLM 45 v8:
      // one hold from 1.7 s to 6.4 s, auto-jumping on every landing, "why does it jump there?")
      if (!what) what = longHold(L, s.events, q.path);
    }
    const stale = s && (s.physics !== sols.physicsCommit() || s.plan !== sols.planCommit());   // old physics or an old route planner
    if (FIX && (what || stale)) {
      // a long hold: re-plan the same run (the human-route pass); a skip or a death: solve again from scratch
      const t0 = Date.now(), r = what && /^HOLD/.test(what) ? sols.fromRun(L.level, L.levelStr, { ok: true, events: s.events })
        : sols.solve(L.level, L.levelStr, { fresh: !!(what && /^SKIPS|DIES|NO SAVED|does not finish/.test(what)) });
      console.log(`fixed ${dir}/${f}: ${what || "old stamp"} -> ${r.ok ? "finishes" : "NOT beaten (" + (r.why || "?") + ")"} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
      if (r.ok) what = null;
    }
    if (what) { bad++; console.log(`FAIL ${dir}/${f} (${L.name}): ${what}`); }
  }
}
if (FIX) require("../tools/index_levels.js").buildIndex();
console.log(bad ? `${bad} of ${n} levels would replay a death (or nothing): node tools/solutions.js <level>` : `ok: all ${n} saved routes finish on physics ${sols.physicsCommit()}`);
process.exit(bad ? 1 : 0);
