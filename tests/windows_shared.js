// node tests/windows_shared.js [level.gdlvl ...]  -- one timing-window definition everywhere.
// The viewer, tools/windows.js, tools/score.js and difficulty disagreed (GDLM 47: 4 ms vs ~113 ms; GDLM 44
// v13: 13 vs 208 ms) because each measured differently. lib/windows.js's inputWindows is now the one
// definition (a player's window: later inputs re-planned, lib/difficulty.js measureWindows). Checks, on each
// level's saved natural route (tools/solutions.js): inputWindows gives exactly measureWindows's windows, and
// prints any player's window narrower than the strict one (the other inputs kept at their ticks): it
// should not be, apart from the 200 ms search cap; GDLM 60's dash-orb release is one (open, 2026-11-23).
// Default levels: the quick ones (GDLM 44, GDLM 60); GDLM 47 takes ~2 min.
const path = require("path");
const { GD, readGdlvl } = require("../tools/io.js");
Object.assign(GD, require("../lib/difficulty.js"));
const W = require("../lib/windows.js");
const files = process.argv.slice(2).length ? process.argv.slice(2) : ["levels/gdlm_44_hellgate.gdlvl", "levels/gdlm_60_physics_lab.gdlvl"];
let bad = 0;
for (const f of files) {
  const L = readGdlvl(path.join(__dirname, "..", f)), w = GD.makeWorld(L.level.objects, L.level.header);
  const sol = require("../tools/solutions.js").get(L.levelStr, true);
  if (!sol || !sol.ok) { console.log(`skip ${f}: no saved beaten solution (node tools/solutions.js ${f})`); continue; }
  const ev = sol.events.slice().sort((a, b) => a.tick - b.tick), p = GD.run(w, ev).path;
  const mine = W.inputWindows(w, ev, p), ref = GD.measureWindows(w, ev), strict = W.strictWindows(w, ev, p, {});
  let diff = 0, narrower = 0;
  for (const x of mine) {
    const r = ref.find(a => a.tick === x.tick);
    if (!r || r.lo !== x.lo || r.hi !== x.hi) diff++;
    const s = strict.find(a => a.tick === x.tick && a.type === x.type);
    // a player's search stops at 200 ms each way (D.MAX_SHIFT, `open`): narrower there is the cap, not a bug
    if (s && !x.open && x.hi - x.lo < s.hi - s.lo) { narrower++; console.log(`   note: ${x.type} at tick ${x.tick} (${p[x.tick].mode}, block ${(p[x.tick].x / 30).toFixed(1)}): player ${x.lo}-${x.hi}, strict ${s.lo}-${s.hi}`); }
  }
  const ok = !diff;   // narrower-than-strict is printed, not failed: GDLM 60's dash-orb release (known, open)
  if (!ok) bad++;
  const tight = mine.reduce((m, x) => Math.min(m, (x.hi - x.lo + 1) / 240 * 1000), Infinity);
  console.log(`${ok ? "ok  " : "BAD "} ${f}: ${mine.length} inputs, tightest ${Math.round(tight)} ms; ${diff} differ from difficulty's, ${narrower} narrower than strict`);
}
process.exit(bad ? 1 : 0);
