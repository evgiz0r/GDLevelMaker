// node tools/windows.js <level.gdlvl> [--from X] [--to X] [--span 60]
// Timing window of every input of a level's solution, in any mode (ship, wave too): each press or
// release is moved tick by tick (the others stay put) and the whole plan replayed; its window is the
// run of ticks around it that still clear. Works where the exact solver's windows do not exist
// (levels with portals are solved by the sweep, which gives none). The solution is the level's .json
// beside it (wip), else a fresh solveAny. --from/--to limit it to inputs between those x.
// Use it on a human-like plan (style's natural replay, lib/natural.js): a fewest-presses solve hugs
// walls and holds long, so its inputs sit at the edge of what works and its windows look tiny
// (GDLM 44 v6's sweep solve: 4-13 ms) without the level being that tight.
// Found 2026-11-23: GDLM 44's wave zigzag ("i still couldnt fit into the gap in 44").
const fs = require("fs");
const { GD, readGdlvl } = require("./io.js");
const a = process.argv.slice(2), file = a[0];
const opt = (k, d) => { const i = a.indexOf("--" + k); return i < 0 ? d : +a[i + 1]; };
if (!file) { console.log(fs.readFileSync(__filename, "utf8").split("\n").slice(0, 7).join("\n")); process.exit(1); }
const FROM = opt("from", -Infinity), TO = opt("to", Infinity), SPAN = opt("span", 60);
const L = readGdlvl(file), w = GD.makeWorld(L.level.objects);
const side = file.replace(/\.gdlvl$/, ".json");
let sol = fs.existsSync(side) && JSON.parse(fs.readFileSync(side, "utf8")).solution;
// else the level's saved natural solution (tools/solutions.js: one tap per jump, as a player plays;
// a solver's held button makes every later auto-jump move with the press, and its windows look ~0)
if (!(sol && sol.events)) { const c = require("./solutions.js").get(L.levelStr, true); if (c && c.ok) sol = c; }
let ev = (sol && sol.events) || GD.solveAny(w).events;
const clears = list => { const q = GD.run(w, list); return !q.dead && (q.done || q.end.x >= w.endX); };
if (!clears(ev)) { console.log("the saved solution does not clear with this physics: re-solve first"); ev = GD.solveAny(w).events; }
const base = GD.run(w, ev).path;
const xAt = t => base[Math.min(t, base.length - 1)];
console.log(`${L.name}: input windows (ticks of 1/240 s; ms; the 60 fps frames inside)`);
for (let i = 0; i < ev.length; i++) {
  const e = ev[i], p = xAt(e.tick);
  if (!p || p.x < FROM || p.x > TO) continue;
  const lo0 = i > 0 ? ev[i - 1].tick + 1 : 0, hi0 = i + 1 < ev.length ? ev[i + 1].tick - 1 : e.tick + SPAN;
  const ok = t => { const l = ev.map(x => Object.assign({}, x)); l[i].tick = t; return clears(l); };
  let lo = e.tick, hi = e.tick;
  while (lo - 1 >= Math.max(lo0, e.tick - SPAN) && ok(lo - 1)) lo--;
  while (hi + 1 <= Math.min(hi0, e.tick + SPAN) && ok(hi + 1)) hi++;
  const n = hi - lo + 1, frames = Math.floor(hi / 4) - Math.ceil(lo / 4) + 1;  // 60 fps boundaries (every 4th tick) inside
  const edge = (lo === lo0 || hi === hi0) ? " (up to the next input)" : (lo === e.tick - SPAN || hi === e.tick + SPAN) ? " (or more)" : "";
  console.log(`${e.type.padEnd(7)} tick ${String(e.tick).padStart(5)}  x ${p.x.toFixed(0).padStart(5)} y ${p.y.toFixed(0).padStart(4)} ${p.mode.padEnd(6)} window ${lo}-${hi} = ${(n / 240 * 1000).toFixed(0)} ms, ${Math.max(frames, 0)} frames${edge}`);
}
